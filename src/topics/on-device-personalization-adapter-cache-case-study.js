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
    explanation: 'The graph separates two state scopes. The base model is shipped globally; the adapter and cache are local device state. That boundary lets personalization improve relevance while the server still has a stable fallback and a clear privacy rule.',
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
    explanation: 'The cache is not just a pile of weights. It stores local adapter state with a base hash, schema, counters, TTL, and policy scope so stale or incompatible personalization can be evicted.',
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
    explanation: 'The histogram is a release-risk picture. The average can be positive while the left tail is harmed, so the gate needs slice metrics, minimum-slice thresholds, and rollback rules before enabling personalization broadly.',
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
      heading: 'Why This Exists',
      paragraphs: [
        'On-device personalization adapts a product to one user or one device without turning every private example into server-side training data. The global base model stays shared. The local device stores a small amount of personal state that changes predictions for that user.',
        'The personal state can be a neural adapter, a calibration table, a small rank update, a recency feature cache, a preference embedding, a correction counter, or a rule overlay. The common requirement is lifecycle control: the state must be versioned, scoped, evaluated, expired, rolled back, and purged.',
        'This is not only an ML idea. It is a state-management pattern. If the adapter cache lacks a base-model hash, schema version, TTL, policy label, metric history, and disable flag, personalization becomes invisible sticky state that can keep hurting a user after the server thinks a bad release was fixed.',
      ],
    },
    {
      heading: 'Core Insight: Local Delta, Governed Lifecycle',
      paragraphs: [
        'The server ships a base model with an immutable version, for example base v42. The device installs that base and may create a local adapter keyed by base hash, task, locale, hardware class, app version, and policy scope.',
        'At inference time the product combines base plus local state. The adapter may adjust a decoder, rank suggestions, bias an embedding search, calibrate probabilities, or remember recent corrections. The base model remains a stable fallback. If the adapter is missing, expired, incompatible, or disabled, prediction still works.',
        'The core insight is to treat personalization as a small local delta with a lifecycle, not as a hidden fork of the model. The invariant is simple: a personal adapter is valid only for the base model, schema, policy, and time window named in its cache record.',
        'The cache entry is the critical data structure. A useful entry stores adapter bytes or compact statistics, the compatible base hash, schema version, training window, feature policy, creation time, TTL, last-evaluation summary, rollback reason, and a purge marker. Those fields make the state auditable instead of merely local.',
      ],
    },
    {
      heading: 'Why A Cache Instead Of A Fine-Tuned Model',
      paragraphs: [
        'Shipping a separate fine-tuned model per user is usually too large, too expensive, and too hard to govern. A small adapter cache keeps most model quality in the shared base while letting the device carry only the personal delta.',
        'The cache also gives the product a clean escape hatch. If a base model update changes hidden representations, old adapters can be invalidated by hash or schema. If a device enters a bad local loop, the adapter can be disabled without uninstalling the whole model. If policy changes, entries with the old policy tag can be purged.',
        'Local state should remain optional. Personalization should improve the result when the cache is healthy, not become a new dependency that breaks the base feature when it is absent.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'The pattern works because it keeps the stable part and the personal part under separate ownership. The base model can be evaluated, rolled out, and supported as a shared product artifact. The adapter can adapt quickly because it is small, scoped, and disposable.',
        'Correctness is a lifecycle claim rather than a theorem about model quality. A prediction is safe to personalize only when the adapter matches the installed base hash, passes schema checks, remains inside its TTL, and has not been disabled by evaluation or policy. If any guard fails, the system falls back to the base model.',
        'This separation also makes failures easier to repair. A bad global model update can invalidate adapters by base hash. A bad personalization recipe can purge local state without uninstalling the app. A privacy policy change can deny export from cache fields that were never meant to leave the device.',
      ],
    },
    {
      heading: 'Worked Case Study',
      paragraphs: [
        'A speech recognition feature ships base model v42. On each device, recent corrections train a small local adapter that improves names, domain words, and accent-specific patterns. The cache entry includes the base hash, adapter schema, correction window, locale, hardware tier, TTL, and a metric summary.',
        'The product runs a federated evaluation task. Each device scores base-only recognition and base-plus-adapter recognition on local examples. The server receives only approved aggregate metrics, preferably through a secure aggregation path, not raw utterances or per-user correction logs.',
        'The average word error rate improves, but one locale on older hardware regresses. A mature release gate does not ship on the average alone. It enables personalization for passing slices, blocks or purges the failing slice, and keeps the global base unchanged while the team investigates the adapter recipe.',
      ],
    },
    {
      heading: 'Federated Evaluation Versus Federated Training',
      paragraphs: [
        'Federated evaluation asks a measurement question: did personalization help on devices, slices, and tasks that matter? The device computes metrics locally, and the server aggregates them under privacy and policy constraints.',
        'Federated training asks an optimization question: should device-computed updates change a shared model? That loop may use secure aggregation, client sampling, clipping, differential privacy, and server-side optimizers. It is heavier and riskier because bad client updates can affect everyone.',
        'A clean system keeps these loops separate. Local personalization can stay entirely on device. Federated evaluation can measure whether it is safe. Federated training can improve future global models only when the update policy, privacy budget, and release gates justify it.',
      ],
    },
    {
      heading: 'Evaluation Gates',
      paragraphs: [
        'The most dangerous personalization metric is a single positive average. A personalized model can help frequent users while hurting new users, help one locale while hurting another, or improve aggregate click-through while increasing privacy-sensitive mistakes.',
        'Good gates compare base-only and personalized behavior by slice: locale, device class, accessibility mode, account age, data sparsity, app version, hardware tier, and policy cohort. They also track left-tail harm, not only mean improvement.',
        'The gate should produce an action: keep, expire, purge, disable for a slice, require more data, or promote a new recipe. Metrics that do not connect to cache actions are observability, not control.',
      ],
    },
    {
      heading: 'Privacy Boundary',
      paragraphs: [
        'The privacy promise depends on what leaves the device. Keeping an adapter local is useful, but it is not magic. Uploading raw corrections, rare phrases, exact examples, or per-device traces can undo the privacy benefit.',
        'A privacy-aware design names each outbound packet. Aggregate metric, secure-summed update, clipped gradient, differential-privacy-noised count, crash diagnostic, and debug log are different artifacts with different risks. The adapter cache should carry a policy tag that says which task is allowed to read or export which fields.',
        'Debuggability must be designed into the local lifecycle. If the only way to understand failures is to upload raw examples, the architecture will drift toward centralization under pressure. Local summaries, synthetic repro cases, cohort-level metrics, and explicit purge reasons keep the system inspectable without exporting personal content.',
      ],
    },
    {
      heading: 'Costs and Failure Modes',
      paragraphs: [
        'On-device adaptation costs CPU, battery, storage, thermal budget, and implementation complexity. A background tuning job that looks cheap in a lab can drain a low-end phone, contend with media workloads, or be killed before it commits a valid cache entry.',
        'Staleness is the next failure. An adapter trained against base v42 may be harmful on base v43. A cache trained during a temporary user behavior can overfit. A rare bad label can poison local state. A device clock bug can keep expired state alive. A schema mismatch can load bytes as the wrong adapter type.',
        'Fairness can fail quietly. If only heavy users build useful adapters, personalization can widen quality gaps. If disabled users or low-resource locales have different correction patterns, the system needs slice gates and fallback quality targets, not only aggregate improvement.',
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        'This pattern works when the signal is personal, sensitive, and locally abundant: keyboard suggestions, speech recognition corrections, ranking preferences, accessibility settings, notification timing, on-device search, private recommendation features, and local retrieval over user-owned content.',
        'It is especially strong when the base model is good enough to stand alone and the adapter only needs to nudge behavior. The smaller the local delta, the easier it is to store, invalidate, explain, and delete.',
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        'It fails when the device lacks enough local signal. A cold-start user, a rarely used feature, or a high-noise task may produce adapters that memorize accidents instead of preferences.',
        'It also fails when the product needs global coordination. Fraud rules, safety classifiers, compliance policies, and shared marketplace ranking often cannot be personalized privately without central review, because local behavior has effects on other users.',
        'A final failure is ungoverned persistence. Personal state that cannot be inspected, expired, or deleted will eventually conflict with model updates, user expectations, privacy promises, or support workflows.',
      ],
    },
    {
      heading: 'Implementation Checklist',
      paragraphs: [
        'For every local-state format, define the compatible base model, schema version, owner feature, policy tag, TTL, storage budget, training window, validation metric, rollback reason, disable flag, and purge path.',
        'For every release, compare base-only and personalized behavior by slice, track left-tail regressions, verify outbound packets against the privacy boundary, and keep a fallback that works when the adapter cache is empty or disabled.',
      ],
    },
    {
      heading: 'Sources and Study Next',
      paragraphs: [
        'Primary references: Apple Federated Evaluation and Tuning for On-Device Personalization at https://machinelearning.apple.com/research/federated-personalization, Google Federated Evaluation of On-device Personalization at https://research.google/pubs/federated-evaluation-of-on-device-personalization/, FedPer at https://arxiv.org/abs/1912.00818, and TensorFlow Federated at https://www.tensorflow.org/federated.',
        'Study Federated Client Cohort Sampler, Secure Aggregation Dropout Mask Recovery, Differential Privacy SGD, Feature Store, Training-Serving Skew Replay Diff, On-Device LLM Inference Cost Crossover, and Query Cache Stale-Time GC next.',
      ],
    },
  ],
};
