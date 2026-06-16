// Envoy xDS service-mesh case study: a control plane streams listeners,
// routes, clusters, endpoints, and secrets into data-plane proxies.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'envoy-xds-service-mesh-case-study',
  title: 'Envoy xDS Service Mesh Case Study',
  category: 'Systems',
  summary: 'Envoy as a programmable data plane: xDS pushes listeners, routes, clusters, endpoints, and secrets while requests stay on the hot path.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['xDS update flow', 'request path safety'], defaultValue: 'xDS update flow' },
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

function envoyGraph(title) {
  return graphState({
    nodes: [
      { id: 'control', label: 'ctrl', x: 0.5, y: 3.6, note: 'config' },
      { id: 'ads', label: 'xDS', x: 2.8, y: 3.6, note: 'resources' },
      { id: 'lds', label: 'LDS', x: 4.5, y: 1.2, note: 'listeners' },
      { id: 'rds', label: 'RDS', x: 4.5, y: 2.8, note: 'routes' },
      { id: 'cds', label: 'CDS', x: 4.5, y: 4.4, note: 'clusters' },
      { id: 'eds', label: 'EDS', x: 4.5, y: 6.0, note: 'endpoints' },
      { id: 'envoy', label: 'Envoy', x: 7.0, y: 3.6, note: 'data plane' },
      { id: 'service', label: 'upstream', x: 9.3, y: 3.6, note: 'requests' },
    ],
    edges: [
      { id: 'e-control-ads', from: 'control', to: 'ads', weight: 'push' },
      { id: 'e-ads-lds', from: 'ads', to: 'lds', weight: 'LDS' },
      { id: 'e-ads-rds', from: 'ads', to: 'rds', weight: 'RDS' },
      { id: 'e-ads-cds', from: 'ads', to: 'cds', weight: 'CDS' },
      { id: 'e-ads-eds', from: 'ads', to: 'eds', weight: 'EDS' },
      { id: 'e-lds-envoy', from: 'lds', to: 'envoy', weight: 'listen' },
      { id: 'e-rds-envoy', from: 'rds', to: 'envoy', weight: 'route' },
      { id: 'e-cds-envoy', from: 'cds', to: 'envoy', weight: 'cluster' },
      { id: 'e-eds-envoy', from: 'eds', to: 'envoy', weight: 'endpoints' },
      { id: 'e-envoy-service', from: 'envoy', to: 'service', weight: 'proxy' },
    ],
  }, { title });
}

function* xdsUpdateFlow() {
  yield {
    state: envoyGraph('A control plane streams versioned xDS resources'),
    highlight: { active: ['control', 'ads', 'e-control-ads'], compare: ['envoy'] },
    explanation: 'Envoy separates control plane from data plane. The control plane computes desired proxy configuration and streams resource updates over xDS.',
  };

  yield {
    state: labelMatrix(
      'Core xDS resources',
      [
        { id: 'lds', label: 'LDS' },
        { id: 'rds', label: 'RDS' },
        { id: 'cds', label: 'CDS' },
        { id: 'eds', label: 'EDS' },
        { id: 'sds', label: 'SDS' },
      ],
      [
        { id: 'resource', label: 'resource' },
        { id: 'question', label: 'question answered' },
      ],
      [
        ['listener', 'what ports and filters exist?'],
        ['route config', 'which cluster gets this request?'],
        ['cluster', 'what upstream pool is named?'],
        ['endpoint set', 'which backends are healthy?'],
        ['secret', 'which certificates/keys apply?'],
      ],
    ),
    highlight: { active: ['lds:question', 'rds:question', 'cds:question', 'eds:question'], compare: ['sds:resource'] },
    explanation: 'xDS decomposes proxy configuration into resource types. That decomposition lets a control plane update endpoints, routes, clusters, and listeners independently.',
    invariant: 'The proxy should not route to resources it has not received consistently.',
  };

  yield {
    state: envoyGraph('Safe sequencing avoids routes to missing clusters'),
    highlight: { active: ['cds', 'eds', 'rds', 'lds', 'e-ads-cds', 'e-ads-eds', 'e-ads-rds', 'e-ads-lds'], found: ['envoy'] },
    explanation: 'For hitless changes, referenced clusters and endpoints must exist before routes or listeners point traffic at them. ADS helps coalesce sequencing through one management stream.',
  };

  yield {
    state: labelMatrix(
      'Update scenario',
      [
        { id: 'add', label: 'add cluster Y' },
        { id: 'warm', label: 'warm endpoints' },
        { id: 'route', label: 'move route' },
        { id: 'remove', label: 'remove old X' },
      ],
      [
        { id: 'xds', label: 'xDS move' },
        { id: 'risk', label: 'risk controlled' },
      ],
      [
        ['CDS first', 'route cannot point nowhere'],
        ['EDS next', 'cluster has backends'],
        ['RDS after ready', 'traffic switch is valid'],
        ['cleanup last', 'old in-flight traffic drains'],
      ],
    ),
    highlight: { found: ['add:xds', 'warm:xds', 'route:xds'], compare: ['remove:risk'] },
    explanation: 'A service-mesh rollout is a distributed configuration update. The order matters as much as the final config.',
  };
}

function* requestPathSafety() {
  yield {
    state: envoyGraph('Requests stay on the proxy hot path'),
    highlight: { active: ['envoy', 'service', 'e-envoy-service'], found: ['rds', 'cds', 'eds'] },
    explanation: 'Once configuration is loaded, Envoy handles request routing locally: listener accepts, route matches, cluster policy chooses an endpoint, and the proxy forwards.',
  };

  yield {
    state: labelMatrix(
      'Data-plane policies',
      [
        { id: 'lb', label: 'load balancing' },
        { id: 'retry', label: 'retries' },
        { id: 'breaker', label: 'circuit breakers' },
        { id: 'timeout', label: 'timeouts' },
        { id: 'obs', label: 'telemetry' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'failure', label: 'failure contained' },
      ],
      [
        ['choose backend', 'hotspot or dead host'],
        ['repeat safe failures', 'transient errors'],
        ['stop overload', 'cascading failure'],
        ['bound waiting', 'hung dependency'],
        ['emit spans/metrics', 'blind routing'],
      ],
    ),
    highlight: { active: ['lb:job', 'breaker:failure', 'timeout:failure'], found: ['obs:job'] },
    explanation: 'Envoy is not only a router. It is where retries, timeouts, load balancing, circuit breakers, and telemetry become consistent platform behavior.',
  };

  yield {
    state: envoyGraph('Telemetry connects data-plane behavior to rollout safety'),
    highlight: { active: ['envoy', 'control'], found: ['service', 'ads'], compare: ['lds', 'rds'] },
    explanation: 'A mature mesh closes the loop. The control plane pushes changes; telemetry from proxies shows whether those changes increased errors, latency, retries, or rejected requests.',
  };

  yield {
    state: labelMatrix(
      'Operational guardrails',
      [
        { id: 'config', label: 'config validation' },
        { id: 'drain', label: 'connection drain' },
        { id: 'blast', label: 'blast radius' },
        { id: 'debug', label: 'config dump' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'why', label: 'why it matters' },
      ],
      [
        ['will Envoy accept it?', 'bad config should not ship'],
        ['what about in-flight traffic?', 'avoid reset storms'],
        ['who receives the change?', 'limit regional failures'],
        ['what is actually loaded?', 'debug desired vs actual'],
      ],
    ),
    highlight: { active: ['config:why', 'debug:question'], found: ['blast:why'] },
    explanation: 'The service mesh is a control system. Validation, staged rollout, draining, config dumps, and telemetry keep it from becoming a cluster-wide failure amplifier.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'xDS update flow') yield* xdsUpdateFlow();
  else if (view === 'request path safety') yield* requestPathSafety();
  else throw new InputError('Pick an Envoy xDS view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Envoy is commonly used as a programmable data-plane proxy in gateways and service meshes. The control plane decides desired configuration. Envoy instances enforce that configuration near traffic. xDS is the family of discovery APIs used to deliver listeners, routes, clusters, endpoints, secrets, and related resources dynamically.',
        'The Envoy dynamic configuration overview explains that LDS, RDS, CDS, EDS, and related services allow most aspects of Envoy to be configured at runtime: https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/operations/dynamic_configuration. The xDS protocol documentation covers REST/gRPC delivery, versions, nonces, ACK/NACK behavior, and sequencing: https://www.envoyproxy.io/docs/envoy/latest/api-docs/xds_protocol.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A control plane watches service discovery, policy, certificates, deployment state, and operator intent. It converts that state into xDS resources. Listener Discovery Service says what sockets and filter chains exist. Route Discovery Service maps requests to clusters. Cluster Discovery Service defines upstream pools and policies. Endpoint Discovery Service lists concrete backends. Secret Discovery Service can deliver certificates and keys.',
        'Envoy keeps the request path local. A request hits a listener, flows through filters, matches a route, selects a cluster, picks an endpoint, and forwards. The control plane is not on every request. That separation is the entire point: dynamic policy with local data-plane speed.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The hard part is consistency. If a route points to a cluster before the cluster exists, traffic can fail. If endpoints are removed before old routes drain, in-flight requests can reset. Envoy documentation notes ordering constraints such as CDS before EDS, LDS after corresponding CDS/EDS, and RDS after related resources when pushing updates: https://www.envoyproxy.io/docs/envoy/latest/api-docs/xds_protocol. Aggregated Discovery Service can help sequence related resources through one stream.',
        'A mesh also centralizes blast radius. A bad route, retry policy, or circuit breaker setting can affect many services quickly. Production control planes need validation, staged rollout, config dumps, ownership, and telemetry.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Suppose checkout traffic currently routes to cluster checkout-v1. A new checkout-v2 deployment is ready for a 1 percent canary. The control plane first publishes CDS for checkout-v2, then EDS with healthy endpoints. Only after Envoy has the upstream does the control plane publish an RDS change that sends 1 percent of matching traffic to checkout-v2. Telemetry watches error rate, p99 latency, retries, and circuit-breaker overflow. If the canary is healthy, the route percentage increases. If not, RDS returns traffic to v1 without redeploying application code.',
        'That scenario connects Load Balancer, Circuit Breakers, Distributed Tracing, Feature Flag Control Plane, and OpenTelemetry Collector. The mesh is the shared traffic-control layer, but observability tells operators whether a control-plane decision worked.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A service mesh does not remove distributed-system failure. It moves much of the traffic policy into a shared proxy layer. That can be powerful or dangerous. Retries can amplify overload. Timeouts can be inconsistent. A control-plane outage should not stop existing data-plane traffic, but it may block safe updates. The actual loaded Envoy config can differ from desired state, so config dump and ACK/NACK visibility are operational requirements.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Official sources: Envoy dynamic configuration at https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/operations/dynamic_configuration, xDS protocol at https://www.envoyproxy.io/docs/envoy/latest/api-docs/xds_protocol, xDS API overview at https://www.envoyproxy.io/docs/envoy/latest/configuration/overview/xds_api, and Envoy examples at https://www.envoyproxy.io/docs/envoy/latest/configuration/overview/examples. Study Load Balancer, Circuit Breakers & Deadlines, Distributed Tracing, OpenTelemetry Collector Case Study, Feature Flag Control Plane, and Kubernetes Reconciliation Case Study next.',
      ],
    },
  ],
};
