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
        `Imbalanced classification is the regime where one class overwhelms the other: fraud is 1% of transactions, defects are rare, and many diseases are absent in most screenings. In the demo, 1,000 card transactions contain 10 frauds and 990 legitimate payments. A do-nothing model approves everything and scores 99.0% accuracy. A useful model catches 6 of the 10 frauds, misses 4, and creates 20 false alarms; its accuracy is only 97.6%. Accuracy prefers the useless model because the majority class dominates the arithmetic.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The same counts tell different stories depending on the denominator. The useful model's recall is 6/10 = 60%. Its false-positive rate is 20/990 = 2.0%, which looks excellent on ROC Curves & AUC. But precision is 6/(6+20) = 23.1%, meaning about three out of four alarms are false. Now multiply legitimate traffic by ten while keeping the same 2% false-positive rate: false alarms rise to 200 and precision collapses to 6/206 = 2.9%. The ROC point does not move because FPR ignores prevalence; the precision-recall view changes immediately.`,
        `The fixes all re-price mistakes. Class weights make a fraud error count about 99 times more than a legitimate error in the loss. Oversampling copies or synthesizes rare examples; undersampling discards many majority examples. The cheapest first move is often thresholding: Picking a Threshold with Real Costs shows that if a missed fraud costs 99 times a false alarm, the calibrated cutoff is around 0.01, not 0.5.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Moving a threshold costs almost nothing and requires no retraining. Class weights require one retraining run. Oversampling increases the training set; undersampling throws data away; SMOTE adds synthetic examples and preprocessing complexity. The hidden cost is probability distortion: weighted and resampled models no longer see the real class distribution during training, so Calibration & Reliability Diagrams should be run on untouched validation data before anyone treats scores as probabilities. Operational cost matters too: a 23% precision fraud queue may be acceptable with automation and impossible with human investigators.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Fraud detection, medical screening, cybersecurity alerts, rare manufacturing defects, churn rescue, abuse detection, and legal discovery all live here. Investigators care about alarm budgets, not just model elegance. Team capacity, not elegance, sets the limit. Precision, Recall & the Confusion Matrix gives the operational vocabulary. Cross-Validation & Honest Evaluation must usually be stratified or grouped so each fold contains enough rare positives to measure anything. Focal Loss & Hard Examples is a deep-learning response to the same problem: easy majority examples should not drown the gradient.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The phrase my model ignores the minority class often means the metric or threshold is wrong, not that learning failed. Check the confusion matrix before changing algorithms. Do not report accuracy alone. Do not trust ROC alone when positives are rare. Do not oversample before splitting; that creates Data Leakage & Contamination by putting duplicates or synthetic neighbors on both sides. Do not assume class weights solve deployment costs; the final threshold still has to match the real cost of false positives and false negatives.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Precision, Recall & the Confusion Matrix first, then ROC Curves & AUC to understand why ROC can flatter rare-event models. Use Picking a Threshold with Real Costs to deploy the score, Calibration & Reliability Diagrams to repair probability meaning, and Focal Loss & Hard Examples when neural training itself is dominated by easy negatives.`,
      ],
    },
  ],
};
