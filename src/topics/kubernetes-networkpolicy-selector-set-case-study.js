// Kubernetes NetworkPolicy: pod, namespace, IP, and port selectors form an
// allow-set that a CNI datapath enforces around selected Pods.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'kubernetes-networkpolicy-selector-set-case-study',
  title: 'Kubernetes NetworkPolicy Selector Set Case Study',
  category: 'Systems',
  summary: 'How NetworkPolicy turns pod selectors, namespace selectors, ipBlocks, ports, and policyTypes into additive allow sets enforced by the cluster network plugin.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['selector algebra', 'packet allow set'], defaultValue: 'selector algebra' },
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

function policyGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'pol', label: 'Policy', x: 0.7, y: 3.8, note: notes.pol ?? 'role=db' },
      { id: 'target', label: 'db pods', x: 2.5, y: 3.8, note: notes.target ?? 'isolated' },
      { id: 'frontend', label: 'frontend', x: 4.8, y: 1.8, note: notes.frontend ?? 'allow' },
      { id: 'namespace', label: 'namespace', x: 4.8, y: 3.8, note: notes.namespace ?? 'allow' },
      { id: 'ipblock', label: 'ipBlock', x: 4.8, y: 5.8, note: notes.ipblock ?? 'CIDR' },
      { id: 'ports', label: 'ports', x: 6.7, y: 3.8, note: notes.ports ?? 'tcp/6379' },
      { id: 'cni', label: 'CNI', x: 8.2, y: 3.8, note: notes.cni ?? 'enforce' },
      { id: 'packet', label: 'packet', x: 9.6, y: 3.8, note: notes.packet ?? 'allow/drop' },
    ],
    edges: [
      { id: 'e-pol-target', from: 'pol', to: 'target' },
      { id: 'e-frontend-ports', from: 'frontend', to: 'ports' },
      { id: 'e-namespace-ports', from: 'namespace', to: 'ports' },
      { id: 'e-ipblock-ports', from: 'ipblock', to: 'ports' },
      { id: 'e-target-cni', from: 'target', to: 'cni' },
      { id: 'e-ports-cni', from: 'ports', to: 'cni' },
      { id: 'e-cni-packet', from: 'cni', to: 'packet' },
    ],
  }, { title });
}

function* selectorAlgebra() {
  yield {
    state: policyGraph('A policy first selects the Pods it protects'),
    highlight: { active: ['pol', 'target', 'e-pol-target'], compare: ['frontend', 'namespace', 'ipblock'] },
    explanation: 'NetworkPolicy starts with podSelector. That selector picks the Pods to isolate for ingress, egress, or both. Rules then describe which peers and ports are allowed.',
    invariant: 'NetworkPolicy is deny-by-isolation, then allow by matching rules.',
  };

  yield {
    state: labelMatrix(
      'Selector forms',
      [
        { id: 'pod', label: 'podSel' },
        { id: 'ns', label: 'nsSel' },
        { id: 'both', label: 'both' },
        { id: 'cidr', label: 'ipBlock' },
      ],
      [
        { id: 'scope', label: 'scope' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['same ns', 'pods'],
        ['namespc', 'pods'],
        ['ns+pod', 'AND'],
        ['ext', 'CIDR'],
      ],
    ),
    highlight: { active: ['pod:meaning', 'ns:meaning', 'both:meaning'], compare: ['cidr:scope'] },
    explanation: 'The data model is set algebra. A peer entry can mean pods in the same namespace, every pod in selected namespaces, the intersection of namespace and pod selectors, or an external IP block.',
  };

  yield {
    state: policyGraph('Peer selectors are combined with port filters', { ports: 'tcp/6379', packet: 'candidate' }),
    highlight: { active: ['frontend', 'namespace', 'ports', 'e-frontend-ports', 'e-namespace-ports'], found: ['target'] },
    explanation: 'A rule intersects peer and port. The peer can be valid while the packet is still denied because tcp/6379 is allowed and the metrics or admin port is not.',
  };

  yield {
    state: labelMatrix(
      'YAML shape changes set logic',
      [
        { id: 'one', label: 'one item' },
        { id: 'two', label: 'two items' },
        { id: 'none', label: 'no rule' },
        { id: 'empty', label: 'empty rule' },
      ],
      [
        { id: 'logic', label: 'logic' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['AND', 'narrow'],
        ['OR', 'wider'],
        ['deny', 'block'],
        ['all', 'broad'],
      ],
    ),
    highlight: { active: ['one:logic', 'two:logic'], compare: ['empty:effect'] },
    explanation: 'The most common mistake is indentation. One peer entry with namespaceSelector and podSelector means intersection. Two separate peer entries mean union. That single YAML shape can change the allow set radically.',
  };
}

function* packetAllowSet() {
  yield {
    state: policyGraph('The CNI plugin enforces the computed allow set'),
    highlight: { active: ['target', 'cni', 'packet', 'e-target-cni', 'e-cni-packet'], found: ['ports'] },
    explanation: 'The API stores the allow-set intent; the CNI turns it into packet decisions. If the network plugin does not enforce NetworkPolicy, the stored object alone protects nothing.',
  };

  yield {
    state: labelMatrix(
      'Additive policy result',
      [
        { id: 'p0', label: 'policy A' },
        { id: 'p1', label: 'policy B' },
        { id: 'ing', label: 'ingress' },
        { id: 'eg', label: 'egress' },
      ],
      [
        { id: 'result', label: 'result' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['front', 'broad'],
        ['metric', 'leak'],
        ['union', 'deny'],
        ['split', 'DNS'],
      ],
    ),
    highlight: { active: ['p0:result', 'p1:result', 'ing:result'], found: ['eg:risk'] },
    explanation: 'Multiple policies are additive. For selected Pods, the allowed ingress set is the union of ingress allowances, and the allowed egress set is the union of egress allowances.',
    invariant: 'A later NetworkPolicy does not subtract an earlier allow.',
  };

  yield {
    state: policyGraph('Packet decision: frontend reaches db on Redis only', { frontend: 'src ok', ports: '6379 ok', packet: 'allow' }),
    highlight: { active: ['frontend', 'ports', 'cni', 'packet', 'e-frontend-ports', 'e-ports-cni'], compare: ['ipblock'] },
    explanation: 'A frontend Pod in the selected namespace reaches db on tcp/6379 because both peer and port match. The same source to an admin port, or an unselected Pod to Redis, should be denied.',
  };

  yield {
    state: labelMatrix(
      'Complete case: database namespace',
      [
        { id: 'default', label: 'default' },
        { id: 'app', label: 'app' },
        { id: 'dns', label: 'DNS' },
        { id: 'backup', label: 'backup' },
      ],
      [
        { id: 'policy', label: 'policy' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['deny', 'closed'],
        ['app-db', 'least'],
        ['dns', 'egress'],
        ['backup', 'audit'],
      ],
    ),
    highlight: { active: ['default:policy', 'app:policy', 'dns:lesson'], found: ['backup:lesson'] },
    explanation: 'A hardened database namespace usually starts with default-deny policies, then adds exact app ingress, DNS egress, and backup egress. The policy graph should be reviewed as an allow-set ledger.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'selector algebra') yield* selectorAlgebra();
  else if (view === 'packet allow set') yield* packetAllowSet();
  else throw new InputError('Pick a Kubernetes NetworkPolicy view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read each highlighted group as a set. A set is a collection of things, such as all Pods with label role=db or all namespaces with label team=payments. The selector-algebra view shows which set is protected, which peer set is allowed, and which port set is part of the allow rule.',
        'The packet view is a membership test. First ask whether the destination Pod is isolated for the traffic direction, then ask whether one policy adds a matching peer and port. The safe inference is simple: once a Pod is isolated, a packet is allowed only if it belongs to at least one computed allow set.',
        {type:'callout', text:'NetworkPolicy is selector algebra enforced by the CNI: isolate selected Pods first, then add only the peer and port sets that match.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/6/63/Pod-networking.png', alt:'Diagram of Kubernetes Pods connected through a Service and Pod IP addresses.', caption:'Kubernetes pod networking and service dependency diagram by Marvin The Paranoid, Wikimedia Commons, CC BY-SA 4.0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A Kubernetes Pod is a small deployable unit that can be rescheduled, replaced, and given a new IP address. A firewall rule tied to one current Pod IP breaks when replicas roll, autoscale, or move to another node. NetworkPolicy exists so traffic rules can follow labels and namespaces instead of temporary addresses.',
        'The policy object defines allowed ingress, which is traffic entering a Pod, and egress, which is traffic leaving a Pod. Kubernetes stores the intent, and a compatible Container Network Interface plugin enforces it in the datapath. The problem is therefore not only networking; it is maintaining a correct allow set while the workload set changes.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to write rules for today\'s Pod IPs or to trust namespace names as security boundaries. That works for static machines because identity and address stay close together. In Kubernetes, identity is usually a label, and address is an implementation detail.',
        'Another reasonable first attempt is to read NetworkPolicies like ordered firewall rules. In that model, a later deny could override an earlier allow. Kubernetes does not use that model; policies are additive, and matching policies union their allowed traffic.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is churn. New Pods appear with labels, old Pods disappear, and a label edit can move a Pod into or out of a policy set. A hand-written address list cannot preserve the intended rule under that churn.',
        'The second wall is YAML shape. A peer entry containing both namespaceSelector and podSelector means intersection: Pods matching the pod selector inside namespaces matching the namespace selector. Two separate peer entries mean union: one set from namespaces plus another set from Pods.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'NetworkPolicy is set algebra. A podSelector chooses the protected set of Pods. Each ingress or egress rule adds peer sets and port sets, and the allowed traffic is the union of those rule results across all matching policies.',
        'Isolation is the switch that changes default behavior. A Pod with no matching policy for a direction remains non-isolated for that direction. Once a policy selects it for ingress or egress, only matching allow-set traffic for that direction is accepted.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A policy first selects target Pods with podSelector. The policyTypes field tells whether the rules affect ingress, egress, or both. Each rule then matches peers by Pod labels, namespace labels, IP blocks, or combinations of these, and may also restrict protocol and port.',
        'The network plugin watches Pods, namespaces, labels, policies, and addresses. When membership changes, the plugin recomputes enforcement state in its datapath. Kubernetes defines the API behavior, but source IP preservation, service translation, and host networking details can depend on the plugin and packet path.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is an invariant: for each isolated Pod and direction, the live datapath should equal the union of all currently matching policy allow sets. Adding a policy can add traffic to the union, but it cannot subtract traffic that another policy already allowed. Removing or editing a label changes set membership, so the plugin must update the datapath.',
        'A packet is accepted only when it passes both sides that apply. If the destination has ingress isolation, the packet source and port must match a destination-side ingress allow. If the source has egress isolation, the destination and port must match a source-side egress allow.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The API object is small, but the cost lives in recomputation and review. If 50 policies reference labels across 20 namespaces and a rollout creates 500 Pods, the plugin must keep the resulting peer sets current. Label churn becomes policy churn because a label change can alter many computed rules.',
        'Human cost is often larger than CPU cost. A broad label such as app=api may include a future Pod that was not reviewed. Cost as behavior means every new matching Pod silently expands a policy\'s effective allow set unless labels are governed.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'NetworkPolicy fits database isolation, tenant boundaries, namespace segmentation, and restricted egress from workloads that should not talk to the whole network. It is strongest when services already use stable labels and the intended traffic matrix is small enough to test. A database namespace can default-deny ingress, then admit only API Pods on the database port.',
        'It also helps audits. A team can state the allowed source set, destination set, and port set, then probe positive and negative cases. That turns policy review from reading indentation into comparing a computed reachability graph with the intended architecture.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'NetworkPolicy is not user authorization, mutual TLS identity, or a full firewall language. It does not inspect application decisions, and it has no ordered deny rule that cancels a previous allow. If application identity matters, combine it with service mesh identity, authentication, or application checks.',
        'It also fails when the CNI plugin does not implement policy or when teams bypass the intended network path. HostNetwork Pods, node-local traffic, NAT behavior, and service translation can change what the plugin sees. Production policy needs datapath-aware tests, not only valid YAML.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose one namespace has 12 frontend Pods, 4 API Pods, and 2 Redis Pods. A policy selects Redis with podSelector role=db and defines ingress from Pods with role=api on TCP port 6379. After isolation, the potential sources drop from 16 application Pods to 4 API Pods, and allowed destination ports drop to 1 port.',
        'Now add namespaceSelector team=payments in the same peer entry as podSelector role=api. If 3 of the 4 API Pods are in payments namespaces, the source set is 3 Pods. If the selectors are written as two peer entries, the source set can become all Pods in payments namespaces plus all role=api Pods, which might be 60 Pods in a real cluster.',
        'The policy is correct when every accepted packet belongs to the intended source set and port set, and every rejected packet falls outside at least one required set. The cost of the mistake is not theoretical: one indentation change can turn 3 allowed sources into dozens.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Kubernetes Network Policies at https://kubernetes.io/docs/concepts/services-networking/network-policies/ and the networking.k8s.io NetworkPolicy API reference at https://kubernetes.io/docs/reference/kubernetes-api/networking-resources/network-policy-v1/. Study the CNI plugin you actually run because enforcement behavior lives there.',
        'Study Labels and Selectors, Kubernetes Services and EndpointSlices, Cilium eBPF policy, eBPF LPM Trie CIDR Policy, Set operations, Graph reachability, and Firewall rule evaluation next. The useful next skill is to compute an allow set by hand before trusting the cluster.',
      ],
    },
  ],
};
