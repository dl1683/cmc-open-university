// RoPE — Rotary Position Embedding: don't ADD position to a vector, ROTATE
// the vector by an angle proportional to its position. Relative offsets
// then fall out of the dot product automatically. The position scheme
// inside Llama, Mistral, and most modern LLMs.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'rope',
  title: 'RoPE (Rotary Embeddings)',
  category: 'AI & ML',
  summary: 'Encode position as rotation — and relative distance falls out of every attention dot product for free.',
  controls: [
    { id: 'theta', label: 'Rotation per position', type: 'select', options: ['30°', '15°'], defaultValue: '30°' },
  ],
  run,
};

const rot = (v, angle) => [
  v[0] * Math.cos(angle) - v[1] * Math.sin(angle),
  v[0] * Math.sin(angle) + v[1] * Math.cos(angle),
];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const Q = [1, 0];
const K = [0.8, 0.6];

export function* run(input) {
  const theta = String(input.theta) === '30°' ? Math.PI / 6 : String(input.theta) === '15°' ? Math.PI / 12 : null;
  if (theta === null) throw new InputError('Pick a rotation angle.');
  const deg = String(input.theta);

  const positions = [0, 1, 2, 3, 4, 5];
  const rotated = positions.map((p) => rot(Q, p * theta));
  const posRows = positions.map((p) => ({ id: `p${p}`, label: `pos ${p}` }));

  yield {
    state: matrixState({
      title: 'The same vector, rotated by position',
      rows: posRows,
      columns: [{ id: 'x', label: 'x' }, { id: 'y', label: 'y' }],
      values: rotated,
    }),
    highlight: {},
    explanation: `Positional Encoding ADDED a position signal to each embedding — workable, but it perturbs the content itself. RoPE's alternative: leave the vector's contents alone and ROTATE it — position p gets rotated by p × ${deg}. Here is one query vector [1, 0] at positions 0 through 5: same length every time, different direction. Position lives in the ANGLE, content in the magnitude — cleanly separated.`,
    invariant: 'Rotation never changes a vector\'s length — the content\'s strength is untouched by position.',
  };

  const pairs = [[2, 0], [5, 3], [4, 2], [3, 0]];
  const dots = pairs.map(([m, n]) => [m, n, dot(rot(Q, m * theta), rot(K, n * theta))]);
  yield {
    state: matrixState({
      title: 'Attention dot products: rotated q (pos m) · rotated k (pos n)',
      rows: pairs.map(([m, n]) => ({ id: `pair${m}_${n}`, label: `m=${m},n=${n}` })),
      columns: [{ id: 'm', label: 'q pos' }, { id: 'n', label: 'k pos' }, { id: 'qk', label: 'q·k' }],
      values: dots,
    }),
    highlight: { active: ['pair2_0:qk', 'pair5_3:qk', 'pair4_2:qk'], compare: ['pair3_0:qk'] },
    explanation: `Now the magic. Rotate a query at position m and a key at position n, take their attention dot product (see Attention Mechanism), and look: (m=2,n=0), (m=5,n=3), (m=4,n=2) — all offset 2 — give EXACTLY the same score, ${dots[0][2].toFixed(4)}. The pair at offset 3 differs. The geometry does it: rotations compose, so the dot product depends only on the angle DIFFERENCE, (m−n)×${deg}. "Three tokens apart" means the same thing at the start of a document and at token 100,000 — relative position by construction, not by training.`,
  };

  yield {
    state: matrixState({
      title: 'Multiple dimension pairs, multiple speeds',
      rows: posRows,
      columns: [{ id: 'fast', label: 'fast pair' }, { id: 'slow', label: 'slow pair' }],
      values: positions.map((p) => [Math.sin(p * theta), Math.sin(p * theta * 0.1)]),
    }),
    highlight: {},
    explanation: 'A real head\'s vector has many dimension PAIRS, each rotating at its own speed (the same geometric frequency ladder as sinusoidal Positional Encoding: θᵢ = 10000^(−2i/d)). Fast pairs resolve fine-grained nearby offsets; slow pairs distinguish "500 tokens back" from "5,000". Together they give attention a full ruler of relative distances.',
  };

  yield {
    state: matrixState({
      title: 'Why RoPE won',
      rows: [{ id: 'r', label: '' }],
      columns: [{ id: 'a', label: 'relative' }, { id: 'b', label: 'norm-safe' }, { id: 'c', label: 'cache-friendly' }],
      values: [[1, 1, 1]],
    }),
    highlight: {},
    explanation: 'Three properties made RoPE the modern default (Llama, Mistral, Qwen, and most frontier models): relative offsets are EXACT, not learned approximations; vector norms are preserved, so position never drowns content; and the rotation is applied to Q and K at attention time — the rotated keys sit happily in the KV Cache. Long-context engineering builds directly on it: stretching the rotation frequencies (position interpolation, NTK scaling, YaRN) is how 4K-token models were extended toward million-token contexts without retraining from scratch.',
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `RoPE, short for rotary position embedding, encodes position by rotating query and key vectors instead of adding a separate position vector to token embeddings. Su et al. introduced it in the 2021 RoFormer paper, and it became common in Llama, Mistral, Qwen, and many other decoder models because it gives attention a natural notion of relative distance while preserving vector norms.`,
        `The contrast with Positional Encoding is the key. A sinusoidal input encoding adds numbers to the embedding before the model starts. Rotary encoding waits until Attention Mechanism forms Q and K, then rotates each 2D dimension pair by an angle proportional to token position. Content stays in the vector components; position enters as phase. The dot product between a rotated query and rotated key then depends on their relative offset in a mathematically clean way.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Each adjacent pair of dimensions is treated as a 2D plane. For position p and frequency index i, the pair rotates by p times theta_i, with theta_i usually following a geometric ladder such as base^(-2i/d). Fast frequencies distinguish local offsets; slow frequencies keep long-range offsets from wrapping too quickly. In matrix form, each pair uses the familiar rotation [x cos a - y sin a, x sin a + y cos a], the same geometry behind Eigenvalues & Eigenvectors lessons on linear transformations.`,
        `The useful identity is R_m(q) dot R_n(k) = q dot R_(n-m)(k), up to the sign convention. That means the position part of the query-key score is a function of relative distance, not an arbitrary absolute label. Be precise: two pairs with the same offset do not automatically have identical scores if their content vectors q and k differ. RoPE says the positional transformation depends on m - n; the learned content still matters.`,
        `In Multi-Head Attention, each head applies this rotation to its own Q and K dimensions. Values are usually not rotated. The rotated keys are what the KV Cache stores during decoding, so future queries can compare against position-aware cached keys without recomputing the old tokens.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `RoPE adds O(Ld) work to rotate queries and keys for L tokens and width d, small beside O(L^2 d) attention prefill and O(Ld) per-token cached attention. Implementations precompute sin and cos tables and use fused elementwise operations, so they do not call trigonometric functions in the inner loop. It adds no learned position parameters. The cache cost is indirect: keys must be stored after the correct rotation, and long-context scaling changes the frequency schedule that produced those rotations.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `RoPE is standard in many open decoder families: Llama, Mistral, Mixtral, Qwen, and several DeepSeek models. It is especially important in long-context adaptation. Position interpolation rescales positions so more tokens fit into the angle range the model saw during training. NTK-aware scaling changes the base frequencies. YaRN combines interpolation and extrapolation with extra tuning. These methods helped models trained at 2K, 4K, or 8K context stretch to much larger windows, although quality still depends on training data and attention implementation.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Do not say RoPE makes a model length-infinite. Frequencies can wrap, training may never teach the model to use far-away evidence, and attention kernels still pay for long contexts. Do not say it erases absolute position either; the model can still infer absolute-ish cues through boundaries, prompts, and layer interactions. And do not describe it as simple addition. Rotary encoding is an operator applied to Q and K, so it changes attention code, cache contents, and long-context scaling knobs.`,
        `Another misconception is that all RoPE scaling recipes are interchangeable. Position interpolation, NTK-aware scaling, and YaRN move different parts of the frequency ladder and can trade local precision for long-range stability. A model can pass short benchmarks after scaling while losing retrieval accuracy at 64K tokens, so evaluation must include long-context tasks, not just perplexity near the training length. Lost in the Middle: Long-Context Failure Modes is the evaluation companion to the rotation math.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Primary sources: RoFormer/RoPE at https://arxiv.org/abs/2104.09864, Llama 2's use of RoPE in long-context decoder models at https://arxiv.org/abs/2307.09288, YaRN at https://arxiv.org/abs/2309.00071, and the original Transformer position baseline at https://arxiv.org/abs/1706.03762. Start with Positional Encoding for the original sinusoidal frequency ladder. Then read Attention Mechanism to see where Q and K are born, Multi-Head Attention to see how every head gets its own rotated subspace, and KV Cache to understand why rotated keys are stored during decoding. Lost in the Middle: Long-Context Failure Modes explains why long-context behavior still needs position-swept evaluation after the math works. The Transformer Block shows where the rotated attention output fits in the larger layer. If the rotation math feels abstract, Eigenvalues & Eigenvectors gives the linear-algebra foundation.`,
      ],
    },
  ],
};
