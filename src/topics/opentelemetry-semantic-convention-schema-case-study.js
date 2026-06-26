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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows telemetry fields becoming a schema. Telemetry means traces, metrics, logs, events, profiles, and resource metadata emitted by software. Semantic conventions are shared names and meanings for common attributes in that telemetry.',
        'Active nodes show the attribute being attached, normalized, or queried. Found nodes show fields that can join signals correctly. Removed nodes show attributes dropped for safety, cost, or schema mismatch. Compare nodes show old and new names during migration.',
        'The safe inference rule is that correlation needs matching meaning, not just matching text. If two services both emit http.route but one uses templated routes and one uses raw paths, the query can still be wrong.',
        {type:'callout', text:'Semantic conventions are the schema layer that lets traces, metrics, logs, and deployments join into one incident narrative.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Observability data is useful only when separate signals can be compared. During an incident, engineers move from a latency chart to a trace, from a trace to a log line, from a log line to a deployment, and from a deployment to an owner.',
        'That movement depends on shared names. If one library writes service, another writes app, another writes service_name, and another omits the field, the backend has data but no reliable join key.',
        'OpenTelemetry semantic conventions define names and meanings for resources, spans, metrics, logs, events, and common domains such as HTTP, databases, messaging, cloud, containers, and runtimes. The purpose is correlation under pressure.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to let each team invent labels as needed. A metrics team chooses route, a tracing library emits http.target, a logging framework writes path, and a deployment tool writes version.',
        'That works inside one service for a while because local engineers remember the vocabulary. It fails when an outage crosses service boundaries and query authors must know every synonym, unit, missing field, and historical rename.',
        'A second approach is backend normalization after ingestion. That helps some queries, but it happens after data has been stored, alerts have been written, cardinality may have exploded, and sensitive fields may already be retained.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is schema drift. Names change, units change, route formats change, instrumentation libraries upgrade at different times, and some fields move from experimental to stable. Telemetry changes gradually because many services and libraries emit it.',
        'Cardinality is a second wall. A metric label that includes raw user id or raw URL can create millions of streams. The name may be semantically understandable and still operationally dangerous.',
        'Meaning is the third wall. Two teams can emit the same key with different conventions. If service.version is a git SHA in one service and a release train in another, rollup queries can mislead incident responders.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Telemetry needs a schema even though it is not a database table. A Resource describes the entity that produced telemetry, such as service, process, host, container, cloud instance, cluster, or deployment. An instrumentation scope identifies the library or component that emitted data.',
        'Spans describe operations. Metrics describe measurements. Logs describe events. Attributes make those objects queryable. Semantic conventions define which attributes should represent common ideas.',
        'The schema must work across signals. A metric with service.name, deployment.environment, and http.route can link to traces and logs that use the same meanings. The incident path becomes structured pivots instead of keyword search.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Instrumentation libraries attach attributes when they create spans, metrics, logs, or events. Resource detectors attach process, host, container, cloud, service, and deployment attributes. SDKs package the data with schema information when available.',
        'The Collector can enrich, drop, rename, hash, or route attributes before export. Backends store the resulting fields and expose them in queries, dashboards, alerts, exemplars, and correlation views.',
        'Schema URLs and versions make evolution explicit. A schema-aware pipeline can map older attributes to newer names so old and new telemetry query together during migration. That is observability schema evolution.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is stable join semantics. If traces, metrics, and logs use the same resource and operation attributes with the same meanings, then queries can connect evidence across signals without private dictionaries.',
        'The conventions work because they align independent producers before the incident. A Java HTTP library, a Go service, a Kubernetes detector, and a Collector processor can all emit compatible fields that a backend can join.',
        'Portability is a second benefit. OpenTelemetry does not require one storage engine. The data carries a shared vocabulary, so teams can change collectors, vendors, dashboards, or alert engines while keeping the semantic layer.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is governance. Someone must decide which attributes are required, optional, forbidden, too high-cardinality for metrics, or safe only in traces and logs. A schema that nobody follows is decoration.',
        'Migration cost is real. Old dashboards may depend on old names, and libraries upgrade at different times. A rollout may need dual-writing, mapping processors, deprecation windows, and validation queries.',
        'Cardinality cost is concrete. If a service emits 20 stable routes and 5 status classes, it creates about 100 route-status streams per metric. If it emits 50,000 raw URLs, the same metric can create 250,000 streams before other labels are counted.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'A canary regression is the clean use case. A metric shows p99 latency rising for one http.route on service.version 2026.06.25. Trace exemplars jump to slow requests with the same route and version. Logs with matching resource attributes show the exception.',
        'Semantic conventions also support platform cost control. A team can allow service, environment, route, and status labels on metrics while hashing or dropping user identifiers. The Collector can enforce that policy before export.',
        'They help ownership and compliance. Resource attributes can tie evidence to cluster, namespace, service, region, and deployment. That makes incident routing and audit review depend on data rather than naming guesses.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when producers use the right key with the wrong value shape. Raw paths in http.route, mixed units in duration fields, and inconsistent version formats can make dashboards look structured while remaining wrong.',
        'It fails when sensitive data is allowed into attributes or log bodies. Semantic conventions name fields, but they do not guarantee privacy. Validation, redaction, and allowlists must enforce the policy.',
        'It fails when teams treat experimental fields as permanent without migration. Conventions evolve. Without schema version tracking, old and new telemetry split queries during the exact period when operators need continuity.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A service emits latency metrics for checkout. With clean conventions, each point has service.name=checkout-api, deployment.environment=prod, service.version=2026.06.25, http.route=/checkout/{cartId}, and http.response.status_code=500.',
        'The same request produces a trace with matching resource attributes and a database span with db.system=postgresql and error.type=timeout. The log line carries the same service, environment, and version. One query can move from a p99 bucket to a trace and then to the log.',
        'If the service instead emits raw paths, 20 templated routes become 80,000 URL label values in a day. Query cost rises, dashboards split, and high-cardinality labels can be rejected. The schema problem becomes a cost problem.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are the OpenTelemetry semantic conventions overview, resource conventions, HTTP conventions, metrics conventions, and schema URL guidance. Use them for stable names, units, attribute stability, and schema migration behavior.',
        'Study OpenTelemetry Collector for enforcement, Trace Context and Baggage for propagation, Metric Label Cardinality Control for cost, Metric Exemplars for signal linking, PII Redaction for safety, and OpenAPI Contract Evolution for a parallel schema-governance pattern.',
      ],
    },
  ],
};
