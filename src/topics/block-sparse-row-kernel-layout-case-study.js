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
      heading: 'Why this exists',
      paragraphs: [
        'Block Sparse Row, or BSR, exists because some sparse matrices are not random dust. Their nonzeros appear in dense tiles. Scientific simulations, finite-element systems, graph blocks, and block-pruned neural networks often have structure at the block level even when the full matrix is sparse.',
        'The obvious scalar sparse format is CSR: store row pointers, column indices, and one value per scalar nonzero. CSR is flexible, but it pays index overhead for every value and gives kernels irregular scalar work.',
        'BSR changes the unit of sparsity from one scalar to one dense block. It stores sparse rows of blocks, then runs dense inner loops inside each stored block. The point is not just saving index bytes. The point is giving hardware regular tiles to compute on.',
      ],
    },
    {
      heading: 'What the diagram emphasizes',
      paragraphs: [
        'In the block-layout view, watch the format compress block rows, not scalar rows. `bPtr` bounds the blocks in each block row. `bCol` says where each block sits. `vals` stores dense tiles. The sparse part chooses which tiles exist; the dense part computes inside a tile.',
        'In the kernel-fit view, read the decision table as the warning label. BSR wins only if the data has enough filled blocks and the hardware has a good kernel for the chosen tile shape. A matrix with many scattered scalar nonzeros can look sparse and still be a terrible BSR candidate.',
      ],
    },
    {
      heading: 'The core layout',
      paragraphs: [
        'BSR has three main arrays. `bPtr` stores offsets for block rows, like CSR row pointers. `bCol` stores the block-column index for each stored block. `vals` stores the dense block payloads, usually shaped as number-of-blocks by block-rows by block-columns.',
        'If the block size is 16 by 16, one BSR entry represents up to 256 scalar positions. That entry needs one block-column index, not 256 scalar column indices. The kernel can then multiply or accumulate the 16 by 16 tile with regular inner loops.',
        'The invariant is that each stored block represents a fixed rectangle in the logical matrix. The block-row offset and block-column index locate the rectangle; the value tile fills its contents. Missing blocks are logically zero.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'BSR works when block regularity is real. The sparse outer loop skips entire absent rectangles. The dense inner loop gives the CPU or GPU a small regular computation with predictable memory access. That can reduce metadata traffic and improve arithmetic intensity.',
        'The correctness argument is the same as CSR, lifted to blocks. Each block row slice lists the nonzero blocks in that block row. Each listed block column names the logical column block. The dense payload supplies the scalar values inside that rectangle. If every nonzero block is listed once and every missing block is treated as zero, the BSR matrix represents the intended sparse matrix.',
        'The performance argument is conditional. If blocks are full enough, one block index plus a dense tile is efficient. If blocks are mostly empty, BSR stores zeros inside tiles and may compute on them. The format buys regularity by accepting some padding.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Storage is O(number of block rows + number of stored blocks + stored blocks times block area). That last term is the catch. A half-empty 16 by 16 block still stores 256 scalar slots unless the implementation adds another layer of sparsity.',
        'Runtime depends on block shape, fill ratio, dtype, batch size, kernel implementation, memory layout, and hardware. A tile shape that works on one GPU kernel may be poor on another. A block size that improves index overhead may hurt occupancy or create ragged tails.',
        'A production ledger should track scalar density, block density, average fill per stored block, padding waste, block shape, kernel name, fallback coverage, latency, memory, and accuracy or numerical drift if pruning created the sparsity.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'BSR wins in finite element matrices, block-structured scientific simulations, batched graph blocks, sparse linear algebra with natural vector-valued variables, and pruned neural networks whose masks are block-aligned.',
        'In AI systems, block sparsity should be treated as a kernel compatibility question. A mask pattern that looks elegant in a paper may not map to a fast available kernel. The useful question is: does this exact block shape, dtype, batch size, and hardware path beat dense or CSR after conversion costs?',
        'BSR also helps teach sparse systems because it exposes a broader rule: sparsity is only valuable when the representation matches the structure. Scalar sparse, block sparse, structured N:M sparse, and dense are different bets about where the zeros are and what the hardware can skip.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Do not confuse scalar sparsity with useful block sparsity. A matrix can be 90 percent sparse and still have awful block fill. Do not ignore ragged tails and padding.',
        'Do not assume block sparse is automatically faster than dense. Sparse metadata, memory indirection, and kernel launch overhead can dominate.',
        'BSR also fails when block size is chosen for aesthetics instead of measurement. Larger blocks reduce index overhead but increase padding waste. Smaller blocks reduce padding but can lose the dense-kernel benefit. There is no universal tile size.',
        'Another failure mode is conversion churn. If the program builds COO, converts to CSR, converts to BSR, runs one small kernel, then throws the layout away, the conversion may dominate the compute. BSR pays off when the block layout is reused or when the kernel win is large enough to cover setup.',
      ],
    },
    {
      heading: 'A worked case',
      paragraphs: [
        'Suppose a 64 by 64 matrix is divided into 16 by 16 blocks. There are 16 possible blocks. If only four blocks are present and each is 90 percent full, BSR stores four block-column indices and four dense tiles. CSR would store hundreds of scalar column indices. BSR likely wins because the missing blocks are skipped and the present blocks are dense enough to compute efficiently.',
        'Now change the pattern: the same number of scalar nonzeros are scattered as one or two values per 16 by 16 block. BSR now stores many mostly empty tiles. The kernel performs regular work, but much of that work is on zeros. CSR or COO may be better. The difference is not the word "sparse"; it is the distribution of the nonzeros.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Measure block fill before choosing a block size. Build histograms for candidate tile shapes, then record how many stored blocks are full, mostly full, half full, or nearly empty. A single average hides the tail that often decides whether BSR is useful.',
        'Keep row pointers and block columns sorted by block row unless the kernel documents another contract. Sorted block columns make debugging easier, help deterministic tests, and let conversion code compare BSR output with CSR or dense references. If duplicates can appear during assembly, coalesce them before the kernel path.',
        'Benchmark the whole lifecycle: mask creation, conversion, host-device transfer, kernel execution, fallback, and output validation. The BSR kernel may look fast alone while the conversion pipeline loses the end-to-end race.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: SciPy sparse tutorial at https://docs.scipy.org/doc/scipy/tutorial/sparse.html, PyTorch sparse tensors at https://docs.pytorch.org/docs/stable/sparse.html, NVIDIA cuSPARSE at https://docs.nvidia.com/cuda/cusparse/, and MLIR SparseTensor dialect at https://mlir.llvm.org/docs/Dialects/SparseTensorOps/. Study COO Sparse Tensor Assembly Primer, CSC Column Sparse Matrix Primer, Structured Pruning N:M Sparsity Case Study, Accelerator Kernel Compatibility Matrix Case Study, and WebGPU Parallel Prefix Scan Compaction next.',
      ],
    },
  ],
};
