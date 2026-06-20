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
    explanation: 'A Druid datasource is not one giant mutable table. It is cut into segment files, usually by time interval, so the cluster can move, cache, replicate, and retire analytics data in coarse physical chunks.',
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
    explanation: 'The useful trick is that a segment is several data structures packaged together. Time and dimensions help decide which rows matter, while compressed metric columns are read only after pruning has removed most of the irrelevant work.',
  };

  yield {
    state: druidGraph('Published segments move to deep storage and historicals'),
    highlight: { active: ['segment', 'deep', 'e-segment-deep'], found: ['time', 'cols', 'bitmap'] },
    explanation: 'Publishing turns a physical file into cluster-visible state. Once published, the segment boundary becomes the unit of distribution, replication, caching, retention, and query scheduling.',
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
    explanation: 'Compaction is not cosmetic cleanup. It rewrites the future query path by reducing file count, improving rollup, and making the columns and indexes line up better with the questions users keep asking.',
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
    explanation: 'Druid query speed is a stack of refusals to do work. Time filters reject whole segments, bitmap indexes reject rows inside the survivors, and only then do metric columns feed the aggregator.',
    invariant: 'Every skipped segment or row is work the aggregator never sees.',
  };

  yield {
    state: druidGraph('Bitmap indexes sit beside columnar data'),
    highlight: { active: ['segment', 'bitmap', 'cols', 'e-segment-bitmap', 'e-segment-cols'], found: ['time'] },
    explanation: 'For filter-heavy analytics, bitmap operations combine predicates before the engine touches most metric values. This is the same idea behind Roaring Bitmaps: set operations are cheaper than inspecting every row one by one.',
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
    explanation: 'The full Druid case is lifecycle as data-structure design. The system accepts imperfect fresh segments for low latency, then rewrites older data into a shape that long-running dashboards can scan cheaply.',
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
    explanation: 'Druid is fast when physical shape matches query shape. Segment interval, dimension choice, rollup key, and compaction policy are not tuning trivia; they are the data structure users experience as latency.',
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
    {
      heading: 'The problem',
      paragraphs: [
        'Apache Druid is built for event analytics where data keeps arriving and users expect interactive answers. A dashboard asks for the last hour of traffic by country. An operations team filters incidents by service and region. A product manager slices signups by platform, campaign, and time bucket. The workload is repetitive, filter-heavy, time-oriented, and latency-sensitive.',
        'The central data structure is the segment. A Druid datasource is not one giant mutable table. It is a collection of immutable, time-bounded, columnar files with indexes and metadata. Segments can be published, moved to deep storage, loaded by historical servers, cached, compacted, replicated, and retired. Once you treat the segment as the physical unit of analytics, Druid query behavior becomes much easier to reason about.',
        {type: 'callout', text: 'A Druid segment is the unit where time partitioning, column layout, indexes, rollup, and cluster lifecycle meet, so query speed depends on segment shape as much as hardware.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/df/Apache_Druid_Architecture.svg', alt: 'Diagram of an Apache Druid cluster with query node, data nodes, deep storage, and master node components.', caption: 'Apache Druid cluster architecture diagram by Bucketsbuckets, CC BY-SA 4.0, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The naive design is to append every event into a large table and scan it when a query arrives. Add a few indexes, add more machines, and hope the cluster can brute-force dashboard traffic. This ignores the most important property of the workload: most analytical questions start with time. If the query asks for the last hour, the engine should not even open data from last week.',
        'A second naive design is to index every dimension aggressively and assume the query engine will figure it out later. That can backfire. High-cardinality dimensions create large dictionaries and indexes. Many tiny files create scheduling and metadata overhead. Raw row storage forces the engine to reconstruct whole events even when the query only needs one metric column. Druid is fast when physical shape matches query shape, not when every possible shortcut is added blindly.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that raw event volume grows faster than user patience. Without physical pruning, filters are applied too late, after too many bytes have already been touched. A dashboard that should be interactive becomes a scan job. Even if the cluster has enough CPU, reading irrelevant files and irrelevant rows wastes memory bandwidth, cache, decompression work, and scheduling capacity.',
        'Fresh ingestion adds pressure. Real-time systems often produce small or imperfect segment fragments because freshness matters immediately. Those fragments are useful for low-latency availability, but they are not always the best long-term scan shape. If they are never compacted, the cluster accumulates metadata overhead and scattered work. The data structure has a lifecycle: ingest now, serve now, reshape later.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Druid makes time the first physical boundary. Events are grouped into segments, usually by interval, and each segment packages the pieces needed to answer common analytical questions inside that interval. A segment contains a time column, dimension columns, metric columns, indexes, and metadata. It is both storage unit and pruning unit.',
        'This gives the query engine two major chances to avoid work. First, interval pruning skips entire segments whose time ranges cannot contribute. Second, indexes such as bitmaps identify row positions inside candidate segments before metric columns are scanned. Aggregation happens after these refusals, so every skipped segment and skipped row is work the aggregator never sees.',
      ],
    },
    {
      heading: 'What the visualization shows',
      paragraphs: [
        'The segment layout view follows ingestion into rollup, segment creation, internal columns, bitmap indexes, and publication to deep storage. The important lesson is that the segment is several data structures packaged together. Time and dimensions support pruning. Metric columns support fast aggregation. Deep storage and historical loading make the segment a cluster-management unit.',
        'The query-pruning view shows Druid refusing unnecessary work in layers. A query for a recent time window first rejects old segments. It then uses bitmap filters for dimensions such as country or platform. Only surviving row positions feed metric aggregation. The highlighted cells are useful because they show the order of selectivity: file pruning first, row pruning second, metric scanning last.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'Ingestion tasks transform raw events into segment files. Depending on configuration, Druid can roll up rows by time bucket and selected dimensions, combining metrics so future queries scan fewer rows. The segment is then published with metadata that makes it visible to the cluster. Published segments live in deep storage and are loaded by serving nodes that answer queries.',
        'Inside the segment, columns are stored separately. The time column supports interval filtering and ordering. Dimensions may be dictionary encoded, which maps repeated string values to compact ids. Bitmap indexes can map dimension values to row positions. Metrics are stored in compressed numeric columns for aggregation. This columnar layout means a query can read the columns it needs instead of reconstructing whole events.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a product analytics datasource receives clickstream events with time, country, platform, campaign, page, and revenue. Users often ask for revenue during the last hour where country is US and platform is iOS, grouped by campaign. A row-store scan would inspect a large number of events and repeatedly discover that most of them are outside the time window or do not match the filters.',
        'With segments, the query first selects only segments overlapping the last hour. Inside those candidate segments, the country=US bitmap and platform=iOS bitmap are combined to produce matching row positions. The engine then reads the campaign dimension for grouping and the revenue metric column for aggregation. If older real-time fragments are later compacted, the same query may touch fewer files and benefit from better rollup.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The design works because dashboard queries are repetitive. Users ask similar time-windowed, filter-heavy questions many times. Druid spends effort during ingestion and compaction to shape data so repeated questions can be answered with less scanning. This is the same general tradeoff behind column stores, bitmap indexes, materialized aggregates, and partition pruning.',
        'The algorithmic pattern is layered selectivity. Time pruning removes files. Bitmap predicates remove row positions. Columnar layout keeps aggregation tight because the engine reads the metric columns it needs. Rollup can reduce rows when the analysis tolerates pre-aggregation. Compaction can rewrite older data into fewer, better-shaped segments after freshness pressure has passed.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Segment design is a workload choice. Small segments increase metadata, scheduling, and coordination overhead. Very large segments can reduce parallelism and make rewrites expensive. High-cardinality dimensions can create large dictionaries and indexes. Rollup saves space and scan work only when the query model can tolerate the chosen aggregation granularity.',
        'Compaction is also a cost. It consumes cluster resources to rewrite data that already exists. The benefit is future query shape: fewer segments, better rollup, cleaner partitioning, and less metadata. The right policy depends on freshness requirements, query concurrency, retention, data volume, and the value of lower latency on older intervals.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Druid wins when queries have natural time windows, repeated filters, and aggregations over metrics. Product analytics, observability dashboards, ad-tech reporting, operational drilldowns, and event monitoring fit this shape well. The segment gives the engine a physical way to skip old intervals, filter rows cheaply, and aggregate only useful metric values.',
        'It also wins when data can be modeled deliberately. A dashboard that mostly filters by time, region, and platform wants a different segment and dimension design than a forensic query tool that drills into individual user ids. Good Druid modeling starts with the questions users ask most often, then shapes segment granularity, dimensions, rollup, and compaction around those questions.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Druid is less effective when physical shape and query shape diverge. Bad segment granularity can leave too much or too little data per segment. Poorly chosen rollup keys can either lose needed detail or save almost nothing. Extremely high-cardinality dimensions can make dictionaries and indexes expensive. Too many small segments can make query overhead dominate. Queries that need raw per-event detail may not benefit from rollup at all.',
        'The common mistake is treating performance as only a cluster-sizing problem. Adding machines may help, but segment interval, partitioning, dimension choice, bitmap selectivity, rollup, and compaction policy often dominate user-visible latency. If these choices are wrong, more hardware can simply scan the wrong shape faster and still disappoint users.',
      ],
    },
    {
      heading: 'Failure modes to test',
      paragraphs: [
        'Test segment counts per interval, average segment size, query fan-out, compaction backlog, rollup ratio, bitmap selectivity, high-cardinality dimension growth, and the latency difference between fresh and compacted intervals. A healthy system should make the main pruning path visible: which intervals were selected, which segments were loaded, which predicates reduced rows, and how much metric data was scanned.',
        'Also test model changes. Adding a new dimension can increase storage and index cost. Changing granularity can alter rollup savings. A new dashboard filter can make an old segment shape less effective. Treat segment design as an evolving contract between ingestion and query behavior.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources for this topic include Apache Druid segment documentation at https://druid.apache.org/docs/latest/design/segments/, Druid architecture documentation at https://druid.apache.org/docs/latest/design/architecture/, and Druid design documentation at https://druid.apache.org/docs/latest/design/.',
        'Good next topics are Roaring Bitmaps, Parquet Columnar Format Case Study, DuckDB Vectorized Execution Case Study, Database Indexing, Block Range Index Zone Maps, Runtime Bloom Filter Join Pruning Case Study, LSM Tree compaction topics, and ClickHouse MergeTree Case Study.',
      ],
    },
  ],
};
