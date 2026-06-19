// Two-phase commit: making one transaction land atomically across several
// machines — first everyone PROMISES, then everyone COMMITS. Watch it work,
// then watch its famous flaw: the whole world waits on one coordinator.

import { graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'two-phase-commit',
  title: 'Two-Phase Commit (2PC)',
  category: 'Systems',
  summary: 'Atomic transactions across machines: prepare, vote, commit — and the blocking flaw that motivated consensus.',
  controls: [
    { id: 'scenario', label: 'Scenario', type: 'select', options: ['all vote yes', 'one votes no', 'coordinator crashes'], defaultValue: 'all vote yes' },
  ],
  run,
};

const NODES = [
  { id: 'C', label: 'C', x: 5.0, y: 1.6 },
  { id: 'P1', label: 'pay', x: 1.4, y: 7.0 },
  { id: 'P2', label: 'stock', x: 5.0, y: 8.2 },
  { id: 'P3', label: 'order', x: 8.6, y: 7.0 },
];
const EDGES = [
  { id: 'e1', from: 'C', to: 'P1' },
  { id: 'e2', from: 'C', to: 'P2' },
  { id: 'e3', from: 'C', to: 'P3' },
];
const PARTICIPANTS = ['P1', 'P2', 'P3'];

export function* run(input) {
  const scenario = String(input.scenario);
  if (!['all vote yes', 'one votes no', 'coordinator crashes'].includes(scenario)) {
    throw new InputError('Pick a scenario.');
  }

  const status = new Map([['C', 'coordinator'], ['P1', 'idle'], ['P2', 'idle'], ['P3', 'idle']]);
  let coordinatorAlive = true;
  const snapshot = () => graphState({
    nodes: NODES.filter((n) => n.id !== 'C' || coordinatorAlive).map((n) => ({ ...n, note: status.get(n.id) })),
    edges: coordinatorAlive ? EDGES : [],
  });

  yield {
    state: snapshot(),
    highlight: { active: ['C'] },
    explanation: 'One checkout, three databases: payments must debit, inventory must reserve, orders must create — ALL or NOTHING. On a single machine the Write-Ahead Log (WAL) buys atomicity; across machines, nobody\'s local log can speak for the others. Two-phase commit appoints a COORDINATOR (C) to orchestrate a distributed promise.',
  };

  for (const p of PARTICIPANTS) status.set(p, 'preparing…');
  yield {
    state: snapshot(),
    highlight: { active: EDGES.map((e) => e.id), compare: PARTICIPANTS },
    explanation: 'PHASE 1 — PREPARE: C asks every participant "can you commit this?" Each one does the actual work, writes it durably to its own WAL, LOCKS the affected rows… but does not finalize. A YES vote is a binding promise: "I am now ABLE to commit, and will hold this state until you decide."',
    invariant: 'A participant that votes YES must be able to commit even if it crashes and recovers (its WAL guarantees this).',
  };

  if (scenario === 'one votes no') {
    status.set('P1', 'voted YES ✓');
    status.set('P2', 'voted NO ✗');
    status.set('P3', 'voted YES ✓');
    yield {
      state: snapshot(),
      highlight: { swap: ['P2'], found: ['P1', 'P3'] },
      explanation: 'The votes arrive: payments YES, orders YES… but inventory votes NO — the last unit just sold out. Unanimity failed, and 2PC requires ALL yes votes.',
    };
    for (const p of PARTICIPANTS) status.set(p, 'rolled back');
    yield {
      state: snapshot(),
      highlight: { active: EDGES.map((e) => e.id) },
      explanation: 'PHASE 2 — ABORT: C broadcasts the decision; every participant undoes its prepared work via its WAL and releases its locks. The customer sees one clean "out of stock" — never a charged card with no order. Atomicity held; the transaction just answered "no".',
    };
    return;
  }

  for (const p of PARTICIPANTS) status.set(p, 'voted YES ✓');
  yield {
    state: snapshot(),
    highlight: { found: PARTICIPANTS },
    explanation: 'All three vote YES. Every participant is now PREPARED: work written, locks held, fate suspended. Only one thing remains — the coordinator\'s decision, which it writes to its OWN log first (the decision itself must survive a crash).',
  };

  if (scenario === 'coordinator crashes') {
    coordinatorAlive = false;
    for (const p of PARTICIPANTS) status.set(p, 'BLOCKED ⏳');
    yield {
      state: snapshot(),
      highlight: { swap: PARTICIPANTS },
      explanation: '⚡ C crashes after collecting the votes but BEFORE broadcasting a decision. Now witness 2PC\'s famous flaw: the participants are STUCK. Commit on their own? Maybe C decided abort. Abort on their own? Maybe C decided commit and told someone. They can do nothing — holding locks, blocking every other transaction that touches those rows — until C recovers and reads its log.',
      invariant: 'Prepared participants cannot decide unilaterally — that is precisely what makes 2PC correct, and what makes it BLOCKING.',
    };
    yield {
      state: snapshot(),
      highlight: {},
      explanation: 'This blocking is why 2PC is treated with caution: one machine\'s nap halts many. The fixes shape modern infrastructure — replicate the COORDINATOR\'S decision with consensus so a backup can answer (Raft Log Replication: Spanner and CockroachDB run 2PC over Raft groups), or sidestep atomic commits entirely with SAGAS: a chain of local transactions plus compensating undo actions, the standard microservices answer. Compare the CAP Theorem: 2PC chooses consistency and pays in availability.',
    };
    return;
  }

  for (const p of PARTICIPANTS) status.set(p, 'committed ✓');
  yield {
    state: snapshot(),
    highlight: { active: EDGES.map((e) => e.id), found: PARTICIPANTS },
    explanation: 'PHASE 2 — COMMIT: C logs "commit", then broadcasts it. Each participant finalizes its prepared work and releases its locks. All three databases changed as one: the card was charged, the unit reserved, the order created — atomically, across machines.',
  };

  yield {
    state: snapshot(),
    highlight: { found: ['C', ...PARTICIPANTS] },
    explanation: 'That is 2PC at its best: two network round-trips buy cross-machine atomicity, and it powers XA transactions in relational databases and distributed SQL engines to this day. But re-run this with "coordinator crashes" before trusting it everywhere — the failure mode, not the happy path, is why consensus protocols and sagas exist.',
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        `The node labeled C is the coordinator. The three lower nodes (pay, stock, order) are participants, each owning a separate database. Edges represent network messages between coordinator and participants.`,
        `When edges light up, the coordinator is sending PREPARE requests (phase 1) or COMMIT/ABORT decisions (phase 2). When participant nodes show "voted YES" or "voted NO," that participant has written its vote durably and replied. "committed" means the participant finalized its local work and released locks.`,
        `Run the "coordinator crashes" scenario to see the blocking problem. The coordinator disappears, participants show "BLOCKED," and no edges remain. Those participants are holding locks on real rows with no way to learn the outcome. That frozen state is 2PC's defining tradeoff.`,
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `A single database gets atomicity from its write-ahead log: if the process crashes, recovery replays the log and either finishes the transaction or rolls it back. One log, one decision, no ambiguity.`,
        `Distributed transactions break that model. A checkout might debit a card in one database, reserve inventory in another, and create an order in a third. The customer expects one outcome: all three effects persist, or none of them do. But no single log spans all three machines.`,
        `Jim Gray formalized this problem in his 1978 paper "Notes on Data Base Operating Systems." The question is not how to prevent failures; it is how to prevent partial success. Two-phase commit is the protocol that provides an all-or-nothing boundary across machines that share no disk, no lock manager, and no write-ahead log.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The simplest idea is to commit each service in sequence: payment commits, then inventory commits, then orders commits. If everything works, the result looks atomic. Teams reach for this because it avoids any coordination protocol.`,
        `The problem surfaces on the unhappy path. If payment commits but the inventory service crashes, the system has charged a card for stock it cannot reserve. Reversing a committed transaction from another service is not a database operation. It is ad-hoc compensation that each pair of services must invent and maintain separately.`,
        `A slightly better idea: ask each service "are you ready?" before telling anyone to commit. That sounds like coordination, but it fails without durability. A service that says "yes" from memory can crash and forget what it promised. When it reboots, the coordinator believes it agreed, but the service has no record of the agreement. A volatile promise is a handshake, not a protocol.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `Sequential commits fail because a committed effect cannot be unseen. Once payment has committed, the charge is visible to downstream systems and to the customer. If a later participant fails, there is no general way to "uncommit" the earlier one.`,
        `Asking "are you ready?" fails because volatile readiness does not survive crashes. The coordinator records a yes, the participant reboots, and their states disagree. The gap between "I said yes" and "I can still act on yes after a crash" is where correctness breaks.`,
        `The wall is the combination of these two facts: effects become visible on commit, and promises must survive crashes. Any protocol that solves distributed atomicity must make participants promise durably before any of them commit, and must centralize the final decision so that no participant can unilaterally contradict it.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Phase 1 is prepare. The coordinator sends a PREPARE message to every participant. Each participant checks constraints, performs the local work (inserts, updates, deletes), writes undo and redo information to its own write-ahead log, holds locks on all affected rows, and replies YES or NO.`,
        `A YES vote is a durable promise: "I have done the work, written it to my log, and I am able to commit or abort this transaction even if I crash and recover." A NO vote means the participant cannot complete its part, and the transaction must abort.`,
        `Phase 2 is the decision. If every participant voted YES, the coordinator force-writes a commit record to its own log and broadcasts COMMIT to all participants. If any participant voted NO, timed out, or failed to respond, the coordinator force-writes an abort record and broadcasts ABORT. Each participant then finalizes (commit or rollback), releases its locks, and acknowledges completion.`,
        `Recovery follows the logs. A participant that finds a prepared-but-unresolved transaction in its log contacts the coordinator to learn the decision. A coordinator that finds a decision record re-sends it. Repeating COMMIT or ABORT is safe because the action is idempotent. The protocol never changes a decision once it is logged.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Atomicity rests on two durable facts lining up. First, every YES-voting participant has written enough state to its WAL that it can commit later, even after a crash. Second, the coordinator logs exactly one decision before telling anyone to act on it.`,
        `If commit is logged, every prepared participant can finish because its WAL contains the redo information. If commit is not logged (because some participant voted NO, or prepare never completed), abort is safe because no participant has finalized yet. The prepare phase moves participants to a state where they can go either way; the decision phase resolves the ambiguity exactly once.`,
        `The unanimity requirement is not majority rule. Atomic commit means all-or-nothing. If even one participant cannot commit, forcing the others to commit would break the transaction. A single NO vote must abort the entire transaction because the alternative is partial success, which is the exact problem 2PC exists to prevent.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `The protocol costs two coordinator round trips and 4n messages for n participants: n PREPARE messages, n votes back, n COMMIT/ABORT messages, n acknowledgments. Each round trip includes a forced log write (fsync) at the coordinator and at each participant, so latency is dominated by disk flush time, not network time.`,
        `The larger cost is lock duration. Prepared rows, unique keys, inventory counts, and account balances are locked from the moment the participant votes YES until it receives the phase 2 decision and finalizes. Every unrelated transaction that touches those rows blocks for the entire window.`,
        `2PC is a blocking protocol. If the coordinator crashes after collecting YES votes but before broadcasting the decision, every prepared participant is stuck. It cannot commit (maybe the coordinator decided abort) and cannot abort (maybe the coordinator decided commit and told someone else). The participants hold locks and wait for the coordinator to recover. One machine's downtime becomes every participant's outage.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Distributed databases use 2PC for cross-shard commits. MySQL supports XA transactions (xa_prepare, xa_commit, xa_rollback). PostgreSQL supports PREPARE TRANSACTION for explicit two-phase commits. Oracle, SQL Server, and DB2 implement the XA interface, making 2PC the standard mechanism for enterprise distributed transactions.`,
        `Message queue plus database coordination is a classic use case: dequeue a message and insert a row atomically, so the message is consumed if and only if the database write commits. Without 2PC, the system either loses messages (dequeue then crash before insert) or processes them twice (insert then crash before dequeue acknowledgment).`,
        `Financial transactions that must maintain hard invariants across systems (debit one account, credit another across different banks or ledgers) rely on 2PC or protocols built on top of it. The protocol works best with a small number of participants, short transactions, and predictable storage latency.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `The blocking problem is the defining weakness. When the coordinator is unreachable, prepared participants hold locks indefinitely. In production, this means orphaned prepared transactions that block all conflicting work. Database administrators need monitoring, timeouts, and manual xa_recover cleanup tools to handle this failure mode.`,
        `Three-phase commit (3PC), proposed by Skeen in 1981, adds a PRE-COMMIT phase so that surviving participants can decide without the coordinator. But 3PC breaks under network partitions: if one side saw PRE-COMMIT and the other did not, the two halves make opposite decisions. Partitions are more common than clean crashes, so 3PC is rarely deployed.`,
        `The real fix for blocking is to replicate the coordinator's decision using a consensus protocol. Spanner runs 2PC where the coordinator is a Paxos group, so a backup can answer if the leader fails. CockroachDB and TiDB do the same with Raft. This eliminates the single point of failure but adds quorum latency.`,
        `For long-running workflows, 2PC is the wrong tool entirely. Holding locks across services for minutes or hours is not viable. The Saga pattern commits each local step immediately and runs compensating actions if a later step fails. Sagas give up strict atomic visibility but avoid the lock-holding problem. 2PC and sagas solve different problems: 2PC guarantees atomicity over short database operations; sagas manage eventual consistency over long business processes.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `A customer checks out with one item. Three databases are involved: payment (card charge), stock (inventory reservation), and order (order record). The coordinator begins by sending PREPARE to all three.`,
        `Success case: Payment writes a pending $50 debit to its WAL, locks the customer's balance row, votes YES. Stock writes a pending reservation for item #4412, locks the inventory count row, votes YES. Order writes a pending order record, locks the order ID sequence, votes YES. The coordinator receives three YES votes, force-writes "commit" to its own log, then broadcasts COMMIT. Each participant finalizes its pending write, releases locks, and acknowledges. The customer sees one confirmation. Three databases changed as one.`,
        `Abort case: Same setup, but stock discovers item #4412 is out of stock during prepare. Stock votes NO. The coordinator does not wait for unanimity it will never get. It force-writes "abort" to its log and broadcasts ABORT. Payment rolls back the pending debit and releases the balance lock. Order rolls back the pending record. The customer sees one clean "out of stock" error. No card was charged, no phantom order exists.`,
        `Blocking case: All three vote YES. The coordinator crashes before writing or broadcasting a decision. Payment, stock, and order are each holding locks on rows they prepared. They cannot commit (maybe the coordinator decided abort before crashing). They cannot abort (maybe the coordinator wrote commit and sent it to one participant before crashing). They wait, holding locks, blocking every other transaction that touches those rows, until the coordinator recovers and reads its log.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Jim Gray, "Notes on Data Base Operating Systems," 1978 -- the original formalization of 2PC within transaction processing theory. Skeen, "Nonblocking Commit Protocols," 1981 -- introduces 3PC and proves that no deterministic protocol can be both non-blocking and safe under arbitrary failures. Lamport and Gray, "Consensus on Transaction Commit," 2004 -- Paxos commit, the fault-tolerant alternative to a single coordinator.`,
        `Prerequisite: Write-Ahead Log (WAL) -- 2PC's prepared promises survive crashes only because the WAL makes them durable. Understand WAL mechanics before reasoning about recovery.`,
        `Consensus protocols: Raft and Paxos -- these are how production systems replicate the coordinator's decision so blocking disappears. Spanner (Corbett et al., OSDI 2012) runs 2PC over Paxos groups with TrueTime for globally ordered timestamps.`,
        `Concurrency control: MVCC (Multi-Version Concurrency Control) -- understand what happens to readers while 2PC holds locks on prepared rows. MVCC lets reads proceed against older snapshots, but the interaction with prepared-but-uncommitted transactions is subtle.`,
        `Alternatives: Saga pattern for long-running workflows where holding locks across services is unacceptable. CAP Theorem for the theoretical backdrop -- 2PC chooses consistency over availability when the coordinator is unreachable.`,
      ],
    },
  ],
};
