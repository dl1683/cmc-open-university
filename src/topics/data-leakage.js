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
        `Data leakage is the silent bug that makes your model look smarter than it is: target information sneaks into training data, so the model cheats instead of learning to generalize. The result is a metric so good it becomes suspicious — 0.99 AUC on a hard problem, or 94 percent offline but only 76 percent in production. Leakage does not crash; it rewards you, wins model selection, and gets deployed. Only after users meet the broken model does the true cost appear. Data science rests on honest measurement, and leakage is the only bug that corrupts measurement while making everything look fine.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `First, TARGET LEAKAGE: a feature gets its value after or because of the label. A pneumonia predictor scores 0.99 learning "patients on antibiotics have pneumonia" — but antibiotics are prescribed AFTER diagnosis, so the feature is tautology at prediction time. Second, SPLIT CONTAMINATION: augment data (flip photos, paraphrase text) then split randomly; near-duplicates land on both sides of the wall. The test set contains answers the model memorized. Cross-Validation's machinery measures nothing true. Third, TIME TRAVEL: split time-series randomly and the model trains on future data to predict the past, or a rolling average injects future values into past rows. Fourth, BENCHMARK CONTAMINATION: large language models train on trillions of web tokens, including benchmark answers. The exam lives in the textbook.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Leakage costs trust. Production reveals the truth: a model that promised 94 percent offline delivers 76 percent online. The defense is not expensive — deduplication is O(n log n), splitting and fitting preprocessing inside the training loop add only discipline, not asymptotic cost. The ritual question, "would this value exist at prediction time?" — scales with feature count (usually small). Teams that institutionalize this in code review catch leaks before shipping; teams that do not catch them in incident review, after users have met failure.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Medical models published on leaky data have collapsed in real hospitals. Stock-price benchmarks that beat experts were later found to train on future close prices. Kaggle competitions have been won then voided for leakage. Click-through-rate models showed 94 percent offline accuracy until Influence: Which Training Data Did This? revealed duplicated examples the model had memorized. Fraud detection systems brilliant on past fraud failed on new fraud because a feature summed "lifetime fraud probability" — a label, not a predictor. The pattern: leakage is found last, after deployment, because everything looks fine beforehand.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Do not trust a 0.99 AUC — celebrate five minutes, then audit. Misconception: "if Cross-Validation passes, the model is honest" — but if contamination happened before the split, every fold inherits the poison. Another: a feature correlating with the label must be leaky — correlation is not proof. Use Saliency Maps & Feature Attribution to delete the suspect and watch the model collapse if it just memorized. The deepest danger: leakage is the only bug that improves your dashboard. Nothing crashes; metrics shine; the cheater wins model selection because it cheats better than honest competitors.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Cross-Validation & Honest Evaluation teaches ensuring folds are independent and metrics trustworthy — the chain of custody that catches contamination. Early Stopping & Patience seals the validation set and resists peeking (another form of leakage). Influence: Which Training Data Did This? highlights wildly-influential training examples that betray the leak. Saliency Maps & Feature Attribution interrogates suspect features — delete them and watch the model collapse if it just memorized. A/B Testing & p-values measures whether improvements are real, not illusion.`,
      ],
    },
  ],
};

