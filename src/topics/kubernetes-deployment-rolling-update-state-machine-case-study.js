// Kubernetes Deployment: rolling update is a ReplicaSet state machine governed
// by maxSurge, maxUnavailable, readiness, progress deadline, and rollback.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'kubernetes-deployment-rolling-update-state-machine-case-study',
  title: 'Kubernetes Deployment Rolling Update State Machine Case Study',
  category: 'Systems',
  summary: 'How Deployments coordinate old and new ReplicaSets with maxSurge, maxUnavailable, readiness, minReadySeconds, progressDeadlineSeconds, conditions, pause, resume, and rollback.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['rolling update', 'progress gate'], defaultValue: 'rolling update' },
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

function deployGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'deploy', label: 'Deploy', x: 0.7, y: 4.2, note: notes.deploy ?? 'spec' },
      { id: 'oldrs', label: 'old RS', x: 2.5, y: 2.8, note: notes.oldrs ?? 'v1' },
      { id: 'newrs', label: 'new RS', x: 2.5, y: 5.6, note: notes.newrs ?? 'v2' },
      { id: 'surge', label: 'surge', x: 4.3, y: 4.2, note: notes.surge ?? '+25%' },
      { id: 'ready', label: 'ready', x: 6.0, y: 2.8, note: notes.ready ?? 'minReady' },
      { id: 'avail', label: 'avail', x: 6.0, y: 5.6, note: notes.avail ?? 'floor' },
      { id: 'cond', label: 'conds', x: 7.7, y: 4.2, note: notes.cond ?? 'status' },
      { id: 'done', label: 'done', x: 9.3, y: 4.2, note: notes.done ?? 'complete' },
    ],
    edges: [
      { id: 'e-deploy-oldrs', from: 'deploy', to: 'oldrs' },
      { id: 'e-deploy-newrs', from: 'deploy', to: 'newrs' },
      { id: 'e-oldrs-surge', from: 'oldrs', to: 'surge' },
      { id: 'e-newrs-surge', from: 'newrs', to: 'surge' },
      { id: 'e-newrs-ready', from: 'newrs', to: 'ready' },
      { id: 'e-oldrs-avail', from: 'oldrs', to: 'avail' },
      { id: 'e-ready-cond', from: 'ready', to: 'cond' },
      { id: 'e-avail-cond', from: 'avail', to: 'cond' },
      { id: 'e-cond-done', from: 'cond', to: 'done' },
    ],
  }, { title });
}

function rolloutPlot(title = 'Old Pods drain while new Pods rise') {
  return plotState({
    axes: { x: { label: 'rollout step', min: 0, max: 5 }, y: { label: 'pods', min: 0, max: 7 } },
    series: [
      { id: 'old', label: 'old RS', points: [{ x: 0, y: 5 }, { x: 1, y: 4 }, { x: 2, y: 3 }, { x: 3, y: 2 }, { x: 4, y: 1 }, { x: 5, y: 0 }] },
      { id: 'new', label: 'new RS', points: [{ x: 0, y: 0 }, { x: 1, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 4 }, { x: 4, y: 5 }, { x: 5, y: 5 }] },
      { id: 'total', label: 'total', points: [{ x: 0, y: 5 }, { x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 5 }] },
    ],
    markers: [
      { id: 'surge', x: 1, y: 6, label: 'surge cap' },
      { id: 'finish', x: 5, y: 5, label: 'complete' },
    ],
  }, { title });
}

function* rollingUpdate() {
  yield {
    state: deployGraph('Deployment rollout coordinates two ReplicaSets'),
    highlight: { active: ['deploy', 'oldrs', 'newrs', 'e-deploy-oldrs', 'e-deploy-newrs'], compare: ['done'] },
    explanation: 'A Deployment rolling update creates or reuses a new ReplicaSet and gradually shifts replicas away from the old ReplicaSet. The controller keeps availability within maxUnavailable and extra capacity within maxSurge.',
    invariant: 'The Deployment owns intent; ReplicaSets own concrete Pod counts.',
  };

  yield {
    state: labelMatrix(
      'RollingUpdate arithmetic',
      [
        { id: 'desired', label: 'desired' },
        { id: 'surge', label: 'maxSurge' },
        { id: 'unavail', label: 'maxUnavail' },
        { id: 'bounds', label: 'bounds' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['5', 'target'],
        ['1', 'at most 6 total'],
        ['1', 'at least 4 avail'],
        ['4..6', 'safe band'],
      ],
    ),
    highlight: { active: ['surge:value', 'unavail:value', 'bounds:value'], found: ['desired:value'] },
    explanation: 'For a five-replica Deployment with maxSurge 1 and maxUnavailable 1, the controller may run up to six total Pods and must keep at least four available while changing versions.',
  };

  yield {
    state: rolloutPlot(),
    highlight: { active: ['old', 'new', 'total', 'surge'], found: ['finish'] },
    explanation: 'The rollout is a bounded walk through replica counts. New Pods rise, old Pods fall, and total Pods stay inside the surge cap while available Pods stay above the availability floor.',
  };

  yield {
    state: deployGraph('Readiness moves the rollout forward', { ready: 'new ready', avail: 'floor ok', cond: 'Progressing', done: 'all new' }),
    highlight: { active: ['ready', 'avail', 'cond', 'done', 'e-ready-cond', 'e-avail-cond', 'e-cond-done'], compare: ['surge'] },
    explanation: 'A rollout should advance only when new Pods become ready and available. minReadySeconds can require a Pod to remain ready before counting it as available.',
  };
}

function* progressGate() {
  yield {
    state: deployGraph('Progress is tracked as status conditions', { cond: 'status', done: 'watch' }),
    highlight: { active: ['cond', 'done', 'e-cond-done'], found: ['ready'], compare: ['oldrs', 'newrs'] },
    explanation: 'Deployment status conditions summarize rollout state. Progressing, Available, and ReplicaFailure conditions let automation distinguish a healthy rollout from a stuck or failed one.',
  };

  yield {
    state: labelMatrix(
      'Progress deadline failures',
      [
        { id: 'image', label: 'image' },
        { id: 'probe', label: 'probe' },
        { id: 'quota', label: 'quota' },
        { id: 'sched', label: 'sched' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'debug', label: 'debug' },
      ],
      [
        ['pull fail', 'events'],
        ['not ready', 'probe logs'],
        ['ReplicaFail', 'admission'],
        ['pending', 'scheduler'],
      ],
    ),
    highlight: { active: ['image:debug', 'probe:debug'], found: ['quota:debug', 'sched:debug'] },
    explanation: 'When progressDeadlineSeconds expires, the status points at failure, but the root cause may be image pulls, readiness probes, quota denial, unavailable nodes, or application crashes.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'minutes', min: 0, max: 8 }, y: { label: 'available new pods', min: 0, max: 5 } },
      series: [
        { id: 'want', label: 'desired', points: [{ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 4, y: 4 }, { x: 6, y: 5 }] },
        { id: 'actual', label: 'actual', points: [{ x: 0, y: 0 }, { x: 2, y: 1 }, { x: 4, y: 1 }, { x: 6, y: 1 }] },
      ],
      markers: [
        { id: 'deadline', x: 6, y: 1, label: 'deadline' },
      ],
    }, { title: 'A stuck rollout stops gaining available Pods' }),
    highlight: { active: ['actual', 'deadline'], compare: ['want'] },
    explanation: 'The controller does not need to know the application bug to detect lack of progress. If available new Pods stop increasing long enough, the rollout is marked failed for operators and automation.',
  };

  yield {
    state: deployGraph('Rollback swaps intent back to an older ReplicaSet', { deploy: 'undo', oldrs: 'v1 scale up', newrs: 'v2 scale down', cond: 'revert', done: 'stable' }),
    highlight: { active: ['deploy', 'oldrs', 'newrs', 'cond', 'done'], found: ['e-deploy-oldrs', 'e-deploy-newrs'] },
    explanation: 'Rollback is another reconciliation target. The desired template changes back to a known-good revision, then the Deployment controller walks the same maxSurge and maxUnavailable state machine in reverse.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'rolling update') yield* rollingUpdate();
  else if (view === 'progress gate') yield* progressGate();
  else throw new InputError('Pick a Kubernetes Deployment rollout view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a state machine over two ReplicaSets. A Deployment is the intent object, a ReplicaSet owns a concrete set of identical Pods, and a Pod is counted as available only after readiness and any minimum-ready delay say it can serve. Active nodes are counters the controller is changing, compare nodes are limits, and found nodes show a legal rollout state.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A stateless service needs to change versions without disappearing. Deleting all old Pods before creating new ones causes downtime, while creating too many new Pods can exhaust quota or overload dependencies. A Deployment rolling update replaces old ReplicaSet Pods with new ReplicaSet Pods while respecting availability, surge, readiness, and progress rules.',
        {type:'callout', text:'Rolling update safety comes from bounded ReplicaSet counters plus honest readiness gates, not from the order Pods happen to start.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious release is a big switch: start version two, route traffic to it, and delete version one. That can work for a toy service with instant startup and abundant spare capacity. It fails when startup is slow, old and new versions overlap behind one Service, or users notice a moment with too few ready Pods.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that a rollout has two separate safety budgets. One budget limits extra capacity through `maxSurge`; the other limits missing capacity through `maxUnavailable`. If the controller ignores either one, the release can either overload the cluster or reduce service below the promised floor.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that a rolling update is a bounded walk through ReplicaSet counts. The controller scales the new ReplicaSet up and the old ReplicaSet down only when the next move stays inside the surge ceiling and the availability floor. Readiness is the gate that turns a created Pod into useful capacity.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The Deployment controller observes desired replicas, old ReplicaSet replicas, new ReplicaSet replicas, ready Pods, available Pods, and status conditions. It creates or scales the new ReplicaSet, waits for Pods to become ready and available, then reduces the old ReplicaSet. If progress stops longer than `progressDeadlineSeconds`, the Deployment records a failed-progress condition rather than pretending the rollout is healthy.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is an invariant over counts. Before each scale step, total Pods must stay at or below desired plus surge, and available Pods must stay at or above desired minus unavailable. If readiness honestly represents service participation, every legal transition preserves the configured availability envelope until all available Pods belong to the new ReplicaSet.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        '`maxSurge` buys safer or faster replacement by spending extra Pods, CPU, memory, IPs, and dependency load. `maxUnavailable` saves capacity by allowing fewer ready replicas during the rollout. `minReadySeconds` catches Pods that pass readiness briefly and fail moments later, but every added second extends release time across every batch.',
        'The hidden cost is version compatibility. During a rolling update, old and new Pods usually share one Service, database, cache, queue, and API contract. The controller can preserve Pod counts while the application breaks if v2 writes data that v1 cannot read.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Rolling updates fit stateless HTTP services, workers with compatible message formats, and controllers that can tolerate old and new versions running together. They are good default release machinery because they are observable, reversible through another desired-state change, and driven by standard Kubernetes conditions. They are not a substitute for canary analysis when business behavior must be measured before full rollout.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails for schema-incompatible releases, warmup-heavy services with weak readiness probes, stateful members with identity, and changes that need traffic splitting before full exposure. It also fails when readiness checks only whether a port is open. A Pod can accept TCP while caches are cold, migrations are incomplete, or dependency credentials are missing.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A payment API has 5 desired replicas, `maxSurge: 1`, and `maxUnavailable: 1`. The controller may run at most 6 total Pods and must keep at least 4 available. It creates one v2 Pod, waits until it is available, then removes one v1 Pod; repeating that move walks counts from v1=5,v2=0 to v1=0,v2=5 without leaving the safe band.',
        'If v2 never becomes ready, total Pods may reach 6 but available Pods do not increase. The controller cannot remove more old Pods without violating the availability floor, so progress stalls and the deadline condition identifies a failed rollout. If v2 is ready but writes a database column that v1 cannot read, the count invariant still holds and the release plan is wrong.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Use the official Kubernetes Deployment concept page, Deployment API reference, and rolling-update task guide as primary sources. They define ReplicaSets, rollout status, `maxSurge`, `maxUnavailable`, readiness, progress deadlines, pause, resume, and rollback behavior.',
        'Study HPA next because scale changes can happen during rollout. Then study PodDisruptionBudgets, EndpointSlices, canary delivery, and expand-contract database migration, because availability counts do not prove application compatibility.',
      ],
    },
  ],
};