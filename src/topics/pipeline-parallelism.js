// Pipeline parallelism: split model depth across devices and stream
// micro-batches through the stages so accelerators work concurrently.

import { matrixState, graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'pipeline-parallelism',
  title: 'Pipeline Parallelism',
  category: 'Systems',
  summary: 'Partition model layers into stages and stream micro-batches through them, trading activation sends and bubbles for depth scaling.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['micro-batch schedule', 'stage partitioning'], defaultValue: 'micro-batch schedule' },
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

function stageGraph(title) {
  return graphState({
    nodes: [
      { id: 'input', label: 'input batch', x: 0.7, y: 3.5, note: 'split into micro-batches' },
      { id: 's0', label: 'stage 0', x: 2.5, y: 3.5, note: 'layers 1-8' },
      { id: 's1', label: 'stage 1', x: 4.3, y: 3.5, note: 'layers 9-16' },
      { id: 's2', label: 'stage 2', x: 6.1, y: 3.5, note: 'layers 17-24' },
      { id: 's3', label: 'stage 3', x: 7.9, y: 3.5, note: 'layers 25-32' },
      { id: 'loss', label: 'loss', x: 9.5, y: 3.5, note: 'gradients reverse' },
    ],
    edges: [
      { id: 'e-input-s0', from: 'input', to: 's0', weight: 'micro-batch' },
      { id: 'e-s0-s1', from: 's0', to: 's1', weight: 'activations' },
      { id: 'e-s1-s2', from: 's1', to: 's2', weight: 'activations' },
      { id: 'e-s2-s3', from: 's2', to: 's3', weight: 'activations' },
      { id: 'e-s3-loss', from: 's3', to: 'loss', weight: 'prediction' },
    ],
  }, { title });
}

function* microBatchSchedule() {
  const stageCount = 4;
  const microBatches = 4;
  const naiveTicks = stageCount;
  const steadyStateTick = stageCount;

  yield {
    state: labelMatrix(
      'Naive model split: only one stage works at a time',
      [
        { id: 't1', label: 'tick 1' },
        { id: 't2', label: 'tick 2' },
        { id: 't3', label: 'tick 3' },
        { id: 't4', label: 'tick 4' },
      ],
      [
        { id: 's0', label: 'stage 0' },
        { id: 's1', label: 'stage 1' },
        { id: 's2', label: 'stage 2' },
        { id: 's3', label: 'stage 3' },
      ],
      [
        ['batch A', '', '', ''],
        ['', 'batch A', '', ''],
        ['', '', 'batch A', ''],
        ['', '', '', 'batch A'],
      ],
    ),
    highlight: { active: ['t1:s0', 't2:s1', 't3:s2', 't4:s3'], compare: ['t1:s1', 't1:s2', 't1:s3'] },
    explanation: `Read rows as time and columns as ${stageCount} stages. This naive depth split fits a larger model but wastes devices: while stage 0 works, the other ${stageCount - 1} stages wait. Micro-batches are what make all ${stageCount} stages work at once.`,
  };

  yield {
    state: labelMatrix(
      'GPipe-style fill, steady state, drain',
      [
        { id: 't1', label: 'tick 1' },
        { id: 't2', label: 'tick 2' },
        { id: 't3', label: 'tick 3' },
        { id: 't4', label: 'tick 4' },
        { id: 't5', label: 'tick 5' },
        { id: 't6', label: 'tick 6' },
      ],
      [
        { id: 's0', label: 'stage 0' },
        { id: 's1', label: 'stage 1' },
        { id: 's2', label: 'stage 2' },
        { id: 's3', label: 'stage 3' },
      ],
      [
        ['mb1 fwd', '', '', ''],
        ['mb2 fwd', 'mb1 fwd', '', ''],
        ['mb3 fwd', 'mb2 fwd', 'mb1 fwd', ''],
        ['mb4 fwd', 'mb3 fwd', 'mb2 fwd', 'mb1 fwd'],
        ['', 'mb4 fwd', 'mb3 fwd', 'mb2 fwd'],
        ['', '', 'mb4 fwd', 'mb3 fwd'],
      ],
    ),
    highlight: { active: ['t4:s0', 't4:s1', 't4:s2', 't4:s3'], compare: ['t1:s1', 't6:s0'] },
    explanation: `Read filled cells as useful work and blank cells as bubbles. By tick ${steadyStateTick}, all ${stageCount} stages work on different micro-batches at the same time while the beginning and end pay fill/drain overhead.`,
    invariant: `Pipeline parallelism turns model depth into an assembly line of ${stageCount} stages processing ${microBatches} micro-batches.`,
  };

  yield {
    state: labelMatrix(
      '1F1B schedule intuition',
      [
        { id: 'fill', label: 'fill' },
        { id: 'steady', label: 'steady' },
        { id: 'drain', label: 'drain' },
        { id: 'bubble', label: 'bubble' },
      ],
      [
        { id: 'work', label: 'work' },
        { id: 'purpose', label: 'purpose' },
      ],
      [
        ['forward-only warmup', 'make later stages busy'],
        ['one forward, one backward', 'reduce activation memory'],
        ['backward-only finish', 'complete gradients'],
        ['idle slots', 'overhead from stage count and micro-batches'],
      ],
    ),
    highlight: { found: ['steady:work', 'steady:purpose'], active: ['bubble:work'] },
    explanation: `A one-forward-one-backward schedule interleaves forward and backward work after warmup across ${stageCount} stages. That lowers live activation memory compared with doing all ${microBatches} forwards first and all backwards later.`,
  };

  yield {
    state: labelMatrix(
      'Bubble fraction intuition',
      [
        { id: 'few', label: 'few micro-batches' },
        { id: 'many', label: 'many micro-batches' },
        { id: 'imbalanced', label: 'imbalanced stages' },
        { id: 'interleaved', label: 'interleaved stages' },
      ],
      [
        { id: 'effect', label: 'effect' },
        { id: 'response', label: 'response' },
      ],
      [
        ['large bubble fraction', 'increase micro-batches if memory allows'],
        ['smaller bubble fraction', 'watch communication and memory'],
        ['one stage becomes bottleneck', 'rebalance layers'],
        ['more virtual stages', 'reduce bubbles but add complexity'],
      ],
    ),
    highlight: { active: ['few:effect', 'imbalanced:effect'], found: ['many:response', 'interleaved:response'] },
    explanation: `The schedule is only as good as stage balance and micro-batch count. With ${stageCount} stages and only ${microBatches} micro-batches, too few micro-batches create bubbles; badly balanced stages make everyone wait for the slowest stage.`,
  };
}

function* stagePartitioning() {
  const stageCount = 4;
  const layersPerStage = 8;
  const totalLayers = stageCount * layersPerStage;

  yield {
    state: stageGraph('Partition layers by depth'),
    highlight: { active: ['s0', 's1', 's2', 's3'], found: ['e-s0-s1', 'e-s1-s2', 'e-s2-s3'] },
    explanation: `Pipeline parallelism assigns ${totalLayers} consecutive model layers to ${stageCount} stages (${layersPerStage} layers each). Activations move forward between stages; gradients move backward across the same boundaries.`,
  };

  yield {
    state: labelMatrix(
      'Partitioning constraints',
      [
        { id: 'layers', label: 'layer compute' },
        { id: 'memory', label: 'stage memory' },
        { id: 'activation', label: 'activation size' },
        { id: 'skip', label: 'skip connections' },
      ],
      [
        { id: 'bad', label: 'bad split' },
        { id: 'good', label: 'better split' },
      ],
      [
        ['slow last stage', 'balance FLOPs'],
        ['stage OOM', 'balance parameters and activations'],
        ['huge boundary tensor', 'cut at smaller tensors'],
        ['cross-stage dependency mess', 'respect model graph'],
      ],
    ),
    highlight: { active: ['layers:bad', 'memory:bad'], found: ['activation:good', 'skip:good'] },
    explanation: `A good pipeline split is not just equal layer count of ${layersPerStage} per stage. Across ${stageCount} stages it must balance compute, memory, boundary activation size, and the actual data-flow graph of the model.`,
  };

  yield {
    state: labelMatrix(
      'Pipeline versus tensor parallelism',
      [
        { id: 'pipeline', label: 'pipeline parallel' },
        { id: 'tensor', label: 'tensor parallel' },
        { id: 'data', label: 'data parallel' },
        { id: 'zero', label: 'ZeRO' },
      ],
      [
        { id: 'splits', label: 'splits' },
        { id: 'traffic', label: 'main traffic' },
      ],
      [
        ['layers by depth', 'activations between stages'],
        ['matmul dimensions', 'in-layer collectives'],
        ['batch examples', 'gradient all-reduce'],
        ['training state', 'gather/scatter shards'],
      ],
    ),
    highlight: { active: ['pipeline:splits', 'pipeline:traffic'], found: ['tensor:splits', 'zero:splits'] },
    explanation: `Pipeline parallelism splits ${totalLayers} layers across ${stageCount} depth stages; tensor parallelism splits width inside layers. Large jobs often use both.`,
  };

  yield {
    state: stageGraph('Final frame: activations forward, gradients backward'),
    highlight: { found: ['e-s0-s1', 'e-s1-s2', 'e-s2-s3'], active: ['s0', 's1', 's2', 's3'] },
    explanation: `The static picture to remember: each of the ${stageCount} stages owns ${layersPerStage} consecutive layers. The pipeline is correct only if activation and gradient traffic cross those ${stageCount - 1} boundaries in schedule order.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'micro-batch schedule') yield* microBatchSchedule();
  else if (view === 'stage partitioning') yield* stagePartitioning();
  else throw new InputError('Pick a pipeline parallelism view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the grid as an execution schedule, not as a picture of layers. A stage is a consecutive slice of the model on one device, and a micro-batch is a smaller piece of the batch that still passes through every stage in order.',
        {type: 'image', src: './assets/gifs/pipeline-parallelism.gif', alt: 'Animated walkthrough of the pipeline parallelism visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'A filled cell means that stage is doing useful forward or backward work for one micro-batch. A blank cell is a bubble: the device is waiting because dependencies have not arrived or the pipeline is draining. The safe inference is that overlap is legal only across different micro-batches, never by reordering layers inside one micro-batch.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Pipeline parallelism exists because one accelerator may not hold or efficiently train a deep model. Data parallelism copies the whole model to each worker, which helps throughput only after the model already fits. Tensor parallelism splits individual matrix operations, but it adds communication inside layers.',
        {type: `callout`, text: `Pipeline parallelism treats model depth as an assembly line: correctness preserves layer order, while throughput comes from keeping different stages busy on different micro-batches.`},
        'Pipeline runtimes split model execution into stages, split batches into micro-batches, and schedule those micro-batches so different devices can work at the same time. The data structure to watch is the schedule matrix: blank cells are lost device time, and filled cells are useful stage execution.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The direct approach is to put layer ranges on different GPUs and send one full batch through them. GPU 0 runs the early layers, then GPU 1 runs the next layers, then GPU 2 continues. The model fits, but only one stage is busy at a time.',
        'Equal layer-count partitioning is the next reasonable attempt. It works for a toy stack of identical blocks, but real models have embeddings, attention shapes, experts, output heads, and checkpointing choices that make equal depth unequal in time and memory.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is dependency order. Stage 1 cannot process a micro-batch until stage 0 has produced its activations, and backward work has the reverse dependency. A single full batch creates long gaps where every other device waits.',
        'The first ticks fill the pipeline and the last ticks drain it. Those bubbles are not implementation mistakes; they are the cost of starting and ending a dependency chain. If stages are imbalanced, the slowest stage becomes the clock for the whole system.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Split the batch, not the layer order. Each micro-batch still runs through stage 0, then stage 1, then every later stage, but different micro-batches can occupy different stages at the same time. The schedule turns model depth into an assembly line.',
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg`, alt: `Layered neural network diagram with multiple colored layers`, caption: `Pipeline splits follow consecutive layer ranges in a network like this, then schedule micro-batches through those ranges. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Colored_neural_network.svg.`},
        'This separates correctness from throughput. Correctness comes from preserving the per-micro-batch computation graph and accumulating the intended gradients before the optimizer step. Throughput comes from making the schedule matrix dense enough that waiting devices become rare.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A stage owns parameters for one consecutive layer range. During forward pass, it receives activations from the previous stage, computes its slice, and sends boundary activations onward. During backward pass, gradients move in the opposite direction.',
        'A GPipe-style schedule runs all forward micro-batches first, then all backward passes. A one-forward-one-backward schedule warms up, then alternates forward and backward work to reduce live activation memory. Interleaving can split a physical device into virtual stages, trading scheduler complexity for fewer bubbles.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is serial equivalence inside each micro-batch. Micro-batch 7 never reaches stage 2 before stage 1, and its backward pass never updates an earlier stage before downstream gradients exist. The schedule only overlaps work that belongs to different micro-batches.',
        'For synchronous training, gradients from all micro-batches are accumulated before the optimizer changes weights. That makes the update match ordinary mini-batch training apart from numerical order, randomness, and layers whose behavior depends on batch composition.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The time cost is governed by the slowest stage plus communication across boundaries. If four stages take 8, 9, 7, and 18 milliseconds, the pipeline eventually runs near the 18 millisecond stage rate no matter how fast the others are. Doubling micro-batches reduces bubble fraction, but smaller micro-batches can hurt GPU efficiency.',
        'The memory cost is parameters, optimizer state, and live activations waiting for backward computation. One-forward-one-backward schedules reduce activation buildup, while checkpointing saves memory by recomputing forward work during backward. The operational cost includes profiling, checkpointing, failure recovery, and numerical debugging across devices.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Large transformer training often combines pipeline parallelism with tensor parallelism and data parallelism. Pipeline parallelism splits depth, tensor parallelism splits wide layer operations, and data parallelism splits batches across replicas. Fully sharded optimizers can then reduce optimizer-state memory inside that grid.',
        'Inference can also use pipeline stages when a model is too large for one device. The fit is better for throughput-oriented batches than for single interactive requests, because every request must cross multiple devices. Serving systems therefore weigh pipeline utilization against latency and routing complexity.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Pipeline parallelism fails when stage times are uneven, boundary tensors are too large, or there are too few micro-batches to hide fill and drain bubbles. It also performs poorly when micro-batches become so small that kernels lose arithmetic efficiency. A dense-looking schedule can still stall on communication.',
        'Correctness failures come from hidden cross-stage assumptions. Tied weights, skip connections, shared caches, random layers, batch normalization, and optimizer timing can behave differently after partitioning. A serious implementation checks a small pipelined run against an equivalent non-pipelined run before trusting speed results.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a model is split into four stages and each micro-batch takes 10 ms per stage. Four micro-batches without overlap take 4 micro-batches times 4 stages times 10 ms, or 160 ms. Most devices are idle during most ticks.',
        'With pipeline scheduling, tick 1 runs micro-batch 1 on stage 0. Tick 2 runs micro-batch 2 on stage 0 while micro-batch 1 runs on stage 1. By tick 4, all four stages are busy; after fill and drain, the four forward micro-batches finish in 7 ticks, or 70 ms.',
        'The improvement is not fourfold because the pipeline must fill and drain. More micro-batches make the fixed bubble cost smaller relative to useful work. If the same four stages process 32 micro-batches, the forward schedule takes 35 ticks rather than 128 serial ticks.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources include GPipe by Huang et al. (2019), PipeDream by Narayanan et al. (2019), and the PyTorch pipeline parallelism documentation. Study them for scheduling choices, bubble cost, and the memory behavior hidden behind the compact animation.',
        'Study next: Tensor Parallelism for splitting work inside layers, Fully Sharded Data Parallel for parameter and optimizer-state sharding, Activation Checkpointing for memory-compute exchange, GPU All-Reduce for communication costs, and Batch Size Scaling for the optimization side of micro-batch choices.',
      ],
    },
  ],
};
