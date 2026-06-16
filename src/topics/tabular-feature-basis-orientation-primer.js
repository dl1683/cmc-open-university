// Tabular feature-basis orientation: why raw columns, rotations, ratios, and
// irrelevant features change the inductive bias of trees and neural nets.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'tabular-feature-basis-orientation-primer',
  title: 'Tabular Feature-Basis Orientation Primer',
  category: 'AI & ML',
  summary: 'A visual primer on tabular feature orientation: axis-aligned tree splits, rotated feature bases, irrelevant columns, engineered ratios, and fair diagnostics.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['axis splits', 'diagnostic protocol'], defaultValue: 'axis splits' },
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

function basisGraph(title) {
  return graphState({
    nodes: [
      { id: 'raw', label: 'raw cols', x: 0.8, y: 3.6, note: 'meaning' },
      { id: 'rotate', label: 'rotate', x: 2.6, y: 1.8, note: 'mix' },
      { id: 'ratio', label: 'ratios', x: 2.6, y: 3.6, note: 'domain' },
      { id: 'noise', label: 'noise', x: 2.6, y: 5.4, note: 'junk' },
      { id: 'tree', label: 'tree', x: 5.0, y: 2.6, note: 'split' },
      { id: 'net', label: 'net', x: 5.0, y: 4.6, note: 'mix' },
      { id: 'score', label: 'score', x: 7.2, y: 3.6, note: 'slices' },
      { id: 'diag', label: 'diagnose', x: 9.0, y: 3.6, note: 'basis' },
    ],
    edges: [
      { id: 'e-raw-rotate', from: 'raw', to: 'rotate' },
      { id: 'e-raw-ratio', from: 'raw', to: 'ratio' },
      { id: 'e-raw-noise', from: 'raw', to: 'noise' },
      { id: 'e-rotate-tree', from: 'rotate', to: 'tree' },
      { id: 'e-ratio-tree', from: 'ratio', to: 'tree' },
      { id: 'e-noise-tree', from: 'noise', to: 'tree' },
      { id: 'e-rotate-net', from: 'rotate', to: 'net' },
      { id: 'e-ratio-net', from: 'ratio', to: 'net' },
      { id: 'e-noise-net', from: 'noise', to: 'net' },
      { id: 'e-tree-score', from: 'tree', to: 'score' },
      { id: 'e-net-score', from: 'net', to: 'score' },
      { id: 'e-score-diag', from: 'score', to: 'diag' },
    ],
  }, { title });
}

function* axisSplits() {
  yield {
    state: basisGraph('Raw column orientation is part of the model'),
    highlight: { active: ['raw', 'ratio', 'tree', 'e-raw-ratio', 'e-ratio-tree'], compare: ['rotate', 'net'], found: ['score'] },
    explanation: 'Tabular columns often already mean something: age, balance, utilization, claims count, lab value, days since signup. A tree split can use those axes directly. A rotation mixes columns into synthetic directions, which may remove the threshold shape the tree was exploiting.',
    invariant: 'The feature basis is not neutral when the model uses axis-aligned splits.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'raw feature A', min: 0, max: 10 }, y: { label: 'target risk', min: 0, max: 1 } },
      series: [
        { id: 'tree', label: 'tree split', points: [{ x: 0, y: 0.18 }, { x: 3.9, y: 0.18 }, { x: 4.0, y: 0.72 }, { x: 10, y: 0.72 }] },
        { id: 'smooth', label: 'smooth fit', points: [{ x: 0, y: 0.15 }, { x: 2, y: 0.28 }, { x: 4, y: 0.45 }, { x: 6, y: 0.62 }, { x: 10, y: 0.78 }] },
      ],
      markers: [
        { id: 'cut', x: 4, y: 0.72, label: 'cut' },
      ],
    }),
    highlight: { active: ['tree', 'cut'], compare: ['smooth'] },
    explanation: 'The simplest table signal is a threshold. A decision tree gets a cheap discontinuity. A smooth neural fit can approximate it, but usually needs more data, more capacity, or more tuning.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'rotated basis', min: 0, max: 10 }, y: { label: 'target risk', min: 0, max: 1 } },
      series: [
        { id: 'mixed', label: 'mixed signal', points: [{ x: 0, y: 0.30 }, { x: 2, y: 0.55 }, { x: 4, y: 0.38 }, { x: 6, y: 0.74 }, { x: 8, y: 0.42 }, { x: 10, y: 0.80 }] },
        { id: 'tree', label: 'tree path', points: [{ x: 0, y: 0.32 }, { x: 3, y: 0.32 }, { x: 3.1, y: 0.56 }, { x: 7, y: 0.56 }, { x: 7.1, y: 0.66 }, { x: 10, y: 0.66 }] },
      ],
      markers: [
        { id: 'mix', x: 5, y: 0.74, label: 'mixed' },
      ],
    }),
    highlight: { active: ['mixed', 'mix'], compare: ['tree'] },
    explanation: 'After rotation, one original threshold may be smeared across several coordinates. This is why a representation that helps one model family can hurt another. PCA-like transforms are useful tools, but they are not harmless preprocessing.',
  };

  yield {
    state: labelMatrix(
      'Feature-basis choices',
      [
        { id: 'raw', label: 'raw cols' },
        { id: 'scaled', label: 'scaled' },
        { id: 'rotated', label: 'rotated' },
        { id: 'ratio', label: 'ratios' },
        { id: 'embed', label: 'embeds' },
      ],
      [
        { id: 'helps', label: 'helps' },
        { id: 'hurts', label: 'hurts' },
      ],
      [
        ['tree splits', 'unit drift'],
        ['NN training', 'outliers'],
        ['linear nets', 'tree axes'],
        ['domain rules', 'leak risk'],
        ['entities', 'small data'],
      ],
    ),
    highlight: { active: ['raw:helps', 'ratio:helps', 'scaled:helps'], compare: ['rotated:hurts'] },
    explanation: 'Preprocessing has model-specific consequences. Scaling is often required for neural nets. Rotation can help linear or neural models but harm tree axes. Ratios can expose domain rules, but only if they are leakage-safe.',
  };

  yield {
    state: basisGraph('Noise columns test whether the model can ignore junk'),
    highlight: { active: ['noise', 'tree', 'net', 'score', 'e-noise-tree', 'e-noise-net'], compare: ['ratio'] },
    explanation: 'The local notes emphasize uninformative features: adding random columns often hurts MLP-like neural nets more than trees. The useful diagnostic is controlled noise injection: add junk columns, tune both models fairly, then plot degradation by model family.',
  };
}

function* diagnosticProtocol() {
  yield {
    state: labelMatrix(
      'Orientation diagnostics',
      [
        { id: 'raw', label: 'raw' },
        { id: 'scaled', label: 'scaled' },
        { id: 'rotated', label: 'rotated' },
        { id: 'noise', label: 'noise add' },
        { id: 'drop', label: 'drop weak' },
      ],
      [
        { id: 'test', label: 'test' },
        { id: 'learns', label: 'learns' },
      ],
      [
        ['baseline', 'true start'],
        ['normalize', 'scale need'],
        ['random mix', 'basis need'],
        ['junk cols', 'robustness'],
        ['feature trim', 'signal'],
      ],
    ),
    highlight: { active: ['raw:test', 'rotated:test', 'noise:test', 'drop:test'], found: ['scaled:learns'] },
    explanation: 'The protocol is a small experiment grid. Compare raw, scaled, rotated, noise-injected, and feature-trimmed versions under the same tuning budget. The result tells you whether the model needs the original basis, clean features, scaling, or representation learning.',
    invariant: 'A preprocessing step is not neutral until the benchmark proves it.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'random noise cols', min: 0, max: 100 }, y: { label: 'relative score', min: 0, max: 100 } },
      series: [
        { id: 'gbdt', label: 'GBDT', points: [{ x: 0, y: 90 }, { x: 20, y: 88 }, { x: 50, y: 86 }, { x: 100, y: 82 }] },
        { id: 'mlp', label: 'MLP', points: [{ x: 0, y: 88 }, { x: 20, y: 79 }, { x: 50, y: 66 }, { x: 100, y: 48 }] },
      ],
      markers: [
        { id: 'gap', x: 50, y: 66, label: 'gap opens' },
      ],
    }),
    highlight: { active: ['gbdt', 'mlp', 'gap'] },
    explanation: 'This conceptual plot mirrors the paper lesson. Trees can skip bad features at split time. MLP-like nets still receive every input coordinate and may spend capacity learning around irrelevant or noisy columns.',
  };

  yield {
    state: basisGraph('A basis audit becomes a model-selection record'),
    highlight: { active: ['raw', 'rotate', 'ratio', 'noise', 'score', 'diag', 'e-score-diag'], found: ['tree', 'net'] },
    explanation: 'Store the result like a model-selection record: dataset version, split policy, preprocessing transform, tuning budget, model family, slice metrics, and cost. Otherwise the team only remembers that one model won, not why it won.',
  };

  yield {
    state: labelMatrix(
      'Actionable outcomes',
      [
        { id: 'treewin', label: 'tree wins' },
        { id: 'netwin', label: 'net wins' },
        { id: 'tie', label: 'tie' },
        { id: 'unstable', label: 'unstable' },
      ],
      [
        { id: 'means', label: 'means' },
        { id: 'move', label: 'move' },
      ],
      [
        ['axis bias', 'ship GBDT'],
        ['rep learns', 'audit cost'],
        ['no big diff', 'simpler wins'],
        ['slice drift', 'fix data'],
      ],
    ),
    highlight: { active: ['treewin:move', 'netwin:move', 'tie:move', 'unstable:move'] },
    explanation: 'A diagnostic is useful only when it changes the decision. If tree wins on raw and loses after rotation, preserve the raw basis. If neural wins only after heavy tuning, include cost. If the result is unstable, fix splits and leakage before arguing architecture.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'axis splits') yield* axisSplits();
  else if (view === 'diagnostic protocol') yield* diagnosticProtocol();
  else throw new InputError('Pick a tabular feature-basis view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Feature-basis orientation is the fact that a tabular model sees the coordinate system you hand it. In tables, raw columns are often already meaningful axes. A tree split asks whether one axis crosses a threshold. A neural net can mix axes freely, but that flexibility is not always useful when the original basis encodes the domain. Rotating, scaling, embedding, or ratio-building changes the problem the model sees.',
        'The local tree-model notes emphasize the rotation result from Why do tree-based models still outperform deep learning on tabular data?: neural models can be more rotation-invariant, while tree-based models rely on the natural axis orientation that tabular data often provides. The paper frames this as one of three challenges for tabular neural nets: irrelevant features, feature orientation, and irregular functions: https://arxiv.org/abs/2207.08815.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A decision tree is axis-aligned. It can cheaply represent rules such as debt_ratio > 0.4, account_age < 30, or lab_value inside a range. If you rotate the feature space, that one clean threshold may become a diagonal or multi-feature interaction. The tree can still approximate it, but it may need many more splits. A neural net may be less disturbed by rotation, but it may also smooth over sharp business rules or spend capacity handling irrelevant inputs.',
        'This is why preprocessing should be treated as a tested design choice. Scaling helps gradient-based neural training. PCA can decorrelate or compress, but it can hide interpretable thresholds. Ratios and domain features can expose strong rules, but they can also leak target information if built from future data. Leakage-Safe Target Encoding Case Study applies the same basis-led thinking to categorical columns: the encoding can be a strong axis only if the target statistic was computed honestly. Feature Hashing Signed Projection Primer shows the opposite categorical tradeoff: no fitted vocabulary, but collision noise. Feature engineering is not dead; it is a controlled basis transformation.',
      ],
    },
    {
      heading: 'Diagnostic protocol',
      paragraphs: [
        'Run a small basis audit before choosing a complex tabular stack. Train strong GBDT and neural baselines under the same tuning budget on raw columns, scaled columns, randomly rotated columns, noise-injected columns, and feature-trimmed columns. Track aggregate score, slice score, calibration, training cost, and inference cost. If the tree collapses after rotation, the raw basis matters. If the neural model collapses under noise, feature selection matters. If both are close, the simpler deployment often wins.',
        'This audit complements Tabular Deep Learning vs GBDT Case Study. That page explains the broad benchmark claim. This page turns the rotation and irrelevant-feature findings into an engineering tool you can run on one dataset.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Imagine a credit-risk table with utilization, income, account age, missed payments, region, and dozens of weak vendor features. A boosted tree finds thresholds on utilization and missed payments while mostly ignoring random vendor noise. A neural net may improve after scaling and embedding categorical entities, but it may degrade when weak columns multiply. Rotate the numeric features, and the tree loses some clean thresholds. Add engineered ratios such as debt-to-income, and the tree may recover because the domain axis is restored.',
        'The correct conclusion is not "trees forever." The conclusion is "keep a basis ledger." Record which transforms were tried, which model family benefited, what the cost was, and whether the winning transform is leakage-safe. That ledger prevents preprocessing folklore from becoming production policy.',
      ],
    },
    {
      heading: 'Pitfalls and study next',
      paragraphs: [
        'Do not rotate tabular data just because PCA is familiar. Do not scale leakage into a clean-looking transform. Do not use feature importance from one model as universal truth. Do not compare a heavily tuned neural stack against a default GBDT or the reverse. And do not ignore feature units: some columns are measurements with domain meaning, not anonymous coordinates.',
        'Primary sources: Why do tree-based models still outperform deep learning on tabular data? at https://arxiv.org/abs/2207.08815, Revisiting Deep Learning Models for Tabular Data at https://arxiv.org/abs/2106.11959, and When Do Neural Nets Outperform Boosted Trees on Tabular Data? at https://arxiv.org/abs/2305.02997. Local source: 110049051-why-tree-based-models-beat-deep-learning-points-to-note-about-the-paper.txt. Study Tabular Deep Learning vs GBDT Case Study, Leakage-Safe Target Encoding Case Study, Feature Hashing Signed Projection Primer, Gradient Boosting, Random Forest, PCA, SVD, Normalization, Data Leakage & Contamination, Hyperparameter Search, and Benchmark Variance & Model Selection next.',
      ],
    },
  ],
};
