// Compressed Sparse Column: column offsets plus row indices, useful for
// column slices, factorizations, and transposed row-oriented kernels.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'csc-column-sparse-matrix-primer',
  title: 'CSC Column Sparse Matrix Primer',
  category: 'Data Structures',
  summary: 'A sparse matrix primer: compressed column pointers, row-index arrays, values, column slicing, transpose relation to CSR, solver workloads, and format-conversion tradeoffs.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['column layout', 'solver tradeoff'], defaultValue: 'column layout' },
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

function cscGraph(title) {
  return graphState({
    nodes: [
      { id: 'coo', label: 'COO', x: 0.8, y: 3.5, note: 'triples' },
      { id: 'sort', label: 'sort', x: 2.3, y: 3.5, note: 'by col' },
      { id: 'colptr', label: 'colPtr', x: 4.0, y: 2.0, note: 'offsets' },
      { id: 'rowidx', label: 'rowIdx', x: 4.0, y: 5.0, note: 'rows' },
      { id: 'vals', label: 'vals', x: 5.8, y: 3.5, note: 'data' },
      { id: 'slice', label: 'slice', x: 7.4, y: 2.0, note: 'one col' },
      { id: 'solve', label: 'solve', x: 7.4, y: 5.0, note: 'factor' },
      { id: 'csrT', label: 'CSR(A^T)', x: 9.0, y: 3.5, note: 'dual' },
    ],
    edges: [
      { id: 'e-coo-sort', from: 'coo', to: 'sort' },
      { id: 'e-sort-colptr', from: 'sort', to: 'colptr' },
      { id: 'e-sort-rowidx', from: 'sort', to: 'rowidx' },
      { id: 'e-rowidx-vals', from: 'rowidx', to: 'vals' },
      { id: 'e-colptr-slice', from: 'colptr', to: 'slice' },
      { id: 'e-vals-solve', from: 'vals', to: 'solve' },
      { id: 'e-slice-csrT', from: 'slice', to: 'csrT' },
      { id: 'e-solve-csrT', from: 'solve', to: 'csrT' },
    ],
  }, { title });
}

function solverGraph(title) {
  return graphState({
    nodes: [
      { id: 'A', label: 'A', x: 0.8, y: 3.5, note: 'sparse' },
      { id: 'csc', label: 'CSC', x: 2.4, y: 2.0, note: 'cols' },
      { id: 'perm', label: 'perm', x: 2.4, y: 5.0, note: 'reduce fill' },
      { id: 'factor', label: 'factor', x: 4.3, y: 3.5, note: 'L/U' },
      { id: 'solve', label: 'solve', x: 6.0, y: 2.0, note: 'rhs' },
      { id: 'update', label: 'update', x: 6.0, y: 5.0, note: 'symbolic' },
      { id: 'out', label: 'x', x: 7.7, y: 3.5, note: 'answer' },
      { id: 'audit', label: 'audit', x: 9.0, y: 3.5, note: 'fill/time' },
    ],
    edges: [
      { id: 'e-A-csc', from: 'A', to: 'csc' },
      { id: 'e-A-perm', from: 'A', to: 'perm' },
      { id: 'e-csc-factor', from: 'csc', to: 'factor' },
      { id: 'e-perm-factor', from: 'perm', to: 'factor' },
      { id: 'e-factor-solve', from: 'factor', to: 'solve' },
      { id: 'e-factor-update', from: 'factor', to: 'update' },
      { id: 'e-solve-out', from: 'solve', to: 'out' },
      { id: 'e-update-audit', from: 'update', to: 'audit' },
      { id: 'e-out-audit', from: 'out', to: 'audit' },
    ],
  }, { title });
}

function* columnLayout() {
  yield {
    state: cscGraph('CSC compresses columns instead of rows'),
    highlight: { active: ['coo', 'sort', 'colptr', 'rowidx', 'vals', 'e-coo-sort', 'e-sort-colptr', 'e-sort-rowidx', 'e-rowidx-vals'], found: ['slice'] },
    explanation: 'Compressed Sparse Column stores all nonzeros of each column contiguously. colPtr[j] and colPtr[j+1] bound the rowIdx and values entries for column j.',
    invariant: 'CSC(A) is the row-compressed idea applied to columns.',
  };
  yield {
    state: labelMatrix(
      'CSC slices',
      [
        { id: 'c0', label: 'col 0' },
        { id: 'c1', label: 'col 1' },
        { id: 'c2', label: 'col 2' },
        { id: 'c3', label: 'col 3' },
      ],
      [
        { id: 'range', label: 'range' },
        { id: 'rows', label: 'rows' },
      ],
      [
        ['0..2', '1,3'],
        ['2..2', 'empty'],
        ['2..5', '0,1,4'],
        ['5..6', '2'],
      ],
    ),
    highlight: { active: ['c2:range', 'c2:rows'], compare: ['c1:rows'] },
    explanation: 'Column 2 reads a contiguous slice of row indices and values. Empty columns have equal start and end offsets, just like empty rows in CSR.',
  };
  yield {
    state: cscGraph('CSC is CSR of the transposed matrix'),
    highlight: { active: ['slice', 'csrT', 'e-slice-csrT'], compare: ['colptr'] },
    explanation: 'A useful mental shortcut: CSC(A) stores the same pattern as CSR(A^T). Row algorithms on the transpose become column algorithms on the original.',
  };
  yield {
    state: labelMatrix(
      'CSR vs CSC',
      [
        { id: 'row', label: 'row slice' },
        { id: 'col', label: 'col slice' },
        { id: 'spmv', label: 'A*x' },
        { id: 'transpose', label: 'A^T*x' },
      ],
      [
        { id: 'CSR', label: 'CSR' },
        { id: 'CSC', label: 'CSC' },
      ],
      [
        ['fast', 'slow'],
        ['slow', 'fast'],
        ['natural', 'needs care'],
        ['needs care', 'natural'],
      ],
    ),
    highlight: { active: ['row:CSR', 'col:CSC', 'spmv:CSR', 'transpose:CSC'], compare: ['row:CSC'] },
    explanation: 'Format choice follows access direction. CSR is natural for row scans. CSC is natural for column scans and transpose-style operations.',
  };
}

function* solverTradeoff() {
  yield {
    state: solverGraph('Sparse direct solvers often want column structure'),
    highlight: { active: ['A', 'csc', 'perm', 'factor', 'e-A-csc', 'e-A-perm', 'e-csc-factor', 'e-perm-factor'], found: ['solve'] },
    explanation: 'Sparse factorization and some solver routines use column-oriented structure to find pivots, build elimination trees, and control fill-in.',
  };
  yield {
    state: labelMatrix(
      'Solver ledger',
      [
        { id: 'symbolic', label: 'symbolic' },
        { id: 'numeric', label: 'numeric' },
        { id: 'fill', label: 'fill' },
        { id: 'rhs', label: 'rhs' },
      ],
      [
        { id: 'tracks', label: 'tracks' },
        { id: 'why', label: 'why' },
      ],
      [
        ['pattern', 'reuse'],
        ['values', 'factor'],
        ['extra nnz', 'memory'],
        ['b vector', 'solve'],
      ],
    ),
    highlight: { active: ['symbolic:tracks', 'numeric:tracks', 'fill:tracks'], compare: ['rhs:why'] },
    explanation: 'A solver has both symbolic and numeric work. The sparsity pattern may be reused across many right-hand sides even when values change.',
  };
  yield {
    state: solverGraph('Permutation reduces fill-in before factorization'),
    highlight: { active: ['perm', 'factor', 'update', 'audit', 'e-perm-factor', 'e-factor-update', 'e-update-audit'], compare: ['solve'] },
    explanation: 'Sparse direct solvers care about fill-in: zeros that become nonzero during factorization. Reordering can reduce memory and time dramatically.',
  };
  yield {
    state: labelMatrix(
      'When CSC wins',
      [
        { id: 'colscan', label: 'col scan' },
        { id: 'factor', label: 'factor' },
        { id: 'transpose', label: 'trans ops' },
        { id: 'rowapp', label: 'row app' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'reason', label: 'why' },
      ],
      [
        ['strong', 'col-contig'],
        ['strong', 'solver APIs'],
        ['strong', 'A^T access'],
        ['weak', 'row costly'],
      ],
    ),
    highlight: { active: ['colscan:fit', 'factor:fit', 'transpose:fit'], compare: ['rowapp:reason'] },
    explanation: 'CSC is not better than CSR; it is better for different access patterns. Production sparse systems often keep one canonical layout and materialize another when the workload justifies it.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'column layout') yield* columnLayout();
  else if (view === 'solver tradeoff') yield* solverTradeoff();
  else throw new InputError('Pick a CSC sparse matrix view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Compressed Sparse Column, or CSC, stores a sparse matrix by columns. colPtr stores offsets into rowIdx and values. The nonzeros of column j live in rowIdx[colPtr[j]..colPtr[j+1]).',
        'It is the column-oriented counterpart of CSR. CSC(A) is conceptually CSR(A transposed), which makes it natural for column slicing, transpose-style multiplication, and many sparse solver routines.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'To build CSC, sort or group nonzeros by column, write row indices and values contiguously per column, and store a column pointer array with ncols + 1 entries. The final sentinel stores nnz.',
        'A column lookup is contiguous pointer arithmetic. A row lookup is awkward unless additional indexes exist or the matrix is also stored as CSR.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'CSC has the same asymptotic storage shape as CSR: O(ncols + nnz) for column pointers plus row indices and values. The practical difference is cache locality for columns versus rows.',
        'Sparse direct solvers add another dimension: symbolic analysis, permutations, factorization fill-in, and reuse across right-hand sides. Format choice affects those steps.',
      ],
    },
    {
      heading: 'Case studies and sources',
      paragraphs: [
        'SciPy sparse docs describe CSC as one of the primary compressed sparse formats and note efficient conversions among CSR, CSC, and COO: https://docs.scipy.org/doc/scipy/reference/sparse.html.',
        'NVIDIA cuSPARSE docs define CSC as similar to COO with column indices compressed and replaced by an offset array: https://docs.nvidia.com/cuda/cusparse/. PyTorch sparse docs document CSC tensor support and related index accessors: https://docs.pytorch.org/docs/stable/sparse.html.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'CSC appears in sparse linear solvers, factorization libraries, optimization packages, and workloads that repeatedly access columns. It is also common as an interchange or derived layout when a CSR matrix needs transposed operations.',
        'In ML systems, sparse feature matrices may start as COO, train in CSR-style row batches, and still need CSC-like views for feature-wise statistics or coordinate updates.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not choose CSC only because the matrix is sparse. Choose it because columns are the access unit. Row-major applications may get worse.',
        'Do not ignore fill-in. A sparse input matrix can produce much denser factors, and the solver ledger should track symbolic pattern, numeric values, fill, and memory.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: SciPy sparse arrays at https://docs.scipy.org/doc/scipy/reference/sparse.html, PyTorch sparse tensors at https://docs.pytorch.org/docs/stable/sparse.html, NVIDIA cuSPARSE at https://docs.nvidia.com/cuda/cusparse/, and MLIR SparseTensor dialect at https://mlir.llvm.org/docs/Dialects/SparseTensorOps/. Study COO Sparse Tensor Assembly Primer, Compressed Sparse Row Graph, Block Sparse Row Kernel Layout Case Study, and GraphBLAS Sparse Matrix Graph Case Study next.',
      ],
    },
  ],
};
