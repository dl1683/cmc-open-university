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
      heading: 'What it is',
      paragraphs: [
        'Prometheus TSDB is a local time-series database optimized for metrics scraped from targets. It stores samples in a mutable head block, protects recent data with a write-ahead log, writes immutable time blocks, indexes labels, and compacts older blocks.',
        'This case study belongs beside Write-Ahead Log, Kafka Log Case Study, LSM Tree, and Monarch Time-Series Case Study. It shows a different storage shape: append-heavy numeric samples keyed by metric labels and time.',
        'The key abstraction is not a row; it is a series. A metric name plus an exact label set identifies one stream of timestamped values. Once that mental model is clear, the major engineering concerns follow naturally: append throughput, chunk compression, label indexing, retention, and cardinality control.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Prometheus scrapes targets at intervals. Each sample belongs to a series identified by metric name and labels. Recent samples are appended to the head block and WAL. Periodically, the head is cut into immutable blocks that contain chunks, an index, and metadata. Queries use label matchers to find series and then scan chunks over time.',
        'Compaction merges smaller blocks into larger ones and retention deletes old data. The WAL exists because the head block is mutable and not fully persisted. After a crash, Prometheus replays the WAL to rebuild recent state.',
        'A query therefore has two phases. First, the label index narrows the set of matching series. Then the engine reads the relevant chunks across the requested time range and applies PromQL functions or aggregations. Bad labels hurt twice: they create more series and they make selectors scan more postings lists.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The core cost is series cardinality. Every unique label set is a separate series with memory, index, chunk, and query overhead. Labels such as user_id, request_id, or raw URL can explode the database. Compaction and WAL replay also create disk and startup-time costs.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Prometheus powers service metrics, Kubernetes monitoring, alerting, SLO dashboards, infrastructure visibility, and incident response. It is strong for local scraping and recent operational queries. Long-term and global use cases often add remote write systems such as Cortex, Thanos, Mimir, or vendor backends.',
        'A complete operational case study is an API latency SLO. The service exports histogram bucket counters. Prometheus scrapes them, stores the counter series, evaluates recording rules, and alerts when the rolling error budget burn rate is too high. The TSDB has to keep recent data cheap enough for repeated alert queries.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Prometheus is not a general event log and not a high-cardinality analytics warehouse. It is a metrics TSDB. If you treat labels like arbitrary dimensions, cardinality will dominate cost. If you treat WAL as permanent storage, retention and compaction behavior will surprise you.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Prometheus storage documentation at https://prometheus.io/docs/prometheus/latest/storage/ and Cortex blocks storage documentation at https://cortexmetrics.io/docs/blocks-storage/. Study Metric Label Cardinality Control, SLO Error Budget Burn Rate Alert, Write-Ahead Log, Kafka Log Case Study, LSM Tree, t-digest, and Monarch Time-Series Case Study next.',
      ],
    },
  ],
};
