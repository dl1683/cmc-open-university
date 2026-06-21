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
        'The animation has two views. "Assemble triples" shows coordinate contributions arriving one at a time, collecting into an unsorted COO list, then sorting and coalescing into canonical form. "Coalesce lower" shows the canonical COO converting into CSR, CSC, or BSR depending on the compute path ahead.',
        {
          type: 'callout',
          text: 'COO is a staging format: append sparse facts cheaply, canonicalize duplicates, then lower to the compute layout.',
        },
        'Active nodes are the phase currently executing. Found nodes mark outputs that are now guaranteed correct. Highlighted matrix cells in the triple table mark duplicate coordinates whose values must be combined.',
        {
          type: 'note',
          text: 'Watch the duplicate pair at (1, 2) in the assembly view. Two triples share the same coordinate with values 5 and 7. Coalescing sums them into 12. If you skip this step, SpMV will double-count that cell.',
        },
        'At each frame, ask: what phase of the pipeline am I in -- event collection, canonicalization, or format lowering? The phase determines which invariant is being established.',
      
        {type: 'image', src: './assets/gifs/coo-sparse-tensor-assembly-primer.gif', alt: 'Animated walkthrough of the coo sparse tensor assembly primer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Sparse data arrives as events. A finite-element solver emits local stiffness contributions per element. A graph pipeline emits (source, destination, weight) edges. A feature pipeline emits (example_id, feature_id, value) triples. A recommendation system logs user-item interactions. In every case, the producer knows coordinates and values but not the final matrix shape, sparsity pattern, or row ordering.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Finite_element_sparse_matrix.png/250px-Finite_element_sparse_matrix.png',
          alt: 'Sparse finite element matrix with nonzero entries shown as black marks',
          caption: 'Finite element sparse matrix pattern. Source: https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Finite_element_sparse_matrix.png/250px-Finite_element_sparse_matrix.png',
        },
        'The system needs a format that can absorb these contributions without knowing the answer in advance. That is the assembly problem: collect sparse updates now, organize them later.',
        {
          type: 'quote',
          text: 'The coordinate scheme is the natural format for constructing sparse matrices from finite element contributions, where the same index pair may appear multiple times.',
          attribution: 'Timothy A. Davis, "Direct Methods for Sparse Linear Systems" (SIAM, 2006)',
        },
        'COO -- coordinate format -- solves this by storing one triple per contribution: row index, column index, value. No row pointers, no column compression, no ordering constraint. Append and move on.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is a dense 2D array. Allocate an m-by-n matrix of zeros, then for each contribution (i, j, v), execute A[i][j] += v. Random access is O(1). Duplicates accumulate automatically. No sorting needed.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Dense assembly -- the obvious approach\nconst A = Array.from({length: m}, () => new Float64Array(n));\nfor (const [i, j, v] of contributions) {\n  A[i][j] += v;  // O(1) per contribution, duplicates handled\n}',
        },
        'This works for small, moderately dense matrices. A 1000-by-1000 matrix costs 8 MB in float64. Every SpMV touches all million entries even if only 5000 are nonzero. But the code is simple, correct, and easy to debug.',
        'Teams also reach for hash maps keyed on (i, j) pairs. This avoids allocating the full grid but pays hashing overhead per contribution and loses cache locality for later row-wise traversal.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Dense allocation fails when the matrix is large and sparse. A finite-element mesh with 10 million nodes produces a matrix with 10^14 potential entries but only about 10^8 nonzeros -- a density under 0.0001%. Allocating the dense grid is impossible. Even if memory were free, iterating over 10^14 cells to find 10^8 values wastes orders of magnitude of compute.',
        {
          type: 'table',
          headers: ['Matrix', 'Rows', 'Columns', 'Nonzeros', 'Density', 'Dense storage', 'COO storage'],
          rows: [
            ['Small FEM mesh', '1,000', '1,000', '7,000', '0.7%', '8 MB', '168 KB'],
            ['Medium FEM mesh', '100,000', '100,000', '2,000,000', '0.02%', '80 GB', '48 MB'],
            ['Large FEM mesh', '10,000,000', '10,000,000', '100,000,000', '0.0001%', '800 TB', '2.4 GB'],
          ],
        },
        'The hash-map approach avoids the allocation wall but hits a different one: no locality. A hash map keyed on (i, j) scatters entries across memory. Walking row 5 requires probing every bucket. SpMV on a hash-based sparse matrix is 10-100x slower than on a format with contiguous row storage.',
        {
          type: 'note',
          text: 'The wall is not "dense is slow." The wall is that no single format is good at both assembly (random appends, duplicates, unknown shape) and computation (ordered traversal, compressed pointers, kernel-friendly layout). The assembly phase and the compute phase have opposite access patterns.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'COO separates assembly from computation into three phases: collect, canonicalize, lower.',
        {
          type: 'diagram',
          text: 'Phase 1: COLLECT                Phase 2: CANONICALIZE         Phase 3: LOWER\n\n(0,2,3)  --+                     sort by (row, col):           Build row_ptr:\n(1,0,4)  --+--> unsorted COO     (0,2, 3)                     row_ptr = [0, 1, 2, 3]\n(1,2,5)  --+    [no constraints]  (1,0, 4)                     col_idx = [2, 0, 2]\n(1,2,7)  --+                     (1,2, 5) --+-- sum --> 12     values  = [3, 4, 12]\n                                  (1,2, 7) --+                        ^\n                                                               CSR: ready for SpMV',
          label: 'Three-phase pipeline: collect triples, sort and coalesce, lower to CSR',
        },
        'Phase 1: Collect. Each contribution appends a (row, col, value) triple to three parallel arrays. Order does not matter. Duplicates are allowed. Appending is O(1) amortized.',
        'Phase 2: Canonicalize. Sort the triples lexicographically by (row, col). After sorting, duplicate coordinates are adjacent, so a single linear pass can coalesce them -- typically by summing values. The result is canonical COO: sorted, unique coordinates, no duplicates.',
        'Phase 3: Lower. Convert canonical COO to the format the next kernel needs. For CSR, scan the sorted row indices to build row pointers. For CSC, sort by column first (or transpose). For BSR, group entries into dense blocks.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Coalesce: merge adjacent duplicates after sorting\nfunction coalesce(rows, cols, vals) {\n  let write = 0;\n  for (let read = 1; read < rows.length; read++) {\n    if (rows[read] === rows[write] && cols[read] === cols[write]) {\n      vals[write] += vals[read];  // accumulate duplicate\n    } else {\n      write++;\n      rows[write] = rows[read];\n      cols[write] = cols[read];\n      vals[write] = vals[read];\n    }\n  }\n  return write + 1;  // new nnz count\n}',
        },
        'For N-dimensional tensors, the same pipeline applies. Each nonzero stores a coordinate tuple of length rank instead of just (i, j). PyTorch represents this as a (rank x nnz) index matrix plus a values tensor. The sort becomes a lexicographic sort on rank-length tuples.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'COO works because it separates two concerns that dense and compressed formats conflate. Assembly needs fast, unordered, duplicate-tolerant appends. Computation needs ordered, compressed, duplicate-free traversal. No single format satisfies both. COO satisfies the first, then converts to a format that satisfies the second.',
        'Correctness of coalescing follows from commutativity and associativity of addition. If contributions (1,2,5) and (1,2,7) both target cell (1,2), the result must be 12 regardless of arrival order. Sorting makes duplicates adjacent; the linear coalesce pass combines them. The final value is the same sum regardless of the original triple order.',
        {
          type: 'note',
          text: 'Duplicate handling is semantics, not cleanup. In finite-element assembly, two elements sharing a node both contribute to the same global stiffness entry. Dropping either contribution changes the physics. Coalescing by addition is mathematically required, not an implementation convenience.',
        },
        'The format also makes sparse bugs visible before they hide. You can inspect a COO list for out-of-bounds coordinates, duplicate rates, explicit zeros, and unsorted entries. Once data enters CSR row pointers, the same bugs are much harder to diagnose.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Operation', 'Time', 'Notes'],
          rows: [
            ['Append one triple', 'O(1) amortized', 'Array push; no structure to maintain'],
            ['Sort triples', 'O(nnz log nnz)', 'Lexicographic sort on (row, col)'],
            ['Coalesce duplicates', 'O(nnz)', 'Linear scan after sort; duplicates are adjacent'],
            ['Lower to CSR', 'O(nnz + m)', 'One pass to count rows, one to place entries'],
            ['SpMV on COO', 'O(nnz)', 'But scattered writes to output -- poor cache behavior'],
            ['SpMV on CSR', 'O(nnz)', 'Contiguous row segments -- good cache behavior'],
          ],
        },
        'Storage for a matrix with nnz nonzeros: COO stores 3 arrays of length nnz (row indices, column indices, values), totaling 3 * nnz entries. CSR replaces the nnz row indices with (m + 1) row pointers, saving (nnz - m - 1) integers when nnz >> m. For a matrix with 10 million nonzeros and 100,000 rows, CSR saves about 10 million integers over COO.',
        'The sort is the bottleneck. When nnz = 100 million, sorting takes seconds even with an optimized comparison sort. Radix sort on integer coordinates can reduce this to O(nnz * rank) but requires extra workspace. Some libraries skip sorting entirely and use a scatter-based CSR construction that counts row sizes, computes prefix sums, and places entries directly.',
        {
          type: 'note',
          text: 'COO SpMV is correct but slow. Each triple scatters its contribution to y[row[k]], causing random writes. CSR SpMV processes one row at a time, writing to a single y[i] per row segment. The algorithmic cost is the same O(nnz), but CSR gets 5-20x better throughput on modern hardware due to sequential memory access.',
        },
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'COO wins in four access patterns:',
        {
          type: 'bullets',
          items: [
            'Event-driven assembly: finite-element solvers, graph construction, sparse feature hashing, and recommendation-system interaction logging all emit contributions in arbitrary order with frequent duplicates. COO absorbs them without pausing to maintain structure.',
            'Interchange and serialization: Matrix Market (.mtx), the most common sparse matrix exchange format, is COO. SciPy, MATLAB, Julia, and PETSc all read and write it. COO is the lingua franca of sparse data.',
            'Debugging and validation: a flat list of (row, col, value) triples is easy to print, sort, diff, and grep. When an SpMV kernel returns the wrong answer, dumping the matrix to COO and inspecting coordinates often reveals the bug in minutes.',
            'Dynamic sparsity patterns: when the set of nonzero coordinates changes between iterations (adaptive mesh refinement, graph rewiring, online feature selection), rebuilding COO from scratch each round is simpler and often faster than surgically updating compressed pointers.',
          ],
        },
        {
          type: 'code',
          language: 'python',
          text: '# SciPy COO construction from finite-element contributions\nimport numpy as np\nfrom scipy.sparse import coo_matrix\n\nrows = np.array([0, 1, 1, 1])\ncols = np.array([2, 0, 2, 2])\nvals = np.array([3, 4, 5, 7], dtype=float)\n\nA = coo_matrix((vals, (rows, cols)), shape=(3, 3))\nA_csr = A.tocsr()  # duplicates summed automatically\nprint(A_csr.toarray())\n# [[0. 0. 3.]\n#  [4. 0. 12.]\n#  [0. 0. 0.]]',
        },
        'COO is also the right teaching format. Every stored value stays attached to the coordinate that explains why it exists. Compressed formats hide this mapping behind pointer arithmetic.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'COO fails as a hot compute format. If every SpMV rebuilds row boundaries by scanning, the program pays construction costs during computation. A system that converts COO to CSR once and runs 1000 SpMVs amortizes the conversion. A system that keeps data in COO and runs 1000 SpMVs pays the scattered-write penalty every time.',
        {
          type: 'table',
          headers: ['Failure mode', 'Symptom', 'Fix'],
          rows: [
            ['COO SpMV in a loop', '5-20x slower than CSR SpMV', 'Convert to CSR before the loop'],
            ['Uncoalesced duplicates', 'Wrong values after format conversion', 'Call coalesce explicitly or verify library contract'],
            ['Explicit stored zeros', 'Inflated nnz, wrong density metrics', 'Filter zeros before lowering or use eliminate_zeros()'],
            ['Vague duplicate semantics', 'Different results across libraries', 'Document and test the combine rule (sum, max, replace, error)'],
            ['Unsorted COO passed to sorted-COO consumer', 'Silent corruption or assertion failure', 'Check is_coalesced / has_canonical_ordering flags'],
          ],
        },
        'Explicit zeros are a subtle trap. A stored zero at (2, 3) still occupies index space, participates in duplicate handling, and inflates the nonzero count. If the zero is not semantically meaningful (e.g., a cancellation result), it should be removed. Sparse does not mean "nonzero by magic"; it means "only explicitly stored entries are represented."',
        {
          type: 'bullets',
          items: [
            'COO column slicing requires a full scan -- O(nnz) per column. CSC gives O(nnz_col) per column.',
            'COO row slicing also requires a full scan unless pre-sorted. CSR gives O(nnz_row) per row.',
            'Memory overhead: COO stores one row index per entry. CSR replaces all row indices with (m+1) pointers. For wide, sparse matrices, this saves substantial memory.',
            'GPU kernels rarely accept COO directly. cuSPARSE deprecated COO SpMV in favor of CSR and BSR kernels optimized for coalesced memory access.',
          ],
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'What it covers'],
          rows: [
            ['Timothy A. Davis, "Direct Methods for Sparse Linear Systems" (SIAM, 2006)', 'Canonical reference for COO, CSC, and assembly semantics in scientific computing'],
            ['SciPy sparse reference: scipy.sparse.coo_matrix', 'Python API for COO construction, duplicate summing, and format conversion'],
            ['PyTorch sparse tensor docs: torch.sparse_coo_tensor', 'N-dimensional COO with coordinate matrix layout and coalesce() semantics'],
            ['MLIR SparseTensor dialect', 'Compiler-level sparse format selection and lowering from COO to compressed forms'],
            ['NVIDIA cuSPARSE documentation', 'GPU sparse format support, COO deprecation rationale, CSR/BSR kernel design'],
            ['Matrix Market format specification (NIST)', 'The COO-based interchange format used by the SuiteSparse Matrix Collection'],
          ],
        },
        {
          type: 'diagram',
          text: '  Prerequisite          This topic              Extensions\n  +-----------+     +--------------------+     +---------------------------+\n  | Arrays &  | --> | COO Sparse Tensor  | --> | Compressed Sparse Row     |\n  | Sorting   |     | Assembly Primer    |     | (CSR) Graph               |\n  +-----------+     +--------------------+     +---------------------------+\n                            |                  | CSC Column Sparse Matrix  |\n                            |                  +---------------------------+\n                            |                  | Block Sparse Row (BSR)    |\n                            |                  | Kernel Layout             |\n                            |                  +---------------------------+\n                            +----------------> | Sparse Format Selection   |\n                                               | Compiler Lowering         |\n                                               +---------------------------+',
          label: 'Study path: prerequisites, this topic, and four natural next steps',
        },
        'Study Compressed Sparse Row Graph next if your workload is row-wise SpMV or graph traversal. Study CSC Column Sparse Matrix Primer if you need column slicing or direct solvers. Study Block Sparse Row Kernel Layout Case Study if your nonzeros cluster in dense blocks. Study Sparse Format Selection Compiler Lowering Case Study if you want the compiler to choose the format automatically.',
      ],
    },
  ],
};
