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
      heading: 'What it is',
      paragraphs: [
        'A CUDA graph shape cache is a runtime map from serving shapes to captured CUDA graph executions. CUDA graphs can reduce CPU launch overhead by capturing a repeated GPU work graph and replaying it. In LLM serving, the hard part is not the idea of capture; it is deciding which dynamic request shapes are stable enough to capture, how to key them, when to fall back, and when to evict stale captures.',
        'PyTorch explains the basic benefit: CUDA graphs can eliminate CPU overhead when tensor shapes are static by capturing kernel calls once and launching the whole graph with a single operation later: https://pytorch.org/blog/accelerating-pytorch-with-cuda-graphs/. NVIDIA documents dynamic-pattern handling and notes that CUDA graphs traditionally require the same sequence of operations with the same memory addresses every replay: https://docs.nvidia.com/dl-cuda-graph/latest/torch-cuda-graph/handling-dynamic-patterns.html.',
      ],
    },
    {
      heading: 'Data structure',
      paragraphs: [
        'The cache key should include the assumptions that make replay legal: model version, kernel variant, batch size or bucket, decode versus prefill shape, sequence length class, dtype, device, and memory-pool identity. The cache value stores the captured graph executable, static input and output buffers, warmup/capture threshold state, hit counters, last-used time, and a safe eager fallback. That makes it closer to an LRU Cache plus Hash Table than a compiler checkbox.',
        'The reason memory-pool identity matters is that captured graphs can bake in addresses. If replay uses different addresses from capture, the graph may be invalid or unsafe. A serving runtime may therefore allocate stable buffers per hot shape, pad rare shapes into buckets, or skip capture for shapes that churn too much.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider an LLM server with continuous batching. Decode traffic mostly arrives at batch sizes 8, 16, 24, and 32 for single-token decode steps. The runtime captures graphs for those hot shapes after warmup. When the scheduler forms a batch of 16, it computes the shape key and replays the cached graph. When an unusual batch of 19 appears, the runtime can pad to 24 if the cost is acceptable, use eager fallback, or count misses until 19 proves hot enough to capture.',
        'This interacts with Length-Aware Batching for LLM Serving and GPU Memory Pool Fragmentation Ledger. If the scheduler creates stable buckets, the CUDA graph cache sees fewer shapes and the allocator can reserve stable pools for hot shapes. If the scheduler constantly produces odd shapes, the cache churns and the memory pool accumulates awkward leftovers. The right design is joint: batching policy, memory allocator, graph cache, and Accelerator Kernel Compatibility Matrix must agree on which shapes are worth making stable and legal.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary and official sources: NVIDIA CUDA Graphs programming guide at https://docs.nvidia.com/cuda/cuda-programming-guide/04-special-topics/cuda-graphs.html, NVIDIA CUDA Graph Best Practice for PyTorch at https://docs.nvidia.com/dl-cuda-graph/, NVIDIA dynamic pattern guidance at https://docs.nvidia.com/dl-cuda-graph/latest/torch-cuda-graph/handling-dynamic-patterns.html, PyTorch CUDA graphs blog at https://pytorch.org/blog/accelerating-pytorch-with-cuda-graphs/, and vLLM documentation noting CUDA/HIP graph execution in the serving stack at https://docs.vllm.ai/.',
        'Study Inference Kernel Fusion & CUDA Graphs, GPU Memory Pool Fragmentation Ledger, Accelerator Kernel Compatibility Matrix, Length-Aware Batching for LLM Serving, LLM Continuous Batching, Transformer Inference Roofline, KV Cache, Hash Table, LRU Cache, and Tail Latency next. Local source: Inference Scaling.txt in the provided document corpus.',
      ],
    },
  ],
};
