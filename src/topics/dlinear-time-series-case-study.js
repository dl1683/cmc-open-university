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

export const article = {
  sections: [
    {
      heading: 'Why DLinear exists',
      paragraphs: [
        'DLinear is a forecasting baseline from the paper Are Transformers Effective for Time Series Forecasting? The case study matters because it attacked a common shortcut in machine learning research: if transformers work well for language, then attention-heavy models should also dominate long-term numeric forecasting. The paper introduced LTSF-Linear, a family of one-layer linear baselines, and showed that those simple models were hard to beat on several long-horizon benchmarks.',
        'DLinear is the decomposition member of that family. It splits a time series into a trend component and a residual seasonal component, applies a linear forecasting head to each, and adds the two forecasts. The model is deliberately small. That is the lesson. Complexity is useful only when it captures structure the simple model misses. If the task mostly rewards ordered lag weights, trend, and repeated seasonal shape, a direct linear bias can be stronger than an expensive attention stack.',
      ],
    },
    {
      heading: 'The obvious approach and wall',
      paragraphs: [
        'The obvious modern approach is to convert the lookback window into tokens and use a transformer-like sequence model. That is not a foolish idea. Transformers can model long-range interactions, mix information across positions, and scale with data and compute. For multivariate forecasting, attention seems attractive because one channel can depend on another channel far back in time.',
        'The wall is that time series are not text with smaller vocabularies. Numeric forecasting often cares about order, lag, trend, seasonality, scale, calendar effects, and horizon-specific dynamics. Self-attention is weakly tied to order unless positional information and architecture choices recover it. It can spend capacity learning relationships that a moving average and direct lag weights already express. The result can be a large model that looks advanced but loses to a baseline that matches the data geometry.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is that a strong baseline should encode the easiest true structure before a complex model is allowed to claim victory. DLinear assumes that much of the forecast can be separated into slow movement and residual variation. A moving average extracts the slow component. Subtracting it leaves the residual. Two simple linear maps then learn how the lookback window should project into the future horizon.',
        'That choice gives the model a short signal path. A value from the lookback window can influence a future value through one linear weight after decomposition. There is no deep stack, no attention map, and little opportunity for training instability to hide inside the architecture. The weights are not a full explanation of the forecast, but they make the lag structure more visible than a large transformer block.',
      ],
    },
    {
      heading: 'Mechanism and data structures',
      paragraphs: [
        'The data structures are the lookback matrix, the decomposition filter, two learned weight matrices, and the forecast horizon vector. For a univariate series, the lookback window is an ordered array of length L. The trend branch applies a moving-average kernel to that array. The residual branch stores raw minus trend. Each branch maps L past positions to H future positions with a linear layer. The outputs are summed element by element.',
        'In multivariate settings, implementations can use separate per-channel heads or shared weights depending on the variant. That design choice matters because cross-variate structure is exactly where a plain linear model may be too weak. A direct linear head is excellent when each channel mostly follows its own lag pattern. It is less expressive when the future of one variable depends on nonlinear interactions among many variables, external covariates, or regime switches.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'DLinear works when the forecasting problem is close to a weighted combination of past lags after trend removal. Many operational signals have exactly that shape for long stretches. Electricity load, traffic, inventory demand, and sensor readings often contain slow drift plus repeated patterns. A decomposition layer gives the model a good prior before learning begins, so the linear heads do not need to discover the split from scratch.',
        'The correctness claim is statistical rather than exact. DLinear does not guarantee the true future. It makes a modeling bet: if the future horizon can be approximated by stable linear relationships over recent history and residual seasonal movement, then a shallow model will estimate those relationships with fewer parameters and less variance. That can beat a deeper model when training data is limited, benchmarks are noisy, or the deeper model spends capacity on spurious relationships.',
      ],
    },
    {
      heading: 'Cost behavior',
      paragraphs: [
        'The cost advantage is straightforward. A linear head over a fixed lookback window has far fewer moving parts than a transformer. Training is faster, inference is faster, and the hyperparameter surface is smaller. When the lookback length doubles, the linear maps grow with the input length and horizon, but there is no all-pairs attention table. The practical cost is dominated by matrix multiplication and the decomposition filter, not by repeated deep token mixing.',
        'This cheapness changes evaluation. A complex model should not be compared only on lowest error. It should be compared on error, training time, inference time, parameter count, tuning effort, robustness across seeds, and maintainability. A transformer that wins by a tiny margin after heavy tuning may be the wrong production choice if DLinear is simpler, cheaper, and easier to monitor.',
      ],
    },
    {
      heading: 'Benchmark discipline',
      paragraphs: [
        'The deeper lesson is about benchmarks. Forecasting experiments are easy to contaminate. Splits must respect time. Scaling and normalization must be fit on training data only. The forecast horizon must be identical across models. Hyperparameter tuning should be comparable. A strong simple baseline should be present before a paper attributes improvement to architecture.',
        'The DLinear paper became influential because it made the missing-baseline problem visible. It did not prove that transformers can never work for time series. It proved that some reported transformer wins were not convincing unless they beat a simple model under a clean protocol. That distinction matters. The responsible conclusion is pro-baseline, not anti-transformer.',
      ],
    },
    {
      heading: 'Where it is useful',
      paragraphs: [
        'DLinear is useful as a first serious neural baseline for long-term forecasting. It belongs in demand forecasting, energy load prediction, traffic forecasting, inventory planning, capacity planning, industrial monitoring, and anomaly pipelines where the first question is whether recent ordered history explains the future. It is also valuable as a guardrail in research. If a new architecture cannot beat DLinear, the architecture probably has not earned its complexity on that dataset.',
        'It is also useful operationally because failure is easier to inspect. When error rises, an engineer can look at drift in trend, residual variance, lag weights, horizon-specific error, and per-channel behavior. A large attention model may still be better, but DLinear gives the team a transparent price floor for accuracy and cost.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'DLinear fails when the future depends on interactions that a direct lag map cannot express. External covariates, holidays, promotions, weather, supply shocks, sensor faults, control actions, and regime changes can all break the trend-plus-residual assumption. Multivariate systems can also require causal or nonlinear cross-channel structure. A plain channel-wise linear model may miss that one signal leads another after a variable delay.',
        'It can also fail under nonstationarity. A lag weight learned from old data may become harmful after a policy change, market shift, hardware replacement, or new user behavior. Long lookback windows can include stale patterns. Short windows can miss slow cycles. The model is simple, but the data pipeline still needs drift detection, rolling validation, and slice-level error monitoring.',
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        'Monitor mean absolute error, mean squared error, horizon-wise error, per-series error, scale-normalized error, residual autocorrelation, drift in input distribution, and error by known calendar or business slice. Watch whether the trend branch or residual branch dominates. If the residual branch carries most of the forecast, the decomposition may not be separating useful structure. If long horizons degrade sharply, the lookback window may not contain enough information.',
        'A fair evaluation should include naive seasonal repeat, moving average, exponential smoothing, ARIMA-style baselines, gradient boosting when covariates exist, NLinear, DLinear, and at least one tuned deep sequence model. The point is not to crown the simplest model by default. The point is to make every added mechanism pay rent.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources are the arXiv paper at https://arxiv.org/abs/2205.13504, the AAAI page at https://ojs.aaai.org/index.php/AAAI/article/view/26317, and the official implementation at https://github.com/cure-lab/LTSF-Linear. Read them with the benchmark checklist open: split, horizon, scaling, tuning, baselines, and cost.',
        'Study moving averages, exponential smoothing, ARIMA, cross-validation for temporal data, data leakage, learning curves, attention, transformer blocks, Autoformer-style decomposition, and feature-store point-in-time joins next. The durable skill is not memorizing DLinear. It is learning to ask what structure the data already gives you before reaching for a larger architecture.',
      ],
    },
  ],
};
