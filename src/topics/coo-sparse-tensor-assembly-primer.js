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
  yield {
    state: cooGraph('COO is the assembly format for sparse updates'),
    highlight: { active: ['events', 'rows', 'cols', 'vals', 'triples', 'e-events-rows', 'e-events-cols', 'e-rows-vals', 'e-cols-vals', 'e-vals-triples'], found: ['canon'] },
    explanation: 'Coordinate format stores one tuple per nonzero contribution: row index, column index, and value. It is easy to append because no row pointer needs to be known in advance.',
    invariant: 'COO is simple to build; compressed formats are better to compute with.',
  };
  yield {
    state: labelMatrix(
      'Triples',
      [
        { id: 't0', label: 't0' },
        { id: 't1', label: 't1' },
        { id: 't2', label: 't2' },
        { id: 't3', label: 't3' },
      ],
      [
        { id: 'row', label: 'row' },
        { id: 'col', label: 'col' },
        { id: 'val', label: 'val' },
      ],
      [
        ['0', '2', '3'],
        ['1', '0', '4'],
        ['1', '2', '5'],
        ['1', '2', '7'],
      ],
    ),
    highlight: { active: ['t2:row', 't2:col', 't3:row', 't3:col'], compare: ['t2:val', 't3:val'] },
    explanation: 'Duplicate coordinates are normal during assembly. Finite element assembly, graph aggregation, and sparse feature construction often emit multiple contributions to the same coordinate.',
  };
  yield {
    state: labelMatrix(
      'N-D COO',
      [
        { id: 'm2', label: 'matrix' },
        { id: 'm3', label: 'tensor' },
        { id: 'batch', label: 'batch' },
        { id: 'coords', label: 'coords' },
      ],
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
    explanation: 'COO generalizes naturally to tensors: each nonzero stores a coordinate tuple and a value. PyTorch represents sparse COO indices as a coordinate matrix plus a values tensor.',
  };
  yield {
    state: cooGraph('Canonical COO sorts and coalesces duplicates'),
    highlight: { active: ['triples', 'sort', 'sum', 'canon', 'e-triples-sort', 'e-sort-sum', 'e-sum-canon'], compare: ['lower'] },
    explanation: 'Canonical COO is sorted by coordinates and has no duplicate entries. Coalescing turns repeated coordinates into a single value, usually by summing duplicate contributions.',
  };
}

function* coalesceLower() {
  yield {
    state: lowerGraph('COO lowers into the format the kernel wants'),
    highlight: { active: ['coo', 'csr', 'csc', 'bsr', 'e-coo-csr', 'e-coo-csc', 'e-coo-bsr'], found: ['gpu'] },
    explanation: 'COO is a staging layout. Libraries often convert it to CSR for row-wise arithmetic, CSC for column-wise operations and solvers, or BSR when nonzeros occur in dense blocks.',
  };
  yield {
    state: labelMatrix(
      'Format choice',
      [
        { id: 'coo', label: 'COO' },
        { id: 'csr', label: 'CSR' },
        { id: 'csc', label: 'CSC' },
        { id: 'bsr', label: 'BSR' },
      ],
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
    explanation: 'The common mistake is asking one sparse format to do everything. COO is for construction; CSR, CSC, and BSR are for different compute paths.',
  };
  yield {
    state: lowerGraph('The lowering path should be visible in performance traces'),
    highlight: { active: ['csr', 'spmv', 'gpu', 'audit', 'e-csr-spmv', 'e-spmv-audit', 'e-gpu-audit'], compare: ['coo'] },
    explanation: 'If every request builds COO and converts to CSR on the hot path, the conversion is part of latency. Production systems should record nnz, duplicates, format conversion, and kernel choice.',
  };
  yield {
    state: labelMatrix(
      'Audit row',
      [
        { id: 'nnz', label: 'nnz' },
        { id: 'dups', label: 'dups' },
        { id: 'zeros', label: 'zeros' },
        { id: 'fmt', label: 'fmt' },
        { id: 'time', label: 'time' },
      ],
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
    explanation: 'Sparse workloads need their own observability. Density, duplicate rate, explicit zeros, conversion time, and kernel format often explain more than matrix dimensions do.',
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
      heading: 'Why this exists',
      paragraphs: [
        'COO, or coordinate format, exists because many sparse objects are built as a stream of contributions. A graph pipeline emits edges. A finite-element solver emits element-local matrix entries. A feature pipeline emits hashed feature coordinates. At construction time, the system often does not know row counts, column counts, block structure, or final ordering.',
        'The obvious dense representation is wasteful because almost every coordinate is zero. The obvious compressed representation, such as CSR or CSC, is awkward because it needs offsets that are only easy to compute after the nonzeros are grouped.',
        'COO solves the assembly problem by storing each contribution directly: coordinate tuple plus value. It is not the best format for every computation. It is the format that lets the system collect sparse updates without pretending the final layout is already known.',
        'That distinction matters in real pipelines. Assembly is often parallel, unordered, and duplicate-heavy; compute is usually ordered, compressed, and kernel-specific. COO is the bridge between those phases.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the assembly view, read each row as an event, not as a final matrix entry. Duplicate coordinates are allowed because two upstream contributions may legitimately target the same cell. The important transition is from append-friendly triples to canonical sparse data.',
        'In the lowering view, watch COO move into the format the next kernel actually wants. CSR is natural for row operations. CSC is natural for column operations. BSR is useful when nonzeros appear in dense blocks. The animation is about phase separation: build in one layout, compute in another.',
      ],
    },
    {
      heading: 'The core model',
      paragraphs: [
        'For a matrix, COO stores three parallel arrays: rows, columns, and values. Entry k represents `A[rows[k], columns[k]] += values[k]` during assembly, or `A[rows[k], columns[k]] = values[k]` after canonicalization depending on the library contract.',
        'For an N-dimensional tensor, the idea is the same. Each nonzero stores an index tuple such as `(batch, row, col)` plus a value. Some libraries store coordinates as a rank-by-nnz index matrix; others store one array per dimension. The invariant is that each physical value has enough coordinate information to say where it belongs in the logical tensor.',
        'Canonical COO usually means sorted coordinates with duplicates coalesced. Coalescing combines repeated coordinates, often by summing values. Sorting and coalescing turn an event log into a stable sparse object.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'COO works because it separates two concerns that compressed formats mix together. During assembly, correctness means recording every contribution with its coordinate. During computation, performance means arranging entries so the next kernel can walk them efficiently. COO optimizes the first job and then lowers to a format for the second.',
        'Duplicate handling is part of the semantics. If two finite elements contribute to the same global matrix cell, both contributions are real. Dropping one is wrong. Coalescing by addition is correct for additive assembly because the mathematical operation is accumulation.',
        'The format also makes sparse bugs visible. You can inspect repeated coordinates, explicit zeros, out-of-bounds indices, and unsorted entries before they disappear into compressed offsets.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Appending a contribution is O(1) amortized if the coordinate and value arrays have capacity. Sorting is O(nnz log nnz) unless the data is already grouped or can be bucketed. Coalescing is usually a linear pass after sorting because equal coordinates become adjacent.',
        'Raw COO storage is O(rank * nnz + nnz), because each nonzero carries all of its coordinates plus its value. For matrices, that means row index, column index, and value. CSR and CSC can be more compact because one dimension is compressed into offsets.',
        'COO arithmetic is often poor because row or column access requires scanning or pre-sorted traversal. That is why many libraries describe COO as a construction format and recommend converting to CSR or CSC for repeated arithmetic.',
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        'Validate coordinates before sorting. Check rank, shape bounds, integer type, duplicate policy, explicit-zero policy, and whether negative indexes are allowed. Sparse bugs are much cheaper to catch while the data is still a visible coordinate list.',
        'Choose a canonical order and keep it consistent. Row-major sorting is common for CSR lowering; column-major sorting is natural for CSC. If different pipeline stages expect different orderings, record the order in the object metadata or convert explicitly.',
        'Separate assembly counters from compute counters. Log raw triples, unique coordinates after coalescing, duplicate rate, explicit-zero count, conversion time, and final format. Those numbers explain sparse performance better than shape alone.',
      ],
    },
    {
      heading: 'Testing it',
      paragraphs: [
        'Compare against a dense reference on small shapes. Generate random triples with duplicates and explicit zeros, assemble COO, coalesce, lower to CSR or CSC, and compare matrix-vector products or indexed values with the dense result.',
        'Include edge cases: empty tensors, one nonzero, all duplicates at one coordinate, unsorted input, out-of-bounds coordinates, negative values, cancellation to zero, and very high duplicate rates. Each case tests a different assumption about assembly semantics.',
        'Round-trip tests should also verify that lowering and decoding preserve coordinate order where the API promises it.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'COO wins when data arrives as events. Finite element assembly emits local stiffness contributions. Graph ingestion emits source, destination, weight triples. Sparse feature pipelines emit example id, feature id, value triples. Recommendation systems assemble user-item interactions before building a training matrix.',
        'It also wins as an interchange and debugging format. A list of coordinates is easier to print, inspect, sort, validate, and diff than compressed pointer arrays. When a sparse kernel returns the wrong answer, converting a small case to COO often makes the mistake obvious.',
        'COO is especially useful before the final sparsity pattern is known. Once the pattern is stable and the workload is clear, the system can lower to CSR, CSC, BSR, or a domain-specific sparse layout.',
        'It is also the right teaching format because every stored value remains attached to the coordinate that explains why it exists.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'COO fails when used as the hot compute layout for repeated row or column operations. If each matrix-vector multiply has to rediscover row boundaries, the program is paying construction costs during computation.',
        'It also fails when duplicate semantics are vague. Some libraries sum duplicates during conversion. Some require an explicit coalesce call. Some operations behave differently on uncoalesced tensors. A production pipeline should state the duplicate rule and test it.',
        'Explicit zeros are another trap. A stored zero still consumes index space and may participate in duplicate handling. If the zero is not meaningful, remove it before lowering. Sparse does not mean "nonzero by magic"; it means "only stored entries are represented."',
      ],
    },
    {
      heading: 'A worked case',
      paragraphs: [
        'Imagine building a 3 by 3 matrix from edge events: `(0, 2, 3)`, `(1, 0, 4)`, `(1, 2, 5)`, and `(1, 2, 7)`. COO can append all four. The duplicate at `(1, 2)` is not a bug yet; it means two contributions landed on the same coordinate.',
        'Canonicalization sorts by coordinate and combines the duplicate: `(1, 2)` becomes value 12 if the combine rule is addition. From there, a CSR conversion can build row pointers for row-wise kernels, or a CSC conversion can build column pointers for column-wise kernels. The same logical sparse object moves through three different physical phases: event log, canonical coordinates, compressed compute layout.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: SciPy COO at https://docs.scipy.org/doc/scipy/reference/generated/scipy.sparse.coo_matrix.html, SciPy sparse arrays at https://docs.scipy.org/doc/scipy/reference/sparse.html, PyTorch sparse tensors at https://docs.pytorch.org/docs/stable/sparse.html, MLIR SparseTensor dialect at https://mlir.llvm.org/docs/Dialects/SparseTensorOps/, and NVIDIA cuSPARSE at https://docs.nvidia.com/cuda/cusparse/. Study Compressed Sparse Row Graph, CSC Column Sparse Matrix Primer, Block Sparse Row Kernel Layout Case Study, and Sparse Format Selection Compiler Lowering Case Study next.',
      ],
    },
  ],
};
