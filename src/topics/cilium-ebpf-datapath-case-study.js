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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the graph as two planes on one node. The Kubernetes API, Cilium agent, verifier, programs, and maps are the programming plane; the packet, backend, and Hubble nodes are the runtime plane. Active marks show which component is making or feeding the current decision.',
        'A safe inference rule is visible in every frame: a packet can stay on the fast path only after the relevant program has been verified and the needed map entries already exist on the node. Found nodes are durable state for that decision, not decorations.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Kubernetes networking is dynamic. Pods move, Services change backend sets, labels drive identity, policies decide allowed flows, and operators still expect each node to forward packets without waiting for a central controller. A zero-background reader should read eBPF as extended Berkeley Packet Filter: a safe virtual machine inside the Linux kernel that can run checked programs at packet hooks.',
        'Cilium exists because the packet path needs both programmability and speed. User space is flexible, but a user-space hop for every packet adds scheduling, copies, queues, and failure points. The Linux kernel is fast, but static iptables-style rule piles are hard to update and inspect as cluster state changes.',
        {type:'callout', text:'Cilium eBPF datapath works by materializing Kubernetes intent into verified kernel programs and mutable maps for local packet decisions.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to let kube-proxy and ordinary Linux networking carry the service path. kube-proxy can program iptables or IPVS rules, the container network interface can set routes, and a proxy can enforce richer policy in user space. This is reasonable because those mechanisms are mature and familiar to operators.',
        'A second obvious move is to centralize more logic in sidecars or node agents. That keeps policy code out of the kernel and makes logging easy. It also moves per-packet work away from the place where the packet already is.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the update/read mismatch. Service endpoints, identities, and policies are written by slow control loops, but packets read that state at line rate. If the read path walks a large rule set or calls user space, the cost appears on every packet instead of only on state changes.',
        'At 100,000 packets per second on one node, adding 20 microseconds of extra user-space decision time burns about 2 CPU seconds per wall-clock second. At 20 nodes, that becomes about 40 saturated CPU cores spent on a decision that could often be a kernel map lookup. The cost is behavioral: the slow design charges every packet for flexibility that only state changes need.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Split the problem into stable packet logic and mutable packet data. The Cilium agent watches Kubernetes, compiles or loads eBPF programs, and writes BPF maps. The programs are the checked code path; the maps are the current service, policy, identity, and connection state.',
        'That split gives the datapath a simple invariant. Cluster state can change often, but each packet sees a bounded sequence of local lookups and decisions. The verifier guards the program before it enters the kernel, while map updates let the agent change behavior without rebuilding a giant rule chain.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The agent watches pods, services, endpoints, identities, and network policies. It translates that control-plane state into maps such as service-to-backend tables, policy tables, identity tables, and connection-tracking tables. It also loads programs at hooks such as TC or XDP, where Linux can inspect packets before ordinary forwarding finishes.',
        'When a packet arrives, the program asks map-backed questions. Which endpoint or identity sent it. Is this source allowed to reach this destination and port. Does the destination name a Kubernetes Service that must be translated to a backend. Should connection tracking preserve a NAT or return-path decision.',
        'The answer can be forward, drop, redirect, translate, or emit telemetry. Hubble is useful because it turns those kernel decisions into inspectable flow evidence. Without that evidence, a fast datapath would still be hard to operate.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is a materialization argument. Kubernetes declares intended network state; the Cilium agent keeps node-local maps consistent with the slice of that state the node needs. A packet decision is correct when the program reads map entries that correspond to the current intended service, identity, policy, and connection state for that packet.',
        'The verifier is part of the safety argument, not the policy argument. It checks that the eBPF program obeys kernel safety rules before loading. It does not prove that the operator wrote the right policy, so Cilium still needs staged rollout, tests, metrics, and flow-level debugging.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The hot-path cost is mostly the number of program instructions and map lookups per packet. If a packet needs service lookup, policy lookup, identity lookup, and connection tracking, each lookup adds CPU work and cache pressure. When traffic doubles, those reads double; when endpoint state changes, only the affected map writes happen.',
        'The hidden cost is operational state. Maps need capacity, kernel features vary by version, verifier failures can block rollout, and a bad policy compiler can create a fast wrong answer. The system buys packet-path speed by making the control plane responsible for correct, fresh, node-local data.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This design fits Kubernetes clusters with frequent service traffic and policy enforcement. Service load balancing, kube-proxy replacement, identity-aware NetworkPolicy, and flow observability all benefit because packets read local maps many times while the control plane writes those maps less often. The access pattern is many fast reads and fewer structured writes.',
        'It also fits regulated or multi-tenant clusters where a drop must be explainable. A flow record that connects source identity, destination identity, port, policy verdict, and packet path gives operators evidence. The same mechanism that forwards or drops can feed the audit trail.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when teams treat eBPF as automatic speed. Oversized policies, poor map sizing, unsupported kernel features, missing metrics, or rushed node upgrades can turn a fast datapath into an outage. Kernel-resident logic is still production code with rollout risk.',
        'It is also the wrong layer for decisions that need application semantics. Request bodies, user roles inside an application, and business authorization usually live above packet metadata. Cilium can integrate with higher-level systems, but the datapath should not become a replacement for every proxy or application check.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose one node handles 60,000 packets per second for a Service with 40 backends and five NetworkPolicy rules. A user-space proxy design that adds 30 microseconds per packet consumes 1.8 CPU seconds per wall-clock second on that node before application work starts. A map-backed kernel path that spends 3 microseconds on lookups consumes 0.18 CPU seconds for the same traffic.',
        'Now an endpoint is removed. The expensive operation should be one service-map update and possibly connection cleanup, not 60,000 changed packet decisions per second. The behavior is the lesson: state changes pay update cost, while packets keep paying only bounded local lookup cost.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Cilium eBPF datapath documentation, Cilium eBPF maps, Cilium Kubernetes without kube-proxy, and the Linux eBPF verifier documentation. These sources define the real packet hooks, map roles, service load-balancing path, and verifier boundary.',
        'Study next by layer. For packet lookup, read IP longest-prefix match and Maglev load balancing. For safety, read the eBPF verifier register-state case study. For the control plane, read Kubernetes informer work queues and reconciliation because those are the feeds that keep maps current.',
      ],
    },
  ],
};
