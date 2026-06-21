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
  yield {
    state: layerGraph('Column split: each GPU owns output features'),
    highlight: { active: ['x', 'gpu0', 'gpu1', 'e-x-g0', 'e-x-g1'], found: ['partial0', 'partial1'] },
    explanation: 'The two GPU branches are shards of one logical layer. In a column-wise split, every rank sees the same input, multiplies by its own output-feature columns, and produces a different slice of Y.',
  };

  yield {
    state: layerGraph('All-gather can assemble the full output'),
    highlight: { active: ['partial0', 'partial1', 'collective', 'e-p0-c', 'e-p1-c'], found: ['y'] },
    explanation: 'If the next operation needs the full output, the slices are all-gathered. If the next operation is row-wise parallel, the system can keep the output sharded and avoid an immediate gather.',
    invariant: 'Tensor parallelism preserves the logical layer; it changes where pieces of the tensor live.',
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
    explanation: 'The split dimension determines the repair operation. Split output features and you concatenate slices. Split input features and each rank computes a partial sum, so you reduce those partial sums.',
  };

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
    explanation: 'Tensor parallelism is strongest for very large layers on fast interconnects. It is not a universal speedup: if communication costs more than the local matmul saved, the split is a loss.',
  };
}

function* transformerBlock() {
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
    explanation: 'Each row is a layout decision inside the transformer block. QKV and MLP expansion are natural output-feature splits; output projection and MLP down-projection create partial sums that must be reduced.',
  };

  yield {
    state: layerGraph('A row-wise projection reduces partial sums'),
    highlight: { active: ['partial0', 'partial1', 'collective'], found: ['e-p0-c', 'e-p1-c', 'e-c-y'] },
    explanation: 'In a row-wise linear layer, each rank owns input-feature rows and computes a partial output. The partial outputs must be summed, so the repair collective is all-reduce rather than all-gather.',
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
    explanation: 'Large model training composes several dimensions of splitting. Tensor parallelism handles single-layer width; pipeline parallelism handles depth; data parallelism handles examples; ZeRO handles redundant state.',
  };

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
    explanation: 'Most tensor-parallel bugs are layout bugs. Always ask what each rank owns before and after the layer, and what collective restores the layout expected by the next operation.',
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
      heading: 'Why This Exists',
      paragraphs: [
        'Tensor parallelism exists because a single transformer layer can become the unit that no longer fits. Data parallelism gives each GPU a different mini-batch and a complete model replica, so it scales examples but does not shrink one huge matrix multiplication. Pipeline parallelism places different layers on different devices, so it scales depth but still leaves a single wide layer intact. Tensor parallelism attacks the layer itself: several ranks cooperate on the same tokens and make one logical operation out of several local operations.',
        'The pressure shows up in both memory and time. A large projection stores billions of weights, produces large activations, and may create intermediate tensors that cannot be cheaply replicated. During inference, a tensor-parallel group may be the only way to serve a model whose weights do not fit on one accelerator. During training, the same split can keep matmul work distributed while optimizer state and activation strategies handle other memory costs.',
        {type: 'callout', text: 'Tensor parallelism is a layout contract: every shard boundary must name the collective that reconstructs the next legal tensor.'},
      ],
    },
    {
      heading: 'The Obvious Split And The Wall',
      paragraphs: [
        'The first reasonable attempt is layer placement: put layer 0 on GPU 0, layer 1 on GPU 1, and send activations forward. That can help a deep network, and it is easy to explain. The wall is width. If one attention projection or MLP projection is too large for a device, moving whole layers around does not change the fact that one layer still wants more memory or compute than one GPU should provide.',
        'The second attempt is manual slicing. An engineer can split a weight matrix, fix the immediate shape error, and keep patching until the model runs. That fails because tensor layout becomes hidden state. One rank may hold output features, another path may expect replicated activations, and a later layer may silently need summed partials. Without a contract for what each rank owns before and after every layer, the implementation becomes a pile of lucky shape repairs.',
      ],
    },
    {
      heading: 'Core Insight',
      paragraphs: [
        'The core insight is that a dense layer can be algebraically decomposed if the repair operation matches the split. For a linear layer Y = XW, a column split partitions W by output columns. Every rank receives the same X, computes a different slice of Y, and the full output is the concatenation of those slices. A row split partitions W by input rows. Every rank sees a slice of X, computes a partial contribution to the same output coordinates, and the correct output is the sum of the partials.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes', caption: 'Layer diagrams make the split point visible: tensor parallelism cuts inside a layer rather than moving whole layers. Source: Wikimedia Commons, Glosser.ca, CC BY-SA 3.0: https://commons.wikimedia.org/wiki/File:Colored_neural_network.svg.'},
        'That repair rule is the invariant. Output-feature splits create pieces that need concatenation or all-gather if the next layer wants the full tensor. Input-feature splits create partial sums that need all-reduce or reduce-scatter. Sequence parallelism moves the split to the token dimension, often to reduce activation memory around normalization and dropout. The technique is not just "split the tensor"; it is "split on a dimension whose algebra tells you how to restore the next layout."',
      ],
    },
    {
      heading: 'How The System Works',
      paragraphs: [
        'A tensor-parallel plan starts by choosing a process group and a device mesh. Inside that group, each rank owns a shard of selected parameters and follows the same program with different local data. The runtime must track whether a tensor is replicated, sharded along hidden dimension, sharded along sequence dimension, or already partially reduced. PyTorch DTensor describes these layouts explicitly; Megatron-style implementations often encode the same idea in parallel linear modules and collective calls.',
        'A transformer block has useful natural cuts. QKV projection and MLP expansion are wide output-producing layers, so they often use column-wise sharding. Attention heads can remain local after the QKV split because each rank can process its assigned heads. Output projection and MLP down-projection collapse features back to the model width, so they often use row-wise sharding and all-reduce partial sums. The best plans arrange those cuts so the output layout of one operation is already the input layout of the next.',
      ],
    },
    {
      heading: 'What The Visual Proves',
      paragraphs: [
        'The first view proves that tensor parallelism is a semantic-preserving rewrite, not a different model. The graph still has one logical input and one logical output. The two GPU branches only change where the multiplications happen and where the intermediate slices live. The collective node is the repair point that restores the layout required by the next operation.',
        'The table proves why different splits need different collectives. A column-wise layer produces disjoint output coordinates, so gathering is a layout operation. A row-wise layer produces overlapping output coordinates, so reduction is a math operation. The transformer view then shows why this matters in practice: the QKV and MLP expansion cuts are cheap if the following operation can consume shards, while the down projections have to pay the reduction tax.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'Correctness comes from ordinary matrix algebra plus a layout invariant. In the column case, W = [W0 W1], so XW = [XW0 XW1]. Each rank computes a non-overlapping slice of the output, and concatenating slices gives the same tensor as the unsplit layer. In the row case, split X and W across the input dimension: XW = X0W0 + X1W1 + ... . Each rank computes one term in that sum, and reducing the terms gives the same output coordinates. The animation makes the invariant visible: every split has a matching repair.',
      ],
    },
    {
      heading: 'Cost And Tradeoffs',
      paragraphs: [
        'Tensor parallelism spends communication to buy memory headroom and parallel matmul throughput. When a layer is enormous and ranks are connected by NVLink, NVSwitch, or a fast local fabric, the local compute saved can dominate the collective cost. When the layer is small, the batch is tiny, or the group crosses slow network links, the collective can cost more than the matmul it replaced. Doubling the number of tensor-parallel ranks roughly shrinks each local shard, but it also increases the number of participants that must synchronize.',
        'The practical costs are not only bandwidth. Tensor parallelism adds shape constraints, placement constraints, debugging complexity, and numerical differences from reduction order. It can also fight batching in inference: one request may reserve several GPUs at once, so poor scheduling wastes an entire group. It composes with data parallelism, pipeline parallelism, and ZeRO/FSDP, but each extra dimension adds another mapping between logical tensors and physical ownership.',
      ],
    },
    {
      heading: 'Where It Wins And Where It Fails',
      paragraphs: [
        'It wins on very wide transformer layers, especially attention projections, output projections, and MLP blocks whose parameter and activation footprints are too large for one GPU. It is common in large-model training stacks and in inference servers that shard a single model across a fixed group of accelerators. It is also useful as a teaching bridge: once the layout contract is clear, GPU All-Reduce, reduce-scatter, all-gather, sequence parallelism, and 3D parallel training become variations of the same ownership problem.',
        'It fails when communication is the bottleneck, when ranks are placed across weak links, when the serving system cannot keep every rank busy, or when the model has many small operations that do not amortize collective latency. It also fails as an engineering practice when layout is implicit. Most tensor-parallel bugs are layout bugs: a tensor is treated as replicated when it is sharded, a reduce is used where a gather is required, or a downstream operation consumes partial sums as if they were complete values.',
      ],
    },
    {
      heading: 'Sources And Study Next',
      paragraphs: [
        'Primary sources: PyTorch tensor parallel docs at https://docs.pytorch.org/docs/stable/distributed.tensor.parallel.html, the Megatron-LM tensor-parallel paper at https://arxiv.org/abs/1909.08053, and the large-scale Megatron-LM training paper at https://arxiv.org/abs/2104.04473. Study GPU All-Reduce for the collective repair step, Pipeline Parallelism for depth splitting, ZeRO Optimizer and Fully Sharded Data Parallel for state sharding, Transformer Block for the layer anatomy, and Ring Attention or sequence parallelism for token-dimension splits.',
      ],
    },
  ],
};
