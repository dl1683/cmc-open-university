// Heterogeneous AI compute routing: classify workload shape before choosing
// CPU, GPU, TPU, dataflow accelerator, or a mixed placement.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'heterogeneous-ai-compute-workload-router-case-study',
  title: 'Heterogeneous AI Compute Workload Router',
  category: 'Systems',
  summary: 'A placement case study for AI compute: route dense, sparse, branchy, memory-bound, and latency-sensitive workloads across GPU, CPU, TPU, ASIC, and mixed tiers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['workload quadrant', 'placement router'], defaultValue: 'workload quadrant' },
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

function routerGraph(title) {
  return graphState({
    nodes: [
      { id: 'job', label: 'job', x: 0.6, y: 3.7, note: 'request' },
      { id: 'profile', label: 'profile', x: 2.0, y: 3.7, note: 'shape' },
      { id: 'dense', label: 'dense', x: 3.8, y: 1.4, note: 'matmul' },
      { id: 'sparse', label: 'sparse', x: 3.8, y: 3.0, note: 'mask' },
      { id: 'branch', label: 'branchy', x: 3.8, y: 4.6, note: 'control' },
      { id: 'memory', label: 'memory', x: 3.8, y: 6.2, note: 'bytes' },
      { id: 'gpu', label: 'GPU', x: 6.2, y: 1.4, note: 'SIMT' },
      { id: 'tpu', label: 'TPU', x: 6.2, y: 2.8, note: 'array' },
      { id: 'cpu', label: 'CPU', x: 6.2, y: 4.2, note: 'branches' },
      { id: 'dataflow', label: 'dataflow', x: 6.2, y: 5.6, note: 'sparse' },
      { id: 'policy', label: 'policy', x: 8.2, y: 3.7, note: 'route' },
      { id: 'run', label: 'run', x: 9.4, y: 3.7, note: 'measure' },
    ],
    edges: [
      { id: 'e-job-profile', from: 'job', to: 'profile' },
      { id: 'e-profile-dense', from: 'profile', to: 'dense' },
      { id: 'e-profile-sparse', from: 'profile', to: 'sparse' },
      { id: 'e-profile-branch', from: 'profile', to: 'branch' },
      { id: 'e-profile-memory', from: 'profile', to: 'memory' },
      { id: 'e-dense-gpu', from: 'dense', to: 'gpu' },
      { id: 'e-dense-tpu', from: 'dense', to: 'tpu' },
      { id: 'e-branch-cpu', from: 'branch', to: 'cpu' },
      { id: 'e-sparse-dataflow', from: 'sparse', to: 'dataflow' },
      { id: 'e-memory-gpu', from: 'memory', to: 'gpu' },
      { id: 'e-gpu-policy', from: 'gpu', to: 'policy' },
      { id: 'e-tpu-policy', from: 'tpu', to: 'policy' },
      { id: 'e-cpu-policy', from: 'cpu', to: 'policy' },
      { id: 'e-dataflow-policy', from: 'dataflow', to: 'policy' },
      { id: 'e-policy-run', from: 'policy', to: 'run' },
    ],
  }, { title });
}

function* workloadQuadrant() {
  yield {
    state: plotState({
      axes: { x: { label: 'branching', min: 0, max: 10 }, y: { label: 'sparsity', min: 0, max: 10 } },
      series: [
        { id: 'dense', label: 'dense AI', points: [{ x: 1.2, y: 1.6 }, { x: 2.0, y: 2.0 }, { x: 2.6, y: 1.2 }] },
        { id: 'rag', label: 'RAG/search', points: [{ x: 5.4, y: 5.7 }, { x: 6.2, y: 6.4 }, { x: 4.8, y: 7.0 }] },
        { id: 'agent', label: 'agents', points: [{ x: 8.0, y: 4.2 }, { x: 8.6, y: 5.0 }, { x: 7.2, y: 3.8 }] },
        { id: 'graph', label: 'graph sims', points: [{ x: 7.8, y: 8.0 }, { x: 8.8, y: 8.7 }, { x: 6.8, y: 8.5 }] },
      ],
      markers: [
        { id: 'gap', x: 8.0, y: 8.0, label: 'hard zone' },
      ],
    }),
    highlight: { active: ['rag', 'agent', 'graph', 'gap'], compare: ['dense'] },
    explanation: 'Dense matrix workloads with little branching are the GPU and TPU comfort zone. The harder quadrant is high sparsity plus high branching: graph search, symbolic filters, agent tool loops, sparse simulation, and irregular retrieval. The router starts by locating the workload shape, not by asking which vendor is fashionable.',
    invariant: 'Hardware choice follows workload shape: parallelism, branching, sparsity, memory movement, and latency target.',
  };

  yield {
    state: labelMatrix(
      'Workload feature vector',
      [
        { id: 'intensity', label: 'intensity' },
        { id: 'branch', label: 'branching' },
        { id: 'sparse', label: 'sparsity' },
        { id: 'batch', label: 'batch shape' },
        { id: 'memory', label: 'data move' },
        { id: 'latency', label: 'latency' },
      ],
      [
        { id: 'asks', label: 'asks' },
        { id: 'bad sign', label: 'bad sign' },
      ],
      [
        ['ops/byte', 'low reuse'],
        ['same path?', 'warp split'],
        ['dense enough?', 'zeros+gaps'],
        ['stable dims?', 'shape churn'],
        ['near compute?', 'PCIe tax'],
        ['batchable?', 'p99 spikes'],
      ],
    ),
    highlight: { active: ['branch:bad sign', 'sparse:bad sign', 'memory:bad sign'], found: ['intensity:asks'] },
    explanation: 'A router can store workload shape as a feature vector. Arithmetic intensity comes from Roofline thinking. Branching predicts warp divergence and vector-lane waste. Sparsity predicts wasted dense math. Batch shape predicts whether captured kernels or systolic arrays stay full.',
  };

  yield {
    state: labelMatrix(
      'Device fit matrix',
      [
        { id: 'gpu', label: 'GPU' },
        { id: 'tpu', label: 'TPU' },
        { id: 'cpu', label: 'CPU' },
        { id: 'dataflow', label: 'dataflow' },
        { id: 'hybrid', label: 'hybrid' },
      ],
      [
        { id: 'best', label: 'best at' },
        { id: 'weak', label: 'weak at' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['dense SIMT', 'divergence', 'kernel lib'],
        ['matmul arrays', 'irregular', 'shape fit'],
        ['control flow', 'FLOPs', 'scale-out'],
        ['sparse event', 'porting', 'tooling'],
        ['mixed phases', 'routing', 'copy cost'],
      ],
    ),
    highlight: { active: ['gpu:best', 'tpu:best', 'cpu:best', 'dataflow:best'], compare: ['hybrid:weak'] },
    explanation: 'The fit matrix is intentionally blunt. GPUs and TPUs are excellent when the work is regular and dense. CPUs tolerate branching. Dataflow-style accelerators aim at sparse irregular work. Hybrid systems win only if the routing and copy costs stay visible.',
  };

  yield {
    state: routerGraph('The router turns features into candidate placements'),
    highlight: { active: ['job', 'profile', 'dense', 'sparse', 'branch', 'memory', 'gpu', 'tpu', 'cpu', 'dataflow'], found: ['policy'] },
    explanation: 'The router profiles a job into shape buckets, then scores candidate devices. A dense prefill batch may choose GPU or TPU. A branch-heavy tool loop may remain on CPU. A sparse graph pass may try dataflow or GraphBLAS-style kernels. A RAG product may split retrieval, reranking, and generation across tiers.',
  };

  yield {
    state: labelMatrix(
      'Case-study placements',
      [
        { id: 'prefill', label: 'LLM prefill' },
        { id: 'decode', label: 'LLM decode' },
        { id: 'rag', label: 'RAG filter' },
        { id: 'agent', label: 'agent loop' },
        { id: 'graph', label: 'graph sim' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'route', label: 'route' },
      ],
      [
        ['dense batch', 'GPU/TPU'],
        ['mem loop', 'GPU+KV'],
        ['sparse+ACL', 'CPU/GPU mix'],
        ['branchy IO', 'CPU first'],
        ['irregular', 'dataflow test'],
      ],
    ),
    highlight: { active: ['prefill:route', 'rag:route', 'agent:route'], found: ['graph:route'] },
    explanation: 'The practical answer is rarely one device for the whole product. LLM serving alone may have dense prefill, memory-bound decode, vector search, policy checks, and tool calls. Each phase has a different shape and therefore a different placement hypothesis.',
  };
}

function* placementRouter() {
  yield {
    state: routerGraph('Placement is a policy graph, not a benchmark slogan'),
    highlight: { active: ['profile', 'policy', 'run', 'e-profile-dense', 'e-profile-sparse', 'e-profile-branch', 'e-policy-run'], found: ['gpu', 'cpu', 'dataflow'] },
    explanation: 'A benchmark can say one accelerator is faster on one kernel. A product router needs a policy graph: profile workload, choose candidate device, include data movement and porting costs, run, measure, and update the route.',
  };

  yield {
    state: labelMatrix(
      'Porting tax ledger',
      [
        { id: 'kernel', label: 'kernels' },
        { id: 'runtime', label: 'runtime' },
        { id: 'debug', label: 'debugging' },
        { id: 'people', label: 'people' },
        { id: 'supply', label: 'supply' },
      ],
      [
        { id: 'cost', label: 'cost' },
        { id: 'proof', label: 'proof needed' },
      ],
      [
        ['rewrite', 'speed holds'],
        ['scheduler', 'p99 stable'],
        ['new tools', 'fast triage'],
        ['training', 'team can own'],
        ['capacity', 'available'],
      ],
    ),
    highlight: { active: ['kernel:cost', 'runtime:cost', 'debug:cost', 'people:cost'], found: ['supply:proof'] },
    explanation: 'Local corpus notes emphasize the ecosystem trap: better hardware is not enough if kernels, frameworks, debugging tools, engineers, and cloud capacity are missing. The router should record porting tax next to performance, not treat it as politics outside the system.',
    invariant: 'A hardware route is not real until the team can operate it under production traffic.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'porting maturity', min: 0, max: 10 }, y: { label: 'net value', min: 0, max: 100 } },
      series: [
        { id: 'gpu', label: 'GPU base', points: [{ x: 1, y: 55 }, { x: 4, y: 72 }, { x: 7, y: 84 }, { x: 10, y: 90 }] },
        { id: 'alt', label: 'new accel', points: [{ x: 1, y: 25 }, { x: 4, y: 58 }, { x: 7, y: 86 }, { x: 10, y: 96 }] },
        { id: 'hybrid', label: 'hybrid', points: [{ x: 1, y: 48 }, { x: 4, y: 67 }, { x: 7, y: 88 }, { x: 10, y: 94 }] },
      ],
      markers: [
        { id: 'cross', x: 7, y: 86, label: 'crossover' },
      ],
    }),
    highlight: { active: ['alt', 'cross'], compare: ['gpu'], found: ['hybrid'] },
    explanation: 'Alternative hardware often loses early despite attractive peak metrics because the software stack is immature. The crossover happens only after kernels, framework support, observability, fallbacks, and capacity reach production maturity.',
  };

  yield {
    state: labelMatrix(
      'Route decision table',
      [
        { id: 'steady', label: 'steady dense' },
        { id: 'shape', label: 'shape churn' },
        { id: 'branch', label: 'branchy' },
        { id: 'sparse', label: 'sparse' },
        { id: 'urgent', label: 'urgent p99' },
      ],
      [
        { id: 'route', label: 'route' },
        { id: 'guard', label: 'guardrail' },
      ],
      [
        ['GPU/TPU', 'roofline'],
        ['eager GPU', 'fallback'],
        ['CPU', 'batch later'],
        ['dataflow test', 'replay check'],
        ['fast tier', 'tail budget'],
      ],
    ),
    highlight: { active: ['steady:route', 'branch:route', 'sparse:route'], found: ['urgent:guard'] },
    explanation: 'A serving or research platform can make route decisions explicit. Stable dense shapes go to high-throughput accelerators. Shape churn stays on eager paths. Branch-heavy control flow stays on CPU until batching is possible. Sparse candidates get benchmarked with replay checks.',
  };

  yield {
    state: routerGraph('Measure after routing or the policy will rot'),
    highlight: { active: ['policy', 'run', 'e-policy-run'], compare: ['profile'], found: ['memory', 'branch'] },
    explanation: 'The policy is a living table. Routes should emit workload shape, device, kernel version, copy bytes, queue time, p99, cost, and failure reason. Otherwise an accelerator migration becomes folklore instead of an observable control loop.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'peak', label: 'peak myth' },
        { id: 'copy', label: 'copy tax' },
        { id: 'warp', label: 'warp split' },
        { id: 'shape', label: 'shape miss' },
        { id: 'lock', label: 'lock-in' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'control', label: 'control' },
      ],
      [
        ['unused FLOPs', 'roofline'],
        ['PCIe wait', 'co-locate'],
        ['masked lanes', 'group paths'],
        ['fallback storm', 'shape cache'],
        ['one stack', 'route ledger'],
      ],
    ),
    highlight: { active: ['peak:control', 'copy:control', 'warp:control', 'shape:control'], compare: ['lock:symptom'] },
    explanation: 'The hard parts are familiar systems failures. Peak metrics hide memory ceilings. Data movement erases wins. Warp divergence wastes lanes. Dynamic shapes miss captured kernels. Ecosystem lock-in makes a technically better route operationally worse.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'workload quadrant') yield* workloadQuadrant();
  else if (view === 'placement router') yield* placementRouter();
  else throw new InputError('Pick a heterogeneous-compute view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A heterogeneous AI compute workload router is a placement policy for choosing CPU, GPU, TPU, dataflow accelerator, or mixed execution based on workload shape. It stores a feature vector for each job: arithmetic intensity, branching, sparsity, batch stability, data movement, latency target, kernel maturity, and porting tax. The output is not "GPU good" or "ASIC good"; it is a route with evidence and fallback rules.',
        'The local AI Bubble notes frame the strategic problem well: GPUs are optimized for low-sparsity, low-branching work, while valuable future workloads may live in the high-sparsity, high-branching quadrant. This module turns that argument into a data-structure and systems case study.',
      ],
    },
    {
      heading: 'Workload shape',
      paragraphs: [
        'Roofline thinking starts with arithmetic intensity: operations per byte moved. A kernel below the ridge point is memory-bound; a kernel above it can become compute-bound. That is necessary but not sufficient. AI products also need branching and sparsity features. NVIDIA documents the SIMT constraint directly: when threads in a warp take different data-dependent branches, paths are executed with inactive lanes masked. That makes branch divergence a hardware-shape problem, not just a coding style issue.',
        'Dense transformer prefill, large batched matmuls, and stable convolution-like kernels fit GPUs and TPUs well. Irregular graph traversal, sparse retrieval filters, agent tool loops, control-heavy simulation, and branch-heavy verification can waste dense accelerators or suffer from copy overhead. The router exists to make those distinctions explicit before money is spent on hardware or porting.',
      ],
    },
    {
      heading: 'Placement policy',
      paragraphs: [
        'A placement policy scores candidate devices against the workload feature vector. GPUs get credit for mature kernels, SIMT throughput, HBM bandwidth, and ecosystem depth. TPUs get credit for matrix-heavy workloads and large-scale ML framework integration. CPUs get credit for control flow, small batches, and operational simplicity. Dataflow or wafer-scale accelerators may get credit for sparse or low-latency workloads, but only if the software stack and supply path are mature enough. Hybrid routes split phases when data movement does not erase the win.',
        'The policy should include porting tax as a first-class field. Kernel rewrites, runtime integration, debug tooling, engineer training, observability, supply availability, compatibility matrices, and fallback paths are not footnotes. They decide whether a benchmark result survives production. That is the same lesson as LLM Inference Scaling Playbook: optimization is a route ledger, not a single clever kernel.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider an enterprise RAG-and-agent product. Dense embedding batches and LLM prefill route to GPU or TPU. Decode stays near GPU memory and KV cache. Sparse ACL filtering and graph expansion may run on CPU, GPU bitsets, or a specialized sparse path depending on batch size. The agent control loop, tool calls, and policy gates stay on CPU because they are branchy and IO-bound. Reranking can move back to GPU when batched. The route record stores phase, device, bytes copied, queue delay, p99, cost, and fallback reason.',
        'A second case is a new accelerator trial. The accelerator claims better sparse utilization. The router does not migrate the whole service. It selects replayable sparse workloads, logs feature vectors, runs shadow traffic, compares p99 and cost, records debugging effort, and promotes only slices where net value beats the incumbent stack. This prevents a peak-throughput chart from becoming an expensive platform migration. ',
      ],
    },
    {
      heading: 'Pitfalls and study next',
      paragraphs: [
        'Do not pick hardware from peak FLOPs. Do not benchmark dense kernels and extrapolate to branchy sparse work. Do not ignore copy costs between CPU, GPU, memory tiers, vector databases, and network boundaries. Do not treat ecosystem maturity as nontechnical. Do not migrate without a route ledger and rollback plan.',
        'Primary sources: Roofline paper at https://dl.acm.org/doi/10.1145/1498765.1498785, NVIDIA CUDA C++ Programming Guide on SIMT and warp divergence at https://docs.nvidia.com/cuda/cuda-c-programming-guide/, Google TPU architecture docs at https://docs.cloud.google.com/tpu/docs/system-architecture-tpu-vm, and Cerebras architecture notes on dataflow scheduling and sparse utilization at https://www.cerebras.ai/blog/cerebras-architecture-deep-dive-first-look-inside-the-hw-sw-co-design-for-deep-learning. Local source: AI Bubble.txt in the referenced document corpus. Study Transformer Inference Roofline, GPU All-Reduce, Chiplet Interconnect Case Study, Chiplet Link Budget & Repair Lane Case Study, WebGPU Buffer & Bind Group Case Study, Compressed Sparse Row Graph, GraphBLAS Sparse Matrix Graph Case Study, CUDA Graph Shape Cache, Inference Kernel Fusion & CUDA Graphs, Accelerator Kernel Compatibility Matrix, LLM Inference Scaling Playbook, and Feature Flag Control Plane next.',
      ],
    },
  ],
};
