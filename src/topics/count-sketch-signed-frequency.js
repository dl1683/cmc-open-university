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
      heading: 'Why this exists',
      paragraphs: [
        `Streaming systems often need approximate frequencies without storing every key. Page views, telemetry events, graph edges, inventory changes, and feature updates can arrive faster than an exact map can be kept for every distinct item.`,
        `Some streams also subtract. A reservation is released, a refund corrects revenue, an edge is deleted, or a delayed event cancels an earlier event. Count Sketch exists for these turnstile streams: counts can go up or down, and the memory budget stays fixed.`,
        `The deeper reason to study it is that it shows how randomized signs can change a data structure's error contract. Count-Min Sketch says "I may overcount." Count Sketch says "my noise is centered, so combine independent rows and treat the answer as an estimate with variance." That difference matters when estimates feed math rather than a human top-k list.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The exact approach is a hash map from key to count. It gives correct answers and supports negative updates, but memory grows with the number of distinct keys. That is the wrong shape for a high-cardinality stream with a fixed memory budget.`,
        `The approximate approach many learners meet first is Count-Min Sketch. It uses several hash rows and keeps positive counters. Count-Min is useful for nonnegative streams because collisions only overestimate. That one-sided guarantee stops being the right tool when deletions, corrections, or signed weights are normal.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `Fixed memory means collisions are unavoidable. A sketch can't keep a private counter for every key. The useful distinction is the error shape those collisions create.`,
        `For signed streams, always-positive collision noise is hard to use. A key with a true count near zero can look large because unrelated keys hit the same buckets. Count Sketch changes the error shape. Collisions can add or subtract, so each row estimate is centered on the true count in expectation.`,
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        `Each row uses two hash functions. One chooses a bucket. The other chooses a sign, either +1 or -1. Updating key x by delta adds sign(x) * delta to that row's bucket.`,
        `A query reverses the sign for the key being asked about. Row j returns sign_j(x) * counter[j][h_j(x)]. The sketch takes the median of those row estimates. The invariant is that the queried key flips back to its true direction, while unrelated colliding keys have random signs.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Allocate d rows and w buckets per row. For update (key, delta), every row computes bucket h_j(key) and sign s_j(key) in {-1, +1}. It adds s_j(key) * delta to that one bucket.`,
        `For query(key), read the same bucket in every row and multiply by the same sign used for that key. If the true key contributed -5 to a cell because its sign was -1, multiplying by -1 returns +5 for that key. Other keys in the cell may also flip, but their signs are independent of the queried key.`,
        `The median is the robust aggregator. A few rows may be badly polluted by collisions. If most rows are only lightly polluted, the middle estimate stays close to the true frequency.`,
      ],
    },
    {
      heading: 'Concrete example',
      paragraphs: [
        `Suppose login has true count 2. In a row where sign(login) is -1, two login events store -2. Querying login multiplies that cell by -1 and gets +2 before collision noise is considered.`,
        `If bot also lands in that cell, bot's contribution may appear as positive or negative noise after the login sign is applied. Across rows, those unrelated contributions are centered around zero. The median chooses a typical row instead of trusting the worst collision.`,
        `This example also explains why the sketch can support deletions without a separate tombstone structure. A refund correction of -1 simply applies the same signed update with a negative delta. If the original event and correction reach different machines, the sketches can still be merged later because every cell stores a linear sum.`,
      ],
    },
    {
      heading: 'Why the estimate is trustworthy',
      paragraphs: [
        `For a fixed key x, one row's estimate equals the true frequency of x plus signed contributions from other keys that collided with x in that row. Because those other signs are random, the expected collision contribution is zero.`,
        `Width controls how much collision mass a row is likely to see. More buckets mean fewer unrelated keys share the queried bucket. Depth controls failure probability. More independent rows make it less likely that the median is dominated by bad collisions.`,
        `The error scale is tied to the remaining L2 mass of the stream, not just total event count. A stream with a few heavy keys and many tiny keys is easier than a stream where many medium keys collide with each other. Count Sketch gives an estimate, not a certificate.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `Update time is O(d) because one bucket changes in each row. Query time is O(d) because one bucket is read in each row. Memory is O(d * w) counters. If counters are 64-bit integers, memory is predictable and independent of distinct key count.`,
        `The sketch is linear. Two workers using the same dimensions and hash seeds can merge by adding matching counters. The merged sketch is the same as sketching the combined stream. This is why Count Sketch fits distributed telemetry and streaming aggregation.`,
        `The tax is variance. Estimates can be high or low. They are useful for ranking candidates, detecting drift, approximating inner products, or deciding what to verify exactly. They shouldn't be used as final truth for billing, deletion, access control, or legal decisions without an exact check.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Count Sketch fits turnstile frequency estimation, telemetry correction, inventory adjustment, graph streams with edge deletes, approximate inner products, sparse recovery, and distributed heavy-hitter pipelines. It is also useful when overcount bias would distort downstream math.`,
        `A fraud system can sketch events by user, subtract corrections, merge sketches from shards, and use the estimates to pick suspicious candidates. The final investigation can then query exact logs for those candidates. The sketch narrows the search; it doesn't replace the source of truth.`,
        `It is also a good teaching bridge into feature hashing and compressed sensing. The same pattern appears when high-dimensional vectors are projected into smaller signed buckets. The data structure is not only a counter table; it is a compact randomized linear map with a query procedure on top.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Individual cells aren't human-readable counts. Negative counters are normal. A single row estimate can be badly wrong when a heavy unrelated key collides with the queried key.`,
        `If all updates are nonnegative and one-sided overestimates are acceptable, Count-Min is simpler to explain and sometimes easier to reason about operationally. If the application needs the actual list of top keys, Count Sketch must be paired with a candidate-generation method; the sketch itself doesn't remember key names.`,
        `Hash quality matters. Hostile keys, poor seeds, counter overflow, and inconsistent hash configuration across workers can destroy the guarantee. Any decision with real consequences should verify exact counts after the sketch flags a candidate.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Count-Min Sketch for one-sided positive counters, Conservative Count-Min Sketch for lower bias on positive streams, and Heavy Hitters: Space-Saving Summaries for candidate retention. Study Feature Hashing Signed Projection Primer to see the same sign trick in vector form, and Hierarchical Heavy Hitters: Prefix Sketch for rollups over structured keys.`,
        `Primary source: Charikar, Chen, and Farach-Colton, Finding Frequent Items in Data Streams: https://www.cs.princeton.edu/courses/archive/spr04/cos598B/bib/CharikarCF.pdf.`,
      ],
    },
  ],
};
