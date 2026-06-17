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
      heading: 'Why this exists',
      paragraphs: [
        'A service mesh exists because modern services cannot bake every traffic rule into application code. A checkout service may call inventory, payments, fraud, recommendations, and shipping. Each of those calls needs timeouts, retries, load balancing, mTLS, telemetry, and sometimes canary routing. Those rules change more often than the application binary should change. If every team implements them differently, the platform gets a pile of client libraries with inconsistent behavior.',
        'Envoy gives the platform a programmable data plane. Each application sends traffic through a local proxy or gateway. The proxy handles the repeated network work, while a control plane computes desired configuration and sends it to proxies. xDS is the family of APIs that carries this configuration: listeners, routes, clusters, endpoints, and secrets. The point is not only central control. The point is central control without putting that control service on the hot path of every request.',
      ],
    },
    {
      heading: 'The tempting wrong answer',
      paragraphs: [
        'The first naive design is a smart central router. Every request asks a control service where to go, what policy to apply, and whether the caller is allowed. This feels simple because one system owns the truth. It fails because the control service becomes a latency dependency and an availability dependency for every call. If the control plane slows down, the whole mesh slows down. If it is unreachable, services that already had enough local information can stop serving anyway.',
        'The second naive design is a pile of static proxy files. A deployment system writes a new YAML file beside each proxy, then restarts or reloads it. This removes the central hot-path dependency, but it makes rollout correctness hard. Routes can reference clusters that have not arrived yet. Endpoints can disappear before old connections drain. Certificates can rotate out of order. A global file edit can also create a large blast radius because every proxy may accept the same bad configuration at the same time.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Envoy splits the problem into two planes. The data plane must be fast, local, and able to keep serving with the last accepted configuration. The control plane can be slower and smarter because it computes desired state, validates it, and streams updates. xDS is the contract between the two. It decomposes proxy state into resource types so that the system can reason about dependencies instead of shipping one undifferentiated blob.',
        'LDS defines listeners: what ports exist and what filter chains run. RDS defines route configuration: how requests map to clusters. CDS defines clusters: named upstream pools and policies. EDS defines endpoints: concrete healthy backends inside those clusters. SDS can deliver secrets such as certificates and keys. A route should not point at a cluster that the proxy has not accepted. A cluster should not receive traffic before it has usable endpoints. This dependency ordering is the main systems lesson.',
      ],
    },
    {
      heading: 'How the system works',
      paragraphs: [
        'A control plane usually watches service discovery, deployment state, policy objects, certificate state, and rollout intent. From those inputs it builds a versioned snapshot of resources for each Envoy. Envoy keeps a management stream open and requests resources by type. The control plane responds with resources and version information. Envoy either ACKs a valid update or NACKs an invalid update with an error. This ACK and NACK loop matters because desired state is not enough. Operators need to know what the proxy actually accepted.',
        'On the request path, Envoy does not call the control plane. It accepts a connection through a listener, runs filters, matches a route, selects a cluster, applies load-balancing policy, chooses an endpoint, forwards the request, and emits telemetry. Retries, timeouts, circuit breakers, outlier detection, request IDs, spans, access logs, and metrics all happen inside the proxy from loaded configuration. The control plane changes the rules; the proxy applies the rules locally.',
        'Aggregated Discovery Service is useful because it lets several resource types share one stream. That does not erase dependency rules, but it makes ordering and observation easier. A safe rollout can publish a new cluster, warm endpoints, move a small percentage of route traffic, watch telemetry, increase traffic, and clean up the old cluster after in-flight work drains.',
        'Many production meshes also scope configuration by proxy identity. A gateway, a frontend sidecar, and a batch-worker sidecar should not all receive the same listeners and routes. The control plane filters resources by node metadata, workload labels, namespace, locality, and policy ownership. This reduces memory use and blast radius, and it makes accidental cross-tenant routing easier to detect.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The first view proves that service-mesh configuration is a graph, not a flat file. Listeners depend on routes, routes depend on clusters, clusters depend on endpoints, and secrets can sit under the transport layer. The important question is not simply whether the final desired graph is correct. The important question is whether every intermediate graph accepted by Envoy is safe to serve.',
        'The second view proves why the data plane must stay local. Once Envoy has valid resources, request handling is a sequence of local lookups and policy decisions. This is why a mesh can change traffic policy quickly without making a control-plane RPC for each request. It is also why loaded-config inspection, config dumps, and telemetry are operational necessities. They show the difference between what the platform wanted and what the proxy is actually doing.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The benefit is uniform traffic control. A platform team can apply mTLS, retries, timeouts, load balancing, tracing, rate limits, and canaries across languages. The cost is a new distributed system beside the old one. Proxies consume CPU and memory. Sidecars add hops and connection management. Control planes must scale fanout to many proxies and many resource versions. Operators now debug both the application and the mesh.',
        'There is also policy risk. Retries can amplify overload if timeout budgets are wrong. Circuit breakers can reject healthy traffic if thresholds are copied without understanding the service. Outlier detection can eject too many hosts during a partial incident. A mesh moves behavior out of application code, but the behavior still has to be designed. A bad global policy can fail faster than a bad local library because it can reach every workload through the control plane.',
        'The strongest mesh teams treat configuration like code. They run static validation, simulate dependency graphs, stage rollouts by cell or region, and keep emergency rollback paths simple. They also set ownership boundaries so that a service team can own its routes and timeouts while a platform team owns base mTLS, telemetry, and global safety limits.',
      ],
    },
    {
      heading: 'Real uses and failure modes',
      paragraphs: [
        'The common case is a canary. The control plane creates resources for checkout-v2, proves that endpoints exist, then moves one percent of traffic by changing routes. Metrics watch error rate, p99 latency, retry volume, saturation, and breaker overflow. Rollback is another route update. The application binary does not need to change. The same pattern supports regional failover, certificate rotation, gateway policy, multi-tenant routing, and gradual migration from one upstream service to another.',
        'The hard failures are usually control-plane correctness, not proxy forwarding. A route can be valid YAML and still unsafe because it points to an unwarmed cluster. A stale endpoint set can send traffic to dead hosts. A certificate push can break mTLS if trust roots and leaf certificates rotate in the wrong order. A proxy can keep serving old config after NACKing a new update, which is safer than accepting bad config but confusing if dashboards only show desired state. Mesh debugging must compare desired config, accepted config, and observed traffic.',
        'Capacity planning is part of the same story. Endpoint churn, autoscaling, and locality failover can create frequent EDS updates. A healthy control plane must batch, debounce, shard, and back pressure those updates so that the cure for traffic change does not become another source of instability.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Envoy dynamic configuration, the xDS protocol, ADS ordering, and Envoy config dumps in the official Envoy documentation. Then connect this topic to Load Balancer, Circuit Breakers and Deadlines, Distributed Tracing, OpenTelemetry Collector Case Study, Feature Flag Control Plane, and Kubernetes Reconciliation Case Study. The shared theme is control-plane design: compute desired state centrally, apply it locally, and measure whether the applied state is safe.',
      ],
    },
  ],
};
