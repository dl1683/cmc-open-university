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
  const transforms = ['raw cols', 'rotate', 'ratios', 'noise'];
  const modelFamilies = ['tree', 'net'];
  const cutPoint = 4;

  yield {
    state: basisGraph('Raw column orientation is part of the model'),
    highlight: { active: ['raw', 'ratio', 'tree', 'e-raw-ratio', 'e-ratio-tree'], compare: ['rotate', 'net'], found: ['score'] },
    explanation: `Tabular columns often already mean something: age, balance, utilization, claims count, lab value, days since signup. With ${transforms.length} transform paths and ${modelFamilies.length} model families, a tree split can use those axes directly. A rotation mixes columns into synthetic directions, which may remove the threshold shape the tree was exploiting.`,
    invariant: `The feature basis is not neutral when the model uses axis-aligned splits.`,
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
    explanation: `The simplest table signal is a threshold at x=${cutPoint}. A decision tree gets a cheap discontinuity. A smooth neural fit can approximate it, but usually needs more data, more capacity, or more tuning.`,
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
    explanation: `After rotation, the original threshold at x=${cutPoint} may be smeared across several coordinates. This is why a representation that helps one of the ${modelFamilies.length} model families can hurt the other. PCA-like transforms are useful tools, but they are not harmless preprocessing.`,
  };

  const basisChoices = ['raw cols', 'scaled', 'rotated', 'ratios', 'embeds'];
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
    explanation: `This table compares ${basisChoices.length} basis choices (${basisChoices.join(', ')}). Preprocessing has model-specific consequences. Scaling is often required for neural nets. Rotation can help linear or neural models but harm tree axes.`,
  };

  yield {
    state: basisGraph('Noise columns test whether the model can ignore junk'),
    highlight: { active: ['noise', 'tree', 'net', 'score', 'e-noise-tree', 'e-noise-net'], compare: ['ratio'] },
    explanation: `The local notes emphasize uninformative features: adding random columns often hurts MLP-like neural nets more than ${modelFamilies[0]}s. The useful diagnostic is controlled noise injection: add junk columns, tune both ${modelFamilies.length} model families fairly, then plot degradation.`,
  };
}

function* diagnosticProtocol() {
  const diagnosticArms = ['raw', 'scaled', 'rotated', 'noise add', 'drop weak'];
  const noiseColCounts = [0, 20, 50, 100];

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
    explanation: `The protocol is a ${diagnosticArms.length}-arm experiment grid: ${diagnosticArms.join(', ')}. Compare under the same tuning budget. The result tells you whether the model needs the original basis, clean features, scaling, or representation learning.`,
    invariant: `A preprocessing step is not neutral until the benchmark proves it.`,
  };

  const gbdtDrop = 90 - 82;
  const mlpDrop = 88 - 48;
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
    explanation: `This plot tests ${noiseColCounts.length} noise levels (${noiseColCounts.join(', ')} columns). GBDT drops only ${gbdtDrop} points while MLP drops ${mlpDrop}. Trees can skip bad features at split time. MLP-like nets still receive every input coordinate and may spend capacity learning around irrelevant or noisy columns.`,
  };

  const recordFields = ['dataset version', 'split policy', 'preprocessing transform', 'tuning budget', 'model family', 'slice metrics', 'cost'];
  yield {
    state: basisGraph('A basis audit becomes a model-selection record'),
    highlight: { active: ['raw', 'rotate', 'ratio', 'noise', 'score', 'diag', 'e-score-diag'], found: ['tree', 'net'] },
    explanation: `Store the result like a model-selection record with ${recordFields.length} fields: ${recordFields.join(', ')}. Otherwise the team only remembers that one model won, not why it won.`,
  };

  const outcomes = ['tree wins', 'net wins', 'tie', 'unstable'];
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
    explanation: `A diagnostic has ${outcomes.length} possible outcomes (${outcomes.join(', ')}). It is useful only when it changes the decision. If tree wins on raw and loses after rotation, preserve the raw basis. If the result is unstable, fix splits and leakage before arguing architecture.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        {
          type: 'callout',
          text: 'A fair tabular benchmark compares representation-model pairs, because raw axes are part of the inductive bias.',
        },
        'Read the raw columns as a coordinate system, not just data. A tree split is axis-aligned, so it can exploit a threshold such as utilization > 0.40 directly.',
        'The rotation and noise paths show representation changes. Active nodes mark the transform-model pair being tested, and compare nodes show how another model family reacts to the same basis.',
        {
          type: 'image',
          src: './assets/gifs/tabular-feature-basis-orientation-primer.gif',
          alt: 'Animated walkthrough of the tabular feature basis orientation primer visualization',
          caption: 'Animation preview: the full visualization plays through each step at reading pace.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Tabular data arrives as rows and named columns, and those names often carry business or scientific meaning. A column such as debt-to-income ratio, age, dosage, or days-late is already an engineered axis.',
        'This primer exists because model comparisons can accidentally compare representation-model pairs instead of model families. A preprocessing pipeline can make a tree look weak or a neural net look strong before training begins.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to build one preprocessing pipeline and run every model through it. Scaling, encoding, rotation, feature selection, and ratio creation are treated as neutral preparation.',
        'That feels fair because every model receives the same matrix. It is not always fair because model families have different inductive biases, meaning built-in preferences about which patterns are easy to learn.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/8/87/Recursive_Splitting.png',
          alt: 'Recursive binary splitting diagram showing feature-space partitions and a matching decision tree.',
          caption: 'Recursive splitting makes the tree bias visible: each decision is axis-aligned, so the original column basis matters. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Recursive_Splitting.png.',
        },
        'The wall is basis dependence. Axis-aligned trees love raw thresholds and domain ratios, while rotations can turn one clean split into many smaller splits.',
        'Neural nets and linear models often benefit from scaling and mixed coordinates, but they may spend capacity on irrelevant noise columns. The same transform changes both learning difficulty and measured accuracy.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Evaluate representation and model together. A benchmark row should name the transform, leakage controls, tuning budget, model family, and serving constraints.',
        'The goal is not to crown one universal winner. The goal is to learn which model wins under which basis, and whether the win survives ablations that change only one representation choice.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/f/f5/GaussianScatterPCA.svg',
          alt: 'Scatter plot with principal component axes over a Gaussian cloud.',
          caption: 'PCA rotation can be useful, but this picture also shows why a rotated basis changes the features a tree can split on directly. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:GaussianScatterPCA.svg.',
        },
        'Build a diagnostic grid. Run raw, scaled, rotated, ratio-added, noise-added, and trimmed versions of the same training split through the relevant model families.',
        'Hold the evaluation protocol fixed: same folds, same metric, same tuning budget, same leakage guard, and same serving-time feature availability. Record aggregate score, slice score, calibration, training cost, and inference cost.',
        'Then interpret moves, not just ranks. If a tree wins on raw columns and loses after PCA rotation, the result is evidence that the raw basis carried useful axis-aligned thresholds.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The method works by controlled comparison. Changing one transform at a time isolates whether the performance shift came from the representation or from the model family.',
        'It also protects against accidental leakage. If target encoding, time splits, or aggregate ratios are recomputed incorrectly, the diagnostic ledger has a place to record and audit that dependency.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is multiplied training work. If six transforms are tested against four model families with five folds, the team runs 120 fitted models before tuning depth is counted.',
        'That cost buys decision quality. It prevents a cheap one-pipeline benchmark from selecting a model that only won because the representation favored it or leaked future information.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Credit risk, fraud detection, ads ranking, medical risk scoring, and operations forecasting all use tabular data where columns encode domain rules. In these settings, raw thresholds and ratios can be as important as model architecture.',
        'The diagnostic is useful before replacing gradient-boosted trees with neural nets. It shows whether the neural model learned better interactions or merely received a friendlier feature basis.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the split policy is weak. Random splits can hide time drift, customer leakage, or entity overlap, making every transform-model comparison look better than production.',
        'It also fails when the search space becomes a leaderboard exercise. Too many transforms without a hypothesis can overfit validation data and produce a fragile winner.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Let x be utilization and y be account age. A tree can learn risk from one split, x > 0.40, if high utilization is the main signal.',
        'Rotate the features to u = (x + y) / 1.414 and v = (x - y) / 1.414. The same rule becomes u + v > 0.566, which is diagonal in the rotated space. An axis-aligned tree now needs several rectangles to approximate what was one split, while a linear or neural model may handle the rotated line cleanly.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Grinsztajn, Oyallon, and Varoquaux 2022 on why tree-based models remain strong for tabular data. Next study gradient boosting, data leakage, feature hashing, calibration curves, and cross-validation under time or entity splits.',
      ],
    },
  ],
};
