// NVLink/NVSwitch fabric: rack-scale GPU topology as a data structure for
// collectives, MoE all-to-all traffic, memory sharing, health, and placement.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'nvlink-nvswitch-gpu-fabric-case-study',
  title: 'NVLink/NVSwitch GPU Fabric Case Study',
  category: 'Systems',
  summary: 'A rack-scale GPU fabric primer: NVLink domains, NVSwitch all-to-all paths, SHARP reductions, topology-aware collectives, and degraded-link routing.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['scale-up fabric', 'collective routes'], defaultValue: 'scale-up fabric' },
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

function fabricGraph(title, { bad = false } = {}) {
  return graphState({
    nodes: [
      { id: 'g0', label: 'G0', x: 1.0, y: 1.5, note: 'GPU' },
      { id: 'g1', label: 'G1', x: 1.0, y: 5.5, note: 'GPU' },
      { id: 'g2', label: 'G2', x: 8.8, y: 1.5, note: 'GPU' },
      { id: 'g3', label: 'G3', x: 8.8, y: 5.5, note: 'GPU' },
      { id: 'sw0', label: 'SW0', x: 3.5, y: 2.2, note: 'NVSw' },
      { id: 'sw1', label: 'SW1', x: 6.3, y: 2.2, note: 'NVSw' },
      { id: 'sw2', label: 'SW2', x: 3.5, y: 4.8, note: 'NVSw' },
      { id: 'sw3', label: 'SW3', x: 6.3, y: 4.8, note: 'NVSw' },
      { id: 'sharp', label: 'SHARP', x: 4.9, y: 3.5, note: 'reduce' },
      { id: 'ctl', label: 'ctl', x: 4.9, y: 0.6, note: bad ? 'degrade' : 'health' },
      { id: 'trace', label: 'trace', x: 4.9, y: 6.4, note: 'route' },
    ],
    edges: [
      { id: 'e-g0-sw0', from: 'g0', to: 'sw0', weight: bad ? 'slow' : 'NVL' },
      { id: 'e-g1-sw2', from: 'g1', to: 'sw2', weight: 'NVL' },
      { id: 'e-g2-sw1', from: 'g2', to: 'sw1', weight: 'NVL' },
      { id: 'e-g3-sw3', from: 'g3', to: 'sw3', weight: 'NVL' },
      { id: 'e-sw0-sw1', from: 'sw0', to: 'sw1', weight: 'xbar' },
      { id: 'e-sw0-sw2', from: 'sw0', to: 'sw2', weight: 'xbar' },
      { id: 'e-sw1-sw3', from: 'sw1', to: 'sw3', weight: 'xbar' },
      { id: 'e-sw2-sw3', from: 'sw2', to: 'sw3', weight: 'xbar' },
      { id: 'e-sw0-sharp', from: 'sw0', to: 'sharp', weight: '' },
      { id: 'e-sw1-sharp', from: 'sw1', to: 'sharp', weight: '' },
      { id: 'e-sw2-sharp', from: 'sw2', to: 'sharp', weight: '' },
      { id: 'e-sw3-sharp', from: 'sw3', to: 'sharp', weight: '' },
      { id: 'e-ctl-sharp', from: 'ctl', to: 'sharp', weight: 'state' },
      { id: 'e-sharp-trace', from: 'sharp', to: 'trace', weight: 'tele' },
    ],
  }, { title });
}

function routeGraph(title) {
  return graphState({
    nodes: [
      { id: 'sched', label: 'sched', x: 0.8, y: 3.5, note: 'place' },
      { id: 'tp', label: 'TP', x: 2.4, y: 2.0, note: 'shards' },
      { id: 'moe', label: 'MoE', x: 2.4, y: 5.0, note: 'experts' },
      { id: 'fabric', label: 'fabric', x: 4.5, y: 3.5, note: 'NVL' },
      { id: 'ar', label: 'AR', x: 6.3, y: 1.4, note: 'sum' },
      { id: 'a2a', label: 'A2A', x: 6.3, y: 5.6, note: 'tokens' },
      { id: 'mem', label: 'mem', x: 8.2, y: 2.3, note: 'share' },
      { id: 'slo', label: 'SLO', x: 8.2, y: 4.7, note: 'tail' },
    ],
    edges: [
      { id: 'e-sched-tp', from: 'sched', to: 'tp', weight: '' },
      { id: 'e-sched-moe', from: 'sched', to: 'moe', weight: '' },
      { id: 'e-tp-fabric', from: 'tp', to: 'fabric', weight: 'rank' },
      { id: 'e-moe-fabric', from: 'moe', to: 'fabric', weight: 'tok' },
      { id: 'e-fabric-ar', from: 'fabric', to: 'ar', weight: 'red' },
      { id: 'e-fabric-a2a', from: 'fabric', to: 'a2a', weight: 'xchg' },
      { id: 'e-fabric-mem', from: 'fabric', to: 'mem', weight: 'map' },
      { id: 'e-ar-slo', from: 'ar', to: 'slo', weight: '' },
      { id: 'e-a2a-slo', from: 'a2a', to: 'slo', weight: '' },
    ],
  }, { title });
}

function* scaleUpFabric() {
  yield {
    state: fabricGraph('NVLink domain starts as a GPU-switch graph'),
    highlight: { active: ['g0', 'g1', 'g2', 'g3', 'sw0', 'sw1', 'sw2', 'sw3'], compare: ['ctl'] },
    explanation: 'NVLink turns local GPU communication into a high-bandwidth fabric problem. The scheduler should see GPUs, switches, links, health, and route costs, not just a flat count of accelerators.',
  };

  yield {
    state: fabricGraph('NVSwitch creates all-to-all paths'),
    highlight: { active: ['e-sw0-sw1', 'e-sw0-sw2', 'e-sw1-sw3', 'e-sw2-sw3'], found: ['g0', 'g2', 'g3'], compare: ['trace'] },
    explanation: 'The switch layer makes remote GPUs feel closer than PCIe-only placement. That is why tensor parallelism, pipeline parallelism, and expert routing care about the NVLink domain boundary.',
    invariant: 'The collective is only as fast as the slowest congested path it repeatedly uses.',
  };

  yield {
    state: fabricGraph('In-network reduction changes collective shape'),
    highlight: { active: ['sharp', 'e-sw0-sharp', 'e-sw1-sharp', 'e-sw2-sharp', 'e-sw3-sharp'], found: ['ctl'], compare: ['g0', 'g1', 'g2', 'g3'] },
    explanation: 'NVSwitch systems can include reduction and multicast acceleration. The data-structure lesson is that the network is not passive: collective operations can be partially executed inside the fabric.',
  };

  yield {
    state: labelMatrix(
      'Fabric state ledger',
      [
        { id: 'topo', label: 'topo' },
        { id: 'link', label: 'link' },
        { id: 'coll', label: 'coll' },
        { id: 'mem', label: 'mem' },
        { id: 'fail', label: 'fail' },
      ],
      [
        { id: 'track', label: 'track' },
        { id: 'why', label: 'why' },
      ],
      [
        ['GPU/SW', 'place'],
        ['bw/err', 'route'],
        ['AR/A2A', 'plan'],
        ['map', 'share'],
        ['hot', 'route'],
      ],
    ),
    highlight: { active: ['topo:track', 'link:track', 'coll:track'], found: ['fail:why'] },
    explanation: 'A serious GPU fabric keeps a topology and health ledger. Placement, all-reduce, all-to-all, memory sharing, and degraded-link recovery all use the same graph evidence.',
  };
}

function* collectiveRoutes() {
  yield {
    state: routeGraph('Collectives ask different routing questions'),
    highlight: { active: ['tp', 'fabric', 'ar', 'e-tp-fabric', 'e-fabric-ar'], compare: ['moe', 'a2a'] },
    explanation: 'Tensor parallelism often wants all-reduce or all-gather among a tight group of ranks. MoE wants all-to-all token exchange. Those are different traffic shapes on the same fabric.',
  };

  yield {
    state: routeGraph('MoE all-to-all stresses bisection'),
    highlight: { active: ['moe', 'fabric', 'a2a', 'e-moe-fabric', 'e-fabric-a2a'], found: ['slo'], compare: ['ar'] },
    explanation: 'Expert routing can move token activations to many peers. If the topology has a weak bisection, expert parallelism becomes a networking problem before it becomes a model-quality problem.',
    invariant: 'Sparse compute still needs dense enough communication to move routed tokens.',
  };

  yield {
    state: fabricGraph('A degraded link changes placement'),
    highlight: { active: ['ctl', 'trace', 'e-g0-sw0'], compare: ['g0', 'sw0'], found: ['g1', 'g2', 'g3'] },
    explanation: 'The fabric state has to change when a link is slow, hot, disabled, or error-prone. A good scheduler can avoid placing a latency-sensitive collective across a damaged path.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'ranks', min: 0, max: 80 }, y: { label: 'tail ms', min: 0, max: 120 } },
      series: [
        { id: 'nvl', label: 'NVL', points: [{ x: 8, y: 10 }, { x: 16, y: 14 }, { x: 32, y: 24 }, { x: 72, y: 42 }] },
        { id: 'pcie', label: 'PCIe', points: [{ x: 8, y: 18 }, { x: 16, y: 38 }, { x: 32, y: 74 }, { x: 72, y: 115 }] },
        { id: 'bad', label: 'bad link', points: [{ x: 8, y: 22 }, { x: 16, y: 45 }, { x: 32, y: 90 }, { x: 72, y: 118 }] },
      ],
      markers: [
        { id: 'slo', x: 32, y: 50, label: 'SLO' },
      ],
    }),
    highlight: { active: ['nvl', 'slo'], compare: ['pcie', 'bad'] },
    explanation: 'The simplified curve is the operational idea: keep tightly coupled ranks inside the fast fabric, watch tail latency, and reroute or shed when degraded paths erase the scale-up advantage.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'scale-up fabric') yield* scaleUpFabric();
  else if (view === 'collective routes') yield* collectiveRoutes();
  else throw new InputError('Pick an NVLink/NVSwitch view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the fabric view as a graph. A GPU is a node, an NVLink is an edge, and an NVSwitch is a switching node that lets traffic choose a path instead of staying inside one direct cable. Active marks the edge or switch currently carrying a message. Visited marks links already used by this collective step.',
        {type:'callout', text:'A GPU fabric is a graph resource: collective performance depends on route shape, link health, and where tightly coupled ranks are placed.'},
        'In the collective-route view, each rank is one participant in a group operation such as all-reduce. A safe inference rule is this: if two ranks exchange large tensors every step, placing them across a weaker path turns communication into the training bottleneck even when each GPU is fast alone.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A GPU fabric exists because modern training and inference jobs are not independent GPU jobs. Tensor parallelism, pipeline parallelism, expert parallelism, and collective operations move large buffers between accelerators. PCIe can connect devices, but high-end GPU systems need lower latency and higher bandwidth paths between GPUs.',
        'NVLink is NVIDIA high-speed GPU interconnect. NVSwitch extends that idea from a few direct links into a switched fabric where many GPUs can communicate through routing hardware. The data-structure idea is a weighted graph whose edges have bandwidth, latency, congestion, and failure state.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to attach every GPU to the host over PCIe and let software copy through host memory when needed. That is simple and portable. It also works for workloads where each GPU mostly runs its own batch and only returns final results.',
        'Another reasonable approach is direct peer-to-peer links between nearby GPUs. Direct links are easy to picture and good for small groups. The problem starts when a job needs all GPUs to exchange data repeatedly and evenly.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is collective communication. In an all-reduce, every GPU contributes part of a tensor and every GPU needs the reduced result. If eight GPUs exchange a 1 GB gradient buffer every training step, a weak link or bad route can add tens of milliseconds to every step.',
        'The second wall is topology. Two placements can use the same number of GPUs but expose different paths. A tightly coupled tensor-parallel group placed across a slow crossing link pays that cost at every layer, while a better placement keeps heavy exchange inside the faster part of the fabric.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that communication cost is a property of the route, not just the endpoint. A scheduler must reason about link bandwidth, switch hops, current congestion, and which ranks talk most often. The fabric is a graph resource that should be allocated like memory or compute.',
        'NVSwitch helps because it creates more route choices and a more uniform communication domain. It does not make data movement free. It changes the optimization problem from avoiding communication to placing and routing communication where the graph can carry it.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each GPU exposes NVLink ports. In a switched system, those ports connect to NVSwitch chips, and the switches forward packets between GPUs. Communication libraries such as NCCL discover the topology and choose rings, trees, or other collective schedules that use available paths.',
        'A ring all-reduce splits a buffer into chunks and streams those chunks around a cycle of GPUs. A tree collective sends data up and down a branching structure. The best schedule depends on message size, topology, link balance, and whether the operation is bandwidth-bound or latency-bound.',
        'The animation separates physical fabric from logical route. The physical fabric says what paths exist. The logical route says which paths this collective actually uses. Performance follows the logical route under current load, not the marketing bandwidth of one link.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument comes from conservation of contribution. In an all-reduce, every rank starts with one local value and must end with the same reduced value. A valid schedule partitions, moves, combines, and broadcasts chunks without dropping or duplicating any contribution.',
        'The fabric does not change the algebra. It changes how quickly the required messages arrive. If the route preserves chunk identity and every reduction operation is applied once per contribution, the result is correct even when packets take different switch paths.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Communication time behaves like bytes divided by effective bandwidth plus per-hop and software overhead. Moving 1 GB over an effective 200 GB/s path takes about 5 ms before protocol overhead. If congestion cuts the path to 50 GB/s, the same transfer takes about 20 ms.',
        'Complexity comes from topology discovery, route selection, collective algorithm choice, and failure handling. A fabric also consumes expensive board area, switch silicon, power, cooling, and validation effort. More links help only when software maps communication onto them well.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'NVLink and NVSwitch matter in dense training servers, multi-GPU inference nodes, high-performance computing, and systems with tensor-parallel models. These workloads repeatedly move activations, gradients, expert traffic, or key-value cache between GPUs. The useful access pattern is frequent large transfers among a known group of accelerators.',
        'They also matter for placement. A cluster scheduler can keep one model shard group inside one high-bandwidth domain and place looser data-parallel replicas across weaker links. The same number of GPUs can produce different throughput when the topology matches the communication pattern.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A GPU fabric does not fix compute-bound kernels. If matrix multiplication dominates and communication is small, extra fabric bandwidth sits unused. It also does not fix poor batching, memory fragmentation, or model-parallel layouts that communicate more than the model can hide.',
        'The fabric can fail operationally through link degradation, bad route choices, thermal limits, or noisy neighbors. It can also mislead benchmarks. A result from one node topology may not transfer to another node with different switch layout, firmware, or collective library version.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose eight GPUs run data-parallel training and each step needs a 1.6 GB gradient all-reduce. A simple estimate divides bytes by effective bandwidth. At 400 GB/s effective fabric bandwidth, the exposed transfer time is about 4 ms, before reduction and scheduling overhead.',
        'If the same job crosses a path that gives only 100 GB/s, the exposed time rises to about 16 ms. With 1,000 training steps, that difference is 12 seconds of extra communication. With 100,000 steps, it becomes about 20 minutes before any other overhead is counted.',
        'Now place a tensor-parallel group that exchanges activations every layer on the weak path. The penalty repeats inside each forward and backward pass, not only once per step. That is why topology-aware placement can matter more than adding one more idle GPU.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with NVIDIA material on NVLink, NVSwitch, DGX and HGX system architecture, and NCCL documentation at https://developer.nvidia.com/nvlink and https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/. Treat exact bandwidth numbers as product-specific and verify them against the current platform datasheet.',
        'Next, study graph routing, ring buffers, all-reduce algorithms, NCCL topology files, CUDA peer access, RDMA, and cluster schedulers. The next mental model is that a GPU server is a small network whose job graph must fit its physical graph.',
      ],
    },
  ],
};
