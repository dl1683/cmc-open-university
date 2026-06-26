// Multi-head attention: run several attentions side by side, each with its
// own learned projections, each free to track a DIFFERENT relationship —
// then concatenate. Why one attention pattern was never going to be enough.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'multi-head-attention',
  title: 'Multi-Head Attention',
  category: 'AI & ML',
  summary: 'Two heads, two different attention patterns, one concatenated answer — parallel relationship detectors.',
  controls: [
    { id: 'view', label: 'Inspect', type: 'select', options: ['both heads', 'head 1 only', 'head 2 only'], defaultValue: 'both heads' },
  ],
  run,
};

const TOKENS = ['the', 'cat', 'sat', 'here'];

// Attention patterns produced by two heads' learned Wq/Wk projections in a
// trained toy model. Head 1 learned a POSITIONAL habit (look at the previous
// token); head 2 learned a SEMANTIC one (find the noun). Each row sums to 1.
const HEAD1 = [
  [0.88, 0.04, 0.04, 0.04],
  [0.80, 0.10, 0.05, 0.05],
  [0.06, 0.80, 0.08, 0.06],
  [0.05, 0.07, 0.80, 0.08],
];
const HEAD2 = [
  [0.10, 0.74, 0.08, 0.08],
  [0.06, 0.80, 0.07, 0.07],
  [0.07, 0.78, 0.08, 0.07],
  [0.08, 0.72, 0.10, 0.10],
];

// Each head has its own 2-dimensional value space (4 dims split across 2 heads).
function valueVector(word, headIndex) {
  return Array.from({ length: 2 }, (_, j) => {
    let h = j + 3 * (headIndex + 1);
    for (let i = 0; i < word.length; i += 1) h = (h * 31 + word.charCodeAt(i) * (j + 2)) % 1009;
    return (h / 1009) * 2 - 1;
  });
}

const pct = (v) => `${Math.round(v * 100)}%`;
const rows = TOKENS.map((t, i) => ({ id: `q${i}`, label: t }));
const cols = TOKENS.map((t, i) => ({ id: `k${i}`, label: t }));

export function* run(input) {
  const r2 = (v) => Math.round(v * 100) / 100;
  const view = String(input.view);
  if (!['both heads', 'head 1 only', 'head 2 only'].includes(view)) throw new InputError('Pick a view.');

  // Pre-compute value vectors for display
  const V1 = TOKENS.map((t) => valueVector(t, 0));
  const V2 = TOKENS.map((t) => valueVector(t, 1));
  const showVec = (vec) => `[${vec.map(r2).join(', ')}]`;

  yield {
    state: matrixState({ title: 'One head = one pattern = one kind of relationship', rows, columns: cols, values: HEAD1, format: pct }),
    highlight: {},
    explanation: `A single attention head produces ONE softmax distribution per token. But "${TOKENS.join(' ')}" carries several relationships at once — word order, subject-ness, adjacency — and one softmax cannot express them all. For instance, "${TOKENS[2]}" needs to attend to its predecessor "${TOKENS[1]}" (${pct(HEAD1[2][1])}) AND to the noun (${pct(HEAD2[2][1])}). The fix: run SEVERAL attentions in parallel, each with its own Wq/Wk/Wv. Each copy is a HEAD.`,
  };

  if (view !== 'head 2 only') {
    const h1Details = TOKENS.map((t, i) => {
      const maxJ = HEAD1[i].indexOf(Math.max(...HEAD1[i]));
      return `"${t}" → "${TOKENS[maxJ]}" ${pct(HEAD1[i][maxJ])}`;
    });

    yield {
      state: matrixState({ title: 'Head 1: a positional specialist', rows, columns: cols, values: HEAD1, format: pct }),
      highlight: { active: ['q2:k1', 'q3:k2'] },
      explanation: `Head 1 learned a POSITIONAL habit — each token attends to its predecessor. Strongest weights: ${h1Details.join('; ')}. Row sums: ${TOKENS.map((t, i) => `"${t}" = ${r2(HEAD1[i].reduce((a, b) => a + b, 0))}`).join(', ')}. Heads like this (previous-token heads, induction heads) really exist in trained models and help copy/continue sequences.`,
      invariant: `Each row sums to 100%: ${TOKENS.map((t, i) => `"${t}" ${pct(HEAD1[i].reduce((a, b) => a + b, 0))}`).join(', ')}.`,
    };
  }

  if (view !== 'head 1 only') {
    const h2Details = TOKENS.map((t, i) => {
      const maxJ = HEAD2[i].indexOf(Math.max(...HEAD2[i]));
      return `"${t}" → "${TOKENS[maxJ]}" ${pct(HEAD2[i][maxJ])}`;
    });

    yield {
      state: matrixState({ title: 'Head 2: a semantic specialist', rows, columns: cols, values: HEAD2, format: pct }),
      highlight: { active: ['q0:k1', 'q2:k1', 'q3:k1'] },
      explanation: `Head 2, SAME tokens, completely different pattern: every row pours attention onto "${TOKENS[1]}" — the noun. Weights: ${h2Details.join('; ')}. Compare with head 1: "${TOKENS[2]}" attended ${pct(HEAD1[2][1])} to "${TOKENS[1]}" positionally, but head 2 gives it ${pct(HEAD2[2][1])} semantically. Same input, different learned projections → different relationship extracted.`,
    };
  }

  // --- Per-head value mixing ---
  const out1 = HEAD1.map((w) => [0, 1].map((d) => w.reduce((s, wij, j) => s + wij * V1[j][d], 0)));
  const out2 = HEAD2.map((w) => [0, 1].map((d) => w.reduce((s, wij, j) => s + wij * V2[j][d], 0)));

  yield {
    state: matrixState({
      title: 'Per-head value mixing',
      rows,
      columns: ['h1·d0', 'h1·d1', 'h2·d0', 'h2·d1'].map((label, j) => ({ id: `d${j}`, label })),
      values: TOKENS.map((_, i) => [...out1[i], ...out2[i]]),
    }),
    highlight: { active: ['q2:d0', 'q2:d1'], compare: ['q2:d2', 'q2:d3'] },
    explanation: `Each head multiplies its attention weights by its own value vectors. Head 1 values: ${TOKENS.map((t, i) => `"${t}" V=${showVec(V1[i])}`).join(', ')}. For "${TOKENS[2]}": head 1 output = ${pct(HEAD1[2][0])}×${showVec(V1[0])} + ${pct(HEAD1[2][1])}×${showVec(V1[1])} + ... = ${showVec(out1[2])}. Head 2 output = ${showVec(out2[2])}. The left half encodes "what came before me," the right half "the noun I relate to."`,
  };

  // --- Concatenation ---
  const concat = TOKENS.map((_, i) => [...out1[i], ...out2[i]]);
  const dimCols = ['h1·d0', 'h1·d1', 'h2·d0', 'h2·d1'].map((label, j) => ({ id: `d${j}`, label }));

  yield {
    state: matrixState({ title: 'Concatenate: both heads side by side', rows, columns: dimCols, values: concat }),
    highlight: { active: ['q2:d0', 'q2:d1'], compare: ['q2:d2', 'q2:d3'] },
    explanation: `Concatenate head outputs into one ${TOKENS.length}×4 matrix. Each token’s row: ${TOKENS.map((t, i) => `"${t}" = ${showVec(concat[i])}`).join('; ')}. The first 2 dims carry head 1’s positional signal; the last 2 carry head 2’s semantic signal. A final W_O (4×4) projection blends these slices so downstream layers see one vector encoding both kinds of evidence.`,
  };

  yield {
    state: matrixState({ title: 'Scale: 96 heads × 96 layers', rows, columns: dimCols, values: concat }),
    highlight: {},
    explanation: `GPT-3 runs 96 heads per layer × 96 layers = 9,216 independent attention computations per forward pass. With d_model=12288 and d_k=128 per head, each head’s scoring space is small but the ensemble covers syntax, coreference, induction, and rare-token detection. Our 2-head toy: head 1 captured positional patterns (predecessor ≥ ${pct(Math.min(HEAD1[2][1], HEAD1[3][2]))}), head 2 captured semantic (noun ≥ ${pct(Math.min(HEAD2[0][1], HEAD2[2][1]))}). More heads = more independent relationship detectors at zero extra compute (each head uses d_model/h dims).`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Each frame shows the same tokens passing through separate attention heads. Rows are query tokens, columns are key tokens, and each row is a softmax distribution that sums to 100 percent.',
        'Active cells show which relationship a head is emphasizing for the current token. Found cells show the output slice after that head mixes value vectors.',
        {type: 'callout', text: "Multi-head attention buys independent softmax channels, so different relationships can stay sharp at the same token instead of sharing one probability budget."},
        {type: 'image', src: './assets/gifs/multi-head-attention.gif', alt: 'Animated walkthrough of the multi head attention visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Attention lets a token read information from other tokens. A query vector asks what it needs, key vectors advertise what tokens contain, and value vectors carry the information that gets mixed.',
        'A single attention head gives each token one probability distribution over the sequence. Many language tasks need several relationships at once, such as local order and subject reference.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/8f/The-Transformer-model-architecture.png', alt: "Transformer architecture diagram with multi-head attention blocks in the encoder and decoder", caption: "The Transformer block makes multi-head attention the communication layer before residual normalization and feed-forward work. Source: Wikimedia Commons, Yuening Jia, CC BY-SA 3.0, https://commons.wikimedia.org/wiki/File:The-Transformer-model-architecture.png."},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is one wide attention head. Project tokens to Q, K, and V, compute one score matrix, apply one softmax per row, and mix values once.',
        'That works when one relationship dominates. If translation alignment is the main task for a token, one distribution can carry enough signal.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the softmax budget. If a token needs to put high weight on the previous token and also high weight on a distant subject, one distribution forces those needs to compete.',
        'Making the head wider does not remove the bottleneck. Wider vectors improve the score function, but the result is still one normalized row per query token.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Split the model width into h heads. Each head has its own learned query, key, and value projections and its own softmax distribution.',
        'The heads run in parallel, then their output slices are concatenated and mixed by an output projection. One head can track position while another tracks a noun relation without sharing probability mass.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For input X with shape n by d_model, each head computes Q = XW_Q, K = XW_K, and V = XW_V. With h heads, each head usually has width d_k = d_model / h.',
        'A head computes softmax(QK^T / sqrt(d_k))V, producing an n by d_k output. All head outputs are concatenated back to n by d_model and multiplied by W_O.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Matrix_multiplication_diagram.svg/250px-Matrix_multiplication_diagram.svg.png', alt: "Matrix multiplication diagram showing row and column products", caption: "Packed Q, K, and V projections are matrix multiplications; implementations exploit that regular layout instead of looping over tiny heads. Source: Wikiversity and Wikimedia Commons, CC BY-SA 3.0, https://fr.wikiversity.org/wiki/Matrice/Produit_matriciel."},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is a decomposition argument, not a proof of semantic roles. Each head computes a valid attention mixture over the same sequence, and concatenation preserves each mixture before W_O blends them.',
        'Because the softmaxes are independent, a high weight in one head does not subtract probability from another head. The model can represent several simultaneous communication patterns at one layer.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'With d_model fixed, splitting into heads does not change the leading projection parameter count. The Q, K, V, and output projections are still dense d_model by d_model maps when packed.',
        'The expensive term for long sequences is attention scores: O(n^2 d_model) across all heads. When sequence length doubles, the score matrix area roughly quadruples, which is why long context is costly.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Transformers use multi-head attention in language, vision, audio, and cross-modal models. The access pattern is all-to-all comparison among tokens or patches.',
        'Decoder-only language models use heads at every layer during prefill and generation. Encoder-decoder models also use cross-attention heads so target tokens can read source tokens.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Many heads can be redundant after training. Head count is not a clean measure of capability because several heads may learn overlapping or weak functions.',
        'Attention maps are also incomplete explanations. A map shows where a head read from, but value vectors, output projection, residual stream, layer normalization, and feed-forward layers decide how that read affects the final representation.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use three tokens, d_model = 4, and h = 2, so each head has d_k = 2. Head 1 produces a softmax row for \'sat\' of [0.06, 0.82, 0.12], mostly reading \'cat\' as the previous content token.',
        'Head 2 has its own projections and produces [0.10, 0.75, 0.15] for \'sat\', also reading \'cat\' but through a different score space. The concatenated output for \'sat\' has two numbers from head 1 and two from head 2, so W_O receives both channels rather than one compromised distribution.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Vaswani et al. on the Transformer, Michel et al. on pruning attention heads, and Voita et al. on analyzing head roles. The point is to understand both the mechanism and the redundancy.',
        'Next study Attention Mechanism, Transformer Block, KV Cache, RoPE, and Grouped-Query Attention. Those topics explain the single-head base, the layer wrapper, positional scoring, and inference memory pressure.',
      ],
    },
  ],
};