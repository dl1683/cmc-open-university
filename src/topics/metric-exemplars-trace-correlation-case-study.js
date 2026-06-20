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
      heading: 'Why This Exists',
      paragraphs: [
        'Metrics are excellent at telling you that something changed. A latency histogram can show that checkout p99 jumped. It cannot, by itself, show which request caused one of those slow observations or what happened inside that request.',
        'Traces are excellent at explaining one request. They are too expensive and too detailed to replace aggregate metrics. Metric exemplars exist to connect the two: keep the metric aggregated, but attach a bounded pointer from an interesting observation to one concrete trace or span.',
        {type:'callout', text:'Exemplars preserve one trace join key at metric observation time, giving aggregate histograms a bounded path back to concrete requests.'},
      ],
    },
    {
      heading: 'The Obvious Approach and the Wall',
      paragraphs: [
        'The obvious incident workflow is metric first, then manual search. An alert fires, an engineer opens a dashboard, guesses a time window, searches traces and logs, filters by service, filters by route, and hopes one of the remaining traces represents the bad bucket.',
        'That breaks during real incidents. The slow bucket may contain thousands of requests, tracing may be sampled, clocks may be imperfect, and the most useful trace may be hard to find by search. The metric knows which observations were slow, but it normally throws away their identities when it aggregates counts.',
      ],
    },
    {
      heading: 'The Core Insight',
      paragraphs: [
        'An exemplar is a sample attached to a metric observation, not a new metric dimension. For a histogram, the bucket count still aggregates many observations. The exemplar stores a small record for one selected observation: value, timestamp, and labels such as trace_id and span_id.',
        'That distinction is the whole design. Trace ids are dangerous as metric labels because they create huge cardinality. As exemplar labels, they remain bounded samples. The metric store gets a clickable bridge without becoming a trace database.',
      ],
    },
    {
      heading: 'What the views teach',
      paragraphs: [
        'In the histogram link view, follow one request as it produces both span context and a latency observation. The latency increments a histogram bucket. The active span supplies the trace and span identifiers. The exemplar connects the bucket to the trace backend through those ids.',
        'In the storage limits view, watch what is intentionally not stored. The exemplar should carry enough to open the trace, not user data, arbitrary baggage, raw payloads, or a label set that grows with every request. The budget is what keeps the pattern safe.',
        'The useful mental model is a join between two observability tables. The metric side has time, labels, bucket, and count. The tracing side has a span tree. The exemplar is the small join key stored at the moment the observation is recorded, so the dashboard can move from rate and percentile shape to one request path without a blind search.',
      ],
    },
    {
      heading: 'How It Works',
      paragraphs: [
        'A service handles a request while a trace span is active. It records a latency measurement into a histogram. At exemplar selection time, the metrics library can attach the current trace context to that specific observation. The histogram bucket count increases as usual, and the exemplar is stored as a small side record.',
        'The dashboard later renders the histogram and marks buckets or points that have exemplars. When an engineer clicks one, the UI uses trace_id and span_id to open the trace backend. Prometheus-style exemplars and OpenTelemetry compatibility rules commonly use trace_id and span_id as the bridge labels.',
        'Sampling policy decides which observations get exemplar records. Some systems attach exemplars to rare or slow observations. Others sample periodically. The right policy depends on the question the dashboard should answer.',
        'Instrumentation placement matters. If middleware records latency after the active span has ended, the metric may have no trace context to attach. If the trace context is not propagated across services, the exemplar may open only a partial path. The metric call, span lifecycle, and propagation layer have to agree on the request identity.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'Metrics and traces have complementary failure modes. Metrics are cheap and stable but abstract. Traces are concrete but sparse and high volume. Exemplars work because they preserve one join key at the exact moment an observation enters the aggregate.',
        'The bounded side record avoids the cardinality trap. A histogram labeled with trace_id would create a new series for almost every request. A histogram with exemplars still has the same normal labels and buckets; only a limited number of observations carry trace references.',
      ],
    },
    {
      heading: 'Worked Example',
      paragraphs: [
        'Checkout latency p99 rises above the SLO. The on-call opens the request-duration histogram and sees exemplar dots in the 900 ms and 1.2 s buckets. One dot carries trace_id and span_id. Clicking it opens the trace for a slow checkout request, where the payment span waits on a fraud-check service.',
        'The team moves from aggregate symptom to concrete path in one click. The metric still answers how often the problem happens and whether it burns the SLO. The trace answers what one representative slow request did. Logs can still help, but they are no longer the first search surface.',
      ],
    },
    {
      heading: 'Costs and Tradeoffs',
      paragraphs: [
        'Exemplars add storage and UI complexity, but the main cost is policy. The platform has to decide which metrics support exemplars, which observations are worth sampling, how long exemplar links should live, and whether trace retention overlaps metric retention.',
        'Label discipline is non-negotiable. trace_id and span_id are useful because they join to another system. User ids, emails, tokens, request bodies, and arbitrary baggage values are not exemplar labels. They create privacy risk, cardinality risk, and dashboard clutter.',
        'The choice of sampling target changes what engineers see. Sampling only the slowest observations gives better p99 debugging but may miss typical traces. Uniform sampling gives a fairer shape but may waste the small exemplar budget on uninteresting requests. Many teams use different policies for latency, error, saturation, and business-flow dashboards.',
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        'Exemplars win for latency histograms, SLO dashboards, p99 and p999 investigations, queue delay, database query duration, RPC duration, and any aggregate symptom where one concrete trace can quickly expose the path shape.',
        'They are strongest when trace context is reliably propagated, the trace backend can resolve ids from the dashboard, and sampling policy prefers interesting observations such as slow, failed, or rare requests.',
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        'They fail when the trace is gone. If metrics retain exemplar references longer than the tracing backend retains the corresponding spans, dashboard links turn into dead ends. Retention windows and sampling policy have to be designed together.',
        'They also fail when teams confuse exemplars with full causality. One trace is an example, not a proof of the whole incident. The metric still has to quantify blast radius, and multiple exemplars may be needed to show that a bucket contains more than one failure mode.',
        'They can mislead when sampling is biased. A slow exemplar from one customer path may look like the reason for the whole p99 spike even if most slow requests took a different path. Treat exemplars as entry points, then compare several traces, metric labels, logs, and recent deploys before calling the cause.',
      ],
    },
    {
      heading: 'Operational Guidance',
      paragraphs: [
        'Start with request-duration histograms on service boundaries, queue wait time, database calls, and outbound RPC clients. Add exemplars where a concrete trace is likely to answer the next question. Do not turn on exemplar storage everywhere before the dashboard and trace-backend links are tested.',
        'Run a privacy review on exemplar labels just as you would for normal metric labels. Confirm that dashboards hide or restrict trace identifiers when needed, that trace links respect access control, and that trace retention is long enough for the alert review window. A useful exemplar system is boring during incidents: dots appear, links open, and stale references are rare.',
      ],
    },
    {
      heading: 'Common Misconceptions',
      paragraphs: [
        'An exemplar is not a log line. It should not duplicate request payload or human-readable context. It is a pointer to where that detail lives. An exemplar is also not a replacement for tracing. If no trace exists, the link has nowhere to go.',
        'It is not a fix for bad metric labels either. Route, method, status class, and service labels still need normal cardinality control. Exemplars solve the jump from aggregate bucket to concrete request, not the design of the metric itself.',
      ],
    },
    {
      heading: 'Sources and Study Next',
      paragraphs: [
        'Primary sources: Prometheus exemplar feature documentation at https://prometheus.io/docs/prometheus/latest/feature_flags/, Grafana exemplars at https://grafana.com/docs/grafana/latest/fundamentals/exemplars/, and OpenTelemetry Prometheus/OpenMetrics compatibility at https://opentelemetry.io/docs/specs/otel/compatibility/prometheus_and_openmetrics/. Study Distributed Tracing, OpenTelemetry Tail Sampling Policy, Metric Label Cardinality Control, Prometheus TSDB Case Study, DDSketch Relative-Error Quantiles, and SLO Error Budget Burn Rate Alert next.',
      ],
    },
  ],
};
