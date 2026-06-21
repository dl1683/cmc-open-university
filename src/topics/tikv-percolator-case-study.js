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
    {
      heading: 'Why this exists',
      paragraphs: [
        'TiKV stores data as a distributed, replicated key-value system, while TiDB exposes SQL transactions above it. A single SQL transaction can update rows, indexes, and metadata that live in different key ranges, on different leaders, replicated by different Raft groups.',
        'Percolator-style transactions exist to make those multi-key changes atomic under partial failure. The hard case is not the clean success path. The hard case is a coordinator crash after some keys have durable locks, before every key has a final committed record.',
        {type:'callout', text:'Percolator makes crash recovery possible by storing the transaction decision in data that later actors can inspect.'},
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach is to send writes to every affected key and report success if they all return. That works only when failures are clean. In a distributed store, one region can accept its write while another times out, moves leaders, or is still retrying.',
        'The wall is ambiguity. A later reader can find a tentative value or a lock and have no idea whether it belongs to a transaction that committed, aborted, or lost its coordinator. Without a recoverable decision record, atomicity depends on remembering what a dead client meant to do.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Use MVCC timestamps to define visibility, then split commit into a prewrite phase and a commit phase. During prewrite, every key gets a lock and tentative value. One key is chosen as the primary. Secondary locks point back to that primary.',
        'The primary key becomes the transaction status record. Once the primary is committed with a commit timestamp, the transaction is logically committed. If another client later finds a secondary lock, it can check the primary and resolve the secondary forward or roll it back.',
      ],
    },
    {
      heading: 'What the views teach',
      paragraphs: [
        'In the prewrite commit view, follow the transaction from client to TiDB, then to the timestamp oracle and the regions holding the primary and secondary keys. The primary lock is not just another lock. It is the place other actors inspect to learn the transaction outcome.',
        'In the lock resolution view, read the reader as a recovery participant. It encounters a secondary lock, follows the pointer to the primary, and uses that primary status to decide whether the secondary should be committed or cleaned up.',
        'The important point is that recovery work is part of the normal protocol, not an emergency side channel. Any later actor that finds a lock can follow the same metadata path. That is why the diagram includes the reader: reads are not passive when they encounter unresolved transactional state.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A transaction obtains a start timestamp from the timestamp oracle and reads a snapshot at that timestamp. The client buffers writes. At commit time, prewrite checks for conflicts and writes locks plus tentative values into the affected key ranges. Each of those writes is still made durable by the local storage and Raft machinery under that region.',
        'If prewrite succeeds, the coordinator obtains a commit timestamp. It commits the primary first by writing the final MVCC commit record. After that point the transaction has a durable decision. The coordinator then commits secondaries, and if it dies before finishing them, later lock resolution can complete the work.',
        'Readers use MVCC to read the newest committed version visible at their timestamp. If a reader sees a lock that could affect its snapshot, it may have to wait, push, or resolve the lock by checking the primary transaction record.',
        'The conflict check protects snapshot isolation rules. A prewrite must detect whether another transaction has already committed a newer version that conflicts with the transaction start timestamp. The timestamp oracle gives a total order, but the storage nodes still need per-key metadata to reject writes that would make the snapshot story false.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because ambiguity has a path to an answer. A secondary lock carries enough metadata to find the primary. The primary tells whether the transaction committed, is still pending, or should be rolled back after timeout or cleanup rules.',
        'Timestamps make visibility deterministic: a reader at timestamp 100 should not see a version committed at timestamp 120. Raft makes each region write durable, but Raft alone only protects one key range. Percolator-style metadata ties those independently replicated writes into one transaction outcome.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a transaction moves one unit of inventory from warehouse A to warehouse B. The key stock:sku42:A lives in Region A and stock:sku42:B lives in Region B. The transaction reads a snapshot, buffers A = A - 1 and B = B + 1, then prewrites both keys. The A key is chosen as primary, and the B lock points back to A.',
        'The coordinator gets a commit timestamp and commits A. It crashes before committing B. Later, a reader of B sees the secondary lock and checks A. Because A shows the transaction committed, the reader or cleanup path can commit B at the same commit timestamp. The transfer is not left half-visible.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The protocol spends network trips, storage writes, lock metadata, and recovery work to buy atomicity. A transaction that touches many regions fans out prewrite and commit work across many leaders. Long transactions keep locks alive longer and increase conflict or cleanup pressure.',
        'Hot keys are expensive. If many transactions touch the same primary or index key, optimistic conflict checks can turn into retries and pessimistic modes can turn into waits. The timestamp service is also a critical ordering dependency, so it must be highly available and carefully engineered.',
        'There is also garbage-collection pressure. MVCC keeps old versions so historical snapshots can read a consistent view, but those versions cannot grow forever. Safe point management, lock TTLs, and transaction duration limits are part of the same design because old readers, old locks, and old versions interact.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Percolator-style transactions win when applications need SQL-like atomicity over sharded storage: row updates plus secondary indexes, account state plus audit records, metadata changes across tables, and multi-key invariants that cannot be reduced to one key.',
        'They are strongest when transactions are small enough to keep contention manageable and when the system can tolerate the extra commit latency in exchange for a clear correctness model.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails as a performance tool when used to paper over bad data layout. Very large transactions, hot rows, long lock TTLs, and workloads that constantly cross many regions can spend most of their time in conflict handling, lock resolution, and retry.',
        'It also does not make business contention disappear. A distributed transaction protocol can preserve correctness under partial failure, but it cannot make a single hot inventory counter, account balance, or global sequence cheap at unlimited write rates.',
        'It can also surprise teams that expect one-shard latency. A transaction touching two indexes and three regions may need timestamp requests, replicated prewrites, primary commit, secondary cleanup, and possible retries. The protocol gives a clear answer after failure, but that answer is paid for with coordination.',
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        'Keep transactions small, short, and aligned with data locality when possible. Choose primary keys that are stable and likely to remain reachable, avoid huge fan-out writes, and watch metrics for lock wait time, write conflict rate, retry count, region leader changes, and transaction duration.',
        'When debugging, separate MVCC visibility from replication durability. A Raft log entry can make a lock durable inside one region while the global transaction is still pending. Use transaction status, lock metadata, startTS, commitTS, and primary-key resolution evidence before deciding whether a symptom is a replication problem or a transaction-resolution problem.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'The protocol is easiest to misunderstand if you focus only on two-phase commit. The durable data structures are the point: MVCC versions, start and commit timestamps, primary locks, secondary locks, and lock metadata that tells the next actor how to recover.',
        'Distributed transactions are not just a coordinator algorithm. They are a set of records designed so that after a crash, a different participant can still answer the question: did this transaction commit or not?',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Sources: TiKV Percolator deep dive, https://tikv.org/deep-dive/distributed-transaction/percolator/, TiKV distributed transaction introduction, https://tikv.org/deep-dive/distributed-transaction/introduction/, and the Google Percolator paper, https://www.usenix.org/legacy/event/osdi10/tech/full_papers/Peng.pdf. Study MVCC & Vacuum, Two-Phase Commit, Raft Log Replication, Spanner, and FoundationDB next.',
      ],
    },
  ],
};
