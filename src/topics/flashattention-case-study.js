// FlashAttention case study: exact attention made IO-aware. The animation
// contrasts naive materialization of the full attention matrix with tiled
// computation and online softmax statistics.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'flashattention-case-study',
  title: 'FlashAttention Case Study',
  category: 'Papers',
  summary: 'Exact attention without writing the full attention matrix to slow GPU memory: tile Q, K, and V through SRAM.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['naive vs tiled', 'online softmax'], defaultValue: 'naive vs tiled' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function dataflow(title, mode) {
  const tiled = mode === 'tiled';
  return graphState({
    nodes: [
      { id: 'q', label: 'Q', x: 0.8, y: 2.0, note: 'queries' },
      { id: 'k', label: 'K', x: 0.8, y: 4.0, note: 'keys' },
      { id: 'v', label: 'V', x: 0.8, y: 6.0, note: 'values' },
      { id: 'hbm', label: 'HBM', x: 3.1, y: 4.0, note: tiled ? 'stream blocks' : 'store S and P' },
      { id: 'sram', label: 'SRAM', x: 5.2, y: 4.0, note: tiled ? 'tile workspace' : 'too small for full matrix' },
      { id: 'score', label: 'QK^T', x: 7.0, y: 2.5, note: 'scores' },
      { id: 'softmax', label: 'softmax', x: 7.0, y: 4.4, note: tiled ? 'online stats' : 'materialized P' },
      { id: 'out', label: 'O = P V', x: 8.8, y: 4.4, note: 'output' },
    ],
    edges: [
      { id: 'e-q-hbm', from: 'q', to: 'hbm', weight: 'load' },
      { id: 'e-k-hbm', from: 'k', to: 'hbm', weight: 'load' },
      { id: 'e-v-hbm', from: 'v', to: 'hbm', weight: 'load' },
      { id: 'e-hbm-sram', from: 'hbm', to: 'sram', weight: tiled ? 'tiles' : 'large matrices' },
      { id: 'e-sram-score', from: 'sram', to: 'score', weight: 'matmul' },
      { id: 'e-score-softmax', from: 'score', to: 'softmax', weight: 'row normalize' },
      { id: 'e-softmax-out', from: 'softmax', to: 'out', weight: 'weighted V' },
    ],
  }, { title });
}

function* naiveVsTiled() {
  yield {
    state: labelMatrix(
      'Naive attention materializes n x n intermediates',
      [
        { id: 'scores', label: 'scores S' },
        { id: 'prob', label: 'probabilities P' },
        { id: 'out', label: 'output O' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'stored', label: 'stored in HBM?' },
        { id: 'pain', label: 'pain' },
      ],
      [
        ['n x n', 'yes', 'quadratic writes'],
        ['n x n', 'yes', 'more quadratic reads'],
        ['n x d', 'yes', 'final result'],
      ],
    ),
    highlight: { active: ['scores:stored', 'prob:stored'], compare: ['out:stored'] },
    explanation: 'Standard attention computes S = QK^T, applies softmax to form P, then computes O = P V. If the implementation writes S and P to high-bandwidth GPU memory, it creates huge memory traffic. The math is already quadratic; naive memory movement makes the wall-clock cost worse.',
  };

  yield {
    state: dataflow('Naive dataflow: full matrices leave the chip', 'naive'),
    highlight: { active: ['hbm', 'e-hbm-sram'], compare: ['score', 'softmax'] },
    explanation: 'The bottleneck is not only FLOPs. HBM is fast, but on-chip SRAM is much faster and much smaller. Naive attention repeatedly moves large intermediate matrices through HBM. FlashAttention asks a hardware-aware question: can we compute exact attention while keeping each tile inside SRAM long enough to avoid writing S and P out?',
  };

  yield {
    state: labelMatrix(
      'FlashAttention tiles the sequence dimension',
      [
        { id: 'q0', label: 'Q block 0' },
        { id: 'q1', label: 'Q block 1' },
        { id: 'k0', label: 'K/V block 0' },
        { id: 'k1', label: 'K/V block 1' },
      ],
      [
        { id: 'tile0', label: 'tile pass 0' },
        { id: 'tile1', label: 'tile pass 1' },
        { id: 'kept', label: 'kept on chip' },
      ],
      [
        ['load', 'load later', 'partial O'],
        ['load later', 'load', 'partial O'],
        ['visit', 'visit', 'K,V tile'],
        ['visit', 'visit', 'K,V tile'],
      ],
    ),
    highlight: { active: ['q0:tile0', 'k0:tile0', 'k1:tile0'], found: ['q0:kept'] },
    explanation: 'FlashAttention streams blocks of Q, K, and V through SRAM. For each Q block, it visits K/V blocks, updates that block of output, and discards temporary scores. The full attention matrix never needs to be materialized in HBM.',
    invariant: 'The output is exact attention; only the order of computation and memory movement changes.',
  };

  yield {
    state: dataflow('Tiled dataflow: scores are temporary inside SRAM', 'tiled'),
    highlight: { found: ['sram', 'score', 'softmax', 'out'], active: ['e-hbm-sram'] },
    explanation: 'The case study is an important lesson for AI engineering: an algorithm can keep the same mathematical answer while changing the memory schedule. FlashAttention is not approximate attention and it does not remove the n^2 score interactions. It reduces expensive reads and writes between memory levels.',
  };
}

function* onlineSoftmax() {
  yield {
    state: labelMatrix(
      'Online softmax keeps running row statistics',
      [
        { id: 'row0', label: 'query row 0' },
        { id: 'row1', label: 'query row 1' },
        { id: 'row2', label: 'query row 2' },
      ],
      [
        { id: 'max', label: 'running max m' },
        { id: 'sum', label: 'running sum l' },
        { id: 'out', label: 'partial output' },
      ],
      [
        ['3.1', '1.00', 'from block A'],
        ['2.4', '1.00', 'from block A'],
        ['4.0', '1.00', 'from block A'],
      ],
    ),
    highlight: { active: ['row0:max', 'row0:sum', 'row0:out'] },
    explanation: 'Softmax normally wants the whole row so it can subtract the row max and normalize by the row sum. FlashAttention processes a row in blocks, so it carries two statistics per row: the running maximum and the running normalization sum. That lets later blocks rescale earlier partial results exactly.',
  };

  yield {
    state: labelMatrix(
      'A later block changes the max; old output is rescaled',
      [
        { id: 'row0', label: 'query row 0' },
        { id: 'row1', label: 'query row 1' },
        { id: 'row2', label: 'query row 2' },
      ],
      [
        { id: 'oldmax', label: 'old m' },
        { id: 'newmax', label: 'new m' },
        { id: 'rescale', label: 'rescale old O' },
      ],
      [
        ['3.1', '5.0', 'multiply down'],
        ['2.4', '2.4', 'unchanged'],
        ['4.0', '4.6', 'multiply down'],
      ],
    ),
    highlight: { active: ['row0:newmax', 'row0:rescale'], compare: ['row1:newmax'] },
    explanation: 'If a later tile contains a larger score, the old partial output was normalized against a smaller max. Online softmax rescales the old contribution before adding the new tile. This is the small numerical trick that makes blockwise exact attention possible.',
    invariant: 'Numerical stability comes from tracking the max, not from storing the whole row.',
  };

  yield {
    state: labelMatrix(
      'What FlashAttention changes and does not change',
      [
        { id: 'quality', label: 'model output' },
        { id: 'flops', label: 'score interactions' },
        { id: 'io', label: 'HBM traffic' },
        { id: 'context', label: 'long context' },
      ],
      [
        { id: 'answer', label: 'answer' },
        { id: 'link', label: 'study link' },
      ],
      [
        ['same exact attention', 'Attention Mechanism'],
        ['still quadratic', 'Multi-Head Attention'],
        ['much lower', 'LLM Serving: PagedAttention'],
        ['cheaper but not free', 'KV Cache'],
      ],
    ),
    highlight: { found: ['quality:answer', 'io:answer'], compare: ['flops:answer'] },
    explanation: 'The local transformer-cost notes say the key boundary cleanly: FlashAttention is a brilliant memory-access optimization, not a proof that attention stopped being quadratic. Pair this with KV Cache and LLM Serving: PagedAttention to see how training kernels and serving memory solve different layers of the same economics problem.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'naive vs tiled') yield* naiveVsTiled();
  else if (view === 'online softmax') yield* onlineSoftmax();
  else throw new InputError('Pick a FlashAttention view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The naive-vs-tiled view contrasts two memory layouts for the same computation. Active cells mark intermediates that live in HBM -- the GPU\'s large, slow main memory. Found cells mark data that stays on-chip in SRAM -- fast but tiny. Compare cells highlight the final output, which both paths produce identically. The key visual claim: naive attention lights up two full n-by-n grids in HBM (scores and probabilities), while tiled attention lights up only small tile-sized blocks in SRAM and writes back just the n-by-d output.',
        {type:'callout', text:'FlashAttention is an exact attention algorithm whose real optimization is moving less data across the GPU memory hierarchy.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/0/0c/ComputerMemoryHierarchy.svg', alt:'Diagram showing faster smaller memory near the processor and slower larger memory farther away.', caption:'Computer memory hierarchy diagram, original by Danlash and vectorized by Fred the Oyster, public domain, via Wikimedia Commons.'},
        'The dataflow graph shows how data moves between memory levels. In the naive path, large matrices shuttle through HBM. In the tiled path, the HBM-to-SRAM edge carries small blocks, and score/softmax/output nodes all execute inside SRAM without round-tripping back.',
        'The online-softmax view tracks per-row running statistics across tile boundaries. Active cells are the row currently being updated. Compare cells show rows whose running max did not change, so no rescaling was needed. The rescale column is the mechanism that keeps tiled attention numerically exact: when a later tile raises the row max, earlier partial output gets multiplied down to compensate.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Dao et al. (2022) published FlashAttention because standard attention wastes most of its time moving data, not computing. The formula is compact -- QK^T, softmax, times V -- but a naive GPU kernel writes the full n-by-n score matrix to HBM, reads it back for softmax, writes the n-by-n probability matrix, and reads it back again for the V multiply. Each of those round-trips costs bandwidth on a bus that is already the bottleneck.',
        'Attention sits in the hottest loop of every transformer. A training step touches it once per layer per head, forward and backward. Inference touches it on every generated token. Any wasted memory traffic here multiplies across the entire model. FlashAttention was built to eliminate that waste without changing the mathematical result.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Compute S = Q times K-transpose (an n-by-n matrix of raw scores). Store S in HBM. Read S back, subtract the row max for numerical stability, exponentiate, divide by the row sum to get P (another n-by-n matrix). Store P in HBM. Read P back, multiply by V to get the n-by-d output O. Store O in HBM.',
        'This is the textbook three-step pipeline. It is correct, easy to implement, and maps cleanly to existing BLAS routines. For short sequences it is fast enough. The problem is that it materializes two n-by-n intermediates (S and P) that exist only to bridge Q, K, V to the output -- and those intermediates must travel through HBM twice each (once to write, once to read).',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Take n = 4096 with head dimension d = 128. The score matrix S is 4096-by-4096 = 16.8 million entries. In FP16 that is 32 MB per head per layer. A model with 32 heads and 40 layers produces 32 times 40 = 1,280 such matrices in a single forward pass. Total intermediate attention storage: about 40 GB -- just for scores, not counting probabilities.',
        'An A100 GPU has 80 GB of HBM at 2 TB/s bandwidth, but only about 20 MB of on-chip SRAM at roughly 19 TB/s. The 32 MB score matrix for a single head does not fit in SRAM. The naive kernel must write it to HBM and read it back, paying 64 MB of bandwidth per head just for the score intermediary. The probability matrix doubles that cost.',
        'The result: the GPU\'s tensor cores sit idle waiting for data. The A100 can deliver 312 TFLOPS of FP16 compute, but the naive attention kernel is memory-bandwidth bound. The arithmetic intensity (FLOPs per byte transferred) is too low to saturate the compute units. Doubling n quadruples both the storage and the bandwidth bill.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'IO-awareness: restructure the computation order so the full attention matrix never leaves the chip. Tile Q, K, and V into blocks small enough to fit in SRAM. For each Q block, visit every K/V block, compute the partial score tile on-chip, fold the result into a running output accumulator, and discard the scores immediately. The n-by-n matrix exists only as a sequence of small temporary tiles that are born and consumed inside SRAM.',
        'This is not sparse attention, linear attention, or any approximation. Every query still interacts with every key. The FLOPs are identical. The speedup comes entirely from avoiding unnecessary memory movement between SRAM and HBM.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The outer loop iterates over blocks of K and V. The inner loop iterates over blocks of Q. For each (Q-block, K/V-block) pair, the kernel loads all three tiles into SRAM, computes a small score tile S_ij = Q_i times K_j-transpose, applies masking if needed, and updates the output accumulator for Q_i.',
        'The hard part is softmax. Standard softmax needs the entire row of scores to compute the maximum (for numerical stability) and the normalization sum. FlashAttention cannot see the entire row at once because it processes K/V in blocks. The solution is online softmax (Milakov and Gimelshein, 2018): carry two statistics per query row -- the running maximum m and the running exponential sum l.',
        'When a new K/V block arrives, the kernel computes local scores and finds the local maximum. If the new maximum exceeds the old one, all previous exponentials were too large by a factor of exp(m_old - m_new). The kernel rescales the old sum and partial output by this correction factor, then adds the new block\'s contribution. After all K/V blocks are visited, the output is identical to what a full-row softmax would have produced.',
        'One fused CUDA kernel executes the entire tile loop: load Q/K/V tiles, compute scores, update online softmax statistics, accumulate weighted V, write only the final output to HBM. No intermediate matrix ever touches HBM. Causal masks and padding masks fit the same framework -- they just zero out invalid positions within a tile before the softmax update.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on the associativity of the softmax statistics. The row maximum and exponential sum can be updated incrementally: max(a, b) is associative, and the sum of exponentials can be rescaled when the max changes. Given any partition of a row into blocks, processing the blocks in any order and carrying (m, l, partial_O) produces the same final output. The proof is a straightforward induction over the number of blocks.',
        'Performance rests on the memory hierarchy gap. SRAM bandwidth on an A100 is roughly 19 TB/s; HBM bandwidth is 2 TB/s -- a 10x gap. By keeping all intermediate computation in SRAM and writing only the n-by-d output to HBM, FlashAttention trades a small amount of redundant computation (recomputing scores during the backward pass instead of storing them) for a large reduction in memory traffic. The redundant FLOPs are cheap; the avoided HBM traffic is expensive.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Arithmetic complexity: O(n-squared times d), the same as standard attention. FlashAttention does not reduce the number of multiply-accumulate operations. It reduces the number of bytes transferred through HBM.',
        'Memory: O(n) instead of O(n-squared). The full n-by-n attention matrix is never stored. The kernel holds only the current tile (block_size-by-block_size) in SRAM plus O(n) running statistics (m, l, partial O). This is what enables training with 4x to 16x longer sequences on the same GPU.',
        'Wall-clock speedup: 2x to 4x over naive attention in practice (Dao et al. 2022 benchmarks on A100). FlashAttention-2 (Dao, 2023) further improves this with better warp-level parallelism and fewer non-matmul FLOPs, achieving close to the theoretical peak on H100.',
        'Implementation complexity is the real cost. The kernel must manage tile sizes, SRAM occupancy, warp scheduling, causal mask logic, numerical stability with FP16/BF16, and backward-pass recomputation. Each new GPU architecture (A100 vs H100 vs MI300X) wants a different tile configuration. This is expert-level CUDA work, not something most teams write from scratch.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'PyTorch 2.0+ ships FlashAttention as the default backend for torch.nn.functional.scaled_dot_product_attention. HuggingFace Transformers, xFormers, vLLM, TensorRT-LLM, and DeepSpeed all use FlashAttention kernels. If you call standard attention in any major framework today, you are likely running FlashAttention underneath.',
        'The practical impact is sequence length. Before FlashAttention, training a transformer with n = 8192 on an 80 GB A100 required careful gradient checkpointing just to fit the attention intermediates. With FlashAttention, the same GPU can handle n = 32768 or longer because the O(n) memory footprint eliminates the quadratic intermediate.',
        'The deeper lesson extends beyond this one kernel. Modern LLM performance is a stack of memory-hierarchy decisions. FlashAttention handles the attention kernel. KV cache avoids recomputing past keys and values during autoregressive generation. PagedAttention manages serving-time KV memory with virtual-memory-style paging. Grouped-query attention reduces KV bytes by sharing key-value heads. Each optimization targets a different layer of the same memory-economics problem.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'FlashAttention does not make attention sub-quadratic. It still evaluates all n-squared query-key pairs. If a workload is compute-bound rather than memory-bound (very short sequences, very large head dimensions), the speedup shrinks because the bottleneck was never HBM traffic.',
        'Hardware portability was initially limited. The original kernel was CUDA-only, tuned for NVIDIA A100. Porting to AMD ROCm, Intel GPUs, or Apple Metal required rewriting the kernel for each architecture. Triton-based implementations (used in FlashAttention-2) improve portability but still need per-architecture tuning for peak performance.',
        'Custom attention patterns create friction. Sliding-window attention, block-sparse patterns, cross-attention with mismatched sequence lengths, or novel masking schemes each need kernel modifications. If the pattern does not tile cleanly, the kernel may fall back to a slower path or require a new implementation.',
        'FlashAttention is also not the whole inference story. During autoregressive decoding, the dominant cost shifts to KV cache reads, batch scheduling, prefill/decode separation, and memory management. A fast attention kernel helps, but it does not solve the serving-system design problem.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Standard attention for n = 2048, d = 64, one head. Score matrix S = Q times K-transpose: 2048-by-2048 = 4.2 million entries, 8 MB in FP16. Probability matrix P: another 8 MB. Output O: 2048-by-64 = 131K entries, 256 KB. HBM traffic for intermediates: write S (8 MB) + read S for softmax (8 MB) + write P (8 MB) + read P for V multiply (8 MB) + write O (256 KB) = 32.3 MB of HBM transfers.',
        'FlashAttention with block size 256. Q is split into 8 blocks of 256 rows. K and V are split into 8 blocks of 256 rows. Each score tile is 256-by-256 = 65K entries, 128 KB -- fits comfortably in 20 MB of SRAM. For each Q block, the kernel visits all 8 K/V blocks, computing and discarding a 128 KB score tile each time. HBM traffic: read Q once (256 KB), read all of K and V once per Q block pass (512 KB times 8 = 4 MB total across all tiles, but each K/V block is reused across Q blocks via the outer loop), write O once (256 KB). Total HBM writes for intermediates: just the 256 KB output. No score matrix, no probability matrix.',
        'The ratio: standard attention writes 32 MB of intermediates to HBM; FlashAttention writes 256 KB. At n = 2048, that is a 125x reduction in intermediate HBM writes. The kernel also reads less because K/V tiles are reused in SRAM. Wall-clock improvement depends on how memory-bound the workload is, but typical measured speedups are 2x to 4x end-to-end because compute and other overheads also contribute.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Dao, Fu, Ermon, Rudra, and Re, 2022: FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness. Dao, 2023: FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning. Milakov and Gimelshein, 2018: Online normalizer calculation for softmax.',
        'Study next: Attention Mechanism (the operation FlashAttention optimizes). Multi-Head Attention (FlashAttention operates independently per head). KV Cache (complementary optimization that avoids recomputing past keys and values during generation). LLM Serving: PagedAttention (memory management for serving-time KV storage). Ring Attention (distributes FlashAttention across multiple GPUs for very long sequences). Transformer Block (where attention fits in the full model architecture).',
      ],
    },
  ],
};

