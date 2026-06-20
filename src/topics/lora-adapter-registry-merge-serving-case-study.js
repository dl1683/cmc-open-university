// LoRA in production: adapter manifests, base compatibility, merge decisions,
// per-request serving, cache residency, and rollout gates.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'lora-adapter-registry-merge-serving-case-study',
  title: 'LoRA Adapter Registry, Merge, and Serving Ledger',
  category: 'AI & ML',
  summary: 'A production LoRA case study: validate adapter manifests, match base-model hashes, choose merge or hot-swap serving, batch by adapter, and audit rollout quality.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['registry', 'merge path', 'serving'], defaultValue: 'registry' },
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

const ADAPTERS = [
  { id: 'sql', label: 'sql' },
  { id: 'legal', label: 'legal' },
  { id: 'support', label: 'support' },
  { id: 'style', label: 'style' },
];

const REQUESTS = [
  { id: 'r0', label: 'req0' },
  { id: 'r1', label: 'req1' },
  { id: 'r2', label: 'req2' },
  { id: 'r3', label: 'req3' },
  { id: 'r4', label: 'req4' },
  { id: 'r5', label: 'req5' },
];

function servingGraph(title) {
  return graphState({
    nodes: [
      { id: 'req', label: 'request', x: 0.7, y: 3.6, note: 'tenant' },
      { id: 'policy', label: 'policy', x: 2.2, y: 3.6, note: 'allow' },
      { id: 'base', label: 'base', x: 3.9, y: 2.1, note: 'frozen' },
      { id: 'reg', label: 'registry', x: 3.9, y: 5.1, note: 'manifest' },
      { id: 'cache', label: 'cache', x: 5.7, y: 5.1, note: 'adapters' },
      { id: 'apply', label: 'apply', x: 5.7, y: 2.1, note: 'W+BA' },
      { id: 'batch', label: 'batch', x: 7.4, y: 3.6, note: 'group' },
      { id: 'decode', label: 'decode', x: 9.0, y: 3.6, note: 'tokens' },
      { id: 'trace', label: 'trace', x: 10.4, y: 3.6, note: 'ledger' },
    ],
    edges: [
      { id: 'e-req-policy', from: 'req', to: 'policy', weight: 'id' },
      { id: 'e-policy-base', from: 'policy', to: 'base', weight: 'model' },
      { id: 'e-policy-reg', from: 'policy', to: 'reg', weight: 'adapter' },
      { id: 'e-reg-cache', from: 'reg', to: 'cache', weight: 'hash' },
      { id: 'e-cache-apply', from: 'cache', to: 'apply', weight: 'A,B' },
      { id: 'e-base-apply', from: 'base', to: 'apply', weight: 'W' },
      { id: 'e-apply-batch', from: 'apply', to: 'batch', weight: 'path' },
      { id: 'e-batch-decode', from: 'batch', to: 'decode', weight: 'KV' },
      { id: 'e-decode-trace', from: 'decode', to: 'trace', weight: 'metrics' },
    ],
  }, { title });
}

function* registryView() {
  yield {
    state: labelMatrix(
      'Adapter registry manifest',
      ADAPTERS,
      [
        { id: 'base', label: 'base' },
        { id: 'rank', label: 'rank' },
        { id: 'mods', label: 'mods' },
        { id: 'dtype', label: 'dtype' },
        { id: 'state', label: 'state' },
      ],
      [
        ['m7b@9f', '8', 'qv', 'fp16', 'ready'],
        ['m7b@9f', '16', 'qv,o', 'bf16', 'canary'],
        ['m7b@9f', '8', 'qv', 'fp16', 'ready'],
        ['m7b@2a', '4', 'all', 'fp16', 'block'],
      ],
    ),
    highlight: { active: ['sql:base', 'legal:base', 'support:base'], compare: ['style:base', 'style:state'], found: ['legal:state'] },
    explanation: 'A LoRA adapter is not just two tensors. The registry needs a manifest: base model identity, target modules, rank, scaling, dtype, training data lineage, safety state, and rollout status. Base hash mismatch is a hard stop.',
    invariant: 'An adapter is valid only relative to the exact base checkpoint and target module layout.',
  };

  yield {
    state: servingGraph('The request path validates adapter identity before decode'),
    highlight: { active: ['req', 'policy', 'reg', 'cache', 'e-req-policy', 'e-policy-reg', 'e-reg-cache'], compare: ['base'], found: ['trace'] },
    explanation: 'The product path starts with a tenant or task choosing an adapter ID. Policy checks that the adapter is allowed, the registry checks compatibility, and the cache loads the adapter tensors only after those checks pass.',
  };

  yield {
    state: labelMatrix(
      'Compatibility gate',
      [
        { id: 'hash', label: 'base hash' },
        { id: 'shape', label: 'shape' },
        { id: 'mods', label: 'targets' },
        { id: 'rank', label: 'rank' },
        { id: 'dtype', label: 'dtype' },
        { id: 'trust', label: 'trust' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'fail', label: 'fail' },
        { id: 'action', label: 'act' },
      ],
      [
        ['equal', 'wrong W', 'block'],
        ['match', 'bad mat', 'block'],
        ['q,v,o', 'missing', 'block'],
        ['<=cap', 'OOM', 'queue'],
        ['legal', 'cast', 'block'],
        ['sig', 'untrust', 'sand'],
      ],
    ),
    highlight: { active: ['hash:check', 'shape:check', 'mods:check'], compare: ['trust:fail'], found: ['rank:action'] },
    explanation: 'The registry gate should fail closed. If the base checkpoint hash, tensor shape, target module names, rank cap, dtype path, or trust boundary is wrong, the system blocks or sandboxes the adapter instead of trying to decode.',
  };

  yield {
    state: labelMatrix(
      'Adapter lineage packet',
      [
        { id: 'data', label: 'data' },
        { id: 'train', label: 'train' },
        { id: 'eval', label: 'eval' },
        { id: 'sign', label: 'sign' },
        { id: 'roll', label: 'rollout' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['dataset id', 'leak'],
        ['seed+rank', 'drift'],
        ['slice pass', 'blind spot'],
        ['sig+owner', 'tamper'],
        ['flag pct', 'blast'],
      ],
    ),
    highlight: { active: ['data:stores', 'train:stores', 'eval:stores', 'sign:stores'], found: ['roll:stores'], compare: ['eval:risk'] },
    explanation: 'Adapter files are small enough to multiply quickly, so governance matters. Store dataset IDs, training config, evaluation slices, signatures, owner, rollout flag, and rollback pointer with the adapter, not in a separate spreadsheet.',
  };
}

function* mergePath() {
  yield {
    state: labelMatrix(
      'Merge decision',
      [
        { id: 'single', label: 'single task' },
        { id: 'many', label: 'many tasks' },
        { id: 'quant', label: '4bit base' },
        { id: 'unsafe', label: 'untrusted' },
      ],
      [
        { id: 'path', label: 'path' },
        { id: 'why', label: 'why' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['merge', 'fast', 'copy'],
        ['hotswap', 'flex', 'cache'],
        ['keep sep', 'safe', 'dtype'],
        ['sandbox', 'policy', 'supply'],
      ],
    ),
    highlight: { active: ['single:path', 'many:path', 'quant:path'], compare: ['unsafe:path'], found: ['quant:risk'] },
    explanation: 'PEFT-style merging is attractive when one adapter becomes the only production path: fold delta W into W and unload adapter tensors. Hot-swap serving is better when many tenants share one base model or when rollback must be instant.',
  };

  yield {
    state: labelMatrix(
      'Layer merge ledger',
      [
        { id: 'qproj', label: 'q_proj' },
        { id: 'vproj', label: 'v_proj' },
        { id: 'oproj', label: 'o_proj' },
        { id: 'mlp', label: 'mlp' },
      ],
      [
        { id: 'W', label: 'W' },
        { id: 'A', label: 'A' },
        { id: 'B', label: 'B' },
        { id: 'scale', label: 'scale' },
        { id: 'out', label: 'out' },
      ],
      [
        ['fp16', '4096x8', '8x4096', 'a/r', 'W+dW'],
        ['fp16', '4096x8', '8x4096', 'a/r', 'W+dW'],
        ['fp16', '4096x8', '8x4096', 'a/r', 'W+dW'],
        ['none', '', '', '', 'skip'],
      ],
    ),
    highlight: { active: ['qproj:A', 'qproj:B', 'qproj:out', 'vproj:out', 'oproj:out'], compare: ['mlp:out'] },
    explanation: 'Merge is layer-local: compute delta W = scale * B A for each targeted module, add it to the frozen weight, then save the merged checkpoint. Modules not targeted by the adapter must be skipped explicitly.',
    invariant: 'Merge is deterministic only when base weights, adapter tensors, scale, dtype, and target modules are fixed.',
  };

  yield {
    state: servingGraph('Merged checkpoints remove adapter lookup from the hot path'),
    highlight: { active: ['base', 'apply', 'batch', 'decode', 'e-base-apply', 'e-apply-batch', 'e-batch-decode'], compare: ['reg', 'cache'], found: ['trace'] },
    explanation: 'After merge, the adapter path disappears from the decode loop. That can simplify serving and remove per-request adapter overhead, but it also creates another full checkpoint artifact to store, scan, promote, and roll back.',
  };

  yield {
    state: labelMatrix(
      'Merge audit',
      [
        { id: 'base', label: 'base' },
        { id: 'adapter', label: 'adapter' },
        { id: 'dtype', label: 'dtype' },
        { id: 'eval', label: 'eval' },
        { id: 'save', label: 'save' },
      ],
      [
        { id: 'before', label: 'before' },
        { id: 'after', label: 'after' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['m7b@9f', 'm7b@9f', 'hash'],
        ['sql@42', 'none', 'logged'],
        ['fp16', 'fp16', 'nocast'],
        ['holdout', 'pass', 'slices'],
        ['2files', 'ckpt', 'tag'],
      ],
    ),
    highlight: { active: ['base:guard', 'adapter:guard', 'eval:guard', 'save:guard'], compare: ['dtype:guard'] },
    explanation: 'A merge should leave an audit trail: input base hash, adapter hash, dtype path, evaluation result, merged checkpoint hash, and rollback pointer. Otherwise a merged model becomes provenance-free weight soup.',
  };
}

function* servingView() {
  yield {
    state: servingGraph('Hot-swap LoRA keeps one base model and many adapters'),
    highlight: { active: ['req', 'policy', 'reg', 'cache', 'apply', 'batch', 'decode'], found: ['trace'], compare: ['base'] },
    explanation: 'Hot-swap serving keeps the base model resident and applies adapter deltas per request. vLLM documents LoRA adapters on top of a base model and supports per-request adapter use; dynamic runtime adapter loading needs a trusted environment because it expands the supply-chain surface.',
  };

  yield {
    state: labelMatrix(
      'Live request batch',
      REQUESTS,
      [
        { id: 'tenant', label: 'tenant' },
        { id: 'adapter', label: 'adapter' },
        { id: 'cache', label: 'cache' },
        { id: 'lane', label: 'lane' },
      ],
      [
        ['acme', 'sql', 'hit', 'A'],
        ['city', 'legal', 'hit', 'B'],
        ['acme', 'sql', 'hit', 'A'],
        ['shop', 'support', 'miss', 'C'],
        ['shop', 'support', 'load', 'C'],
        ['lab', 'sql', 'hit', 'A'],
      ],
    ),
    highlight: { active: ['r0:adapter', 'r2:adapter', 'r5:adapter', 'r0:lane', 'r2:lane', 'r5:lane'], compare: ['r3:cache', 'r4:cache'], found: ['r1:lane'] },
    explanation: 'Serving schedulers can group requests by adapter to reuse cached A and B tensors and reduce kernel path churn. A miss is not just a file read; it can delay decode, fragment batches, and evict another adapter.',
  };

  yield {
    state: labelMatrix(
      'Adapter cache',
      ADAPTERS,
      [
        { id: 'bytes', label: 'bytes' },
        { id: 'rank', label: 'rank' },
        { id: 'hits', label: 'hits' },
        { id: 'state', label: 'state' },
      ],
      [
        ['44MB', '8', '3', 'hot'],
        ['88MB', '16', '1', 'warm'],
        ['44MB', '8', '2', 'load'],
        ['22MB', '4', '0', 'evict'],
      ],
    ),
    highlight: { active: ['sql:hits', 'sql:state', 'support:state'], compare: ['style:state'], found: ['legal:bytes'] },
    explanation: 'Adapters are small compared with the base, but a fleet can have hundreds of them. Cache policy should consider rank, size, hit rate, tenant priority, safety state, and current rollout, not just recency.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'adapters', min: 1, max: 64 }, y: { label: 'p99', min: 1.0, max: 2.8 } },
      series: [
        { id: 'naive', label: 'naive', points: [
          { x: 1, y: 1.05 }, { x: 8, y: 1.25 }, { x: 16, y: 1.55 }, { x: 32, y: 2.10 }, { x: 64, y: 2.70 },
        ] },
        { id: 'grouped', label: 'grouped', points: [
          { x: 1, y: 1.05 }, { x: 8, y: 1.12 }, { x: 16, y: 1.22 }, { x: 32, y: 1.45 }, { x: 64, y: 1.90 },
        ] },
      ],
      markers: [
        { id: 'gate', x: 32, y: 1.5, label: 'SLO' },
      ],
    }),
    highlight: { active: ['grouped', 'gate'], compare: ['naive'] },
    explanation: 'Multi-adapter serving is a scheduling problem. If every request can pick a different adapter, naive batching fragments the decode loop. Grouping by adapter and caching hot adapters protects p99 while keeping the base model shared.',
  };

  yield {
    state: labelMatrix(
      'Rollout gate',
      [
        { id: 'qual', label: 'qual' },
        { id: 'safety', label: 'safety' },
        { id: 'lat', label: 'latency' },
        { id: 'cost', label: 'cost' },
        { id: 'prov', label: 'prov' },
      ],
      [
        { id: 'metric', label: 'metric' },
        { id: 'fail', label: 'fail' },
        { id: 'act', label: 'act' },
      ],
      [
        ['holdout', 'regress', 'block'],
        ['policy', 'unsafe', 'block'],
        ['p99', 'spike', 'throt'],
        ['cache', 'evict', 'pin'],
        ['hashes', 'missing', 'block'],
      ],
    ),
    highlight: { active: ['qual:metric', 'safety:metric', 'lat:metric', 'prov:metric'], compare: ['cost:fail'], found: ['prov:act'] },
    explanation: 'An adapter rollout should fail closed on quality, safety, latency, cache pressure, and provenance. A tiny adapter can still produce a large incident if the registry lets it bypass policy or attach to the wrong base.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'registry') yield* registryView();
  else if (view === 'merge path') yield* mergePath();
  else if (view === 'serving') yield* servingView();
  else throw new InputError('Pick a LoRA serving view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as the operations pipeline for managing LoRA adapters from registration through serving. The registry view validates adapter identity before anything touches the decode path. The merge path view shows when and how an adapter becomes a permanent checkpoint. The serving view shows the runtime: per-request adapter selection, cache residency, batch grouping, and rollout gates.',
        {type:'callout', text:'The registry is the safety boundary: an adapter is a typed patch tied to one base model, not a loose weight file.'},
        'Active nodes mark the current decision boundary. Compare nodes mark the alternative path or the state being checked against. Found nodes mark outcomes that are now locked in -- a rollout promoted, a cache slot pinned, a merge committed.',
        {
          type: 'note',
          text: 'One safe inference rule: if an adapter has not passed the compatibility gate (base hash, shape, target modules, dtype, trust), it must not reach the decode path. A present file is not a valid adapter. The blocked style adapter in the registry view is the canonical negative example.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'LoRA (Low-Rank Adaptation) makes fine-tuning cheap. Instead of copying and retraining all parameters of a large model, you freeze the base weights W and train two small matrices A (d x r) and B (r x d), where r is much smaller than d. The adapted output becomes Wx + (alpha/r) * BAx. A 7-billion-parameter model produces a 40 MB adapter file instead of a 14 GB full copy.',
        'That cheapness creates volume. A company running one base model may accumulate adapters for SQL generation, legal drafting, customer support, code review, content moderation, multiple languages, A/B experiments, and per-tenant customization. Each adapter is a behavioral patch. Production needs a system that tracks which patches are valid, compatible, safe, and ready to serve.',
        {
          type: 'quote',
          attribution: 'Hu et al., LoRA: Low-Rank Adaptation of Large Language Models, 2021',
          text: 'We propose Low-Rank Adaptation, or LoRA, which freezes the pre-trained model weights and injects trainable rank decomposition matrices into each layer of the Transformer architecture, greatly reducing the number of trainable parameters for downstream tasks.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is to store adapter weight files in a bucket, name them after the task, and let each inference request specify which adapter to load. If the file exists, apply it. If a benchmark improves, promote it. If it becomes the only variant anyone uses, merge it into the base weights and delete the adapter.',
        'This works while you have one base model, a handful of adapters, one team, and no safety or tenant isolation requirements. It is not a stupid approach -- it is exactly how most LoRA tutorials end.',
        {
          type: 'bullets',
          items: [
            'Store adapter files in cloud storage with task-based naming.',
            'Load the adapter at request time by filename lookup.',
            'Promote adapters that beat benchmarks; archive ones that do not.',
            'Merge the winner into the base when the team is confident.',
          ],
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The bucket approach breaks on identity. An adapter is valid only relative to the exact base checkpoint it was trained against. Two checkpoints of "Llama-2-7B" can differ in tokenizer revision, RoPE scaling configuration, quantization state, or even layer count after architecture surgery. The adapter file loads without error, produces garbage, and nothing in the filename catches it.',
        'It breaks again on module targeting. LoRA can target q_proj and v_proj, or q_proj, k_proj, v_proj, and o_proj, or all linear layers. An adapter trained for q_proj/v_proj applied to a system expecting all-linear targeting will silently skip modules and produce subtly degraded output rather than a hard failure.',
        'It breaks a third time on scheduling. When 200 tenants can each request a different adapter, naive per-request loading fragments GPU batches, churns kernel dispatch, and turns a shared-base efficiency gain into a p99 latency disaster.',
        {
          type: 'table',
          headers: ['Failure mode', 'Symptom', 'Root cause'],
          rows: [
            ['Base hash mismatch', 'Coherent but wrong output', 'Adapter trained on different checkpoint revision'],
            ['Target module drift', 'Subtle quality degradation', 'Adapter targets fewer modules than runtime expects'],
            ['Tokenizer mismatch', 'Garbled tokens at domain boundaries', 'Vocabulary changed between base versions'],
            ['Dtype incompatibility', 'NaN or inf during forward pass', 'fp16 adapter applied to int4 quantized base without dequant path'],
            ['Cache thrashing', 'p99 latency spikes', 'Too many adapters rotating through fixed GPU memory'],
          ],
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat a LoRA adapter as a typed patch, not as a loose weight file. The type signature includes: base checkpoint hash, target module list, tensor shapes, rank, alpha scaling factor, dtype, quantization assumptions, tokenizer hash, training data lineage, evaluation record, trust boundary, and rollout state. Two adapters with different type signatures are incompatible even if both files load without error.',
        'Once the adapter carries a typed manifest, every downstream decision becomes a type check. Can this adapter attach to this base? Is it merge-safe or serve-only? Which tenants may use it? Has it passed evaluation on the required slices? The serving system stops being a creative loading problem and becomes ordinary typed dispatch.',
        {
          type: 'diagram',
          alt: 'Adapter lifecycle from training through registry validation to serving or merge.',
          body: 'train adapter (freeze W, learn A and B)\n    |\n    v\npackage: tensors + manifest (base_hash, rank, targets, dtype, eval, trust)\n    |\n    v\nregistry: validate manifest fields, check base compatibility\n    |\n    +--[fail]--> block or sandbox\n    |\n    +--[pass]--> assign rollout state (canary / ready)\n                    |\n        +-----------+-----------+\n        |                       |\n    merge path              hot-swap path\n    (fold into W,           (cache A,B tensors,\n     new checkpoint,         per-request apply,\n     audit trail)            batch by adapter)',
          text: 'train adapter (freeze W, learn A and B)\n    |\n    v\npackage: tensors + manifest (base_hash, rank, targets, dtype, eval, trust)\n    |\n    v\nregistry: validate manifest fields, check base compatibility\n    |\n    +--[fail]--> block or sandbox\n    |\n    +--[pass]--> assign rollout state (canary / ready)\n                    |\n        +-----------+-----------+\n        |                       |\n    merge path              hot-swap path\n    (fold into W,           (cache A,B tensors,\n     new checkpoint,         per-request apply,\n     audit trail)            batch by adapter)',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The registry stores adapter tensors alongside the manifest that gives them meaning. A minimal manifest contains: base_checkpoint_hash, adapter_hash, target_modules, rank, alpha, dtype, tokenizer_hash, quant_requirements, training_data_id, training_config, eval_slices, owner, signature, allowed_tenants, rollout_pct, and rollback_pointer.',
        'The compatibility gate runs six checks and fails closed on any mismatch. Base hash equality is the hardest gate -- no fuzzy matching, no "close enough." Shape validation confirms that A is (d x r) and B is (r x d) for each targeted module. Target module validation confirms the adapter covers exactly the modules the runtime expects. Dtype validation prevents silent casting between fp16, bf16, and quantized representations. Trust validation checks signatures and tenant isolation. Rank validation confirms the adapter fits within the runtime memory budget.',
        {
          type: 'code',
          language: 'javascript',
          body: '// Pseudocode: compatibility gate\nfunction validateAdapter(adapter, runtime) {\n  if (adapter.manifest.base_hash !== runtime.base_hash)\n    return { pass: false, reason: "base_hash_mismatch" };\n  for (const mod of runtime.expected_modules) {\n    if (!adapter.manifest.target_modules.includes(mod))\n      return { pass: false, reason: "missing_module:" + mod };\n    const [d, r] = adapter.shapes[mod].A;\n    if (r !== adapter.manifest.rank || d !== runtime.hidden_dim)\n      return { pass: false, reason: "shape_mismatch:" + mod };\n  }\n  if (adapter.manifest.dtype !== runtime.dtype && !runtime.cast_allowed)\n    return { pass: false, reason: "dtype_incompatible" };\n  if (!verifySignature(adapter.manifest.signature, adapter.manifest.owner))\n    return { pass: false, reason: "untrusted_signature" };\n  if (adapter.manifest.rank > runtime.max_rank)\n    return { pass: false, reason: "rank_exceeds_budget" };\n  return { pass: true };\n}',
          text: '// Pseudocode: compatibility gate\nfunction validateAdapter(adapter, runtime) {\n  if (adapter.manifest.base_hash !== runtime.base_hash)\n    return { pass: false, reason: "base_hash_mismatch" };\n  for (const mod of runtime.expected_modules) {\n    if (!adapter.manifest.target_modules.includes(mod))\n      return { pass: false, reason: "missing_module:" + mod };\n    const [d, r] = adapter.shapes[mod].A;\n    if (r !== adapter.manifest.rank || d !== runtime.hidden_dim)\n      return { pass: false, reason: "shape_mismatch:" + mod };\n  }\n  if (adapter.manifest.dtype !== runtime.dtype && !runtime.cast_allowed)\n    return { pass: false, reason: "dtype_incompatible" };\n  if (!verifySignature(adapter.manifest.signature, adapter.manifest.owner))\n    return { pass: false, reason: "untrusted_signature" };\n  if (adapter.manifest.rank > runtime.max_rank)\n    return { pass: false, reason: "rank_exceeds_budget" };\n  return { pass: true };\n}',
        },
        'Once validated, an adapter enters one of two paths: merge or hot-swap. The registry rollout field controls exposure: canary (shadow traffic or small cohort), ready (full production), or blocked (failed a gate). A rollback pointer lets the system revert to the previous adapter version without re-running the compatibility gate from scratch.',
      ],
    },
    {
      heading: 'Merge and hot-swap',
      paragraphs: [
        'Merging folds the adapter into the base weights permanently. For each targeted module, compute the delta: dW = (alpha / rank) * B @ A, then save W_new = W + dW. The result is a standard checkpoint with no adapter overhead at inference time. The cost is a new full-size artifact (14 GB for a 7B model) that needs its own storage, evaluation, promotion pipeline, and rollback path.',
        'Hot-swap serving keeps the base model frozen in GPU memory and applies adapter deltas per request. The runtime loads A and B tensors from a cache, computes the adapted output as Wx + (alpha/r) * BAx, and returns the result. This preserves instant rollback (just stop selecting the adapter) and supports many concurrent adapters on one base, but it adds cache management, batch fragmentation, and a larger attack surface from dynamic loading.',
        {
          type: 'table',
          headers: ['Factor', 'Merge', 'Hot-swap'],
          rows: [
            ['Inference latency', 'No adapter overhead', 'Small matmul per targeted layer'],
            ['Storage', 'Full checkpoint per variant', 'Base + small adapter files'],
            ['Rollback speed', 'Redeploy previous checkpoint', 'Stop selecting adapter ID'],
            ['Multi-tenant', 'One checkpoint per tenant variant', 'One base, many adapters'],
            ['Quantized base', 'Must dequantize, merge, requantize', 'Apply in adapter dtype, keep base quantized'],
            ['Provenance', 'Risk of "weight soup" without audit', 'Adapter identity preserved at runtime'],
          ],
        },
        'Quantized bases force a sharper decision. A QLoRA adapter depends on a specific quantization runtime (e.g., bitsandbytes NF4) and dtype transition path. Merging requires dequantizing the base to fp16/bf16, adding the delta, and re-quantizing -- a lossy round-trip that can degrade quality. Keeping adapters separate avoids that loss but requires the serving runtime to handle mixed-precision forward passes.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument has two parts. First, the LoRA math: because the adapter is a low-rank additive delta, applying it preserves the base model behavior on inputs outside the fine-tuning distribution. The rank r controls the capacity of the adaptation. At r = 0 the model is the frozen base; at r = d the adaptation can represent any linear transformation. Practical ranks (4, 8, 16, 32) sit in between, constraining the delta to a low-dimensional subspace that regularizes against catastrophic forgetting.',
        'Second, the registry invariant: an adapter that passes the compatibility gate produces the same output as if it had been applied during the original training run against that exact base checkpoint. Base hash equality guarantees weight compatibility. Target module validation guarantees coverage. Shape validation guarantees matmul compatibility. Dtype validation guarantees numerical stability.',
        {
          type: 'note',
          text: 'The merge operation is deterministic only when five values are fixed: base weights W, adapter matrices A and B, scaling factor alpha/r, dtype (including rounding mode), and the list of targeted modules. Changing any one produces a different merged checkpoint. This is why the merge audit must record all five.',
        },
        'The merge correctness argument is additive: W_new = W + (alpha/r) * BA. Because addition is commutative and the delta is computed independently per module, merge order across modules does not matter. But merging two adapters into the same base is not commutative in general -- the deltas interact through the forward pass even though the weight addition itself commutes. Multi-adapter merging (e.g., TIES, DARE, task arithmetic) is a separate and harder problem.',
      ],
    },
    {
      heading: 'Why batching gets hard',
      paragraphs: [
        'Multi-adapter serving turns a throughput problem into a scheduling problem. All requests share the same base weights W, so the base matmul can be batched efficiently. But each request may need different A and B tensors, which means the adapter matmul (alpha/r) * BAx is request-specific.',
        'Naive interleaving loads a different adapter for each request in the batch, fragmenting the GPU kernel dispatch. With 64 active adapters, the kernel scheduler spends more time swapping adapter state than computing. The p99 latency curve in the serving view shows this: naive batching crosses the SLO threshold around 32 adapters, while grouped batching stays under it past 64.',
        {
          type: 'code',
          language: 'javascript',
          body: '// Pseudocode: adapter-aware batch scheduler\nfunction scheduleBatch(requests, adapterCache, maxBatchSize) {\n  // Group by adapter ID to maximize tensor reuse\n  const groups = groupBy(requests, r => r.adapter_id);\n  const batches = [];\n  for (const [adapterId, reqs] of groups) {\n    const cached = adapterCache.get(adapterId);\n    if (!cached) {\n      // Cold adapter: load off critical path if possible\n      adapterCache.loadAsync(adapterId);\n      reqs.forEach(r => r.status = "queued_pending_load");\n      continue;\n    }\n    // Batch all requests sharing this adapter\n    for (let i = 0; i < reqs.length; i += maxBatchSize) {\n      batches.push({\n        adapter: cached,\n        requests: reqs.slice(i, i + maxBatchSize),\n      });\n    }\n  }\n  return batches;\n}',
          text: '// Pseudocode: adapter-aware batch scheduler\nfunction scheduleBatch(requests, adapterCache, maxBatchSize) {\n  // Group by adapter ID to maximize tensor reuse\n  const groups = groupBy(requests, r => r.adapter_id);\n  const batches = [];\n  for (const [adapterId, reqs] of groups) {\n    const cached = adapterCache.get(adapterId);\n    if (!cached) {\n      // Cold adapter: load off critical path if possible\n      adapterCache.loadAsync(adapterId);\n      reqs.forEach(r => r.status = "queued_pending_load");\n      continue;\n    }\n    // Batch all requests sharing this adapter\n    for (let i = 0; i < reqs.length; i += maxBatchSize) {\n      batches.push({\n        adapter: cached,\n        requests: reqs.slice(i, i + maxBatchSize),\n      });\n    }\n  }\n  return batches;\n}',
        },
        'The cache eviction policy matters because adapter tensors compete for the same GPU memory as KV cache. A rank-8 adapter targeting q_proj and v_proj on a 7B model uses about 44 MB. A rank-16 adapter targeting four modules uses about 176 MB. With 80 GB of GPU memory, the system might hold 50-100 adapters resident, but KV cache for long sequences can shrink that budget fast. Cache policy should weight hit rate, rank (proxy for memory), tenant priority, and rollout state -- not just LRU.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A platform runs Mistral-7B (checkpoint hash 9f3a) as its base model and serves four product lanes.',
        {
          type: 'table',
          headers: ['Adapter', 'Base hash', 'Rank', 'Targets', 'Dtype', 'Rollout state'],
          rows: [
            ['sql', '9f3a', '8', 'q_proj, v_proj', 'fp16', 'ready'],
            ['legal', '9f3a', '16', 'q_proj, v_proj, o_proj', 'bf16', 'canary'],
            ['support', '9f3a', '8', 'q_proj, v_proj', 'fp16', 'ready'],
            ['style', '2a7b', '4', 'all linear', 'fp16', 'blocked'],
          ],
        },
        'The registry admits sql and support immediately: base hash matches, shapes are correct, dtype is compatible, both have passed holdout evaluation, and both are signed by authorized owners. Legal passes compatibility checks but enters canary: it serves only to a 5% cohort while evaluation accumulates. Style is blocked at the gate because its base hash (2a7b) does not match the serving base (9f3a). The file loads without error, but the registry prevents it from reaching decode.',
        'In hot-swap mode, the scheduler groups requests: sql requests into lane A (3 requests in the current batch), legal into lane B (1 request, canary-flagged), support into lane C (2 requests, one triggering a cache load). The sql adapter is hot (3 hits, 44 MB resident). Legal is warm (1 hit, 88 MB because rank 16 targets three modules). Support is loading (cache miss on the first request, second request queued behind it). Style has zero hits and is marked for eviction to free 22 MB.',
        'After six months, sql becomes the only SQL generation path. The team runs the merge: dW_q = (alpha/8) * B_q @ A_q, dW_v = (alpha/8) * B_v @ A_v, applied to layers 0-31. The merge audit records base hash 9f3a, adapter hash 42cf, dtype fp16, holdout pass rate 94.2%, merged checkpoint hash e71d, and rollback pointer to the unmarged base + adapter pair. Without that audit, checkpoint e71d is unexplained weight soup.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The registry itself is lightweight metadata: a manifest per adapter, a compatibility check per request, and a cache index. The real costs are in what the registry enables.',
        {
          type: 'table',
          headers: ['Operation', 'Cost driver', 'Scaling behavior'],
          rows: [
            ['Adapter storage', 'rank x target_modules x hidden_dim x dtype_bytes', '~2 * r * d * num_targets * 2 bytes per adapter per layer'],
            ['Cache residency', 'GPU memory shared with KV cache', 'Linear in number of hot adapters; competes with sequence length'],
            ['Batch efficiency', 'Adapter diversity per batch', 'Degrades as unique adapters per batch increase; grouped scheduling recovers it'],
            ['Merge artifact', 'Full checkpoint size', 'Same as base model; one per merged variant'],
            ['Compatibility check', 'Hash comparison + shape validation', 'Constant per request; negligible vs. inference'],
            ['Rollout gate', 'Evaluation on holdout slices', 'Proportional to eval set size; runs once per promotion, not per request'],
          ],
        },
        'A rank-8 adapter targeting q_proj and v_proj on a 4096-hidden-dim model stores 2 * (4096 * 8) * 2 bytes per layer = 128 KB per layer. Across 32 layers, that is about 4 MB of adapter tensors. The fp16 storage doubles it to roughly 8 MB; with metadata overhead, the full adapter package is around 10-44 MB depending on target count and overhead. Compare that to the 14 GB base model: the adapter is 0.07-0.3% of the base size. That ratio is why hundreds of adapters are practical and why governance matters -- the cost of creating them is nearly zero.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Multi-tenant SaaS platforms run one base model and per-customer adapters. Each tenant gets domain-specific behavior without the cost of a dedicated model deployment. The adapter registry enforces tenant isolation: tenant A cannot select tenant B\'s adapter, and a compromised adapter cannot bypass policy to reach other tenants\' traffic.',
        'Experimentation platforms use adapters as lightweight model variants. An A/B test that would normally require deploying two full model copies instead deploys two adapter IDs against the same base, with the registry controlling traffic split and the serving trace recording which adapter produced each response.',
        'Regulated industries (healthcare, finance, legal) use the registry for audit. The manifest records training data lineage, evaluation results, and approval signatures. A regulator asking "what model produced this output?" gets a precise answer: base checkpoint 9f3a + adapter sql@42cf, trained on dataset D, evaluated on slices S1-S4, approved by owner O on date T.',
        {
          type: 'bullets',
          items: [
            'vLLM supports serving multiple LoRA adapters on a single base model with per-request adapter selection and adapter caching.',
            'Hugging Face PEFT provides the merge_and_unload() API for folding adapters into base weights, plus multi-adapter composition.',
            'Anyscale documents multi-LoRA serving with adapter-aware batching and cache management for production deployments.',
            'Amazon SageMaker supports multi-adapter inference endpoints with adapter routing based on request metadata.',
          ],
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The silent failure mode is adapter drift. The base model gets updated (new checkpoint, new tokenizer, quantization change), but old adapters are not retrained or re-evaluated. The registry still shows them as "ready" because nobody re-ran the compatibility check against the new base. The base hash check catches this if the hash actually changed, but organizations that overwrite checkpoints in place defeat the protection.',
        'Multi-adapter composition is fragile. Applying adapter A then adapter B is not the same as applying B then A, and neither is the same as merging both. Task arithmetic (adding deltas) can produce interference. TIES-Merging and DARE attempt to mitigate this, but the registry cannot guarantee that composed adapters behave as expected without evaluation of the composition itself.',
        'Dynamic loading is a supply-chain risk. If the serving system accepts adapter files from an untrusted source at runtime, a malicious adapter can alter model behavior without modifying the base checkpoint. The registry mitigates this with signatures and tenant isolation, but only if the system actually enforces those checks. A bypass in the loading path defeats the entire gate.',
        {
          type: 'table',
          headers: ['Failure', 'Trigger', 'Mitigation'],
          rows: [
            ['Adapter drift', 'Base model updated without re-evaluating adapters', 'Hash-based compatibility check; block adapters when base hash changes'],
            ['Composition interference', 'Multiple adapters applied or merged without joint evaluation', 'Require evaluation of composed output; do not assume additivity'],
            ['Supply-chain attack', 'Untrusted adapter loaded at runtime', 'Signature verification; tenant isolation; sandbox untrusted adapters'],
            ['Cache starvation', 'Too many adapters for available GPU memory', 'Rank-aware eviction; priority tiers; degrade gracefully to queuing'],
            ['Provenance loss on merge', 'Merged checkpoint saved without audit trail', 'Mandatory merge audit: base hash, adapter hash, eval result, rollback pointer'],
            ['Overfit to instruction format', 'Adapter trained on narrow prompt template', 'Evaluate on diverse prompt formats, not just the training template'],
          ],
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'Role', 'Link'],
          rows: [
            ['Hu et al., "LoRA: Low-Rank Adaptation of Large Language Models" (2021)', 'Original LoRA paper: rank decomposition, scaling, target module selection', 'https://arxiv.org/abs/2106.09685'],
            ['Dettmers et al., "QLoRA: Efficient Finetuning of Quantized LLMs" (2023)', 'LoRA on quantized bases: NF4 dtype, double quantization, paged optimizers', 'https://arxiv.org/abs/2305.14314'],
            ['Hugging Face PEFT LoRA guide', 'Implementation reference: adapter creation, merging, multi-adapter composition', 'https://huggingface.co/docs/peft/en/developer_guides/lora'],
            ['Hugging Face PEFT model merging guide', 'Merge strategies: linear, TIES, DARE, task arithmetic', 'https://huggingface.co/docs/peft/developer_guides/model_merging'],
            ['vLLM LoRA serving documentation', 'Production multi-LoRA: per-request adapter, caching, memory management', 'https://docs.vllm.ai/en/stable/features/lora/'],
            ['Sheng et al., "S-LoRA: Serving Thousands of Concurrent LoRA Adapters" (2023)', 'Unified paging for adapter memory, heterogeneous batching across adapters', 'https://arxiv.org/abs/2311.03285'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: SVD and Low-Rank Approximation -- understand why rank-r factorization captures most of the signal in weight updates.',
            'Prerequisite: Quantization -- understand the dtype landscape (fp16, bf16, int8, NF4) that constrains adapter compatibility.',
            'Extension: LLM Continuous Batching -- see how adapter-aware scheduling interacts with the continuous batching decode loop.',
            'Extension: Feature Flag Control Plane -- the rollout gate pattern (canary, ready, blocked) is the same control-plane problem.',
            'Related case study: Activation-Aware Quantization Calibration Ledger -- another case where small artifacts (calibration data) require provenance tracking to avoid silent quality degradation.',
            'Contrast: Knowledge Distillation -- an alternative to LoRA when you want a smaller standalone model rather than a base + delta.',
          ],
        },
      ],
    },
  ],
};
