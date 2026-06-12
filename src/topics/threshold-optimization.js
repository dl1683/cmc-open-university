// The ROC curve is a menu; money is how you order. Attach a dollar cost to
// each kind of mistake and the "where do I set the threshold?" debate
// becomes arithmetic — and the optimum SLIDES when the costs flip.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'threshold-optimization',
  title: 'Picking a Threshold with Real Costs',
  category: 'AI & ML',
  summary: 'Attach a price to each mistake and the threshold debate becomes arithmetic — watch the optimum slide when costs flip.',
  controls: [
    { id: 'costs', label: 'World', type: 'select', options: ['a junked invoice costs $10', 'a missed fraud costs $10'], defaultValue: 'a junked invoice costs $10' },
  ],
  run,
};

// The same 20 scored emails from ROC Curves & AUC — one model, many thresholds.
const SPAM = [0.95, 0.9, 0.85, 0.8, 0.7, 0.65, 0.55, 0.45, 0.4, 0.3];
const HAM = [0.6, 0.5, 0.45, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1, 0.05];
const THRESHOLDS = [...new Set([...SPAM, ...HAM])].sort((a, b) => a - b);

const mistakes = (t) => ({
  fp: HAM.filter((s) => s >= t).length,
  fn: SPAM.filter((s) => s < t).length,
});
const cost = (t, cFP, cFN) => {
  const { fp, fn } = mistakes(t);
  return fp * cFP + fn * cFN;
};

export function* run(input) {
  const world = String(input.costs);
  const invoiceWorld = world === 'a junked invoice costs $10';
  if (!invoiceWorld && world !== 'a missed fraud costs $10') throw new InputError('Pick a cost world.');
  const [cFP, cFN] = invoiceWorld ? [10, 1] : [1, 10];
  const flagged = invoiceWorld ? 'junk a real email' : 'block a legit transaction';
  const missed = invoiceWorld ? 'let spam into the inbox' : 'let a fraud through';

  yield {
    state: matrixState({
      title: 'The confusion matrix, with prices attached',
      rows: [{ id: 'spam', label: 'actually bad' }, { id: 'ham', label: 'actually good' }],
      columns: [{ id: 'flag', label: 'we flag it' }, { id: 'pass', label: 'we pass it' }],
      values: [[0, cFN], [cFP, 0]],
      format: (v) => (v === 0 ? '$0' : `$${v}`),
    }),
    highlight: { active: [cFP > cFN ? 'ham:flag' : 'spam:pass'] },
    explanation: `ROC Curves & AUC ended with a menu of trade-offs and a question: which threshold do you PICK? Answer: the one that loses the least money. Stop treating the two mistakes as abstract rates and price them like an accountant. In this world, to ${cFP > cFN ? flagged : missed} costs $${Math.max(cFP, cFN)} — that is where the pain lives — while to ${cFP > cFN ? missed : flagged} costs only $1. Correct decisions are free. Now every threshold has a bill, and we can shop.`,
  };

  const curvePoints = THRESHOLDS.map((t) => ({ x: t, y: cost(t, cFP, cFN) }));
  const best = THRESHOLDS.reduce((a, t) => (cost(t, cFP, cFN) < cost(a, cFP, cFN) ? t : a), THRESHOLDS[0]);
  yield {
    state: plotState({
      axes: { x: { label: 'threshold' }, y: { label: 'total cost on the 20 test emails ($)' } },
      series: [{ id: 'costCurve', label: 'expected cost', points: curvePoints }],
      markers: [{ id: 'best', x: best, y: cost(best, cFP, cFN), label: `t = ${best} → $${cost(best, cFP, cFN)}` }],
    }),
    highlight: { active: ['costCurve'], found: ['best'] },
    explanation: `Sweep every threshold over the same 20 scored emails the ROC topic used and total the bill at each stop: cost(t) = $${cFP}·(false positives) + $${cFN}·(false negatives). The curve sags to a minimum and climbs at both ends — flag everything and the $${cFP} mistakes pile up on the ${invoiceWorld ? 'left' : 'right'} side of the ledger; flag nothing and the $${cFN} ones do. The cheapest threshold is t = ${best}, total damage $${cost(best, cFP, cFN)}. ${invoiceWorld ? 'A STRICT threshold: with junked invoices at $10, the filter only flags what it is very sure of — precision bought with recall.' : 'A PERMISSIVE threshold: with missed fraud at $10, the system flags on faint suspicion — recall bought with false alarms.'}`,
    invariant: 'The optimal threshold minimizes cFP·FP(t) + cFN·FN(t) — nothing else about the model changes.',
  };

  const sample = [0.3, 0.45, 0.55, 0.65, 0.8, 0.95];
  yield {
    state: matrixState({
      title: `The ledger, line by line (FP @ $${cFP}, FN @ $${cFN})`,
      rows: sample.map((t) => ({ id: `t${String(t).replace('.', '')}`, label: `t = ${t}` })),
      columns: [{ id: 'fp', label: 'false pos' }, { id: 'fn', label: 'false neg' }, { id: 'bill', label: 'total bill' }],
      values: sample.map((t) => {
        const { fp, fn } = mistakes(t);
        return [fp, fn, cost(t, cFP, cFN)];
      }),
      format: String,
    }),
    highlight: { found: [`t${String(best).replace('.', '')}:bill`] },
    explanation: `The same sweep as a ledger. Read how the trade executes: tightening the threshold converts false positives into false negatives one email at a time, and whether that trade is GOOD depends only on the exchange rate — $${cFP} against $${cFN}. Notice what we did NOT do: retrain the model, touch its weights, or change its AUC. Threshold choice is a free knob that sits entirely OUTSIDE the model — which is why deploying the same fraud model at two banks with different fraud economics correctly yields two different thresholds.`,
  };

  const otherBest = THRESHOLDS.reduce((a, t) => (cost(t, cFN, cFP) < cost(a, cFN, cFP) ? t : a), THRESHOLDS[0]);
  yield {
    state: plotState({
      axes: { x: { label: 'threshold' }, y: { label: 'total cost ($)' } },
      series: [
        { id: 'costCurve', label: 'this world', points: curvePoints },
        { id: 'flipped', label: 'costs flipped', points: THRESHOLDS.map((t) => ({ x: t, y: cost(t, cFN, cFP) })) },
      ],
      markers: [
        { id: 'best', x: best, y: cost(best, cFP, cFN), label: `t = ${best}` },
        { id: 'otherBest', x: otherBest, y: cost(otherBest, cFN, cFP), label: `t = ${otherBest}` },
      ],
    }),
    highlight: { active: ['best'], compare: ['otherBest'] },
    explanation: `Both worlds on one chart. Same model, same scores, same ROC curve — yet the optimum sits at t = ${best} in this world and slides to t = ${otherBest} when the costs flip. The model has no opinion about where to operate; the ECONOMICS does. This is the cleanest division of labor in applied ML: scientists raise the AUC (a better menu), the business sets cFP and cFN (the prices), and the threshold falls out mechanically. Arguments about "the right threshold" are usually disguised arguments about the prices.`,
  };

  const tStar = cFP / (cFP + cFN);
  yield {
    state: matrixState({
      title: 'The closed form — if the probabilities are honest',
      rows: [{ id: 'formula', label: 't* = cFP/(cFP+cFN)' }, { id: 'empirical', label: 'our sweep found' }],
      columns: [{ id: 'value', label: 'threshold' }],
      values: [[tStar], [best]],
      format: (v) => v.toFixed(2),
    }),
    highlight: { compare: ['formula:value', 'empirical:value'] },
    explanation: `One more beautiful step: if the model's probabilities were CALIBRATED (see Calibration & Reliability Diagrams), no sweep would be needed. Flag exactly when p·$${cFN} — the expected cost of passing — exceeds (1−p)·$${cFP}, the expected cost of flagging. Solve: t* = cFP/(cFP+cFN) = ${tStar.toFixed(2)}. Our empirical sweep said ${best} instead — and that gap is the fingerprint of MISCALIBRATION: the formula trusts the scores' face value, the sweep trusts what they actually did. Calibrate first and the two answers converge; that is why calibration is not cosmetic — it is what lets you set thresholds with algebra instead of experiments.`,
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `A threshold is the score you cut off: if the model says "probability of spam = 0.7" and you set threshold t = 0.65, you flag it. But where should you cut? The debate "should t be 0.5 or 0.8?" makes no sense until you price the mistakes. Every misclassification has a cost. Wrongly flag an invoice as junk ($10 gone because a customer disputes it) or let fraud through ($10 lost to the thief) — these are not the same. A threshold is a knob outside the model that lets you trade off false positives against false negatives. Once you nail down what each mistake costs, the threshold falls out mechanically: it becomes an arithmetic problem, not a judgment call.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Start with a cost-loss function: cost(t) = cFP × FP(t) + cFN × FN(t). For the invoice world, cFP = $10, cFN = $1. For fraud, flip it: cFP = $1, cFN = $10. The demo sweeps the threshold t over the same 20 scored emails used in ROC, computing the cost at each stop. In the invoice world, the optimum lands at t = 0.65 costing $4; in the fraud world, at t = 0.3 costing $5. The curve dips to a minimum — that is your sweet spot.`,
        `The magic: the model's internals never change. You do not retrain or touch the weights. The ROC curve remains identical; what shifts is which point on it minimizes your dollar loss. Same model, same scores, completely different operating points — driven purely by cost structure. When probabilities are calibrated, there is a closed-form solution: t* = cFP / (cFP + cFN). But real models are miscalibrated, and the gap between the formula and the empirical sweep is your miscalibration fingerprint — how much the scores drift from their true meaning.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Assign a dollar cost to each mistake by interviewing domain experts. Gather a test set labeled with true classes. Sweep the threshold: for each candidate t, count FP(t) and FN(t) and compute cost(t), then find the minimum. Computationally, O(T × N) where T is thresholds tried (trivial) and N is test set size. The hard cost is figuring out cFP and cFN — that is a business conversation. But once you have those numbers, the threshold is free: the scientist raises the AUC, the business prices the mistakes, and algebra picks the threshold. No retraining, no new data, just arithmetic.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Credit card fraud: set cFN >> cFP, lower the threshold, catch more fraud. Email spam: set cFP >> cFN, raise it, err permissive. Medical screening: set cFN >> cFP, cast a wider net for disease. Loan approval: costs depend on profit margins and default risk — different banks deploy the same model at different thresholds. The threshold is a deployment lever: a fraud detector at a startup runs at t = 0.3, at a mature bank at t = 0.6. Neither retrains the model. The choice is pure economics.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Arguing about thresholds in the abstract is a trap. "The threshold should be 0.5" only works if cFP = cFN, rare in practice. Worse, reverse-engineering from "I want FP < 5 percent" gets the costs backward — ask "what does it cost?" not "what percent can we tolerate?" Another misconception: a probability of 0.9 does not mean "I am 90 percent sure"; it means "on average, 90 percent of cases scoring 0.9 are true" — only if the model is calibrated. Miscalibrated models need empirical sweeps, not algebra. Finally, raising the AUC makes every threshold better; lowering the threshold just trades one mistake type for another. If the model is bad, moving the threshold cannot save it.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `The threshold lives on the ROC Curves & AUC — study that first to understand the trade-off landscape. Precision, Recall & the Confusion Matrix develops the terminology (FP, FN) that cost functions depend on. Calibration & Reliability Diagrams explains why the closed-form formula works (and when it does not). When you deploy thresholds and need to measure if your choice was right, run A/B Testing & p-values to distinguish signal from noise. And if you want to set thresholds dynamically as data arrives, learn Thompson Sampling, which is an online version of the same cost-minimization logic.`,
      ],
    },
  ],
};

