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

