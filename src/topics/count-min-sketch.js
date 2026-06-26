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
        'The grid on screen has three rows and eight columns. Each row belongs to one hash function. Each column is a counter bucket. Every cell starts at zero.',
        {
          type: 'callout',
          text: 'The sketch wins by turning many exact counters into a few rows of bounded overestimates and trusting the least polluted row.',
        },
        'When an event like "login" arrives, each of the three hash functions picks one column in its row. Those three cells increment by one. Nothing else in the table changes. To query the frequency of "login" later, the sketch reads the same three cells and returns the smallest value. That minimum is the estimate.',
        'Watch "login" and "bot" carefully. They collide in rows h1 and h2 -- both land in columns 4 and 6 -- so those two rows overcount both keys. But row h0 maps "login" to column 0 and "bot" to column 5. That row stays clean. The min-query picks up the clean row and returns the true count despite the collisions elsewhere.',
        'The heavy-hitters-and-merge view splits the stream across two shards, sketches each shard independently, then adds the two matrices cell by cell. The merged sketch gives the same estimates as a single sketch over the combined stream. This works because addition preserves the overestimate property: if every cell in sketch A overestimates and every cell in sketch B overestimates, their sum also overestimates.',
        {type: 'image', src: './assets/gifs/count-min-sketch.gif', alt: 'Animated walkthrough of the count min sketch visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many systems produce a firehose of keyed events -- IP addresses hitting a firewall, search queries arriving at a web server, product SKUs scanned at checkout, ad impressions logged across a network. The question is always the same: how often has each key appeared? Network monitors need per-IP request rates to detect abuse. Search engines rank autocomplete suggestions by query frequency. Ad platforms bill advertisers by impression count.',
        'When the stream carries millions or billions of distinct keys, an exact counter per key costs O(n) memory for n distinct items. A firewall seeing 100 million distinct IPs at 50 bytes per hash-map entry burns 5 GB just for counting. Every edge node, every analytics shard, every monitoring worker pays this cost independently.',
        'Cormode and Muthukrishnan designed the Count-Min Sketch in 2005 to answer frequency questions using fixed memory. The table size depends only on two accuracy parameters -- how much error you tolerate and how confident you want to be -- not on how many distinct keys exist. A stream of 10 keys and a stream of 10 billion keys use the same table if you accept the same error.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'A hash map gives you exact answers. Map each key to an integer counter. Every event is an O(1) lookup and increment. Every query is an O(1) read. The answers are perfect.',
        'The problem is memory. A web server logging 1 billion distinct URLs needs one hash-map entry per URL. At roughly 50 bytes per entry (key string, counter integer, hash-table overhead for pointers and load factor), that is 50 GB of memory for counting alone. If you have 20 monitoring shards, you pay 50 GB times 20.',
        'You could try a single shared counter service, but that introduces a network round trip per event. At millions of events per second, the network becomes the bottleneck and the counting system falls behind the stream. You need something that fits in local memory on each worker and can be merged cheaply.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Hash-map memory grows with the number of distinct keys, not with the accuracy you need. If you only care whether a key appeared roughly 10,000 times or 100 times, you still pay to store every key that appeared once. The map does not know which keys you care about until you ask.',
        'What if you use fewer buckets and let keys collide? With a single row of 1,000 buckets, two keys that hash to the same bucket merge their counts. You read 7 from the bucket but have no way to tell whether key A contributed 5 and key B contributed 2, or key A contributed 7 and key B contributed 0. One collision destroys both estimates. Making the table larger helps but does not solve the problem -- it just postpones it.',
        'The challenge is bounding collision damage without storing the identity of every distinct key. The sketch needs a way to let collisions happen but limit how much any single collision can distort an answer.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Instead of one row of buckets, use several independent rows, each with its own hash function. A collision in row 1 does not imply a collision in row 2, because the hash functions are independent. When you query a key, read all rows and return the minimum value.',
        'Collisions can only add count to a cell -- they never subtract. So every row gives an overestimate of the true count. The minimum across rows picks the row where the key suffered the least collision noise. If even one row avoided all collisions for that key, the minimum returns the exact count. More rows give you more independent chances to dodge collisions. Wider rows give each row fewer collisions to dodge.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Allocate a two-dimensional array of d rows and w columns. Set every counter to zero. Each row i owns one hash function h_i that maps any key to a column index in the range [0, w). The hash functions must be pairwise independent -- knowing where h_1 sends a key tells you nothing about where h_2 sends it.',
        {
          type: 'image',
          src: 'https://www.waitingforcode.com/public/images/articles/count_min_sketch.png',
          alt: 'Count-Min Sketch update where one input touches one counter in each hash row',
          caption: 'Count-Min Sketch update and min query diagram. Source: https://www.waitingforcode.com/public/images/articles/count_min_sketch.png',
        },
        'Insert(x): for each row i from 0 to d-1, compute column = h_i(x), then increment counter[i][column] by 1. Exactly d counters change per insert, regardless of how many distinct keys have appeared so far. The key string is never stored anywhere in the table.',
        'Query(x): for each row i, compute the same column = h_i(x) and read counter[i][column]. Return the minimum of those d values. Because collisions only inflate cells, the minimum is always the closest to the true count.',
        'The sketch cannot list its contents or tell you which keys are frequent. It can only answer point queries: "how many times has this specific key appeared?" To find heavy hitters, pair the sketch with a candidate tracker like Space-Saving or a heap that decides which keys to query.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Consider one cell that key x maps to in row i. That cell holds the true count of x, plus the true counts of every other key that also hashed to column h_i(x). Those extra counts are collision noise. They can only be positive -- no key contributes a negative count -- so the cell is an overestimate. This is true for every row independently.',
        'Now consider what happens when you take the minimum across all d rows. Each row gives an overestimate. The minimum picks the row where x happened to have the fewest collisions. The formal guarantee: if you set w = ceil(e / epsilon) and d = ceil(ln(1 / delta)), then the probability that the estimate exceeds the true count by more than epsilon * N is at most delta, where N is the total number of events in the stream and e is Euler\'s number (approximately 2.718).',
        'The intuition behind the formula: in any single row of width w, the expected overcount from collisions is at most N / w. Setting w = e / epsilon makes that expected overcount at most epsilon * N / e. By Markov\'s inequality, the probability that the overcount exceeds epsilon * N in a single row is at most 1/e. With d independent rows, the probability that every row exceeds that bound is at most (1/e)^d = delta when d = ln(1/delta).',
        'The guarantee is one-sided and absolute. Count-Min never underestimates. A missed spike is impossible. A false spike is possible and must be verified downstream. This one-sidedness is a feature for applications like abuse detection and rate limiting, where missing a real spike is dangerous but investigating a false alarm is merely wasteful.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Insert costs O(d) time: compute d hash values, increment d counters. Query costs O(d) time: compute d hash values, read d counters, take the minimum. Space is exactly d * w counters, determined entirely by the error parameters epsilon and delta, not by the stream size or key count.',
        'Concrete sizing: for epsilon = 0.01 (1% error) and delta = 0.01 (99% confidence), w = ceil(e / 0.01) = 272 columns and d = ceil(ln(100)) = 5 rows. That is 1,360 four-byte counters, about 5.3 KB total. Compare that to a hash map for 1 million distinct keys at roughly 12 bytes per entry (just the counter and minimal key hash): 12 MB. The sketch uses 5.3 KB -- over 2,000 times less memory.',
        'Tightening accuracy is cheap in one direction and expensive in the other. Halving epsilon (cutting error in half) doubles the width. Adding one more row of depth multiplies confidence by roughly e (about 2.7x). So confidence scales logarithmically and is cheap; precision scales linearly and costs proportionally.',
        'Merging two sketches that share the same dimensions and hash seeds is cell-wise addition. Each shard sketches its local sub-stream; the coordinator sums the matrices. The merged result is identical to a single sketch built over the combined stream, because if cell A overestimates and cell B overestimates, their sum also overestimates. No raw events cross the network. This makes Count-Min Sketch a natural fit for MapReduce-style architectures, distributed telemetry pipelines, and any system that partitions a stream across workers.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Network traffic monitoring is the textbook application. Edge nodes sketch per-IP request rates locally, then merge sketches at the regional aggregator every minute. The dashboard asks "which known IPs might have spiked?" and the sketch supplies safe upper bounds. Banning an IP still requires looking up exact logs -- the sketch is the first filter, not the verdict.',
        'Search engines and NLP systems use Count-Min Sketch for approximate word and n-gram frequency counts. Autocomplete ranking, trending-query detection, and vocabulary filtering all need "how often has this phrase appeared?" answered cheaply across billions of queries. The stream is too large to count exactly on every serving node.',
        'Database query optimizers use sketches to estimate how selective a WHERE clause is. The optimizer sketches the frequency of each value in a column, then estimates how many rows match a predicate. The overestimate bias is tolerable because query plan cost estimates are already approximate -- choosing between a sequential scan and an index lookup does not require exact counts.',
        'Apache Spark, Apache Flink, and Redis all ship built-in Count-Min Sketch implementations. The pattern across all uses is the same: sketch cheaply for candidate detection, then verify the few candidates that matter with an exact store.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Every estimate is an overcount, never an undercount. If your application needs exact lower bounds -- billing a customer, decrementing inventory, enforcing a contractual rate limit -- the sketch alone is not safe. A sketch estimate of 1,000 means "at least some of those are real, but maybe fewer than 1,000 are from this specific key."',
        'The sketch cannot enumerate keys. It answers "how often did X appear?" but not "which keys appeared most?" You must already know or suspect a key before you can query it. Surfacing heavy hitters requires a separate candidate-generation structure like Space-Saving or Misra-Gries, which tracks key identities.',
        'Skewed streams amplify error. If one key accounts for 90% of the stream, it collides with almost every other key in most rows. The absolute error bound epsilon * N grows with total stream volume, so a hot stream with a dominant key needs a wider table to keep the error tolerable for the remaining keys.',
        'Deletions are not supported. Decrementing a counter might subtract another key\'s contribution, breaking the one-sided guarantee. If your stream has events that cancel earlier events (refunds, corrections, edge deletions), Count-Min Sketch is the wrong tool. Count Sketch handles signed updates by using randomized signs that make collision noise cancel in expectation rather than accumulate.',
        'Count-Min Sketch answers frequency questions ("how often did X appear?"), not cardinality questions ("how many distinct items exist?"). For cardinality, use HyperLogLog. For streaming quantiles (median, p99), use T-Digest or DDSketch. Each streaming sketch answers a different question.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Setup: a small sketch with w = 5 columns and d = 2 rows. We pick hash functions by hand for clarity. h_0("cat") = 0, h_1("cat") = 2. h_0("dog") = 3, h_1("dog") = 0. h_0("fish") = 0, h_1("fish") = 4. All 10 counters start at zero.',
        'Insert "cat" three times. Each insert increments counter[0][0] and counter[1][2]. After three inserts the table looks like: row 0 = [3, 0, 0, 0, 0], row 1 = [0, 0, 3, 0, 0]. Query("cat") reads counter[0][0] = 3 and counter[1][2] = 3, returns min(3, 3) = 3. Exact.',
        'Insert "dog" twice. Each insert increments counter[0][3] and counter[1][0]. Table: row 0 = [3, 0, 0, 2, 0], row 1 = [2, 0, 3, 0, 0]. Query("dog") = min(2, 2) = 2. Exact. No collision with "cat" because their column positions differ in both rows.',
        'Insert "fish" once. It increments counter[0][0] and counter[1][4]. Row 0, column 0 goes from 3 to 4 -- "fish" collides with "cat" in row 0. Table: row 0 = [4, 0, 0, 2, 0], row 1 = [2, 0, 3, 0, 1]. Query("fish") reads counter[0][0] = 4 and counter[1][4] = 1, returns min(4, 1) = 1. Exact, because row 1 stayed clean for "fish".',
        'Now re-query "cat". Row 0 reads 4 (polluted by "fish"), row 1 reads 3 (clean). min(4, 3) = 3. Still exact -- the clean row rescues the estimate. The collision in row 0 is invisible to the final answer because the minimum ignores polluted rows.',
        'The damage is visible inside the table though. Counter[0][0] holds 4, which is 3 from "cat" plus 1 from "fish." Any future key that hashes to row 0, column 0 inherits that inflated value in that row. If a new key also hashes to row 1, column 2 or row 1, column 4, it would collide in both rows and the sketch would overcount. More rows give more independent shots at avoiding this. Wider rows spread keys out so collisions are rarer per row.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The primary source is Cormode and Muthukrishnan, "An Improved Data Stream Summary: The Count-Min Sketch and its Applications" (2005). The paper gives the full proof of the error bound and describes applications to point queries, range queries, and inner products. Estan and Varghese, "New Directions in Traffic Measurement and Accounting" (2003), provides the heavy-hitter detection context that motivates most production deployments.',
        'Prerequisites: study Hash Table first to understand exact counting and how hash functions map keys to positions. Study Bloom Filter to see the closest cousin -- another hash-based approximate structure, but for membership ("has X appeared at all?") rather than frequency ("how often has X appeared?").',
        'Extensions: Conservative Update (CU) reduces overestimate bias by only incrementing cells that currently equal the minimum across rows. Count Sketch uses randomized +1/-1 signs so collision noise cancels in expectation, enabling signed (turnstile) updates where counts can decrease. Space-Saving retains the actual key identities that Count-Min discards, giving you a top-k list instead of just frequency estimates.',
        'Related streaming sketches solve different problems: HyperLogLog estimates cardinality ("how many distinct items?"), Reservoir Sampling keeps representative stream samples, and T-Digest or DDSketch estimate streaming quantiles (median, p99). Each uses a different probabilistic tradeoff for a different streaming question.',
      ],
    },
  ],
};
