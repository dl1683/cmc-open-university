// Raft log replication: the second half of Raft. The leader's log is the
// truth; followers copy it slot by slot; an entry is COMMITTED once a
// majority holds it — and committed entries can never be lost.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'raft-log-replication',
  title: 'Raft Log Replication',
  category: 'Systems',
  summary: 'How a leader copies its log to followers, when an entry counts as committed, and why committed never un-happens.',
  controls: [
    { id: 'scenario', label: 'Scenario', type: 'select', options: ['steady replication', 'leader crash + conflict'], defaultValue: 'steady replication' },
  ],
  run,
};

const SLOTS = 5;
const SERVERS = ['S1', 'S2', 'S3'];

export function* run(input) {
  const crashy = String(input.scenario) === 'leader crash + conflict';
  if (!['steady replication', 'leader crash + conflict'].includes(String(input.scenario))) {
    throw new InputError('Pick a scenario.');
  }

  // logs[server][slot] = term number (0 = empty)
  const logs = SERVERS.map(() => new Array(SLOTS).fill(0));
  let commitIndex = 0;

  const rows = SERVERS.map((s, i) => ({ id: `s${i}`, label: s }));
  const cols = Array.from({ length: SLOTS }, (_, j) => ({ id: `l${j}`, label: `slot ${j + 1}` }));
  const snapshot = (title) => matrixState({
    title: `${title} — committed through slot ${commitIndex}`,
    rows,
    columns: cols,
    values: logs.map((row) => [...row]),
    format: (v) => (v === 0 ? '·' : `t${v}`),
  });
  const cell = (server, slot) => `s${server}:l${slot}`;

  yield {
    state: snapshot('Three replicated logs, S1 leads (term 2)'),
    highlight: {},
    explanation: 'Raft Leader Election crowned S1 for term 2 — now the actual job: keep three copies of one LOG identical, because every server applies the log in order to build its state (a replicated Write-Ahead Log (WAL)). Each cell is a log slot; t2 will mean "an entry written in term 2".',
  };

  logs[0][0] = 2;
  yield {
    state: snapshot('Client command arrives: SET x=3'),
    highlight: { active: [cell(0, 0)] },
    explanation: 'A client asks the leader to SET x=3. S1 appends it to its OWN log first (slot 1, term 2) — append-only, never overwriting. The client is NOT yet told "done": the entry exists on one machine and would die with it.',
  };

  logs[1][0] = 2;
  logs[2][0] = 2;
  commitIndex = 1;
  yield {
    state: snapshot('AppendEntries fan-out'),
    highlight: { found: [cell(0, 0), cell(1, 0), cell(2, 0)] },
    explanation: 'S1 sends AppendEntries to both followers; each appends slot 1 and acks. The moment a MAJORITY (2 of 3) holds the entry, it is COMMITTED: now — and only now — the client hears "done" and the command is applied. Committed means: any future leader must hold this entry (a majority has it, and elections require a majority — the overlap argument again).',
    invariant: 'Committed entries exist on a majority, so no electable leader can lack them.',
  };

  logs[0][1] = 2;
  logs[1][1] = 2;
  commitIndex = 2;
  yield {
    state: snapshot('SET y=7 — with S3 unreachable'),
    highlight: { found: [cell(0, 1), cell(1, 1)], swap: [cell(2, 1)] },
    explanation: 'Next command, but S3 has gone quiet (network hiccup). No matter: S1 + S2 are already a majority, so slot 2 commits without S3. Stragglers never stall the cluster — that is the availability half of the design (and the CP half of the CAP Theorem when a majority can\'t form).',
  };

  if (!crashy) {
    logs[2][1] = 2;
    yield {
      state: snapshot('S3 returns and catches up'),
      highlight: { active: [cell(2, 1)] },
      explanation: 'S3 reconnects. Every AppendEntries carries a CONSISTENCY CHECK: "my previous entry is (slot 1, term 2) — does yours match?" S3 matches, accepts slot 2, and is identical again. The check runs on every append, so logs can never silently diverge: any mismatch walks backward until the logs agree, then overwrites forward.',
    };

    logs[0][2] = 2; logs[1][2] = 2; logs[2][2] = 2;
    commitIndex = 3;
    yield {
      state: snapshot('Steady state'),
      highlight: { found: SERVERS.map((_, i) => cell(i, 2)) },
      explanation: 'And so it runs: append at the leader, fan out, commit at majority, apply in order. Three machines, one log, one state machine — a database that survives any single failure with zero data loss. This loop, plus the election from Raft Leader Election, is the complete Raft protocol running inside etcd (Kubernetes\' brain), Consul, and CockroachDB.',
    };
    return;
  }

  logs[0][2] = 2;
  yield {
    state: snapshot('S1 appends SET z=1 locally…'),
    highlight: { active: [cell(0, 2)] },
    explanation: 'S1 appends slot 3 to its own log — and CRASHES before telling anyone. Slot 3 lives on one dead machine: appended, but NOT committed. Hold that distinction; it is about to matter.',
  };

  logs[1][2] = 3;
  commitIndex = 2;
  yield {
    state: snapshot('S2 elected leader of term 3'),
    highlight: { active: [cell(1, 2)], swap: [cell(0, 2)] },
    explanation: 'S2 wins the term-3 election (it holds every COMMITTED entry — slots 1–2 — which is all the rules require) and accepts a new command into its slot 3, stamped t3. Note the cluster now contains two different slot-3 entries: S2\'s t3 entry, and the dead S1\'s t2 entry.',
  };

  logs[0][2] = 3;
  logs[2][1] = 2;
  logs[2][2] = 3;
  commitIndex = 3;
  yield {
    state: snapshot('S1 rejoins as follower — conflict resolved'),
    highlight: { found: [cell(0, 2), cell(1, 2), cell(2, 2)] },
    explanation: 'S1 reboots as a follower and receives AppendEntries from leader S2. The consistency check finds the conflict at slot 3: S1\'s old t2 entry does not match the leader\'s t3 entry — so it is DELETED and overwritten. The client whose z=1 was never confirmed simply retries. Uncommitted work can vanish; that is exactly WHY Raft refuses to confirm anything before majority.',
    invariant: 'The leader\'s log is the truth: followers delete conflicting suffixes and adopt the leader\'s entries.',
  };

  yield {
    state: snapshot('All logs identical again'),
    highlight: {},
    explanation: 'The two-tier promise, in one story: COMMITTED entries (majority-held) survived the leader\'s death untouched; the UNCOMMITTED entry evaporated without ever being acknowledged. No client was lied to. That asymmetry — cheap to append, expensive to promise — is the entire art of replicated logs, and you have now seen both halves of Raft.',
  };
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        `Raft log replication is the consensus mechanism that keeps multiple servers holding identical copies of a command log. Unlike raw replication — where a leader just sends "do this" and hopes — Raft proves that once a majority of servers confirm they have stored an entry, no future leader can erase it. The trick: commit only when a majority holds the entry, refuse to commit until then, and always let the leader's log overwrite followers' conflicting entries.`,
        `Every command starts as an entry in the leader's log (stamped with the current term number). It then fans out to followers via AppendEntries messages. The moment a majority acknowledges the append, the entry is COMMITTED — marked safe from loss. Only committed entries are applied to the state machine (the actual database), so clients never see commands that might later vanish. This two-tier model — append anywhere, commit only at majority — is what makes Raft practical: the leader doesn't have to sync every follower before moving on.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `When a client sends a command, the leader appends it to its log first, then sends AppendEntries RPCs to all followers in parallel. Each follower stores the entry and acks. The leader counts acks: when a majority holds the entry, it is COMMITTED and applied to the state machine. The entry survives because any new leader must be elected by a majority, which overlaps with the majority that holds the committed entry.`,
        `Followers lag behind naturally due to slow networks or temporary disconnections. Raft uses a consistency check on every AppendEntries: the leader says "my previous entry is (slot N, term T) — does yours match?" If not, the leader walks backward (like binary search) until logs match, then overwrites the follower's divergent suffix forward. Logs never silently fork — divergence is caught and healed in the next RPC. When a leader crashes, its uncommitted entries are overwritten by the new leader and never applied, so clients must retry.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Every command incurs at least two network round trips: leader appends locally, then sends AppendEntries to followers. Latency is bounded by the slowest majority member — not the slowest single follower. A 3-node cluster tolerates 1 failure; a 5-node cluster tolerates 2 failures. Larger clusters survive more failures but increase the quorum size, making each commit slightly slower. Each server stores the entire log on disk (or in a durable WAL), so memory is linear in command count; logs can grow large and require snapshotting (checkpoint the state machine, discard old log entries) to stay manageable.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Raft powers the consensus layer of etcd (the data store behind Kubernetes — used by millions of clusters worldwide), Consul (HashiCorp's service mesh and secrets system), and CockroachDB (a distributed SQL database). Each of these systems wraps Raft to replicate critical state — etcd stores Kubernetes cluster configuration, Consul stores service discovery and policy, CockroachDB stores sharded SQL data. All three run dozens or hundreds of log entries per second in production, and all three rely on Raft's guarantee that committed entries survive failures.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `A critical mistake: appended is not safe. Raft separates appended (one machine) from committed (majority). Appended entries vanish if the leader crashes before majority confirmation; clients must retry. Another trap: slow followers never stall the cluster — only the majority quorum matters. A stalled node can lag for hours while the cluster moves forward. Finally, Raft does not synchronize clocks or globally order concurrent client writes — it preserves one log order, chosen by the leader's slot assignment, not wall-clock time.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Next, learn Raft Leader Election to see how a new leader is voted in and how logs are synchronized at election time. Understand Write-Ahead Log (WAL) to see how logs are durably stored on disk and replayed after crashes. Study CAP Theorem to understand the trade-off: Raft ensures Consistency and Partition tolerance (CP), sacrificing Availability when a majority can't be reached. Consistent Hashing explains how Raft is often layered with sharding to scale key-value stores. LSM Trees (How Cassandra Writes) covers an alternative append-only log strategy used in high-throughput databases where Raft's strong consistency is traded for availability and write speed.`,
      ],
    },
  ],
};
