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
    explanation: 'NCCL is topology-aware. A collective call carries rank group, buffer size, datatype, reduction op, CUDA stream, and discovered paths across PCIe, NVLink, InfiniBand, RoCE, or sockets.',
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
    explanation: 'A large bucket can be divided into channels so links stay busy. Channels are the data-structure bridge between a logical tensor and multiple physical transfers.',
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
  references: [
    { title: 'NVIDIA NCCL overview', url: 'https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/overview.html' },
    { title: 'NVIDIA NCCL collective operations', url: 'https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html' },
    { title: 'NVIDIA NCCL environment variables', url: 'https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/env.html' },
  ],
  sections: [
    { heading: 'What it is', paragraphs: ['NCCL is a library for topology-aware inter-GPU communication. For this repo, the key idea is that a collective call becomes a plan: choose paths, channels, algorithm, protocol, launch behavior, and logging evidence.', 'The basic GPU All-Reduce module teaches the collective contract. This case study teaches the selector around that contract: Ring versus Tree versus NVLS-style paths, LL versus LL128 versus Simple protocols, and trace fields that explain the choice.'] },
    { heading: 'Data structures', paragraphs: ['The useful records are communicator ranks, rank-to-device mapping, discovered topology graph, message size, collective type, algorithm, protocol, channel slices, transport path, debug subsystem, and performance counters.', 'NCCL documentation exposes collective operations such as AllReduce, AllGather, ReduceScatter, and AlltoAll. It also documents algorithm and protocol controls through environment variables such as NCCL_ALGO and NCCL_PROTO.'] },
    { heading: 'How it works', paragraphs: ['Small or latency-sensitive messages may favor a different path than large bandwidth-bound buckets. Topology matters because PCIe, NVLink, InfiniBand, RoCE, and sockets have different costs. The selector combines those facts into one execution plan.', 'Channels split a tensor into slices so transfers can run in parallel. Debug traces and subsystem filters then show what the runtime actually did, which matters more than what a configuration file was supposed to request.'] },
    { heading: 'Complete case study', paragraphs: ['A training job slows after moving from one node shape to another. The team captures NCCL debug logs with COLL, NET, GRAPH, and TUNING enabled, compares selected algorithms and protocols across ranks, and discovers that large buckets crossed a slower transport path.', 'The fix is not blindly forcing Ring or Simple forever. The team records the topology, benchmarks candidate settings, gates the change behind job shape, and keeps rollback telemetry in case a different model or cluster version behaves differently.'] },
    { heading: 'Pitfalls', paragraphs: ['Do not copy NCCL environment settings between clusters without evidence. A protocol or algorithm that helps one topology can harm another. The NCCL documentation explicitly warns against forcing protocol settings except for narrow debugging cases.', 'Another trap is reading only average throughput. Collective performance can fail through tail latency, one bad rank, a mismatched rank-to-device map, or a transport fallback hidden in logs.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: NCCL overview at https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/overview.html, collective operations at https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html, and environment variables at https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/env.html. Study GPU All-Reduce, NVLink/NVSwitch GPU Fabric, RDMA Queue Pair, GPUDirect RDMA, and Tensor Parallelism next.'] },
  ],
};
