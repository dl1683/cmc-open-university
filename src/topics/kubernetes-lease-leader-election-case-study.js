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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a race to update one small API object. A Lease is a Kubernetes coordination object that stores a holder identity, renewal time, duration, and object version. Active nodes show the candidate or holder making a claim, compare nodes show waiting replicas, and found nodes show the current leader or a successful failover.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Kubernetes controllers need redundancy, but some controller work should have one active actor. Running one replica creates a failure point, while running every replica as active can duplicate cloud calls, cleanup loops, migrations, or shared status writes. Leader election lets several replicas stay available while only one performs leader-only work at a time.',
        {type:'callout', text:'A Lease makes leadership a versioned time record, so one replica can act while others wait for freshness to expire.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is one controller replica. It avoids duplicate leadership because no other process can act, and it is easy to reason about during normal operation. It fails on node loss, process crash, image pull trouble, or maintenance because reconciliation stops until another process starts manually or through a restart policy.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is distributed authority. A local mutex cannot coordinate processes on different nodes, and a dead process cannot release an in-memory lock. A heartbeat alone is not enough either, because several standbys may observe staleness at the same time and all try to act unless one cluster-visible write chooses the winner.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to make leadership a time-bounded, versioned API record. The Lease names the holder, records when it was renewed, defines how long it remains valid, and uses `resourceVersion` so competing updates cannot silently overwrite each other. The API server serializes the claim; time supplies a path to failover.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Every replica reads or watches the Lease. If the Lease is empty, expired, or already held by itself, a replica tries to update `holderIdentity` and `renewTime` using the observed object version. The current leader renews before expiration, while standbys wait; if a renewal fails or another holder appears, the old leader must stop leader-only work.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The safety argument for the claim is object-version serialization. If two standbys try to acquire the same Lease version, at most one update commits and the loser receives a conflict, rereads, and sees the new holder. The liveness argument is bounded waiting under reasonable timing assumptions: if the holder stops renewing long enough, another replica can acquire the expired Lease.',
        'The Lease does not prove external side effects happen exactly once. A paused leader can wake after another replica acquired the Lease, so controller code must obey renewal failure, cancellation, generation checks, idempotency, or fencing. The invariant is that only the process holding a fresh Lease should perform leader-only work now.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Lease election costs API reads, watches, updates, conflicts, and retries against one small object. A 15-second lease duration with renewals every 5 seconds creates about 12 successful updates per minute per active leader, plus standby reads or watch events. Shorter durations reduce failover time but increase false loss risk during API latency, garbage collection pauses, or network trouble.',
        'The code cost is cancellation discipline. Leader-only loops, goroutines, callbacks, and external operations must stop or recheck authority after leadership loss. The API object is simple; the hard part is ensuring old work does not escape the election loop.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Lease leader election fits kube-controller-manager, kube-scheduler, operators, and custom controllers where Kubernetes is already the coordination plane. It is suitable for coarse controller leadership, not per-request locking. It works best when the protected work is idempotent reconciliation and external side effects have their own duplicate guards.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails as a complete guarantee for non-idempotent external actions. A cloud API, database, or billing system may not know which Kubernetes replica currently holds the Lease, so external writes need request ids, compare-and-swap checks, generation numbers, or fencing tokens. It also fails when leadership is treated as permanent after startup rather than a state that can be lost.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Two controller-manager replicas compete for a Lease with `leaseDurationSeconds: 15`, renew deadline around 10 seconds, and retry period around 2 seconds. Replica A acquires the Lease at t=0 and renews at t=5 and t=10. At t=12 its node freezes, so no renewal reaches the API server.',
        'Replica B observes that the last renew time is older than the allowed duration after about t=25, then updates the Lease using the current `resourceVersion`. If the update succeeds, B starts controller work. If A wakes at t=30, it must read or renew first, see B as holder, and remain standby; any operation A started before freezing still needs an external duplicate guard.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Use the official Kubernetes Leases concept page, Lease API reference, and coordinated leader election documentation as primary sources. They define Lease fields, renewal behavior, resource versions, and the Kubernetes coordination surface.',
        'Study reconciliation loops next because leader election only chooses who runs the loop. Then study distributed locks, compare-and-swap registers, failure detectors, fencing tokens, and Raft leader leases to understand the timing assumptions and side-effect hazards behind this pattern.',
      ],
    },
  ],
};