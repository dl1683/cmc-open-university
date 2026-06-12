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
      heading: 'What it is',
      paragraphs: [
        `RoPE (Rotary Position Embedding) encodes position not by adding a signal to a vector, but by rotating the vector's direction — leaving its magnitude untouched. Instead of "add position 5 to the embedding," RoPE says "spin the embedding by 5 times θ radians." The position lives entirely in the angle, the content entirely in the amplitude. This design was introduced by Su et al. in the 2021 RoFormer paper and has become the default positional encoding in Llama, Mistral, Qwen, and most frontier language models.`,
        `The core insight is geometric: when two rotated vectors are dot-produced in an attention head, the result depends only on the difference between their rotation angles, not their absolute positions. This means the attention score between tokens at positions m and n is the same whether they appear at the start of a document or at token 100,000 — the relative offset is baked into the geometry itself.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `RoPE treats each pair of embedding dimensions as a 2D plane rotating independently. For position p, dimension-pair i rotates by angle p × θᵢ, where θᵢ = 10000^(−2i/d) — the same frequency ladder used in sinusoidal Positional Encoding. The rotation is applied separately to Q (queries) and K (keys) in the attention mechanism, with each pair spinning at its own frequency. Fast-spinning pairs resolve fine-grained offsets like "the token next door," while slow-spinning pairs distinguish long-range distances like "500 tokens back" from "5,000 back." Together they form a multi-speed ruler of relative distances.`,
        `The magic emerges in the dot product. If a query at position m is rotated by angle m × θ and a key at position n is rotated by n × θ, then rotating both, computing their dot product depends only on (m − n) × θ — the relative offset. Two token pairs separated by exactly 3 positions will produce identical attention scores regardless of where in the document they appear. This is why relative positions fall out "for free": the mathematics of rotation composition delivers it.`,
        `The rotation is numerically computed as a 2D transformation: if v = [v₀, v₁], the rotated vector is [v₀ cos(pθ) − v₁ sin(pθ), v₀ sin(pθ) + v₁ cos(pθ)]. Crucially, rotation preserves the vector's norm (length) — a fact called the rotation invariant. Position never bleeds into the magnitude; content strength remains untouched.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `RoPE is computationally cheap. Each dimension pair requires two sin/cos calls and four multiply-add operations, all cached for reuse. Applying RoPE to a batch of queries and keys at attention time has negligible overhead compared to the attention matrix multiplication itself. The real-world cost in Llama and Mistral is beneath the noise floor. Unlike some positional encodings that require learning extra parameters, RoPE uses only the sin/cos trigonometry built into every processor.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `RoPE is the foundation of position encoding in virtually every frontier large language model. Llama (7B through 70B), Mistral (7B, Mixture-of-Experts variants), Qwen (1.5B through 72B), and DeepSeek all use RoPE by default. Its relative-position invariance made it the natural choice for extending models beyond their training length without expensive retraining. Long-context engineering layers RoPE stretching techniques atop it: position interpolation shrinks the rotation frequencies to fit more tokens into the same angular space; NTK (Neural Tangent Kernel) scaling adjusts frequencies dynamically; YaRN (Yet another RoPE extensioN) combines both with tuning for optimal coherence. These techniques have stretched 4K-token models toward million-token contexts — a jump that would be impossible with absolute positional encodings.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `A common misconception is that RoPE is "just sinusoidal encoding applied differently." It is not. Sinusoidal Positional Encoding adds sin/cos signals *into* the embedding, mixing position directly into content. RoPE applies the sin/cos to build a rotation *operator* that transforms the embedding's direction without touching its magnitude. The encoding itself never appears in the embedding — only its effect (the rotated vector) does. Practical consequence: sinusoidal encoding can be added at the embedding layer and used everywhere; RoPE must be applied at attention time, after Q and K are computed, which is why it requires API changes to attention mechanisms.`,
        `Another pitfall: assuming all "stretching" techniques are equally effective. YaRN, position interpolation, and NTK scaling all work by retuning the frequency ladder θᵢ, but they differ in how aggressively they stretch and how well they preserve coherence at extreme lengths. Context-length scaling has hard limits (models eventually lose coherence because they were trained on short contexts), and no amount of frequency stretching fixes that — stretching buys graceful degradation, not infinite length.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Dive into the Attention Mechanism to see where RoPE's rotations are applied in Q and K. Study Positional Encoding to understand the sin/cos frequency ladder and how RoPE differs from additive schemes. Explore the KV Cache to see why cache-friendly positioning (rotation at query/key time, not embedding time) is critical for inference speed. Review The Transformer Block to see how position, attention, and feedforward layers interact. And learn Multi-Head Attention to understand how multiple dimension pairs each run RoPE at their own frequencies to build a full ruler of offsets.`,
      ],
    },
  ],
};

