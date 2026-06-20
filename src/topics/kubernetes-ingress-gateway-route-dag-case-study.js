// Kubernetes Ingress and Gateway API: host/path/listener rules become a route
// graph that controllers translate into proxy configuration.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'kubernetes-ingress-gateway-route-dag-case-study',
  title: 'Kubernetes Ingress and Gateway Route DAG Case Study',
  category: 'Systems',
  summary: 'How Ingress and Gateway API resources map host, path, listener, TLS, backend references, and controller status into an HTTP route graph.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['ingress rule graph', 'gateway attachment'], defaultValue: 'ingress rule graph' },
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

function routeGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'client', label: 'client', x: 0.6, y: 3.8, note: notes.client ?? 'HTTPS' },
      { id: 'lb', label: 'edge LB', x: 2.1, y: 3.8, note: notes.lb ?? 'public IP' },
      { id: 'ctl', label: 'controller', x: 3.8, y: 1.9, note: notes.ctl ?? 'reconcile' },
      { id: 'ing', label: 'Ingress', x: 3.8, y: 3.8, note: notes.ing ?? 'rules' },
      { id: 'host', label: 'host', x: 5.4, y: 2.5, note: notes.host ?? 'shop.com' },
      { id: 'path', label: 'path', x: 5.4, y: 5.1, note: notes.path ?? '/cart' },
      { id: 'svc', label: 'Service', x: 7.2, y: 3.8, note: notes.svc ?? 'cart-svc' },
      { id: 'slice', label: 'slices', x: 8.7, y: 3.8, note: notes.slice ?? 'backends' },
      { id: 'status', label: 'status', x: 3.8, y: 6.1, note: notes.status ?? 'address' },
    ],
    edges: [
      { id: 'e-client-lb', from: 'client', to: 'lb' },
      { id: 'e-lb-ing', from: 'lb', to: 'ing' },
      { id: 'e-ctl-ing', from: 'ctl', to: 'ing' },
      { id: 'e-ing-host', from: 'ing', to: 'host' },
      { id: 'e-ing-path', from: 'ing', to: 'path' },
      { id: 'e-host-svc', from: 'host', to: 'svc' },
      { id: 'e-path-svc', from: 'path', to: 'svc' },
      { id: 'e-svc-slice', from: 'svc', to: 'slice' },
      { id: 'e-ctl-status', from: 'ctl', to: 'status' },
    ],
  }, { title });
}

function gatewayGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'class', label: 'Class', x: 0.8, y: 3.8, note: notes.class ?? 'implementation' },
      { id: 'gw', label: 'Gateway', x: 2.5, y: 3.8, note: notes.gw ?? 'listeners' },
      { id: 'l443', label: ':443', x: 4.2, y: 2.4, note: notes.l443 ?? 'HTTPS' },
      { id: 'l80', label: ':80', x: 4.2, y: 5.2, note: notes.l80 ?? 'redirect' },
      { id: 'routeA', label: 'Route A', x: 6.0, y: 2.4, note: notes.routeA ?? 'shop' },
      { id: 'routeB', label: 'Route B', x: 6.0, y: 5.2, note: notes.routeB ?? 'api' },
      { id: 'svcA', label: 'svc A', x: 7.8, y: 2.4, note: notes.svcA ?? 'cart' },
      { id: 'svcB', label: 'svc B', x: 7.8, y: 5.2, note: notes.svcB ?? 'orders' },
      { id: 'cond', label: 'status', x: 9.2, y: 3.8, note: notes.cond ?? 'Accepted' },
    ],
    edges: [
      { id: 'e-class-gw', from: 'class', to: 'gw' },
      { id: 'e-gw-l443', from: 'gw', to: 'l443' },
      { id: 'e-gw-l80', from: 'gw', to: 'l80' },
      { id: 'e-l443-routeA', from: 'l443', to: 'routeA' },
      { id: 'e-l443-routeB', from: 'l443', to: 'routeB' },
      { id: 'e-routeA-svcA', from: 'routeA', to: 'svcA' },
      { id: 'e-routeB-svcB', from: 'routeB', to: 'svcB' },
      { id: 'e-routeA-cond', from: 'routeA', to: 'cond' },
      { id: 'e-routeB-cond', from: 'routeB', to: 'cond' },
    ],
  }, { title });
}

function* ingressRuleGraph() {
  yield {
    state: routeGraph('Ingress maps external HTTP routes to Services'),
    highlight: { active: ['client', 'lb', 'ing', 'e-client-lb', 'e-lb-ing'], found: ['svc'] },
    explanation: 'Ingress is an HTTP routing object. It describes how external host and path rules reach Services, while an Ingress controller turns that object into real proxy or load-balancer configuration.',
  };

  yield {
    state: routeGraph('Host and path rules form a route DAG', { host: 'shop.com', path: '/cart', svc: 'cart' }),
    highlight: { active: ['ing', 'host', 'path', 'svc', 'e-ing-host', 'e-ing-path', 'e-host-svc', 'e-path-svc'], compare: ['slice'] },
    explanation: 'The data structure is a route graph. Host match, path match, TLS secret, backend Service, and EndpointSlices are separate nodes joined by references and controller interpretation.',
    invariant: 'A route is not serving until the controller has accepted it and programmed the data plane.',
  };

  yield {
    state: labelMatrix(
      'Ingress fields',
      [
        { id: 'class', label: 'class' },
        { id: 'tls', label: 'TLS' },
        { id: 'host', label: 'host' },
        { id: 'path', label: 'path' },
        { id: 'backend', label: 'backend' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['ctrl', 'owner'],
        ['cert', 'expiry'],
        ['name', 'drift'],
        ['match', 'shadow'],
        ['svc', 'no ep'],
      ],
    ),
    highlight: { active: ['host:role', 'path:role', 'backend:role'], found: ['tls:risk'] },
    explanation: 'Most Ingress failures are reference failures: wrong class, wrong certificate, ambiguous host/path, Service without endpoints, or status that never updates.',
  };

  yield {
    state: routeGraph('Controller status closes the operational loop', { ctl: 'program proxy', status: 'ready IP' }),
    highlight: { active: ['ctl', 'status', 'e-ctl-ing', 'e-ctl-status'], found: ['lb', 'svc'] },
    explanation: 'Ingress is only desired state until a controller acts. Status gives the observable result: assigned address, accepted config, or error conditions depending on implementation.',
  };
}

function* gatewayAttachment() {
  yield {
    state: gatewayGraph('Gateway separates infrastructure owners from route owners'),
    highlight: { active: ['class', 'gw', 'l443', 'e-class-gw', 'e-gw-l443'], compare: ['routeA', 'routeB'] },
    explanation: 'Gateway API splits concerns more explicitly than Ingress. Infrastructure teams own GatewayClass and Gateway listeners. Application teams attach HTTPRoute resources when allowed.',
  };

  yield {
    state: gatewayGraph('Routes attach to listeners and point at Services', { routeA: 'shop/cart', routeB: 'api/orders', cond: 'Accepted' }),
    highlight: { active: ['l443', 'routeA', 'routeB', 'svcA', 'svcB', 'e-l443-routeA', 'e-routeA-svcA'], found: ['cond'] },
    explanation: 'Gateway routing is a graph with attachment edges. A route must match an allowed listener and reference valid backends before the controller should mark it accepted.',
  };

  yield {
    state: labelMatrix(
      'Ingress versus Gateway',
      [
        { id: 'shape', label: 'shape' },
        { id: 'owners', label: 'owners' },
        { id: 'status', label: 'status' },
        { id: 'future', label: 'future' },
      ],
      [
        { id: 'ing', label: 'Ingress' },
        { id: 'gw', label: 'Gateway' },
      ],
      [
        ['single', 'split'],
        ['mixed', 'roles'],
        ['varies', 'conds'],
        ['frozen', 'next'],
      ],
    ),
    highlight: { active: ['owners:gw', 'status:gw', 'future:gw'], compare: ['future:ing'] },
    explanation: 'Ingress remains stable and widely used, but the Kubernetes docs recommend Gateway API for new richer routing needs because Ingress is frozen.',
  };

  yield {
    state: labelMatrix(
      'Complete case: multi-team edge',
      [
        { id: 'infra', label: 'infra' },
        { id: 'shop', label: 'shop' },
        { id: 'api', label: 'api' },
        { id: 'ops', label: 'ops' },
      ],
      [
        { id: 'object', label: 'object' },
        { id: 'check', label: 'check' },
      ],
      [
        ['Gateway', 'TLS'],
        ['Route', 'host'],
        ['Route', 'svc'],
        ['conds', 'accept'],
      ],
    ),
    highlight: { active: ['infra:object', 'shop:object', 'ops:check'], found: ['api:check'] },
    explanation: 'A shared edge gateway can accept routes from several teams without giving every team direct control of listeners and certificates. The important record is the route graph plus status conditions.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'ingress rule graph') yield* ingressRuleGraph();
  else if (view === 'gateway attachment') yield* gatewayAttachment();
  else throw new InputError('Pick a Kubernetes Ingress/Gateway view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The Ingress view builds the route graph one reference at a time. Active (highlighted) nodes are the objects currently being resolved by the controller. Found nodes are the targets those references point to. The key moment is when the controller node activates and connects to the status node -- that is when desired state becomes observed state. Until that edge appears, the route exists only on paper.',
        'The Gateway view separates the graph into two ownership zones. Infrastructure nodes (GatewayClass, Gateway, listeners) light up first. Application nodes (Routes, Services) attach only after the listener allows them. The status node at the end records whether each attachment was accepted or rejected. A route that never reaches the status node is a route that never serves traffic.',
        {type:'callout', text:'A route is live only after the controller validates the reference graph and records status, not when the YAML first exists.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/6/63/Pod-networking.png', alt:'Diagram of Kubernetes Pods connected through a Service and Pod IP addresses.', caption:'Kubernetes pod networking and service dependency diagram by Marvin The Paranoid, Wikimedia Commons, CC BY-SA 4.0.'},
        { type: 'note', text: 'Safe inference rule: if a node is active but the status node has not turned found, the route is not yet serving. The controller has not closed the reconciliation loop. Do not assume traffic flows just because the YAML was applied.' },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A Kubernetes Service gives a set of Pods a stable cluster-internal IP address and DNS name. It does not answer three questions that every production deployment eventually asks: which public hostname should terminate TLS for this application, which URL paths should reach which backend, and which team is allowed to attach routes to a shared edge listener.',
        { type: 'quote', attribution: 'Kubernetes documentation, Ingress', text: 'Ingress exposes HTTP and HTTPS routes from outside the cluster to services within the cluster. Traffic routing is controlled by rules defined on the Ingress resource.' },
        'Without a declarative routing layer, operators configure edge proxies by hand -- editing NGINX config files, writing Envoy YAML, or clicking through cloud load-balancer consoles. That works for one service behind one domain. It breaks when twenty teams share three hostnames, rotate certificates on different schedules, and need to know whether their route is actually live.',
        'Ingress (stable since Kubernetes 1.19) and Gateway API (graduated to GA in Kubernetes 1.31 for core resources) exist to store the desired HTTP route graph inside the Kubernetes API. A controller watches those objects, compiles them into real proxy configuration, and writes status back. The result is that edge routing becomes auditable, reconcilable, and role-separated -- the same properties Kubernetes gives to compute scheduling.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first instinct is to let each team manage its own edge. Team A creates an AWS ALB. Team B writes an NGINX server block. Team C adds a Cloudflare rule. Each path is self-contained and fast to set up.',
        { type: 'bullets', items: [
          'Team A can rotate their certificate without coordinating.',
          'Team B can change path routing without understanding Team A\'s proxy.',
          'Each team owns its blast radius.',
        ] },
        'This approach works until teams share infrastructure. Two teams need the same hostname. A certificate covers a wildcard that three services use. A path prefix claimed by one team shadows another team\'s routes. Now every change requires cross-team coordination, and no single system records who owns what.',
        'Kubernetes also loses observability when the edge lives outside the API. A Deployment can declare the app is running, but no Kubernetes object can tell you whether the public route was accepted, rejected, shadowed by a conflicting rule, or still waiting for a controller that is not installed.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The edge is a shared, ordered data structure with five interacting constraints:',
        { type: 'table', headers: ['Constraint', 'What breaks', 'Example'], rows: [
          ['Hostname uniqueness', 'Two Ingress objects claim the same host; controller picks one silently', 'Both team-a and team-b declare shop.example.com'],
          ['Path precedence', 'A broader path shadows a more specific one', '/api matches before /api/v2 depending on pathType'],
          ['TLS secret lifecycle', 'Certificate expires or Secret is deleted; TLS handshake fails', 'cert-manager renewal fails; old Secret garbage-collected'],
          ['Backend health', 'Service exists but has zero ready endpoints', 'Deployment scaled to zero or failing readiness probes'],
          ['Ownership ambiguity', 'Infrastructure and app concerns mixed in one object', 'App team edits Ingress annotations that change global proxy behavior'],
        ] },
        'Ingress solved the first version of this problem by putting host rules, path rules, TLS references, and backend references into a single Kubernetes object. A controller translates that object into proxy config. But Ingress bundles infrastructure concerns (which listener, which certificate, which proxy implementation) with application concerns (which path, which backend) into the same resource. The Kubernetes project froze the Ingress API at networking.k8s.io/v1 -- no new fields will be added.',
        { type: 'note', text: 'Ingress is frozen, not deprecated. It remains stable and widely deployed. Gateway API is the active development path for new routing capabilities. The two coexist in most clusters.' },
        'Gateway API was designed to split those concerns across explicit roles: infrastructure providers own GatewayClass, platform teams own Gateway and listeners, application teams own HTTPRoute resources. The wall that Ingress hit -- ownership and extensibility -- is the design center of Gateway API.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Edge routing in Kubernetes is not a list of rules. It is a directed acyclic graph of typed references, where each edge carries both a routing decision and an ownership boundary.',
        { type: 'diagram', alt: 'The route DAG from DNS through listener to backend, showing two kinds of edges.', label: 'Route DAG structure', body: 'DNS --> LoadBalancer --> Listener --> HostMatch --> PathMatch --> Service --> EndpointSlice --> Pod\n                                  |                                    |\n                           ownership edge                        routing edge\n                     (who may attach here?)               (where does traffic go?)\n\nIngress compresses Listener + Host + Path + Backend into one object.\nGateway API expands each into a separate resource with explicit attachment rules.' },
        'Ingress compresses this graph. An Ingress object contains the host rule, path rule, TLS reference, and backend reference together. IngressClass selects the controller. Status reports the result. The graph exists, but it is implicit -- you reconstruct it by reading the spec fields.',
        'Gateway API makes the graph explicit. GatewayClass declares the implementation. Gateway defines listeners (port, protocol, TLS config, allowed route namespaces). HTTPRoute attaches to a listener via a parentRef and declares its own host matches, path matches, and backend references. Each attachment is a graph edge that the controller must validate before traffic flows.',
        'The graph has two kinds of edges. Routing edges describe where traffic can go: listener to host match, path match to backend Service, Service to EndpointSlice. Ownership edges describe who is allowed to create those routing edges: which namespaces can attach routes to which listeners, which routes can reference which backends across namespaces. Gateway API makes ownership edges first-class objects with explicit allow/deny semantics.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The Ingress path and the Gateway API path follow the same reconciliation pattern but with different object granularity.',
        { type: 'code', language: 'yaml', body: '# Ingress: one object holds host, path, TLS, backend\napiVersion: networking.k8s.io/v1\nkind: Ingress\nmetadata:\n  name: shop-ingress\n  annotations:\n    nginx.ingress.kubernetes.io/ssl-redirect: "true"\nspec:\n  ingressClassName: nginx\n  tls:\n    - hosts: [shop.example.com]\n      secretName: shop-tls\n  rules:\n    - host: shop.example.com\n      http:\n        paths:\n          - path: /cart\n            pathType: Prefix\n            backend:\n              service:\n                name: cart-svc\n                port:\n                  number: 80' },
        'An Ingress controller (nginx-ingress-controller, Traefik, HAProxy, AWS ALB controller, etc.) watches Ingress objects matching its IngressClass. For each object, it resolves the TLS Secret, validates host and path rules, looks up the backend Service and its EndpointSlices, generates proxy configuration, and pushes that configuration to the data plane. On success, it writes the load-balancer IP or hostname into the Ingress status.',
        { type: 'code', language: 'yaml', body: '# Gateway API: separate objects for infrastructure and routes\napiVersion: gateway.networking.k8s.io/v1\nkind: Gateway\nmetadata:\n  name: shop-gateway\n  namespace: infra\nspec:\n  gatewayClassName: istio\n  listeners:\n    - name: https\n      port: 443\n      protocol: HTTPS\n      hostname: "*.example.com"\n      tls:\n        certificateRefs:\n          - name: wildcard-tls\n      allowedRoutes:\n        namespaces:\n          from: Selector\n          selector:\n            matchLabels:\n              gateway-access: "true"\n---\napiVersion: gateway.networking.k8s.io/v1\nkind: HTTPRoute\nmetadata:\n  name: cart-route\n  namespace: shop-team\nspec:\n  parentRefs:\n    - name: shop-gateway\n      namespace: infra\n      sectionName: https\n  hostnames: [shop.example.com]\n  rules:\n    - matches:\n        - path:\n            type: PathPrefix\n            value: /cart\n      backendRefs:\n        - name: cart-svc\n          port: 80' },
        'A Gateway controller starts one layer earlier. It provisions or configures the listener infrastructure (cloud load balancer, Envoy proxy, Istio gateway pod). When an HTTPRoute is created, the controller checks: does the route\'s parentRef point to a valid listener? Does the route\'s namespace satisfy the listener\'s allowedRoutes selector? Are the backend references valid? Only if all edges in the graph are valid does the controller program the data plane and set the route\'s status condition to Accepted.',
        'At request time, the proxy does not re-read YAML. It uses the compiled route table: listener socket, TLS context, hostname match (exact before wildcard), path match (longest prefix wins, then exact, then regex), header or query parameter matches, backend cluster, and endpoint list. The Kubernetes API stores the graph; the data plane executes it.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A retail company runs shop.example.com on Kubernetes. Three teams share the edge:',
        { type: 'table', headers: ['Team', 'Owns', 'Kubernetes object', 'Namespace'], rows: [
          ['Platform', 'Gateway, TLS cert, public IP', 'Gateway shop-gateway', 'infra'],
          ['Cart', '/cart routes', 'HTTPRoute cart-route', 'shop-cart'],
          ['Orders', '/orders routes', 'HTTPRoute orders-route', 'shop-orders'],
        ] },
        'The platform team creates the Gateway with an HTTPS listener on port 443 and a namespace selector requiring the label gateway-access: "true". Both the shop-cart and shop-orders namespaces carry that label.',
        'The cart team applies their HTTPRoute. The controller validates the parentRef, checks the namespace label, resolves cart-svc in the shop-cart namespace, confirms EndpointSlices have ready addresses, programs the route into Envoy, and sets the route status:',
        { type: 'code', language: 'yaml', body: 'status:\n  parents:\n    - parentRef:\n        name: shop-gateway\n        namespace: infra\n        sectionName: https\n      controllerName: istio.io/gateway-controller\n      conditions:\n        - type: Accepted\n          status: "True"\n          reason: Accepted\n        - type: ResolvedRefs\n          status: "True"\n          reason: ResolvedRefs' },
        'The cart team can verify their route is live by checking these conditions. They do not need access to the infra namespace, the Gateway object, or the proxy configuration. The platform team can rotate the wildcard TLS certificate without touching any HTTPRoute. If the orders team deploys a route for /cart/checkout, path precedence rules (longest prefix match) determine which route wins -- and both teams can see the result in their respective status conditions.',
        'This is the compiler analogy: Kubernetes route objects are source code, the controller is the compiler, the proxy configuration is the compiled binary, and status conditions are the compiler output. A deployment is not done when the source is written; it is done when the compiler reports success and the binary is running.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on three properties of the reconciliation loop:',
        { type: 'bullets', items: [
          'Desired state is declarative. The route graph stored in the API is the single source of truth. The controller converges the data plane toward it, not the other way around.',
          'Reconciliation is idempotent. Applying the same manifest twice produces the same proxy configuration. The controller can crash and restart without corrupting the route table.',
          'Status is observable. Every route object carries conditions that report whether the controller accepted it, whether references resolved, and whether the data plane was programmed. The gap between "YAML applied" and "traffic serving" is visible.',
        ] },
        { type: 'note', text: 'A route is not live because the object exists. A route is live when the controller has set Accepted: True and the data plane has been programmed. Treating kubectl apply as deployment-complete is the single most common Kubernetes routing mistake.' },
        'Gateway API adds a fourth property: attachment is explicit. An HTTPRoute must satisfy the listener\'s allowedRoutes policy before the controller will even attempt to program it. This prevents a rogue namespace from injecting routes into shared infrastructure. The ownership graph is enforced by the controller, not just by RBAC on the Kubernetes API.',
        'Together, these properties mean that the route graph is self-describing. An operator debugging a 404 does not need to read proxy config files or guess which NGINX reload happened last. They walk the graph: DNS record, load-balancer IP, Gateway listener, HTTPRoute match rules, Service endpoints, Pod readiness. Every node in the graph has status.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        { type: 'table', headers: ['Cost dimension', 'Ingress', 'Gateway API'], rows: [
          ['Object count per route', '1 (Ingress)', '3-4 (GatewayClass + Gateway + HTTPRoute + optional ReferenceGrant)'],
          ['Controller reconciliation', 'Watch Ingress + Secrets + Services', 'Watch GatewayClass + Gateway + *Route + ReferenceGrant + Services'],
          ['Propagation delay', 'Seconds (NGINX reload) to minutes (cloud LB provision)', 'Same range, depends on controller implementation'],
          ['Status granularity', 'IP/hostname only in core spec', 'Per-parent conditions with reason codes'],
          ['Cross-namespace routing', 'Not standardized; annotation-dependent', 'ReferenceGrant objects with explicit from/to'],
          ['Learning curve', 'One object, few fields', 'Multiple objects, attachment model, namespace selectors'],
        ] },
        'Every route change triggers a reconciliation cycle: the controller must validate references, generate configuration, push it to the proxy, and update status. For NGINX Ingress Controller, this means regenerating nginx.conf and sending a reload signal. For Envoy-based controllers (Istio, Contour, Emissary), this means pushing xDS updates over gRPC. For cloud controllers (AWS ALB, GCP), this means API calls to provision or update cloud resources.',
        'The propagation delay between applying a manifest and serving traffic ranges from under a second (Envoy xDS hot update) to several minutes (cloud load-balancer provisioning). This delay is invisible in the Kubernetes API -- the only signal is the status condition timestamp. Deployment pipelines must poll status or use a readiness gate, not assume instant convergence.',
        'Gateway API\'s richer object model increases the total number of Kubernetes objects. A cluster with 50 application teams, each with 5 routes, needs at least 250 HTTPRoute objects plus Gateway, GatewayClass, and potentially ReferenceGrant objects. Controller memory and watch bandwidth scale with object count. The Kubernetes API server handles this well at moderate scale, but controllers with O(n^2) route-merging logic can become bottlenecks past a few thousand routes.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Ingress remains the right choice for clusters where one team owns the edge, the controller is well-understood, and the routing model is simple host-plus-path. NGINX Ingress Controller alone is deployed in millions of clusters. Its annotation model covers most single-team needs: SSL redirect, rate limiting, CORS headers, proxy buffer sizes.',
        { type: 'table', headers: ['Use case', 'Better fit', 'Why'], rows: [
          ['Single team, simple HTTP routing', 'Ingress', 'One object, well-known controller, minimal ceremony'],
          ['Multi-team shared edge', 'Gateway API', 'Explicit ownership boundaries prevent route conflicts'],
          ['TLS passthrough or TCP/UDP routing', 'Gateway API', 'TLSRoute, TCPRoute, UDPRoute are first-class; Ingress has no TCP/UDP support'],
          ['Canary or weighted traffic splitting', 'Gateway API', 'HTTPRoute backendRefs support weight natively'],
          ['Header-based routing', 'Gateway API', 'HTTPRoute matches support headers; Ingress requires annotations'],
          ['Service mesh integration', 'Gateway API', 'Mesh implementations (Istio, Linkerd) are adopting Gateway API as the unified config surface'],
        ] },
        'Gateway API has become the convergence point for Kubernetes networking. Istio uses it as the recommended configuration API since Istio 1.22. Contour, Cilium, Kong, Traefik, and Envoy Gateway all implement the Gateway API spec. The GAMMA (Gateway API for Mesh Management and Administration) initiative extends Gateway API to cover east-west service mesh routing, not just north-south edge routing.',
        { type: 'quote', attribution: 'Gateway API documentation', text: 'Gateway API is the successor to the Ingress API. However, it does not include the Ingress kind. As a result, a one-time conversion from your existing Ingress resources to the corresponding Gateway API resources is necessary.' },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The most common failures are reference failures -- broken edges in the route graph. Each failure mode maps to a specific graph edge:',
        { type: 'table', headers: ['Failure', 'Broken edge', 'Symptom', 'Diagnosis'], rows: [
          ['Wrong IngressClass / GatewayClass', 'Object to controller', 'Route is ignored silently', 'No controller watches the specified class; status never updates'],
          ['Missing TLS Secret', 'Listener to certificate', 'TLS handshake fails (ERR_SSL_PROTOCOL_ERROR)', 'Secret deleted, wrong namespace, or cert-manager renewal failed'],
          ['Host shadowing', 'Two routes to same host', 'One route serves, the other is silently dropped', 'Controller picks the oldest or alphabetically first Ingress; no error'],
          ['Path shadowing', 'Broad path before specific path', '404 on specific path', 'Prefix /api matches before Exact /api/v2; pathType matters'],
          ['No ready endpoints', 'Service to EndpointSlice', '503 Service Unavailable', 'Pods failing readiness probes or Deployment scaled to zero'],
          ['Route not allowed', 'HTTPRoute to Gateway listener (Gateway API only)', 'Accepted: False in route status', 'Namespace missing required label or ReferenceGrant absent'],
          ['Cross-namespace backend', 'HTTPRoute to Service in another namespace', 'ResolvedRefs: False', 'ReferenceGrant needed but not created in the target namespace'],
        ] },
        'Operational failures sit outside the Kubernetes object model entirely. Stale DNS records point to a deprovisioned load-balancer IP. Cloud load-balancer provisioning times out because of quota limits. NGINX reloads fail because the generated config has a syntax error from an invalid annotation value. Network policies block traffic between the proxy pod and backend pods even though the route graph is fully resolved.',
        { type: 'note', text: 'The hardest bugs are split-brain failures: the Kubernetes API shows Accepted: True, but the data plane was not actually updated. This happens when the controller crashes between programming the proxy and writing status, or when the proxy rejects the pushed configuration. Always verify both the Kubernetes status AND the proxy state (e.g., istioctl proxy-status, kubectl exec into NGINX and check nginx -T).' },
        'Gateway API does not standardize every traffic policy. Retries, rate limits, timeouts, authentication, header mutation, and circuit breaking require either implementation-specific policy resources (like Istio AuthorizationPolicy) or the emerging Gateway API policy attachment model. The extensibility is intentional -- the core spec stays portable; advanced features are opt-in per implementation.',
      ],
    },
    {
      heading: 'Debugging by graph traversal',
      paragraphs: [
        'Every edge routing problem is a graph traversal problem. Start from the symptom and walk the DAG:',
        { type: 'code', language: 'bash', body: '# For a 404: walk from listener to path match\nkubectl get ingress -A                           # or: kubectl get httproute -A\nkubectl describe ingress shop-ingress             # check rules, host, paths\nkubectl get svc cart-svc -o wide                  # check selector\nkubectl get endpointslices -l kubernetes.io/service-name=cart-svc\n\n# For a 503: walk from Service to Pods\nkubectl get pods -l app=cart --field-selector status.phase=Running\nkubectl describe pod <pod-name>                   # check readiness probe\n\n# For Gateway API attachment failure:\nkubectl get httproute cart-route -o yaml           # check status.parents[].conditions\nkubectl get gateway shop-gateway -o yaml           # check listeners[].allowedRoutes\nkubectl get referencegrant -A                      # check cross-namespace permissions\n\n# For TLS failure:\nkubectl get secret shop-tls -o jsonpath=\'{.data.tls\\.crt}\' | base64 -d | openssl x509 -noout -dates' },
        'The graph traversal pattern works because every node has observable state. The load balancer has an IP. The listener has a port and protocol. The route has match rules and status conditions. The Service has endpoints. The Pod has readiness. When traffic fails, exactly one edge in this chain is broken. Walking the graph finds it faster than reading logs.',
        'Treat status as part of deployment validation. A CI/CD pipeline should not declare a rollout complete after kubectl apply. It should poll until the route status shows Accepted: True, the controller has programmed the address, and the backend has ready endpoints. Tools like kubectl wait and Argo Rollouts\' analysis runs can automate this gate.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        { type: 'table', headers: ['Source', 'What it covers'], rows: [
          ['kubernetes.io/docs/concepts/services-networking/ingress/', 'Ingress spec, pathType semantics, IngressClass, TLS, status'],
          ['kubernetes.io/docs/concepts/services-networking/ingress-controllers/', 'List of Ingress controller implementations and their feature matrices'],
          ['gateway-api.sigs.k8s.io/', 'Gateway API spec, GEPs (Gateway Enhancement Proposals), conformance profiles'],
          ['kubernetes.io/blog/2023/10/31/gateway-api-ga/', 'GA announcement for Gateway API v1.0 core resources'],
          ['projectcontour.io/docs/main/config/fundamentals/', 'Contour\'s internal DAG builder -- how one controller compiles the route graph'],
          ['istio.io/latest/docs/tasks/traffic-management/ingress/gateway-api/', 'Istio\'s Gateway API implementation and migration from Istio Gateway'],
        ] },
        { type: 'bullets', items: [
          'Prerequisite: study Kubernetes Service and EndpointSlice to understand the backend half of the route graph -- how a Service selector maps to Pod IPs via EndpointSlice objects.',
          'Extension: study Envoy xDS to see how controllers like Istio and Contour push route configuration to proxies without reloading -- the Listener, Route, Cluster, and Endpoint discovery services mirror the Kubernetes route DAG.',
          'Contrast: study traditional reverse proxy configuration (NGINX server/location blocks, HAProxy frontends/backends) to see the imperative model that Kubernetes route objects replace.',
          'Next case study: study Flagger or Argo Rollouts progressive delivery to see how the route graph is used for canary deployments -- shifting traffic weight between backend versions based on metric analysis.',
        ] },
      ],
    },
  ],
};
