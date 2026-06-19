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
        'The animation runs three versions of the same query against the same 8-row table. In the no-index case, highlighted cells show the full scan: every age value is compared, one by one. The visited markers show rows already checked and rejected. The found marker shows the single matching row, reached only after touching everything.',
        'In the indexed case, the second B-tree appears: a sorted list of (age, pointer) entries. The visited marker shows the binary-search midpoint the engine checked first. The found marker lands directly on the target entry, then one hop fetches the full row from the table. Count the touches: 2-3 versus 8.',
        'In the covering-index case, only the index is shown because the table is never read. The found markers on both the age and year columns of the index entry mean the answer was already present in the leaf. No table fetch happened at all.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `A database index is a separate, sorted copy of one or more columns with pointers back to the original rows. Think of a book's index: instead of reading every page to find "algorithms", you look up "algorithms" in the index, which tells you page numbers to jump to. A table itself is already sorted by its primary key — MySQL InnoDB, Postgres, and SQLite all store the clustered index, where the table IS the primary-key B-tree. Secondary indexes (what you create with CREATE INDEX) are additional B-trees you build on other columns: (age, pointer-to-row), (name, pointer-to-row), etc.`,
        `Indexes exist because queries on unsorted columns require a full table scan: checking every row's value. At scale (millions of rows), this means pulling a million rows off disk to answer one lookup. An index shrinks that work: a binary search in the sorted index (~20 touches at a million rows) plus one jump to fetch the full row, versus a million touches for the scan.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The obvious approach is to keep the table as the only copy of the data and scan it whenever a predicate appears. That is correct, simple, and often fine for tiny tables. It also preserves one write path: inserting a row only updates the table itself.',
        'The wall arrives when the query is selective and the table is large. If one user lookup, order lookup, or date range asks the engine to examine every row, the system spends most of its time proving that rows are not relevant. An index is the escape hatch: pay extra storage and write work so reads can start from an ordered proof structure instead of from ignorance.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The visual compares three versions of the same query. In the scan case, every row is a candidate until the predicate rejects it. This is not the database being foolish; it simply has no narrower proof. In the indexed case, the search begins in a sorted key structure, so most rows are never candidates at all. In the covering-index case, the answer is already present in the index leaf, so the engine does not need to visit the table heap or clustered row.',
        'That last jump is the lesson beginners often miss. An index is not just a fast lookup. It is a physical layout decision. Column order, selected columns, sort direction, cardinality, and table fetch cost decide whether an index is only a filter, a range-scan accelerator, an ordering mechanism, or a complete answer store for a narrow query.',
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        `When you query "WHERE age = 41" on an unindexed column, the database has no choice: scan the whole table, test every row's age, return matches. This is O(n). When you CREATE INDEX ON users(age), the database builds a B-tree keyed on age values: (23 → row6), (29 → row2), (31 → row8), … sorted. Now the same query becomes a B-tree descent (binary search): O(log n). For a million rows, the scan is 1,000,000 page touches; the index is 20 touches — a 50,000x speedup.`,
        `A refinement: if your query is "SELECT year WHERE age = 41", you can build a covering index (age, year). The answer lives in the index leaf itself; the table is never touched. This is why SELECT * is expensive — it forces the database to fetch every column, which cannot be covered by a narrow index. Naming your columns lets the database answer more queries from smaller indexes alone.`,
        `The cost arrives at write time. Every INSERT or UPDATE now touches three B-trees: the table, the age index, and the year index. One write triggers multiple tree updates across disk — write amplification. This is why LSM Trees (How Cassandra Writes) batches writes: scanning the index penalty is so high that amortizing it across many writes makes sense.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `Reads are cheap but writes are expensive. A query on an indexed column drops from O(n) to O(log n) — at a million rows, from 1,000,000 touches to 20. An unindexed query on a low-cardinality column (e.g., status: true/false) still barely helps — half the table matches, so you read half a million rows anyway. An index only earns back its write cost if you query it far more than you write. Design indexes for your workload: high-cardinality columns you filter on constantly, covering indexes for queries you run thousands of times per second.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Every production database relies on indexing. Postgres EXPLAIN shows which indexes a query used (or didn't: "Seq Scan" means full table scan, your cue to add an index). MySQL InnoDB automatically indexes the primary key; you add secondary indexes manually. SQLite's EXPLAIN QUERY PLAN reveals the search strategy. In a real e-commerce system: user IDs are indexed (you query by user constantly), order dates are indexed (range queries: "orders in June"), product names are indexed (autocomplete). Without indexes, a query like "find all orders by user 12345" would scan millions of rows. With an index on user_id, it jumps straight to the 50 rows belonging to that user.`,
        `The EXPLAIN diagnostic is your first tool for slow queries. Postgres and MySQL both show the query plan: if it says "Seq Scan" or "Full Table Scan", add an index. If it already uses an index but is still slow, investigate write amplification (too many indexes) or cardinality (index doesn't narrow the search enough).`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `One myth: "add an index and queries get faster." Indexes help only on high-cardinality filters (columns with many distinct values). An index on a boolean or status field (cardinality = 2) barely helps because half the rows match anyway. Another myth: "use SELECT *." This forces the database to fetch every column from the table, preventing covering indexes. Name your columns and let the database stay in a smaller index if possible.`,
        `The biggest pitfall is indexing without measuring. Add too many indexes and writes slow down (write amplification strikes); queries might still scan because the optimizer chose a cheaper full scan. Always run EXPLAIN first, measure before and after, and delete indexes that don't earn back their write cost. Finally, indexes are data structures too: they grow, they fragment, they need maintenance (REINDEX, VACUUM in Postgres). They are not free intelligence — they are a workload trade-off.`,
      ],
    },
    {
      heading: 'How planners decide',
      paragraphs: [
        'A planner does not ask whether an index exists. It asks whether using that index is cheaper than the alternatives. It estimates selectivity from statistics, estimates how many table pages must be fetched, checks whether the index order can satisfy ORDER BY, and checks whether the requested columns can be returned from the index alone. A sequential scan over a small table can be the best plan. An index scan that jumps randomly across a huge heap can be worse than reading the table once in order.',
        'Composite indexes make this concrete. An index on (tenant_id, created_at) is ideal for one tenant over a time range because the equality prefix narrows the tree before the range scan begins. The same index is weak for all tenants over one date range because created_at is not the leading key. This is why index design starts from repeated query shapes, not from a list of columns that feel important.',
      ],
    },
    {
      heading: 'Sources and engine details',
      paragraphs: [
        `PostgreSQL's planner documentation is the right companion for this topic: EXPLAIN shows the query plan the planner selected, and PostgreSQL emphasizes that choosing the plan matching query structure and data properties is critical: https://www.postgresql.org/docs/current/using-explain.html. The PostgreSQL multicolumn-index documentation explains why column order and access method matter, especially for B-tree indexes: https://www.postgresql.org/docs/current/indexes-multicolumn.html.`,
        `MySQL's optimization guide describes indexes as a main way to improve SELECT operations on columns used in query conditions, with index entries acting as pointers to rows: https://dev.mysql.com/doc/refman/8.0/en/optimization-indexes.html. SQLite's query planner guide and EXPLAIN QUERY PLAN reference show the same lesson in an embedded engine: planners choose between scans and index searches based on available indexes, predicates, ordering, and estimated cost: https://www.sqlite.org/queryplanner.html and https://sqlite.org/eqp.html.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `SQL Join Algorithms Primer shows why an index can turn a nested-loop join from a disaster into the right plan. PostgreSQL Query Planner Case Study explains why the optimizer may still ignore an index when estimated cost is higher.`,
        `Indexes are B-Trees in action — explore B-Trees (How Databases Read) to understand the physical structure, then B+ Tree Leaf Sibling Scan Case Study to see why linked leaves make range scans and covering indexes practical. PostgreSQL HOT Update Heap-Only Tuple shows when an update can avoid redundant secondary-index entries. Binary Search is how the index finds a key in logarithmic time. Hash Tables offer an alternative for exact-match lookups (fast but cannot handle ranges; indexes can). Bw-Tree Delta Chain & Mapping Table shows how a B+ tree can trade page latches for CAS, delta replay, consolidation, and epoch reclamation. LSM Trees (How Cassandra Writes) are an entirely different approach to indexing that batches writes and amortizes the write amplification cost. Write-Ahead Log (WAL) is the consistency mechanism that protects your indexes during crashes.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first instinct is to keep the table as the only copy of the data and scan it for every query. This is correct, simple, and honest: no extra storage, no write overhead, no stale structures to maintain. For a 200-row config table queried once a minute, a full scan finishes in microseconds and an index would be pointless overhead.',
        'The approach works until the table grows and the queries get selective. A query asking for one user out of ten million still reads all ten million rows. The scan cost is proportional to table size, not result size. Once the ratio between rows examined and rows returned becomes large enough, the scan dominates total query time, and the system has no way to improve it without a structural change to how data is accessed.',
      ],
    },

    {
      heading: 'The core insight',
      paragraphs: [
        'An index is a second copy of selected columns, stored in sorted order, with pointers back to the full rows. Sorted order turns a linear scan into a tree descent: one comparison at each level eliminates an entire subtree of non-matching keys. The data itself does not move; the index is a parallel proof structure that lets the engine skip work the table layout cannot skip.',
        'The deeper insight is that indexes are not just about lookup speed. They are physical layout decisions. A B+ tree index stores all actual values in its leaves, linked together in key order. Internal nodes hold only separator keys that route searches downward. This separation means range scans never touch internal nodes at all: find the first matching leaf, then walk the linked leaf chain. This is why B+ trees dominate databases while plain B-trees do not: B-trees store data at every level, so a range scan must traverse the entire tree structure. B+ trees confine data to leaves and link those leaves, making sequential access as fast as reading a sorted file.',
      ],
    },

    {
      heading: 'B+ tree structure: why databases chose it',
      paragraphs: [
        'A B+ tree is a balanced search tree where every value lives in a leaf node, and internal nodes exist only to route searches. In an order-4 B+ tree, each internal node holds up to 3 keys and 4 child pointers; each leaf holds up to 3 key-value pairs and a pointer to the next leaf. The root-to-leaf path length is identical for every key, so lookup cost is uniform.',
        'Internal nodes are a search index over the leaves. When searching for key 41, the engine reads the root, compares 41 against the separator keys, and follows the appropriate child pointer. At each level, one comparison eliminates all children on the wrong side. After log_b(n) levels (where b is the branching factor), the search lands on the correct leaf. The leaf contains the actual value (or a pointer to the table row).',
        'The leaf chain is the feature that separates B+ trees from B-trees. In a B-tree, data lives at every level, so a range query like "WHERE age BETWEEN 30 AND 50" must traverse internal nodes, descend to children, ascend back, and continue. In a B+ tree, the engine finds the first leaf where age >= 30, then walks the next-leaf pointers until age > 50. No backtracking, no re-traversal. The leaf chain turns a tree into a sorted linked list for range access.',
        'Disk alignment is the other reason. A B+ tree node is sized to match a disk page (typically 4 KB or 8 KB). One disk read loads an entire node with hundreds of keys. A binary search tree, by contrast, stores one key per node and requires one disk read per comparison. For a million keys, a BST needs ~20 disk reads (one per level); a B+ tree with a branching factor of 200 needs ~3 disk reads (log_200 of 1,000,000). Disk reads cost milliseconds; CPU comparisons cost nanoseconds. The wide node amortizes disk latency across hundreds of comparisons per read.',
      ],
    },

    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on the B+ tree invariant: for every internal node, all keys in the i-th subtree are strictly less than the i-th separator key, and all keys in the (i+1)-th subtree are greater than or equal to it. This ordering guarantee means a search that follows the correct child pointer at each level will always land on the leaf that contains the target key if it exists. No key can hide in a subtree the search skipped.',
        'Insertions preserve the invariant by splitting: when a leaf overflows (exceeds its maximum key count), it splits into two leaves and pushes a copy of the middle key up to the parent as a new separator. If the parent overflows, it splits too, potentially all the way to the root. A root split creates a new root with two children, increasing tree height by one. Since splits propagate upward and the tree grows from the top, all leaves remain at the same depth. This guarantees O(log n) worst-case lookup regardless of insertion order.',
        'Deletions merge or redistribute keys between siblings when a leaf underflows. The parent separator key is updated to reflect the new boundary. The invariant is preserved at every step: the separator always truthfully describes the key range of each subtree below it.',
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        'Build an order-4 B+ tree (max 3 keys per node) by inserting keys 10, 20, 30, 40, 50, 60, 70 in sequence.',
        'Insert 10, 20, 30: the root leaf holds [10, 20, 30]. It is full. Insert 40: the leaf splits. Left leaf gets [10, 20], right leaf gets [30, 40]. The key 30 is copied up to a new root: [30]. The root has two children. The leaves are linked: [10, 20] -> [30, 40].',
        'Insert 50: 50 > 30, so go right to [30, 40]. It becomes [30, 40, 50]. Full. Insert 60: the right leaf splits. Left half [30, 40], right half [50, 60]. Copy 50 up to root: root becomes [30, 50] with three children. Leaves: [10, 20] -> [30, 40] -> [50, 60].',
        'Insert 70: 70 > 50, go to rightmost leaf [50, 60]. It becomes [50, 60, 70]. Still room in the root for another split if needed. The tree is now two levels deep. A search for key 40: start at root [30, 50]. 40 >= 30 and 40 < 50, follow the middle pointer to leaf [30, 40]. Scan the leaf, find 40. Total: 2 node reads.',
        'A range query "WHERE key BETWEEN 20 AND 50": find the leaf containing 20 ([10, 20]), then follow next-leaf pointers: [10, 20] -> [30, 40] -> [50, 60]. Read three leaves sequentially. No internal nodes are revisited. This is why B+ trees make range queries cheap: the leaf chain provides sorted sequential access.',
      ],
    },

    {
      heading: 'Covering indexes and composite indexes',
      paragraphs: [
        'A composite index is an index on multiple columns in a specified order, such as (tenant_id, created_at, amount). The B+ tree sorts first by tenant_id, then by created_at within each tenant, then by amount within each (tenant_id, created_at) pair. This makes the index useful for queries that filter on a prefix of the column list: WHERE tenant_id = 7 uses the first column. WHERE tenant_id = 7 AND created_at > "2024-01-01" uses the first two. WHERE created_at > "2024-01-01" alone cannot use this index efficiently because created_at is not the leading key; the B+ tree is not sorted by created_at globally.',
        'A covering index includes all columns a query needs, so the engine never fetches the base table row. For "SELECT amount WHERE tenant_id = 7 AND created_at > \'2024-06-01\'", an index on (tenant_id, created_at, amount) covers the query completely: the leaf entries contain tenant_id, created_at, and amount. The engine walks the leaf chain and returns results without a single table lookup. This eliminates the random I/O cost of jumping from index entries back to scattered table pages.',
        'The tradeoff is width. A covering index that includes many columns is large, slow to update, and consumes more memory in the buffer pool. A narrow index on (tenant_id) is small and fast to maintain but forces a table fetch for every matching row. Index design is a workload negotiation: which queries run often enough to justify the storage and write cost of wider indexes.',
      ],
    },

    {
      heading: 'B+ tree vs B-tree: why leaves matter',
      paragraphs: [
        'In a B-tree, every node (internal and leaf) stores key-value pairs. A search can terminate at any level if it finds the key in an internal node. This sounds like an advantage, but it has two costs. First, internal nodes are wider because they hold values alongside keys, so fewer keys fit per node, which increases tree height and disk reads. Second, range scans are expensive: after finding the start key, the traversal must perform an in-order walk of the entire tree, visiting internal nodes and descending into children repeatedly.',
        'A B+ tree separates concerns. Internal nodes hold only keys and child pointers, maximizing the branching factor per node. All values live in leaves, and leaves are linked. A range scan finds the first leaf and follows pointers. The result is fewer disk reads for point lookups (wider nodes mean shorter trees) and dramatically faster range scans (sequential leaf access versus tree traversal). This is why every major relational database (Postgres, MySQL InnoDB, SQL Server, Oracle, SQLite) uses B+ trees for its indexes, not B-trees.',
      ],
    },
],
};

