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
    explanation: 'FSDP starts from a sharded idle state. Parameters, gradients, and optimizer state are partitioned across ranks, reducing the long-lived memory footprint compared with replicated data parallelism.',
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
    explanation: 'FSDP performance depends heavily on wrapping. Transformer-block wrapping often balances peak memory and communication overhead better than wrapping every tiny layer or the entire model at once.',
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
      heading: 'What it is',
      paragraphs: [
        'Fully Sharded Data Parallel, or FSDP, is PyTorch sharded data parallelism exposed as a module wrapper. Standard Distributed Data Parallel keeps a full copy of parameters on every rank and all-reduces gradients. FSDP shards parameters, gradients, and optimizer state across ranks, then all-gathers full parameters only when a wrapped module needs to run. After use, it can reshard and return to the low-memory resting state.',
        'PyTorch describes FSDP as a wrapper for sharding module parameters across data-parallel workers, inspired by ZeRO stage 3: https://docs.pytorch.org/docs/stable/fsdp.html. The VLDB paper PyTorch FSDP: Experiences on Scaling Fully Sharded Data Parallel documents the production tradeoffs of full sharding, hybrid sharding, communication overhead, and implementation choices: https://www.vldb.org/pvldb/vol16/p3848-huang.pdf.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The lifecycle is gather, compute, scatter, reshard. In the idle state, each rank owns shards of module parameters and optimizer state. Before a wrapped module executes, ranks all-gather the parameter shards needed to materialize the full module weights. The local forward and backward run. Gradients are reduced and scattered back to owners. The optimizer updates owned shards, and full parameter copies are freed or resharded.',
        'This makes wrapping strategy central. If the whole model is wrapped as one unit, full model parameters may be gathered at once and peak memory can spike. If every tiny layer is wrapped separately, communication overhead can dominate. Transformer blocks are a natural boundary because they are large enough to amortize communication but small enough to control peak memory.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'FSDP saves memory by adding communication and orchestration. Full sharding has the lowest memory footprint but needs all-gather and reduce-scatter traffic around computation. Hybrid sharding can reduce cross-node communication by sharding within smaller groups. Mixed precision reduces bytes. Activation Checkpointing attacks a different part of the memory budget. CPU offload can make a model fit but may move the bottleneck to PCIe or host memory.',
        'Checkpointing is also different under FSDP. A job may save full state dicts, local state dicts, or sharded state dicts, each with different portability and cost. Loading a checkpoint into a different world size, wrapper layout, or precision policy requires deliberate planning.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'FSDP is used for large model pretraining, fine-tuning, reinforcement-learning workloads, and research training runs where PyTorch integration matters. It is often composed with Tensor Parallelism for very wide layers, Pipeline Parallelism for model depth, GPU All-Reduce collectives for data-parallel synchronization, and ZeRO-style optimizer sharding concepts. It is especially useful when the model almost fits under ordinary DDP but optimizer and gradient replicas push it over memory.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'FSDP is not a free speedup. It can make a job slower if communication dominates or wrapping is too fine-grained. It also does not eliminate activation memory; that is why activation checkpointing remains important. Another misconception is that FSDP and tensor parallelism are interchangeable. FSDP shards training state across data-parallel ranks; tensor parallelism changes the math layout inside a layer.',
        'The practical debugging question is always concrete: which rank owns this shard, when is the full parameter materialized, when is it freed, and what collective is on the critical path?',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: PyTorch FSDP docs at https://docs.pytorch.org/docs/stable/fsdp.html and PyTorch FSDP: Experiences on Scaling Fully Sharded Data Parallel at https://www.vldb.org/pvldb/vol16/p3848-huang.pdf. Study ZeRO Optimizer, GPU All-Reduce, Tensor Parallelism, Pipeline Parallelism, Activation Checkpointing, and Batch Size Scaling next.',
      ],
    },
  ],
};
