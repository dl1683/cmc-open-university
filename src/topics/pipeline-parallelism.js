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
    explanation: 'A naive depth split fits a larger model but wastes devices. While stage 0 works, stages 1-3 wait. A pipeline needs micro-batches so several stages can work at once.',
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
    explanation: 'Micro-batches fill the pipeline. The middle ticks are the payoff: all stages work on different micro-batches at the same time. The blank cells at the beginning and end are pipeline bubbles.',
    invariant: 'Pipeline parallelism turns model depth into an assembly line.',
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
    explanation: 'A one-forward-one-backward schedule interleaves forward and backward work after warmup. That lowers live activation memory compared with doing all forwards first and all backwards later.',
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
    explanation: 'The schedule is only as good as stage balance and micro-batch count. Too few micro-batches create bubbles; badly balanced stages make everyone wait for the slowest stage.',
  };
}

function* stagePartitioning() {
  yield {
    state: stageGraph('Partition layers by depth'),
    highlight: { active: ['s0', 's1', 's2', 's3'], found: ['e-s0-s1', 'e-s1-s2', 'e-s2-s3'] },
    explanation: 'Pipeline parallelism assigns consecutive model layers to stages. Activations move forward between stages; gradients move backward across the same boundaries.',
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
    explanation: 'A good pipeline split is not just equal layer count. It balances compute, memory, boundary activation size, and the actual data-flow graph of the model.',
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
    explanation: 'Pipeline parallelism and tensor parallelism solve different geometry problems. Depth is split into stages; width is split inside layers. Large jobs often use both.',
  };

  yield {
    state: stageGraph('Final frame: activations forward, gradients backward'),
    highlight: { found: ['e-s0-s1', 'e-s1-s2', 'e-s2-s3'], active: ['s0', 's1', 's2', 's3'] },
    explanation: 'The static picture to remember: each stage owns a consecutive slice of the network. The pipeline is correct only if activation and gradient traffic cross those boundaries in schedule order.',
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
      heading: 'What it is',
      paragraphs: [
        'Pipeline parallelism splits a neural network by depth. Instead of placing every layer on every GPU, stage 0 owns the early layers, stage 1 owns the next layers, and so on. A batch is divided into micro-batches that stream through the stages. While stage 3 works on micro-batch 1, stage 2 can work on micro-batch 2, stage 1 on micro-batch 3, and stage 0 on micro-batch 4.',
        'PyTorch describes pipeline parallelism as partitioning model execution so multiple micro-batches can execute different parts of the model concurrently: https://docs.pytorch.org/docs/2.9/distributed.pipelining.html. GPipe introduced a task-independent pipeline approach for giant networks and uses batch splitting to get near-linear speedups in favorable settings: https://arxiv.org/abs/1811.06965.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A pipeline has stages, micro-batches, and a schedule. Stages are consecutive pieces of the model. Micro-batches are smaller slices of the training batch. The schedule decides when each stage runs forward or backward for each micro-batch. A simple GPipe schedule fills the pipeline with forward passes, computes loss, then drains backward passes. A one-forward-one-backward schedule warms up and then alternates forward and backward work, reducing live activation memory.',
        'The central performance issue is the bubble: idle time while the pipeline is filling or draining. More micro-batches reduce the bubble fraction, but they can increase activation memory, scheduling overhead, and communication. Interleaved schedules can reduce bubbles further by giving each physical device multiple virtual stages, at the cost of more complex scheduling.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Pipeline parallelism spends activation communication and scheduling complexity to fit deeper models and improve device utilization. Boundary tensors move forward between stages; their gradients move backward. If a boundary activation is huge or a link is slow, communication can dominate. If one stage has more compute than the others, it becomes the bottleneck and the whole pipeline slows to that stage rate.',
        'Memory also shifts. Each stage holds only part of the model parameters, but it may need to hold activations for several in-flight micro-batches until backward reaches them. Activation Checkpointing and 1F1B schedules reduce this pressure. ZeRO can shard optimizer states within or across pipeline stages. Tensor Parallelism can split a single large stage when one layer is too wide for one device.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Pipeline parallelism is used in large language model training, giant vision models, cross-host training, and sometimes large model inference. The SC 2021 Megatron-LM work studied how tensor, pipeline, and data parallelism compose, including interleaved pipeline schedules that improve throughput with comparable memory: https://arxiv.org/abs/2104.04473. In practice, a serious training stack chooses pipeline degree, tensor-parallel degree, data-parallel degree, micro-batches, and ZeRO/FSDP settings together.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The simplest misconception is that splitting layers automatically speeds training. A depth split without micro-batching just makes most GPUs wait. A pipeline with too few micro-batches still spends much of its time in bubbles. A pipeline with imbalanced stages runs at the speed of the slowest stage. Partitioning has to account for FLOPs, parameter memory, activation memory, boundary tensor sizes, and model graph dependencies.',
        'Another trap is confusing pipeline parallelism with Tensor Parallelism. Pipeline parallelism cuts through the sequence of layers. Tensor parallelism cuts through tensor dimensions inside a layer. The communication patterns are therefore different: activation sends between stages versus collectives inside layers.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: PyTorch pipeline parallel docs at https://docs.pytorch.org/docs/2.9/distributed.pipelining.html, GPipe at https://arxiv.org/abs/1811.06965, and large-scale Megatron-LM training at https://arxiv.org/abs/2104.04473. Study Exchange Operator Parallel Query to compare ML stage pipelines with database exchange boundaries, then Tensor Parallelism, ZeRO Optimizer, Activation Checkpointing, Batch Size Scaling, GPU All-Reduce, and Transformer Block.',
      ],
    },
  ],
};
