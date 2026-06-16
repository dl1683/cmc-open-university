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
      heading: 'What it is',
      paragraphs: [
        'Ingress and Gateway API are Kubernetes edge-routing models. They map external HTTP or HTTPS traffic to Services through host, path, listener, TLS, and backend references. The API object is not the data plane by itself; a controller must translate it into proxy, cloud load-balancer, or service-mesh configuration.',
        'The official Ingress documentation says Ingress exposes HTTP and HTTPS routes from outside the cluster to Services and notes that the Kubernetes project recommends Gateway API because Ingress is frozen: https://kubernetes.io/docs/concepts/services-networking/ingress/. The Ingress controller page explains that you may deploy multiple controllers and select one with ingressClassName: https://kubernetes.io/docs/concepts/services-networking/ingress-controllers/. The Gateway API page describes Gateway API as the successor to Ingress and notes that it is installed as CRDs implemented by selected controllers: https://kubernetes.io/docs/concepts/services-networking/gateway/.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The route structure is a directed graph. The request enters through an external load balancer or listener. It matches a host rule, path rule, header rule, or listener. The selected route points to a backend Service, which points to EndpointSlices, which point to ready Pods. TLS secrets, class references, ownership rules, and status conditions hang off the same graph.',
        'Ingress compresses much of that graph into one object. Gateway API decomposes it into GatewayClass, Gateway, listener, and Route objects, making ownership and attachment explicit. That decomposition is a data-structure choice: more references and conditions, but less hidden coupling between infrastructure and application teams.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A retail cluster exposes shop.example.com/cart and shop.example.com/orders. The infrastructure team owns the public Gateway, listener, wildcard certificate, and controller. The cart team owns an HTTPRoute for /cart to cart-svc. The orders team owns an HTTPRoute for /orders to orders-svc. The controller marks routes Accepted only if hostnames, listener permissions, and backend references are valid.',
        'When a route fails, the debugging path follows the graph: DNS to load balancer, listener to route, route match to backend Service, Service to EndpointSlices, EndpointSlices to ready Pods, and controller status back to the API.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Envoy xDS Service Mesh because many controllers program Envoy-like resources. Study Kubernetes Service and EndpointSlice Traffic for the backend half of the graph. Study Trie and Patricia Trie for host/path matching. Study Feature Flag Control Plane and Flagger Canary Progressive Delivery for safe edge-route rollout.',
      ],
    },
  ],
};
