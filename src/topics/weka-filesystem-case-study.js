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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a state path through an AI storage system. Active nodes are the part handling the current request, compare nodes are available paths that are not being used yet, and found nodes are state that has become durable or reachable. A safe inference is this: if a request moves from GPU worker to shared NVMe storage without a host-memory detour, the cost being shown is a copy-path cost, not a claim that storage is as fast as GPU memory.',
        'A filesystem is the operating-system interface that lets programs read and write named files. A distributed filesystem spreads that interface across many machines while trying to look like one filesystem to the application. In this case study, Weka is useful because the animation connects file layout, network path, and GPU waiting time.',
        {type: 'callout', text: 'AI storage becomes architecture when reusable state is expensive enough that fetching it beats making GPUs recompute it.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'AI systems move more than training examples. They move checkpoints, embeddings, vector indexes, video frames, logs, model artifacts, and sometimes reusable inference state. If a GPU waits 400 ms for data on every step, the expensive part of the machine is idle even though the model code is correct.',
        'The reason a Weka-style filesystem exists is that local disks and object storage sit at awkward ends of the tradeoff. Local NVMe is fast but trapped on one host. Object storage is deep and cheap, but it usually has too much request latency for a hot GPU path.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious design is to put datasets and checkpoints in object storage, copy them to local disks before a job starts, and let each worker cache what it needs. This works for a batch job that reads mostly sequential files and does not restart often. It is also easy to operate because object storage already gives durability and a familiar API.',
        'The same design gets weaker when many workers share a changing corpus or when checkpoint restore time controls recovery. Eight GPU workers might each copy the same 200 GB checkpoint to local disk. The system then pays 1.6 TB of network traffic before useful compute resumes.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that AI cost is not storage cost alone. A 30 GB state fetch that saves 20 seconds of GPU recomputation can be cheap even if the storage tier is expensive. A 30 GB fetch that delays an otherwise ready request is expensive because it moves the bottleneck into user-visible latency.',
        'Average throughput hides the failure. A filesystem that can stream 100 GB/s across a cluster may still hurt serving if one metadata lookup, one congested link, or one cold object fetch lands on the p99 path. For GPU workloads, the question is not only bytes per second; it is how often bytes arrive after the GPU needed them.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to treat storage as a tier in the compute schedule. GPU HBM is the active memory tier, CPU DRAM is a nearby staging tier, NVMe flash is a persistent hot tier, and object storage is the deep tier. A high-performance shared filesystem tries to make the NVMe and network tier close enough that reuse beats recomputation.',
        'This works only when the system records the economics of state. If fetching a tensor shard takes 120 ms and recomputing it takes 700 ms of GPU time, fetching is the better behavior. If fetching takes 900 ms because the object is cold, recomputation may be the better behavior.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The application opens a file through a POSIX-style interface, meaning the program uses ordinary file operations instead of a custom storage API. Behind that interface, metadata maps the file name to chunks, chunks are spread across flash devices, and many clients can read different pieces at the same time. The filesystem becomes a coordination layer for placement, durability, and parallel reads.',
        'GPUDirect Storage is the special path in the animation. In a traditional path, data may move from storage to CPU memory and then to GPU memory. With a supported direct path, storage data can move closer to GPU memory with less CPU copying, so the CPU spends less time shuttling bytes.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness claim is about consistency of named state, not about model accuracy. If the filesystem says checkpoint C is committed, every worker that reads checkpoint C should see the same bytes or a defined error. That property lets a scheduler move work without each job inventing its own file-discovery protocol.',
        'The performance claim works by parallelism and saved work. Striping a file across 16 storage nodes lets 16 devices serve pieces instead of forcing one disk to do all reads. Reusing a stored checkpoint also avoids repeating earlier compute, so the saved GPU time is part of the value created by the storage system.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The time cost is dominated by the slowest path on the hot request. A 10 GB checkpoint at 20 GB/s needs about 0.5 seconds of ideal transfer time, but metadata, network contention, retries, and CPU staging can add tail latency. When the input doubles to 20 GB, the transfer component roughly doubles unless more parallel lanes are added.',
        'The space cost is extra hot storage that duplicates deeper storage. The operational cost is the distributed-system tax: metadata availability, flash wear, network tuning, client versions, security policy, and recovery behavior. The design is worth it only when the saved GPU idle time and simplified placement are larger than those taxes.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The best fit is a cluster where many GPU jobs reuse large files or shared state. Training uses it for sample streaming and checkpoint restore. Retrieval systems use it for corpora, embeddings, and indexes that are too large for every worker to keep locally.',
        'Inference can use the same pattern when inactive state is cheaper to fetch than to recompute. A long-context service might keep active key-value cache in GPU memory and spill colder state to a slower tier. The filesystem is useful only if the scheduler understands the restore cost before it places the next request.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when teams confuse storage with memory. NVMe and network storage can reduce recomputation, but they do not replace HBM for active matrix math. If every token needs immediate random access to state, the latency gap remains visible.',
        'It also fails when the workload is small, stateless, or dominated by compute. A model that reads a 2 MB prompt and then spends 8 seconds generating tokens does not need a specialized filesystem for that prompt. The right test is a trace: record bytes moved, miss rate, restore time, recompute time, and GPU idle time.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose 64 GPUs run a training job that checkpoints 800 GB every 20 minutes. After a node failure, the job must restore the latest checkpoint. If object storage delivers 8 GB/s to the cluster, restore takes about 100 seconds before compute can resume.',
        'Now suppose the shared flash tier delivers 80 GB/s for that restore. The same 800 GB returns in about 10 seconds. If the cluster costs 160 dollars per GPU-hour, saving 90 seconds across 64 GPUs saves about 256 dollars of idle GPU time for one recovery, because 64 * 160 * 90 / 3600 = 256.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Use the WEKA GPUDirect Storage explainer at https://www.weka.io/learn/glossary/gpu/what-is-gpudirect-storage/ and the NVIDIA-WEKA AI reference architecture at https://network.nvidia.com/files/doc-2020/weka-ai-ra.pdf as the primary storage sources. Read NVIDIA GPUDirect Storage documentation next if you want the device and driver boundary rather than the architecture story.',
        'Study S3 Object Storage Case Study for the deep tier, GPUDirect RDMA Peer Memory Case Study for the network path, Transformer Inference Roofline for GPU bottlenecks, and Prefix Caching RadixAttention for the reuse problem that makes state placement matter.',
      ],
    },
  ],
};
