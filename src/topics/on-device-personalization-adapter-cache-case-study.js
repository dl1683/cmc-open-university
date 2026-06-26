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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation follows one user-specific model delta from creation to rollback. A base model is the shared model shipped to every device. An adapter is a small extra set of parameters or cached statistics that changes behavior for one user without replacing the base model.',
        'Active nodes show the guard being checked now. Found nodes show personal state that is allowed to load. Removed nodes show personal state that failed a guard and must be deleted. Compare nodes show the base-only fallback path that still works when personalization is absent.',
        'Read the histogram as the release gate. A positive average can hide a harmed slice, so the system must compare base-only and base-plus-adapter results by locale, hardware class, task, and policy window before enabling a cache entry.',
        {type:'callout', text:'Personalization stays safe when the global base model remains immutable and every local adapter is treated as versioned cache state with rollback guards.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'On-device personalization exists because many useful signals are local and sensitive. A keyboard, speech recognizer, notification ranker, or photo search model learns from names, slang, corrections, habits, and private content that should not be copied to a central training log.',
        'The product still needs a shared base model because every device cannot train a full model from scratch. The base model gives general quality. The adapter adds a small personal correction layer that can be created, expired, measured, and removed on the device.',
        'The hard constraint is lifecycle control. A personal update is useful only while it matches the base model version, adapter schema, task policy, and time window it was created under. Without those guards, yesterday\'s useful personalization becomes hidden state that can degrade tomorrow\'s model.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to fine-tune the whole model on the device. If the user corrects speech recognition output or chooses certain keyboard suggestions, train every weight locally and keep the improved model for future predictions.',
        'That approach is reasonable in a small experiment. A 30 million parameter model can improve on one user after local examples, and no raw examples need to leave the device. The demo looks clean because it ignores upgrades, storage budgets, rollback, and fleet-wide evaluation.',
        'A second obvious approach is to upload user examples and retrain centrally. That makes evaluation and deployment easier, but it moves the most sensitive data to the server. For many consumer products, that violates the privacy goal that made on-device learning attractive.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is version drift. A device can train a full local model against base version 42, then receive base version 43 with changed internal representations. The personal weights still load, but they were learned for a different source model.',
        'The failure is not a clean crash. The model can keep producing predictions while quality falls for a subset of users. Support cannot reproduce the failure because each device has a different training history, and the server cannot inspect the private examples that created it.',
        'Full fine-tuning also makes rollback too expensive. If the local model is 120 MB and personalization regresses, the product must either redownload the full model or leave the broken state in place. The system needs a smaller unit of personal state that can be invalidated independently.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat personalization as a cache entry, not as a new model. The base model is immutable and identified by a content hash. The adapter is a small derived artifact with metadata: base hash, schema version, task, locale, hardware tier, creation time, time-to-live, training window, last evaluation result, and rollback reason.',
        'That metadata is the data structure. It lets the runtime ask whether this adapter is still valid for this base model and this policy. If any guard fails, the device deletes the adapter and uses the base model alone.',
        'The key move is monotonic fallback. Personalization is an improvement layer, never a dependency for correctness. Removing it may reduce user-specific quality, but prediction still works because the base model remains a tested standalone artifact.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The server publishes a base model with a content hash. The device verifies the hash, installs the model, and collects local examples such as corrections or selections. During an idle and charging window, it trains a small adapter while keeping the base weights frozen.',
        'The device writes the adapter bytes and metadata into local storage. Before every load, the runtime checks the base hash, schema version, time-to-live, policy tag, and last evaluation result. The checks run before inference so stale state cannot silently attach to a new base model.',
        'Evaluation is separate from training. Each device can compute base-only and base-plus-adapter metrics locally, then send aggregate numbers through a privacy-preserving evaluation path. The server enables or blocks adapter loading by slice, not by raw user content.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is an invariant. An adapter may affect prediction only if its recorded base hash, schema, task policy, and freshness window match the installed runtime. Each load either preserves that invariant or deletes the adapter before it can run.',
        'The base-only fallback bounds harm. If evaluation says an adapter hurts a slice, or if metadata no longer matches, deleting the adapter returns the device to the known base model. The system does not need to prove that every adapter helps forever; it needs to prove that invalid adapters are not used.',
        'Slice evaluation closes the loop. The server should not approve personalization from a global mean because a strong win on high-end devices can hide a loss on low-end devices. Correct release behavior depends on the distribution of gains across cohorts.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Storage cost falls because the device stores a delta rather than another full model. If a base model is 120 MB and an adapter is 2 MB, ten personalized tasks cost about 20 MB instead of 1.2 GB. The metadata is tiny, but it controls whether the bytes are safe to use.',
        'Compute cost moves to the user device. Training 1,000 local examples might take 20 seconds of CPU time and several joules of energy, so the scheduler should defer work until the device is idle, charging, and cool. Doubling the training window usually doubles local training work unless the recipe subsamples examples.',
        'The hidden cost is governance. Each task needs a cache schema, guard order, expiry policy, storage quota, evaluation metric, and rollback path. A small adapter without those rules is cheaper only until it becomes untraceable state.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The pattern fits keyboards, speech recognition, notification ranking, photo search, local recommendations, and accessibility settings. These systems share a strong global model while allowing local behavior to adapt to private repeated patterns.',
        'It is strongest when the base model is already good enough to stand alone. The adapter should nudge behavior, not rescue a weak base model. Small deltas are easier to store, validate, expire, and delete.',
        'It also fits feature caches that are not neural adapters. A user dictionary, phrase-frequency table, calibration vector, or local concept cluster can use the same lifecycle: derive locally, label with the source version, evaluate, expire, and purge.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails at cold start. A new user or rarely used feature may not provide enough examples for a useful adapter. Activating personalization too early can memorize noise and make the product feel less stable.',
        'It fails for tasks that require central consistency. Fraud detection, malware classification, and safety policy cannot let each user privately tune away global protections. Those tasks need shared rules and audited deployment, not local adaptation.',
        'It fails when privacy and debugging are confused. Keeping raw examples local is not enough if crash logs, diagnostics, or evaluation packets leak adapter contents or user text. The outbound protocol must be part of the design.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A speech app ships base model v42 with hash sha256:a1b2. Device A records 900 local correction events, then trains a 1.5 MB adapter with a 7 day time-to-live. The adapter entry says baseHash sha256:a1b2, schemaVersion 3, locale en-US, hardwareTier mid, trainingWindow 900, and rollbackReason null.',
        'A federated evaluation round compares word error rate on 40,000 devices. For en-US mid-tier devices, base-only WER is 8.4 percent and base-plus-adapter WER is 7.6 percent, so the slice gains 0.8 percentage points. For en-US low-tier devices, base-only WER is 9.2 percent and adapter WER is 9.5 percent, so the slice loses 0.3 points.',
        'The release gate enables adapter loading for the mid-tier slice and blocks it for the low-tier slice. If base v43 ships with hash sha256:c9d0, Device A fails the base-hash guard and deletes the v42 adapter. The user loses personalization until a new adapter is trained, but the app still predicts with the v43 base model.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary references include Apple and Google work on federated evaluation for on-device personalization, TensorFlow Federated documentation, LoRA for low-rank adaptation, and federated personalization papers such as FedPer. Read them for the difference between local adaptation, federated evaluation, and federated training.',
        'Study Feature Store next for versioned feature contracts, Secure Aggregation for private metric collection, Differential Privacy SGD for privacy during global training, and Cache Invalidation for the general rule behind base-hash and time-to-live guards.',
      ],
    },
  ],
};
