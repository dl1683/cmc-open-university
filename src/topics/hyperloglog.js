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
    {
      heading: `What it is`,
      paragraphs: [
        `HyperLogLog is a probabilistic data structure for approximate cardinality: how many distinct users, IPs, URLs, tokens, products, or sessions did we see? It does not store the items. It stores a fixed number of tiny registers and estimates the distinct count from the most surprising hash patterns observed.`,
        `The core intuition is rarity. In a random bit string, seeing one leading zero is common, two leading zeros is less common, and six leading zeros is rare. If a bucket ever sees a suffix with six leading zeros, that bucket is evidence that many distinct hashes have landed there. HyperLogLog spreads events across many buckets, then averages those rarity signals carefully.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Hash every item. Use the first p bits to choose one of m = 2^p registers. Use the remaining bits to compute a rank: one plus the number of leading zeros. Update that register with max(old, rank). At query time, combine all registers using a harmonic mean. Empty-register correction handles small cardinalities, while large systems use bias corrections and engineering refinements.`,
        `The merge rule is the same as the update rule: max per register. If shard A and shard B use the same hash function and same register count, their union sketch is register[i] = max(A[i], B[i]). That property makes HyperLogLog ideal for distributed analytics, where raw identifiers may be too large, too private, or too expensive to move.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Update is O(1), query is O(m), merge is O(m), and memory is O(m) regardless of stream size. The standard error is roughly 1.04 / sqrt(m), so increasing registers improves accuracy predictably. With 16,384 registers, typical relative error is under 1 percent. The tradeoff is information loss: the sketch estimates cardinality but cannot list members, delete arbitrary items, or prove membership.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `HyperLogLog appears in Redis, PostgreSQL extensions, Snowflake-style approximate distinct queries, stream processors, telemetry pipelines, ad-tech reporting, fraud monitoring, observability dashboards, and privacy-sensitive analytics. A Message Queues pipeline may sketch unique users per service per minute, merge sketches by region, and alert when distinct cardinality jumps.`,
        `Compared with Count-Min Sketch, HyperLogLog estimates distinct count, not per-key frequency. Compared with Bloom Filter, it does not answer "have I seen x?" Compared with Roaring Bitmaps, it is much smaller but approximate and non-enumerable. These three pages form a useful triangle: approximate membership, approximate frequency, and approximate cardinality.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Do not use HyperLogLog where exact identity matters: billing, permissions, deduplication that deletes data, or legal reporting. It is a measurement instrument, not a source of truth. Also keep hash seeds stable; merging sketches built with different hash functions is meaningless. Finally, tiny sketches are noisy. The toy animation uses eight registers so you can see every bucket, not because eight is a production configuration.`,
      ],
    },
    {
      heading: `Sources and study next`,
      paragraphs: [
        `Primary source: Flajolet, Fusy, Gandouet, and Meunier, "HyperLogLog: the analysis of a near-optimal cardinality estimation algorithm" at https://algo.inria.fr/flajolet/Publications/FlFuGaMe07.pdf. Study Count-Min Sketch, Bloom Filter, Roaring Bitmaps, Hash Table, Reservoir Sampling, and Message Queues to understand the sketching family inside production analytics.`,
      ],
    },
  ],
};
