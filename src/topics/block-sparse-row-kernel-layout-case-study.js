// Block Sparse Row (BSR): compress sparse block rows where nonzeros appear as
// dense tiles, improving index overhead and kernel locality.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'block-sparse-row-kernel-layout-case-study',
  title: 'Block Sparse Row Kernel Layout Case Study',
  category: 'Systems',
  summary: 'A block-sparse layout case study: dense tiles inside sparse rows, block pointers, block column indices, values tensors, GPU kernel fit, ragged tails, and density thresholds.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['block layout', 'kernel fit'], defaultValue: 'block layout' },
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

function blockGraph(title) {
  return graphState({
    nodes: [
      { id: 'dense', label: 'dense A', x: 0.8, y: 3.5, note: 'matrix' },
      { id: 'tile', label: 'tile', x: 2.3, y: 2.0, note: 'r x c' },
      { id: 'mask', label: 'mask', x: 2.3, y: 5.0, note: 'nonzero blocks' },
      { id: 'bptr', label: 'bPtr', x: 4.0, y: 2.0, note: 'block rows' },
      { id: 'bcol', label: 'bCol', x: 4.0, y: 5.0, note: 'block cols' },
      { id: 'vals', label: 'vals', x: 5.8, y: 3.5, note: 'tiles' },
      { id: 'kernel', label: 'kernel', x: 7.5, y: 3.5, note: 'GEMM-ish' },
      { id: 'out', label: 'out', x: 9.0, y: 3.5, note: 'SpMM' },
    ],
    edges: [
      { id: 'e-dense-tile', from: 'dense', to: 'tile' },
      { id: 'e-dense-mask', from: 'dense', to: 'mask' },
      { id: 'e-tile-bptr', from: 'tile', to: 'bptr' },
      { id: 'e-mask-bcol', from: 'mask', to: 'bcol' },
      { id: 'e-bptr-vals', from: 'bptr', to: 'vals' },
      { id: 'e-bcol-vals', from: 'bcol', to: 'vals' },
      { id: 'e-vals-kernel', from: 'vals', to: 'kernel' },
      { id: 'e-kernel-out', from: 'kernel', to: 'out' },
    ],
  }, { title });
}

function fitGraph(title) {
  return graphState({
    nodes: [
      { id: 'pattern', label: 'pattern', x: 0.8, y: 3.5, note: 'blocks' },
      { id: 'density', label: 'dense%', x: 2.4, y: 2.0, note: 'tile fill' },
      { id: 'shape', label: 'shape', x: 2.4, y: 5.0, note: 'tile size' },
      { id: 'choose', label: 'choose', x: 4.2, y: 3.5, note: 'format' },
      { id: 'csr', label: 'CSR', x: 5.8, y: 1.5, note: 'ragged' },
      { id: 'bsr', label: 'BSR', x: 5.8, y: 3.5, note: 'blocks' },
      { id: 'dense', label: 'dense', x: 5.8, y: 5.5, note: 'full' },
      { id: 'bench', label: 'bench', x: 7.6, y: 3.5, note: 'time' },
      { id: 'rollout', label: 'rollout', x: 9.1, y: 3.5, note: 'gate' },
    ],
    edges: [
      { id: 'e-pattern-density', from: 'pattern', to: 'density' },
      { id: 'e-pattern-shape', from: 'pattern', to: 'shape' },
      { id: 'e-density-choose', from: 'density', to: 'choose' },
      { id: 'e-shape-choose', from: 'shape', to: 'choose' },
      { id: 'e-choose-csr', from: 'choose', to: 'csr' },
      { id: 'e-choose-bsr', from: 'choose', to: 'bsr' },
      { id: 'e-choose-dense', from: 'choose', to: 'dense' },
      { id: 'e-bsr-bench', from: 'bsr', to: 'bench' },
      { id: 'e-bench-rollout', from: 'bench', to: 'rollout' },
    ],
  }, { title });
}

function* blockLayout() {
  yield {
    state: blockGraph('BSR stores sparse rows of dense tiles'),
    highlight: { active: ['dense', 'tile', 'mask', 'bptr', 'bcol', 'e-dense-tile', 'e-dense-mask', 'e-tile-bptr', 'e-mask-bcol'], found: ['vals'] },
    explanation: 'Block Sparse Row compresses a matrix at block granularity. Each nonzero block stores a dense tile, while block pointers and block-column indices describe where those tiles live.',
    invariant: 'BSR pays one index per block, not one index per scalar nonzero.',
  };
  yield {
    state: labelMatrix(
      'BSR arrays',
      [
        { id: 'bptr', label: 'bPtr' },
        { id: 'bcol', label: 'bCol' },
        { id: 'vals', label: 'vals' },
        { id: 'shape', label: 'shape' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['block row offsets', 'scan'],
        ['block col ids', 'place'],
        ['dense tiles', 'compute'],
        ['R x C', 'interpret'],
      ],
    ),
    highlight: { active: ['bptr:stores', 'bcol:stores', 'vals:stores', 'shape:stores'], compare: ['shape:why'] },
    explanation: 'BSR has the same pointer idea as CSR, but each entry points to a dense block. The values buffer is usually three-dimensional: block id, row inside block, column inside block.',
  };
  yield {
    state: blockGraph('Dense tile kernels reuse fast inner loops'),
    highlight: { active: ['vals', 'kernel', 'out', 'e-vals-kernel', 'e-kernel-out'], compare: ['bcol'] },
    explanation: 'The sparse outer loop skips missing blocks. The dense inner loop uses regular tile math, which can be much friendlier to CPU vector units and GPU kernels than scalar irregular nonzeros.',
  };
  yield {
    state: labelMatrix(
      'Block density',
      [
        { id: 'full', label: 'full tile' },
        { id: 'half', label: 'half tile' },
        { id: 'one', label: 'one elem' },
        { id: 'ragged', label: 'tail' },
      ],
      [
        { id: 'BSR', label: 'BSR' },
        { id: 'CSR', label: 'CSR' },
      ],
      [
        ['great', 'ok'],
        ['maybe', 'ok'],
        ['waste', 'better'],
        ['pad/mask', 'natural'],
      ],
    ),
    highlight: { active: ['full:BSR', 'half:BSR'], compare: ['one:BSR', 'ragged:BSR'] },
    explanation: 'BSR wins when nonzeros cluster into dense tiles. It wastes memory and compute when the pattern is ragged or each block contains only one useful scalar.',
  };
}

function* kernelFit() {
  yield {
    state: fitGraph('Format selection starts from the sparsity pattern'),
    highlight: { active: ['pattern', 'density', 'shape', 'choose', 'e-pattern-density', 'e-pattern-shape', 'e-density-choose', 'e-shape-choose'], found: ['bsr'] },
    explanation: 'A block-sparse optimization should start with measurements: block density, tile shape, zero distribution, batch size, and hardware kernels.',
  };
  yield {
    state: labelMatrix(
      'Kernel ledger',
      [
        { id: 'tile', label: 'tile' },
        { id: 'fill', label: 'fill' },
        { id: 'nnzb', label: 'nnzb' },
        { id: 'pad', label: 'pad' },
        { id: 'time', label: 'time' },
      ],
      [
        { id: 'measure', label: 'measure' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['16x16', 'kernel'],
        ['82%', 'waste'],
        ['blocks', 'index'],
        ['tail', 'overhead'],
        ['ms', 'gate'],
      ],
    ),
    highlight: { active: ['tile:measure', 'fill:measure', 'time:measure'], compare: ['pad:reason'] },
    explanation: 'Do not promote block sparsity because a model has zeros. Promote it only when the block layout wins on the actual kernel, dtype, hardware, and batch shape.',
  };
  yield {
    state: fitGraph('CSR, BSR, and dense can all be right'),
    highlight: { active: ['choose', 'csr', 'bsr', 'dense', 'e-choose-csr', 'e-choose-bsr', 'e-choose-dense'], compare: ['pattern'] },
    explanation: 'CSR handles ragged sparsity. BSR handles dense tiles. Dense kernels can still win if sparsity is too low or the sparse kernel overhead dominates.',
  };
  yield {
    state: fitGraph('Rollout gates prevent theoretical sparsity wins from regressing users'),
    highlight: { active: ['bsr', 'bench', 'rollout', 'e-bsr-bench', 'e-bench-rollout'], compare: ['dense'] },
    explanation: 'A production rollout should compare accuracy, latency, memory, power, and fallback coverage before switching to a block-sparse path.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'block layout') yield* blockLayout();
  else if (view === 'kernel fit') yield* kernelFit();
  else throw new InputError('Pick a block-sparse layout view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. The block-layout view traces how a dense matrix becomes three BSR arrays: block row pointers, block column indices, and dense value tiles. The kernel-fit view traces the decision of whether BSR is the right format for a given sparsity pattern.',
        {
          type: 'bullets',
          items: [
            'Active (highlighted): the current stage in the BSR pipeline -- the array being populated or the format being evaluated.',
            'Found (green): a result committed to the output -- a stored block, a chosen format, a confirmed kernel path.',
            'Compare (blue): a contrast case that clarifies the active decision -- CSR versus BSR tradeoffs, full tiles versus ragged tails.',
          ],
        },
        {
          type: 'note',
          text: 'The block-layout view answers "how does BSR represent the matrix?" The kernel-fit view answers "should you use BSR at all?" Watch both before deciding BSR is the right tool for a problem.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'The key to sparse matrix performance is not the number of zeros -- it is whether the storage format matches the structure the hardware can exploit.',
          attribution: 'Observation from the NVIDIA cuSPARSE design guide',
        },
        'Many sparse matrices are not random dust. Finite-element stiffness matrices have 3x3 or 6x6 blocks corresponding to degrees of freedom per node. Block-pruned transformer weights have 32x32 or 64x64 tiles aligned to GPU warp dimensions. Graph adjacency matrices from community-structured networks cluster nonzeros into dense diagonal blocks.',
        'The standard scalar sparse format, CSR, stores one row pointer, one column index, and one value per scalar nonzero. For a matrix with 10,000 nonzeros, CSR stores 10,000 column indices. If those nonzeros happen to fall in 100 dense 10x10 blocks, BSR stores 100 block-column indices instead -- a 100x reduction in index metadata -- and each block becomes a regular dense tile that the hardware knows how to multiply fast.',
        {
          type: 'note',
          text: 'BSR is not about saving storage. A half-empty 16x16 tile wastes 128 scalar slots. BSR is about converting irregular scalar work into regular tile work the hardware can pipeline.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is CSR (Compressed Sparse Row). CSR is the general-purpose workhorse: three arrays (row pointers, column indices, values), no assumptions about where nonzeros cluster, and broad library support in SciPy, cuSPARSE, MKL, and every sparse linear algebra package.',
        {
          type: 'table',
          headers: ['Property', 'CSR', 'Dense'],
          rows: [
            ['Index overhead', '1 col index per nonzero', 'None'],
            ['Kernel regularity', 'Irregular -- each row has variable length', 'Perfectly regular'],
            ['Memory for 90% sparse 1024x1024', '~410 KB (values + indices)', '~4 MB (full matrix)'],
            ['SpMV kernel pattern', 'Gather from scattered columns', 'Contiguous GEMV'],
            ['GPU friendliness', 'Warp divergence on short rows', 'cuBLAS-optimized'],
          ],
        },
        'CSR works well for truly unstructured sparsity -- random graphs, power-law networks, general-purpose scientific codes where nonzero locations follow no geometric pattern. Teams reach for CSR because it handles any sparsity pattern without wasting storage on zeros.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'CSR hits two walls simultaneously when the sparsity pattern is block-structured.',
        'Wall 1: index explosion. A 1024x1024 matrix with 64 dense 16x16 blocks has 16,384 nonzeros. CSR stores 16,384 column indices. BSR stores 64 block-column indices. The metadata ratio is 256:1. On a GPU, those 16,384 index loads compete for memory bandwidth with the actual arithmetic.',
        'Wall 2: irregular inner loops. CSR processes each row as a variable-length scatter-gather. The GPU launches one thread per row (or per warp per row), but rows have different lengths. Short rows waste SIMD lanes. Long rows serialize memory accesses. The kernel cannot predict the access pattern at compile time.',
        {
          type: 'diagram',
          text: 'CSR inner loop (per row):          BSR inner loop (per block):\n  for each nnz in row:               for each stored block in block-row:\n    load col_idx[j]                     load bCol[b]\n    load val[j]                         load tile[b] (RxC contiguous)\n    load x[col_idx[j]]  <-- random      dense_multiply(tile, x_slice)\n    y[i] += val[j] * x[col_idx[j]]       ^^ regular, pipelineable',
          label: 'CSR does one random gather per nonzero; BSR does one regular tile multiply per block',
        },
        {
          type: 'note',
          text: 'The wall is not "CSR is slow." CSR is optimal for unstructured sparsity. The wall is: when nonzeros cluster into dense rectangles, CSR pays per-scalar overhead for structure the hardware could exploit as tiles.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'BSR lifts the unit of sparsity from one scalar to one dense block. The sparse structure selects which blocks exist. The dense structure fills each block with regular data. This separation lets the outer loop skip absent blocks (sparse benefit) while the inner loop runs a fixed-size dense kernel (hardware benefit).',
        {
          type: 'diagram',
          text: 'Logical 8x8 matrix, block size 4x4 (2x2 block grid):\n\n  [ A A A A | . . . . ]     bPtr = [0, 1, 2]    (2 block-rows + sentinel)\n  [ A A A A | . . . . ]     bCol = [0, 1]        (block 0 in block-row 0,\n  [ A A A A | . . . . ]                            block 1 in block-row 1)\n  [ A A A A | . . . . ]     vals = [ tile_0 (4x4 dense),\n  [- - - - -+- - - - -]              tile_1 (4x4 dense) ]\n  [ . . . . | B B B B ]\n  [ . . . . | B B B B ]     Total indices: 2 (not 32)\n  [ . . . . | B B B B ]     Total values:  32 (same as CSR)\n  [ . . . . | B B B B ]     Kernel:  2 calls to 4x4 dense multiply',
          label: 'BSR arrays for a matrix with two dense 4x4 blocks',
        },
        'The invariant: every stored block occupies a fixed R x C rectangle at position (bRow * R, bCol[b] * C) in the logical matrix. Missing blocks are zero. The values tensor is three-dimensional: vals[b][r][c] gives the scalar at local row r, local column c of stored block b.',
        {
          type: 'code',
          text: '// BSR SpMV: y = A * x, where A is stored in BSR format\nfunction bsr_spmv(bPtr, bCol, vals, R, C, x, y) {\n  const numBlockRows = bPtr.length - 1;\n  for (let bi = 0; bi < numBlockRows; bi++) {\n    // Sparse outer loop: skip absent block columns\n    for (let jj = bPtr[bi]; jj < bPtr[bi + 1]; jj++) {\n      const bj = bCol[jj];        // which block column\n      const tile = vals[jj];       // R x C dense tile\n      // Dense inner loop: regular, pipelineable\n      for (let r = 0; r < R; r++) {\n        for (let c = 0; c < C; c++) {\n          y[bi * R + r] += tile[r][c] * x[bj * C + c];\n        }\n      }\n    }\n  }\n}',
          language: 'javascript',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'BSR construction from a dense matrix proceeds in four steps.',
        {
          type: 'bullets',
          items: [
            'Step 1 -- Choose block shape (R x C). This is a design parameter, not discovered from data. Common choices: 2x2, 4x4, 16x16, 32x32. The block shape must divide the matrix dimensions evenly, or the matrix must be padded.',
            'Step 2 -- Scan the matrix in block-row order. For each R-row band, identify which C-column slices contain at least one nonzero. Each such slice becomes a stored block.',
            'Step 3 -- Build bPtr. Entry bPtr[i] is the index of the first stored block in block-row i. bPtr has (M/R + 1) entries, where M is the number of matrix rows. The sentinel bPtr[M/R] equals the total number of stored blocks.',
            'Step 4 -- Build bCol and vals. For each stored block, append its block-column index to bCol and its R x C dense tile (including any internal zeros) to vals.',
          ],
        },
        'After construction, SpMV iterates block-rows via bPtr, block-columns via bCol, and dispatches a dense R x C multiply for each tile. The sparse part is the block-row/block-column traversal. The dense part is the tile kernel.',
        {
          type: 'table',
          headers: ['Array', 'Length', 'Element', 'Role'],
          rows: [
            ['bPtr', 'M/R + 1', 'integer offset', 'Locates stored blocks per block-row'],
            ['bCol', 'nnzb', 'integer block-column', 'Names the column position of each stored block'],
            ['vals', 'nnzb x R x C', 'scalar value', 'Dense payload for each stored block'],
          ],
        },
        {
          type: 'note',
          text: 'nnzb is the number of stored blocks, not the number of scalar nonzeros. A matrix with 16,384 scalar nonzeros in 64 dense 16x16 blocks has nnzb = 64.',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness follows from the CSR argument lifted to blocks. Each block-row slice (bPtr[i] to bPtr[i+1]) lists every nonzero block in that block-row. Each bCol entry names the block-column. Each vals tile supplies the scalar contents. If every nonzero block appears exactly once and missing blocks contribute zero, the BSR representation computes the same result as the dense matrix.',
        'Performance is conditional on three properties holding simultaneously:',
        {
          type: 'bullets',
          items: [
            'Block density -- stored blocks must be mostly full. A 16x16 tile with 10 nonzeros out of 256 wastes 96% of the dense computation.',
            'Block count reduction -- the number of stored blocks (nnzb) must be much smaller than the number of scalar nonzeros (nnz). The ratio nnz / nnzb should approach R * C.',
            'Kernel availability -- the hardware must have a fast dense kernel for the chosen tile shape and dtype. A 7x7 tile has no cuBLAS GEMM; a 16x16 tile maps directly to a tensor core.',
          ],
        },
        {
          type: 'quote',
          text: 'Sparse formats do not make computation cheaper. They make the right computation possible by skipping the empty parts. BSR makes the right computation regular by grouping the non-empty parts into tiles.',
          attribution: 'Design principle from SciPy sparse documentation',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Measure', 'BSR', 'CSR', 'Dense'],
          rows: [
            ['Index storage', 'M/R + nnzb integers', 'M + nnz integers', '0'],
            ['Value storage', 'nnzb * R * C scalars', 'nnz scalars', 'M * N scalars'],
            ['SpMV arithmetic', 'nnzb * R * C multiply-adds', 'nnz multiply-adds', 'M * N multiply-adds'],
            ['SpMV memory pattern', 'Contiguous tiles + sparse block index', 'Scattered scalar gather', 'Contiguous rows'],
            ['Padding waste', 'nnzb * R * C - nnz zeros stored', '0', 'M * N - nnz zeros stored'],
          ],
        },
        'The critical ratio is block fill = nnz / (nnzb * R * C). When block fill approaches 1.0, BSR stores almost no wasted zeros and the dense inner kernel runs at full efficiency. When block fill drops below 0.5, more than half the tile arithmetic is on padding zeros.',
        {
          type: 'code',
          text: '# Concrete example: 1024x1024 matrix, 5% scalar density\n# Scenario A: nonzeros in 200 dense 16x16 blocks (block fill = 1.0)\n#   CSR: 52,428 col indices + 1,025 row ptrs = 53,453 ints\n#   BSR: 200 block-col indices + 65 block-row ptrs = 265 ints\n#   Index reduction: 200x\n#   Padding waste: 0 extra scalars\n\n# Scenario B: nonzeros scattered across 3,000 16x16 blocks (block fill = 0.068)\n#   CSR: 52,428 col indices + 1,025 row ptrs = 53,453 ints\n#   BSR: 3,000 block-col indices + 65 block-row ptrs = 3,065 ints\n#   Index reduction: 17x\n#   Padding waste: 3,000 * 256 - 52,428 = 715,572 extra scalars\n#   BSR stores 14x more data than CSR values alone',
          language: 'python',
        },
        'Doubling the block dimension quadruples tile area. A 32x32 tile has 1,024 scalars; if only 50 are nonzero, BSR stores 974 zeros per block. The index savings grow with tile area, but so does padding waste. The optimal block size balances these two forces for the specific sparsity pattern and hardware kernel.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['Domain', 'Typical block size', 'Why BSR fits'],
          rows: [
            ['Finite element analysis', '3x3 or 6x6', 'Each mesh node has 3 (2D) or 6 (3D) degrees of freedom; stiffness matrix couples nodes in dense blocks'],
            ['Block-pruned transformers', '32x32 or 64x64', 'Pruning masks are aligned to GPU warp/tile dimensions; blocks are fully dense or fully zero'],
            ['Graph Laplacians (community structure)', '~cluster size', 'Intra-community edges form dense diagonal blocks; inter-community edges are sparse off-diagonal'],
            ['Batched small linear systems', 'system size', 'Block-diagonal matrices where each block is an independent dense system'],
          ],
        },
        'In block-pruned neural networks, the training procedure learns which blocks to zero out. The surviving blocks are fully dense by construction, so block fill is exactly 1.0. NVIDIA Ampere and Hopper GPUs have hardware paths for structured sparsity at the 2:4 and block level, making BSR the natural storage format for inference.',
        {
          type: 'note',
          text: 'BSR is a kernel compatibility question, not a storage question. A block pattern that looks elegant on paper is useless if no fast kernel exists for that tile shape, dtype, and batch size on the target hardware. Always check the kernel library first.',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'table',
          headers: ['Failure mode', 'Symptom', 'Better alternative'],
          rows: [
            ['Low block fill', 'Most tiles are >50% zeros; arithmetic wasted on padding', 'CSR or COO for unstructured sparsity'],
            ['Ragged matrix dimensions', 'Matrix rows/cols not divisible by block size; edge blocks need masking', 'CSR (no alignment requirement)'],
            ['No kernel for tile shape', 'Custom block size with no optimized BLAS/cuSPARSE path', 'Dense (if sparsity < 70%) or CSR'],
            ['Conversion churn', 'Build COO -> convert CSR -> convert BSR -> run once -> discard', 'Keep original format; amortize conversion'],
            ['Dynamic sparsity', 'Nonzero pattern changes each iteration; BSR must be rebuilt', 'CSR with dynamic insertion or dense'],
          ],
        },
        'A matrix can be 95% sparse at the scalar level and still be a terrible BSR candidate. If 50,000 nonzeros are scattered one-per-block across 50,000 16x16 tiles, BSR stores 50,000 * 256 = 12.8 million scalar slots for 50,000 actual values. CSR stores exactly 50,000 values. The word "sparse" is not enough; the distribution determines the format.',
        'Block size selection by aesthetics is another common failure. Larger blocks amortize index overhead but increase padding. A team that picks 64x64 because "bigger blocks = fewer blocks" may store 4,096 scalars per tile when the average block contains 200 nonzeros.',
        {
          type: 'note',
          text: 'Conversion overhead is real. Building BSR from COO requires sorting by block-row, identifying block boundaries, and allocating the values tensor. If the BSR layout is used once and discarded, conversion can dominate the total runtime.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider an 8x8 matrix with block size 4x4 (a 2x2 block grid). The matrix has nonzeros only in block (0,0) and block (1,1) -- two dense diagonal blocks.',
        {
          type: 'code',
          text: '// Dense 8x8 matrix (. = 0):\n// [ 2  1  0  3 | .  .  .  . ]\n// [ 0  4  1  0 | .  .  .  . ]\n// [ 1  0  5  2 | .  .  .  . ]\n// [ 0  3  0  1 | .  .  .  . ]\n// [- - - - - - + - - - - - -]\n// [ .  .  .  . | 3  0  1  0 ]\n// [ .  .  .  . | 0  2  0  4 ]\n// [ .  .  .  . | 1  0  6  0 ]\n// [ .  .  .  . | 0  1  0  3 ]\n\n// BSR representation (R=4, C=4):\nbPtr = [0, 1, 2]          // block-row 0 has 1 block, block-row 1 has 1 block\nbCol = [0, 1]             // block 0 is at block-col 0, block 1 at block-col 1\nvals = [\n  [[2,1,0,3],[0,4,1,0],[1,0,5,2],[0,3,0,1]],   // tile 0\n  [[3,0,1,0],[0,2,0,4],[1,0,6,0],[0,1,0,3]],   // tile 1\n]\n\n// CSR for comparison:\nrowPtr = [0, 3, 5, 8, 10, 12, 14, 16, 18]\ncolIdx = [0,1,3, 1,2, 0,2,3, 1,3, 4,6, 5,7, 4,6, 5,7]  // 18 entries\nvalues = [2,1,3, 4,1, 1,5,2, 3,1, 3,1, 2,4, 1,6, 1,3]  // 18 entries\n\n// BSR indices: 2 + 2 = 4 integers\n// CSR indices: 9 + 18 = 27 integers\n// Ratio: 6.75x fewer indices with BSR',
          language: 'javascript',
        },
        'Now change the example: scatter the same 18 nonzeros across all four 4x4 blocks instead of concentrating them in two. BSR must store all four blocks (nnzb = 4), each as a 4x4 tile = 64 total scalar slots for 18 actual values. Block fill drops to 18/64 = 0.28. CSR still stores exactly 18 values. BSR now wastes memory and computes on 46 padding zeros per SpMV.',
        {
          type: 'table',
          headers: ['Metric', 'Clustered (2 blocks)', 'Scattered (4 blocks)'],
          rows: [
            ['nnzb', '2', '4'],
            ['Scalar slots stored', '32', '64'],
            ['Actual nonzeros', '18', '18'],
            ['Block fill', '0.56', '0.28'],
            ['BSR index count', '4', '6'],
            ['CSR index count', '27', '27'],
            ['Verdict', 'BSR wins', 'CSR wins'],
          ],
        },
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Measure before choosing. Build block-fill histograms for candidate tile shapes (2x2, 4x4, 8x8, 16x16, 32x32). Plot the distribution of fill ratios across stored blocks. A single average hides the tail that decides whether BSR helps.',
            'Check kernel availability first. Query your target library (cuSPARSE, MKL, rocSPARSE) for supported block sizes and dtypes. A 7x7 tile has no optimized path; a 16x16 tile maps to tensor cores on Ampere+.',
            'Sort block columns within each block-row. Sorted bCol arrays simplify debugging, enable deterministic tests, and allow binary search during random-access queries.',
            'Coalesce duplicates before the kernel path. If the assembly process can produce multiple contributions to the same block position, sum them during construction rather than storing duplicates.',
            'Benchmark end-to-end. The BSR kernel may be 3x faster than CSR, but if conversion from COO takes longer than the kernel, the pipeline loses. Measure: construction + host-device transfer + kernel + output validation.',
          ],
        },
        {
          type: 'code',
          text: '# Block-fill histogram for format selection (Python/NumPy)\nimport numpy as np\n\ndef block_fill_histogram(A, R, C):\n    """Return fill ratio per block for a dense matrix A."""\n    M, N = A.shape\n    fills = []\n    for bi in range(M // R):\n        for bj in range(N // C):\n            tile = A[bi*R:(bi+1)*R, bj*C:(bj+1)*C]\n            nnz_tile = np.count_nonzero(tile)\n            if nnz_tile > 0:\n                fills.append(nnz_tile / (R * C))\n    return fills\n\n# Decision rule:\n# If median(fills) > 0.5 and len(fills) < nnz/4: BSR likely wins\n# If median(fills) < 0.3 or len(fills) > nnz/2: CSR likely wins',
          language: 'python',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'SciPy sparse tutorial -- https://docs.scipy.org/doc/scipy/tutorial/sparse.html -- covers COO, CSR, CSC, BSR construction and conversion with code examples.',
            'PyTorch sparse tensors -- https://docs.pytorch.org/docs/stable/sparse.html -- documents BSR layout for autograd-compatible block-sparse operations.',
            'NVIDIA cuSPARSE -- https://docs.nvidia.com/cuda/cusparse/ -- reference for GPU-accelerated BSR SpMV and SpMM with supported block sizes.',
            'MLIR SparseTensor dialect -- https://mlir.llvm.org/docs/Dialects/SparseTensorOps/ -- compiler infrastructure for generating sparse kernels from high-level tensor expressions.',
            'Bulucc et al., "Parallel Sparse Matrix-Matrix Multiplication and Indexing" (2012) -- analysis of block-sparse performance in distributed settings.',
          ],
        },
        {
          type: 'table',
          headers: ['Role', 'Topic'],
          rows: [
            ['Prerequisite', 'COO Sparse Tensor Assembly Primer -- understand coordinate-level sparse construction before block-level compression'],
            ['Prerequisite', 'CSC Column Sparse Matrix Primer -- CSR/CSC are the scalar baselines BSR improves on'],
            ['Extension', 'Structured Pruning N:M Sparsity Case Study -- finer-grained structured sparsity within blocks'],
            ['Companion', 'Accelerator Kernel Compatibility Matrix Case Study -- how hardware constraints determine format selection'],
            ['Application', 'WebGPU Parallel Prefix Scan Compaction -- GPU-side construction primitives relevant to BSR assembly'],
          ],
        },
      ],
    },
  ],
};

