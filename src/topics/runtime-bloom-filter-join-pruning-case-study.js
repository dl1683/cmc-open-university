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
      heading: 'What it is',
      paragraphs: [
        'A runtime join filter is a compact predicate learned from one side of a join while the query is executing, then pushed into a large scan on the other side. Bloom filters are a common representation because they can reject definite non-members with compact memory and no false negatives.',
        'Trino documents dynamic filtering as collecting build-side join values and pushing them to table scans to skip data at runtime: https://trino.io/docs/current/admin/dynamic-filtering.html. Spark SQL adaptive query execution documents runtime statistics and adaptive query behavior at https://spark.apache.org/docs/latest/sql-performance-tuning.html#adaptive-query-execution. Bloom Filter covers the underlying probabilistic set structure.',
      ],
    },
    {
      heading: 'Core data structure',
      paragraphs: [
        'The filter contains a bitset, hash functions, build-side key domain, null policy, size limits, readiness state, and distribution state. The scan side applies it before sending surviving rows to the exact join. If a key tests negative, the row is safe to skip. If it tests maybe, the join still verifies exact equality.',
        'Runtime filters compose with late materialization. A scan can first test cheap join keys, carry surviving row ids forward, and fetch payload columns only after the dynamic filter and other predicates have narrowed the candidate set.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A retail warehouse query filters product_dim to a small category and joins it with a multi-billion-row sales_fact table. The build side produces product_ids for that category. The engine builds a Bloom filter, pushes it to every fact scan split, and skips fact rows whose product_id is definitely not in the filtered dimension set.',
        'The join result is still computed by the hash join. The Bloom filter only reduces read and probe work. That distinction is important: approximate prefilters preserve correctness only because exact join semantics still run after them.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Runtime filters are workload-sensitive. If the build side is too large, the filter arrives too late, or the false-positive rate is high, the filter can add overhead. Engines need thresholds for collection time, filter size, domain cardinality, and scan pushdown support.',
        'A runtime filter also cannot violate outer join semantics, null semantics, or partitioning constraints. The planner must know where the filter is safe to apply.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Bloom Filter, SQL Join Algorithms Primer, Selection Vector Filter Pipeline, Late Materialization Columnar Scan, DuckDB Vectorized Execution Case Study, Spark Adaptive Query Execution Case Study, Block Range Index & Zone Maps, and Parquet Page Index & Column Offset next.',
      ],
    },
  ],
};
