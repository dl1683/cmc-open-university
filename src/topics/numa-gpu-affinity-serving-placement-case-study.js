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
    { heading: 'What it is', paragraphs: ['NUMA GPU affinity is the placement discipline that keeps CPU worker threads, host buffers, NICs, GPUs, and cache tiers close to each other. For LLM serving, bad affinity can silently turn a fast model into a tail-latency problem because control traffic, pinned memory, or RDMA paths cross the wrong socket.', 'The local inference-scaling notes mention topology as a final-tier lever. This case study makes it explicit: placement is a data structure. Store the topology matrix, bind workers, record where pages live, and route requests with that information.'] },
    { heading: 'How it works', paragraphs: ['A multi-socket server has several memory domains. A GPU and NIC may share a PCIe root complex with one CPU socket, while a different worker thread runs on another socket. The request still completes, but it can pay extra interconnect hops. GPUDirect RDMA and GPUDirect Storage are most valuable when the peer path is actually direct and the process is placed correctly.', 'The serving control plane should maintain a placement ledger: GPU id, NIC id, PCIe locality, CPU set, NUMA node for pinned memory, cache tier, and observed p95 or p99 transfer latency. That ledger feeds SLO-Aware LLM Request Router and AI Rack Topology Power Thermal Ledger.'] },
    { heading: 'Complete case study', paragraphs: ['A retrieval-heavy inference worker receives prompt chunks over RDMA and serves a model shard on GPU0. Discovery shows GPU0 and NIC0 are near CPU0. The runtime pins the worker to CPU0, allocates host buffers on NUMA node 0, confirms the peer path, and emits span fields for gpu_id, nic_id, cpu_set, numa_node, and topology_code. If autoscaling starts the worker on CPU1, the router sees the affinity score drop and avoids the host for latency-sensitive traffic.', 'This is not a unit-test problem. It is an operations invariant: topology can change when hardware fails, pods move, drivers update, or an autoscaler creates new workers. The audit has to run continuously.'] },
    { heading: 'Pitfalls', paragraphs: ['Do not assume a direct path because the feature exists. Confirm the GPU, NIC, CPU, and memory placement. Do not optimize only mean throughput. Remote placement often appears fine at low load and then bends p99 under concurrency. Do not let batch traffic and interactive traffic share the same affinity policy without separate SLO weights.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: NVIDIA GPUDirect RDMA at https://docs.nvidia.com/cuda/gpudirect-rdma/, NVIDIA GPUDirect overview at https://developer.nvidia.com/gpudirect, and NVIDIA GPUDirect Storage benchmarking guide at https://docs.nvidia.com/gpudirect-storage/configuration-guide/index.html. Study RDMA Queue Pair Work Request Case Study, GPUDirect RDMA Peer Memory Case Study, CXL Memory Pooling Type-3 Fabric Case Study, SLO-Aware LLM Request Router, and AI Rack Topology Power Thermal Ledger next.'] },
  ],
};
