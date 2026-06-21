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
    explanation: 'Read the stored row as the live activation set that must survive until backward. The default strategy is fast because backward can read saved tensors, but deep networks and long sequences can make that row dominate memory.',
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
    explanation: 'Read saved nodes as restart points and dropped nodes as replay work. A checkpoint is most useful when it brackets large activations whose forward compute is acceptable to run again.',
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
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for Activation Checkpointing. Save only selected activations during the forward pass, then recompute missing intermediates during backward to fit larger models..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
        {type: "callout", text: "Checkpointing changes activation memory from a long-lived trace into short replay windows with saved boundaries."},
      ],
    },
    {
      heading: 'Why it matters',
      paragraphs: [
        'Activation checkpointing exists because training memory is not just model weights. Backpropagation needs intermediate activations from the forward pass, and in deep transformers with long sequences those activations can dominate GPU memory. A model can have enough compute available and still fail because the backward pass cannot keep the live activation set.',
        'Checkpointing changes the contract: save only selected boundary activations, discard the rest, and recompute missing intermediates during backward. PyTorch describes this as trading compute for memory: https://docs.pytorch.org/docs/2.9/checkpoint.html. The sublinear-memory line of work by Chen, Xu, Zhang, and Guestrin made the same trade explicit: https://arxiv.org/abs/1604.06174.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The naive training strategy stores every activation that backward might need. It is fast because gradients can read saved tensors directly, but it scales poorly with depth, sequence length, batch size, and attention shape.',
        'The other naive reaction is to checkpoint everything. That may fit, but it can replay expensive kernels so much that the job becomes slower than necessary. Good checkpointing is selective: save boundaries that are worth keeping and replay interiors that are cheap enough to recompute.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Imagine a model as a chain of blocks. Without checkpointing, each block output stays alive until backward reaches it. With checkpointing, the runtime saves the input or output boundary of a region, drops interior activations, and later reruns that region forward during backward to rebuild the exact intermediates needed for gradient formulas.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes', caption: 'Layered networks make the saved-boundary idea concrete: keep selected block outputs and rebuild missing interiors during backward. Source: Wikimedia Commons, Glosser.ca, CC BY-SA 3.0.'},
        'The recomputed activations are temporary. They exist just long enough to compute gradients for that segment, then they can be freed. The memory win comes from keeping fewer tensors live across the whole forward-to-backward gap. The compute cost comes from executing parts of the forward pass twice.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'In the save-versus-recompute view, the ordinary timeline shows every stored cell filled. That is the fast but memory-heavy baseline. The checkpointed timeline has saved boundary cells and recompute cells. Read the blanks as tensors that are deliberately not kept alive.',
        'In the checkpoint-placement view, the graph is a chain of blocks. Saved nodes are restart points. Dropped nodes are rebuilt when backward needs them. The placement tables are there to make the real decision visible: checkpoint large activation regions, avoid replaying expensive or unsafe work, and handle randomness deliberately.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Backpropagation needs certain forward intermediates, but it does not require every intermediate to remain live from the original forward pass. If the computation inside a segment is deterministic and replayable, the system can recover the needed tensors later by rerunning that segment from a saved boundary.',
        'That changes peak memory because the expensive part is the long interval between forward creation and backward use. Checkpointing shortens the lifetime of many activations. They are recreated near the moment they are needed, used for gradients, and freed again.',
      ],
    },
    {
      heading: 'Real systems',
      paragraphs: [
        'Activation checkpointing is a standard lever for large language models, diffusion models, long-context transformers, and deep vision networks. Transformer blocks are common checkpoint boundaries because they are natural units with large activation footprints and manageable replay cost.',
        'It stacks with other memory techniques. Mixed precision reduces tensor bytes. ZeRO and FSDP reduce replicated optimizer, gradient, and parameter state. Tensor parallelism splits wide layers. Pipeline parallelism splits depth. Checkpointing attacks activations specifically, so it should be measured as a separate row in the memory budget.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Checkpointing is usually a memory optimization that costs time. If the model already fits and compute is the bottleneck, it can make training slower for no benefit. Poor boundaries can save little memory while replaying expensive attention or matmul work.',
        'Correctness depends on replay semantics. The recomputed forward must match the original forward. Randomness, dropout masks, global state, mutation, detached tensors, data-dependent control flow, and hidden side effects can make gradients wrong in ways that are hard to spot.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Start with a memory ledger: parameters, gradients, optimizer state, activations, temporary workspace, and communication buckets. Use checkpointing when activations are the limiting row. If optimizer state is the limiting row, ZeRO or FSDP may be the first move instead.',
        'Pick boundaries that save large activations and replay tolerable compute. Validate peak memory, step time, loss parity, and RNG determinism on a small run before scaling up. Keep the policy documented so later changes to dropout, attention kernels, or block structure do not silently break replay.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a transformer has 48 blocks and each block keeps large attention and MLP activations. Without checkpointing, the forward pass leaves a long trail of saved tensors for backward. With checkpointing every four blocks, the runtime saves the boundary states at blocks 0, 4, 8, and so on, then discards many interior tensors.',
        'During backward for blocks 5 through 8, the system reruns the forward from the block-4 checkpoint to rebuild the exact intermediates, computes gradients for that segment, and frees the temporary activations. Peak memory falls because only boundaries and one replay window need to be live, but step time rises because some forward work is repeated.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The first production question is whether activations are actually the limiting row in the memory ledger. If optimizer state, gradients, parameters, communication buffers, or temporary workspaces dominate peak memory, checkpointing may slow the job without solving the real bottleneck.',
        'The second question is replay safety. Dropout, random augmentations, mutable module state, custom kernels, detached tensors, and data-dependent branches can make recomputation differ from the original forward pass. Frameworks provide RNG handling, but teams still need parity checks because silent gradient drift is possible.',
        'The third question is placement. Checkpoint too little and memory barely moves. Checkpoint too much and the job pays heavy recompute cost. Good policies are measured by peak memory, step time, throughput per dollar, and loss parity, not by the number of blocks labeled checkpointed.',
      ],
    },
    {
      heading: 'When to choose it',
      paragraphs: [
        'Use checkpointing when the model nearly fits, activations dominate peak memory, and extra forward compute is cheaper than buying more memory or reducing sequence length. It is especially useful for deep transformers, long-context training, and diffusion models where activation volume grows quickly.',
        'Avoid treating it as the first answer to every out-of-memory error. Sometimes the right move is smaller batch size, mixed precision, sequence packing, ZeRO or FSDP, tensor parallelism, or changing attention kernels. Checkpointing is one row in the memory playbook, not the whole playbook.',
      ],
    },
    {
      heading: 'Rule of thumb',
      paragraphs: [
        'If a training run fails because activation memory peaks during the forward-to-backward gap, checkpointing is a strong candidate. If it fails before activations dominate, checkpointing may only hide the real problem.',
        'Start with natural module boundaries and measure. The best checkpoint is not the one that saves the most tensors; it is the one that reduces peak memory enough while adding the least replay cost and the least correctness risk.',
        'Keep the policy close to the model definition. Future changes to dropout, custom attention kernels, normalization, or block layout can change replay behavior. A checkpointing plan that is invisible to future maintainers is technical debt in the training loop.',
        'The clean mental model is lifetime shortening. Checkpointing does not make activations free; it changes when they exist. That is why memory falls while compute rises, and why the trade should be measured on the actual training step.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Training a neural network requires a forward pass (compute activations) then a backward pass (compute gradients using those activations). The naive strategy: store ALL intermediate activations from the forward pass. For a 100-layer network with batch size 32, each layer stores roughly 100 MB of activations, totaling 10 GB. GPT-3 with 96 layers: activations alone can exceed 100 GB per batch, more than the model weights. This is why you run out of GPU memory during training even with a small batch size.',
        'Gradient checkpointing (Chen et al. 2016): do not store all activations. Divide layers into segments. Only store activations at segment boundaries, the checkpoints. During the backward pass, recompute activations within each segment from the checkpoint. Memory: O(sqrt(n)) instead of O(n) for n layers. Cost: one extra forward pass through each segment. Time increases roughly 33% but memory drops roughly 10x.',
        'Optimal placement: sqrt(n) evenly spaced checkpoints for n layers. For 100 layers: 10 checkpoints, store 10 activations, recompute up to 10 layers per segment. Memory: 10x reduction. Compute: roughly 33% overhead. This is what makes training large transformers feasible on limited GPU memory.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Chen et al. 2016, Training Deep Nets with Sublinear Memory Cost (https://arxiv.org/abs/1604.06174), the foundational gradient checkpointing paper. Griewank and Walther 2000, Algorithm 799: Revolve, the optimal checkpointing schedule.',
        'Study next: Backpropagation (activation checkpointing modifies the backward pass), Transformer Block (the layers being checkpointed), Gradient Accumulation (complementary memory-saving technique), Mixed Precision Training (another memory optimization), Flash Attention (reduces attention activation memory).',
      ],
    },
    {
      heading: 'Micro checks',
      paragraphs: [
        '4-layer network: layers L1, L2, L3, L4. Naive: forward stores a1, a2, a3, a4 (4 activations). Backward uses a4 for L4 grad, a3 for L3 grad, and so on. Memory: 4 units.',
        'Checkpointing with 1 checkpoint (after L2): forward stores a2 (checkpoint). Memory: 1 unit. Backward: L4 grad needs a4, which is not stored. Recompute: run forward from a2 through L3, L4 to get a3, a4. Compute L4 grad using a4. Free a4. Compute L3 grad using a3. Free a3. Now need a1 for L1 grad: recompute from input through L1.',
        'Total recomputation: layers L3, L4 (once), L1 (once). Memory peak: 2 activations (checkpoint + 1 recomputed). 2x memory reduction for 75% recomputation overhead. With sqrt(4) = 2 checkpoints, this is optimal.',
      ],
    },
    {
      heading: 'Try this now',
      paragraphs: [
        'Selective checkpointing: not all layers have equal activation sizes. Attention layers store the n-by-n attention matrix, which is huge. FFN layers store smaller intermediate activations. Strategy: checkpoint attention layers (free the n-by-n matrix), keep FFN activations (small). This reduces memory more than uniform checkpointing with the same recomputation cost.',
        'In practice: PyTorch\'s torch.utils.checkpoint.checkpoint() wraps any module. Usage: wrap each transformer block. During forward, inputs to each block are saved, internal activations are freed. During backward, recompute the block\'s internal activations from saved inputs.',
        'Gradient accumulation combo: with checkpointing (10x memory reduction) + gradient accumulation over 8 micro-batches, the effective batch size is 8x larger while using 10x less activation memory. This is how you train a 7B model on a single A100 80GB.',
      ],
    },
  ],
};
