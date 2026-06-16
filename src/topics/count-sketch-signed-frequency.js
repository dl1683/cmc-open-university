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
      heading: 'What it is',
      paragraphs: [
        'Count Sketch is a streaming frequency sketch for estimating how often a key appears when the key universe is too large for an exact map. It resembles Count-Min Sketch, but each row has two hash functions: one chooses a bucket, and the other chooses a sign, +1 or -1. The update adds the signed delta to the chosen counter. The query multiplies each row counter by the same sign and returns the median row estimate.',
        'The signed hash is the point. Count-Min collisions only increase estimates, so it has one-sided overcount bias. Count Sketch collisions can increase or decrease a row estimate, making the noise centered around zero in expectation. That makes it useful for turnstile streams, approximate inner products, sparse recovery, and frequency estimation where negative updates can occur.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Allocate d rows by w columns. For update (key, delta), row j computes bucket h_j(key) and sign s_j(key) in {-1, +1}, then adds s_j(key) * delta to that bucket. For query(key), row j reads the same bucket and returns s_j(key) * counter[j][h_j(key)]. The final answer is the median of those d row estimates.',
        'The median matters because collisions create outliers. One row may be badly polluted by another heavy key; another row may be nearly clean. The median keeps the center of the signed estimates instead of trusting the minimum. With enough rows and width, most rows are not catastrophically polluted, so the median becomes stable.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Update cost is O(d), query cost is O(d), and memory is O(d * w). Like Count-Min, those dimensions are fixed by the desired error contract, so runtime per event is effectively constant. Merge is cell-wise addition when sketches share dimensions and hash seeds. The tradeoff is variance: estimates can be too high or too low, so the result is not safe as exact truth.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A fraud platform tracks account actions as a turnstile stream: login attempts add signal, successful identity checks subtract risk, refunds adjust earlier purchases, and delayed corrections arrive out of order. A Count-Min Sketch would not handle the negative corrections cleanly because its counters are designed for nonnegative increments and one-sided estimates. Count Sketch lets each event carry a signed delta, merges summaries across shards, and gives an approximate frequency signal that can feed an exact verifier for the small set of suspicious accounts.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not read signed counters as human counts. A negative cell can be completely normal because several signed keys collided there. The only meaningful query is the signed row estimate followed by a median. Also do not choose Count Sketch just because it sounds more advanced than Count-Min. If your updates are positive and one-sided overestimates are useful for candidate generation, Count-Min can be simpler and easier to reason about.',
        'As with every sketch, adversarial inputs can attack weak hash functions. Use keyed hashes or carefully chosen independent hash families when keys come from users. For billing, permissions, legal decisions, or deletion, treat the sketch as a filter and verify candidates exactly.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Charikar, Chen, and Farach-Colton, "Finding Frequent Items in Data Streams", which introduces Count Sketch: https://www.cs.princeton.edu/courses/archive/spr04/cos598B/bib/CharikarCF.pdf. For comparison, read Count-Min Sketch for one-sided positive counters, Feature Hashing Signed Projection Primer for signed hashed feature vectors, Conservative Count-Min Sketch for lower positive-stream bias, Heavy Hitters: Space-Saving Summaries for retaining candidate keys, and Hierarchical Heavy Hitters: Prefix Sketch for network rollups over IP prefixes.',
      ],
    },
  ],
};
