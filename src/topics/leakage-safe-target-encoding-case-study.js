// Leakage-safe target encoding: categorical maps that use label statistics
// without letting each row smuggle its own answer into the feature vector.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'leakage-safe-target-encoding-case-study',
  title: 'Leakage-Safe Target Encoding Case Study',
  category: 'AI & ML',
  summary: 'How target encoding, CatBoost-style ordered statistics, smoothing, and cross-fitting turn high-cardinality categories into honest numeric features.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['ordered encoding', 'cross-fit pipeline'], defaultValue: 'ordered encoding' },
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

function encodingGraph(title) {
  return graphState({
    nodes: [
      { id: 'rows', label: 'rows', x: 0.7, y: 3.6, note: 'cats+y' },
      { id: 'cat', label: 'cat key', x: 2.1, y: 3.6, note: 'merchant' },
      { id: 'global', label: 'global', x: 3.8, y: 1.8, note: 'all y' },
      { id: 'leak', label: 'leak', x: 5.4, y: 1.8, note: 'own y' },
      { id: 'perm', label: 'permute', x: 3.8, y: 3.6, note: 'order' },
      { id: 'prefix', label: 'prefix', x: 5.4, y: 3.6, note: 'past only' },
      { id: 'smooth', label: 'smooth', x: 7.0, y: 3.6, note: 'prior' },
      { id: 'model', label: 'model', x: 8.8, y: 3.6, note: 'split' },
    ],
    edges: [
      { id: 'e-rows-cat', from: 'rows', to: 'cat' },
      { id: 'e-cat-global', from: 'cat', to: 'global' },
      { id: 'e-global-leak', from: 'global', to: 'leak' },
      { id: 'e-cat-perm', from: 'cat', to: 'perm' },
      { id: 'e-perm-prefix', from: 'perm', to: 'prefix' },
      { id: 'e-prefix-smooth', from: 'prefix', to: 'smooth' },
      { id: 'e-smooth-model', from: 'smooth', to: 'model' },
      { id: 'e-leak-model', from: 'leak', to: 'model' },
    ],
  }, { title });
}

function crossFitGraph(title) {
  return graphState({
    nodes: [
      { id: 'train', label: 'train', x: 0.7, y: 3.6, note: 'sealed' },
      { id: 'folds', label: 'folds', x: 2.2, y: 3.6, note: 'k' },
      { id: 'fit', label: 'fit map', x: 4.0, y: 2.0, note: 'k-1' },
      { id: 'holdout', label: 'holdout', x: 4.0, y: 5.2, note: '1 fold' },
      { id: 'encode', label: 'encode', x: 5.9, y: 3.6, note: 'no own y' },
      { id: 'concat', label: 'concat', x: 7.4, y: 3.6, note: 'OOF' },
      { id: 'model', label: 'model', x: 9.0, y: 3.6, note: 'train' },
    ],
    edges: [
      { id: 'e-train-folds', from: 'train', to: 'folds' },
      { id: 'e-folds-fit', from: 'folds', to: 'fit' },
      { id: 'e-folds-holdout', from: 'folds', to: 'holdout' },
      { id: 'e-fit-encode', from: 'fit', to: 'encode' },
      { id: 'e-holdout-encode', from: 'holdout', to: 'encode' },
      { id: 'e-encode-concat', from: 'encode', to: 'concat' },
      { id: 'e-concat-model', from: 'concat', to: 'model' },
    ],
  }, { title });
}

function servingGraph(title) {
  return graphState({
    nodes: [
      { id: 'schema', label: 'schema', x: 0.8, y: 3.6, note: 'cat cols' },
      { id: 'split', label: 'split', x: 2.4, y: 2.0, note: 'policy' },
      { id: 'enc', label: 'enc map', x: 4.1, y: 2.0, note: 'v42' },
      { id: 'model', label: 'model', x: 6.0, y: 2.0, note: 'uses v42' },
      { id: 'reg', label: 'registry', x: 7.9, y: 3.6, note: 'lineage' },
      { id: 'online', label: 'online', x: 4.1, y: 5.3, note: 'lookup' },
      { id: 'req', label: 'request', x: 6.0, y: 5.3, note: 'no y' },
    ],
    edges: [
      { id: 'e-schema-split', from: 'schema', to: 'split' },
      { id: 'e-split-enc', from: 'split', to: 'enc' },
      { id: 'e-enc-model', from: 'enc', to: 'model' },
      { id: 'e-model-reg', from: 'model', to: 'reg' },
      { id: 'e-enc-online', from: 'enc', to: 'online' },
      { id: 'e-online-req', from: 'online', to: 'req' },
      { id: 'e-req-reg', from: 'req', to: 'reg' },
    ],
  }, { title });
}

function* orderedEncoding() {
  yield {
    state: encodingGraph('Naive target means create a leak path'),
    highlight: { active: ['rows', 'cat', 'global', 'leak', 'e-cat-global', 'e-global-leak'], removed: ['leak', 'e-leak-model'], compare: ['prefix', 'smooth'] },
    explanation: 'Target encoding is a map from category key to a label statistic: merchant_id becomes average fraud rate, publisher_id becomes click rate, diagnosis_code becomes readmission rate. The data structure is simple: keyed sums, counts, priors, and versions. The risk is severe: if the statistic is computed over all training rows, each row can partly encode its own label.',
    invariant: 'A row must never receive a target statistic that was computed from that same row label.',
  };

  yield {
    state: labelMatrix(
      'Categorical encoding choices',
      [
        { id: 'onehot', label: 'one-hot' },
        { id: 'hash', label: 'hash' },
        { id: 'freq', label: 'freq' },
        { id: 'target', label: 'target' },
        { id: 'ordered', label: 'ordered' },
        { id: 'native', label: 'native' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'strength', label: 'strength' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['bits', 'safe', 'wide'],
        ['bucket', 'compact', 'collide'],
        ['count', 'cheap', 'weak'],
        ['mean y', 'signal', 'leak'],
        ['prefix', 'signal', 'careful'],
        ['split', 'fast', 'library'],
      ],
    ),
    highlight: { active: ['target:strength', 'ordered:strength'], compare: ['onehot:risk', 'hash:risk', 'native:risk'], removed: ['target:risk'] },
    explanation: 'High-cardinality categorical features make one-hot vectors wide and sparse. Hashing is compact but collides. Frequency encoding is cheap but weak. Target encoding is powerful because it uses the label distribution behind each category, but that same power creates leakage unless the statistic is computed out-of-fold, over a time prefix, or by a library that implements an ordered scheme.',
  };

  yield {
    state: encodingGraph('Ordered statistics use past-only prefixes'),
    highlight: { active: ['perm', 'prefix', 'smooth', 'model', 'e-perm-prefix', 'e-prefix-smooth', 'e-smooth-model'], compare: ['global'], removed: ['leak'] },
    explanation: 'CatBoost popularized the ordered-statistics idea for categorical features. Shuffle the training rows into a random permutation. For row i, compute the category statistic from rows that appear before i in that permutation, plus a prior. The row receives a history-only estimate, not a statistic that includes its own label. Multiple permutations can reduce variance.',
    invariant: 'For row i in an ordered encoding, the statistic sees only earlier rows in the chosen order.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'category count', min: 1, max: 80 }, y: { label: 'encoded rate', min: 0, max: 1 } },
      series: [
        { id: 'raw', label: 'raw mean', points: [{ x: 1, y: 1.0 }, { x: 2, y: 0.0 }, { x: 4, y: 0.75 }, { x: 8, y: 0.62 }, { x: 20, y: 0.56 }, { x: 80, y: 0.54 }] },
        { id: 'prior', label: 'smoothed', points: [{ x: 1, y: 0.38 }, { x: 2, y: 0.36 }, { x: 4, y: 0.48 }, { x: 8, y: 0.54 }, { x: 20, y: 0.55 }, { x: 80, y: 0.54 }] },
      ],
      markers: [
        { id: 'rare', x: 1, y: 1.0, label: 'rare' },
        { id: 'stable', x: 80, y: 0.54, label: 'stable' },
      ],
    }),
    highlight: { active: ['prior', 'rare'], compare: ['raw'], found: ['stable'] },
    explanation: 'Smoothing is the second half of the data structure. A category seen once should not become a perfect fraud signal because that one row was fraudulent. Blend the category mean with a global prior so rare categories stay conservative and frequent categories can speak for themselves.',
  };

  yield {
    state: labelMatrix(
      'Library handling patterns',
      [
        { id: 'catboost', label: 'CatBoost' },
        { id: 'sklearn', label: 'sklearn TE' },
        { id: 'lightgbm', label: 'LightGBM' },
        { id: 'manual', label: 'manual SQL' },
      ],
      [
        { id: 'move', label: 'move' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['ordered Ctrs', 'prefix+prior'],
        ['cross-fit', 'fit_transform'],
        ['cat splits', 'cat_smooth'],
        ['agg map', 'OOF+time'],
      ],
    ),
    highlight: { active: ['catboost:guard', 'sklearn:guard'], compare: ['lightgbm:move'], removed: ['manual:guard'] },
    explanation: 'CatBoost docs describe categorical-to-numeric statistics computed after a permutation, where counts only include earlier objects with the value. scikit-learn TargetEncoder uses cross-fitting in fit_transform for training data. LightGBM handles integer-coded categoricals with native categorical splits and smoothing knobs. Manual SQL target encoding can work, but only if the fold, group, and time boundary are explicit.',
  };
}

function* crossFitPipeline() {
  yield {
    state: labelMatrix(
      'Naive fit vs cross-fit',
      [
        { id: 'plain', label: 'fit+transform' },
        { id: 'cf', label: 'cross-fit' },
        { id: 'test', label: 'test use' },
      ],
      [
        { id: 'map', label: 'map fit' },
        { id: 'train', label: 'train rows' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['all train', 'own y seen', 'leak'],
        ['k-1 folds', 'OOF value', 'honest'],
        ['all train', 'no test y', 'normal'],
      ],
    ),
    highlight: { removed: ['plain:risk', 'plain:train'], active: ['cf:map', 'cf:train', 'cf:risk'], found: ['test:risk'] },
    explanation: 'The training set needs out-of-fold encodings. Fit the category map on k-1 folds, transform the held-out fold, rotate, and concatenate the encoded holdouts. Test or production rows are different: their labels are unknown, so transforming them with a map fit on all training rows is normal.',
    invariant: 'Training encodings must be out-of-fold; inference encodings must come from the sealed training snapshot.',
  };

  yield {
    state: crossFitGraph('Out-of-fold target encoding pipeline'),
    highlight: { active: ['folds', 'fit', 'holdout', 'encode', 'concat', 'e-folds-fit', 'e-folds-holdout', 'e-fit-encode', 'e-holdout-encode'], found: ['model'] },
    explanation: 'The pipeline preserves the no-own-label invariant. Each held-out fold receives encodings from a map fit on other folds, then the encoded holdouts are concatenated so the downstream model never trains on a category statistic that already saw that row target.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'cardinality', min: 1, max: 100 }, y: { label: 'score', min: 0.4, max: 0.95 } },
      series: [
        { id: 'leaktrain', label: 'leak train', points: [{ x: 1, y: 0.62 }, { x: 10, y: 0.73 }, { x: 40, y: 0.84 }, { x: 100, y: 0.91 }] },
        { id: 'leaktest', label: 'leak test', points: [{ x: 1, y: 0.61 }, { x: 10, y: 0.64 }, { x: 40, y: 0.62 }, { x: 100, y: 0.55 }] },
        { id: 'cf', label: 'cross-fit', points: [{ x: 1, y: 0.60 }, { x: 10, y: 0.65 }, { x: 40, y: 0.67 }, { x: 100, y: 0.66 }] },
      ],
      markers: [
        { id: 'gap', x: 100, y: 0.91, label: 'gap' },
      ],
    }),
    highlight: { active: ['leaktrain', 'leaktest', 'gap'], found: ['cf'] },
    explanation: 'High-cardinality identifiers reveal the failure mode. A no-cross-fit encoder can make training score climb as categories become nearly unique, because the encoded value is almost the label. Test score does not follow. scikit-learn documents this exact overfitting pattern in its TargetEncoder cross-fitting example.',
  };

  yield {
    state: labelMatrix(
      'Pick the right splitter',
      [
        { id: 'random', label: 'random' },
        { id: 'strat', label: 'stratified' },
        { id: 'group', label: 'grouped' },
        { id: 'time', label: 'time' },
        { id: 'nested', label: 'nested' },
      ],
      [
        { id: 'when', label: 'when' },
        { id: 'rule', label: 'rule' },
      ],
      [
        ['iid rows', 'shuffle ok'],
        ['rare y', 'keep rates'],
        ['same entity', 'keep apart'],
        ['future task', 'past->future'],
        ['model pick', 'outer eval'],
      ],
    ),
    highlight: { active: ['group:rule', 'time:rule'], compare: ['random:rule'], found: ['nested:rule'] },
    explanation: 'Cross-fitting is only as honest as its splitter. Random folds are fine for independent rows. Class imbalance may need stratification. Patient, user, merchant, or document rows need group folds. Forecasting and delayed-label systems need temporal folds so the encoder map never learns from the future.',
  };

  yield {
    state: servingGraph('Production needs a versioned encoder map'),
    highlight: { active: ['schema', 'split', 'enc', 'model', 'online', 'req', 'e-enc-model', 'e-enc-online', 'e-online-req'], found: ['reg'] },
    explanation: 'Target encoding is not just preprocessing; it is model state. The trained model depends on a specific category map, smoothing policy, unknown-category fallback, split policy, and training snapshot. Put that encoder map in the model registry or feature store lineage so serving uses the same version the model was trained against.',
    invariant: 'The model and encoder map are one deployable artifact.',
  };

  yield {
    state: labelMatrix(
      'Failure modes and controls',
      [
        { id: 'row', label: 'row leak' },
        { id: 'group', label: 'group leak' },
        { id: 'time', label: 'time leak' },
        { id: 'rare', label: 'rare cat' },
        { id: 'unseen', label: 'unseen cat' },
        { id: 'drift', label: 'cat drift' },
      ],
      [
        { id: 'control', label: 'control' },
        { id: 'audit', label: 'audit' },
      ],
      [
        ['OOF encode', 'no own y'],
        ['GroupKFold', 'entity wall'],
        ['time split', 'as-of map'],
        ['smoothing', 'min count'],
        ['global prior', 'fallback'],
        ['version map', 'rate watch'],
      ],
    ),
    highlight: { active: ['row:control', 'group:control', 'time:control', 'rare:control', 'unseen:control'], compare: ['drift:audit'] },
    explanation: 'The complete checklist is operational, not theoretical. Confirm no row owns its statistic, no entity crosses the fold wall, no future label updates the map, rare categories are smoothed, unseen categories have a fallback, and the deployed map version is monitored for category drift.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'ordered encoding') yield* orderedEncoding();
  else if (view === 'cross-fit pipeline') yield* crossFitPipeline();
  else throw new InputError('Pick a target-encoding view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as the state machine for leakage-safe target encoding. Active items are the current decision point, found items are committed results, and removed items are paths ruled out by the invariant. The first safe inference is to name what state changed and why that move is legal.',
        {type: 'callout', text: 'Safe target encoding treats every row label as forbidden input for that row, using folds, time order, and smoothing to preserve signal without leakage.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4b/KfoldCV.gif', alt: 'Animated diagram of 3-fold cross-validation with training and testing folds rotating across observations.', caption: 'K-fold cross-validation diagram by MBanuelos22, Wikimedia Commons, CC BY-SA 4.0.'},
        'This topic is a case study, so the visual is not decoration. It shows which records, counters, queues, maps, or gates must agree before the system can return a trustworthy result.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'leakage-safe target encoding exists because a simple implementation works on a small example but fails when scale, latency, privacy, or correctness constraints arrive. The system needs a data structure that keeps the useful fast path without hiding the boundary conditions.',
        'The practical problem is not only speed. Cost, auditability, rollback, freshness, and slice-level behavior all affect whether the design is usable in production.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to keep one global rule, one score, one cache, one dashboard, or one list. That is easy to build and easy to explain. It often works until traffic shape or correctness requirements become more specific.',
        'The next obvious approach is to add capacity or widen the search. That may improve the average case, but it usually fails to encode the rule that decides which work is allowed, fresh, fair, or safe.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the missing boundary. A system can look correct globally while a narrow slice is wrong, stale, unfair, or too expensive. Once the boundary is missing, more throughput can make the failure faster.',
        'The concrete failure is usually visible as mixed state: one version reads another version cache, one user receives another user answer, one queue loses priority, or one metric hides a failing slice. The design needs an invariant that prevents that mixture.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to make the boundary a first-class data structure in leakage-safe target encoding. Keys, clocks, queues, ledgers, folds, or gates are not metadata; they are the mechanism that preserves correctness.',
        'The invariant should be checkable from stored state. If an operator cannot reconstruct why a result was allowed, denied, filled, scored, or rolled back, the system is relying on memory instead of design.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The mechanism starts by normalizing the input into records with stable identities. It then routes those records through the smallest structure that can answer the current decision: a map lookup, ordered queue, version gate, slice table, or witness search.',
        'Each step writes enough state for the next step to be local. Local means a cancel finds one order id, a cache gate checks one record, a rollout query joins one packet id, or a checker advances one legal candidate. That locality is what turns a broad problem into an executable workflow.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is preservation. Before a step, the invariant names which records may interact. The step reads only allowed state, writes the result, and leaves the invariant true for the next step.',
        'This is stronger than a dashboard claim. A dashboard can show an average after the fact; the invariant prevents an illegal result from being served in the first place. When the invariant fails, the system should produce a denial, rollback, miss, or counterexample instead of a quiet answer.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main cost is extra state. Maps, ledgers, clocks, slice tags, fold maps, queues, and audit rows consume memory and engineering time. The payoff is that expensive work becomes targeted instead of global.',
        'Cost behaves with the number of records, versions, slices, or live candidates. Doubling traffic does not only double compute; it can double cache pressure, queue length, audit rows, or search width. The dominant operation is the one on the hot path for the real workload.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'leakage-safe target encoding fits systems where correctness is operational, not just mathematical. Fraud models, retrieval systems, matching engines, model-serving stacks, evaluation gates, and rollout systems all need stored evidence for why one result was chosen.',
        'The access pattern determines fit. Repeated decisions benefit from maps and caches, ordered fairness needs queues and sequence numbers, release safety needs ledgers, and concurrent correctness needs histories that can be searched.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the boundary is chosen for convenience instead of the product promise. Random folds fail for time-forward prediction, global canaries fail for slice-specific regressions, and similarity search fails when authorization is the real question.',
        'It also fails when evidence is not versioned. A stale record can be more dangerous than a miss because it looks supported. The design needs no-store, deny, rollback, or human-review paths for cases outside the invariant.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the global fraud rate is 2%, prior_weight is 20, and merchant A has 8 fraud labels in 100 allowed past orders. The smoothed value is (8 + 20 * 0.02) / (100 + 20) = 8.4 / 120 = 0.07. The model sees 7% risk, not the raw 8%.',
        'Merchant B has 1 fraud label in 1 allowed order. The raw rate is 100%, but the smoothed value is (1 + 20 * 0.02) / (1 + 20) = 1.4 / 21 = 0.0667. One event no longer becomes a perfect fraud rule.',
        'In a 1000000-row, 5-fold training set, each row receives an encoding computed from about 800000 other rows. The validation estimate is less inflated because no row donates its own label to its own feature.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: CatBoost categorical docs at https://catboost.ai/docs/en/features/categorical-features, CatBoost paper at https://arxiv.org/abs/1706.09516, scikit-learn TargetEncoder docs at https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.TargetEncoder.html, and LightGBM categorical feature docs at https://lightgbm.readthedocs.io/en/latest/Advanced-Topics.html. Study Data Leakage and Contamination, Cross-Validation and Honest Evaluation, Feature Store, and Point-in-Time Feature Join Index next.',
      ],
    },
  ],
};
