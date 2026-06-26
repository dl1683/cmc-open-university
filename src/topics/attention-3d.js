// Attention as TERRAIN: the weight matrix for one sentence rendered as a
// 3D landscape — a locality ridge along the diagonal, a coreference
// mountain where "it" finds "cat", and the causal mask as a sheer cliff.

import { surface3dState, InputError } from '../core/state.js';

export const topic = {
  id: 'attention-3d',
  title: 'Attention as a 3D Landscape',
  category: 'AI & ML',
  summary: 'One sentence\'s attention matrix as WebGL terrain: the diagonal ridge, the "it"→"cat" mountain, the causal cliff.',
  controls: [
    { id: 'view', label: 'Survey', type: 'select', options: ['the content head', 'the positional head'], defaultValue: 'the content head' },
  ],
  run,
};

// "The cat sat on the mat because it ..." — 8 tokens, causal attention.
const TOKENS = ['The', 'cat', 'sat', 'on', 'the', 'mat', 'because', 'it'];
// A content head: meaning-driven. Row q = where query token q looks.
const CONTENT = [
  [1.00, 0, 0, 0, 0, 0, 0, 0],
  [0.35, 0.65, 0, 0, 0, 0, 0, 0],
  [0.10, 0.55, 0.35, 0, 0, 0, 0, 0],
  [0.05, 0.15, 0.50, 0.30, 0, 0, 0, 0],
  [0.10, 0.10, 0.15, 0.35, 0.30, 0, 0, 0],
  [0.05, 0.15, 0.10, 0.25, 0.20, 0.25, 0, 0],
  [0.05, 0.10, 0.20, 0.05, 0.05, 0.25, 0.30, 0],
  [0.04, 0.62, 0.06, 0.02, 0.02, 0.12, 0.05, 0.07],
];
// A positional head: structure-driven — look at the previous token.
const POSITIONAL = TOKENS.map((_, q) =>
  TOKENS.map((_, k) => {
    if (k > q) return 0;
    if (q === 0) return 1;
    if (k === q - 1) return 0.7;
    if (k === q) return 0.2;
    return 0.1 / q;
  }));

// Bilinear upsample for a smooth surface (token grid stays 8×8 logically).
function upsample(M, factor) {
  const n = M.length;
  const out = [];
  for (let r = 0; r < (n - 1) * factor + 1; r++) {
    const row = [];
    const rf = r / factor;
    const r0 = Math.min(Math.floor(rf), n - 2);
    const tr = rf - r0;
    for (let c = 0; c < (n - 1) * factor + 1; c++) {
      const cf = c / factor;
      const c0 = Math.min(Math.floor(cf), n - 2);
      const tc = cf - c0;
      row.push(
        M[r0][c0] * (1 - tr) * (1 - tc) + M[r0 + 1][c0] * tr * (1 - tc)
        + M[r0][c0 + 1] * (1 - tr) * tc + M[r0 + 1][c0 + 1] * tr * tc,
      );
    }
    out.push(row);
  }
  return out;
}
const AXES = { x: { min: 0, max: 7, label: 'key (looked AT)' }, y: { min: 0, max: 7, label: 'query (looking)' } };
const terrain = (M, markers = []) =>
  surface3dState({ axes: { ...AXES, z: { label: 'attention weight' } }, heights: upsample(M, 4), markers });
const w = (M, q, k) => M[q][k];

function* contentHead() {
  const r2 = (v) => Math.round(v * 100) / 100;
  const pct = (v) => `${Math.round(v * 100)}%`;
  const n = TOKENS.length;
  const totalCells = n * n;
  const causalZeros = CONTENT.reduce((sum, row, q) => sum + row.filter((_, k) => k > q).length, 0);

  yield {
    state: terrain(CONTENT, [{ id: 'peak', x: 1, y: 7, z: w(CONTENT, 7, 1), label: '"it" → "cat"' }]),
    highlight: {},
    explanation: `The sentence: "${TOKENS.join(' ')}…" — ${n} tokens, so the terrain is an ${n}x${n} = ${totalCells}-cell grid. The QUERY axis is the token doing the looking, the KEY axis is the token being looked at, and the HEIGHT at each point is the attention weight. "${TOKENS[0]}" attends 100% to itself (${pct(w(CONTENT, 0, 0))}), while "${TOKENS[7]}" splits attention across ${CONTENT[7].filter((v) => v > 0.01).length} tokens. Multi-Head Attention showed this as a flat heatmap; in 3D the numbers become geography.`,
  };

  const diagWeights = CONTENT.map((row, i) => row[i]);
  const avgDiag = r2(diagWeights.reduce((a, b) => a + b, 0) / diagWeights.length);
  yield {
    state: terrain(CONTENT, [{ id: 'diag', x: 3.5, y: 3.5, z: 0.36, label: 'the locality ridge' }]),
    highlight: { active: ['diag'] },
    explanation: `Landmark 1 — THE RIDGE along the diagonal: self-attention weights are ${diagWeights.map((v, i) => `"${TOKENS[i]}" ${pct(v)}`).join(', ')} — averaging ${pct(avgDiag)}. Locality is the default posture of language, and the ridge is that prior made solid. Notice it is a ridge and not a wall — "sat" leaks ${pct(w(CONTENT, 2, 1))} to "cat" (the verb finding its subject). Flat heatmaps show these as faint cells; in relief, you can see the leakage flow downhill.`,
    invariant: 'Each query row is a probability distribution: the terrain along any query line sums to exactly 1.',
  };

  const itRow = CONTENT[7];
  const itBest = itRow.indexOf(Math.max(...itRow));
  const itSorted = itRow.map((v, k) => ({ token: TOKENS[k], w: v })).filter((e) => e.w > 0.01).sort((a, b) => b.w - a.w);
  yield {
    state: terrain(CONTENT, [{ id: 'peak', x: 1, y: 7, z: w(CONTENT, 7, 1), label: `"it" → "cat": ${r2(w(CONTENT, 7, 1))}` }]),
    highlight: { found: ['peak'] },
    explanation: `Landmark 2 — THE MOUNTAIN: token "it" (row 7) does NOT pile on the diagonal — it leaps ${7 - itBest} tokens back and erupts at "${TOKENS[itBest]}" with weight ${pct(itRow[itBest])}. Full distribution: ${itSorted.map((e) => `"${e.token}" ${pct(e.w)}`).join(', ')}. That single peak is COREFERENCE RESOLUTION: "it" must mean something, and attention fetches the meaning — a learned, content-based lookup that no fixed window or convolution could do.`,
    invariant: 'Attention is content-addressed: a query can summit ANY visible key, regardless of distance.',
  };

  yield {
    state: terrain(CONTENT, [{ id: 'cliff', x: 5.5, y: 2, z: 0.02, label: 'the causal cliff (zeros)' }]),
    highlight: { removed: ['cliff'] },
    explanation: `Landmark 3 — THE CLIFF: ${causalZeros} of ${totalCells} cells (the upper triangle where key > query) are dead flat at zero. That is the CAUSAL MASK — token ${2} ("${TOKENS[2]}") cannot look at token ${5} ("${TOKENS[5]}"), because at generation time "${TOKENS[5]}" does not exist yet. In the 2D heatmap this is a gray triangle; as terrain it is a sheer escarpment. Every autoregressive LLM lives entirely on the landward side of this cliff, one token at a time.`,
    invariant: 'Causal masking zeroes all key > query: the future is geometrically absent, not merely discouraged.',
  };
}

function* positionalHead() {
  const r2 = (v) => Math.round(v * 100) / 100;
  const pct = (v) => `${Math.round(v * 100)}%`;
  const n = TOKENS.length;

  const prevWeights = POSITIONAL.slice(1).map((row, q) => row[q]); // weight on q-1 for each q>=1
  const avgPrev = r2(prevWeights.reduce((a, b) => a + b, 0) / prevWeights.length);
  yield {
    state: terrain(POSITIONAL, [{ id: 'prev', x: 4, y: 5, z: 0.7, label: 'the previous-token ridge' }]),
    highlight: { active: ['prev'] },
    explanation: `Same sentence, DIFFERENT HEAD — and a completely different country. This head puts ${pct(avgPrev)} of attention (on average) on the immediately preceding token: ${TOKENS.slice(1).map((t, i) => `"${t}" -> "${TOKENS[i]}" ${pct(POSITIONAL[i + 1][i])}`).join(', ')}. This is a POSITIONAL head — pure structure, no semantics. Multi-head attention's premise: run many heads in parallel, each free to learn its own geography.`,
    invariant: 'Heads specialize: the same sentence produces independent terrains, one per head, combined downstream.',
  };

  const itPosRow = POSITIONAL[7];
  const itPosPrev = r2(itPosRow[6]);
  const itPosCat = r2(itPosRow[1]);
  const contentItCat = r2(CONTENT[7][1]);
  yield {
    state: terrain(POSITIONAL, [
      { id: 'prev', x: 6, y: 7, z: 0.7, label: `this head: "it" → "because"` },
    ]),
    highlight: { compare: ['prev'] },
    explanation: `Look where THIS head sends "it": dutifully to "because" (position 6), weight ${pct(itPosPrev)} — and "cat" gets only ${pct(itPosCat)}. Compare: the content head gave "it" -> "cat" = ${pct(contentItCat)}. Neither head is wrong; they answer different questions ("what came just before?" vs "what does this refer to?"), and the model's next layer combines both terrains. That division of labor is why ablating single heads often barely dents a model while ablating a head TYPE can cripple it.`,
  };

  const totalCells = n * n;
  const nonZeroCells = POSITIONAL.reduce((sum, row) => sum + row.filter((v) => v > 0).length, 0);
  yield {
    state: terrain(POSITIONAL),
    highlight: {},
    explanation: `Both landscapes were ${n}x${n} — ${totalCells} cells, ${nonZeroCells} nonzero (the causal half), computable by hand. A modern model runs 100,000+ tokens through dozens of layers with dozens of heads each: billions of these terrains per response, each recomputed per token generated (minus what the KV Cache remembers). The geometry you just walked — ridge, mountain, cliff — is the atomic unit of how transformers relate words, repeated at a scale no visualization can hold.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'the content head') yield* contentHead();
  else if (view === 'the positional head') yield* positionalHead();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization renders an 8x8 attention matrix as a 3D terrain. The x-axis is the key position (the token being looked at), the y-axis is the query position (the token doing the looking), and the z-axis (height) is the attention weight between that query-key pair. A tall peak at coordinates (key=1, query=7) means token 7 ("it") puts heavy attention on token 1 ("cat").',
        'Use the dropdown to switch between two attention heads: the content head (meaning-driven, where "it" finds "cat") and the positional head (structure-driven, where each token looks at its predecessor). Watch how the same sentence produces completely different landscapes depending on what the head learned to care about. Each step labels one geographic landmark -- the diagonal ridge, the coreference mountain, or the causal cliff -- and explains what that shape means for how the model moves information.',
        {type: 'image', src: './assets/gifs/attention-3d.gif', alt: 'Animated walkthrough of the attention 3d visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Language models must move information between positions in a sequence. The word "it" in "The cat sat on the mat because it..." is meaningless until the model connects it to "cat," six tokens earlier. The word "closed" in "it closed its eyes" needs the concept of the animal from even further back. These are not fixed-distance relationships; they depend on meaning, and they vary sentence by sentence.',
        'Before attention, models had two strategies: local windows (each token reads nearby tokens) and recurrence (a hidden state vector carries information forward one step at a time). Both work for short-range patterns, but both hit a wall when the needed relationship is long-range and content-dependent. Attention was designed to let any token directly query any other visible token, with the strength of the connection determined by learned content similarity rather than distance.',
        {type: 'callout', text: 'Attention replaces a single compressed past with a direct, weighted lookup over visible token states.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first reasonable idea is a local window. Give each token access to, say, the 5 tokens before it. Stack enough layers and the effective receptive field grows -- layer 1 sees 5 tokens, layer 2 sees 10, and so on. This is the convolutional approach to sequence modeling. It is simple, parallelizable, and works well for patterns that are genuinely local: adjacent words in a sentence usually do relate to each other.',
        'The second reasonable idea is recurrence. Process the sequence left to right, updating a fixed-size hidden state vector at each step. The hidden state is the model\'s memory -- it compresses everything seen so far into a single vector (typically 256 to 4096 floats). LSTMs and GRUs refined this idea with gating mechanisms that selectively remember or forget, and they powered machine translation and language modeling from roughly 2014 to 2017.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Local windows fail on content-dependent long-range links. In "The cat sat on the mat because it...," the token "it" needs "cat" from position 1 -- six tokens back. A window of size 3 cannot reach it. A window of size 8 can, but now every token pays the cost of reading 8 neighbors even when only 1 matters. Worse, the needed distance changes per sentence: "The cat that the dog chased sat on the mat because it..." pushes "cat" even further away. No fixed window size handles all cases without wasting computation on irrelevant tokens.',
        'Recurrence fails on compression. The hidden state is a fixed-width vector, so information about early tokens gets overwritten or blurred as the sequence grows. By the time the model reaches "it" at position 7, the hidden state contains a compressed mix of all 7 previous tokens. The model cannot selectively inspect token 1\'s representation -- it gets whatever the running state retained. In practice, LSTMs struggle with dependencies beyond roughly 50 to 200 tokens despite their gating mechanisms. The bottleneck is architectural: one vector cannot be a high-fidelity address book for an arbitrary number of entries.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Attention is content-addressed lookup. Instead of compressing the past into a single state or limiting access to a fixed window, attention lets each token directly query every visible token by content similarity. The mechanism has three parts. Each token produces a query vector (what am I looking for?), a key vector (what do I contain?), and a value vector (what information should I send if selected?). The query-key dot product measures relevance. Softmax turns the raw scores into a probability distribution. The weighted sum of values produces the output.',
        'The attention matrix is the record of those probabilities. Row i contains the distribution for query token i over all key tokens. Each row sums to 1. In the 3D terrain, height at position (key, query) is the attention weight -- a tall peak means the query token is pulling heavily from that key token. This is not a hand-written rule. The projection matrices (W_Q, W_K, W_V) are learned from data, so the model discovers which content relationships matter.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Transformer%2C_attention_block_diagram.png/250px-Transformer%2C_attention_block_diagram.png', alt: 'Scaled dot-product attention block with query, key, value, mask, softmax, and output.', caption: 'The block diagram follows the same pipeline the 3D view turns into a terrain: score, mask, normalize, then mix values. (Source: Wikimedia Commons)'},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Given n tokens, each represented as a d-dimensional vector, the model multiplies the token matrix X by three learned weight matrices to produce Q = X * W_Q, K = X * W_K, V = X * W_V. Each of Q, K, V has shape (n, d_head) where d_head is the per-head dimension (typically d_model / num_heads, e.g. 768 / 12 = 64). The raw attention scores are S = Q * K^T, a matrix of shape (n, n) where S[i][j] = dot(q_i, k_j). Each score measures how much query i matches key j.',
        'The scores are scaled by dividing by sqrt(d_head). Without scaling, when d_head is large the dot products grow large in magnitude, pushing softmax into regions where gradients nearly vanish. For d_head = 64, the scale factor is sqrt(64) = 8, so a raw dot product of 24 becomes 3.0 before softmax -- safely in the gradient-rich zone.',
        'For autoregressive (causal) models, a mask sets S[i][j] = -infinity whenever j > i. Token i cannot look at future token j because during generation, token j does not exist yet. After masking, softmax is applied row by row: A[i][j] = exp(S[i][j]) / sum_k(exp(S[i][k])). The masked positions get exp(-infinity) = 0, so they receive zero probability mass. The future is not penalized -- it is geometrically absent.',
        'The output is O = A * V, shape (n, d_head). Each row of O is a weighted mix of value vectors, where the weights come from that row of A. Token "it" with 62% weight on "cat" gets an output that is 62% the value vector of "cat" plus smaller contributions from other tokens. Multiple heads run this pipeline in parallel with independent W_Q, W_K, W_V matrices, then concatenate their outputs and project back to d_model.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Attention works because it separates addressing from content. The key vectors define what each token advertises about itself. The query vectors define what each token is searching for. The value vectors define what information actually flows when a match is made. This three-way split lets the model learn to route information flexibly: "it" can learn a query that means "find the nearest noun referent" while "cat" learns a key that means "I am a noun referent." The routing is soft (probabilistic), so the model can hedge between candidates when ambiguity exists.',
        'Multi-head attention multiplies this power. With 12 heads, the model runs 12 independent lookups in parallel. One head can specialize in syntactic adjacency (the positional head in the visualization, where each token attends to its predecessor). Another can specialize in coreference (the content head, where "it" finds "cat"). Others might track subject-verb agreement, copy delimiters, or follow induction patterns. The downstream layer receives all 12 outputs concatenated and can learn which head\'s information matters for the current task. Ablation studies show that removing a single head often has little effect (redundancy protects), but removing an entire head type (all positional heads, for instance) can severely damage performance.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Absolute_positional_encoding.png/250px-Absolute_positional_encoding.png', alt: 'Heatmap-like plot of sinusoidal positional encodings.', caption: 'Positional encoding shows why attention needs extra location signals before the landscape can distinguish order. (Source: Wikimedia Commons)'},
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'For sequence length n and head dimension d, computing Q * K^T costs O(n^2 * d) multiply-adds and produces an n x n score matrix. Storing that matrix costs O(n^2) memory. For our 8-token example, that is 64 scores -- trivial. For n = 128,000 (a modern long-context model), the score matrix alone is 128,000^2 = 16.4 billion entries per head per layer. With 32 heads and 80 layers, a single forward pass touches trillions of attention weights.',
        'When n doubles from 4,096 to 8,192, the attention memory quadruples from ~67 million to ~268 million entries per head. This quadratic scaling is why long-context models are expensive and why engineering effort goes into reducing it. The KV cache stores previously computed key and value vectors so that generating token n+1 only requires computing one new query row against n cached keys, not recomputing the entire n x n matrix. Sparse attention patterns (sliding window, dilated, or block-sparse) reduce the n^2 to O(n * w) where w is the window size, at the cost of losing some long-range connections. Grouped-query attention (GQA) shares key-value heads across multiple query heads, reducing KV cache size by a factor equal to the group size.',
        'Concretely: at float16 precision (2 bytes per value), the KV cache for one layer with d_model = 4096 and sequence length 8192 uses 2 * 4096 * 8192 * 2 bytes = 128 MB. Across 80 layers, that is about 10 GB just for cached keys and values for a single sequence. This is why GPU memory, not compute, is often the binding constraint for long-context inference.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Every modern language model -- GPT, Claude, Gemini, Llama, Mistral -- uses multi-head self-attention as the core information-routing mechanism. The specific patterns differ (some use grouped-query attention, some use sliding window + global tokens), but the fundamental operation is the same: query-key scoring, softmax normalization, value mixing.',
        'Vision transformers (ViT) split an image into patches (typically 16x16 pixels), embed each patch as a token, and apply the same attention mechanism. A patch showing a wheel can attend to a distant patch showing a road, letting the model build object-level understanding without explicit spatial convolution. AlphaFold uses attention between amino acid positions in a protein sequence to learn which residues physically interact in the folded 3D structure -- positions far apart in sequence but close in space produce high attention weights, analogous to the "it"-to-"cat" mountain in language. Speech recognition models (Whisper) use attention between audio frames and text tokens to align sounds with words during transcription.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/The-Transformer-model-architecture.png/250px-The-Transformer-model-architecture.png', alt: 'Original Transformer encoder-decoder architecture diagram.', caption: 'The original Transformer diagram places attention heads inside the full encoder-decoder stack. (Source: Wikimedia Commons)'},
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The quadratic cost is the primary failure. Full self-attention over 1 million tokens requires 10^12 score computations per head per layer. No current hardware makes this practical at training scale without approximation. Sparse attention, linear attention, and state-space models (Mamba, RWKV) all trade some expressiveness for sub-quadratic scaling. Each sacrifices the guarantee that any token can attend to any other token with arbitrary learned weight.',
        'The second failure is interpretability. A high attention weight from "it" to "cat" is evidence that the head routes information along that path, but it is not proof that the model uses that information for its final prediction. The value vector mixed in might be irrelevant to the output logits. The downstream MLP might override it. Attention weights describe information flow within one head at one layer -- not the model\'s reasoning. Rigorous interpretability requires ablation (zero out the head and measure performance change), activation patching (swap activations between clean and corrupted inputs), or probing classifiers on intermediate representations.',
        'A subtler failure: attention has no built-in notion of position. The dot product between query and key is symmetric and permutation-invariant -- swapping token positions does not change the scores unless positional information is injected. This is why transformers need positional encodings (sinusoidal, learned, or rotary). Without them, "the cat sat" and "sat cat the" produce identical attention patterns. The positional encoding image above shows the sinusoidal scheme from the original Transformer paper; modern models use rotary position embeddings (RoPE) that encode relative position directly into the query-key dot product.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Walk through one row of the content-head attention matrix: query token 7 ("it") attending over all 8 tokens. The raw scores (after scaling) might be [-0.5, 3.1, -1.2, -2.0, -1.8, 0.8, -0.3, 0.1] for keys ["The", "cat", "sat", "on", "the", "mat", "because", "it"]. Before softmax, these are just numbers. The causal mask does not zero any position here because all keys 0-7 are at or before query position 7.',
        'Softmax converts these to probabilities: exp(s_j) / sum(exp(s_k)). The largest score (3.1 for "cat") dominates. Computing: exp(-0.5)=0.61, exp(3.1)=22.2, exp(-1.2)=0.30, exp(-2.0)=0.14, exp(-1.8)=0.17, exp(0.8)=2.23, exp(-0.3)=0.74, exp(0.1)=1.10. Sum = 27.49. So attention weights become: "The" 0.02, "cat" 0.81, "sat" 0.01, "on" 0.01, "the" 0.01, "mat" 0.08, "because" 0.03, "it" 0.04. (The visualization uses slightly different final weights -- [0.04, 0.62, 0.06, 0.02, 0.02, 0.12, 0.05, 0.07] -- because the learned projections produce different raw scores, but the mechanism is identical.)',
        'The output vector for "it" is then: 0.04 * v_The + 0.62 * v_cat + 0.06 * v_sat + 0.02 * v_on + 0.02 * v_the + 0.12 * v_mat + 0.05 * v_because + 0.07 * v_it. The dominant term is 0.62 * v_cat: token "it" now carries 62% of "cat"\'s value information. When the next layer processes this output, it has access to what "cat" means -- the coreference is resolved by routing, not by rule.',
        'Now compare the same row in the positional head. This head learned to attend to the immediately preceding token, so "it" (position 7) puts 70% weight on "because" (position 6) and only about 1% on "cat" (position 1). Same sentence, same token, completely different terrain. The content head answers "what does \'it\' refer to?" while the positional head answers "what came just before \'it\'?" The model\'s downstream layers receive both answers and combine them.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The attention mechanism was introduced in Bahdanau et al., "Neural Machine Translation by Jointly Learning to Align and Translate" (2014), and the modern self-attention formulation (scaled dot-product, multi-head) comes from Vaswani et al., "Attention Is All You Need" (2017). The causal masking, positional encoding, and multi-head architecture all originate from that paper.',
        'Study Multi-Head Attention next to see how multiple heads combine -- the terrain you saw here is one head in isolation, and the full picture requires understanding how heads specialize and how their outputs merge. KV Cache explains the production optimization that makes autoregressive attention practical: caching key-value pairs so each new token computes one row instead of the full matrix. The Embedding Space (3D) shows you the vector space where "cat" and "it" live -- attention is the mechanism that exploits proximity in that space. Saliency Maps & Feature Attribution teaches the tools needed to move beyond "the weight is high" toward "the model uses this information for its prediction." For the quadratic cost problem, study sparse attention variants and state-space models as contrasting alternatives that trade expressiveness for efficiency.',
      ],
    },
  ],
};
