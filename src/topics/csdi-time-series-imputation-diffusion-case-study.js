// CSDI uses conditional score-based diffusion for probabilistic time-series
// imputation: observed values condition the denoiser while missing targets are
// generated as a sample distribution.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'csdi-time-series-imputation-diffusion-case-study',
  title: 'CSDI Time Series Imputation Diffusion Case Study',
  category: 'AI & ML',
  summary: 'Conditional diffusion for missing time-series values: observation masks, target masks, temporal-feature attention, imputation samples, and uncertainty bands.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['conditional mask', 'sample ensemble'], defaultValue: 'conditional mask' },
  ],
  run,
};

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function pipelineGraph(title) {
  return graphState({
    nodes: [
      { id: 'x', label: 'X', x: 1.0, y: 2.4, note: 'values' },
      { id: 'mask', label: 'M', x: 1.0, y: 4.5, note: 'observed' },
      { id: 'split', label: 'split', x: 2.8, y: 3.4, note: 'self sup' },
      { id: 'cond', label: 'cond', x: 4.5, y: 2.3, note: 'known' },
      { id: 'target', label: 'target', x: 4.5, y: 4.5, note: 'hidden' },
      { id: 'noise', label: 'noise', x: 6.1, y: 4.5, note: 'xt' },
      { id: 'denoise', label: 'denoise', x: 7.7, y: 3.4, note: 'score' },
      { id: 'samples', label: 'samples', x: 9.2, y: 3.4, note: 'dist' },
    ],
    edges: [
      { id: 'e-x-split', from: 'x', to: 'split' },
      { id: 'e-mask-split', from: 'mask', to: 'split' },
      { id: 'e-split-cond', from: 'split', to: 'cond' },
      { id: 'e-split-target', from: 'split', to: 'target' },
      { id: 'e-target-noise', from: 'target', to: 'noise' },
      { id: 'e-cond-denoise', from: 'cond', to: 'denoise' },
      { id: 'e-noise-denoise', from: 'noise', to: 'denoise' },
      { id: 'e-denoise-samples', from: 'denoise', to: 'samples' },
    ],
  }, { title });
}

function observedMatrix(title) {
  return labelMatrix(
    title,
    [
      { id: 'hr', label: 'hr' },
      { id: 'bp', label: 'bp' },
      { id: 'o2', label: 'oxy' },
      { id: 'temp', label: 'temp' },
    ],
    [
      { id: 't1', label: 't1' },
      { id: 't2', label: 't2' },
      { id: 't3', label: 't3' },
      { id: 't4', label: 't4' },
      { id: 't5', label: 't5' },
    ],
    [
      ['obs', 'obs', 'hide', 'obs', 'obs'],
      ['obs', 'miss', 'target', 'obs', 'obs'],
      ['obs', 'obs', 'obs', 'miss', 'target'],
      ['obs', 'target', 'obs', 'obs', 'obs'],
    ],
  );
}

function* conditionalMask() {
  yield {
    state: observedMatrix('Mask and targets'),
    highlight: { active: ['bp:t3', 'o2:t5', 'temp:t2'], found: ['hr:t1', 'hr:t2', 'hr:t4', 'hr:t5'], compare: ['bp:t2', 'o2:t4'] },
    explanation: 'CSDI represents a multivariate time series as values, timestamps, and an observation mask. During self-supervised training, some observed values are deliberately hidden as targets while the remaining observations condition the model.',
    invariant: 'The model should denoise target values while keeping conditional observations available as clean evidence.',
  };

  yield {
    state: pipelineGraph('Self-supervised split creates condition and target sets'),
    highlight: { active: ['x', 'mask', 'split', 'cond', 'target', 'e-x-split', 'e-mask-split', 'e-split-cond', 'e-split-target'] },
    explanation: 'The split is a data-structure move: one mask says what was truly observed, and another mask chooses which observed entries become training targets. That lets the model learn imputation even when the raw training series has few missing values.',
  };

  yield {
    state: pipelineGraph('Conditional denoising uses observed values directly'),
    highlight: { active: ['cond', 'noise', 'denoise', 'e-cond-denoise', 'e-noise-denoise'], compare: ['target'] },
    explanation: 'At each reverse diffusion step, the noisy target values are denoised while clean conditional observations are supplied to the network. The model can attend across both time and feature dimensions.',
  };

  yield {
    state: labelMatrix(
      'CSDI record',
      [
        { id: 'values', label: '' },
        { id: 'obs', label: '' },
        { id: 'target', label: '' },
        { id: 'time', label: '' },
      ],
      [
        { id: 'type', label: 'field' },
        { id: 'role', label: 'role' },
      ],
      [
        ['X', 'signal'],
        ['Mo', 'known'],
        ['Mt', 'learn'],
        ['tm', 'order'],
      ],
    ),
    highlight: { active: ['values:role', 'obs:role', 'target:role', 'time:role'] },
    explanation: 'The implementation has to keep masks separate. Mixing true missingness, training targets, and timestamps is the fastest way to create leakage or evaluate the wrong task.',
  };
}

function* sampleEnsemble() {
  yield {
    state: plotState({
      axes: { x: { label: 'time', min: 1, max: 8 }, y: { label: 'value', min: 40, max: 110 } },
      series: [
        { id: 'obs', label: 'obs', points: [{ x: 1, y: 80 }, { x: 2, y: 83 }, { x: 3, y: 86 }, { x: 6, y: 92 }, { x: 7, y: 89 }, { x: 8, y: 87 }] },
        { id: 'low', label: 'p10', points: [{ x: 3, y: 84 }, { x: 4, y: 81 }, { x: 5, y: 84 }, { x: 6, y: 90 }] },
        { id: 'mid', label: 'p50', points: [{ x: 3, y: 86 }, { x: 4, y: 88 }, { x: 5, y: 91 }, { x: 6, y: 92 }] },
        { id: 'high', label: 'p90', points: [{ x: 3, y: 88 }, { x: 4, y: 97 }, { x: 5, y: 101 }, { x: 6, y: 94 }] },
      ],
      markers: [
        { id: 'gap', x: 4.5, y: 99, label: 'gap' },
      ],
    }),
    highlight: { active: ['low', 'mid', 'high', 'gap'], found: ['obs'] },
    explanation: 'Probabilistic imputation returns a distribution, not just one filled-in line. The spread between p10, p50, and p90 tells the downstream system how uncertain the missing interval is.',
  };

  yield {
    state: labelMatrix(
      'Sample ledger',
      [
        { id: 's1', label: 's1' },
        { id: 's2', label: 's2' },
        { id: 's3', label: 's3' },
        { id: 'agg', label: 'sum' },
      ],
      [
        { id: 'missing', label: 'gap' },
        { id: 'score', label: 'score' },
      ],
      [
        ['smooth', 'likely'],
        ['spike', 'maybe'],
        ['flat', 'weak'],
        ['quant', 'report'],
      ],
    ),
    highlight: { active: ['s1:missing', 's2:missing', 'agg:missing'], compare: ['s3:score'] },
    explanation: 'Keeping several samples is valuable. A clinical, finance, or sensor pipeline may prefer a conservative quantile, a median estimate, or a risk flag based on distribution width.',
  };

  yield {
    state: pipelineGraph('Forecasting and interpolation reuse the same machinery'),
    highlight: { active: ['cond', 'denoise', 'samples', 'e-denoise-samples'], compare: ['target', 'noise'] },
    explanation: 'Once the conditional diffusion model can generate missing targets, nearby tasks become natural: interpolate internal gaps, forecast future windows, or simulate plausible completions under observed context.',
  };

  yield {
    state: labelMatrix(
      'ICU monitor',
      [
        { id: 'ingest', label: 'in' },
        { id: 'mask', label: 'mask' },
        { id: 'sample', label: 'samp' },
        { id: 'alert', label: 'alert' },
      ],
      [
        { id: 'data', label: 'data' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['vitals', 'time'],
        ['miss', 'device'],
        ['quant', 'uncert'],
        ['risk', 'show'],
      ],
    ),
    highlight: { active: ['ingest:guard', 'mask:guard', 'sample:guard', 'alert:guard'] },
    explanation: 'In an ICU monitor, imputation can smooth gaps from sensor dropout. The system must still expose missingness and uncertainty so a filled value does not silently become false evidence for an alert.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'conditional mask') yield* conditionalMask();
  else if (view === 'sample ensemble') yield* sampleEnsemble();
  else throw new InputError('Pick a CSDI view.');
}

export const article = {
  references: [
    { title: 'CSDI: Conditional Score-based Diffusion Models for Probabilistic Time Series Imputation', url: 'https://papers.neurips.cc/paper_files/paper/2021/hash/cfe8504bda37b575c70ee1a8276f3486-Abstract.html' },
    { title: 'CSDI paper PDF', url: 'https://papers.neurips.cc/paper_files/paper/2021/file/cfe8504bda37b575c70ee1a8276f3486-Paper.pdf' },
    { title: 'CSDI code', url: 'https://github.com/ermongroup/CSDI' },
  ],
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Time-series systems usually want a complete rectangular table: one row per variable, one column per timestamp, and a value in every cell. Real data rarely arrives that way. Hospital monitors drop readings. Industrial sensors go offline. Markets close or halt. Mobile devices sample irregularly. The missing entries are not a small formatting problem; they are part of the data-generating process.',
        'The naive goal is to fill the blanks so downstream code can keep running. The stronger goal is to fill them while preserving uncertainty and the fact that they were missing. A blood-pressure gap during a cuff failure is different from a smooth gap in a weather station. A market gap during a halt is different from an ordinary weekend. The mask can carry signal.',
        'CSDI, Conditional Score-based Diffusion for Imputation, exists for this harder version. It treats missing values as conditional generation. The model uses observed values as evidence and samples plausible completions for target positions. The output is not just a patched table. It is a distribution over possible tables.',
      ],
    },
    {
      heading: 'The obvious approach and its wall',
      paragraphs: [
        'The reasonable first tools are deletion, mean fill, forward fill, interpolation, and deterministic forecasting. They are fast, easy to explain, and often good enough for short gaps in smooth signals. If a temperature sensor misses one minute between two stable readings, a simple interpolation may be all the system needs.',
        'The wall appears when the gap is long, the system is multivariate, or the uncertainty matters. Forward fill can freeze a signal that was changing quickly. Linear interpolation can invent smoothness through a shock. Dropping rows removes rare events, and rare events are often the reason the monitoring system exists.',
        'A deterministic model has a similar problem. It gives one answer. That answer may have low average error while hiding several plausible futures. For clinical alerts, financial risk, and reliability decisions, the range of plausible values can matter as much as the median value.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to separate observed evidence from target responsibility. A CSDI-style record contains the value matrix, an observation mask, a target mask, timestamps, feature identifiers, a noise level, and later a set of generated samples. The data structure is as important as the neural network.',
        'The observation mask records what the world actually gave you. The target mask records which entries the model must reconstruct. During self-supervised training, some observed entries are intentionally hidden as targets. During deployment, truly missing entries become targets. Mixing those roles creates leakage or evaluates the wrong task.',
        'Conditional diffusion then learns how plausible target values behave given the observed context. The model is not asked to memorize a global average. It is asked to denoise missing values while seeing nearby times, other variables, feature embeddings, and the mask that marks what was genuinely observed.',
      ],
    },
    {
      heading: 'Mechanism: training',
      paragraphs: [
        'Training starts with a partially observed multivariate series. The pipeline chooses a subset of observed entries and hides them as training targets. The remaining observed entries stay available as clean conditioning evidence. This self-supervised split lets the model learn imputation even when the raw dataset does not provide labeled missing values.',
        'Noise is added to the target entries according to a diffusion schedule. The denoising network receives the noisy target values, the clean conditional values, masks, timestamps, feature embeddings, and the diffusion step. It learns to predict the noise or score needed to move the target positions back toward plausible clean values.',
        'The masking contract is the main correctness guard. Conditional cells must stay visible. Target cells must not leak their clean values into the conditioning path. True missing cells must not be treated as measured observations. If the masks are wrong, the model can look strong in validation while learning a task that cannot exist in production.',
      ],
    },
    {
      heading: 'Mechanism: sampling',
      paragraphs: [
        'At imputation time, the unknown target positions start as noise. The observed positions stay fixed as condition. The reverse diffusion process repeatedly denoises the targets while the network attends across time and feature dimensions. After enough reverse steps, one full sample of the missing region is produced.',
        'Running the sampler many times produces an ensemble. From that ensemble the system can report a median, quantiles, prediction intervals, or a full sample set for downstream simulation. This is the main product difference from ordinary imputation: uncertainty is carried forward as data.',
        'The denoising process can support interpolation, forecasting, or scenario generation because those tasks differ mainly in which mask positions are marked as targets. Internal gaps, future windows, and counterfactual completions all become conditional target regions under the same machinery.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The statistical reason is conditional score learning. The model sees many examples where some observed values have been hidden. It learns what clean targets are likely under nearby observed context. If oxygen saturation, heart rate, blood pressure, and time-of-day have predictable relationships, the denoiser can use those relationships instead of treating each channel as an isolated curve.',
        'The structural reason is that masks preserve roles. The model can condition on measured evidence while reconstructing only the selected target positions. This keeps the imputation problem aligned with deployment: some values are known, some are not, and the model must respect the boundary.',
        'The practical reason is sampling. A single point estimate can be wrong in a way that looks precise. A sample ensemble can show that two or three completions are all plausible. Downstream systems can then choose a conservative quantile, trigger a human review, or run a decision rule across many completions.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the mask view, the important movement is the split between condition and target. Some cells are measured and remain clean evidence. Some cells are hidden targets during training or missing targets during inference. The lesson is that the value matrix alone is not enough; masks define the learning contract.',
        'In the pipeline view, the noise node only belongs to target positions. Observed values do not need to be regenerated. They are supplied as context. This is the operational distinction that prevents the model from rewriting measured facts while trying to complete missing cells.',
        'In the sample-ensemble view, the p10, p50, and p90 lines are the data product. A narrow band means the observed context pins the gap down. A wide band means the system should expose uncertainty instead of pretending the imputed value was measured.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'CSDI buys uncertainty with computation. Training a conditional diffusion model is heavier than interpolation, forward fill, or a small autoregressive baseline. Inference can require many reverse denoising steps for each generated sample. The cost grows with time length, feature count, diffusion steps, sample count, and attention design.',
        'Memory also matters. A batch may carry values, observed masks, target masks, conditional masks, time embeddings, feature embeddings, noisy targets, and sample outputs. Long multivariate histories can become expensive before the model architecture itself is considered.',
        'Evaluation must match the promise. MAE and RMSE check point accuracy, but probabilistic imputation also needs calibration, interval coverage, CRPS, negative log likelihood where appropriate, and task-level checks. The key question is whether downstream decisions remain stable or become safer when uncertainty is exposed.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'CSDI fits multivariate time series where cross-feature context is real. Clinical vitals, industrial telemetry, environmental sensors, finance, and complex forecasting pipelines often have variables that explain each other. A heart-rate trend can change the likely blood-pressure range. A machine vibration channel can change the likely temperature curve.',
        'It also fits settings where uncertainty is useful rather than annoying. A risk model, triage dashboard, maintenance planner, or scenario simulator can consume quantiles or samples. In those systems, the spread is not a side effect. It is part of the answer.',
        'CSDI is especially attractive when missingness patterns are diverse but there is enough data to learn conditional structure. The method can learn from self-supervised masks and then apply that knowledge to real gaps.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'CSDI is the wrong tool for cheap cleanup when a simple rule is enough. If the signal is smooth, the gap is short, and uncertainty is not used downstream, interpolation may beat diffusion on cost, latency, and auditability.',
        'It also struggles when training missingness differs from production missingness. A model trained on random hidden cells may be badly calibrated when deployed on long outages, device-specific failures, or missing-not-at-random behavior. The samples can look plausible while underestimating the real uncertainty.',
        'Small datasets are another weak point. A diffusion model can learn correlations that are spurious, biased, or leakage-driven. If missingness is itself the target of the decision, filling values can hide the very signal the system needs.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The common bug is mask leakage. A training target remains visible as conditioning data, or a true missing value is treated like a hidden observed value. Validation then measures a softened or impossible problem. The model appears accurate because it was allowed to see what it should have predicted.',
        'Irregular time is another quiet failure. If timestamps are bucketed poorly, the model may confuse a five-minute gap with a five-hour gap. If feature embeddings are weak, the model may blur channels that have different physical meanings. If too few samples are drawn, the tails of the imputation distribution are invisible.',
        'The product failure is hiding the mask after imputation. A dashboard that shows generated values in the same style as measured values teaches users to trust them equally. A filled cell should keep provenance: measured, generated, quantile, sample count, and uncertainty width.',
      ],
    },
    {
      heading: 'Worked operational case',
      paragraphs: [
        'Consider an ICU monitor that tracks heart rate, blood pressure, oxygen saturation, and temperature. Blood pressure drops out for several readings while the other channels continue. A point-fill pipeline might draw a smooth line and feed it to an alert model as if the cuff had measured it.',
        'A CSDI-style service stores the value matrix, true observation mask, target mask, timestamps, sample identifiers, quantiles, and model version. It reports a median pressure for display, but it also reports the interval and marks the value as generated. If the interval is wide, the alert layer can escalate or ask for a fresh measurement instead of silently trusting a line.',
        'The same pattern applies outside medicine. A factory sensor, market feed, or power-grid monitor can use imputed samples to keep analytics alive while still showing that the data was uncertain. The operational rule is simple: generated values may support a decision, but they must not erase the missingness that produced them.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: CSDI NeurIPS entry at https://papers.neurips.cc/paper_files/paper/2021/hash/cfe8504bda37b575c70ee1a8276f3486-Abstract.html, CSDI paper PDF at https://papers.neurips.cc/paper_files/paper/2021/file/cfe8504bda37b575c70ee1a8276f3486-Paper.pdf, and CSDI code at https://github.com/ermongroup/CSDI.',
        'Study next by role: Diffusion Models for the denoising process, Attention for cross-time and cross-feature conditioning, Data Leakage for mask mistakes, DLinear Time Series and Monarch Time Series for cheaper forecasting baselines, and Variational Autoencoders for another way to generate uncertain completions. Also compare against simple interpolation before choosing a diffusion model; the baseline wall should be demonstrated, not assumed.',
      ],
    },
  ],
};
