// Gradient boosting: don't average the trees — CHAIN them. Each new tree
// fits what the ensemble still gets wrong, and the whole thing is gradient
// descent wearing a forest costume. Computed live in this file.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'gradient-boosting',
  title: 'Gradient Boosting',
  category: 'AI & ML',
  summary: 'Each tree fits the previous ensemble\'s mistakes: gradient descent in function space for strong tabular models.',
  controls: [
    { id: 'view', label: 'Watch', type: 'select', options: ['boosting fit, residual by residual', 'the knobs, and bagging vs boosting'], defaultValue: 'boosting fit, residual by residual' },
  ],
  run,
};

// House sizes (100s of sq ft) vs price (10k$): three honest plateaus.
const X = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const Y = [3.2, 3.0, 3.5, 7.8, 8.2, 8.0, 8.4, 12.1, 11.8, 12.3];
const MEAN = Y.reduce((a, b) => a + b, 0) / Y.length;

// A decision stump: the weakest learner with a pulse — one split, two means.
function fitStump(residuals) {
  let best = null;
  for (let s = 1.5; s < 10; s++) {
    const left = [];
    const right = [];
    X.forEach((x, i) => (x < s ? left : right).push(residuals[i]));
    if (!left.length || !right.length) continue;
    const ml = left.reduce((a, b) => a + b, 0) / left.length;
    const mr = right.reduce((a, b) => a + b, 0) / right.length;
    const sse = X.reduce((a, x, i) => a + (residuals[i] - (x < s ? ml : mr)) ** 2, 0);
    if (!best || sse < best.sse) best = { s, ml, mr, sse };
  }
  return best;
}
const mseOf = (F) => Y.reduce((a, y, i) => a + (y - F[i]) ** 2, 0) / Y.length;

function boost(eta, rounds) {
  let F = X.map(() => MEAN);
  const history = [{ F: [...F], mse: mseOf(F), stump: null }];
  for (let r = 0; r < rounds; r++) {
    const residuals = Y.map((y, i) => y - F[i]);
    const stump = fitStump(residuals);
    F = F.map((f, i) => f + eta * (X[i] < stump.s ? stump.ml : stump.mr));
    history.push({ F: [...F], mse: mseOf(F), stump });
  }
  return history;
}

const dataMarkers = () => Y.map((y, i) => ({ id: `p${i}`, x: X[i], y }));
const fnSeries = (id, label, F) => ({ id, label, points: X.map((x, i) => ({ x, y: F[i] })) });

function* residualByResidual() {
  const hist = boost(1, 4);
  yield {
    state: plotState({
      axes: { x: { label: 'house size (100s sq ft)' }, y: { label: 'price ($10k)' } },
      series: [fnSeries('f0', 'Fâ‚€ = the mean', hist[0].F)],
      markers: dataMarkers(),
    }),
    highlight: { active: ['f0'] },
    explanation: `The first model predicts the same value for every house: the mean, about $${(MEAN * 10).toFixed(0)}k, with MSE ${hist[0].mse.toFixed(1)}. Boosting starts from this weak baseline, then asks what the current function still misses. Those residuals become the next learner's targets.`,
  };

  yield {
    state: plotState({
      axes: { x: { label: 'house size (100s sq ft)' }, y: { label: 'residual: what Fâ‚€ missed' } },
      series: [{ id: 'zero', label: '', points: [{ x: 1, y: 0 }, { x: 10, y: 0 }] }],
      markers: Y.map((y, i) => ({ id: `r${i}`, x: X[i], y: y - MEAN, label: i === 0 || i === 9 ? (y - MEAN).toFixed(1) : '' })),
    }),
    highlight: { compare: ['r0', 'r1', 'r2'], active: ['r7', 'r8', 'r9'] },
    explanation: `The residual plot is the error as a new dataset. Small houses sit below the mean and large houses sit above it, so a one-split stump can learn a useful correction: x < ${hist[1].stump.s}, with ${hist[1].stump.ml.toFixed(1)} on the left and +${hist[1].stump.mr.toFixed(1)} on the right.`,
    invariant: 'Each round trains on residuals: the targets are the current ensemble\'s mistakes, not the original labels.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'house size (100s sq ft)' }, y: { label: 'price ($10k)' } },
      series: [
        fnSeries('f1', 'Fâ‚', hist[1].F),
        fnSeries('f2', 'Fâ‚‚ = Fâ‚ + stumpâ‚‚', hist[2].F),
      ],
      markers: dataMarkers(),
    }),
    highlight: { visited: ['f1'], active: ['f2'] },
    explanation: `Round 2 recomputes residuals against F1, so the target has changed. The new stump picks x < ${hist[2].stump.s} because the first correction moved the largest remaining error. MSE falls from ${hist[0].mse.toFixed(1)} to ${hist[1].mse.toFixed(2)} to ${hist[2].mse.toFixed(2)}.`,
  };

  yield {
    state: plotState({
      axes: { x: { label: 'house size (100s sq ft)' }, y: { label: 'price ($10k)' } },
      series: [fnSeries('f4', 'Fâ‚„: four stumps deep', hist[4].F)],
      markers: dataMarkers(),
    }),
    highlight: { found: ['f4'] },
    explanation: `After four one-split stumps, the additive model has found the three plateaus. MSE drops from ${hist[0].mse.toFixed(1)} to ${hist[4].mse.toFixed(2)} because each weak learner patches a different part of the remaining error.`,
  };

  yield {
    state: matrixState({
      title: 'Why "GRADIENT" boosting: the residual IS the gradient',
      rows: [{ id: 'gd', label: 'gradient descent' }, { id: 'gb', label: 'gradient boosting' }],
      columns: [{ id: 'what', label: 'updates' }, { id: 'step', label: 'each step' }],
      values: [[1, 2], [3, 4]],
      format: (v) => ['', 'numbers (weights)', 'w â† w âˆ’ ηÂ·âˆ‡loss', 'a FUNCTION F(x)', 'F â† F + ηÂ·(tree fit to âˆ’âˆ‡loss)'][v],
    }),
    highlight: { compare: ['gd:step', 'gb:step'] },
    explanation: 'For squared loss, the negative gradient with respect to each prediction is the residual y - F(x). Fitting a tree to residuals is therefore a gradient-descent step in function space: the tree is the step direction, and adding it updates the current function.',
    invariant: 'For squared loss, residual = âˆ’âˆ‚loss/âˆ‚prediction: each tree is a gradient step in function space.',
  };
}

function* knobs() {
  const fast = boost(1, 8);
  const slow = boost(0.3, 8);
  yield {
    state: plotState({
      axes: { x: { label: 'boosting round' }, y: { label: 'training MSE' } },
      series: [
        { id: 'fast', label: 'η = 1.0', points: fast.map((h, r) => ({ x: r, y: h.mse })) },
        { id: 'slow', label: 'η = 0.3', points: slow.map((h, r) => ({ x: r, y: h.mse })) },
      ],
    }),
    highlight: { compare: ['fast', 'slow'] },
    explanation: 'The learning rate multiplies each tree before it joins the ensemble. eta = 1.0 fits this clean training set quickly; eta = 0.3 needs more rounds but makes smaller corrections. On noisy data, small steps plus early stopping usually generalize better than a few large greedy fixes.',
    invariant: 'η trades trees for generalization: smaller steps, more of them, less noise memorized.',
  };

  yield {
    state: matrixState({
      title: 'Bagging (Random Forest) vs Boosting — opposite medicines',
      rows: [
        { id: 'build', label: 'trees are built' },
        { id: 'job', label: 'each tree\'s job' },
        { id: 'cuts', label: 'mainly reduces' },
        { id: 'depth', label: 'typical tree' },
        { id: 'risk', label: 'failure mode' },
      ],
      columns: [{ id: 'bag', label: 'bagging' }, { id: 'boost', label: 'boosting' }],
      values: [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10]],
      format: (v) => ['', 'in parallel, independent', 'in sequence, each needs the last', 'same problem, different sample', 'the previous ensemble\'s errors', 'VARIANCE (averaging)', 'BIAS (additive correction)', 'deep, low-bias', 'shallow stumps, weak on purpose', 'hard to overfit, plateaus', 'will overfit — needs η + early stop'][v],
    }),
    highlight: { compare: ['cuts:bag', 'cuts:boost'] },
    explanation: 'Bagging and boosting solve different errors. Random forests average deep, high-variance trees built independently. Boosting adds weak learners sequentially to reduce bias. The cost is that boosting can keep chasing noise after validation error stops improving.',
  };

  yield {
    state: matrixState({
      title: 'Why XGBoost/LightGBM rule tabular data',
      rows: [
        { id: 'reg', label: 'regularized objective' },
        { id: 'hist', label: 'histogram splits' },
        { id: 'missing', label: 'native missing values' },
        { id: 'record', label: 'the track record' },
      ],
      columns: [{ id: 'what', label: '' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', 'λ on leaf weights + tree size in the loss itself', 'bin features â†’ find splits in O(bins) not O(n)', 'each split learns a default direction for NaN', 'most-winning model class on tabular Kaggle, ~decade'][v],
    }),
    highlight: { active: ['record:what'] },
    explanation: 'XGBoost and LightGBM are production versions of the same idea. They add regularized leaf weights, second-order gradients, histogram split search, missing-value handling, and fast tree growth, which is why boosted trees remain strong on medium-sized tabular data.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'boosting fit, residual by residual') yield* residualByResidual();
  else if (view === 'the knobs, and bagging vs boosting') yield* knobs();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for Gradient Boosting. Each tree fits the previous ensemble's mistakes — gradient descent in function space, and the king of tabular data..",
        {type: "callout", text: "Gradient boosting turns residuals into the next training set, so every weak learner has one repair job."},
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      
        {type: 'image', src: './assets/gifs/gradient-boosting.gif', alt: 'Animated walkthrough of the gradient boosting visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: `Why gradient boosting exists`,
      paragraphs: [
        `Gradient boosting exists because many real prediction problems are too irregular for one simple model but too structured to ignore. Tabular data often contains thresholds, interactions, missing values, and feature effects that change across ranges. A linear model may miss those shapes. A single decision tree can find them, but it tends to overfit unless it is heavily constrained. The goal is to build a strong predictor from many small, controlled corrections rather than trust one large tree to discover everything at once.`,
        `The central move is sequence. Random forests train many trees independently and average them. Gradient boosting trains trees in order. Each new tree studies what the current ensemble still gets wrong. If the current model underprices large houses, the next tree is asked to correct that error. If the next round exposes a smaller pattern among mid-size houses, another tree corrects that. The final model is an additive function: a base prediction plus many learned corrections.`,
        {type: `image`, src: `https://scikit-learn.org/stable/_images/sphx_glr_plot_adaboost_regression_001.png`, alt: `AdaBoost regression example with weak learners correcting prior errors`, caption: `The staged-regression picture shows the same ensemble repair idea: later weak learners focus on what the current predictor still misses. Source: scikit-learn examples, https://scikit-learn.org/stable/auto_examples/ensemble/plot_adaboost_regression.html`},
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `The first naive alternative is to fit one deep tree. That can drive training error down, but it often memorizes accidents in the sample: rare categories, outliers, leakage, or noise in the labels. The tree becomes a list of brittle exceptions. It may look excellent on the training set and disappoint on new rows. Pruning helps, but then the tree may be too weak to capture the real nonlinear structure.`,
        `The second naive alternative is to average many independent trees, as a random forest does. That is often strong, and it reduces variance, but averaging does not create a sequence of targeted repairs. If every tree is trying to solve the whole problem from scratch, the ensemble may still keep the same bias. Boosting attacks bias directly. It asks, after each round, "what part of the target remains unexplained?" That question is the reason boosted trees can be very strong with shallow learners.`,
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `The core insight is that a model can improve by fitting its own errors. Start with a crude function F0, such as the mean label. For each training example, compute the residual y - F0(x). That residual is a new target: positive if the model predicted too low, negative if it predicted too high. Fit a weak tree to those residuals, scale the tree by a learning rate, and add it to the model. Then recompute residuals and repeat.`,
        `For squared error, this is not just a metaphor. The residual is the negative gradient of the loss with respect to the current prediction. Ordinary gradient descent updates a vector of weights. Gradient boosting updates a function. The tree is the step direction in function space, and the learning rate controls how far the function moves in that direction. For logistic loss, ranking losses, and other objectives, modern boosting libraries fit trees to the appropriate gradients and often use second-order curvature information to choose better leaf values.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `Gradient boosting works because each stage optimizes the current loss surface instead of restarting the same problem. For squared error, the residual is the negative gradient, so a tree fitted to residuals is a function-shaped descent step. The model improves when that step points toward lower error on the training examples and is small enough not to chase every accident in the data.`,
        `The correctness intuition is additive repair under control. A weak learner does not need to solve the whole task. It only needs to capture one useful pattern in the remaining error. Shrinkage, shallow trees, validation, early stopping, and regularized leaf values keep those repairs from becoming brittle memorization. The ensemble succeeds when many small corrections reduce bias while the control system keeps variance from taking over.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The demo uses ten house sizes and prices. The initial model predicts the same price for every house: the mean. That model is intentionally dull, so the residuals show clear structure. Small houses sit below the mean, large houses sit above it, and a one-split stump can learn a useful correction. The stump searches possible split points, sends rows left or right, and predicts the average residual on each side.`,
        `After the first stump is added, the target changes. The second stump is not trying to fit original house prices. It is trying to fit the remaining errors after the first correction. That distinction matters. Boosting keeps changing the problem it gives to the next learner. In the plotted example, four one-split stumps recover the three price plateaus because each stump handles a different part of the remaining pattern. No individual stump is expressive enough to represent the full function. The sum is expressive because every stump is placed where the previous sum still fails.`,
      ],
    },
    {
      heading: `How it works (2)`,
      paragraphs: [
        `The first visual proves that boosting begins from an error, not from a finished idea of the target function. The mean line is bad in a useful way: the gaps between data points and the line are organized. The residual plot turns those gaps into a dataset. Once the errors are visible as targets, the purpose of the next tree becomes concrete. It is not another independent opinion. It is a correction with a job.`,
        {type: `image`, src: `https://scikit-learn.org/stable/_images/sphx_glr_plot_gradient_boosting_regression_001.png`, alt: `Gradient boosting regression example with prediction curves over training iterations`, caption: `scikit-learn shows gradient boosting as staged function improvement: each round moves the predictor toward the target surface. Source: https://scikit-learn.org/stable/auto_examples/ensemble/plot_gradient_boosting_regression.html`},
        `The learning-rate view proves the main regularization tradeoff. A full-size correction can reduce training error quickly on a clean toy problem. On noisy data, that same greed can memorize label noise. Shrinkage multiplies each tree by a value such as 0.1 or 0.03, forcing the ensemble to move in smaller steps. Smaller steps usually need more trees, but they give validation error more chances to reveal when the model has started chasing noise. Early stopping is therefore not an accessory. It is part of the algorithm's practical control system.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `Training cost is roughly the number of rounds times the cost of fitting one tree. Real libraries reduce that cost with histogram bins, sorted feature blocks, column sampling, row sampling, and parallel split search. Prediction is usually cheap: evaluate each tree, add its leaf value, and return the sum. The cost grows with tree count and tree depth, so a model with thousands of deep trees can become heavy for low-latency systems even if it trains well.`,
        `The tradeoffs are mostly about control. More trees reduce bias but can raise variance. Deeper trees capture interactions but can memorize small groups. A smaller learning rate is safer but requires more rounds. Subsampling adds noise that can improve generalization but also increases run-to-run variation. Regularization on leaf weights and tree structure keeps corrections from becoming too sharp. Compared with neural networks, boosted trees often need less feature scaling and less training infrastructure, but they are less natural for raw images, audio, long text, and representation learning.`,
        `There is also an operations tradeoff. A boosted tree model is easy to ship as a list of splits, but it is harder to update incrementally than a simple linear model. New data often means retraining the ensemble, rechecking calibration, and comparing feature distributions against the training window. Fast prediction does not remove the need for monitoring. A stale boosted model can keep making confident corrections for patterns that no longer exist.`,
      ],
    },
    {
      heading: `Where it fails (2)`,
      paragraphs: [
        `Gradient boosting is a default baseline for tabular machine learning. It is used in fraud detection, credit risk, churn prediction, pricing, demand forecasting, ad ranking, insurance, medical risk scoring, and many Kaggle-style competitions. It handles mixed numeric and categorical features after encoding, nonlinear thresholds, missing values, and feature interactions. XGBoost, LightGBM, and CatBoost are production forms of the same idea with careful engineering around split search, missing values, categorical handling, regularization, and distributed training.`,
        `The failure modes are direct consequences of the algorithm's strength. Because every round attacks the remaining error, leakage is rewarded aggressively. A feature that accidentally contains the answer will look like the perfect correction. Noisy labels can be chased round after round unless validation and early stopping are honest. Time-series problems fail if rows are randomly split and future information leaks into training. Categorical encodings can leak target statistics if they are computed outside the validation fold. Boosting also gives feature importance numbers that can be misleading when features are correlated or when leakage is present.`,
        {type: `image`, src: `https://scikit-learn.org/stable/_images/sphx_glr_plot_forest_importances_001.png`, alt: `Feature importance chart from a tree ensemble`, caption: `Feature-importance bars are useful diagnostics, but correlated features and leakage can make them overconfident. Source: scikit-learn examples, https://scikit-learn.org/stable/auto_examples/ensemble/plot_forest_importances.html`},
        `For classification, the raw score is not the final product. A fraud team, lender, or medical workflow usually needs a calibrated probability and a threshold chosen against real costs. Boosting can produce excellent rankings while still being miscalibrated. Calibration curves, threshold analysis, and post-deployment drift checks turn the model from a leaderboard score into a decision system.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study decision trees first, because every boosted tree is still made of splits and leaves. Then study random forests to understand the difference between averaging independent models and adding sequential corrections. Study gradient descent to make the function-space update precise. Study cross-validation, leakage, and early stopping before trusting a boosted model's score. Finally, study regularization and calibration. A boosted classifier gives scores, but a real system must decide thresholds, costs, monitoring, and retraining policy after the score is produced.`,
      ],
    },
      {
      heading: 'Why this exists',
      paragraphs: [
        "State the real constraint this topic fixes before introducing the mechanism.",
        "A good opening says what gets too slow, too fragile, or too hard to reason about under baseline behavior.",
        "Without that, every optimization appears decorative.",
      ],
    },

    {
      heading: 'The obvious approach',
      paragraphs: [
        "Name the reasonable first attempt and why teams reach for it.",
        "Then show the exact place that approach stops scaling or starts breaking.",
        "Treat this section as contrast, not a rejection.",
      ],
    },

    {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },

    {
      heading: 'Real-world uses',
      paragraphs: [
        "Show where this approach appears in products, libraries, or service designs.",
        "Tie each use case to a workload shape, not a brand name.",
        "The learner should know exactly when this pattern should be chosen next.",
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        "Trace one representative example end-to-end so readers can watch state evolve across every step.",
        "Keep the walkthrough concise and precise: at each step, write current state, action taken, and resulting output.",
        "The goal is prediction, not a one-off demonstration.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why Gradient Boosting moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};

