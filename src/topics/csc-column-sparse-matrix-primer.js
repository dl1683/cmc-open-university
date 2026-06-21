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
      heading: 'Why this exists',
      paragraphs: [
        'Compressed Sparse Column, or CSC, exists because many important matrices are large but mostly empty. Finite-element systems, optimization constraints, graph incidence matrices, recommender features, and bag-of-words tables can have millions of possible cells while only a small fraction contain useful values. A dense array stores every zero. That wastes memory and makes kernels read data that contributes nothing.',
        {
          type: 'callout',
          text: 'CSC is a column table of contents: one pointer pair turns a sparse column into a contiguous slice.',
        },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Finite_element_sparse_matrix.png/250px-Finite_element_sparse_matrix.png',
          alt: 'Sparse matrix pattern with many zero locations and black nonzero entries',
          caption: 'Sparse matrices motivate compressed layouts that store only nonzero structure. Source: https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Finite_element_sparse_matrix.png/250px-Finite_element_sparse_matrix.png',
        },
        'Sparse storage is the first repair. Instead of storing all cells, store only nonzeros. The next question is access direction. If the hot operation asks for whole columns, a plain list of triples still has the wrong shape. A solver or optimizer would have to search through unrelated entries just to find the values for one column.',
        'CSC makes each column a contiguous slice. It answers one basic question quickly: which row indices and values belong to column j. The format is not sparse magic. It is a compact table of contents for column-oriented work.',
      ],
    },
    {
      heading: 'The baseline and the wall',
      paragraphs: [
        'The simplest sparse baseline is COO: one tuple per nonzero, usually row, column, and value. COO is friendly during assembly because a program can append triples as it discovers them. It is also easy to sort, filter, and debug. That makes it a good interchange shape and a good construction shape.',
        'The wall appears when the same matrix is queried repeatedly. A column slice in unsorted COO is a scan over all nonzeros. Even sorted COO still needs search boundaries or extra indexes. If a factorization routine touches columns thousands of times, paying a search cost every time is the wrong tradeoff.',
        'CSC pays an upfront organization cost so column queries become pointer arithmetic. It is the column twin of CSR. CSR makes rows cheap. CSC makes columns cheap. The right answer depends on the loop nest that will dominate runtime.',
      ],
    },
    {
      heading: 'Core invariant',
      paragraphs: [
        'CSC stores three arrays. `values` stores nonzero values. `rowIdx` stores the row coordinate for each value. `colPtr` has one entry for each column plus one final sentinel. The entries for column j live from `colPtr[j]` up to, but not including, `colPtr[j + 1]`.',
        'The invariant is a partition of the nonzero arrays into column slices. `colPtr` must be monotone. `colPtr[0]` is usually 0. `colPtr[ncols]` equals `nnz`, the number of stored nonzeros. Every index position between 0 and `nnz - 1` belongs to exactly one column slice.',
        'Inside a slice, `rowIdx[k]` and `values[k]` are tied together. If `rowIdx[8]` says row 4, then `values[8]` is the value at row 4 in that column. Many implementations also keep row indices sorted inside each column, because sorted slices support binary search, merging, duplicate cleanup, and predictable solver behavior.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'To build CSC from triples, group nonzeros by column, usually by sorting on column and then row. Emit the row indices and values in that order. Count how many entries each column receives. Prefix-sum those counts to produce `colPtr`. The prefix-sum step is the same idea used in counting sort and CSR construction.',
        'Empty columns do not need a special object. If column 5 has no entries, then `colPtr[5]` equals `colPtr[6]`. The slice length is zero. This is one reason the sentinel design is clean: every column, including an empty one and the last one, uses the same start/end rule.',
        'Duplicate coordinates need a policy. Numerical libraries often sum duplicates during compression. Some formats allow duplicates temporarily but require canonicalization before high-performance kernels. A practical builder should decide early whether duplicate `(row, column)` entries are legal, merged, or rejected.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness follows from the offset partition. A lookup for column j reads exactly the positions in its slice. No other column can own those positions because adjacent pointer ranges do not overlap. No stored entry can fall outside all columns because the last pointer is `nnz`.',
        'The transpose relationship is the useful mental shortcut. CSC(A) stores the same structural idea as CSR(A transposed). A row-oriented algorithm on `A^T` can often be seen as a column-oriented algorithm on A. This is why transpose multiplies and some solver kernels naturally prefer CSC.',
        'Sorted row indices strengthen the guarantee. They are not the reason the matrix is valid, but they make many algorithms simpler. Intersections of two columns become merge walks. Searching for a particular row in a column can use binary search. Factorization routines can reason about patterns without treating each slice as an unordered bag.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the column-layout view, treat `colPtr` as the table of contents. The active column does not search the whole matrix. It reads a start offset, reads the next offset, and walks the bounded region of `rowIdx` and `values`. The important lesson is that the matrix shape has been moved into offsets.',
        'In the solver view, the layout is only one stage in a pipeline. A direct sparse solver may first examine the symbolic pattern, choose permutations to reduce fill, factor numeric values, and then solve for one or many right-hand sides. CSC is useful because column structure is available without reconstruction at every stage.',
        'The CSR comparison table should be read as an access-pattern warning. Neither format is universally better. Each one makes one direction cheap and the other direction awkward. A good implementation chooses based on the work it will repeat, not based on the word sparse.',
      ],
    },
    {
      heading: 'Costs and operations',
      paragraphs: [
        'Storage is O(ncols + nnz), plus the value payload. Compared with COO, CSC removes the column index stored beside every nonzero and replaces it with one pointer per column. That is usually smaller when columns contain multiple entries, and it is much better for direct column slices.',
        'Column lookup costs O(number of stored entries in that column). Row lookup is poor unless the matrix is also indexed by rows or converted to CSR. A matrix-vector multiply `A * x` can be implemented in CSC by scattering contributions from columns into output rows, but CSR usually matches that operation more directly. A transpose multiply `A^T * x` often fits CSC cleanly.',
        'Conversion is not free. Moving between COO, CSR, and CSC requires sorting, counting, or transposing index arrays. In production systems, format conversion belongs in the cost model. If one conversion unlocks millions of column reads, it is cheap. If it happens every request, it can dominate the workload.',
        'Sparse direct solvers add another cost: fill-in. During factorization, zeros in the input matrix can become nonzero in the factors. The input `nnz` may look small while the factor storage is large. A serious solver report tracks symbolic pattern, numeric values, permutation, fill, memory, and solve time separately.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'CSC wins when columns are the unit of work. Sparse direct solvers, column-oriented factorizations, coordinate descent, feature-wise statistics, transpose multiplies, and optimization routines often touch one column or a small set of columns repeatedly. CSC turns those requests into contiguous walks.',
        'It also wins when the sparsity pattern is reused. In many scientific and optimization workloads, the nonzero positions stay the same while numeric values change. A solver can perform symbolic analysis once, reuse the column structure, and update only the numeric factorization when values change.',
        'In graph terms, CSC can act like inbound adjacency lists. CSR is natural for outgoing edges from each row-like vertex. CSC is natural for incoming edges to each column-like vertex. PageRank, bipartite features, and transpose traversals all expose this direction choice.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'CSC is the wrong default for row-heavy code. If every operation asks for rows, CSR will be simpler and usually faster. A row query in CSC may scan many columns or require an auxiliary row index. The data structure is only fast for the direction it compressed.',
        'CSC is also awkward for incremental assembly. Inserting a new nonzero into the middle of a column shifts later entries and changes offsets. Builders usually collect triples first, then compress once. If the matrix changes constantly, a dynamic map or batched rebuild may be better.',
        'Sparse can lose to dense. When the matrix becomes moderately dense, pointer metadata, irregular memory access, and branchy kernels can cost more than reading a dense array. Hardware matters. GPUs and vector units reward regular access, so the density threshold for sparse wins is workload-specific.',
      ],
    },
    {
      heading: 'Concrete example and guidance',
      paragraphs: [
        'Suppose a matrix has four columns. `colPtr = [0, 2, 2, 5, 6]`. Column 0 has entries at positions 0 and 1. Column 1 is empty because its start and end are both 2. Column 2 has positions 2, 3, and 4. Column 3 has position 5. The last pointer says the matrix stores six nonzeros total.',
        'To inspect column 2, read `start = colPtr[2]` and `end = colPtr[3]`, then walk `k = 2, 3, 4`. The row coordinates are `rowIdx[k]`. The matching numeric values are `values[k]`. Nothing else is required to enumerate the column.',
        'Operational checks are simple and worth automating. Verify that `colPtr.length === ncols + 1`. Verify monotonicity. Verify that the final pointer equals `rowIdx.length` and `values.length`. If the format promises sorted rows, verify that each slice is sorted and has no duplicate row index unless duplicates are explicitly allowed.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: SciPy sparse arrays at https://docs.scipy.org/doc/scipy/reference/sparse.html, PyTorch sparse tensors at https://docs.pytorch.org/docs/stable/sparse.html, NVIDIA cuSPARSE at https://docs.nvidia.com/cuda/cusparse/, and MLIR SparseTensor dialect at https://mlir.llvm.org/docs/Dialects/SparseTensorOps/.',
        'Study next in this curriculum: COO Sparse Tensor Assembly Primer for construction, Compressed Sparse Row Graph for the row-oriented twin, Block Sparse Row Kernel Layout Case Study for hardware-aware blocking, Sparse Format Selection Compiler Lowering Case Study for format choice, and GraphBLAS Sparse Matrix Graph Case Study for matrix-as-graph thinking.',
      ],
    },
  ],
};
