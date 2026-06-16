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
    explanation: 'A column-wise split partitions the weight matrix by output features. Every rank sees the same input, multiplies by its own weight columns, and produces a different slice of the output hidden dimension.',
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
    explanation: 'Transformer blocks have natural tensor-parallel cuts. Split QKV and MLP expansion by output features; split the output projection by input features and reduce partial sums.',
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
      heading: 'What it is',
      paragraphs: [
        'Tensor parallelism splits the tensors inside a single neural-network layer across multiple GPUs. Unlike data parallelism, where each GPU processes different examples with a full model replica, tensor parallelism lets multiple GPUs cooperate on the same example. This is necessary when one layer is too large, too expensive, or too memory-hungry for one accelerator to handle efficiently.',
        'PyTorch documents tensor parallelism as built on DTensor, with styles such as column-wise, row-wise, and sequence parallelism: https://docs.pytorch.org/docs/2.9/distributed.tensor.parallel.html. Megatron-LM made the idea famous for transformers by inserting a small number of communication operations around split linear layers: https://arxiv.org/abs/1909.08053.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with a linear layer Y = XW. In a column-wise split, W is partitioned by output columns. Each rank receives the same X and computes its own slice of Y. If the next operation expects full Y, ranks all-gather the slices. If the next operation can consume a sharded Y, the system keeps it sharded and avoids unnecessary movement. In a row-wise split, W is partitioned by input rows. Each rank computes a partial output, and those partial outputs must be summed with an all-reduce.',
        'Transformer blocks have natural cuts. Attention heads can be split across ranks. The QKV projection and MLP expansion are often column-parallel. The output projection and MLP down-projection are row-parallel, so partial sums are reduced. The art is arranging splits so one layer output layout becomes the next layer input layout with as few collectives as possible.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Tensor parallelism spends communication to save memory and increase local compute parallelism. It shines when matrix multiplications are huge and the interconnect is fast. It can disappoint when layers are small, batches are tiny, ranks are placed across slow links, or collectives sit exposed on the critical path. The split dimension, tensor layout, collective type, and rank mesh are performance decisions, not just implementation details.',
        'The core complexity is layout tracking. Is this tensor replicated, sharded by hidden dimension, sharded by sequence, or partially reduced? What layout does the next operation expect? Systems such as PyTorch DTensor encode these layouts explicitly because ad hoc tensor slicing becomes unmaintainable once tensor parallelism is composed with ZeRO, pipeline parallelism, and data parallelism.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Tensor parallelism is standard in large transformer training and inference. It is used when a single GPU cannot hold a layer or when splitting a layer improves throughput. Megatron-LM and later large-scale training systems combine tensor parallelism, pipeline parallelism, and data parallelism to scale to thousands of GPUs; the SC 2021 Megatron paper studies how those dimensions compose: https://arxiv.org/abs/2104.04473.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The most common misconception is that tensor parallelism is simply model parallelism. It is more specific: it splits individual tensor operations, not just whole layers. Pipeline Parallelism splits layers by depth; tensor parallelism splits width inside a layer. Another mistake is expecting tensor parallelism to always speed up training. If communication dominates, more GPUs can make a layer slower.',
        'A subtler pitfall is forgetting numerical and semantic equivalence. The sharded layer must produce the same logical output as the dense layer, modulo floating-point reduction order. Any missing gather, wrong reduce, or mismatched layout can silently change the model.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: PyTorch tensor parallel docs at https://docs.pytorch.org/docs/2.9/distributed.tensor.parallel.html, Megatron-LM 2019 at https://arxiv.org/abs/1909.08053, and efficient large-scale Megatron-LM training at https://arxiv.org/abs/2104.04473. Study GPU All-Reduce, ZeRO Optimizer, Pipeline Parallelism, Transformer Block, Multi-Head Attention, and Mixture of Experts next.',
      ],
    },
  ],
};
