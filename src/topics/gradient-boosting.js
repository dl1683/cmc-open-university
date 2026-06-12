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
        `Gradient boosting is the sequential ensemble strategy: fit a weak learner (a decision stump — one split, two predictions) to data, measure what it missed, then fit the NEXT learner to correct those specific mistakes, and repeat. Unlike Random Forest, which trains many trees in parallel and averages them to kill variance, boosting trains trees ONE AFTER ANOTHER, each a specialist in the previous ensemble's errors. A staircase of stumps — individually barely better than guessing — compounds into a powerful function. Each new tree patches the remaining residuals, and the sum of all patches fits the data with remarkable accuracy.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Start with F₀, the mean. On the demo's ten houses with three price plateaus, F₀ predicts $${(MEAN * 10).toFixed(0)}k for every house, missing the structure by MSE 11.8. Compute residuals — the gap between real and predicted price — and fit a stump to them. The best split is x < 3.5: predict one constant left, another right. Add this correction to F₀ and you have F₁. Repeat: fresh residuals on F₁, fit a new stump to them, add it. The key invariant: each round fits to the PREVIOUS ensemble's mistakes, not the original labels.`,
        `The gradient connection: when loss is squared error, the negative gradient of loss with respect to prediction is exactly the residual (y − ŷ). So "fit a tree to residuals and add it" is a gradient descent step in function space, not weight space. This reframing (Friedman, 2001) generalizes: swap the loss and the same machine handles classification, ranking, anything differentiable. The learning rate η controls step size: η = 1 is greedy (eats training error fast); η = 0.3 or less forces tiny increments, preventing overfitting because slow, overlapping corrections average out noise.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Training: each round fits one stump in O(n log n), so M rounds cost O(M × n log n). Bottleneck is M, not data size — hundreds of stumps train fast on millions of rows. The demo: four stumps, MSE fell from 11.8 to 0.06 (99.5% cut). Testing: O(M) tree traversals per sample. Storage: M stumps, each just a split value and two leaves — very compact. XGBoost and LightGBM add histogram binning to reduce split search from O(n) to O(bins), speeding training 10× on wide datasets.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Gradient boosting dominates tabular data: spreadsheets, fraud tables, credit risk, medical records. XGBoost (2016) won Kaggle for years and remains the default first model. LightGBM and CatBoost add categorical features, GPU training, and optimization. On fraud, churn, and risk, boosted trees beat deep learning at a fraction of tuning cost — the spreadsheet kingdom never fell. Deep learning owns text and images; boosting owns tables. Most industry data scientists spend more time deploying boosted models than neural nets.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Boosting and Random Forest are OPPOSITE medicines: bagging (RF) builds in parallel, each tree independent, variance cancels via averaging — hard to overfit. Boosting is sequential and will memorize noise if you train too long. The recipe: low learning rate (η ≤ 0.1), monitor validation error on a hold-out set, stop when validation error rises (early stopping, the U-curve from learning curves). Without validation, boosting overfits. Another trap: small depth helps (stumps are standard), but is still a tuning choice. Finally, boosting is greedy: each stump minimizes current-round residuals, not the global objective — fast but not optimal.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Gradient boosting is sequential; Random Forest is parallel — go learn Random Forest to see the opposite ensemble strategy and the variance-bias tradeoff. Study Gradient Descent to see the weight-space version of what boosting does in function space. Learning Curves & Bias–Variance explains the error budget (variance vs bias) that tells you which medicine to reach for. Regularization: L1 & L2 covers the λ penalty that XGBoost and LightGBM bake into their objective. Cross-Validation & Honest Evaluation teaches proper generalization measurement, critical for tuning boosting's many knobs.`,
      ],
    },
  ],
};

