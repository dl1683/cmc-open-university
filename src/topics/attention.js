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

  const dims = Array.from({ length: D }, (_, j) => ({ id: `d${j}`, label: `d${j}` }));
  const qRows = tokens.map((t, i) => ({ id: `q${i}`, label: t }));
  const kCols = tokens.map((t, i) => ({ id: `k${i}`, label: t }));
  const pct = (v) => `${Math.round(v * 100)}%`;

  const E = tokens.map(embed);
  yield {
    state: matrixState({ title: 'Embeddings E (one row per token)', rows: qRows, columns: dims, values: E }),
    highlight: {},
    explanation: `Step one of any language model: each token becomes a VECTOR of numbers — here ${D} dimensions per token (real models use thousands). These are toy embeddings, but everything we do with them from now on is the real attention computation.`,
  };

  const Q = matMul(E, Wq);
  const K = matMul(E, Wk);
  const V = matMul(E, Wv);

  yield {
    state: matrixState({ title: 'Queries Q = E·Wq', rows: qRows, columns: dims, values: Q }),
    highlight: {},
    explanation: 'Each embedding is multiplied by a learned matrix Wq to make a QUERY — a vector that encodes "what am I looking for?". A pronoun might query for its referent; a verb might query for its subject.',
  };
  yield {
    state: matrixState({ title: 'Keys K = E·Wk', rows: qRows, columns: dims, values: K }),
    highlight: {},
    explanation: 'A second matrix Wk makes each token a KEY — "what do I offer?". A third (Wv) makes VALUES — the actual information a token hands over if attended to. Three different projections of the same embedding, three different roles.',
  };

  const scale = Math.sqrt(D);
  const scores = Q.map((q) => K.map((k) => dot(q, k) / scale));
  yield {
    state: matrixState({ title: 'Scores = Q·Kᵀ / √d', rows: qRows, columns: kCols, values: scores }),
    highlight: {},
    explanation: `Now every query meets every key: score[i][j] is the DOT PRODUCT of token i's query with token j's key — how well "what I want" matches "what you offer". Dividing by √${D} keeps the numbers tame so the next step doesn't saturate. This all-pairs table is why attention costs O(n²) in sequence length.`,
  };

  const weights = scores.map(softmax);
  for (let i = 0; i < n; i += 1) {
    const best = weights[i].indexOf(Math.max(...weights[i]));
    yield {
      state: matrixState({ title: 'Attention weights (softmax per row)', rows: qRows, columns: kCols, values: weights, format: pct }),
      highlight: { active: [`q${i}`], range: kCols.map((c) => `q${i}:${c.id}`) },
      explanation: `Softmax turns row "${tokens[i]}" into weights that are positive and sum to exactly 100% — a budget of attention to spend. "${tokens[i]}" spends ${pct(weights[i][best])} of its budget on "${tokens[best]}".`,
      invariant: 'Each row of the attention matrix sums to 100%.',
    };
  }

  yield {
    state: matrixState({ title: 'The attention pattern', rows: qRows, columns: kCols, values: weights, format: pct }),
    highlight: {},
    explanation: 'This heatmap IS attention — the thing the papers draw. Read it row by row: each token is deciding which other tokens matter for understanding itself. In a trained model, heads specialize: one tracks syntax, another coreference, another nearby words.',
  };

  const output = matMul(weights, V);
  yield {
    state: matrixState({ title: 'Output = weights · V', rows: qRows, columns: dims, values: output }),
    highlight: {},
    explanation: 'Finally each token rebuilds itself as a WEIGHTED AVERAGE of everyone\'s values, using its attention row as the weights. Information has now flowed between tokens — "cat" is literally mixed into the vector for "sat". No loops, no recurrence: just three matrix multiplies and a softmax.',
  };

  yield {
    state: matrixState({ title: 'The attention pattern', rows: qRows, columns: kCols, values: weights, format: pct }),
    highlight: {},
    explanation: 'That single operation — run with many heads in parallel, stacked dozens of layers deep, with learned weights — is the Transformer ("Attention Is All You Need", 2017), and it is the architecture behind essentially every modern LLM. You just watched the whole trick.',
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Attention is the operation that lets tokens exchange information. After Tokenization (BPE) turns text into IDs and Embeddings & Similarity turns those IDs into vectors, each token makes three learned projections: a query, a key, and a value. The query asks "what do I need?", the key advertises "what do I contain?", and the value is the information handed over if the match is strong. Vaswani et al.'s 2017 "Attention Is All You Need" made scaled dot-product attention the center of the Transformer era.`,
        `For one attention head, every query is compared with every key. The comparisons become scores, the scores pass through Softmax & Temperature, and each token receives a weighted average of all value vectors. That weighted average is not a symbolic lookup; it is ordinary linear algebra. The important change from recurrent networks is parallelism: all token-to-token relationships are computed at once, so the model can connect "it" to a noun 40 tokens earlier without stepping through the sentence one word at a time.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The core formula is softmax(QK^T / sqrt(d_k))V. Q, K, and V are matrices with one row per token. QK^T builds an n by n table, where cell (i, j) says how much token i should read token j. Dividing by sqrt(d_k) matters: without scaling, larger vector dimensions make dot products grow, softmax saturates, and gradients get brittle. After softmax, every row is a probability distribution. Multiplying by V mixes actual content into each token's new representation.`,
        `Causal language models add a mask before softmax: future positions get negative infinity, so generated token 12 cannot peek at token 13. Multi-Head Attention repeats the same computation with different projections, then concatenates the results. RoPE (Rotary Embeddings) or another position scheme is also needed, because content-only attention is permutation-equivariant: shuffle the input tokens and the outputs shuffle with them.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `For a sequence of n tokens and head dimension d, prefill attention costs O(n^2 d) per head and stores an n by n attention pattern during training. A 4,096-token prompt has 16,777,216 query-key pairs per head per layer; at 32 layers and many heads, memory bandwidth becomes the wall. During autoregressive decoding, the KV Cache avoids recomputing old keys and values, but the new query still scores against every cached key, so long contexts remain expensive. FlashAttention (Dao et al., 2022) does not change the math; it tiles the computation so the giant attention matrix is not written to slow memory.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Machine translation was the first showcase: the original Transformer beat recurrent systems on WMT 2014 English-German while training faster. Today the same block powers GPT-style decoders, BERT-style encoders, Vision Transformers, Whisper-like speech models, and multimodal systems that let text attend to image patches. Retrieval systems are not literally attention, but dot-product retrieval rhymes with it: a query vector is compared against many candidate vectors, just outside the network rather than inside a layer. The Embedding Space, in 3D is the geometric version of that idea.`,
        `Production attention is heavily engineered. Grouped-query and multi-query attention share keys and values across heads to shrink cache memory. Sliding-window attention in models such as Mistral limits which old tokens are visible. Long-context systems combine better position encodings, paged caches, and memory-aware kernels because the simple n^2 table is still the bottleneck.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Attention weights are not explanations. A bright cell in a head means one value vector influenced one intermediate representation; it does not prove a final answer depended on that token. Attribution needs the whole network, not one softmax table. Sparse Autoencoder Feature Dictionary Case Study continues that warning by decomposing internal activations into feature candidates that still need causal tests. Another common mistake is calling attention "memory." Attention reads the current context. Persistent memory, retrieval, or tool state must be added outside the basic layer.`,
        `Do not overstate causality either. Unmasked attention is bidirectional; causal attention is created by a mask. Do not overstate sparsity: sparse patterns save compute, but they also remove possible interactions. The Transformer Block works because attention is wrapped with feed-forward layers, residual paths, and normalization-style stabilization.`,
      ],
    },
    {
      heading: `Sources and historical context`,
      paragraphs: [
        `Primary sources: Vaswani et al.'s Transformer paper at https://arxiv.org/abs/1706.03762, FlashAttention at https://arxiv.org/abs/2205.14135, the multi-query attention paper at https://arxiv.org/abs/1911.02150, and the grouped-query attention paper at https://arxiv.org/abs/2305.13245. These are worth reading in that order: first the math, then the IO bottleneck, then the serving-memory variants that became important once decoder models were deployed at scale.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Read Multi-Head Attention next: one head is the scalar version, many heads are the production architecture. Then study The Transformer Block to see attention surrounded by residuals and the feed-forward network. KV Cache explains why serving a decoder is different from training one. Perceiver IO Latent Array Bottleneck shows cross-attention as a data-structure interface between huge inputs, fixed latent memory, and output queries. FNet Fourier Token Mixing Case Study shows what changes when the learned all-pairs attention table is replaced by a fixed Fourier mixer. Sparse Autoencoder Feature Dictionary Case Study shows how interpretability moves from attention maps to internal feature dictionaries. Titans Test-Time Neural Memory Case Study shows how attention can become the short-term part of a larger memory architecture. RoPE (Rotary Embeddings) explains how position is inserted into query-key geometry. Lost in the Middle: Long-Context Failure Modes shows why having a long context window does not guarantee the model will use evidence from every position equally well. Finally, return to Softmax & Temperature, because the same row-normalizing function appears inside attention and at the final next-token sampler.`,
      ],
    }
  ]
};
