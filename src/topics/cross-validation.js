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
    explanation: 'The first lie in machine learning: grading a model on the data it trained on. The memorizer in row three scored a perfect 100% in training — and 52%, a coin flip, on data it had never seen. It did not learn the pattern; it learned the answer key (Regularization showed the mechanism: unconstrained weights contort around every training point). Training accuracy measures how well the model FIT the past; only held-out data measures whether it learned anything portable. So: split the data, hide a test set, evaluate there. Solved? Not quite — two traps remain.',
  };

  yield {
    state: arrayState(['split #1 → 78%', 'split #2 → 84%', 'split #3 → 71%', 'split #4 → 88%', 'split #5 → 80%']),
    highlight: { compare: ['i2', 'i3'] },
    explanation: 'Trap one: WHICH twenty percent you hide changes the grade. Here is the SAME model evaluated on five different random 80/20 splits: 71% to 88% — a 17-point swing on identical code and identical data, pure luck of the draw. With small datasets a single split is a single noisy sample of the model\'s true skill. Report 88% because your split happened to be kind, and you have published luck. Statistics has a standard cure for "one sample is noisy": take several and average — which is exactly where k-fold is heading.',
    invariant: 'A single train/test split yields one sample of a random variable, not the model\'s true skill.',
  };

  yield {
    state: arrayState(['peek #1: tune λ', 'peek #2: pick features', 'peek #3: try new model', 'peek #4: tweak threshold', 'test set is now training data']),
    highlight: { visited: ['i0', 'i1', 'i2', 'i3'], removed: ['i4'] },
    explanation: 'Trap two, the subtle one: the test set WEARS OUT. Every time you check test accuracy and then change something — λ, features, architecture — information about the test set leaks into your choices. You become a slow gradient-descent algorithm optimizing on the test data, one peek at a time; after twenty peeks, "test" accuracy is quietly training accuracy with extra steps (the same garden-of-forking-paths that A/B Testing & p-values warns about). The discipline: the test set is opened ONCE, at the very end, to grade the final chosen model. Everything before that — every tuning decision — must be fed by other data. What other data? The next view.',
  };
}

function* kFold() {
  const chunkCols = [1, 2, 3, 4, 5].map((i) => ({ id: `c${i}`, label: `chunk ${i}` }));
  for (let fold = 0; fold < 5; fold++) {
    const grid = Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => (r === c ? 1 : 0)));
    yield {
      state: matrixState({
        title: `Fold ${fold + 1} of 5 — validate on chunk ${fold + 1}, train on the rest`,
        rows: [1, 2, 3, 4, 5].map((i) => ({ id: `f${i}`, label: `fold ${i}${i - 1 < FOLD_ACC.length && i - 1 <= fold ? ` → ${(FOLD_ACC[i - 1] * 100).toFixed(0)}%` : ''}` })),
        columns: chunkCols,
        values: grid,
        format: (v) => (v ? 'VALIDATE' : 'train'),
      }),
      highlight: {
        active: [`f${fold + 1}:c${fold + 1}`],
        visited: Array.from({ length: fold }, (_, i) => `f${i + 1}:c${i + 1}`),
      },
      explanation: fold === 0
        ? 'K-FOLD CROSS-VALIDATION, the honest workhorse: cut the training data into 5 equal chunks. Round one: hide chunk 1, train on chunks 2–5, grade on the hidden chunk → 78%. The key move is what happens next: rather than trusting this one number, we ROTATE.'
        : fold < 4
          ? `Round ${fold + 1}: a fresh model trains from scratch on the other four chunks and is graded on chunk ${fold + 1} → ${(FOLD_ACC[fold] * 100).toFixed(0)}%. Note the diagonal marching down the grid: by the end, EVERY example will have served on the jury exactly once and in the training pool four times. No data wasted, no example grading itself.`
          : `Final round → ${(FOLD_ACC[fold] * 100).toFixed(0)}%. Five honest grades from five disjoint juries: ${FOLD_ACC.map((a) => (a * 100).toFixed(0) + '%').join(', ')}. Average: ${(CV_MEAN * 100).toFixed(1)}% — and, just as valuable, the SPREAD (71–88%) tells you how much one lucky split could have deceived you. That spread was invisible with a single split; k-fold measures its own noise.`,
      invariant: 'Each chunk validates exactly once and trains in all other rounds — every grade comes from unseen data.',
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
    explanation: 'The payoff: Regularization left a dangling question — who picks λ? Answer: run the whole 5-fold ritual once per candidate. λ = 0 overfits (74%), λ = 1 over-squashes (72%), λ = 0.1 wins at 83%. Every number came from validation folds — the test set is still sealed. The full protocol: choose λ by CV → retrain on ALL training data with the winner → unseal the test set, grade ONCE, report that number. Hyperparameter tuning gets the renewable resource; final judgment gets the one-shot one.',
  };

  yield {
    state: arrayState(['fit scaler on ALL data', 'split into folds', 'validate → 94%!', 'deploy → 76%', 'the scaler saw the answers']),
    highlight: { removed: ['i0', 'i4'], compare: ['i2', 'i3'] },
    explanation: 'One last dragon: LEAKAGE. The classic blunder above — normalizing the data (fit a scaler, pick features, oversample) BEFORE splitting — lets every fold\'s preprocessing peek at its own validation chunk. The means and variances "know" the test answers; CV reports a dreamy 94% and production delivers 76%. The one rule that prevents it: EVERY fitted step — scaling, feature selection, SMOTE from Imbalanced Data, all of it — fits inside each fold on that fold\'s training portion only (pipelines exist to enforce exactly this). Same discipline at larger scale: time-series folds must split past→future, and grouped data (multiple rows per patient) must keep each patient on one side of the split. Evaluation is a chain of custody — one careless link and the number you report is fiction.',
    invariant: 'Anything fitted to data is part of the model — and must never touch the fold that grades it.',
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
      heading: `What it is`,
      paragraphs: [
        `Cross-validation is the discipline of evaluating a machine learning model honestly. It answers one critical question: how good will this model be on new data I have not seen? Training accuracy lies — a memorizer in the demo hit 100% on its training data but only 52% on new data, worse than a coin flip. A single train/test split is a lottery: the same model evaluated on five random 80/20 splits scored 71%, 84%, 78%, 88%, and 80% — a 17-point swing on identical code, pure luck. The test set is a one-shot resource: every time you peek at it and then change something (tune a knob, pick different features, try a new model), information leaks in, and after many peeks the "test" grade is secretly training accuracy. K-fold cross-validation solves all three problems at once: rotate through every chunk of your data so every example judges the model exactly once while training on all others, average the grades, and measure the spread as a noise estimate. Only then — after choosing everything by cross-validation — open the true test set once for final judgment.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Split your training data into k equal chunks (typically k = 5 or 10). In the demo, five 20-chunk rotation: round one, hide chunk 1, train a fresh model on chunks 2–5, grade it on the hidden chunk → 78%. Do not stop there — round two, hide a different chunk, train a new model from scratch on the other four, grade on chunk 2 → 84%. Keep rotating until every chunk has served as the validation set exactly once, and every example has trained the model four times and graded it once. At the end you have five grades — 78%, 84%, 71%, 88%, 80% — from five independent models, each trained on disjoint data and tested on data it never saw. Average them: 80.2%. The spread (71–88%) is gold: it shows how much a lucky or unlucky single split could have fooled you. That variance was invisible with one split; k-fold measures its own noise.`,
        `The real power: hyperparameter tuning by cross-validation, not by peeking at the test set. In the demo, you want to choose the regularization strength λ. Run the whole 5-fold ceremony once for λ = 0 (mean CV accuracy 74%), once for λ = 0.01 (79%), once for λ = 0.1 (83%), once for λ = 1 (72%). Pick the winner, λ = 0.1. Now retrain a single final model on ALL your training data with λ = 0.1, unseal the true test set, grade once, report that number. The test set was sealed the whole time — every decision came from the renewable resource (CV), not the one-shot resource (test). Cost: you train k models per CV run, and run CV once per hyperparameter, so a factor of k retrainings; Regularization's λ search with CV costs 5 × 4 = 20 training runs instead of four.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The biggest cost is training: if fitting one model takes time T, k-fold takes k × T because you train k fresh models (one per fold). For each hyperparameter candidate, multiply again. Testing time is cheap: you average the k validation scores. Storage: you only keep the final model (trained on all data), not the k fold-specific models. The spread (variance across folds) is a free noise estimate — no extra computation, it falls out of the averaging. For 10,000 examples, k = 5, and fitting the model taking 1 second, k-fold takes 5 seconds. For a grid search over 20 hyperparameter settings, 5 × 20 = 100 fits, or 100 seconds. With very large datasets, stratified k-fold keeps class proportions stable in each fold (or grouped k-fold keeps patients / related rows on the same side, crucial for medical data where one person has multiple test rows). Time-series data needs temporal folds: train on the past, validate on the future, never peek backward.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Every serious ML system uses cross-validation for hyperparameter tuning. Medical diagnosis models validate on patient cohorts to measure generalization to new patients. Fraud detection tunes decision thresholds on CV to balance false positive and false negative costs. Kaggle competitions use CV scores to pick the final model before the leaderboard test set. Time-series forecasting (predicting stock prices or weather) must use temporal CV: train on Jan–Jun, validate on Jul, train on Jan–Jul, validate on Aug, and so on, never training on future data. Patient-grouped CV ensures a model trained on one hospital's patients transfers to another; if you shuffle rows before splitting, the same patient appears in train and validation, and the model learns "how to predict this patient" rather than "how to predict patients." AutoML systems use CV inside nested loops: inner CV tunes the model, outer CV estimates the final accuracy to report honestly.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The most dangerous pitfall is leakage: fitting preprocessing (scaling, imputation, feature selection) BEFORE the split. In the demo, if you normalize the data on all examples and then split into folds, the scaler's means and variances "know" the test fold's answers, and CV reports a dreamy 94% while production delivers 76%. The one rule: EVERY fitted step (scaler, feature selector, oversampler) must fit inside each fold on that fold's training portion only, never touching the validation chunk. Pipelines exist to enforce exactly this. Another leakage mode: grouped data (multiple rows per patient or per household) split wrongly. If you shuffle then split, the same patient in train and validation means the model learns the patient's quirks, not the disease. Use stratified or grouped CV. Time-series: if you train on Jan–Oct and validate on Mar–Aug, you are training on future data; only temporal splits (train on Jan–Jul, validate on Aug–Dec) are valid. A third misconception: the CV spread is not model uncertainty — it is noise in the CV estimate itself. A spread of 71–88% does not mean each prediction is uncertain; it means the model is excellent but slightly sensitive to which data you happened to train on. Finally: CV tunes hyperparameters, not the test set. The test set opens once, at the very end, to grade the final chosen model. If you run CV, pick λ, then peek the test set, then run CV again on a different λ and peek again, you have burned the test set down to noise.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Cross-validation lives in a pipeline with Regularization: L1 & L2 — CV chooses the regularization strength that balances bias and variance. When you have picked a model by CV and graded it on the test set, run A/B Testing & p-values to determine if the improvement over a baseline is real or random. If your dataset is severely Imbalanced Data: When 99% Is One Class, stratified CV keeps class ratios stable in each fold, and you must validate by precision/recall, not accuracy. Logistic Regression is the simplest model most teams tune via CV. For large datasets, Calibration & Reliability Diagrams shows how to measure whether CV's reported accuracy matches real deployment accuracy — if not, the train and test distributions are drifting. Finally, if CV tuning becomes expensive, study active learning and Bayesian optimization to choose hyperparameters more efficiently.`,
      ],
    },
  ],
};

