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
        'When a full row lights up, you see that position\'s fingerprint -- the vector that gets added to the token embedding. The numbers are all between -1 and 1. When a full column lights up, you see one frequency across every position: left columns oscillate fast (nearby positions look very different), right columns oscillate slowly (distant positions are still distinguishable).',
        'The comparison view highlights a fast column and a slow column side by side so you can see the multi-scale structure directly. Found markers on the first few rows show positions that have been merged with token embeddings via element-wise addition.',
        'The invariant: every cell stays in [-1, 1]. Position information never overwhelms the content it joins.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Attention is permutation-invariant. Feed it the tokens ["the", "cat", "sat"] or ["sat", "the", "cat"] and it produces identical attention scores -- the same set of content vectors yields the same dot products regardless of order. "The cat sat on the mat" and "sat mat the the on cat" are indistinguishable. Language, code, music, and DNA all depend on order. Without an explicit signal, the model is working with a bag of words.',
        'Vaswani et al. (2017) fixed this in the original Transformer by adding a position-dependent vector to each token embedding before the first attention layer. That addition breaks permutation symmetry: the same word at position 3 and position 7 now has a different representation. Every subsequent scheme -- learned embeddings, RoPE, ALiBi -- solves the same root problem: attention must know where tokens sit, not just what they say.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Use an integer: PE(pos) = pos. Position 0 gets 0, position 1 gets 1, position 999 gets 999. Add it to the embedding (or concatenate it as an extra dimension) and the model can see order.',
        'This works for toy examples. It is not stupid -- it is the simplest encoding that carries position information at all, and for a 10-token sequence the magnitudes are small enough to coexist with content.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Integer encoding breaks in two ways. First, magnitude: position 1000 adds a value 1000x larger than position 1. The model now sees position far more loudly than content, and the gradient dynamics shift depending on where a token happens to sit. Second, generalization: a model trained on sequences of length 512 has never seen the value 513. The encoding is unbounded and gives no structural hint about what 513 means relative to 512.',
        'One-hot position vectors fix the magnitude problem (every position is a unit vector) but kill generalization entirely. The vector is as wide as the maximum length, positions beyond that width have no representation, and the scheme wastes dimensions on positions that rarely appear. Both approaches treat position as a raw number rather than a structured, bounded signal the model can reason about.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Sinusoidal encoding (Vaswani et al. 2017) represents each position as a vector of sines and cosines at geometrically spaced frequencies. The formula for position pos and dimension index i in a model of width d: PE(pos, 2i) = sin(pos / 10000^(2i/d)), PE(pos, 2i+1) = cos(pos / 10000^(2i/d)). Each dimension pair (2i, 2i+1) is a clock. Low-index pairs tick fast -- dimension 0 has period 2*pi, about 6.3 positions. High-index pairs tick slowly -- the last pair has period 10000 * 2*pi, about 62,800 positions. Fast clocks separate nearby positions; slow clocks separate distant ones. Every value stays in [-1, 1], and no two positions produce the same vector.',
        'The full PE table is precomputed once for the maximum sequence length and stored. At runtime, each token embedding is summed element-wise with its PE row before the first attention layer. Every later computation -- queries, keys, values, feed-forward -- sees content fused with order in a single vector.',
        'Learned positional embeddings (BERT, GPT-2) replace the formula with a trainable matrix of shape [max_length, d]. Each position gets its own learned vector. This is flexible -- the model can discover arbitrary position patterns -- but it hard-caps context length at training time. Position max_length + 1 has no representation at all.',
        'RoPE -- Rotary Position Embedding (Su et al. 2021) -- takes a different approach. Instead of adding a vector at the input, it rotates query and key vectors by position-dependent angles inside every attention layer. Pair dimensions (q_2i, q_{2i+1}) by a rotation matrix with angle pos * theta_i, where theta_i = 1/10000^(2i/d). When queries at position m and keys at position n compute their dot product, the result depends on the angle difference (m - n) * theta_i -- relative displacement, not absolute index. RoPE powers LLaMA, Mistral, Qwen, GPT-NeoX, and most post-2022 decoder models.',
        'ALiBi (Press et al. 2022) skips embedding-level position entirely. It subtracts a linear penalty m * |i - j| from each raw attention score, where m is a per-head slope. Nearby tokens keep high scores; distant tokens are penalized proportionally. No learned parameters, no precomputed table. ALiBi powers BLOOM and extrapolates to longer sequences by construction, though it cannot learn non-monotonic position patterns where a distant token should attend more strongly than a near one.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Sinusoidal encoding satisfies three properties at once. Boundedness: all values lie in [-1, 1], so position never drowns out content. Uniqueness: geometrically spaced frequencies ensure distinct vectors for every practical position. Relative-offset linearity: the angle-addition identity sin(a + b) = sin(a)cos(b) + cos(a)sin(b) means PE(pos + k) is a fixed linear transformation of PE(pos), independent of pos. The model can learn this linear map in its weight matrices and use it to express "three tokens back" as a single learned operation.',
        'The dot product between two sinusoidal PE vectors is a function of their distance, not their absolute positions. PE(3) . PE(5) and PE(100) . PE(102) give the same value because the per-dimension phase differences depend only on the offset. This is the mathematical property that makes relative position recoverable from an absolute encoding.',
        'RoPE makes relative offset even more direct. Rotating query-key pairs means the inner product depends only on displacement m - n. The rotation preserves vector norms, so position does not distort content magnitude. The model naturally computes "how far back is that key" rather than "what is the absolute index of this token."',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Sinusoidal PE costs O(L * d) memory for sequence length L and model width d. It is computed once, stored, and never updated by gradients. Zero training cost.',
        'Learned embeddings cost O(L * d) trainable parameters. Gradient updates are cheap per position, but the table size is fixed at initialization and cannot grow.',
        'RoPE precomputes sin/cos values of size O(L * d) and applies an element-wise rotation to queries and keys in every attention layer. The per-layer cost is a small multiply -- negligible next to the O(L^2 * d) attention dot products. Implementations fuse the rotation into the Q/K projection kernel so it adds no visible latency.',
        'In all cases, position encoding is a tiny fraction of total compute. The dominant costs are the attention matrix (O(L^2 * d)) and the feed-forward layers (O(L * d^2)). Doubling model width quadruples feed-forward cost but only doubles PE cost.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Every Transformer needs position information. The split is which scheme. The original Transformer (2017) used sinusoids. BERT and GPT-2 used learned absolute embeddings. T5 introduced relative position bias (learned per-head distance tables). LLaMA, Mistral, Qwen, and most post-2022 decoders use RoPE. BLOOM uses ALiBi.',
        'Long-context engineering is position engineering. Position interpolation (Chen et al. 2023) scales RoPE frequencies to cover longer contexts without retraining from scratch. NTK-aware scaling adjusts the frequency base to preserve high-frequency resolution while extending range. YaRN (Peng et al. 2023) combines interpolation with attention temperature adjustment. All of these modify position encoding so a model trained at one length works at 2-8x that length with minimal fine-tuning.',
        'Position encoding interacts directly with the KV cache. Cached keys store their position information at write time. If position indices shift during batching, prefix caching, or truncation, every cached attention score silently becomes wrong while tensor shapes stay valid. This is one of the most common silent correctness bugs in serving infrastructure.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Sinusoidal PE can represent arbitrary positions mathematically, but in practice models do not extrapolate well to lengths far beyond training. The encoding is theoretically clean; the learned attention patterns are not. A model trained on 2,048 tokens has never learned to attend across 10,000-token gaps, and a valid encoding does not fix that.',
        'Learned absolute embeddings cannot extrapolate at all. Position 513 in a 512-position model has no embedding -- the lookup table ends. Even within the trained range, the model may learn position-specific biases that break when context is shifted or truncated.',
        'RoPE extrapolates better than absolute schemes, but stretching it beyond 2-4x training length without interpolation causes attention patterns to blur or oscillate. The rotation angles become unfamiliar and output quality degrades. NTK-aware scaling and YaRN partially fix this, but they require fine-tuning to work reliably.',
        'No scheme solves arbitrary-length generalization. Even with good position encoding, the "Lost in the Middle" phenomenon (Liu et al. 2023) shows models attend strongly to the start and end of a context while underweighting the middle. Position encoding is necessary for order, but it does not guarantee that the model will use position uniformly across all distances.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Compute sinusoidal PE for 4 positions with d = 4. The formula uses base 10000. Dimension pair i = 0 has divisor 10000^(0/4) = 1. Dimension pair i = 1 has divisor 10000^(2/4) = 100.',
        'Position 0: [sin(0/1), cos(0/1), sin(0/100), cos(0/100)] = [0.000, 1.000, 0.000, 1.000]. All sines are zero, all cosines are one. This is the origin.',
        'Position 1: [sin(1), cos(1), sin(0.01), cos(0.01)] = [0.841, 0.540, 0.010, 1.000]. The fast pair (dims 0-1) moved substantially. The slow pair (dims 2-3) barely shifted.',
        'Position 2: [sin(2), cos(2), sin(0.02), cos(0.02)] = [0.909, -0.416, 0.020, 1.000]. The fast pair has nearly peaked in the sine and crossed zero in the cosine.',
        'Position 3: [sin(3), cos(3), sin(0.03), cos(0.03)] = [0.141, -0.990, 0.030, 1.000]. The fast pair is heading back toward zero. The slow pair has moved by only 0.03 total.',
        'Dot product similarity matrix (each entry is PE(a) . PE(b), showing how similar two positions look to the model): positions 0-1: 0.46, positions 0-2: -0.41, positions 0-3: -0.85, positions 1-2: 0.99, positions 1-3: 0.65, positions 2-3: 0.27. Adjacent positions (1-2) have high similarity; distant positions (0-3) have low or negative similarity. The dot product depends on distance, not absolute index -- PE(0) . PE(1) equals PE(100) . PE(101) because the per-dimension phase differences are the same.',
        'In practice, these PE vectors are added element-wise to token embeddings. "The cat sat" becomes [embed("the") + PE(0), embed("cat") + PE(1), embed("sat") + PE(2)]. Reorder to "sat the cat" and each word gets a different PE row, so attention can tell subject from object even when the content embeddings are the same set.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Vaswani et al., "Attention Is All You Need," 2017 -- sinusoidal positional encoding. Su et al., "RoFormer: Enhanced Transformer with Rotary Position Embedding," 2021 -- RoPE. Press et al., "Train Short, Test Long: Attention with Linear Biases Enables Input Length Extrapolation," 2022 -- ALiBi. Chen et al., "Extending Context Window of Large Language Models via Positional Interpolation," 2023. Peng et al., "YaRN: Efficient Context Window Extension of Large Language Models," 2023. Liu et al., "Lost in the Middle: How Language Models Use Long Contexts," 2023.',
        'Study next -- prerequisite gaps: Attention Mechanism (why content-only attention is order-blind), Word Embeddings (the vectors that PE adds to). Natural extensions: Transformer Block (where PE enters the full architecture), RoPE / Rotary Embeddings (the dominant relative-position scheme in modern decoders). Contrasting alternatives: ALiBi (position as attention-score bias), T5 relative position bias (learned per-head distance tables). Production concerns: KV Cache (cached keys must preserve position indices during autoregressive decoding).',
      ],
    },
  ],
};
