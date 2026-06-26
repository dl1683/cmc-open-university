// GPU all-reduce: the collective that turns many local gradient shards into
// one identical update on every accelerator.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'gpu-allreduce',
  title: 'GPU All-Reduce',
  category: 'Systems',
  summary: 'A collective communication primitive: reduce values across ranks, then make the same result available on every GPU.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['ring choreography', 'training step'], defaultValue: 'ring choreography' },
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

function ringState(title) {
  return graphState({
    nodes: [
      { id: 'g0', label: 'GPU 0', x: 2.0, y: 1.4, note: 'rank 0' },
      { id: 'g1', label: 'GPU 1', x: 6.2, y: 1.4, note: 'rank 1' },
      { id: 'g2', label: 'GPU 2', x: 6.2, y: 5.8, note: 'rank 2' },
      { id: 'g3', label: 'GPU 3', x: 2.0, y: 5.8, note: 'rank 3' },
      { id: 'bucket', label: 'gradient bucket', x: 4.1, y: 3.6, note: 'chunked tensor' },
    ],
    edges: [
      { id: 'e01', from: 'g0', to: 'g1', weight: 'send chunk' },
      { id: 'e12', from: 'g1', to: 'g2', weight: 'send chunk' },
      { id: 'e23', from: 'g2', to: 'g3', weight: 'send chunk' },
      { id: 'e30', from: 'g3', to: 'g0', weight: 'send chunk' },
      { id: 'e0b', from: 'g0', to: 'bucket', weight: 'local slice' },
      { id: 'e1b', from: 'g1', to: 'bucket', weight: 'local slice' },
      { id: 'e2b', from: 'g2', to: 'bucket', weight: 'local slice' },
      { id: 'e3b', from: 'g3', to: 'bucket', weight: 'local slice' },
    ],
  }, { title });
}

function* ringChoreography() {
  const numGPUs = 4;
  const ringEdges = 4;
  const collectives = ['all-reduce', 'reduce-scatter', 'all-gather', 'all-to-all'];

  yield {
    state: ringState('Each GPU starts with a local contribution'),
    highlight: { active: ['g0', 'g1', 'g2', 'g3'], compare: ['bucket'] },
    explanation: `The ${numGPUs} GPU nodes are ranks holding different local contributions to the same gradient bucket. The goal is not to send everything to one master; the goal is for every rank to end with the same reduced tensor.`,
  };

  yield {
    state: ringState('Reduce-scatter: chunks circulate and get summed'),
    highlight: { active: ['e01', 'e12', 'e23', 'e30'], found: ['bucket'] },
    explanation: `A bandwidth-efficient implementation cuts the tensor into ${numGPUs} chunks. Chunks move around the ring across ${ringEdges} edges; each GPU adds its local contribution as a chunk passes. After ${numGPUs - 1} steps, every rank owns one fully reduced slice.`,
    invariant: `The data moves in ${numGPUs} chunks so all ${ringEdges} links stay busy instead of waiting for one giant transfer.`,
  };

  yield {
    state: ringState('All-gather: reduced chunks circulate back to everyone'),
    highlight: { found: ['e01', 'e12', 'e23', 'e30'], active: ['g0', 'g1', 'g2', 'g3'] },
    explanation: `The second half gathers the reduced chunks in another ${numGPUs - 1} steps so every rank receives every slice. NCCL exposes this as AllReduce, and also exposes ReduceScatter and AllGather separately for systems that want to compose them.`,
  };

  yield {
    state: labelMatrix(
      'Collective communication contracts',
      [
        { id: 'allreduce', label: 'all-reduce' },
        { id: 'reducescatter', label: 'reduce-scatter' },
        { id: 'allgather', label: 'all-gather' },
        { id: 'alltoall', label: 'all-to-all' },
      ],
      [
        { id: 'input', label: 'input' },
        { id: 'output', label: 'output' },
        { id: 'used', label: 'used for' },
      ],
      [
        ['N values per rank', 'same reduced N values', 'data-parallel gradients'],
        ['N values per rank', 'one reduced shard', 'ZeRO and sharded training'],
        ['one shard per rank', 'full concatenated tensor', 'parameter gathering'],
        ['one shard per peer', 'peer-specific shards', 'expert routing'],
      ],
    ),
    highlight: { active: ['allreduce:output', 'reducescatter:output', 'allgather:used'], compare: ['alltoall:used'] },
    explanation: `This table covers ${collectives.length} collective contracts: ${collectives.join(', ')}. The names define where the result lives. All-reduce replicates the reduction everywhere. Reduce-scatter reduces and shards. All-gather reverses sharding. All-to-all exchanges different chunks with different peers.`,
  };
}

function* trainingStep() {
  const numRanks = 4;
  const batchSize = 128;
  const examplesPerRank = batchSize / numRanks;
  const phases = ['mini-batch split', 'forward pass', 'backward pass', 'all-reduce', 'optimizer step'];
  const failures = ['mismatched call', 'slow rank', 'tiny buckets', 'bad topology'];
  const downstream = ['data parallelism', 'ZeRO', 'tensor parallelism', 'mixture of experts'];

  yield {
    state: labelMatrix(
      'Synchronous data-parallel step',
      [
        { id: 'batch', label: 'mini-batch split' },
        { id: 'forward', label: 'forward pass' },
        { id: 'backward', label: 'backward pass' },
        { id: 'sync', label: 'all-reduce' },
        { id: 'step', label: 'optimizer step' },
      ],
      [
        { id: 'rank0', label: 'rank 0' },
        { id: 'rank1', label: 'rank 1' },
        { id: 'rank2', label: 'rank 2' },
        { id: 'rank3', label: 'rank 3' },
      ],
      [
        ['examples 0..31', 'examples 32..63', 'examples 64..95', 'examples 96..127'],
        ['local activations', 'local activations', 'local activations', 'local activations'],
        ['local gradients', 'local gradients', 'local gradients', 'local gradients'],
        ['same averaged grad', 'same averaged grad', 'same averaged grad', 'same averaged grad'],
        ['same weights', 'same weights', 'same weights', 'same weights'],
      ],
    ),
    highlight: { active: ['sync:rank0', 'sync:rank1', 'sync:rank2', 'sync:rank3'], found: ['step:rank0', 'step:rank3'] },
    explanation: `Each of the ${phases.length} rows is one phase of a synchronous training step across ${numRanks} ranks processing ${examplesPerRank} examples each. The all-reduce row is the barrier where local gradients become one shared averaged gradient, which is why the optimizer step keeps every replica identical.`,
  };

  yield {
    state: labelMatrix(
      'What can go wrong',
      [
        { id: 'mismatch', label: 'mismatched call' },
        { id: 'straggler', label: 'slow rank' },
        { id: 'small', label: 'tiny buckets' },
        { id: 'topology', label: 'bad topology' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'fix', label: 'engineering response' },
      ],
      [
        ['hang or data corruption', 'same count, type, order on every rank'],
        ['whole step waits', 'bucket overlap and load balance'],
        ['launch and latency overhead', 'larger buckets or fusion'],
        ['links underused', 'rank placement and topology-aware collectives'],
      ],
    ),
    highlight: { active: ['mismatch:symptom', 'straggler:symptom'], found: ['small:fix', 'topology:fix'] },
    explanation: `A collective is a distributed rendezvous across ${numRanks} ranks, not an ordinary function call. This table lists ${failures.length} failure modes: ${failures.join(', ')}. Every participant must call the same collective with compatible buffers; otherwise the group can hang or corrupt results.`,
  };

  yield {
    state: ringState('Overlap communication with backward computation'),
    highlight: { active: ['bucket', 'e01', 'e12', 'e23', 'e30'], found: ['g0', 'g1', 'g2', 'g3'] },
    explanation: `Modern training stacks bucket gradients across ${numRanks} ranks and start communication while later layers are still computing backward gradients. The useful mental model is an assembly line: compute fills buckets, communication drains them.`,
  };

  yield {
    state: labelMatrix(
      'Why this unlocks other topics',
      [
        { id: 'ddp', label: 'data parallelism' },
        { id: 'zero', label: 'ZeRO' },
        { id: 'tensor', label: 'tensor parallelism' },
        { id: 'moe', label: 'mixture of experts' },
      ],
      [
        { id: 'collective', label: 'collective used' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['all-reduce', 'replicate model, average gradients'],
        ['reduce-scatter + all-gather', 'shard optimizer state'],
        ['all-reduce/all-gather', 'split one layer across GPUs'],
        ['all-to-all', 'route tokens to experts'],
      ],
    ),
    highlight: { found: ['ddp:collective', 'zero:collective', 'tensor:collective'], compare: ['moe:collective'] },
    explanation: `All-reduce is the first collective to learn because it appears in all ${downstream.length} downstream topics: ${downstream.join(', ')}. Once the contract is clear, ZeRO, tensor parallelism, and expert routing become compositions instead of magic.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'ring choreography') yield* ringChoreography();
  else if (view === 'training step') yield* trainingStep();
  else throw new InputError('Pick a GPU all-reduce view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The "ring choreography" view shows four GPUs arranged in a ring. Watch the reduce-scatter phase first: chunks circulate and accumulate local contributions at each stop. Then watch all-gather: the reduced chunks circulate again until every GPU holds the full result. The "training step" view zooms out to show where all-reduce sits inside a synchronous data-parallel training iteration.',
        'Each frame highlights active edges or cells. Green marks the operation in progress; blue marks completed results. Step through slowly the first time to match each explanation line to the highlighted state.',
        {type: 'image', src: './assets/gifs/gpu-allreduce.gif', alt: 'Animated walkthrough of the gpu allreduce visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Training a neural network on multiple GPUs requires every GPU to apply the same weight update. In data-parallel training, each GPU processes a different slice of the batch and computes a local gradient. Those local gradients must be combined into one averaged gradient and delivered to every GPU so the optimizer step keeps all replicas identical. The operation that does this is called all-reduce.',
        'A collective is a communication primitive where every participant calls the same operation at the same time with compatible arguments. All-reduce is a specific collective: it reduces (sums, averages, or otherwise combines) values from all participants and places the identical result on every participant. NVIDIA\'s NCCL library documents AllReduce as "reduce data across ranks and store the result in every rank\'s receive buffer." That one-line contract is the foundation of synchronous distributed training.',
        {type: 'callout', text: 'All-reduce is a placement contract: every rank contributes to one reduction and every rank receives the same reduced tensor.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest design uses a coordinator. Every GPU sends its local gradient to GPU 0, GPU 0 sums them all, and GPU 0 broadcasts the result back. This is correct and easy to implement. For two or three GPUs on a fast bus it works fine.',
        'A slightly better variant skips the single coordinator and instead performs many small reductions, one per parameter tensor. Each tensor is reduced independently. This is still correct, but each reduction pays a fixed launch and synchronization cost, so many small reductions waste time on overhead rather than moving useful bytes.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The coordinator approach concentrates all bandwidth at one node. With k GPUs and a gradient of size S bytes, GPU 0 must receive (k-1) * S bytes and then send (k-1) * S bytes. The other GPUs sit idle during both phases. At k = 8, GPU 0 handles 14 * S bytes while the remaining 7 GPUs do nothing. The coordinator becomes the bottleneck, and adding more GPUs makes it worse.',
        'The many-small-reductions approach avoids the bandwidth bottleneck but hits a latency wall. If a model has 1,000 parameter tensors and each reduction takes 10 microseconds of launch overhead, communication alone costs 10 milliseconds of pure overhead before any bytes move. Modern training stacks solve this by bucketing gradients into larger buffers and overlapping communication with backward computation, but the fundamental algorithmic problem remains: how to move S bytes across k GPUs without concentrating traffic at one node.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Split the gradient tensor into k chunks (one per GPU) and spread both the reduction work and the distribution work across all participants simultaneously. No single GPU ever holds or processes the full tensor from all peers. Instead, chunks circulate through the group, accumulating partial sums as they move.',
        {type: 'image', src: 'https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/_images/allreduce.png', alt: 'NCCL all-reduce collective diagram showing data reduced and available on every rank', caption: 'NVIDIA NCCL documentation shows the AllReduce placement contract: every participant receives the reduced result. Source: https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html'},
        'This decomposition reveals that all-reduce is actually two simpler collectives composed in sequence. Reduce-scatter reduces the tensor and distributes the result as shards: each GPU ends with one fully reduced chunk. All-gather then copies those shards to every GPU so each one reconstructs the full reduced tensor. Understanding these two halves separately makes ZeRO, FSDP, and tensor parallelism much easier to learn, because those systems use reduce-scatter and all-gather independently.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Arrange k GPUs in a logical ring. Divide the gradient tensor into k equal chunks. The algorithm proceeds in two phases, each taking k - 1 steps. In the reduce-scatter phase, each GPU sends one chunk to its right neighbor and receives one chunk from its left neighbor. On receiving a chunk, the GPU adds its own local values for that chunk to the incoming partial sum and forwards the updated chunk in the next step. After k - 1 steps, each chunk has visited all k GPUs, so each GPU holds one chunk that contains the sum of all k contributions.',
        {type: 'image', src: 'https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/_images/reducescatter.png', alt: 'NCCL reduce-scatter collective diagram showing reduced shards distributed across ranks', caption: 'NVIDIA NCCL documentation shows ReduceScatter as reduction plus sharding, which is the first half of the ring all-reduce mental model. Source: https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html'},
        'In the all-gather phase, each GPU sends its fully reduced chunk to the right neighbor and receives a fully reduced chunk from the left. No addition happens this time; chunks are simply copied. After another k - 1 steps, every GPU has collected all k reduced chunks and can concatenate them into the full reduced tensor.',
        {type: 'image', src: 'https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/_images/allgather.png', alt: 'NCCL all-gather collective diagram showing shards collected on every rank', caption: 'NVIDIA NCCL documentation shows AllGather restoring full replication after shards have been produced. Source: https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html'},
        'The ring is not the only topology. Tree reductions, recursive halving-doubling, and hierarchical (intra-node then inter-node) algorithms exist. NCCL selects among them based on message size, link speed, and GPU topology. The ring is the clearest to teach because every link carries useful traffic on every step and no single node is special.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on two properties. First, addition is associative and commutative, so the order in which partial sums accumulate does not change the mathematical result. (Floating-point addition is not truly associative, so bit-level results may differ from a coordinator approach, but the target value is the same.) Second, every chunk visits all k GPUs exactly once during reduce-scatter, so no contribution is missed or double-counted.',
        'The placement guarantee is that after all-gather completes, every GPU holds the same k chunks in the same order. Since each chunk is the sum of the corresponding chunk from every GPU, concatenation produces the same full reduced tensor on every rank. The optimizer step then applies the same update to every replica, preserving weight identity across GPUs.',
        'The training-level invariant is stricter: every GPU must call the same collective with the same tensor shapes in the same order. If one GPU calls all-gather while the others call all-reduce, or if one GPU passes a tensor of a different size, the group hangs or produces garbage. This is why collective bugs usually manifest as deadlocks rather than wrong answers.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A ring all-reduce with k GPUs and a tensor of S bytes sends 2 * (k-1)/k * S bytes per GPU across both phases. As k grows, each GPU sends approximately 2S bytes regardless of how many GPUs participate. This is optimal for bandwidth: no algorithm can do better than 2S bytes per GPU for all-reduce. The total number of steps is 2 * (k-1), and each step transfers S/k bytes, so latency scales as O(k) with k round-trip delays.',
        'For large tensors (hundreds of megabytes), bandwidth dominates and the ring is efficient. For small tensors (a few kilobytes), each step pays fixed launch overhead that outweighs the data transfer, and tree or recursive-doubling algorithms with O(log k) latency steps are faster. Production systems like NCCL switch algorithms at a size threshold.',
        'Topology matters because not all links are equal. A ring across GPUs connected by NVSwitch (900 GB/s per GPU) behaves differently from a ring that crosses InfiniBand host boundaries (200-400 Gb/s per link). Hierarchical collectives reduce inside a node first, then communicate across nodes, trading extra local bandwidth for less cross-node traffic. A single slow link or a straggler GPU blocks the entire collective, so rank placement is a performance-critical decision.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Synchronous data-parallel training (PyTorch DDP, Horovod) uses all-reduce on every training step to average gradients across replicas. This is the most common use and the reason all-reduce is the first collective most engineers encounter. The gradient tensor is bucketed into large buffers, and communication starts while later layers are still computing backward gradients, overlapping compute and communication.',
        'Tensor parallelism splits individual layers across GPUs. After each parallel matrix multiplication, a small all-reduce sums the partial results so every GPU has the full layer output before the next layer begins. Metric aggregation during evaluation (summing loss or accuracy across workers) is another common use. Any situation where every participant needs the same combined value is a candidate for all-reduce.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'All-reduce replicates the full result on every GPU. When the model is large and memory is scarce, that replication is wasteful. ZeRO Stage 1-3 and FSDP replace all-reduce with reduce-scatter (so each GPU only stores its assigned shard) plus all-gather (to reconstruct parameters on demand). The result is the same math but lower peak memory per GPU.',
        'Mixture-of-experts routing uses all-to-all instead of all-reduce because each GPU needs to send different tokens to different expert owners, not the same combined result to everyone. All-reduce is the wrong primitive whenever the output needs to differ by rank.',
        'Operationally, all-reduce fails when participants disagree. Mismatched tensor shapes, different call ordering, a crashed rank, or a dataloader that stalls one GPU will hang the entire group. Debugging requires checking that every rank reaches the same collective call with identical buffer sizes. NCCL provides environment variables (NCCL_DEBUG=INFO) and tools like nsys/nccl-tests to diagnose these issues.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Four GPUs train a model with a single parameter vector of 4 floats. Each GPU computes a local gradient on its slice of the batch. GPU 0 has [1.0, 2.0, 3.0, 4.0], GPU 1 has [0.5, 1.5, 2.5, 3.5], GPU 2 has [2.0, 0.0, 1.0, 5.0], GPU 3 has [1.5, 2.5, 0.5, 1.5]. The target average gradient is the element-wise sum divided by 4: [(1.0+0.5+2.0+1.5)/4, (2.0+1.5+0.0+2.5)/4, (3.0+2.5+1.0+0.5)/4, (4.0+3.5+5.0+1.5)/4] = [1.25, 1.5, 1.75, 3.5].',
        'The tensor is split into 4 chunks of 1 float each. GPU 0 owns chunk 0, GPU 1 owns chunk 1, and so on. Reduce-scatter runs for 3 steps. Step 1: GPU 0 sends its chunk 0 value (1.0) rightward to GPU 1; GPU 1 sends its chunk 1 value (1.5) to GPU 2; GPU 2 sends chunk 2 (1.0) to GPU 3; GPU 3 sends chunk 3 (1.5) to GPU 0. Each receiver adds the incoming value to its own local value for that chunk. After step 1, GPU 1 holds a partial sum for chunk 0: 0.5 + 1.0 = 1.5.',
        'Steps 2 and 3 continue the circulation. After all 3 steps, each GPU holds one fully reduced chunk: GPU 0 has chunk 0 = 5.0 (the sum 1.0+0.5+2.0+1.5), GPU 1 has chunk 1 = 6.0, GPU 2 has chunk 2 = 7.0, GPU 3 has chunk 3 = 14.0. All-gather then circulates these reduced values for 3 more steps. After all-gather, every GPU holds [5.0, 6.0, 7.0, 14.0]. Each GPU divides by 4 to get the average: [1.25, 1.5, 1.75, 3.5]. All replicas now hold the same averaged gradient and apply the same optimizer step.',
        'Total data moved per GPU across both phases: 2 * (4-1)/4 * 4 floats = 6 floats. A coordinator approach would require GPU 0 to receive 3 * 4 = 12 floats and send 3 * 4 = 12 floats, while other GPUs only send and receive 4 floats each. The ring distributes the load evenly.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'NVIDIA NCCL collective operations documentation: https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html. NCCL overview and design: https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/overview.html. Baidu\'s ring all-reduce blog post (2017) introduced the ring algorithm to the deep learning community and remains a clear reference.',
        'Study next: Backpropagation (why gradients exist), Batch Size Scaling (why the batch is split across GPUs), Parameter Server (the coordinator baseline all-reduce replaces), ZeRO Optimizer (reduce-scatter and all-gather used independently to shard optimizer state), Tensor Parallelism (all-reduce inside individual layers), and Mixture of Experts routing (the contrasting all-to-all collective).',
      ],
    },
  ],
};
