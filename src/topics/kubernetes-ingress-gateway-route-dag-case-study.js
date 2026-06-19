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
      heading: 'Why this exists',
      paragraphs: [
        'A Kubernetes Service gives stable access inside the cluster. It does not decide which public hostname should terminate TLS, which URL path should reach which application, or which team is allowed to attach a route to a shared edge listener.',
        'Ingress and Gateway API exist to make edge routing declarative. They store the desired HTTP or HTTPS route graph in Kubernetes objects. A controller turns that graph into NGINX, Envoy, cloud load-balancer, or service-mesh configuration and writes status back into the API.',
        'The educational point is that edge routing is not just a list of rules. It is a graph of references, ownership boundaries, status conditions, and data-plane programming. When traffic fails, the fastest operator is usually the one who can walk that graph without guessing.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simple approach is to let each team edit the edge proxy or create its own load balancer. That works for one service. It breaks when many teams share hostnames, certificates, listeners, and route precedence.',
        'Kubernetes also loses observability when the edge lives outside the API. A manifest can say the app exists, but the cluster cannot tell whether the public route was accepted, rejected, shadowed, or still waiting for a controller.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The edge is a shared data structure. Hostnames must be unique or intentionally wildcarded. Paths have precedence. TLS secrets expire or move. Backends may have no ready endpoints. Two teams can accidentally claim the same listener.',
        'Ingress solves the first version by putting host and path rules in one Kubernetes object. Its wall is ownership and extensibility. It mixes infrastructure and application concerns, and the Kubernetes project has frozen the Ingress API. Gateway API was designed to split those concerns across roles.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The structure is a route DAG. A request enters through DNS and a load balancer, reaches a listener, matches host and path rules, selects a backend Service, then follows that Service to EndpointSlices and ready Pods.',
        'Ingress compresses much of that graph into IngressClass, Ingress rules, TLS secrets, backend references, and status. Gateway API expands it into GatewayClass, Gateway, listener, HTTPRoute, parent reference, backend reference, and conditions.',
        'The graph has two kinds of edges. Routing edges describe where traffic can go. Ownership and attachment edges describe who is allowed to attach routes to infrastructure. Gateway API makes those attachment edges explicit.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'An Ingress controller watches Ingress objects for its class. It resolves TLS secrets, host rules, path rules, and backend Services. If the references are valid, it programs the data plane and updates status with the edge address or implementation-specific conditions.',
        'A Gateway controller starts one layer earlier. GatewayClass selects the implementation. Gateway defines listeners such as HTTPS on port 443. HTTPRoutes attach to those listeners through parent references, then point to backend Services. The controller validates attachment, programs the data plane, and records accepted or rejected conditions.',
        'At request time, the proxy does not reread YAML. It uses the programmed route table: listener, TLS context, hostname match, path or header match, backend cluster, and endpoint set.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A retail cluster serves shop.example.com. The platform team owns the Gateway, the public address, and the certificate. The cart team owns an HTTPRoute for /cart. The orders team owns an HTTPRoute for /orders.',
        'The route graph lets the platform team keep listener and TLS control while application teams ship route changes. Status conditions tell the cart team whether its route attached, whether the backend Service exists, and whether the controller accepted the configuration.',
        'This is better than sharing one handwritten proxy file. The cart team can change cart routes without owning certificate rotation. The platform team can rotate the listener without rewriting every service route. The controller becomes the compiler from Kubernetes route objects to the actual edge configuration.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The reliability argument is reconciliation plus status. The Kubernetes object is desired state, not the data plane. A controller repeatedly observes the route graph, resolves references, programs the proxy, and writes back what happened.',
        'A route should not be considered live just because the object exists. It is live when the responsible controller has accepted it and the data plane has been programmed. Gateway conditions make that state easier to inspect than a pile of proxy config.',
        'Gateway API improves shared-cluster reliability by making ownership boundaries first-class. Infrastructure owners control Gateways and listeners. Route owners attach only where allowed. That prevents every application team from needing write access to the whole edge.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The cost is controller and data-plane complexity. Every route change must be validated, translated, pushed to the proxy or load balancer, and reflected in status. That creates propagation delay between applying a manifest and serving traffic.',
        'More explicit models create more objects. Gateway API is clearer for multi-team routing, but it asks operators to manage GatewayClass, Gateway, listener policy, Route objects, allowed attachment, and sometimes cross-namespace reference policy.',
        'Proxy behavior can dominate the user-visible result. Some controllers reload configuration. Some push incremental updates. Some depend on cloud-provider provisioning. The Kubernetes API stores the graph, but the implementation decides how fast and safely traffic changes.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Ingress is still useful for simple HTTP routing where one team owns the route and the controller behavior is already understood. Gateway API is a better fit when teams share edge infrastructure, when listener ownership matters, or when route status needs to explain why attachment failed.',
        'Neither API fixes a broken backend. If traffic fails, walk the graph backward: client DNS, public load balancer, listener, TLS secret, route match, Service, EndpointSlice, ready Pod, and controller status.',
        'The APIs also do not standardize every traffic policy an organization might want. Retries, rate limits, auth, header mutation, canary rollout, and mesh integration may require implementation-specific policy resources or additional Gateway API extension points.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The common failures are wrong class, missing controller, missing TLS secret, host or path shadowing, Service without ready endpoints, and status that never updates.',
        'Gateway API adds attachment failures. A Route can point at a Gateway listener that does not allow it. A backend in another namespace may need explicit permission. A route can exist but remain rejected because the graph edge is not allowed.',
        'Operational failures sit outside the object model: stale DNS, cloud load balancer provisioning delays, proxy reload mistakes, certificate rotation errors, and network policy blocking traffic after the route has selected a backend.',
      ],
    },
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The Ingress view shows how a route is assembled from references: class, host, path, backend Service, EndpointSlice, and status. A manifest exists before the public route is actually usable; the controller closes that loop.',
        'The Gateway view separates infrastructure ownership from application route ownership. The important edge is attachment: a Route must be allowed to attach to a listener before backend routing matters. Status conditions are the inspection surface for that decision.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Build runbooks around graph traversal. For a 404, inspect host and path matching before backend health. For a 503, inspect Service and EndpointSlices. For a TLS failure, inspect listener, certificate secret, DNS, and load-balancer address. For a rejected Gateway route, inspect parent references and allowed attachment policy.',
        'Treat status as part of deployment validation. Applying YAML is not enough. A release gate should check that the controller accepted the route, programmed the address, and sees healthy backends before shifting traffic or declaring the rollout complete.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Kubernetes Ingress at https://kubernetes.io/docs/concepts/services-networking/ingress/, Ingress controllers at https://kubernetes.io/docs/concepts/services-networking/ingress-controllers/, and Gateway API at https://kubernetes.io/docs/concepts/services-networking/gateway/.',
        'Study Envoy xDS Service Mesh because many controllers program Envoy-like resources, Kubernetes Service and EndpointSlice Traffic for the backend half of the graph, Trie and Patricia Trie for host/path matching, Feature Flag Control Plane for controlled route changes, and Flagger Progressive Delivery Canary for safe edge rollout.',
      ],
    },
  

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },

      {
        heading: 'Learning map',
        paragraphs: [
          'Before this topic, unlock all prerequisites and define the required preconditions.',
          'After this topic, trace where this idea appears in one larger path on this site.',
          'Use unlock relationships to keep one path and one checkpoint per review cycle.',
        ],
      },

      {
        heading: 'Micro checks',
        paragraphs: [
          {
            type: 'bullets',
            items: [
              'Can you state one invariant in one sentence?',
              'Can you prove one transition with pre and post state?',
              'Can you name one hidden edge case in one line?',
              'Can you transfer this mechanism to a neighboring domain?',
            ],
          },
        ],
      },

      {
        heading: 'Try this now',
        paragraphs: [
          'Build one input manually and predict every step before running the animation.',
          'If your predicted final state matches the animation for kubernetes-ingress-gateway-route-dag-case-study, continue to the next topic in the same track.'
  ],
      },
],
};
