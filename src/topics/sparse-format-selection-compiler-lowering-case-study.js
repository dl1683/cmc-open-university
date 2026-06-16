// Sparse format selection and compiler lowering: describe sparse tensor levels,
// choose storage schemes, generate loops, and validate kernel fit.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'sparse-format-selection-compiler-lowering-case-study',
  title: 'Sparse Format Selection Compiler Lowering Case Study',
  category: 'Systems',
  summary: 'A compiler and systems case study: sparse tensor level encodings, position and coordinate buffers, COO/CSR/CSC/BSR selection, loop lowering, kernel dispatch, and format audits.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['format decision', 'lowering pipeline'], defaultValue: 'format decision' },
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

function decisionGraph(title) {
  return graphState({
    nodes: [
      { id: 'op', label: 'op', x: 0.7, y: 3.5, note: 'SpMV/SpMM' },
      { id: 'pattern', label: 'pattern', x: 2.2, y: 1.8, note: 'nnz' },
      { id: 'access', label: 'access', x: 2.2, y: 5.2, note: 'row/col' },
      { id: 'format', label: 'format', x: 4.0, y: 3.5, note: 'encoding' },
      { id: 'buffers', label: 'buffers', x: 5.8, y: 1.8, note: 'pos/coord' },
      { id: 'loops', label: 'loops', x: 5.8, y: 5.2, note: 'lower' },
      { id: 'kernel', label: 'kernel', x: 7.5, y: 3.5, note: 'dispatch' },
      { id: 'bench', label: 'bench', x: 9.0, y: 2.0, note: 'time' },
      { id: 'audit', label: 'audit', x: 9.0, y: 5.0, note: 'shape' },
    ],
    edges: [
      { id: 'e-op-pattern', from: 'op', to: 'pattern' },
      { id: 'e-op-access', from: 'op', to: 'access' },
      { id: 'e-pattern-format', from: 'pattern', to: 'format' },
      { id: 'e-access-format', from: 'access', to: 'format' },
      { id: 'e-format-buffers', from: 'format', to: 'buffers' },
      { id: 'e-format-loops', from: 'format', to: 'loops' },
      { id: 'e-loops-kernel', from: 'loops', to: 'kernel' },
      { id: 'e-kernel-bench', from: 'kernel', to: 'bench' },
      { id: 'e-kernel-audit', from: 'kernel', to: 'audit' },
    ],
  }, { title });
}

function loweringGraph(title) {
  return graphState({
    nodes: [
      { id: 'tensor', label: 'tensor', x: 0.8, y: 3.5, note: 'rank' },
      { id: 'levels', label: 'levels', x: 2.2, y: 2.0, note: 'dense/sparse' },
      { id: 'map', label: 'map', x: 2.2, y: 5.0, note: 'dim->lvl' },
      { id: 'ir', label: 'IR', x: 4.0, y: 3.5, note: 'sparse' },
      { id: 'positions', label: 'pos', x: 5.7, y: 1.7, note: 'offsets' },
      { id: 'coords', label: 'coord', x: 5.7, y: 3.5, note: 'indices' },
      { id: 'values', label: 'vals', x: 5.7, y: 5.3, note: 'data' },
      { id: 'loops', label: 'loops', x: 7.5, y: 3.5, note: 'merge' },
      { id: 'code', label: 'code', x: 9.0, y: 3.5, note: 'kernel' },
    ],
    edges: [
      { id: 'e-tensor-levels', from: 'tensor', to: 'levels' },
      { id: 'e-tensor-map', from: 'tensor', to: 'map' },
      { id: 'e-levels-ir', from: 'levels', to: 'ir' },
      { id: 'e-map-ir', from: 'map', to: 'ir' },
      { id: 'e-ir-positions', from: 'ir', to: 'positions' },
      { id: 'e-ir-coords', from: 'ir', to: 'coords' },
      { id: 'e-ir-values', from: 'ir', to: 'values' },
      { id: 'e-positions-loops', from: 'positions', to: 'loops' },
      { id: 'e-coords-loops', from: 'coords', to: 'loops' },
      { id: 'e-values-loops', from: 'values', to: 'loops' },
      { id: 'e-loops-code', from: 'loops', to: 'code' },
    ],
  }, { title });
}

function* formatDecision() {
  yield {
    state: decisionGraph('Sparse format selection is a compiler decision'),
    highlight: { active: ['op', 'pattern', 'access', 'format', 'e-op-pattern', 'e-op-access', 'e-pattern-format', 'e-access-format'], found: ['kernel'] },
    explanation: 'The right sparse format depends on the operation, access direction, sparsity pattern, hardware, and available kernels. A compiler or runtime should make that choice explicit.',
    invariant: 'Sparse layout is part of the program, not just storage.',
  };
  yield {
    state: labelMatrix(
      'Decision table',
      [
        { id: 'build', label: 'build' },
        { id: 'row', label: 'row ops' },
        { id: 'col', label: 'col ops' },
        { id: 'block', label: 'blocks' },
        { id: 'dense', label: 'low sparse' },
      ],
      [
        { id: 'format', label: 'format' },
        { id: 'reason', label: 'why' },
      ],
      [
        ['COO', 'append'],
        ['CSR', 'row scan'],
        ['CSC', 'col scan'],
        ['BSR', 'tile kernel'],
        ['dense', 'overhead'],
      ],
    ),
    highlight: { active: ['build:format', 'row:format', 'col:format', 'block:format'], compare: ['dense:format'] },
    explanation: 'A simple decision table already prevents many mistakes. The format should follow access pattern and kernel fit, not the most familiar acronym.',
  };
  yield {
    state: decisionGraph('Format choice lowers into buffers and loops'),
    highlight: { active: ['format', 'buffers', 'loops', 'kernel', 'e-format-buffers', 'e-format-loops', 'e-loops-kernel'], compare: ['op'] },
    explanation: 'Once a format is chosen, it determines physical buffers, loop nests, merge logic, vectorization opportunities, and dispatchable kernel families.',
  };
  yield {
    state: decisionGraph('Bench and audit close the selection loop'),
    highlight: { active: ['kernel', 'bench', 'audit', 'e-kernel-bench', 'e-kernel-audit'], compare: ['format'] },
    explanation: 'Sparse compilers still need measurement. Record density, nnz, index width, conversion time, generated format, kernel, memory traffic, and result correctness.',
  };
}

function* loweringPipeline() {
  yield {
    state: loweringGraph('Sparse tensor encodings describe levels, not just names'),
    highlight: { active: ['tensor', 'levels', 'map', 'ir', 'e-tensor-levels', 'e-tensor-map', 'e-levels-ir', 'e-map-ir'], found: ['positions', 'coords'] },
    explanation: 'MLIR-style sparse tensor encodings describe how tensor dimensions map to storage levels and whether each level is dense, compressed, singleton, or another sparse level type.',
  };
  yield {
    state: labelMatrix(
      'Buffers',
      [
        { id: 'pos', label: 'pos' },
        { id: 'coord', label: 'coord' },
        { id: 'vals', label: 'vals' },
        { id: 'meta', label: 'meta' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['offsets', 'comp lvl'],
        ['indices', 'coordinates'],
        ['payload', 'nonzeros'],
        ['shape', 'bounds'],
      ],
    ),
    highlight: { active: ['pos:stores', 'coord:stores', 'vals:stores'], compare: ['meta:why'] },
    explanation: 'Many sparse formats can be expressed as positions, coordinates, and values. COO emphasizes coordinates; CSR and CSC add position buffers for compressed levels.',
  };
  yield {
    state: loweringGraph('Loop lowering turns sparse levels into merge code'),
    highlight: { active: ['positions', 'coords', 'values', 'loops', 'e-positions-loops', 'e-coords-loops', 'e-values-loops'], compare: ['ir'] },
    explanation: 'Sparse iteration is a merge problem over coordinate streams. Generated loops walk positions and coordinates, skip absent entries, and combine only matching nonzeros when needed.',
  };
  yield {
    state: loweringGraph('Generated code still needs a runtime contract'),
    highlight: { active: ['loops', 'code', 'e-loops-code'], compare: ['tensor'] },
    explanation: 'The generated kernel needs index bit widths, shape metadata, buffer ownership, sortedness, duplicate semantics, and error handling. Sparse lowering is both compiler work and systems contract.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'format decision') yield* formatDecision();
  else if (view === 'lowering pipeline') yield* loweringPipeline();
  else throw new InputError('Pick a sparse compiler-lowering view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Sparse format selection chooses a physical representation for sparse tensors and matrices based on operation, sparsity pattern, access direction, hardware, and kernel availability.',
        'Compiler lowering turns that representation into buffers and loops: positions, coordinates, values, merge logic, vectorization, and kernel dispatch.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'At the high level, a program sees a sparse tensor operation such as SpMV, SpMM, or element-wise add. The compiler or runtime chooses a storage encoding such as COO, CSR, CSC, BSR, or a specialized tensor encoding.',
        'The encoding defines storage levels and buffers. Lowering emits loop nests that walk those buffers, merge coordinate streams, skip absent entries, and call dense inner kernels where possible.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Sparse lowering has more moving parts than dense lowering. Correctness depends on sortedness, duplicate semantics, explicit zeros, index bit widths, shape metadata, and buffer ownership.',
        'Performance depends on density, locality, conversion cost, branch behavior, vectorization, and hardware kernels. The compiler can pick a clever format and still lose if the measured workload differs.',
      ],
    },
    {
      heading: 'Case studies and sources',
      paragraphs: [
        'MLIR SparseTensor dialect docs describe sparse tensor types as first-class citizens and a bridge between high-level operations and lower-level storage schemes consisting of positions, coordinates, and values: https://mlir.llvm.org/docs/Dialects/SparseTensorOps/.',
        'The Google MLIR sparsifier guide explains sparse tensor encodings, level expressions, coordinate storage, position storage, bit widths, and examples such as CSR, BSR, COO, Nvidia 2:4 structured sparsity, and ELL: https://developers.google.com/mlir-sparsifier/guides/encode.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Graph analytics, recommender systems, scientific simulations, sparse ML features, pruned neural networks, and retrieval indexes all need format selection. The same logical sparse tensor can be terrible or excellent depending on its physical layout.',
        'This is why libraries expose multiple sparse formats and why compilers increasingly model sparse layout instead of treating it as an opaque container.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not benchmark only the kernel and ignore conversion. Do not assume a format name implies sortedness, duplicate handling, or explicit-zero behavior. Do not use 64-bit indices everywhere if 32-bit is enough and memory bandwidth dominates.',
        'Do not force sparse lowering when density is high. Dense kernels can win because they avoid metadata, branches, and irregular memory access.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MLIR SparseTensor dialect at https://mlir.llvm.org/docs/Dialects/SparseTensorOps/, MLIR sparsifier encoding guide at https://developers.google.com/mlir-sparsifier/guides/encode, PyTorch sparse tensors at https://docs.pytorch.org/docs/stable/sparse.html, SciPy sparse arrays at https://docs.scipy.org/doc/scipy/reference/sparse.html, and NVIDIA cuSPARSE at https://docs.nvidia.com/cuda/cusparse/. Study COO Sparse Tensor Assembly Primer, CSC Column Sparse Matrix Primer, Block Sparse Row Kernel Layout Case Study, GraphBLAS Sparse Matrix Graph Case Study, and Accelerator Kernel Compatibility Matrix Case Study next.',
      ],
    },
  ],
};
