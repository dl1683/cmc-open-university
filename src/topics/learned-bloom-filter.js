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
    explanation: `A ${topic.title} uses a model as a pre-filter. The model scores whether a key looks like it belongs to the set. High-scoring keys are treated as maybe present.`,
  };

  yield {
    state: pipeline('The backup Bloom filter fixes model false negatives'),
    highlight: { active: ['model', 'backup', 'e-model-backup', 'e-backup-maybe'], found: ['maybe'] },
    explanation: `A plain model can reject real members, which would violate ${topic.category.toLowerCase()} semantics. The fix is to store every real key that the model rejects in a backup Bloom filter.`,
    invariant: `The backup filter is what restores the no-false-negative guarantee for the ${topic.title}.`,
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
    explanation: `The learned model reduces the number of absent keys that reach the backup. But if it admits absent keys with high scores, those become false positives in the ${topic.title}.`,
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
    explanation: `The basic ${topic.title} is only the starting point. Sandwiching adds a small initial Bloom filter before the model; partitioned designs tune ${topic.controls[0].options.length} concerns separately: threshold and backup sizing.`,
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
    explanation: `The threshold controls where memory is spent in the ${topic.title}. A low threshold trusts the model and shrinks the backup, but can admit many nonmembers. A high threshold rejects more real members, growing the backup.`,
  };

  yield {
    state: pipeline('Negative queries should die early'),
    highlight: { active: ['query', 'model', 'backup', 'absent', 'e-model-backup', 'e-backup-absent'], compare: ['maybe'] },
    explanation: `The performance win comes when absent queries are cheap. If most nonmembers get low model scores and miss the backup, the ${topic.title} avoids the larger source-of-truth lookup.`,
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
    explanation: `A ${topic.title} must be evaluated on the query distribution it will actually see. A model that looks good on random negatives can fail on adversarial or shifted negatives.`,
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
    explanation: `The model only helps when membership has learnable structure. If keys are already random fingerprints, a classic Bloom filter in ${topic.category} is usually simpler and harder to fool.`,
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
    { heading: 'How to read the animation', paragraphs: [
        'The model-plus-backup view follows one membership query through a classifier and then, when needed, through a backup Bloom filter. Active nodes show the current decision, and the absent node is safe only when both the model and backup path reject the key.',
        {type: 'image', src: './assets/gifs/learned-bloom-filter.gif', alt: 'Animated walkthrough of the learned bloom filter visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The threshold-tuning view shows the tradeoff. Lower thresholds trust the model and shrink the backup, while higher thresholds reject more real members into the backup and spend more hash-filter memory.',
      ], },
    { heading: 'Why this exists', paragraphs: [
        'A Bloom filter is an approximate membership structure. It can say maybe present for a nonmember, but it must never say definitely absent for an inserted member.',
        {
          type: 'callout',
          text: 'The learned model may be wrong; the backup filter is what preserves the no-false-negative contract.',
        },
        'Some sets have learnable structure: URLs from one domain family, product IDs with formats, managed usernames, or sorted database keys. A learned Bloom filter uses a model to reject easy nonmembers and spends backup memory only on real members the model would miss.',
      ], },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious approach is a classic Bloom filter. Hash each inserted key several ways, set those bits, and later check whether all those bits are present.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Bloom_filter.svg/500px-Bloom_filter.svg.png',
          alt: 'Bloom filter diagram mapping keys through hash functions into a bit array',
          caption: 'A classic Bloom filter proves absence when any required bit is zero; the learned variant must preserve that one-sided contract. Source: Wikimedia Commons, David Eppstein, public domain.',
        },
        'This baseline is strong because it is simple, fast, and distribution-agnostic. It does not care whether keys are meaningful strings or random hashes.',
      ], },
    { heading: 'The wall', paragraphs: [
        'A classifier by itself cannot be a Bloom filter because it can have false negatives. If it rejects a real member, the structure has broken the one promise that made it safe.',
        'The second wall is query distribution. A model trained against random negatives can look excellent while production negatives are near misses that the model scores too high.',
      ], },
    { heading: 'The core insight', paragraphs: [
        'Use the model as a front door, not as the source of truth. During build, test every real member against the model and insert only the missed members into a backup Bloom filter.',
        'At query time, a high model score returns maybe present, while a low model score falls through to the backup. A definitely absent answer is allowed only when the backup misses too.',
      ], },
    { heading: 'How it works', paragraphs: [
        'Pick a threshold t. For each member x, compute score(x); if score(x) is below t, insert x into the backup filter, and if score(x) is at least t, do not store it in the backup.',
        'For a query q, compute score(q). If the score is at least t, return maybe present; otherwise query the backup filter and return maybe present on a hit or definitely absent on a miss.',
      ], },
    { heading: 'Why it works', paragraphs: [
        'The no-false-negative guarantee comes from matching build and query rules. Any real member that the model would reject was inserted into the backup, so it cannot fall through both paths unless the set changed without rebuilding.',
        'False positives still exist. A nonmember can score above threshold, or it can score below threshold and collide in the backup Bloom filter.',
      ], },
    { heading: 'Cost and complexity', paragraphs: [
        'The total cost is model storage, model inference, backup-filter bits, threshold tuning, and rebuild policy. If the model is expensive or the keys are random, a plain Bloom filter can win on both speed and reliability.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Bloom_filter_fp_probability.svg/500px-Bloom_filter_fp_probability.svg.png',
          alt: 'Bloom filter false positive probability curves',
          caption: 'False-positive probability rises with load, so a learned filter must measure the model path and backup path together. Source: Wikimedia Commons, File:Bloom filter fp probability.svg.',
        },
        'Threshold movement shifts cost. Lowering t shrinks the backup but may admit more nonmembers through the model; raising t lowers model false positives but grows the backup and its collision rate.',
      ], },
    { heading: 'Real-world uses', paragraphs: [
        'Learned Bloom filters fit stable structured key sets with many negative queries. URL filters, product catalogs, service names, managed namespaces, and some database key domains can have patterns a small model learns.',
        'They are most valuable when a maybe-present result triggers expensive work. Reducing false positives can save disk lookups, network calls, source-of-truth checks, fraud reviews, or cache misses.',
      ], },
    { heading: 'Where it fails', paragraphs: [
        'It fails for cryptographic hashes, random fingerprints, rapidly changing sets, and hostile input that searches for model blind spots. In those cases the model adds assumptions that hashing did not need.',
        'It also fails if the backup is removed. A model-only membership test may be useful for ranking, but it is not a Bloom filter when false negatives are unacceptable.',
      ], },
    { heading: 'Worked example', paragraphs: [
        'Suppose the set is {apple.com, docs.example, admin-42}, and the threshold is 0.80. The model scores apple.com at 0.95, docs.example at 0.91, and admin-42 at 0.40, so only admin-42 enters the backup filter.',
        'At query time, apple.com returns maybe present directly. admin-42 scores low but hits the backup, so it also returns maybe present; random-key scores 0.10 and misses the backup, so it returns definitely absent.',
        'A nonmember such as apple-login.example might score 0.97 and return maybe present. That is allowed, but the source of truth must verify it before the system acts on membership.',
      ], },
    { heading: 'Sources and study next', paragraphs: [
        'Sources: Kraska et al. on learned index structures, Mitzenmacher on learned Bloom filters, and later sandwich or partitioned learned Bloom filter work. Read the backup-filter construction first because it is the correctness repair.',
        'Study Bloom filters, Xor filters, quotient filters, learned indexes, calibration curves, cross-validation, and adversarial evaluation. The practical baseline is always the classic Bloom filter at the target false-positive rate.',
      ], },
  ],
};
