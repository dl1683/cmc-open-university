// Data leakage: the answer key hiding inside the exam. Four ways the label
// sneaks into training, the too-good-to-be-true fingerprints that betray it,
// and the splitting discipline that keeps evaluations honest.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'data-leakage',
  title: 'Data Leakage & Contamination',
  category: 'AI & ML',
  summary: 'The answer key inside the exam: target leaks, split contamination, time travel, and benchmark pollution — and how to catch them.',
  controls: [
    { id: 'view', label: 'Audit', type: 'select', options: ['four ways the answer leaks', 'detection & defense'], defaultValue: 'four ways the answer leaks' },
  ],
  run,
};

function* fourLeaks() {
  const r2 = (v) => Math.round(v * 100) / 100;
  const abxImportance = 0.96;
  const aucLeaky = 0.99;
  const nFeatures = 4;
  const photoId = 4471;
  const nAugmentations = 3;  // original + mirrored + cropped
  const trainCopies = 2;
  const testCopies = 1;
  const nDays = 5;
  yield {
    state: matrixState({
      title: 'Leak 1 — TARGET LEAKAGE: a feature computed from the answer',
      rows: [
        { id: 'age', label: 'patient age' },
        { id: 'fever', label: 'fever on admission' },
        { id: 'cough', label: 'cough severity' },
        { id: 'abx', label: 'took_antibiotics âš ' },
      ],
      columns: [{ id: 'imp', label: 'feature importance' }, { id: 'when', label: 'known when?' }],
      values: [[0.02, 1], [0.01, 1], [0.01, 1], [0.96, 2]],
      format: (v) => (v === 1 ? 'at prediction time âœ“' : v === 2 ? 'AFTER diagnosis âœ—' : `${(v * 100).toFixed(0)}%`),
    }),
    highlight: { removed: ['abx:imp', 'abx:when'] },
    explanation: `Task: predict pneumonia from ${nFeatures} intake features. The model scores a jaw-dropping AUC of ${aucLeaky} — and one feature carries ${r2(abxImportance * 100)}% of the importance: took_antibiotics. Look at WHEN that feature gets its value: doctors prescribe antibiotics AFTER diagnosing pneumonia. The feature is the label's shadow — the model learned "patients treated for pneumonia have pneumonia," a tautology that scores brilliantly in training and is worthless at prediction time, when the prescription hasn't happened yet. TARGET LEAKAGE: any feature whose value is set by, after, or because of the outcome. The ${aucLeaky} was never skill; it was the answer key stapled to the exam.`,
    invariant: 'A feature is leaky if its value would not exist, unchanged, at the moment of prediction.',
  };

  yield {
    state: matrixState({
      title: 'Leak 2 — SPLIT CONTAMINATION: the same row on both sides',
      rows: [
        { id: 'orig', label: 'photo #4471' },
        { id: 'flip', label: 'photo #4471, mirrored' },
        { id: 'crop', label: 'photo #4471, cropped' },
      ],
      columns: [{ id: 'where', label: 'landed in' }],
      values: [[1], [2], [1]],
      format: (v) => ['', 'TRAINING set', 'TEST set âš '][v],
    }),
    highlight: { removed: ['flip:where'], compare: ['orig:where', 'crop:where'] },
    explanation: `Leak 2 is quieter: AUGMENT a dataset (flips, crops, paraphrases), THEN split randomly — and near-copies of the same photo land on both sides of the wall. In this example, photo #${photoId} appears in ${nAugmentations} forms — ${trainCopies} copies land in training, ${testCopies} in test. The test set now contains questions the model literally memorized the answers to, just mirrored. The grade inflates, sometimes massively — and Cross-Validation's machinery runs perfectly while measuring nothing, because the violation happened BEFORE the split. Rule: deduplicate and group FIRST, augment INSIDE the training side only, split at the entity level (patient, user, document — not row).`,
    invariant: 'Split before you augment; group before you split: near-duplicates must never straddle the wall.',
  };

  yield {
    state: matrixState({
      title: 'Leak 3 — TIME TRAVEL: training on Friday to predict Tuesday',
      rows: [
        { id: 'mon', label: 'Mon' },
        { id: 'tue', label: 'Tue (test!)' },
        { id: 'wed', label: 'Wed' },
        { id: 'thu', label: 'Thu' },
        { id: 'fri', label: 'Fri' },
      ],
      columns: [{ id: 'role', label: 'random split assigned' }],
      values: [[1], [2], [1], [1], [1]],
      format: (v) => ['', 'train', 'TEST âš  — model saw Wed–Fri'][v],
    }),
    highlight: { removed: ['tue:role'], visited: ['wed:role', 'thu:role', 'fri:role'] },
    explanation: `Leak 3 — TEMPORAL: split ${nDays} days of time-series data randomly and the model trains on Wednesday-through-Friday to "predict" Tuesday — it has seen the future it is being graded on. In this example, ${nDays - 1} of ${nDays} days go to training, and Tuesday becomes the test — but the model already saw Wed–Fri. Stock models are the famous victims, but the subtle version bites everyone: a rolling average computed over the WHOLE series before splitting injects future values into past rows. Every feature must be computable from strictly-before-the-timestamp data, and the split must be past to future, full stop.`,
    invariant: 'Temporal data splits along the arrow of time: everything in training strictly precedes everything in test.',
  };

  yield {
    state: matrixState({
      title: 'Leak 4 — BENCHMARK CONTAMINATION: the test in the training crawl',
      rows: [
        { id: 'crawl', label: 'pretraining crawl (trillions of tokens)' },
        { id: 'bench', label: 'public benchmark (MMLU, HumanEval…)' },
        { id: 'eval', label: 'evaluation day' },
      ],
      columns: [{ id: 'what', label: '' }],
      values: [[1], [2], [3]],
      format: (v) => ['', 'scrapes the open web — including answer discussions', 'published on the open web, with answers', 'model recites what it memorized'][v],
    }),
    highlight: { compare: ['crawl:what', 'bench:what'], removed: ['eval:what'] },
    explanation: `Leak 4 is the LLM era's version: benchmarks live on the public web — questions, answers, GitHub repos full of solutions, blog walkthroughs — and pretraining crawls scrape the public web. The exam was in the textbook. Contaminated models post inflated scores on the famous benchmarks while gaining nothing real; labs now publish n-gram-overlap "decontamination" reports, hold back private test splits, and rotate fresh evals. All ${nFeatures} leak types share the same fingerprint: performance you did not earn. When a model's benchmark score jumps but its behavior on YOUR task doesn't, contamination is the first suspect — the same too-good-to-be-true fingerprint as leak 1 (AUC ${aucLeaky}), at planetary scale.`,
  };
}

function* detectDefend() {
  const nFingerprints = 4;
  const nChecklistSteps = 5;
  const offlineScore = 94;
  const prodScore = 76;
  const scoreGap = offlineScore - prodScore;
  yield {
    state: matrixState({
      title: 'The fingerprints: how leakage betrays itself',
      rows: [
        { id: 'toogood', label: 'score too good, too fast' },
        { id: 'onefeat', label: 'one feature dominates' },
        { id: 'prodgap', label: 'great offline, bad in prod' },
        { id: 'recite', label: 'LLM recites benchmark text' },
      ],
      columns: [{ id: 'smell', label: 'what it smells like' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', '0.99 AUC on a hard problem at the first attempt', '96% importance — interrogate that feature\'s timestamp', 'CV said 94%, production says 76%', 'verbatim continuations of test items'][v],
    }),
    highlight: { active: ['toogood:smell'], compare: ['prodgap:smell'] },
    explanation: `Detection starts with calibrated suspicion: ${nFingerprints} fingerprints betray leakage. Hard problems do not yield ${0.99} AUC to a first attempt — celebrate for five minutes, then audit. The single-dominant-feature fingerprint is checkable in one line (feature importances, or the deletion test: remove the suspect, watch the score crater back to honest). The offline/production gap is the lagging indicator — CV said ${offlineScore}%, production says ${prodScore}%, a ${scoreGap}-point drop that means the model met honest data for the first time at launch.`,
    invariant: 'Leakage announces itself as performance you did not earn: audit windfalls before banking them.',
  };

  yield {
    state: matrixState({
      title: 'The defense checklist, in pipeline order',
      rows: [
        { id: 'dedup', label: '1. deduplicate & group by entity' },
        { id: 'split', label: '2. split (time-aware if temporal)' },
        { id: 'fit', label: '3. fit ALL preprocessing inside train' },
        { id: 'feat', label: '4. timestamp-audit every feature' },
        { id: 'seal', label: '5. seal the test set' },
      ],
      columns: [{ id: 'why', label: 'guards against' }],
      values: [[1], [2], [3], [4], [5]],
      format: (v) => ['', 'leak 2: twins straddling the wall', 'leak 3: training on the future', 'scalers/SMOTE peeking (Cross-Validation\'s dragon)', 'leak 1: features born after the label', 'the wear-out from repeated peeking'][v],
    }),
    highlight: { active: ['dedup:why', 'split:why'] },
    explanation: `The defense is ORDERING: all ${nChecklistSteps} steps must happen in sequence. Leakage is almost always a pipeline step executed too early (augmenting before splitting, scaling before folding, featurizing before timestamp-checking). Step 4 of ${nChecklistSteps} deserves its ritual sentence, asked of every feature in the schema: "would this value exist, exactly as stored, at the moment we need the prediction?" If the answer involves the future, the outcome, or the whole dataset, the feature is contraband. Teams that institutionalize this question catch leaks in code review; teams that do not catch them in incident review.`,
  };

  yield {
    state: matrixState({
      title: 'Why this is THE silent killer',
      rows: [
        { id: 'silent', label: 'no error message' },
        { id: 'reward', label: 'it REWARDS you' },
        { id: 'late', label: 'discovered in production' },
      ],
      columns: [{ id: 'note', label: '' }],
      values: [[1], [2], [3]],
      format: (v) => ['', 'every test green, every metric beautiful', 'leaky models WIN model selection — they score highest', 'the first honest evaluation is the launch'][v],
    }),
    highlight: { removed: ['reward:note'] },
    explanation: `The closing warning, and the reason this page exists: leakage is the only bug that makes your dashboard BETTER. Nothing crashes; the metrics improve; the leaky model beats every honest candidate in selection (it is the best cheater in the room), so process actively promotes it. All ${nFingerprints} fingerprints share one trait: performance you did not earn — ${offlineScore}% offline vs ${prodScore}% in production, a ${scoreGap}-point gap. Kaggle competitions have been won and then voided over leaks; published medical models have collapsed on real patients; the pattern survives because the incentive gradient points toward it. An evaluation is an experiment, and an experiment contaminated is an experiment not run.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'four ways the answer leaks') yield* fourLeaks();
  else if (view === 'detection & defense') yield* detectDefend();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. "Four ways the answer leaks" walks through four distinct leak types: target leakage, split contamination, temporal leakage, and benchmark contamination. Each frame is a matrix showing features, rows, or timeline entries, with red highlights marking the contaminated element. "Detection & defense" then shows the fingerprints that betray leakage and the ordered checklist that prevents it.',
        'In each matrix, red-highlighted cells are the violation. Compare cells mark items that should be independent but are connected by leaked information. Active cells mark the current focus of the audit. Read each frame by asking: what information crossed a boundary it should not have, and when in the pipeline did the crossing happen?',
        'Watch the first view to build intuition for the four shapes leakage takes, then watch the second view to learn the systematic defense. The defense checklist is ordered because leakage is almost always a pipeline step executed too early.',
        {type: 'image', src: './assets/gifs/data-leakage.gif', alt: 'Animated walkthrough of the data leakage visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A machine learning model is only useful if it predicts well on data it has never seen. To measure that, you hold out a test set, train on the rest, and score the model on the holdout. This works only if the test set is truly unseen -- if no information from it leaked into training. Data leakage is any violation of that separation.',
        { type: 'callout', text: 'Leakage is a chain-of-custody failure: information crosses the prediction boundary before evaluation begins.' },
        'Leakage is the most dangerous bug in applied ML because it makes your metrics better, not worse. Nothing crashes. Every test passes. Cross-validation reports high scores. Model selection picks the leaked model because it looks like the best candidate. The team ships it, and the first honest evaluation happens in production, on real users, real patients, or real money. By that point the damage is done.',
        'This page teaches four distinct ways information leaks, the fingerprints that betray each one, and the pipeline ordering that prevents all of them.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The standard ML pipeline looks like this: collect data, engineer features, augment, scale, split into train and test, then train. Every individual step is correct. The bug is in the ordering. If you fit a scaler on the full dataset before splitting, the scaler\'s mean and variance encode information about test rows. If you augment before splitting, near-copies of the same original can land on both sides. If you compute a rolling average over an entire time series before splitting, future values leak into past rows.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Traintest.svg/960px-Traintest.svg.png', alt: 'Training and test sets with different fitted model curves', caption: 'The train-test wall only works if preprocessing, augmentation, grouping, and feature fitting do not cross it. Source: https://en.wikipedia.org/wiki/Training,_validation,_and_test_data_sets.' },
        'Another common mistake is trusting the metric because the code ran without errors. Leakage is not a runtime bug. It is a logical bug -- the code does exactly what you told it, but you told it to use information that would not exist at prediction time. The question is never "did the pipeline execute correctly?" It is "was every value legally knowable at the moment the prediction would be made?"',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the prediction boundary: an imaginary line between what the model is allowed to know and what it must predict. Everything on the training side of the wall is legal input. Everything on the test side must be invisible during training. Everything generated after the prediction timestamp must be invisible at prediction time. The wall has one invariant: no information flows from the forbidden side to the allowed side, ever, at any pipeline stage.',
        'Here is one sequence that breaks the invariant. You have 1,000 patient records. You compute a feature "average lab value for this patient" using all visits including future ones. You split randomly. You train. The model now uses future lab results to predict a past diagnosis. Cross-validation reports 0.95 AUC. In production, where only past visits are available, the same model scores 0.72. The 0.23 gap is exactly the value of the leaked future information.',
        'Once the wall is broken, every downstream metric is untrustworthy. You cannot fix it by retraining on the same features -- the contamination is in the feature construction, not the model weights. You must rebuild the feature pipeline with point-in-time correctness and re-split from scratch.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Every prediction has a knowledge boundary defined by two coordinates: identity (which entities are in train vs. test) and time (what information existed before the prediction moment). Leakage is any violation of either coordinate. Target leakage violates time: a feature is computed from the outcome that has not happened yet. Split contamination violates identity: the same entity appears on both sides. Temporal leakage violates time at the row level: future rows train a model tested on past rows. Benchmark contamination violates identity at scale: test questions appear in the training corpus.',
        'All four reduce to one sentence: the model saw information it should not have had. The prevention reduces to one discipline: order your pipeline so that every step respects the knowledge boundary. Deduplicate and group by entity first. Split second (by time if temporal). Fit all preprocessing inside the training side only. Audit every feature with the question: "would this exact value exist, unchanged, at the moment I need the prediction?" That single question catches most leaks before they reach a model.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Target leakage works like this: you build a pneumonia predictor with four features -- age, fever, cough severity, and took_antibiotics. The model reports 0.99 AUC, and took_antibiotics carries 96% of the feature importance. The reason is that doctors prescribe antibiotics after diagnosing pneumonia. The feature is a consequence of the label, not a predictor of it. The model learned "patients treated for pneumonia have pneumonia" -- a tautology that scores perfectly in training and is useless at prediction time, when no treatment has been prescribed yet.',
        'Split contamination works like this: you augment an image dataset (flips, crops, color jitter), then split randomly. Photo #4471 appears in three forms -- the original and a crop land in training, the mirror lands in test. The test is now asking the model to classify an image it has already memorized, just reflected. Accuracy inflates because the test is not testing generalization; it is testing recall.',
        'Temporal leakage works like this: you have five days of stock data and split randomly. Tuesday lands in the test set, but Wednesday through Friday land in training. The model trained on the future to predict the past. Any feature computed as a rolling window over the full series before splitting injects the same violation more subtly.',
        'Benchmark contamination works like this: a public benchmark\'s questions, answers, and solution code live on the open web. A large language model\'s pretraining crawl scrapes that web. On evaluation day, the model recites memorized answers. The benchmark score measures memorization, not reasoning. The exam was in the textbook.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The defense works because it preserves the knowledge boundary at every pipeline stage. The argument is straightforward: if no information from the test side or from the future crosses into training at any step, then the model\'s test-time performance is an honest estimate of its production performance. Each defense step maintains this invariant for a specific leak type.',
        'Deduplication and entity grouping before splitting guarantee that no near-duplicate straddles the wall (prevents split contamination). Time-ordered splitting guarantees that training data strictly precedes test data (prevents temporal leakage). Fitting preprocessing inside the training fold guarantees that scalers, encoders, and imputers never see test statistics (prevents a subtle form of target leakage through global statistics). Timestamp-auditing every feature guarantees that no value is computed from post-outcome data (prevents target leakage). Sealing the test set prevents repeated peeking from wearing out the holdout.',
        'The corner case is preprocessing that seems harmless but leaks. StandardScaler fitted on the full dataset shifts each test value by a mean that includes test rows. The shift is tiny per sample, but across thousands of features and folds, it systematically inflates cross-validation scores. The fix is trivial: fit on training, transform on test. But forgetting this one step is one of the most common leakage sources in practice.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Leak prevention costs pipeline discipline, not compute. The main costs are: (1) maintaining feature availability timestamps for every column in your schema, (2) implementing point-in-time joins instead of simple table joins, (3) running deduplication and entity grouping before every split, and (4) fitting preprocessing inside each cross-validation fold separately, which means your scaler runs K times instead of once. For a dataset with F features and N rows split into K folds, the overhead of per-fold fitting is O(K * F * N) instead of O(F * N) -- a constant factor of K, typically 5 or 10.',
        'Grouped splits reduce effective training set size. If you group by patient and 200 of your 1,000 patients land in test, you train on 800 patients, not 800 rows -- potentially many fewer rows if patients have multiple visits. Time-based splits can make validation harder because the future distribution may drift from the past. Private test sets are harder to share across teams. Strict benchmark decontamination can remove genuinely useful examples. These costs are real, but every one of them is smaller than optimizing against an invalid evaluation and shipping a model that fails on contact with reality.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Clinical ML pipelines enforce point-in-time feature construction because the cost of a leaked model in healthcare is a misdiagnosis. A hospital readmission predictor trained with post-discharge lab results will score well offline and fail in the ER, where those labs have not been ordered yet. HIPAA-grade ML platforms now require feature availability metadata as part of the schema.',
        'Kaggle competitions have been won and then voided because the winning solution exploited a leak in the competition data. The most famous cases involve target-encoded features that were computed using the test labels, or metadata (file creation timestamps, row ordering) that correlated with the target. Competition platforms now run automated leak detection on hosted datasets.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Simplified_neural_network_training_example.svg/250px-Simplified_neural_network_training_example.svg.png', alt: 'Simplified neural network training diagram with feature signals feeding classes', caption: 'Feature audits ask which training signals dominate the model and whether those signals would exist at prediction time. Source: https://en.wikipedia.org/wiki/Training,_validation,_and_test_data_sets.' },
        'LLM evaluation labs maintain private benchmark splits and run n-gram overlap decontamination against known test sets. When a model\'s score on a public benchmark jumps but its performance on private tasks does not, contamination is the first hypothesis. The defense is imperfect -- paraphrased answers evade n-gram matching -- but it catches the most blatant cases and forces transparency about what the score actually measures.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Do not treat every strong feature as a leak. Some signals are genuinely predictive. Fever at admission is a strong predictor of infection and is legally available at prediction time -- deleting it would hurt the model for no reason. The audit question is always about timing and causality, not about magnitude. A feature with 40% importance is fine if its value exists at prediction time; a feature with 5% importance is illegal if it was computed from the outcome.',
        'A clean training script does not guarantee clean data. Leakage often lives upstream: in the SQL join that pulls post-outcome rows, in the ETL job that backfills missing values with future data, in the label table that was updated retroactively, or in the augmentation step that ran before the split. Auditing the model code while ignoring the data pipeline is like checking the exam room while ignoring that the answer key was emailed to students last night.',
        'Sealed test sets wear out. If a team repeatedly evaluates candidate models on the same holdout, tunes hyperparameters to improve that specific holdout score, and selects the winner based on holdout performance, the holdout has become an implicit part of training. The defense is nested validation (tune on an inner holdout, evaluate on an outer one), fresh holdouts rotated periodically, or a final test set with strictly limited access -- used once, for the ship decision.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose you are building a 30-day hospital readmission predictor. Your dataset has 10,000 discharge records for 4,000 patients, with 50 features per record.',
        'Step 1: Timestamp audit. You check every feature\'s availability time. You find that "total_charges" includes charges posted up to 45 days after discharge (billing lag). That feature encodes post-discharge events. You rebuild it as "charges_at_discharge" using only line items posted before the discharge timestamp. This catches target leakage.',
        'Step 2: Entity grouping. Patient #2071 has 6 discharge records. If you split randomly, 4 might land in train and 2 in test. The model memorizes patient #2071\'s pattern and "predicts" their test records from memory. You group by patient_id and assign entire patients to train or test. This catches split contamination.',
        'Step 3: Time-ordered split. You sort by discharge date. The first 80% of dates go to training, the next 20% go to test. This prevents training on December to predict October. This catches temporal leakage.',
        'Step 4: Per-fold preprocessing. Inside each cross-validation fold, you fit StandardScaler on the training portion and transform the validation portion. You fit SMOTE oversampling on the training portion only. You never touch the test set during any of this.',
        'Step 5: Evaluation. Before the fix, cross-validation reported 0.91 AUC. After the fix, it reports 0.78 AUC. The 0.13 drop is the exact value of the information that was leaking. The 0.78 is the model\'s honest skill. When you deploy, production AUC is 0.76 -- a 0.02 gap instead of a 0.15 gap. The model is worse on paper and better in reality.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The foundational reference is Kaufman et al., "Leakage in Data Mining: Formulation, Detection, and Avoidance" (2012), which formalized the taxonomy of leak types and introduced the concept of legitimate vs. illegitimate features based on temporal availability. For benchmark contamination specifically, see Jacovi et al., "Stop Uploading Test Data in Plain Text" (2023) and the decontamination methodology sections of major LLM technical reports.',
        'Study Cross-Validation next to understand how per-fold fitting prevents preprocessing leakage. Study Feature Store design to learn how production systems enforce training-serving consistency. Study ROC Curves and AUC to calibrate your suspicion when a score looks too good. Study Point-in-Time Feature Joins for the SQL patterns that prevent temporal leakage in data warehouses. Study Imbalanced Data to understand why SMOTE applied before splitting is a leak. Study A/B Testing for the online experiment that may become the first honest evaluation after an offline pipeline is cleaned up.',
      ],
    },
  ],
};

