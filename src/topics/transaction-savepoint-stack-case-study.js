// Transaction savepoints: nested rollback markers, subtransaction stack,
// RELEASE, ROLLBACK TO, name shadowing, and lock cleanup after partial abort.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'transaction-savepoint-stack-case-study',
  title: 'Transaction Savepoint Stack',
  category: 'Systems',
  summary: 'How SQL savepoints act like a subtransaction stack: create rollback markers, recover from partial errors, release nested scopes, shadow names, and discard later work.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['stack mechanics', 'partial rollback'], defaultValue: 'stack mechanics' },
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

function spGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'begin', label: 'BEGIN', x: 0.7, y: 4.2, note: notes.begin ?? 'tx open' },
      { id: 'sp1', label: 'sp1', x: 2.4, y: 3.1, note: notes.sp1 ?? 'marker' },
      { id: 'work1', label: 'work A', x: 4.0, y: 3.1, note: notes.work1 ?? 'kept' },
      { id: 'sp2', label: 'sp2', x: 5.6, y: 4.2, note: notes.sp2 ?? 'nested' },
      { id: 'work2', label: 'work B', x: 7.1, y: 5.4, note: notes.work2 ?? 'risky' },
      { id: 'rollback', label: 'rollback', x: 8.7, y: 4.2, note: notes.rollback ?? 'to sp2' },
      { id: 'commit', label: 'COMMIT', x: 9.8, y: 3.1, note: notes.commit ?? 'outer' },
    ],
    edges: [
      { id: 'e-begin-sp1', from: 'begin', to: 'sp1', weight: '' },
      { id: 'e-sp1-work1', from: 'sp1', to: 'work1', weight: '' },
      { id: 'e-work1-sp2', from: 'work1', to: 'sp2', weight: '' },
      { id: 'e-sp2-work2', from: 'sp2', to: 'work2', weight: '' },
      { id: 'e-work2-rollback', from: 'work2', to: 'rollback', weight: '' },
      { id: 'e-rollback-sp2', from: 'rollback', to: 'sp2', weight: '' },
      { id: 'e-sp2-commit', from: 'sp2', to: 'commit', weight: '' },
    ],
  }, { title });
}

function* stackMechanics() {
  yield {
    state: spGraph('A savepoint is a rollback marker inside one transaction'),
    highlight: { active: ['begin', 'sp1', 'e-begin-sp1'], compare: ['commit'] },
    explanation: 'SAVEPOINT creates a named marker inside the current transaction. It does not commit anything; it gives the transaction a place to roll back to while keeping earlier work.',
    invariant: 'Savepoints are inside one outer transaction, not independent commits.',
  };

  yield {
    state: spGraph('Nested savepoints behave like a stack of scopes', { sp1: 'outer mark', sp2: 'inner mark', work1: 'safe', work2: 'risky' }),
    highlight: { active: ['sp1', 'work1', 'sp2', 'work2', 'e-sp1-work1', 'e-work1-sp2'], found: ['begin'] },
    explanation: 'Each new savepoint creates a newer rollback target. Rolling back to an older savepoint discards work after it and removes later savepoints from the reachable stack.',
  };

  yield {
    state: labelMatrix(
      'Commands',
      [
        { id: 'save', label: 'SAVEPOINT' },
        { id: 'roll', label: 'ROLLBACK TO' },
        { id: 'rel', label: 'RELEASE' },
        { id: 'commit', label: 'COMMIT' },
      ],
      [
        { id: 'effect', label: 'effect' },
        { id: 'scope', label: 'scope' },
      ],
      [
        ['push mark', 'inside tx'],
        ['undo after', 'mark stays'],
        ['pop mark', 'keep work'],
        ['end tx', 'all gone'],
      ],
    ),
    highlight: { active: ['save:effect', 'roll:effect', 'rel:effect'], found: ['commit:scope'] },
    explanation: 'ROLLBACK TO undoes commands after the marker but leaves the named savepoint valid. RELEASE destroys the marker while keeping the effects after it.',
  };

  yield {
    state: labelMatrix(
      'Name reuse',
      [
        { id: 's1a', label: 'SAVE s1' },
        { id: 's1b', label: 'SAVE s1' },
        { id: 'roll', label: 'ROLL s1' },
        { id: 'rel', label: 'RELEASE s1' },
      ],
      [
        { id: 'top', label: 'top mark' },
        { id: 'lesson' },
      ],
      [
        ['old s1', 'reachable'],
        ['new s1', 'shadows'],
        ['new s1', 'old hidden'],
        ['old s1', 'visible'],
      ],
    ),
    highlight: { active: ['s1b:top', 'roll:top'], compare: ['rel:top'] },
    explanation: 'PostgreSQL allows savepoint names to be reused. Newer same-named savepoints hide older ones until the newer marker is released.',
  };

  yield {
    state: spGraph('RELEASE keeps work but removes the rollback marker', { rollback: 'release sp2', work2: 'kept', commit: 'can commit' }),
    highlight: { active: ['sp2', 'work2', 'rollback', 'commit', 'e-work2-rollback', 'e-sp2-commit'], removed: ['sp2'] },
    explanation: 'RELEASE SAVEPOINT says: I no longer need this local undo point. The work stays in the outer transaction, and the final COMMIT still controls durability.',
  };
}

function* partialRollback() {
  yield {
    state: spGraph('A risky operation can fail without killing earlier work', { work2: 'unique err', rollback: 'to sp2', work1: 'kept' }),
    highlight: { active: ['work2', 'rollback', 'sp2', 'e-work2-rollback', 'e-rollback-sp2'], found: ['work1'] },
    explanation: 'Savepoints let a transaction recover from a local error. Work before the savepoint remains part of the outer transaction; work after the savepoint can be discarded.',
    invariant: 'Partial rollback needs an explicit marker before the risky work.',
  };

  yield {
    state: labelMatrix(
      'Rollback effect',
      [
        { id: 'before', label: 'before sp' },
        { id: 'after', label: 'after sp' },
        { id: 'later', label: 'later sp' },
        { id: 'locks', label: 'new locks' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'why' },
      ],
      [
        ['kept', 'outside undo'],
        ['undone', 'inside undo'],
        ['discarded', 'not reachable'],
        ['released', 'if after sp'],
      ],
    ),
    highlight: { found: ['before:state'], removed: ['after:state', 'later:state'], active: ['locks:state'] },
    explanation: 'PostgreSQL documents an important lock interaction: locks acquired after establishing a savepoint are released immediately if the savepoint is rolled back to.',
  };

  yield {
    state: spGraph('Batch import uses one outer transaction with per-row savepoints', { begin: 'batch', sp1: 'row mark', work1: 'insert row', work2: 'bad row', rollback: 'skip row', commit: 'good rows' }),
    highlight: { active: ['begin', 'sp1', 'work1', 'work2', 'rollback', 'commit'], compare: ['work2'] },
    explanation: 'A loader can keep a batch transaction open, create a savepoint before each risky row, roll back bad rows, and commit the good rows together. This improves ergonomics but can add overhead.',
  };

  yield {
    state: labelMatrix(
      'Use carefully',
      [
        { id: 'batch', label: 'batch load' },
        { id: 'retry', label: 'retry part' },
        { id: 'every', label: 'every row' },
        { id: 'long', label: 'long tx' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'cost' },
      ],
      [
        ['good', 'clear errors'],
        ['good', 'small scope'],
        ['maybe', 'many subs'],
        ['bad', 'bloat/locks'],
      ],
    ),
    highlight: { found: ['batch:fit', 'retry:fit'], compare: ['every:cost'], removed: ['long:fit'] },
    explanation: 'Savepoints are not free. Heavy savepoint use inside long transactions can increase overhead, hold old MVCC versions, and keep locks or snapshots alive longer than expected.',
  };

  yield {
    state: spGraph('The complete case study is resilient order import', { begin: 'import tx', sp1: 'order mark', work1: 'header', sp2: 'line mark', work2: 'bad SKU', rollback: 'drop line', commit: 'order ok' }),
    highlight: { active: ['begin', 'sp1', 'work1', 'sp2', 'work2', 'rollback', 'commit'], found: ['e-rollback-sp2'] },
    explanation: 'An importer can keep the order header, roll back only a bad optional line, release successful line savepoints, and still commit the valid order once business rules pass.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'stack mechanics') yield* stackMechanics();
  else if (view === 'partial rollback') yield* partialRollback();
  else throw new InputError('Pick a savepoint view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A savepoint is a named rollback marker inside an open SQL transaction. It lets the transaction undo work after the marker while keeping earlier work and continuing the outer transaction. Data-structure-wise, savepoints behave like a stack of subtransaction scopes.',
        'PostgreSQL documents SAVEPOINT, ROLLBACK TO SAVEPOINT, and RELEASE SAVEPOINT as separate commands: https://www.postgresql.org/docs/current/sql-savepoint.html, https://www.postgresql.org/docs/current/sql-rollback-to.html, and https://www.postgresql.org/docs/current/sql-release-savepoint.html.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A batch importer opens one transaction for an order. It inserts the header, creates a savepoint before each optional line, and attempts the line insert. If one line violates a constraint, ROLLBACK TO SAVEPOINT discards that line while preserving the header and previous valid lines. RELEASE SAVEPOINT removes markers that are no longer needed. The final COMMIT still controls whether the whole order becomes durable.',
        'PostgreSQL explicit locking documentation adds a useful detail: locks acquired after a savepoint are released immediately if rolling back to that savepoint removes the lock acquisition: https://www.postgresql.org/docs/current/explicit-locking.html.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Transaction Isolation Levels for transaction visibility, MVCC Internals & VACUUM for long-transaction costs, PostgreSQL Lock Manager & Deadlock Detector for lock release and wait queues, Write-Ahead Log for crash safety, PostgreSQL Advisory Lock Keyspace for application-defined transaction locks, and Saga Pattern for cross-service compensation when one database transaction is not enough.',
      ],
    },
  ],
};
