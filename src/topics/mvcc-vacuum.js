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
    { heading: 'How to read the animation', paragraphs: [
      'The first view shows one logical database row stored as several physical versions. xmin is the transaction that created a version, and xmax is the transaction that replaced it or a marker meaning it is still current. Found cells mark the version visible to a reader snapshot; removed cells in the VACUUM view mark dead tuples that still occupy storage.',
      {type: 'callout', text: 'MVCC is append-first concurrency: preserve old versions for readers, then prove when the cleanup horizon makes them reclaimable.'},
      {type: 'image', src: './assets/gifs/mvcc-vacuum.gif', alt: 'Animated walkthrough of the mvcc vacuum visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
    ]},
    { heading: 'Why this exists', paragraphs: [
      'A database must let readers and writers overlap. A long report should not freeze every checkout, and a checkout should not make the report see half old data and half new data. MVCC means multi-version concurrency control: keep old row versions long enough for older readers, then clean them when no active snapshot can still see them.',
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Relational_database_terms.svg', alt: 'Relational database diagram showing rows, columns, and table relationships', caption: 'MVCC starts from an ordinary relation, but every logical row may have several physical tuple versions underneath. Source: Wikimedia Commons, Booyabazooka, public domain.'},
    ]},
    { heading: 'The obvious approach', paragraphs: ['The obvious approach is locking. A reader takes a shared lock, a writer takes an exclusive lock, and conflicting operations wait so the database never shows an illegal state. That is correct, but it couples progress for short writes to the lifetime of long reads.']},
    { heading: 'The wall', paragraphs: ['The wall is reader-writer interference. A report scanning a million rows can block updates for rows it has not reached yet, or writers can make the report wait behind short changes. In-place overwrite has the opposite failure: a reader can observe a database state that never existed at one time.']},
    { heading: 'The core insight', paragraphs: ['The core insight is append first, clean later. An update creates a new physical row version and marks the old version as superseded instead of overwriting it in place. Readers choose versions by snapshot time, so old readers and new writers no longer fight over one mutable row image.']},
    { heading: 'How it works', paragraphs: ['In a PostgreSQL-style heap, each tuple has xmin and xmax metadata. A version is visible to a snapshot if its creator committed before the snapshot and its replacer either does not exist or was not committed before the snapshot. VACUUM scans for dead tuples older than the oldest active snapshot and marks their space reusable.']},
    { heading: 'Why it works', paragraphs: ['The visibility rule gives each snapshot one coherent version of each logical row. Two versions cannot both be visible because the newer version xmin is the older version xmax, so admitting the newer one excludes the older one. Cleanup is correct because it waits until no active transaction could still see the tuple being reclaimed.']},
    { heading: 'Cost and complexity', paragraphs: ['Reads avoid blocking writes, but every update writes a new version and leaves cleanup work behind. Four updates to one row create one live tuple and four dead tuples that may still occupy heap pages, index entries, and cache. If writes create 10,000 dead tuples per minute and VACUUM reclaims 8,000, bloat grows by 2,000 tuples per minute.']},
    { heading: 'Real-world uses', paragraphs: [
      'PostgreSQL, Oracle, MySQL InnoDB, CockroachDB, YugabyteDB, and other databases use forms of MVCC because snapshot reads are essential to mixed transactional workloads. The same append-then-clean pattern appears in Git objects, copy-on-write file systems, LSM-tree compaction, and versioned cache keys.',
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Copy_On_Write_technique.png', alt: 'Copy-on-write diagram showing original blocks copied before update', caption: 'Copy-on-write is the storage-level cousin of MVCC: keep the old block for readers, write a new block for changes, then reclaim later. Source: Wikimedia Commons, Qdrddr, CC BY-SA 4.0.'},
    ]},
    { heading: 'Where it fails', paragraphs: ['MVCC does not automatically provide serializable behavior. Snapshot isolation can allow write skew, where two transactions read the same old state, write different rows, and together violate a cross-row rule. Operationally, long transactions pin the cleanup horizon, and hot rows can create dead tuples faster than VACUUM can reclaim them.']},
    { heading: 'Worked example', paragraphs: ['A row starts as balance = 500 with xmin = 50 and xmax = 0. Transaction T100 updates it to 300, so the old tuple becomes balance = 500, xmin = 50, xmax = 100, and the new tuple becomes balance = 300, xmin = 100, xmax = 0. A reader whose snapshot started at transaction 90 sees 500; a new reader after T100 commits sees 300.']},
    { heading: 'Sources and study next', paragraphs: ['Primary references include David Reed on MVCC, PostgreSQL documentation on MVCC and routine vacuuming, PostgreSQL heap visibility source, and papers on Serializable Snapshot Isolation. Study isolation levels, two-phase locking, write-ahead logging, B-trees, LSM compaction, and distributed timestamps next.']},
  ],
};
