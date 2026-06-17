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
      heading: 'Why it exists',
      paragraphs: [
        'This case study exists because "deep learning wins everything" is a bad default for structured tables. Fraud, credit risk, churn, pricing, medical prediction, operations, and product analytics often start from columns that already mean something: age, balance, lab value, region, account age, event count, debt ratio, or support history.',
        'The NeurIPS paper Why do tree-based models still outperform deep learning on tabular data? argues that tree ensembles often remain strong because their inductive bias fits ordinary tables: https://arxiv.org/abs/2207.08815. The lesson is not anti-neural. The lesson is to match the model class and benchmark protocol to the data shape.',
      ],
    },
    {
      heading: 'Naive baseline and wall',
      paragraphs: [
        'The naive baseline is to compare a default neural network against a default boosted tree, or to assume the newer architecture deserves the production slot. That misses the real problem: a model result is a full pipeline result, including preprocessing, split policy, tuning budget, metric choice, early stopping, and leakage control.',
        'The wall is that ordinary tables often contain high-level, axis-oriented, irregular features. A deep net may need many examples to learn that a risk score crosses a sharp threshold at 3 and another at 7. A tree can represent those discontinuities directly with two splits.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Gradient-boosted trees are biased toward feature selection, axis-aligned thresholds, and piecewise constant rules. That is often exactly the structure of business, finance, medical, and operations tables. Useless columns can be skipped. Useful thresholds can be isolated. Missingness and sparse categories can be handled by mature implementations.',
        'The benchmark invariant is that protocol is part of the result. If preprocessing leaks across folds, entity duplicates cross train and test, one model receives more tuning budget, or the metric ignores important slices, the comparison is not measuring model quality.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the inductive-bias view, the table sends three kinds of structure toward both model families: irrelevant features, thresholded steps, and meaningful raw axes. Trees are highlighted where split-and-skip behavior fits that structure. Neural nets are compared where smooth mixing can help or hurt.',
        'In the benchmark-protocol view, the graph models a pipeline contract. Datasets, sealed splits, preprocessing inside the fold, tuned GBDT, tuned neural model, score slices, and cost all feed the final claim. The claim node should stay limited unless the protocol was fair.',
      ],
    },
    {
      heading: 'Mechanism: model classes and protocol',
      paragraphs: [
        'A decision tree partitions rows by asking threshold questions over columns. A random forest averages many trees to reduce variance. Gradient boosting adds trees sequentially so each new tree fits remaining errors. The result is an ensemble that can express irregular, local, feature-specific behavior without learning a dense representation first.',
        'Neural tabular models can compete when representation learning is actually needed: very large tables, multimodal data, high-cardinality entities, event sequences, raw text or images attached to rows, or trustworthy pretraining. Even then, the fair baseline is a tuned GBDT, not a weak default.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'GBDTs work well on many tables because the columns are already compressed human or system measurements. A lab value, credit utilization ratio, account age, country code, or number of missed payments is not like a raw pixel. It often already names a concept. A tree can spend capacity deciding where that concept changes the target instead of first learning the concept from low-level input.',
        'Boosting then turns many small, imperfect rules into a strong predictor. One tree can handle a coarse threshold, the next can repair an error in a narrower slice, and later trees can add interactions that only matter for a subset of rows. This additive correction process fits the jagged shape of many operational datasets without forcing the target function to be globally smooth.',
        'Neural models work for a different reason. They can learn shared representations, dense embeddings, and cross-feature transformations when there is enough data and the signal benefits from those transformations. That is powerful for raw modalities and huge entity-rich histories. On medium structured tables, though, that flexibility can become extra search space the benchmark has to pay for.',
      ],
    },
    {
      heading: 'Correctness and evaluation',
      paragraphs: [
        'A correct benchmark seals train, validation, and test splits before preprocessing. Normalization, imputation, target encoding, feature selection, and hyperparameter search must happen inside the training fold. Time-dependent tasks need time splits. Entity-heavy tasks need group splits. Duplicate or near-duplicate rows must not leak across train and test.',
        'Revisiting Deep Learning Models for Tabular Data found that strong simple baselines and consistent protocols matter: https://arxiv.org/abs/2106.11959. Benchmark Variance & Model Selection is the right lens: report tuning budget, score dispersion, task slices, latency, calibration, and operational cost instead of only the best leaderboard number.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The practical cost question is end to end: training time, tuning budget, preprocessing, missing-value handling, feature drift, calibration, explainability, serving latency, memory, retraining cadence, and monitoring. GBDTs often deliver strong medium-data performance with a smaller operational surface.',
        'Neural models can justify their complexity when they share embeddings across products, fuse tables with raw modalities, learn from huge histories, or transfer from pretraining. The tradeoff is that they usually demand more tuning, normalization, representation design, hardware attention, and failure analysis.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Imagine a credit-risk table with income band, utilization ratio, account age, missed-payment count, product count, region, and recent balance changes. The true rule may contain cliffs: utilization above 80 percent matters, very young accounts behave differently, and missed payments interact with account age. A boosted tree can discover those thresholds and interactions with a few splits.',
        'A neural model may still win if the table includes long transaction sequences, merchant descriptions, device fingerprints, or learned customer embeddings. The correct workflow is to establish a tuned tree baseline, add the neural pipeline, hold the split fixed, equalize search budgets, and compare accuracy, calibration, latency, and cost.',
      ],
    },
    {
      heading: 'Uses and limits',
      paragraphs: [
        'GBDTs often win on medium-sized, mostly structured tables with meaningful raw columns, mixed feature types, missing values, and irregular thresholds. They are also attractive when the organization needs fast retraining, explainable feature effects, simple serving, and strong baselines.',
        'They can fail when representation learning matters more than thresholding: raw text, images, audio, graphs, long event sequences, very high-cardinality entity sharing, or extremely large datasets where learned embeddings transfer signal. Neural methods can also win when the table is only one input inside a larger multimodal model.',
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        'Start with a leakage-safe GBDT baseline and make it hard to beat. Keep the split fixed, tune the tree model seriously, report calibration and slice behavior, and record the compute budget. Then add neural candidates when the data gives a concrete reason: raw modalities, entity sharing, sequence history, scale, or pretraining that is clean for the task.',
        'For production, measure the model as a service, not as a notebook score. GBDTs may be easier to retrain, explain, and serve with tight latency. Neural models may be easier to share across tasks once embeddings or sequence encoders exist. The right choice is the one that wins under the same data, same split, same operational budget, and same failure analysis.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Do not say trees always beat deep learning. They often beat deep learning on medium-sized, mostly structured tables under fair protocols. Do not compare defaults. Do not ignore tuning cost. Do not let preprocessing leak across folds. Do not average away rare but expensive slices. And do not call a neural tabular model better until it beats strong GBDT baselines under the same budget and deployment constraints.',
        'Do not treat feature engineering as unfair help for trees while giving neural models architecture search, embeddings, pretraining, and augmentation. The comparison should reflect the best realistic pipeline each team could operate.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Why do tree-based models still outperform deep learning on tabular data? at https://arxiv.org/abs/2207.08815, Revisiting Deep Learning Models for Tabular Data at https://arxiv.org/abs/2106.11959, XGBoost: A Scalable Tree Boosting System at https://arxiv.org/abs/1603.02754, and When Do Neural Nets Outperform Boosted Trees on Tabular Data? at https://arxiv.org/abs/2305.02997.',
        'Study Tabular Feature-Basis Orientation Primer, Leakage-Safe Target Encoding Case Study, Gradient Boosting, Random Forest, Neural Network Forward Pass, Normalization, Hyperparameter Search, Benchmark Variance & Model Selection, Data Leakage & Contamination, and Cross-Validation & Honest Evaluation next.',
      ],
    },
  ],
};
