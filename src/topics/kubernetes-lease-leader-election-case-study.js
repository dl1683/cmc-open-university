// Kubernetes Lease leader election: controller replicas coordinate through a
// lightweight Lease object with holder identity, renew time, and duration.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'kubernetes-lease-leader-election-case-study',
  title: 'Kubernetes Lease Leader Election Case Study',
  category: 'Systems',
  summary: 'How controller replicas use coordination.k8s.io Lease objects, holderIdentity, renewTime, leaseDurationSeconds, resourceVersion, and retries to elect and replace leaders.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['renew loop', 'failover clock'], defaultValue: 'renew loop' },
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

function leaseGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'a', label: 'rep A', x: 0.7, y: 3.0, note: notes.a ?? 'candidate' },
      { id: 'b', label: 'rep B', x: 0.7, y: 5.4, note: notes.b ?? 'candidate' },
      { id: 'api', label: 'API', x: 2.6, y: 4.2, note: notes.api ?? 'CAS' },
      { id: 'lease', label: 'Lease', x: 4.5, y: 4.2, note: notes.lease ?? 'object' },
      { id: 'holder', label: 'holder', x: 6.2, y: 3.0, note: notes.holder ?? 'A' },
      { id: 'renew', label: 'renew', x: 6.2, y: 5.4, note: notes.renew ?? 'time' },
      { id: 'leader', label: 'leader', x: 8.0, y: 3.0, note: notes.leader ?? 'acts' },
      { id: 'standby', label: 'standby', x: 8.0, y: 5.4, note: notes.standby ?? 'waits' },
      { id: 'work', label: 'work', x: 9.4, y: 4.2, note: notes.work ?? 'control' },
    ],
    edges: [
      { id: 'e-a-api', from: 'a', to: 'api' },
      { id: 'e-b-api', from: 'b', to: 'api' },
      { id: 'e-api-lease', from: 'api', to: 'lease' },
      { id: 'e-lease-holder', from: 'lease', to: 'holder' },
      { id: 'e-lease-renew', from: 'lease', to: 'renew' },
      { id: 'e-holder-leader', from: 'holder', to: 'leader' },
      { id: 'e-renew-standby', from: 'renew', to: 'standby' },
      { id: 'e-leader-work', from: 'leader', to: 'work' },
    ],
  }, { title });
}

function clockPlot() {
  return plotState({
    axes: { x: { label: 'seconds', min: 0, max: 36 }, y: { label: 'lease validity', min: 0, max: 1.2 } },
    series: [
      { id: 'valid', label: 'A lease', points: [{ x: 0, y: 1 }, { x: 8, y: 1 }, { x: 16, y: 1 }, { x: 24, y: 0 }, { x: 32, y: 0 }] },
      { id: 'b', label: 'B claim', points: [{ x: 0, y: 0 }, { x: 16, y: 0 }, { x: 24, y: 0.3 }, { x: 32, y: 1 }] },
    ],
    markers: [
      { id: 'miss', x: 24, y: 0, label: 'expired' },
      { id: 'take', x: 32, y: 1, label: 'B wins' },
    ],
  }, { title: 'Failover waits for the old lease to expire' });
}

function* renewLoop() {
  yield {
    state: leaseGraph('Leader election uses a Lease object as a lightweight lock'),
    highlight: { active: ['a', 'api', 'lease', 'holder', 'e-a-api', 'e-api-lease'], compare: ['b'] },
    explanation: 'Kubernetes components and controllers can elect a leader through the coordination.k8s.io Lease API. The API server stores the Lease object, and replicas compete with compare-and-swap style updates.',
    invariant: 'Only the Lease holder should perform singleton controller work.',
  };

  yield {
    state: labelMatrix(
      'Lease fields',
      [
        { id: 'holder', label: 'holder' },
        { id: 'renew', label: 'renew' },
        { id: 'dur', label: 'duration' },
        { id: 'rv', label: 'rv' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'role', label: 'role' },
      ],
      [
        ['ctrl-A', 'leader id'],
        ['12:00:08', 'freshness'],
        ['15s', 'expiry'],
        ['1042', 'CAS guard'],
      ],
    ),
    highlight: { active: ['holder:value', 'renew:value', 'dur:value'], found: ['rv:value'] },
    explanation: 'The Lease object is tiny but enough: who holds it, when it was renewed, how long it lasts, and a resourceVersion so competing updates do not silently overwrite each other.',
  };

  yield {
    state: leaseGraph('The leader keeps renewing before expiry', { a: 'leader', holder: 'ctrl-A', renew: 'fresh', leader: 'active' }),
    highlight: { active: ['a', 'lease', 'renew', 'leader', 'work', 'e-lease-renew', 'e-leader-work'], compare: ['b'] },
    explanation: 'The current leader periodically updates renewTime. Standbys keep reading or watching the Lease. As long as the renew time is fresh, they do not take over.',
  };

  yield {
    state: labelMatrix(
      'Update outcomes',
      [
        { id: 'renew', label: 'renew' },
        { id: 'conflict', label: 'conflict' },
        { id: 'expire', label: 'expire' },
        { id: 'steal', label: 'steal' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'next', label: 'next' },
      ],
      [
        ['holder same', 'continue'],
        ['rv changed', 'refetch'],
        ['too old', 'campaign'],
        ['new holder', 'lead'],
      ],
    ),
    highlight: { active: ['conflict:next', 'expire:next', 'steal:next'], found: ['renew:next'] },
    explanation: 'Leader election is a retry protocol around object versions. Conflicts mean another replica wrote first. Expiration lets a standby campaign. A successful update changes holderIdentity.',
  };
}

function* failoverClock() {
  yield {
    state: clockPlot(),
    highlight: { active: ['valid', 'miss', 'b', 'take'] },
    explanation: 'Failover is intentionally not instant. The system waits long enough to treat the old holder as expired, then another replica updates the Lease and starts acting as leader.',
  };

  yield {
    state: leaseGraph('A paused leader must stop acting after renewal failure', { a: 'paused', b: 'new leader', holder: 'ctrl-B', renew: 'new', leader: 'B acts', standby: 'A stops' }),
    highlight: { active: ['b', 'holder', 'leader', 'work'], removed: ['a'], found: ['renew'] },
    explanation: 'The hard case is a paused leader that wakes up. It must notice renewal failure or a changed holder and stop singleton work. The Lease coordinates leadership; the controller code still has to obey it.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'slow', label: 'slow API' },
        { id: 'pause', label: 'pause' },
        { id: 'clock', label: 'clock' },
        { id: 'split', label: 'split' },
      ],
      [
        { id: 'risk', label: 'risk' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['false loss', 'timeouts'],
        ['zombie', 'renew check'],
        ['early steal', 'skew budget'],
        ['dual actors', 'idempotency'],
      ],
    ),
    highlight: { active: ['pause:guard', 'split:guard'], compare: ['clock:risk'] },
    explanation: 'Lease election reduces duplicate leadership but does not remove distributed-systems hazards. Singleton work should still be idempotent, fenced, or guarded by status checks where possible.',
  };

  yield {
    state: leaseGraph('Complete case: kube-controller-manager replacement', { a: 'kcm-1', b: 'kcm-2', lease: 'kcm lease', holder: 'kcm-2', work: 'controllers' }),
    highlight: { active: ['a', 'b', 'lease', 'holder', 'leader', 'work'], found: ['api', 'renew'] },
    explanation: 'In a highly available control plane, multiple controller-manager replicas can run, but only the Lease holder actively reconciles shared controllers. If the holder disappears, another replica takes the Lease and resumes work.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'renew loop') yield* renewLoop();
  else if (view === 'failover clock') yield* failoverClock();
  else throw new InputError('Pick a Kubernetes Lease view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Kubernetes Lease objects are lightweight coordination records. They are used for node heartbeats, API server identity, workloads, and leader election among replicas of the same component or custom controller.',
        'The Leases concept page explains leader election through the Kubernetes API: https://kubernetes.io/docs/concepts/architecture/leases/. The Lease API reference defines coordination.k8s.io/v1 Lease fields: https://kubernetes.io/docs/reference/kubernetes-api/coordination/lease-v1/.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The Lease stores holderIdentity, leaseDurationSeconds, acquireTime, renewTime, leaseTransitions, and object metadata such as resourceVersion. The algorithm is a compare-and-swap retry loop over that object.',
        'Coordinated leader election documentation describes Kubernetes control-plane components using the Lease API to perform leader election in high-availability clusters: https://kubernetes.io/docs/concepts/cluster-administration/coordinated-leader-election/.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Two replicas of a custom controller run for availability. Replica A creates or updates the Lease and becomes holderIdentity ctrl-A. It renews the Lease while reconciling. Replica B watches. If A stops renewing past leaseDurationSeconds, B updates the Lease with a fresh resourceVersion and becomes leader. A must stop acting if it later sees that it no longer holds the Lease.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Leader election does not make side effects safe by itself. A paused old leader can resume. Controllers should re-check leadership, make reconcile idempotent, and use external fencing where external systems cannot tolerate duplicate actors.',
        'Study next: Leader Replacement for zombie leaders and fencing, Kubernetes Reconciliation for idempotent controller work, Distributed Locks for lease hazards, and Raft Leader Lease Read Safety for timing assumptions.',
      ],
    },
  ],
};
