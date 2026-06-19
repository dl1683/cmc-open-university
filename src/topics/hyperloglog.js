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
      heading: 'How to read the animation',
      paragraphs: [
        'The register-updates view shows eight buckets numbered 0 through 7, each storing one integer: the longest leading-zero run seen so far for that bucket. Each incoming item is hashed. The first few hash bits pick the bucket; the remaining bits are scanned for leading zeros, and the count plus one becomes the rank. When the rank exceeds the bucket\'s stored value, the cell lights up and the value rises. When it does not, nothing changes -- the max is already higher.',
        'Watch for "u17" and "u42" appearing twice. Duplicates hash identically, so they always land in the same bucket with the same rank. The max never moves. This is how HyperLogLog ignores duplicates without storing them.',
        'The title line tracks the running cardinality estimate -- the harmonic-mean formula applied to the current register state -- next to the exact distinct count. The gap between the two is the estimation error. With only 8 registers the error is large; with 16,384 registers it drops below 1%.',
        'The merge view splits the stream across two shards. Merging takes the register-wise max: for each bucket, keep whichever shard saw the longer zero-run. The merged sketch is identical to a single sketch over the combined stream. That visual identity is the entire distributed-counting trick.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        '"How many distinct elements passed through this stream?" is one of the most common analytics questions: unique visitors, distinct search queries, unique source IPs, different error fingerprints. The exact answer requires storing every distinct element -- memory proportional to the number of unique items. For 100 million distinct 64-bit IDs, that is 800 MB per counter.',
        'HyperLogLog answers the same question approximately, using fixed memory that never grows with the stream. With 16,384 registers (12 KB total), it estimates cardinalities from zero to billions with a standard error of about 0.81%. Flajolet, Fusy, Gandouet, and Meunier introduced it in 2007, building on Flajolet and Martin\'s 1985 probabilistic counting and the 2003 LogLog algorithm. The key advance: replacing the geometric mean with a harmonic mean, cutting the standard error from 1.30/sqrt(m) to 1.04/sqrt(m) without using more memory.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Insert every element into a hash set. The set\'s size is the exact distinct count at any moment. For a website with 10 million unique visitors stored as 4-byte IDs, the set costs roughly 40 MB. One counter is manageable.',
        'Scale breaks it. Run 1,000 such counters -- one per page, per hour, per region -- and the cost is 40 GB. In a distributed system, merging two hash sets means transmitting and deduplicating all raw identities across the network. Sampling helps with memory but biases the count: infrequent visitors vanish from a 1% sample, so distinct counts systematically undercount.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Every exact method ties memory to cardinality. A billion-event stream with 100 million distinct 64-bit IDs requires 800 MB per counter just for the set. Bitmaps indexed by hash (set bit h(x) mod B for each item) help for a while, but once most bits are set, accuracy collapses. Linear counting hits the same saturation ceiling.',
        'The fundamental barrier: memory that grows with distinct elements, or accuracy that degrades as cardinality rises. What is needed is fixed-size memory, bounded relative error, and a merge operation that never touches raw identities.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A good hash function makes each output bit look like an independent fair coin flip. The probability of seeing k leading zeros in a row is exactly 1/2^k -- the same odds as flipping k heads consecutively. If the longest leading-zero run you have ever observed is k, roughly 2^k distinct items have passed through. One integer tracking the maximum leading-zero run is already a cardinality estimator. It is wildly noisy, but it uses almost no memory.',
        'To tame the noise, split items into m = 2^p buckets using the first p hash bits. Keep one max-leading-zeros register per bucket. Each register independently estimates the cardinality of its slice. Combine them through the harmonic mean of 2^(register value) across all buckets. The harmonic mean dampens the outliers that make any single register unreliable. Result: standard error of 1.04/sqrt(m), using m registers of about 6 bits each. Flajolet called this technique stochastic averaging.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Hash each incoming element to a fixed-width binary string. The first p bits select one of m = 2^p registers. From the remaining bits, compute the rank: count the leading zeros and add one. Update the register: register[j] = max(register[j], rank). That is the entire insert -- one hash, one comparison, one possible write.',
        'To estimate cardinality, compute E = alpha_m * m^2 / sum(2^(-register[j])), where the sum runs over all m registers. The constant alpha_m corrects a multiplicative bias; it equals approximately 0.7213 / (1 + 1.079/m) for large m. This formula is the harmonic mean of 2^(register value), scaled by m^2.',
        'Two corrections handle edge cases. At small cardinalities where many registers are still zero, the raw estimate overshoots. Linear counting replaces it: E = m * ln(m / V), where V is the number of zero registers. At very large cardinalities near 2^32, a large-range correction prevents hash collisions from saturating the estimate. Google\'s HLL++ (Heule et al. 2013) adds an empirical bias-correction table for the medium range and a sparse representation for the early phase when most registers are empty.',
        'The harmonic mean is critical. An arithmetic mean of 2^(register value) would let one outlier register with rank 30 swamp all the others. The harmonic mean naturally discounts extremes -- exactly the right behavior when individual registers have high variance but the collection is statistically stable.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Each register tracks the most extreme coin-flip run in its bucket. The maximum of n independent geometric random variables concentrates around log2(n). With m registers each seeing roughly n/m items, each register independently estimates the cardinality of its slice. The harmonic mean across registers cancels the wild swings of any single one. This variance reduction is what makes the structure practical: one register is a toy; thousands of registers are a precision instrument.',
        'Merge works because max is associative and commutative. Two sketches built with the same hash function and register count merge by taking the register-wise maximum. The result is identical to a single sketch built over the union of both streams. No raw identities cross the wire. This composability is why HyperLogLog appears in every distributed analytics system.',
        'Correctness depends entirely on the hash function producing outputs indistinguishable from uniform random bits. A biased or adversarial hash breaks the leading-zero statistics. The hash function is part of the estimator, not an implementation detail.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Insert: O(1) -- one hash, one comparison, one possible register write. Query: O(m) -- scan all registers and compute the harmonic-mean sum. Merge: O(m) -- register-wise max. Memory: m registers of ceil(log2(log2(N_max))) bits each. In practice, 6-bit registers handle cardinalities up to 2^63, so total memory is m * 6 bits.',
        'Concrete sizing: m = 64 (p=6) gives ~13% standard error in 48 bytes. m = 1,024 (p=10) gives ~3.25% in 768 bytes. m = 16,384 (p=14) gives ~0.81% in 12 KB. Redis uses p=14. Doubling m halves the standard error and doubles the memory -- a clean linear tradeoff. The memory never grows with the stream. Twelve kilobytes handles cardinalities from zero to billions with the same accuracy.',
        'Pick m from your error budget. 5% error needs m >= 433 (round up to 512, 384 bytes). 1% error needs m >= 10,816 (round to 16,384, 12 KB). 0.5% error needs m >= 43,264 (round to 65,536, 48 KB). All of these are tiny compared to exact sets at any interesting cardinality.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Redis exposes HyperLogLog as a first-class type. PFADD inserts items, PFCOUNT returns the approximate distinct count, PFMERGE unions multiple sketches. Each key uses 12 KB. A single Redis instance can maintain millions of independent cardinality counters at negligible memory cost because the memory per counter is fixed regardless of how many items flow through.',
        'Analytics databases use it to avoid the full-shuffle join that exact COUNT DISTINCT requires across distributed storage. BigQuery\'s APPROX_COUNT_DISTINCT, Presto, ClickHouse, and Druid all push HyperLogLog sketches down to individual partitions and merge register-wise at the coordinator. The query runs in partition-local time instead of global-deduplication time.',
        'Network monitoring and observability systems count unique visitors per page, distinct queries per hour, unique devices per campaign, and distinct error fingerprints per deploy. Each shard counts locally. Sketches merge by register-wise max without transmitting raw identifiers -- no coordination, no deduplication pass, no raw-ID transfer.',
        'Streaming engines like Apache Flink and Spark use HyperLogLog for distinct counts over unbounded event streams, where an exact set would eventually exhaust memory no matter how much is available.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'No membership test. A Bloom filter can answer "was user X seen?" -- HyperLogLog cannot. It cannot enumerate elements, cannot report which items were distinct, and cannot delete items. Each register stores only the maximum rank, not which item produced it, so there is no way to undo an insert.',
        'No intersection. Union is free (register-wise max), but intersection requires the inclusion-exclusion formula |A intersect B| = |A| + |B| - |A union B|, and the relative error explodes when the intersection is small compared to the union. For set intersection, use a different structure.',
        'Bias at small cardinalities. When most registers are still zero, the raw harmonic-mean estimate overshoots. Linear counting handles this range, but the transition between corrections can introduce a bump in accuracy. HLL++ adds an empirical bias table to smooth this region.',
        'Incompatible sketches fail silently. Different p values, hash functions, seeds, or identity normalization rules make register-wise max meaningless. Two sketches that look structurally identical produce garbage when merged if they were built with different configurations. Version the sketch format the same way you would version any persisted data structure.',
        'Do not use it for billing, permissions, or legal reporting where exact counts matter. Expose estimates as "roughly N" or "N +/- X%" in user-facing surfaces, and keep an exact fallback for auditable windows.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Set p = 2, so m = 4 registers, all starting at zero. Five elements arrive. Each hash is split: the first 2 bits pick the register, the remaining bits determine the rank (leading zeros + 1).',
        'Element A: hash 00|10110. Register 0. Remaining bits 10110: first bit is 1, so zero leading zeros, rank = 0 + 1 = 1. Register[0] = max(0, 1) = 1.',
        'Element B: hash 01|00101. Register 1. Remaining bits 00101: two leading zeros before the first 1, rank = 2 + 1 = 3. Register[1] = max(0, 3) = 3.',
        'Element C: hash 10|01100. Register 2. Remaining bits 01100: one leading zero, rank = 1 + 1 = 2. Register[2] = max(0, 2) = 2.',
        'Element D: hash 11|00001. Register 3. Remaining bits 00001: four leading zeros, rank = 4 + 1 = 5. Register[3] = max(0, 5) = 5.',
        'Element A again: hash 00|10110. Same register, same rank. Register[0] = max(1, 1) = 1. No change. The duplicate is absorbed for free.',
        'Final registers: [1, 3, 2, 5]. Harmonic-mean denominator: 2^(-1) + 2^(-3) + 2^(-2) + 2^(-5) = 0.5 + 0.125 + 0.25 + 0.03125 = 0.90625. With alpha_4 approximately 0.532, the raw estimate is 0.532 * 16 / 0.90625 = 9.39. True distinct count: 4. The large overshoot is expected with only 4 registers -- variance is enormous at this scale. No zero registers remain (V = 0), so the linear-counting correction does not apply. With m = 16,384 the same stream would estimate within 1% of truth.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Flajolet, Fusy, Gandouet, and Meunier, "HyperLogLog: the analysis of a near-optimal cardinality estimation algorithm" (2007) -- the foundational paper deriving the harmonic-mean estimator, the alpha_m correction, and the 1.04/sqrt(m) error bound. Durand and Flajolet, "LogLog counting of large cardinalities" (2003) -- the predecessor using geometric mean, with weaker error at 1.30/sqrt(m). Heule, Nunkesser, and Hall, "HyperLogLog in practice: algorithmic engineering of a state-of-the-art cardinality estimation algorithm" (2013) -- Google\'s HLL++ with empirical bias correction for medium cardinalities, sparse-to-dense promotion, and 64-bit hashes.',
        'Study next: Bloom Filter for approximate membership -- "was this item seen?" is the natural complement to "how many distinct items were there?" Count-Min Sketch for streaming frequency estimation -- "how often did this item appear?" uses the same hash-into-registers pattern but answers a different question. Hash Functions for the mathematical foundation HyperLogLog depends on -- hash quality directly determines estimate quality. Reservoir Sampling for maintaining a uniform random sample from a stream in fixed memory.',
      ],
    },
  ],
};
