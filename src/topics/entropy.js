// Entropy: surprise, measured in bits. The floor under every compressor,
// the loss under every LLM, the math that says how much a message really
// weighs. One quantity threading half this site together.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'entropy',
  title: 'Entropy & Information',
  category: 'Concepts',
  summary: 'Information = surprise = −log p. From coin flips to compression floors to the LLM training loss.',
  controls: [
    { id: 'view', label: 'Trace', type: 'select', options: ['from surprise to LLM loss'], defaultValue: 'from surprise to LLM loss' },
  ],
  run,
};

const log2 = (x) => Math.log(x) / Math.LN2;
const entropy = (dist) => dist.reduce((h, p) => (p > 0 ? h - p * log2(p) : h), 0);
const crossEntropy = (p, q) => p.reduce((h, pi, i) => (pi > 0 ? h - pi * log2(q[i]) : h), 0);

const OUTCOMES = ['sun', 'cloud', 'rain', 'snow'];
const CERTAIN = [1, 0, 0, 0];
const UNIFORM = [0.25, 0.25, 0.25, 0.25];
const SKEWED = [0.7, 0.2, 0.05, 0.05];

export function* run(input) {
  if (String(input.view) !== 'from surprise to LLM loss') throw new InputError('Pick the walkthrough.');

  const curve = {
    id: 'info',
    label: '−log₂(p)',
    points: Array.from({ length: 99 }, (_, i) => {
      const p = (i + 1) / 100;
      return { x: p, y: -log2(p) };
    }),
  };
  yield {
    state: plotState({
      axes: { x: { label: 'probability of the event' }, y: { label: 'information (bits)' } },
      series: [curve],
      markers: [
        { id: 'coin', x: 0.5, y: 1, label: 'coin flip: 1 bit' },
        { id: 'rare', x: 0.01, y: -log2(0.01), label: 'p=1%: 6.6 bits' },
      ],
    }),
    highlight: {},
    explanation: 'Shannon\'s 1948 move: make "information" a NUMBER by equating it with SURPRISE. An event with probability p carries −log₂(p) bits. A fair coin flip: 1 bit. Something certain (p = 1): zero bits — no news. A 1-in-100 event: 6.6 bits. The log is what makes information ADD UP: two independent coin flips = 2 bits, because probabilities multiply while logs add.',
  };

  const dists = [
    { id: 'certain', label: 'certain', p: CERTAIN },
    { id: 'skewed', label: 'skewed', p: SKEWED },
    { id: 'uniform', label: 'uniform', p: UNIFORM },
  ];
  yield {
    state: matrixState({
      title: 'Entropy H = expected surprise, in bits per outcome',
      rows: dists.map((d) => ({ id: d.id, label: d.label })),
      columns: [...OUTCOMES.map((o, j) => ({ id: `o${j}`, label: o })), { id: 'H', label: 'H (bits)' }],
      values: dists.map((d) => [...d.p, entropy(d.p)]),
      format: (v) => (Number.isInteger(v) ? String(v) : v.toFixed(2)),
    }),
    highlight: { active: dists.map((d) => `${d.id}:H`) },
    explanation: `ENTROPY is a whole distribution's average surprise: H = Σ p·(−log₂ p). Three weather forecasts: always-sunny has H = 0 (zero surprise, zero information per report); four equally-likely outcomes give H = 2 bits (maximum confusion); the realistic skewed forecast lands at ${entropy(SKEWED).toFixed(2)} bits. Entropy measures how UNPREDICTABLE a source is — and unpredictability is exactly what costs bits to describe.`,
    invariant: 'H is maximal for uniform distributions and zero for certainty.',
  };

  yield {
    state: matrixState({
      title: 'Optimal code lengths ≈ −log₂(p): the Huffman connection',
      rows: OUTCOMES.map((o, j) => ({ id: `r${j}`, label: o })),
      columns: [{ id: 'p', label: 'p' }, { id: 'bits', label: '−log₂(p)' }, { id: 'code', label: 'code length' }],
      values: SKEWED.map((p) => [p, -log2(p), Math.ceil(-log2(p))]),
      format: (v) => (Number.isInteger(v) ? String(v) : v.toFixed(2)),
    }),
    highlight: { active: ['r0:code', 'r3:code'] },
    explanation: `Why entropy matters to engineers: it is the COMPRESSION FLOOR. Shannon proved no code can average fewer than H bits per symbol — and Huffman Coding gets within one bit of it by giving each symbol roughly −log₂(p) bits: "sun" at 70% earns a short code, "snow" at 5% a long one. The site's beekeeper demo was entropy in action: lopsided frequencies = low entropy = big savings; uniform frequencies = maximal entropy = compression impossible.`,
  };

  yield {
    state: matrixState({
      title: 'Cross-entropy: the cost of believing the wrong distribution',
      rows: [{ id: 'truth', label: 'reality p' }, { id: 'model', label: 'model q' }],
      columns: OUTCOMES.map((o, j) => ({ id: `o${j}`, label: o })),
      values: [SKEWED, UNIFORM],
    }),
    highlight: { active: OUTCOMES.map((_, j) => `model:o${j}`) },
    explanation: `Now the question machine learning lives on: what if you encode reality p using codes built for a WRONG belief q? You pay H(p, q) = Σ p·(−log₂ q) — here, modeling the skewed weather as uniform costs ${crossEntropy(SKEWED, UNIFORM).toFixed(2)} bits per outcome instead of the optimal ${entropy(SKEWED).toFixed(2)}. The overpayment (${(crossEntropy(SKEWED, UNIFORM) - entropy(SKEWED)).toFixed(2)} bits) is the KL DIVERGENCE: the price of wrong beliefs, in bits.`,
  };

  yield {
    state: matrixState({
      title: 'The punchline: LLM loss IS cross-entropy',
      rows: [{ id: 'truth', label: 'reality p' }, { id: 'model', label: 'model q' }],
      columns: OUTCOMES.map((o, j) => ({ id: `o${j}`, label: o })),
      values: [SKEWED, UNIFORM],
    }),
    highlight: { found: OUTCOMES.map((_, j) => `truth:o${j}`) },
    explanation: 'Replace weather with next tokens and this is every LLM\'s training objective: the model\'s Softmax & Temperature distribution q tries to match language\'s true distribution p, and the loss minimized by Gradient Descent and Backpropagation is EXACTLY this cross-entropy. "Perplexity," the classic LM metric, is just 2^H — entropy re-expressed as "how many options am I effectively choosing between?" Training an LLM literally means compressing language toward its entropy floor — a deep sense in which a language model IS a compressor.',
  };

  yield {
    state: matrixState({
      title: 'One quantity, threaded through the site',
      rows: [{ id: 'truth', label: 'reality p' }, { id: 'model', label: 'model q' }],
      columns: OUTCOMES.map((o, j) => ({ id: `o${j}`, label: o })),
      values: [SKEWED, UNIFORM],
    }),
    highlight: {},
    explanation: 'Once you see entropy, it is everywhere on this site: Huffman Coding builds codes against it; Random Forest trees pick splits by information GAIN (entropy reduction per question); Knowledge Distillation\'s soft targets transfer low-entropy structure; Quantization survives because weights carry less information than their bits suggest; and every loss curve you have watched descend was measured in it. Bits are the universal currency of structure — and now you can count them.',
  };
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        `Entropy is a single number that measures how much surprise lives inside a distribution. Shannon proved in 1948 that you can define information as surprise: an event with probability p carries exactly −log₂(p) bits of information. A fair coin flip is 1 bit; something certain carries zero bits (no news). A 1-in-100 event is 6.6 bits. Why logarithms? Because they make information additive: two independent coin flips generate 2 bits of information because probabilities multiply while logarithms add.`,
        `Entropy H is the average surprise across a whole distribution: H = Σ p · (−log₂ p) in bits per outcome. A certainty (sun always shines) has H = 0; four equally likely outcomes give H = 2 bits; a realistic skewed weather forecast lands near 1.26 bits. Entropy tells you the irreducible unpredictability of a source — and that unpredictability is exactly what costs bits to compress or describe.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Information is quantified using logarithmic surprise. If you roll a 100-sided die and it lands on 1, you have witnessed an event with probability 1/100, carrying −log₂(1/100) ≈ 6.64 bits of information. The log₂ base is the key: it converts probability into bits, a universal unit of structure. Lower probability means higher information content — rare events "tell you more" in the information-theoretic sense.`,
        `Entropy emerges when you average this surprise over all possible outcomes. For weather with probabilities [0.7, 0.2, 0.05, 0.05], you compute H = 0.7 · (−log₂ 0.7) + 0.2 · (−log₂ 0.2) + 0.05 · (−log₂ 0.05) + 0.05 · (−log₂ 0.05) ≈ 1.26 bits. This single number compresses the entire distribution's unpredictability into one digestible quantity. Entropy is maximal when all outcomes are equally likely (uniform distribution), and zero when only one outcome ever happens.`,
        `Cross-entropy enters when you encode reality p using codes built for a different belief q. You pay H(p, q) = Σ p · (−log₂ q) bits. The overpayment compared to optimal is the KL divergence: KL(p || q) = H(p, q) − H(p). This is the mathematical language of wrong beliefs. When training language models, the loss function minimized is cross-entropy: the model's predicted distribution (Softmax & Temperature) tries to match the true distribution over next tokens, and the gap is measured in bits.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Computing entropy over n outcomes takes O(n) time: one pass, one logarithm per nonzero probability, one multiplication and sum. The log function itself is fast (hardware or library supported). The real cost lives upstream: collecting accurate probabilities. If you misestimate p by even a small amount, entropy changes. Computing cross-entropy for two distributions is also O(n): Σ p[i] · log(q[i]). Both are cheap operations; the bottleneck is statistical — you need data to estimate p accurately, and that requires samples.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Compression: entropy is the floor under every compressor. Shannon proved no code can average fewer than H bits per symbol, and Huffman Coding achieves this optimality by assigning symbol i roughly −log₂(p[i]) bits. Skewed frequencies (some symbols much likelier than others) yield low entropy and large compression savings; uniform frequencies yield maximal entropy and make compression futile.`,
        `Machine learning: every language model loss is cross-entropy. Perplexity, the standard LM metric, is 2^H — entropy reexpressed as "how many equally likely options am I effectively choosing between?" Training a neural network on next-token prediction literally means learning a compressed model of language structure, pushing the model's output distribution toward the true data distribution.`,
        `Information gain in decision trees: Random Forest chooses splits by entropy reduction per question. At each node, pick the feature that reduces child entropy the most (information gain = H_parent − weighted average of H_children). This greedily builds trees that compress data maximally.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `Entropy is NOT disorder in a physical sense. It is a precise mathematical quantity, information-theoretic surprise. A highly compressed file has low entropy in one sense (few bytes) but the *data distribution* being compressed might be high-entropy (uniform). Do not conflate the two.`,
        `Cross-entropy and KL divergence are not interchangeable. H(p, q) is absolute cost; KL(p || q) is relative overpayment. When minimizing a loss, you care about KL (the divergence from truth), but KL needs a baseline — it is always H(p, q) − H(p). Optimizing cross-entropy in practice reduces KL, which is what matters for generalization.`,
        `Perplexity 2^H can feel counterintuitive: high perplexity (uncertain language model) means high entropy. Conversely, low perplexity means the model has learned to compress language well, placing high probability on actual next tokens. Perplexity = 1 means the model is certain at every step — a fiction unless the language is perfectly predictable.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Huffman Coding builds optimal codes against entropy by assigning shorter bit strings to likelier symbols. Knowledge Distillation uses entropy and soft targets to transfer the low-entropy structure of a teacher network into a student. Softmax & Temperature controls the entropy of a model's output distribution — higher temperature softens certainty, raising entropy; lower temperature sharpens predictions, lowering entropy. Gradient Descent optimizes cross-entropy loss to learn data distributions. Random Forest uses information gain (entropy reduction) at every split to build trees. Understanding entropy is the skeleton key: it unlocks why these mechanisms work and how they are connected.`,
      ],
    },
  ],
};

