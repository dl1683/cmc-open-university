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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the B+ tree as both an index and a storage layout. In a B+ tree, internal pages route searches by key range, and leaf pages hold the ordered records used for lookup and range scans.',
        'The active path is a page descent from root to leaf. A safe inference is that a primary-key lookup reaches the row at the clustered leaf, while a non-covering secondary lookup must do a second descent through the primary key.',
        {type:'callout', text:`InnoDB makes the primary key a storage layout: the clustered B+ tree leaf is the row, so every secondary access inherits that physical choice.`},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/3/37/Bplustree.png', alt:'Diagram of a B+ tree with internal keys and linked leaf nodes.', caption:'A B+ tree stores search keys in internal nodes and data entries in linked leaves, the shape InnoDB uses for clustered and secondary indexes. Source: Wikimedia Commons, Grundprinzip, CC BY 3.0'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A transactional database needs a stable way to find rows, scan ranges, cache pages, and update records while many sessions run. InnoDB, the default MySQL storage engine, solves that by organizing normal tables around a clustered index.',
        'Clustered means the table rows are stored in primary-key order inside the primary-key B+ tree. The primary key is therefore not just an application identifier; it is the physical path to the row.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious mental model is a heap table plus separate indexes. Rows live in one pile, and each index leaf stores a pointer to the row location.',
        'That model is easy to teach because it separates data from lookup structures. Some engines are close to it, so the mistake is reasonable when a learner first meets MySQL indexes.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The heap model hides the second hop in InnoDB. A secondary index leaf stores the secondary key and the primary key, so fetching columns outside that secondary index requires a lookup in the clustered tree.',
        'It also hides primary-key design cost. A wide primary key is copied into secondary index leaves, and a random primary key can scatter inserts across pages.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that the primary-key index and the row store are one structure. A primary-key leaf does not point at the row; it contains the row fields and transactional metadata.',
        'Secondary indexes are separate B+ trees that use the primary key as the row locator. This keeps secondary entries stable across page splits, but it makes the primary key part of every secondary access.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A lookup by primary key descends the clustered B+ tree from root to internal page to leaf page. If the leaf page is cached in the buffer pool, the lookup is mostly CPU and latch work; if not, storage I/O dominates.',
        'A lookup by secondary key first descends the secondary tree. If the query needs columns not present in that secondary leaf, InnoDB uses the stored primary key to descend the clustered tree and fetch the row.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from sorted key ranges and durable page records. Each internal page routes the search to the child range that can contain the key, and each leaf contains ordered records for that range.',
        'Secondary lookup correctness depends on the primary key stored in the secondary leaf. If the secondary entry says email maps to id 42, then the clustered tree is the authoritative place to verify and read row 42.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A primary-key point lookup costs one B+ tree descent, usually O(log n) page steps with a high branching factor. If a tree with branching factor 200 holds 8,000,000 rows, the search may need about four page levels, not millions of comparisons.',
        'A non-covering secondary lookup costs two descents. Cost becomes visible when 10,000 secondary matches cause 10,000 clustered lookups that jump across many pages instead of reading a tight range.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Clustered indexing fits OLTP tables with frequent primary-key lookups, ordered ranges, and hot rows that benefit from buffer-pool locality. User records, orders, ledger entries, job queues, and account state often depend on this path.',
        'It also gives schema reviews a concrete question. The reviewer should ask what the primary-key order does to reads, writes, secondary index size, and range scans.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the primary key is wide, mutable, or random without a reason. Wide keys enlarge secondary indexes, mutable keys force row movement, and random keys can increase page splits and cache churn.',
        'It also fails as a universal lookup story. A covering secondary index can be faster for a narrow query, and an LSM engine or column store may be better for write-heavy ingestion or analytics.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose users has primary key id and a secondary index on email. Querying id 42 is one clustered descent: root, internal page, leaf page, then row 42.',
        'Querying email m@example.com and selecting name, status, and created_at first finds id 42 in the email index, then fetches row 42 from the clustered index. If the email index also contains status and the query only asks for email and status, the query can finish at the secondary leaf and skip the second descent.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MySQL clustered and secondary index documentation at https://dev.mysql.com/doc/refman/8.4/en/innodb-index-types.html and InnoDB physical index structure at https://dev.mysql.com/doc/refman/8.4/en/innodb-physical-structure.html.',
        'Study B-Trees, B+ Tree Leaf Sibling Scan Case Study, Database Indexing, MVCC and Vacuum, Write-Ahead Log, LSM Tree, and MySQL InnoDB Change Buffer next. The comparison question is what each engine stores in an index leaf.',
      ],
    },
  ],
};
