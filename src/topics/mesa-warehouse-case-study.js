// Mesa case study: Google's near-real-time, geo-replicated warehouse for
// critical measurement data, with versioned updates and consistent queries.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'mesa-warehouse-case-study',
  title: 'Mesa Warehouse Case Study',
  category: 'Papers',
  summary: 'Google Mesa as the analytics lesson: near-real-time ingestion, versioned tables, materialized views, and geo-replicated queries.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['versions and queries', 'geo-replicated ingestion'], defaultValue: 'versions and queries' },
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

function mesaGraph(title) {
  return graphState({
    nodes: [
      { id: 'updates', label: 'updates', x: 0.8, y: 4.0, note: 'minutes' },
      { id: 'controller', label: 'controller', x: 2.7, y: 4.0, note: 'commit versions' },
      { id: 'delta', label: 'delta files', x: 4.6, y: 2.0, note: 'new data' },
      { id: 'base', label: 'base files', x: 4.6, y: 6.0, note: 'compacted' },
      { id: 'view', label: 'materialized view', x: 6.7, y: 4.0, note: 'aggregates' },
      { id: 'us', label: 'US region', x: 8.6, y: 2.4, note: 'query' },
      { id: 'eu', label: 'EU region', x: 8.6, y: 5.6, note: 'query' },
    ],
    edges: [
      { id: 'e-updates-controller', from: 'updates', to: 'controller', weight: 'commit' },
      { id: 'e-controller-delta', from: 'controller', to: 'delta', weight: 'version N' },
      { id: 'e-delta-base', from: 'delta', to: 'base', weight: 'merge' },
      { id: 'e-base-view', from: 'base', to: 'view', weight: 'aggregate' },
      { id: 'e-view-us', from: 'view', to: 'us', weight: 'replicate' },
      { id: 'e-view-eu', from: 'view', to: 'eu', weight: 'replicate' },
    ],
  }, { title });
}

function* versionsAndQueries() {
  yield {
    state: mesaGraph('Mesa stores warehouse data as versioned updates'),
    highlight: { active: ['updates', 'controller', 'delta', 'e-updates-controller', 'e-controller-delta'], found: ['view'] },
    explanation: 'Mesa was built for critical Google measurement data: ingest continuously, make it queryable quickly, and keep consistent answers across huge replicated datasets.',
  };

  yield {
    state: labelMatrix(
      'A query reads a consistent version',
      [
        { id: 'v100', label: 'version 100' },
        { id: 'v101', label: 'version 101' },
        { id: 'v102', label: 'version 102' },
        { id: 'query', label: 'query' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'visible', label: 'visible to query' },
      ],
      [
        ['committed', 'yes'],
        ['committed', 'yes if chosen'],
        ['in progress', 'no'],
        ['pinned at 101', 'repeatable'],
      ],
    ),
    highlight: { found: ['query:visible', 'v101:visible'], compare: ['v102:visible'] },
    explanation: 'Mesa queries run against a version. That gives repeatable analytic answers while ingestion continues. This is MVCC thinking applied to a distributed warehouse.',
    invariant: 'A versioned query should not see half of an update batch.',
  };

  yield {
    state: labelMatrix(
      'Materialized view maintenance',
      [
        { id: 'raw', label: 'raw facts' },
        { id: 'delta', label: 'new delta' },
        { id: 'mv', label: 'materialized view' },
        { id: 'compact', label: 'compaction' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['measurement rows', 'huge volume'],
        ['incremental change', 'late/corrected data'],
        ['precomputed aggregate', 'must stay consistent'],
        ['merge versions', 'background cost'],
      ],
    ),
    highlight: { active: ['delta:job', 'mv:job'], compare: ['compact:risk'] },
    explanation: 'The warehouse optimizes repeated analytic reads by maintaining aggregates. Like Delta Lake and Snowflake, the metadata/version contract is as important as the storage files.',
  };

  yield {
    state: labelMatrix(
      'Mesa compared with neighbors',
      [
        { id: 'dremel', label: 'Dremel' },
        { id: 'mesa', label: 'Mesa' },
        { id: 'delta', label: 'Delta Lake' },
        { id: 'snowflake', label: 'Snowflake' },
      ],
      [
        { id: 'core', label: 'core lesson' },
        { id: 'fit', label: 'fit' },
      ],
      [
        ['columnar interactive scans', 'ad-hoc analytics'],
        ['versioned replicated warehouse', 'critical metrics'],
        ['transaction log over lake files', 'open lakehouse'],
        ['separate storage and compute', 'cloud warehouse'],
      ],
    ),
    highlight: { found: ['mesa:core'], compare: ['dremel:core', 'delta:core', 'snowflake:core'] },
    explanation: 'The analytics pages are not duplicates. Dremel teaches query serving, Mesa teaches versioned replicated measurement, Delta teaches table logs, and Snowflake teaches cloud separation.',
  };
}

function* geoReplicatedIngestion() {
  yield {
    state: mesaGraph('Mesa must keep multiple regions queryable'),
    highlight: { active: ['view', 'us', 'eu', 'e-view-us', 'e-view-eu'], compare: ['controller'] },
    explanation: 'Mesa is geo-replicated for availability and locality. Metadata must coordinate which versions are visible; data movement can lag as long as queries know what version they are reading.',
  };

  yield {
    state: labelMatrix(
      'Ingestion pipeline pressures',
      [
        { id: 'freshness', label: 'freshness' },
        { id: 'correctness', label: 'correctness' },
        { id: 'availability', label: 'availability' },
        { id: 'scale', label: 'scale' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'mechanism', label: 'mechanism' },
      ],
      [
        ['near real-time metrics', 'small deltas'],
        ['no partial updates', 'versioned commits'],
        ['regional serving', 'replication'],
        ['huge query volume', 'precomputed views'],
      ],
    ),
    highlight: { found: ['freshness:mechanism', 'correctness:mechanism', 'availability:mechanism'] },
    explanation: 'Mesa is interesting because it refuses a simple tradeoff. It wants freshness, consistency, availability, and scale, so it spends architecture on versioned data and replicated metadata.',
  };

  yield {
    state: labelMatrix(
      'Failure handling by version contract',
      [
        { id: 'writer', label: 'writer retry' },
        { id: 'region_lag', label: 'region lag' },
        { id: 'bad_update', label: 'bad update' },
        { id: 'reader', label: 'reader' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'response', label: 'response' },
      ],
      [
        ['duplicate attempt', 'idempotent commit'],
        ['missing newest files', 'serve older committed version'],
        ['correction needed', 'new version/correction'],
        ['needs stable answer', 'pin version'],
      ],
    ),
    highlight: { active: ['region_lag:response', 'reader:response'], compare: ['bad_update:response'] },
    explanation: 'A versioned warehouse can degrade gracefully: if the newest version is not available everywhere, readers can still use a consistent older version instead of seeing mixed state.',
  };

  yield {
    state: labelMatrix(
      'Reusable design pattern',
      [
        { id: 'data', label: 'data files' },
        { id: 'metadata', label: 'metadata' },
        { id: 'queries', label: 'queries' },
        { id: 'replication', label: 'replication' },
      ],
      [
        { id: 'principle', label: 'principle' },
        { id: 'study', label: 'study link' },
      ],
      [
        ['immutable or append-like', 'LSM Tree'],
        ['small and strongly coordinated', 'Spanner'],
        ['pin a version', 'MVCC'],
        ['separate data from visibility', 'Delta Lake'],
      ],
    ),
    highlight: { found: ['metadata:principle', 'queries:principle'], active: ['replication:study'] },
    explanation: 'A common pattern emerges across data systems: large data files move cheaply and asynchronously; small metadata defines what is visible and must be coordinated carefully.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'versions and queries') yield* versionsAndQueries();
  else if (view === 'geo-replicated ingestion') yield* geoReplicatedIngestion();
  else throw new InputError('Pick a Mesa view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The versions-and-queries view shows data becoming visible through committed versions. A version is a named snapshot of warehouse data that readers can query consistently. Active nodes are ingest or commit steps; found nodes are versions that queries may safely pin.',
        {type:'callout', text:'Mesa separates data arrival from data visibility, letting fresh updates become trustworthy only when a committed version is coherent.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/2/2d/Google_datacenter_%282007%29_-_panoramio_-_erwinboogert_%282%29.jpg', alt:'Exterior view of a Google data center building in Eemshaven, Netherlands.', caption:'Google data center in Eemshaven, 2007. erwinboogert, CC BY-SA 3.0, via Wikimedia Commons.'},
        'The geo-replicated view shows the same committed data moving across regions. A region is a separate data-center location. The safe inference is that copied files are not enough; readers need metadata that says which version is complete and queryable.'
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Mesa is a warehouse for measurement data that must be fresh and trustworthy. Measurement data includes facts such as clicks, impressions, spend, and corrections. Users want recent dashboards, but they also need reports that do not mix half-applied updates.',
        'A normal warehouse can be consistent by loading data in large batches. A stream can be fresh by exposing records as soon as they arrive. Mesa exists for the harder middle: near-real-time analytics where every answer must name a coherent version.'
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a daily or hourly batch load. It creates clean snapshots and makes query results easy to explain. It also leaves users waiting when a business or operations question depends on recent data.',
        'The opposite approach is to stream every update directly into queryable tables. That lowers delay, but readers may see impressions from one update and spend from an older update. Fresh partial truth can be worse than slightly stale coherent truth.'
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is visibility. Data arrival does not mean data is ready for queries. Derived aggregates, indexes, corrections, and replicas may all need to catch up before a version is safe.',
        'Geo-replication adds another wall. If one region sees version 104 and another sees version 103, users can get different answers for the same dashboard. The system needs to expose age and version state instead of hiding it behind ordinary query success.'
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate ingestion from visibility. Updates can arrive continuously, but readers see only committed versions. A committed version is a promise that the files and metadata needed for that version form a coherent snapshot.',
        'Store stable data and recent deltas separately. Base data is compacted, older state. Deltas are newer updates or corrections. Queries can combine base and delta files for freshness, while compaction later reduces the long-term cost.'
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Mesa ingests update batches and assigns them to versions. The system updates metadata so queries can pin a specific version rather than reading whatever files happen to be present. Pinning means a query reads one declared snapshot from start to finish.',
        'Materialized views store precomputed aggregates for common analytic questions. They cost write and maintenance work, but they make repeated dashboard queries fast. Compaction folds deltas into larger base structures so query cost does not grow forever.',
        'Replication moves committed data and metadata across regions. A query router can choose a region and version that satisfy freshness and availability requirements. If a newer version is incomplete in one region, the system should serve an older coherent version or report the lag.'
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from snapshot consistency. A query pinned to version 104 reads all data included in 104 and no data outside that version. It does not observe a writer halfway through publishing version 105.',
        'The base-plus-delta layout is safe because version metadata defines which pieces belong together. Compaction can rewrite physical layout without changing the logical version answer. Readers trust metadata, not file arrival order.'
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Mesa pays for metadata, materialized-view maintenance, compaction, and replication. If input volume doubles, ingestion and view-update work roughly double unless aggregation reduces it early. If deltas accumulate, queries slow because they must read more pieces per answer.',
        'Freshness has a cost curve. Committing every minute gives recent dashboards but increases metadata churn and compaction pressure. Committing every hour is cheaper but may be too stale for decisions. The useful system exposes this tradeoff instead of pretending freshness is free.',
        'Replication multiplies storage and network work. Three regions storing the same 50 TB committed dataset require about 150 TB before extra indexes and temporary compaction files. The benefit is regional survival and lower query latency for nearby users.'
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Mesa-like designs fit advertising analytics, financial reporting, feature stores, operational dashboards, and lakehouse tables. The common access pattern is repeated aggregate queries over data that is still receiving late events or corrections.',
        'The same idea appears in Iceberg, Delta Lake, Hudi, and cloud warehouses. Files alone are not the table. Metadata decides which files make a snapshot and which snapshot a reader is allowed to see.'
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Mesa is not an online transaction processing database. If every event must immediately enforce a user-facing invariant, a warehouse snapshot is the wrong tool. Mesa is for analytic visibility, not per-row business transactions.',
        'It also fails when version state is hidden from users. A dashboard can load successfully while serving old data, missing corrections, or reading a lagging region. Operational correctness requires freshness indicators and version-aware alerts.'
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose version 103 contains 10,000,000 impressions and 300,000 clicks. A new update adds 200,000 impressions, 9,000 clicks, and a correction that removes 500 old clicks. If readers see only the impression update, click-through rate becomes wrong.',
        'Mesa ingests the update as version 104. The coherent answer is impressions=10,200,000 and clicks=308,500. The click-through rate is 308,500 divided by 10,200,000, about 3.02 percent.',
        'A query pinned to version 103 still reports 300,000 divided by 10,000,000, or 3.00 percent. A query pinned to 104 reports 3.02 percent. Either answer is explainable; a mixture of 104 impressions and 103 clicks is not.'
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Mesa: Geo-Replicated, Near Real-Time, Scalable Data Warehousing, https://research.google.com/pubs/archive/42851.pdf. Study MVCC, write-ahead logs, Dremel, Spanner, Delta Lake, Iceberg, materialized views, and compaction in LSM trees next.'
      ],
    },
  ],
};
