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
      heading: 'What it is',
      paragraphs: [
        `Two-phase commit is a protocol that makes a single atomic transaction span multiple independent machines. Instead of trusting one database's Write-Ahead Log to survive a crash, 2PC orchestrates a promise from every participant: first, they all prepare and lock their changes; second, a central coordinator decides whether to finalize or abort across the board. The result is all-or-nothing atomicity without a single shared log.`,
        `The protocol divides the responsibility: each participant owns its own durability (via its local WAL), but collectively they surrender control to a coordinator. That trade-off — one machine decides for many — is the core insight and the core flaw.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Phase 1 (Prepare): The coordinator sends each participant the same transaction. Each participant executes it, writes the changes durably to its own log, and locks the affected rows. If it can commit, it votes YES; if something fails (disk full, constraint violation, timeout), it votes NO. A YES vote is a binding promise: the participant will honor whatever the coordinator decides, even after a crash and recovery.`,
        `Phase 2 (Commit or Abort): Once the coordinator collects all votes, it checks for unanimity. If all votes are YES, it writes the decision to its own log first (for durability), then broadcasts COMMIT to every participant; each one finalizes the transaction and releases locks. If any participant votes NO, the coordinator broadcasts ABORT, and every participant rolls back its prepared work via the same WAL mechanism that made the promise possible — no data is corrupted, no locks are leaked.`,
        `The beauty is that locks are held for only 2 network round-trips, not indefinitely. The danger is that if the coordinator crashes after collecting the votes but before broadcasting a decision, every prepared participant is deadlocked: commit alone? Maybe the coordinator said abort. Abort alone? Maybe the coordinator said commit and told another participant. They cannot decide; they can only wait, holding locks, blocking every other transaction that needs those rows. A single coordinator nap paralyzes the entire system.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Two-phase commit trades latency and availability for correctness. The minimum cost is 2 round-trips (prepare + commit) plus the time each participant spends executing and locking. If the coordinator fails after votes but before decision, all prepared participants block — their locks hold until the coordinator recovers, sometimes for minutes or hours if recovery is slow. In a busy system, locked rows cascade into cascading blocked transactions, turning a single machine's outage into a cascade. This is why 2PC is called blocking and why it is treated with caution in systems that value high availability.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `XA transactions in relational databases (Oracle, PostgreSQL, MySQL with the XA connector) implement 2PC to let a single SQL transaction span multiple databases. CockroachDB and Google Spanner run 2PC under the hood for distributed SQL, but replicate the coordinator's decision with Raft Log Replication so that coordinator failure does not block participants — a critical innovation that reclaimed availability without surrendering atomicity. Microservices often avoid 2PC entirely in favor of sagas, which chain local transactions with explicit compensating undo actions, trading atomicity for availability.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `A participant that votes YES cannot unilaterally abort, even if it crashes and recovers. Its WAL guarantees it can still commit when the coordinator asks. Conversely, the coordinator cannot decide without all votes; it must wait (or time out). Timeouts are subtle: if a participant times out and aborts on its own, and the coordinator later commands COMMIT, the transaction is torn across machines — the foundation of why 2PC requires unanimous agreement and why blocking is baked in. Another trap: confusing 2PC with eventual consistency. 2PC is synchronous all-or-nothing; it does not tolerate partition or delayed consensus. In systems that can tolerate partition, Raft Log Replication (consensus) is preferred because it removes the blocking window. The CAP Theorem frames this: 2PC chooses consistency and partition tolerance but loses availability when the coordinator fails.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Understand Write-Ahead Log (WAL) to see why participants can survive a crash after voting YES. Learn Raft Log Replication and Raft Leader Election to see how replicated consensus removes the blocking window and how modern distributed databases like Spanner and CockroachDB fix 2PC's availability problem. Study CAP Theorem to place 2PC in the broader landscape of trade-offs. Finally, explore sagas and compensating transactions as the microservices alternative to atomic commits.`,
      ],
    },
  ],
};

