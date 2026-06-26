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
    { heading: 'How to read the animation', paragraphs: [
        'The capacity-math view converts context length into resident KV-cache memory. Rows show context tiers, columns compare full KV heads against grouped-query heads, and the plot shows how many live requests fit inside a fixed memory budget.',
        {type: 'image', src: './assets/gifs/kv-cache-concurrency-capacity-model.gif', alt: 'Animated walkthrough of the kv cache concurrency capacity model visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The admission-policy view is the server version of the same math. A request enters with a prompt and output budget, the scheduler estimates KV bytes, the ledger decides admit, queue, shrink, or reject, and release events return memory to the pool.',
      ], },
    { heading: 'Why this exists', paragraphs: [
        'LLM concurrency is not just requests per second. A decoder request owns a growing KV cache, which is resident memory needed so future tokens can attend to earlier tokens.',
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
        'A server can have enough GPU arithmetic for another request and still lack enough memory to keep that request state alive. This topic exists so capacity is modeled as bytes promised over time, not as a vague utilization graph.',
      ], },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious approach is to set a maximum batch size and watch average GPU utilization. If utilization is low, admit more requests; if latency rises, admit fewer.',
        'This works for short and uniform chats because compute, memory, and request count move together. It breaks when context lengths and output budgets vary by orders of magnitude.',
      ], },
    { heading: 'The wall', paragraphs: [
        'A 32k-token agent trace can consume the KV memory of many 1k-token chats. If the scheduler counts both as one request, the heavy request stays invisible until allocation fails or decode latency spikes.',
        'The second wall is growth after admission. A request that fits at prefill may generate 2,000 more tokens, so the server must reserve future cache or define how it will shrink, evict, queue, or fail.',
      ], },
    { heading: 'The core insight', paragraphs: [
        'KV capacity is a ledger. Every live request has current bytes, reserved growth, block ownership, prefix-sharing identity, and a release path.',
        'The ledger must be conservative enough to prevent impossible promises and precise enough to keep the GPU busy. Cost becomes behavior: queueing, rejection, or shorter output is the visible result of memory arithmetic.',
      ], },
    { heading: 'How it works', paragraphs: [
        'Bytes per request equal 2 x layers x live tokens x KV heads x head dimension x bytes per element. The factor 2 is for keys and values, and live tokens include the prompt plus generated tokens still available to attention.',
        'Admission estimates prompt bytes and output growth before decode starts. During decode, each accepted token extends the ledger, and when a request ends or is evicted, its blocks return to the allocator and shared-prefix reference counts are decremented.',
      ], },
    { heading: 'Why it works', paragraphs: [
        'The model works because KV memory is additive over live token histories that cannot share exact compatible prefixes. If two requests have different prefixes, adapters, positions, or cache formats, their cache blocks are separate commitments.',
        'Correctness depends on identity as much as bytes. A false prefix-cache hit silently changes model state, so the ledger needs keys for model weights, tokenizer, adapter, position scheme, precision, and prefix tokens.',
      ], },
    { heading: 'Cost and complexity', paragraphs: [
        'For a 70 GiB KV budget, a request that costs 0.5 GiB allows at most 140 live requests before safety margin. If context grows 8x and the cache becomes 4 GiB, that same budget fits 17 requests, even if token throughput per request looks healthy.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/AMD%4028nm%40GCN_3th_gen%40Fiji%40Radeon_R9_Nano%40SPMRC_REA0356A-1539_215-0862120_DSC04466_%2829461603171%29.jpg/330px-AMD%4028nm%40GCN_3th_gen%40Fiji%40Radeon_R9_Nano%40SPMRC_REA0356A-1539_215-0862120_DSC04466_%2829461603171%29.jpg',
          alt: 'GPU package with high-bandwidth memory stacks surrounding the processor',
          caption: 'High-bandwidth memory is the scarce resident tier that long-context KV cache consumes. Source: Wikimedia Commons, File:AMD at 28nm GCN Fiji Radeon R9 Nano photo.',
        },
        'Complexity comes from block allocators, prefix sharing, tenant limits, output-length prediction, and tail-risk policy. Paged allocators reduce fragmentation, but they do not remove the need to decide who owns each block and when it can be reclaimed.',
      ], },
    { heading: 'Real-world uses', paragraphs: [
        'Interactive chat, coding agents, document analysis, retrieval-augmented generation, summarization, and multi-tenant model APIs all need KV capacity modeling. The model sets max context, max output, queue policy, per-tenant quotas, and GPU-pool sizing.',
        'It also guides architecture choices. Shared prompts favor prefix caching, long private traces favor GQA or KV quantization, and bursty tenants need admission policy tied to fairness rather than one global queue.',
      ], },
    { heading: 'Where it fails', paragraphs: [
        'The model fails when it treats averages as promises. Average context length, average output length, and average cache hit rate can all look safe while a small heavy tail dominates p99 latency and OOM risk.',
        'It also fails if offload is counted as free memory. Moving cache to CPU or remote storage trades capacity for bandwidth and latency, so admission policy must account for the slower tier explicitly.',
      ], },
    { heading: 'Worked example', paragraphs: [
        'Take a 40-layer model with 8 KV heads, head dimension 128, fp16 values, and a request allowed to reach 8,192 tokens. KV bytes are 2 x 40 x 8,192 x 8 x 128 x 2 = 1,342,177,280 bytes, or 1.25 GiB.',
        'With a 70 GiB KV budget and a 10 GiB safety margin, usable KV space is 60 GiB. The scheduler can promise at most floor(60 / 1.25) = 48 such requests if it reserves the full token budget.',
        'If half the requests are only 2,048 tokens, each of those costs about 0.31 GiB. A ledger can mix 80 short requests and 28 long requests in roughly the same 60 GiB, while a fixed request-count limit cannot see that difference.',
      ], },
    { heading: 'Sources and study next', paragraphs: [
        'Sources: PagedAttention and vLLM, Multi-Query Attention, Grouped-Query Attention, and systems work on disaggregated prefill/decode and KV offload. Use the papers to connect the byte formula to real schedulers and allocators.',
        'Study KV Cache first, then PagedAttention, prefix caching, KV cache quantization, sliding-window attention, transformer inference roofline, and admission control. Before admitting work, price the resident state it will need later.',
      ], },
  ],
};
