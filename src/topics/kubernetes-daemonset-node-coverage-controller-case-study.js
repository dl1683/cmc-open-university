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
        'Read the animation as a coverage controller over nodes. A DaemonSet is a Kubernetes controller whose desired state is one Pod on each eligible node, where eligible means the node matches selectors, affinity, and tolerated taints. Active nodes are being checked or updated, compare nodes are excluded or stale, and found nodes are covered by a ready current-generation daemon Pod.',
        {type:'callout', text:'DaemonSet correctness is coverage, not replica count: every eligible node should converge to exactly one current daemon Pod.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/b/be/Kubernetes.png', alt:'Diagram of a Kubernetes control plane connected to two worker nodes with Pods.', caption:'High level Kubernetes architecture diagram by Khtan66, Wikimedia Commons, CC BY-SA 4.0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Some software is correct only when it runs on the machine it serves. A log collector needs local log files, a CNI plugin needs the host network namespace, a node exporter needs kernel metrics, and a storage plugin needs local mount access. A fixed replica count does not express that node-local contract.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a Deployment with replicas equal to the node count and anti-affinity so Pods spread across machines. That works for a static 10-node cluster if a person updates the replica count on every node change. It breaks when autoscaling adds nodes, maintenance removes nodes, or only some node pools should run the agent.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is node churn plus eligibility. Nodes join, drain, change labels, become NotReady, gain taints, and disappear, while agents often target only GPU nodes, storage nodes, control-plane nodes, or Linux nodes. A static replica count cannot answer which exact nodes should have a Pod right now.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is set difference. The desired set is all currently eligible nodes, and the actual set is nodes that already have one current daemon Pod. The controller creates Pods for desired minus actual, deletes Pods for actual minus desired, and rolls stale Pods toward the current template.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The DaemonSet controller watches DaemonSet objects, Nodes, and owned Pods. For each node, it checks selectors, node affinity, and taints against the Pod template tolerations; if the node is eligible and lacks a Pod, it creates one pinned to that node through node affinity. During a rolling update, it replaces old daemon Pods under `maxUnavailable` or surge policy so coverage gaps stay bounded.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness invariant is exactly one current Pod per eligible node under stable inputs. Reconciliation is idempotent: if the Pod already exists, no duplicate is needed; if the node is no longer eligible, deletion is safe; if the Pod is stale, update policy decides when replacement is legal. Because desired state is recomputed from the live node list, a node added at 03:00 can be covered without a human changing a replica count.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'DaemonSet cost scales with infrastructure size, not user traffic. A daemon requesting 100m CPU and 128 MiB on 500 eligible nodes reserves 50 CPU cores and 64 GiB of memory even if the application workload is quiet. Rolling out a 500 MB image to those 500 nodes can pull 250 GB across registries and node networks.',
        'The behavioral cost is blast radius. A bad Deployment affects its replicas, but a bad DaemonSet can affect every eligible node at once. Privileged host access, broad selectors, weak readiness probes, and large resource requests deserve stricter review because the mistake is multiplied by node count.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'DaemonSets fit node-local platform agents: CNI plugins, kube-proxy replacements, log shippers, metrics exporters, CSI node plugins, GPU device plugins, security agents, and node-local DNS caches. The shared pattern is that the agent needs host-level access and the number of instances should track qualifying machines rather than request volume.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'DaemonSet is wrong for traffic-scaled web services, finite batch work, and cluster-wide aggregators that need one or a few replicas. It also fails when Pod existence is mistaken for functional coverage: a log shipper Pod can be Running while file permissions prevent log collection. Production checks must verify the downstream signal the daemon is meant to produce.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A Fluent Bit DaemonSet targets 3 control-plane nodes and 10 workers, with a toleration for the control-plane taint. Desired coverage is 13 Pods. When the autoscaler adds 5 workers, desired coverage becomes 18, so the controller creates 5 new Pods without changing any replica field.',
        'Now the team updates the image from 3.1 to 3.2 with `maxUnavailable: 1`. The controller deletes or replaces one old Pod, waits until the new Pod is ready, then moves to the next node. On an 18-node cluster, the rollout takes 18 safe steps if every node updates cleanly, and at most one eligible node lacks a ready daemon at a time.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Use the official Kubernetes DaemonSet concept page, DaemonSet update task guide, node lifecycle documentation, and taints and tolerations documentation as primary sources. They define coverage behavior, scheduling, auto-added tolerations, rolling update knobs, and node conditions.',
        'Study taints and tolerations next, then affinity, node pressure eviction, Deployment rolling updates, and Service traffic paths. Those topics explain why daemon coverage depends on node eligibility, rollout safety, and node-local data-plane work.',
      ],
    },
  ],
};