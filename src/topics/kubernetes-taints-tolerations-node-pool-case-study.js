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
    explanation: 'The taint makes the GPU pool deny-by-default. A matching toleration is the explicit exception for workloads that also request the scarce GPU resource.',
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
      heading: 'How to read the animation',
      paragraphs: [
        'The repel-and-tolerate view shows a taint on the node and a toleration on the Pod. A taint is a node-owned repulsion rule. A toleration is a Pod-owned exception that lets the scheduler keep that node in the candidate set.',
        'The dedicated-pool view layers several decisions. Tolerating a taint means the Pod is allowed to be considered, not that it is chosen. The safe inference is that resource requests, labels, affinity, quotas, and scoring still decide whether binding is possible.',
        {type:'callout', text:'Taints are node-owned repulsion and tolerations are Pod-owned exceptions, so admission to a pool stays separate from attraction, scoring, and resource fit.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A Kubernetes cluster often has special nodes: GPU nodes, storage-heavy nodes, control-plane nodes, compliance nodes, and nodes in bad health. Ordinary Pods should not land there by accident. The platform needs a node-side way to repel Pods unless the Pod carries an explicit exception.',
        'Labels and affinity attract Pods, but attraction is not protection. A GPU node can have a label accelerator=nvidia, yet an ordinary web Pod with no selector might still be placed there if the scheduler sees free CPU and memory. Taints and tolerations solve the negative side of placement.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to label special nodes and ask special workloads to select those labels. That works for workloads that opt in. It does not stop workloads that forgot to opt out.',
        'Another approach is to split every special workload into its own cluster. That gives strong separation, but it fragments capacity and multiplies operations work. A shared cluster needs an admission rule that belongs to the node pool itself.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that scheduling answers two different questions. First, is this Pod allowed to run on this node? Second, among allowed nodes, is this a good placement? Labels, affinity, topology, and scoring help with the second question more than the first.',
        'A second wall appears after placement. A node can become unreachable or not-ready after Pods are already running. A pure scheduling filter only affects new Pods, so Kubernetes also needs a taint effect that can evict existing Pods after a grace period.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A taint is repulsion owned by a node, expressed as key, optional value, and effect. A toleration is permission owned by a Pod, expressed as key, operator, optional value, effect, and optional tolerationSeconds. Matching removes the repulsion barrier for that Pod.',
        'The key idea is separation. Taints protect node pools from accidental admission. Other mechanisms still express attraction, resource need, fairness, and priority. A toleration is a pass through one gate, not a reservation or a scheduling command.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'With effect NoSchedule, the scheduler filters out a node if the Pod lacks a matching toleration. With PreferNoSchedule, the scheduler tries to avoid the node but can still use it. With NoExecute, existing Pods without matching tolerations can be evicted and new Pods without tolerations should not be placed there.',
        'Matching is field comparison. Equal matches key, value, and effect. Exists can match a key and effect without requiring a specific value. tolerationSeconds applies to NoExecute and sets how long a Pod may remain after the taint appears.',
      ],
    },    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from the explicit-exception invariant. A node with an untolerated hard taint is not a feasible node for that Pod. The scheduler can only consider it after the Pod spec shows a matching exception.',
        'The model composes because permission and preference remain separate. A training job may tolerate dedicated=gpu:NoSchedule, but it still must request a GPU, satisfy quota, match node labels or affinity, and win scoring. That prevents toleration from becoming hidden capacity allocation.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The CPU cost is usually small. For each candidate node, the scheduler compares a short taint list with a short toleration list. If a Pod has 4 tolerations and a node has 3 taints, the check is around 12 small comparisons before other filters and scores.',
        'The operational cost is key governance. A typo such as dedicated=gpu on the node and dedicated=true in the Pod leaves the Pod pending. Broad Exists tolerations reduce friction but slowly remove the protection the taint was meant to provide.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Taints fit dedicated pools: GPU, high-memory, storage, control-plane, low-latency, and compliance nodes. The taint keeps ordinary Pods out. A matching toleration plus resource request and affinity lets the intended workload in.',
        'They also fit node health and lifecycle states. Kubernetes can taint nodes that are not-ready or unreachable, and NoExecute behavior can remove Pods that should not stay on those nodes. That gives one mechanism for both placement admission and runtime eviction pressure.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Taints do not allocate resources. A Pod that tolerates the GPU pool but does not request nvidia.com/gpu can still be the wrong workload for that node. Use requests, quotas, and admission policy to prove resource intent.',
        'Taints are also too coarse for fairness, business priority, or data locality. They say who may enter a class of nodes. They do not decide how many GPUs a team may consume, which job matters more, or whether two Pods should be spread across zones.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A cluster has 8 GPU nodes and 80 general nodes. Each GPU node has taint dedicated=gpu:NoSchedule and label accelerator=nvidia. A normal web Pod has no toleration, so all 8 GPU nodes are filtered out before scoring.',
        'A training Pod has a toleration for dedicated=gpu:NoSchedule, node affinity for accelerator=nvidia, and a request for 1 nvidia.com/gpu. If each GPU node has 4 GPUs, the pool has 32 GPU slots. The toleration admits the Pod to the 8-node candidate pool, and the resource request consumes 1 of those 32 slots.',
        'Now one GPU node becomes unreachable and receives a NoExecute taint. A training Pod with tolerationSeconds=300 may remain bound for 5 minutes while the cluster waits for recovery. A normal Pod with no toleration is evicted immediately because it has no explicit exception.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Kubernetes taints and tolerations at https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/ and the Toleration API reference at https://kubernetes.io/docs/reference/kubernetes-api/workload-resources/pod-v1/#scheduling. Check scheduler events because they usually report untolerated taints directly.',
        'Study Kubernetes scheduler filters and scoring, node affinity, topology spread, PriorityClass and preemption, ResourceQuota, LimitRange, node-pressure eviction, and device plugins next. The main habit is to separate admission, attraction, and allocation.',
      ],
    },
  ],
};