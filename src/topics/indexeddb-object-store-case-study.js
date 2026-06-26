// IndexedDB: browser-resident ordered object stores, secondary indexes,
// transactions, schema upgrades, and offline mutation queues.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'indexeddb-object-store-case-study',
  title: 'IndexedDB Object Store Case Study',
  category: 'Systems',
  summary: 'Browser storage as a data-structure lesson: ordered object stores, secondary indexes, cursors, key ranges, transactions, and offline sync queues.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['records and indexes', 'offline sync'], defaultValue: 'records and indexes' },
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

function idbGraph(title) {
  return graphState({
    nodes: [
      { id: 'app', label: 'app', x: 0.8, y: 3.7, note: 'async' },
      { id: 'db', label: 'IDB', x: 2.7, y: 3.7, note: 'origin' },
      { id: 'docs', label: 'docs', x: 4.7, y: 2.0, note: 'store' },
      { id: 'outbox', label: 'outbox', x: 4.7, y: 5.4, note: 'store' },
      { id: 'pk', label: 'key order', x: 6.8, y: 1.2, note: 'primary keys' },
      { id: 'idx', label: 'index', x: 6.8, y: 3.7, note: 'updatedAt' },
      { id: 'cursor', label: 'cursor', x: 8.9, y: 2.4, note: 'range walk' },
      { id: 'clone', label: 'clone', x: 8.9, y: 5.2, note: 'value' },
    ],
    edges: [
      { id: 'e-app-db', from: 'app', to: 'db' },
      { id: 'e-db-docs', from: 'db', to: 'docs' },
      { id: 'e-db-outbox', from: 'db', to: 'outbox' },
      { id: 'e-docs-pk', from: 'docs', to: 'pk' },
      { id: 'e-docs-idx', from: 'docs', to: 'idx' },
      { id: 'e-idx-cursor', from: 'idx', to: 'cursor' },
      { id: 'e-docs-clone', from: 'docs', to: 'clone' },
    ],
  }, { title });
}

function syncGraph(title) {
  return graphState({
    nodes: [
      { id: 'page', label: 'page', x: 0.8, y: 3.7, note: 'editor UI' },
      { id: 'worker', label: 'worker', x: 2.8, y: 3.7, note: 'no DOM' },
      { id: 'idb', label: 'IDB', x: 4.8, y: 3.7, note: 'local truth' },
      { id: 'docs', label: 'docs', x: 6.7, y: 1.8, note: 'current copy' },
      { id: 'outbox', label: 'outbox', x: 6.7, y: 5.6, note: 'pending ops' },
      { id: 'sw', label: 'SW', x: 8.5, y: 3.7, note: 'retry path' },
      { id: 'api', label: 'API', x: 9.8, y: 3.7, note: 'remote state' },
    ],
    edges: [
      { id: 'e-page-worker', from: 'page', to: 'worker' },
      { id: 'e-worker-idb', from: 'worker', to: 'idb' },
      { id: 'e-idb-docs', from: 'idb', to: 'docs' },
      { id: 'e-idb-outbox', from: 'idb', to: 'outbox' },
      { id: 'e-outbox-sw', from: 'outbox', to: 'sw' },
      { id: 'e-sw-api', from: 'sw', to: 'api' },
      { id: 'e-api-docs', from: 'api', to: 'docs' },
    ],
  }, { title });
}

function* recordsAndIndexes() {
  yield {
    state: idbGraph('IndexedDB is ordered browser storage, not just a blob shelf'),
    highlight: { active: ['app', 'db', 'docs', 'e-app-db', 'e-db-docs'], compare: ['outbox'] },
    explanation: 'An IndexedDB database is scoped to an origin and split into object stores. Each store holds records by key, so the basic operation is an ordered key-value lookup rather than a string-only localStorage slot.',
  };

  yield {
    state: labelMatrix(
      'Object store record shape',
      [
        { id: 'key', label: 'primary key' },
        { id: 'value', label: 'stored value' },
        { id: 'path', label: 'key path' },
        { id: 'range', label: 'key range' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'data structure lesson', label: 'data structure lesson' },
      ],
      [
        ['unique order key', 'lookup and sort axis'],
        ['structured clone', 'object graph snapshot'],
        ['extract key from value', 'schema chooses access path'],
        ['bounded interval', 'range scan primitive'],
      ],
    ),
    highlight: { active: ['key:data structure lesson', 'range:data structure lesson'], found: ['value:role'] },
    explanation: 'Records are sorted by key. A key range turns that order into an API: fetch exactly one key, all keys between two bounds, or cursor through a prefix-shaped interval.',
    invariant: 'The key is the durable address; the value is cloned data attached to that address.',
  };

  yield {
    state: idbGraph('Secondary indexes are alternate sorted projections'),
    highlight: { active: ['idx', 'cursor', 'e-docs-idx', 'e-idx-cursor'], compare: ['pk'], found: ['docs'] },
    explanation: 'An index stores a derived key path such as updatedAt, email, or status. The object store remains keyed by primary id, while the index gives another ordered route into the same records.',
  };

  yield {
    state: labelMatrix(
      'Cursor query plans',
      [
        { id: 'get', label: 'get(id)' },
        { id: 'getAll', label: 'getAll(range)' },
        { id: 'openCursor', label: 'openCursor' },
        { id: 'count', label: 'count(range)' },
      ],
      [
        { id: 'access', label: 'access path' },
        { id: 'when to use' , label: 'when to use' },
      ],
      [
        ['primary key', 'single record'],
        ['store or index range', 'bounded batch'],
        ['store or index range', 'stream and stop early'],
        ['store or index range', 'cardinality without values'],
      ],
    ),
    highlight: { active: ['openCursor:access', 'getAll:access'], compare: ['get:when to use'] },
    explanation: 'Cursors matter because the browser database is asynchronous. You often want to walk just enough of an ordered range, update UI progressively, or stop after a page of results rather than materializing everything.',
  };
}

function* offlineSync() {
  yield {
    state: syncGraph('Offline apps separate local truth from remote sync'),
    highlight: { active: ['page', 'worker', 'idb', 'docs', 'e-page-worker', 'e-worker-idb', 'e-idb-docs'], compare: ['api'] },
    explanation: 'A local-first editor reads and writes IndexedDB first. The page can stay responsive while a Web Worker handles persistence, parsing, and query work off the main thread.',
  };

  yield {
    state: syncGraph('Mutations append to an outbox while offline'),
    highlight: { active: ['outbox', 'e-idb-outbox'], removed: ['api', 'e-sw-api'], found: ['docs'] },
    explanation: 'When the network is unavailable, the app commits the document update locally and appends a durable mutation to an outbox store. The UI does not block on the server, but every pending operation has an explicit replay record.',
    invariant: 'Offline-first is a transaction design, not a spinner replacement.',
  };

  yield {
    state: labelMatrix(
      'Transactions and schema upgrades',
      [
        { id: 'readonly', label: 'readonly tx' },
        { id: 'readwrite', label: 'readwrite tx' },
        { id: 'versionchange', label: 'versionchange' },
        { id: 'blocked', label: 'blocked open' },
      ],
      [
        { id: 'purpose', label: 'purpose' },
        { id: 'failure mode', label: 'failure mode' },
      ],
      [
        ['consistent reads', 'long cursor holds resources'],
        ['atomic store changes', 'abort rolls back scope'],
        ['create stores/indexes', 'old tabs block migration'],
        ['wait for old connection', 'upgrade stuck until closed'],
      ],
    ),
    highlight: { active: ['readwrite:purpose', 'versionchange:purpose'], compare: ['blocked:failure mode'] },
    explanation: 'Every change happens inside a transaction. Schema changes are special: opening a higher database version runs a versionchange upgrade where stores and indexes are created, and older open tabs can block the upgrade.',
  };

  yield {
    state: syncGraph('Replay drains the outbox and reconciles local state'),
    highlight: { active: ['outbox', 'sw', 'api', 'docs', 'e-outbox-sw', 'e-sw-api', 'e-api-docs'], found: ['idb'] },
    explanation: 'When connectivity returns, a service worker or foreground sync loop drains the outbox, sends mutations to the API, records server acknowledgments, and updates indexed local records. This is where conflict policy belongs.',
  };

  yield {
    state: labelMatrix(
      'Production checklist',
      [
        { id: 'quota', label: 'quota' },
        { id: 'eviction', label: 'eviction' },
        { id: 'clone', label: 'clone cost' },
        { id: 'indexes', label: 'index cost' },
        { id: 'privacy', label: 'clear data' },
      ],
      [
        { id: 'what can happen', label: 'what can happen' },
        { id: 'design response', label: 'design response' },
      ],
      [
        ['QuotaExceededError', 'estimate and compact'],
        ['best-effort storage removed', 'request persistence when justified'],
        ['large object copy cost', 'store chunks or files elsewhere'],
        ['extra write work', 'index only real queries'],
        ['user/browser deletes origin', 'sync or export critical data'],
      ],
    ),
    highlight: { active: ['quota:design response', 'eviction:design response', 'indexes:design response'], removed: ['privacy:what can happen'] },
    explanation: 'The browser owns the final storage budget. IndexedDB is durable enough for serious offline apps, but not an excuse to skip quota handling, compaction, sync, export, and clear-data recovery paths.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'records and indexes') yield* recordsAndIndexes();
  else if (view === 'offline sync') yield* offlineSync();
  else throw new InputError('Pick an IndexedDB view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. In records and indexes, the app reaches an IndexedDB database, object stores hold records, primary keys define sorted order, secondary indexes give alternate sorted paths, and cursors walk bounded ranges. In offline sync, a page and worker write local state first, append a durable outbox entry, and later replay that entry to a remote API.',
        'Active nodes show the operation currently deciding state: opening a store, choosing an index, walking a cursor, writing an outbox row, or replaying a mutation. Found nodes show a result that is now guaranteed by the current step, such as a record reached by key or a synced document after replay. Compare nodes show an alternative path, usually local truth versus remote truth or one access path versus another.',
        {type:'callout', text:'IndexedDB is a local database because sorted stores, indexes, and transactions create durable access paths instead of one serialized blob.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'IndexedDB is the browser database API for structured local data. A browser app can lose network access, reload, run in several tabs, and still need to find one record, list recent records, count pending work, or write several related changes together. String storage and heap objects do not cover that job.',
        'The basic terms are direct. An object store is a collection of records. A key is the durable address and sort position for a record. An index is another sorted route into the same records. A transaction is a boundary that commits all included changes or none of them.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is one JSON blob in localStorage. On startup, parse the blob into memory. On every edit, change the object, stringify the whole object, and write it back. For a todo list with 20 small rows, this is clear and cheap.',
        'The approach is reasonable because it avoids schema design. There are no stores, indexes, cursors, version upgrades, blocked tabs, or transaction lifetimes to understand. The cost is hidden while the data set is small and every screen needs almost all of it.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is access paths. A notes app with 10,000 documents may need doc-42 by id, the 20 newest documents, all documents in project P, and every pending sync operation. The JSON blob forces each query to parse the whole state and then scan or sort it in JavaScript.',
        'The second wall is partial failure. If the app updates a document and then crashes before appending the sync record, local state and replay state disagree. If it appends the sync record first and then fails before changing the document, the opposite bug appears. A local database must make related changes atomic.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'IndexedDB turns browser storage into ordered records plus transactions. The store key gives exact lookup and range scan. Indexes trade extra write work for extra read paths. Transactions make multi-store changes behave as one unit.',
        'The invariant is that the primary store and every affected index describe the same committed records at the end of a transaction. The developer chooses schema and transaction scope. The browser maintains the ordered structures and rolls back the whole transaction if one request fails.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The app opens a database with a version number. During an upgrade event, it creates stores and indexes, such as docs keyed by id and an index by updatedAt. Normal work opens a readonly or readwrite transaction over the stores it needs, issues get, put, delete, count, getAll, or openCursor requests, and receives asynchronous results.',
        'A cursor is the streaming primitive. It starts at a key or index range, returns one record, and advances only when the app asks. A recent-documents screen can open the updatedAt index in reverse order, read 20 records, and stop without materializing all 10,000 documents.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from ordered keys and transaction atomicity. If doc updates and outbox entries are written in the same readwrite transaction, a crash cannot leave exactly one of them committed. If the transaction commits, both exist. If it aborts, neither exists.',
        'Index correctness follows the same invariant. A query through the updatedAt index is safe because each committed write also updated that index before the transaction became visible. A cursor over a key range cannot skip matching committed keys unless the range itself was wrong.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A primary-key lookup behaves like a tree lookup, so the cost grows slowly with record count. A range cursor costs the seek plus the number of records read, so reading 20 newest rows still reads about 20 rows when the store grows from 10,000 to 100,000 records. A full scan remains expensive because every record must be cloned into JavaScript.',
        'Writes pay for every maintained access path. If a docs store has the primary key plus indexes on updatedAt, projectId, and status, one put updates four ordered structures. Adding an index can make future reads cheaper, but it makes every insert, update, delete, migration, and quota decision heavier.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'IndexedDB fits local-first editors, mail clients, dashboards, map caches, drawing tools, note apps, and browser databases that need structured offline state. The common access pattern is not just remember a value. It is find one row, page a sorted range, keep an outbox, and recover after reload.',
        'It also fits worker-based persistence. A worker can parse, persist, and query data without blocking the page, while the UI receives smaller result sets. That matters when the main thread is also responsible for input, layout, and rendering.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'IndexedDB is weak for relational joins, full-text search, and high-throughput byte streams. Joining docs to authors means manual lookups. Text search needs a separate inverted index or a library. Large binary streams often belong in OPFS or Cache Storage with metadata in IndexedDB.',
        'It also fails when teams ignore browser ownership of storage. Quota can be exhausted, best-effort storage can be evicted, schema upgrades can be blocked by old tabs, and transaction lifetimes can end before a delayed async callback tries to issue the next request.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a notes app has 10,000 documents. Each document is 2 KB, so a JSON blob is about 20 MB before overhead. To show the 20 newest documents, the blob approach parses 20 MB, scans 10,000 rows, sorts by updatedAt, and keeps 20. If parsing and sorting take 180 ms on a laptop, the UI misses many frames.',
        'With IndexedDB, docs has a primary key id and an index updatedAt. The recent list opens that index in reverse order and reads 20 cursor entries. If each cloned record is 2 KB, the read moves about 40 KB of useful data plus tree overhead. The write path pays more: saving one document updates the primary tree and the updatedAt index, and the offline version also appends one outbox row in the same transaction.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: W3C Indexed Database API 3.0 at https://www.w3.org/TR/IndexedDB/, MDN IndexedDB API at https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API, MDN Storage quotas and eviction criteria at https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria, and the idb wrapper at https://github.com/jakearchibald/idb.',
        'Study B-Tree first for ordered access paths, then database indexing for secondary indexes, transactions for atomicity, structured clone for value copying, service workers for replay, OPFS for file-like local bytes, and browser storage quota for the durability limits around the database.',
      ],
    },
  ],
};