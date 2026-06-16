// GPUDirect RDMA: peer memory registration and PCIe/NIC paths that let remote
// adapters read and write GPU memory without staging through host DRAM.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'gpudirect-rdma-peer-memory-case-study',
  title: 'GPUDirect RDMA Peer Memory Case Study',
  category: 'Systems',
  summary: 'A zero-copy GPU networking case study: peer memory, BAR mappings, nvidia-peermem, NIC DMA, root-complex constraints, synchronization, and bounce-buffer fallback.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['zero copy path', 'safety gates'], defaultValue: 'zero copy path' },
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

function peerGraph(title, { fallback = false } = {}) {
  return graphState({
    nodes: [
      { id: 'app', label: 'app', x: 0.7, y: 3.6, note: 'verbs' },
      { id: 'cuda', label: 'CUDA', x: 2.0, y: 2.0, note: 'alloc' },
      { id: 'gpu', label: 'GPU', x: 3.8, y: 2.0, note: 'HBM' },
      { id: 'bar', label: 'BAR', x: 5.2, y: 2.0, note: 'window' },
      { id: 'peer', label: 'peer', x: 5.2, y: 4.9, note: 'module' },
      { id: 'hca', label: 'HCA', x: 7.0, y: 3.4, note: 'NIC' },
      { id: 'net', label: 'net', x: 8.6, y: 3.4, note: 'RDMA' },
      { id: 'host', label: 'DRAM', x: 3.8, y: 5.8, note: fallback ? 'bounce' : 'skip' },
      { id: 'cq', label: 'CQ', x: 7.0, y: 5.8, note: 'done' },
    ],
    edges: [
      { id: 'e-app-cuda', from: 'app', to: 'cuda', weight: 'alloc' },
      { id: 'e-cuda-gpu', from: 'cuda', to: 'gpu', weight: 'ptr' },
      { id: 'e-gpu-bar', from: 'gpu', to: 'bar', weight: 'map' },
      { id: 'e-bar-peer', from: 'bar', to: 'peer', weight: '' },
      { id: 'e-peer-hca', from: 'peer', to: 'hca', weight: 'pin' },
      { id: 'e-hca-net', from: 'hca', to: 'net', weight: 'pkt' },
      { id: 'e-hca-cq', from: 'hca', to: 'cq', weight: 'CQE' },
      { id: 'e-gpu-host', from: 'gpu', to: 'host', weight: fallback ? 'copy' : 'no' },
      { id: 'e-host-hca', from: 'host', to: 'hca', weight: fallback ? 'DMA' : 'skip' },
    ],
  }, { title });
}

function gateGraph(title) {
  return graphState({
    nodes: [
      { id: 'root', label: 'root', x: 1.0, y: 2.0, note: 'PCIe' },
      { id: 'gpu', label: 'GPU', x: 2.8, y: 1.3, note: 'peer' },
      { id: 'hca', label: 'HCA', x: 2.8, y: 3.0, note: 'peer' },
      { id: 'iommu', label: 'IOMMU', x: 4.7, y: 2.0, note: 'map' },
      { id: 'acs', label: 'ACS', x: 4.7, y: 4.2, note: 'route' },
      { id: 'life', label: 'life', x: 6.5, y: 2.0, note: 'ptr' },
      { id: 'sync', label: 'sync', x: 6.5, y: 4.2, note: 'stream' },
      { id: 'fall', label: 'fall', x: 8.3, y: 3.1, note: 'copy' },
    ],
    edges: [
      { id: 'e-root-gpu', from: 'root', to: 'gpu', weight: '' },
      { id: 'e-root-hca', from: 'root', to: 'hca', weight: '' },
      { id: 'e-gpu-iommu', from: 'gpu', to: 'iommu', weight: 'addr' },
      { id: 'e-hca-iommu', from: 'hca', to: 'iommu', weight: 'DMA' },
      { id: 'e-hca-acs', from: 'hca', to: 'acs', weight: '' },
      { id: 'e-iommu-life', from: 'iommu', to: 'life', weight: '' },
      { id: 'e-acs-fall', from: 'acs', to: 'fall', weight: 'block' },
      { id: 'e-sync-fall', from: 'sync', to: 'fall', weight: 'bad' },
      { id: 'e-life-sync', from: 'life', to: 'sync', weight: '' },
    ],
  }, { title });
}

function* zeroCopyPath() {
  yield {
    state: peerGraph('Without peer access, GPU traffic bounces through DRAM', { fallback: true }),
    highlight: { active: ['gpu', 'host', 'hca', 'e-gpu-host', 'e-host-hca'], compare: ['bar', 'peer'] },
    explanation: 'The ordinary fallback path copies GPU data through host memory before the network adapter sends it. That burns PCIe bandwidth, CPU orchestration, cache pollution, and extra latency.',
  };

  yield {
    state: peerGraph('GPUDirect maps GPU memory as peer memory'),
    highlight: { active: ['gpu', 'bar', 'peer', 'e-gpu-bar', 'e-bar-peer', 'e-peer-hca'], found: ['cuda'], compare: ['host'] },
    explanation: 'GPUDirect RDMA lets a third-party PCIe device access GPU memory through peer mappings. The peer-memory layer gives the HCA a legal way to reach the GPU buffer.',
    invariant: 'Zero-copy is still controlled copy: memory must be mapped, pinned, keyed, and synchronized.',
  };

  yield {
    state: peerGraph('The HCA performs RDMA directly to GPU memory'),
    highlight: { active: ['hca', 'net', 'gpu', 'e-peer-hca', 'e-hca-net'], found: ['cq'], removed: ['host'] },
    explanation: 'Once the mapping and work request are valid, the network adapter can read or write GPU memory directly and then report completion. The CPU is out of the hot data movement path.',
  };

  yield {
    state: labelMatrix(
      'Path comparison',
      [
        { id: 'copy', label: 'copy' },
        { id: 'cpu', label: 'CPU' },
        { id: 'pcie', label: 'PCIe' },
        { id: 'lat', label: 'lat' },
        { id: 'risk', label: 'risk' },
      ],
      [
        { id: 'bounce', label: 'bounce' },
        { id: 'peer', label: 'peer' },
      ],
      [
        ['2x', '0/1x'],
        ['busy', 'setup'],
        ['extra', 'direct'],
        ['higher', 'lower'],
        ['simple', 'strict'],
      ],
    ),
    highlight: { found: ['copy:peer', 'cpu:peer', 'pcie:peer', 'lat:peer'], compare: ['risk:peer'] },
    explanation: 'The win is fewer copies and less CPU work on the hot path. The cost is stricter platform, driver, memory-lifetime, and synchronization requirements.',
  };
}

function* safetyGates() {
  yield {
    state: gateGraph('Platform topology can allow or block peer DMA'),
    highlight: { active: ['root', 'gpu', 'hca', 'e-root-gpu', 'e-root-hca'], compare: ['acs', 'fall'] },
    explanation: 'NVIDIA documents a key constraint: peer devices often need to share the same upstream PCIe root complex. Platform routing, ACS, IOMMU behavior, and firmware can decide whether the peer path is usable.',
  };

  yield {
    state: gateGraph('Address translation and lifetime are correctness gates'),
    highlight: { active: ['iommu', 'life', 'sync', 'e-iommu-life', 'e-life-sync'], found: ['gpu', 'hca'], compare: ['fall'] },
    explanation: 'The registered GPU pointer must remain alive until all outstanding work completes. CUDA stream ordering, RDMA completion, and application ownership must agree on when a buffer can be reused.',
    invariant: 'A completion queue entry is not a license to ignore GPU stream ordering.',
  };

  yield {
    state: labelMatrix(
      'GPUDirect gate checks',
      [
        { id: 'root', label: 'root' },
        { id: 'drv', label: 'drv' },
        { id: 'map', label: 'map' },
        { id: 'perm', label: 'perm' },
        { id: 'sync', label: 'sync' },
        { id: 'fall', label: 'fall' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'ifbad', label: 'if bad' },
      ],
      [
        ['same', 'copy'],
        ['peer', 'copy'],
        ['BAR', 'fail'],
        ['key', 'deny'],
        ['stream', 'race'],
        ['log', 'hide'],
      ],
    ),
    highlight: { active: ['root:check', 'drv:check', 'map:check', 'sync:check'], found: ['fall:check'], compare: ['sync:ifbad'] },
    explanation: 'The production checklist is a gate matrix: topology, driver support, BAR mapping, permissions, synchronization, and explicit fallback. Silent fallback is dangerous because it hides both cost and latency changes.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'GB', min: 0, max: 12 }, y: { label: 'ms', min: 0, max: 70 } },
      series: [
        { id: 'peer', label: 'peer', points: [{ x: 1, y: 6 }, { x: 4, y: 14 }, { x: 8, y: 27 }, { x: 12, y: 41 }] },
        { id: 'bounce', label: 'bounce', points: [{ x: 1, y: 10 }, { x: 4, y: 28 }, { x: 8, y: 52 }, { x: 12, y: 68 }] },
        { id: 'bad', label: 'fallback', points: [{ x: 1, y: 12 }, { x: 4, y: 34 }, { x: 8, y: 62 }, { x: 12, y: 70 }] },
      ],
      markers: [
        { id: 'slo', x: 8, y: 45, label: 'SLO' },
      ],
    }),
    highlight: { active: ['peer', 'slo'], compare: ['bounce', 'bad'] },
    explanation: 'The curve is illustrative, but the operational rule is real: record whether traffic used peer access or a bounce buffer, because fallback can erase the latency budget for GPU-to-GPU pipelines.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'zero copy path') yield* zeroCopyPath();
  else if (view === 'safety gates') yield* safetyGates();
  else throw new InputError('Pick a GPUDirect RDMA view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'GPUDirect RDMA is NVIDIA technology for letting third-party PCIe devices, especially network adapters, exchange data directly with GPU memory. It is the GPU-specialized version of the broader RDMA idea: avoid staging through host DRAM when the useful endpoint is GPU HBM.',
        'NVIDIA describes GPUDirect RDMA as enabling a direct path for data exchange between the GPU and third-party peer devices such as network interfaces, video acquisition devices, and storage adapters: https://docs.nvidia.com/cuda/gpudirect-rdma/. The developer overview frames remote direct memory access as direct access to GPU memory that avoids required buffer copies through system memory: https://developer.nvidia.com/gpudirect.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The application allocates GPU memory and registers or exposes it through peer-memory machinery. The GPU memory is represented through PCIe-visible address windows, and the HCA receives enough mapping information to DMA to or from that memory. The work request still flows through RDMA verbs; the difference is that the registered target can be GPU memory rather than ordinary host memory.',
        'NVIDIA documents that GPUDirect RDMA uses standard PCI Express features and that peer devices issue reads and writes to peer BAR addresses similarly to system memory. It also notes a major platform constraint: the peer devices generally need to share the same upstream PCIe root complex, and limitations depend on the platform.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The performance reason is straightforward. A host bounce path moves data GPU-to-host and then host-to-NIC, or the reverse. That adds copies, PCIe traffic, CPU coordination, and latency. A peer path removes the bounce buffer. In distributed AI systems, that can matter for activations, gradients, checkpoints, storage reads, video ingest, or KV-cache movement.',
        'The complexity is that the platform must actually support the peer path. Root complex layout, IOMMU and ACS behavior, driver modules, memory registration, BAR sizing, permissions, CUDA stream synchronization, and completion semantics all matter. A system that silently falls back to host copies can look correct in a functional test while failing a latency or cost target.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'GPUDirect RDMA appears in GPU clusters, high-performance storage, media pipelines, distributed training, and inference systems that need to move GPU-resident state. It pairs naturally with RDMA Queue Pair & Work Request Case Study because the network side still uses queue pairs, work requests, keys, and completion queues.',
        'It also connects to Weka Filesystem Case Study and KV Cache Transfer Fabric Case Study. Both care about making storage or network state feel closer to GPU execution by avoiding host-mediated copies where possible.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The biggest misconception is that GPUDirect is a magic fast path that always turns on. It is conditional. Platform topology, kernel modules, device support, and driver behavior decide whether the path is legal. The application needs telemetry that distinguishes peer DMA from fallback copies.',
        'Another trap is treating RDMA completion and CUDA completion as the same thing. Network completions and GPU stream dependencies must be coordinated. Reusing a GPU buffer too early can corrupt data even when the network operation looked complete from the HCA side.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: NVIDIA GPUDirect RDMA documentation at https://docs.nvidia.com/cuda/gpudirect-rdma/ and NVIDIA GPUDirect overview at https://developer.nvidia.com/gpudirect. Study RDMA Queue Pair & Work Request Case Study, GPU Memory Pool Fragmentation Ledger, KV Cache Transfer Fabric Case Study, Weka Filesystem Case Study, NVLink/NVSwitch GPU Fabric Case Study, and Backpressure & Flow Control next.',
      ],
    },
  ],
};
