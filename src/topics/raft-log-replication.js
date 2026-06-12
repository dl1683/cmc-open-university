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
      heading: `What it is`,
      paragraphs: [
        `Raft log replication is how a leader turns client commands into the same ordered history on several machines. Raft Leader Election chooses who may assign positions; replication proves which positions survive crashes. Each command becomes a log entry with an index and term. Followers append the leader's entries, and once a majority stores an entry, the leader can commit it and apply it to the state machine.`,
        `The safety promise is subtle: a committed entry will appear in the logs of all future leaders. Majority overlap is the reason. If entry 57 is stored on 3 of 5 servers, any later leader also needs 3 votes, and those two sets overlap. Raft's voting rules require the new leader's log to be at least as up to date as voters' logs, so committed entries cannot be silently lost.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `When a client sends a command, the leader appends it locally, then sends AppendEntries RPCs to followers in parallel. Each RPC includes the previous log index and term. A follower accepts the new entry only if its own previous slot matches; otherwise it rejects, and the leader decrements nextIndex for that follower until it finds the matching prefix. Some implementations optimize this catch-up, but the idea is simple: find the common prefix, delete the follower's conflicting suffix, then copy the leader's entries forward.`,
        `The leader tracks matchIndex for every follower. When a log entry from the leader's current term is stored on a majority, the leader marks it committed and tells followers the commit index in later heartbeats. Older entries become committed as a consequence, but Raft deliberately avoids committing old-term entries by counting replicas alone. That rule prevents a newly elected leader from making unsafe assumptions about entries from previous terms.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `After a client reaches the leader, commit latency is roughly one leader-to-majority round trip plus local disk durability if the implementation fsyncs before acknowledging. A three-node group tolerates one failure; a five-node group tolerates two, but every commit must wait for three replicas instead of two. Logs grow forever unless compacted. Snapshotting writes the current state machine image, records the last included index and term, then discards earlier log entries. Lagging followers may need a snapshot instead of millions of old entries.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `etcd uses Raft logs to replicate Kubernetes configuration. Consul replicates service catalog and key-value metadata. CockroachDB and TiKV run many Raft groups over ranges, combining consensus with Sharding & Partitioning so one database can scale across machines. The storage beneath a Raft log is still a Write-Ahead Log (WAL) or durable append path; consensus decides order, while the local engine ensures crash recovery.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Appended is not committed. A leader can crash after appending locally but before majority replication; the next leader may overwrite that entry, and the client must retry. Slow followers do not stop progress unless they are needed for a majority, but they do create operational debt: snapshots grow, catch-up traffic competes with live writes, and disk-full followers can fall permanently behind. Raft also does not use wall-clock time to order commands. The leader's log index is the order, so Distributed Tracing timestamps can disagree with commit order during retries.`,
        `Raft is consensus, not a transaction protocol by itself. Two-Phase Commit (2PC) may still coordinate a distributed SQL transaction across many Raft groups. Message Queues may use replicated logs too, but they often expose at-least-once delivery rather than a single strongly consistent state machine.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Read Raft Leader Election first if the voting rules feel mysterious. Then connect Write-Ahead Log (WAL), CAP Theorem, and Sharding & Partitioning to understand durability, majority availability, and scale-out. LSM Trees (How Cassandra Writes) shows the local storage path many Raft-backed databases use, while Two-Phase Commit (2PC) explains how transactions can span multiple replicated groups.`,
      ],
    },
  ],
};
