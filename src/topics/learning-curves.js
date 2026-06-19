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
    explanation: 'The bookkeeping behind the curves. Every model\'s expected error splits into three accounts: BIAS² — error from the hypothesis being too simple (it would persist with infinite data); VARIANCE — error from sensitivity to which particular sample you drew (retrain on a new sample, get a different model); NOISE — the irreducible floor no model escapes. The memorizer and the straight line both total 28%, by opposite routes. The art is the bottom row: accept a LITTLE bias to slash a LOT of variance — exactly the trade λ executes in Regularization, one knob sliding error between the two accounts.',
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
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. "The learning-curve diagnosis" plots training accuracy (blue) and validation accuracy (orange) against training-set size for two patients: one with high variance, one with high bias. Watch the gap between curves and the level where they settle. The prescription matrix at the end maps each shape to a treatment.',
        '"The bias-variance anatomy" dissects total error into bias-squared, variance, and noise, then sweeps model complexity to show the classical U-curve and the modern double-descent extension. Active markers highlight the current diagnostic signal. Found markers show conclusions the curve has already proven. Compare markers show the second curve that gives the diagnosis its meaning.',
        'At each frame, ask three questions: which curve moved, what that movement means about the model, and whether the gap grew or shrank. The gap is the entire diagnostic.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A model is stuck at 86% validation accuracy and the team is arguing. One engineer wants more labeled data (three months, two annotators). Another wants a bigger architecture (retraining cost, latency risk). A third wants stronger regularization (might crush performance further). All three interventions are expensive, and two of the three will make the problem worse depending on the actual failure mode. Without a diagnostic, the team picks by seniority or by whichever budget happens to be available.',
        'A learning curve is the cheapest diagnostic in supervised learning. Retrain the same model on growing slices of the data you already have -- 50 examples, then 100, 200, 400, 800, 1600 -- and plot training accuracy against validation accuracy. The shape of those two curves tells you whether the model is starved for data (high variance), too weak to fit the pattern (high bias), or already near the noise floor (ship it). The plot prescribes before anyone spends the budget.',
        'The cost is a handful of extra training runs on data you already own. The payoff is avoiding months of wasted labeling or weeks of architecture redesign aimed at the wrong failure mode.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is to look at one number: validation accuracy. If it is too low, try the intervention that worked last time -- usually "get more data" because more data is the default advice in every ML textbook. Teams that do not plot curves often cycle through interventions by gut feel, treating machine learning as alchemy rather than diagnosis.',
        'This fails because one number cannot distinguish between two opposite diseases. A model at 74% validation accuracy could be a powerful model starved for data (high variance -- more data will help) or a weak model that has already converged (high bias -- more data will not help at all). The single-number approach cannot tell you which, so teams waste entire quarters collecting labels for a model whose ceiling is set by its architecture, not its data.',
        'The wall is that the treatment for high variance is the opposite of the treatment for high bias. Regularizing a high-bias model pushes its ceiling lower. Giving a high-variance model more capacity makes it memorize harder. You need two curves, not one number.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The deeper wall is that bias and variance are invisible in a single evaluation. You cannot see variance from one training run -- variance is the spread across different training samples. You cannot see bias from training accuracy alone -- bias is the gap between your hypothesis class and the true function. Learning curves make both visible by varying the one thing you can control cheaply: training-set size.',
        {
          type: 'table',
          headers: ['Symptom', 'High Bias', 'High Variance'],
          rows: [
            ['Training accuracy', 'Low (cannot fit training data)', 'High (memorizes training data)'],
            ['Validation accuracy', 'Low (close to training)', 'Low (far below training)'],
            ['Train-val gap', 'Small or zero', 'Large'],
            ['Effect of more data', 'No improvement -- curves already fused', 'Validation climbs, gap narrows'],
            ['Curves converge at', 'Low ceiling (model limit)', 'Still moving apart at right edge'],
            ['Treatment', 'More capacity, richer features, less regularization', 'More data, more regularization, dropout, simpler model'],
          ],
        },
        'The table is the entire diagnostic. Read the gap, read the level, read the trend. Each row points to one and only one disease. Applying the wrong treatment makes the patient sicker.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Choose several training-set sizes spaced to reveal the trend. The animation uses 50, 100, 200, 400, 800, and 1600. For each size, sample a training subset, train the model with the same hyperparameters, score on the training subset, and score on a held-out validation set. Plot both scores against training-set size. For reliability, repeat each size with different random samples and average, or use k-fold cross-validation at each size.',
        {
          type: 'code',
          language: 'python',
          text: 'from sklearn.model_selection import learning_curve\nimport numpy as np\n\n# Generate learning curves with 5-fold CV at each size\nsizes, train_scores, val_scores = learning_curve(\n    estimator=model,\n    X=X_train, y=y_train,\n    train_sizes=np.linspace(0.1, 1.0, 6),  # 10% to 100%\n    cv=5,                                   # 5-fold at each size\n    scoring="accuracy",\n    n_jobs=-1,\n    shuffle=True,\n    random_state=42,\n)\n\n# Mean and std across folds\ntrain_mean = train_scores.mean(axis=1)\ntrain_std  = train_scores.std(axis=1)\nval_mean   = val_scores.mean(axis=1)\nval_std    = val_scores.std(axis=1)\n\n# Plot\nimport matplotlib.pyplot as plt\nplt.fill_between(sizes, train_mean - train_std, train_mean + train_std, alpha=0.1)\nplt.fill_between(sizes, val_mean - val_std, val_mean + val_std, alpha=0.1)\nplt.plot(sizes, train_mean, "o-", label="training")\nplt.plot(sizes, val_mean, "o-", label="validation")\nplt.xlabel("Training set size")\nplt.ylabel("Accuracy")\nplt.legend()\nplt.title("Learning Curve")\nplt.show()',
        },
        'The validation set must be honest. If preprocessing, feature selection, or hyperparameter tuning sees validation data, the curve lies. Cross-validation at each training size adds reliability but does not remove the need for separation. The clean setup: training subsets grow, the validation protocol stays fixed, and no information about the validation examples leaks into any training step.',
        {
          type: 'diagram',
          label: 'Three learning curve shapes',
          text: 'Accuracy\n  |                                         \n  |  ____________________________  <-- training (ideal)\n  | /  __________________________ <-- validation (ideal)\n  |/  /\n  | /   Ideal: both curves high, gap small\n  |/\n  +-----------------------------------> Training set size\n\nAccuracy\n  |  ________________________________ <-- training (overfit)\n  |\n  |        ___________  \n  |       /            <-- validation (still climbing)\n  |      /\n  |  GAP = VARIANCE\n  +-----------------------------------> Training set size\n\nAccuracy\n  |\n  |   \\___________\n  |   /            \\_____ <-- training (underfit)\n  |  /  _________________ <-- validation (fused, low)\n  | /  /\n  |   CEILING = BIAS\n  +-----------------------------------> Training set size',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Learning curves work because training error and validation error are driven by different forces. Training error measures how well the model fits the examples it saw. Validation error measures whether that fit transfers to unseen data. A model with excess capacity can always drive training error toward zero by memorizing, but memorized noise does not transfer -- so validation error stays high. That gap is variance made visible.',
        'The key invariant: as training-set size grows, variance shrinks (more data constrains the model toward the true pattern) while bias stays constant (a linear model cannot learn a curved boundary no matter how much data it sees). This is why the two diseases respond to different treatments. More data attacks variance by averaging out noise across samples. More capacity attacks bias by expanding the hypothesis class. Regularization trades a little bias for a lot of variance reduction.',
        'The formal decomposition is: expected error = bias-squared + variance + irreducible noise. In practice you rarely compute each term exactly, but the learning curve reveals which term dominates. If the gap is large and narrowing, variance dominates. If both curves are fused and low, bias dominates. If both curves are fused and high, you may be near the noise floor -- the irreducible part that no model can fix.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A learning curve costs k * m training runs, where k is the number of cross-validation folds and m is the number of training-set sizes. For a cheap model (logistic regression, small random forest), m = 10 sizes with k = 5 folds finishes in minutes. For an expensive model (large neural network), m = 4 sizes with k = 1 (single held-out split) may be all you can afford. Even a rough curve with three points is more informative than no curve.',
        'Performance follows power-law scaling in many settings. Validation error often drops as error = a * n^(-alpha) + noise_floor, where n is training-set size and alpha is typically between 0.1 and 0.5 depending on the task and model class. This means each doubling of data buys a fixed percentage improvement until you approach the noise floor. Kaplan et al. (2020) showed that large language models follow remarkably clean power laws across data size, model size, and compute budget simultaneously -- loss scales as a power law in each resource when the others are held fixed, with exponents around 0.076 for data and 0.095 for parameters.',
        {
          type: 'note',
          text: 'Neural scaling laws (Kaplan 2020, Hoffmann/Chinchilla 2022) extended learning curves from a diagnostic tool to a planning tool. By fitting the power-law exponents on small runs, teams extrapolate how much data and compute a larger model will need before committing millions in training cost. The Chinchilla result showed that most large models were undertrained relative to their size -- a learning-curve diagnosis at planetary scale.',
        },
        'Data efficiency varies dramatically across domains. Vision models with strong augmentation can reach useful accuracy with hundreds of labeled examples. Language models follow steep power laws but need billions of tokens to saturate. Tabular models with good features often plateau early. The exponent alpha tells you how efficiently the model converts data into performance -- a steep curve (high alpha) means each new example teaches a lot; a shallow curve (low alpha) means diminishing returns set in early.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Learning curves earn their keep whenever labeling is expensive and the question is "should we collect more?" Medical imaging teams use them before commissioning another round of radiologist annotations. Fraud detection teams plot them to decide whether more transaction logs or better feature engineering will move the needle. Search ranking teams use them to compare whether a larger model or more click data has more runway left.',
        'They are also the primary tool for comparing model families at fixed data budgets. Plot learning curves for logistic regression, a random forest, and a neural network on the same dataset. The model whose validation curve is still climbing steeply at your current data size has the most to gain from more labels. The model whose curves have fused at a low ceiling is the wrong hypothesis class for this problem.',
        {
          type: 'bullets',
          items: [
            'Label budgeting: plot the curve before paying for another annotation round.',
            'Model selection: the model with the steepest validation climb at your data size has the most headroom.',
            'Regularization tuning: if the gap is large, try stronger regularization before collecting data.',
            'Scaling law extrapolation: fit the power law on small runs to predict large-run performance.',
            'Debugging data pipelines: a flat or declining validation curve can reveal label noise, leakage, or distribution mismatch.',
          ],
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Learning curves assume that the data distribution is stable. If the distribution shifts between the small and large training subsets -- because data was collected over time and the world changed -- the curve conflates data scaling with distribution drift. A model that improves with more data might be learning a newer pattern, not generalizing better.',
        'They can mislead when validation is contaminated. Duplicate examples across train and validation splits, preprocessing that sees the whole dataset, or hyperparameter tuning on the validation set all make the gap appear smaller than it is. The curve diagnoses the system you actually measured. If the measurement pipeline leaks, the diagnosis is wrong.',
        'The single-endpoint trap is common: a model at 86% looks promising, but the curve might be flat (no more headroom) or steep (still climbing fast). Always read the trend, not the last point. Double descent adds another wrinkle -- past the interpolation threshold where the model can memorize all training data, validation error can improve again. The classical U-shaped complexity curve still governs underparameterized models, but very large neural networks live on the far side of the peak. Know which regime you occupy before trusting the old rules.',
        'Finally, learning curves cannot diagnose problems that live outside the model: wrong evaluation metric, misspecified task, mislabeled ground truth, or missing input features. The curve tells you whether more data or more capacity will help with the current setup. It does not tell you whether the setup itself is asking the right question.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Hastie, Tibshirani, Friedman. "The Elements of Statistical Learning" (2009), Chapter 7 -- the canonical treatment of bias-variance decomposition and model selection.',
            'Kaplan et al. "Scaling Laws for Neural Language Models" (2020) -- power-law relationships between loss and data size, model size, and compute for transformers.',
            'Hoffmann et al. "Training Compute-Optimal Large Language Models" (Chinchilla, 2022) -- showed most LLMs were undertrained for their parameter count, a scaling-law diagnosis.',
            'scikit-learn documentation: sklearn.model_selection.learning_curve -- the standard implementation used in the code example above.',
          ],
        },
        'Study Cross-Validation first -- a learning curve is only as honest as its validation protocol. Then study Regularization (L1, L2, dropout) to understand the interventions the curve prescribes. Logistic Regression and Decision Trees are good test beds for generating your own high-bias and high-variance patients. For the modern extension, study double descent and neural scaling laws to see how learning curves behave past the classical interpolation threshold.',
        'The best exercise: train three models on the same dataset (a deliberately weak linear model, an unconstrained deep model, and a tuned middle-ground model), plot learning curves for each, write the diagnosis before changing anything, then apply the matching treatment and measure again. That loop -- diagnose, prescribe, treat, re-measure -- is the skill the plot is designed to build.',
      ],
    },
  ],
};

