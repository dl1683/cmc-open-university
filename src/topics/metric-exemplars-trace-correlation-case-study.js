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
      heading: 'What it is',
      paragraphs: [
        'Metric exemplars attach a small reference to a specific observation inside an aggregate metric, commonly a histogram bucket. The reference often contains a trace ID and span ID so an engineer can jump from a p99 bucket to one concrete distributed trace.',
        'Prometheus describes exemplars as references to data outside the metric set, with trace IDs as a common use case: https://prometheus.io/docs/prometheus/latest/feature_flags/. Grafana explains exemplars as a way to isolate latency problems by pinpointing query traces inside a time interval: https://grafana.com/docs/grafana/latest/fundamentals/exemplars/.',
      ],
    },
    {
      heading: 'Core data structure',
      paragraphs: [
        'A histogram bucket stores counts for many observations. An exemplar stores a bounded sample attached to one observation: timestamp, value, and a small label set such as trace_id and span_id. It is not a new time series per trace.',
        'OpenTelemetry compatibility rules say that, when present, trace ID and span ID are added as Prometheus exemplar labels with trace_id and span_id keys: https://opentelemetry.io/docs/specs/otel/compatibility/prometheus_and_openmetrics/.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Checkout latency p99 jumps above the SLO. The metrics dashboard shows the request-duration histogram and exemplar dots in the 900 ms bucket. An engineer clicks one exemplar, opens the trace by trace_id, and sees payments waiting on fraud-check. The team moves from aggregate alert to concrete trace without searching logs by hand.',
        'The platform stores exemplars only on selected latency histograms, keeps trace/span identifiers, samples slow observations preferentially, and aligns trace retention with exemplar retention so dashboard links remain valid.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Exemplars do not replace tracing, metrics, or logs. They connect them. Metrics still alert and aggregate. Traces still explain path shape. Exemplars provide clickable bridges between the two.',
        'Do not attach user IDs, tokens, emails, or large baggage values as exemplar labels. The exemplar should identify the trace, not duplicate the trace payload or create a privacy issue.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Prometheus feature flags for exemplar storage at https://prometheus.io/docs/prometheus/latest/feature_flags/, Grafana exemplars at https://grafana.com/docs/grafana/latest/fundamentals/exemplars/, and OpenTelemetry Prometheus/OpenMetrics compatibility at https://opentelemetry.io/docs/specs/otel/compatibility/prometheus_and_openmetrics/.',
        'Study next: Distributed Tracing for the target trace tree, OpenTelemetry Tail Sampling Policy for which traces exist, Metric Label Cardinality Control for label limits, Prometheus TSDB Case Study for metric storage, DDSketch Relative-Error Quantiles for approximate latency distributions, and SLO Error Budget Burn Rate Alert for the alert-to-debug workflow.',
      ],
    },
  ],
};
