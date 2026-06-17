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
      heading: 'The problem',
      paragraphs: [
        'A Kubernetes cluster is shared infrastructure. Some nodes are ordinary general-purpose capacity. Other nodes are expensive, sensitive, or temporarily unhealthy: GPU nodes, high-memory nodes, storage nodes, control-plane nodes, compliance pools, and nodes under pressure. The platform needs a way for those nodes to say that ordinary Pods should stay away unless they carry an explicit exception.',
        'Labels and affinity can attract Pods to a node pool, but attraction is not protection. A web Pod with no selector might still land on an expensive GPU node if the scheduler sees enough free CPU and memory. A health-related node condition also needs a way to repel new Pods or evict running Pods. Taints and tolerations solve the negative side of placement.',
      ],
    },
    {
      heading: 'The naive approaches',
      paragraphs: [
        'The first naive approach is to label special nodes and ask special workloads to select them. That works for the workloads that opt in, but it does not block workloads that forgot to opt out. It is a positive rule owned by the Pod, not a deny-by-default rule owned by the node pool.',
        'The second approach is to create separate clusters for every special workload. That gives strong isolation, but it increases operational cost and fragments capacity. The third approach is to rely on human convention or admission scripts. Those can help, but the scheduler still needs a first-class placement rule that is visible in Pod and Node specs.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that scheduling has two different questions. Is this Pod allowed to run on this node? If it is allowed, is this node a good place for it? Labels, affinity, scoring, resource requests, topology spread, and priority help answer the second question. They do not fully answer the first question for dedicated or unhealthy node pools.',
        'A second wall is eviction. A node can become not-ready or unreachable after Pods are already running. A pure scheduling filter only affects new placements. Kubernetes also needs a rule that can remove existing Pods from a node after a grace period when the node state says they should not remain there.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'A taint is node-side repulsion. A toleration is Pod-side permission to ignore a matching repulsion. The key phrase is permission: tolerating a taint does not choose the node. It only lets the node remain a candidate. The Pod must still pass resource, affinity, topology, volume, policy, and scoring checks.',
        'That separation is powerful. Taints define admission to a pool. Labels and affinity can then define attraction within the allowed set. Resource requests prove that the Pod needs the scarce resource. Quotas and priority decide who is allowed to consume limited capacity. The taint is one filter in a larger scheduling pipeline, not a complete placement policy by itself.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'A taint has a key, optional value, and effect. A toleration has a key, operator, optional value, optional effect, and optional tolerationSeconds. Matching is field comparison. With operator Equal, the key, value, and effect must match the taint. With operator Exists, the toleration can match by key and effect without requiring a specific value.',
        'The effect controls strength. NoSchedule means the scheduler must not place a new Pod on the node unless the Pod tolerates the taint. PreferNoSchedule means the scheduler should avoid the node, but may still use it if other constraints make that necessary. NoExecute means existing Pods that do not tolerate the taint can be evicted, and new Pods without the toleration should not be placed there.',
        'tolerationSeconds belongs to NoExecute behavior. It lets a Pod remain bound for a bounded grace period after a matching NoExecute taint appears. That matters for node health states such as not-ready or unreachable, where immediate eviction may be too aggressive but waiting forever would leave workload stuck on a bad node.',
      ],
    },
    {
      heading: 'Scheduler pipeline',
      paragraphs: [
        'During scheduling, the taint check is one filter among many. The scheduler considers a pending Pod, evaluates candidate nodes, and removes nodes whose untolerated NoSchedule taints reject the Pod. If a node passes that filter, it still must satisfy CPU and memory requests, volume constraints, node affinity, inter-pod affinity, topology spread, host ports, policy plugins, and other configured rules.',
        'This is why a toleration is not a placement request. A training Pod may tolerate dedicated=gpu:NoSchedule, but it may still fail scheduling if no node has a free GPU, if quota blocks the namespace, if topology spread conflicts, or if the Pod forgot to request the actual GPU resource. The toleration only removes the taint barrier.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is explicit exception. A tainted node repels ordinary Pods by default. A Pod can pass that repulsion only by carrying a matching toleration. That makes accidental placement less likely because the exception is visible in the workload spec and can be audited by platform teams.',
        'The model composes because repulsion and attraction remain separate. The node pool can protect itself with taints. Workloads can express desire with selectors or affinity. The scheduler can score among feasible nodes. Admission control, ResourceQuota, PriorityClass, and runtime eviction policies can add additional governance without changing the basic meaning of a toleration.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A platform team creates a GPU node pool. Every GPU node receives the taint dedicated=gpu:NoSchedule and the label accelerator=nvidia. Ordinary web Pods have no toleration, so the scheduler filters GPU nodes out before scoring. Training Pods include a toleration for dedicated=gpu:NoSchedule, request nvidia.com/gpu, and use node affinity for accelerator=nvidia.',
        'The toleration admits the training Pod to the GPU pool, but the GPU request and node label still matter. The request prevents a Pod that merely tolerates the pool from consuming a GPU node without declaring GPU need. The label or affinity makes the intent explicit for scheduling. Quota can limit how many GPUs a namespace consumes, and priority can decide which work wins when capacity is scarce.',
        'Now suppose a GPU node becomes unreachable and receives a NoExecute taint. A critical system Pod might tolerate that taint forever. A training job might tolerate it for 300 seconds. A normal Pod with no toleration is evicted. The same mechanism handles both dedicated pool admission and node-health response, but the effects and tolerationSeconds determine the behavior.',
      ],
    },
    {
      heading: 'Animation guide',
      paragraphs: [
        'The repel and tolerate view shows the key correction: the taint lives on the node, and the toleration lives on the Pod. Matching the toleration lets the scheduler consider the tainted node. It does not skip the rest of scheduling. The resource and policy checks still decide whether binding is possible.',
        'The dedicated pool view shows how real clusters combine rules. The taint keeps ordinary workloads away from the GPU pool. The toleration admits GPU jobs. Labels and requests express attraction and resource need. The NoExecute frame adds the eviction side, where a taint can affect Pods that are already running.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The scheduler cost is usually small. For each candidate node, Kubernetes compares a short list of taints with a short list of tolerations. The operational cost is larger than the CPU cost. Humans must keep keys, values, effects, and operators consistent across node pool definitions, Helm charts, admission policies, and workload templates.',
        'Hard taints can strand capacity. If a pool is tainted and only a few Pods tolerate it, those nodes may sit idle while ordinary workloads wait elsewhere. That may be correct for expensive or sensitive hardware, but it is still a tradeoff. PreferNoSchedule can reduce waste, but because it is soft it should not protect resources where accidental placement is unacceptable.',
        'Broad tolerations weaken the model. A toleration with operator Exists and no carefully scoped effect can admit a Pod to many tainted nodes. Some broad tolerations are necessary for system agents, but they should be rare and audited. Otherwise the cluster slowly returns to convention-based placement with extra YAML.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Taints win for dedicated node pools. GPU nodes, storage-heavy nodes, compliance nodes, control-plane nodes, low-latency nodes, and critical add-on nodes all benefit from a node-owned admission rule. The taint makes the default safe: ordinary Pods do not land there by accident.',
        'They also win for health and lifecycle states. A not-ready, unreachable, draining, or special-maintenance node can repel new Pods and, with NoExecute semantics, force existing Pods to leave after a grace period. This gives the cluster a common language for both placement and eviction pressure.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Taints fail when they are treated as resource allocation. A toleration for the GPU pool does not request a GPU. It does not reserve capacity. It does not override quota. It does not mean the Pod is important. Those decisions require resource requests, ResourceQuota, LimitRange, PriorityClass, preemption policy, and sometimes admission control.',
        'They also fail as a fine-grained policy language. Taints are coarse node filters. They do not express team budgets, fairness, data locality, complex anti-affinity, or business priority. They are best used to keep the wrong Pods out of a class of nodes, then combined with other Kubernetes mechanisms for the rest of the scheduling decision.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'A common failure mode is a field mismatch. The node has dedicated=gpu:NoSchedule, while the Pod tolerates dedicated=true:NoSchedule or omits the effect. The Pod remains pending and the event message may mention untolerated taints. The fix is to compare key, value, operator, and effect directly rather than guessing from pool names.',
        'Another failure mode is an overbroad toleration in a shared template. A base chart adds Exists for convenience, and suddenly workloads can enter pools they should never touch. This is dangerous because scheduling may still look normal until scarce capacity is consumed by the wrong Pods.',
        'NoExecute introduces churn failure modes. If tolerationSeconds is too short, transient node issues can evict Pods unnecessarily. If it is too long, workloads remain associated with bad nodes and recovery slows. For stateful workloads, that choice must be coordinated with readiness, disruption budgets, storage attachment behavior, and application failover time.',
      ],
    },
    {
      heading: 'Debug checklist',
      paragraphs: [
        'Start with the Pod events. Kubernetes usually reports untolerated taints when they block scheduling. Then inspect the node taints and the Pod tolerations side by side. Compare key, value, effect, and operator. Remember that tolerating a taint only clears one filter; the Pod may still fail resources, affinity, topology, or volume constraints.',
        'For dedicated pools, check the whole policy bundle. The node should have the taint that repels ordinary Pods. The intended workload should have the matching toleration. The node should have labels for attraction. The Pod should request the scarce resource. Namespace quota and priority should reflect who is allowed to consume the pool. Missing any one of those pieces can make placement either too strict or too loose.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Kubernetes taints and tolerations documentation at https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/ and the Toleration API reference at https://kubernetes.io/docs/reference/kubernetes-api/definitions/toleration-v1/.',
        'Study Kubernetes Scheduler PriorityQueue & Preemption for the surrounding scheduling loop, Kubernetes Affinity and Topology Spread Placement for attraction and balancing, Kubernetes Priority and Preemption Nomination for scarce-capacity arbitration, Kubernetes Node Pressure Eviction Signal for kubelet-side resource pressure, and Kubernetes ResourceQuota and LimitRange Admission for namespace policy.',
      ],
    },
  ],
};
