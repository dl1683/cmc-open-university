// MVCC internals: a database that never overwrites a row — every UPDATE
// births a new version, every reader sees its own slice of history, and a
// janitor named VACUUM sweeps up the corpses. Unless someone blocks the door.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'mvcc-vacuum',
  title: 'MVCC Internals & VACUUM',
  category: 'Systems',
  summary: 'Updates that never overwrite: version chains, xmin/xmax visibility, dead tuples, and the long transaction that blocks the janitor.',
  controls: [
    { id: 'view', label: 'Inspect', type: 'select', options: ['row versions & visibility', 'VACUUM and the bloat trap'], defaultValue: 'row versions & visibility' },
  ],
  run,
};

// One logical row ("balance"), three physical versions.
// xmin = txid that created it; xmax = txid that superseded it (∞ = current).
const VERSIONS = [
  { id: 'v1', label: 'version 1: $100', xmin: 100, xmax: 205 },
  { id: 'v2', label: 'version 2: $80', xmin: 205, xmax: 310 },
  { id: 'v3', label: 'version 3: $95', xmin: 310, xmax: Infinity },
];
const visible = (v, snap) => v.xmin <= snap && v.xmax > snap;

function* versions() {
  yield {
    state: matrixState({
      title: 'One logical row, three physical versions (PostgreSQL-style)',
      rows: VERSIONS.map(({ id, label }) => ({ id, label })),
      columns: [{ id: 'xmin', label: 'xmin (born by txn)' }, { id: 'xmax', label: 'xmax (superseded by)' }],
      values: VERSIONS.map((v) => [v.xmin, v.xmax === Infinity ? 0 : v.xmax]),
      format: (v) => (v === 0 ? '∞ (current)' : `txid ${v}`),
    }),
    highlight: { found: ['v3:xmax'] },
    explanation: 'This is the physical trick behind snapshot isolation. An UPDATE does not overwrite the old tuple; it creates a new physical version and stamps version metadata. xmin says which transaction created the version. xmax says which transaction replaced it, or infinity if it is still current. The animation shows one logical balance with three disk tuples. The database is not guessing history from a separate audit log; the heap itself contains the visible chain.',
    invariant: 'UPDATE = insert new version + stamp the old one\'s xmax. Nothing is overwritten, ever.',
  };

  const READERS = [150, 250, 400];
  yield {
    state: matrixState({
      title: 'Three readers, three snapshots, three different "truths"',
      rows: VERSIONS.map(({ id, label }) => ({ id, label })),
      columns: READERS.map((s) => ({ id: `s${s}`, label: `reader @ txid ${s}` })),
      values: VERSIONS.map((v) => READERS.map((s) => (visible(v, s) ? 1 : 0))),
      format: (v) => (v ? 'VISIBLE' : '—'),
    }),
    highlight: { found: ['v1:s150', 'v2:s250', 'v3:s400'] },
    explanation: 'The visibility rule is small enough to memorize: a version is visible if it was born before the snapshot and had not been superseded yet. So the reader at txid 150 sees the $100 version, the reader at 250 sees $80, and the reader at 400 sees $95. Each reader gets one coherent truth without blocking the writer that made a later truth. MVCC turns reads into a historical lookup instead of a fight over the current row.',
    invariant: 'visible(v, snap) = v.xmin ≤ snap AND v.xmax > snap — one version per row per snapshot, locks not required.',
  };

  yield {
    state: matrixState({
      title: 'The family resemblance',
      rows: [
        { id: 'mvcc', label: 'MVCC versions' },
        { id: 'git', label: 'Git objects' },
        { id: 'lsm', label: 'LSM-tree entries' },
        { id: 'cache', label: 'versioned cache names' },
      ],
      columns: [{ id: 'rule', label: 'the shared rule' }, { id: 'cleanup', label: 'who cleans up' }],
      values: [[1, 2], [1, 3], [1, 4], [1, 5]],
      format: (v) => ['', 'never mutate — append a new immutable version', 'VACUUM', 'git gc', 'compaction', 'nobody (names expire naturally)'][v],
    }),
    highlight: { compare: ['mvcc:rule', 'git:rule', 'lsm:rule'] },
    explanation: 'This is the same design move as Git objects, LSM entries, and versioned cache names: do not mutate the thing somebody might still be reading; append a new thing and let readers choose their version. The benefit is concurrency and clear crash behavior. The cost is deferred cleanup. Append-only systems are only fast if the cleanup loop keeps pace with the append loop.',
  };
}

function* vacuumTrap() {
  yield {
    state: matrixState({
      title: 'A hot row after four quick updates: one survivor, four corpses',
      rows: [
        { id: 'd1', label: '$100 (xmax 205)' },
        { id: 'd2', label: '$80 (xmax 310)' },
        { id: 'd3', label: '$95 (xmax 415)' },
        { id: 'd4', label: '$70 (xmax 520)' },
        { id: 'live', label: '$110 (current)' },
      ],
      columns: [{ id: 'status', label: 'status' }, { id: 'space', label: 'disk space' }],
      values: [[1, 2], [1, 2], [1, 2], [1, 2], [3, 2]],
      format: (v) => ['', 'DEAD — invisible to every snapshot', 'still occupied', 'LIVE'][v],
    }),
    highlight: { removed: ['d1:status', 'd2:status', 'd3:status', 'd4:status'], found: ['live:status'] },
    explanation: 'A dead tuple is not logically visible to anyone, but it is still physically present. That distinction matters. A hot status row updated four times now has one live truth and four dead bodies occupying pages, indexes, cache, and scan time. MVCC bought nonblocking reads by postponing the bill. VACUUM is the bill collector.',
    invariant: 'A version is dead once no active snapshot can see it — invisible, but still occupying disk.',
  };

  yield {
    state: matrixState({
      title: 'VACUUM: the janitor\'s checklist',
      rows: [
        { id: 'scan', label: '1. scan for dead tuples' },
        { id: 'horizon', label: '2. check the horizon' },
        { id: 'reclaim', label: '3. reclaim' },
        { id: 'auto', label: '4. autovacuum' },
      ],
      columns: [{ id: 'what', label: '' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', 'find versions with xmax in the past', 'dead only if xmax < OLDEST active snapshot', 'mark space reusable (FULL rewrites the table)', 'wakes on ~20% dead-tuple thresholds'][v],
    }),
    highlight: { active: ['horizon:what'] },
    explanation: 'VACUUM is conservative on purpose. It can remove a tuple only when that tuple is older than the oldest active snapshot in the system. Regular VACUUM marks space reusable; it usually does not shrink the table file. VACUUM FULL rewrites the table smaller but takes heavier locks. Autovacuum keeps the regular sweep happening in the background, which is why a healthy MVCC database is a cleanup system as much as a storage system.',
  };

  yield {
    state: matrixState({
      title: 'The bloat trap: one forgotten transaction pins the horizon',
      rows: [
        { id: 't9am', label: '9:00 am' },
        { id: 't10am', label: '10:00 am' },
        { id: 't2pm', label: '2:00 pm' },
        { id: 't4pm', label: '4:00 pm' },
      ],
      columns: [{ id: 'event', label: 'event' }, { id: 'bloat', label: 'dead tuples (unvacuumable)' }],
      values: [[1, 0], [2, 120000], [3, 900000], [4, 2400000]],
      format: (v) => (v >= 1000 ? v.toLocaleString('en-US') : ['0', 'analyst runs BEGIN; … and goes to lunch', 'autovacuum runs — reclaims NOTHING', 'queries visibly slower; disk alarm', 'DBA finds idle-in-transaction, kills it'][v]),
    }),
    highlight: { removed: ['t10am:event', 't2pm:bloat'], found: ['t4pm:event'] },
    explanation: 'This is the production shape to recognize. One idle transaction opened at 9:00 pins the xmin horizon at 9:00. Every tuple replaced after that may still be visible to that sleeping snapshot, so VACUUM must leave it alone. Autovacuum can run perfectly and still reclaim nothing. The fix is not heroic tuning; first find the old transaction, end it, and then let cleanup catch up.',
    invariant: 'The oldest open snapshot pins the vacuum horizon: one idle transaction makes every newer corpse untouchable.',
  };

  yield {
    state: matrixState({
      title: 'Field notes for the working engineer',
      rows: [
        { id: 'short', label: 'keep transactions short' },
        { id: 'timeout', label: 'idle_in_transaction_session_timeout' },
        { id: 'monitor', label: 'watch pg_stat_user_tables' },
        { id: 'hot', label: 'design around hot rows' },
      ],
      columns: [{ id: 'why', label: 'why' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', 'every open second pins the horizon', 'the safety net for forgotten BEGINs', 'n_dead_tup is the bloat speedometer', 'a counter updated 1000/s births 1000 corpses/s'][v],
    }),
    highlight: { active: ['timeout:why'] },
    explanation: 'The working checklist is short: keep transactions short, set an idle-in-transaction timeout, monitor dead tuple counts, and avoid schemas that update one hot row thousands of times per second. A hot counter is not just a lock problem; it is a tuple-factory problem. MVCC, LSM compaction, and git gc all share the same law: immutable history is powerful only if the garbage collector is allowed to finish its job.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'row versions & visibility') yield* versions();
  else if (view === 'VACUUM and the bloat trap') yield* vacuumTrap();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: `Why this exists`,
      paragraphs: [
        `A database is expected to answer old questions while new facts are being written. A report may scan millions of rows for a snapshot that began ten minutes ago while checkout traffic keeps updating balances, inventory, and status flags. If every reader had to block every writer, mixed workloads would collapse. If every writer overwrote the only copy of a row, old readers would see a world that changed halfway through their query.`,
        `Multi-Version Concurrency Control, or MVCC, exists to solve that conflict. Instead of overwriting a row in place, an update creates a new physical version and leaves older versions available for transactions whose snapshots still need them. The price is cleanup. Old versions do not disappear just because they are no longer current. VACUUM is the maintenance process that proves they are no longer visible and marks their space reusable.`,
      ],
    },
    {
      heading: `The obvious approach`,
      paragraphs: [
        `The naive answer is locking. A reader takes a shared lock, a writer takes an exclusive lock, and the database forces one side to wait. That can work for small critical sections, but it is painful for long scans and busy OLTP tables. A monthly report should not freeze checkout. A checkout should not wait behind a slow analyst query that started before lunch.`,
        `The other naive answer is overwriting and hoping transaction logs can reconstruct enough history. That pushes complexity into rollback, recovery, and reader consistency. MVCC makes history part of the stored row versions themselves. Readers choose a version that matches their snapshot; writers publish a newer version; cleanup happens later when no active snapshot can still see the old one.`,
      ],
    },
    {
      heading: `Core insight`,
      paragraphs: [
        `The core insight is append a new version instead of changing the old one. A logical row may have several physical tuples. Each tuple has metadata that says when it was born and when it was superseded. In PostgreSQL-style terminology, xmin is the transaction that created the tuple and xmax is the transaction that replaced or deleted it. A snapshot is a reader's view of which transactions count as visible.`,
        `A version is visible when it was created before the snapshot and was not superseded before that snapshot. That small rule lets readers walk past writes that happened later and lets writers create new versions without destroying older truths. MVCC turns concurrency from a fight over one current value into a lookup over a version chain.`,
      ],
    },
    {
      heading: `Version visibility`,
      paragraphs: [
        `The row-versions visual shows one logical balance with several physical versions. A reader at transaction 150 sees the version born at transaction 100 and replaced at 205. A reader at 250 sees the version born at 205 and replaced at 310. A reader at 400 sees the current version born at 310. All three readers are correct because each is asking from a different snapshot.`,
        `This is why MVCC is sometimes surprising during debugging. The table can contain several values for what feels like one row. The database is not confused. It is preserving enough history for active snapshots. The current version is only current for readers whose snapshots began after the creating transaction became visible and after older versions stopped qualifying.`,
      ],
    },
    {
      heading: `What the visual proves`,
      paragraphs: [
        `The first visual proves that one logical row can have many physical truths, and that visibility is a rule rather than a guess. The highlighted cells are not duplicates. They are the one version each snapshot is allowed to see. The xmin and xmax columns are enough to explain why readers do not need to wait for later writers in the common case.`,
        `The VACUUM visual proves the other half of the bargain. A tuple can be logically dead and still physically present. Dead means no ordinary current query should choose it as the latest row. Reclaimable means no active snapshot anywhere could still need it. VACUUM is conservative because deleting a tuple too early would corrupt an old transaction's view of the database.`,
      ],
    },
    {
      heading: `How VACUUM works`,
      paragraphs: [
        `VACUUM scans table pages and finds tuples whose replacing or deleting transactions are old enough. The key question is the xmin horizon: what is the oldest active snapshot that might still see old history? If a dead tuple is newer than that horizon, VACUUM must leave it alone. If it is older, regular VACUUM can mark the space reusable for future inserts or updates.`,
        `Regular VACUUM usually does not return table file space to the operating system. It creates reusable room inside the table. VACUUM FULL can shrink a table by rewriting it, but it takes heavier locks and is a more disruptive operation. Autovacuum runs the regular maintenance loop in the background, waking when thresholds suggest enough dead tuples have accumulated or when transaction-id freeze work is needed.`,
      ],
    },
    {
      heading: `The bloat trap`,
      paragraphs: [
        `The production failure is often boring: a client opens BEGIN, runs a query, and stays idle in transaction for hours. That old snapshot pins the cleanup horizon. Other sessions keep updating rows, creating dead tuples that normal users cannot see, but VACUUM cannot remove them because the old transaction might still ask for a historical view. Autovacuum can run perfectly and reclaim almost nothing.`,
        `The symptoms look like a storage problem at first. Table files grow, indexes get larger, scans slow down, cache hit rates fall, and disk alarms fire. Tuning autovacuum may help later, but the first fix is usually to find and end the old transaction. Then VACUUM can move the horizon forward and reclaim reusable space.`,
      ],
    },
    {
      heading: `Costs and tradeoffs`,
      paragraphs: [
        `MVCC buys nonblocking reads, simpler snapshot semantics, and good mixed-workload behavior. It costs disk churn, visibility checks, dead tuples, index maintenance, and operational vigilance. Updates are not just writes; they are writes plus future cleanup. A high-update workload can generate garbage faster than the default maintenance loop expects.`,
        `Engine details matter. HOT updates can avoid some index churn when an updated tuple stays on the same page and indexed columns do not change. Fillfactor can leave room for future versions on a page. Index design affects how much dead history has to be cleaned from secondary structures. Transaction length affects how soon any cleanup is legal.`,
      ],
    },
    {
      heading: `Where it wins`,
      paragraphs: [
        `MVCC wins for systems that mix short writes with many reads: OLTP databases, dashboards, API backends, reporting workloads, and applications that need repeatable reads. A user can keep browsing a consistent page of results while other users keep changing the underlying table. A report can run against a stable snapshot without freezing every row it touches.`,
        `The same idea appears outside relational databases. Git writes new immutable objects and later runs garbage collection. LSM trees append new entries and later compact them. Versioned caches publish a new name instead of mutating a value another client may still be reading. The shared pattern is fast publication now, conservative cleanup later.`,
      ],
    },
    {
      heading: `Failure modes`,
      paragraphs: [
        `The most common failure is long transactions. Set idle_in_transaction_session_timeout, monitor old snapshots, and treat idle sessions as production hazards. Another failure is the hot row. A counter, queue head, or status row updated thousands of times per second is not only a lock point; it is also a dead-tuple factory. Shard counters, append events and aggregate, or move the workload to a structure designed for high write churn.`,
        `A quieter failure is misunderstanding space. Seeing dead tuples fall does not mean the operating system got disk back. Regular VACUUM makes space reusable inside the table. Capacity planning should track table size, n_dead_tup, autovacuum activity, old transaction age, and wraparound risk. MVCC is safe when the cleanup loop is allowed to finish its job.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Transaction Isolation Levels to connect MVCC internals to user-visible promises, PostgreSQL Lock Manager and Deadlock Detector for the conflicts MVCC does not remove, PostgreSQL HOT Update Heap-Only Tuple for same-page update optimization, and PostgreSQL Autovacuum Freeze and Wraparound for why VACUUM is correctness work as well as space maintenance.`,
        `Then study LSM Tree Compaction, Git Object Store and Garbage Collection, Copy-on-Write B-Trees, Snapshot Isolation Write Skew, Hot Rows and Append-and-Aggregate, Database Index Bloat, and Write-Ahead Log Crash Recovery. They all repeat the same lesson in different systems: immutable history improves concurrency only when reclamation is part of the design.`,
      ],
    },
  ],
};
