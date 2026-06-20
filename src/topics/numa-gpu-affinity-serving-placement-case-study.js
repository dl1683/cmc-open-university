// NUMA and GPU affinity for inference serving: place CPU workers, NICs, GPUs,
// and pinned memory so data does not cross slow sockets by accident.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'numa-gpu-affinity-serving-placement-case-study',
  title: 'NUMA GPU Affinity Serving Placement Case Study',
  category: 'Systems',
  summary: 'A placement case study for inference servers: map GPUs, NICs, CPU workers, pinned memory, and RDMA paths onto the NUMA topology before tuning kernels.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['topology map', 'placement audit'], defaultValue: 'topology map' },
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

function topologyGraph(title, remote = false) {
  return graphState({
    nodes: [
      { id: 'cpu0', label: 'CPU0', x: 0.8, y: 2.0, note: 'NUMA 0' },
      { id: 'cpu1', label: 'CPU1', x: 0.8, y: 5.2, note: 'NUMA 1' },
      { id: 'mem0', label: 'mem0', x: 2.4, y: 2.0, note: 'local' },
      { id: 'mem1', label: 'mem1', x: 2.4, y: 5.2, note: 'local' },
      { id: 'gpu0', label: 'GPU0', x: 4.2, y: 2.0, note: remote ? 'far' : 'near' },
      { id: 'gpu1', label: 'GPU1', x: 4.2, y: 5.2, note: remote ? 'near' : 'far' },
      { id: 'nic0', label: 'NIC0', x: 6.0, y: 2.0, note: 'RDMA' },
      { id: 'worker', label: 'worker', x: 6.0, y: 5.2, note: remote ? 'wrong' : 'pinned' },
      { id: 'serve', label: 'serve', x: 8.2, y: 3.6, note: remote ? 'cross hop' : 'local' },
    ],
    edges: [
      { id: 'e-cpu0-mem0', from: 'cpu0', to: 'mem0' },
      { id: 'e-cpu1-mem1', from: 'cpu1', to: 'mem1' },
      { id: 'e-mem0-gpu0', from: 'mem0', to: 'gpu0', weight: 'local' },
      { id: 'e-mem1-gpu1', from: 'mem1', to: 'gpu1', weight: 'local' },
      { id: 'e-gpu0-nic0', from: 'gpu0', to: 'nic0', weight: remote ? 'SYS' : 'PIX' },
      { id: 'e-worker-gpu0', from: 'worker', to: 'gpu0', weight: remote ? 'remote' : 'local' },
      { id: 'e-nic0-serve', from: 'nic0', to: 'serve' },
      { id: 'e-worker-serve', from: 'worker', to: 'serve' },
      { id: 'e-gpu0-serve', from: 'gpu0', to: 'serve' },
    ],
  }, { title });
}

function* topologyMap() {
  yield {
    state: topologyGraph('Topology is part of the serving plan'),
    highlight: { active: ['cpu0', 'mem0', 'gpu0', 'nic0', 'worker', 'e-mem0-gpu0', 'e-gpu0-nic0', 'e-worker-gpu0'], found: ['serve'] },
    explanation: 'Before tuning kernels, an inference server needs a topology map. CPU worker threads, pinned host buffers, NICs, GPUs, and RDMA paths should be co-located on the same NUMA island when possible.',
    invariant: 'A fast GPU can still wait on a slow placement path.',
  };

  yield {
    state: labelMatrix(
      'Placement ledger',
      [
        { id: 'worker', label: 'worker' },
        { id: 'hostbuf', label: 'host buf' },
        { id: 'gpu', label: 'GPU' },
        { id: 'nic', label: 'NIC' },
        { id: 'kv', label: 'KV tier' },
      ],
      [
        { id: 'bind', label: 'bind' },
        { id: 'signal', label: 'signal' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['CPU set', 'core id', 'migrate'],
        ['NUMA node', 'page loc', 'remote read'],
        ['PCIe root', 'topo code', 'SYS hop'],
        ['same root', 'RDMA path', 'copy path'],
        ['near tier', 'hit lat', 'stall'],
      ],
    ),
    highlight: { active: ['worker:bind', 'hostbuf:bind', 'gpu:signal', 'nic:bind'], found: ['kv:signal'] },
    explanation: 'The runtime should store placement as data, not tribal knowledge. The ledger records where worker threads run, where host pages live, where GPUs and NICs attach, and what latency the cache tier actually shows.',
  };

  yield {
    state: topologyGraph('A remote worker creates hidden cross-socket traffic', true),
    highlight: { active: ['worker', 'gpu0', 'serve', 'e-worker-gpu0', 'e-worker-serve'], removed: ['cpu0', 'mem0'], compare: ['nic0'] },
    explanation: 'A common failure is a GPU worker scheduled on the wrong socket. The code still works, but host copies, control traffic, or RDMA setup cross the inter-socket fabric and inflate p99.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'request concurrency', min: 0, max: 10 }, y: { label: 'p99 latency, relative', min: 0, max: 3 } },
      series: [
        { id: 'local', label: 'affinity ok', points: [{ x: 1, y: 1.0 }, { x: 3, y: 1.1 }, { x: 5, y: 1.25 }, { x: 8, y: 1.45 }, { x: 10, y: 1.7 }] },
        { id: 'remote', label: 'remote hops', points: [{ x: 1, y: 1.15 }, { x: 3, y: 1.45 }, { x: 5, y: 1.9 }, { x: 8, y: 2.45 }, { x: 10, y: 2.85 }] },
      ],
      markers: [
        { id: 'knee', x: 5, y: 1.9, label: 'knee' },
      ],
    }),
    highlight: { active: ['local'], compare: ['remote', 'knee'] },
    explanation: 'Remote placement often looks acceptable at low concurrency and then bends p99 under load. That is why placement should be part of admission and routing, not only a host startup script.',
  };
}

function* placementAudit() {
  yield {
    state: labelMatrix(
      'Audit commands and artifacts',
      [
        { id: 'topo', label: 'topology' },
        { id: 'cpu', label: 'CPU pin' },
        { id: 'mem', label: 'page loc' },
        { id: 'rdma', label: 'RDMA' },
        { id: 'trace', label: 'trace' },
      ],
      [
        { id: 'artifact', label: 'artifact' },
        { id: 'question', label: 'question' },
      ],
      [
        ['GPU/NIC matrix', 'PIX or SYS?'],
        ['cpuset', 'can it move?'],
        ['numa pages', 'remote faults?'],
        ['peer path', 'direct or staged?'],
        ['span fields', 'p99 source?'],
      ],
    ),
    highlight: { active: ['topo:artifact', 'cpu:artifact', 'rdma:artifact'], found: ['trace:question'] },
    explanation: 'A useful audit produces artifacts: topology matrix, CPU affinity, memory placement, RDMA path, and trace fields. Without artifacts, placement regressions are hard to reproduce.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'route', label: 'router', x: 0.8, y: 3.5, note: 'select' },
        { id: 'score', label: 'score', x: 2.7, y: 3.5, note: 'affinity' },
        { id: 'ok', label: 'local GPU', x: 4.7, y: 2.2, note: 'use' },
        { id: 'bad', label: 'remote GPU', x: 4.7, y: 4.8, note: 'avoid' },
        { id: 'fallback', label: 'fallback', x: 6.9, y: 4.8, note: 'shed' },
        { id: 'span', label: 'span', x: 8.7, y: 3.5, note: 'why' },
      ],
      edges: [
        { id: 'e-route-score', from: 'route', to: 'score' },
        { id: 'e-score-ok', from: 'score', to: 'ok' },
        { id: 'e-score-bad', from: 'score', to: 'bad' },
        { id: 'e-bad-fallback', from: 'bad', to: 'fallback' },
        { id: 'e-ok-span', from: 'ok', to: 'span' },
        { id: 'e-fallback-span', from: 'fallback', to: 'span' },
      ],
    }, { title: 'Routing can consume affinity scores' }),
    highlight: { active: ['route', 'score', 'ok', 'e-route-score', 'e-score-ok'], compare: ['bad', 'fallback'] },
    explanation: 'The scheduler can use affinity as one score among queue depth, cache locality, and SLO. If the only available GPU is remote and the request is latency-sensitive, deferring may be better than serving slowly.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'migrate', label: 'thread move' },
        { id: 'alloc', label: 'bad alloc' },
        { id: 'nic', label: 'NIC mismatch' },
        { id: 'multi', label: 'multi proc' },
        { id: 'autoscale', label: 'autoscale' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['jitter', 'pin worker'],
        ['remote page', 'bind alloc'],
        ['extra copy', 'topo check'],
        ['contention', 'per-GPU pool'],
        ['cold wrong node', 'warm map'],
      ],
    ),
    highlight: { active: ['migrate:guard', 'alloc:guard', 'nic:guard'], compare: ['autoscale:symptom'] },
    explanation: 'Autoscaling can break a perfect hand-tuned host by starting a worker on the wrong NUMA node or without warming the right cache tier. The placement guard has to run continuously.',
  };

  yield {
    state: labelMatrix(
      'Complete case study: RDMA inference worker',
      [
        { id: 'discover', label: 'discover' },
        { id: 'bind', label: 'bind' },
        { id: 'allocate', label: 'allocate' },
        { id: 'serve', label: 'serve' },
        { id: 'observe', label: 'observe' },
      ],
      [
        { id: 'step', label: 'step' },
        { id: 'proof', label: 'proof' },
      ],
      [
        ['map GPU/NIC', 'topo matrix'],
        ['pin worker', 'cpuset'],
        ['local pages', 'numa stat'],
        ['route local', 'span field'],
        ['watch p99', 'drift alert'],
      ],
    ),
    highlight: { found: ['discover:proof', 'bind:proof', 'allocate:proof', 'serve:proof', 'observe:proof'] },
    explanation: 'The deployment recipe is concrete: discover topology, pin workers, allocate local host buffers, route requests to local GPU/NIC pairs, and emit spans that prove the placement path used by each request.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'topology map') yield* topologyMap();
  else if (view === 'placement audit') yield* placementAudit();
  else throw new InputError('Pick a NUMA/GPU affinity view.');
}

export const article = {
  references: [
    { title: 'NVIDIA GPUDirect RDMA Overview', url: 'https://docs.nvidia.com/cuda/gpudirect-rdma/' },
    { title: 'NVIDIA GPUDirect Developer Page', url: 'https://developer.nvidia.com/gpudirect' },
    { title: 'NVIDIA GPUDirect Storage Benchmarking and Configuration Guide', url: 'https://docs.nvidia.com/gpudirect-storage/configuration-guide/index.html' },
  ],
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'NUMA GPU affinity is the placement discipline that keeps CPU worker threads, pinned host buffers, NICs, GPUs, and nearby cache tiers on the shortest practical path. In LLM serving, bad affinity can turn a fast model into a tail-latency problem because host copies, control traffic, page faults, or RDMA setup cross the wrong socket.',
        'This topic exists because hardware topology is easy to ignore when the code still works. A request can complete while paying an avoidable inter-socket hop. At low load that tax may hide in the noise. Under concurrency it can bend p99 and make the serving stack look worse than the model or engine actually is.',
        {type:'callout', text:'Affinity makes hardware topology part of the serving algorithm by scoring worker, memory, GPU, NIC, and cache placement as one path.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/e/ee/NUMA-scheme-fr.svg', alt:'Diagram of processors connected to local memory modules and an interconnect.', caption:'NUMA architecture diagram by Topeil, Wikimedia Commons, CC0.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious attempt is to let the operating system and scheduler place workers wherever capacity is available. If a GPU is free, send work to it. If a thread can run, let it run. This is simple, portable, and good enough for many CPU-only services.',
        'The wall appears when the server has several NUMA domains and multiple PCIe paths. A worker on CPU1 can drive GPU0 near CPU0. A pinned buffer can live on the wrong memory node. A NIC can reach a GPU through a slower path. None of that changes the API result, but it changes latency and jitter.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is to treat placement as data. The system needs a topology matrix, not a comment in a runbook. The matrix should map CPU sockets, memory nodes, GPUs, NICs, PCIe root complexes, RDMA capability, cache tiers, and observed transfer latency.',
        'That matrix becomes a placement ledger for each worker: CPU set, NUMA node for host pages, GPU id, NIC id, topology code, cache tier, and p95 or p99 transfer evidence. Once the ledger exists, routers and admission controls can consume affinity instead of discovering it after p99 breaks.',
      ],
    },
    {
      heading: 'How to inspect placement',
      paragraphs: [
        'Inspect placement as a topology proof. A good trace should say which CPU set ran the worker, where host pages were allocated, which GPU executed the model, which NIC handled network traffic, and whether the measured path matched the intended affinity group.',
        'The key distinction is between available capacity and good capacity. A remote GPU may be available, and the request may still finish, but the extra socket hop can turn into p99 jitter. Serious serving systems need to record when they used a local path, when they accepted a remote path, and why.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A multi-socket server has separate memory domains. Local memory is cheaper for the CPU attached to that socket. GPUs and NICs attach through PCIe paths that may be near one socket and far from another. GPUDirect RDMA is most useful when the GPU and peer device have a supported direct path, commonly requiring the devices to share the right upstream PCIe relationship.',
        'A serving runtime should discover the topology, pin worker threads, allocate host buffers on the intended NUMA node, confirm the GPU/NIC path, and emit trace fields for the path each request used. The router can then add affinity to the same scorecard that already considers queue depth, cache locality, and SLO class.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is a locality invariant. If a request uses worker CPU, host pages, GPU, and NIC that all match the recorded topology path, the system avoids avoidable remote hops for that path. It does not make the model faster; it removes accidental placement latency from the critical path.',
        'The ledger also makes failures diagnosable. If p99 rises after an autoscale event, the operator can compare the old and new topology fields. Without that record, the team may waste time tuning kernels while the real regression is a worker that moved to the wrong socket.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Affinity control adds operational friction. Pinning can reduce scheduler flexibility. Reserving local buffers can fragment memory. Per-GPU worker pools can leave some resources idle. Topology discovery and RDMA validation add startup checks and ongoing drift detection.',
        'There is also a fairness tradeoff. A latency-sensitive request may defer instead of using a remote GPU, while batch work may accept the remote path. That means placement should be weighted by SLO class rather than enforced as one global rule.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'This pattern wins on multi-socket GPU servers, RDMA-heavy serving paths, retrieval-heavy systems that move large prompt chunks, disaggregated KV-transfer paths, and hosts where GPUs, NICs, and CPU sockets are not symmetric. It is a final-tier lever only after the team can measure the path.',
        'A strong use case is an inference worker that receives context over RDMA and serves a shard on GPU0. Discovery shows GPU0 and NIC0 are near CPU0. The runtime pins the worker to CPU0, allocates host buffers on NUMA node 0, verifies the peer path, and writes the placement fields into every trace.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It is not worth much on a simple single-socket system or a workload dominated by model compute with little host or network traffic. It also fails when teams assume a feature name proves the path. GPUDirect, RDMA, and pinned memory still need hardware support, driver support, and verified placement.',
        'The common production failure is drift. Hardware fails, pods move, drivers update, autoscalers create workers on cold nodes, and cache tiers change. A one-time startup script is not enough. The audit has to run continuously and feed the scheduler.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A retrieval-heavy inference worker receives prompt chunks over RDMA and serves a model shard on GPU0. Discovery shows GPU0 and NIC0 near CPU0. The runtime pins the worker to CPU0, allocates host buffers on NUMA node 0, confirms the peer path, and emits gpu_id, nic_id, cpu_set, numa_node, topology_code, and transfer_p99 in every span.',
        'If autoscaling starts the next worker on CPU1 with GPU0, the router sees the affinity score drop. Interactive traffic waits for a local path or chooses another host. Batch traffic may still use the remote worker if its deadline can absorb the tax. The decision is explicit instead of accidental.',
      ],
    },
    {
      heading: 'Placement algorithm',
      paragraphs: [
        'A practical placement algorithm starts by building a topology table at node admission time. It records CPU sockets, NUMA nodes, GPUs, NICs, PCIe relationships, peer-access support, measured copy latency, RDMA validation, and any reserved memory pools. Startup should fail or degrade loudly when the table is incomplete.',
        'At request time, the router scores candidate workers by SLO class, queue depth, cache locality, and topology fit. Local topology should not always win. A saturated local worker can be worse than a lightly loaded remote worker for batch traffic. The point of the score is to make the tradeoff explicit and measurable instead of accidental.',
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        'Track transfer latency by CPU-GPU-NIC tuple, remote-memory rate, pinned-buffer node, RDMA fallback count, queue depth by affinity group, GPU utilization, network throughput, page-fault rate, and p99 by placement code. The point is not to admire topology diagrams; it is to connect topology to user-visible latency and cost.',
        'A deployment gate should reject unknown topology, missing peer-path validation, or traces that omit placement fields. Otherwise the platform can drift into a slower configuration while dashboards still report that GPUs are healthy and pods are ready.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'NUMA/GPU affinity is the lesson that hardware topology is part of the algorithm. The router cannot make good placement decisions if the topology lives only in a runbook. The state has to be measured, logged, and fed into admission and routing policy.',
        'For course design, teach this after basic scheduling and before advanced LLM serving optimization. It grounds abstract placement in concrete data structures: topology matrix, worker ledger, route score, and trace fields.',
        'The mistake to avoid is tuning kernels while ignoring placement. Kernel fusion, batching, and KV-cache policy matter, but a bad CPU-GPU-NIC path can tax every request before the model gets a chance to run efficiently.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: NVIDIA GPUDirect RDMA at https://docs.nvidia.com/cuda/gpudirect-rdma/, NVIDIA GPUDirect overview at https://developer.nvidia.com/gpudirect, and NVIDIA GPUDirect Storage benchmarking guide at https://docs.nvidia.com/gpudirect-storage/configuration-guide/index.html.',
        'Study RDMA Queue Pair Work Request Case Study for the transport primitive, GPUDirect RDMA Peer Memory Case Study for GPU/peer access, CXL Memory Pooling Type-3 Fabric Case Study for memory tiers, SLO-Aware LLM Request Router for consuming affinity scores, and AI Rack Topology Power Thermal Ledger for rack-level placement constraints.',
      ],
    },
  ],
};
