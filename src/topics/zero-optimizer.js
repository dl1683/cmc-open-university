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
    explanation: 'Classic data parallelism replicates the model and optimizer state on every rank. That is simple, but Adam-style optimizer states can be several times larger than the model weights.',
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
    explanation: 'In ZeRO stage 3, parameters are partitioned when idle. Before a layer runs, ranks all-gather the shards needed for that layer, compute, then release full copies as soon as possible.',
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
      heading: 'What it is',
      paragraphs: [
        'ZeRO means Zero Redundancy Optimizer. It is a distributed training strategy that removes duplicated training state across data-parallel GPUs. Ordinary data parallelism replicates parameters, gradients, and optimizer states on every rank. ZeRO keeps the logical behavior of data parallel training, but partitions the expensive state so each rank owns only a shard.',
        'DeepSpeed documents the stage ladder directly: stage 1 partitions optimizer state, stage 2 partitions optimizer plus gradient state, and stage 3 partitions optimizer, gradient, and parameter state: https://deepspeed.readthedocs.io/en/latest/zero3.html. The ZeRO paper frames the same idea as eliminating memory redundancies while retaining low communication volume and high computational granularity: https://arxiv.org/abs/1910.02054.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Stage 1 attacks optimizer memory. Adam keeps first moments, second moments, and often fp32 master weights. Those states can dwarf the visible fp16 model weights. Instead of storing full Adam state on every GPU, ZeRO partitions it across data-parallel ranks. Stage 2 adds gradient partitioning, often using reduce-scatter so each rank receives the reduced gradient shard it owns. Stage 3 partitions parameters too, all-gathering layer parameters just in time for computation and releasing them afterward.',
        'This is why ZeRO depends on collectives. GPU All-Reduce teaches the simplest collective contract, but ZeRO frequently wants reduce-scatter and all-gather. Reduce-scatter combines gradient contributions and leaves each rank with one reduced shard. All-gather reconstructs needed parameter shards temporarily. The optimizer update then happens locally on the shard owner.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'ZeRO saves memory by increasing communication and scheduling complexity. Stage 1 has the smallest communication change and can deliver large wins for Adam-heavy models. Stage 2 reduces gradient memory but requires careful gradient bucketing. Stage 3 gives the largest memory savings, but parameter all-gathers now sit on the critical path unless overlapped well. Offload can move state to CPU or NVMe, but that turns device memory pressure into transfer latency pressure.',
        'The memory budget must include parameters, gradients, optimizer states, activations, temporary buffers, and communication buckets. Activation Checkpointing reduces activation memory, while ZeRO reduces replicated training state. They are complementary. A model that still does not fit after ZeRO may need Tensor Parallelism, Pipeline Parallelism, smaller sequence length, smaller batch size, or lower precision.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'ZeRO is common in large language model training, fine-tuning, reinforcement learning from human feedback, and any workload where optimizer state prevents scaling. It is especially attractive when teams want to preserve the programming model of data parallelism instead of manually splitting every transformer layer. It also appears in related forms such as Fully Sharded Data Parallel, which similarly shards parameters, gradients, and optimizer states across workers.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'ZeRO does not make communication disappear. It often replaces one simple all-reduce with a more nuanced choreography of reduce-scatter, all-gather, bucket scheduling, and overlap. A bad configuration can fit a larger model but train it slowly. Another misconception is that ZeRO solves activation memory. It does not; activations are created by the local forward pass and are handled by activation checkpointing, sequence parallelism, or architectural changes.',
        'The other trap is treating stage 3 as automatically best. Stage 3 saves the most memory, but if the model already fits, the added gathers may be unnecessary. The right stage is the one that fits the model while preserving enough throughput to make training economically sane.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: DeepSpeed ZeRO docs at https://deepspeed.readthedocs.io/en/latest/zero3.html, DeepSpeed ZeRO tutorial at https://www.deepspeed.ai/tutorials/zero/, and the ZeRO paper at https://arxiv.org/abs/1910.02054. Study GPU All-Reduce, Activation Checkpointing, Batch Size Scaling, Tensor Parallelism, Pipeline Parallelism, and Parameter Server Case Study next.',
      ],
    },
  ],
};
