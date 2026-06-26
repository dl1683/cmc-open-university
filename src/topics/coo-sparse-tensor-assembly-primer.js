// Coordinate sparse tensor assembly: collect (index tuple, value) triples,
// sort and coalesce duplicates, then lower to compressed formats.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'coo-sparse-tensor-assembly-primer',
  title: 'COO Sparse Tensor Assembly Primer',
  category: 'Data Structures',
  summary: 'A sparse tensor primer: coordinate triples, duplicate accumulation, canonical sorting, coalescing, explicit zeros, multidimensional coordinates, and lowering to CSR/CSC/BSR.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['assemble triples', 'coalesce lower'], defaultValue: 'assemble triples' },
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

function cooGraph(title) {
  return graphState({
    nodes: [
      { id: 'events', label: 'events', x: 0.7, y: 3.5, note: 'updates' },
      { id: 'rows', label: 'row', x: 2.1, y: 2.0, note: 'i' },
      { id: 'cols', label: 'col', x: 2.1, y: 5.0, note: 'j' },
      { id: 'vals', label: 'val', x: 3.6, y: 3.5, note: 'x' },
      { id: 'triples', label: 'COO', x: 5.2, y: 3.5, note: 'triples' },
      { id: 'sort', label: 'sort', x: 6.8, y: 2.0, note: 'lex' },
      { id: 'sum', label: 'sum', x: 6.8, y: 5.0, note: 'dups' },
      { id: 'canon', label: 'canon', x: 8.4, y: 3.5, note: 'unique' },
      { id: 'lower', label: 'lower', x: 9.5, y: 3.5, note: 'CSR' },
    ],
    edges: [
      { id: 'e-events-rows', from: 'events', to: 'rows' },
      { id: 'e-events-cols', from: 'events', to: 'cols' },
      { id: 'e-rows-vals', from: 'rows', to: 'vals' },
      { id: 'e-cols-vals', from: 'cols', to: 'vals' },
      { id: 'e-vals-triples', from: 'vals', to: 'triples' },
      { id: 'e-triples-sort', from: 'triples', to: 'sort' },
      { id: 'e-sort-sum', from: 'sort', to: 'sum' },
      { id: 'e-sum-canon', from: 'sum', to: 'canon' },
      { id: 'e-canon-lower', from: 'canon', to: 'lower' },
    ],
  }, { title });
}

function lowerGraph(title) {
  return graphState({
    nodes: [
      { id: 'coo', label: 'COO', x: 0.8, y: 3.5, note: 'build' },
      { id: 'csr', label: 'CSR', x: 2.4, y: 1.7, note: 'row ops' },
      { id: 'csc', label: 'CSC', x: 2.4, y: 5.3, note: 'col ops' },
      { id: 'bsr', label: 'BSR', x: 4.2, y: 3.5, note: 'blocks' },
      { id: 'spmv', label: 'SpMV', x: 6.0, y: 1.7, note: 'kernel' },
      { id: 'solve', label: 'solve', x: 6.0, y: 5.3, note: 'factor' },
      { id: 'gpu', label: 'GPU', x: 7.8, y: 3.5, note: 'library' },
      { id: 'audit', label: 'audit', x: 9.2, y: 3.5, note: 'nnz' },
    ],
    edges: [
      { id: 'e-coo-csr', from: 'coo', to: 'csr' },
      { id: 'e-coo-csc', from: 'coo', to: 'csc' },
      { id: 'e-coo-bsr', from: 'coo', to: 'bsr' },
      { id: 'e-csr-spmv', from: 'csr', to: 'spmv' },
      { id: 'e-csc-solve', from: 'csc', to: 'solve' },
      { id: 'e-bsr-gpu', from: 'bsr', to: 'gpu' },
      { id: 'e-spmv-audit', from: 'spmv', to: 'audit' },
      { id: 'e-gpu-audit', from: 'gpu', to: 'audit' },
    ],
  }, { title });
}

function* assembleTriples() {
  const pipelineNodes = ['events', 'rows', 'cols', 'vals', 'triples', 'sort', 'sum', 'canon', 'lower'];
  yield {
    state: cooGraph('COO is the assembly format for sparse updates'),
    highlight: { active: ['events', 'rows', 'cols', 'vals', 'triples', 'e-events-rows', 'e-events-cols', 'e-rows-vals', 'e-cols-vals', 'e-vals-triples'], found: ['canon'] },
    explanation: `Coordinate format stores one tuple per nonzero contribution across a ${pipelineNodes.length}-stage pipeline (${pipelineNodes.join(' -> ')}). It is easy to append because no row pointer needs to be known in advance.`,
    invariant: `COO is simple to build at the "${pipelineNodes[4]}" stage; compressed formats at "${pipelineNodes[8]}" are better to compute with.`,
  };
  const triples = [
    { id: 't0', label: 't0' },
    { id: 't1', label: 't1' },
    { id: 't2', label: 't2' },
    { id: 't3', label: 't3' },
  ];
  const tripleCols = [
    { id: 'row', label: 'row' },
    { id: 'col', label: 'col' },
    { id: 'val', label: 'val' },
  ];
  yield {
    state: labelMatrix(
      'Triples',
      triples,
      tripleCols,
      [
        ['0', '2', '3'],
        ['1', '0', '4'],
        ['1', '2', '5'],
        ['1', '2', '7'],
      ],
    ),
    highlight: { active: ['t2:row', 't2:col', 't3:row', 't3:col'], compare: ['t2:val', 't3:val'] },
    explanation: `${triples.length} triples with ${tripleCols.length} fields each. Duplicate coordinates (t2 and t3 share row 1, col 2) are normal during assembly. Finite element assembly, graph aggregation, and sparse feature construction often emit multiple contributions to the same coordinate.`,
  };
  const dimensionRows = [
    { id: 'm2', label: 'matrix' },
    { id: 'm3', label: 'tensor' },
    { id: 'batch', label: 'batch' },
    { id: 'coords', label: 'coords' },
  ];
  yield {
    state: labelMatrix(
      'N-D COO',
      dimensionRows,
      [
        { id: 'shape', label: 'shape' },
        { id: 'tuple', label: 'tuple' },
      ],
      [
        ['2-D', '(i,j)'],
        ['3-D', '(i,j,k)'],
        ['N-D', '(b,i,j,...)'],
        ['rank x nnz', 'index matrix'],
      ],
    ),
    highlight: { active: ['m2:tuple', 'm3:tuple', 'batch:tuple'], found: ['coords:tuple'] },
    explanation: `COO generalizes across ${dimensionRows.length} dimensionality levels (${dimensionRows.map(r => r.label).join(', ')}). Each nonzero stores a coordinate tuple and a value. PyTorch represents sparse COO indices as a coordinate matrix plus a values tensor.`,
  };
  yield {
    state: cooGraph('Canonical COO sorts and coalesces duplicates'),
    highlight: { active: ['triples', 'sort', 'sum', 'canon', 'e-triples-sort', 'e-sort-sum', 'e-sum-canon'], compare: ['lower'] },
    explanation: `Canonical COO is sorted by coordinates and has no duplicate entries. Starting from ${triples.length} raw triples, coalescing turns repeated coordinates into a single value, usually by summing duplicate contributions.`,
  };
}

function* coalesceLower() {
  const targetFormats = ['csr', 'csc', 'bsr'];
  const lowerNodes = ['coo', 'csr', 'csc', 'bsr', 'spmv', 'solve', 'gpu', 'audit'];
  yield {
    state: lowerGraph('COO lowers into the format the kernel wants'),
    highlight: { active: ['coo', 'csr', 'csc', 'bsr', 'e-coo-csr', 'e-coo-csc', 'e-coo-bsr'], found: ['gpu'] },
    explanation: `COO is a staging layout. Libraries convert it to ${targetFormats.length} compute formats (${targetFormats.map(f => f.toUpperCase()).join(', ')}): CSR for row-wise arithmetic, CSC for column-wise operations, or BSR when nonzeros cluster in dense blocks.`,
  };
  const formats = [
    { id: 'coo', label: 'COO' },
    { id: 'csr', label: 'CSR' },
    { id: 'csc', label: 'CSC' },
    { id: 'bsr', label: 'BSR' },
  ];
  yield {
    state: labelMatrix(
      'Format choice',
      formats,
      [
        { id: 'best', label: 'best' },
        { id: 'weak', label: 'weak' },
      ],
      [
        ['build', 'math'],
        ['row math', 'insert'],
        ['col math', 'row scan'],
        ['block ops', 'ragged'],
      ],
    ),
    highlight: { active: ['coo:best', 'csr:best', 'csc:best', 'bsr:best'], compare: ['coo:weak'] },
    explanation: `${formats.length} sparse formats (${formats.map(f => f.label).join(', ')}) each have a strength and a weakness. The common mistake is asking one format to do everything.`,
  };
  yield {
    state: lowerGraph('The lowering path should be visible in performance traces'),
    highlight: { active: ['csr', 'spmv', 'gpu', 'audit', 'e-csr-spmv', 'e-spmv-audit', 'e-gpu-audit'], compare: ['coo'] },
    explanation: `If every request builds COO and converts to CSR on the hot path, the conversion across ${lowerNodes.length} pipeline nodes is part of latency. Production systems should record nnz, duplicates, format conversion, and kernel choice.`,
  };
  const auditMetrics = [
    { id: 'nnz', label: 'nnz' },
    { id: 'dups', label: 'dups' },
    { id: 'zeros', label: 'zeros' },
    { id: 'fmt', label: 'fmt' },
    { id: 'time', label: 'time' },
  ];
  yield {
    state: labelMatrix(
      'Audit row',
      auditMetrics,
      [
        { id: 'value', label: 'value' },
        { id: 'why', label: 'why' },
      ],
      [
        ['count', 'size'],
        ['count', 'coalesce'],
        ['count', 'waste'],
        ['CSR/CSC', 'kernel'],
        ['ms', 'budget'],
      ],
    ),
    highlight: { active: ['nnz:value', 'dups:value', 'fmt:value', 'time:value'], compare: ['zeros:why'] },
    explanation: `Sparse workloads need ${auditMetrics.length} observability metrics (${auditMetrics.map(m => m.label).join(', ')}). Density, duplicate rate, explicit zeros, conversion time, and kernel format often explain more than matrix dimensions do.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'assemble triples') yield* assembleTriples();
  else if (view === 'coalesce lower') yield* coalesceLower();
  else throw new InputError('Pick a COO sparse tensor view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has two views. "Assemble triples" shows the COO pipeline from raw events to canonical form: coordinate contributions arrive one at a time, collect into an unsorted triple list, then sort lexicographically and coalesce duplicates by summing their values. Watch the duplicate pair at coordinates (1, 2) -- triples t2 and t3 share the same row and column with values 5 and 7, and coalescing sums them into 12.',
        {type: 'callout', text: 'COO is a staging format: append sparse facts cheaply, canonicalize duplicates, then lower to the compute layout.'},
        '"Coalesce lower" shows the second half of the pipeline: canonical COO converting into CSR, CSC, or BSR depending on the compute kernel downstream. Active nodes (bright) mark the phase currently executing. Found nodes mark outputs that are guaranteed correct at that point. Highlighted matrix cells in the triple table mark duplicate coordinates whose values must be combined.',
        {type: 'image', src: './assets/gifs/coo-sparse-tensor-assembly-primer.gif', alt: 'Animated walkthrough of the coo sparse tensor assembly primer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'At each frame, ask: which phase of the pipeline am I in -- event collection, canonicalization, or format lowering? Each phase establishes a different invariant. Collection allows duplicates and disorder. Canonicalization enforces sorted order and uniqueness. Lowering builds the compressed pointers that make computation fast.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Sparse data arrives as events, not as organized matrices. A finite-element solver computes local stiffness contributions for each mesh element and emits them as (row, column, value) triples. Two elements sharing a node both contribute to the same global matrix entry, so the same (row, column) pair appears multiple times. A graph pipeline emits (source, destination, weight) edges. A feature pipeline emits (example_id, feature_id, value) triples. A recommendation system logs user-item interactions. In every case, the producer knows coordinates and values but does not know the final matrix shape, the sparsity pattern, or the row ordering.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Finite_element_sparse_matrix.png/250px-Finite_element_sparse_matrix.png', alt: 'Sparse finite element matrix with nonzero entries shown as black marks', caption: 'Finite element sparse matrix pattern. Source: https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Finite_element_sparse_matrix.png/250px-Finite_element_sparse_matrix.png'},
        'The system needs a format that can absorb contributions without knowing the final answer in advance. That is the assembly problem: collect sparse updates now, organize them later. The format must tolerate arbitrary arrival order, accept duplicate coordinates, and impose no structural constraints during collection.',
        'COO -- coordinate format -- solves this by storing one triple per contribution: a row index, a column index, and a value. No row pointers, no column compression, no ordering constraint. Each contribution appends to three parallel arrays and moves on. The name "coordinate" comes from the fact that each stored entry carries its own coordinates, unlike compressed formats where position is implied by pointer arithmetic.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is a dense 2D array. Allocate an m-by-n grid of zeros, then for each contribution (i, j, v), execute A[i][j] += v. Random access is O(1). Duplicates accumulate automatically because the += operation sums into the existing cell. No sorting, no deduplication, no conversion step. The code is three lines and obviously correct.',
        'For a 1,000-by-1,000 matrix in float64, this costs 8 MB of memory: 1,000 * 1,000 * 8 bytes. If the matrix has 5,000 nonzeros, every sparse matrix-vector multiply (SpMV) still touches all 1,000,000 cells because the dense format does not know which cells are zero. The SpMV reads 8 MB of data to access 40 KB of useful values.',
        'A hash map keyed on (i, j) pairs is the second natural attempt. This avoids allocating the full grid: only nonzero entries consume memory. But hashing each contribution costs more than a simple array index, and the hash table scatters entries across memory. When the SpMV kernel needs to walk row 5 in order, it must probe every bucket to find the entries in that row. Cache locality is destroyed.',
        'Both approaches work for small problems. A 100-by-100 matrix with 300 nonzeros fits comfortably in either format. The question is what happens when the matrix grows.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Dense allocation fails when the matrix is large and sparse. A finite-element mesh with 10 million nodes produces a matrix with 10^14 potential entries but only about 10^8 nonzeros -- a density under 0.0001%. Allocating the dense grid requires 800 terabytes in float64, which is physically impossible. Even if memory were free, iterating over 10^14 cells to find 10^8 values wastes six orders of magnitude of compute on zeros.',
        'The numbers scale steeply. A small FEM mesh (1,000 rows, 7,000 nonzeros) stores 8 MB dense versus 168 KB in COO. A medium mesh (100,000 rows, 2 million nonzeros) stores 80 GB dense versus 48 MB in COO. At 10 million rows, dense storage is 800 TB while COO stores the same information in 2.4 GB. The dense approach does not merely get slow; it becomes physically unrepresentable.',
        'The hash-map approach avoids the allocation wall but hits a different one: no locality. A hash map keyed on (i, j) scatters entries across memory in bucket order, not matrix order. Walking row 5 requires probing every bucket. Benchmarks show SpMV on a hash-based sparse matrix running 10-100x slower than the same SpMV on a format with contiguous row storage, because every memory access is a cache miss.',
        'The deeper problem is that no single format is good at both assembly and computation. Assembly needs random appends, duplicate tolerance, and no shape constraint. Computation needs ordered traversal, compressed pointers, and kernel-friendly layout. The assembly phase and the compute phase have opposite access patterns, and trying to serve both with one format means paying the wrong cost in one of the two phases.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate assembly from computation by using a staging format. COO handles assembly: append triples cheaply with no structural constraints. Then convert once to a compressed format (CSR, CSC, BSR) that handles computation: ordered traversal, contiguous row segments, efficient kernel access. The conversion is a one-time cost. The computation runs many times on the compressed result.',
        'This is the same principle as sorting a file before binary-searching it. Sorting costs O(n log n), but it makes every subsequent search O(log n) instead of O(n). COO-to-CSR conversion costs O(nnz log nnz) for the sort, but it makes every subsequent SpMV row-contiguous instead of scattered. If the SpMV runs k times, the conversion pays for itself after a small k.',
        'The staging approach also makes duplicates a first-class concern. During assembly, the same coordinate can receive multiple contributions -- this is not a bug but a feature. Finite-element assembly requires it: two mesh elements sharing a node must both contribute to the same stiffness entry. COO absorbs duplicates during collection, then coalesces them (usually by summing) during canonicalization, before the data enters the compressed format.',
        'The insight is architectural, not algorithmic. COO does not speed up any single operation. It gives the system a clean boundary between the messy, unstructured, duplicate-rich world of data collection and the clean, ordered, compressed world of computation.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'COO separates assembly from computation into three phases: collect, canonicalize, and lower. Phase 1 (collect) accepts contributions as (row, col, value) triples and appends them to three parallel arrays: a row-index array, a column-index array, and a values array. Order does not matter. Duplicates are allowed. Appending is O(1) amortized because each append is an array push with no structural invariant to maintain.',
        'Phase 2 (canonicalize) sorts the triples lexicographically by (row, col). After sorting, duplicate coordinates are adjacent, so a single linear pass can coalesce them. The coalesce pass walks the sorted arrays with a read pointer and a write pointer. When the read pointer sees the same (row, col) as the write pointer, it adds the value to the write position. When it sees a new coordinate, it advances the write pointer and copies. The result is canonical COO: sorted, unique coordinates, no duplicates.',
        'Consider 4 triples: (0,2,3), (1,0,4), (1,2,5), (1,2,7). Sorting by (row, col) gives: (0,2,3), (1,0,4), (1,2,5), (1,2,7). The last two share coordinate (1,2), so coalescing sums their values: 5 + 7 = 12. Canonical result: 3 triples -- (0,2,3), (1,0,4), (1,2,12).',
        'Phase 3 (lower) converts canonical COO to the format the downstream kernel needs. For CSR (Compressed Sparse Row), scan the sorted row indices to build a row-pointer array: row_ptr[i] is the index where row i starts in the values array. For the example above, row_ptr = [0, 1, 3] (row 0 has 1 entry starting at index 0, row 1 has 2 entries starting at index 1). For CSC, sort by column instead of row. For BSR (Block Sparse Row), group entries into dense blocks where nonzeros cluster.',
        'For N-dimensional tensors, the same pipeline applies. Each nonzero stores a coordinate tuple of length rank instead of just (i, j). PyTorch represents sparse COO as a (rank x nnz) index matrix plus a values tensor. The sort becomes a lexicographic sort on rank-length tuples, and coalescing follows the same adjacent-duplicate logic.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'COO works because it separates two concerns that dense and compressed formats conflate. Assembly needs fast, unordered, duplicate-tolerant appends. Computation needs ordered, compressed, duplicate-free traversal. No single format satisfies both requirements simultaneously. COO satisfies the first concern, then converts to a format that satisfies the second.',
        'Correctness of coalescing follows from the commutativity and associativity of addition. If contributions (1,2,5) and (1,2,7) both target cell (1,2), the final value must be 5 + 7 = 12 regardless of arrival order. Sorting makes duplicates adjacent, and the linear coalesce pass combines them left to right. Because addition is commutative and associative, any permutation of the input triples produces the same coalesced result. This is not just convenient -- in finite-element assembly, dropping either contribution changes the physics of the simulation.',
        'The conversion to CSR preserves every nonzero value. The sort does not change values, only their positions. The row-pointer construction is a counting pass: count how many entries each row has, compute a prefix sum, and use the prefix sums as row boundaries. Every entry in the canonical COO appears exactly once in the CSR output, at the position determined by its row and column. The conversion is bijective on the set of nonzero entries.',
        'The format also makes sparse bugs visible before they hide inside compressed pointers. A COO list can be inspected for out-of-bounds coordinates, unexpected duplicate rates, explicit zeros that waste storage, and unsorted entries. Once data enters CSR row pointers, the same bugs are much harder to diagnose because the coordinate information is implicit.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Appending one triple to COO costs O(1) amortized -- an array push with no structural invariant to maintain. Sorting nnz triples costs O(nnz log nnz) with a comparison sort, which is the bottleneck of the entire pipeline. Coalescing after sorting costs O(nnz) -- a single linear scan. Lowering to CSR costs O(nnz + m) where m is the number of rows: one pass to count entries per row, one prefix sum, and one pass to place entries.',
        'When nnz doubles, the sort cost slightly more than doubles (the log factor grows). For nnz = 1 million, sorting takes a few hundred milliseconds on a single core. For nnz = 100 million, sorting takes seconds even with an optimized comparison sort. Radix sort on integer coordinates can reduce sorting to O(nnz * rank) but requires O(nnz) extra workspace. Some libraries skip sorting entirely and use a scatter-based CSR construction: count row sizes, compute prefix sums, and place each entry directly at its row-determined position.',
        'Storage for a matrix with nnz nonzeros: COO stores 3 arrays of length nnz (row indices, column indices, values), totaling 3 * nnz entries. With 4-byte integers and 8-byte floats, that is 16 * nnz bytes. CSR replaces the nnz row indices with (m + 1) row pointers, saving (nnz - m - 1) integers. For a matrix with 10 million nonzeros and 100,000 rows, CSR saves roughly 40 MB of integer storage over COO.',
        'SpMV on COO is correct but slow. Each triple scatters its contribution to y[row[k]], causing random writes to the output vector. CSR SpMV processes one row at a time, accumulating a dot product into a single y[i] per row segment. The algorithmic cost is the same O(nnz), but CSR achieves 5-20x better throughput on modern CPUs because sequential memory access fills cache lines instead of wasting them. On a matrix with 10 million nonzeros, CSR SpMV takes about 5 milliseconds while COO SpMV takes 50-100 milliseconds.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Finite-element assembly is the original and most important use case. A structural mechanics solver meshes a physical domain into millions of elements. Each element computes a small local stiffness matrix (typically 12x12 for a 3D tetrahedral element) and emits its entries as COO triples referencing global node indices. Adjacent elements share nodes, so the same global (row, col) pair receives contributions from multiple elements. COO absorbs these overlapping contributions without coordination, then coalesces by summing to produce the global stiffness matrix.',
        'Graph construction uses COO as its natural intake format. Edges arrive as (source, destination, weight) triples in arbitrary order. Duplicate edges (parallel edges in a multigraph) accumulate naturally. After coalescing, the result lowers to CSR for breadth-first search, PageRank, or community detection. SciPy, NetworkX, and SNAP all support COO as an input format for graph construction.',
        'Sparse feature hashing in machine learning emits (example_id, hashed_feature_id, value) triples. When two features hash to the same bucket for the same example, their values sum during coalescing. The COO-to-CSR conversion produces a feature matrix ready for sparse linear models or gradient-boosted trees.',
        'Matrix Market (.mtx) is the most widely used sparse matrix interchange format, and it is COO. The SuiteSparse Matrix Collection, which hosts over 2,800 sparse matrices from real applications, distributes every matrix in Matrix Market format. SciPy, MATLAB, Julia, PETSc, and Trilinos all read and write .mtx files. COO is the lingua franca of sparse data exchange.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'COO fails as a compute format. If a program keeps data in COO and runs 1,000 SpMVs without converting to CSR, it pays the scattered-write penalty on every iteration. With 10 million nonzeros, that is 1,000 iterations at 50 ms each versus 5 ms each after a one-time CSR conversion costing perhaps 200 ms. Total: 50,000 ms in COO versus 5,200 ms in CSR. The conversion pays for itself after 4 iterations.',
        'Uncoalesced duplicates cause silent correctness bugs. If a library converts uncoalesced COO to CSR without summing duplicates, the resulting matrix has extra entries that produce wrong SpMV results. SciPy\'s coo_matrix.tocsr() sums duplicates automatically, but PyTorch\'s sparse_coo_tensor requires an explicit coalesce() call. The semantics differ across libraries, and the failure is silent: no error, just wrong numbers.',
        'Explicit stored zeros are a subtle trap. A stored zero at coordinate (2, 3) occupies index space, participates in duplicate handling, and inflates the nonzero count (nnz). If the zero is a cancellation result (two contributions that sum to zero), it wastes storage and confuses density metrics. The fix is to filter zeros before lowering, using a pass like SciPy\'s eliminate_zeros(). Sparse does not mean "nonzero by magic"; it means "only explicitly stored entries are represented," and those entries can be zero.',
        'GPU kernels rarely accept COO directly. NVIDIA\'s cuSPARSE deprecated COO SpMV in favor of CSR and BSR kernels optimized for coalesced memory access on GPU hardware. COO\'s random-write pattern maps poorly to GPU warp execution, where threads in a warp need to write to nearby memory locations to achieve full bandwidth. Any GPU sparse pipeline must lower from COO to CSR or BSR before hitting the compute kernel.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider assembling a 3-by-3 sparse matrix from 6 contributions emitted by a small finite-element mesh. The raw triples arrive in this order: (0,2,3.0), (1,0,4.0), (2,1,1.0), (1,2,5.0), (1,2,7.0), (0,2,2.0). Two pairs share coordinates: (1,2) appears twice with values 5.0 and 7.0, and (0,2) appears twice with values 3.0 and 2.0.',
        'Phase 1 (collect) stores the 6 triples into three arrays. row = [0,1,2,1,1,0], col = [2,0,1,2,2,2], val = [3.0, 4.0, 1.0, 5.0, 7.0, 2.0]. No ordering or deduplication yet. Storage: 6 triples * 16 bytes each = 96 bytes.',
        'Phase 2 (canonicalize) sorts by (row, col). Result: (0,2,3.0), (0,2,2.0), (1,0,4.0), (1,2,5.0), (1,2,7.0), (2,1,1.0). Now coalesce: (0,2) sums to 5.0, (1,2) sums to 12.0. Canonical COO: 4 triples -- (0,2,5.0), (1,0,4.0), (1,2,12.0), (2,1,1.0). The duplicate rate was 2/6 = 33%, which is typical for finite-element meshes with shared nodes.',
        'Phase 3 (lower to CSR) counts entries per row: row 0 has 1, row 1 has 2, row 2 has 1. Prefix sum gives row_ptr = [0, 1, 3, 4]. Column indices: col_idx = [2, 0, 2, 1]. Values: vals = [5.0, 4.0, 12.0, 1.0]. The dense equivalent of this matrix is [[0, 0, 5], [4, 0, 12], [0, 1, 0]]. CSR uses 4 integers for row_ptr + 4 integers for col_idx + 4 floats for values = 64 bytes. Dense uses 9 floats = 72 bytes. At this tiny size the savings are negligible, but at 10 million nonzeros in a 10-million-row matrix, COO stores 160 MB while CSR stores 120 MB.',
        'Verification: multiply the CSR matrix by x = [1, 1, 1]. Row 0: val[0]*x[col[0]] = 5.0*1 = 5.0. Row 1: val[1]*x[col[1]] + val[2]*x[col[2]] = 4.0*1 + 12.0*1 = 16.0. Row 2: val[3]*x[col[3]] = 1.0*1 = 1.0. Result y = [5.0, 16.0, 1.0]. The coalesced value 12.0 at (1,2) correctly reflects both original contributions (5.0 + 7.0), confirming that coalescing preserved the intended semantics.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Timothy A. Davis, "Direct Methods for Sparse Linear Systems" (SIAM, 2006) is the canonical reference for COO, CSC, and assembly semantics in scientific computing. It covers duplet assembly, fill-reducing orderings, and the full chain from COO to factorized solvers. SciPy\'s sparse module documentation (scipy.sparse.coo_matrix) is the most accessible practical reference for COO construction, duplicate summing, and format conversion in Python.',
        'PyTorch\'s sparse tensor documentation (torch.sparse_coo_tensor) covers N-dimensional COO with the coordinate-matrix layout and the coalesce() method. The MLIR SparseTensor dialect is the emerging compiler-level approach to sparse format selection and automatic lowering from COO to compressed forms. NVIDIA\'s cuSPARSE documentation covers GPU sparse format support, the COO deprecation rationale, and CSR/BSR kernel design.',
        'The Matrix Market format specification (NIST) defines the COO-based interchange format used by the SuiteSparse Matrix Collection, which hosts over 2,800 real sparse matrices for benchmarking.',
        'Study Compressed Sparse Row Graph next if your workload is row-wise SpMV or graph traversal -- CSR is the natural lowering target for COO in these cases. Study CSC Column Sparse Matrix Primer if you need column slicing or direct solvers. Study Block Sparse Row Kernel Layout Case Study if your nonzeros cluster in dense blocks, which is common in neural network weight matrices with structured sparsity. Study Sparse Format Selection Compiler Lowering Case Study if you want the compiler to choose the format automatically based on the access patterns in your kernel.',
        'Prerequisite topics: Arrays (the underlying storage for COO\'s three parallel arrays) and Sorting (the comparison sort or radix sort that drives canonicalization). Both are essential to understanding why COO\'s pipeline costs what it costs.',
      ],
    },
  ],
};
