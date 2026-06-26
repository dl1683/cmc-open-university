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
      heading: 'How to read the animation',
      paragraphs: [
        'The series-explosion view starts with one metric name and adds label values until the number of time series multiplies. A time series is one metric name plus one exact set of label values. Active nodes create new label combinations, found nodes are stored series, and compare nodes show the guardrail checking whether a label belongs in metrics.',
        'The guardrail-pipeline view shows where the system can stop unsafe labels before storage. The safe inference is that bounded labels such as method or status preserve aggregate questions, while unbounded labels such as user id or trace id create per-request storage pressure. The goal is not fewer labels everywhere; it is labels whose value sets are controlled.',
        {type:'callout', text:'Metric labels are schema, not scratch space: bounded dimensions keep aggregates useful while high-cardinality facts move to traces and logs.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Dimensional metrics let teams answer operational questions from one instrumented counter or histogram. Labels such as route, method, status, region, and version let a dashboard aggregate or split the same measurement. That is why metrics work for alerts and SLOs.',
        'The same mechanism can overload the monitoring system. Every unique label combination creates series metadata, chunks, indexes, write-ahead log traffic, and query fan-out. Cardinality control exists so observability stays available during the incident it is supposed to explain.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to add every useful field as a label. User id, session id, request id, email, raw URL, pod UID, and error string all sound useful during debugging. If they are labels, they can be grouped in dashboards.',
        'The opposite shortcut is to delete labels until the bill drops. That can destroy the metric. A request counter without status cannot separate success from failure, and a latency histogram without route can hide the endpoint that is burning the SLO.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is multiplication. Five methods times 12 status values times 200 route templates is 12,000 possible series before instance, region, version, or tenant are included. Add a user_id label with 1,000,000 values and the same metric can become millions of active series.',
        'Histograms multiply the damage because each label combination has bucket series plus sum and count. A high-cardinality label on request duration is therefore more expensive than the same label on a simple gauge. The backend pays in memory first, then slow ingestion and slow queries.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A metric label should be an aggregate dimension, not a place to stash request facts. It should answer questions like which route is slow, which status class is rising, or which region is unhealthy. If a value mostly identifies one request or one person, it belongs in traces, logs, or events instead.',
        'Cardinality control is schema design. Bounded labels stay in metrics because they preserve fast aggregate questions. Unbounded facts move to systems built for search and investigation, then exemplars or logs can link back when needed.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A metrics backend identifies each series by metric name and labels. On ingestion, it must allocate or find the series, append the sample, update indexes, and keep recent chunks in memory. A new label value is not just a string; it can create new active state.',
        'Guardrails can run in instrumentation libraries, collectors, relabeling rules, and remote-write gateways. They can drop forbidden labels, replace raw URLs with route templates, cap values, aggregate streams, or reject metrics that exceed tenant budgets. Approximate counters and heavy-hitter sketches can find which labels are driving growth without storing every bad combination forever.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is that aggregates remain meaningful when labels represent stable dimensions. Summing across instances, splitting by route, or alerting by status works because each label has a clear operational meaning. Removing request identity from labels does not remove the count; it prevents the count from fragmenting into one series per request.',
        'The safety invariant is bounded growth. If every accepted label has a budgeted value set, series count grows with known service dimensions rather than arbitrary user input. The system can then size memory and query fan-out instead of discovering the shape during an outage.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Cost follows active series. If one series uses about 3 KB of head memory after metadata, chunks, and indexes are counted, 100,000 active series uses about 300 MB while 5,000,000 uses about 15 GB. Exact numbers vary by backend, but the behavior is stable: series count dominates before sample count does.',
        'Doubling scrape rate doubles samples, while doubling a high-cardinality label can double series and index pressure. Query cost also follows fan-out. A query over 50 route series is different from a query over 500,000 user series even if both cover the same five-minute window.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Cardinality control is required in Prometheus-compatible metrics, multi-tenant SaaS monitoring, Kubernetes clusters, edge fleets, serverless platforms, and ML serving systems. The shared access pattern is many teams emitting metrics into a shared backend. One bad label shape can damage dashboards and alerts for everyone.',
        'It is also a prerequisite for automation. Alerting, anomaly detection, and incident triage need clean aggregate signals. High-cardinality facts still matter, but they should be searchable in logs, attached to traces, or sampled through exemplars rather than turned into metric dimensions.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Cardinality control fails when it becomes blind deletion. Some labels with many values are justified if they are bounded, budgeted, and necessary. Route template can have hundreds of values and still be the dimension that makes the latency SLO actionable.',
        'It also fails when emergency drops are treated as invisible. Dropping user_id may be safe for an aggregate counter, but dropping route from a latency histogram may make the dashboard lie. Every mitigation should state which questions remain valid and which are temporarily lost.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A service exposes http_request_duration_seconds with method, status, route, region, and version. With 4 methods, 6 status classes, 120 route templates, 3 regions, and 5 versions, the upper bound is 43,200 label combinations before histogram buckets. With 12 buckets plus sum and count, that can mean 604,800 series.',
        'If a developer adds raw_path and 80,000 distinct paths appear, the upper bound becomes billions even though observed traffic may hit only a fraction. A guardrail replaces raw_path with route = /users/{id} and stores the concrete path in logs or traces. The metric keeps the route-level aggregate, and investigation still has the exact request context elsewhere.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are the Prometheus data model at https://prometheus.io/docs/concepts/data_model/, Prometheus metric naming guidance at https://prometheus.io/docs/practices/naming/, and the OpenTelemetry metrics data model at https://opentelemetry.io/docs/specs/otel/metrics/data-model/. Use these sources for mechanism claims before relying on secondary summaries.',
        'Study Prometheus TSDB for storage behavior, Metric Exemplars Trace Correlation for safe trace links, HyperLogLog and Count-Min Sketch for approximate counting, OpenTelemetry Collector for edge policy, and Log Template Drain Parser for keeping logs countable. Start with the topic that explains the data shape, then move to the production system.',
      ],
    },
  ],
};