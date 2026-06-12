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
    explanation: `Now a model that actually works: it catches 6 of the 10 frauds (recall 60%) at the price of 20 false alarms. Total the diagonal: accuracy ${pct(acc)} — LOWER than the do-nothing model's 99.0%. Accuracy, asked to choose, prefers the model that ignores every fraud over the one that catches most of them. The lesson is not "this model is bad"; it is that the METRIC is broken here: 990 easy negatives drown out everything that matters in the sum.`,
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
      title: 'Scale the negatives 10× — ROC blind, precision honest',
      rows: [{ id: 'small', label: '990 legit' }, { id: 'big', label: '9900 legit' }],
      columns: [{ id: 'fpr', label: 'FPR' }, { id: 'prec', label: 'precision' }],
      values: [[0.0202, 0.2308], [0.0202, 0.0291]],
      format: pct,
    }),
    highlight: { active: ['small:fpr', 'big:fpr'], removed: ['big:prec'] },
    explanation: 'The killer experiment: keep the model identical and multiply the legit traffic by 10 (same 2% FPR now produces 200 false alarms against the same 6 catches). The ROC curve DOES NOT MOVE — FPR is still 2.0%, AUC unchanged. Precision collapses from 23% to 6/206 = 2.9%: ninety-seven of a hundred alarms are now false. ROC is base-rate blind by construction; the precision-recall curve re-draws itself for every prevalence. Rule of thumb: rare positives and alarm budgets → live on the PR curve; balanced classes or ranking quality → ROC is fine.',
    invariant: 'FPR and TPR never depend on class ratio; precision always does.',
  };
}

function* fixes() {
  yield {
    state: arrayState(['loss = errors on legit + errors on fraud', 'loss = errors on legit + 99 × errors on fraud']),
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
    invariant: 'Class weights, 99× oversampling, and a 0.01 threshold are three doors into the same room: re-pricing mistakes.',
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
      format: (v) => ['', 'none', 'none — try first', 'one retrain', 'probabilities skew → recalibrate', 'memorizes duplicates', 'discards data'][v],
    }),
    highlight: { found: ['thresh:cost', 'thresh:risk'] },
    explanation: 'The menu, priced honestly. Note the side-effect column for weights and resampling: both deliberately warp the training distribution, so the model\'s output probabilities stop matching reality — a 0.5 from a 99×-weighted model is NOT a 50% fraud chance. If anything downstream consumes the probability, recalibrate on untouched data (Calibration & Reliability Diagrams). The honest workflow for rare-positive problems: evaluate on the PR curve, move the threshold first, add weights if the model truly never learns the minority, and treat resampling as the specialist\'s tool — never the reflex.',
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
    {
      heading: `What it is`,
      paragraphs: [
        `Imbalanced classification is when one class vastly outnumbers the other. Fraud is 1% of transactions; disease is 0.1% of screenings; defects are rare in manufacturing. In these problems, accuracy — "percentage correct" — is a lie: a model predicting "never fraud" on 1000 transactions with 10 real frauds scores 99.0% by doing nothing. A model catching 6 frauds at the cost of 20 false alarms scores 97.6% — worse — and gets discarded. Accuracy is dominated by the majority class, so the rare class becomes a rounding error. Worse: the same 20 false positives yield two honest metrics with opposite answers: a 2.0% false-positive rate (dividing by 990 negatives) and a 23% precision (dividing by 26 alarms raised). ROC is base-rate blind; precision is not. This topic teaches you to see through these deceptions and apply practical fixes.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The demo shows 1000 card transactions: 10 fraud, 990 legitimate. A do-nothing model scores 99.0% accuracy. A model catching 6 frauds at the cost of 20 false alarms scores 97.6% accuracy (worse) but is actually useful — it recalls 60% of fraud. The deception: accuracy sums TP and TN on a scale dominated by TN. Now the same 20 false positives: ROC divides by 990 negatives (FPR = 2.0%), while precision divides by 26 alarms (23% = 6/26). Same number; opposite denominators; opposite stories. ROC tells analysts "only 2% of legit transactions wrongly flagged"; precision tells investigators "77 of every 100 alarms are false." Scale the legits 10×, and ROC stays at 2.0% FPR (base-rate blind), but precision collapses to 2.9% because the denominator explodes. The honest fix: re-price mistakes. Class weights (99× fraud penalty) make gradient descent hunt for the rare class. Moving the threshold from 0.5 to 0.01 raises alarms more eagerly, catching more fraud. Resampling (copy frauds or discard legits) rebalances training but memorizes duplicates or discards data. Evaluate on the PR curve for rare-positive problems.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Threshold shifts cost nothing: no retraining, instant to deploy, fully reversible. Class weights cost one retraining pass — negligible. Resampling costs data preparation; SMOTE generates synthetic examples. The real cost: if you reweight or resample, probabilities are skewed and need recalibration on held-out data. Metric cost: accuracy is broken on imbalanced data. Use the PR curve instead of ROC for rare positives.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Fraud detection (0.1%–1% of transactions) costs missing fraud far more than investigating false alarms. Credit-card processors live on the PR curve. Disease screening: 99% of results are negative, but missing one can cost a life. Manufacturing: 99.9% of parts are fine; catch the 0.1% defects. Cybersecurity: most traffic is normal; malicious is rare and crucial. Churn prediction: most customers renew; catch the few who leave. In all cases, the cost of missing a rare positive far exceeds investigating false alarms. The model must be re-priced to match reality, or it optimizes for accuracy — the wrong thing.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `"My model ignores the rare class" often means "I evaluated on accuracy" or "left the threshold at 0.5" — not that the model is broken. Try threshold sweep first. Another trap: using ROC for rare-positive problems. ROC is base-rate blind; use the PR curve instead. Oversampling tempts memorization of duplicates; undersampling discards data; class weights are principled. Do not trust reweighted probabilities without recalibration. Finally, the threshold is a deployment knob you turn to match your cost structure — leaving it at 0.5 wastes learned information.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Start with Precision, Recall & the Confusion Matrix. Then ROC Curves & AUC to see why ROC is base-rate blind. Picking a Threshold with Real Costs teaches t* = cost(FP) / (cost(FP) + cost(FN)). Calibration & Reliability Diagrams tests if probabilities match reality. Finally, Logistic Regression shows where class weights and thresholds live in the algorithm.`,
      ],
    },
  ],
};

