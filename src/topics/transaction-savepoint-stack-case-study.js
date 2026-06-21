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
      heading: 'Why savepoints exist',
      paragraphs: [
        `A transaction gives one outer promise: either the whole unit commits or the whole unit aborts. That promise is useful, but it is too coarse for many application workflows. A loader may need to keep the valid rows in a batch while skipping one malformed optional row. A migration may need to test a risky statement after setup work has already run. A library may need to recover from a local statement failure while leaving the caller in charge of the transaction.`,
        `A savepoint gives a smaller undo scope inside the same transaction. It marks a transaction state that the application can return to without committing earlier work. The outer transaction still controls durability. The savepoint only decides how much of the in-progress work should survive after a local error.`,
        {type:'callout', text:`Savepoints turn one transaction into a stack of local undo scopes while leaving the outer commit boundary intact.`},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `One reasonable approach is to split the work into many small transactions. Insert a row, commit it, try the next row, and commit again. Local failure is easy because each row stands alone. The cost is that the batch no longer has one atomic outcome. If the final business rule fails, some earlier rows may already be durable.`,
        `The opposite approach is one large transaction with no internal markers. That preserves the outer promise, but it gives the application no recovery point inside the transaction. A statement error can force the application to abandon work that was otherwise correct.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `The hard case needs both properties at once: one final commit decision and local recovery before that decision. Plain transactions give the first property. Many tiny transactions give the second. Neither gives both.`,
        `The missing structure is a boundary inside the transaction log. The database must know which effects happened before the local risk and which effects happened after it. Without that boundary, "undo the bad part" is not a well-defined command.`,
      ],
    },
    {
      heading: 'The core idea',
      paragraphs: [
        `A savepoint turns one transaction into a stack of local rollback scopes. SAVEPOINT pushes a marker. ROLLBACK TO SAVEPOINT rewinds effects after that marker and removes newer markers. RELEASE SAVEPOINT removes the marker while keeping the work that followed it. COMMIT or outer ROLLBACK still decides the fate of everything that remains.`,
        `The important distinction is that a savepoint is not a nested commit. It does not make data durable, and it does not escape the outer transaction. It only records a place the transaction can return to before the final commit decision.`,
      ],
    },
    {
      heading: 'How the mechanics work',
      paragraphs: [
        `Create the marker before the risky work. Run the risky statements. If they succeed, either keep the marker for a later rollback or release it to simplify the stack. If they fail and the application can continue, roll back to the marker. The rollback removes commands after the marker, but the marker itself remains valid and can be used again.`,
        `PostgreSQL also allows the same savepoint name to be reused. A newer same-named savepoint hides the older one until the newer marker is released. This is why the stack model matters more than the string name: a rollback or release targets the newest visible frame with that name.`,
        `RELEASE SAVEPOINT is easy to misread. It does not undo work. It destroys the marker and keeps the effects that happened after it, moving those effects into the surrounding transaction context. The final COMMIT is still the point where data becomes durable.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        `In the stack-mechanics view, watch which nodes sit before the marker and which nodes sit after it. Work before the marker is outside the local undo region. Work after the marker is the only work at risk when the rollback arrow returns to the savepoint. The command table is a compact ledger: SAVEPOINT pushes, ROLLBACK TO rewinds, RELEASE pops while keeping work, and COMMIT clears the whole transaction stack.`,
        `The name-reuse frame is not a naming trivia point. It shows that the newest same-named marker shadows the older marker. Releasing the newer marker makes the older one visible again. In the partial-rollback view, the lock row matters because rollback can release locks acquired after the marker, not just data changes.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The invariant is a boundary invariant. Every effect in the open transaction is either before the savepoint, after the savepoint, or inside a newer nested scope. ROLLBACK TO restores the transaction state at the marker, so the after-region disappears and earlier effects survive.`,
        `PostgreSQL documents two details that make the stack precise. ROLLBACK TO leaves the named savepoint valid but destroys savepoints created after it. RELEASE destroys the marker without discarding later effects. Lock behavior follows the same rollback principle: locks acquired after a savepoint are released if rolling back to that savepoint cancels the acquisition.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Consider an order import. The application opens one transaction, inserts the order header, then creates a savepoint before each optional line item. If a line item references a missing SKU, the application rolls back to the line savepoint, records a warning, and continues. If the next line is valid, it can release that line savepoint and keep the work.`,
        `At the end, the application still has one final decision. If the order as a whole passes validation, COMMIT makes the header and valid lines durable. If the header violates a later rule, outer ROLLBACK discards everything. The savepoints only handled local line failures; they did not weaken the final transaction boundary.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `Savepoints add bookkeeping for subtransaction state. A small number around risky operations is ordinary. A savepoint around every row in a huge long-running transaction can add overhead, lengthen the transaction lifetime, keep old MVCC versions visible, and hold snapshots or locks longer than the system wants.`,
        `The main operational cost is that the outer transaction stays open. Savepoints shrink the local undo region, but they do not make a long transaction short. If the real problem is transaction duration, lock contention, or vacuum pressure, savepoints can make the code easier to write while leaving the system problem in place.`,
      ],
    },
    {
      heading: 'Where it fits',
      paragraphs: [
        `Savepoints fit batch imports, optional writes, migration probes, retryable substeps, and library code that must recover from a statement-level error without stealing control of the caller transaction. The common access pattern is clear: the local failure scope is smaller than the business transaction scope.`,
        `They are also useful when an application wants to test whether a database operation is legal before deciding whether the larger unit should proceed. The savepoint gives the test a cleanup boundary.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `A savepoint cannot roll back work outside the database transaction. It cannot undo a message already consumed by another service, a payment already sent, or a file already delivered to a client. Cross-service workflows need sagas, outboxes, idempotency keys, and compensation logic.`,
        `Savepoints also do not replace validation. If a bad row can be rejected before the transaction starts, do that first. Use savepoints when the database itself is the authority on whether a local operation is valid, or when the cost of prechecking is worse than trying the operation and rolling back the local scope.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `The common mistake is believing RELEASE commits the nested work. It does not. A later outer rollback still removes it. Another mistake is ignoring name shadowing: in PostgreSQL, rolling back to a reused name targets the newest visible savepoint, not the oldest one with that name.`,
        `Cursor behavior is a boundary case. PostgreSQL documents that cursor motion caused inside a savepoint is not fully rolled back like ordinary data effects. Treat savepoints as transaction-state tools, then check database-specific documentation for side effects such as cursors, temporary objects, and exception blocks.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Primary sources: PostgreSQL SAVEPOINT at https://www.postgresql.org/docs/current/sql-savepoint.html, ROLLBACK TO SAVEPOINT at https://www.postgresql.org/docs/current/sql-rollback-to.html, RELEASE SAVEPOINT at https://www.postgresql.org/docs/current/sql-release-savepoint.html, and explicit locking behavior at https://www.postgresql.org/docs/current/explicit-locking.html.`,
        `Study Transaction Isolation Levels for visibility rules, MVCC Internals and VACUUM for long-transaction costs, PostgreSQL Lock Manager and Deadlock Detector for wait queues and lock release, Write-Ahead Log for crash safety, PostgreSQL Advisory Lock Keyspace for application-defined transaction locks, and Saga Pattern for cross-service compensation.`,
      ],
    },
  ],
};
