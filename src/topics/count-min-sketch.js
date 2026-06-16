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
      heading: `What it is`,
      paragraphs: [
        `A Count-Min Sketch is a probabilistic frequency table for streams. It answers "how many times have I seen this key?" using a fixed-size matrix of counters instead of a full map of every key. Like Bloom Filter, it gives up exactness to save memory, but it solves a different problem: Bloom answers membership, Count-Min answers approximate counts.`,
        `The guarantee is asymmetric. A Count-Min Sketch never undercounts, because every update only increments counters. It may overcount when other keys collide with the queried key's positions. Returning the minimum row estimate is the trick that chooses the least polluted row.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Create d rows and w columns of counters. Each row has its own hash function. To update key x, compute d column positions and increment one counter per row. To estimate count(x), read those d counters and return the smallest. Width controls collision rate; depth controls the probability that every row is polluted at once. The original Count-Min Sketch analysis gives space roughly O(1 / epsilon * log(1 / delta)) for additive error epsilon with failure probability delta.`,
        `The data structure is linear: sketches with the same shape and hash seeds can be added cell by cell. That makes it natural for distributed stream processing. Each worker sketches its partition locally; aggregation merges the matrices without shipping all raw keys.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Update cost is O(d), query cost is O(d), and space is O(d * w), where d and w are fixed by the desired error. In practice that is constant time per event and fixed memory for an unbounded stream. The bill is statistical: rare keys can be inflated by collisions with common keys, and the sketch cannot list all keys by itself. Heavy-hitter systems usually pair it with a candidate set or exact verification store.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Count-Min Sketch appears in network telemetry, streaming analytics, approximate dashboards, query planning, abuse detection, ad-tech counters, and feature-monitoring pipelines. It is especially useful when the key universe is huge and long-tailed: IP addresses, search queries, user IDs, URLs, product IDs, or tokens. Roaring Bitmaps are strong when you need exact set algebra over IDs; Count-Min is strong when you need approximate frequencies over an endless stream.`,
        `A common production shape is: Message Queues carry raw events, stream workers maintain sketches, alerts ask for heavy hitters, and an exact store verifies the few candidates that matter. That composition gives bounded memory and bounded network cost without pretending approximate counts are legally exact.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Do not use Count-Min Sketch for money, inventory, permissions, or deletion decisions unless a downstream exact check confirms the result. The estimate is biased upward. It is excellent for "is this key worth investigating?" and weak for "charge this customer for exactly N events." Another trap is adversarial hashing: if attackers can choose keys that collide, they can inflate other counts. Use keyed hashes or rotate seeds when the threat model includes hostile input.`,
        `Count-Min also does not discover keys from nowhere. It estimates a key you ask about. To find heavy hitters, pair it with a candidate tracker, a heap, Space-Saving, or stream summaries that retain candidate identities.`,
      ],
    },
    {
      heading: `Sources and study next`,
      paragraphs: [
        `Primary source: Cormode and Muthukrishnan, "An Improved Data Stream Summary: The Count-Min Sketch and its Applications" at https://dimacs.rutgers.edu/~graham/pubs/papers/cm-full.pdf. Then study Conservative Count-Min Sketch for lower positive-stream bias, Count Sketch: Signed Frequency for turnstile updates, Feature Hashing Signed Projection Primer for hashed sparse feature vectors, Heavy Hitters: Space-Saving Summaries for retaining candidate keys, and Elastic Sketch Network Telemetry Case Study for a production heavy/light split. Bloom Filter covers approximate membership, Reservoir Sampling covers representative examples, and Message Queues show the production stream that feeds sketches.`,
      ],
    },
  ],
};
