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
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/gpu-allreduce.gif', alt: 'Animated walkthrough of the gpu allreduce visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why This Exists',
      paragraphs: [
        'GPU all-reduce exists because replicated training has a simple correctness rule: every model replica must apply the same update. In synchronous data parallel training, each GPU sees a different slice of the batch and computes a local gradient. Those gradients are not interchangeable guesses; they are pieces of the gradient for the larger global batch. All-reduce combines them and leaves the combined result on every rank, so the optimizer step keeps the replicas identical.',
        'The key word is collective. All ranks participate in the same operation, with compatible count, datatype, reduction operator, and call order. NVIDIA NCCL documents AllReduce as reducing values across devices and storing the result in every rank receive buffer. That definition is small, but it is the hinge for data parallelism, ZeRO, tensor parallelism, and many distributed debugging failures.',
        {type: 'callout', text: 'All-reduce is a placement contract: every rank contributes to one reduction and every rank receives the same reduced tensor.'},
      ],
    },
    {
      heading: 'The Obvious Coordinator And The Wall',
      paragraphs: [
        'The first design most people imagine is a coordinator. Every worker sends gradients to rank 0, rank 0 sums them, and rank 0 broadcasts the answer. That works for small systems and is easy to reason about. The wall is bandwidth concentration. One rank receives the whole tensor from every other rank and then sends the whole result back out. The coordinator becomes the slowest link in the step, and the other accelerators wait.',
        'A second weak design is to perform many tiny reductions, one parameter tensor at a time. That keeps the math correct but wastes latency and launch overhead. Modern training stacks bucket gradients into larger transfers and try to overlap communication with backpropagation. The algorithmic problem is not only "compute the sum"; it is "move the bytes without making expensive devices idle."',
      ],
    },
    {
      heading: 'Core Insight',
      paragraphs: [
        'The core insight is to split the tensor into chunks and spread both reduction and distribution across the participants. A ring all-reduce does this in two phases. Reduce-scatter circulates chunks around a ring, and each rank adds its local contribution as a chunk passes. When that phase finishes, every rank owns one fully reduced shard. All-gather then circulates those reduced shards until every rank has the full reduced tensor.',
        {type: 'image', src: 'https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/_images/allreduce.png', alt: 'NCCL all-reduce collective diagram showing data reduced and available on every rank', caption: 'NVIDIA NCCL documentation shows the AllReduce placement contract: every participant receives the reduced result. Source: https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html'},
        'The two-phase view matters because the named collectives are data-placement contracts. All-reduce means every rank ends with the full reduced tensor. Reduce-scatter means the tensor has been reduced and sharded. All-gather means shards have been concatenated back everywhere. All-to-all means each rank sends a different shard to each peer. Once the output placement is clear, distributed training systems look less magical and more like layout transformations.',
      ],
    },
    {
      heading: 'How The Algorithm Works',
      paragraphs: [
        'In a ring with k ranks, the tensor is divided into k chunks. During reduce-scatter, each rank repeatedly sends one chunk to its neighbor and receives another chunk from the previous neighbor. On receive, it adds its local contribution for that chunk. After k - 1 steps, each chunk has visited all contributors, and each rank holds one reduced chunk. During all-gather, the reduced chunks circulate for another k - 1 steps, so every rank collects every reduced chunk.',
        {type: 'image', src: 'https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/_images/reducescatter.png', alt: 'NCCL reduce-scatter collective diagram showing reduced shards distributed across ranks', caption: 'NVIDIA NCCL documentation shows ReduceScatter as reduction plus sharding, which is the first half of the ring all-reduce mental model. Source: https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html'},
        'This is not the only all-reduce algorithm. Tree and hierarchical algorithms can be better for different message sizes and network topologies. NCCL chooses algorithms and protocols based on devices, links, ranks, and message sizes. The animation uses a ring because it exposes the conservation law: no central node owns the whole problem, and every link can carry useful traffic while reduction progresses.',
      ],
    },
    {
      heading: 'What The Visual Proves',
      paragraphs: [
        'The ring view proves why all-reduce is not a parameter server in disguise. The arrows carry chunks around the group, and the center bucket is one logical tensor rather than one physical coordinator. The reduce-scatter step shows where the sum is formed. The all-gather step shows where replication is restored.',
        {type: 'image', src: 'https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/_images/allgather.png', alt: 'NCCL all-gather collective diagram showing shards collected on every rank', caption: 'NVIDIA NCCL documentation shows AllGather restoring full replication after shards have been produced. Source: https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html'},
        'The training-step table proves the correctness role. Before synchronization, every rank has a gradient for its own mini-batch. After synchronization, every rank has the same averaged gradient. That is why the optimizer row can show the same weights on every rank. If the all-reduce row is skipped, reordered, or applied to different shapes, the table no longer represents one shared model.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'Correctness follows from associativity and equal participation. If the reduction is sum, each output element is the sum of the same element from every rank. The algorithm may add those values in a different order than a coordinator would, so floating-point bits can differ, but the mathematical target is the same. The placement invariant is that after the final gather, every rank has the same list of reduced chunks in rank order.',
        'The training invariant is stronger than the communication invariant. Every rank must enter the same collective sequence. If rank 2 calls all-gather while the others call all-reduce, there is no well-defined shared operation. This is why collective bugs often appear as hangs: each rank is waiting for peers that are not at the same rendezvous.',
        'Averaging gradients is usually implemented as sum followed by scaling, either inside the collective path or around it. The important point is consistency. If every rank applies the same scale to the same reduced tensor, the replicas stay aligned. If one rank clips, scales, skips, or unscales differently before the collective, all-reduce faithfully spreads the wrong contract.',
      ],
    },
    {
      heading: 'Cost And Tradeoffs',
      paragraphs: [
        'The arithmetic is cheap; moving bytes is the cost. For large tensors, bandwidth dominates. For small tensors, launch overhead and latency dominate. If buckets are too small, the system pays many rendezvous costs. If buckets are too large, communication starts late and cannot overlap enough with the remaining backward computation. Good training stacks tune bucket size, overlap, stream usage, and rank placement together.',
        'Topology matters because not all links are equal. A ring across GPUs on the same NVSwitch fabric behaves very differently from a ring that crosses hosts or uneven network rails. Hierarchical collectives may reduce inside a node first and then communicate across nodes. Bad placement can make a mathematically clean algorithm slow, and a single straggler can hold the whole collective open.',
        'The performance question is therefore not "is all-reduce O(n)?" but "how many bytes cross which links while useful compute remains available?" A profiler trace that shows backward computation overlapping with gradient buckets is healthy. A trace where every rank finishes compute and then waits on one large exposed all-reduce is a sign that bucket timing or topology is wasting throughput.',
      ],
    },
    {
      heading: 'Where It Wins And Where It Fails',
      paragraphs: [
        'All-reduce wins when the next computation needs the same reduced tensor everywhere. Synchronous SGD is the standard example. It also appears inside tensor-parallel layers that compute partial sums, in metric aggregation, and in some distributed solvers. It is the right mental model when replication after reduction is a requirement, not an accident.',
        'It fails when replication is unnecessary. ZeRO and FSDP often prefer reduce-scatter because each rank only needs an owned shard. Expert routing uses all-to-all because each rank sends different tokens to different expert owners. All-reduce also fails operationally when ranks diverge, dataloaders starve, tensor counts differ, or one process crashes. The collective contract is strict: same operation, compatible buffers, same order, all participants.',
      ],
    },
    {
      heading: 'Sources And Study Next',
      paragraphs: [
        'Primary sources: NVIDIA NCCL collective operations at https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html and the NCCL overview at https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/overview.html. Study Backpropagation for why gradients are produced, Batch Size Scaling for why global batches are split, Parameter Server for the coordinator baseline, ZeRO Optimizer for reduce-scatter and all-gather composition, Tensor Parallelism for in-layer collectives, and MoE expert routing for the contrasting all-to-all pattern.',
      ],
    },
  ],
};
