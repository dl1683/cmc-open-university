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
      heading: `Why this exists`,
      paragraphs: [
        `Neural networks often end a classification or language-modeling step with raw scores. These scores are called logits. A logit can be negative, positive, large, small, or shifted by a constant. Larger means more preferred, but a row of logits is not a probability distribution. The values do not have to be between 0 and 1, and they do not sum to 1. A model that scores puppy at 2.0, kitten at 1.0, and banana at -0.5 has expressed an ordering, not a usable sampling rule.`,
        `Softmax exists to turn those raw scores into probabilities. It exponentiates each logit and divides by the sum of all exponentials. After that, every candidate receives a positive probability and the probabilities sum to exactly 1. A classifier can use the largest probability as its predicted class. A language model can sample the next token from the distribution. An attention layer can use row-wise softmax to decide how much weight each key-value pair receives for a query.`,
        `Temperature is the knob that reshapes the distribution before it is used. Decoding usually computes softmax(logits / T). Low temperature makes the distribution sharper and more deterministic. High temperature makes it flatter and more diverse. Temperature does not add knowledge to the model. It changes how aggressively the system commits to the preferences already present in the logits.`,
      ],
    },
    {
      heading: `Core insight`,
      paragraphs: [
        `Softmax treats logits as relative evidence. Absolute logit values do not matter by themselves; differences between logits become ratios of probability mass after exponentiation. That is why adding the same constant to every logit changes nothing, while widening the gap between two logits can make one candidate dominate.`,
        `Temperature is gap control. It does not change what the model knows, and for positive temperatures it does not change candidate ranking. It changes how much the decoder trusts the top of the distribution versus how much probability it leaves for alternatives.`,
      ],
    },
    {
      heading: `The naive approach and its wall`,
      paragraphs: [
        `The naive approach is argmax: choose the candidate with the highest logit every time. For classification reports, argmax is often enough. If the goal is to assign one label to an image, the top class is the decision. But language generation is not just choosing one label. A next-token distribution can contain many plausible continuations. Always picking the maximum can make text repetitive, brittle, and unable to explore alternate phrasings.`,
        `The opposite naive approach is to sample too freely. If the system treats weak candidates as nearly equal to strong ones, output becomes diverse but unreliable. In factual answering, high randomness can surface low-probability tokens that derail the response. In code generation, a single unlikely token can break syntax. In creative writing, some diversity is useful, but completely flattening the distribution destroys the model's learned preferences.`,
        `Softmax plus temperature sits between those extremes. It preserves the model's ranking while giving the system a controlled way to choose between determinism and variety. The wall is that no decoding knob can repair bad logits. If the model assigns the highest score to a false claim, lowering temperature makes the false claim more consistent. Raising temperature may make a different answer appear, but it is not a truth mechanism. It is only probability shaping.`,
      ],
    },
    {
      heading: `How softmax works`,
      paragraphs: [
        `For each candidate i, softmax computes exp(z_i) divided by the sum over all candidates exp(z_j). The exponentiation is important because it turns additive logit gaps into multiplicative odds. A one-point logit advantage means about e to the 1, or 2.718 times the unnormalized weight. A two-point advantage means about 7.39 times. A five-point advantage means about 148 times. Small-looking logit gaps can create large probability gaps.`,
        `Softmax is invariant to adding or subtracting the same constant from every logit. If every score is shifted by -100, the probabilities stay the same because the same factor appears in the numerator and denominator. Implementations use this fact for numerical stability. They subtract the maximum logit before exponentiating so exp(1000) does not overflow. The resulting probabilities are identical to the direct formula but safe to compute.`,
        `The operation is local to a row. In a classifier, the row is the set of classes. In a language model, the row is the vocabulary for the next token. In attention, each query has a row of scores against keys, and softmax converts that row into attention weights. The guarantee is always the same: positive values that sum to 1. The interpretation depends on the surrounding system.`,
      ],
    },
    {
      heading: `How temperature works`,
      paragraphs: [
        `Temperature divides logits before softmax. Because only logit differences matter, temperature really scales the gaps between candidates. If T is 0.5, dividing by T doubles the gaps. The favorite becomes much more dominant, and sampling becomes closer to greedy decoding. If T is 2, dividing by T halves the gaps. Lower-ranked candidates receive more probability mass, and outputs become more varied.`,
        `A positive temperature preserves ranking. If puppy has a higher logit than kitten, puppy keeps the higher probability for any T greater than 0. Temperature changes how much higher, not which one is higher. This is why temperature is often described as changing entropy. Low temperature reduces entropy because probability mass concentrates on the top candidates. High temperature increases entropy because mass spreads across more candidates.`,
        `T = 1 means no temperature change. T approaching 0 is not a valid softmax limit in ordinary code because division explodes, so implementations use argmax or a near-greedy approximation. T approaching infinity pushes finite logits toward equal values, so the distribution approaches uniform. In practice, model APIs restrict the useful range. Extremely high temperatures are rarely helpful because they spend probability mass on candidates the model considered weak.`,
      ],
    },
    {
      heading: `Decoding in real systems`,
      paragraphs: [
        `Language model systems rarely use temperature alone. They often combine it with top-k sampling, nucleus sampling, repetition penalties, stop sequences, grammar constraints, or beam search. Top-k keeps only the k most likely tokens. Nucleus sampling keeps the smallest set of tokens whose cumulative probability exceeds a threshold. Temperature reshapes the distribution before or during these filtering steps, depending on implementation. The shared goal is to control the tradeoff between high-probability continuation and useful diversity.`,
        `Different products choose different settings. Code completion, extraction, classification, and factual question answering often use low temperature or deterministic decoding because reproducibility and exactness matter. Brainstorming, naming, dialogue, and creative drafting often use higher temperature because variety is part of the product. Translation, speech recognition, and structured generation may use beam search or constrained decoding because the output space has strong validity requirements.`,
        `Training uses softmax too, but in a different role. Softmax plus cross-entropy compares the model's predicted distribution with the target label or next token. Gradient descent then adjusts weights so the correct class logit rises relative to alternatives. At inference, the trained model no longer receives the answer; softmax turns its logits into a distribution that a decoder can consume. The same formula appears on both sides, but the purpose changes from learning to choosing.`,
      ],
    },
    {
      heading: `Calibration and confidence`,
      paragraphs: [
        `Softmax probabilities are not automatically calibrated confidence. A classifier can output 99 percent and be wrong far more often than 1 percent of the time. A language model can assign high probability to a fluent false continuation. The numbers are probabilities under the model's learned distribution and decoding context, not guaranteed probabilities of truth in the world.`,
        `Temperature has a second use in calibration. After a classifier is trained, a validation set can fit one temperature that makes predicted probabilities better match observed accuracy. This is called temperature scaling. If the model is overconfident, T greater than 1 softens the distribution while preserving the predicted class and ranking. That is different from creative decoding, where a user chooses temperature to change output diversity. The same math is used, but the objective is different.`,
        `The distinction matters in LLM products. Setting a low generation temperature does not make an answer more calibrated; it only makes the model more likely to choose its favorite continuation. If the favorite continuation is unsupported, low temperature can make hallucination more stable. Calibration requires measurement against outcomes, not just a smaller sampling knob.`,
      ],
    },
    {
      heading: `Costs, limits, and study path`,
      paragraphs: [
        `Softmax is O(n) over n candidates. A stable implementation finds the maximum, exponentiates shifted logits, sums the exponentials, and divides. Temperature adds one scalar division per logit. For final language-model decoding, producing logits with the transformer and vocabulary projection is usually more expensive than softmax, but softmax is not free when the vocabulary is large and the batch is big. In attention, softmax is applied over many query-key score rows, so the cost scales with the attention matrix.`,
        `The main limitation is that softmax normalizes only over the candidate set it sees. If the correct answer is not represented by an available class or token path, softmax cannot invent it. If logits come from biased data, weak training, prompt confusion, or distribution shift, the resulting probabilities inherit those problems. Temperature can sharpen or flatten uncertainty, but it cannot fix missing knowledge, bad retrieval, or an invalid output schema.`,
        `Study Entropy and Information to understand why temperature controls concentration. Study Gradient Descent and Cross-Entropy to see how logits are learned. Study Attention Mechanism and The Transformer Block to see softmax inside modern sequence models. Study Beam Search vs Greedy, top-k sampling, and nucleus sampling to understand decoding choices. Then study Calibration and Reliability Diagrams to learn when a probability deserves trust, and Focal Loss and Hard Examples to see how training objectives can distort confidence.`,
      ],
    }
  ]
};
