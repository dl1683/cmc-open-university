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
  yield {
    state: matrixState({
      title: 'Leak 1 — TARGET LEAKAGE: a feature computed from the answer',
      rows: [
        { id: 'age', label: 'patient age' },
        { id: 'fever', label: 'fever on admission' },
        { id: 'cough', label: 'cough severity' },
        { id: 'abx', label: 'took_antibiotics ⚠' },
      ],
      columns: [{ id: 'imp', label: 'feature importance' }, { id: 'when', label: 'known when?' }],
      values: [[0.02, 1], [0.01, 1], [0.01, 1], [0.96, 2]],
      format: (v) => (v === 1 ? 'at prediction time ✓' : v === 2 ? 'AFTER diagnosis ✗' : `${(v * 100).toFixed(0)}%`),
    }),
    highlight: { removed: ['abx:imp', 'abx:when'] },
    explanation: 'Task: predict pneumonia from intake data. The model scores a jaw-dropping AUC of 0.99 — and one feature carries 96% of the importance: took_antibiotics. Look at WHEN that feature gets its value: doctors prescribe antibiotics AFTER diagnosing pneumonia. The feature is the label\'s shadow — the model learned "patients treated for pneumonia have pneumonia," a tautology that scores brilliantly in training and is worthless at prediction time, when the prescription hasn\'t happened yet. TARGET LEAKAGE: any feature whose value is set by, after, or because of the outcome. The 0.99 was never skill; it was the answer key stapled to the exam.',
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
      format: (v) => ['', 'TRAINING set', 'TEST set ⚠'][v],
    }),
    highlight: { removed: ['flip:where'], compare: ['orig:where', 'crop:where'] },
    explanation: 'Leak 2 is quieter: AUGMENT a dataset (flips, crops, paraphrases), THEN split randomly — and near-copies of the same photo land on both sides of the wall. The test set now contains questions the model literally memorized the answers to, just mirrored. The same accident happens with duplicate web pages, the same patient\'s multiple visits, or near-identical log entries. The grade inflates, sometimes massively — and Cross-Validation\'s machinery runs perfectly while measuring nothing, because the violation happened BEFORE the split. Rule: deduplicate and group FIRST, augment INSIDE the training side only, split at the entity level (patient, user, document — not row).',
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
      format: (v) => ['', 'train', 'TEST ⚠ — model saw Wed–Fri'][v],
    }),
    highlight: { removed: ['tue:role'], visited: ['wed:role', 'thu:role', 'fri:role'] },
    explanation: 'Leak 3 — TEMPORAL: split time-series data randomly and the model trains on Wednesday-through-Friday to "predict" Tuesday — it has seen the future it is being graded on. Stock models are the famous victims, but the subtle version bites everyone: a rolling average computed over the WHOLE series before splitting injects future values into past rows; a "customer lifetime spend" feature summarizes purchases that hadn\'t happened yet. Every feature must be computable from strictly-before-the-timestamp data, and the split must be past → future, full stop. (Cross-Validation\'s leakage warning, sharpened: for time, the fold boundary is an arrow, not a wall.)',
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
    explanation: 'Leak 4 is the LLM era\'s version: benchmarks live on the public web — questions, answers, GitHub repos full of solutions, blog walkthroughs — and pretraining crawls scrape the public web. The exam was in the textbook. Contaminated models post inflated scores on the famous benchmarks while gaining nothing real; labs now publish n-gram-overlap "decontamination" reports, hold back private test splits, and rotate fresh evals (the reason new benchmarks keep appearing is partly that old ones keep dissolving into the training data). When a model\'s benchmark score jumps but its behavior on YOUR task doesn\'t, contamination is the first suspect — the same too-good-to-be-true fingerprint as leak 1, at planetary scale.',
  };
}

function* detectDefend() {
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
    explanation: 'Detection starts with calibrated suspicion: hard problems do not yield 0.99 AUC to a first attempt — celebrate for five minutes, then audit. The single-dominant-feature fingerprint is checkable in one line (feature importances, or the deletion test from Saliency Maps & Feature Attribution: remove the suspect, watch the score crater back to honest). The offline/production gap is the lagging indicator — by then users met the broken model. And Influence: Which Training Data Did This? gives the forensic tool: contaminated or duplicated examples show up as wildly influential training points for their own test twins.',
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
    explanation: 'The defense is ORDERING: leakage is almost always a pipeline step executed too early (augmenting before splitting, scaling before folding, featurizing before timestamp-checking). Numbering the checklist makes it mechanical — and step 4 deserves its ritual sentence, asked of every feature in the schema: "would this value exist, exactly as stored, at the moment we need the prediction?" If the answer involves the future, the outcome, or the whole dataset, the feature is contraband. Teams that institutionalize this question catch leaks in code review; teams that do not catch them in incident review.',
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
    explanation: 'The closing warning, and the reason this page exists: leakage is the only bug that makes your dashboard BETTER. Nothing crashes; the metrics improve; the leaky model beats every honest candidate in selection (it is the best cheater in the room), so process actively promotes it. Kaggle competitions have been won and then voided over leaks; published medical models have collapsed on real patients; the pattern survives because the incentive gradient points toward it. Hence the discipline that sounds paranoid until it saves you — Cross-Validation\'s chain of custody, Early Stopping & Patience\'s sealed validation, this page\'s timestamp ritual. An evaluation is an experiment, and an experiment contaminated is an experiment not run.',
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
      heading: `What it is`,
      paragraphs: [
        `Data Leakage & Contamination is the bug where information that should be unavailable at prediction time sneaks into training or evaluation. It is dangerous because it improves the dashboard. The demo's pneumonia model reaches 0.99 AUC because one feature, took_antibiotics, carries 96% importance, but that value exists after diagnosis. The model did not learn pneumonia; it learned that doctors prescribe antibiotics to people already diagnosed. Leakage is an answer key stapled to the exam.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The visualization shows four leak types. Target leakage is a feature caused by the label, like antibiotics after diagnosis. Split contamination happens when near-duplicates straddle train and test: an original photo in training and its mirrored version in test. Time travel happens when random time-series splits let Friday train a model graded on Tuesday, or when a rolling average was computed over the whole future. Benchmark contamination is the LLM-era version: public benchmark questions and answer discussions appear in pretraining crawls, so evaluation becomes memorization.`,
        `Detection starts with suspicion. A hard problem producing 0.99 ROC Curves & AUC on the first attempt deserves an audit. A single feature dominating importance deserves a timestamp check. A model that reports 94% offline and 76% in production likely measured a contaminated process. Influence: Which Training Data Did This? can surface duplicated or unusually influential training examples. Saliency Maps & Feature Attribution can remove a suspect feature and show whether the score collapses back to reality.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Leak prevention is mostly ordering, not heavy computation. Deduplicate and group by entity before splitting. Split before augmentation. Fit scalers, imputers, feature selectors, target encoders, and oversamplers only inside each training fold. Audit every feature with one question: would this exact value exist at the moment of prediction? The computational costs are small compared with a failed deployment. The organizational cost is discipline in code review, dataset versioning, and experiment logs. A written data contract is often more valuable than another model checkpoint, because it fixes what information the model is allowed to know.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Medical models, fraud systems, stock predictors, content moderation, Kaggle competitions, and LLM benchmarks have all been burned by leakage. Cross-Validation & Honest Evaluation can only protect you if contamination has not already happened before the split. Early Stopping & Patience also relies on a sealed validation set; peeking and retuning repeatedly wears it out. Imbalanced Data: When 99% Is One Class adds another trap: oversampling before splitting can copy rare positives into both train and validation. The same pattern appears in text when paraphrases or duplicated web pages cross the split boundary.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Correlation is not proof of leakage. A feature can be genuinely predictive without cheating, so audit timing and construction rather than deleting every strong signal. Conversely, a clean codebase is not proof of a clean dataset. Leakage often lives upstream: joins, augmentation, snapshots, deduplication, or benchmark collection. Do not trust a test set after repeated peeks; that is just slower training. Do not assume A/B Testing & p-values will rescue a contaminated offline model, because the online experiment may be the first honest evaluation users ever see.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Cross-Validation & Honest Evaluation for split discipline, Leakage-Safe Target Encoding Case Study for high-cardinality categorical leakage, Point-in-Time Feature Join Index for temporal feature joins, Feature Store for training-serving consistency, Early Stopping & Patience for validation-set hygiene, Influence: Which Training Data Did This? for forensic examples, Saliency Maps & Feature Attribution for suspect-feature audits, Membership Inference Shadow Model Case Study for train-set participation leakage, LLM Training Data Extraction for memorized text, and PII Redaction Token Span Pipeline for removing sensitive fields before they become training data. Then revisit ROC Curves & AUC with a healthier instinct: too-good-to-be-true performance is a bug report until proven otherwise.`,
      ],
    },
  ],
};
