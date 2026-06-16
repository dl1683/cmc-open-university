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
    explanation: 'A live context occupies K and V tensors in every layer. In this toy 32-layer, fp16 model, 32 KV heads cost about 0.5 MiB per token; 8 KV heads cost one quarter as much.',
    invariant: 'KV bytes = 2 x layers x tokens x KV heads x head dimension x bytes.',
  };

  yield {
    state: capacityPlot([
      { id: 'short', x: 4096, y: 35, label: '4k MHA' },
      { id: 'long', x: 32768, y: 4, label: '32k MHA' },
      { id: 'gqa-long', x: 32768, y: 17, label: '32k GQA' },
    ]),
    highlight: { active: ['mha', 'short', 'long'], found: ['gqa', 'gqa-long'] },
    explanation: 'Context length and KV-head count directly set concurrency. A long-context product can run out of memory before it runs out of arithmetic capacity.',
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
    explanation: 'Every capacity lever has a cost. The right design depends on whether the server is wasting blocks, storing too many KV heads, keeping stale history, or repeating shared prompts.',
  };
}

function* admissionPolicy() {
  yield {
    state: schedulerGraph('Admission control starts with a KV estimate'),
    highlight: { active: ['request', 'estimate', 'ledger', 'e-request-estimate', 'e-estimate-ledger'], compare: ['admit', 'queue', 'reject'] },
    explanation: 'A production scheduler should estimate the cache footprint before accepting work. Prompt length, output budget, beam count, KV heads, precision, and adapters all affect the memory promise.',
  };

  yield {
    state: schedulerGraph('The ledger decides admit, queue, or shrink'),
    highlight: { active: ['ledger', 'admit', 'queue', 'reject', 'e-ledger-admit', 'e-ledger-queue', 'e-ledger-reject'], found: ['release', 'e-release-ledger'] },
    explanation: 'KV memory is a ledger, not a vague load number. If the budget is tight, the server can queue, lower max output, route to another pool, fall back to retrieval, or reject early.',
    invariant: 'Never promise more live KV cache than the pool can keep resident.',
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
    explanation: 'The data structure is an accounting system. Track current bytes, reserved growth, block mappings, shared-prefix references, and tail-risk outliers.',
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
      heading: 'What it is',
      paragraphs: [
        'The KV Cache Concurrency Capacity Model turns long context into a memory budget. Every active decoder request stores keys and values for each token, layer, KV head, and head dimension. That cache is what lets generation avoid recomputing old tokens, but it also decides how many users fit on a GPU.',
        'The basic formula is simple: 2 tensors for K and V, times layers, times live tokens, times KV heads, times head dimension, times bytes per element. Once that number is known, serving becomes capacity planning: which requests can be admitted, which must queue, and which need a smaller context policy.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A Llama-style 32-layer model with 32 KV heads, head dimension 128, and fp16 cache uses about 0.5 MiB per token. A 4k-token request therefore needs about 2 GiB of KV cache. A 32k-token request needs about 16 GiB. If grouped-query attention reduces KV heads from 32 to 8, the same contexts use one quarter as much cache.',
        'PagedAttention does not remove those bytes; it makes allocation efficient so memory is not stranded in giant contiguous reservations. Prefix Caching & RadixAttention can reuse identical prompt prefixes. KV Cache Transfer Fabric Case Study adds the distributed version of the same accounting problem: a request may need enough local HBM for decode plus enough transfer budget to move remote prompt blocks. KV Cache Tiered Offload Store adds the persistence layer: completed blocks can move to CPU, SSD, or remote storage when reuse beats recomputation. KV Cache Quantization & Compression can reduce bytes per element. Sliding-Window Attention Context Policy can bound how many old tokens remain in cache.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The serving cost is not just average memory. Production systems need a ledger for live tokens, reserved output growth, block mappings, prefix references, beam branches, adapter identity, and tail-risk outliers. Without that ledger, the server can admit work that looks fine at prompt time and then runs out of memory mid-generation.',
        'Capacity policy is a product decision. A coding agent may deserve a larger context budget than a casual short chat. A batch summarizer may tolerate queueing. An interactive chat may need strict time-to-first-token and p99 limits. The scheduler must encode those promises rather than treating all token budgets as equal.',
      ],
    },
    {
      heading: 'Case study',
      paragraphs: [
        'Suppose a server has 70 GiB available for KV cache after reserving memory for model weights and runtime overhead. With 32 KV heads and fp16 cache, it can fit roughly 35 live 4k contexts or about four live 32k contexts. With 8 KV heads, those rough numbers become about 140 and 17. The model architecture has become a concurrency decision.',
        'This is why Grouped-Query Attention, KV Cache Quantization & Compression, LLM Serving: PagedAttention, Prefix Caching & RadixAttention, and Hybrid Attention State Budget Case Study belong on the same study route. They are different data structures for protecting the same scarce resource: resident attention state. On-Device LLM Inference Cost Crossover shows the complementary move: each user device has its own local cache budget, so the shared-concurrency problem moves into device capability checks and update policy.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not measure only tokens per second. A server can have good throughput and still fail if long contexts evict too much concurrency. Do not ignore fragmentation; free bytes that cannot be allocated in the right blocks are not usable capacity. Do not reuse KV state across non-identical token prefixes, adapter states, or position schemes. A cache hit that changes the computation is a correctness bug.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: PagedAttention and vLLM at https://arxiv.org/abs/2309.06180, Efficiently Scaling Transformer Inference at https://arxiv.org/abs/2211.05102, the JAX inference chapter at https://jax-ml.github.io/scaling-book/inference/, Multi-Query Attention at https://arxiv.org/abs/1911.02150, and GQA at https://arxiv.org/abs/2305.13245. Study KV Cache, LLM Serving: PagedAttention, KV Cache Transfer Fabric Case Study, KV Cache Tiered Offload Store, Grouped-Query Attention, Hybrid Attention State Budget Case Study, Transformer Inference Roofline, LLM Inference Cost Stack Case Study, and On-Device LLM Inference Cost Crossover next.',
      ],
    },
  ],
};
