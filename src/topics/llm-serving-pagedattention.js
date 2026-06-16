// LLM serving case study: KV-cache memory is the real serving bottleneck.
// PagedAttention treats cache blocks like virtual-memory pages, while
// continuous batching keeps the GPU busy as requests arrive and finish.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'llm-serving-pagedattention',
  title: 'LLM Serving: PagedAttention',
  category: 'Systems',
  summary: 'How vLLM turns KV cache into paged memory and pairs it with continuous batching for high-throughput inference.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['KV cache paging', 'continuous batching'], defaultValue: 'KV cache paging' },
  ],
  run,
};

const rows = [
  { id: 'r1', label: 'request A' },
  { id: 'r2', label: 'request B' },
  { id: 'r3', label: 'request C' },
  { id: 'total', label: 'total' },
];

function memoryTable(title, used, reserved, mode) {
  const waste = reserved.map((x, i) => x - used[i]);
  return matrixState({
    title,
    rows,
    columns: [
      { id: 'used', label: 'tokens used' },
      { id: 'reserved', label: 'tokens reserved' },
      { id: 'waste', label: 'waste' },
      { id: 'mode', label: 'allocation' },
    ],
    values: [
      [used[0], reserved[0], waste[0], mode],
      [used[1], reserved[1], waste[1], mode],
      [used[2], reserved[2], waste[2], mode],
      [
        used.reduce((a, b) => a + b, 0),
        reserved.reduce((a, b) => a + b, 0),
        waste.reduce((a, b) => a + b, 0),
        mode,
      ],
    ],
    format: (v) => {
      if (v === 1) return 'contiguous';
      if (v === 2) return 'paged blocks';
      return `${v}`;
    },
  });
}

function schedulerTable(title, values, labels) {
  return matrixState({
    title,
    rows: [
      { id: 's1', label: 'iteration 1' },
      { id: 's2', label: 'iteration 2' },
      { id: 's3', label: 'iteration 3' },
      { id: 's4', label: 'iteration 4' },
    ],
    columns: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
      { id: 'd', label: 'D' },
    ],
    values,
    format: (v) => labels[v] ?? '',
  });
}

function* paging() {
  yield {
    state: memoryTable('Naive KV cache: reserve for the maximum', [6, 11, 4], [16, 16, 16], 1),
    highlight: { active: ['total:waste'] },
    explanation: 'During decode, every live request owns a KV Cache that grows token by token. A naive server reserves a large contiguous cache region for the maximum possible output, even though most requests stop early. Here 48 token slots are reserved and only 21 are used. The rest is stranded GPU memory.',
  };

  yield {
    state: memoryTable('PagedAttention: allocate fixed-size blocks on demand', [6, 11, 4], [8, 12, 4], 2),
    highlight: { active: ['r1:waste', 'r2:waste', 'r3:waste'], found: ['total:waste'] },
    explanation: 'PagedAttention changes the unit of allocation. Instead of one contiguous maximum-sized region per request, the cache is split into same-sized blocks and allocated only when tokens need them. Waste falls from 27 slots to 3 slots in this toy example.',
    invariant: 'Same-sized blocks eliminate external fragmentation and sharply reduce internal fragmentation.',
  };

  yield {
    state: matrixState({
      title: 'Block table: logical token positions point to physical blocks',
      rows: [
        { id: 'a', label: 'A logical tokens' },
        { id: 'b', label: 'B logical tokens' },
        { id: 'c', label: 'C logical tokens' },
      ],
      columns: [
        { id: 'p0', label: 'block 0' },
        { id: 'p1', label: 'block 1' },
        { id: 'p2', label: 'block 2' },
        { id: 'p3', label: 'block 3' },
      ],
      values: [
        [1, 1, 0, 0],
        [0, 1, 1, 1],
        [0, 0, 0, 1],
      ],
      format: (v) => v ? 'mapped' : 'free',
    }),
    highlight: { active: ['a:p0', 'a:p1', 'b:p1', 'b:p2', 'b:p3', 'c:p3'] },
    explanation: 'The block table is the trick. Logical token positions do not need to live beside each other physically. This is the same move as operating-system virtual memory: requests are processes, cache blocks are pages, and the attention kernel follows the page table.',
  };

  yield {
    state: matrixState({
      title: 'Why this matters for serving economics',
      rows: [
        { id: 'frag', label: 'fragmentation' },
        { id: 'beam', label: 'beam search' },
        { id: 'prefix', label: 'shared prompt' },
        { id: 'preempt', label: 'preemption' },
      ],
      columns: [
        { id: 'problem', label: 'old problem' },
        { id: 'paged', label: 'paged move' },
        { id: 'result', label: 'serving result' },
      ],
      values: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
        [10, 11, 12],
      ],
      format: (v) => [
        '',
        'reserved but unused slots', 'allocate blocks lazily', 'more users per GPU',
        'branches duplicate cache', 'copy-on-write blocks', 'cheap parallel candidates',
        'same system prompt repeated', 'share prefix blocks', 'less repeated memory',
        'long request monopolizes memory', 'evict and resume blocks', 'scheduler has options',
      ][v],
    }),
    highlight: { active: ['frag:result', 'beam:result', 'prefix:result'] },
    explanation: 'Paged KV cache is not a cosmetic optimization. It unlocks beam search, prefix sharing, and preemptive scheduling because cache ownership becomes block-level instead of one giant slab. That is why vLLM is a serving system, not just a faster Attention Mechanism kernel.',
  };
}

function* continuousBatching() {
  yield {
    state: schedulerTable('Static batching waits for the slowest request', [
      [1, 1, 0, 0],
      [1, 1, 0, 0],
      [2, 1, 0, 0],
      [2, 2, 0, 0],
    ], { 0: '', 1: 'decode', 2: 'idle' }),
    highlight: { active: ['s3:a', 's4:a', 's4:b'] },
    explanation: 'Static batching groups requests, runs them together, and often waits until the slowest sequence finishes before admitting new work. The GPU sees padding, idle lanes, and uneven output lengths. The problem is scheduling, not model quality.',
  };

  yield {
    state: schedulerTable('Continuous batching admits work every iteration', [
      [1, 1, 0, 0],
      [1, 1, 1, 0],
      [0, 1, 1, 1],
      [0, 0, 1, 1],
    ], { 0: '', 1: 'decode' }),
    highlight: { found: ['s2:c', 's3:d'] },
    explanation: 'Continuous batching schedules at the token iteration level. When request A finishes, request D can join on the next decode step instead of waiting for the whole batch cycle. The GPU stays packed with useful tokens.',
    invariant: 'The unit of scheduling is one decode iteration, not one whole request.',
  };

  yield {
    state: matrixState({
      title: 'Serving stack: three levers compound',
      rows: [
        { id: 'batch', label: 'continuous batching' },
        { id: 'page', label: 'PagedAttention' },
        { id: 'chunk', label: 'chunked prefill' },
        { id: 'spec', label: 'speculative decode' },
      ],
      columns: [
        { id: 'what', label: 'moves' },
        { id: 'fixes', label: 'fixes' },
        { id: 'links', label: 'study link' },
      ],
      values: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
        [10, 11, 12],
      ],
      format: (v) => [
        '',
        'requests', 'idle GPU lanes', 'Load Balancer',
        'KV blocks', 'fragmented cache memory', 'KV Cache',
        'prompt work', 'prefill/decode interference', 'Attention Mechanism',
        'draft tokens', 'serial decode latency', 'Speculative Decoding',
      ][v],
    }),
    highlight: { active: ['batch:fixes', 'page:fixes', 'chunk:fixes'] },
    explanation: 'A production LLM server is a composition of ideas already on this site: Load Balancer logic for scheduling, KV Cache memory accounting, Attention Mechanism kernels, Quantization for smaller weights, and Speculative Decoding for latency. The winning systems stack many small levers instead of trusting one magic trick.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'KV cache paging') yield* paging();
  else if (view === 'continuous batching') yield* continuousBatching();
  else throw new InputError('Pick an LLM serving view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'PagedAttention is the memory-management idea behind vLLM. Autoregressive models store a KV cache for every live sequence so each new token can attend to previous tokens without recomputing all keys and values. That cache grows with context length and consumes scarce GPU memory. PagedAttention stores the cache in fixed-size blocks, much like virtual-memory pages, so memory can be allocated on demand instead of reserved in one contiguous slab.',
        'This is a production systems topic disguised as an AI topic. The model weights are mostly fixed. The per-user KV cache is the variable part that expands with usage, context length, beam search, and parallel candidates. If the server wastes KV memory, fewer users fit on the same GPU. If fewer users fit, the cost per token rises.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The naive approach preallocates enough contiguous cache space for each request to reach its maximum length. Real users rarely consume exactly that maximum, so memory fragments: some is reserved but unused, and free space may be trapped in shapes the scheduler cannot use. PagedAttention breaks each sequence cache into blocks. The runtime keeps a block table mapping logical token positions to physical cache blocks. The attention kernel reads through that mapping when it needs keys and values.',
        'Once KV cache is block-addressed, other serving features become simpler. Beam search can share prefix blocks and copy only when branches diverge. Multiple requests with the same prompt can share blocks. Long requests can be preempted by spilling or reclaiming blocks. KV Cache Transfer Fabric Case Study uses the same block-addressed mindset across machines: remote block IDs, readiness masks, and cleanup acknowledgements become the contract between prefill and decode. KV Cache Tiered Offload Store Case Study keeps that block contract but changes placement: hot blocks stay in HBM, warm blocks may sit in CPU memory, and cold reusable blocks can spill to SSD or remote storage. Continuous batching then keeps the GPU busy by admitting and removing requests at every decode iteration instead of treating a batch as a rigid unit.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The key cost is bytes per live token. A decoder-only model stores keys and values for many layers, many KV heads, and every token in every active conversation. Longer context increases cache memory roughly linearly. The local document set frames this as the central inference economics problem: long context does not just add compute, it evicts other users from the GPU. PagedAttention does not remove the cache, but it sharply reduces waste and gives the scheduler better control.',
        'The vLLM paper reports 2x to 4x throughput improvements over prior serving systems on evaluated workloads, without changing model outputs. That result matters because it moves the unit economics without retraining. The tradeoff is implementation complexity: kernels must follow block tables efficiently, the scheduler must manage blocks, and production deployments still need monitoring, admission control, fallback behavior, and tail-latency discipline.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'vLLM, TensorRT-LLM, SGLang, and other inference stacks all attack the same serving physics: keep GPU compute saturated while keeping KV memory under control. Public LLM APIs, internal copilots, RAG Pipeline products, and coding agents all face variable-length prompts and outputs. A server that handles 1,000 short chats well may collapse under a few long-context agent traces unless its memory manager and scheduler are built for it. SLO-Aware LLM Request Router adds the front-door placement question: which replica has enough queue budget and the right KV state to make those blocks useful?',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'PagedAttention is not a replacement for efficient attention math. FlashAttention improves how attention computation uses memory inside a kernel; PagedAttention improves how the long-lived KV cache is allocated across requests. They solve different layers of the stack. Another misconception is that bigger context is mostly a model capability problem. It is also a serving-concurrency problem: every active long-context user consumes cache that another user could have used.',
        'Continuous batching improves throughput, but it does not make latency free. If the scheduler overfills the batch, individual users wait longer. If it underfills the batch, the GPU idles. Production serving is a control problem over latency, throughput, fairness, and memory pressure.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Efficient Memory Management for Large Language Model Serving with PagedAttention at https://arxiv.org/abs/2309.06180, the vLLM project at https://github.com/vllm-project/vllm, the vLLM documentation at https://docs.vllm.ai/, and Orca iteration-level scheduling at https://www.usenix.org/conference/osdi22/presentation/yu. Study KV Cache first, then Attention Mechanism, Chunked Prefill Token Budget Scheduler, Speculative Decoding, Quantization, KV Cache Transfer Fabric Case Study, KV Cache Tiered Offload Store Case Study, SLO-Aware LLM Request Router, Load Balancer, Tail Latency & p99 Thinking, and RAG Pipeline. Together they form the real LLM serving stack.',
      ],
    },
  ],
};
