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
      heading: 'What it is',
      paragraphs: [
        'This case study explains why tree ensembles, especially Gradient Boosting and Random Forest, often remain stronger than neural networks on ordinary tabular data. The NeurIPS paper Why do tree-based models still outperform deep learning on tabular data? benchmarks tree methods and neural methods across many datasets and argues that the gap is partly about inductive bias: https://arxiv.org/abs/2207.08815.',
        'The claim is not that neural networks are bad. The claim is that tables are different from images and text. A spreadsheet column such as age, debt ratio, product count, lab value, region, or account age is already a high-level feature. Tree splits can ask direct threshold questions over those features. Deep nets often need more data, normalization, architecture choices, and tuning to learn the same irregular rules.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Tree ensembles are naturally robust to irrelevant features because a useless feature simply fails to win splits. They preserve feature orientation because axis-aligned thresholds are meaningful on raw columns. They learn irregular functions easily because each split creates a discontinuity. The 2022 paper highlights three challenges for tabular neural networks: robustness to uninformative features, preserving orientation, and learning irregular functions.',
        'Gradient-boosted decision trees also have an engineering advantage. XGBoost introduced a scalable tree-boosting system with sparsity-aware split finding, weighted quantile sketching, cache-aware access, compression, and sharding: https://arxiv.org/abs/1603.02754. That means the model class is not only statistically well matched to tables; the implementations are mature and cheap to tune.',
      ],
    },
    {
      heading: 'Benchmark discipline',
      paragraphs: [
        'A fair comparison must include tuning budget and preprocessing. Revisiting Deep Learning Models for Tabular Data found that prior tabular deep-learning work often used inconsistent benchmarks and protocols, and that strong simple baselines matter: https://arxiv.org/abs/2106.11959. Benchmark Variance & Model Selection is the right lens: if one method receives more hyperparameter search, better preprocessing, or more retries, the score is a pipeline artifact.',
        'Data Leakage & Contamination matters because tabular datasets often include duplicate entities, future-derived features, post-outcome fields, target encodings, and grouped records. A boosted tree will greedily exploit leakage because it looks like a perfect split. Neural nets can exploit it too. Cross-Validation & Honest Evaluation only helps if splits are grouped, time-aware, and sealed before preprocessing. Leakage-Safe Target Encoding Case Study goes deeper on the high-cardinality categorical case because that is where useful signal and answer-key leakage are most easily confused.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The practical cost question is end to end: training time, hyperparameter search, preprocessing, missing-value handling, calibration, explainability, latency, and retraining cadence. GBDTs often win medium-sized data with modest tuning. Neural models can become attractive for very large tables, multimodal systems, high-cardinality entity embeddings, learned representations, or pretraining. Even then, compare against tuned boosted trees before shipping a more complex stack.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Fraud detection, credit risk, churn, pricing, ad ranking features, insurance underwriting, medical tabular prediction, sales forecasting features, and operations dashboards often start with gradient-boosted trees. Neural methods are more compelling when the task includes raw text, images, audio, event sequences, or learned entity embeddings alongside the table. The model-choice question is therefore about data modality and evaluation protocol, not ideology.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not say trees always beat deep learning. They often beat deep learning on medium-sized, mostly structured tables under fair protocols. Do not compare defaults. Do not ignore tuning cost. Do not let preprocessing leak across folds. Do not average away rare but expensive slices. And do not call a neural tabular model better until it beats strong GBDT baselines under the same budget and deployment constraints.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Why do tree-based models still outperform deep learning on tabular data? at https://arxiv.org/abs/2207.08815, Revisiting Deep Learning Models for Tabular Data at https://arxiv.org/abs/2106.11959, XGBoost: A Scalable Tree Boosting System at https://arxiv.org/abs/1603.02754, and When Do Neural Nets Outperform Boosted Trees on Tabular Data? at https://arxiv.org/abs/2305.02997. Study Tabular Feature-Basis Orientation Primer, Leakage-Safe Target Encoding Case Study, Gradient Boosting, Random Forest, Neural Network Forward Pass, Normalization, Hyperparameter Search, Benchmark Variance & Model Selection, Data Leakage & Contamination, and Cross-Validation & Honest Evaluation next.',
      ],
    },
  ],
};
