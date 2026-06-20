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
        'The animation has two views. "Panel graph" traces the data-flow pipeline inside a single Grafana panel: dashboard scope, variable injection, query dispatch, data-source fetch, frame return, transformation, and visualization. "Dashboard ops" exposes the operational knobs that decide whether that pipeline helps during an incident or overloads the metrics backend.',
        {type:'callout', text:'A Grafana panel is trustworthy only when every visible value can be traced from variable scope through query, frame, transform, and visualization.'},
        {
          type: 'bullets',
          items: [
            'Active nodes are the current pipeline stage: which query is running, which transform is reshaping fields, or which visualization is rendering.',
            'Compare nodes highlight the consumer or cost side: variable fanout, cache staleness, or alert boundary mismatch.',
            'Found nodes mark confirmed outcomes: a query result returned, a link resolved, or a data frame joined.',
          ],
        },
        'In the matrix views, rows are pipeline components (variable, query, frame, transform, viz) and columns are properties (role, risk, knob, or fix). Watch the risk column: every stage can silently corrupt the panel if it drops a label, averages away a spike, or applies the wrong unit.',
        {
          type: 'note',
          text: 'The animation uses a simplified 8-node graph. A production dashboard may have 30 panels, each with multiple queries, chained transformations, mixed data sources, repeated rows for each variable value, and data links connecting panels to external trace or log views. The pipeline structure is the same -- scope, fetch, reshape, render -- but the blast radius of a bad variable or a dropped label scales with panel count.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'Grafana allows you to query, visualize, alert on, and understand your metrics no matter where they are stored.',
          attribution: 'Grafana Labs, official documentation',
        },
        'A production system emits millions of metric samples, log lines, trace spans, and profiling frames per minute. No human can scan raw telemetry during an incident. The operator needs a surface that reduces those signals into a few decision paths: is the system healthy, where is it degrading, what changed, and who owns the next action.',
        {
          type: 'diagram',
          text: [
            'The reduction problem:',
            '',
            '  raw signals                      |  operator needs',
            '  ----------------------------------|----------------------------------',
            '  10M metric samples/min            |  3 panels: latency, errors, SLO',
            '  500K log lines/min                |  1 filtered log view per service',
            '  200K trace spans/min              |  exemplar links on p99 spikes',
            '  15 data sources (Prom, Loki, ...) |  1 investigation surface',
            '',
            '  The dashboard is a query-transform graph that',
            '  maps raw telemetry to human decisions.',
          ].join('\n'),
          label: 'Dashboards exist because raw telemetry is too large to scan during an incident',
        },
        'Grafana solves this by modeling each panel as a small data pipeline. Variables set scope. Queries fetch time series, tables, logs, or traces from one or more data sources. Results arrive as data frames -- columnar tables with typed fields, labels, and metadata. Transformations reshape those frames. The visualization maps the final fields to pixels, thresholds, colors, links, and actions. If any stage in that pipeline is wrong, the chart lies even when it looks polished.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first dashboard every team builds is a wall of graphs. Put CPU utilization, memory usage, request rate, p50 latency, error count, and queue depth in six panels on one page. Add red and green thresholds. Set auto-refresh to 30 seconds. Let the on-call engineer scan it.',
        {
          type: 'table',
          headers: ['Panel', 'Query', 'Why it seems sufficient'],
          rows: [
            ['CPU', 'avg(rate(cpu_seconds_total[5m]))', 'Shows whether the service is compute-bound'],
            ['Memory', 'container_memory_rss', 'Shows whether the service is near its memory limit'],
            ['Request rate', 'rate(http_requests_total[5m])', 'Shows traffic volume'],
            ['Latency', 'avg(http_request_duration_seconds)', 'Shows response speed'],
            ['Errors', 'sum(rate(http_requests_total{code=~"5.."}[5m]))', 'Shows failure rate'],
            ['Queue depth', 'queue_length', 'Shows backlog'],
          ],
        },
        'This works when the system is small and the reader already knows the service. The team wrote those panels, they know what "normal" looks like, and the six graphs give a fast status check.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall-of-graphs approach breaks in three specific ways when the system grows or the reader is not the author.',
        {
          type: 'table',
          headers: ['Failure mode', 'Mechanism', 'Consequence'],
          rows: [
            ['Averages hide tails', 'avg() latency panel shows 50ms while p99 is 2s', 'On-call sees green, users experience timeouts; the dashboard creates false confidence'],
            ['Labels are dropped', 'sum() without by(route, version) collapses all routes into one line', 'An error spike in /checkout is invisible because /healthcheck dilutes the rate'],
            ['No drill-down path', 'Panel shows a red spike but has no data link to traces or logs', 'Operator stares at the chart, opens a new tab, manually reconstructs the query in Explore'],
            ['Variable fanout', 'Multi-select tenant variable expands to 200 PromQL matchers', 'Dashboard load during an incident overloads the Prometheus or Mimir query frontend'],
          ],
        },
        {
          type: 'diagram',
          text: [
            'The average-hides-tails problem:',
            '',
            '  Time     Requests   Latency distribution',
            '  t=0      1000       990 at 20ms, 10 at 5000ms',
            '  avg()    = 69.8ms   <-- looks fine',
            '  p99      = 5000ms   <-- 10 users waited 5 seconds',
            '  p50      = 20ms     <-- half the users are fast',
            '',
            '  The avg panel is green. The p99 panel is red.',
            '  Only one of them is lying.',
          ].join('\n'),
          label: 'An average latency panel can show green while 1% of users experience 250x worse performance',
        },
        'The structural problem is that a wall of disconnected pictures cannot answer "what produced this pixel?" or "where should I go next?" Each panel is a dead end. A useful dashboard preserves provenance -- the chain from visible value back to query, labels, unit, and time range -- and provides drill-down edges to the next evidence layer.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat every panel as a data pipeline with a provenance invariant: a reader should be able to trace any visible value back through the transform chain, data frame, query, data source, variable scope, and time range that produced it.',
        {
          type: 'diagram',
          text: [
            'The panel pipeline:',
            '',
            '  dashboard',
            '    |-- time range: [now-1h, now]',
            '    |-- variables: $service=checkout, $env=prod',
            '    |',
            '    +-- panel "P99 Latency"',
            '          |',
            '          +-- query A (Prometheus)',
            '          |     PromQL: histogram_quantile(0.99,',
            '          |       rate(http_duration_bucket{service="$service"}[5m]))',
            '          |     --> data frame: [time, value, {service, le}]',
            '          |',
            '          +-- transform: organize fields',
            '          |     keep: [time, value]',
            '          |     rename: value -> "p99 (ms)"',
            '          |     unit: seconds -> milliseconds',
            '          |',
            '          +-- visualization: time series',
            '                threshold: warn > 200ms, crit > 500ms',
            '                data link: click -> Tempo trace search',
            '                exemplar: trace_id on outlier points',
          ].join('\n'),
          label: 'Each panel is a query-transform-render pipeline with traceable provenance',
        },
        'The invariant is that provenance survives every stage. If a transform drops the service label, the chart cannot tell you which service spiked. If the unit is wrong, a threshold fires on noise. If there is no data link, the operator is stranded at the summary layer with no path to the evidence. The pipeline is correct only when every field the human needs for a decision is preserved from source to pixel.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A Grafana dashboard is a JSON document stored in the Grafana database or provisioned from a file. It contains a list of panels, template variables, time range settings, annotations, and links. When a user opens the dashboard, the frontend evaluates variables, dispatches queries, receives data frames, applies transformations, and renders visualizations.',
        {
          type: 'table',
          headers: ['Stage', 'Grafana concept', 'Data structure', 'What can go wrong'],
          rows: [
            ['Scope', 'Template variables', 'Key-value pairs injected into queries via $var syntax', 'Multi-select variables fan out into expensive regex matchers; "All" value queries every series'],
            ['Fetch', 'Data source query', 'PromQL, LogQL, TraceQL, SQL, or plugin-specific language', 'Wrong range function (rate vs increase), missing label matcher, too-wide time range'],
            ['Return', 'Data frame', 'Columnar table: typed fields (time, number, string), labels, metadata', 'Unexpected field types; null handling; frame shape changes between Grafana versions'],
            ['Reshape', 'Transformation', 'Pipeline of operators: join, filter, calculate, organize, reduce, convert', 'Dropping a label field; joining on wrong key; reduce collapses time dimension'],
            ['Render', 'Visualization', 'Panel plugin maps fields to axes, colors, thresholds, legends, tooltips', 'Wrong unit (bytes vs bits); threshold on wrong scale; missing legend labels'],
            ['Navigate', 'Data links + exemplars', 'URL templates with field-value interpolation', 'Broken link template; missing trace_id field; link points to wrong data source'],
          ],
        },
        {
          type: 'code',
          language: 'text',
          text: [
            '# The data frame is the central data structure.',
            '# Every data source returns one or more frames.',
            '# Every transformation reads and writes frames.',
            '',
            '# A frame for a Prometheus time series:',
            'Frame "http_request_duration_seconds{service=checkout,route=/pay}"',
            '  Field "Time"    type=time     [t0, t1, t2, t3, ...]',
            '  Field "Value"   type=number   [0.023, 0.019, 0.045, 0.031, ...]',
            '  Labels: {service: "checkout", route: "/pay", instance: "pod-7a"}',
            '',
            '# A frame for a Loki log query:',
            'Frame "log lines"',
            '  Field "Time"    type=time     [t0, t1, t2, ...]',
            '  Field "Line"    type=string   ["POST /pay 500 ...", ...]',
            '  Field "labels"  type=string   ["{service=checkout}", ...]',
            '',
            '# Transformations operate on these frames:',
            '# join(frameA, frameB, on="Time")  -> merged frame',
            '# filter(frame, field="Value", gt=0.1) -> filtered rows',
            '# reduce(frame, calc="mean") -> single-row summary',
          ].join('\n'),
        },
        'Transformations are the most dangerous stage. They are powerful -- join, filter by value, add calculated field, group by, convert field type, series to rows, reduce, organize fields, rename by regex -- but each one can silently remove context. A "reduce" transform that computes the mean of a time series throws away the time dimension. An "organize fields" that hides the service label makes a multi-service panel unreadable. The transform chain must be audited as carefully as the query.',
        {
          type: 'note',
          text: 'Grafana distinguishes between client-side transformations (run in the browser after the query returns) and server-side expressions (run in the Grafana backend before the panel renders). Alert rules use server-side expressions, not client-side transformations. A panel that looks correct because of a browser-side transform may produce a different result in the alert evaluation path.',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The dashboard-as-pipeline design works because it makes every decision auditable. Each panel has an inspect drawer that shows the raw query, returned data frames, applied transformations, and final visualization config. An operator who doubts a chart can open the inspector and trace the value back to the source.',
        {
          type: 'bullets',
          items: [
            'Provenance: every pixel maps to a field in a frame that came from a query against a data source within a time range. The inspect drawer exposes this chain.',
            'Composability: data links let one panel hand off context to another panel, dashboard, or external system. A p99 spike links to the trace search filtered to the same service, time range, and threshold.',
            'Heterogeneous sources: the data-frame contract normalizes results from Prometheus, Loki, Tempo, SQL, Elasticsearch, CloudWatch, and custom plugins into the same columnar shape. Transformations work on frames regardless of origin.',
            'Separation of concerns: the query defines what to fetch, the transform defines how to reshape, and the visualization defines how to render. Changing the visualization from a time-series graph to a stat panel or table does not require rewriting the query.',
          ],
        },
        'The correctness argument is a provenance argument. A panel is trustworthy when: the query answers the intended question (histogram_quantile for p99, not avg), the transform preserves the fields needed for interpretation (service label, unit), the visualization encodes the fields with correct units and thresholds, and the data link points to the next evidence layer (traces, logs, deployment).',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'An ML inference service deploys a new model version via canary. The on-call team needs a rollout dashboard that answers four questions: is the SLO burning, is tail latency degrading, are errors spiking on specific routes, and is per-request cost changing.',
        {
          type: 'table',
          headers: ['Panel', 'Data source', 'Query', 'Key labels preserved', 'Data link'],
          rows: [
            ['SLO burn rate', 'Prometheus (Mimir)', '1 - (sum(rate(http_requests_total{code!~"5.."}[5m])) / sum(rate(http_requests_total[5m])))', 'service, slo_name', 'Link to SLO detail dashboard'],
            ['P99 latency', 'Prometheus', 'histogram_quantile(0.99, sum by(le, model_version) (rate(inference_duration_bucket[5m])))', 'model_version, route', 'Exemplar link to Tempo trace'],
            ['Error rate by route', 'Prometheus', 'sum by(route, model_version, code) (rate(http_requests_total{code=~"5.."}[5m]))', 'route, model_version, code', 'Link to Loki log query filtered by route'],
            ['Cost per 1K tokens', 'SQL (billing)', 'SELECT model_version, sum(cost)/sum(tokens)*1000 FROM usage GROUP BY model_version', 'model_version', 'Link to billing dashboard'],
          ],
        },
        {
          type: 'code',
          language: 'text',
          text: [
            '# Incident timeline with this dashboard:',
            '',
            '14:00  Canary deploys model_version=v2.3 to 5% of traffic',
            '14:05  SLO burn panel: burn rate 0.2 (normal)',
            '14:12  P99 panel: v2.3 latency rises to 800ms (v2.2 is 120ms)',
            '       Exemplar dot appears on the 800ms spike',
            '14:13  Operator clicks the exemplar dot',
            '       -> Tempo opens with trace_id=abc123',
            '       -> Trace shows: tokenizer step took 650ms (v2.2: 40ms)',
            '14:15  Error panel: /generate route shows 4% 500s on v2.3',
            '       Operator clicks data link on error bar',
            '       -> Loki opens: {service="inference",route="/generate",',
            '          model_version="v2.3"} |= "OOM"',
            '       -> Log line: "model v2.3 exceeds GPU memory on batch>8"',
            '14:17  Operator triggers rollback based on three signals:',
            '       latency regression, OOM errors, root cause in trace',
            '',
            '# Without data links and exemplars, the operator sees red',
            '# lines but has no path from chart to evidence.',
          ].join('\n'),
        },
        'The dashboard works because each panel preserves the model_version label through query, transform, and visualization. The exemplar on the p99 panel carries a trace_id. The data link on the error panel carries the route and version into a pre-filtered Loki query. The operator moves from summary to evidence to decision in under five minutes.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Dashboard cost has three components: query cost (what the data source computes), transform cost (what the browser or backend reshapes), and human scan cost (how long the operator takes to find the answer).',
        {
          type: 'table',
          headers: ['Knob', 'What it controls', 'Doubling effect', 'Danger zone'],
          rows: [
            ['Time range', 'How much data the query reads', '2x samples returned; 2x TSDB blocks scanned', '30d range on a 15s-step query = 172,800 points per series'],
            ['Step / resolution', 'Granularity of the returned series', 'Halving the step doubles returned points', '1s step on a 24h range = 86,400 points; browser struggles to render'],
            ['Variable fanout', 'How many series the query matches', 'Multi-select with 100 values = 100x query cost', '"All" on a tenant variable with 500 tenants = 500 concurrent PromQL evaluations'],
            ['Panel count', 'Number of queries fired on dashboard load', '30 panels x 2 queries each = 60 concurrent queries', 'During an incident, 20 engineers open the same dashboard = 1,200 concurrent queries'],
            ['Refresh interval', 'How often queries re-fire', '10s refresh on a 30-panel dashboard = 180 queries/minute', 'Auto-refresh + stale variable = unnecessary repeat load on an already-stressed backend'],
            ['Transform chain', 'Browser-side CPU work', 'Join of two 10K-row frames = O(n*m) if not indexed', 'Complex transforms on large frames cause the browser tab to freeze'],
          ],
        },
        {
          type: 'note',
          text: 'The most dangerous dashboard is the one that is harmless on a quiet day. An "All tenants" variable with 30s refresh works fine when two engineers use it. During a P1 incident, 50 engineers open it simultaneously, each triggering 60 queries every 30 seconds. The metrics backend receives 6,000 queries/minute from the dashboard alone, right when it should be serving alert evaluations.',
        },
        'Recording rules are the standard defense. Pre-compute expensive aggregations in Prometheus or Mimir and store the result as a new time series. The dashboard queries the pre-computed series instead of evaluating the full aggregation at read time. This shifts cost from query time to write time and makes dashboard load independent of the raw series cardinality.',
        {
          type: 'code',
          language: 'yaml',
          text: [
            '# Recording rule: pre-compute p99 latency per service',
            '# Instead of dashboard running histogram_quantile on every load',
            'groups:',
            '  - name: slo_latency',
            '    interval: 30s',
            '    rules:',
            '      - record: service:http_duration_p99:5m',
            '        expr: |',
            '          histogram_quantile(0.99,',
            '            sum by (service, le) (',
            '              rate(http_request_duration_seconds_bucket[5m])',
            '            )',
            '          )',
            '        labels:',
            '          aggregation: "recording_rule"',
          ].join('\n'),
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['Use case', 'Signals combined', 'Why Grafana fits'],
          rows: [
            ['Rollout health', 'SLO burn, p99 latency, error rate by version, cost', 'Version label threads through metrics, traces, and logs; data links connect summary to evidence'],
            ['SLO burn dashboard', 'Error budget remaining, burn rate over 1h/6h/3d windows', 'Recording rules pre-compute burn rates; thresholds show budget exhaustion time'],
            ['Capacity planning', 'CPU/memory utilization, request rate, queue depth, pod count', 'Repeated rows per service; variables scope to cluster/namespace; trend panels project saturation date'],
            ['Incident triage', 'Metrics + Loki logs + Tempo traces + annotations', 'Mixed data sources in one view; annotation markers show deployments; exemplars link metric spikes to traces'],
            ['Cost by tenant', 'Cloud billing API + Prometheus usage metrics + SQL allocation', 'SQL and Prometheus frames joined by tenant label; table visualization shows per-tenant cost breakdown'],
            ['Queue backlog', 'Kafka consumer lag, processing rate, partition assignment', 'Time-series panels with per-partition series; alerting on lag threshold; link to consumer group detail'],
          ],
        },
        'The pattern fits best when the operational question requires combining signals from multiple data sources, when labels provide the join key across those sources, and when the answer needs drill-down from summary to evidence. Grafana wins when the dashboard is an investigation surface, not just a status display.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Averages hide tails: avg() on a latency panel masks the 1% of requests that are 100x slower. Use histogram_quantile or heatmap panels for latency. If the dashboard shows avg latency, it is hiding the users who are suffering most.',
            'Unit mismatch: a panel showing bytes with a bits/sec unit displays values 8x too high. A threshold set on the wrong unit fires on noise or misses real degradation. Every panel needs explicit unit configuration and the unit must match the metric source.',
            'Dropped labels: a transform that hides the service or route label makes a multi-service chart unreadable during an incident. The operator sees a spike but cannot tell which service owns it.',
            'Alert divergence: a panel that uses a browser-side "calculate field" transformation looks correct, but the alert rule evaluates server-side expressions. The panel says healthy; the alert says firing. Audit panel transforms against alert rule expressions.',
            'No ownership metadata: a dashboard without an owner annotation means no one maintains it. Stale recording rules, broken links, and deprecated metrics accumulate. Every dashboard needs a team or owner field and a last-reviewed date.',
            'Dashboard proliferation: 200 dashboards with no naming convention, no folder structure, and no deprecation policy. Engineers create new dashboards instead of improving existing ones. Use folders, consistent naming, and a dashboard registry.',
          ],
        },
        {
          type: 'table',
          headers: ['Anti-pattern', 'Why it hurts', 'Fix'],
          rows: [
            ['avg() latency panel', 'Hides tail pain; green dashboard during user-facing degradation', 'Replace with histogram_quantile(0.99, ...) or heatmap'],
            ['No data links', 'Operator is stranded at summary; opens new tabs to reconstruct queries', 'Add data links to trace search, log query, and deployment dashboard'],
            ['"All" variable default', 'Dashboard loads every tenant/service on first open', 'Default to a specific value; require explicit multi-select'],
            ['30-panel dashboard', 'Fires 60+ queries on load; browser tab freezes on large time ranges', 'Split into focused dashboards; use links between them'],
            ['No recording rules', 'Every dashboard load evaluates raw aggregations', 'Pre-compute expensive queries; dashboard reads pre-computed series'],
          ],
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'note',
          text: 'Primary sources: Grafana dashboard documentation (grafana.com/docs/grafana/latest/dashboards/). Transform documentation (grafana.com/docs/grafana/latest/panels-visualizations/query-transform-data/transform-data/). Server-side expressions (grafana.com/docs/grafana/latest/panels-visualizations/query-transform-data/expression-queries/). Data links and exemplars (grafana.com/docs/grafana/latest/panels-visualizations/configure-data-links/). Grafana data-plane specification (grafana.com/developers/dataplane/). Alert rule fundamentals (grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rules/). Grafana source code for data frame types: github.com/grafana/grafana-plugin-sdk-go (Go SDK defining the Frame struct).',
        },
        {
          type: 'table',
          headers: ['Role', 'Topic', 'Why'],
          rows: [
            ['Prerequisite', 'Prometheus TSDB Case Study', 'What the most common Grafana data source stores and how PromQL reads it'],
            ['Prerequisite', 'Metric Label Cardinality Control', 'Why variable fanout is expensive and how to bound label cardinality before it reaches the dashboard'],
            ['Sibling', 'Prometheus Rule Evaluation Alert State Machine', 'Server-side alert evaluation uses recording rules and expressions, not panel transforms'],
            ['Sibling', 'Alertmanager Routing and Inhibition Tree', 'Where alert notifications go after Grafana or Prometheus fires a rule'],
            ['Extension', 'Distributed Tracing', 'The trace backend that exemplars and data links connect to from metric panels'],
            ['Extension', 'OpenTelemetry Collector Case Study', 'The pipeline that ingests and routes the metrics, logs, and traces that dashboards display'],
            ['Application', 'Flagger Progressive Delivery Canary', 'Rollout dashboards that combine SLO burn, latency, and error signals for promote/rollback decisions'],
            ['Application', 'SLO Error Budget Burn-Rate Policy Case Study', 'The multi-window burn-rate math behind SLO panels and alert thresholds'],
          ],
        },
      ],
    },
  ],
};
