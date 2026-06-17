// Raft leader-lease reads: avoid a quorum round trip only when timing, election
// lease, commit index, and apply index prove the leader cannot be stale.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'raft-leader-lease-read-safety-case-study',
  title: 'Raft Leader Lease Read Safety',
  category: 'Systems',
  summary: 'How Raft systems trade ReadIndex quorum checks for leader leases with lease start, clock-drift bounds, commit index, apply index, and stale-leader hazards.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['lease read', 'stale leader'], defaultValue: 'lease read' },
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
      { id: 'client', label: 'client', x: 0.5, y: 4.2, note: notes.client ?? 'read' },
      { id: 'leader', label: 'leader', x: 2.1, y: 4.2, note: notes.leader ?? 'term 9' },
      { id: 'quorum', label: 'quorum', x: 3.7, y: 5.4, note: notes.quorum ?? 'acks' },
      { id: 'lease', label: 'lease', x: 3.7, y: 3.0, note: notes.lease ?? 'valid' },
      { id: 'commit', label: 'commit', x: 5.4, y: 5.4, note: notes.commit ?? 'index' },
      { id: 'apply', label: 'apply', x: 5.4, y: 3.0, note: notes.apply ?? 'state' },
      { id: 'clock', label: 'clock', x: 7.0, y: 3.0, note: notes.clock ?? 'drift' },
      { id: 'read', label: 'read', x: 8.4, y: 4.2, note: notes.read ?? 'serve' },
      { id: 'safe', label: 'safe', x: 9.6, y: 4.2, note: notes.safe ?? 'linear' },
    ],
    edges: [
      { id: 'e-client-leader', from: 'client', to: 'leader', weight: '' },
      { id: 'e-leader-quorum', from: 'leader', to: 'quorum', weight: '' },
      { id: 'e-quorum-lease', from: 'quorum', to: 'lease', weight: '' },
      { id: 'e-quorum-commit', from: 'quorum', to: 'commit', weight: '' },
      { id: 'e-lease-clock', from: 'lease', to: 'clock', weight: '' },
      { id: 'e-commit-apply', from: 'commit', to: 'apply', weight: '' },
      { id: 'e-apply-read', from: 'apply', to: 'read', weight: '' },
      { id: 'e-clock-read', from: 'clock', to: 'read', weight: '' },
      { id: 'e-read-safe', from: 'read', to: 'safe', weight: '' },
    ],
  }, { title });
}

function* leaseRead() {
  yield {
    state: leaseGraph('ReadIndex confirms leadership with a quorum before serving a read'),
    highlight: { active: ['client', 'leader', 'quorum', 'commit', 'apply', 'e-client-leader', 'e-leader-quorum'], compare: ['lease'] },
    explanation: 'A conservative Raft linearizable read asks the leader to prove it is still leader through the quorum path, then waits until the state machine has applied the relevant index.',
    invariant: 'A read is safe only after leadership and applied-state freshness are both established.',
  };

  yield {
    state: leaseGraph('A leader lease caches recent quorum authority', { lease: 'fresh', read: 'fast path' }),
    highlight: { active: ['quorum', 'lease', 'clock', 'read', 'e-quorum-lease', 'e-lease-clock', 'e-clock-read'], compare: ['commit'] },
    explanation: 'A lease read tries to avoid a quorum round trip for every read. The leader can serve locally only while the lease is known to be valid under the system clock assumptions.',
  };

  yield {
    state: labelMatrix(
      'Read paths',
      [
        { id: 'log', label: 'log read' },
        { id: 'readindex', label: 'ReadIndex' },
        { id: 'lease', label: 'lease' },
        { id: 'serial', label: 'stale ok' },
      ],
      [
        { id: 'cost' },
        { id: 'risk' },
      ],
      [
        ['append', 'slow'],
        ['quorum', 'RTT'],
        ['local', 'clock'],
        ['local', 'stale'],
      ],
    ),
    highlight: { active: ['readindex:cost', 'lease:cost'], compare: ['lease:risk', 'serial:risk'] },
    explanation: 'The read options trade latency for assumptions. Appending a read is safest but slowest. ReadIndex avoids log writes. Lease reads are fastest, but only under carefully bounded timing.',
  };

  yield {
    state: leaseGraph('The apply index still gates the local read', { commit: 'idx 120', apply: 'wait 120', read: 'serve 120' }),
    highlight: { active: ['commit', 'apply', 'read', 'e-commit-apply', 'e-apply-read'], found: ['lease'] },
    explanation: 'Even a valid leader cannot serve from state that has not applied the committed index the read depends on. The local state machine must catch up before returning.',
  };

  yield {
    state: leaseGraph('The complete fast path is leader lease plus apply wait', { client: 'GET key', lease: 'not expired', clock: 'bounded', apply: 'caught up', safe: 'linear' }),
    highlight: { active: ['client', 'leader', 'lease', 'clock', 'commit', 'apply', 'read', 'safe'], found: ['quorum'] },
    explanation: 'A control-plane read can use the lease fast path when the leader recently renewed authority, the local clock assumptions still hold, and the state machine has applied far enough.',
  };
}

function* staleLeader() {
  yield {
    state: leaseGraph('A partitioned old leader may still receive client reads', { leader: 'old term', quorum: 'lost', lease: 'expired?', safe: 'unsafe' }),
    highlight: { active: ['client', 'leader', 'lease'], removed: ['quorum', 'safe'] },
    explanation: 'The stale-leader problem is the reason lease reads are delicate. A leader that cannot contact a quorum may still be alive and serving clients unless the read path blocks.',
    invariant: 'A lease is a proof with an expiration, not a feeling that leadership probably remains true.',
  };

  yield {
    state: leaseGraph('Clock drift can turn a lease into a stale-read bug', { clock: 'fast/slow', lease: 'ambiguous', read: 'wrong?' }),
    highlight: { active: ['lease', 'clock', 'read', 'e-lease-clock', 'e-clock-read'], compare: ['quorum'] },
    explanation: 'Lease algorithms depend on clock assumptions. If a node measures time incorrectly relative to the lease proof, it can believe the lease is valid after the cluster has moved on.',
  };

  yield {
    state: labelMatrix(
      'Hazards',
      [
        { id: 'pause', label: 'GC pause' },
        { id: 'drift', label: 'drift' },
        { id: 'partition', label: 'partition' },
        { id: 'lag', label: 'apply lag' },
      ],
      [
        { id: 'failure' },
        { id: 'guard' },
      ],
      [
        ['wakes stale', 'lease age'],
        ['bad time', 'drift bound'],
        ['no quorum', 'step down'],
        ['old state', 'wait apply'],
      ],
    ),
    highlight: { active: ['pause:guard', 'partition:guard', 'lag:guard'], compare: ['drift:failure'] },
    explanation: 'A correct design names the hazards explicitly: process pauses, clock drift, network partitions, and state-machine apply lag. Each needs a guard, not a hopeful comment.',
  };

  yield {
    state: leaseGraph('Falling back to ReadIndex repairs uncertainty', { quorum: 'check now', lease: 'unknown', read: 'after ack', safe: 'linear' }),
    highlight: { active: ['leader', 'quorum', 'commit', 'apply', 'read', 'safe', 'e-leader-quorum'], compare: ['clock'] },
    explanation: 'When the lease proof is missing, expired, or ambiguous, the safe fallback is the quorum-backed read path. That is the baseline lease reads must preserve.',
  };

  yield {
    state: leaseGraph('The complete incident is a paused leader and a quick election', { leader: 'paused', quorum: 'new leader', lease: 'old', clock: 'expired', read: 'block' }),
    highlight: { active: ['leader', 'quorum', 'lease', 'clock', 'read'], removed: ['safe'] },
    explanation: 'A leader pauses long enough for followers to elect a replacement. When it resumes, its lease has expired, so local reads block or use ReadIndex instead of serving stale data.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'lease read') yield* leaseRead();
  else if (view === 'stale leader') yield* staleLeader();
  else throw new InputError('Pick a Raft lease-read view.');
}

export const article = {
  sections: [
    {
      heading: 'Why It Exists',
      paragraphs: [
        `Raft gives a replicated system a single ordered log, but reads still need care. A client asking the leader for the current value wants a linearizable answer: if a write completed before the read began, the read must reflect it.`,
        `The simplest safe read path asks a quorum to confirm that the node is still leader, then waits until the local state machine has applied the relevant committed index. That is correct, but it puts a quorum round trip on a path that may be called thousands of times per second.`,
        `Leader-lease reads exist to remove that round trip when the system can prove, for a bounded interval, that no newer leader can have been elected. The technique is a performance optimization around a safety proof, not a shortcut around Raft.`,
      ],
    },
    {
      heading: 'The Obvious Approach and the Wall',
      paragraphs: [
        `The obvious safe approach is ReadIndex: prove current leadership through a quorum for the read and wait for local apply. It is easy to defend because it depends on fresh communication instead of timing assumptions.`,
        `The obvious fast approach is to read directly from the leader's memory. That is unsafe. A process can pause, lose its lease, miss an election, resume, and still believe it is the leader if the read path does not force it to check.`,
        `The wall is time. A lease-read design must account for election timeout, heartbeat timing, clock drift, process pauses, message delay, and state-machine apply lag. If those assumptions are not explicit, the system is guessing.`,
      ],
    },
    {
      heading: 'The Core Insight',
      paragraphs: [
        `A leader lease is a cached proof of leadership. A recent quorum interaction establishes that the leader was recognized by enough voters at a known local time. For a carefully bounded interval after that point, the leader can infer that a different leader could not yet have been elected.`,
        `That proof handles only leadership freshness. A safe read also needs state freshness: the local state machine must have applied at least the committed index that the read depends on. A valid leader with an old apply index can still return stale data.`,
        `The mental model is two gates, not one. The lease gate says "this node is still allowed to answer as leader." The apply gate says "this node's local state is caught up enough to answer this read."`,
      ],
    },
    {
      heading: 'Reading the Lease Trace',
      paragraphs: [
        `Use the "lease read" view to follow the fast path. The leader first obtains quorum authority, records the lease interval, checks the clock bound, waits for the apply index, and only then serves the client. The read is fast because the quorum proof was paid for earlier, not because proof is unnecessary.`,
        `Use the "stale leader" view as the failure case. The old leader can be alive, reachable by a client, and wrong. The important frames are the ones where quorum is lost, the lease becomes ambiguous or expired, and the system falls back to ReadIndex or blocks instead of returning local state.`,
        `When reading the trace, separate the two questions shown in the graph: "May this node still act as leader?" and "Has this node applied the state needed by the read?" A correct implementation has to answer both yes.`,
      ],
    },
    {
      heading: 'How It Works',
      paragraphs: [
        `The conservative baseline is ReadIndex. The leader contacts a quorum, confirms it is still leader in its term, obtains or confirms a read index, and waits until its state machine has applied through that index before serving the read.`,
        `A lease read moves the quorum check out of the individual read. The leader starts or renews a lease when it receives quorum acknowledgement under the protocol's timing rules. Until that lease expires, it may serve eligible reads locally.`,
        `The implementation still checks the local apply index. If the read depends on commit index 120 and the state machine has applied only through 118, the leader waits. Serving from unapplied state would violate linearizability even if leadership is fresh.`,
        `If the lease proof is missing, expired, or made suspicious by timing uncertainty, the read path falls back to ReadIndex. The fallback is part of the design; it is how the fast path preserves the same external contract as the slow path.`,
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        `Raft safety depends on there being at most one leader whose log can make progress in a term. A lease-read proof extends that idea to reads by showing that, during the lease interval, a quorum cannot have elected and accepted a newer leader.`,
        `The proof depends on overlap. The leader's lease was established through voters that would also be needed to elect another leader. If those voters cannot legally vote for a new leader before the lease interval expires, the old leader can safely answer reads during that interval.`,
        `The apply-index check completes the argument. The lease says the leader is still authoritative; the apply index says the local state machine includes all committed writes before the read boundary. Linearizable reads require both facts.`,
      ],
    },
    {
      heading: 'Worked Case Study',
      paragraphs: [
        `Consider a Kubernetes-style control plane backed by a Raft store. The API server issues many small reads for objects, leases, and coordination keys. A quorum round trip for every linearizable read would add latency and load to the hottest path.`,
        `The leader renews authority through heartbeats and tracks a conservative lease interval. A read arriving during that interval can use the local fast path only after the state machine has applied through the read's required index. Followers redirect or ask the leader for a safe read path.`,
        `Now add a long pause. The leader stops sending heartbeats, followers elect a replacement, and clients can still reach the old process when it wakes up. The old process must notice that its lease is expired or uncertain. If it serves from memory anyway, it can return a value older than a write already accepted by the new leader.`,
      ],
    },
    {
      heading: 'Costs and Tradeoffs',
      paragraphs: [
        `The benefit is latency and load reduction. A valid lease lets the leader serve many reads without sending each one through the quorum path.`,
        `The cost is a timing contract. The system must choose lease durations with room for clock drift, scheduling pauses, network delay, and election timing. It must also keep enough instrumentation to detect apply lag and lease uncertainty.`,
        `Lease reads make the read path more subtle than ReadIndex. The code has to be conservative about when the lease starts, when it expires, what clock it trusts, and when it must fall back. A small off-by-one in time can become a consistency bug.`,
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        `Lease reads win in read-heavy replicated metadata systems where most reads go to the leader, writes are still ordered by Raft, and the deployment can keep tight bounds on clock drift and pauses.`,
        `They are especially useful for control-plane databases where linearizable reads matter but the workload is dominated by small lookups. The optimization turns repeated "prove you are leader" checks into a bounded cached proof.`,
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        `They fail when timing assumptions are weak. Unbounded process pauses, bad clocks, overloaded event loops, long garbage-collection stops, or unclear election timing can make a lease proof impossible to defend.`,
        `They also fail when teams treat serializable stale reads and linearizable reads as interchangeable. A stale read can be useful for caches and monitoring. It is not safe for decisions that require the latest committed state.`,
        `When in doubt, use ReadIndex or another quorum-backed read path. Slower reads are cheaper than a system that sometimes answers from a dead leader.`,
      ],
    },
    {
      heading: 'Sources and Study Next',
      paragraphs: [
        'Primary sources: etcd API guarantees at https://etcd.io/docs/v3.5/learning/api_guarantees/, etcd Raft package documentation at https://pkg.go.dev/go.etcd.io/raft/v3, the Raft extended paper at https://raft.github.io/raft.pdf, and TiKV lease-read implementation discussion at https://tikv.org/blog/lease-read/.',
        'Study Raft ReadIndex Case Study, Raft Leader Election, Clocks & Ordering, NTP & PTP, Fencing Token Zombie Writer, and Distributed Locks next.',
      ],
    },
  ],
};
