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
      heading: 'How to read the animation',
      paragraphs: [
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/conservative-count-min-sketch.gif', alt: 'Animated walkthrough of the conservative count min sketch visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Count-Min Sketch is useful because it gives fixed-memory frequency estimates, but its one-sided error can become too pessimistic. A few hot collisions can keep inflating rows that are already too high. Conservative Count-Min exists to reduce that positive-stream bias while keeping the same query shape.',
        {
          type: 'callout',
          text: 'Conservative update lowers Count-Min bias by refusing to raise counters that are already above the current minimum witness.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious update is standard Count-Min: increment every hashed counter for the key. That preserves a clean linear merge rule and never undercounts positive streams. It also spends update budget on counters that already look polluted by other keys.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The minimum row is the estimate. If another touched row is already above that minimum, raising it again cannot improve the current answer; it can only preserve or worsen future overestimates. The wall is avoiding avoidable bias without making updates expensive.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Read the key estimate before writing. Increment only the rows whose counters equal the current minimum. Rows already above the minimum are likely carrying collision mass, so the update refuses to amplify them further.',
      ],
    },
    {
      heading: 'Reading the visualization',
      paragraphs: [
        'In the conservative-update view, look at the rows that disagree. The smallest touched counter is the current estimate. Counters already above that value are probably carrying collision mass, so conservative update refuses to raise them again.',
        'In the bias case study, read the cache admission decision as the real consequence. A false frequency estimate can admit one-off scan objects and evict genuinely hot entries. Lowering overcount bias improves the decision even though the sketch remains approximate.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For a positive update to x, read counters h_1(x), h_2(x), ..., h_d(x). Let m be their minimum. For a unit update, increment only counters equal to m. For a larger increment, lift eligible counters toward m plus the increment. Query is unchanged: return the minimum touched counter.',
        {
          type: 'image',
          src: 'https://mermaid.ink/svg/pako:Lc1NCsIwEMXxfU7xLtArCPZDFOqm25BFTEcabGYgmbb09mJw_Xv833uVIyw-K8bJXO2wEys-dDo0zQWtvfuyILIKZmQ5ijNtlc5O5GeobGGhGUE2VsrFma5yb5-RY9oSqGhMXsmZvspgHxwypd-P8HoiRf6Xhzq42VEOypCdcs3iFX1xXw',
          alt: 'Conservative Count-Min update probes hash rows, reads the minimum estimate, and increments only minimum rows.',
          caption: 'Conservative update changes only the write rule: read all touched counters, find the minimum, and lift only the minimum witnesses. Source: https://mermaid.ink/svg/pako:Lc1NCsIwEMXxfU7xLtArCPZDFOqm25BFTEcabGYgmbb09mJw_Xv833uVIyw-K8bJXO2wEys-dDo0zQWtvfuyILIKZmQ5ijNtlc5O5GeobGGhGUE2VsrFma5yb5-RY9oSqGhMXsmZvspgHxwypd-P8HoiRf6Xhzq42VEOypCdcs3iFX1xXw',
        },
        'This is still a Count-Min family structure: multiple hash rows, one counter per row, and a minimum query. The only changed step is the write rule. Standard Count-Min writes all touched counters. Conservative update writes only the counters that are still plausible witnesses for the current count.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The estimate still rises when it must: at least one minimum row is incremented. Rows above the minimum cannot be the current limiting witness, so skipping them avoids compounding visible collision noise. The method reduces bias in many workloads, but it does not remove collisions or make answers exact.',
        'The guarantee is weaker than exact counting but stronger than wishful thinking. Positive Count-Min never underestimates because every true update raises at least the limiting evidence for that key. Conservative update preserves the intent of that evidence while avoiding needless inflation in rows that already overshot.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Update remains O(d), query remains O(d), and memory remains O(d * w). The extra work is read-before-write over the same counters. The deeper cost is semantic: the update is state-dependent, so distributed merge behavior is not the same simple linear story as standard Count-Min.',
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        'Use conservative update only for nonnegative streams. The method relies on the Count-Min one-sided overestimate property. If updates can subtract, the minimum row no longer has the same meaning, and a signed sketch such as Count Sketch is the better starting point.',
        'Keep hash seeds stable and preferably keyed when inputs may be adversarial. Conservative update lowers ordinary collision bias, but it does not protect against crafted keys that intentionally collide across rows.',
        'Track estimate error with replay samples. In a cache, periodically compare sketch estimates with exact counts from a bounded trace window. The sketch should improve admission decisions, not become an uninspected source of false popularity.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'It fits positive-stream signals where overestimation hurts decisions, such as W-TinyLFU cache admission. A scan URL that collides with hot objects should not evict useful residents just because polluted rows kept getting incremented. Conservative update makes the sketch a cleaner admission signal.',
        'It is most useful when the stream is skewed. Hot keys and scan traffic create polluted counters, and conservative update avoids repeatedly raising rows that already look contaminated. In nearly uniform traffic, the improvement may be modest.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It is not a deletion or turnstile sketch. If counts can go down, use Count Sketch or another signed-update structure. Also verify merge requirements: adding conservatively updated shard matrices may not equal one centralized conservative-update sketch over the same event order.',
        'It also does not defend against bad hashing. If an attacker can choose keys that collide with important counters, conservative update reduces some damage but cannot restore the missing independence assumption. Use keyed hashes when the key stream is hostile.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Imagine the hot key touches counters [2, 9, 2, 7]. The estimate is 2. A standard update increments all four counters to [3, 10, 3, 8]. Conservative update increments only the minimum witnesses, producing [3, 9, 3, 7]. The estimate still becomes 3, but polluted rows do not get more polluted.',
        'That difference compounds. In a cache admission sketch, one-off scan keys may collide with hot keys. Standard updates can make those scan keys look frequent enough to enter the cache. Conservative update keeps their estimates closer to reality, so the cache is less likely to replace useful resident objects with accidental collision winners.',
      ],
    },
    {
      heading: 'Rule of thumb',
      paragraphs: [
        'Use standard Count-Min when merge simplicity is the main requirement. Use conservative update when a local positive stream feeds threshold decisions and ordinary overcount bias is visibly hurting those decisions.',
        'Do not let the name oversell the method. Conservative update is conservative about raising counters, not conservative in the risk-management sense. It still needs exact verification for expensive actions.',
      ],
    },
    {
      heading: 'Operational case study',
      paragraphs: [
        'Consider a CDN cache that admits objects only if their estimated frequency beats the resident object. Standard Count-Min may inflate scan objects when one-time URLs collide with genuinely hot URLs. Those scan objects can then enter the cache, consume memory, and lower hit rate.',
        {
          type: 'image',
          src: 'https://mermaid.ink/svg/pako:TcsxDoIwFAbgnVO8C8ARNFDEQV1wbDo07W9oAi22DwwR724gDs5fvkcfXqbTkenaZqVs8ZyQmBJH6EFRnh-okiL4hDhrdjNI3O4qq3YRsolb8GYhJHaDZqhM7Fa_Szs4Jg5ktOlw_GT1BuuCtNJJthh7bUARyVl4Vj_2YaVGXoDxj85ShL53yQVPPrgERXlBEXYysFTkVH0B',
          alt: 'Request stream feeds a conservative Count-Min sketch whose estimate controls cache admission decisions.',
          caption: 'For cache admission, lower collision bias matters because a false hot estimate can evict a useful resident object. Source: https://mermaid.ink/svg/pako:TcsxDoIwFAbgnVO8C8ARNFDEQV1wbDo07W9oAi22DwwR724gDs5fvkcfXqbTkenaZqVs8ZyQmBJH6EFRnh-okiL4hDhrdjNI3O4qq3YRsolb8GYhJHaDZqhM7Fa_Szs4Jg5ktOlw_GT1BuuCtNJJthh7bUARyVl4Vj_2YaVGXoDxj85ShL53yQVPPrgERXlBEXYysFTkVH0B',
        },
        'Conservative update changes the pressure on that decision. Hot objects still raise their minimum witnesses, but rows already inflated by other traffic do not keep rising just because a colliding key appeared. The admission policy sees fewer accidental hot keys, so cache churn drops.',
        'The team should still replay traffic before shipping. Measure hit rate, false admissions, resident churn, and p99 lookup cost under the same hash seeds and cache size. A sketch update rule is only useful if it improves the system decision it feeds.',
      ],
    },
    {
      heading: 'What changes from Count-Min',
      paragraphs: [
        'The query contract stays the same: read the touched counters and return the minimum. That is important because conservative update can often replace standard updates without changing downstream readers.',
        'The write contract changes. Standard Count-Min is linear and order-insensitive for positive updates: applying shard A then shard B gives the same matrix as adding their matrices. Conservative update depends on the current counter values at update time, so replay order and distributed merge strategy deserve explicit tests.',
        'That distinction is the whole engineering tradeoff. Conservative update buys lower bias in a local stream, while standard Count-Min buys simpler algebra across shards.',
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
