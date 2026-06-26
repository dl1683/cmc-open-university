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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the ingest path as a conversion from labels to a series identity. A series is one metric name plus one exact label set, and a sample is one timestamped value in that series. Active nodes show the current write path; found nodes show durable storage structures that now contain the sample.',
        'In the compaction view, time moves from a mutable head block into immutable blocks. The write-ahead log, or WAL, protects recent in-memory state after a crash. Retention removes old blocks, so the same structure that makes queries fast also defines what history still exists.',
        {type:'callout', text:'Prometheus scales operational metrics by separating label-based series lookup from compressed time-ordered chunks.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Prometheus stores operational metrics: counters, gauges, histograms, and summaries scraped repeatedly from running services. The storage engine must ingest many small samples, answer recent range queries, and recover after crashes without becoming a large distributed database project.',
        'A row store is a poor fit for that shape. Metrics arrive in ordered streams, and most queries first select series by labels and then scan values over time. The Prometheus TSDB exists to make that access pattern cheap on one local server.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious design is one database row per sample with columns for metric name, labels, timestamp, and value. That is easy to inspect and easy to explain. It also uses a familiar general database instead of a specialized time-series engine.',
        'Another obvious design is an append-only event log. Every scrape result goes at the end, and later queries replay what they need. That preserves history, but it does not by itself answer label selection and repeated range queries quickly.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The first wall is cardinality. Every distinct label set is a different series, so adding user_id, request_id, or raw_url can create millions of active series. Each active series needs memory, index entries, and chunk bookkeeping even when it receives few samples.',
        'The second wall is recent mutable data. Prometheus must accept new samples quickly, but a crash cannot lose the last minutes of monitoring data. Rewriting large files on every scrape is too slow, while memory alone is not durable enough.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Make the series the primary object. The label index finds matching series; compressed chunks store the time-ordered values for each series. This splits the problem into identity lookup and numeric range scanning.',
        'Use two storage modes. The head block handles recent mutable samples and is protected by the WAL. Older samples are cut into immutable blocks that are easier to query, compact, retain, and delete.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'On each scrape, Prometheus maps the metric name and labels to a series ID. It appends the sample to the head block and writes enough information to the WAL for recovery. The head keeps active series, recent chunks, and index state in memory.',
        'Periodically the head is written as an immutable block. A block contains chunks, an index, tombstones for deletions, and metadata for a time range. Compaction merges smaller blocks into larger time ranges, and retention deletes blocks outside the configured time or size budget.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The design works because metrics are append-heavy and time-ordered. Once labels identify a series, new samples usually arrive at the end, where chunk compression can exploit small timestamp deltas and repeated value patterns.',
        'Immutable blocks give old data stable boundaries. Queries can use label postings to find candidate series and then read only the chunks overlapping the requested range. Crash recovery is bounded because the WAL rebuilds recent head state rather than replaying the full history.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main cost is active series cardinality, not only samples per second. One million active series scraped every 30 seconds can be harder than ten thousand high-rate series because every series carries labels, postings, chunks, and bookkeeping. Doubling label combinations roughly doubles that active-series burden.',
        'Compaction spends CPU and disk bandwidth to reduce future query overhead. WAL replay spends startup time after a crash. A regex matcher or broad query that touches many series can dominate runtime even when the graph eventually displays a small aggregate.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Prometheus TSDB is used for service monitoring, Kubernetes metrics, infrastructure dashboards, alert rules, and local incident response. It fits teams that can instrument metrics intentionally and keep labels bounded.',
        'It also works as the local engine under larger systems. Remote write, federation, Thanos, Cortex, Mimir, and vendor backends extend retention or tenancy, but the core local shape remains series lookup plus chunk scans.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails as a general event log. A metric sample says how a number changed at scrape time; it does not preserve each request, trace span, or business event. High-cardinality labels are usually a sign that the data wants logs, traces, or analytics storage.',
        'It also fails when operators treat the WAL as long-term history. The WAL protects the mutable head, while blocks and retention define queryable history. Long-term multi-tenant storage needs a backend designed for object storage, downsampling, sharding, and tenant isolation.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose 200 pods each export 500 series every 15 seconds. That is 100000 active series and about 6667 samples per second. If a team adds path labels with 50 raw paths per pod, the same metric family can jump toward 5000000 series, even if traffic did not increase.',
        'A query for rate(http_requests_total{service="checkout"}[5m]) first uses the label index to find matching series. It then reads roughly 20 samples per matching series for a five-minute window at a 15-second scrape interval. The query is cheap when service selects 300 series and expensive when sloppy labels make it select 300000.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Prometheus storage documentation, Prometheus querying basics, and the Prometheus TSDB design materials in the project repository. Study metric label cardinality control before adding labels to production metrics.',
        'Next, study write-ahead logs, LSM trees, SLO burn-rate alerting, Prometheus remote write, and distributed time-series systems such as Monarch, Cortex, Mimir, or Thanos. Those topics show what changes when one local TSDB is no longer enough.',
      ],
    },
  ],
};
