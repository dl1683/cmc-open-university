// Monarch case study: regional in-memory time-series ingestion and querying
// with global query/configuration planes for planet-scale monitoring.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'monarch-time-series-case-study',
  title: 'Monarch Time Series Case Study',
  category: 'Papers',
  summary: 'Google Monarch as the monitoring-data lesson: regional ingestion, in-memory time series, global querying, and schematized metrics.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['regional ingestion', 'global query and schema'], defaultValue: 'regional ingestion' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function architecture(title) {
  return graphState({
    nodes: [
      { id: 'tasks', label: 'tasks', x: 0.7, y: 3.8, note: 'export metrics' },
      { id: 'collector', label: 'collectors', x: 2.5, y: 3.8, note: 'scrape/push' },
      { id: 'regionA', label: 'region A', x: 4.6, y: 2.2, note: 'in-memory TS' },
      { id: 'regionB', label: 'region B', x: 4.6, y: 5.4, note: 'in-memory TS' },
      { id: 'globalQuery', label: 'global query', x: 7.0, y: 3.0, note: 'federates' },
      { id: 'config', label: 'config plane', x: 7.0, y: 5.4, note: 'schemas/rules' },
      { id: 'user', label: 'SRE/dashboard', x: 9.0, y: 3.8, note: 'alerts + queries' },
    ],
    edges: [
      { id: 'e-tasks-collector', from: 'tasks', to: 'collector', weight: 'metrics' },
      { id: 'e-collector-a', from: 'collector', to: 'regionA', weight: 'write' },
      { id: 'e-collector-b', from: 'collector', to: 'regionB', weight: 'write' },
      { id: 'e-a-query', from: 'regionA', to: 'globalQuery', weight: 'partial query' },
      { id: 'e-b-query', from: 'regionB', to: 'globalQuery', weight: 'partial query' },
      { id: 'e-config-a', from: 'config', to: 'regionA', weight: 'rules' },
      { id: 'e-config-b', from: 'config', to: 'regionB', weight: 'rules' },
      { id: 'e-query-user', from: 'globalQuery', to: 'user', weight: 'result' },
    ],
  }, { title });
}

function* regionalIngestion() {
  yield {
    state: architecture('Monarch regionalizes metric ingestion'),
    highlight: { active: ['tasks', 'collector', 'regionA', 'regionB', 'e-tasks-collector', 'e-collector-a', 'e-collector-b'], compare: ['globalQuery'] },
    explanation: 'Monarch is Google\'s planet-scale in-memory time-series database. Metrics are collected regionally so ingestion and storage scale with locality and failures do not require one global hot path.',
  };

  yield {
    state: labelMatrix(
      'A metric is more than a name and number',
      [
        { id: 'latency', label: 'rpc_latency' },
        { id: 'errors', label: 'rpc_errors' },
        { id: 'cpu', label: 'cpu_usage' },
        { id: 'quota', label: 'quota_used' },
      ],
      [
        { id: 'value', label: 'value type' },
        { id: 'labels', label: 'fields/labels' },
        { id: 'aggregation', label: 'aggregation' },
      ],
      [
        ['histogram', 'service, method, zone', 'percentiles'],
        ['counter', 'service, code', 'rate'],
        ['gauge', 'task, machine', 'latest/avg'],
        ['counter', 'tenant, product', 'sum/rate'],
      ],
    ),
    highlight: { found: ['latency:value', 'latency:aggregation'], active: ['errors:labels', 'quota:labels'] },
    explanation: 'Monarch uses a schematized data model. Labels and value types matter because monitoring queries need aggregation semantics, not just raw points.',
    invariant: 'A time series is identified by metric schema plus field values.',
  };

  yield {
    state: architecture('Regional storage keeps hot monitoring paths local'),
    highlight: { active: ['regionA', 'regionB', 'config', 'e-config-a', 'e-config-b'], found: ['collector'] },
    explanation: 'Configuration tells regions what to collect, retain, and aggregate. The system has to be reliable because SREs use it during incidents, when the monitored systems may already be unhealthy.',
  };

  yield {
    state: labelMatrix(
      'Monitoring database requirements',
      [
        { id: 'ingest', label: 'high ingest' },
        { id: 'query', label: 'interactive query' },
        { id: 'alerts', label: 'alerting' },
        { id: 'reliability', label: 'reliability' },
      ],
      [
        { id: 'pressure', label: 'pressure' },
        { id: 'design', label: 'design response' },
      ],
      [
        ['many time series', 'regional ingestion'],
        ['dashboards during incidents', 'global query plane'],
        ['low-latency decisions', 'precompute and rule config'],
        ['must outlive failures', 'regional isolation'],
      ],
    ),
    highlight: { found: ['ingest:design', 'query:design', 'reliability:design'], active: ['alerts:pressure'] },
    explanation: 'Monarch is a strong case study because monitoring storage has a different failure standard: when everything else is failing, the monitoring database still has to answer.',
  };
}

function* globalQueryAndSchema() {
  yield {
    state: architecture('Global query fans out to regional stores'),
    highlight: { active: ['user', 'globalQuery', 'regionA', 'regionB', 'e-a-query', 'e-b-query', 'e-query-user'], compare: ['collector'] },
    explanation: 'A global query federates to regional stores, merges partial results, and returns one view. That lets users ask fleet-wide questions while keeping ingestion regional.',
  };

  yield {
    state: labelMatrix(
      'Example query plan',
      [
        { id: 'filter', label: 'filter' },
        { id: 'group', label: 'group' },
        { id: 'reduce', label: 'reduce' },
        { id: 'alert', label: 'alert' },
      ],
      [
        { id: 'operation', label: 'operation' },
        { id: 'result', label: 'result' },
      ],
      [
        ['service=search, region=*', 'matching series'],
        ['by method and zone', 'labeled groups'],
        ['p99 latency over 5m', 'time series result'],
        ['p99 > threshold', 'page or ticket'],
      ],
    ),
    highlight: { active: ['filter:operation', 'group:operation', 'reduce:operation'], found: ['alert:result'] },
    explanation: 'The data model matters because queries group by fields, aggregate histograms, and feed alerting rules. A metric schema is a query contract.',
  };

  yield {
    state: labelMatrix(
      'Cardinality is the hidden systems cost',
      [
        { id: 'good', label: 'bounded labels' },
        { id: 'bad', label: 'request id label' },
        { id: 'tenant', label: 'tenant label' },
        { id: 'method', label: 'method label' },
      ],
      [
        { id: 'series_count', label: 'series count' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['service, method, zone', 'manageable'],
        ['unique per request', 'explodes storage'],
        ['many but meaningful', 'quota and isolation'],
        ['bounded enum', 'good aggregation'],
      ],
    ),
    highlight: { found: ['good:risk', 'method:risk'], removed: ['bad:risk'], compare: ['tenant:risk'] },
    explanation: 'Time-series databases live or die by cardinality. High-cardinality labels can overwhelm ingestion, memory, query fanout, and alerting.',
  };

  yield {
    state: labelMatrix(
      'How Monarch connects to the platform',
      [
        { id: 'trace', label: 'Dapper' },
        { id: 'tdigest', label: 't-digest' },
        { id: 'backpressure', label: 'Backpressure' },
        { id: 'dataflow', label: 'Dataflow' },
      ],
      [
        { id: 'connection', label: 'connection' },
        { id: 'question', label: 'question answered' },
      ],
      [
        ['request paths', 'where did time go?'],
        ['quantile sketches', 'how bad is p99?'],
        ['ingest overload', 'are clients flooding us?'],
        ['streaming windows', 'what period does this metric mean?'],
      ],
    ),
    highlight: { found: ['trace:question', 'tdigest:question', 'dataflow:question'], active: ['backpressure:connection'] },
    explanation: 'Metrics, traces, and streams are complementary observability structures. Monarch shows the storage side of operational truth.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'regional ingestion') yield* regionalIngestion();
  else if (view === 'global query and schema') yield* globalQueryAndSchema();
  else throw new InputError('Pick a Monarch view.');
}

export const article = {
  sections: [
    {
      heading: 'The monitoring-data problem',
      paragraphs: [
        'Monarch is Google\'s planet-scale in-memory time-series database for monitoring. It is built for data that arrives constantly, must be queried interactively, and becomes most important when the rest of the system is under stress. Monitoring is not ordinary analytics. During an incident, engineers need fresh data, meaningful labels, correct aggregation, and reliable alerts even while parts of the fleet are failing.',
        'The case study matters because time-series monitoring has its own data-structure pressures: huge ingest, high cardinality, query fanout, retention, alert correctness, and schema discipline. A monitoring database is not just append-only storage with timestamps. It is a system for turning labeled measurements into operational evidence.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first naive approach is one global metrics database. Every task sends every sample to one logical place, and every query reads from that place. That sounds simple, but it creates a global ingestion bottleneck and a global failure boundary. Monitoring data is too high-volume and too operationally important for one central pipe to be the only path.',
        'The second naive approach is fully regional monitoring with no global query model. That keeps ingestion local, but it makes fleet-wide debugging hard. If an incident spans regions, engineers need a way to ask one question across the system without manually stitching dashboards together.',
        'The third naive approach is schemaless labels everywhere. Let every team attach arbitrary labels and sort it out later. That feels flexible until a high-cardinality label explodes the number of time series. One accidental user ID, request ID, or raw URL label can create millions of series and make queries, storage, and alerting expensive or unusable.',
      ],
    },
    {
      heading: 'The core architecture',
      paragraphs: [
        'Monarch uses regional ingestion and storage with global query and configuration planes. Tasks export metrics to collectors. Regional Monarch components ingest and store time series, keeping high-volume traffic near where it is produced. A global query plane federates queries across regions and merges partial answers. A configuration plane manages schemas, collection rules, retention, and alerting behavior.',
        'Metrics are schematized. Value types, fields, labels, and aggregation semantics are part of the contract. This matters because a metric is not just a name and a number. A counter, gauge, distribution, and cumulative value have different meanings. Labels define dimensions such as region, service, job, or status code. Aggregations must respect those meanings.',
        'The real data structure is the labeled time series: metric name plus label set plus time-ordered samples. The label index is what makes debugging possible. It is also what can destroy the system when uncontrolled cardinality creates too many unique series.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Monarch works because ingestion is regional and queries are global. Samples do not need to cross the planet before they become durable enough to query locally. Engineers still get a unified query surface when they need fleet-wide answers. This separates write-path scale from read-path federation.',
        'It also works because schema and configuration are treated as first-class systems. A monitoring platform cannot rely on every team inventing labels independently. The schema tells users which dimensions exist and what they mean. The configuration plane helps enforce retention, collection, and alerting rules so monitoring remains usable as the fleet grows.',
        'The architecture matches incident response. During a regional problem, local ingestion should continue where possible. During a global investigation, engineers need queries that merge regions without hiding missing data. A good monitoring database must tell users not only the values it sees, but also when part of the observation system is stale or unavailable.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Monarch-style systems support dashboards, alerting, SLOs, capacity planning, release monitoring, incident response, fleet-wide operational analytics, and automated remediation. The same core questions appear in Prometheus, M3, OpenTelemetry metrics, cloud monitoring products, and internal telemetry platforms.',
        'The design connects directly to tracing and logs. Metrics tell you rates, levels, and distributions. Traces show paths through a system. Logs preserve local events. During an incident, metrics often provide the first signal: error rate rose, p99 latency changed, queue depth is climbing, or a region stopped reporting. Monarch is about making those signals queryable at fleet scale.',
        'It also connects to quantile sketches and histograms. Latency monitoring is not just storing averages. Users need p95, p99, bucketed distributions, burn rates, and SLO windows. The time-series database has to preserve enough structure to answer operational questions without exploding cost.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The main pressures are ingestion rate, memory footprint, label cardinality, query fanout, retention, regional failures, and alert correctness. A single accidental high-cardinality label can create millions of series. A query that fans out across too many labels or regions can become expensive exactly when engineers need it most.',
        'Alerting adds another failure mode. An alert based on stale data can page people incorrectly or miss a real incident. A global alert must distinguish zero errors from no samples. It must handle delayed samples, missing regions, rollouts, and label changes. Alert semantics are part of the database contract.',
        'Another misconception is that global views require global ingestion. Monarch keeps ingestion regional and makes query federation global. That is a useful general pattern: put high-volume writes close to producers, and give users a coordinated read path when they need a larger view.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a service exports request_latency_ms with labels service, region, endpoint, status, and build. That might create a manageable number of series. If a developer adds user_id as a label, the same metric can explode into millions of unique series. The measurements may be technically valid, but the monitoring system becomes slower, more expensive, and harder to query.',
        'The right design treats label choice as schema design. High-cardinality identifiers may belong in traces or logs, not metrics. Metrics should preserve the dimensions needed for aggregation and alerting. This is the central educational point: labels are not comments on the data; they are the index.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A Monarch-like platform should track samples per second, active series, new series creation rate, label cardinality by dimension, query fanout, query latency, alert evaluation lag, missing-sample rates, memory pressure, and retention cost. These metrics show whether the observability system itself is healthy.',
        'The platform also needs governance signals. Which teams create the most series? Which labels drive cardinality? Which dashboards run the most expensive queries? Monitoring systems are often treated as background plumbing, but they need product management and schema review because their misuse can create real production risk.',
      ],
    },
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Monarch is a monitoring database built around regional ingestion, global query, schema discipline, and label-indexed time series. The architecture exists because monitoring data must be fresh, queryable, and reliable during failure.',
        'The deep lesson is that observability systems have data structures too. Metric names, label sets, time windows, histograms, query fanout, and alert state are design choices. If those choices are weak, the dashboard may be pretty but the evidence will be poor.',
        'The useful comparison is tracing. A trace follows one request path with rich context. A metric aggregates many events into time series. Monarch is about making the aggregate layer reliable and queryable; Dapper is about preserving causality for individual paths.',
        'In a course sequence, teach Monarch after time-series sketches and before incident-response automation. Students should understand that alerts are queries over structured telemetry, not magic notifications attached to charts.',
        'The practical test is whether a metric can be aggregated safely. If a label is useful for grouping and alerting, it belongs in the metric schema. If it identifies one request or one user, it likely belongs in a trace or log instead.',
        'Monarch is the wrong mental model for forensic detail. Metrics intentionally collapse many events into time series. When an engineer needs the exact payload, stack trace, or request path, logs and traces carry that evidence. The art is choosing the right observability data type before the incident.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: VLDB paper at https://www.vldb.org/pvldb/vol13/p3181-adams.pdf and Google Research page at https://research.google/pubs/monarch-googles-planet-scale-in-memory-time-series-database/. Study Dapper Tracing Case Study, t-digest Quantile Sketch, Google Dataflow Model Case Study, Backpressure & Flow Control, and Load Shedding & Graceful Degradation next.',
      ],
    },
      {
      heading: 'Why this exists',
      paragraphs: [
        "State the real constraint this topic fixes before introducing the mechanism.",
        "A good opening says what gets too slow, too fragile, or too hard to reason about under baseline behavior.",
        "Without that, every optimization appears decorative.",
      ],
    },

    {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },

    {
      heading: 'The core insight',
      paragraphs: [
        "The core insight is the smallest idea that changes what can be proven.",
        "Phrase it as an invariant, boundary, or contract that stays true across all transitions.",
        "Everything else in the topic should serve this one sentence.",
      ],
    },

    {
      heading: 'Where it fails',
      paragraphs: [
        "List the failure modes and the conditions that trigger them.",
        "Most methods have at least one silent failure mode; expose the silent ones.",
        "A method without explicit failure conditions is an invitation for misuse.",
      ],
    },


      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },

      {
        heading: 'Learning map',
        paragraphs: [
          'Before this topic, unlock all prerequisites and define the required preconditions.',
          'After this topic, trace where this idea appears in one larger path on this site.',
          'Use unlock relationships to keep one path and one checkpoint per review cycle.',
        ],
      },

      {
        heading: 'Micro checks',
        paragraphs: [
          {
            type: 'bullets',
            items: [
              'Can you state one invariant in one sentence?',
              'Can you prove one transition with pre and post state?',
              'Can you name one hidden edge case in one line?',
              'Can you transfer this mechanism to a neighboring domain?',
            ],
          },
        ],
      },

      {
        heading: 'Try this now',
        paragraphs: [
          'Build one input manually and predict every step before running the animation.',
          'If your predicted final state matches the animation for monarch-time-series-case-study, continue to the next topic in the same track.'
  ],
      },
],
};

