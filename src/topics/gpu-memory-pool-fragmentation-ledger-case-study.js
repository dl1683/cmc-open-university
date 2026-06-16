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
      heading: 'What it is',
      paragraphs: [
        'A GPU memory pool is an allocator layer that keeps device memory around for reuse instead of returning every freed tensor to the driver. That makes allocation fast, avoids device-wide synchronization, and lets frameworks shape memory behavior around tensors, streams, CUDA graphs, and serving workloads.',
        'The data-structure idea is familiar from Buddy Allocator Free Lists and Slab Allocator & Size Classes: round, bin, split, cache, reuse, and occasionally release. The GPU twist is that stream order, driver synchronization, CUDA graph replay, and non-framework libraries all affect whether reuse is safe and visible.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'PyTorch documents that its CUDA caching allocator speeds allocations and allows fast deallocation without device synchronization, while unused cached memory can still appear as used in nvidia-smi. It exposes allocated and reserved memory counters, memory_stats, memory_summary, and allocator snapshots: https://docs.pytorch.org/docs/2.12/notes/cuda.html#memory-management.',
        'The native allocator can split cached blocks. That is useful until fragmentation prevents a large request from fitting. PyTorch exposes allocator configuration such as max_split_size_mb, and its memory snapshot tooling records allocator state and allocation history for debugging: https://docs.pytorch.org/docs/2.12/torch_cuda_memory.html.',
      ],
    },
    {
      heading: 'Stream-ordered pools',
      paragraphs: [
        'CUDA stream-ordered allocation changes the lifetime model. NVIDIA documents cudaMallocAsync and cudaFreeAsync as stream-ordered APIs that avoid potentially costly synchronization and use memory pools for reuse: https://docs.nvidia.com/cuda/cuda-programming-guide/04-special-topics/stream-ordered-memory-allocation.html. NVIDIA introduced the APIs as a way to shift allocation and free from global synchronizing operations into stream-ordered operations: https://developer.nvidia.com/blog/using-cuda-stream-ordered-memory-allocator-part-1/.',
        'The correctness rule is strict. If memory is accessed by another stream, events or stream waits must prove the allocation has happened before use and all uses are complete before free. A pool is not a garbage collector; it only makes reuse fast after the program establishes the proper ordering.',
      ],
    },
    {
      heading: 'Complete case study: fragmented inference worker',
      paragraphs: [
        'An LLM inference worker runs mixed request sizes. Live tensor memory is 38 GB on an 80 GB GPU, but reserved memory is 72 GB and a new 2 GB workspace allocation fails. The allocator has many cached 256 MB and 512 MB blocks, no free 2 GB block, and several CUDA graph captures that require stable addresses for hot shape buckets.',
        'The fix is not just calling empty_cache. The team captures a memory snapshot, identifies the stack that creates large transient workspaces, buckets sequence lengths more consistently, tunes block splitting, keeps graph-captured buffers in a separate stable pool, and rejects outlier requests before they fragment the worker. The release gate tracks OOM rate, largest free block, reserved-minus-active bytes, graph-cache hit rate, and p99 latency.',
      ],
    },
    {
      heading: 'KV-cache pools',
      paragraphs: [
        'LLM serving adds a specialized allocator: the KV-cache block pool. vLLM PagedAttention stores KV cache in separate blocks, with BLOCK_SIZE representing the number of tokens in a block: https://docs.vllm.ai/en/latest/design/paged_attention/. The same lesson applies: fixed-size blocks reduce contiguous-allocation pressure and make it possible to grow, share, and evict sequence memory in units smaller than a whole request.',
      ],
    },
    {
      heading: 'Pitfalls and study next',
      paragraphs: [
        'Do not read nvidia-smi as live tensor memory. Do not assume empty_cache will make a live workload fit. Do not mix streams without explicit order. Do not ignore non-framework allocations such as NCCL. Do not capture CUDA graphs without preserving address and shape assumptions. Do not tune split policies without allocator snapshots and workload-specific OOM evidence.',
        'Study Buddy Allocator Free Lists, Slab Allocator & Size Classes, TLSF Real-Time Allocator Bitmap Index, CUDA Graph Shape Cache, Inference Kernel Fusion & CUDA Graphs, LLM Serving: PagedAttention, KV Cache Concurrency Capacity Model, Length-Aware Batching for LLM Serving, and GPU All-Reduce next.',
      ],
    },
  ],
};
