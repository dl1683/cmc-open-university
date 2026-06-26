// NCCL performance is a selector problem: choose a collective algorithm,
// protocol, channel count, and transport path from message size and topology.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'nccl-algorithm-protocol-selector-case-study',
  title: 'NCCL Algorithm Protocol Selector Case Study',
  category: 'Systems',
  summary: 'NCCL as a collective selector: topology graph, Ring/Tree/NVLS choices, LL/LL128/Simple protocols, channels, traces, and safe tuning gates.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['algo selector', 'channels trace'], defaultValue: 'algo selector' },
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

function selectorGraph(title) {
  return graphState({
    nodes: [
      { id: 'ranks', label: 'ranks', x: 0.8, y: 3.3, note: 'comm' },
      { id: 'topo', label: 'topo', x: 2.3, y: 2.0, note: 'GPU/NIC' },
      { id: 'msg', label: 'bytes', x: 2.3, y: 4.8, note: 'count' },
      { id: 'select', label: 'select', x: 4.2, y: 3.4, note: 'model' },
      { id: 'ring', label: 'Ring', x: 6.0, y: 1.5, note: 'bw' },
      { id: 'tree', label: 'Tree', x: 6.0, y: 3.4, note: 'lat' },
      { id: 'nvls', label: 'NVLS', x: 6.0, y: 5.3, note: 'offload' },
      { id: 'proto', label: 'proto', x: 7.8, y: 3.4, note: 'LL/Simple' },
      { id: 'run', label: 'kernel', x: 9.4, y: 3.4, note: 'CUDA' },
    ],
    edges: [
      { id: 'e-ranks-topo', from: 'ranks', to: 'topo' },
      { id: 'e-ranks-msg', from: 'ranks', to: 'msg' },
      { id: 'e-topo-select', from: 'topo', to: 'select' },
      { id: 'e-msg-select', from: 'msg', to: 'select' },
      { id: 'e-select-ring', from: 'select', to: 'ring' },
      { id: 'e-select-tree', from: 'select', to: 'tree' },
      { id: 'e-select-nvls', from: 'select', to: 'nvls' },
      { id: 'e-tree-proto', from: 'tree', to: 'proto' },
      { id: 'e-ring-proto', from: 'ring', to: 'proto' },
      { id: 'e-nvls-proto', from: 'nvls', to: 'proto' },
      { id: 'e-proto-run', from: 'proto', to: 'run' },
    ],
  }, { title });
}

function channelGraph(title) {
  return graphState({
    nodes: [
      { id: 'bucket', label: 'bucket', x: 0.8, y: 3.4, note: 'tensor' },
      { id: 'c0', label: 'ch0', x: 2.8, y: 1.8, note: 'slice' },
      { id: 'c1', label: 'ch1', x: 2.8, y: 3.4, note: 'slice' },
      { id: 'c2', label: 'ch2', x: 2.8, y: 5.0, note: 'slice' },
      { id: 'p0', label: 'LL', x: 4.8, y: 1.8, note: 'small' },
      { id: 'p1', label: 'LL128', x: 4.8, y: 3.4, note: 'mid' },
      { id: 'p2', label: 'Simple', x: 4.8, y: 5.0, note: 'large' },
      { id: 'trace', label: 'trace', x: 6.8, y: 3.4, note: 'NCCL' },
      { id: 'slo', label: 'SLO', x: 8.6, y: 3.4, note: 'gate' },
    ],
    edges: [
      { id: 'e-b-c0', from: 'bucket', to: 'c0' },
      { id: 'e-b-c1', from: 'bucket', to: 'c1' },
      { id: 'e-b-c2', from: 'bucket', to: 'c2' },
      { id: 'e-c0-p0', from: 'c0', to: 'p0' },
      { id: 'e-c1-p1', from: 'c1', to: 'p1' },
      { id: 'e-c2-p2', from: 'c2', to: 'p2' },
      { id: 'e-p0-trace', from: 'p0', to: 'trace' },
      { id: 'e-p1-trace', from: 'p1', to: 'trace' },
      { id: 'e-p2-trace', from: 'p2', to: 'trace' },
      { id: 'e-trace-slo', from: 'trace', to: 'slo' },
    ],
  }, { title });
}

function* algoSelector() {
  yield {
    state: selectorGraph('NCCL starts from communicator, topology, and bytes'),
    highlight: { active: ['ranks', 'topo', 'msg', 'select', 'e-topo-select', 'e-msg-select'], compare: ['ring', 'tree', 'nvls'] },
    explanation: 'Read this as a selector pipeline. The rank group, byte count, datatype, reduction op, CUDA stream, and discovered PCIe/NVLink/network paths all feed the plan NCCL will actually launch.',
    invariant: 'A collective plan is valid only for the communicator, topology, message shape, and transport state it was built for.',
  };

  yield {
    state: labelMatrix(
      'Algorithm gate',
      [
        { id: 'small', label: 'small' },
        { id: 'mid', label: 'mid' },
        { id: 'large', label: 'large' },
        { id: 'nvl', label: 'NVL' },
      ],
      [
        { id: 'algo', label: 'algo' },
        { id: 'why', label: 'why' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['Tree', 'latency', 'fanout'],
        ['Ring', 'steady', 'hops'],
        ['Ring', 'bandwidth', 'tail'],
        ['NVLS', 'offload', 'support'],
      ],
    ),
    highlight: { active: ['small:algo', 'large:algo', 'nvl:algo'], compare: ['nvl:risk'] },
    explanation: 'The useful teaching model is a gate table: trees reduce latency for some shapes, rings chase bandwidth, and NVLink SHARP style paths need hardware and software support.',
  };

  yield {
    state: labelMatrix(
      'Protocol gate',
      [
        { id: 'll', label: 'LL' },
        { id: 'll128', label: 'LL128' },
        { id: 'simple', label: 'Simple' },
        { id: 'force', label: 'force' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['small', 'lat'],
        ['mid', 'support'],
        ['large', 'bw'],
        ['debug', 'risk'],
      ],
    ),
    highlight: { active: ['ll:fit', 'simple:fit'], compare: ['force:cost', 'll128:cost'] },
    explanation: 'NCCL exposes protocol controls such as LL, LL128, and Simple. The docs discourage forcing protocol settings except for narrow debugging because unsupported choices can be unsafe.',
  };

  yield {
    state: selectorGraph('The selected plan becomes one CUDA collective kernel'),
    highlight: { active: ['tree', 'proto', 'run', 'e-tree-proto', 'e-proto-run'], found: ['select'], compare: ['ring', 'nvls'] },
    explanation: 'NCCL implements collectives in CUDA kernels that combine communication and computation. The plan is not just an algorithm name; it includes paths, channels, protocol, and launch behavior.',
  };
}

function* channelsTrace() {
  yield {
    state: channelGraph('Channels split one bucket into parallel streams'),
    highlight: { active: ['bucket', 'c0', 'c1', 'c2', 'e-b-c0', 'e-b-c1', 'e-b-c2'] },
    explanation: 'Read the bucket as one logical tensor and the channel nodes as physical transfer lanes. A large bucket can be sliced across channels so links stay busy instead of waiting on one serial movement.',
  };

  yield {
    state: labelMatrix(
      'Trace fields',
      [
        { id: 'op', label: '' },
        { id: 'rank', label: '' },
        { id: 'cnt', label: '' },
        { id: 'path', label: '' },
        { id: 'proto', label: '' },
      ],
      [
        { id: 'stores', label: 'field' },
        { id: 'use', label: 'use' },
      ],
      [
        ['AR', 'match'],
        ['id', 'desync'],
        ['bytes', 'shape'],
        ['NET/NVL', 'topo'],
        ['proto', 'tune'],
      ],
    ),
    highlight: { active: ['op:stores', 'rank:stores', 'cnt:stores', 'path:stores', 'proto:stores'] },
    explanation: 'A useful NCCL trace records what collective ran, on which rank, with what count, over which transport path, and with which protocol. That turns performance debugging from guessing into evidence.',
  };

  yield {
    state: channelGraph('Debug subsystems filter the evidence stream'),
    highlight: { active: ['trace', 'slo', 'e-trace-slo'], found: ['p0', 'p1', 'p2'], compare: ['c0', 'c1', 'c2'] },
    explanation: 'NCCL debug output can be filtered by subsystems such as COLL, NET, GRAPH, TUNING, ENV, RAS, and NVLS. The filter is a data-reduction tool for noisy distributed logs.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'message MB', min: 1, max: 512 }, y: { label: 'relative ms', min: 0, max: 100 } },
      series: [
        { id: 'tree', label: 'Tree', points: [{ x: 1, y: 8 }, { x: 8, y: 12 }, { x: 64, y: 42 }, { x: 512, y: 90 }] },
        { id: 'ring', label: 'Ring', points: [{ x: 1, y: 18 }, { x: 8, y: 21 }, { x: 64, y: 35 }, { x: 512, y: 68 }] },
        { id: 'forced', label: 'forced', points: [{ x: 1, y: 28 }, { x: 8, y: 30 }, { x: 64, y: 55 }, { x: 512, y: 92 }] },
      ],
      markers: [
        { id: 'gate', x: 64, y: 35, label: 'gate' },
      ],
    }),
    highlight: { active: ['tree', 'ring', 'gate'], compare: ['forced'] },
    explanation: 'The curve is illustrative: the decision depends on topology and message size. A forced setting that helped one job can hurt another, so safe tuning is measured and reversible.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'algo selector') yield* algoSelector();
  else if (view === 'channels trace') yield* channelsTrace();
  else throw new InputError('Pick an NCCL selector view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: ['Read the selector as a planner for collective communication. A collective is one operation, such as all-reduce, that every participating GPU rank calls together.', 'The active path shows which input is narrowing the plan: message size, topology, collective type, channel count, or protocol. A protocol is the low-level transfer style NCCL uses for each slice of data.', {type:'callout', text:'NCCL performance comes from selecting a complete execution plan for the current topology, message size, collective, channels, protocol, and transport path.'}, {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/d/d3/Nvidia_GV100_GPU.png', alt:'Nvidia GV100 GPU die.', caption:'A GV100 GPU die, a reminder that collective plans depend on real accelerator topology and transport hardware. Source: Wikimedia Commons, Nvidia, Public domain'}] },
    { heading: 'Why this exists', paragraphs: ['Distributed training and inference move tensors between GPUs constantly. An all-reduce, broadcast, or gather looks like one API call, but the runtime must choose links, rank order, chunks, kernels, and synchronization.', 'GPU nodes are not uniform. Two ranks may share NVLink, cross PCIe, or leave the node through a NIC, so the same tensor size can need a different plan on a different placement.'] },
    { heading: 'The obvious approach', paragraphs: ['The obvious approach is to force the algorithm that won one benchmark. A team might set Ring everywhere after a large all-reduce looks good on one node.', 'That works only while the workload and topology match the benchmark. A small control tensor, a different bucket size, or a rank map that crosses sockets can make the forced setting worse than automatic selection.'] },
    { heading: 'The wall', paragraphs: ['The wall is conditional performance. Ring can use bandwidth well for large messages, while tree-like plans can reduce stages for some smaller or different communication shapes.', 'Protocol choice has the same problem. A low-latency protocol can help small payloads, but a large gradient bucket may need a protocol and channel layout that keeps links saturated.'] },
    { heading: 'The core insight', paragraphs: ['The unit of choice is not just algorithm name. NCCL chooses an execution plan that includes algorithm, protocol, channels, transports, topology gates, and fallback behavior.', 'That makes debugging evidence-based. A slow collective should be explained by the selected plan and measured path, not by a generic complaint that the network is slow.'] },
    { heading: 'How it works', paragraphs: ['NCCL starts from a communicator, which is the group of ranks participating in the collective. It discovers GPU connectivity, PCIe paths, CPU sockets, NIC reachability, software support, and message size.', 'It then evaluates legal candidate plans. The chosen plan slices the tensor across channels, assigns each slice a protocol, and schedules transport work so ranks exchange data in the required collective pattern.'] },
    { heading: 'Why it works', paragraphs: ['The correctness argument comes from collective semantics. For an all-reduce, every rank must contribute exactly one input and receive the same reduced result, no matter which legal ring, tree, or channel decomposition is used.', 'The selector preserves that semantic contract while optimizing the path. If every slice is covered once, reduction order is valid for the operation, and all ranks follow the same plan, the result is correct even when the performance differs.'] },
    { heading: 'Cost and complexity', paragraphs: ['Communication time behaves like latency plus bytes divided by effective bandwidth, with extra terms for synchronization and kernel overhead. A 256 MB all-reduce over an effective 100 GB/s path has a raw data-time floor near 2.56 ms before algorithmic steps and contention.', 'More channels can improve parallelism but also add scheduling overhead and pressure on shared links. Smaller framework buckets can improve overlap with compute while pushing more calls into latency-sensitive regimes.'] },
    { heading: 'Real-world uses', paragraphs: ['The selector matters in multi-GPU training, tensor parallel inference, pipeline parallel jobs, and cross-node checkpoint or embedding traffic. It is most visible when a model step waits on communication rather than compute.', 'It is also a production triage surface. Operators compare rank map, topology, NCCL version, bucket sizes, selected algorithm, protocol, channel count, and p99 collective time after a node image or driver change.'] },
    { heading: 'Where it fails', paragraphs: ['The selector cannot optimize paths it cannot see or use. Bad rank placement, disabled RDMA, wrong NIC selection, fabric congestion, or missing hardware support can force a legal but slow fallback.', 'Manual overrides can fail silently as the cluster changes. A setting that fixed one incident may block a better path after an upgrade or after bucket sizes move across a threshold.'] },
    { heading: 'Worked example', paragraphs: ['Eight GPUs run an all-reduce on a 64 MB bucket. If the selected plan gives 200 GB/s effective local bandwidth, the raw transfer term is about 0.32 ms, while a 20 us launch and synchronization cost is small.', 'The same job with 256 KB buckets behaves differently. The raw transfer term is about 1.3 us at 200 GB/s, so launch, protocol, and stage latency dominate, and a low-latency plan may beat a bandwidth-oriented one.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources are the NVIDIA NCCL overview, collective operations guide, environment variable reference, and NCCL debug documentation. Use logs to verify what the runtime selected instead of assuming the configured intent ran.', 'Study ring all-reduce, tree collectives, NVLink, NVSwitch, PCIe topology, GPUDirect RDMA, RDMA queue pairs, tensor parallelism, and framework bucketization next. The practical skill is turning a slow collective into a concrete selected plan.'] },
  ],
};