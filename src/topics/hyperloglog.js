// HyperLogLog: approximate distinct counting. Split a hash into a bucket
// index and a suffix; each bucket remembers the largest leading-zero run it
// has seen; the harmonic mean of those registers estimates cardinality.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'hyperloglog',
  title: 'HyperLogLog',
  category: 'Data Structures',
  summary: 'Approximate COUNT DISTINCT at huge scale: hash each item, update tiny registers, estimate with a harmonic mean.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['register updates', 'merge and error'], defaultValue: 'register updates' },
  ],
  run,
};

const M = 8;
const ALPHA = 0.7213 / (1 + 1.079 / M);
const ROWS = Array.from({ length: M }, (_, i) => ({ id: `r${i}`, label: `bucket ${i}` }));
const REGISTER_COLUMN = [{ id: 'rank', label: 'max rank' }];
const EVENTS = [
  { key: 'u17', bucket: 2, suffix: '001010', rank: 3 },
  { key: 'u42', bucket: 6, suffix: '100110', rank: 1 },
  { key: 'u17', bucket: 2, suffix: '001010', rank: 3 },
  { key: 'u99', bucket: 1, suffix: '000101', rank: 4 },
  { key: 'u120', bucket: 5, suffix: '010001', rank: 2 },
  { key: 'u5', bucket: 2, suffix: '000010', rank: 5 },
  { key: 'u42', bucket: 6, suffix: '100110', rank: 1 },
  { key: 'u300', bucket: 0, suffix: '000001', rank: 6 },
  { key: 'u501', bucket: 7, suffix: '011100', rank: 2 },
  { key: 'u777', bucket: 3, suffix: '001111', rank: 3 },
];

function emptyRegisters() {
  return new Array(M).fill(0);
}

function registerState(registers, title) {
  return matrixState({
    title,
    rows: ROWS,
    columns: REGISTER_COLUMN,
    values: registers.map((value) => [value]),
    format: (value) => String(value),
  });
}

function estimate(registers) {
  const raw = ALPHA * M * M / registers.reduce((sum, value) => sum + 2 ** -value, 0);
  const zeros = registers.filter((value) => value === 0).length;
  const corrected = zeros > 0 ? M * Math.log(M / zeros) : raw;
  return { raw, zeros, corrected };
}

function update(registers, event) {
  registers[event.bucket] = Math.max(registers[event.bucket], event.rank);
}

function* registerUpdates() {
  const registers = emptyRegisters();
  const seen = new Set();

  yield {
    state: registerState(registers, '8 registers, zero exact user IDs'),
    highlight: {},
    explanation: 'HyperLogLog estimates COUNT DISTINCT without storing the distinct items. It keeps a small array of registers. Hash an item, use some bits to choose a bucket, then use the remaining bits to measure how rare the hash looked. Long runs of leading zeros are rare; seeing one is evidence that many distinct items have passed through.',
  };

  for (const event of EVENTS) {
    const before = registers[event.bucket];
    seen.add(event.key);
    yield {
      state: registerState(registers, `hash(${event.key}) -> bucket ${event.bucket}, suffix ${event.suffix}`),
      highlight: { active: [`r${event.bucket}:rank`] },
      explanation: `Event "${event.key}" hashes to bucket ${event.bucket}. Its suffix starts with a leading-zero run that gives rank ${event.rank}. The bucket currently stores ${before}, so the update is max(${before}, ${event.rank}). Duplicates are naturally harmless: the same key hashes to the same bucket and same rank, so max does not move.`,
      invariant: 'Each register stores the most surprising zero-run seen for that bucket.',
    };
    update(registers, event);
    const { corrected } = estimate(registers);
    yield {
      state: registerState(registers, `after ${event.key}: estimate ${corrected.toFixed(1)} distinct`),
      highlight: { found: [`r${event.bucket}:rank`] },
      explanation: `Register ${event.bucket} now stores ${registers[event.bucket]}. Exact distinct count so far is ${seen.size}; HyperLogLog estimates ${corrected.toFixed(1)}. With only 8 buckets this toy sketch wobbles. Real systems use thousands or millions of registers, where the relative error falls near 1.04 / sqrt(m).`,
    };
  }

  const { raw, zeros, corrected } = estimate(registers);
  yield {
    state: registerState(registers, `final raw ${raw.toFixed(1)}, corrected ${corrected.toFixed(1)}`),
    highlight: { compare: ['r0:rank', 'r1:rank', 'r2:rank', 'r3:rank', 'r5:rank', 'r6:rank', 'r7:rank'] },
    explanation: `Final sketch: ${seen.size} exact distinct users, ${corrected.toFixed(1)} estimated. The estimate comes from the harmonic mean of 2^register across buckets, with a small-range correction because ${zeros} buckets are still zero. The structure is a cousin of Count-Min Sketch: both hash streams into compact summaries, but Count-Min estimates frequencies while HyperLogLog estimates cardinality.`,
  };
}

function* mergeAndError() {
  const a = emptyRegisters();
  const b = emptyRegisters();
  for (const event of EVENTS.slice(0, 5)) update(a, event);
  for (const event of EVENTS.slice(5)) update(b, event);
  const merged = a.map((value, i) => Math.max(value, b[i]));
  const all = emptyRegisters();
  for (const event of EVENTS) update(all, event);

  yield {
    state: matrixState({
      title: 'Two shards, one merge rule: register-wise max',
      rows: ROWS,
      columns: [
        { id: 'a', label: 'shard A' },
        { id: 'b', label: 'shard B' },
        { id: 'm', label: 'merged' },
      ],
      values: ROWS.map((_, i) => [a[i], b[i], merged[i]]),
      format: String,
    }),
    highlight: { active: ['r2:m', 'r0:m'], compare: ['r2:a', 'r2:b'] },
    explanation: 'HyperLogLog merges exactly the way its update works: take the max register value per bucket. That means every service, region, or stream partition can count locally, then merge sketches without raw user IDs. This is why it appears in analytics databases and observability systems.',
    invariant: 'Same hash seeds plus register-wise max equals a sketch of the union.',
  };

  yield {
    state: matrixState({
      title: 'Merged sketch equals one sketch over the whole stream',
      rows: [
        { id: 'single', label: 'single sketch' },
        { id: 'merged', label: 'merged shards' },
        { id: 'exact', label: 'exact Hash Table' },
      ],
      columns: [
        { id: 'memory', label: 'memory' },
        { id: 'answer', label: 'answer' },
        { id: 'canlist', label: 'can list users?' },
      ],
      values: [
        [10, Math.round(estimate(all).corrected), 20],
        [10, Math.round(estimate(merged).corrected), 20],
        [11, new Set(EVENTS.map((event) => event.key)).size, 21],
      ],
      format: (value) => {
        if (value === 10) return 'fixed registers';
        if (value === 11) return 'grows with distinct IDs';
        if (value === 20) return 'no';
        if (value === 21) return 'yes';
        return String(value);
      },
    }),
    highlight: { found: ['single:answer', 'merged:answer'], compare: ['exact:memory'] },
    explanation: 'The sketch cannot list the users and cannot answer membership. Bloom Filter answers approximate membership; Roaring Bitmaps answer exact set questions; HyperLogLog answers one question extremely well: approximately how many distinct things were there?',
  };

  yield {
    state: matrixState({
      title: 'When approximate cardinality is the right tool',
      rows: [
        { id: 'good1', label: 'unique visitors' },
        { id: 'good2', label: 'distinct search queries' },
        { id: 'good3', label: 'fraud monitoring' },
        { id: 'bad', label: 'billing / permissions' },
      ],
      columns: [
        { id: 'fit', label: 'fit' },
        { id: 'why', label: 'why' },
      ],
      values: [
        [1, 2],
        [1, 3],
        [1, 4],
        [0, 5],
      ],
      format: (value) => ['', 'yes', 'huge traffic, small error ok', 'trends over exact IDs', 'cardinality alert, exact check later', 'needs exact truth'][value],
    }),
    highlight: { found: ['good1:fit', 'good2:fit', 'good3:fit'], removed: ['bad:fit'] },
    explanation: 'Use HyperLogLog where exact COUNT DISTINCT is expensive and a few percent error is operationally fine. Do not use it when exact identity matters. The platform pattern is recurring: sketches produce cheap signals, exact stores verify important decisions.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'register updates') yield* registerUpdates();
  else if (view === 'merge and error') yield* mergeAndError();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
        'The animation shows registers, which are small counters stored in buckets. Each incoming item is hashed; the first hash bits choose a bucket, and the remaining bits produce a rank from the number of leading zeros. Active cells are candidate updates, and unchanged cells show duplicates or weaker evidence.',
        {type: 'callout', text: 'HyperLogLog keeps the most surprising hash event per bucket, then turns many noisy bucket guesses into one stable cardinality estimate.'},
        'Read the estimate line as a noisy measurement, not a true count. The safe inference rule is that duplicate items hash to the same bucket and rank, so they do not change the max register. The merge view shows the distributed rule: take the register-wise maximum.',
      
        {type: 'image', src: './assets/gifs/hyperloglog.gif', alt: 'Animated walkthrough of the hyperloglog visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    { heading: 'Why this exists', paragraphs: [
        'Cardinality means the number of distinct items in a stream. Unique visitors, distinct queries, source IPs, and error fingerprints all ask this question. Exact counting stores every distinct identity, so memory grows with the answer.',
        'For 100 million distinct 64-bit IDs, an exact set needs at least 800 MB before hash-table overhead. HyperLogLog estimates the same number with fixed memory, often kilobytes. It is useful when bounded relative error is cheaper than storing raw identities.',
      ], },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious approach is a hash set. Insert each item, ignore duplicates, and return set.size. It is exact, easy to explain, and correct for one counter that fits in memory.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Hash_table_3_1_1_0_1_0_0_SP.svg/500px-Hash_table_3_1_1_0_1_0_0_SP.svg.png', alt: 'Hash table with keys distributed into bucket slots', caption: 'The exact approach keeps identities in hash buckets, so memory follows the number of distinct keys. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Hash_table_3_1_1_0_1_0_0_SP.svg'},
        'The approach breaks when you need thousands of counters or distributed merging. One million counters cannot each keep a growing set. Merging exact sets across shards also means moving raw identities over the network.',
      ], },
    { heading: 'The wall', paragraphs: [
        'Every exact method pays memory proportional to distinct elements. A billion-event stream with 100 million distinct IDs still needs space for those 100 million IDs. Sampling reduces memory but biases distinct counts because rare items vanish first.',
        'Bitmaps delay the wall but do not remove it. Once most bits are set, new distinct items stop changing the bitmap often enough to preserve accuracy. The needed object is fixed-size state with a merge rule that never touches raw IDs.',
      ], },
    { heading: 'The core insight', paragraphs: [
        'A uniform hash behaves like coin flips. The chance of seeing k leading zeros is 1 / 2^k, so a long zero run is evidence that many distinct hashes have been tried. One maximum leading-zero run estimates cardinality, but it is very noisy.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Bloom_filter.svg/500px-Bloom_filter.svg.png', alt: 'Bloom filter diagram showing hash functions setting bits in a compact array', caption: 'Bloom filters and HyperLogLog both trade raw identities for compact hash-derived state; the difference is the query, membership for Bloom filters and cardinality for HyperLogLog. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Bloom_filter.svg'},
        'HyperLogLog splits the stream into many buckets and keeps one maximum rank per bucket. Each bucket gives a noisy estimate for its slice. The harmonic mean combines them while damping extreme outliers.',
      ], },
    { heading: 'How it works', paragraphs: [
        'Choose m = 2^p registers. Hash each item to a bit string; the first p bits choose register j. Count leading zeros in the remaining bits, add one, and set register[j] = max(register[j], rank).',
        'To estimate, compute alpha_m * m^2 / sum(2^-register[j]). The alpha_m constant corrects bias. When many registers are zero, linear counting m * ln(m / V) is used, where V is the number of zero registers.',
      ], },
    { heading: 'Why it works', paragraphs: [
        'Each register tracks the most surprising hash event in its bucket. The maximum of many geometric events concentrates around log2(number of distinct items in that bucket). Many registers reduce variance by averaging independent bucket estimates.',
        'Merge correctness comes from max. If two sketches use the same hash and m, taking max per register gives the same state as processing the union stream in one sketch. This is why shards can count locally and merge later without raw IDs.',
      ], },
    { heading: 'Cost and complexity', paragraphs: [
        'Insert is O(1): one hash, one bucket, one max comparison. Query is O(m) because the estimator scans all registers. Merge is O(m) because it takes register-wise maxima.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Bloom_filter_fp_probability.svg/500px-Bloom_filter_fp_probability.svg.png', alt: 'Chart of Bloom filter false positive probability as bit array density changes', caption: 'Probabilistic summaries make error a tunable engineering parameter. This Bloom filter curve is not HyperLogLog math, but it shows the same design habit: choose memory to bound acceptable error. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Bloom_filter_fp_probability.svg'},
        'Memory is m small registers, commonly 6 bits each. Standard error is about 1.04 / sqrt(m), so m = 1,024 gives about 3.25% error and m = 16,384 gives about 0.81% error. Doubling memory improves error by only about sqrt(2), so accuracy gets expensive slowly.',
      ], },
    { heading: 'Real-world uses', paragraphs: [
        'Redis exposes HyperLogLog through PFADD, PFCOUNT, and PFMERGE. The fit is fixed per-key memory for approximate unique counts, regardless of how many items pass through the key.',
        'Analytics databases use sketches for approximate COUNT DISTINCT. Each partition builds a local sketch, and the coordinator merges registers instead of shuffling raw IDs. Observability systems use the same pattern for unique devices, sources, queries, and error signatures.',
      ], },
    { heading: 'Where it fails', paragraphs: [
        'HyperLogLog cannot answer membership questions, list elements, or delete items. A register stores only the strongest rank seen, not which item caused it. If you need was user X seen, use a Bloom filter or exact set.',
        'It also fails when sketches are incompatible. Different hash functions, seeds, p values, or identity normalization rules make register-wise max meaningless. Use versioned sketch formats and keep exact counts for billing, permissions, and legal reporting.',
      ], },
    { heading: 'Worked example', paragraphs: [
        'Use p = 2, so m = 4 registers starting at [0, 0, 0, 0]. Hash A as 00|10110, so bucket 0 gets rank 1. Hash B as 01|00101, so bucket 1 gets rank 3. Hash C as 10|01100, so bucket 2 gets rank 2. Hash D as 11|00001, so bucket 3 gets rank 5.',
        'The registers become [1, 3, 2, 5]. The denominator is 2^-1 + 2^-3 + 2^-2 + 2^-5 = 0.90625. With alpha_4 about 0.532, the raw estimate is 0.532 * 16 / 0.90625 = 9.39 for a true count of 4, showing why tiny m is noisy. Larger m reduces that variance.',
      ], },
    { heading: 'Sources and study next', paragraphs: [
        'Primary sources are Flajolet et al., HyperLogLog, 2007, Durand and Flajolet, LogLog, 2003, and Heule, Nunkesser, and Hall, HyperLogLog in Practice, 2013. The last paper explains HLL++ bias correction and sparse representation.',
        'Study hash functions first, because uniform hash bits are the estimator. Study Bloom filters for approximate membership, Count-Min Sketch for frequencies, and reservoir sampling for fixed-memory stream summaries with different guarantees.',
      ], },
  ],
};
