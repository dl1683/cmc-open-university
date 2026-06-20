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
      heading: 'Why this exists',
      paragraphs: [
        'Some critical sections are real even though they do not map cleanly to one database row. A tenant billing run, migration runner, scheduled job, cache warmer, data backfill, or cross-table maintenance task may need exactly one owner.',
        'A row lock works when the row is the resource. Advisory locks exist for the cases where the application has to define the resource itself. The application chooses an integer key, asks PostgreSQL to coordinate that key, and agrees that every conflicting worker will use the same key before doing the protected work.',
        'PostgreSQL manages lock compatibility, waiting, and release behavior. Your code defines what the key means.',
        {type:'callout', text:'Advisory locks are only as correct as the key convention: PostgreSQL serializes integer names, but the application defines what those names mean.'},
      ],
    },
    {
      heading: 'The obvious approach and its wall',
      paragraphs: [
        'The crude solution is a global mutex: only one worker in the whole system may run the job. That is safe, but it wastes concurrency. Tenant 17 does not need to wait because tenant 42 is billing.',
        'Another common solution is a lock row in a table. That can work, but it adds schema, cleanup rules, stale-owner handling, timestamps, compare-and-swap updates, and race-prone application logic.',
        'The wall is naming. The database already has a lock manager, but it cannot guess that `tenant 42 billing` or `monthly invoice backfill shard 7` is the resource being protected. Advisory locks let the application name that resource directly.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The keyspace is the data structure. A 64-bit key, or a pair of 32-bit keys, names the protected application resource. Good key design is exact: broad enough that all conflicting work chooses the same key, narrow enough that unrelated work can proceed.',
        'PostgreSQL does not validate the meaning. If every worker uses tenant_id as the billing key, tenant-level serialization works. If one service uses tenant_id and another uses tenant_id plus region, the locks do not meet.',
        'The convention is part of the correctness proof. Advisory locks are not magic; they coordinate code that agrees on the same names.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the keyspace-design view, watch both workers flow into the same key. That is the whole point. If the key differs, PostgreSQL sees two unrelated locks and both workers run.',
        'The key table is not decoration. It shows the design tradeoff: too broad kills concurrency; too narrow fails to protect the invariant; inconsistent key construction silently disables coordination.',
        'In the lifetime-rules view, focus on release semantics. Session locks survive commits and rollbacks until explicit unlock or connection end. Transaction locks release automatically at transaction end. That difference matters a lot in connection-pooled applications.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A worker computes a key and requests an advisory lock. Exclusive locks allow one holder. Shared locks allow multiple compatible holders. Try-lock variants return immediately when the key is busy, which is useful for optional jobs. Blocking variants wait, which is useful when the work must run before proceeding.',
        'Session-level advisory locks survive transaction boundaries. They release when explicitly unlocked or when the database session ends. That is useful for work that spans transactions, but dangerous with connection pools if cleanup is sloppy.',
        'Transaction-level advisory locks release automatically at commit or rollback. They are often safer for web applications because the lock lifetime matches the database transaction.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is voluntary agreement. Every participant that might violate the protected rule must acquire the same key before doing the work. When that is true, the PostgreSQL lock manager serializes conflicting participants.',
        'It works especially well when PostgreSQL is already the shared coordination point. The lock lives in the same system that stores the data being protected, so a worker can acquire a transaction-level advisory lock and perform the guarded write in one database transaction.',
        'This is also the main limitation. Advisory locks do not protect code that skips the convention. They coordinate cooperating actors; they do not make non-cooperating writes impossible.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A billing system runs one job per tenant. Workers compute key = hash("billing", tenant_id) or use a two-part key where the first part names the subsystem and the second part names the tenant. Worker A locks tenant 42 and starts billing. Worker B tries tenant 42 and waits or skips. Worker C locks tenant 17 and can run concurrently.',
        'The key design is doing the work. A global billing key would serialize all tenants and waste capacity. A key based on invoice_id might allow two workers to bill the same tenant at the same time. The correct key matches the business invariant: one billing run per tenant.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Advisory locks are cheap enough for coarse coordination, but they can still create wait queues, deadlocks, and connection-pool pressure. A key that is too broad becomes a bottleneck. A key that is too narrow gives a false sense of safety.',
        'Blocking locks need timeout and retry policy. Try-locks need a clear skip path. Session locks need explicit unlock discipline and pool hygiene. Transaction locks need the protected work to fit inside one transaction.',
        'Deadlock rules still matter. If one job takes tenant lock then report lock, and another takes report lock then tenant lock, blocking advisory locks can deadlock. Use a consistent lock acquisition order when multiple keys are needed.',
      ],
    },
    {
      heading: 'Operational checklist',
      paragraphs: [
        'Write the key convention down before using the lock. Name the subsystem, key parts, hash method if any, lifetime choice, blocking or try-lock behavior, timeout, retry policy, and the invariant the lock is meant to protect. Treat that convention like schema, because changing it changes correctness.',
        'Add observability for waits and skips. A slow advisory lock can mean healthy serialization, a stuck worker, a connection-pool leak, a deadlock pattern, or a key that is too broad. Metrics should include lock wait time, try-lock failures, transaction age, and the job or tenant key family.',
        'Review the convention whenever a second service starts using the same protected resource. Advisory locks fail quietly when one code path uses a different key, a different database, or no lock at all. The operational test is whether every writer that can violate the invariant is visible in the same coordination boundary before production traffic depends on it. Document the owner and escalation path before rollout.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Advisory locks work well for one-at-a-time tenant jobs, migration runners, singleton background tasks, distributed cron inside one database cluster, cache warmers, and short critical sections where PostgreSQL is already the coordination point.',
        'They are also useful for optional work with try-locks. If another worker already owns the cleanup job, the second worker can skip instead of waiting.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'They are the wrong tool when the resource spans systems that do not all use the same PostgreSQL database, when you need fencing tokens against stale owners, or when correctness must hold even if a code path forgets to take the lock.',
        'They also fail as a substitute for constraints. If duplicate rows must never exist, use a unique index. If retries must be safe, use idempotency keys. If stale workers can write after losing ownership, use fencing tokens. Use advisory locks for cooperative scheduling, not as the only line of data correctness.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: PostgreSQL advisory locks in explicit locking at https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS and advisory lock functions at https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS.',
        'Study PostgreSQL Lock Manager & Deadlock Detector for the underlying queues and wait-for graph, Distributed Locks for cross-node leases and fencing, Idempotency & Exactly-Once Delivery for retry safety, Web Locks API Lock Manager for a browser-scoped cousin, Transaction Isolation Levels for correctness guarantees, and Transaction Savepoint Stack for transaction-scoped rollback behavior.',
      ],
    },
  ],
};
