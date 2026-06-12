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
    explanation: 'A dirty secret of the Attention Mechanism: it treats its input as a SET. Every token attends to every other by content alone — shuffle the words and all the query-key dot products come out identical. "Dog bites man" and "man bites dog" would be THE SAME SENTENCE. Word order, the backbone of meaning, is invisible — unless we inject it into the numbers ourselves.',
  };

  yield {
    state: view('The sinusoidal position table (Vaswani et al., 2017)'),
    highlight: {},
    explanation: `The original Transformer's answer, computed for real here: position p, dimension pair i gets sin(p / ${BASE}^(2i/${D})) and cos(of the same). Read the heatmap's STRUCTURE: leftmost columns oscillate fast down the rows; rightmost columns barely move. It is binary counting made continuous — low bits flipping quickly, high bits slowly — so every position gets a unique multi-frequency fingerprint.`,
    invariant: 'Every value stays in [−1, 1] — position signals never drown out the word embeddings they join.',
  };

  yield {
    state: view('One position = one unique fingerprint'),
    highlight: { active: cols.map((c) => `p3:${c.id}`), range: ['p3'] },
    explanation: `Row view: position 3's fingerprint is [${table[3].map((v) => v.toFixed(2)).join(', ')}] — no other row matches it (and none ever will: the wavelengths are geometric, so the pattern doesn't repeat for ~${BASE} positions). A model reading this vector knows exactly where in the sentence it is standing.`,
  };

  yield {
    state: view('One dimension = one frequency'),
    highlight: { active: rows.map((r) => `${r.id}:d0`), compare: rows.map((r) => `${r.id}:d6`) },
    explanation: 'Column view: d0 swings through a full wave every ~6 positions, while d6 changes glacially. Why multiple frequencies? RELATIVE offsets: thanks to the angle-addition identities, the encoding of position p+k is a fixed LINEAR function of position p\'s encoding for any offset k — so "three words back" becomes something attention\'s matrices can literally learn as a rotation. The design isn\'t pretty for its own sake; it makes relative position learnable.',
  };

  yield {
    state: view('Mixed into the embeddings: X + PE'),
    highlight: { found: rows.slice(0, 4).map((r) => r.id) },
    explanation: 'Deployment is one addition: token embeddings + position fingerprints, element-wise (you saw this as "step 1" inside The Transformer Block — the small position drift in the input matrix). The same word at different positions now produces slightly different vectors, and attention\'s Q·K dot products become order-AWARE: "dog bites man" finally differs from "man bites dog".',
  };

  yield {
    state: view('From sinusoids to RoPE'),
    highlight: {},
    explanation: 'The idea evolved: GPT-2 simply LEARNED a vector per position (works, but caps the context length at training time); modern LLMs — Llama, Mistral, most frontier models — use RoPE (Rotary Position Embedding), which ROTATES each query and key by an angle proportional to its position, making relative offsets exact by construction; ALiBi instead biases attention scores by distance. Different mechanics, same necessity, and it is suddenly front-page engineering again: stretching these encodings gracefully is a key piece of how contexts grew from 2K tokens to millions.',
  };
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        `Positional encoding is the mathematical trick that teaches attention "where" a token sits in a sequence. The Attention Mechanism is permutation-invariant — it treats tokens as an unordered set, comparing each token's content to every other by dot products of learned queries and keys. This means "dog bites man" and "man bites dog" produce identical attention patterns unless you explicitly inject position information into the model. Positional encoding solves this by adding a unique, learnable fingerprint to each position's embedding.`,
        `The original solution, from "Attention Is All You Need" (Vaswani et al., 2017), uses sinusoidal waves at geometric wavelengths. Position p, dimension i gets a combination of sine and cosine of p / 10000^(2i/d), where d is the embedding dimension. This creates a lookup table: every row (position) is geometrically unique, and every column (frequency band) oscillates at a different rate — low bits flipping fast like binary counting, high bits drifting slowly. The values stay bounded in [−1, 1], so they never drown out the word content when added together.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `The math rests on angle-addition identities from trigonometry. When you add a constant offset k to position p, the sinusoidal encoding of p+k is a fixed linear function of p's encoding. This means relative position becomes something attention's learned weight matrices can capture exactly as a rotation — "three tokens back" is not a special case, but a learnable geometric transformation. The design compresses information efficiently: a 512-dimensional embedding holds position signals in its structure, not as sparse one-hot vectors.`,
        `Deployment is simple and elegant: X + PE. You add the positional encoding (a D-dimensional vector per position) directly to each token's word embedding, element-wise, before feeding the combined matrix into the Transformer Block. Both the position signal and the word signal are now entangled in the same vector. Attention can now distinguish "the cat sat" from "sat the cat" because the same word "the" produces different vectors depending on where it appears, and the dot products reflect order.`,
        `The idea has evolved significantly. GPT-2 simplified it by learning a separate embedding vector for each position up to a maximum context length — faster to train but brittle when you need longer sequences. Modern large language models — Llama, Mistral, and others — use Rotary Position Embeddings (RoPE), which rotate the query and key vectors by an angle proportional to position, making relative offsets mathematically exact. An alternative, Attention with Linear Biases (ALiBi), skips position embeddings entirely and instead biases the attention scores by the distance between query and key positions. Each approach trades off learnability, extrapolation to longer contexts, and computational cost.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Sinusoidal encoding is computationally free — the table is computed once, stored, and reused across the entire model. The math is deterministic, requiring only sin/cos evaluations and no parameters. RoPE adds a small rotation overhead per attention head (a 2×2 rotation matrix in the complex plane, applied at inference), but remains O(1) per token. ALiBi adds an O(L²) term during attention (one bias per query-key pair), but eliminates embedding computation entirely. For the original Vaswani approach, the only cost is memory for the position table itself, which grows with context length L and dimension d — typically negligible compared to the model's weight matrices.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Every Transformer-based model uses positional encoding in some form. The sinusoidal version remains the reference baseline, but practical systems have diverged: GPT-3 and earlier models used learned embeddings; Llama (2023 onward) and Mistral switched to RoPE to handle longer contexts gracefully; recent frontier models stretch or interpolate position signals to train on longer sequences and inference on even longer ones — a critical engineering challenge as context windows grew from 2K tokens in 2017 to millions today. The choice of encoding scheme significantly impacts extrapolation: RoPE extrapolates better to unseen position ranges than fixed learned embeddings, which is why it became the production standard.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `Many students assume position encoding "solves" the attention's permutation invariance problem completely — it does not. It injects positional information into embeddings, but attention still processes sequences as sets. Attention learns to use position signals just as it learns to use word embeddings; nothing forces it to. In practice, models learn this readily, but the connection is learned, not baked in. Another misconception: that sinusoidal encoding is "optimal" — it is convenient and works, but there is no proof it is better than learned or rotational encodings for all tasks. Finally, many overlook context-length extrapolation: an encoding learned on 2K-token sequences may fail gracefully or catastrophically beyond that range, depending on its design. RoPE's success owes partly to its extrapolation properties, not just elegance.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `To understand why position encoding matters, you need the Attention Mechanism and The Transformer Block, which show how attention processes sequences. Multi-Head Attention reveals how multiple independent attention heads—each with its own position view—combine to capture different relational patterns. KV Cache explains how positional encodings enable efficient inference when you extend a sequence token by token. Embeddings & Similarity covers how word embeddings and position signals combine in the input space, and why both are necessary for a model to reason about language.`,
      ],
    },
  ],
};

