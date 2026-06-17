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
    explanation: 'Read each column as one data-parallel rank. The repeated "full copy" cells are the redundancy ZeRO removes; Adam-style optimizer states can be several times larger than the visible model weights.',
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
    explanation: 'ZeRO climbs by removing redundancy. Stage 1 shards optimizer states. Stage 2 shards gradients too. Stage 3 shards parameters as well, gathering shards only around the computation that needs them.',
    invariant: 'The model is logically replicated; the expensive training state is physically partitioned.',
  };

  yield {
    state: shardGraph('ZeRO replaces full copies with owned shards'),
    highlight: { active: ['r0', 'r1', 'r2', 'collective'], found: ['adam', 'grads', 'params'] },
    explanation: 'Each rank becomes responsible for a slice of the state. Collectives move just enough data at each phase so computation still sees the values it needs while long-lived memory stays sharded.',
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
    explanation: 'The optimizer memory budget is wider than the visible model weights. ZeRO matters because it attacks the hidden copies: master weights, moments, gradients, and sometimes the parameters themselves.',
  };
}

function* stepChoreography() {
  yield {
    state: shardGraph('Forward gathers parameter shards just in time'),
    highlight: { active: ['params', 'collective', 'e-params-collective'], found: ['r0', 'r1', 'r2'] },
    explanation: 'Read the parameter node as sharded at rest, not permanently replicated. In ZeRO stage 3, ranks all-gather shards just before a layer runs, compute, then release full copies as soon as possible.',
  };

  yield {
    state: shardGraph('Backward reduce-scatters gradients to owners'),
    highlight: { active: ['grads', 'collective', 'e-grads-collective'], found: ['r0', 'r1', 'r2'] },
    explanation: 'During backward, gradients can be reduce-scattered instead of fully all-reduced everywhere. The owning rank receives the reduced shard it needs for the optimizer update.',
  };

  yield {
    state: shardGraph('Optimizer step happens on owned shards'),
    highlight: { active: ['adam', 'r0', 'r1', 'r2'], compare: ['params'], found: ['collective'] },
    explanation: 'Each rank updates only the parameter shard it owns using its local optimizer-state shard. The logical optimizer is global; the physical state is split across ranks.',
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
    explanation: 'ZeRO is a memory system, not a single flag. Bucket sizes, overlap, offload, checkpointing, and topology decide whether the saved memory becomes useful throughput or just a slower job.',
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
      heading: 'Why this exists',
      paragraphs: [
        `ZeRO exists because ordinary data parallel training wastes memory in the exact place large models run out first. In classic data parallelism, every GPU rank stores a full copy of parameters, gradients, and optimizer state. The ranks cooperate to train one logical model, but physically they all carry the same expensive state. Adding more data-parallel GPUs improves sample throughput, yet each GPU still needs enough memory for the full model state.`,
        `For Adam-style training, the visible model weights are only part of the bill. A system may store bf16 or fp16 parameters for forward and backward, fp32 master parameters for stable updates, first-moment estimates, second-moment estimates, gradients, communication buckets, temporary buffers, and activations. Optimizer state alone can be several times the parameter size. ZeRO, the Zero Redundancy Optimizer, keeps the data-parallel programming model while partitioning redundant state across ranks so each GPU owns only a shard at rest.`,
      ],
    },
    {
      heading: 'The reasonable first attempt',
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
      heading: 'Mechanism',
      paragraphs: [
        `Stage 1 leaves parameters and gradients replicated but shards the optimizer states. With Adam, each rank owns only a slice of the first moments, second moments, and master weights. After gradients are synchronized, the owner updates its shard. This removes a large memory row with relatively limited disruption. Stage 2 also shards gradients. Instead of all-reduce leaving every rank with a full gradient copy, reduce-scatter combines contributions and leaves each rank with the reduced shard it owns.`,
        `Stage 3 shards parameters as well. During forward and backward, a layer's parameters are all-gathered when needed so computation can proceed. After use, full parameters can be released and returned to sharded storage. Gradients flow back to owners, and optimizer updates happen on shards. Bucket sizes, prefetch timing, overlap with compute, communication topology, and offload policy decide whether the extra collectives are hidden or exposed as step-time stalls. Fully Sharded Data Parallel follows a closely related sharded-state pattern in PyTorch.`,
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        `The stage ladder proves that the stages are not arbitrary names. Each step removes one more replicated category from the per-rank memory bill. Baseline data parallelism stores full parameters, full gradients, and full optimizer state everywhere. Stage 1 removes optimizer-state replication. Stage 2 removes gradient replication. Stage 3 removes parameter replication at rest. The visual makes the memory accounting explicit instead of treating "distributed training" as one undifferentiated technique.`,
        `The choreography view proves the deeper invariant: full tensors exist only when computation requires them. Parameters are gathered just before use, gradients are reduced into owner shards, and optimizer updates occur where the relevant state lives. That timing is the difference between saving memory and breaking training. If a layer needs full weights for a matrix multiply, they must be present. If an optimizer updates only a shard, it must have the matching gradient shard and optimizer state. ZeRO works by making those temporary materializations precise.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `ZeRO works because it preserves the algebra of data parallelism while changing storage layout. In ordinary data parallelism, every rank computes gradients for its micro-batch and the system combines them into the same global gradient. ZeRO still combines gradient contributions for each parameter; it simply leaves the combined result on the rank that owns that parameter shard. The optimizer update for that shard uses the same formula it would have used on a full replica, just applied to the owned slice.`,
        `For parameter sharding, correctness depends on just-in-time reconstruction. A layer's computation sees the parameter values it would have seen in the unsharded model. After computation, the full copy is no longer needed everywhere, so it can be discarded. Across all shards, the logical model remains complete. The sharding is a physical placement strategy, not a change to the objective function. That is why ZeRO can fit larger models without asking the user to manually rewrite every layer as a tensor-parallel program.`,
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        `The trade is memory for communication, scheduling complexity, and sometimes recompute or transfer latency. Stage 1 usually gives a large optimizer-state memory win with the smallest communication change. Stage 2 adds gradient sharding and makes bucket sizing and reduce-scatter behavior important. Stage 3 saves the most memory but puts parameter all-gathers and prefetch timing on the critical path unless overlap is effective. Offload can move optimizer state, parameters, or both to CPU or NVMe, but then PCIe, CPU memory bandwidth, or storage latency becomes part of the training step.`,
        `The practical rule is to choose the lowest stage that fits while preserving throughput. A configuration that merely avoids OOM is not automatically the best training plan. Measure peak memory, step time, communication time, exposed stalls, GPU utilization, checkpoint cost, and recovery behavior. Keep the memory ledger explicit: low-precision weights, master weights, Adam moments, gradients, activations, temporary buffers, communication buckets, fragmentation, and framework overhead. ZeRO solves only the rows it shards.`,
      ],
    },
    {
      heading: 'Uses and failure modes',
      paragraphs: [
        `ZeRO is common in large language model pretraining, fine-tuning, reinforcement learning from feedback, multimodal model training, and any workload where optimizer state blocks scale. It is attractive when teams want the ergonomics of data parallelism while training a model too large for fully replicated state. It also provides a mental bridge to Fully Sharded Data Parallel: both rely on sharded resting state plus carefully timed collectives.`,
        `It fails when the next bottleneck is somewhere else. ZeRO does not automatically reduce activation memory; activation checkpointing, sequence parallelism, shorter contexts, smaller micro-batches, or architecture changes may still be needed. It does not eliminate the need for tensor or pipeline parallelism when a single layer is too large or too slow. Poor bucket sizes can increase memory spikes or communication stalls. Slow interconnect can erase the benefit of stage 3. Offload can turn a GPU OOM into an intolerably slow job. Debugging also gets harder because full state may be transient, sharded, or off-device.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources are the ZeRO paper at https://arxiv.org/abs/1910.02054, DeepSpeed ZeRO documentation at https://deepspeed.readthedocs.io/en/latest/zero3.html, and the DeepSpeed ZeRO tutorial at https://www.deepspeed.ai/tutorials/zero/. Study GPU All-Reduce first so all-reduce, reduce-scatter, and all-gather are concrete. Then read Activation Checkpointing for the activation-memory row, Batch Size Scaling for optimization effects, Tensor Parallelism and Pipeline Parallelism for splitting computation, Fully Sharded Data Parallel for a closely related implementation style, and Parameter Server Case Study for an older contrast in distributed optimizer-state ownership.`,
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        `Start with a memory breakdown before selecting a stage. If Adam states dominate, stage 1 may be enough. If gradients dominate peak memory after backward, stage 2 may be the right fit. If parameters themselves block the job, stage 3 becomes necessary. Then tune bucket sizes and overlap under the actual model, sequence length, micro-batch, interconnect, and checkpoint plan. The best ZeRO configuration is a measured balance between fitting the model and keeping the training step productive.`,
      ],
    },
  ],
};
