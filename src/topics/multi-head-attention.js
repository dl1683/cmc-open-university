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
  const view = String(input.view);
  if (!['both heads', 'head 1 only', 'head 2 only'].includes(view)) throw new InputError('Pick a view.');

  yield {
    state: matrixState({ title: 'One head = one pattern = one kind of relationship', rows, columns: cols, values: HEAD1, format: pct }),
    highlight: {},
    explanation: 'The Attention Mechanism produces ONE pattern: one matrix of who-looks-at-whom. But "the cat sat here" carries several relationships at once — word order, subject-ness, adjacency — and a single softmax can only express one mixture. The fix is almost comically direct: run SEVERAL attentions in parallel, each with its own learned Wq/Wk/Wv, and let each specialize. Each parallel copy is called a HEAD.',
  };

  if (view !== 'head 2 only') {
    yield {
      state: matrixState({ title: 'Head 1: a positional specialist', rows, columns: cols, values: HEAD1, format: pct }),
      highlight: { active: ['q2:k1', 'q3:k2'] },
      explanation: 'Head 1\'s projections learned a POSITIONAL habit: read the rows — "sat" puts 80% of its attention on "cat", "here" on "sat": almost every token looks at its PREDECESSOR. Heads like this really exist in trained models (they help copy and continue sequences — the famous "induction heads" are their sophisticated cousins).',
      invariant: 'Each head\'s rows are a softmax: every row sums to 100%.',
    };
  }

  if (view !== 'head 1 only') {
    yield {
      state: matrixState({ title: 'Head 2: a semantic specialist', rows, columns: cols, values: HEAD2, format: pct }),
      highlight: { active: ['q0:k1', 'q2:k1', 'q3:k1'] },
      explanation: 'Head 2, SAME tokens, completely different worldview: every row pours its attention onto "cat" — this head learned to find the NOUN, the thing the sentence is about. Same input, same mechanism, different learned projections → different relationship extracted. Neither head is wrong; they answer different questions simultaneously.',
    };
  }

  const out1 = HEAD1.map((w) => [0, 1].map((d) => w.reduce((s, wij, j) => s + wij * valueVector(TOKENS[j], 0)[d], 0)));
  const out2 = HEAD2.map((w) => [0, 1].map((d) => w.reduce((s, wij, j) => s + wij * valueVector(TOKENS[j], 1)[d], 0)));
  const concat = TOKENS.map((_, i) => [...out1[i], ...out2[i]]);
  const dimCols = ['h1·d0', 'h1·d1', 'h2·d0', 'h2·d1'].map((label, j) => ({ id: `d${j}`, label }));

  yield {
    state: matrixState({ title: 'Concatenate: each head contributes its slice of the output', rows, columns: dimCols, values: concat }),
    highlight: { active: ['q2:d0', 'q2:d1'], compare: ['q2:d2', 'q2:d3'] },
    explanation: 'Each head computes its weighted mix of (its own) value vectors — real arithmetic on the patterns you just saw — and the outputs are CONCATENATED side by side: head 1 fills the first dimensions, head 2 the rest. Look at "sat"\\u2019s row: its left half encodes "what came before me" (head 1), its right half "the noun I relate to" (head 2). One final learned matrix (W_O) then blends the slices. The accounting trick: each head works in dims/heads dimensions, so 8 heads cost the SAME total compute as one full-width head — diversity is free.',
  };

  yield {
    state: matrixState({ title: 'Scale: 96 heads × 96 layers', rows, columns: dimCols, values: concat }),
    highlight: {},
    explanation: 'GPT-3 runs 96 heads in every one of its 96 layers — nine thousand specialists. Interpretability researchers have found heads that track syntax, coreference ("her" → who?), induction (repeat what followed last time), even rare-token detectors; pruning studies show many heads are redundant (an ensemble\'s redundancy — compare Random Forest). Multi-head is the production form of attention: The Transformer Block you\'ve seen uses exactly this in its first sublayer, served by the KV Cache per head.',
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        "Each frame shows the same four tokens scored under independent attention heads. Rows are query tokens, columns are key tokens, and cell intensity shows attention weight. Every row sums to 100% because each head applies its own softmax.",
        "Head 1's highlights cluster near the diagonal: each token attends to its predecessor (a positional pattern). Head 2's highlights cluster on the 'cat' column: every token attends to the noun (a semantic pattern). The two heads see identical input but extract different relationships because they use different learned projections.",
        "The concatenation frame shows the output vector split into head slices. Left columns carry head 1's positional signal, right columns carry head 2's semantic signal. Compare the highlighted and comparison cells for the same token to see that one row encodes two independent kinds of evidence.",
        {type: 'callout', text: "Multi-head attention buys independent softmax channels, so different relationships can stay sharp at the same token instead of sharing one probability budget."},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        "A single attention head computes one softmax distribution per query token. That one distribution must express every relationship the token needs -- word order, subject agreement, coreference, copying -- as a single weighted average. When 'sat' needs to attend strongly to its predecessor 'cat' for local order AND to a distant noun for agreement, one softmax row cannot cleanly separate the two signals. Weight given to one target is weight taken from the other.",
        "Vaswani et al. (2017) introduced multi-head attention in 'Attention Is All You Need' to remove this bottleneck. Instead of one attention pattern per layer, the model runs h independent attention computations in parallel, each with its own learned W_Q, W_K, W_V projections. Each head is free to specialize in a different type of relationship -- syntax, position, coreference, rare-token detection -- without interfering with the others.",
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/8f/The-Transformer-model-architecture.png', alt: "Transformer architecture diagram with multi-head attention blocks in the encoder and decoder", caption: "The Transformer block makes multi-head attention the communication layer before residual normalization and feed-forward work. Source: Wikimedia Commons, Yuening Jia, CC BY-SA 3.0, https://commons.wikimedia.org/wiki/File:The-Transformer-model-architecture.png."},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        "The obvious approach is a single wide attention head: project tokens to queries, keys, and values in the full d_model-dimensional space, compute one attention matrix, and produce one weighted mixture per token. This works. It captures the single strongest relationship pattern the training signal rewards.",
        "For simple tasks that demand one kind of attention, a single head is enough. Early neural attention mechanisms (Bahdanau et al. 2014) used exactly this: one attention distribution between encoder and decoder, sufficient for short-sequence translation where alignment is the dominant relationship.",
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        "The wall is the softmax bottleneck. A single head applies softmax to one row of compatibility scores, producing one probability distribution over all keys. That distribution is the token's only channel for receiving context. If 'sat' needs 80% attention on 'cat' (predecessor) AND 80% attention on a distant subject noun, the softmax forces a compromise: the two needs compete for the same probability mass.",
        "This is not a capacity problem that wider dimensions can fix. A wider single head has a richer scoring space, but it still produces one normalized row per query. Every relationship -- syntactic, positional, semantic -- feeds into the same softmax and competes. A head that learns syntax cannot simultaneously be a clean positional tracker because the two patterns require different attention peaks, and one softmax can only express one peak pattern per row.",
        "The problem compounds with sequence length and task complexity. In 'The cat that the dog chased sat on the mat,' 'sat' needs to track its subject 'cat' (four tokens back, past an intervening clause), the preceding verb 'chased' (local context), and the prepositional target 'mat' (forward context in bidirectional models). One distribution cannot sharply attend to all three.",
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        "Split the model width into h independent heads, each operating in d_k = d_model/h dimensions. Give each head its own W_Q, W_K, W_V projections and its own softmax. The heads produce separate attention maps, separate value mixtures, and separate output slices. Concatenate the slices and apply one learned output projection W_O to blend them.",
        "Each head owns its own softmax, so head 1 can put 80% of attention on the previous token while head 2 simultaneously puts 80% on the subject noun. These are independent probability distributions that do not compete. The concatenation preserves both signals; W_O then mixes them so downstream layers see one representation carrying evidence from multiple relationship types.",
        "The roles are not hand-coded. They emerge from gradient descent because each head's learned projections make different relationships linearly separable in different subspaces. Interpretability research has found heads that track syntax (dependency arcs), position (attend to predecessor or successor), coreference ('her' attending to its antecedent), induction (repeat what followed last time), and rare-token detection.",
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        "Start with token representations X of shape (n, d_model). For each head h, project: Q_h = X W_Qh, K_h = X W_Kh, V_h = X W_Vh, where each projection matrix is (d_model, d_k). Compute attention: A_h = softmax(Q_h K_h^T / sqrt(d_k)), yielding an (n, n) attention matrix. Multiply: O_h = A_h V_h, producing (n, d_k) output per head.",
        "Concatenate all head outputs: O = [O_1 ; O_2 ; ... ; O_h], shape (n, h * d_k) = (n, d_model). Apply the output projection: result = O W_O, where W_O is (d_model, d_model). The result enters the residual stream -- attention does not replace the token representation, it adds a communication update.",
        "The scaling factor 1/sqrt(d_k) prevents dot products from growing large as d_k increases, which would push softmax into saturation where gradients vanish. This is the same scaling used in single-head attention, applied per head in the smaller d_k space.",
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Matrix_multiplication_diagram.svg/250px-Matrix_multiplication_diagram.svg.png', alt: "Matrix multiplication diagram showing row and column products", caption: "Packed Q, K, and V projections are matrix multiplications; implementations exploit that regular layout instead of looping over tiny heads. Source: Wikiversity and Wikimedia Commons, CC BY-SA 3.0, https://fr.wikiversity.org/wiki/Matrice/Produit_matriciel."},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        "Multi-head attention works because it gives the model h independent communication channels at the same layer. Before the next layer transforms it, a token representation has already received local-order evidence from one head, syntax evidence from another, copying evidence from a third, and topic evidence from a fourth. Stacking layers compounds this: later heads attend over representations that already contain earlier head mixtures.",
        "The design maps cleanly onto hardware. Implementations pack all h heads' Q, K, V projections into three large matrix multiplications (X W_Q, X W_K, X W_V where each W is d_model by d_model), then reshape the result into (batch, heads, seq, d_k). The architecture says 'many heads,' but the GPU sees large batched matmuls. This is why multi-head attention is practical rather than an elegant but slow loop over tiny modules.",
        "The residual connection is structurally important. The attention output is added to the input, not substituted. This means a head that learns nothing useful passes near-zero through W_O and does not damage the representation. The residual stream lets heads specialize without risk: a head's contribution is additive, so a weak head is harmless and a strong head is immediately useful.",
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        "With d_model fixed, multi-head attention costs the same as single-head attention with the same width. Each head computes an (n, n) attention matrix costing O(n^2 d_k) and a value mix costing O(n d_k^2). Summed over h heads: h * n^2 * d_k = n^2 * d_model for scores, and h * n * d_k^2 for value mixing. The projections (Q, K, V, O) cost O(n d_model^2). The n^2 term dominates for long sequences; the d_model^2 term dominates for short ones.",
        "Doubling the number of heads (with d_model fixed) halves d_k per head. The total parameter count stays the same: h projection matrices of size (d_model, d_k) equals one matrix of size (d_model, d_model). The total FLOP count stays the same. What changes is the expressiveness tradeoff: more heads means more independent attention patterns but each head's scoring space is narrower. GPT-3 uses 96 heads with d_k = 128; smaller models use 8-16 heads.",
        "Serving cost is dominated by memory bandwidth, not compute. During autoregressive decoding, the model reads cached keys and values for every head at every layer at every token. More K/V heads means more bytes per generated token. Grouped-query attention (GQA) addresses this by sharing fewer K/V heads across many query heads, cutting cache size while preserving query-side expressiveness.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        "Sentence: ['the', 'cat', 'sat']. d_model = 4, h = 2, so d_k = 2. Each token starts as a 4D embedding vector.",
        "Head 1 projects all 3 tokens through W_Q1, W_K1, W_V1 (each 4x2), producing Q_1, K_1, V_1 of shape (3, 2). Compute scores = Q_1 K_1^T / sqrt(2), a 3x3 matrix. After softmax, suppose 'sat' puts weight [0.06, 0.82, 0.12] -- 82% on 'cat', its predecessor. This head learned a positional habit. Multiply by V_1 to get a (3, 2) output where 'sat' mostly carries 'cat's value vector.",
        "Head 2 uses its own W_Q2, W_K2, W_V2. After softmax, suppose 'sat' puts weight [0.10, 0.75, 0.15] -- 75% on 'cat' again, but for a different reason: this head finds the subject noun regardless of position. 'the' also puts 74% on 'cat'. Same token, same 75% peak, but different learned projections driving it -- positional proximity vs. semantic role.",
        "Concatenate: each token gets a 4D vector. 'sat' = [head1_d0, head1_d1, head2_d0, head2_d1]. The left half encodes 'what came before me'; the right half encodes 'the noun I relate to.' Apply W_O (4x4) to blend the slices into one representation. Before W_O, each head's contribution is cleanly separated; after W_O, downstream layers see one vector carrying both kinds of evidence.",
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        "Language models (GPT, Llama, Claude) run multi-head attention at every layer. GPT-3 uses 96 heads across 96 layers -- over nine thousand independent attention computations per forward pass. Interpretability researchers (Olsson et al. 2022) have cataloged head types: induction heads that copy patterns, previous-token heads, syntax heads that track dependency arcs, and rare-token detectors.",
        "Vision Transformers (ViT, Dosovitskiy et al. 2020) apply multi-head attention over image patches. Different heads learn to attend to different spatial relationships: local texture, global shape, color consistency. Audio models (Whisper) use heads over time-frequency features for speech recognition.",
        "The pattern extends beyond Transformers. Cross-attention in encoder-decoder models uses multi-head attention between two sequences (source and target). Perceiver IO uses it between a latent array and arbitrary input modalities. Any architecture that needs to compare elements of a sequence benefits from multiple independent comparison channels.",
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        "Many heads are redundant. Michel et al. (2019, 'Are Sixteen Heads Really Better than One?') showed that in trained Transformers, many heads can be pruned after training with negligible loss increase. Voita et al. (2019) found that only a small fraction of heads perform identifiable specialized roles; the rest are ensemble redundancy. This is not waste -- it resembles Random Forest redundancy, providing robustness -- but it means head count is not a direct measure of model capability.",
        "Head pruning works precisely because of this redundancy. If each head captured a unique, critical relationship, removing any head would be catastrophic. The fact that it is not tells us that heads over-provision: the model trains more heads than it strictly needs, and gradient descent distributes similar functions across several heads as insurance.",
        "Attention maps are also misleading as explanations. A head's attention pattern shows where it read from, not what the model computed. The value vectors, output projection W_O, residual stream, layer normalization, and feed-forward sublayer all transform the signal before it affects the output. Treating a single attention heatmap as 'the model's reasoning' ignores most of the computation.",
        "Multi-head attention does not solve long-range reasoning by itself. The O(n^2) cost per layer makes very long contexts expensive. Position encoding quality, KV cache memory, training data, and the full network depth all constrain what the model can actually use from distant context.",
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        "Vaswani et al. 2017 ('Attention Is All You Need') introduced multi-head attention as part of the Transformer architecture. Michel et al. 2019 ('Are Sixteen Heads Really Better than One?') demonstrated that many heads can be pruned post-training, revealing that head count provides ensemble redundancy rather than strict necessity. Voita et al. 2019 ('Analyzing Multi-Head Self-Attention') showed heads specialize into distinct roles -- positional, syntactic, rare-token -- and only a few are critical per layer.",
        "Prerequisite: Attention Mechanism -- single-head Q/K/V attention is the atomic building block; multi-head attention is h parallel copies of it. Natural extensions: The Transformer Block, where multi-head attention is the first sublayer inside a residual-normalize-feedforward stack. KV Cache, the memory structure that stores past keys and values per head during inference. RoPE (Rotary Embeddings), the position-encoding method that operates inside each head's query-key space. Contrasting alternative: Grouped-Query Attention, which shares K/V heads across query heads to cut cache size while preserving multi-head expressiveness.",
      ],
    },
  ],
};
