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
        "Read the animation as the execution trace for LLM Serving: PagedAttention. How vLLM turns KV cache into paged memory and pairs it with continuous batching for high-throughput inference..",
        {type: 'callout', text: "PagedAttention makes KV cache a block-mapped memory system, so scheduling can follow live tokens instead of reserved slabs."},
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      
        {type: 'image', src: './assets/gifs/llm-serving-pagedattention.gif', alt: 'Animated walkthrough of the llm serving pagedattention visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Large language model serving is often limited less by raw arithmetic and more by the memory needed to keep many conversations alive. During decode, every active request stores a key and value tensor for each generated token, layer, and attention head. That KV cache is the reason the server does not need to recompute the whole prompt at every token, but it also grows one token at a time for every request in flight.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Cache_hierarchy.svg', alt: 'Cache hierarchy diagram from CPU registers through storage', caption: 'PagedAttention is a serving-specific memory hierarchy move: scarce fast memory holds the live KV state needed by decode. Source: Wikimedia Commons, CC BY-SA 4.0.'},
        'PagedAttention exists because this growth pattern is hostile to simple GPU memory allocation. Real users send short prompts, long prompts, early-stopping outputs, streaming chats, beam branches, and retries. A serving engine needs a way to pack that irregular state into HBM without wasting most of the space on tokens that might never be generated.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to reserve one contiguous KV region for each request at the maximum allowed length. It is simple, and it makes kernel addressing easy. It also turns unused future tokens into occupied GPU memory. If a request reserves 4096 token slots and stops after 350 tokens, the remaining slots are unavailable to other users even though they hold no useful information.',
        'Another tempting fix is compaction: move live cache tensors together after requests finish. That works poorly in a decode server. Moving large tensors steals bandwidth from inference, complicates pointer validity, and happens exactly when the scheduler is trying to admit new work. The deeper problem is not that memory needs occasional cleanup. The problem is that one request owns too large a physical region.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'PagedAttention borrows the central move from virtual memory. Logical positions in a sequence are separated from physical storage blocks. The request owns a block table. The block table says which fixed-size KV blocks contain the keys and values for each range of token positions. The blocks themselves can be scattered through GPU memory.',
        'This changes the unit of ownership. A request no longer owns one giant slab. It owns a logical list of block references that can grow as tokens arrive, release blocks as the request ends, share blocks with a related request, or spill blocks under pressure. The attention kernel pays the cost of following the table, but the serving system gains a memory model that matches variable-length decoding.',
      ],
    },
    {
      heading: 'Block Tables',
      paragraphs: [
        'The block table is the data structure that makes the idea operational. For each sequence, it maps logical token block number 0, 1, 2, and so on to a physical KV block. The kernel uses that mapping when it gathers old keys and values for attention. Correctness depends on exact addressability: the logical token position must resolve to the KV state produced for that token, request branch, layer, and head.',
        'Fixed-size blocks reduce external fragmentation because any free block can satisfy any request. They also bound internal fragmentation because only the last block of a sequence is partly empty. In a serving workload with many partially completed requests, that is a large improvement over reserving a whole maximum-length slab per request.',
      ],
    },
    {
      heading: 'Continuous Batching',
      paragraphs: [
        'PagedAttention is strongest when paired with iteration-level scheduling. Static batching groups requests and waits for the batch to finish or drain. That wastes GPU lanes because outputs have different lengths. Continuous batching admits and removes requests at each decode step. When one sequence finishes, another can enter on the next token iteration.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg', alt: 'Rows of servers in a datacenter', caption: 'Serving replicas must keep many users alive at once; continuous batching and paged KV allocation are local control loops inside that fleet. Source: Wikimedia Commons, Victorgrigas, CC BY-SA 3.0.'},
        'The memory allocator and scheduler need each other. Continuous batching creates constant churn in the live set of sequences. PagedAttention makes that churn cheap enough to handle because joining a batch means allocating a few blocks, not carving a new contiguous slab. Leaving a batch means freeing block references, not compacting the world.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The visual first compares used tokens with reserved tokens. The important column is waste. With naive reservation, every request carries a long unused tail. With paged allocation, each request receives only the blocks it needs, plus a small amount of slack in the final block. The point is not that memory becomes free. The point is that unused future tokens stop blocking real current users.',
        'The block-table view then shows why logical and physical order do not need to match. A sequence can be contiguous in token space while scattered in memory space. The continuous-batching view shows the scheduling payoff: once cache ownership is block based, the server can admit, retire, and preempt requests at token boundaries.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is simple if the block table is correct. Attention for token t needs the keys and values for earlier tokens. PagedAttention still supplies those exact tensors. It only changes how the tensors are addressed. The model sees the same numerical state it would have seen in a contiguous cache layout.',
        'The performance argument is about utilization. GPU HBM is scarce, and decode kernels are most efficient when the server can keep many active sequences in flight. Smaller allocation units let the system turn stranded capacity into additional concurrency. The serving engine can trade a little indexing complexity for a large reduction in wasted cache reservation.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'PagedAttention is not free. The attention kernel must handle indirect block lookup, the scheduler must maintain block ownership, and the runtime needs reference counts for shared prefixes or beam branches. Bugs in this layer are serious because a stale mapping can expose cache from another request or make the model attend to the wrong tokens.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Nvidia_GV100_GPU.png', alt: 'Nvidia GV100 GPU die with many processing blocks', caption: 'The benefit is economic only if block lookup overhead is smaller than the HBM capacity recovered for more live sequences. Source: Wikimedia Commons, Nvidia, public domain.'},
        'There is also a tuning problem. Smaller blocks reduce slack but increase table size and lookup overhead. Larger blocks reduce metadata but waste more space in the last block. The best size depends on model shape, average sequence length, hardware, kernel design, and whether prefix sharing or offload is common.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'PagedAttention wins in high-concurrency services with variable prompt and output lengths: public chat APIs, internal copilots, RAG systems, coding agents, batch inference jobs, and any serving pool that mixes short and long requests. It is especially useful when the server runs near memory capacity and a small reduction in waste admits many more live sequences.',
        'It also enables features that are awkward with slab allocation. Beam search can share prefix blocks and copy on write after divergence. Prefix caching can reuse system prompts or common documents. Preemption can evict or transfer blocks. Tiered KV systems can move blocks across HBM, CPU memory, SSD, or remote storage while keeping a stable logical identity.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'PagedAttention does not reduce the true byte cost of KV cache. A long active context still consumes memory proportional to layers, heads, head dimension, precision, and token count. It reduces fragmentation and improves control. If demand is dominated by extremely long contexts, the system still needs admission control, context limits, offload policy, or more hardware.',
        'It is also different from FlashAttention. FlashAttention improves IO efficiency inside attention computation. PagedAttention manages long-lived KV storage across requests. A mature serving stack often uses both, along with quantization, chunked prefill, speculative decoding, and routing. Confusing these layers leads to wrong performance explanations.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study KV Cache first, because PagedAttention is an allocator for that state. Then read Attention Mechanism, FlashAttention Case Study, Prefix Caching and RadixAttention, Chunked Prefill Token Budget Scheduler, Speculative Decoding, Prefill and Decode Disaggregation, KV Cache Transfer Fabric, KV Cache Tiered Offload Store, SLO-Aware LLM Request Router, Tail Latency, and Transformer Inference Roofline.',
        'Primary references worth reading are the PagedAttention paper, the vLLM project and documentation, and Orca iteration-level scheduling. They show the same lesson from different angles: production LLM serving is a memory-management and scheduling problem as much as it is a model problem.',
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        "Trace one representative example end-to-end so readers can watch state evolve across every step.",
        "Keep the walkthrough concise and precise: at each step, write current state, action taken, and resulting output.",
        "The goal is prediction, not a one-off demonstration.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why LLM Serving: PagedAttention moves from input to output in the animation and where it fails, you are ready for the next topic.',
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
],
};

