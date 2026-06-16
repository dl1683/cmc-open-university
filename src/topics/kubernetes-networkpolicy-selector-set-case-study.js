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
    explanation: 'A rule is not just source matching. It also intersects with protocol and port constraints. A peer may be allowed to Redis but not to metrics or admin ports.',
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
    explanation: 'The Kubernetes API stores intent. Enforcement happens in the network plugin. Cilium may compile selectors into identities and BPF maps; another CNI may use a different datapath.',
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
      heading: 'What it is',
      paragraphs: [
        'Kubernetes NetworkPolicy declares which traffic is allowed to or from selected Pods. It is not a firewall rule attached to one IP address. It is a selector-based policy object: select protected Pods, classify peers, intersect with ports, and rely on the network plugin to enforce the resulting allow set.',
        'The official NetworkPolicy concept page explains podSelector, namespaceSelector, combined namespace and pod selectors, ipBlock, default policies, and the fact that source or destination rewriting can make IP behavior plugin-dependent: https://kubernetes.io/docs/concepts/services-networking/network-policies/. The API reference defines NetworkPolicy as the API object that describes allowed traffic for a set of Pods: https://kubernetes.io/docs/reference/kubernetes-api/networking/network-policy-v1/.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The useful mental model is set algebra. The protected set is selected by podSelector. Each ingress or egress rule contributes an allow set. Peer expressions produce sets from pod labels, namespace labels, intersections of both, or CIDR ranges. Ports intersect those peer sets. Multiple policies union together; they do not subtract from one another.',
        'That additive behavior is why a NetworkPolicy review should look like a ledger. Which Pods are isolated? Which policies add ingress? Which policies add egress? Which labels are broad enough to accidentally include future Pods? Which egress exceptions are required for DNS, telemetry, backup, or package mirrors?',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A database namespace holds Redis Pods labelled role=db. A default-deny policy isolates ingress and egress. A second policy allows Pods labelled role=frontend to connect on tcp/6379. A third policy allows egress to cluster DNS. A fourth allows backup traffic to a known external CIDR. The CNI plugin materializes this policy into its datapath. Requests from the frontend to Redis pass. Requests from a debug Pod or to a non-Redis port fail.',
        'The dangerous mistake is treating NetworkPolicy as an ordered firewall chain. It is not ordered; policies are additive. The second dangerous mistake is assuming every CNI implements all behavior identically around service NAT, source preservation, and ipBlock interactions. The Kubernetes docs explicitly call out that rewriting may occur before or after policy processing depending on the plugin and environment.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Cilium eBPF Datapath and eBPF LPM Trie CIDR Policy to see one enforcement strategy. Study Kubernetes Service and EndpointSlice Traffic because Service translation affects what the packet path sees. Study Sparse Set, Filtered Vector Search Bitset, Trie, and Graph BFS for the general selector, membership, and reachability shapes hiding under policy review.',
      ],
    },
  ],
};
