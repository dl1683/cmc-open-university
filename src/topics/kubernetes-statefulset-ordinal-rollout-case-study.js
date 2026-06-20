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
      heading: 'Why this exists',
      paragraphs: [
        'A Deployment manages interchangeable replicas. That is the right model for stateless web servers, but it is the wrong model for systems where replica identity carries data, membership, or bootstrapping meaning.',
        'StatefulSet exists for Pods that need a stable place in the application. Each replica gets an ordinal, a stable network identity, and stable storage. The controller can then scale and roll out changes without pretending that `db-0` and `db-3` are the same member.',
        {type:'callout', text:'StatefulSet makes ordinal identity part of correctness, so replacement and rollout preserve the name, storage, and order that stateful systems depend on.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first attempt is a Deployment with persistent volumes. It works while every replica can be replaced by any other replica. It fails when a replacement must keep the same disk, DNS name, or role in a replication group.',
        'The second attempt is an external script that deletes Pods in a careful order. That moves the hard part outside Kubernetes. The script now has to track desired version, readiness, storage identity, failed deletes, partial rollbacks, and controller restarts.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Anonymous replacement breaks peer discovery and storage attachment. A database may remember that `db-0` is the seed member, that `db-2` owns a shard, or that a peer should connect to `web-1.nginx.default.svc.cluster.local`.',
        'Parallel rollout also breaks some stateful systems. If every member restarts at once, quorum can disappear, replication can stall, and a bad binary can take down the whole set before any health signal stops the update.',
      ],
    },
    {
      heading: 'Core insight: the ordinal table',
      paragraphs: [
        'The useful mental model is an ordinal-indexed replica table. Each row binds an ordinal to a Pod name, DNS identity, PVC identity, readiness state, current revision, and update eligibility.',
        'The ordinal is part of the application contract. For a three-replica StatefulSet named `web`, the default ordinals are 0, 1, and 2. The Pods are named `web-0`, `web-1`, and `web-2`; their identities persist across rescheduling.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'On creation, the default `OrderedReady` policy creates Pods from the lowest ordinal to the highest. `web-1` waits for `web-0` to be Running and Ready. `web-2` waits for `web-1`.',
        'On scale-down, the controller deletes in the opposite direction. Higher ordinals terminate before lower ordinals. This protects systems where low ordinals are seeds, primaries, or stable membership anchors.',
        'On a RollingUpdate, the controller again walks from the largest ordinal down to the smallest. It deletes and recreates one Pod at a time, then waits for the updated Pod to become Running and Ready before touching its predecessor.',
      ],
    },
    {
      heading: 'Partitioned rollout',
      paragraphs: [
        'A RollingUpdate partition turns the ordinal table into a staged rollout. If the partition is 2, only Pods with ordinal 2 or higher receive the new template. Lower ordinals stay on the old revision, even if they are deleted and recreated.',
        'That is useful for stateful canaries. A four-node replicated store can update `db-3` and `db-2` first while `db-1` and `db-0` keep the old version. If replication lag, readiness, and application metrics stay healthy, the operator lowers the partition and continues.',
      ],
    },
    {
      heading: 'Reliability argument',
      paragraphs: [
        'The safety argument is stable identity plus ordered reconciliation. The controller does not ask the application to infer which anonymous replacement got which disk. It reconciles named ordinal rows toward the desired spec.',
        'Readiness is the rollout gate. The controller should not advance to the next ordinal until the current one is healthy according to Kubernetes readiness and, when configured, minimum ready seconds. A bad readiness probe can freeze the rollout because the controller is obeying the only health signal it has.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'StatefulSet spends flexibility to buy identity. Rollouts are slower than anonymous Deployment rollouts, surge-style replacement is limited, and a single unhealthy ordinal can block progress.',
        'Storage lifecycle is also more conservative. PVCs are not casually deleted with Pods, because deleting storage automatically is usually worse than leaking it. That safety creates cleanup work and requires clear retention policy.',
        'More parallel behavior exists, such as `Parallel` pod management for scaling and `maxUnavailable` for rolling updates where supported and enabled. Those options trade ordering for speed, and they are wrong for applications that require strict sequencing.',
      ],
    },
    {
      heading: 'Where it wins and fails',
      paragraphs: [
        'StatefulSet works well for replicated databases, queues, consensus members, shard owners, ordered bootstrap flows, and services that expose per-replica DNS names.',
        'It fails as a substitute for application-level safety. Kubernetes can preserve identity and order, but it cannot prove that a database migration is backward compatible, that quorum is healthy, or that a new binary can read the old on-disk format.',
        'It is also the wrong default for stateless workloads. If replicas are interchangeable and storage is not attached to identity, Deployment usually gives simpler rollout, faster replacement, and easier horizontal scaling.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The most common failure is a readiness probe that does not represent application safety. A Pod can be Running and Ready while replication is lagging, schema migration is incomplete, or quorum is fragile. The controller will trust the probe because that is the signal it has.',
        'Another failure is manual repair that breaks identity. Deleting PVCs, renaming peer identities, or recreating Pods outside the StatefulSet contract can confuse systems that bind data to ordinal names. StatefulSet protects identity only if operators respect the identity model.',
        'Partitioned rollouts can also stall. That is a feature when the new revision is bad, but it becomes operational debt if no one owns the decision to lower the partition, roll back, or investigate the blocked ordinal.',
      ],
    },
    {
      heading: 'Operational checklist',
      paragraphs: [
        'Before using StatefulSet, define what the ordinal means to the application. Is ordinal 0 a seed, a primary, a shard owner, a stable hostname, or only a name? The rollout policy should match that meaning.',
        'For rollouts, monitor readiness, replication lag, quorum health, storage attach state, PVC retention, application version skew, and per-ordinal error rates. Kubernetes can order updates, but the application metrics decide whether the order is safe.',
        'Document recovery. Operators should know whether to delete a Pod, preserve a PVC, lower a partition, roll back a template, or repair application membership when one ordinal gets stuck.',
      ],
    },
    {
      heading: 'Rule of thumb',
      paragraphs: [
        'Use StatefulSet when identity is part of correctness. If a replica can be replaced anonymously, a Deployment is usually simpler.',
        'Treat OrderedReady as a safety rail, not as proof. It slows change so the application has time to prove health. The application still needs probes and metrics that mean something.',
        'The deciding question is whether `pod-N` means something durable to the system. If the name, disk, peer slot, or shard ownership matters after rescheduling, StatefulSet is probably the right controller shape.',
        'For teams, the main discipline is naming the contract. Once everyone knows what the ordinal protects, rollout partitions, disruption budgets, PVC policy, and recovery runbooks become easier to reason about during ordinary deploys and incidents.',
      ],
    },
    {
      heading: 'Concrete example',
      paragraphs: [
        'A three-node PostgreSQL-like cluster uses `db-0` as the initial primary and `db-1`, `db-2` as replicas. Each Pod has its own PVC, and peer configuration names the ordinal hostnames directly.',
        'A partitioned update sets partition 2. `db-2` updates first while `db-0` and `db-1` stay old. If replication catches up and readiness passes, the operator lowers the partition to 1, then 0. The rollout proceeds without losing the stable storage and network identity of each member.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Deployment rolling updates to understand the anonymous replica model that StatefulSet deliberately rejects. Then study Services, headless Services, DNS for Pods, PersistentVolumes, and volume claim templates.',
        'For the application side, study quorum systems, leader election, replication lag, backup and restore, schema migration, and version skew. StatefulSet gives the controller shape; the application still owns data correctness.',
        'Primary sources: https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/, https://kubernetes.io/docs/reference/kubernetes-api/apps/stateful-set-v1/, and https://kubernetes.io/docs/tutorials/stateful-application/basic-stateful-set/.',
      ],
    },
  ],
};
