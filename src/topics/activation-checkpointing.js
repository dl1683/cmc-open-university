// Activation checkpointing: trade extra forward compute for much lower
// training memory by recomputing selected activations during backpropagation.

import { matrixState, graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'activation-checkpointing',
  title: 'Activation Checkpointing',
  category: 'AI & ML',
  summary: 'Save only selected activations during the forward pass, then recompute missing intermediates during backward to fit larger models.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['save vs recompute', 'checkpoint placement'], defaultValue: 'save vs recompute' },
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

const layers = [
  { id: 'l1', label: 'block 1' },
  { id: 'l2', label: 'block 2' },
  { id: 'l3', label: 'block 3' },
  { id: 'l4', label: 'block 4' },
  { id: 'l5', label: 'block 5' },
  { id: 'l6', label: 'block 6' },
];

function timeline(title, values, labels) {
  return matrixState({
    title,
    rows: [
      { id: 'fwd', label: 'forward' },
      { id: 'store', label: 'stored' },
      { id: 'bwd', label: 'backward' },
    ],
    columns: layers,
    values,
    format: (value) => labels[value] ?? '',
  });
}

function chainState(title) {
  return graphState({
    nodes: [
      { id: 'input', label: 'input', x: 0.8, y: 3.6, note: 'x' },
      { id: 'b1', label: 'block 1', x: 2.2, y: 3.6, note: 'save' },
      { id: 'b2', label: 'block 2', x: 3.6, y: 3.6, note: 'drop' },
      { id: 'b3', label: 'block 3', x: 5.0, y: 3.6, note: 'save' },
      { id: 'b4', label: 'block 4', x: 6.4, y: 3.6, note: 'drop' },
      { id: 'b5', label: 'block 5', x: 7.8, y: 3.6, note: 'drop' },
      { id: 'loss', label: 'loss', x: 9.2, y: 3.6, note: 'backward starts' },
    ],
    edges: [
      { id: 'e-input-b1', from: 'input', to: 'b1', weight: 'activation' },
      { id: 'e-b1-b2', from: 'b1', to: 'b2', weight: 'activation' },
      { id: 'e-b2-b3', from: 'b2', to: 'b3', weight: 'activation' },
      { id: 'e-b3-b4', from: 'b3', to: 'b4', weight: 'activation' },
      { id: 'e-b4-b5', from: 'b4', to: 'b5', weight: 'activation' },
      { id: 'e-b5-loss', from: 'b5', to: 'loss', weight: 'prediction' },
    ],
  }, { title });
}

function* saveVsRecompute() {
  yield {
    state: timeline('Ordinary training keeps every needed activation alive', [
      [1, 1, 1, 1, 1, 1],
      [2, 2, 2, 2, 2, 2],
      [3, 3, 3, 3, 3, 3],
    ], { 1: 'compute', 2: 'kept', 3: 'read' }),
    highlight: { active: ['store:l1', 'store:l2', 'store:l3', 'store:l4', 'store:l5', 'store:l6'], found: ['bwd:l6'] },
    explanation: 'Backpropagation needs intermediate activations. The default strategy stores them during forward and reads them during backward. That is fast, but activation memory can dominate training memory for deep networks and long sequences.',
  };

  yield {
    state: timeline('Checkpointing stores only boundary activations', [
      [1, 1, 1, 1, 1, 1],
      [2, 0, 0, 2, 0, 2],
      [3, 4, 4, 3, 4, 3],
    ], { 0: '', 1: 'compute', 2: 'saved', 3: 'read', 4: 'recompute' }),
    highlight: { active: ['store:l1', 'store:l4', 'store:l6'], compare: ['bwd:l2', 'bwd:l3', 'bwd:l5'] },
    explanation: 'Activation checkpointing saves selected boundary tensors and discards the rest. During backward, the missing tensors are recomputed from the nearest saved boundary instead of loaded from memory.',
    invariant: 'Checkpointing trades extra forward compute for lower activation memory.',
  };

  yield {
    state: chainState('Backward replays a segment only when its activations are needed'),
    highlight: { active: ['b3', 'b4', 'b5', 'e-b3-b4', 'e-b4-b5'], found: ['loss'] },
    explanation: 'The backward pass walks from the loss toward the input. When it reaches a checkpointed region, it reruns that region forward to rebuild the intermediates needed for gradients, then immediately frees them.',
  };

  yield {
    state: labelMatrix(
      'The memory trade',
      [
        { id: 'plain', label: 'ordinary backprop' },
        { id: 'manual', label: 'manual checkpoints' },
        { id: 'selective', label: 'selective policy' },
        { id: 'compiler', label: 'compiler-assisted' },
      ],
      [
        { id: 'memory', label: 'activation memory' },
        { id: 'compute', label: 'extra compute' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['highest', 'none', 'may not fit'],
        ['lower', 'segment replay', 'bad boundaries'],
        ['targeted', 'avoid expensive ops', 'policy complexity'],
        ['automated budget', 'planner chosen', 'compiler coverage'],
      ],
    ),
    highlight: { active: ['manual:memory', 'manual:compute'], found: ['selective:memory', 'compiler:memory'] },
    explanation: 'Checkpointing is not one fixed algorithm. The practical question is what to save, what to recompute, and which operations are too expensive or too stateful to replay freely.',
  };
}

function* checkpointPlacement() {
  yield {
    state: chainState('Good checkpoints bracket expensive memory regions'),
    highlight: { found: ['b1', 'b3'], active: ['b2', 'b4', 'b5'] },
    explanation: 'A checkpoint is most useful when it brackets a region whose activations are large but whose forward compute is acceptable to replay. Transformers often checkpoint whole blocks or attention/feed-forward subregions.',
  };

  yield {
    state: labelMatrix(
      'Placement heuristics',
      [
        { id: 'large', label: 'large activations' },
        { id: 'cheap', label: 'cheap replay' },
        { id: 'random', label: 'random ops' },
        { id: 'side', label: 'side effects' },
      ],
      [
        { id: 'checkpoint', label: 'checkpoint?' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['yes', 'largest memory win'],
        ['yes', 'small compute penalty'],
        ['careful', 'RNG state and dropout determinism'],
        ['avoid or isolate', 'replay must match forward semantics'],
      ],
    ),
    highlight: { active: ['large:checkpoint', 'cheap:checkpoint'], compare: ['random:checkpoint', 'side:checkpoint'] },
    explanation: 'Replay must be semantically equivalent to the original forward pass. Dropout and random operations require RNG handling; hidden side effects or global state can silently break gradients.',
  };

  yield {
    state: labelMatrix(
      'Interaction with other memory levers',
      [
        { id: 'precision', label: 'mixed precision' },
        { id: 'zero', label: 'ZeRO/FSDP' },
        { id: 'sequence', label: 'sequence length' },
        { id: 'batch', label: 'batch size' },
      ],
      [
        { id: 'saves', label: 'saves' },
        { id: 'checkpointing', label: 'checkpointing role' },
      ],
      [
        ['tensor bytes', 'still reduces live activations'],
        ['optimizer/param shards', 'orthogonal to activations'],
        ['attention activations', 'often decisive for long context'],
        ['more examples', 'buys room to raise batch'],
      ],
    ),
    highlight: { found: ['zero:checkpointing', 'sequence:checkpointing'], active: ['batch:checkpointing'] },
    explanation: 'Activation checkpointing stacks with sharded optimizer state, tensor parallelism, mixed precision, and batch-size tuning. It is usually one lever in a larger memory budget.',
  };

  yield {
    state: timeline('Final mental model: save boundaries, replay interiors', [
      [1, 1, 1, 1, 1, 1],
      [2, 0, 0, 2, 0, 2],
      [3, 4, 4, 3, 4, 3],
    ], { 0: '', 1: 'forward', 2: 'boundary', 3: 'read', 4: 'replay' }),
    highlight: { found: ['store:l1', 'store:l4', 'store:l6'], active: ['bwd:l2', 'bwd:l3', 'bwd:l5'] },
    explanation: 'The final frame is the entire idea: memory keeps only enough boundaries to rebuild the missing interior. Training becomes slower, but models that did not fit can become trainable.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'save vs recompute') yield* saveVsRecompute();
  else if (view === 'checkpoint placement') yield* checkpointPlacement();
  else throw new InputError('Pick an activation checkpointing view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Activation checkpointing is a training memory technique. Ordinary backpropagation stores intermediate activations from the forward pass because the backward pass needs them to compute gradients. In deep networks, especially transformers with long sequences, those activations can consume more memory than the parameters. Checkpointing changes the contract: save only selected boundary activations, discard the rest, and recompute missing intermediates during backward.',
        'PyTorch describes checkpointing as trading compute for memory: forward computation in checkpointed regions omits saving tensors for backward, then recomputes them during the backward pass. The current documentation is at https://docs.pytorch.org/docs/2.9/checkpoint.html. The original sublinear-memory line of work by Chen, Xu, Zhang, and Guestrin showed that deep networks can be trained with far less activation memory by spending extra forward computation: https://arxiv.org/abs/1604.06174.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Imagine a model as a chain of blocks. Without checkpointing, each block output stays alive until the backward pass reaches that block. With checkpointing, you save the input to a region and maybe the output boundary, but not every activation inside the region. Later, during backward, the runtime reruns the region forward from the saved boundary to rebuild the exact intermediates needed for gradient formulas. Once those gradients are computed, the recomputed activations can be freed.',
        'This is not free. If a region is checkpointed, its forward work may be executed twice: once in the original forward pass and once during backward recomputation. Selective checkpointing tries to avoid recomputing especially expensive operations while still discarding large cheap activations. Modern frameworks also handle details such as RNG state so dropout-like randomness can remain deterministic between the original forward and replay.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost model is straightforward but workload-specific. Memory drops because fewer activations remain live. Wall-clock time rises because some computation is repeated. The best checkpoint boundaries are regions with large activations and tolerable replay cost. Poor boundaries can save little memory while replaying expensive kernels. For transformer training, checkpointing whole transformer blocks is common because each block has a natural boundary and a large activation footprint.',
        'Correctness complexity comes from replay semantics. The recomputed forward must behave like the original forward. Randomness, global state, data-dependent control flow, mutation, detached tensors, and side effects need care. This is why framework documentation distinguishes checkpoint variants and warns when backward recomputation can differ from the original forward.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Activation checkpointing is one of the standard levers for training larger language models, diffusion models, long-context transformers, and deep vision networks. It is often combined with mixed precision, ZeRO Optimizer, Fully Sharded Data Parallel, tensor parallelism, pipeline parallelism, and careful Batch Size Scaling. Each lever attacks a different part of the memory budget: parameters, optimizer state, gradients, activations, or temporary workspace.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A common mistake is treating checkpointing as a performance optimization. It is usually a memory optimization that costs time. If the model already fits comfortably and the bottleneck is compute, checkpointing can make training slower for no gain. Another mistake is checkpointing stateful or random code without understanding determinism. If replay does not match the original forward, gradients can be wrong in ways that are hard to diagnose.',
        'Checkpointing also does not replace distributed training. It may let one GPU fit a larger batch or longer context, but optimizer states, parameters, and gradients can still exceed memory. That is where ZeRO, tensor parallelism, and pipeline parallelism enter.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: PyTorch activation checkpointing docs at https://docs.pytorch.org/docs/2.9/checkpoint.html and Training Deep Nets with Sublinear Memory Cost at https://arxiv.org/abs/1604.06174. Study Activation Rematerialization Budget Planner, Backpropagation, Batch Size Scaling, ZeRO Optimizer, Tensor Parallelism, Pipeline Parallelism, and Transformer Block next.',
      ],
    },
  ],
};
