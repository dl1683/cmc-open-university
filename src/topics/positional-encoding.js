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
      heading: 'How to read the animation',
      paragraphs: [
        'The matrix is a sinusoidal position table. Each row is a sequence position (0, 1, 2, ...). Each column is one dimension of the encoding vector, running at a different frequency. Highlighted cells mark the row or column currently under inspection.',
        {type: 'callout', text: 'Position encoding breaks attention symmetry by giving the same token different vectors at different sequence locations.'},
        'When a full row lights up, you see that position\'s fingerprint -- the vector that gets added to the token embedding. The numbers are all between -1 and 1. When a full column lights up, you see one frequency across every position: left columns oscillate fast (nearby positions look very different), right columns oscillate slowly (distant positions are still distinguishable).',
        'The comparison view highlights a fast column and a slow column side by side so you can see the multi-scale structure directly. Found markers on the first few rows show positions that have been merged with token embeddings via element-wise addition.',
        'The invariant: every cell stays in [-1, 1]. Position information never overwhelms the content it joins.',
      
        {type: 'image', src: './assets/gifs/positional-encoding.gif', alt: 'Animated walkthrough of the positional encoding visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Self-attention compares token vectors with dot products. Without an order signal, the set of token vectors is the same for "the cat sat" and "sat cat the." The model sees content but not position.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Absolute_positional_encoding.png/250px-Absolute_positional_encoding.png', alt: 'Heatmap of sinusoidal absolute positional encodings', caption: 'Sinusoidal encodings turn each row position into a multi-frequency fingerprint. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Absolute_positional_encoding.png.'},
        'A positional encoding is a vector added to or mixed into each token representation to mark where the token sits. The same word at positions 3 and 7 must become different internal vectors. Every later attention layer can then use both content and order.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest idea is to use the integer position. Token 0 gets 0, token 1 gets 1, and token 999 gets 999. The model now receives order information with almost no machinery.',
        'Another simple idea is a one-hot position vector. Position 7 gets a vector with one active slot and every other slot zero. This avoids large integer magnitude, but it fixes the maximum context length in the vector width.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Integer positions grow without bound. Position 1000 can numerically drown out embedding values that usually live near small real numbers. A model trained only through position 512 also has no reason to understand what 513 should mean.',
        'One-hot positions avoid the magnitude problem but cannot extrapolate. A table with 512 slots has no slot 513. Learned absolute embeddings have the same boundary unless the model is retrained or extended with a special procedure.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Represent position as many bounded clocks at different frequencies. Fast sine and cosine dimensions separate nearby positions, while slow dimensions keep changing over long distances. The whole vector stays bounded between -1 and 1.',
        'The paired sine and cosine dimensions also preserve relative offset information. Moving from position p to p + k is a rotation by an amount determined by k. That gives attention layers a learnable handle for patterns such as "the previous token" or "ten tokens back."',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For model width d, sinusoidal encoding uses PE(pos, 2i) = sin(pos / 10000^(2i/d)) and PE(pos, 2i+1) = cos(pos / 10000^(2i/d)). The index i selects a frequency pair. Smaller i changes quickly; larger i changes slowly.',
        'At runtime, the model looks up the row for each token position and adds it element by element to the token embedding. Learned absolute embeddings use the same lookup-and-add shape, but the table values are trained parameters. RoPE instead rotates query and key vector pairs inside attention, so their dot product directly depends on relative displacement.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Sinusoidal encoding works because it is bounded, structured, and multi-scale. Bounded values do not overwhelm content embeddings. Multiple frequencies make nearby and far positions distinguishable at the same time.',
        'The correctness argument is the angle-addition identity. Sine and cosine at position p + k can be computed as a fixed linear transformation of sine and cosine at p, with coefficients depending only on k. A later linear layer can therefore learn relative offsets from absolute sinusoidal rows.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A sinusoidal table costs O(L * d) memory for maximum sequence length L and width d. It is computed once and has no trainable parameters. Doubling context length doubles the table, but attention itself grows much faster because full attention is O(L^2 * d).',
        'Learned embeddings also cost O(L * d), but they add trainable parameters and cannot represent positions outside the initialized table. RoPE stores or computes sine and cosine values and applies cheap pairwise rotations to queries and keys. In practice, the dominant cost remains attention and feed-forward layers, not position encoding.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The original Transformer used sinusoidal encodings. BERT and GPT-2 used learned absolute position embeddings. Many modern decoder models use RoPE because relative distance falls naturally out of the query-key dot product.',
        'Long-context work is often position-encoding work. Position interpolation, NTK-aware RoPE scaling, and YaRN adjust the frequency behavior so a model trained at one length can operate at a longer length. Serving systems must also preserve exact position indices in KV caches, because cached keys already contain their position information.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A valid encoding does not guarantee good long-context behavior. A model trained on 2,048-token examples may have a defined vector at position 10,000, but its attention patterns were not trained for that distance. The representation exists; the learned use of it may fail.',
        'Absolute learned embeddings fail hard beyond their table. RoPE extrapolates better but can blur or oscillate when stretched too far without scaling and fine-tuning. No position scheme alone fixes lost-in-the-middle behavior, retrieval mistakes, or weak training data.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use d = 4 and base 10000. Pair i = 0 has divisor 1, so dimensions 0 and 1 use sin(pos) and cos(pos). Pair i = 1 has divisor 100, so dimensions 2 and 3 use sin(pos / 100) and cos(pos / 100).',
        'Position 0 is [0.000, 1.000, 0.000, 1.000]. Position 1 is [0.841, 0.540, 0.010, 1.000]. Position 2 is [0.909, -0.416, 0.020, 1.000].',
        'The fast pair changes sharply from position 0 to 2, while the slow pair barely changes. If "cat" has embedding e and appears at position 1, the model sees e + PE(1). If the same "cat" appears at position 2, the content part is the same but the position fingerprint differs.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Vaswani et al., Attention Is All You Need, 2017; Su et al., RoFormer: Enhanced Transformer with Rotary Position Embedding, 2021; Press et al., Train Short, Test Long: Attention with Linear Biases Enables Input Length Extrapolation, 2022; Chen et al., Extending Context Window of Large Language Models via Positional Interpolation, 2023; Peng et al., YaRN, 2023.',
        'Study next: Attention Mechanism for why content-only attention is order-blind, Transformer Block for where the encoding enters the network, RoPE for modern relative position behavior, ALiBi for score-bias alternatives, and KV Cache for serving bugs caused by position-index drift.',
      ],
    },
  ],
};

