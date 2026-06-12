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
