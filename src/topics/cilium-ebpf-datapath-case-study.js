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
      heading: 'What it is',
      paragraphs: [
        'Cilium is a Kubernetes networking, security, and observability system built on eBPF. eBPF lets verified programs run at kernel hooks, while maps store shared state that user space and kernel programs can read or update. In Cilium, Kubernetes services, endpoints, identities, and policies become datapath programs and BPF map entries on each node.',
        'The Cilium eBPF datapath documentation describes the hooks and packet paths used by Cilium: https://docs.cilium.io/en/stable/network/ebpf/. The introduction states that Cilium uses BPF hooks in the Linux networking stack to build higher-level networking constructs: https://docs.cilium.io/en/stable/network/ebpf/intro/. Kernel eBPF verifier documentation explains the safety analysis performed before programs run: https://docs.kernel.org/bpf/verifier.html.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The Cilium agent watches Kubernetes and Cilium APIs. It learns pod identities, services, endpoint backends, and network policies. Kubernetes Informer DeltaFIFO & Workqueue Case Study explains the list/watch/cache/queue pattern behind that control-plane feed. Cilium then loads BPF programs into hooks such as TC or XDP and updates BPF maps with service, policy, connection-tracking, and identity state. Packets hit kernel hooks where programs consult maps and decide whether to forward, drop, redirect, translate, or emit telemetry.',
        'The maps are the crucial data structures. A service map can translate a ClusterIP or NodePort to a backend. A connection-tracking map remembers flow state. A policy map answers whether a source identity may reach a destination and port. Because these are map lookups in the packet path, changes from the control plane can be reflected without rebuilding an entire iptables chain.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'eBPF moves work close to the packet, reducing user-space hops and enabling high-performance load balancing and policy. But it introduces kernel-version constraints, verifier constraints, map capacity limits, and node-level operational risk. Cilium documentation notes that BPF maps are created with upper capacity limits and insertion beyond a limit fails: https://docs.cilium.io/en/latest/network/ebpf/maps/. Capacity planning is therefore part of correctness.',
        'Cilium can also replace kube-proxy. Its kube-proxy-free documentation describes eBPF service load balancing and notes support for features such as consistent hashing using a Maglev variant: https://docs.cilium.io/en/stable/network/kubernetes/kubeproxy-free/. That connects directly to the Load Balancer and Maglev Load Balancer Case Study topics.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A pod sends a request to a Kubernetes Service. Instead of traversing a large iptables rule set, the packet reaches a Cilium BPF program. The program reads the service map, chooses a backend, checks policy maps using security identities, updates connection-tracking state, rewrites packet metadata as needed, and forwards to the backend pod. A flow event is emitted for observability. If policy denies the request, the packet is dropped and the decision is explainable through flow telemetry.',
        'This is a control-plane/data-plane split. Kubernetes declares desired service and policy state. Cilium agents materialize that state into BPF maps and programs. The kernel datapath makes per-packet decisions locally.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'eBPF is not magic packet acceleration by itself. A slow or oversized map lookup, unsupported kernel feature, bad rollout, or missing observability can still cause an outage. It also does not remove the need to understand networking semantics. NAT, connection tracking, service affinity, policy identity, and return traffic still matter. The advantage is that these choices can be implemented in a programmable, observable datapath.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Official sources: Cilium eBPF datapath docs at https://docs.cilium.io/en/stable/network/ebpf/, Cilium eBPF introduction at https://docs.cilium.io/en/stable/network/ebpf/intro/, Cilium eBPF maps at https://docs.cilium.io/en/latest/network/ebpf/maps/, Cilium kube-proxy replacement at https://docs.cilium.io/en/stable/network/kubernetes/kubeproxy-free/, kernel verifier docs at https://docs.kernel.org/bpf/verifier.html, and kernel map docs at https://www.kernel.org/doc/html/v6.1/bpf/maps.html. Study eBPF LPM Trie CIDR Policy Case Study, IP FIB Longest-Prefix Match Case Study, eBPF Verifier Register State Case Study, eBPF Ring Buffer Telemetry Case Study, Load Balancer, Maglev Load Balancer Case Study, Kubernetes Reconciliation Case Study, Kubernetes Informer DeltaFIFO & Workqueue Case Study, Distributed Tracing, and Circuit Breakers next.',
      ],
    },
  ],
};
