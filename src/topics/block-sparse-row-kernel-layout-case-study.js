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
      heading: 'What it is',
      paragraphs: [
        'Block Sparse Row, or BSR, stores a sparse matrix as rows of dense tiles. Instead of one column index per scalar nonzero, it stores one block-column index per nonzero block and one dense values tile per block.',
        'BSR is useful when nonzeros cluster into regular blocks. It reduces index overhead and gives kernels dense inner loops, but it can waste work when blocks are mostly empty.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'BSR has block-row pointers, block-column indices, and a values tensor of dense blocks. The pointer array bounds each block row, the block-column array places each tile, and the values tensor holds the tile contents.',
        'The outer loop is sparse: skip absent blocks. The inner loop is dense: multiply or accumulate a small tile. That inner regularity is why BSR can map well to vector units and GPU kernels.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'BSR trades scalar sparsity for block regularity. If an r-by-c block has many useful values, one block index is cheaper than many scalar indices. If the block has one useful value, BSR stores and may compute many zeros.',
        'The right decision depends on tile shape, density inside tiles, batch size, dtype, kernel availability, and fallback behavior. Measure the actual path.',
      ],
    },
    {
      heading: 'Case studies and sources',
      paragraphs: [
        'SciPy sparse array docs describe BSR as appropriate when nonzero regions occur in contiguous blocks: https://docs.scipy.org/doc/scipy/tutorial/sparse.html. PyTorch sparse docs document BSR and BSC compressed sparse tensor layouts: https://docs.pytorch.org/docs/stable/sparse.html.',
        'NVIDIA cuSPARSE documents sparse matrix storage formats and generic sparse APIs for operations such as SpMV and SpMM: https://docs.nvidia.com/cuda/cusparse/. MLIR sparse tensor documentation shows sparse encodings including common and specialized formats: https://mlir.llvm.org/docs/Dialects/SparseTensorOps/.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'BSR appears in finite element matrices, block-structured scientific simulations, pruned neural networks with block masks, and GPU sparse matrix-matrix multiply paths.',
        'In AI systems, block sparsity should be treated as a kernel compatibility question. A mask pattern that looks elegant on paper may not map to a fast available kernel.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not confuse scalar sparsity with useful block sparsity. A matrix can be 90 percent sparse and still have awful block fill. Do not ignore ragged tails and padding.',
        'Do not assume block sparse is automatically faster than dense. Sparse metadata, memory indirection, and kernel launch overhead can dominate.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: SciPy sparse tutorial at https://docs.scipy.org/doc/scipy/tutorial/sparse.html, PyTorch sparse tensors at https://docs.pytorch.org/docs/stable/sparse.html, NVIDIA cuSPARSE at https://docs.nvidia.com/cuda/cusparse/, and MLIR SparseTensor dialect at https://mlir.llvm.org/docs/Dialects/SparseTensorOps/. Study COO Sparse Tensor Assembly Primer, CSC Column Sparse Matrix Primer, Structured Pruning N:M Sparsity Case Study, Accelerator Kernel Compatibility Matrix Case Study, and WebGPU Parallel Prefix Scan Compaction next.',
      ],
    },
  ],
};
