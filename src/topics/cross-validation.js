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
    state: arrayState(['split #1 â†’ 78%', 'split #2 â†’ 84%', 'split #3 â†’ 71%', 'split #4 â†’ 88%', 'split #5 â†’ 80%']),
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
        ? 'K-FOLD CROSS-VALIDATION, the honest workhorse: cut the training data into 5 equal chunks. Round one: hide chunk 1, train on chunks 2–5, grade on the hidden chunk â†’ 78%. The key move is what happens next: rather than trusting this one number, we ROTATE.'
        : fold < 4
          ? `Round ${fold + 1}: a fresh model trains from scratch on the other four chunks and is graded on chunk ${fold + 1} â†’ ${(FOLD_ACC[fold] * 100).toFixed(0)}%. Note the diagonal marching down the grid: by the end, EVERY example will have served on the jury exactly once and in the training pool four times. No data wasted, no example grading itself.`
          : `Final round â†’ ${(FOLD_ACC[fold] * 100).toFixed(0)}%. Five honest grades from five disjoint juries: ${FOLD_ACC.map((a) => (a * 100).toFixed(0) + '%').join(', ')}. Average: ${(CV_MEAN * 100).toFixed(1)}% — and, just as valuable, the SPREAD (71–88%) tells you how much one lucky split could have deceived you. That spread was invisible with a single split; k-fold measures its own noise.`,
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
    explanation: 'The payoff: Regularization left a dangling question — who picks λ? Answer: run the whole 5-fold ritual once per candidate. λ = 0 overfits (74%), λ = 1 over-squashes (72%), λ = 0.1 wins at 83%. Every number came from validation folds — the test set is still sealed. The full protocol: choose λ by CV â†’ retrain on ALL training data with the winner â†’ unseal the test set, grade ONCE, report that number. Hyperparameter tuning gets the renewable resource; final judgment gets the one-shot one.',
  };

  yield {
    state: arrayState(['fit scaler on ALL data', 'split into folds', 'validate â†’ 94%!', 'deploy â†’ 76%', 'the scaler saw the answers']),
    highlight: { removed: ['i0', 'i4'], compare: ['i2', 'i3'] },
    explanation: 'One last dragon: LEAKAGE. The classic blunder above — normalizing the data (fit a scaler, pick features, oversample) BEFORE splitting — lets every fold\'s preprocessing peek at its own validation chunk. The means and variances "know" the test answers; CV reports a dreamy 94% and production delivers 76%. The one rule that prevents it: EVERY fitted step — scaling, feature selection, SMOTE from Imbalanced Data, all of it — fits inside each fold on that fold\'s training portion only (pipelines exist to enforce exactly this). Same discipline at larger scale: time-series folds must split pastâ†’future, and grouped data (multiple rows per patient) must keep each patient on one side of the split. Evaluation is a chain of custody — one careless link and the number you report is fiction.',
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
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for Cross-Validation & Honest Evaluation. Never grade your own homework: why train accuracy lies, one split gambles, and k-fold spends data honestly..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: `What Cross-Validation Is`,
      paragraphs: [
        `Cross-validation is a protocol for estimating how a model will perform on examples it did not use for fitting. That sounds modest, but it is one of the central disciplines in machine learning. A model can look excellent on its training data because it memorized quirks, repeated rows, label leakage, or accidental shortcuts. Cross-validation forces the model to answer a stricter question: if we hide some training examples, fit the model without them, and then ask the fitted model to predict the hidden examples, how well does the pattern survive?`,
        `The usual k-fold version splits the available training data into k folds. Each round holds out one fold for validation and trains a fresh model on the other folds. After k rounds, every example has served once as validation data and k minus one times as training data. The fold scores are averaged, and their spread is kept as evidence about stability. The result is not a magic truth number. It is a better estimate than training accuracy and usually a less arbitrary estimate than one random train-validation split.`,
      ],
    },
    {
      heading: `The wall`,
      paragraphs: [
        `The obvious approach is to train a model and report how many training examples it got right. That fails because training data is the material the model was allowed to adapt to. A flexible model can store exceptions instead of learning a general rule. Even a simple model can benefit from preprocessing choices, feature engineering, and thresholds that were tuned after looking at the same rows. Training accuracy answers, "Did the model fit this table?" It does not answer, "Will the model work tomorrow?"`,
        `The next obvious approach is a single holdout split: train on 80 percent and validate on 20 percent. That is better, but it introduces a second wall. The estimate now depends on which examples happened to land in the holdout set. With a small dataset, one split may be too easy because it contains many typical examples, or too hard because it contains rare cases and outliers. Two honest splits can give noticeably different scores. Cross-validation is the standard response to this sampling noise: do several honest splits according to a fixed rule and summarize them together.`,
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `The core insight is that validation data must be unseen by the fitted model, but the role of unseen can rotate. You do not need to permanently sacrifice one chunk of scarce data for validation during model selection. You can train several models, each hiding a different chunk, and use the hidden-chunk scores as repeated measurements of generalization. No individual fold model is usually the final deployed model. The fold models are instruments for measurement.`,
        `This distinction matters. Cross-validation is not a way to train one better model by exposing it to everything. It is a way to choose modeling decisions under controlled evidence. Once the modeling decision is chosen, you normally retrain a final model on all available training data and then evaluate once on a separate test set that was not used during selection.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `A clean implementation is mostly bookkeeping. Start with a row index for the dataset. Build a fold assignment vector that maps each row to a fold id from 0 to k minus 1. For ordinary classification, stratified k-fold keeps class proportions similar across folds. For grouped data, the assignment is made at the group level so rows from the same patient, user, account, document, or machine do not appear on both sides of a fold. For time series, the fold plan is chronological rather than randomly shuffled.`,
        `Each fold creates two index sets: train indexes and validation indexes. The pipeline is cloned or rebuilt from scratch for that fold. Every fitted step runs only on the train indexes: imputers, scalers, tokenizers with learned vocabularies, target encoders, feature selectors, oversamplers, dimensionality reducers, and the estimator itself. The fitted pipeline then predicts the validation indexes. The score for that fold is appended to a score table that stores fold id, hyperparameters, metric values, sample counts, and sometimes confusion-matrix cells or calibration bins.`,
        `Hyperparameter search wraps another loop around this procedure. For each candidate setting, run all folds and compute the mean and spread. The selected setting is the one with the best validation evidence under the chosen metric and tie-breaking rule. If the search itself is expensive, teams may use randomized search, Bayesian optimization, early stopping, or successive halving, but the same fold isolation rule applies.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `Cross-validation works because it separates fitting from grading repeatedly. Each validation prediction is made by a model that did not train on that row. That gives every row an out-of-sample prediction, which is far more informative than an in-sample prediction. Averaging across folds reduces dependence on one unlucky split, and comparing fold scores reveals instability that a single score hides.`,
        `The method also makes bias-variance tradeoffs visible. A model that is too simple will underperform in most folds. A model that overfits may show high training performance but inconsistent validation performance. A preprocessing idea that only helps because it leaked labels will look good in a careless implementation and then collapse when every fitted operation is moved inside the fold. Cross-validation is therefore both a measurement tool and a leak detector.`,
      ],
    },
    {
      heading: `How it works (2)`,
      paragraphs: [
        `The minimum report is not just mean accuracy. Report the metric that matches the task, the number of folds, the split rule, the fold scores or standard deviation, and whether preprocessing was folded into the pipeline. For imbalanced classification, accuracy is often the wrong target; use precision, recall, F1, area under the precision-recall curve, cost-weighted loss, or a threshold selected on validation data. For probability models, check log loss, Brier score, and calibration, not only rank metrics. For regression, inspect mean absolute error, root mean squared error, residual patterns, and performance by important slices.`,
        `Operationally, strong cross-validation scores are only one gate. Compare validation performance with final test performance. A large gap can mean distribution shift, leakage in validation, an unlucky test set, or over-selection during hyperparameter search. Compare fold performance by time, geography, user segment, device type, label source, or data vendor. Watch for high variance across folds because it tells you the model depends heavily on which examples are available. In production, monitor the same slices again with live outcomes, drift statistics, missing-feature rates, and calibration decay. Cross-validation estimates launch risk; it does not eliminate post-launch monitoring.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Cross-validation is most useful when data is limited, model selection matters, and the training process is affordable enough to repeat. It is common for tabular models, logistic regression, gradient boosting, support vector machines, nearest-neighbor methods, small neural networks, classical NLP pipelines, and scientific datasets where a single split would waste too much evidence. It is also useful for estimating out-of-fold predictions that feed stacking ensembles, target encoding, model diagnostics, and unbiased residual analysis.`,
        `Large deep learning systems often use a fixed validation set instead because each training run is expensive and datasets are huge. Even there, the philosophy survives. The validation set is for development. The test set is for final judgment. Any preprocessing or data curation decision that can learn from labels must respect the split boundary.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `Cross-validation fails when the split rule does not match the way future data arrives. Random folds are wrong for forecasting if they let the model train on the future and validate on the past. Random row folds are wrong for medical or user behavior data if the same person appears in multiple folds. Random folds are wrong for near-duplicate documents if copies cross the boundary. In each case, the validation rows are technically hidden but practically familiar.`,
        `It also fails when the test set is reused as a development tool. If you run cross-validation, pick a model, open the test set, dislike the result, change the features, and try again, the test set has joined the tuning loop. Another failure is using cross-validation to hide weak problem formulation. If labels are noisy, features are unavailable at serving time, or the deployment distribution differs from the training collection, a neat fold table can still describe the wrong world.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study data leakage to understand why split boundaries must cover preprocessing, labels, and feature availability. Study bias and variance to interpret fold means and spreads. Study calibration when predictions are probabilities rather than only rankings. Study A/B testing when an offline validation win must be confirmed against real users. Study time-series validation, grouped validation, and nested cross-validation when the simple k-fold recipe is too optimistic for the structure of the data.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Train on all data, test on all data: 100% accuracy! But that is memorization, not learning. Hold-out: split data 80/20 (train/test). Problem: which 20%? Different splits give different results. If your dataset has 100 examples, a "lucky" split might include all easy examples in the test set.',
        'K-fold cross-validation: split data into k equal folds. Train on k−1 folds, test on the remaining fold. Repeat k times, each fold serving as test once. Average the k scores for a robust estimate. k=5 or k=10 is standard.',
        'Leave-one-out (LOO): k=n — train on n−1, test on 1, repeat n times. Minimum bias but expensive: n training runs. Stratified k-fold: preserve class proportions in each fold (important for imbalanced datasets).',
        'Cross-validation answers: "how well will this model generalize?" — not "what is the final model?" The final model trains on all data.',
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        '100 samples, 5-fold CV. Each fold: 20 test, 80 train. Fold accuracies: [92%, 88%, 90%, 91%, 89%]. CV score: mean = 90.0%, std = 1.4%.',
        {
          type: 'bullets',
          items: [
            'Can you explain why this is more reliable than a single 80/20 split? Any single split could be lucky or unlucky; 5 independent estimates reduce variance.',
            'Can you explain why you should NOT use cross-validation scores to report final test accuracy? CV is for model selection; final evaluation needs a held-out set never used during selection.',
            'Can you explain nested cross-validation? Outer loop: estimate generalization. Inner loop: select hyperparameters. Prevents information leakage.',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Dataset: 12 samples, 3 classes (4 each). 3-fold stratified CV. Fold 1: test=[s1,s5,s9,s12], train=rest. Fold 2: test=[s2,s6,s10,s11], train=rest. Fold 3: test=[s3,s4,s7,s8], train=rest. Each fold has roughly 1–2 examples per class.',
        'Accuracies: [75%, 100%, 75%]. CV score: 83.3% ± 11.8%. High variance (11.8%) — too few samples for reliable estimation.',
        'Compare to LOO (k=12): 12 training runs, each on 11 samples. LOO accuracy might be 83.3% with lower variance. Tradeoff: LOO is 4× more expensive (12 vs 3 runs) but more stable.',
      ],
    },

    {
      heading: 'Sources and study next',
      paragraphs: [
        'Stone 1974 (Cross-Validatory Choice) formalized k-fold. Kohavi 1995 (A Study of Cross-Validation and Bootstrap) recommended k=10. ESLII Chapter 7 (Hastie, Tibshirani & Friedman) covers model selection and bias-variance.',
        'Study next: Train-Test Split (simpler but less robust). Bootstrap (resampling with replacement). Bias-Variance Tradeoff (what cross-validation helps estimate). Hyperparameter Tuning (nested cross-validation). Regularization (prevents the overfitting that cross-validation detects).',
      ],
    },
],
};

