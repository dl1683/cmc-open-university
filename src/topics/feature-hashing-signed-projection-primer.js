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
      heading: 'What it is',
      paragraphs: [
        'Feature hashing, also called the hashing trick, turns symbolic feature names into a fixed-width numeric vector without storing a fitted vocabulary. A feature name such as token=free, merchant=42, or campaign=17 is hashed to a column index. Its value is added to that column, optionally multiplied by a sign hash. The result is usually a sparse matrix row.',
        'This is a data-structure decision disguised as preprocessing. One-hot encoding keeps an explicit dictionary from feature names to columns. Feature hashing replaces that dictionary with a hash function and accepts collisions as the price of bounded memory, streaming compatibility, and stable schema.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For each feature, compute index = hash(name) mod n_features. If alternate signs are enabled, compute sign(name) as +1 or -1 and add sign * value to that bucket. Multiple features in one sample that land in the same bucket are summed. scikit-learn documents this as a stateless transformer that emits a CSR sparse matrix; its implementation uses MurmurHash3 and recommends power-of-two feature counts for even mapping.',
        'The signed part matters. Unsigned collisions only add positive mass, which can bias similarities and linear scores. Signed hashing makes collision noise closer to zero-mean and is related to sparse random projection. Some algorithms require nonnegative inputs, so signs are not always allowed. The choice belongs in the model contract.',
      ],
    },
    {
      heading: 'Complete case study: streaming ads',
      paragraphs: [
        'An ad-ranking system sees millions of feature names: campaign ids, publisher ids, query tokens, device types, geos, creative ids, and crossed namespaces such as campaign x device. A vocabulary build is stale before it finishes. Feature hashing lets every worker map features into the same fixed vector immediately, with no central dictionary and no schema migration when a new campaign appears.',
        'The production version still needs discipline. Namespaces must be stable, hash width must be sized from collision audits, the hash implementation and seed must be reproducible, and the model registry must record the sign policy. Debugging keeps temporary exact vocabularies on samples so engineers can inspect which feature names collide inside important buckets.',
      ],
    },
    {
      heading: 'Complete case study: text classification',
      paragraphs: [
        'A spam classifier processes an endless stream of tokens and character n-grams. CountVectorizer can build a vocabulary for a static training corpus, but a streaming classifier cannot stop the world every time a new token appears. HashingVectorizer maps tokens straight into a fixed sparse vector, making partial-fit and parallel training practical.',
        'The tradeoff is introspection. If bucket 81,377 gets a strong positive model weight, the model cannot invert that bucket back to one token without extra logging. Teams that need explanations often keep a sampled reverse map or compare with a vocabulary-based baseline on smaller data. This is the recurring pattern: hashing buys memory and streaming by weakening identity.',
      ],
    },
    {
      heading: 'Costs and pitfalls',
      paragraphs: [
        'Runtime per nonzero feature is O(1), and memory is O(n_features) for the model weights plus sparse row storage for active buckets. Collisions increase as active feature count rises relative to bucket count. Some collisions are harmless; others merge unrelated or adversarial features. Since the transformer has no fit state, it cannot compute IDF or inverse transforms by itself.',
        'Do not use feature hashing when exact feature identity is mandatory for legal explanations, billing, permissions, or user-facing debugging. Do not change hash width or sign policy without retraining. Do not mix namespaces accidentally: city=Paris and token=Paris should usually hash from different prefixed names. And do not treat collisions as always regularizing; measure them.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: scikit-learn FeatureHasher docs at https://scikit-learn.org/stable/modules/generated/sklearn.feature_extraction.FeatureHasher.html, scikit-learn feature extraction docs at https://scikit-learn.org/stable/modules/feature_extraction.html, scikit-learn HashingVectorizer docs at https://scikit-learn.org/stable/modules/generated/sklearn.feature_extraction.text.HashingVectorizer.html, Feature Hashing for Large Scale Multitask Learning at https://arxiv.org/abs/0902.2206, and Vowpal Wabbit hashing documentation at https://vowpalwabbit.org/docs/vowpal_wabbit/python/9.6.0/tutorials/cmd_linear_regression.html. Study Hash Table, Count Sketch, Count-Min Sketch, Compressed Sparse Row Graph, Sparse Autoencoder Feature Dictionary Case Study, FTRL-Proximal Online CTR Case Study, Leakage-Safe Target Encoding Case Study, and Tabular Feature-Basis Orientation Primer next.',
      ],
    },
  ],
};
