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
      heading: 'What it is',
      paragraphs: [
        'Monarch is Google\'s planet-scale in-memory time-series database for monitoring. It uses regional ingestion and storage with global query and configuration planes, giving teams a unified view without forcing all metric traffic through one global bottleneck.',
        'The case study matters because monitoring data has special requirements: huge ingest, high cardinality pressure, interactive queries, alerting, reliability during incidents, and clear metric semantics.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Tasks export metrics to collectors. Regional Monarch components ingest and store time series in memory. A global query plane federates queries across regions and merges results. A configuration plane manages schemas, collection rules, retention, and alerting behavior.',
        'Metrics are schematized. Value types, fields, labels, and aggregation semantics are part of the contract. That lets users ask relational-style monitoring questions instead of treating metrics as anonymous key-value samples.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main pressures are ingestion rate, memory footprint, label cardinality, query fanout, retention, regional failures, and alert correctness. A single accidental high-cardinality label can create millions of series. Global queries must merge partial regional answers without hiding outages or stale data.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Monarch-style systems support dashboards, alerting, SLOs, capacity planning, release monitoring, incident response, and fleet-wide operational analytics. The design connects metrics storage to tracing, tail-latency sketches, backpressure, and streaming windows.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A time-series database is not just append-only storage with timestamps. Metric schema, label cardinality, aggregation, query federation, and alert semantics are core data-structure decisions. Another misconception is that global views require global ingestion; Monarch keeps ingestion regional and queries global.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: VLDB paper at https://www.vldb.org/pvldb/vol13/p3181-adams.pdf and Google Research page at https://research.google/pubs/monarch-googles-planet-scale-in-memory-time-series-database/. Study Dapper Tracing Case Study, t-digest Quantile Sketch, Google Dataflow Model Case Study, Backpressure & Flow Control, and Load Shedding & Graceful Degradation next.',
      ],
    },
  ],
};
