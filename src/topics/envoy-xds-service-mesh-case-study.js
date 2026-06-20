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
        'The first view shows the xDS update flow: a control plane pushes versioned configuration resources through xDS streams into an Envoy data-plane proxy. Active (highlighted) nodes are the resources currently being pushed. Found markers show resources that Envoy has accepted and can serve from. Compare markers show components waiting to receive updates.',
        'The second view shows the request path after configuration is loaded. Active markers trace the hot path from proxy to upstream. Found markers show the policies (routes, clusters, endpoints) that Envoy resolves locally, without calling the control plane.',
        'At each frame, ask: what configuration changed, what dependency must already exist before this change is safe, and what would break if the order were reversed.',
        {type:'callout', text:'The mesh works because policy changes travel as versioned xDS state to local proxies, keeping the request path independent of the control plane.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A checkout service calls inventory, payments, fraud detection, recommendations, and shipping. Every one of those calls needs timeouts, retries, load balancing, mutual TLS, distributed tracing headers, and sometimes canary routing. Those cross-cutting concerns change far more often than the application binary. When each team implements them in application code, the platform accumulates inconsistent retry logic, missing mTLS, patchy observability, and no central way to shift traffic during an incident.',
        'The service mesh idea, first named by Buoyant co-founder William Morgan in 2017, is to move those concerns out of application code and into a shared infrastructure layer. Each service gets a sidecar proxy -- a small network process running beside the application container. The proxy handles mTLS termination, retry budgets, circuit breaking, load balancing, and telemetry emission. A separate control plane computes the desired configuration for every proxy and streams it down. The application sends plain HTTP or gRPC to localhost; the proxy does the rest.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Before service meshes, the standard answer was a shared client library. Netflix built the canonical example: Hystrix for circuit breaking (2012), Ribbon for client-side load balancing, and Eureka for service discovery. Twitter built Finagle (2011) for the same purpose. A service linked the library, and the library handled retries, timeouts, and load balancing in-process.',
        'This works well when every service is written in the same language. Netflix was a Java shop; Finagle was Scala. The library approach fails when services are polyglot -- a Python ML service, a Go API gateway, a Rust stream processor, and a Node.js frontend all need the same retry and mTLS behavior, but they cannot share a JVM library. Worse, upgrading the library means recompiling and redeploying every service that links it. A security patch in the mTLS handshake requires touching hundreds of binaries.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The library approach breaks on two constraints simultaneously. First, polyglot services cannot share one library, so teams either rewrite networking code per language or accept inconsistent behavior. Second, upgrading a library requires redeploying the application, so a platform team cannot roll out a TLS fix or a retry policy change without coordinating with every service owner.',
        'The invariant that must hold is: every service in the mesh enforces the same mTLS policy, the same retry budget, and the same observability contract, regardless of language, deploy cadence, or team ownership. A library-per-language approach cannot guarantee this because compliance depends on each team linking the right version. One stale dependency breaks the invariant for the whole mesh.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The sidecar proxy runs as a separate process (or container) next to each application instance. In Kubernetes, Istio injects an Envoy sidecar into every pod via a mutating admission webhook. Linkerd injects its own Rust-based linkerd2-proxy the same way. The application\'s outbound traffic is transparently redirected to the sidecar using iptables rules or eBPF hooks. The application never knows the proxy exists.',
        'The control plane computes desired state for every proxy. Istio\'s control plane (Istiod, consolidated from Pilot/Mixer/Citadel in Istio 1.5, 2020) watches Kubernetes services, deployments, and Istio custom resources, then synthesizes Envoy configuration. It streams this configuration over xDS -- a family of gRPC-based discovery APIs. LDS delivers listener definitions (what ports to open, which filter chains to run). RDS delivers route tables (which cluster handles each URL path). CDS delivers cluster definitions (upstream service pools and their policies). EDS delivers endpoint sets (the actual pod IPs and health status). SDS delivers TLS certificates and keys for mTLS.',
        'Envoy holds a long-lived gRPC stream to the control plane, requests resources by type, and ACKs or NACKs each update. A NACK means the proxy rejected invalid configuration and keeps serving the last good version. This ACK/NACK protocol is critical: the control plane knows what each proxy is actually running, not just what it was told to run.',
        'For mTLS, the control plane acts as a certificate authority. Istiod issues short-lived SPIFFE certificates (typically 24-hour TTL) to each sidecar via SDS. The sidecar terminates inbound TLS and initiates outbound TLS, so service-to-service traffic is encrypted and identity-verified without application code changes. Certificate rotation happens through SDS pushes -- no pod restart required.',
        'Traffic splitting for canary deploys works through weighted route rules. The control plane pushes an RDS update that sends 1% of requests to checkout-v2 and 99% to checkout-v1. After watching error rates and latency through proxy-emitted metrics, the operator increases the weight. Rollback is another RDS push. The application binary does not change.',
        'Circuit breaking is configured per cluster in CDS. Envoy tracks outstanding requests, pending connections, and consecutive failures per upstream. When a threshold is crossed, new requests get an immediate 503 instead of piling onto an overloaded backend. Outlier detection ejects individual endpoints that exceed error thresholds, reducing blast radius without tripping the whole circuit.',
        'Distributed tracing works because the sidecar injects or propagates trace headers (B3, W3C Trace Context) on every request. The application must forward incoming trace headers on its outbound calls, but the sidecar handles span creation, timing, and export to collectors like Jaeger or Zipkin.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The architecture works because it separates the frequency of change from the blast radius of change. Networking policy (retries, timeouts, mTLS, traffic splits) changes often, but each change is a small xDS push to a proxy -- not a recompile and redeploy of the application. The application binary changes less often, and when it does, the networking layer is unaffected.',
        'The correctness argument rests on dependency ordering. A safe configuration update must satisfy: (1) a cluster exists before any route references it, (2) endpoints are healthy before a cluster receives traffic, (3) certificates are valid before mTLS is enforced. Aggregated Discovery Service (ADS) serializes these resource types onto one gRPC stream so the control plane can enforce ordering. If a proxy receives a route pointing to a cluster it has not yet accepted, it NACKs. The invariant is: at every moment, the proxy\'s accepted configuration is internally consistent, even if it lags behind desired state.',
        'This consistency model -- last-known-good with incremental updates -- is the same pattern used in DNS (serve cached records while refreshing), BGP (keep the last valid route table during a peer reset), and browser service workers (serve the cached version while fetching the new one). The proxy never blocks the data path waiting for the control plane.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Each Envoy sidecar consumes roughly 50-100 MB of memory and a fractional CPU core at idle, scaling with the number of active connections and configured routes. For a cluster running 500 pods, that is 25-50 GB of memory dedicated to proxies. Latency overhead per hop is typically 0.5-2 ms for the extra userspace TCP termination and re-initiation, measured by both Istio and Linkerd benchmarks. For most web services this is negligible; for latency-sensitive paths (sub-millisecond internal RPCs), it is measurable.',
        'Control-plane load scales with the number of proxies times the rate of configuration change. Endpoint churn from autoscaling, rolling deploys, and health check flapping generates frequent EDS updates. Istiod must debounce, batch, and shard these updates. A 5,000-pod cluster with aggressive autoscaling can generate thousands of EDS pushes per minute. Without backpressure, the control plane itself becomes a source of instability.',
        'Operational complexity is real. Debugging now requires comparing three layers: application behavior, proxy configuration (Envoy admin API config_dump), and control-plane desired state (istioctl proxy-status). A request failure could be an application bug, a stale route, a tripped circuit breaker, a certificate expiry, or an outlier ejection. Teams need mesh-specific observability tooling (Kiali, Linkerd dashboard, istioctl analyze) on top of their existing monitoring.',
        'Retry amplification is the most dangerous policy failure. If service A retries 3 times and calls service B which retries 3 times on service C, a single failure at C generates up to 9 requests. With deeper call chains, retries multiply exponentially. Mesh operators must set retry budgets (Istio retryBudget, Linkerd retry budgets) that cap total retry volume as a percentage of baseline traffic.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Istio (Google/IBM/Lyft, first stable release 2018) is the most widely deployed mesh, running in production at Airbnb, eBay, Salesforce, and AutoTrader UK. It uses Envoy as its data plane and provides the richest policy surface: traffic management, security (mTLS, authorization policies), and observability. The trade-off is operational weight -- Istiod is a substantial control plane to operate and tune.',
        'Linkerd (Buoyant, v2 rewritten in Rust and Go, 2018) targets simplicity. Its Rust-based micro-proxy uses roughly half the memory of Envoy and adds sub-millisecond latency. Linkerd graduated from CNCF in 2024 and is used by Microsoft, Nordstrom, and HP. It deliberately limits its policy surface to keep operations simple.',
        'Consul Connect (HashiCorp, 2018) integrates service mesh with Consul\'s existing service discovery and key-value store. It supports Envoy as a data plane but also has a built-in proxy for simpler deployments. It works across Kubernetes and traditional VMs, which suits organizations with mixed infrastructure.',
        'AWS App Mesh (2019) provides a managed control plane for Envoy proxies running on ECS, EKS, or EC2. It removes the burden of operating Istiod but limits configurability to what the AWS API surface exposes.',
        'The common thread: service meshes win in organizations running tens to hundreds of microservices across multiple languages, where consistent mTLS, traffic management, and observability justify the infrastructure cost.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Small deployments pay the full complexity cost without enough services to justify it. A team running five Go services behind a single load balancer gets mTLS and retries cheaper from a shared library or a simple reverse proxy than from a full mesh installation.',
        'High-performance paths suffer from the extra hop. Game servers, high-frequency trading systems, and real-time media pipelines operate at microsecond budgets where 1-2 ms of proxy latency is unacceptable. These systems use kernel-bypass networking (DPDK, io_uring) and cannot afford userspace proxying.',
        'Debugging complexity catches teams off guard. When a request fails, the cause might live in the application, the sidecar\'s loaded configuration, the control plane\'s desired state, a certificate rotation race, or an outlier ejection. Comparing config_dump output across sidecars, tracing xDS push history, and correlating proxy access logs with application logs requires dedicated tooling and training. Organizations that adopt a mesh without investing in mesh observability often end up with a system they cannot effectively troubleshoot.',
        'Control-plane failures have outsized blast radius. A bug in Istiod that pushes bad configuration can break mTLS across every service simultaneously. Istio mitigates this with staged rollouts and NACKing, but the failure mode is qualitatively different from a library bug that affects one service at a time.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Scenario: deploy checkout-v2 alongside checkout-v1, shift 5% of traffic, validate, then complete the rollout.',
        'Step 1 -- The platform team creates a Kubernetes Deployment for checkout-v2 with 2 replicas. Istio\'s webhook injects Envoy sidecars. Istiod detects the new pods and pushes CDS resources defining a "checkout-v2" cluster to every relevant proxy.',
        'Step 2 -- Istiod pushes EDS resources listing the two checkout-v2 pod IPs as endpoints. The proxies ACK both CDS and EDS. At this point checkout-v2 exists in the mesh but receives zero traffic because no route points to it.',
        'Step 3 -- The team applies a VirtualService with a 95/5 traffic split. Istiod computes a new RDS resource: 95% weight to checkout-v1 cluster, 5% weight to checkout-v2 cluster. Proxies ACK the route update. Traffic begins flowing to v2.',
        'Step 4 -- The team monitors Envoy-emitted metrics: request success rate, p99 latency, and retry volume for the checkout-v2 cluster. After 30 minutes with no anomalies, they update the VirtualService to 50/50. Another RDS push, another ACK.',
        'Step 5 -- Satisfied with metrics, the team shifts to 100% checkout-v2. Istiod pushes a final RDS update removing checkout-v1 from the route. After a drain period (Envoy\'s drain_timeout lets in-flight requests complete), the team scales checkout-v1 to zero replicas. Istiod pushes an EDS update removing the old endpoints and eventually a CDS update removing the old cluster.',
        'The ordering was: CDS (create cluster) then EDS (register endpoints) then RDS (shift traffic) then RDS (remove old route) then EDS/CDS (clean up old resources). Reversing any of these steps -- routing traffic before endpoints exist, or removing a cluster before draining its routes -- would cause request failures.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: the Envoy xDS protocol specification in the Envoy documentation (envoyproxy.io/docs/envoy/latest/api-docs/xds_protocol). For the sidecar pattern origin, see William Morgan\'s "What\'s a service mesh? And why do I need one?" (2017, buoyant.io). For Istio architecture, see the Istio documentation (istio.io/latest/docs/ops/deployment/architecture/). For Linkerd\'s design choices, see the Linkerd architecture docs (linkerd.io/2/reference/architecture/).',
        'Study next: Load Balancing (the policy layer inside each proxy), Circuit Breakers and Deadlines (how Envoy prevents cascade failures), Distributed Tracing (how sidecars propagate trace context), Kubernetes Reconciliation (the control-loop pattern that Istiod follows), and mTLS Certificate Rotation (how SDS delivers short-lived certificates without downtime). The shared theme across all of these is control-plane design: compute desired state centrally, apply it locally, and measure whether reality matches intent.',
      ],
    },
  ],
};

