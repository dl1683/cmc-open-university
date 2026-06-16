// Kubernetes taints and tolerations: node pools repel ordinary Pods unless the
// Pod carries a matching toleration, while other scheduler filters still apply.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'kubernetes-taints-tolerations-node-pool-case-study',
  title: 'Kubernetes Taints and Tolerations Node Pool Case Study',
  category: 'Systems',
  summary: 'How node taints, Pod tolerations, NoSchedule, PreferNoSchedule, NoExecute, and tolerationSeconds shape dedicated node pools and eviction behavior.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['repel and tolerate', 'dedicated pool'], defaultValue: 'repel and tolerate' },
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

function taintGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'pod', label: 'Pod', x: 0.7, y: 3.8, note: notes.pod ?? 'pending' },
      { id: 'tol', label: 'tol', x: 2.4, y: 3.8, note: notes.tol ?? 'key=val' },
      { id: 'sched', label: 'sched', x: 4.1, y: 3.8, note: notes.sched ?? 'filter' },
      { id: 'nodeA', label: 'node A', x: 6.2, y: 2.1, note: notes.nodeA ?? 'clean' },
      { id: 'nodeB', label: 'gpu', x: 6.2, y: 3.8, note: notes.nodeB ?? 'tainted' },
      { id: 'nodeC', label: 'node C', x: 6.2, y: 5.5, note: notes.nodeC ?? 'full' },
      { id: 'bind', label: 'bind', x: 8.2, y: 3.8, note: notes.bind ?? 'chosen' },
      { id: 'kubelet', label: 'kubelet', x: 9.5, y: 3.8, note: notes.kubelet ?? 'run/evict' },
    ],
    edges: [
      { id: 'e-pod-tol', from: 'pod', to: 'tol' },
      { id: 'e-tol-sched', from: 'tol', to: 'sched' },
      { id: 'e-sched-nodeA', from: 'sched', to: 'nodeA' },
      { id: 'e-sched-nodeB', from: 'sched', to: 'nodeB' },
      { id: 'e-sched-nodeC', from: 'sched', to: 'nodeC' },
      { id: 'e-nodeB-bind', from: 'nodeB', to: 'bind' },
      { id: 'e-bind-kubelet', from: 'bind', to: 'kubelet' },
    ],
  }, { title });
}

function* repelAndTolerate() {
  yield {
    state: taintGraph('A taint repels Pods that do not tolerate it'),
    highlight: { active: ['nodeB', 'sched', 'e-sched-nodeB'], compare: ['pod', 'tol'] },
    explanation: 'A taint lives on a node and says ordinary Pods should stay away. A toleration lives on a Pod and lets the scheduler consider that node. It does not force placement there.',
    invariant: 'Toleration permits scheduling; it does not choose the node by itself.',
  };

  yield {
    state: labelMatrix(
      'Taint effects',
      [
        { id: 'no', label: 'NoSch' },
        { id: 'pref', label: 'Pref' },
        { id: 'exec', label: 'NoExe' },
        { id: 'time', label: 'sec' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['block', 'stuck'],
        ['avoid', 'soft'],
        ['evict', 'churn'],
        ['grace', 'late'],
      ],
    ),
    highlight: { active: ['no:job', 'exec:job'], compare: ['pref:job'] },
    explanation: 'The effect controls how hard the repulsion is. NoSchedule blocks new placements. PreferNoSchedule is a soft preference. NoExecute can evict already-running Pods unless they tolerate it.',
  };

  yield {
    state: taintGraph('The scheduler still checks resources, affinity, and policy', { tol: 'matches', nodeB: 'taint ok', nodeC: 'CPU full' }),
    highlight: { active: ['pod', 'tol', 'sched', 'nodeB', 'e-pod-tol', 'e-tol-sched'], found: ['bind'] },
    explanation: 'A matching toleration only removes one filter failure. The node must still satisfy resource requests, affinity, topology, volume, policy, and other scheduler plugins.',
  };

  yield {
    state: labelMatrix(
      'Debug ledger',
      [
        { id: 'key', label: 'key' },
        { id: 'val', label: 'val' },
        { id: 'eff', label: 'eff' },
        { id: 'op', label: 'op' },
      ],
      [
        { id: 'taint', label: 'taint' },
        { id: 'tol', label: 'tol' },
      ],
      [
        ['gpu', 'gpu'],
        ['true', 'true'],
        ['NoSch', 'NoSch'],
        ['Equal', 'Equal'],
      ],
    ),
    highlight: { active: ['key:taint', 'key:tol', 'eff:taint', 'eff:tol'], found: ['op:tol'] },
    explanation: 'Debugging is matching triples: key, value, effect, and operator. Small mismatches make a Pod look inexplicably unschedulable until you compare the fields directly.',
  };
}

function* dedicatedPool() {
  yield {
    state: taintGraph('Dedicated GPU nodes repel ordinary workloads', { nodeB: 'gpu only', pod: 'trainer' }),
    highlight: { active: ['nodeB', 'pod', 'tol', 'sched'], compare: ['nodeA'] },
    explanation: 'A dedicated GPU pool typically has a taint such as dedicated=gpu:NoSchedule. GPU workloads carry a matching toleration; ordinary web Pods do not.',
  };

  yield {
    state: labelMatrix(
      'Pool policy',
      [
        { id: 'web', label: 'web' },
        { id: 'gpu', label: 'gpu' },
        { id: 'sys', label: 'sys' },
        { id: 'ops', label: 'ops' },
      ],
      [
        { id: 'tol', label: 'tol' },
        { id: 'fit', label: 'fit' },
      ],
      [
        ['none', 'no'],
        ['gpu', 'yes'],
        ['sys', 'yes'],
        ['break', 'rare'],
      ],
    ),
    highlight: { active: ['gpu:tol', 'gpu:fit'], compare: ['web:fit'] },
    explanation: 'Taints encode admission to the pool. Labels, requests, and affinity usually encode attraction after admission. Keeping those separate makes intent easier to audit.',
  };

  yield {
    state: taintGraph('NoExecute can move Pods off a bad node', { nodeB: 'not-ready', kubelet: 'evict' }),
    highlight: { active: ['nodeB', 'kubelet', 'e-bind-kubelet'], found: ['pod'] },
    explanation: 'NoExecute taints are used for node health states such as not-ready or unreachable. Pods with bounded tolerationSeconds get a grace window before eviction.',
  };

  yield {
    state: labelMatrix(
      'Complete case: GPU pool',
      [
        { id: 'taint', label: 'taint' },
        { id: 'tol', label: 'tol' },
        { id: 'label', label: 'label' },
        { id: 'quota', label: 'quota' },
      ],
      [
        { id: 'record', label: 'rec' },
        { id: 'why', label: 'why' },
      ],
      [
        ['gpu', 'repel'],
        ['gpu', 'admit'],
        ['gpu', 'score'],
        ['team', 'limit'],
      ],
    ),
    highlight: { active: ['taint:why', 'tol:why', 'label:why'], found: ['quota:why'] },
    explanation: 'A real GPU pool combines taints, tolerations, labels, resource requests, PriorityClasses, and quotas. Taints keep the wrong Pods out; the rest decides who gets scarce capacity.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'repel and tolerate') yield* repelAndTolerate();
  else if (view === 'dedicated pool') yield* dedicatedPool();
  else throw new InputError('Pick a Kubernetes taints/tolerations view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Taints and tolerations are Kubernetes scheduling controls for node admission. A taint is placed on a node. A toleration is placed on a Pod. If the Pod does not tolerate the taint, the scheduler should avoid or reject that node depending on the taint effect.',
        'The official taints and tolerations documentation explains that node affinity attracts Pods to nodes while taints repel Pods, and that tolerations allow scheduling but do not guarantee it: https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/. The Toleration API reference defines matching by key, value, effect, and operator: https://kubernetes.io/docs/reference/kubernetes-api/definitions/toleration-v1/.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The data structure is a filter ledger. Each node has taint rows: key, value, effect, and time. Each Pod has toleration rows: key, operator, value, effect, and optional tolerationSeconds. The scheduler computes whether every relevant taint is tolerated, then continues through the rest of the scheduling plugins.',
        'This distinction matters. Tolerating a GPU taint does not mean the Pod requests a GPU, fits the node, satisfies topology spread, or has quota. Taints answer "may this Pod enter this pool?" Other scheduling structures answer "is this the best feasible node?"',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A platform team creates a GPU node pool and taints every GPU node with dedicated=gpu:NoSchedule. Training jobs carry a matching toleration, request nvidia.com/gpu, and use node labels or affinity to prefer the GPU pool. Web services lack the toleration and never land there by accident. Namespace ResourceQuota prevents one team from using all high-priority GPU workloads.',
        'For node health, Kubernetes may use NoExecute-style taints such as not-ready or unreachable. A Pod with tolerationSeconds can remain for a bounded grace period; after that the kubelet or control-plane behavior can remove it. This is pool admission plus failure response, not a general replacement for readiness, disruption budgets, or quotas.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Kubernetes Scheduler PriorityQueue & Preemption for the surrounding scheduler loop, Kubernetes Affinity and Topology Spread Placement for attraction and balancing, Kubernetes Priority and Preemption Nomination for scarce-capacity arbitration, Kubernetes Node Pressure Eviction Signal for kubelet-side resource pressure, and Kubernetes ResourceQuota and LimitRange Admission for namespace policy.',
      ],
    },
  ],
};
