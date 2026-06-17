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
      heading: 'Why this exists',
      paragraphs: [
        'COUNT DISTINCT is expensive when the stream is huge, distributed, or privacy-sensitive. Exact sets store every distinct user, IP, URL, token, product, or session. HyperLogLog exists for the common analytics case where a small relative error is acceptable and the raw identities are too large to keep or move.',
        'The practical problem is everywhere: daily active users, distinct search queries, unique IPs per service, distinct files touched by a job, or unique devices seen by a fraud system. Exact counts require keeping identity. HyperLogLog keeps a fixed-size statistical trace instead.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The direct solution is a hash set of all seen identities. It is exact and can list members. It also grows with cardinality, duplicates require set lookups, and distributed union requires shipping or merging identity sets. Bitmaps help only when the id universe is bounded and reasonably dense.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A sample of identities can miss rare groups, and a simple bitset of hashed buckets saturates. The wall is estimating how many distinct hashes landed without remembering which hashes they were.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Use rarity in random hashes. Seeing a suffix with many leading zeros is unlikely unless many distinct items have appeared. HyperLogLog spreads items across buckets, records the largest zero-run rank per bucket, and combines those bucket-level rarity signals.',
      ],
    },
    {
      heading: 'Reading the visualization',
      paragraphs: [
        "In the register-updates view, read each register as the strongest rarity signal seen for one bucket. Duplicates do not matter because the same item hashes to the same bucket and rank; max does not move.",
        "In the merge view, watch the union rule. Two sketches built with the same hash scheme merge by register-wise max. That is the whole distributed-systems trick: the merged sketch behaves like one sketch over the union stream without moving raw identities.",
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Hash every item. Use the first p bits to choose one of m = 2^p registers. Use the remaining bits to compute a rank: one plus the leading-zero count. Update the chosen register with max(old, rank). Query combines registers with a harmonic mean and small-range correction when many registers are still empty.',
        'A long leading-zero run is rare. In a fair hash stream, about half the hashes start with 1, about a quarter start with 01, about an eighth start with 001, and so on. If one bucket has seen rank 10, the bucket probably received many distinct items. HyperLogLog collects that weak evidence across many buckets.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The maximum rank in a bucket is a noisy signal of how many distinct hashes reached that bucket. Splitting across many registers lowers variance, and the harmonic mean reduces the effect of extreme buckets. Merge works because union only needs the maximum rank seen per register.',
        'The estimator assumes hash outputs behave like independent random bits. That assumption is why the hash function matters. A biased or adversarial hash distribution can break the zero-run statistics and produce bad counts.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Update is O(1), query is O(m), merge is O(m), and memory is O(m) regardless of stream size. Standard error is roughly 1.04 / sqrt(m), so more registers improve accuracy predictably. The tradeoff is information loss: the sketch cannot list members, prove membership, or delete arbitrary items.',
      ],
    },
    {
      heading: 'Accuracy knobs',
      paragraphs: [
        'The register count is the main accuracy knob. More registers reduce standard error because the estimate averages more independent bucket signals. Fewer registers save memory but make the estimate jumpier, especially when the true cardinality is near the range where small-sample corrections matter.',
        'The hash function is part of the estimator, not an implementation detail. HyperLogLog assumes hash outputs look like independent random bits. If ids are hashed inconsistently across services, or if an adversary can shape hashes, register ranks stop representing rarity correctly.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'HyperLogLog fits Redis-style approximate distinct counts, database approximate COUNT DISTINCT, telemetry pipelines, ad-tech reporting, fraud monitoring, observability dashboards, and privacy-sensitive analytics. Shards can count locally and merge by register-wise max without moving raw identifiers.',
        'It is particularly strong for dashboards where trends and rough magnitude matter more than exact membership. A product team can compare daily unique devices, a platform team can merge per-region service sketches, and a data warehouse can answer approximate distinct questions without spilling enormous hash sets.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Do not use it for billing, permissions, destructive deduplication, or legal reporting where exact identity matters. Keep hash functions and register counts compatible before merging. Tiny sketches are noisy; the animation uses few registers for visibility, not as a production sizing recommendation.',
        'It also fails for deletion-heavy workloads unless the system uses a different design. A register stores only the maximum rank seen, not which item caused it. Removing an item cannot tell whether the max should fall back to the second-largest rank.',
        'Another common failure is mixing incompatible sketches. Different p values, hash functions, seeds, normalization rules, or identity definitions make register-wise max meaningless. Version the sketch format the same way you would version a persisted data file.',
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        'Normalize identities before hashing, choose p from an explicit error budget, and store sketch metadata with the registers. For distributed use, enforce the same hash and register count everywhere before allowing merge.',
        'Expose the estimate as approximate. Dashboards should show error expectations or confidence language, and pipelines should keep exact checks for audits where a wrong distinct count changes money, access, or legal obligations.',
      ],
    },
    {
      heading: 'How to choose it',
      paragraphs: [
        'Use HyperLogLog when the question is cardinality and identity is disposable. If the product needs to ask whether a particular item was seen, use a Bloom filter or set. If it needs counts per key, use a frequency sketch. If it needs exact enumeration, use a set, bitmap, or database table.',
        'Size it from the error budget. A sketch for an internal trend dashboard can tolerate more error than a customer-facing usage report. The memory choice should be written down in the same place as the metric definition, because changing register count changes the estimate behavior.',
        'For privacy-sensitive analytics, remember that a sketch is not automatically anonymous. It hides raw identities from the normal query path, but the pipeline still hashes identifiers and may be vulnerable to small-domain attacks. Treat source identifiers and hash salts according to the data policy.',
        'Use exact validation samples. Periodically compare sketch estimates against exact counts on bounded windows or sampled partitions. That catches hash changes, normalization mistakes, and accidental merges between incompatible sketch versions before dashboards drift for weeks.',
        'Document the identity definition. Unique users, unique devices, unique accounts, and unique sessions are different metrics even if they use the same sketch. Many bad approximate-count debates are actually disagreements about what was hashed.',
      ],
    },
    {
      heading: 'A worked case',
      paragraphs: [
        'Suppose a service has 200 shards and each shard sees user IDs locally. An exact global distinct count requires collecting or merging large identity sets. With HyperLogLog, each shard updates the same-size register array. The global count is computed by taking the max of register 0 across shards, the max of register 1 across shards, and so on.',
        'The result cannot tell you which users were present. It can tell you approximately how many distinct users appeared, with memory that does not grow with the number of users. That is the exact trade: cardinality signal instead of identity.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Flajolet, Fusy, Gandouet, and Meunier, "HyperLogLog: the analysis of a near-optimal cardinality estimation algorithm" at https://algo.inria.fr/flajolet/Publications/FlFuGaMe07.pdf. Study Count-Min Sketch, Bloom Filter, Roaring Bitmaps, Hash Table, Reservoir Sampling, and Message Queues to understand the sketching family inside production analytics.',
      ],
    },
  ],
};
