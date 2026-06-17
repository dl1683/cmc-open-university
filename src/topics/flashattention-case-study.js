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
      heading: "Why this exists",
      paragraphs: [
        "FlashAttention exists because standard attention spends too much time moving data. The formula looks compact: compute scores with QK^T, apply softmax, then multiply by V. On real GPUs, the slow part is often not the multiply itself. The slow part is writing and reading the huge intermediate score and probability matrices through high-bandwidth memory.",
        "This matters because attention sits in the hottest part of transformer training and inference. A long sequence makes the attention matrix grow as n by n. If the kernel materializes that matrix and then materializes the softmax probabilities, the GPU pays a large memory-traffic bill before the final output is even produced.",
      ],
    },
    {
      heading: "The naive approach",
      paragraphs: [
        "The naive implementation has three visible stages. First it computes S = QK^T, an n by n score matrix. Then it applies softmax row by row to produce P, another n by n matrix. Then it computes O = P V. The math is correct, but the schedule forces the full S and P matrices to leave the chip and come back.",
        "That is a bad bargain on a GPU. On-chip SRAM is small but very fast. HBM is much larger but slower and more expensive to touch. A naive attention kernel treats memory as if all reads and writes were equal. FlashAttention starts from the opposite question: can exact attention be scheduled so temporary scores live only in fast memory?",
      ],
    },
    {
      heading: "The core insight",
      paragraphs: [
        "The core insight is IO-awareness. FlashAttention does not change the answer. It changes the order of computation so blocks of Q, K, and V are streamed through SRAM, temporary score tiles are consumed immediately, and the full attention matrix is never stored in HBM.",
        "That distinction is the whole case study. FlashAttention is not sparse attention, linear attention, or an approximation. Every query still interacts with every key in dense attention. The speedup comes from avoiding unnecessary memory movement while preserving the exact softmax result.",
      ],
    },
    {
      heading: "How the mechanism works",
      paragraphs: [
        "For a block of query rows, the kernel loads a tile of Q and then visits tiles of K and V. It computes a small score tile in SRAM, applies the softmax update for those rows, folds the weighted V contribution into the partial output, and discards the scores. The next K/V tile repeats the same process.",
        "The hard part is softmax because a stable softmax normally needs the whole row. It subtracts the row maximum before exponentiating and divides by the row sum. FlashAttention processes a row in pieces, so it carries running statistics for each row: the current maximum, the current normalization sum, and the partial output.",
        "When a later tile contains a larger score, the old partial output was normalized against the old maximum. The online softmax update rescales the previous sum and output before adding the new tile's contribution. This small numerical trick is what lets the algorithm be tiled without becoming approximate.",
        "Causal masks and padding masks do not change the idea. They change which scores inside a tile are valid. The kernel still wants the same contract: load useful blocks, mask invalid positions before softmax, update row statistics, and write back only the final output state.",
      ],
    },
    {
      heading: "What the visual is proving",
      paragraphs: [
        "The naive-vs-tiled view proves that the expensive object is not only the arithmetic expression. It is the materialized n by n state. The score matrix and probability matrix are useful only as temporary bridges between Q, K, V, and O. If those bridges can stay inside a tile, they do not need to become long-lived arrays in HBM.",
        "The online-softmax view proves why tiling does not break correctness. The running max and running normalization sum are enough state to combine blocks exactly. The visual is showing the minimum row state that must survive across tiles, not a heuristic summary of the row.",
      ],
    },
    {
      heading: "Why it works",
      paragraphs: [
        "The algorithm works because it respects the memory hierarchy. HBM bandwidth is large, but it is still precious compared with data reuse inside SRAM and registers. A tile schedule loads blocks, uses them heavily while they are on chip, and writes back only the final output plus the small statistics needed for correctness.",
        "It also works because softmax has an associative update when the right statistics are kept. Max and sum can be updated block by block. Earlier contributions can be rescaled when the max changes. That gives the kernel exactness without storing all previous scores.",
      ],
    },
    {
      heading: "Costs and tradeoffs",
      paragraphs: [
        "The arithmetic complexity for dense exact attention remains O(n^2 d). FlashAttention reduces IO, not the number of query-key interactions. That is why it can make long context more practical while still leaving quadratic attention as a real scaling cost.",
        "The implementation is also more complex than the textbook formula. Kernel writers have to choose tile sizes, manage SRAM occupancy, handle masks and causal attention, preserve numerical stability, and fit the schedule to a particular GPU architecture. The payoff is large only when memory movement is a meaningful bottleneck.",
        "The tradeoff is shape sensitivity. A kernel that is excellent for one head dimension, precision mode, sequence length, or GPU generation may be less impressive on another. Production teams usually need a small benchmark matrix rather than one headline speedup number.",
      ],
    },
    {
      heading: "Real uses",
      paragraphs: [
        "FlashAttention-style kernels are used in transformer training and inference stacks because they preserve model outputs while improving throughput and memory use. They are especially valuable when sequence length is large, batch shapes are awkward, or the naive kernel would spend too much time reading and writing attention intermediates.",
        "The systems lesson also appears outside this one paper. Modern LLM performance is a stack of memory decisions. FlashAttention improves the attention kernel. KV Cache reduces repeated work during autoregressive decoding. PagedAttention manages serving-time KV memory. Grouped-query attention reduces KV bytes. None of these levers replaces the others.",
        "A good mental model is a compiler pass for memory traffic. The high-level network still asks for attention, but the implementation lowers that request into a schedule that respects the hardware. That is why this topic belongs in both algorithms and systems.",
      ],
    },
    {
      heading: "Failure modes and limits",
      paragraphs: [
        "The most common misconception is that FlashAttention makes attention linear. It does not. It keeps dense attention exact and still evaluates all query-key pairs. If a workload is dominated by the number of interactions rather than memory traffic, tiling alone cannot erase the cost.",
        "Another failure mode is treating the kernel win as the whole serving story. During autoregressive inference, the model repeatedly appends tokens and reads the KV cache. Long-lived cache layout, batching, prefill/decode separation, and scheduler policy can dominate the economics. FlashAttention is one layer, not the full inference system.",
        "There are also engineering limits. Unsupported masks, unusual head dimensions, precision choices, dropout behavior, or hardware-specific constraints can push a stack onto a slower path. A production system needs benchmarks on its actual model shapes instead of assuming the paper result transfers automatically.",
      ],
    },
    {
      heading: "Study next",
      paragraphs: [
        "Primary source: FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness at https://arxiv.org/abs/2205.14135, plus the official implementation at https://github.com/Dao-AILab/flash-attention. Read the paper as a memory-schedule argument, not just a transformer paper.",
        "Study Attention Mechanism for the baseline equation, Softmax and Temperature for the row-normalization step, Multi-Head Attention for head layout, GPU Memory Hierarchy for the IO argument, KV Cache for autoregressive decoding, Transformer Inference Roofline for bottleneck analysis, and LLM Serving: PagedAttention for serving-time memory management.",
      ],
    },
  ],
};
