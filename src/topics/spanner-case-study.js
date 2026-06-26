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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the commit view as a transaction crossing replicated groups. A client talks to a coordinator, the coordinator talks to Paxos group leaders, and TrueTime supplies an interval for clock uncertainty. Active nodes are protocol participants doing work now, compare nodes are replicas that must agree, and found nodes are guarantees already established.',
        'The snapshot view shows MVCC, which means multiversion concurrency control. A row can have several committed versions, each tagged by timestamp. The safe inference is that a read at timestamp 105 must use the versions visible at 105 across every group it touches.',
        {type:'callout', text:'Spanner gets global SQL semantics by composing consensus, atomic commit, MVCC, and bounded clock uncertainty into one timestamp contract.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/2/27/President_Pi%C3%B1era_receives_ESO%27s_first_atomic_clock.jpg', alt:'Rack-mounted atomic clock with analog meters and controls.', caption:'Atomic clock photo by ESO, Wikimedia Commons, CC BY 4.0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A global database wants users near their data while preserving transaction rules. A transaction is a group of reads and writes that should commit as one unit. Global replication makes the problem harder because different datacenters observe messages and clocks at slightly different times.',
        'Spanner exists for workloads where later conflict repair is not acceptable. Balances, identity records, permissions, inventory, and critical metadata need a clear order. The system pays coordination and clock-infrastructure cost so distributed SQL can offer externally consistent transactions.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is one primary region. Send every write to that region, replicate changes outward, and let remote users wait. This is simple and gives one ordering point, but global latency and regional dependence become product limits.',
        'The other obvious approach is eventual consistency. Let every region accept writes and reconcile conflicts later. That can work for carts, feeds, and caches, but it fails when the application cannot merge two completed transactions after users have seen success.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is external consistency. If transaction T1 finishes before transaction T2 starts, every later serial view must place T1 before T2. This is stronger than giving transactions unique timestamps; the timestamps must respect real time that clients can observe.',
        'Ordinary physical clocks cannot be trusted as exact facts. One machine may be a few milliseconds ahead while another is behind. If the database assigns commit timestamps from local clocks without waiting for uncertainty to pass, a later transaction can appear before an earlier completed one.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Spanner composes consensus, two-phase commit, MVCC, and bounded clock uncertainty. Paxos makes each partitioned group agree on its log. Two-phase commit makes all touched groups agree on one transaction outcome. MVCC stores timestamped versions.',
        'TrueTime is the extra piece. It returns an interval, not a single perfect time. If Spanner assigns commit timestamp s, it waits until TrueTime says real time is definitely after s before reporting success.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Data is partitioned into ranges, and each range is replicated by a Paxos group. Paxos is a consensus protocol, which means replicas agree on the order of log entries despite failures. A group leader handles writes for its range and replicates decisions to a quorum.',
        'A transaction that touches several groups uses two-phase commit. Participants prepare their pieces and record that state through Paxos. The coordinator chooses a commit timestamp, records the decision, waits out TrueTime uncertainty, and then lets participants make the MVCC versions visible.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is a composition of invariants. Paxos gives one ordered log per group. Two-phase commit gives one all-or-nothing decision across groups. MVCC gives readers a precise version rule for a timestamp.',
        'Commit-wait closes the clock loophole. After T1 returns, real time is beyond T1 timestamp. Any T2 that starts later sees a TrueTime interval after that point, so assigning T2 a timestamp before T1 would violate the time interval contract.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost behaves like added coordination on the write path. A local single-group write may need one consensus round in one region set. A multi-group global write needs participant prepare, coordinator commit, Paxos replication inside each group, and commit-wait.',
        'If TrueTime uncertainty is 7 ms, commit-wait can add about 7 ms after the commit timestamp choice. If clock uncertainty grows to 25 ms during infrastructure trouble, the same correctness rule forces longer waits. The guarantee is not free; it turns time uncertainty into latency.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Spanner fits globally replicated systems with strong invariants: financial ledgers, identity stores, authorization metadata, inventory, configuration, and multi-region SaaS control planes. The common access pattern is transactional reads and writes that must be correct across regions.',
        'It also fits consistent snapshot reads. Audits, reports, and user-facing views can read at a timestamp without blocking writers when replicas are caught up enough. That gives applications a simple SQL abstraction over a hard distributed protocol stack.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Spanner is expensive for workloads that can tolerate stale reads or merge conflicts. Eventual consistency, primary-replica databases, or regional databases may be cheaper and more available. If most writes are local and simple, global coordination may optimize the wrong constraint.',
        'It fails when data modeling creates wide transactions. If one user action touches many distant Paxos groups, the protocol turns a local update into a global commit. Clock uncertainty, leader placement, quorum health, and MVCC retention all become operational concerns.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a transfer moves 40 credits from account A in Paxos group A to account B in Paxos group B. The coordinator asks both groups to prepare. Group A records the debit prepare, group B records the credit prepare, and both replicate those records to quorums.',
        'TrueTime now returns [100, 106], and the coordinator chooses commit timestamp 107. It records commit and waits until TrueTime earliest is greater than 107. If that wait lasts 8 ms, the user sees success after the uncertainty has passed, and a later balance read at timestamp 110 sees both the debit and the credit.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with Spanner: Google Globally-Distributed Database from OSDI 2012 and Google papers on TrueTime and consistency tradeoffs. Read them for the exact external-consistency contract, not just for the clock headline.',
        'Study Paxos, two-phase commit, MVCC, transaction isolation, Lamport clocks, NTP and PTP clock sync, and Amazon Dynamo next. The contrast with Dynamo is useful because it shows what Spanner pays to avoid application-level conflict repair.',
      ],
    },
  ],
};
