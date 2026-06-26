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


export const article = { sections: [
  { heading: 'How to read the animation', paragraphs: [
    'The conditional-mask view shows a matrix of values and masks. Active cells are target values to denoise, found cells are observed evidence, and compare cells are truly missing or held-out values that must not leak into conditioning.',
    'The sample-ensemble view shows why the output is a distribution. The p10, p50, and p90 lines are not decoration; they show uncertainty over plausible completions for the same missing interval.',
  ] },
  { heading: 'Why this exists', paragraphs: [
    'Time-series systems often want a complete table, but real sensors miss values. ICU monitors drop readings, machines go offline, markets halt, and mobile devices sample irregularly.',
    'Filling blanks with one number hides two facts: the value was not measured, and more than one completion may be plausible. CSDI treats imputation as conditional generation so the output can include uncertainty.',
    {type:'callout', text:'CSDI works only when the value matrix, observation mask, target mask, and sample distribution remain separate artifacts instead of being collapsed into a filled table.'},
  ] },
  { heading: 'The obvious approach', paragraphs: [
    'The obvious tools are deletion, mean fill, forward fill, interpolation, and deterministic forecasting. They are fast, easy to audit, and often good enough for short gaps in smooth signals.',
    'A stronger baseline is a recurrent or transformer model that predicts one value for each missing cell. That can lower average error, but it still returns a point estimate unless uncertainty is modeled explicitly.',
  ] },
  { heading: 'The wall', paragraphs: [
    'The wall is long, multivariate, uncertain gaps. Forward fill can freeze a vital sign through a real change, interpolation can invent smoothness through a shock, and deletion can remove rare events.',
    'Missingness can also carry signal. A sensor that fails during high vibration or a cuff that stops during clinical movement is not the same as a random blank cell.',
  ] },
  { heading: 'The core insight', paragraphs: [
    'Keep four artifacts separate: the value matrix X, the observation mask M_obs, the target mask M_target, and the generated sample set. The observation mask says what was measured; the target mask says what the model must reconstruct.',
    'Conditional diffusion then denoises only target positions while using observed positions as clean evidence. The invariant is that measured values stay fixed and target clean values never leak into the conditioning path.',
  ] },
  { heading: 'How it works', paragraphs: [
    'During training, the pipeline hides some observed cells as self-supervised targets. It adds noise to those target values, gives the remaining observed values to the network, and trains the denoiser to recover plausible targets under the masks, timestamps, and feature ids.',
    'During inference, truly missing positions become targets and start as noise. Reverse diffusion repeatedly denoises them while attending over time and feature dimensions, producing one complete sample; repeated runs produce an ensemble.',
  ] },
  { heading: 'Why it works', paragraphs: [
    'The statistical argument is conditional score learning. By seeing many masked examples, the model learns which target values are likely given nearby time points, other variables, feature identity, and the pattern of observations.',
    'The correctness argument is a data-contract argument. If masks are correct, the model solves the same problem in training and deployment: reconstruct target cells from observed cells without rewriting measured facts.',
  ] },
  { heading: 'Cost and complexity', paragraphs: [
    'The cost grows with variables, time length, diffusion steps, and number of samples. A 4-variable, 100-step window with 50 reverse steps and 20 samples asks for 1000 denoising passes per patient window before batching efficiencies.',
    'Memory also grows because each batch carries values, observation masks, target masks, time embeddings, feature embeddings, noisy targets, and generated samples. The payoff is calibrated uncertainty, not just a lower mean absolute error.',
  ] },
  { heading: 'Real-world uses', paragraphs: [
    'CSDI fits clinical vitals, industrial telemetry, environmental sensors, finance, grid monitoring, and forecasting pipelines where variables explain each other. The common pattern is multivariate context plus downstream decisions that care about uncertainty.',
    'It is useful when consumers can use quantiles or samples. A risk system might use p90, a dashboard might show a band, and a simulator might run decisions over many plausible completions.',
  ] },
  { heading: 'Where it fails', paragraphs: [
    'It fails when a simple method is enough. For a one-minute temperature gap in a smooth signal, interpolation is cheaper, easier to explain, and less likely to hallucinate structure.',
    'It also fails when training masks differ from production missingness. Randomly hidden cells do not teach the model enough about long outages, device-specific failures, or missing-not-at-random patterns unless those cases are represented or evaluated separately.',
  ] },
  { heading: 'Worked example', paragraphs: [
    'An ICU window has heart rate observed at 80, 83, 86, 92, 89, and 87, but blood pressure is missing at t4 and t5. CSDI draws 20 samples and reports p10=81/84, p50=88/91, and p90=97/101 for the two missing times.',
    'The median says the likely line rises, but the 20-point spread at t5 says uncertainty is high. An alert rule that triggers above 100 should not silently treat 91 as measured; it should mark the value generated and perhaps request a fresh cuff reading.',
  ] },
  { heading: 'Sources and study next', paragraphs: [
    'Primary sources: CSDI NeurIPS 2021 paper and code, score-based diffusion papers, denoising diffusion probabilistic models, and probabilistic forecasting evaluation references. Study observation masks, target masks, calibration, CRPS, and interval coverage next.',
    'Then compare interpolation, Kalman filters, Gaussian processes, VAEs, GRU-D, DLinear, attention models, and diffusion forecasting. The decision rule is whether uncertainty improves downstream behavior enough to pay the sampling cost.',
  ] },
] };
