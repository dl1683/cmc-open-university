// KV-cache concurrency capacity model: convert context length into resident
// GPU memory and visible admission-control pressure.

import { matrixState, graphState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'kv-cache-concurrency-capacity-model',
  title: 'KV Cache Concurrency Capacity Model',
  category: 'Systems',
  summary: 'Estimate live-request capacity from KV-cache bytes per token, context length, layers, heads, precision, and scheduler policy.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['capacity math', 'admission policy'], defaultValue: 'capacity math' },
  ],
  run,
};

const rows = [
  { id: '1k', label: '1k' },
  { id: '4k', label: '4k' },
  { id: '16k', label: '16k' },
  { id: '32k', label: '32k' },
];

function labelMatrix(title, rowsIn, columns, labelsByRow) {
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
    rows: rowsIn,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function capacityPlot(markers = []) {
  const tokenCounts = [1024, 2048, 4096, 8192, 16384, 32768, 65536];
  const budgetGiB = 70;
  const mha = tokenCounts.map((n) => ({ x: n, y: Math.floor(budgetGiB / (n * 0.00048828125)) }));
  const gqa = tokenCounts.map((n) => ({ x: n, y: Math.floor(budgetGiB / (n * 0.0001220703125)) }));
  return plotState({
    axes: {
      x: { label: 'context tokens per live request', min: 0, max: 68000 },
      y: { label: 'requests fitting in 70 GiB KV budget', min: 0, max: 600 },
    },
    series: [
      { id: 'mha', label: '32 KV heads fp16', points: mha },
      { id: 'gqa', label: '8 KV heads fp16', points: gqa },
    ],
    markers,
  });
}

function schedulerGraph(title) {
  return graphState({
    nodes: [
      { id: 'request', label: 'request', x: 0.8, y: 3.7, note: 'prompt + budget' },
      { id: 'estimate', label: 'estimate KV', x: 2.5, y: 2.2, note: 'bytes per token' },
      { id: 'ledger', label: 'capacity ledger', x: 4.5, y: 2.2, note: 'HBM budget' },
      { id: 'admit', label: 'admit', x: 6.5, y: 1.3, note: 'fits now' },
      { id: 'queue', label: 'queue', x: 6.5, y: 3.5, note: 'wait for blocks' },
      { id: 'reject', label: 'reject or shrink', x: 6.5, y: 5.7, note: 'too large' },
      { id: 'decode', label: 'decode loop', x: 8.5, y: 1.3, note: 'grows token by token' },
      { id: 'release', label: 'release blocks', x: 8.5, y: 3.5, note: 'finish or evict' },
    ],
    edges: [
      { id: 'e-request-estimate', from: 'request', to: 'estimate' },
      { id: 'e-estimate-ledger', from: 'estimate', to: 'ledger' },
      { id: 'e-ledger-admit', from: 'ledger', to: 'admit', weight: 'fits' },
      { id: 'e-ledger-queue', from: 'ledger', to: 'queue', weight: 'near full' },
      { id: 'e-ledger-reject', from: 'ledger', to: 'reject', weight: 'over budget' },
      { id: 'e-admit-decode', from: 'admit', to: 'decode' },
      { id: 'e-decode-release', from: 'decode', to: 'release' },
      { id: 'e-release-ledger', from: 'release', to: 'ledger' },
    ],
  }, { title });
}

function* capacityMath() {
  yield {
    state: labelMatrix(
      'KV cache bytes become a concurrency limit',
      rows,
      [
        { id: 'mha', label: '32 KV' },
        { id: 'gqa', label: '8 KV' },
        { id: 'capacity', label: '70G cap' },
      ],
      [
        ['0.5G', '0.125G', '140/560'],
        ['2G', '0.5G', '35/140'],
        ['8G', '2G', '8/35'],
        ['16G', '4G', '4/17'],
      ],
    ),
    highlight: { active: ['4k:mha', '16k:mha', '32k:mha'], found: ['4k:gqa', '16k:gqa', '32k:gqa'] },
    explanation: `A live context occupies K and V tensors in every layer. Across ${rows.length} context lengths (${rows[0].label} to ${rows[rows.length - 1].label}), 32 KV heads cost about 0.5 MiB per token; 8 KV heads cost one quarter as much.`,
    invariant: `KV bytes = 2 x layers x tokens x KV heads x head dimension x bytes — computed for ${rows.length} context tiers.`,
  };

  yield {
    state: capacityPlot([
      { id: 'short', x: 4096, y: 35, label: '4k MHA' },
      { id: 'long', x: 32768, y: 4, label: '32k MHA' },
      { id: 'gqa-long', x: 32768, y: 17, label: '32k GQA' },
    ]),
    highlight: { active: ['mha', 'short', 'long'], found: ['gqa', 'gqa-long'] },
    explanation: `Context length and KV-head count directly set concurrency. At ${rows[rows.length - 1].label} tokens with 32 KV heads, only ${4} requests fit a 70 GiB budget — memory runs out before arithmetic capacity.`,
  };

  yield {
    state: labelMatrix(
      'Capacity levers and their tradeoffs',
      [
        { id: 'gqa', label: 'GQA/MQA' },
        { id: 'quant', label: 'KV quant' },
        { id: 'paged', label: 'PagedAttention' },
        { id: 'prefix', label: 'prefix' },
        { id: 'window', label: 'window' },
      ],
      [
        { id: 'saves', label: 'saves' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['KV heads', 'quality'],
        ['bytes/elt', 'accuracy'],
        ['frags', 'kernels'],
        ['prefill', 'exact only'],
        ['old toks', 'lost facts'],
      ],
    ),
    highlight: { found: ['gqa:saves', 'quant:saves', 'paged:saves', 'prefix:saves', 'window:saves'] },
    explanation: `Every capacity lever has a cost. The table lists ${5} levers — from GQA to sliding windows — each trading one resource for one risk. The right design depends on whether the server is wasting blocks, storing too many KV heads, keeping stale history, or repeating shared prompts.`,
  };
}

function* admissionPolicy() {
  yield {
    state: schedulerGraph('Admission control starts with a KV estimate'),
    highlight: { active: ['request', 'estimate', 'ledger', 'e-request-estimate', 'e-estimate-ledger'], compare: ['admit', 'queue', 'reject'] },
    explanation: `A production scheduler routes each request through ${3} early nodes — request, estimate, and ledger — before accepting work. Prompt length, output budget, beam count, KV heads, precision, and adapters all affect the memory promise.`,
  };

  yield {
    state: schedulerGraph('The ledger decides admit, queue, or shrink'),
    highlight: { active: ['ledger', 'admit', 'queue', 'reject', 'e-ledger-admit', 'e-ledger-queue', 'e-ledger-reject'], found: ['release', 'e-release-ledger'] },
    explanation: `KV memory is a ledger, not a vague load number. The ledger fans out to ${3} outcomes — admit, queue, or reject — and the release path feeds capacity back to the ledger.`,
    invariant: `Never promise more live KV cache than the pool can keep resident — the graph's ${8} nodes enforce this closed loop.`,
  };

  yield {
    state: labelMatrix(
      'What a useful KV ledger records',
      [
        { id: 'live', label: 'live' },
        { id: 'reserved', label: 'reserved' },
        { id: 'blocks', label: 'blocks' },
        { id: 'prefix', label: 'prefix' },
        { id: 'tail', label: 'tail' },
      ],
      [
        { id: 'why', label: 'why' },
        { id: 'bad if missing', label: 'miss' },
      ],
      [
        ['bytes now', 'OOM'],
        ['growth', 'abort'],
        ['frags', 'fake cap'],
        ['safe reuse', 'wrong hit'],
        ['outliers', 'p99 hit'],
      ],
    ),
    highlight: { active: ['live:why', 'reserved:why', 'blocks:why'], found: ['tail:bad if missing'] },
    explanation: `The data structure is an accounting system with ${5} tracked dimensions — live bytes, reserved growth, block mappings, shared-prefix references, and tail-risk outliers — each paired with a failure mode when missing.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'capacity math') yield* capacityMath();
  else if (view === 'admission policy') yield* admissionPolicy();
  else throw new InputError('Pick a KV capacity view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/kv-cache-concurrency-capacity-model.gif', alt: 'Animated walkthrough of the kv cache concurrency capacity model visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why it exists',
      paragraphs: [
        'Autoregressive inference looks simple from the outside: send a prompt, receive tokens. Inside the server, every active request leaves behind a growing memory object. Each generated token needs to attend to earlier tokens, so the model stores key and value tensors for those earlier positions in every transformer layer. That resident state is the KV cache.',
        {
          type: 'callout',
          text: 'KV cache capacity is a resident-memory promise, not a request-count metric.',
        },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/The-Transformer-model-architecture.png/250px-The-Transformer-model-architecture.png',
          alt: 'Transformer architecture diagram with repeated attention blocks',
          caption: 'The repeated attention blocks explain why K and V tensors exist at every layer, not just once per request. Source: Wikimedia Commons, from Vaswani et al. 2017.',
        },
        'The cache is useful because it prevents the server from recomputing the entire prompt on every decode step. The same cache is also the reason long-context products are hard to host. A GPU can have enough arithmetic capacity to decode more tokens and still be unable to admit another request because high-bandwidth memory is full.',
        'This topic exists to make that constraint explicit. Concurrency is not just requests per second or tokens per second. For a decoder-only model, concurrency is partly an accounting problem: how many live token histories can the serving pool keep resident while still honoring output budgets, latency promises, and safe recovery paths.',
      ],
    },
    {
      heading: 'The reasonable first model',
      paragraphs: [
        'A reasonable first serving model is to watch GPU utilization, average tokens per second, and average request length. If utilization is low, admit more work. If latency rises, admit less. That approach works for short, uniform chats because compute and memory pressure tend to move together.',
        'Another reasonable shortcut is to pick a maximum batch size. Batch size is easy to reason about, easy to configure, and visible in dashboards. If a model ran well with 32 short requests yesterday, it is tempting to treat 32 as a stable capacity number.',
        'Those models are not foolish. They are just incomplete. They treat every request as if it occupies roughly the same amount of resident state. KV cache breaks that assumption because a 32k context can consume the memory footprint of many 1k contexts, and the request can continue growing after it has already been admitted.',
      ],
    },
    {
      heading: 'Where the naive model breaks',
      paragraphs: [
        'The failure is not only that averages hide outliers. The deeper failure is that the server makes promises before it knows the full decode length. A request arrives with a prompt and a maximum output budget. At admission time, the prompt may fit. Ten seconds later, generated tokens have extended the cache, other requests have arrived, and the pool may have promised more resident memory than it can actually hold.',
        'Paged allocators help, but they do not repeal the arithmetic. PagedAttention-style block management can reduce fragmentation and make allocation more graceful. It cannot make K and V tensors disappear. Grouped-query attention, multi-query attention, KV quantization, prefix reuse, sliding windows, and offload all change the constants or lifetime of cache entries. None of them remove the need for a ledger.',
        'The wall appears most clearly under mixed workloads. A short chat, a coding-agent trace, a retrieval-augmented answer, and a batch summarization job may all be called one request. Their memory obligations are radically different. If the scheduler admits by request count, the worst users are invisible until the server is already under pressure.',
      ],
    },
    {
      heading: 'The capacity invariant',
      paragraphs: [
        'The invariant is KV bytes = 2 x layers x live tokens x KV heads x head dimension x bytes per element. The factor of 2 is for keys and values. Live tokens include prompt tokens and generated tokens that are still available for attention. KV heads may equal attention heads in multi-head attention, or may be fewer under grouped-query or multi-query attention.',
        'That formula is a capacity model because every term has an operational meaning. More layers multiply the cache across the depth of the network. More live tokens multiply it across sequence length. More KV heads multiply it across attention state. More bytes per element multiply it across precision. A pool-level budget divided by the per-request reservation gives an upper bound on concurrent requests, before allocator overhead and safety margin.',
        'A correct ledger also distinguishes current usage from reserved growth. The current prompt cache is not the whole promise. If a request is allowed to generate 2,000 more tokens, the scheduler either reserves space for that growth, enforces a smaller output budget, or accepts the risk of mid-flight eviction, retry, or failure.',
      ],
    },
    {
      heading: 'Mechanism in a server',
      paragraphs: [
        'Admission control starts before the first token is decoded. The scheduler estimates prompt cache bytes, output growth, beam or speculative branches, adapter identity, precision, and any sharing opportunities. It then checks a pool ledger that records live bytes, reserved bytes, free blocks, fragmented blocks, prefix-cache references, and per-tenant or per-product limits.',
        'If the request fits, the server admits it and begins the prefill and decode lifecycle. During decode, each accepted token extends the cache. When the request finishes, is cancelled, or is evicted, blocks return to the allocator and reference counts on shared prefixes are decremented. If the request does not fit, the server can queue it, route it to another pool, reduce max output, fall back to retrieval or summarization, or reject early with a clear capacity reason.',
        'The production insight is that KV capacity is a promise, not a vague load signal. A scheduler that says yes has promised to keep the relevant cache state resident or to follow a defined degradation policy. Without that contract, memory pressure turns into surprising OOMs, latency spikes, broken cache reuse, and unpredictable user experience.',
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        'The capacity table proves the nonlinearity that request-count thinking hides. The model is unchanged, but moving from a 4k context to a 32k context can collapse concurrency by roughly the same factor as the context increase. The plot adds the second lever: reducing KV heads through grouped-query attention can recover capacity without changing the product surface seen by the user.',
        'The policy graph proves the system boundary. Capacity math is not useful if it stays in a spreadsheet. It has to sit in the request path, between the incoming prompt and the decode loop. The graph also shows why release events matter: capacity is conserved across admission, growth, and cleanup. Finishing a request is not just a billing event; it is a memory event.',
        'The levers table proves that every optimization has a tax. Grouped-query attention reduces KV heads but can change quality. KV quantization saves bytes but can perturb outputs. Paged allocators reduce fragmentation but add kernel and bookkeeping complexity. Prefix caching is powerful only for exact compatible prefixes. Sliding windows bound memory by choosing to forget old tokens.',
      ],
    },
    {
      heading: 'Why the model works',
      paragraphs: [
        'The model works because KV cache memory is additive over independent live token histories. If two requests cannot share an exact prefix, their cache entries are separate. If they can share an exact compatible prefix, the shared portion can be reference-counted once and charged differently from each private suffix. Either way, the ledger can express the memory state as a sum of owned and shared blocks.',
        'Correctness depends on identity. A KV cache entry is reusable only when the token prefix, model weights, adapter state, position scheme, attention variant, precision format, and cache layout are compatible with the computation that will consume it. A false cache hit is worse than a miss because it silently changes the model state. The ledger therefore needs correctness keys as well as byte counts.',
        'The admission decision is conservative when the reserved upper bound covers the lifetime of the request. It may underutilize memory if many users stop early, but it avoids promising impossible resident state. More advanced schedulers can reclaim unused reservation, use probabilistic output-length estimates, or tier cold cache to slower memory, but they still need a clear accounting rule for when risk is being accepted.',
      ],
    },
    {
      heading: 'Tradeoffs and uses',
      paragraphs: [
        'KV capacity modeling is useful anywhere long-context inference is sold as an interactive product: chat systems, coding agents, document analysis, retrieval-augmented assistants, batch summarizers, and multi-turn tools. It helps decide max context, max output, per-tenant quotas, queue policy, GPU pool sizing, and whether a new model variant is economically viable.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/AMD%4028nm%40GCN_3th_gen%40Fiji%40Radeon_R9_Nano%40SPMRC_REA0356A-1539_215-0862120_DSC04466_%2829461603171%29.jpg/330px-AMD%4028nm%40GCN_3th_gen%40Fiji%40Radeon_R9_Nano%40SPMRC_REA0356A-1539_215-0862120_DSC04466_%2829461603171%29.jpg',
          alt: 'GPU package with high-bandwidth memory stacks surrounding the processor',
          caption: 'High-bandwidth memory is the scarce resident tier that long-context KV cache consumes. Source: Wikimedia Commons, File:AMD at 28nm GCN Fiji Radeon R9 Nano photo.',
        },
        'The tradeoff is that strict accounting can make the service feel less flexible. Users may see queueing or output-limit reductions even when raw GPU utilization looks low. That is not necessarily a bug. It may be the correct response to a memory-bound workload. The engineering challenge is to expose product-level policies that match the economics: short interactive chats, long agent traces, and batch jobs should not all receive the same reservation rule.',
        'Capacity models also shape architecture. A server that repeatedly sees shared system prompts may invest in prefix caching. A server dominated by long private traces may favor grouped-query attention, quantized KV, sliding windows, or offload. A platform with many tenants may need admission control tied to fairness and SLO budgets rather than one global first-come queue.',
      ],
    },
    {
      heading: 'Failure modes and study next',
      paragraphs: [
        'The main failure mode is measuring the wrong bottleneck. Tokens per second can look healthy while long contexts starve concurrency. Free bytes can look healthy while fragmentation prevents useful allocation. Average context can look safe while a heavy tail dominates p99 latency. Cache hit rate can look high while a small number of false hits would be catastrophic.',
        'Other failures are semantic. Do not reuse KV state across non-identical prefixes, model revisions, adapter states, position encodings, cache formats, or attention implementations. Do not ignore output growth after admission. Do not treat offload as free capacity; it trades memory pressure for bandwidth and latency. Do not let retries hide OOMs, because retries can amplify load and make the pool less stable.',
        'Study PagedAttention and vLLM for block-based cache management, Multi-Query Attention and Grouped-Query Attention for KV-head reduction, Transformer Inference Roofline for compute-versus-memory limits, Prefix Caching and RadixAttention for exact-prefix reuse, Sliding-Window Attention Context Policy for bounded history, KV Cache Transfer Fabric and KV Cache Tiered Offload Store for distributed cache movement, and LLM Inference Cost Stack Case Study for end-to-end serving economics. Primary sources include PagedAttention and vLLM, Efficiently Scaling Transformer Inference, the JAX inference scaling chapter, Multi-Query Attention, and Grouped-Query Attention.',
      ],
    },
  ],
};
