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
      heading: `What it is`,
      paragraphs: [
        `Two-phase commit is the classic atomic-commit protocol for one transaction that touches multiple resource managers. Jim Gray's transaction-processing work made the pattern central in databases: each participant promises it can commit, then a coordinator records one final decision and tells everyone to commit or abort. The goal is all-or-nothing atomicity across machines that do not share one disk or one local log.`,
        `The trade-off is sharp. A participant owns its local durability through a Write-Ahead Log (WAL), locks, and recovery. But after it votes yes, it no longer controls the outcome. It must wait for the coordinator's durable decision, even if that means holding locks while a machine or network link is down.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Phase 1 is prepare. The coordinator asks every participant whether it can commit. Each participant checks constraints, writes enough undo/redo information to its log, keeps the relevant locks, and replies yes or no. A no vote or timeout before prepare completes lets the coordinator abort. A yes vote is a durable promise: after crash recovery, the participant must still be able to commit if ordered.`,
        `Phase 2 is decision. If every participant voted yes, the coordinator writes commit to its own durable log and broadcasts COMMIT. If any participant voted no, it writes abort and broadcasts ABORT. Participants then finish, release locks, and record completion. The dangerous window is after participants have prepared and before they learn the decision. If the coordinator is unavailable, they cannot safely decide alone because some other participant may already have received the opposite-looking fact: the coordinator's real decision.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The minimum cost is two coordinator round trips plus forced log writes for prepare and decision. Locks can live much longer than two messages: a slow participant, a coordinator crash, or a partition can leave prepared transactions blocking other work for seconds, minutes, or worse. That blocking is the protocol's defining availability cost. It interacts directly with Transaction Isolation Levels because prepared rows may be invisible or locked while other transactions wait.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `XA transactions in Oracle, PostgreSQL prepared transactions, MySQL XA, and Java transaction managers expose 2PC across databases and message brokers. Google Spanner and CockroachDB use 2PC-like coordination across shards, but they replicate transaction records or participant state with Paxos/Raft-style consensus so a single coordinator process is not the only copy of the decision. That does not make commit free; it replaces one fragile coordinator with replicated metadata and quorum latency from Raft Log Replication.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `A yes-voting participant cannot unilaterally abort after prepare. That is the whole promise. Conversely, before a participant prepares, timeouts can safely push the transaction toward abort. Another misconception is that consensus simply replaces 2PC. Raft Leader Election and replication can make the coordinator decision highly available, but atomic commit across many shards is still a separate protocol. The CAP Theorem framing is that 2PC preserves atomicity by blocking when communication needed for the decision is unavailable.`,
        `2PC is also not a Saga Pattern. A saga commits each local step immediately and later runs compensating actions if needed. 2PC prevents partial effects from becoming visible, at the cost of locks and waiting. MVCC Internals & VACUUM may hide some waiting from readers, but writers and unique constraints can still block behind prepared work. Distributed Tracing is often the only way to see which participant is holding the transaction open.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Write-Ahead Log (WAL) first, because prepared promises live or die by durable logs. Then read Transaction Isolation Levels and MVCC Internals & VACUUM to understand what locks and versions do while a commit waits. Use Raft Leader Election and Raft Log Replication for replicated coordinators, CAP Theorem for the availability trade-off, and Saga Pattern for the compensation-based alternative.`,
      ],
    },
  ],
};
