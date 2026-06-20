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
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. The deterministic-ordering view traces a transaction batch from clients through the sequencer and replicated log to shard schedulers and storage. The cross-shard execution view zooms in on how two shards coordinate work from the same log position.',
        {
          type: 'bullets',
          items: [
            'Active nodes are the components handling the current phase -- the client submitting, the sequencer batching, the scheduler locking, or the storage applying.',
            'Compare nodes are components waiting for the current phase to finish before they can act.',
            'Found nodes mark state that is now committed and agreed -- a log entry replicated, a serial slot assigned, a cross-shard execution plan settled.',
            'Edge labels carry the protocol action: "submit," "ordered batch," "same order," "execute," "lockstep." Follow the labels to trace where the ordering decision lives relative to execution.',
          ],
        },
        'One safe inference rule: if the replicated log carries an ordered batch to all shard schedulers before any scheduler begins executing, then every replica processes conflicting transactions in the same serial order. That is the Calvin guarantee made visible.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Distributed transactions are hard because shards must agree on order. In a conventional system, each shard discovers order during execution -- locking records, waiting for remote participants, aborting when conflicts emerge. The coordination happens at the worst possible time: while locks are held, while the client is waiting, while CPU cycles are being spent on work that might be thrown away.',
        {
          type: 'quote',
          text: 'Calvin is designed to run alongside a non-transactional storage system, transforming it into a shared-nothing distributed database system that provides ACID transactions and full replication.',
          attribution: 'Thomson, Diamond, Weng, Ren, Shao, Abadi -- "Calvin: Fast Distributed Transactions for Partitioned Database Systems," SIGMOD 2012',
        },
        'The cost is measurable. In a classic Two-Phase Commit system, a cross-shard transaction at minimum requires: one round-trip to the coordinator to prepare, one disk sync per participant, one round-trip to decide commit or abort, and another disk sync to apply. If any participant votes abort, all work is discarded. Under high contention, the same hot records cause repeated deadlocks, aborts, and retries. Each retry burns the same coordination cost again.',
        {
          type: 'table',
          headers: ['Cost', '2PC per transaction', 'Calvin per batch'],
          rows: [
            ['Coordination round-trips', '2-3 per cross-shard txn', '1 (log replication, amortized over batch)'],
            ['Disk syncs on critical path', '2 per participant', '1 (log sync before execution)'],
            ['Wasted work on abort', 'Full execution + lock time', 'None (order decided before execution)'],
            ['Deadlock risk', 'Grows with contention', 'Eliminated by predetermined order'],
          ],
        },
        'Calvin asks: what if the database settles the serial order before any shard executes a single operation? Move the coordination cost out of the execution path and into a sequencing layer that runs before workers touch records.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The standard approach to distributed transactions is some variant of execute first, coordinate at commit. There are three major families.',
        {
          type: 'table',
          headers: ['Approach', 'How it works', 'When coordination happens'],
          rows: [
            ['Two-Phase Commit', 'Execute on each shard, then coordinator asks all participants to prepare and commit', 'At commit time, after locks are held'],
            ['Optimistic Concurrency Control', 'Execute without locks, validate at commit, retry if conflicts detected', 'At validation time, after execution is complete'],
            ['Timestamp Ordering (Spanner)', 'Assign globally synchronized timestamps, use MVCC to order reads and writes', 'At timestamp assignment, requires TrueTime or similar'],
          ],
        },
        'Each approach works. Teams reach for 2PC because it is well-understood, supported by most databases, and correct. Optimistic systems are attractive for read-heavy workloads where conflicts are rare. Spanner-style timestamp ordering gives strong consistency without locking, at the cost of specialized clock hardware.',
        'These are reasonable engineering choices. Calvin does not claim they are wrong. It claims they all pay coordination cost in the wrong place.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that all three approaches couple coordination to the execution path. The consequences compound under load.',
        {
          type: 'bullets',
          items: [
            '2PC holds locks while waiting for remote participants. A slow shard or network partition stalls all participants, and lock duration grows with the slowest node.',
            'OCC wastes execution time. Under high contention, the same hot record causes repeated validation failures. Each retry re-executes the full transaction.',
            'Timestamp ordering requires expensive infrastructure (TrueTime) or introduces commit-wait delays to handle clock uncertainty.',
            'All three approaches scale coordination cost linearly with the number of cross-shard transactions, not with the batch size.',
          ],
        },
        'The critical metric is contention amplification. If 100 transactions per second all write to the same hot record under 2PC, each transaction waits for the previous one to release its lock, commit across participants, and free the record. Throughput collapses to the inverse of the round-trip coordination latency. Under OCC, 99 of those 100 transactions will abort and retry. Under timestamp ordering, commit-wait delays add up because each transaction must wait out the clock uncertainty before it can safely commit.',
        {
          type: 'note',
          text: 'The wall is not coordination itself -- any serializable system must coordinate conflicting transactions. The wall is when and how the coordination cost is paid. Calvin moves the cost to a sequencing phase that runs before any shard begins work.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Serialize intent first, then parallelize deterministic work. If every shard agrees on the serial order of transactions before execution starts, each shard can independently execute its portion without runtime coordination with other shards.',
        {
          type: 'diagram',
          text: [
            '  Traditional approach:          Calvin approach:',
            '',
            '  Client ----> Shard A            Client ----> Sequencer',
            '          \\--> Shard B                           |',
            '               |   |                       Replicated Log',
            '          [execute, lock]                   /          \\',
            '               |   |                 Scheduler A   Scheduler B',
            '          [2PC prepare]               [deterministic  [deterministic',
            '               |   |                  execution]       execution]',
            '          [2PC commit]                      |               |',
            '               |   |                  Storage A       Storage B',
            '          [release locks]',
            '               |   |',
            '          Storage A  B',
          ].join('\n'),
          label: 'Traditional systems coordinate during execution. Calvin coordinates before execution.',
        },
        'The insight has a precise condition: transactions must declare their read and write sets before the sequencer assigns their position. If the sequencer knows which records each transaction will touch, it can place conflicting transactions in a total order and guarantee that every shard respects that order. Non-conflicting transactions can run in parallel.',
        {
          type: 'note',
          text: 'This is not a new idea in distributed systems theory. Deterministic state-machine replication has been studied since Schneider (1990). Calvin is the first system to apply it to general-purpose database transactions at scale, solving the practical problems of unknown read sets, straggler nodes, and sequencer availability.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Calvin has three layers, each with a specific contract.',
        {
          type: 'table',
          headers: ['Layer', 'Role', 'Contract'],
          rows: [
            ['Sequencing layer', 'Collect transaction requests, assign a global serial order, replicate the ordered log', 'Every replica sees the same batch in the same order'],
            ['Scheduling layer', 'Acquire locks in serial order, manage cross-shard data exchange', 'Conflicting transactions execute in log order; non-conflicting transactions run in parallel'],
            ['Storage layer', 'Apply reads and writes to local data', 'Deterministic execution: same input state + same transaction = same output state'],
          ],
        },
        'The sequencing layer batches incoming transactions into 10-millisecond epochs. Each batch is assigned a monotonically increasing batch ID and replicated to all replicas using Paxos (or any consensus protocol). Once a replica receives a batch, it can begin scheduling without waiting for any further coordination.',
        {
          type: 'code',
          language: 'text',
          text: [
            'Sequencing timeline (10ms epochs):',
            '',
            '  Epoch 1:  [T1, T2, T3]         -> Paxos replicate -> all replicas',
            '  Epoch 2:  [T4, T5]              -> Paxos replicate -> all replicas',
            '  Epoch 3:  [T6, T7, T8, T9]      -> Paxos replicate -> all replicas',
            '',
            '  Within each epoch, transactions are ordered by arrival.',
            '  Cross-epoch ordering is guaranteed by batch ID.',
            '  Paxos ensures all replicas see identical epoch contents.',
          ].join('\n'),
        },
        'The scheduling layer uses deterministic lock acquisition. For each transaction in log order, the scheduler acquires read and write locks on the declared keys. Because all schedulers process the same log in the same order, they all acquire locks in the same sequence. This eliminates deadlock: deadlocks require two transactions to acquire locks in different orders, which cannot happen when the order is predetermined.',
        {
          type: 'diagram',
          text: [
            '  Log order: T1, T2, T3',
            '',
            '  Scheduler (shard A):            Scheduler (shard B):',
            '    T1: lock(acct7) -> execute     T2: lock(cart9) -> execute',
            '    T3: lock(acct7) -> wait T1     T3: lock(cart9) -> wait T2',
            '    T1 done -> T3 runs             T2 done -> T3 runs',
            '',
            '  T3 touches both shards. Each shard independently schedules',
            '  T3 after its local predecessors finish. No cross-shard',
            '  locking protocol is needed.',
          ].join('\n'),
          label: 'Deterministic lock scheduling: both shards derive the same execution order from the same log',
        },
        'For cross-shard transactions, each shard executes only its local portion. If T3 needs to read a value from shard B and write to shard A, shard B sends the read result to shard A as part of the deterministic execution plan. Both shards know from the log that T3 is a cross-shard transaction and which data exchange is needed.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Calvin\'s correctness rests on two invariants and one assumption.',
        {
          type: 'table',
          headers: ['Property', 'What it guarantees', 'What breaks without it'],
          rows: [
            ['Log order preservation', 'Conflicting transactions execute in the serial order assigned by the replicated log', 'Shards disagree on which transaction won a conflict, causing state divergence'],
            ['Deterministic execution', 'Given the same input state and the same transaction code, every replica produces the same output', 'Replicas diverge silently; reads return different values on different replicas'],
            ['Known read/write sets', 'The scheduler can acquire all locks before execution begins', 'Mid-execution lock requests break the predetermined order; deadlock becomes possible'],
          ],
        },
        'The log order invariant is enforced by Paxos replication of the sequencer output. Once a batch is committed by a Paxos quorum, every correct replica will eventually receive the same batch contents in the same position. The scheduling layer acquires locks in log order, so conflicting transactions are serialized identically on every replica.',
        'The deterministic execution invariant means that transaction code must be pure with respect to its inputs. No clock reads, no random number generation, no external service calls, no hash-map iteration with unspecified order. If a transaction needs a timestamp or random value, the sequencer must assign it as part of the transaction input before replication.',
        {
          type: 'note',
          text: 'This is the stored-procedure model. Calvin transactions are closest to database stored procedures where the code and parameters are fully specified before execution. Ad-hoc interactive transactions that read a value and then decide what to do next require a special reconnaissance phase (OLLP -- Optimistic Lock Location Prediction) that pre-reads dependent data before sequencing.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Calvin shifts cost from per-transaction coordination to per-batch sequencing.',
        {
          type: 'table',
          headers: ['Operation', 'Cost', 'What dominates'],
          rows: [
            ['Sequencing a batch', 'One Paxos round per epoch (10ms)', 'Network latency between sequencer replicas'],
            ['Log replication', 'One message per replica per epoch', 'Bandwidth scales with batch size, not transaction count'],
            ['Lock acquisition', 'O(k) per transaction, k = keys touched', 'Sequential acquisition in log order; no deadlock detection needed'],
            ['Cross-shard data exchange', 'One message per shard pair per cross-shard txn', 'Network latency between shards, not coordination protocol overhead'],
            ['Execution', 'Same as any database execution', 'CPU, I/O, and memory for actual data operations'],
          ],
        },
        'The key cost trade-off: Calvin pays a fixed cost per batch (Paxos replication of the log) instead of a per-transaction cost (2PC coordination). For a batch of 1,000 transactions, the Paxos round is amortized across all 1,000. In a 2PC system, each cross-shard transaction pays its own coordination cost.',
        'The throughput ceiling is the sequencer. A single sequencer node in the original Calvin paper achieved 500,000 transactions per second of sequencing throughput, far exceeding the execution throughput of typical OLTP workloads. For higher throughput, the sequencer can be partitioned, though cross-partition transactions then need an extra ordering step.',
        {
          type: 'note',
          text: 'Calvin adds latency to single-shard transactions that would not need coordination in a traditional system. A simple single-key write that could complete in one local disk sync now waits for the batch epoch (up to 10ms) plus Paxos replication. The trade-off is worthwhile only when cross-shard transactions or high contention would cost more under traditional coordination.',
        },
        'The 10ms epoch is a tuning knob. Shorter epochs reduce latency but increase Paxos overhead per transaction. Longer epochs improve amortization but add latency. The original paper found 10ms was the sweet spot for OLTP workloads with thousands of transactions per second.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'An e-commerce system processes orders across three shards: accounts (shard A), inventory (shard B), and orders (shard C). Four transactions arrive in a 10ms window.',
        {
          type: 'code',
          language: 'text',
          text: [
            'Batch 47 (epoch at time T):',
            '',
            '  Slot 1: T1  read(acct:7), write(acct:7)           -- debit account',
            '               shards: {A}',
            '',
            '  Slot 2: T2  read(inv:sku4), write(inv:sku4)       -- reserve stock',
            '               shards: {B}',
            '',
            '  Slot 3: T3  read(acct:7), read(inv:sku4),         -- place order',
            '               write(acct:7), write(inv:sku4),',
            '               write(ord:1001)',
            '               shards: {A, B, C}',
            '',
            '  Slot 4: T4  read(inv:sku9), write(inv:sku9)       -- reserve stock',
            '               shards: {B}',
          ].join('\n'),
        },
        'After Paxos replication, every replica has batch 47 with the same four slots. Each shard scheduler examines the batch and identifies its relevant transactions.',
        {
          type: 'table',
          headers: ['Shard', 'Relevant transactions', 'Lock order', 'Parallelism'],
          rows: [
            ['A (accounts)', 'T1, T3', 'T1 locks acct:7 first, T3 waits', 'T1 and T3 are serial (same key)'],
            ['B (inventory)', 'T2, T3, T4', 'T2 locks sku4, T3 waits for T2, T4 runs parallel (different key)', 'T4 can overlap with T2 and T3'],
            ['C (orders)', 'T3 only', 'No contention', 'Executes immediately when T3 is ready'],
          ],
        },
        'T3 is a cross-shard transaction. Shard B reads inv:sku4 and sends the value to shard A and shard C. Shard A reads acct:7 (after T1 finishes) and applies the debit. Shard C writes the order record. All three shards know from the log that T3 is in slot 3 and touches all three shards. No 2PC protocol is needed -- each shard independently executes T3\'s local operations in the predetermined position.',
        'T4 writes sku9, which does not conflict with T2 or T3 (they write sku4). Shard B\'s scheduler can run T4 in parallel with T2. The log order only constrains conflicting operations.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Calvin\'s design pattern -- deterministic ordering before execution -- appears in several production systems and research successors.',
        {
          type: 'table',
          headers: ['System', 'How it uses the Calvin pattern', 'Key difference'],
          rows: [
            ['FaunaDB (now Fauna)', 'Built directly on Calvin; deterministic transaction ordering with Raft-based log replication', 'Uses Raft instead of Paxos; adds document model and GraphQL interface'],
            ['BOHM (Yale, 2014)', 'Extends Calvin with multi-version concurrency control to reduce blocking on read-write conflicts', 'Readers never block writers; maintains deterministic ordering for writes'],
            ['PWV (Yale, 2017)', 'Piece-Wise Visibility: allows transactions to expose partial results early while maintaining serial equivalence', 'Relaxes visibility ordering without breaking serializability'],
            ['Aria (Lu et al., 2020)', 'Deterministic concurrency control for blockchains; batch-and-order before execution', 'Designed for blockchain smart contract execution with known read/write sets'],
          ],
        },
        'Calvin fits best where three conditions hold: cross-shard transactions are frequent enough that 2PC coordination is a bottleneck, contention on hot records is high enough that optimistic retries waste significant work, and transactions can declare (or pre-compute) their read and write sets before execution.',
        {
          type: 'bullets',
          items: [
            'High-contention OLTP: payment systems, inventory management, auction platforms where many transactions compete for the same hot records.',
            'Geo-replicated databases: replicating the ordered log across data centers is cheaper than running 2PC across continents. Each region executes deterministically from the same log.',
            'Deterministic simulation and testing: because execution is deterministic given the log, the entire database can be replayed from the log for debugging, auditing, or disaster recovery.',
            'Blockchain and smart contracts: transaction ordering is inherently a sequencing problem. Calvin\'s batch-and-order model maps naturally to block construction.',
          ],
        },
        'The broader pattern -- agree on a plan, then execute without coordination -- appears in event sourcing (the event log is the plan), deterministic lockstep simulation (all nodes process the same tick), and workflow orchestration (the DAG is the plan).',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Calvin\'s design has three structural weaknesses that limit its applicability.',
        {
          type: 'table',
          headers: ['Weakness', 'Root cause', 'Consequence'],
          rows: [
            ['Dependent reads', 'Transaction must discover keys after reading data', 'Requires OLLP pre-read phase, adding latency and complexity'],
            ['Straggler amplification', 'All transactions in a batch must complete before the next batch can reuse their locks', 'One slow transaction delays the entire batch window on its shard'],
            ['Sequencer availability', 'Global ordering requires a highly available sequencer', 'Sequencer failure halts all new transactions, even if storage nodes are healthy'],
            ['Nondeterminism bugs', 'Any source of nondeterminism in transaction code causes silent replica divergence', 'Extremely hard to debug; replicas drift without any error signal'],
          ],
        },
        'The dependent-read problem is the most fundamental. Consider a transaction that reads a customer record, extracts the customer\'s shipping address ID, then reads the shipping address. The second read depends on the first. Calvin cannot schedule this transaction without knowing which address record it will touch. The OLLP solution adds a reconnaissance query before sequencing: read the customer record to discover the address key, then submit the full transaction with all keys declared. This adds a round-trip and makes the system less transparent.',
        {
          type: 'code',
          language: 'text',
          text: [
            'Dependent read problem:',
            '',
            '  Transaction: "ship order for customer 42"',
            '',
            '  Step 1: read customer(42) -> address_id = 789',
            '  Step 2: read address(789) -> "123 Main St"',
            '  Step 3: write shipment(order_id, "123 Main St")',
            '',
            '  Calvin cannot schedule this without knowing address(789)',
            '  is needed. Solutions:',
            '',
            '  (a) OLLP: pre-read customer(42) to discover 789,',
            '      then submit {read: [cust:42, addr:789], write: [ship:X]}',
            '      Risk: address_id may change between pre-read and execution',
            '',
            '  (b) Pessimistic: declare all possible address keys',
            '      Wastes lock scope; reduces parallelism',
            '',
            '  (c) Stored procedure: encode the logic so the database',
            '      can statically analyze the key dependencies',
          ].join('\n'),
        },
        'Straggler amplification is a practical concern in large deployments. If one shard has a slow disk or a garbage collection pause, it delays execution of its batch window. Other shards that share cross-shard transactions with the slow shard must wait. In a 2PC system, only the transactions touching the slow shard are affected. In Calvin, batch-level coupling means the straggler affects the entire epoch.',
        {
          type: 'note',
          text: 'The nondeterminism failure mode is insidious. Two replicas processing the same log with the same transaction code will produce different output if any operation is nondeterministic -- a HashMap iteration order difference, a floating-point rounding difference across CPU architectures, a thread-scheduling dependency. The log looks correct on both replicas. Only a checksum comparison or audit reveals the drift, and by then the damage may have propagated through subsequent transactions.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'quote',
          text: 'By preprocessing transactions into batches and replicating these batches using Paxos, all replicas of each partition can be made to process the same sequence of transactions in the same deterministic order, thereby guaranteeing equivalence of replicated state.',
          attribution: 'Thomson et al., "Calvin: Fast Distributed Transactions for Partitioned Database Systems," SIGMOD 2012',
        },
        {
          type: 'table',
          headers: ['Source', 'What it covers', 'Link'],
          rows: [
            ['Calvin (Thomson et al., SIGMOD 2012)', 'Original paper: architecture, sequencing, scheduling, TPC-C benchmarks', 'https://www.cs.yale.edu/homes/dna/papers/calvin-sigmod12.pdf'],
            ['An Evaluation of the Advantages and Disadvantages of Deterministic Database Systems (Ren et al., VLDB 2014)', 'Follow-up analysis of when Calvin wins and loses vs. traditional systems', 'https://www.vldb.org/pvldb/vol7/p821-ren.pdf'],
            ['BOHM: BOttom-up Hardware-oblivious Multiversioning (Faleiro and Abadi, 2015)', 'Calvin + MVCC to reduce read-write blocking', 'https://dl.acm.org/doi/10.1145/2723372.2723742'],
            ['Aria: A Fast and Practical Deterministic OLTP Database (Lu et al., VLDB 2020)', 'Deterministic execution for blockchains and modern OLTP', 'https://www.vldb.org/pvldb/vol13/p2047-lu.pdf'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: understand Two-Phase Commit, Paxos consensus, and Write-Ahead Logging before studying Calvin. Calvin assumes familiarity with these building blocks.',
            'Contrast: compare Calvin with Spanner (timestamp ordering + TrueTime) and FoundationDB (optimistic concurrency + deterministic simulation). All three solve distributed transactions differently.',
            'Extension: study BOHM for how MVCC can be layered on top of deterministic ordering, and Aria for how the pattern applies to blockchain transaction processing.',
            'Related pattern: study event sourcing and command-query responsibility segregation (CQRS). The idea of logging intent before execution appears in both, though without Calvin\'s lock scheduling.',
            'Inside this curriculum, follow Etcd Raft, Spanner, FoundationDB, Isolation Levels, and Transactional Outbox case studies.',
          ],
        },
      ],
    },
  ],
};
