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
    explanation: `Read the stored row as the live activation set that must survive until backward. All ${layers.length} blocks keep their activations — the default strategy is fast because backward can read saved tensors, but deep networks and long sequences can make that row dominate memory.`,
  };

  yield {
    state: timeline('Checkpointing stores only boundary activations', [
      [1, 1, 1, 1, 1, 1],
      [2, 0, 0, 2, 0, 2],
      [3, 4, 4, 3, 4, 3],
    ], { 0: '', 1: 'compute', 2: 'saved', 3: 'read', 4: 'recompute' }),
    highlight: { active: ['store:l1', 'store:l4', 'store:l6'], compare: ['bwd:l2', 'bwd:l3', 'bwd:l5'] },
    explanation: `Activation checkpointing saves ${[2, 0, 0, 2, 0, 2].filter(v => v === 2).length} boundary tensors across ${layers.length} blocks and discards the rest. During backward, the ${[3, 4, 4, 3, 4, 3].filter(v => v === 4).length} missing tensors are recomputed from the nearest saved boundary instead of loaded from memory.`,
    invariant: `Checkpointing trades extra forward compute for lower activation memory — ${layers.length - [2, 0, 0, 2, 0, 2].filter(v => v === 2).length} blocks recomputed on the fly.`,
  };

  yield {
    state: chainState('Backward replays a segment only when its activations are needed'),
    highlight: { active: ['b3', 'b4', 'b5', 'e-b3-b4', 'e-b4-b5'], found: ['loss'] },
    explanation: `The backward pass walks from loss toward input across all ${layers.length} blocks. When it reaches a checkpointed region spanning blocks like ${layers[2].label}–${layers[4].label}, it reruns that region forward to rebuild the intermediates needed for gradients, then immediately frees them.`,
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
    explanation: `Checkpointing is not one fixed algorithm — the matrix compares ${['ordinary backprop', 'manual checkpoints', 'selective policy', 'compiler-assisted'].length} strategies across ${['activation memory', 'extra compute', 'risk'].length} dimensions. The practical question is what to save, what to recompute, and which operations are too expensive or too stateful to replay freely.`,
  };
}

function* checkpointPlacement() {
  yield {
    state: chainState('Good checkpoints bracket expensive memory regions'),
    highlight: { found: ['b1', 'b3'], active: ['b2', 'b4', 'b5'] },
    explanation: `Read saved nodes (${layers[0].label}, ${layers[2].label}) as restart points and the remaining ${layers.length - 2} dropped nodes as replay work. A checkpoint is most useful when it brackets large activations whose forward compute is acceptable to run again.`,
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
    explanation: `Replay must be semantically equivalent to the original forward pass across all ${layers.length} blocks. Dropout and random operations require RNG handling; hidden side effects or global state can silently break gradients — ${'careful'} and ${'avoid or isolate'} mark the dangerous rows.`,
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
    explanation: `Activation checkpointing stacks with ${['mixed precision', 'ZeRO/FSDP', 'sequence length', 'batch size'].length} other memory levers — sharded optimizer state, tensor parallelism, mixed precision, and batch-size tuning. It is usually one lever in a larger memory budget across all ${layers.length} blocks.`,
  };

  yield {
    state: timeline('Final mental model: save boundaries, replay interiors', [
      [1, 1, 1, 1, 1, 1],
      [2, 0, 0, 2, 0, 2],
      [3, 4, 4, 3, 4, 3],
    ], { 0: '', 1: 'forward', 2: 'boundary', 3: 'read', 4: 'replay' }),
    highlight: { found: ['store:l1', 'store:l4', 'store:l6'], active: ['bwd:l2', 'bwd:l3', 'bwd:l5'] },
    explanation: `The final frame is the entire idea: memory keeps only ${[2, 0, 0, 2, 0, 2].filter(v => v === 2).length} boundaries across ${layers.length} blocks to rebuild the ${[2, 0, 0, 2, 0, 2].filter(v => v === 0).length} missing interiors. Training becomes slower, but models that did not fit can become trainable.`,
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
        'The animation shows two views of activation checkpointing. In "save vs recompute," a timeline grid tracks six blocks across three rows: forward (when each block runs), stored (which activations stay in memory), and backward (whether each block reads a saved tensor or recomputes it). In "checkpoint placement," a chain graph shows blocks as nodes with edges for data flow, and companion tables compare placement strategies.',
        'Active cells or nodes mark the current decision point. Found markers are outcomes the algorithm has locked in. Blanks in the stored row are tensors deliberately discarded. At each frame, read what changed, why discarding is safe, and what replay will cost.',
        {type: "callout", text: "Checkpointing changes activation memory from a long-lived trace into short replay windows with saved boundaries."},
        {type: 'image', src: './assets/gifs/activation-checkpointing.gif', alt: 'Animated walkthrough of the activation checkpointing visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Training a neural network has two phases. The forward pass pushes data through every layer and records intermediate results called activations. The backward pass walks backward through the same layers, using those saved activations to compute gradients that update the weights. Both phases must finish before the weights change.',
        'The problem is that every saved activation occupies GPU memory for the entire duration between its creation in forward and its use in backward. A 96-layer GPT-class model with sequence length 2048 and batch size 8 can accumulate over 60 GB of live activations, exceeding the 80 GB capacity of an A100 even before counting weights, optimizer state, and gradients. The model has enough compute to train, but it cannot fit.',
        'Activation checkpointing exists to break this bottleneck. Instead of keeping every intermediate tensor alive, the system saves only selected boundary activations, discards the rest, and rebuilds missing intermediates on demand during backward. Memory drops because fewer tensors survive the forward-to-backward gap. The cost is extra forward compute: some layers run twice.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The default training strategy is simple: run forward through all n layers, store every intermediate activation, then run backward reading each stored tensor exactly once. For a 100-layer network where each layer produces 100 MB of activations, this means 10 GB of live tensors by the time backward starts. The approach is fast because backward never waits for recomputation, but it treats GPU memory as unlimited.',
        'A second naive reaction is to store nothing and recompute everything from the input for each layer during backward. That makes memory O(1) in activations, but the compute cost is catastrophic: backward for layer k requires replaying layers 1 through k, giving O(n^2) total forward work for n layers. A 100-layer model would run roughly 5,000 forward layer passes instead of 100.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Store-everything fails because activation memory grows linearly with depth, sequence length, and batch size. A transformer block at sequence length 4096 with hidden dimension 4096 stores attention logits of shape (batch, heads, 4096, 4096) plus MLP intermediates. Each block can hold hundreds of megabytes, and a deep model stacks dozens of them. Doubling depth doubles activation memory. Doubling sequence length can quadruple attention activations.',
        'Store-nothing fails because the recomputation cost is quadratic. Neither extreme is acceptable for production training. The real question is: which activations are worth keeping, and which are cheap enough to rebuild?',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Think of the model as a chain of blocks. Divide the chain into segments by saving the output of every k-th block. These saved outputs are checkpoints, the restart points for replay. During backward, when the system needs the interior activations of a segment, it reruns that segment\'s forward pass from the nearest checkpoint, rebuilds the missing tensors, computes gradients for that segment, and immediately frees the rebuilt tensors.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes', caption: 'Layered networks make the saved-boundary idea concrete: keep selected block outputs and rebuild missing interiors during backward. Source: Wikimedia Commons, Glosser.ca, CC BY-SA 3.0.'},
        'The rebuilt activations are short-lived. They exist only for the duration of one segment\'s gradient computation, then they are freed. This changes activation memory from a long-lived trace spanning the entire forward-to-backward gap into a series of short replay windows bounded by saved checkpoints. Peak memory now depends on the number of checkpoints plus the size of one replay window, not on the total depth of the network.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Forward pass: run every block normally, but only keep activations at checkpoint boundaries. For a 24-layer model with checkpoints every 4 layers, the system saves 6 boundary tensors (at layers 4, 8, 12, 16, 20, 24) and discards 18 interior tensors. The forward output and loss are computed normally.',
        'Backward pass: the system processes segments in reverse. To compute gradients for layers 21-24, it loads the checkpoint at layer 20, reruns layers 21-24 forward to rebuild their interior activations, computes gradients for those 4 layers using the rebuilt tensors, then frees the rebuilt tensors. It repeats this for layers 17-20 using the checkpoint at layer 16, and so on back to the input.',
        'At any moment during backward, only one segment\'s worth of rebuilt activations needs to be live, plus the set of saved checkpoints. The system processes one segment, frees its replay tensors, then moves to the next. This is why memory scales with the number of checkpoints plus segment size, not with total depth.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on one property: deterministic replay. If running layers k+1 through k+m from the same input produces the same activations as the original forward pass, then the gradients computed from those rebuilt activations are identical to the gradients that would have been computed from the stored originals. The chain rule does not care whether an activation was saved from the first forward pass or recomputed from a checkpoint. It only needs the correct numerical values.',
        'Memory falls because the expensive part of store-everything is the lifetime of each tensor. A tensor created at layer 5 and consumed at layer 5 during backward lives for nearly the entire training step. Checkpointing shortens that lifetime: the tensor is rebuilt moments before it is needed and freed moments after. Shorter lifetimes mean fewer tensors coexist in memory at any instant.',
        'The compute overhead is bounded. Each layer runs forward at most twice: once in the original forward pass and once during replay. Total forward work is at most 2x the original, making the worst-case compute overhead roughly 33% of total step time (since backward is typically about 2x the cost of forward, the extra forward pass adds roughly 1/3 to the total).',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Without checkpointing, activation memory is O(n) for n layers and compute is one forward pass plus one backward pass. With sqrt(n) evenly spaced checkpoints (the Chen et al. optimal schedule), activation memory drops to O(sqrt(n)) while forward compute doubles. For 100 layers: naive stores 100 activation sets; checkpointing with 10 boundaries stores 10, plus at most 10 from one replay window, totaling roughly 20. That is a 5x memory reduction for about 33% more wall-clock time.',
        'The 33% overhead is a rule of thumb. In practice, the replay cost depends on what the replayed layers do. Attention layers with quadratic cost are expensive to replay. Simple linear or normalization layers are cheap. Selective checkpointing can avoid replaying expensive operations while still freeing their large activations, shaving the overhead below 33% at the cost of more complex checkpoint logic.',
        'Checkpointing composes with other memory techniques. Mixed precision halves tensor bytes. ZeRO/FSDP shards optimizer state and gradients across GPUs. Tensor parallelism splits wide layers. These techniques attack different rows of the memory budget. Checkpointing specifically attacks the activation row, so it stacks with all of them. A typical large-model recipe uses all four together.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Large language model training (GPT-scale and beyond) checkpoints every transformer block. Each block is a natural boundary: its input and output have the same shape, its internal attention and MLP activations are large, and its forward compute is fast enough that replaying one block is acceptable. Megatron-LM, DeepSpeed, and FSDP all support this pattern.',
        'Diffusion model training benefits because the U-Net backbone is deep and activation-heavy. Stable Diffusion and similar models use checkpointing to fit on consumer GPUs during fine-tuning. Long-context transformers (sequence lengths 32k-128k+) benefit disproportionately because attention activations grow quadratically with sequence length, making the activation row the dominant memory consumer.',
        'In PyTorch, wrapping a module with torch.utils.checkpoint.checkpoint() tells the autograd engine to discard that module\'s internal activations during forward and recompute them during backward. The user chooses which modules to wrap. In JAX, jax.checkpoint (formerly jax.remat) provides the same trade with a functional API.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'If activations are not the limiting row in the memory budget, checkpointing slows the job without helping. A model whose memory is dominated by optimizer state (Adam stores two extra copies of every parameter) needs ZeRO or FSDP, not checkpointing. Always profile before choosing.',
        'Replay correctness breaks when the forward pass is not deterministic. Dropout generates random masks; if the replay uses different random numbers, the rebuilt activations differ from the originals, and gradients become wrong. PyTorch handles this by saving and restoring the RNG state at each checkpoint boundary, but custom stochastic operations, mutable global state, data-dependent control flow, and side effects can still cause silent gradient drift.',
        'Poor checkpoint placement wastes compute without saving much memory. Checkpointing only small-activation layers frees little memory. Checkpointing expensive layers (like attention with quadratic cost) adds heavy replay overhead. The best boundaries sit where activations are large and replay is cheap, which requires profiling the actual model, not guessing.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a 48-layer transformer. Each layer stores 200 MB of activations (attention logits, MLP intermediates, residual states). Naive training: 48 x 200 MB = 9.6 GB of live activations. An A100 with 80 GB must also hold model weights (say 14 GB for a 7B model in fp16), optimizer state (28 GB for Adam), gradients (14 GB), and workspace. Total non-activation memory: roughly 58 GB. That leaves 22 GB for activations, but the model needs 9.6 GB, so it fits, barely, at batch size 1.',
        'To train with batch size 4, activations quadruple to 38.4 GB. That exceeds the 22 GB budget by 16.4 GB. Checkpoint every 4 layers: save 12 boundary tensors (12 x 200 MB = 2.4 GB) plus one replay window of 4 layers (4 x 200 MB = 0.8 GB). Peak activation memory: 3.2 GB. That is a 12x reduction, well within the 22 GB budget, and the job now fits at batch size 4.',
        'The cost: each segment of 4 layers replays once during backward, so 48 layers of extra forward work. Original forward: 48 layer-passes. Backward: roughly 96 layer-passes (2x forward cost). Total without checkpointing: 144 layer-passes. With checkpointing: 48 (forward) + 48 (replay) + 96 (backward) = 192 layer-passes. Overhead: 192/144 = 1.33x, or about 33% slower per step. But the batch is 4x larger, so throughput per step increases despite the slower wall-clock time.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Chen, Xu, Zhang, and Guestrin, "Training Deep Nets with Sublinear Memory Cost" (2016, https://arxiv.org/abs/1604.06174) established the sqrt(n) checkpoint schedule and proved its optimality for uniform-cost layers. Griewank and Walther, "Algorithm 799: Revolve" (2000) solved the general optimal checkpoint placement problem for non-uniform costs, foundational for compiler-automated checkpointing.',
        'Study next: Backpropagation (the backward pass that checkpointing modifies), Transformer Block (the layers being checkpointed and the source of large activations), Gradient Accumulation (a complementary technique that reduces memory by splitting batches into micro-batches), Mixed Precision Training (halves tensor bytes, stacks with checkpointing), Flash Attention (reduces attention activation memory from O(n^2) to O(n), sometimes eliminating the need to checkpoint attention layers).',
      ],
    },
  ],
};
