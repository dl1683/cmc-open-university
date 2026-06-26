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
      heading: 'How to read the animation',
      paragraphs: [
        'Read each workload box as a phase, not as a whole product. Embedding, retrieval, filtering, prefill, decode, rerank, tool execution, and policy checks can have different shapes even when they belong to one user request.',
        'Active routes are placements being tried or used. A safe inference is that a device is a good placement only after copy cost, queue delay, software maturity, failure rate, and tail latency are counted with raw throughput.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'AI infrastructure is no longer one workload. A product can contain dense matrix multiplication, memory-bound decode, vector search, sparse filters, graph expansion, branch-heavy agent control flow, and IO-bound tool calls.',
        'A heterogeneous compute router exists because those phases do not want the same hardware. The router maps measured workload shape to CPU, GPU, TPU, sparse accelerator, or fallback path, then records whether the placement actually worked.',
        {type:'callout', text:'Heterogeneous routing works only when placement follows measured workload shape: dense math, sparse access, branching, memory movement, and tail latency need different devices.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/9/99/TPU_v4.png', alt:'TPU v4 board with liquid-cooled packages and interconnect connectors.', caption:'TPU v4 package and board. Norman P. Jouppi et al., Wikimedia Commons, CC BY 4.0.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to buy the accelerator that wins the famous benchmark and route everything there. That is reasonable when the product is mostly one dense model with stable shapes and high batch sizes.',
        'Another first attempt is a static rule table. Prefill goes to GPU, tools stay on CPU, and retrieval goes to the existing vector database because those rules are easy to explain and deploy.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that peak FLOPs do not describe production shape. Branching, sparsity, memory movement, batch instability, host-device synchronization, cold compilation, and queue delay can dominate useful work.',
        'The second wall is ecosystem maturity. A device can look excellent in a kernel benchmark and still lose production traffic because kernels, debuggers, observability, autoscaling, fallback paths, cloud capacity, or engineers are missing.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to make placement a measured data-structure problem. Each phase gets a feature vector: arithmetic intensity, branching, sparsity, shape stability, bytes copied, latency target, kernel maturity, cost, and fallback quality.',
        'The route table maps that vector to candidate devices and stores outcomes. Hardware choice becomes a control loop that can be replayed, audited, and changed when the workload or fleet changes.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Profiling starts with arithmetic intensity, which means operations per byte moved. High intensity tends to fit dense accelerators, while low intensity often waits on memory bandwidth or data movement.',
        'The router then adds features that peak math ignores: branch divergence, sparse access, batch size, shape churn, copy cost, p95 and p99 target, compilation time, failure rate, and software support.',
        'A production policy should route phases, not whole requests. One request may send embedding and prefill to an accelerator, keep the agent control loop on CPU, run sparse filtering in a specialized path, and return to GPU for batched reranking.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works when workload shape is more stable than individual requests. Dense prefill, memory-bound decode, sparse retrieval, and branch-heavy tool orchestration repeat often enough to learn separate placement policies.',
        'It is correct only relative to measured objectives. If the objective is interactive p99 latency, then a placement that improves average throughput but worsens p99 is not a win for that phase.',
        'The invariant is that every promoted route has evidence from the same workload slice it will serve. Replay traces, canary traffic, and fallback records keep the route table tied to production behavior instead of benchmark folklore.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is orchestration complexity. Hybrid routes can lose to copy overhead, specialized devices can create support burden, fallback paths can rot, and a stale route table can keep sending traffic to the wrong device.',
        'Concrete behavior matters. If GPU prefill takes 40 ms, CPU filtering takes 8 ms, device copy takes 12 ms each way, and rerank takes 15 ms, then a split route costs 87 ms before queueing; a 70 ms single-device path may be better despite lower kernel efficiency.',
        'The dominant cost can move over time. A new model version can change tensor shapes, quantization can shift memory pressure, batching can change queue delay, and a driver update can reverse a previous placement result.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This router fits RAG systems, agent platforms, multimodal pipelines, recommender systems, batched inference services, simulation platforms, and research clusters that compare devices on replayable traces.',
        'It is especially useful when adopting a new accelerator. The platform can test narrow phases first, promote only where net latency or cost improves, and keep the incumbent path for phases where the new device loses.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the feature vector is fake or too coarse. A service-level label such as inference hides the fact that prefill, decode, retrieval, and tool calls have different bottlenecks.',
        'It also fails when teams optimize for peak throughput and ignore tail latency, queueing, copy cost, utilization, failure recovery, and engineering ownership. A device that wins a chart can still make the product slower.',
        'Ownership can break the system. If hardware, model, data platform, and product teams each own one slice, nobody owns the user-visible path unless the route ledger names the decision, evidence, owner, and rollback trigger.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A RAG request has five phases: embedding takes 20 ms on GPU or 55 ms on CPU, vector retrieval takes 35 ms on CPU, sparse ACL filtering takes 12 ms on CPU or 30 ms on GPU, LLM prefill takes 80 ms on GPU, and decode averages 160 ms on GPU.',
        'A naive GPU-only route moves ACL data to GPU and back, adding 18 ms of copy time and making filtering slower. The mixed route keeps retrieval and ACL filtering on CPU, sends only the selected context to GPU, and saves about 36 ms before queueing.',
        'Now add p99. If the GPU queue is 90 ms at p99 but the CPU queue is 10 ms, the mixed route can win interactive latency even when the GPU has higher raw throughput for one kernel.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources include the Roofline paper, the NVIDIA CUDA C++ Programming Guide for SIMT and divergence, Google TPU architecture documentation, and architecture notes from accelerator vendors. Use them to connect device behavior to workload shape rather than brand labels.',
        'Study Transformer Inference Roofline, GPU All-Reduce, GraphBLAS Sparse Matrix Graph Case Study, CUDA Graph Shape Cache, Accelerator Kernel Compatibility Matrix, LLM Inference Cost Stack, and Feature Flag Control Plane next.',
      ],
    },
  ],
};
