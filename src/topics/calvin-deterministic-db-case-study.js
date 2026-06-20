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
        'Read the animation as a timing diagram for coordination. The deterministic-ordering view traces a transaction batch from clients through the sequencer and replicated log to shard schedulers and storage. The cross-shard execution view shows how two shards can do local work from the same log position without running a commit-time vote after execution.',
        {
          type: 'image',
          src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Base_de_Datos_distribuida_atravez_de_internet.jpg',
          alt: 'A distributed database diagram with several database nodes connected through the internet.',
          caption: 'A distributed database has to make separate machines behave like one service. Source: Wikimedia Commons, "Base de Datos distribuida atravez de internet.jpg" by Elkeko, public domain.',
        },
        {
          type: 'bullets',
          items: [
            'Active nodes are the components handling the current phase -- the client submitting, the sequencer batching, the scheduler locking, or the storage applying.',
            'Compare nodes are components waiting for the current phase to finish before they can act.',
            'Found nodes mark state that is now agreed by the protocol -- a log entry replicated, a serial slot assigned, or a cross-shard execution plan settled.',
            'Edge labels carry the protocol action: "submit," "ordered batch," "same order," "execute," "lockstep." Follow the labels to trace where the ordering decision lives relative to execution.',
          ],
        },
        {
          type: 'callout',
          text: 'The safe inference rule is this: if every shard receives the same ordered input log, and every transaction executes deterministically, then replicas do not need to discover a serial order at commit time. They already have one.',
        },
        'The animation is not claiming that messages disappear. Clients still submit requests, sequencers still replicate a log, shards still exchange read values, and failures still require recovery. The claim is narrower and stronger: Calvin moves the expensive agreement about transaction order before the database starts doing transactional work.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A transaction is easy on one machine because the machine has one memory image, one lock table, one log, and one failure boundary. A distributed transaction breaks that simplicity. The account row may live on shard A, the inventory row on shard B, and the order row on shard C. The database must still make the result look like one serial transaction happened.',
        'The first-principles problem is order. If two transactions touch the same item, a serializable database must decide which one is first. If the transactions touch different shards, that decision must be visible at every shard that can observe the conflict. If different replicas choose different winners, the database has not merely returned a stale answer; it has forked its state.',
        {
          type: 'quote',
          text: 'Calvin is designed to run alongside a non-transactional storage system, transforming it into a shared-nothing distributed database system that provides ACID transactions and full replication.',
          attribution: 'Thomson, Diamond, Weng, Ren, Shao, Abadi -- "Calvin: Fast Distributed Transactions for Partitioned Database Systems," SIGMOD 2012',
        },
        'The standard design discovers that order while executing. Shards acquire locks, perform reads, exchange messages, and then run an atomic commit protocol to decide whether every participant can make the result durable. That is correct, but it coordinates at the worst moment: locks are held, the client is waiting, and the system may have already spent CPU and I/O on work that later aborts.',
        {
          type: 'table',
          headers: ['Pressure', 'Traditional distributed transaction', 'Calvin move'],
          rows: [
            ['Order', 'Discovered during locking, validation, or commit', 'Chosen before execution in a replicated input log'],
            ['Atomicity', 'Participants vote after doing work', 'A deterministic transaction that is in the log is expected to run to the same result at every replica'],
            ['Deadlocks', 'Possible when transactions take locks in incompatible orders', 'Avoided by acquiring locks according to the log order'],
            ['Recovery', 'Recover each participant from local commit-log state', 'Replay the deterministic input log from a checkpoint'],
          ],
        },
        {
          type: 'callout',
          text: 'Calvin does not make coordination free. It changes the question from "did this distributed execution commit?" to "what ordered command did every replica receive before execution began?"',
        },
        'That is why Calvin belongs in a data-structures course. It turns a distributed transaction system into an ordered-log problem. The log is not only a recovery artifact. It is the data structure that carries the serial order, replication boundary, and replay recipe.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is execute first, coordinate later. It is obvious because it preserves the local database mental model: each shard runs its part of the transaction, records tentative changes, and waits for a coordinator or validator to decide the final outcome.',
        {
          type: 'image',
          src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Two_phase_commit_seq_diagram_success_01.png',
          alt: 'A sequence diagram showing the success path of a two-phase commit protocol.',
          caption: 'Two-Phase Commit waits for participants to prepare before the coordinator decides commit. Source: Wikimedia Commons, "Two phase commit seq diagram success 01.png" by Jayaprabhakar, CC0 1.0.',
        },
        {
          type: 'table',
          headers: ['Approach', 'How it works', 'When coordination happens'],
          rows: [
            ['Two-Phase Commit', 'Participants execute locally, force prepare state, vote, then receive commit or abort', 'At commit time, while locks and resources may be held'],
            ['Optimistic concurrency control', 'Run without blocking, validate reads and writes at commit, retry if the validation fails', 'After execution, when wasted work is already possible'],
            ['Spanner-style transactions', 'Use Paxos-replicated shards, MVCC, TrueTime timestamps, two-phase commit for multi-participant writes, and commit wait for external consistency', 'During transaction coordination and timestamp assignment'],
            ['FoundationDB-style optimistic transactions', 'Read from a version, compute writes, then resolvers check conflicts before commit', 'At commit validation, with retry as the normal conflict response'],
          ],
        },
        'Each approach is reasonable. Two-Phase Commit is a classic atomic-commit protocol with well-understood recovery rules. Optimistic systems are strong when conflicts are rare because most transactions avoid lock waits. Spanner is a production proof that carefully engineered clocks, Paxos replication, and commit protocols can deliver externally consistent transactions at global scale.',
        'Calvin is not a proof that these systems are wrong. It is a different bet about workload shape. If many transactions are cross-shard or high-contention, discovering conflicts late makes the database pay for uncertainty again and again. Calvin tries to turn uncertainty into an input-ordering problem.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is not the existence of coordination. Any serializable system has to coordinate conflicting writes somehow. The wall is coupling that coordination to live execution.',
        {
          type: 'bullets',
          items: [
            '2PC holds locks while waiting for remote participants. A slow shard or network partition stalls all participants, and lock duration grows with the slowest node.',
            'OCC wastes execution time. Under high contention, the same hot record causes repeated validation failures. Each retry re-executes the full transaction.',
            'Spanner-style external consistency uses clock uncertainty as a correctness boundary. Commit wait is not a bug; it is the price paid to make timestamp order match real-time order.',
            'A network partition turns every "wait for the other side" step into a liveness question. A correct system must choose between refusing work, risking stale or divergent work, or routing around the partition through replicas that still form a quorum.',
          ],
        },
        {
          type: 'image',
          src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Two_Generals%27_Problem.svg',
          alt: 'Two separated armies that cannot communicate directly because messages may be intercepted in the valley.',
          caption: 'Unreliable communication is the root of distributed agreement problems. Source: Wikimedia Commons, "Two Generals\' Problem.svg" by Belbury, CC BY 4.0.',
        },
        'The critical metric is contention amplification. Suppose many transactions write the same inventory row. Under locking, each transaction waits while the previous transaction holds the lock and coordinates commit. Under optimistic validation, many transactions can run at once but only one can safely win; the losers retry and add more load to the same hotspot. Under global timestamp systems, the timestamp machinery must still preserve a real serial order.',
        {
          type: 'callout',
          text: 'The hidden enemy is not "distributed" by itself. It is late conflict discovery: the system learns the serial order only after locks, messages, speculative work, or clock waits have already entered the critical path.',
        },
        'Ren, Thomson, and Abadi measured this tradeoff directly in their 2014 VLDB evaluation. Their deterministic prototype avoided deadlocks and simplified commit, but it also paid for a preprocessing layer, required known access sets for deterministic locking, and suffered when one machine in an eight-node EC2 cluster slowed down. With cross-shard transactions involving the slow node, other nodes became dependent on it and cluster throughput fell toward the slowest participant.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Serialize intent first, then parallelize deterministic work. That is the core idea.',
        'A database transaction has two separable questions. The first is logical: what serial order should this transaction occupy relative to other transactions? The second is physical: which machines have to read and write which records to realize that serial order? Traditional systems answer both during execution. Calvin answers the first question before execution and lets the second proceed with fewer surprises.',
        {
          type: 'image',
          src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Basic_Paxos_without_failures.svg',
          alt: 'A Basic Paxos message-flow diagram with a client, proposer, acceptors, and learners.',
          caption: 'Consensus gives replicas one agreed value; a replicated log repeats that idea for an ordered sequence. Source: Wikimedia Commons, "Basic Paxos without failures.svg" by Iamfromspace, CC BY-SA 4.0.',
        },
        {
          type: 'table',
          headers: ['Object', 'First-principles role in Calvin'],
          rows: [
            ['Input log', 'A replicated sequence of transaction requests; this is the serial order the database must emulate'],
            ['Read/write set', 'The keys a transaction may touch; the scheduler needs this to acquire locks before executing'],
            ['Deterministic transaction code', 'A function from input state and parameters to output state; replicas must not branch on private randomness, local time, or thread race order'],
            ['Scheduler', 'A lock-order machine that admits parallelism only when doing so cannot change the serial order'],
            ['Storage engine', 'A local data manager that applies reads and writes after the ordering and locking decisions are settled'],
          ],
        },
        'The insight has a precise condition: the scheduler must know enough about a transaction before execution to acquire its locks in log order. The sequencer does not have to compute the conflict graph; it simply gives every transaction a position. The schedulers use declared or predicted access sets to make that position executable without deadlock.',
        {
          type: 'callout',
          text: 'The log is doing two jobs at once: it is the serial history for concurrency control and the replay history for recovery.',
        },
        'This is state-machine replication applied to transactional storage. Schneider\'s state-machine approach says that deterministic replicas that process the same commands in the same order stay equivalent. Calvin adapts that principle to partitioned OLTP by adding a sequencing layer, deterministic lock scheduling, and mechanisms for transactions whose access sets are not obvious at submission time.',
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
            ['Sequencing layer', 'Collect requests, batch them, assign log positions, replicate the ordered input', 'Every replica receives the same transaction sequence'],
            ['Scheduling layer', 'Acquire locks in log order and coordinate local pieces of cross-shard transactions', 'Conflicting operations respect the log; independent operations may overlap'],
            ['Storage layer', 'Read and write local records', 'Given the same state and transaction input, execution produces the same state transition'],
          ],
        },
        'The sequencing layer batches incoming transactions into short epochs. The original Calvin paper describes 10 ms epochs and reports that a single sequencer machine could order more than 500,000 transactions per second, making sequencing cheaper than execution for their tested OLTP workloads. In larger deployments, Calvin can partition sequencing work, but any design that accepts transactions at multiple sequencers must still merge their outputs into one deterministic order for transactions that may conflict.',
        {
          type: 'code',
          language: 'text',
          text: [
            'Sequencing timeline:',
            '',
            '  Epoch 47: [T1, T2, T3]      -> replicate log position 47 -> all replicas',
            '  Epoch 48: [T4, T5]          -> replicate log position 48 -> all replicas',
            '  Epoch 49: [T6, T7, T8, T9]  -> replicate log position 49 -> all replicas',
            '',
            '  Within an epoch, the sequencer chooses a deterministic order.',
            '  Across epochs, the epoch number orders batches.',
            '  Replication makes the ordered input durable and visible to replicas.',
          ].join('\n'),
        },
        'The scheduling layer uses deterministic lock acquisition. For each transaction in log order, the scheduler requests the needed locks. A later transaction can run before an earlier transaction only when it does not conflict with the earlier transaction on that shard. Deadlock disappears because cycles need incompatible acquisition orders, and Calvin makes the acquisition order a function of the log.',
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
        'For cross-shard transactions, each shard executes its local portion and sends required read results to the other participants. This is still runtime communication. The difference is that the communication is not a vote about whether the transaction gets to commit. The log has already placed the transaction in the serial history, and deterministic execution makes every replica reach the same decision when the transaction contains only deterministic logic.',
        {
          type: 'callout',
          text: 'The hardest part of Calvin is not drawing the log. It is enforcing the contract that everything after the log is deterministic enough to replay.',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Calvin\'s correctness rests on three invariants.',
        {
          type: 'table',
          headers: ['Invariant', 'What it guarantees', 'What breaks without it'],
          rows: [
            ['Same input sequence', 'Every replica sees the same ordered transaction log', 'Replicas may serialize transactions differently'],
            ['Deterministic transition', 'Same state plus same transaction input yields the same next state', 'Replicas may diverge even with the same log'],
            ['Log-order conflict handling', 'If two transactions conflict, the later one cannot observe effects that violate the earlier log position', 'The produced history may not be equivalent to the log order'],
          ],
        },
        'The proof sketch is short because the log does the heavy work. Take any two conflicting transactions T1 and T2. The replicated log orders them, say T1 before T2. Every scheduler sees that same order. Because locks are requested according to the log, T2 cannot perform a conflicting operation that overtakes T1. Non-conflicting transactions may interleave because their operations commute with respect to the records they touch.',
        'The deterministic transition invariant is stricter than normal ACID language. A transaction may not read the local wall clock, call a random generator, use an external service response, depend on undefined map iteration order, or branch on a thread race unless that value was turned into part of the replicated input. If a transaction needs a timestamp, the sequencer should provide it. If it needs a random seed, the seed belongs in the log.',
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
        'The known-access-set requirement is the practical hinge. Calvin is most natural for stored procedures and request formats where the database can know the read and write keys up front. If a transaction reads one row to discover which second row it must read, Calvin needs a reconnaissance step such as Optimistic Lock Location Prediction. Ren et al. describe OLLP as a test run that discovers the records to lock, then restarts with an annotated access set if the prediction was wrong.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Calvin shifts cost from per-transaction commit coordination to per-batch input agreement and deterministic scheduling. That is a trade, not a free lunch.',
        {
          type: 'table',
          headers: ['Operation', 'Cost', 'What dominates'],
          rows: [
            ['Sequencing a batch', 'One ordered position per batch, replicated by a consensus or log-replication mechanism', 'Network latency among sequencer replicas and the number of independent sequencers that must be merged'],
            ['Log replication', 'Replicate transaction descriptions before execution', 'Bandwidth scales with input size and replica count'],
            ['Lock acquisition', 'O(k) per transaction, k = keys touched', 'Sequential acquisition in log order; no deadlock detection needed'],
            ['Cross-shard data exchange', 'Messages for remote read values and local execution pieces', 'Network latency between shards, not atomic-commit voting'],
            ['Execution', 'Same as any database execution', 'CPU, I/O, and memory for actual data operations'],
            ['Late access discovery', 'Reconnaissance or retry when read/write sets are not known', 'Extra latency and wasted work for dependent reads'],
          ],
        },
        'The key asymptotic move is amortization. A 2PC-heavy system pays commit coordination per cross-shard transaction. Calvin pays for input agreement over a batch, then many transactions consume the same ordering decision. If a batch contains 1,000 transactions, the log-replication cost is spread across the batch. That is why batching and epoch size matter.',
        {
          type: 'table',
          headers: ['When input doubles', 'Effect'],
          rows: [
            ['More transactions per epoch', 'Better amortization until sequencer, log bandwidth, or scheduler lock acquisition saturates'],
            ['More keys per transaction', 'Lock work and conflict surface grow roughly with keys touched'],
            ['More cross-shard transactions', 'More remote reads and data dependencies; Calvin still avoids commit voting but not data movement'],
            ['More replicas', 'More log replication and replay work; read availability may improve if replicas stay caught up'],
            ['More late-discovered keys', 'More OLLP or fallback overhead; the deterministic path becomes less clean'],
          ],
        },
        'The latency tradeoff is real. A single-shard write that a local database could finish quickly now waits for sequencing and log replication. Calvin earns that latency back only when the avoided commit waits, deadlocks, retries, and replication complexity are larger than the preprocessing cost.',
        {
          type: 'callout',
          text: 'Calvin is strongest when the ordering layer is cheaper than repeated runtime uncertainty. It is weakest when the ordering layer delays work that was already local and uncontended.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'An e-commerce system processes orders across three shards: accounts (shard A), inventory (shard B), and orders (shard C). Four transactions arrive in one sequencing epoch.',
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
        'T3 is a cross-shard transaction. Shard B reads inv:sku4 and sends the value to shard A and shard C. Shard A reads acct:7 after T1 finishes and applies the debit. Shard C writes the order record. All three shards know from the log that T3 is slot 3 and touches A, B, and C.',
        'No 2PC vote is needed for the normal deterministic path because the transaction is already in the replicated input log and its participants are executing a known serial slot. That does not mean there are no messages. The shards still exchange read data, and a deterministic abort is possible if the transaction logic itself says abort, such as "insufficient funds" or "out of stock." The point is that a node crash is not treated as a nondeterministic reason to make one replica abort while another commits.',
        'T4 writes sku9, which does not conflict with T2 or T3 because they touch sku4. Shard B can run T4 in parallel with the sku4 sequence. The log order constrains conflicting operations, not every CPU instruction.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Calvin\'s design pattern -- agree on the command order, then execute deterministically -- appears in several production systems and research successors. The exact engineering choices differ, but the first-principles shape is the same: an ordered log narrows what the execution engine has to decide at runtime.',
        {
          type: 'image',
          src: 'https://commons.wikimedia.org/wiki/Special:FilePath/AgensSQL_HA_Clustering.png',
          alt: 'A high-availability database clustering architecture diagram with failover, failback, and load balancing.',
          caption: 'High-availability database designs often separate client routing, replication, and failover concerns. Source: Wikimedia Commons, "AgensSQL HA Clustering.png" by Gorgonzola-oh, CC BY-SA 4.0.',
        },
        {
          type: 'table',
          headers: ['System or paper', 'Relevant production or research lesson', 'How it relates to Calvin'],
          rows: [
            ['Calvin', 'SIGMOD 2012 system for partitioned, replicated OLTP; reported high sequencing throughput and TPC-C experiments', 'The canonical deterministic ordering case study'],
            ['FaunaDB / Fauna', 'Commercial document database historically described as Calvin-inspired', 'Production example of placing serializable transaction ordering in a replicated log layer'],
            ['Spanner', 'Google production database using Paxos-replicated groups, TrueTime, MVCC, and two-phase commit for multi-participant writes', 'Contrast case: keep runtime transaction coordination, but make timestamp order externally consistent'],
            ['FoundationDB', 'Production key-value database built around optimistic transactions and strict simulation testing', 'Contrast case: use conflict ranges and retries instead of deterministic preordering'],
            ['BOHM', 'Research successor using deterministic ordering with multiversioning', 'Reduces read-write blocking while keeping deterministic write order'],
            ['Aria', 'Research OLTP system that batches transactions and verifies deterministic execution dependencies', 'Keeps the batch-first idea but optimizes for modern in-memory execution'],
          ],
        },
        'Calvin fits best where three conditions hold: cross-shard transactions are frequent enough that commit coordination is a bottleneck, contention on hot records is high enough that retries or deadlocks waste work, and transactions can declare or discover their read/write sets before official execution.',
        {
          type: 'bullets',
          items: [
            'High-contention OLTP: payment systems, inventory management, auction platforms where many transactions compete for the same hot records.',
            'Geo-replicated databases: replicating the ordered log across data centers is cheaper than running 2PC across continents. Each region executes deterministically from the same log.',
            'Deterministic simulation and testing: because execution is deterministic given the log, the entire database can be replayed from the log for debugging, auditing, or disaster recovery.',
            'Blockchain and ledger execution: transaction ordering is explicitly a sequencing problem, so batch-first execution models map naturally to block or ledger construction.',
          ],
        },
        'The broader pattern -- agree on a plan, then execute from the plan -- appears in event sourcing, replicated state machines, deterministic lockstep simulation, workflow orchestration, and build systems. Calvin is the database version of that pattern with ACID transactions, locks, and shards attached.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Calvin fails when the deterministic contract costs more than it saves. The important weaknesses are structural, not implementation details.',
        {
          type: 'table',
          headers: ['Weakness', 'Root cause', 'Consequence'],
          rows: [
            ['Dependent reads', 'Transaction must discover keys after reading data', 'Requires OLLP pre-read phase, adding latency and complexity'],
            ['Straggler amplification', 'Transactions behind a slow shard may depend on that shard\'s log-ordered progress', 'Other shards can be pulled down to the pace of a slow participant when cross-shard dependencies are common'],
            ['Sequencer availability', 'Global ordering requires a highly available preprocessing layer', 'New transactional input stalls if the system cannot form an agreed input sequence'],
            ['Nondeterminism bugs', 'Any source of nondeterminism in transaction code causes silent replica divergence', 'Extremely hard to debug; replicas drift without any error signal'],
            ['Low-contention local work', 'The transaction did not need global preordering', 'Sequencing latency may dominate useful work'],
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
        'Straggler amplification is a practical concern in large deployments. If one shard has a slow disk, CPU saturation, or a garbage-collection pause, any cross-shard transaction that needs data from that shard waits. Ren et al. found that a deterministic implementation could be severely affected by one slowed machine; nondeterministic systems had more freedom to abort or throttle inconvenient local work, though that freedom comes with its own correctness and availability tradeoffs.',
        {
          type: 'callout',
          text: 'The nondeterminism failure mode is dangerous because the log can be perfectly correct while the replicas still drift.',
        },
        'Two replicas processing the same log with the same transaction code can produce different output if any operation is nondeterministic: a hash-map iteration order difference, a floating-point rounding difference across CPU architectures, a local time read, a random value, or an external service call. The input log still looks identical. Only checksums, audits, or divergent client-visible state reveal the damage.',
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
            ['Implementing Fault-Tolerant Services Using the State Machine Approach (Schneider, 1990)', 'The state-machine replication principle behind deterministic replay', 'https://www.cs.cornell.edu/fbs/publications/SMSurvey.pdf'],
            ['Transaction Management in the R* Distributed Database Management System (Mohan, Lindsay, Obermarck, 1986)', 'Classic production-oriented 2PC and recovery design', 'https://dl.acm.org/doi/10.1145/7239.7266'],
            ['Paxos Made Simple (Lamport, 2001)', 'Consensus background for agreeing on a replicated log', 'https://lamport.azurewebsites.net/pubs/paxos-simple.pdf'],
            ['Spanner: Google\'s Globally-Distributed Database (Corbett et al., OSDI 2012)', 'Production contrast: TrueTime, Paxos groups, MVCC, and commit wait', 'https://research.google/pubs/spanner-googles-globally-distributed-database/'],
            ['BOHM: BOttom-up Hardware-oblivious Multiversioning (Faleiro and Abadi, 2015)', 'Calvin + MVCC to reduce read-write blocking', 'https://dl.acm.org/doi/10.1145/2723372.2723742'],
            ['Aria: A Fast and Practical Deterministic OLTP Database (Lu et al., VLDB 2020)', 'Batch-first deterministic execution for modern in-memory OLTP', 'https://www.vldb.org/pvldb/vol13/p2047-lu.pdf'],
          ],
        },
        {
          type: 'table',
          headers: ['Image source', 'Use in this article', 'Attribution'],
          rows: [
            ['Base_de_Datos_distribuida_atravez_de_internet.jpg', 'Distributed database architecture', 'Wikimedia Commons, Elkeko, public domain'],
            ['Two_phase_commit_seq_diagram_success_01.png', '2PC success-path sequence diagram', 'Wikimedia Commons, Jayaprabhakar, CC0 1.0'],
            ['Basic_Paxos_without_failures.svg', 'Consensus message-flow diagram', 'Wikimedia Commons, Iamfromspace, CC BY-SA 4.0'],
            ['Two_Generals\'_Problem.svg', 'Unreliable communication / network partition intuition', 'Wikimedia Commons, Belbury, CC BY 4.0'],
            ['DRBD_concept_overview.png', 'Replication architecture intuition', 'Wikimedia Commons, Nuno Tavares, CC BY-SA 2.5'],
            ['AgensSQL_HA_Clustering.png', 'High-availability database clustering example', 'Wikimedia Commons, Gorgonzola-oh, CC BY-SA 4.0'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: understand Two-Phase Commit, Paxos consensus, Write-Ahead Logging, and Isolation Levels before studying Calvin. Calvin assumes these building blocks.',
            'Contrast: compare Calvin with Spanner (TrueTime + Paxos + 2PC for multi-participant writes) and FoundationDB (optimistic transactions + conflict checking). All three solve distributed transactions differently.',
            'Extension: study BOHM for how MVCC can be layered on top of deterministic ordering, and Aria for how deterministic batch execution can reduce coordination overhead in modern OLTP.',
            'Related pattern: study event sourcing and command-query responsibility segregation (CQRS). The idea of logging intent before execution appears in both, though without Calvin\'s lock scheduling.',
            'Inside this curriculum, follow Etcd Raft, Spanner, FoundationDB, Isolation Levels, and Transactional Outbox case studies.',
          ],
        },
      ],
    },
  ],
};
