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
        'Read the format-decision view as a compiler choosing physical storage for a mathematical sparse tensor. The operation, sparsity pattern, and access direction feed the format choice; the format then fixes buffers, loops, and kernel dispatch. Active nodes are current decisions, found nodes are consequences, and compare nodes are constraints already considered.',
        'Read the lowering view as the compiler turning format names into code. Position buffers store segment boundaries, coordinate buffers store indexes, and value buffers store nonzero payloads. The safe inference is that the format is part of the program contract, not a label attached after the fact.',
        {type:'callout', text:'A sparse format is a compilation contract because it fixes the metadata, loop nest, and kernel family that make an operation correct and fast.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/8/8a/Finite_element_sparse_matrix.png', alt:'Black nonzero entries forming a sparse matrix pattern from a finite element problem.', caption:'Finite element sparse matrix with nonzero entries in black. Oleg Alexandrov; later version by Vojtak, Wikimedia Commons, public domain.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A sparse matrix stores mostly zeros. If a 10,000 by 10,000 matrix has 100,000 nonzeros, dense storage holds 100 million values while sparse storage holds the 100,000 useful values plus metadata. The saving is large only if the metadata and access pattern fit the operation.',
        'Sparse format selection exists because sparse is not one layout. COO, CSR, CSC, BSR, and compiler level encodings all describe different ways to store coordinates. The right choice depends on building, row scans, column scans, block kernels, mutation, and hardware.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to use CSR for everything. CSR, or compressed sparse row, stores row offsets, column indexes, and values. It is familiar and fast for row-oriented sparse matrix-vector multiply.',
        'That choice breaks when the access pattern changes. Column extraction from CSR scans many unrelated rows. Incremental insertion shifts arrays. Block kernels cannot use scattered scalar nonzeros efficiently. Familiarity is not a proof of fit.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that layout and loop structure are coupled. A loop for CSR assumes row segments and sorted column coordinates. A loop for CSC assumes column segments and row coordinates. Reusing the wrong loop can change both complexity and correctness.',
        'The invariant is that generated code must visit exactly the coordinate tuples required by the algebra, in an order the output format can accept. If coordinates are unsorted or duplicated and the compiler assumes sorted unique streams, a merge loop can silently skip or double-count values.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate what to compute from how tensors are stored. The algebra says y = A * x. The format description says how A coordinates are encoded. The compiler combines both to generate a loop nest that is correct for that layout.',
        'Level encodings make this general. A dense level enumerates every coordinate. A compressed level stores only present coordinates with position boundaries. A singleton level stores one coordinate per parent position. These small contracts can describe many sparse formats.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A compiler first records tensor dimensions, level types, and dimension-to-level maps. For CSR, rows are dense and columns are compressed within each row. For CSC, columns are dense and rows are compressed within each column.',
        'The lowering pass materializes buffers and emits loops. Dense levels become simple for loops. Compressed levels use position arrays to find a segment and coordinate arrays to walk stored indexes. When two sparse operands share an index, generated code performs intersection for multiplication or union for addition.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness follows from enumeration contracts. If each level enumerates exactly the coordinates it promises, and the merge logic combines streams according to the algebra, the sparse loop computes the same result as dense evaluation while skipping zeros.',
        'Sortedness is load-bearing. Two-pointer intersection works because both streams advance in order. If one stream is unsorted, seeing coordinate 9 before coordinate 3 can make the loop decide incorrectly that coordinate 3 is absent.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Sparse cost is not just nonzero count. CSR SpMV reads values, column indexes, row offsets, and x[j] entries. Dense matrix-vector multiply reads more values but streams predictably. Sparse wins when skipped zeros save more bandwidth than indexes and irregular access cost.',
        'At 1 percent density, a 10,000 by 10,000 matrix has 1 million nonzeros instead of 100 million dense values. If values and indexes are 8 and 4 bytes, CSR reads about 12 MB of payload plus offsets, while dense reads about 800 MB of values. At 20 percent density, the index overhead and irregular x access can erase the advantage.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Sparse format selection appears in MLIR sparse tensors, SciPy, PyTorch sparse tensors, cuSPARSE, GraphBLAS, finite element simulation, graph analytics, and structured pruning. The shared problem is matching a sparse layout to an operation and hardware path.',
        'Compilers need this because handwritten kernels do not scale to every format combination. A level-based lowering system can generate correct loops for many layouts, then dispatch specialized kernels where the measured benefit justifies it.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Sparse formats fail when density is too high, sparsity changes too often, coordinates are not canonicalized, or conversion cost is hidden. Building CSR for one multiply may cost more than the multiply saves. Using COO for repeated row access may turn every row operation into a scan.',
        'They also fail when benchmarks isolate the kernel and ignore lifecycle cost. Build, sort, dedupe, convert, transfer to GPU, run, and validate all count. A format that wins the inner loop can lose the full workload.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take a 4 by 5 matrix with nonzeros A[0,1]=1, A[0,4]=2, A[1,0]=3, A[2,2]=4, A[2,3]=5, and A[3,4]=6. For y = A * x and x = [10,20,30,40,50], CSR stores pos = [0,2,3,5,6], crd = [1,4,0,2,3,4], and vals = [1,2,3,4,5,6].',
        'Row 0 uses positions 0 through 1 and computes 1*20 + 2*50 = 120. Row 1 computes 3*10 = 30. Row 2 computes 4*30 + 5*40 = 320. Row 3 computes 6*50 = 300. The result is [120,30,320,300], and the loop touched six nonzeros instead of twenty dense entries.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with The Tensor Algebra Compiler, Format Abstraction for Sparse Tensor Algebra Compilers, MLIR SparseTensor dialect docs, cuSPARSE docs, and classic sparse linear systems references. Read them for level contracts and generated merge loops.',
        'Study COO assembly, CSR, CSC, BSR, GraphBLAS, sparse matrix-vector multiply, GPU memory coalescing, and compiler IR lowering next. The central question is which layout minimizes total lifecycle cost for the operation mix.',
      ],
    },
  ],
};

