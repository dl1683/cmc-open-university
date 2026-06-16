// Heavy hitters in streams: keep a small summary of candidate frequent keys
// with bounded overcount instead of tracking every distinct item.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'heavy-hitters-space-saving',
  title: 'Heavy Hitters: Space-Saving Summaries',
  category: 'Data Structures',
  summary: 'Find the frequent keys in a huge stream: keep a tiny counter table, evict the current minimum, and report candidates with error bounds.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['space-saving', 'compare sketches'], defaultValue: 'space-saving' },
  ],
  run,
};

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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function* spaceSaving() {
  yield {
    state: graphState({
      nodes: [
        { id: 'event', label: 'event', x: 0.8, y: 4.0, note: 'key' },
        { id: 'hit', label: 'hit?', x: 2.6, y: 4.0, note: 'known' },
        { id: 'inc', label: 'inc', x: 4.1, y: 4.0, note: 'or evict min' },
        { id: 'table', label: 'table', x: 6.1, y: 4.0, note: 'k slots' },
        { id: 'top', label: 'top-k', x: 8.2, y: 4.0, note: 'candidates' },
      ],
      edges: [
        { id: 'e-event-hit', from: 'event', to: 'hit' },
        { id: 'e-hit-inc', from: 'hit', to: 'inc' },
        { id: 'e-inc-table', from: 'inc', to: 'table' },
        { id: 'e-table-top', from: 'table', to: 'top' },
      ],
    }, { title: 'Space-Saving keeps only candidate heavy keys' }),
    highlight: { active: ['hit', 'inc', 'table'], found: ['top'] },
    explanation: 'A heavy-hitter summary cannot store every distinct key. Space-Saving keeps k candidate counters. Known keys increment; unknown keys replace the current minimum and inherit its count plus one.',
    invariant: 'The table is a summary of candidates, not an exact histogram.',
  };

  yield {
    state: labelMatrix(
      'Three-slot summary',
      [
        { id: 'a', label: 'login' },
        { id: 'b', label: 'search' },
        { id: 'c', label: 'bot' },
        { id: 'new', label: 'new key: api' },
      ],
      [
        { id: 'count', label: 'count' },
        { id: 'error', label: 'error' },
      ],
      [
        ['42', '0'],
        ['18', '2'],
        ['7', '3'],
        ['replace bot with 8', 'err<=7'],
      ],
    ),
    highlight: { active: ['c:count'], found: ['new:count', 'new:error'] },
    explanation: 'When a new key arrives and the table is full, replace the smallest counter. The new key may not really have count 8; its error field records how much of that count could belong to the evicted key.',
  };

  yield {
    state: labelMatrix(
      'Why this finds heavy hitters',
      [
        { id: 'many', label: 'many mice' },
        { id: 'elephant', label: 'elephant key' },
        { id: 'threshold', label: 'threshold' },
        { id: 'verify', label: 'verify' },
      ],
      [
        { id: 'effect', label: 'effect' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['evict each other', 'noise'],
        ['keeps returning', 'survives'],
        ['count high', 'candidate'],
        ['exact pass/store', 'decide'],
      ],
    ),
    highlight: { found: ['elephant:lesson', 'threshold:lesson'], compare: ['many:lesson'] },
    explanation: 'Small keys churn through the minimum slot. A genuinely frequent key keeps reappearing, increases its counter, and becomes hard to evict. Important decisions should still verify candidates exactly.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'stream skew', min: 0, max: 100 }, y: { label: 'candidate precision', min: 0, max: 100 } },
      series: [
        { id: 'space', label: 'Space-Saving', points: [{ x: 0, y: 35 }, { x: 30, y: 58 }, { x: 70, y: 84 }, { x: 100, y: 94 }] },
        { id: 'cms', label: 'CMS only', points: [{ x: 0, y: 25 }, { x: 30, y: 45 }, { x: 70, y: 70 }, { x: 100, y: 85 }] },
      ],
    }),
    highlight: { active: ['space'], compare: ['cms'] },
    explanation: 'The shape is illustrative: candidate summaries improve when the stream has strong elephants. Flat, low-skew streams are harder because no key clearly dominates.',
  };
}

function* compareSketches() {
  yield {
    state: labelMatrix(
      'Sketch family roles',
      [
        { id: 'cms', label: 'Count-Min' },
        { id: 'mg', label: 'Misra-Gries' },
        { id: 'ss', label: 'Space-Saving' },
        { id: 'hll', label: 'HyperLogLog' },
      ],
      [
        { id: 'answers', label: 'answers' },
        { id: 'doesnot', label: 'does not' },
      ],
      [
        ['count(key)', 'list keys'],
        ['frequent candidates', 'exact counts'],
        ['top-k candidates', 'exact counts'],
        ['distinct count', 'which keys'],
      ],
    ),
    highlight: { active: ['mg:answers', 'ss:answers'], compare: ['cms:doesnot', 'hll:doesnot'] },
    explanation: 'Count-Min can estimate the count of a named key, but it cannot list all keys by itself. Heavy-hitter summaries keep the candidate keys directly.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'events', label: 'events', x: 0.8, y: 4.0, note: 'stream' },
        { id: 'summary', label: 'summary', x: 2.7, y: 4.0, note: 'candidates' },
        { id: 'exact', label: 'exact', x: 4.7, y: 4.0, note: 'verify' },
        { id: 'alert', label: 'alert', x: 6.7, y: 4.0, note: 'safe' },
        { id: 'store', label: 'store', x: 8.5, y: 4.0, note: 'sample' },
      ],
      edges: [
        { id: 'e-events-summary', from: 'events', to: 'summary' },
        { id: 'e-summary-exact', from: 'summary', to: 'exact' },
        { id: 'e-exact-alert', from: 'exact', to: 'alert' },
        { id: 'e-summary-store', from: 'summary', to: 'store' },
      ],
    }, { title: 'Production pipelines verify the expensive few exactly' }),
    highlight: { active: ['summary', 'exact'], found: ['alert'] },
    explanation: 'A common production pattern is approximate first pass, exact second pass. The summary filters the huge stream down to a small candidate list, and exact storage or replay verifies important alerts.',
  };

  yield {
    state: labelMatrix(
      'Where it runs',
      [
        { id: 'net', label: 'network flows' },
        { id: 'search', label: 'search queries' },
        { id: 'logs', label: 'log keys' },
        { id: 'ml', label: 'feature drift' },
      ],
      [
        { id: 'heavy', label: 'heavy means' },
        { id: 'action', label: 'action' },
      ],
      [
        ['elephant flows', 'rate limit'],
        ['trending terms', 'cache/index'],
        ['hot errors', 'page owner'],
        ['top categories', 'investigate'],
      ],
    ),
    highlight: { found: ['net:action', 'logs:action'], active: ['search:heavy', 'ml:heavy'] },
    explanation: 'Heavy hitters are the "what is dominating right now?" question. That shows up in networking, search, observability, fraud, recommender telemetry, and feature monitoring.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'flat', label: 'flat stream' },
        { id: 'adversary', label: 'adversary' },
        { id: 'merge', label: 'bad merge' },
        { id: 'billing', label: 'billing' },
      ],
      [
        { id: 'risk', label: 'risk' },
        { id: 'response', label: 'response' },
      ],
      [
        ['no true heavy', 'wide uncertainty'],
        ['crafted churn', 'salt/hash'],
        ['incompatible params', 'align k/seeds'],
        ['approx counts', 'verify exact'],
      ],
    ),
    highlight: { removed: ['billing:risk'], found: ['billing:response', 'merge:response'] },
    explanation: 'Do not let an approximate summary become the source of legal, billing, or deletion truth. Use it to find candidates and route attention.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'space-saving') yield* spaceSaving();
  else if (view === 'compare sketches') yield* compareSketches();
  else throw new InputError('Pick a heavy-hitter view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A heavy-hitter summary is a streaming data structure for finding the keys that dominate a huge stream. The stream might contain IP flows, search queries, product IDs, log messages, or model features. Tracking every distinct key exactly can be too expensive, so the summary keeps a small table of candidate frequent keys.',
        'Space-Saving is a representative algorithm. If an incoming key is already in the table, increment its counter. If there is room, add it. If the table is full, replace the current minimum counter with the new key and record the inherited error. This produces candidate top-k keys with bounded uncertainty.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The intuition is that rare keys fight over the minimum slot and evict one another. A true elephant key keeps returning, pushes its counter up, and becomes hard to evict. Misra-Gries uses a related counter-decrement idea to guarantee that any item above a frequency threshold remains in the candidate set. Space-Saving is tuned toward top-k and frequent-element reporting with tight error tracking.',
        'This is different from Count-Min Sketch. Count-Min estimates the frequency of a key you name, but it cannot list all keys by itself. Heavy-hitter summaries carry candidate keys, making them natural for dashboards and alerts that ask "what changed?" or "who is dominating?" Count Sketch and Conservative Count-Min are point-estimate variants; Space-Saving is a candidate-retention structure.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Update cost can be constant or logarithmic depending on how the minimum counter is maintained. Memory is proportional to the number of counters, not the number of distinct keys. The cost is approximation: counts have error bounds, candidate sets can contain false positives near the threshold, and flat streams with no clear heavy keys are harder to summarize usefully.',
      ],
    },
    {
      heading: 'Real-world case study',
      paragraphs: [
        'Metwally, Agrawal, and El Abbadi proposed Space-Saving for frequent and top-k elements in data streams. Misra and Gries established the classic frequent-items summary. HeavyKeeper and later variants target top-k elephant flows in network telemetry using different replacement and decay strategies. Hierarchical Heavy Hitters lift the same question from individual keys to prefixes, while Elastic Sketch splits elephant and mice flows for high-speed traffic measurement. These structures sit behind DDoS detection, trend detection, approximate observability dashboards, and telemetry triage.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Approximate candidates are not exact truth. Use heavy-hitter summaries to route attention, trigger investigation, or choose a small set for exact verification. Do not use the raw summary count for billing, deletion, permissions, or legal reporting. Also keep parameters aligned before merging summaries; different table sizes, hash choices, or decay settings can make merged results meaningless.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Space-Saving technical report at https://www.cs.ucsb.edu/sites/default/files/documents/2005-23.pdf, Springer chapter at https://link.springer.com/chapter/10.1007/978-3-540-30570-5_27, Misra-Gries summary notes at https://people.csail.mit.edu/rrw/6.045-2019/encalgs-mg.pdf, and HeavyKeeper paper at https://www.usenix.org/system/files/conference/atc18/atc18-gong.pdf. Study Count-Min Sketch, Count Sketch: Signed Frequency, Conservative Count-Min Sketch, Hierarchical Heavy Hitters: Prefix Sketch, Elastic Sketch Network Telemetry Case Study, HyperLogLog, Reservoir Sampling, and Message Queues next.',
      ],
    },
  ],
};
