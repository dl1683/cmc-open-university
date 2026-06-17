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
      heading: 'Why this exists',
      paragraphs: [
        'Target encoding converts a categorical value into a statistic of the target for that value. Instead of giving merchant_42 a one-hot column, encode it as the smoothed fraud rate observed for merchant_42. Instead of one-hotting publisher_id, encode it as historical click-through rate. This is a compact, high-signal data structure: category key -> sum, count, prior, smoothing policy, timestamp or fold boundary, and version.',
        'The danger is built into the name: the encoder uses y. If a training row receives a statistic that includes its own label, the row has leaked part of the answer into its features. High-cardinality categories make this especially bad. A near-unique user_id can become an almost perfect label copier unless the encoding is ordered, cross-fitted, smoothed, or replaced by a safer native categorical method. Feature Hashing Signed Projection Primer is the sibling option when you need bounded memory and streaming rather than label-rate statistics.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Every edge into the encoder map is a possible leak path. A safe encoding can use other rows, earlier rows, or other folds; it cannot use the target from the row being encoded.',
        'In the cross-fit view, the held-out fold is the correctness boundary. The encoder map is fit without that fold, applied to that fold, and then rotated until every training row has an out-of-fold value. The invariant is simple: no row may help compute its own feature value.',
      ],
    },
    {
      heading: 'The data structure',
      paragraphs: [
        'A target encoder is a keyed aggregate map. For binary classification, each category stores positive_count, total_count, and a global prior. A smoothed value can be read as (positive_count + prior_weight * global_rate) / (total_count + prior_weight). Regression uses sums and counts. Multiclass encoders can emit one statistic per class. The implementation is usually a hash map offline, but the production contract is closer to a model artifact: the map must be versioned, reproducible, and tied to the split policy that produced it.',
        'CatBoost-style ordered target statistics add an ordering dimension to the map. CatBoost documentation describes permuting input objects and computing categorical statistics in that order, where counts include only objects that already have the value calculated. That turns the full-dataset aggregate into a prefix aggregate. Prefix maps are the central anti-leak move: row i can use previous rows, but not row i itself.',
      ],
    },
    {
      heading: 'Ordered and cross-fitted encodings',
      paragraphs: [
        'There are two common honesty patterns. Ordered encoding uses a permutation or real time order, then computes each row from prior rows only. Cross-fitted encoding splits training data into k folds, fits the category map on k-1 folds, transforms the held-out fold, and concatenates the out-of-fold encodings. Both enforce the same invariant: the row being encoded did not contribute its own target to the statistic it receives.',
        'scikit-learn TargetEncoder makes this distinction explicit. Its documentation discourages plain fit followed by transform on training data because it can introduce leakage, while fit_transform uses a cross-fitting scheme for training encodings. The associated example shows why: without cross-fitting, high-cardinality uninformative features can receive exaggerated downstream weight and overfit badly.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Ordered and cross-fitted encodings work because they make the training feature generation resemble prediction time. At prediction time, the model never knows the label of the row it is scoring. A safe training encoder preserves that ignorance while still using historical or out-of-fold aggregate signal.',
        'Smoothing works because rare categories are noisy. A merchant with one fraud event should not receive a perfect fraud-rate feature. Pulling the category statistic toward a global or segment prior reduces variance and prevents rare ids from becoming memorized labels.',
      ],
    },
    {
      heading: 'Complete case study: marketplace fraud',
      paragraphs: [
        'A marketplace fraud model has merchant_id, buyer_region, card_bin, shipping_zip, device_family, order_amount, and a delayed fraud label. merchant_id has 900,000 possible values, so one-hot encoding is too wide. A naive SQL target encoding groups all training rows by merchant_id, computes fraud_rate, joins it back, and reports excellent validation AUC. The score is fake if the join used each order fraud label to encode that same order, or if chargeback labels from the future updated earlier rows.',
        'The leakage-safe version uses temporal cross-fitting. For a prediction at time t, the merchant statistic is computed from orders and labels available before t, smoothed toward the global fraud prior and bounded by a minimum count. Group folds keep the same merchant family from crossing the wall if the business problem requires cold-merchant generalization. The encoder map is deployed with the model, unknown merchants fall back to the global or segment prior, and monitoring tracks unseen-category rate, rare-category volume, and drift in encoded rates.',
      ],
    },
    {
      heading: 'Complete case study: ad click prediction',
      paragraphs: [
        'An ad ranking system has publisher_id, campaign_id, creative_id, geography, device, and hour. The target is click or no click. Target encoding campaign_id as historical CTR is useful, but only if the historical window matches serving. If the training encoder uses full-week clicks to predict Monday morning impressions, the model learned from the future. If the encoder is refreshed every hour in production but backfilled daily for training, training-serving skew can dominate the model.',
        'A robust design treats the encoder like a feature store feature. The offline map is point-in-time: for each impression, use only clicks and impressions that had arrived before that impression. The online map is a low-latency counter table with the same decay, smoothing, and fallback logic. The model registry records encoder version, data snapshot, delay policy, and smoothing parameters. That connects this topic directly to Feature Store, Point-in-Time Feature Join Index, and Training-Serving Skew Replay Diff.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'Do not run target encoding before the train/test split. Do not compute a global category mean and join it back to the same rows. Do not use random folds when entities, time, or groups define the real leakage boundary. Do not let rare categories become perfect rules. Do not deploy a model without the encoder map version it was trained with. And do not assume every library uses the same categorical strategy: CatBoost ordered Ctrs, scikit-learn cross-fitted TargetEncoder, and LightGBM native categorical splits solve adjacent but different engineering problems.',
        'The method is also weak for cold-start categories unless the fallback policy is good. Unknown keys need a global prior, segment prior, hierarchy, hash fallback, or native categorical handling. If unseen-category rate rises after launch, the model may still run but its most useful categorical feature has gone stale.',
      ],
    },
    {
      heading: 'Operational checklist',
      paragraphs: [
        'Version the encoder as part of the model, not as a casual preprocessing step. Record the aggregation window, fold policy, time cutoff, smoothing strength, prior, unknown-category fallback, and source tables. A model cannot be reproduced if its category map is missing or rebuilt with a different label horizon.',
        'Monitor the feature, not only the model score. Track unknown-category rate, low-count-category volume, shifts in encoded means, delayed-label backfill, and differences between offline point-in-time values and online serving values. Most target-encoding failures look like ordinary model drift until the feature pipeline is inspected closely.',
        'Decide what the category means operationally. A merchant id, user id, publisher id, and zip code age differently, leak differently, and need different fallback rules. The fold or time boundary should follow that business meaning, not the convenience of a random split.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: CatBoost categorical transformation docs at https://catboost.ai/docs/en/concepts/algorithm-main-stages_cat-to-numberic, CatBoost categorical feature docs at https://catboost.ai/docs/en/features/categorical-features, CatBoost paper at https://arxiv.org/abs/1706.09516, scikit-learn TargetEncoder docs at https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.TargetEncoder.html, scikit-learn TargetEncoder cross-fitting example at https://scikit-learn.org/stable/auto_examples/preprocessing/plot_target_encoder_cross_val.html, and LightGBM categorical feature docs at https://lightgbm.readthedocs.io/en/latest/Advanced-Topics.html. Study Data Leakage & Contamination, Cross-Validation & Honest Evaluation, Tabular Feature-Basis Orientation Primer, Feature Hashing Signed Projection Primer, Tabular Deep Learning vs GBDT Case Study, Gradient Boosting, Feature Store, Point-in-Time Feature Join Index, and Benchmark Variance & Model Selection next.',
      ],
    },
  ],
};
