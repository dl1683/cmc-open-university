// Fully Sharded Data Parallel: PyTorch's practical sharded data-parallel
// wrapper, gathering parameters just in time and resharding after use.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'fully-sharded-data-parallel',
  title: 'Fully Sharded Data Parallel',
  category: 'Systems',
  summary: 'PyTorch FSDP shards parameters, gradients, and optimizer state across data-parallel ranks, then all-gathers modules just in time.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['reshard lifecycle', 'wrapping strategy'], defaultValue: 'reshard lifecycle' },
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

function fsdpGraph(title) {
  return graphState({
    nodes: [
      { id: 'r0', label: 'rank 0', x: 0.9, y: 1.4, note: 'param shard A' },
      { id: 'r1', label: 'rank 1', x: 0.9, y: 3.6, note: 'param shard B' },
      { id: 'r2', label: 'rank 2', x: 0.9, y: 5.8, note: 'param shard C' },
      { id: 'module', label: 'wrapped module', x: 3.5, y: 3.6, note: 'FSDP unit' },
      { id: 'gather', label: 'all-gather params', x: 5.8, y: 2.1, note: 'full weights briefly' },
      { id: 'compute', label: 'forward/backward', x: 7.3, y: 3.6, note: 'local micro-batch' },
      { id: 'scatter', label: 'reduce-scatter grads', x: 5.8, y: 5.2, note: 'owners get shards' },
      { id: 'optim', label: 'optimizer shard', x: 9.1, y: 3.6, note: 'local update' },
    ],
    edges: [
      { id: 'e-r0-module', from: 'r0', to: 'module', weight: 'owned shard' },
      { id: 'e-r1-module', from: 'r1', to: 'module', weight: 'owned shard' },
      { id: 'e-r2-module', from: 'r2', to: 'module', weight: 'owned shard' },
      { id: 'e-module-gather', from: 'module', to: 'gather', weight: 'pre-forward' },
      { id: 'e-gather-compute', from: 'gather', to: 'compute', weight: 'full params' },
      { id: 'e-compute-scatter', from: 'compute', to: 'scatter', weight: 'gradients' },
      { id: 'e-scatter-optim', from: 'scatter', to: 'optim', weight: 'sharded grads' },
    ],
  }, { title });
}

function* reshardLifecycle() {
  yield {
    state: fsdpGraph('Idle state: each rank owns only shards'),
    highlight: { active: ['r0', 'r1', 'r2', 'module'], compare: ['gather', 'compute'] },
    explanation: 'Read the rank nodes as the resting layout. Parameters, gradients, and optimizer state are partitioned across ranks, so the long-lived footprint is sharded rather than fully replicated.',
  };

  yield {
    state: fsdpGraph('Pre-forward: all-gather full parameters for one module'),
    highlight: { active: ['module', 'gather', 'e-module-gather', 'e-gather-compute'], found: ['compute'] },
    explanation: 'Before a wrapped module runs, ranks all-gather the shards needed to materialize that module parameters. Full weights exist briefly, just around the computation that needs them.',
    invariant: 'FSDP keeps full parameters temporary; shards are the resting state.',
  };

  yield {
    state: fsdpGraph('Backward: reduce-scatter gradients to shard owners'),
    highlight: { active: ['compute', 'scatter', 'e-compute-scatter', 'e-scatter-optim'], found: ['optim'] },
    explanation: 'Backward computes gradients, then reduce-scatters them so each rank keeps the reduced gradient shard it owns. The optimizer step can then run locally on each owner shard.',
  };

  yield {
    state: labelMatrix(
      'FSDP compared with adjacent strategies',
      [
        { id: 'ddp', label: 'DDP' },
        { id: 'zero3', label: 'ZeRO stage 3' },
        { id: 'fsdp', label: 'FSDP' },
        { id: 'tensor', label: 'tensor parallel' },
      ],
      [
        { id: 'state', label: 'resting state' },
        { id: 'communication', label: 'communication pattern' },
      ],
      [
        ['full replica per rank', 'gradient all-reduce'],
        ['sharded state', 'gather/scatter around layers'],
        ['sharded module state', 'gather/reshard around wrapped units'],
        ['sharded tensor math', 'in-layer collectives'],
      ],
    ),
    highlight: { active: ['fsdp:state', 'fsdp:communication'], found: ['zero3:state'], compare: ['ddp:state'] },
    explanation: 'FSDP is conceptually close to ZeRO stage 3 but exposed as a PyTorch module-wrapping strategy. Tensor parallelism splits the math inside a layer; FSDP shards the data-parallel training state.',
  };
}

function* wrappingStrategy() {
  yield {
    state: labelMatrix(
      'Auto-wrap granularity',
      [
        { id: 'whole', label: 'whole model' },
        { id: 'block', label: 'transformer block' },
        { id: 'layer', label: 'tiny layers' },
        { id: 'hybrid', label: 'hybrid shard' },
      ],
      [
        { id: 'benefit', label: 'benefit' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['simple boundary', 'large peak all-gather'],
        ['natural memory unit', 'more collectives'],
        ['fine memory control', 'too much overhead'],
        ['node-local shards', 'mesh planning complexity'],
      ],
    ),
    highlight: { active: ['block:benefit', 'block:risk'], compare: ['whole:risk', 'layer:risk'] },
    explanation: 'Read each row as a candidate wrapper boundary. FSDP performance depends heavily on this choice: transformer-block wrapping often balances peak memory and collective overhead better than tiny-layer or whole-model wrapping.',
  };

  yield {
    state: fsdpGraph('Forward prefetch and backward prefetch hide communication'),
    highlight: { active: ['gather', 'compute', 'scatter'], found: ['e-module-gather', 'e-compute-scatter'] },
    explanation: 'Production FSDP overlaps communication with compute where possible. It can prefetch upcoming parameters and reduce-scatter gradients while later backward work is still running.',
  };

  yield {
    state: labelMatrix(
      'Operational knobs',
      [
        { id: 'precision', label: 'mixed precision' },
        { id: 'checkpoint', label: 'activation checkpointing' },
        { id: 'cpu', label: 'CPU offload' },
        { id: 'state', label: 'state dict' },
      ],
      [
        { id: 'helps', label: 'helps' },
        { id: 'caveat', label: 'caveat' },
      ],
      [
        ['lower param/grad bytes', 'numerical policy matters'],
        ['lower activation memory', 'extra recompute'],
        ['free GPU memory', 'PCIe latency'],
        ['save/load sharded weights', 'checkpoint format planning'],
      ],
    ),
    highlight: { found: ['precision:helps', 'checkpoint:helps'], active: ['state:caveat'] },
    explanation: 'FSDP is one memory lever inside a training plan. Mixed precision, activation checkpointing, CPU offload, and sharded checkpoints determine whether the memory savings translate into a usable job.',
  };

  yield {
    state: labelMatrix(
      'Failure diagnosis',
      [
        { id: 'oom', label: 'OOM at gather' },
        { id: 'slow', label: 'slow step time' },
        { id: 'checkpoint', label: 'bad checkpoint' },
        { id: 'numerics', label: 'loss diverges' },
      ],
      [
        { id: 'likely', label: 'likely cause' },
        { id: 'response', label: 'response' },
      ],
      [
        ['wrap too coarse', 'wrap smaller units'],
        ['collective overhead', 'coarsen wrap or improve overlap'],
        ['state dict mismatch', 'choose full/local/sharded format'],
        ['precision/reduction issue', 'audit mixed precision policy'],
      ],
    ),
    highlight: { active: ['oom:response', 'slow:response'], found: ['checkpoint:response'] },
    explanation: 'FSDP debugging is memory-layout debugging. The key questions are where full parameters temporarily exist, when they are released, and what checkpoint format the job expects.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'reshard lifecycle') yield* reshardLifecycle();
  else if (view === 'wrapping strategy') yield* wrappingStrategy();
  else throw new InputError('Pick an FSDP view.');
}

export const article = {
  sections: [
    {
      heading: 'Why FSDP exists',
      paragraphs: [
        'Fully Sharded Data Parallel, usually shortened to FSDP, exists because ordinary data parallel training wastes the scarcest resource in large-model training: accelerator memory. Distributed Data Parallel gives every rank a full model replica, splits the batch, runs local forward and backward passes, and all-reduces gradients. That is a clean programming model, but every GPU still stores the same parameters, the same gradients, and the same optimizer state. For Adam-style training, optimizer moments and master weights can cost several times more memory than the visible low-precision model weights.',
        'FSDP keeps the data-parallel behavior while changing the physical layout. Parameters, gradients, and optimizer state rest as shards across ranks. Full parameters are reconstructed only when a wrapped module needs to execute, then released or resharded afterward. PyTorch presents this as a module wrapper, inspired by ZeRO stage 3, rather than as a separate training framework: https://docs.pytorch.org/docs/stable/fsdp.html. The practical lesson is that memory scale is not only a hardware problem. It is an ownership problem: which rank owns each byte, when is a full copy actually needed, and how quickly can the system return to the sharded resting state?',
      ],
    },
    {
      heading: 'The naive scaling wall',
      paragraphs: [
        'The naive PyTorch scaling path is DDP. Add GPUs, replicate the model, split the examples, average gradients, and hope the job fits. Throughput can improve because more examples are processed per step, but per-rank memory barely changes. A model that does not fit on one GPU because of parameters, gradients, and optimizer state usually will not magically fit under DDP. Every rank carries the same long-lived state, and the all-reduce only solves synchronization.',
        'A second naive reaction is to shard everything at the wrong boundary. If the whole model is wrapped as one FSDP unit, a pre-forward all-gather can materialize too much at once and create a peak that defeats the purpose. If every tiny layer is wrapped separately, collective overhead can dominate the step. FSDP is therefore not a simple on/off flag. It is a layout and scheduling choice. The model still needs the right micro-batch size, activation strategy, precision policy, checkpoint format, and communication overlap.',
      ],
    },
    {
      heading: 'The mechanism',
      paragraphs: [
        'The FSDP lifecycle is gather, compute, scatter, reshard. In the idle state, rank 0 might own one shard of a module, rank 1 another, and rank 2 another. Before a wrapped module runs, the ranks all-gather those shards so each rank can temporarily see the full parameters needed for its local micro-batch. Forward and backward then use ordinary tensor operations. After gradients are produced, reduce-scatter both reduces them across ranks and returns only the owner shard to each rank. The optimizer step updates local shards rather than full replicated state.',
        'The wrapper boundary controls peak memory and communication frequency. Transformer block wrapping is common because a block is large enough to make communication worthwhile but small enough to avoid gathering the whole model. FSDP can also prefetch upcoming parameter shards and overlap gradient communication with backward compute. Hybrid sharding can shard inside a node or subgroup to reduce cross-node traffic. These details matter because the mathematical goal is simple, but the runtime has to make temporary full weights appear exactly when needed and disappear before they become a memory bottleneck.',
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        'The reshard-lifecycle view proves the key invariant: shards are the resting state, full parameters are a temporary working set. The rank nodes own long-lived pieces. The all-gather node is the momentary reconstruction point. The compute node is the only interval where the full module must exist. The reduce-scatter node sends reduced gradients back to the shard owners so optimizer state can remain local. If that lifecycle is violated, the memory accounting breaks.',
        'The wrapping-strategy view proves that granularity is part of the algorithm. Whole-model wrapping reduces conceptual complexity but risks a huge all-gather peak. Tiny-layer wrapping gives fine memory control but can create too many collectives. Block-level wrapping often lands in the useful middle. The operational tables connect symptoms to causes: out-of-memory near the gather boundary points to wrap granularity or prefetch timing, slow step time points to collective overhead or poor overlap, and checkpoint errors point to a mismatch between local, full, and sharded state dict formats.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'FSDP works because a data-parallel group logically behaves like one replicated training program, but not every byte has to be physically replicated all the time. Parameters are needed in full only while a module computes. Gradients are needed in reduced form only by the rank that owns the corresponding parameter shard. Optimizer state is naturally local to the owner shard. Once those lifetimes are separated, all-gather and reduce-scatter replace the single all-reduce-heavy picture of classic DDP.',
        'The design also works because transformer models have natural module boundaries. A block contains enough parameters and compute to amortize a collective, and the next block does not need the previous block full-parameter copy to stay resident. That does not make communication free. It means communication can be scheduled around meaningful compute. The production value of FSDP comes from turning a static memory explosion into a sequence of bounded, temporary working sets.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The memory savings are bought with communication and orchestration. Full sharding minimizes long-lived state, but it requires parameter all-gathers before use and reduce-scatters during backward. If the network is slow, wrap units are too small, or overlap is ineffective, the job can be slower than a less-sharded baseline. Hybrid sharding reduces some cross-node traffic by keeping shard groups smaller, but it gives back some memory savings. CPU offload can make an experiment fit, yet it may simply move the bottleneck to PCIe bandwidth, host memory pressure, or checkpoint latency.',
        'FSDP also does not solve every memory term. Activations are still produced by the local forward pass, so activation checkpointing may be required. Temporary buffers and communication buckets still need space. Tensor parallelism and pipeline parallelism solve different problems: tensor parallelism splits the math inside layers, and pipeline parallelism splits depth across stages. FSDP shards training state across data-parallel ranks. A large training plan may need all of these, but confusing them leads to bad memory estimates.',
      ],
    },
    {
      heading: 'Where it helps and where it fails',
      paragraphs: [
        'FSDP is most useful in PyTorch training runs where DDP is conceptually right but duplicated state blocks scale. Large language model pretraining, supervised fine-tuning, reinforcement-learning fine-tuning, multimodal training, and research jobs with large optimizer state all fit this pattern. It is especially attractive when the team wants to keep a familiar module-level programming model rather than rewrite layers for tensor parallel execution. It also pairs well with mixed precision, activation checkpointing, and sharded checkpointing when those are planned together.',
        'It fails when communication becomes the dominant cost, when the wrap policy creates bad peaks, when checkpoint formats are treated casually, or when the real bottleneck is activation memory rather than sharded state. Debugging should start with ownership questions: which rank owns this shard, when does the full parameter exist, when is it freed, and which collective is on the critical path? Plan checkpoint portability early. Full, local, and sharded state dicts have different costs and assumptions about world size, wrapping layout, and precision.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: PyTorch FSDP documentation at https://docs.pytorch.org/docs/stable/fsdp.html and PyTorch FSDP: Experiences on Scaling Fully Sharded Data Parallel at https://www.vldb.org/pvldb/vol16/p3848-huang.pdf. For the adjacent optimizer-sharding theory, read the ZeRO paper at https://arxiv.org/abs/1910.02054.',
        'Study ZeRO Optimizer, GPU All-Reduce, Tensor Parallelism, Pipeline Parallelism, Activation Checkpointing, Batch Size Scaling, Gradient Noise Scale, Transformer Inference Roofline, and NCCL Algorithm Protocol Selector next. The important habit is to keep a byte ledger for parameters, gradients, optimizer state, activations, temporary buffers, and checkpoint formats before deciding which parallelism tool is actually needed.',
      ],
    },
  ],
};
