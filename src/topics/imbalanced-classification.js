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
      heading: `Why imbalance matters`,
      paragraphs: [
        `Imbalanced classification is the regime where one class is much more common than the other. Fraud may be 1 percent of card transactions, a manufacturing defect may appear in one part per thousand, and a disease may be absent in most screenings. The rare class is often the class that matters most. The model is not being built to admire the majority. It is being built to find the few cases that carry risk, cost, or intervention value.`,
        `Imbalance matters because ordinary metrics can reward useless behavior. In a dataset with 1,000 transactions, 10 frauds, and 990 legitimate payments, a model that approves everything is 99 percent accurate. It catches zero fraud. A second model may catch 6 of the 10 frauds and create 20 false alarms, but its accuracy is 97.6 percent. Accuracy prefers the model that does nothing because the majority class dominates the count.`,
        `The core lesson is that a metric is a question. Accuracy asks what fraction of all examples were classified correctly. In rare-event systems, that question is often too broad to be useful. Investigators care how many frauds were caught, how many alarms were false, and whether the review queue fits operational capacity. Doctors care about missed disease and unnecessary follow-up. Security teams care about analyst overload. The denominator determines the story.`,
      ],
    },
    {
      heading: `The naive approach and its wall`,
      paragraphs: [
        `The naive approach is to train a classifier, use the default threshold, and report accuracy. Default thresholds are often inherited from balanced classroom examples. A probability above 0.5 means positive; otherwise negative. But when the positive class is rare and the cost of missing it is high, 0.5 may be an absurd decision boundary. A fraud probability of 0.03 can be worth investigating if a missed fraud is expensive and a review is cheap.`,
        `The second naive approach is to fix the data distribution by blindly oversampling the rare class. Copying fraud examples can help the learner notice them, but it can also teach the model to memorize repeated cases. Undersampling the majority class can balance the dataset but throws away evidence about normal behavior. Synthetic methods such as SMOTE can create helpful minority examples, but they can also invent examples that cross class boundaries or leak structure if used before splitting data.`,
        `The wall is that imbalance is not just a training problem. It is an evaluation and deployment problem. A model can rank rare cases well but look bad under accuracy. A model can have a beautiful ROC point and still overwhelm investigators. A model can be improved by class weights but produce probabilities that no longer match real-world prevalence. Fixing imbalance requires aligning training, metrics, calibration, and thresholding with the actual decision.`,
      ],
    },
    {
      heading: `Core insight`,
      paragraphs: [
        `Imbalance is a decision problem wearing a dataset shape. The rare class may be statistically small and operationally central. A model that ignores the minority can look strong under the wrong metric, while a useful model can look worse because it creates visible false alarms in order to catch rare positives.`,
        `The clean way to reason about it is to keep three objects separate: the score distribution, the threshold or action policy, and the workflow that pays for errors. Changing class weights, resampling, and moving thresholds all re-price mistakes, but they do so at different points in the system.`,
      ],
    },
    {
      heading: `The denominator is the argument`,
      paragraphs: [
        `Use the same confusion matrix and ask different denominator questions. Recall is TP / (TP + FN). Among real frauds, how many did the model catch? Precision is TP / (TP + FP). Among alarms, how many were real? False-positive rate is FP / (FP + TN). Among legitimate transactions, how many were falsely flagged? Accuracy is (TP + TN) / all examples. Each metric is correct for its own question and misleading for others.`,
        `In the transaction example, the useful model catches 6 frauds, misses 4, creates 20 false alarms, and correctly passes 970 legitimate payments. Recall is 60 percent. False-positive rate is 20 / 990, about 2 percent. Precision is 6 / 26, about 23 percent. Those are not contradictions. They are different views of the same system. The ROC view says the false-positive fraction among negatives is low. The precision view says most alarms are false.`,
        `Now scale the legitimate traffic to 9,900 while keeping fraud and false-positive rate behavior similar. A 2 percent false-positive rate creates about 200 false alarms. The ROC point may barely change, because false-positive rate still divides by all negatives. Precision collapses because the alarm queue now contains 6 true frauds and about 200 false alarms. This is why rare-positive teams often live on precision-recall curves and alert budgets rather than accuracy or ROC alone.`,
      ],
    },
    {
      heading: `Mechanism`,
      paragraphs: [
        `The mechanism is a feedback loop between counts and costs. The confusion matrix gives TP, FP, TN, and FN at one threshold. Metrics choose denominators for those counts. Training changes the score distribution. Thresholding chooses which scores become actions. Calibration decides whether scores can be interpreted as probabilities.`,
        `For a rare-positive workflow, the most useful dashboard usually combines recall, precision, false-positive volume, alert budget, calibration, and slice performance. No single number can tell whether the model is learning, whether the threshold is sensible, and whether the downstream team can absorb the alarms.`,
      ],
    },
    {
      heading: `Fix 1: move the threshold`,
      paragraphs: [
        `The cheapest fix is often to leave the trained model alone and move the threshold. If the model produces calibrated probabilities, the cost-based threshold is tied to the relative cost of mistakes. If a false alarm costs 1 unit and a missed fraud costs 99 units, then suspicion well below 0.5 can justify action. A threshold near 0.01 may be rational. The default 0.5 threshold silently assumes false positives and false negatives have comparable cost under the modeled probability.`,
        `Thresholding has practical advantages. It does not require retraining. It is reversible. It can be tuned per product surface, customer tier, geography, or review capacity. A fraud system may use a low threshold for automatic soft holds, a higher threshold for human review, and an even higher threshold for irreversible account action. The same score can feed multiple decisions.`,
        `The danger is choosing the threshold on contaminated or unrepresentative data. The validation set must reflect deployment prevalence, and the threshold should be selected using the intended cost model or capacity constraint. If probabilities are not calibrated, a cost formula based on probability can be wrong. In that case, choose thresholds empirically from validation curves and calibrate before interpreting scores as risk.`,
      ],
    },
    {
      heading: `Fix 2: class weights and losses`,
      paragraphs: [
        `Class weighting changes training. Instead of letting the loss be dominated by easy majority examples, the learner gives more penalty to rare-class mistakes. In a 99-to-1 dataset, a balanced class-weight setting may make one fraud error count roughly like 99 legitimate errors. This can force the decision boundary to pay attention to rare examples that would otherwise contribute little to the total gradient.`,
        `Weighted losses are useful when the model truly is not learning the minority signal. They are common in logistic regression, tree ensembles, neural networks, and many library defaults. Focal loss is a related idea used in deep learning: it downweights easy examples and focuses training on hard or misclassified cases. Both approaches address the same failure mode, where abundant easy negatives drown the signal from rare positives.`,
        `The tradeoff is probability distortion. If the training objective pretends fraud is much more common or much more costly than it is, the raw model scores may no longer be calibrated to real prevalence. That can be fine if the score is only used for ranking, but it is dangerous if downstream systems interpret the score as probability. After class weighting, evaluate ranking, choose thresholds on untouched validation data, and run calibration checks before exposing probability-like scores.`,
      ],
    },
    {
      heading: `Fix 3: resampling`,
      paragraphs: [
        `Resampling changes the examples the learner sees. Oversampling repeats rare examples or synthesizes new ones so the model receives more minority-class signal. Undersampling keeps the rare examples and discards many majority examples so the class ratio becomes less extreme. Hybrid methods combine both. These methods can be effective, especially for learners that are sensitive to class frequency.`,
        `Oversampling is not free. If the rare class has only a few examples, copying them many times can produce memorization. Synthetic methods can help by interpolating between minority neighbors, but they assume the local geometry is meaningful. In high-dimensional sparse spaces, or near class boundaries, synthetic points can be unrealistic. Undersampling can reduce training cost and rebalance the task, but it discards information about the majority class and may remove rare but important negative patterns.`,
        `The most important rule is to split before resampling. If duplicates or synthetic neighbors appear in both training and validation sets, evaluation is contaminated. The model is being tested on near-copies of what it saw during training. Resampling belongs inside the training fold of cross-validation, never across the full dataset before the split.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `Threshold movement works because the deployed decision boundary is not forced to be 0.5. If missing a positive is much more expensive than checking a false alarm, the rational threshold can be far lower. This is often the cheapest improvement because it uses the ranking signal the model already learned.`,
        `Class weights and resampling work when the learner was underexposed to rare-positive mistakes during training. They change the optimization pressure so the model spends capacity on the minority class. They should be validated carefully because the same intervention that improves recall can distort probability meaning or increase false positives beyond the workflow budget.`,
      ],
    },
    {
      heading: `Evaluation signals`,
      paragraphs: [
        `Start with the confusion matrix at the intended operating threshold. Then report recall, precision, false-positive rate, false-negative rate, and the number of alerts per day or per million examples. Counts matter. A 1 percent false-positive rate means something very different at 1,000 examples than at 100 million examples. Operational teams need volumes, not just rates.`,
        `Use precision-recall curves when positives are rare. Precision-recall focuses on the positive class and the alert queue. ROC and AUC are still useful for ranking comparison, but they should not be the only evidence. Report AUC-PR or average precision alongside ROC AUC, and include precision at fixed recall or recall at fixed alert budget when the product has a real constraint.`,
        `Use stratified or grouped validation so every split contains enough rare positives and avoids leakage between related examples. Fraud, medical, and security datasets often contain repeated users, families, merchants, devices, or incidents. If related examples cross train and test boundaries, the measured rare-class performance can be far too optimistic. Also report uncertainty. With only a handful of positives, one extra true positive can move recall dramatically.`,
      ],
    },
    {
      heading: `Where it is used and where it fails`,
      paragraphs: [
        `Imbalanced classification appears in fraud detection, medical screening, cybersecurity alerting, rare manufacturing defects, churn rescue, abuse detection, content safety, predictive maintenance, and legal discovery. In each case, the rare class is attached to a workflow. A fraud alert may create a review task. A medical positive may create follow-up testing. A security alert may wake an analyst. The model is only useful if the workflow can absorb its errors.`,
        `The approach fails when teams optimize the metric that is easiest to improve rather than the decision that matters. Accuracy can be meaningless. ROC can hide alert volume. Oversampling can leak. Class weighting can damage calibration. Thresholds can be tuned to a validation set that does not match deployment. Another common failure is ignoring slices: the model may catch common fraud patterns while missing a new merchant category, region, or attack type.`,
        `Imbalance is also not a license to chase the rare class at any cost. False positives have real costs. A cancer screening test that produces too many false positives can cause harm. A fraud model that blocks too many legitimate transactions can damage trust and revenue. The right system prices both sides honestly and makes those prices visible.`,
      ],
    },
    {
      heading: `Case study: fraud review queue`,
      paragraphs: [
        `A payments team receives 100,000 transactions per day, with fraud around 0.5 percent. The model scores every transaction. At the old threshold, the team reviews 300 alerts per day, catches 180 frauds, and wastes 120 reviews. A new model has higher ROC AUC, but at the same alert volume it catches only 175 frauds because its gain is in a threshold region the team cannot use. Another model has similar AUC but better precision among the top 300 alerts, so it is the better deployment candidate.`,
        `The team evaluates several operating points. Automatic declines require very high precision because false positives are painful. Human review can tolerate lower precision but is capacity-limited. Passive monitoring can use lower thresholds because the action is cheap. The final system does not have one magic threshold. It has a score, calibrated risk bands, action-specific thresholds, review-capacity monitoring, and drift checks for new fraud patterns.`,
        `This case shows why imbalance work is broader than algorithm choice. The model, threshold, calibration, queue size, and cost model all interact. The rare class is not merely a statistical inconvenience. It is the reason the system exists.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study precision, recall, and the confusion matrix first, because every imbalance discussion depends on those counts. Then study ROC curves and AUC to understand ranking, and precision-recall curves to understand rare-event alert quality. Study threshold selection with real costs before changing algorithms. Study calibration and reliability diagrams if any downstream system treats scores as probabilities.`,
        `For training methods, study class-weighted logistic regression, cost-sensitive learning, focal loss, hard-example mining, SMOTE, and stratified cross-validation. For production systems, study drift monitoring, alert-budget evaluation, human-in-the-loop review, and data leakage. The durable habit is simple: name the base rate, name the cost of each error, choose metrics with the right denominators, and validate on data that looks like deployment.`,
      ],
    },
  ],
};
