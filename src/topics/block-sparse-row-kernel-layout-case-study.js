// Block Sparse Row (BSR): compress sparse block rows where nonzeros appear as
// dense tiles, improving index overhead and kernel locality.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'block-sparse-row-kernel-layout-case-study',
  title: 'Block Sparse Row Kernel Layout Case Study',
  category: 'Systems',
  summary: 'A block-sparse layout case study: dense tiles inside sparse rows, block pointers, block column indices, values tensors, GPU kernel fit, ragged tails, and density thresholds.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['block layout', 'kernel fit'], defaultValue: 'block layout' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function blockGraph(title) {
  return graphState({
    nodes: [
      { id: 'dense', label: 'dense A', x: 0.8, y: 3.5, note: 'matrix' },
      { id: 'tile', label: 'tile', x: 2.3, y: 2.0, note: 'r x c' },
      { id: 'mask', label: 'mask', x: 2.3, y: 5.0, note: 'nonzero blocks' },
      { id: 'bptr', label: 'bPtr', x: 4.0, y: 2.0, note: 'block rows' },
      { id: 'bcol', label: 'bCol', x: 4.0, y: 5.0, note: 'block cols' },
      { id: 'vals', label: 'vals', x: 5.8, y: 3.5, note: 'tiles' },
      { id: 'kernel', label: 'kernel', x: 7.5, y: 3.5, note: 'GEMM-ish' },
      { id: 'out', label: 'out', x: 9.0, y: 3.5, note: 'SpMM' },
    ],
    edges: [
      { id: 'e-dense-tile', from: 'dense', to: 'tile' },
      { id: 'e-dense-mask', from: 'dense', to: 'mask' },
      { id: 'e-tile-bptr', from: 'tile', to: 'bptr' },
      { id: 'e-mask-bcol', from: 'mask', to: 'bcol' },
      { id: 'e-bptr-vals', from: 'bptr', to: 'vals' },
      { id: 'e-bcol-vals', from: 'bcol', to: 'vals' },
      { id: 'e-vals-kernel', from: 'vals', to: 'kernel' },
      { id: 'e-kernel-out', from: 'kernel', to: 'out' },
    ],
  }, { title });
}

function fitGraph(title) {
  return graphState({
    nodes: [
      { id: 'pattern', label: 'pattern', x: 0.8, y: 3.5, note: 'blocks' },
      { id: 'density', label: 'dense%', x: 2.4, y: 2.0, note: 'tile fill' },
      { id: 'shape', label: 'shape', x: 2.4, y: 5.0, note: 'tile size' },
      { id: 'choose', label: 'choose', x: 4.2, y: 3.5, note: 'format' },
      { id: 'csr', label: 'CSR', x: 5.8, y: 1.5, note: 'ragged' },
      { id: 'bsr', label: 'BSR', x: 5.8, y: 3.5, note: 'blocks' },
      { id: 'dense', label: 'dense', x: 5.8, y: 5.5, note: 'full' },
      { id: 'bench', label: 'bench', x: 7.6, y: 3.5, note: 'time' },
      { id: 'rollout', label: 'rollout', x: 9.1, y: 3.5, note: 'gate' },
    ],
    edges: [
      { id: 'e-pattern-density', from: 'pattern', to: 'density' },
      { id: 'e-pattern-shape', from: 'pattern', to: 'shape' },
      { id: 'e-density-choose', from: 'density', to: 'choose' },
      { id: 'e-shape-choose', from: 'shape', to: 'choose' },
      { id: 'e-choose-csr', from: 'choose', to: 'csr' },
      { id: 'e-choose-bsr', from: 'choose', to: 'bsr' },
      { id: 'e-choose-dense', from: 'choose', to: 'dense' },
      { id: 'e-bsr-bench', from: 'bsr', to: 'bench' },
      { id: 'e-bench-rollout', from: 'bench', to: 'rollout' },
    ],
  }, { title });
}

function* blockLayout() {
  yield {
    state: blockGraph('BSR stores sparse rows of dense tiles'),
    highlight: { active: ['dense', 'tile', 'mask', 'bptr', 'bcol', 'e-dense-tile', 'e-dense-mask', 'e-tile-bptr', 'e-mask-bcol'], found: ['vals'] },
    explanation: 'Block Sparse Row compresses a matrix at block granularity. Each nonzero block stores a dense tile, while block pointers and block-column indices describe where those tiles live.',
    invariant: 'BSR pays one index per block, not one index per scalar nonzero.',
  };
  yield {
    state: labelMatrix(
      'BSR arrays',
      [
        { id: 'bptr', label: 'bPtr' },
        { id: 'bcol', label: 'bCol' },
        { id: 'vals', label: 'vals' },
        { id: 'shape', label: 'shape' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['block row offsets', 'scan'],
        ['block col ids', 'place'],
        ['dense tiles', 'compute'],
        ['R x C', 'interpret'],
      ],
    ),
    highlight: { active: ['bptr:stores', 'bcol:stores', 'vals:stores', 'shape:stores'], compare: ['shape:why'] },
    explanation: 'BSR has the same pointer idea as CSR, but each entry points to a dense block. The values buffer is usually three-dimensional: block id, row inside block, column inside block.',
  };
  yield {
    state: blockGraph('Dense tile kernels reuse fast inner loops'),
    highlight: { active: ['vals', 'kernel', 'out', 'e-vals-kernel', 'e-kernel-out'], compare: ['bcol'] },
    explanation: 'The sparse outer loop skips missing blocks. The dense inner loop uses regular tile math, which can be much friendlier to CPU vector units and GPU kernels than scalar irregular nonzeros.',
  };
  yield {
    state: labelMatrix(
      'Block density',
      [
        { id: 'full', label: 'full tile' },
        { id: 'half', label: 'half tile' },
        { id: 'one', label: 'one elem' },
        { id: 'ragged', label: 'tail' },
      ],
      [
        { id: 'BSR', label: 'BSR' },
        { id: 'CSR', label: 'CSR' },
      ],
      [
        ['great', 'ok'],
        ['maybe', 'ok'],
        ['waste', 'better'],
        ['pad/mask', 'natural'],
      ],
    ),
    highlight: { active: ['full:BSR', 'half:BSR'], compare: ['one:BSR', 'ragged:BSR'] },
    explanation: 'BSR wins when nonzeros cluster into dense tiles. It wastes memory and compute when the pattern is ragged or each block contains only one useful scalar.',
  };
}

function* kernelFit() {
  yield {
    state: fitGraph('Format selection starts from the sparsity pattern'),
    highlight: { active: ['pattern', 'density', 'shape', 'choose', 'e-pattern-density', 'e-pattern-shape', 'e-density-choose', 'e-shape-choose'], found: ['bsr'] },
    explanation: 'A block-sparse optimization should start with measurements: block density, tile shape, zero distribution, batch size, and hardware kernels.',
  };
  yield {
    state: labelMatrix(
      'Kernel ledger',
      [
        { id: 'tile', label: 'tile' },
        { id: 'fill', label: 'fill' },
        { id: 'nnzb', label: 'nnzb' },
        { id: 'pad', label: 'pad' },
        { id: 'time', label: 'time' },
      ],
      [
        { id: 'measure', label: 'measure' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['16x16', 'kernel'],
        ['82%', 'waste'],
        ['blocks', 'index'],
        ['tail', 'overhead'],
        ['ms', 'gate'],
      ],
    ),
    highlight: { active: ['tile:measure', 'fill:measure', 'time:measure'], compare: ['pad:reason'] },
    explanation: 'Do not promote block sparsity because a model has zeros. Promote it only when the block layout wins on the actual kernel, dtype, hardware, and batch shape.',
  };
  yield {
    state: fitGraph('CSR, BSR, and dense can all be right'),
    highlight: { active: ['choose', 'csr', 'bsr', 'dense', 'e-choose-csr', 'e-choose-bsr', 'e-choose-dense'], compare: ['pattern'] },
    explanation: 'CSR handles ragged sparsity. BSR handles dense tiles. Dense kernels can still win if sparsity is too low or the sparse kernel overhead dominates.',
  };
  yield {
    state: fitGraph('Rollout gates prevent theoretical sparsity wins from regressing users'),
    highlight: { active: ['bsr', 'bench', 'rollout', 'e-bsr-bench', 'e-bench-rollout'], compare: ['dense'] },
    explanation: 'A production rollout should compare accuracy, latency, memory, power, and fallback coverage before switching to a block-sparse path.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'block layout') yield* blockLayout();
  else if (view === 'kernel fit') yield* kernelFit();
  else throw new InputError('Pick a block-sparse layout view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read BSR as a sparse matrix layout with two levels. Sparse means most entries are zero, and matrix kernels should not multiply by zeros if they can avoid it. BSR, or block sparse row, stores fixed-size dense blocks for the nonzero regions and row pointers that say which block rows are present.',
        'The safe inference rule is shape before speed. If nonzeros cluster into blocks, a kernel can load dense tiles and use vector lanes well. If nonzeros are scattered, the block format stores padding zeros and performs work that a scalar sparse format would skip.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Sparse matrices appear when each row interacts with only a small part of the problem. Physics meshes, graph computations, recommender systems, and neural network pruning can all produce many zeros. A dense matrix stores and multiplies every entry, so zeros become memory traffic and arithmetic waste.',
              {type:'callout', text:'BSR only wins when zeros have shape. It turns clusters of nonzeros into dense tiles the hardware can use, but scattered sparsity becomes padded work.'},,
              {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/8/8a/Finite_element_sparse_matrix.png', alt:'Sparse matrix from a finite element problem, with nonzero entries shown in black', caption:'Sparse matrices from finite element problems often reveal exploitable block structure rather than random zeros. Source: Wikimedia Commons, Finite element sparse matrix.png, Oleg Alexandrov, public domain.'},,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is compressed sparse row, or CSR. CSR stores each nonzero value, its column index, and a row pointer array. It is simple and skips zeros exactly.',
        'CSR works well when nonzeros have no regular shape. But every value may bring an index lookup, an indirect load, and a small multiply-add. Modern CPUs and GPUs prefer chunks of contiguous work, not one unpredictable scalar at a time.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is hardware utilization. A sparse matrix-vector multiply can become memory-bound because it streams values, indices, and vector reads while doing little arithmetic per byte. Random column access also harms cache behavior because vector elements are fetched in an order the hardware cannot easily prefetch.',
        'Many real matrices are not random; their nonzeros appear in local patches. CSR ignores that shape. If four neighboring rows often touch the same four neighboring columns, storing sixteen values as one dense block can reduce index overhead and improve vector reuse.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to store a sparse matrix of dense tiles. Instead of saying value at row i and column j exists, BSR says this block row has a nonzero block at block column k, then stores all entries inside that fixed-size block. The block may contain some zeros, but it gives the kernel a regular tile.',
        'This changes the unit of work. CSR schedules scalar nonzeros. BSR schedules small matrix-vector products, such as a 4 by 4 block times four input vector values. The extra padded zeros can be worth it if the block has enough real nonzeros and the hardware uses the dense tile efficiently.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'BSR uses three main arrays. The block pointer array marks the start and end of blocks for each block row. The block column array stores the column index for each dense block. The value array stores block_size by block_size values for every stored block.',
        'During multiplication y = A x, the kernel loops over block rows. For each stored block, it loads the matching slice of x, multiplies the dense block by that slice, and accumulates into the output slice y. The block size is fixed, so the inner loop can be unrolled or mapped to SIMD lanes.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is coverage. Every matrix coordinate belongs to exactly one possible block position. If a block is stored, the kernel multiplies all values in that block; if a block is absent, all values in that region are treated as zero.',
        'The output matches dense multiplication because multiplication distributes over the partition into blocks. Summing each stored block contribution into y gives the same result as summing every individual nonzero. Missing blocks contribute zero, so omitting them is safe.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Let block size be b and stored block count be m. Storage for values is m * b * b numbers, plus m block-column indices and one pointer per block row. Computation is also proportional to m * b * b multiply-add positions, even when some positions inside a stored block are zero.',
        'Cost behaves badly when occupancy is low. A 4 by 4 block with only 3 real nonzeros stores and processes 16 positions, so 13 positions are padding. A 4 by 4 block with 14 real nonzeros is a good fit because one index describes many useful values.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'BSR fits finite element matrices, circuit simulation, block-structured graphs, batched small systems, and pruned neural network layers where sparsity has local structure. The access pattern is repeated multiplication with the same matrix layout, so conversion cost can be amortized. A solver may multiply by the matrix thousands of times.',
        'It is especially useful when block size matches hardware. A 4 by 4 or 8 by 8 block can map to vector registers, GPU warps, or tensor-style microkernels. The layout turns irregular global sparsity into regular local computation.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'BSR fails on random sparsity. If nonzeros are scattered, most stored blocks are mostly zeros, so the format increases both memory and arithmetic. In that case CSR, COO, or another format may do less work.',
        'It also fails when the chosen block size is wrong. Too small and the kernel gets little regularity. Too large and padding dominates. The block size is an engineering parameter tied to matrix structure and hardware, not a universal constant.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider an 8 by 8 matrix with 2 by 2 blocks. Suppose there are 5 nonzero blocks, so BSR stores 5 * 4 = 20 numeric positions. CSR would store only the actual nonzeros, so BSR is only better if those blocks are dense enough to reduce index and kernel overhead.',
        'If each 2 by 2 block has all 4 entries nonzero, BSR stores 20 useful values and 5 block indices. CSR stores 20 values and 20 column indices. BSR saves 15 indices and gives the kernel five dense micro-multiplies.',
        'If each 2 by 2 block has only 1 real nonzero, BSR still stores 20 numeric positions for 5 useful values. CSR stores 5 values and 5 column indices. The same format that helped dense blocks now wastes 15 padded multiplies.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: sparse BLAS documentation, Intel oneMKL sparse matrix formats, NVIDIA cuSPARSE block sparse routines, and numerical linear algebra texts on sparse storage. Use vendor docs for exact layout details because memory order and kernel constraints vary.',
        'Study next by role. For sparse formats, compare COO, CSR, CSC, ELLPACK, and HYB. For performance, study roofline analysis, cache locality, SIMD, and GPU memory coalescing. For applications, study finite element assembly and graph adjacency matrices.',
      ],
    },
  ],
};
