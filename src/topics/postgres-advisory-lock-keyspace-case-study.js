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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the keyspace-design view as a naming test. Active workers are not fighting over a row; they are computing integer keys that PostgreSQL treats as lock names.',
        'Read the lifetime view as a release test. A session lock stays attached to the database session until it is unlocked or the connection ends, while a transaction lock releases at commit or rollback.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Some critical sections do not map to one row. A tenant billing job, migration runner, cache rebuild, or shard backfill may need exactly one owner even though the protected work spans many tables.',
        'Advisory locks exist so the application can name that resource and let PostgreSQL coordinate it. PostgreSQL serializes lock keys; the application defines what each key means.',
        {type:'callout', text:'Advisory locks are only as correct as the key convention: PostgreSQL serializes integer names, but the application defines what those names mean.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a global mutex. Only one billing job runs anywhere in the system, so duplicate billing cannot happen.',
        'That is safe but wasteful. Tenant 17 does not need to wait because tenant 42 is billing, and a global lock turns unrelated work into one long queue.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is resource naming. PostgreSQL cannot infer that tenant 42 billing is the thing being protected unless every worker turns that business concept into the same lock key.',
        'A table row used as a homemade lock adds schema and stale-owner cleanup. A cache lock outside PostgreSQL may not share the same failure boundary as the data being changed. Advisory locks put the coordination point next to the data, but only if the key convention is exact.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The keyspace is the data structure. A 64-bit integer key, or a pair of 32-bit keys, names a protected application resource.',
        'Good key design is narrow enough to preserve concurrency and broad enough to catch every conflict. If one service locks by tenant_id and another locks by tenant_id plus region, PostgreSQL sees two different resources and no coordination happens.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A worker computes a key and calls an advisory lock function. Exclusive locks allow one holder, shared locks allow compatible holders, try-lock variants return immediately, and blocking variants wait.',
        'Session-level locks survive transaction boundaries. Transaction-level locks release automatically when the transaction ends, which is often safer in web applications that use connection pools.',
        'The lock manager handles compatibility, waiting, wakeups, and deadlock detection. It does not validate the business meaning of the key, so the application must make the naming rule part of the contract.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is voluntary exclusion. If every actor that can violate the invariant takes the same exclusive advisory lock before acting, PostgreSQL grants the critical section to only one actor at a time.',
        'The invariant fails if any writer skips the convention or computes a different key. Advisory locks coordinate cooperating code; they do not prevent a rogue write the way a unique index prevents duplicate values.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The lock operation is cheap compared with most protected jobs, but waiting can dominate behavior. A broad key turns many independent jobs into one queue, while a narrow key gives false safety.',
        'Blocking locks need timeouts and retry policy. Try-locks need a skip path. Session locks need cleanup discipline because a pooled connection can return to the pool while still holding a lock if the application forgets to unlock.',
        'Deadlocks remain possible when code takes multiple advisory locks in different orders. The fix is the same as row locks: define a total order, such as subsystem id then tenant id, and acquire keys in that order everywhere.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Advisory locks fit singleton background jobs, tenant-scoped maintenance, migration guards, distributed cron inside one PostgreSQL cluster, and optional cleanup with try-locks. The access pattern is coarse cooperative coordination near PostgreSQL data.',
        'They are useful when row locks are the wrong shape. A backfill may touch thousands of rows, but the invariant can be one backfill for shard 7 rather than lock every row before reading it.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Advisory locks fail when correctness must hold against code that does not cooperate. If duplicate rows must never exist, a unique index is the guard; the advisory lock is at most a scheduling aid.',
        'They also fail across boundaries that do not share the same database session space. If two services write to different databases or one path writes through a queue that never takes the lock, the key convention is incomplete.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A billing system has 800 tenants and 16 workers. Each billing job computes a two-part key: subsystem 10 for billing and tenant_id for the tenant. Worker A locks (10, 42), Worker B tries (10, 42), and Worker C locks (10, 17).',
        'A and C can run together because their tenant keys differ. B waits or skips because it conflicts with A on the exact same key. If a tenant bill takes 20 seconds, the system can process different tenants in parallel instead of running all 800 tenants through one 4.4 hour global queue.',
        'The key choice matches the invariant: one billing run per tenant. A key based on invoice_id would allow two jobs for the same tenant, while a global billing key would waste 15 of the 16 workers.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: PostgreSQL advisory locks in explicit locking at https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS and advisory lock functions at https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS.',
        'Study PostgreSQL Lock Manager & Deadlock Detector for wait queues, Distributed Locks for leases and fencing, Idempotency & Exactly-Once Delivery for retry safety, Transaction Isolation Levels for database guarantees, and Web Locks API Lock Manager for another named-lock system.',
      ],
    },
  ],
};