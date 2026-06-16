// On-device personalization state: keep a global base model stable while local
// adapters, caches, and evaluation ledgers adapt to each device.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'on-device-personalization-adapter-cache-case-study',
  title: 'On-Device Personalization Adapter Cache Case Study',
  category: 'AI & ML',
  summary: 'An on-device personalization case study: global base model, local adapter cache, privacy boundary, federated evaluation, tuning tasks, rollback ledger, and stale-state eviction.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['adapter cache', 'personal eval'], defaultValue: 'adapter cache' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function personalizationGraph(title) {
  return graphState({
    nodes: [
      { id: 'server', label: 'srv', x: 1.0, y: 1.0, note: 'base' },
      { id: 'base', label: 'base', x: 3.0, y: 1.0, note: 'v42' },
      { id: 'device', label: 'device', x: 5.0, y: 1.0, note: 'local' },
      { id: 'adapter', label: 'adapter', x: 7.3, y: 1.0, note: 'small' },
      { id: 'cache', label: 'cache', x: 7.3, y: 3.6, note: 'state' },
      { id: 'eval', label: 'eval', x: 4.7, y: 5.3, note: 'metric' },
      { id: 'upload', label: 'upload', x: 2.0, y: 4.0, note: 'agg' },
    ],
    edges: [
      { id: 'e-server-base', from: 'server', to: 'base', weight: 'ship' },
      { id: 'e-base-device', from: 'base', to: 'device', weight: 'install' },
      { id: 'e-device-adapter', from: 'device', to: 'adapter', weight: 'tune' },
      { id: 'e-adapter-cache', from: 'adapter', to: 'cache', weight: 'save' },
      { id: 'e-device-eval', from: 'device', to: 'eval', weight: 'score' },
      { id: 'e-eval-upload', from: 'eval', to: 'upload', weight: 'stats' },
      { id: 'e-upload-server', from: 'upload', to: 'server', weight: 'secure sum' },
    ],
  }, { title });
}

function* adapterCache() {
  yield {
    state: personalizationGraph('Global base model installs on device'),
    highlight: { active: ['server', 'base', 'device', 'e-server-base', 'e-base-device'], compare: ['adapter', 'cache'] },
    explanation: 'On-device personalization usually starts with a shared base model. The device receives the stable base, then keeps personalization state local so the product can adapt without uploading raw user data.',
  };
  yield {
    state: labelMatrix(
      'Local state cache',
      [
        { id: 'base', label: 'base' },
        { id: 'adapter', label: 'adapt' },
        { id: 'stats', label: 'stats' },
        { id: 'policy', label: 'policy' },
      ],
      [
        { id: 'stored', label: 'stored' },
        { id: 'scope', label: 'scope' },
      ],
      [
        ['hash', 'global'],
        ['small wts', 'local'],
        ['counts', 'local'],
        ['ttl', 'review'],
      ],
    ),
    highlight: { active: ['adapter:stored', 'stats:stored'], found: ['adapter:scope', 'stats:scope'], compare: ['base:scope'] },
    explanation: 'The cache separates global model identity from local personalization state: adapter weights, calibration statistics, recency counters, or small rank updates. Versioning and TTLs prevent stale personalization from surviving base-model changes.',
    invariant: 'Personal state has a scope, version, and eviction policy.',
  };
  yield {
    state: personalizationGraph('Adapter updates stay local unless a federated task asks for aggregate stats'),
    highlight: { active: ['device', 'adapter', 'cache', 'e-device-adapter', 'e-adapter-cache'], compare: ['upload', 'e-upload-server'] },
    explanation: 'A device can tune an adapter locally for prediction. If the product runs federated evaluation or training, only approved aggregate statistics or secure-aggregated updates should leave the device.',
  };
  yield {
    state: labelMatrix(
      'Rollback ledger',
      [
        { id: 'base', label: 'base' },
        { id: 'adapt', label: 'adapt' },
        { id: 'ttl', label: 'ttl' },
        { id: 'bad', label: 'bad run' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'action', label: 'action' },
      ],
      [
        ['hash ok', 'keep'],
        ['schema ok', 'load'],
        ['fresh', 'keep'],
        ['regress', 'purge'],
      ],
    ),
    highlight: { found: ['base:action', 'adapt:action', 'ttl:action'], removed: ['bad:action'] },
    explanation: 'Personalization state can hurt users if it is stale, incompatible, or learned from bad signals. The cache needs rollback, TTLs, schema checks, and per-device disable flags.',
  };
}

function* personalEval() {
  yield {
    state: personalizationGraph('Federated evaluation scores local personalization'),
    highlight: { active: ['eval', 'upload', 'e-device-eval', 'e-eval-upload', 'e-upload-server'], found: ['adapter'], compare: ['server'] },
    explanation: 'Federated evaluation lets the server compare base-only predictions with personalized predictions without exporting raw examples. The server receives aggregate metrics, not per-user logs.',
  };
  yield {
    state: plotState({
      axes: { x: { label: 'personal gain', min: -5, max: 15 }, y: { label: 'client share', min: 0, max: 40 } },
      series: [
        { id: 'hist', label: 'gain bins', points: [{ x: -3, y: 4 }, { x: 0, y: 16 }, { x: 3, y: 30 }, { x: 7, y: 24 }, { x: 12, y: 8 }] },
      ],
      markers: [
        { id: 'hurt', x: -3, y: 4, label: 'hurt' },
        { id: 'win', x: 7, y: 24, label: 'win' },
      ],
    }),
    highlight: { active: ['hist', 'win'], compare: ['hurt'] },
    explanation: 'Personalization should be measured as a distribution, not a single average. Some devices improve, some do not, and some regress. The release gate needs slice metrics and rollback rules.',
  };
  yield {
    state: labelMatrix(
      'Evaluation packet',
      [
        { id: 'base', label: 'base' },
        { id: 'pers', label: 'pers' },
        { id: 'slice', label: 'slice' },
        { id: 'priv', label: 'priv' },
      ],
      [
        { id: 'metric', label: 'metric' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['loss', 'baseline'],
        ['gain', 'ship?'],
        ['regress', 'block'],
        ['agg only', 'ok'],
      ],
    ),
    highlight: { active: ['pers:metric', 'slice:metric'], found: ['priv:gate'], removed: ['slice:gate'] },
    explanation: 'The packet compares base and personalized metrics, checks slice regressions, and verifies that only approved aggregate metrics left the device.',
  };
  yield {
    state: labelMatrix(
      'Release modes',
      [
        { id: 'off', label: 'off' },
        { id: 'local', label: 'local' },
        { id: 'fed', label: 'fed' },
        { id: 'block', label: 'block' },
      ],
      [
        { id: 'when', label: 'when' },
        { id: 'state', label: 'state' },
      ],
      [
        ['cold', 'base only'],
        ['safe win', 'cache'],
        ['learn glob', 'secure sum'],
        ['regress', 'purge'],
      ],
    ),
    highlight: { found: ['local:state', 'fed:state'], removed: ['block:state'], compare: ['off:state'] },
    explanation: 'A mature system has more than one switch. It can run base-only, local-only personalization, federated tuning, or block personalization for slices where evaluation regresses.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'adapter cache') yield* adapterCache();
  else if (view === 'personal eval') yield* personalEval();
  else throw new InputError('Pick an on-device personalization view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'On-device personalization keeps a shared base model stable while local state adapts to one device. The local state might be an adapter, calibration table, rank update, recency counter, or small cache of user-specific statistics.',
        'This is a data-structure problem because the personalized state needs identity, scope, TTL, schema version, rollback metadata, and privacy policy. Without those fields, personalization becomes sticky state that is hard to audit or remove.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The server ships a base model. The device tunes local state on local examples and stores it in a versioned cache. Prediction combines base model plus local adapter. Federated evaluation can compare base-only and personalized behavior using aggregate metrics.',
        'Federated training may update the global model, while local personalization may remain private to the device. A clean design separates those two loops so a local personalization bug does not become a global model bug.',
      ],
    },
    {
      heading: 'Case study',
      paragraphs: [
        'A speech recognition feature ships base model v42. Devices learn a small local adapter from recent corrections. The cache stores adapter schema, base hash, TTL, and a rollback flag. A federated evaluation task compares word error rate with and without the adapter, then uploads only secure-aggregated slice metrics.',
        'The aggregate result shows improvement for most devices but regression for one locale on older hardware. The release gate keeps personalization enabled for passing slices and disables it for the failing slice while the team investigates.',
      ],
    },
    {
      heading: 'Why it matters',
      paragraphs: [
        'Personalization can improve relevance without centralizing raw examples, but it can also preserve bad local state, reinforce bias, or silently hurt rare slices. The adapter cache makes those decisions inspectable.',
        'It also connects product quality to privacy. If the device uploads only aggregate evaluation metrics under a federated task, the product can learn whether personalization works without exporting raw user data.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Do not let local adapters survive base-model incompatibility. Do not average personalized metrics into one number without slice checks. Do not upload raw correction logs just to debug personalization. Do not ship local state without a purge path.',
        'Do not confuse personalization with federated learning. A system can personalize entirely locally, train globally through FL, or do both with separate state and evaluation ledgers.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Apple Federated Evaluation and Tuning for On-Device Personalization at https://machinelearning.apple.com/research/federated-personalization, Google Federated Evaluation of On-device Personalization at https://research.google/pubs/federated-evaluation-of-on-device-personalization/, FedPer at https://arxiv.org/abs/1912.00818, and TensorFlow Federated at https://www.tensorflow.org/federated. Study Federated Client Cohort Sampler, Secure Aggregation Dropout Recovery, Differential Privacy SGD, Feature Store, and Training-Serving Skew Replay Diff next.',
      ],
    },
  ],
};
