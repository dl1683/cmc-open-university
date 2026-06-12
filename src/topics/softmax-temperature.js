// Softmax and temperature: how an LLM turns raw scores into a probability
// distribution, and what the "temperature" knob actually does to it.

import { matrixState, parseNumberList } from '../core/state.js';

export const topic = {
  id: 'softmax-temperature',
  title: 'Softmax & Temperature',
  category: 'AI & ML',
  summary: 'How raw model scores become probabilities — and how temperature reshapes them from greedy to creative.',
  controls: [
    { id: 'logits', label: 'Logits for the candidates', type: 'number-list', defaultValue: '2.0, 1.0, 0.2, -0.5, 1.5' },
  ],
  run,
};

// The model is predicting the next word of: "The cute little ___"
const CANDIDATES = ['puppy', 'kitten', 'robot', 'cloud', 'banana'];

const softmax = (xs) => {
  const peak = Math.max(...xs);
  const exps = xs.map((x) => Math.exp(x - peak));
  const total = exps.reduce((a, b) => a + b, 0);
  return exps.map((x) => x / total);
};
const pct = (v) => `${(v * 100).toFixed(1)}%`;

export function* run(input) {
  const logits = parseNumberList(input.logits, { min: 5, max: 5, label: 'logits' });
  const columns = CANDIDATES.map((word, i) => ({ id: `w${i}`, label: word }));

  yield {
    state: matrixState({
      title: 'Raw logits — the model\'s un-normalized scores',
      rows: [{ id: 'logits', label: 'logits' }],
      columns,
      values: [logits],
    }),
    highlight: {},
    explanation: 'A language model finishing "The cute little ___" doesn\'t output a word — it outputs a raw SCORE (a logit) for every candidate. Bigger means more plausible, but these aren\'t probabilities: they can be negative, and they don\'t sum to anything meaningful. Softmax fixes that.',
  };

  const base = softmax(logits);
  const argmax = base.indexOf(Math.max(...base));
  yield {
    state: matrixState({
      title: 'softmax(logits) — now a probability distribution',
      rows: [{ id: 't1', label: 'T = 1' }],
      columns,
      values: [base],
      format: pct,
    }),
    highlight: { active: [`w${argmax}`] },
    explanation: `Softmax exponentiates every logit and divides by the total: every value becomes positive, and the row sums to exactly 100%. "${CANDIDATES[argmax]}" leads at ${pct(base[argmax])}. Now the model can SAMPLE — roll a weighted die — instead of robotically picking the max.`,
    invariant: 'Softmax output always sums to 100%, whatever the logits are.',
  };

  const temps = [
    { t: 0.5, note: (p) => `Dividing logits by T=0.5 DOUBLES them before softmax — gaps between scores get amplified, so the distribution SHARPENS: "${CANDIDATES[argmax]}" jumps to ${pct(p[argmax])}. Low temperature → confident, repetitive, almost-greedy output. Good for code and facts.` },
    { t: 2.0, note: (p) => `Dividing by T=2 HALVES the logits — differences shrink, the distribution FLATTENS, and longshots like "banana" become live options (${pct(p[4])}). High temperature → diverse, surprising, riskier output. Good for brainstorming, dangerous for facts.` },
  ];

  const rows = [{ id: 't1', label: 'T = 1' }];
  const values = [base];
  for (const { t, note } of temps) {
    const probs = softmax(logits.map((x) => x / t));
    rows.push({ id: `t${String(t).replace('.', '_')}`, label: `T = ${t}` });
    values.push(probs);
    yield {
      state: matrixState({
        title: 'softmax(logits / T) at different temperatures',
        rows: rows.map((r) => ({ ...r })),
        columns,
        values: values.map((v) => [...v]),
        format: pct,
      }),
      highlight: { active: [rows[rows.length - 1].id] },
      explanation: note(probs),
    };
  }

  yield {
    state: matrixState({
      title: 'softmax(logits / T) at different temperatures',
      rows: rows.map((r) => ({ ...r })),
      columns,
      values: values.map((v) => [...v]),
      format: pct,
    }),
    highlight: {},
    explanation: 'Same model, same logits — three different personalities, controlled by one number. The "temperature" slider in every LLM API and playground is EXACTLY this division. T→0 collapses to always-pick-the-max (greedy decoding); T=1 is the model\'s honest distribution; higher T trades reliability for variety. Softmax also appears inside the attention mechanism — same equation, same row-sums-to-100% guarantee.',
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Softmax turns raw scores, called logits, into a probability distribution. For each candidate i, it computes exp(logit_i) divided by the sum of exponentials across all candidates. The outputs are positive and sum to 1. A classifier uses this to choose among labels; a language model uses it over a vocabulary that may contain 32k, 50k, or 100k tokens; Attention Mechanism uses the same operation row by row to decide which values each query should read.`,
        `Temperature reshapes that distribution without retraining the model. Instead of softmax(logits), decoding uses softmax(logits / T). Low T sharpens preferences; high T flattens them. Temperature changes entropy, not knowledge. Entropy & Information is the right mental model: you are changing how concentrated the model's probability mass is before sampling or search.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Numerically stable softmax first subtracts the maximum logit. That does not change the result, because adding or subtracting the same constant from every logit cancels during normalization, but it prevents exp(1000) overflow. Then it exponentiates, sums, and divides. A one-point logit gap means exp(1), about 2.718x odds before normalization; a five-point gap means about 148x odds.`,
        `Temperature multiplies all logit gaps by 1/T. At T = 0.5, a two-point gap behaves like a four-point gap, so the favorite becomes much more dominant. At T = 2, the same gap behaves like one point, so alternatives survive. T = 0 is not a valid softmax; implementations switch to argmax. As T approaches infinity, finite logits approach a uniform distribution. Sampling randomness comes from the sampler; temperature only shapes the probabilities that sampler sees.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Softmax is O(n) over n candidates: find the max, exponentiate, sum, divide. Temperature is one scalar division per logit. For final language-model decoding, the expensive step is often producing the logits with The Transformer Block and the vocabulary projection; softmax is smaller but not literally free at 100k tokens and large batches. In attention, softmax is O(L^2) cells during prefill because every query-key score row must be normalized. Fused kernels keep it close to the surrounding matrix-multiply cost.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Softmax plus cross-entropy is the standard training pair for multi-class neural classifiers. During training, Gradient Descent pushes the correct class logit up relative to others. At inference, language systems combine temperature with top-k, nucleus sampling, repetition penalties, or Beam Search vs Greedy depending on whether they want diversity or a high-probability output. Calibration & Reliability Diagrams also use temperature scaling after training: a validation set chooses one temperature that makes probabilities better match observed frequencies.`,
        `Temperature defaults depend on product goals. Code completion and extraction often use low temperatures or argmax for reproducibility. Brainstorming uses higher values for variety. Translation and speech often prefer beam search or constrained decoding. None of these make the base model smarter; they choose how to spend its uncertainty.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Temperature preserves ranking. If token A has a higher logit than token B, any positive temperature keeps A above B; it only changes the gap. It also cannot rescue bad logits. If the model assigns high probability to a false claim, lowering temperature may make that false claim more deterministic. Raising temperature may add variety, but it usually increases hallucination risk for factual tasks.`,
        `Softmax probabilities are not automatically calibrated confidence. A classifier can output 99% and be wrong far more often than 1% of the time. Focal Loss & Hard Examples and class imbalance can further distort confidence if the training setup rewards different behavior. Treat output probabilities as model scores until calibration is measured.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Attention Mechanism to see row-wise softmax inside a layer, then Beam Search vs Greedy to compare search against sampling. Entropy & Information gives the uncertainty math, Calibration & Reliability Diagrams shows whether probabilities deserve trust, and Gradient Descent explains how logits are learned. The Transformer Block provides the upstream machine that produces next-token logits before softmax ever runs.`,
      ],
    }
  ]
};
