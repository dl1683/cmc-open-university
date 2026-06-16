// Kubernetes Service and EndpointSlice: selectors become scalable endpoint
// shards, then datapaths turn stable Service identity into backend traffic.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'kubernetes-service-endpointslice-traffic-case-study',
  title: 'Kubernetes Service and EndpointSlice Traffic Case Study',
  category: 'Systems',
  summary: 'How Services select Pods, EndpointSlice shards track ready backends, DNS and virtual IPs hide churn, and datapaths load-balance traffic to healthy endpoints.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['selector to slices', 'traffic decision'], defaultValue: 'selector to slices' },
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

function serviceGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'svc', label: 'Service', x: 0.7, y: 3.8, note: notes.svc ?? 'stable name' },
      { id: 'selector', label: 'selector', x: 2.3, y: 3.8, note: notes.selector ?? 'labels' },
      { id: 'podA', label: 'pod-a', x: 4.1, y: 2.2, note: notes.podA ?? 'ready' },
      { id: 'podB', label: 'pod-b', x: 4.1, y: 3.8, note: notes.podB ?? 'ready' },
      { id: 'podC', label: 'pod-c', x: 4.1, y: 5.4, note: notes.podC ?? 'not ready' },
      { id: 'slice1', label: 'slice-1', x: 6.1, y: 2.8, note: notes.slice1 ?? 'A,B' },
      { id: 'slice2', label: 'slice-2', x: 6.1, y: 5.0, note: notes.slice2 ?? 'C' },
      { id: 'dns', label: 'DNS', x: 7.9, y: 2.8, note: notes.dns ?? 'svc name' },
      { id: 'data', label: 'datapath', x: 7.9, y: 5.0, note: notes.data ?? 'VIP/LB' },
      { id: 'client', label: 'client', x: 9.5, y: 3.8, note: notes.client ?? 'request' },
    ],
    edges: [
      { id: 'e-svc-selector', from: 'svc', to: 'selector' },
      { id: 'e-selector-podA', from: 'selector', to: 'podA' },
      { id: 'e-selector-podB', from: 'selector', to: 'podB' },
      { id: 'e-selector-podC', from: 'selector', to: 'podC' },
      { id: 'e-podA-slice1', from: 'podA', to: 'slice1' },
      { id: 'e-podB-slice1', from: 'podB', to: 'slice1' },
      { id: 'e-podC-slice2', from: 'podC', to: 'slice2' },
      { id: 'e-svc-dns', from: 'svc', to: 'dns' },
      { id: 'e-svc-data', from: 'svc', to: 'data' },
      { id: 'e-slice1-data', from: 'slice1', to: 'data' },
      { id: 'e-slice2-data', from: 'slice2', to: 'data' },
      { id: 'e-client-dns', from: 'client', to: 'dns' },
      { id: 'e-client-data', from: 'client', to: 'data' },
    ],
  }, { title });
}

function sliceScalePlot() {
  return plotState({
    axes: { x: { label: 'ready endpoints', min: 0, max: 500 }, y: { label: 'watch objects', min: 0, max: 6 } },
    series: [
      { id: 'single', label: 'one Endpoints', points: [{ x: 0, y: 1 }, { x: 500, y: 1 }] },
      { id: 'slices', label: 'EndpointSlices', points: [{ x: 0, y: 1 }, { x: 100, y: 1 }, { x: 200, y: 2 }, { x: 300, y: 3 }, { x: 400, y: 4 }, { x: 500, y: 5 }] },
    ],
    markers: [
      { id: 'shard', x: 200, y: 2, label: 'shard' },
      { id: 'small', x: 40, y: 1, label: 'small svc' },
    ],
  }, { title: 'EndpointSlice sharding bounds update blast radius' });
}

function* selectorToSlices() {
  yield {
    state: serviceGraph('A Service names a stable backend set'),
    highlight: { active: ['svc', 'selector', 'e-svc-selector'], compare: ['podA', 'podB', 'podC'] },
    explanation: 'A Service gives clients a stable name and virtual address while Pods remain ephemeral. The selector is the join key between the Service object and matching Pods.',
    invariant: 'Clients should depend on the Service contract, not on individual Pod IPs.',
  };

  yield {
    state: serviceGraph('The EndpointSlice controller materializes matching Pods', { slice1: 'ready A,B', slice2: 'not ready C' }),
    highlight: { active: ['podA', 'podB', 'slice1', 'e-podA-slice1', 'e-podB-slice1'], compare: ['podC', 'slice2'] },
    explanation: 'EndpointSlices are the scalable backend index. They group endpoint addresses and readiness conditions so watches can update part of a large Service instead of rewriting one giant endpoint object.',
  };

  yield {
    state: sliceScalePlot(),
    highlight: { active: ['slices', 'shard'], compare: ['single'] },
    explanation: 'The data-structure move is sharding. A small Service may fit in one slice; a large Service becomes several slice objects. Controllers and datapaths watch only the changed shards.',
  };

  yield {
    state: labelMatrix(
      'Service discovery rows',
      [
        { id: 'name', label: 'name' },
        { id: 'vip', label: 'VIP' },
        { id: 'slice', label: 'slices' },
        { id: 'ready', label: 'ready' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['DNS', 'stale'],
        ['addr', 'NAT'],
        ['index', 'churn'],
        ['ready', 'probe'],
      ],
    ),
    highlight: { active: ['name:role', 'slice:role', 'ready:role'], found: ['ready:risk'] },
    explanation: 'The production object is not just a load balancer. It is a set of linked records: name, virtual IP, selector, EndpointSlices, readiness, traffic policy, and datapath implementation.',
  };
}

function* trafficDecision() {
  yield {
    state: serviceGraph('Clients resolve the Service, not Pod churn', { client: 'lookup', dns: 'ClusterIP' }),
    highlight: { active: ['client', 'dns', 'svc', 'e-client-dns', 'e-svc-dns'], compare: ['podA', 'podB', 'podC'] },
    explanation: 'Service discovery decouples callers from backend churn. The DNS name points to the Service; the datapath decides which ready endpoint receives each connection or packet.',
  };

  yield {
    state: serviceGraph('The datapath chooses a ready backend', { data: 'choose B', podB: 'picked', podC: 'skip' }),
    highlight: { active: ['data', 'slice1', 'podB', 'e-slice1-data'], compare: ['podC', 'slice2'] },
    explanation: 'A kube-proxy, eBPF, or cloud datapath uses Service and EndpointSlice state to translate the stable Service destination into a backend endpoint. Not-ready endpoints should not receive ordinary traffic.',
    invariant: 'The hot path is stable identity plus fresh endpoint membership.',
  };

  yield {
    state: labelMatrix(
      'Traffic knobs',
      [
        { id: 'type', label: 'type' },
        { id: 'aff', label: 'affinity' },
        { id: 'int', label: 'internal' },
        { id: 'ext', label: 'external' },
      ],
      [
        { id: 'choice', label: 'choice' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['types', 'expose'],
        ['client', 'sticky'],
        ['L/C', 'inside'],
        ['L/C', 'srcIP'],
      ],
    ),
    highlight: { active: ['type:choice', 'aff:effect'], found: ['ext:effect'] },
    explanation: 'Service behavior is configured by policy fields, not only by endpoint membership. Exposure type, affinity, and traffic policy alter who can reach the Service and how backends are selected.',
  };

  yield {
    state: labelMatrix(
      'Complete case: checkout API',
      [
        { id: 'roll', label: 'rollout' },
        { id: 'probe', label: 'probe' },
        { id: 'slice', label: 'slice' },
        { id: 'lb', label: 'LB' },
      ],
      [
        { id: 'event', label: 'event' },
        { id: 'decision', label: 'decision' },
      ],
      [
        ['new pod', 'watch'],
        ['fail pod', 'not rd'],
        ['member', 'patch'],
        ['client', 'healthy'],
      ],
    ),
    highlight: { active: ['probe:decision', 'slice:event', 'lb:decision'], compare: ['roll:event'] },
    explanation: 'During a checkout rollout, new Pods appear before they are safe. Readiness keeps them out of normal Service routing until they pass probes. EndpointSlice updates then let datapaths send traffic without clients changing URLs.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'selector to slices') yield* selectorToSlices();
  else if (view === 'traffic decision') yield* trafficDecision();
  else throw new InputError('Pick a Kubernetes Service view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A Kubernetes Service is the stable network contract in front of ephemeral Pods. The Service object selects a logical backend set, gets a stable name and often a virtual IP, and lets clients ignore Pod creation, deletion, replacement, and rescheduling.',
        'The official Service documentation describes Services as a method for exposing a network application running as one or more Pods and explains that Services define a logical set of endpoints plus a policy for access: https://kubernetes.io/docs/concepts/services-networking/service/. The EndpointSlice documentation explains that EndpointSlices let Services scale to large backend sets and update healthy backends efficiently: https://kubernetes.io/docs/concepts/services-networking/endpoint-slices/.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The core data structure is a sharded membership index. Service metadata gives the stable identity. The selector is a label predicate. EndpointSlices are shard rows that hold endpoint addresses, ports, address family, readiness conditions, and topology hints. Datapaths consume those rows to do load balancing and translation.',
        'This module sits between Kubernetes Reconciliation and Cilium eBPF Datapath. Reconciliation keeps Service and EndpointSlice objects current. Cilium, kube-proxy, or another network implementation turns those objects into packet-path tables, maps, or rules.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A checkout API runs behind Service checkout.default.svc. A Deployment replaces old Pods with new Pods. Some new Pods exist but have not passed readiness yet. The EndpointSlice controller updates slices so ready old Pods and ready new Pods are eligible, while the failing Pod is marked not ready. Clients continue using the Service name. The datapath chooses only ready backends.',
        'The failure mode is stale membership. If readiness is wrong, bad Pods receive traffic. If EndpointSlice watches lag, traffic may continue to a terminating backend briefly. If a custom Service without selectors is used, the operator must manage EndpointSlices deliberately because Kubernetes is no longer deriving endpoints from Pod labels.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Kubernetes Informer DeltaFIFO & Workqueue for the watch/cache machinery, Kubernetes Deployment Rolling Update for the producer of Pod churn, Cilium eBPF Datapath for a concrete packet implementation, Load Balancer and Maglev Load Balancer for backend selection, and Kubernetes NetworkPolicy Selector Set for the policy layer that can allow or deny the chosen path.',
      ],
    },
  ],
};
