// ZeRO optimizer: remove replicated optimizer, gradient, and parameter memory
// across data-parallel ranks by sharding state and gathering only when needed.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'zero-optimizer',
  title: 'ZeRO Optimizer',
  category: 'Systems',
  summary: 'Zero Redundancy Optimizer shards optimizer state, gradients, and parameters across data-parallel GPUs to train larger models.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['stage ladder', 'step choreography'], defaultValue: 'stage ladder' },
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

function shardGraph(title) {
  return graphState({
    nodes: [
      { id: 'r0', label: 'rank 0', x: 1.0, y: 1.5, note: 'shard A' },
      { id: 'r1', label: 'rank 1', x: 1.0, y: 3.5, note: 'shard B' },
      { id: 'r2', label: 'rank 2', x: 1.0, y: 5.5, note: 'shard C' },
      { id: 'params', label: 'parameters', x: 4.0, y: 1.8, note: 'weights' },
      { id: 'grads', label: 'gradients', x: 4.0, y: 3.5, note: 'backward' },
      { id: 'adam', label: 'Adam states', x: 4.0, y: 5.2, note: 'm and v' },
      { id: 'collective', label: 'collectives', x: 7.2, y: 3.5, note: 'scatter/gather' },
    ],
    edges: [
      { id: 'e-r0-collective', from: 'r0', to: 'collective', weight: 'shard' },
      { id: 'e-r1-collective', from: 'r1', to: 'collective', weight: 'shard' },
      { id: 'e-r2-collective', from: 'r2', to: 'collective', weight: 'shard' },
      { id: 'e-params-collective', from: 'params', to: 'collective', weight: 'all-gather' },
      { id: 'e-grads-collective', from: 'grads', to: 'collective', weight: 'reduce-scatter' },
      { id: 'e-adam-collective', from: 'adam', to: 'collective', weight: 'partition' },
    ],
  }, { title });
}

function* stageLadder() {
  const numRanks = 3;
  const stages = 3;
  const memCategories = 4;
  yield {
    state: labelMatrix(
      'Data-parallel replication before ZeRO',
      [
        { id: 'params', label: 'parameters' },
        { id: 'grads', label: 'gradients' },
        { id: 'optim', label: 'optimizer state' },
        { id: 'activations', label: 'activations' },
      ],
      [
        { id: 'rank0', label: 'rank 0' },
        { id: 'rank1', label: 'rank 1' },
        { id: 'rank2', label: 'rank 2' },
      ],
      [
        ['full copy', 'full copy', 'full copy'],
        ['full copy', 'full copy', 'full copy'],
        ['full copy', 'full copy', 'full copy'],
        ['local batch', 'local batch', 'local batch'],
      ],
    ),
    highlight: { active: ['params:rank0', 'params:rank1', 'params:rank2', 'optim:rank0', 'optim:rank1', 'optim:rank2'] },
    explanation: `Read each column as one of ${numRanks} data-parallel ranks. The repeated "full copy" cells across all ${memCategories} memory categories are the redundancy ZeRO removes; Adam-style optimizer states can be several times larger than the visible model weights.`,
  };

  yield {
    state: labelMatrix(
      'ZeRO stage ladder',
      [
        { id: 'stage1', label: 'Stage 1' },
        { id: 'stage2', label: 'Stage 2' },
        { id: 'stage3', label: 'Stage 3' },
        { id: 'offload', label: 'Offload' },
      ],
      [
        { id: 'shards', label: 'sharded memory' },
        { id: 'collective', label: 'extra collective' },
        { id: 'win', label: 'main win' },
      ],
      [
        ['optimizer state', 'partition updates', 'Adam memory drops'],
        ['optimizer + gradients', 'reduce-scatter', 'gradient memory drops'],
        ['optimizer + gradients + parameters', 'all-gather params', 'model memory drops'],
        ['CPU/NVMe state', 'device transfer', 'fit larger models'],
      ],
    ),
    highlight: { active: ['stage1:shards', 'stage2:shards', 'stage3:shards'], found: ['stage3:collective'] },
    explanation: `ZeRO climbs ${stages} stages by removing redundancy. Stage 1 shards optimizer states. Stage 2 shards gradients too. Stage 3 shards parameters as well, gathering shards across ${numRanks} ranks only around the computation that needs them.`,
    invariant: `The model is logically replicated across all ${numRanks} ranks; the expensive training state is physically partitioned.`,
  };

  yield {
    state: shardGraph('ZeRO replaces full copies with owned shards'),
    highlight: { active: ['r0', 'r1', 'r2', 'collective'], found: ['adam', 'grads', 'params'] },
    explanation: `Each of the ${numRanks} ranks becomes responsible for a slice of the state. Collectives move just enough data at each phase so computation still sees the values it needs while long-lived memory stays sharded.`,
  };

  yield {
    state: labelMatrix(
      'Memory accounting intuition',
      [
        { id: 'fp16', label: 'fp16 weights' },
        { id: 'fp32', label: 'fp32 master weights' },
        { id: 'adam1', label: 'Adam first moment' },
        { id: 'adam2', label: 'Adam second moment' },
        { id: 'grads', label: 'gradients' },
      ],
      [
        { id: 'replicated', label: 'replicated DP' },
        { id: 'zero', label: 'ZeRO partitioned' },
      ],
      [
        ['every rank pays full', 'stage 3 shards'],
        ['every rank pays full', 'stage 1 shards'],
        ['every rank pays full', 'stage 1 shards'],
        ['every rank pays full', 'stage 1 shards'],
        ['every rank pays full', 'stage 2 shards'],
      ],
    ),
    highlight: { active: ['adam1:zero', 'adam2:zero', 'grads:zero'], found: ['fp16:zero'] },
    explanation: `The optimizer memory budget is wider than the visible model weights. ZeRO matters because across ${stages} stages it attacks the hidden copies: master weights, moments, gradients, and sometimes the parameters themselves.`,
  };
}

function* stepChoreography() {
  const numRanks = 3;
  const tradeoffs = 4;
  yield {
    state: shardGraph('Forward gathers parameter shards just in time'),
    highlight: { active: ['params', 'collective', 'e-params-collective'], found: ['r0', 'r1', 'r2'] },
    explanation: `Read the parameter node as sharded at rest, not permanently replicated. In ZeRO stage 3, ${numRanks} ranks all-gather shards just before a layer runs, compute, then release full copies as soon as possible.`,
  };

  yield {
    state: shardGraph('Backward reduce-scatters gradients to owners'),
    highlight: { active: ['grads', 'collective', 'e-grads-collective'], found: ['r0', 'r1', 'r2'] },
    explanation: `During backward, gradients can be reduce-scattered instead of fully all-reduced across all ${numRanks} ranks. The owning rank receives the reduced shard it needs for the optimizer update.`,
  };

  yield {
    state: shardGraph('Optimizer step happens on owned shards'),
    highlight: { active: ['adam', 'r0', 'r1', 'r2'], compare: ['params'], found: ['collective'] },
    explanation: `Each rank updates only the parameter shard it owns using its local optimizer-state shard. The logical optimizer is global; the physical state is split across ${numRanks} ranks.`,
  };

  yield {
    state: labelMatrix(
      'Operational tradeoffs',
      [
        { id: 'buckets', label: 'bucket sizing' },
        { id: 'overlap', label: 'overlap comm' },
        { id: 'offload', label: 'offload' },
        { id: 'checkpoint', label: 'checkpointing' },
      ],
      [
        { id: 'helps', label: 'helps' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['controls peak gather memory', 'tuning complexity'],
        ['hides network behind compute', 'more scheduling state'],
        ['frees GPU memory', 'PCIe/NVMe latency'],
        ['saves activations', 'extra recompute'],
      ],
    ),
    highlight: { found: ['buckets:helps', 'overlap:helps'], active: ['offload:cost', 'checkpoint:cost'] },
    explanation: `ZeRO is a memory system, not a single flag. The ${tradeoffs} operational tradeoffs â€” bucket sizes, overlap, offload, and checkpointing â€” decide whether the saved memory becomes useful throughput or just a slower job.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'stage ladder') yield* stageLadder();
  else if (view === 'step choreography') yield* stepChoreography();
  else throw new InputError('Pick a ZeRO Optimizer view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read each column as one data-parallel rank, which means one worker holding a replica or shard of the training job. Active cells show the memory category being changed, and found cells show state that now rests on only one rank instead of every rank.',
        {type: 'callout', text: 'ZeRO saves memory by changing where training state rests, not by changing the data-parallel math.'},
        'The communication view shows when full tensors are temporarily needed. All-gather means ranks collect shards to reconstruct a full tensor, reduce-scatter means ranks combine gradients and keep only their owned shard, and shard means one slice of a larger tensor.',
        'The safe reading rule is that computation may see full parameters, but storage at rest can be partitioned. Watch the animation separate those two moments: gather before a layer uses weights, scatter after gradients are produced, and update only the owned optimizer state.',
        {type: 'image', src: './assets/gifs/zero-optimizer.gif', alt: 'Animated walkthrough of the zero optimizer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'ZeRO, the Zero Redundancy Optimizer, exists because large-model training often runs out of GPU memory before it runs out of arithmetic. Ordinary data parallelism replicates the model on every GPU, so each rank stores the same parameters, gradients, and optimizer state.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg',
          alt: 'Layered neural network diagram with colored nodes and connections',
          caption: 'The model graph is logically replicated under data parallelism; ZeRO changes the placement of training state around that graph. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Colored_neural_network.svg.',
        },
        'The largest hidden bill is optimizer state. Adam stores first-moment and second-moment tensors for every parameter, and many mixed-precision systems also store fp32 master weights for stable updates.',
        'Adding more GPUs increases total cluster memory, but naive data parallelism does not lower the memory each GPU must hold. ZeRO keeps the data-parallel training behavior while removing redundant copies from the per-rank ledger.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is ordinary data parallelism. Each GPU gets a different micro-batch, computes gradients, all-reduces those gradients, and applies the same optimizer update to a full local copy of the model.',
        'This is a good default because it is simple and preserves the training math. The result is close to training one model on a larger batch, as long as the optimizer and learning-rate schedule are configured for that batch.',
        'When memory is tight, the next obvious tools are smaller micro-batches, mixed precision, and activation checkpointing. They help, but they do not directly remove the duplicated Adam moments and master weights carried by every rank.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is per-GPU memory. A 7-billion-parameter model with fp16 parameters needs about 14 GB for the fp16 weights, 28 GB for fp32 master weights, 28 GB for Adam first moments, 28 GB for Adam second moments, and 14 GB for gradients.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Nvidia_GV100_GPU.png',
          alt: 'Nvidia GV100 GPU die showing many compute units on one chip',
          caption: 'Large-model training runs out of accelerator memory before it runs out of arithmetic desire; ZeRO attacks the replicated state that occupies that scarce device memory. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Nvidia_GV100_GPU.png.',
        },
        'That is roughly 112 GB of training state per rank before activations, temporary buffers, communication buckets, and framework overhead. Eight GPUs provide far more total memory, but ordinary data parallelism still asks each one to hold the same 112 GB state block.',
        'Model parallelism can split the model, but it changes the program shape and introduces pipeline or tensor communication inside the model graph. ZeRO attacks a different redundancy: replicated data-parallel state that can be owned by shards without changing the logical optimizer step.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that equal training math does not require equal physical storage. If rank 2 owns a parameter shard, it can also own that shard\'s optimizer state and receive the reduced gradient for that shard.',
        'ZeRO stage 1 shards optimizer state, stage 2 shards optimizer state and gradients, and stage 3 shards optimizer state, gradients, and parameters. Each stage moves another memory row from replicated storage to partitioned storage.',
        'The model still behaves like data parallel training because each parameter receives the same combined gradient and the same optimizer formula. The placement changes, not the objective function or the algebra of Adam.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'In stage 1, every rank still has full parameters and full gradients, but optimizer state is partitioned. After gradients are synchronized, each owner rank updates only its assigned slice of fp32 master weights and Adam moments.',
        'In stage 2, the all-reduce is replaced by reduce-scatter. Gradient contributions are still summed across ranks, but each rank keeps only the reduced shard it owns instead of a full gradient copy.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg',
          alt: 'Directed graph with nodes connected by arrows',
          caption: 'Collectives are graph traffic: the training algorithm is correct only when gradient and parameter shards reach the ranks that need them at the right phase. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.',
        },
        'In stage 3, parameters are sharded at rest too. Before a layer runs, ranks all-gather the parameter shards needed for that layer, compute with the reconstructed tensor, then release the full copy when it is no longer needed.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on matching each unsharded operation with an equivalent sharded operation. In ordinary data parallelism, all ranks combine gradient contributions for every parameter and then apply the optimizer formula to every parameter.',
        'ZeRO still combines the same gradient contributions. Stage 2 leaves each combined gradient shard on its owner, and stage 1 or 2 applies the same Adam update to that shard using the matching optimizer state.',
        'Stage 3 is correct when each layer sees the same parameter values during forward and backward that it would see in the full model. All-gather provides that temporary full view, and discarding it afterward only changes storage, not the computed activations or gradients.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'ZeRO trades memory for communication and scheduling. Stage 1 usually has the smallest communication change, stage 2 adds reduce-scatter behavior, and stage 3 adds parameter all-gathers that can land on the critical path.',
        'If a tensor has p bytes across N ranks, a ring all-gather moves about p * (N - 1) / N bytes per rank. A reduce-scatter has a similar bandwidth shape for the gradient shard, while a full all-reduce is roughly twice that because it combines reduce-scatter and all-gather.',
        'The behavior changes when input size doubles through model size, not through rank count alone. Doubling parameters doubles parameter, gradient, and optimizer-state bytes; increasing ranks divides sharded rows but does not divide activations or temporary full tensors.',
        'The practical cost is exposed stalls when communication cannot overlap with compute. Bucket size, prefetch timing, interconnect bandwidth, CPU or NVMe offload, checkpointing, and memory fragmentation decide whether the memory win becomes a faster job or just a job that finally fits.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'ZeRO is used in large language model pretraining when optimizer state is the binding memory constraint. A team can keep the data-parallel loop while moving Adam moments and master weights out of full replication.',
        'Fine-tuning and reinforcement learning from feedback often use stage 2 or stage 3 because the base model is already large and batch sizes are constrained by context length. ZeRO lets the job fit without manually splitting every layer into tensor-parallel pieces.',
        'PyTorch Fully Sharded Data Parallel uses a closely related pattern. It shards parameters at rest, all-gathers them for computation, and reduce-scatters gradients, so the design choice is often a framework and ecosystem choice rather than a different memory principle.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'ZeRO does not solve activation memory by itself. Long sequences, large image batches, or deep networks may still need activation checkpointing, sequence parallelism, smaller micro-batches, or architecture changes.',
        'It also does not replace tensor or pipeline parallelism when one layer is too large or too slow for a single rank to compute efficiently. ZeRO shards storage around data parallelism, while tensor and pipeline parallelism split the model computation itself.',
        'Slow interconnect can erase the benefit of stage 3. If parameter all-gathers are exposed every layer and cannot overlap with useful compute, the training step may fit in memory but run too slowly to be a good configuration.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take a model with 1 billion fp16 parameters trained with Adam on 4 GPUs. The fp16 parameters take 2 GB, fp32 master weights take 4 GB, first moments take 4 GB, second moments take 4 GB, and gradients take 2 GB.',
        'Without ZeRO, each rank stores all five rows: 2 + 4 + 4 + 4 + 2 = 16 GB. The cluster stores 64 GB of training state, but three quarters of it is redundant copies across ranks.',
        'Stage 1 shards the three optimizer rows across 4 ranks. Each rank stores 2 GB fp16 parameters, 2 GB gradients, and 1 GB each for master weights, first moments, and second moments, for 7 GB per rank.',
        'Stage 2 shards gradients too, so gradients fall from 2 GB to 0.5 GB per rank and the total becomes 5.5 GB. Stage 3 shards fp16 parameters at rest, so parameters fall from 2 GB to 0.5 GB per rank and the resting total becomes 4 GB, with all-gather traffic added before computation.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Rajbhandari et al., ZeRO: Memory Optimizations Toward Training Trillion Parameter Models, 2020, https://arxiv.org/abs/1910.02054. For collective communication, study Patarasuk and Yuan, Bandwidth Optimal All-reduce Algorithms for Clusters of Workstations, 2009.',
        'Study data parallel training, Adam optimizer state, all-reduce, reduce-scatter, and all-gather before treating ZeRO as a configuration system. Without those terms, the stage ladder looks like names instead of memory accounting.',
        'Study Fully Sharded Data Parallel next for a production implementation of the same idea. Then compare tensor parallelism, pipeline parallelism, activation checkpointing, and sequence parallelism to see which bottleneck each technique actually removes.',
      ],
    },
  ],
};
