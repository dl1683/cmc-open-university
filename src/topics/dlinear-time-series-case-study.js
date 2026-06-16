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
    explanation: 'Long-term time-series forecasting starts with an ordered numeric sequence. The DLinear paper argues that for many benchmark tasks, preserving temporal order with a simple model can beat more complex Transformer variants.',
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
    explanation: 'DLinear first decomposes the series into a moving-average trend and a residual seasonal component. This gives the model an explicit bias for common forecasting structure.',
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
    explanation: 'Two one-layer linear heads forecast the two components, and the outputs are summed. There is no attention map, no token mixing stack, and very little hyperparameter ceremony.',
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
    explanation: 'The case study is not anti-deep-learning. It is pro-baseline: if the temporal signal is mostly trend and seasonal structure, a simple model can be the right inductive bias.',
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
    explanation: 'Time-series evaluation is easy to contaminate. A good paper must specify temporal splits, horizons, scaling, and strong simple baselines before architecture claims matter.',
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
    explanation: 'The paper reports that LTSF-Linear variants outperform several Transformer-based forecasting models on multiple long-horizon benchmarks. The visual lesson is the shape of the comparison, not this toy number set.',
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
    explanation: 'Self-attention is powerful for semantic relationships among tokens. Forecasting often asks for ordered temporal dynamics, where direct lag weights and decomposition can be a better prior.',
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
    explanation: 'The durable lesson is not architecture tribalism. It is benchmark discipline: any complex model must beat a tuned simple baseline under the same data and evaluation protocol.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'DLinear decomposition') yield* dlinearDecomposition();
  else if (view === 'baseline audit') yield* baselineAudit();
  else throw new InputError('Pick a DLinear case-study view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'The DLinear case study comes from "Are Transformers Effective for Time Series Forecasting?" The paper challenged a growing habit in long-term time-series forecasting: taking Transformer success in language and assuming attention-heavy architectures must also dominate ordered numeric forecasting. The authors introduced LTSF-Linear, a family of very simple one-layer linear baselines, including DLinear and NLinear.',
        'DLinear decomposes a series into a trend component and a residual seasonal component, applies a linear layer to each, and sums the forecasts. It is intentionally plain. That plainness is the point: if a complicated architecture cannot beat a simple model with the right inductive bias, the complexity is not earning its keep.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The DLinear pipeline begins with decomposition. A moving-average kernel estimates trend. The residual captures seasonal or short-term variation. Two linear heads forecast the future horizon from those components, and their outputs are added. The model has an O(1) maximum signal traversing path length in the authors discussion, few parameters, fast inference, and inspectable weights.',
        'This contrasts with self-attention. Attention is excellent at semantic pairwise relationships in text, images, and multimodal tokens, but time-series forecasting often depends on ordered lag relationships, trend, seasonality, scale shifts, and horizon-specific behavior. Position encodings can add order back to attention, but the baseline result asks whether that machinery is needed for the task.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'DLinear is cheap to train and cheap to serve. It has far fewer parameters than Transformer forecasting models and fewer hyperparameters to tune. That makes it valuable even when it does not win outright: a simple baseline sets a price that every complex model must justify. If a Transformer improves error by a tiny amount but costs much more compute and operational complexity, the practical winner may still be the linear model.',
        'The evaluation details matter. Time-series experiments must avoid future leakage, normalize using training data only, compare the same horizons, and include strong classical and simple neural baselines. Without those checks, forecasting papers can accidentally reward leakage, preprocessing choices, or uneven tuning rather than architecture quality.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The lesson applies to demand forecasting, energy load prediction, traffic forecasting, finance, inventory planning, supply-chain monitoring, and anomaly detection. Many production systems should start with ARIMA-style methods, exponential smoothing, gradient boosting, or simple linear neural baselines before reaching for deep sequence models. Complex models are useful when they capture cross-series structure, exogenous variables, regime changes, or nonlinear interactions that simple baselines miss.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not conclude that Transformers are useless for all time series. Later work has argued that equivalent-size Transformer comparisons and better protocols can change the result. Do conclude that architecture fashion is dangerous. A baseline that is cheap, interpretable, and strong should be treated as a serious competitor, not an afterthought. Also, a univariate DLinear model may be weak when the task requires rich cross-variate dependencies or external covariates.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Are Transformers Effective for Time Series Forecasting? at https://arxiv.org/abs/2205.13504, the AAAI page at https://ojs.aaai.org/index.php/AAAI/article/view/26317, and the official implementation at https://github.com/cure-lab/LTSF-Linear. For an important counterpoint, read the Hugging Face Autoformer discussion at https://huggingface.co/blog/autoformer. Study Attention Mechanism, Transformer Block, Cross-Validation, Data Leakage & Contamination, Learning Curves, and Regression Discontinuity next.',
      ],
    },
  ],
};
