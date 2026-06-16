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
    { heading: 'What it is', paragraphs: [
      'TiKV is a distributed transactional key-value store used under TiDB. Its transaction model is based on Google\'s Percolator: snapshot reads with MVCC timestamps, a prewrite phase that installs locks and tentative values, and a commit phase that makes the primary key the transaction decision point.',
      'This is a useful case study because it composes several ideas that are often taught separately. MVCC provides old versions for readers. A timestamp oracle orders transactions. Two-phase commit coordinates multiple keys. Raft replicates each region underneath the transaction protocol.',
    ] },
    { heading: 'How it works', paragraphs: [
      'A transaction obtains a start timestamp and reads from that snapshot. During prewrite, it checks for conflicts and writes locks plus tentative values. One key is chosen as the primary key, and secondary locks point back to it. If prewrite succeeds, the coordinator obtains a commit timestamp and commits the primary first.',
      'Once the primary is committed, the transaction is logically committed. Secondary keys can be committed later or by other clients that encounter their locks. This is why lock metadata must point to the primary: it lets the system recover a correct decision after coordinator failure.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'The cost is more than two network round trips. Each key belongs to a region, each region is replicated, and lock resolution may add retries. Large transactions touch many keys and therefore many regions. Contention on hot keys can turn optimistic concurrency into repeated aborts or lock waits.',
      'The implementation pitfalls are subtle: choosing a primary, expiring abandoned locks, preserving snapshot visibility, handling region leader changes, and cleaning old MVCC versions without breaking old readers.',
      'The timestamp service is another important design point. A global timestamp oracle simplifies ordering, but it must be highly available and fast enough for the workload. The transaction protocol depends on those timestamps to decide what each snapshot can see.',
    ] },
    { heading: 'Complete case study', paragraphs: [
      'Imagine transferring inventory between two warehouse keys in different regions. The transaction prewrites both keys, choosing one as the primary. It commits the primary after receiving a commit timestamp. If the coordinator crashes before committing the secondary, a later reader sees the secondary lock, checks the primary, discovers the transaction committed, and resolves the secondary forward.',
      'That recovery path is the core lesson. Distributed transactions are not only about the happy path. The data structures and records must carry enough information for another actor to finish or safely roll back incomplete work.',
      'The same pattern appears in secondary-index maintenance. Updating a row and its index entries touches multiple keys that may live in different regions. Percolator metadata gives later readers and cleanup workers enough information to keep row data and index data consistent after partial failure.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Sources: TiKV Percolator deep dive, https://tikv.org/deep-dive/distributed-transaction/percolator/, TiKV distributed transaction introduction, https://tikv.org/deep-dive/distributed-transaction/introduction/, and the Google Percolator paper, https://www.usenix.org/legacy/event/osdi10/tech/full_papers/Peng.pdf. Study MVCC & Vacuum, Two-Phase Commit, Raft Log Replication, Spanner, and FoundationDB next.',
    ] },
  ],
};
