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
        `Picking a Threshold with Real Costs turns a model score into an action by pricing mistakes. A classifier may score an email 0.65 spam or a transaction 0.30 fraud, but the model does not know whether a false alarm costs pennies or a missed case costs thousands. The threshold is a deployment knob outside the model: above it, flag; below it, pass. ROC Curves & AUC gives the menu of possible trade-offs. Cost minimization chooses the item on the menu.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The demo reuses the same 20 scored emails from the ROC topic: 10 spam and 10 ham. Define cost(t) = cFP * FP(t) + cFN * FN(t). In the invoice world, a false positive means junking a real invoice and costs $10, while missed spam costs $1. Sweeping thresholds finds t = 0.65 with four missed spam and zero false positives, total cost $4. In the fraud world the prices flip: false positives cost $1 and missed fraud costs $10. The best threshold becomes t = 0.30, with five false positives and no missed fraud, total cost $5. Same model, same scores, different economics.`,
        `If probabilities are perfectly calibrated and the costs are correct, the algebraic cutoff is t* = cFP / (cFP + cFN). Flag when p * cFN, the expected cost of passing, exceeds (1 - p) * cFP, the expected cost of flagging. The empirical sweep can disagree with that formula because the demo has discrete scores, only 20 examples, and scores that may not be calibrated. Calibration & Reliability Diagrams is what makes the formula trustworthy.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Threshold search is cheap. Sort candidate scores, count false positives and false negatives at each cutoff, and compute the bill. The hard part is not computation; it is pricing the mistakes honestly with domain owners. A bank, hospital, and email provider may deploy the same Logistic Regression or Gradient Boosting model at different thresholds because their costs differ. No retraining is required, so threshold changes are reversible and easy to A/B test. That reversibility is why threshold tuning should usually happen before rebuilding the model.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Fraud systems lower thresholds when missing fraud is expensive. Spam systems raise thresholds when junking real mail is unacceptable. Medical screening often lowers thresholds to protect recall, then sends positives to a human review queue. Imbalanced Data: When 99% Is One Class makes thresholding unavoidable because a default 0.5 cutoff can ignore the rare class. Precision, Recall & the Confusion Matrix supplies the counts behind the cost ledger.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `A 0.5 threshold is only natural when false positives and false negatives cost the same and probabilities are calibrated. That is rare. Do not set a threshold by vibes, by accuracy alone, or by the training set. Do not confuse improving a model with moving a threshold: a better AUC improves the menu, while a threshold picks one operating point. A bad ranker cannot be saved by clever thresholding. Data Leakage & Contamination can also make a threshold look cheap offline and fail in production.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study ROC Curves & AUC for the full trade-off curve, Precision, Recall & the Confusion Matrix for the FP and FN counts, and Calibration & Reliability Diagrams for when the closed-form threshold is valid. A/B Testing & p-values helps verify that a new threshold actually improves user outcomes after deployment. Naive Bayes (Spam Filter) is a simple score factory to practice on.`,
      ],
    },
  ],
};
