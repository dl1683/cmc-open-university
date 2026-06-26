// Imbalanced classification: when 99% of the data is one class, accuracy
// becomes a liar, ROC becomes a flatterer, and the metrics that divide by
// the right denominator are the only honest witnesses left.

import { matrixState, arrayState, InputError } from '../core/state.js';

export const topic = {
  id: 'imbalanced-classification',
  title: 'Imbalanced Data: When 99% Is One Class',
  category: 'AI & ML',
  summary: 'Fraud is 1% of the data: watch accuracy lie, ROC flatter, and the fixes that make models care about the rare class.',
  controls: [
    { id: 'view', label: 'See', type: 'select', options: ['how the metrics deceive', 'the fixes, honestly priced'], defaultValue: 'how the metrics deceive' },
  ],
  run,
};

// 1000 card transactions: 10 fraud, 990 legit.
// A real model at threshold 0.5: TP 6, FN 4, FP 20, TN 970.
const M = { tp: 6, fn: 4, fp: 20, tn: 970 };
const pct = (v) => `${(v * 100).toFixed(1)}%`;

function* deceive() {
  yield {
    state: matrixState({
      title: '1000 transactions — and the model that does nothing',
      rows: [{ id: 'fraud', label: 'fraud (10)' }, { id: 'legit', label: 'legit (990)' }],
      columns: [{ id: 'flag', label: 'flagged' }, { id: 'pass', label: 'passed' }],
      values: [[0, 10], [0, 990]],
      format: String,
    }),
    highlight: { removed: ['fraud:pass'] },
    explanation: 'A card processor sees 1000 transactions; 10 are fraud. Meet the laziest possible model: approve everything. Its confusion matrix is two columns of nothing — and its accuracy is 990/1000 = 99.0%. Precision, Recall & the Confusion Matrix showed this trap at 5% spam; at 1% fraud it bites harder, and real fraud runs near 0.1%, where do-nothing scores 99.9%. On imbalanced data, accuracy measures the BASE RATE, not the model. Hold that 99.0% in mind — a real model is about to score WORSE.',
  };

  const acc = (M.tp + M.tn) / 1000;
  yield {
    state: matrixState({
      title: `A genuinely useful model — accuracy ${pct(acc)}`,
      rows: [{ id: 'fraud', label: 'fraud (10)' }, { id: 'legit', label: 'legit (990)' }],
      columns: [{ id: 'flag', label: 'flagged' }, { id: 'pass', label: 'passed' }],
      values: [[M.tp, M.fn], [M.fp, M.tn]],
      format: String,
    }),
    highlight: { found: ['fraud:flag'], compare: ['legit:flag'] },
    explanation: `Now a model that actually works: it catches 6 of the 10 frauds (recall 60%) at the price of 20 false alarms. Total the diagonal: accuracy ${pct(acc)} — LOWER than the do-nothing model\'s 99.0%. Accuracy, asked to choose, prefers the model that ignores every fraud over the one that catches most of them. The lesson is not "this model is bad"; it is that the METRIC is broken here: 990 easy negatives drown out everything that matters in the sum.`,
    invariant: 'When one class dominates, overall accuracy is dominated by performance on that class alone.',
  };

  yield {
    state: matrixState({
      title: 'Same counts, two lenses',
      rows: [{ id: 'roc', label: 'ROC lens (FPR)' }, { id: 'pr', label: 'PR lens (precision)' }],
      columns: [{ id: 'calc', label: 'computation' }, { id: 'val', label: 'verdict' }],
      values: [[1, 0.0202], [2, 0.2308]],
      format: (v) => (v === 1 ? '20 / 990 negatives' : v === 2 ? '6 / 26 alarms' : pct(v)),
    }),
    highlight: { compare: ['roc:val', 'pr:val'] },
    explanation: 'Here is the subtler deception, aimed at ROC Curves & AUC: this model\'s false-positive rate is 20/990 = 2.0% — a gorgeous ROC point (60% TPR at 2% FPR). But ask the question an analyst asks — "when the alarm rings, is it real?" — and the answer is 6/26 = 23%: three of every four alarms waste an investigation. Both numbers use the SAME 20 false positives; they just divide by different things. FPR divides by all 990 negatives, so a sea of easy legits makes any alarm count look small. Precision divides by the alarms themselves. The denominator is the whole argument.',
  };

  yield {
    state: matrixState({
      title: 'Scale the negatives 10Ã— — ROC blind, precision honest',
      rows: [{ id: 'small', label: '990 legit' }, { id: 'big', label: '9900 legit' }],
      columns: [{ id: 'fpr', label: 'FPR' }, { id: 'prec', label: 'precision' }],
      values: [[0.0202, 0.2308], [0.0202, 0.0291]],
      format: pct,
    }),
    highlight: { active: ['small:fpr', 'big:fpr'], removed: ['big:prec'] },
    explanation: 'The killer experiment: keep the model identical and multiply the legit traffic by 10 (same 2% FPR now produces 200 false alarms against the same 6 catches). The ROC curve DOES NOT MOVE — FPR is still 2.0%, AUC unchanged. Precision collapses from 23% to 6/206 = 2.9%: ninety-seven of a hundred alarms are now false. ROC is base-rate blind by construction; the precision-recall curve re-draws itself for every prevalence. Rule of thumb: rare positives and alarm budgets â†’ live on the PR curve; balanced classes or ranking quality â†’ ROC is fine.',
    invariant: 'FPR and TPR never depend on class ratio; precision always does.',
  };
}

function* fixes() {
  yield {
    state: arrayState(['loss = errors on legit + errors on fraud', 'loss = errors on legit + 99 Ã— errors on fraud']),
    highlight: { compare: ['i0'], found: ['i1'] },
    explanation: 'Fix 1 — CLASS WEIGHTS: tell the loss function the truth about the stakes. Multiply the penalty for fraud mistakes by 99 (the inverse class ratio), and gradient descent suddenly finds the 10 fraud cases worth contorting the boundary for — one missed fraud now hurts like 99 misclassified legits. This is Picking a Threshold with Real Costs moved INTO training: same cost-ratio arithmetic, applied to the gradient instead of the cutoff. One line in every library: class_weight="balanced".',
  };

  yield {
    state: matrixState({
      title: 'Fix 2 — resampling the training set',
      rows: [{ id: 'orig', label: 'original' }, { id: 'over', label: 'oversample fraud' }, { id: 'under', label: 'undersample legit' }],
      columns: [{ id: 'fraud', label: 'fraud rows' }, { id: 'legit', label: 'legit rows' }],
      values: [[10, 990], [990, 990], [10, 10]],
      format: String,
    }),
    highlight: { active: ['over:fraud'], removed: ['under:legit'] },
    explanation: 'Fix 2 — RESAMPLING: change the data instead of the loss. OVERSAMPLE: copy each fraud row ~99 times until the classes balance (SMOTE is the refined version — it interpolates synthetic frauds between real neighbors instead of photocopying). UNDERSAMPLE: keep all 10 frauds and throw away 980 legits. Both hand the model a balanced world; both lie about reality — and the costs differ: oversampling tempts the model to memorize 10 endlessly-repeated faces; undersampling burns 99% of your hard-won data.',
  };

  yield {
    state: arrayState(['raise alarm if p(fraud) > 0.5', 'raise alarm if p(fraud) > 0.01']),
    highlight: { compare: ['i0'], found: ['i1'] },
    explanation: 'Fix 3 — and the one to try FIRST: leave the model alone and MOVE THE THRESHOLD. The threshold-with-costs formula t* = cFP/(cFP+cFN) already encodes imbalance: a $1 false alarm against a $99 missed fraud gives t* = 0.01 — flag at one percent suspicion. Zero retraining, fully reversible, adjustable per deployment. Most "my model ignores the minority class" complaints are actually "I left the threshold at 0.5" in disguise.',
    invariant: 'Class weights, 99Ã— oversampling, and a 0.01 threshold are three doors into the same room: re-pricing mistakes.',
  };

  yield {
    state: matrixState({
      title: 'The menu, with side effects',
      rows: [
        { id: 'thresh', label: 'move threshold' },
        { id: 'weights', label: 'class weights' },
        { id: 'over', label: 'oversample / SMOTE' },
        { id: 'under', label: 'undersample' },
      ],
      columns: [{ id: 'cost', label: 'training cost' }, { id: 'risk', label: 'main side effect' }],
      values: [[1, 2], [3, 4], [3, 5], [1, 6]],
      format: (v) => ['', 'none', 'none — try first', 'one retrain', 'probabilities skew â†’ recalibrate', 'memorizes duplicates', 'discards data'][v],
    }),
    highlight: { found: ['thresh:cost', 'thresh:risk'] },
    explanation: 'The menu, priced honestly. Note the side-effect column for weights and resampling: both deliberately warp the training distribution, so the model\'s output probabilities stop matching reality — a 0.5 from a 99Ã—-weighted model is NOT a 50% fraud chance. If anything downstream consumes the probability, recalibrate on untouched data (Calibration & Reliability Diagrams). The honest workflow for rare-positive problems: evaluate on the PR curve, move the threshold first, add weights if the model truly never learns the minority, and treat resampling as the specialist\'s tool — never the reflex.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'how the metrics deceive') yield* deceive();
  else if (view === 'the fixes, honestly priced') yield* fixes();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
        'The animation builds confusion matrices for 1,000 transactions with 10 fraud cases and 990 legitimate cases. A confusion matrix counts true positives, false negatives, false positives, and true negatives. Active cells show the metric currently being computed; found cells are fraud caught by the model.',
        {type: 'callout', text: 'On imbalanced data, the denominator decides the story: accuracy rewards the majority, precision prices the alert queue.'},
        'Read every score by naming its denominator. Accuracy divides by all examples, false-positive rate divides by all negatives, and precision divides by all alerts. The safe inference rule is that a metric is only honest about the population in its denominator.',
      
        {type: 'image', src: './assets/gifs/imbalanced-classification.gif', alt: 'Animated walkthrough of the imbalanced classification visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    { heading: 'Why this exists', paragraphs: [
        'Imbalanced classification means one class is much rarer than the other. Fraud, disease, security incidents, and manufacturing defects often appear below 1% of examples. The rare class is usually the class that matters most.',
        {type: 'image', src: 'https://scikit-learn.org/stable/_images/sphx_glr_plot_confusion_matrix_001.png', alt: 'Confusion matrix heatmap for a classifier', caption: 'A confusion matrix is the basic accounting surface: true positives, false negatives, false positives, and true negatives must stay visible before any summary metric. Source: scikit-learn example gallery: https://scikit-learn.org/stable/auto_examples/model_selection/plot_confusion_matrix.html'},
        'A model that predicts every transaction is legitimate can score 99.9% accuracy on a dataset with 0.1% fraud. It catches no fraud. The topic exists because ordinary metrics and thresholds can reward the model for ignoring the problem.',
      ], },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious approach is to train a standard classifier and use threshold 0.5. On balanced data, this often gives a sensible first model. Reporting accuracy also feels natural because it counts total correct predictions.',
        'A second obvious approach is to balance the data by copying rare examples. That helps the learner see the minority class more often. It can also make the model memorize duplicated examples instead of learning the rare-class region.',
      ], },
    { heading: 'The wall', paragraphs: [
        'The wall is denominator mismatch. Accuracy divides by all examples, so 990 easy negatives can hide 10 missed positives. False-positive rate divides by all negatives, so a small rate can still create a large alert queue when negatives dominate.',
        {type: 'image', src: 'https://scikit-learn.org/stable/_images/sphx_glr_plot_precision_recall_001.png', alt: 'Precision-recall curve plot with operating points', caption: 'Precision-recall curves expose the alert-queue tradeoff directly, which is why they are more honest than accuracy for rare-positive problems. Source: scikit-learn example gallery: https://scikit-learn.org/stable/auto_examples/model_selection/plot_precision_recall.html'},
        'If a model catches 6 frauds, misses 4, and creates 20 false alarms, recall is 6/10 = 60% and precision is 6/26 = 23%. That means three out of four alerts waste investigator time. Accuracy is 976/1000 = 97.6%, which hides the operational pain.',
      ], },
    { heading: 'The core insight', paragraphs: [
        'Imbalance is not one problem. It is a training problem, because the learner sees few positives; an evaluation problem, because common metrics hide misses; and a deployment problem, because humans or systems must handle alerts. Each fix reprices one of those layers.',
        'Threshold movement changes the decision policy, class weighting changes the loss, and resampling changes the training distribution. The correct threshold is usually a business decision about miss cost, false-alarm cost, and alert capacity, not a default value from a library.',
      ], },
    { heading: 'How it works', paragraphs: [
        'Start from the confusion matrix and choose metrics that price the rare class directly. Recall is TP / (TP + FN), so it measures how many positives were caught. Precision is TP / (TP + FP), so it measures how many alerts are real.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/1/13/Roc_curve.svg', alt: 'Receiver operating characteristic curve with true positive and false positive axes', caption: 'ROC space is useful for ranking behavior, but its false-positive denominator can hide operational pain when negatives dominate. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Roc_curve.svg'},
        'Then choose an intervention. Class weighting gives positive examples a larger loss weight. Oversampling repeats or synthesizes positives, while undersampling removes some negatives. Threshold tuning changes how many ranked examples become alerts after the model is trained.',
      ], },
    { heading: 'Why it works', paragraphs: [
        'Class weighting works because gradients follow the loss. If a missed fraud has weight 99, the optimizer treats one missed fraud like many missed legitimate examples. The decision boundary moves because the training objective changed.',
        'Threshold tuning works because many classifiers produce a ranking before they produce a label. Lowering the threshold catches more positives at the cost of more false positives. SMOTE works when minority examples form meaningful neighborhoods, because interpolation fills gaps between known positives instead of copying the same points.',
      ], },
    { heading: 'Cost and complexity', paragraphs: [
        'Threshold tuning has almost no compute cost: one comparison per prediction. Its behavior cost is alert volume. Moving from 0.9 to 0.2 may double recall while creating ten times as many investigations.',
        'Class weighting usually keeps training complexity unchanged, but it can distort calibrated probabilities. Resampling changes dataset size: oversampling increases training rows, undersampling reduces rows while discarding majority information, and SMOTE adds nearest-neighbor work roughly proportional to minority_count * k * feature_count.',
      ], },
    { heading: 'Real-world uses', paragraphs: [
        'Fraud detection is the standard case. The positive class is rare, missing fraud is expensive, and the fraud team has finite alert capacity. Precision-recall curves and threshold budgets match the operational shape.',
        'Medical screening, intrusion detection, and defect detection have the same structure. High recall may be required for safety, while precision controls unnecessary follow-up. The model is only useful if the decision threshold fits the downstream workflow.',
      ], },
    { heading: 'Where it fails', paragraphs: [
        'SMOTE fails on sparse high-dimensional data such as bag-of-words text or one-hot categories. Interpolation can create dense feature vectors that do not correspond to real examples. It also fails near overlapping class boundaries by manufacturing positives inside majority territory.',
        'Evaluation fails if resampling happens before the train-test split. Duplicates or synthetic neighbors leak into validation and make recall look better than it is. Class weighting fails silently when downstream code treats weighted scores as calibrated probabilities without recalibration.',
      ], },
    { heading: 'Worked example', paragraphs: [
        'In 1,000 transactions, there are 10 frauds and 990 legitimate transactions. A do-nothing model predicts legitimate for all rows, so TP = 0, FN = 10, FP = 0, TN = 990. Accuracy is 990/1000 = 99%, but recall is 0/10 = 0%.',
        'A real model has TP = 6, FN = 4, FP = 20, TN = 970. Accuracy is 976/1000 = 97.6%, lower than the do-nothing model. Recall is 6/10 = 60%, and precision is 6/(6+20) = 23.1%, so the model catches fraud but produces many false alerts.',
        'If negatives increase to 9,900 while the same 2% false-positive rate holds, false positives become 198. Precision becomes 6/(6+198) = 2.9%. The ROC false-positive rate still looks small, but the alert queue is now mostly noise.',
      ], },
    { heading: 'Sources and study next', paragraphs: [
        'Study Chawla et al., SMOTE, 2002, He and Garcia, Learning from Imbalanced Data, 2009, Davis and Goadrich on ROC and precision-recall curves, and Elkan on cost-sensitive learning. These sources separate sampling, metrics, and cost-sensitive objectives.',
        'Study confusion matrices, precision, recall, ROC, and calibration before tuning models. Study focal loss, grouped cross-validation, threshold selection, and drift monitoring next for production rare-event systems.',
      ], },
  ],
};
