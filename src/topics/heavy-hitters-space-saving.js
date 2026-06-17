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
      heading: 'Why this exists',
      paragraphs: [
        'Operators often need the keys that dominate a stream, not just an estimate for a key they already know. The stream may contain IP flows, queries, product ids, log messages, or model features. Tracking every distinct key exactly can be too expensive, so heavy-hitter summaries keep a small table of likely frequent keys.',
        'The question is different from ordinary counting. A database can count one product if you name the product. A stream operator may not know which product, endpoint, customer, or error code deserves attention yet. It needs discovery under memory pressure. Heavy-hitter algorithms answer that discovery question: which identities are large enough that the system should spend scarce exact memory or human attention on them?',
        'This matters most when the stream is too fast or too distributed for a full histogram. A router cannot keep an exact counter for every source-destination pair forever. An observability pipeline cannot promote every log line to a top-level dashboard. A feature monitor cannot store every token or category in a model input. The summary is a triage layer that keeps likely elephants visible while letting one-off mice pass through.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first attempt is an exact frequency map and a top-k heap. It is correct but grows with distinct keys. A Count-Min Sketch bounds memory, but it answers "what is the estimate for this key?" It does not discover all key identities by itself.',
        'The exact map also has an operational problem: it treats every new key as equally deserving. In a hostile or simply high-cardinality stream, rare keys can force the table to grow without bound. Sampling helps estimate aggregate behavior, but it can miss bursty keys and gives weaker identity guarantees. A pure sketch compresses counts, but the key names have to come from somewhere. Space-Saving exists in the middle: it spends memory on identities, but only on the identities currently strong enough to compete for a slot.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The structure must spend memory on identities, but only for candidates worth remembering. Rare keys should not permanently occupy slots. True heavy keys must survive the churn long enough to become visible.',
        'The hard case is not a stream with one obvious giant. The hard case is a stream with bursts, churn, and many almost-heavy keys. A new key might be the start of a real incident, or it might be a single request from a long tail. The summary has to make that decision online, before seeing the future, while keeping enough error information to avoid pretending its approximate counts are exact.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Space-Saving keeps candidate identities and counters. If a key is present, increment it. If there is free space, add it. If the table is full, replace the current minimum counter with the new key and remember the inherited error. Rare keys fight over the minimum slot; real elephants keep returning.',
        'The inherited error is the part that makes the replacement rule honest. When a new key takes over a slot with count 7, the algorithm cannot know whether the new key has appeared once or several times before while it was not tracked. It stores the new counter as 8 and records error up to 7. The reported count is an upper estimate; the true count is at least count minus error. That interval is what lets downstream systems rank candidates without turning approximation into false certainty.',
      ],
    },
    {
      heading: 'Reading the visualization',
      paragraphs: [
        'In the Space-Saving view, watch the minimum slot. That slot is the structure saying, "this is the weakest candidate I am currently willing to remember." A new unknown key can replace it, but the inherited error records how much of the new count may belong to older occupants.',
        'In the sketch-comparison view, separate two questions that are often confused. Count-Min estimates a named key. Space-Saving keeps candidate key identities. HyperLogLog estimates distinct count. These are different summaries for different questions.',
        'The useful reading habit is to separate table membership from truth. A key in the table is a candidate, not a certificate. A key outside the table is not necessarily absent; it is only not strong enough to be retained under the current memory budget. The summary is designed to make the strongest candidates hard to lose, not to preserve a complete stream history.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each update touches the candidate table. The minimum counter represents the cheapest slot to evict. When a new key replaces it, the algorithm records that the new count may include error inherited from the evicted counter. Misra-Gries uses a related counter-decrement idea for threshold guarantees; Space-Saving is tuned toward top-k reporting.',
        'A practical implementation also needs a way to find the minimum quickly. Small tables can scan. Larger summaries use buckets, heaps, or linked groups by count. That engineering detail matters because heavy-hitter summaries are usually on the hot ingest path.',
        'The table is usually backed by two indexes: a hash map from key to slot for fast increments, and a minimum-tracking structure for eviction. The hash map answers "is this key already tracked?" The minimum structure answers "which tracked key is weakest right now?" A tiny summary can scan the slots because the constant is small. A large per-service or per-tenant summary usually needs a heap, bucketed counters, or a linked list of count groups to keep update latency predictable.',
        'Merging summaries is more delicate than updating one stream. If two shards keep Space-Saving tables with the same capacity, combining their candidates is not as simple as concatenating the rows and sorting. The missing mass in each shard matters. Production systems either merge through a known algorithm with compatible parameters, feed shard outputs into a second-level summary with clear error accounting, or run exact verification over the small candidate union when accuracy matters.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'A key above the heavy threshold appears too often to be lost forever among rare keys. Even if it is evicted early, repeated arrivals bring it back and raise its counter. Error bookkeeping tells how much of a reported count could have been inherited from earlier occupants.',
        'The useful mental model is churn versus persistence. Rare keys churn through the minimum. A true heavy key persists because it receives enough events to keep its counter above the replacement frontier.',
        'The guarantee depends on capacity. With k counters, the algorithm is strongest for keys whose frequency is large compared with total stream mass divided by k. If a key is far above that frontier, it will keep returning and eventually stay. If many keys cluster right around the frontier, the summary may report several plausible candidates with overlapping error intervals. That is not a bug; it is the information-theoretic limit showing through the interface.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Memory is proportional to retained counters, not distinct keys. Update cost is constant or logarithmic depending on how the minimum is maintained. The cost is approximation: candidates near the threshold can be false positives, and a flat stream with no clear elephants is hard to summarize usefully.',
        'The main sizing knob is the number of counters. More counters lower the replacement frontier, preserve more near-heavy candidates, and narrow the practical error range, but they also increase memory and cache pressure. Very small tables are useful for teaching and coarse incident signals. Customer-facing analytics, billing-adjacent dashboards, and security investigations usually need either larger summaries or an exact follow-up pass over candidate keys.',
        'Latency behavior matters because the update path often sits inside ingestion. A structure with excellent asymptotic bounds can still be a bad choice if it allocates memory, locks shared state, or performs heap repairs on every packet at line rate. Many real systems shard the summary by worker, keep per-core tables, and merge periodically rather than forcing every event through one contended counter table.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'It fits dashboards and alerts that ask "what changed?" or "who is dominating?" Space-Saving and related summaries appear behind DDoS detection, trend detection, observability triage, top-k search terms, and feature monitoring. Hierarchical Heavy Hitters lift the answer to prefixes; Elastic Sketch splits elephant and mice flows.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Approximate candidates are not exact truth. Use them to route attention or choose a small exact-verification set. Do not use raw summary counts for billing, deletion, permissions, or legal reporting. Keep merge parameters aligned; different table sizes or decay rules can make combined results meaningless.',
        'It also fails when the stream is intentionally flat. If every key has nearly the same frequency, no small table can confidently name dominant keys because there are no real dominant keys. In that case uncertainty is the correct result.',
        'A third failure mode is unversioned identity logic. If one service hashes raw URLs, another normalizes query strings, and a third lowercases paths, their heavy-hitter summaries are not measuring the same key space. The algorithm can be correct and the metric still be wrong. The key definition, normalization rules, time window, decay policy, and counter capacity need to travel with the summary.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the table has three slots: login=42, search=18, bot=7. A new key api arrives. Because the table is full, Space-Saving replaces bot, the current minimum, and stores api with count 8 and error at most 7. The count says api has appeared enough to deserve attention now; the error says the first 7 units could be inherited noise.',
        'If api keeps arriving, it survives and its counter rises. If it was a one-off, another new key will eventually evict it from the minimum frontier. The table is therefore a competition among candidates, not a full histogram.',
        'Now imagine login jumps from 42 to 400 during a release. Space-Saving will not need to rediscover it on every event because login is already present and increments in place. That is why the algorithm is useful for alerts: persistent heavy keys quickly separate from churn. The dashboard should still show the count as approximate unless it performs an exact readback for the candidate.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Start by writing down the question. If the product asks for top URLs per minute, use a time-windowed summary and normalize URLs before hashing. If the product asks for top customers by spend, do not use an approximate stream table as the accounting source; use it to propose candidates and verify them against the ledger. Heavy-hitter summaries are good at narrowing attention, not at replacing records of truth.',
        'Choose the table size from the smallest frequency you need to notice. A table of 100 counters cannot reliably distinguish hundreds of keys that all sit near one percent of the stream. If you need tenant-level fairness, keep separate summaries per tenant or budget counters by tenant, otherwise one large tenant can consume all slots and hide smaller but important spikes elsewhere.',
        'Emit error bounds or at least expose enough metadata for downstream code to understand uncertainty. The inherited error field, total events processed, window start and end, key normalization version, and algorithm parameters should be part of the serialized summary. Without that metadata, old summaries become hard to compare, merge, or debug.',
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
