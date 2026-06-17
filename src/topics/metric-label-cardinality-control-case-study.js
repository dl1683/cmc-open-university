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
      heading: 'Why this exists',
      paragraphs: [
        'Dimensional metrics are powerful because labels let teams ask operational questions without creating a new metric for every slice. A service can expose one request counter and use labels for method, status, route, region, version, and tenant tier. Dashboards and alerts can then aggregate across the dimensions that matter.',
        'The same mechanism can break the monitoring system. A time series is the metric name plus the full set of label values. Every unique combination creates storage, index, memory, and query work. Metric label cardinality control exists so observability remains reliable during incidents instead of becoming another system that fails under surprise input.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach is to put every useful field into labels. If a user id, session id, email, trace id, raw URL, customer id, pod UID, or request UUID might help a future investigation, why not make it groupable? The wall is multiplicative. One field with millions of possible values can turn a cheap counter into millions of active series.',
        'The opposite shortcut is to drop labels blindly. That can make the bill smaller while destroying the meaning of the metric. A request counter without status code cannot separate success from failure. A latency histogram without route may hide the one endpoint that is burning the SLO. Cardinality control is schema design, not panic deletion.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'A metric label should be an aggregate dimension. It should answer questions such as which route is slow, which status class is rising, which region is unhealthy, or which deployment version regressed. It should not be a convenient place to store arbitrary request context. Metrics are optimized for repeated aggregate queries, not for per-request forensic search.',
        'The practical rule is to put bounded operational dimensions in metrics and unbounded facts in logs, traces, or event stores. Method, status, coarse route template, region, availability zone, deployment version, and tenant tier can be safe when managed. User ids, emails, session ids, raw paths, trace ids, and arbitrary error strings usually belong outside metric labels.',
      ],
    },
    {
      heading: 'Data structures and mechanism',
      paragraphs: [
        'Prometheus-style systems identify a series by metric name plus labels. Internally, the active head must remember recent chunks, series metadata, label indexes, postings lists, WAL records, and bookkeeping. A query first uses label matchers to select series, then reads chunks over a time range. Cardinality therefore affects ingestion, memory, disk, compaction, and query fanout at the same time.',
        'The multiplication is easy to underestimate. Five methods times ten status values times eighty route templates is four thousand possible combinations before adding instance, region, version, or tenant tier. Add a product id with two thousand values and the same metric can reach millions of series. Observed combinations may be smaller than the full cross product, but a traffic shift or bad release can discover the missing combinations quickly.',
        'A guardrail pipeline treats labels as data that can be checked before ingestion. Instrumentation libraries can restrict label names. OpenTelemetry Collector processors can drop or transform attributes. Prometheus relabeling can remove unsafe target labels. Remote-write gateways can route, aggregate, or reject streams. Approximate data structures such as HyperLogLog, Count-Min Sketch, and heavy-hitter tables can estimate distinct values and find the labels causing growth without storing exact maps for every stream.',
        'Histograms deserve special care. Each label combination is multiplied by bucket labels, plus sum and count series. A high-cardinality label on a histogram is therefore more expensive than the same label on a simple gauge. This is why latency metrics need route templates and bounded dimensions even more than basic counters do.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Cardinality control works because most operational decisions need aggregates, not individual identities. An alert needs to know that checkout 500s are rising in one region. It usually does not need one active time series per user. By keeping metrics low-cardinality, the system preserves fast dashboards and alerts while traces and logs carry high-cardinality context for investigation.',
        'The policy also works because it catches mistakes before they become expensive state. Once a labelset is accepted into active storage, the TSDB has to allocate and index it. Dropping or aggregating at the edge is cheaper than recovering a saturated metrics backend. The earlier the control point, the less data must be cleaned up later.',
      ],
    },
    {
      heading: 'Where it is useful',
      paragraphs: [
        'This discipline is useful in every system with self-service instrumentation. Microservices, Kubernetes, serverless functions, edge fleets, ML platforms, and multi-tenant SaaS products all let many teams emit metrics. Without a label policy, one deployment can damage shared monitoring for everyone.',
        'It is also useful for AIOps and automated incident response. These systems need clean aggregate signals to detect anomalies and rich context to explain them. If every user id becomes a time series, the signal layer drowns before the analysis layer can help. Low-cardinality metrics plus trace exemplars, logs, and structured events give automation a cleaner input.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Cardinality control fails when it becomes a blanket ban on useful dimensions. Some higher-cardinality labels are justified if they are bounded, budgeted, and tied to real operating questions. A route template label may have hundreds of values and still be essential. A tenant tier label may be critical. The decision should be based on budget, query value, and growth behavior, not on a fixed fear of large numbers.',
        'It also fails when teams use metrics as a replacement for logs and traces. Metrics are for aggregate measurement. Logs are for searchable facts. Traces are for request paths and causal context. Trying to turn metrics into a per-request database creates the worst combination: expensive series state with poor forensic detail.',
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        'Track active series by tenant, service, metric, and label name. Watch new-series rate, samples ingested per second, head memory, WAL volume, compaction pressure, remote-write queue lag, query latency, query fanout, and top label pairs by series count. A cardinality incident often appears first as a sudden new-series spike, then as memory pressure and slow queries.',
        'Good dashboards separate volume from cardinality. High sample rate on a bounded set of series is a scaling problem. Low sample rate across millions of series is a schema problem. Alert on both. Also keep examples of rejected or transformed labelsets so teams can fix instrumentation without guessing which emitter caused the guardrail to fire.',
        'Budget signals should be owned by the emitting team, not only by the observability team. A service dashboard should show its active series, newest labels, largest metrics, and budget headroom next to latency and error panels. That makes label growth visible before it becomes a shared platform emergency.',
      ],
    },
    {
      heading: 'Incident response',
      paragraphs: [
        'The response path is identify, isolate, mitigate, repair. Identify the metric and label causing series growth. Isolate the service, deployment, target, or collector route that emits it. Mitigate by dropping the bad label, replacing raw paths with templates, aggregating at the edge, sampling examples, or routing the stream to cheaper storage. Repair the instrumentation so the emergency rule can be removed.',
        'Do not treat emergency drops as invisible. Dropping user_id from a counter may be correct. Dropping route from a latency histogram may make an SLO dashboard lie. Every mitigation should state which questions remain valid and which are temporarily unavailable. After the incident, add tests or review rules so the same label shape cannot re-enter through another emitter.',
        'The durable repair is usually close to code. Replace raw URLs with route templates, cap free-form error labels, remove request identifiers, add metric review to instrumentation changes, and write regression checks that fail when forbidden label names appear. Collector rules buy time; source fixes prevent recurrence.',
      ],
    },
    {
      heading: 'What to study next',
      paragraphs: [
        'Primary sources are the Prometheus data model at https://prometheus.io/docs/concepts/data_model/, Prometheus metric and label naming guidance at https://prometheus.io/docs/practices/naming/, the OpenTelemetry metrics data model at https://opentelemetry.io/docs/specs/otel/metrics/data-model/, and OpenTelemetry Prometheus/OpenMetrics compatibility at https://opentelemetry.io/docs/specs/otel/compatibility/prometheus_and_openmetrics/.',
        'Study Prometheus TSDB Case Study for the storage engine affected by cardinality, Monarch Time Series Case Study for large-scale metrics systems, HyperLogLog and Count-Min Sketch for approximate control loops, OpenTelemetry Collector Case Study for edge policy, Metric Exemplars Trace Correlation for linking aggregate signals to traces, Log Template Drain Parser for keeping logs countable, Trace Context & Baggage Propagation for high-cardinality request context, and AIOps Incident Response for the automation layer that consumes these signals.',
      ],
    },
  ],
};
