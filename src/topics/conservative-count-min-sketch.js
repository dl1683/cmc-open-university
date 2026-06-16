// Conservative Count-Min Sketch: lower-bias positive stream updates.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'conservative-count-min-sketch',
  title: 'Conservative Count-Min Sketch',
  category: 'Data Structures',
  summary: 'Reduce Count-Min overcount bias by updating only the rows that currently match the minimum estimate.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['conservative updates', 'bias case study'], defaultValue: 'conservative updates' },
  ],
  run,
};

const WIDTH = 6;
const ROWS = [
  { id: 'r0', label: 'row 0' },
  { id: 'r1', label: 'row 1' },
  { id: 'r2', label: 'row 2' },
  { id: 'r3', label: 'row 3' },
];
const COLUMNS = Array.from({ length: WIDTH }, (_, i) => ({ id: `c${i}`, label: String(i) }));

const HASHES = new Map([
  ['hot', [1, 3, 2, 5]],
  ['scan', [1, 0, 4, 5]],
  ['login', [2, 3, 1, 0]],
  ['bot', [5, 3, 2, 4]],
  ['cdn:/hero.jpg', [1, 3, 2, 5]],
  ['cdn:/once.css', [1, 0, 4, 5]],
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

function positionsFor(key) {
  const known = HASHES.get(key);
  if (known) return known;
  let seed = 11;
  for (const ch of key) seed = (seed * 37 + ch.charCodeAt(0)) % 997;
  return ROWS.map((_, i) => (seed * (i + 5) + i) % WIDTH);
}

function cellIdsFor(key) {
  return positionsFor(key).map((column, row) => `${ROWS[row].id}:c${column}`);
}

function estimate(sketch, key) {
  return Math.min(...positionsFor(key).map((column, row) => sketch[row][column]));
}

function standardUpdate(sketch, key, delta = 1) {
  positionsFor(key).forEach((column, row) => {
    sketch[row][column] += delta;
  });
}

function conservativeUpdate(sketch, key, delta = 1) {
  const current = estimate(sketch, key);
  positionsFor(key).forEach((column, row) => {
    if (sketch[row][column] === current) {
      sketch[row][column] = Math.max(sketch[row][column], current + delta);
    }
  });
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

function updateGraph(title) {
  return graphState({
    nodes: [
      { id: 'event', label: 'event', x: 0.6, y: 3.5, note: 'positive' },
      { id: 'probe', label: 'probe', x: 2.3, y: 3.5, note: 'all rows' },
      { id: 'min', label: 'min', x: 4.1, y: 3.5, note: 'estimate' },
      { id: 'only', label: 'only min', x: 6.1, y: 3.5, note: 'lift' },
      { id: 'query', label: 'query', x: 8.3, y: 3.5, note: 'less bias' },
    ],
    edges: [
      { id: 'e-event-probe', from: 'event', to: 'probe', weight: '' },
      { id: 'e-probe-min', from: 'probe', to: 'min', weight: '' },
      { id: 'e-min-only', from: 'min', to: 'only', weight: '' },
      { id: 'e-only-query', from: 'only', to: 'query', weight: '' },
    ],
  }, { title });
}

function* conservativeUpdates() {
  yield {
    state: updateGraph('Conservative update lifts only the minimum rows'),
    highlight: { active: ['probe', 'min', 'only', 'e-min-only'], found: ['query'] },
    explanation: 'Standard Count-Min increments every hashed counter for a positive event. Conservative update first asks what the current estimate is, then increments only the rows that equal that minimum. Rows already above the minimum are probably polluted by collisions, so pushing them higher just adds bias.',
    invariant: 'The method is for positive updates. Deletions belong to a different sketch contract, such as Count Sketch.',
  };

  const sketch = emptySketch();
  standardUpdate(sketch, 'scan', 5);
  standardUpdate(sketch, 'bot', 3);
  standardUpdate(sketch, 'hot', 2);

  yield {
    state: sketchState(sketch, 'before another hot event: rows disagree'),
    highlight: { active: cellIdsFor('hot') },
    explanation: `The hot key currently reads counters ${positionsFor('hot').map((column, row) => sketch[row][column]).join(', ')}, so its estimate is ${estimate(sketch, 'hot')}. Some rows are inflated by scan and bot collisions. Conservative update treats the smallest row as the least polluted witness.`,
  };

  const standard = sketch.map((row) => [...row]);
  const conservative = sketch.map((row) => [...row]);
  standardUpdate(standard, 'hot', 1);
  conservativeUpdate(conservative, 'hot', 1);

  yield {
    state: matrixState({
      title: 'One more hot event: standard vs conservative',
      rows: ROWS,
      columns: [
        { id: 'before', label: 'before' },
        { id: 'std', label: 'standard' },
        { id: 'cu', label: 'CU' },
      ],
      values: ROWS.map((_, r) => {
        const c = positionsFor('hot')[r];
        return [sketch[r][c], standard[r][c], conservative[r][c]];
      }),
      format: String,
    }),
    highlight: { active: ['r0:cu', 'r2:cu'], compare: ['r1:std', 'r3:std'] },
    explanation: 'Standard Count-Min increments all four touched cells. Conservative update increments only rows at the minimum. The estimate still rises by one, but already-inflated rows do not get inflated again.',
  };

  yield {
    state: labelMatrix(
      'Estimator behavior',
      [
        { id: 'hot', label: 'hot URL' },
        { id: 'scan', label: 'scan URL' },
        { id: 'absent', label: 'absent key' },
        { id: 'merge', label: 'merge need' },
      ],
      [
        { id: 'standard', label: 'standard CMS' },
        { id: 'cu', label: 'conservative' },
      ],
      [
        ['safe overcount', 'lower overcount'],
        ['adds noise', 'less noise'],
        ['can be >0', 'often lower'],
        ['linear add', 'check contract'],
      ],
    ),
    highlight: { active: ['hot:cu', 'scan:cu'], compare: ['merge:standard', 'merge:cu'] },
    explanation: 'Conservative update usually improves point estimates on positive streams. The cost is a more subtle contract: the update depends on the current estimate, so it is not the same purely linear update rule as standard Count-Min.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'stream skew', min: 0, max: 100 }, y: { label: 'overcount bias', min: 0, max: 40 } },
      series: [
        { id: 'std', label: 'standard CMS', points: [{ x: 0, y: 2 }, { x: 30, y: 7 }, { x: 60, y: 18 }, { x: 100, y: 34 }] },
        { id: 'cu', label: 'conservative', points: [{ x: 0, y: 1 }, { x: 30, y: 3 }, { x: 60, y: 8 }, { x: 100, y: 14 }] },
      ],
    }),
    highlight: { active: ['cu'], compare: ['std'] },
    explanation: 'The exact improvement is workload-dependent, but the intuition is stable: do not keep raising counters that are already above the current minimum. The method is a bias reducer, not a proof of exactness.',
  };
}

function* biasCaseStudy() {
  yield {
    state: graphState({
      nodes: [
        { id: 'req', label: 'requests', x: 0.6, y: 3.5, note: 'URLs' },
        { id: 'cms', label: 'CMS-CU', x: 2.6, y: 3.5, note: 'freq' },
        { id: 'admit', label: 'admit?', x: 4.8, y: 3.5, note: 'TinyLFU' },
        { id: 'cache', label: 'cache', x: 6.8, y: 3.5, note: 'hot set' },
        { id: 'verify', label: 'replay', x: 8.8, y: 3.5, note: 'trace check' },
      ],
      edges: [
        { id: 'e-req-cms', from: 'req', to: 'cms', weight: '' },
        { id: 'e-cms-admit', from: 'cms', to: 'admit', weight: '' },
        { id: 'e-admit-cache', from: 'admit', to: 'cache', weight: '' },
        { id: 'e-cache-verify', from: 'cache', to: 'verify', weight: '' },
      ],
    }, { title: 'Case study: cache admission should not reward collision noise' }),
    highlight: { active: ['cms', 'admit', 'cache'], found: ['verify'] },
    explanation: 'A CDN or API cache uses a TinyLFU-style frequency sketch to decide whether a missed object should evict a resident. False frequency from collisions is expensive: a one-time scan object can push out a genuinely hot item. Conservative Count-Min lowers that false-admission pressure.',
  };

  yield {
    state: labelMatrix(
      'Admission examples',
      [
        { id: 'hero', label: '/hero.jpg' },
        { id: 'once', label: '/once.css' },
        { id: 'api', label: '/api/feed' },
        { id: 'victim', label: 'resident' },
      ],
      [
        { id: 'truth', label: 'true' },
        { id: 'std', label: 'CMS' },
        { id: 'cu', label: 'CU' },
      ],
      [
        ['40', '46', '42'],
        ['1', '9', '3'],
        ['18', '22', '19'],
        ['20', '21', '20'],
      ],
    ),
    highlight: { active: ['once:std', 'once:cu'], found: ['victim:cu'] },
    explanation: 'The scan object is the dangerous row. Standard Count-Min can inflate it enough to challenge a resident. Conservative update still overestimates, but the estimate stays closer to reality and avoids many false admissions.',
  };

  yield {
    state: labelMatrix(
      'Operational rules',
      [
        { id: 'positive', label: 'positive stream' },
        { id: 'merge', label: 'many shards' },
        { id: 'adversary', label: 'hostile keys' },
        { id: 'decision', label: 'hard decision' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'why', label: 'why' },
      ],
      [
        ['use CU', 'bias lower'],
        ['test merge', 'update not linear'],
        ['keyed hash', 'avoid crafted collisions'],
        ['verify exact', 'sketch is signal'],
      ],
    ),
    highlight: { found: ['positive:rule', 'decision:rule'], compare: ['merge:rule'] },
    explanation: 'The most important caveat is merge semantics. Standard Count-Min sketches merge cleanly by addition. Conservative update is state-dependent; if exact distributed equivalence matters, verify the chosen implementation or use the standard sketch for the merge layer.',
  };

  yield {
    state: updateGraph('A conservative sketch is a bias-control layer'),
    highlight: { active: ['event', 'probe', 'min', 'only'], found: ['query'] },
    explanation: 'Think of conservative update as a local repair to the Count-Min update rule. It does not turn approximate counts into truth; it just avoids spending counter budget on rows that already look suspiciously high.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'conservative updates') yield* conservativeUpdates();
  else if (view === 'bias case study') yield* biasCaseStudy();
  else throw new InputError('Pick a Conservative Count-Min view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Conservative Count-Min Sketch, often called Count-Min Sketch with Conservative Update, is a variation of Count-Min for positive streams. Standard Count-Min increments every hashed counter on update. Conservative update first computes the current minimum estimate for the key, then increments only the hashed counters that are equal to that minimum. Rows already above the minimum are likely polluted by collisions, so the algorithm avoids raising them further.',
        'The data structure answers the same question as Count-Min: approximately how many times have I seen this key? The difference is practical bias control. Count-Min never undercounts and can overcount. Conservative update keeps that positive-stream spirit while reducing unnecessary overcount in many workloads.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For a unit positive update to key x, read the d counters at h_1(x), h_2(x), ..., h_d(x). Let m be their minimum. Increment only the counters whose current value equals m. Equivalently, for a positive increment c, lift those counters toward m + c while leaving already-higher counters alone. Query is unchanged: return the minimum of the touched counters.',
        'The intuition is that the smallest touched counter is the least polluted row. If another row is already much larger, it probably includes traffic from colliding keys. Standard Count-Min would increase that polluted row again, preserving a high overestimate. Conservative update spends the increment only where it can raise the estimate without compounding obvious collision noise.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Update cost remains O(d), query cost remains O(d), and space remains O(d * w). The additional work is a read-before-write over the same d counters. The important cost is semantic: the update is state-dependent. Standard Count-Min sketches with the same hashes are linear and merge by cell-wise addition. Conservative-update implementations should be checked carefully when distributed merge equivalence matters.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A W-TinyLFU cache admission policy estimates URL frequency to decide whether a missed object should enter the main cache. A standard Count-Min Sketch can overestimate one-time scan URLs when they collide with hot objects, making the cache admit noise and evict useful residents. Conservative update reduces that false frequency by avoiding increments to rows already above the minimum. The cache still verifies quality with trace replay and hit-rate measurement, but the sketch becomes a better admission signal.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Conservative update is not a deletion mechanism. It assumes positive increments. If counts can go down, use Count Sketch or another turnstile-compatible structure. Also avoid treating the lower estimate as exact. Collisions remain; they are just less aggressively amplified.',
        'Do not ignore merge requirements. If every shard updates conservatively and then the matrices are added, the result may not match one centralized conservative-update sketch over the same event order. That may be acceptable for an operational signal, but it should be explicit in the design document.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Graham Cormode describes conservative update in his Count-Min Sketch encyclopedia entry and attributes the update idea to Estan and Varghese: https://dimacs.rutgers.edu/~graham/pubs/papers/cmencyc.pdf. The original Count-Min paper is https://dimacs.rutgers.edu/~graham/pubs/papers/cm-full.pdf. For modern analysis, see "Count-Min Sketch with Conservative Updates: Worst-Case Analysis" at https://arxiv.org/abs/2405.12034. Study Count-Min Sketch first, then Count Sketch for signed turnstile updates, W-TinyLFU Cache Admission for the cache case study, and Elastic Sketch for a network telemetry design that separates heavy and light flows.',
      ],
    },
  ],
};
