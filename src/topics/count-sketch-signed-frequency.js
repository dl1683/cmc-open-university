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
        'The animation shows a Count Sketch with five rows and seven buckets per row. Active cells mark the buckets touched by the current update or query. Compared cells show where an earlier key landed in the same row, making collisions visible.',
        {
          type: 'callout',
          text: 'Signed hashes make collision noise cancel in expectation, so a fixed table can estimate streams with both positive and negative updates.',
        },
        'In the "signed counters" view, watch how each key lands in one bucket per row but pushes the counter up or down depending on its sign hash. Negative counters are not errors. They encode the direction assigned to each key and are essential to the unbiased query.',
        'In the "turnstile merge" view, observe negative deltas flowing through the same update path as positive ones. The merge step adds matching cells from two shards, producing the same sketch as if both streams had been processed together. Follow the row estimates table to see how the sign is reversed at query time and the median selects the robust answer.',
      
        {type: 'image', src: './assets/gifs/count-sketch-signed-frequency.gif', alt: 'Animated walkthrough of the count sketch signed frequency visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Streaming systems need approximate frequency counts without storing every distinct key. Page views, telemetry pings, graph edges, inventory adjustments, and feature counters arrive faster than an exact map can absorb when the key space runs into millions or billions.',
        'Some streams also subtract. A reservation is released, a refund corrects revenue, a graph edge is deleted, a delayed correction cancels an earlier event. These are turnstile streams: the count of a key can go up or down, and the data structure must handle both directions without growing.',
        {
          type: 'quote',
          text: 'Finding frequent items in data streams.',
          attribution: 'Charikar, Chen, Farach-Colton, 2002 -- the paper that introduced Count Sketch',
        },
        'Count Sketch was designed for exactly this setting. It keeps a fixed-size table of signed counters and answers frequency queries with an unbiased estimate whose error depends on the L2 norm of the remaining stream, not on the total event count. That error contract matters whenever downstream math -- inner products, second-moment estimation, heavy-hitter detection -- needs centered noise rather than one-sided overestimates.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The exact solution is a hash map from key to count. It handles negative updates, returns perfect answers, and is simple to implement. The cost is memory: one entry per distinct key. For a stream with ten million unique keys, that map can consume hundreds of megabytes. For a billion keys, it is impractical.',
        'The approximate solution most learners see first is Count-Min Sketch. It uses d independent hash rows, each with w buckets. An update increments one bucket per row. A query returns the minimum across rows, which is an overestimate because collisions only push counts upward.',
        'Count-Min works well for nonnegative streams where one-sided error is acceptable. But it cannot handle deletions naturally, and the overcount bias becomes a problem when estimates feed linear algebra -- inner products, covariance estimation, or second-moment tracking. A biased estimator distorts every computation built on top of it.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Fixed memory means collisions are unavoidable. Multiple keys share each bucket, and their contributions mix. The question is not whether collisions happen but what shape the resulting error takes.',
        'Count-Min Sketch forces all collision noise to be positive. A key with true count zero can appear to have count 50 because unrelated keys hit the same buckets. The minimum across rows limits the damage, but it cannot eliminate the bias. Every estimate is at least as large as the true count, never smaller.',
        'For turnstile streams, the problem is worse. If a key is updated with delta = -3 and another key collides in the same bucket with delta = +10, the cell value conflates both. Count-Min has no mechanism to distinguish directions because it was designed for a world where counts only go up. A structure built for signed streams needs signed noise that cancels in expectation.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Count Sketch allocates d rows of w buckets each. Each row j has two hash functions: a position hash h_j that maps a key to a bucket in [0, w), and a sign hash s_j that maps the same key to +1 or -1.',
        {
          type: 'image',
          src: 'https://image.slideserve.com/122279/countsketch-data-structure-l.jpg',
          alt: 'CountSketch data structure with several hash tables and bucket columns',
          caption: 'CountSketch table family diagram. Source: https://image.slideserve.com/122279/countsketch-data-structure-l.jpg',
        },
        {
          type: 'diagram',
          label: 'Signed hash update across rows',
          text: [
            'key x, delta +1',
            '  |',
            '  +---> row 0: h0(x)=3, s0(x)=+1  =>  bucket[0][3] += (+1)(+1) = +1',
            '  +---> row 1: h1(x)=5, s1(x)=-1  =>  bucket[1][5] += (-1)(+1) = -1',
            '  +---> row 2: h2(x)=1, s2(x)=+1  =>  bucket[2][1] += (+1)(+1) = +1',
            '  +---> row 3: h3(x)=6, s3(x)=-1  =>  bucket[3][6] += (-1)(+1) = -1',
            '  +---> row 4: h4(x)=0, s4(x)=+1  =>  bucket[4][0] += (+1)(+1) = +1',
            '',
            'Query x: estimate_j = s_j(x) * bucket[j][h_j(x)]',
            'Final answer = median(estimate_0, ..., estimate_4)',
          ].join('\n'),
        },
        'To update key x with delta, each row computes s_j(x) * delta and adds it to bucket[j][h_j(x)]. The sign hash randomizes the direction: some rows store a positive contribution, others store a negative one. The key itself does not know or care which direction it was assigned.',
        'To query key x, each row reads bucket[j][h_j(x)] and multiplies by s_j(x). This reversal undoes the sign for the queried key, recovering its true contribution from that cell. Other keys that collided into the same bucket get multiplied by the wrong sign, turning their contributions into random noise centered on zero. The final estimate is the median across all d row estimates.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Fix a key x and a single row j. The cell bucket[j][h_j(x)] contains s_j(x) * f(x) plus the sum of s_j(y) * f(y) for every other key y that hashed to the same bucket. When we query x and multiply by s_j(x), the first term becomes f(x) -- the true frequency. Each collision term becomes s_j(x) * s_j(y) * f(y).',
        'Because s_j(x) and s_j(y) are independent random signs for distinct keys, the product s_j(x) * s_j(y) is equally likely to be +1 or -1. The expected value of each collision term is zero. The row estimate is therefore an unbiased estimator of f(x), centered on the true frequency with variance proportional to the sum of squared frequencies of colliding keys.',
        'Width controls variance: more buckets mean fewer collisions per bucket, so the variance in each row shrinks. Depth controls failure probability: with d independent rows, the probability that the median is far from the true frequency drops exponentially in d. The standard parameterization uses w = O(1/epsilon^2) and d = O(log(1/delta)) to guarantee |estimate - f(x)| <= epsilon * ||f_tail||_2 with probability at least 1 - delta, where f_tail excludes the queried key.',
        {
          type: 'note',
          text: 'The error bound depends on the L2 norm of the stream (the root sum of squared frequencies), not the L1 norm (total event count). A stream dominated by a few heavy hitters has small residual L2 mass, so light keys are estimated accurately. A uniform stream has large L2 mass relative to any single key, making individual estimates noisier.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Operation', 'Time', 'Space', 'Notes'],
          rows: [
            ['Update(key, delta)', 'O(d)', '--', 'One bucket touched per row'],
            ['Query(key)', 'O(d log d)', '--', 'Read d buckets, sort for median'],
            ['Merge(sketch A, sketch B)', 'O(d * w)', '--', 'Cell-wise addition, same seeds required'],
            ['Total memory', '--', 'O(d * w)', 'Independent of distinct key count'],
          ],
        },
        'Update cost is O(d) -- one hash, one sign computation, and one addition per row. Query cost is O(d) for reading cells plus O(d log d) for the median, though with small d (typically 5 to 15) the median is effectively constant time. Memory is d * w counters, usually 32-bit or 64-bit integers.',
        'The sketch is linear in a strict algebraic sense. If two workers process disjoint sub-streams using the same hash functions, adding their sketches cell by cell produces the same sketch as processing the combined stream on one machine. This linearity is why Count Sketch fits MapReduce, distributed telemetry, and sliding-window aggregation.',
        {
          type: 'code',
          language: 'javascript',
          text: [
            '// Median-of-means query for Count Sketch',
            'function query(sketch, key, hashFns, signFns) {',
            '  const estimates = [];',
            '  for (let j = 0; j < sketch.length; j++) {',
            '    const bucket = hashFns[j](key);',
            '    const sign = signFns[j](key);  // +1 or -1',
            '    estimates.push(sign * sketch[j][bucket]);',
            '  }',
            '  // Sort and return the median',
            '  estimates.sort((a, b) => a - b);',
            '  return estimates[Math.floor(estimates.length / 2)];',
            '}',
          ].join('\n'),
        },
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Count Sketch is the right tool whenever the stream is turnstile (counts go up and down), the application needs unbiased estimates, or the results feed linear algebra.',
        {
          type: 'bullets',
          items: [
            'Heavy-hitter detection in network telemetry: sketch traffic per source IP, subtract retransmissions and corrections, query the top candidates.',
            'L2 norm estimation: the sum of squared cell values in a single row is an unbiased estimator of ||f||_2^2. Average across rows for tighter bounds. This is the basis of the AMS sketch.',
            'Approximate inner products: given two sketches of vectors a and b built with the same hashes, the dot product of matching rows estimates a . b. Useful for similarity search over sparse feature vectors.',
            'Distributed stream aggregation: each shard sketches its local stream, a coordinator merges by cell-wise addition, and the merged sketch answers global frequency queries without shipping raw events.',
            'Sparse recovery and compressed sensing: Count Sketch is the algorithmic core of several sparse FFT and compressed sensing algorithms where a high-dimensional signal is projected into a small signed measurement table.',
          ],
        },
        'The unbiased property is the key differentiator. When Count-Min overestimates every frequency, any subtraction between two estimates inherits a positive bias. Count Sketch estimates are centered, so differences, sums, and inner products built from them remain unbiased.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Individual cells are not human-readable counts. Negative values are normal and expected. Operators accustomed to Count-Min, where every cell is a plausible upper bound, find Count Sketch cells confusing to debug.',
        'If all updates are nonnegative and one-sided overestimates are tolerable, Count-Min Sketch is simpler, uses a minimum instead of a median, and gives a deterministic upper bound. Count Sketch trades that bound for centered noise, which is only valuable when the application needs it.',
        'The sketch does not remember key names. It can estimate the frequency of a key you already know, but it cannot enumerate the top-k keys without help. In practice, Count Sketch is paired with a candidate-generation structure (Space-Saving, a heap, or a separate filter) to identify which keys to query.',
        {
          type: 'table',
          headers: ['Structure', 'Error shape', 'Supports deletions', 'Remembers keys', 'Best fit'],
          rows: [
            ['Count-Min Sketch', 'One-sided overestimate', 'No', 'No', 'Positive streams, upper-bound queries'],
            ['Count Sketch', 'Unbiased, symmetric noise', 'Yes (turnstile)', 'No', 'Signed streams, L2 estimation, inner products'],
            ['Space-Saving', 'Bounded overcount', 'No', 'Yes (top-k list)', 'Deterministic top-k with key retention'],
            ['Misra-Gries', 'Bounded undercount', 'No', 'Yes (candidate set)', 'Frequent-item candidates, low memory'],
          ],
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Primary source: Charikar, Chen, Farach-Colton, "Finding Frequent Items in Data Streams," 2002. Introduced Count Sketch with the sign-hash technique and median-of-rows aggregation.',
            'Cormode and Muthukrishnan, "An Improved Data Stream Summary: The Count-Min Sketch and its Applications," 2005. The companion structure with one-sided guarantees for comparison.',
            'Alon, Matias, Szegedy, "The Space Complexity of Approximating the Frequency Moments," 1996. The AMS sketch that first used four-wise independent sign hashes for second-moment estimation -- the theoretical ancestor of Count Sketch.',
          ],
        },
        'Study Count-Min Sketch to understand why one-sided error is sometimes preferable. Study Space-Saving to see how a deterministic structure retains key names for top-k. Study Feature Hashing to see the same sign trick applied to machine-learning feature vectors. Study the AMS Sketch (Alon-Matias-Szegedy) for the frequency-moment estimation that motivated the sign-hash idea.',
        'If you came here from Count-Min Sketch, the natural next step is understanding when each structure is the right choice. If you came here from streaming algorithms broadly, move to L2 sampling or sparse recovery, where Count Sketch is a building block rather than a final answer.',
      ],
    },
  ],
};
