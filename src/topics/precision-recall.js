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
    state: cm(`Precision ${pct(mt.precision)} Â· Recall ${pct(mt.recall)}`),
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read each frame as a labeled-count update. A positive is the class the system is trying to find, such as spam, fraud, disease, or a relevant document. Active cells show which confusion-matrix count changes after one prediction.',
        {type: 'callout', text: 'Precision and recall force the evaluation to name which positive-class mistake matters: false alarms or missed positives.'},
        'Visited cells are examples already assigned to true positive, false positive, true negative, or false negative. Found markers indicate the metric currently being computed from those counts. The safe inference is that precision and recall differ only because they divide by different denominators.',
      
        {type: 'image', src: './assets/gifs/precision-recall.gif', alt: 'Animated walkthrough of the precision recall visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },    {
      heading: 'Why this exists',
      paragraphs: [
        'Precision and recall exist because accuracy can hide the mistakes that matter. Accuracy is the fraction of all predictions that are correct, so it is dominated by the majority class when one class is rare. A spam detector can score 95% accuracy by calling every email harmless if only 5% are spam.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/1/11/Confusion_Matrix_Metrics.png', alt: 'Confusion matrix metrics showing accuracy, precision, recall, and specificity', caption: 'Precision and recall use different denominators inside the same four-cell ledger. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Confusion_Matrix_Metrics.png.'},
        'The confusion matrix is the ledger that fixes the ambiguity. It counts true positives, false positives, true negatives, and false negatives. Precision and recall read different rows or columns of that ledger so the team can attach real costs to false alarms and misses.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to report accuracy. It is easy to compute, easy to explain, and correct when classes and mistake costs are balanced. For a balanced image classifier, accuracy may be a useful first check.',
        'Another obvious approach is to pick the threshold that makes the dashboard number look best. Most classifiers output scores, not final labels, so moving the threshold changes the confusion matrix. Without naming the cost of each mistake, threshold tuning becomes cosmetic.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is class imbalance. If 950 of 1,000 emails are harmless, a classifier can be right 950 times while catching zero spam. Accuracy answered the arithmetic question and missed the product question.',
        'The second wall is asymmetric cost. A false positive in spam filtering may hide a real invoice, while a false negative lets junk through. A medical screen may reverse those priorities. One number cannot choose between those costs without saying which mistake matters more.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate the positive-class promises. Precision asks, of the items the model flagged, how many were truly positive. Recall asks, of all real positives, how many the model found.',
        'Those denominators make the trade explicit. Lowering a threshold usually increases recall because more positives are caught, but it can reduce precision because more negatives are flagged too. Raising the threshold usually does the opposite.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Run the model on labeled examples and place each prediction in one of four cells. True positive means positive and flagged. False positive means negative but flagged. False negative means positive but missed. True negative means negative and ignored.',
        'Precision is TP / (TP + FP). Recall is TP / (TP + FN). F1 is 2PR / (P + R), the harmonic mean of precision and recall, and it punishes collapse on either side.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is conservation of examples. Every labeled example lands in exactly one confusion-matrix cell, so the four counts fully describe binary classification outcomes at a fixed threshold. Precision and recall are just two different projections of that same ledger.',
        'Precision uses the positive-prediction column, so it measures alert quality. Recall uses the real-positive row, so it measures detection coverage. Because the denominators are different, the metrics cannot be substituted for each other.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The computation is O(n) for n labeled examples: score each example, threshold it, update one cell, and divide counts. Memory is O(1) if only aggregate metrics are needed. The expensive part is collecting labels that match deployment.',
        'Cost behaves through the threshold. Lowering the threshold increases review volume, analyst time, moderation workload, or false-alarm damage. Raising it reduces that workload but increases missed positives. The right threshold is a cost decision, not a mathematical default.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Spam filters use precision to avoid hiding legitimate mail and recall to keep inboxes clean. Fraud systems use precision to manage investigator workload and recall to limit missed losses. Medical screening often treats recall as critical because a missed disease can be worse than a follow-up test.',
        'Search and recommendation systems use precision at k because users only inspect a small number of results. Moderation systems monitor both sides because false positives suppress legitimate content and false negatives leave harmful content visible. The same four-cell ledger carries across domains.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Precision changes with prevalence. If positives become rarer, precision can fall even when the classifier ranking is unchanged. Comparing precision across datasets without naming the base rate is misleading.',
        'The metrics also fail when evaluation data is contaminated. Training-data leakage, threshold tuning on the test set, label noise, and distribution shift all produce confident-looking ratios that do not survive deployment. Slice the confusion matrix by subgroup when mistakes have uneven cost.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use 1,000 emails with 50 real spam messages and 950 real ham messages. A threshold 0.5 classifier flags 70 emails. Of those, 40 are spam and 30 are ham, so TP = 40 and FP = 30.',
        'The classifier missed 10 spam messages, so FN = 10, and it correctly ignored 920 ham messages, so TN = 920. Accuracy is (40 + 920) / 1000 = 96%. Precision is 40 / (40 + 30) = 57.1%, and recall is 40 / (40 + 10) = 80%.',
        'Now raise the threshold to 0.9 and suppose TP = 25, FP = 2, FN = 25, and TN = 948. Precision becomes 25 / 27 = 92.6%, but recall falls to 25 / 50 = 50%. The cleaner alert queue cost half the detections.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Core references include the confusion-matrix definitions used in information retrieval, medical screening, and machine-learning evaluation, plus Davis and Goadrich, The Relationship Between Precision-Recall and ROC Curves, 2006. These sources explain why precision-recall curves are often better than ROC curves on rare-positive tasks.',
        'Study next: Imbalanced Classification for base-rate traps, ROC Curves and AUC for threshold sweeps from a false-positive-rate view, Calibration Curves before treating scores as probabilities, and Cost-Sensitive Thresholding for choosing an operating point from real error costs.',
      ],
    },
  ],
};



