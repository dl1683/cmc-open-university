// Database indexing: why one query takes 2ms and the same query without an
// index takes 30 seconds. Full scans, secondary indexes, covering indexes,
// and the write-time bill — the B-tree put to work.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'database-indexing',
  title: 'Database Indexing',
  category: 'Systems',
  summary: 'Full scan vs index lookup vs covering index — the same query at three wildly different costs.',
  controls: [
    { id: 'query', label: 'Run', type: 'select', options: ['WHERE age = 41 (no index)', 'WHERE age = 41 (indexed)', 'covering index'], defaultValue: 'WHERE age = 41 (no index)' },
  ],
  run,
};

// A users table, stored in primary-key order (the CLUSTERED index).
const USERS = [
  { id: 1, age: 34, year: 2019 }, { id: 2, age: 29, year: 2021 },
  { id: 3, age: 41, year: 2020 }, { id: 4, age: 55, year: 2018 },
  { id: 5, age: 38, year: 2023 }, { id: 6, age: 23, year: 2022 },
  { id: 7, age: 47, year: 2020 }, { id: 8, age: 31, year: 2024 },
];
const TARGET_AGE = 41;

const tableRows = USERS.map((_, i) => ({ id: `r${i}`, label: `row ${i}` }));
const tableCols = [{ id: 'id', label: 'id' }, { id: 'age', label: 'age' }, { id: 'year', label: 'year' }];
const tableState = (title) => matrixState({
  title, rows: tableRows, columns: tableCols,
  values: USERS.map((u) => [u.id, u.age, u.year]),
});

export function* run(input) {
  const mode = String(input.query);
  const modes = ['WHERE age = 41 (no index)', 'WHERE age = 41 (indexed)', 'covering index'];
  if (!modes.includes(mode)) throw new InputError('Pick a query.');

  yield {
    state: tableState('The users table (stored in id order — the clustered index)'),
    highlight: {},
    explanation: 'A table is not a bag of rows: it is physically stored in SOME order — here by primary key id, which makes the table itself a B-Tree keyed on id (the CLUSTERED index; this is how Postgres heap+pkey, MySQL InnoDB, and SQLite all roughly work). So "WHERE id = 6" is already fast: a B-tree descent, O(log n). The trouble starts when you ask about any OTHER column.',
  };

  if (mode === modes[0]) {
    yield {
      state: tableState(`SELECT * WHERE age = ${TARGET_AGE} — no index on age`),
      highlight: { compare: USERS.map((_, i) => `r${i}:age`) },
      explanation: `The query asks about age, but the table is ordered by id — age values are scattered with no structure. The database has ONE option: the FULL TABLE SCAN, reading every row and checking every age. Eight rows here; at production scale this is millions of rows pulled off disk to answer one lookup — the classic "why is this query taking 30 seconds".`,
      invariant: 'Without an index on a column, every query on it costs O(n) — always.',
    };
    yield {
      state: tableState('Found — after touching everything'),
      highlight: { found: ['r2:age'], visited: USERS.map((_, i) => `r${i}:age`).filter((c) => c !== 'r2:age') },
      explanation: `Row 2 matched (id 3, age ${TARGET_AGE}) — but we paid for all 8. The fix is the database's most important knob: CREATE INDEX ON users(age). Re-run this query with the index to watch the same question cost almost nothing.`,
    };
    return;
  }

  const indexEntries = [...USERS].sort((a, b) => a.age - b.age);
  const idxRows = indexEntries.map((_, i) => ({ id: `x${i}`, label: `entry ${i}` }));
  const targetIdx = indexEntries.findIndex((u) => u.age === TARGET_AGE);

  if (mode === modes[1]) {
    yield {
      state: matrixState({
        title: 'The secondary index: (age → id), sorted by age',
        rows: idxRows,
        columns: [{ id: 'age', label: 'age' }, { id: 'ptr', label: '→ id' }],
        values: indexEntries.map((u) => [u.age, u.id]),
      }),
      highlight: {},
      explanation: 'CREATE INDEX ON users(age) builds a SECOND B-Tree: keyed by age, with each leaf holding just (age, pointer-to-row). It is a sorted copy of one column plus addresses — small, separate from the table, and maintained automatically.',
    };
    yield {
      state: matrixState({
        title: `Index seek: binary search for age = ${TARGET_AGE}`,
        rows: idxRows,
        columns: [{ id: 'age', label: 'age' }, { id: 'ptr', label: '→ id' }],
        values: indexEntries.map((u) => [u.age, u.id]),
      }),
      highlight: { found: [`x${targetIdx}:age`, `x${targetIdx}:ptr`], visited: [`x${Math.floor((indexEntries.length - 1) / 2)}:age`] },
      explanation: `Because the index is SORTED on age, finding ${TARGET_AGE} is a Binary Search — a B-tree descent of ~${Math.ceil(Math.log2(indexEntries.length))} touches instead of ${USERS.length}. The entry says: your row lives at id ${indexEntries[targetIdx].id}.`,
    };
    yield {
      state: tableState('Then one hop into the table'),
      highlight: { found: ['r2:id', 'r2:age', 'r2:year'] },
      explanation: `Follow the pointer: one clustered-index lookup fetches the full row. Total: O(log n) + 1 row read, versus O(n) rows for the scan — at a million rows, ~20 touches versus 1,000,000. That ratio is the entire economics of database performance, and why the first question to any slow query is "what does EXPLAIN say it's using?"`,
    };
    return;
  }

  yield {
    state: matrixState({
      title: 'A covering index: (age, year) — the answer travels with the key',
      rows: idxRows,
      columns: [{ id: 'age', label: 'age' }, { id: 'year', label: 'year' }],
      values: indexEntries.map((u) => [u.age, u.year]),
    }),
    highlight: { found: [`x${targetIdx}:age`, `x${targetIdx}:year`] },
    explanation: `One refinement deeper: the query "SELECT year WHERE age = ${TARGET_AGE}" only needs year. Build the index as (age, year) and the answer is sitting IN the index entry — the table is NEVER touched at all. This is a COVERING index: the lookup starts and ends in one small B-tree. (It is also why SELECT * is a habit worth breaking — name your columns and more queries become coverable.)`,
  };

  yield {
    state: tableState('The bill arrives at write time'),
    highlight: { compare: USERS.map((_, i) => `r${i}:age`) },
    explanation: 'Nothing was free: every INSERT or UPDATE must now write the table AND every index on it — two indexes means three B-trees updated per write (write amplification; the same pressure that pushed LSM Trees (How Cassandra Writes) to a different design entirely). And an index on a low-variety column (e.g., a boolean) barely helps — half the table still matches. Indexing is workload design: index what you search, cover what you read constantly, and pay the write tax only where reads earn it back.',
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization runs three versions of the same query -- "WHERE age = 41" -- against the same 8-row table. Use the dropdown to switch between them. In the no-index case, every age cell lights up as the engine compares it: the "compare" highlight means the row is being tested. The "visited" markers show rows already rejected. The "found" marker appears on the single match, but only after all 8 rows have been touched. Count the highlights: every row paid a comparison.',
        'In the indexed case, a second structure appears -- a sorted (age, pointer) list. The "visited" marker lands on the binary-search midpoint, and the "found" marker jumps straight to the target entry. One hop from the index entry to the table row fetches the full record. Total touches: 2-3 instead of 8. That ratio is the entire point.',
        'In the covering-index case, only the index is shown. Both the age and year columns of the matching index entry carry "found" markers. The table never appears because the engine never read it -- the answer was already sitting in the index leaf. When the animation does not show the table, that absence is the lesson.',
        {type: 'image', src: './assets/gifs/database-indexing.gif', alt: 'Animated walkthrough of the database indexing visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A database table is stored on disk in some physical order -- usually by primary key. MySQL InnoDB, Postgres, and SQLite all organize the table as a B-tree keyed on the primary key (called the clustered index). If you ask "WHERE id = 6", the engine walks that B-tree in O(log n) time and returns the row. The trouble starts when you query any column that is not the primary key.',
        'A database index is a separate, sorted data structure built on one or more non-primary-key columns. Each entry in the index holds (column value, pointer back to the original row). "Sorted" is the operative word: it means the engine can binary-search the index instead of scanning the entire table. CREATE INDEX ON users(age) tells the database to build a second B-tree keyed on age values, maintained automatically on every write.',
        { type: 'callout', text: 'An index is a paid second layout: it turns a query predicate into a short tree walk and charges every write for keeping that proof current.' },
        'The economics are stark. A 10-million-row table with no index on age forces the engine to read all 10 million rows for "WHERE age = 41". With an index, the same query touches roughly log2(10,000,000) = 23 index entries plus one table-row fetch. That is a million-to-one ratio in row touches. Every production database lives or dies by this ratio.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Keep the table as the only copy of the data. When a query arrives, scan every row and test the predicate against each one. This is called a full table scan (or sequential scan in Postgres). It is correct, simple, and requires zero extra storage. Writes are fast because inserting a row only updates one structure.',
        'For small tables this is fine. A 200-row config table scanned once a minute finishes in microseconds. The scan reads rows in physical order, which is friendly to disk prefetching and the OS page cache. There is no maintenance overhead -- no extra trees to split, merge, or rebalance. If the table fits in memory and queries are infrequent, a scan is the right plan.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The scan cost is proportional to the table size, not the result size. A query returning one row out of ten million still reads all ten million rows. As the table grows, the gap between "rows examined" and "rows returned" widens until the scan dominates total query time.',
        'Consider a web application with a users table of 5 million rows, serving 200 login requests per second. Each login runs "SELECT * FROM users WHERE email = ?". Without an index on email, each request scans 5 million rows. At 8 KB per page and 100 rows per page, that is 50,000 page reads per query -- 10 million page reads per second across all requests. The disk cannot keep up; the database stalls. The system needs a way to answer "which row has this email?" without reading the entire table.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'An index is a second copy of selected columns, stored in sorted order, with pointers back to the full rows. Sorted order transforms a linear scan into a tree descent: at each internal node, one comparison eliminates an entire subtree of keys that cannot match. The original data does not move; the index is a parallel proof structure that lets the engine skip the work the table layout cannot skip.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Bplustree.png/500px-Bplustree.png', alt: 'B plus tree with internal keys and linked leaf records', caption: 'A B+ tree makes the index layout visible: internal keys route the lookup, and leaves hold ordered values for scans. Source: https://en.wikipedia.org/wiki/B%2B_tree.' },
        'The deeper insight is that an index is not just a lookup accelerator -- it is a physical layout decision. A B+ tree index stores all actual values in its leaf nodes, linked together in key order. Internal nodes hold only separator keys that route searches downward. This separation means range scans never touch internal nodes: find the first matching leaf, then walk the linked leaf chain. B+ trees dominate databases over plain B-trees precisely because B-trees store data at every level, making range scans require full tree traversal. B+ trees confine data to leaves and link those leaves, so sequential access is as fast as reading a sorted file.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The mechanism has three layers: the B+ tree structure, the lookup procedure, and the covering-index optimization. Each one builds on the previous.',
        'A B+ tree is a balanced search tree where every value lives in a leaf node and internal nodes exist only to route searches. In a typical database page size of 8 KB, a single internal node can hold hundreds of separator keys and child pointers (the branching factor). Each leaf holds key-value pairs and a pointer to the next leaf. Because every root-to-leaf path has the same length, lookup cost is uniform for every key.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/B%2Btree_node_format.png/330px-B%2Btree_node_format.png', alt: 'B plus tree node format with keys and child pointers', caption: 'The node format shows why B+ trees have high fanout: one page can route many child ranges. Source: https://en.wikipedia.org/wiki/B%2B_tree.' },
        'Point lookup: to find age = 41, the engine reads the root node and compares 41 against its separator keys. This determines which child pointer to follow. At each subsequent level, one comparison eliminates all children on the wrong side. After log_b(n) levels (b = branching factor, n = total keys), the search lands on the correct leaf. With a branching factor of 200 and a million keys, that is ceil(log_200(1,000,000)) = 3 disk reads. A binary search tree storing one key per node would need log_2(1,000,000) = 20 disk reads for the same lookup.',
        'Range scan: the leaf chain is the feature that separates B+ trees from every other balanced tree. After finding the first leaf where age >= 30, the engine follows next-leaf pointers until age > 50. No backtracking, no re-traversal of internal nodes. The leaf chain turns a tree into a sorted linked list for sequential access.',
        'A composite index sorts on multiple columns in order. An index on (tenant_id, created_at) sorts first by tenant_id, then by created_at within each tenant. This makes "WHERE tenant_id = 7 AND created_at > \'2024-01-01\'" efficient: the equality prefix narrows the tree, then the range predicate walks the leaf chain. But "WHERE created_at > \'2024-01-01\'" alone cannot use this index well because created_at is not the leading key -- the B+ tree is not sorted by created_at globally.',
        'A covering index includes all columns a query needs in its leaf entries. For "SELECT year WHERE age = 41", an index on (age, year) stores both age and year in each leaf. The engine finds the matching leaf entry and returns the year value directly -- the table row is never fetched. This eliminates the random I/O cost of jumping from scattered index entries back to scattered table pages. The tradeoff: wider indexes consume more storage, more buffer-pool memory, and more write work on every INSERT and UPDATE.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on the B+ tree sorted-range invariant: for every internal node, all keys in the i-th subtree are strictly less than the i-th separator key, and all keys in the (i+1)-th subtree are greater than or equal to it. A search that follows the correct child pointer at each level is guaranteed to land on the leaf containing the target key, if it exists. No key can hide in a subtree the search skipped, because the separator truthfully partitions the key space.',
        'Insertions preserve the invariant by splitting. When a leaf exceeds its maximum key count, it splits into two leaves and pushes a copy of the middle key up to the parent as a new separator. If the parent overflows, it splits too, potentially cascading to the root. A root split creates a new root with two children, increasing tree height by exactly one. Because splits propagate upward and the tree grows from the top, all leaves remain at the same depth at all times. This guarantees O(log n) worst-case lookup regardless of insertion order -- no degenerate cases like an unbalanced BST.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/B%2B-tree-remove-61.png/250px-B%2B-tree-remove-61.png', alt: 'B plus tree deletion example showing leaf and parent updates', caption: 'Deletes preserve the same sorted range invariant by redistributing, merging, and updating separators. Source: https://en.wikipedia.org/wiki/B%2B_tree.' },
        'Deletions preserve balance by merging or redistributing keys between sibling leaves when a leaf underflows (drops below minimum occupancy). The parent separator is updated to reflect the new boundary. At every step, the invariant holds: separators truthfully describe the key range of each subtree below. This merge-or-redistribute rule is why B+ trees never become unbalanced -- unlike a plain BST, there is no sequence of operations that can make one path longer than another.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Point lookup on an indexed column costs O(log_b(n)) disk reads, where b is the branching factor (typically 100-500 for an 8 KB page) and n is the number of keys. For 10 million rows with b = 200, that is ceil(log_200(10,000,000)) = 4 disk reads. The same lookup without an index costs O(n/R) disk reads, where R is rows per page -- roughly 100,000 page reads. The index is 25,000 times cheaper.',
        'Range scans cost O(log_b(n)) to find the start key, then O(k/R) to walk k matching leaf entries across sequential pages. Because leaves are linked, this sequential walk benefits from disk prefetching and the OS page cache. A range query returning 500 rows from a 10-million-row table touches about 4 + 5 = 9 pages total, versus 100,000 pages for a full scan.',
        'Write amplification is the tax. Every INSERT or UPDATE must update the table plus every index defined on it. Two indexes means three B-tree writes per row change. Each B-tree write may cascade splits or merges. For a write-heavy workload (10,000 inserts/second on a table with 5 indexes), the database performs 60,000 B-tree operations per second instead of 10,000. This is why LSM-tree databases like Cassandra and RocksDB batch and defer index updates -- the write amplification of maintaining sorted B-trees on every write is the fundamental cost.',
        'Space overhead is typically 1-3x the indexed column size per index. An index on a 4-byte integer column over 10 million rows uses roughly 40-120 MB including internal nodes and page overhead. A covering index on (age, year, name) over the same table uses proportionally more. Each index also competes for space in the buffer pool (the in-memory page cache), so adding indexes can evict hot data pages and slow unrelated queries.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Every production relational database relies on indexes for acceptable query latency. Postgres EXPLAIN shows the plan the optimizer selected: "Index Scan" or "Index Only Scan" means the index is being used; "Seq Scan" means full table scan and is your signal to investigate. MySQL EXPLAIN shows "type: ref" for an index lookup and "type: ALL" for a full scan.',
        'In a real e-commerce system: the orders table has an index on (user_id) because "show me my orders" runs thousands of times per second. An index on (created_at) supports "orders placed today" dashboards. A covering index on (user_id, created_at, total) lets the "order history" page return results without touching the base table. Without the user_id index, every "my orders" query scans millions of rows to find the 30 belonging to that user.',
        'The query planner decides whether to use an index at all. It estimates selectivity from column statistics (histograms of value distribution), estimates how many table pages the index entries point to, and compares the total cost against a sequential scan. A sequential scan over a small table can be the best plan. An index scan that jumps randomly across a huge heap -- touching scattered pages for every matching row -- can be worse than reading the table once in order. This is why blindly adding indexes does not guarantee speedup.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Low-cardinality columns waste index space. An index on a boolean column (cardinality = 2) means half the rows match either value. The engine reads half the index, then fetches half the table pages -- barely better than a full scan, but the index still costs write amplification on every INSERT. Partial indexes (Postgres) or filtered indexes (SQL Server) can help by indexing only rows where the boolean is true, but the general rule holds: indexes earn their keep only on columns with many distinct values relative to table size.',
        'Too many indexes cripple writes. A table with 8 indexes means every INSERT updates 9 B-trees. Every UPDATE that touches an indexed column updates the old and new entries in that index. In write-heavy workloads (logging, event tracking, IoT telemetry), the write amplification can exceed the read benefit. The fix is measuring: run EXPLAIN on your actual queries, check pg_stat_user_indexes in Postgres to see which indexes are actually scanned, and drop the ones that are not earning their keep.',
        'Index maintenance is real operational work. B-tree pages fragment over time as inserts and deletes leave partially-filled pages. Postgres requires VACUUM to reclaim dead tuples from indexes and REINDEX to rebuild fragmented trees. MySQL InnoDB has online DDL for rebuilding indexes but the rebuild still costs I/O. Indexes are data structures with the same lifecycle costs as any other data structure -- allocation, fragmentation, and garbage collection.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a users table with 1,000,000 rows, stored in a clustered B+ tree keyed on id. Each disk page is 8 KB and holds about 100 rows. The table occupies 10,000 pages on disk.',
        'Query without index: "SELECT * FROM users WHERE email = \'alice@example.com\'". The engine reads all 10,000 pages, tests every row\'s email column. At 0.1 ms per random page read (SSD), that is 1,000 ms = 1 second. For a spinning disk at 5 ms per seek, it is 50 seconds. This is the full table scan.',
        'Now create an index: CREATE INDEX idx_email ON users(email). The database builds a B+ tree on email values. With a branching factor of 200, the tree height is ceil(log_200(1,000,000)) = 3 levels. A point lookup reads 3 index pages to find the leaf entry, then 1 table page to fetch the full row. Total: 4 page reads, or 0.4 ms on SSD. That is a 2,500x speedup over the scan.',
        'Now build a B+ tree from scratch with a small example. Order-4 tree (max 3 keys per leaf or internal node). Insert keys 10, 20, 30, 40, 50, 60, 70 in sequence. Insert 10, 20, 30: root leaf holds [10, 20, 30] -- full. Insert 40: leaf splits into [10, 20] and [30, 40]. Key 30 copies up to a new root: root = [30], two children, leaves linked [10, 20] -> [30, 40].',
        'Insert 50: goes right (50 > 30) to [30, 40], which becomes [30, 40, 50] -- full. Insert 60: right leaf splits into [30, 40] and [50, 60]. Key 50 copies up: root = [30, 50], three children. Leaves: [10, 20] -> [30, 40] -> [50, 60]. Insert 70: goes to rightmost leaf [50, 60], becomes [50, 60, 70]. Tree is two levels deep.',
        'Search for key 40: start at root [30, 50]. 30 <= 40 < 50, follow middle pointer to leaf [30, 40]. Find 40 in the leaf. Total: 2 node reads (1 internal + 1 leaf). Range query "WHERE key BETWEEN 20 AND 50": find leaf containing 20, which is [10, 20]. Follow next-leaf pointers: [10, 20] -> [30, 40] -> [50, 60]. Read three leaves sequentially. No internal nodes revisited. This sequential leaf walk is why B+ trees make range queries cheap.',
        'Write amplification example: the users table has indexes on (email), (age), and (created_at). One INSERT writes the clustered table B-tree plus three secondary index B-trees = 4 B-tree insertions per row. At 10,000 inserts/second, the database performs 40,000 B-tree insertions/second. If each insertion averages 2 page writes (the leaf plus occasionally a split), that is 80,000 page writes/second. Without any secondary indexes, it would be 20,000 page writes/second. Each index quadrupled the write load for that column.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'PostgreSQL EXPLAIN documentation shows how to read query plans and identify missing indexes: https://www.postgresql.org/docs/current/using-explain.html. The PostgreSQL multicolumn-index documentation explains why column order determines which queries an index can serve: https://www.postgresql.org/docs/current/indexes-multicolumn.html. MySQL\'s optimization guide covers index types and the optimizer\'s index selection logic: https://dev.mysql.com/doc/refman/8.0/en/optimization-indexes.html. SQLite\'s query planner guide shows the same principles in an embedded engine: https://www.sqlite.org/queryplanner.html.',
        'B-Trees (How Databases Read) covers the physical B-tree structure that indexes are built on. B+ Tree Leaf Sibling Scan Case Study shows why linked leaves make range scans and covering indexes practical. Binary Search explains the logarithmic search that happens inside each B+ tree node. Hash Tables offer an alternative for exact-match lookups (O(1) but cannot handle ranges or ordering). LSM Trees (How Cassandra Writes) shows a fundamentally different indexing strategy that batches writes to avoid B-tree write amplification. Write-Ahead Log (WAL) is the crash-recovery mechanism that protects index updates. SQL Join Algorithms Primer shows how indexes transform join performance. PostgreSQL Query Planner Case Study explains when the optimizer deliberately ignores an available index.',
      ],
    },
  ],
};
