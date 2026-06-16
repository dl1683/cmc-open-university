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
      heading: 'What it is',
      paragraphs: [
        'Mesa is Google\'s geo-replicated, near-real-time analytic data warehouse for critical measurement data. It ingests updates continuously, maintains materialized views, and serves consistent queries at large scale.',
        'The case study matters because it shows the warehouse as a versioned distributed system, not only a columnar query engine. Freshness and consistency are explicit architecture concerns.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Updates become committed versions. Queries pin a version so they do not observe partial updates. Data is stored in base and delta forms, then compacted and materialized into views for efficient repeated analytics.',
        'Mesa replicates data across regions. The important contract is visibility: readers should know which committed version they are seeing even while newer data is still ingesting or replicating.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Mesa pays for version metadata, compaction, materialized view maintenance, replication, correction handling, and operational control. The payoff is consistent, fresh enough, highly available measurement data for critical business decisions.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Mesa-like ideas appear in data warehouses, lakehouses, metrics platforms, advertising analytics, financial reporting, and systems that separate immutable data files from coordinated visibility metadata.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Near real-time does not mean every reader always sees the newest event. It means ingestion delay is bounded enough for the product need. Another misconception is that consistency is free once data is replicated; versioned metadata is what makes replicated data queryable.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Google paper PDF at https://research.google.com/pubs/archive/42851.pdf, Google Research page at https://research.google/pubs/mesa-geo-replicated-near-real-time-scalable-data-warehousing/, and ACM DOI at https://dl.acm.org/doi/10.14778/2732977.2732999. Study Dremel Query Engine Case Study, Delta Lake Case Study, Snowflake Warehouse Case Study, MVCC Internals & VACUUM, Spanner Case Study, and Write-Ahead Log next.',
      ],
    },
  ],
};
