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
      heading: 'What it is',
      paragraphs: [
        `Attention is a mechanism that lets every token in a sequence look at every other token in a single parallel step, without loops or recurrence. It answers the question: for each position, which other positions matter for understanding the current one? The answer comes back as a probability distribution — a row of percentages that sum to exactly 100% — telling the network how much to "pay attention" to each neighbor.`,
        `Three matrices — Queries, Keys, and Values — are the machinery. Queries encode what each token is looking for. Keys encode what each token offers. Values are the information tokens hand over if attended to. A dot product between every query and every key produces a score; softmax normalizes that score into a probability distribution; finally each token becomes a weighted average of everyone's values using those probabilities as weights. Information flows between tokens without loops.`
      ]
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Each token's embedding is multiplied by learned projection matrices to create three derived versions: its Query, its Key, and its Value. These are three different "views" of the same embedding, each optimized for a different role. Computing attention then has four steps: (1) Compute all-pairs dot products between queries and keys to get scores — how well each token's question matches each other token's answer. (2) Divide by the square root of the embedding dimension to keep numbers in a stable range, avoiding saturation in softmax. (3) Apply softmax to each row independently, turning scores into a probability distribution where every row sums to 100%. (4) Multiply this weight matrix by the Values matrix — each token is now a weighted average of everyone's value vectors.`,
        `This all-pairs matching is why attention costs O(n²) in sequence length: an n-token input creates an n × n weight matrix. Modern Transformers run attention with multiple independent "heads" in parallel — GPT-4 uses 128 heads — and each head specializes on different relationships (one tracking pronouns and their referents, another syntax patterns, another nearby tokens). A single attention head is one copy of the machinery above; multi-head attention just runs the same computation multiple times with different learned projections, then concatenates the outputs.`
      ]
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Attention's O(n²) cost is both its signature and its constraint. For a 4000-token input (a small chapter), the weight matrix alone holds 16 million entries. Generating text with an LLM requires repeating attention many times — once per output token — so total inference cost is O(n²m) where n is input length and m is output length. This is why inference is expensive and why long-context models (accepting 100k tokens) are still slow. Training is even more expensive because backpropagation through softmax requires storing attention weights in memory. Sparse attention variants (attending to only nearby tokens, or random subsets) cut this cost but work less well in practice.`
      ]
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Attention powers every state-of-the-art language model: GPT, Claude, Llama, PaLM, Gemini. It is the central mechanism in Transformer architectures which are now standard for text, image (Vision Transformers), and cross-modal models (CLIP, DALL-E). Attention also appears in speech recognition (Conformer models), machine translation, and document understanding. In recommendation systems and vector databases, nearest-neighbor search is a form of attention — finding the top-k keys with highest dot-product scores against a query.`,
        `Variants are everywhere: rotary positional embeddings encode position information into the query-key dot product; flash attention reorganizes the computation to avoid writing the full weight matrix to memory, cutting inference latency by 10×; grouped query attention reduces the number of key/value projections per head, cutting memory. These optimizations preserve the core insight — queries, keys, values, and softmax — while making attention feasible at scale.`
      ]
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `One widespread misconception: attention creates a "causal graph" of what-depends-on-what. It does not. Attention is symmetric (bidirectional) by default — every token can see every other token. Language models prevent cheating by masking the future: during generation, future tokens are set to -∞ before softmax (enforcing 0% attention to them), making attention "causal" at inference time. But the mechanism itself has no inherent causality.`,
        `Another pitfall: assuming attention "explains" model decisions. An attention head focusing heavily on word A does not prove the model considered A when producing its output. Attention is just one component; predictions emerge from the entire multi-layer network. Layer-wise and full-network importance metrics (like integrated gradients) are more trustworthy.`,
        `Finally, do not confuse attention with memory. Attention is instantaneous — it runs once per forward pass and computes what each token should pull from the current context. It does not persist state across different forward passes. Memory mechanisms (retrieval-augmented generation, external memory) are separate additions to transformer architectures.`
      ]
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Dive deeper into Softmax & Temperature to understand why that exponentiation matters and how temperature controls the sharpness of attention distributions. If you want to see how attention fails at long context and what sparse alternatives exist, study a Transformer paper directly or explore related visualizations. For grounded practice, build a tiny attention implementation from scratch in your preferred language — the math is pure linear algebra. When you are ready to understand full language models, study Gradient Descent to see how attention weights are learned, and explore Activation Functions to understand what comes after attention in the neural network pipeline.`
      ]
    }
  ]
};
