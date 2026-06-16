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
    { heading: 'What it is', paragraphs: ['CSDI is a conditional score-based diffusion method for probabilistic imputation. It fills missing values by sampling plausible target time-series values while conditioning on the observed values.', 'This is a useful bridge from Diffusion Models to time-series data structures. The central object is not an image; it is a value matrix X, an observation mask M, timestamps, and a target mask for training or imputation.'] },
    { heading: 'Data structures', paragraphs: ['A CSDI-style pipeline stores multivariate values, observation masks, target masks, timestamps, noise levels, conditional features, sample IDs, quantiles, and evaluation metrics such as CRPS or MAE.', 'The distinction between masks is crucial. The observed mask records what the sensor or dataset actually knows. The target mask records which entries the training procedure asks the model to reconstruct.'] },
    { heading: 'How it works', paragraphs: ['Training can use self-supervision: hide some observed values, keep the rest as conditional information, add noise to the targets, and train the denoiser to recover the hidden values through a reverse diffusion process.', 'Sampling starts with noise in the missing target positions and repeatedly denoises while attending to observed values across time and feature dimensions. Multiple samples produce an uncertainty distribution.'] },
    { heading: 'Complete case study', paragraphs: ['A hospital monitoring system receives heart rate, blood pressure, oxygen, and temperature streams with intermittent device dropout. The imputation service records true missingness, samples plausible values, reports quantiles, and leaves uncertainty visible to the alerting layer.', 'The key product rule is that imputed values may help downstream models, but missingness itself remains evidence. A value filled by diffusion should not erase the fact that a sensor failed.'] },
    { heading: 'Pitfalls', paragraphs: ['Do not treat imputation as ordinary cleanup. If missingness is caused by a device failure, user behavior, market closure, or clinical event, the mask can carry signal. Hiding the mask can create misleadingly confident predictions.', 'Another pitfall is evaluating only deterministic point error. Probabilistic imputation should be judged by calibration, interval coverage, task utility, and how often downstream decisions change under different samples.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: CSDI NeurIPS entry at https://papers.neurips.cc/paper_files/paper/2021/hash/cfe8504bda37b575c70ee1a8276f3486-Abstract.html, CSDI paper PDF at https://papers.neurips.cc/paper_files/paper/2021/file/cfe8504bda37b575c70ee1a8276f3486-Paper.pdf, and CSDI code at https://github.com/ermongroup/CSDI. Study Diffusion Models, Attention, DLinear Time Series, Monarch Time Series, and Variational Autoencoders next.'] },
  ],
};
