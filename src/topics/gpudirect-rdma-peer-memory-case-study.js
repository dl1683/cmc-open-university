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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the two paths as physical movement of bytes. The bounce path copies data through host DRAM, while the peer path lets an RDMA-capable device read from or write to registered GPU memory directly.',
        'The safe inference is conditional, not automatic. GPUDirect RDMA is valid only when topology, drivers, memory registration, permissions, and synchronization all make the peer path legal.',
        {type:'callout', text:'GPUDirect RDMA is fast because the transfer path becomes a controlled peer-memory contract instead of a host-staged copy sequence.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/a/ab/Infinibandport.jpg', alt:'Close-up of six InfiniBand ports on a switch module.', caption:'InfiniBand ports on a Voltaire ISR-6000 switch, Wikimedia Commons, CC BY 2.5 / GFDL / CC BY-SA 3.0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Modern GPU systems often need network or storage data to land in GPU memory, also called HBM, where kernels will consume it. Distributed training, inference serving, checkpoint loading, media pipelines, and scientific instruments all move large buffers between devices.',
        'GPUDirect RDMA exists to avoid extra host staging copies when a capable NIC or HCA can perform DMA against GPU memory. DMA means direct memory access: a device moves bytes without the CPU copying each byte in a loop.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious safe path is a bounce buffer in host memory. Copy GPU data to host DRAM, let the network adapter send or receive from that host buffer, then copy again into GPU memory on the other side if needed.',
        'That path is portable and easier to debug. It becomes expensive when large transfers or tight pipelines spend more time staging bytes than computing on them.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that the CPU and host memory become a tax on data that neither endpoint wants to compute on. Extra PCIe traffic, cache pollution, scheduling overhead, and latency can erase the benefit of fast GPUs and fast NICs.',
        'A second wall is silent fallback. A job can converge, an inference service can answer, and a benchmark can pass while the transfer path quietly uses host bounce buffers and misses the target throughput.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A GPU allocation can be treated as peer memory for another PCIe device when the platform exposes a legal mapping. The NIC does not understand tensors; it understands registered memory, addresses, keys, queue pairs, and completion queues.',
        'The real data structure is a handoff contract. It binds a GPU buffer, peer-memory mapping, RDMA work request, lifetime rule, and synchronization point so two execution domains can share the same bytes safely.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The application allocates GPU memory and passes the pointer to an RDMA-aware layer. A peer-memory module cooperates with the GPU driver so the HCA can register the memory and obtain a DMA-visible mapping.',
        'The application posts RDMA work to a queue pair. The HCA reads from or writes to the registered GPU region, then reports progress through a completion queue.',
        'CUDA streams and RDMA completions must be coordinated. A network completion does not automatically mean a later GPU kernel can read the buffer unless the program establishes the right ordering.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The performance argument is simple: removing a copy removes work. If a 1 GB buffer would otherwise move GPU to host and host to NIC, the peer path avoids one full 1 GB staging movement plus the CPU coordination around it.',
        'Correctness comes from registration and ordering. The HCA may touch only registered memory with valid access rights, and the application may reuse or free that memory only after both the GPU and network domains have completed the relevant work.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is deployment strictness. Compatible GPUs, NICs, drivers, firmware, kernel modules, PCIe routing, IOMMU behavior, BAR mappings, and permissions can all decide whether the peer path is available.',
        'Memory registration also has a cost. Registered regions consume resources and carry lifetime rules, so high-performance systems usually use buffer pools instead of registering and deregistering on every small transfer.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'GPUDirect RDMA is used in distributed training, GPU-aware MPI, multi-node inference, storage-to-GPU pipelines, video ingestion, scientific instruments, and databases or analytics engines that process data on accelerators. It matters when large buffers move often enough that host staging becomes visible.',
        'In LLM serving, the same idea appears when GPU-resident KV cache blocks, activations, or embeddings need to move between hosts. The transfer path has to be fast, but it also has to be observable so fallback does not masquerade as success.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the platform cannot legally route peer DMA. Different PCIe roots, ACS settings, IOMMU configuration, missing peer-memory modules, or driver mismatches can force fallback or registration failure.',
        'It also fails when synchronization is wrong. Reusing a receive buffer before the GPU has consumed it, or freeing a send buffer before the HCA is done, can corrupt data even though the peer path is configured correctly.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose one worker sends a 256 MB activation buffer to another host every training step. With a host bounce path, the sender copies 256 MB from GPU to host and the NIC reads 256 MB from host, so the sender side handles 512 MB of movement before protocol overhead.',
        'With GPUDirect RDMA, the NIC reads the 256 MB directly from registered GPU memory. If host staging bandwidth is 25 GB/s, the avoided 256 MB copy is about 10 ms of copy time before CPU scheduling and cache effects.',
        'At 100 steps per minute, that avoided copy is roughly 1 second per minute on the sender side for this one buffer. The exact number depends on hardware, but the behavior is stable: repeated large staging copies become a visible tax.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary references are NVIDIA GPUDirect RDMA documentation at https://docs.nvidia.com/cuda/gpudirect-rdma/ and NVIDIA GPUDirect overview material at https://developer.nvidia.com/gpudirect. Use vendor and cluster documentation for current driver, NIC, and topology requirements.',
        'Study RDMA queue pairs, work requests, memory registration, completion queues, GPU memory pools, NVLink, NVSwitch, PCIe topology, NUMA locality, zero-copy buffers, and backpressure next. The durable idea is that zero-copy performance is a verified contract, not a slogan.',
      ],
    },
  ],
};
