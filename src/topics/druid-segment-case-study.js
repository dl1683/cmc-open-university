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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the segment-layout view as a physical contract between ingestion and query serving. Active nodes show how raw events become immutable segment files, and found nodes show the structures a query can use later.',
        'Read the query-pruning view as ordered refusal. The safe inference rule is that a row can reach metric aggregation only after its segment survives the time filter and its row position survives the dimension filters.',
        {type: 'callout', text: 'A Druid segment is the unit where time partitioning, column layout, indexes, rollup, and cluster lifecycle meet, so query speed depends on segment shape as much as hardware.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/df/Apache_Druid_Architecture.svg', alt: 'Diagram of an Apache Druid cluster with query node, data nodes, deep storage, and master node components.', caption: 'Apache Druid cluster architecture diagram by Bucketsbuckets, CC BY-SA 4.0, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Apache Druid exists for event analytics where new data arrives continuously and users expect dashboards to answer quickly. Most questions are time-windowed, filter-heavy, and aggregate-oriented.',
        'The segment is the central data structure that makes this workload manageable. A segment is an immutable, time-bounded, columnar file with indexes and metadata, and the cluster can publish, cache, compact, replicate, and retire it as one unit.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to append every event into one large table and scan it when a dashboard asks a question. Add indexes, add machines, and let the query engine brute-force the result.',
        'That is reasonable at first because event data looks like a stream of rows. If the dataset is small or queries are rare, a direct scan can be simpler than a specialized ingestion and compaction pipeline.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that time filters should reject files before row filtering begins. If a query asks for the last hour, opening last week of data wastes scheduling, IO, decompression, and memory bandwidth.',
        'Fresh ingestion adds another wall. Real-time tasks may create many small segment fragments for low latency, but those fragments become expensive long-term scan units if compaction never rewrites them.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Druid makes time the first physical boundary. Events are grouped into segments by interval, and each segment packages time, dimensions, metrics, indexes, and metadata for that interval.',
        'This gives the engine a layered pruning path. Skip whole segments by time, use bitmap indexes to skip row positions inside survivors, then read metric columns only for rows that can contribute.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Ingestion tasks transform raw events into segment files. Rollup can combine events with the same time bucket and selected dimensions, so future queries scan fewer rows when that aggregation is acceptable.',
        'Inside a segment, dimension columns may be dictionary encoded, bitmap indexes map dimension values to row positions, and metric columns are stored in compressed numeric form. Published segment metadata tells the cluster where the segment lives and which interval it covers.',
        'Compaction later rewrites older data into better-shaped segments. It can reduce file counts, improve rollup, clean up partitioning, and make common dashboard queries touch fewer physical objects.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is set restriction. Time pruning removes segments whose intervals cannot overlap the query, bitmap filters compute row-position sets for predicates, and metric aggregation runs only over the intersection that remains.',
        'Rollup is correct only for queries that match the chosen aggregation grain. If the segment grouped by minute, country, and platform, then a query at that grain can use the pre-aggregated metrics, while a query needing raw event detail cannot recover what rollup discarded.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Cost behaves through segment shape. Too many small segments increase metadata and scheduling overhead, while segments that are too large can reduce parallelism and make rewrites expensive.',
        'High-cardinality dimensions can make dictionaries and bitmap indexes large. Rollup saves scan work only when the chosen dimensions match repeated query patterns, and compaction spends cluster resources now to lower query cost later.',
        'When query volume grows, the dominant cost is often not CPU alone. It is the number of segments opened, the selectivity of bitmaps, the amount of metric data scanned, and the backlog of compaction work.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Druid fits product analytics, observability dashboards, ad reporting, operational monitoring, and security drilldowns. These systems usually ask recent time-windowed questions with repeated filters and aggregated metrics.',
        'The segment design is especially useful when operators can model the workload. A dashboard that filters by time, country, and platform should shape granularity, dimensions, rollup, and compaction around those access paths.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Druid fails when the physical shape and query shape diverge. Bad segment granularity, poor rollup keys, high-cardinality dimensions, and too many small files can make the engine scan the wrong shape quickly.',
        'It is also a poor fit for workloads that need frequent row-level updates or arbitrary raw-event reconstruction. The design favors immutable analytical segments, not transactional mutation.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a datasource receives 120 million events per hour, stored as 60 one-minute segments with 2 million rows each. A query asks for revenue in the last 10 minutes where country is US and platform is iOS, grouped by campaign.',
        'Time pruning keeps 10 segments and skips 50. If the US bitmap selects 30 percent of rows and iOS selects 40 percent, their intersection may leave about 2.4 million candidate rows across the 10 segments instead of 20 million.',
        'The engine then reads campaign and revenue columns for those positions and aggregates by campaign. If later compaction rolls repeated events into minute-country-platform-campaign rows, the same query may scan thousands of rows instead of millions, but only because the rollup grain preserved the question.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Apache Druid documentation on segments, architecture, ingestion, rollup, and compaction. Then inspect query profiles that show selected intervals, segment count, bitmap selectivity, and scanned metric bytes.',
        'Next study Roaring Bitmaps, columnar storage, partition pruning, rollup, LSM-tree compaction, ClickHouse MergeTree, Parquet, DuckDB vectorized execution, and runtime Bloom filters. The transfer lesson is that analytics speed is built into physical shape before the query starts.',
      ],
    },
  ],
};
