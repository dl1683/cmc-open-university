// CUDA graph shape cache: captured GPU work graphs indexed by hot serving
// shapes, with fallback, eviction, and recapture policy.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'cuda-graph-shape-cache',
  title: 'CUDA Graph Shape Cache',
  category: 'Systems',
  summary: 'A serving-runtime cache: hash hot batch and sequence shapes to captured CUDA graphs, replay them cheaply, and fall back safely when shapes drift.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['cache lookup', 'dynamic shapes'], defaultValue: 'cache lookup' },
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

function shapeCacheGraph(title) {
  return graphState({
    nodes: [
      { id: 'request', label: 'req', x: 0.7, y: 3.8, note: 'decode' },
      { id: 'shape', label: 'key', x: 2.3, y: 3.8, note: 'shape' },
      { id: 'cache', label: 'cache', x: 4.0, y: 3.8, note: 'graphs' },
      { id: 'hit', label: 'hit', x: 5.5, y: 2.0, note: 'replay' },
      { id: 'miss', label: 'miss', x: 5.5, y: 5.6, note: 'fallback' },
      { id: 'capture', label: 'capture', x: 7.2, y: 5.6, note: 'warmup' },
      { id: 'replay', label: 'replay', x: 7.2, y: 2.0, note: 'one launch' },
      { id: 'lru', label: 'LRU', x: 8.8, y: 3.8, note: 'evict' },
    ],
    edges: [
      { id: 'e-request-shape', from: 'request', to: 'shape' },
      { id: 'e-shape-cache', from: 'shape', to: 'cache' },
      { id: 'e-cache-hit', from: 'cache', to: 'hit' },
      { id: 'e-cache-miss', from: 'cache', to: 'miss' },
      { id: 'e-hit-replay', from: 'hit', to: 'replay' },
      { id: 'e-miss-capture', from: 'miss', to: 'capture' },
      { id: 'e-capture-lru', from: 'capture', to: 'lru' },
      { id: 'e-replay-lru', from: 'replay', to: 'lru' },
    ],
  }, { title });
}

function* cacheLookup() {
  const cacheNodes = 8;
  const cacheEdges = 8;
  const keyFields = 6;
  const entryFields = 5;

  yield {
    state: shapeCacheGraph('Captured CUDA graphs are looked up by shape'),
    highlight: { active: ['request', 'shape', 'cache', 'e-request-shape', 'e-shape-cache'], compare: ['hit', 'miss'] },
    explanation: `CUDA graphs reduce launch overhead only when the runtime can replay a previously captured graph. The ${cacheNodes}-node pipeline needs a shape cache: compute a key for the hot decode shape, look it up across ${cacheEdges} transitions, and choose replay or fallback.`,
  };

  yield {
    state: labelMatrix(
      'Shape cache key',
      [
        { id: 'model', label: 'model' },
        { id: 'batch', label: 'batch size' },
        { id: 'seq', label: 'sequence step' },
        { id: 'dtype', label: 'dtype' },
        { id: 'device', label: 'device' },
        { id: 'pool', label: 'memory pool' },
      ],
      [
        { id: 'key part', label: 'key part' },
        { id: 'breaks replay if', label: 'breaks replay if' },
      ],
      [
        ['weights path', 'different kernels'],
        ['lane count', 'grid dims change'],
        ['decode/prefill shape', 'topology changes'],
        ['precision', 'kernel variant changes'],
        ['GPU id', 'addresses differ'],
        ['static buffers', 'pointers differ'],
      ],
    ),
    highlight: { active: ['batch:key part', 'seq:key part', 'pool:breaks replay if'], found: ['device:breaks replay if'] },
    explanation: `The key must cover all ${keyFields} assumptions baked into capture: kernel topology, tensor shapes, dtype, device, and often memory addresses. If any of the ${keyFields} fields drift, replay can be wrong or impossible.`,
    invariant: `A CUDA graph cache is only safe when the key covers all ${keyFields} replay assumptions — missing even 1 can corrupt results.`,
  };

  yield {
    state: shapeCacheGraph('Hot shapes replay; cold shapes fall back'),
    highlight: { active: ['cache', 'hit', 'replay', 'e-cache-hit', 'e-hit-replay'], compare: ['miss', 'capture'], found: ['lru'] },
    explanation: `Most decode traffic concentrates on a small set of hot shapes across the ${cacheNodes} cache nodes. Those shapes should replay from cache. Rare shapes should use eager kernels or a fallback path until they prove worth capturing.`,
  };

  yield {
    state: labelMatrix(
      'Cache entry fields',
      [
        { id: 'graph', label: 'graph exec' },
        { id: 'buffers', label: 'static buffers' },
        { id: 'warmup', label: 'warmup count' },
        { id: 'hits', label: 'hit stats' },
        { id: 'fallback', label: 'fallback' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['captured replay object', 'one launch'],
        ['stable addresses', 'safe replay'],
        ['capture threshold', 'avoid cold waste'],
        ['latency and count', 'eviction policy'],
        ['eager callable', 'correctness path'],
      ],
    ),
    highlight: { found: ['graph:stores', 'buffers:stores', 'fallback:stores'], compare: ['warmup:why'] },
    explanation: `A useful entry stores more than a graph handle. Each of the ${entryFields} fields — static buffers, hit statistics, capture threshold state, fallback — makes replay legal and safe.`,
  };
}

function* dynamicShapes() {
  const topShapes = 4;
  const responseStrategies = 4;
  const opChecks = 5;
  const dataPoints = 7;

  yield {
    state: plotState({
      axes: { x: { label: 'ranked serving shapes', min: 1, max: 10 }, y: { label: 'traffic share', min: 0, max: 0.5 } },
      series: [
        { id: 'share', label: 'shape traffic', points: [{ x: 1, y: 0.42 }, { x: 2, y: 0.21 }, { x: 3, y: 0.12 }, { x: 4, y: 0.07 }, { x: 5, y: 0.05 }, { x: 8, y: 0.02 }, { x: 10, y: 0.01 }] },
      ],
      markers: [
        { id: 'cutoff', x: 4, y: 0.07, label: 'capture top 4' },
      ],
    }),
    highlight: { active: ['share', 'cutoff'] },
    explanation: `Shape caching usually follows a heavy tail. The ${dataPoints} sampled points show why: capture the top ${topShapes} hot shapes and let rare shapes fall back. Capturing everything wastes memory and warmup time.`,
  };

  yield {
    state: labelMatrix(
      'Dynamic-shape responses',
      [
        { id: 'pad', label: 'pad to bucket' },
        { id: 'recapture', label: 'recapture' },
        { id: 'fallback', label: 'eager fallback' },
        { id: 'conditional', label: 'conditional graph' },
      ],
      [
        { id: 'helps', label: 'helps' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['more hits', 'extra compute'],
        ['new hot shape', 'warmup and memory'],
        ['correctness', 'launch overhead'],
        ['limited dynamism', 'API/tooling limits'],
      ],
    ),
    highlight: { active: ['pad:helps', 'fallback:helps'], compare: ['pad:cost', 'recapture:cost'] },
    explanation: `Dynamic traffic is not one problem — there are ${responseStrategies} distinct strategies. Padding to buckets raises hit rate but burns compute. Recapture helps if a shape becomes hot. Fallback keeps correctness for rare shapes.`,
  };

  yield {
    state: shapeCacheGraph('LRU evicts stale graph entries'),
    highlight: { active: ['capture', 'replay', 'lru', 'e-capture-lru', 'e-replay-lru'], compare: ['miss'], found: ['hit'] },
    explanation: `Captured graphs consume memory and may pin buffers. With only the top ${topShapes} shapes cached, the LRU policy evicts cold entries, stale model versions, or shapes that no longer match live traffic.`,
  };

  yield {
    state: labelMatrix(
      'Operational checks',
      [
        { id: 'hit', label: 'hit rate' },
        { id: 'fallback', label: 'fallback rate' },
        { id: 'latency', label: 'latency delta' },
        { id: 'memory', label: 'graph memory' },
        { id: 'correct', label: 'correctness' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'bad sign', label: 'bad sign' },
      ],
      [
        ['are hot shapes covered?', 'cache churn'],
        ['are misses common?', 'too many shapes'],
        ['does replay help?', 'no speedup'],
        ['are buffers pinned?', 'OOM pressure'],
        ['same outputs?', 'numerical drift'],
      ],
    ),
    highlight: { active: ['hit:bad sign', 'fallback:bad sign', 'memory:bad sign', 'correct:bad sign'] },
    explanation: `A shape cache needs observability across all ${opChecks} checks. If hit rate is low, replay latency is unchanged, or memory pressure rises, the cache is not paying for itself.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'cache lookup') yield* cacheLookup();
  else if (view === 'dynamic shapes') yield* dynamicShapes();
  else throw new InputError('Pick a CUDA graph shape-cache view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The "cache lookup" view traces a single inference request through the shape cache pipeline: key extraction, cache probe, hit/miss decision, and replay or fallback. The "dynamic shapes" view shows how traffic distributes across shapes and how the cache responds with padding, recapture, or eviction. Watch which nodes light up at each step -- the highlighted path is the one the runtime actually takes for that request.',
        {type: 'image', src: './assets/gifs/cuda-graph-shape-cache.gif', alt: 'Animated walkthrough of the cuda graph shape cache visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A GPU kernel -- a single operation like a matrix multiply or an activation function -- runs fast once it starts. But the CPU must set up every kernel launch: allocate memory, bind arguments, configure thread grids, and submit the work to the GPU driver. For a large language model serving a decode step, the CPU might launch 50-200 small kernels in sequence. Each launch costs roughly 5-15 microseconds of CPU overhead. At 100 kernels per step, that is 0.5-1.5 milliseconds of pure launch tax per token.',
        { type: 'callout', text: 'A shape cache turns repeated GPU launch structure into a keyed replay contract instead of recomputing kernel submissions.' },
        'CUDA graphs solve this by recording a sequence of kernel launches into a graph object, then replaying the entire sequence with a single CPU call. Replay overhead drops to roughly 5-10 microseconds total, regardless of how many kernels the graph contains. But replay is only valid when the recorded assumptions still hold: tensor shapes, kernel configurations, device pointers, and memory addresses must match exactly what was captured.',
        'LLM serving breaks those assumptions constantly. Batch sizes change as requests arrive and complete. Sequence lengths grow with each generated token. Prefill and decode use different computation patterns. Memory allocators may relocate buffers. The shape cache sits between CUDA graphs and the serving runtime, deciding which input configurations are stable enough to capture and replay, and which must fall back to ordinary eager kernel-by-kernel execution.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest strategy is eager execution: for every decode step, launch each kernel individually. The CPU walks the model graph, submits each operation to the GPU, and waits for completion signals as needed. This is fully general -- it handles any batch size, any sequence length, any control flow, and any buffer reallocation without coordination.',
        'Eager execution also requires zero setup. There is no capture phase, no warmup, no cache to maintain, no invalidation logic. If the model changes or memory moves, the next eager step just launches the new kernels. For prototyping and low-traffic workloads, eager execution is perfectly adequate.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears at serving scale. A decode loop for a batched LLM request might execute the same kernel sequence 512 or 2048 times -- once per generated token. If each step launches 100 kernels and each launch costs 10 microseconds, the CPU overhead is 1 millisecond per step. Over 1024 tokens, that is 1.024 seconds of pure launch overhead -- time the GPU sits idle waiting for the CPU to finish submitting work.',
        'The opposite extreme, capturing every possible shape, is also wasteful. A capture pass runs each kernel once to record it, consuming warmup time and allocating GPU memory for the graph object and its pinned buffers. If a shape appears only twice, the capture cost exceeds the replay savings. Rare shapes consume memory without earning it back.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A captured CUDA graph is not a generic "compiled version" of a computation. It is a frozen record of exactly which kernels ran, in exactly which order, with exactly which grid dimensions, on exactly which device memory addresses. Replaying the graph does not re-derive any of those decisions -- it just resubmits the same work. This means the cache key must encode every assumption baked into capture: model identity, batch size bucket, decode versus prefill mode, sequence length class, numeric precision (dtype), GPU device ID, and memory pool identity.',
        { type: 'image', src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Directed_acyclic_graph.svg', alt: 'Directed acyclic graph with arrows between ordered tasks', caption: 'CUDA graph capture records an execution DAG; shape caching decides which DAG instances are safe to replay. Source: https://commons.wikimedia.org/wiki/File:Directed_acyclic_graph.svg.' },
        'Miss any one field and the replay can silently produce wrong outputs. For example, if the key omits dtype and the model switches from FP16 to BF16, the cached graph replays FP16 kernels on BF16 data. The GPU runs them without complaint -- the shapes still fit -- but the arithmetic is wrong. The cache is not a memoized function result. It is memoized execution structure, and the key must prove that the old structure still applies.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The runtime tracks how often each shape key appears. When a shape crosses a warmup threshold -- say, 3 consecutive appearances -- the runtime performs a capture pass. During capture, it runs the kernel sequence once with CUDA graph recording active. The driver records every kernel launch, memory copy, and synchronization into a graph object. The runtime stores this graph in a hash map keyed by the shape tuple, alongside the static buffers the graph depends on, a hit counter, a last-used timestamp, and a pointer to the eager fallback path.',
        { type: 'image', src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Nvidia_CUDA_Logo.jpg', alt: 'NVIDIA CUDA logo', caption: 'The cache sits at the CUDA execution layer, where captured GPU work can be replayed instead of relaunched piece by piece. Source: https://commons.wikimedia.org/wiki/File:Nvidia_CUDA_Logo.jpg.' },
        'On subsequent requests, the runtime computes the shape key and probes the cache. A hit verifies that the graph\'s memory addresses are still valid (buffers have not been reallocated), then replays the graph with a single launch call. A miss routes to the eager path and increments the miss counter for that shape. If the shape keeps missing but traffic is high, the runtime may eventually capture it.',
        'When an unusual batch size arrives -- say batch 5 when only batches 1, 2, 4, and 8 are cached -- the runtime has three options. It can pad the batch to 8, wasting 3 slots of compute but replaying a cached graph. It can run eager fallback, paying launch overhead but using exact compute. Or it can count misses and capture batch 5 if it becomes frequent. Each option trades latency against wasted compute against memory pressure.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is straightforward: if the key covers every assumption baked into capture, then replay executes the same kernels on the same buffer layout as the original run. The key is a proof that the old execution plan is still valid. The safety guarantee degrades gracefully -- on any key mismatch, the runtime falls back to eager execution, which is always correct.',
        'The performance argument depends on the workload. Serving traffic concentrates on a small number of hot shapes. Empirically, the top 3-5 batch-size buckets typically account for 80-90% of decode steps. Capturing only those shapes means the cache is small (a few dozen megabytes of graph memory), the hit rate is high (80%+), and the launch overhead reduction applies to the vast majority of tokens generated. LRU eviction reclaims memory from shapes that fall out of the hot set, preventing unbounded growth.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Capture cost: each graph capture runs the full kernel sequence once to record it. For a 100-kernel decode step, that is roughly 1 millisecond of GPU time plus the graph object allocation (typically a few MB per graph). With 4 hot shapes, total graph memory is 10-20 MB -- small relative to the model weights.',
        'Pinned buffer cost: a captured graph may reference specific device memory addresses. If the allocator moves those buffers, the graph is invalid. Practical implementations either pin buffers for cached shapes (preventing the allocator from reclaiming them) or use a stable memory pool that guarantees addresses do not change between captures. Pinning means the allocator has less flexibility, which can increase fragmentation under memory pressure.',
        'Operational cost: the cache needs monitoring. Key metrics are hit rate (target: >80%), fallback rate (should be declining or stable), replay latency versus eager latency (should show a clear gap), graph memory (should not grow without bound), and output correctness (numerical outputs must match eager execution within tolerance). A cache with a 40% hit rate and 20 MB of pinned graph memory is probably not earning its keep.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The primary use is LLM token generation in serving systems. vLLM, TensorRT-LLM, and PyTorch\'s CUDAGraph integration all implement shape-keyed graph caches for decode steps. The pattern also appears in speech recognition (fixed-length audio chunk processing), recommendation models (fixed batch sizes from load balancers), and any inference workload where the same kernel sequence runs millions of times with predictable input shapes.',
        'The cache works best when the scheduler cooperates. Length-aware batching groups requests by similar sequence length, creating fewer distinct shapes. Fixed decode buckets (powers of 2) reduce the key space. Stable memory pools guarantee address validity. These are not independent optimizations -- the scheduler and the cache should be co-designed, because a scheduler that produces 50 unique batch sizes per second will thrash the cache.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The cache fails when shapes are too dynamic. If every request produces a unique batch size, the cache never accumulates enough hits on any shape to justify capture. This happens with highly variable traffic, request-level batching (batch-1 per request), or models with data-dependent control flow that changes the kernel sequence.',
        'It also fails when the key is incomplete. Replaying a graph captured for FP16 on BF16 data, or for model version 3 after the weights have been updated to version 4, produces silent numerical errors. These bugs are particularly dangerous because they look like performance optimizations -- latency improves, throughput increases -- until someone checks output quality. The most critical correctness invariant is that the eager fallback path must always be available and must be the default for any key uncertainty.',
        'Finally, it can fail economically. If the warmup threshold is too low, the cache captures shapes that appear briefly and then vanish, wasting capture time and pinning buffers for nothing. If the threshold is too high, hot shapes spend too many steps in eager mode before being captured. Tuning these thresholds requires workload-specific profiling, not rules of thumb.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider an LLM serving system with a decode kernel sequence of 80 kernels. Eager launch overhead is 10 us per kernel, so 800 us per decode step. Graph replay overhead is 8 us total. The savings per step are 792 us. Over a 1024-token generation, that is 811 ms saved per request.',
        'The runtime sees four hot batch sizes: 1, 2, 4, and 8. It sets a warmup threshold of 3 consecutive hits. Batch-4 requests arrive 3 times in a row; the runtime captures a graph for key (model=v2, batch=4, mode=decode, dtype=fp16, device=0, pool=main). The capture costs 1.2 ms of GPU time and allocates 4 MB of graph memory. From step 4 onward, every batch-4 decode replays the graph at 8 us instead of 800 us.',
        'Now a batch-5 request arrives. No cache entry exists. The runtime runs eager fallback (800 us) and increments the miss counter for batch-5. If batch-5 appears 3 more times, the runtime captures it. Alternatively, the scheduler could pad batch-5 to batch-8 -- this wastes 3/8 = 37.5% of the compute on padding tokens but gets the replay benefit of 8 us. Whether padding is worth it depends on how often batch-5 appears and how much the wasted compute costs relative to the 792 us launch savings.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: NVIDIA CUDA Graphs programming guide (https://docs.nvidia.com/cuda/cuda-programming-guide/), NVIDIA CUDA Graph best practices for PyTorch (https://docs.nvidia.com/dl-cuda-graph/), PyTorch CUDA Graphs blog (https://pytorch.org/blog/accelerating-pytorch-with-cuda-graphs/), and vLLM serving documentation (https://docs.vllm.ai/). For the underlying graph execution model, see the CUDA driver API reference on cudaGraphLaunch and cudaStreamBeginCapture.',
        'Study next: Hash Table and LRU Cache for the data structure internals, KV Cache for how serving systems manage per-request state, Length-Aware Batching for how schedulers create reusable shapes, LLM Continuous Batching for the serving context in which shape caches operate, GPU Memory Pool Fragmentation Ledger for the memory management challenges, and Transformer Inference Roofline for understanding when launch overhead versus compute versus memory bandwidth is the actual bottleneck.',
      ],
    },
  ],
};
