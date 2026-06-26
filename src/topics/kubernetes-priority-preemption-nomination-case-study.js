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

