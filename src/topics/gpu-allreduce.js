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
  yield {
    state: ringState('Each GPU starts with a local contribution'),
    highlight: { active: ['g0', 'g1', 'g2', 'g3'], compare: ['bucket'] },
    explanation: 'All-reduce begins after each rank has computed a local tensor, commonly a gradient bucket. The goal is not to send everything to one master. The goal is for every rank to end with the same reduced tensor.',
  };

  yield {
    state: ringState('Reduce-scatter: chunks circulate and get summed'),
    highlight: { active: ['e01', 'e12', 'e23', 'e30'], found: ['bucket'] },
    explanation: 'A bandwidth-efficient implementation cuts the tensor into chunks. Chunks move around the ring; each GPU adds its local contribution as a chunk passes. After reduce-scatter, every rank owns one fully reduced slice.',
    invariant: 'The data moves in chunks so links stay busy instead of waiting for one giant transfer.',
  };

  yield {
    state: ringState('All-gather: reduced chunks circulate back to everyone'),
    highlight: { found: ['e01', 'e12', 'e23', 'e30'], active: ['g0', 'g1', 'g2', 'g3'] },
    explanation: 'The second half gathers the reduced chunks so every rank receives every slice. NCCL exposes this as AllReduce, and also exposes ReduceScatter and AllGather separately for systems that want to compose them.',
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
    explanation: 'The names are contracts about where the result lives. All-reduce replicates the reduction everywhere. Reduce-scatter reduces and shards. All-gather reverses sharding. All-to-all exchanges different chunks with different peers.',
  };
}

function* trainingStep() {
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
    explanation: 'Synchronous data parallelism is simple because all ranks update the same parameters after every step. All-reduce is the barrier that makes those replicas stay identical.',
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
    explanation: 'A collective is a distributed rendezvous, not an ordinary function call. Every participant must call the same collective with compatible buffers; otherwise the group can hang or corrupt results.',
  };

  yield {
    state: ringState('Overlap communication with backward computation'),
    highlight: { active: ['bucket', 'e01', 'e12', 'e23', 'e30'], found: ['g0', 'g1', 'g2', 'g3'] },
    explanation: 'Modern training stacks bucket gradients and start communication while later layers are still computing backward gradients. The useful mental model is an assembly line: compute fills buckets, communication drains them.',
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
    explanation: 'All-reduce is the first collective to learn because it appears everywhere. Once the contract is clear, ZeRO, tensor parallelism, and expert routing become compositions instead of magic.',
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
      heading: 'What it is',
      paragraphs: [
        'GPU all-reduce is the collective communication operation that makes synchronous distributed training work. Each GPU starts with a local tensor, often gradients computed from its mini-batch. The collective reduces those tensors with an operation such as sum or average, then stores the same reduced result on every GPU. After that, every rank can run the same optimizer step and keep its local model replica identical.',
        'The important word is collective. This is not GPU 0 asking everyone else for data. It is a coordinated operation that every rank enters with compatible buffer sizes, datatypes, and ordering. NVIDIA NCCL documents AllReduce as reducing data across devices and storing the result in each rank receive buffer: https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html. If one rank calls a different collective, uses a different count, or arrives out of order, the group can hang or produce invalid results.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A common teaching implementation is ring all-reduce. Split the tensor into chunks. In the reduce-scatter phase, chunks circulate around a ring of ranks and each rank adds its local contribution to the chunk it receives. At the end of that phase, each rank owns one reduced shard. In the all-gather phase, those reduced shards circulate so every rank receives the full reduced tensor. The two-phase view is useful because many advanced systems expose or build directly on reduce-scatter and all-gather.',
        'This is why gradient bucketing matters. A model may have millions of tiny parameter tensors, but communication hardware wants large contiguous transfers. Distributed training frameworks group gradients into buckets and start all-reduce as soon as a bucket is ready during backpropagation. The best systems overlap communication for early layers with backward computation for later layers, hiding some network time behind useful compute.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The algorithmic work is not in arithmetic; adding floating-point arrays is cheap compared with moving bytes. The cost is network bandwidth, latency, synchronization, and topology. NVLink, PCIe, NVSwitch, InfiniBand, and Ethernet have different bandwidth and contention profiles. Rank placement can decide whether the collective runs inside one fast node or crosses slower links. Small buckets waste time on launch and latency overhead; huge buckets reduce overlap and increase memory pressure.',
        'All-reduce also creates a synchronization point. In synchronous data parallelism, one slow rank can delay the entire step. This is why large training jobs care about input pipeline balance, GPU health, straggler detection, checkpoint restart, and communication/computation overlap. The collective is mathematically clean, but operationally it is part of a cluster system.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The canonical use is distributed SGD: split a global batch across GPUs, compute local gradients, all-reduce the gradients, then apply one identical update everywhere. But the same mental model appears across modern AI systems. ZeRO uses reduce-scatter and all-gather to shard optimizer state and parameters. Tensor Parallelism uses collectives inside one transformer layer. Mixture-of-Experts uses all-to-all rather than all-reduce, but the same collective-discipline rules apply: every rank participates in a coordinated data movement contract.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The biggest misconception is thinking all-reduce means centralizing data. A good implementation avoids a central reducer because a central reducer would bottleneck the entire job. Another trap is treating communication as an afterthought once the model fits in memory. At scale, communication patterns become architecture: bucket size, overlap, rank placement, topology, and failure recovery can matter as much as optimizer choice.',
        'A final pitfall is confusing collectives with message queues. Message Queue decouples producers and consumers. All-reduce deliberately couples participants at one step boundary. That tight coupling is exactly what preserves identical model replicas, but it is also why one bad participant can stall everyone.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: NVIDIA NCCL collective operations at https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html and NCCL overview at https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/overview.html. Study Batch Size Scaling, Backpropagation, Parameter Server Case Study, ZeRO Optimizer, Tensor Parallelism, Mixture of Experts, MoE Expert Capacity and All-To-All Routing Ledger, and Heterogeneous AI Compute Workload Router next.',
      ],
    },
  ],
};
