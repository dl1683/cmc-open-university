// Tensor parallelism: split one large layer across GPUs and repair the split
// with collectives so the layer behaves like the original dense operation.

import { matrixState, graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'tensor-parallelism',
  title: 'Tensor Parallelism',
  category: 'Systems',
  summary: 'Shard a giant layer across GPUs so one sample is processed by several ranks, then use collectives to assemble the same result.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['column and row splits', 'transformer block'], defaultValue: 'column and row splits' },
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

function layerGraph(title) {
  return graphState({
    nodes: [
      { id: 'x', label: 'input X', x: 0.8, y: 3.6, note: 'tokens x hidden' },
      { id: 'gpu0', label: 'GPU 0', x: 3.1, y: 2.0, note: 'weight shard A' },
      { id: 'gpu1', label: 'GPU 1', x: 3.1, y: 5.2, note: 'weight shard B' },
      { id: 'partial0', label: 'partial Y0', x: 5.5, y: 2.0, note: 'local matmul' },
      { id: 'partial1', label: 'partial Y1', x: 5.5, y: 5.2, note: 'local matmul' },
      { id: 'collective', label: 'collective', x: 7.3, y: 3.6, note: 'gather or reduce' },
      { id: 'y', label: 'output Y', x: 9.1, y: 3.6, note: 'logical layer output' },
    ],
    edges: [
      { id: 'e-x-g0', from: 'x', to: 'gpu0', weight: 'replicate input' },
      { id: 'e-x-g1', from: 'x', to: 'gpu1', weight: 'replicate input' },
      { id: 'e-g0-p0', from: 'gpu0', to: 'partial0', weight: 'X W0' },
      { id: 'e-g1-p1', from: 'gpu1', to: 'partial1', weight: 'X W1' },
      { id: 'e-p0-c', from: 'partial0', to: 'collective', weight: 'partial' },
      { id: 'e-p1-c', from: 'partial1', to: 'collective', weight: 'partial' },
      { id: 'e-c-y', from: 'collective', to: 'y', weight: 'same semantics' },
    ],
  }, { title });
}

function* columnAndRowSplits() {
  const numGPUs = 2;
  const splitStrategies = ['column-wise', 'row-wise', 'sequence-wise', 'replicated'];

  yield {
    state: layerGraph('Column split: each GPU owns output features'),
    highlight: { active: ['x', 'gpu0', 'gpu1', 'e-x-g0', 'e-x-g1'], found: ['partial0', 'partial1'] },
    explanation: `The ${numGPUs} GPU branches are shards of one logical layer. In a column-wise split, every rank sees the same input, multiplies by its own output-feature columns, and produces a different slice of Y.`,
  };

  yield {
    state: layerGraph('All-gather can assemble the full output'),
    highlight: { active: ['partial0', 'partial1', 'collective', 'e-p0-c', 'e-p1-c'], found: ['y'] },
    explanation: `If the next operation needs the full output, the ${numGPUs} slices are all-gathered. If the next operation is row-wise parallel, the system can keep the output sharded and avoid an immediate gather.`,
    invariant: `Tensor parallelism preserves the logical layer across ${numGPUs} ranks; it changes where pieces of the tensor live.`,
  };

  yield {
    state: labelMatrix(
      'Column-wise and row-wise linear layers',
      [
        { id: 'column', label: 'column-wise' },
        { id: 'row', label: 'row-wise' },
        { id: 'sequence', label: 'sequence-wise' },
        { id: 'replicated', label: 'replicated' },
      ],
      [
        { id: 'partition', label: 'partition' },
        { id: 'collective', label: 'typical collective' },
        { id: 'shape', label: 'shape pressure' },
      ],
      [
        ['output features', 'all-gather if full output needed', 'wide MLP expansion'],
        ['input features', 'all-reduce partial sums', 'projection back down'],
        ['token dimension', 'reduce-scatter/all-gather', 'long sequence memory'],
        ['no tensor split', 'none inside layer', 'simple but memory-heavy'],
      ],
    ),
    highlight: { active: ['column:partition', 'row:collective'], found: ['sequence:shape'] },
    explanation: `This table covers ${splitStrategies.length} split strategies: ${splitStrategies.join(', ')}. The split dimension determines the repair operation. Split output features and you concatenate slices. Split input features and each rank computes a partial sum, so you reduce those partial sums.`,
  };

  const scenarios = ['huge layer', 'small layer', 'inside one node', 'cross-node'];
  yield {
    state: labelMatrix(
      'When tensor parallelism is worth it',
      [
        { id: 'huge', label: 'huge layer' },
        { id: 'small', label: 'small layer' },
        { id: 'node', label: 'inside one node' },
        { id: 'cross', label: 'cross-node' },
      ],
      [
        { id: 'benefit', label: 'benefit' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['parameters and matmul split', 'collective overhead'],
        ['little memory saved', 'communication dominates'],
        ['fast NVLink/NVSwitch', 'rank placement matters'],
        ['more aggregate memory', 'slow collectives can bottleneck'],
      ],
    ),
    highlight: { found: ['huge:benefit', 'node:benefit'], compare: ['small:risk', 'cross:risk'] },
    explanation: `This ${scenarios.length}-scenario comparison (${scenarios.join(', ')}) shows that tensor parallelism is strongest for very large layers on fast interconnects. If communication costs more than the local matmul saved, the split is a loss.`,
  };
}

function* transformerBlock() {
  const blockLayers = ['QKV projection', 'attention heads', 'MLP expansion', 'MLP projection'];
  const parallelDimensions = ['data parallel', 'tensor parallel', 'pipeline parallel', 'ZeRO/FSDP'];

  yield {
    state: labelMatrix(
      'Transformer parallelization plan',
      [
        { id: 'qkv', label: 'QKV projection' },
        { id: 'heads', label: 'attention heads' },
        { id: 'mlpup', label: 'MLP expansion' },
        { id: 'mlpdown', label: 'MLP projection' },
      ],
      [
        { id: 'split', label: 'split' },
        { id: 'communication', label: 'communication' },
      ],
      [
        ['column-wise', 'head shards'],
        ['head dimension', 'often local per head'],
        ['column-wise', 'sharded expansion'],
        ['row-wise', 'all-reduce partial sums'],
      ],
    ),
    highlight: { active: ['qkv:split', 'mlpup:split'], found: ['mlpdown:communication'] },
    explanation: `Each of the ${blockLayers.length} rows is a layout decision inside the transformer block: ${blockLayers.join(', ')}. QKV and MLP expansion are natural output-feature splits; output projection and MLP down-projection create partial sums that must be reduced.`,
  };

  yield {
    state: layerGraph('A row-wise projection reduces partial sums'),
    highlight: { active: ['partial0', 'partial1', 'collective'], found: ['e-p0-c', 'e-p1-c', 'e-c-y'] },
    explanation: `In a row-wise linear layer, each rank owns input-feature rows and computes a partial output. Across the ${blockLayers.length} transformer sub-layers, partial outputs must be summed, so the repair collective is all-reduce rather than all-gather.`,
  };

  yield {
    state: labelMatrix(
      '3D parallel training map',
      [
        { id: 'data', label: 'data parallel' },
        { id: 'tensor', label: 'tensor parallel' },
        { id: 'pipeline', label: 'pipeline parallel' },
        { id: 'zero', label: 'ZeRO/FSDP' },
      ],
      [
        { id: 'splits', label: 'splits' },
        { id: 'communication', label: 'communication' },
      ],
      [
        ['batch examples', 'gradient all-reduce'],
        ['tensors inside layer', 'in-layer collectives'],
        ['sequence of layers', 'activation sends'],
        ['training state', 'gather/scatter state'],
      ],
    ),
    highlight: { active: ['tensor:splits', 'tensor:communication'], found: ['pipeline:splits', 'zero:splits'] },
    explanation: `Large model training composes ${parallelDimensions.length} dimensions of splitting: ${parallelDimensions.join(', ')}. Tensor parallelism handles single-layer width; pipeline handles depth; data handles examples; ZeRO handles redundant state.`,
  };

  const debugCategories = ['shape mismatch', 'layout drift', 'no overlap', 'numerics'];
  yield {
    state: labelMatrix(
      'Debugging questions',
      [
        { id: 'shape', label: 'shape mismatch' },
        { id: 'layout', label: 'layout drift' },
        { id: 'overlap', label: 'no overlap' },
        { id: 'numerics', label: 'numerics' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'question', label: 'ask' },
      ],
      [
        ['runtime failure', 'which dimension is sharded?'],
        ['wrong collective', 'is tensor replicated or sharded?'],
        ['idle GPUs', 'can communication hide behind compute?'],
        ['tiny divergence', 'are reductions ordered and typed?'],
      ],
    ),
    highlight: { active: ['shape:question', 'layout:question'], compare: ['overlap:symptom', 'numerics:symptom'] },
    explanation: `Most tensor-parallel bugs fall into ${debugCategories.length} categories: ${debugCategories.join(', ')}. Always ask what each rank owns before and after the layer, and what collective restores the layout expected by the next operation.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'column and row splits') yield* columnAndRowSplits();
  else if (view === 'transformer block') yield* transformerBlock();
  else throw new InputError('Pick a tensor parallelism view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read each frame as a statement about tensor ownership. A tensor is a multidimensional array, a rank is one process in a distributed job, and a collective is a communication operation across ranks. The highlighted shard is the piece owned by the current GPU.',
        'The safe inference is tied to the split dimension. If a weight matrix is split by output columns, each rank computes different output coordinates and the pieces can be gathered. If it is split by input rows, each rank computes a partial sum and the pieces must be reduced.',
        {type: 'image', src: './assets/gifs/tensor-parallelism.gif', alt: 'Animated walkthrough of the tensor parallelism visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Tensor parallelism exists because a single neural-network layer can be too large or too slow for one accelerator. Data parallelism copies the full model to each GPU and splits examples, so it does not shrink one huge matrix multiplication. Pipeline parallelism splits layers by depth, but one wide layer can still be the bottleneck.',
        'Transformer models create this pressure in attention projections and feed-forward projections. A dense layer multiplies input X by weight W, and W may contain billions of parameters in large models. Tensor parallelism cuts inside that operation so several GPUs cooperate on one logical layer.',
        {type: 'callout', text: 'Tensor parallelism is a layout contract: every shard boundary must name the collective that reconstructs the next legal tensor.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first approach is to put whole layers on different GPUs. GPU 0 runs early layers, GPU 1 runs later layers, and activations move between them. This helps when the model is deep and each layer fits alone.',
        'A second approach is to slice a matrix by hand wherever memory breaks. That can get one experiment running, but it makes layout implicit. A later operation may consume a shard as if it were the full tensor, and the error can look like a shape bug rather than a distributed-systems bug.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that matrix algebra determines the repair operation. For Y = XW, a column split of W creates disjoint columns of Y. A row split of W creates terms that must be added to form the same Y.',
        'If the code forgets this distinction, it can produce the wrong tensor with the right shape. Gathering partial sums duplicates information that should have been added. Reducing output slices destroys coordinates that should have stayed separate.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to track both the shard and the rule that makes the next tensor legal. Tensor parallelism is not "put half the matrix here and half there." It is "put this dimension here, then use this collective to preserve the unsplit computation."',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes', caption: 'Layer diagrams make the split point visible: tensor parallelism cuts inside a layer rather than moving whole layers. Source: Wikimedia Commons, Glosser.ca, CC BY-SA 3.0: https://commons.wikimedia.org/wiki/File:Colored_neural_network.svg.'},
        'A column-parallel linear layer gives each rank the same input and different output features. A row-parallel linear layer gives each rank different input features and asks ranks to sum their contributions. The invariant is that after the declared collective, the next layer sees the same logical tensor the unsharded model would have produced.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A runtime first forms a tensor-parallel group, such as four GPUs connected by NVLink. Each rank loads the shard of parameters assigned to it. The program then runs the same layer schedule on each rank, but each rank computes only its local slice.',
        'For an attention QKV projection, the weight is often split by output heads. Each rank produces Q, K, and V for its assigned heads, and attention for those heads can run locally. The output projection then combines head outputs and often needs an all-reduce because ranks contribute partial sums to the same hidden coordinates.',
        'For an MLP block, the expansion projection is often column-parallel and the down projection is often row-parallel. Good plans arrange the pair so one layer produces the layout the next layer can consume. Bad plans insert extra all-gathers and all-reduces that erase the compute savings.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from matrix identities. If W is split into output-column blocks W0 and W1, then XW equals the concatenation of XW0 and XW1. Each rank owns a non-overlapping slice, so gathering reconstructs the full output.',
        'If X and W are split over the input dimension, then XW equals X0W0 plus X1W1 plus the remaining partial products. Each rank computes one term in the sum, so all-reduce reconstructs the full output. The animation is showing these identities as communication edges.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Tensor parallelism trades communication for memory headroom and local compute reduction. With p ranks, a perfectly sharded matrix gives each rank about one p-th of the parameters and one p-th of the multiply work for that layer. The collective cost grows with tensor size, group size, latency, and fabric bandwidth.',
        'Doubling ranks usually halves local shard size, but it does not halve end-to-end latency. More ranks add synchronization points, and the slowest rank gates the group. The method behaves well when matmuls are large and links are fast; it behaves badly when collectives dominate.',
        'The engineering cost is layout bookkeeping. The system must know whether each tensor is replicated, sharded by hidden dimension, sharded by sequence dimension, or a partial sum. Debugging failures requires inspecting both numeric values and ownership state.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Large language model training uses tensor parallelism when a transformer layer or its optimizer-adjacent state cannot fit on one GPU. It is commonly combined with data parallelism and pipeline parallelism to split examples, layers, and tensors at the same time. Megatron-style training popularized these layer-internal cuts.',
        'Inference servers use tensor parallelism when the model weights exceed one device or when latency requires several devices to compute one request. The serving scheduler must then allocate a whole group per request or per batch. That improves model capacity but makes underfilled groups expensive.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails on weak interconnects. A tensor-parallel group spread across slow network links can spend more time communicating than multiplying. Small layers, small batches, and short sequences often cannot amortize collective latency.',
        'It also fails when the rest of the system cannot keep every rank busy. One request may reserve four GPUs even if the batch is too small to use them well. Numerics can differ from the unsharded model because reductions happen in a different order, so exact bitwise equality is not guaranteed.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Let X be one token vector [2, 3] and W be [[1, 4, 7, 10], [2, 5, 8, 11]]. The unsharded result is [8, 23, 38, 53] because each output column is a dot product. With two-way column parallelism, rank 0 stores columns 0 and 1 and computes [8, 23], while rank 1 stores columns 2 and 3 and computes [38, 53].',
        'An all-gather returns [8, 23, 38, 53], exactly matching the unsharded layer. For a row split, rank 0 might compute [2, 8, 14, 20] from input 2 and the first row, while rank 1 computes [6, 15, 24, 33] from input 3 and the second row. An all-reduce sum gives [8, 23, 38, 53].',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources include the Megatron-LM tensor-parallel paper, Shoeybi et al. 2019, and PyTorch DTensor and tensor parallel documentation for explicit layout APIs. Megatron-Core and NVIDIA Transformer Engine are useful implementation references for column-parallel and row-parallel linear layers.',
        'Study GPU all-reduce next because it is the repair step for row splits. Then study pipeline parallelism, ZeRO or fully sharded data parallelism, sequence parallelism, and transformer inference scheduling to see how tensor ownership interacts with whole-system throughput.',
      ],
    },
  ],
};
