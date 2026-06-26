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
    explanation: `One-hot encoding needs a vocabulary map: feature name -> column id. Feature hashing removes that fitted dictionary — the ${7}-node pipeline shows each feature name hashed directly to a fixed column, optionally with a second sign bit. The output is a sparse row that can feed linear models, online learners, text classifiers, and large ad-ranking systems.`,
    invariant: `The vector width is fixed before training across ${7} pipeline stages; new feature names do not change the schema.`,
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
    explanation: `Here ${TOKEN_ROWS.length} features are hashed — ad=17 and word=free collide in bucket 6. With signed hashing, one contributes -1 and the other +1. The collision still loses identity, but opposite signs reduce systematic positive bias and help preserve inner products in expectation.`,
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
    explanation: `The sample becomes one fixed-width vector of ${8} buckets. Most entries are zero, so the physical output is usually a CSR sparse row, not a dense array. Multiple features landing in the same bucket sum. If ad=17 contributes -1 and word=free contributes +1, bucket 6 cancels to zero.`,
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
    explanation: `Hashing is strongest when the feature space is open-ended — the ${4}-row table shows why: text tokens, ad ids, query terms, URLs, item ids, and crossed namespaces. Because the transformer is stateless, streaming and parallel pipelines do not need a coordinated vocabulary build. The cost is observability: bucket 291137 has no natural feature name.`,
  };

  yield {
    state: hashingGraph('Hashing and target encoding solve different problems'),
    highlight: { active: ['names', 'hash', 'bucket', 'csr'], compare: ['model'], found: ['raw'] },
    explanation: `Compare this with Leakage-Safe Target Encoding. The ${7}-node pipeline shows how feature hashing stores no label aggregates and has no fit step, so leakage risk is lower than target encoding, but collision risk is higher and interpretability is worse. Many production systems use both for different columns.`,
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
    explanation: `The tuning knob is the number of buckets. The plot shows ${2} series across ${5} bucket widths from 16 to 4096. More buckets reduce collision pressure but increase model memory. The right width depends on active features per sample, total vocabulary, model sensitivity, and whether collisions mix harmless synonyms or hostile business features.`,
    invariant: `Hash width is a collision budget across ${5} tested widths, not a cosmetic hyperparameter.`,
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
    explanation: `scikit-learn exposes alternate_sign for this reason. The ${3}-row comparison shows signed hashing is similar to sparse random projection and approximately preserves inner products. Some estimators require nonnegative inputs, so teams disable signs there and pay the one-sided collision cost consciously.`,
  };

  yield {
    state: auditGraph('A production hasher still needs audits'),
    highlight: { active: ['ns', 'bits', 'seed', 'sample', 'exact', 'metric', 'e-bits-sample', 'e-seed-sample'], found: ['ship'] },
    explanation: `Stateless does not mean ungoverned. The ${7}-node audit graph with ${8} edges shows the full governance loop: record namespace grammar, hash bits, seed or hash implementation, sign policy, and bucket width. Sample collisions offline by keeping a temporary exact vocabulary. Watch active bucket load and model-weight concentration after launch.`,
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
    explanation: `There is no universal categorical encoder. The ${5}-row decision table compares one-hot, hashing, target encoding, embeddings, and native categorical support. Each wins in different regimes — hashing is good for open vocabularies and streaming, while target encoding is strong when category label rates matter.`,
  };

  yield {
    state: auditGraph('Complete case: ad-ranking online learner'),
    highlight: { active: ['ns', 'bits', 'seed', 'sample', 'metric', 'ship'], compare: ['exact'] },
    explanation: `An ad-ranking learner receives publisher_id, campaign_id, query terms, device, geography, and crossed features such as campaign x device. The vocabulary changes every minute. Hashing keeps memory fixed across ${7} audit-pipeline nodes and lets workers learn online without waiting for a central dictionary. The audit path samples collisions, keeps namespaces stable, and raises bucket width when important crosses start colliding too often.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization walks through two views. The hashing trick view takes a set of named features, hashes each name into a fixed-width bucket array, and shows how values accumulate with optional sign flips. The collision audit view replays the same process but highlights which buckets receive more than one name, so you can see where identity is lost.',
        {type: 'image', src: './assets/gifs/feature-hashing-signed-projection-primer.gif', alt: 'Animated walkthrough of the feature hashing signed projection primer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'Each step labels the feature name, its computed bucket index, the sign (+1 or -1), and the running bucket total. Watch for collisions: when two names land in the same bucket, their values merge and neither name can be recovered from the result alone.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Machine learning models need numbers. But many of the most useful inputs are names, not numbers. A text classifier sees word tokens. An ad-ranking model sees campaign ids, publisher ids, search queries, device types, and combinations like campaign-times-device. A fraud detector sees merchant ids, email domains, and IP prefixes. All of these are strings drawn from an open-ended, ever-growing set.',
        {
          type: 'callout',
          text: 'Feature hashing trades a growing dictionary for a fixed collision budget: schema stays stable, but identity can merge inside buckets.',
        },
        'The standard solution is one-hot encoding: assign every distinct name its own column, put a 1 in that column when the name appears, and feed the resulting sparse row to the model. That works when the vocabulary is small and known ahead of time. It breaks when new names arrive every second, the vocabulary is too large to fit in memory, or multiple training workers need to agree on the same column assignments without coordination.',
        'Feature hashing removes the dictionary entirely. Each name is hashed straight into a fixed number of buckets. The vector width is chosen once before training and never changes, no matter how many new names appear. The price is collisions: two different names can land in the same bucket and their values merge. The engineering question shifts from "how do we manage a growing vocabulary" to "how many buckets keep collision damage acceptable."',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a vocabulary map. Scan all training data, assign each unique feature name a column id, and store the mapping in a dictionary. During training and serving, look up each name and write its value into the corresponding column. This gives perfect debuggability: if model weight 10432 is large, you look up column 10432 in the dictionary and find the exact feature name responsible.',
        'A dictionary also supports inverse transforms, feature importance reports, schema validation, and explicit handling of rare or unknown categories. For small, closed vocabularies in regulated settings, this is often the right answer. It is not naive; it is clear, testable, and fully reversible.',
        'The cost shows up when the feature space is open. The dictionary must be built, stored, shipped to every serving replica, versioned alongside the model, and kept perfectly consistent between training and inference. Unknown names need fallback logic. Parallel workers that see features in different orders can disagree on column assignments. In online learning, the model may need to score a name it has never seen before any batch encoder has run.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is coordination. A vocabulary of one million entries is manageable. A vocabulary of hundreds of millions of tokens, ids, and feature crosses becomes a distributed system of its own. It must be stored during training, loaded at serving time, migrated when it changes, and kept aligned with model weights across every replica. A preprocessing step that was supposed to be simple has become a schema dependency with its own failure modes.',
        'The wall is also cold start. In advertising, search, recommendations, and security, the newest features are often the most predictive. A new campaign id, a new exploit string, or a new merchant should not be invisible to the model just because the dictionary was fitted yesterday. A single unknown-category fallback column collapses every unseen name into one signal, which is barely better than dropping it.',
        'Feature hashing pays a different tax. It stores no vocabulary, so it cannot preserve exact identity. Two names that hash to the same bucket have their values summed, and the model sees one column where there should be two. The design question becomes: how many buckets keep harmful collisions rare, and how do you audit the ones that remain.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A hash function already maps arbitrary strings to integers. If you take that integer modulo a fixed number of buckets, you get a column index, and you never needed a dictionary at all. The mapping is deterministic: the same string always lands in the same bucket, on every machine, without coordination. New strings get bucket assignments automatically. The schema never changes.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Hash_table_4_1_1_0_0_1_0_LL.svg/250px-Hash_table_4_1_1_0_0_1_0_LL.svg.png',
          alt: 'Hash function mapping names into a small bucket range with a collision',
          caption: 'Feature hashing uses the same bucket mapping idea as a hash table, except collisions become model input rather than lookup chains. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Hash_table_4_1_1_0_0_1_0_LL.svg',
        },
        'The collision that makes a hash table slow makes a feature vector noisy instead. In a hash table, two keys in the same slot trigger a chain or probe. In feature hashing, two names in the same bucket have their values added together, and the model trains on the sum. The model can still learn useful weights, because most buckets hold only one active name in any given row, and the noise from occasional collisions averages out over many training examples.',
        'Adding a sign hash turns the scheme into a sparse random projection. A second hash function assigns each name a sign of +1 or -1 before adding its value to the bucket. When two names collide, their contributions can cancel instead of always reinforcing. This makes the expected collision noise zero-mean, which preserves inner products between feature vectors in expectation. The formal justification comes from the Johnson-Lindenstrauss lemma: random projections into enough dimensions approximately preserve distances.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with a row of active features. Each feature has a string name and a numeric value. The name is usually prefixed with a namespace, such as `token=free`, `city=nyc`, or `campaign=17|device=ios`. The namespace prevents unrelated fields from colliding more than necessary: `city=Paris` and `token=Paris` should hash differently because their prefixes differ.',
        'For each feature, compute `bucket = hash(name) mod n_buckets`. If signed hashing is enabled, compute `sign = sign_hash(name)`, which returns +1 or -1. Add `sign * value` to the accumulator at position `bucket`. If multiple names land in the same bucket, their signed values sum.',
        'The output is a sparse vector. A row with twenty active names out of a million possible buckets should not allocate a dense million-element array. Store only the nonzero bucket indices and their accumulated values, as index-value pairs or a compressed sparse row. The downstream model receives this sparse vector exactly as it would receive a one-hot-encoded row, except the column meanings are defined by hash outputs rather than a dictionary.',
        'Crossed features are explicit strings. To capture the interaction between campaign 17 and device ios, build the name `campaign=17|device=ios` and hash it as a single string. The cross occupies its own bucket, separate from the individual features, and the model can learn a weight for the combination. This is how Vowpal Wabbit and similar systems handle feature interactions without combinatorial explosion in the vocabulary.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument rests on sparsity and cancellation. In a typical row, only a small fraction of all possible feature names are active. If the bucket count is much larger than the number of active names per row, most buckets hold zero or one active name, and collisions are rare per-row even if they are common across the full dataset.',
        'Signed hashing strengthens the argument. Without signs, every collision adds a positive value to the bucket, biasing the dot product upward and making unrelated rows look more similar. With signs, the expected contribution of a collision is zero: the colliding name adds +value half the time and -value half the time, depending on its sign hash. Over many training examples, the noise cancels and the model converges to weights close to what it would learn with an exact dictionary.',
        'The formal backing is the Johnson-Lindenstrauss lemma. It guarantees that a random projection from high-dimensional space into a lower-dimensional space preserves pairwise distances within a factor of (1 plus or minus epsilon), provided the target dimension is at least O(log(n) / epsilon-squared). Signed feature hashing is a sparse, structured instance of this projection: the hash function plays the role of the random matrix, and each row projects into the bucket space.',
        'Signs are not always legal. Estimators that require nonneg inputs, such as Naive Bayes or chi-squared feature selection, cannot use sign-flipped values. In those cases, disable the sign hash and accept one-sided collision noise. The sign policy is part of the model contract and must match the downstream algorithm.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Hashing one row costs O(k) time, where k is the number of active features in that row. Each feature requires one hash computation (or two, if signs are enabled), one modulo or bitmask, and one addition to a sparse accumulator. There is no dictionary lookup, no cache miss into a large table, and no coordination with other workers.',
        'Model memory is proportional to the bucket count, not the vocabulary size. A model with 2^20 (about one million) buckets stores one million weights regardless of whether the training data contains ten thousand or ten billion distinct feature names. Doubling the bucket count doubles model memory and roughly halves the collision rate. The right width is a budget decision: enough buckets to keep damaging collisions rare, few enough to keep the model small and fast.',
        'The hidden cost is observability. A vocabulary-based model lets you inspect any weight by looking up the column in the dictionary. A hashed model needs extra instrumentation: sampled reverse maps that record which names landed in which buckets, collision histograms, bucket-load reports, and comparisons against exact encoders on smaller datasets. Feature hashing trades serving-time coordination cost for monitoring-time debugging cost.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Online advertising is the canonical use case. Ad-ranking systems see billions of feature crosses (query times ad times user-segment times device times geography) with new ids arriving continuously. Vowpal Wabbit, which pioneered production feature hashing, was built for exactly this workload. Every worker hashes independently, trains online with FTRL or SGD, and the schema never needs a vocabulary update.',
        'Text classification uses HashingVectorizer in scikit-learn to convert documents into sparse bag-of-words vectors without fitting a vocabulary. This is especially useful in streaming settings where the corpus grows over time, or in distributed pipelines where different workers process different shards and must produce compatible feature vectors without sharing state.',
        'Spam detection, malware classification, intrusion detection, and recommendation systems all benefit from the same pattern: high-cardinality categorical inputs, open vocabularies, streaming data, and the need for a fixed schema that does not require retraining when new categories appear. Any domain where the vocabulary grows faster than the model can retrain is a candidate.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Feature hashing is the wrong tool when exact feature identity is mandatory. Legal explanations, regulatory audits, billing logic, and user-facing feature-importance reports need a reversible dictionary. If a stakeholder asks "which feature drove this prediction," a bucket index is not an acceptable answer.',
        'It is risky when adversaries control feature names. If the hash function is known and a high-value bucket carries a large learned weight, an attacker can craft feature names that hash to that bucket and manipulate predictions. Adversarial collision attacks are a real concern in fraud, spam, and security models that use public or predictable hash functions.',
        'It is also unnecessary for small, closed vocabularies. If the feature set has a few hundred categories that never change, one-hot encoding is simpler, fully debuggable, and introduces no collision noise. Target encoding can be stronger when category-level label rates carry signal, though it must guard against leakage. Learned embeddings capture richer relationships when there is enough data and training budget. Feature hashing earns its keep only when the vocabulary is too large, too dynamic, or too distributed for a fitted dictionary.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a row with six active features, each with value 1: `user=42`, `ad=17`, `city=ny`, `word=free`, `word=sale`, and `ad=17|city=ny`. We use 8 buckets and signed hashing. Suppose the hash function produces these bucket and sign assignments: `user=42` maps to bucket 3 with sign +1; `ad=17` maps to bucket 6 with sign -1; `city=ny` maps to bucket 1 with sign +1; `word=free` maps to bucket 6 with sign +1; `word=sale` maps to bucket 4 with sign -1; `ad=17|city=ny` maps to bucket 2 with sign +1.',
        'Walk through the accumulation. Bucket 1 receives +1 from `city=ny`. Bucket 2 receives +1 from `ad=17|city=ny`. Bucket 3 receives +1 from `user=42`. Bucket 4 receives -1 from `word=sale`. Bucket 6 receives -1 from `ad=17` and +1 from `word=free`, summing to 0. Buckets 0, 5, and 7 stay at 0. The final sparse vector is [0, +1, +1, +1, -1, 0, 0, 0]. The collision in bucket 6 erased both features from the model\'s view of this row.',
        'In production, you would use 2^18 or 2^20 buckets instead of 8, making per-row collisions extremely rare. With 2^18 buckets and 20 active features per row, the birthday-problem probability of any collision in a single row is roughly 20*19 / (2 * 262144), which is about 0.07 percent. Across the full dataset, many bucket pairs will share names, but any given row is almost always clean. Collision audits on sampled data confirm whether the important features are safe.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The foundational paper is Weinberger et al., Feature Hashing for Large Scale Multitask Learning (2009), available at https://arxiv.org/abs/0902.2206. The scikit-learn implementation is documented at https://scikit-learn.org/stable/modules/generated/sklearn.feature_extraction.FeatureHasher.html for structured features and https://scikit-learn.org/stable/modules/generated/sklearn.feature_extraction.text.HashingVectorizer.html for text. The scikit-learn feature extraction guide at https://scikit-learn.org/stable/modules/feature_extraction.html covers the broader context.',
        'Study Hash Table for the underlying bucket-mapping primitive. Count Sketch and Count-Min Sketch use related signed-hashing ideas for frequency estimation in streams. Compressed Sparse Row Graph covers the sparse storage format that feature hashing outputs typically use. FTRL-Proximal Online CTR shows the online learning algorithm most often paired with hashed features. Leakage-Safe Target Encoding is the contrasting approach that uses label statistics instead of hashing. Tabular Feature-Basis Orientation Primer maps the full landscape of categorical encoding strategies.',
      ],
    },
  ],
};
