// Gradient boosting: don't average the trees — CHAIN them. Each new tree
// fits what the ensemble still gets wrong, and the whole thing is gradient
// descent wearing a forest costume. Computed live in this file.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'gradient-boosting',
  title: 'Gradient Boosting',
  category: 'AI & ML',
  summary: 'Each tree fits the previous ensemble\'s mistakes — gradient descent in function space, and the king of tabular data.',
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
      series: [fnSeries('f0', 'F₀ = the mean', hist[0].F)],
      markers: dataMarkers(),
    }),
    highlight: { active: ['f0'] },
    explanation: `Ten houses, three price plateaus, and the world's humblest first model: F₀ = the average, $${(MEAN * 10).toFixed(0)}k for everything — MSE ${hist[0].mse.toFixed(1)}. Random Forest's plan would be to train many full trees in parallel and average away their variance. Boosting takes the opposite road: start embarrassingly simple and improve SEQUENTIALLY — and the improvement rule is one question: "what does the current model still get WRONG?" Those mistakes — the residuals y − F₀ — become the training targets for the next learner.`,
  };

  yield {
    state: plotState({
      axes: { x: { label: 'house size (100s sq ft)' }, y: { label: 'residual: what F₀ missed' } },
      series: [{ id: 'zero', label: '', points: [{ x: 1, y: 0 }, { x: 10, y: 0 }] }],
      markers: Y.map((y, i) => ({ id: `r${i}`, x: X[i], y: y - MEAN, label: i === 0 || i === 9 ? (y - MEAN).toFixed(1) : '' })),
    }),
    highlight: { compare: ['r0', 'r1', 'r2'], active: ['r7', 'r8', 'r9'] },
    explanation: `The residuals, plotted as their own dataset: small houses sit ~4.5 below the mean line, big houses ~4.4 above. Now train the weakest learner imaginable on them — a STUMP, one split and two constants. The best split (found by the live code in this module) is x < ${hist[1].stump.s}: predict ${hist[1].stump.ml.toFixed(1)} on the left, +${hist[1].stump.mr.toFixed(1)} on the right. Add that correction to F₀ and the ensemble takes its first real shape.`,
    invariant: 'Each round trains on residuals: the targets are the current ensemble\'s mistakes, not the original labels.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'house size (100s sq ft)' }, y: { label: 'price ($10k)' } },
      series: [
        fnSeries('f1', 'F₁', hist[1].F),
        fnSeries('f2', 'F₂ = F₁ + stump₂', hist[2].F),
      ],
      markers: dataMarkers(),
    }),
    highlight: { visited: ['f1'], active: ['f2'] },
    explanation: `Round 2: compute fresh residuals against F₁, fit stump₂ — it picks the OTHER split, x < ${hist[2].stump.s}, because round 1 already fixed the first one and the biggest remaining error moved. MSE: ${hist[0].mse.toFixed(1)} → ${hist[1].mse.toFixed(2)} → ${hist[2].mse.toFixed(2)}. This is the division of labor that makes boosting different in kind from bagging: tree 2 is not a second opinion on the same question — it is a SPECIALIST in exactly the mistakes tree 1 left behind.`,
  };

  yield {
    state: plotState({
      axes: { x: { label: 'house size (100s sq ft)' }, y: { label: 'price ($10k)' } },
      series: [fnSeries('f4', 'F₄: four stumps deep', hist[4].F)],
      markers: dataMarkers(),
    }),
    highlight: { found: ['f4'] },
    explanation: `Four rounds, four one-split stumps — and the staircase has found all three plateaus: MSE down from ${hist[0].mse.toFixed(1)} to ${hist[4].mse.toFixed(2)}, a 99.5% reduction, using learners that individually cannot even represent this curve. That is boosting's magic trick: WEAK learners, STRONG ensemble — additively, each new function patching the remaining error. No single stump knows the answer; the SUM does.`,
  };

  yield {
    state: matrixState({
      title: 'Why "GRADIENT" boosting: the residual IS the gradient',
      rows: [{ id: 'gd', label: 'gradient descent' }, { id: 'gb', label: 'gradient boosting' }],
      columns: [{ id: 'what', label: 'updates' }, { id: 'step', label: 'each step' }],
      values: [[1, 2], [3, 4]],
      format: (v) => ['', 'numbers (weights)', 'w ← w − η·∇loss', 'a FUNCTION F(x)', 'F ← F + η·(tree fit to −∇loss)'][v],
    }),
    highlight: { compare: ['gd:step', 'gb:step'] },
    explanation: 'The name decoded. For squared loss, the negative gradient of the loss with respect to each PREDICTION is exactly y − F(x) — the residual. So "fit a tree to the residuals and add it" is literally a gradient-descent step, taken not in weight space but in FUNCTION space, with a tree as the step direction. That one reframing (Friedman, 2001) unlocked everything: swap the loss and the same machine does classification (log-loss residuals), ranking, Poisson counts — anything differentiable. Boosting is Gradient Descent\'s portrait painted with trees.',
    invariant: 'For squared loss, residual = −∂loss/∂prediction: each tree is a gradient step in function space.',
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
    explanation: 'The most important knob: η, the LEARNING RATE (shrinkage) — each tree\'s correction is multiplied by η before joining the ensemble. η = 1.0 devours the training error in four rounds; η = 0.3 needs ~3× the trees for the same fit. So why does every serious practitioner run η at 0.1 or below? Because on real, NOISY data the greedy fitter starts memorizing noise within a few rounds (this clean demo has no noise to memorize — your data will). Small η forces many small, partially-overlapping corrections whose noise averages out — the "slow learning" principle. The standard recipe: set η low, add trees until VALIDATION error turns upward, stop there (early stopping — the U-curve from Learning Curves, navigated live).',
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
    explanation: 'The two great ensemble strategies are OPPOSITE prescriptions from the Learning Curves pharmacy. Bagging takes low-bias, high-variance learners (deep trees) and averages the variance away — which is why Random Forest barely overfits and barely needs tuning. Boosting takes high-bias, low-variance learners (stumps) and stacks them to chew through the bias — which is why it can fit almost anything and will happily keep going into the noise. One averages second opinions; the other compounds specialists. Diagnose your error budget first, then pick the medicine.',
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
      format: (v) => ['', 'λ on leaf weights + tree size in the loss itself', 'bin features → find splits in O(bins) not O(n)', 'each split learns a default direction for NaN', 'most-winning model class on tabular Kaggle, ~decade'][v],
    }),
    highlight: { active: ['record:what'] },
    explanation: 'The industrial descendants. XGBoost (2016) put Regularization\'s λ INSIDE the boosting objective — penalizing leaf weights and tree complexity in the same loss the stumps optimize — plus second-order gradients; LightGBM added histogram tricks and leaf-wise growth for 10× speed. The result is the quiet scandal of modern ML: on medium-sized TABULAR data — fraud tables, churn, credit risk, medical records — gradient-boosted trees still routinely beat deep learning, at a thousandth of the tuning cost. Transformers conquered text and pixels; the spreadsheet kingdom never fell. Know both, and know which kingdom your problem lives in.',
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
      heading: `What it is`,
      paragraphs: [
        `Gradient Boosting builds an ensemble sequentially. A Random Forest trains many trees independently and averages them; boosting trains the next tree on what the current ensemble still gets wrong. In this demo the weak learner is a decision stump: one split, two constant predictions. Four stumps are enough to recover the three plateaus in the ten-house price example. The idea is powerful because each tree only needs to be useful on the remaining error. The sum of weak corrections becomes a strong model.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The first model predicts the mean price for every house: 7.83 in units of $10k, or about $78k. Its mean squared error is 11.80. Boosting computes residuals, y - F(x), and fits a stump to those residuals. The first split is x < 3.5, separating the small houses from the rest; the second round recomputes residuals and picks x < 7.5. After four rounds the demo's MSE falls to 0.06, a 99%+ reduction, even though no individual stump can represent three plateaus alone.`,
        `The word gradient is literal. For squared error, the negative gradient with respect to the prediction is the residual, so fitting a tree to residuals is Gradient Descent in function space. For classification, libraries use the same recipe with log-loss gradients, which is why Logistic Regression and boosted trees share evaluation tools even though their model shapes differ. The learning-rate view shows shrinkage: eta = 1.0 fixes the clean training set quickly, while eta = 0.3 needs more rounds but is safer on noisy data.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Training cost is roughly rounds times the cost of fitting one small tree. For sorted numeric features, stump search is near linear per feature; real gradient-boosted trees add depth, histograms, and second-order approximations. Prediction costs O(M * depth) for M trees, usually fast enough for production APIs. Storage is the list of tree splits and leaf values. The demo stores only four splits and eight leaf corrections. The chart makes that speed visible. Regularization: L1 & L2 appears in XGBoost as penalties on leaf weights and tree complexity, not just on linear coefficients.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Gradient Boosting is a default weapon for tabular data: fraud tables, churn prediction, pricing, credit risk, insurance, ranking, and medical records. It handles nonlinear interactions, missing values, mixed feature types, and messy scales better than many hand-built feature pipelines. Cross-Validation & Honest Evaluation is essential because boosted models have many knobs: learning rate, rounds, depth, subsampling, regularization, and early stopping. Modern libraries also exploit sorted columns and histogram bins, which is why boosted trees can stay practical on millions of rows.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Boosting is not bagging with a different logo. It is greedy, sequential, and happy to chase noise if you keep adding trees after validation stops improving. Learning Curves & Bias–Variance explains the diagnosis: boosting often reduces bias first, then raises variance as it memorizes. Early Stopping & Patience is the practical brake. Data Leakage & Contamination is especially dangerous here because a leaky feature will look like a perfect residual fixer and be rewarded round after round.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Random Forest to see the parallel ensemble strategy, Gradient Descent for the function-space analogy, and Regularization: L1 & L2 for why penalties keep boosted trees from overfitting. Picking a Threshold with Real Costs matters once a boosted classifier emits scores and the business must choose which errors to buy.`,
      ],
    },
  ],
};
