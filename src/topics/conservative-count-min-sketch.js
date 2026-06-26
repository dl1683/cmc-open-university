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
        'The "conservative updates" view starts with a pipeline diagram showing the update flow: an event is hashed to probe all rows, the minimum counter is read, and only counters equal to that minimum are incremented. The sketch matrix then shows concrete counter values with active cells highlighting the positions touched by a key. A side-by-side comparison shows how standard and conservative updates differ on the same event. The bias plot compares overcount error as stream skew increases.',
        {type: 'callout', text: 'Conservative update lowers Count-Min bias by refusing to raise counters that are already above the current minimum witness.'},
        'The "bias case study" view traces a CDN cache admission decision. A request stream feeds a conservative Count-Min sketch that controls whether a missed object should enter the cache. The admission table shows true counts versus standard and conservative estimates for hot, scan, and API URLs. Watch how collision noise in the standard sketch can falsely promote a one-time scan object over a genuinely hot resident.',
        'At each frame, track which counters disagree, which is the minimum, and why raising an already-inflated counter would compound existing collision noise.',
        {type: 'image', src: './assets/gifs/conservative-count-min-sketch.gif', alt: 'Animated walkthrough of the conservative count min sketch visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Count-Min Sketch gives fixed-memory frequency estimates for a data stream, but every estimate can only be correct or too high, never too low. When keys collide in the hash table, their counters inflate each other. A few hot keys can push shared counters far above the true count for less frequent keys. Conservative Count-Min Sketch exists to reduce that upward bias while keeping the same query interface and memory layout.',
        'The motivation is practical. In cache admission, a falsely high frequency estimate can admit a one-time scan object and evict a genuinely popular item. In network monitoring, inflated counts can trigger false alerts. Any system that makes threshold decisions based on Count-Min estimates benefits from lower bias.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Standard Count-Min updates every hashed counter for a key by the same increment. If key x hashes to positions [1, 3, 2, 5] across four rows, all four counters increase by one. This preserves a clean algebraic property: two sketches built on different shards of the same stream can be merged by adding their matrices element-wise.',
        'The downside is that it spends update budget on counters that are already inflated by other keys. If counter [row 1, col 3] is already at 9 because of collisions with hot keys, raising it to 10 does not help the estimate for x. It only makes future queries for other keys that also hash to that cell worse.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The estimate for a key is the minimum of its touched counters. If some of those counters are already above the true count due to collisions, the minimum is still correct as long as at least one counter has not been polluted. Raising the polluted counters higher cannot improve the current estimate. It can only preserve or worsen future estimates for keys that share those cells.',
        'The wall is avoidable bias. Standard Count-Min adds noise to already-noisy cells on every update. The sketch cannot remove collisions, but it can stop compounding them.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Read the current estimate before writing. The estimate is the minimum of the touched counters. Increment only the counters that equal that minimum. Counters already above the minimum are carrying collision mass from other keys, so the update refuses to push them higher.',
        'This is a one-line change to the update rule. The query rule stays the same: return the minimum touched counter. The data structure stays the same: d rows of w counters. The only difference is which counters get incremented on each event.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For a positive update to key x with increment delta, hash x to d positions (one per row). Read the d counters. Let m be their minimum. For each counter that equals m, set it to m + delta. Leave all other counters unchanged. For a query, return the minimum of the d touched counters, exactly as in standard Count-Min.',
        {
          type: 'image',
          src: 'https://mermaid.ink/svg/pako:Lc1NCsIwEMXxfU7xLtArCPZDFOqm25BFTEcabGYgmbb09mJw_Xv833uVIyw-K8bJXO2wEys-dDo0zQWtvfuyILIKZmQ5ijNtlc5O5GeobGGhGUE2VsrFma5yb5-RY9oSqGhMXsmZvspgHxwypd-P8HoiRf6Xhzq42VEOypCdcs3iFX1xXw',
          alt: 'Conservative Count-Min update probes hash rows, reads the minimum estimate, and increments only minimum rows.',
          caption: 'Conservative update changes only the write rule: read all touched counters, find the minimum, and lift only the minimum witnesses. Source: https://mermaid.ink/svg/pako:Lc1NCsIwEMXxfU7xLtArCPZDFOqm25BFTEcabGYgmbb09mJw_Xv833uVIyw-K8bJXO2wEys-dDo0zQWtvfuyILIKZmQ5ijNtlc5O5GeobGGhGUE2VsrFma5yb5-RY9oSqGhMXsmZvspgHxwypd-P8HoiRf6Xhzq42VEOypCdcs3iFX1xXw',
        },
        'The update is still O(d) per event and the query is still O(d) per lookup, where d is the number of hash rows. Memory is still O(d * w) counters. The extra cost is a read-before-write over the same d cells. In practice, those cells are already in cache from the hash computation, so the overhead is small.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The estimate still rises when it must. At least one counter at the minimum is incremented, so the minimum increases by delta. The overcount guarantee is preserved: the estimate is always greater than or equal to the true count, because every true event raises at least the minimum witness.',
        'Rows above the minimum cannot be the current limiting witness, so skipping them does not affect the current estimate. It avoids compounding visible collision noise. Over a skewed stream, the accumulated bias reduction can be substantial because hot keys collide frequently and standard updates keep inflating already-high cells.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Time: O(d) per update, O(d) per query, same as standard Count-Min. Space: O(d * w) counters, same as standard Count-Min. The only added work is reading d counters before writing, which is a constant-factor overhead on an already fast operation.',
        'The deeper cost is semantic. The update depends on the current counter values, not just the increment. This means conservative update is not a linear operation. Two sketches built independently on two shards of a stream cannot be merged by simple addition and produce the same result as one sketch built on the combined stream. If distributed merge is a requirement, use standard Count-Min for the merge layer or verify the chosen implementation handles the merge contract correctly.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Conservative Count-Min is used in W-TinyLFU cache admission, where overestimation of frequency can admit scan traffic and evict useful residents. Caffeine (Java) and other high-performance caches use this variant. Network monitoring systems use it when frequency thresholds drive alerts, because lower bias means fewer false positives.',
        {
          type: 'image',
          src: 'https://mermaid.ink/svg/pako:TcsxDoIwFAbgnVO8C8ARNFDEQV1wbDo07W9oAi22DwwR724gDs5fvkcfXqbTkenaZqVs8ZyQmBJH6EFRnh-okiL4hDhrdjNI3O4qq3YRsolb8GYhJHaDZqhM7Fa_Szs4Jg5ktOlw_GT1BuuCtNJJthh7bUARyVl4Vj_2YaVGXoDxj85ShL53yQVPPrgERXlBEXYysFTkVH0B',
          alt: 'Request stream feeds a conservative Count-Min sketch whose estimate controls cache admission decisions.',
          caption: 'For cache admission, lower collision bias matters because a false hot estimate can evict a useful resident object. Source: https://mermaid.ink/svg/pako:TcsxDoIwFAbgnVO8C8ARNFDEQV1wbDo07W9oAi22DwwR724gDs5fvkcfXqbTkenaZqVs8ZyQmBJH6EFRnh-okiL4hDhrdjNI3O4qq3YRsolb8GYhJHaDZqhM7Fa_Szs4Jg5ktOlw_GT1BuuCtNJJthh7bUARyVl4Vj_2YaVGXoDxj85ShL53yQVPPrgERXlBEXYysFTkVH0B',
        },
        'It is most useful when the stream is skewed. Hot keys and scan traffic create polluted counters, and conservative update avoids repeatedly raising cells that are already above the true count. In nearly uniform traffic, the improvement over standard Count-Min is modest because collision bias is already low.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Conservative update only works for nonnegative streams. It relies on the Count-Min property that estimates are always at or above the true count. If updates can subtract, the minimum row no longer has the same meaning, and a signed sketch such as Count Sketch is the right starting point.',
        'It does not defend against adversarial hashing. If an attacker can choose keys that collide with important counters, conservative update reduces some damage but cannot restore the missing independence. Use keyed (secret-seeded) hash functions when the key stream may be hostile.',
        'Merge semantics are the main operational risk. Standard Count-Min sketches merge by element-wise addition. Conservative update is state-dependent, so merging two independently built sketches by addition may produce different estimates than building one sketch on the combined stream. Test merge behavior before deploying across shards.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A sketch has 4 rows and 6 columns. Key "hot" hashes to columns [1, 3, 2, 5]. After processing earlier events, the counters at those positions are [2, 9, 2, 7]. The current estimate for "hot" is min(2, 9, 2, 7) = 2.',
        'A new "hot" event arrives. Standard Count-Min increments all four counters: [3, 10, 3, 8]. The estimate becomes min(3, 10, 3, 8) = 3. Conservative update increments only the two counters that equal the minimum (2): [3, 9, 3, 7]. The estimate also becomes min(3, 9, 3, 7) = 3.',
        'Both methods produce the same estimate for "hot" after this event. But the standard method pushed the already-inflated counters at positions 1 and 3 even higher. Those counters are shared with other keys. By leaving them unchanged, conservative update avoids worsening future estimates for any key that hashes to column 3 in row 1 or column 5 in row 3. Over thousands of events, this difference compounds into measurably lower bias across the sketch.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Estan and Varghese proposed conservative update for counting sketches. Cormode describes it in his Count-Min Sketch encyclopedia entry: https://dimacs.rutgers.edu/~graham/pubs/papers/cmencyc.pdf. The original Count-Min paper is Cormode and Muthukrishnan (2005): https://dimacs.rutgers.edu/~graham/pubs/papers/cm-full.pdf. For worst-case analysis, see "Count-Min Sketch with Conservative Updates: Worst-Case Analysis" at https://arxiv.org/abs/2405.12034.',
        'Study Count-Min Sketch first to understand the base structure. Then study Count Sketch for signed turnstile updates, W-TinyLFU Cache Admission for the cache case study, Bloom Filter for another hash-based approximate structure, and Elastic Sketch for a network telemetry design that separates heavy and light flows.',
      ],
    },
  ],
};
