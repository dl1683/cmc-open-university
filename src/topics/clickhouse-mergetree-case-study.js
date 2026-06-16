// ClickHouse MergeTree: immutable parts, column files, granules, marks,
// sparse primary indexes, and background merges.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'clickhouse-mergetree-case-study',
  title: 'ClickHouse MergeTree Case Study',
  category: 'Systems',
  summary: 'MergeTree as the analytical storage lesson: inserts create sorted immutable parts, sparse marks skip granules, and background merges reshape data.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['parts and granules', 'sparse primary index'], defaultValue: 'parts and granules' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function mergeTreeGraph(title) {
  return graphState({
    nodes: [
      { id: 'insert', label: 'insert batch', x: 0.8, y: 4.0, note: 'incoming rows' },
      { id: 'sort', label: 'sort by ORDER BY', x: 2.6, y: 4.0, note: 'primary order' },
      { id: 'partA', label: 'part A', x: 4.8, y: 2.4, note: 'immutable files' },
      { id: 'partB', label: 'part B', x: 4.8, y: 5.6, note: 'immutable files' },
      { id: 'marks', label: 'marks/index', x: 7.0, y: 2.4, note: 'granule boundaries' },
      { id: 'cols', label: 'column files', x: 7.0, y: 5.6, note: 'compressed streams' },
      { id: 'merge', label: 'background merge', x: 9.2, y: 4.0, note: 'new larger part' },
    ],
    edges: [
      { id: 'e-insert-sort', from: 'insert', to: 'sort', weight: 'sort' },
      { id: 'e-sort-a', from: 'sort', to: 'partA', weight: 'write part' },
      { id: 'e-sort-b', from: 'sort', to: 'partB', weight: 'later insert' },
      { id: 'e-part-marks', from: 'partA', to: 'marks', weight: 'primary index' },
      { id: 'e-part-cols', from: 'partA', to: 'cols', weight: 'columns' },
      { id: 'e-a-merge', from: 'partA', to: 'merge', weight: 'merge input' },
      { id: 'e-b-merge', from: 'partB', to: 'merge', weight: 'merge input' },
    ],
  }, { title });
}

function* partsAndGranules() {
  yield {
    state: mergeTreeGraph('MergeTree inserts become sorted immutable data parts'),
    highlight: { active: ['insert', 'sort', 'partA', 'e-insert-sort', 'e-sort-a'], compare: ['partB'] },
    explanation: 'A MergeTree table stores data as immutable parts. An inserted block is sorted by ORDER BY, written as a new part with column files, marks, metadata, and checksums.',
  };

  yield {
    state: labelMatrix(
      'Inside a data part',
      [
        { id: 'columns', label: 'column files' },
        { id: 'marks', label: 'marks' },
        { id: 'primary', label: 'primary index' },
        { id: 'metadata', label: 'metadata/checksums' },
      ],
      [
        { id: 'contains', label: 'contains' },
        { id: 'why', label: 'why it matters' },
      ],
      [
        ['compressed column streams', 'read only needed columns'],
        ['offsets into streams', 'jump to granules'],
        ['first key per granule', 'sparse skipping'],
        ['part integrity', 'self-contained part'],
      ],
    ),
    highlight: { found: ['marks:why', 'primary:why'], active: ['columns:contains'] },
    explanation: 'Each part is self-contained. It has the data, metadata, and index structures needed to decide what to read. The engine does not need one central B-tree for every row.',
    invariant: 'MergeTree optimizes scans by sorted immutable parts, not by point-updating rows in place.',
  };

  yield {
    state: mergeTreeGraph('Background merges replace many small parts with larger parts'),
    highlight: { active: ['partA', 'partB', 'merge', 'e-a-merge', 'e-b-merge'], found: ['sort'] },
    explanation: 'Background merges combine sorted parts into larger sorted parts. This improves read efficiency and controls part count, but it consumes CPU, disk IO, and write amplification.',
  };

  yield {
    state: labelMatrix(
      'MergeTree versus neighboring storage designs',
      [
        { id: 'lsm', label: 'LSM Tree' },
        { id: 'parquet', label: 'Parquet' },
        { id: 'sqlite', label: 'SQLite B-tree' },
        { id: 'merge', label: 'MergeTree' },
      ],
      [
        { id: 'shared', label: 'shared idea' },
        { id: 'difference', label: 'difference' },
      ],
      [
        ['immutable sorted runs', 'ClickHouse is columnar analytical'],
        ['column chunks', 'MergeTree manages active table parts'],
        ['page B-trees', 'SQLite updates local pages'],
        ['sorted parts + marks', 'query skipping over granules'],
      ],
    ),
    highlight: { active: ['merge:shared', 'lsm:shared'], compare: ['sqlite:difference'] },
    explanation: 'MergeTree combines ideas from LSM-style immutable parts and columnar analytics, but its sparse index and granule model are tailored for large analytical scans.',
  };
}

function* sparsePrimaryIndex() {
  yield {
    state: labelMatrix(
      'Sparse primary index over granules',
      [
        { id: 'g0', label: 'granule 0' },
        { id: 'g1', label: 'granule 1' },
        { id: 'g2', label: 'granule 2' },
        { id: 'query', label: 'WHERE user_id=42' },
      ],
      [
        { id: 'firstKey', label: 'first ORDER BY key' },
        { id: 'decision', label: 'read?' },
      ],
      [
        ['user 1, time 00:00', 'skip'],
        ['user 42, time 10:00', 'read maybe'],
        ['user 99, time 00:00', 'skip'],
        ['binary search marks', 'touch g1'],
      ],
    ),
    highlight: { found: ['g1:decision', 'query:decision'], removed: ['g0:decision', 'g2:decision'] },
    explanation: 'The primary index is sparse: it stores keys for granule boundaries, not every row. It narrows the scan to granules that may match, then column scans verify rows inside them.',
  };

  yield {
    state: mergeTreeGraph('Marks point into every column stream'),
    highlight: { active: ['marks', 'cols', 'e-part-marks', 'e-part-cols'], compare: ['partA'] },
    explanation: 'Marks let ClickHouse jump to matching granules inside compressed column streams. This is why the same granule boundary is stored for columns even if the query reads only a few columns.',
  };

  yield {
    state: labelMatrix(
      'ORDER BY key design',
      [
        { id: 'good', label: 'tenant_id, date' },
        { id: 'ok', label: 'date, event_type' },
        { id: 'bad', label: 'uuid only' },
        { id: 'wide', label: 'too many columns' },
      ],
      [
        { id: 'effect', label: 'effect' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['common filters cluster', 'good skipping'],
        ['time range scans work', 'tenant queries scatter'],
        ['random order', 'little skipping'],
        ['large keys', 'index memory grows'],
      ],
    ),
    highlight: { active: ['good:effect'], compare: ['bad:risk', 'wide:risk'] },
    explanation: 'MergeTree performance is designed into ORDER BY. The sparse primary index helps only when query predicates align with sorted order and granule boundaries.',
  };

  yield {
    state: labelMatrix(
      'Operational case study',
      [
        { id: 'ingest', label: 'event ingest' },
        { id: 'query', label: 'dashboard query' },
        { id: 'merge', label: 'merge backlog' },
        { id: 'ttl', label: 'TTL/retention' },
      ],
      [
        { id: 'mechanism', label: 'mechanism' },
        { id: 'failureMode', label: 'failure mode' },
      ],
      [
        ['small inserts create parts', 'too many parts'],
        ['marks skip granules', 'bad ORDER BY scans too much'],
        ['background compaction', 'IO pressure'],
        ['drop old parts', 'retention mistakes'],
      ],
    ),
    highlight: { found: ['query:mechanism', 'merge:mechanism'], compare: ['ingest:failureMode'] },
    explanation: 'The production story is a feedback loop: batching, ordering, part count, merge capacity, and query predicates all determine whether ClickHouse stays fast.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'parts and granules') yield* partsAndGranules();
  else if (view === 'sparse primary index') yield* sparsePrimaryIndex();
  else throw new InputError('Pick a ClickHouse MergeTree view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'ClickHouse MergeTree is the core storage-engine family behind many ClickHouse tables. It stores data in immutable sorted parts, splits those parts into granules, keeps sparse primary indexes and marks, and relies on background merges to combine parts over time.',
        'The case-study lesson is analytical storage design. Instead of updating B-tree pages row by row, MergeTree writes sorted columnar parts and reads only the granules and columns that might answer the query.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'An insert batch is sorted by the table ORDER BY expression and written as a new data part. A part contains compressed column files, marks, primary-index entries, metadata, and checksums. The primary index stores key values for granule boundaries, not every row, so it stays compact.',
        'A query uses predicates on ORDER BY columns to binary-search sparse index entries and identify candidate granules. Marks point into column files so only needed ranges and columns are read. Background merges later combine parts into larger sorted parts.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'MergeTree performance depends on ORDER BY design, insert batching, part count, merge bandwidth, compression, granule size, partitioning, and query predicates. Bad ordering can force broad scans. Too many tiny inserts create too many parts. Merges improve reads but consume IO and CPU.',
        'The sparse index is intentionally not a unique row locator. It prunes ranges; it does not point to individual rows like a traditional B-tree index. This is why MergeTree excels at analytical scans and aggregations rather than high-concurrency point updates.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'MergeTree tables are used for observability events, clickstream analytics, product metrics, security logs, time-series-like facts, ad analytics, and operational dashboards. They fit append-heavy analytical workloads where queries filter and aggregate over ordered dimensions.',
        'A complete case study is an events table ordered by tenant_id and event_time. Each insert creates sorted parts. A dashboard for one tenant over one day uses the sparse index to find relevant granules, reads only needed columns, and aggregates them. Background merges keep the part count under control.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'ClickHouse primary keys are not the same as OLTP primary keys. They define sort order and sparse skipping, not uniqueness by default. Another trap is inserting tiny batches continuously; too many parts can overwhelm merges and hurt queries. Schema and ORDER BY choices are performance features.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Official sources: MergeTree docs at https://clickhouse.com/docs/engines/table-engines/mergetree-family/mergetree, primary indexes at https://clickhouse.com/docs/primary-indexes, sparse primary index guide at https://clickhouse.com/docs/guides/best-practices/sparse-primary-indexes, and table parts at https://clickhouse.com/docs/parts. Study LSM Tree, Parquet Columnar Format Case Study, Database Indexing, t-digest, and Prometheus TSDB Case Study next.',
      ],
    },
  ],
};
