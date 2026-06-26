// GPU memory pool fragmentation: reserved versus allocated memory, bin reuse,
// stream-ordered frees, graph replay addresses, and OOM incident ledgers.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'gpu-memory-pool-fragmentation-ledger-case-study',
  title: 'GPU Memory Pool Fragmentation Ledger',
  category: 'Systems',
  summary: 'A GPU allocator case study: caching pools, split blocks, reserved-versus-allocated memory, stream-ordered frees, CUDA graph address stability, and OOM audits.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['pool bins', 'stream order', 'oom audit'], defaultValue: 'pool bins' },
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

function poolGraph(title) {
  return graphState({
    nodes: [
      { id: 'req', label: 'request', x: 0.7, y: 3.6, note: 'tensor' },
      { id: 'round', label: 'round', x: 2.0, y: 3.6, note: 'bin' },
      { id: 'small', label: 'small bin', x: 3.8, y: 2.0, note: '<large' },
      { id: 'large', label: 'large bin', x: 3.8, y: 5.2, note: 'segments' },
      { id: 'split', label: 'split', x: 5.6, y: 3.6, note: 'block' },
      { id: 'active', label: 'active', x: 7.2, y: 2.0, note: 'tensor' },
      { id: 'cached', label: 'cached', x: 7.2, y: 5.2, note: 'free' },
      { id: 'driver', label: 'driver', x: 9.0, y: 3.6, note: 'CUDA' },
    ],
    edges: [
      { id: 'e-req-round', from: 'req', to: 'round', weight: 'size' },
      { id: 'e-round-small', from: 'round', to: 'small', weight: 'small' },
      { id: 'e-round-large', from: 'round', to: 'large', weight: 'large' },
      { id: 'e-small-split', from: 'small', to: 'split', weight: 'reuse' },
      { id: 'e-large-split', from: 'large', to: 'split', weight: 'carve' },
      { id: 'e-split-active', from: 'split', to: 'active', weight: 'ptr' },
      { id: 'e-active-cached', from: 'active', to: 'cached', weight: 'free' },
      { id: 'e-cached-small', from: 'cached', to: 'small', weight: 'bin' },
      { id: 'e-cached-driver', from: 'cached', to: 'driver', weight: 'release' },
    ],
  }, { title });
}

function streamGraph(title) {
  return graphState({
    nodes: [
      { id: 's0', label: 'stream A', x: 0.9, y: 2.0, note: 'alloc' },
      { id: 'k0', label: 'kernel A', x: 2.6, y: 2.0, note: 'uses ptr' },
      { id: 'free', label: 'free A', x: 4.3, y: 2.0, note: 'ordered' },
      { id: 's1', label: 'stream B', x: 0.9, y: 5.0, note: 'wait?' },
      { id: 'evt', label: 'event', x: 2.6, y: 5.0, note: 'join' },
      { id: 'k1', label: 'kernel B', x: 4.3, y: 5.0, note: 'access' },
      { id: 'pool', label: 'mempool', x: 6.5, y: 3.5, note: 'reuse' },
      { id: 'graph', label: 'graph', x: 8.5, y: 3.5, note: 'addr' },
    ],
    edges: [
      { id: 'e-s0-k0', from: 's0', to: 'k0', weight: 'after alloc' },
      { id: 'e-k0-free', from: 'k0', to: 'free', weight: 'last use' },
      { id: 'e-s0-evt', from: 's0', to: 'evt', weight: 'record' },
      { id: 'e-evt-s1', from: 'evt', to: 's1', weight: 'wait' },
      { id: 'e-s1-k1', from: 's1', to: 'k1', weight: 'safe use' },
      { id: 'e-free-pool', from: 'free', to: 'pool', weight: 'return' },
      { id: 'e-pool-graph', from: 'pool', to: 'graph', weight: 'stable ptrs' },
    ],
  }, { title });
}

function* poolBins() {
  yield {
    state: poolGraph('GPU allocators cache blocks to avoid sync-heavy malloc/free'),
    highlight: { active: ['req', 'round', 'small', 'large', 'split'], found: ['active'], compare: ['driver'] },
    explanation: 'A GPU tensor allocator tries to reach a steady state: round requests, reuse cached blocks, split larger blocks when needed, and avoid calling the CUDA driver on every tensor allocation.',
  };

  yield {
    state: labelMatrix(
      'Reserved vs active',
      [
        { id: 'active', label: 'active' },
        { id: 'cached', label: 'cached' },
        { id: 'split', label: 'split' },
        { id: 'driver', label: 'driver' },
      ],
      [
        { id: 'meaning', label: 'means' },
        { id: 'signal', label: 'signal' },
      ],
      [
        ['live tensor', 'must keep'],
        ['free in pool', 'reuse fast'],
        ['tail block', 'frag risk'],
        ['not in pool', 'malloc/free'],
      ],
    ),
    highlight: { active: ['active:signal', 'cached:signal'], compare: ['split:signal'], found: ['driver:signal'] },
    explanation: 'PyTorch distinguishes tensor-occupied memory from memory reserved by the caching allocator. A high reserved value can be healthy reuse, or it can be fragmentation if the pool cannot satisfy the next large request.',
    invariant: 'Reserved memory is not the same as live tensor memory.',
  };

  yield {
    state: labelMatrix(
      'Bin ledger',
      [
        { id: 'b256', label: '256M' },
        { id: 'b512', label: '512M' },
        { id: 'b1g', label: '1G' },
        { id: 'b2g', label: '2G' },
      ],
      [
        { id: 'free', label: 'free' },
        { id: 'active', label: 'active' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['5', '11', 'ok'],
        ['2', '8', 'ok'],
        ['0', '4', 'tight'],
        ['0', '1', 'OOM'],
      ],
    ),
    highlight: { active: ['b1g:risk', 'b2g:risk'], found: ['b256:free', 'b512:free'], compare: ['b2g:free'] },
    explanation: 'Fragmentation is visible when many smaller free blocks exist but no block is large enough for the next request. The allocator may reserve a lot of memory and still fail a large allocation.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'time', min: 0, max: 10 }, y: { label: 'GB', min: 0, max: 80 } },
      series: [
        { id: 'alloc', label: 'alloc', points: [{ x: 1, y: 10 }, { x: 3, y: 32 }, { x: 5, y: 36 }, { x: 7, y: 35 }, { x: 9, y: 38 }] },
        { id: 'reserve', label: 'reserve', points: [{ x: 1, y: 12 }, { x: 3, y: 45 }, { x: 5, y: 64 }, { x: 7, y: 68 }, { x: 9, y: 72 }] },
        { id: 'freebig', label: 'big free', points: [{ x: 1, y: 30 }, { x: 3, y: 18 }, { x: 5, y: 10 }, { x: 7, y: 4 }, { x: 9, y: 1 }] },
      ],
      markers: [
        { id: 'oom', x: 9, y: 72, label: 'frag OOM' },
      ],
    }),
    highlight: { active: ['reserve', 'oom'], compare: ['alloc'], found: ['freebig'] },
    explanation: 'This OOM shape is common: live tensor memory is below device capacity, but the largest reusable block has collapsed. The incident is about pool layout, not only total bytes.',
  };
}

function* streamOrder() {
  yield {
    state: streamGraph('cudaMallocAsync ties lifetime to stream order'),
    highlight: { active: ['s0', 'k0', 'free', 'e-s0-k0', 'e-k0-free'], found: ['pool'], compare: ['s1'] },
    explanation: 'Stream-ordered allocation treats allocation and free like ordered GPU work. The pointer is valid after the allocation reaches the stream and invalid after the ordered free reaches the stream.',
  };

  yield {
    state: labelMatrix(
      'Stream rules',
      [
        { id: 'same', label: 'same stream' },
        { id: 'other', label: 'other stream' },
        { id: 'free', label: 'free' },
        { id: 'reuse', label: 'reuse' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'bad', label: 'bad' },
      ],
      [
        ['order only', 'early free'],
        ['event wait', 'race'],
        ['after uses', 'UAF'],
        ['pool ready', 'stale ptr'],
      ],
    ),
    highlight: { active: ['same:need', 'other:need', 'free:need'], removed: ['free:bad'], compare: ['reuse:bad'] },
    explanation: 'If another stream uses the pointer, events or stream waits must prove the allocation happened before use and that every use is complete before free. Without that order, reuse is unsafe.',
  };

  yield {
    state: streamGraph('CUDA graph replay wants stable addresses'),
    highlight: { active: ['pool', 'graph', 'e-pool-graph'], found: ['free'], compare: ['s0', 's1'] },
    explanation: 'CUDA graph capture can bake in pointer assumptions. Serving runtimes often allocate stable buffers per hot shape or memory-pool identity so graph replay remains legal.',
    invariant: 'A captured graph is only reusable while its address and shape assumptions hold.',
  };

  yield {
    state: labelMatrix(
      'Allocator choices',
      [
        { id: 'native', label: 'nat' },
        { id: 'async', label: 'async' },
        { id: 'graph', label: 'graph' },
        { id: 'kv', label: 'KV' },
      ],
      [
        { id: 'good', label: 'good' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['snap', 'split'],
        ['order', 'events'],
        ['stable', 'churn'],
        ['blocks', 'evict'],
      ],
    ),
    highlight: { active: ['native:good', 'async:good', 'graph:good'], found: ['kv:good'], compare: ['graph:watch'] },
    explanation: 'There is no single best GPU allocator. Native caching gives mature diagnostics, cudaMallocAsync gives stream-ordered pools, CUDA graph pools value address stability, and KV-cache pools value fixed-size blocks and eviction.',
  };
}

function* oomAudit() {
  yield {
    state: labelMatrix(
      'OOM audit packet',
      [
        { id: 'alloc', label: 'alloc' },
        { id: 'reserve', label: 'reserve' },
        { id: 'largest', label: 'largest' },
        { id: 'stack', label: 'stack' },
        { id: 'shape', label: 'shape' },
      ],
      [
        { id: 'field', label: 'field' },
        { id: 'why', label: 'why' },
      ],
      [
        ['live bytes', 'real load'],
        ['pool bytes', 'cached load'],
        ['free blk', 'frag test'],
        ['trace', 'owner'],
        ['bucket', 'repro'],
      ],
    ),
    highlight: { active: ['alloc:field', 'reserve:field', 'largest:field'], found: ['stack:field', 'shape:field'] },
    explanation: 'A useful GPU OOM report stores live bytes, reserved bytes, largest free block, allocation stack, shape bucket, stream, graph-cache key, and whether non-framework libraries hold invisible memory.',
  };

  yield {
    state: poolGraph('Snapshots turn allocator state into evidence'),
    highlight: { active: ['active', 'cached', 'split'], found: ['driver'], compare: ['req'] },
    explanation: 'Memory snapshots and summaries show whether the failure came from active tensors, cached free blocks, split fragments, driver-side allocations, or a particular stack trace.',
  };

  yield {
    state: labelMatrix(
      'Tuning ledger',
      [
        { id: 'split', label: 'split cap' },
        { id: 'empty', label: 'empty' },
        { id: 'bucket', label: 'bucket' },
        { id: 'graph', label: 'graph' },
        { id: 'kv', label: 'KV' },
      ],
      [
        { id: 'helps', label: 'helps' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['large req', 'waste'],
        ['other app', 'no fit gain'],
        ['shape reuse', 'pad cost'],
        ['CPU overhead', 'addr bind'],
        ['decode mem', 'evict miss'],
      ],
    ),
    highlight: { active: ['split:helps', 'bucket:helps', 'graph:helps'], compare: ['empty:risk'], found: ['kv:helps'] },
    explanation: 'Tuning must match the failure. A split cap may help fragmentation. Emptying the cache helps other processes but not live tensors. Shape buckets and graph pools trade padding for reuse and stable addresses.',
  };

  yield {
    state: labelMatrix(
      'Complete case',
      [
        { id: 'sym', label: 'sym' },
        { id: 'cause', label: 'cause' },
        { id: 'fix', label: 'fix' },
        { id: 'gate', label: 'gate' },
      ],
      [
        { id: 'value', label: 'val' },
        { id: 'result', label: 'out' },
      ],
      [
        ['res>act', 'frag'],
        ['2G fail', 'no blk'],
        ['bucket', 'fits'],
        ['p99/OOM', 'ship'],
      ],
    ),
    highlight: { active: ['sym:value', 'cause:result'], found: ['fix:result'], compare: ['gate:value'] },
    explanation: 'Case study: an inference worker reports OOM with live tensors far below capacity. The snapshot shows many split leftovers and no 2 GB block. The fix is stable shape buckets plus a split policy, gated on OOM rate and p99 latency.',
  };

  yield {
    state: streamGraph('KV-cache block pools are allocator design too'),
    highlight: { active: ['pool', 'graph'], found: ['s0', 's1'], compare: ['free'] },
    explanation: 'PagedAttention-style serving splits KV cache into fixed-size blocks. That is allocator design applied to sequence memory: reduce contiguous allocation pressure and let requests grow, share, and evict in block units.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'pool bins') yield* poolBins();
  else if (view === 'stream order') yield* streamOrder();
  else if (view === 'oom audit') yield* oomAudit();
  else throw new InputError('Pick a GPU memory pool view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the pool as a ledger of block shapes, not as one memory total. Active blocks hold live tensors, cached blocks are reserved by the process for reuse, split blocks are leftovers from larger allocations, and external blocks belong to libraries outside the framework allocator.',
        'The safe inference is that a request can fail even when total free cached bytes look large. The allocator must find a block of the right size, lifetime, stream safety, and graph-capture status at the moment the request arrives.',
        {type:'callout', text:'GPU memory failures are often block-shape and lifetime failures, so the allocator ledger matters more than a single free-byte total.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/4/4a/External_Fragmentation.svg', alt:'Diagram of external memory fragmentation showing free and allocated blocks.', caption:'External fragmentation diagram by Hjasud, retouched by Incnis Mrsi, Wikimedia Commons, CC0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'GPU allocation is expensive enough that frameworks avoid calling the driver for every temporary tensor. They reserve memory, split it into blocks, cache freed blocks, and reuse those blocks on hot inference and training paths.',
        'The ledger exists because reserved memory is not the same as live tensor memory. A process can reserve 72 GB on an 80 GB GPU, have only 38 GB of live tensors, and still fail a 2 GB allocation because no suitable contiguous block is available.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to read a device-memory total from a tool such as nvidia-smi. If used memory is high, the service appears close to out of memory; if used memory is low, it appears safe.',
        'That view is too coarse for a pooled allocator. Cached memory may be reusable inside the process, while fragmented cached memory may be useless for the next large allocation.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is fragmentation plus lifetime ordering. Splitting a large block can satisfy many small requests quickly, but it can also destroy the only block large enough for a later workspace.',
        'GPU streams and CUDA graphs add more constraints. A block freed on one stream may not be safe on another until ordering is proven, and a captured graph may require stable addresses for replay.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat the allocator as a data structure with observable states. The important counters are allocated bytes, reserved bytes, inactive split bytes, largest free block, stream waits, graph-pinned memory, allocation retries, and non-framework memory.',
        'The invariant is lifetime safety. A block can be reused only after all work that may touch it is complete, and a graph-captured address cannot be casually moved without invalidating replay assumptions.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A request is rounded into a size class or bin. The allocator searches cached free blocks, may split a larger block, marks the chosen block active, and records enough stream information to know when future reuse is safe.',
        'When the tensor dies, the block usually returns to the pool instead of the driver. It may be coalesced with neighboring free blocks, kept in a bin, released under pressure, or held because a CUDA graph or stream dependency still needs it.',
        'Snapshots turn allocator state into evidence. They show which request shape consumed which blocks, which split fragments remain, and whether the next failure is a true capacity shortage or a block-shape problem.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Pooling works because many GPU workloads repeat allocation sizes. Reusing a cached block avoids driver allocation, global synchronization, and repeated setup on the latency-critical path.',
        'The correctness rule is conservative reuse. If the allocator only hands out blocks whose previous uses are complete and whose address constraints are valid, reuse preserves tensor memory semantics while reducing allocation overhead.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The time cost of a cache hit is mostly local bookkeeping, while a miss may call the driver, synchronize, or trigger retry and cleanup paths. That is why a small increase in miss rate can show up as p99 latency spikes.',
        'The space cost is reserved-minus-active memory plus fragmentation. If active tensors use 38 GB and reserved memory is 72 GB, then 34 GB is allocator-managed slack, but only the largest free block tells whether a 2 GB request can run.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'GPU memory ledgers are useful in LLM inference workers, training jobs, CUDA graph caches, temporary workspace management, PagedAttention-style KV cache pools, and services with mixed request lengths. They explain why the same request can succeed after restart and fail after hours of shape churn.',
        'They also guide concrete fixes. Shape bucketing, admission limits, split-threshold tuning, separate large-workspace pools, graph-cache policy, and KV block paging all change the distribution of block sizes and lifetimes.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A pool is not a garbage collector. It can reuse memory only when the program has established correct lifetimes, and it cannot free live tensors or external library allocations that the framework does not own.',
        'The ledger can also mislead if it hides non-framework memory. NCCL, custom kernels, CUDA libraries, and driver allocations may consume memory outside the allocator snapshot, so total device pressure still has to be reconciled.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider an 80 GB GPU serving 2k, 8k, and 32k-token prompts. After two hours, live tensors use 38 GB, reserved memory is 72 GB, inactive split blocks total 20 GB, and the largest free block is 1.3 GB.',
        'A new 32k prompt asks for a 2 GB contiguous workspace and fails. The process has 34 GB reserved-minus-active slack, but the allocator does not have the right block shape.',
        'One fix is to bucket prompts so 8k requests reuse the same medium blocks and rare 32k requests use a protected large-workspace pool. If that keeps the largest free block above 2.5 GB during mixed traffic, the same 32k request no longer depends on restart luck.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary references are PyTorch CUDA memory management at https://docs.pytorch.org/docs/2.12/notes/cuda.html#memory-management, PyTorch memory snapshot tooling at https://docs.pytorch.org/docs/2.12/torch_cuda_memory.html, NVIDIA stream-ordered allocation documentation at https://docs.nvidia.com/cuda/cuda-programming-guide/04-special-topics/stream-ordered-memory-allocation.html, NVIDIA cudaMallocAsync material at https://developer.nvidia.com/blog/using-cuda-stream-ordered-memory-allocator-part-1/, and vLLM PagedAttention design at https://docs.vllm.ai/en/latest/design/paged_attention/.',
        'Study buddy allocators, slab size classes, TLSF, CUDA graphs, LLM PagedAttention, KV cache capacity models, length-aware batching, and GPU all-reduce next. The shared question is how block shape and lifetime determine runtime behavior.',
      ],
    },
  ],
};
