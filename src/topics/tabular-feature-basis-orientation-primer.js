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
      heading: 'How to read the animation',
      paragraphs: [
        'The axis-splits view shows a flow graph: raw columns feed into three transforms -- rotation, ratios, and noise -- which then enter a tree and a neural net. Both models produce scores, and scores feed a diagnostic node. Active (green) nodes and edges mark the path under discussion. Compare (blue) nodes show the contrasting model or transform.',
        'The threshold plot draws a step function (tree split) against a smooth curve (neural fit) on the same raw feature axis. The cut marker shows where the tree places its discontinuity. The rotated-basis plot shows the same signal after coordinate mixing: the step is gone, replaced by a jagged path the tree must approximate with multiple splits.',
        {
          type: 'note',
          text: 'Switch to the diagnostic protocol view to see each preprocessing choice treated as a separate benchmark arm. The noise-injection plot shows GBDT degrading slowly while MLP drops steeply -- this is the core visual evidence that irrelevant features cost different model families different amounts.',
        },
        {
          type: 'diagram',
          text: '  raw cols -----> rotate -----> tree -----> score -----> diagnose\n             +--> ratios -----> net  -----+\n             +--> noise  -------+----------+',
          label: 'Simplified flow: each transform path changes which model family looks strong',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Tabular data arrives as rows and columns, but the columns already encode a domain model. Account age, credit utilization, lab values, claims count, payment delay -- each column has units, thresholds, and business rules. The coordinate system is not neutral. It is a representation choice, and different model families exploit it differently.',
        {
          type: 'quote',
          text: 'The inductive bias of a model interacts with the feature representation. Evaluating models on a single fixed preprocessing pipeline conflates model capacity with representation fit.',
          attribution: 'Grinsztajn, Oyallon, and Varoquaux, NeurIPS 2022',
        },
        'A tree splits directly on utilization > 0.40. A linear model sees weighted sums. A neural net can mix coordinates, but it must learn the useful mixtures from data and gradient steps. A rotation, scaling choice, or added noise column can flip which family appears to win. Treating preprocessing as a neutral prelude to model selection is the mistake this primer exists to prevent.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Pick one feature pipeline -- scale numerics, one-hot encode categories, maybe add PCA -- then run several models through it and declare the winner. This is fast and feels fair because every model sees the same inputs.',
        {
          type: 'code',
          language: 'python',
          text: '# The one-pipeline-fits-all pattern\npipe = Pipeline([\n    ("scale", StandardScaler()),\n    ("pca", PCA(n_components=20)),\n])\nX_train_t = pipe.fit_transform(X_train)\nfor model in [xgb, mlp, logistic]:\n    model.fit(X_train_t, y_train)\n    print(model, score(model, X_val_t, y_val))',
        },
        'The approach is reasonable when the team needs a quick signal. It becomes dangerous when the results are taken as ground truth about model families, because the pipeline was designed -- consciously or not -- for one family and inherited by the others.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The same transform can help one model family and hurt another. Scaling helps gradient-based optimizers converge but is irrelevant to tree split selection. PCA rotation can reveal directions a linear model uses cleanly, but it hides a simple threshold that a tree would capture in one split. Adding many weak columns may barely affect a strong tree (it skips them at split time) but can consume neural capacity and increase overfitting.',
        {
          type: 'table',
          headers: ['Transform', 'Helps', 'Hurts', 'Mechanism'],
          rows: [
            ['StandardScaler', 'MLP, logistic', 'Nothing (but wastes tree time)', 'Equalizes gradient magnitudes across features'],
            ['PCA rotation', 'Linear, some neural', 'Tree axis alignment', 'Mixes original thresholds across synthetic coordinates'],
            ['Domain ratios', 'Tree, linear', 'Nothing (if leakage-safe)', 'Creates axis that matches a business rule directly'],
            ['Noise columns', 'Nothing', 'MLP >> tree', 'Neural net receives every input; tree can skip at split time'],
            ['Target encoding', 'Tree, neural', 'Validation integrity', 'Leaks label statistics unless computed inside each fold'],
          ],
        },
        'A fair comparison must separate model ability from representation fit. Without that separation, the team may conclude deep learning lost when the real issue was a weak preprocessing pipeline, or that a neural model won when it received engineered features the tree baseline never saw.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Treat the feature basis as an experimental variable. Build a grid where each row is one (transform, model family) pair, all sharing the same data split, target, evaluation metric, and tuning budget.',
        {
          type: 'code',
          language: 'python',
          text: '# Basis-orientation diagnostic grid\ntransforms = {\n    "raw":     identity,\n    "scaled":  StandardScaler(),\n    "rotated": PCA(n_components=k),\n    "ratios":  add_domain_ratios,   # debt/income, util/limit\n    "noise50": add_random_cols(50),  # 50 Gaussian noise columns\n    "trimmed": drop_low_importance,  # remove bottom-quartile features\n}\nmodels = {"xgb": XGBClassifier, "mlp": MLPClassifier, "lr": LogisticRegression}\n\nfor t_name, t_fn in transforms.items():\n    X_t = t_fn(X_train)\n    for m_name, m_cls in models.items():\n        m = tune(m_cls, X_t, y_train, budget=100)\n        record(transform=t_name, model=m_name,\n               auc=auc(m, X_val_t), cal=calibration(m, X_val_t),\n               slices=slice_metrics(m, X_val_t, groups))',
        },
        'For each run, the ledger stores: dataset version, split policy, transform name, leakage guard, model family, hyperparameter budget, aggregate metric, slice metrics, calibration error, training cost, inference latency, and feature availability at serving time.',
        {
          type: 'note',
          text: 'Vary one representation choice at a time. Add ratios without rotation. Rotate without ratios. Inject noise without trimming. These single-variable ablations reveal whether the win came from the basis, the model, the tuning budget, or an accidental leak.',
        },
        'The output is not a leaderboard. It is a basis ledger that explains why each model won or lost under each representation, so the decision can be reproduced and challenged.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The diagnostic converts vague model arguments into controlled comparisons with named variables.',
        {
          type: 'bullets',
          items: [
            'If the tree wins on raw columns but loses after rotation, it was exploiting axis alignment -- the threshold sat on one coordinate.',
            'If the neural model improves only after scaling and embeddings, the original neural baseline was underprepared, not inherently weaker.',
            'If both models fail on a time-safe split but succeed on a random split, the problem is data drift, not architecture.',
            'If a ratio feature boosts every model, check for label leakage -- the ratio may encode future information.',
            'If a neural model wins by 0.3 AUC points after 10x the tuning budget and 3x the inference cost, the ledger forces that cost into the decision.',
          ],
        },
        'The deeper reason is that the feature basis is part of the inductive bias. A tree with axis-aligned splits and a neural net with learned mixtures are not using the same coordinate system even when they receive the same input matrix. The diagnostic makes that invisible difference measurable.',
        {
          type: 'quote',
          text: 'The right question is not which model is best. It is which representation-model pair is reliable for this task, this data, this split policy, and this serving constraint.',
          attribution: 'Basis-orientation principle',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The diagnostic is a multiplicative grid. If you test T transforms and M model families with B tuning budget per cell, total cost is T x M x B training runs.',
        {
          type: 'table',
          headers: ['Grid dimension', 'Typical size', 'Cost driver'],
          rows: [
            ['Transforms (T)', '4-8', 'Feature engineering time + leakage audit per transform'],
            ['Model families (M)', '2-4', 'Each family needs its own tuning search space'],
            ['Tuning budget (B)', '50-200 trials', 'Dominates wall-clock time; use early stopping'],
            ['Slice evaluation', '5-20 slices', 'Cheap after training; expensive to define well'],
            ['Repeated splits', '3-5 seeds or folds', 'Multiplies everything; needed for confidence intervals'],
          ],
        },
        'A practical grid with 6 transforms, 3 models, and 100 trials is 1,800 training runs. With 5-fold cross-validation, that becomes 9,000. On a single GPU with XGBoost and a small MLP, this runs overnight for datasets under 1M rows. For larger tables, subsample the tuning phase and run full evaluation on the best configurations only.',
        {
          type: 'note',
          text: 'The grid cost is front-loaded. Once the basis ledger is built, adding a new model family costs M rows. Adding a new transform costs T rows. The structure amortizes across the project lifetime.',
        },
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'The diagnostic is most valuable in domains where columns carry domain meaning and business decisions depend on specific population slices.',
        {
          type: 'bullets',
          items: [
            'Credit risk: utilization thresholds, debt-to-income ratios, and thin-file borrower slices make axis alignment and ratio features critical. Regulators ask why the model decided, not just how well it scored.',
            'Healthcare: lab values have clinical cutoffs (eGFR < 60, HbA1c > 6.5). A tree split on the raw lab value matches clinical reasoning. Rotation destroys that interpretability.',
            'Fraud detection: transaction velocity, amount-to-average ratios, and device fingerprints are domain axes. Noise columns from third-party enrichment vendors often hurt neural models more than trees.',
            'Insurance pricing: loss ratios, exposure counts, and territory codes are meaningful features. GLMs need interactions engineered; GBDTs find them from raw columns.',
            'Churn and retention: days-since-last-login, session-count-per-week, and feature-adoption flags are axis-aligned signals. Adding 50 behavioral columns without selection can drown an MLP.',
          ],
        },
        'The method also resolves team debates. Instead of arguing whether trees or neural nets are better in general, the team can point to the ledger: raw axes mattered here, rotation hurt tree efficiency there, scaling was necessary for the MLP, and serving requires these exact transforms.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'table',
          headers: ['Failure mode', 'What goes wrong', 'Mitigation'],
          rows: [
            ['Leaky split', 'Random validation mixes future and past; every transform looks good', 'Use time-based or group-based splits for business data'],
            ['Underpowered comparison', 'Small data or unstable labels make representation effects look like noise', 'Repeated splits with confidence intervals'],
            ['Overgeneralization', 'Team reads one dataset result as a universal law about model families', 'Log the dataset version, split, and tuning budget -- the result is conditional'],
            ['Leaky transforms', 'Target encoding or rolling features computed before the split leak future labels', 'Compute all derived features inside each training fold'],
            ['Unequal tuning', 'Default GBDT vs. heavily tuned MLP (or vice versa) says nothing about families', 'Fix a comparable search budget per cell; document it'],
          ],
        },
        'The diagnostic also fails silently when feature availability differs between training and serving. A strong offline feature that arrives late in production is not a real online feature. The basis ledger should flag which features are online-safe, batch-only, or subject to privacy constraints.',
        'Finally, the grid can become a comfort blanket. Running 9,000 experiments feels rigorous, but if the split is wrong or the metric hides calibration failures, the volume of runs adds false confidence rather than real evidence.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'Role', 'Key claim'],
          rows: [
            ['Grinsztajn, Oyallon, Varoquaux -- "Why do tree-based models still outperform deep learning on typical tabular data?" (NeurIPS 2022)', 'Primary research', 'Trees outperform neural nets on medium tabular data partly because of uninformative features and irregular target functions that favor axis-aligned splits'],
            ['Gorishniy et al. -- "Revisiting Deep Learning Models for Tabular Data" (NeurIPS 2021)', 'Architecture survey', 'ResNet-like and Transformer-like tabular models can match GBDT when properly tuned, but tuning cost is higher and the gap depends on dataset properties'],
            ['Shwartz-Ziv and Armon -- "Tabular Data: Deep Learning Is Not All You Need" (2022)', 'Benchmark discipline', 'XGBoost outperforms or matches deep models on most tabular benchmarks; ensembling a tree with a neural net sometimes helps'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: study Gradient Boosting and PCA to understand why axis-aligned splits and rotated bases behave differently.',
            'Extension: study Tabular Deep Learning vs GBDT Case Study for a full benchmark comparison with tuning budgets and slice metrics.',
            'Contrast: study Feature Hashing Signed Projection Primer for a basis transform designed to reduce dimensionality rather than align with domain axes.',
            'Practice: study Data Leakage and Cross Validation to build the leakage guards the diagnostic requires.',
            'Production: study Feature Store and Calibration Curves for the serving and evaluation constraints that complete the basis ledger.',
          ],
        },
      ],
    },
  ],
};
