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
      markers: [{ id: 'best', x: best, y: cost(best, cFP, cFN), label: `t = ${best} â†’ $${cost(best, cFP, cFN)}` }],
    }),
    highlight: { active: ['costCurve'], found: ['best'] },
    explanation: `Sweep every threshold over the same 20 scored emails the ROC topic used and total the bill at each stop: cost(t) = $${cFP}Â·(false positives) + $${cFN}Â·(false negatives). The curve sags to a minimum and climbs at both ends — flag everything and the $${cFP} mistakes pile up on the ${invoiceWorld ? 'left' : 'right'} side of the ledger; flag nothing and the $${cFN} ones do. The cheapest threshold is t = ${best}, total damage $${cost(best, cFP, cFN)}. ${invoiceWorld ? 'A STRICT threshold: with junked invoices at $10, the filter only flags what it is very sure of — precision bought with recall.' : 'A PERMISSIVE threshold: with missed fraud at $10, the system flags on faint suspicion — recall bought with false alarms.'}`,
    invariant: 'The optimal threshold minimizes cFPÂ·FP(t) + cFNÂ·FN(t) — nothing else about the model changes.',
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
    explanation: `One more beautiful step: if the model's probabilities were CALIBRATED (see Calibration & Reliability Diagrams), no sweep would be needed. Flag exactly when pÂ·$${cFN} — the expected cost of passing — exceeds (1âˆ’p)Â·$${cFP}, the expected cost of flagging. Solve: t* = cFP/(cFP+cFN) = ${tStar.toFixed(2)}. Our empirical sweep said ${best} instead — and that gap is the fingerprint of MISCALIBRATION: the formula trusts the scores' face value, the sweep trusts what they actually did. Calibrate first and the two answers converge; that is why calibration is not cosmetic — it is what lets you set thresholds with algebra instead of experiments.`,
  };
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: ['Read the animation as a sweep over model scores. A score ranks cases; a threshold turns that score into an action. Moving the threshold changes false positives, false negatives, and total cost.', {type: 'callout', text: 'A threshold is a priced operating point, not a model property; changing costs can move the best cutoff while the scores stay fixed.'}, {type: 'image', src: './assets/gifs/threshold-optimization.gif', alt: 'Animated walkthrough of the threshold optimization visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},], },
    { heading: 'Why this exists', paragraphs: ['Classifiers often produce scores before they produce decisions. Spam filters, fraud models, and medical screens all need a cutoff that maps a score to an action. Threshold optimization exists because mistakes and review capacity do not cost the same.'], },
    { heading: 'The obvious approach', paragraphs: ['The obvious threshold is 0.5. That is only reasonable when scores are calibrated probabilities and both mistake types have equal cost. Accuracy can also mislead when one class is rare or one error is much worse.'], },
    { heading: 'The wall', paragraphs: ['The wall is that the threshold is a policy choice. Deleting mail, adding a warning label, sending a transaction to review, and blocking it are different actions. The same score list can need different cutoffs for those actions.'], },
    { heading: 'The core insight', paragraphs: ['Attach prices to mistakes and choose the threshold with the lowest bill. For threshold t, cost(t) = cFP * FP(t) + cFN * FN(t). The model supplies the ranking, but the cost model chooses the operating point.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/ROC_curves.svg', alt: 'ROC curve diagram with threshold movement and confusion matrix', caption: 'ROC space shows the threshold menu before a cost model chooses one operating point. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:ROC_curves.svg.'},], },
    { heading: 'How it works', paragraphs: ['Sort validation examples by score and try every cutoff where the predicted label changes. At each cutoff, compute the confusion matrix, the cost, and any capacity limits. Choose the cheapest cutoff that still satisfies the constraints.'], },
    { heading: 'Why it works', paragraphs: ['For a fixed validation set, every threshold has fixed false-positive and false-negative counts. Minimizing the cost expression therefore chooses the cheapest action rule under the stated prices. If scores are calibrated, the closed-form cutoff is cFP / (cFP + cFN).'], },
    { heading: 'Cost and complexity', paragraphs: ['A sweep costs O(n log n) to sort n scored examples and O(n) to scan cutoffs. Applying the chosen threshold is O(1) per case. Doubling traffic doubles alerts and mistakes at the same rates, so monitoring matters after release.'], },
    { heading: 'Real-world uses', paragraphs: ['Spam systems use different thresholds for label, move, and delete actions. Fraud systems use thresholds for approve, challenge, review, and block actions. Medical screening often favors recall first, then uses a second stage to control false positives.'], },
    { heading: 'Where it fails', paragraphs: ['Threshold tuning cannot rescue a model that ranks badly. It also fails when costs are guessed, labels are shifted, or review capacity changes. Segment-specific thresholds can improve utility but need fairness and governance checks.'], },
    { heading: 'Worked example', paragraphs: ['Suppose scores are 0.95 spam, 0.80 legitimate, 0.70 spam, 0.40 legitimate, and 0.20 spam. If false positives cost 10 and false negatives cost 1, threshold 0.75 flags 0.95 and 0.80, causing one false positive and two false negatives for cost 12.', 'Threshold 0.90 flags only 0.95, causing zero false positives and two false negatives for cost 2. If false negatives instead cost 10 and false positives cost 1, the lower threshold becomes cheaper. Same scores, different prices, different cutoff.'], },
    { heading: 'Sources and study next', paragraphs: ['Study confusion matrices, ROC curves, precision-recall curves, calibration, cost-sensitive classification, and imbalanced classification. Elkan 2001 on cost-sensitive learning is a useful starting source.'], },
  ],
};
