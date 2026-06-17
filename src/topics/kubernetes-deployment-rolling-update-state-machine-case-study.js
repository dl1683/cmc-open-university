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
      heading: 'Why this exists',
      paragraphs: [
        'A stateless service needs to change versions without disappearing. Deleting all old Pods and then creating new ones is simple, but it creates downtime. Creating too many new Pods can overload the cluster, exhaust quota, or overwhelm downstream dependencies.',
        'A Kubernetes Deployment rolling update is the controller state machine that walks between those extremes. It replaces old ReplicaSet Pods with new ReplicaSet Pods while respecting availability, surge, readiness, and progress constraints. The topic looks simple because the YAML is short. The control problem is not short.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious release method is to create version two, point traffic at it, and delete version one. That works only when capacity is abundant, startup is instant, both versions are compatible, and no user request notices the switch. Production services usually violate at least one of those assumptions.',
        'The other obvious method is to replace Pods one by one by hand. That is safer than a big bang, but it is not repeatable. Humans are bad at maintaining exact counters under pressure. Kubernetes turns the rollout into a reconciliation loop over ReplicaSets, Pods, readiness, and status conditions.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The rollout is a bounded counter problem. The controller changes two ReplicaSet sizes: scale the new one up and the old one down. maxSurge caps extra Pods above desired count. maxUnavailable caps how many desired Pods may be unavailable.',
        'Readiness turns Pod creation into a gate. A Pod that exists but is not ready does not count as available. minReadySeconds can require it to stay ready before the rollout trusts it.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'Inspect a rolling update as two ReplicaSets sharing one availability budget. The new ReplicaSet wants more replicas. The old ReplicaSet wants fewer. The Deployment controller moves the counters only when doing so respects maxSurge, maxUnavailable, readiness, and progress deadline.',
        'The important state is desired replicas, updated replicas, ready replicas, available replicas, unavailable replicas, old ReplicaSet count, new ReplicaSet count, observed generation, rollout condition, and progress reason. If those fields are not visible, a rollout failure becomes a vague story about Pods instead of a state-machine problem.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'With five desired replicas, maxSurge 1, and maxUnavailable 1, the controller may create one extra v2 Pod. Once it becomes available, the controller can remove one v1 Pod. The process repeats until all available Pods are v2.',
        'If the new Pods never become ready, available count stops improving. progressDeadlineSeconds lets the controller mark the rollout failed. Rollback is another desired-state change: point the Deployment back to a previous template and walk the same state machine again.',
        'The Deployment does not route traffic directly. Services, EndpointSlices, kube-proxy or a service mesh, probes, and application behavior determine what users experience. The rollout controller supplies bounded replacement. It does not prove that the new version is semantically correct.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The controller never needs to understand application internals. It relies on the Deployment spec, ReplicaSet counts, Pod readiness, and status conditions. If those signals are honest, the rollout preserves the configured availability envelope.',
        'The invariant is that desired availability and surge constraints are checked before each scale step. That is why a bad readiness probe can break the rollout: the controller is only as good as the readiness signal.',
        'This is a useful algorithmic lesson. The Deployment controller is not doing magic. It repeatedly compares desired rollout state with observed cluster state and takes the next legal transition. The safety comes from explicit counters and gates, not from hope that Pods start in a nice order.',
      ],
    },
    {
      heading: 'Where it wins and fails',
      paragraphs: [
        'Rolling updates work well for stateless services whose old and new versions can coexist behind the same Service. They are simple, observable, and reversible.',
        'They are weak for schema-incompatible releases, stateful members, warmup-heavy services, and changes that need traffic analysis before full rollout. Canary or blue-green delivery may be safer when version compatibility is uncertain.',
        'They also fail when readiness is treated as a port-open check. A Pod can accept TCP connections while caches are cold, migrations are incomplete, background workers are missing, or feature flags are inconsistent. Readiness should represent service participation, not mere process existence.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'maxSurge buys speed and safety by spending extra capacity. maxUnavailable saves capacity but accepts fewer available replicas during rollout. minReadySeconds protects against Pods that become ready briefly and fail moments later, but it slows releases. progressDeadlineSeconds detects stuck rollouts, but it cannot tell whether the business behavior is correct.',
        'The most expensive hidden tradeoff is version compatibility. A rolling update puts old and new Pods behind the same Service for part of the release. APIs, database schema, caches, message formats, and feature flags must tolerate that overlap. If they cannot, the controller can preserve Pod availability while the application breaks.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A payment API runs five replicas. The team releases v2 with maxSurge 1 and maxUnavailable 1. The controller creates one v2 Pod, waits for readiness and minReadySeconds, then scales down one v1 Pod. During the rollout the Service sees a mixed pool, so v1 and v2 must both handle the same request and schema shape.',
        'If v2 has a bad readiness probe that reports ready before cache warmup, traffic reaches cold Pods and p99 spikes. If v2 never becomes ready, updated replicas rise but available replicas do not, and the progress deadline eventually marks the Deployment as failed. A rollback changes the template back and lets the same controller walk toward the previous ReplicaSet.',
        'Now add a database migration. If v2 writes a column that v1 cannot read, the rolling update becomes unsafe even if every Pod is ready. The correct release sequence is expand schema, deploy code that tolerates both shapes, backfill if needed, switch behavior, then contract schema later. The Deployment controller cannot infer that contract. The release plan has to encode it.',
      ],
    },
    {
      heading: 'Failure diagnosis',
      paragraphs: [
        'When a rollout stalls, start with the state machine rather than the logs. Did the new ReplicaSet scale up? Did Pods schedule? Did images pull? Did containers start? Did readiness pass? Did minReadySeconds elapse? Did the controller observe the latest generation? Each question maps to a specific field or event.',
        'When a rollout succeeds but users suffer, the problem is often outside the Deployment controller. Check endpoint distribution, p99 by version, cold-start behavior, dependency errors, schema compatibility, and feature flags. The controller can say the infrastructure transition completed; it cannot say the product release was good.',
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        'Track Deployment conditions, observed generation, updated replicas, available replicas, unavailable replicas, old ReplicaSet count, new ReplicaSet count, readiness failures, image pull failures, probe latency, startup time, endpoint churn, p99 by version, and error rate by version.',
        'A serious rollout dashboard should show which gate is blocking progress. Waiting for image pull, waiting for readiness, waiting for minReadySeconds, blocked by quota, failing progress deadline, and healthy but slow replacement are different states. Treating them as one generic rollout spinner wastes operator time.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'A rolling update is a constrained state machine over ReplicaSet counters. maxSurge, maxUnavailable, readiness, and progress deadline define which transition is legal next. The controller can maintain the envelope only if the probes and compatibility assumptions are honest.',
        'For course design, teach this after reconciliation loops and before canary delivery. Students should understand that Kubernetes can safely move infrastructure state, but application correctness still depends on version compatibility, probes, and runtime signals.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Kubernetes Deployment concepts at https://kubernetes.io/docs/concepts/workloads/controllers/deployment/, Deployment API reference at https://kubernetes.io/docs/reference/kubernetes-api/workload-resources/deployment-v1/, and the rolling update task guide at https://kubernetes.io/docs/tasks/run-application/update-deployment-rolling/.',
        'Study Kubernetes HPA Recommendation Ring for scale changes during traffic, PodDisruptionBudget Eviction Budget for availability during voluntary disruption, ResourceQuota and LimitRange Admission for quota failures, StatefulSet Ordinal Rollout for identity-sensitive workloads, and Flagger Progressive Delivery Canary for traffic-gated rollout automation.',
      ],
    },
  ],
};
