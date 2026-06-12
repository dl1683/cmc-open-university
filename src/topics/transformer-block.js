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
      heading: 'What it is',
      paragraphs: [
        `A Transformer block is the smallest repeating unit of GPT and modern language models. The "Attention Is All You Need" paper (Vaswani et al., 2017) introduced it as the fundamental architecture, and today it is stacked dozens to hundreds of times to build systems like GPT-3 and GPT-4. Each block takes in token embeddings (tokens×dimensions), applies multihead attention so tokens can exchange information, normalizes residually to stabilize training, feeds each token independently through a nonlinear network, and outputs the same shape. Critically, because the input and output shapes match (tokens×dims), blocks are fully composable—you can nest them 32 times for a small model or 100+ times for a large one.`,
        `The block unifies every major AI concept: Tokenization (BPE) converts text to tokens; Embeddings & Similarity turn tokens into vectors; Attention Mechanism does weighted communication; Residual connections fix vanishing gradients during backprop; LayerNorm keeps numerics stable across depth; the feed-forward network (FFN) processes context per token. The Softmax & Temperature at the very end converts the final block output to probability scores over the vocabulary. No other single unit is more foundational to understanding modern AI.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Step 1 embeds each token as a vector and adds positional information, because raw attention is order-blind. Step 2 runs the Attention Mechanism: queries and keys interact to build "importance weights" (via softmax), then values are mixed by those weights so that each token's vector becomes a blend of every token's signal, weighted by relevance. This is the ONLY place in the block where tokens communicate with each other—context flows through this gate. Step 3 adds the attention output back to the original input (a residual connection) and rescales to mean 0, variance 1 (LayerNorm), which forces gradients to remain well-conditioned even after 100 nested blocks.`,
        `Step 4 routes each token independently through a two-layer feed-forward network (a ReLU nonlinearity sandwiched between two matrix multiplies): this is where roughly two-thirds of the block's parameters live, and it is the layer that Mixture of Experts (MoE) replaces with routed expert networks. Step 5 adds the FFN output back to the post-attention signal, normalizes again, and outputs. The pipeline is deterministic—the exact same block is applied to every token in sequence, making the model embarrassingly parallelizable across tokens at inference time (why KV Cache and Speculative Decoding are so effective).`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Attention is O(n²) in sequence length: Q K^T is a matrix multiply between n×d and d×n, yielding an n×n matrix of attention weights. For a 4000-token sequence and 128-dim embedding, that is 16M comparisons. Repeat across 12 heads and 32 layers, and context gets expensive fast—which is why KV Cache compresses the interaction at decode time and why long-context research focuses on sparse or hierarchical attention. The FFN is O(n×d²): each of n tokens flows through a network with d→4d→d layers. LayerNorm is O(n×d) but adds minimal cost; the real expense is the attention quadratic and the FFN's inner-layer dimension (often 4–8× the embedding dim). Overall, a single transformer block is dominated by these two sublayers, and a 7B-parameter model might spend 60% of compute in attention and 40% in FFN.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Every modern large language model (GPT-3, GPT-4, Claude, Gemini, LLaMA) is built from stacked transformer blocks. Encoder-only models (like BERT) use only blocks without causal masking; decoder-only autoregressive models (like GPT) use blocks where attention only looks backward; encoder-decoder models (like T5) pair them. Vision transformers (ViT) apply the same block to image patches. Multimodal models blend image blocks and text blocks. The block is so fundamental that when practitioners optimize for speed, they optimize the block: quantization reduces precision to 8-bit integers, LoRA Fine-Tuning adds trainable adapters without retraining the whole block, and speculative decoding runs small draft blocks in parallel with large blocks to prefill tokens. The serving stack—KV Cache, Quantization, Speculative Decoding, LoRA—wraps around this one unit and multiplies its throughput.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `Misconception 1: attention is a "search" operation. It is not; it is a weighted aggregation, and every token contributes to every other token's output (with zero weight being a valid contribution). Misconception 2: transformer blocks are the only thing that matters. They are central, but tokenization (BPE) shapes what the model even sees, and Softmax & Temperature shapes what comes out. Misconception 3: stacking blocks is "free"—it is not. Vanishing gradients, loss-of-signal, and training instability were real problems until residuals and LayerNorm solved them (roughly), but no amount of normalization is free; numerical precision does degrade, which is why quantization and mixed-precision training exist. Misconception 4: bigger blocks are always better. Mixture of Experts (MoE) showed that routing tokens to specialized sub-blocks can be more compute-efficient than a monolithic FFN. Misconception 5: the block is "static". Inference optimizations like KV Cache actually change the computation graph in subtle but crucial ways.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `To deepen your understanding: Attention Mechanism covers the multihead math in detail and shows why O(n²) is unavoidable. Neural Network Forward Pass walks the ReLU and matrix multiply that build the FFN. Tokenization (BPE) is the pre-block stage that discretizes text. Softmax & Temperature is the post-block stage that turns logits into probability. KV Cache explains how serving rewrites the block to avoid redundant recomputation. Mixture of Experts (MoE) shows an alternative to the monolithic FFN that can reduce compute while scaling up the model.`,
      ],
    },
  ],
};

