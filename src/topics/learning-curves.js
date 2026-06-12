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
        `Learning Curves & Bias–Variance is the diagnostic that answers a costly question: should you collect more data, simplify the model, or make it more expressive? Plot training accuracy and validation accuracy as the training set grows. The gap between them tells you whether the model is memorizing the sample, while the level where they converge tells you whether the model is too simple. This is diagnosis before treatment, and Cross-Validation & Honest Evaluation supplies the held-out measurement that makes the curves believable.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The high-variance patient starts with 50 examples: training accuracy is 100%, validation is 62%, a 38-point gap. As data grows to 1,600 examples, training falls to 94%, validation rises to 86%, and the gap narrows to 8 points. The model had enough capacity to memorize small samples, but more data is still helping. Treatments include more data, stronger Regularization: L1 & L2, Dropout, or a simpler model.`,
        `The high-bias patient looks different. Training begins at only 78%, validation at 65%, and both curves fuse around 74% by 800 to 1,600 examples. There is no big gap left to close. The model cannot fit the pattern it already has, so ten times more data would mostly confirm the same ceiling. Treatments point the other way: better features, more capacity, lower regularization, or a model class beyond a straight boundary like Logistic Regression.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `A learning curve costs several training runs at different sample sizes. The demo uses six sizes: 50, 100, 200, 400, 800, and 1,600. If each run starts from scratch, total cost is the sum of those fits, often a few times a full run rather than a new data-collection project. Storage is just the plotted scores. The payoff is avoiding the expensive wrong prescription: collecting labels for a high-bias model or redesigning a model that only needed more data. For expensive models, you can sample fewer points, but keep them spaced widely enough to reveal the trend.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Medical AI teams use learning curves before buying another labeling round. Spam teams use them to decide whether Tokenization (BPE), features, or more mail labels matter most. Recommenders, fraud systems, search rankers, and Gradient Boosting pipelines use them to tell whether validation is still climbing or has hit a ceiling. Early Stopping & Patience reads a related curve over epochs instead of dataset size: stop when validation stops improving even as training keeps improving.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Do not read one point; read the trend. Do not let Data Leakage & Contamination inflate validation and hide variance. Keep preprocessing and hyperparameter choices fixed while drawing the curve, or you are mixing diagnosis with tuning. Remember irreducible noise: if curves fuse at a high but imperfect value, the remaining error may be ambiguous labels or inherently noisy outcomes. Uncertainty: Teaching Models to Say "I Don't Know" names that aleatoric floor. Double descent also complicates the old U-shaped story for very overparameterized neural nets, where validation can improve again past interpolation. That is a warning to inspect the regime, not a license to ignore the curve. Bad curves send budget in the wrong direction.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Regularization: L1 & L2 and Dropout for high-variance treatments, Logistic Regression for a deliberately simple high-bias model, and Cross-Validation & Honest Evaluation for trustworthy validation curves. Then connect this topic to Early Stopping & Patience, where the same bias-variance reasoning plays out over training time.`,
      ],
    },
  ],
};
