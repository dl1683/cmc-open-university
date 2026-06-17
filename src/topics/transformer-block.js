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
    explanation: 'This frame shows the contract of a Transformer block: a token-by-dimension matrix goes in, the same shape comes out, and the block can be stacked many times. Tokenization creates the rows; the final model head later turns the last rows into next-token probabilities.',
  };

  const X = tokens.map(embed);
  yield {
    state: show(X, 'Input: embeddings + position'),
    highlight: { active: rows.map((r) => r.id) },
    explanation: 'Tokens first become vectors, then a small position signal is mixed in. Attention is order-blind without this signal, so the visible drift down the rows is what lets the block distinguish the same word in different places.',
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
    explanation: 'Attention is the communication step. Queries compare with keys, softmax turns scores into weights, and values are mixed so each row can carry information from other rows. This is the only sublayer where tokens directly exchange context.',
  };

  const res1 = addM(X, attnOut);
  const norm1 = layerNorm(res1);
  yield {
    state: show(norm1, 'Add & Norm: x + attention(x), then LayerNorm'),
    highlight: {},
    explanation: 'The residual addition keeps the original row available instead of replacing it with attention output. LayerNorm then rescales each row, preserving the invariant that deep stacks keep a controlled activation scale.',
    invariant: 'After LayerNorm every token row has mean ≈ 0 and variance ≈ 1.',
  };

  const ffnOut = matMul(relu(matMul(norm1, W1)), W2);
  yield {
    state: show(ffnOut, 'Sublayer 2: feed-forward output'),
    highlight: {},
    explanation: 'The feed-forward network processes each row independently after attention has gathered context. It changes features within a token representation, while the row-to-row information flow has already happened.',
  };

  const out = layerNorm(addM(norm1, ffnOut));
  yield {
    state: show(out, 'Block output: ready for the next block'),
    highlight: { found: rows.map((r) => r.id) },
    explanation: 'The second add-and-normalize step returns the same token-by-dimension shape. That shape invariant is why the next block can consume the output without a special adapter.',
  };

  yield {
    state: show(out, 'attention → add&norm → FFN → add&norm, times 100'),
    highlight: {},
    explanation: 'A language model repeats this block many times, then projects the final vectors to vocabulary scores. Serving work such as KV cache, speculative decoding, quantization, and adapters optimizes this same repeated block rather than changing its basic contract.',
  };
}

export const article = {
  sections: [
    {
      heading: `Why this block exists`,
      paragraphs: [
        `A Transformer block exists because a language model needs two jobs at the same time. Each token must look at other tokens to gather context, and each token must transform its own internal features after that context arrives. A plain feed-forward network can transform features, but it cannot let the word "sat" read information from "cat." A plain attention layer can move information between positions, but it is not enough by itself to build deep, stable representations.`,
        `The block is the repeatable unit that combines those jobs. It accepts a token-by-dimension matrix, applies attention, adds the original signal back, normalizes the result, applies a feed-forward network, adds and normalizes again, and returns the same shape. That same-shape contract is what lets GPT-style models stack dozens or hundreds of blocks without redesigning the interface between layers.`,
      ],
    },
    {
      heading: `The tempting wrong model`,
      paragraphs: [
        `The obvious design is to turn every token into a vector, run one big neural network over the sequence, and hope the network learns the rest. That fails in two ways. If the network treats positions independently, no token can use context from another token. If the network fully mixes every token with every other token through dense layers, the parameter count depends directly on the maximum sequence length, which makes variable-length text awkward and expensive.`,
        `The Transformer block splits the problem. Attention handles token-to-token communication with shared matrices that work for many sequence lengths. The feed-forward sublayer handles per-token feature transformation. Residual paths and normalization make the result trainable at depth. The design is modular rather than one giant undifferentiated operation.`,
      ],
    },
    {
      heading: `The core contract`,
      paragraphs: [
        `The input to the block is a matrix X with one row per token and one column per hidden dimension. The output has the same shape. Inside the block, each row changes because it has absorbed information from other rows and passed through learned feature transforms. Outside the block, the next layer does not need to know how that happened. It only sees another token-by-dimension matrix.`,
        `That contract is the reason the block is a data-structure idea as much as a neural-network idea. The representation has a stable shape, the operations preserve that shape, and the stack can be extended by repeating the same interface. The model becomes a pipeline of compatible state transformations.`,
      ],
    },
    {
      heading: `The attention sublayer`,
      paragraphs: [
        `Attention is the communication step. The block projects X into queries, keys, and values. A query asks what this token wants. A key advertises what another token contains. A value carries the information to mix in if the score is high. Dot products between queries and keys create scores, softmax turns those scores into weights, and the weighted values become the attention output.`,
        `In a decoder model, a causal mask prevents a token from reading future tokens during training and generation. During inference, keys and values for old tokens are stored in a KV cache so the model does not recompute them on every new token. The mathematical sublayer is simple; the serving version becomes a memory-layout and scheduling problem.`,
      ],
    },
    {
      heading: `Residuals and normalization`,
      paragraphs: [
        `A residual connection adds the input of a sublayer back to its output. Instead of replacing X with attention(X), the block uses X plus attention(X). This gives gradients a shorter route through many layers and lets the model refine a representation rather than rebuild it from scratch at every step. If attention is unhelpful for a token, the residual path still carries the old information forward.`,
        `Layer normalization keeps each token row on a controlled scale. Without normalization, small scale errors can grow across deep stacks and make training unstable. Modern decoder models often use pre-norm, where normalization happens before each sublayer, while older descriptions often show post-norm, where normalization follows the residual addition. Both serve the same broad purpose: keep deep repeated blocks numerically usable.`,
      ],
    },
    {
      heading: `The feed-forward sublayer`,
      paragraphs: [
        `After attention has moved context between tokens, the feed-forward network transforms each row independently. It is usually a small multilayer perceptron applied with the same weights at every position. In many LLMs it expands the hidden width, applies a nonlinearity or gated activation, and projects back to the model width. This is where a token's mixed context becomes richer features.`,
        `The feed-forward sublayer is not minor glue. It often contains a large share of the parameters and compute in a Transformer layer. Attention decides what other positions should be consulted. The feed-forward network decides what to do with the resulting representation at each position.`,
      ],
    },
    {
      heading: `What the visual proves`,
      paragraphs: [
        `The visual keeps the same token rows visible across the whole block. That is the proof. Embeddings start as token vectors. Attention changes each row by mixing information from other rows. Add-and-normalize keeps the old signal and stabilizes the scale. The feed-forward step changes features inside each row. The final add-and-normalize returns a matrix with the same shape as the input.`,
        `The important distinction is row communication versus row transformation. Attention is the only sublayer in this toy block where rows directly exchange information. The feed-forward network is row-local. Once you can see that split, many Transformer variations become easier to classify: they either change how tokens communicate, how rows are transformed, or how the repeated stack is stabilized.`,
      ],
    },
    {
      heading: `Costs and tradeoffs`,
      paragraphs: [
        `For sequence length n and model width d, attention prefill costs about O(n^2 d) because every token can score every other token. The feed-forward network costs about O(n d d_ff), where d_ff is often several times wider than d. At short context lengths, dense projections and the feed-forward layer may dominate. At long context lengths, the quadratic attention term and KV cache memory become central.`,
        `The block also has training cost that is easy to miss. Optimizer state multiplies parameter memory. Activations must be saved or recomputed for backpropagation. LayerNorm and residual additions look cheap in arithmetic, but they touch memory and can affect latency. Production systems therefore optimize the block with fused kernels, quantization, attention kernels, tensor parallelism, and cache-aware scheduling rather than only changing the high-level formula.`,
      ],
    },
    {
      heading: `Where it wins`,
      paragraphs: [
        `Transformer blocks win when the task benefits from flexible context. Language needs pronouns, syntax, topic, style, and long-range dependencies. Code needs variable names, scopes, imports, and tests. Vision Transformers use patch tokens instead of word tokens. Speech models use audio frames. The same block pattern works because the input is represented as a sequence of vectors and the block learns how positions should influence each other.`,
        `The design also wins operationally because it is regular. Large matrix multiplications map well to GPUs and accelerators. Blocks can be stacked, sharded, quantized, adapted with LoRA, and served with KV caching. Most LLM infrastructure work is about making this repeated block cheaper, faster, or easier to route.`,
      ],
    },
    {
      heading: `Failure modes`,
      paragraphs: [
        `A Transformer block is not symbolic reasoning, a database, or a search engine. Attention is weighted aggregation over learned vectors. It can retrieve a useful signal from context, but it does not prove facts or enforce program semantics by itself. The feed-forward layer can store and transform patterns, but it is still a learned function with finite capacity and training bias.`,
        `More blocks are not free. Extra depth raises latency, memory, optimizer state, and data requirements. Poor initialization, bad learning rates, small numerical precision margins, or weak normalization choices can still destabilize training. During serving, long contexts can exhaust KV memory even when the weights fit. The block is powerful because it is reusable, not because it removes engineering limits.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Tokenization (BPE), Embeddings & Similarity, Attention Mechanism, and Multi-Head Attention first. Then read BatchNorm & LayerNorm for the stabilizers, Neural Network Forward Pass for the feed-forward sublayer, Softmax & Temperature for the final distribution, and KV Cache for the serving path. Transformer Layer FLOPs Cost Model, Transformer Inference Roofline, Prefix Caching & RadixAttention, and Grouped-Query Attention show how this same block becomes a production systems problem.`,
      ],
    },
  ],
};
