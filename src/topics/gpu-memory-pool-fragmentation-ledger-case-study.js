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
      heading: 'Why this exists',
      paragraphs: [
        'GPU allocation is too expensive and synchronization-heavy to treat like ordinary throwaway memory in hot inference paths. Frameworks keep memory in pools so tensors can reuse device blocks without returning every free to the driver.',
        'That creates a new failure mode: reserved memory can be high while live tensor memory is lower, and fragmentation can make a large allocation fail even when total free bytes look sufficient. The allocator needs a ledger, not guesses from nvidia-smi.',
      ],
    },
    {
      heading: 'The tempting wrong answer',
      paragraphs: [
        'The wrong answer is to read nvidia-smi as live tensor memory. Cached allocator memory can appear as used even when it is available for reuse inside the process.',
        'Another wrong answer is to call empty_cache whenever an OOM appears. That may help other processes see memory, but it does not fix live tensors, bad shape churn, missing large blocks, or graph address assumptions.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The data-structure idea is familiar from buddy allocators and slab size classes: round, bin, split, cache, reuse, and occasionally release. GPU pools add stream order, driver synchronization, CUDA graph replay, and non-framework allocations.',
        'PyTorch exposes allocated and reserved memory counters, memory_stats, memory_summary, and allocator snapshots. The difference between live allocated bytes, reserved bytes, cached free blocks, split fragments, largest free block, and driver-side memory is the difference between a useful OOM report and superstition.',
        'A good allocator ledger separates several questions that are often blurred together. How many bytes are live tensors? How many bytes are reserved by the process? How many reserved bytes are reusable without calling the driver? What is the largest contiguous block? Which bins are fragmented? Which stream last used the block? Which CUDA graph assumes this address? Each answer points to a different fix.',
      ],
    },
    {
      heading: 'How the allocator state is structured',
      paragraphs: [
        'The pool-bins view shows request rounding, bin selection, block splitting, active tensors, cached free blocks, and release back to the driver. The reserved-versus-active table is the key: reserved memory is not the same as live tensor memory.',
        'The stream-order view shows why freeing a pointer is not just deleting it from a map. If another stream may use the pointer, events or waits must prove use is complete before reuse. CUDA graph replay adds another constraint: captured graphs may assume stable addresses.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'A GPU memory ledger is useful for LLM inference workers with mixed request sizes, CUDA graph shape caches, temporary workspaces, and PagedAttention-style KV block pools. Fixed-size KV blocks reduce contiguous-allocation pressure and let requests grow, share, and evict sequence memory in smaller units.',
        'A concrete case: live tensor memory is 38 GB on an 80 GB GPU, reserved memory is 72 GB, and a new 2 GB workspace fails. The snapshot shows many smaller cached blocks and no large free block. The fix is shape bucketing, split-policy tuning, stable graph buffers, and admission limits for outlier requests.',
        'The same thinking applies outside LLM serving. Training jobs create temporary activations, optimizer buffers, communication workspaces, and checkpoint staging areas. Inference services create prefill buffers, decode buffers, KV caches, graph-captured workspaces, and library allocations. The allocator is where those lifetimes collide.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Do not mix streams without explicit order. Do not ignore non-framework allocations such as NCCL. Do not capture CUDA graphs without preserving address and shape assumptions. Do not tune split policies without allocator snapshots and workload-specific OOM evidence.',
        'A pool is not a garbage collector. It makes reuse fast after the program establishes correct lifetime ordering. The release gate should track OOM rate, largest free block, reserved-minus-active bytes, graph-cache hit rate, and p99 latency.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Pooling works because many workloads repeat allocation sizes. If every request allocates and frees through the driver, the service pays synchronization and bookkeeping costs on a hot path. A pool keeps blocks nearby and reuses them when lifetimes are known to be complete. That turns expensive global allocation into cheaper local bookkeeping.',
        'Fragmentation is the cost of that speed. Splitting a large block can make several small requests fast while destroying the ability to satisfy a later large request. Releasing everything to the driver can restore global free memory while hurting latency and graph assumptions. The allocator policy is therefore a workload-specific tradeoff, not a universal setting.',
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        'Track active bytes, reserved bytes, inactive split bytes, largest free block, allocation retries, OOMs by requested size, stream-wait counts, graph pool usage, non-framework memory, and memory by request shape. These counters let teams distinguish real capacity shortage from fragmentation, leaks, and shape churn.',
        'The most useful debugging artifact is a timeline: which request shape arrived, which blocks it needed, which bins were split, when a graph pool pinned memory, and what allocation failed. Without that timeline, teams often change batch size, call empty_cache, or blame the driver without knowing which lifetime caused the failure.',
      ],
    },
    {
      heading: 'A worked serving example',
      paragraphs: [
        'Consider an inference worker serving a mix of 2k, 8k, and 32k-token prompts. The 2k prompts reuse small prefill buffers well. The 8k prompts split medium blocks. Then one 32k prompt asks for a large contiguous workspace and fails, even though the process reports many free cached bytes. The allocator has memory, but not in the shape the request needs.',
        'The fix is not one magic call. The team can bucket prompt lengths so shapes repeat, reserve a separate workspace for rare large requests, limit admission of outlier prompts, tune split thresholds, or move KV cache to fixed-size pages. Each fix changes the block-shape distribution. That is why the ledger must report largest free block and inactive split bytes, not only total memory.',
        'This example also explains why memory bugs can look nondeterministic. The same request may succeed after a restart because the pool is clean, then fail after hours of mixed traffic because the block history changed. Fragmentation is history-dependent. A useful article must teach that allocator state is not a static capacity number; it is the accumulated shape of previous requests.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'GPU memory pools are data structures for latency and reuse. They make hot allocation paths fast by reserving, binning, splitting, and reusing blocks. They also create fragmentation and visibility problems if teams read only coarse device-memory totals.',
        'The deep lesson is to debug memory by lifetime and block shape, not by one total number. Live tensors, reserved cache, split fragments, graph-pinned addresses, and external library allocations are different states in the ledger.',
        'For course design, this topic should follow ordinary allocators and precede LLM serving. Students need to see that the same split-and-reuse ideas from CPU allocators become more constrained on GPUs because streams, graph capture, and accelerator memory pressure make lifetimes harder to reason about.',
        'The wrong tool is a single memory gauge. A dashboard that shows only used GPU memory hides the allocator state that determines whether the next request can run. The correct artifact is a ledger that connects allocation request, block source, stream safety, split history, and failure reason. That is what lets an engineer choose between admission control, shape bucketing, pool tuning, graph-cache changes, and model-size reduction.',
        'If students remember one diagnostic question, make it this: did the system run out of bytes, or did it run out of the right block at the right time? Those are different failures with different fixes.',
        'The comparison to CPU allocators is useful but incomplete. GPU pools live inside accelerator scheduling, stream ordering, graph capture, and request admission. That makes allocator state part of the serving control plane, not just a low-level runtime detail.',
        'A mature service treats allocator policy like capacity policy: measured, reviewed, and changed with evidence.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: PyTorch CUDA memory management at https://docs.pytorch.org/docs/2.12/notes/cuda.html#memory-management, PyTorch memory snapshot tooling at https://docs.pytorch.org/docs/2.12/torch_cuda_memory.html, NVIDIA stream-ordered allocation docs at https://docs.nvidia.com/cuda/cuda-programming-guide/04-special-topics/stream-ordered-memory-allocation.html, NVIDIA cudaMallocAsync introduction at https://developer.nvidia.com/blog/using-cuda-stream-ordered-memory-allocator-part-1/, and vLLM PagedAttention design at https://docs.vllm.ai/en/latest/design/paged_attention/. Study Buddy Allocator Free Lists, Slab Allocator & Size Classes, TLSF Real-Time Allocator Bitmap Index, CUDA Graph Shape Cache, Inference Kernel Fusion & CUDA Graphs, LLM Serving: PagedAttention, KV Cache Concurrency Capacity Model, Length-Aware Batching for LLM Serving, and GPU All-Reduce next.',
      ],
    },
  ],
};
