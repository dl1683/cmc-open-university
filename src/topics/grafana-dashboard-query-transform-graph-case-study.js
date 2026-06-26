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
      heading: 'How to read the animation',
      paragraphs: [
        'Read a Grafana panel as a query-transform-render pipeline. Variables set scope, queries fetch data, data frames carry typed fields, transformations reshape those frames, and the visualization maps final fields to pixels.',
        'The safe inference is provenance: a visible value is trustworthy only if the operator can trace it back through time range, variable values, query, returned frame, transform chain, unit, threshold, and data link.',
        {type:'callout', text:'A Grafana panel is trustworthy only when every visible value can be traced from variable scope through query, frame, transform, and visualization.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Production systems emit metrics, logs, traces, and profiles faster than humans can inspect. A dashboard exists to turn those raw signals into a small set of operational decisions: is the system healthy, where is it failing, and where should the operator look next.',
        'Grafana matters because a panel is not just a picture. It is a data pipeline whose intermediate objects and transformations decide whether the picture preserves the facts an on-call engineer needs.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious dashboard is a wall of graphs: CPU, memory, request rate, average latency, error count, and queue depth. Add red and green thresholds, refresh every 30 seconds, and let the operator scan the page.',
        'That works for a small service known by its authors. It fails when labels, routes, versions, tenants, and data sources multiply, because the chart can look clean while hiding the context that explains the incident.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that a graph can be visually correct and operationally wrong. An average latency panel can show 70 ms while p99 latency is 5 seconds, or a transform can drop the route label that would identify the broken endpoint.',
        'Dashboard cost also becomes a wall. Thirty panels with two queries each produce sixty queries per refresh, and during an incident fifty engineers opening the same page can turn that into thousands of backend queries per minute.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat every panel as a dataflow graph with a provenance invariant. Every displayed value should map back to source, time range, labels, unit, transformation, and visualization rule.',
        'The central data structure is the data frame. A frame is a typed table of fields, values, labels, and metadata that lets Prometheus, Loki, Tempo, SQL, and plugin results pass through a common transform and render pipeline.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'When a dashboard loads, Grafana evaluates template variables and the selected time range. Each panel dispatches one or more data-source queries, receives one or more data frames, then applies transformations such as join, reduce, filter, calculate, organize, or rename.',
        'The visualization reads the final frames and applies units, axes, thresholds, legends, tooltips, data links, and exemplars. A data link carries field values into another system, such as a trace search or log query.',
        'Alert rules are a special boundary. Browser-side panel transformations do not automatically define server-side alert evaluation, so the dashboard and the alert can diverge if the team does not audit both paths.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The design works because it separates fetch, reshape, and render. A query answers what data should be read, a transform changes frame shape, and a visualization decides how the final fields become a human display.',
        'Correctness is a provenance argument. If the query asks for p99 rather than average, the transform preserves service and route labels, the unit is correct, and the data link carries the same context to traces or logs, the operator can move from chart to evidence.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Query cost grows with time range, series cardinality, step resolution, variable fanout, and panel count. Doubling a time range often doubles the samples scanned, while halving the step can double the points returned to the browser.',
        'Transform cost appears after data returns. Joining two 10,000-row frames can freeze a browser if the transform is not indexed well, and repeated reductions can hide the very labels needed for diagnosis.',
        'Human cost is part of the system. A dashboard that requires five manual tab switches and copied labels may be cheap for the database but expensive during a five-minute incident decision.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Grafana fits rollout health, SLO burn dashboards, capacity planning, incident triage, cost-by-tenant views, queue backlog monitoring, and mixed metrics-logs-traces investigations. It is strongest when labels connect summary panels to evidence layers.',
        'A good rollout dashboard preserves version, route, service, and tenant labels through every panel. That lets a p99 spike link to a trace, an error bar link to filtered logs, and a cost change link to billing detail.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when panels summarize away the diagnostic key. Average latency, missing units, hidden labels, stale variables, broken data links, and browser-only transforms can make a dashboard look polished while sending the operator in the wrong direction.',
        'It also fails when dashboard load harms the observability backend. An all-tenant variable with auto-refresh may be harmless on a quiet day and damaging during a major incident when many engineers open it at once.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a canary deploy sends model version v2.3 to 5 percent of traffic at 14:00. A p99 panel uses histogram_quantile by model_version and shows v2.3 at 800 ms at 14:12 while v2.2 stays at 120 ms.',
        'The panel preserves model_version and route labels, so an exemplar link opens a trace with trace_id abc123. The trace shows tokenization taking 650 ms, and a linked Loki query for route /generate and version v2.3 shows 4 percent 500s with OOM messages.',
        'The cost behavior is visible too. If the dashboard has 24 panels, each with two queries, and refreshes every 15 seconds, one open tab issues 192 queries per minute; twenty incident tabs issue 3,840 queries per minute before Explore clicks are counted.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary references are Grafana dashboard documentation at https://grafana.com/docs/grafana/latest/dashboards/, transformation docs at https://grafana.com/docs/grafana/latest/panels-visualizations/query-transform-data/transform-data/, expression query docs at https://grafana.com/docs/grafana/latest/panels-visualizations/query-transform-data/expression-queries/, data-link docs at https://grafana.com/docs/grafana/latest/panels-visualizations/configure-data-links/, and the Grafana data-plane material at https://grafana.com/developers/dataplane/.',
        'Study Prometheus TSDB, metric cardinality control, recording rules, SLO burn-rate policy, alert routing, distributed tracing, OpenTelemetry Collector pipelines, and progressive delivery dashboards next.',
      ],
    },
  ],
};
