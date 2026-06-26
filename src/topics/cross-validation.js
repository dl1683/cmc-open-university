// Cross-validation: the discipline of never grading your own homework.
// Train accuracy flatters, a single split gambles, and the test set is a
// one-shot resource — k-fold is how you spend data honestly.

import { matrixState, arrayState, InputError } from '../core/state.js';

export const topic = {
  id: 'cross-validation',
  title: 'Cross-Validation & Honest Evaluation',
  category: 'AI & ML',
  summary: 'Never grade your own homework: why train accuracy lies, one split gambles, and k-fold spends data honestly.',
  controls: [
    { id: 'view', label: 'Learn', type: 'select', options: ['why evaluation goes wrong', 'k-fold in motion'], defaultValue: 'k-fold in motion' },
  ],
  run,
};

// Validation accuracy per fold — one model, five rotations.
const FOLD_ACC = [0.78, 0.84, 0.71, 0.88, 0.8];
const CV_MEAN = FOLD_ACC.reduce((a, b) => a + b, 0) / FOLD_ACC.length;

function* goesWrong() {
  yield {
    state: matrixState({
      title: 'Three models, two report cards',
      rows: [
        { id: 'under', label: 'too simple (underfit)' },
        { id: 'sweet', label: 'just right' },
        { id: 'over', label: 'memorizer (overfit)' },
      ],
      columns: [{ id: 'train', label: 'accuracy on TRAINING data' }, { id: 'test', label: 'accuracy on NEW data' }],
      values: [[0.65, 0.63], [0.86, 0.83], [1.0, 0.52]],
      format: (v) => `${(v * 100).toFixed(0)}%`,
    }),
    highlight: { active: ['over:train'], removed: ['over:test'] },
    explanation: `The first lie in machine learning: grading a model on the data it trained on. Comparing ${3} models, the memorizer scored ${(1.0 * 100).toFixed(0)}% in training but only ${(0.52 * 100).toFixed(0)}% on new data -- a ${((1.0 - 0.52) * 100).toFixed(0)}-point gap. It did not learn the pattern; it learned the answer key. Training accuracy measures how well the model FIT the past; only held-out data measures whether it learned anything portable.`,
  };

  yield {
    state: arrayState(['split #1 â†’ 78%', 'split #2 â†’ 84%', 'split #3 â†’ 71%', 'split #4 â†’ 88%', 'split #5 â†’ 80%']),
    highlight: { compare: ['i2', 'i3'] },
    explanation: `Trap one: WHICH twenty percent you hide changes the grade. The SAME model across ${FOLD_ACC.length} random 80/20 splits scores from ${(Math.min(...FOLD_ACC) * 100).toFixed(0)}% to ${(Math.max(...FOLD_ACC) * 100).toFixed(0)}% -- a ${((Math.max(...FOLD_ACC) - Math.min(...FOLD_ACC)) * 100).toFixed(0)}-point swing on identical code and data. Statistics has a standard cure: take ${FOLD_ACC.length} samples and average -- which is exactly where k-fold is heading.`,
    invariant: `A single train/test split yields one sample of a random variable, not the model's true skill. The ${((Math.max(...FOLD_ACC) - Math.min(...FOLD_ACC)) * 100).toFixed(0)}-point swing proves it.`,
  };

  yield {
    state: arrayState(['peek #1: tune λ', 'peek #2: pick features', 'peek #3: try new model', 'peek #4: tweak threshold', 'test set is now training data']),
    highlight: { visited: ['i0', 'i1', 'i2', 'i3'], removed: ['i4'] },
    explanation: `Trap two, the subtle one: the test set WEARS OUT. After ${4} peeks (tune lambda, pick features, try new model, tweak threshold), "test" accuracy is quietly training accuracy with extra steps. The discipline: the test set is opened ONCE, at the very end, to grade the final chosen model. Everything before that -- every tuning decision -- must use ${FOLD_ACC.length}-fold cross-validation data instead. What other data? The next view.`,
  };
}

function* kFold() {
  const chunkCols = [1, 2, 3, 4, 5].map((i) => ({ id: `c${i}`, label: `chunk ${i}` }));
  for (let fold = 0; fold < 5; fold++) {
    const grid = Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => (r === c ? 1 : 0)));
    yield {
      state: matrixState({
        title: `Fold ${fold + 1} of 5 — validate on chunk ${fold + 1}, train on the rest`,
        rows: [1, 2, 3, 4, 5].map((i) => ({ id: `f${i}`, label: `fold ${i}${i - 1 < FOLD_ACC.length && i - 1 <= fold ? ` â†’ ${(FOLD_ACC[i - 1] * 100).toFixed(0)}%` : ''}` })),
        columns: chunkCols,
        values: grid,
        format: (v) => (v ? 'VALIDATE' : 'train'),
      }),
      highlight: {
        active: [`f${fold + 1}:c${fold + 1}`],
        visited: Array.from({ length: fold }, (_, i) => `f${i + 1}:c${i + 1}`),
      },
      explanation: fold === 0
        ? `K-FOLD CROSS-VALIDATION, the honest workhorse: cut the training data into ${FOLD_ACC.length} equal chunks. Round one: hide chunk 1, train on chunks 2-${FOLD_ACC.length}, grade on the hidden chunk -> ${(FOLD_ACC[0] * 100).toFixed(0)}%. The key move is what happens next: rather than trusting this one number, we ROTATE.`
        : fold < 4
          ? `Round ${fold + 1}: a fresh model trains from scratch on the other four chunks and is graded on chunk ${fold + 1} â†’ ${(FOLD_ACC[fold] * 100).toFixed(0)}%. Note the diagonal marching down the grid: by the end, EVERY example will have served on the jury exactly once and in the training pool four times. No data wasted, no example grading itself.`
          : `Final round â†’ ${(FOLD_ACC[fold] * 100).toFixed(0)}%. Five honest grades from five disjoint juries: ${FOLD_ACC.map((a) => (a * 100).toFixed(0) + '%').join(', ')}. Average: ${(CV_MEAN * 100).toFixed(1)}% — and, just as valuable, the SPREAD (71–88%) tells you how much one lucky split could have deceived you. That spread was invisible with a single split; k-fold measures its own noise.`,
      invariant: `Each of ${FOLD_ACC.length} chunks validates exactly once and trains in the other ${FOLD_ACC.length - 1} rounds -- every grade comes from unseen data.`,
    };
  }

  yield {
    state: matrixState({
      title: 'The payoff: choosing λ with CV (not with the test set)',
      rows: [
        { id: 'l0', label: 'λ = 0' },
        { id: 'l01', label: 'λ = 0.01' },
        { id: 'l1', label: 'λ = 0.1' },
        { id: 'l10', label: 'λ = 1' },
      ],
      columns: [{ id: 'cv', label: 'mean CV accuracy' }],
      values: [[0.74], [0.79], [0.83], [0.72]],
      format: (v) => `${(v * 100).toFixed(0)}%`,
    }),
    highlight: { found: ['l1:cv'], compare: ['l0:cv', 'l10:cv'] },
    explanation: `The payoff: who picks lambda? Answer: run the whole ${FOLD_ACC.length}-fold ritual once per candidate. Testing ${4} lambda values, lambda = 0.1 wins at 83%. Every number came from validation folds -- the test set is still sealed. The full protocol: choose lambda by ${FOLD_ACC.length}-fold CV, retrain on ALL training data with the winner, unseal the test set and grade ONCE.`,
  };

  yield {
    state: arrayState(['fit scaler on ALL data', 'split into folds', 'validate â†’ 94%!', 'deploy â†’ 76%', 'the scaler saw the answers']),
    highlight: { removed: ['i0', 'i4'], compare: ['i2', 'i3'] },
    explanation: `One last dragon: LEAKAGE. Normalizing data BEFORE splitting lets every fold preprocessing peek at its own validation chunk. CV reports a dreamy ${94}% but production delivers ${76}% -- a ${94 - 76}-point gap. The one rule: EVERY fitted step fits inside each of the ${FOLD_ACC.length} folds on that fold training portion only.`,
    invariant: `Anything fitted to data is part of the model -- and must never touch the fold that grades it across all ${FOLD_ACC.length} rounds.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'why evaluation goes wrong') yield* goesWrong();
  else if (view === 'k-fold in motion') yield* kFold();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. "Why evaluation goes wrong" walks through three traps: training accuracy that flatters, a single holdout split whose score depends on luck, and a test set that wears out after repeated peeking. "K-fold in motion" runs through the full 5-fold protocol, showing how the validation chunk rotates diagonally across the grid, then demonstrates hyperparameter selection and data leakage.',
        {
          type: 'callout',
          text: 'Cross-validation rotates the hidden data so every row gets an out-of-sample prediction without making one split the whole judge.',
        },
        'Active cells mark the current fold\'s validation chunk. Visited cells are folds already scored. Found cells mark the winning hyperparameter or correct protocol step. Removed cells flag dangerous mistakes -- a worn-out test set or a scaler that leaked information across folds.',
        'Watch the diagonal march in the k-fold view: each chunk moves from training to validation exactly once. That visual pattern is the invariant -- every row grades the model exactly once, and no row ever grades a model it helped train.',
        {type: 'image', src: './assets/gifs/cross-validation.gif', alt: 'Animated walkthrough of the cross validation visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'You have trained a model and want to know how well it will perform on data it has never seen. Training accuracy is useless for this -- a model that memorizes its training set scores 100% in training and collapses on new data. You need a score computed on examples the model was not allowed to touch during fitting.',
        'The simplest fix is a single train/test split. But the score you get depends on which examples happened to land in the test portion. Run the same model on five different 80/20 splits of the same data and you can easily see a 17-point swing. Cross-validation is the standard answer: rotate which portion is hidden, collect one score per rotation, and report the average and spread.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/K-fold_cross_validation_EN.svg/500px-K-fold_cross_validation_EN.svg.png',
          alt: 'K-fold cross-validation diagram with train and validation partitions rotating across folds',
          caption: 'K-fold cross-validation split diagram. Source: https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/K-fold_cross_validation_EN.svg/500px-K-fold_cross_validation_EN.svg.png',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first thing most people try is to report training accuracy: fit a model on 1,000 rows, predict those same 1,000 rows, count correct predictions. A flexible model (deep tree, large neural net) can memorize every row and report 100%. That number says nothing about tomorrow\'s data. It measures how well the model fits the past, not whether it learned a portable pattern.',
        'The second thing people try is a single holdout split. Set aside 200 of those 1,000 rows, train on 800, predict on 200, report the score. This is better -- the 200 rows were genuinely unseen. But the score is one sample from a random variable. A different random 200 rows could give a noticeably different number, especially with small or imbalanced data.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A single holdout has two problems. First, the score is noisy. With 1,000 rows split 80/20, the validation set is only 200 rows. The standard error of an accuracy estimate on 200 independent binary predictions at 80% true accuracy is sqrt(0.8 * 0.2 / 200) = 0.028, so roughly plus or minus 3 percentage points at one standard deviation. That is wide enough to make model comparison unreliable.',
        'Second, the test set wears out. Every time you peek at test-set performance, adjust a hyperparameter, and re-evaluate, you are fitting to the test set with extra steps. After four rounds of peeking (tune regularization, pick features, try a new model, tweak threshold), the "test" score has drifted toward an overestimate. The test set is a one-shot resource. Everything before the final evaluation must use something else.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The role of "unseen data" can rotate. Instead of permanently locking away one chunk for validation, partition the training data into k equal chunks. In round 1, hide chunk 1, train on chunks 2 through k, and score on chunk 1. In round 2, hide chunk 2, train on the rest, score on chunk 2. After k rounds, every row has been hidden exactly once and used for training exactly k-1 times.',
        'No individual fold model is the final deployed model. The fold models are disposable instruments for measurement. Once cross-validation picks the best hyperparameters, you retrain a single final model on all training data using the winning settings, then open the held-out test set exactly once to report the final number. Cross-validation is a model selection tool, not a training trick.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with n training rows. Assign each row a fold ID from 0 to k-1. For plain k-fold, the assignment is random. For stratified k-fold, each fold preserves the class proportions of the full dataset (important when one class is rare). For grouped data (multiple rows per patient or user), assign at the group level so the same person never appears on both sides of a fold. For time series, folds follow chronological order so the model never trains on the future.',
        'For each fold f from 0 to k-1: build a fresh pipeline from scratch using only the rows where fold ID is not f. "Fresh" means every fitted step -- scaler, imputer, encoder, feature selector, and the model itself -- fits only on the training portion of that fold. Then predict the rows where fold ID equals f and record the score. After all k rounds, you have k scores.',
        'Hyperparameter search wraps an outer loop around this procedure. For each candidate setting (say four values of a regularization parameter lambda), run all k folds and compute the mean CV score. Pick the setting with the best mean. The full protocol: select hyperparameters by k-fold CV, retrain on all training data with the winning settings, then unseal the test set and evaluate once.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Each validation prediction comes from a model that never saw that row during training. That is the entire source of the method\'s validity. A score computed on data the model was allowed to adapt to is contaminated -- it reflects memorization plus generalization, and you cannot separate the two. A score computed on genuinely hidden data reflects only generalization.',
        'Averaging k such scores reduces variance compared to a single holdout. The standard error of the mean of k fold scores shrinks roughly as 1/sqrt(k), though the fold scores are not fully independent (they share most of their training data). Equally important, the spread of fold scores is diagnostic: a model that scores 92%, 88%, 90%, 91%, 89% across five folds is stable. A model that scores 95%, 60%, 88%, 72%, 91% is unstable and probably overfitting to specific subsets.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'K-fold cross-validation trains k models instead of one. If one training run takes T seconds, the CV procedure takes roughly k * T seconds plus minor overhead for splitting and scoring. With k=5, you pay 5x the training cost. With k=10, you pay 10x. Leave-one-out (LOO, k=n) pays n training runs, which is usually too expensive except for very small datasets or models with closed-form shortcuts (linear regression has an exact LOO formula that costs no extra training).',
        'Memory cost depends on whether you keep all k models alive or discard each after scoring. Most implementations discard. The fold assignment vector is O(n) and the score table is O(k). The dominant cost is always training time, not memory.',
        'Nested cross-validation (for unbiased estimation of a selected model) adds another multiplier. An outer loop of k1 folds wraps an inner loop of k2 folds for hyperparameter search inside each outer fold. Total training runs: k1 * k2 * (number of hyperparameter candidates). For k1=5, k2=5, and 10 candidates, that is 250 training runs.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Cross-validation is the default evaluation protocol for tabular ML: logistic regression, gradient-boosted trees (XGBoost, LightGBM), random forests, SVMs, and nearest-neighbor models. Kaggle competitions, clinical ML studies, and credit-scoring validations all rely on it. It is also used to generate out-of-fold predictions for stacking ensembles, where the predictions from k fold models become features for a second-level model.',
        'Large deep learning systems (LLMs, large vision models) rarely use k-fold because a single training run takes days or weeks. They use a fixed validation split instead. But the discipline survives: the validation set is for development decisions, and the test set is opened once at the end. Any preprocessing or data curation step that learns from labels must still respect the split boundary.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Cross-validation fails when the split rule does not match how future data arrives. Random folds are wrong for time-series forecasting -- they let the model train on future data and validate on the past. Random row-level folds are wrong for medical data if the same patient appears in multiple folds, because the model sees the patient\'s patterns during training and then "predicts" the same patient in validation. Random folds are wrong for near-duplicate documents if copies end up on both sides.',
        'It also fails silently when preprocessing leaks across the fold boundary. Fitting a scaler on the full dataset before splitting means validation rows influenced the scaler\'s mean and variance. The animation demonstrates this: CV reports 94% but production delivers 76%, an 18-point gap caused by the scaler seeing data it should not have. Every fitted transformation must be re-fit inside each fold on the training portion only.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose you have 100 labeled rows and want to compare two models (logistic regression vs. a decision tree) using 5-fold CV. Assign each row a fold ID from 0 to 4. Each fold has 20 validation rows and 80 training rows.',
        'Logistic regression fold scores: 92%, 88%, 90%, 91%, 89%. Mean = 90.0%, standard deviation = 1.4%. Decision tree fold scores: 87%, 78%, 83%, 90%, 82%. Mean = 84.0%, standard deviation = 4.1%. Logistic regression wins on both mean score and stability. The tree\'s high variance (4.1% vs. 1.4%) suggests it is sensitive to which examples are in the training set -- a sign of overfitting.',
        'Now select regularization for the logistic regression. Test four values of lambda using the same 5-fold procedure: lambda=0 gives mean CV 74%, lambda=0.01 gives 79%, lambda=0.1 gives 83%, lambda=1 gives 72%. Lambda=0.1 wins. Retrain logistic regression with lambda=0.1 on all 100 rows. Open the held-out test set (say 50 rows, collected separately). Score once: 81%. That is your final reported number. The 2-point gap between CV mean (83%) and test (81%) is normal sampling noise.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Stone 1974 ("Cross-Validatory Choice and Assessment of Statistical Predictions") formalized the k-fold idea. Kohavi 1995 ("A Study of Cross-Validation and Bootstrap for Accuracy Estimation and Model Selection") ran large experiments and recommended k=10 as a practical default. ESLII Chapter 7 (Hastie, Tibshirani, Friedman) gives the full bias-variance analysis of cross-validation estimators.',
        'Study next: data leakage (why every fitted step must live inside the fold), bias-variance tradeoff (what fold means and spreads measure), bootstrap (resampling with replacement as an alternative to k-fold), nested cross-validation (unbiased estimation when hyperparameters are also selected), and time-series validation (expanding-window and sliding-window protocols for sequential data).',
      ],
    },
  ],
};
