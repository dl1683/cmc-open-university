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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a boundary between logical records and physical pages. A B-tree is a sorted search tree whose nodes hold many keys, and the pager is the SQLite layer that reads, caches, journals, and writes fixed-size database pages. Active nodes show which layer owns the current decision.',
        'Visited pages are pages whose role is already known in the lookup or commit path. Found markers mean the page or frame is now the authoritative next step. The safe inference is that B-tree correctness depends on sorted page contents, while transaction safety depends on the pager making page changes recoverable.',
        {type:'callout', text:'SQLite becomes teachable because logical B-trees and physical crash safety meet at the pager page boundary.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/6/65/B-tree.svg', alt:'Small B-tree with a root node and three child nodes containing sorted keys.', caption:'Small 3-5 B-tree example. CyHawk, Wikimedia Commons, CC BY-SA 3.0 or GFDL.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'SQLite stores a relational database inside one ordinary file. SQL asks for rows and indexes, but the operating system reads and writes byte ranges. SQLite needs a format that can find records quickly, update them safely, and survive process or machine failure.',
        'The design splits the problem. B-trees organize records and index entries into sorted pages, while the pager owns page cache, locking, rollback journal or write-ahead log behavior, and recovery. The page is the shared unit that lets the layers cooperate.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious database file is an append-only list of rows. Inserting is easy because new bytes go at the end, and a full scan can still answer small queries. That breaks once lookup by primary key, range scan, deletion, and index maintenance become normal operations.',
        'Another obvious idea is to rewrite pages in place as soon as rows change. That is fast until the program crashes between two related writes. After the crash, the file may contain half of a transaction, which is worse than being slow because the database can no longer explain its own state.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that a database needs both search structure and atomic change. A row lookup wants a tree path, usually root page to internal page to leaf page. A transaction wants all of its page changes to appear together or not at all.',
        'Those goals conflict if every layer writes whenever it likes. The B-tree layer can know where a row belongs, but it cannot alone guarantee crash recovery. The pager can make page writes durable, but it needs the B-tree layer to preserve sorted cell order and page-link invariants.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Use fixed-size pages as the contract. A table or index B-tree is made of pages, and each page contains cells, headers, free space, and links according to its role. The pager can cache and protect pages without understanding every SQL operation.',
        'Write-ahead logging changes the commit path by appending changed pages as frames to a WAL file before checkpointing them back into the main database. Rollback journaling preserves old page images before overwrite. Both schemes make page transitions recoverable.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For a lookup, SQLite starts from a root page number known from schema metadata. It compares the key against sorted separator cells, follows a child page pointer, and repeats until it reaches a leaf. Inside a leaf, sorted cells identify the row payload or index entry.',
        'For an update, the B-tree layer asks the pager for writable pages. The pager records enough recovery state before the change becomes permanent. In WAL mode, commit means appending a commit-marked frame sequence to the WAL; later checkpointing copies committed page versions back to the main file.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Search correctness follows the B-tree ordering invariant. Every separator key divides child ranges, and every leaf cell remains in sorted order. If a key is less than the separator, it cannot be in the child range to the right; the tree can discard that side without scanning it.',
        'Crash correctness follows the pager invariant. After recovery, each page is either the old committed version or the new committed version named by a complete transaction record. There is no valid recovery state where only an arbitrary subset of transaction pages silently wins.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A lookup costs about the height of the B-tree in page reads, plus local search inside each page. With 4 KB pages and many cells per page, a tree with millions of rows can stay only a few levels deep. Doubling row count usually adds little cost until an additional tree level becomes necessary.',
        'Writes cost page dirties plus journal or WAL traffic. WAL can make commits sequential, but it adds checkpoint work and a separate file to manage. Memory is spent on the page cache, dirty-page tracking, locks, and B-tree page metadata.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'SQLite is used when a process needs a durable local database without running a separate server. Mobile apps, browsers, desktop tools, embedded devices, tests, and edge services use it because a single file can provide indexes, transactions, SQL, and crash recovery.',
        'The B-tree and pager split is also a general systems lesson. Many databases separate logical access methods from buffer management and recovery. SQLite makes that split easier to inspect because the page file, WAL, and transaction rules are documented and compact.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'SQLite is not the right shape for every workload. Many concurrent writers, cross-machine replication, huge analytical scans, and server-side privilege management can push users toward client-server databases. The single-file design is a strength until the workload needs distributed coordination.',
        'B-trees also pay update and locality costs. Page splits move cells, overflow pages complicate large payloads, and random writes can still hit storage limits. The pager makes crashes safe, but it cannot make a bad access pattern cheap.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Assume 4 KB pages and an index where an internal page can route to 200 children. One root page can cover 200 leaf pages, and two internal levels can cover 40,000 leaf pages. If each leaf stores 80 rows, those two levels can address about 3.2 million rows with root, internal, and leaf page reads.',
        'Now update 10 rows that live on 6 distinct pages in WAL mode. The B-tree changes those 6 page images, and the pager appends 6 WAL frames plus commit metadata. If the process crashes after 4 frames without a commit record, recovery ignores the partial transaction; if the commit record is present, recovery can replay the committed frames.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources start with the SQLite database file format at https://www.sqlite.org/fileformat2.html. Then read SQLite locking at https://www.sqlite.org/lockingv3.html and WAL mode at https://www.sqlite.org/wal.html to connect pages to recovery.',
        'Study B-tree for search invariants and Buffer Pool for cached pages. Then compare Write-Ahead Log, LSM Tree, and Filesystem Journaling to see how other systems separate lookup from recovery.',
      ],
    },
  ],
};
