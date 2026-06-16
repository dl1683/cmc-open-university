// PostgreSQL advisory locks: application-defined integer keys, shared/exclusive
// modes, session vs transaction lifetime, try-locks, and cooperative discipline.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'postgres-advisory-lock-keyspace-case-study',
  title: 'PostgreSQL Advisory Lock Keyspace',
  category: 'Systems',
  summary: 'How PostgreSQL advisory locks use application-defined 64-bit or two-part keys, shared/exclusive modes, session and transaction lifetime, try-locks, and cooperative conventions.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['keyspace design', 'lifetime rules'], defaultValue: 'keyspace design' },
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

function advisoryGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'appA', label: 'app A', x: 0.7, y: 3.1, note: notes.appA ?? 'worker' },
      { id: 'appB', label: 'app B', x: 0.7, y: 5.5, note: notes.appB ?? 'worker' },
      { id: 'key', label: 'key', x: 2.5, y: 4.3, note: notes.key ?? 'tenant:job' },
      { id: 'mgr', label: 'mgr', x: 4.2, y: 4.3, note: notes.mgr ?? 'advisory' },
      { id: 'held', label: 'held', x: 6.0, y: 2.9, note: notes.held ?? 'session' },
      { id: 'try', label: 'try', x: 6.0, y: 5.6, note: notes.try ?? 'nonblock' },
      { id: 'work', label: 'work', x: 8.0, y: 4.3, note: notes.work ?? 'critical' },
      { id: 'release', label: 'release', x: 9.5, y: 4.3, note: notes.release ?? 'unlock' },
    ],
    edges: [
      { id: 'e-appA-key', from: 'appA', to: 'key', weight: '' },
      { id: 'e-appB-key', from: 'appB', to: 'key', weight: '' },
      { id: 'e-key-mgr', from: 'key', to: 'mgr', weight: '' },
      { id: 'e-mgr-held', from: 'mgr', to: 'held', weight: '' },
      { id: 'e-mgr-try', from: 'mgr', to: 'try', weight: '' },
      { id: 'e-held-work', from: 'held', to: 'work', weight: '' },
      { id: 'e-work-release', from: 'work', to: 'release', weight: '' },
      { id: 'e-release-mgr', from: 'release', to: 'mgr', weight: '' },
    ],
  }, { title });
}

function* keyspaceDesign() {
  yield {
    state: advisoryGraph('The application chooses the lock key'),
    highlight: { active: ['appA', 'key', 'mgr', 'e-appA-key', 'e-key-mgr'], compare: ['work'] },
    explanation: 'An advisory lock is keyed by an integer chosen by the application. PostgreSQL does not know whether the key means tenant 12, invoice 99, a cron job, or a migration. The convention is yours.',
    invariant: 'Advisory locks coordinate code that agrees on the same key scheme.',
  };

  yield {
    state: labelMatrix(
      'Key shapes',
      [
        { id: 'global', label: 'global' },
        { id: 'tenant', label: 'tenant' },
        { id: 'row', label: 'row id' },
        { id: 'job', label: 'job type' },
      ],
      [
        { id: 'key', label: 'key' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['42', 'too broad'],
        ['tenant hash', 'collide'],
        ['table+id', 'wrong table'],
        ['enum+shard', 'starve'],
      ],
    ),
    highlight: { active: ['tenant:key', 'row:key'], compare: ['global:risk'] },
    explanation: 'Good key design scopes the lock to exactly the resource being protected. Too broad kills concurrency; too narrow fails to protect the invariant.',
  };

  yield {
    state: advisoryGraph('Two workers contending on the same key serialize voluntarily', { appA: 'got key', appB: 'waits', held: 'exclusive', try: 'false', work: 'run job' }),
    highlight: { active: ['appA', 'appB', 'key', 'held', 'try', 'work'], found: ['e-held-work'] },
    explanation: 'Advisory locks do not lock rows by themselves. They only serialize participants that ask for the same key before doing the protected work.',
  };

  yield {
    state: labelMatrix(
      'Mode choice',
      [
        { id: 'excl', label: 'exclusive' },
        { id: 'shared', label: 'shared' },
        { id: 'try', label: 'try lock' },
        { id: 'block', label: 'blocking' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'hazard', label: 'hazard' },
      ],
      [
        ['one writer', 'deadlock'],
        ['many reads', 'writer wait'],
        ['optional work', 'skip path'],
        ['must run', 'pileups'],
      ],
    ),
    highlight: { found: ['excl:fit', 'shared:fit', 'try:fit'], compare: ['block:hazard'] },
    explanation: 'The API supports exclusive and shared forms plus try-lock variants. Use try-locks for optional jobs so a second worker can skip instead of waiting behind long work.',
  };

  yield {
    state: advisoryGraph('A safe migration lock is a complete key convention', { key: 'app:migrate', held: 'one owner', work: 'DDL plan', release: 'done' }),
    highlight: { active: ['key', 'held', 'work', 'release', 'e-held-work', 'e-work-release'], compare: ['appB'] },
    explanation: 'A migration runner can acquire a single well-known advisory lock before applying DDL. The lock works only because every runner follows the same convention.',
  };
}

function* lifetimeRules() {
  yield {
    state: advisoryGraph('Session-level locks survive transaction boundaries', { held: 'session', work: 'multi tx', release: 'manual' }),
    highlight: { active: ['held', 'work', 'release', 'e-held-work'], compare: ['try'] },
    explanation: 'Session-level advisory locks are released when explicitly unlocked or when the session ends. They can outlive commits and rollbacks, which is useful and dangerous.',
    invariant: 'Session locks need explicit unlock discipline or connection-pool hygiene.',
  };

  yield {
    state: advisoryGraph('Transaction-level locks release automatically at commit or rollback', { held: 'xact', work: 'one tx', release: 'commit' }),
    highlight: { active: ['held', 'work', 'release', 'e-work-release'], found: ['mgr'] },
    explanation: 'Transaction-level advisory locks are tied to the current transaction. They are usually safer with pooled connections because PostgreSQL releases them at transaction end.',
  };

  yield {
    state: labelMatrix(
      'Lifetime table',
      [
        { id: 'sess', label: 'session' },
        { id: 'xact', label: 'xact' },
        { id: 'tryS', label: 'try sess' },
        { id: 'tryX', label: 'try xact' },
      ],
      [
        { id: 'release', label: 'release' },
        { id: 'use' },
      ],
      [
        ['manual/end', 'long job'],
        ['tx end', 'safe scope'],
        ['manual/end', 'skip if busy'],
        ['tx end', 'fast guard'],
      ],
    ),
    highlight: { active: ['xact:release', 'tryX:release'], compare: ['sess:release'] },
    explanation: 'The same keyspace can have different lifetimes. Choose session locks only when the lock truly spans transactions and your connection pool cannot leak them to the next request.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'pool', label: 'pool leak' },
        { id: 'split', label: 'split key' },
        { id: 'dead', label: 'deadlock' },
        { id: 'trust', label: 'bypass' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'control', label: 'control' },
      ],
      [
        ['next req owns', 'xact lock'],
        ['two schemes', 'key registry'],
        ['A waits B', 'order keys'],
        ['code skips', 'DB constraint'],
      ],
    ),
    highlight: { removed: ['pool:symptom', 'trust:symptom'], found: ['pool:control', 'split:control'] },
    explanation: 'Advisory locks are cooperative. They are excellent coordination hints, but they do not replace constraints, unique indexes, transaction isolation, or idempotency.',
  };

  yield {
    state: advisoryGraph('The complete case study is one-at-a-time tenant billing', { key: 'tenant 42', held: 'xact lock', work: 'bill run', release: 'commit' }),
    highlight: { active: ['appA', 'key', 'held', 'work', 'release'], compare: ['appB'] },
    explanation: 'A billing worker uses a transaction-level advisory lock keyed by tenant id. Two workers can bill different tenants concurrently, but only one can bill tenant 42 at a time.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'keyspace design') yield* keyspaceDesign();
  else if (view === 'lifetime rules') yield* lifetimeRules();
  else throw new InputError('Pick a PostgreSQL advisory-lock view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'PostgreSQL advisory locks are application-defined locks managed by PostgreSQL but interpreted by your code. Instead of locking a table or row automatically, the application chooses a 64-bit key or two 32-bit keys and asks PostgreSQL to coordinate holders of that key.',
        'PostgreSQL documents advisory locks in the explicit locking chapter and explains that they are application-defined and can be session-level or transaction-level: https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS. The functions reference lists the pg_advisory_lock, pg_try_advisory_lock, shared, and transaction variants: https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A SaaS billing system wants at most one billing run per tenant. A global lock would serialize every tenant and waste capacity. A tenant-keyed advisory lock lets tenant 42 serialize with tenant 42 while tenant 17 proceeds independently. The worker starts a transaction, takes pg_advisory_xact_lock(hash(tenant_id)), writes invoices idempotently, and commits. If the process dies, the transaction ends and the lock releases.',
        'The key registry is part of the design. If one service hashes tenant id alone and another hashes tenant id plus region, they do not coordinate. Advisory locks are only as strong as the shared convention.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study PostgreSQL Lock Manager & Deadlock Detector for the underlying queues and wait-for graph, Distributed Locks for cross-node leases and fencing, Idempotency & Exactly-Once Delivery for retry safety, Web Locks API Lock Manager for a browser-scoped cousin, Transaction Isolation Levels for correctness guarantees, and Transaction Savepoint Stack for transaction-scoped rollback behavior.',
      ],
    },
  ],
};
