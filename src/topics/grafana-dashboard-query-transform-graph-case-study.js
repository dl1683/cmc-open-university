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
    explanation: 'A Grafana dashboard is a set of panels. Each panel runs one or more data-source queries, receives data frames, applies transformations, then renders a visualization with thresholds, units, legends, and links.',
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
    explanation: 'The data structures are explicit: variables parameterize queries, data sources return frames, transformations reshape frames, and visualizations map fields to pixels. A nice graph can still lie if the upstream query or transform is wrong.',
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
    explanation: 'Operational dashboard design is query planning. Variable scope, time range, resolution step, transformations, and cache TTL can make a dashboard useful or make the backend fall over during an incident.',
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
    { heading: 'What it is', paragraphs: [
      'A Grafana dashboard is a set of panels that query, transform, visualize, and link data. The data-structure lesson is a graph from dashboard variables to panel queries, data sources, data frames, transformations, visual encodings, thresholds, annotations, exemplars, and links.',
      'Primary sources: Grafana dashboards docs at https://grafana.com/docs/grafana/latest/visualizations/dashboards/, query and transform docs at https://grafana.com/docs/grafana/latest/panels-visualizations/query-transform-data/, and Grafana alerting docs at https://grafana.com/docs/grafana/latest/alerting/.',
    ] },
    { heading: 'Panel pipeline', paragraphs: [
      'A panel starts with queries against data sources such as Prometheus, Loki, Tempo, SQL, or cloud monitoring APIs. Results arrive as data frames. Transformations join, filter, organize, calculate, or reshape frames. The visualization maps fields to lines, bars, tables, gauges, heatmaps, or logs.',
      'This links to Prometheus Rule Evaluation, Prometheus TSDB, OpenTelemetry Semantic Convention Schema, Metric Exemplars Trace Correlation, and Distributed Tracing. Dashboards are only useful when their labels and links connect signals instead of leaving operators at a dead end.',
    ] },
    { heading: 'Operational cost', paragraphs: [
      'Dashboard design is query planning under incident pressure. Time range, step size, variable fanout, panel count, transformation cost, and data-source limits all matter. An all-tenants variable may be fine at noon and destructive during an outage when everyone opens the same dashboard.',
    ] },
    { heading: 'Complete case study: rollout decision board', paragraphs: [
      'A rollout board shows canary traffic weight, SLO burn, p99 latency, error rate, cost, saturation, deployment revision, and recent traces. The p99 panel uses histogram metrics with exemplars. The error panel links to logs. The cost panel groups by model and tenant. The revision annotation links back to Argo CD and Flagger decisions.',
    ] },
    { heading: 'Pitfalls and misconceptions', paragraphs: [
      'A dashboard is not automatically an alert. A visual transformation may not be available in backend alert evaluation. A chart can hide spikes with averages, wrong units, bad time ranges, or missing labels. Pretty panels do not compensate for missing ownership, weak links, or stale recording rules.',
    ] },
    { heading: 'Study next', paragraphs: [
      'Study Prometheus Rule Evaluation Alert State Machine, Alertmanager Routing & Inhibition Tree, Metric Exemplars Trace Correlation, Metric Label Cardinality Control, Prometheus TSDB Case Study, Distributed Tracing, and Flagger Progressive Delivery Canary next.',
    ] },
  ],
};
