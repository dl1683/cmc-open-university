// Multi-head attention: run several attentions side by side, each with its
// own learned projections, each free to track a DIFFERENT relationship —
// then concatenate. Why one attention pattern was never going to be enough.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'multi-head-attention',
  title: 'Multi-Head Attention',
  category: 'AI & ML',
  summary: 'Two heads, two different attention patterns, one concatenated answer — parallel relationship detectors.',
  controls: [
    { id: 'view', label: 'Inspect', type: 'select', options: ['both heads', 'head 1 only', 'head 2 only'], defaultValue: 'both heads' },
  ],
  run,
};

const TOKENS = ['the', 'cat', 'sat', 'here'];

// Attention patterns produced by two heads' learned Wq/Wk projections in a
// trained toy model. Head 1 learned a POSITIONAL habit (look at the previous
// token); head 2 learned a SEMANTIC one (find the noun). Each row sums to 1.
const HEAD1 = [
  [0.88, 0.04, 0.04, 0.04],
  [0.80, 0.10, 0.05, 0.05],
  [0.06, 0.80, 0.08, 0.06],
  [0.05, 0.07, 0.80, 0.08],
];
const HEAD2 = [
  [0.10, 0.74, 0.08, 0.08],
  [0.06, 0.80, 0.07, 0.07],
  [0.07, 0.78, 0.08, 0.07],
  [0.08, 0.72, 0.10, 0.10],
];

// Each head has its own 2-dimensional value space (4 dims split across 2 heads).
function valueVector(word, headIndex) {
  return Array.from({ length: 2 }, (_, j) => {
    let h = j + 3 * (headIndex + 1);
    for (let i = 0; i < word.length; i += 1) h = (h * 31 + word.charCodeAt(i) * (j + 2)) % 1009;
    return (h / 1009) * 2 - 1;
  });
}

const pct = (v) => `${Math.round(v * 100)}%`;
const rows = TOKENS.map((t, i) => ({ id: `q${i}`, label: t }));
const cols = TOKENS.map((t, i) => ({ id: `k${i}`, label: t }));

export function* run(input) {
  const view = String(input.view);
  if (!['both heads', 'head 1 only', 'head 2 only'].includes(view)) throw new InputError('Pick a view.');

  yield {
    state: matrixState({ title: 'One head = one pattern = one kind of relationship', rows, columns: cols, values: HEAD1, format: pct }),
    highlight: {},
    explanation: 'The Attention Mechanism produces ONE pattern: one matrix of who-looks-at-whom. But "the cat sat here" carries several relationships at once — word order, subject-ness, adjacency — and a single softmax can only express one mixture. The fix is almost comically direct: run SEVERAL attentions in parallel, each with its own learned Wq/Wk/Wv, and let each specialize. Each parallel copy is called a HEAD.',
  };

  if (view !== 'head 2 only') {
    yield {
      state: matrixState({ title: 'Head 1: a positional specialist', rows, columns: cols, values: HEAD1, format: pct }),
      highlight: { active: ['q2:k1', 'q3:k2'] },
      explanation: 'Head 1\'s projections learned a POSITIONAL habit: read the rows — "sat" puts 80% of its attention on "cat", "here" on "sat": almost every token looks at its PREDECESSOR. Heads like this really exist in trained models (they help copy and continue sequences — the famous "induction heads" are their sophisticated cousins).',
      invariant: 'Each head\'s rows are a softmax: every row sums to 100%.',
    };
  }

  if (view !== 'head 1 only') {
    yield {
      state: matrixState({ title: 'Head 2: a semantic specialist', rows, columns: cols, values: HEAD2, format: pct }),
      highlight: { active: ['q0:k1', 'q2:k1', 'q3:k1'] },
      explanation: 'Head 2, SAME tokens, completely different worldview: every row pours its attention onto "cat" — this head learned to find the NOUN, the thing the sentence is about. Same input, same mechanism, different learned projections → different relationship extracted. Neither head is wrong; they answer different questions simultaneously.',
    };
  }

  const out1 = HEAD1.map((w) => [0, 1].map((d) => w.reduce((s, wij, j) => s + wij * valueVector(TOKENS[j], 0)[d], 0)));
  const out2 = HEAD2.map((w) => [0, 1].map((d) => w.reduce((s, wij, j) => s + wij * valueVector(TOKENS[j], 1)[d], 0)));
  const concat = TOKENS.map((_, i) => [...out1[i], ...out2[i]]);
  const dimCols = ['h1·d0', 'h1·d1', 'h2·d0', 'h2·d1'].map((label, j) => ({ id: `d${j}`, label }));

  yield {
    state: matrixState({ title: 'Concatenate: each head contributes its slice of the output', rows, columns: dimCols, values: concat }),
    highlight: { active: ['q2:d0', 'q2:d1'], compare: ['q2:d2', 'q2:d3'] },
    explanation: 'Each head computes its weighted mix of (its own) value vectors — real arithmetic on the patterns you just saw — and the outputs are CONCATENATED side by side: head 1 fills the first dimensions, head 2 the rest. Look at "sat"\'s row: its left half encodes "what came before me" (head 1), its right half "the noun I relate to" (head 2). One final learned matrix (W_O) then blends the slices. The accounting trick: each head works in dims/heads dimensions, so 8 heads cost the SAME total compute as one full-width head — diversity is free.',
  };

  yield {
    state: matrixState({ title: 'Scale: 96 heads × 96 layers', rows, columns: dimCols, values: concat }),
    highlight: {},
    explanation: 'GPT-3 runs 96 heads in every one of its 96 layers — nine thousand specialists. Interpretability researchers have found heads that track syntax, coreference ("her" → who?), induction (repeat what followed last time), even rare-token detectors; pruning studies show many heads are redundant (an ensemble\'s redundancy — compare Random Forest). Multi-head is the production form of attention: The Transformer Block you\'ve seen uses exactly this in its first sublayer, served by the KV Cache per head.',
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Multi-head attention is several Attention Mechanism copies run side by side. Each head has its own learned Wq, Wk, and Wv projections, so the same tokens can be viewed through different relationship lenses. One head might track the previous token, another might find a subject noun, another might copy a repeated pattern. The head outputs are concatenated and mixed by an output matrix W_O, giving the next layer one combined representation.`,
        `The point is not that each head is mystical or human-readable. The point is capacity with separation. If a model dimension d_model is split across H heads, each head works in d_model / H dimensions, so total projection width stays comparable to one large head while the model gets H different attention patterns. GPT-3 175B is the concrete extreme: 96 layers, 96 heads per layer, 12,288 model width, and 128 dimensions per head. BERT-base is smaller but the same idea: 12 layers, 12 heads, 768 width.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `For head h, the computation is softmax(Q_h K_h^T / sqrt(d_head)) V_h. Q_h, K_h, and V_h come from head-specific slices of the learned projection matrices. The heads do not vote and they do not communicate while attention is being computed. They independently produce one output vector per token, and only after that does W_O blend the concatenated result back into d_model dimensions.`,
        `This design fits GPUs well. Implementations do not launch 96 tiny separate jobs; they reshape tensors so batched matrix multiplies process all heads together. RoPE (Rotary Embeddings) or another position method is applied per head to queries and keys. During inference, the KV Cache stores keys and values per layer and per head, which is why grouped-query attention shares K/V heads to reduce memory while keeping many query heads.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `With d_model held constant, multi-head attention has the same asymptotic cost as single-head attention: O(n^2 d_model) for attention scores and value mixing, plus O(n d_model^2) for projections. The difference is layout, not Big-O. Training memory includes attention probabilities of shape batch by heads by tokens by tokens, so H separate patterns matter. At 4,096 tokens and 32 heads, one layer has about 536 million attention cells before batching. Modern kernels reduce materialization, but the quadratic relationship remains.`,
        `Parameters are usually four dense matrices: Wq, Wk, Wv, and W_O. They are often stored as large combined projections rather than literal per-head matrices. That implementation detail matters: the architecture says "heads"; the hardware sees packed matrix multiplication.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Every serious Transformer decoder or encoder uses heads: BERT, T5, GPT-3, Llama, Mistral, and Vision Transformers. Interpretability work has found heads with recognizable roles, especially induction heads described by Olsson et al. in 2022: a model sees a repeated token and attends to what followed it before, enabling simple in-context copying. Other heads track delimiters, syntax, or local position. The Transformer Block is the place these heads live, immediately before residual mixing and normalization.`,
        `The ensemble analogy is useful but limited. Random Forest combines many explicit trees; heads are not independent models and can be rewritten by downstream layers. Mixture of Experts (MoE) is a better comparison for routed specialization, because it activates different parameter blocks, while heads usually all run for every token.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `More heads are not automatically better. If d_model is fixed, adding heads shrinks d_head, and very small head dimensions can make each dot-product space weak. Some trained heads can be pruned with little immediate loss, but "redundant" does not mean useless; redundancy can make optimization and robustness easier. Another trap is clean-story interpretability. A head can be polysemantic, inert on one dataset, crucial on another, or important only because W_O and later layers use it in a specific way.`,
        `Do not read one attention map as the model's reason for an answer. Saliency Maps & Feature Attribution and full-network ablations are stronger tools. Also do not confuse head count with context length: long context is constrained by token count, position encoding, cache memory, and kernels, not just the number of heads.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Read Attention Mechanism first if the Q/K/V formula is not automatic yet. Then study The Transformer Block, where heads become one sublayer inside a larger residual machine. KV Cache explains the serving cost of storing keys and values per head. RoPE (Rotary Embeddings) shows why position is applied inside each head's query-key space. BatchNorm & LayerNorm explains the stabilizers that keep many stacked head outputs trainable.`,
      ],
    },
  ],
};
