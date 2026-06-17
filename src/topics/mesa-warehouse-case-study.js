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
      heading: 'The measurement-data problem',
      paragraphs: [
        'Mesa is Google\'s geo-replicated, near-real-time analytic data warehouse for critical measurement data. It was built for data that needs to be fresh enough for operational and business decisions, consistent enough for people to trust, and replicated enough to survive regional failures. Advertising and measurement data are a good mental model: new facts arrive continuously, corrections happen, dashboards must stay responsive, and inconsistent reports can directly affect decisions.',
        'The case study matters because it teaches that a warehouse is not only a query engine. It is also a versioned distributed system. Mesa has to ingest updates, maintain materialized views, expose consistent versions to readers, compact data, replicate across regions, and support corrections. Freshness and correctness are not separate product features; they are architecture constraints.',
      ],
    },
    {
      heading: 'The naive approaches and why they fail',
      paragraphs: [
        'The first naive approach is to run a traditional batch warehouse and reload data periodically. That gives clean snapshots, but freshness suffers. If dashboards or measurement pipelines need recent data, waiting for a daily or multi-hour batch is not enough.',
        'The second naive approach is to stream every update directly into queryable tables and let readers see whatever is present. That improves freshness but can expose partial updates, inconsistent aggregates, and corrections that have not propagated through all derived views. A dashboard that reads half of an update is worse than a dashboard that is slightly stale but coherent.',
        'The third naive approach is to replicate data across regions without a strong visibility contract. Replication alone does not tell a reader which version is safe to query. A warehouse needs metadata that says which data is committed, which derived views include it, and which replicas have enough state to answer consistently.',
      ],
    },
    {
      heading: 'The core mechanism',
      paragraphs: [
        'Mesa treats updates as versioned batches. New data is ingested and incorporated into committed versions. Queries pin a version, so they do not observe half-applied updates. This is the same basic idea behind MVCC in databases and table snapshots in lakehouse systems: readers need a stable view while writers continue to advance the system.',
        'Data is stored in base and delta forms. Base data represents compacted stable state. Deltas represent newer updates or corrections that have not yet been folded into the base. Compaction merges deltas into more efficient forms. Materialized views and indexes make repeated analytic queries fast enough for users who cannot wait for raw scans.',
        'Geo-replication adds another layer. Mesa has to move committed updates across regions while preserving queryable consistency. The central contract is visibility: a reader should know which committed version it is seeing, even while newer versions are ingesting, compacting, or replicating elsewhere.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Mesa works because it separates data arrival from data visibility. Updates can arrive continuously, but readers see only coherent committed versions. That lets the system be near-real-time without turning every query into a race against ingestion.',
        'It also works because many warehouse queries are repeated aggregates over known dimensions. Materialized views are worth maintaining when the same business questions are asked constantly. Instead of recomputing everything from raw events, Mesa maintains derived structures that can be queried quickly while still respecting version boundaries.',
        'The design is a reminder that analytics correctness is operational. A metric is only useful if users know what time range, version, correction set, and replication state it represents. Version metadata is part of the answer, not a hidden implementation detail.',
      ],
    },
    {
      heading: 'Where it matters',
      paragraphs: [
        'Mesa-like ideas appear in data warehouses, lakehouses, advertising analytics, financial reporting, metrics platforms, feature stores, and any system that separates immutable or append-heavy data files from coordinated visibility metadata. Delta Lake, Iceberg, Hudi, and Snowflake all teach related lessons through different architectures.',
        'The pattern is especially important when late data and corrections are normal. Measurement systems rarely receive perfect events in perfect order. They need ways to correct, compact, and expose new versions without making yesterday\'s report incoherent or silently changing the meaning of a dashboard.',
        'Mesa also sits between OLTP and offline analytics. It is not a transactional application database, and it is not a slow offline batch warehouse. It is a warehouse designed for fresh, replicated, consistent aggregate views over critical measurement data.',
      ],
    },
    {
      heading: 'Costs and failure modes',
      paragraphs: [
        'Mesa pays for version metadata, compaction, materialized view maintenance, replication, correction handling, and operational control. Those are not side costs. They are the system. If compaction falls behind, query cost rises. If materialized views lag, dashboards go stale. If replication lags, regional queries may disagree or serve older versions.',
        'Near real-time does not mean every reader always sees the newest event. It means ingestion delay is bounded enough for the product need and that users see a coherent version. Fresh but incoherent data can be worse than slightly stale data.',
        'Another misconception is that consistency is free once data is replicated. Replicated files without coordinated metadata are just copies. Versioned metadata is what makes replicated data queryable, explainable, and safe for decisions.',
      ],
    },
    {
      heading: 'A worked dashboard example',
      paragraphs: [
        'Suppose an advertising dashboard reports clicks, impressions, and spend by region. New events arrive every minute, and late corrections arrive for the previous hour. Mesa ingests the update batch, creates a new committed version, updates materialized aggregates, and exposes that version only when the relevant pieces are coherent. A query pins version 104 rather than seeing impressions from version 105 and spend from version 103.',
        'This version pinning is the educational point. The user may not care about the internal version number, but the warehouse must. Without it, two queries seconds apart could disagree for reasons no analyst can explain. With it, the system can say: this report is current through this committed version, and newer data is still becoming visible.',
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        'A Mesa-like warehouse should track ingestion lag, commit lag, materialized-view lag, compaction debt, correction backlog, query version age, replication lag by region, and the cost of serving base-plus-delta queries. These signals tell operators whether the warehouse is fresh, coherent, and affordable.',
        'The most dangerous failures are semantic. A dashboard may still load while silently serving an old version, missing corrections, or mixing data from incompatible visibility points. Good systems expose data freshness and version state to users or downstream jobs so stale but coherent reports are not mistaken for the newest truth.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'Mesa is a warehouse built around versioned visibility. Ingest updates continuously, commit coherent versions, let readers pin a version, compact and materialize for speed, and replicate with an explicit contract about what is visible.',
        'The deep lesson is that freshness and consistency must be designed together. A near-real-time warehouse is not just a faster batch system; it is a distributed system with user-facing semantics.',
        'The useful comparison is a lakehouse table format. Iceberg, Delta, and Hudi also use metadata to decide which files belong to a snapshot. Mesa teaches the same general principle through a measurement warehouse: data files become trustworthy only when visibility is coordinated.',
        'In a course sequence, teach Mesa after MVCC and before lakehouse table formats. It helps students see that snapshot metadata is not a database-only idea; it is also how analytics systems explain what a report means.',
        'The practical test is whether users need fresh answers and coherent answers at the same time. If either can be sacrificed, a simpler batch or stream design may suffice. If both matter, versioned visibility becomes central.',
        'Mesa is the wrong pattern when each event must trigger an immediate transactional decision. It is an analytics warehouse, not an OLTP database. Its strength is making aggregate measurement data fresh, consistent, and queryable at scale, not enforcing per-user business transactions.',
        'The best mental shortcut is "fresh snapshots." Mesa is interesting because it does not choose between live data and coherent data; it builds machinery so new snapshots become visible in a controlled way.',
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
