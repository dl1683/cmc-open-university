// Learned Bloom filter: let a classifier reject obvious nonmembers, then use a
// backup Bloom filter to restore the no-false-negative guarantee.

import { matrixState, graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'learned-bloom-filter',
  title: 'Learned Bloom Filter',
  category: 'Data Structures',
  summary: 'A model-plus-filter membership structure: the model handles easy cases, and a backup Bloom filter catches model false negatives.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['model plus backup', 'threshold tuning'], defaultValue: 'model plus backup' },
  ],
  run,
};

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function pipeline(title) {
  return graphState({
    nodes: [
      { id: 'query', label: 'query key', x: 0.8, y: 3.5, note: 'membership test' },
      { id: 'model', label: 'learned model', x: 3.0, y: 3.5, note: 'score key' },
      { id: 'accept', label: 'accept path', x: 5.2, y: 2.1, note: 'score >= threshold' },
      { id: 'backup', label: 'backup Bloom', x: 5.2, y: 5.0, note: 'model misses' },
      { id: 'maybe', label: 'maybe present', x: 7.7, y: 2.8, note: 'verify in source' },
      { id: 'absent', label: 'definitely absent', x: 7.7, y: 5.4, note: 'safe rejection' },
    ],
    edges: [
      { id: 'e-query-model', from: 'query', to: 'model', weight: 'features' },
      { id: 'e-model-accept', from: 'model', to: 'accept', weight: 'high score' },
      { id: 'e-model-backup', from: 'model', to: 'backup', weight: 'low score' },
      { id: 'e-accept-maybe', from: 'accept', to: 'maybe', weight: 'positive' },
      { id: 'e-backup-maybe', from: 'backup', to: 'maybe', weight: 'backup hit' },
      { id: 'e-backup-absent', from: 'backup', to: 'absent', weight: 'backup miss' },
    ],
  }, { title });
}

function* modelPlusBackup() {
  yield {
    state: pipeline('A classifier stands before a backup filter'),
    highlight: { active: ['query', 'model', 'e-query-model'], compare: ['backup'] },
    explanation: 'A learned Bloom filter uses a model as a pre-filter. The model scores whether a key looks like it belongs to the set. High-scoring keys are treated as maybe present.',
  };

  yield {
    state: pipeline('The backup Bloom filter fixes model false negatives'),
    highlight: { active: ['model', 'backup', 'e-model-backup', 'e-backup-maybe'], found: ['maybe'] },
    explanation: 'A plain model can reject real members, which would violate Bloom filter semantics. The fix is to store every real key that the model rejects in a backup Bloom filter.',
    invariant: 'The backup filter is what restores the no-false-negative guarantee.',
  };

  yield {
    state: labelMatrix(
      'Where each key goes during build',
      [
        { id: 'easypos', label: 'easy member' },
        { id: 'hardpos', label: 'hard member' },
        { id: 'easyneg', label: 'easy nonmember' },
        { id: 'hardneg', label: 'hard nonmember' },
      ],
      [
        { id: 'model', label: 'model score' },
        { id: 'backup', label: 'backup action' },
        { id: 'query', label: 'query result' },
      ],
      [
        ['high', 'not stored', 'maybe present'],
        ['low', 'store in backup', 'maybe if backup hits'],
        ['low', 'not stored', 'definitely absent'],
        ['high', 'not stored', 'false positive'],
      ],
    ),
    highlight: { active: ['hardpos:backup', 'easyneg:query'], compare: ['hardneg:query'] },
    explanation: 'The learned model reduces the number of absent keys that reach the backup. But if it admits absent keys with high scores, those become false positives.',
  };

  yield {
    state: labelMatrix(
      'Classic, learned, and sandwich variants',
      [
        { id: 'classic', label: 'classic Bloom' },
        { id: 'learned', label: 'learned Bloom' },
        { id: 'sandwich', label: 'sandwich LBF' },
        { id: 'partitioned', label: 'partitioned LBF' },
      ],
      [
        { id: 'front', label: 'front stage' },
        { id: 'middle', label: 'middle stage' },
        { id: 'back', label: 'back stage' },
      ],
      [
        ['hash bits', '', ''],
        ['model', '', 'backup Bloom'],
        ['initial Bloom', 'model', 'backup Bloom'],
        ['model partitions', 'threshold per region', 'backup filters'],
      ],
    ),
    highlight: { found: ['learned:front', 'learned:back'], active: ['sandwich:front', 'sandwich:middle', 'sandwich:back'] },
    explanation: 'The basic learned Bloom filter is only the starting point. Sandwiching adds a small initial Bloom filter before the model; partitioned designs tune regions separately.',
  };
}

function* thresholdTuning() {
  yield {
    state: labelMatrix(
      'Threshold tradeoff',
      [
        { id: 'low', label: 'low threshold' },
        { id: 'mid', label: 'middle threshold' },
        { id: 'high', label: 'high threshold' },
        { id: 'shift', label: 'distribution shift' },
      ],
      [
        { id: 'modelpass', label: 'model admits' },
        { id: 'backup', label: 'backup size' },
        { id: 'fpr', label: 'false positives' },
      ],
      [
        ['many keys', 'small', 'model false positives rise'],
        ['balanced', 'moderate', 'tuned target'],
        ['few keys', 'large', 'backup false positives rise'],
        ['unknown', 'calibration breaks', 'retrain or fallback'],
      ],
    ),
    highlight: { active: ['mid:modelpass', 'mid:backup', 'mid:fpr'], compare: ['low:fpr', 'high:backup'] },
    explanation: 'The threshold controls where memory is spent. A low threshold trusts the model and shrinks the backup, but can admit many nonmembers. A high threshold rejects more real members, growing the backup.',
  };

  yield {
    state: pipeline('Negative queries should die early'),
    highlight: { active: ['query', 'model', 'backup', 'absent', 'e-model-backup', 'e-backup-absent'], compare: ['maybe'] },
    explanation: 'The performance win comes when absent queries are cheap. If most nonmembers get low model scores and miss the backup, the system avoids the larger source-of-truth lookup.',
  };

  yield {
    state: labelMatrix(
      'Evaluation protocol',
      [
        { id: 'train', label: 'train members' },
        { id: 'backup', label: 'backup set' },
        { id: 'negative', label: 'negative workload' },
        { id: 'drift', label: 'future workload' },
      ],
      [
        { id: 'measure', label: 'measure' },
        { id: 'why', label: 'why' },
      ],
      [
        ['model recall on members', 'find false negatives'],
        ['backup size and FPR', 'preserve guarantee'],
        ['end-to-end FPR', 'real false-positive budget'],
        ['calibration over time', 'learned structure can age'],
      ],
    ),
    highlight: { found: ['backup:measure', 'negative:measure'], active: ['drift:why'] },
    explanation: 'A learned Bloom filter must be evaluated on the query distribution it will actually see. A model that looks good on random negatives can fail on adversarial or shifted negatives.',
  };

  yield {
    state: labelMatrix(
      'When to use it',
      [
        { id: 'structured', label: 'structured keys' },
        { id: 'random', label: 'random keys' },
        { id: 'stable', label: 'stable distribution' },
        { id: 'hostile', label: 'hostile input' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['good', 'model can learn membership boundary'],
        ['poor', 'hashing already near optimal'],
        ['good', 'threshold stays calibrated'],
        ['risky', 'adversary can target model false positives'],
      ],
    ),
    highlight: { found: ['structured:fit', 'stable:fit'], compare: ['random:fit', 'hostile:fit'] },
    explanation: 'The model only helps when membership has learnable structure. If keys are already random fingerprints, a classic Bloom filter is usually simpler and harder to fool.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'model plus backup') yield* modelPlusBackup();
  else if (view === 'threshold tuning') yield* thresholdTuning();
  else throw new InputError('Pick a learned Bloom filter view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A learned Bloom filter replaces part of a traditional Bloom filter with a classifier. The classifier looks at a key and predicts whether it belongs to the set. If the model is confident enough, the query returns maybe present. If the model rejects the key, a backup Bloom filter is checked. The backup stores real members that the model would otherwise reject, preserving the no-false-negative guarantee expected from approximate membership filters.',
        'The learned-index paper proposed using learned models to enhance indexes from B-trees to Bloom filters: https://arxiv.org/pdf/1712.01208. Michael Mitzenmacher then modeled learned Bloom filters and clarified what guarantees can and cannot be associated with them: https://arxiv.org/abs/1802.00884. The key lesson is that the model is not the guarantee; the auxiliary filter is.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Build begins with a known member set. Train or choose a model that scores keys. Run every real member through the model. Members that score above the threshold are handled by the model path. Members that score below the threshold are model false negatives, so they are inserted into the backup Bloom filter. At query time, score the key. High score means maybe present. Low score means consult the backup; a backup miss means definitely absent.',
        'The threshold controls the shape of the data structure. Lower thresholds make the model admit more keys, shrinking the backup but increasing model false positives. Higher thresholds reject more keys, growing the backup because more real members must be protected. Sandwich designs add a small ordinary Bloom filter before the model to reject obvious nonmembers before paying model cost.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is model inference plus backup filter memory. If the model is tiny and the workload has learnable structure, the combined structure can use less memory for a target false-positive rate. If the model is expensive, poorly calibrated, or facing random-looking keys, a plain Bloom Filter can win by being simpler and more predictable. The backup filter also has its own false positives, so end-to-end false-positive probability must be measured, not guessed.',
        'Learned Bloom filters add lifecycle complexity. The membership distribution can drift. A model trained on yesterday keys may reject tomorrow members or admit tomorrow nonmembers. Adversarial users can search for high-scoring nonmembers. The system needs monitoring, fallback, and rebuild logic just like any other learned system.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The best fit is a membership workload with structure: URLs from a curated crawl, usernames from a known namespace, product IDs with regular formats, or database keys whose distribution is stable. The model learns the shape of likely members and avoids spending backup-filter bits on easy negatives. The source of truth still performs final verification after maybe present, just as it would behind a classic Bloom filter.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not deploy a model-only membership test if you need Bloom semantics. A classifier can have false negatives. The backup filter is the correctness patch. Do not judge the design on random negative samples if production negatives are structured or adversarial. The false-positive budget belongs to the real query distribution.',
        'Another misconception is that learned filters are automatically better because they use machine learning. They are better only when the model is cheap, calibrated, and able to exploit structure that hashing cannot. Otherwise the ordinary Bloom filter is the stronger engineering choice.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: The Case for Learned Index Structures at https://arxiv.org/pdf/1712.01208 and A Model for Learned Bloom Filters and Related Structures at https://arxiv.org/abs/1802.00884. Study Bloom Filter, Learned Indexes, Xor Filter, Calibration Curves, Data Leakage & Contamination, and Cross-Validation & Honest Evaluation next.',
      ],
    },
  ],
};
