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
  references: [
    { title: 'NVIDIA NCCL overview', url: 'https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/overview.html' },
    { title: 'NVIDIA NCCL environment variables', url: 'https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/env.html' },
    { title: 'NVIDIA NVLink overview', url: 'https://www.nvidia.com/en-us/data-center/nvlink/' },
  ],
  sections: [
    {
      heading: 'Why this planner exists',
      paragraphs: [
        'A collective algorithm is only as good as the rank placement it receives. The program may create ranks 0 through 7 and ask for an all-reduce, but the hardware sees GPUs, PCIe roots, NVLink domains, NUMA nodes, NICs, switch ports, and network rails. If logical neighbors land on distant devices, a good collective can still take a bad path. If scale-out flows all choose one rail, average GPU utilization can hide a tail-latency problem.',
        'The placement planner exists to make rank mapping an explicit part of distributed training and serving. It decides where ranks should run before NCCL, the framework, and the scheduler turn device visibility into execution. The planner is not a replacement for NCCL topology awareness. It is the layer that states the intent: these ranks are tensor-parallel neighbors, these replicas should be spread, these buckets should stripe across rails, and this launch must fail if the actual topology does not match.',
        {type:'callout', text:'Rank placement is graph mapping: expensive communication edges should land on the cheapest physical links the hardware can provide.'},
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        'The naive approach is to launch ranks in numeric order and hope that CUDA device order matches the physical topology. That can work in a lab node that never changes. It breaks when a driver update changes enumeration, a container exposes devices in a different order, a MIG layout changes, a scheduler packs jobs across sockets, a NIC binding changes, or one GPU is drained and the remaining visible devices shift.',
        'A second naive approach is to optimize for one communication pattern. A placement that is excellent for data-parallel all-reduce may be poor for tensor-parallel in-layer collectives. Packing tensor-parallel ranks into the fastest local island can overload the nearest NIC for data-parallel traffic. Spreading ranks across rails can help cross-node bandwidth while hurting pipeline stage locality. The planner has to know which communication dominates and which costs are acceptable.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that rank placement is a constrained graph problem. The input graph contains GPUs, links, switches, NICs, PCIe roots, sockets, rails, racks, and failure domains. The workload graph contains ranks, process groups, parallelism dimensions, expected collectives, tensor sizes, and priority. A good placement maps the workload graph onto the hardware graph so the expensive edges in the workload land on cheap edges in the hardware.',
        'This is why the planner keeps a locality ledger. For each rank it records rank ID, GPU ID, PCI bus ID, NVLink or NVSwitch island, nearest NIC, NUMA node, rail membership, process group, dominant collective shape, expected bandwidth, observed counters, and validation status. The ledger makes placement debuggable. When performance changes, the team can compare current placement to the last known good placement instead of guessing from hostnames.',
      ],
    },
    {
      heading: 'How the planner works',
      paragraphs: [
        'First, the planner discovers hardware. It reads visible GPUs, bus IDs, peer access, NVLink or NVSwitch connectivity, PCIe hierarchy, CPU socket locality, NIC affinity, and rail membership. In a cluster, it also reads rack and network placement. This discovery must use stable identifiers. Logical device index is not stable enough because containers and launchers can reorder what the process sees.',
        'Second, it classifies workload traffic. Tensor-parallel groups usually want the fastest local GPU fabric because every layer can exchange partial results. Pipeline-parallel stages prefer nearby producer-consumer pairs for activation movement, while still needing enough separation for memory and scheduling. Data-parallel replicas care about large all-reduce or reduce-scatter across nodes, so rail balance and NIC locality matter. MoE expert parallelism cares about bisection and all-to-all token movement.',
        'Third, it builds candidate rank maps. A map is scored against locality, bandwidth, rail balance, failure-domain rules, and scheduler constraints. The planner can reserve local islands for tensor groups, assign replicas across racks, bind ranks to NICs, and split buckets across rails. After launch, it validates the actual state: visible device order, bus IDs, process-to-GPU mapping, NCCL selected paths, per-rail counters, and warmup collective times.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The rank-map view is proving that the matrix is the source of truth. Each rank is not merely a number. It is attached to a GPU, a bus ID, a local fabric domain, a NUMA node, a nearest NIC, and a rail plan. Natural groups appear when several ranks share fast links or balanced access to the right NICs. Bad groups appear when logical neighbors cross a slow path that the framework never named.',
        'The rail-plan view is proving that a bucket schedule is also a placement decision. Each chunk has a source group, a rail, a locality expectation, and a capacity check. If all chunks pick the same rail, aggregate device count is misleading. If chunks cross the wrong NUMA path, rail striping can cost more than it saves. The plot target is not only high throughput; it is balanced per-rail work and stable p99 collective time.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The planner works by aligning the largest communication edges with the cheapest physical paths. Tensor-parallel traffic stays inside strong local connectivity where possible. Data-parallel traffic spreads across scale-out rails instead of hot-spotting one NIC. Pipeline traffic keeps adjacent stages close when activation movement matters. Expert traffic avoids placements that collapse all-to-all exchange onto a narrow path. This is ordinary graph mapping applied to GPU communication.',
        'It also works because it validates reality. Many failures come from drift between intended placement and actual placement. A warmup gate can run representative collectives, check NCCL debug evidence, compare bus IDs, and read counters before the job enters a long run. If the actual map differs from the planned map, the launcher can fail loudly. That is cheaper than burning hours on a slow job or changing model code to compensate for a hardware mapping mistake.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Placement is not a free win. Tighter placement can reduce scheduling flexibility and increase queue time. Keeping tensor groups inside perfect local islands can fragment the cluster. Spreading replicas across failure domains can increase network distance. Rail striping can improve bandwidth but add complexity and make debugging harder. A placement that is optimal for one model shape can be wrong after batch size, sequence length, parallelism degree, or bucketization changes.',
        'There is also a measurement cost. The planner needs fresh topology discovery, stable inventory, warmup tests, and counters. It must distinguish hard constraints from preferences. If every recommendation becomes mandatory, utilization can fall. If every constraint is soft, the scheduler can silently violate locality. The practical design is to gate the requirements that protect correctness or huge performance cliffs, then score the rest as preferences that can be traded against fleet efficiency.',
      ],
    },
    {
      heading: 'Real uses and failure modes',
      paragraphs: [
        'A common real use is a model with tensor parallelism inside each node and data parallelism across nodes. After a platform update, GPU enumeration changes. Two tensor-parallel ranks that used to share a fast local domain now cross a slower PCIe path, while the nearest NIC binding also changes. Step time rises even though the model code and NCCL version look unchanged. A saved rank map exposes the drift immediately.',
        'Another use is inference serving with mixed prefill, decode, and batch pools. Prefill groups may need strong local bandwidth and higher power headroom. Decode replicas may need failure spread and stable tail latency. Batch embedding work can use leftover capacity with looser topology requirements. The planner lets the serving layer ask for different placements instead of treating all GPUs as identical slots.',
        'The main failure modes are silent remap, wrong NIC affinity, single-rail saturation, stale topology inventory, container-visible order drift, MIG or partition changes, assuming average bandwidth is enough, and ignoring the communication pattern. The planner cannot overcome a fabric that lacks capacity, a scheduler that ignores hard constraints, or an application that changes bucketization without updating the placement model. It can only make the mismatch visible and prevent avoidable launches.',
      ],
    },
    {
      heading: 'What to study next',
      paragraphs: [
        'Study NCCL collectives, rank ordering, NVLink and NVSwitch topology, PCIe hierarchy, NUMA locality, RDMA NIC affinity, GPUDirect RDMA, rail striping, process groups, tensor parallelism, pipeline parallelism, expert parallelism, and scheduler placement plugins. Then connect this topic to the NCCL Algorithm Protocol Selector, RoCE PFC ECN DCQCN, AI Rack Topology Power Thermal Ledger, Torch NCCL Flight Recorder, and LLM inference cost modeling. The practical skill is to explain a collective result by showing the rank map that made it possible or impossible.',
      ],
    },
  ],
};
