// Positional encoding: attention is order-blind — "dog bites man" and
// "man bites dog" look identical to it. The fix: give every position a
// unique mathematical fingerprint and mix it into the embeddings.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'positional-encoding',
  title: 'Positional Encoding',
  category: 'AI & ML',
  summary: 'Sinusoidal fingerprints for word order — how attention learns that position exists at all.',
  controls: [
    { id: 'positions', label: 'Show positions', type: 'select', options: ['8', '12'], defaultValue: '8' },
  ],
  run,
};

const D = 8; // encoding dimensions
const BASE = 10000;

function pe(pos, dim) {
  const i = Math.floor(dim / 2);
  const angle = pos / BASE ** ((2 * i) / D);
  return dim % 2 === 0 ? Math.sin(angle) : Math.cos(angle);
}

export function* run(input) {
  const P = parseInt(String(input.positions), 10);
  if (![8, 12].includes(P)) throw new InputError('Pick 8 or 12 positions.');

  const rows = Array.from({ length: P }, (_, p) => ({ id: `p${p}`, label: `pos ${p}` }));
  const cols = Array.from({ length: D }, (_, d) => ({ id: `d${d}`, label: `d${d}` }));
  const table = Array.from({ length: P }, (_, p) => Array.from({ length: D }, (_, d) => pe(p, d)));
  const view = (title) => matrixState({ title, rows, columns: cols, values: table });

  yield {
    state: view('The problem: attention cannot see order'),
    highlight: {},
    explanation: 'Attention compares token content, but content alone does not encode order. If the same token vectors are shuffled, the attention scores shuffle with them. This frame shows the missing invariant: each row needs a position signal before the model can distinguish "dog bites man" from "man bites dog".',
  };

  yield {
    state: view('The sinusoidal position table (Vaswani et al., 2017)'),
    highlight: {},
    explanation: `The sinusoidal table assigns each position a bounded fingerprint. Left columns oscillate quickly, so nearby rows differ; right columns move slowly, so far positions keep a stable coarse signal. Multiple frequencies make position recoverable without one huge counter.`,
    invariant: 'Every value stays in [−1, 1] — position signals never drown out the word embeddings they join.',
  };

  yield {
    state: view('One position = one unique fingerprint'),
    highlight: { active: cols.map((c) => `p3:${c.id}`), range: ['p3'] },
    explanation: `This highlighted row is one position fingerprint: [${table[3].map((v) => v.toFixed(2)).join(', ')}]. The model does not read a position number directly; it reads this pattern added to the token embedding.`,
  };

  yield {
    state: view('One dimension = one frequency'),
    highlight: { active: rows.map((r) => `${r.id}:d0`), compare: rows.map((r) => `${r.id}:d6`) },
    explanation: 'This column view shows one fast clock and one slow clock. The mix matters because angle-addition identities make offsets such as "three tokens back" expressible as linear relationships between rows.',
  };

  yield {
    state: view('Mixed into the embeddings: X + PE'),
    highlight: { found: rows.slice(0, 4).map((r) => r.id) },
    explanation: 'The table is added element-wise to token embeddings. The same word at two positions now becomes two different vectors, so later query-key dot products can depend on both content and order.',
  };

  yield {
    state: view('From sinusoids to RoPE'),
    highlight: {},
    explanation: 'Later models moved the position signal to other places. Learned tables store a vector per position, RoPE rotates queries and keys, and ALiBi biases attention scores by distance. The tradeoff is the same: encode order clearly without breaking longer contexts.',
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Positional encoding is how a Transformer learns word order. Content-only Attention Mechanism is permutation-equivariant: if you shuffle input token vectors, the outputs shuffle the same way. That is not enough for language, where "dog bites man" and "man bites dog" contain the same words but opposite meaning. A position signal makes token 0, token 1, and token 2 numerically different even before attention compares their content.`,
        `The original Transformer used fixed sinusoidal encodings. For position p and dimension pair i, it used sin(p / 10000^(2i/d)) and cos(p / 10000^(2i/d)). Low-index dimensions oscillate quickly; high-index dimensions change slowly. The vector is bounded in [-1, 1], so it can be added to Embeddings & Similarity-style token vectors without exploding their scale. The result is a compact, deterministic coordinate system for sequence order.`,
      ],
    },
    {
      heading: `The obvious wall`,
      paragraphs: [
        `Attention without position is excellent at comparing content, but it does not know sequence order by itself. If the same token vectors are shuffled, a content-only attention layer processes the same set with the same pairwise comparisons. Language, code, music, and time series need order.`,
        `The naive fix is to add an integer position directly, but raw positions have scale and extrapolation problems. Positional encoding turns order into a vector signal that lives in the same space as token embeddings or attention scores.`,
      ],
    },
    {
      heading: `Core insight`,
      paragraphs: [
        `Rows are positions; columns are frequency bands. Fast columns change almost every row, so they mark nearby offsets. Slow columns change gently, so they keep long-range position from wrapping too soon. The row highlight shows one fingerprint; the column highlight shows one clock. The invariant is bounded multi-frequency structure: adding it to token embeddings gives attention order information without making position dominate content.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The sinusoidal design is not random decoration. Angle-addition identities mean the encoding for p + k can be represented as a linear transformation of the encoding for p. That gives the model a learnable handle on relative offsets such as "one token before" or "three tokens after." In practice, the position vector is added element-wise to the token embedding before the first Transformer Block, so every later query, key, and value projection sees content plus order.`,
        `Other schemes move the same information to different places. Learned absolute position embeddings, used in GPT-2, store one trainable vector per position and work well inside the trained context length. RoPE (Rotary Embeddings) rotates query and key pairs at attention time so dot products depend naturally on relative distance. ALiBi adds a distance-based bias directly to attention scores. Multi-Head Attention can then learn different heads that care about local syntax, delimiters, or long-range references.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Fixed sinusoidal tables cost O(Ld) memory for maximum length L and model width d, and they can be precomputed once. Learned absolute embeddings also cost O(Ld), but as trainable parameters. RoPE adds a small O(Ld) rotation to queries and keys; implementations precompute sin/cos values and apply them with fused tensor operations. ALiBi adds distance biases to the attention score matrix, so it rides on top of the O(L^2) attention computation rather than creating a new dominant cost. In all cases, position cost is small compared with attention and feed-forward layers.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Every Transformer family needs some order mechanism. The 2017 Transformer used sinusoids. BERT and GPT-2 used learned absolute positions. T5 used relative position bias. Llama, Mistral, Qwen, and many later decoder models use RoPE-style rotations. Long-context engineering often starts here: position interpolation, NTK-aware scaling, and YaRN-style retuning adjust the frequency schedule so models trained at shorter lengths degrade more gracefully at longer lengths. The position scheme also interacts with the KV Cache, because cached keys must keep position meaning stable as decoding appends tokens.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Position information is not the same as guaranteed position reasoning. The model must learn to use the signal. A learned absolute table can overfit to seen lengths; a fixed sinusoid can extrapolate mathematically but still fail if the model never trained on long-range dependencies. RoPE extrapolates better in many decoder models, but stretching it too far can cause attention to blur or oscillate. Another misconception is that position is only a first-layer concern. In RoPE, position is applied inside every attention layer's query-key geometry, not simply added once at the input.`,
        `Finally, do not confuse absolute and relative position. Absolute encodings label "this is position 128." Relative schemes make "this key is 17 tokens behind this query" easier to express. Many practical successes come from making relative distance natural to the dot product. Lost in the Middle: Long-Context Failure Modes is the behavioral warning: even when position is encoded, models may still use evidence unevenly across a long prompt.`,
      ],
    },
    {
      heading: `Worked example`,
      paragraphs: [
        `In the sentence "dog bites man", the token embeddings for dog, bites, and man carry content. Positional encoding adds different order signals to the three rows before attention runs. The model can then learn that the first noun is the subject-like position and the later noun is the object-like position in this local pattern.`,
        `If you shuffle the words to "man bites dog", the content vectors are the same set, but they receive different position signals. That is the minimum information the transformer needs before attention heads can learn syntax, delimiter matching, or long-range references.`,
      ],
    },
    {
      heading: `Implementation checklist`,
      paragraphs: [
        `Keep position accounting consistent between training, prefill, and decoding. Cached keys must be rotated or biased as if they still occupy their original positions. A one-token offset bug in generation can damage attention everywhere after it.`,
        `When extending context length, test the position scheme directly. Longer tables, RoPE scaling, interpolation, or ALiBi-style biases can all change behavior. Do not assume a model trained at one length will reason well at another length simply because the code accepts more tokens.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `Sinusoidal encodings work because multiple frequencies create a stable coordinate system for both short and long offsets. Fast waves distinguish nearby positions. Slow waves keep far positions from becoming indistinguishable too quickly.`,
        `RoPE works by moving position into query-key geometry. Rotating queries and keys means the dot product can depend on relative displacement, which is exactly what attention often needs: not only "what token is this" but "how far away is that token from me."`,
      ],
    },
    {
      heading: `What to watch in production`,
      paragraphs: [
        `Long-context failures often show up as retrieval behavior, not as obvious position errors. A model may accept a longer prompt but ignore the middle, over-focus on the end, or confuse repeated structures. Position encoding is necessary for order, but it does not guarantee robust long-context reasoning.`,
        `Serving code must preserve position state across batching, prefix caching, truncation, and KV-cache reuse. A cached prefix with wrong offsets can poison every later attention score while leaving tensor shapes valid.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Primary sources: the original Transformer sinusoidal encoding in Attention Is All You Need at https://arxiv.org/abs/1706.03762, RoPE at https://arxiv.org/abs/2104.09864, T5 relative position bias at https://arxiv.org/abs/1910.10683, and ALiBi at https://arxiv.org/abs/2108.12409. Study Attention Mechanism to see why content-only attention needs order. The Transformer Block shows where the signal enters the model. FNet Fourier Token Mixing Case Study shows a fixed global mixer that still needs position information before tokens are transformed. RoPE (Rotary Embeddings) is the modern relative-position workhorse. Multi-Head Attention explains why different heads can exploit position differently, KV Cache shows why appended positions must remain consistent during decoding, and Lost in the Middle: Long-Context Failure Modes shows how position behavior appears in real long-context evaluations. Embeddings & Similarity is the right foundation for understanding why adding or rotating vectors can encode structure at all.`,
      ],
    },
  ],
};
