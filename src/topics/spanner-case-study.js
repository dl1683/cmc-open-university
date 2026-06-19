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
        "Read the animation as the execution trace for Spanner Case Study. Google Spanner as a global database lesson: Paxos groups, 2PC, MVCC snapshots, and TrueTime commit-wait..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A global application wants data close to users, durable across datacenters, and still protected by database invariants. That is easy to say and hard to build. If an account balance, inventory count, identity record, or access-control rule can be updated from several regions, the system must decide what it means for one transaction to happen before another.',
        'Many distributed stores choose availability and accept later reconciliation. That can work for shopping carts, caches, feeds, and some profile data. It is a poor fit when the application cannot merge conflicts after the fact. Spanner is the case study for paying the coordination cost up front so a distributed SQL database can offer externally consistent transactions across replicated data.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest global database is a single primary region with replicas elsewhere. All writes go to the primary, and remote users pay wide-area latency. Reads from replicas may be stale unless they coordinate with the primary. This design is understandable, but it wastes locality and makes the primary region a bottleneck for global workloads.',
        'Another baseline is eventual consistency. Each region accepts writes, replicates them later, and resolves conflicts when replicas disagree. That improves availability, but it pushes correctness into application-specific merge logic. The hard wall appears when two transactions touch different shards, finish in a real-time order that users can observe, and must later be read in that same order everywhere.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is external consistency. If transaction T1 commits and the client receives success before transaction T2 starts, then every later serial view should place T1 before T2. This is stronger than merely assigning unique version numbers. The database has to respect real-time order that clients can observe outside the database.',
        'Physical clocks look tempting, but ordinary clocks are not exact. One machine may think the time is 10:00:00.100 while another thinks it is 10:00:00.095. If the database blindly trusts local timestamps, a later transaction can appear earlier than a transaction that already returned success. Spanner has to use time without pretending time has no uncertainty.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Spanner composes four ideas. First, data is partitioned into ranges, and each range is replicated by a Paxos group. Second, a transaction that touches multiple groups uses two-phase commit across the participant leaders. Third, MVCC stores multiple versions so reads can choose a timestamp. Fourth, TrueTime exposes clock uncertainty as an interval, and commit-wait turns that uncertainty into an ordering guarantee.',
        'The important move is not "use clocks" in the vague sense. It is "use bounded clock uncertainty as a protocol input." TrueTime returns an earliest and latest possible current time. If Spanner chooses commit timestamp s, it waits until TrueTime is definitely after s before reporting the commit. That wait is the bridge between timestamp order and real-time order.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'At the storage layer, each partition of data has a Paxos group. The group has replicas in different failure domains, and one replica acts as leader for a lease interval. Writes are appended through the group log and become durable when the consensus protocol reaches the required quorum. A single-group transaction can commit through that group without a cross-group two-phase commit coordinator.',
        'A multi-group transaction needs a coordinator. Participant leaders prepare their parts of the transaction and replicate prepare records through their own Paxos groups. The coordinator chooses a commit timestamp that is greater than relevant prior timestamps and compatible with the TrueTime interval. It then records the commit decision and tells participants. Each participant can make the appropriate MVCC version visible at the chosen timestamp.',
        'Commit-wait happens before the system reports success to the client. If the commit timestamp is s, the coordinator waits until TrueTime says the earliest possible current time is greater than s. After that point, any transaction that starts later must see a TrueTime interval after s, so it cannot safely receive a timestamp that would place it before the already completed transaction.',
      ],
    },
    {
      heading: 'MVCC and snapshot reads',
      paragraphs: [
        'MVCC is what makes timestamped reads practical. Instead of overwriting one row version in place, the database keeps versions tagged by commit timestamp. A read-only transaction can choose a timestamp and read the versions visible at that time. If the chosen timestamp is safe for the replicas involved, the read can avoid blocking current writers.',
        'This is why TrueTime affects both writes and reads. A timestamp is not just metadata for auditing. It is the coordinate system for a consistent snapshot. Replicas have to know whether they are caught up enough to serve a read at timestamp t. When they are, the database can provide a global snapshot without locking every row the reader touches.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a transaction transfers credit between two accounts whose rows live in different Paxos groups. The client contacts a coordinator. Group A prepares the debit and replicates that prepare record. Group B prepares the credit and replicates its prepare record. The coordinator chooses commit timestamp 105 after considering participant state and TrueTime.',
        'Now the coordinator waits until real time is definitely past 105 according to TrueTime. Only then does it report commit success to the client. If another client starts a balance read after receiving a message from the first client, the second transaction cannot be assigned a timestamp that comes before 105. The real-world communication order and the database timestamp order line up.',
        'A later read-only transaction can choose a timestamp, such as 110, and read account versions at that timestamp. It does not need to see half of the transfer because the debit and credit became visible as part of one transaction timestamp. The snapshot contract is simple for the application even though the storage path used consensus, two-phase commit, MVCC, and clock uncertainty.',
      ],
    },
    {
      heading: 'What the animation shows',
      paragraphs: [
        'The commit-timestamp view shows Spanner as a stack of coordination mechanisms. The client begins a transaction, the coordinator talks to Paxos group leaders, the groups replicate to regional replicas, and TrueTime supplies an interval rather than a point. The frame with commit-wait is the key: the wait is the mechanism that makes a chosen timestamp safe to expose as committed.',
        'The snapshot-read view shows why MVCC matters. Rows have versions at different timestamps, and a read chooses the version set for one timestamp. The topology frame then connects that local-looking table idea to global replicas. The lesson is that consistent snapshots come from versioned data plus a timestamp system that the replicas and commit protocol agree to respect.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Spanner works by keeping separate invariants and then composing them. Paxos makes each group agree on its own log. Two-phase commit makes all touched groups agree on one transaction outcome. MVCC makes committed versions readable by timestamp. TrueTime and commit-wait make timestamp order respect real-time order for transactions that clients can observe.',
        'The external-consistency invariant can be stated directly: if T1 finishes before T2 starts, T1 must receive a smaller commit timestamp than T2. Commit-wait is what closes the loophole created by clock uncertainty. It ensures that after T1 returns, real time has passed T1\'s timestamp, so T2 cannot honestly start in an interval that belongs before T1.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The obvious cost is latency. Cross-region replication needs wide-area communication. Multi-group transactions need two-phase commit messages plus consensus inside each participant group. Commit-wait adds delay proportional to TrueTime uncertainty. If uncertainty grows because clock infrastructure is degraded, the system must wait longer or stop preserving the guarantee.',
        'The operational cost is also real. Spanner depends on disciplined time synchronization, careful leader placement, replica health, transaction participant tracking, MVCC garbage collection, and schema or data placement choices that avoid turning every transaction into a global transaction. Strong semantics do not make bad data modeling cheap.',
        'There is also an availability tradeoff. Spanner does not erase CAP-style choices. If a partition prevents a group from reaching the required quorum, strongly consistent writes for that group cannot proceed. The design chooses consistency for the transactional interface and accepts that some failures reduce availability.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Spanner-style systems win when applications need global replication and strong invariants at the same time: financial ledgers, identity and authorization data, inventory, critical metadata, payment state, globally visible configuration, and multi-region services where manual conflict repair is unacceptable.',
        'It is especially useful when read-only transactions need consistent global snapshots. Analytics, audits, and user-facing reads can ask for a timestamped view instead of locking active writers. The application gets a familiar database abstraction while the system handles the replicated logs and timestamp discipline underneath.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Spanner is not the right answer for every global workload. If the data can tolerate stale reads or conflict resolution, eventual consistency may be cheaper and more available. If most transactions are local to one region, a simpler primary-replica database may be easier to operate. If the application creates many cross-partition write transactions, the coordination cost can dominate.',
        'It also fails when people simplify the story to "clocks solve distributed systems." Clocks do not solve consensus, atomic commit, or failure detection by themselves. Spanner still needs replicated logs, transaction protocols, and careful waiting. TrueTime is valuable because its uncertainty is explicit and bounded, not because it makes clocks perfect.',
      ],
    },
    {
      heading: 'Where it fails (2)',
      paragraphs: [
        'Important failure modes include clock uncertainty growing, leaders moving during transactions, Paxos groups losing quorum, two-phase commit participants recovering after a coordinator failure, old MVCC versions being garbage-collected before a long snapshot can finish, and data placement choices that create wide-area transactions for hot paths.',
        'The defensive patterns follow from the design. Keep related rows colocated when possible. Monitor TrueTime uncertainty and commit latency. Treat cross-group transactions as expensive. Size MVCC retention for long reads. Understand which failures reduce availability. Spanner gives strong semantics, but it does not remove the need to design around failure domains.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary source: "Spanner: Google\'s Globally-Distributed Database" at https://www.usenix.org/system/files/conference/osdi12/osdi12-final-16.pdf, plus Google\'s TrueTime and CAP discussion at https://research.google.com/pubs/archive/45855.pdf.',
        'Study Clocks & Ordering: Lamport to TrueTime for timestamp semantics, NTP & PTP: How Clocks Actually Sync for clock uncertainty, Two-Phase Commit (2PC) for atomic commit, Paxos: Consensus Without a Leader for replicated decisions, MVCC Internals & VACUUM for versioned reads and cleanup, Transaction Isolation Levels for user-facing guarantees, and Amazon Dynamo Case Study for the contrasting availability-first design.',
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why Spanner Case Study moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};
