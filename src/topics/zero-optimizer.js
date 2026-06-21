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
    explanation: `ZeRO is a memory system, not a single flag. The ${tradeoffs} operational tradeoffs — bucket sizes, overlap, offload, and checkpointing — decide whether the saved memory becomes useful throughput or just a slower job.`,
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
        "The stage ladder view shows a matrix where each column is a data-parallel rank and each row is a memory category. Active cells highlight the redundancy ZeRO removes at each stage. Found cells mark sharded state that now lives on only one rank. Read each stage transition as one more row moving from replicated to partitioned.",
        {type: "callout", text: "ZeRO saves memory by changing where training state rests, not by changing the data-parallel math."},
        "The step choreography view shows the communication graph: ranks on the left, memory categories in the center, collectives on the right. Active edges show which collective is running. Watch parameters get all-gathered before computation, gradients get reduce-scattered to owners after backward, and optimizer updates happen on local shards. The key question at each frame: does this rank hold a full copy or just its shard?",
      
        {type: 'image', src: './assets/gifs/zero-optimizer.gif', alt: 'Animated walkthrough of the zero optimizer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `ZeRO exists because ordinary data parallel training wastes memory in the exact place large models run out first. In classic data parallelism, every GPU rank stores a full copy of parameters, gradients, and optimizer state. The ranks cooperate to train one logical model, but physically they all carry the same expensive state. Adding more data-parallel GPUs improves sample throughput, yet each GPU still needs enough memory for the full model state.`,
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg',
          alt: 'Layered neural network diagram with colored nodes and connections',
          caption: 'The model graph is logically replicated under data parallelism; ZeRO changes the placement of training state around that graph. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Colored_neural_network.svg.',
        },
        `For Adam-style training, the visible model weights are only part of the bill. A system may store bf16 or fp16 parameters for forward and backward, fp32 master parameters for stable updates, first-moment estimates, second-moment estimates, gradients, communication buckets, temporary buffers, and activations. Optimizer state alone can be several times the parameter size. ZeRO, the Zero Redundancy Optimizer, keeps the data-parallel programming model while partitioning redundant state across ranks so each GPU owns only a shard at rest.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The first attempt is to add more GPUs with ordinary data parallelism. Each rank processes a different micro-batch, gradients are all-reduced, and every rank applies the same optimizer update. This is simple, robust, and mathematically close to single-replica training with a larger batch. Its wall is per-rank memory. If one GPU cannot hold the full parameters, gradients, optimizer states, activations, and temporary buffers, adding more identical replicas does not fix the local out-of-memory failure.`,
        `The second attempt is to reduce batch size, use lower precision, or checkpoint activations. These are valid tools, but they attack different rows of the memory ledger. Smaller micro-batches reduce activation memory and may hurt throughput or optimization behavior. Mixed precision reduces some tensor sizes but often keeps fp32 master weights and optimizer moments. Activation checkpointing trades memory for recompute. If optimizer state is the dominant row, those tools may still leave every rank carrying duplicated Adam moments. ZeRO targets that redundancy directly.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is that data-parallel ranks need the same logical training result, not the same physical ownership of every tensor at all times. Optimizer states can be partitioned because each parameter shard has a clear owner for its update. Gradients can be reduced into shards instead of replicated everywhere. Parameters can be gathered just in time for computation and released afterward. The model behaves like data parallel training, but its resting state is sharded.`,
        `DeepSpeed describes the ladder in three stages. Stage 1 partitions optimizer state. Stage 2 partitions optimizer state and gradients. Stage 3 partitions optimizer state, gradients, and parameters. The memory savings increase as more categories stop being replicated, but communication and scheduling complexity also increase. ZeRO is therefore not one magic flag. It is a staged memory system with collectives arranged around the forward pass, backward pass, and optimizer step.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Stage 1 leaves parameters and gradients replicated but shards the optimizer states. With Adam, each rank owns only a slice of the first moments, second moments, and master weights. After gradients are synchronized, the owner updates its shard. This removes a large memory row with relatively limited disruption. Stage 2 also shards gradients. Instead of all-reduce leaving every rank with a full gradient copy, reduce-scatter combines contributions and leaves each rank with the reduced shard it owns.`,
        `Stage 3 shards parameters as well. During forward and backward, a layer\'s parameters are all-gathered when needed so computation can proceed. After use, full parameters can be released and returned to sharded storage. Gradients flow back to owners, and optimizer updates happen on shards. Bucket sizes, prefetch timing, overlap with compute, communication topology, and offload policy decide whether the extra collectives are hidden or exposed as step-time stalls. Fully Sharded Data Parallel follows a closely related sharded-state pattern in PyTorch.`,
      ],
    },
    {
      heading: 'Reading the two views',
      paragraphs: [
        `The stage ladder proves that the stages are not arbitrary names. Each step removes one more replicated category from the per-rank memory bill. Baseline data parallelism stores full parameters, full gradients, and full optimizer state everywhere. Stage 1 removes optimizer-state replication. Stage 2 removes gradient replication. Stage 3 removes parameter replication at rest. The visual makes the memory accounting explicit instead of treating "distributed training" as one undifferentiated technique.`,
        `The choreography view proves the deeper invariant: full tensors exist only when computation requires them. Parameters are gathered just before use, gradients are reduced into owner shards, and optimizer updates occur where the relevant state lives. That timing is the difference between saving memory and breaking training. If a layer needs full weights for a matrix multiply, they must be present. If an optimizer updates only a shard, it must have the matching gradient shard and optimizer state. ZeRO works by making those temporary materializations precise.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `ZeRO works because it preserves the algebra of data parallelism while changing storage layout. In ordinary data parallelism, every rank computes gradients for its micro-batch and the system combines them into the same global gradient. ZeRO still combines gradient contributions for each parameter; it simply leaves the combined result on the rank that owns that parameter shard. The optimizer update for that shard uses the same formula it would have used on a full replica, just applied to the owned slice.`,
        `For parameter sharding, correctness depends on just-in-time reconstruction. A layer\'s computation sees the parameter values it would have seen in the unsharded model. After computation, the full copy is no longer needed everywhere, so it can be discarded. Across all shards, the logical model remains complete. The sharding is a physical placement strategy, not a change to the objective function. That is why ZeRO can fit larger models without asking the user to manually rewrite every layer as a tensor-parallel program.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `The trade is memory for communication, scheduling complexity, and sometimes recompute or transfer latency. Stage 1 usually gives a large optimizer-state memory win with the smallest communication change. Stage 2 adds gradient sharding and makes bucket sizing and reduce-scatter behavior important. Stage 3 saves the most memory but puts parameter all-gathers and prefetch timing on the critical path unless overlap is effective. Offload can move optimizer state, parameters, or both to CPU or NVMe, but then PCIe, CPU memory bandwidth, or storage latency becomes part of the training step.`,
        `The practical rule is to choose the lowest stage that fits while preserving throughput. A configuration that merely avoids OOM is not automatically the best training plan. Measure peak memory, step time, communication time, exposed stalls, GPU utilization, checkpoint cost, and recovery behavior. Keep the memory ledger explicit: low-precision weights, master weights, Adam moments, gradients, activations, temporary buffers, communication buckets, fragmentation, and framework overhead. ZeRO solves only the rows it shards.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `ZeRO is common in large language model pretraining, fine-tuning, reinforcement learning from feedback, multimodal model training, and any workload where optimizer state blocks scale. It is attractive when teams want the ergonomics of data parallelism while training a model too large for fully replicated state. It also provides a mental bridge to Fully Sharded Data Parallel: both rely on sharded resting state plus carefully timed collectives.`,
        `It fails when the next bottleneck is somewhere else. ZeRO does not automatically reduce activation memory; activation checkpointing, sequence parallelism, shorter contexts, smaller micro-batches, or architecture changes may still be needed. It does not eliminate the need for tensor or pipeline parallelism when a single layer is too large or too slow. Poor bucket sizes can increase memory spikes or communication stalls. Slow interconnect can erase the benefit of stage 3. Offload can turn a GPU OOM into an intolerably slow job. Debugging also gets harder because full state may be transient, sharded, or off-device.`,
      ],
    },
    {
      heading: 'Choosing a stage',
      paragraphs: [
        `Start with a memory breakdown before selecting a stage. If Adam states dominate, stage 1 may be enough. If gradients dominate peak memory after backward, stage 2 may be the right fit. If parameters themselves block the job, stage 3 becomes necessary. Then tune bucket sizes and overlap under the actual model, sequence length, micro-batch, interconnect, and checkpoint plan. The best ZeRO configuration is a measured balance between fitting the model and keeping the training step productive.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is per-GPU memory, not compute. A 7-billion-parameter model in mixed-precision Adam training stores fp16 parameters (14 GB), fp32 master weights (28 GB), first moments (28 GB), second moments (28 GB), and gradients (14 GB). That is roughly 112 GB of training state per rank in naive data parallelism, even though 8 ranks together have 8x the total memory. Every rank carries the same 112 GB. Adding GPUs speeds up data throughput but does not reduce the per-rank memory floor.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Nvidia_GV100_GPU.png',
          alt: 'Nvidia GV100 GPU die showing many compute units on one chip',
          caption: 'Large-model training runs out of accelerator memory before it runs out of arithmetic desire; ZeRO attacks the replicated state that occupies that scarce device memory. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Nvidia_GV100_GPU.png.',
        },
        'Model parallelism (splitting layers across GPUs) avoids this duplication, but it forces pipeline bubbles, careful layer assignment, and custom communication patterns. Pipeline parallelism (Huang et al., 2019, GPipe) fills bubbles with micro-batches, but still requires the programmer to partition the model graph. Tensor parallelism splits individual operations across GPUs, but demands high-bandwidth interconnects because partial results must be combined inside every layer. ZeRO hits a different point: it keeps the simple data-parallel programming model while attacking the storage redundancy that makes per-rank memory the bottleneck.',
      ],
    },
    {
      heading: 'Data parallelism, model parallelism, and pipeline parallelism',
      paragraphs: [
        'Data parallelism replicates the model on every GPU and splits the training data. Each rank computes gradients on its micro-batch, then all ranks synchronize gradients via all-reduce. The result is mathematically equivalent to a single large batch. The cost is that every rank must hold the full model state. This is the simplest distributed strategy and the one ZeRO extends.',
        'Model parallelism splits the model itself. Tensor parallelism (Megatron-LM style) partitions weight matrices within a layer: each GPU computes part of a matrix multiply, then an all-reduce or all-gather combines partial outputs. This requires fast interconnect because communication happens inside every forward and backward step. Pipeline parallelism (Huang et al., 2019) partitions the model by layers: GPU 0 runs layers 1-10, GPU 1 runs layers 11-20, and so on. Micro-batches flow through the pipeline to fill idle stages. The bubble fraction -- time a stage sits idle waiting for inputs -- is roughly (P-1)/M where P is the number of pipeline stages and M is the number of micro-batches.',
        'These strategies compose. A large training job might use tensor parallelism within a node (where NVLink provides high bandwidth), pipeline parallelism across nodes (where network bandwidth is lower), and data parallelism across pipeline replicas (to scale batch throughput). ZeRO fits into the data-parallel dimension of this composition, reducing per-rank memory without changing how tensor or pipeline parallelism divide the model.',
      ],
    },
    {
      heading: 'Ring all-reduce and communication cost',
      paragraphs: [
        'All-reduce is the primitive that makes data parallelism work: N ranks each hold a local gradient vector of size p, and after all-reduce every rank holds the element-wise sum. A naive implementation sends every vector to one root, sums them, and broadcasts the result. That puts 2p bytes through the root and serializes all communication.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg',
          alt: 'Directed graph with nodes connected by arrows',
          caption: 'Collectives are graph traffic: the training algorithm is correct only when gradient and parameter shards reach the ranks that need them at the right phase. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.',
        },
        'Ring all-reduce (Patarasuk and Yuan, 2009) eliminates the bottleneck. Arrange N ranks in a logical ring. In the reduce-scatter phase, each rank sends one chunk of size p/N to its neighbor in N-1 steps; after each step the receiving rank adds the incoming chunk to its local chunk. After N-1 steps, each rank holds the fully reduced version of one chunk. In the all-gather phase, each rank sends its fully reduced chunk around the ring in another N-1 steps so every rank ends up with the complete sum.',
        'The total data each rank sends is 2 * p * (N-1)/N bytes. As N grows, this approaches 2p per rank regardless of how many GPUs participate. The communication volume is bandwidth-optimal: no algorithm can do better for a flat all-reduce. Latency scales as O(N) because messages pass through N-1 hops, but for large p the bandwidth term dominates. ZeRO stage 2 replaces the all-reduce with a reduce-scatter (half the ring), saving memory because each rank keeps only its owned shard of the reduced gradient.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'DeepSpeed ZeRO powers large language model pretraining where optimizer memory is the binding constraint. A team with 64 GPUs and a 13B-parameter model can use ZeRO stage 1 to shard Adam states across ranks, dropping per-rank optimizer memory from ~100 GB to ~1.6 GB while keeping the simple data-parallel training loop. Fine-tuning and RLHF workloads use ZeRO stage 2 or 3 to fit models that exceed single-GPU memory without rewriting the model for tensor parallelism.',
        'PyTorch Fully Sharded Data Parallel (FSDP) implements a closely related sharded-state pattern. It wraps model units in FSDP containers that shard parameters at rest and all-gather them before computation. FSDP and ZeRO stage 3 solve the same problem with different APIs; choosing between them is usually a framework decision, not an algorithmic one.',
        'Multimodal training (vision-language models, speech-language models) benefits because these models often have large embedding tables and multiple encoders whose optimizer states add up. Research groups routinely combine ZeRO with gradient checkpointing and mixed precision to fit models an order of magnitude larger than what a single GPU can hold, without leaving the data-parallel programming model.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a model with 1 billion fp16 parameters (2 GB) trained with Adam across 4 GPUs. Without ZeRO, each rank stores: fp16 params (2 GB), fp32 master params (4 GB), first moment (4 GB), second moment (4 GB), gradients (2 GB) = 16 GB per rank. Total system memory: 64 GB, but 48 GB is redundant copies.',
        'ZeRO stage 1 shards optimizer state. Each rank still stores full fp16 params (2 GB) and full gradients (2 GB), but owns only 1/4 of the master params (1 GB), first moment (1 GB), and second moment (1 GB). Per-rank total: 2 + 2 + 1 + 1 + 1 = 7 GB. Savings: 9 GB per rank, 36 GB system-wide.',
        'ZeRO stage 2 also shards gradients. After backward, reduce-scatter gives each rank only its owned gradient shard (0.5 GB instead of 2 GB). Per-rank total: 2 + 0.5 + 1 + 1 + 1 = 5.5 GB.',
        'ZeRO stage 3 shards parameters too. At rest, each rank holds 0.5 GB of fp16 params. Before a layer runs, an all-gather reconstructs full parameters temporarily. Per-rank resting total: 0.5 + 0.5 + 1 + 1 + 1 = 4 GB. The 16 GB per-rank bill dropped to 4 GB, a 4x reduction. The cost is additional all-gather traffic: each forward and backward pass must gather parameter shards for every layer. With 4 ranks and 2 GB of params, each all-gather moves 2 * (4-1)/4 = 1.5 GB per rank per layer pass.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The primary source is Rajbhandari et al., "ZeRO: Memory Optimizations Toward Training Trillion Parameter Models" (2020, https://arxiv.org/abs/1910.02054). For ring all-reduce, see Patarasuk and Yuan, "Bandwidth Optimal All-reduce Algorithms for Clusters of Workstations" (2009). For pipeline parallelism, see Huang et al., "GPipe: Efficient Training of Giant Neural Networks using Pipeline Parallelism" (2019, https://arxiv.org/abs/1811.06965). For tensor parallelism, see Shoeybi et al., "Megatron-LM" (2020, https://arxiv.org/abs/1909.08053).',
        'Prerequisite: study GPU All-Reduce so all-reduce, reduce-scatter, and all-gather are concrete operations, not abstract names. Extension: study Fully Sharded Data Parallel (FSDP) for the PyTorch implementation of the same sharding idea. Contrast: study Tensor Parallelism and Pipeline Parallelism to understand when splitting the model graph is necessary instead of sharding replicated state. For the activation-memory row that ZeRO does not address, study Activation Checkpointing.',
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic: understand data-parallel training (replicate model, split data, all-reduce gradients), Adam optimizer mechanics (master weights, first and second moments), and collective communication primitives (all-reduce, reduce-scatter, all-gather). Without these, ZeRO\'s stage ladder will feel like arbitrary configuration instead of a principled memory decomposition.',
        'After this topic: trace how ZeRO composes with tensor parallelism (intra-layer splits), pipeline parallelism (inter-layer splits), and sequence parallelism (activation sharding along the sequence dimension). The full picture of large-model training is a 3D or 4D parallelism grid where each axis addresses a different bottleneck.',
      ],
    },
    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you list the five memory categories (fp16 params, fp32 master, m, v, gradients) and say which ZeRO stage shards each one?',
            'Can you compute the per-rank memory for a 2B-param Adam model on 8 GPUs at each ZeRO stage?',
            'Can you explain why reduce-scatter replaces all-reduce at stage 2 and what memory it saves?',
            'Can you state the ring all-reduce bandwidth cost formula and explain why it is optimal?',
            'Can you describe when ZeRO is insufficient and tensor or pipeline parallelism becomes necessary?',
          ],
        },
      ],
    },
    {
      heading: 'Try this now',
      paragraphs: [
        'Take a model size (say 3B parameters) and a GPU count (say 8). Write down the per-rank memory at each ZeRO stage assuming Adam with fp16 forward params and fp32 master weights. Then compute the all-gather communication volume for one forward pass at stage 3. Verify your numbers match the formula: each rank sends p * (N-1)/N bytes per all-gather. If your memory estimates and communication costs are consistent, you understand the tradeoff space.',
      ],
    },
  ],
};
