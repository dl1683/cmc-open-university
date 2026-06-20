// Cilium eBPF datapath case study: Kubernetes state programs kernel hooks and
// BPF maps so packets can be load-balanced, filtered, and observed in-kernel.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'cilium-ebpf-datapath-case-study',
  title: 'Cilium eBPF Datapath Case Study',
  category: 'Systems',
  summary: 'Kubernetes networking through eBPF: agents translate cluster state into BPF programs and maps that route, filter, load-balance, and observe packets.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['programmed datapath', 'packet decision'], defaultValue: 'programmed datapath' },
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

function ciliumGraph(title) {
  return graphState({
    nodes: [
      { id: 'k8s', label: 'K8s API', x: 0.7, y: 3.6, note: 'services/pods/policies' },
      { id: 'agent', label: 'agent', x: 2.6, y: 3.6, note: 'node control loop' },
      { id: 'verifier', label: 'verifier', x: 4.4, y: 1.5, note: 'safety check' },
      { id: 'programs', label: 'programs', x: 4.4, y: 3.6, note: 'TC/XDP hooks' },
      { id: 'maps', label: 'maps', x: 4.4, y: 5.7, note: 'service, policy, CT' },
      { id: 'packet', label: 'packet', x: 6.5, y: 3.6, note: 'pod or node traffic' },
      { id: 'service', label: 'backend', x: 8.6, y: 2.4, note: 'load-balanced' },
      { id: 'hubble', label: 'Hubble', x: 8.6, y: 5.1, note: 'flows and drops' },
    ],
    edges: [
      { id: 'e-k8s-agent', from: 'k8s', to: 'agent', weight: 'watch' },
      { id: 'e-agent-programs', from: 'agent', to: 'programs', weight: 'load' },
      { id: 'e-agent-maps', from: 'agent', to: 'maps', weight: 'update' },
      { id: 'e-verifier-programs', from: 'verifier', to: 'programs', weight: 'accept' },
      { id: 'e-programs-packet', from: 'programs', to: 'packet', weight: 'hook' },
      { id: 'e-maps-packet', from: 'maps', to: 'packet', weight: 'lookup' },
      { id: 'e-packet-service', from: 'packet', to: 'service', weight: 'forward' },
      { id: 'e-packet-hubble', from: 'packet', to: 'hubble', weight: 'observe' },
    ],
  }, { title });
}

function* programmedDatapath() {
  yield {
    state: ciliumGraph('Cluster state is translated into node-local datapath state'),
    highlight: { active: ['k8s', 'agent', 'e-k8s-agent'], compare: ['programs', 'maps'] },
    explanation: 'Cilium watches Kubernetes state such as pods, services, endpoints, identities, and network policies. The agent turns that state into BPF programs and map entries on each node.',
  };

  yield {
    state: ciliumGraph('The verifier checks programs before they run in the kernel'),
    highlight: { active: ['agent', 'verifier', 'programs', 'e-agent-programs', 'e-verifier-programs'], found: ['maps'] },
    explanation: 'eBPF is powerful because code runs in kernel hooks, but the verifier constrains what can run. Programs must pass safety checks before the datapath uses them.',
    invariant: 'The hot path is programmable, but not arbitrary unsafe kernel code.',
  };

  yield {
    state: labelMatrix(
      'BPF map roles',
      [
        { id: 'svc', label: 'service map' },
        { id: 'ct', label: 'conntrack map' },
        { id: 'policy', label: 'policy map' },
        { id: 'identity', label: 'identity map' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'decision', label: 'decision enabled' },
      ],
      [
        ['service to backends', 'load balancing'],
        ['flow state', 'return traffic and NAT'],
        ['allowed identities/ports', 'policy enforcement'],
        ['pod security identity', 'label-based access'],
      ],
    ),
    highlight: { active: ['svc:decision', 'policy:decision'], found: ['ct:stores', 'identity:stores'] },
    explanation: 'Maps are the shared memory between user-space control loops and kernel datapath programs. They are the data structures that make policy and service routing fast.',
  };

  yield {
    state: ciliumGraph('Loaded programs and populated maps handle packets locally'),
    highlight: { active: ['programs', 'maps', 'packet', 'e-programs-packet', 'e-maps-packet'], found: ['service', 'hubble'] },
    explanation: 'Once programs and maps are loaded, packets can be classified, filtered, translated, load-balanced, and observed without bouncing every decision through a user-space proxy.',
  };
}

function* packetDecision() {
  yield {
    state: labelMatrix(
      'Packet path decision stack',
      [
        { id: 'hook', label: 'hook' },
        { id: 'identity', label: 'identity' },
        { id: 'policy', label: 'policy' },
        { id: 'lb', label: 'load balance' },
        { id: 'observe', label: 'observe' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'outcome', label: 'outcome' },
      ],
      [
        ['where did packet arrive?', 'TC/XDP hook runs'],
        ['who sent it?', 'security identity'],
        ['is it allowed?', 'forward or drop'],
        ['which backend?', 'service translation'],
        ['what happened?', 'flow event'],
      ],
    ),
    highlight: { active: ['policy:question', 'lb:outcome'], found: ['observe:outcome'] },
    explanation: 'A packet decision is a sequence of map-backed questions. The answer can be forward, drop, redirect, NAT, or emit telemetry.',
  };

  yield {
    state: ciliumGraph('kube-proxy replacement moves service load balancing into eBPF'),
    highlight: { active: ['programs', 'maps', 'packet', 'service', 'e-packet-service'], found: ['k8s'] },
    explanation: 'In kube-proxy-free mode, Cilium can implement Kubernetes service load balancing with eBPF maps and programs instead of iptables or IPVS rules.',
  };

  yield {
    state: labelMatrix(
      'Operational pressure',
      [
        { id: 'capacity', label: 'map capacity' },
        { id: 'kernel', label: 'kernel support' },
        { id: 'rollout', label: 'datapath rollout' },
        { id: 'debug', label: 'flow debugging' },
      ],
      [
        { id: 'risk', label: 'risk' },
        { id: 'response', label: 'response' },
      ],
      [
        ['insertions fail', 'size maps deliberately'],
        ['feature unavailable', 'check requirements/fallback'],
        ['node disruption', 'staged upgrades'],
        ['invisible drops', 'Hubble and metrics'],
      ],
    ),
    highlight: { active: ['capacity:risk', 'debug:response'], compare: ['kernel:response'] },
    explanation: 'The datapath is still infrastructure. Map sizing, kernel capabilities, staged rollout, and observability decide whether eBPF stays reliable at scale.',
  };

  yield {
    state: ciliumGraph('Telemetry makes kernel decisions explainable'),
    highlight: { active: ['packet', 'hubble', 'e-packet-hubble'], found: ['maps', 'programs'] },
    explanation: 'The payoff is not only speed. Flow visibility lets operators explain why traffic was forwarded, dropped, translated, or denied by policy.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'programmed datapath') yield* programmedDatapath();
  else if (view === 'packet decision') yield* packetDecision();
  else throw new InputError('Pick a Cilium eBPF datapath view.');
}

export const article = {
  sections: [
    {
      heading: 'Why This Exists',
      paragraphs: [
        'Kubernetes turns every node into a small network switch. Pods appear and disappear, Services point at changing backend sets, NetworkPolicies describe allowed flows, and operators still expect packets to move at line rate. The hard part is not only routing. The system has to route, load-balance, apply policy, translate addresses, remember connection state, and explain drops while cluster state changes underneath it.',
        'Cilium exists because that work sits on the boundary between the Kubernetes control plane and the Linux packet path. Kubernetes stores desired state in the API server. Packets arrive at kernel hooks on each node. If every packet decision has to climb back into user space, the datapath pays extra context switches and queues exactly where latency and throughput are most sensitive. If every state change becomes a large pile of static rules, the node becomes hard to update and hard to inspect.',
        {type:'callout', text:'Cilium eBPF datapath works by materializing Kubernetes intent into verified kernel programs and mutable maps for local packet decisions.'},
      ],
    },
    {
      heading: 'The Obvious Approach',
      paragraphs: [
        'A reasonable first design is to let existing Linux networking machinery do the work. kube-proxy can program iptables or IPVS rules for Services. A CNI plugin can configure routes and virtual links. A user-space proxy can enforce higher-level policy because it can read rich metadata and log decisions. This is not a bad design. It uses mature kernel features and keeps much of the policy logic outside kernel code.',
        'The wall appears when service count, endpoint churn, policy count, and observability needs grow together. Large rule sets can be expensive to update and hard to reason about. A user-space proxy can become another hop on traffic that only needed a local decision. Static rules also do not naturally express all the state a modern datapath needs: security identities, service backends, connection tracking, return traffic, policy verdicts, and telemetry. The cluster wants a programmable datapath, but arbitrary kernel code would be too dangerous.',
      ],
    },
    {
      heading: 'The Core Insight',
      paragraphs: [
        'The core insight is to split the system into two contracts. The control plane watches Kubernetes and writes compact node-local state. The datapath runs verified eBPF programs at Linux hooks and uses BPF maps as its live lookup tables. Programs contain the packet-handling logic. Maps contain the changing data: Services, backends, identities, policy entries, and connection-tracking records.',
        'That split is the invariant the page is teaching. Kubernetes state may change quickly, but packets should see a local, bounded decision procedure. User space can update map entries as the cluster changes; kernel programs can make per-packet decisions without rebuilding a giant rule chain or calling a proxy for every flow. eBPF gives Cilium programmability at the packet boundary while the verifier prevents ordinary unsafe kernel extensions from being loaded.',
      ],
    },
    {
      heading: 'How It Works',
      paragraphs: [
        'On each node, the Cilium agent watches Kubernetes and Cilium APIs. The relevant upstream pattern is the same one behind Kubernetes Informer DeltaFIFO and work queues: list current objects, watch changes, cache local state, and reconcile deltas. From that feed, the agent learns pod IPs, endpoint identities, Service frontends, backend sets, NetworkPolicies, and node capabilities. It then loads eBPF programs and updates BPF maps.',
        'A packet enters a hook such as TC or XDP, depending on the path and feature. The program asks a sequence of map-backed questions. Who sent this packet? Which security identity does that endpoint have? Is this source allowed to reach this destination and port? Is the destination a Kubernetes Service that needs load balancing? Does connection tracking already know the return path? Should the packet be forwarded, dropped, redirected, translated, or reported as a flow event?',
        'The maps are the main data structures. A service map translates a virtual address such as a ClusterIP or NodePort to a backend choice. A connection-tracking map remembers flow state so return traffic and NAT remain consistent. A policy map encodes which identities, ports, and directions are allowed. An identity map lets label-based policy become an integer lookup in the hot path. Hubble and metrics sit on the observability side, turning kernel decisions into events operators can query.',
      ],
    },
    {
      heading: 'What the Visual Proves',
      paragraphs: [
        'The first visual separates control-plane programming from packet handling. Kubernetes API state flows into the Cilium agent. The agent loads programs and updates maps. The verifier sits between user-space intent and kernel execution. Packets then hit programs and maps directly. The picture is not showing a generic network diagram; it is showing the boundary that keeps a dynamic cluster from turning every packet into a control-plane event.',
        'The second visual turns one packet decision into a stack of questions. The packet is not merely forwarded. It is classified at a hook, associated with an identity, checked against policy, possibly load-balanced to a backend, and emitted as telemetry. That proves why maps matter. The datapath is fast because each stage is a lookup or bounded packet operation, not an open-ended walk through cluster state.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'The correctness argument is a state-materialization argument. Kubernetes declares desired networking and policy state. The agent converges node-local programs and maps toward that state. A packet decision is correct when the map entries it consults match the current intended Service, identity, policy, and connection state for that packet path. The invariant is that packet logic is stable while packet data is live.',
        'The verifier is part of that argument. eBPF programs must pass kernel safety checks before they run, so Cilium is not asking the node to trust arbitrary extension code in the hot path. The verifier does not prove that the policy is semantically what the operator wanted, but it does constrain memory access and program behavior enough for the kernel to accept the program. Cilium still needs tests, staged rollout, and observability for the higher-level meaning.',
      ],
    },
    {
      heading: 'Cost and Behavior',
      paragraphs: [
        'The gain is that many packet decisions become local map lookups and bounded program steps. Updating a backend set can be a map update instead of a rewrite of a large rule chain. Replacing kube-proxy can move Service load balancing into eBPF maps and programs. Per-packet cost depends on the path, the maps touched, cache locality, and policy complexity, but the shape is different from sending traffic through a separate user-space decision point.',
        'The tax is operational. BPF maps have capacity limits, and insertions past a configured limit fail. Kernel versions and enabled features decide what programs can be loaded. The verifier can reject a program that a developer thought was safe. A rollout mistake affects node traffic, not only an application process. Debugging also changes: an operator needs flow logs, metrics, map inspection, and a way to connect a drop to the policy or identity that produced it.',
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        'This design fits clusters where packet decisions are frequent, state changes are continuous, and policy must be enforced close to traffic. Service load balancing, NetworkPolicy enforcement, identity-aware routing, node-local observability, and kube-proxy replacement are natural uses because the hot path can ask simple questions against maintained maps. The access pattern is the reason: many reads in the packet path, fewer writes from the control plane.',
        'It also fits teams that need traffic explanations. A drop that disappears inside a long rule chain is hard to operate. A flow event that says source identity X tried to reach destination Y on port Z and matched a deny rule is useful. The same datapath that makes a forwarding decision can emit enough evidence to debug it.',
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        'eBPF is not magic speed by itself. Bad map sizing, unsupported kernel features, too much policy work in the hot path, missing telemetry, or a rushed node upgrade can erase the benefit. A map lookup is still work. A program that is hard to understand is still production code. A policy compiler can still encode the wrong intent.',
        'It is also the wrong abstraction if the real problem lives above packet metadata. Application authorization, request-body inspection, and business-level decisions usually need L7 context that a low-level datapath does not have. Cilium can integrate with higher layers, but the eBPF datapath should not be treated as a replacement for every gateway, proxy, or application security check.',
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        'Primary sources: Cilium eBPF datapath documentation at https://docs.cilium.io/en/stable/network/ebpf/, Cilium eBPF maps at https://docs.cilium.io/en/latest/network/ebpf/maps/, Cilium kube-proxy replacement at https://docs.cilium.io/en/stable/network/kubernetes/kubeproxy-free/, Linux eBPF verifier documentation at https://docs.kernel.org/bpf/verifier.html, and Linux BPF map documentation at https://www.kernel.org/doc/html/v6.1/bpf/maps.html.',
        'Study eBPF LPM Trie CIDR Policy Case Study for prefix policy lookup, IP FIB Longest-Prefix Match Case Study for routing tables, eBPF Verifier Register State Case Study for safety analysis, eBPF Ring Buffer Telemetry Case Study for flow events, Kubernetes Informer DeltaFIFO and Workqueue Case Study for the control-plane feed, Kubernetes Reconciliation Case Study for convergence, Load Balancer and Maglev Load Balancer Case Study for backend choice, and Distributed Tracing for explaining flows across services.',
      ],
    },
  ],
};
