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
    { heading: 'What it is', paragraphs: [
      'InnoDB, MySQL\'s default transactional storage engine, stores each table around a clustered index. The clustered index is usually the primary key, and its leaf pages contain the row data. That means the primary key is not just a logical constraint; it is the physical organization of the table.',
      'Secondary indexes work differently. Their leaf entries store secondary-key values plus the primary key of the row. If a query needs columns not available in the secondary index, InnoDB uses that primary key to perform a second lookup in the clustered index.',
    ] },
    { heading: 'How it works', paragraphs: [
      'For a query by primary key, the engine descends the primary B-tree and lands on a leaf record containing the full row and MVCC metadata. For a query by secondary key, it descends the secondary B-tree, obtains the primary key, and then descends the clustered B-tree to fetch the row unless the secondary index covers the query.',
      'This explains why primary-key choice matters. A narrow, stable, mostly increasing primary key keeps secondary entries smaller and often makes inserts friendlier. A random or wide primary key can increase page splits, cache churn, and secondary-index storage.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'The asymptotic model is B-tree search, but the practical cost is page reads, cache hits, page splits, and whether the query is covering. A secondary range scan that fetches many rows can become expensive if it performs many scattered primary-key lookups.',
      'The common misconception is that every index points to a row stored elsewhere. In InnoDB, the clustered primary index is where the row lives. Secondary indexes point back to that clustered key.',
      'This is why EXPLAIN output and index design need to be read together. Seeing "Using index" can mean a covering read, while seeing a secondary index plus many row fetches can mean the clustered tree is still doing substantial work behind the scenes.',
    ] },
    { heading: 'Complete case study', paragraphs: [
      'Consider a user service with endpoints for lookup by id and lookup by email. GET /users/42 is a direct clustered lookup. GET /users?email=m@example.com uses the email secondary index to find id=42, then uses the clustered index to fetch the full row. If the endpoint only needs email and status, a covering secondary index can avoid the second walk.',
      'This is a concrete example of data structures shaping API performance. The B-tree is not abstract decoration; it determines whether a request is one page path, two page paths, or many random row fetches after a range scan.',
      'A migration from integer ids to random public ids should therefore be treated as a storage design change, not only an API change. If the random id becomes the clustered primary key, insert locality and every secondary index entry change together.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Sources: MySQL InnoDB clustered and secondary index documentation, https://dev.mysql.com/doc/refman/8.0/en/innodb-index-types.html, and InnoDB physical index structure, https://dev.mysql.com/doc/refman/8.0/en/innodb-physical-structure.html. Study B-Trees, B+ Tree Leaf Sibling Scan Case Study, Database Indexing, Bw-Tree Delta Chain & Mapping Table, PostgreSQL Query Planner, Write-Ahead Log, and MVCC & Vacuum next.',
    ] },
  ],
};
