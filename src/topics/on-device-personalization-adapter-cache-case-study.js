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
        'The animation has two views. The adapter-cache view traces the lifecycle of personal state from server shipment through local tuning, caching, and rollback. The personal-eval view traces how federated evaluation measures whether personalization helped without exporting raw user data.',
        'Active nodes are the current decision point. Found markers are state whose validity has been confirmed by a guard (hash check, schema match, TTL). Removed markers are state that failed a guard and must be purged. Compare markers show the fallback path the system uses when personal state is absent or invalid.',
        'In the histogram frame, the "hurt" marker at the left tail and the "win" marker at the right show why a single positive average is dangerous: the distribution, not the mean, drives the release gate.',
        {type:'callout', text:'Personalization stays safe when the global base model remains immutable and every local adapter is treated as versioned cache state with rollback guards.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A keyboard app ships a single language model to 500 million devices. Every user types different names, slang, and domain terms. The base model predicts "the" well but struggles with "Karpathy" or "doomscrolling" until it has seen that user type them.',
        'The product needs user-specific predictions without centralizing every keystroke on a server. The constraint is not just accuracy -- it is privacy, storage, battery, and the ability to undo personalization when the base model changes.',
        {
          type: 'quote',
          text: 'We evaluate personalized models using federated evaluation: each device computes metrics locally, and only aggregated, anonymized metrics are sent to the server.',
          attribution: 'Apple Machine Learning Research, "Federated Evaluation and Tuning for On-Device Personalization" (2024)',
        },
        'On-device personalization solves this by keeping a small personal delta on the device and a shared base model under central control. The delta is not a second model. It is a cache entry with a lifecycle: creation, validation, expiry, rollback, and deletion.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first attempt is straightforward: fine-tune the entire model on each device. The user types, the model updates its weights, and predictions improve. No server round-trip, no privacy concern, no coordination overhead.',
        'This works in a research notebook. A 30M-parameter model fine-tuned on 10,000 local examples converges in a few minutes on a modern phone GPU. The word error rate drops. The demo looks great.',
        {
          type: 'table',
          headers: ['Approach', 'Storage per user', 'Update cost', 'Rollback'],
          rows: [
            ['Full fine-tune', '120 MB (full weights)', '~3 min GPU', 'Re-download entire model'],
            ['Adapter cache', '0.5-4 MB (delta only)', '~10 sec CPU', 'Delete one cache entry'],
          ],
        },
        'The fine-tuning approach treats personalization as a model problem. But in production it is a state-management problem. The model changes underneath. The user changes behavior. The policy changes what data can be retained. A full fine-tune has no seams where these changes can be absorbed without starting over.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The server ships base model v42. A device fine-tunes it locally for three weeks. The server ships base model v43 with a safety patch and changed hidden representations. The device now has a v42-based fine-tune running on top of v43 weights.',
        {
          type: 'diagram',
          text: 'server ships v42 --> device fine-tunes --> 3 weeks pass\nserver ships v43 --> device loads v43 + v42-tuned weights\n                     ^^^ hidden representations changed\n                     predictions: UNDEFINED BEHAVIOR',
          label: 'Version mismatch: the fine-tune was trained against representations that no longer exist',
        },
        'The result is not a clean error. It is silently wrong predictions. The model still produces output. The user sees worse suggestions but cannot diagnose why. Support cannot reproduce the issue because every device has a different fine-tune history. Rolling back means re-downloading 120 MB and losing all personalization.',
        'The invariant that must hold: personal state is valid only for the exact base model version, schema, and policy window it was created under. Full fine-tuning destroys this invariant because the personal state is entangled with the base weights -- there is no seam where you can check compatibility or discard the personal part alone.',
        {
          type: 'note',
          text: 'This is not a theoretical risk. Google reported that representation drift between federated rounds was a primary source of training instability in production keyboard models, requiring explicit staleness checks before applying client updates.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate the stable part from the personal part at a clean interface. The base model is an immutable artifact identified by a content hash. The personal state is a small adapter -- a LoRA-style low-rank update, a bias vector, a calibration table, or a feature-frequency cache -- stored as a cache entry with explicit metadata.',
        {
          type: 'code',
          language: 'javascript',
          text: '// The cache entry is the critical data structure\nconst adapterCacheEntry = {\n  adapterBytes: Uint8Array,    // the personal delta (0.5-4 MB)\n  baseHash:     "sha256:a1b2", // which base model this was trained against\n  schemaVersion: 3,            // adapter wire format version\n  task:         "next-word",   // which prediction task owns this\n  locale:       "en-US",       // partition key for slice evaluation\n  hwTier:       "mid",         // hardware class (affects training budget)\n  createdAt:    1718700000,    // unix timestamp\n  ttlSeconds:   604800,        // 7 days -- expire if not refreshed\n  trainingWindow: 5000,        // number of local examples used\n  lastEvalGain: 0.03,          // WER improvement vs base-only\n  rollbackReason: null,        // set if evaluation disables this entry\n  purged:       false,         // hard delete marker\n};',
        },
        'The key property: if any guard fails -- base hash mismatch, schema incompatibility, TTL expiry, evaluation regression, or policy revocation -- the system deletes the cache entry and falls back to the base model. Prediction still works. The user loses personalization temporarily, not the entire feature.',
        'This is the same pattern as HTTP cache validation. An ETag (base hash) and max-age (TTL) govern whether cached state can be reused. A cache miss is not an error; it is a fallback to the origin (base model).',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The system operates as a seven-node pipeline with two scopes: global (server-controlled) and local (device-controlled). The animation walks through each transition.',
        {
          type: 'diagram',
          text: 'GLOBAL SCOPE                    LOCAL SCOPE\n+---------+    ship    +------+    install    +--------+    tune    +---------+\n| server  | ---------> | base | -----------> | device | --------> | adapter |\n+---------+            +------+              +--------+           +---------+\n     ^                                           |                     |\n     |                                         score                  save\n     |                                           v                     v\n     |    secure sum   +--------+   stats    +-------+            +---------+\n     +<--------------- | upload | <--------- | eval  |            |  cache  |\n                       +--------+            +-------+            +---------+',
          label: 'The personalization pipeline: global state flows right, evaluation flows left, personal state stays right',
        },
        {
          type: 'table',
          headers: ['Transition', 'What changes', 'What stays true', 'Guard'],
          rows: [
            ['ship', 'Server publishes base model with content hash', 'Hash is immutable once published', 'Version monotonicity'],
            ['install', 'Device receives base model', 'Device has exact same weights as server', 'Hash verification'],
            ['tune', 'Device trains adapter on local examples', 'Base weights are frozen; only adapter updates', 'Training budget limit'],
            ['save', 'Adapter + metadata written to cache', 'Cache entry records base hash and schema', 'Storage quota check'],
            ['score', 'Device computes base-only and base+adapter metrics', 'Raw examples never leave the device', 'Privacy policy tag'],
            ['stats', 'Aggregate metrics sent to evaluation server', 'Per-user data is not in the packet', 'Secure aggregation or DP noise'],
            ['secure sum', 'Server aggregates metrics across devices', 'No individual device is identifiable', 'Minimum cohort size'],
          ],
        },
        'Each transition has a guard. The system is correct when every guard holds. A single guard failure triggers fallback, not crash: the device drops the adapter and uses the base model until a new valid cache entry can be built.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on three properties:',
        {
          type: 'bullets',
          items: [
            'Compatibility: the adapter is valid only when its recorded base hash matches the installed base model hash. A base model update automatically invalidates all adapters trained against the old version.',
            'Monotonic fallback: removing the adapter always produces a valid prediction (base-only). Personalization is an improvement layer, never a dependency. The base model is tested and shipped as a standalone artifact.',
            'Bounded staleness: the TTL and training-window fields prevent adapters from accumulating unbounded drift. An adapter trained on 5,000 examples from three weeks ago cannot silently persist for months.',
          ],
        },
        'Together these properties give the system a conservation law: the worst-case prediction quality is always at least as good as the base model. Personalization can only improve on this floor or be removed. It cannot degrade below it, because any degradation triggers the rollback guard.',
        {
          type: 'note',
          text: 'This is analogous to the "safe policy improvement" guarantee in reinforcement learning: the new policy is deployed only if evaluation confirms it outperforms the baseline, and the baseline remains available as a fallback.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A speech recognition app ships base model v42 (content hash sha256:a1b2). On Device A (en-US, mid-tier hardware), the user corrects "call Karpathy" three times. The device trains a small adapter -- a rank-4 LoRA update to the decoder attention layers, 1.2 MB -- and writes a cache entry:',
        {
          type: 'code',
          language: 'text',
          text: 'Cache entry for Device A:\n  baseHash:       sha256:a1b2\n  schemaVersion:  3\n  task:           speech-asr\n  locale:         en-US\n  hwTier:         mid\n  trainingWindow: 847 corrections\n  ttlSeconds:     604800 (7 days)\n  lastEvalGain:   +4.1% WER improvement\n  rollbackReason: null',
        },
        'The product team runs a federated evaluation round. 50,000 devices each compute two word-error-rate scores: base-only and base+adapter. Each device sends only the pair of aggregate WER numbers -- not the raw utterances, not the corrections, not the adapter weights.',
        {
          type: 'table',
          headers: ['Slice', 'Devices', 'Base WER', 'Personal WER', 'Gain', 'Gate'],
          rows: [
            ['en-US, mid-tier', '18,200', '8.3%', '7.1%', '+1.2%', 'PASS'],
            ['en-US, low-tier', '9,400', '9.1%', '9.4%', '-0.3%', 'BLOCK'],
            ['en-GB, mid-tier', '6,800', '8.7%', '7.9%', '+0.8%', 'PASS'],
            ['es-MX, mid-tier', '4,100', '11.2%', '10.5%', '+0.7%', 'PASS'],
            ['en-US, accessibility', '1,200', '10.4%', '10.1%', '+0.3%', 'PASS (watch)'],
          ],
        },
        'The en-US low-tier slice regresses. The release gate enables personalization for passing slices, blocks adapter loading for the regressing slice (those devices fall back to base-only), and flags the low-tier training recipe for investigation. The base model is unchanged throughout -- no global rollback needed.',
      ],
    },
    {
      heading: 'Federated evaluation versus federated training',
      paragraphs: [
        'These are two different loops that share infrastructure but have different risk profiles.',
        {
          type: 'table',
          headers: ['Property', 'Federated evaluation', 'Federated training'],
          rows: [
            ['Question', 'Did personalization help?', 'Should device updates change the global model?'],
            ['Data leaving device', 'Aggregate metrics only', 'Clipped gradient updates'],
            ['Server action', 'Enable/block per slice', 'Update global model weights'],
            ['Failure blast radius', 'One slice loses personalization', 'All devices get a worse base model'],
            ['Privacy mechanism', 'Secure aggregation of scalars', 'Secure aggregation + DP noise + clipping'],
            ['Frequency', 'Every release candidate', 'Periodic training rounds'],
          ],
        },
        'A clean architecture separates these loops. Local personalization can run indefinitely with only federated evaluation as oversight. Federated training is a separate, higher-risk decision that changes the shared base model and requires stronger privacy guarantees (differential privacy budgets, client sampling, norm clipping).',
        {
          type: 'note',
          text: 'Google Gboard uses federated evaluation to gate local personalization features and federated training (FedAvg with DP) to improve the global model. These are independent systems with independent approval processes.',
        },
      ],
    },
    {
      heading: 'The rollback ledger',
      paragraphs: [
        'The animation shows four guards that run before an adapter is loaded from cache. Each guard produces a binary keep/purge decision.',
        {
          type: 'table',
          headers: ['Guard', 'Check', 'Pass action', 'Fail action'],
          rows: [
            ['Base hash', 'Does the adapter baseHash match the installed model hash?', 'Keep adapter', 'Purge -- trained against wrong representations'],
            ['Schema version', 'Does the adapter wire format match the current runtime?', 'Load adapter', 'Purge -- bytes would be misinterpreted'],
            ['TTL', 'Is createdAt + ttlSeconds > now?', 'Keep adapter', 'Expire -- drift risk too high'],
            ['Evaluation', 'Did the last eval show gain >= 0 for this slice?', 'Keep adapter', 'Purge -- personalization is hurting this user'],
          ],
        },
        'Guards run in order of cost: the hash check is a string comparison (nanoseconds), schema is an integer comparison, TTL is a timestamp comparison, and evaluation requires reading the last metric summary. If any guard fails, subsequent guards are skipped and the adapter is purged.',
        {
          type: 'code',
          language: 'javascript',
          text: 'function shouldLoadAdapter(entry, installedBaseHash, currentSchema, now) {\n  if (entry.purged) return { load: false, reason: "already purged" };\n  if (entry.baseHash !== installedBaseHash)\n    return { load: false, reason: "base hash mismatch" };\n  if (entry.schemaVersion !== currentSchema)\n    return { load: false, reason: "schema incompatible" };\n  if (entry.createdAt + entry.ttlSeconds < now)\n    return { load: false, reason: "TTL expired" };\n  if (entry.rollbackReason !== null)\n    return { load: false, reason: entry.rollbackReason };\n  return { load: true, reason: null };\n}',
        },
        'This is the same guard chain used in certificate validation (expiry, issuer, revocation) and HTTP caching (ETag, max-age, no-cache). The pattern is general: cached derived state needs explicit validity checks against the source it was derived from.',
      ],
    },
    {
      heading: 'Privacy boundary',
      paragraphs: [
        'Keeping an adapter on-device is necessary but not sufficient for privacy. The critical question is what leaves the device, and through which channel.',
        {
          type: 'table',
          headers: ['Outbound artifact', 'Content', 'Privacy risk', 'Mitigation'],
          rows: [
            ['Aggregate WER pair', 'Two floating-point numbers', 'Low -- no user content', 'Secure aggregation, minimum cohort'],
            ['Clipped gradient update', 'Model delta vector', 'Medium -- can leak memorized tokens', 'Norm clipping + DP noise'],
            ['Crash diagnostic', 'Stack trace, adapter metadata', 'Medium -- reveals adapter state', 'Strip user-content fields'],
            ['Raw corrections log', 'Exact user utterances', 'Critical -- full user content', 'Never export; process locally only'],
            ['Debug replay', 'Input/output pairs', 'Critical -- full user content', 'Synthetic repro only'],
          ],
        },
        'The cache entry carries a policy tag that names which federated tasks can read which fields. An evaluation task can read the metric summary. A training task can read the adapter bytes. A debug task can read the rollback reason. No task can read raw user examples unless the user explicitly opts in.',
        'Debuggability must be designed into the local lifecycle. If the only way to diagnose adapter failures is to upload raw examples, the architecture will drift toward centralization under engineering pressure. Local summaries, synthetic reproduction cases, and cohort-level metrics keep the system inspectable without exporting personal content.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Resource', 'Budget', 'Constraint', 'Failure mode'],
          rows: [
            ['Storage', '0.5-4 MB per adapter', 'Device storage quota', 'Evict oldest or lowest-gain entry'],
            ['Training compute', '10-60 sec CPU per update', 'Battery and thermal budget', 'Defer training to charging + idle'],
            ['Inference latency', '+2-8 ms per forward pass', 'User-perceptible delay threshold', 'Skip adapter if latency budget exceeded'],
            ['Evaluation bandwidth', '~100 bytes per eval packet', 'Secure aggregation round cost', 'Batch with other telemetry'],
            ['Cache metadata', '~200 bytes per entry', 'Negligible', 'N/A'],
          ],
        },
        'The dominant cost is training compute, not storage. A rank-4 LoRA update to a 100M-parameter model adds about 400K trainable parameters (0.4% of the model). Training on 1,000 local examples takes 10-30 seconds of CPU time. This must be scheduled during idle+charging windows to avoid draining the battery during active use.',
        'Staleness is the non-obvious cost. An adapter trained against base v42 has zero value after base v43 ships -- the representations it was trained against no longer exist. If the base model updates monthly and the adapter TTL is 7 days, the expected number of wasted training cycles is low. If the base updates weekly, the TTL must shrink or training must be deferred until the next base version stabilizes.',
        {
          type: 'note',
          text: 'Fairness is a hidden cost. If only power users generate enough local examples to build useful adapters, personalization widens the quality gap between heavy and light users. Slice-level evaluation gates must track not just mean improvement but the distribution of gain across user segments.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The adapter-cache pattern appears wherever the signal is personal, sensitive, and locally abundant:',
        {
          type: 'table',
          headers: ['Product', 'Base model', 'Personal adapter', 'Cache key'],
          rows: [
            ['Gboard next-word prediction', 'Global language model', 'LoRA on decoder, trained on local typing', 'base hash + locale + device tier'],
            ['iOS autocorrect', 'Shared spelling/grammar model', 'User dictionary + correction frequency table', 'base version + app version'],
            ['Siri speech recognition', 'Shared ASR model', 'Accent/name adapter trained on corrections', 'base hash + locale + hw class'],
            ['Smart Compose (Gmail)', 'Global suggestion model', 'Per-user phrase frequency cache', 'model version + account age'],
            ['On-device photo search', 'Shared CLIP-style embedding model', 'Personal concept clusters from local photos', 'model hash + gallery size tier'],
            ['Notification ranking', 'Global priority model', 'Per-user app interaction history features', 'model version + notification policy'],
          ],
        },
        'The pattern is strongest when the base model is good enough to stand alone and the adapter only needs to nudge behavior. The smaller the personal delta, the easier it is to store, validate, expire, and delete. A 1 MB adapter with a 7-day TTL is operationally trivial. A 50 MB fine-tune with no expiry is operationally dangerous.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Cold start: a new user or rarely used feature lacks enough local signal to train a useful adapter. The adapter memorizes noise instead of preferences. Mitigation: require a minimum training window before activating personalization.',
            'Global coordination: fraud detection, safety classifiers, and content policy cannot be personalized privately. A user who trains an adapter to suppress fraud warnings creates risk for other users. These tasks need central control, not local adaptation.',
            'Ungoverned persistence: an adapter without a TTL, base-hash check, or evaluation gate becomes invisible sticky state. After a base model update, the stale adapter produces silently wrong predictions that support cannot reproduce or fix.',
            'Adversarial poisoning: a malicious user can deliberately feed bad corrections to degrade their own adapter, then report the degraded output as a product bug. The rollback ledger must distinguish evaluation-detected regression from user-reported issues.',
            'Resource contention: background training on a phone competes with foreground apps for CPU, GPU, memory, and thermal budget. A training job that looks cheap in a lab benchmark can trigger thermal throttling during a video call.',
          ],
        },
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Define the cache entry schema: adapter bytes, base hash, schema version, task, locale, hardware tier, TTL, training window, last eval gain, rollback reason, purge flag, policy tag.',
            'Implement the guard chain: base hash match, schema compatibility, TTL check, evaluation gate. Guards run in cost order; first failure triggers fallback.',
            'Schedule training during idle+charging windows. Enforce a maximum training budget (wall-clock seconds, not epochs) to prevent battery drain.',
            'Set a storage quota per task. If the quota is exceeded, evict the adapter with the lowest evaluation gain.',
            'Run federated evaluation before enabling personalization for a new base model version. Gate on per-slice metrics, not just the global mean.',
            'Tag every outbound packet with a policy label. Audit the pipeline to ensure raw user content never leaves the device unless the user explicitly opts in.',
            'Implement a per-device disable flag. If a user reports degraded quality, support can disable personalization for that device without uninstalling the app.',
            'Log adapter lifecycle events (create, load, expire, purge, rollback) locally for on-device diagnostics. Do not export these logs by default.',
          ],
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'Role', 'Key contribution'],
          rows: [
            ['Apple, "Federated Evaluation and Tuning for On-Device Personalization" (2024)', 'Primary reference', 'Defines the federated evaluation loop for gating on-device personalization'],
            ['Google, "Federated Evaluation of On-device Personalization" (2024)', 'Production case study', 'Reports evaluation methodology for Gboard keyboard personalization'],
            ['Arivazhagan et al., "FedPer: Federated Learning with Personalization Layers" (2019)', 'Algorithmic foundation', 'Separates base layers (federated) from personalization layers (local)'],
            ['TensorFlow Federated documentation', 'Implementation reference', 'Provides concrete APIs for federated evaluation and secure aggregation'],
            ['Hu et al., "LoRA: Low-Rank Adaptation of Large Language Models" (2021)', 'Adapter architecture', 'Defines the low-rank adapter format used in most on-device personalization'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: study Feature Store to understand how feature versioning and schema evolution work in production ML systems.',
            'Extension: study Secure Aggregation Dropout Mask Recovery to understand how the privacy guarantees in the evaluation loop are implemented.',
            'Related case study: study Federated Client Cohort Sampler to understand how devices are selected for evaluation and training rounds.',
            'Contrasting pattern: study Differential Privacy SGD to see how privacy guarantees change when the goal shifts from evaluation (measuring) to training (updating the global model).',
          ],
        },
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        {
          type: 'diagram',
          text: 'Feature Store -----> [this topic] -----> Secure Aggregation\n                          |                   Dropout Mask Recovery\n                          |\n                          +-----> Federated Client\n                          |       Cohort Sampler\n                          |\n                          +-----> Differential\n                                  Privacy SGD',
          label: 'Prerequisite, extensions, and related case studies',
        },
        'Before this topic: understand feature versioning (Feature Store) and basic federated learning concepts. After this topic: the natural next step is the privacy infrastructure that makes federated evaluation trustworthy (secure aggregation, differential privacy) or the client selection mechanism that determines which devices participate in evaluation rounds.',
      ],
    },
    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'State the adapter cache invariant in one sentence. (An adapter is valid only for the base hash, schema version, policy, and time window recorded in its cache entry.)',
            'Trace what happens when the server ships base v43 to a device with a v42 adapter. (The base-hash guard fails, the adapter is purged, the device falls back to base-only prediction.)',
            'Name one failure that a global mean metric hides. (A positive average can mask regression in a low-tier hardware slice or a minority locale.)',
            'Transfer this pattern to a non-ML domain. (Browser service workers cache API responses with ETags and max-age; a cache miss falls back to the network origin, just as an invalid adapter falls back to the base model.)',
          ],
        },
      ],
    },
    {
      heading: 'Try this now',
      paragraphs: [
        'Sketch a cache entry for a notification-ranking adapter. Define the base hash (which model version), the training window (how many interaction events), the TTL (how long before the adapter is stale), and the evaluation metric (what "improvement" means for notification ranking). Then predict what the rollback ledger would do if the user installs a base model update.',
        'Run the adapter-cache animation and verify that your rollback prediction matches the purge step. Then switch to the personal-eval view and identify which slice in the histogram would block your adapter from shipping.',
      ],
    },
  ],
};

