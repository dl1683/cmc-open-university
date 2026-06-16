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
    explanation: 'Transaction Isolation Levels promised that MVCC lets readers and writers ignore each other; here is the machinery that delivers it. In PostgreSQL an UPDATE never touches the old row — it INSERTS a fresh physical version and stamps two hidden columns: xmin, the ID of the transaction that created the version, and xmax, the ID of the one that superseded it. Our "balance" row has lived three lives: $100 (created by txn 100, ended by 205), $80 (205 → 310), and the current $95 (310 → ∞). All three versions sit on disk RIGHT NOW, side by side. The row\'s history is not in a log somewhere — the table IS the log.',
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
    explanation: 'The visibility rule, applied live by this module: a version is visible to a snapshot when it was born before the snapshot (xmin ≤ snap) and not yet superseded at the snapshot (xmax > snap). Read the columns: the reader who started at txid 150 sees $100; the one at 250 sees $80; the one at 400 sees $95. Each gets exactly ONE version — a complete, consistent world — and notice what nobody needed: a lock. The writer creating version 3 never blocked the reader at 250, because that reader\'s world ($80) was already immutable history. Readers read history; writers append to it; history never changes. That sentence is all of MVCC.',
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
    explanation: 'Step back and the design is an old friend wearing a database costume: Git Internals never edits an object (a new commit is a new hash), the LSM Tree never updates in place (a new entry shadows the old), Cache Invalidation\'s versioned filenames never change content under a name. Immutability buys the same three gifts every time: writers never contend with readers, history is queryable for free, and crash recovery is trivial (half-written NEW data never corrupts OLD data). And it charges the same fee every time — the dead versions pile up, and someone must take out the trash. In PostgreSQL that someone has a name, and the other view watches it work… and watches it get locked out.',
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
    explanation: 'The fee comes due. Once every active snapshot is newer than a version\'s xmax, that version is visible to NO ONE — a DEAD TUPLE. It still occupies its bytes on the page. A frequently-updated row (a counter, a balance, a job-status flag) manufactures corpses at its update rate: this one row now holds five versions\' worth of disk for one row\'s worth of truth — 80% bloat. Scans wade through the corpses (checking visibility on each), indexes point at them, the cache fills with them. Append-only was never free; it was BUY NOW, CLEAN LATER.',
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
    explanation: 'Enter VACUUM. It scans for tuples whose xmax has committed, and for each asks the one question that matters: is this version invisible to the OLDEST snapshot still alive anywhere in the system — the "xmin horizon"? Only then is it truly garbage. Regular VACUUM marks the space reusable by future inserts (the table does not shrink, but stops growing); VACUUM FULL rewrites the table compactly but locks it — the difference between sweeping a room and renovating it. Autovacuum runs the sweep automatically when dead tuples pass a threshold, and a healthy database hums along at a few percent bloat. Now watch one careless connection break the entire mechanism.',
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
    explanation: 'The classic production incident, hour by hour. An analyst opens a transaction at 9:00 — maybe just a psql session with a forgotten BEGIN — and goes to lunch. That idle transaction holds a 9:00 am snapshot, so the xmin horizon FREEZES at 9:00: every version superseded after that moment might still be visible to the sleeping session, so VACUUM must keep ALL of it. Autovacuum runs faithfully and reclaims nothing. By 2 pm, millions of unvacuumable dead tuples; by 4 pm someone pages the DBA, who finds the famous "idle in transaction" in pg_stat_activity and kills it — and only then can vacuum catch up. The moral is wonderfully unfair: in an MVCC database, the cheapest way to hurt WRITERS everywhere is a READER who simply refuses to leave.',
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
    explanation: 'The operational digest. Set the idle-transaction timeout (the lunch scenario dies automatically), watch dead-tuple counts like a gauge, and design schemas knowing every UPDATE is secretly an INSERT — a 1000-writes-per-second counter row is a corpse factory better served by an append-and-aggregate pattern (let the Message Queue absorb the rate). The closing symmetry for the systems tour: LSM compaction, git gc, and VACUUM are one job description — deferred cleanup of immutable history — and all three fail the same way: when cleanup cannot keep pace with creation, or when something pins history alive. Choose immutability for its gifts, then budget, monitor, and protect the janitor.',
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
      heading: `What it is`,
      paragraphs: [
        `MVCC — Multi-Version Concurrency Control — is a database design that never overwrites a row. Every UPDATE creates a new physical version and stamps both old and new with transaction IDs: xmin (creation) and xmax (death). All versions sit on disk, and each reader sees exactly one version — the one alive when their snapshot began. The table IS the log; you do not need a separate changelog. This unlocks the central promise: readers and writers ignore each other. No locks, no waits. The cost is deferred: old versions accumulate. Once no snapshot can see a version, it is DEAD but still occupies disk. A frequently-updated row (counter, balance, status) manufactures corpses at its update rate: four updates = one live version plus four dead ones, 80 percent bloat. A janitor called VACUUM scans for dead tuples, but only the oldest active snapshot (the xmin horizon) determines what is truly garbage. Forget to close a transaction, and the horizon freezes — the janitor's hands are tied.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `PostgreSQL assigns each transaction a monotonically increasing ID (txid). INSERT stamps xmin with your txid and xmax with ∞. UPDATE does not touch the old row — it inserts a new version with xmin = your txid, then stamps the old version's xmax with your txid. The visibility rule applies: a version is visible if xmin ≤ snapshot AND xmax > snapshot. Three versions of a balance: $100 at txid 100–205; $80 at 205–310; $95 at 310–∞. A reader at txid 150 sees $100. One at 250 sees $80. One at 400 sees $95. Each sees one consistent snapshot, and none blocked the others. VACUUM scans rows, identifies dead versions (xmax in the past), and asks: is this older than the OLDEST active snapshot? If yes, it is garbage forever.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Upside: readers scale with writers, perfect isolation. Downside: disk and CPU. Every UPDATE bloats the row. A hot row (1000 writes/sec) births 1000 corpses/sec. Scans check visibility on dead tuples; bloated tables chew through I/O. VACUUM scans the table, marks dead space reusable (FULL rewrites, locking the table). Autovacuum triggers at ~20 percent dead-tuple thresholds. Healthy databases stay a few percent bloat. The immutability family spans Git (commit = new hash), LSM trees (new entry shadows old), and versioned caches — all append-only, all require cleanup, all fail when cleanup cannot pace creation or history is pinned alive.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Every production PostgreSQL uses MVCC as its backbone. Long-running analytics coexist with fast OLTP writers because reader snapshots never block writer versions. Snapshot Isolation gives ACID without locks — git-style immutability for database rows. Temporal queries ("show the balance on Jan 15 at 3pm") work when history is physically present. Auditing systems deliberately keep old versions, accepting bloat for forensics.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The deadliest trap: forgotten BEGIN. An analyst issues BEGIN, queries, and goes to lunch. That idle snapshot pins the xmin horizon at 9:00 am. Every newer version is potentially visible to the sleeper, so VACUUM cannot touch it. By 2 pm, millions of unvacuumable dead tuples; by 4 pm, visible slowness; only when the DBA kills the idle-in-transaction connection can VACUUM clean up. In MVCC, the cheapest way to hurt all writers is a reader who refuses to leave. Common mistakes: skipping idle_in_transaction_session_timeout, ignoring n_dead_tup (the bloat speedometer), and designing counters as single hot rows (each update births a corpse — append-and-aggregate instead). The visibility rule is not magic; it is snapshot semantics frozen in time.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `For the parts MVCC does not remove, study PostgreSQL Lock Manager & Deadlock Detector for relation, row, transaction, and advisory lock waits. PostgreSQL Advisory Lock Keyspace covers application-defined locks, and Transaction Savepoint Stack explains partial rollback plus lock cleanup after savepoint rollback.`,
        `For the maintenance side MVCC depends on, continue into PostgreSQL Autovacuum Freeze & Wraparound. It explains relfrozenxid age, visibility-map all-frozen bits, forced anti-wraparound scans, and why VACUUM is correctness work as well as bloat cleanup.`,
        `MVCC is one path through Transaction Isolation Levels; see how Serializable adds phantom-protection. Git Internals shares the append-only model and cleanup (gc). LSM Tree applies the same design to NoSQL. Cache Invalidation & Versioning covers versioned names and expiration in distributed caches. Write-Ahead Logging explains how PostgreSQL pairs MVCC with crash safety.`,
      ],
    },
  ],
};
