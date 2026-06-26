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
        'The animation builds a gradient-boosted model one tree at a time. The first frame shows the baseline prediction: the mean of all target values, drawn as a flat line. Every subsequent frame fits a new decision stump to the residuals (the gaps between the current prediction and the true values), then adds that stump\'s output to the running prediction. Watch the prediction curve bend closer to the data points with each round.',
        {type: "callout", text: "Gradient boosting turns residuals into the next training set, so every weak learner has one repair job."},
        'Active markers highlight the data points or model curve being updated in the current round. Visited markers show corrections from previous rounds that are already baked into the ensemble. Found markers indicate the final converged prediction after all rounds complete. The residual plot, when it appears, shows the same data reframed as errors: those errors become the literal training targets for the next stump.',
        'The second view compares learning rates. Two MSE curves descend at different speeds because one ensemble takes full-sized steps (eta = 1.0) and the other takes shrunk steps (eta = 0.3). The comparison makes visible why smaller steps need more rounds but resist overfitting on noisy data. A third frame contrasts bagging and boosting side by side so you can see the structural difference: parallel independence versus sequential repair.',
        {type: 'image', src: './assets/gifs/gradient-boosting.gif', alt: 'Animated walkthrough of the gradient boosting visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Prediction problems on structured, tabular data (rows of features with a numeric or categorical target) are everywhere: pricing, fraud scoring, medical risk, demand forecasting, ad ranking. The data contains thresholds, interactions, missing values, and nonlinear effects that shift across feature ranges. A linear model misses those shapes. A single decision tree can capture them, but it tends to memorize noise unless you prune it heavily, at which point it may be too weak to capture the real structure.',
        'The goal is a model that can learn complex nonlinear patterns without memorizing accidents in the training set. One approach is to combine many models. Random forests do this by averaging independent trees, which reduces variance (the tendency to overfit). But averaging independent models does not systematically fix bias (the tendency to underfit). If every tree in the forest makes the same systematic error, averaging a thousand of them still makes that error.',
        'Gradient boosting solves a different equation. Instead of training many models on the same problem and averaging, it trains models in sequence, and each new model is trained on the mistakes of the current ensemble. The result is an additive function: a base prediction plus a series of learned corrections, each one targeted at what the ensemble still gets wrong.',
        {type: `image`, src: `https://scikit-learn.org/stable/_images/sphx_glr_plot_adaboost_regression_001.png`, alt: `AdaBoost regression example with weak learners correcting prior errors`, caption: `The staged-regression picture shows the same ensemble repair idea: later weak learners focus on what the current predictor still misses. Source: scikit-learn examples, https://scikit-learn.org/stable/auto_examples/ensemble/plot_adaboost_regression.html`},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is a single decision tree. Trees handle mixed feature types naturally, require no feature scaling, and produce interpretable splits. A depth-10 tree on 10,000 training rows can fit complex boundaries and interactions. Teams reach for trees because they work out of the box on messy tabular data with missing values and categorical columns.',
        'The second reasonable attempt is a random forest: grow many deep trees on bootstrap samples of the data, randomize the feature subset at each split, and average the predictions. This works well because averaging independent high-variance estimators reduces variance without increasing bias. Random forests are hard to overfit in practice, require minimal tuning, and parallelize trivially because every tree is independent.',
        'Both approaches are strong baselines. A single tree is interpretable but fragile. A random forest is stable but limited: because every tree independently attacks the full problem from scratch, the average inherits whatever systematic bias each tree shares. If all trees consistently underpredict houses in a certain price range, the average still underpredicts there. The forest reduces noise but does not steer toward the remaining error.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is bias that averaging cannot remove. Consider a dataset with three price plateaus: small houses around $30k, mid-size houses around $80k, and large houses around $120k. A shallow tree (say, one split) can separate two groups but not three. Average a thousand one-split trees trained on bootstrap samples: each tree draws a line between two groups, and the average still approximates two groups, not three. More trees do not fix this because the stumps lack the capacity to represent three plateaus, and averaging does not add capacity.',
        'Making the trees deeper helps a random forest capture the third plateau, but then each tree memorizes finer noise in the training set. The forest trades bias for variance. The fundamental issue is that independent averaging can only reduce variance; it cannot systematically reduce bias without changing the capacity of the individual learners. A forest of stumps has low variance but high bias. A forest of deep trees has low bias but higher variance. There is no independent-averaging trick that gets both.',
        'Gradient boosting breaks through the wall by making the trees sequential and giving each one a different problem. The first stump separates two groups. The second stump is not asked to solve the original problem; it is asked to fit the errors left after the first stump. Those errors reveal the third plateau that the first stump missed. By chaining weak learners, each one focused on the residual error, boosting builds capacity additively without making any individual learner deep enough to memorize noise.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that fitting residuals is gradient descent in function space. Start with a constant prediction F0 (the mean of the targets). Compute the residual for each training example: r_i = y_i - F0(x_i). That residual is the direction in which the prediction needs to move for that example. Fit a weak learner (a shallow tree) to those residuals. The tree\'s output is an approximation of the optimal correction. Add a scaled version of that correction to the current model: F1(x) = F0(x) + eta * tree1(x), where eta (the learning rate) controls step size. Recompute residuals against F1 and repeat.',
        'For squared-error loss L = (1/2)(y - F(x))^2, the negative gradient of the loss with respect to the prediction F(x) is exactly the residual: -dL/dF = y - F(x). So when you fit a tree to residuals, you are fitting a tree to the negative gradient of the loss. Adding that tree to the model is a gradient-descent step, except instead of updating a vector of weights in parameter space, you are updating a function. The tree is the step direction. The learning rate is the step size. The loss decreases because you moved the function in the direction of steepest descent.',
        'This insight generalizes beyond squared error. For logistic loss (classification), the negative gradient is y - sigmoid(F(x)), which is no longer a simple residual but still a direction of improvement. For ranking losses, quantile losses, or Huber loss, the gradient takes a different form. In every case, gradient boosting fits a tree to the negative gradient of the chosen loss function and adds it to the ensemble. The residual-fitting picture for squared error is the special case where the gradient happens to equal the residual.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The animation uses 10 house sizes (1 through 10, in hundreds of square feet) and 10 prices that form three plateaus: around $30k for small houses, $80k for mid-size, and $120k for large. The initial model F0 predicts the mean price (~$7.83 in the scaled units) for every house. MSE starts high because a flat line ignores all structure in the data.',
        'Round 1: compute residuals r_i = y_i - F0(x_i). Small houses have negative residuals (the mean overpredicts them), large houses have positive residuals (the mean underpredicts them). A decision stump searches all possible split points and finds the one that minimizes squared error on the residuals. It splits the data into two groups, predicts the mean residual on each side, and the ensemble becomes F1(x) = F0(x) + eta * stump1(x). With eta = 1, the stump\'s full correction is added.',
        'Round 2: residuals are recomputed against F1. The first stump fixed the coarsest error, so the remaining residuals reveal finer structure. The second stump finds a different split point because the error landscape has changed. This is the mechanism: each round changes the target by subtracting what has already been learned, so the next stump always works on a different problem than the last one.',
        {type: `image`, src: `https://scikit-learn.org/stable/_images/sphx_glr_plot_gradient_boosting_regression_001.png`, alt: `Gradient boosting regression example with prediction curves over training iterations`, caption: `scikit-learn shows gradient boosting as staged function improvement: each round moves the predictor toward the target surface. Source: https://scikit-learn.org/stable/auto_examples/ensemble/plot_gradient_boosting_regression.html`},
        'After four rounds of stumps, the additive model has recovered all three plateaus. No individual stump can represent three plateaus (a stump has only one split and two output values). But the sum of four stumps can, because each stump was placed where the previous sum still had error. The ensemble\'s capacity grows with the number of rounds, not with the depth of any single tree.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness follows from the gradient-descent analogy. At each round, the tree approximates the negative gradient of the loss function evaluated at the current predictions. Adding a scaled version of that tree to the model moves predictions in the direction of steepest loss decrease. As long as the step size (learning rate) is small enough and the tree captures some useful gradient signal, the training loss decreases monotonically. This is the same convergence guarantee that makes gradient descent work on smooth functions, extended to function space.',
        'The weak-learner requirement is central. Each tree does not need to solve the full problem. It only needs to correlate with the gradient better than random chance. A single decision stump that correctly separates high-residual examples from low-residual examples provides a useful descent direction even if its fit is crude. Over many rounds, the sum of many crude corrections converges to a precise function. This is the boosting guarantee: combining weak learners into a strong learner through sequential, targeted fitting.',
        'Regularization prevents the descent from chasing noise. The learning rate shrinks each tree\'s contribution, so the model moves slowly and many rounds are needed. Early stopping halts training when validation error stops improving, even if training error could still decrease. Subsampling rows or columns at each round adds stochasticity that smooths the gradient estimate. Leaf-weight regularization (L2 penalties on leaf values, as in XGBoost) prevents any single leaf from making an extreme correction. Together, these controls keep the additive repair from becoming memorization.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Training cost is O(T * n * d) in the naive case, where T is the number of boosting rounds, n is the number of training examples, and d is the number of features. Each round fits one tree, and fitting a tree requires scanning features to find the best split at each node. For a tree of depth D, each round has up to 2^D leaf nodes, and each split candidate requires examining n examples across d features.',
        'Production libraries cut this cost. XGBoost pre-sorts features and uses a column-block structure. LightGBM bins continuous features into 256 histogram buckets and finds splits in O(bins) instead of O(n), reducing per-round cost from O(n * d) to O(bins * d). Both libraries support row and column subsampling, which reduces the data scanned per round and adds regularizing noise. Distributed training splits the data across machines and merges histogram counts.',
        'Prediction cost is O(T * D) per example: walk each of T trees from root to leaf (D comparisons per tree), sum the leaf values. A model with 500 trees of depth 6 requires about 3,000 comparisons per prediction. This is fast on CPUs but slower than a single neural-network forward pass on a GPU when batched. For latency-sensitive serving, tree count and depth are the knobs that trade accuracy for speed.',
        'Memory cost is proportional to the total number of nodes across all trees. Each node stores a feature index, a threshold, and child pointers; each leaf stores a value. A model with 500 trees of depth 6 has at most 500 * (2^7 - 1) = 63,500 nodes. At 32 bytes per node, that is about 2 MB. Training memory is dominated by the feature matrix and histogram buffers, not the model itself.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Fraud detection systems score each transaction with a boosted model because the workload is tabular (transaction amount, merchant category, time since last purchase, device fingerprint), has nonlinear thresholds (a $5,000 charge is suspicious for one user but normal for another), and needs sub-millisecond prediction latency. Tree ensembles handle mixed types, missing features, and categorical encodings natively, and prediction is a sequence of comparisons that fits in CPU cache.',
        'Ad click-through-rate (CTR) prediction uses gradient boosting or its descendants at scale. The features are a mix of dense numerics (bid amount, historical CTR) and sparse categoricals (ad ID, publisher, user segment). LightGBM and CatBoost handle this mixture directly. The model must retrain frequently (daily or hourly) as user behavior shifts, and boosted trees retrain faster than deep networks on tabular features of this shape.',
        'Medical risk scoring (readmission prediction, mortality risk, disease progression) uses boosted trees because the feature set is tabular (lab values, vital signs, demographics, diagnosis codes), the dataset is mid-sized (thousands to low millions of patients), and interpretability matters. Tree-based feature importance and SHAP values give clinicians a ranked list of contributing factors for each prediction, which regulatory and clinical review processes require.',
        'Kaggle competitions on tabular data have been dominated by XGBoost, LightGBM, and CatBoost for over a decade. The pattern holds for structured data with under ~100 features and under ~10 million rows. Beyond that scale, or when the data is images, audio, or long text, neural networks take over because they learn representations from raw inputs rather than requiring hand-engineered features.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Overfitting through label noise is the primary failure mode. Because each round explicitly attacks the remaining error, noisy labels get chased: a mislabeled example creates a residual that grows across rounds until some tree memorizes it. Without early stopping on a held-out validation set, training error drops to near zero while test error rises. The fix is honest validation: hold out data that the boosting procedure never sees during training, monitor validation loss, and stop when it plateaus.',
        'Data leakage is amplified by boosting. A feature that accidentally encodes the target (a future value leaking into a historical row, or a target-encoded categorical computed on the full dataset) provides a near-perfect correction in the first round. The model locks onto it, scores look excellent in cross-validation if the leak contaminates folds, and the model fails on genuinely unseen data. Time-series problems are especially vulnerable: random train/test splits let future information leak into training rows.',
        {type: `image`, src: `https://scikit-learn.org/stable/_images/sphx_glr_plot_forest_importances_001.png`, alt: `Feature importance chart from a tree ensemble`, caption: `Feature-importance bars are useful diagnostics, but correlated features and leakage can make them overconfident. Source: scikit-learn examples, https://scikit-learn.org/stable/auto_examples/ensemble/plot_forest_importances.html`},
        'Gradient boosting struggles with data types that need learned representations. Images, audio waveforms, long text sequences, and graph structures require the model to discover useful features from raw inputs. Trees split on individual feature values; they cannot learn convolutions, attention patterns, or embeddings. On unstructured data, neural networks dominate because the architecture itself learns the feature extraction. Boosted trees remain strong only when the features are already engineered or naturally tabular.',
        'Calibration is a hidden failure. A boosted classifier may rank examples well (high AUC) while producing poorly calibrated probabilities. The raw output is a sum of tree leaf values, not a probability. Applying a sigmoid gives a number between 0 and 1, but that number may not match the true event frequency. Medical, lending, and insurance applications need calibrated probabilities, so post-hoc calibration (Platt scaling or isotonic regression on a held-out set) is often necessary after training.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Data: 4 houses with sizes [2, 4, 7, 9] and prices [30, 80, 80, 120] (in $k). Step 0: F0 predicts the mean for all houses: (30 + 80 + 80 + 120) / 4 = 77.5. Residuals: [30 - 77.5, 80 - 77.5, 80 - 77.5, 120 - 77.5] = [-47.5, 2.5, 2.5, 42.5]. MSE = (47.5^2 + 2.5^2 + 2.5^2 + 42.5^2) / 4 = (2256.25 + 6.25 + 6.25 + 1806.25) / 4 = 1018.75.',
        'Step 1: fit a stump to the residuals. Try splitting at x = 3: left group {x=2} has mean residual -47.5, right group {x=4, 7, 9} has mean residual (2.5 + 2.5 + 42.5)/3 = 15.83. SSE = (0)^2 + (2.5 - 15.83)^2 + (2.5 - 15.83)^2 + (42.5 - 15.83)^2 = 0 + 177.89 + 177.89 + 711.11 = 1066.89. Try splitting at x = 5.5: left {2, 4} mean = (-47.5 + 2.5)/2 = -22.5, right {7, 9} mean = (2.5 + 42.5)/2 = 22.5. SSE = (-47.5 + 22.5)^2 + (2.5 + 22.5)^2 + (2.5 - 22.5)^2 + (42.5 - 22.5)^2 = 625 + 625 + 400 + 400 = 2050. The split at x = 3 gives lower SSE, so the stump picks it.',
        'With eta = 1, update: F1(2) = 77.5 + (-47.5) = 30, F1(4) = 77.5 + 15.83 = 93.33, F1(7) = 77.5 + 15.83 = 93.33, F1(9) = 77.5 + 15.83 = 93.33. New residuals: [0, -13.33, -13.33, 26.67]. The first stump perfectly corrected the small-house error and partially corrected the large-house error. MSE dropped from 1018.75 to (0 + 177.69 + 177.69 + 711.29)/4 = 266.67.',
        'Step 2: fit a stump to residuals [0, -13.33, -13.33, 26.67]. The best split is now at x = 8 (or similar), separating the large house from the rest. Left mean = (0 - 13.33 - 13.33)/3 = -8.89, right mean = 26.67. After adding this correction: F2(9) = 93.33 + 26.67 = 120, and the mid-size houses get pulled closer to 80. Each round fixes a different part of the error because the target changes after every correction.',
        'With eta = 0.3 instead, step 1 adds only 30% of the stump: F1(2) = 77.5 + 0.3*(-47.5) = 63.25. The correction is smaller, so more rounds are needed. But on noisy data, those smaller steps prevent any single tree from over-correcting a mislabeled point. This is the learning-rate tradeoff: smaller eta needs more trees (higher compute) but generalizes better because each correction is tentative.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The original formulation is Jerome Friedman\'s "Greedy Function Approximation: A Gradient Boosting Machine" (Annals of Statistics, 2001). This paper defines the gradient-descent-in-function-space framework, derives the algorithm for arbitrary differentiable loss functions, and introduces shrinkage (the learning rate). It is the primary source for understanding why fitting residuals is gradient descent.',
        'XGBoost (Tianqi Chen and Carlos Guestrin, KDD 2016, "XGBoost: A Scalable Tree Boosting System") adds second-order gradient information (Newton boosting), L1/L2 regularization on leaf weights, column subsampling, and a systems-level design with cache-aware block structure. LightGBM (Ke et al., NeurIPS 2017) introduces histogram-based splits and leaf-wise tree growth for faster training. CatBoost (Prokhorenkova et al., NeurIPS 2018) adds ordered target statistics for categorical features.',
        'Study decision trees first: every boosted model is a sum of trees, so understanding splits, leaves, and overfitting in a single tree is prerequisite. Then study random forests to understand the contrast between parallel averaging (variance reduction) and sequential correction (bias reduction). Study gradient descent to make the function-space analogy precise. Study cross-validation and early stopping before trusting any boosted model\'s reported accuracy. Finally, study SHAP values for model interpretation: they provide theoretically grounded feature attributions for tree ensembles, replacing the simpler but less reliable feature-importance bars.',
      ],
    },
  ],
};

