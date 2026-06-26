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
    { heading: 'How to read the animation', paragraphs: [
      'Read this as the lifecycle of a Low-Rank Adaptation (LoRA) adapter. Active nodes show registration, compatibility checks, serving cache state, or merge audit; found nodes are adapters that have passed a gate.',
      {type:'callout', text:'The registry is the safety boundary: an adapter is a typed patch tied to one base model, not a loose weight file.'},
    ] },
    { heading: 'Why this exists', paragraphs: [
      'LoRA freezes a base model and trains small matrices that add a low-rank delta to selected layers. A 7-billion-parameter base can be about 14 GB in fp16, while one adapter can be tens of megabytes.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is to store adapter files by name and load one when a request asks for it. That works in tutorials with one base model and one adapter, but production has many bases, tenants, dtypes, and rollout states.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is compatibility. An adapter trained against one base checkpoint, tokenizer, quantization setup, target-module list, or hidden dimension can load while producing bad behavior.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Treat an adapter as a typed patch. Its type includes base hash, adapter hash, target modules, rank, alpha, tensor shapes, dtype, tokenizer hash, quantization assumptions, owner, evaluation record, allowed tenants, and rollout state.',
    ] },
    { heading: 'How it works', paragraphs: [
      'The registry stores tensors plus a manifest and fails closed on mismatch. Hot-swap caches adapter tensors and applies them per request, while merge writes a new full checkpoint and records a rollback pointer.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'The math is additive: W_new = W + (alpha / r) * B * A. Base hash and shape checks ensure the delta attaches to the intended tensor, while rollout and trust checks decide whether it may affect traffic.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Registry metadata is small, but serving many adapters is not free. Cost behaves as cache pressure and batch fragmentation because adapters compete with KV cache and unique adapters per batch reduce reuse.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'Adapter registries fit multi-tenant SaaS, domain copilots, A/B experiments, regulated model variants, and per-customer behavior patches. They also create audit trails from answer to base checkpoint, adapter version, eval slices, and approval.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'The registry fails if the loader can bypass it or if base checkpoints are overwritten in place. It also fails when composed adapters are assumed safe without joint evaluation.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'A platform serves Mistral-7B with base hash 9f3a. SQL rank 8 matches 9f3a and is ready, legal rank 16 enters a 5 percent canary, and style targets hash 2a7b so the registry blocks it before decode.',
      'A rank-8 adapter for q_proj and v_proj with hidden size 4096 stores about 2 * 4096 * 8 * 2 bytes per layer per target pair, roughly 128 KB per layer before packaging. Across 32 layers that is about 4 MB of raw tensors, tiny beside a 14 GB base but meaningful when hundreds compete for GPU memory.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Study LoRA at https://arxiv.org/abs/2106.09685, QLoRA at https://arxiv.org/abs/2305.14314, Hugging Face PEFT LoRA docs at https://huggingface.co/docs/peft/en/developer_guides/lora, vLLM LoRA serving at https://docs.vllm.ai/en/stable/features/lora/, and S-LoRA at https://arxiv.org/abs/2311.03285.',
      'Next, study low-rank approximation, singular value decomposition, quantization, continuous batching, KV cache, feature flags, model registries, supply-chain signing, and adapter merge methods such as TIES and DARE.',
    ] },
  ],
};