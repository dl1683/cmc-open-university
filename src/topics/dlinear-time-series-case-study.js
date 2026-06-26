// LTSF-Linear and DLinear: simple linear baselines for long-term time-series
// forecasting that challenged transformer-heavy forecasting papers.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'dlinear-time-series-case-study',
  title: 'DLinear Time-Series Case Study',
  category: 'Papers',
  summary: 'A forecasting lesson: decompose trend and seasonality, apply simple linear heads, and benchmark fancy sequence models against strong simple baselines.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['DLinear decomposition', 'baseline audit'], defaultValue: 'DLinear decomposition' },
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

function* dlinearDecomposition() {
  yield {
    state: plotState({
      axes: { x: { label: 'time', min: 0, max: 11 }, y: { label: 'value', min: 0, max: 12 } },
      series: [
        { id: 'raw', label: 'raw series', points: [
          { x: 0, y: 3.0 }, { x: 1, y: 4.4 }, { x: 2, y: 4.2 }, { x: 3, y: 5.8 },
          { x: 4, y: 5.4 }, { x: 5, y: 7.1 }, { x: 6, y: 6.7 }, { x: 7, y: 8.5 },
          { x: 8, y: 8.1 }, { x: 9, y: 9.9 }, { x: 10, y: 9.4 }, { x: 11, y: 11.0 },
        ] },
      ],
      markers: [
        { id: 'now', x: 7, y: 8.5, label: 'lookback' },
      ],
    }),
    highlight: { active: ['raw'], found: ['now'] },
    explanation: 'Start with the raw ordered sequence. The point of the case study is that forecasting is not language modeling with different tokens: order, lag structure, trend, and seasonality often matter more than content-addressed lookup. DLinear asks whether a plain model with that bias can beat attention-heavy models on long-horizon benchmarks.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'time', min: 0, max: 11 }, y: { label: 'value', min: -2, max: 12 } },
      series: [
        { id: 'trend', label: 'moving-average trend', points: [
          { x: 0, y: 3.4 }, { x: 1, y: 3.9 }, { x: 2, y: 4.6 }, { x: 3, y: 5.1 },
          { x: 4, y: 6.1 }, { x: 5, y: 6.4 }, { x: 6, y: 7.4 }, { x: 7, y: 7.8 },
          { x: 8, y: 8.8 }, { x: 9, y: 9.1 }, { x: 10, y: 10.1 }, { x: 11, y: 10.4 },
        ] },
        { id: 'season', label: 'seasonal residual', points: [
          { x: 0, y: -0.4 }, { x: 1, y: 0.5 }, { x: 2, y: -0.4 }, { x: 3, y: 0.7 },
          { x: 4, y: -0.7 }, { x: 5, y: 0.7 }, { x: 6, y: -0.7 }, { x: 7, y: 0.7 },
          { x: 8, y: -0.7 }, { x: 9, y: 0.8 }, { x: 10, y: -0.7 }, { x: 11, y: 0.6 },
        ] },
      ],
    }),
    highlight: { active: ['trend', 'season'] },
    explanation: 'The highlighted lines are the inductive bias. A moving average pulls out the slow trend; subtracting it leaves the residual seasonal wiggle. DLinear does not ask a Transformer to discover this decomposition from scratch. It builds the decomposition into the model, then learns simple forecasts for the two pieces.',
    invariant: 'Raw series = trend plus residual component.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'raw', label: 'raw x', x: 0.8, y: 3.8, note: 'lookback' },
        { id: 'decomp', label: 'decompose', x: 2.8, y: 3.8, note: 'moving avg' },
        { id: 'trend', label: 'trend', x: 5.0, y: 2.4, note: 'linear head' },
        { id: 'season', label: 'season', x: 5.0, y: 5.2, note: 'linear head' },
        { id: 'sum', label: 'sum', x: 7.4, y: 3.8, note: 'forecast' },
        { id: 'yhat', label: 'y hat', x: 9.0, y: 3.8, note: 'horizon' },
      ],
      edges: [
        { id: 'e-raw-decomp', from: 'raw', to: 'decomp', weight: '' },
        { id: 'e-decomp-trend', from: 'decomp', to: 'trend', weight: '' },
        { id: 'e-decomp-season', from: 'decomp', to: 'season', weight: '' },
        { id: 'e-trend-sum', from: 'trend', to: 'sum', weight: '' },
        { id: 'e-season-sum', from: 'season', to: 'sum', weight: '' },
        { id: 'e-sum-yhat', from: 'sum', to: 'yhat', weight: '' },
      ],
    }, { title: 'DLinear is deliberately simple' }),
    highlight: { active: ['decomp', 'trend', 'season'], found: ['yhat'] },
    explanation: 'Read the pipeline as a deliberately short signal path: raw window, decomposition, one linear head for trend, one linear head for residual, sum. There is no attention map, no token-mixing stack, and little hyperparameter ceremony. That simplicity is not a weakness until a harder task proves it lacks the needed interactions.',
  };

  yield {
    state: labelMatrix(
      'Why simplicity can win here',
      [
        { id: 'path', label: 'path' },
        { id: 'order', label: 'order' },
        { id: 'speed', label: 'speed' },
        { id: 'inspect', label: 'inspect' },
      ],
      [
        { id: 'benefit', label: 'benefit' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['short signal path', 'less expressive'],
        ['keeps temporal order', 'weak cross-variate modeling'],
        ['few params', 'less capacity'],
        ['weights visible', 'limited interactions'],
      ],
    ),
    highlight: { found: ['path:benefit', 'order:benefit', 'speed:benefit'], compare: ['inspect:tradeoff'] },
    explanation: 'This scorecard is the responsible conclusion. Simplicity can win when the task rewards short paths, order preservation, speed, and inspectable lag weights. It can fail when cross-variate structure, external covariates, regime changes, or nonlinear interactions dominate. The lesson is pro-baseline, not anti-Transformer.',
  };
}

function* baselineAudit() {
  yield {
    state: labelMatrix(
      'Forecasting benchmark checklist',
      [
        { id: 'split', label: 'split' },
        { id: 'horizon', label: 'horizon' },
        { id: 'scale', label: 'scale' },
        { id: 'baseline', label: 'baseline' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['time-ordered?', 'future leakage'],
        ['same horizon?', 'unfair task'],
        ['fit train only?', 'test info leak'],
        ['strong simple model?', 'fake complexity win'],
      ],
    ),
    highlight: { found: ['split:question', 'horizon:question', 'scale:question', 'baseline:question'] },
    explanation: 'This checklist is the part of forecasting papers to read first. If the split is not time-ordered, the future leaks backward. If scaling was fit on all data, the test set helped train the model. If horizons differ or simple baselines are weak, an architecture win may be an evaluation artifact.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'forecast horizon', min: 96, max: 720 }, y: { label: 'error, lower is better', min: 0.2, max: 0.9 } },
      series: [
        { id: 'transformer', label: 'Transformer-style', points: [
          { x: 96, y: 0.36 }, { x: 192, y: 0.48 }, { x: 336, y: 0.63 }, { x: 720, y: 0.84 },
        ] },
        { id: 'dlinear', label: 'DLinear', points: [
          { x: 96, y: 0.31 }, { x: 192, y: 0.39 }, { x: 336, y: 0.47 }, { x: 720, y: 0.62 },
        ] },
      ],
      markers: [
        { id: 'long', x: 720, y: 0.62, label: 'long horizon' },
      ],
    }),
    highlight: { active: ['dlinear'], compare: ['transformer'], found: ['long'] },
    explanation: 'The toy curve shows the reported pattern: as horizon grows, the simple linear baseline degrades more slowly than the Transformer-style line. Do not memorize the numbers; inspect the shape and then ask whether the real benchmark used equal horizons, equal tuning, and leakage-free preprocessing.',
  };

  yield {
    state: labelMatrix(
      'Why attention can be a mismatch',
      [
        { id: 'text', label: 'text' },
        { id: 'time', label: 'series' },
        { id: 'attn', label: 'attention' },
        { id: 'linear', label: 'linear' },
      ],
      [
        { id: 'structure', label: 'structure' },
        { id: 'model bias', label: 'model bias' },
      ],
      [
        ['semantic tokens', 'pair relations'],
        ['ordered values', 'temporal dynamics'],
        ['permutation-ish', 'needs position fixes'],
        ['ordered window', 'direct lag weights'],
      ],
    ),
    highlight: { active: ['time:structure', 'linear:model bias'], compare: ['text:structure', 'attn:model bias'] },
    explanation: 'This table explains the mismatch. Attention is excellent when pairwise semantic relationships matter; forecasting often wants ordered lag weights, trend, seasonality, and horizon-specific dynamics. Position encodings can help attention recover order, but DLinear asks whether a direct ordered window is the cleaner prior.',
  };

  yield {
    state: labelMatrix(
      'The responsible conclusion',
      [
        { id: 'claim', label: 'claim' },
        { id: 'rebuttal', label: 'rebuttal' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        { id: 'too strong', label: 'too strong' },
        { id: 'better', label: 'better' },
      ],
      [
        ['Transformers never work', 'not proven'],
        ['Transformers always win', 'not safe'],
        ['use strong baselines', 'required'],
      ],
    ),
    highlight: { found: ['lesson:better'], compare: ['claim:too strong', 'rebuttal:too strong'] },
    explanation: 'The last table rules out both lazy conclusions. It does not prove Transformers never work for time series, and it does not let Transformer fashion skip baselines. The durable lesson is benchmark discipline: every complex model must beat a tuned simple baseline under the same data, horizon, and evaluation protocol.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'DLinear decomposition') yield* dlinearDecomposition();
  else if (view === 'baseline audit') yield* baselineAudit();
  else throw new InputError('Pick a DLinear case-study view.');
}

