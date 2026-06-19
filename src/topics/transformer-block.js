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
      heading: 'How to read the animation',
      paragraphs: [
        'Each frame shows a token-by-dimension matrix. Rows are tokens (“the”, “cat”, “sat”). Columns are hidden dimensions. The matrix enters the block, passes through attention, residual addition, layer normalization, a feed-forward network, another residual addition and normalization, and exits with the same shape. That shape invariant is the contract that lets blocks stack.',
        'Active rows (highlighted) mark the tokens currently being transformed. The attention frame shows the result of row-to-row communication: every token has absorbed a weighted mix of every other token. The feed-forward frame shows row-local transformation: each row changes independently. Found rows at the end confirm the output shape matches the input shape, ready for the next block.',
        'Watch two things across the frames. First, the rows mix during attention but stay separate during the FFN. Second, the residual additions keep the original signal present, so no sublayer can destroy information that a later layer might need.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Before 2017, sequence models meant recurrent neural networks. RNNs read tokens one at a time: the hidden state at position t depends on position t-1. That serial dependency made them slow to train on GPUs (which thrive on parallelism) and fragile over long distances (gradients vanish or explode across hundreds of steps). Attention mechanisms (Bahdanau et al. 2015) helped by letting a decoder look at all encoder states at once, but the encoder itself was still an RNN, still sequential.',
        'Vaswani et al. asked the obvious question: if attention already outperforms the RNN hidden states it reads from, why keep the RNN at all? Their 2017 paper “Attention Is All You Need” replaced recurrence entirely with stacked self-attention layers. The result trained faster, scaled better, and set new records on English-to-German and English-to-French translation. Every large language model since, BERT, GPT, T5, PaLM, Llama, is a stack of the block they described.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural starting point is an RNN encoder-decoder (Sutskever et al. 2014). The encoder reads a source sentence token by token, compressing it into a single fixed-length hidden vector. The decoder unrolls from that vector, generating target tokens one at a time. Each step is a matrix multiply plus a nonlinearity, cheap on its own.',
        'LSTMs (Hochreiter & Schmidhuber 1997) improved this by adding gates that control what information flows through the hidden state, reducing vanishing gradients. Attention over LSTM hidden states (Bahdanau et al. 2015) further improved quality by letting the decoder selectively read from all encoder positions instead of squeezing everything through one bottleneck vector. These were real advances, and they dominated NLP from 2014 to 2017.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The RNN is sequential by definition. Token t cannot be computed until token t-1 finishes. A 512-token sentence requires 512 serial steps during both training and inference. GPUs have thousands of cores, but the RNN uses one core\'s worth of work at each step. Training time scales linearly with sequence length even when hardware could handle the full sequence in parallel.',
        'Attention over RNN hidden states does not fix this. The attention mechanism itself is parallel (every query can score against every key simultaneously), but it still reads from hidden states that were produced serially. The bottleneck is not the attention computation; it is the RNN underneath it. The path length between position 1 and position n is O(n) through the recurrence, degrading gradient flow for long-range dependencies regardless of the attention on top.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The original Transformer has an encoder stack and a decoder stack, each built from identical blocks. The encoder block has two sublayers: multi-head self-attention followed by a position-wise feed-forward network. The decoder block has three sublayers: masked multi-head self-attention, multi-head cross-attention over encoder outputs, and the same feed-forward network. Every sublayer is wrapped in a residual connection and layer normalization.',
        'Multi-head attention is the core mechanism. The input matrix X (shape: n tokens by d_model dimensions) is projected into queries Q = XW_Q, keys K = XW_K, and values V = XW_V. For each head, the projection reduces d_model to d_k = d_model/h. Attention scores are computed as QK^T / sqrt(d_k), then softmax converts scores to weights, and the output is the weighted sum of values. The original paper uses d_model = 512, h = 8 heads, so d_k = d_v = 64. Each head learns a different attention pattern. The 8 head outputs are concatenated (back to 512 dimensions) and projected through W_O (512 x 512).',
        'The feed-forward network applies to each position independently: FFN(x) = max(0, xW_1 + b_1)W_2 + b_2. The inner dimension d_ff = 2048, four times d_model. This is where the model adds per-position capacity after attention has gathered cross-position context.',
        'Positional encoding injects sequence order because attention itself is permutation-invariant. The original paper uses fixed sinusoidal functions: PE(pos, 2i) = sin(pos / 10000^(2i/d_model)), PE(pos, 2i+1) = cos(pos / 10000^(2i/d_model)). Each dimension oscillates at a different frequency, giving every position a unique signature. These are added to the token embeddings before the first block.',
        'In the decoder, a causal mask sets all attention scores from position t to positions t+1, t+2, ... to negative infinity before softmax. This prevents tokens from reading the future during training and autoregressive generation. Cross-attention lets the decoder attend to encoder outputs, using decoder states as queries and encoder states as keys and values.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The path length between any two positions is O(1). Token 1 can attend directly to token 500 in a single layer, compared to O(n) sequential steps through an RNN. Short path lengths mean gradients flow cleanly during backpropagation, and the model can learn long-range dependencies without fighting vanishing gradients.',
        'Attention is a weighted average: each output position is a convex combination of value vectors. The FFN adds nonlinear capacity that a weighted average alone cannot provide. Together, attention gathers relevant context and the FFN transforms it into richer features. Neither sublayer alone is sufficient: attention without the FFN is just a linear remix; the FFN without attention has no cross-position communication.',
        'Residual connections give gradients a highway through the entire stack. If a sublayer produces unhelpful output for some token, the residual path carries the original representation forward unchanged. Layer normalization keeps activation magnitudes stable across dozens of stacked blocks, preventing the exponential growth or collapse that kills deep networks without it.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Self-attention costs O(n^2 * d) per layer: every token scores against every other token (n^2 scores), and each score involves a d_k-dimensional dot product. For the original base model with d_model = 512, d_ff = 2048, 6 encoder layers, 6 decoder layers, and 8 heads, the total parameter count is about 65 million. The feed-forward sublayer costs O(n * d * d_ff) per layer, which dominates at short sequences since d_ff = 4d.',
        'When n doubles, attention cost quadruples. A 1024-token sequence needs 4x the attention computation of a 512-token sequence. Memory is also quadratic: storing the full n-by-n attention matrix for each head and each layer adds up fast. At n = 4096 with 32 heads and 32 layers, that is 32 * 32 * 4096^2 * 4 bytes, roughly 69 GB of attention matrices alone in fp32. This is the fundamental scaling wall that motivated Flash Attention, sparse attention, sliding-window attention, and linear-attention variants.',
        'During autoregressive inference, KV caching avoids recomputing keys and values for previous tokens: each new token only computes one query row and appends one K and V row. This changes decode from O(n^2 * d) per token to O(n * d), but the cache memory grows linearly with sequence length and must be stored per request.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'NLP: BERT (Devlin et al. 2019) uses the encoder stack for bidirectional pre-training. GPT (Radford et al. 2018) uses the decoder stack for autoregressive language modeling. T5 (Raffel et al. 2020) uses the full encoder-decoder. These three designs, all built from the same block, have set records on reading comprehension, text generation, translation, summarization, and question answering.',
        'Computer vision: Vision Transformer (Dosovitskiy et al. 2021) splits an image into 16x16 patches, treats each patch as a token, and runs them through a standard Transformer encoder. It matches or beats CNNs on image classification when given enough training data.',
        'Speech: Whisper (Radford et al. 2023) uses a Transformer encoder-decoder for speech recognition, trained on 680,000 hours of audio. The encoder processes log-mel spectrogram frames as a token sequence.',
        'Proteins: AlphaFold 2 (Jumper et al. 2021) uses attention over amino-acid sequences and multiple sequence alignments to predict 3D protein structure with atomic accuracy.',
        'Code: Codex, StarCoder, and every code-completion model stack the same decoder blocks over tokenized source code. The Transformer does not know the input is code; it just learns the statistical patterns of the token sequence.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Quadratic attention cost makes naive Transformers impractical for very long sequences. A 100K-token document produces 10 billion attention scores per layer. Workarounds include sparse attention (Longformer, BigBird), sliding-window attention (Mistral), linear attention (Katharopoulos et al. 2020), and Flash Attention (Dao et al. 2022), which reduces memory from O(n^2) to O(n) by never materializing the full attention matrix.',
        'Positional encoding limits generalization to unseen lengths. Sinusoidal encodings do not extrapolate well beyond the training sequence length. Rotary positional embeddings (RoPE, Su et al. 2021) improve length generalization but do not eliminate the problem. ALiBi (Press et al. 2022) takes a different approach by biasing attention scores based on distance rather than adding position to embeddings.',
        'The Transformer has no built-in inductive bias for locality, hierarchy, or compositionality. A CNN knows that nearby pixels matter more; a Transformer must learn this from data. For small datasets, this lack of bias means the Transformer needs more examples to match architectures that encode the right prior. ViT underperforms CNNs on small-scale image tasks precisely because it must learn spatial locality from scratch.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Input: 3 tokens “the”, “cat”, “sat” with d_model = 4, h = 2 heads, d_k = 2. Suppose after embedding plus positional encoding, X = [[0.8, -0.3, 0.5, 0.1], [0.2, 0.7, -0.4, 0.6], [0.6, 0.1, 0.3, -0.2]]. Each head uses the first 2 or last 2 dimensions.',
        'Head 1 (dims 0-1): Q1 = [[0.8, -0.3], [0.2, 0.7], [0.6, 0.1]], K1 = same (identity projection for simplicity). Scores: “the”-”the” = 0.8*0.8 + (-0.3)*(-0.3) = 0.73. “the”-”cat” = 0.8*0.2 + (-0.3)*0.7 = -0.05. “the”-”sat” = 0.8*0.6 + (-0.3)*0.1 = 0.45. After dividing by sqrt(d_k) = sqrt(2) = 1.41: [0.52, -0.04, 0.32]. Softmax: [0.43, 0.25, 0.35]. Token “the” attends mostly to itself (0.43) and “sat” (0.35).',
        'Head 2 (dims 2-3): Q2 = [[0.5, 0.1], [-0.4, 0.6], [0.3, -0.2]], K2 = same. “the”-”the” = 0.26, “the”-”cat” = -0.14, “the”-”sat” = 0.13. After /sqrt(2): [0.18, -0.10, 0.09]. Softmax: [0.38, 0.29, 0.35]. Head 2 distributes attention more evenly because the feature patterns in dims 2-3 are less distinctive.',
        'Each head produces a 3x2 output matrix by multiplying its attention weights with its value vectors. Concatenating the two heads gives a 3x4 matrix. After the output projection W_O (4x4), we get the attention sublayer output. Add X (residual connection), apply LayerNorm (mean-center each row, divide by standard deviation), pass through FFN (expand to d_ff = 16, ReLU, compress back to 4), add the pre-FFN values again, LayerNorm again. Output: a 3x4 matrix, same shape as input, ready for the next block.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Vaswani et al. 2017, “Attention Is All You Need,” introduced the Transformer. Sutskever et al. 2014, “Sequence to Sequence Learning with Neural Networks,” established the RNN encoder-decoder baseline. Bahdanau et al. 2015, “Neural Machine Translation by Jointly Learning to Align and Translate,” introduced attention for seq2seq. Hochreiter & Schmidhuber 1997 introduced LSTMs. He et al. 2016, “Deep Residual Learning,” introduced residual connections. Ba et al. 2016, “Layer Normalization,” introduced LayerNorm.',
        'Prerequisites: Multi-Head Attention (the attention mechanism in detail, what each head specializes to learn). Positional Encoding (how the Transformer knows token order; without it, attention treats the input as a bag of vectors). Softmax & Temperature (how raw scores become probability weights). Residual Connections (skip paths that make deep stacks trainable).',
        'Extensions: KV Cache (why autoregressive generation does not recompute the full sequence at each step). Flash Attention (tiling the attention computation to avoid materializing the n-by-n matrix, making long contexts practical). Grouped-Query Attention (sharing keys and values across heads to reduce KV cache size). BERT, GPT, and T5 (three ways to use the same block: encoder-only, decoder-only, encoder-decoder).',
        'Alternatives when the Transformer is the wrong tool: RWKV and Mamba replace quadratic attention with linear-time recurrence for long-context efficiency. State-space models (S4, Hyena) offer O(n log n) sequence mixing without attention. For small-data vision tasks, CNNs still outperform ViT because convolutions encode spatial locality that the Transformer must learn from scratch.',
      ],
    },
  ],
};
