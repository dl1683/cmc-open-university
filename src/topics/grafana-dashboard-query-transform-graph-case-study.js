// Grafana dashboards: panels query data sources, transform data frames, render
// visualizations, and link metrics to logs, traces, and alerts.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'grafana-dashboard-query-transform-graph-case-study',
  title: 'Grafana Dashboard Query Transform Graph Case Study',
  category: 'Systems',
  summary: 'A dashboard data-flow primer: variables, panels, data-source queries, transformations, data frames, thresholds, exemplars, links, and alert boundaries.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['panel graph', 'dashboard ops'], defaultValue: 'panel graph' },
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

function grafanaGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'dash', label: 'dash', x: 0.7, y: 3.8, note: notes.dash ?? 'layout' },
      { id: 'var', label: 'var', x: 2.2, y: 2.0, note: notes.var ?? 'filter' },
      { id: 'panel', label: 'panel', x: 2.2, y: 5.6, note: notes.panel ?? 'view' },
      { id: 'query', label: 'query', x: 3.95, y: 3.8, note: notes.query ?? 'PromQL' },
      { id: 'ds', label: 'src', x: 5.55, y: 2.0, note: notes.ds ?? 'data' },
      { id: 'frame', label: 'frame', x: 5.55, y: 5.6, note: notes.frame ?? 'table' },
      { id: 'xform', label: 'xfm', x: 7.2, y: 3.8, note: notes.xform ?? 'transform' },
      { id: 'viz', label: 'viz', x: 9.0, y: 3.8, note: notes.viz ?? 'chart' },
    ],
    edges: [
      { id: 'e-dash-var', from: 'dash', to: 'var', weight: '' },
      { id: 'e-dash-panel', from: 'dash', to: 'panel', weight: '' },
      { id: 'e-var-query', from: 'var', to: 'query', weight: '' },
      { id: 'e-panel-query', from: 'panel', to: 'query', weight: '' },
      { id: 'e-query-ds', from: 'query', to: 'ds', weight: '' },
      { id: 'e-ds-frame', from: 'ds', to: 'frame', weight: '' },
      { id: 'e-frame-xform', from: 'frame', to: 'xform', weight: '' },
      { id: 'e-xform-viz', from: 'xform', to: 'viz', weight: '' },
    ],
  }, { title });
}

function* panelGraph() {
  yield {
    state: grafanaGraph('A panel is a query-transform-render pipeline'),
    highlight: { active: ['dash', 'panel', 'query', 'ds', 'frame', 'xform', 'viz', 'e-panel-query', 'e-query-ds', 'e-ds-frame', 'e-frame-xform', 'e-xform-viz'], compare: ['var'] },
    explanation: 'A Grafana dashboard is a set of panel pipelines. Each pipeline runs data-source queries, receives data frames, applies transformations, then renders fields with thresholds, units, legends, and links.',
  };
  yield {
    state: labelMatrix('Panel', [
      { id: 'var', label: 'var' },
      { id: 'query', label: 'query' },
      { id: 'frame', label: 'frame' },
      { id: 'xfm', label: 'xfm' },
      { id: 'viz', label: 'viz' },
    ], [
      { id: 'role', label: 'role' },
      { id: 'risk', label: 'risk' },
    ], [
      ['filter', 'wide'],
      ['fetch', 'cost'],
      ['shape', 'join'],
      ['derive', 'hide'],
      ['show', 'lie'],
    ]),
    highlight: { active: ['query:role', 'frame:role', 'xfm:role'], compare: ['viz:risk'] },
    explanation: 'The data structures are explicit: variables parameterize queries, data sources return frames, transformations reshape frames, and visualizations map fields to pixels. The chart inherits every mistake in that upstream graph.',
  };
  yield {
    state: grafanaGraph('Exemplars and links connect metrics to traces and logs', { frame: 'series', xform: 'links', viz: 'drill' }),
    highlight: { active: ['frame', 'xform', 'viz', 'e-frame-xform', 'e-xform-viz'], found: ['query', 'ds'] },
    explanation: 'A mature dashboard is not an end point. Exemplars, data links, and trace links let an operator jump from a p99 panel to the concrete trace, log line, or deployment revision behind the spike.',
  };
  yield {
    state: labelMatrix('Case', [
      { id: 'slo', label: 'SLO' },
      { id: 'lat', label: 'p99' },
      { id: 'err', label: 'err' },
      { id: 'cost', label: 'cost' },
    ], [
      { id: 'src', label: 'src' },
      { id: 'link', label: 'link' },
    ], [
      ['prom', 'rule'],
      ['hist', 'trace'],
      ['logs', 'span'],
      ['bill', 'tag'],
    ]),
    highlight: { active: ['lat:link', 'err:link', 'cost:link'], compare: ['slo:src'] },
    explanation: 'Complete case study: a rollout dashboard shows SLO burn, p99 latency, error logs, and inference cost. Each panel links to the specific traces, labels, and deployment revisions needed to decide promote, hold, or rollback.',
  };
}

function* dashboardOps() {
  yield {
    state: grafanaGraph('Dashboard variables can amplify query cost and cardinality', { var: 'tenant', query: 'fanout', ds: 'Prom' }),
    highlight: { active: ['var', 'query', 'ds', 'e-var-query', 'e-query-ds'], compare: ['viz'] },
    explanation: 'Variables make dashboards reusable, but they also expand query cost. A multi-select tenant or pod variable can produce wide PromQL matchers and large result frames.',
  };
  yield {
    state: labelMatrix('Ops', [
      { id: 'var', label: 'var' },
      { id: 'time', label: 'time' },
      { id: 'step', label: 'step' },
      { id: 'cache', label: 'cache' },
    ], [
      { id: 'knob', label: 'knob' },
      { id: 'bad', label: 'bad' },
    ], [
      ['scope', 'all'],
      ['range', 'huge'],
      ['res', 'slow'],
      ['TTL', 'stale'],
    ]),
    highlight: { active: ['var:knob', 'time:knob', 'step:knob'], compare: ['cache:bad'] },
    explanation: 'Operational dashboard design is query planning under stress. Variable scope, time range, resolution step, transformations, and cache TTL decide whether the dashboard helps during an incident or overloads the backend.',
  };
  yield {
    state: grafanaGraph('Alerting and dashboards share queries but not always transforms', { panel: 'alert?', xform: 'UI only', viz: 'human' }),
    highlight: { active: ['query', 'ds', 'frame', 'xform', 'viz'], compare: ['panel'] },
    explanation: 'Dashboard transformations are excellent for visualization, but alert evaluation often runs under stricter backend rules. Do not assume a visual panel transform is the same contract as an alert rule.',
  };
  yield {
    state: labelMatrix('Bad', [
      { id: 'red', label: 'red' },
      { id: 'avg', label: 'avg' },
      { id: 'unit', label: 'unit' },
      { id: 'own', label: 'own' },
    ], [
      { id: 'bug', label: 'bug' },
      { id: 'fix', label: 'fix' },
    ], [
      ['color', 'label'],
      ['mean', 'p99'],
      ['wrong', 'unit'],
      ['none', 'owner'],
    ]),
    highlight: { active: ['avg:fix', 'unit:fix', 'own:fix'], compare: ['red:bug'] },
    explanation: 'Dashboard case study: a latency panel averages away tail pain, a unit mismatch hides a 1000x scale error, and no owner means no one fixes it. The repair is p99 panels, unit discipline, and owner metadata.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'panel graph') yield* panelGraph();
  else if (view === 'dashboard ops') yield* dashboardOps();
  else throw new InputError('Pick a Grafana dashboard view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Operators do not need dashboards because lines are pretty. They need dashboards because raw telemetry is too large to inspect during an incident. A good dashboard reduces logs, metrics, traces, and deployment metadata into a few decision paths: healthy or not, where to drill, what changed, and who owns the next move.',
        'The useful mental model is a query-transform graph. A dashboard holds variables and panels. A panel runs data-source queries. The data source returns frames. Transformations reshape fields. The visualization maps fields to pixels, thresholds, links, exemplars, and actions. If that graph is wrong, the chart is wrong even when it looks polished.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious dashboard is a wall of graphs. Put CPU, memory, latency, request rate, error count, queue depth, and cost on one page. Add red and green thresholds. Let an operator scan it.',
        'That works while the system is small and the reader already knows the service. It fails when the operator needs causality. Averages hide tail latency, wrong units hide scale errors, variables fan out into expensive queries, and panels without links strand the responder at the summary layer.',
        'The wall is structural. A dashboard made of disconnected pictures cannot answer "what produced this pixel?" or "where should I go next?" A useful dashboard preserves provenance and drill-down edges.',
      ],
    },
    {
      heading: 'Core idea',
      paragraphs: [
        'Treat every panel as a small data pipeline. Variables define scope. Queries fetch raw series, tables, logs, or traces from Prometheus, Loki, Tempo, SQL, cloud APIs, or another source. Grafana receives data frames. Transformations rename, join, filter, calculate, organize, or reshape fields. The visualization encodes the resulting fields for a human.',
        'The invariant is provenance: a reader should be able to trace a visible value back to its query, source frame, transform chain, unit, labels, and time range. If that chain is visible, the dashboard can support decisions. If it is hidden, the dashboard becomes decoration.',
      ],
    },
    {
      heading: 'Reading the visualization',
      paragraphs: [
        'In the panel-graph view, follow the arrows from dashboard to panel to query to data source to frame to transform to visualization. The key transition is not the final chart. It is the moment raw source data becomes a frame with fields that Grafana can transform and render.',
        'The variable node is deliberately separate. A service, tenant, region, or pod variable can make one dashboard reusable, but it can also multiply query cost and cardinality. When the variable edge lights up, ask whether the selector narrows the question or explodes the backend work.',
        'The exemplar and link frames show the escape path from summary to evidence. A p99 spike is not enough by itself. The useful dashboard carries the trace id, log query, deployment revision, owner, or runbook link that lets a responder inspect the concrete request behind the aggregate.',
        'In the dashboard-ops view, the alert boundary matters. Visual panel transformations are for the rendered panel. Alert rules need backend queries, expressions, conditions, and evaluation intervals that match the alerting contract. Do not assume that a panel-looking calculation is automatically the rule that will page someone.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A dashboard starts with scope: time range, template variables, repeated rows, and panel layout. Each panel owns one or more queries. Query results are normalized into data frames with fields, values, labels, and metadata. Grafana transformations then operate on those frames before the visualization is applied.',
        'Common transformations are simple but dangerous: join two query results, calculate a derived field, filter rows, reduce a time series to one value, organize columns, or convert labels into fields. Each step can remove context. If a transform drops the service label, the final chart may show an error spike without an owner.',
        'Mature dashboards add navigation edges. Data links preserve context when moving to another dashboard or external resource. Exemplars connect a metric point to a trace id. Trace views expose spans, attributes, events, logs, metrics, and profiles. Those links are what turn a status board into an investigation surface.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'A dashboard works when its visual encoding matches the operational question. If the question is tail latency, use histogram buckets or percentiles, not an average. If the question is rollout health, keep version, cluster, and route labels. If the question is ownership, keep team or service metadata all the way to the panel.',
        'The correctness argument is a provenance argument. The panel is trustworthy only if the query answers the intended question, the transform preserves the fields needed for interpretation, the unit and threshold match the data, and the link points to the next evidence layer.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A rollout dashboard for an inference service might have four top panels: SLO burn, p99 latency, error rate by route, and cost per 1,000 tokens. The SLO panel reads recording rules from Prometheus or Mimir. The latency panel uses histogram quantiles. The error panel keeps route and model-version labels. The cost panel joins usage data with billing tags.',
        'When p99 rises after a canary, the dashboard should show more than a red line. The point should link to traces for slow requests, logs for error bursts, and the deployment revision that introduced the change. That path lets the operator decide promote, hold, or rollback instead of staring at four disconnected charts.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Dashboard cost is query cost plus transform cost plus human scan cost. Time range, step size, variable fanout, panel count, data-source limits, cache TTL, browser-side work, and refresh interval all matter. A harmless all-tenants variable on a quiet day can overload a backend during an incident when everyone opens the same page.',
        'Reuse has a tax. Variables make one dashboard serve many services, but they can hide service-specific context. Transformations make panels flexible, but complicated transform chains can diverge from alerting expressions or recording rules. Caches reduce load, but stale panels can mislead responders.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Grafana is strongest when many signals need to answer one operational question: rollout health, SLO burn, capacity saturation, cost by tenant, service overview, queue backlog, or incident triage. It works especially well when labels, exemplars, data links, and trace/log/profile integrations connect the summary to the evidence.',
        'It also fits teams with heterogeneous data sources. The dashboard can put Prometheus metrics, Loki logs, Tempo traces, SQL tables, cloud billing, and annotation data into one investigation path as long as the frame shape and labels stay coherent.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A dashboard is the wrong tool for enforcing a system invariant by itself. Alerting needs explicit rules, evaluation intervals, conditions, labels, annotations, and notification routing. A panel can help humans understand a state; it should not be the only contract for paging or automated action.',
        'Dashboards fail when they average away spikes, mix units, drop labels, hide owner metadata, depend on stale recording rules, fan out through unbounded variables, or stop at the chart with no drill-down path. A broken dashboard is worse than no dashboard because it gives confidence without evidence.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Grafana dashboard docs at https://grafana.com/docs/grafana/latest/visualizations/dashboards/, transform docs at https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/query-transform-data/transform-data/, server-side expression docs at https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/query-transform-data/expression-queries/, data links docs at https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/configure-data-links/, exemplars docs at https://grafana.com/docs/grafana/latest/fundamentals/exemplars/, trace integration docs at https://grafana.com/docs/grafana/latest/visualizations/explore/trace-integration/, Grafana data-plane docs at https://grafana.com/developers/dataplane/, and alert-rule docs at https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rules/.',
        'Study Prometheus Rule Evaluation Alert State Machine for backend rule semantics, Alertmanager Routing and Inhibition Tree for notification routing, Metric Label Cardinality Control for variable fanout, Prometheus TSDB Case Study for what metric queries read, Distributed Tracing for drill-down, OpenTelemetry Collector for signal ingestion, and Flagger Progressive Delivery Canary for rollout dashboards.',
      ],
    },
  ],
};
