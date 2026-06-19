// Kubernetes DaemonSet: eligible nodes should each have one daemon Pod, with
// selectors, affinity, tolerations, rollout, and node churn tracked explicitly.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'kubernetes-daemonset-node-coverage-controller-case-study',
  title: 'Kubernetes DaemonSet Node Coverage Controller Case Study',
  category: 'Systems',
  summary: 'How DaemonSets select eligible nodes, create one Pod per node, use node affinity, tolerate important taints, roll out updates, and clean up on node removal.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['coverage map', 'rolling daemon'], defaultValue: 'coverage map' },
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

function dsGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'ds', label: 'DS', x: 0.7, y: 3.8, note: notes.ds ?? 'spec' },
      { id: 'ctrl', label: 'ctrl', x: 2.4, y: 3.8, note: notes.ctrl ?? 'coverage' },
      { id: 'n1', label: 'node1', x: 4.3, y: 2.0, note: notes.n1 ?? 'ok' },
      { id: 'n2', label: 'node2', x: 4.3, y: 3.8, note: notes.n2 ?? 'ok' },
      { id: 'n3', label: 'node3', x: 4.3, y: 5.6, note: notes.n3 ?? 'taint' },
      { id: 'p1', label: 'pod1', x: 6.4, y: 2.0, note: notes.p1 ?? 'run' },
      { id: 'p2', label: 'pod2', x: 6.4, y: 3.8, note: notes.p2 ?? 'run' },
      { id: 'p3', label: 'pod3', x: 6.4, y: 5.6, note: notes.p3 ?? 'miss?' },
      { id: 'obs', label: 'obs', x: 8.4, y: 3.8, note: notes.obs ?? 'status' },
    ],
    edges: [
      { id: 'e-ds-ctrl', from: 'ds', to: 'ctrl' },
      { id: 'e-ctrl-n1', from: 'ctrl', to: 'n1' },
      { id: 'e-ctrl-n2', from: 'ctrl', to: 'n2' },
      { id: 'e-ctrl-n3', from: 'ctrl', to: 'n3' },
      { id: 'e-n1-p1', from: 'n1', to: 'p1' },
      { id: 'e-n2-p2', from: 'n2', to: 'p2' },
      { id: 'e-n3-p3', from: 'n3', to: 'p3' },
      { id: 'e-p1-obs', from: 'p1', to: 'obs' },
      { id: 'e-p2-obs', from: 'p2', to: 'obs' },
      { id: 'e-p3-obs', from: 'p3', to: 'obs' },
    ],
  }, { title });
}

function* coverageMap() {
  yield {
    state: dsGraph('A DaemonSet wants one Pod on each eligible node'),
    highlight: { active: ['ds', 'ctrl', 'n1', 'n2', 'e-ds-ctrl'], compare: ['p1', 'p2'] },
    explanation: 'A DaemonSet is a node-coverage controller. It is for node-local agents such as log collectors, network plugins, storage daemons, or monitoring exporters.',
    invariant: 'DaemonSet desired count follows eligible nodes, not a fixed replica number.',
  };

  yield {
    state: labelMatrix(
      'Coverage ledger',
      [
        { id: 'n1', label: 'n1' },
        { id: 'n2', label: 'n2' },
        { id: 'n3', label: 'n3' },
        { id: 'n4', label: 'n4' },
      ],
      [
        { id: 'elig', label: 'ok?' },
        { id: 'pod', label: 'pod' },
      ],
      [
        ['yes', 'run'],
        ['yes', 'run'],
        ['no', 'skip'],
        ['new', 'make'],
      ],
    ),
    highlight: { active: ['n1:pod', 'n2:pod', 'n4:pod'], compare: ['n3:pod'] },
    explanation: 'The controller keeps a per-node coverage table: eligible, already has Pod, needs Pod, should delete Pod, or should update Pod.',
  };

  yield {
    state: dsGraph('Node selector, affinity, and tolerations define eligibility', { n3: 'taint ok?', p3: 'if tol' }),
    highlight: { active: ['n3', 'p3', 'e-n3-p3'], found: ['ctrl'] },
    explanation: 'A DaemonSet can target only some nodes using nodeSelector or affinity. Its Pods may also need tolerations so infrastructure agents can run on tainted or control-plane nodes.',
  };

  yield {
    state: labelMatrix(
      'Use cases',
      [
        { id: 'log', label: 'log' },
        { id: 'net', label: 'net' },
        { id: 'mon', label: 'mon' },
        { id: 'stor', label: 'stor' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['node', 'gap'],
        ['CNI', 'boot'],
        ['metric', 'blind'],
        ['disk', 'data'],
      ],
    ),
    highlight: { active: ['log:need', 'net:need', 'mon:need'], found: ['net:risk'] },
    explanation: 'Coverage gaps are failures, not cosmetic differences. A node without logging, networking, monitoring, or storage agents may look schedulable while the platform is already degraded.',
  };
}

function* rollingDaemon() {
  yield {
    state: dsGraph('RollingUpdate replaces daemon Pods node by node', { p1: 'old', p2: 'new', p3: 'old', obs: 'mixed' }),
    highlight: { active: ['p2', 'obs', 'e-p2-obs'], compare: ['p1', 'p3'] },
    explanation: 'DaemonSet rollout is a coverage-preserving update. The controller replaces old daemon Pods while trying to keep enough node-local functionality alive.',
  };

  yield {
    state: labelMatrix(
      'Update knobs',
      [
        { id: 'max', label: 'maxUn' },
        { id: 'surge', label: 'surge' },
        { id: 'ready', label: 'ready' },
        { id: 'hist', label: 'hist' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['limit', 'gap'],
        ['extra', 'cost'],
        ['gate', 'stuck'],
        ['undo', 'old'],
      ],
    ),
    highlight: { active: ['max:job', 'ready:job'], compare: ['surge:risk'] },
    explanation: 'Rollout policy trades freshness against coverage. maxUnavailable limits how many nodes can lack a ready daemon, while surge can spend extra resources to reduce gaps.',
  };

  yield {
    state: dsGraph('Node removal garbage-collects daemon Pods', { n3: 'removed', p3: 'delete', obs: 'covered' }),
    highlight: { active: ['n3', 'p3', 'obs', 'e-p3-obs'], found: ['ctrl'] },
    explanation: 'The desired set follows the current node set. Node removal deletes obsolete daemon Pods; node join creates a Pod only if the new node satisfies eligibility.',
  };

  yield {
    state: labelMatrix(
      'Complete case: log agent',
      [
        { id: 'join', label: 'join' },
        { id: 'taint', label: 'taint' },
        { id: 'roll', label: 'roll' },
        { id: 'gap', label: 'gap' },
      ],
      [
        { id: 'event', label: 'event' },
        { id: 'check', label: 'check' },
      ],
      [
        ['node+', 'pod+'],
        ['ctrl', 'tol'],
        ['v2', 'ready'],
        ['miss', 'alert'],
      ],
    ),
    highlight: { active: ['join:check', 'roll:check', 'gap:check'], found: ['taint:check'] },
    explanation: 'A log-agent DaemonSet should alert on uncovered eligible nodes. The happy path is node joins, daemon Pod appears, readiness passes, logs flow, and rollout preserves coverage.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'coverage map') yield* coverageMap();
  else if (view === 'rolling daemon') yield* rollingDaemon();
  else throw new InputError('Pick a Kubernetes DaemonSet view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for Kubernetes DaemonSet Node Coverage Controller Case Study. How DaemonSets select eligible nodes, create one Pod per node, use node affinity, tolerate important taints, roll out updates, and clean up on node removal..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why DaemonSets exist',
      paragraphs: [
        `Some software is correct only when it runs on the node it is serving. A log collector needs local log files. A CNI agent needs the host networking path. A node exporter needs node-local metrics. A CSI node plugin may need local mount operations. A GPU device plugin needs to advertise devices from the host it is running on.`,
        `A DaemonSet is the Kubernetes controller for that shape of work. It does not ask for five replicas somewhere in the cluster. It asks for one matching daemon Pod on every eligible node, including eligible nodes that join after the object was created. The target is coverage of a moving node set.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The obvious approach is to use a Deployment with a replica count equal to the number of nodes. That looks reasonable for a minute: if the cluster has ten nodes, set replicas to ten and let the scheduler spread them out. Another obvious approach is to install a system service manually on each node image, or to run static Pods from the kubelet manifest directory.`,
        `Each approach loses a different Kubernetes property. A Deployment asks for count, not per-node presence, so two replicas can land on one node while another node has none. Manual install misses autoscaled nodes and creates image drift. Static Pods can be useful for control-plane bootstrapping, but they do not give the same workload API, update strategy, and status model as a managed controller object.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `The wall is node churn. Nodes join, leave, drain, become not-ready, change labels, and gain taints. Cluster autoscaling can add many nodes quickly. Maintenance can remove a whole pool. A node-local agent cannot depend on someone remembering to adjust a replica count or rebuild a machine image.`,
        `The second wall is eligibility. Not every node should always run every daemon. A log collector may exclude GPU nodes. A storage daemon may target only nodes with a disk label. A control-plane agent may need tolerations for control-plane taints. The controller must reconcile not all nodes, but the nodes that match the DaemonSet\'s scheduling intent.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The invariant is one current daemon Pod per eligible node. Eligible is not a vague label. It is the result of the DaemonSet selector, Pod template labels, node selector, node affinity, taints, tolerations, and scheduler placement rules. Current means the Pod matches the DaemonSet template generation and is not an obsolete survivor from an older spec.`,
        `This invariant explains the controller\'s behavior. If an eligible node has no daemon Pod, create one. If a node has a daemon Pod but is no longer eligible, delete it. If the node disappears, remove the obsolete Pod. If the template changes, replace old daemon Pods under the configured rollout budget.`,
      ],
    },
    {
      heading: 'Coverage map',
      paragraphs: [
        `A useful mental model is a coverage ledger with one row per node. Each row answers: is the node eligible, does a matching Pod exist, is it ready, is the Pod stale, and should anything be created or deleted? The DaemonSet controller repeatedly computes this ledger from cluster state and moves actual state toward desired state.`,
        `The official Kubernetes DaemonSet documentation describes this as running a copy of a Pod on all or some nodes, creating Pods for new matching nodes, and garbage-collecting Pods from removed nodes: https://kubernetes.io/docs/concepts/workloads/controllers/daemonset/. The data-structure idea is simply that desired replicas are derived from node rows, not from a fixed integer.`,
      ],
    },
    {
      heading: 'Scheduling details',
      paragraphs: [
        `DaemonSet Pods are still Pods. They go through scheduling, admission, image pull, readiness, resource accounting, and kubelet lifecycle. The difference is that the DaemonSet controller creates Pods that are tied to intended nodes. Kubernetes can add node affinity to created Pods so the scheduler places each Pod on the row it is meant to cover.`,
        `Taints and tolerations matter because infrastructure agents often need access to nodes that ordinary applications should avoid. Kubernetes also adds certain DaemonSet tolerations automatically so daemon Pods can remain useful during node condition transitions. That behavior is powerful, but it should be reviewed: running on not-ready or unreachable nodes may be right for a network agent and wrong for an application-side helper.`,
      ],
    },
    {
      heading: 'Visual cues',
      paragraphs: [
        `In the coverage-map view, each node is a row in the reconciliation ledger. Nodes n1 and n2 are covered because they are eligible and have running daemon Pods. A tainted node is not automatically wrong; it is a question. Does this daemon need a toleration to cover that node, or should the node be excluded?`,
        `In the rolling-daemon view, the mixed old and new Pods show why rollout is a coverage problem. Replacing every daemon Pod at once may update quickly, but it can remove logging, monitoring, networking, or storage support from too many nodes at the same time. A safe rollout treats freshness and coverage as separate goals that must both be measured.`,
      ],
    },
    {
      heading: 'Rolling updates',
      paragraphs: [
        `DaemonSet rollout is different from Deployment rollout because every unavailable Pod is also an uncovered node. maxUnavailable limits how many daemon Pods may be unavailable during an update. Surge, when available for the cluster version and strategy, can create an extra Pod on a node during replacement so coverage gaps are shorter, at the cost of temporary extra resource use.`,
        `Readiness gates are part of the rollout contract. A Pod that exists but is not ready may not be serving its node. For a log shipper, ready should mean logs can be collected and forwarded. For a CNI agent, ready should mean the node networking path is programmed. For a device plugin, ready should mean allocatable resources are reported correctly. A shallow readiness probe turns a coverage controller into a false comfort mechanism.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `It works because reconciliation is tied to node identity rather than cluster-wide count. The controller does not merely ask whether enough Pods exist. It asks which nodes should have Pods, which nodes already have the right Pods, and which rows need repair. This converts node churn into ordinary controller work.`,
        `It also works because the desired count is derived, not configured directly. If a new eligible node appears, the desired set gains a row. If a node is removed, the desired set loses a row. The object\'s spec stays stable while the controller adapts to the current cluster shape.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `Cost grows linearly with eligible nodes. A daemon that asks for 200 MiB on a 100-node cluster reserves about 20 GiB before it handles any workload-specific traffic. A daemon that opens host mounts, watches many files, or scrapes frequently also adds host I/O, network, CPU, and API-server watch pressure across the whole cluster.`,
        `The blast radius is cluster-wide by design. A bad image, broad selector, broken readiness probe, missing toleration, excessive resource request, or unsafe privileged container can affect every eligible node. DaemonSet review should be stricter than ordinary app review because the object often runs with host access and follows nodes automatically.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `DaemonSets win for node-local infrastructure: CNI plugins, kube-proxy replacements, log shippers, node exporters, security scanners, CSI node plugins, GPU device plugins, host-level backup agents, and local cache warmers. These systems need locality more than independent horizontal scaling.`,
        `They also win for bootstrapping dependencies. A node may be technically present but not useful until the network agent, storage agent, monitoring agent, or device plugin is running. The DaemonSet controller gives the platform a standard way to express that each eligible node needs its own agent instance.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `A DaemonSet is the wrong tool for an application that needs N replicas, scales by traffic, or runs batch work to completion. Tying a workload to every node wastes resources when demand is centralized. It can also make scale-down harder because every new node brings another copy of the daemon whether or not useful work exists there.`,
        `It also fails when coverage is confused with correctness. A Pod can exist on every node and still not collect logs, program routes, report metrics, mount volumes, or advertise devices. Operational checks should watch uncovered eligible nodes, unavailable daemon Pods, stale template generations, readiness quality, and the actual downstream signal the daemon is supposed to produce.`,
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        `Start with the node set. Write down which labels identify target nodes, which taints must be tolerated, whether control-plane nodes are included, and what host privileges are actually required. Then set resource requests as if the daemon will run on the largest plausible cluster, because it will scale with nodes automatically.`,
        `For rollout safety, define a readiness probe that checks the daemon\'s real duty, choose maxUnavailable based on tolerated node coverage loss, and alert on eligible nodes without ready current Pods. For troubleshooting, inspect desiredNumberScheduled, currentNumberScheduled, numberReady, numberUnavailable, updatedNumberScheduled, Pod node affinity, tolerations, events, and kubelet logs on uncovered nodes.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Consider a log-agent DaemonSet. Every worker node should have one ready log-agent Pod. GPU nodes are included only if the node selector allows them. Control-plane nodes are included only if the team intentionally adds the right tolerations. When a worker node joins, the controller creates a Pod for that node. When the Pod is ready, logs from that node begin flowing.`,
        `During a rollout, a safe configuration limits unavailable agents and alerts if logs stop arriving from covered nodes. During a node drain, the old row disappears and the replacement node creates a new desired row. During an incident, the useful audit question is not "how many replicas exist?" It is "which eligible nodes lack a ready current agent, and why?"`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: Kubernetes DaemonSet documentation at https://kubernetes.io/docs/concepts/workloads/controllers/daemonset/, Kubernetes Nodes documentation at https://kubernetes.io/docs/concepts/architecture/nodes/, and Kubernetes taints and tolerations at https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/. Study Kubernetes Taints and Tolerations Node Pool, Kubernetes Affinity and Topology Spread Placement, Kubernetes Deployment Rolling Update, Kubernetes Node Pressure Eviction Signal, and Kubernetes Service and EndpointSlice Traffic next.`,
      ],
    },
      {
      heading: 'Why this exists',
      paragraphs: [
        "State the real constraint this topic fixes before introducing the mechanism.",
        "A good opening says what gets too slow, too fragile, or too hard to reason about under baseline behavior.",
        "Without that, every optimization appears decorative.",
      ],
    },

    {
      heading: 'How it works',
      paragraphs: [
        "Describe the mechanism as a sequence of state transitions, not as a story.",
        "Each step should say what changes, what stays true, and why the move is legal.",
        "The animation should look like this section made concrete.",
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
          'If your predicted final state matches the animation for kubernetes-daemonset-node-coverage-controller-case-study, continue to the next topic in the same track.'
  ],
      },
],
};
