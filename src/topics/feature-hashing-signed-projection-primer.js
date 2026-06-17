// Feature hashing: vocabulary-free sparse features using hash buckets,
// optional signs, collision budgets, and production audit loops.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'feature-hashing-signed-projection-primer',
  title: 'Feature Hashing Signed Projection Primer',
  category: 'AI & ML',
  summary: 'Encode high-cardinality text and categorical features with the hashing trick: fixed-width sparse vectors, signed collisions, and production collision audits.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['hashing trick', 'collision audit'], defaultValue: 'hashing trick' },
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

function hashingGraph(title) {
  return graphState({
    nodes: [
      { id: 'raw', label: 'raw row', x: 0.7, y: 3.5, note: 'tokens' },
      { id: 'names', label: 'names', x: 2.1, y: 3.5, note: 'feat=str' },
      { id: 'hash', label: 'hash', x: 3.6, y: 2.3, note: 'index' },
      { id: 'sign', label: 'sign', x: 3.6, y: 4.7, note: '+/-' },
      { id: 'bucket', label: 'bucket', x: 5.4, y: 3.5, note: 'fixed dim' },
      { id: 'csr', label: 'CSR row', x: 7.2, y: 3.5, note: 'sparse' },
      { id: 'model', label: 'model', x: 9.0, y: 3.5, note: 'linear' },
    ],
    edges: [
      { id: 'e-raw-names', from: 'raw', to: 'names' },
      { id: 'e-names-hash', from: 'names', to: 'hash' },
      { id: 'e-names-sign', from: 'names', to: 'sign' },
      { id: 'e-hash-bucket', from: 'hash', to: 'bucket' },
      { id: 'e-sign-bucket', from: 'sign', to: 'bucket' },
      { id: 'e-bucket-csr', from: 'bucket', to: 'csr' },
      { id: 'e-csr-model', from: 'csr', to: 'model' },
    ],
  }, { title });
}

function auditGraph(title) {
  return graphState({
    nodes: [
      { id: 'ns', label: 'namespc', x: 0.7, y: 3.5, note: 'field' },
      { id: 'bits', label: 'bits', x: 2.2, y: 2.0, note: 'dim' },
      { id: 'seed', label: 'seed', x: 2.2, y: 5.0, note: 'stable' },
      { id: 'sample', label: 'sample', x: 4.2, y: 3.5, note: 'collisions' },
      { id: 'exact', label: 'exact', x: 6.1, y: 2.0, note: 'debug' },
      { id: 'metric', label: 'metric', x: 6.1, y: 5.0, note: 'drift' },
      { id: 'ship', label: 'ship', x: 8.4, y: 3.5, note: 'guarded' },
    ],
    edges: [
      { id: 'e-ns-bits', from: 'ns', to: 'bits' },
      { id: 'e-ns-seed', from: 'ns', to: 'seed' },
      { id: 'e-bits-sample', from: 'bits', to: 'sample' },
      { id: 'e-seed-sample', from: 'seed', to: 'sample' },
      { id: 'e-sample-exact', from: 'sample', to: 'exact' },
      { id: 'e-sample-metric', from: 'sample', to: 'metric' },
      { id: 'e-exact-ship', from: 'exact', to: 'ship' },
      { id: 'e-metric-ship', from: 'metric', to: 'ship' },
    ],
  }, { title });
}

const TOKEN_ROWS = [
  { id: 'user', label: 'user=42' },
  { id: 'ad', label: 'ad=17' },
  { id: 'city', label: 'city=NY' },
  { id: 'word1', label: 'word=free' },
  { id: 'word2', label: 'word=sale' },
  { id: 'cross', label: 'ad x city' },
];

function* hashingTrick() {
  yield {
    state: hashingGraph('Hashing replaces the vocabulary table'),
    highlight: { active: ['raw', 'names', 'hash', 'bucket', 'csr', 'e-names-hash', 'e-hash-bucket'], compare: ['sign'], found: ['model'] },
    explanation: 'One-hot encoding needs a vocabulary map: feature name -> column id. Feature hashing removes that fitted dictionary. Each feature name is hashed directly to a fixed column, optionally with a second sign bit. The output is a sparse row that can feed linear models, online learners, text classifiers, and large ad-ranking systems.',
    invariant: 'The vector width is fixed before training; new feature names do not change the schema.',
  };

  yield {
    state: labelMatrix(
      'Feature names become bucket updates',
      TOKEN_ROWS,
      [
        { id: 'idx', label: 'index' },
        { id: 'sgn', label: 'sign' },
        { id: 'value', label: 'value' },
      ],
      [
        ['3', '+', '1'],
        ['6', '-', '1'],
        ['1', '+', '1'],
        ['6', '+', '1'],
        ['4', '-', '1'],
        ['2', '+', '1'],
      ],
    ),
    highlight: { active: ['ad:idx', 'word1:idx'], compare: ['ad:sgn', 'word1:sgn'] },
    explanation: 'Here ad=17 and word=free collide in bucket 6. With signed hashing, one contributes -1 and the other +1. The collision still loses identity, but opposite signs reduce systematic positive bias and help preserve inner products in expectation.',
  };

  yield {
    state: matrixState({
      title: 'One sparse hashed row',
      rows: [{ id: 'x', label: 'sample' }],
      columns: Array.from({ length: 8 }, (_, i) => ({ id: `c${i}`, label: String(i) })),
      values: [[0, 1, 1, 1, -1, 0, 0, 0]],
      format: String,
    }),
    highlight: { active: ['x:c1', 'x:c2', 'x:c3', 'x:c4'], compare: ['x:c6'] },
    explanation: 'The sample becomes one fixed-width vector. Most entries are zero, so the physical output is usually a CSR sparse row, not a dense array. Multiple features landing in the same bucket sum. If ad=17 contributes -1 and word=free contributes +1, bucket 6 cancels to zero.',
  };

  yield {
    state: labelMatrix(
      'Why teams use hashing',
      [
        { id: 'stream', label: 'streaming' },
        { id: 'cold', label: 'new cats' },
        { id: 'huge', label: 'huge vocab' },
        { id: 'parallel', label: 'parallel' },
      ],
      [
        { id: 'win', label: 'win' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['no fit', 'no inverse'],
        ['schema stable', 'collisions'],
        ['bounded RAM', 'debug hard'],
        ['stateless', 'seed lock'],
      ],
    ),
    highlight: { active: ['stream:win', 'cold:win', 'huge:win', 'parallel:win'], removed: ['stream:cost', 'huge:cost'] },
    explanation: 'Hashing is strongest when the feature space is open-ended: text tokens, ad ids, query terms, URLs, item ids, and crossed namespaces. Because the transformer is stateless, streaming and parallel pipelines do not need a coordinated vocabulary build. The cost is observability: bucket 291137 has no natural feature name.',
  };

  yield {
    state: hashingGraph('Hashing and target encoding solve different problems'),
    highlight: { active: ['names', 'hash', 'bucket', 'csr'], compare: ['model'], found: ['raw'] },
    explanation: 'Compare this with Leakage-Safe Target Encoding. Target encoding stores label aggregates per category, so it must fight leakage and version encoder state. Feature hashing stores no label aggregates and has no fit step, so leakage risk is lower, but collision risk is higher and interpretability is worse. Many production systems use both for different columns.',
  };
}

function* collisionAudit() {
  yield {
    state: plotState({
      axes: { x: { label: 'hash buckets', min: 16, max: 4096 }, y: { label: 'collision rate', min: 0, max: 1 } },
      series: [
        { id: 'small', label: '100 feats', points: [{ x: 16, y: 0.96 }, { x: 64, y: 0.78 }, { x: 256, y: 0.32 }, { x: 1024, y: 0.09 }, { x: 4096, y: 0.02 }] },
        { id: 'large', label: '1k feats', points: [{ x: 16, y: 1.0 }, { x: 64, y: 1.0 }, { x: 256, y: 0.98 }, { x: 1024, y: 0.62 }, { x: 4096, y: 0.22 }] },
      ],
      markers: [
        { id: 'budget', x: 1024, y: 0.09, label: 'budget' },
      ],
    }),
    highlight: { active: ['small', 'large', 'budget'] },
    explanation: 'The tuning knob is the number of buckets. More buckets reduce collision pressure but increase model memory. The right width depends on active features per sample, total vocabulary, model sensitivity, and whether collisions mix harmless synonyms or hostile business features.',
    invariant: 'Hash width is a collision budget, not a cosmetic hyperparameter.',
  };

  yield {
    state: labelMatrix(
      'Signed vs unsigned hashing',
      [
        { id: 'unsigned', label: 'unsigned' },
        { id: 'signed', label: 'signed' },
        { id: 'nonneg', label: 'nonneg req' },
      ],
      [
        { id: 'effect', label: 'effect' },
        { id: 'use', label: 'use' },
      ],
      [
        ['adds only', 'counts/NB'],
        ['+ or -', 'linear/SVM'],
        ['no signs', 'chi2/NB'],
      ],
    ),
    highlight: { active: ['signed:effect'], compare: ['unsigned:effect'], found: ['nonneg:use'] },
    explanation: 'scikit-learn exposes alternate_sign for this reason. Signed hashing is similar to sparse random projection and approximately preserves inner products. Some estimators require nonnegative inputs, so teams disable signs there and pay the one-sided collision cost consciously.',
  };

  yield {
    state: auditGraph('A production hasher still needs audits'),
    highlight: { active: ['ns', 'bits', 'seed', 'sample', 'exact', 'metric', 'e-bits-sample', 'e-seed-sample'], found: ['ship'] },
    explanation: 'Stateless does not mean ungoverned. Record the namespace grammar, hash bits, seed or hash implementation, sign policy, and bucket width. Sample collisions offline by keeping a temporary exact vocabulary. Watch active bucket load and model-weight concentration after launch.',
  };

  yield {
    state: labelMatrix(
      'Encoding decision table',
      [
        { id: 'onehot', label: 'one-hot' },
        { id: 'hash', label: 'hashing' },
        { id: 'target', label: 'target enc' },
        { id: 'embed', label: 'embed' },
        { id: 'native', label: 'native cat' },
      ],
      [
        { id: 'best', label: 'best when' },
        { id: 'risk', label: 'watch' },
      ],
      [
        ['small cats', 'wide'],
        ['open vocab', 'collide'],
        ['label signal', 'leak'],
        ['huge data', 'cost'],
        ['GBDT lib', 'details'],
      ],
    ),
    highlight: { active: ['hash:best', 'target:best'], compare: ['onehot:risk', 'embed:risk', 'native:risk'] },
    explanation: 'There is no universal categorical encoder. One-hot is clean for small categories. Hashing is good for open vocabularies and streaming. Target encoding is strong when category label rates matter. Embeddings need enough data and training budget. Native categorical tree handling can be better than external preprocessing when the library supports it well.',
  };

  yield {
    state: auditGraph('Complete case: ad-ranking online learner'),
    highlight: { active: ['ns', 'bits', 'seed', 'sample', 'metric', 'ship'], compare: ['exact'] },
    explanation: 'An ad-ranking learner receives publisher_id, campaign_id, query terms, device, geography, and crossed features such as campaign x device. The vocabulary changes every minute. Hashing keeps memory fixed and lets workers learn online without waiting for a central dictionary. The audit path samples collisions, keeps namespaces stable, and raises bucket width when important crosses start colliding too often.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'hashing trick') yield* hashingTrick();
  else if (view === 'collision audit') yield* collisionAudit();
  else throw new InputError('Pick a feature-hashing view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many useful features are names, not numbers. A text classifier sees tokens and character n-grams. An ad model sees campaign ids, publisher ids, search terms, geographies, devices, and crossed features such as campaign x device. A fraud model sees merchant ids, email domains, IP prefixes, and behavioral tags. The model needs a numeric vector, but the raw input is an open-ended set of strings.',
        'The clean textbook answer is one-hot encoding. Give every feature name its own column, put a one in that column when the feature appears, and train a linear model or tree model on the resulting sparse rows. That works when the vocabulary is small, closed, and fitted before training. It breaks when new feature names arrive every minute or when the dictionary itself is too large to coordinate across workers.',
        'Feature hashing, also called the hashing trick, removes the fitted dictionary. Each feature name is hashed directly into a fixed number of buckets. The vector width is chosen before training, and new names do not change the schema. That turns a high-cardinality vocabulary problem into a collision-budget problem.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a vocabulary map: `feature name -> column id`. A fitted encoder scans the training data, assigns stable ids, and transforms each row into sparse column updates. This gives excellent debuggability. If model weight 10432 is large, the team can ask the dictionary which feature owns column 10432.',
        'A dictionary also supports inverse transforms, feature importance reports, schema checks, and explicit handling of rare categories. For small data and regulated explanations, this is often the right answer. The obvious approach is not naive. It is clear, testable, and easy to inspect.',
        'The cost appears when the feature space is open. A central dictionary must be built, shipped, versioned, and kept consistent between training and serving. Unknown categories need fallback logic. Parallel workers can disagree if they see features in different orders. The dictionary can become larger than the model. In online learning, the model may need to score a feature name before any batch encoder has learned it.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is coordination and memory. A vocabulary for one million features is manageable. A vocabulary for hundreds of millions of tokens, ids, and crosses becomes a system in its own right. It must be stored in training, loaded in serving, migrated when it changes, and kept aligned with model weights. A simple preprocessing step becomes a distributed schema dependency.',
        'The wall is also cold start. In ads, search, recommendations, and security, the newest features can be the most important ones. A new campaign, query, exploit string, or merchant id should not be invisible just because the dictionary was fitted yesterday. Unknown buckets help, but they collapse many different new names into one fallback column.',
        'Feature hashing pays a different tax. It does not store a vocabulary, so it cannot preserve exact identity. Two feature names can hash to the same bucket. Once that happens, their values are summed and the model sees one column. The design question becomes: how many buckets do we need, how harmful are collisions in this domain, and how do we audit them?',
      ],
    },
    {
      heading: 'The core mechanism',
      paragraphs: [
        'For each active feature, build a stable string name such as `token=free`, `city=nyc`, or `campaign=17|device=ios`. Compute `index = hash(name) mod n_features`. Add the feature value to that bucket. If signed hashing is enabled, compute a second sign from the name and add either `+value` or `-value`.',
        'The output is usually sparse. A row with twenty active names should not allocate a dense vector with a million entries. It is stored as index-value pairs or as a CSR sparse row. Multiple feature names that land in the same bucket are summed. If `ad=17` contributes `-1` and `word=free` contributes `+1` to the same bucket, the row contribution can cancel to zero.',
        'The namespace prefix is part of the data structure. `city=Paris` and `token=Paris` should normally be different names before hashing. Crossed features should also be explicit, such as `campaign=17|device=ios`. If teams hash bare values, unrelated fields collide more often and debugging becomes harder.',
      ],
    },
    {
      heading: 'Why signed hashing helps',
      paragraphs: [
        'Unsigned hashing has one-sided collision noise. If two positive-count features collide, their values add. That can inflate dot products and make unrelated examples look more similar than they should. The model may learn a weight for a bucket that mixes several unrelated signals, and every collision pushes in the same positive direction.',
        'Signed hashing makes collision noise closer to zero mean. One hash chooses the bucket; another hash chooses `+1` or `-1`. Colliding features still lose identity, but their accidental contribution can cancel instead of always adding. This is why signed feature hashing is often described as a sparse random projection. It approximately preserves inner products in expectation when the hash function behaves well and the bucket count is large enough.',
        'Signs are not always allowed. Some estimators and similarity measures require nonnegative inputs. Naive Bayes and chi-square feature selection are common examples. In those cases, teams disable alternate signs and accept the one-sided collision cost. The sign policy is not cosmetic. It is part of the model contract and must match the downstream estimator.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a row contains six active features: `user=42`, `ad=17`, `city=ny`, `word=free`, `word=sale`, and `ad=17|city=ny`. With eight buckets, the names might map to buckets 3, 6, 1, 6, 4, and 2. If signs are enabled, `ad=17` might contribute `-1` to bucket 6 while `word=free` contributes `+1` to the same bucket.',
        'The final sparse row stores the bucket sums. Bucket 1 gets `+1`, bucket 2 gets `+1`, bucket 3 gets `+1`, bucket 4 gets `-1`, and bucket 6 gets zero because the two colliding values canceled. A real system would use far more than eight buckets, but the small example shows the invariant: vector width is fixed, active names become bucket updates, and identity is lost at collisions.',
        'The same idea scales to a streaming ad-ranking learner. New campaigns and query terms appear continuously. Every worker can hash them into the same fixed vector without waiting for a central vocabulary build. Online learning can update model weights immediately. The audit path keeps sampled exact vocabularies offline so engineers can inspect which important names collide.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Runtime is linear in the number of active features in the row. Each feature requires a hash, a modulo or bit mask, an optional sign hash, and an addition to a sparse accumulator. The model memory is proportional to the number of buckets, not the number of distinct feature names ever seen. That is the main win.',
        'Collision pressure depends on active names, total distinct names, namespaces, and bucket count. If the number of buckets doubles, model memory roughly doubles and collisions generally fall. If the active feature space doubles while bucket count stays fixed, collisions rise. The right width is a budget decision: enough buckets to keep harmful collisions rare, but not so many that the model becomes too large or slow.',
        'The hidden constant is debugging. A vocabulary-based model can explain a column directly. A hashed model needs extra instrumentation: sampled reverse maps, collision reports, bucket load histograms, model-weight concentration checks, and comparisons against exact encoders on smaller corpora. Stateless preprocessing shifts cost from serving coordination to observability.',
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        'Record the namespace grammar, hash function, seed if any, bucket width, sign policy, and value normalization. These choices must be versioned with the model. Changing bucket width changes every column. Changing the hash implementation or sign policy also changes every column. A model trained under one hashing contract cannot safely serve under another.',
        'Run collision audits before launch. Keep a temporary exact vocabulary on samples, hash it, and measure bucket load, high-value collisions, namespace collisions, and collisions involving features with large labels or large learned weights. After launch, watch active bucket count, empty rows, p95 transform time, prediction drift, and whether important buckets concentrate too much weight.',
        'Use separate prefixes for fields and crosses. Decide how to handle missing values. Normalize text before hashing so equivalent strings do not split across buckets. Keep training and serving tokenization identical. If the model uses feature values other than one, document whether values are counts, tf-idf-like weights, continuous numbers, or binary indicators.',
      ],
    },
    {
      heading: 'Where it wins and where it fails',
      paragraphs: [
        'Feature hashing wins in open-vocabulary, high-cardinality, streaming, and parallel settings. Text classification, online advertising, search ranking, recommendations, telemetry models, spam detection, and large categorical linear models are natural fits. The access pattern is sparse and append-only: many names appear, most rows activate only a small subset, and the system values fixed schema over perfect identity.',
        'It is the wrong tool when exact feature identity is mandatory. Legal explanations, billing logic, permissions, user-facing audit trails, and high-stakes debugging may require a reversible dictionary. It is also risky when adversaries can choose feature names and exploit predictable collisions. A stable public hash can become an attack surface if one bucket carries a valuable learned weight.',
        'Hashing also does not replace all categorical encoders. One-hot encoding is better for small closed vocabularies. Target encoding can be stronger when category label rates matter, but it must fight leakage. Learned embeddings can capture richer relationships when there is enough data and training budget. Native categorical handling in gradient-boosted trees can be better than external hashing when the library supports it well.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources and useful anchors: scikit-learn FeatureHasher at https://scikit-learn.org/stable/modules/generated/sklearn.feature_extraction.FeatureHasher.html, scikit-learn HashingVectorizer at https://scikit-learn.org/stable/modules/generated/sklearn.feature_extraction.text.HashingVectorizer.html, the scikit-learn feature extraction guide at https://scikit-learn.org/stable/modules/feature_extraction.html, and Feature Hashing for Large Scale Multitask Learning at https://arxiv.org/abs/0902.2206.',
        'Study Hash Table for the basic indexing primitive, Count Sketch for signed frequency estimation, Count-Min Sketch and Conservative Count-Min Sketch for collision-biased approximate counts, Compressed Sparse Row Graph for sparse row storage, Feature Store for production feature contracts, FTRL-Proximal Online CTR for online linear models, Leakage-Safe Target Encoding for the contrasting label-aware encoder, and Tabular Feature-Basis Orientation Primer for the wider categorical-feature map.',
      ],
    },
  ],
};
