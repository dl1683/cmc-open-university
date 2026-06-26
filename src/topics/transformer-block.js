// The Transformer block, end to end: embed → attend → add & normalize →
// feed-forward → add & normalize. Every AI topic on this site has been
// a piece of this machine. Here is the machine.

import { matrixState, parseWordList } from '../core/state.js';

export const topic = {
  id: 'transformer-block',
  title: 'The Transformer Block',
  category: 'AI & ML',
  summary: 'The full assembly: attention, residuals, layer norm, and the FFN — one complete block of a GPT.',
  controls: [
    { id: 'text', label: 'Tokens (2–4 words)', type: 'text', defaultValue: 'the cat sat' },
  ],
  run,
};

const D = 4;
const Wq = [[0.9, -0.3, 0.1, 0.4], [0.2, 0.8, -0.5, 0.1], [-0.4, 0.3, 0.7, -0.2], [0.1, -0.2, 0.3, 0.9]];
const Wk = [[0.7, 0.2, -0.3, 0.1], [-0.2, 0.9, 0.4, -0.1], [0.5, -0.4, 0.8, 0.2], [0.1, 0.3, -0.2, 0.6]];
const Wv = [[0.6, -0.1, 0.2, 0.3], [0.3, 0.7, -0.2, 0.1], [-0.1, 0.4, 0.9, -0.3], [0.2, 0.1, -0.4, 0.8]];
const W1 = [[0.5, -0.6, 0.8, 0.2], [0.4, 0.9, -0.3, -0.5], [-0.2, 0.3, 0.6, 0.7], [0.8, -0.1, 0.2, -0.4]];
const W2 = [[0.3, 0.5, -0.2, 0.4], [-0.6, 0.2, 0.7, 0.1], [0.4, -0.3, 0.1, 0.6], [0.2, 0.8, -0.5, -0.1]];

function embed(word, position) {
  return Array.from({ length: D }, (_, j) => {
    let h = j + 1;
    for (let i = 0; i < word.length; i += 1) h = (h * 31 + word.charCodeAt(i) * (j + 2)) % 1009;
    return (h / 1009) * 2 - 1 + position * 0.05 * (j === 0 ? 1 : 0);
  });
}

const matMul = (A, B) => A.map((row) => B[0].map((_, j) => row.reduce((s, a, k) => s + a * B[k][j], 0)));
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const softmaxRow = (row) => {
  const m = Math.max(...row);
  const e = row.map((x) => Math.exp(x - m));
  const t = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / t);
};
const addM = (A, B) => A.map((row, i) => row.map((v, j) => v + B[i][j]));
const layerNorm = (A) => A.map((row) => {
  const mean = row.reduce((a, b) => a + b, 0) / row.length;
  const variance = row.reduce((a, b) => a + (b - mean) ** 2, 0) / row.length;
  const sd = Math.sqrt(variance + 1e-5);
  return row.map((v) => (v - mean) / sd);
});
const relu = (A) => A.map((row) => row.map((v) => Math.max(0, v)));

export function* run(input) {
  const r2 = (v) => Math.round(v * 100) / 100;
  const tokens = parseWordList(input.text, { min: 2, max: 4 }).map((w) => w.toLowerCase());
  const dims = Array.from({ length: D }, (_, j) => ({ id: `d${j}`, label: `d${j}` }));
  const rows = tokens.map((t, i) => ({ id: `t${i}`, label: t }));
  const show = (values, title) => matrixState({ title, rows, columns: dims, values });
  const showVec = (vec) => `[${vec.map(r2).join(', ')}]`;

  const X = tokens.map((t, i) => embed(t, i));

  yield {
    state: show(X, 'Input: embeddings + position'),
    highlight: { active: rows.map((r) => r.id) },
    explanation: `Each token becomes a ${D}-dimensional vector. ${tokens.map((t, i) => `"${t}" → ${showVec(X[i])}`).join('; ')}. Position 0 gets a +0.00 offset in d0, position 1 gets +0.05, etc. That d0 drift is the only way the block knows word order — attention is permutation-blind without it.`,
  };

  // --- Q, K, V projections ---
  const Q = matMul(X, Wq);
  const K = matMul(X, Wk);
  const V = matMul(X, Wv);

  yield {
    state: show(Q, 'Projections: Q = X·Wq'),
    highlight: { active: rows.map((r) => r.id) },
    explanation: `Three learned weight matrices (Wq, Wk, Wv) project every token into query, key, and value spaces. For "${tokens[0]}": Q=${showVec(Q[0])}, K=${showVec(K[0])}, V=${showVec(V[0])}. Queries ask "what am I looking for?", keys answer "what do I contain?", and values carry the actual payload to mix.`,
  };

  // --- Attention scores (raw dot products) ---
  const scores = Q.map((q) => K.map((k) => dot(q, k) / Math.sqrt(D)));

  const scorePairs = [];
  for (let i = 0; i < tokens.length; i++) {
    const maxJ = scores[i].indexOf(Math.max(...scores[i]));
    scorePairs.push(`"${tokens[i]}"·"${tokens[maxJ]}" = ${r2(scores[i][maxJ])}`);
  }

  yield {
    state: show(scores, 'Attention scores: Q·Kᵀ / √' + D),
    highlight: {},
    explanation: `Each query dot-products every key, divided by √${D} = ${r2(Math.sqrt(D))} to prevent saturation. Strongest raw scores: ${scorePairs.join('; ')}. These are logits — not yet probabilities. Softmax next converts them so each row sums to 1.`,
  };

  // --- Softmax weights ---
  const weights = scores.map(softmaxRow);

  const weightDetails = tokens.map((t, i) => {
    const maxJ = weights[i].indexOf(Math.max(...weights[i]));
    return `"${t}" → "${tokens[maxJ]}" ${Math.round(weights[i][maxJ] * 100)}%`;
  });

  yield {
    state: show(weights, 'Softmax attention weights'),
    highlight: {},
    explanation: `Softmax turns scores into a probability distribution per row. Strongest attention: ${weightDetails.join('; ')}. These weights decide how much each token reads from every other token's value vector. A 50% weight means half the value payload is copied.`,
    invariant: `Each row sums to 1.00: ${tokens.map((t, i) => `"${t}" → ${r2(weights[i].reduce((a, b) => a + b, 0))}`).join(', ')}.`,
  };

  // --- Attention output ---
  const attnOut = matMul(weights, V);

  yield {
    state: show(attnOut, 'Attention output: weights × V'),
    highlight: {},
    explanation: `Multiply attention weights by value vectors to produce the context-mixed output. "${tokens[0]}" output = ${showVec(attnOut[0])} (a weighted blend of all tokens' V vectors). This is the ONLY step where tokens exchange information — the rest of the block is per-row.`,
  };

  // --- Residual + LayerNorm ---
  const res1 = addM(X, attnOut);
  const norm1 = layerNorm(res1);

  const normStats = tokens.map((t, i) => {
    const row = res1[i];
    const mean = row.reduce((a, b) => a + b, 0) / row.length;
    const variance = row.reduce((a, b) => a + (b - mean) ** 2, 0) / row.length;
    return `"${t}": mean=${r2(mean)}, var=${r2(variance)}`;
  });

  yield {
    state: show(norm1, 'Add & Norm: x + attention(x), then LayerNorm'),
    highlight: {},
    explanation: `Residual addition keeps the original embedding: res = X + attn(X). For "${tokens[0]}": ${showVec(X[0])} + ${showVec(attnOut[0])} = ${showVec(res1[0])}. LayerNorm then centers and scales each row. Pre-norm stats: ${normStats.join('; ')}. After norm, "${tokens[0]}" → ${showVec(norm1[0])} (mean ≈ 0, var ≈ 1).`,
    invariant: 'After LayerNorm every token row has mean ≈ 0 and variance ≈ 1.',
  };

  // --- FFN ---
  const ffnHidden = matMul(norm1, W1);
  const ffnRelu = relu(ffnHidden);
  const ffnOut = matMul(ffnRelu, W2);

  const reluCounts = tokens.map((t, i) => {
    const alive = ffnRelu[i].filter((v) => v > 0).length;
    return `"${t}": ${alive}/${D} neurons alive`;
  });

  yield {
    state: show(ffnOut, 'Sublayer 2: FFN = ReLU(x·W1) · W2'),
    highlight: {},
    explanation: `The feed-forward network transforms each row independently. First, expand through W1: "${tokens[0]}" hidden = ${showVec(ffnHidden[0])}. ReLU zeros negatives: ${showVec(ffnRelu[0])} (${reluCounts.join('; ')}). Then compress through W2: output = ${showVec(ffnOut[0])}. Attention gathered context; the FFN now rewrites each token's features using that context.`,
  };

  // --- Final residual + LayerNorm ---
  const res2 = addM(norm1, ffnOut);
  const out = layerNorm(res2);

  const outStats = tokens.map((t, i) => {
    const row = res2[i];
    const mean = row.reduce((a, b) => a + b, 0) / row.length;
    const variance = row.reduce((a, b) => a + (b - mean) ** 2, 0) / row.length;
    return `"${t}": mean=${r2(mean)}, var=${r2(variance)}`;
  });

  yield {
    state: show(out, 'Block output: second add & norm'),
    highlight: { found: rows.map((r) => r.id) },
    explanation: `Second residual adds FFN output to the pre-FFN representation, then LayerNorm stabilizes again. Pre-norm stats: ${outStats.join('; ')}. Final output for "${tokens[0]}": ${showVec(out[0])}. Same ${tokens.length}×${D} shape in, same shape out — that contract lets blocks stack.`,
  };

  yield {
    state: show(out, 'Stack this block 100 times → a language model'),
    highlight: {},
    explanation: `Each block rewrites the ${tokens.length}×${D} matrix without changing its shape. A real model (GPT-3: 96 blocks, d=12288, 96 heads) repeats this exact sequence — project Q/K/V, attend, add & norm, FFN, add & norm — then a final linear layer maps the last token's vector to vocabulary logits for next-token prediction. KV caching, Flash Attention, and quantization optimize this loop; they never change the contract.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Each frame shows a token-by-dimension matrix. A token is one input piece, such as a word fragment, and a dimension is one learned feature slot in the vector for that token.',
        'Attention is the only frame where token rows exchange information. The feed-forward network changes each row independently, and residual connections add the old row back so the block can refine rather than replace the representation.',
        {type: 'callout', text: 'A Transformer block is shape preserving: it changes what each token row knows, but it returns the same token-by-dimension rectangle so the next block can reuse the exact contract.'},
        {type: 'image', src: './assets/gifs/transformer-block.gif', alt: 'Animated walkthrough of the transformer block visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Older sequence models processed tokens mostly one at a time, so long sentences created long dependency chains. GPUs are good at large parallel matrix operations, but recurrence forces later positions to wait for earlier positions.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/The-Transformer-model-architecture.png/250px-The-Transformer-model-architecture.png', alt: 'Transformer encoder-decoder architecture diagram.', caption: 'The original architecture diagram makes the repeated block structure concrete: attention, feed-forward layers, residual paths, and normalization stack into one sequence model. Source: Wikimedia Commons, Llion Jones, CC BY 4.0.'},
        'A Transformer block exists to let every token read every other token in parallel, then rewrite its own features. Stacking the same shape-preserving block turns local token vectors into context-aware representations.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is an RNN or LSTM encoder that reads tokens in order and carries a hidden state forward. It is simple to understand: the state after token t summarizes everything seen before t.',
        'Attention over RNN states improved quality because the decoder could look back at all positions. The encoder was still serial, so training and long-range credit assignment remained bottlenecked by step-by-step recurrence.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A 512-token recurrent pass has 512 serial state updates. Even if each update is small, token 512 cannot start until token 511 finishes, so parallel hardware sits underused.',
        'The learning path is long too. Information from token 1 reaches token 512 through hundreds of transformations, which makes gradients fragile and long-distance dependencies hard to learn.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Represent the whole sequence as one matrix and let each token compute weighted reads from all token rows. Attention makes distance one layer wide: any row can read any other row directly.',
        'Then keep the matrix shape unchanged. If every block accepts and returns n tokens by d dimensions, a model can stack many blocks without renegotiating the interface.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The block projects input X into queries Q, keys K, and values V. Queries ask what a token wants, keys advertise what each token contains, and values carry the information to mix.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Colored_neural_network.svg/330px-Colored_neural_network.svg.png', alt: 'Layered neural network diagram with colored nodes.', caption: 'The layered network view is simpler than a Transformer, but it helps anchor the same idea: each layer rewrites activations while preserving enough structure for the next layer. Source: Wikimedia Commons, Glosser.ca, CC BY-SA 3.0.'},
        'Scores QK^T are scaled and passed through softmax so each row becomes attention weights that sum to 1. The weighted values are added back through a residual path, normalized, passed through a per-token feed-forward network, added back again, and normalized again.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Attention works because the output for each token is a weighted average of value vectors chosen by similarity between its query and all keys. If a token needs earlier context, the score can route weight there in one layer.',
        'Residual connections protect information flow because a sublayer can add a correction instead of overwriting the old representation. Layer normalization keeps row statistics stable, which makes many stacked blocks trainable.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Self-attention costs O(n^2 * d) per layer because n queries score against n keys and each score uses d-sized vectors. The feed-forward network costs O(n * d * d_ff), often with d_ff about 4d, so dense per-token work dominates at short contexts.',
        'When sequence length doubles, attention scores quadruple. During generation, KV caching avoids recomputing old keys and values, but cache memory grows with layers, heads, width, and context length.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Decoder-only Transformer blocks power GPT-style language models. Encoder blocks power BERT-style bidirectional representations, and encoder-decoder stacks power translation and sequence-to-sequence systems.',
        'The same block pattern appears in vision, speech, protein modeling, code models, and multimodal systems. The input tokens change, but the block still alternates cross-token communication with per-token feature rewriting.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Naive full attention becomes expensive for very long contexts because n^2 score storage and computation grow faster than the text. Long documents, agent traces, and video tokens push this cost into the foreground.',
        'The block also has weak built-in priors. A convolution knows nearby pixels are related; a Transformer must learn locality from data or receive positional and architectural help.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take 3 tokens with d = 4 and 2 heads, so each head uses d_k = 2 dimensions. If the first token has query [0.8, -0.3] and keys [0.8, -0.3], [0.2, 0.7], and [0.6, 0.1], its dot scores are 0.73, -0.05, and 0.45.',
        'Divide by sqrt(2), giving about 0.52, -0.04, and 0.32, then softmax to weights about 0.42, 0.24, and 0.34. The first token output is that weighted mix of value vectors, followed by residual add, layer norm, feed-forward expansion to about 4d, projection back to d, and a final add and norm.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Vaswani et al., Attention Is All You Need, 2017. Also study Bahdanau attention, residual networks from He et al., and layer normalization from Ba et al.',
        'Study multi-head attention, positional encoding, softmax temperature, residual connections, KV cache, FlashAttention, grouped-query attention, BERT, GPT, and T5 next.',
      ],
    },
  ],
};
