// Entropy: surprise measured in bits. It is the floor under lossless
// compression, the loss behind language-model training, and the shared unit
// for reasoning about uncertainty.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'entropy',
  title: 'Entropy & Information',
  category: 'Concepts',
  summary: 'Information = surprise = -log2(p). Entropy connects coin flips, compression floors, cross-entropy, perplexity, and language-model loss.',
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
    label: '-log2(p)',
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
    explanation: 'Shannon made information measurable by tying it to surprise. An event with probability p carries -log2(p) bits. A fair coin flip carries 1 bit, a certain event carries 0 bits, and a 1-in-100 event carries about 6.6 bits. The logarithm matters because independent probabilities multiply while information adds.',
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
    explanation: `Entropy is the distribution's average surprise: H = sum p * -log2(p). Always-sunny has H = 0 because the report gives no new information. Four equally likely outcomes give H = 2 bits. The skewed forecast lands at ${entropy(SKEWED).toFixed(2)} bits because one outcome is common but the rare outcomes still have to be named.`,
    invariant: 'H is maximal for uniform distributions and zero for certainty.',
  };

  yield {
    state: matrixState({
      title: 'Optimal code lengths near -log2(p): the Huffman connection',
      rows: OUTCOMES.map((o, j) => ({ id: `r${j}`, label: o })),
      columns: [{ id: 'p', label: 'p' }, { id: 'bits', label: '-log2(p)' }, { id: 'code', label: 'code length' }],
      values: SKEWED.map((p) => [p, -log2(p), Math.ceil(-log2(p))]),
      format: (v) => (Number.isInteger(v) ? String(v) : v.toFixed(2)),
    }),
    highlight: { active: ['r0:code', 'r3:code'] },
    explanation: `Entropy is the lossless compression floor. A good code spends about -log2(p) bits on each symbol: "sun" at 70% earns a short code, while "snow" at 5% needs a longer one. Huffman coding gets close with whole-bit code lengths, so the readout shows both the ideal fractional length and the integer code length.`,
  };

  yield {
    state: matrixState({
      title: 'Cross-entropy: the cost of believing the wrong distribution',
      rows: [{ id: 'truth', label: 'reality p' }, { id: 'model', label: 'model q' }],
      columns: OUTCOMES.map((o, j) => ({ id: `o${j}`, label: o })),
      values: [SKEWED, UNIFORM],
    }),
    highlight: { active: OUTCOMES.map((_, j) => `model:o${j}`) },
    explanation: `Cross-entropy measures the cost of using model q to encode events drawn from reality p. Modeling the skewed weather as uniform costs ${crossEntropy(SKEWED, UNIFORM).toFixed(2)} bits per outcome instead of the optimal ${entropy(SKEWED).toFixed(2)}. The overpayment, ${(crossEntropy(SKEWED, UNIFORM) - entropy(SKEWED)).toFixed(2)} bits here, is KL divergence.`,
  };

  yield {
    state: matrixState({
      title: 'LLM loss is cross-entropy',
      rows: [{ id: 'truth', label: 'reality p' }, { id: 'model', label: 'model q' }],
      columns: OUTCOMES.map((o, j) => ({ id: `o${j}`, label: o })),
      values: [SKEWED, UNIFORM],
    }),
    highlight: { found: OUTCOMES.map((_, j) => `truth:o${j}`) },
    explanation: 'Replace weather labels with next tokens and the table becomes language-model training. The model distribution q is penalized by the negative log probability it assigns to the observed token. Perplexity is 2^H, so it reports cross-entropy as an effective number of choices.',
  };

  yield {
    state: matrixState({
      title: 'One quantity, threaded through the site',
      rows: [{ id: 'truth', label: 'reality p' }, { id: 'model', label: 'model q' }],
      columns: OUTCOMES.map((o, j) => ({ id: `o${j}`, label: o })),
      values: [SKEWED, UNIFORM],
    }),
    highlight: {},
    explanation: 'The same bit accounting appears across the site. Huffman coding builds codes near the entropy floor, decision trees pick splits by entropy reduction, knowledge distillation transfers soft distributions, quantization works when values carry less information than their raw bits suggest, and language-model loss is measured in cross-entropy.',
  };
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        `Entropy exists because engineers need a unit for uncertainty. If an event has probability p, its information content is -log2(p) bits. A certain event has zero information because it does not change what you know. A fair coin flip has one bit because it resolves a two-way uncertainty. A one-in-a-hundred event carries about 6.64 bits because learning that it happened removes much more uncertainty.`,
        `The entropy of a distribution averages that surprise over all possible outcomes: H(p) = sum p(x) * -log2 p(x). It is not a metaphor for messiness. It is a precise claim about expected code length when the probabilities are known. The practical problem is shared across compression, prediction, and model evaluation: how many bits should it cost to describe what happened?`,
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        `The obvious way to measure uncertainty is to count how many outcomes are possible. Four weather labels seem like they should need two bits because two bits can name four states. That answer is right only when the four labels are equally likely. If one outcome happens 99 percent of the time and the others are rare, a fixed two-bit name for every report wastes the structure in the source.`,
        `The wall is that possibility alone ignores probability. A source with ten possible symbols can be easy to predict, and a source with two possible symbols can be maximally uncertain. Counting labels gives an upper bound for a uniform source, not a general measure of information. Entropy fixes the measure by charging rare events more bits and common events fewer bits, then taking the probability-weighted average.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The logarithm is the key. Independent probabilities multiply: if two fair coin flips both need to be described, the joint event has probability 1/4. Information should add across independent choices, so the measure must turn multiplication into addition. The function -log2(p) does exactly that. Two fair flips carry two bits, three fair flips carry three bits, and a thousand fair flips carry a thousand bits.`,
        `This additivity is why bits are a useful unit instead of a decorative number. If one part of a message costs 20 bits and an independent part costs 7 bits, the combined description costs 27 bits. Compression algorithms, decision trees, language-model losses, and coding theory can then talk in the same currency. Entropy is the expected number of binary questions needed by an ideal code for the source.`,
      ],
    },
    {
      heading: 'The distribution is the data structure',
      paragraphs: [
        `To compute entropy, you need an alphabet and a probability distribution over that alphabet. The alphabet might be bytes, characters, words, tokens, labels, image residuals, or branch outcomes. The distribution might be known from a model, estimated from counts, smoothed to handle unseen symbols, or updated online as the stream changes. The formula is small, but the modeling decision is the real data-structure choice.`,
        `A practical entropy table stores each symbol, its count or probability, its surprise, and its contribution p * -log2(p). Zero-probability terms are skipped because impossible events do not occur in the expectation. Very small probabilities matter because their surprise is large, but they may contribute little if they rarely occur. This is why a long tail can be operationally important without dominating average entropy.`,
      ],
    },
    {
      heading: 'Compression floor',
      paragraphs: [
        `Entropy gives a lower bound for lossless compression. If a source has entropy 1.4 bits per symbol, no lossless code can average far below 1.4 bits per symbol over a long stream from that source. A naive fixed-length code for four symbols uses two bits every time. A better code gives short names to common symbols and long names to rare symbols, pushing the average toward the entropy floor.`,
        `Huffman coding shows the integer-length version of the idea. A symbol with probability 1/2 wants a one-bit code, a symbol with probability 1/8 wants a three-bit code, and so on. Arithmetic coding and ANS go closer to fractional-bit efficiency over whole messages. The source still cannot be compressed below its entropy without losing information or exploiting a better model of the source.`,
      ],
    },
    {
      heading: 'Cross-entropy and learning',
      paragraphs: [
        `Entropy asks how expensive the true distribution is under an optimal code. Cross-entropy asks how expensive reality becomes when you use a different distribution q to encode events drawn from p. The formula is H(p, q) = sum p(x) * -log2 q(x). If q gives high probability to what actually happens, the cost is low. If q is confident in the wrong places, the cost rises quickly.`,
        `This is the loss behind ordinary classification and language-model training. The model emits a probability distribution over labels or next tokens. Training penalizes the negative log probability assigned to the observed answer. Averaged over data, that is an empirical cross-entropy. Perplexity is the same idea re-expressed as an effective branching factor: a model with lower cross-entropy is acting as though it has fewer plausible next choices.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Entropy works because it matches the economics of distinguishability. A code must assign enough bit patterns to cover the high-probability mass of the source. Common events deserve short descriptions because they are paid often. Rare events can tolerate long descriptions because they are paid seldom. The optimal average is governed by probabilities, not by the visual names of the symbols.`,
        `The same reasoning explains information gain in decision trees. A split is useful when it reduces the expected entropy of the remaining labels. A question that separates a mixed population into purer groups saves future bits. This is not separate magic from compression. It is the same accounting applied to uncertainty before and after a question.`,
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        `In systems work, useful signals include bits per symbol, compression ratio versus entropy estimate, cross-entropy on held-out data, calibration error, perplexity, and drift in the estimated distribution. A compressor that performs far above the entropy estimate may have implementation overhead, block-size waste, weak modeling, or metadata cost. A model whose training loss improves while validation cross-entropy worsens is memorizing the training distribution rather than learning a better predictor.`,
        `Always keep the unit attached. Bits per byte, bits per token, bits per pixel, and bits per label are not interchangeable. A tokenizer can change token entropy without changing the underlying text. A class distribution can have low entropy because one class dominates, yet a classifier can still be useless on the rare classes. Entropy is a measurement tool, not the whole evaluation.`,
      ],
    },
    {
      heading: 'Practical guidance',
      paragraphs: [
        `Choose the event space before computing the number. Byte entropy, token entropy, branch entropy, label entropy, and pixel-residual entropy answer different questions. If the alphabet changes, the entropy changed its meaning. Document the alphabet, smoothing rule, sample window, and conditioning variables beside the result.`,
        `Use held-out data when entropy becomes a model-quality claim. A compressor can estimate a low source entropy on its training block and still fail on a new block. A classifier can reduce average cross-entropy while getting rare labels wrong. Report tail behavior, calibration, subgroup loss, and drift together with the average bit cost.`,
        `When comparing models or codecs, convert to the same unit. Bits per token can favor one tokenizer, bits per byte can hide semantic errors, and perplexity numbers are only comparable under the same tokenization and evaluation set. Entropy is clean math, but the measurement frame is an engineering choice.`,
      ],
    },
    {
      heading: 'Where it is useful',
      paragraphs: [
        `Entropy is useful wherever a system must price uncertainty: lossless compression, entropy coding, feature selection, decision-tree splits, active learning, uncertainty reporting, language-model evaluation, anomaly detection, cryptographic randomness checks, and telemetry compression. It gives different mechanisms a shared question: how many bits are needed to state what happened, given what was already known?`,
        `It is especially useful in a curriculum because it prevents separate topics from looking unrelated. Huffman coding, arithmetic coding, softmax loss, KL divergence, random forests, and knowledge distillation all ask how probability mass is arranged and how expensive it is to be surprised. Once that connection is clear, many algorithms become variations on distribution accounting.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Entropy fails as a standalone judgment when the event space is poorly chosen. Byte entropy, token entropy, pixel entropy, and label entropy answer different questions. A high-entropy encrypted file and a high-entropy compressed file may look similar to a byte histogram even though they mean different things operationally. A low-entropy dataset can still be hard if the rare cases matter.`,
        `It also fails when probability estimates are bad. Small samples, nonstationary streams, hidden conditioning variables, and distribution shift can make the computed entropy a property of the estimator rather than the source. In machine learning, low average cross-entropy can hide poor calibration, bad tail behavior, or unacceptable subgroup performance. The number is reliable only when the modeling frame is explicit.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Huffman Coding for prefix codes with integer lengths, Arithmetic & ANS Coding for coders that approach the entropy floor more closely, and LZ77 or DEFLATE for complete compressors that first build a better source model. Then study Softmax & Temperature, Cross-Entropy Loss, KL Divergence, Decision Trees, Random Forests, Calibration, and Knowledge Distillation to see the same bit accounting inside learning systems.`,
      ],
    },
  ],
};
