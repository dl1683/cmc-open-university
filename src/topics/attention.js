// Scaled dot-product attention — the mechanism at the heart of Transformers
// and every modern LLM — run for real on toy 4-dimensional vectors.
// The numbers are genuinely computed (projections, dot products, softmax);
// only the embeddings are toy stand-ins for what real models learn.

import { matrixState, parseWordList } from '../core/state.js';

export const topic = {
  id: 'attention',
  title: 'Attention Mechanism',
  category: 'AI & ML',
  summary: 'Queries, keys, values, and the softmax heatmap that lets every token look at every other token.',
  controls: [
    { id: 'text', label: 'Tokens (2–5 words)', type: 'text', defaultValue: 'the cat sat here' },
  ],
  run,
};

const D = 4; // embedding dimension — tiny on purpose, so every number is visible

// Fixed "learned" projection matrices. In a real model these weights are
// what training discovers; here they are arbitrary-but-fixed so the demo
// is deterministic and the math is real.
const Wq = [
  [0.9, -0.3, 0.1, 0.4], [0.2, 0.8, -0.5, 0.1],
  [-0.4, 0.3, 0.7, -0.2], [0.1, -0.2, 0.3, 0.9],
];
const Wk = [
  [0.7, 0.2, -0.3, 0.1], [-0.2, 0.9, 0.4, -0.1],
  [0.5, -0.4, 0.8, 0.2], [0.1, 0.3, -0.2, 0.6],
];
const Wv = [
  [0.6, -0.1, 0.2, 0.3], [0.3, 0.7, -0.2, 0.1],
  [-0.1, 0.4, 0.9, -0.3], [0.2, 0.1, -0.4, 0.8],
];

// Deterministic toy embedding: hash the word's characters into D numbers
// in [-1, 1]. Same word in, same vector out — every run is reproducible.
function embed(word) {
  return Array.from({ length: D }, (_, j) => {
    let h = j + 1;
    for (let i = 0; i < word.length; i += 1) {
      h = (h * 31 + word.charCodeAt(i) * (j + 2)) % 1009;
    }
    return (h / 1009) * 2 - 1;
  });
}

const matMul = (A, B) =>
  A.map((row) => B[0].map((_, j) => row.reduce((sum, a, k) => sum + a * B[k][j], 0)));

const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);

function softmax(row) {
  const peak = Math.max(...row);
  const exps = row.map((x) => Math.exp(x - peak));
  const total = exps.reduce((a, b) => a + b, 0);
  return exps.map((x) => x / total);
}

export function* run(input) {
  const words = parseWordList(input.text, { min: 2, max: 5, label: 'words' });
  const tokens = words.map((w) => w.toLowerCase());
  const n = tokens.length;
  const r2 = (v) => Math.round(v * 100) / 100;
  const r4 = (v) => Math.round(v * 10000) / 10000;

  const dims = Array.from({ length: D }, (_, j) => ({ id: `d${j}`, label: `d${j}` }));
  const qRows = tokens.map((t, i) => ({ id: `q${i}`, label: t }));
  const kCols = tokens.map((t, i) => ({ id: `k${i}`, label: t }));
  const pct = (v) => `${Math.round(v * 100)}%`;
  const fmtVec = (v) => `[${v.map(r2).join(', ')}]`;

  const E = tokens.map(embed);
  yield {
    state: matrixState({ title: 'Embeddings E (one row per token)', rows: qRows, columns: dims, values: E }),
    highlight: {},
    explanation: `Step one of any language model: each token becomes a VECTOR of numbers — here ${D} dimensions per token (real models use thousands). "${tokens[0]}" embeds to ${fmtVec(E[0])}${n > 1 ? `, "${tokens[1]}" to ${fmtVec(E[1])}` : ''}. These are toy embeddings, but everything we do with them from now on is the real attention computation.`,
  };

  const Q = matMul(E, Wq);
  const K = matMul(E, Wk);
  const V = matMul(E, Wv);

  yield {
    state: matrixState({ title: 'Queries Q = E·Wq', rows: qRows, columns: dims, values: Q }),
    highlight: {},
    explanation: `Each embedding is multiplied by the learned matrix Wq to make a QUERY — a vector that encodes "what am I looking for?". "${tokens[0]}"'s query is ${fmtVec(Q[0])}. A pronoun might query for its referent; a verb might query for its subject.`,
  };
  yield {
    state: matrixState({ title: 'Keys K = E·Wk', rows: qRows, columns: dims, values: K }),
    highlight: {},
    explanation: `A second matrix Wk makes each token a KEY — "what do I offer?". "${tokens[0]}"'s key is ${fmtVec(K[0])}. A third (Wv) makes VALUES — the actual information a token hands over if attended to. Three different projections of the same embedding, three different roles.`,
  };
  yield {
    state: matrixState({ title: 'Values V = E·Wv', rows: qRows, columns: dims, values: V }),
    highlight: {},
    explanation: `The value matrix V carries the actual payload: if a token is attended to, its value vector is what gets read. "${tokens[0]}"'s value is ${fmtVec(V[0])}${n > 1 ? `, "${tokens[1]}"'s is ${fmtVec(V[1])}` : ''}. Keys decide WHO gets read; values decide WHAT information flows.`,
  };

  const scale = Math.sqrt(D);
  const scores = Q.map((q) => K.map((k) => dot(q, k) / scale));
  yield {
    state: matrixState({ title: 'Scores = Q·Kᵀ / √d', rows: qRows, columns: kCols, values: scores }),
    highlight: {},
    explanation: `Now every query meets every key: score[i][j] = dot(Q_i, K_j) / sqrt(${D}). For example, "${tokens[0]}" vs "${tokens[n > 1 ? 1 : 0]}": raw dot = ${r2(dot(Q[0], K[n > 1 ? 1 : 0]))}, scaled by 1/${r2(scale)} = ${r2(scores[0][n > 1 ? 1 : 0])}. Dividing by sqrt(${D}) = ${r2(scale)} keeps the numbers tame so the next step doesn't saturate. This ${n}x${n} all-pairs table is why attention costs O(n^2) in sequence length.`,
  };

  const weights = scores.map(softmax);
  for (let i = 0; i < n; i += 1) {
    const best = weights[i].indexOf(Math.max(...weights[i]));
    const rawExps = scores[i].map((s) => Math.exp(s - Math.max(...scores[i])));
    const expSum = rawExps.reduce((a, b) => a + b, 0);
    yield {
      state: matrixState({ title: 'Attention weights (softmax per row)', rows: qRows, columns: kCols, values: weights, format: pct }),
      highlight: { active: [`q${i}`], range: kCols.map((c) => `q${i}:${c.id}`) },
      explanation: `Softmax on "${tokens[i]}": exp of scores ${fmtVec(scores[i].map(r2))} gives unnormalized weights summing to ${r2(expSum)}. After normalizing: ${tokens.map((t, j) => `"${t}" ${pct(weights[i][j])}`).join(', ')}. "${tokens[i]}" spends ${pct(weights[i][best])} of its budget on "${tokens[best]}".`,
      invariant: 'Each row of the attention matrix sums to 100%.',
    };
  }

  yield {
    state: matrixState({ title: 'The attention pattern', rows: qRows, columns: kCols, values: weights, format: pct }),
    highlight: {},
    explanation: `This heatmap IS attention — the thing the papers draw. Read it row by row: ${tokens.map((t, i) => { const b = weights[i].indexOf(Math.max(...weights[i])); return `"${t}" focuses on "${tokens[b]}" (${pct(weights[i][b])})`; }).join('; ')}. In a trained model, heads specialize: one tracks syntax, another coreference, another nearby words.`,
  };

  const output = matMul(weights, V);
  yield {
    state: matrixState({ title: 'Output = weights · V', rows: qRows, columns: dims, values: output }),
    highlight: {},
    explanation: `Each token rebuilds itself as a WEIGHTED AVERAGE of everyone's values. "${tokens[0]}"'s output = ${tokens.map((t, j) => `${pct(weights[0][j])}*V("${t}")`).join(' + ')} = ${fmtVec(output[0])}. Information has now flowed between tokens — no loops, no recurrence: just three matrix multiplies and a softmax.`,
  };

  yield {
    state: matrixState({ title: 'The attention pattern', rows: qRows, columns: kCols, values: weights, format: pct }),
    highlight: {},
    explanation: `That single operation — ${n} tokens, ${n * n} scores, ${n} softmax distributions, ${n} output vectors — run with many heads in parallel, stacked dozens of layers deep, with learned weights — is the Transformer ("Attention Is All You Need", 2017), and it is the architecture behind essentially every modern LLM. You just watched the whole trick.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation runs real scaled dot-product attention on 4-dimensional toy vectors. Every number is genuinely computed: matrix projections, dot products, softmax normalization. Only the initial embeddings are toy stand-ins for what a trained model would learn.',
        'The first frames show the embedding matrix E (one row per token, 4 columns for dimensions), then the three projection results: Q (queries), K (keys), and V (values). Each is an n-by-4 matrix produced by multiplying E by a different weight matrix.',
        'The score matrix is n-by-n. Cell (i, j) is the scaled dot product of token i\'s query with token j\'s key. After softmax, each row becomes the attention weights for that token: positive numbers summing to 100%. Active highlights mark which token\'s row is being examined. A bright heatmap cell means high weight; a dark cell means the query and key barely matched.',
        'The final output matrix is n-by-4 again. Each row is a weighted average of all value vectors, using that token\'s attention weights. Information has flowed between tokens through pure matrix arithmetic.',
        {type: 'callout', text: 'Attention is a learned routing table: queries choose addresses, keys compete for selection, and values carry the information that moves.'},
      
        {type: 'image', src: './assets/gifs/attention.gif', alt: 'Animated walkthrough of the attention visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A token often cannot be understood from itself alone. In "the cat sat because it was tired," the word "it" needs information from "cat" to resolve the reference. The model needs a mechanism for one position to read from other positions and mix relevant information into its own representation.',
        'Before attention, the dominant approach was the encoder-decoder RNN (Sutskever et al. 2014). The encoder processed the source sequence token by token and compressed it into a single fixed-length hidden state vector. The decoder then generated the output sequence from that one vector. This architecture worked well for short sentences but created an information bottleneck: a single vector had to carry the meaning of the entire input.',
        'Bahdanau et al. (2015) introduced additive attention to solve this. Instead of forcing the decoder to work from one compressed vector, they let the decoder look back at every encoder hidden state at every output step. The decoder learned a scoring function that decided which encoder positions were relevant for each output word. This was the birth of the attention mechanism: a learned, differentiable way to focus on relevant parts of the input.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The encoder-decoder RNN is the natural first attempt. An encoder RNN reads the source sentence left to right, updating its hidden state at each token. The final hidden state is a fixed-length vector (say 256 or 512 dimensions) that is supposed to summarize the entire input. The decoder RNN then generates the target sequence one token at a time, conditioned on this single vector.',
        'This works. For short sentences (5-15 tokens), the fixed-length vector captures enough information and translation quality is reasonable. The architecture is clean: one pass forward through the encoder, one vector handoff, one pass through the decoder.',
        'The approach is not stupid. Compressing a sequence into a single representation is exactly what we want for tasks like sentence classification. The problem is that translation needs more: the decoder needs to know not just the overall meaning but which specific source words matter for the word it is currently generating.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The fixed-length vector bottleneck breaks on long sequences. A 50-word source sentence must be compressed into the same 512-dimensional vector as a 5-word sentence. Information from early tokens passes through many RNN steps and degrades. Cho et al. (2014) showed that encoder-decoder performance dropped sharply as sentence length increased beyond 20 tokens.',
        'The core failure: the decoder cannot focus on relevant input positions. When generating the French word for "cats," the decoder needs information specifically from the English word "cats," but that information is buried somewhere inside a single vector that also encodes "I," "love," word order, and grammatical structure. The decoder has no way to selectively read from the input.',
        'Increasing the vector dimension helps marginally but does not solve the problem. The issue is not capacity in the abstract but the absence of a routing mechanism. The decoder needs to ask "which input positions matter for the word I am generating right now?" and get a different answer at every step.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each token starts as an embedding vector. Three learned weight matrices (Wq, Wk, Wv) project each embedding into three separate vectors: a query (Q), a key (K), and a value (V). The query encodes "what am I looking for." The key encodes "what do I offer as a match." The value encodes "what information do I hand over if selected."',
        'Scaled dot-product attention computes: Attention(Q, K, V) = softmax(QK^T / sqrt(d_k)) * V. Here is what each piece does. QK^T is a matrix multiply that produces an n-by-n score table. Entry (i, j) is the dot product of token i\'s query with token j\'s key, measuring how well they match. Dividing by sqrt(d_k) (the square root of the key dimension) is the scaling step. Without it, large dimensions produce large dot products, softmax saturates to near-one-hot distributions, and gradients vanish during training.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Transformer%2C_attention_block_diagram.png/250px-Transformer%2C_attention_block_diagram.png', alt: 'Scaled dot-product attention computation block.', caption: 'The diagram matches the article formula: QK transpose produces scores, masking and softmax produce weights, and values form the output. (Source: Wikimedia Commons)'},
        'Softmax is applied row by row. Each row becomes a probability distribution: all entries are positive and sum to 1. Row i is token i\'s attention weight distribution, deciding how much it reads from every other position. Multiplying these weights by V produces the output: each token\'s output is a weighted average of all value vectors, with the attention weights controlling the mix.',
        'Multi-head attention runs h parallel copies of this computation, each with its own Wq, Wk, Wv projection matrices. If the model dimension is d_model = 512 and h = 8, each head works with d_k = d_v = 64 dimensions. Head 1 might learn to attend to syntactic dependencies. Head 2 might track coreference. Head 3 might focus on nearby positions. The h output matrices are concatenated back to d_model dimensions and passed through a final linear projection: MultiHead(Q, K, V) = Concat(head_1, ..., head_h) * W_o.',
        'Masking controls which positions a token can attend to. In autoregressive (causal) generation, token i must not read from any token j > i. The mask sets those score entries to negative infinity before softmax, which drives their weights to zero. Self-attention means Q, K, and V all come from the same sequence. Cross-attention means Q comes from one sequence (typically the decoder) while K and V come from another (typically the encoder).',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Dot products measure similarity in vector space. If the learned projections place a verb\'s query near its subject\'s key, the dot product is large. Softmax converts these raw similarity scores into a probability distribution, creating a smooth, differentiable selection mechanism. The model can learn which pairs should attend to each other through standard gradient descent on the projection matrices.',
        'The sqrt(d_k) scaling keeps the mechanism well-behaved. Without it, the variance of dot products grows proportionally with d_k. For d_k = 64, unscaled dot products can easily reach magnitudes of 8 or more, pushing softmax into regions where gradients are near zero. Scaling by sqrt(64) = 8 keeps the distribution in a range where gradients flow and the model can still learn to sharpen or flatten attention as needed.',
        'Separating keys from values is what makes attention more than a similarity lookup. Keys determine who gets attended to; values determine what information flows. The model can learn "match on syntax, but copy semantic content" because matching and information transfer use different projections of the same embedding.',
        'Multiple heads let the model attend to different things simultaneously. A single attention pattern is one distribution per token. Eight heads give eight independent distributions per token, each potentially capturing a different relationship (position, syntax, semantic role, coreference). This is strictly more expressive than one large head with the same total parameters.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Multiheaded_attention%2C_block_diagram.png/250px-Multiheaded_attention%2C_block_diagram.png', alt: 'Multi-head attention block showing parallel attention heads and concatenation.', caption: 'Multiple heads make the routing mechanism parallel, so one layer can learn several relation types at once. (Source: Wikimedia Commons)'},
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Computing QK^T for n tokens with head dimension d costs O(n^2 * d) operations and produces an n-by-n score matrix requiring O(n^2) memory. For a 4,096-token sequence, that is about 16.8 million entries per head per layer. With 32 heads and 32 layers, total attention entries exceed 17 billion. The quadratic dependence on sequence length is the defining cost constraint of standard attention.',
        'When n doubles, the score matrix quadruples. A 4K context has 16M entries per head; 8K has 67M; 128K has 16 billion. This is why long-context models require architectural changes rather than just more compute.',
        'Memory is often the binding constraint, not FLOPs. During training and prefill, the full n-by-n attention matrix must exist (or be recomputed) for backpropagation. During autoregressive decoding, the KV cache stores all previous keys and values, growing linearly with sequence length, layer count, head count, and head dimension. A single long conversation can exhaust GPU memory even when FLOPs are cheap.',
        'Variants that reduce the quadratic cost include: linear attention (kernel approximations that avoid materializing the n-by-n matrix), sparse attention (attending to a fixed subset of positions), sliding-window attention (restricting the receptive field), and FlashAttention (same O(n^2) math but tiled to avoid materializing the full matrix in slow HBM, achieving O(n) memory). Grouped-query attention and multi-query attention reduce KV cache size by sharing keys and values across heads.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Machine translation was the first showcase. The original Transformer (Vaswani et al. 2017) beat recurrent systems on WMT 2014 English-to-German and English-to-French while training significantly faster, because the all-pairs matrix multiply is highly parallelizable on GPUs whereas recurrence is sequential.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/The-Transformer-model-architecture.png/250px-The-Transformer-model-architecture.png', alt: 'Transformer model architecture from the original paper.', caption: 'The architecture diagram shows how self-attention became the core routing unit inside modern sequence models. (Source: Wikimedia Commons)'},
        'BERT (2018) used bidirectional self-attention for language understanding, achieving state-of-the-art results on 11 NLP benchmarks. GPT (2018-present) used causal self-attention for autoregressive language modeling, scaling to the models that power modern AI assistants. Every large language model in production uses attention as its core information-routing mechanism.',
        'Vision Transformer (ViT, 2020) splits images into patches, treats each patch as a token, and applies the same self-attention mechanism. The approach matched or exceeded convolutional networks on image classification. Whisper uses attention for speech recognition. AlphaFold 2 uses attention (with specialized pair representations) for protein structure prediction. The mechanism transfers wherever the task requires learning which parts of the input are relevant to each other.',
        'The access pattern that makes attention the right choice: the model needs to learn content-dependent routing. Fixed connectivity patterns (convolutions, recurrence) impose a structural prior about which positions interact. Attention lets the data decide.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The O(n^2) quadratic bottleneck is the primary practical limitation. A 100K-token document has 10 billion score entries per head per layer. Approximations are required: FlashAttention for memory efficiency, sparse attention for compute reduction, sliding windows for bounded context. Each approximation trades some expressiveness for tractability.',
        'Attention has no built-in notion of position. "cat sat" and "sat cat" produce identical attention patterns unless positional information is injected. Sinusoidal encodings (Vaswani 2017), learned position embeddings, and Rotary Position Embeddings (RoPE) each add position awareness, but none are free. RoPE extrapolation degrades beyond training length; positional encoding design remains an active research area.',
        'Attention weights are not explanations. A high weight from token A to token B means B\'s value vector influenced A\'s intermediate representation in that head. It does not prove the model\'s final output depends on B. Proper attribution requires analyzing the full network (all heads, all layers, the feed-forward blocks, and the residual stream), not reading one softmax distribution.',
        'Attention is not memory. It reads the current context window. For persistent state, retrieval, or tool use, additional mechanisms must be added outside the attention layer. Calling attention "the model\'s memory" is a common misconception that leads to confusion about what context windows actually provide.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take 3 tokens: ["I", "love", "cats"]. Use d = 4. Suppose after embedding and projection, we have these vectors (numbers simplified for clarity):',
        'Q = [[1.0, 0.5, -0.3, 0.2], [0.3, 0.8, 0.1, -0.4], [-0.2, 0.1, 0.9, 0.6]]. K = [[0.8, 0.3, -0.1, 0.4], [0.1, 0.7, 0.3, -0.2], [-0.3, 0.2, 0.8, 0.5]]. V = [[0.5, 1.0, 0.2, -0.1], [0.8, -0.3, 0.6, 0.4], [0.1, 0.7, -0.2, 0.9]].',
        'Compute scores for token 0 ("I"): q0 dot k0 = (1.0)(0.8) + (0.5)(0.3) + (-0.3)(-0.1) + (0.2)(0.4) = 0.80 + 0.15 + 0.03 + 0.08 = 1.06. q0 dot k1 = (1.0)(0.1) + (0.5)(0.7) + (-0.3)(0.3) + (0.2)(-0.2) = 0.10 + 0.35 - 0.09 - 0.04 = 0.32. q0 dot k2 = (1.0)(-0.3) + (0.5)(0.2) + (-0.3)(0.8) + (0.2)(0.5) = -0.30 + 0.10 - 0.24 + 0.10 = -0.34.',
        'Scale by sqrt(4) = 2: scaled scores = [1.06/2, 0.32/2, -0.34/2] = [0.53, 0.16, -0.17]. Apply softmax: exp(0.53) = 1.70, exp(0.16) = 1.17, exp(-0.17) = 0.84. Sum = 3.71. Weights = [1.70/3.71, 1.17/3.71, 0.84/3.71] = [0.458, 0.316, 0.226].',
        'Compute output for "I": 0.458 * v0 + 0.316 * v1 + 0.226 * v2. Dimension 0: 0.458(0.5) + 0.316(0.8) + 0.226(0.1) = 0.229 + 0.253 + 0.023 = 0.505. Dimension 1: 0.458(1.0) + 0.316(-0.3) + 0.226(0.7) = 0.458 - 0.095 + 0.158 = 0.521. Dimension 2: 0.458(0.2) + 0.316(0.6) + 0.226(-0.2) = 0.092 + 0.190 - 0.045 = 0.237. Dimension 3: 0.458(-0.1) + 0.316(0.4) + 0.226(0.9) = -0.046 + 0.126 + 0.203 = 0.283. Output for "I" = [0.505, 0.521, 0.237, 0.283]. The token "I" is now a blend of all three value vectors, weighted most toward itself (45.8%) and least toward "cats" (22.6%).',
        'Repeat for each token row. The full output matrix has shape 3-by-4: same dimensions as the input, but each token now carries information from every position it attended to.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Bahdanau, Cho, and Bengio, 2015, "Neural Machine Translation by Jointly Learning to Align and Translate." Introduced additive attention for encoder-decoder models. The decoder learns to look back at specific encoder positions instead of working from a single compressed vector.',
        'Vaswani, Shazeer, Parmar, et al., 2017, "Attention Is All You Need." Introduced scaled dot-product attention, multi-head attention, and the Transformer architecture. Dropped recurrence entirely and defined the architecture behind every modern large language model.',
        'Luong, Pham, and Manning, 2015, "Effective Approaches to Attention-based Neural Machine Translation." Compared dot-product (multiplicative) attention with additive attention and introduced global vs. local attention variants.',
        'Study next by role. Foundation: Transformer Block wraps attention with feed-forward layers, residual connections, and normalization into the repeating unit of modern models. Positional Encoding (sinusoidal, learned, or rotary) injects position information that attention lacks by default. Embeddings and Similarity covers the vector representations that attention operates on.',
        'Efficiency: FlashAttention tiles the attention computation to avoid materializing the n-by-n matrix in HBM, achieving O(n) memory. KV Cache stores previously computed keys and values during autoregressive decoding so they do not need to be recomputed at each step. Grouped-Query Attention shares keys and values across heads to reduce cache memory.',
        'Depth: Multi-Head Attention explores how parallel heads specialize. Sliding-Window Attention restricts the receptive field for bounded-context efficiency. Softmax Temperature controls attention sharpness by scaling scores before normalization.',
      ],
    },
  ],
};
