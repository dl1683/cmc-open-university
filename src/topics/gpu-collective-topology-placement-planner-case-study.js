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
    explanation: 'Read each row as one rank placement decision. The map joins rank ID, GPU, NVLink island, nearest NIC, NUMA node, and rail so a collective-heavy job does not discover locality by accident at runtime.',
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
    explanation: 'Read the two NIC paths as separate rails that can carry chunks in parallel. The planner must know which GPUs are close to which NICs, or striping can accidentally create cross-NUMA or cross-PCIe penalties.',
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
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the left side as the hardware graph: GPUs, NVLink or NVSwitch domains, PCIe roots, NUMA nodes, NICs, rails, and racks. Read the right side as the workload graph: ranks, process groups, tensor-parallel edges, data-parallel edges, and expected collective traffic.',
        'The safe inference is that an expensive communication edge should map to a cheap physical path when possible. If two tensor-parallel ranks exchange data every layer, placing them across a slow PCIe or network boundary is a placement bug even when both GPUs are free.',
        {type:'callout', text:'Rank placement is graph mapping: expensive communication edges should land on the cheapest physical links the hardware can provide.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Distributed GPU jobs use collective operations such as all-reduce, reduce-scatter, all-gather, and all-to-all. A collective is a communication pattern where many ranks coordinate data movement, often on every training step or inference batch.',
        'The placement planner exists because logical rank numbers do not tell the hardware where traffic should flow. Rank 0 and rank 1 may be neighbors in the program but far apart in the machine if device order, NIC affinity, or scheduler placement drifts.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to launch ranks in numeric order on the visible CUDA devices. If the node is stable and every GPU path is symmetric, that may be enough.',
        'A second obvious approach lets the collective library choose paths after launch. That helps, but the library can only optimize the devices and process mapping it receives; it cannot always fix a bad scheduler-level rank map.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that GPU topology is not flat. Some GPUs share fast NVLink or NVSwitch fabric, some cross PCIe roots, some sit closer to one NIC than another, and some network rails saturate before the job reaches expected throughput.',
        'Workload communication is not flat either. Tensor parallelism, pipeline parallelism, data parallelism, and expert parallelism have different traffic shapes, so one rank map can be excellent for all-reduce and poor for all-to-all.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Rank placement is constrained graph mapping. The planner maps the workload graph onto the hardware graph so high-volume edges use the cheapest available links and lower-volume edges absorb the longer paths.',
        'The useful artifact is a locality ledger. For each rank, it records GPU ID, PCI bus ID, fabric island, NUMA node, nearest NIC, rail, process group, expected traffic, and validation status.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'First, the planner discovers hardware using stable identifiers such as PCI bus IDs, GPU UUIDs, peer access, NIC affinity, NUMA locality, and rail membership. Logical device index is treated as a view, not as the source of truth.',
        'Second, it classifies workload traffic. Tensor-parallel ranks prefer the fastest local fabric, data-parallel replicas need balanced cross-node bandwidth, pipeline stages care about producer-consumer locality, and expert parallelism cares about all-to-all bisection.',
        'Third, it scores candidate rank maps against hard constraints and soft preferences. After launch, warmup collectives and counters confirm whether the actual map matches the planned map.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is that placement preserves declared constraints before performance tuning begins. A rank that requires a GPU in a local NVLink island cannot be assigned outside that island without failing the plan.',
        'Performance improves because the planner aligns large communication edges with high-bandwidth paths and spreads scale-out traffic across rails. Validation catches drift between intended and actual placement before a long run burns hours.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Planning cost grows with candidate placements, hardware nodes, and constraints. Exhaustive search can be too expensive, so practical planners use heuristics, locality groups, and scoring rather than trying every permutation.',
        'The behavioral cost is scheduling rigidity. Requiring perfect local islands can increase queue time or fragment the fleet, while making every rule soft can let the scheduler choose a placement that passes admission and fails performance.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This planner is useful for multi-node training, tensor-parallel inference, mixture-of-experts serving, NCCL-heavy jobs, and clusters with multiple NIC rails. It matters most when communication time is a large share of step time.',
        'It is also useful after a platform change. A driver update, container setting, MIG layout, drained GPU, or scheduler policy change can alter visible device order while the model code stays untouched.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The planner cannot create bandwidth that the fabric does not have. If the cluster lacks enough fast links for the requested process groups, the correct answer may be reject, wait, or use a smaller parallelism plan.',
        'It also fails with stale topology inventory or workloads that change communication shape after launch. A placement tuned for one batch size, sequence length, or bucket schedule can become wrong when those parameters change.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose eight ranks run on one server with two four-GPU NVLink islands and two NIC rails. Tensor-parallel groups are ranks 0-3 and 4-7, and each group exchanges 20 GB per step inside the group, while data-parallel sync sends 4 GB per step across groups.',
        'A bad numeric placement splits each tensor group two-and-two across islands, so 40 GB of tensor traffic crosses slower paths every step. A better placement puts ranks 0-3 in island A and ranks 4-7 in island B, then balances the 4 GB data-parallel traffic across the two NIC rails.',
        'If local fabric sustains 600 GB/s and cross-island PCIe sustains 64 GB/s, a 20 GB exchange is roughly 33 ms locally and 312 ms across PCIe before protocol overhead. That gap explains why placement can dominate step time.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary references are NVIDIA NCCL documentation at https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/overview.html, NCCL environment-variable documentation at https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/env.html, and NVIDIA NVLink material at https://www.nvidia.com/en-us/data-center/nvlink/. Hardware topology should always be verified on the target cluster.',
        'Study NCCL collectives, NVLink, NVSwitch, PCIe topology, NUMA locality, RDMA NIC affinity, GPUDirect RDMA, process groups, tensor parallelism, pipeline parallelism, and scheduler placement plugins next.',
      ],
    },
  ],
};
