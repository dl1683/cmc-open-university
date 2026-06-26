// Calvin case study: order transactions before execution so distributed
// execution can avoid runtime distributed commit on the critical path.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'calvin-deterministic-db-case-study',
  title: 'Calvin Deterministic Database Case Study',
  category: 'Papers',
  summary: 'Calvin as the transaction-ordering lesson: sequence first, replicate the log, then execute deterministically across shards.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['deterministic ordering', 'cross-shard execution'], defaultValue: 'deterministic ordering' },
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

function architecture(title) {
  return graphState({
    nodes: [
      { id: 'client', label: 'clients', x: 0.7, y: 3.8, note: 'transactions' },
      { id: 'sequencer', label: 'sequencer', x: 2.7, y: 3.8, note: 'global order' },
      { id: 'log', label: 'replicated log', x: 4.8, y: 3.8, note: 'batch order' },
      { id: 'schedA', label: 'scheduler A', x: 6.8, y: 2.2, note: 'shard A' },
      { id: 'schedB', label: 'scheduler B', x: 6.8, y: 5.4, note: 'shard B' },
      { id: 'storeA', label: 'storage A', x: 8.8, y: 2.2, note: 'records' },
      { id: 'storeB', label: 'storage B', x: 8.8, y: 5.4, note: 'records' },
    ],
    edges: [
      { id: 'e-client-seq', from: 'client', to: 'sequencer', weight: 'submit' },
      { id: 'e-seq-log', from: 'sequencer', to: 'log', weight: 'ordered batch' },
      { id: 'e-log-a', from: 'log', to: 'schedA', weight: 'same order' },
      { id: 'e-log-b', from: 'log', to: 'schedB', weight: 'same order' },
      { id: 'e-schedA-storeA', from: 'schedA', to: 'storeA', weight: 'execute' },
      { id: 'e-schedB-storeB', from: 'schedB', to: 'storeB', weight: 'execute' },
      { id: 'e-schedA-schedB', from: 'schedA', to: 'schedB', weight: 'lockstep' },
    ],
  }, { title });
}

function* deterministicOrdering() {
  yield {
    state: architecture('Calvin moves ordering before execution'),
    highlight: { active: ['client', 'sequencer', 'log', 'e-client-seq', 'e-seq-log'], compare: ['schedA', 'schedB'] },
    explanation: 'Calvin separates transaction ordering from transaction execution. A sequencer creates a deterministic global order first. Every replica sees the same ordered log before workers touch records.',
  };

  yield {
    state: labelMatrix(
      'Input batch becomes the serial order',
      [
        { id: 't1', label: 'T1' },
        { id: 't2', label: 'T2' },
        { id: 't3', label: 'T3' },
        { id: 't4', label: 'T4' },
      ],
      [
        { id: 'reads', label: 'read set' },
        { id: 'writes', label: 'write set' },
        { id: 'shards', label: 'shards' },
        { id: 'order', label: 'serial slot' },
      ],
      [
        ['acct7', 'acct7', 'A', '1'],
        ['cart9', 'cart9,total9', 'B', '2'],
        ['acct7,cart9', 'ledger2', 'A+B', '3'],
        ['sku4', 'sku4', 'A', '4'],
      ],
    ),
    highlight: { active: ['t1:order', 't2:order', 't3:order', 't4:order'], found: ['t3:shards'] },
    explanation: 'The ordered batch is the concurrency-control decision. If transactions declare read and write sets, schedulers can acquire locks and execute in a way that respects the known serial order.',
    invariant: 'All replicas execute equivalent deterministic work from the same transaction log.',
  };

  yield {
    state: architecture('Replicas execute the same ordered log'),
    highlight: { found: ['log', 'schedA', 'schedB', 'e-log-a', 'e-log-b'], active: ['storeA', 'storeB'] },
    explanation: 'Replication becomes log replication plus deterministic execution. Instead of discovering conflicts at commit time, the system pays coordination cost before execution.',
  };

  yield {
    state: labelMatrix(
      'Determinism moves the tradeoff',
      [
        { id: 'classic', label: 'classic 2PC' },
        { id: 'calvin', label: 'Calvin' },
        { id: 'spanner', label: 'Spanner' },
        { id: 'foundation', label: 'FoundationDB' },
      ],
      [
        { id: 'order', label: 'order decided' },
        { id: 'conflict', label: 'conflicts' },
        { id: 'price', label: 'price' },
      ],
      [
        ['during commit', 'runtime waits', 'coordination on path'],
        ['before execution', 'scheduled from log', 'known read/write sets'],
        ['timestamp + commit wait', 'MVCC/Paxos', 'clock uncertainty'],
        ['optimistic commit', 'resolver checks', 'retry work'],
      ],
    ),
    highlight: { found: ['calvin:order', 'calvin:conflict'], compare: ['classic:price', 'foundation:price'] },
    explanation: 'Calvin is a strong contrast case for Two-Phase Commit, Spanner, and FoundationDB. It does not remove coordination; it changes when coordination happens and what the execution engine can assume afterward.',
  };
}

function* crossShardExecution() {
  yield {
    state: architecture('Cross-shard transactions run from the same plan'),
    highlight: { active: ['schedA', 'schedB', 'storeA', 'storeB', 'e-schedA-schedB'], found: ['log'] },
    explanation: 'For a transaction that touches shards A and B, each shard receives the same log position. Schedulers coordinate execution according to that known order rather than racing to discover conflicts later.',
  };

  yield {
    state: labelMatrix(
      'Stored procedure style execution',
      [
        { id: 'declare', label: 'declare keys' },
        { id: 'order', label: 'sequence' },
        { id: 'lock', label: 'lock' },
        { id: 'execute', label: 'execute' },
        { id: 'reply', label: 'reply' },
      ],
      [
        { id: 'why', label: 'why it exists' },
        { id: 'failure', label: 'failure if missing' },
      ],
      [
        ['know read/write set', 'cannot schedule safely'],
        ['same serial order', 'replicas diverge'],
        ['avoid runtime deadlock', 'conflict stalls'],
        ['deterministic code path', 'nondeterminism breaks replicas'],
        ['commit already implied', 'late abort surprises client'],
      ],
    ),
    highlight: { active: ['declare:why', 'order:why', 'lock:why'], compare: ['execute:failure'] },
    explanation: 'The design is friendliest to transactions with known read/write sets or stored procedures that can be analyzed. If execution depends on unpredictable reads, Calvin needs extra handling or loses its clean path.',
  };

  yield {
    state: labelMatrix(
      'Where Calvin works well',
      [
        { id: 'hot', label: 'high contention' },
        { id: 'geo', label: 'geo replication' },
        { id: 'batch', label: 'ordered batches' },
        { id: 'adhoc', label: 'ad-hoc transactions' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['strong', 'preorder reduces deadlock/retry churn'],
        ['strong', 'replicate order before execution'],
        ['strong', 'sequencer amortizes work'],
        ['weaker', 'read/write sets may be unknown'],
      ],
    ),
    highlight: { found: ['hot:fit', 'geo:fit', 'batch:fit'], compare: ['adhoc:reason'] },
    explanation: 'Calvin shines when the workload benefits from deterministic scheduling and can expose enough transaction information early. It is less natural for arbitrary interactive transactions that discover their keys late.',
  };

  yield {
    state: architecture('The case-study lesson: serialize intent, then parallelize work'),
    highlight: { found: ['sequencer', 'log'], active: ['schedA', 'schedB', 'storeA', 'storeB'] },
    explanation: 'The broad pattern is useful beyond databases: put an agreed order or plan in front of a distributed execution engine, then let workers run with fewer runtime surprises.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'deterministic ordering') yield* deterministicOrdering();
  else if (view === 'cross-shard execution') yield* crossShardExecution();
  else throw new InputError('Pick a Calvin view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
      'Read the animation as a timing diagram for coordination. A transaction is a unit of database work that should appear to commit all at once, and a shard is one partition of the database. Active nodes show client submission, sequencing, log replication, scheduling, or storage execution.',
      {
          type: 'image',
          src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Base_de_Datos_distribuida_atravez_de_internet.jpg',
          alt: 'A distributed database diagram with several database nodes connected through the internet.',
          caption: 'A distributed database has to make separate machines behave like one service. Source: Wikimedia Commons, "Base de Datos distribuida atravez de internet.jpg" by Elkeko, public domain.',
        },
      {
          type: 'callout',
          text: 'The safe inference rule is this: if every shard receives the same ordered input log, and every transaction executes deterministically, then replicas do not need to discover a serial order at commit time. They already have one.',
        },
    ] },
    { heading: 'Why this exists', paragraphs: [
      'Distributed transactions exist because one business action can touch several machines. An order may debit an account on shard A, reserve inventory on shard B, and write an order row on shard C. Calvin moves the serial-order decision into a replicated input log before execution begins.',
      {
          type: 'callout',
          text: 'Calvin does not make coordination free. It changes the question from "did this distributed execution commit?" to "what ordered command did every replica receive before execution began?"',
        },
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is execute first and coordinate at commit. Two-Phase Commit asks participants to prepare, vote, and follow a coordinator decision. Optimistic systems run work first and validate conflicts later.',
      {
          type: 'image',
          src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Two_phase_commit_seq_diagram_success_01.png',
          alt: 'A sequence diagram showing the success path of a two-phase commit protocol.',
          caption: 'Two-Phase Commit waits for participants to prepare before the coordinator decides commit. Source: Wikimedia Commons, "Two phase commit seq diagram success 01.png" by Jayaprabhakar, CC0 1.0.',
        },
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is late conflict discovery. If 1,000 checkout transactions all touch sku4, optimistic execution may let all 1,000 run and then abort many. A deterministic order makes the queue visible before execution, so the scheduler can avoid deadlock and wasted conflict races.',
      {
          type: 'image',
          src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Two_Generals%27_Problem.svg',
          alt: 'Two separated armies that cannot communicate directly because messages may be intercepted in the valley.',
          caption: 'Unreliable communication is the root of distributed agreement problems. Source: Wikimedia Commons, "Two Generals\' Problem.svg" by Belbury, CC BY 4.0.',
        },
      {
          type: 'callout',
          text: 'The hidden enemy is not "distributed" by itself. It is late conflict discovery: the system learns the serial order only after locks, messages, speculative work, or clock waits have already entered the critical path.',
        },
    ] },
    { heading: 'The core insight', paragraphs: [
      'Serialize intent first, then parallelize safe work. The input log is the serial history the database promises to emulate. Schedulers acquire locks in log order and run non-conflicting operations in parallel.',
      {
          type: 'image',
          src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Basic_Paxos_without_failures.svg',
          alt: 'A Basic Paxos message-flow diagram with a client, proposer, acceptors, and learners.',
          caption: 'Consensus gives replicas one agreed value; a replicated log repeats that idea for an ordered sequence. Source: Wikimedia Commons, "Basic Paxos without failures.svg" by Iamfromspace, CC BY-SA 4.0.',
        },
      {
          type: 'callout',
          text: 'The log is doing two jobs at once: it is the serial history for concurrency control and the replay history for recovery.',
        },
    ] },
    { heading: 'How it works', paragraphs: [
      'Calvin has a sequencing layer, scheduling layer, and storage layer. The sequencing layer batches transaction requests into epochs and replicates the ordered input. The scheduling layer reads that order, acquires needed locks, and coordinates each shard piece.',
      {
          type: 'callout',
          text: 'The hardest part of Calvin is not drawing the log. It is enforcing the contract that everything after the log is deterministic enough to replay.',
        },
    ] },
    { heading: 'Why it works', paragraphs: [
      'The proof has three invariants: every replica sees the same ordered input log, every transaction is deterministic given the same input state, and every conflicting operation respects log order. If T1 appears before T2 and both touch acct7, T2 cannot take the conflicting lock before T1. Non-conflicting work can overlap because it cannot change either transaction result.',
      {
          type: 'image',
          src: 'https://commons.wikimedia.org/wiki/Special:FilePath/DRBD_concept_overview.png',
          alt: 'A replication diagram showing a local and remote block device synchronized over a network.',
          caption: 'Replication is only safe when the replicas apply equivalent updates. Source: Wikimedia Commons, "DRBD concept overview.png" by Nuno Tavares, CC BY-SA 2.5.',
        },
      {
          type: 'callout',
          text: 'Determinism is a correctness contract before it is an optimization. Performance comes from the extra facts that contract gives the scheduler.',
        },
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Calvin shifts cost from per-transaction commit coordination to batch ordering, log replication, deterministic locking, and known access sets. A batch of 1,000 transactions can amortize one replicated ordering decision across many executions. When late-discovered keys double, prediction or reconnaissance overhead grows and the clean deterministic path weakens.',
      {
          type: 'callout',
          text: 'Calvin is strongest when the ordering layer is cheaper than repeated runtime uncertainty. It is weakest when the ordering layer delays work that was already local and uncontended.',
        },
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'Calvin fits high-contention OLTP, geo-replicated transactions, and stored-procedure designs where access sets are known early. Inventory, payments, auctions, and ledger-like systems often value predictable conflict order. The broader pattern appears in replicated state machines, event sourcing, workflow engines, and block execution.',
      {
          type: 'image',
          src: 'https://commons.wikimedia.org/wiki/Special:FilePath/AgensSQL_HA_Clustering.png',
          alt: 'A high-availability database clustering architecture diagram with failover, failback, and load balancing.',
          caption: 'High-availability database designs often separate client routing, replication, and failover concerns. Source: Wikimedia Commons, "AgensSQL HA Clustering.png" by Gorgonzola-oh, CC BY-SA 4.0.',
        },
    ] },
    { heading: 'Where it fails', paragraphs: [
      'Calvin fails when transactions discover important keys only after reading data. If a transaction reads customer 42 to find address 789, the scheduler did not know address 789 at submission time. It also fails when local clocks, random numbers, external calls, or thread races make replicas diverge from the same log.',
      {
          type: 'callout',
          text: 'The nondeterminism failure mode is dangerous because the log can be perfectly correct while the replicas still drift.',
        },
    ] },
    { heading: 'Worked example', paragraphs: [
      'Batch 47 has T1 debit acct7 on shard A, T2 reserve sku4 on shard B, T3 place an order touching acct7, sku4, and order1001, and T4 reserve sku9 on shard B. Shard A runs T1 before T3 for acct7, shard B runs T2 before T3 for sku4, and T4 can overlap because sku9 is independent. T3 still exchanges read values, but it does not need a normal 2PC vote because its serial slot is already in the replicated log.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: Calvin SIGMOD 2012 at https://www.cs.yale.edu/homes/dna/papers/calvin-sigmod12.pdf, Ren et al. VLDB 2014 at https://www.vldb.org/pvldb/vol7/p821-ren.pdf, Schneider state-machine replication at https://www.cs.cornell.edu/fbs/publications/SMSurvey.pdf, and Lamport Paxos Made Simple at https://lamport.azurewebsites.net/pubs/paxos-simple.pdf.',
      'Study Two-Phase Commit, Paxos, Raft Log Replication, Write-Ahead Logging, Spanner, FoundationDB, Isolation Levels, BOHM, and Aria next.',
    ] },
  ],
};
