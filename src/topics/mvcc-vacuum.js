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
// xmin = txid that created it; xmax = txid that superseded it (âˆž = current).
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
      format: (v) => (v === 0 ? 'âˆž (current)' : `txid ${v}`),
    }),
    highlight: { found: ['v3:xmax'] },
    explanation: `This is the physical trick behind snapshot isolation. An UPDATE does not overwrite the old tuple; it creates a new physical version and stamps version metadata. xmin says which transaction created the version. xmax says which transaction replaced it, or infinity if it is still current. The animation shows one logical balance with ${VERSIONS.length} disk tuples. The database is not guessing history from a separate audit log; the heap itself contains the visible chain.`,
    invariant: `UPDATE = insert new version + stamp the old one's xmax. ${VERSIONS.length} physical versions, zero overwrites.`,
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
    explanation: `The visibility rule is small enough to memorize: a version is visible if it was born before the snapshot and had not been superseded yet. So the reader at txid ${READERS[0]} sees the $100 version, the reader at ${READERS[1]} sees $80, and the reader at ${READERS[2]} sees $95. Each of ${READERS.length} readers gets one coherent truth without blocking the writer that made a later truth. MVCC turns reads into a historical lookup instead of a fight over the current row.`,
    invariant: `visible(v, snap) = v.xmin <= snap AND v.xmax > snap — one version per row per snapshot across all ${VERSIONS.length} versions, locks not required.`,
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
    explanation: `This is the same design move as Git objects, LSM entries, and versioned cache names: do not mutate the thing somebody might still be reading; append a new thing and let readers choose their version. The benefit is concurrency and clear crash behavior — the ${VERSIONS.length} versions in our example prove it. The cost is deferred cleanup. Append-only systems are only fast if the cleanup loop keeps pace with the append loop.`,
  };
}

function* vacuumTrap() {
  const deadCount = 4;
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
    explanation: `A dead tuple is not logically visible to anyone, but it is still physically present. That distinction matters. A hot status row updated ${deadCount} times now has one live truth and ${deadCount} dead bodies occupying pages, indexes, cache, and scan time. MVCC bought nonblocking reads by postponing the bill. VACUUM is the bill collector.`,
    invariant: `A version is dead once no active snapshot can see it — ${deadCount} invisible tuples still occupying disk.`,
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
    explanation: `VACUUM is conservative on purpose. It can remove a tuple only when that tuple is older than the oldest active snapshot in the system — here, all ${deadCount} dead tuples must pass that test. Regular VACUUM marks space reusable; it usually does not shrink the table file. VACUUM FULL rewrites the table smaller but takes heavier locks. Autovacuum keeps the regular sweep happening in the background, which is why a healthy MVCC database is a cleanup system as much as a storage system.`,
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
    explanation: `This is the production shape to recognize. One idle transaction opened at 9:00 pins the xmin horizon at 9:00. Every tuple replaced after that may still be visible to that sleeping snapshot, so VACUUM must leave it alone. Autovacuum can run perfectly and still reclaim nothing — by 4:00 pm, ${(2400000).toLocaleString('en-US')} dead tuples have accumulated. The fix is not heroic tuning; first find the old transaction, end it, and then let cleanup catch up.`,
    invariant: `The oldest open snapshot pins the vacuum horizon: one idle transaction makes every newer corpse untouchable.`,
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
    explanation: `The working checklist is short: ${deadCount} rules. Keep transactions short, set an idle-in-transaction timeout, monitor dead tuple counts, and avoid schemas that update one hot row thousands of times per second. A hot counter is not just a lock problem; it is a tuple-factory problem. MVCC, LSM compaction, and git gc all share the same law: immutable history is powerful only if the garbage collector is allowed to finish its job.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        `The "row versions & visibility" view shows one logical row stored as three physical tuples. Each tuple carries xmin (the transaction that created it) and xmax (the transaction that replaced it). The matrix highlights which version each reader sees based on the visibility rule. Found cells mark the single version each snapshot resolves to. Compare cells show the family resemblance between MVCC, Git, LSM trees, and versioned caches.`,
        `The "VACUUM and the bloat trap" view shows dead tuples accumulating after updates. Removed cells are tuples that are logically invisible but still physically present. Active cells mark the cleanup horizon and the configuration knobs that keep bloat under control. At each step, ask: which tuples are dead, which are reclaimable, and what is holding the horizon back.`,
        {type: 'callout', text: `MVCC is append-first concurrency: preserve old versions for readers, then prove when the cleanup horizon makes them reclaimable.`},
      
        {type: 'image', src: './assets/gifs/mvcc-vacuum.gif', alt: 'Animated walkthrough of the mvcc vacuum visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `Databases must answer old questions while new facts are being written. A report scanning millions of rows should not freeze every checkout touching those rows. A checkout should not wait behind a slow analytical query that started before lunch. Readers and writers need to coexist without blocking each other and without seeing half-old, half-new data.`,
        `MVCC solves this by keeping old versions around. An UPDATE does not overwrite the row in place. It creates a new physical version and leaves the old one available for transactions that still need it. Each transaction sees a consistent snapshot of the database at its start time. The price is deferred cleanup: old versions persist until a maintenance process proves no active snapshot can still see them.`,
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Relational_database_terms.svg', alt: 'Relational database diagram showing rows, columns, and table relationships', caption: `MVCC starts from an ordinary relation, but every logical row may have several physical tuple versions underneath. Source: Wikimedia Commons, Booyabazooka, public domain.`},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `Two-phase locking (2PL) is the textbook answer. A reader takes a shared lock on a row, a writer takes an exclusive lock, and the database forces one side to wait. This is correct. Every schedule it produces is serializable. For short critical sections on lightly contended rows, it works fine.`,
        `The alternative is even simpler: overwrite the row in place and use an undo log to reconstruct old values when a reader needs them. This avoids explicit locks on reads but pushes complexity into rollback and crash recovery.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `2PL serializes mixed workloads. A monthly report scanning a million rows takes shared locks on every row it touches. Every checkout that wants to update one of those rows waits for the report to finish. A burst of short writes starves the long query. Throughput drops as contention rises because reader-writer conflicts are symmetric: readers block writers and writers block readers.`,
        `Overwriting in place is worse. If a writer changes row 500 while a reader is mid-scan, the reader may see the new balance at row 500 but the old balance at row 800. The scan is internally inconsistent. Reconstructing a consistent snapshot across millions of rows from scattered undo entries is expensive and fragile during crashes. Single-version storage forces a choice: block readers or corrupt their view.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Each write creates a new physical version of the row. In PostgreSQL, every tuple carries two metadata fields: xmin (the transaction ID that created it) and xmax (the transaction ID that replaced or deleted it, or zero if it is still live). An UPDATE stamps xmax on the old tuple and inserts a new tuple with the updating transaction as its xmin. A t_ctid pointer links old and new versions into a chain.`,
        `Each transaction takes a snapshot when it starts. The snapshot records which transactions were committed at that moment. A version is visible to a reader if: (1) the version's xmin is committed and before the snapshot, and (2) the version's xmax is either zero, uncommitted, or after the snapshot. That two-part check is the entire visibility rule. It runs on every tuple access.`,
        `Garbage collection removes versions that no active snapshot can see. In PostgreSQL this is VACUUM. It scans table pages, finds tuples whose xmax is committed and older than the oldest active snapshot (the xmin horizon), and marks their space reusable. Regular VACUUM does not shrink the table file; it creates reusable room inside existing pages. VACUUM FULL rewrites the table smaller but takes heavier locks. Autovacuum runs regular VACUUM in the background, waking when dead-tuple thresholds or transaction-ID freeze deadlines are hit.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `For any snapshot S, exactly one version of each logical row is visible. The visibility rule partitions the version chain cleanly: two versions of the same row cannot both qualify because the xmax of the earlier version equals the xmin of the later one. If the later version is visible (its xmin is committed and before S), then the earlier version's xmax is before S and it is excluded.`,
        `Write conflicts use a first-committer-wins rule. If two transactions both try to update the same row, the second writer waits for the first to commit or abort. If the first commits, the second aborts (it was working from a stale version). This prevents lost updates without read locks.`,
        `Crash safety comes from the write-ahead log. New tuple versions are logged before heap pages are modified. After a crash, recovery replays the WAL forward. Uncommitted versions have transaction IDs that never appear in the commit log, so they are automatically invisible to all future snapshots. No explicit rollback of heap data is needed.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Reads never block. Writers only conflict when two transactions update the same row. This is the core throughput win over 2PL.`,
        `The costs are version storage, visibility-check overhead on every tuple access, index maintenance (each version may have its own index entries), and VACUUM operational burden. Updates are writes plus future cleanup. A row updated four times has one live tuple and four dead ones, all occupying pages, indexes, and cache lines until VACUUM reclaims them.`,
        `HOT (Heap-Only Tuple) updates avoid index churn when the new tuple fits on the same page and no indexed column changed. Fillfactor reserves page space for future versions. Transaction length determines how soon cleanup becomes legal. A long-running transaction pins the xmin horizon and prevents VACUUM from reclaiming anything newer.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `PostgreSQL stores version chains directly in the heap and uses VACUUM for cleanup. Oracle stores the latest version in the data block and reconstructs older versions from undo segments on demand. MySQL InnoDB keeps the latest version in the clustered index and builds older versions from an undo log. CockroachDB, YugabyteDB, and Spanner use MVCC timestamps for distributed snapshot reads. Every major RDBMS uses some form of MVCC because the alternative is locking readers out during writes.`,
        `The same append-then-cleanup pattern appears outside databases. Git writes immutable objects and runs git gc. LSM trees append entries and compact later. Versioned caches publish a new key instead of mutating a value another client is reading. Copy-on-write B-trees (LMDB, btrfs) create new pages instead of mutating existing ones. The shared rule: never mutate what someone might still be reading.`,
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Copy_On_Write_technique.png', alt: 'Copy-on-write diagram showing original blocks copied before update', caption: `Copy-on-write is the storage-level cousin of MVCC: keep the old block for readers, write a new block for changes, then reclaim later. Source: Wikimedia Commons, Qdrddr, CC BY-SA 4.0.`},
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Write skew is the correctness gap. Snapshot isolation lets two transactions each read a consistent view, make independent decisions that are locally valid, and commit without conflict because they wrote different rows. The combined result can violate a constraint that spans both rows. Two on-call doctors each see two people on call, each goes off duty, and now zero are on call. Under serializable isolation one would abort. Under snapshot isolation both succeed. PostgreSQL added Serializable Snapshot Isolation (SSI) in version 9.1 to detect these cycles, at the cost of occasional false-positive aborts.`,
        `Long transactions are the operational failure. One idle-in-transaction session pins the xmin horizon. Every tuple replaced after that point is unreclaimable. Autovacuum runs and reclaims nothing. Table files grow, indexes bloat, scans slow, cache hit rates fall, disk alarms fire. The fix is not autovacuum tuning; it is finding and ending the old transaction. Set idle_in_transaction_session_timeout as a safety net.`,
        `Hot rows are a subtler problem. A counter updated 1,000 times per second creates 1,000 dead tuples per second. It is not just a lock contention point; it is a dead-tuple factory. Shard the counter, append events and aggregate, or move the workload to a structure designed for high write churn.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Two transactions run concurrently on an account with balance $500.`,
        `The heap starts with one tuple: (balance=$500, xmin=50, xmax=0). Transaction T1 (txid 100) and T2 (txid 101) both start snapshots. Both see the $500 tuple because xmin=50 is committed and before both snapshots, and xmax=0 means no replacement exists.`,
        `T1 runs UPDATE accounts SET balance = $300. PostgreSQL inserts a new tuple (balance=$300, xmin=100, xmax=0) and stamps xmax=100 on the old tuple. The heap now has two physical rows for one logical account.`,
        `T2 reads the account. T1 has not committed yet. T2 checks the old tuple: xmin=50 is committed and visible; xmax=100 is in-progress in T2's snapshot, so the old tuple is treated as not yet dead. T2 checks the new tuple: xmin=100 is in-progress, so the new tuple is invisible. T2 sees $500.`,
        `T1 commits. T2 still sees $500 because its snapshot was taken before T1 committed. A new transaction T3 starting now would see $300. The old $500 tuple is dead: its xmax=100 is now committed. Once T2 also commits and no active snapshot predates txid 100, VACUUM can reclaim the old tuple's space.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `David P. Reed, "Naming and Synchronization in a Decentralized Computer System," MIT PhD thesis, 1978 -- the original MVCC proposal. Michael J. Cahill, Uwe Rohm, and Alan D. Fekete, "Serializable Isolation for Snapshot Databases," SIGMOD 2008 -- the SSI algorithm PostgreSQL implements. PostgreSQL source: src/backend/access/heap/heapam_visibility.c for the visibility rule implementation. The PostgreSQL documentation chapters on MVCC and routine vacuuming are the best primary reference for operational behavior.`,
        `Study isolation levels next to understand where snapshot isolation sits relative to read committed and serializable. Study Write-Ahead Log to see how new versions survive crashes. Study two-phase locking for the alternative MVCC replaced. Study B-trees to understand the index structures that must be maintained alongside version chains. For distributed MVCC, study hybrid logical clocks and Spanner's TrueTime.`,
      ],
    },
  ],
};
