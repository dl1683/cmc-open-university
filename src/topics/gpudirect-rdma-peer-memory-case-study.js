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
      heading: 'Why GPUDirect RDMA Exists',
      paragraphs: [
        `GPUDirect RDMA exists because modern GPU systems often need data to arrive in GPU memory, not merely on the host. In distributed training, gradients and activations live in HBM. In inference, KV-cache blocks, embeddings, logits, and intermediate tensors may be GPU-resident. In storage and media pipelines, the producer or consumer can be a GPU kernel. If every transfer has to stop in host DRAM, the system pays extra PCIe traffic, CPU scheduling, cache pollution, and latency before the GPU can do useful work.`,
        `The ordinary safe path is a bounce buffer: copy GPU data to host memory, let the network adapter or storage device DMA from that host buffer, then copy again on the receiving side if the destination is also a GPU. That path is simple and widely compatible, but it turns the CPU and host memory hierarchy into a staging area for data that neither side actually wants to compute on.`,
        `GPUDirect RDMA is the peer-memory path that lets a capable third-party PCIe device, commonly an RDMA-capable NIC or HCA, read from or write to GPU memory directly. It does not mean uncontrolled access. The memory must be allocated, mapped, registered, permissioned, and synchronized. The point is to remove unnecessary host copies from the hot path while keeping the transfer inside explicit driver and verbs machinery.`,
        {type:`callout`, text:`GPUDirect RDMA is fast because the transfer path becomes a controlled peer-memory contract instead of a host-staged copy sequence.`},
        {type:`image`, src:`https://upload.wikimedia.org/wikipedia/commons/a/ab/Infinibandport.jpg`, alt:`Close-up of six InfiniBand ports on a switch module.`, caption:`InfiniBand ports on a Voltaire ISR-6000 switch, Wikimedia Commons, CC BY 2.5 / GFDL / CC BY-SA 3.0.`},
      ],
    },
    {
      heading: 'The Naive Wall',
      paragraphs: [
        `The naive implementation copies through host memory and then optimizes around that. For small transfers or rare events, this may be acceptable. For sustained GPU-to-GPU communication, it becomes a wall. The bytes cross PCIe more times than necessary, CPU threads manage staging buffers, and the measured latency includes operations that exist only because the devices were not allowed to talk as peers.`,
        `A second naive assumption is that installing CUDA, an RDMA stack, and a modern NIC automatically enables the peer path. That is dangerous because the fallback path can still produce correct output. A benchmark may pass, a training job may converge, and an inference pipeline may return answers, while the data movement silently bounces through host DRAM and misses the latency or throughput target.`,
        `The real wall is platform legality. PCIe topology, upstream root complexes, Access Control Services, IOMMU behavior, BAR address windows, kernel modules such as nvidia-peermem, driver versions, permissions, and synchronization rules decide whether the HCA can DMA into a GPU allocation. GPUDirect RDMA is a hardware-software contract, not a flag that always works.`,
      ],
    },
    {
      heading: 'Core Insight',
      paragraphs: [
        `The core insight is that a GPU allocation can become peer memory for another PCIe device when the platform exposes a legal mapping. The NIC does not understand CUDA tensors as high-level objects. It receives registered memory, address translation, access keys, and work requests. The CUDA and peer-memory layers make GPU memory visible enough for DMA while preserving ownership and lifetime rules.`,
        `From the application point of view, the path still resembles RDMA verbs. A buffer is registered, a queue pair posts work, the HCA performs a read or write, and a completion queue reports progress. The difference is the physical target. Instead of host DRAM, the registered region points at GPU memory through the peer mapping. This is why the technology is often described as zero-copy, but a better phrase is controlled direct copy: the data still moves, but it avoids an unnecessary host staging copy.`,
        `The deepest correctness rule is that two execution domains now share a buffer. The network domain has completion queues and ordering rules. The GPU domain has CUDA streams, kernels, and memory visibility rules. A completion in one domain is not automatically permission to reuse memory in the other. Correct systems treat lifetime and synchronization as part of the data structure.`,
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        `A typical send path starts with a CUDA allocation. The application or framework obtains a GPU pointer and passes it into an RDMA-aware layer. The peer-memory module cooperates with the NVIDIA driver so that the HCA can register the GPU pages or their PCIe-visible address window. The HCA receives the information needed to DMA from that memory, and the application posts a work request through the verbs interface.`,
        `For receives, the direction reverses: the HCA writes incoming data directly into a registered GPU buffer. A completion queue entry tells the application that the network work reached a defined point, but the program must still coordinate with CUDA stream work that produces or consumes the buffer. In practice, high-performance libraries hide much of this sequencing, but the underlying rule remains: do not free, reuse, or read a buffer until both the network and GPU sides have reached the correct ordering point.`,
        `The platform gates are not optional details. Peer devices may need to share an upstream PCIe root complex for efficient peer-to-peer routing. ACS settings can force traffic upstream and block direct peer behavior. IOMMU configuration can affect address translation. BAR size and mapping limits can constrain what is visible. Driver mismatches can disable registration. A robust system detects these gates and exposes whether it used peer DMA or fell back to a bounce buffer.`,
      ],
    },
    {
      heading: 'What The Visual Proves',
      paragraphs: [
        `The zero-copy path visual compares two physical routes. In the bounce route, data leaves GPU memory, lands in host DRAM, then the HCA performs DMA to or from that host buffer. In the peer route, the GPU memory is mapped through a peer-memory layer and the HCA transfers directly. The visual proves the performance claim at the structural level: fewer copies, fewer CPU-managed staging steps, and fewer trips through host memory.`,
        `The safety-gates visual proves the opposite half of the lesson. Direct access is conditional. Root complex topology, IOMMU mapping, ACS routing, pointer lifetime, stream ordering, and fallback behavior sit on the critical path. The peer path is faster only when those gates are satisfied and observable. A system that silently falls back may be correct at the API level and wrong at the SLO level.`,
        `The latency plot is illustrative rather than a universal benchmark. Its role is to show why fallback telemetry matters. At small sizes, bounce overhead may hide in noise. At larger transfers or tight pipelines, the extra copy can erase the budget. Production systems should record the path actually used, not merely that an RDMA operation completed.`,
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        `It works because data movement is often the limiting resource in GPU systems. A GPU can compute quickly once data is in HBM, and an RDMA NIC can move data without CPU copying once memory is registered. GPUDirect RDMA aligns those facts: the NIC moves bytes directly to or from the memory where GPU kernels operate. Removing the host staging copy reduces latency, frees CPU cycles, and lowers pressure on PCIe and host memory bandwidth.`,
        `It is especially valuable when communication and computation are pipelined. Distributed training overlaps gradient exchange with backpropagation. Inference systems may move KV-cache blocks, embeddings, or activations between GPUs and machines. Storage systems may load checkpoint shards or datasets into GPU memory. Media systems may stream frames into GPU processing kernels. In each case, the avoided copy is not a micro-optimization; it can decide whether the pipeline stays full.`,
      ],
    },
    {
      heading: 'Costs And Tradeoffs',
      paragraphs: [
        `The cost is stricter deployment. The host-bounce path works on more machines and is easier to reason about. GPUDirect RDMA requires compatible GPUs, NICs, drivers, kernel modules, PCIe routing, firmware settings, and memory registration behavior. It can also make debugging harder because a failure may appear as a registration error, a topology limitation, a permission problem, a synchronization bug, or a silent performance regression.`,
        `The second tradeoff is memory management. Registered memory is not just an ordinary pointer. It has lifetime, pinning, access rights, and ordering constraints. Holding too many registered regions can pressure resources. Reusing a GPU allocation too early can corrupt data. Freeing memory before outstanding work completes can produce undefined behavior. High-level frameworks must turn these low-level rules into safe buffer pools and explicit handoff protocols.`,
        `The third tradeoff is observability. Because fallback can be functionally correct, correctness tests are not enough. A production path needs counters for peer registrations, failed registrations, bytes sent through peer DMA, bytes sent through bounce buffers, latency by path, and topology warnings. Without those signals, the system can lose the entire reason for using GPUDirect RDMA while still returning correct answers.`,
      ],
    },
    {
      heading: 'Uses And Failure Modes',
      paragraphs: [
        `Common uses include distributed GPU training, multi-node inference, GPU-aware MPI, high-performance storage, video acquisition, scientific instruments, database acceleration, and any pipeline where network or storage devices exchange large buffers with GPU kernels. In LLM serving, the same concept appears when GPU-resident KV-cache blocks or activations need to move across hosts without paying extra copies through CPU memory.`,
        `Failure modes cluster around hidden fallback, bad topology, and bad synchronization. Hidden fallback passes functional tests but misses throughput. Bad topology means the HCA and GPU cannot use the desired peer route. Bad synchronization means one side believes a buffer is ready while the other side is still producing or consuming it. Security and isolation also matter: direct memory access must be permissioned carefully because the whole point is to let a device bypass normal CPU load and store paths.`,
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        `Study RDMA Queue Pair and Work Request Case Study first to understand verbs, queue pairs, memory registration, and completions. Then connect this topic to GPU Memory Pool Fragmentation Ledger, NVLink/NVSwitch GPU Fabric Case Study, KV Cache Transfer Fabric Case Study, Weka Filesystem Case Study, Backpressure and Flow Control, and Zero-Copy Buffer Management. Primary references are NVIDIA GPUDirect RDMA documentation and NVIDIA's GPUDirect overview. The durable lesson is that zero-copy performance is a contract among hardware topology, memory registration, synchronization, and observability.`,
      ],
    },
  ],
};
