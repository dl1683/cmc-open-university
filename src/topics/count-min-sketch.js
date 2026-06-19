// Count-Min Sketch: a streaming frequency table that never stores the keys.
// It keeps several hashed counter rows; every update increments one counter
// per row; every query returns the minimum row estimate.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'count-min-sketch',
  title: 'Count-Min Sketch',
  category: 'Data Structures',
  summary: 'Approximate counts for endless streams: hash each event into several counter rows, then take the minimum estimate.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['stream counts', 'heavy hitters and merge'], defaultValue: 'stream counts' },
  ],
  run,
};

const WIDTH = 8;
const ROWS = [
  { id: 'h0', label: 'hash 1' },
  { id: 'h1', label: 'hash 2' },
  { id: 'h2', label: 'hash 3' },
];
const COLUMNS = Array.from({ length: WIDTH }, (_, i) => ({ id: `c${i}`, label: String(i) }));
const STREAM = ['login', 'search', 'login', 'checkout', 'bot', 'login', 'search', 'bot', 'login'];

// Hand-picked deterministic positions so the lesson has visible collisions.
const HASH_POSITIONS = new Map([
  ['login', [0, 4, 6]],
  ['search', [3, 2, 0]],
  ['checkout', [1, 2, 7]],
  ['bot', [5, 4, 6]],
  ['fraud', [0, 2, 7]],
  ['purchase', [6, 1, 3]],
]);

function emptySketch() {
  return Array.from({ length: ROWS.length }, () => new Array(WIDTH).fill(0));
}

function positionsFor(key) {
  const known = HASH_POSITIONS.get(key);
  if (known) return known;
  let seed = 17;
  for (const ch of key) seed = (seed * 31 + ch.charCodeAt(0)) % 997;
  return [seed % WIDTH, (seed * 5 + 1) % WIDTH, (seed * 11 + 3) % WIDTH];
}

function cellIdsFor(key) {
  return positionsFor(key).map((c, r) => `${ROWS[r].id}:c${c}`);
}

function sketchState(sketch, title) {
  return matrixState({
    title,
    rows: ROWS,
    columns: COLUMNS,
    values: sketch.map((row) => [...row]),
    format: String,
  });
}

function increment(sketch, key) {
  positionsFor(key).forEach((column, row) => {
    sketch[row][column] += 1;
  });
}

function estimate(sketch, key) {
  return Math.min(...positionsFor(key).map((column, row) => sketch[row][column]));
}

function trueCounts(stream) {
  const counts = new Map();
  for (const key of stream) counts.set(key, (counts.get(key) ?? 0) + 1);
  return counts;
}

function buildSketch(stream) {
  const sketch = emptySketch();
  for (const key of stream) increment(sketch, key);
  return sketch;
}

function* streamCounts() {
  const sketch = emptySketch();

  yield {
    state: sketchState(sketch, 'Three rows of counters, all zero'),
    highlight: {},
    explanation: 'A Count-Min Sketch is what you reach for when the stream is too large for an exact Hash Table. It never stores keys. Each event is hashed into one counter in each row, and each of those counters increments. Query later by reading the same positions and taking the MINIMUM. Minimum matters because collisions only add extra count; they never subtract.',
  };

  for (const [i, key] of STREAM.entries()) {
    yield {
      state: sketchState(sketch, `event ${i + 1}: ${key}`),
      highlight: { active: cellIdsFor(key) },
      explanation: `Event ${i + 1}: "${key}" lands in cells ${positionsFor(key).join(', ')} across the three hash rows. The sketch touches exactly three counters, no matter how many distinct keys have appeared. This is the streaming bargain: bounded memory, constant update time, and approximate answers.`,
    };
    increment(sketch, key);
    yield {
      state: sketchState(sketch, `after inserting ${key}`),
      highlight: { found: cellIdsFor(key) },
      explanation: `The three counters for "${key}" increased. If another key shares one cell, that row will overstate "${key}" later. But as long as at least one row avoids the collision, the minimum row recovers the exact count. More rows lower error probability; wider rows lower collision pressure.`,
      invariant: 'Every row is an overestimate of the true count. The minimum row is the least polluted overestimate.',
    };
  }

  for (const key of ['login', 'bot', 'fraud']) {
    const est = estimate(sketch, key);
    const truth = trueCounts(STREAM).get(key) ?? 0;
    yield {
      state: sketchState(sketch, `query "${key}": min(${positionsFor(key).map((c, r) => sketch[r][c]).join(', ')}) = ${est}`),
      highlight: { compare: cellIdsFor(key) },
      explanation: truth === est
        ? `query("${key}") reads the same three cells and returns min = ${est}. The true count is ${truth}, so this query is exact: at least one row stayed collision-free for this key.`
        : `query("${key}") returns ${est}, but the true count is ${truth}. This is the allowed error: all three rows collided with real traffic, so the sketch hallucinated extra frequency. Count-Min never undercounts; it can only overcount.`,
    };
  }
}

function* heavyHittersAndMerge() {
  const sketch = buildSketch(STREAM);
  const counts = trueCounts(STREAM);
  const rows = ['login', 'search', 'bot', 'checkout', 'fraud'].map((key) => ({ id: key, label: key }));

  yield {
    state: matrixState({
      title: 'Candidate heavy hitters: exact vs sketch estimate',
      rows,
      columns: [
        { id: 'true', label: 'true' },
        { id: 'estimate', label: 'estimate' },
        { id: 'error', label: 'over by' },
      ],
      values: rows.map((row) => {
        const truth = counts.get(row.id) ?? 0;
        const est = estimate(sketch, row.id);
        return [truth, est, est - truth];
      }),
      format: String,
    }),
    highlight: { found: ['login:estimate'], compare: ['fraud:error'] },
    explanation: 'Heavy-hitter pipelines use the sketch as a cheap first pass: keep candidates whose estimated counts cross a threshold, then verify the expensive ones exactly if needed. The estimate is biased upward, so it is safe for alerting and candidate generation, not safe for billing or deleting a user. "fraud" never appeared, but its hash path collided with real traffic and reports 1.',
    invariant: 'Approximate structures should usually feed a verifier; they are filters, not final courts.',
  };

  const shardA = buildSketch(STREAM.slice(0, 5));
  const shardB = buildSketch(STREAM.slice(5));
  const merged = shardA.map((row, r) => row.map((value, c) => value + shardB[r][c]));

  yield {
    state: sketchState(shardA, 'Shard A sketch: first five events'),
    highlight: { active: ['h0:c0', 'h1:c4', 'h2:c6'] },
    explanation: 'Sketches merge perfectly if they use the same width and the same hash functions. A stream processor can sketch one partition per machine, then add counter matrices cell by cell. No raw events need to move across the network.',
  };

  yield {
    state: sketchState(shardB, 'Shard B sketch: last four events'),
    highlight: { active: ['h0:c5', 'h1:c4', 'h2:c6'] },
    explanation: 'Shard B saw the rest of the stream. Notice that this is not a probabilistic merge rule. It is just addition: counter[i][j] from shard A plus counter[i][j] from shard B. The probability only lives in the hash collisions, not in the merge.',
  };

  yield {
    state: sketchState(merged, 'Merged sketch = A + B'),
    highlight: { found: cellIdsFor('login'), compare: cellIdsFor('bot') },
    explanation: `The merged sketch gives the same estimates as sketching the whole stream directly: login -> ${estimate(merged, 'login')}, bot -> ${estimate(merged, 'bot')}. This mergeability is why sketches show up in streaming analytics, telemetry, ad counters, DDoS detection, and distributed logs. Reservoir Sampling keeps representative examples; Count-Min Sketch keeps approximate frequencies.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'stream counts') yield* streamCounts();
  else if (view === 'heavy hitters and merge') yield* heavyHittersAndMerge();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows a d-by-w grid: three rows (one per hash function) and eight columns (counter buckets). Every cell starts at zero.',
        'When an event arrives, three cells light up -- one per row -- at the column positions chosen by each hash function. Those three counters increment by one; nothing else changes. When the sketch answers a query, it reads the same three positions and returns the smallest value. That minimum is the frequency estimate.',
        'Track "login" and "bot" through the stream. They collide in rows h1 and h2 (both land in columns 4 and 6), so those rows overcount both keys. Row h0 maps them to different columns (0 vs 5), keeping a clean witness. The min-query picks up that clean row and recovers the true count.',
        'The merge view adds two shard sketches cell by cell. The result equals a single sketch built over the combined stream, because addition preserves the overestimate invariant.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Streams produce keys -- IP addresses, search queries, product SKUs, ad impressions -- and someone needs to know how often each key appeared. Network monitoring needs per-IP request rates. Search engines rank autocomplete by query frequency. Ad platforms bill by impression count. Abuse detection flags accounts with too many login attempts.',
        'When the stream carries millions or billions of distinct keys, storing an exact counter for every one costs O(n) memory for n distinct items. Cormode and Muthukrishnan (2005) designed the Count-Min Sketch to answer frequency questions using fixed memory that depends only on the desired accuracy, not on the number of distinct keys.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'A hash map maps each key to an integer counter. Every event is an O(1) lookup and increment. Queries are an O(1) read. Answers are exact.',
        'A web server logging 1 billion distinct URLs needs one hash-map entry per URL. At roughly 50 bytes per entry (key storage, counter, hash-table overhead), that is 50 GB of memory for counting alone. Every edge node, analytics worker, and monitoring shard pays this cost independently.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Hash-map memory grows with the number of distinct keys, not with the accuracy you need. If you only care whether a key appeared roughly 10,000 times versus 100 times, you still pay to store every key that appeared once. Collapsing keys into fewer buckets does not help: when two keys share a bucket, their counts merge and you cannot tell which key contributed what. One collision destroys both estimates.',
        'The problem: bounding collision damage without storing the identity of every distinct key. The acceptable trade-off is overcounting (never undercounting), bounded by a tunable error parameter.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Use several independent hash functions, each mapping keys into its own row of counters. A collision in one row is unlikely to repeat in every row because the hash functions are independent. Query by reading all rows and returning the minimum. Collisions only add count -- they never subtract -- so the minimum selects the least polluted estimate. One clean row is enough to recover the exact count.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Allocate a table of d rows and w columns, all counters at zero. Each row owns one hash function that maps keys to columns 0 through w-1.',
        'Insert(x): compute h_1(x), h_2(x), ..., h_d(x). Increment counter[row][h_row(x)] in every row. Exactly d counters change per insert, regardless of how many distinct keys exist.',
        'Query(x): compute the same d positions. Read counter[row][h_row(x)] from every row. Return min(counter[0][h_1(x)], ..., counter[d-1][h_d(x)]).',
        'The key itself is never stored. The sketch cannot list its contents or enumerate frequent keys -- it only estimates the count of a key you already know to ask about. Heavy-hitter pipelines pair the sketch with a candidate tracker (Space-Saving, a heap, or a sampled exact window) to decide which keys to query.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Each counter cell accumulates the true counts of every key that hashes there. Key x contributes its true count c(x) to each of its d cells; other keys can only add more, never subtract. So every cell x touches reads at least c(x). Each row independently overestimates.',
        'Taking the minimum across d independent rows picks the row where x suffered the least collision noise. The error bound: P(estimate(x) > c(x) + epsilon * N) <= delta, where N is the total stream count, provided w = ceil(e / epsilon) and d = ceil(ln(1 / delta)). With width w, the expected overcount from collisions in any single row is at most epsilon * N. With d independent rows, the probability that every row exceeds that bound is at most delta.',
        'The guarantee is one-sided: Count-Min never underestimates. A missed spike is impossible. A false spike is possible and must be verified downstream.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Insert: O(d) time -- compute d hashes, increment d counters. Query: O(d) time -- compute d hashes, read d counters, take the minimum. Space: d * w counters, set entirely by the error parameters.',
        'Concrete numbers: for epsilon = 0.01, delta = 0.01, w = ceil(e / 0.01) = 272 columns, d = ceil(ln(100)) = 5 rows. That is 1,360 four-byte counters, about 5.3 KB. For 1 million distinct keys at epsilon = 0.001 and delta = 0.01, the hash map needs roughly 12 MB; the sketch uses 54 KB -- over 200x less memory, at the cost of approximate answers.',
        'Sketches with identical dimensions and hash seeds merge by cell-wise addition. Each shard sketches its local stream; the coordinator sums the matrices. The merged result is identical to a single sketch over the combined stream because addition preserves the overestimate property. No raw events cross the network.',
        'Doubling the stream length doubles the absolute error bound (epsilon * N) but does not change the table size. Halving epsilon doubles the width. Adding one row multiplies confidence by roughly e (each extra row multiplies delta by 1/e). In practice, d = 4 or 5 rows and a few hundred to a few thousand columns cover most production workloads.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Network traffic monitoring: edge nodes sketch per-IP request rates locally, merge sketches at the regional aggregator. The dashboard asks "which known IPs might have spiked?" and the sketch supplies safe upper bounds. Banning an IP still requires exact log lookup -- the sketch is the first filter, not the verdict.',
        'NLP and search: approximate word or n-gram frequency for autocomplete ranking, trending-query detection, and vocabulary filtering. The query stream is too large to count exactly on every serving node.',
        'Database query optimization: a query planner estimates predicate selectivity from sketched column-value frequencies. The overestimate bias is tolerable because plan cost estimates are already approximate.',
        'Ad tech and streaming analytics: impression counting, click-through-rate estimation, A/B-test event tallies across distributed workers. The pattern is always the same -- sketch for cheap candidate detection, exact store for the few decisions that carry consequences.',
        'Anomaly and abuse detection: login-attempt counts per account or IP. A high sketch estimate triggers investigation; enforcement waits for verified counts. Apache Spark and Apache Flink both include Count-Min Sketch implementations for exactly these streaming use cases.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Overcounts, never undercounts. If exact lower bounds matter -- billing, inventory, contractual rate limits -- the sketch alone is not safe. Treat every sketch estimate as a candidate signal, not ground truth.',
        'No key enumeration. The sketch answers "how often did X appear?" but not "which keys appeared most?" A separate candidate tracker like Space-Saving is needed to surface heavy hitters.',
        'Skewed streams amplify error. A dominant key collides with most other keys in most rows, inflating estimates across the board. The absolute error bound epsilon * N grows with total stream volume, so hot streams need wider tables.',
        'No deletion. Decrementing a counter breaks the one-sided guarantee because you might subtract another key\'s contribution. Count-Mean-Min Sketch and conservative updates reduce bias; Count Sketch supports signed (turnstile) updates where counts can increase and decrease.',
        'For cardinality estimation ("how many distinct keys?") rather than frequency estimation ("how often did this key appear?"), HyperLogLog is the right tool. Count-Min Sketch and HyperLogLog answer different questions.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Setup: w = 5 columns, d = 2 rows. Hash functions (hand-picked for clarity): h1("cat") = 0, h2("cat") = 2. h1("dog") = 3, h2("dog") = 0. h1("fish") = 0, h2("fish") = 4. All counters start at zero.',
        'Insert "cat" three times. After three inserts: row 0, col 0 = 3; row 1, col 2 = 3. Query("cat") = min(3, 3) = 3. Exact.',
        'Insert "dog" twice. Row 0, col 3 = 2; row 1, col 0 = 2. Query("dog") = min(2, 2) = 2. Exact. No collision with "cat" because their positions differ in both rows.',
        'Insert "fish" once. Row 0, col 0 goes from 3 to 4 -- "fish" collides with "cat" in row 0. Row 1, col 4 = 1. Query("fish") = min(4, 1) = 1. Exact, because row 1 stayed clean.',
        'Query("cat") after "fish": row 0 reads 4 (polluted by "fish"), row 1 reads 3 (clean). min(4, 3) = 3. Still exact -- the clean row rescues the estimate.',
        'Now the collision cost is visible. Row 0, col 0 holds 4 (3 from "cat" + 1 from "fish"). Any future key that hashes to row 0, col 0 will inherit that inflated count in that row. But as long as at least one row avoids the collision, the min-query recovers the true count. More rows mean more independent chances to avoid collisions; wider rows mean fewer collisions per row.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Cormode and Muthukrishnan, "An Improved Data Stream Summary: The Count-Min Sketch and its Applications" (2005). Estan and Varghese, "New Directions in Traffic Measurement and Accounting" (2003), provides the heavy-hitter detection context that motivates most deployments.',
        'Prerequisites: Hash Table (exact counting baseline and hash-function mechanics), Bloom Filter (probabilistic membership -- the closest cousin in the family of hash-based approximate structures).',
        'Extensions: Conservative Count-Min Sketch (reduces overestimate bias by only incrementing cells that equal the current minimum), Count Sketch (supports signed updates where counts can decrease), Space-Saving (retains candidate identities that Count-Min discards).',
        'Contrast: HyperLogLog answers "how many distinct items?" -- cardinality, not frequency. Reservoir Sampling keeps representative stream samples. T-Digest and DDSketch estimate streaming quantiles. Each solves a different streaming question with a different probabilistic tradeoff.',
      ],
    },
  ],
};
