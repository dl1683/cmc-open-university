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

  const numParticipants = PARTICIPANTS.length;
  const numNodes = NODES.length;
  const numEdges = EDGES.length;
  const participantLabels = NODES.filter(n => n.id !== 'C').map(n => n.label).join(', ');

  const status = new Map([['C', 'coordinator'], ['P1', 'idle'], ['P2', 'idle'], ['P3', 'idle']]);
  let coordinatorAlive = true;
  const snapshot = () => graphState({
    nodes: NODES.filter((n) => n.id !== 'C' || coordinatorAlive).map((n) => ({ ...n, note: status.get(n.id) })),
    edges: coordinatorAlive ? EDGES : [],
  });

  yield {
    state: snapshot(),
    highlight: { active: ['C'] },
    explanation: `One checkout, ${numParticipants} databases (${participantLabels}): payments must debit, inventory must reserve, orders must create — ALL or NOTHING. On a single machine the Write-Ahead Log (WAL) buys atomicity; across ${numParticipants} machines, nobody's local log can speak for the others. Two-phase commit appoints a COORDINATOR (C) to orchestrate a distributed promise.`,
  };

  for (const p of PARTICIPANTS) status.set(p, 'preparing…');
  yield {
    state: snapshot(),
    highlight: { active: EDGES.map((e) => e.id), compare: PARTICIPANTS },
    explanation: `PHASE 1 — PREPARE: C sends ${numEdges} PREPARE messages — one per edge — asking every participant "can you commit this?" Each of the ${numParticipants} participants does the actual work, writes it durably to its own WAL, LOCKS the affected rows… but does not finalize. A YES vote is a binding promise: "I am now ABLE to commit, and will hold this state until you decide."`,
    invariant: `A participant that votes YES must be able to commit even if it crashes and recovers — all ${numParticipants} WALs guarantee this independently.`,
  };

  if (scenario === 'one votes no') {
    status.set('P1', 'voted YES ✓');
    status.set('P2', 'voted NO ✗');
    status.set('P3', 'voted YES ✓');
    yield {
      state: snapshot(),
      highlight: { swap: ['P2'], found: ['P1', 'P3'] },
      explanation: `The votes arrive: ${NODES[1].label} YES, ${NODES[3].label} YES… but ${NODES[2].label} votes NO — the last unit just sold out. Unanimity across ${numParticipants} participants failed, and 2PC requires ALL yes votes.`,
    };
    for (const p of PARTICIPANTS) status.set(p, 'rolled back');
    yield {
      state: snapshot(),
      highlight: { active: EDGES.map((e) => e.id) },
      explanation: `PHASE 2 — ABORT: C broadcasts the decision across ${numEdges} edges; every participant undoes its prepared work via its WAL and releases its locks. The customer sees one clean "out of stock" — never a charged card with no order. Atomicity held across all ${numParticipants} participants; the transaction just answered "no".`,
    };
    return;
  }

  for (const p of PARTICIPANTS) status.set(p, 'voted YES ✓');
  yield {
    state: snapshot(),
    highlight: { found: PARTICIPANTS },
    explanation: `All ${numParticipants} vote YES. Every participant is now PREPARED: work written, locks held, fate suspended. Only one thing remains — the coordinator's decision, which it writes to its OWN log first (the decision itself must survive a crash).`,
  };

  if (scenario === 'coordinator crashes') {
    coordinatorAlive = false;
    for (const p of PARTICIPANTS) status.set(p, 'BLOCKED ⏳');
    yield {
      state: snapshot(),
      highlight: { swap: PARTICIPANTS },
      explanation: `⚡ C crashes after collecting ${numParticipants} YES votes but BEFORE broadcasting a decision. Now witness 2PC's famous flaw: the ${numParticipants} participants (${participantLabels}) are STUCK. Commit on their own? Maybe C decided abort. Abort on their own? Maybe C decided commit and told someone. They can do nothing — holding locks, blocking every other transaction that touches those rows — until C recovers and reads its log.`,
      invariant: `${numParticipants} prepared participants cannot decide unilaterally — coordinatorAlive is ${coordinatorAlive}, so no edges remain. That is precisely what makes 2PC correct, and what makes it BLOCKING.`,
    };
    yield {
      state: snapshot(),
      highlight: {},
      explanation: `This blocking is why 2PC is treated with caution: 1 coordinator's nap halts ${numParticipants} participants. The fixes shape modern infrastructure — replicate the COORDINATOR's decision with consensus so a backup can answer (Raft Log Replication: Spanner and CockroachDB run 2PC over Raft groups), or sidestep atomic commits entirely with SAGAS: a chain of local transactions plus compensating undo actions, the standard microservices answer. Compare the CAP Theorem: 2PC chooses consistency and pays in availability.`,
    };
    return;
  }

  for (const p of PARTICIPANTS) status.set(p, 'committed ✓');
  yield {
    state: snapshot(),
    highlight: { active: EDGES.map((e) => e.id), found: PARTICIPANTS },
    explanation: `PHASE 2 — COMMIT: C logs "commit", then broadcasts it across ${numEdges} edges. Each of the ${numParticipants} participants finalizes its prepared work and releases its locks. All ${numParticipants} databases (${participantLabels}) changed as one: the card was charged, the unit reserved, the order created — atomically, across machines.`,
  };

  yield {
    state: snapshot(),
    highlight: { found: ['C', ...PARTICIPANTS] },
    explanation: `That is 2PC at its best: two network round-trips across ${numEdges} edges buy cross-machine atomicity for ${numNodes} nodes, and it powers XA transactions in relational databases and distributed SQL engines to this day. But re-run this with "coordinator crashes" before trusting it everywhere — the "${scenario}" happy path is not the whole story; the failure mode is why consensus protocols and sagas exist.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The top node is the coordinator, which is the process responsible for choosing one final transaction outcome. The lower nodes are participants, each owning local data that must either commit or abort with the others.',
        {
          type: 'callout',
          text: 'Two-phase commit makes every participant durable before any participant becomes visible, then lets one logged coordinator decision resolve all local promises.',
        },
        'Messages in phase one ask whether each participant can promise to finish later. Messages in phase two carry the single decision, and a blocked participant is one that promised yes but has not learned the decision.',
        {
          type: 'image',
          src: './assets/gifs/two-phase-commit.gif',
          alt: 'Animated walkthrough of the two phase commit visualization',
          caption: 'Animation preview: the full visualization plays through each step at reading pace.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A transaction is atomic when its effects happen all together or not at all. A single database can enforce that with one log, but a distributed checkout may touch payment, inventory, and order databases that do not share a log.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/8/86/Two_phase_commit_seq_diagram_success_01.png',
          alt: 'Sequence diagram of a successful two-phase commit between a coordinator and two participants',
          caption: 'The message sequence shows the core shape: prepare all participants first, then broadcast one final commit decision. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Two_phase_commit_seq_diagram_success_01.png.',
        },
        'Two-phase commit exists to prevent partial success across those machines. It gives separate participants one shared yes-or-no outcome even when each participant can only make its own local writes durable.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to commit services one after another. Charge the card, reserve the item, create the order, and return success if all calls finish.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that a committed local effect cannot be uncommitted by another service. If payment commits and inventory then fails, the system has charged a customer for an item it did not reserve.',
        'A second wall is crash memory. A participant that merely says yes from RAM can reboot and forget the promise, so correctness requires a durable yes before anyone is allowed to commit visibly.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Split the transaction into a promise phase and a decision phase. First every participant writes enough local log state to guarantee it can later commit or abort, then the coordinator logs one final decision.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'In phase one, the coordinator sends PREPARE to every participant. A participant checks constraints, writes undo and redo records to its write-ahead log, holds the required locks, and votes YES or NO.',
        'In phase two, the coordinator commits only if every vote was YES. It force-writes COMMIT to its own log and sends COMMIT, or it force-writes ABORT and sends ABORT if any participant voted NO or failed to answer.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Atomicity follows from the durable promise. A YES vote means the participant can still commit or abort after a crash, so the coordinator can safely choose commit only after all participants have reached that state.',
        'The coordinator decision is the single source of truth. Re-sending COMMIT or ABORT is safe because the decision does not change, and each participant applies the same logged outcome.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'With n participants, the protocol sends n prepare messages, n votes, n decision messages, and n acknowledgments. It also needs forced log writes, so latency is often controlled by disk flush and replication delay rather than by CPU.',
        'The behavioral cost is lock time. Rows prepared by a YES vote remain locked until phase two finishes, so a slow coordinator or network pause can block unrelated user work that needs the same rows.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Distributed databases use two-phase commit for cross-shard transactions. It is the mechanism behind XA-style database transactions and many systems that need one atomic commit across independent storage partitions.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Two-phase commit is blocking. If every participant voted YES and the coordinator becomes unreachable before the decision is known, participants cannot safely commit or abort, so they hold locks and wait.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A checkout touches three participants: payment, stock, and order. Payment prepares a $50 debit, stock prepares a reservation for item 4412, and order prepares a new order row.',
        'If all three vote YES, the coordinator logs COMMIT and sends it to all three. Payment finalizes the debit, stock subtracts one unit, and order exposes the row, so the customer sees one completed checkout.',
        'If stock votes NO because quantity is 0, the coordinator logs ABORT. Payment removes the pending debit and order removes the pending row, so the customer sees an out-of-stock error and no partial purchase exists.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Jim Gray, Notes on Data Base Operating Systems (1978), Skeen, Nonblocking Commit Protocols (1981), and Lamport and Gray, Consensus on Transaction Commit (2004). Then study write-ahead logging, Raft, Paxos, MVCC, and sagas.',
      ],
    },
  ],
};
