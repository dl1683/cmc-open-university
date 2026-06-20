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
      heading: 'Why this exists',
      paragraphs: [
        'Pod IPs are temporary, and workloads move. A firewall rule tied to one address does not survive rescheduling, autoscaling, or namespace churn. Kubernetes needs a way to express traffic policy in terms of labels, namespaces, IP blocks, and ports.',
        'NetworkPolicy is that selector-based allow-set. It selects protected Pods, isolates ingress or egress, adds allowed peers and ports, and relies on the CNI plugin to enforce the result.',
        {type:'callout', text:'NetworkPolicy is selector algebra enforced by the CNI: isolate selected Pods first, then add only the peer and port sets that match.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/6/63/Pod-networking.png', alt:'Diagram of Kubernetes Pods connected through a Service and Pod IP addresses.', caption:'Kubernetes pod networking and service dependency diagram by Marvin The Paranoid, Wikimedia Commons, CC BY-SA 4.0.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to write firewall rules for current Pod IPs or assume namespace names imply isolation. That can work in a static VM fleet. It fails in Kubernetes because Pods are replaced, labels change membership, Services rewrite paths, and new Pods can accidentally match broad selectors.',
        'Another common mistake is to read policies like ordered firewall rules. NetworkPolicies are not processed top to bottom with later denies. For selected Pods, allowed traffic is the union of all matching policy rules.',
      ],
    },
    {
      heading: 'The core mechanism',
      paragraphs: [
        'The data structure is set algebra. The protected set is selected by podSelector. Each ingress or egress rule contributes an allow set. Peer expressions produce sets from pod labels, namespace labels, intersections of both, or CIDR ranges. Ports intersect those peer sets. Multiple policies union together.',
        'The official NetworkPolicy concept page explains podSelector, namespaceSelector, combined namespace and pod selectors, ipBlock, default policies, additive behavior, and plugin-dependent source or destination rewriting: https://kubernetes.io/docs/concepts/services-networking/network-policies/. The API reference defines NetworkPolicy as allowed traffic for a set of Pods: https://kubernetes.io/docs/reference/kubernetes-api/networking/network-policy-v1/.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        "In the selector-algebra view, read each highlighted group as a set. `podSelector` creates the protected set. A peer expression creates an allowed source or destination set. Combining namespace and pod selectors in one peer entry means intersection; writing them as separate entries means union.",
        "In the packet-allow-set view, follow the packet through direction, selected Pod, peer match, and port match. NetworkPolicy is not an ordered deny list. Once a Pod is isolated for a direction, traffic is allowed only if at least one matching policy contributes an allow for that direction.",
        "The useful question after each frame is, which set got larger? Because policies are additive, a new policy can add allowed traffic but cannot subtract an older allow. That is the core difference from traditional first-match firewall thinking.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A namespace has frontend Pods labelled `role=frontend`, API Pods labelled `role=api`, and Redis Pods labelled `role=db`. A policy with `podSelector: role=db` isolates Redis ingress. A rule that allows peers with `podSelector: role=api` on port 6379 means API Pods in the same namespace can reach Redis, but frontend Pods cannot.',
        'If the rule uses both `namespaceSelector: name=payments` and `podSelector: role=api` in the same peer entry, it means API Pods inside the payments namespace. If those selectors are written as two separate peer entries, it means all Pods in the payments namespace plus all API Pods in the current policy scope. That YAML shape difference is a real set-algebra difference, not cosmetic indentation.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The model separates selection from enforcement. Kubernetes stores declarative policy objects. The CNI plugin turns the current selector results into datapath rules. When Pods appear, disappear, or change labels, the selected sets change and the plugin updates enforcement.',
        'The invariant is deny by isolation, then allow by membership. A Pod is non-isolated until a policy selects it for ingress or egress. Once isolated, traffic must match at least one allowed peer and port expression for that direction. Isolation is direction-specific: a Pod with no matching ingress policy is non-isolated for ingress, and egress has the same shape independently. That is why a policy can surprise teams that only protect ingress but forget DNS or external egress.',
        'For a connection to work, both sides can matter. The destination may need an ingress allow, and the source may need an egress allow. Because policies are additive, adding a new policy can only add allowed traffic for selected Pods; it cannot subtract an older allow.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The API object is small, but enforcement cost sits in the network plugin. The CNI must watch policies, Pods, namespaces, labels, IP blocks, and sometimes Services, then update datapath state as membership changes. Label churn can be policy churn.',
        'Human cost is often larger than runtime cost. Review the policy graph as a ledger: which Pods are isolated, which policies add ingress, which add egress, which labels might include future Pods, and which egress exceptions are required for DNS, telemetry, backup, or package mirrors.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'NetworkPolicy fits namespace segmentation, database isolation, tenant boundaries, controlled egress, and audit-friendly service connectivity. It is strongest when workloads already have stable labels and the allowed traffic matrix is small enough to review.',
        'It also makes default-deny practical. Start closed for selected Pods, then add narrow allowances for app ingress, DNS egress, metrics, backup, or external dependencies.',
        'The policy is especially valuable when teams can test it as a reachability matrix. For each protected workload, list who should initiate traffic, on which port, and in which direction. Then compare that matrix with the union of policies. This turns review from "does the YAML look right?" into "does the computed allow set match the intended architecture?"',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'NetworkPolicy is not application authorization, TLS identity, or a full ordered firewall language. It does not inspect every application-layer decision, and it cannot express a later deny that overrides an earlier allow.',
        'It also depends on the CNI. If the chosen network plugin does not support NetworkPolicy, the API object has no effect. Even when it does, behavior around service NAT, source preservation, hostNetwork Pods, and ipBlock interactions can be plugin-dependent, so production policy needs datapath-aware testing.',
        'It also fails when labels are treated casually. A broad label such as `app=api` can include future Pods that were not part of the original security review. A namespace label can grant access to every matching workload in that namespace. Policy review is therefore also label-governance review.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A database namespace holds Redis Pods labelled role=db. A default-deny policy isolates ingress and egress. A second policy allows Pods labelled role=frontend to connect on tcp/6379. A third policy allows egress to cluster DNS. A fourth allows backup traffic to a known external CIDR. The CNI plugin materializes this policy into its datapath. Requests from the frontend to Redis pass. Requests from a debug Pod or to a non-Redis port fail.',
        'The review should include a YAML-shape check. One peer entry with namespaceSelector and podSelector means intersection. Two separate peer entries mean union. One indentation change can turn a narrow app allow into a broad namespace allow.',
        'A good test suite for this policy includes positive and negative probes: frontend to Redis should pass, debug to Redis should fail, Redis to DNS should pass if egress isolation is enabled, Redis to the public internet should fail except for approved backup ranges, and newly created Pods with broad labels should not gain access accidentally in production.',
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
