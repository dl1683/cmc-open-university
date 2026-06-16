// Collective performance depends on rank placement: map ranks to GPUs, NICs,
// NVLink domains, NUMA nodes, and rails before choosing communication plans.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'gpu-collective-topology-placement-planner-case-study',
  title: 'GPU Collective Topology Placement Planner Case Study',
  category: 'Systems',
  summary: 'Rank placement for collective-heavy AI jobs: GPU/NIC locality matrices, NVLink domains, rail striping, tensor-parallel groups, MoE all-to-all, and rollout gates.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['rank map', 'rail plan'], defaultValue: 'rank map' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function topologyGraph(title) {
  return graphState({
    nodes: [
      { id: 'plan', label: 'plan', x: 0.7, y: 3.5, note: 'rank' },
      { id: 'g0', label: 'G0', x: 2.3, y: 1.4, note: 'NVL A' },
      { id: 'g1', label: 'G1', x: 2.3, y: 3.0, note: 'NVL A' },
      { id: 'g2', label: 'G2', x: 2.3, y: 4.8, note: 'NVL B' },
      { id: 'g3', label: 'G3', x: 2.3, y: 6.4, note: 'NVL B' },
      { id: 'nic0', label: 'NIC0', x: 5.0, y: 2.2, note: 'rail0' },
      { id: 'nic1', label: 'NIC1', x: 5.0, y: 5.6, note: 'rail1' },
      { id: 'sw0', label: 'SW0', x: 7.2, y: 2.2, note: 'leaf' },
      { id: 'sw1', label: 'SW1', x: 7.2, y: 5.6, note: 'leaf' },
      { id: 'job', label: 'job', x: 9.1, y: 3.9, note: 'SLO' },
    ],
    edges: [
      { id: 'e-plan-g0', from: 'plan', to: 'g0' },
      { id: 'e-plan-g1', from: 'plan', to: 'g1' },
      { id: 'e-plan-g2', from: 'plan', to: 'g2' },
      { id: 'e-plan-g3', from: 'plan', to: 'g3' },
      { id: 'e-g0-g1', from: 'g0', to: 'g1', weight: 'NVL' },
      { id: 'e-g2-g3', from: 'g2', to: 'g3', weight: 'NVL' },
      { id: 'e-g0-n0', from: 'g0', to: 'nic0', weight: 'near' },
      { id: 'e-g1-n0', from: 'g1', to: 'nic0', weight: 'near' },
      { id: 'e-g2-n1', from: 'g2', to: 'nic1', weight: 'near' },
      { id: 'e-g3-n1', from: 'g3', to: 'nic1', weight: 'near' },
      { id: 'e-n0-sw0', from: 'nic0', to: 'sw0', weight: 'rail' },
      { id: 'e-n1-sw1', from: 'nic1', to: 'sw1', weight: 'rail' },
      { id: 'e-sw0-job', from: 'sw0', to: 'job' },
      { id: 'e-sw1-job', from: 'sw1', to: 'job' },
    ],
  }, { title });
}

function* rankMap() {
  yield {
    state: labelMatrix(
      'Rank locality matrix',
      [
        { id: 'r0', label: 'R0' },
        { id: 'r1', label: 'R1' },
        { id: 'r2', label: 'R2' },
        { id: 'r3', label: 'R3' },
      ],
      [
        { id: 'gpu', label: 'GPU' },
        { id: 'nvl', label: 'NVL' },
        { id: 'nic', label: 'NIC' },
        { id: 'numa', label: 'NUMA' },
      ],
      [
        ['G0', 'A', 'N0', '0'],
        ['G1', 'A', 'N0', '0'],
        ['G2', 'B', 'N1', '1'],
        ['G3', 'B', 'N1', '1'],
      ],
    ),
    highlight: { active: ['r0:nvl', 'r1:nvl', 'r2:nic', 'r3:nic'], found: ['r0:numa', 'r3:numa'] },
    explanation: 'The rank map joins several data structures: rank ID, GPU, NVLink island, nearest NIC, NUMA node, and rail. A collective-heavy job should not discover this accidentally at runtime.',
    invariant: 'Rank placement is part of the communication algorithm, not an afterthought after the model is launched.',
  };

  yield {
    state: topologyGraph('Planner maps rank groups to fast local paths'),
    highlight: { active: ['plan', 'g0', 'g1', 'g2', 'g3', 'e-g0-g1', 'e-g2-g3'], compare: ['nic0', 'nic1'] },
    explanation: 'Tensor-parallel groups prefer to stay inside the fastest local domain. If R0 and R1 shard one layer, putting them on G0 and G1 keeps the repeated all-reduce inside NVLink island A.',
  };

  yield {
    state: labelMatrix(
      'Shape placement',
      [
        { id: 'dp', label: 'DP' },
        { id: 'tp', label: 'TP' },
        { id: 'pp', label: 'PP' },
        { id: 'moe', label: 'MoE' },
      ],
      [
        { id: 'traffic', label: 'flow' },
        { id: 'place', label: 'place' },
      ],
      [
        ['AR', 'rails'],
        ['TP AR', 'NVL'],
        ['act', 'near'],
        ['A2A', 'bisect'],
      ],
    ),
    highlight: { active: ['tp:place', 'moe:place'], compare: ['dp:place', 'pp:place'] },
    explanation: 'Different parallelism dimensions want different neighborhoods. Tensor parallelism wants low-latency repeated collectives; data parallelism wants bandwidth across replicas; MoE wants bisection for all-to-all.',
  };

  yield {
    state: topologyGraph('The launch artifact is a checked placement plan'),
    highlight: { active: ['job', 'sw0', 'sw1', 'nic0', 'nic1', 'e-sw0-job', 'e-sw1-job'], found: ['plan'] },
    explanation: 'The scheduler should launch with a placement plan and a verification record: expected topology, actual visible devices, rank map, rail use, and benchmark gate. Otherwise, a silent remap can look like model slowdown.',
  };
}

function* railPlan() {
  yield {
    state: topologyGraph('Rail striping spreads traffic across NICs'),
    highlight: { active: ['nic0', 'nic1', 'sw0', 'sw1', 'e-n0-sw0', 'e-n1-sw1'], found: ['g0', 'g2'], compare: ['job'] },
    explanation: 'Multi-rail systems can stripe traffic across multiple NICs or fabrics. The planner must know which GPUs are close to which NICs, or striping can create cross-NUMA or cross-PCIe penalties.',
  };

  yield {
    state: labelMatrix(
      'Rail ledger',
      [
        { id: 'b0', label: 'b0' },
        { id: 'b1', label: 'b1' },
        { id: 'b2', label: 'b2' },
        { id: 'b3', label: 'b3' },
      ],
      [
        { id: 'rail', label: 'rail' },
        { id: 'src', label: 'src' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['rail0', 'G0/G1', 'near'],
        ['rail1', 'G2/G3', 'near'],
        ['rail0', 'G0/G1', 'cap'],
        ['rail1', 'G2/G3', 'cap'],
      ],
    ),
    highlight: { active: ['b0:rail', 'b1:rail', 'b0:guard', 'b1:guard'], compare: ['b2:guard', 'b3:guard'] },
    explanation: 'A rail ledger is a small scheduling table: which chunk uses which rail, which GPU group sources it, and whether locality and capacity checks passed.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'step', min: 0, max: 5 }, y: { label: 'Gbps', min: 0, max: 420 } },
      series: [
        { id: 'rail0', label: 'rail0', points: [{ x: 0, y: 40 }, { x: 1, y: 180 }, { x: 2, y: 190 }, { x: 3, y: 185 }, { x: 4, y: 175 }] },
        { id: 'rail1', label: 'rail1', points: [{ x: 0, y: 35 }, { x: 1, y: 175 }, { x: 2, y: 188 }, { x: 3, y: 181 }, { x: 4, y: 179 }] },
        { id: 'bad', label: 'single', points: [{ x: 0, y: 40 }, { x: 1, y: 210 }, { x: 2, y: 220 }, { x: 3, y: 218 }, { x: 4, y: 211 }] },
      ],
      markers: [
        { id: 'imb', x: 2, y: 220, label: 'cap' },
      ],
    }),
    highlight: { active: ['rail0', 'rail1'], compare: ['bad', 'imb'] },
    explanation: 'The simplified plot shows the operational target: balanced rails and no single saturated path. A single hot rail can dominate p99 even when aggregate bandwidth looks high.',
  };

  yield {
    state: labelMatrix(
      'Release gates',
      [
        { id: 'topo', label: 'topo' },
        { id: 'rank', label: 'rank' },
        { id: 'rail', label: 'rail' },
        { id: 'tail', label: 'tail' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'fail', label: 'fail' },
      ],
      [
        ['visible', 'block'],
        ['expected', 'remap'],
        ['balanced', 'cap'],
        ['p99 ok', 'rollback'],
      ],
    ),
    highlight: { active: ['topo:check', 'rank:check', 'rail:check', 'tail:check'], compare: ['tail:fail'] },
    explanation: 'A complete placement planner has gates. It verifies topology, rank map, rail balance, and p99 before the job is trusted. When a driver update changes device order, the plan should fail loudly.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'rank map') yield* rankMap();
  else if (view === 'rail plan') yield* railPlan();
  else throw new InputError('Pick a GPU topology placement view.');
}

export const article = {
  references: [
    { title: 'NVIDIA NCCL overview', url: 'https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/overview.html' },
    { title: 'NVIDIA NCCL environment variables', url: 'https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/env.html' },
    { title: 'NVIDIA NVLink overview', url: 'https://www.nvidia.com/en-us/data-center/nvlink/' },
  ],
  sections: [
    { heading: 'What it is', paragraphs: ['A GPU collective topology planner maps distributed ranks onto physical GPUs, NICs, NVLink domains, NUMA nodes, and rails before launching a collective-heavy job.', 'This topic connects GPU All-Reduce, NCCL Selector, NVLink/NVSwitch, RDMA, Tensor Parallelism, Pipeline Parallelism, and MoE routing. It treats placement as a first-class data structure rather than a side effect of device enumeration.'] },
    { heading: 'Data structures', paragraphs: ['The core records are rank ID, GPU ID, local bus ID, NVLink domain, nearest NIC, NUMA node, rail, process group, collective shape, expected bandwidth, observed counters, and validation status.', 'NCCL documentation emphasizes topology-aware communication and exposes environment controls for network interfaces, algorithms, protocols, and topology/debug behavior. Those controls are most useful when paired with an explicit placement ledger.'] },
    { heading: 'How it works', paragraphs: ['Tensor-parallel ranks should usually sit inside the fastest local domain because they communicate inside each layer. Data-parallel replicas may prefer bandwidth across rails. Pipeline stages prefer neighbor locality. MoE expert parallelism wants bisection because all-to-all token traffic can spread across many peers.', 'A planner builds candidate rank maps, estimates collective cost, checks hardware visibility, launches a benchmark or warmup, records actual traces, and blocks the placement if the observed topology differs from the expected one.'] },
    { heading: 'Complete case study', paragraphs: ['A model serves with tensor parallelism inside each node and data parallelism across nodes. After a driver update, GPU enumeration changes and two tensor-parallel ranks land across a slower path. The planner catches the mismatch because the rank map no longer matches the expected NVLink island.', 'The team rolls back the placement, pins the rank map, validates NCCL traces, and adds rail-balance counters to the launch gate so the same class of slowdown fails before production traffic.'] },
    { heading: 'Pitfalls', paragraphs: ['Do not assume rank 0 through rank N correspond to the physical order you want. Device ordering, container visibility, MIG, NUMA, NIC binding, and scheduler packing can all change the actual map.', 'Another trap is optimizing one collective shape and harming another. A placement that helps all-reduce may hurt MoE all-to-all or pipeline activation transfer. The planner should know which communication pattern dominates the workload.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: NCCL overview at https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/overview.html, NCCL environment variables at https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/env.html, and NVIDIA NVLink overview at https://www.nvidia.com/en-us/data-center/nvlink/. Study NCCL Selector, RoCE PFC ECN DCQCN, Torch NCCL Flight Recorder, NVLink/NVSwitch GPU Fabric, Tensor Parallelism, and MoE Expert Capacity next.'] },
  ],
};
