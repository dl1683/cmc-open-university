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
      heading: 'Why this exists',
      paragraphs: [
        'Weka is a useful AI-infrastructure case study because it changes the role of storage. In older mental models, storage is where datasets and checkpoints rest before or after computation. In modern AI systems, storage can sit on the hot path: training jobs stream massive samples, inference systems reload state, RAG systems scan corpora, and agent systems accumulate long-lived artifacts.',
        'The economic pressure is simple. GPUs are expensive, and idle GPUs waste money quickly. If a model server evicts reusable state and has to recompute it, the miss is not just a storage miss; it can become seconds of GPU prefill. If a training job cannot stream data fast enough, accelerators wait for bytes. Storage design becomes part of compute efficiency.',
        'This does not mean storage becomes GPU memory. HBM is still the active compute tier. The educational point is subtler: a fast, shared, reliable state tier can reduce recomputation, improve placement flexibility, and keep expensive compute fed when the workload reuses state often enough.',
        {type: 'callout', text: 'AI storage becomes architecture when reusable state is expensive enough that fetching it beats making GPUs recompute it.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to keep datasets in object storage, stage them to local disks, and let every job manage its own cache. That can be fine for simple batch jobs. It breaks down when many GPU workers need high sustained throughput, fast checkpoint restore, or shared access to mutable state.',
        'Another shortcut is to scale compute first and assume storage will follow. That hides the bottleneck until GPUs sit idle, checkpoint recovery takes too long, or tail latency spikes when a serving request needs cold state. More accelerators do not fix a state path that cannot feed them.',
        'A third mistake is treating average throughput as the whole storage story. AI serving cares about p95 and p99 load time because one slow state fetch can delay a user-visible token stream. Training cares about sustained throughput and coordinated recovery. Both care about what happens when a node, network path, or metadata service fails.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is hierarchy with explicit economics. GPU HBM is fastest and scarcest. CPU DRAM is larger but farther away. NVMe flash is much larger and persistent but slower. Object or cloud storage is cheaper and deeper but usually too slow for tight loops. A Weka-style filesystem tries to make the NVMe and network tier fast enough to be useful near the GPU.',
        'The mechanism is not one magic feature. It is a stack: parallel NVMe flash, distributed metadata, high-speed networking, a POSIX-facing interface for application compatibility, and GPU-direct paths where the platform supports them. Each layer removes a different bottleneck.',
        'The design question is always workload fit. If state is rarely reused, the storage tier adds cost without saving much compute. If state is reused often, checkpointed frequently, or shared across GPU workers, the storage tier can pay for itself by reducing GPU wait and recompute.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A client sees a filesystem interface. Behind that interface, the system maps file and block requests onto metadata decisions, data placement, flash devices, network paths, and durability rules. Parallelism comes from spreading data and requests across many devices and nodes rather than funneling everything through one storage head.',
        'GPUDirect Storage is the important path in the visual. In a traditional path, data often moves through CPU memory and kernel layers before reaching the GPU. With a GPU-direct path, supported devices can move data closer to GPU memory with less CPU staging. The goal is lower latency, lower CPU overhead, and higher useful throughput.',
        'For model serving, the same idea appears as a tiered state store. Active KV cache lives in HBM. Warm state may live in CPU memory or local SSD. Colder but reusable state may live in a shared filesystem. The scheduler and cache manager need to know where state lives, how expensive it is to restore, and when recompute is cheaper than fetch.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The state hierarchy view proves that not all AI state has the same lifetime or placement requirement. A single-turn chat may only need transient context. RAG needs document and citation throughput. Agent traces need durable intermediate state. Batch training needs sustained streaming and checkpoint flow.',
        'The GPU-direct path proves that copy path matters. A storage system can have impressive device throughput and still waste CPU or stall GPUs if data takes a slow route through host memory. The direct path is a latency and overhead argument, not a claim that flash equals HBM.',
        'The mechanism and buying-story matrices prove the real evaluation standard. Ask about state reuse, p99 load time, failure recovery, metadata behavior, network tuning, and GPU dollars saved. A storage benchmark is useful only if it matches the workload shape.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Parallel filesystems work by turning one large bottleneck into many smaller lanes. Striping and distributed metadata let many clients read, write, and locate data at once. NVMe flash provides high device-level throughput. RDMA or similar low-latency fabrics reduce network overhead when the hardware and configuration are right.',
        'GPU-adjacent storage works when saved compute is more valuable than the storage path cost. If fetching a reusable state object takes less time and money than recomputing it on a GPU, the state tier improves system economics. If fetching is slower than recompute, it does not.',
        'POSIX compatibility works as an adoption bridge. Existing applications can read and write files without a custom storage API. The tradeoff is that POSIX semantics can constrain optimization, so high-performance systems must be careful about metadata, consistency, and locking behavior.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The trade is storage dollars and architecture complexity against GPU dollars. A GPU should not wait on data or redo prefill work unnecessarily. But adding a hot storage tier introduces tail latency, failure modes, network tuning, metadata consistency, security boundaries, and operational burden.',
        'There is also a coupling cost. If a model server assumes session state is local to one GPU, shared storage alone will not make the system elastic. The scheduler, request router, cache layout, eviction policy, and observability all need to understand state placement.',
        'Benchmarks need discipline. Mean throughput can hide slow reads. Single-client tests can miss metadata contention. A fresh cluster can hide fragmentation and recovery behavior. The right measurement is tied to the workload: checkpoint restore time, samples per second, KV restore latency, p99 serving delay, and GPU idle time.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Good fits include large training datasets, checkpoint loading, multimodal pipelines, RAG corpora, long-running agents with reusable state, analytics over large columnar files, and inference systems that can externalize inactive KV cache. The shared theme is repeated GPU access to data or state too large for local HBM.',
        'It can also help operationally. A shared high-performance state tier can reduce session pinning, speed recovery after worker loss, and give multiple compute pools access to the same artifacts. That matters when jobs move between clusters or when serving capacity shifts under load.',
        'Bad fits exist. If the workload is single-turn, stateless, small, or dominated by model compute rather than data movement, a specialized filesystem may add little. If object storage latency is already acceptable, the extra layer may not earn its cost.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The first misconception is that storage can replace memory. It cannot. HBM remains the active compute tier. The realistic goal is to reduce expensive recomputation and keep GPUs fed, not to make NVMe behave exactly like on-package memory.',
        'The second failure is buying throughput and forgetting tail latency. A serving system can look fast on average while one slow state fetch delays a user-visible stream. The third failure is ignoring recovery: a hot state tier must explain what happens on node loss, network partition, metadata pressure, and partial writes.',
        'A final failure is treating a vendor architecture as a universal answer. WEKA, GPUDirect Storage, RDMA, flash, and object tiering are tools. The proof is workload-specific: trace the state, measure the miss cost, measure the fetch cost, and compare both to GPU idle time.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary and official sources: WEKA homepage at https://www.weka.io/, WEKA GPUDirect Storage glossary at https://www.weka.io/learn/glossary/gpu/what-is-gpudirect-storage/, and NVIDIA/Weka AI reference architecture at https://network.nvidia.com/files/doc-2020/weka-ai-ra.pdf. Study KV Cache, LLM Serving: PagedAttention, Transformer Inference Roofline, Prefix Caching & RadixAttention, KV Cache Tiered Offload Store Case Study, S3 Object Storage Case Study, GPUDirect RDMA Peer Memory Case Study, and Chiplet Interconnect Case Study next.',
      ],
    },
  ],
};
