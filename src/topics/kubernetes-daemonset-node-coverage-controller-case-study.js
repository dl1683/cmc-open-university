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
    explanation: 'DaemonSets are infrastructure, so gaps are operationally visible. Missing log, network, monitoring, or storage agents can make a node look healthy while the platform is degraded.',
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
    explanation: 'The same rollout vocabulary appears again: unavailable budget, optional surge, readiness gates, and revision history. The difference is that every node is a target.',
  };

  yield {
    state: dsGraph('Node removal garbage-collects daemon Pods', { n3: 'removed', p3: 'delete', obs: 'covered' }),
    highlight: { active: ['n3', 'p3', 'obs', 'e-p3-obs'], found: ['ctrl'] },
    explanation: 'When a node disappears, its daemon Pod is garbage-collected. When a node joins and matches eligibility, the controller creates a new daemon Pod for it.',
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
      heading: 'What it is',
      paragraphs: [
        'A DaemonSet ensures that all or some eligible nodes run a copy of a Pod. It is the workload controller for node-local facilities such as network plugins, log collectors, monitoring agents, and storage daemons.',
        'The official DaemonSet documentation says DaemonSets define Pods that provide node-local facilities and ensure nodes run a copy as nodes are added or removed: https://kubernetes.io/docs/concepts/workloads/controllers/daemonset/. The Nodes documentation notes that DaemonSet Pods tolerate being run on unschedulable nodes and often provide node-local services needed during drain or platform operation: https://kubernetes.io/docs/concepts/architecture/nodes/.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The data structure is a node coverage map. For each node, the controller asks whether the node is eligible, whether the matching daemon Pod exists, whether it is ready, whether it needs update, and whether it should be removed. The desired count follows eligible nodes, not a fixed replica integer.',
        'DaemonSet eligibility combines selectors, affinity, taints, tolerations, and scheduler behavior. The controller can add node affinity so the scheduler binds each daemon Pod to the target host.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A cluster log collector runs as a DaemonSet. Every worker node should have exactly one log-agent Pod. Control-plane nodes are included only if the Pod template has the required tolerations. When a new node joins, the DaemonSet controller creates a log-agent Pod for that node. During rollout, readiness and unavailable budget decide whether log coverage is temporarily reduced.',
        'The operational signal is not simply desired number scheduled. It is uncovered eligible nodes, unavailable daemon Pods, stale versions, and whether the daemon is part of bootstrapping, networking, or observability. A missing CNI DaemonSet Pod can prevent ordinary workloads from running correctly on that node.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Kubernetes Taints and Tolerations Node Pool, Kubernetes Affinity and Topology Spread Placement, Kubernetes Deployment Rolling Update, Kubernetes Node Pressure Eviction Signal, and Kubernetes Service and EndpointSlice Traffic for the network agent use case.',
      ],
    },
  ],
};
