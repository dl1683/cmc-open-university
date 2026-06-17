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
      heading: 'Why this exists',
      paragraphs: [
        'Streams can contain millions or billions of distinct keys: URLs, IPs, queries, products, tokens, or user ids. An exact hash map grows with the number of distinct keys and can become too large for telemetry, abuse detection, or distributed analytics. Count-Min Sketch exists to answer approximate frequency questions with fixed memory.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first attempt is a hash table from key to exact count. It is simple, mergeable by key, and correct. It fails when the key universe is huge, the tail is long, and most keys are not important enough to deserve their own stored identity.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A single hashed counter per key-like bucket loses too much information because collisions are indistinguishable. A rare key that collides with a hot key looks hot. The wall is bounding collision damage without storing identities for every distinct key.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Use several independent hash rows and take the minimum estimate. Collisions only add count, never subtract it. If at least one row is relatively clean, the minimum row is the least polluted witness for the key.',
      ],
    },
    {
      heading: 'Reading the visualization',
      paragraphs: [
        'In the stream-counts view, follow one key across all hash rows. Every touched counter is a noisy witness. The minimum is chosen because collisions only add mass; the least inflated witness is the best estimate.',
        'In the merge view, notice that mergeability is not an afterthought. Sketches with the same dimensions and hash seeds can be added cell by cell, which is why this structure is useful in distributed streaming systems.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Create d rows and w columns of counters. Each row has its own hash function. Updating key x increments one counter per row. Querying x reads those same counters and returns the smallest. Width lowers collision pressure; depth lowers the chance that every row is badly polluted.',
        'The key itself is not stored in the sketch. That saves memory, but it means the sketch cannot list all frequent keys. A production heavy-hitter pipeline usually pairs Count-Min with a candidate table, sample store, or exact replay for the small set of keys worth investigating.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'For positive streams, every counter touched by x contains the true count of x plus counts from colliding keys. That means each row is an upper bound. Taking the minimum keeps the estimate one-sided and chooses the row with the least extra mass. The original analysis sizes width and depth for additive error and failure probability.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Update is O(d), query is O(d), and memory is O(d * w), fixed by the desired error rather than stream length. Sketches with the same dimensions and hash seeds merge by cell-wise addition. The bill is statistical: rare keys can be inflated, and the sketch cannot list keys by itself.',
        'Counter size is also a real systems choice. Small counters save memory but can saturate. Conservative update reduces positive-stream bias. Time-decayed or windowed variants need rotation, subtraction, or multiple sketches, which changes the simple merge story.',
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        'Choose width from tolerated overcount and depth from tolerated probability of a bad estimate. Wider rows reduce collision pressure; more rows reduce the chance that every estimate path is polluted. Record both choices with the metric definition so dashboards remain interpretable.',
        'Use the same hash functions, seeds, dimensions, and counter widths everywhere a sketch may be merged. A cell-wise sum is meaningful only when every shard put the same logical hash row and bucket in the same cell.',
        'Pair the sketch with a candidate mechanism when you need heavy hitters. Count-Min can estimate a key you already know, but it cannot enumerate unknown keys because it does not store them. Space-Saving, heap candidates, or sampled exact windows often fill that gap.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Count-Min fits network telemetry, streaming analytics, approximate dashboards, query planning, abuse detection, ad-tech counters, and feature-monitoring pipelines. A common production pattern is message queues feeding stream workers, sketches generating candidates, and an exact store verifying the few decisions that matter.',
        'It is especially strong when the stream is too large to retain but approximate upper bounds are enough. Alerting on possible spikes, estimating hot keys, and routing suspicious traffic can all tolerate a one-sided estimate as long as final expensive actions are checked elsewhere.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Do not use it for money, inventory, permissions, deletion, or legal decisions without exact verification. It is biased upward and vulnerable to adversarial collision choices if hashing is weak. It also estimates keys you ask about; finding heavy hitters requires a candidate tracker such as Space-Saving or another retained-identity summary.',
        'It is also the wrong tool for signed updates unless the contract is changed. If counts can decrease, Count-Min loses its one-sided overestimate logic. Count Sketch or another turnstile sketch fits that world better.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A stream sees login four times and bot twice. In one row, login collides with bot, so that row reports 6 for login. In another row, login avoids bot and reports 4. Taking the minimum returns 4, which is exact in this toy case. If every row collided, the answer would be too high, never too low.',
        'In a distributed log pipeline, each shard can keep its own sketch. As long as every shard uses the same hash seeds and dimensions, the coordinator adds matrices cell by cell. The merged sketch behaves like one sketch over the combined stream without shipping raw events.',
      ],
    },
    {
      heading: 'Rule of thumb',
      paragraphs: [
        'Use Count-Min when the cost of exact counting grows with the stream and overestimates are safer than underestimates. Use a different structure when counts can be negative, identity must be retained, or decisions require exactness.',
        'The most useful production habit is to treat sketch answers as candidate evidence. They are excellent for narrowing attention and dangerous when silently promoted into billing, deletion, or access-control truth.',
      ],
    },
    {
      heading: 'Operational case study',
      paragraphs: [
        'A network telemetry service wants rough request counts for millions of source IPs per minute. Keeping an exact counter for every IP on every edge node is expensive, and shipping those maps centrally is worse. Each edge node can update a Count-Min sketch locally and merge sketches for regional dashboards.',
        'The dashboard can safely ask candidate questions such as "which known IPs might have spiked?" because the sketch gives upper bounds. It should not ban an IP from the sketch alone. A high estimate should trigger exact log lookup, sampled packet review, or a heavier retained-identity summary before enforcement.',
        'This pattern is why Count-Min often appears beside other summaries. The sketch gives cheap frequency pressure, Space-Saving keeps candidate identities, and exact storage verifies the small number of decisions that matter.',
      ],
    },
    {
      heading: 'How to size it',
      paragraphs: [
        'Width controls additive error because wider rows spread keys across more buckets. Depth controls confidence because more independent rows make it less likely that every witness for a key is badly polluted. The usual theory expresses this as an error budget and failure probability rather than as a magic table size.',
        'In production, size is also constrained by cache, network, and counter width. A sketch that fits in CPU cache may beat a theoretically nicer sketch that causes memory stalls. A sketch sent between workers may need compact counters and clear saturation behavior.',
        'Sizing should be tied to action thresholds. If an alert fires at 10,000 events, an error of 50 may be fine. If an admission decision flips at 8 versus 9 events, the same sketch may be too noisy.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Cormode and Muthukrishnan, "An Improved Data Stream Summary: The Count-Min Sketch and its Applications" at https://dimacs.rutgers.edu/~graham/pubs/papers/cm-full.pdf. Then study Conservative Count-Min Sketch for lower positive-stream bias, Count Sketch: Signed Frequency for turnstile updates, Feature Hashing Signed Projection Primer for hashed sparse feature vectors, Heavy Hitters: Space-Saving Summaries for retaining candidate keys, and Elastic Sketch Network Telemetry Case Study for a production heavy/light split. Bloom Filter covers approximate membership, Reservoir Sampling covers representative examples, and Message Queues show the production stream that feeds sketches.',
      ],
    },
  ],
};
