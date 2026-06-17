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
      heading: `Why this exists`,
      paragraphs: [
        `A local database transaction is easy to reason about because one log owns the outcome. If the process crashes, recovery reads that log and decides whether the transaction committed or rolled back.`,
        `Distributed transactions lose that simplicity. A checkout might charge a card in one system, reserve inventory in another, and create an order in a third. The user still expects one answer: either all three effects become durable, or none of them do.`,
        `Two-phase commit exists to provide that all-or-nothing boundary across machines that do not share a disk, a lock manager, or a write-ahead log. It is not trying to make failure disappear. It is trying to make partial success impossible.`,
      ],
    },
    {
      heading: `The Obvious Approach and the Wall`,
      paragraphs: [
        `The obvious approach is to ask each participant to do its local transaction and then hope every participant succeeds. That works only on the happy path. If payment commits and inventory fails, the system has already exposed an effect it cannot simply unshow.`,
        `The other obvious approach is to ask everyone whether they are ready before committing. That is closer, but it creates a harder question: what does ready mean after a crash? A participant that merely says "yes" from memory may reboot and forget what it promised.`,
        `The wall is durable uncertainty. Once a participant has promised it can commit, it cannot safely abort on its own, because the coordinator may already have recorded commit and told another participant to finish. The same promise that preserves atomicity is what makes the protocol block.`,
      ],
    },
    {
      heading: `The Core Insight`,
      paragraphs: [
        `2PC separates "I can commit" from "we did commit." In the prepare phase, each participant does enough work locally that it can later commit or abort after recovery. In the decision phase, one coordinator records the global outcome.`,
        `The coordinator can write commit only after every participant has durably voted yes. Any no vote, failed prepare, or timeout before the prepared point sends the transaction to abort. After the decision is logged, participants finish according to that decision.`,
        `The protocol is simple because there is exactly one global decision record. It is also fragile for the same reason: a prepared participant that cannot learn the decision has to wait.`,
      ],
    },
    {
      heading: `How the visual model teaches it`,
      paragraphs: [
        `The graph shows one coordinator above three participants: payment, stock, and order. In the "all vote yes" scenario, follow the prepare requests outward, the yes votes back in, and the final commit broadcast outward again. Those two waves are the two phases.`,
        `In "one votes no," notice that a single no vote is enough to make the coordinator choose abort. The point is not majority rule. Atomic commit requires unanimity because any participant that cannot safely commit would break the global transaction.`,
        `In "coordinator crashes," watch the coordinator disappear after all participants are prepared. The participants are not confused because the protocol is vague; they are blocked because the protocol is precise. A prepared participant must not invent a decision.`,
      ],
    },
    {
      heading: `How It Works`,
      paragraphs: [
        `Phase 1 is prepare. The coordinator sends PREPARE to every participant. Each participant checks constraints, performs the local work, writes the needed undo or redo information to its write-ahead log, keeps the locks that protect the tentative result, and replies yes or no.`,
        `A yes vote is a durable promise. After a crash, that participant must recover into a prepared state and remain able to commit if the coordinator's decision says commit. It cannot release the locks as if nothing happened.`,
        `Phase 2 is decision. If every participant voted yes, the coordinator force-writes commit to its own log and broadcasts COMMIT. If any participant voted no, or if prepare cannot complete, the coordinator force-writes abort and broadcasts ABORT. Participants then finalize, release locks, and record completion.`,
        `Recovery follows the logs. A participant that finds a prepared transaction contacts the coordinator to learn the decision. A coordinator that finds a decision record repeats the decision. Repeating COMMIT or ABORT is safe because the decision is idempotent; changing the decision is not.`,
      ],
    },
    {
      heading: `Why It Works`,
      paragraphs: [
        `Atomicity comes from matching two durable facts. First, every yes-voting participant has promised it can commit later. Second, the coordinator records one final decision before telling anyone to act on it.`,
        `If commit is logged, every prepared participant has enough local state to finish, even after a crash. If commit is not logged and prepare did not complete, abort is safe because the system has not crossed the point where every participant is bound.`,
        `The famous blocking behavior is not an implementation accident. It is the safety argument made visible. A prepared participant that cannot reach the coordinator does not know whether commit was logged and perhaps delivered to another participant. Waiting is the only action that cannot split the transaction.`,
      ],
    },
    {
      heading: `Worked Example`,
      paragraphs: [
        `Suppose a checkout transaction touches three services. Payment can debit the card, stock can reserve the last item, and order can create the order row. In prepare, payment writes a pending debit, stock writes a pending reservation, and order writes a pending order. Each keeps enough lock or version state to prevent another transaction from contradicting the prepared work.`,
        `If stock votes no because the item is gone, the coordinator aborts and the customer sees one clean failure. If all three vote yes, the coordinator logs commit and tells all three to make their prepared records final. The customer never sees a charged card without an order, or an order without reserved inventory.`,
        `Now make the coordinator crash after the yes votes. Payment, stock, and order may all be holding locks. They cannot decide by voting among themselves because the coordinator might have logged commit just before crashing. They must wait for recovery or for a replicated decision service to answer.`,
      ],
    },
    {
      heading: `Costs and Tradeoffs`,
      paragraphs: [
        `The minimum latency is two coordinator round trips plus forced log writes for prepare and decision. In practice, the larger cost is lock duration. Prepared rows, unique keys, inventory counts, or account balances can block unrelated work while the transaction waits.`,
        `2PC also concentrates availability in the decision record. Replicating the coordinator with Raft or Paxos can make that record more available, but it adds quorum latency and does not remove the need for atomic commit across participants.`,
        `Operationally, prepared transactions are debt. Systems need timeouts, monitoring, cleanup tools, and tracing that can show which participant is holding the transaction open. Without that visibility, the protocol's correctness looks like an outage.`,
      ],
    },
    {
      heading: `Where It Wins`,
      paragraphs: [
        `2PC wins when partial visibility is worse than waiting: distributed SQL commits, XA transactions, prepared transactions in relational databases, and shard-spanning updates that must preserve hard invariants.`,
        `It works best with a small number of participants, short transactions, predictable storage latency, and a recovery path that operators actually understand. The protocol is a poor fit for long user workflows, but a strong fit for short database work that must be atomic.`,
      ],
    },
    {
      heading: `Where It Fails`,
      paragraphs: [
        `It fails when the system cannot tolerate blocking. A yes-voting participant cannot unilaterally abort after prepare, so coordinator failure or a partition can hold locks and prepared state hostage.`,
        `It also fails as a substitute for business-level recovery. A saga commits each local step immediately and later runs compensating actions if a later step fails. That gives up strict atomic visibility but avoids holding locks across a long workflow. 2PC and sagas solve different problems.`,
        `A common misconception is that consensus replaces 2PC. Consensus can replicate the coordinator's decision, elect a new coordinator, or make transaction metadata highly available. It still does not let one participant safely commit while another aborts.`,
      ],
    },
    {
      heading: `Study Next`,
      paragraphs: [
        `Study Write-Ahead Log (WAL) first, because prepared promises live or die by durable logs. Then read Transaction Isolation Levels and MVCC Internals & VACUUM to understand what locks and versions do while a commit waits. Use Raft Leader Election and Raft Log Replication for replicated coordinators, CAP Theorem for the availability trade-off, and Saga Pattern for the compensation-based alternative.`,
      ],
    },
  ],
};
