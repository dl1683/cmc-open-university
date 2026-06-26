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
  const naiveUsed = [6, 11, 4];
  const naiveReserved = [16, 16, 16];
  const naiveTotalUsed = naiveUsed.reduce((a, b) => a + b, 0);
  const naiveTotalReserved = naiveReserved.reduce((a, b) => a + b, 0);
  const naiveTotalWaste = naiveTotalReserved - naiveTotalUsed;

  yield {
    state: memoryTable('Naive KV cache: reserve for the maximum', naiveUsed, naiveReserved, 1),
    highlight: { active: ['total:waste'] },
    explanation: `During decode, every live request owns a KV Cache that grows token by token. A naive server reserves a large contiguous cache region for the maximum possible output, even though most requests stop early. Here ${naiveTotalReserved} token slots are reserved and only ${naiveTotalUsed} are used. The rest is stranded GPU memory.`,
  };

  const pagedUsed = [6, 11, 4];
  const pagedReserved = [8, 12, 4];
  const pagedTotalWaste = pagedReserved.reduce((a, b) => a + b, 0) - pagedUsed.reduce((a, b) => a + b, 0);

  yield {
    state: memoryTable('PagedAttention: allocate fixed-size blocks on demand', pagedUsed, pagedReserved, 2),
    highlight: { active: ['r1:waste', 'r2:waste', 'r3:waste'], found: ['total:waste'] },
    explanation: `PagedAttention changes the unit of allocation. Instead of one contiguous maximum-sized region per request, the cache is split into same-sized blocks and allocated only when tokens need them. Waste falls from ${naiveTotalWaste} slots to ${pagedTotalWaste} slots in this toy example.`,
    invariant: 'Same-sized blocks eliminate external fragmentation and sharply reduce internal fragmentation.',
  };

  const blockTable = [
    [1, 1, 0, 0],
    [0, 1, 1, 1],
    [0, 0, 0, 1],
  ];
  const aMapped = blockTable[0].filter(v => v).length;
  const bMapped = blockTable[1].filter(v => v).length;
  const cMapped = blockTable[2].filter(v => v).length;
  const totalBlocks = 4;

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
      values: blockTable,
      format: (v) => v ? 'mapped' : 'free',
    }),
    highlight: { active: ['a:p0', 'a:p1', 'b:p1', 'b:p2', 'b:p3', 'c:p3'] },
    explanation: `The block table is the trick. Request A maps ${aMapped} of ${totalBlocks} blocks, B maps ${bMapped}, C maps ${cMapped}. Logical token positions do not need to live beside each other physically. This is the same move as operating-system virtual memory: requests are processes, cache blocks are pages, and the attention kernel follows the page table.`,
  };

  const numBenefits = 4;
  const benefitLabels = ['fragmentation', 'beam search', 'shared prompt', 'preemption'];

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
    explanation: `Paged KV cache is not a cosmetic optimization. It unlocks ${numBenefits} capabilities (${benefitLabels.join(', ')}) because cache ownership becomes block-level instead of one giant slab. That is why vLLM is a serving system, not just a faster Attention Mechanism kernel.`,
  };
}

function* continuousBatching() {
  const staticGrid = [
    [1, 1, 0, 0],
    [1, 1, 0, 0],
    [2, 1, 0, 0],
    [2, 2, 0, 0],
  ];
  const staticIdleSlots = staticGrid.flat().filter(v => v === 2).length;
  const staticTotalSlots = staticGrid.flat().length;

  yield {
    state: schedulerTable('Static batching waits for the slowest request', staticGrid, { 0: '', 1: 'decode', 2: 'idle' }),
    highlight: { active: ['s3:a', 's4:a', 's4:b'] },
    explanation: `Static batching groups requests, runs them together, and often waits until the slowest sequence finishes before admitting new work. In this ${staticTotalSlots}-slot grid, ${staticIdleSlots} slots sit idle. The GPU sees padding, idle lanes, and uneven output lengths. The problem is scheduling, not model quality.`,
  };

  const contGrid = [
    [1, 1, 0, 0],
    [1, 1, 1, 0],
    [0, 1, 1, 1],
    [0, 0, 1, 1],
  ];
  const contActiveSlots = contGrid.flat().filter(v => v === 1).length;
  const contEmptySlots = contGrid.flat().filter(v => v === 0).length;

  yield {
    state: schedulerTable('Continuous batching admits work every iteration', contGrid, { 0: '', 1: 'decode' }),
    highlight: { found: ['s2:c', 's3:d'] },
    explanation: `Continuous batching schedules at the token iteration level. ${contActiveSlots} of ${contActiveSlots + contEmptySlots} slots are actively decoding. When request A finishes, request D can join on the next decode step instead of waiting for the whole batch cycle. The GPU stays packed with useful tokens.`,
    invariant: 'The unit of scheduling is one decode iteration, not one whole request.',
  };

  const numLevers = 4;
  const leverNames = ['continuous batching', 'PagedAttention', 'chunked prefill', 'speculative decode'];

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
    explanation: `A production LLM server is a composition of ${numLevers} levers (${leverNames.join(', ')}): Load Balancer logic for scheduling, KV Cache memory accounting, Attention Mechanism kernels, Quantization for smaller weights, and Speculative Decoding for latency. The winning systems stack many small levers instead of trusting one magic trick.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the first table as memory accounting for KV cache, which stores past key and value tensors needed during decode. Used tokens are real state; reserved tokens are memory held for possible future tokens. The safe inference is that changing the allocation unit from a slab to blocks reduces stranded memory without changing the logical token order.',
        {type: 'callout', text: "PagedAttention makes KV cache a block-mapped memory system, so scheduling can follow live tokens instead of reserved slabs."},
        {type: 'image', src: './assets/gifs/llm-serving-pagedattention.gif', alt: 'Animated walkthrough of the llm serving pagedattention visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Large language model serving keeps a KV cache for every live request so the model does not recompute old tokens at every new token. That cache grows with layers, heads, head dimension, precision, and token count. PagedAttention exists because this long-lived memory, not only arithmetic, limits how many users one GPU can serve at once.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Cache_hierarchy.svg', alt: 'Cache hierarchy diagram from CPU registers through storage', caption: 'PagedAttention is a serving-specific memory hierarchy move: scarce fast memory holds the live KV state needed by decode. Source: Wikimedia Commons, CC BY-SA 4.0.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to reserve one contiguous cache region for each request at its maximum allowed length. Addressing is simple because token positions map into one slab. It is also easy to reason about in a single-request prototype.',
        'The approach wastes memory in real traffic. If a request reserves 4,096 token slots and stops after 350 tokens, most of the slab is unavailable to other users. Moving slabs around later would consume memory bandwidth and complicate every pointer the kernels use.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is fragmentation under variable-length decode. Users send different prompt lengths, stop at different output lengths, cancel requests, branch beams, and share prefixes. A slab allocator makes future possible tokens occupy physical HBM even when they do not exist.',
        'Continuous batching makes the wall sharper. The scheduler wants to admit and retire requests every token step, but slab allocation makes each admission a large memory decision. The system needs memory ownership to move at token-block granularity instead of request-maximum granularity.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'PagedAttention separates logical token positions from physical KV storage. Each sequence has a block table, and the table maps logical blocks to fixed-size physical blocks in GPU memory. The blocks do not need to be contiguous as long as the table resolves each token position to the right KV tensors.',
        'This is the virtual-memory move applied to inference serving. A request owns references to blocks, not one giant slab. That lets blocks be allocated lazily, freed quickly, shared for prefixes, copied on write for branches, or moved under pressure.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The allocator divides KV cache into equal-size blocks. When a sequence needs more token capacity, the scheduler assigns another free block and records it in the block table. During attention, the kernel follows the table to gather keys and values for the logical prefix.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg', alt: 'Rows of servers in a datacenter', caption: 'Serving replicas must keep many users alive at once; continuous batching and paged KV allocation are local control loops inside that fleet. Source: Wikimedia Commons, Victorgrigas, CC BY-SA 3.0.'},
        'The scheduler can now admit a request by assigning a few blocks instead of reserving a full maximum context. When a request finishes, its blocks return to the free list. When two requests share a prefix, their block references can share physical storage until one branch diverges.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness depends on address preservation. Attention for token t needs the exact keys and values created by earlier tokens in the same sequence and layer. PagedAttention changes the lookup path, not the numerical state the model reads.',
        'The block table is therefore the invariant. For every logical token block, it must point to the physical block containing that sequence state. If the table is correct, the model output matches a contiguous cache layout while memory utilization improves.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'PagedAttention trades indexing work for capacity. Smaller blocks reduce wasted slack in the last block but increase metadata and lookup overhead. Larger blocks reduce table pressure but leave more internal fragmentation when sequences stop early.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Nvidia_GV100_GPU.png', alt: 'Nvidia GV100 GPU die with many processing blocks', caption: 'The benefit is economic only if block lookup overhead is smaller than the HBM capacity recovered for more live sequences. Source: Wikimedia Commons, Nvidia, public domain.'},
        'The behavior changes when demand doubles. If memory was the bottleneck, recovered blocks can admit more live sequences and lower cost per token. If arithmetic or network transfer was already the bottleneck, better packing may not increase useful throughput.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'PagedAttention fits high-concurrency LLM serving with mixed prompt lengths and output lengths. Public chat APIs, internal copilots, RAG services, agent backends, and batch inference pools all benefit when many partially complete requests share one GPU. The feature is most valuable near memory capacity, where a small reduction in waste admits many more live sequences.',
        'It also enables serving behaviors that slabs handle poorly. Beam search can share prefix blocks, prefix caching can reuse common system prompts, preemption can move blocks instead of whole slabs, and tiered KV systems can decide which blocks stay in HBM.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'PagedAttention does not reduce the true size of a long active context. A 100,000-token request still needs KV memory proportional to token count, model width, layers, and precision. The technique reduces fragmentation and improves control; it does not make long contexts free.',
        'It also adds a dangerous correctness surface. A stale block pointer can make one request attend to another request state, and a reference-count bug can corrupt shared prefixes. The allocator, scheduler, and kernels must be tested as one memory system, not as an isolated optimization.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use a block size of 4 token slots. Requests A, B, and C have generated 6, 11, and 4 tokens. A slab allocator reserving 16 slots each holds 48 slots total, uses 21, and wastes 27.',
        'Paged allocation gives A two blocks for 8 slots, B three blocks for 12 slots, and C one block for 4 slots. It holds 24 slots, uses 21, and wastes 3. The same logical tokens are available to attention, but 24 slots return to the system for other users.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read the PagedAttention paper at https://arxiv.org/abs/2309.06180 and the vLLM project documentation for implementation context. Read Orca for iteration-level scheduling, because the memory allocator and scheduler solve adjacent parts of the same serving problem.',
        'Study KV cache, attention, FlashAttention, continuous batching, chunked prefill, prefix caching, speculative decoding, and tail-latency routing. The next exercise is to compute reserved, used, and wasted slots for three requests under slab and paged allocation.',
      ],
    },
  ],
};
