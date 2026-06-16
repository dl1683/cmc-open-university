// Weka filesystem case study: AI storage as a low-latency, GPU-adjacent state
// layer rather than a passive archive behind compute.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'weka-filesystem-case-study',
  title: 'Weka Filesystem Case Study',
  category: 'Systems',
  summary: 'AI storage as an active memory tier: NVMe scale-out, RDMA, GPUDirect Storage, metadata distribution, and KV-cache economics.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['state hierarchy', 'gpu direct path'], defaultValue: 'state hierarchy' },
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

function storageGraph(title) {
  return graphState({
    nodes: [
      { id: 'request', label: 'LLM request', x: 0.6, y: 3.7, note: 'prompt + session' },
      { id: 'gpu', label: 'GPU HBM', x: 2.7, y: 2.0, note: 'fast, scarce, volatile' },
      { id: 'dram', label: 'CPU DRAM', x: 2.7, y: 5.5, note: 'larger, slower' },
      { id: 'weka', label: 'WekaFS/NeuralMesh', x: 5.5, y: 3.7, note: 'parallel NVMe tier' },
      { id: 'nvme0', label: 'NVMe node A', x: 8.2, y: 1.5, note: 'flash shard' },
      { id: 'nvme1', label: 'NVMe node B', x: 8.2, y: 3.7, note: 'flash shard' },
      { id: 'nvme2', label: 'NVMe node C', x: 8.2, y: 5.9, note: 'flash shard' },
    ],
    edges: [
      { id: 'e-request-gpu', from: 'request', to: 'gpu', weight: 'active KV cache' },
      { id: 'e-gpu-dram', from: 'gpu', to: 'dram', weight: 'spill/fallback' },
      { id: 'e-gpu-weka', from: 'gpu', to: 'weka', weight: 'GDS/RDMA path' },
      { id: 'e-dram-weka', from: 'dram', to: 'weka', weight: 'traditional path' },
      { id: 'e-weka-nvme0', from: 'weka', to: 'nvme0', weight: 'striped data' },
      { id: 'e-weka-nvme1', from: 'weka', to: 'nvme1', weight: 'metadata + data' },
      { id: 'e-weka-nvme2', from: 'weka', to: 'nvme2', weight: 'replica/parity' },
    ],
  }, { title });
}

function* stateHierarchy() {
  yield {
    state: labelMatrix(
      'AI state hierarchy',
      [
        { id: 'hbm', label: 'GPU HBM' },
        { id: 'dram', label: 'CPU DRAM' },
        { id: 'nvme', label: 'NVMe storage' },
        { id: 'object', label: 'object storage' },
      ],
      [
        { id: 'speed', label: 'speed' },
        { id: 'size', label: 'capacity' },
        { id: 'role', label: 'role' },
      ],
      [
        ['fastest', 'smallest', 'active model and KV cache'],
        ['medium', 'larger', 'host buffers and spill'],
        ['slower', 'much larger', 'persistent state tier'],
        ['slowest', 'largest', 'archive and datasets'],
      ],
    ),
    highlight: { active: ['hbm:role', 'nvme:role'], compare: ['object:role'] },
    explanation: 'Long-context and agentic inference turn state into an economic bottleneck. If KV cache falls out of HBM, the system either reloads state, spills it, or recomputes it from the prompt.',
  };

  yield {
    state: storageGraph('Weka turns storage into a GPU-adjacent tier'),
    highlight: { active: ['gpu', 'weka', 'nvme0', 'nvme1', 'nvme2'], found: ['e-gpu-weka'] },
    explanation: 'The case-study pattern is to make the NVMe tier feel closer to compute: distributed metadata, high-bandwidth networking, RDMA, and GPUDirect-style paths reduce the bureaucracy between GPU and storage.',
    invariant: 'The goal is not archival storage; it is keeping expensive GPUs fed with state and data.',
  };

  yield {
    state: labelMatrix(
      'What pressure Weka is trying to relieve',
      [
        { id: 'evict', label: 'KV eviction' },
        { id: 'pinning', label: 'session pinning' },
        { id: 'fragment', label: 'HBM fragmentation' },
        { id: 'reload', label: 'dataset reload' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'response', label: 'storage response' },
      ],
      [
        ['prefill recompute tax', 'persist state outside HBM'],
        ['one GPU owns a session', 'shared state pool'],
        ['stranded memory pockets', 'externalize inactive state'],
        ['GPU waits on input', 'parallel data path'],
      ],
    ),
    highlight: { found: ['evict:response', 'pinning:response'], active: ['fragment:symptom'] },
    explanation: 'The interesting systems idea is separating compute ownership from state ownership. If state lives in a shared low-latency tier, any GPU can resume more work.',
  };

  yield {
    state: labelMatrix(
      'Storage is now part of serving architecture',
      [
        { id: 'single', label: 'single-turn chat' },
        { id: 'rag', label: 'RAG' },
        { id: 'agent', label: 'agent trace' },
        { id: 'batch', label: 'batch training' },
      ],
      [
        { id: 'state', label: 'state shape' },
        { id: 'storage', label: 'storage pressure' },
      ],
      [
        ['short-lived context', 'moderate'],
        ['documents and citations', 'read throughput'],
        ['long tool history', 'KV persistence'],
        ['large datasets', 'sustained streaming'],
      ],
    ),
    highlight: { active: ['agent:state', 'agent:storage'], found: ['batch:storage'] },
    explanation: 'As AI workloads become stateful, storage moves from backstage archive to a live serving component. That changes how teams think about latency, placement, and cost.',
  };
}

function* gpuDirectPath() {
  yield {
    state: storageGraph('Traditional path copies through host memory'),
    highlight: { active: ['gpu', 'dram', 'weka', 'e-gpu-dram', 'e-dram-weka'], compare: ['e-gpu-weka'] },
    explanation: 'The conventional path stages data through CPU memory and kernel networking/storage layers. That can burn CPU, add copies, and leave the GPU waiting for bytes.',
  };

  yield {
    state: storageGraph('GPUDirect Storage shortens the path'),
    highlight: { found: ['gpu', 'weka', 'e-gpu-weka'], active: ['nvme0', 'nvme1', 'nvme2'] },
    explanation: 'GPUDirect Storage enables a direct path between storage devices and GPU memory. The point is lower latency, lower CPU overhead, and higher useful throughput for data-intensive GPU applications.',
  };

  yield {
    state: labelMatrix(
      'Mechanism map',
      [
        { id: 'nvme', label: 'NVMe flash' },
        { id: 'rdma', label: 'RDMA' },
        { id: 'metadata', label: 'metadata distribution' },
        { id: 'posix', label: 'POSIX interface' },
      ],
      [
        { id: 'contribution', label: 'contribution' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['parallel high-throughput media', 'tail latency and wear'],
        ['skip CPU-heavy transfers', 'network and NIC tuning'],
        ['avoid central bottleneck', 'consistency complexity'],
        ['easy app integration', 'semantics can constrain optimization'],
      ],
    ),
    highlight: { active: ['nvme:contribution', 'rdma:contribution'], found: ['metadata:contribution'] },
    explanation: 'The performance story is a stack, not one trick. Media, network, metadata, client path, and application semantics must all line up.',
  };

  yield {
    state: labelMatrix(
      'Questions before buying the story',
      [
        { id: 'workload', label: 'workload fit' },
        { id: 'tail', label: 'tail latency' },
        { id: 'failure', label: 'failure mode' },
        { id: 'economics', label: 'economics' },
      ],
      [
        { id: 'ask', label: 'ask' },
        { id: 'why', label: 'why it matters' },
      ],
      [
        ['is state reused often?', 'otherwise recompute tax is small'],
        ['what is p99 load time?', 'mean throughput can hide stalls'],
        ['what happens on node loss?', 'state tier must be reliable'],
        ['GPU dollars saved?', 'storage spend must beat compute waste'],
      ],
    ),
    highlight: { active: ['workload:ask', 'tail:ask'], compare: ['economics:why'] },
    explanation: 'The disciplined case-study question is not whether storage is fast. It is whether state reuse, latency, reliability, and GPU economics justify making storage part of the hot path.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'state hierarchy') yield* stateHierarchy();
  else if (view === 'gpu direct path') yield* gpuDirectPath();
  else throw new InputError('Pick a Weka filesystem view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Weka is a useful AI-infrastructure case study because it reframes storage as an active memory-adjacent layer. Traditional storage is where data rests after computation. Modern AI workloads, especially long-context inference and agentic systems, create large live state: prompts, retrieved documents, tool traces, intermediate artifacts, and KV cache. When GPU HBM fills, losing that state can force expensive recomputation.',
        'WEKA markets NeuralMesh and related products as accelerated infrastructure for AI, with emphasis on GPU-adjacent storage and memory expansion: https://www.weka.io/. Its GPUDirect Storage glossary explains the core mechanism: GDS enables a direct path between GPU memory and local or remote storage such as NVMe or NVMe over Fabrics, reducing latency and CPU overhead by bypassing traditional paths: https://www.weka.io/learn/glossary/gpu/what-is-gpudirect-storage/.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The architecture pattern is a hierarchy. GPU HBM is fastest and scarcest. CPU DRAM is larger but farther away. NVMe is much larger and persistent but slower. A Weka-style parallel filesystem tries to make the NVMe tier fast enough for AI data paths by spreading data over many flash nodes, distributing metadata, using high-speed networking, and supporting GPU-direct transfers where possible.',
        'The local Weka deep dive emphasized KV-cache economics: if a long context cache is evicted, the system may have to prefill the prompt again. That converts a memory miss into GPU seconds. The case-study lesson is not that storage becomes HBM. It is that a sufficiently fast shared state tier can reduce recompute, session pinning, and GPU idleness for workloads where state is reused. KV Cache Tiered Offload Store Case Study turns that storage-system idea into a model-server data structure: a lookup ladder, promotion path, and eviction ledger for GPU, CPU, SSD, and remote KV tiers.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The trade is storage dollars and architecture complexity against GPU dollars. A GPU is expensive and should not wait on data or redo prefill work unnecessarily. But adding a hot storage tier introduces its own tail latency, failure modes, network tuning, metadata consistency, security, and operational burden. A benchmark average is not enough; serving systems care about p95 and p99 load time because one slow state fetch can delay a user-visible token stream.',
        'The NVIDIA and Weka reference architecture describes WekaFS as a POSIX-compliant parallel filesystem using NVMe-based flash, object storage, and low-latency fabrics such as 200 GbE or InfiniBand, with performance scaling as servers are added: https://network.nvidia.com/files/doc-2020/weka-ai-ra.pdf. That is a storage-system claim to validate workload by workload, not a guarantee that every inference service improves automatically.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Good fits include large training datasets, checkpoint loading, multimodal pipelines, RAG corpora, long-running agents with reusable state, and inference systems that can externalize inactive KV cache. The shared theme is repeated GPU access to data or state that is too large for local HBM. If the workload is single-turn and stateless, the value is smaller. If the workload is multi-turn, tool-heavy, and context-rich, the state tier becomes much more important.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The first misconception is that storage can simply replace memory. It cannot. HBM is still the active compute tier. The realistic goal is to reduce expensive recomputation and keep GPUs fed, not to make NVMe behave exactly like on-package memory. The second misconception is that throughput alone proves the design. A serving system needs predictable latency, reliable failover, and clean integration with schedulers, cache managers, and model servers.',
        'A third pitfall is hidden coupling. If a model server assumes session state is local to one GPU, adding shared storage will not automatically make the system elastic. The scheduler, cache layout, eviction policy, and request router must also understand where state lives.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary and official sources: WEKA homepage at https://www.weka.io/, WEKA GPUDirect Storage glossary at https://www.weka.io/learn/glossary/gpu/what-is-gpudirect-storage/, and NVIDIA/Weka AI reference architecture at https://network.nvidia.com/files/doc-2020/weka-ai-ra.pdf. Study KV Cache, LLM Serving: PagedAttention, Transformer Inference Roofline, Prefix Caching & RadixAttention, KV Cache Tiered Offload Store Case Study, S3 Object Storage Case Study, and Chiplet Interconnect Case Study next.',
      ],
    },
  ],
};
