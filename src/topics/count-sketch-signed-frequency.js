// Count Sketch: signed frequency estimation for streams with additions and removals.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'count-sketch-signed-frequency',
  title: 'Count Sketch: Signed Frequency',
  category: 'Data Structures',
  summary: 'Estimate item frequencies with signed hash rows, median-of-rows queries, and support for turnstile streams where counts can go down.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['signed counters', 'turnstile merge'], defaultValue: 'signed counters' },
  ],
  run,
};

const WIDTH = 7;
const ROWS = Array.from({ length: 5 }, (_, i) => ({ id: `r${i}`, label: `row ${i}` }));
const COLUMNS = Array.from({ length: WIDTH }, (_, i) => ({ id: `c${i}`, label: String(i) }));

const HASHES = new Map([
  ['login', { pos: [0, 3, 5, 1, 6], sign: [1, -1, 1, 1, -1] }],
  ['bot', { pos: [2, 3, 5, 4, 6], sign: [1, 1, -1, -1, -1] }],
  ['search', { pos: [6, 0, 2, 1, 3], sign: [-1, 1, 1, -1, 1] }],
  ['refund', { pos: [1, 4, 5, 0, 2], sign: [-1, 1, 1, 1, -1] }],
  ['abuse', { pos: [2, 6, 0, 4, 5], sign: [1, -1, -1, 1, 1] }],
]);

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

function emptySketch() {
  return Array.from({ length: ROWS.length }, () => new Array(WIDTH).fill(0));
}

function hashFor(key) {
  const known = HASHES.get(key);
  if (known) return known;
  let seed = 29;
  for (const ch of key) seed = (seed * 33 + ch.charCodeAt(0)) % 1009;
  return {
    pos: ROWS.map((_, i) => (seed * (i + 3) + i) % WIDTH),
    sign: ROWS.map((_, i) => ((seed + i * 17) % 2 === 0 ? 1 : -1)),
  };
}

function cellIdsFor(key) {
  return hashFor(key).pos.map((column, row) => `${ROWS[row].id}:c${column}`);
}

function update(sketch, key, delta = 1) {
  const { pos, sign } = hashFor(key);
  pos.forEach((column, row) => {
    sketch[row][column] += sign[row] * delta;
  });
}

function estimateRows(sketch, key) {
  const { pos, sign } = hashFor(key);
  return pos.map((column, row) => sign[row] * sketch[row][column]);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
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

function conceptGraph(title) {
  return graphState({
    nodes: [
      { id: 'key', label: 'key', x: 0.6, y: 3.5, note: 'event' },
      { id: 'bucket', label: 'bucket', x: 2.6, y: 2.4, note: 'h(x)' },
      { id: 'sign', label: 'sign', x: 2.6, y: 4.6, note: '+/-' },
      { id: 'counter', label: 'counter', x: 4.9, y: 3.5, note: 'add signed delta' },
      { id: 'unbias', label: 'flip back', x: 7.0, y: 3.5, note: 's(x)*cell' },
      { id: 'median', label: 'median', x: 9.0, y: 3.5, note: 'estimate' },
    ],
    edges: [
      { id: 'e-key-bucket', from: 'key', to: 'bucket', weight: '' },
      { id: 'e-key-sign', from: 'key', to: 'sign', weight: '' },
      { id: 'e-bucket-counter', from: 'bucket', to: 'counter', weight: '' },
      { id: 'e-sign-counter', from: 'sign', to: 'counter', weight: '' },
      { id: 'e-counter-unbias', from: 'counter', to: 'unbias', weight: '' },
      { id: 'e-unbias-median', from: 'unbias', to: 'median', weight: '' },
    ],
  }, { title });
}

function* signedCounters() {
  const sketch = emptySketch();

  yield {
    state: conceptGraph('Count Sketch stores signed collisions'),
    highlight: { active: ['key', 'bucket', 'sign', 'counter'], found: ['median'] },
    explanation: 'Count Sketch looks like Count-Min at first: several rows, one bucket per row. The new move is a second hash that assigns each key a sign, +1 or -1. Updates add signed deltas; queries multiply by the same sign to flip the key back, then take the median row estimate.',
    invariant: 'Collisions can add or subtract, so the median fights symmetric noise instead of one-sided overcount bias.',
  };

  update(sketch, 'login', 1);
  update(sketch, 'login', 1);
  yield {
    state: sketchState(sketch, 'two login events: signed cells moved'),
    highlight: { active: cellIdsFor('login') },
    explanation: 'Two login events update five cells. Some rows store +2, and rows where sign(login) = -1 store -2. Negative counters are not a bug; they are how the structure remembers which way to undo this key at query time.',
  };

  update(sketch, 'bot', 3);
  update(sketch, 'search', 2);
  yield {
    state: sketchState(sketch, 'collisions now include cancellation'),
    highlight: { active: cellIdsFor('bot'), compare: cellIdsFor('login') },
    explanation: 'Bot and search collide with login in some rows. In Count-Min every collision pushes the answer upward. Here a colliding key may push a row up or down depending on its sign. The estimate is unbiased in expectation, and the median discards polluted outlier rows.',
  };

  const loginRows = estimateRows(sketch, 'login');
  yield {
    state: labelMatrix(
      'Query login: signed row estimates',
      ROWS,
      [
        { id: 'cell', label: 'cell' },
        { id: 'sign', label: 'sign' },
        { id: 'est', label: 'signed est' },
      ],
      ROWS.map((row, i) => {
        const h = hashFor('login');
        return [String(sketch[i][h.pos[i]]), h.sign[i] > 0 ? '+1' : '-1', String(loginRows[i])];
      }),
    ),
    highlight: { active: ROWS.map((row) => `${row.id}:est`), found: ['r2:est'] },
    explanation: `The row estimates are ${loginRows.join(', ')}. Taking the median gives ${median(loginRows)}, close to the true login count of 2 even though some rows were hit by bot and search. The median is the robust aggregator; the signed hash is the bias control.`,
  };

  yield {
    state: plotState({
      axes: { x: { label: 'collision pressure', min: 0, max: 100 }, y: { label: 'typical error', min: -20, max: 40 } },
      series: [
        { id: 'cms', label: 'Count-Min', points: [{ x: 0, y: 0 }, { x: 30, y: 6 }, { x: 60, y: 16 }, { x: 100, y: 32 }] },
        { id: 'cs', label: 'Count Sketch', points: [{ x: 0, y: 0 }, { x: 30, y: 2 }, { x: 60, y: -3 }, { x: 100, y: 7 }] },
      ],
      markers: [{ id: 'zero', x: 0, y: 0, label: 'zero bias line' }],
    }),
    highlight: { active: ['cs', 'zero'], compare: ['cms'] },
    explanation: 'The curve is illustrative, but the contract is real. Count-Min is one-sided: errors are overestimates. Count Sketch trades that for signed noise centered around zero, which is valuable when negative updates, inner products, or unbiased frequency estimates matter.',
  };
}

function* turnstileMerge() {
  const sketch = emptySketch();

  yield {
    state: conceptGraph('Turnstile streams update counts up and down'),
    highlight: { active: ['key', 'sign', 'counter', 'e-sign-counter'], found: ['median'] },
    explanation: 'A turnstile stream is not just arrivals. Counts can increase and decrease: inventory reserve and release, ad budget spend and refund, graph edge insert and delete, or telemetry corrections. Signed sketches handle delta = -1 naturally because every update is linear.',
  };

  for (const [key, delta] of [['refund', 5], ['refund', -2], ['abuse', 3], ['bot', -1]]) {
    update(sketch, key, delta);
  }
  const refundRows = estimateRows(sketch, 'refund');
  yield {
    state: sketchState(sketch, 'after +5 refund, -2 refund, +3 abuse, -1 bot'),
    highlight: { active: cellIdsFor('refund'), compare: cellIdsFor('abuse') },
    explanation: `The true refund frequency is 3 after the correction. Querying refund reads signed row estimates ${refundRows.join(', ')} and returns median ${median(refundRows)}. Negative deltas are first-class; no special delete table is required.`,
  };

  const shardA = emptySketch();
  const shardB = emptySketch();
  for (const [key, delta] of [['login', 4], ['bot', 2], ['refund', -1]]) update(shardA, key, delta);
  for (const [key, delta] of [['login', 1], ['search', 3], ['refund', 4]]) update(shardB, key, delta);
  const merged = shardA.map((row, r) => row.map((value, c) => value + shardB[r][c]));

  yield {
    state: matrixState({
      title: 'Linear merge: cell-wise addition',
      rows: ROWS,
      columns: [
        { id: 'a', label: 'shard A' },
        { id: 'b', label: 'shard B' },
        { id: 'sum', label: 'merged' },
      ],
      values: ROWS.map((_, r) => [shardA[r][hashFor('login').pos[r]], shardB[r][hashFor('login').pos[r]], merged[r][hashFor('login').pos[r]]]),
      format: String,
    }),
    highlight: { active: ['r0:sum', 'r1:sum', 'r2:sum', 'r3:sum', 'r4:sum'] },
    explanation: 'Count Sketch is linear. If two workers use the same widths and hash seeds, merge by adding matching counters. The merged sketch is the same as sketching the union of both turnstile streams.',
  };

  yield {
    state: labelMatrix(
      'When to choose each frequency sketch',
      [
        { id: 'cms', label: 'Count-Min' },
        { id: 'cu', label: 'CMS-CU' },
        { id: 'cs', label: 'Count Sketch' },
        { id: 'ss', label: 'Space-Saving' },
      ],
      [
        { id: 'best', label: 'best fit' },
        { id: 'caveat', label: 'caveat' },
      ],
      [
        ['positive counts', 'overcounts'],
        ['lower bias', 'positive only'],
        ['signed deltas', 'median noise'],
        ['list top-k', 'candidate set'],
      ],
    ),
    highlight: { active: ['cs:best'], compare: ['cms:caveat', 'cu:caveat'] },
    explanation: 'Count Sketch is the natural next page after Count-Min: same sketching instinct, different error shape. Use it when the stream can subtract, when overcount bias is unacceptable, or when downstream math expects unbiased signed estimates.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'signed counters') yield* signedCounters();
  else if (view === 'turnstile merge') yield* turnstileMerge();
  else throw new InputError('Pick a Count Sketch view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation displays a Count Sketch with five rows and seven buckets per row. Each row has its own position hash (which bucket a key lands in) and sign hash (whether the key\'s contribution is stored as positive or negative). Active cells highlight the buckets being modified during an update or read during a query. Compared cells reveal where a different key landed in the same row, making collisions visible so you can watch the cancellation mechanism in action.',
        {
          type: 'callout',
          text: 'Signed hashes make collision noise cancel in expectation, so a fixed table can estimate streams with both positive and negative updates.',
        },
        'Switch to the "signed counters" view first. Watch key A arrive with delta +1: each row hashes A to a bucket and assigns a sign (+1 or -1). The update adds sign * delta to that bucket. Some buckets go up, others go down. When key B arrives and collides with A in row 2, the bucket accumulates both contributions -- but their signs are independent, so the collision noise averages to zero over many keys. At query time, the animation reverses the sign for the queried key and shows the per-row estimates alongside the final median.',
        'The "turnstile merge" view demonstrates negative deltas and sketch merging. A stream with delta = -3 flows through the same update path as delta = +5: the sign hash multiplies the delta, and the product is added to the bucket. Two independent sketches built with the same hash seeds are then merged by adding matching cells. The result is identical to processing both streams sequentially on one machine. The row-estimates panel shows how the median filters out the noisiest rows to produce a robust answer.',
        {type: 'image', src: './assets/gifs/count-sketch-signed-frequency.gif', alt: 'Animated walkthrough of the count sketch signed frequency visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many systems process data that arrives as a stream of (key, delta) pairs and need approximate frequency counts without storing every distinct key. Page views, telemetry pings, network packet counts, inventory adjustments, and feature counters can have millions or billions of distinct keys. An exact hash map would give perfect answers but consumes memory proportional to the number of distinct keys, which is often too expensive.',
        'Some streams are strictly additive -- every delta is positive. But many real streams are turnstile: counts go up and down. A hotel reservation is made and then cancelled. A financial transaction posts and then a refund corrects it. A graph edge is inserted and later deleted. A sensor correction subtracts from an earlier reading. The data structure must handle both positive and negative updates without growing its memory.',
        'Count-Min Sketch, the most widely taught streaming sketch, handles the additive case well but produces one-sided errors: every estimate is an overcount. That bias is acceptable for some applications, but it breaks downstream computations that depend on centered estimates -- inner products, covariance estimation, second-moment tracking, and any setting where you subtract one estimate from another.',
        'Count Sketch was introduced by Charikar, Chen, and Farach-Colton in 2002 to solve this problem. It uses signed hashes to produce unbiased frequency estimates: the expected error on any key is exactly zero, with symmetric noise that cancels in expectation. This makes it the right primitive for turnstile streams and for any pipeline where estimates feed linear algebra.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The exact solution is a hash map from key to count. Insert key A with delta +5, later update with delta -2, and the map reports f(A) = 3. It handles negative updates, returns perfect answers, and is simple to implement. The cost is memory: one entry per distinct key, plus overhead for the hash table structure itself. For a stream with ten million unique keys at 40 bytes per entry (key + count + pointer), that is 400 MB. For a billion keys, 40 GB.',
        'The first approximate alternative most learners encounter is Count-Min Sketch (CMS). CMS uses d rows of w buckets each. An update with delta adds delta to one bucket per row. A query returns the minimum cell value across rows. Because collisions only add to cells, the minimum is always an overestimate of the true count. CMS is elegant and fast, and for nonnegative streams with tolerance for overcounting, it works well.',
        'But CMS cannot handle turnstile streams cleanly. If key A contributes +10 and key B contributes -3 to the same bucket, the cell reads +7. The minimum-across-rows trick cannot separate the two contributions, and the overcount guarantee that makes CMS useful breaks when deltas can be negative. Even for nonnegative streams, the bias in CMS estimates means that subtracting two CMS estimates (to compute, say, f(A) - f(B)) inherits a positive bias that distorts the result.',
        'What we need is a fixed-memory structure that supports both positive and negative updates and produces estimates centered on the true frequency, not biased above it. That is what Count Sketch provides.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Any fixed-memory sketch must map a large key space into a small number of buckets, so collisions are inevitable. The fundamental question is not whether keys collide but what the resulting error looks like. Count-Min Sketch forces all collision noise to be positive: if keys B, C, and D collide with key A in some row, their counts all add to A\'s bucket, making it larger. The minimum across rows limits this overcount but cannot eliminate it.',
        'Consider a concrete example. Suppose key A has true count 0 and three unrelated keys each contribute +20 to A\'s bucket in row 1, +15 in row 2, and +8 in row 3. The CMS query returns min(20, 15, 8) = 8, an overestimate of 8 for a key with true frequency 0. This bias is structural, not a bug -- it is baked into the minimum-across-rows design.',
        'For turnstile streams, the problem deepens. If key A is updated with delta = -3 and key B collides in the same bucket with delta = +10, the cell stores +7. A structure that only takes the minimum across rows has no way to know that +7 is the sum of -3 and +10 rather than a single update of +7. Count-Min was designed for a world where counts only increase, and it has no mechanism to undo that assumption.',
        'The wall is this: with fixed memory and collisions guaranteed, you need a way to make collision noise cancel rather than accumulate. Positive-only hashing will always produce positive-only noise. Breaking through requires introducing randomized signs so that collisions push in both directions and their expected contribution is zero.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The breakthrough is a second hash function per row: the sign hash. Alongside the position hash h_j(x) that sends key x to a bucket, Count Sketch introduces s_j(x) that maps key x to +1 or -1 uniformly at random, independently for each key and each row. The update does not add delta directly to the bucket -- it adds s_j(x) * delta. The sign hash scrambles the direction of each key\'s contribution.',
        'At query time, the structure reads bucket[j][h_j(x)] and multiplies by s_j(x). For the queried key x, this reversal undoes the sign: s_j(x) * s_j(x) * f(x) = f(x), since the square of +1 or -1 is always +1. For every other key y that collided into the same bucket, the query computes s_j(x) * s_j(y) * f(y). Because s_j(x) and s_j(y) are independent random signs, their product is +1 or -1 with equal probability. The expected value of each collision term is zero.',
        'This is the core mechanism: the sign hash makes the queried key\'s contribution survive the query while turning every collision into zero-mean noise. A single row gives an unbiased estimate with some variance. Multiple independent rows give multiple independent estimates. Taking the median across rows filters out the outliers and produces a robust answer.',
        'The contrast with Count-Min is sharp. CMS takes the minimum across rows to limit positive noise. Count Sketch takes the median across rows to filter symmetric noise. The minimum is a deterministic bound; the median is a statistical filter. The minimum cannot center on the true value; the median can.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Count Sketch allocates d rows of w buckets each, all initialized to zero. Each row j is equipped with two hash functions: a position hash h_j mapping keys to buckets in {0, 1, ..., w-1}, and a sign hash s_j mapping keys to {+1, -1}. The hash functions must be pairwise independent across rows (practically: use different seeds per row).',
        {
          type: 'image',
          src: 'https://image.slideserve.com/122279/countsketch-data-structure-l.jpg',
          alt: 'CountSketch data structure with several hash tables and bucket columns',
          caption: 'CountSketch table family diagram. Source: https://image.slideserve.com/122279/countsketch-data-structure-l.jpg',
        },
        'To process an update (key x, delta), the structure iterates over all d rows. In row j, it computes the bucket index b = h_j(x) and the sign s = s_j(x), then adds s * delta to bucket[j][b]. For example, with d=5 and w=7, key "apple" with delta +1 might hash to buckets [3, 5, 1, 6, 0] with signs [+1, -1, +1, -1, +1]. Row 0 adds +1 to bucket[0][3]. Row 1 adds -1 to bucket[1][5]. The total work is d hash evaluations and d additions.',
        'To answer a point query for key x, the structure reads one bucket per row and reverses the sign. For row j, it computes estimate_j = s_j(x) * bucket[j][h_j(x)]. This produces d independent estimates of f(x). The final answer is the median of these d values. Sorting d values costs O(d log d), but d is typically 5 to 15, so the median computation is negligible.',
        'Merging two sketches is cell-wise addition. If sketch A was built on stream S1 and sketch B on stream S2, both using the same hash functions, then A[j][b] + B[j][b] for every row j and bucket b produces a sketch equivalent to processing the concatenation of S1 and S2. This works because the update rule is a linear operation: summing the inputs is the same as summing the outputs.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Fix a key x and a single row j. The cell bucket[j][h_j(x)] holds the sum of s_j(y) * f(y) for every key y that hashed to bucket h_j(x) in row j, including x itself. When we query x, we compute s_j(x) * bucket[j][h_j(x)] = s_j(x) * [s_j(x)*f(x) + sum over colliders y of s_j(y)*f(y)]. The first term simplifies to f(x) because s_j(x)^2 = 1. Each collision term becomes s_j(x)*s_j(y)*f(y).',
        'The product s_j(x)*s_j(y) for distinct keys x and y is a Rademacher random variable: +1 or -1 with equal probability. Its expectation is zero. Therefore E[estimate_j] = f(x) + sum of 0 = f(x). The estimate from each row is unbiased. The variance of the estimate from row j equals the sum of f(y)^2 over all keys y that collide with x in that row. With w buckets and n distinct keys, the expected number of colliders is (n-1)/w, and the expected variance is approximately ||f||_2^2 / w, where ||f||_2^2 is the sum of squared frequencies of all keys.',
        'Width w controls the variance per row. Doubling w halves the expected number of colliders and halves the variance. Depth d controls the reliability of the median. The median of d independent estimates, each unbiased with bounded variance, concentrates tightly around the true value. By Chernoff-type bounds, the probability that the median deviates by more than epsilon * ||f_tail||_2 drops exponentially in d. The standard setting w = 3/epsilon^2, d = O(log(1/delta)) guarantees |estimate - f(x)| <= epsilon * ||f_tail||_2 with probability at least 1-delta.',
        'The L2 norm in the error bound is critical. A stream dominated by a few heavy hitters (say, 10 keys with count 1000 each and a million keys with count 1) has a large L1 norm but a relatively small residual L2 norm once the heavy keys are excluded. This means light keys are estimated accurately. A perfectly uniform stream, by contrast, has L2 mass spread across all keys, making individual estimates noisier. Count Sketch is most accurate when the frequency distribution is skewed, which is the common case in practice (Zipf-distributed web traffic, power-law query logs, etc.).',
        'The use of the median rather than the mean is deliberate. The mean of the row estimates would also be unbiased, but a single row with a bad collision (a heavy hitter landing in the same bucket) could dominate the average. The median is resistant to such outliers: up to half the rows can have large errors and the median remains close to the truth. This robustness is why Count Sketch uses O(log(1/delta)) rows rather than the O(1/delta) rows that would be needed if averaging were used.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'An update touches exactly d buckets, one per row. Each touch requires evaluating a position hash h_j(x), a sign hash s_j(x), and performing one integer addition. The total update time is O(d). With d = 7 and w = 2000, the structure uses 14,000 counters (56 KB at 4 bytes each) regardless of whether the stream contains 100 distinct keys or 100 million.',
        'A point query reads d buckets, multiplies each by its sign, and takes the median. Reading is O(d). The median of d values costs O(d log d) via sorting, but since d is typically under 20, this is a few dozen comparisons -- effectively constant. In practice, query latency is dominated by cache misses on the d bucket lookups, not by the median computation.',
        'Merging two sketches requires adding all d*w pairs of cells. For d = 7 and w = 2000, that is 14,000 additions -- under a microsecond on modern hardware. Both sketches must share the same hash functions (same seeds). This merge is exact: no approximation is introduced by the combination step. The linearity property means you can merge sketches from thousands of workers and the result is as if a single machine processed every event.',
        'Memory is fixed at d * w counters. The standard parameterization for error epsilon and failure probability delta uses w = 3/epsilon^2 and d = ceil(ln(1/delta)). For epsilon = 0.01 (1% relative error scaled by L2 norm) and delta = 0.01 (99% success), that is w = 30,000 and d = 5, or 150,000 counters. At 4 bytes each, the sketch is 600 KB -- a fixed budget that handles any stream length and any number of distinct keys.',
        'Compared to Count-Min Sketch, the per-operation costs are nearly identical. CMS uses d hash evaluations and d additions per update; Count Sketch uses d position hashes, d sign hashes, and d additions. The query differs: CMS takes a minimum (O(d) comparisons), Count Sketch takes a median (O(d log d) but still negligible). The memory footprint is the same d * w. The cost of unbiased estimates is one extra hash function per row and a median instead of a minimum.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Network telemetry is the original motivation. A router sketches traffic volume per source IP using Count Sketch. When a connection resets or a retransmission is detected, the correction is a negative delta. The sketch absorbs both directions. At the end of a measurement interval, the operator queries suspected heavy hitters and gets unbiased traffic estimates suitable for billing, anomaly detection, or capacity planning.',
        'L2 norm estimation falls out of the structure for free. The sum of squared cell values in a single row, divided by w, is an unbiased estimator of ||f||_2^2 (the second frequency moment). Averaging this estimate across all d rows tightens the variance. This is the basis of the AMS sketch and is used in database query optimizers to estimate join sizes: if you know the L2 norms of the join columns, you can bound the output cardinality.',
        'Approximate inner products are another natural application. Given two Count Sketches built on vectors a and b with the same hash functions, the dot product of corresponding rows estimates a . b. Average across rows for a tighter estimate. This is useful in recommendation systems (estimating user-item affinity from sparse feature vectors), in NLP (estimating document similarity via term-frequency vectors), and in compressed sensing (projecting high-dimensional signals into low-dimensional signed measurements).',
        'Distributed stream aggregation exploits the merge property. Each worker node sketches its local sub-stream. A coordinator collects the sketches and adds them cell-wise. The merged sketch answers global frequency queries without ever shipping raw events. This pattern appears in MapReduce pipelines, federated analytics, and real-time dashboards where raw data cannot leave its origin for privacy or bandwidth reasons.',
        'Machine learning uses the sign-hash trick directly. Feature hashing (the "hashing trick") maps high-dimensional sparse features into a fixed-size vector using a position hash and a sign hash -- exactly the Count Sketch mechanism applied to a single row. Libraries like Vowpal Wabbit and scikit-learn\'s HashingVectorizer use this to handle features with millions of possible values without materializing the full dictionary.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Cell values are not interpretable as counts. A bucket might read -47, which is a perfectly normal intermediate value resulting from signed contributions. Operators used to Count-Min Sketch, where every cell is a plausible upper bound on some key\'s frequency, find Count Sketch cells confusing to debug. You cannot look at a cell and say "some key has frequency at most 47." The cells only become meaningful after the sign-reversal and median steps of a query.',
        'If all updates are nonnegative and the application only needs upper bounds, Count-Min Sketch is strictly simpler. CMS uses a minimum instead of a median, gives a deterministic (not probabilistic) overcount guarantee, and never produces negative estimates. The centered noise of Count Sketch is wasted when all you need is "the count is at most X." Use Count-Min for cache admission, Bloom-filter-style counting, and rate limiting where one-sided error is the natural fit.',
        'The sketch does not remember key names. You can ask "what is the estimated frequency of key X?" but you cannot ask "which keys have frequency above 1000?" without a separate structure to generate candidates. In practice, Count Sketch is paired with a candidate-generation layer -- Space-Saving, a min-heap, or a separate filter -- that nominates potential heavy hitters for the sketch to verify.',
        'Error depends on the L2 norm of the stream residual, not the L1 norm. For a uniform stream where every key has frequency 1 and there are N keys, the L2 norm is sqrt(N). The error bound epsilon * sqrt(N) grows with the number of distinct keys, making per-key estimates noisy. Count Sketch works best when the frequency distribution is skewed (Zipf, power-law) so that the residual L2 norm after excluding the queried key is small. On truly uniform streams, no sketch can do much better -- the problem is information-theoretically hard.',
        'The median-of-rows aggregation assumes independent hash functions across rows. In practice, hash functions are only approximately independent (using different seeds for a universal hash family). For most applications this is fine, but adversarial inputs can exploit hash correlations to force worst-case collisions. Adversarial robustness requires either truly random hash families (impractical for large domains) or a derandomization technique like the CountSketch variant with stronger hash families (e.g., BCH codes).',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Set up a Count Sketch with d=3 rows and w=5 buckets, all initialized to zero. Define the hash functions for three keys: for key A, h = [2, 0, 4] and s = [+1, -1, +1]. For key B, h = [2, 3, 1] and s = [-1, +1, -1]. For key C, h = [4, 0, 3] and s = [+1, +1, -1]. Notice A and B collide in row 0 (both map to bucket 2), and A and C collide in row 1 (both map to bucket 0).',
        'Process update (A, +5). Row 0: bucket[0][2] += (+1)(+5) = +5. Row 1: bucket[1][0] += (-1)(+5) = -5. Row 2: bucket[2][4] += (+1)(+5) = +5. Process update (B, +3). Row 0: bucket[0][2] += (-1)(+3) = -3, so bucket[0][2] = +5 + (-3) = +2. Row 1: bucket[1][3] += (+1)(+3) = +3. Row 2: bucket[2][1] += (-1)(+3) = -3. Process update (C, +2). Row 0: bucket[0][4] += (+1)(+2) = +2. Row 1: bucket[1][0] += (+1)(+2) = -5 + 2 = -3. Row 2: bucket[2][3] += (-1)(+2) = -2.',
        'Query key A. Row 0: s_0(A) * bucket[0][2] = (+1)(+2) = +2. The true value is f(A) = 5, but B\'s collision adds noise of s_0(A)*s_0(B)*f(B) = (+1)(-1)(3) = -3, so the estimate is 5 + (-3) = 2. Row 1: s_1(A) * bucket[1][0] = (-1)(-3) = +3. Here C collides, contributing s_1(A)*s_1(C)*f(C) = (-1)(+1)(2) = -2, so the estimate is 5 + (-2) = 3. Row 2: s_2(A) * bucket[2][4] = (+1)(+5) = +5. No collision in this row, so the estimate is exact.',
        'The three row estimates for A are [+2, +3, +5]. The median is +3. The true frequency is 5, so the error is -2. Now process a turnstile update (A, -2), reducing A\'s true count to 3. Row 0: bucket[0][2] += (+1)(-2) = -2, so bucket[0][2] = +2 - 2 = 0. Row 1: bucket[1][0] += (-1)(-2) = +2, so bucket[1][0] = -3 + 2 = -1. Row 2: bucket[2][4] += (+1)(-2) = -2, so bucket[2][4] = +5 - 2 = +3. Query A again: row estimates are (+1)(0) = 0, (-1)(-1) = +1, (+1)(+3) = +3. Median is +1. True frequency is 3, error is -2. The negative delta flowed through the same path as the positive one, and the sketch handled it without any special logic.',
        'This example shows three key behaviors: collision noise in rows 0 and 1 distorts individual estimates, but the median across rows filters the worst error. The turnstile update (negative delta) works identically to positive updates. And the errors are symmetric -- the estimate can be above or below the truth, unlike Count-Min where it is always above.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The primary source is Charikar, Chen, and Farach-Colton, "Finding Frequent Items in Data Streams," 2002 (ICALP). This paper introduced the Count Sketch with sign hashes and median-of-rows aggregation, and proved the L2-norm error guarantee. The theoretical ancestor is Alon, Matias, and Szegedy, "The Space Complexity of Approximating the Frequency Moments," 1996 (STOC), which introduced four-wise independent sign hashes for second-moment estimation -- the core idea that Count Sketch generalizes to point queries.',
        'For comparison, read Cormode and Muthukrishnan, "An Improved Data Stream Summary: The Count-Min Sketch and its Applications," 2005 (Journal of Algorithms). Count-Min uses the same d-by-w table but without sign hashes, giving deterministic one-sided error. Understanding both structures and when to choose each is essential for streaming algorithm literacy. Cormode\'s survey "Sketch Techniques for Approximate Query Processing" (2011) gives a broader view of the sketch landscape.',
        'The feature hashing connection is described in Weinberger et al., "Feature Hashing for Large Scale Multitask Learning," 2009 (ICML). They prove that the sign hash preserves inner products in expectation -- the same mechanism as Count Sketch applied to machine learning feature vectors. This paper is the theoretical foundation for HashingVectorizer in scikit-learn and similar tools.',
        'Study Count-Min Sketch next to understand when one-sided error is preferable. Study Space-Saving (Metwally, Agrawal, El Abbadi, 2005) to see how a deterministic structure retains key names for top-k queries. Study Feature Hashing to see the sign trick applied to ML feature vectors. Study the AMS Sketch for frequency-moment estimation. If you want to go deeper into the theory, study the Johnson-Lindenstrauss lemma -- Count Sketch can be viewed as a sparse, structured JL projection, and the connection illuminates why it preserves distances and inner products.',
        'If you arrived here from Count-Min Sketch, the key takeaway is that Count Sketch trades a deterministic overcount bound for an unbiased estimate with symmetric noise. If you arrived from streaming algorithms broadly, the natural next steps are L2 sampling, sparse recovery (where Count Sketch is a subroutine), and turnstile lower bounds that show why the L2-norm dependency in the error is optimal.',
      ],
    },
  ],
};
