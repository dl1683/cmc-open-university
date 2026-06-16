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
      heading: 'What it is',
      paragraphs: [
        'Calvin is a deterministic distributed database architecture. It orders transactions before execution, replicates that ordered log, then executes transactions deterministically across partitions. The key idea is to remove runtime distributed commit from the critical path by making the serial order known upfront.',
        'The case study matters because it expands the transaction-design menu. Spanner uses timestamps, TrueTime, Paxos, and commit wait. FoundationDB uses optimistic commit with resolvers. Calvin uses deterministic sequencing before execution.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Clients submit transactions to a sequencing layer. Sequencers batch transactions into a global order and replicate that order. Schedulers on each partition use the ordered batch and declared read/write sets to acquire locks and execute. Storage nodes apply deterministic operations in the same serial order.',
        'The design depends on knowing transaction inputs early enough. Stored procedures or declared key sets make the clean path possible. Transactions that discover keys through reads need special handling, which can weaken the simplicity of the deterministic model.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Calvin trades runtime commit coordination for pre-execution ordering and workload constraints. The sequencer and replicated log become critical infrastructure. Cross-partition transactions can be efficient when known upfront, but nondeterminism, unknown read sets, and interactive transactions complicate the model. The payoff is strongest under high contention or geo-replicated workloads where retries and commit waits are painful.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Calvin influenced deterministic transaction processing research and systems that separate ordering from execution. Its ideas are useful for databases, replicated state machines, workflow engines, event-sourced systems, and any architecture where a deterministic log can reduce runtime coordination surprises.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Calvin does not eliminate coordination. It moves coordination earlier. It also does not fit every transaction workload equally. The design is strongest when transaction keys are known or constrained; it is less natural when arbitrary application logic discovers data dependencies during execution.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: "Calvin: Fast Distributed Transactions for Partitioned Database Systems" at https://www.cs.yale.edu/homes/dna/papers/calvin-sigmod12.pdf and ACM DOI at https://dl.acm.org/doi/10.1145/2213836.2213838. Study Two-Phase Commit (2PC), Isolation Levels, Write-Ahead Log (WAL), Spanner Case Study, FoundationDB Case Study, and Paxos next.',
      ],
    },
  ],
};
