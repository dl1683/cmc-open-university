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
      heading: 'What it is',
      paragraphs: [
        'FlashAttention is an exact attention algorithm that is IO-aware. It computes the same attention result as the standard softmax(QK^T)V formula, but it changes the memory schedule so large intermediate score and probability matrices do not have to be written to slow GPU high-bandwidth memory.',
        'The point is subtle and important. FlashAttention does not make attention mathematically linear. The pairwise query-key interactions are still quadratic in sequence length. The win comes from tiling the computation so blocks fit in fast on-chip SRAM and from using online softmax statistics to combine those blocks exactly.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Naive attention materializes S = QK^T, applies softmax to get P, then multiplies P by V. For long sequences, S and P are n by n matrices. FlashAttention instead processes blocks of Q against blocks of K and V. Temporary scores live only inside the tile. The algorithm updates each output block and then discards the temporary score block.',
        'The hard part is softmax. A stable softmax subtracts the row maximum and divides by the row sum. Because FlashAttention sees one tile at a time, it keeps running statistics for each query row: the current maximum, the current normalization sum, and the partial output. When a later tile changes the maximum, earlier partial output is rescaled before the new tile is added.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The arithmetic complexity remains O(n^2 d) for exact dense attention, but the IO complexity drops because the algorithm avoids writing full n by n intermediates to HBM. That matters because GPU kernels often bottleneck on memory movement, not only arithmetic throughput. The original paper reports large speedups on transformer training and long-sequence workloads by exploiting this IO gap.',
        'This is why the idea belongs beside Attention Mechanism, Multi-Head Attention, KV Cache, and LLM Serving: PagedAttention. FlashAttention improves the attention kernel. PagedAttention improves serving-time cache allocation. Grouped-query attention reduces KV cache bytes. They are different levers in one system.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'FlashAttention and later variants are now standard infrastructure in many transformer stacks. They are used in training and inference libraries because they reduce memory traffic while preserving exact output. For long context, the practical lesson is not that attention became free; it is that hardware-aware kernels can move the feasible context window and throughput frontier.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The most common misconception is that FlashAttention removes quadratic attention. It does not. It removes avoidable memory traffic for exact attention. Another misconception is that a faster attention kernel solves all LLM serving economics. During autoregressive inference, the long-lived KV Cache and scheduler behavior become central, which is why LLM Serving: PagedAttention is a separate systems page.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: "FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness" at https://arxiv.org/abs/2205.14135, plus the official implementation at https://github.com/Dao-AILab/flash-attention. Local framing source: Cost_of_Transformers_full.txt in the provided document corpus. Study Attention Mechanism, Softmax & Temperature, Multi-Head Attention, KV Cache, and LLM Serving: PagedAttention next.',
      ],
    },
  ],
};
