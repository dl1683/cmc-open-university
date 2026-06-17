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
      heading: 'Why This Exists',
      paragraphs: [
        'Kubernetes controllers need redundancy. A single controller-manager or custom operator replica is easy to reason about, but it creates a failure point. If the process dies or the node disappears, reconciliation stops until a replacement starts.',
        'Running several active replicas solves availability but creates a coordination problem. Some work should have one active actor: assigning cloud resources, running cleanup loops, writing status for shared objects, or driving migrations. If two replicas do that work at once, retries can become duplicate side effects.',
        'A Kubernetes Lease object gives replicas a small cluster-visible coordination record. One replica holds the lease, renews it while healthy, and performs leader-only work. Other replicas observe the same object and wait until the holder is stale or the object is free.',
      ],
    },
    {
      heading: 'The Obvious Approach',
      paragraphs: [
        'The first approach is to run one replica. That avoids duplicate leadership because there is only one process. It is also fragile. Node failure, process crash, image pull trouble, or maintenance can stop control-plane progress.',
        'The second approach is active-active controllers. Let every replica reconcile everything and rely on idempotency. This works for many Kubernetes loops because reconciliation should be repeatable, but it is not enough for operations with external side effects or singleton responsibilities.',
        'The third approach is an external lock service. That can work, but Kubernetes already has an API server, object storage, watches, retry behavior, and resource versions. For many controllers, adding a separate coordinator is more operational surface than the problem needs.',
      ],
    },
    {
      heading: 'The Wall',
      paragraphs: [
        'A local mutex cannot solve this because replicas run in different processes, often on different nodes. A dead process also cannot release an in-memory lock. The decision has to be visible to all candidates.',
        'A heartbeat alone is not enough. A standby can observe that the old leader looks stale, but several standbys may observe the same staleness at the same time. Before any of them starts leader-only work, one claim has to win through a serialized cluster-visible write.',
        'The hard wall is the paused leader. Replica A may hold the Lease, pause long enough for replica B to take over, then wake up. If A continues old work after losing leadership, the Lease object did not protect the external system. The controller code has to check and obey leadership state.',
      ],
    },
    {
      heading: 'The Core Insight',
      paragraphs: [
        'The core insight is to make leadership an API object with time and versioned writes. The Lease records who currently holds leadership, when that holder last renewed, how long the lease should be considered valid, and a resourceVersion that protects updates from overwriting each other.',
        'The API server becomes the serialization point. Two candidates can race, but they cannot both update the same object version into two different winners. One update commits first; the other sees a conflict and must reread.',
        'Time gives liveness. If the current holder stops renewing for longer than the lease duration, standbys may campaign. Versioned updates give safety for the claim itself. Together they form a lightweight lease protocol, not a full proof that every external side effect is fenced.',
      ],
    },
    {
      heading: 'The Lease Object',
      paragraphs: [
        'A Lease is a resource in the coordination.k8s.io API group. Its spec can include holderIdentity, acquireTime, renewTime, leaseDurationSeconds, leaseTransitions, and fields used by newer coordinated leader-election behavior.',
        'For ordinary controller leader election, the central fields are holderIdentity, renewTime, and leaseDurationSeconds. The metadata.resourceVersion is just as important because it turns updates into compare-and-swap style attempts.',
        'The object is small by design. It is not a work queue, not a membership database, and not a history log. It is the minimal shared record needed for candidates to decide who should act right now.',
      ],
    },
    {
      heading: 'How It Works',
      paragraphs: [
        'Every replica runs the same election loop. It reads or watches the Lease. If the Lease is empty, expired, or already held by that replica, it tries to update holderIdentity and renewTime through the API server.',
        'The current leader renews before leaseDurationSeconds expires. Standbys continue observing. As long as renewTime is fresh, they remain passive for leader-only work.',
        'If renewals stop long enough, a standby attempts to acquire the Lease by writing itself as the holder. The write must be based on the resourceVersion it observed. If another candidate wrote first, the API server rejects the stale update and the loser retries from fresh state.',
        'A replica should start leader-only work only after its acquire or renew operation succeeds. If renewal fails, the holder changes, or the process receives a stop signal from the election loop, it must stop acting as leader.',
      ],
    },
    {
      heading: 'Animation Walkthrough',
      paragraphs: [
        'The renew-loop view shows replica A winning the Lease through the API server while replica B waits. The Lease stores the holder and renewal time, and the leader performs controller work only while it continues to renew.',
        'The field matrix shows why the object is enough: holderIdentity names the active candidate, renewTime records freshness, leaseDurationSeconds defines when others may treat the holder as stale, and resourceVersion guards concurrent writes.',
        'The failover-clock view shows that failover is delayed on purpose. The system waits for the old lease to expire before another replica takes over. Faster failover requires shorter durations, but shorter durations also increase false loss during pauses or API slowness.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'The safety argument for the claim comes from object-version serialization. If two standbys both try to become leader from the same observed version, at most one update can commit. The other candidate has to reread and see the new holder.',
        'The liveness argument comes from bounded waiting under reasonable timing assumptions. If the leader disappears and stops renewing, the Lease eventually becomes old enough that another replica can acquire it.',
        'The protocol does not make external side effects exactly once. A paused leader, network partition, slow API server, or long-running callback can create a window where old work and new work overlap. The Lease decides leadership; application code still needs idempotency, cancellation, generation checks, or fencing when duplicates would be harmful.',
        'The key invariant is simple: only the process that currently holds a fresh Lease should perform leader-only work. Correct code keeps checking that invariant instead of treating leadership as a startup event.',
      ],
    },
    {
      heading: 'Cost and Tuning',
      paragraphs: [
        'The tuning tradeoff is detection speed versus false loss. A short lease duration detects real failure quickly but is sensitive to API latency, garbage-collection pauses, overloaded nodes, and transient network trouble. A long duration reduces flapping but increases failover time.',
        'The API server becomes the coordination path. Participants read, watch, update, and retry against one Lease object. This is much lighter than a custom consensus service for each controller, but it still depends on API availability and reasonable client backoff.',
        'The controller also pays code complexity. Leader-only loops must check context cancellation or election callbacks, stop cleanly on loss, and avoid long operations that outlive the lease without a later guard.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'A paused leader is the classic failure. Replica A holds the Lease, pauses long enough for B to acquire it, then wakes up. Correct code notices failed renewal or changed holder identity before doing more leader-only writes.',
        'API server slowness can cause false loss. The leader may be healthy but unable to renew in time. Tuning has to leave room for ordinary latency, retries, and clock skew without making real failover too slow.',
        'Split external authority is the hardest case. The Lease can coordinate Kubernetes-visible leadership, but an outside database, cloud API, or billing system may not know which actor is current. External writes need request IDs, version checks, or fencing tokens when duplicate effects are dangerous.',
        'Another failure is background work escaping the election loop. A leader may start goroutines, timers, or async callbacks. If those paths do not observe leadership loss, they can keep acting after the main loop stepped down.',
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        'Lease leader election works well for kube-controller-manager, kube-scheduler, operators, and custom controllers where Kubernetes is already the source of truth. It gives high availability without operating a separate lock service.',
        'It fits reconciliation loops because those loops are already written around current cluster state, retries, and eventual convergence. The Lease chooses which replica drives the loop; the loop should still be idempotent.',
        'It also fits low-throughput singleton tasks where the cost of Lease updates is small compared with the cost of the work being protected. It is not meant to coordinate every request in a hot data path.',
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        'It fails as a complete guarantee for non-idempotent external actions. If the leader writes to an external system that cannot tolerate duplicates, the external write must carry a fence, generation, request id, or compare-and-swap condition accepted by that system.',
        'It fails when leadership is treated as permanent. A replica can lose leadership after startup. Long-running loops, background workers, finalizers, migrations, and callbacks need a way to stop or recheck authority.',
        'It can also be the wrong tool for high-frequency coordination. A Lease is an API object, so frequent updates add API-server load and latency. Use it for coarse leadership, not as a per-item distributed mutex.',
      ],
    },
    {
      heading: 'Concrete Example',
      paragraphs: [
        'Two kube-controller-manager replicas run in a highly available control plane. Replica A holds the controller-manager Lease and reconciles shared controllers. Replica B watches the same Lease and stays ready.',
        'A node failure kills A. B observes that renewTime is too old relative to leaseDurationSeconds, then updates holderIdentity to its own identity using the current resourceVersion. If the update succeeds, B starts reconciling.',
        'If A later returns, it must read or renew the Lease before acting. It sees that B is now the holder and remains standby. If A had started an external cloud operation before the pause, that operation still needs its own idempotency or fencing guard.',
      ],
    },
    {
      heading: 'Sources and Study Next',
      paragraphs: [
        'Primary sources: Kubernetes Leases concept documentation at https://kubernetes.io/docs/concepts/architecture/leases/, Lease API reference at https://kubernetes.io/docs/reference/kubernetes-api/coordination-resources/lease-v1/, and coordinated leader election documentation at https://kubernetes.io/docs/concepts/cluster-administration/coordinated-leader-election/.',
        'Study Kubernetes reconciliation next because leader election only decides who runs the loop. The loop still has to be idempotent, convergent, and safe under retries.',
        'Then study distributed locks, fencing tokens, Raft leader leases, failure detectors, and compare-and-swap registers. Those topics explain why lease protocols are useful, why timing assumptions are risky, and why external side effects need their own protection.',
      ],
    },
  ],
};
