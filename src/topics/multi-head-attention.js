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
      heading: 'Why multiple heads exist',
      paragraphs: [
        'Multi-head attention exists because one token usually needs several kinds of context at once. In a sentence, a token may need the previous word for local order, the subject for agreement, a distant delimiter for structure, and a repeated phrase for copying. In code, it may need the current indentation level, the matching bracket, the variable definition, and the import that made a symbol available.',
        'A single attention head produces one normalized attention distribution per query token. That one distribution can mix information from many places, but it must express all relationships as one compromise. Multi-head attention removes that bottleneck by running several attention mechanisms in parallel. Every head sees the same input sequence, but each head has its own learned query, key, and value projections, so each can learn a different comparison space.',
        'The design is simple but powerful: split the model width into several head-sized channels, compute attention independently in each channel, concatenate the outputs, and use a learned output projection to mix them back together. The model gets many attention patterns without making every head full-width.',
      ],
    },
    {
      heading: 'The naive single-head design',
      paragraphs: [
        'The obvious design is one full-width attention head. Project tokens into queries, keys, and values, compute QK^T, apply a softmax, mix values, and pass the result onward. This is enough to explain attention, and it can solve toy examples. It fails as a general architecture because every query token receives only one attention row.',
        'One row is a poor place to store incompatible needs. Suppose the token "sat" should attend strongly to "cat" because it is the subject, but it should also attend to the previous token because local order is useful for continuation. One softmax distribution can split weight between them, but it cannot separately preserve the semantic relationship and the positional relationship as two clean signals.',
        'Making the single head wider does not fully solve the problem. More dimensions inside one head give a richer scoring space, but the head still emits one attention pattern. Multi-head attention creates several independently normalized patterns. The independence of those softmaxes is the point.',
      ],
    },
    {
      heading: 'Core invariant',
      paragraphs: [
        'The invariant is that each head owns its own Q, K, V projections and its own row-normalized attention matrix. A head can only output weighted mixtures of its own value vectors, and each query row in that head sums to one. The heads do not vote on one shared attention map. They produce separate maps, separate value mixtures, and separate output slices.',
        'This gives the model structured diversity. Head 1 may make adjacent-position comparisons easy. Head 2 may make noun-like tokens easy to find. Head 3 may specialize in delimiters. Head 4 may become useful for repeated-token induction. These roles are not hand-coded. They emerge because the learned projections make different relationships linearly visible in different head spaces.',
        'If the model width is d_model and there are H heads, each head often uses d_model / H dimensions. The total width stays fixed, so multi-head attention is not simply "do H times more full attention." It is a layout that spends the same broad representation budget on several smaller relationship channels.',
      ],
    },
    {
      heading: 'How one head works',
      paragraphs: [
        'For one head h, the computation is softmax(Q_h K_h^T / sqrt(d_head)) V_h. Q_h, K_h, and V_h come from learned projections of the current token representations. The dot product between a query and a key is a compatibility score. Dividing by sqrt(d_head) keeps scores from becoming too large as the head dimension grows.',
        'The softmax turns each row of scores into a probability-like distribution over source positions. That row says how much this query token will read from every value vector in the same head. The output for the token is a weighted sum of those value vectors.',
        'The important discipline is shape discipline. For a batch of sequences, implementations usually hold attention data in shapes like batch, heads, query positions, key positions. Bugs in masks, head reshaping, or transposes can silently produce attention over the wrong axis. Multi-head attention is mathematically simple enough to write down in one line, but production correctness depends on boring tensor layout details.',
      ],
    },
    {
      heading: 'Concatenation and mixing',
      paragraphs: [
        'After every head produces an output vector for every token, the model places those head outputs side by side. If there are two heads with two dimensions each, each token gets four dimensions before the output projection. In real models the numbers are larger, but the accounting is the same: concatenate head slices into one token vector.',
        'The output projection W_O then mixes those slices. This matters because later layers do not receive a neat list of head reports. They receive a blended representation. A head can be useful because of how W_O combines it with another head, or because the following feed-forward layer turns a weak signal into a strong feature.',
        'That is also why head interpretation is hard. An attention map shows where a head read from, not the full computation performed by the block. The value vectors, output projection, residual stream, normalization, and feed-forward sublayer all affect what the model actually uses.',
      ],
    },
    {
      heading: 'Positions, masks, and caches',
      paragraphs: [
        'A head needs position information because attention over plain token embeddings is order-blind. Transformer models add positional encodings or use RoPE-style rotations in query-key space so heads can learn distance, order, and relative structure. Without position, the set of tokens would be visible but their order would be much harder to recover.',
        'Decoder-only language models also use a causal mask. The mask prevents a token from attending to future positions during training and generation. A single bad mask can leak future tokens and create impossible training results, so mask tests are part of the core implementation, not an optional detail.',
        'During inference, each layer stores past keys and values for each head in the KV cache. This makes generation practical because the model does not recompute K and V for the whole prefix at every step. The cost is memory: layers times sequence length times K/V head count times head dimension. Grouped-query attention and multi-query attention reduce this cost by sharing fewer key-value heads across many query heads.',
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        'The visual shows the same four tokens under two different attention patterns. One head mostly follows the previous token. Another mostly looks at "cat." Both can be useful because they answer different questions about the same sequence. The point is not that every model has exactly these two roles. The point is that one input can be scored through multiple learned attention spaces at once.',
        'The final matrix shows the data-flow contract. The first part of each output row comes from one head and the second part comes from another head. Concatenation preserves the separate slices long enough for W_O to mix them. That is the mechanism that turns parallel relationship detectors into one representation stream.',
        'This also explains why deleting or merging heads is not always harmless. Some heads are redundant, especially in large models, but others provide a relationship channel that later computation expects. The right question is empirical: what happens to loss, behavior, and downstream tasks when this head or head group is removed?',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Multi-head attention works because it gives the model several communication channels at the same layer. A token representation can receive local order evidence, syntax evidence, copying evidence, and topic evidence before the next layer transforms it. Stacking layers then lets later heads attend over representations that already contain earlier head mixtures.',
        'The design also works well on accelerators. Implementations usually pack Q, K, and V projections into large matrix multiplications, then reshape into heads. The architecture says "many heads," but the hardware can still see large batched tensor operations. This is why multi-head attention became practical rather than an elegant but slow loop over many tiny modules.',
        'The residual stream makes the result even more useful. Attention does not replace the token representation; it adds a communication update that later normalization and feed-forward layers process. Multi-head attention is therefore one stage in a repeated refine-and-mix cycle, not a standalone reasoning engine.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'With d_model held constant, multi-head attention has roughly the same broad asymptotic attention cost as one full-width attention layer: about O(n^2 d_model) for attention scores and value mixing, plus O(n d_model^2) for projections. The difference is layout and memory behavior. Training may need attention probability tensors shaped by batch, heads, query tokens, and key tokens. Long context still makes the token-pair term expensive.',
        'More heads are not automatically better. If d_model stays fixed, adding heads shrinks d_head. A very small head dimension can weaken each scoring space. Too many heads can add kernel overhead, memory pressure, or redundancy without improving quality. Production models choose head count together with width, context length, attention kernel, batch shape, and KV-cache budget.',
        'Serving cost is often dominated by memory bandwidth. During decode, the model repeatedly reads cached keys and values. More key-value heads mean more bytes per token. Grouped-query attention keeps many query heads for expressiveness while sharing fewer K/V heads to reduce cache size and bandwidth pressure.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Implement QKV projection as a shape contract. Start from batch, sequence, d_model. Project to Q, K, V. Reshape to batch, heads, sequence, d_head. Apply RoPE or positional logic in the intended space. Apply masks before softmax. Multiply by V. Then transpose and reshape back to batch, sequence, d_model before W_O. Most bugs are not in the formula; they are in one mistaken reshape, mask broadcast, or cache offset.',
        'Test tiny examples where the expected mask is obvious. A causal token should never read a future token. Padding positions should not receive attention. A cached decode step should match full-prefix recomputation within tolerance. Grouped-query attention should map query heads to the correct shared K/V heads. These tests catch failures that can otherwise look like ordinary model noise.',
        'For performance, prefer fused attention kernels when the shapes allow them, and watch memory layout. Head dimension, dtype, sequence length, and mask type determine which kernels run. A model can be architecturally correct but slow because its head layout misses the fast path on the target hardware.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Multi-head attention wins when a representation needs several relationship types at once. Language models use heads for local order, syntax, copying, delimiters, references, and long-range topic structure. Code models use them for brackets, indentation, variable reuse, imports, and test-output context. Vision Transformers use heads over image patches. Audio models can use heads over time-frequency features.',
        'It is especially useful when the model must combine local and distant evidence. One head can read the nearby phrase while another reaches to the start of the document. One can track punctuation while another tracks entities. The next layer receives a representation that has already collected several kinds of evidence.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Do not treat one attention map as a complete explanation of a model answer. A head may be polysemantic, useful only on certain data, or important only after W_O and later layers transform its output. Some heads can be pruned with little immediate loss, but that does not prove they were meaningless during training or under distribution shift.',
        'Do not confuse head count with context length or reasoning depth. Long context depends on position methods, attention kernels, memory bandwidth, KV-cache capacity, and training data. Reasoning depends on the whole network and the generation process. Multi-head attention gives the model richer communication channels, but it does not by itself guarantee factuality, planning, or interpretability.',
        'Also watch for implementation failures hidden by scale. A wrong mask can let training cheat. A bad cache offset can make decode differ from prefill. A mistaken head grouping can silently reduce quality. Because models are noisy systems, these bugs may first appear as small benchmark regressions rather than obvious crashes.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Attention Mechanism until the Q, K, V formula is automatic. Then study The Transformer Block, where multi-head attention becomes the first sublayer inside a residual stack. Read RoPE for position inside head space, KV Cache for inference memory, Grouped-Query Attention for K/V sharing, FlashAttention for kernel-level memory behavior, Transformer Layer FLOPs Cost Model for cost accounting, and Sparse Autoencoder Feature Dictionary Case Study for a stronger way to test feature-level stories.',
      ],
    },
  ],
};
