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
        "Read the animation as the execution trace for Calvin Deterministic Database Case Study. Calvin as the transaction-ordering lesson: sequence first, replicate the log, then execute deterministically across shards..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why it exists',
      paragraphs: [
        `Calvin exists because distributed transactions often spend their hardest coordination at the worst possible time: after work has already started. If a transaction touches records on shard A and shard B, both shards must agree on what came before it, what conflicts with it, and when its result is visible. If they discover that order late, they can hold locks, wait on remote participants, abort useful work, or expose inconsistent behavior.`,
        `The Calvin paper asks a direct systems question: what if the database decides the serial order before execution starts? Instead of letting each shard race and then repairing the outcome near commit time, Calvin records an ordered batch first, replicates that order, and makes execution follow the same plan everywhere.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `The obvious approach is to execute transactions as they arrive and coordinate when a conflict appears. A classic distributed transaction can use Two-Phase Commit. An optimistic system can run first, validate at commit, and retry if the read-write conflict check fails. A timestamp system can assign times and use replication protocols to make those timestamps durable.`,
        `The wall is that runtime coordination lands on the latency path. Cross-shard transactions wait for remote participants. Hot records create deadlock or retry churn. Replicas may need extra agreement to decide which transaction won. The system can waste CPU and locks on work that later aborts.`,
        `Calvin does not remove coordination. It moves coordination earlier and changes what workers are allowed to assume. Once the order is fixed, workers can schedule deterministically instead of discovering the order while holding application work in flight.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `Core insight: serialize intent first, then parallelize deterministic work. Clients submit transactions to a sequencing layer. The sequencer places them in a total order. That ordered batch is replicated. Every shard scheduler sees the same batch and executes the pieces that touch its local records in a way that is equivalent to the global serial order.`,
        `This does not mean every shard runs every transaction. A shard only executes the operations that read or write its records. The key point is that all shards agree on each transaction's position before they begin. That agreement turns many runtime conflicts into a scheduling problem over a shared log.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The invariant is that conflicting transactions are executed in the order chosen by the replicated log. If T1 is before T3 in the log and both touch account 7, every relevant scheduler must preserve that order. If two transactions do not conflict, workers can run them in parallel as long as the result is equivalent to the log order.`,
        `A second invariant is deterministic replay. Replicas that start from the same state, receive the same ordered input, and run deterministic transaction code should produce the same ending state. If the code reads the clock, calls an outside service, or depends on unordered iteration, the replay guarantee can break.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `The deterministic-ordering view shows clients, the sequencer, the replicated log, schedulers, and storage as separate roles. The teaching point is the log in the middle. Calvin makes the ordered batch the concurrency-control decision, not a passive record written after execution.`,
        `The cross-shard view shows the same log position reaching scheduler A and scheduler B. Cross-shard work still exists, but both shards coordinate from the same plan. The question changes from which order the shards discovered to whether the declared plan can be executed deterministically and safely.`,
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        `A clean Calvin transaction has a known read set and write set, often because it is submitted as a stored procedure with declared keys. The sequencing layer batches transactions and assigns serial slots. The replicated log carries those slots to replicas before execution.`,
        `Partition schedulers use the log plus declared keys to acquire locks and run transaction pieces. For a cross-shard transaction, each shard sees the same serial slot and knows which local records are involved. The storage layer applies updates in a way that preserves the log order for conflicts.`,
        `The design is friendliest to transactions that can be described before they run. If a transaction discovers new keys after reading data, Calvin needs extra handling, a pre-read phase, or a fallback path. The clean path depends on enough information being available early.`,
      ],
    },
    {
      heading: 'Why it works (2)',
      paragraphs: [
        `Calvin works when ordered input plus deterministic execution is enough to reproduce the same serial outcome everywhere. The sequencer provides the order. Replication makes that order durable and shared. The schedulers preserve the order for conflicting records. The transaction code produces the same result from the same inputs.`,
        `The safety argument depends on those conditions together. If every replica receives the same log and all conflicting operations respect that log, the final state is equivalent to executing transactions serially in log order. If any replica runs nondeterministic code or touches undeclared records, the argument no longer holds cleanly.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Suppose T1 writes account 7 on shard A, T2 writes cart 9 on shard B, and T3 reads account 7 and cart 9 while writing a ledger row across both shards. Calvin can place them in slots 1, 2, and 3 before any shard starts executing. Shard A sees that T1 must finish before T3 reads account 7. Shard B sees that T2 must finish before T3 reads cart 9.`,
        `Without a shared serial order, T3 could observe a mixed world: account 7 after T1 but cart 9 before T2, or the reverse, depending on timing. With the ordered log, both shards know the same story. T3 is the third transaction in the batch, so its cross-shard read has a well-defined place in the serial history.`,
        `A non-conflicting T4 that updates sku4 on shard A may run in parallel with work on shard B if doing so preserves the serial effect. Calvin is not single-threaded execution. It is deterministic scheduling under a shared order.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Calvin wins under high contention because it avoids a lot of wasted optimistic work. If many transactions fight over the same hot records, deciding the order before execution can reduce deadlocks, late aborts, and lock-order surprises.`,
        `It can also fit geo-replicated systems. Replicating a deterministic order before execution can be cleaner than letting each region execute and then reconciling conflicts. Once the order is agreed, local workers can make progress from the same input log.`,
        `The broader pattern applies outside databases: put an agreed command order or plan in front of distributed workers, then let the workers execute with fewer runtime surprises. Event sourcing, deterministic simulation, workflow engines, and replicated state machines all echo part of this idea.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Calvin is weaker for arbitrary interactive transactions that discover their read and write sets late. If the application must read one record before deciding which records to touch next, the scheduler may not have enough information to plan the transaction safely before execution.`,
        `The sequencer and replicated log can also become bottlenecks or availability concerns. If global ordering is centralized too tightly, throughput suffers. If ordering is partitioned, cross-partition transactions need careful rules for how their positions are chosen and replicated.`,
        `The model also pushes complexity into application constraints. External service calls, random values, wall-clock reads, nondeterministic iteration, and undeclared keys all threaten deterministic replay. A production Calvin-style system must either ban these behaviors, wrap them in deterministic protocols, or send them through slower paths.`,
      ],
    },
    {
      heading: 'How it works (3)',
      paragraphs: [
        `Design the transaction interface so read sets and write sets are declared or cheaply discovered before scheduling. Stored procedures can help because they give the database a known shape to analyze. Ad-hoc SQL or application-driven transactions need stricter rules or extra planning stages.`,
        `Make nondeterminism visible. Random numbers, timestamps, generated ids, and external reads should either be assigned by the log, supplied as deterministic inputs, or prohibited inside deterministic transaction code. Replica divergence is often caused by a small value that was not treated as part of the ordered input.`,
        `Measure the right queues. Track sequencer throughput, log replication delay, batch size, scheduling wait, lock wait, cross-shard transaction share, abort fallback rate, and replica divergence checks. Calvin moves coordination, so the bottleneck may move from commit waits to sequencing and scheduling.`,
      ],
    },
    {
      heading: 'Where it fails (2)',
      paragraphs: [
        `A hidden nondeterministic read can make two replicas apply the same log differently. A clock read may choose different branches. A random value may generate different ids. An iteration over an unordered map may apply writes in different orders. These bugs are hard because the log looks correct while state drifts.`,
        `A bad key declaration can break conflict scheduling. If a transaction declares account 7 but later touches account 8, the scheduler's plan is incomplete. The system must detect this, abort and retry on a safe path, or use a transaction language that prevents it.`,
        `A sequencing outage is also different from a storage outage. If workers are healthy but no new order can be produced, new transaction progress may stop. High-availability design for the sequencing layer is part of the database, not an optional wrapper.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Read Calvin: Fast Distributed Transactions for Partitioned Database Systems at https://www.cs.yale.edu/homes/dna/papers/calvin-sigmod12.pdf and the ACM DOI page at https://dl.acm.org/doi/10.1145/2213836.2213838. Then compare the design with Two-Phase Commit, deterministic state machine replication, and optimistic concurrency control.`,
        `Inside this curriculum, study Two-Phase Commit, Write-Ahead Log, Spanner Case Study, FoundationDB Case Study, Paxos, Raft Log Replication, Transactional Outbox, Isolation Levels, Hot Rows, and Replicated State Machine topics.`,
      ],
    },
      {
      heading: 'Why this exists',
      paragraphs: [
        "State the real constraint this topic fixes before introducing the mechanism.",
        "A good opening says what gets too slow, too fragile, or too hard to reason about under baseline behavior.",
        "Without that, every optimization appears decorative.",
      ],
    },

    {
      heading: 'The obvious approach',
      paragraphs: [
        "Name the reasonable first attempt and why teams reach for it.",
        "Then show the exact place that approach stops scaling or starts breaking.",
        "Treat this section as contrast, not a rejection.",
      ],
    },

    {
      heading: 'Cost and behavior',
      paragraphs: [
        "Cost is both asymptotic and practical.",
        "State what grows, what stays flat, and what setup cost dominates before the method becomes useful.",
        "If possible, convert cost into an intuition: doubling, halving, or crossing a fixed bound.",
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
        'Use this topic as a checkpoint: if you can explain why Calvin Deterministic Database Case Study moves from input to output in the animation and where it fails, you are ready for the next topic.',
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
