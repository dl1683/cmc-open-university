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
        "Read the animation as the execution trace for Kubernetes Priority and Preemption Nomination Case Study. How PriorityClass, queue ordering, preemptionPolicy, victim selection, PDB best effort, graceful termination, and nominatedNodeName coordinate scarce capacity..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A Kubernetes cluster is a shared machine with finite CPU, memory, devices, ports, volumes, and topology slots. When every node is full, the scheduler has to decide which pending work is allowed to wait and which work is allowed to displace something already running.',
        'Priority and preemption give that decision a control-plane contract. PriorityClass turns importance into an integer ordering. Preemption lets the scheduler evict lower-priority Pods when that is the only way to run a higher-priority pending Pod.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The normal scheduler loop picks a pending Pod, filters nodes by the Pod requirements, scores feasible nodes, and binds the Pod to one node. This works when capacity exists somewhere or when waiting is acceptable.',
        'A reasonable first policy is first-ready, first-served. A batch Pod that asked for resources earlier keeps them, and a control-plane add-on waits until a node naturally frees space. That policy is simple, fair by arrival time, and dangerous during scarcity.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Arrival order does not express operational importance. A DNS Pod, node agent, admission webhook, or emergency repair job may be more important than a long-running batch task that happened to arrive first.',
        'Blind eviction is also wrong. The scheduler cannot just delete low-priority Pods until something happens to fit. The pending Pod still has node selectors, taints, affinity, volume, resource, and topology constraints. The victim set has to make a specific node feasible.',
      ],
    },
    {
      heading: 'The state model',
      paragraphs: [
        'The scheduler keeps a priority-ordered pending queue. A PriorityClass maps a name to an integer value, and the admission path resolves that value onto each Pod. Higher values move earlier in the queue, but they do not bypass feasibility checks.',
        'Preemption adds a candidate ledger. For each node that currently fails, the scheduler asks whether removing lower-priority Pods from that node would make the pending Pod fit. The answer is a victim set, not a vague signal that the node is busy.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The scheduler first tries ordinary scheduling. If no node fits, and the Pod is allowed to preempt, the scheduler evaluates nodes again under a hypothetical change: remove some lower-priority Pods and rerun the fit checks.',
        'A valid preemption choice must leave the high-priority Pod schedulable on that node. The scheduler prefers victim sets that are lower priority, smaller when possible, and less disruptive to PodDisruptionBudgets. PDB protection is best effort, so it influences victim choice but does not make a Pod immune to preemption.',
        'After choosing a node, the scheduler sets the pending Pod status field `nominatedNodeName`. That records the intended node while victims receive graceful termination time. Binding happens later, after enough resources actually appear.',
      ],
    },
    {
      heading: 'The nomination gap',
      paragraphs: [
        '`nominatedNodeName` is not a reservation. It is a scheduling hint and user-visible explanation for a decision that has not reached binding yet.',
        'The gap matters because victims may take their full termination grace period. During that time, the scheduler keeps processing other Pods. Another node may become feasible, or an even higher-priority Pod may arrive and take the nominated slot. The original Pod can have its nomination cleared and be reconsidered.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The reliability property is conditional feasibility. The scheduler only preempts on a node when the high-priority Pod would fit after the selected lower-priority Pods are gone. That keeps preemption tied to the same placement rules as normal scheduling.',
        'The property is not availability by itself. If every node lacks a required GPU, volume attachment, zone, or toleration, removing victims cannot make the Pod schedulable. If a lower-priority Pod is part of the preemptor affinity target, removing it can make the placement invalid.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Preemption buys priority by spending disruption. The costs are terminated work, cold starts, cache loss, retry storms, longer tail latency for victims, and operator noise during incidents.',
        'The scheduler work also grows under pressure. Instead of a simple no-fit result, it may evaluate candidate nodes and victim sets. The exact cost depends on scheduler plugins, node count, Pod count, and constraints, but the expensive case is broad scarcity with many nearly feasible nodes.',
        'Governance is part of the data structure. In an untrusted cluster, a user who can create the highest-priority Pods can evict other tenants. ResourceQuota should restrict PriorityClass use, and events should make preemption visible enough to debug.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'System-critical classes are useful for DNS, networking, storage agents, metrics collectors, and control-plane add-ons that keep the cluster usable. During node pressure, those Pods often matter more than replaceable batch work.',
        '`preemptionPolicy: Never` is useful when a job deserves queue priority but should not discard existing work. A data-science job can wait ahead of lower-priority pending Pods while still letting running Pods finish naturally.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The common failure is priority inflation. If every team marks its workload critical, priority stops carrying information and the cluster turns scarcity into churn.',
        'PDB surprises are another failure. Owners may assume a PodDisruptionBudget is a hard shield, but preemption can violate it when no non-violating victim set works. Workloads that cannot tolerate interruption need quotas, reservations, separate node pools, or application-level recovery.',
        'A third failure is overtrusting nomination. `nominatedNodeName` explains an intended placement, not a completed one. Alerting and operators should treat it as pending state until `nodeName` is set.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A cluster runs ten low-priority ETL Pods on every node. A high-priority CoreDNS replacement Pod arrives after a node failure. Normal filtering finds no node with enough free CPU and memory.',
        'The scheduler tests each node as if some ETL Pods were removed. On node N, evicting two ETL Pods would make the CoreDNS Pod fit without breaking its node selector or tolerations. The scheduler nominates node N, evicts the victims, waits for termination, then binds CoreDNS if the slot still exists.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Keep the PriorityClass taxonomy small. A useful cluster might distinguish system-critical add-ons, platform-critical services, important tenant services, normal services, and interruptible batch work. Do not create a new class for every team. A class should represent a different operational promise.',
        'Restrict high-priority classes with ResourceQuota and admission policy. The important question is not whether a Pod author can write a high priority value. The question is whether that author is allowed to impose termination risk on other workloads during scarcity.',
        'Design low-priority victims to be safe victims. Batch work should checkpoint, retry idempotently, and avoid storing unique progress only in Pod memory. Preemption is much less dangerous when the lower-priority workload was already designed as disposable capacity.',
      ],
    },
    {
      heading: 'Debugging preemption',
      paragraphs: [
        'When a Pod is pending, separate three states. It may have no feasible node at all. It may have a feasible node only after lower-priority victims terminate. Or it may already be bound and waiting for kubelet startup. These states lead to different fixes.',
        'Events and status fields are the first evidence. nominatedNodeName explains an intended target, while nodeName is the actual binding. Victim Pods should show deletion and termination events. PDB events can show when the scheduler chose disruption despite a budget preference.',
        'If preemption keeps repeating, the answer is usually not another priority tweak. Look for priority inflation, resource requests that are too large, insufficient reserved capacity, slow graceful termination, broad anti-affinity, or a workload class that belongs in a separate node pool.',
      ],
    },
    {
      heading: 'Mental model',
      paragraphs: [
        'Priority is an ordering signal. Preemption is a conditional repair action. Nomination is pending state. Binding is the committed placement. Keeping those four ideas separate prevents many wrong explanations.',
        'A good preemption design does not try to make every important Pod immediately runnable. It decides which work may be sacrificed, under which constraints, and how operators can see the decision. That makes the cluster more predictable under pressure, not magically unlimited.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study the Kubernetes scheduler framework next if you want the plugin points behind filtering, scoring, and preemption. Study PodDisruptionBudgets to understand why voluntary disruption limits are not hard preemption barriers.',
        'Then compare ResourceQuota, taints and tolerations, node affinity, topology spread constraints, and separate node pools. Those mechanisms prevent scarcity or isolate risk; priority and preemption decide what happens after scarcity has already arrived.',
        'Primary sources: https://kubernetes.io/docs/concepts/scheduling-eviction/pod-priority-preemption/ and https://kubernetes.io/docs/concepts/scheduling-eviction/.',
      ],
    },
      {
      heading: 'The core insight',
      paragraphs: [
        "The core insight is the smallest idea that changes what can be proven.",
        "Phrase it as an invariant, boundary, or contract that stays true across all transitions.",
        "Everything else in the topic should serve this one sentence.",
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
          'If your predicted final state matches the animation for kubernetes-priority-preemption-nomination-case-study, continue to the next topic in the same track.'
  ],
      },
],
};
