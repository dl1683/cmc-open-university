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
      heading: 'Why This Exists',
      paragraphs: [
        'A Bloom filter answers a narrow question: is this key definitely absent, or is it maybe present? It is useful because it compresses a large set into a bit array while keeping one promise. It may accidentally accept a nonmember, but it must not reject a real member that was inserted.',
        'A learned Bloom filter exists because some membership sets are not random. URLs from a curated crawl, product identifiers, usernames, table keys, and managed namespaces often have visible structure. A model can sometimes learn that structure and reject obvious nonmembers before the ordinary hash-based filter has to spend memory on them.',
        'The goal is not to replace hashing with machine learning for style points. The goal is to spend the false-positive budget more carefully. If a cheap model can eliminate a large share of negative queries, the backup filter can be smaller, the downstream database can be called less often, or the same memory budget can reach a lower false-positive rate.',
      ],
    },
    {
      heading: 'The Baseline And The Wall',
      paragraphs: [
        'The baseline is the classic Bloom filter. Insert a key by hashing it several ways and setting the selected bits. Query a key by checking the same bit positions. If any bit is missing, the key is definitely absent. If all bits are present, the key is maybe present.',
        'That baseline is hard to beat because it is simple, cache-friendly, and distribution-agnostic. It does not care whether the keys are English words, hashes, user IDs, or database records. Its behavior is controlled by the number of inserted keys, the bit-array size, and the number of hash functions.',
        'The wall appears when you try to use a classifier by itself. A classifier can have false negatives. It can say a real member looks absent. That violates the membership contract that made the Bloom filter useful. A learned Bloom filter has to repair that weakness instead of pretending it is harmless.',
      ],
    },
    {
      heading: 'Core Insight And Invariant',
      paragraphs: [
        'The core insight is to put the model in front of a correction mechanism. The model scores the key. High-scoring keys take the fast maybe-present path. Low-scoring keys are not rejected immediately, because some real members may score low. They are checked against a backup Bloom filter.',
        'The invariant is the whole design: every real member must either pass the model threshold or be inserted into the backup filter. During build, the system tests each known member against the model. Members that the model would reject are exactly the keys that go into the backup.',
        'A definitely-absent answer is safe only after two facts are true. The model score is below the threshold, and the backup Bloom filter misses. If the key was a real member, the build procedure would have made one of those two facts false.',
      ],
    },
    {
      heading: 'How The Visual Model Teaches It',
      paragraphs: [
        'The model-plus-backup view shows two ways to reach maybe present. A high model score reaches it directly. A low model score reaches it only if the backup filter hits. That split is the main mental model: the learned part is allowed to be optimistic, but the backup part protects the no-false-negative rule.',
        'The threshold-tuning view shows why this is an engineering object, not just a trained model. Lowering the threshold lets more keys through the model, so the backup shrinks but model false positives can rise. Raising the threshold rejects more real members, so the backup grows and may create more hash collisions if memory is fixed.',
        'The important thing to notice is where a negative query dies. The best case is a nonmember that the model scores low and the backup misses. That query never reaches the source of truth. The worst case is a nonmember that scores high because it found a blind spot in the model.',
      ],
    },
    {
      heading: 'How It Works',
      paragraphs: [
        'Build starts with a fixed member set S. Train or choose a model that returns a score for a key. Pick a threshold t. For every member x in S, compute score(x). If the score is at least t, that member is covered by the model path. If the score is below t, insert x into the backup Bloom filter.',
        'A query uses the same rule. Score the key. If score(key) is at least t, return maybe present. If the score is below t, query the backup filter. A backup hit returns maybe present. A backup miss returns definitely absent.',
        'The "sandwich" variant adds a small ordinary Bloom filter before the model. That front filter rejects many obvious nonmembers without paying model inference cost. Keys that pass the front filter go to the model, and model misses are still protected by a backup filter. The pieces change, but the invariant remains the same.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'The no-false-negative guarantee comes from symmetry between build and query. During build, every real member that would fail the model is placed in the backup. During query, every key that fails the model is checked against that same backup. A real member cannot fall through both paths unless the build was wrong or the data changed without rebuilding.',
        'False positives remain possible, and they come from two places. A nonmember can score above the model threshold. A nonmember can also score below the threshold and collide in the backup Bloom filter. The total false-positive rate is the combined behavior of the model path and the backup path.',
        'This is why learned Bloom filters have to be measured end to end. A model with impressive accuracy can still be a poor membership structure if its high-score false positives are common in the real query workload, or if it rejects so many real members that the backup becomes too large.',
      ],
    },
    {
      heading: 'Concrete Example',
      paragraphs: [
        'Suppose the set contains apple.com, docs.example, and admin-42. The model threshold is 0.8. During build, apple.com scores 0.95 and docs.example scores 0.91, so both are covered by the model path. admin-42 scores 0.40, so it is inserted into the backup filter.',
        'At query time, apple.com scores high and returns maybe present. admin-42 scores low, but the backup hits and returns maybe present. random-key scores low and misses the backup, so it returns definitely absent. The guarantee is visible in the hard member, not in the easy member.',
        'Now consider a nonmember such as apple-login.example that scores 0.97 because it resembles real members. The structure returns maybe present. That is allowed, but it is still a false positive. The next layer, usually a table lookup or source-of-truth check, must verify the result before taking a sensitive action.',
      ],
    },
    {
      heading: 'Costs And Tradeoffs',
      paragraphs: [
        'The cost is not just bits. A learned Bloom filter pays for model storage, model inference, backup-filter memory, threshold tuning, calibration checks, and rebuild logic. A tiny model can be worthwhile. A large model can lose to a plain Bloom filter simply because hashing is cheap and predictable.',
        'Threshold choice controls where the errors move. A lower threshold shrinks the backup by trusting the model more, but it admits more nonmembers through the model path. A higher threshold lowers model false positives, but it pushes more real members into the backup. With a fixed memory budget, a larger backup set can increase backup false positives.',
        'The operational cost is distribution awareness. A learned filter trained on one negative distribution can fail against another. Random negative samples may make the design look excellent while production traffic contains near-miss keys, adversarial probes, or new naming patterns that the model scores incorrectly.',
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        'It wins when membership has learnable structure and the query mix contains many negatives. Curated URL blocklists, managed product catalogs, internal service names, generated IDs with stable formats, and some database key ranges are plausible fits. The model can reject keys that hashing treats as indistinguishable from real members.',
        'It also wins when maybe-present results are expensive. If a positive filter result triggers a disk lookup, network call, fraud review, cache miss, or database check, then reducing false positives has value beyond memory savings. The best learned filter is often the one that reduces downstream work, not merely the one with the smallest bit array.',
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        'It fails for random fingerprints, cryptographic hashes, uniformly generated IDs, rapidly drifting sets, and workloads where the model cannot learn a stable boundary. In those cases a classic Bloom filter is usually stronger because it makes fewer assumptions and has a clear memory-error curve.',
        'It is risky against hostile input. An attacker can search for high-scoring nonmembers and flood the model accept path. If the filter protects an abuse-sensitive surface, evaluate adversarial negatives and keep a plain-filter fallback or a stricter threshold ready.',
        'It fails conceptually if the backup is removed. A model-only membership test may be useful for ranking or triage, but it is not a Bloom filter when false negatives matter.',
      ],
    },
    {
      heading: 'Operational Guidance',
      paragraphs: [
        'Start by measuring a classic Bloom filter at the target false-positive rate. That is the baseline the learned design must beat. Then split data so model training, threshold selection, and evaluation are honest. Include real negative traffic, not only random keys drawn from a convenient distribution.',
        'Track four numbers in production: model accept rate on negatives, backup size, backup false-positive rate, and end-to-end false-positive rate after the source-of-truth check. Rebuild when calibration drifts. Keep the old filter available during rollout so a bad model update does not silently change membership semantics.',
        'Treat the threshold as a deployable parameter. It should be chosen from measured cost, not from model accuracy alone. A threshold that maximizes F1 score may be wrong if backup memory is scarce or source-of-truth checks are expensive.',
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        'Study Bloom Filter first, because the learned version inherits its one-sided-error contract. Then study Xor Filter and Quotient Filter to see other ways approximate membership structures trade memory for speed and false positives. Study Learned Indexes to understand the broader idea of using models inside data structures.',
        'For model evaluation, study Calibration Curves, Cross-Validation and Honest Evaluation, and Data Leakage and Contamination. The important papers are The Case for Learned Index Structures and Michael Mitzenmacher\'s model for learned Bloom filters and related structures. Read them with attention to the auxiliary filter, because that is the part that preserves the guarantee.',
      ],
    },
  ],
};
