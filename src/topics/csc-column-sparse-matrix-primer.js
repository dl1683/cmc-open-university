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
  const pipelineStages = 8; // nodes in cscGraph
  const pipelineLinks = 8;  // edges in cscGraph
  const ncols = 4;          // columns in the CSC slices matrix
  const arrayCount = 3;     // colPtr, rowIdx, values

  yield {
    state: cscGraph('CSC compresses columns instead of rows'),
    highlight: { active: ['coo', 'sort', 'colptr', 'rowidx', 'vals', 'e-coo-sort', 'e-sort-colptr', 'e-sort-rowidx', 'e-rowidx-vals'], found: ['slice'] },
    explanation: `Compressed Sparse Column stores all nonzeros of each column contiguously across ${arrayCount} arrays. colPtr[j] and colPtr[j+1] bound the rowIdx and values entries for column j, enabling O(1) column access in a ${pipelineStages}-stage pipeline.`,
    invariant: `CSC(A) compresses ${ncols}+ columns using the same offset idea CSR applies to rows.`,
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
    explanation: `Column 2 reads a contiguous slice of row indices and values from ${ncols} total columns. Empty columns have equal start and end offsets, just like empty rows in CSR.`,
  };
  yield {
    state: cscGraph('CSC is CSR of the transposed matrix'),
    highlight: { active: ['slice', 'csrT', 'e-slice-csrT'], compare: ['colptr'] },
    explanation: `A useful mental shortcut across the ${pipelineStages}-node graph: CSC(A) stores the same pattern as CSR(A^T). Row algorithms on the transpose become column algorithms on the original, connected by ${pipelineLinks} dependency edges.`,
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
    explanation: `Format choice follows access direction across ${ncols} operation categories. CSR is natural for row scans; CSC is natural for column scans and transpose-style operations.`,
  };
}

function* solverTradeoff() {
  const solverStages = 8; // nodes in solverGraph
  const solverLinks = 9;  // edges in solverGraph
  const ledgerRows = 4;   // rows in solver ledger matrix
  const fitCategories = 4; // rows in "When CSC wins" matrix

  yield {
    state: solverGraph('Sparse direct solvers often want column structure'),
    highlight: { active: ['A', 'csc', 'perm', 'factor', 'e-A-csc', 'e-A-perm', 'e-csc-factor', 'e-perm-factor'], found: ['solve'] },
    explanation: `Sparse factorization across ${solverStages} solver stages uses column-oriented structure to find pivots, build elimination trees, and control fill-in through ${solverLinks} dependency links.`,
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
    explanation: `A solver tracks ${ledgerRows} concerns (symbolic, numeric, fill, rhs). The sparsity pattern may be reused across many right-hand sides even when values change.`,
  };
  yield {
    state: solverGraph('Permutation reduces fill-in before factorization'),
    highlight: { active: ['perm', 'factor', 'update', 'audit', 'e-perm-factor', 'e-factor-update', 'e-update-audit'], compare: ['solve'] },
    explanation: `Sparse direct solvers care about fill-in: zeros that become nonzero during factorization. Reordering within the ${solverStages}-stage pipeline can reduce memory and time dramatically.`,
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
    explanation: `CSC is not better than CSR; it wins in ${fitCategories - 1} of ${fitCategories} access categories. Production sparse systems often keep one canonical layout and materialize another when the workload justifies it.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has two views. The "column layout" view walks through building a CSC representation from scratch: it shows the three arrays (colPtr, rowIdx, values), highlights which slice of rowIdx and values belongs to each column, and compares CSC to CSR in a side-by-side table. The "solver tradeoff" view shows how a sparse direct solver pipeline consumes CSC structure -- symbolic analysis, permutation, factorization, and solve stages.',
        'Each frame highlights the active nodes and edges in blue. Comparison elements appear in a second color. Step through slowly: each frame\'s explanation text describes the exact invariant or operation being shown. The matrix tables use row and column labels to make index arithmetic concrete.',
        {type: 'image', src: './assets/gifs/csc-column-sparse-matrix-primer.gif', alt: 'Animated walkthrough of the csc column sparse matrix primer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A matrix is called sparse when most of its entries are zero. A 10,000 x 10,000 matrix has 100 million cells, but a finite-element mesh connecting each node to a handful of neighbors might fill only 50,000 of them. Storing 100 million numbers when only 50,000 matter wastes memory by a factor of 2,000 and forces every operation to read zeros that contribute nothing to the result.',
        {type: 'callout', text: 'CSC is a column table of contents: one pointer pair turns a sparse column into a contiguous slice.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Finite_element_sparse_matrix.png/250px-Finite_element_sparse_matrix.png', alt: 'Sparse matrix pattern with many zero locations and black nonzero entries', caption: 'Sparse matrices motivate compressed layouts that store only nonzero structure. Source: https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Finite_element_sparse_matrix.png/250px-Finite_element_sparse_matrix.png'},
        'Compressed Sparse Column (CSC) is a storage format that keeps only the nonzero entries and organizes them so that every column can be accessed in O(1) pointer arithmetic. It exists because many critical workloads -- sparse linear solvers, optimization routines, column-oriented statistics -- need to repeatedly extract whole columns. A format that makes column extraction cheap directly reduces the cost of those workloads.',
        'CSC is the column-oriented sibling of Compressed Sparse Row (CSR). CSR makes row access fast. CSC makes column access fast. The two formats are structurally identical -- CSC of matrix A is exactly CSR of A transposed. Understanding one gives you the other for free.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest way to store a sparse matrix is COO (coordinate format): a list of (row, column, value) triples, one per nonzero. For a matrix with nnz nonzeros, COO uses 3*nnz storage slots. Assembly is easy -- append triples in any order as you discover them. Debugging is easy -- each triple is self-describing.',
        'COO handles column queries by scanning the entire list and collecting triples whose column field matches. For a matrix with 50,000 nonzeros and 10,000 columns, extracting one column scans all 50,000 triples to find the roughly 5 that match. If sorted by column, binary search can find the boundaries, but even that is an O(log nnz) lookup per column query, and the data for each column is still interleaved with row-index metadata you may not need.',
        'For one-time analysis or format conversion, COO is fine. The cost is proportional to nnz per query, and you only pay it once.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears when the same matrix is queried column-by-column thousands or millions of times. A sparse LU factorization of a 10,000 x 10,000 matrix might access each column hundreds of times during elimination. If each access costs O(nnz) in COO, the total cost scales as O(ncols * nnz * iterations), which can be catastrophic.',
        'Even sorted COO still stores a column index beside every nonzero. For 50,000 nonzeros and 10,000 columns, that is 50,000 column-index integers that repeat information already implicit in the sorted order. Each column query still needs a binary search to find its boundaries.',
        'The fundamental problem is that COO treats the column identity of each nonzero as per-entry metadata rather than structural information. What we want is a format where "give me column j" is a pointer dereference, not a search.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'If you sort all nonzeros by column (breaking ties by row), the entries for each column form a contiguous block. Column 0\'s entries come first, then column 1\'s, then column 2\'s, and so on. You no longer need to store a column index with every entry -- you just need to know where each column\'s block starts and ends.',
        'A single array of column pointers (colPtr) records these boundaries. colPtr[j] is the index where column j\'s entries begin. colPtr[j+1] is where they end. The column index, which COO stored nnz times, is now encoded by at most (ncols + 1) pointer values. This is the same prefix-sum trick used in counting sort and in CSR for rows.',
        'The insight is a compression of repeated metadata into boundary markers. Instead of labeling every nonzero with its column, you partition the nonzero arrays by column and record the partition boundaries. The entries between two adjacent pointers all belong to the same column by construction.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'CSC uses three arrays. values[k] stores the k-th nonzero value. rowIdx[k] stores the row coordinate of that value. colPtr[j] stores the starting position in values and rowIdx for column j. The array colPtr has length (ncols + 1): one entry per column plus a sentinel at the end. colPtr[ncols] equals nnz, the total number of stored nonzeros.',
        'To read column j, compute start = colPtr[j] and end = colPtr[j+1]. The row indices for column j are rowIdx[start], rowIdx[start+1], ..., rowIdx[end-1]. The corresponding values are values[start], values[start+1], ..., values[end-1]. The number of nonzeros in column j is (end - start). If start equals end, the column is empty.',
        'Building CSC from COO triples proceeds in three steps. First, count how many nonzeros belong to each column (one pass over the triples). Second, compute colPtr as the prefix sum of those counts -- colPtr[0] = 0, colPtr[1] = count_for_col_0, colPtr[2] = count_for_col_0 + count_for_col_1, and so on. Third, scatter each triple into its column\'s region of rowIdx and values, using a running write cursor per column. This is O(nnz) total work.',
        'Most implementations also sort rowIdx within each column. Sorted rows enable binary search for a specific row within a column (useful for element lookup), merge-based column intersection (useful for sparse matrix multiplication), and predictable access patterns for solver kernels.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on the partition property: the ranges [colPtr[0], colPtr[1]), [colPtr[1], colPtr[2]), ..., [colPtr[ncols-1], colPtr[ncols]) are non-overlapping and cover exactly positions 0 through nnz-1. Every stored nonzero belongs to exactly one column. No nonzero is lost and no nonzero is counted twice.',
        'The monotonicity of colPtr guarantees this partition. Because colPtr is built by prefix sum of non-negative counts, it is non-decreasing: colPtr[j] <= colPtr[j+1] for all j. Equal adjacent pointers mean an empty column. Strictly increasing adjacent pointers mean a non-empty column. The final pointer colPtr[ncols] = nnz closes the partition.',
        'The transpose duality provides a second correctness argument. CSC(A) is structurally identical to CSR(A^T). If you take a correct CSR representation of A^T (which compresses rows of A^T, i.e., columns of A) and relabel rowPtr as colPtr and colIdx as rowIdx, you get a correct CSC of A. Any algorithm proven correct on CSR automatically works on CSC when applied to the transposed matrix.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Storage: colPtr uses (ncols + 1) integers. rowIdx and values each use nnz entries. Total: (ncols + 1) + 2*nnz. Compare to COO at 3*nnz and dense at (nrows * ncols). For a 10,000 x 10,000 matrix with 50,000 nonzeros, CSC uses about 110,001 numbers. COO uses 150,000. Dense uses 100,000,000.',
        'Column slice: O(nnz_j) where nnz_j is the number of nonzeros in column j -- two pointer reads plus a linear scan. Row slice: O(ncols) in the worst case, because you must check every column\'s slice for entries in that row. This asymmetry is the defining tradeoff. If you need fast rows, use CSR.',
        'Element lookup A[i,j]: find column j\'s slice in O(1), then search for row i within the slice. Unsorted rows: O(nnz_j). Sorted rows: O(log nnz_j) via binary search. Construction from COO: O(nnz) if you use counting sort, or O(nnz log nnz) if you use comparison sort. Conversion to CSR: O(nnz) by treating CSC as COO and building CSR, or equivalently by transposing the index arrays.',
        'Matrix-vector multiply y = A*x in CSC: for each column j, add x[j] * values[k] to y[rowIdx[k]] for k in [colPtr[j], colPtr[j+1]). This scatters into the output vector, which can cause cache conflicts if rows are accessed irregularly. CSR gathers from the input vector, which is typically more cache-friendly. Transpose multiply y = A^T * x in CSC behaves like CSR\'s y = A*x and is naturally efficient.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Sparse direct solvers (SuiteSparse, MUMPS, SuperLU) use CSC as their primary input format. Column structure drives symbolic analysis: the elimination tree, the column dependency graph, and fill-reducing orderings (approximate minimum degree, nested dissection) all operate on columns. When you call scipy.sparse.linalg.spsolve, your matrix is converted to CSC internally if it is not already.',
        'Optimization solvers work column-by-column. In coordinate descent, each iteration updates one variable, which requires reading one column of the design matrix. In interior-point methods, the normal equations involve A^T * D * A, where A is stored in CSC so that columns of A are directly accessible. MATLAB\'s backslash operator and Julia\'s SparseArrays both default to CSC.',
        'In graph algorithms, CSC represents incoming edges. If row i in column j means "edge from node i to node j," then column j\'s slice lists all nodes with edges into j. PageRank\'s update step -- summing contributions from all incoming neighbors -- maps directly to a column scan. Bipartite matching algorithms that process one side of the graph column-by-column also benefit.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Row-dominated workloads pay the full asymmetry penalty. If your inner loop iterates over rows of A, CSC forces you to either scan every column looking for entries in that row (O(ncols) per row) or maintain a separate row index. For row-oriented sparse matrix-vector multiply, CSR is strictly better -- it gathers from the input vector with sequential memory access instead of scattering into the output.',
        'Dynamic insertion breaks the contiguous layout. Adding a nonzero to column j requires shifting all entries for columns j+1 through ncols-1 to make room, then updating every colPtr from j+1 onward. This is O(nnz) work per insertion. In practice, dynamic assembly uses COO or linked-list structures, then converts to CSC once the structure is finalized.',
        'At moderate density (roughly above 10-30% nonzero, depending on hardware), the pointer overhead, indirect indexing, and irregular memory access patterns of CSC can be slower than dense BLAS routines. Modern CPUs and GPUs are heavily optimized for dense, regular access. A 1000 x 1000 matrix that is 20% full has 200,000 nonzeros but only 1,000,000 total entries -- the dense approach uses 5x more memory but may run faster due to vectorization and cache line utilization.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a 5x4 matrix A with 6 nonzeros: A[1,0]=7, A[3,0]=2, A[0,2]=5, A[1,2]=8, A[4,2]=3, A[2,3]=9. Written out, A looks like: row 0 = [_, _, 5, _], row 1 = [7, _, 8, _], row 2 = [_, _, _, 9], row 3 = [2, _, _, _], row 4 = [_, _, 3, _]. There are 5 rows, 4 columns, and 6 nonzeros.',
        'Step 1: count nonzeros per column. Column 0 has 2 (rows 1 and 3). Column 1 has 0. Column 2 has 3 (rows 0, 1, 4). Column 3 has 1 (row 2). Step 2: prefix sum gives colPtr = [0, 2, 2, 5, 6]. Notice column 1 is empty: colPtr[1] = colPtr[2] = 2. The sentinel colPtr[4] = 6 = nnz.',
        'Step 3: fill rowIdx and values column by column, sorting rows within each column. Column 0 (positions 0-1): rowIdx = [1, 3], values = [7, 2]. Column 1 (positions 2-1, empty): nothing. Column 2 (positions 2-4): rowIdx = [0, 1, 4], values = [5, 8, 3]. Column 3 (position 5): rowIdx = [2], values = [9]. Final arrays: colPtr = [0, 2, 2, 5, 6], rowIdx = [1, 3, 0, 1, 4, 2], values = [7, 2, 5, 8, 3, 9].',
        'Verification: to read column 2, compute start = colPtr[2] = 2, end = colPtr[3] = 5. Walk k = 2, 3, 4: row indices are 0, 1, 4 with values 5, 8, 3. That matches A[0,2]=5, A[1,2]=8, A[4,2]=3. To check column 1: start = colPtr[1] = 2, end = colPtr[2] = 2, so end - start = 0, confirming the column is empty. Total storage: 5 integers for colPtr + 6 integers for rowIdx + 6 numbers for values = 17 slots, versus 5*4 = 20 for dense. The savings grow with matrix size and sparsity.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary references: Timothy Davis, "Direct Methods for Sparse Linear Systems" (SIAM, 2006) -- the definitive treatment of CSC in solver contexts. SciPy sparse module documentation at https://docs.scipy.org/doc/scipy/reference/sparse.html covers the scipy.sparse.csc_matrix API. NVIDIA cuSPARSE at https://docs.nvidia.com/cuda/cusparse/ documents GPU-accelerated CSC operations. The MLIR SparseTensor dialect at https://mlir.llvm.org/docs/Dialects/SparseTensorOps/ shows how compilers reason about sparse formats.',
        'Study next: COO Sparse Tensor Assembly Primer for the construction format that feeds CSC. Compressed Sparse Row Graph for the row-oriented twin format. Block Sparse Row Kernel Layout Case Study for hardware-aware blocking that improves on plain CSR/CSC. Sparse Format Selection Compiler Lowering Case Study for automated format choice. GraphBLAS Sparse Matrix Graph Case Study for the algebraic framework that unifies sparse matrix and graph operations.',
      ],
    },
  ],
};
