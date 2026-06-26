// Metric exemplars: attach a bounded sample trace/span reference to histogram
// observations so an aggregate latency bucket can jump to a concrete trace.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'metric-exemplars-trace-correlation-case-study',
  title: 'Metric Exemplars Trace Correlation',
  category: 'Systems',
  summary: 'How histogram buckets can store bounded exemplar trace IDs so engineers jump from p99 metrics to concrete distributed traces.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['histogram link', 'storage limits'], defaultValue: 'histogram link' },
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

function exemplarGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'req', label: 'req', x: 0.8, y: 4.8, note: notes.req ?? 'checkout' },
      { id: 'span', label: 'span', x: 2.4, y: 6.2, note: notes.span ?? 'trace id' },
      { id: 'obs', label: 'obs', x: 2.4, y: 3.2, note: notes.obs ?? 'latency' },
      { id: 'hist', label: 'hist', x: 4.2, y: 4.8, note: notes.hist ?? 'bucket' },
      { id: 'ex', label: 'exmplr', x: 6.0, y: 4.8, note: notes.ex ?? 'trace ref' },
      { id: 'prom', label: 'prom', x: 7.6, y: 6.2, note: notes.prom ?? 'store' },
      { id: 'trace', label: 'trace', x: 7.6, y: 3.2, note: notes.trace ?? 'backend' },
      { id: 'ui', label: 'UI', x: 9.2, y: 4.8, note: notes.ui ?? 'jump' },
    ],
    edges: [
      { id: 'e-req-span', from: 'req', to: 'span', weight: '' },
      { id: 'e-req-obs', from: 'req', to: 'obs', weight: '' },
      { id: 'e-obs-hist', from: 'obs', to: 'hist', weight: '' },
      { id: 'e-span-ex', from: 'span', to: 'ex', weight: '' },
      { id: 'e-hist-ex', from: 'hist', to: 'ex', weight: '' },
      { id: 'e-ex-prom', from: 'ex', to: 'prom', weight: '' },
      { id: 'e-ex-trace', from: 'ex', to: 'trace', weight: '' },
      { id: 'e-prom-ui', from: 'prom', to: 'ui', weight: '' },
      { id: 'e-trace-ui', from: 'trace', to: 'ui', weight: '' },
    ],
  }, { title });
}

function exemplarPlot() {
  return plotState({
    axes: { x: { label: 'bucket ms', min: 0, max: 1000 }, y: { label: 'count', min: 0, max: 120 } },
    series: [
      { id: 'hist', label: 'histogram', points: [{ x: 50, y: 110 }, { x: 100, y: 92 }, { x: 200, y: 58 }, { x: 500, y: 18 }, { x: 900, y: 4 }] },
    ],
    markers: [
      { id: 'ex1', x: 500, y: 18, label: 'trace A' },
      { id: 'ex2', x: 900, y: 4, label: 'trace B' },
    ],
  }, { title: 'Exemplars place trace links on histogram buckets' });
}

function* histogramLink() {
  yield {
    state: exemplarGraph('A request records both span context and latency'),
    highlight: { active: ['req', 'span', 'obs', 'e-req-span', 'e-req-obs'], compare: ['hist'] },
    explanation: 'A service handling checkout has an active span and observes request latency. Metrics aggregate the latency; tracing preserves the concrete request path.',
    invariant: 'An exemplar is a bounded pointer from aggregate metric data to one concrete event.',
  };

  yield {
    state: exemplarGraph('The histogram bucket stores a sample trace reference', { hist: '500ms', ex: 'trace_id', span: 'span_id' }),
    highlight: { active: ['hist', 'ex', 'span', 'e-hist-ex', 'e-span-ex'], found: ['obs'] },
    explanation: 'An exemplar attaches labels such as trace_id and span_id to a selected metric observation. The bucket still aggregates counts; the exemplar gives one representative trace to inspect.',
  };

  yield {
    state: exemplarPlot(),
    highlight: { active: ['ex1', 'ex2'], found: ['hist'] },
    explanation: 'In a dashboard, the p99 bucket can show exemplar dots. An engineer can click a dot and open the trace that contributed to that slow bucket.',
  };

  yield {
    state: exemplarGraph('Prometheus stores the metric and the trace backend stores the span tree', { prom: 'hist+ex', trace: 'trace db', ui: 'linked' }),
    highlight: { active: ['prom', 'trace', 'ui', 'e-prom-ui', 'e-trace-ui'], found: ['ex'] },
    explanation: 'The metric store does not need to store all spans. It keeps a small exemplar reference; the trace backend stores the full trace. The UI joins them by trace id.',
  };

  yield {
    state: labelMatrix(
      'Metric-to-trace path',
      [
        { id: 'alert', label: 'alert' },
        { id: 'hist', label: 'histogram' },
        { id: 'ex', label: 'exemplar' },
        { id: 'trace', label: 'trace' },
      ],
      [
        { id: 'has', label: 'has' },
        { id: 'next', label: 'next' },
      ],
      [
        ['p99 high', 'open panel'],
        ['slow bucket', 'pick dot'],
        ['trace id', 'open trace'],
        ['span tree', 'root cause'],
      ],
    ),
    highlight: { found: ['ex:has', 'trace:next'], active: ['hist:next'] },
    explanation: 'The complete workflow is metrics alert first, histogram bucket second, exemplar trace id third, and distributed trace tree fourth.',
  };
}

function* storageLimits() {
  yield {
    state: labelMatrix(
      'Exemplar budget',
      [
        { id: 'store', label: 'store' },
        { id: 'labels', label: 'labels' },
        { id: 'sample', label: 'sample' },
        { id: 'retain', label: 'retain' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['bounded', 'memory'],
        ['trace/span', 'card leak'],
        ['strategic', 'noise'],
        ['shorter', 'stale link'],
      ],
    ),
    highlight: { active: ['store:rule', 'labels:rule', 'sample:rule'], compare: ['labels:risk'] },
    explanation: 'Exemplars are intentionally bounded. Store trace and span identifiers, not large payloads, user data, or arbitrary high-cardinality labels.',
    invariant: 'Exemplars add detail without turning every observation into a new time series.',
  };

  yield {
    state: exemplarGraph('A hot endpoint emits many observations but only a few exemplars', { req: 'many reqs', ex: 'sampled', prom: 'bounded' }),
    highlight: { active: ['req', 'obs', 'hist', 'ex', 'prom', 'e-obs-hist', 'e-hist-ex'], compare: ['trace'] },
    explanation: 'The histogram counter increments for every observation. Exemplars are samples attached to selected observations, often slow or interesting ones.',
  };

  yield {
    state: labelMatrix(
      'Good exemplar labels',
      [
        { id: 'trace', label: 'trace_id' },
        { id: 'span', label: 'span_id' },
        { id: 'route', label: 'route' },
        { id: 'user', label: 'user id' },
      ],
      [
        { id: 'ok', label: 'ok?' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['yes', 'join trace'],
        ['yes', 'open span'],
        ['maybe', 'already label'],
        ['no', 'PII/card'],
      ],
    ),
    highlight: { found: ['trace:ok', 'span:ok'], compare: ['route:reason'], removed: ['user:ok'] },
    explanation: 'OpenTelemetry-to-Prometheus compatibility maps trace ID and span ID into exemplar labels. Avoid adding sensitive or unbounded dimensions that belong in the trace itself.',
  };

  yield {
    state: exemplarGraph('Trace retention and exemplar retention must overlap', { prom: 'ex kept', trace: 'trace gone?', ui: '404 risk' }),
    highlight: { active: ['prom', 'trace', 'ui', 'e-prom-ui', 'e-trace-ui'], compare: ['ex'] },
    explanation: 'If metric exemplars outlive trace retention, dashboard links go stale. Retention windows and sampling policy need to be designed together.',
  };

  yield {
    state: labelMatrix(
      'Runbook',
      [
        { id: 'enable', label: 'enable' },
        { id: 'map', label: 'map ids' },
        { id: 'sample', label: 'sample' },
        { id: 'audit', label: 'audit' },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['hist only', 'no dots'],
        ['trace link', 'bad URL'],
        ['slow reqs', 'noise'],
        ['PII check', 'leak'],
      ],
    ),
    highlight: { found: ['map:action', 'sample:action', 'audit:action'], compare: ['enable:failure'] },
    explanation: 'The production recipe enables exemplar storage for latency histograms, maps trace IDs to the trace backend, samples useful observations, and audits labels before exposing dashboards.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'histogram link') yield* histogramLink();
  else if (view === 'storage limits') yield* storageLimits();
  else throw new InputError('Pick an exemplar view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The histogram-link view follows one request as it creates a trace span and a latency measurement. A trace is a tree of spans for one request, while a metric is an aggregate time series. Active nodes are recording the observation, found nodes hold stored aggregate state, and compare nodes show the join from a bucket back to one trace.',
        'The storage-limits view shows what is deliberately not stored. An exemplar is a small sample attached to one metric observation, not a new time series label. The safe inference is that a trace id in an exemplar can open one request path without multiplying the metric cardinality by every request.',
        {type:'callout', text:'Exemplars preserve one trace join key at metric observation time, giving aggregate histograms a bounded path back to concrete requests.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Metrics are good at telling a team that a rate, count, or latency distribution changed. A histogram can show that checkout latency has a new tail, but it does not explain what one slow request did internally. The aggregate has already discarded individual request identity.',
        'Traces are good at explaining one request through services, spans, and timing. They are too detailed and expensive to replace metrics for alerting and dashboards. Exemplars exist to keep the metric aggregate while saving a bounded pointer to a representative trace.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious incident workflow is metric first and manual trace search second. An alert fires, an engineer opens the latency chart, guesses a time window, filters by service and route, then hunts for a trace that looks like the spike. This can work when traffic is low and traces are easy to search.',
        'Another tempting approach is to put trace_id directly into metric labels. That makes every request groupable in the metric store. It also turns the metric database into a per-request index, which is the wrong storage model.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The manual-search wall is loss of identity. The histogram knows that 450 observations landed in the 1.2 second bucket, but it normally does not keep the identities of those requests. The trace store may contain useful traces, but sampling and imperfect filters can hide the one that explains the bucket.',
        'The trace-id-label wall is cardinality. A time series is the metric name plus its label values, so a new trace_id per request creates a new series per request. A dashboard query that should read one histogram now fans out across thousands or millions of almost-empty series.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'An exemplar stores one selected observation beside the aggregate. For a histogram, the bucket count still aggregates many requests, while the exemplar stores value, timestamp, trace_id, and span_id for one request. The trace id is a join key, not an aggregate dimension.',
        'That separation preserves both systems. Metrics keep bounded labels such as route and status class. Traces keep request detail. The exemplar is the small bridge captured at observation time, when both the metric value and active span context are available.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A service handles a request while a tracing span is active. When instrumentation records latency into a histogram, the metrics library can read the current trace context. If the exemplar policy selects that observation, it stores the trace and span identifiers with the bucket sample.',
        'A dashboard later renders the histogram and marks buckets or points that have exemplars. Clicking the marker sends the trace_id and span_id to the trace backend. The user moves from aggregate symptom to one concrete span tree without searching from scratch.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness here means preserving a valid join without changing the metric meaning. The histogram count is still computed from all observations that match the normal labels. The exemplar adds a side record for one observation, so the aggregate result is not redefined by the trace id.',
        'The boundedness argument is the key safety property. If only a limited number of observations carry exemplar records, request identity does not explode the number of metric series. The link is useful because it is stored as a sample, not because every request became a dimension.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main cost is side-record storage and retention coordination. If a service records 10,000 latency observations per second but keeps exemplars for 1 percent, the exemplar path stores about 100 trace links per second rather than 10,000 new metric series. Doubling request traffic doubles candidate observations, but the exemplar policy can cap stored links.',
        'The operational cost is consistency between systems. Trace identifiers must propagate, dashboards must know how to open the trace backend, and trace retention must outlive the incident review window. A link to a deleted trace is a broken proof path.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Exemplars are useful for latency histograms, error dashboards, queue delay charts, RPC duration, database query timing, and SLO burn investigations. The access pattern is aggregate first, then one concrete request path that can explain a bucket. They are especially useful when slow or failed requests are rare enough that blind trace search wastes time.',
        'Prometheus, OpenMetrics, Grafana, and OpenTelemetry all treat exemplars as a bridge between metrics and traces. The useful deployment has reliable context propagation and a sampling policy that favors observations worth inspecting. Slow, failed, or rare requests usually deserve the small exemplar budget more than routine fast requests.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Exemplars fail when the trace is gone or inaccessible. A metric system may retain data for weeks while the trace backend keeps spans for days. After that boundary, the exemplar still marks an observation but cannot open the detailed path.',
        'They also fail when one trace is treated as the cause of the whole incident. An exemplar is an example, not a population proof. Engineers still need the metric distribution, labels, logs, deploy history, and multiple traces before assigning the cause of a spike.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Checkout serves 20,000 requests in five minutes. The latency histogram shows 600 requests above 900 ms, and exemplar sampling keeps 30 links from those slow buckets. One exemplar has value 1,240 ms, trace_id t-84, and span_id s-12.',
        'Clicking t-84 opens a trace where the payment span takes 910 ms because a fraud-check RPC waited on a queue. The metric still says the problem affected 600 requests, not just one. The trace gives the first concrete path to inspect, while the aggregate tells whether that path explains enough of the tail.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are Prometheus exemplar documentation at https://prometheus.io/docs/prometheus/latest/feature_flags/, Grafana exemplar documentation at https://grafana.com/docs/grafana/latest/fundamentals/exemplars/, and OpenTelemetry Prometheus/OpenMetrics compatibility at https://opentelemetry.io/docs/specs/otel/compatibility/prometheus_and_openmetrics/. Use these sources for mechanism claims before relying on secondary summaries.',
        'Study Distributed Tracing, OpenTelemetry Tail Sampling Policy, Metric Label Cardinality Control, Prometheus TSDB, DDSketch Relative-Error Quantiles, and SLO Error Budget Burn Rate Alert next. Start with the topic that explains the data shape, then move to the production system.',
      ],
    },
  ],
};