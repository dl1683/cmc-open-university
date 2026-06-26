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
    { heading: 'How to read the animation', paragraphs: [
        'The naive-vs-tiled view contrasts two memory layouts for the same computation. Active cells mark intermediates that live in HBM -- the GPU\'s large, slow main memory. Found cells mark data that stays on-chip in SRAM -- fast but tiny. Compare cells highlight the final output, which both paths produce identically. The key visual claim: naive attention lights up two full n-by-n grids in HBM (scores and probabilities), while tiled attention lights up only small tile-sized blocks in SRAM and writes back just the n-by-d output.',
        {type:'callout', text:'FlashAttention is an exact attention algorithm whose real optimization is moving less data across the GPU memory hierarchy.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/0/0c/ComputerMemoryHierarchy.svg', alt:'Diagram showing faster smaller memory near the processor and slower larger memory farther away.', caption:'Computer memory hierarchy diagram, original by Danlash and vectorized by Fred the Oyster, public domain, via Wikimedia Commons.'},
        'The online-softmax view tracks running row maximums and sums across tile boundaries. When a later tile raises the row maximum, earlier partial output is rescaled. That rescale step is why tiling remains exact.',
      ] },
    { heading: 'Why this exists', paragraphs: [
        'Transformer attention computes how every token reads every other token. The naive formula creates an n-by-n score matrix and an n-by-n probability matrix in HBM. FlashAttention exists because moving those intermediates through HBM can cost more time than the arithmetic.',
      ] },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious approach is the textbook pipeline: compute QK-transpose, store scores, read them for softmax, store probabilities, read them again, and multiply by V. It is correct and maps cleanly to matrix libraries. It becomes wasteful when n grows.',
      ] },
    { heading: 'The wall', paragraphs: [
        'At n = 4096, the score matrix has 16.8 million entries. In FP16 that is about 32 MB for one head, before the probability matrix. The matrix does not fit in SRAM, so the kernel writes it to HBM and reads it back. Doubling n quadruples this intermediate traffic.',
      ] },
    { heading: 'The core insight', paragraphs: [
        'Change the order of memory movement, not the attention math. Tile Q, K, and V into blocks small enough for SRAM. Compute a score tile, fold it into running softmax and output state, then discard it before it reaches HBM.',
      ] },
    { heading: 'How it works', paragraphs: [
        'The kernel visits Q blocks and K/V blocks. For one tile pair, it loads data into SRAM, computes scores, applies masks, updates the running row maximum and exponential sum, and accumulates weighted V. If the maximum changes, old partial sums and output are multiplied by exp(m_old - m_new).',
      ] },
    { heading: 'Why it works', paragraphs: [
        'Correctness is the online softmax invariant. After each tile, the carried maximum, carried sum, and partial output equal full softmax over the tiles seen so far. Induction over tiles gives the same output as materializing the full row.',
      ] },
    { heading: 'Cost and complexity', paragraphs: [
        'Arithmetic remains O(n squared times d). Memory traffic changes. For n = 2048 and d = 64, each FP16 score matrix is 8 MB and the probability matrix is another 8 MB. The naive path writes and reads both, about 32 MB of intermediate HBM traffic, while tiled attention keeps 128 KB score tiles in SRAM and writes only the final output.',
      ] },
    { heading: 'Real-world uses', paragraphs: [
        'FlashAttention fits transformer training and long-context prefill where exact attention is still required and memory bandwidth is the bottleneck. The broader lesson also appears in KV cache, PagedAttention, grouped-query attention, and serving systems: moving fewer bytes can matter more than changing formulas.',
      ] },
    { heading: 'Where it fails', paragraphs: [
        'It does not make attention sub-quadratic; all n squared query-key pairs are still evaluated. Speedup shrinks for short sequences, compute-bound shapes, unsupported masks, unusual cross-attention layouts, or decoding workloads dominated by KV-cache reads.',
      ] },
    { heading: 'Worked example', paragraphs: [
        'Use n = 2048, d = 64, and one head. S has 4,194,304 FP16 values, or 8 MB, and P is another 8 MB. Naive attention writes S, reads S, writes P, reads P, and writes a 256 KB output. With block size 256, each score tile is 65,536 values, or 128 KB, so the tile fits in SRAM. The algorithm keeps exact attention while removing the full intermediate HBM writes.',
      ] },
    { heading: 'Sources and study next', paragraphs: [
        'Primary sources: Dao, Fu, Ermon, Rudra, and Re, 2022, FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness; Dao, 2023, FlashAttention-2; and Milakov and Gimelshein, 2018, Online normalizer calculation for softmax.',
        'Study Attention Mechanism, Multi-Head Attention, KV Cache, PagedAttention, Ring Attention, and Transformer Block next.',
      ] },
  ],
};

