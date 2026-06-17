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
      heading: `Why this exists`,
      paragraphs: [
        `Attention exists because a token often cannot be understood from itself alone. In "the cat sat because it was tired," the vector for "it" needs information from earlier words. The model needs a way for one position to read other positions and mix the useful information into its own representation.`,
        `The old recurrent approach processed tokens one after another. That made sequence order natural, but long-range information had to pass through many intermediate states. The obvious fully connected alternative is to let every token look at every other token directly. Attention is the learned, differentiable version of that idea.`,
        `After Tokenization (BPE) turns text into IDs and Embeddings & Similarity turns those IDs into vectors, each token makes three learned projections: query, key, and value. The query asks what this token needs. The key advertises what another token can match. The value is the information that gets mixed in if the match is strong.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        `The heatmap is organized row by row. A row is the attention budget for one token, and the columns are the tokens it can read. After softmax, each row sums to 100 percent, so the row shows how that token distributes its read budget across the context.`,
        `The important transition is from scores to weights to mixed values. The dot-product table says which query-key pairs match. Softmax turns each row into a distribution. Multiplying by V turns that distribution into a new vector for the querying token. The visual model is not a metaphor; it is the actual computation on tiny vectors.`,
      ],
    },
    {
      heading: `Core insight and mechanism`,
      paragraphs: [
        `The core insight is that contextual relevance can be computed as vector matching, then used as a routing table for information flow. A token does not choose one neighbor with an if statement. It builds a smooth distribution over all visible positions, then uses that distribution to mix their value vectors. The invariant to remember is simple: each attention row is a probability distribution over the readable tokens.`,
        `The core formula is softmax(QK^T / sqrt(d_k))V. Q, K, and V are matrices with one row per token. QK^T builds an n-by-n table where cell (i, j) says how strongly token i should read token j. Dividing by sqrt(d_k) keeps dot products from growing too large as vector dimension increases, which prevents softmax from becoming too sharp too early.`,
        `Softmax gives every row positive weights that sum to one. Multiplying those weights by V creates a weighted average of value vectors. The output for "sat" can contain some information from "cat" and some from nearby context because its row has allocated weight to those positions.`,
        `Multi-Head Attention repeats this computation with different learned projections. One head might specialize in local syntax, another in separators, another in long-range references. The heads are concatenated and projected back into the model dimension, giving the next layer a richer token representation.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The animation starts with embeddings, then computes Q, K, and V by multiplying those embeddings by learned projection matrices. In a real model the projection weights come from training. In this demo they are fixed so the same input always produces the same numbers.`,
        `The score matrix compares every query with every key. If there are n tokens, the matrix has n squared cells. That all-pairs comparison is the reason attention can connect distant words directly, and it is also the reason attention becomes expensive at long context lengths.`,
        `Causal language models add a mask before softmax. Future positions get a huge negative score, so generated token 12 cannot read token 13. RoPE (Rotary Embeddings) or another position scheme is also needed, because content-only attention does not know order by itself. If you shuffle the tokens, the same content vectors shuffle with them unless position information has been injected.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `Attention works because it turns relevance into a differentiable routing table. The model can learn projection matrices that make useful pairs have high dot products and unhelpful pairs have low dot products. Softmax converts those scores into a smooth selection rule, so training can adjust the whole mechanism with gradient descent.`,
        `The value vectors keep the operation from being only a similarity score. Keys are used for matching; values are used for information transfer. Separating those roles lets the model learn "match on this feature, copy that feature" rather than using one vector for everything.`,
        `The operation is parallel across positions during training and prefill. Every query-key comparison in a layer can be computed as matrix multiplication, which is why the Transformer displaced recurrent architectures despite the quadratic table.`,
      ],
    },
    {
      heading: `Costs and tradeoffs`,
      paragraphs: [
        `For a sequence of n tokens and head dimension d, prefill attention costs O(n^2 d) per head and creates an n-by-n score pattern. A 4,096-token prompt has 16,777,216 query-key pairs per head per layer. With many heads and layers, memory bandwidth and temporary storage become the wall.`,
        `During autoregressive decoding, the KV Cache avoids recomputing old keys and values, but each new query still scores against cached keys. Long contexts therefore remain expensive even when decoding one token at a time. FlashAttention does not change the formula; it changes the IO pattern by tiling the computation so the huge attention matrix does not have to be materialized in slow memory.`,
        `Serving systems add another cost: the cache grows with sequence length, layer count, head count, and value dimension. Grouped-query and multi-query attention reduce KV-cache memory by sharing keys and values across heads. Sliding-window attention reduces cost by restricting which old tokens remain visible.`,
      ],
    },
    {
      heading: `Operational guidance`,
      paragraphs: [
        `When implementing attention, treat numerical stability as part of the algorithm. Subtract the row maximum before softmax, apply masks before softmax, and keep tensor shapes explicit so batch, head, sequence, and feature dimensions cannot be swapped silently. The scale factor should match the key dimension, not the full model dimension.`,
        `For serving, watch KV-cache memory before watching only FLOPs. A model can have enough compute for a request and still fail because the cache for long contexts does not fit. Use paged cache allocation, prefix caching, grouped-query attention, and window policies when the workload has repeated prompts or long conversations. Measure time to first token separately from decode throughput because prefill and decode stress different parts of the system.`,
        `For debugging, inspect attention as a symptom rather than a proof. If a model ignores late evidence, compare attention patterns with position encodings, prompt packing, cache reuse, and retrieval order. If outputs are unstable, check masking, dtype, softmax saturation, and whether the implementation accidentally allows future tokens to leak into causal training.`,
      ],
    },
    {
      heading: `Where it wins`,
      paragraphs: [
        `Machine translation was the first showcase: the original Transformer beat recurrent systems on WMT 2014 English-German while training faster. Today the same block powers GPT-style decoders, BERT-style encoders, Vision Transformers, Whisper-like speech models, and multimodal systems that let text attend to image patches. Retrieval systems are not literally attention, but dot-product retrieval rhymes with it: a query vector is compared against many candidate vectors, just outside the network rather than inside a layer. The Embedding Space, in 3D is the geometric version of that idea.`,
        `Production attention is heavily engineered. Grouped-query and multi-query attention share keys and values across heads to shrink cache memory. Sliding-window attention in models such as Mistral limits which old tokens are visible. Long-context systems combine better position encodings, paged caches, and memory-aware kernels because the simple n^2 table is still the bottleneck.`,
      ],
    },
    {
      heading: `Limits and failure modes`,
      paragraphs: [
        `Where attention fails is usually where the all-pairs table is too expensive, too unstructured, or too easy to overinterpret. Attention weights are not explanations. A bright cell in a head means one value vector influenced one intermediate representation; it does not prove a final answer depended on that token. Attribution needs the whole network, not one softmax table. Sparse Autoencoder Feature Dictionary Case Study continues that warning by decomposing internal activations into feature candidates that still need causal tests. Another common mistake is calling attention "memory." Attention reads the current context. Persistent memory, retrieval, or tool state must be added outside the basic layer.`,
        `Do not overstate causality either. Unmasked attention is bidirectional; causal attention is created by a mask. Do not overstate sparsity: sparse patterns save compute, but they also remove possible interactions. The Transformer Block works because attention is wrapped with feed-forward layers, residual paths, and normalization-style stabilization.`,
        `A final misconception is that attention alone explains LLM capability. It is the routing mechanism, not the whole system. Scale, data, tokenization, optimization, feed-forward layers, normalization, positional encoding, serving infrastructure, and post-training all matter. Attention is the central data movement primitive, but the model is the stack around it.`,
      ],
    },
    {
      heading: `A worked intuition`,
      paragraphs: [
        `Take the toy phrase "the cat sat here." The token "sat" makes a query. The keys for "cat" and "here" offer different matches. If the learned projections make "sat" query for its subject, the "cat" key may receive a high score. After softmax, part of "sat"'s row budget goes to "cat." The output vector for "sat" is then mixed with the value vector from "cat."`,
        `Nothing symbolic has happened. The model did not store a parse tree. It built a weighted average. But because those weights and values are learned across many layers and heads, the network can build token representations that carry syntax, reference, topic, style, and task information forward.`,
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
