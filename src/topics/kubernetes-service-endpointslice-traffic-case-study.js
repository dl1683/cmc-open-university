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
      heading: 'Why this exists',
      paragraphs: [
        'Pods are temporary. They get created, rescheduled, replaced, marked unready, and deleted. Their IPs are implementation details, but clients need a stable way to reach the logical application.',
        'A Service is that stable contract. EndpointSlices are the scalable backend index behind it. They tell the datapath which endpoints currently belong to the Service and which ones should receive ordinary traffic.',
        {type:'callout', text:'A Service separates stable identity from changing backend membership, while EndpointSlices shard that membership so traffic state can update without rewriting one huge record.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/6/63/Pod-networking.png', alt:'Diagram of three Kubernetes Pods with containers connected through Service X and Pod IP addresses.', caption:'Kubernetes pod networking and service resolution diagram by Marvin The Paranoid, CC BY-SA 4.0, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'The baseline approach',
      paragraphs: [
        'The obvious approach is to send clients directly to Pod IPs. That works until the first rollout, node failure, autoscale event, or readiness change. Every client would need to discover and filter backends on its own.',
        'The older Kubernetes Endpoints object solved discovery with one object per Service. That creates a different wall for large Services: a small membership change can rewrite one large object and force every watcher to process the whole backend set again.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Service discovery has two separate problems. Identity should be stable, but membership changes constantly. A good design cannot make clients chase every Pod, and it cannot make every endpoint update rewrite a giant object.',
        'Readiness adds the production constraint. A Pod can exist and still be unsafe for traffic. During termination, it may be serving existing connections while not ready for new ordinary traffic. Existence is not the same as eligibility.',
      ],
    },
    {
      heading: 'The core data model',
      paragraphs: [
        'The core structure is a sharded membership index. The Service stores stable identity: name, namespace, ClusterIP, ports, selector, type, affinity, and traffic policy. The selector is a label predicate over Pods.',
        'EndpointSlices store membership rows for that Service. A slice has an address type, ports, endpoint addresses, and endpoint conditions such as ready, serving, and terminating. Large backend sets become several slice objects instead of one oversized record.',
        'The datapath consumes both sides. kube-proxy, an eBPF implementation, a cloud load balancer, or another controller watches Services and EndpointSlices, then programs packet rules, maps, proxy clusters, or load-balancer backends.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the selector-to-slices view, follow the Service selector into matching Pods and then into EndpointSlice shards. The visual point is that a Service is not a direct pointer to one Pod. It is a stable identity joined to a changing set of backend records.',
        'In the traffic-decision view, watch DNS and the datapath split responsibilities. DNS gets the client to the Service identity. The datapath uses the current endpoint index to pick an eligible backend. That separation is why clients can keep one URL while rollouts keep changing Pods underneath.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The EndpointSlice controller watches Services and Pods. For a selector-based Service, it finds matching Pods and writes EndpointSlice objects for their network endpoints. When a Pod becomes ready, unready, terminating, or rescheduled, the controller patches the affected slice.',
        'CoreDNS gives clients a stable Service name. For a normal ClusterIP Service, that name resolves to the Service virtual IP. The node datapath or proxy then translates traffic for the Service into traffic for one eligible backend endpoint.',
        'The hot path is a lookup over programmed state, not a live API call per request. The control loop updates the membership index. The datapath uses the latest state it has received.',
      ],
    },
    {
      heading: 'Concrete example',
      paragraphs: [
        'A checkout API runs behind checkout.default.svc. A Deployment rolls out a new version. New Pods appear before they pass readiness. Old Pods may be terminating but still finishing existing work.',
        'The Service name and ClusterIP stay the same. EndpointSlice membership changes underneath. Ready new Pods enter the eligible set. Not-ready Pods stay out of ordinary traffic. The client keeps calling the Service instead of learning about each Pod event.',
      ],
    },
    {
      heading: 'Why it is reliable',
      paragraphs: [
        'The correctness argument is separation of identity from membership. Clients depend on the Service contract. Controllers update EndpointSlices as the backend set changes. The datapath joins those two views when it selects a backend.',
        'Readiness protects the boundary between existence and eligibility. A Pod can have an IP before it should receive traffic. EndpointSlice conditions make that state visible to consumers that need to avoid not-ready or terminating endpoints.',
        'Sharding improves reliability for large Services by reducing update blast radius. A changed endpoint can update one slice instead of forcing every watcher to process one large Endpoints object.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'EndpointSlices trade one large object for several smaller watched objects. That improves update behavior for large Services, but it still costs API writes, watches, controller work, and datapath updates.',
        'The datapath is eventually updated. If watches lag or a node misses fresh state, traffic can briefly target stale endpoints. If readiness probes are wrong, the membership index faithfully routes to the wrong health signal.',
        'Connection behavior depends on implementation. A Service load-balances at the network layer unless another layer adds request-aware routing. Existing connections, conntrack state, session affinity, topology policy, and external traffic policy can make traffic distribution look uneven.',
        'The most useful mental model is control plane versus data plane. EndpointSlice changes explain what the cluster believes. Packet traces, proxy maps, and load-balancer state explain what traffic is actually doing. Healthy operations need both views.',
      ],
    },
    {
      heading: 'Production uses',
      paragraphs: [
        'Services and EndpointSlices are the normal foundation for in-cluster discovery, rolling updates, horizontal scaling, and backend membership behind Ingress, Gateway API, and service meshes.',
        'They also support several exposure shapes. ClusterIP keeps traffic inside the cluster. NodePort and LoadBalancer expose a Service through nodes or cloud infrastructure. Headless Services skip the virtual IP pattern when clients need direct endpoint records.',
      ],
    },
    {
      heading: 'Operational checklist',
      paragraphs: [
        'Debug Service traffic as a chain: Service selector, matching Pods, readiness, EndpointSlice membership, DNS answer, datapath rules, NetworkPolicy, and backend application logs. Skipping straight to the application hides many control-plane mistakes.',
        'For each outage, record whether the selector matched the expected Pods, whether the Pods were ready, which EndpointSlices contained them, whether the node datapath had fresh state, and whether clients were using ClusterIP, headless DNS, NodePort, LoadBalancer, Ingress, or Gateway. The failure often sits at the boundary between those layers.',
        'For rollout reviews, compare desired replicas, available replicas, ready endpoints, terminating endpoints, and Service traffic policy. A Deployment can look healthy while the Service still has too few ready endpoints for the current traffic load.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The common failure is selector drift. If the Service selector matches no Pods, clients reach a stable name with no usable backends. If it matches the wrong Pods, the datapath routes correctly to the wrong application.',
        'The health failure is a bad readiness signal. A probe that passes too early sends traffic to an app before it can serve. A probe that fails too long keeps healthy capacity out of the Service.',
        'The networking failure sits below discovery. NetworkPolicy, kube-proxy or eBPF bugs, conntrack pressure, cloud load-balancer health checks, topology policy, or DNS caching can break traffic even when the Service and EndpointSlices look correct.',
        'Selectorless Services are another sharp edge. Kubernetes will not infer membership from Pods, so operators or controllers must manage EndpointSlices deliberately.',
      ],
    },
    {
      heading: 'Where it wins and fails',
      paragraphs: [
        'The pattern wins when clients need stable L3/L4 access to a changing backend set. It is the right primitive for most internal service-to-service calls and for the backend side of edge routing.',
        'It fails as an application router. Services do not understand HTTP paths, user identity, canary policy, retries, or cross-cluster failover by themselves. Ingress, Gateway API, NetworkPolicy, service meshes, and application health checks add those layers.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Kubernetes Services at https://kubernetes.io/docs/concepts/services-networking/service/ and EndpointSlices at https://kubernetes.io/docs/concepts/services-networking/endpoint-slices/.',
        'Study Kubernetes Informer DeltaFIFO & Workqueue for the watch/cache machinery, Kubernetes Deployment Rolling Update for the producer of Pod churn, Cilium eBPF Datapath for a concrete packet implementation, Load Balancer and Maglev Load Balancer for backend selection, and Kubernetes NetworkPolicy Selector Set for the policy layer that can allow or deny the chosen path.',
      ],
    },
  ],
};
