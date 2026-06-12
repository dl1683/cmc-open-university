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
      heading: 'What it is',
      paragraphs: [
        `Softmax is a function that turns raw scores (logits) into a probability distribution: each output is between 0 and 1, and they sum to exactly 100%. The formula is simple: softmax(x_i) = exp(x_i) / sum of exp(x_j), where the sum is over all scores. Language models produce raw logits for each possible next token (from a vocabulary of ~50,000 to 100,000 tokens); softmax converts those logits into probabilities you can sample from.`,
        `Temperature is a parameter that reshapes the probability distribution without changing the model's weights. Instead of softmax(logits), you compute softmax(logits / T). A low temperature (T less than 1) sharpens the distribution — the highest logit dominates even more, and minor candidates vanish. A high temperature (T greater than 1) flattens the distribution — even low-scoring tokens get a chance. At T=0, the algorithm becomes greedy (always pick the max). At T approaches infinity, the distribution becomes uniform (every token equally likely).`
      ]
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Softmax has three steps: (1) Shift logits by subtracting the max to avoid overflow (e to the 1000 would crash; exp(x - max) is numerically stable). (2) Exponentiate each shifted logit. Exponentiation is crucial: it makes small differences huge (exp(2) / exp(1) is about 2.7) and negative scores vanish (exp(-100) is about 0), so the largest logit dominates. (3) Normalize by dividing by the sum of exponentials, so the result is a valid probability distribution.`,
        `Temperature works by scaling the logits before softmax. Dividing by T is equivalent to multiplying all logits by 1/T. A small T (like 0.5) doubles or triples the magnitude of differences, making exponentiation amplify them further — the distribution becomes spiky, often dominated by a single token. A large T (like 2) halves or thirds the differences, making them less extreme after exponentiation — the distribution becomes flatter, spreading probability across more tokens. This is why temperature is a versatile dial: the model's logits are fixed, but you can shape their behavior at inference time.`
      ]
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Softmax is O(n) in the vocabulary size n — one pass to find the max, one pass to exponentiate, one pass to compute the sum, and one pass to divide. For a 100,000-token vocabulary, this is negligible on modern hardware. Temperature is essentially free: one scalar division per logit. In practice the cost of softmax is invisible; it is dominated by the forward pass that produced the logits in the first place. The computational bottleneck in LLM inference is not softmax; it is the attention mechanism or the fully-connected layers.`
      ]
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Softmax is ubiquitous in machine learning. Every classification network uses softmax in its final layer (cross-entropy loss plus softmax is the standard for multi-class classification). Every language model uses softmax to convert logits to token probabilities. In attention mechanisms, softmax normalizes attention scores — attention weights must sum to 100% so information flows correctly.`,
        `Temperature is an inference-time knob in every commercial LLM API (OpenAI, Anthropic, etc.). Users set T to control creativity: T is about 0.2-0.5 for factual, deterministic tasks (QA, code generation); T is about 0.7-1.0 for balanced generation; T is about 1.2-2.0 for creative writing or brainstorming. Some systems use top-k sampling (only consider the k highest-probability tokens) or nucleus sampling (only consider the top p% probability mass) in addition to temperature for extra control.`
      ]
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `A widespread misconception: temperature makes a model smarter or more creative. It does not. Temperature changes the distribution of the model's own predictions; it does not change the model's knowledge or reasoning. A model at high temperature does not suddenly understand novel concepts — it just becomes more random, more likely to hallucinate or repeat. For factual tasks, high temperature is a liability.`,
        `Another pitfall: confusing temperature with randomness control. Temperature does not ADD randomness; it RESHAPES the model's built-in uncertainty. If a model assigns equal probability to two tokens (50% each), no temperature change will give one a clear advantage — softmax will still output 50/50. Temperature only changes how sharply the model's preferences are expressed.`,
        `Finally, T=0 is not truly greedy; it is undefined in the softmax formula (you get division by zero in practice). In practice, frameworks use argmax (pick the token with highest logit) when T approaches 0. Some people confuse greedy decoding (always pick max) with temperature control, but they are orthogonal strategies.`
      ]
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Dive into Activation Functions to understand why exponentiation (and other nonlinearities) are so important in neural networks — softmax is just one example of how exponentiation reshapes data. Study Attention Mechanism to see softmax in action: attention weights are computed the same way, rows of softmax distributions. For a deeper understanding of sampling strategies, research top-k sampling, nucleus (top-p) sampling, and Beam Search vs Greedy, which combine temperature with other decoding strategies. When you are ready to build language models, understand cross-entropy loss, which pairs with softmax in training; study Gradient Descent to see how the model learns to produce good logits in the first place.`
      ]
    }
  ]
};
