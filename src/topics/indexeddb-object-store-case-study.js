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
      heading: 'Why this exists',
      paragraphs: [
        "A serious web app needs storage that survives reloads, works offline, and answers more than one query shape. An in-memory Map disappears when the page closes. localStorage gives synchronous string slots, which is useful for small settings but wrong for large structured data. IndexedDB exists because browser apps sometimes need a real local database.",
        "The Indexed Database API models data as records with keys and values, object stores, indexes, transactions, key ranges, cursors, and schema versions. That makes it a data-structure topic, not just a browser API. A local-first editor, mail client, map app, or analytics console can keep durable structured state near the user while the network is slow, unavailable, or deliberately avoided.",
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        "The first design most people try is one JSON blob. Load the whole app state, mutate it in JavaScript, stringify it, and write it back. That works for a tiny todo list. It feels simple because there is only one persistence path and no schema migration plan.",
        "The blob breaks as soon as the app needs pagination, offline replay, partial updates, multiple tabs, or search by a secondary field. Every edit rewrites too much. Every query scans too much. A crash between mutation and write can lose too much. The browser main thread can also pay for serialization at exactly the moment the UI needs to stay responsive.",
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        "The wall is access paths. A browser database is useful only if the app can reach the needed records without materializing everything. A recents view wants order by updatedAt. A detail view wants exact lookup by id. A sync engine wants pending mutations by status and sequence. One blob gives none of those paths.",
        "Indexing everything is not the answer either. Each index is another ordered projection the browser must maintain on writes and migrate during upgrades. Good IndexedDB schema starts from questions: which exact lookup, which range scan, which cursor page, which queue drain, and which count must be fast? The stores and indexes should match those questions.",
      ],
    },
    {
      heading: 'Core model',
      paragraphs: [
        "The core abstraction is an ordered object store. Each record has a key and a value. The key is the durable address and the main sort axis. The value is structured data copied through the structured clone algorithm, not a live object reference into the JavaScript heap.",
        "An index is an alternate sorted projection over records in an object store. A document can be keyed by id while an updatedAt index supports a recents view and a syncStatus index supports a pending-sync view. The same stored record becomes reachable through several ordered routes. The invariant is that writes must keep the primary store and every affected index consistent within the transaction.",
      ],
    },
    {
      heading: 'Keys, ranges, and cursors',
      paragraphs: [
        "Keys are not incidental metadata. They determine lookup and order. A key path can extract the key from the stored value, such as id. A key generator can create monotonically increasing keys. Compound keys can encode a query path, such as [projectId, updatedAt], when the app needs ordered records inside a partition.",
        "Key ranges turn sorted order into an API. A range can mean one key, a bounded interval, all keys after a prefix-like lower bound, or all pending operations after a sequence number. Cursors matter because they let the app walk that range gradually, update UI progressively, stop after a page, or process a queue without pulling the whole result set into memory.",
      ],
    },
    {
      heading: 'Transactions and upgrades',
      paragraphs: [
        "Every useful read or write happens inside a transaction. A readonly transaction gives a consistent view over its scope. A readwrite transaction changes records as a group or aborts them as a group. That group boundary is the difference between local durability and a pile of race-prone callback code.",
        "Schema upgrades are versioned. Opening a higher database version runs a versionchange transaction where stores and indexes can be created, deleted, or migrated. Old open tabs can block the upgrade. Production IndexedDB code needs blocked and versionchange handling, because the user may have several tabs from different app versions open at once.",
      ],
    },
    {
      heading: 'Offline sync pattern',
      paragraphs: [
        "An offline-first app usually keeps at least two stores: the current local view and a durable outbox. When the user edits a document, the app writes the document update and appends a replayable mutation in one transaction. The UI can continue immediately, but the sync engine has an explicit record of what must reach the server.",
        "The atomic boundary matters. If the document update lands without the outbox row, the app can lose sync intent. If the outbox row lands without the document update, replay describes a change the user cannot see locally. IndexedDB is useful here because it lets the app commit both facts together and drain them later through a service worker or foreground sync loop.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        "Imagine a local-first notes app. The docs store is keyed by document id. It has an updatedAt index for the recents list and a projectId, updatedAt compound index for project pages. The outbox store is keyed by mutation sequence. It has a status index so the sync worker can find pending operations quickly.",
        "When a user edits a note offline, the app opens a readwrite transaction over docs and outbox. It updates the note, records a mutation with an idempotency key, and commits. Later, the sync worker opens a cursor over pending outbox entries, sends them to the API, records acknowledgments, and updates local documents with server versions or conflict markers. The same database supports UI reads and durable replay because the access paths were designed together.",
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        "IndexedDB works because it gives the browser app ordered durable records plus transaction scope. Ordered keys make range scans and cursor pagination possible. Secondary indexes make alternate lookup orders possible. Transactions keep related changes from being partially committed. Structured clone turns JavaScript values into stored snapshots instead of shared mutable references.",
        "The correctness argument for an app is schema-specific. If every user-visible mutation and every sync-intent record are committed in the same transaction, the sync engine can recover after a crash. If every screen query has a matching store or index, the UI can avoid whole-database scans. If every schema upgrade is versioned, old data can move forward deliberately instead of being guessed at runtime.",
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        "IndexedDB is asynchronous, but it is not free. Structured clone copies data. Large values can create memory pressure and latency. Indexes add write amplification because each indexed field must be maintained. Long cursor operations can keep resources alive. Large migrations can block startup. Quota limits can reject writes, and browsers may evict best-effort storage under pressure.",
        "The browser also owns scheduling. Requests complete later through events or promises, and transaction lifetimes depend on the event loop. A design that opens a transaction and then waits on unrelated async work can accidentally let the transaction finish before the next operation. Good IndexedDB code keeps transaction work tight and moves expensive parsing, compression, or conflict preparation into workers when needed.",
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        "IndexedDB wins for structured client-side data, offline workflows, large local caches, search indexes, media metadata, map tiles, local-first documents, and durable mutation queues. The fit is strongest when queries are key-shaped or range-shaped and the app can name its access paths ahead of time.",
        "It is also the right tool when storage must be available in workers. MDN notes that IndexedDB is available in Web Workers, which lets an app keep heavy persistence work away from the main UI path. A worker can own database access, batch writes, compact old records, and coordinate sync without blocking pointer input or rendering.",
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        "IndexedDB is not an unlimited file system, a relational database with joins, or a replacement for server reconciliation. It does not make conflicts disappear. It does not remove the need for export, backup, quota handling, or clear-data recovery. For file-like byte storage, OPFS may be a better fit. For small preferences, localStorage or cookies may be simpler.",
        "Common mistakes are storing one giant blob, creating indexes for every field, forgetting multi-tab upgrades, ignoring QuotaExceededError, keeping critical data only in best-effort storage, using non-idempotent outbox mutations, and assuming cursor order matches business order without a key that encodes it.",
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        "Start with a query inventory. Write down every screen and worker job that needs data: get document by id, list recent documents, list project documents by update time, find pending mutations, count failed sync attempts, and delete old cache entries. Build stores and indexes only for those paths.",
        "Treat upgrades like migrations, not initialization. Test old-version databases, blocked tabs, failed upgrades, retry behavior, and downgrade assumptions. Keep mutation records idempotent. Store enough server acknowledgment metadata to know whether a replay is safe. Use navigator.storage.estimate and persistence requests where justified, but design for the user or browser deleting origin data.",
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        "Primary references: Indexed Database API 3.0 at https://www.w3.org/TR/IndexedDB/, MDN IndexedDB API at https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API, IDBObjectStore at https://developer.mozilla.org/en-US/docs/Web/API/IDBObjectStore, IDBIndex at https://developer.mozilla.org/en-US/docs/Web/API/IDBIndex, IDBKeyRange at https://developer.mozilla.org/en-US/docs/Web/API/IDBKeyRange, IDBCursor at https://developer.mozilla.org/en-US/docs/Web/API/IDBCursor, and storage quotas at https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria.",
        "Study B-Trees and Database Indexing for the ordered-access model. Study Local-First Sync Engine, Background Sync Outbox Queue, Service Workers, Web Workers, Structured Clone Transferable Objects, Browser Message Channels, Web Locks API Lock Manager, OPFS Origin Private File System, Cache Storage Versioned Precache, and Browser Storage Quota Eviction Manager for production browser storage design.",
      ],
    },
  ],
};
