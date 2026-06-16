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
      heading: 'What it is',
      paragraphs: [
        'A Raft leader-lease read is a fast path for linearizable reads. Instead of checking a quorum for every read, the leader relies on a recently established lease proving that no other leader can have been elected yet, then serves from local applied state.',
        'The etcd API guarantees page distinguishes linearizable reads from serializable reads and notes the cost of linearized requests through Raft: https://etcd.io/docs/v3.5/learning/api_guarantees/. The etcd Raft package documents ReadIndex and lease-based linearizable read-only queries: https://pkg.go.dev/go.etcd.io/raft/v3.',
      ],
    },
    {
      heading: 'Core mental model',
      paragraphs: [
        'The data structure is a proof cache. A quorum check creates proof of leadership for a time interval. The leader may reuse that proof only while clock assumptions and election timing guarantee that no newer leader can exist.',
        'The second gate is the apply index. A leader can be legitimate and still serve stale state if its state machine has not applied the committed index needed by the read.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A Kubernetes-style control plane has thousands of small reads. The leader renews authority through heartbeats and tracks a lease interval. Reads on the leader use the lease fast path only while the interval is valid and the apply index has caught up. Followers ask the leader for a safe read index or redirect.',
        'If the leader experiences a long pause, loses quorum, or cannot validate timing, the system falls back to ReadIndex. Faster reads are never allowed to weaken the linearizability contract.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not treat leader identity as permanent. A process can pause and resume after another leader has been elected. Do not serve lease reads without a clock-drift and election-time argument.',
        'Do not confuse serializable stale reads with linearizable reads. Some APIs offer both because the cheaper stale path is useful when callers can tolerate older data.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: etcd API guarantees at https://etcd.io/docs/v3.5/learning/api_guarantees/, etcd Raft package documentation at https://pkg.go.dev/go.etcd.io/raft/v3, the Raft extended paper at https://raft.github.io/raft.pdf, and TiKV lease-read implementation discussion at https://tikv.org/blog/lease-read/.',
        'Study Raft ReadIndex Case Study, Raft Leader Election, Clocks & Ordering, NTP & PTP, Fencing Token Zombie Writer, and Distributed Locks next.',
      ],
    },
  ],
};
