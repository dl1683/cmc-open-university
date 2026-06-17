// Runtime Bloom filters for join pruning: build-side key summaries, dynamic
// filter distribution, fact-side scan pruning, and false-positive economics.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'runtime-bloom-filter-join-pruning-case-study',
  title: 'Runtime Bloom Filter Join Pruning',
  category: 'Systems',
  summary: 'How query engines build a compact filter from join keys at runtime and push it into large scans to avoid reading rows that cannot join.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['dynamic filter', 'false positives'], defaultValue: 'dynamic filter' },
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

function filterGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'dim', label: 'dim', x: 0.7, y: 2.5, note: notes.dim ?? 'build' },
      { id: 'keys', label: 'keys', x: 2.0, y: 2.5, note: notes.keys ?? 'join ids' },
      { id: 'bloom', label: 'bloom', x: 3.5, y: 2.5, note: notes.bloom ?? 'bits' },
      { id: 'dist', label: 'dist', x: 5.0, y: 2.5, note: notes.dist ?? 'broadcast' },
      { id: 'fact', label: 'fact', x: 0.7, y: 5.7, note: notes.fact ?? 'large scan' },
      { id: 'scan', label: 'scan', x: 3.5, y: 5.7, note: notes.scan ?? 'probe' },
      { id: 'join', label: 'join', x: 6.6, y: 4.1, note: notes.join ?? 'hash join' },
      { id: 'out', label: 'out', x: 8.4, y: 4.1, note: notes.out ?? 'matches' },
      { id: 'stats', label: 'stats', x: 9.2, y: 2.5, note: notes.stats ?? 'saved IO' },
    ],
    edges: [
      { id: 'e-dim-keys', from: 'dim', to: 'keys' },
      { id: 'e-keys-bloom', from: 'keys', to: 'bloom' },
      { id: 'e-bloom-dist', from: 'bloom', to: 'dist' },
      { id: 'e-fact-scan', from: 'fact', to: 'scan' },
      { id: 'e-dist-scan', from: 'dist', to: 'scan' },
      { id: 'e-scan-join', from: 'scan', to: 'join' },
      { id: 'e-dim-join', from: 'dim', to: 'join' },
      { id: 'e-join-out', from: 'join', to: 'out' },
      { id: 'e-scan-stats', from: 'scan', to: 'stats' },
    ],
  }, { title });
}

function* dynamicFilter() {
  yield {
    state: filterGraph('A small build side produces a runtime key summary'),
    highlight: { active: ['dim', 'keys', 'bloom', 'e-dim-keys', 'e-keys-bloom'], compare: ['fact'] },
    explanation: 'In a selective hash join, the build side may contain only a small set of join keys after filters. A runtime Bloom filter summarizes those keys while the query is running.',
    invariant: 'A runtime filter is learned from this query execution, not only from table metadata.',
  };

  yield {
    state: filterGraph('The filter is pushed toward the large fact scan', { dist: 'push', scan: 'test ids' }),
    highlight: { active: ['bloom', 'dist', 'scan', 'e-bloom-dist', 'e-dist-scan'], found: ['keys'], compare: ['join'] },
    explanation: 'The engine distributes the filter to scan operators. A fact row whose join key is definitely not in the build-side key set can be skipped before the expensive join probe.',
  };

  yield {
    state: labelMatrix(
      'Fact scan with runtime filter',
      [
        { id: 'f0', label: 'f0' },
        { id: 'f1', label: 'f1' },
        { id: 'f2', label: 'f2' },
        { id: 'f3', label: 'f3' },
      ],
      [
        { id: 'key', label: 'key' },
        { id: 'test', label: 'test' },
        { id: 'move', label: 'move' },
      ],
      [
        ['42', 'maybe', 'join'],
        ['71', 'no', 'skip'],
        ['42', 'maybe', 'join'],
        ['99', 'no', 'skip'],
      ],
    ),
    highlight: { active: ['f0:move', 'f2:move'], removed: ['f1:move', 'f3:move'] },
    explanation: 'Bloom filters have no false negatives. If the test says no, the row cannot join. If the test says maybe, the row still goes to the real join where exact equality is checked.',
  };

  yield {
    state: filterGraph('Rows that survive the filter still pass through the real join', { scan: 'maybe rows', join: 'exact', stats: 'pruned' }),
    highlight: { found: ['scan', 'join', 'out', 'stats', 'e-scan-join', 'e-join-out', 'e-scan-stats'], active: ['bloom'] },
    explanation: 'The runtime filter is a prefilter, not the join result. It reduces scan and probe work, then the hash join enforces exact join semantics.',
  };
}

function* falsePositives() {
  yield {
    state: labelMatrix(
      'Bloom filter outcomes',
      [
        { id: 'hit', label: 'real hit' },
        { id: 'miss', label: 'real miss' },
        { id: 'fp', label: 'false pos' },
        { id: 'fn', label: 'false neg' },
      ],
      [
        { id: 'test', label: 'test' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['maybe', 'join'],
        ['no', 'skip'],
        ['maybe', 'extra'],
        ['none', 'bad'],
      ],
    ),
    highlight: { active: ['miss:effect', 'hit:effect'], compare: ['fp:effect'], removed: ['fn:effect'] },
    explanation: 'Bloom filters can produce false positives, which waste some work, but they must not produce false negatives. A false negative would drop a row that should join, breaking correctness.',
    invariant: 'Runtime filters may be approximate only in the safe direction.',
  };

  yield {
    state: labelMatrix(
      'Filter timing',
      [
        { id: 'early', label: 'early' },
        { id: 'late', label: 'late' },
        { id: 'small', label: 'small' },
        { id: 'huge', label: 'huge' },
      ],
      [
        { id: 'win', label: 'win' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['skip IO', 'wait'],
        ['fast', 'miss IO'],
        ['cheap', 'weak'],
        ['precise', 'ship'],
      ],
    ),
    highlight: { active: ['early:win', 'small:win'], compare: ['late:risk', 'huge:risk'] },
    explanation: 'A runtime filter has a timing tradeoff. Waiting for a precise filter can delay scans. Sending an early small filter can start pruning sooner but may pass more false positives.',
  };

  yield {
    state: filterGraph('A saturated filter stops being useful', { bloom: 'full bits', scan: 'many maybe', stats: 'low save' }),
    highlight: { active: ['bloom', 'scan', 'stats', 'e-dist-scan', 'e-scan-stats'], compare: ['out'] },
    explanation: 'If the build side is huge or the filter bitset is too small, too many bits are set. Then almost every fact key returns maybe and the filter adds overhead without much pruning.',
  };

  yield {
    state: labelMatrix(
      'Complete star join case',
      [
        { id: 'dim', label: 'dim' },
        { id: 'filter', label: 'filter' },
        { id: 'fact', label: 'fact' },
        { id: 'join', label: 'join' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['small', 'build'],
        ['bloom', 'push'],
        ['big', 'prune'],
        ['exact', 'verify'],
      ],
    ),
    highlight: { found: ['filter:lesson', 'fact:lesson', 'join:lesson'], compare: ['dim:state'] },
    explanation: 'A complete case is a star-schema query: filter a small date or product dimension, build a runtime filter from surviving dimension keys, push it into the huge fact scan, and then run the exact join on remaining rows.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'dynamic filter') yield* dynamicFilter();
  else if (view === 'false positives') yield* falsePositives();
  else throw new InputError('Pick a runtime-filter view.');
}

export const article = {
  sections: [
    {
      heading: 'Why This Exists',
      paragraphs: [
        'Runtime Bloom filters exist because a query can discover a powerful pruning predicate only after execution begins. A dimension table may look large in the catalog, but after this query applies its filters, only a small set of join keys may remain.',
        'The probe side is often the expensive side. In a star-schema query, the fact table may contain billions of rows, wide columns, and many splits distributed across workers. If most fact rows cannot join, reading and probing them is wasted work.',
        'The runtime filter turns the build side into a compact membership test and ships that test toward the probe-side scan. Rows that are definitely absent from the build-side key set can be skipped before they reach the exact join.',
      ],
    },
    {
      heading: 'The Obvious Approach',
      paragraphs: [
        'The obvious approach is to run the normal hash join. Build a hash table from the smaller side, scan the larger side, probe each row, and let exact equality decide whether a match exists. This is correct and easy to reason about.',
        'A second obvious approach is to rely on static metadata: table statistics, partitions, min-max ranges, zone maps, or file-level indexes. Those can prune data before execution and should be used when they are available.',
        'The gap is query-specific information. Static metadata may know a column range, but it usually does not know the exact surviving join keys after this execution filters the build side. The hash join knows those keys, but by the time the probe reaches the hash table, the scan may already have paid most of the cost.',
      ],
    },
    {
      heading: 'The Wall',
      paragraphs: [
        'The wall is scale and timing. If the fact scan reads a billion rows while only a few thousand keys can join, rejecting rows at the hash table is late. The engine may already have read storage blocks, decoded columns, materialized vectors, and shuffled rows across the network.',
        'The wall is also safety. A pruning filter must never drop a row that should join. An approximate structure is attractive only if its approximation points in the safe direction: extra rows may pass through, but real matches must not be discarded.',
        'A large exact set of build keys can be too heavy to broadcast to every scan. A compact approximate set solves the distribution problem, but it introduces false positives. The engine has to decide when that tradeoff is worth it.',
      ],
    },
    {
      heading: 'The Core Insight',
      paragraphs: [
        'The core insight is safe approximate pruning. A Bloom filter can answer two useful questions: definitely not present, or maybe present. It never says no for a key that was inserted, assuming the implementation and hashing are correct.',
        'That no-false-negative property is enough for a join prefilter. If a fact row tests no, it cannot match the build-side key set and can be skipped. If it tests maybe, the row still goes to the exact hash join, where normal equality semantics decide the result.',
        'The filter is runtime state, not a permanent table index. It is built from the keys that survive this query execution, then pushed to the scan operators while the query is still running.',
      ],
    },
    {
      heading: 'Animation Walkthrough',
      paragraphs: [
        'The dynamic-filter view starts with the dimension side. After local predicates run, the surviving join keys are inserted into a Bloom filter. The filter is then distributed to fact-side scan operators.',
        'At the fact scan, each row can test its join key before doing more expensive work. A key such as 71 that returns no can be skipped. A key such as 42 that returns maybe must continue to the exact join.',
        'The false-positive view separates correctness from savings. False positives are allowed because they only send extra rows to the exact join. False negatives are not allowed because they would remove true join results.',
      ],
    },
    {
      heading: 'How It Works',
      paragraphs: [
        'The query planner chooses a join shape, usually with the smaller or more selective side as the build side. As build-side tasks produce join keys, the engine collects those keys into a runtime filter. Some engines collect exact distinct values up to a threshold, some use Bloom filters, and some fall back to min-max ranges when distinct sets become too large.',
        'The coordinator or exchange path distributes the filter to workers that own probe-side splits. The scan can then test the join key early. In a columnar engine, this may happen before reading wide payload columns or before passing a vector to later operators.',
        'Rows that pass the filter are not accepted as matches. They are only candidates. The exact join still probes the real hash table, applies equality checks, handles null semantics, and enforces the query plan.',
        'Trino documents dynamic filters pushed into table scans and connector readers, including ORC and Parquet pruning paths. Spark SQL documents adaptive execution as using runtime statistics to re-optimize query execution. The shared idea is that execution can learn facts the static plan did not know.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'Correctness comes from preserving all possible matches. The build side inserts every key that could join. A Bloom filter may set overlapping bits, which creates false positives, but a key that was inserted will still find all of its bits set.',
        'Therefore a negative result is a proof of absence from the inserted key set. Skipping that probe row cannot remove a valid inner-join result. A maybe result is not proof of presence, so the exact join must remain the authority.',
        'This is also why placement depends on join semantics. Inner joins and some semi-join shapes can safely prune probe rows that cannot match. Outer joins, null-aware semantics, and expression rewrites need planner care because dropping a nonmatch can change the required output.',
        'The runtime part works because it applies after build-side predicates. A product dimension with millions of product_ids may shrink to a few thousand battery products for this query. The runtime filter exports that narrower set to the scan.',
      ],
    },
    {
      heading: 'Worked Example',
      paragraphs: [
        'A retail query filters product_dim to category equals batteries and joins the result to a multi-billion-row sales_fact table. The build side is the filtered product_dim relation. It emits surviving product_ids into a runtime Bloom filter.',
        'Every sales_fact split receives the filter. If a split can test product_id before reading wide measure columns, it may skip row groups, vectors, or rows early. Product_id 71 returns no and is removed. Product_id 42 returns maybe and continues.',
        'The final hash join still checks product_id exactly. Some rows that returned maybe may fail because of false positives or because other join predicates do not match. The result is correct because the filter reduced candidates, not semantics.',
      ],
    },
    {
      heading: 'Cost and Behavior',
      paragraphs: [
        'The costs are construction, memory, distribution, waiting time, scan-side checks, and false positives. A tiny filter is cheap to ship but may saturate quickly. A large filter is more selective but costs more memory and network traffic.',
        'Timing matters. If the engine waits too long for a perfect filter, probe scans may sit idle. If it sends an early partial filter, scans can start pruning sooner but may pass more rows. Distributed engines need thresholds for collection time and filter size.',
        'When the build side grows, Bloom filter quality can collapse. Too many inserted keys set too many bits, and almost every probe key returns maybe. At that point the filter adds CPU overhead while saving little I/O.',
        'Connector support determines the ceiling. A filter that reaches an ORC or Parquet reader before row-group scanning can avoid real I/O. A filter applied after rows are already materialized saves only downstream join work.',
      ],
    },
    {
      heading: 'Implementation Guidance',
      paragraphs: [
        'Gate runtime filters behind selectivity estimates and size thresholds. The engine should stop collecting or switch representation when the build side is too large for the filter to be useful.',
        'Track filter effectiveness as runtime telemetry: number of filters built, bytes shipped, splits delayed, rows tested, rows rejected, false-positive estimate, and scan bytes saved. Without these numbers, teams will not know whether dynamic filtering is helping or only adding overhead.',
        'Apply filters only where the planner can prove they are legal. Nulls, outer joins, non-deterministic expressions, type coercions, and composite keys can all change the safety question. If the exact join sees one expression but the scan tests another, the filter is no longer a harmless prefilter.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Runtime Bloom filters win in star-schema joins, selective dimension filters, distributed fact scans, partitioned warehouses, and late-materialized columnar plans. The access pattern is clear: one side cheaply discovers a small key set, and the other side is expensive to scan.',
        'They are strongest when the build side is small, the fact side is huge, the filter arrives early, and the storage connector can use it before decoding most data.',
        'They also pair well with existing pruning. Static partition pruning can remove whole date ranges. Zone maps can remove row groups by min-max statistics. Runtime filters then remove keys that only the current join could reveal.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'They fail when the build side is huge, the filter arrives after the scan has already done the work, the false-positive rate is high, or scan pushdown is unavailable.',
        'They fail when the planner applies them to an unsafe join shape. Outer joins may need to preserve nonmatching probe rows. Null-aware joins may have special rules. Composite-key joins require the same key construction on both sides.',
        'They also fail operationally when they create pipeline stalls. A distributed query can lose more time waiting for a filter than it saves through pruning, especially when the probe side is not as large as expected.',
      ],
    },
    {
      heading: 'Complete Case Study',
      paragraphs: [
        'In a warehouse dashboard, analysts ask for holiday sales of a narrow product family. The date and product dimensions are filtered first. The engine chooses those filtered dimensions as build inputs and collects their surviving keys.',
        'The sales_fact scan receives runtime filters for date_key and product_id. Some partitions are removed statically. Some row groups are removed by storage metadata. Remaining vectors test join keys against runtime filters before wide columns are decoded.',
        'The exact join still computes the final result. The dashboard sees the same rows it would have seen without runtime filtering, but the query may read far less data and probe far fewer fact rows.',
      ],
    },
    {
      heading: 'Sources and Study Next',
      paragraphs: [
        'Primary sources: Trino dynamic filtering documentation at https://trino.io/docs/current/admin/dynamic-filtering.html and Spark SQL performance tuning documentation for adaptive query execution at https://spark.apache.org/docs/latest/sql-performance-tuning.html#adaptive-query-execution.',
        'Study Bloom Filter for the approximate membership structure, SQL Join Algorithms Primer for build and probe roles, Selection Vector Filter Pipeline for vectorized filtering, Late Materialization Columnar Scan for scan economics, Block Range Index and Zone Maps for static pruning, and Parquet Page Index and Column Offset for storage-level skipping.',
      ],
    },
  ],
};
