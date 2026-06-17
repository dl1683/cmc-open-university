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
      heading: `Why Learning Curves Exist`,
      paragraphs: [
        `A learning curve is a diagnostic plot. It shows model performance as the amount of training data changes. In the common supervised-learning version, you train the same model on small, medium, and large slices of the training set, then plot both training performance and validation performance. The shape tells you whether the model is starved for data, too weak to fit the pattern, over-regularized, under-regularized, or already close to the noise floor.`,
        `This matters because machine-learning budgets are expensive in different ways. Collecting more labels can take months. Redesigning the model can break production assumptions. Adding capacity can increase latency and serving cost. Regularization can stabilize a model or make it too dull. A learning curve does not solve the whole problem, but it tells you which intervention is plausible before the team spends the budget. It is diagnosis before treatment.`,
      ],
    },
    {
      heading: `The Wall They Answer`,
      paragraphs: [
        `The obvious response to mediocre validation accuracy is to argue from taste. One person says the model needs more data. Another says the architecture is too small. Another says the model is overfitting and needs regularization. All three can be right in different situations, and each can be damaging when applied to the wrong situation. A high-bias model does not become powerful just because you add labels. A high-variance model does not become more stable because you make it bigger.`,
        `Learning curves answer that wall by separating memorization from underfitting. Training performance tells you how well the model can fit the data it saw. Validation performance tells you how well that fit transfers to unseen data. The gap between those curves is a variance clue. The level where the curves settle is a bias clue. The trend as data grows is the prescription. You do not read one score; you read the shape.`,
      ],
    },
    {
      heading: `Core Insight`,
      paragraphs: [
        `The core insight is that training error and validation error fail for different reasons. If training performance is excellent but validation performance is poor, the model has enough capacity to fit the sample but is sensitive to which sample it saw. That is high variance. More data, stronger regularization, dropout, data augmentation, simpler models, or better validation discipline may help. The model is not dumb; it is too free to memorize accidents.`,
        `If training and validation performance are both poor and close together, the model is not even fitting the training set well. That is high bias. More data may make the estimate more stable, but it will not remove the ceiling. The model needs more capacity, better features, a different hypothesis class, less regularization, or a representation that can express the pattern. The model is not overfitting; it is underfitting.`,
      ],
    },
    {
      heading: `Mechanism`,
      paragraphs: [
        `To draw a learning curve, choose several training-set sizes. The demo uses 50, 100, 200, 400, 800, and 1,600 examples. For each size, sample a training subset, train the model under the same basic recipe, evaluate on the training subset, and evaluate on a fixed validation set. Plot training accuracy and validation accuracy against training-set size. For error metrics, the vertical axis may be loss or error instead of accuracy, but the interpretation is the same.`,
        `The validation set must be honest. If preprocessing, feature selection, deduplication, or hyperparameter search leaks validation information into training, the curve lies. Cross-validation can improve reliability when the dataset is small, but it does not remove the need for separation. The clean setup is: training subsets grow, the validation protocol stays fixed, and the score reflects generalization to examples the model did not train on.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `Learning curves work because they compare two errors that move for different reasons. Training error shows how well the model can fit the examples it already saw. Validation error shows whether that fit transfers to held-out data. The gap between them is the signal: a large gap points to variance, while two high curves point to bias or missing signal.`,
        `The useful invariant is that changing data size, model capacity, and regularization should move the curves in predictable ways. More data usually reduces variance before it fixes bias. More capacity usually reduces training error before it improves validation error. Stronger regularization usually raises training error while trying to lower validation error. That pattern turns a vague bad score into a diagnosis you can act on.`,
      ],
    },
    {
      heading: `Worked Diagnosis`,
      paragraphs: [
        `The high-variance patient starts with 50 examples. Training accuracy is 100 percent, validation accuracy is 62 percent, and the gap is 38 points. The model can memorize the tiny training set. As the training set grows to 1,600 examples, training accuracy falls to 94 percent and validation rises to 86 percent. The gap is still there, but it narrows. Validation is still climbing. That shape says the model is data-starved or too unconstrained. More data is likely to help, and so are regularization or simplification if new data is expensive.`,
        `The high-bias patient looks different. Training accuracy starts at only 78 percent and validation starts at 65 percent. As data grows, both curves move toward 74 percent and flatten together. There is no large gap left. The model cannot fit the training data it already has. More labels would mostly confirm the same ceiling. The useful interventions point the other way: richer features, a more expressive model, lower regularization, better representation learning, or a model class beyond a simple linear boundary.`,
      ],
    },
    {
      heading: `Bias-Variance Anatomy`,
      paragraphs: [
        `Bias is error from the hypothesis being too simple or systematically wrong. Even with infinite data, a straight line cannot represent a curved boundary without better features or a different model class. Variance is error from sensitivity to the particular training sample. A high-variance model changes too much when trained on a different draw from the same distribution. Noise is the irreducible part: mislabeled examples, ambiguous cases, measurement error, or outcomes no available input can determine.`,
        `The classical bias-variance story says total expected error can be viewed as bias squared plus variance plus noise. In practice you rarely calculate those exact terms for a modern model, but the concepts still guide action. More capacity usually lowers bias and raises variance. More regularization usually lowers variance and raises bias. More data usually lowers variance without directly fixing bias. Better features can lower bias by making the true pattern easier for the model class to express.`,
      ],
    },
    {
      heading: `What The Animation Teaches`,
      paragraphs: [
        `The first plot is the high-variance case. Watch the training curve start near perfection while the validation curve lags far below it. That gap is the important evidence. Then watch what happens as data increases: training performance becomes less perfect because memorization is harder, validation improves because the model sees a more representative sample, and the gap narrows. The treatment row says more data, stronger regularization, dropout, or a simpler model.`,
        `The second plot is the high-bias case. Both curves converge quickly at a low ceiling. The model is not using its freedom to memorize noise; it does not have enough useful freedom in the first place. The prescription card matters because the treatments are opposite. Regularizing a high-bias model can make it worse. Making a high-variance model larger can make it worse. The plot prevents that kind of budget mistake.`,
      ],
    },
    {
      heading: `Costs And Tradeoffs`,
      paragraphs: [
        `A learning curve costs several training runs. If the model is cheap, use many training sizes and repeat the sampling to estimate variance around the curve. If the model is expensive, use fewer sizes, spaced widely enough to reveal the trend. A rough curve is often enough to decide whether a labeling project is worth funding. It is better to spend a few additional training runs than to collect thousands of labels for a model that has already hit a bias ceiling.`,
        `There is a methodological tradeoff. If you keep hyperparameters fixed across all data sizes, the curve is easier to interpret because only training-set size changes. But the smallest subsets may need different regularization than the largest subsets. If you retune at every size, you may get a better estimate of best-achievable performance, but the curve mixes data scaling with tuning effort. Be explicit about which question you are asking: diagnosis of the current recipe or best performance at each size.`,
      ],
    },
    {
      heading: `Where They Win And Fail`,
      paragraphs: [
        `Learning curves are useful in medical AI, fraud detection, search ranking, recommendation systems, spam filtering, forecasting, computer vision, and any supervised task where labels are expensive. A medical team can use the curve before paying experts for another annotation round. A fraud team can see whether better features matter more than more examples. A recommender team can compare whether validation is still climbing with logged interaction data or whether the model class has flattened out.`,
        `They are less useful when the evaluation set is untrustworthy, the data distribution is changing quickly, or the target metric is dominated by delayed feedback that the validation set does not capture. They can also mislead when duplicate examples leak across splits, when preprocessing sees the whole dataset, or when the chosen training subsets are not representative. The curve diagnoses the system you actually measured. If the measurement pipeline is contaminated, the diagnosis is contaminated.`,
      ],
    },
    {
      heading: `Pitfalls And Misconceptions`,
      paragraphs: [
        `The first misconception is that more data always helps. More data helps most when validation is still climbing and the train-validation gap is large. It does not fix a model that cannot fit the existing training data. The second misconception is that overfitting always means high validation error. You need the training curve too. Poor validation with poor training is underfitting, not overfitting.`,
        `The third trap is reading a single endpoint. A model at 86 percent validation accuracy could be promising if the curve is still rising, or stuck if the curve has flattened. Trend matters. Another trap is ignoring irreducible noise. If training and validation are both high and close together, the remaining mistakes may come from ambiguous labels or missing information. Double descent adds one more caution for very overparameterized neural networks: the classical U-shaped validation curve can improve again past interpolation. That does not invalidate learning curves. It means you must know which regime you are in.`,
      ],
    },
    {
      heading: `Study Next`,
      paragraphs: [
        `Study Cross-Validation and Honest Evaluation first, because a learning curve is only as trustworthy as its validation protocol. Then study Regularization: L1 and L2, Dropout, Data Augmentation, Logistic Regression, Decision Trees, Gradient Boosting, and Early Stopping. These topics become clearer once you see whether they mostly attack bias, variance, or training-time overfitting.`,
        `The best exercise is to generate learning curves for three models on the same dataset: a deliberately weak linear model, a high-capacity model with little regularization, and a tuned middle-ground model. Plot training and validation performance for each. Then write the prescription before changing anything. The habit you want is simple: inspect the curve, name the failure mode, choose the matching intervention, and measure again.`,
      ],
    },
  ],
};
