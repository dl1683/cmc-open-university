// Spanner case study: globally replicated SQL with Paxos groups, two-phase
// commit, MVCC, and TrueTime commit-wait for external consistency.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'spanner-case-study',
  title: 'Spanner Case Study',
  category: 'Papers',
  summary: 'Google Spanner as a global database lesson: Paxos groups, 2PC, MVCC snapshots, and TrueTime commit-wait.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['commit timestamp', 'snapshot reads'], defaultValue: 'commit timestamp' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function topology(title) {
  return graphState({
    nodes: [
      { id: 'client', label: 'client', x: 0.8, y: 4.0, note: 'transaction' },
      { id: 'coord', label: 'coordinator', x: 2.5, y: 4.0, note: '2PC leader' },
      { id: 'paxosA', label: 'Paxos group A', x: 4.8, y: 2.2, note: 'tablet range' },
      { id: 'paxosB', label: 'Paxos group B', x: 4.8, y: 5.8, note: 'tablet range' },
      { id: 'dc1', label: 'US replica', x: 7.0, y: 1.5, note: 'majority member' },
      { id: 'dc2', label: 'EU replica', x: 7.0, y: 4.0, note: 'majority member' },
      { id: 'dc3', label: 'Asia replica', x: 7.0, y: 6.5, note: 'majority member' },
      { id: 'tt', label: 'TrueTime', x: 8.9, y: 4.0, note: 'time interval' },
    ],
    edges: [
      { id: 'e-client-coord', from: 'client', to: 'coord', weight: 'begin' },
      { id: 'e-coord-a', from: 'coord', to: 'paxosA', weight: 'prepare/commit' },
      { id: 'e-coord-b', from: 'coord', to: 'paxosB', weight: 'prepare/commit' },
      { id: 'e-a-dc1', from: 'paxosA', to: 'dc1', weight: 'replicate' },
      { id: 'e-a-dc2', from: 'paxosA', to: 'dc2', weight: 'replicate' },
      { id: 'e-b-dc2', from: 'paxosB', to: 'dc2', weight: 'replicate' },
      { id: 'e-b-dc3', from: 'paxosB', to: 'dc3', weight: 'replicate' },
      { id: 'e-coord-tt', from: 'coord', to: 'tt', weight: 'now interval' },
    ],
  }, { title });
}

function* commitTimestamp() {
  yield {
    state: topology('Spanner composes Paxos replication with 2PC'),
    highlight: { active: ['coord', 'paxosA', 'paxosB'], compare: ['dc1', 'dc2', 'dc3'] },
    explanation: 'Spanner partitions data into Paxos-replicated groups. A transaction that touches multiple groups uses two-phase commit across participant leaders, while each group uses Paxos to replicate its own log. This is Two-Phase Commit (2PC) inside replicated storage, not a single-node database protocol.',
  };

  yield {
    state: labelMatrix(
      'TrueTime exposes uncertainty instead of hiding it',
      [
        { id: 'start', label: 'transaction starts' },
        { id: 'prepare', label: 'prepare' },
        { id: 'commit', label: 'choose timestamp s' },
        { id: 'wait', label: 'commit wait' },
      ],
      [
        { id: 'tt', label: 'TT.now()' },
        { id: 'action', label: 'action' },
        { id: 'guarantee', label: 'guarantee' },
      ],
      [
        ['[90, 96]', 'read/write locks', 'uncertain real time'],
        ['[98, 104]', 'participants vote', 'commit possible'],
        ['s = 105', 'assign timestamp', 'after prepare'],
        ['wait until >105', 'then publish', 'external consistency'],
      ],
    ),
    highlight: { active: ['commit:tt', 'wait:action'], found: ['wait:guarantee'] },
    explanation: 'TrueTime returns an interval, not a single magic timestamp. If Spanner assigns commit timestamp s, it waits until it is sure real time has passed s before reporting success. That commit-wait is the price of making real-time ordering match timestamp ordering.',
    invariant: 'If transaction T1 finishes before T2 starts, T1 gets a smaller timestamp than T2.',
  };

  yield {
    state: topology('Commit is published only after uncertainty is waited out'),
    highlight: { found: ['tt', 'coord'], active: ['e-coord-a', 'e-coord-b'], compare: ['client'] },
    explanation: 'The wait is not just a sleep. It converts bounded clock uncertainty into an ordering guarantee. If uncertainty grows, the system must wait longer. Spanner turns physical clocks into a database primitive by exposing their uncertainty explicitly.',
  };
}

function* snapshotReads() {
  yield {
    state: labelMatrix(
      'MVCC versions let reads choose a timestamp',
      [
        { id: 'acctA', label: 'account A' },
        { id: 'acctB', label: 'account B' },
        { id: 'ledger', label: 'ledger row' },
      ],
      [
        { id: 't100', label: 'ts 100' },
        { id: 't105', label: 'ts 105' },
        { id: 't110', label: 'ts 110' },
      ],
      [
        ['$10', '$15', '$15'],
        ['$20', '$20', '$17'],
        ['v1', 'v2', 'v3'],
      ],
    ),
    highlight: { active: ['acctA:t105', 'acctB:t105', 'ledger:t105'], compare: ['acctB:t110'] },
    explanation: 'Spanner stores multiple versions. A read-only transaction can choose a timestamp and read a consistent snapshot at that time without blocking writers. This connects Spanner to MVCC Internals & VACUUM, but with globally meaningful timestamps.',
  };

  yield {
    state: topology('A global snapshot read can avoid write locks'),
    highlight: { active: ['client', 'paxosA', 'paxosB'], found: ['tt'], compare: ['coord'] },
    explanation: 'Read-only transactions can run at a timestamp that is safe for all needed replicas. The system can serve a consistent global view because timestamps are externally meaningful and replicas know whether they are up to date enough for that timestamp.',
    invariant: 'A snapshot timestamp is a contract about which versions are visible.',
  };

  yield {
    state: labelMatrix(
      'Spanner tradeoffs',
      [
        { id: 'strong', label: 'strong semantics' },
        { id: 'latency', label: 'latency' },
        { id: 'ops', label: 'operations' },
        { id: 'fit', label: 'best fit' },
      ],
      [
        { id: 'choice', label: 'choice' },
        { id: 'study', label: 'study link' },
      ],
      [
        ['external consistency', 'Clocks & Ordering: Lamport to TrueTime'],
        ['commit wait + replication', 'Tail Latency & p99 Thinking'],
        ['clock infrastructure', 'NTP & PTP: How Clocks Actually Sync'],
        ['global SQL invariants', 'Transaction Isolation Levels'],
      ],
    ),
    highlight: { found: ['strong:choice', 'fit:choice'], compare: ['latency:choice'] },
    explanation: 'Spanner is the counterpoint to Amazon Dynamo Case Study. Dynamo maximizes write availability and reconciles later. Spanner pays coordination and clock-infrastructure cost to give globally consistent transactions.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'commit timestamp') yield* commitTimestamp();
  else if (view === 'snapshot reads') yield* snapshotReads();
  else throw new InputError('Pick a Spanner view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Spanner is Google\'s globally distributed database. It combines sharded storage, Paxos replication, two-phase commit, MVCC, and a clock API called TrueTime to support externally consistent distributed transactions across datacenters.',
        'The case study matters because it is a serious answer to the question Dynamo leaves open: what if the application cannot tolerate conflict reconciliation later? Spanner pays for coordination and clock infrastructure so users can get strong global transaction semantics.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Data is split into groups that are replicated with Paxos. A transaction that touches one group can commit through that group. A transaction that touches multiple groups uses two-phase commit across participant leaders, while each participant replicates its log entry through Paxos.',
        'TrueTime returns an interval [earliest, latest] for the current time. When Spanner assigns a commit timestamp s, it waits until TrueTime is definitely after s before reporting the commit. This commit-wait ensures that if one transaction finishes before another begins, their timestamps reflect that real-time order.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Spanner buys strong semantics with latency and operational cost. Cross-region Paxos adds wide-area round trips. Commit-wait adds delay proportional to clock uncertainty. The clock infrastructure itself must be monitored and bounded. If uncertainty grows, performance degrades because the system has to wait longer to preserve the guarantee.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Spanner-style systems fit workloads that need global replication and strong invariants: financial ledgers, inventory, identity, critical metadata, and applications where conflict reconciliation is not acceptable. The design influenced NewSQL systems and cloud databases that try to combine horizontal scale with SQL-like transaction guarantees.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Spanner does not prove that clocks are easy in distributed systems. It works because TrueTime exposes bounded uncertainty and the system waits out that uncertainty. Another misconception is that Spanner invalidates CAP tradeoffs. During partitions, systems still choose behavior; Spanner chooses strong consistency for transactions and may sacrifice availability for some operations.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: "Spanner: Google\'s Globally-Distributed Database" at https://www.usenix.org/system/files/conference/osdi12/osdi12-final-16.pdf, plus Google\'s TrueTime and CAP discussion at https://research.google.com/pubs/archive/45855.pdf. Study Clocks & Ordering: Lamport to TrueTime, NTP & PTP: How Clocks Actually Sync, Two-Phase Commit (2PC), Paxos: Consensus Without a Leader, MVCC Internals & VACUUM, and Transaction Isolation Levels next.',
      ],
    },
  ],
};
