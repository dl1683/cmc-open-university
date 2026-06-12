// Precision, recall, and the confusion matrix: why a classifier can score
// 95% accuracy by doing literally nothing — and which numbers to trust
// instead. The four-cell table every model evaluation stands on.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'precision-recall',
  title: 'Precision, Recall & the Confusion Matrix',
  category: 'AI & ML',
  summary: 'Accuracy lies on imbalanced data — meet the four cells and two ratios that tell the truth.',
  controls: [
    { id: 'clf', label: 'Evaluate', type: 'select', options: ['lazy (always ham)', 'threshold 0.5', 'threshold 0.9 (cautious)'], defaultValue: 'lazy (always ham)' },
  ],
  run,
};

// 1,000 test emails, only 50 actually spam — imbalance is the norm.
const CLASSIFIERS = {
  'lazy (always ham)': { tp: 0, fn: 50, fp: 0, tn: 950 },
  'threshold 0.5': { tp: 40, fn: 10, fp: 30, tn: 920 },
  'threshold 0.9 (cautious)': { tp: 25, fn: 25, fp: 2, tn: 948 },
};

const metrics = ({ tp, fn, fp, tn }) => {
  const accuracy = (tp + tn) / (tp + fn + fp + tn);
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { accuracy, precision, recall, f1 };
};
const pct = (v) => `${(v * 100).toFixed(1)}%`;

export function* run(input) {
  const name = String(input.clf);
  const m = CLASSIFIERS[name];
  if (!m) throw new InputError('Pick a classifier.');

  const cmRows = [{ id: 'aspam', label: 'is spam' }, { id: 'aham', label: 'is ham' }];
  const cmCols = [{ id: 'pspam', label: 'flagged' }, { id: 'pham', label: 'passed' }];
  const cm = (title) => matrixState({ title, rows: cmRows, columns: cmCols, values: [[m.tp, m.fn], [m.fp, m.tn]] });

  yield {
    state: cm('The test set: 1,000 emails, only 50 actually spam'),
    highlight: {},
    explanation: `The setting that breaks naive evaluation: IMBALANCE. Of 1,000 test emails, just 50 are spam — and that ratio is the rule, not the exception (fraud among transactions, disease among patients, defects among parts). We're evaluating "${name}" — every prediction lands in exactly one of four cells.`,
  };

  yield {
    state: cm('The confusion matrix: four cells, no place to hide'),
    highlight: { found: ['aspam:pspam'], swap: ['aham:pspam'], compare: ['aspam:pham'], active: ['aham:pham'] },
    explanation: `Read it like a truth table. TRUE POSITIVES (${m.tp}): spam, correctly flagged. FALSE NEGATIVES (${m.fn}): spam that slipped through to the inbox. FALSE POSITIVES (${m.fp}): real mail wrongly junked — the expensive mistake. TRUE NEGATIVES (${m.tn}): ham correctly passed. Every metric you'll ever meet is arithmetic over these four numbers.`,
    invariant: 'The four cells always sum to the test set: every example lands in exactly one.',
  };

  const mt = metrics(m);
  yield {
    state: cm(`Accuracy: ${pct(mt.accuracy)} — impressive?`),
    highlight: { found: ['aspam:pspam', 'aham:pham'] },
    explanation: `ACCURACY = correct / total = ${pct(mt.accuracy)}. ${name === 'lazy (always ham)' ? 'And here is the scandal: this classifier does NOTHING — it calls everything ham — and still scores 95%, because 95% of the data IS ham. Accuracy on imbalanced data measures the imbalance, not the model. A 99%-accurate cancer screen that never detects cancer is a coin with one side.' : 'Looks great — but the lazy do-nothing classifier scores 95% on this same data. Accuracy barely distinguishes them. The informative questions are sharper.'}`,
  };

  yield {
    state: cm(`Precision ${pct(mt.precision)} · Recall ${pct(mt.recall)}`),
    highlight: { found: ['aspam:pspam'], swap: ['aham:pspam'], compare: ['aspam:pham'] },
    explanation: `The two questions that matter: PRECISION — of everything flagged, how much was really spam? ${m.tp}/(${m.tp}+${m.fp}) = ${pct(mt.precision)}. RECALL — of the real spam, how much did we catch? ${m.tp}/(${m.tp}+${m.fn}) = ${pct(mt.recall)}. Notice they audit DIFFERENT mistakes: precision punishes false alarms (good mail junked), recall punishes misses (spam delivered). ${name === 'lazy (always ham)' ? 'The lazy classifier\'s recall is 0% — the number accuracy was hiding.' : ''}`,
  };

  const all = Object.entries(CLASSIFIERS).map(([n, c]) => ({ n, ...metrics(c) }));
  yield {
    state: matrixState({
      title: 'Three classifiers, four lenses',
      rows: all.map((a, i) => ({ id: `c${i}`, label: a.n.split(' ')[0] })),
      columns: [{ id: 'acc', label: 'accuracy' }, { id: 'prec', label: 'precision' }, { id: 'rec', label: 'recall' }, { id: 'f1', label: 'F1' }],
      values: all.map((a) => [a.accuracy, a.precision, a.recall, a.f1]),
      format: (v) => `${(v * 100).toFixed(0)}%`,
    }),
    highlight: { active: all.map((_, i) => `c${i}:f1`) },
    explanation: 'All three side by side — and accuracy (95–97%) barely separates them while precision and recall tell three different stories. The thresholds reveal THE fundamental dial: flag more aggressively and recall rises while precision falls; get cautious and the reverse. You cannot max both; you can only choose your mistakes. F1, the harmonic mean of the two, is the standard one-number compromise — harmonic, so it collapses when either side does (the lazy classifier\'s F1: 0%).',
  };

  yield {
    state: cm('Choose metrics by the COST of each mistake'),
    highlight: {},
    explanation: 'The decision rule in practice: ask which error is expensive. Cancer screening: a miss can kill, a false alarm costs a follow-up test — maximize RECALL. Spam filtering: junking a job offer is a disaster, while one spam getting through is a shrug — favor PRECISION. Fraud, content moderation, medical triage: each picks its point on the curve (the full menu is the precision-recall curve, traced by sweeping the threshold). This is the evaluation layer under Naive Bayes (Spam Filter) and every classifier on this site — and the same base-rate trap that A/B Testing & p-values guards with priors and sample sizes.',
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Precision, recall, and the confusion matrix are the evaluation tools that keep accuracy honest. The demo uses 1,000 emails with only 50 spam. A lazy classifier that passes everything gets 950 correct and scores 95% accuracy while catching zero spam. The confusion matrix exposes the four cells: true positives are spam correctly flagged, false negatives are spam passed through, false positives are ham wrongly junked, and true negatives are ham correctly passed. Precision asks, of the emails we flagged, how many were truly spam? Recall asks, of all real spam, how many did we catch?`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The threshold 0.5 classifier in the visualization has TP = 40, FN = 10, FP = 30, and TN = 920. Accuracy is 96%, barely better than the lazy 95%, but precision is 40/(40+30) = 57.1% and recall is 40/(40+10) = 80%. The cautious threshold 0.9 classifier flips the trade: TP = 25, FN = 25, FP = 2, TN = 948, so precision jumps to 92.6% while recall falls to 50%. One slider moved; the error profile changed completely. Those four counts are the audit trail.`,
        `F1 is the harmonic mean of precision and recall. It is useful when you want one balanced number, because it collapses if either side is near zero. The lazy classifier has F1 = 0 despite 95% accuracy. But F1 is not morality. If false negatives are ten times worse than false positives, Picking a Threshold with Real Costs should override a symmetric metric.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Computing these metrics is O(N): run the model on a labeled test set, count four cells, and divide. The expensive part is not arithmetic; it is collecting labels and deciding which mistake costs more. A spam filter may prefer high precision to avoid junking invoices. A cancer screen may prefer high recall to avoid missing disease. Search systems often report precision at k because users only inspect the first few results. Cross-Validation & Honest Evaluation decides whether the reported counts generalize beyond one lucky split.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Every binary classifier eventually lands here: Naive Bayes (Spam Filter), Logistic Regression, fraud scoring, moderation, search ranking, medical screening, defect detection, and lead scoring. Imbalanced Data: When 99% Is One Class makes precision and recall central because majority-class accuracy can dominate the report. ROC Curves & AUC studies threshold sweeps from another angle: true-positive rate against false-positive rate. Calibration & Reliability Diagrams matters when the threshold is chosen from probabilities rather than arbitrary scores. In production dashboards, the confusion matrix is often the first place to look when users say the model feels wrong.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Do not say specificity is another name for precision. Recall is sensitivity, but specificity is true-negative rate: TN/(TN+FP). Precision is positive predictive value: TP/(TP+FP). Do not compare precision across datasets with very different base rates without noting prevalence. Do not compute metrics on training data. Do not expect precision and recall to rise together when you move a threshold; usually one buys the other. A/B Testing & p-values can tell whether an observed metric improvement is larger than sampling noise.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study ROC Curves & AUC for threshold-free ranking skill, Picking a Threshold with Real Costs for the business cost layer, and Imbalanced Data: When 99% Is One Class for the regime where accuracy fails hardest. Then use Calibration & Reliability Diagrams before treating a score as a probability.`,
      ],
    },
  ],
};
