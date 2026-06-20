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
      heading: 'Why this exists',
      paragraphs: [
        'SQLite exists for the many cases where an application needs a real SQL database but does not want to run a separate database server. A mobile app, browser, desktop tool, embedded product, test runner, or edge cache may need indexes, transactions, crash recovery, and queries inside one ordinary file.',
        'That constraint makes SQLite an unusually good teaching case. There is no server process to hide the machinery. A logical row becomes a record inside a B-tree cell, inside a page, inside a database file. The pager is the layer that turns page changes into durable, transactional file updates.',
        'The point is not that every database should look like SQLite. The point is that SQLite makes storage architecture visible. B-trees, page caches, journals, WAL files, locks, and checkpoints become concrete engineering objects rather than abstract database vocabulary.',
        {type:'callout', text:'SQLite becomes teachable because logical B-trees and physical crash safety meet at the pager page boundary.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/6/65/B-tree.svg', alt:'Small B-tree with a root node and three child nodes containing sorted keys.', caption:'Small 3-5 B-tree example. CyHawk, Wikimedia Commons, CC BY-SA 3.0 or GFDL.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simple answer would be to store each table as a flat append-only file and scan it when needed. That keeps storage easy, but indexed lookup, ordered traversal, deletes, updates, transactions, and crash recovery become painful quickly.',
        'The other wrong mental model is to treat SQLite like a small PostgreSQL server. SQLite is not organized around remote clients, background daemons, or many concurrent writers. It is a local file database, so page layout and locking rules are central, not incidental.',
        'Another tempting simplification is to say SQLite is "just a B-tree." The B-tree matters, but it is not the whole database. Without the pager, transaction protocol, journal or WAL mode, schema table, locking, and page cache, the tree would not be a reliable SQL database stored in a single file.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The database file is divided into fixed-size pages. Tables and indexes are B-trees over those pages. Interior pages route search; leaf pages store records or index entries. Page 1 holds the database header and usually the root of sqlite_schema, so the file can describe its own tables and indexes.',
        'The pager owns page caching, locking, transaction state, rollback journals, WAL frames, and durability. The B-tree layer asks for pages and changes logical tree contents; the pager decides how those page changes become safe bytes on disk.',
        'That separation is the core insight. The B-tree layer is about logical structure: seek this key, insert this record, split this page, traverse this index. The pager layer is about physical safety: which page version is cached, which transaction owns a lock, what happens after a crash, and when modified pages reach the main file.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'SQLite compiles SQL into bytecode for a virtual machine. That VM calls into the B-tree layer for table and index operations. The B-tree layer asks the pager for pages, interprets page cells, follows child pointers, splits pages when needed, and maintains sorted key order.',
        'A B-tree page has structure: page header, cell pointer array, cells, and free space. Cells hold payload and sometimes child page pointers. The cell pointer array lets SQLite keep keys ordered inside a page while cells themselves can be variable-sized. That matters because records and index entries are not fixed-width rows.',
        'The pager maintains a page cache and transaction state. In rollback journal mode, SQLite protects old page contents before overwriting the main file. In WAL mode, writes append changed page frames to a separate -wal file. A commit is represented in the WAL, and checkpointing later copies frames back into the main database file.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The page B-tree view proves the descent from logical SQL to physical pages. SQL bytecode performs operations. The B-tree layer maps tables and indexes onto page trees. The pager supplies cached pages. The main file stores stable pages. These are separate responsibilities even though they live inside one library.',
        'The page anatomy table proves why "a page stores rows" is too vague. A page stores headers, ordered cell pointers, variable-sized cells, and free space. This layout lets SQLite search within a page, split pages, and store variable-length records without turning every page into a simple array.',
        'The WAL view proves that commit flow is a storage design choice. WAL mode appends frames instead of immediately overwriting the main database. That lets readers keep using an older snapshot while a writer appends new state, but it also introduces checkpoint behavior and local-file constraints.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because B-trees match the needs of local indexed storage. They preserve sorted order, support logarithmic lookup, range scans, inserts, and deletes, and align naturally with fixed-size pages. A page is large enough to amortize disk and filesystem overhead but small enough to cache and rewrite.',
        'It also works because the pager centralizes durability. If every higher layer wrote bytes directly, crash consistency would be impossible to reason about. By routing page reads and writes through the pager, SQLite can enforce transaction boundaries, lock states, journaling, WAL semantics, and cache behavior in one place.',
        'The single-file design works because the database is embedded. The application and database engine share a process. There is no network protocol between them. That eliminates a large class of deployment complexity while making local filesystem behavior more important.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The tradeoff is local simplicity versus concurrent write scale. SQLite is fast partly because it is embedded and file-backed. But the single-file, one-writer shape is real. WAL improves reader/writer overlap, but it does not turn SQLite into a multi-writer server database.',
        'Page size, cache size, fsync behavior, checkpoints, vacuuming, transaction length, lock modes, and filesystem semantics all matter. A long write transaction can block other writes. A checkpoint can create visible latency. A poorly chosen access pattern can churn the page cache.',
        'The row-oriented B-tree layout is also not ideal for every workload. SQLite is excellent for local OLTP and mixed embedded workloads. Parquet, DuckDB-style columnar execution, or a server database may fit large analytical scans, distributed writes, or heavy multi-writer workloads better.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'SQLite fits mobile apps, desktop applications, browsers, edge devices, local caches, test fixtures, embedded products, and small services where one machine owns the data file and wants reliable SQL without running a separate database server.',
        'A browser profile database is a good concrete example. Bookmarks, history, cookies, and settings live in local tables and indexes. Reads are cheap and local. WAL mode lets reading continue while writes append frames. Checkpoints and vacuuming become maintenance work for a long-lived file.',
        'It also wins as an application file format. Instead of inventing a custom binary file, an application can store structured data in tables, use indexes, run migrations, and get transactional updates. The file remains portable and inspectable with standard SQLite tools.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The biggest failure is treating SQLite like a remote multi-user database server. It can serve many important workloads, but write concurrency, network filesystems, long transactions, and process coordination require respect for SQLite’s locking and WAL behavior.',
        'Another failure is ignoring checkpoint and vacuum behavior. WAL files can grow if checkpoints are blocked by long-lived readers. Deleted space may not shrink the main file until vacuuming or auto-vacuum behavior handles it. Storage maintenance is part of the operational model.',
        'A third failure is using it for the wrong physical shape. If the workload is mostly large analytical column scans, SQLite’s B-tree row storage may be the wrong layout. If the workload needs many independent writers across machines, a client/server database or distributed system may be the right tool.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Official sources: SQLite file format at https://www.sqlite.org/fileformat.html, architecture at https://sqlite.org/arch.html, B-tree module at https://sqlite.org/btreemodule.html, and WAL docs at https://sqlite.org/wal.html. Study B-Trees, B+ Tree Leaf Sibling Scan Case Study, Write-Ahead Log, Linux Page Cache XArray, OPFS Origin Private File System, MVCC Internals & VACUUM, Database Indexing, and Parquet Columnar Format Case Study next.',
        'A useful exercise is to create a small SQLite database, inspect page size and WAL mode, run inserts inside and outside transactions, and watch the -wal file and checkpoint behavior. That turns the pager from a diagram into something you can observe.',
      ],
    },
  ],
};
