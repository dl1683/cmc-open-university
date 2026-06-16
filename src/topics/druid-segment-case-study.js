// Apache Druid segments case study: time-partitioned immutable columnar
// segments with indexes, rollup, and compaction.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'druid-segment-case-study',
  title: 'Apache Druid Segment Case Study',
  category: 'Systems',
  summary: 'Druid segments as analytics data structures: time partitions, columnar files, bitmap indexes, rollup, and compaction.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['segment layout', 'query pruning'], defaultValue: 'segment layout' },
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

function druidGraph(title) {
  return graphState({
    nodes: [
      { id: 'ingest', label: 'ingestion', x: 0.8, y: 4.0, note: 'events' },
      { id: 'rollup', label: 'rollup', x: 2.6, y: 2.5, note: 'aggregate rows' },
      { id: 'segment', label: 'segment file', x: 4.6, y: 4.0, note: 'time interval' },
      { id: 'time', label: '__time column', x: 6.7, y: 1.7, note: 'primary partition' },
      { id: 'cols', label: 'columns', x: 6.7, y: 3.6, note: 'compressed arrays' },
      { id: 'bitmap', label: 'bitmap indexes', x: 6.7, y: 5.5, note: 'filters' },
      { id: 'deep', label: 'deep storage', x: 8.8, y: 4.0, note: 'published segment' },
    ],
    edges: [
      { id: 'e-ingest-rollup', from: 'ingest', to: 'rollup', weight: 'group' },
      { id: 'e-rollup-segment', from: 'rollup', to: 'segment', weight: 'persist' },
      { id: 'e-segment-time', from: 'segment', to: 'time', weight: 'time' },
      { id: 'e-segment-cols', from: 'segment', to: 'cols', weight: 'columnar' },
      { id: 'e-segment-bitmap', from: 'segment', to: 'bitmap', weight: 'indexes' },
      { id: 'e-segment-deep', from: 'segment', to: 'deep', weight: 'publish' },
    ],
  }, { title });
}

function* segmentLayout() {
  yield {
    state: druidGraph('Druid stores analytics data in time-partitioned segments'),
    highlight: { active: ['ingest', 'rollup', 'segment', 'e-ingest-rollup', 'e-rollup-segment'], compare: ['deep'] },
    explanation: 'A Druid datasource is split into segment files, usually by time interval. Segments are immutable-ish analytics units: they can be published, loaded, replicated, and compacted.',
    invariant: 'Time is the first pruning dimension in Druid segment layout.',
  };

  yield {
    state: labelMatrix(
      'Inside a segment',
      [
        { id: 'time', label: '__time' },
        { id: 'dims', label: 'dimensions' },
        { id: 'metrics', label: 'metrics' },
        { id: 'indexes', label: 'indexes' },
      ],
      [{ id: 'storage', label: 'storage' }, { id: 'purpose' }],
      [
        ['compressed column', 'time filter and ordering'],
        ['dictionary encoded columns', 'group/filter fields'],
        ['numeric columns', 'aggregation'],
        ['bitmap indexes', 'fast filters'],
      ],
    ),
    highlight: { active: ['dims:storage', 'indexes:storage'], found: ['metrics:purpose'] },
    explanation: 'The segment is a collection of columnar data structures. Dimensions can be dictionary encoded and indexed; metrics are read for aggregation.',
  };

  yield {
    state: druidGraph('Published segments move to deep storage and historicals'),
    highlight: { active: ['segment', 'deep', 'e-segment-deep'], found: ['time', 'cols', 'bitmap'] },
    explanation: 'After ingestion, segments are published and loaded by query-serving nodes. The segment boundary becomes the unit of distribution, replication, caching, and retention.',
  };

  yield {
    state: labelMatrix(
      'Compaction cleans up segment shape',
      [
        { id: 'many', label: 'many small segments' },
        { id: 'compact', label: 'compaction' },
        { id: 'few', label: 'fewer larger segments' },
        { id: 'rollup', label: 'better rollup' },
      ],
      [{ id: 'problem', label: 'problem' }, { id: 'benefit' }],
      [
        ['too many files/tasks', 'query overhead'],
        ['rewrite interval', 'controlled batch work'],
        ['better scan shape', 'less metadata overhead'],
        ['combine duplicate rows', 'less data scanned'],
      ],
    ),
    highlight: { active: ['compact:benefit', 'few:benefit'], compare: ['many:problem'] },
    explanation: 'Compaction is not just housekeeping. It changes the physical data structures that queries will scan, filter, and aggregate later.',
  };
}

function* queryPruning() {
  yield {
    state: labelMatrix(
      'Query: last hour, country=US',
      [
        { id: 'interval', label: 'time interval' },
        { id: 'segment', label: 'segment pruning' },
        { id: 'bitmap', label: 'bitmap filter' },
        { id: 'aggregate', label: 'aggregate metrics' },
      ],
      [{ id: 'step', label: 'step' }, { id: 'data_reduced' }],
      [
        ['match time range', 'skip older segments'],
        ['load candidate segments', 'few files'],
        ['country bitmap', 'skip non-US rows'],
        ['scan metric column', 'sum only survivors'],
      ],
    ),
    highlight: { active: ['interval:data_reduced', 'bitmap:data_reduced'], found: ['aggregate:step'] },
    explanation: 'Druid query speed comes from layered pruning. Time eliminates whole segments; bitmap indexes eliminate rows inside candidate segments; columnar metrics make aggregation tight.',
    invariant: 'Every skipped segment or row is work the aggregator never sees.',
  };

  yield {
    state: druidGraph('Bitmap indexes sit beside columnar data'),
    highlight: { active: ['segment', 'bitmap', 'cols', 'e-segment-bitmap', 'e-segment-cols'], found: ['time'] },
    explanation: 'For filter-heavy analytics, bitmap operations can combine predicates before metric columns are scanned. This is why Roaring Bitmaps are a natural neighbor topic.',
  };

  yield {
    state: labelMatrix(
      'Case study: real-time product analytics',
      [
        { id: 'ingest', label: 'events arrive' },
        { id: 'rollup', label: 'rollup by minute' },
        { id: 'query', label: 'dashboard query' },
        { id: 'compact', label: 'later compaction' },
      ],
      [{ id: 'data_structure', label: 'data structure' }, { id: 'effect' }],
      [
        ['streaming ingestion task', 'fresh segment fragments'],
        ['time + dimensions', 'fewer rows'],
        ['time prune + bitmaps', 'low-latency filters'],
        ['rewrite segments', 'better long-term shape'],
      ],
    ),
    highlight: { found: ['query:effect'], active: ['rollup:data_structure', 'compact:effect'] },
    explanation: 'The full Druid case is data lifecycle as data-structure design: ingest now, query immediately, and compact later so long-term scans stay efficient.',
  };

  yield {
    state: labelMatrix(
      'Design pitfalls',
      [
        { id: 'granularity', label: 'bad segment granularity' },
        { id: 'cardinality', label: 'high-cardinality dims' },
        { id: 'small', label: 'too many small segments' },
        { id: 'rollup', label: 'wrong rollup key' },
      ],
      [{ id: 'symptom', label: 'symptom' }, { id: 'repair' }],
      [
        ['too much or too little pruning', 'tune interval/partitioning'],
        ['large dictionaries/indexes', 'measure filter value'],
        ['metadata overhead', 'compact'],
        ['lost query detail or no savings', 'model dimensions carefully'],
      ],
    ),
    highlight: { compare: ['cardinality:symptom', 'small:symptom'], found: ['small:repair'] },
    explanation: 'Druid is fast when physical shape matches queries. Segment interval, dimension choice, rollup, and compaction policy are part of the data structure.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'segment layout') yield* segmentLayout();
  else if (view === 'query pruning') yield* queryPruning();
  else throw new InputError('Pick a Druid segment view.');
}

export const article = {
  sections: [
    { heading: 'What it is', paragraphs: [
      'Apache Druid stores analytics data in segments. A segment is a time-partitioned, columnar, indexed file that can be loaded, replicated, cached, queried, compacted, and retired as a unit. Thinking of a segment as a data structure makes Druid easier to understand.',
      'Each segment contains time information, dimension columns, metric columns, and indexes such as bitmap indexes for filtering. Druid first prunes by time interval, then uses indexes and columnar scans inside the remaining segments.',
    ] },
    { heading: 'How it works', paragraphs: [
      'Ingestion tasks transform events into segment files. Depending on configuration, they may roll up rows by time bucket and dimensions, reducing the number of rows that later queries need to scan. Published segments move to deep storage and are loaded by query-serving historical nodes.',
      'Queries decompose by time intervals and segments. A filter on country, device, or product can use bitmap indexes to identify matching rows before metric columns are aggregated. Compaction later rewrites many small or suboptimal segments into a better physical layout.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Segment design is a workload choice. Small segments increase metadata and scheduling overhead. Very large segments can reduce parallelism or make compaction heavy. High-cardinality dimensions may create large dictionaries and indexes. Rollup saves space only when the query model can tolerate pre-aggregation.',
      'The important misconception is that Druid performance is only about cluster size. Segment shape, time partitioning, bitmap selectivity, and compaction policy can dominate the query experience.',
      'Ingestion mode also matters. Real-time ingestion favors freshness and may create less optimal segment shapes initially. Batch compaction can later rewrite those segments for better rollup, partitioning, and query-time locality.',
    ] },
    { heading: 'Complete case study', paragraphs: [
      'A product analytics dashboard ingests clickstream events in real time. Recent data arrives in fresh segment fragments so dashboards can query it quickly. Older intervals are compacted into cleaner segments with better rollup and fewer files. Queries for the last hour first skip irrelevant intervals, then use bitmap filters for dimensions such as country or platform, then aggregate metric columns.',
      'This links Druid to Roaring Bitmaps, Parquet-style columnar thinking, and LSM-style compaction. The whole system is an example of shaping data physically for repeated analytical questions.',
      'The modeling decision is visible to users: a dashboard that filters mostly by time and country wants different segment and index choices than a dashboard that drills into millions of user ids.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Sources: Apache Druid segment design documentation, https://druid.apache.org/docs/latest/design/segments/, Druid architecture documentation, https://druid.apache.org/docs/latest/design/architecture/, and Druid design overview on bitmap indexes, https://druid.apache.org/docs/latest/design/. Study Roaring Bitmaps, Parquet Columnar Format, DuckDB Vectorized Execution, LSM Tree, and Database Indexing next.',
    ] },
  ],
};
