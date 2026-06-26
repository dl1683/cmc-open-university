// Monarch case study: regional in-memory time-series ingestion and querying
// with global query/configuration planes for planet-scale monitoring.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'monarch-time-series-case-study',
  title: 'Monarch Time Series Case Study',
  category: 'Papers',
  summary: 'Google Monarch as the monitoring-data lesson: regional ingestion, in-memory time series, global querying, and schematized metrics.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['regional ingestion', 'global query and schema'], defaultValue: 'regional ingestion' },
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

function architecture(title) {
  return graphState({
    nodes: [
      { id: 'tasks', label: 'tasks', x: 0.7, y: 3.8, note: 'export metrics' },
      { id: 'collector', label: 'collectors', x: 2.5, y: 3.8, note: 'scrape/push' },
      { id: 'regionA', label: 'region A', x: 4.6, y: 2.2, note: 'in-memory TS' },
      { id: 'regionB', label: 'region B', x: 4.6, y: 5.4, note: 'in-memory TS' },
      { id: 'globalQuery', label: 'global query', x: 7.0, y: 3.0, note: 'federates' },
      { id: 'config', label: 'config plane', x: 7.0, y: 5.4, note: 'schemas/rules' },
      { id: 'user', label: 'SRE/dashboard', x: 9.0, y: 3.8, note: 'alerts + queries' },
    ],
    edges: [
      { id: 'e-tasks-collector', from: 'tasks', to: 'collector', weight: 'metrics' },
      { id: 'e-collector-a', from: 'collector', to: 'regionA', weight: 'write' },
      { id: 'e-collector-b', from: 'collector', to: 'regionB', weight: 'write' },
      { id: 'e-a-query', from: 'regionA', to: 'globalQuery', weight: 'partial query' },
      { id: 'e-b-query', from: 'regionB', to: 'globalQuery', weight: 'partial query' },
      { id: 'e-config-a', from: 'config', to: 'regionA', weight: 'rules' },
      { id: 'e-config-b', from: 'config', to: 'regionB', weight: 'rules' },
      { id: 'e-query-user', from: 'globalQuery', to: 'user', weight: 'result' },
    ],
  }, { title });
}

function* regionalIngestion() {
  yield {
    state: architecture('Monarch regionalizes metric ingestion'),
    highlight: { active: ['tasks', 'collector', 'regionA', 'regionB', 'e-tasks-collector', 'e-collector-a', 'e-collector-b'], compare: ['globalQuery'] },
    explanation: 'Monarch is Google\'s planet-scale in-memory time-series database. Metrics are collected regionally so ingestion and storage scale with locality and failures do not require one global hot path.',
  };

  yield {
    state: labelMatrix(
      'A metric is more than a name and number',
      [
        { id: 'latency', label: 'rpc_latency' },
        { id: 'errors', label: 'rpc_errors' },
        { id: 'cpu', label: 'cpu_usage' },
        { id: 'quota', label: 'quota_used' },
      ],
      [
        { id: 'value', label: 'value type' },
        { id: 'labels', label: 'fields/labels' },
        { id: 'aggregation', label: 'aggregation' },
      ],
      [
        ['histogram', 'service, method, zone', 'percentiles'],
        ['counter', 'service, code', 'rate'],
        ['gauge', 'task, machine', 'latest/avg'],
        ['counter', 'tenant, product', 'sum/rate'],
      ],
    ),
    highlight: { found: ['latency:value', 'latency:aggregation'], active: ['errors:labels', 'quota:labels'] },
    explanation: 'Monarch uses a schematized data model. Labels and value types matter because monitoring queries need aggregation semantics, not just raw points.',
    invariant: 'A time series is identified by metric schema plus field values.',
  };

  yield {
    state: architecture('Regional storage keeps hot monitoring paths local'),
    highlight: { active: ['regionA', 'regionB', 'config', 'e-config-a', 'e-config-b'], found: ['collector'] },
    explanation: 'Configuration tells regions what to collect, retain, and aggregate. The system has to be reliable because SREs use it during incidents, when the monitored systems may already be unhealthy.',
  };

  yield {
    state: labelMatrix(
      'Monitoring database requirements',
      [
        { id: 'ingest', label: 'high ingest' },
        { id: 'query', label: 'interactive query' },
        { id: 'alerts', label: 'alerting' },
        { id: 'reliability', label: 'reliability' },
      ],
      [
        { id: 'pressure', label: 'pressure' },
        { id: 'design', label: 'design response' },
      ],
      [
        ['many time series', 'regional ingestion'],
        ['dashboards during incidents', 'global query plane'],
        ['low-latency decisions', 'precompute and rule config'],
        ['must outlive failures', 'regional isolation'],
      ],
    ),
    highlight: { found: ['ingest:design', 'query:design', 'reliability:design'], active: ['alerts:pressure'] },
    explanation: 'Monarch is a strong case study because monitoring storage has a different failure standard: when everything else is failing, the monitoring database still has to answer.',
  };
}

function* globalQueryAndSchema() {
  yield {
    state: architecture('Global query fans out to regional stores'),
    highlight: { active: ['user', 'globalQuery', 'regionA', 'regionB', 'e-a-query', 'e-b-query', 'e-query-user'], compare: ['collector'] },
    explanation: 'A global query federates to regional stores, merges partial results, and returns one view. That lets users ask fleet-wide questions while keeping ingestion regional.',
  };

  yield {
    state: labelMatrix(
      'Example query plan',
      [
        { id: 'filter', label: 'filter' },
        { id: 'group', label: 'group' },
        { id: 'reduce', label: 'reduce' },
        { id: 'alert', label: 'alert' },
      ],
      [
        { id: 'operation', label: 'operation' },
        { id: 'result', label: 'result' },
      ],
      [
        ['service=search, region=*', 'matching series'],
        ['by method and zone', 'labeled groups'],
        ['p99 latency over 5m', 'time series result'],
        ['p99 > threshold', 'page or ticket'],
      ],
    ),
    highlight: { active: ['filter:operation', 'group:operation', 'reduce:operation'], found: ['alert:result'] },
    explanation: 'The data model matters because queries group by fields, aggregate histograms, and feed alerting rules. A metric schema is a query contract.',
  };

  yield {
    state: labelMatrix(
      'Cardinality is the hidden systems cost',
      [
        { id: 'good', label: 'bounded labels' },
        { id: 'bad', label: 'request id label' },
        { id: 'tenant', label: 'tenant label' },
        { id: 'method', label: 'method label' },
      ],
      [
        { id: 'series_count', label: 'series count' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['service, method, zone', 'manageable'],
        ['unique per request', 'explodes storage'],
        ['many but meaningful', 'quota and isolation'],
        ['bounded enum', 'good aggregation'],
      ],
    ),
    highlight: { found: ['good:risk', 'method:risk'], removed: ['bad:risk'], compare: ['tenant:risk'] },
    explanation: 'Time-series databases live or die by cardinality. High-cardinality labels can overwhelm ingestion, memory, query fanout, and alerting.',
  };

  yield {
    state: labelMatrix(
      'How Monarch connects to the platform',
      [
        { id: 'trace', label: 'Dapper' },
        { id: 'tdigest', label: 't-digest' },
        { id: 'backpressure', label: 'Backpressure' },
        { id: 'dataflow', label: 'Dataflow' },
      ],
      [
        { id: 'connection', label: 'connection' },
        { id: 'question', label: 'question answered' },
      ],
      [
        ['request paths', 'where did time go?'],
        ['quantile sketches', 'how bad is p99?'],
        ['ingest overload', 'are clients flooding us?'],
        ['streaming windows', 'what period does this metric mean?'],
      ],
    ),
    highlight: { found: ['trace:question', 'tdigest:question', 'dataflow:question'], active: ['backpressure:connection'] },
    explanation: 'Metrics, traces, and streams are complementary observability structures. Monarch shows the storage side of operational truth.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'regional ingestion') yield* regionalIngestion();
  else if (view === 'global query and schema') yield* globalQueryAndSchema();
  else throw new InputError('Pick a Monarch view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows Monarch-style time-series monitoring, where regional collectors ingest metric points and global query layers merge them. A time series is a sequence of timestamped values attached to a metric name and labels such as service, region, and instance.',
        'Active nodes show ingestion, schema checks, or query fanout; compare marks mismatched labels or stale replicas; found marks a merged answer that is safe to return. The safe inference rule is this: global aggregation is valid only when the metric schema says which labels and units can be combined.',
        {type:'callout', text:'Monarch separates regional write locality from global read federation, then uses metric schemas to make merged answers valid.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/9/95/Google_data_center.jpg', alt:'Exterior of a Google data center in The Dalles, Oregon with a Google sign in front.', caption:'Google data center in The Dalles, Oregon. Photo by Lambtron, CC BY-SA 4.0, Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Large services emit billions of metric points from many regions. Operators need local writes to keep ingestion fast during incidents, but they also need global reads to answer questions about fleet-wide latency, errors, saturation, and cost.',
        'A single central database creates a long write path and a dangerous dependency during outages. Monarch-style design keeps writes regional and makes the global layer a query federation problem.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to send every metric point to one central time-series store. That is simple to reason about because queries, retention, and alert rules all live in one place.',
        'It works until the monitoring system becomes part of the outage. A network partition, regional overload, schema flood, or central hot shard can make the system lose the data needed to debug the failure.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is write locality versus global truth. Local collectors can accept points near the service that produced them, but global dashboards need one answer across regions and replicas.',
        'Schema drift is another wall. If one region reports latency in milliseconds and another reports seconds, or if labels mean different things, the global sum is precise-looking nonsense.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate the write path from the read path. Regional zones own ingestion, buffering, local storage, and fast survival during partial failure; global query nodes fan out, merge, downsample, and enforce schema rules.',
        'The schema is not documentation. It is executable control over metric type, labels, units, retention, and aggregation rules, so the query layer knows when points can be merged.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A monitored service exports timestamped points such as request_count, latency_ms, or cpu_utilization with labels. Regional collectors validate labels, attach metadata, shard the data, and store it close to the producer.',
        'A global query asks each relevant region for the time range and label filters, then merges partial results. Counters can be summed, gauges may need last-value or average semantics, and histograms need bucket-compatible aggregation.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness depends on a merge invariant. Each returned point must have compatible metric name, unit, label semantics, time bucket, and aggregation type before the global layer combines it.',
        'If that invariant holds, federation produces the same logical answer as a central store for the queried window, except for bounded freshness delay or explicitly missing regions. If it does not hold, the system must reject or mark the result partial.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Cost grows with series cardinality. A metric with 100 services, 20 regions, 50 instances, and 10 status codes creates up to 1,000,000 label combinations before considering time buckets.',
        'Doubling the number of labels can multiply storage and query fanout rather than merely add columns. The behavioral cost is that one careless high-cardinality label, such as user_id, can turn monitoring into a storage and alerting problem.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This design fits global service monitoring, SRE dashboards, alerting, capacity planning, quota systems, and infrastructure cost tracking. The access pattern is heavy writes near producers with many read queries that aggregate across time and labels.',
        'It is also useful for incident response. Regional data can survive long enough to explain a local outage, while global queries show whether the blast radius is one zone, one service, or the whole fleet.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails under uncontrolled cardinality. If teams attach request_id, user_id, or raw URL as labels, the number of series explodes and useful alerts drown in storage pressure.',
        'It can also fail by hiding partial data. A global graph that silently omits one unreachable region can make an outage look like recovery, so partial results need explicit freshness and coverage indicators.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose three regions report request_count for checkout in 1-minute buckets: us has 120,000, eu has 80,000, and asia has 50,000. The global query can sum them to 250,000 because request_count is a counter with matching labels and bucket width.',
        'Now suppose latency is reported as p95_ms: us 180, eu 220, asia 400. The global p95 is not the average 267 ms; the query needs compatible histogram buckets or raw samples, because percentiles cannot be merged by averaging regional percentiles.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: the Monarch paper, "Monarch: Google\'s Planet-Scale In-Memory Time Series Database." Study Prometheus documentation for metric types, labels, and cardinality warnings as a contrasting open-source monitoring model.',
        'Study next: log-structured storage, sharding, distributed query fanout, histogram aggregation, alert freshness, cardinality control, and SLO burn-rate alerting.',
      ],
    },
  ],
};
