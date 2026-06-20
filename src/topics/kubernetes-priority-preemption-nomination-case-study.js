// Kubernetes priority and preemption: high-priority pending Pods can nominate
// nodes, evict lower-priority victims, then wait for resources to appear.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'kubernetes-priority-preemption-nomination-case-study',
  title: 'Kubernetes Priority and Preemption Nomination Case Study',
  category: 'Systems',
  summary: 'How PriorityClass, queue ordering, preemptionPolicy, victim selection, PDB best effort, graceful termination, and nominatedNodeName coordinate scarce capacity.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['priority queue', 'preemption gap'], defaultValue: 'priority queue' },
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

function preemptGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'p', label: 'Pod P', x: 0.7, y: 3.8, note: notes.p ?? 'high prio' },
      { id: 'queue', label: 'queue', x: 2.2, y: 3.8, note: notes.queue ?? 'front' },
      { id: 'filter', label: 'filter', x: 3.8, y: 3.8, note: notes.filter ?? 'no fit' },
      { id: 'node', label: 'node N', x: 5.5, y: 3.8, note: notes.node ?? 'candidate' },
      { id: 'v1', label: 'low A', x: 7.1, y: 2.2, note: notes.v1 ?? 'victim' },
      { id: 'v2', label: 'low B', x: 7.1, y: 5.4, note: notes.v2 ?? 'kept?' },
      { id: 'nom', label: 'nom', x: 8.7, y: 3.8, note: notes.nom ?? 'reserve' },
      { id: 'bind', label: 'bind', x: 10.0, y: 3.8, note: notes.bind ?? 'later' },
    ],
    edges: [
      { id: 'e-p-queue', from: 'p', to: 'queue' },
      { id: 'e-queue-filter', from: 'queue', to: 'filter' },
      { id: 'e-filter-node', from: 'filter', to: 'node' },
      { id: 'e-node-v1', from: 'node', to: 'v1' },
      { id: 'e-node-v2', from: 'node', to: 'v2' },
      { id: 'e-node-nom', from: 'node', to: 'nom' },
      { id: 'e-nom-bind', from: 'nom', to: 'bind' },
    ],
  }, { title });
}

function* priorityQueueView() {
  yield {
    state: preemptGraph('Priority moves important Pods earlier in the scheduling queue'),
    highlight: { active: ['p', 'queue', 'e-p-queue'], compare: ['node', 'v1'] },
    explanation: 'PriorityClass resolves to a numeric priority on the Pod. Higher-priority pending Pods are tried earlier, but they still need a feasible node.',
    invariant: 'Priority affects order first; feasibility still decides placement.',
  };

  yield {
    state: labelMatrix(
      'Priority policy',
      [
        { id: 'class', label: 'class' },
        { id: 'num', label: 'num' },
        { id: 'never', label: 'never' },
        { id: 'quota', label: 'quota' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['name', 'sprawl'],
        ['order', 'abuse'],
        ['no evict', 'wait'],
        ['cap', 'block'],
      ],
    ),
    highlight: { active: ['class:role', 'num:role', 'never:role'], found: ['quota:risk'] },
    explanation: 'Priority is powerful enough to need governance. Untrusted or careless users with high priority can evict other workloads, so ResourceQuota is part of the control surface.',
  };

  yield {
    state: preemptGraph('If no node fits, preemption looks for lower-priority victims', { filter: 'no fit', v1: 'remove', v2: 'maybe' }),
    highlight: { active: ['filter', 'node', 'v1', 'e-filter-node', 'e-node-v1'], compare: ['v2'] },
    explanation: 'Preemption asks whether removing lower-priority Pods from a node would make the high-priority Pod feasible. It does not remove arbitrary Pods just because they are lower priority.',
  };

  yield {
    state: labelMatrix(
      'Victim choice',
      [
        { id: 'prio', label: 'prio' },
        { id: 'fit', label: 'fit' },
        { id: 'pdb', label: 'PDB' },
        { id: 'aff', label: 'aff' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'fail', label: 'fail' },
      ],
      [
        ['lower', 'skip'],
        ['after rm', 'no fit'],
        ['best', 'break'],
        ['still ok', 'block'],
      ],
    ),
    highlight: { active: ['prio:check', 'fit:check', 'pdb:check'], found: ['aff:fail'] },
    explanation: 'The scheduler prefers lower-priority victims and tries to avoid violating PDBs, but PDB protection is best effort for preemption. Affinity can also make a victim set invalid.',
  };
}

function* preemptionGap() {
  yield {
    state: preemptGraph('The preemptor nominates a node before it can bind', { nom: 'node N', bind: 'wait' }),
    highlight: { active: ['node', 'nom', 'e-node-nom'], compare: ['bind'] },
    explanation: 'When a node is chosen for preemption, the pending Pod status can get nominatedNodeName. That records the intended node while victims terminate and resources become available.',
  };

  yield {
    state: labelMatrix(
      'Timeline',
      [
        { id: 't0', label: 't0' },
        { id: 't1', label: 't1' },
        { id: 't2', label: 't2' },
        { id: 't3', label: 't3' },
      ],
      [
        { id: 'event', label: 'event' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['nom', 'race'],
        ['evict', 'grace'],
        ['free', 'new P'],
        ['bind', 'drift'],
      ],
    ),
    highlight: { active: ['t0:event', 't1:event', 't3:event'], compare: ['t2:risk'] },
    explanation: 'Preemption has a gap. Victims receive termination time, the scheduler keeps working, and a different higher-priority Pod may arrive before the nominated Pod binds.',
  };

  yield {
    state: preemptGraph('A higher-priority Pod can steal the nominated slot', { p: 'P waits', nom: 'stale?', bind: 'other pod' }),
    highlight: { active: ['p', 'nom', 'bind'], compare: ['v1', 'v2'] },
    explanation: 'nominatedNodeName is not a permanent reservation. If an even higher-priority Pod appears or another node becomes feasible, the scheduler can clear or bypass the nomination.',
  };

  yield {
    state: labelMatrix(
      'Complete case: control plane Pod',
      [
        { id: 'sys', label: 'sys' },
        { id: 'work', label: 'work' },
        { id: 'pdb', label: 'PDB' },
        { id: 'quota', label: 'quota' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['high', 'small set'],
        ['low', 'victim'],
        ['best', 'not hard'],
        ['cap', 'tenant'],
      ],
    ),
    highlight: { active: ['sys:role', 'work:role', 'quota:guard'], compare: ['pdb:guard'] },
    explanation: 'A system-critical Pod may preempt lower-priority batch work during scarcity. The safe design uses a narrow PriorityClass, quota controls, clear events, and workload budgets that tolerate occasional loss.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'priority queue') yield* priorityQueueView();
  else if (view === 'preemption gap') yield* preemptionGap();
  else throw new InputError('Pick a Kubernetes priority/preemption view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The priority queue view shows how PriorityClass values control the order Pods leave the scheduling queue, and what happens when the front-of-queue Pod cannot find a feasible node. Active cells are the current decision point. Found markers are placement outcomes the scheduler has committed to. Visited markers are candidates already ruled out by constraint checks.',
        'The preemption gap view traces the timeline between nomination and binding. Watch for the moment when a higher-priority Pod arrives during the gap and steals the nominated slot. That race is the most common source of confusion in production preemption debugging.',
        {type:'callout', text:'Preemption is a conditional scheduling proof, not a blank check to remove lower priority Pods.'},
        {
          type: 'note',
          text: 'At each frame, ask three questions: what changed, why the scheduler is allowed to make that move, and what could go wrong between now and the next frame. The gap between nomination and binding is where most real-world surprises live.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A Kubernetes cluster is a shared machine with finite CPU, memory, devices, ports, volumes, and topology slots. When every node is full, the scheduler faces a decision that first-come-first-served cannot answer: which pending work should wait, and which work should displace something already running?',
        {
          type: 'quote',
          text: 'Priority does not create capacity. It decides who gets capacity when capacity runs out.',
          attribution: 'The operating constraint behind every preemption design',
        },
        'Priority and preemption give that decision a control-plane contract. PriorityClass turns importance into an integer ordering. Preemption lets the scheduler evict lower-priority Pods when eviction is the only way to run a higher-priority pending Pod. Without this contract, scarcity decisions are made by accident of arrival time, and a DNS Pod waits behind a batch job that happened to start earlier.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The normal scheduler loop picks a pending Pod, filters nodes by the Pod requirements, scores feasible nodes, and binds the Pod to the best-scoring node. This works when capacity exists somewhere or when waiting is acceptable.',
        'A reasonable first policy is first-ready, first-served. A batch Pod that requested resources earlier keeps them, and a control-plane add-on waits until a node naturally frees space.',
        {
          type: 'table',
          headers: ['Policy', 'Advantage', 'Failure mode'],
          rows: [
            ['FIFO (arrival order)', 'Simple, no favoritism', 'DNS Pod waits behind 100 batch jobs'],
            ['Manual eviction by operator', 'Human judgment', 'Too slow during incidents, error-prone at scale'],
            ['Overprovision every node', 'No contention', 'Expensive; does not survive unexpected demand spikes'],
            ['Separate node pools per tier', 'Strong isolation', 'Underutilization; cannot share slack capacity'],
          ],
        },
        'Each of these works in a narrow operating range. None of them answers the general question: when a high-priority Pod arrives and no node has room, what should the scheduler do right now?',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Arrival order does not express operational importance. A DNS Pod, node agent, admission webhook, or emergency repair job may be more important than a long-running batch task that happened to arrive first. During a node failure, the cluster needs CoreDNS running before it needs ETL pipelines.',
        'Blind eviction is also wrong. The scheduler cannot just delete low-priority Pods until something happens to fit. The pending Pod still has node selectors, taints, affinity, volume, resource, and topology constraints. Removing three random low-priority Pods from node A does nothing if the high-priority Pod requires a GPU that only node B has.',
        {
          type: 'diagram',
          label: 'Why blind eviction fails: constraints survive priority',
          text: [
            '  Pod P (priority 1000): needs 4 CPU, 8Gi RAM, GPU, zone=us-east-1a',
            '',
            '  Node A (zone=us-east-1a, no GPU):',
            '    low-1 (prio 100): 2 CPU, 4Gi    <-- evicting does not help (no GPU)',
            '    low-2 (prio 100): 2 CPU, 4Gi    <-- evicting does not help (no GPU)',
            '',
            '  Node B (zone=us-west-2b, has GPU):',
            '    low-3 (prio 100): 4 CPU, 8Gi    <-- evicting helps resources, wrong zone',
            '',
            '  Node C (zone=us-east-1a, has GPU):',
            '    low-4 (prio 100): 2 CPU, 4Gi    <-- evicting alone is not enough',
            '    low-5 (prio 100): 2 CPU, 4Gi    <-- evicting BOTH makes Pod P fit',
            '',
            '  Only one node (C) has a valid victim set.',
          ].join('\n'),
        },
        'The scheduler must find a victim set that is both lower priority and sufficient to make a specific node feasible under all the pending Pod constraints. That requires re-running fit checks hypothetically, not guessing.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Preemption is not "kick out the weakest." It is a conditional feasibility query: if these specific lower-priority Pods were removed from this specific node, would the high-priority Pod pass all filter and fit checks on that node?',
        {
          type: 'quote',
          text: 'The scheduler only preempts when removal of a specific victim set on a specific node would make the pending Pod schedulable. Priority authorizes the eviction. Feasibility constrains it.',
          attribution: 'The invariant that separates preemption from arbitrary eviction',
        },
        'This invariant means preemption reuses the same placement logic as normal scheduling. It does not introduce a separate path. It asks the same filter plugins the same questions, just under a hypothetical world where certain Pods are gone.',
      ],
    },
    {
      heading: 'The state model',
      paragraphs: [
        'The scheduler maintains a priority-ordered pending queue. A PriorityClass resource maps a name to an integer value, and the admission controller resolves that value onto each Pod at creation time. Higher values move earlier in the queue, but they do not bypass feasibility checks.',
        {
          type: 'code',
          language: 'yaml',
          text: 'apiVersion: scheduling.k8s.io/v1\nkind: PriorityClass\nmetadata:\n  name: system-critical\nvalue: 1000000\nglobalDefault: false\npreemptionPolicy: PreemptLowerPriority   # or Never\ndescription: "For cluster-critical add-ons: DNS, networking, storage agents"',
        },
        'Preemption adds a candidate ledger. For each node that currently fails the high-priority Pod, the scheduler asks whether removing some lower-priority Pods from that node would make the Pod fit. The answer is a victim set: a concrete list of Pods to evict, not a vague signal that the node is busy.',
        {
          type: 'table',
          headers: ['Field', 'Set by', 'Meaning', 'Lifetime'],
          rows: [
            ['spec.priority', 'Admission (from PriorityClass)', 'Integer ordering for queue and preemption', 'Immutable after creation'],
            ['spec.preemptionPolicy', 'Admission (from PriorityClass)', 'PreemptLowerPriority or Never', 'Immutable after creation'],
            ['status.nominatedNodeName', 'Scheduler', 'Intended node while victims terminate', 'Cleared on bind or re-nomination'],
            ['spec.nodeName', 'Scheduler (bind)', 'Committed placement', 'Set once at bind time'],
          ],
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The scheduler first tries ordinary scheduling. If no node passes all filter plugins, and the Pod is allowed to preempt (preemptionPolicy is not Never), the preemption path activates.',
        {
          type: 'bullets',
          items: [
            'For each node, collect all Pods with priority strictly lower than the pending Pod.',
            'Simulate removing those Pods and re-run all filter plugins for the pending Pod on that node.',
            'If the node becomes feasible, record the victim set. Try to find a minimal victim set by adding victims one at a time in ascending priority order.',
            'Among all feasible candidate nodes, prefer the one whose victims are lowest priority. Break ties by preferring nodes whose victim set does not violate any PodDisruptionBudget. Break further ties by preferring the smallest victim count.',
            'Set nominatedNodeName on the pending Pod. Issue API delete calls for victim Pods with their graceful termination period.',
            'The pending Pod re-enters the scheduling queue. On the next cycle, the scheduler considers the nominated node with the assumption that victim resources will be available.',
          ],
        },
        {
          type: 'note',
          text: 'PDB protection during preemption is best effort. The scheduler prefers victim sets that do not violate PodDisruptionBudgets, but if the only way to make the high-priority Pod schedulable requires violating a PDB, the scheduler will violate it. PDBs are designed for voluntary disruption (rolling updates, drain). Preemption is an involuntary, last-resort action.',
        },
      ],
    },
    {
      heading: 'The nomination gap',
      paragraphs: [
        'nominatedNodeName is not a reservation. It is a scheduling hint that explains the scheduler intent to operators and to the next scheduling cycle. The gap between nomination and binding is where most production surprises occur.',
        {
          type: 'diagram',
          label: 'Timeline of a preemption with a nomination gap',
          text: [
            '  t0  Scheduler nominates node N for Pod P (priority 1000)',
            '       |-- Pod P status: nominatedNodeName = N',
            '       |-- Victim Pods on N receive SIGTERM',
            '  t1  Victims begin graceful shutdown (up to terminationGracePeriodSeconds)',
            '       |-- Scheduler continues processing other pending Pods',
            '  t2  Pod Q arrives (priority 2000, also fits node N)',
            '       |-- Scheduler clears Pod P nomination',
            '       |-- Scheduler nominates node N for Pod Q instead',
            '  t3  Victims finish terminating, resources free on N',
            '       |-- Pod Q binds to node N (spec.nodeName = N)',
            '       |-- Pod P returns to pending queue, no nomination',
            '  t4  Pod P re-evaluated; may find another node or preempt again',
          ].join('\n'),
        },
        'The gap matters because victims may take their full termination grace period, often 30 seconds by default. During that time, the scheduler keeps processing other Pods. A higher-priority Pod can arrive and claim the same node. The original Pod can have its nomination cleared and be sent back to the queue. nominatedNodeName is pending state, not a commitment.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The reliability property is conditional feasibility: the scheduler only preempts on a node when the high-priority Pod would pass all filter checks after the selected victims are removed. That ties preemption to the same placement rules as normal scheduling, so preemption cannot create a placement that normal scheduling would reject.',
        {
          type: 'table',
          headers: ['Property', 'Guarantee', 'Not guaranteed'],
          rows: [
            ['Feasibility', 'Pod fits the node after victims leave', 'Pod will actually bind (nomination can be stolen)'],
            ['Priority ordering', 'Only lower-priority Pods are victims', 'Minimal disruption (PDB is best effort)'],
            ['Termination', 'Victims get graceful shutdown period', 'Victims finish all work (grace period is bounded)'],
            ['Progress', 'High-priority Pods are tried first', 'Immediate scheduling (may wait for resources)'],
          ],
        },
        'The property is not unconditional availability. If every node lacks a required GPU, volume attachment, zone, or toleration, removing victims cannot help. If a lower-priority Pod is part of the preemptor inter-pod affinity target, removing it can invalidate the placement. Preemption removes resource contention; it cannot remove constraint mismatches.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Preemption buys priority by spending disruption. The direct costs are clear: terminated work, cold starts, cache loss, retry storms, longer tail latency for victims, and operator noise during incidents.',
        {
          type: 'table',
          headers: ['Cost dimension', 'Source', 'Mitigation'],
          rows: [
            ['Lost work', 'Victim Pods lose in-progress computation', 'Checkpoint, idempotent retry, external state'],
            ['Cold start', 'Replacement Pods pull images, warm caches', 'Pre-pulled images, readiness probes'],
            ['Retry storms', 'Evicted clients reconnect simultaneously', 'Exponential backoff, circuit breakers'],
            ['Scheduler CPU', 'Evaluating victim sets across many nodes', 'Limit candidate nodes, use scheduler profiles'],
            ['Cascade risk', 'Evicted Pod triggers its own preemption chain', 'Small PriorityClass taxonomy, quota limits'],
          ],
        },
        'The scheduler work also grows under pressure. Instead of a simple no-fit result, the preemption path may evaluate every node and every candidate victim set. The expensive case is broad scarcity with many nearly feasible nodes, each requiring different victim combinations.',
        'Governance is part of the system. In a multi-tenant cluster, a user who can create high-priority Pods can evict other tenants. ResourceQuota should restrict PriorityClass use per namespace, and admission controllers should enforce which teams can use which priority levels.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['Use case', 'PriorityClass', 'preemptionPolicy', 'Why'],
          rows: [
            ['CoreDNS, kube-proxy, CNI agents', 'system-node-critical (2B)', 'PreemptLowerPriority', 'Cluster is unusable without DNS and networking'],
            ['Admission webhooks, cert-manager', 'system-cluster-critical (2B-1000)', 'PreemptLowerPriority', 'API server depends on these for new Pod creation'],
            ['Monitoring (Prometheus, node-exporter)', 'High (e.g., 100000)', 'PreemptLowerPriority', 'Observability must survive the incident it observes'],
            ['Production API servers', 'Medium-high (e.g., 50000)', 'PreemptLowerPriority', 'Revenue-critical, but not cluster-critical'],
            ['Data science notebooks', 'Medium (e.g., 10000)', 'Never', 'Queue priority without evicting others; user expects wait'],
            ['Batch ETL, ML training jobs', 'Low (e.g., 1000)', 'PreemptLowerPriority', 'Replaceable work that checkpoints; designed as preemption victims'],
            ['Dev/test workloads', 'Lowest (e.g., 100)', 'Never', 'Best-effort capacity; should never disrupt production'],
          ],
        },
        {
          type: 'note',
          text: 'preemptionPolicy: Never is valuable when a job deserves queue priority but should not discard existing work. A data-science notebook can wait ahead of lower-priority pending Pods while still letting running Pods finish naturally. This separates "try me first" from "kill others for me."',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Priority inflation: if every team marks its workload critical, priority stops carrying information and the cluster turns scarcity into churn. Five priority levels is usually enough. Twenty is a governance failure.',
            'PDB surprises: owners assume a PodDisruptionBudget is a hard shield. It is not. Preemption can violate PDBs when no non-violating victim set exists. Workloads that truly cannot tolerate interruption need reserved capacity or separate node pools, not just a PDB.',
            'Nomination confusion: operators see nominatedNodeName and assume the Pod is about to run. It is pending state. The nomination can be cleared, stolen, or invalidated before binding. Alerting should distinguish nominated from bound.',
            'Cascading preemption: Pod A evicts Pod B. Pod B controller creates a replacement. Replacement Pod B cannot find a node and preempts Pod C. In a tight cluster with many priority levels, chains of preemption can ripple through the cluster.',
            'Affinity traps: if the high-priority Pod has inter-pod affinity to a low-priority Pod, evicting that low-priority Pod destroys the affinity target and makes the placement invalid. The scheduler handles this, but operators do not expect it.',
          ],
        },
        {
          type: 'code',
          language: 'text',
          text: '# Symptoms of priority inflation in kubectl output:\n$ kubectl get pods --all-namespaces --sort-by=.spec.priority | tail -20\n# If most Pods show priority > 100000, the taxonomy is broken.\n# Healthy clusters show a clear distribution:\n#   ~5% system-critical (2B range)\n#   ~10% high (100K range)\n#   ~30% medium (10K-50K range)\n#   ~55% low/default (0-1000 range)',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A 5-node cluster runs ten low-priority ETL Pods (priority 1000, each requesting 2 CPU and 4Gi) on every node. A node fails, and a high-priority CoreDNS replacement Pod (priority 2000000000, requesting 250m CPU and 256Mi) arrives.',
        {
          type: 'diagram',
          label: 'Preemption sequence for CoreDNS replacement',
          text: [
            '  Step 1: Normal scheduling',
            '    Scheduler tries all 4 remaining nodes.',
            '    Every node runs 10 ETL Pods at 2 CPU each = 20 CPU.',
            '    Node capacity is 20 CPU. Free CPU = 0 on every node.',
            '    Result: no node passes the ResourceFit filter. Normal scheduling fails.',
            '',
            '  Step 2: Preemption evaluation',
            '    For each node, find lower-priority Pods (all ETL Pods qualify).',
            '    CoreDNS needs only 250m CPU. Evicting 1 ETL Pod frees 2 CPU.',
            '    All 4 nodes are viable. Each needs only 1 victim.',
            '',
            '  Step 3: Victim selection',
            '    All candidate nodes have equal victim priority and count.',
            '    Scheduler checks PDB: ETL has minAvailable=8 per node.',
            '    Evicting 1 Pod leaves 9, which satisfies minAvailable=8.',
            '    No PDB violation on any node. Scheduler picks node with best score.',
            '',
            '  Step 4: Nomination and eviction',
            '    Scheduler sets CoreDNS nominatedNodeName = node-2.',
            '    Scheduler deletes 1 ETL Pod on node-2 with 30s grace period.',
            '',
            '  Step 5: Binding (after grace period)',
            '    ETL Pod terminates. 2 CPU freed on node-2.',
            '    Next scheduling cycle: CoreDNS passes all filters on node-2.',
            '    Scheduler binds CoreDNS to node-2. nominatedNodeName cleared.',
          ].join('\n'),
        },
        'The entire sequence takes at least one scheduling cycle plus the victim grace period. If the grace period is 30 seconds, CoreDNS may wait 30-60 seconds before running. For truly instant placement of system Pods, clusters should maintain reserved headroom via resource requests that leave slack.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Keep the PriorityClass taxonomy small. A useful cluster might use five levels:',
        {
          type: 'code',
          language: 'yaml',
          text: '# Recommended PriorityClass taxonomy\n# Level 1: system-node-critical    (2000000000)  -- built-in, for kube-system\n# Level 2: system-cluster-critical (2000001000)  -- built-in, for kube-system\n# Level 3: platform-critical       (100000)      -- custom: monitoring, ingress\n# Level 4: tenant-default          (0)           -- globalDefault: true\n# Level 5: batch-preemptible       (-1000)       -- preemptionPolicy: Never\n---\napiVersion: scheduling.k8s.io/v1\nkind: PriorityClass\nmetadata:\n  name: platform-critical\nvalue: 100000\nglobalDefault: false\npreemptionPolicy: PreemptLowerPriority\ndescription: "Monitoring, ingress, cert-manager, log collectors"\n---\napiVersion: scheduling.k8s.io/v1\nkind: PriorityClass\nmetadata:\n  name: batch-preemptible\nvalue: -1000\nglobalDefault: false\npreemptionPolicy: Never\ndescription: "Best-effort batch; queues ahead of nothing, evicts nothing"',
        },
        'Restrict high-priority classes with ResourceQuota per namespace. The question is not whether a Pod author can write a high priority value. The question is whether that author is allowed to impose termination risk on other workloads during scarcity.',
        {
          type: 'code',
          language: 'yaml',
          text: '# Limit how many high-priority Pods a namespace can create\napiVersion: v1\nkind: ResourceQuota\nmetadata:\n  name: priority-limit\n  namespace: team-data\nspec:\n  hard:\n    pods: "50"\n  scopeSelector:\n    matchExpressions:\n      - scopeName: PriorityClass\n        operator: In\n        values: ["platform-critical"]',
        },
        'Design low-priority victims to be safe victims. Batch work should checkpoint to external storage, retry idempotently, and avoid storing unique progress only in Pod memory. Preemption is much less dangerous when the lower-priority workload was already designed as disposable capacity.',
      ],
    },
    {
      heading: 'Debugging preemption',
      paragraphs: [
        'When a Pod is pending, separate three states. Each leads to different fixes:',
        {
          type: 'table',
          headers: ['Pod state', 'Key field', 'Diagnosis', 'Fix'],
          rows: [
            ['No feasible node', 'nominatedNodeName empty, nodeName empty', 'No node passes filters even after hypothetical eviction', 'Check taints, affinity, resource requests, GPU/zone requirements'],
            ['Nominated, waiting', 'nominatedNodeName set, nodeName empty', 'Victims still terminating or nomination was just set', 'Wait for grace period; check if victims are stuck in Terminating'],
            ['Bound, not running', 'nodeName set, status not Running', 'Kubelet is pulling image, running init containers, or failing health checks', 'Check kubelet events, image pull status, readiness probes'],
          ],
        },
        {
          type: 'code',
          language: 'text',
          text: '# Quick preemption debugging sequence\n$ kubectl get pod <name> -o jsonpath=\'{.spec.priority} {.spec.nodeName} {.status.nominatedNodeName}\\n\'\n# Shows: priority, bound node (if any), nominated node (if any)\n\n$ kubectl get events --field-selector involvedObject.name=<name> --sort-by=.lastTimestamp\n# Look for: Preempted, Scheduled, FailedScheduling, Nominated\n\n$ kubectl get pods -n <ns> --field-selector spec.nodeName=<nominated-node> \\\n  -o custom-columns=NAME:.metadata.name,PRIORITY:.spec.priority,STATUS:.status.phase\n# Shows what is running on the nominated node and at what priority',
        },
        'If preemption keeps repeating, the answer is usually not another priority tweak. Look for priority inflation, resource requests that are too large for any single node, insufficient reserved capacity, slow graceful termination (high terminationGracePeriodSeconds), broad anti-affinity rules, or a workload class that belongs in a separate node pool entirely.',
      ],
    },
    {
      heading: 'Mental model',
      paragraphs: [
        {
          type: 'table',
          headers: ['Concept', 'What it is', 'What it is not'],
          rows: [
            ['Priority', 'An ordering signal for the scheduling queue', 'A guarantee of immediate placement'],
            ['Preemption', 'A conditional repair: evict victims to make one node feasible', 'Arbitrary eviction of anything lower priority'],
            ['Nomination', 'Pending state: "scheduler intends to place here"', 'A reservation or lock on the node'],
            ['Binding', 'Committed placement: spec.nodeName is set', 'The Pod is running (kubelet still needs to start it)'],
          ],
        },
        'Keeping these four ideas separate prevents most wrong explanations of preemption behavior. A good preemption design does not try to make every important Pod immediately runnable. It decides which work may be sacrificed, under which constraints, and how operators can see the decision. That makes the cluster more predictable under pressure, not magically unlimited.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Primary source: Kubernetes official documentation on Pod Priority and Preemption (https://kubernetes.io/docs/concepts/scheduling-eviction/pod-priority-preemption/).',
            'Implementation source: kube-scheduler preemption plugin in pkg/scheduler/framework/plugins/defaultpreemption/ in the kubernetes/kubernetes repository.',
            'KEP-3836 (scheduler preemption refactoring) for the design rationale behind the current victim selection algorithm.',
            'Prerequisite: study the Kubernetes Scheduler Framework to understand how filter, score, and preempt extension points compose.',
            'Extension: study PodDisruptionBudgets to understand why voluntary disruption limits and preemption limits are separate guarantees.',
            'Contrast: compare priority-based preemption with resource quota, taints/tolerations, node affinity, topology spread constraints, and separate node pools. Those mechanisms prevent scarcity or isolate risk. Priority and preemption decide what happens after scarcity has already arrived.',
          ],
        },
      ],
    },
  ],
};
