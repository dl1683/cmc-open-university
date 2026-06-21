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
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. "How the metrics deceive" builds confusion matrices for a do-nothing model and a real model on 1,000 transactions (10 fraud, 990 legit), then shows how the same 20 false positives look under ROC versus precision-recall denominators. "The fixes, honestly priced" walks through class weights, resampling, threshold movement, and their side effects.',
        {type: 'callout', text: 'On imbalanced data, the denominator decides the story: accuracy rewards the majority, precision prices the alert queue.'},
        'Active cells are the current computation. Found cells are correct catches (true positives). Compare cells highlight two quantities that use the same numerator but different denominators -- the core of the accuracy paradox. Removed cells are missed positives or discarded data.',
        'At each frame, read the denominator. That single choice -- dividing by all examples, all negatives, or all alarms -- is the entire argument about whether a model is good or broken.',
      
        {type: 'image', src: './assets/gifs/imbalanced-classification.gif', alt: 'Animated walkthrough of the imbalanced classification visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Most classifiers are trained and evaluated on roughly balanced data: spam vs. ham at 40/60, cats vs. dogs at 50/50. In production, the class that matters most is often the rarest. Fraud is 0.1% of card transactions. Manufacturing defects appear in one part per ten thousand. Malignant tumors are absent from most screenings. The model exists to find these rare cases, yet standard training and standard metrics conspire to ignore them.',
        {type: 'image', src: 'https://scikit-learn.org/stable/_images/sphx_glr_plot_confusion_matrix_001.png', alt: 'Confusion matrix heatmap for a classifier', caption: 'A confusion matrix is the basic accounting surface: true positives, false negatives, false positives, and true negatives must stay visible before any summary metric. Source: scikit-learn example gallery: https://scikit-learn.org/stable/auto_examples/model_selection/plot_confusion_matrix.html'},
        'A model that labels every transaction "legitimate" scores 99.9% accuracy on a 0.1% fraud dataset. It catches nothing. Accuracy measures the base rate, not the model. This is the accuracy paradox: the laziest possible classifier earns the highest score because the majority class dominates the sum. Any model that actually catches fraud will score lower, because it creates visible false alarms that depress the accuracy denominator.',
        {
          type: 'note',
          text: 'The accuracy paradox is not a curiosity. It is the default failure mode for any team that trains on imbalanced data and reports a single aggregate number. The metric rewards inaction.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is to train a standard classifier, threshold at 0.5, and report accuracy. This works on balanced data because every misclassification costs roughly equal weight in the sum. On imbalanced data, the 0.5 threshold inherits an assumption from balanced textbooks: that false positives and false negatives are equally bad and equally likely. Neither is true when one class is 100x rarer and 100x more expensive to miss.',
        'The second obvious attempt is to fix the data: copy the rare examples until the classes balance. This helps the learner see the minority, but naive duplication creates exact copies. A model trained on 99 identical copies of the same 10 fraud cases can memorize their pixel-exact features rather than learning generalizable fraud patterns. The model looks great on training data and fails on the next novel fraud.',
        'Both approaches treat imbalance as a single problem with a single fix. The wall is that imbalance is three problems tangled together: a training problem (the learner ignores the minority), an evaluation problem (the metric rewards ignoring it), and a deployment problem (the alert queue overwhelms the team). Fixing one without the others produces a model that looks improved on paper and fails in the field.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the denominator. Every confusion-matrix metric divides by something, and that denominator determines what story the number tells. Accuracy divides by all examples -- so 990 easy negatives drown 10 hard positives. False-positive rate divides by all negatives -- so a sea of easy legits makes any alarm count look small. Precision divides by the alarms themselves -- so it exposes the analyst experience honestly.',
        {type: 'image', src: 'https://scikit-learn.org/stable/_images/sphx_glr_plot_precision_recall_001.png', alt: 'Precision-recall curve plot with operating points', caption: 'Precision-recall curves expose the alert-queue tradeoff directly, which is why they are more honest than accuracy for rare-positive problems. Source: scikit-learn example gallery: https://scikit-learn.org/stable/auto_examples/model_selection/plot_precision_recall.html'},
        'Consider a model with 6 true positives, 4 false negatives, 20 false positives, and 970 true negatives. Its ROC point is (FPR=2.0%, TPR=60%) -- gorgeous. Its precision is 6/26 = 23% -- three of every four alarms waste an investigation. Now scale the negatives 10x: same 2% FPR produces 200 false alarms against the same 6 catches. The ROC curve does not move. Precision collapses to 6/206 = 2.9%. ROC is base-rate-blind by construction; the precision-recall curve redraws itself for every prevalence.',
        {
          type: 'diagram',
          label: 'Decision boundary shift with resampling',
          text: 'Original data (1% positive):        After SMOTE (balanced):\n\n  - - - - - - - - -                  - - - - * - - - -\n  - - - - - - - - -                  - * - - - - * - -\n  - - - * - - - - -      -->         - - * * - * - - -\n  - - - - - - - - -                  - - - * - - - - -\n  - - - - - - - - -                  - - - - - - - - -\n\n  (-) majority class                 (*) synthetic minority\n  (*) minority class                 Boundary shifts toward\n  Boundary hugs majority             minority region',
        },
        'AUROC measures ranking quality across all thresholds and is blind to class ratio. AUPRC (area under the precision-recall curve) measures how well the model concentrates true positives at the top of its ranked list, and it is sensitive to prevalence. On a 0.1% fraud dataset, a random classifier has AUROC = 0.5 but AUPRC = 0.001. A model with AUROC = 0.95 might have AUPRC = 0.30 -- which means 70% of its top-ranked alarms are still false. For rare-positive problems, AUPRC is the honest scoreboard.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'There are four main interventions, each re-pricing mistakes at a different point in the pipeline. Threshold movement changes the decision policy without retraining. Class weighting changes the loss function so the gradient cares about rare errors. Random oversampling duplicates minority examples. SMOTE synthesizes new minority examples by interpolating between nearest neighbors.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/1/13/Roc_curve.svg', alt: 'Receiver operating characteristic curve with true positive and false positive axes', caption: 'ROC space is useful for ranking behavior, but its false-positive denominator can hide operational pain when negatives dominate. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Roc_curve.svg'},
        {
          type: 'quote',
          text: 'An approach to the construction of classifiers from imbalanced datasets is described. A dataset is imbalanced if the classification categories are not approximately equally represented. [...] Our method of over-sampling the minority class involves creating synthetic examples rather than over-sampling with replacement.',
          attribution: 'Chawla, Bowyer, Hall & Kegelmeyer, "SMOTE: Synthetic Minority Over-sampling Technique" (JAIR, 2002)',
        },
        'SMOTE works by picking a minority-class example, finding its k nearest minority-class neighbors (default k=5), choosing one neighbor at random, and creating a synthetic point on the line segment between them. For each feature dimension, the synthetic value is: x_new = x_i + lambda * (x_nn - x_i), where lambda is uniform in [0, 1]. This produces points that live in the convex hull of local minority neighborhoods rather than exact copies of existing data.',
        {
          type: 'code',
          language: 'python',
          text: '# SMOTE neighbor interpolation (one synthetic example)\nimport numpy as np\n\ndef smote_one(x_i, neighbors, k=5):\n    """Generate one synthetic minority example.\n    x_i:       a minority-class feature vector\n    neighbors: array of k nearest minority-class neighbors\n    \"\"\"\n    # Pick one neighbor at random\n    nn = neighbors[np.random.randint(k)]\n    # Interpolate: new point on the segment [x_i, nn]\n    lam = np.random.uniform(0, 1)\n    x_new = x_i + lam * (nn - x_i)\n    return x_new\n\n# Example: 2D fraud features\nx_fraud = np.array([120.0, 3.5])    # amount, hour\nneighbors = np.array([\n    [135.0, 2.8],\n    [110.0, 4.1],\n    [128.0, 3.0],\n    [115.0, 3.9],\n    [140.0, 2.5],\n])\nprint(smote_one(x_fraud, neighbors))\n# e.g. [126.3, 3.14] -- a plausible new fraud point',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Threshold movement works because the model already learned a ranking. If missing a positive costs 99x more than a false alarm, the rational threshold is t* = c_FP / (c_FP + c_FN) = 1/100 = 0.01, not 0.5. Moving the threshold exploits the signal the model already has without retraining. This is often the single cheapest improvement.',
        'Class weighting works by changing the gradient. In standard cross-entropy, each example contributes equally to the loss. With a weight of 99 on the minority class, one missed fraud produces a gradient as large as 99 misclassified legits. The optimizer now has to contort the decision boundary to reduce minority-class error because the cost of ignoring it is no longer negligible.',
        'SMOTE works because it populates the minority-class region of feature space with plausible examples instead of exact duplicates. Random oversampling gives the model more chances to see the same points; SMOTE gives it new points that fill the gaps between known positives. This encourages the learner to generalize across the minority region rather than memorize specific cases. The decision boundary shifts toward the majority class because the minority region is now denser and the learner must account for it.',
        'All four fixes converge on the same principle: re-pricing minority-class mistakes so the optimizer, the evaluator, or the decision-maker treats rare events as important rather than ignorable. They differ in where the re-pricing happens (loss, data, threshold) and what side effects they create.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Method', 'Training cost', 'Main side effect', 'Best for'],
          rows: [
            ['SMOTE', 'O(m * k * d) for m minority, k neighbors, d features; plus k-NN index build', 'Can create unrealistic points near class boundaries; leaks if applied before train/test split', 'Small-to-medium tabular datasets with enough minority examples for meaningful neighborhoods'],
            ['Random oversampling', 'Negligible (just duplicate rows)', 'Memorization of repeated examples; no new information created', 'Quick baseline; useful before trying SMOTE to measure the gap'],
            ['Random undersampling', 'Negative (fewer rows = faster training)', 'Discards majority-class data; may remove rare negative patterns', 'Large datasets where majority class has redundant examples'],
            ['Cost-sensitive learning', 'Same model, one line change (class_weight="balanced")', 'Distorts predicted probabilities; requires post-hoc calibration', 'Any model with a loss function; try first alongside threshold tuning'],
          ],
        },
        'Threshold movement has zero training cost and is fully reversible. It is the only intervention that does not change the model or the data. For deployment, the cost is one floating-point comparison per prediction.',
        'SMOTE adds O(m * k * d) work per epoch to generate synthetic examples, where m is the number of minority samples, k is the neighbor count, and d is feature dimensionality. The k-NN index is the bottleneck; for high-dimensional or very large datasets, approximate nearest neighbors can help. In practice, SMOTE is fast on tabular data (seconds to minutes) and becomes impractical only when the feature space is extremely high-dimensional or the minority class has fewer than k examples.',
        'The hidden cost across all resampling methods is evaluation contamination. If synthetic or duplicated examples leak into the validation set, measured performance is meaningless. The rule is absolute: split first, resample the training fold only.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Fraud detection: 0.1% positive rate, high cost per miss, limited analyst capacity. The model must rank rare frauds above a sea of legitimate transactions, and the alert queue must fit operational capacity. SMOTE and cost-sensitive learning both help the learner notice minority signal; threshold tuning controls alert volume.',
        'Medical screening: disease prevalence may be 1-5%, but a missed cancer is catastrophic. High recall is mandatory; precision determines how many unnecessary biopsies result. The precision-recall tradeoff is explicit and governed by clinical policy, not a default threshold.',
        'Cybersecurity and intrusion detection: attack traffic is rare, normal traffic is overwhelming. Models must detect novel attack patterns without drowning analysts in false alarms. Undersampling the normal class is common because normal traffic is highly redundant.',
        'Manufacturing defect detection: one defective part per thousand. The cost of a missed defect (recall failure) may be a product recall; the cost of a false alarm (precision failure) is pulling one good part for inspection. The asymmetry directly maps to class weights or threshold placement.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'SMOTE fails in high-dimensional sparse spaces. When features are mostly zeros (text bag-of-words, one-hot encoded categoricals), interpolating between two sparse vectors creates a dense synthetic point that exists nowhere in the real distribution. The synthetic examples are geometrically plausible but semantically absurd.',
        'SMOTE fails near class boundaries. If minority and majority examples overlap in feature space, SMOTE generates synthetic positives inside the majority region. The classifier learns to call majority-class territory positive, increasing false positives without improving true recall. Borderline-SMOTE and ADASYN attempt to address this, but they add complexity and their own failure modes.',
        'All resampling methods fail when applied before the train/test split. Synthetic neighbors of training examples leak into the validation set, producing optimistic recall estimates that vanish on genuinely held-out data. This is the most common and most damaging mistake in imbalanced-classification pipelines.',
        'Cost-sensitive learning fails silently when downstream systems consume probabilities. A model trained with 99x class weight outputs scores that no longer match real-world prevalence. A score of 0.5 from a weighted model does not mean 50% fraud probability. If the score feeds a risk API, a pricing engine, or a calibrated dashboard, the distortion propagates invisibly. Recalibration on untouched data is mandatory after any re-weighting.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Chawla, N. V., Bowyer, K. W., Hall, L. O., & Kegelmeyer, W. P. (2002). "SMOTE: Synthetic Minority Over-sampling Technique." Journal of Artificial Intelligence Research, 16, 321-357. The original SMOTE paper; introduces synthetic interpolation and compares it to random oversampling on multiple datasets.',
            'He, H. & Garcia, E. A. (2009). "Learning from Imbalanced Data." IEEE Transactions on Knowledge and Data Engineering, 21(9), 1263-1284. Comprehensive survey of cost-sensitive learning, sampling methods, and ensemble approaches for imbalanced classification.',
            'Davis, J. & Goadrich, M. (2006). "The Relationship Between Precision-Recall and ROC Curves." Proceedings of ICML. Proves that a curve dominates in ROC space if and only if it dominates in PR space; establishes when AUPRC is more informative than AUROC.',
            'Elkan, C. (2001). "The Foundations of Cost-Sensitive Learning." Proceedings of IJCAI. Derives the optimal threshold from misclassification costs and shows cost-sensitive learning is equivalent to resampling under certain conditions.',
          ],
        },
        'Prerequisite: study precision, recall, and the confusion matrix, because every imbalance method depends on those counts and their denominators. Study ROC curves to understand ranking quality, then precision-recall curves to see why AUROC flatters rare-positive models.',
        'Extensions: study Borderline-SMOTE and ADASYN for adaptive synthetic sampling near decision boundaries. Study focal loss (Lin et al., 2017) for the deep-learning approach to hard-example mining. Study calibration and reliability diagrams to fix the probability distortion that class weighting creates.',
        'Production depth: study threshold selection with real costs, alert-budget evaluation, stratified cross-validation with grouped splits, and drift monitoring for imbalanced streams where the minority distribution shifts over time.',
      ],
    },
  ],
};
