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
        "Read the animation as the execution trace for LoRA Adapter Registry, Merge, and Serving Ledger. A production LoRA case study: manifests, base-checkpoint compatibility, merge audits, hot-swap adapter caches, multi-adapter batching, and rollout gates..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'LoRA makes adaptation cheap enough that a team can create many task-specific model variants without copying the whole base model. That is the attraction: freeze the base weights, train low-rank matrices, and apply a small delta at inference or merge time.',
        'Production turns that convenience into a control problem. A company may have one large base model and hundreds of adapters for tenants, domains, languages, tools, policy regimes, and experiments. The adapter file is small, but it changes model behavior. A registry exists so those patches are versioned, compatible, auditable, and safe to serve.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The obvious approach is to store adapter files in a bucket and let each request name the adapter it wants. If the file exists, load it. If it improves a benchmark, promote it. If it becomes popular, merge it into the base model.',
        'That breaks quickly. An adapter is valid only relative to the exact base checkpoint and target module layout it was trained against. Similar model names are not enough. Tokenizer revisions, rope scaling, quantization paths, target-module names, rank caps, dtype rules, and safety status can differ while the file still looks loadable.',
        'The wall is not math. The wall is identity, provenance, and scheduling. Without a registry and serving ledger, small adapters become untracked executable patches.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to treat a LoRA adapter as a typed patch, not as a loose model artifact. The type includes the base checkpoint hash, target modules, tensor shapes, rank, scale, dtype, quantization assumptions, tokenizer compatibility, training lineage, evaluation record, trust boundary, and rollout state.',
        'Once the adapter is a typed patch, the serving decision becomes ordinary systems work. Validate the patch, choose merge or hot-swap, cache it if it stays separate, batch compatible requests, trace the result, and fail closed when identity or policy is missing.',
      ],
    },
    {
      heading: 'Reading the three views',
      paragraphs: [
        'The registry view is the compatibility gate. Watch the base hash, target modules, rank, dtype, signature, and rollout state before anything reaches the decode path. The blocked style adapter is the important negative case: a present file is not automatically a valid adapter.',
        'The merge path view shows when an adapter becomes a new checkpoint. The table is layer-local: for each targeted module, compute the low-rank delta and add it to the frozen weight. The audit rows matter because a merged checkpoint can otherwise lose the evidence that explains where it came from.',
        'The serving view keeps the base model resident and applies adapters per request. The cache, grouping lane, p99 plot, and rollout gate show the real serving problem: many adapters can share one base, but they can also fragment batches, evict each other, and widen the attack surface.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A useful registry stores two things together: the adapter tensors and the manifest that gives those tensors meaning. The manifest should record base checkpoint hash, adapter hash, target modules, rank, alpha or scale, dtype, tokenizer or vocabulary assumptions, quantization requirements, training data identifier, training config, evaluation slices, owner, signature, allowed tenants, rollout percentage, and rollback pointer.',
        'The compatibility gate should fail closed. Base hash mismatch blocks. Shape mismatch blocks. Missing target modules block. Unsafe dtype casts block. Unknown signatures block. Rank above runtime cap may queue or reject. An adapter with incomplete evaluation may enter canary, but it should not quietly become production.',
        'This is also the right place to model trust. Dynamic adapter loading can be useful, but it is a supply-chain surface. A registry can require signatures, limit who may publish adapters, sandbox untrusted adapters, and prevent tenant A from selecting tenant B\'s patch.',
      ],
    },
    {
      heading: 'Merge and hot-swap',
      paragraphs: [
        'Merging is attractive when one adapter becomes the stable path for a model. The serving system can load a single checkpoint, avoid per-request adapter lookup, and remove hot-swap overhead from the decode path. The cost is artifact sprawl: the merged model is now another full checkpoint to scan, evaluate, store, deploy, and roll back.',
        'Hot-swap serving is better when one base model supports many tenants, domains, or experiments. A request selects an adapter ID, policy validates it, the cache loads or reuses the tensors, and inference applies W plus the low-rank delta. This preserves flexibility and fast rollback, but adds scheduler, cache, provenance, and security complexity.',
        'Quantized bases make the decision sharper. A QLoRA-style adapter may depend on a particular quantization runtime and dtype transition. Some systems dequantize, merge, and resave. Others keep adapters separate. The registry should say whether an adapter is merge-safe, serve-only, or runtime-specific.',
      ],
    },
    {
      heading: 'Why batching gets hard',
      paragraphs: [
        'Multi-adapter serving is not just a storage problem. Requests can share the same base weights, but they may need different A and B tensors. If a scheduler interleaves many adapters naively, it can fragment batches, churn kernels, cause cache misses, and raise p99 latency.',
        'A route-aware scheduler groups requests by compatible adapter state, keeps hot adapters resident, loads cold adapters away from latency-critical paths when possible, and records cache hit or miss in the trace. The cache policy should consider rank, bytes, hit rate, tenant priority, rollout state, and safety state, not recency alone.',
        'The serving trace should include request ID, tenant, base hash, adapter ID, adapter hash, merge or hot-swap path, cache result, rank, target modules, latency slices, policy result, and output quality or safety outcome. That is what makes an adapter incident replayable.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Imagine one base model serves three product lanes: SQL help, legal drafting, and support replies. SQL and support are ready adapters trained against base m7b@9f with rank 8 on q and v projections. Legal is canary with rank 16 on q, v, and o. A style adapter was trained against m7b@2a and targets all modules.',
        'The registry lets SQL and support serve immediately, lets legal serve only to its canary cohort, and blocks style because the base hash does not match. In hot-swap mode, requests for SQL are grouped into lane A, legal into lane B, and support into lane C. A support cache miss may be acceptable for batch replies but not for interactive chat.',
        'If the SQL adapter becomes the only SQL path and passes holdout, safety, latency, and rollback checks, the team may merge it into a dedicated SQL checkpoint. The merge audit records base hash, adapter hash, dtype path, evaluation result, merged checkpoint hash, and rollback pointer. Without that audit, the new checkpoint is just unexplained weight soup.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The registry adds operational overhead: manifests, signatures, hash checks, evaluation storage, rollout flags, cache accounting, and trace joins. That overhead is the price of safely serving many model variants on one base.',
        'Merging lowers hot-path complexity but increases checkpoint storage and promotion burden. Hot-swap lowers storage and improves flexibility but increases p99 risk, cache pressure, and security concerns. A system that supports both needs clear rules for when an adapter graduates from hot-swap to merged checkpoint.',
        'The most common failures are base hash mismatch, tokenizer mismatch, target-module drift, unsafe dynamic loading, cache thrash, dtype bugs, quantization incompatibility, overfit instruction style, missing rollback, and merged checkpoint provenance loss.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'It wins when one base model must support many tasks, tenants, experiments, or regulated variants without copying the full model for each one. It is especially useful when adapters change often but the base model changes slowly.',
        'It fails when adapter behavior is treated as harmless because the files are small. It also fails when teams compose adapters casually, ignore evaluation slices, skip signatures, or let runtime loading bypass policy. LoRA reduces training cost; it does not remove release engineering.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: LoRA at https://arxiv.org/abs/2106.09685, QLoRA at https://arxiv.org/abs/2305.14314, Hugging Face PEFT LoRA guide at https://huggingface.co/docs/peft/en/developer_guides/lora, PEFT model merging guide at https://huggingface.co/docs/peft/developer_guides/model_merging, vLLM LoRA serving docs at https://docs.vllm.ai/en/stable/features/lora/, and Anyscale multi-LoRA serving docs at https://docs.anyscale.com/llm/serving/multi-lora.',
        'Study LoRA Fine-Tuning, Quantization, Activation-Aware Quantization Calibration Ledger, Transformer Inference Roofline, LLM Continuous Batching, Feature Flag Control Plane, Software Supply Chain Provenance Graph, Prompt Injection Threat Model, Knowledge Distillation, and SVD & Low-Rank Approximation next.',
      ],
    },
      {
      heading: 'The obvious approach',
      paragraphs: [
        "Name the reasonable first attempt and why teams reach for it.",
        "Then show the exact place that approach stops scaling or starts breaking.",
        "Treat this section as contrast, not a rejection.",
      ],
    },

    {
      heading: 'Why it works',
      paragraphs: [
        "Give the proof sketch as a preservation argument: invariant before, move, invariant after.",
        "If there is a nontrivial corner case, name it explicitly.",
        "When correctness is explicit, readers can transfer the method to new inputs.",
      ],
    },

    {
      heading: 'Where it fails',
      paragraphs: [
        "List the failure modes and the conditions that trigger them.",
        "Most methods have at least one silent failure mode; expose the silent ones.",
        "A method without explicit failure conditions is an invitation for misuse.",
      ],
    },


      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },

      {
        heading: 'Learning map',
        paragraphs: [
          'Before this topic, unlock all prerequisites and define the required preconditions.',
          'After this topic, trace where this idea appears in one larger path on this site.',
          'Use unlock relationships to keep one path and one checkpoint per review cycle.',
        ],
      },

      {
        heading: 'Micro checks',
        paragraphs: [
          {
            type: 'bullets',
            items: [
              'Can you state one invariant in one sentence?',
              'Can you prove one transition with pre and post state?',
              'Can you name one hidden edge case in one line?',
              'Can you transfer this mechanism to a neighboring domain?',
            ],
          },
        ],
      },

      {
        heading: 'Try this now',
        paragraphs: [
          'Build one input manually and predict every step before running the animation.',
          'If your predicted final state matches the animation for lora-adapter-registry-merge-serving-case-study, continue to the next topic in the same track.'
  ],
      },
],
};
