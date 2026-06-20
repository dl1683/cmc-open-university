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
  references: [
    { title: 'NVIDIA NCCL overview', url: 'https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/overview.html' },
    { title: 'NVIDIA NCCL collective operations', url: 'https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html' },
    { title: 'NVIDIA NCCL environment variables', url: 'https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/env.html' },
  ],
  sections: [
    {
      heading: 'Why this selector exists',
      paragraphs: [
        'A collective call has a simple surface contract. The program says all-reduce this tensor, broadcast this parameter shard, or gather these slices across these ranks. NCCL has to turn that contract into device work. It must decide which ranks talk first, which links they use, how a tensor is split, which protocol moves each slice, how many channels run in parallel, and whether the chosen path is legal on the current hardware.',
        'That decision matters because modern GPU nodes are not uniform boxes. Two ranks can be close through NVLink, farther through PCIe, or forced through a NIC and a switch. A collective can be a tiny latency-sensitive control message or a multi-gigabyte gradient bucket. The same API call can therefore require very different plans. The selector exists to make that plan depend on the communicator, topology, message size, collective type, software version, and runtime support instead of on a fixed rule copied from an older cluster.',
        {type:'callout', text:'NCCL performance comes from selecting a complete execution plan for the current topology, message size, collective, channels, protocol, and transport path.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/d/d3/Nvidia_GV100_GPU.png', alt:'Nvidia GV100 GPU die.', caption:'A GV100 GPU die, a reminder that collective plans depend on real accelerator topology and transport hardware. Source: Wikimedia Commons, Nvidia, Public domain'},
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        'The tempting shortcut is to force the setting that won one benchmark. A team sees Ring perform well for a large all-reduce and exports NCCL_ALGO=Ring everywhere. Another team sees LL help small messages and forces a protocol globally. A third team pins a network interface after one incident. These moves are understandable during a fire, but they turn a runtime selector into a superstition.',
        'The shortcut fails because the best plan is conditional. Ring often uses bandwidth well for large transfers, but it can pay extra latency and expose one slow rank. Tree can reduce some latency costs but may not saturate the same links. Low-latency protocols can help small payloads while losing efficiency on large ones. An environment variable can be useful as a scoped experiment, but cluster-wide forcing ignores bucket size, rank placement, NIC locality, fabric congestion, and whether newer hardware features are available.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'NCCL selection is not the question, Which algorithm is best? The better question is, Which complete execution plan is best for this collective on this topology right now? An algorithm name is only one field in the plan. The plan also includes channels, transport choices, protocol choices, kernel behavior, and fallback rules. Debugging has to recover the whole plan, not only the headline algorithm.',
        'The selector works because collective performance is structured. Message size changes the latency-bandwidth trade. Topology changes which paths are cheap. Rank order changes whether logical neighbors are physical neighbors. Channel count changes parallelism and overhead. Protocol choice changes how data is staged and synchronized. Once these inputs are explicit, performance becomes a traceable decision instead of a vague complaint that NCCL is slow.',
      ],
    },
    {
      heading: 'How the selector works',
      paragraphs: [
        'The first input is the communicator. It tells NCCL which ranks participate, which process owns each GPU, and how the ranks are ordered. The second input is topology discovery. NCCL builds a view of GPUs, PCIe paths, NVLink or NVSwitch connectivity, CPU sockets, NICs, and network reachability. The third input is the collective request: operation, datatype, count, tensor address, stream, and message size after any framework bucketization.',
        'Candidate algorithms are then evaluated against those inputs. A ring plan arranges ranks in a cycle and moves chunks around the cycle so every rank contributes and receives the final result. A tree plan uses parent-child structure to reduce or distribute data with fewer logical steps for some shapes. NVLink Switch or NVLS-style plans are only useful when the hardware and software path can support them. Network paths depend on which NICs are near which GPUs and whether the transport is available.',
        'After the algorithm choice, NCCL still has to slice work. Channels split one logical tensor into independent streams of work so multiple paths can make progress. Protocols define how each slice is moved. Simple generally favors bandwidth on larger transfers. LL and LL128-style protocols are designed for lower latency regimes and different staging behavior. The final launch is therefore a bundle of per-channel work, protocol state, transport state, and synchronization points.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The selector view is proving that the right side is derived, not guessed. Ranks, topology, byte count, and capability gates narrow the candidate plans. If the message is small, latency costs matter more. If the message is large, sustained bandwidth and channel balance matter more. If a fast local fabric is unavailable or a transport fails capability checks, the plan must fall back even when the marketing diagram suggests a faster path exists.',
        'The channels view is proving that one tensor can become many scheduled transfers. The bucket is logical; the channel slices are physical work. A slow channel, wrong NIC, or unsupported protocol can dominate the final time even when the chosen algorithm looks reasonable. The trace nodes are important because they separate intended configuration from observed behavior. The runtime-selected plan is the evidence that counts.',
      ],
    },
    {
      heading: 'Why the method works',
      paragraphs: [
        'The selector works by matching communication shape to bottleneck shape. A bandwidth-bound gradient bucket should try to keep links busy and avoid single-path saturation. A latency-bound control message should avoid unnecessary stages and kernel overhead. A topology with strong local GPU connectivity should preserve that locality. A cross-node job should avoid putting all large flows through one rail when multiple rails are available.',
        'It also works because the decision can be measured. NCCL debug logs, framework flight recorders, per-rail counters, and warmup collectives can show which algorithm and protocol were used, how many channels launched, and which transport path carried the data. That makes selector tuning reversible. A forced option should survive comparison against the automatic plan under the same topology, same bucket sizes, and same rank map.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Automatic selection is not free. Topology discovery, heuristic thresholds, compatibility checks, and channel construction add complexity. The heuristics can be wrong for a new workload or for a cluster with unusual oversubscription. A plan that is good for average throughput can be bad for p99. More channels can expose more parallelism, but they also add scheduling overhead and can increase contention. Smaller buckets can improve overlap with compute, but they can push more collectives into latency-sensitive regimes.',
        'Manual forcing has its own cost. It can hide the real issue, such as wrong rank placement, a socket fallback, a broken rail, or an unexpected protocol threshold. It can also make upgrades harder because the forced setting may disable a new path that the runtime would have selected. Treat NCCL_ALGO, NCCL_PROTO, interface selection, and topology overrides as experiments with owners, rollback, and proof, not as permanent tribal knowledge.',
      ],
    },
    {
      heading: 'Real uses and failure modes',
      paragraphs: [
        'The most common real use is training performance triage. A job moves to a new node type, a framework changes gradient bucket sizes, or a driver update changes device order. Step time rises. A good investigation records the rank map, visible GPU order, NCCL version, topology graph, bucket sizes, selected algorithms, selected protocols, channel count, transport, and p50 and p99 collective time. That record usually finds the problem faster than changing model code.',
        'The common failures are specific. One rank uses a slow path. A container exposes devices in an order that breaks intended locality. A network interface variable points traffic away from the nearest NIC. A collective crosses a selector threshold after batch size changes. Socket transport appears because the intended RDMA path failed. A single rail saturates while aggregate bandwidth still looks fine. A feature such as NVLS is expected but not actually available. The limit is that the selector can only optimize among legal paths it can see; it cannot fix bad placement, bad cabling, missing headroom, or fabric congestion by itself.',
      ],
    },
    {
      heading: 'What to study next',
      paragraphs: [
        'Study NCCL collectives, GPU all-reduce algorithms, rank placement, NVLink and NVSwitch topology, PCIe and NUMA locality, RDMA queue pairs, GPUDirect RDMA, RoCE congestion control, and framework bucketization. Then connect this topic to the GPU Collective Topology Placement Planner, RoCE PFC ECN DCQCN, Torch NCCL Flight Recorder, Tensor Parallelism, Pipeline Parallelism, and the LLM inference cost stack. The practical skill is to explain a slow collective as a concrete selected plan with evidence, not as a generic network complaint.',
      ],
    },
  ],
};
