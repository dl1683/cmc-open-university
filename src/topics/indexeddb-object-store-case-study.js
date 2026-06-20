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
        'The animation has two views. "Records and indexes" traces data through an IndexedDB database: the app opens a connection, object stores hold records, primary keys sort them, secondary indexes provide alternate access paths, and cursors walk ranges. "Offline sync" traces the offline mutation pipeline: a page writes through a worker into IndexedDB, mutations queue in an outbox, and a service worker drains them to a remote API when connectivity returns.',
        {
          type: 'bullets',
          items: [
            'Active nodes are the current decision point: which store receives a write, which index routes a query, or which cursor is walking a range.',
            'Found nodes are confirmed outcomes: the record reached by a key lookup, the outbox entry committed alongside the document, or the synced state after replay.',
            'Compare nodes show the alternative under evaluation: an outbox store contrasted with a docs store, or a remote API contrasted with local truth.',
          ],
        },
        'In the matrix views, rows are record shapes, cursor query plans, transaction types, or production failure modes. Columns show role versus data-structure lesson, access path versus use case, or failure mode versus design response. Watch the key-range column: it is the primitive that turns sorted order into a query API.',
        {type:'callout', text:'IndexedDB is a local database because sorted stores, indexes, and transactions create durable access paths instead of one serialized blob.'},
        {
          type: 'note',
          text: 'The animation uses a small number of nodes for readability. A real IndexedDB database may hold dozens of object stores, each with multiple indexes, serving hundreds of concurrent cursor operations across tabs and workers. The contracts -- key ordering, transaction atomicity, structured-clone isolation -- are the same at any scale.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'The Indexed Database API provides a way for applications to store structured data in the user agent, using key-value pairs grouped into object stores with indexes.',
          attribution: 'W3C, "Indexed Database API 3.0" (W3C Working Draft), Section 1',
        },
        'A web application that does real work -- editing documents, composing email, browsing maps, analyzing data -- needs storage that survives page reloads, works when the network is absent, and answers more than one query shape. An in-memory Map or object literal disappears when the tab closes. localStorage gives synchronous, string-only, 5 MB-limited slots: fine for a theme preference, wrong for 10,000 structured records.',
        {
          type: 'table',
          headers: ['Browser storage option', 'Capacity', 'Data model', 'Async', 'Available in workers', 'Indexed queries'],
          rows: [
            ['Variables / Map', 'Heap-limited', 'Any JS value', 'N/A', 'Yes', 'Manual'],
            ['localStorage', '~5 MB per origin', 'String key-value', 'No (blocks main thread)', 'No', 'No'],
            ['sessionStorage', '~5 MB per origin', 'String key-value', 'No', 'No', 'No'],
            ['Cookies', '~4 KB per cookie', 'String', 'No', 'No', 'No'],
            ['Cache API', 'Quota-managed', 'Request/Response pairs', 'Yes', 'Yes', 'By URL only'],
            ['OPFS', 'Quota-managed', 'Byte streams (files)', 'Yes', 'Yes (sync in workers)', 'No'],
            ['IndexedDB', 'Quota-managed (often GB+)', 'Structured clone objects', 'Yes', 'Yes', 'Yes: primary keys + secondary indexes'],
          ],
        },
        'IndexedDB exists because browser applications sometimes need a real local database: ordered records, secondary indexes, range scans, transactional writes, schema migrations, and quota-managed capacity measured in gigabytes. It is the only browser storage API that combines all of these.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first design most developers try is a single JSON blob. Load the entire app state from localStorage on startup, mutate the JavaScript object in memory, JSON.stringify it, and write it back on every change or before the page unloads.',
        {
          type: 'code',
          language: 'javascript',
          text: '// The JSON-blob approach\nconst STATE_KEY = "app-state";\n\n// Load everything at startup\nlet state = JSON.parse(localStorage.getItem(STATE_KEY) || "{}");\n\n// Mutate in memory\nstate.docs["doc-42"].title = "New title";\nstate.docs["doc-42"].updatedAt = Date.now();\n\n// Write everything back\nlocalStorage.setItem(STATE_KEY, JSON.stringify(state));\n// Problem: rewrites ALL docs to change ONE title',
        },
        'This works for a tiny todo list. It feels simple because there is one persistence path, no schema, no migration plan, no transaction boundary, and no index to maintain. For 20 items of 100 bytes each, the cost is invisible.',
        {
          type: 'note',
          text: 'The blob approach is not stupid. It is the correct minimum viable storage for small, single-tab, online-only apps. The mistake is keeping it past the point where its costs become visible: around 100 KB of data, or the first time the app needs partial reads, offline replay, or multi-tab consistency.',
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is access paths. A browser database is useful only if the app can reach the records it needs without materializing everything. Consider the queries a local-first notes app must answer:',
        {
          type: 'table',
          headers: ['Screen or job', 'Query shape', 'What the JSON blob forces'],
          rows: [
            ['Detail view', 'Get doc by id', 'Parse entire blob, index into docs object'],
            ['Recents list', '10 most-recent docs by updatedAt', 'Parse entire blob, sort all docs, take 10'],
            ['Project page', 'Docs in project P, ordered by update', 'Parse entire blob, filter by project, sort'],
            ['Sync worker', 'All pending mutations by sequence', 'Parse entire blob, filter by sync status'],
            ['Search', 'Docs matching a text query', 'Parse entire blob, scan every title/body'],
            ['Quota check', 'Count of cached assets', 'Parse entire blob, count entries'],
          ],
        },
        'Every query pays the same cost: deserialize the full state, scan linearly, extract results. As state grows, every read becomes slower, and every write rewrites the entire blob. A crash between mutation and write loses everything since the last successful save. The main thread blocks during JSON.stringify, which is exactly when the UI needs to stay responsive.',
        {
          type: 'diagram',
          text: 'JSON blob cost as data grows:\n\n  Records    Blob size    Parse time    Write time    Wasted work per query\n  -------    ---------    ----------    ----------    ---------------------\n      50       12 KB         <1 ms         <1 ms      ~49 records parsed for nothing\n     500      120 KB          2 ms          3 ms      ~499 records parsed for nothing\n   5,000      1.2 MB         15 ms         20 ms      ~4,999 records, UI jank visible\n  50,000       12 MB        150 ms        200 ms      App freezes on every save',
          label: 'Every operation is O(total state), not O(result size)',
        },
        'The wall is not just "it gets slow." The wall is that a flat blob offers zero access paths. An ordered store offers lookup by key, scan by range, and projection by index -- each touching only the relevant records.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core abstraction is an ordered object store with decoupled access paths. Each record has a key (the durable address and sort axis) and a value (a structured-clone snapshot, not a live reference). The key determines where the record sits in sorted order. The value is copied into storage through the structured clone algorithm, which deep-copies objects, arrays, dates, blobs, and typed arrays but rejects functions, DOM nodes, and prototype chains.',
        {
          type: 'diagram',
          text: 'IndexedDB storage architecture for a notes app:\n\n  Database: "notes-app" (origin-scoped)\n  |\n  +-- Object store: "docs" (keyPath: "id")\n  |     Primary key order:  doc-01 < doc-02 < doc-03 < ...\n  |     Index "by-updated":  keyPath "updatedAt"  (non-unique)\n  |     Index "by-project":  keyPath ["projectId", "updatedAt"]  (compound)\n  |     Each record: { id, title, body, projectId, updatedAt, ... }\n  |\n  +-- Object store: "outbox" (autoIncrement: true)\n        Primary key order:  1 < 2 < 3 < ...  (monotonic sequence)\n        Index "by-status":  keyPath "status"  (non-unique)\n        Each record: { op, docId, payload, status, idempotencyKey, ... }',
          label: 'Two stores, four indexes, five distinct query paths',
        },
        'An index is an alternate sorted projection over the same records. The "by-updated" index on the docs store lets the recents view open a cursor sorted by timestamp without touching the primary key order. The "by-project" compound index lets a project page jump to [projectId, -Infinity] and walk forward, getting all docs in that project sorted by update time. The same stored record becomes reachable through multiple ordered routes.',
        {
          type: 'note',
          text: 'The key contract: every write must keep the primary store and every affected index consistent within a single transaction. The browser engine maintains this invariant -- the developer does not manually update indexes. But every index added is write amplification the engine must pay on every insert, update, or delete.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'IndexedDB operations follow a request-transaction-event lifecycle. The app opens a database (specifying a version number), opens a transaction over one or more stores, issues requests against those stores, and receives results via events or promises.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Open database, create stores and indexes on upgrade\nconst request = indexedDB.open("notes-app", 3);\n\nrequest.onupgradeneeded = (event) => {\n  const db = event.target.result;\n  // Create object store with explicit key path\n  if (!db.objectStoreNames.contains("docs")) {\n    const docs = db.createObjectStore("docs", { keyPath: "id" });\n    docs.createIndex("by-updated", "updatedAt");\n    docs.createIndex("by-project", ["projectId", "updatedAt"]);\n  }\n  // Create outbox with auto-incrementing key\n  if (!db.objectStoreNames.contains("outbox")) {\n    const outbox = db.createObjectStore("outbox", { autoIncrement: true });\n    outbox.createIndex("by-status", "status");\n  }\n};\n\nrequest.onsuccess = (event) => {\n  const db = event.target.result;\n  // db is now ready for transactions\n};',
        },
        {
          type: 'table',
          headers: ['Operation', 'Mechanism', 'Touches', 'Cost'],
          rows: [
            ['get(key)', 'B-tree lookup by primary key', 'Primary store only', 'O(log n) -- one key, one record'],
            ['getAll(range)', 'Range scan, materialize all matches', 'Store or index', 'O(log n + k) for k results'],
            ['openCursor(range, dir)', 'Walk sorted order one record at a time', 'Store or index', 'O(log n) to position, O(1) per advance'],
            ['put(value)', 'Insert or overwrite by key path', 'Primary store + all indexes', 'O(log n) per affected index'],
            ['delete(key)', 'Remove by primary key', 'Primary store + all indexes', 'O(log n) per affected index'],
            ['count(range)', 'Count keys in range without reading values', 'Store or index', 'O(log n) to position + O(k) count'],
          ],
        },
        'Cursors are the streaming primitive. A cursor positions itself in sorted order (by primary key or by an index key), returns one record, and advances on request. The app can stop early, skip forward, update the current record, or delete it. This is how IndexedDB avoids materializing large result sets: the app pulls records one at a time and decides when to stop.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Page through recent docs, 20 at a time, using a cursor\nfunction getRecentDocs(db, limit = 20) {\n  return new Promise((resolve, reject) => {\n    const tx = db.transaction("docs", "readonly");\n    const index = tx.objectStore("docs").index("by-updated");\n    const results = [];\n    // Open cursor in "prev" direction: newest first\n    const request = index.openCursor(null, "prev");\n    request.onsuccess = (event) => {\n      const cursor = event.target.result;\n      if (cursor && results.length < limit) {\n        results.push(cursor.value);\n        cursor.continue();\n      } else {\n        resolve(results);\n      }\n    };\n    request.onerror = () => reject(request.error);\n  });\n}',
        },
        {
          type: 'diagram',
          text: 'Key range query: docs in project "proj-7", newest first\n\n  Compound index "by-project": keyPath ["projectId", "updatedAt"]\n  Sorted entries:\n    ["proj-5", 1718000000] --> doc-11\n    ["proj-5", 1718100000] --> doc-14\n    ["proj-7", 1718050000] --> doc-08    <-- range start\n    ["proj-7", 1718200000] --> doc-22    <-- cursor walks here\n    ["proj-7", 1718350000] --> doc-31    <-- cursor walks here\n    ["proj-9", 1718010000] --> doc-03    <-- range end (exclusive)\n\n  IDBKeyRange.bound(["proj-7"], ["proj-7", []])\n  opens at the first "proj-7" entry and stops before "proj-8".\n  Direction "prev" returns doc-31, doc-22, doc-08 -- newest first.',
          label: 'Compound keys encode partition + sort order in a single index',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'IndexedDB provides ordered durable records plus transaction scope. Three properties make the combination correct.',
        {
          type: 'table',
          headers: ['Property', 'What it guarantees', 'What breaks without it'],
          rows: [
            ['Key ordering', 'Records are sorted by key in each store and index; range scans and cursors return results in deterministic order', 'Pagination returns duplicates or gaps; recents list is unsorted; compound queries require full scan'],
            ['Transaction atomicity', 'All requests in a transaction commit together or abort together; no partial writes are visible', 'Document update lands without outbox entry; sync loses track of mutations; multi-store consistency is impossible'],
            ['Structured clone isolation', 'Stored values are deep copies, not live references; mutations to in-memory objects do not affect stored data', 'A stored record changes when unrelated code mutates a shared object; data corruption through aliasing'],
          ],
        },
        'The correctness argument for any specific app is schema-specific. For a local-first notes app with an outbox:',
        {
          type: 'bullets',
          items: [
            'If every user mutation commits a document update and an outbox entry in the same readwrite transaction, then after any crash the outbox contains exactly the mutations the user has not yet synced.',
            'If every screen query has a matching store or index, the UI avoids full-store scans. The recents view uses the "by-updated" index. The project page uses the "by-project" compound index. The detail view uses the primary key.',
            'If every schema upgrade is versioned and handled in onupgradeneeded, old data migrates forward deterministically instead of being guessed at runtime.',
            'If the outbox drain deletes entries only after server acknowledgment, replay is idempotent: replaying a mutation that already succeeded either no-ops or is caught by the idempotency key.',
          ],
        },
        {
          type: 'note',
          text: 'Transaction lifetime is tied to the event loop. A transaction auto-commits when no more requests are pending against it. If the app opens a transaction, issues a get, awaits an unrelated fetch, then tries to put, the transaction may have already committed or aborted. Keep all related requests in a tight synchronous sequence within the transaction callback.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Cost dimension', 'Behavior', 'When it hurts'],
          rows: [
            ['Structured clone', 'Deep-copies every value on write and on read; objects, arrays, dates, blobs, typed arrays all cloned', 'Large values (>100 KB): each put or get allocates a full copy; 1 MB objects cost ~2 ms per clone on mid-range hardware'],
            ['Index write amplification', 'Every put/delete updates the primary store + every index on that store', 'A store with 5 indexes pays 6x the write I/O of an unindexed store; each index is a separate B-tree insertion'],
            ['Cursor hold cost', 'An open cursor keeps the transaction alive and may hold read locks on underlying pages', 'Iterating 100,000 records in one cursor pass blocks other readwrite transactions on the same stores'],
            ['Schema migration', 'onupgradeneeded runs synchronously and blocks the database for all other connections', 'A migration that rewrites 50,000 records blocks every tab for seconds; users see a frozen app'],
            ['Quota', 'Browser manages quota per origin; writes fail with QuotaExceededError when budget is exhausted', 'An app that caches media or large datasets can hit the limit silently; navigator.storage.estimate() returns an approximation, not a guarantee'],
            ['Eviction', 'Best-effort storage can be evicted by the browser under memory pressure without notice', 'Critical offline data disappears; navigator.storage.persist() requests durable storage but the browser may decline'],
          ],
        },
        'When data doubles, reads scale with the query, not the database: a get(id) is still O(log n), and a cursor over 20 records still touches ~20 records regardless of total count. Writes scale with the number of indexes: doubling the data does not change per-write cost, but adding an index does.',
        {
          type: 'diagram',
          text: 'Cost profile: 10,000 docs, 2 indexes\n\n  Operation               Touches          Approx time (mid-range device)\n  ----------------------  ---------------  -----------------------------\n  get("doc-5000")         1 B-tree lookup   <1 ms\n  getAll(range of 50)     1 range scan      ~2 ms (50 clones)\n  put(doc)                3 B-tree inserts  ~1 ms (primary + 2 indexes)\n  openCursor, 20 items    1 seek + 20 next  ~3 ms (20 clones)\n  count(IDBKeyRange)      1 range count     <1 ms (no clones)\n  Full scan via cursor    10,000 advances   ~500 ms (10,000 clones)\n\n  Adding a 3rd index: put cost rises from ~1 ms to ~1.3 ms\n  Adding a 4th index: put cost rises to ~1.6 ms\n  Each index is ~30% more write work.',
          label: 'Read cost depends on result size; write cost depends on index count',
        },
        {
          type: 'note',
          text: 'The async API adds event-loop overhead. A chain of 100 individual get() calls issues 100 microtask callbacks. Batching with getAll() where possible, or collecting keys first and issuing one getAll(keys), reduces round-trip overhead by 5-10x in practice.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Trace an offline edit through the full lifecycle: write, queue, sync, and reconcile.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Step 1: Offline edit -- atomic write to docs + outbox\nasync function saveEdit(db, docId, newTitle) {\n  const tx = db.transaction(["docs", "outbox"], "readwrite");\n  const docs = tx.objectStore("docs");\n  const outbox = tx.objectStore("outbox");\n\n  // Read current doc\n  const doc = await idbRequest(docs.get(docId));\n  // Update fields\n  doc.title = newTitle;\n  doc.updatedAt = Date.now();\n  doc.version += 1;\n  // Write updated doc (primary key + both indexes updated atomically)\n  docs.put(doc);\n  // Append mutation to outbox (auto-increment key = sequence number)\n  outbox.add({\n    op: "update-title",\n    docId: docId,\n    payload: { title: newTitle },\n    idempotencyKey: crypto.randomUUID(),\n    status: "pending",\n    createdAt: Date.now(),\n  });\n  // Transaction commits both writes or aborts both\n  await idbTransaction(tx);\n}',
        },
        {
          type: 'diagram',
          text: 'After saveEdit("doc-22", "Meeting Notes v2"):\n\n  docs store (primary key: id):\n    doc-08: { id:"doc-08", title:"Draft",          updatedAt: 1718050000 }\n    doc-22: { id:"doc-22", title:"Meeting Notes v2", updatedAt: 1718400000 }  <-- updated\n    doc-31: { id:"doc-31", title:"Research",        updatedAt: 1718350000 }\n\n  docs index "by-updated" (sorted by updatedAt):\n    1718050000 --> doc-08\n    1718350000 --> doc-31\n    1718400000 --> doc-22   <-- moved to end (newest)\n\n  outbox store (auto-increment key):\n    1: { op:"update-title", docId:"doc-22", status:"pending", ... }\n\n  Both writes committed in one transaction.\n  If the browser crashes mid-write, neither lands.',
          label: 'One transaction, two stores, three index updates, zero partial writes',
        },
        {
          type: 'code',
          language: 'javascript',
          text: '// Step 2: Sync drain -- replay outbox when online\nasync function drainOutbox(db) {\n  const tx = db.transaction(["outbox", "docs"], "readwrite");\n  const outbox = tx.objectStore("outbox");\n  const statusIndex = outbox.index("by-status");\n  const docs = tx.objectStore("docs");\n\n  // Cursor over pending mutations in sequence order\n  const cursor = await idbRequest(\n    statusIndex.openCursor(IDBKeyRange.only("pending"))\n  );\n  while (cursor) {\n    const mutation = cursor.value;\n    try {\n      // Send to server with idempotency key\n      const serverResponse = await fetch("/api/mutations", {\n        method: "POST",\n        headers: { "Idempotency-Key": mutation.idempotencyKey },\n        body: JSON.stringify(mutation),\n      });\n      if (serverResponse.ok) {\n        const serverDoc = await serverResponse.json();\n        // Update local doc with server version\n        docs.put(serverDoc);\n        // Remove from outbox\n        cursor.delete();\n      }\n    } catch (e) {\n      // Network error: stop draining, retry later\n      break;\n    }\n    await idbRequest(cursor.continue());\n  }\n}',
        },
        {
          type: 'note',
          text: 'The drain function has a subtle transaction-lifetime issue. The await fetch() suspends JavaScript execution, and the transaction may auto-commit before the cursor.continue() call. Production implementations open a new transaction per mutation, or collect pending mutations first (via getAll on the status index) and then process them outside the transaction.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['Application', 'What IndexedDB stores', 'Why IndexedDB fits'],
          rows: [
            ['Google Docs (offline mode)', 'Document snapshots, pending edits, collaboration metadata', 'Survives tab close; transactional writes for edit + sync-intent; structured data with indexes for doc lookup'],
            ['Notion', 'Cached page blocks, offline edits, local search index', 'Gigabytes of structured blocks; compound indexes for workspace + updated queries; available in service worker for background sync'],
            ['Google Maps (offline areas)', 'Map tiles, place metadata, saved routes', 'Large binary data (tile images as blobs); spatial key ranges for viewport queries; persistent across sessions'],
            ['Figma', 'File cache, multiplayer operation log, undo history', 'Ordered operation log with cursor-based replay; blob storage for embedded images; offline editing support'],
            ['Gmail (offline)', 'Email headers, bodies, attachments, labels', 'Millions of records with multiple indexes (by date, label, thread); cursor pagination for inbox; blob storage for attachments'],
            ['Excalidraw', 'Drawing elements, collaboration state, library items', 'Local-first editing; structured element data; offline-capable with sync on reconnect'],
          ],
        },
        'The fit is strongest when the app needs structured queries (not just key-value blobs), offline durability (not just caching), and worker access (not just main-thread storage). IndexedDB is available in dedicated workers, shared workers, and service workers, which lets an app move all persistence work off the main thread.',
        {
          type: 'quote',
          text: 'IndexedDB is a transactional database system, like an SQL-based RDBMS. However, unlike SQL-based RDBMSes, which use fixed-column tables, IndexedDB is a JavaScript-based object-oriented database.',
          attribution: 'MDN Web Docs, "IndexedDB API" (developer.mozilla.org)',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'No joins: querying across stores requires manual coordination. A "docs with their authors" query means one lookup in the docs store plus N lookups in a users store. For relational query patterns, IndexedDB forces the app to implement its own join logic.',
            'No full-text search: indexes work on exact key values and key ranges, not substring or fuzzy matching. Building a search feature requires a separate inverted-index store maintained by the app, or an external library like Fuse.js or MiniSearch operating over IndexedDB data.',
            'Structured clone cost: every read clones the stored value. Reading a 2 MB document 10 times allocates 20 MB of copies. For large values, consider storing metadata in IndexedDB and raw bytes in OPFS.',
            'Multi-tab upgrade blocking: a versionchange upgrade cannot proceed while older connections are open. If a user has 5 tabs open from the old app version, the upgrade blocks until all 5 close their connections. Production code needs onblocked and onversionchange handlers to prompt the user or force-close stale connections.',
            'No server reconciliation: IndexedDB stores data locally but has no opinion about conflicts. If two offline tabs edit the same document, the app must detect and resolve the conflict. Last-write-wins, operational transform, or CRDT strategies must be built on top.',
            'Quota is not guaranteed: navigator.storage.estimate() returns an approximation. The browser may evict best-effort storage under memory pressure without warning. Critical data that exists only in IndexedDB can vanish.',
          ],
        },
        {
          type: 'table',
          headers: ['Common mistake', 'Symptom', 'Fix'],
          rows: [
            ['One giant blob in a single record', 'Every read/write clones the entire state; O(total) per operation', 'Split into individual records with key paths; use stores and indexes'],
            ['Index on every field', 'Writes slow down linearly with index count; migration complexity grows', 'Index only fields that appear in actual queries'],
            ['Ignoring QuotaExceededError', 'Writes silently fail; app state diverges from what user sees', 'Catch QuotaExceededError; compact, evict old caches, or warn user'],
            ['Non-idempotent outbox mutations', 'Network retry replays a mutation twice; data corrupted', 'Attach an idempotency key to every outbox entry; server deduplicates'],
            ['Awaiting unrelated async work inside a transaction', 'Transaction auto-commits before next request; subsequent operations fail', 'Keep all transaction work synchronous; do async preparation before opening the transaction'],
            ['Skipping onblocked handler', 'Schema upgrade hangs indefinitely; new app version never loads', 'Listen for blocked event; prompt user to close old tabs or reload'],
          ],
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'What it covers'],
          rows: [
            ['W3C, "Indexed Database API 3.0" (w3.org/TR/IndexedDB)', 'The specification: object stores, indexes, transactions, key ranges, cursors, structured clone, upgrade lifecycle'],
            ['MDN, "IndexedDB API" (developer.mozilla.org)', 'Practical guide: tutorials, API reference for IDBObjectStore, IDBIndex, IDBKeyRange, IDBCursor, IDBTransaction'],
            ['MDN, "Storage quotas and eviction criteria"', 'How browsers manage origin storage: quota limits, best-effort vs persistent, eviction policy'],
            ['Chrome DevTools, "Application > Storage"', 'Inspect IndexedDB databases, stores, indexes, and records in the browser; useful for debugging schema and data'],
            ['Jake Archibald, "IDB" library (github.com/nicolo-ribaudo/idb)', 'Thin promise wrapper over IndexedDB; demonstrates idiomatic async usage patterns'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: study B-Trees and Database Indexing for the ordered-access model that IndexedDB object stores implement internally, and Structured Clone Transferable Objects for the serialization boundary between JavaScript heap and stored values.',
            'Extension: study Local-First Sync Engine and Background Sync Outbox Queue for the offline mutation patterns that depend on IndexedDB transactional writes.',
            'Worker integration: study Web Workers and Service Workers for moving IndexedDB access off the main thread, and Web Locks API Lock Manager for coordinating multi-tab access to shared IndexedDB state.',
            'Alternative storage: study OPFS Origin Private File System for high-throughput byte-level storage, Cache Storage Versioned Precache for request/response caching, and Browser Storage Quota Eviction Manager for understanding the budget IndexedDB operates within.',
          ],
        },
      ],
    },
  ],
};
