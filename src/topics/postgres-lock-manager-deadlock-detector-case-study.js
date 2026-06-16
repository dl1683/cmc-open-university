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
      heading: 'What it is',
      paragraphs: [
        'PostgreSQL has a lock manager that coordinates access to database resources. A lock-table entry is keyed by a lock tag such as relation, page, tuple, transaction id, or advisory key. Each entry has granted holders and incompatible waiters. The deadlock detector reads those waits as a wait-for graph and breaks cycles by aborting one transaction.',
        'The official PostgreSQL explicit-locking documentation lists table-level lock modes, row-level locks, advisory locks, deadlocks, and the rule that locks acquired after a savepoint are released if the savepoint rolls back: https://www.postgresql.org/docs/current/explicit-locking.html.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A payments worker updates account rows in account-id order. A later change updates source then destination in request order instead. Two transfers now collide: A locks account 10 and waits for 20, while B locks 20 and waits for 10. The wait-for graph has a cycle. PostgreSQL aborts one transaction with a deadlock error, releases its locks, and the application retry succeeds if the operation is idempotent.',
        'The observability path is concrete: pg_locks gives lock type, mode, relation, transaction id, and whether the lock is granted; pg_stat_activity gives query and backend context; blocker functions explain who blocks whom. PostgreSQL documents pg_locks as a global view of locks in the cluster: https://www.postgresql.org/docs/current/view-pg-locks.html.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Transaction Isolation Levels for the anomaly model, MVCC Internals & VACUUM for versioned reads, Futex Wait Queue Case Study for another address-keyed wait queue, Distributed Locks for cross-process promises, Idempotency & Exactly-Once Delivery for safe retries, PostgreSQL Advisory Lock Keyspace for application-defined locks, and Transaction Savepoint Stack for partial rollback and lock release.',
      ],
    },
  ],
};
