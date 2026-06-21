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
        "Read the animation as the execution trace for Data Leakage & Contamination. The answer key inside the exam: target leaks, split contamination, time travel, and benchmark pollution — and how to catch them..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      
        {type: 'image', src: './assets/gifs/data-leakage.gif', alt: 'Animated walkthrough of the data leakage visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: `Why this exists`,
      paragraphs: [
        `Data leakage is the evaluation bug that rewards you for being wrong. Information that will not be available at prediction time sneaks into training, validation, or test data. The model scores beautifully because the answer key is already present in the exam. Then the same model fails in production, where the answer key is gone.`,
        { type: 'callout', text: `Leakage is a chain-of-custody failure: information crosses the prediction boundary before evaluation begins.` },
        `This page exists because leakage is easy to miss and hard to forgive. Nothing crashes. Cross-validation runs. Metrics improve. Model selection chooses the cheater because it looks best. A team can ship a model with high offline scores and only discover the truth when real users, real patients, real trades, or real customers produce the first honest evaluation.`,
      ],
    },
    {
      heading: `The obvious approach`,
      paragraphs: [
        `The naive approach is to gather all rows, compute all useful features, augment the data, scale everything, split randomly, and train. That pipeline feels clean because every step is common. It is also the pipeline that leaks. A scaler fitted before the split saw validation rows. Augmentation before the split can put near-copies on both sides. A feature computed from the whole table can smuggle future or label information into every fold.`,
        { type: 'image', src: `https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Traintest.svg/960px-Traintest.svg.png`, alt: `Training and test sets with different fitted model curves`, caption: `The train-test wall only works if preprocessing, augmentation, grouping, and feature fitting do not cross it. Source: https://en.wikipedia.org/wiki/Training,_validation,_and_test_data_sets.` },
        `Another naive approach is to trust the metric because the code is deterministic. Leakage is not usually a nondeterministic bug. It is a chain-of-custody bug. The question is not whether the training loop ran correctly; it is whether each value was legally knowable at the moment the prediction would have been made.`,
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `The core insight is that every prediction has a knowledge boundary. At prediction time, some facts are allowed and some are not. A lab result returned tomorrow is not allowed for a prediction made today. A treatment chosen after diagnosis is not allowed as a feature for diagnosis. A duplicate of the test image is not allowed in training. A benchmark answer copied into pretraining is not allowed to count as reasoning skill.`,
        `Leakage prevention is mostly ordering. Deduplicate before splitting. Group by entity before splitting. Split time-series data by time. Fit preprocessing only inside the training side of each fold. Generate augmentations only from training examples. Seal the test set. Audit every feature with the same sentence: would this exact value exist, unchanged, at the moment the model must predict?`,
      ],
    },
    {
      heading: `Target leakage`,
      paragraphs: [
        `Target leakage happens when a feature is caused by, computed from, or recorded after the label. The pneumonia example is simple: took_antibiotics predicts pneumonia because antibiotics were prescribed after diagnosis. The model learns treatment policy, not disease. The same pattern appears in fraud labels, churn interventions, collections actions, and hospital outcomes.`,
        `The fix is a timestamp audit. Every feature needs a time of availability, not just a value. If the feature is updated after the target event, it is illegal for that prediction. If the feature is a summary that includes post-outcome data, it must be recomputed with a point-in-time join. Strong feature importance is not proof of leakage, but strong feature importance plus suspicious timing is an incident.`,
      ],
    },
    {
      heading: `Split contamination`,
      paragraphs: [
        `Split contamination happens when the same item, near-duplicate, or related entity appears on both sides of the train-test wall. An original image in training and a mirrored crop in test is not an honest test. Neither is the same patient in both sets, the same user session split across folds, duplicated web pages across train and validation, or paraphrases of the same question on both sides.`,
        `The fix is to define the entity before splitting. For medical data, group by patient. For recommendation data, group by user or session when the task requires it. For images, deduplicate and group original assets before augmentation. For text, run near-duplicate detection before folds are assigned. Split first, augment inside the training side only.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `Temporal leakage happens when the model trains on the future or when features are computed using future values. A random split over time-series rows can train on Friday and test on Tuesday. A rolling average computed over the full series can leak tomorrow into yesterday. A customer lifetime spend feature can include purchases made after the prediction date.`,
        `The fix is to respect the arrow of time. Training data must precede validation data for forecasting and production-like prediction. Feature computation must use only data available before the prediction timestamp. Cross-validation for temporal tasks should use forward-chaining or blocked folds, not a random shuffle that treats time as decoration.`,
      ],
    },
    {
      heading: `Benchmark contamination`,
      paragraphs: [
        `Benchmark contamination is the large-model version of the same bug. Public benchmark questions, answers, solution repositories, forum explanations, and blog walkthroughs can enter pretraining corpora. A model may score well because it has memorized the test item or a close variant. The exam was in the textbook.`,
        `The defense is imperfect but necessary: deduplicate against known benchmark text, hold out private test sets, rotate fresh evaluations, report decontamination methods, and test on task-specific private data. A famous public benchmark score is useful evidence only when it is paired with contamination analysis and behavior on examples the model could not have memorized.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The four leak matrices prove that contamination crosses boundaries. In target leakage, the label crosses into a feature. In split contamination, the same example crosses the train-test wall. In time travel, future information crosses into the past. In benchmark contamination, the test crosses into the training crawl. Each case has a different surface, but the same shape: information appears where it should be impossible.`,
        `The defense visual proves that the order of operations is a correctness property. Deduplicate and group first. Split second. Fit preprocessing inside the training data only. Audit timestamps before trusting features. Seal the test set. If those steps happen out of order, a model can pass every unit test while the experiment itself is invalid.`,
      ],
    },
    {
      heading: `Detection`,
      paragraphs: [
        `Leakage often announces itself as performance you did not earn. A hard medical prediction producing 0.99 AUC on the first attempt should trigger an audit. One feature explaining nearly all importance should trigger a timestamp check. A huge offline-production gap should trigger a split and feature lineage review. A language model continuing a benchmark item verbatim should trigger a contamination investigation.`,
        { type: 'image', src: `https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Simplified_neural_network_training_example.svg/250px-Simplified_neural_network_training_example.svg.png`, alt: `Simplified neural network training diagram with feature signals feeding classes`, caption: `Feature audits ask which training signals dominate the model and whether those signals would exist at prediction time. Source: https://en.wikipedia.org/wiki/Training,_validation,_and_test_data_sets.` },
        `Simple ablations help. Remove the suspect feature and retrain. If performance collapses to a more believable level, inspect how that feature was created. Search for duplicates across splits. Recompute preprocessing inside folds. Run a point-in-time feature build. Use influence or nearest-neighbor tools to find training examples that look too much like test examples.`,
      ],
    },
    {
      heading: `Cost and behavior (2)`,
      paragraphs: [
        `Leak prevention costs engineering discipline more than raw compute. You need dataset versioning, feature definitions with availability times, split manifests, entity ids, reproducible preprocessing pipelines, and review habits that ask data questions before model questions. That work feels slow until it prevents a false launch decision.`,
        `There are tradeoffs. Grouped splits can reduce the amount of training data. Time-based splits can make validation harder because the future distribution may drift. Private test sets are harder to share and compare. Strict decontamination can remove useful public examples. These costs are real, but they are smaller than optimizing against an invalid exam.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `Do not delete every strong feature just because it is strong. Some signals are genuinely predictive. The audit question is whether the value is legally available, not whether it is useful. Also do not trust a clean training script if the upstream data snapshot was contaminated. Leakage often lives in joins, labels, ETL timing, augmentation, deduplication, or benchmark collection.`,
        `A sealed validation set can also wear out. If the team repeatedly peeks, retunes, and chooses models based on the same holdout, that holdout becomes part of the training process. Use nested validation, fresh holdouts, or final test sets with limited access. The longer a benchmark is public, the more suspicious its score should become without contamination controls.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Cross-Validation and Honest Evaluation for split discipline, Leakage-Safe Target Encoding Case Study for high-cardinality categorical features, Point-in-Time Feature Join Index for temporal joins, Feature Store for training-serving consistency, Early Stopping and Patience for validation hygiene, Imbalanced Data: When 99% Is One Class for oversampling hazards, and ROC Curves and AUC for interpreting suspiciously strong scores.`,
        `Then study Influence: Which Training Data Did This? for forensic example tracing, Saliency Maps and Feature Attribution for suspect-feature ablations, Membership Inference Shadow Model Case Study for train-set participation leakage, LLM Training Data Extraction for memorized text, PII Redaction Token Span Pipeline for sensitive-field removal, and A/B Testing and p-values for the online experiment that may become the first honest test.`,
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },

    {
      heading: 'Why it works',
      paragraphs: [
        "Give the proof sketch as a preservation argument: invariant before, move, invariant after.",
        "If there is a nontrivial corner case, name it explicitly.",
        "When correctness is explicit, readers can transfer the method to new inputs.",
      ],
    },

    {
      heading: 'Real-world uses',
      paragraphs: [
        "Show where this approach appears in products, libraries, or service designs.",
        "Tie each use case to a workload shape, not a brand name.",
        "The learner should know exactly when this pattern should be chosen next.",
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        "Trace one representative example end-to-end so readers can watch state evolve across every step.",
        "Keep the walkthrough concise and precise: at each step, write current state, action taken, and resulting output.",
        "The goal is prediction, not a one-off demonstration.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why Data Leakage & Contamination moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};

