// TiKV Percolator transactions: MVCC timestamps, primary locks, secondary
// locks, and 2PC over a distributed key-value store.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'tikv-percolator-case-study',
  title: 'TiKV Percolator Transaction Case Study',
  category: 'Systems',
  summary: 'TiKV-style distributed transactions: timestamps, MVCC versions, primary locks, secondary locks, and Percolator two-phase commit.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['prewrite commit', 'lock resolution'], defaultValue: 'prewrite commit' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function tikvShape(title) {
  return graphState({
    nodes: [
      { id: 'client', label: 'client', x: 0.7, y: 4.0, note: 'transaction' },
      { id: 'tidb', label: 'TiDB', x: 2.4, y: 4.0, note: 'coordinator' },
      { id: 'pd', label: 'PD TSO', x: 4.2, y: 1.4, note: 'timestamps' },
      { id: 'r1', label: 'Region A', x: 5.3, y: 3.2, note: 'primary key' },
      { id: 'r2', label: 'Region B', x: 5.3, y: 5.4, note: 'secondary key' },
      { id: 'raft1', label: 'Raft group A', x: 7.7, y: 3.2, note: 'replicated write' },
      { id: 'raft2', label: 'Raft group B', x: 7.7, y: 5.4, note: 'replicated write' },
      { id: 'reader', label: 'reader', x: 9.4, y: 4.3, note: 'snapshot read' },
    ],
    edges: [
      { id: 'e-client-tidb', from: 'client', to: 'tidb', weight: 'SQL txn' },
      { id: 'e-tidb-pd', from: 'tidb', to: 'pd', weight: 'startTS / commitTS' },
      { id: 'e-tidb-r1', from: 'tidb', to: 'r1', weight: 'primary' },
      { id: 'e-tidb-r2', from: 'tidb', to: 'r2', weight: 'secondary' },
      { id: 'e-r1-raft', from: 'r1', to: 'raft1', weight: 'Raft log' },
      { id: 'e-r2-raft', from: 'r2', to: 'raft2', weight: 'Raft log' },
      { id: 'e-reader-r1', from: 'reader', to: 'r1', weight: 'read version' },
      { id: 'e-reader-r2', from: 'reader', to: 'r2', weight: 'read version' },
    ],
  }, { title });
}

function* prewriteCommit() {
  yield {
    state: tikvShape('Start with a timestamped transaction'),
    highlight: { active: ['client', 'tidb', 'pd', 'e-tidb-pd'], compare: ['reader'] },
    explanation: 'TiKV follows the Percolator-style transaction model. The coordinator obtains a start timestamp, reads a snapshot, buffers writes, and later tries to commit those writes with a two-phase protocol.',
    invariant: 'MVCC versions are ordered by timestamps, not by wall-clock guesses at each storage node.',
  };

  yield {
    state: labelMatrix(
      'Prewrite phase',
      [
        { id: 'primary', label: 'primary key' },
        { id: 'secondary1', label: 'secondary key 1' },
        { id: 'secondary2', label: 'secondary key 2' },
        { id: 'conflict', label: 'conflict check' },
      ],
      [{ id: 'record', label: 'record' }, { id: 'state', label: 'state' }],
      [
        ['lock + value', 'primary lock'],
        ['lock points to primary', 'secondary lock'],
        ['lock points to primary', 'secondary lock'],
        ['newer write?', 'abort if conflict'],
      ],
    ),
    highlight: { active: ['primary:state', 'secondary1:state', 'secondary2:state'], compare: ['conflict:state'] },
    explanation: 'Prewrite places locks and tentative values. The primary lock is special: it becomes the transaction status record that other clients can inspect if they encounter a secondary lock.',
  };

  yield {
    state: tikvShape('Commit primary, then secondaries'),
    highlight: { active: ['pd', 'r1', 'raft1', 'e-tidb-pd', 'e-tidb-r1', 'e-r1-raft'], compare: ['r2', 'raft2'], found: ['reader'] },
    explanation: 'If prewrite succeeds, the coordinator gets a commit timestamp and commits the primary key first. Once the primary commit is durable, the transaction is logically committed; secondary locks can be resolved using the primary status.',
    invariant: 'The primary key is the commit decision point.',
  };

  yield {
    state: labelMatrix(
      'Transaction record lifecycle',
      [
        { id: 'start', label: 'startTS' },
        { id: 'prewrite', label: 'prewrite' },
        { id: 'commit', label: 'commitTS' },
        { id: 'cleanup', label: 'cleanup' },
      ],
      [{ id: 'meaning', label: 'meaning' }, { id: 'reader_view', label: 'reader view' }],
      [
        ['snapshot timestamp', 'read old committed versions'],
        ['locks + tentative values', 'blocked or resolves lock'],
        ['write records committed version', 'visible to later timestamps'],
        ['remove locks', 'normal reads resume'],
      ],
    ),
    highlight: { found: ['commit:reader_view'], active: ['prewrite:meaning'] },
    explanation: 'The case-study flow is MVCC plus 2PC plus replication. The storage engine must make each lock/write durable through its local Raft group while preserving transaction semantics across keys.',
  };
}

function* lockResolution() {
  yield {
    state: labelMatrix(
      'Reader sees a secondary lock',
      [
        { id: 'read', label: 'read key B' },
        { id: 'lock', label: 'lock found' },
        { id: 'primary', label: 'check primary' },
        { id: 'resolve', label: 'resolve' },
      ],
      [{ id: 'action', label: 'action' }, { id: 'decision', label: 'decision' }],
      [
        ['snapshot read', 'cannot ignore lock'],
        ['points to key A', 'find transaction status'],
        ['primary committed?', 'commit or rollback B'],
        ['write final state', 'continue read'],
      ],
    ),
    highlight: { active: ['lock:action', 'primary:decision'], found: ['resolve:decision'] },
    explanation: 'Percolator-style systems make lock resolution explicit. A reader that encounters a secondary lock checks the primary lock or primary commit record to determine whether the transaction committed or should be rolled back.',
    invariant: 'A secondary lock is resolved by the primary transaction record.',
  };

  yield {
    state: tikvShape('Primary status is the source of truth'),
    highlight: { active: ['reader', 'r2', 'r1', 'e-reader-r2', 'e-reader-r1'], found: ['r1'], compare: ['pd'] },
    explanation: 'The reader does not invent an answer. It follows the lock metadata to the primary key. If the primary committed, the secondary can be committed. If the primary expired or rolled back, the secondary can be cleaned up.',
  };

  yield {
    state: labelMatrix(
      'Failure cases',
      [
        { id: 'client_crash', label: 'client crash after prewrite' },
        { id: 'primary_commit', label: 'crash after primary commit' },
        { id: 'region_move', label: 'region moved' },
        { id: 'slow_reader', label: 'slow reader' },
      ],
      [{ id: 'symptom', label: 'symptom' }, { id: 'repair' }],
      [
        ['locks remain', 'rollback by TTL/status'],
        ['secondaries locked', 'resolve from primary commit'],
        ['different Raft leader', 'retry to new leader'],
        ['old snapshot', 'respect MVCC timestamp'],
      ],
    ),
    highlight: { active: ['client_crash:repair', 'primary_commit:repair'], compare: ['region_move:symptom'] },
    explanation: 'The protocol is designed around partial failure. The hard case is not "all writes succeeded" but "some locks are durable, a coordinator disappeared, and another transaction needs a correct answer."',
  };

  yield {
    state: labelMatrix(
      'What this case study combines',
      [
        { id: 'mvcc', label: 'MVCC' },
        { id: 'tso', label: 'timestamp oracle' },
        { id: 'twopc', label: '2PC' },
        { id: 'raft', label: 'Raft' },
      ],
      [{ id: 'role', label: 'role' }, { id: 'risk' }],
      [
        ['many versions per key', 'garbage collection'],
        ['global ordering', 'availability bottleneck'],
        ['atomic decision across keys', 'blocking/resolution work'],
        ['durable shard replication', 'leader changes'],
      ],
    ),
    highlight: { found: ['mvcc:role', 'twopc:role', 'raft:role'], compare: ['tso:risk'] },
    explanation: 'TiKV transactions are not one primitive. They are a stack: timestamp ordering, MVCC visibility, primary-lock commit decisions, secondary-lock cleanup, and replicated storage below every key range.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'prewrite commit') yield* prewriteCommit();
  else if (view === 'lock resolution') yield* lockResolution();
  else throw new InputError('Pick a TiKV Percolator view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
        'Read each key as a record with versions, locks, and timestamps, not as a single mutable value. Active nodes show the transaction participant currently writing a lock, committing a primary key, resolving a secondary key, or reading a snapshot.',
        'MVCC means multi-version concurrency control: the database keeps several committed versions so readers can see a stable snapshot. The safe inference rule is that a secondary lock is ambiguous until a reader checks the primary key that records the transaction outcome.',
        {type:'callout', text:'Percolator makes crash recovery possible by storing the transaction decision in data that later actors can inspect.'},
      ],
    },
    { heading: 'Why this exists', paragraphs: [
        'TiKV is a distributed key-value store, while TiDB exposes SQL transactions above it. One SQL transaction can update rows, indexes, and metadata that live in different key ranges, on different leaders, and in different Raft groups.',
        'Percolator-style transactions exist to make multi-key changes atomic under partial failure. Atomic means all writes in the transaction become visible together or none of them do, even if the coordinator crashes in the middle.',
      ],
    },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious approach is to send writes to every affected key and report success if every write returns. This works only when the network, clients, and storage nodes fail cleanly together.',
        'Another obvious approach is a coordinator that remembers the decision in memory. That fails when the coordinator dies after some locks are durable but before every participant has heard the final outcome.',
      ],
    },
    { heading: 'The wall', paragraphs: [
        'The wall is ambiguity after partial progress. A later reader may find a lock on one key and not know whether the transaction committed, aborted, timed out, or lost its coordinator.',
        'Raft makes a write durable inside one region, but it does not by itself define a transaction outcome across several regions. Without recoverable transaction metadata, atomicity depends on a dead actor explaining what it meant to do.',
      ],
    },
    { heading: 'The core insight', paragraphs: [
        'The core insight is to split commit into prewrite and commit, then make one key the primary transaction record. During prewrite, every key receives a lock and tentative value, and secondary locks point back to the primary.',
        'Once the primary key is committed with a commit timestamp, the transaction is logically committed. Any later actor that finds a secondary lock can inspect the primary and either roll the secondary forward to the same commit timestamp or clean it up.',
      ],
    },
    { heading: 'How it works', paragraphs: [
        'A transaction obtains a start timestamp from a timestamp oracle and reads a snapshot at that timestamp. At commit time, it prewrites locks and tentative values while checking that no conflicting committed version invalidates the snapshot.',
        'If prewrite succeeds, the coordinator obtains a commit timestamp and commits the primary first. Secondaries are committed afterward, and if the coordinator dies, lock resolution uses the primary status to finish or roll back remaining locks.',
      ],
    },
    { heading: 'Why it works', paragraphs: [
        'The correctness argument is that every ambiguous secondary has a path to a durable decision. The secondary lock contains metadata that identifies the primary, and the primary records whether the transaction committed or remains unresolved under cleanup rules.',
        'Timestamps make visibility deterministic. A reader at timestamp 100 can see versions committed at or before 100 and must not see versions committed at 120, so lock checks and conflict checks preserve the snapshot story.',
      ],
    },
    { heading: 'Cost and complexity', paragraphs: [
        'The protocol spends extra network round trips, storage writes, lock metadata, timestamp requests, and recovery work to buy atomicity. A transaction that touches 10 regions can fan out prewrite and commit work across 10 leaders.',
        'Cost behaves badly under contention. If 100 clients update the same inventory key, many will wait, conflict, or retry, and each retry repeats part of the timestamp and write path instead of making useful progress.',
      ],
    },
    { heading: 'Real-world uses', paragraphs: [
        'Percolator-style transactions fit SQL databases built on sharded key-value storage. They handle row updates plus secondary indexes, account state plus audit records, metadata changes across tables, and invariants that cross key ranges.',
        'They are strongest when transactions are small, short, and aligned with data locality. The system accepts more coordination so application code can rely on a clear transaction model instead of hand-written recovery logic.',
      ],
    },
    { heading: 'Where it fails', paragraphs: [
        'It fails as a performance fix for poor data layout. Very large transactions, long lock lifetimes, hot primary keys, and constant cross-region writes can spend most of their time in conflict handling and lock resolution.',
        'It also cannot make business contention disappear. A distributed transaction protocol can preserve correctness for a hot account balance, but it cannot make unlimited writes to that one logical record cheap.',
      ],
    },
    { heading: 'Worked example', paragraphs: [
        'Suppose a transaction moves 1 unit of inventory from warehouse A to warehouse B. Key stock:sku42:A is in Region 1 with value 10, key stock:sku42:B is in Region 2 with value 4, and the transaction start timestamp is 100.',
        'Prewrite writes a primary lock on A with tentative value 9 and a secondary lock on B with tentative value 5. The coordinator gets commit timestamp 130, commits A, and then crashes before committing B.',
        'A later reader at timestamp 140 sees the B lock, follows it to primary A, and finds A committed at 130. It can commit B at 130, so readers at 140 see A = 9 and B = 5, while readers at 120 still see A = 10 and B = 4.',
      ],
    },
    { heading: 'Sources and study next', paragraphs: [
        'Primary sources: TiKV Percolator deep dive at https://tikv.org/deep-dive/distributed-transaction/percolator/, TiKV distributed transaction introduction at https://tikv.org/deep-dive/distributed-transaction/introduction/, and the Google Percolator paper at https://www.usenix.org/legacy/event/osdi10/tech/full_papers/Peng.pdf.',
        'Study MVCC, timestamp oracles, two-phase commit, Raft log replication, Spanner, FoundationDB, lock TTLs, and transaction garbage collection next. The useful comparison is which record answers the crash-recovery question.',
      ],
    },
  ],
};
