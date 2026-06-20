// PostgreSQL lock manager: lock tags, granted holders, wait queues,
// wait-for graph edges, deadlock detection, and abort-as-release.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'postgres-lock-manager-deadlock-detector-case-study',
  title: 'PostgreSQL Lock Manager & Deadlock Detector',
  category: 'Systems',
  summary: 'How PostgreSQL coordinates relation, row, transaction, and advisory locks with lock tags, wait queues, wait-for graph cycles, pg_locks, and deadlock aborts.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['wait queues', 'deadlock cycle'], defaultValue: 'wait queues' },
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

function lockGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'txA', label: 'tx A', x: 0.7, y: 3.1, note: notes.txA ?? 'UPDATE' },
      { id: 'txB', label: 'tx B', x: 0.7, y: 5.5, note: notes.txB ?? 'ALTER' },
      { id: 'mgr', label: 'mgr', x: 2.7, y: 4.3, note: notes.mgr ?? 'hash table' },
      { id: 'tag', label: 'tag', x: 4.3, y: 2.8, note: notes.tag ?? 'relation 42' },
      { id: 'held', label: 'held', x: 6.0, y: 2.8, note: notes.held ?? 'granted' },
      { id: 'wait', label: 'wait q', x: 6.0, y: 5.5, note: notes.wait ?? 'blocked' },
      { id: 'wfg', label: 'wfg', x: 8.0, y: 4.3, note: notes.wfg ?? 'edges' },
      { id: 'abort', label: 'abort', x: 9.6, y: 4.3, note: notes.abort ?? 'break cycle' },
    ],
    edges: [
      { id: 'e-txA-mgr', from: 'txA', to: 'mgr', weight: '' },
      { id: 'e-txB-mgr', from: 'txB', to: 'mgr', weight: '' },
      { id: 'e-mgr-tag', from: 'mgr', to: 'tag', weight: '' },
      { id: 'e-tag-held', from: 'tag', to: 'held', weight: '' },
      { id: 'e-tag-wait', from: 'tag', to: 'wait', weight: '' },
      { id: 'e-wait-wfg', from: 'wait', to: 'wfg', weight: '' },
      { id: 'e-wfg-abort', from: 'wfg', to: 'abort', weight: '' },
    ],
  }, { title });
}

function* waitQueues() {
  yield {
    state: lockGraph('Every lock request hashes to a lock tag'),
    highlight: { active: ['txA', 'mgr', 'tag', 'e-txA-mgr', 'e-mgr-tag'], compare: ['wait'] },
    explanation: 'The lock manager turns a requested database object into a lock tag: relation, page, tuple, transaction id, advisory key, or another lockable resource. The tag addresses the lock-table entry.',
    invariant: 'A lock is keyed by resource identity plus mode, not by SQL text.',
  };

  yield {
    state: lockGraph('Compatible requests join the granted holder set', { held: 'AccessShare', txA: 'SELECT', txB: 'SELECT' }),
    highlight: { active: ['txA', 'txB', 'tag', 'held', 'e-tag-held'], compare: ['wait'] },
    explanation: 'Some modes are compatible. Many readers can hold AccessShareLock on the same relation while ordinary writes continue through MVCC and row-level locks.',
  };

  yield {
    state: labelMatrix(
      'Mode sample',
      [
        { id: 'sel', label: 'SELECT' },
        { id: 'upd', label: 'UPDATE' },
        { id: 'vac', label: 'VACUUM' },
        { id: 'ddl', label: 'ALTER' },
      ],
      [
        { id: 'table', label: 'table lock' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['AccessShare', 'DDL waits'],
        ['RowExclusive', 'writers wait'],
        ['ShareUpdate', 'maintenance'],
        ['AccessExcl', 'blocks all'],
      ],
    ),
    highlight: { active: ['sel:table', 'upd:table'], removed: ['ddl:risk'] },
    explanation: 'PostgreSQL has several table-level modes. The exact compatibility matrix matters, but the idea is simple: stronger modes conflict with more holders and create wait-queue entries.',
  };

  yield {
    state: lockGraph('Incompatible requests wait behind current holders', { txA: 'holds', txB: 'waits', held: 'granted', wait: 'tx B' }),
    highlight: { active: ['txB', 'wait', 'held', 'e-tag-wait'], found: ['tag'] },
    explanation: 'If a requested mode conflicts with granted holders, the backend waits. That wait is observable in pg_locks and blocking diagnostics because it is not a vague slowdown; it is an explicit queue.',
  };

  yield {
    state: labelMatrix(
      'Observability',
      [
        { id: 'pid', label: 'pid' },
        { id: 'mode', label: 'mode' },
        { id: 'granted', label: 'granted' },
        { id: 'blocked', label: 'blocked by' },
      ],
      [
        { id: 'where', label: 'where' },
        { id: 'why', label: 'why' },
      ],
      [
        ['pg_locks', 'join actor'],
        ['pg_locks', 'conflict kind'],
        ['pg_locks', 'held/wait'],
        ['wait funcs', 'root cause'],
      ],
    ),
    highlight: { found: ['granted:why', 'blocked:why'], active: ['pid:where'] },
    explanation: 'The operational view is a join: pg_locks says who holds or waits for what; pg_stat_activity says what that backend is doing; blocker helpers reveal the wait chain.',
  };
}

function* deadlockCycle() {
  yield {
    state: lockGraph('A wait-for edge records who blocks whom', { txA: 'holds row 1', txB: 'wants row 1', wait: 'B waits A', wfg: 'B->A' }),
    highlight: { active: ['txA', 'txB', 'wait', 'wfg', 'e-tag-wait', 'e-wait-wfg'], compare: ['abort'] },
    explanation: 'When tx B waits on a lock held by tx A, the database can model that as a wait-for graph edge B -> A. One edge is normal contention. A cycle is a deadlock.',
    invariant: 'Deadlock detection is cycle detection in the wait-for graph.',
  };

  yield {
    state: lockGraph('Two transactions acquire rows in opposite order', { txA: 'row 1 then 2', txB: 'row 2 then 1', held: 'two rows', wait: 'A<->B', wfg: 'cycle' }),
    highlight: { active: ['txA', 'txB', 'held', 'wait', 'wfg'], removed: ['abort'] },
    explanation: 'The classic application bug: transaction A locks row 1 then waits for row 2, while transaction B locks row 2 then waits for row 1. Neither can proceed by waiting longer.',
  };

  yield {
    state: labelMatrix(
      'Cycle example',
      [
        { id: 'a1', label: 'A holds r1' },
        { id: 'b2', label: 'B holds r2' },
        { id: 'a2', label: 'A wants r2' },
        { id: 'b1', label: 'B wants r1' },
      ],
      [
        { id: 'edge', label: 'edge' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['B waits A', 'r1 held'],
        ['A waits B', 'r2 held'],
        ['A->B', 'blocked'],
        ['B->A', 'cycle'],
      ],
    ),
    highlight: { active: ['a2:edge', 'b1:edge'], removed: ['b1:meaning'] },
    explanation: 'The lock manager does not need to understand business logic. The cycle is enough: A waits for B and B waits for A. Someone must be aborted.',
  };

  yield {
    state: lockGraph('The detector aborts one backend so locks can release', { wfg: 'cycle found', abort: 'ERROR 40P01', wait: 'unblocked' }),
    highlight: { active: ['wfg', 'abort', 'e-wfg-abort'], found: ['wait'], removed: ['txB'] },
    explanation: 'PostgreSQL detects deadlocks after a wait threshold and aborts one participant. The aborted transaction releases its locks, allowing the other transaction to continue.',
  };

  yield {
    state: labelMatrix(
      'Prevention',
      [
        { id: 'order', label: 'order' },
        { id: 'short', label: 'short tx' },
        { id: 'retry', label: 'retry' },
        { id: 'diag', label: 'diagnose' },
      ],
      [
        { id: 'control', label: 'control' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['same order', 'no cycle'],
        ['less hold', 'small graph'],
        ['catch 40P01', 'safe retry'],
        ['pg_locks', 'see chain'],
      ],
    ),
    highlight: { found: ['order:reason', 'retry:control'], active: ['diag:control'] },
    explanation: 'The practical controls are boring and effective: acquire resources in a consistent order, keep transactions short, make operations idempotent enough to retry, and inspect wait chains when production blocks.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'wait queues') yield* waitQueues();
  else if (view === 'deadlock cycle') yield* deadlockCycle();
  else throw new InputError('Pick a PostgreSQL lock-manager view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'MVCC lets readers and writers avoid blocking each other in many common cases, but a database still needs locks. Schema changes, row updates, foreign-key checks, advisory coordination, vacuum work, and transaction-id waits all need a shared place to decide who may proceed and who must wait.',
        'The PostgreSQL lock manager is that place. It turns resource identity into lock-table entries, records granted holders, queues incompatible waiters, and gives the deadlock detector enough structure to distinguish normal waiting from impossible waiting.',
        {type:'callout', text:'Deadlock detection becomes simple once every blocked backend is turned into an edge in a wait-for graph.'},
        'Without this shared structure, a production incident would look like vague slowness: one session stuck, another apparently idle, a migration half-running, and no reliable way to explain who is blocking whom.',
      ],
    },
    {
      heading: 'The naive baseline and the wall',
      paragraphs: [
        'The naive baseline is a per-resource mutex: if the object is free, take it; otherwise wait until the holder releases it. That works for a single exclusive resource, and it even works for many ordinary database waits.',
        'PostgreSQL has a harder problem. Locks have modes, modes have compatibility rules, one transaction can hold many locks, and one SQL statement can wait on a row, relation, transaction id, or advisory key. A single busy flag cannot describe that state.',
        'The wall appears when waiting is cyclic. If transaction A waits for B while B waits for A, more patience only preserves the deadlock. The system needs a wait-for graph, not just queues.',
      ],
    },
    {
      heading: 'The core invariant',
      paragraphs: [
        'A lock request has two identities: the resource tag and the requested mode. The tag says what is being protected: relation, tuple, transaction id, advisory key, or another resource. The mode says what kind of access is needed. Compatibility between modes decides whether the request joins the granted set or the wait queue.',
        'The invariant is: a backend may proceed only when its requested mode is compatible with every already granted holder for that lock tag. If not, the backend becomes a concrete waiter behind concrete blockers.',
        'Once a backend waits, the database can draw a wait-for edge from the waiter to the holder that blocks it. Deadlock detection is cycle detection on those edges. The detector does not need to understand SQL intent or business logic; the graph is enough.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the wait-queues view, follow the path from transaction to manager to lock tag. The important move is the split between the granted holder set and the wait queue. When the matrix appears, read each row as a reminder that PostgreSQL is not deciding lock or no lock; it is deciding compatibility between named modes.',
        'In the deadlock-cycle view, ignore SQL text and follow only who waits for whom. A single arrow is normal blocking. A closed loop is the proof that no transaction in the loop can move first. The abort node is not a failure of detection; it is the recovery action that removes edges by releasing one participant\'s locks.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'A backend requests a lock by naming a lock tag and mode. PostgreSQL hashes the tag to find the shared lock-table entry. If the mode is compatible with current holders, the lock is granted and the backend continues. If it conflicts, the backend is placed in the wait queue for that tag.',
        'The waiting backend is not just sleeping. Its wait is observable through pg_locks, pg_stat_activity, and blocker helper functions. That observability matters because lock incidents are usually solved by identifying the holder, the waiter, the mode, and the statement that kept the lock open.',
        'After a wait lasts long enough, the deadlock detector builds the relevant wait-for graph. A chain is normal: C waits for B, B waits for A, and A may eventually finish. A cycle is different: every participant is waiting for another participant in the same cycle. PostgreSQL breaks the cycle by aborting one transaction with a deadlock error.',
      ],
    },
    {
      heading: 'Correctness',
      paragraphs: [
        'The correctness argument is graph-based. If the wait-for graph has no cycle, at least one transaction in each finite wait chain is not waiting on a later member of that same chain. Progress is possible when holders finish. If the graph has a cycle, every transaction in the cycle needs another transaction in the cycle to move first. None can be the first mover.',
        'Aborting one participant releases its locks. That removes edges from the graph and lets another transaction continue. The abort is safe at the database level because the victim transaction is rolled back rather than partially committed.',
        'This is why application code must treat deadlock errors as retryable only when the surrounding operation is safe to retry. The database can preserve transactional consistency; the application still owns idempotency and user-visible semantics.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'Lock management is usually cheap compared with the work protected by the lock, but blocking cost can dominate production latency. One transaction holding a strong lock can turn into a queue of idle backends, connection-pool exhaustion, and cascading timeouts.',
        'Deadlock detection is not free, so PostgreSQL does not run it for every tiny wait immediately. That is why deadlocks appear after a delay rather than at the first conflicting lock request. The practical fix is still application-level: acquire resources in a consistent order, keep transactions short, and retry deadlock errors safely.',
        'Stronger locks also buy stronger guarantees at the price of concurrency. An AccessExclusiveLock makes DDL simple and safe, but it can block readers and writers. Row-level locking allows finer-grained concurrency, but it can still deadlock when transactions visit rows in inconsistent order.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose transaction A updates account 1 and then account 2. At the same time, transaction B updates account 2 and then account 1. A holds the row lock for account 1. B holds the row lock for account 2. When A asks for account 2, it waits for B. When B asks for account 1, it waits for A.',
        'The wait-for graph now has A -> B and B -> A. There is no schedule in which both continue by waiting. PostgreSQL aborts one transaction, releases its locks, and returns SQLSTATE 40P01 to that client. The other transaction can then finish.',
        'The durable fix is not to hope the detector is faster. Make both code paths lock accounts in the same order, such as by account id. Then the second transaction waits before holding the conflicting second resource, so the wait graph stays acyclic.',
      ],
    },
    {
      heading: 'Where it wins and fails',
      paragraphs: [
        'The lock manager is the right primitive for protecting database resources that PostgreSQL understands and for exposing wait state through pg_locks and related views. It gives operators a real object to inspect instead of a vague complaint that the database is slow.',
        'It wins especially well when the conflict is inside PostgreSQL: row updates, relation locks, transaction-id waits, advisory locks, and DDL coordination. It is less helpful when the real dependency is outside the database, such as a service call made while a transaction remains open.',
        'It does not make a bad transaction design good. Long transactions, inconsistent row order, missing indexes on foreign-key checks, and DDL mixed into hot paths can still create painful blocking. The lock manager can detect and break deadlocks; it cannot decide your business ordering for you.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: PostgreSQL explicit locking at https://www.postgresql.org/docs/current/explicit-locking.html and pg_locks at https://www.postgresql.org/docs/current/view-pg-locks.html.',
        'Study Transaction Isolation Levels for the anomaly model, MVCC Internals & VACUUM for versioned reads, Futex Wait Queue Case Study for another address-keyed wait queue, Distributed Locks for cross-process promises, Idempotency & Exactly-Once Delivery for safe retries, PostgreSQL Advisory Lock Keyspace for application-defined locks, and Transaction Savepoint Stack for partial rollback and lock release.',
      ],
    },
  ],
};
