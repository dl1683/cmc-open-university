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
      heading: 'What it is',
      paragraphs: [
        'A Kubernetes Deployment manages rollout state for stateless workloads. A rolling update gradually replaces Pods from an old ReplicaSet with Pods from a new ReplicaSet while preserving configured availability and surge limits.',
        'The Deployment concept page documents rolling updates, maxSurge, maxUnavailable, minReadySeconds, progressDeadlineSeconds, pause, resume, rollback, and rollout status: https://kubernetes.io/docs/concepts/workloads/controllers/deployment/. The Deployment API reference defines strategy.rollingUpdate.maxSurge and maxUnavailable along with status fields and conditions: https://kubernetes.io/docs/reference/kubernetes-api/workload-resources/deployment-v1/.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The main structures are the Deployment spec, old ReplicaSet, new ReplicaSet, desired replica count, maxSurge cap, maxUnavailable floor, Pod readiness state, minReadySeconds timer, revision history, and status conditions. Together they form a state machine over replica counts and availability.',
        'A rollout controller does not simply delete old Pods and create new ones. It changes two ReplicaSet sizes while checking availability. Status conditions expose Progressing, Available, and failure reasons so humans and automation can decide whether to wait, pause, or roll back.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A web Deployment has five desired replicas, maxSurge 1, and maxUnavailable 1. During rollout, the controller may create one extra v2 Pod, wait until it becomes available, then scale down one v1 Pod. That repeats until all five available Pods are v2. If readiness never passes and progressDeadlineSeconds expires, the rollout reports failure; the operator can inspect events and roll back to the previous ReplicaSet.',
        'The task guide for updating Deployments without downtime covers triggering, monitoring, pausing, resuming, configuring strategy parameters, and rollback: https://kubernetes.io/docs/tasks/run-application/update-deployment-rolling/.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Rollout success is not just image pull success. Readiness probes, minReadySeconds, quota, scheduling, PodDisruptionBudgets, and application warmup can all stall progress. A too-low maxUnavailable can make rollout slow; a too-high maxSurge can overload dependencies.',
        'Study next: Kubernetes HPA Recommendation Ring for scale changes during traffic, PodDisruptionBudget Eviction Budget for availability during voluntary disruption, ResourceQuota and LimitRange Admission for quota failures, and Flagger Progressive Delivery Canary for traffic-gated rollout automation.',
      ],
    },
  ],
};
