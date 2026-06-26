// Tabular data case study: why tree ensembles still beat many neural networks
// on medium-sized structured tables, and how to benchmark the claim fairly.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'tabular-deep-learning-vs-gbdt-case-study',
  title: 'Tabular Deep Learning vs GBDT Case Study',
  category: 'Papers',
  summary: 'Why gradient-boosted trees often beat deep nets on tabular data: inductive bias, irrelevant features, irregular functions, and tuning budgets.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['inductive bias', 'benchmark protocol'], defaultValue: 'inductive bias' },
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

function protocolGraph(title) {
  return graphState({
    nodes: [
      { id: 'data', label: 'datasets', x: 0.7, y: 3.6, note: 'many' },
      { id: 'split', label: 'splits', x: 2.3, y: 2.0, note: 'sealed' },
      { id: 'prep', label: 'preprocess', x: 2.3, y: 5.2, note: 'inside fold' },
      { id: 'gbdt', label: 'GBDT', x: 4.3, y: 2.0, note: 'tuned' },
      { id: 'nn', label: 'NN', x: 4.3, y: 5.2, note: 'tuned' },
      { id: 'scores', label: 'scores', x: 6.4, y: 3.6, note: 'slices' },
      { id: 'cost', label: 'cost', x: 8.0, y: 2.0, note: 'budget' },
      { id: 'claim', label: 'claim', x: 8.5, y: 5.2, note: 'limited' },
    ],
    edges: [
      { id: 'e-data-split', from: 'data', to: 'split' },
      { id: 'e-data-prep', from: 'data', to: 'prep' },
      { id: 'e-split-gbdt', from: 'split', to: 'gbdt' },
      { id: 'e-prep-nn', from: 'prep', to: 'nn' },
      { id: 'e-gbdt-scores', from: 'gbdt', to: 'scores' },
      { id: 'e-nn-scores', from: 'nn', to: 'scores' },
      { id: 'e-scores-cost', from: 'scores', to: 'cost' },
      { id: 'e-scores-claim', from: 'scores', to: 'claim' },
      { id: 'e-cost-claim', from: 'cost', to: 'claim' },
    ],
  }, { title });
}

function* inductiveBias() {
  yield {
    state: graphState({
      nodes: [
        { id: 'table', label: 'table', x: 0.9, y: 3.6, note: 'columns' },
        { id: 'noise', label: 'noise', x: 2.7, y: 1.8, note: 'irrelevant' },
        { id: 'steps', label: 'steps', x: 2.7, y: 3.6, note: 'thresholds' },
        { id: 'axes', label: 'axes', x: 2.7, y: 5.4, note: 'raw meaning' },
        { id: 'trees', label: 'trees', x: 5.0, y: 2.7, note: 'split/skip' },
        { id: 'nets', label: 'nets', x: 5.0, y: 4.5, note: 'smooth/mix' },
        { id: 'eval', label: 'benchmark', x: 7.5, y: 3.6, note: 'fair budget' },
      ],
      edges: [
        { id: 'e-table-noise', from: 'table', to: 'noise' },
        { id: 'e-table-steps', from: 'table', to: 'steps' },
        { id: 'e-table-axes', from: 'table', to: 'axes' },
        { id: 'e-noise-trees', from: 'noise', to: 'trees' },
        { id: 'e-steps-trees', from: 'steps', to: 'trees' },
        { id: 'e-axes-trees', from: 'axes', to: 'trees' },
        { id: 'e-noise-nets', from: 'noise', to: 'nets' },
        { id: 'e-steps-nets', from: 'steps', to: 'nets' },
        { id: 'e-axes-nets', from: 'axes', to: 'nets' },
        { id: 'e-trees-eval', from: 'trees', to: 'eval' },
        { id: 'e-nets-eval', from: 'nets', to: 'eval' },
      ],
    }, { title: 'Why trees fit tables' }),
    highlight: { active: ['table', 'noise', 'steps', 'axes', 'trees', 'e-noise-trees', 'e-steps-trees', 'e-axes-trees'], compare: ['nets'], found: ['eval'] },
    explanation: 'The paper lesson is inductive bias. Gradient-boosted trees are biased toward axis-aligned, piecewise rules over existing columns. That is often exactly what business, medical, finance, and product tables need.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'risk score feature', min: 0, max: 10 }, y: { label: 'target rate', min: 0, max: 1 } },
      series: [
        { id: 'step', label: 'true table rule', points: [
          { x: 0, y: 0.12 }, { x: 2.9, y: 0.12 }, { x: 3.0, y: 0.48 }, { x: 6.9, y: 0.48 }, { x: 7.0, y: 0.82 }, { x: 10, y: 0.82 },
        ] },
        { id: 'smooth', label: 'smooth NN fit', points: [
          { x: 0, y: 0.10 }, { x: 2, y: 0.20 }, { x: 4, y: 0.40 }, { x: 6, y: 0.58 }, { x: 8, y: 0.74 }, { x: 10, y: 0.86 },
        ] },
      ],
      markers: [
        { id: 'cut1', x: 3, y: 0.48, label: 'split' },
        { id: 'cut2', x: 7, y: 0.82, label: 'split' },
      ],
    }),
    highlight: { active: ['step', 'cut1', 'cut2'], compare: ['smooth'] },
    explanation: 'Many tabular relationships are thresholded and irregular: debt ratio over a limit, account age below a limit, lab value inside a dangerous range. A tree split represents that directly. A smooth neural fit may spend data learning the sharp corners.',
    invariant: 'A tree split is a cheap discontinuity.',
  };

  yield {
    state: labelMatrix(
      'The orientation problem',
      [
        { id: 'raw', label: 'raw cols' },
        { id: 'rotated', label: 'rotated' },
        { id: 'engineered', label: 'ratios' },
        { id: 'embeddings', label: 'embeds' },
      ],
      [
        { id: 'tree', label: 'tree' },
        { id: 'net', label: 'net' },
      ],
      [
        ['thresholds', 'scale'],
        ['awkward', 'linear mix'],
        ['signal', 'useful'],
        ['sparse', 'category help'],
      ],
    ),
    highlight: { found: ['raw:tree', 'engineered:tree'], compare: ['rotated:net'] },
    explanation: 'Images and text benefit from learned representations because raw pixels and tokens are low-level. Tables often already contain high-level features. Rotating or blending columns can destroy the simple thresholds that trees exploit.',
  };

  yield {
    state: labelMatrix(
      'When deep tabular models can compete',
      [
        { id: 'large', label: 'huge data' },
        { id: 'multimodal', label: 'raw media' },
        { id: 'entity', label: 'entities' },
        { id: 'pretrain', label: 'pretraining' },
      ],
      [
        { id: 'why', label: 'helps' },
        { id: 'caution', label: 'caution' },
      ],
      [
        ['learn reps', 'try GBDT'],
        ['shared reps', 'fusion cost'],
        ['share signal', 'leakage'],
        ['structure', 'contam'],
      ],
    ),
    highlight: { active: ['large:why', 'multimodal:why', 'entity:why'], compare: ['pretrain:caution'] },
    explanation: 'The right conclusion is not anti-neural. It is domain-specific. Neural nets become more attractive when the table is huge, mixed with raw modalities, full of high-cardinality entities, or helped by trustworthy pretraining.',
  };
}

function* benchmarkProtocol() {
  yield {
    state: protocolGraph('A fair tabular benchmark is a pipeline comparison'),
    highlight: { active: ['data', 'split', 'prep', 'gbdt', 'nn', 'scores', 'e-data-split', 'e-data-prep', 'e-split-gbdt', 'e-prep-nn'], found: ['claim'] },
    explanation: 'The benchmark is not model A versus model B in isolation. It is split policy, preprocessing, tuning budget, early stopping, metrics, and cost. The paper-backed lesson is to compare whole pipelines fairly.',
  };

  yield {
    state: labelMatrix(
      'Protocol traps',
      [
        { id: 'tuning', label: 'tuning budget' },
        { id: 'prep', label: 'preprocessing' },
        { id: 'metric', label: 'metric choice' },
        { id: 'leakage', label: 'leakage' },
      ],
      [
        { id: 'bad', label: 'bad' },
        { id: 'better', label: 'better' },
      ],
      [
        ['unequal', 'same budget'],
        ['full data', 'inside fold'],
        ['accuracy', 'task slices'],
        ['dupes', 'group split'],
      ],
    ),
    highlight: { found: ['tuning:better', 'prep:better', 'metric:better', 'leakage:better'] },
    explanation: 'Many tabular claims are fragile because preprocessing or tuning is unfair. Neural nets need normalization and architecture choices. GBDTs need depth, learning rate, rounds, and regularization. Compare budgets, not defaults.',
    invariant: 'Benchmark protocol is part of the result.',
  };

  yield {
    state: protocolGraph('Cost belongs in the conclusion'),
    highlight: { active: ['gbdt', 'nn', 'scores', 'cost', 'claim', 'e-gbdt-scores', 'e-nn-scores', 'e-scores-cost', 'e-cost-claim'], compare: ['prep'] },
    explanation: 'A one-point gain can lose if it costs ten times more tuning, serving memory, or latency. Tabular systems often run inside business workflows where explainability, retraining speed, and threshold control matter.',
  };

  yield {
    state: labelMatrix(
      'Practical model-choice checklist',
      [
        { id: 'baseline', label: 'baseline' },
        { id: 'features', label: 'features' },
        { id: 'size', label: 'data size' },
        { id: 'ops', label: 'operations' },
      ],
      [
        { id: 'ask', label: 'ask' },
        { id: 'move', label: 'move' },
      ],
      [
        ['fair GBDT?', 'tune first'],
        ['high-level?', 'preserve'],
        ['huge or mixed?', 'try NN'],
        ['ops budget?', 'measure E2E'],
      ],
    ),
    highlight: { active: ['baseline:move', 'features:move', 'size:move', 'ops:move'] },
    explanation: 'A strong tabular workflow starts with tuned Gradient Boosting or Random Forest, then tries neural methods when the data shape justifies them. The benchmark decides; hype does not.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'inductive bias') yield* inductiveBias();
  else if (view === 'benchmark protocol') yield* benchmarkProtocol();
  else throw new InputError('Pick a tabular benchmark view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the first view as a comparison of inductive bias, which means the kind of pattern a model can learn cheaply before seeing much data. Trees are highlighted where raw columns, thresholds, irrelevant features, and missing values match split-based rules.',
        'Read the second view as a benchmark pipeline, not as a leaderboard. A fair claim requires sealed splits, preprocessing inside the fold, comparable tuning budgets, slice metrics, and cost measurement before saying one model family wins.',
        {type:'callout', text:'On ordinary tables, the winning architecture is often the one whose bias matches column semantics and benchmark protocol, not the newest model family.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/8/87/Recursive_Splitting.png', alt:'Recursive splitting diagram showing feature-space partitions and the corresponding decision tree.', caption:'Recursive binary splitting and its matching decision tree. Image: Rossc0827, Wikimedia Commons, CC BY-SA 4.0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Structured tables are not images or text. Columns such as account age, debt ratio, lab value, region, and missed-payment count often already encode human or system concepts.',
        'This case study exists because neural networks are not automatically the right default for those columns. Gradient-boosted decision trees, or GBDTs, often remain strong because they cheaply express axis-aligned thresholds, sparse feature use, and irregular local rules.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to compare a neural network and a tree model on the same dataset and keep the higher score. That sounds fair because both models see the same rows and target.',
        'A second obvious approach is to treat the newest model family as the serious candidate and the GBDT as an old baseline. That can waste effort when the data is mostly medium-sized, structured, and already feature-rich.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is benchmark leakage and model mismatch. If preprocessing sees test data, entity duplicates cross splits, one model gets more tuning, or the metric hides important slices, the comparison is measuring protocol error.',
        'Model mismatch appears when a smooth dense learner spends capacity rediscovering thresholds that a tree represents with one split. A neural model may need more data to learn that utilization above 80 percent is a sharp cliff rather than a gradual curve.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'GBDTs fit many tables because their bias matches column semantics. They select useful features, ignore many useless ones, create threshold rules, and add small trees sequentially to repair residual errors.',
        'The benchmark invariant is that the pipeline is part of the result. The model, split policy, preprocessing, search budget, metric, calibration, latency, and operating cost are one object for evaluation.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A decision tree asks questions such as utilization <= 0.8 or account_age < 90 days. A random forest averages many trees, while gradient boosting adds trees one after another so later trees correct errors left by earlier trees.',
        'A neural tabular model learns dense transformations of columns. That can help when the table is huge, entity-rich, multimodal, or supported by clean pretraining, but it can also add tuning and representation burden on ordinary business tables.',
        'A fair protocol seals train, validation, and test splits before preprocessing. Imputation, normalization, target encoding, feature selection, and hyperparameter search must happen inside the training fold, and group or time splits must match the task.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Trees work when useful decisions are local and column-aligned. If one rule depends on debt_ratio > 0.45 and another depends on missed_payments >= 2 only for young accounts, a small ensemble can express that jagged surface directly.',
        'Boosting works because additive correction reduces residual error. Each new tree does not need to solve the whole problem; it only needs to improve the current model on rows where the current prediction is weak.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'GBDT cost is usually dominated by tree construction, feature scanning or histogram building, number of boosting rounds, and depth. If rows double, training roughly doubles for the same settings, while deeper trees and wider feature sets increase the split search.',
        'Neural cost is dominated by architecture search, normalization, batch training, hardware use, and serving shape. A one-point accuracy gain can be a loss if it requires ten times the tuning budget or misses a latency target.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'GBDTs are strong defaults for credit risk, fraud, churn, pricing, medical tabular prediction, product analytics, operations forecasting, and ranking features where columns have direct meaning. They are also attractive when teams need fast retraining, interpretable feature effects, and simple serving.',
        'Neural models are more attractive when rows contain raw text, images, audio, event sequences, graph neighborhoods, or high-cardinality entities with reusable embeddings. In that setting the model is learning representations, not only thresholds over ready-made columns.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'GBDTs fail when representation learning is the main problem. They do not naturally learn shared dense embeddings across products, parse raw documents, exploit long sequences, or transfer large pretrained structure without extra machinery.',
        'They also fail when the benchmark is sloppy. A tree model that wins because target encoding leaked test labels has not taught anything about model class quality.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a credit dataset has 200,000 rows and 80 columns. A real pattern is low risk below 60 percent utilization, medium risk from 60 to 85 percent, and high risk above 85 percent, with missed_payments >= 2 adding another jump for accounts younger than 180 days.',
        'A depth-3 tree can express the utilization cliffs and one interaction in a few splits. A neural network can learn the same shape, but it may spend many gradient steps fitting a smooth approximation unless the protocol, data volume, and tuning budget justify that flexibility.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources include Why do tree-based models still outperform deep learning on tabular data? at https://arxiv.org/abs/2207.08815, Revisiting Deep Learning Models for Tabular Data at https://arxiv.org/abs/2106.11959, XGBoost at https://arxiv.org/abs/1603.02754, and When Do Neural Nets Outperform Boosted Trees on Tabular Data? at https://arxiv.org/abs/2305.02997. Study gradient boosting, random forests, target encoding, cross-validation, leakage, calibration, hyperparameter search, and benchmark variance next.',
      ],
    },
  ],
};
