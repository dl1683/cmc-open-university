// OpenTelemetry semantic conventions: resources, instrumentation scopes, spans,
// metrics, logs, and attributes use shared names so signals correlate.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'opentelemetry-semantic-convention-schema-case-study',
  title: 'OpenTelemetry Semantic Convention Schema Case Study',
  category: 'Systems',
  summary: 'A telemetry-schema primer: resources, instrumentation scopes, spans, metrics, logs, semantic attributes, schema URLs, version drift, and cross-signal correlation.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['attribute model', 'schema drift'], defaultValue: 'attribute model' },
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

function semconvGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'res', label: 'res', x: 0.7, y: 3.8, note: notes.res ?? 'service' },
      { id: 'scope', label: 'scope', x: 2.25, y: 2.0, note: notes.scope ?? 'lib' },
      { id: 'span', label: 'span', x: 2.25, y: 5.6, note: notes.span ?? 'trace' },
      { id: 'metric', label: 'metric', x: 4.1, y: 2.0, note: notes.metric ?? 'num' },
      { id: 'log', label: 'log', x: 4.1, y: 5.6, note: notes.log ?? 'event' },
      { id: 'attrs', label: 'attrs', x: 5.95, y: 3.8, note: notes.attrs ?? 'keys' },
      { id: 'schema', label: 'schema', x: 7.65, y: 3.8, note: notes.schema ?? 'ver' },
      { id: 'backend', label: 'back', x: 9.15, y: 3.8, note: notes.backend ?? 'query' },
    ],
    edges: [
      { id: 'e-res-scope', from: 'res', to: 'scope', weight: '' },
      { id: 'e-res-span', from: 'res', to: 'span', weight: '' },
      { id: 'e-res-metric', from: 'res', to: 'metric', weight: '' },
      { id: 'e-res-log', from: 'res', to: 'log', weight: '' },
      { id: 'e-scope-attrs', from: 'scope', to: 'attrs', weight: '' },
      { id: 'e-span-attrs', from: 'span', to: 'attrs', weight: '' },
      { id: 'e-metric-attrs', from: 'metric', to: 'attrs', weight: '' },
      { id: 'e-log-attrs', from: 'log', to: 'attrs', weight: '' },
      { id: 'e-attrs-schema', from: 'attrs', to: 'schema', weight: '' },
      { id: 'e-schema-backend', from: 'schema', to: 'backend', weight: '' },
    ],
  }, { title });
}

function* attributeModel() {
  yield {
    state: semconvGraph('Semantic conventions give telemetry shared field names'),
    highlight: { active: ['res', 'span', 'metric', 'log', 'attrs', 'schema', 'e-res-span', 'e-res-metric', 'e-res-log', 'e-span-attrs', 'e-metric-attrs', 'e-log-attrs'], compare: ['backend'] },
    explanation: 'OpenTelemetry semantic conventions define common attribute names for operations and resources across traces, metrics, logs, profiles, and events. Shared names make correlation possible across signals and libraries.',
  };
  yield {
    state: labelMatrix('Semantic attribute roles', [
      { id: 'res', label: 'res' },
      { id: 'span', label: 'span' },
      { id: 'metric', label: 'metric' },
      { id: 'log', label: 'log' },
    ], [
      { id: 'key', label: 'key' },
      { id: 'use', label: 'use' },
    ], [
      ['service/env', 'join signals'],
      ['http route', 'explain request'],
      ['unit+attrs', 'chart safely'],
      ['event fields', 'debug incident'],
    ]),
    highlight: { active: ['res:key', 'span:key', 'metric:key', 'log:key'], compare: ['log:use'] },
    explanation: 'A resource describes the entity producing telemetry. Spans describe operations. Metrics describe measurements. Logs describe events. Attributes connect them with stable names such as service, deployment, HTTP route, status, and cloud region.',
    invariant: 'A schema is useful only if producers use the same names for the same ideas.',
  };
  yield {
    state: semconvGraph('Resource attributes are the join key across signals', { res: 'svc+env', attrs: 'common', backend: 'correlate' }),
    highlight: { active: ['res', 'span', 'metric', 'log', 'attrs', 'backend', 'e-res-span', 'e-res-metric', 'e-res-log', 'e-schema-backend'], found: ['schema'] },
    explanation: 'If traces, metrics, and logs all carry consistent service.name, deployment.environment, service.version, and cloud.region attributes, dashboards can pivot between signals without fuzzy matching.',
  };
  yield {
    state: labelMatrix('Canary regression joins', [
      { id: 'svc', label: 'svc' },
      { id: 'ver', label: 'ver' },
      { id: 'route', label: 'route' },
      { id: 'err', label: 'err' },
    ], [
      { id: 'attr', label: 'attr' },
      { id: 'link', label: 'link' },
    ], [
      ['service.name', 'all signals'],
      ['service.version', 'rollout'],
      ['http.route', 'span/metric'],
      ['error.type', 'log/trace'],
    ]),
    highlight: { active: ['svc:link', 'ver:link', 'route:link', 'err:link'], compare: ['route:attr'] },
    explanation: 'Complete case study: a canary regression appears in p99 metrics. The dashboard uses service.version and route attributes to jump to traces from the new revision, then to logs with the same resource attributes and error code.',
  };
}

function* schemaDrift() {
  yield {
    state: semconvGraph('Schema URLs and versions make telemetry evolution explicit', { schema: 'url+ver', attrs: 'renames', backend: 'map' }),
    highlight: { active: ['attrs', 'schema', 'backend', 'e-attrs-schema', 'e-schema-backend'], compare: ['metric', 'span'] },
    explanation: 'Semantic conventions evolve. Schema URLs and version-aware processors can help translate renamed or changed attributes so old and new telemetry still query together.',
  };
  yield {
    state: labelMatrix('Schema drift failure modes', [
      { id: 'rename', label: 'rename' },
      { id: 'unit', label: 'unit' },
      { id: 'card', label: 'card' },
      { id: 'scope', label: 'scope' },
    ], [
      { id: 'bad', label: 'bad' },
      { id: 'fix', label: 'fix' },
    ], [
      ['queries split', 'map old keys'],
      ['charts lie', 'normalize unit'],
      ['metric blowup', 'drop or hash'],
      ['mixed libs', 'track version'],
    ]),
    highlight: { active: ['rename:fix', 'unit:fix', 'card:fix'], compare: ['scope:bad'] },
    explanation: 'Schema drift creates broken dashboards and joins. A rename can split queries. Unit drift can make charts wrong. High-cardinality attributes can explode metrics. Mixed instrumentation scopes can hide which library produced data.',
  };
  yield {
    state: semconvGraph('Collectors can normalize attributes before export', { scope: 'lib ver', attrs: 'normalize', schema: 'schema', backend: 'stable' }),
    highlight: { active: ['scope', 'attrs', 'schema', 'backend', 'e-scope-attrs', 'e-attrs-schema', 'e-schema-backend'], found: ['res'] },
    explanation: 'The OpenTelemetry Collector is a natural place to enrich, filter, rename, drop, or route attributes. That makes schema governance operational rather than scattered across every application.',
  };
  yield {
    state: labelMatrix('Telemetry schema governance', [
      { id: 'allow', label: 'allow' },
      { id: 'drop', label: 'drop' },
      { id: 'map', label: 'map' },
      { id: 'own', label: 'own' },
    ], [
      { id: 'rule', label: 'rule' },
      { id: 'why', label: 'why' },
    ], [
      ['approved attrs', 'control cost'],
      ['PII fields', 'keep safe'],
      ['old names', 'preserve joins'],
      ['owners', 'audit drift'],
    ]),
    highlight: { active: ['allow:rule', 'drop:rule', 'map:rule', 'own:why'], compare: ['drop:why'] },
    explanation: 'Telemetry schema governance case study: the platform defines allowed resource attributes, drops PII, maps old HTTP keys to new names, assigns owners, and tests dashboards before rolling out instrumentation changes.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'attribute model') yield* attributeModel();
  else if (view === 'schema drift') yield* schemaDrift();
  else throw new InputError('Pick an OpenTelemetry semantic-convention view.');
}

export const article = {
  sections: [
    {
      heading: 'Why semantic conventions exist',
      paragraphs: [
        'Observability data is only useful when separate signals can be compared. During an incident, engineers move from a latency chart to a trace, from a trace to a log line, from a log line to a deployment, and from a deployment to the service owner. That movement depends on shared names. If one library says service, another says app, another says service_name, and another omits the field entirely, the backend has data but not structure. Search becomes manual and dashboards become fragile.',
        'OpenTelemetry semantic conventions exist to define common names and meanings for telemetry attributes. They cover resources, instrumentation scopes, spans, metrics, logs, events, profiles, and domain-specific operations such as HTTP, databases, messaging, cloud infrastructure, and runtimes. The point is not decoration. The point is correlation. A stable service.name, deployment.environment, service.version, cloud.region, http.route, and error.type can join evidence across signals without guessing.',
      ],
    },
    {
      heading: 'The naive approach and why it fails',
      paragraphs: [
        'The naive approach is to let every team invent labels as needed. A metrics team chooses route. A tracing library emits http.target. A logging framework writes path. A deployment tool writes version. This can work inside one service for a while because the same engineers remember the local vocabulary. It fails when an outage crosses service boundaries. Query authors must know every synonym, every unit, every missing field, and every historical rename.',
        'A second naive approach is to normalize everything in the backend after the fact. That also breaks down. Backends can rename fields, but they often receive data after cardinality has already exploded, PII has already been stored, units have already polluted charts, and alerts have already been written against old names. Semantic conventions push schema discipline upstream. Producers, collectors, and backends can all agree on the vocabulary before data becomes permanent operational evidence.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that telemetry needs a schema even though it is not a database table. A Resource describes the entity that produced the telemetry: service, process, host, container, cloud instance, cluster, deployment, or library environment. An instrumentation scope identifies the library or component that emitted data. Spans describe operations. Metrics describe measurements. Logs describe events. Attributes provide the fields that make those objects queryable. Semantic conventions define which fields should be used for common ideas.',
        'The schema must work across signals. A span attribute such as http.route helps explain a request. A metric with the same route dimension can show latency or error rate. A log record with the same service and deployment attributes can explain the failure. The shared naming model turns an incident investigation into joins instead of keyword search. Without it, traces, metrics, and logs are three disconnected piles of strings.',
      ],
    },
    {
      heading: 'How the system works',
      paragraphs: [
        'Instrumentation libraries attach attributes when they create spans, metrics, logs, or events. Resource detectors attach process, host, container, cloud, service, and deployment attributes. The SDK packages that data with schema information when available. The Collector can then enrich, drop, rename, hash, or route attributes before export. Backends store the resulting fields and expose them in queries, dashboards, alerts, exemplars, and correlation views.',
        'Schema URLs and versions make evolution explicit. Semantic conventions change over time as names stabilize, old names are replaced, and units are clarified. A schema-aware pipeline can map older attributes to newer names so old and new telemetry still query together. This is the same idea as API versioning or schema registry compatibility, applied to observability. The difference is that telemetry changes are often rolled out gradually by many libraries and services, so drift is normal rather than exceptional.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The attribute-model visual is proving that resource attributes are the join key across signals. The resource node feeds spans, metrics, and logs because all of them need to say which service, version, environment, host, or region produced the evidence. The attributes node sits before the schema node because raw fields are not enough; fields need agreed names and meanings. The backend node is useful only if upstream producers provide stable attributes that can be queried together.',
        'The schema-drift visual is proving that telemetry schemas have lifecycles. Renames split queries. Unit drift makes charts lie. Cardinality spikes make metric systems expensive or unusable. Mixed instrumentation scopes hide which library emitted a field. The fix column is the operating model: map old keys, normalize units, drop or hash dangerous dimensions, track instrumentation versions, and assign owners. Schema governance is operational work, not documentation trivia.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Semantic conventions work because they align independent producers before the incident starts. A Java HTTP library, a Go service, a Kubernetes detector, and a collector processor can all emit compatible resource and operation fields. A dashboard author can write one query for service.name and deployment.environment instead of maintaining a private dictionary for every team. A trace view can link to metrics and logs because the evidence shares stable dimensions.',
        'They also work because conventions are specific enough to be useful but broad enough to cross vendors. OpenTelemetry does not require one backend or one storage engine. It defines the vocabulary that travels with the data. That gives teams portability. A company can change collectors, vendors, dashboards, or alert engines while preserving the semantic layer that makes the data understandable.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The cost is governance. Someone must decide which attributes are required, which are optional, which are forbidden, which are too high-cardinality for metrics, and which are safe only in traces or logs. A perfect schema that nobody follows is useless. A loose schema that permits every user id, request id, and raw URL as a metric label can destroy the backend. The useful middle ground is an allowlist, review process, collector policy, and dashboard tests.',
        'There is also migration cost. Libraries upgrade at different times. Old dashboards may depend on old names. Some semantic conventions are stable, while others are experimental or evolving. A good rollout may need dual-write periods, mapping processors, deprecation windows, and validation queries. The tradeoff is extra operational discipline in exchange for much lower incident friction and vendor lock-in.',
      ],
    },
    {
      heading: 'Real uses',
      paragraphs: [
        'A canary regression is the clean example. A new service.version causes p99 latency to rise for one http.route in production. The metric chart filters by service.name, deployment.environment, service.version, and route. Exemplars or trace links jump from the metric spike to representative traces. The traces show a database span with an error.type. Logs with the same resource attributes show the exact deployment and exception. The investigation is a sequence of structured pivots because the fields match.',
        'Another use is platform-wide cost control. A team can define which resource attributes are allowed on metrics, which span attributes may contain user data, and which log fields must be redacted. The Collector can enforce those rules before export. Backends can alert on schema drift when new attributes appear. This makes semantic conventions part of the control plane for observability, not only a naming guide for instrumentation authors.',
      ],
    },
    {
      heading: 'Failure modes and limits',
      paragraphs: [
        'Semantic conventions do not make telemetry cheap, safe, or correct by themselves. High-cardinality attributes can still break metrics. Sensitive fields can still leak through span attributes or log bodies. Units can still be wrong. A service can still emit the right key with the wrong meaning. A route label can still include raw IDs if instrumentation is careless. Conventions give names; they do not replace validation.',
        'Another limit is false uniformity. Two services may both emit http.route, but one may use templated routes and another may use raw paths. Two teams may both emit service.version, but one uses a git SHA and the other uses a release train. These differences matter during incident response. Schema governance must include examples, tests, and ownership, not only a list of key names.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Read the OpenTelemetry semantic conventions overview, resource semantic conventions, metrics semantic conventions, and schema URL guidance. Then study OpenTelemetry Collector Case Study, Trace Context and Baggage Propagation, Metric Label Cardinality Control, Metric Exemplars Trace Correlation, Grafana Dashboard Query Transform Graph, Prometheus Rule Evaluation Alert State Machine, PII Redaction Token Span Pipeline, OpenAPI Contract Schema Evolution, and Schema Registry Compatibility. The durable lesson is that observability correlation is a schema problem before it is a dashboard problem.',
      ],
    },
  ],
};
