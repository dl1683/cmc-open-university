// Kubernetes StatefulSet: stable identities and ordered ordinal rollouts,
// including partitions for canary-style updates.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'kubernetes-statefulset-ordinal-rollout-case-study',
  title: 'Kubernetes StatefulSet Ordinal Rollout Case Study',
  category: 'Systems',
  summary: 'How StatefulSets preserve ordinal identity, stable storage, ordered readiness, RollingUpdate partitioning, reverse-ordinal updates, and OnDelete behavior for stateful workloads.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['ordinal identity', 'partition rollout'], defaultValue: 'ordinal identity' },
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

function stsGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'sts', label: 'STS', x: 0.7, y: 4.2, note: notes.sts ?? 'spec' },
      { id: 'p0', label: 'pod-0', x: 2.4, y: 2.4, note: notes.p0 ?? 'old' },
      { id: 'p1', label: 'pod-1', x: 2.4, y: 4.2, note: notes.p1 ?? 'old' },
      { id: 'p2', label: 'pod-2', x: 2.4, y: 6.0, note: notes.p2 ?? 'old' },
      { id: 'dns', label: 'DNS', x: 4.5, y: 2.4, note: notes.dns ?? 'stable' },
      { id: 'pvc', label: 'PVC', x: 4.5, y: 6.0, note: notes.pvc ?? 'stable' },
      { id: 'ctrl', label: 'ctrl', x: 6.4, y: 4.2, note: notes.ctrl ?? 'ordered' },
      { id: 'ready', label: 'ready', x: 8.0, y: 4.2, note: notes.ready ?? 'gate' },
      { id: 'done', label: 'done', x: 9.4, y: 4.2, note: notes.done ?? 'all ok' },
    ],
    edges: [
      { id: 'e-sts-p0', from: 'sts', to: 'p0' },
      { id: 'e-sts-p1', from: 'sts', to: 'p1' },
      { id: 'e-sts-p2', from: 'sts', to: 'p2' },
      { id: 'e-p0-dns', from: 'p0', to: 'dns' },
      { id: 'e-p2-pvc', from: 'p2', to: 'pvc' },
      { id: 'e-sts-ctrl', from: 'sts', to: 'ctrl' },
      { id: 'e-ctrl-ready', from: 'ctrl', to: 'ready' },
      { id: 'e-ready-done', from: 'ready', to: 'done' },
    ],
  }, { title });
}

function rolloutPlot() {
  return plotState({
    axes: { x: { label: 'update step', min: 0, max: 4 }, y: { label: 'updated ordinal', min: -0.5, max: 3.5 } },
    series: [
      { id: 'ord', label: 'updated', points: [{ x: 0, y: 3 }, { x: 1, y: 2 }, { x: 2, y: 1 }, { x: 3, y: 0 }] },
    ],
    markers: [
      { id: 'high', x: 0, y: 3, label: 'highest first' },
      { id: 'part', x: 2, y: 1, label: 'partition' },
    ],
  }, { title: 'RollingUpdate walks ordinals downward' });
}

function* ordinalIdentity() {
  yield {
    state: stsGraph('StatefulSet Pods have stable ordinal identity'),
    highlight: { active: ['sts', 'p0', 'p1', 'p2', 'e-sts-p0', 'e-sts-p1', 'e-sts-p2'], found: ['dns', 'pvc'] },
    explanation: 'A StatefulSet gives each Pod a stable ordinal, stable network identity, and stable storage relationship. That is the difference from an anonymous Deployment replica pool.',
    invariant: 'pod-0 is not interchangeable with pod-2 when identity or storage matters.',
  };

  yield {
    state: labelMatrix(
      'Stable identity table',
      [
        { id: 'p0', label: 'pod-0' },
        { id: 'p1', label: 'pod-1' },
        { id: 'p2', label: 'pod-2' },
        { id: 'p3', label: 'pod-3' },
      ],
      [
        { id: 'dns', label: 'DNS' },
        { id: 'pvc', label: 'PVC' },
        { id: 'role', label: 'role' },
      ],
      [
        ['web-0', 'data-0', 'seed'],
        ['web-1', 'data-1', 'replica'],
        ['web-2', 'data-2', 'replica'],
        ['web-3', 'data-3', 'replica'],
      ],
    ),
    highlight: { active: ['p0:dns', 'p0:pvc', 'p0:role'], found: ['p2:pvc'] },
    explanation: 'The ordinal becomes part of the operational contract. Databases and queues often rely on stable names and stable volumes when membership, replication, or bootstrap order matters.',
  };

  yield {
    state: stsGraph('Ordered readiness gates creation and replacement', { ctrl: '0 before 1', ready: 'must pass' }),
    highlight: { active: ['ctrl', 'ready', 'done', 'e-ctrl-ready', 'e-ready-done'], compare: ['p0', 'p1', 'p2'] },
    explanation: 'StatefulSet defaults favor ordered, cautious behavior. The controller waits for lower ordinals to be ready before moving forward, preserving assumptions many stateful systems need.',
  };

  yield {
    state: labelMatrix(
      'Deployment versus StatefulSet',
      [
        { id: 'name', label: 'name' },
        { id: 'storage', label: 'storage' },
        { id: 'scale', label: 'scale' },
        { id: 'update', label: 'update' },
      ],
      [
        { id: 'deploy', label: 'Deploy' },
        { id: 'sts', label: 'STS' },
      ],
      [
        ['random', 'ordinal'],
        ['shared/none', 'per ordinal'],
        ['pool', 'ordered'],
        ['surge pool', 'ordered'],
      ],
    ),
    highlight: { active: ['name:sts', 'storage:sts', 'update:sts'], compare: ['name:deploy'] },
    explanation: 'The tradeoff is flexibility for identity. StatefulSet is slower and more constrained, but it gives each replica a stable place in the system.',
  };
}

function* partitionRollout() {
  yield {
    state: rolloutPlot(),
    highlight: { active: ['ord', 'high', 'part'] },
    explanation: 'StatefulSet RollingUpdate proceeds in reverse ordinal order. With a partition, only Pods at ordinals greater than or equal to the partition are updated automatically.',
  };

  yield {
    state: stsGraph('Partition keeps lower ordinals untouched', { p0: 'held', p1: 'held', p2: 'new', ctrl: 'partition=2', done: 'canary' }),
    highlight: { active: ['p2', 'ctrl', 'ready', 'done'], compare: ['p0', 'p1'] },
    explanation: 'Partitioned rollout is a canary mechanism for stateful systems. Update the highest ordinals first, observe replication and readiness, then lower the partition when the new version is trusted.',
  };

  yield {
    state: labelMatrix(
      'Update strategies',
      [
        { id: 'rolling', label: 'Rolling' },
        { id: 'partition', label: 'partition' },
        { id: 'ondelete', label: 'OnDelete' },
        { id: 'maxun', label: 'maxUnav' },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['auto', 'stalls on bad pod'],
        ['canary', 'manual ramp'],
        ['manual', 'operator burden'],
        ['parallel', 'feature gated'],
      ],
    ),
    highlight: { active: ['rolling:action', 'partition:action', 'ondelete:action'], compare: ['maxun:risk'] },
    explanation: 'RollingUpdate is default. OnDelete gives manual control. Partition controls which ordinals update. Some clusters also support maxUnavailable behavior for more parallel stateful updates.',
  };

  yield {
    state: labelMatrix(
      'Complete case: replicated store',
      [
        { id: 'ord3', label: 'pod-3' },
        { id: 'ord2', label: 'pod-2' },
        { id: 'ord1', label: 'pod-1' },
        { id: 'ord0', label: 'pod-0' },
      ],
      [
        { id: 'version', label: 'version' },
        { id: 'decision', label: 'decision' },
      ],
      [
        ['v2', 'observe'],
        ['v2', 'observe'],
        ['v1', 'hold'],
        ['v1', 'seed safe'],
      ],
    ),
    highlight: { active: ['ord3:version', 'ord2:version'], found: ['ord1:decision', 'ord0:decision'] },
    explanation: 'A replicated store updates high ordinals first while pod-0 remains on the old version. If metrics and replication stay healthy, the operator lowers the partition and continues.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'ordinal identity') yield* ordinalIdentity();
  else if (view === 'partition rollout') yield* partitionRollout();
  else throw new InputError('Pick a Kubernetes StatefulSet view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A StatefulSet is the Kubernetes workload controller for Pods that need stable identity. It gives each replica a persistent ordinal, stable network identity, and stable storage association.',
        'The StatefulSet concept page documents stable identity, deployment and scaling guarantees, update strategies, partitions, and ordered updates: https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/. The API reference describes rollingUpdate.partition and update behavior: https://kubernetes.io/docs/reference/kubernetes-api/apps/stateful-set-v1/.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The data structure is an ordinal-indexed replica table. Each row binds ordinal, Pod name, DNS name, PVC identity, readiness state, version, and update eligibility. The controller walks the table in a defined order.',
        'The StatefulSet basics tutorial explains that RollingUpdate updates Pods in reverse ordinal order and that partition can split a rollout so lower ordinals remain untouched: https://kubernetes.io/docs/tutorials/stateful-application/basic-stateful-set/.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A four-node replicated database runs as db-0 through db-3. The team rolls out version 2 with partition 2. db-3 and db-2 update first while db-1 and db-0 remain on version 1. If replication lag, readiness, and error metrics stay healthy, the operator lowers the partition and updates the remaining ordinals.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'StatefulSet is not just Deployment with volumes. Identity creates ordering and availability constraints. A bad readiness probe can freeze rollout. A too-aggressive parallel update can break quorum-sensitive systems. Partitioned rollouts need explicit observation gates.',
        'Study next: Kubernetes Deployment Rolling Update for anonymous replica rollout, PodDisruptionBudget Eviction Budget for maintenance availability, Consistent Hashing for stable assignment, and Quorums for stateful availability math.',
      ],
    },
  ],
};
