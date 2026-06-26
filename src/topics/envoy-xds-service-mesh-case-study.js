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
      heading: 'How to read the animation',
      paragraphs: [
        'The first view shows an xDS update flow. xDS is Envoy\'s family of discovery APIs: LDS sends listeners, RDS sends routes, CDS sends clusters, EDS sends endpoints, and SDS sends secrets. Active nodes are resources being delivered now, found nodes are resources the proxy has accepted, and compare nodes are dependencies that must be ready before traffic can use the change.',
        'The second view shows request handling after the proxy has configuration. The safe inference rule is: a request can use only the last configuration version that Envoy accepted, so a rejected update cannot corrupt the hot path. Watch the order of cluster, endpoint, and route changes because a route to a missing cluster is not a degraded state; it is invalid configuration.',
        {type:'callout', text:'The mesh works because policy changes travel as versioned xDS state to local proxies, keeping the request path independent of the control plane.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A service mesh exists because service-to-service networking became application logic. A checkout service may call payment, inventory, and shipping services, and every call needs load balancing, timeouts, retries, identity, and telemetry. If each language team implements those rules itself, the platform gets many slightly different failure policies.',
        'Envoy separates the data plane from the control plane. The data plane is the proxy that handles live requests, while the control plane computes desired configuration and streams it to proxies. That split lets operators change routing, certificates, and failure policy without rebuilding every application binary.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a shared client library. One library can wrap every outbound call, discover service endpoints, retry failed requests, add tracing headers, and enforce a timeout. This is simple when most services use one language and one release process.',
        'The approach is reasonable because it keeps the network code inside the process that makes the call. A Go service can expose normal functions, a Java service can reuse mature libraries, and tests can run without a sidecar. The hidden cost is that policy now ships at application speed.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is polyglot drift. A platform with Go, Java, Python, and Node services needs one traffic policy, but a library must be ported, upgraded, and correctly configured in every runtime. One stale library can keep using an expired TLS rule or a retry policy that the rest of the fleet has already abandoned.',
        'The second wall is emergency change. During an incident, the platform may need to shift 10 percent of traffic away from a bad region in seconds. Waiting for every service owner to rebuild, test, and deploy a library update turns network control into organizational coordination.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Move policy enforcement into a local proxy and move policy computation into a control plane. The proxy is close enough to the application to see every request, but separate enough to be upgraded and configured by the platform. xDS is the protocol boundary between those two jobs.',
        'The invariant is last-known-good configuration. Envoy may lag behind the newest desired state, but it should keep serving from a configuration it has accepted as internally valid. ACK and NACK messages make that invariant observable to the control plane.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Envoy starts from a bootstrap file that tells it how to contact the management server. It opens gRPC streams and subscribes to resource types. The control plane sends DiscoveryResponse messages with a version and nonce, and Envoy answers with DiscoveryRequest messages that ACK accepted resources or NACK invalid ones.',
        'The resource graph matters. A listener receives inbound traffic, a route chooses a cluster, a cluster describes an upstream pool, and endpoint discovery lists the actual backends. Aggregated Discovery Service can carry these resource types on one stream when ordering needs to be controlled.',
        'A canary rollout becomes data instead of code. The control plane first ensures the new cluster and endpoints exist, then pushes a route with a small weight for the new version. Envoy applies the accepted route locally, so request latency does not include a control-plane lookup.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is dependency preservation. A route is safe only if every referenced cluster is known, and a cluster is useful only if its endpoint set and transport settings are valid. If Envoy rejects a resource, the accepted version remains the version used for traffic.',
        'The data path is also isolated from control-plane outages. Once a proxy has accepted listeners, routes, clusters, endpoints, and secrets, it can continue serving while the stream reconnects. Availability comes from cached accepted state, not from asking the control plane on each request.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost behaves like proxy count times configuration churn. With 1,000 pods and one sidecar per pod, an endpoint change for a busy service can produce 1,000 update decisions even if only one backend moved. If autoscaling changes endpoints every minute, the control plane must debounce and batch those changes or it becomes the bottleneck.',
        'The request cost is an extra network hop through user-space proxy code. If a baseline internal RPC takes 4 ms and the sidecar adds 0.7 ms at each end, the call grows by roughly 35 percent. That tax may be fine for web APIs and too large for microsecond-sensitive systems.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Envoy xDS is used in service meshes such as Istio and in API gateways that need dynamic routing. It fits platforms where many services need the same identity, traffic-shaping, and observability rules. The access pattern is many local proxies reading centrally computed state.',
        'It also fits staged rollout work. A team can send 5 percent of traffic to a new version, watch error rate from proxy metrics, and roll back with another route update. The application code sees ordinary requests while the proxy enforces the traffic split.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A mesh fails when the proxy is heavier than the problem. Five services behind one load balancer may not need sidecars, ADS streams, certificate distribution, and mesh-specific debugging. A plain reverse proxy or shared library can be the better system.',
        'It also fails when operators treat accepted configuration as the same thing as desired configuration. A proxy may NACK a bad update and continue serving old policy. Debugging requires checking the control-plane desired state, the proxy config dump, and the request trace that actually failed.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose checkout-v1 handles 10,000 requests per minute and checkout-v2 should receive a 5 percent canary. The control plane first sends CDS for the checkout-v2 cluster and EDS for four v2 endpoints. Envoy ACKs those resources before any route sends traffic to them.',
        'The next RDS update gives checkout-v1 weight 95 and checkout-v2 weight 5. Out of 10,000 requests, about 500 should reach v2 and 9,500 should stay on v1. If v2 shows 3 percent errors while v1 shows 0.2 percent, the operator pushes the previous route version and Envoy returns to 100 percent v1.',
        'The correctness condition is visible in the numbers. A route weight of 5 is safe only after the v2 cluster and endpoints exist. If the route arrives first, Envoy should reject it or keep the older route because sending 500 requests per minute to nowhere is not a partial success.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Envoy xDS protocol documentation, Istio traffic management documentation, and the gRPC xDS protocol material. Study the ACK/NACK flow, ADS ordering, and resource warming before trying to design a control plane.',
        'Study next: load balancing, circuit breakers, distributed tracing, Kubernetes reconciliation, and certificate rotation. The common lesson is that control planes must compute desired state, deliver it in a dependency-safe order, and keep serving from the last accepted state when new state is bad.',
      ],
    },
  ],
};
