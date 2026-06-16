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
  const tokens = parseWordList(input.text, { min: 2, max: 4 }).map((w) => w.toLowerCase());
  const dims = Array.from({ length: D }, (_, j) => ({ id: `d${j}`, label: `d${j}` }));
  const rows = tokens.map((t, i) => ({ id: `t${i}`, label: t }));
  const show = (values, title) => matrixState({ title, rows, columns: dims, values });

  yield {
    state: show(tokens.map(embed), 'You are looking at the inside of a GPT'),
    highlight: {},
    explanation: 'Every AI topic on this site has been a component of one machine. This is the machine: a TRANSFORMER BLOCK, walked end-to-end with real arithmetic. GPT-class models are nothing but this block, stacked ~30–100 times, with Tokenization (BPE) at the front door and Softmax & Temperature at the exit.',
  };

  const X = tokens.map(embed);
  yield {
    state: show(X, 'Input: embeddings + position'),
    highlight: { active: rows.map((r) => r.id) },
    explanation: 'Step 1 — tokens become vectors (see Embeddings & Similarity), with a small POSITION signal mixed in (note d0 grows slightly down the rows): attention is order-blind, so word order must be injected into the numbers themselves. Real models use thousands of dimensions; we use 4 so you can read every number.',
  };

  const Q = matMul(X, Wq);
  const K = matMul(X, Wk);
  const V = matMul(X, Wv);
  const scores = Q.map((q) => K.map((k) => dot(q, k) / Math.sqrt(D)));
  const weights = scores.map(softmaxRow);
  const attnOut = matMul(weights, V);
  yield {
    state: show(attnOut, 'Sublayer 1: attention output'),
    highlight: {},
    explanation: 'Step 2 — ATTENTION: queries meet keys, softmax makes weights, values get mixed (the full unfolding is the Attention Mechanism topic). Result: each token\'s vector now contains information from the OTHER tokens — "sat" knows about "cat". This is the only place in the block where tokens communicate.',
  };

  const res1 = addM(X, attnOut);
  const norm1 = layerNorm(res1);
  yield {
    state: show(norm1, 'Add & Norm: x + attention(x), then LayerNorm'),
    highlight: {},
    explanation: 'Step 3 — the unsung heroes. RESIDUAL: the attention output is ADDED to the original input, not substituted — so the original signal always survives, and gradients flow backward through the addition untouched (the fix for vanishing gradients at depth — see Backpropagation). LAYERNORM: each row is rescaled to mean 0, variance 1, keeping a hundred stacked layers numerically sane.',
    invariant: 'After LayerNorm every token row has mean ≈ 0 and variance ≈ 1.',
  };

  const ffnOut = matMul(relu(matMul(norm1, W1)), W2);
  yield {
    state: show(ffnOut, 'Sublayer 2: feed-forward output'),
    highlight: {},
    explanation: 'Step 4 — the FFN: each token, INDEPENDENTLY, through a two-layer network with a ReLU bend (exactly the Neural Network Forward Pass, and the layer that Mixture of Experts (MoE) replaces with routed experts). Attention gathered the context; the FFN now processes it. Two-thirds of a Transformer\'s parameters live here.',
  };

  const out = layerNorm(addM(norm1, ffnOut));
  yield {
    state: show(out, 'Block output: ready for the next block'),
    highlight: { found: rows.map((r) => r.id) },
    explanation: 'Step 5 — add & norm once more, and the block is done: same shape out as in (tokens × dimensions), which is exactly what makes blocks STACKABLE. Each pass enriches every token\'s vector with more context, more abstraction.',
  };

  yield {
    state: show(out, 'attention → add&norm → FFN → add&norm, times 100'),
    highlight: {},
    explanation: 'Now zoom out: stack this block ~32 times (a 7B model) to ~100 (frontier models), put Tokenization (BPE) before block 1, and after the last block project to vocabulary scores and sample with Softmax & Temperature — served fast by the KV Cache, decoded by Speculative Decoding, compressed by Quantization, adapted by LoRA Fine-Tuning. You have now walked every load-bearing idea of the architecture behind modern AI — and each one has its own page here when you want to go deeper.',
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `A Transformer block is the repeating unit inside GPT-style language models, BERT-style encoders, Vision Transformers, and many speech and multimodal systems. Vaswani et al. introduced the original encoder-decoder Transformer in 2017; later GPT models kept the decoder-style block and stacked it deeply. Each block takes a matrix shaped tokens by dimensions, lets tokens communicate through attention, applies a per-token feed-forward network, and returns the same shape so another block can consume it.`,
        `The block is a compact assembly line. Tokenization (BPE) creates token IDs, Embeddings & Similarity maps them into vectors, Attention Mechanism moves information between positions, Multi-Head Attention gives multiple relationship channels, BatchNorm & LayerNorm-style normalization keeps activations usable, and Neural Network Forward Pass explains the feed-forward sublayer. At the very end of the whole model, Softmax & Temperature turns final logits into a next-token distribution. The block itself is not the whole model, but it is the load-bearing unit.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The common decoder block has two sublayers. First, attention forms Q, K, and V, applies a causal mask when generating text, normalizes scores with softmax, and mixes values so each token receives context from earlier tokens. Second, the feed-forward network applies the same small MLP to each token independently, often expanding the hidden width by about 4x before projecting back down. Attention is where tokens communicate; the feed-forward layer is where each token's updated representation is transformed.`,
        `Residual connections wrap both sublayers: x becomes x + sublayer(x). Normalization appears either before each sublayer (pre-norm, common in modern LLMs) or after it (post-norm, used in the original paper). The residual path preserves a clean gradient route through depth, while normalization prevents activation scale from drifting. This is why a 32-layer 7B model or a 96-layer GPT-3-scale model can train at all.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `For sequence length n and model width d, attention prefill is O(n^2 d) and the feed-forward network is O(n d d_ff). With d_ff often near 4d, the FFN holds a large share of parameters, while attention becomes dominant as n grows. A 4,096-token sequence creates 16.8 million query-key scores per head per layer before batching. LayerNorm is O(n d), comparatively small but latency-relevant because it touches memory. During decoding, the KV Cache removes repeated K/V projection work for old tokens, yet every new token still attends over the cached context.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `The same block pattern appears across model families. BERT uses bidirectional encoder blocks for understanding tasks. GPT and Llama use causal decoder blocks for next-token prediction. T5 uses encoder and decoder stacks. Vision Transformer splits an image into patches and sends patch embeddings through blocks. Whisper-like speech models use Transformer blocks over audio features. The surrounding training objective changes, but the repeated unit remains recognizable: attention, residual path, normalization, feed-forward network, residual path, normalization.`,
        `Production optimization also targets this block. Kernel fusion reduces memory traffic around normalization and projections. Quantized weights reduce bandwidth. Low-rank adapters add small trainable matrices beside the frozen block. Serving systems batch many users through the same block while carefully paging each user's KV cache.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `A block is not a brain cell, a database row, or a search engine. It is a differentiable function with learned matrices. Attention is weighted aggregation, not symbolic retrieval. The FFN is not optional glue; in many language models it contains most parameters. Normalization does not magically solve all depth problems; poor initialization, bad learning rates, and numerical precision can still destabilize training. And "more blocks" is not free: latency, memory, optimizer state, and data requirements all rise with depth.`,
        `Another misconception is that inference runs the same graph as training. The math is equivalent, but serving a causal decoder uses cached keys and values, paged memory, batched requests, and sometimes different precision. Those engineering choices change speed and memory without changing the learned weights.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Attention Mechanism and Multi-Head Attention for the communication sublayer. Use Neural Network Forward Pass for the per-token FFN. Read BatchNorm & LayerNorm to understand why modern blocks prefer layer-style normalization over batch statistics. Then read KV Cache to see why decoding speed is mostly an inference-systems problem. FNet Fourier Token Mixing Case Study shows how the block changes when attention is replaced by a fixed Fourier sublayer. Perceiver IO Latent Array Bottleneck shows how transformer blocks can operate over a fixed latent memory instead of the full raw input. Finally, revisit Softmax & Temperature, because the model's last block is only useful after logits become a distribution.`,
      ],
    },
  ],
};
