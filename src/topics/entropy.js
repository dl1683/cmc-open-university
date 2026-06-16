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
      heading: `What it is`,
      paragraphs: [
        `Entropy measures average surprise in a probability distribution. The page starts from Shannon's formula: an event with probability p carries -log2(p) bits. A fair coin flip carries 1 bit; a certain event carries 0; a 1% event carries about 6.6 bits. Average that surprise over all outcomes and you get entropy, the irreducible number of bits needed to describe draws from the source.`,
        `In the visualization, a certain weather forecast has H = 0, four equally likely outcomes have H = 2 bits, and the skewed distribution [0.7, 0.2, 0.05, 0.05] has about 1.26 bits. Entropy & Information is the bridge between compression, prediction, and learning.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The logarithm is what makes information add. Independent probabilities multiply, so their log surprises add. Huffman Coding uses the same rule operationally: common symbols deserve short codes, rare symbols deserve long codes, and no code can beat the entropy floor on average. Arithmetic & ANS Coding pushes closer to that floor by coding whole messages or integer states instead of rounding every symbol to a whole-bit codeword.`,
        `Cross-entropy appears when reality is p but your model believes q. The page compares the skewed weather truth with a uniform model. The optimal cost is 1.26 bits; the uniform model pays 2.00 bits, so the 0.74-bit overpayment is KL divergence. Softmax & Temperature produces the q distribution in neural nets, and Gradient Descent with Backpropagation pushes q toward p by minimizing cross-entropy.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Computing entropy or cross-entropy is O(n) over n outcomes, skipping zero-probability terms. The hard part is estimating probabilities well. Sparse categories, rare tokens, and distribution shift make p uncertain. In language modeling, the distribution spans a vocabulary, so the cost is usually in computing logits and the softmax, not in the entropy formula itself.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Compression uses entropy as a lower bound. Language models report perplexity, which is 2^H, the effective number of equally likely next tokens. Random Forest uses entropy reduction as information gain when choosing splits. Focal Loss & Hard Examples modifies cross-entropy so easy majority examples stop dominating. Knowledge Distillation transfers a teacher's softer, higher-entropy distribution to a smaller model.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Entropy is not vague disorder; it is expected code length under a distribution. Cross-entropy and KL divergence are also different: cross-entropy is total coding cost, KL is extra cost above the entropy of reality. Natural Gradient & Fisher Information uses KL as geometry, asking how much a parameter step changes the model's distribution rather than how far it moved in coordinates.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Huffman Coding for the prefix-code view of the compression floor, then Arithmetic & ANS Coding for fractional-bit entropy coders and DEFLATE Case Study for a complete compressor. Softmax & Temperature controls output entropy, and Gradient Descent minimizes cross-entropy. Then read Natural Gradient & Fisher Information to see KL become a metric, Random Forest for entropy reduction in trees, and Knowledge Distillation for transferring probability structure between models.`,
      ],
    },
  ],
};
