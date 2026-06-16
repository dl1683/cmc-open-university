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
    state: labelMatrix('Attr', [
      { id: 'res', label: 'res' },
      { id: 'span', label: 'span' },
      { id: 'metric', label: 'metric' },
      { id: 'log', label: 'log' },
    ], [
      { id: 'key', label: 'key' },
      { id: 'use', label: 'use' },
    ], [
      ['svc', 'join'],
      ['http', 'trace'],
      ['unit', 'chart'],
      ['body', 'debug'],
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
    state: labelMatrix('Case', [
      { id: 'svc', label: 'svc' },
      { id: 'ver', label: 'ver' },
      { id: 'route', label: 'route' },
      { id: 'err', label: 'err' },
    ], [
      { id: 'attr', label: 'attr' },
      { id: 'link', label: 'link' },
    ], [
      ['name', 'all'],
      ['rev', 'roll'],
      ['http', 'span'],
      ['code', 'log'],
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
    state: labelMatrix('Drift', [
      { id: 'rename', label: 'rename' },
      { id: 'unit', label: 'unit' },
      { id: 'card', label: 'card' },
      { id: 'scope', label: 'scope' },
    ], [
      { id: 'bad', label: 'bad' },
      { id: 'fix', label: 'fix' },
    ], [
      ['split', 'map'],
      ['wrong', 'unit'],
      ['high', 'drop'],
      ['mix', 'ver'],
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
    state: labelMatrix('Gov', [
      { id: 'allow', label: 'allow' },
      { id: 'drop', label: 'drop' },
      { id: 'map', label: 'map' },
      { id: 'own', label: 'own' },
    ], [
      { id: 'rule', label: 'rule' },
      { id: 'why', label: 'why' },
    ], [
      ['list', 'cost'],
      ['PII', 'safe'],
      ['old', 'join'],
      ['team', 'audit'],
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
    { heading: 'What it is', paragraphs: [
      'OpenTelemetry semantic conventions define common names for telemetry attributes. They cover resources, traces, metrics, logs, profiles, events, and domain-specific operations. The value is correlation: the same service, route, version, region, and error fields can connect metrics, traces, logs, dashboards, and alerts.',
      'Primary sources: semantic conventions overview at https://opentelemetry.io/docs/concepts/semantic-conventions/, resource semantic conventions at https://opentelemetry.io/docs/specs/semconv/resource/, and metrics semantic conventions at https://opentelemetry.io/docs/specs/semconv/general/metrics/.',
    ] },
    { heading: 'Attribute model', paragraphs: [
      'A Resource describes the entity that produced telemetry. Instrumentation scope identifies the library or component that emitted it. Spans, metrics, and logs carry attributes. Semantic conventions specify common keys so independent libraries and services can produce compatible telemetry.',
      'This links to Trace Context & Baggage Propagation, OpenTelemetry Collector, Metric Label Cardinality Control, Grafana Dashboard Query Transform Graph, and Metric Exemplars Trace Correlation.',
    ] },
    { heading: 'Schema drift', paragraphs: [
      'Telemetry schemas evolve. Attribute names change, units become standardized, and stability levels differ by convention. If producers upgrade independently without a translation plan, dashboards split, alerts miss data, and traces stop joining to metrics.',
      'Schema URLs, collector processors, allowlists, mapping rules, and dashboard tests are the practical controls. The system needs an evolution plan just like OpenAPI Contract Schema Evolution or Schema Registry.',
    ] },
    { heading: 'Complete case study: canary regression', paragraphs: [
      'A canary increases p99 latency. Metrics carry service.name, service.version, deployment.environment, http.route, and error.type. The dashboard filters the canary version, follows exemplars to traces, then finds logs with the same resource attributes. Because the names are stable, the investigation is a sequence of joins instead of manual search.',
    ] },
    { heading: 'Pitfalls and misconceptions', paragraphs: [
      'Semantic conventions do not automatically make telemetry cheap or safe. High-cardinality attributes still break metric systems. PII can still leak through logs or span attributes. Inconsistent units can still mislead dashboards. Conventions need governance, collector policy, and tests.',
    ] },
    { heading: 'Study next', paragraphs: [
      'Study OpenTelemetry Collector Case Study, Trace Context & Baggage Propagation, Metric Label Cardinality Control, Metric Exemplars Trace Correlation, Grafana Dashboard Query Transform Graph, Prometheus Rule Evaluation Alert State Machine, and PII Redaction Token Span Pipeline next.',
    ] },
  ],
};
