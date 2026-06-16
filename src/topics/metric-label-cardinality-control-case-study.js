// Metric cardinality control: manage the combinatorial growth of label sets
// before a monitoring system turns observability into a storage incident.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'metric-label-cardinality-control-case-study',
  title: 'Metric Label Cardinality Control',
  category: 'Systems',
  summary: 'How dimensional metrics multiply into time series, why unbounded labels break monitoring systems, and how sketches, allowlists, and routing keep observability affordable.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['series explosion', 'guardrail pipeline'], defaultValue: 'series explosion' },
  ],
  run,
};

function cardinalityGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'metric', label: 'metric', x: 0.7, y: 3.6, note: notes.metric || 'name' },
      { id: 'labels', label: 'labels', x: 2.5, y: 3.6, note: notes.labels || 'dims' },
      { id: 'series', label: 'series', x: 4.3, y: 3.6, note: notes.series || 'key' },
      { id: 'head', label: 'head', x: 6.1, y: 2.0, note: notes.head || 'active' },
      { id: 'index', label: 'index', x: 6.1, y: 5.2, note: notes.index || 'lookup' },
      { id: 'query', label: 'query', x: 7.9, y: 3.6, note: notes.query || 'group' },
      { id: 'cost', label: 'cost', x: 9.4, y: 3.6, note: notes.cost || 'memory' },
    ],
    edges: [
      { id: 'e-metric-labels', from: 'metric', to: 'labels' },
      { id: 'e-labels-series', from: 'labels', to: 'series' },
      { id: 'e-series-head', from: 'series', to: 'head' },
      { id: 'e-series-index', from: 'series', to: 'index' },
      { id: 'e-head-query', from: 'head', to: 'query' },
      { id: 'e-index-query', from: 'index', to: 'query' },
      { id: 'e-query-cost', from: 'query', to: 'cost' },
    ],
  }, { title });
}

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

function* seriesExplosion() {
  yield {
    state: cardinalityGraph('A time series is metric name plus label values'),
    highlight: { active: ['metric', 'labels', 'series', 'e-metric-labels', 'e-labels-series'], compare: ['head', 'index'] },
    explanation: 'Prometheus-style dimensional metrics identify a series by the metric name and the full set of label values. Labels are powerful because they let you aggregate, but every unique combination creates another active series.',
  };

  yield {
    state: labelMatrix(
      'Label combinations multiply',
      [
        { id: 'method', label: 'method' },
        { id: 'status', label: 'status' },
        { id: 'route', label: 'route' },
        { id: 'product', label: 'product' },
      ],
      [
        { id: 'values', label: 'values' },
        { id: 'series', label: 'series' },
      ],
      [
        ['5', '5'],
        ['10', '50'],
        ['80', '4,000'],
        ['2,000', '8,000,000'],
      ],
    ),
    highlight: { active: ['product:series'], found: ['route:series'], compare: ['method:series'] },
    explanation: 'The danger is multiplicative. A harmless method label and a bounded status label are fine. Add endpoint and product IDs, and one metric can become millions of active series.',
    invariant: 'Series count is the product of label cardinalities after filtering to observed combinations.',
  };

  yield {
    state: cardinalityGraph('High-cardinality labels hit both storage and queries', { head: 'RAM', index: 'labels', cost: 'bill' }),
    highlight: { active: ['series', 'head', 'index', 'cost', 'e-series-head', 'e-series-index', 'e-query-cost'], compare: ['query'] },
    explanation: 'Active series need memory, chunks, WAL records, indexes, and query fanout. A cardinality spike can make the monitoring system unreliable exactly when you need it during an incident.',
  };

  yield {
    state: labelMatrix(
      'Where each identifier belongs',
      [
        { id: 'method', label: 'method' },
        { id: 'route', label: 'route' },
        { id: 'user', label: 'user id' },
        { id: 'trace', label: 'trace id' },
      ],
      [
        { id: 'home', label: 'home' },
        { id: 'why', label: 'why' },
      ],
      [
        ['metric label', 'bounded'],
        ['metric label', 'bounded-ish'],
        ['log/trace attr', 'unbounded'],
        ['trace field', 'per request'],
      ],
    ),
    highlight: { found: ['method:home', 'route:home'], active: ['user:home', 'trace:home'] },
    explanation: 'A label should be something you aggregate by. User IDs, emails, session IDs, and trace IDs are useful context, but they belong in logs or traces rather than metric labels.',
  };

  yield {
    state: labelMatrix(
      'The same data can keep detail elsewhere',
      [
        { id: 'metric', label: 'metric' },
        { id: 'log', label: 'log' },
        { id: 'trace', label: 'trace' },
        { id: 'event', label: 'event' },
      ],
      [
        { id: 'detail', label: 'detail' },
        { id: 'query', label: 'query style' },
      ],
      [
        ['low-card', 'aggregate'],
        ['full fields', 'search'],
        ['request attrs', 'path inspect'],
        ['template id', 'count and join'],
      ],
    ),
    highlight: { active: ['metric:detail', 'trace:detail'], found: ['event:detail'] },
    explanation: 'Cardinality control is not data deletion by default. It is choosing the right store: aggregate dimensions in metrics, high-cardinality facts in traces/logs, and stable template IDs for countable log events.',
  };
}

function* guardrailPipeline() {
  yield {
    state: cardinalityGraph('A Collector or scrape pipeline can enforce label policy', { labels: 'allowlist', series: 'estimate', query: 'route' }),
    highlight: { active: ['labels', 'series', 'query', 'e-labels-series', 'e-head-query'], found: ['metric'] },
    explanation: 'The best time to stop a cardinality bomb is before ingestion. Label allowlists, relabeling, dropping, aggregation, and routing policies keep unbounded dimensions out of the active-series set.',
  };

  yield {
    state: labelMatrix(
      'Guardrail tools',
      [
        { id: 'allow', label: 'allowlist' },
        { id: 'drop', label: 'drop label' },
        { id: 'hash', label: 'hash/sample' },
        { id: 'rollup', label: 'rollup' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['known labels', 'miss new dim'],
        ['remove user_id', 'merge series'],
        ['keep examples', 'sampling bias'],
        ['pre-aggregate', 'less drilldown'],
      ],
    ),
    highlight: { active: ['allow:job', 'drop:job', 'rollup:job'], compare: ['hash:risk'] },
    explanation: 'Each guardrail trades fidelity for stability. Dropping a label may merge dimensions, so policies must preserve the labels that define a unique and meaningful aggregate.',
  };

  yield {
    state: labelMatrix(
      'Sketches make the control loop cheap',
      [
        { id: 'hll', label: 'HLL' },
        { id: 'cms', label: 'CMS' },
        { id: 'topk', label: 'top-k' },
        { id: 'sample', label: 'sample' },
      ],
      [
        { id: 'tracks', label: 'tracks' },
        { id: 'use' , label: 'use' },
      ],
      [
        ['distinct vals', 'card estimate'],
        ['frequency', 'heavy labels'],
        ['top offenders', 'drop review'],
        ['examples', 'debug'],
      ],
    ),
    highlight: { active: ['hll:tracks', 'cms:tracks', 'topk:use'], found: ['sample:use'] },
    explanation: 'You do not need exact per-label maps for every high-volume stream. HyperLogLog estimates distinct label values; Count-Min Sketch and heavy-hitter structures identify the largest contributors.',
  };

  yield {
    state: labelMatrix(
      'Cardinality incident response',
      [
        { id: 'detect', label: 'detect' },
        { id: 'isolate', label: 'isolate' },
        { id: 'mitigate', label: 'mitigate' },
        { id: 'repair', label: 'repair' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'action', label: 'action' },
      ],
      [
        ['which metric?', 'series growth'],
        ['which label?', 'HLL/top-k'],
        ['can drop?', 'relabel route'],
        ['code path?', 'fix emitter'],
      ],
    ),
    highlight: { found: ['detect:action', 'isolate:action'], active: ['mitigate:action', 'repair:action'] },
    explanation: 'A good response path identifies the metric, the exploding label, and the emitter. Emergency relabeling buys time; the durable fix is changing instrumentation at the source.',
  };

  yield {
    state: cardinalityGraph('AIOps needs bounded metrics and rich traces'),
    highlight: { active: ['metric', 'labels', 'series'], found: ['query'], compare: ['cost'] },
    explanation: 'AIOps Incident Response should correlate clean aggregate metrics with rich trace and log context. If every user ID becomes a time series, the incident system drowns in observability noise before it can help.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'series explosion') yield* seriesExplosion();
  else if (view === 'guardrail pipeline') yield* guardrailPipeline();
  else throw new InputError('Pick a metric-cardinality view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Metric label cardinality is the number of unique label-value combinations that turn one metric name into many time series. Dimensional metrics are powerful because labels make aggregation flexible. They are dangerous because every unique combination has storage, memory, indexing, and query cost.',
        'A metric such as http_requests_total with labels method, status, route, region, and product can be manageable. Add user_id, session_id, or trace_id and the series count can grow with every request. That is a monitoring data-structure failure, not just a billing surprise.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Prometheus identifies a time series by metric name plus labels. The number of active series is roughly the observed cross-product of label values. The TSDB must store head chunks, WAL entries, block indexes, postings lists, and query state for those series. High cardinality therefore hits ingestion, memory, compaction, and query latency at the same time.',
        'Control happens at instrumentation and ingestion. Bounded labels such as method, status code, region, and coarse route are useful. Unbounded labels such as user IDs, emails, UUIDs, and trace IDs should move to logs or traces. Collector processors, scrape relabeling, allowlists, rollups, and emergency drops are the operational tools.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Cardinality control trades detail for stability. Dropping a label may merge signals that should stay separate. Keeping every label may make the monitoring system fail. Teams need policy: what dimensions are allowed, who approves new labels, how active series are budgeted, and what happens when a metric exceeds its budget.',
        'Sketches help make the loop affordable. HyperLogLog can estimate distinct label values; Count-Min Sketch and heavy-hitter algorithms identify the largest contributors; samples preserve example labelsets for debugging. These are approximate data structures used to protect exact time-series storage.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A service adds user_id to http_request_duration_seconds. Active series jump from thousands to millions. Prometheus memory grows, compaction lags, and dashboards slow during an incident. The emergency fix drops user_id at ingestion and keeps user-specific context in traces. The durable fix changes instrumentation to expose user segment or tenant tier as a bounded label, while exemplars or trace links preserve per-request investigation.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'High cardinality is not always bad by itself; the danger is uncontrolled active series and query cost. A bounded customer_tier label can be valuable. An unbounded customer_id label can be ruinous. Do not drop labels blindly either: if two series represent different semantics, merging them can create false dashboards and bad alerts.',
        'Another misconception is that sampling metrics solves the same problem as tracing. Metrics answer aggregate questions. Traces answer individual path questions. A reliable observability stack uses low-cardinality metrics to detect and rich traces/logs to explain.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Prometheus data model at https://prometheus.io/docs/concepts/data_model/, Prometheus metric and label naming guidance at https://prometheus.io/docs/practices/naming/, OpenTelemetry metrics data model at https://opentelemetry.io/docs/specs/otel/metrics/data-model/, and OpenTelemetry Prometheus/OpenMetrics compatibility at https://opentelemetry.io/docs/specs/otel/compatibility/prometheus_and_openmetrics/. Study Prometheus TSDB Case Study, Monarch Time Series Case Study, HyperLogLog, Count-Min Sketch, OpenTelemetry Collector Case Study, eBPF Ring Buffer Telemetry Case Study, Trace Context & Baggage Propagation, Metric Exemplars Trace Correlation, Log Template Drain Parser, and AIOps Incident Response next.',
      ],
    },
  ],
};
