// MySQL InnoDB clustered indexes: table rows live in the primary-key B-tree,
// while secondary indexes point back to primary keys.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'mysql-innodb-clustered-index-case-study',
  title: 'MySQL InnoDB Clustered Index Case Study',
  category: 'Systems',
  summary: 'InnoDB stores table rows inside the primary-key B-tree, making primary-key lookups direct and secondary lookups a two-step walk.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['clustered lookup', 'secondary lookup'], defaultValue: 'clustered lookup' },
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

function innodbShape(title) {
  return graphState({
    nodes: [
      { id: 'client', label: 'SQL', x: 0.7, y: 4.0, note: 'where id=42' },
      { id: 'root', label: 'PK root', x: 2.6, y: 4.0, note: 'B-tree page' },
      { id: 'branch1', label: '< 50', x: 4.5, y: 2.4, note: 'internal page' },
      { id: 'branch2', label: '>= 50', x: 4.5, y: 5.6, note: 'internal page' },
      { id: 'leaf1', label: 'leaf 1..49', x: 6.8, y: 2.4, note: 'rows inline' },
      { id: 'leaf2', label: 'leaf 50..99', x: 6.8, y: 5.6, note: 'rows inline' },
      { id: 'row', label: 'row id=42', x: 9.0, y: 2.4, note: 'all columns' },
      { id: 'buffer', label: 'buffer pool', x: 9.0, y: 5.6, note: 'cached pages' },
    ],
    edges: [
      { id: 'e-client-root', from: 'client', to: 'root', weight: 'lookup id' },
      { id: 'e-root-b1', from: 'root', to: 'branch1', weight: '< 50' },
      { id: 'e-root-b2', from: 'root', to: 'branch2', weight: '>= 50' },
      { id: 'e-b1-leaf1', from: 'branch1', to: 'leaf1', weight: 'page' },
      { id: 'e-b2-leaf2', from: 'branch2', to: 'leaf2', weight: 'page' },
      { id: 'e-leaf-row', from: 'leaf1', to: 'row', weight: 'record' },
      { id: 'e-leaf-buffer', from: 'leaf2', to: 'buffer', weight: 'cache' },
    ],
  }, { title });
}

function* clusteredLookup() {
  yield {
    state: innodbShape('The primary key is the table layout'),
    highlight: { active: ['client', 'root', 'branch1', 'leaf1', 'row'], found: ['row'], compare: ['buffer'] },
    explanation: 'InnoDB organizes each table around a clustered index. The leaf pages of the primary-key B-tree contain the row data itself, not just pointers to separate heap rows.',
    invariant: 'A primary-key lookup ends at a leaf page that contains the row.',
  };

  yield {
    state: labelMatrix(
      'Clustered leaf page',
      [
        { id: 'r40', label: 'id 40' },
        { id: 'r41', label: 'id 41' },
        { id: 'r42', label: 'id 42' },
        { id: 'r43', label: 'id 43' },
      ],
      [{ id: 'pk', label: 'primary key' }, { id: 'payload', label: 'row payload' }, { id: 'trx', label: 'MVCC metadata' }],
      [
        ['40', 'name,total,status', 'trx/roll pointer'],
        ['41', 'name,total,status', 'trx/roll pointer'],
        ['42', 'name,total,status', 'trx/roll pointer'],
        ['43', 'name,total,status', 'trx/roll pointer'],
      ],
    ),
    highlight: { found: ['r42:payload'], active: ['r42:pk', 'r42:trx'] },
    explanation: 'The clustered leaf stores the full row and InnoDB metadata. This is why primary-key lookups are direct, and why choosing a primary key affects physical locality.',
  };

  yield {
    state: labelMatrix(
      'Primary-key choice changes write shape',
      [
        { id: 'seq', label: 'sequential id' },
        { id: 'uuid', label: 'random UUID' },
        { id: 'natural', label: 'wide natural key' },
        { id: 'hidden', label: 'no explicit PK' },
      ],
      [{ id: 'page_behavior', label: 'page behavior' }, { id: 'risk', label: 'risk' }],
      [
        ['append-friendly', 'hot right edge'],
        ['random page touches', 'splits and cache churn'],
        ['large secondary entries', 'more index bytes'],
        ['internal row id', 'less explicit control'],
      ],
    ),
    highlight: { active: ['seq:page_behavior', 'uuid:page_behavior'], compare: ['natural:risk'] },
    explanation: 'Because the primary key is physically embedded in every secondary index entry, a wide or random primary key has consequences beyond one index. It affects page splits, cache locality, and secondary-index size.',
  };

  yield {
    state: labelMatrix(
      'Where the concept links',
      [
        { id: 'btree', label: 'B-tree' },
        { id: 'buffer', label: 'buffer pool' },
        { id: 'wal', label: 'redo log' },
        { id: 'mvcc', label: 'MVCC' },
      ],
      [{ id: 'role', label: 'role' }, { id: 'topic', label: 'study link' }],
      [
        ['ordered page search', 'B-Trees'],
        ['cache hot pages', 'Database Indexing'],
        ['durable page changes', 'Write-Ahead Log'],
        ['consistent reads', 'MVCC & Vacuum'],
      ],
    ),
    highlight: { found: ['btree:topic', 'wal:topic', 'mvcc:topic'] },
    explanation: 'InnoDB is a concrete storage-engine composition. The clustered index is the visible shape, but durability, caching, and transaction visibility all cooperate with it.',
  };
}

function* secondaryLookup() {
  yield {
    state: labelMatrix(
      'Secondary index on email',
      [
        { id: 's1', label: 'a@example' },
        { id: 's2', label: 'm@example' },
        { id: 's3', label: 'z@example' },
      ],
      [{ id: 'secondary_key', label: 'secondary key' }, { id: 'stored_value', label: 'stored value' }],
      [
        ['a@example.com', 'primary key 17'],
        ['m@example.com', 'primary key 42'],
        ['z@example.com', 'primary key 88'],
      ],
    ),
    highlight: { active: ['s2:secondary_key'], found: ['s2:stored_value'] },
    explanation: 'A secondary index leaf does not store a heap pointer. It stores the secondary key and the clustered primary key. If the query needs columns not covered by the secondary index, InnoDB performs a second lookup in the clustered index.',
    invariant: 'Secondary lookup often means secondary B-tree first, primary B-tree second.',
  };

  yield {
    state: innodbShape('Back to the clustered index by primary key'),
    highlight: { active: ['client', 'root', 'branch1', 'leaf1', 'row', 'e-client-root', 'e-root-b1', 'e-b1-leaf1'], found: ['row'] },
    explanation: 'After the email index returns id=42, the engine walks the primary-key tree to fetch the full row. This is why covering indexes matter: if all needed columns are already in the secondary index, the second walk can be skipped.',
  };

  yield {
    state: labelMatrix(
      'Case study: user lookup API',
      [
        { id: 'pk', label: 'GET /users/42' },
        { id: 'email', label: 'GET /users?email=m' },
        { id: 'cover', label: 'email + status only' },
        { id: 'range', label: 'created_at range' },
      ],
      [{ id: 'access', label: 'access path' }, { id: 'cost_signal', label: 'cost signal' }],
      [
        ['clustered PK', 'one B-tree walk'],
        ['secondary then PK', 'two B-tree walks'],
        ['covering secondary', 'no row fetch'],
        ['secondary range + many PK fetches', 'possible random I/O'],
      ],
    ),
    highlight: { found: ['pk:cost_signal', 'cover:access'], compare: ['range:cost_signal'] },
    explanation: 'The same API can have very different storage behavior. Query shape decides whether the clustered index is a direct hit, a second hop, or a repeated random lookup after a secondary range scan.',
  };

  yield {
    state: labelMatrix(
      'Design checklist',
      [
        { id: 'pk', label: 'primary key' },
        { id: 'secondary', label: 'secondary indexes' },
        { id: 'covering', label: 'covering indexes' },
        { id: 'explain', label: 'EXPLAIN' },
      ],
      [{ id: 'question', label: 'question' }, { id: 'why', label: 'why it matters' }],
      [
        ['is it narrow and stable?', 'stored in secondary leaves'],
        ['do they match predicates?', 'avoid scans'],
        ['can they satisfy query?', 'avoid PK hop'],
        ['what plan was chosen?', 'verify assumptions'],
      ],
    ),
    highlight: { active: ['pk:why', 'covering:why'], found: ['explain:question'] },
    explanation: 'The full case study ends with measurement. The clustered-index model predicts cost, but EXPLAIN and runtime counters tell you whether the optimizer and data distribution agree.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'clustered lookup') yield* clusteredLookup();
  else if (view === 'secondary lookup') yield* secondaryLookup();
  else throw new InputError('Pick an InnoDB clustered-index view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        `InnoDB is MySQL's default transactional storage engine, and its central storage choice is easy to miss: the table is organized around a clustered index. In ordinary MySQL schemas that clustered index is the primary key. The leaf pages of that B+ tree contain the row data itself, not just pointers to rows stored somewhere else.`,
        `That makes the primary key more than a logical identifier. It is the physical order of the table, the path for direct row lookup, the unit of locality in the buffer pool, the key carried by secondary indexes, and a major influence on insert behavior. A schema designer who treats the primary key as only an application ID is ignoring the storage layout.`,
        {type:'callout', text:`InnoDB makes the primary key a storage layout: the clustered B+ tree leaf is the row, so every secondary access inherits that physical choice.`},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/3/37/Bplustree.png', alt:'Diagram of a B+ tree with internal keys and linked leaf nodes.', caption:'A B+ tree stores search keys in internal nodes and data entries in linked leaves, the shape InnoDB uses for clustered and secondary indexes. Source: Wikimedia Commons, Grundprinzip, CC BY 3.0'},
      ],
    },
    {
      heading: 'The obvious model',
      paragraphs: [
        `A common first model says a table is a heap of rows and every index points to a row location in that heap. Some engines and storage layouts are close to that model. It is easy to teach: rows live in one place, indexes are lookup structures, and an index leaf stores a row pointer.`,
        `InnoDB does not use that model for normal tables. The clustered primary-key B+ tree is where the rows live. A primary-key lookup descends the clustered tree and lands on a leaf record containing the full row and MVCC metadata. A secondary index leaf stores the secondary key plus the primary key of the row, not a stable heap pointer.`,
      ],
    },
    {
      heading: 'Why the model fails',
      paragraphs: [
        `The heap mental model hides the cost of secondary lookups. If a query uses an index on email and needs the whole row, InnoDB first searches the email index, obtains the primary key, and then searches the clustered index. That is two B+ tree walks unless the secondary index covers the query.`,
        `The model also hides how primary-key choice spreads through the system. A wide natural key is copied into every secondary index entry. A random key changes insert locality and page split behavior. A missing explicit primary key gives InnoDB less application guidance and can leave the table organized by a key the schema designer did not really choose.`,
      ],
    },
    {
      heading: 'The core mechanism',
      paragraphs: [
        `InnoDB stores table records in clustered index leaf pages. Internal pages guide the search by key ranges. Leaf pages contain ordered records, row payload columns, and transaction metadata such as MVCC information needed for consistent reads. The structure is usually described as a B+ tree because records live in leaves and leaves are linked for ordered scans.`,
        `A primary-key lookup is therefore direct in storage-engine terms. The engine walks from root to internal page to leaf page and finds the row there. A range scan over the primary key can continue through neighboring leaf pages in order. This is why clustering key locality matters: rows close in primary-key order can be close in page order.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `Clustered storage collapses row storage and primary-key indexing into one structure. The primary-key leaf is not a pointer to the row; it is where the row is stored. Secondary indexes are separate B+ trees whose leaves contain secondary key columns and the clustered primary key needed to find the row.`,
        `That single fact explains many InnoDB performance surprises. A direct lookup by primary key is one tree walk. A non-covering secondary lookup is a secondary-tree walk followed by a clustered-tree walk. A secondary range scan that matches many rows may cause many scattered clustered lookups. A covering secondary index can avoid that second walk because the needed columns are already in the secondary leaf.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The clustered index works because it makes the primary-key order and the physical row layout the same structure. A primary-key lookup does not first find a pointer and then chase a separate heap tuple. The B+ tree descent lands at the leaf page that contains the row itself, so the search path is also the row access path.',
        'Secondary indexes work because their leaves store the indexed key plus the primary key. That keeps each secondary index independent of physical page addresses that can change during splits, movement, or maintenance. The cost is the second lookup: a secondary index often finds the primary key first, then follows it through the clustered index to the full row.',
      ],
    },
    {
      heading: 'What the views show',
      paragraphs: [
        `The clustered-lookup view follows a query such as WHERE id = 42. The search descends the primary-key tree and ends at a leaf page containing the row payload. The buffer pool matters because each page on that path may already be cached or may require I/O.`,
        `The secondary-lookup view follows a query such as WHERE email = 'm@example.com'. The secondary index finds email -> id 42. If the query asks for columns not stored in the secondary index, the engine uses id 42 to descend the clustered tree. The extra hop is the main cost model this case study is trying to make visible.`,
      ],
    },
    {
      heading: 'Primary key design',
      paragraphs: [
        `A good InnoDB primary key is usually narrow, stable, and chosen with access patterns in mind. Narrow matters because the primary key is stored in secondary index leaves. Stable matters because changing a primary key means moving the row in the clustered tree and updating secondary references. Access pattern matters because primary-key order drives physical locality.`,
        `Sequential integer keys are append-friendly, though they can create a hot right edge under high write concurrency. Random UUIDs spread inserts across the tree, which can increase page splits, cache churn, and write amplification. Wide natural keys can be useful for business meaning but expensive when copied into every secondary index. There is no universal key, but there is always a storage consequence.`,
      ],
    },
    {
      heading: 'Secondary indexes',
      paragraphs: [
        `A secondary index in InnoDB is still a B+ tree, but its leaf payload is different from the clustered tree. The leaf stores the indexed columns and the primary key. This design avoids storing physical row addresses that would become unstable as pages split and rows move.`,
        `The cost is indirection. If the secondary index does not cover the query, the primary key from the secondary leaf becomes a lookup key into the clustered tree. This is why a secondary index can be excellent for filtering and still expensive for fetching. The index narrows the candidate set, but row retrieval may dominate if many candidates are scattered across clustered pages.`,
      ],
    },
    {
      heading: 'Covering indexes',
      paragraphs: [
        `A covering index is a secondary index that contains every column needed by a query. In MySQL EXPLAIN output, this often appears as Using index. The storage-engine win is direct: if the answer can be produced from the secondary leaf, InnoDB does not need to perform the clustered lookup.`,
        `Covering should be used deliberately. Adding every column to an index makes writes heavier and consumes memory. The right target is a hot query with a narrow projection, a selective predicate, and a stable access pattern. A covering index for email and status can be excellent for an authentication or account-state check; a huge covering index for an occasional dashboard may not be worth the write cost.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Consider a user table with primary key id and a secondary index on email. GET /users/42 is a clustered lookup. The engine walks the primary-key tree and lands on the leaf record for id 42. If the needed pages are in the buffer pool, this is mostly CPU and latch work. If they are not cached, page reads dominate.`,
        `GET /users?email=m@example.com is different. The email index returns id 42. If the endpoint needs the full profile, InnoDB then walks the clustered tree to fetch the row. If the endpoint only needs email and status, an index on email, status can cover the query and avoid the second walk. A small API change can therefore change the storage path from one tree walk to two tree walks or back to one covering read.`,
      ],
    },
    {
      heading: 'Write-path consequences',
      paragraphs: [
        `Clustered indexes affect writes because inserting a row means placing it into primary-key order. Append-like keys tend to touch a small moving area of the tree. Random keys touch many pages. Page splits, redo logging, undo records, change buffering for some secondary index work, and buffer-pool pressure all depend on how keys arrive.`,
        `Secondary indexes also pay for every insert, delete, and relevant update. Because each secondary entry contains the primary key, changing a primary key is especially expensive. It is usually better to keep the clustered key stable and use separate public identifiers when API design requires non-sequential or opaque IDs.`,
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        `Use EXPLAIN and runtime counters to check the model. The clustered-index theory predicts possible costs, but the optimizer chooses plans based on statistics, selectivity, and available indexes. Look for whether a query is using the primary key, a secondary index, a covering index, or a secondary range scan with many row fetches.`,
        `Watch index size, buffer-pool hit rate, page split behavior, rows examined, and query latency under real data distribution. A schema that works on a small development table can change shape when secondary indexes no longer fit in memory or when a range scan fetches thousands of scattered clustered records.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `The most common failure is choosing a primary key without understanding that it is the table layout. Very wide natural keys enlarge every secondary index. Random clustered keys can make writes and caching worse. Mutable keys force row movement. Missing primary keys give InnoDB less explicit guidance.`,
        `Query-level failures include assuming every index lookup is one hop, ignoring covering opportunities for hot paths, adding too many overlapping indexes, and reading EXPLAIN too casually. A secondary index can make a predicate fast while still leaving row retrieval expensive. The question is not only which index filters the rows, but whether the query can finish at that index.`,
      ],
    },
    {
      heading: 'Where it matters',
      paragraphs: [
        `Clustered indexing matters most in OLTP systems with frequent primary-key lookups, secondary lookups, range scans, and write-heavy workloads. It shapes user tables, order tables, event ledgers, job queues, financial records, and any system where page locality and index size control latency.`,
        `It is also a useful comparison point across storage engines. PostgreSQL heap tables, LSM-tree engines, column stores, and document stores make different tradeoffs about row location, secondary references, and write amplification. InnoDB's clustered index is one concrete answer to the general question: where does the row live?`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Sources: MySQL InnoDB clustered and secondary index documentation at https://dev.mysql.com/doc/refman/8.0/en/innodb-index-types.html and InnoDB physical index structure at https://dev.mysql.com/doc/refman/8.0/en/innodb-physical-structure.html.`,
        `Study B-Trees, B+ Tree Leaf Sibling Scan Case Study, Database Indexing, PostgreSQL Buffer Pool Clock Sweep, Write-Ahead Log, MVCC & Vacuum, LSM Tree, RocksDB LSM Case Study, and MySQL InnoDB Change Buffer next. The useful comparison question is always the same: what does the index leaf store, and how does the engine reach the row?`,
      ],
    },
  ],
};
