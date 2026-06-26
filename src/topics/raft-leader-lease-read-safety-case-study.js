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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the lease node as cached leadership proof and the apply node as local state freshness. A read is safe only when both are true at the same decision point.',
        'The stale-leader path shows why a local memory read is not enough. If the leader cannot prove the lease is still valid, the safe action is to block or fall back to ReadIndex, which is Raft\'s quorum-confirmed read path.',
        {type:'callout', text:'A lease read is safe only when cached leadership authority and applied-state freshness pass at the same time.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Raft is a consensus algorithm, which means several machines agree on one ordered log even when some messages are delayed or some machines fail. Reads need linearizability: if a write completed before the read began, the read must reflect it.',
        'ReadIndex is the timing-free baseline. The leader contacts a quorum, confirms it is still leader, records the current commit index, waits until local apply index reaches that point, and then returns the value.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to run ReadIndex for every read. It is safe because it uses fresh communication with a quorum instead of trusting clocks.',
        'That cost is visible in a read-heavy control plane. In a 5-node cluster, each ReadIndex read needs acknowledgements from at least 3 voters, so 10,000 reads per second can create about 30,000 quorum-response messages per second before counting normal heartbeats.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is repeated proof. Leadership usually changes rarely, but ReadIndex proves leadership again for every linearizable read.',
        'Removing that proof creates a safety problem. A paused or partitioned leader can wake up after a new election and still have old local state, so a direct local read can return data from a leader that no longer owns the log.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A leader lease is a cached proof that no new leader can exist before a conservative expiration time. The lease duration must be shorter than the election timeout after subtracting a bound for clock drift and scheduling uncertainty.',
        'The lease is only one gate. The leader must also wait until its state machine has applied through the commit index that existed when the read arrived, or it might answer from a stale local snapshot.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'When the leader receives heartbeat acknowledgements from a majority, it records a lease start time on a monotonic clock. It computes lease expiry as start plus a conservative lease duration, commonly election timeout minus a drift margin.',
        'When a read arrives, the leader checks whether now is before lease expiry. If yes, it records readIndex as the current commit index, waits until applyIndex is at least readIndex, and then reads local state; otherwise it falls back to ReadIndex.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument uses majority overlap. The majority that acknowledged the leader lease and the majority needed to elect a new leader share at least one voter, and that voter should not vote for a new leader until its election timer can expire.',
        'The apply-index rule completes the proof. If applyIndex is at least the commit index observed when the read arrived, then every write committed before the read began is present in local state.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A lease read replaces one quorum round trip with local time and apply-index checks. If datacenter RTT is 1 ms, the fast path can remove that millisecond from many reads while keeping normal heartbeat traffic unchanged.',
        'The cost is a timing contract. The implementation needs a monotonic clock, a conservative drift bound, pause awareness, fallback logic, and monitoring for apply lag, because a clock bug can become a stale-read bug.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Leader leases fit read-heavy replicated metadata systems such as etcd-like control planes, TiKV regions, and range-based storage systems. These systems often serve many small reads while writes are still serialized through Raft.',
        'The pattern is useful when a deployment can maintain tight clock and pause assumptions. If that assumption is weak, ReadIndex remains the safer general mechanism.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Lease reads fail when the timing assumptions are false. Bad wall-clock use, large clock drift, long process pauses, or election timeouts below real network delay can make an old leader believe its lease is valid after voters have moved on.',
        'They also fail when teams confuse linearizable reads with stale but consistent reads. A dashboard may tolerate an older value, but lock acquisition, leader election, and configuration changes usually cannot.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use a 5-node cluster with electionTimeout 1000 ms, heartbeat interval 100 ms, and maxClockDrift 50 ms. A leader receives quorum acknowledgement at t=100, so it sets leaseExpiry to 1050 and can serve a read at t=200 if commitIndex is 120 and applyIndex is at least 120.',
        'Now the leader is partitioned at t=300 and cannot renew the lease. At t=1050 it must stop local reads, so if followers elect a new leader around t=1100, a client reaching the old leader at t=1200 gets fallback or failure instead of stale data.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Diego Ongaro and John Ousterhout, In Search of an Understandable Consensus Algorithm, especially the read-only operations discussion; etcd API guarantees; and TiKV lease-read design notes. These sources separate quorum-confirmed reads from lease-optimized reads.',
        'Study Raft leader election, Raft ReadIndex, monotonic clocks, clock drift, fencing tokens, and distributed locks next. The same failure pattern appears whenever a system treats time as authority.',
      ],
    },
  ],
};
