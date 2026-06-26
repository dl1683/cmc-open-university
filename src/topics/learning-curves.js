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
    explanation: `Patient two, same disease on the surface (mediocre accuracy), opposite anatomy: training accuracy is LOW from the start — 78% — and falling toward validation, which rises to meet it. By 800 examples the curves have fused at 74% and flatlined. No gap, no variance — this model cannot even fit the data it HAS. That is BIAS: the hypothesis is too simple for the pattern (a straight line chasing a curve, Logistic Regression's one-boundary limit). The brutal corollary: ten million more examples would land on the same 74% ceiling. Anyone who says "just get more data" without looking at this plot is prescribing before diagnosing.`,
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
      format: (v) => ['', 'high variance', 'more data, â†‘λ, dropout, simplify', 'high bias', 'bigger model, better features, â†“λ', 'near the noise ceiling', 'ship it — remaining error is irreducible'][v],
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
    explanation: `The bookkeeping behind the curves. Every model's expected error splits into three accounts: BIAS² — error from the hypothesis being too simple (it would persist with infinite data); VARIANCE — error from sensitivity to which particular sample you drew (retrain on a new sample, get a different model); NOISE — the irreducible floor no model escapes. The memorizer and the straight line both total 28%, by opposite routes. The art is the bottom row: accept a LITTLE bias to slash a LOT of variance — exactly the trade λ executes in Regularization, one knob sliding error between the two accounts.`,
    invariant: 'Bias and variance trade against each other; only their sum (plus noise) is what you pay.',
  };

  const COMPLEXITY = Array.from({ length: 10 }, (_, i) => i + 1);
  const TRAIN_ERR = [30, 22, 16, 11, 8, 5, 3.5, 2.5, 1.8, 1.2];
  const VAL_ERR = [32, 25, 20, 17, 15.5, 15, 15.8, 17.5, 20, 24];
  yield {
    state: plotState({
      axes: { x: { label: 'model complexity â†’' }, y: { label: 'error (%)' } },
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
      axes: { x: { label: 'model complexity â†’' }, y: { label: 'validation error (%)' } },
      series: [
        { id: 'classic', label: 'classical U', points: COMPLEXITY.map((c, i) => ({ x: c, y: VAL_ERR[i] })) },
        { id: 'modern', label: 'keep going…', points: EXT.map((c, i) => ({ x: c, y: EXT_VAL[i] })) },
      ],
      markers: [{ id: 'peak', x: 11, y: 26, label: 'interpolation point' }],
    }),
    highlight: { active: ['modern'], compare: ['peak'] },
    explanation: `The modern plot twist: keep turning the dial past the point where the model can memorize the ENTIRE training set (the interpolation point, the U's worst peak) — and validation error can fall AGAIN. This is DOUBLE DESCENT, the curve that startled deep learning: wildly overparameterized networks (more weights than data) often generalize BETTER than right-sized ones, because among the many ways to fit the data perfectly, gradient descent gravitates toward the smoothest. The classical U still governs the regimes where most practitioners tune; deep learning lives on the far slope. Know which side of the peak you are standing on before you trust the old rules.`,
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
      format: (v) => ['unchanged', 'â†‘ worse', 'â†“ better'][v],
    }),
    highlight: { found: ['data:var', 'features:bias'] },
    explanation: 'Every intervention you have met on this site, posted to the two accounts. More data is the only free lunch — variance falls, bias untouched (which is why it cannot cure patient two). Regularization and Dropout buy variance relief at a small bias cost. Capacity and features do the reverse. The diagnostic loop that ties the whole ML section of this site together: plot the learning curve (this page) â†’ read which account is bleeding â†’ apply the matching treatment (Regularization, capacity, data) â†’ measure honestly (Cross-Validation) â†’ repeat. Diagnosis before treatment — in machine learning as anywhere else.',
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
    { heading: 'How to read the animation', paragraphs: [
        'The learning-curve view plots training accuracy and validation accuracy against training-set size. Training accuracy measures fit to examples the model saw, while validation accuracy measures transfer to examples it did not train on.',
        'The bias-variance view shows the same diagnosis as an error ledger. Active markers show the current signal, compare markers show the curve that gives it meaning, and found markers show the diagnosis the plot has already earned.',
        'Read the gap, the level, and the trend. A large shrinking gap means variance, low fused curves mean bias, and high fused curves mean the remaining error may be noise or measurement.',
        {type: 'callout', text: 'A learning curve is a budget test: the gap says whether more data, more capacity, or better measurement is the next move.'},
      
        {type: 'image', src: './assets/gifs/learning-curves.gif', alt: 'Animated walkthrough of the learning curves visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},], },
    { heading: 'Why this exists', paragraphs: [
        'A model stuck at 86 percent validation accuracy can fail for opposite reasons. It may be too flexible for the available data, too weak to express the pattern, or close to the irreducible noise floor.',
        {type: 'image', src: 'https://scikit-learn.org/0.16/_images/plot_learning_curve_001.png', alt: 'Learning curves for a Naive Bayes classifier showing training and cross-validation scores converging.', caption: 'The training-validation gap is the signal: the red curve falls, the green curve rises, and the remaining distance diagnoses variance or ceiling. Source: scikit-learn documentation, BSD License.'},
        'Each cause has a different treatment, and the treatments can conflict. Learning curves exist so teams spend labeling, architecture, and regularization budget on the failure mode they actually have.',
      ], },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious approach is to look at one validation score and try the intervention that usually helps. Many teams default to more data because more data often sounds safest.',
        'One score cannot tell whether more data will help. A low validation number can mean high variance, high bias, data leakage, label noise, or the wrong metric.',
      ], },
    { heading: 'The wall', paragraphs: [
        'The wall is that bias and variance require opposite moves. A high-variance model needs more data, stronger regularization, or less capacity; a high-bias model needs more capacity, better features, or weaker regularization.',
        'A single endpoint hides the trend. The curve at 1,600 examples may be flat, still climbing, or misleading because the validation pipeline leaked information from training.',
      ], },
    { heading: 'The core insight', paragraphs: [
        'Vary training-set size while holding the model and validation protocol fixed. The changing gap between training and validation separates sample sensitivity from model ceiling.',
        'Cost becomes visible as a slope. If validation rises sharply when data doubles, labels still have runway; if both curves are fused and low, more of the same data is unlikely to move the ceiling.',
      ], },
    { heading: 'How it works', paragraphs: [
        'Choose training sizes such as 50, 100, 200, 400, 800, and 1,600 examples. For each size, train the same model, score it on the training subset, and score it on a held-out validation set or through cross-validation.',
        'Repeat sampling when possible and plot means with uncertainty bands. The validation protocol must stay fixed, and preprocessing or feature selection must not see validation examples.',
      ], },
    { heading: 'Why it works', paragraphs: [
        'Training score and validation score respond differently to data. A memorizing model scores high on training data but poorly on validation data, and the gap shrinks as more examples constrain it.',
        'A weak model scores poorly even on training data, so adding more examples does not help much. That is bias: the hypothesis class cannot express the pattern under the current features and architecture.',
      ], },
    { heading: 'Cost and complexity', paragraphs: [
        'A learning curve costs k x m training runs, where k is the number of folds and m is the number of training sizes. For cheap models, 5 folds across 10 sizes is routine; for expensive neural models, three sizes on one validation split may still be enough to avoid blind spending.',
        {type: 'image', src: 'https://scikit-learn.org/0.16/_images/plot_learning_curve_002.png', alt: 'Learning curves for an SVM classifier with a training score near one and a validation score that rises with more data.', caption: 'The SVM curve shows a high-capacity model with validation still climbing, which is the kind of shape that justifies more data. Source: scikit-learn documentation, BSD License.'},
        'Many domains follow power-law-like improvement, where each doubling of data buys a smaller but measurable gain until noise dominates. The curve turns cost into a forecast: how much validation improvement does another data collection round probably buy.',
      ], },
    { heading: 'Real-world uses', paragraphs: [
        'Learning curves guide label budgeting in medical imaging, fraud detection, search ranking, speech, and tabular prediction. They answer whether to collect labels, engineer features, change model class, or stop because the metric is near its ceiling.',
        'They also compare model families at the same data budget. A small model whose validation curve is flat and low has less future value than a larger model whose curve is still climbing with more data.',
      ], },
    { heading: 'Where it fails', paragraphs: [
        'Learning curves fail when the validation setup is contaminated. Duplicates across train and validation, preprocessing over the full dataset, or tuning on the validation set make the gap look smaller than it is.',
        'They also fail under distribution drift. If early data and later data come from different worlds, the curve mixes data quantity with changed data quality, and the diagnosis may point to the wrong treatment.',
      ], },
    { heading: 'Worked example', paragraphs: [
        'Model A has training accuracy 100, 99, 98, 96, 95, 94 percent as data grows from 50 to 1,600 examples. Validation accuracy moves 62, 68, 74, 79, 83, 86 percent, so the gap falls from 38 points to 8 points while validation keeps climbing.',
        'That is high variance with data runway. More data, stronger regularization, dropout, or a smaller model can help, and buying another labeling round has evidence behind it.',
        'Model B has training accuracy 78, 76, 75, 74.5, 74, 74 percent and validation accuracy 65, 70, 72, 73, 73.5, 74 percent. The curves fuse at 74 percent, so collecting ten times more similar data is unlikely to fix the ceiling; the next move is features, capacity, or task definition.',
      ], },
    { heading: 'Sources and study next', paragraphs: [
        'Sources: Hastie, Tibshirani, and Friedman on bias-variance; scikit-learn learning_curve documentation; Kaplan et al. on neural scaling laws; Hoffmann et al. on compute-optimal training. Treat scaling laws as planning tools built from the same curve-reading habit.',
        'Study cross-validation, regularization, dropout, logistic regression, decision trees, double descent, data leakage, and calibration. The skill is to diagnose before changing the model.',
      ], },
  ],
};
