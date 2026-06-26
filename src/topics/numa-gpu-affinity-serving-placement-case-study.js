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
  sections: [
    { heading: 'How to read the animation', paragraphs: ['Read the diagram as a hardware-distance map. NUMA means non-uniform memory access, so a CPU socket reaches local memory faster than memory attached to another socket.', 'The active placement path shows which CPU, memory node, GPU, and NIC serve one request. A good placement keeps control traffic, host buffers, accelerator work, and network transfer on the shortest practical path.', {type:'callout', text:'Affinity makes hardware topology part of the serving algorithm by scoring worker, memory, GPU, NIC, and cache placement as one path.'}, {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/e/ee/NUMA-scheme-fr.svg', alt:'Diagram of processors connected to local memory modules and an interconnect.', caption:'NUMA architecture diagram by Topeil, Wikimedia Commons, CC0.'}] },
    { heading: 'Why this exists', paragraphs: ['LLM serving can be correct while paying avoidable hardware-distance cost. A worker on one CPU socket can drive a GPU or NIC closer to another socket and still return the right tokens.', 'Under load, that remote path can show up as p99 latency, copy overhead, page-fault cost, or RDMA fallback. Affinity exists to make topology part of routing instead of a hidden accident.'] },
    { heading: 'The obvious approach', paragraphs: ['The obvious approach is to send work to any available GPU. If the model fits and the worker is idle, the request runs.', 'That is simple and often fine on a single-socket host. It breaks on multi-socket GPU servers where CPU threads, pinned buffers, NICs, and GPUs are not equally close.'] },
    { heading: 'The wall', paragraphs: ['The wall is invisible distance. PCIe hops, socket crossings, remote memory, and unsupported peer paths do not change the API result, but they change latency and jitter.', 'A second wall is drift. Pods move, drivers update, hardware fails, and an autoscaler can create workers with a different topology path than the one benchmarked last week.'] },
    { heading: 'The core insight', paragraphs: ['Treat placement as data, not as a deployment note. The system needs a topology matrix that records CPU sockets, NUMA nodes, GPUs, NICs, PCIe relationships, peer access, and measured transfer latency.', 'Each worker then gets a placement ledger. The router can score candidates by queue depth, cache locality, service class, and topology fit before assigning a request.'] },
    { heading: 'How it works', paragraphs: ['At node admission, the runtime discovers hardware topology and validates peer paths. It records which CPU sets are near which GPUs and NICs, where host buffers should be allocated, and whether GPUDirect or RDMA paths are actually available.', 'At request time, the router scores workers. Interactive traffic may wait for a local path, while batch traffic may accept a remote path if the deadline can absorb the extra cost.'] },
    { heading: 'Why it works', paragraphs: ['The correctness argument is locality preservation. If the worker CPU, host pages, GPU, NIC, and cache tier match the recorded topology path, then the request avoids avoidable remote hops for that path.', 'This does not make the model compute faster. It removes placement noise so batching, kernels, and cache policy can be evaluated without a hidden hardware-distance tax.'] },
    { heading: 'Cost and complexity', paragraphs: ['Affinity control costs scheduler flexibility. Pinning workers, reserving local buffers, and keeping per-GPU pools can leave capacity idle when the perfect local path is busy.', 'The behavior tradeoff depends on service class. A remote path that adds 0.8 ms may be unacceptable for a 20 ms interactive budget, but harmless for a 2 second batch request.'] },
    { heading: 'Real-world uses', paragraphs: ['This pattern fits multi-socket GPU servers, RDMA-heavy inference, retrieval-heavy prompting, disaggregated KV-cache transfer, and hosts where NIC-GPU paths are asymmetric. It matters most when network or host-memory movement is on the serving critical path.', 'It is also a debugging surface. Traces that include gpu_id, nic_id, cpu_set, numa_node, topology_code, and transfer_p99 let operators compare placement before and after an autoscale event.'] },
    { heading: 'Where it fails', paragraphs: ['It fails when topology is not the bottleneck. A compute-bound model on a single-socket host may gain little from affinity beyond simpler operational discipline.', 'It also fails when feature names are trusted without measurement. GPUDirect, RDMA, pinned memory, and peer access still need hardware support, driver support, and verified path behavior.'] },
    { heading: 'Worked example', paragraphs: ['A server has CPU0 near GPU0 and NIC0, while CPU1 is remote from GPU0. Local host-to-GPU staging measures 0.30 ms for a prompt buffer, and the remote path measures 1.10 ms.', 'For an interactive request with a 25 ms p99 target, the extra 0.80 ms consumes 3.2 percent of the budget before the model runs. For 1,000 requests per second, that remote tax also adds 800 ms of aggregate waiting per second across the fleet.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources are NVIDIA GPUDirect RDMA documentation, NVIDIA GPUDirect overview material, GPUDirect Storage configuration guidance, Linux NUMA documentation, and vendor topology tools such as nvidia-smi topo. Measure on the target host because topology is deployment-specific.', 'Study NUMA scheduling, PCIe topology, RDMA queue pairs, GPUDirect peer memory, KV-cache transfer, SLO-aware request routing, and cache locality next. The practical skill is turning hardware topology into a routing feature with evidence.'] },
  ],
};