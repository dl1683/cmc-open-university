// Learning curves: diagnose before you treat. Plot accuracy against
// training-set size and the model tells you what ails it — starved for
// data, or too simple to ever learn the pattern. The treatments differ.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'learning-curves',
  title: 'Learning Curves & Bias–Variance',
  category: 'AI & ML',
  summary: 'More data, or a better model? Plot the learning curve and the gap (or its absence) prescribes the treatment.',
  controls: [
    { id: 'view', label: 'Read', type: 'select', options: ['the learning-curve diagnosis', 'the bias–variance anatomy'], defaultValue: 'the learning-curve diagnosis' },
  ],
  run,
};

const SIZES = [50, 100, 200, 400, 800, 1600];
// High-variance patient: huge train/val gap, narrowing as data arrives.
const VAR_TRAIN = [100, 99, 98, 96, 95, 94];
const VAR_VAL = [62, 68, 74, 79, 83, 86];
// High-bias patient: both curves converge fast onto a low ceiling.
const BIAS_TRAIN = [78, 76, 75, 74.5, 74, 74];
const BIAS_VAL = [65, 70, 72, 73, 73.5, 74];

const curvePair = (train, val) => [
  { id: 'train', label: 'training accuracy', points: SIZES.map((n, i) => ({ x: n, y: train[i] })) },
  { id: 'val', label: 'validation accuracy', points: SIZES.map((n, i) => ({ x: n, y: val[i] })) },
];

function* diagnosis() {
  yield {
    state: plotState({
      axes: { x: { label: 'training examples' }, y: { label: 'accuracy (%)' } },
      series: curvePair(VAR_TRAIN, VAR_VAL),
    }),
    highlight: { active: ['val'], compare: ['train'] },
    explanation: 'The model is stuck at 86% validation accuracy and the team is debating: collect more data (expensive, months) or redesign the model (risky, weeks)? Before spending either budget, run the cheapest diagnostic in machine learning: retrain on growing SLICES of the data you already have — 50 examples, then 100, 200, 400… — and plot training accuracy against validation accuracy (measured honestly, as Cross-Validation taught). The two curves are about to testify.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'training examples' }, y: { label: 'accuracy (%)' } },
      series: curvePair(VAR_TRAIN, VAR_VAL),
      markers: [{ id: 'gap', x: 1600, y: 90, label: 'gap = variance' }],
    }),
    highlight: { compare: ['train', 'val'], active: ['gap'] },
    explanation: 'Read patient one. Training accuracy starts at 100% — with 50 examples the model memorizes everything (Regularization showed how) — while validation crawls at 62%: a 38-point GAP. That gap is VARIANCE made visible: the model has capacity to spare and fills it with the noise of whichever small sample it saw. Now watch both curves as data grows: train slips (harder to memorize 1600 than 50), validation CLIMBS, and the gap narrows at every step — still 8 points at the right edge. The curves have not converged. Verdict: this model is data-starved. More data WILL help — the trend line says so before you collect a single new example.',
    invariant: 'The train–validation gap measures variance: capacity spent memorizing the particular sample.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'training examples' }, y: { label: 'accuracy (%)' } },
      series: curvePair(BIAS_TRAIN, BIAS_VAL),
      markers: [{ id: 'ceiling', x: 1600, y: 74, label: 'converged at 74%' }],
    }),
    highlight: { active: ['ceiling'], visited: ['train', 'val'] },
    explanation: 'Patient two, same disease on the surface (mediocre accuracy), opposite anatomy: training accuracy is LOW from the start — 78% — and falling toward validation, which rises to meet it. By 800 examples the curves have fused at 74% and flatlined. No gap, no variance — this model cannot even fit the data it HAS. That is BIAS: the hypothesis is too simple for the pattern (a straight line chasing a curve, Logistic Regression\'s one-boundary limit). The brutal corollary: ten million more examples would land on the same 74% ceiling. Anyone who says "just get more data" without looking at this plot is prescribing before diagnosing.',
    invariant: 'Converged-and-low curves mean bias: the ceiling is the model, not the data.',
  };

  yield {
    state: matrixState({
      title: 'The prescription pad',
      rows: [
        { id: 'gap', label: 'big gap, val climbing' },
        { id: 'flat', label: 'curves fused, low' },
        { id: 'both', label: 'fused AND high' },
      ],
      columns: [{ id: 'dx', label: 'diagnosis' }, { id: 'rx', label: 'treatment' }],
      values: [[1, 2], [3, 4], [5, 6]],
      format: (v) => ['', 'high variance', 'more data, ↑λ, dropout, simplify', 'high bias', 'bigger model, better features, ↓λ', 'near the noise ceiling', 'ship it — remaining error is irreducible'][v],
    }),
    highlight: { active: ['gap:rx'], compare: ['flat:rx'] },
    explanation: 'The prescription pad — and notice the treatments are OPPOSITES. High variance calls for more data or a tighter leash (raise λ, add Dropout, shrink the model); high bias calls for the reverse (more capacity, richer features, LOWER λ). Apply the wrong one and you make the patient sicker: regularizing a high-bias model pushes the 74% ceiling down further. The third row is the one teams forget: when curves fuse at a HIGH value, the residual error may be irreducible noise — mislabeled examples, genuinely ambiguous cases (the aleatoric floor from Uncertainty). No model fixes that; recognizing it saves quarters of wasted effort.',
  };
}

function* anatomy() {
  yield {
    state: matrixState({
      title: 'Total error, dissected: error = bias² + variance + noise',
      rows: [{ id: 'varm', label: 'the memorizer' }, { id: 'biasm', label: 'the straight line' }, { id: 'sweet', label: 'the tuned model' }],
      columns: [{ id: 'bias', label: 'bias²' }, { id: 'var', label: 'variance' }, { id: 'noise', label: 'noise' }, { id: 'total', label: 'total error' }],
      values: [[1, 22, 5, 28], [21, 2, 5, 28], [5, 4, 5, 14]],
      format: (v) => `${v}%`,
    }),
    highlight: { compare: ['varm:var', 'biasm:bias'], found: ['sweet:total'] },
    explanation: 'The bookkeeping behind the curves. Every model\'s expected error splits into three accounts: BIAS² — error from the hypothesis being too simple (it would persist with infinite data); VARIANCE — error from sensitivity to which particular sample you drew (retrain on a new sample, get a different model); NOISE — the irreducible floor no model escapes. The memorizer and the straight line both total 28%, by opposite routes. The art is the bottom row: accept a LITTLE bias to slash a LOT of variance — exactly the trade λ executes in Regularization, one knob sliding error between the two accounts.',
    invariant: 'Bias and variance trade against each other; only their sum (plus noise) is what you pay.',
  };

  const COMPLEXITY = Array.from({ length: 10 }, (_, i) => i + 1);
  const TRAIN_ERR = [30, 22, 16, 11, 8, 5, 3.5, 2.5, 1.8, 1.2];
  const VAL_ERR = [32, 25, 20, 17, 15.5, 15, 15.8, 17.5, 20, 24];
  yield {
    state: plotState({
      axes: { x: { label: 'model complexity →' }, y: { label: 'error (%)' } },
      series: [
        { id: 'trainErr', label: 'training error', points: COMPLEXITY.map((c, i) => ({ x: c, y: TRAIN_ERR[i] })) },
        { id: 'valErr', label: 'validation error', points: COMPLEXITY.map((c, i) => ({ x: c, y: VAL_ERR[i] })) },
      ],
      markers: [{ id: 'sweet', x: 6, y: 15, label: 'the sweet spot' }],
    }),
    highlight: { found: ['sweet'], compare: ['trainErr', 'valErr'] },
    explanation: 'The same trade as a dial instead of a diagnosis: sweep model complexity left to right. Training error only ever falls — more capacity never fits the training set worse. Validation error draws the famous U: falling while added capacity captures real pattern (bias shrinking), bottoming at the sweet spot, then RISING as capacity starts memorizing noise (variance growing). Everything in the classical toolkit — λ, tree depth, early stopping — is a hand on this dial, and Cross-Validation is how you read the U honestly to find its bottom.',
  };

  const EXT = [10, 11, 12, 13, 14, 16];
  const EXT_VAL = [24, 26, 23, 19, 16, 13];
  yield {
    state: plotState({
      axes: { x: { label: 'model complexity →' }, y: { label: 'validation error (%)' } },
      series: [
        { id: 'classic', label: 'classical U', points: COMPLEXITY.map((c, i) => ({ x: c, y: VAL_ERR[i] })) },
        { id: 'modern', label: 'keep going…', points: EXT.map((c, i) => ({ x: c, y: EXT_VAL[i] })) },
      ],
      markers: [{ id: 'peak', x: 11, y: 26, label: 'interpolation point' }],
    }),
    highlight: { active: ['modern'], compare: ['peak'] },
    explanation: 'The modern plot twist: keep turning the dial past the point where the model can memorize the ENTIRE training set (the interpolation point, the U\'s worst peak) — and validation error can fall AGAIN. This is DOUBLE DESCENT, the curve that startled deep learning: wildly overparameterized networks (more weights than data) often generalize BETTER than right-sized ones, because among the many ways to fit the data perfectly, gradient descent gravitates toward the smoothest. The classical U still governs the regimes where most practitioners tune; deep learning lives on the far slope. Know which side of the peak you are standing on before you trust the old rules.',
    invariant: 'Classical bias–variance governs underparameterized models; past interpolation, implicit regularization changes the curve.',
  };

  yield {
    state: matrixState({
      title: 'One toolkit, one ledger',
      rows: [
        { id: 'data', label: 'more data' },
        { id: 'lambda', label: 'raise λ / dropout' },
        { id: 'capacity', label: 'bigger model' },
        { id: 'features', label: 'better features' },
      ],
      columns: [{ id: 'bias', label: 'bias' }, { id: 'var', label: 'variance' }],
      values: [[0, 2], [1, 2], [2, 1], [2, 0]],
      format: (v) => ['unchanged', '↑ worse', '↓ better'][v],
    }),
    highlight: { found: ['data:var', 'features:bias'] },
    explanation: 'Every intervention you have met on this site, posted to the two accounts. More data is the only free lunch — variance falls, bias untouched (which is why it cannot cure patient two). Regularization and Dropout buy variance relief at a small bias cost. Capacity and features do the reverse. The diagnostic loop that ties the whole ML section of this site together: plot the learning curve (this page) → read which account is bleeding → apply the matching treatment (Regularization, capacity, data) → measure honestly (Cross-Validation) → repeat. Diagnosis before treatment — in machine learning as anywhere else.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'the learning-curve diagnosis') yield* diagnosis();
  else if (view === 'the bias–variance anatomy') yield* anatomy();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `A learning curve plots a model's accuracy against how much training data it has seen. The simplest version shows two curves: training accuracy (how well the model fits the data it was trained on) and validation accuracy (how well it generalizes to unseen examples). By comparing these two curves, you diagnose whether a model is starving for data (high-variance) or too simple to ever learn the pattern (high-bias). This visualization is the cheapest, fastest diagnostic in machine learning. Before you spend months collecting data or weeks redesigning a model, retrain on growing slices of data you already have — 50 examples, then 100, 200, 400, 1600 — and the curves will tell you exactly which treatment helps.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Take a dataset you already have. Pick a small slice — say, 50 examples — train your model on it, measure accuracy on a separate validation set, and record the point (50, training_acc, validation_acc). Now retrain the entire model on a larger slice — 100 examples — and record again. Repeat at 200, 400, 800, 1600 examples. Plot two curves: one connecting training accuracies, one connecting validation accuracies. Watch both curves as data grows. The gap between them reveals whether you have a variance or bias problem. If training accuracy is 100% but validation is 62% (a 38-point gap), the model memorizes the small training set perfectly but fails on new examples — that is variance, cured by more data. The gap narrows as you add examples: at 1600, both training and validation rise, and the gap shrinks to 8 points, but the trend is clear: more data helps. Contrast this with a different scenario: training starts at 78%, validation at 65%, and both flatten into convergence at 74%. No gap forms, and no amount of data helps — the curves fused because the model is too simple for the pattern (bias), not because it overfits. The prescription is opposite: not more data, but more capacity, better features, or lower regularization.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The computational cost is modest but not free. You retrain the model multiple times (here, six times at different data sizes), each time on a growing dataset. A single full training on all your data costs your normal budget; learning curves cost roughly 3–5× that, depending on how many points you sample. The value is enormous: one hour of computation now saves months of either wrongly collecting more data or wasting weeks on a redesign that will not help. Once you have the curves, reading them is instant — it is geometry. A high-variance patient shows a widening gap that narrows monotonically as data grows, with validation climbing steadily; a high-bias patient shows converged, fused curves at a low ceiling. Storage is negligible: you just plot a few points. The complexity meter bottoms at O(1) to read the diagnosis once you have the curve; the real work is retraining, which scales with your dataset and model size. The moral: learning curves are not optional on uncertain problems — they are cheaper than guessing wrong.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Medical AI systems use learning curves to decide whether a disease detector needs more labeled examples or a redesigned architecture. A radiologist might have 500 labeled scans and ask: will 5000 labeled scans fix the model's 82% accuracy, or is the model structurally broken? Learning curves answer in one afternoon. Spam filters plot learning curves to decide whether to hire more humans to label mail or to redesign the tokenizer and feature extraction. Recommendation systems plot them to decide whether to collect more user interaction data or to add richer collaborative features. Any team facing the "more data or better model" decision — which is every ML team, constantly — saves budget and time by running the cheapest diagnostic first. Even in production, as drift accumulates and performance slips, teams periodically re-run learning curves on new data to check whether retraining on more recent examples will help or whether the problem has shifted so much that the entire model architecture must change.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The first pitfall is conflating the two curves. A rising validation curve is good; a rising training curve with a growing gap is bad — it means you are overfitting. Do not just "get both curves to 99%" — you might be memorizing noise, not learning structure. Another trap: assuming the validation curve will keep rising. If it flattens early (say, at 400 examples) while training keeps climbing, you have a hard ceiling — probably bias — and collecting more data is optimism, not strategy. The noise ceiling is often forgotten: if both curves converge at 92%, the remaining 8% might be mislabeled examples or genuinely ambiguous cases where even humans disagree. Trying to squeeze it out with a bigger model will fail; that error is irreducible. It is also common to forget that these curves assume you are measuring honestly with a true validation set or cross-validation, as Cross-Validation taught. If you tune hyperparameters on the same set used to measure validation accuracy, the curves lie — they will show false hope that more data helps when really you are just getting luckier with the noise. Finally, do not read probabilities from a single curve point. The trend matters more than any single dot; if validation is climbing steadily at 1600 examples, the trajectory predicts benefit from more data before you collect it.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Learning curves are part of the diagnostic loop that governs the entire ML pipeline on this site. If your curves show high variance, study Regularization: L1 & L2 to see how to tighten the leash on a model, and Dropout to understand a randomized version. If high bias, you might need more model capacity, but study Logistic Regression first to see how model simplicity creates ceilings. Always measure honestly — go back to Cross-Validation & Honest Evaluation and make sure your validation set is truly held out. For advanced understanding, study Uncertainty: Teaching Models to Say "I Don't Know" to learn why converged-and-high curves might still hide aleatoric error. The complexity U-curve in the visualization is the same tradeoff Regularization tunes; the sweet spot is where Cross-Validation finds the best hyperparameters. Learning curves, regularization, and cross-validation form the core diagnostic and tuning tools of classical machine learning.`,
      ],
    },
  ],
};

