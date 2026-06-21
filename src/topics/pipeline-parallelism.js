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
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/pipeline-parallelism.gif', alt: 'Animated walkthrough of the pipeline parallelism visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `Pipeline parallelism exists because a deep model has two different scaling problems. The parameters and activations may not fit on one accelerator, and a single accelerator may not provide enough throughput even when the model fits. Data parallelism copies the whole model to every worker, so it helps batch throughput but does not solve model depth. Tensor parallelism splits individual layers, which helps very wide matrix operations, but it adds collectives inside almost every block. Pipeline parallelism makes a different cut: it assigns consecutive layer ranges to stages and streams micro-batches through those stages.`,
        {type: `callout`, text: `Pipeline parallelism treats model depth as an assembly line: correctness preserves layer order, while throughput comes from keeping different stages busy on different micro-batches.`},
        `PyTorch's pipeline runtime describes the same contract: split model execution into stages, split batches into micro-batches, and schedule those micro-batches so different devices execute different stages at the same time. GPipe made that idea practical for large sequential networks by treating the model like an assembly line and using batch splitting to reduce idle devices. The article below focuses on the data-structure view of that assembly line: a schedule matrix whose blank cells are lost work and whose filled cells are useful stage execution.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The first reasonable attempt is plain model parallelism: put layers 1 through 8 on GPU 0, layers 9 through 16 on GPU 1, and pass a full batch from stage to stage. That can make a model fit, but it barely improves utilization. While GPU 0 runs the first slice, GPUs 1 through 3 are idle. When GPU 1 starts, GPU 0 becomes idle. The batch walks down the model like one item on a conveyor belt with nobody allowed to place the next item behind it.`,
        `The second reasonable attempt is to cut the model by equal layer count. That is simple to explain and often good enough for a toy transformer with identical blocks. Real systems are less tidy. Embeddings, attention shapes, MoE experts, output heads, sequence length, activation checkpointing, and communication links can make two equally sized layer ranges have very different compute and memory behavior. Equal depth is only a starting guess, not a balancing proof.`,
        `The failure is dependency order. Stage 2 cannot run a micro-batch until stage 1 has produced its activations, and backward has the reverse dependency. A single full batch creates long idle gaps. The first and last ticks also create bubbles while the pipeline fills and drains, so throughput depends on enough micro-batches and balanced stages, not just on splitting the model.`,
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        `The core insight is that a training batch can be split into micro-batches without changing the model graph. Each micro-batch still runs through every layer in order, but different micro-batches can occupy different stages at the same time. The model becomes an assembly line: stage 0 processes micro-batch 4 while stage 1 processes micro-batch 3, stage 2 processes micro-batch 2, and stage 3 processes micro-batch 1.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg`, alt: `Layered neural network diagram with multiple colored layers`, caption: `Pipeline splits follow consecutive layer ranges in a network like this, then schedule micro-batches through those ranges. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Colored_neural_network.svg.`},
        `That insight separates correctness from scheduling. Correctness comes from preserving the forward and backward dependencies for every micro-batch and applying the optimizer step only after the intended gradients are accumulated. Performance comes from choosing a schedule that keeps the stage matrix dense. The algorithm does not make a layer faster; it hides stage latency by keeping other layers busy on other micro-batches.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `A pipeline has three objects: stages, micro-batches, and a schedule. A stage owns a consecutive slice of the network. A micro-batch is a smaller slice of the batch dimension. A schedule is a table that says which stage runs which forward or backward task at each tick. Boundary activations move forward between neighboring stages. Gradients move backward across the same boundaries.`,
        `A GPipe-style schedule fills the pipeline with forward passes, computes the loss after the last stage sees each micro-batch, and then drains backward passes. A one-forward-one-backward schedule warms up, then alternates forward and backward work to reduce live activation memory. Interleaved schedules split one physical device into multiple virtual stages, which can reduce bubbles when stage count and micro-batch count create too much idle space. Every schedule is trading utilization, activation memory, communication, and implementation complexity.`,
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        `The schedule matrix makes the hidden cost visible. Rows are time ticks, columns are stages, and blank cells are bubbles. The naive frame proves why merely splitting the model is not enough: one active cell per row means most accelerators are waiting. The filled steady-state row proves the payoff: all stages can do useful work at once when enough micro-batches are in flight.`,
        `The partitioning graph proves the other half of the problem. A stage boundary is also a communication boundary. If a split crosses a huge activation tensor or an awkward dependency, the schedule may look dense while the system stalls on transfers. A valid pipeline cut respects the model graph and tries to equalize compute, parameter memory, activation memory, and boundary traffic.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Pipeline parallelism is safe because it preserves the serial order inside each micro-batch. Micro-batch 7 still visits stage 0 before stage 1 and stage 1 before stage 2. Its backward pass still returns in the reverse order. The schedule only overlaps independent work from different micro-batches. Two stages working at the same tick are not racing on the same activation; they are processing different pieces of the batch.`,
        `For synchronous training, gradients from all micro-batches represent the intended larger batch before the optimizer updates the weights. That is why GPipe-style accumulation can match the mathematical shape of ordinary mini-batch training, aside from effects such as batch normalization, randomness, and numerical order. More aggressive asynchronous or stale-weight pipeline schemes need extra care because they may change the optimization behavior, not only the runtime.`,
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        `The main time cost is the slowest stage plus communication across stage boundaries. The main space cost is parameters for each stage, optimizer state if the stage is training, and live activations waiting for backward computation. More micro-batches usually reduce bubble fraction, but smaller micro-batches can lower arithmetic efficiency and increase per-micro-batch overhead. Activation checkpointing saves memory by recomputing forward work during backward, which can make the schedule fit but increase total compute.`,
        `Pipeline parallelism also introduces operational cost. Debugging a numerical problem now means tracing tensors across devices and time ticks. Profiling must separate stage imbalance from communication stalls. Checkpointing must know which rank owns which layers. Failure recovery is harder when one rank holds only part of the model and a queue of in-flight micro-batches.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Pipeline parallelism wins when model depth is the binding constraint and the network can be cut into reasonably balanced consecutive stages. Large transformer training often combines pipeline parallelism with tensor parallelism for wide matrix operations and data parallelism for global batch throughput. ZeRO or FSDP can shard optimizer and parameter state inside or across those groups. The useful mental model is not one technique replacing the others; it is a parallelism grid where depth, width, batch, and state are split on different axes.`,
        `It can also appear in inference for very large models, especially when a single request must traverse model partitions that cannot fit on one device. Inference has different pressure because there is no training backward pass, but latency and batch scheduling become more visible. Pipeline stages can improve throughput for batches of requests, while interactive single-request latency may suffer if every request must cross many devices.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `The most common failure is an imbalanced stage. One slow stage turns the rest of the pipeline into a waiting room. Another failure is a bad boundary: a split after a large activation or across a nonlocal dependency can make communication dominate. Too few micro-batches leave bubbles. Too many micro-batches can hurt kernel efficiency, increase scheduling overhead, or exceed activation memory.`,
        `There are also correctness traps. Tied weights, cross-layer skip connections, shared caches, random layers, batch-dependent normalization, and optimizer timing can break assumptions that were harmless in a single-process model. A pipeline schedule should be validated with numerical checks against a smaller non-pipelined run before the team trusts the throughput graph.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Tensor Parallelism for splitting work inside layers, ZeRO Optimizer for sharding optimizer and parameter state, Activation Checkpointing for the memory-compute trade, GPU All-Reduce for the collective communication layer, Batch Size Scaling for optimization behavior, and Transformer Block for the model structure being partitioned. Then compare pipeline scheduling with Exchange Operator Parallel Query and Stream Processing Backpressure; both teach the same lesson from different systems: throughput comes from keeping stages busy without hiding the bottleneck.`,
      ],
    },
  ],
};
