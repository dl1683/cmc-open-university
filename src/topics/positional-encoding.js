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
      heading: `What it is`,
      paragraphs: [
        `Positional encoding is how a Transformer learns word order. Content-only Attention Mechanism is permutation-equivariant: if you shuffle input token vectors, the outputs shuffle the same way. That is not enough for language, where "dog bites man" and "man bites dog" contain the same words but opposite meaning. A position signal makes token 0, token 1, and token 2 numerically different even before attention compares their content.`,
        `The original Transformer used fixed sinusoidal encodings. For position p and dimension pair i, it used sin(p / 10000^(2i/d)) and cos(p / 10000^(2i/d)). Low-index dimensions oscillate quickly; high-index dimensions change slowly. The vector is bounded in [-1, 1], so it can be added to Embeddings & Similarity-style token vectors without exploding their scale. The result is a compact, deterministic coordinate system for sequence order.`,
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
        `Finally, do not confuse absolute and relative position. Absolute encodings label "this is position 128." Relative schemes make "this key is 17 tokens behind this query" easier to express. Many practical successes come from making relative distance natural to the dot product.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Attention Mechanism to see why content-only attention needs order. The Transformer Block shows where the signal enters the model. RoPE (Rotary Embeddings) is the modern relative-position workhorse. Multi-Head Attention explains why different heads can exploit position differently, and KV Cache shows why appended positions must remain consistent during decoding. Embeddings & Similarity is the right foundation for understanding why adding or rotating vectors can encode structure at all.`,
      ],
    },
  ],
};
