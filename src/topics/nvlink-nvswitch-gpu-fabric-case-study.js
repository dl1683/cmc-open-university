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
      heading: 'Why this exists',
      paragraphs: [
        'NVLink and NVSwitch exist because large GPU jobs often wait on communication, not arithmetic. A model-parallel training step may need all-reduce for gradients, all-gather for tensor-parallel activations, all-to-all for expert routing, or fast peer memory movement for inference state. If that traffic falls back to a weak fabric, expensive GPUs idle.',
        'The topic is easy to misunderstand because procurement language usually counts GPUs and peak bandwidth. Real workloads care about topology, bisection, collective shape, tail latency, degraded links, and whether the scheduler places tightly coupled ranks near each other.',
        'The data-structure view is a graph. GPUs are vertices, switch chips and switch trays are routing vertices, and links carry bandwidth, error, health, temperature, and policy metadata. A scheduler that ignores that graph treats a rack-scale accelerator like a loose pile of GPUs.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to count accelerators and assume eight, sixteen, or seventy-two GPUs are just that many times stronger than one GPU. That is the arithmetic-only view of scale-up computing.',
        'The next shortcut is to quote one bandwidth number. Peak link bandwidth is useful, but it is not a workload guarantee. All-reduce, all-gather, all-to-all, multicast, and remote memory access do not stress the same routes. One workload may be link-local while another pounds a weak bisection.',
        'A third mistake is to schedule by free GPU count alone. If a tensor-parallel group is split across a slow or degraded path, the entire group pays for the slowest repeated communication step. Placement must know the fabric graph.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is that GPU communication is a workload-shaped routing problem. The fabric is not passive plumbing. It is a graph with capacity, health, and sometimes in-network collective support.',
        'NVLink provides high-bandwidth GPU-to-GPU paths. NVSwitch adds a switching layer so more GPU pairs can communicate through a fabric rather than only through direct local links or host-mediated paths. In larger systems, the fabric becomes a scale-up network for tightly coupled accelerators.',
        'The invariant is topology-aware placement. Tightly coupled ranks should stay inside the fast fabric when the collective needs it. The runtime should track route costs, errors, switch occupancy, rack locality, and health state so a damaged path changes placement instead of becoming a mystery p99 spike.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A training or inference runtime first maps model parallelism onto ranks. Tensor parallelism often groups ranks that repeatedly exchange activations or reductions. Pipeline parallelism communicates at stage boundaries. MoE routes token activations to experts and often creates all-to-all traffic.',
        'The scheduler then places those ranks onto a physical topology. It should prefer fast local fabric for the most communication-heavy groups, avoid degraded links, and consider whether all-to-all traffic will cross a weak bisection. The placement problem is a graph problem with performance consequences.',
        'Modern fabrics can also accelerate collective patterns. In-network reduction and multicast features can change the cost model because part of the collective can happen inside the switch fabric rather than only at endpoints.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The scale-up-fabric view proves that GPU boxes are not the whole resource. Switches and links are part of the compute substrate. Their bandwidth, health, power, cooling, firmware, and serviceability shape job behavior.',
        'The collective-routes view proves that different parallelism strategies ask different questions of the same fabric. Tensor parallelism often wants all-reduce or all-gather among a tight group. MoE wants all-to-all token movement. Memory sharing can create asymmetric read and write pressure.',
        'The degraded-link frame proves why topology health must feed scheduling. A slow, hot, disabled, or error-prone link should change placement. Otherwise the system mislabels a fabric issue as a model, kernel, or batch-size problem.',
        'The fabric-state ledger is the actual operational data structure. It should connect topology, link counters, collective traces, rank placement, memory maps, and failure state. Without that ledger, the scheduler cannot distinguish a bad placement from a bad kernel.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because scale-up fabrics reduce the penalty for splitting one model across multiple accelerators. When the fabric is fast enough, the model can use more memory and compute than one GPU provides while keeping communication inside a tightly coupled domain.',
        'It also works because collective libraries can exploit known topology. A ring, tree, hierarchical all-reduce, multicast, or in-network reduction plan can use the fabric differently. The best collective is the one whose traffic shape matches the hardware graph.',
        'The performance win is strongest when communication repeats. A one-time transfer matters less than a collective that runs every layer, every token group, or every training step. Repeated communication turns small topology mistakes into large job-time losses.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The cost is hardware complexity. Switch trays, cables or package links, firmware, diagnostics, cooling, and service procedures become part of the accelerator system. A fast fabric is not free, and it is not invisible to operations.',
        'There is also a scheduling tradeoff. Packing a job tightly inside the best fabric may improve performance but reduce cluster flexibility. Spreading jobs can improve utilization but create slower communication. Good schedulers need policies for both performance and fairness.',
        'Observability is nonnegotiable. Operators need per-link health, error counters, retry behavior, switch occupancy, collective latency, rank placement, and job-level tail metrics. Without those, teams debug distributed training blind.',
        'The tradeoff is clearest at the rack boundary. Scale-up fabrics make a local GPU island powerful, but crossing out of that island usually changes latency and bandwidth sharply. Cluster schedulers must know where the island ends.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'The obvious use is large-model training, where GPU All-Reduce and Tensor Parallelism depend on fast collective communication. In inference, the same fabric matters for test-time reasoning, long-context serving, model-parallel decode, and MoE exchange.',
        'It is especially valuable when the model does not fit comfortably on one GPU or when latency-sensitive collective traffic repeats often enough that PCIe or host-mediated paths become the bottleneck.',
        'It also matters for cluster economics. A faster fabric can let one rack behave like a larger shared accelerator, but only if jobs are shaped and placed to use that shared fabric efficiently under real load.',
        'NVIDIA describes NVLink and NVLink Switch as a scale-up networking fabric for high-bandwidth GPU-to-GPU communication across AI training, inference, and rack-scale workloads: https://www.nvidia.com/en-us/data-center/nvlink/. The NVIDIA Multi-Node NVLink user guide describes an NVL72-style rack as compute trays with Grace CPUs and Blackwell GPUs plus NVLink switch trays: https://docs.nvidia.com/multi-node-nvlink-systems/mnnvl-user-guide/overview.html.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The first trap is treating bandwidth as one scalar. Direction, fanout, bisection, switch occupancy, multicast or reduction support, congestion, and degraded paths matter. A fabric can be excellent for one traffic shape and disappointing for another.',
        'The second trap is assuming a faster fabric removes software scheduling. It does the opposite. Once the fabric is powerful, placement choices become more valuable because the difference between a good route and a bad route is large.',
        'A third failure is hiding fabric health from users. If a job sees only slow step time and no link evidence, it may waste days tuning batch size or kernels while the real problem is a damaged route. The fabric ledger should be visible enough to explain performance.',
        'Finally, do not treat the scale-up fabric as a substitute for scale-out design. Once a job crosses rack or pod boundaries, different networks, failure domains, and collective algorithms take over.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: NVIDIA NVLink and NVLink Switch overview at https://www.nvidia.com/en-us/data-center/nvlink/ and NVIDIA Multi-Node NVLink user guide at https://docs.nvidia.com/multi-node-nvlink-systems/mnnvl-user-guide/overview.html. Study GPU All-Reduce, Tensor Parallelism, MoE Expert Capacity and All-To-All Routing Ledger, Chiplet Interconnect Case Study, KV Cache Transfer Fabric Case Study, and Heterogeneous AI Compute Workload Router next.',
      ],
    },
  ],
};
