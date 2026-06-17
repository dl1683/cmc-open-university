// Prometheus TSDB: scrape samples into a head block, protect them with a WAL,
// cut immutable blocks, index labels, and compact over time.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'prometheus-tsdb-case-study',
  title: 'Prometheus TSDB Case Study',
  category: 'Systems',
  summary: 'A time-series storage lesson: scrape ingestion, head chunks, WAL replay, immutable blocks, label indexes, and compaction.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['ingest path', 'compaction retention'], defaultValue: 'ingest path' },
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

function tsdbGraph(title) {
  return graphState({
    nodes: [
      { id: 'targets', label: 'targets', x: 0.7, y: 3.6, note: 'metrics endpoints' },
      { id: 'scrape', label: 'scrape loop', x: 2.2, y: 3.6, note: 'pull samples' },
      { id: 'head', label: 'head block', x: 4.0, y: 2.3, note: 'mutable chunks' },
      { id: 'wal', label: 'WAL', x: 4.0, y: 5.1, note: 'crash replay' },
      { id: 'block', label: '2h block', x: 6.0, y: 2.3, note: 'immutable files' },
      { id: 'index', label: 'label index', x: 6.0, y: 5.1, note: 'series lookup' },
      { id: 'query', label: 'PromQL query', x: 8.2, y: 3.6, note: 'scan chunks' },
      { id: 'compact', label: 'compactor', x: 9.4, y: 2.3, note: 'merge blocks' },
    ],
    edges: [
      { id: 'e-target-scrape', from: 'targets', to: 'scrape', weight: 'HTTP pull' },
      { id: 'e-scrape-head', from: 'scrape', to: 'head', weight: 'append' },
      { id: 'e-scrape-wal', from: 'scrape', to: 'wal', weight: 'log first' },
      { id: 'e-head-block', from: 'head', to: 'block', weight: 'cut block' },
      { id: 'e-block-index', from: 'block', to: 'index', weight: 'labels' },
      { id: 'e-index-query', from: 'index', to: 'query', weight: 'select series' },
      { id: 'e-block-query', from: 'block', to: 'query', weight: 'chunks' },
      { id: 'e-block-compact', from: 'block', to: 'compact', weight: 'merge old blocks' },
    ],
  }, { title });
}

function* ingestPath() {
  yield {
    state: tsdbGraph('Prometheus pulls samples into the TSDB'),
    highlight: { active: ['targets', 'scrape', 'head', 'e-target-scrape', 'e-scrape-head'], compare: ['query'] },
    explanation: 'Prometheus is pull-based: it scrapes targets on an interval and appends samples to an in-memory head block. The workload is append-heavy time-series data with labels.',
  };

  yield {
    state: tsdbGraph('The WAL protects recent samples from crashes'),
    highlight: { active: ['wal', 'e-scrape-wal'], found: ['head'] },
    explanation: 'Incoming samples live in the mutable head block before they become immutable blocks. The write-ahead log records raw samples so Prometheus can replay them after a crash.',
    invariant: 'Append to the WAL before relying on in-memory head state.',
  };

  yield {
    state: labelMatrix(
      'A series identity is metric name plus labels',
      [
        { id: 'metric', label: 'http_requests_total' },
        { id: 'job', label: 'job=api' },
        { id: 'route', label: 'route=/login' },
        { id: 'status', label: 'status=500' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['counter name', 'expected'],
        ['target grouping', 'controlled'],
        ['dimension', 'can explode'],
        ['dimension', 'bounded if enum'],
      ],
    ),
    highlight: { active: ['metric:role', 'job:role'], compare: ['route:risk', 'status:risk'] },
    explanation: 'Labels power flexible queries, but every unique label set creates a time series. High-cardinality labels are the classic Prometheus failure mode.',
  };

  yield {
    state: tsdbGraph('Queries use the label index to find chunks'),
    highlight: { active: ['index', 'query', 'e-index-query', 'e-block-query'], compare: ['block'] },
    explanation: 'A PromQL selector first narrows series by label matchers, then reads compressed chunks over the requested time range. Query cost depends on cardinality, time range, and aggregation shape.',
  };
}

function* compactionRetention() {
  yield {
    state: labelMatrix(
      'Block lifecycle',
      [
        { id: 'head', label: 'head block' },
        { id: 'small', label: 'small block' },
        { id: 'compact', label: 'compacted block' },
        { id: 'delete', label: 'retention delete' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'purpose', label: 'purpose' },
      ],
      [
        ['mutable', 'recent writes'],
        ['immutable', 'queryable files'],
        ['merged', 'fewer blocks to scan'],
        ['removed', 'limit disk/time'],
      ],
    ),
    highlight: { found: ['head:purpose', 'small:purpose', 'compact:purpose'], compare: ['delete:purpose'] },
    explanation: 'Prometheus periodically cuts immutable blocks from the head. Later compaction merges blocks into larger time ranges so queries do not need to touch too many tiny files.',
  };

  yield {
    state: tsdbGraph('Compaction rewrites old immutable blocks'),
    highlight: { active: ['block', 'compact', 'e-block-compact'], compare: ['wal', 'head'] },
    explanation: 'Compaction is background maintenance. It improves query efficiency and storage layout, but it competes for disk IO and CPU with scraping and queries.',
    invariant: 'The newest samples are protected by WAL; older samples live in immutable blocks.',
  };

  yield {
    state: labelMatrix(
      'Cardinality economics',
      [
        { id: 'good', label: 'status code' },
        { id: 'ok', label: 'route template' },
        { id: 'bad', label: 'user id' },
        { id: 'worse', label: 'request id' },
      ],
      [
        { id: 'cardinality', label: 'cardinality' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['low', 'safe dimension'],
        ['medium', 'watch growth'],
        ['high', 'many series'],
        ['unbounded', 'TSDB pain'],
      ],
    ),
    highlight: { found: ['good:effect'], removed: ['bad:effect', 'worse:effect'], compare: ['ok:effect'] },
    explanation: 'The cost unit is the time series. A single bad label can multiply storage, memory, index, and query cost. Observability systems fail from cardinality as often as raw sample volume.',
  };

  yield {
    state: labelMatrix(
      'Prometheus compared with adjacent systems',
      [
        { id: 'prom', label: 'Prometheus TSDB' },
        { id: 'monarch', label: 'Monarch' },
        { id: 'kafka', label: 'Kafka log' },
        { id: 'lsm', label: 'LSM tree' },
      ],
      [
        { id: 'shape', label: 'data shape' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['single-node local TSDB', 'simple operational model'],
        ['global metrics system', 'distribution and scale'],
        ['ordered event log', 'retention and replay'],
        ['write-optimized KV', 'compaction tradeoffs'],
      ],
    ),
    highlight: { active: ['prom:lesson'], compare: ['monarch:lesson', 'kafka:lesson', 'lsm:lesson'] },
    explanation: 'Prometheus is deliberately local and operationally approachable. Long-term global metrics systems add remote write, sharding, multi-tenancy, downsampling, and query federation.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'ingest path') yield* ingestPath();
  else if (view === 'compaction retention') yield* compactionRetention();
  else throw new InputError('Pick a Prometheus TSDB view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Prometheus is built for operational metrics: counters, gauges, histograms, and summaries scraped repeatedly from running services. The database has to ingest many small timestamped samples, answer recent range queries quickly, and recover after crashes without turning monitoring into a large distributed database project.',
        'The Prometheus TSDB is deliberately local. It stores recent samples in a mutable head block, protects that state with a write-ahead log, writes immutable time blocks, indexes labels, and compacts older blocks. That local shape is why Prometheus is easy to run, and also why global long-term metrics systems usually add remote write and separate storage layers.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The naive storage design is one row per sample in a general database: metric name, labels, timestamp, and value. That is easy to understand, but it wastes the fact that samples arrive in ordered streams and that queries usually ask for time ranges over many points in the same series.',
        'Another tempting design is an event log. Append every scrape result and replay it when needed. That preserves history, but metrics queries need fast label selection and range scans, not just replay. Alerting rules also need repeated queries over recent windows, so the storage layout must make common PromQL patterns cheap.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is cardinality. A metric name plus an exact label set identifies one series. `http_requests_total{method="GET",status="200"}` and the same metric with a different route or instance are different series. Add a user id, request id, raw URL, or pod UID label, and the number of active series can explode.',
        'The second wall is mutable recent data. Prometheus has to accept new samples into memory quickly while still surviving a crash. Fully rewriting on every scrape would be too slow, but keeping only memory would lose the most recent metrics exactly when operators need them after an incident.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Make the series the primary storage object. Once labels identify a series, samples append in timestamp order into compressed chunks. The label index finds series; the chunks provide the numeric values over time. This separation is why Prometheus can handle operational queries without acting like a row store.',
        'Use two storage modes: a mutable head for recent data and immutable blocks for older data. The write-ahead log protects the head. Periodic block creation and compaction turn recent mutable state into durable time ranges that are easier to query, retain, and delete.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'The ingest-path view should be read as labels becoming a series identity, then samples appending to that series. The point is not just that Prometheus stores numbers. It stores streams of numbers keyed by label sets, and every new label combination creates another stream with memory and index cost.',
        'The compaction-retention view shows time moving from hot mutable state to immutable blocks and eventually deletion. The WAL is for crash recovery of the head, not a permanent history layer. Blocks are the long-lived query unit, and retention policy decides when old blocks disappear.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Prometheus scrapes targets at intervals. Each sample belongs to a series identified by metric name and labels. Recent samples append to the head block and to the WAL. The head keeps active series, in-memory chunks, and recent index state. The WAL lets Prometheus rebuild recent state after a crash.',
        'Periodically, the head is cut into immutable blocks. A block contains chunks, an index, tombstones, and metadata for a time range. Compaction merges smaller blocks into larger ones to reduce query overhead and improve storage layout. Retention deletes blocks that fall outside the configured time or size budget.',
        'A query has two broad phases. First, the label index narrows the candidate series using matchers. Then the engine reads relevant chunks over the requested time range and applies PromQL functions or aggregations. Bad labels hurt twice: they create more series and they make selectors scan more postings lists.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A service exports `http_request_duration_seconds_bucket{method="GET",route="/checkout",le="0.5"}`. Prometheus scrapes it every fifteen seconds. The metric name and labels identify one counter series for one histogram bucket. Each scrape appends another timestamped value to that series.',
        'An alert asks whether checkout latency is burning the SLO budget. The query first finds the matching bucket series by label matchers, reads recent chunks, calculates rates, combines buckets into a histogram quantile or burn-rate expression, and compares the result to a threshold. The TSDB has to make that repeated range query cheap enough to run every evaluation interval.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The design works because metrics are append-heavy and time-ordered. Once a series is identified, new samples usually arrive near the end. Chunk compression can exploit timestamp and value patterns. Immutable blocks make older data stable, cacheable, and easier to compact or delete.',
        'The local-first model also works operationally. A single Prometheus server can scrape local targets and evaluate alerts with few moving parts. Remote write, federation, Thanos, Cortex, Mimir, or vendor systems can extend the model later, but the core TSDB remains understandable as a local engine.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The dominant cost is active series cardinality. Each active series needs memory for labels, postings, chunks, and bookkeeping. Samples per second matter, but a small stream for a million series can be worse than a high-rate stream for a disciplined label set.',
        'WAL replay creates startup cost after restarts. Compaction creates disk and CPU work. Queries that match too many series can load many chunks and stress memory. Retention saves disk by deleting old blocks, but it also defines how far back local incident analysis can go.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Prometheus wins for service metrics, Kubernetes monitoring, alerting, SLO dashboards, infrastructure visibility, and incident response. It is strong when teams can instrument metrics intentionally and keep label cardinality under control.',
        'It also wins as a teaching system because its boundaries are clear. It is not trying to be a universal analytics warehouse. It is optimized for recent operational metrics, label selection, range queries, local alerting, and simple failure recovery.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Prometheus is not a general event log, tracing backend, or high-cardinality analytics warehouse. If labels contain user ids, request ids, raw URLs, session ids, or arbitrary payload fields, cardinality will dominate memory, index size, query cost, and operational pain.',
        'It also fails when operators assume the WAL is durable long-term storage. The WAL protects the mutable head; blocks and retention define the durable query history. Long-term global storage needs remote write and a backend designed for multi-tenant scale, compaction, downsampling, and object storage.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Common failures are cardinality explosions, expensive regex matchers, unbounded label values, slow WAL replay after a crash, compaction backlogs, disk exhaustion, and alert rules that repeatedly query too much data. Good monitoring of Prometheus includes active series, samples appended, WAL fsync behavior, compaction duration, query latency, and rule evaluation duration.',
        'A subtler failure is bad instrumentation design. A metric that answers no operational question still costs storage and query work. A label that helps one debugging session may damage every scrape afterward. The TSDB rewards teams that treat metrics as a schema, not as free-form logging.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Prometheus storage documentation at https://prometheus.io/docs/prometheus/latest/storage/, Prometheus querying basics at https://prometheus.io/docs/prometheus/latest/querying/basics/, and Cortex blocks storage documentation at https://cortexmetrics.io/docs/blocks-storage/ for a related remote block-storage architecture.',
        'Study Metric Label Cardinality Control, SLO Error Budget Burn Rate Alert, Write-Ahead Log, Kafka Log Case Study, LSM Tree, t-digest, Mimir Distributor Ingester Hash Ring, Prometheus Remote Write WAL Shards, and Monarch Time-Series Case Study next.',
      ],
    },
  ],
};
