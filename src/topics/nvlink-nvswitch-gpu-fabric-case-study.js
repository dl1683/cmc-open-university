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
      heading: 'What it is',
      paragraphs: [
        'NVLink and NVSwitch are the scale-up fabric that lets GPUs communicate with much higher bandwidth and lower overhead than ordinary host-mediated paths. The data-structure view is a graph: GPUs are vertices, switch chips and switch trays are routing vertices, and links carry bandwidth, error, health, and policy metadata. A scheduler that ignores that graph treats a rack-scale accelerator like a loose pile of GPUs.',
        'NVIDIA describes NVLink and NVLink Switch as a scale-up networking fabric for high-bandwidth GPU-to-GPU communication across AI training, inference, and rack-scale workloads: https://www.nvidia.com/en-us/data-center/nvlink/. The same page frames NVLink Switch as enabling all-to-all communication and in-network collective support through SHARP engines.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The local node case starts with GPUs connected through high-speed links. NVSwitch adds a switching layer so every GPU pair can communicate through a non-blocking or near-non-blocking fabric, depending on the system generation and health state. The route decision is not just source and destination. It includes rank group, collective type, congestion, degraded links, thermal state, and whether the job is tensor parallel, pipeline parallel, data parallel, or expert parallel.',
        'The NVIDIA Multi-Node NVLink user guide describes an NVL72-style rack as compute trays with Grace CPUs and Blackwell GPUs plus NVLink switch trays, and notes that CUDA applications can leverage the NVLink network across GPUs in the system: https://docs.nvidia.com/multi-node-nvlink-systems/mnnvl-user-guide/overview.html. It also describes IMEX as a service that manages GPU memory mapping across nodes in an NVLink domain.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The visible cost is hardware: switch trays, links, backplanes, power, cooling, firmware, and serviceability. The hidden cost is topology discipline. All-reduce, all-gather, all-to-all, and remote memory sharing have different contention patterns. A placement policy that is good for one can be bad for another. A model team can see this as lower tokens per second, worse training step time, or unstable p99 when one path becomes hot.',
        'Health matters because a fabric is a living graph. Links can be partially populated, hot-swapped, degraded, or saturated. A topology-aware runtime should track bandwidth, errors, route choices, rack locality, and collective shape. The moment those are missing, a large job becomes difficult to debug because the route used by the model is invisible.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The obvious use is large-model training, where GPU All-Reduce and Tensor Parallelism depend on fast collective communication. In inference, the same fabric matters for test-time reasoning, long-context serving, model parallel decode, and MoE token exchange. Mixture of Experts is especially sensitive because sparse parameter compute can turn into dense all-to-all communication between expert hosts.',
        'NVLink domains also change the memory story. If GPUs can share or map memory across a fast backplane, prefill/decode handoff, KV-cache movement, and pipeline boundaries become different routing problems from ordinary Ethernet or PCIe placement.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The first trap is treating bandwidth as one scalar. Direction, fanout, bisection, switch occupancy, multicast/reduction support, and degraded paths matter. The second trap is assuming a faster fabric removes software scheduling. It does the opposite: once the fabric is powerful, placement choices become more valuable because the difference between a good and bad route is large.',
        'Another misconception is that all collectives stress the fabric the same way. All-reduce can use reduction trees or rings; all-to-all creates many peer-specific flows; memory sharing can create asymmetric read and write pressure. A useful mental model keeps the route graph and the collective contract together.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: NVIDIA NVLink and NVLink Switch overview at https://www.nvidia.com/en-us/data-center/nvlink/ and NVIDIA Multi-Node NVLink user guide at https://docs.nvidia.com/multi-node-nvlink-systems/mnnvl-user-guide/overview.html. Study GPU All-Reduce, Tensor Parallelism, MoE Expert Capacity and All-To-All Routing Ledger, Chiplet Interconnect Case Study, KV Cache Transfer Fabric Case Study, and Heterogeneous AI Compute Workload Router next.',
      ],
    },
  ],
};
