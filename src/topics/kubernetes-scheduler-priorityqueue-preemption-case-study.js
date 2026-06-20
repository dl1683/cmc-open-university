// Kubernetes scheduler internals: activeQ/backoffQ/unschedulable pool,
// scheduling framework phases, queue hints, and preemption nomination.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'kubernetes-scheduler-priorityqueue-preemption-case-study',
  title: 'Kubernetes Scheduler Priority Queue & Preemption Case Study',
  category: 'Systems',
  summary: 'How kube-scheduler turns pending Pods into node bindings using activeQ, backoffQ, unschedulable pools, plugin phases, priority ordering, and preemption nomination.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['queue lifecycle', 'preemption path'], defaultValue: 'queue lifecycle' },
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

function schedulerQueueGraph(title) {
  return graphState({
    nodes: [
      { id: 'api', label: 'API', x: 0.7, y: 4.2, note: 'pending' },
      { id: 'inf', label: 'inform', x: 2.1, y: 2.8, note: 'events' },
      { id: 'q', label: 'schedQ', x: 2.4, y: 4.4, note: 'pods' },
      { id: 'active', label: 'activeQ', x: 4.2, y: 3.2, note: 'ready' },
      { id: 'back', label: 'backoffQ', x: 4.2, y: 4.9, note: 'timer' },
      { id: 'uns', label: 'unsched', x: 4.2, y: 6.5, note: 'event' },
      { id: 'fw', label: 'fwk', x: 6.2, y: 3.7, note: 'plugins' },
      { id: 'nom', label: 'nom', x: 6.4, y: 5.6, note: 'node' },
      { id: 'bind', label: 'bind', x: 8.1, y: 3.7, note: 'patch' },
      { id: 'node', label: 'node', x: 9.5, y: 3.7, note: 'chosen' },
    ],
    edges: [
      { id: 'e-api-inf', from: 'api', to: 'inf' },
      { id: 'e-inf-q', from: 'inf', to: 'q' },
      { id: 'e-q-active', from: 'q', to: 'active' },
      { id: 'e-active-fw', from: 'active', to: 'fw' },
      { id: 'e-fw-bind', from: 'fw', to: 'bind' },
      { id: 'e-bind-node', from: 'bind', to: 'node' },
      { id: 'e-fw-back', from: 'fw', to: 'back' },
      { id: 'e-fw-uns', from: 'fw', to: 'uns' },
      { id: 'e-back-active', from: 'back', to: 'active' },
      { id: 'e-uns-active', from: 'uns', to: 'active' },
      { id: 'e-fw-nom', from: 'fw', to: 'nom' },
    ],
  }, { title });
}

function* queueLifecycle() {
  yield {
    state: schedulerQueueGraph('Scheduler queue is more than one heap'),
    highlight: { active: ['active', 'fw', 'bind'], compare: ['back', 'uns'], found: ['inf', 'nom'] },
    explanation: 'kube-scheduler watches pending Pods, orders ready work in activeQ, delays failed work in backoffQ, parks impossible work in the unschedulable pool, then binds a chosen node through the API server.',
    invariant: 'The queue protects scheduler time: retry when a Pod might fit, not on every loop.',
  };

  yield {
    state: labelMatrix(
      'Scheduling queue',
      [
        { id: 'active', label: 'act' },
        { id: 'back', label: 'bo' },
        { id: 'uns', label: 'uns' },
        { id: 'fly', label: 'fly' },
        { id: 'nom', label: 'nom' },
      ],
      [
        { id: 'data', label: 'data' },
        { id: 'role', label: 'role' },
      ],
      [
        ['heap', 'ready'],
        ['heap', 'timer'],
        ['map', 'event'],
        ['set', 'lock'],
        ['map', 'hold'],
      ],
    ),
    highlight: { active: ['active:data', 'back:data'], found: ['uns:role', 'nom:role'], compare: ['fly:role'] },
    explanation: 'activeQ is priority-ordered work, backoffQ is delayed retry work, unschedulablePods remembers failed Pods until a relevant cluster event arrives, and nominated state tracks preemption claims.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'pop', label: 'pop', x: 0.8, y: 4.0, note: 'pod' },
        { id: 'pre', label: 'pre', x: 2.4, y: 4.0, note: 'facts' },
        { id: 'filter', label: 'filter', x: 4.0, y: 4.0, note: 'fit?' },
        { id: 'score', label: 'score', x: 5.7, y: 4.0, note: 'rank' },
        { id: 'res', label: 'reserve', x: 7.4, y: 4.0, note: 'hold' },
        { id: 'bind', label: 'bind', x: 9.1, y: 4.0, note: 'async' },
      ],
      edges: [
        { id: 'e-pop-pre', from: 'pop', to: 'pre' },
        { id: 'e-pre-filter', from: 'pre', to: 'filter' },
        { id: 'e-filter-score', from: 'filter', to: 'score' },
        { id: 'e-score-res', from: 'score', to: 'res' },
        { id: 'e-res-bind', from: 'res', to: 'bind' },
      ],
    }, { title: 'One scheduling context' }),
    highlight: { active: ['filter', 'score'], found: ['bind'], compare: ['pop'] },
    explanation: 'The scheduling cycle chooses a node for one Pod. The binding cycle writes the decision back to the API server. Kubernetes runs scheduling cycles serially, while binding cycles may continue concurrently.',
  };

  yield {
    state: labelMatrix(
      'Plugin gates',
      [
        { id: 'enq', label: 'enq' },
        { id: 'pref', label: 'pre' },
        { id: 'fit', label: 'filter' },
        { id: 'rank', label: 'score' },
        { id: 'hold', label: 'reserve' },
        { id: 'bind', label: 'bind' },
      ],
      [
        { id: 'asks', label: 'asks' },
        { id: 'out', label: 'out' },
      ],
      [
        ['enter?', 'queue'],
        ['facts', 'state'],
        ['nodes', 'fit'],
        ['rank', 'best'],
        ['claim', 'undo'],
        ['patch', 'node'],
      ],
    ),
    highlight: { active: ['fit:out', 'rank:out'], found: ['bind:out'], compare: ['hold:out'] },
    explanation: 'The scheduling framework is a plugin pipeline. Plugins can reject early, filter feasible nodes, score candidates, reserve resources, permit waiting, bind, or unwind state when a later phase fails.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'events', min: 0, max: 10 }, y: { label: 'tries', min: 0, max: 100 } },
      series: [
        { id: 'broad', label: 'broad', points: [{ x: 0, y: 5 }, { x: 2, y: 28 }, { x: 4, y: 48 }, { x: 7, y: 80 }, { x: 10, y: 96 }] },
        { id: 'hint', label: 'hint', points: [{ x: 0, y: 5 }, { x: 2, y: 10 }, { x: 4, y: 17 }, { x: 7, y: 28 }, { x: 10, y: 36 }] },
      ],
      markers: [{ id: 'qhint', x: 5, y: 22, label: 'hint' }],
    }),
    highlight: { active: ['hint', 'qhint'], compare: ['broad'] },
    explanation: 'QueueingHint sharpens retry decisions. Instead of waking every Pod rejected by a broad event type, the plugin can inspect the actual event and wake only Pods that might now become schedulable.',
  };

  yield {
    state: labelMatrix(
      'Wake signals',
      [
        { id: 'node', label: 'node' },
        { id: 'free', label: 'pod' },
        { id: 'label', label: 'lab' },
        { id: 'pv', label: 'pv' },
        { id: 'quota', label: 'quot' },
      ],
      [
        { id: 'could', label: 'could' },
        { id: 'wake', label: 'wake' },
      ],
      [
        ['cap', 'yes'],
        ['cpu', 'yes'],
        ['aff', 'maybe'],
        ['vol', 'maybe'],
        ['limit', 'skip'],
      ],
    ),
    highlight: { active: ['node:wake', 'free:wake'], found: ['label:wake', 'pv:wake'], compare: ['quota:wake'] },
    explanation: 'A pending Pod should move back to activeQ or backoffQ only when the cluster change could solve its last failure. That is the scheduler version of cache invalidation: wake the right work, not all work.',
  };
}

function* preemptionPath() {
  yield {
    state: graphState({
      nodes: [
        { id: 'p', label: 'P', x: 0.8, y: 4.0, note: 'high' },
        { id: 'fail', label: 'no fit', x: 2.4, y: 4.0, note: 'filter' },
        { id: 'post', label: 'post', x: 4.0, y: 4.0, note: 'preempt' },
        { id: 'n1', label: 'nodeA', x: 5.8, y: 2.8, note: 'victims' },
        { id: 'v', label: 'low', x: 7.3, y: 2.8, note: 'evict' },
        { id: 'nom', label: 'nominate', x: 5.8, y: 5.2, note: 'status' },
        { id: 'bind', label: 'bind', x: 8.8, y: 5.2, note: 'later' },
      ],
      edges: [
        { id: 'e-p-fail', from: 'p', to: 'fail' },
        { id: 'e-fail-post', from: 'fail', to: 'post' },
        { id: 'e-post-n1', from: 'post', to: 'n1' },
        { id: 'e-n1-v', from: 'n1', to: 'v' },
        { id: 'e-post-nom', from: 'post', to: 'nom' },
        { id: 'e-nom-bind', from: 'nom', to: 'bind' },
      ],
    }, { title: 'Preemption is a second scheduling search' }),
    highlight: { active: ['p', 'post', 'nom'], compare: ['v'], found: ['bind'] },
    explanation: 'If a high-priority Pod cannot fit anywhere, the scheduler can search for a node where evicting lower-priority Pods would make room. The result is nomination first, binding later.',
    invariant: 'Preemption makes room; it does not guarantee immediate binding.',
  };

  yield {
    state: labelMatrix(
      'Node choice',
      [
        { id: 'n1', label: 'nA' },
        { id: 'n2', label: 'nB' },
        { id: 'n3', label: 'nC' },
        { id: 'n4', label: 'nD' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'vict', label: 'vict' },
        { id: 'pdb', label: 'PDB' },
        { id: 'pick', label: 'pick' },
      ],
      [
        ['yes', '2', 'ok', 'best'],
        ['yes', '4', 'break', 'risk'],
        ['no', 'all', 'n/a', 'skip'],
        ['yes', '1', 'bad', 'maybe'],
      ],
    ),
    highlight: { active: ['n1:pick'], found: ['n1:pdb'], compare: ['n2:pdb', 'n3:pick'] },
    explanation: 'The scheduler does not simply evict the most Pods. It checks whether removing lower-priority victims could make the pending Pod fit, then ranks candidate nodes while trying to avoid PDB violations when possible.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'nom', label: 'nom', x: 0.8, y: 4.0, note: 'nodeA' },
        { id: 'evict', label: 'evict', x: 2.4, y: 4.0, note: 'low' },
        { id: 'grace', label: 'grace', x: 4.0, y: 4.0, note: 'wait' },
        { id: 'active', label: 'activeQ', x: 5.7, y: 4.0, note: 'retry' },
        { id: 'steal', label: 'higher', x: 5.7, y: 2.3, note: 'arrives' },
        { id: 'bind', label: 'bind', x: 7.5, y: 4.0, note: 'node' },
        { id: 'clear', label: 'clear', x: 7.5, y: 2.3, note: 'nom' },
      ],
      edges: [
        { id: 'e-nom-evict', from: 'nom', to: 'evict' },
        { id: 'e-evict-grace', from: 'evict', to: 'grace' },
        { id: 'e-grace-active', from: 'grace', to: 'active' },
        { id: 'e-active-bind', from: 'active', to: 'bind' },
        { id: 'e-steal-clear', from: 'steal', to: 'clear' },
        { id: 'e-clear-active', from: 'clear', to: 'active' },
      ],
    }, { title: 'nominatedNodeName is not nodeName' }),
    highlight: { active: ['nom', 'grace', 'active'], compare: ['steal', 'clear'], found: ['bind'] },
    explanation: 'nominatedNodeName records the intended node while victims terminate. A later, higher-priority Pod can take that opportunity, or another node can become available first, so nomination and final binding can diverge.',
  };

  yield {
    state: labelMatrix(
      'Preemption traps',
      [
        { id: 'never', label: 'Never' },
        { id: 'pdb', label: 'PDB' },
        { id: 'aff', label: 'aff' },
        { id: 'grace', label: '30s' },
        { id: 'quota', label: 'quota' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['no', 'wait'],
        ['try', 'break'],
        ['same', 'stuck'],
        ['term', 'gap'],
        ['cap', 'abuse'],
      ],
    ),
    highlight: { active: ['pdb:rule', 'aff:risk', 'grace:risk'], compare: ['quota:risk'] },
    explanation: 'The hard cases are policy cases: non-preempting high-priority Pods, PDB best-effort behavior, affinity to victims, termination grace delays, and namespaces allowed to create too many high-priority Pods.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'high pri', min: 0, max: 100 }, y: { label: 'churn', min: 0, max: 100 } },
      series: [
        { id: 'disc', label: 'disc', points: [{ x: 0, y: 5 }, { x: 20, y: 10 }, { x: 40, y: 18 }, { x: 70, y: 35 }, { x: 100, y: 55 }] },
        { id: 'sprawl', label: 'sprawl', points: [{ x: 0, y: 5 }, { x: 20, y: 25 }, { x: 40, y: 50 }, { x: 70, y: 80 }, { x: 100, y: 96 }] },
      ],
      markers: [{ id: 'quota', x: 35, y: 20, label: 'quota' }],
    }),
    highlight: { active: ['disc', 'quota'], compare: ['sprawl'] },
    explanation: 'Priority works only when it is scarce. A few controlled priority classes protect critical work. Priority sprawl turns preemption into churn, because everyone claims to be important.',
  };

  yield {
    state: labelMatrix(
      'Cluster policy',
      [
        { id: 'cp', label: 'ctrl' },
        { id: 'svc', label: 'svc' },
        { id: 'batch', label: 'batch' },
        { id: 'daemon', label: 'daemon' },
      ],
      [
        { id: 'tool', label: 'tool' },
        { id: 'proof', label: 'proof' },
      ],
      [
        ['global', 'quota'],
        ['PDB', 'events'],
        ['low', 'backoff'],
        ['taint', 'fit'],
      ],
    ),
    highlight: { active: ['cp:tool', 'svc:tool'], found: ['batch:proof'], compare: ['daemon:proof'] },
    explanation: 'A production scheduling policy combines priority classes, quotas on high-priority usage, PDBs for disruption, tolerations for system daemons, and events/status so Pending Pods explain why they are stuck.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'queue lifecycle') yield* queueLifecycle();
  else if (view === 'preemption path') yield* preemptionPath();
  else throw new InputError('Pick a Kubernetes scheduler view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'The Kubernetes scheduler is the control-plane component that turns a pending Pod into a Pod bound to a node. That sounds like a priority queue problem, but the real constraint is cluster state. The scheduler must consider CPU, memory, devices, volumes, taints, tolerations, affinity, topology spread, disruption policy, and plugin state while thousands of cluster events are arriving.',
        'A plain queue would waste the control plane. Many pending Pods cannot fit right now, and retrying them on every loop burns scheduler time that could place work that is actually ready. kube-scheduler therefore separates ready work, delayed retry work, unschedulable work, in-flight work, and nominated nodes. The data structure is a scheduling memory, not just a heap.',
        {type:'callout', text:'The scheduler queue is a memory of why placement failed, so retries happen only when time or cluster events make a new answer plausible.'},
      ],
    },
    {
      heading: 'The naive queue and wall',
      paragraphs: [
        'The obvious design is one priority heap ordered by Pod priority. New Pods enter the heap, the scheduler pops the highest-priority Pod, scans nodes, binds if it can, and pushes it back if it cannot. This works in a tiny cluster because the cost of a bad retry is small and the state changes are easy to reason about.',
        'The wall appears when the heap fills with Pods that cannot fit for specific reasons. A Pod waiting for a matching label should not wake because an unrelated node changed. A Pod waiting for CPU should not spin every millisecond. A Pod blocked by a scheduling gate should not compete with work that can be placed. The scheduler needs to remember why a Pod failed and which later event could make that failure worth revisiting.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is to split pending work by readiness, not just by priority. activeQ holds Pods ready for a scheduling attempt. backoffQ holds Pods that failed recently and should wait for a retry timer. unschedulablePods holds Pods that were tried and cannot currently fit, waiting for a cluster event that could change the answer. Nominated-node state remembers capacity that preemption may create later.',
        'This is cache invalidation for scheduling. The cached result says a Pod could not fit under the cluster state observed during the last attempt. The scheduler should invalidate that result only when a relevant event occurs. QueueingHint makes that rule sharper by letting the plugin that rejected a Pod inspect a later event and decide whether that event might help.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A Pod usually arrives through API-server state watched by scheduler informers. If it is eligible for scheduling, it enters activeQ. The scheduler pops one Pod, creates a scheduling context, and runs framework phases. PreFilter can compute facts used later. Filter removes nodes that cannot host the Pod. Score ranks feasible nodes. Reserve, Permit, PreBind, Bind, and PostBind handle state claims and the API write.',
        'The scheduling cycle chooses a node or concludes that none is feasible. The binding cycle writes the selected node back to the API server. Kubernetes documents this as two phases, with scheduling cycles processed serially and binding cycles able to continue concurrently. If a later phase fails, framework plugins can unwind reserved state so the scheduler does not leak a local claim.',
      ],
    },
    {
      heading: 'Preemption mechanism',
      paragraphs: [
        'Preemption starts only after the scheduler fails to find a feasible node for a pending Pod. The second search asks a different question: is there a node where removing lower-priority Pods would make this higher-priority Pod fit? Candidate nodes are ranked while the scheduler tries to avoid PodDisruptionBudget violations when possible.',
        'If a node is chosen, the scheduler evicts victims and records nominatedNodeName on the pending Pod. That field is not spec.nodeName. It is a claim that the scheduler expects capacity to open on that node after victims terminate. During the grace period, the Pod remains pending and will be retried. A different node may become available first, or a still higher-priority Pod may take the nominated node.',
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        'The queue-lifecycle view shows why the scheduler queue has side pools. activeQ is where real scheduling attempts happen. backoffQ prevents immediate retry loops. unschedulablePods waits for a useful state change. The same Pod can move among these pools as failures, timers, and cluster events change what is worth trying.',
        'The preemption view shows that nomination and binding are separate commitments. Preemption can prove that evicting lower-priority Pods might make a node feasible, but it cannot skip graceful termination, policy checks, or later competition. The visual point is that preemption creates a future scheduling opportunity, not an instant binding.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The queue discipline works because each pool preserves a different invariant. activeQ contains Pods that are eligible for immediate work. backoffQ contains Pods whose retry clock has not expired. unschedulablePods contains Pods whose last known failure still needs a relevant event. The scheduler spends expensive filter and score cycles only when those invariants say a try is defensible.',
        'Preemption works because priority creates an ordering rule. A higher-priority Pod may displace lower-priority Pods only if the removal would make the pending Pod feasible on a node. The scheduler still has to respect feasibility checks after victims leave. That second check is why nominatedNodeName is information about intended capacity, not proof that the Pod is already placed.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The small data-structure cost is heap and map maintenance: activeQ and backoffQ behave like priority or timer queues, unschedulablePods is map-like, and nomination state needs lookup by Pod and node. The larger runtime cost is filter and score work across nodes and plugins. In a large cluster, one unnecessary wake can multiply into many plugin calls.',
        'Preemption is more expensive than ordinary scheduling because it performs a second feasibility search over candidate nodes and possible victims. It also has operational cost: evictions create disruption, graceful termination creates delay, and status updates can be confusing if operators expect nominatedNodeName to mean the same thing as nodeName.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'This design wins in busy clusters where many pending Pods fail for different reasons. It lets critical Pods move ahead, keeps impossible work out of the hot path, and makes scheduler throughput depend on relevant events instead of blind retries. QueueingHint is especially useful when broad event categories would otherwise wake many Pods that still cannot fit.',
        'The same pattern appears in other control planes. Informers keep local state fresh, queues separate ready and delayed work, rate limiters prevent storms, admission controls decide who may request special treatment, and reconciliation loops repair drift after asynchronous writes. The scheduler is the placement version of that general control-plane pattern.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Preemption is not magic capacity. It only works when lower-priority victims can be removed and the pending Pod would then fit. It does not help if the limiting resource is absent everywhere, if affinity rules depend on the victims, or if cross-node preemption would be required. PDB handling is best effort rather than an absolute shield.',
        'Priority also fails as a policy if everyone can claim the top class. Priority sprawl turns scheduling into churn because many tenants can evict one another without reflecting real service importance. Admission policy, ResourceQuota, a small set of priority classes, and good Pending-event observability are part of the algorithm in production, even though they live outside the queue data structure.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Kubernetes scheduler internal queue package docs at https://pkg.go.dev/k8s.io/kubernetes/pkg/scheduler/internal/queue, Kubernetes scheduling framework documentation at https://kubernetes.io/docs/concepts/scheduling-eviction/scheduling-framework/, Kubernetes Pod Priority and Preemption documentation at https://kubernetes.io/docs/concepts/scheduling-eviction/pod-priority-preemption/, Kubernetes QueueingHint blog at https://kubernetes.io/blog/2024/12/12/scheduler-queueinghint/, and Kubernetes scheduling queue source comments at https://github.com/kubernetes/kubernetes/blob/master/pkg/scheduler/backend/queue/scheduling_queue.go.',
        'Study Kubernetes Informer DeltaFIFO and Workqueue for watch-driven queues, Kubernetes Reconciliation for eventual repair, Kubernetes Admission Policy Gate for priority governance, Binary Heap and Queue for the local structures, Rate Limiter and Backpressure for retry discipline, Borg Cluster Scheduler for historical context, and Mesos Resource Manager for a contrasting resource-allocation model.',
      ],
    },
  ],
};
