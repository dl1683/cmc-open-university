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
      heading: 'What it is',
      paragraphs: [
        `Precision and recall are the two metrics that tell you what a classifier actually does. Accuracy — the fraction of all predictions that are correct — hides the truth when your data is imbalanced. A spam filter that marks every email as ham (safe) will score 95% accuracy on a dataset of 1,000 emails if only 50 of them are truly spam. It catches zero spam but scores as if it works. The confusion matrix is the table that exposes this lie: four cells showing true positives (caught spam), false negatives (missed spam), false positives (wrongly junked email), and true negatives (safe mail passed correctly). From these cells, precision and recall ask two orthogonal questions: of everything the model flagged, how many were actually positive (precision)? And of everything actually positive, how many did the model catch (recall)? Neither hides behind imbalance.`,
        `The names matter semantically. Recall asks: did you remember (recall) the real signal? Precision asks: how pure was your positive prediction set? A cancer screening that flags every patient as positive has perfect recall — every true cancer is caught — but zero precision; your alarm is worthless. A cautious screening that flags only the most obvious cases has high precision — every flag is probably real — but might miss early-stage disease, tanking recall. The confusion matrix is the bedrock. Everything else is arithmetic.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Start with a test set of labeled examples (emails marked spam or ham, patients with or without disease, credit applications fraudulent or legitimate). Run your classifier and sort every prediction into one of four cells. In the spam example, true positives are spam emails flagged by the model, false negatives are spam that got through, false positives are good emails wrongly junked, true negatives are good emails correctly passed. The matrix rows are the ground truth; columns are predictions. Precision = TP/(TP+FP): of the things you flagged positive, what fraction were actually positive? Recall = TP/(TP+FN): of the things that were actually positive, what fraction did you find? Each metric targets a different kind of mistake. A fraud detector maximizes recall because missing fraud costs money; a spam filter can tolerate some spam slipping through but must maximize precision because junking a payment notification is a business disaster.`,
        `Most classifiers return scores or probability estimates, not binary flags. A spam filter might assign each email a likelihood of being spam from 0 to 1. You choose a threshold — at 0.5, emails scored 0.5 or higher are flagged spam; below 0.5 are passed. Lower the threshold and you flag more emails as spam, raising recall (you catch more actual spam) but lowering precision (you falsely flag more ham). Raise the threshold and recall drops while precision rises. This is the fundamental precision-recall tradeoff: as you sweep the threshold from 0 to 1, you trace a curve in the plane of precision and recall. At one extreme, flag nothing and both metrics fail (no predictions means no true positives). At the other, flag everything and recall is 100% but precision collapses. Your job is to pick the threshold that matches your cost model.`,
        `The F1 score, defined as the harmonic mean 2×(precision×recall)/(precision+recall), is a one-number summary that treats precision and recall symmetrically and heavily penalizes imbalance between them. If either precision or recall is near zero, F1 bottlenecks (the harmonic mean is dominated by the minimum), forcing you to stay balanced. The lazy always-ham classifier has F1 = 0% because its recall is 0%, even though its accuracy is 95%. F1 is not always the right choice — if your problem genuinely values precision over recall, F1 may mislead — but it is the default tie-breaker when stakes are equal.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Precision and recall are free to compute given a confusion matrix. The confusion matrix itself requires a labeled test set and a classifier; building or training the classifier is expensive, but the metrics themselves are simple arithmetic over four counts. The real cost is choosing the right threshold or, equivalently, the right point on the precision-recall curve. You must understand your problem domain: what is the cost of a false positive versus a false negative? In spam filtering, a false positive (junked email) might cost you a lost job application; a false negative (spam delivered) is a mild annoyance. In cancer screening, a false negative (missed cancer) can be fatal; a false positive (a biopsy of benign tissue) is expensive and stressful but survivable. There is no algorithm for choosing threshold; only domain knowledge and sometimes user studies or A/B testing to pin down the tradeoff that minimizes real-world harm. The curve gives you the options; business reasoning picks the point.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Precision and recall are the foundation of every binary classifier deployed in production. Spam filters use them to balance not missing spam (low recall is bad for users) against not junking legitimate email (low precision is bad for senders). Cancer detection systems push recall toward 100% — missing a case is unacceptable — and accept lower precision, sending suspicious findings for expert review. Fraud detection systems do the same: false alarms (requiring a follow-up call to verify) are cheaper than missing fraud (losing the transaction and customer trust). Content moderation systems in social networks balance removing truly harmful content (recall) against not over-censoring (precision). Loan approval systems can tune differently: a conservative lender might maximize precision (only approve when very confident), while a credit builder might maximize recall (give more people a chance, knowing some will default). The confusion matrix and precision-recall framework are so universal that they appear in medical literature (sensitivity and specificity, older names for recall and precision), information retrieval (how often is a search result relevant, how much of the relevant corpus did we return), and machine learning libraries worldwide.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `The first pitfall is trusting accuracy on imbalanced data. A 99%-accurate model that predicts the majority class for everything is worse than useless; it is a lie. Always compute precision and recall. The second is treating precision and recall as independent. They are not — you control both by moving one slider (the threshold), and any movement that raises one typically lowers the other. You do not maximize both; you find the point on the curve you can afford. The third is using F1 when your problem does not value precision and recall equally. If false negatives are ten times as costly as false positives, a balanced F1 will steer you to the wrong threshold. Instead, weight the two metrics or use a domain-specific cost function. The fourth is confusing the precision-recall curve (which results from sweeping a decision threshold) with the ROC curve (which plots true positive rate against false positive rate; ROC is useful for balanced problems and less informative on imbalanced data). The fifth is computing precision and recall on the training set, which overfits shamelessly — always use a held-out test set. Finally, precision and recall assume a fixed, discrete decision rule (flag or do not flag). Real systems sometimes output ranked lists or soft predictions; in those cases, you compute the precision-recall curve, and metrics like average precision across recall levels become important.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Precision and recall are the language of evaluation. To see them in action, study Naive Bayes (Spam Filter), which builds a full classifier you can threshold and curve. For how to experiment reliably and catch false alarms in evaluation itself, read A/B Testing & p-values. When your problem involves sequential decisions — whether to show a spam email, when to dial up the confidence threshold, when to ask a user to verify — see Thompson Sampling for a framework that balances exploration and exploitation under uncertainty. To understand why some classifiers are inherently better at precision-recall tradeoffs, study Random Forest, which builds stable, well-calibrated probability estimates. Finally, the confusion matrix and metrics are built on information-theoretic ideas; Entropy & Information will show you why the four-cell structure emerges naturally from the math of distinguishing signal from noise.`,
      ],
    },
  ],
};
