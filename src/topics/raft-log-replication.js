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
      heading: `Why this exists`,
      paragraphs: [
        `Leader election chooses who may accept writes, but it does not by itself protect the writes. If the leader appends a client command locally and crashes before anyone else stores it, the command can disappear. A replicated system must decide when a command is durable enough to tell the client "done."`,
        `Raft log replication solves that problem by turning client commands into an ordered log copied across a majority of servers. The log is the input to a deterministic state machine. If every server applies the same committed log entries in the same order, they end in the same state.`,
      ],
    },
    {
      heading: `Context`,
      paragraphs: [
        `Raft is a consensus protocol for replicated state machines. One server is leader for a term. Followers accept log entries from that leader. Elections use majorities, and replication commits entries with majorities. The repeated majority intersection is the safety backbone of the protocol.`,
        `The topic builds on Raft Leader Election and Write-Ahead Logs. Election explains who gets authority. The log explains what gets copied. Replication explains when copied commands become permanent enough to apply and acknowledge.`,
      ],
    },
    {
      heading: `The obvious approach and the wall`,
      paragraphs: [
        `Acknowledging after the leader's local append is fast and unsafe. The only copy might be on a machine that dies. The next leader may never see it, so the system would have promised durability it did not have.`,
        `Waiting for every follower is safe but too brittle. A three-node cluster would stop if one follower is slow. A five-node cluster would stop if any one of five is unreachable. Raft chooses the middle rule: wait for a majority, because a majority is enough to overlap with every future majority election.`,
      ],
    },
    {
      heading: `Core insight`,
      paragraphs: [
        `A log entry becomes committed when the leader knows a majority stores it. Majority is the threshold that makes the entry unavoidable for future leaders. In a three-node cluster, two copies are enough. In a five-node cluster, three copies are enough.`,
        `Each entry has an index and a term. AppendEntries carries the previous log index and previous log term. A follower accepts the append only if that previous entry matches its own log. This small consistency check is what lets Raft repair divergent followers one suffix at a time.`,
        `The invariant is that committed log prefixes never move backward. Followers may delete uncommitted suffixes, but once an entry is committed, future leaders must preserve it and state machines apply it in order.`,
      ],
    },
    {
      heading: `Mechanism`,
      paragraphs: [
        `A client sends a command to the leader. The leader appends the command to its local log, sends AppendEntries RPCs to followers, and tracks each follower's matchIndex. When an entry from the leader's current term is stored on a majority, the leader advances commitIndex and applies committed entries to the state machine in order.`,
        `If a follower rejects AppendEntries because the previous index and term do not match, the leader decreases that follower's nextIndex and tries an earlier prefix. Once the leader finds a shared prefix, the follower deletes its conflicting suffix and copies the leader's entries forward.`,
      ],
    },
    {
      heading: `Worked example`,
      paragraphs: [
        `In the steady scenario, S1 leads in term 2. It appends SET x=3 in slot 1, sends it to S2 and S3, and commits when a majority has it. Then S3 drops out. S1 can still commit SET y=7 with S2 because two out of three is a majority. When S3 returns, the previous-index and previous-term check lets it catch up from the last matching slot.`,
        `In the crash scenario, S1 appends a slot 3 entry but crashes before a majority stores it. S2 becomes leader in term 3 and writes a different slot 3 entry. When S1 returns, its old uncommitted suffix is overwritten. That is safe because the client was never told the old slot 3 entry had committed.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `The majority argument is the main proof idea. A committed entry sits on some majority. A future leader must win votes from some majority. Those two majorities overlap in at least one server. Raft's voting rules require a candidate's log to be at least as up to date as the voter, so a leader missing committed history should not be elected.`,
        `The log-matching property is the repair idea. If two logs contain the same term at the same index, Raft treats the prefix before that entry as the same history. The leader only extends followers from a matching prefix. Everything after a mismatch is uncommitted or stale follower history and can be replaced by the leader's log.`,
      ],
    },
    {
      heading: `Animation notes`,
      paragraphs: [
        `In the steady replication scenario, read each row as one server's log and each column as a log index. The highlight on slot 1 shows the moment a client command changes from "stored on the leader" to "committed by a majority." The later S3 catch-up frame teaches that a missing follower is debt, not permanent divergence.`,
        `In the leader crash scenario, focus on slot 3. The t2 entry on S1 is only local, so it can be replaced. The t3 entry from S2 is the new leader's truth once it reaches a majority. The contrast is the main Raft lesson: committed entries survive leadership changes; uncommitted suffixes are allowed to vanish.`,
      ],
    },
    {
      heading: `Cost and tradeoffs`,
      paragraphs: [
        `After a client reaches the leader, commit latency is roughly one leader-to-majority round trip plus local durability work if the implementation persists before acknowledging. A three-node group waits for two copies and tolerates one failure. A five-node group waits for three copies and tolerates two failures.`,
        `Slow followers do not stop progress unless they are needed for a majority, but they create catch-up debt. The leader must retain log history or snapshots long enough to repair them. Replication traffic, snapshot transfer, and disk pressure can become the real operating limits.`,
      ],
    },
    {
      heading: `Limits and failure modes`,
      paragraphs: [
        `Raft log replication gives one ordered state machine per consensus group. It does not automatically give multi-object SQL transactions across many groups. A database may still need Two-Phase Commit, transaction coordinators, timestamp ordering, or another layer above Raft when one user transaction spans several replicated ranges.`,
        `Raft also assumes crash failures, not Byzantine behavior. If a server lies, signs conflicting messages, or corrupts state in adversarial ways, ordinary Raft is not the right protocol. Byzantine consensus protocols handle a different threat model at higher cost.`,
      ],
    },
    {
      heading: `Failure modes`,
      paragraphs: [
        `The most common misunderstanding is confusing appended with committed. A leader can append an entry locally and lose it. Correct clients treat missing acknowledgements as uncertain and retry through the current leader. Correct systems make operations idempotent or attach client request IDs so retries do not double-apply work.`,
        `Operational failures also matter. A follower can fall so far behind that log replay is too expensive and a snapshot is required. A disk-full server can stop accepting entries. A network partition without a majority must stop committing writes. Those behaviors are not bugs; they are the price of preserving safety.`,
      ],
    },
    {
      heading: `Practical use`,
      paragraphs: [
        `Raft log replication is a good fit for control-plane databases, metadata stores, configuration systems, lease records, and sharded storage ranges that need a clear ordered history. etcd uses Raft for Kubernetes state. Consul, TiKV, CockroachDB-style ranges, and many embedded systems use the same replicated-log pattern.`,
        `When reading a production Raft incident, look for commitIndex, appliedIndex, matchIndex, nextIndex, currentTerm, leader changes, and snapshot progress. Those fields tell you whether the cluster is failing to elect, failing to replicate, failing to apply, or only paying catch-up debt.`,
      ],
    },
    {
      heading: `Implementation guidance`,
      paragraphs: [
        `Persist term, vote, and log entries before depending on them for safety. A follower that acknowledges an entry before durable storage can create a false majority if it crashes and loses the entry.`,
        `Expose replication state directly: commitIndex, appliedIndex, matchIndex, nextIndex, snapshot index, and leader term. These fields let operators distinguish a leader election problem from a slow follower, an apply backlog, or snapshot catch-up.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Primary source: Ongaro and Ousterhout, "In Search of an Understandable Consensus Algorithm" at https://raft.github.io/raft.pdf. Study Raft Leader Election first if voting rules feel mysterious. Then connect Write-Ahead Log, CAP Theorem, Sharding and Partitioning, Two-Phase Commit, Log Compaction, LSM Trees, and etcd-style membership changes next.`,
      ],
    },
  ],
};
