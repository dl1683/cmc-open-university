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
      heading: 'How to read the animation',
      paragraphs: [
        'The "format decision" view traces the compiler decision from workload to kernel. Active nodes are the current stage of format selection. Found nodes are outcomes determined by the choice. Compare nodes are upstream constraints that shaped the decision but are no longer being evaluated.',
        'The "lowering pipeline" view traces a sparse tensor through compiler lowering: from high-level tensor description through level encodings, dimension-to-level maps, IR generation, buffer materialization, loop synthesis, and final code emission. Active nodes are the stage being lowered. Found nodes are buffers already materialized. Compare nodes are upstream abstractions that the lowering has consumed.',
        {type:'callout', text:'A sparse format is a compilation contract because it fixes the metadata, loop nest, and kernel family that make an operation correct and fast.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/8/8a/Finite_element_sparse_matrix.png', alt:'Black nonzero entries forming a sparse matrix pattern from a finite element problem.', caption:'Finite element sparse matrix with nonzero entries in black. Oleg Alexandrov; later version by Vojtak, Wikimedia Commons, public domain.'},
        {
          type: 'note',
          text: 'The safe inference at each frame: if a node is active and its incoming edge is highlighted, that stage has received input and is producing output. If a downstream node is not yet active, no code or buffer has been generated for it. The format decision is not advisory -- it determines the physical buffers, loop structure, and kernel family for the rest of compilation.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          attribution: 'Kjolstad et al., "The Tensor Algebra Compiler" (2017)',
          text: 'The key idea is to decouple tensor storage formats from the code that operates on them, enabling a compiler to generate efficient code for any combination of formats.',
        },
        'A 10,000 x 10,000 matrix with 100,000 nonzeros is 99% empty. Storing all 100 million entries wastes memory and forces the CPU to touch values that contribute nothing. Sparse formats store only the nonzeros plus enough metadata to reconstruct their positions. The savings are enormous -- but the metadata shape determines which operations are fast and which are crippled.',
        'The problem is that "sparse" is not one format. COO, CSR, CSC, BSR, ELL, DIA, SELL-C-sigma, and MLIR-style level encodings all store the same mathematical object with different physical layouts. Each layout makes some access patterns fast and others slow. A CSR matrix gives O(1) access to any row but requires a full column scan to extract a single column. A CSC matrix has the opposite trade. COO is cheap to build but expensive to query by row or column without sorting first.',
        'When the format is chosen by hand and baked into library calls, every new operation or hardware target requires new handwritten kernels. A sparse compiler automates that choice: given the operation, the tensor properties, and the target hardware, it selects a format and generates the buffers, loops, and merge logic to execute the operation correctly.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is to pick CSR for everything. CSR is the default in SciPy, MATLAB, and most numerical libraries. It supports efficient row slicing, matrix-vector multiplication, and row-wise iteration. Teams reach for it because it is familiar, well-documented, and every sparse library has it.',
        {
          type: 'code',
          language: 'python',
          body: '# The "just use CSR" approach\nimport scipy.sparse as sp\nA = sp.random(10000, 10000, density=0.01, format="csr")\n# Row-wise SpMV: fast. CSR walks row pointers, scans column indices.\ny = A @ x\n# Column extraction: slow. CSR must scan every row to find column j.\ncol_j = A.getcol(j)  # builds a new sparse matrix by full scan\n# Incremental assembly: painful. Inserting into CSR shifts arrays.\nA[i, j] = 7.0  # triggers internal format conversion or copy',
        },
        'This works while the workload is row-oriented SpMV on a CPU. It breaks the moment the workload changes: column-oriented access needs CSC, incremental construction needs COO or LIL, blocked GPU kernels need BSR, and diagonal solvers need DIA. A single format cannot serve all access patterns without degradation.',
        'The second common attempt is to provide a format zoo and let the user choose. SciPy offers seven sparse formats. The user is expected to know which format fits which operation, convert between formats at the right time, and avoid paying conversion cost on the hot path. This works for experts. It does not scale to compiler-generated code, autotuning systems, or users who do not know the difference between CSR and CSC.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that format choice and loop structure are coupled, but the coupling is invisible until the wrong combination produces either incorrect results or catastrophic performance.',
        {
          type: 'table',
          headers: ['Operation', 'Format', 'What goes wrong'],
          rows: [
            ['Column slice A[:, j]', 'CSR', 'Must scan all nnz to find entries in column j -- O(nnz) instead of O(nnz_col)'],
            ['SpMV y = A @ x', 'COO (unsorted)', 'Random writes to y[row] cause race conditions on GPU; serial accumulation on CPU wastes locality'],
            ['Sparse + Sparse (C = A + B)', 'CSR + CSC', 'Column indices of A are sorted per row; row indices of B are sorted per column -- merge logic differs'],
            ['Block kernel (tensor core)', 'CSR', 'Nonzeros are scattered across rows; cannot feed a 16x16 dense tile without gather and padding'],
            ['Incremental build', 'CSR', 'Inserting one element shifts the column-index and value arrays; O(nnz) per insertion'],
          ],
        },
        'The invariant that must hold: the generated loop must visit exactly the coordinate combinations required by the operation, in an order that the output format can accept, using only the metadata that the input format provides. If the format does not provide efficient access to the coordinates the loop needs, the compiler either generates slow code (scanning metadata that should be O(1)) or incorrect code (assuming sorted coordinates that are not sorted).',
        {
          type: 'note',
          text: 'The wall is not "CSR is bad." The wall is that no single format is universally good, and the penalty for a mismatch is not a small constant -- it can change the complexity class of the operation. Column extraction from CSR is O(nnz), not O(nnz_col). That is not a performance tuning issue. That is the wrong algorithm.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Decouple the tensor algebra from the storage format, and let the compiler derive the loop nest from the combination of operation and format.',
        {
          type: 'diagram',
          alt: 'Sparse compiler separation of concerns',
          label: 'The compiler separates what to compute from how to store',
          body: 'Tensor algebra expression     Storage format description\n        (what to compute)            (how to store)\n              |                            |\n              v                            v\n        +------------------------------------------+\n        |     Compiler merge-lattice builder        |\n        |  (derives iteration order from formats)   |\n        +------------------------------------------+\n                          |\n                          v\n                  Generated loop nest\n           (correct for this format combination)',
          text: 'Tensor algebra expression     Storage format description\n        (what to compute)            (how to store)\n              |                            |\n              v                            v\n        +------------------------------------------+\n        |     Compiler merge-lattice builder        |\n        |  (derives iteration order from formats)   |\n        +------------------------------------------+\n                          |\n                          v\n                  Generated loop nest\n           (correct for this format combination)',
        },
        'The TACO (Tensor Algebra Compiler) insight, formalized by Kjolstad, Kamil, Chou, Lugato, and Amarasinghe at MIT, is that every sparse format can be described as a sequence of level types (dense, compressed, singleton), each level specifying how coordinates at that dimension are stored. The compiler reads the level descriptions, builds a merge lattice that determines which coordinate streams must be intersected or unioned, and emits loops that walk the physical buffers in the correct order.',
        'The same algebra expression compiled against different format descriptions produces different loop nests -- all correct, but with different performance characteristics. The format is an input to compilation, not a hardcoded assumption inside the kernel.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Sparse compilation proceeds in five stages: format description, dimension-to-level mapping, buffer materialization, iteration graph construction, and loop emission.',
        {
          type: 'bullets',
          items: [
            'Format description: each tensor dimension is assigned a level type. A CSR matrix has level 0 = dense (rows are indexed by position 0..m-1) and level 1 = compressed (each row stores a sorted list of column indices and corresponding values). A COO matrix has level 0 = compressed (row coordinates) and level 1 = singleton (one column coordinate per row entry).',
            'Dimension-to-level mapping: logical tensor dimensions (row, column) map to physical storage levels. For CSR, dimension 0 maps to level 0, dimension 1 maps to level 1. For CSC, the mapping is transposed: dimension 1 (columns) maps to level 0 (dense), dimension 0 (rows) maps to level 1 (compressed). The mapping can also express blocking: BSR maps dimensions through a division and modulo to separate block coordinates from intra-block offsets.',
            'Buffer materialization: the compiler allocates arrays based on the level types. A dense level needs no position or coordinate buffer -- the coordinate is the loop index itself. A compressed level needs a position array (pos) that stores segment boundaries and a coordinate array (crd) that stores the coordinates within each segment. A values array (vals) stores the nonzero payloads.',
            'Iteration graph construction: the compiler examines the tensor algebra expression and the level types of all operands to determine which index variables iterate over which levels. When two compressed levels share an index variable, the compiler must merge their coordinate streams. Intersection (for multiplication) walks both streams and advances the one with the smaller coordinate. Union (for addition) advances either stream and emits from whichever is present.',
            'Loop emission: the compiler emits nested loops. Dense levels produce simple for-loops from 0 to the dimension size. Compressed levels produce while-loops that scan the coordinate array between position boundaries. Merge points produce two-pointer merge code for intersection or union.',
          ],
        },
        {
          type: 'code',
          language: 'c',
          body: '// Generated code for SpMV y = A*x where A is CSR.\n// Level 0: dense (rows), Level 1: compressed (columns within each row).\nfor (int i = 0; i < m; i++) {           // dense level 0: row loop\n  double sum = 0.0;\n  for (int p = pos[i]; p < pos[i+1]; p++) {  // compressed level 1\n    int j = crd[p];                     // column coordinate\n    sum += vals[p] * x[j];              // accumulate\n  }\n  y[i] = sum;\n}\n// The same algebra with A in DCSC (doubly compressed sparse column)\n// would produce a different loop nest: outer loop over stored column\n// segments, inner loop over rows within each column.',
        },
        'The critical invariant is that the generated loops visit exactly the coordinate tuples where the algebraic expression is nonzero, in an order consistent with the output format. The compiler proves this by construction: each level type defines how its coordinates are enumerated, and the merge lattice defines how coordinate streams from different operands combine.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on a representation theorem: if the level descriptions faithfully describe how coordinates and values are laid out in memory, and the generated loops enumerate exactly the coordinate tuples prescribed by the merge lattice, then the lowered code computes the same result as the original tensor algebra expression evaluated over dense operands.',
        'The proof has two parts. First, each level type defines a coordinate enumeration contract. A dense level at dimension d enumerates coordinates 0, 1, ..., size_d - 1 in order. A compressed level enumerates only stored coordinates, in sorted order, between position boundaries. The loop code generated for each level type satisfies that contract by construction.',
        'Second, the merge lattice determines which combinations of coordinates must be visited. For multiplication (A * B at index j), only coordinates present in both A and B contribute nonzeros -- the lattice prescribes intersection. For addition (A + B), coordinates present in either operand contribute -- the lattice prescribes union. The two-pointer merge code implements intersection or union correctly when both coordinate streams are sorted.',
        {
          type: 'note',
          text: 'The sortedness requirement is load-bearing. If a compressed level stores coordinates out of order, the two-pointer merge produces wrong results silently -- it skips coordinates it should match and matches coordinates it should skip. The format contract must guarantee sorted coordinates, or the compiler must insert a sort pass before the merge loop.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Cost axis', 'Dense baseline', 'Sparse (CSR SpMV)', 'When sparse wins'],
          rows: [
            ['Arithmetic ops', 'm * n multiplications', 'nnz multiplications', 'When nnz << m * n (density < ~1-5%)'],
            ['Memory reads', 'm * n values + n vector', 'nnz values + nnz indices + m+1 offsets + n vector', 'When index overhead < saved value reads'],
            ['Memory pattern', 'Sequential scan', 'Sequential values, random x[j] access', 'When x fits in cache or j-access has locality'],
            ['Conversion cost', 'None', 'O(nnz) to build CSR from COO', 'When format is reused across many operations'],
            ['Loop overhead', 'Two nested for-loops', 'Outer for + inner while with pointer chase', 'When nnz/row is large enough to amortize loop control'],
          ],
        },
        'The crossover between dense and sparse depends on density, matrix shape, and hardware. On modern CPUs with AVX-512, dense GEMV is memory-bandwidth-limited and achieves near-peak throughput. Sparse CSR SpMV achieves 10-30% of peak bandwidth because of irregular x[j] access and index-array reads. At 1% density, the sparse kernel reads ~50x fewer values but at ~3-5x lower bandwidth utilization, giving a net speedup of 10-15x. At 10% density, the index overhead erodes the savings and dense may win.',
        'Conversion cost is the hidden killer. Converting COO to CSR requires sorting by row (O(nnz log nnz) or O(nnz + m) with counting sort), allocating position and coordinate arrays, and scanning the sorted tuples. If the sparse matrix is used once, conversion can dominate the total cost. If it is reused for thousands of SpMV calls, conversion is amortized to negligibility.',
        'Index bit width affects memory traffic directly. A matrix with m, n < 65,536 can use 16-bit indices, halving index memory compared to 32-bit. MLIR and cuSPARSE support configurable index types. Choosing the narrowest safe width is a free performance win, but overflow from a wrong choice is a silent correctness bug.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a 4x5 matrix A with 6 nonzeros, used in SpMV y = A * x:',
        {
          type: 'code',
          language: 'text',
          body: 'A (dense view):        x:\n[ 0  1  0  0  2 ]     [ 10 ]\n[ 3  0  0  0  0 ]     [ 20 ]\n[ 0  0  4  5  0 ]     [ 30 ]\n[ 0  0  0  0  6 ]     [ 40 ]\n                       [ 50 ]',
        },
        'Step 1: Choose format. The operation is SpMV (row-oriented). The compiler selects CSR: level 0 = dense (4 rows), level 1 = compressed (columns within each row).',
        {
          type: 'table',
          headers: ['Step', 'Action', 'Result'],
          rows: [
            ['2. Build pos array', 'Count nnz per row: [2, 1, 2, 1], prefix sum', 'pos = [0, 2, 3, 5, 6]'],
            ['3. Build crd array', 'List column indices in row order', 'crd = [1, 4, 0, 2, 3, 4]'],
            ['4. Build vals array', 'List values in row order', 'vals = [1, 2, 3, 4, 5, 6]'],
            ['5. Row 0 loop', 'p = pos[0]..pos[1] = 0..2; j = crd[0]=1, crd[1]=4', 'sum = 1*x[1] + 2*x[4] = 20 + 100 = 120'],
            ['6. Row 1 loop', 'p = pos[1]..pos[2] = 2..3; j = crd[2]=0', 'sum = 3*x[0] = 30'],
            ['7. Row 2 loop', 'p = pos[2]..pos[3] = 3..5; j = crd[3]=2, crd[4]=3', 'sum = 4*x[2] + 5*x[3] = 120 + 200 = 320'],
            ['8. Row 3 loop', 'p = pos[3]..pos[4] = 5..6; j = crd[5]=4', 'sum = 6*x[4] = 300'],
          ],
        },
        'Result: y = [120, 30, 320, 300]. Every nonzero is visited exactly once. Zero entries are never touched. The pos array lets each row start its column scan at the right offset without searching.',
        'Now consider the same matrix needed for column extraction A[:, 3]. With CSR, the compiler must scan all 6 entries in crd to find those with value 3. With CSC, level 0 = dense (5 columns) and level 1 = compressed (rows within each column). Column 3 is accessed as pos[3]..pos[4], touching only the entries in that column. The format changed, the buffers changed, and the loop changed -- but the algebra is the same.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'MLIR SparseTensor dialect: LLVM/MLIR uses level-type annotations (#sparse_tensor.encoding) to lower sparse tensor operations to buffer manipulation and loop nests. The sparsifier pass reads these annotations and generates code for any combination of dense, compressed, and singleton levels. This is the reference implementation of compiler-driven sparse format selection.',
            'PyTorch sparse tensors: PyTorch 2.x supports COO, CSR, CSC, BSR, and BSC formats with autograd support. The sparse compiler (torch.sparse) selects format-specific kernels for SpMM, sampled-dense-dense matmul, and structured pruning masks. Pruned transformer weights at 2:4 sparsity use structured sparse formats that feed NVIDIA tensor core instructions.',
            'SciPy sparse: SciPy provides seven formats (COO, CSR, CSC, BSR, DIA, LIL, DOK) and requires the user to choose. The typical workflow is build in COO or LIL, convert to CSR or CSC for computation, and convert to COO for serialization. SciPy does not auto-select, but its format zoo is the standard vocabulary for sparse format trade-offs.',
            'cuSPARSE and cuSPARSELt: NVIDIA cuSPARSE provides hand-tuned GPU kernels for CSR, CSC, COO, and BSR SpMV/SpMM. cuSPARSELt targets 2:4 structured sparsity on Ampere and later tensor cores, where exactly 2 of every 4 weights are zero -- a format that halves memory and doubles throughput for qualifying sparsity patterns.',
            'Graph analytics: adjacency matrices are sparse. Graph frameworks (GraphBLAS, Gunrock, DGL) represent graphs as sparse matrices and select formats based on the operation: CSR for BFS (row-oriented neighbor scan), CSC for PageRank (column-oriented incoming-edge aggregation), COO for edge-parallel operations.',
            'Finite element simulation: stiffness matrices from mesh discretization are sparse with block structure. BSR formats let each block (corresponding to a mesh element) feed a dense matrix kernel, combining the sparsity benefit of skipping zero blocks with the vectorization benefit of dense intra-block computation.',
          ],
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'table',
          headers: ['Failure mode', 'Why it breaks', 'What to do instead'],
          rows: [
            ['Density above 5-10%', 'Index arrays cost more than the values they skip', 'Use dense BLAS; the overhead of metadata and irregular access exceeds the savings from skipping entries'],
            ['Dynamic sparsity pattern', 'Rebuilding CSR or CSC on every mutation is O(nnz)', 'Use COO or DOK for assembly, convert once when the pattern stabilizes'],
            ['Format-kernel mismatch', 'CSR cannot feed GPU block kernels; BSR wastes memory on ragged patterns', 'Profile before committing; consider mixed formats for different operands'],
            ['Unsorted or duplicate coordinates', 'Merge loops produce wrong results silently', 'Enforce sorted-unique as a format contract; insert canonicalization passes'],
            ['Benchmarking only the kernel', 'Hides conversion, allocation, and transfer costs', 'Measure end-to-end: build + convert + compute + validate'],
            ['Implicit zero semantics', 'Some operations treat explicit zeros differently from absent entries (e.g., sparse softmax)', 'Document whether the format contract guarantees no explicit zeros, or handle them in the kernel'],
          ],
        },
        'The most common failure in practice is not choosing the wrong format -- it is never choosing at all. A team stores everything in COO because it is simple, never converts to CSR for the row-oriented hot path, and pays O(nnz) per row access across millions of iterations. The fix is not a better format. The fix is making format selection an explicit, auditable decision in the computation pipeline.',
        {
          type: 'note',
          text: 'Sparse format selection is a lifecycle decision, not a one-time choice. The right format for building the matrix (COO), computing with it (CSR), serializing it (COO or Market Matrix), and transferring it to a GPU (CSR with 32-bit indices on the device) may all be different. The compiler or runtime must manage conversions at the right boundaries, not pretend one format serves all stages.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Kjolstad et al., "The Tensor Algebra Compiler" (OOPSLA 2017) for the format-agnostic compilation model; the MLIR SparseTensor dialect documentation at https://mlir.llvm.org/docs/Dialects/SparseTensorOps/ for the production LLVM implementation; Chou, Kjolstad, and Amarasinghe, "Format Abstraction for Sparse Tensor Algebra Compilers" (OOPSLA 2018) for the level-type formalization; the NVIDIA cuSPARSE documentation at https://docs.nvidia.com/cuda/cusparse/ for GPU-specific format kernels; Davis, "Direct Methods for Sparse Linear Systems" (SIAM 2006) for the foundational sparse matrix algorithms.',
        {
          type: 'bullets',
          items: [
            'Prerequisite: COO Sparse Tensor Assembly Primer -- coordinate-list construction and the cost of unsorted assembly.',
            'Prerequisite: CSC Column Sparse Matrix Primer -- the transpose of CSR and when column-oriented access matters.',
            'Extension: Block Sparse Row Kernel Layout Case Study -- how BSR feeds dense tile kernels and the padding/waste trade-off.',
            'Extension: GraphBLAS Sparse Matrix Graph Case Study -- semiring-based graph algorithms over user-selected sparse formats.',
            'Contrast: Accelerator Kernel Compatibility Matrix Case Study -- how hardware constraints further narrow the viable format set.',
            'Contrast: dense BLAS -- the performance baseline that sparse formats must beat to justify their metadata overhead.',
          ],
        },
        'The engineering question for sparse format selection is not "which format is best." It is whether the density, access pattern, operation mix, and hardware target justify the metadata cost and irregular access pattern of any sparse format at all -- and if so, which format minimizes total lifecycle cost including conversion.',
      ],
    },
  ],
};

