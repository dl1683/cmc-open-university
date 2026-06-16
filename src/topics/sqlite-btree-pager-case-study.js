// SQLite internals: database pages, table/index B-trees, pager, rollback
// journals, and WAL mode.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'sqlite-btree-pager-case-study',
  title: 'SQLite B-Tree & Pager Case Study',
  category: 'Systems',
  summary: 'SQLite as a single-file database lesson: pages hold table/index B-trees, the pager owns disk safety, and WAL changes commit flow.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['page b-tree layout', 'pager wal flow'], defaultValue: 'page b-tree layout' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function sqliteGraph(title) {
  return graphState({
    nodes: [
      { id: 'sql', label: 'SQL VM', x: 0.8, y: 4.0, note: 'bytecode executes' },
      { id: 'btree', label: 'B-tree layer', x: 2.8, y: 4.0, note: 'tables + indexes' },
      { id: 'pager', label: 'pager', x: 4.8, y: 4.0, note: 'page cache + transactions' },
      { id: 'page1', label: 'page 1', x: 6.8, y: 2.2, note: 'schema table root' },
      { id: 'leaf', label: 'leaf pages', x: 6.8, y: 5.8, note: 'records/cells' },
      { id: 'db', label: 'main .db file', x: 9.0, y: 3.0, note: 'stable pages' },
      { id: 'wal', label: '-wal file', x: 9.0, y: 5.3, note: 'committed frames' },
    ],
    edges: [
      { id: 'e-sql-btree', from: 'sql', to: 'btree', weight: 'seek/insert' },
      { id: 'e-btree-pager', from: 'btree', to: 'pager', weight: 'get page' },
      { id: 'e-pager-page1', from: 'pager', to: 'page1', weight: 'cache page' },
      { id: 'e-pager-leaf', from: 'pager', to: 'leaf', weight: 'cache page' },
      { id: 'e-pager-db', from: 'pager', to: 'db', weight: 'read/write pages' },
      { id: 'e-pager-wal', from: 'pager', to: 'wal', weight: 'append frames' },
      { id: 'e-wal-db', from: 'wal', to: 'db', weight: 'checkpoint' },
    ],
  }, { title });
}

function* pageBtreeLayout() {
  yield {
    state: sqliteGraph('SQLite stores tables and indexes in B-trees over pages'),
    highlight: { active: ['btree', 'page1', 'leaf'], compare: ['pager', 'db'] },
    explanation: 'SQLite is a single-file database, but inside the file are fixed-size pages. Tables and indexes are B-tree structures spanning those pages. The B-tree layer asks the pager for pages; it does not own raw disk IO directly.',
  };

  yield {
    state: labelMatrix(
      'Page roles',
      [
        { id: 'header', label: 'database header' },
        { id: 'schema', label: 'sqlite_schema B-tree' },
        { id: 'table', label: 'table B-tree' },
        { id: 'index', label: 'index B-tree' },
      ],
      [
        { id: 'where', label: 'where' },
        { id: 'purpose', label: 'purpose' },
      ],
      [
        ['page 1 start', 'file metadata'],
        ['page 1 root', 'tables and indexes catalog'],
        ['root + interior + leaves', 'rowid records'],
        ['root + interior + leaves', 'key lookup'],
      ],
    ),
    highlight: { found: ['schema:purpose', 'table:purpose', 'index:purpose'], compare: ['header:where'] },
    explanation: 'Every ordinary table and index is represented by a B-tree rooted at some page. The schema table itself is a B-tree, so the file can describe the rest of the file.',
    invariant: 'The on-disk format is page-oriented; logical rows live inside page cells.',
  };

  yield {
    state: labelMatrix(
      'B-tree page anatomy',
      [
        { id: 'hdr', label: 'page header' },
        { id: 'ptrs', label: 'cell pointer array' },
        { id: 'cells', label: 'cells' },
        { id: 'free', label: 'free space' },
      ],
      [
        { id: 'contains', label: 'contains' },
        { id: 'why', label: 'why it matters' },
      ],
      [
        ['flags + counts', 'know page type'],
        ['offsets sorted by key', 'binary search inside page'],
        ['payload + child ptrs', 'store records/index entries'],
        ['fragmented area', 'defragment when needed'],
      ],
    ),
    highlight: { active: ['ptrs:why', 'cells:contains'], compare: ['free:why'] },
    explanation: 'A B-tree page is not just an array of rows. It has a header, an ordered cell pointer array, variable-sized cells, and free space. That layout lets SQLite store variable-length records while preserving sorted lookup.',
  };

  yield {
    state: labelMatrix(
      'SQLite neighbors',
      [
        { id: 'btree', label: 'B-Trees' },
        { id: 'wal', label: 'Write-Ahead Log' },
        { id: 'mvcc', label: 'MVCC' },
        { id: 'lsm', label: 'LSM Tree' },
      ],
      [
        { id: 'connection', label: 'connection' },
        { id: 'difference', label: 'difference' },
      ],
      [
        ['page-index structure', 'single-file implementation'],
        ['commit safety', 'SQLite WAL is local file mode'],
        ['reader snapshots', 'not PostgreSQL-style row versions'],
        ['write optimization', 'SQLite updates pages, not SSTables'],
      ],
    ),
    highlight: { found: ['btree:connection', 'wal:connection'], compare: ['lsm:difference'] },
    explanation: 'The case-study value is concrete: B-tree and WAL are not abstract diagrams; they become page formats, file suffixes, cache rules, and checkpoint decisions.',
  };
}

function* pagerWalFlow() {
  yield {
    state: sqliteGraph('The pager owns transactional page IO'),
    highlight: { active: ['pager', 'db'], compare: ['btree', 'sql'] },
    explanation: 'The pager layer manages page cache, locks, transaction state, and durability. The B-tree layer manipulates logical pages; the pager decides how those page changes reach stable storage.',
  };

  yield {
    state: sqliteGraph('WAL mode appends changed pages to the -wal file'),
    highlight: { active: ['pager', 'wal', 'e-pager-wal'], compare: ['db'] },
    explanation: 'In WAL mode, writers append changed page frames to a separate WAL file instead of overwriting the main database file immediately. A commit is represented in the WAL, and checkpointing later copies frames back.',
    invariant: 'Readers can keep using an older database snapshot while a writer appends newer frames.',
  };

  yield {
    state: labelMatrix(
      'Rollback journal versus WAL',
      [
        { id: 'rollback', label: 'rollback journal' },
        { id: 'wal', label: 'WAL mode' },
        { id: 'checkpoint', label: 'checkpoint' },
        { id: 'readers', label: 'readers' },
      ],
      [
        { id: 'writePath', label: 'write path' },
        { id: 'concurrency', label: 'concurrency' },
      ],
      [
        ['save old pages first', 'rollback restores old content'],
        ['append new frames', 'readers and one writer can overlap'],
        ['copy frames to db', 'maintenance cost'],
        ['snapshot end mark', 'must not be overwritten underneath'],
      ],
    ),
    highlight: { found: ['wal:concurrency', 'readers:concurrency'], compare: ['checkpoint:writePath'] },
    explanation: 'WAL flips the commit path from undo old pages to roll forward new frames. This improves many workloads but adds checkpoint behavior and local-file constraints.',
  };

  yield {
    state: labelMatrix(
      'Operational case study',
      [
        { id: 'mobile', label: 'mobile app db' },
        { id: 'edge', label: 'edge cache' },
        { id: 'server', label: 'small web service' },
        { id: 'sync', label: 'sync job' },
      ],
      [
        { id: 'whySqlite', label: 'why SQLite fits' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['single file', 'long write transaction blocks'],
        ['local durability', 'checkpoint stalls'],
        ['embedded SQL', 'one writer bottleneck'],
        ['copyable file', 'conflict handling external'],
      ],
    ),
    highlight: { active: ['mobile:whySqlite', 'server:whySqlite'], compare: ['server:risk'] },
    explanation: 'SQLite is excellent when the database is local and embedded. The design lesson is to respect the one-file, page-cache, one-writer shape instead of pretending it is a remote client/server database.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'page b-tree layout') yield* pageBtreeLayout();
  else if (view === 'pager wal flow') yield* pagerWalFlow();
  else throw new InputError('Pick a SQLite internals view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'SQLite is an embedded SQL database whose durable state lives in ordinary files. Its internal architecture is a clean systems case study: SQL bytecode calls a B-tree layer, the B-tree layer stores tables and indexes in pages, and the pager layer handles caching, locking, rollback, WAL, and disk safety. Linux Page Cache XArray is the lower operating-system layer underneath the ordinary file.',
        'The important mental model is page ownership. A logical table row becomes a record inside a B-tree cell inside a page inside a database file. The pager is the boundary between tree manipulation and persistence.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The database file is divided into fixed-size pages. Page 1 contains the database header and usually the root of the sqlite_schema table. Each ordinary table uses a table B-tree, and each index uses an index B-tree. Interior pages route searches; leaf pages store records or index entries.',
        'For transactions, SQLite can use rollback journals or WAL mode. In rollback journal mode, old page content is saved before overwriting the database file. In WAL mode, changed page frames are appended to a -wal file, and checkpointing later moves committed frames into the main database file.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'SQLite is fast because it is embedded and avoids network round trips, but it is shaped by local-file constraints. Page size, cache behavior, write transactions, fsync, checkpoints, vacuuming, and lock modes matter. WAL improves read/write overlap, but it does not remove the single-writer nature of SQLite.',
        'The B-tree layout also means records are organized by rowid or index key, not by analytical column chunks. That makes SQLite excellent for local OLTP and mixed embedded workloads, but Parquet or column stores fit large analytical scans better.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'SQLite is used in mobile apps, desktop applications, browsers, edge devices, local caches, test fixtures, embedded products, and small services. It is often the right answer when one process or one machine owns the data file and wants reliable SQL without a database server.',
        'A complete case study is a browser profile database. Bookmarks, history, and settings live in local tables and indexes. Reads are cheap and local. WAL mode lets the browser keep reading while writes append frames. Checkpoints and vacuuming become maintenance work for a long-lived file.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'SQLite is not a drop-in replacement for a distributed database. Multiple processes and threads must respect its locking model. WAL is not a network replication log. Another misconception is that B-tree means every query is indexed; query performance still depends on schema, indexes, and access patterns.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Official sources: SQLite file format at https://www.sqlite.org/fileformat.html, architecture at https://sqlite.org/arch.html, B-tree module at https://sqlite.org/btreemodule.html, and WAL docs at https://sqlite.org/wal.html. Study B-Trees, B+ Tree Leaf Sibling Scan Case Study, Write-Ahead Log, Linux Page Cache XArray, OPFS Origin Private File System, MVCC Internals & VACUUM, Database Indexing, and Parquet Columnar Format Case Study next.',
      ],
    },
  ],
};
