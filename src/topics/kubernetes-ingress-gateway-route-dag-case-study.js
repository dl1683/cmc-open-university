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
        'Read the animation as a route DAG, where DAG means directed acyclic graph: a one-way reference graph with no loops. In the Ingress view, active nodes are host, path, Service, controller, or status references being resolved; found nodes are accepted edges. In the Gateway view, infrastructure-owned listener nodes light up before application-owned Route nodes attach to them.',
        {type:'callout', text:'A route is live only after the controller validates the reference graph and records status, not when the YAML first exists.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/6/63/Pod-networking.png', alt:'Diagram of Kubernetes Pods connected through a Service and Pod IP addresses.', caption:'Kubernetes pod networking and service dependency diagram by Marvin The Paranoid, Wikimedia Commons, CC BY-SA 4.0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A Kubernetes Service gives Pods a stable internal name and virtual IP, but it does not decide public hostnames, TLS certificates, URL paths, or shared edge ownership. Without a declarative route object, teams edit proxy files, cloud load balancers, or console rules by hand. Ingress and Gateway API store HTTP routing intent in the Kubernetes API so a controller can compile it into real proxy configuration and report status.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is for each team to manage its own edge proxy or load balancer. That is fast when one service owns one hostname. It breaks when several teams share one domain, one wildcard certificate, one public IP, or one listener where path precedence and route ownership matter.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that edge routing is a shared ordered data structure. Hostname matches, path matches, TLS secrets, Services, EndpointSlices, listener permissions, and controller class all have to line up. A route can exist in YAML and still serve nothing because the controller rejected it, the Service has no ready endpoints, or another route shadows its path.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to model routing as typed references plus status. Ingress compresses host, path, TLS, and backend references into one object selected by an IngressClass. Gateway API separates infrastructure from application routes: GatewayClass selects the implementation, Gateway defines listeners, and HTTPRoute attaches to allowed listeners and backend Services.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'An Ingress controller watches matching Ingress objects, resolves TLS Secrets, validates host and path rules, looks up backend Services and EndpointSlices, generates proxy configuration, pushes it to the data plane, and writes address or status. A Gateway controller also validates attachment edges: whether a Route parentRef targets a real listener, whether its namespace is allowed, and whether backend references are valid. At request time, the proxy uses the compiled route table, not the YAML.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is graph validation plus reconciliation. A route is safe to serve only when every required edge resolves: class to controller, listener to TLS material, route to listener, match to backend, Service to ready endpoints, and controller to data-plane config. Status conditions close the loop by recording whether the controller accepted and programmed the graph rather than leaving users to infer success from `kubectl apply`.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Cost grows with route objects, referenced Services, EndpointSlices, Secrets, and controller-specific merge logic. A cluster with 50 teams and 5 routes each has at least 250 HTTPRoute objects plus shared Gateways and possible ReferenceGrants, and every change can trigger validation and config generation. Propagation can be under a second for Envoy xDS updates or several minutes for cloud load balancer provisioning.',
        'Gateway API spends more object count and learning cost to buy clearer ownership and status. Ingress spends fewer objects but often pushes advanced behavior into annotations whose meanings vary by controller. The behavior cost is portability: the same route shape may not produce the same proxy behavior across implementations.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Ingress fits simple host-and-path HTTP routing when one platform choice is already installed and one team owns the edge. Gateway API fits shared ingress, multi-team platforms, weighted backends, header matching, TCP or UDP routing, and service-mesh ingress where listener ownership and route ownership must be separate. Both are valuable because routing becomes API state with reconciliation and status instead of unmanaged proxy text.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails on broken graph edges: wrong class, missing TLS Secret, host conflict, path shadowing, Service with no endpoints, route not allowed by a listener, or missing cross-namespace permission. It also fails when Kubernetes status and proxy state diverge, such as a controller crash between pushing config and writing status. Debugging must check both the Kubernetes objects and the proxy or load-balancer data plane.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A retail platform owns `shop.example.com` on a Gateway in namespace `infra`. The Gateway listener on port 443 allows Routes only from namespaces labeled `gateway-access=true`. The cart team in namespace `shop-cart` creates an HTTPRoute for `/cart` to `cart-svc:80`; the controller verifies the namespace label, listener, hostname, Service, and ready endpoints before setting `Accepted=True` and `ResolvedRefs=True`.',
        'Now the orders team creates `/cart/checkout` to `orders-svc`. Longest-prefix path precedence means `/cart/checkout` should beat `/cart` for that subpath if the implementation follows the Gateway rules. If `orders-svc` has zero ready endpoints, the route can be accepted but traffic returns a backend failure, so deployment validation must check both route status and EndpointSlice readiness.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Use the official Kubernetes Ingress documentation, Ingress controller documentation, and Gateway API specification as primary sources. They define IngressClass, path types, TLS, status, GatewayClass, Gateway listeners, HTTPRoute attachment, allowed routes, backend references, and status conditions.',
        'Study Service and EndpointSlice next because they are the backend half of the route graph. Then study Envoy xDS, NGINX location matching, ReferenceGrant, and progressive delivery, because production routing depends on both Kubernetes references and proxy-specific data-plane behavior.',
      ],
    },
  ],
};