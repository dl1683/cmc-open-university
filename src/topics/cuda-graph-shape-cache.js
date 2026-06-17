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
  yield {
    state: shapeCacheGraph('Captured CUDA graphs are looked up by shape'),
    highlight: { active: ['request', 'shape', 'cache', 'e-request-shape', 'e-shape-cache'], compare: ['hit', 'miss'] },
    explanation: 'CUDA graphs reduce launch overhead only when the runtime can replay a previously captured graph. A serving system therefore needs a shape cache: compute a key for the hot decode shape, look it up, and choose replay or fallback.',
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
    explanation: 'The key must cover every assumption baked into capture: kernel topology, tensor shapes, dtype, device, and often memory addresses. If those drift, replay can be wrong or impossible.',
    invariant: 'A CUDA graph cache is only safe when the key includes the replay assumptions.',
  };

  yield {
    state: shapeCacheGraph('Hot shapes replay; cold shapes fall back'),
    highlight: { active: ['cache', 'hit', 'replay', 'e-cache-hit', 'e-hit-replay'], compare: ['miss', 'capture'], found: ['lru'] },
    explanation: 'Most decode traffic often concentrates on a small set of hot shapes. Those shapes should replay from cache. Rare shapes should use eager kernels or a fallback path until they prove they are worth capturing.',
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
    explanation: 'A useful entry stores more than a graph handle. It needs the static buffers that make replay legal, hit statistics, capture threshold state, and a fallback for safety.',
  };
}

function* dynamicShapes() {
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
    explanation: 'Shape caching usually follows a heavy tail. Capture the hot prefix of the distribution and let rare shapes fall back. Capturing everything wastes memory and warmup time.',
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
    explanation: 'Dynamic traffic is not one problem. Padding to buckets raises hit rate but burns compute. Recapture helps if the shape becomes hot. Fallback keeps correctness for rare shapes.',
  };

  yield {
    state: shapeCacheGraph('LRU evicts stale graph entries'),
    highlight: { active: ['capture', 'replay', 'lru', 'e-capture-lru', 'e-replay-lru'], compare: ['miss'], found: ['hit'] },
    explanation: 'Captured graphs consume memory and may pin buffers. The cache needs eviction: remove cold entries, stale model versions, or shapes that no longer match live traffic.',
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
    explanation: 'A shape cache needs observability. If hit rate is low, replay latency is unchanged, or memory pressure rises, the cache is not paying for itself.',
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
      heading: 'Why this exists',
      paragraphs: [
        'GPU kernels can be fast while CPU launch overhead still hurts latency. A model-serving request may launch many small kernels, synchronize around memory work, and repeat almost the same decode step thousands of times. The GPU is doing the math, but the CPU still pays to submit the work.',
        'CUDA graphs solve part of that problem by capturing a repeated sequence of GPU operations and replaying it with much lower launch overhead. The catch is that replay is only valid when the captured assumptions still hold: shapes, kernel choices, device state, and memory addresses need to match.',
        'LLM serving makes this hard. Batch size changes. Sequence lengths grow. A prefill step is not the same as a decode step. Allocators move buffers. Models roll forward. A CUDA graph shape cache decides which serving shapes are stable enough to capture and when the runtime must fall back to ordinary eager execution.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach is eager execution: for every request, launch the kernels in order. That path is simple and flexible. It handles odd shapes, dynamic control flow, new buffers, and model changes without a capture protocol.',
        'The wall appears when the work is repeated and latency-sensitive. Decode loops often run the same kernel sequence for common batch and sequence buckets. Paying CPU launch overhead every time is wasteful. Capturing every possible shape is also wasteful because rare shapes consume warmup time and graph memory without enough hits to pay back the capture.',
        'The cache exists between those extremes. Hot shapes replay. Cold or unsafe shapes fall back.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The cache key must include every assumption that makes replay legal: model version, kernel variant, batch bucket, decode versus prefill, sequence length class, dtype, device, and memory-pool identity. Leaving one out can replay the wrong graph.',
        'The value is not just an executable. It also stores static buffers, capture warmup state, hit counters, last-used time, memory pressure, and an eager fallback. This is a hash table plus LRU policy plus safety guard.',
        'That safety guard is the main idea. A graph cache is not a memoized function result. It is memoized execution structure. The key must prove that replaying the old structure will run the right kernels over the right buffers.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the cache-lookup view, read the shape key as the proof object. The request is not allowed to replay a graph merely because it is "close enough." The key has to cover the assumptions captured into the graph. A hit means those assumptions match. A miss means the runtime keeps correctness by using fallback or capture policy.',
        'In the dynamic-shapes view, watch the heavy tail. A few shapes usually dominate traffic, while many shapes are rare. The right cache captures the hot prefix, buckets some nearby shapes if padding is acceptable, and lets rare shapes stay eager. Capturing everything is not discipline; it is memory pressure.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The runtime observes traffic. After a shape appears enough times, it warms up, captures the graph, and inserts it into the cache. Later requests compute the same shape key and replay the graph when the key matches and buffers are valid.',
        'When an unusual batch appears, the runtime has choices: pad to a nearby captured bucket, run eager fallback, or count misses until that shape proves hot. Each choice trades latency, wasted compute, memory stability, and implementation risk.',
        'A practical entry needs more than a graph handle. It needs static input and output buffers or a memory-pool contract, the captured executable, a model/version stamp, hit and miss counters, last-used time, invalidation rules, and a pointer to the eager path. Without the fallback, the optimization becomes a correctness risk.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'CUDA graph replay works when the operation sequence and memory assumptions match capture. The cache works when the key fully names those assumptions and the serving scheduler produces enough repeated shapes to amortize capture.',
        'The joint design matters. Stable batching creates cache hits. Stable memory pools make addresses safe. Eviction prevents captured graphs from pinning too much memory. Observability tells you whether the cache is reducing latency or just hoarding buffers.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The win is lower launch overhead and steadier decode latency for hot shapes. The cost is capture overhead, pinned buffers, shape bucketing waste, invalidation logic, and cache memory.',
        'A low hit rate is a warning sign. If traffic shape churns, replay latency is unchanged, or memory pressure rises, the cache is not paying for itself.',
        'The decision is workload-specific. A shape that appears twice should probably not be captured. A shape that appears millions of times in a decode loop probably should be. A shape that can be padded into a hot bucket may or may not be worth the extra GPU work. The ledger needs hit rate, replay latency, eager latency, capture cost, memory pinned, fallback rate, eviction count, and output checks.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'It works best for hot, repeated decode shapes in serving systems with stable model versions, predictable buckets, and allocator discipline.',
        'It also wins when the scheduler cooperates. Length-aware batching, fixed decode buckets, stable memory pools, and predictable kernel dispatch all create reusable shapes. The cache and scheduler should be designed together, not bolted together after latency gets bad.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when shapes are too dynamic, kernels change frequently, buffers move, or the scheduler fights the cache by producing endless odd batch shapes. In those cases eager execution or coarser bucketing may be safer.',
        'It also fails when the key is incomplete. Replaying a graph captured for a different dtype, model revision, memory pool, or kernel variant can produce wrong results or runtime errors. The most dangerous cache bugs look like performance work until they corrupt correctness.',
        'Finally, it can fail economically. If capture warms up slowly, pins too much memory, or increases padding work, the latency win may be smaller than the operational cost. CUDA graphs are a serving optimization, not a blanket rule.',
      ],
    },
    {
      heading: 'A worked case',
      paragraphs: [
        'Suppose decode traffic has four hot buckets: batch 1, 2, 4, and 8 at a fixed token step. The runtime sees batch 4 repeatedly, warms it up, captures the graph, and stores it under a key that includes model version, dtype, device, decode mode, batch bucket, and memory-pool identity. Later batch-4 requests replay the graph instead of launching the whole kernel sequence eagerly.',
        'Now a batch-5 request arrives. The system can pad it to batch 8 and replay, run eager fallback, or eventually capture batch 5 if it becomes hot. Each option is defensible under different traffic. The educational point is that the cache is a policy object, not just a map from shape to graph.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: NVIDIA CUDA Graphs programming guide at https://docs.nvidia.com/cuda/cuda-programming-guide/04-special-topics/cuda-graphs.html, NVIDIA CUDA Graph Best Practice for PyTorch at https://docs.nvidia.com/dl-cuda-graph/, NVIDIA dynamic pattern guidance at https://docs.nvidia.com/dl-cuda-graph/latest/torch-cuda-graph/handling-dynamic-patterns.html, PyTorch CUDA graphs blog at https://pytorch.org/blog/accelerating-pytorch-with-cuda-graphs/, and vLLM documentation at https://docs.vllm.ai/.',
        'Study Inference Kernel Fusion & CUDA Graphs, GPU Memory Pool Fragmentation Ledger, Accelerator Kernel Compatibility Matrix, Length-Aware Batching for LLM Serving, LLM Continuous Batching, Transformer Inference Roofline, KV Cache, Hash Table, LRU Cache, and Tail Latency next.',
      ],
    },
  ],
};
