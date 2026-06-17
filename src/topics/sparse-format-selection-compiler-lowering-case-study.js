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
      heading: 'Why this exists',
      paragraphs: [
        'Sparse format selection exists because "sparse" is not one layout. COO, CSR, CSC, BSR, ELL, structured sparsity, and compiler-specific tensor encodings all represent the same broad idea: store only useful entries and enough metadata to find them. They do not support the same operations equally well.',
        'The obvious approach is to choose one familiar sparse format and use it everywhere. That works for small examples. It breaks in real systems because construction, row-wise compute, column-wise compute, block kernels, GPU kernels, and compiler loop generation all want different physical shapes.',
        'Compiler lowering is the next step. Once a layout is chosen, the compiler has to turn a mathematical sparse operation into buffers, loops, merges, bounds checks, and kernel calls. The layout is part of the program, not just a container around the program.',
      ],
    },
    {
      heading: 'What the diagram emphasizes',
      paragraphs: [
        'In the format-decision view, read the graph from workload to layout. The operation, sparsity pattern, access direction, and hardware constraints feed the format choice. The format then determines buffers, loops, and dispatchable kernels.',
        'In the lowering-pipeline view, watch the abstraction get dismantled. A high-level sparse tensor becomes storage levels, position buffers, coordinate buffers, value buffers, merge loops, and finally generated code. The important question is always the same: which information must be stored so the loop can skip absent values without losing correctness?',
      ],
    },
    {
      heading: 'The core decision',
      paragraphs: [
        'A sparse compiler starts with three facts: what operation is being computed, what the sparsity pattern looks like, and what the target machine can run well. SpMV, SpMM, sampled dense-dense multiplication, element-wise add, and sparse convolution have different needs.',
        'COO is good for assembly because it appends coordinate tuples. CSR is good for row scans. CSC is good for column scans and transpose-style access. BSR is good when nonzeros come in dense blocks that can feed vector or matrix kernels. Dense can be better when the matrix is not sparse enough to justify metadata and irregular memory access.',
        `The compiler's job is not to worship a format. It is to preserve the mathematical operation while choosing a layout whose physical access pattern fits the workload.`,
      ],
    },
    {
      heading: 'How lowering works',
      paragraphs: [
        'Lowering turns tensor dimensions into storage levels. A dense level stores every coordinate in that dimension. A compressed level stores positions and coordinates for only present entries. A singleton level stores one coordinate per parent. More specialized encodings can model blocks, slices, or structured sparsity.',
        `The lowered program walks position buffers to find ranges, coordinate buffers to know which logical indices are present, and value buffers to read payloads. Operations that combine sparse tensors become merge problems over coordinate streams. When coordinates match, the loop combines values. When a coordinate is absent on one side, the loop either skips it or applies the operation's identity rule.`,
        'This is where correctness details become concrete. Sorted coordinates make merge loops simple. Duplicate coordinates need a defined combine rule. Explicit zeros may or may not behave like absent entries. Index bit width affects memory traffic and overflow. Shape metadata guards bounds.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is a representation argument. The sparse encoding must contain exactly the information needed to reconstruct the logical tensor entries that matter to the operation. If the encoding maps each stored value to the correct logical coordinate and the generated loops visit the required coordinate combinations once, the lowered code computes the same result as the high-level operation.',
        'The performance argument is different. Sparse lowering wins when skipping absent entries saves more work than the metadata and irregular access cost. That depends on density, distribution, hardware, vectorization, cache behavior, and whether conversion happens on the hot path.',
        'This split matters. A sparse kernel can be correct and slow. A fast kernel can be wrong if it assumes sorted unique coordinates and receives uncoalesced COO. Production systems need both semantic validation and performance audits.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The cost ledger has more than Big-O. Track `nnz`, density, duplicate rate, explicit zero count, index width, conversion time, format, kernel, memory traffic, branch behavior, and output validation. Sparse bugs often hide because the shape looks small while metadata traffic dominates.',
        'Conversion cost is a first-class cost. If every request builds COO, sorts it, coalesces it, converts to CSR, and then runs one small kernel, the conversion may dominate latency. If the converted format is reused for thousands of operations, the conversion may be cheap.',
        'Hardware fit matters too. A CPU may tolerate irregular branches better than a GPU warp. A BSR layout may unlock dense tile kernels if the sparsity pattern has blocks. If the pattern is ragged, BSR may waste memory by storing mostly empty blocks.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Sparse lowering wins in graph analytics, recommender systems, scientific simulation, retrieval indexes, sparse ML features, pruned neural networks, and compilers that need to generate kernels for many sparse layouts. These systems cannot afford to treat layout as an afterthought.',
        'It is also valuable as documentation. A compiler IR that names sparse levels, coordinates, positions, and value buffers makes format assumptions explicit. That is easier to audit than handwritten kernels with implicit rules scattered across loops.',
        'The best case is a stable pattern with repeated compute. Analyze once, choose or compile the right layout, and reuse the result. The worst case is one-off sparse work where conversion and metadata erase the win.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Sparse lowering fails when density is high, when the access pattern is unpredictable, when conversion happens too often, or when the chosen layout does not match the kernel. Dense kernels often win because they use simple loops, contiguous memory, and vector units without metadata overhead.',
        'It also fails when semantic contracts are missing. A format name does not guarantee sorted coordinates, unique coordinates, no explicit zeros, a particular duplicate rule, or safe index width. The generated code must either require those properties or repair them before execution.',
        'Do not benchmark only the kernel. Include layout conversion, sorting, coalescing, memory allocation, host-device transfer, and validation. Otherwise the dashboard will praise the fast part and hide the slow part.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Start with a format contract before generating loops. Record rank, shape, level type, coordinate ordering, duplicate policy, explicit-zero policy, index bit width, and ownership of buffers. A compiler pass that assumes sorted unique coordinates should reject or canonicalize inputs that do not provide them.',
        'Keep conversion outside the hottest path when possible. If a workload repeatedly multiplies by the same sparse tensor, pay the conversion cost once and cache the chosen layout. If the tensor is one-shot, prefer a format that is cheap to assemble even if the steady-state kernel is not the fastest. Sparse performance is usually a lifecycle question, not a single kernel question.',
        'Build small golden tests from dense reference results. Include empty rows, empty columns, duplicate coordinates, explicit zeros, unsorted COO, narrow index overflow cases, and shapes whose block tails do not fit evenly. These cases catch the bugs that dense happy-path tests miss.',
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
