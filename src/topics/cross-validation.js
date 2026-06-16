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
        `Cross-validation is the discipline of estimating how a model will behave on data it did not train on. Training accuracy can be pure self-flattery: the demo's memorizer gets 100% on training data and 52% on new data. A single random split can also be noisy: the same model scores 78%, 84%, 71%, 88%, and 80% across five splits. Cross-Validation & Honest Evaluation turns that lottery into a repeatable protocol: rotate which chunk validates, average the grades, and keep the final test set sealed until the end.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `In k-fold cross-validation, split the training data into k chunks, usually 5 or 10. The demo uses five chunks. Fold 1 trains a fresh model on chunks 2 through 5 and validates on chunk 1, scoring 78%. Fold 2 trains again on the other four chunks and validates on chunk 2, scoring 84%. Continue until every example has been in validation exactly once. The five validation scores are 78%, 84%, 71%, 88%, and 80%; the mean is 80.2%, and the 71-88 spread tells you how unstable one lucky split could be.`,
        `The payoff is clean model selection. To choose a value for Regularization: L1 & L2, the demo runs the full five-fold ritual for lambda = 0, 0.01, 0.1, and 1. The best mean validation score is 83% at lambda = 0.1. Only after that choice do you retrain on all training data and open the true test set once. Hyperparameter Search is allowed to spend validation folds; the test set is a one-shot final exam.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `If one training run costs T, k-fold costs about k*T for one setting. Four lambda values with five folds means 20 fits, not four. You usually keep only the final retrained model, not every fold model. The extra cost buys a mean score and a variance estimate, both more informative than one split. For small datasets the cost is worth it; for very large data, a single validation split may be enough, but the same chain-of-custody rules still apply.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Teams use cross-validation to tune Logistic Regression, Gradient Boosting, thresholds, feature sets, and preprocessing choices before committing to a test report. Imbalanced Data: When 99% Is One Class often needs stratified folds so each fold contains rare positives. Patient data needs grouped folds so one person's rows do not appear on both sides. Time-series forecasting needs temporal folds: train on the past, validate on the future. Learning Curves & Bias–Variance should also be measured on honest validation data, or its diagnosis is fiction.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The dangerous mistake is fitting preprocessing before the split. A scaler, imputer, feature selector, target encoder, or SMOTE step trained on all rows has already peeked at the validation fold. That is Data Leakage & Contamination, even if the cross-validation loop itself is written correctly. Every fitted step belongs inside the fold's training portion. Leakage-Safe Target Encoding Case Study shows the stricter version: training rows need out-of-fold category statistics, not a map fit on their own labels. Do not average fold models and call that the final model unless you intentionally build an ensemble. Do not keep checking the test set after each idea; repeated peeking turns it into training data with extra steps.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study A/B Testing & p-values after cross-validation when you need to know whether one model's improvement is statistically meaningful. Calibration & Reliability Diagrams checks whether validation probabilities mean what they claim. Data Leakage & Contamination is the audit checklist for keeping folds honest from raw data through final report. Leakage-Safe Target Encoding Case Study turns the same rule into a concrete categorical-feature pipeline.`,
      ],
    },
  ],
};
