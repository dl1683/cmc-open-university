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
      heading: 'What it is',
      paragraphs: [
        'IndexedDB is the browser database API for structured client-side data. It gives a web origin one or more databases, each database contains object stores, and each object store contains records addressed by keys. That makes it a direct browser-facing case study in ordered dictionaries, secondary indexes, transactions, serialization, quota, and offline-first application design.',
        'The Indexed Database API 3.0 specification defines records as key-value pairs and defines indexes over the stored records: https://www.w3.org/TR/IndexedDB/. MDN describes IndexedDB as a low-level API for significant structured client-side data and notes that it can store objects supported by the structured clone algorithm: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API.',
      ],
    },
    {
      heading: 'Data structure model',
      paragraphs: [
        'The core abstraction is an ordered object store. MDN\'s IDBObjectStore reference states that records in an object store are sorted according to their keys: https://developer.mozilla.org/en-US/docs/Web/API/IDBObjectStore. The W3C spec also says an indexed database can be implemented with a persistent B-tree, but the exact browser implementation is not the contract. The contract is the behavior: key lookup, key range scan, cursor iteration, and secondary-index lookup.',
        'An index is an alternate sorted projection over the object store. You might store documents by primary key id, then index by updatedAt for recent documents, by ownerId for a user view, or by syncStatus for a pending queue. That is Database Indexing in the browser: every index speeds a query but adds write cost, schema cost, and migration risk.',
      ],
    },
    {
      heading: 'Transactions and versions',
      paragraphs: [
        'Every read or write runs inside a transaction with a scope and a mode. A readonly transaction can read stores consistently. A readwrite transaction can change records and abort as a group if something fails. Schema changes happen during a versionchange upgrade, where code can create object stores and indexes. Old open tabs matter because they can block an upgrade until those older connections close.',
        'The practical data-structure lesson is that browser storage has concurrency rules. You are not mutating a JavaScript Map in memory; you are asking an asynchronous database to schedule work across tabs, workers, service workers, transactions, storage quota, and browser shutdown.',
      ],
    },
    {
      heading: 'Complete case study: offline document editor',
      paragraphs: [
        'A robust offline editor keeps a docs object store keyed by document id, an index on updatedAt for recents, an index on syncStatus for pending changes, and an outbox object store keyed by monotonically increasing mutation id. The UI reads from IndexedDB immediately, so reloads and airplane mode still show documents. Edits update docs and append outbox mutations in the same readwrite transaction.',
        'A Web Worker can own heavier persistence and query work so large structured clones, compression, search indexing, or conflict preparation do not block the page. Structured Clone & Transferables explains the serialization boundary IndexedDB shares with worker messages. OPFS Origin Private File System covers the byte-addressed file path for embedded databases and large project files. A Service Worker can keep the shell available and can participate in replay, while Background Sync Outbox Queue turns the outbox store into a retryable sync path. Study Local-First Sync Engine Case Study, Web Workers: A Second Thread, Service Workers & Offline-First, Cache Storage Versioned Precache, OPFS Origin Private File System, Write-Ahead Log, and Message Queue next because this is the browser version of durable append-and-retry.',
      ],
    },
    {
      heading: 'Cost and pitfalls',
      paragraphs: [
        'The common mistake is treating IndexedDB like unlimited localStorage. Structured clone has a cost, large objects can be awkward, indexes add write amplification, migrations can strand old tabs, and quota can fail writes. Browser Storage Quota & Eviction Manager expands the quota ledger and recovery paths. MDN documents storage quotas and eviction criteria for browser storage, including the distinction between best-effort and persistent storage: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria.',
        'Another mistake is indexing everything. Each index is a second ordered structure that must be maintained when records change. Good IndexedDB schema design starts from access paths: exact lookup by id, bounded range by time, pending queue by status, cursor for pagination, and only then the object stores and indexes.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary references: Indexed Database API 3.0 at https://www.w3.org/TR/IndexedDB/, MDN IndexedDB API at https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API, IDBObjectStore at https://developer.mozilla.org/en-US/docs/Web/API/IDBObjectStore, IDBIndex at https://developer.mozilla.org/en-US/docs/Web/API/IDBIndex, IDBKeyRange at https://developer.mozilla.org/en-US/docs/Web/API/IDBKeyRange, IDBCursor at https://developer.mozilla.org/en-US/docs/Web/API/IDBCursor, and the structured clone algorithm at https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm.',
        'Practical web platform companions: web.dev on working with IndexedDB at https://web.dev/articles/indexeddb, web.dev on storage choices at https://web.dev/articles/storage-for-the-web, and the WHATWG Storage Standard at https://storage.spec.whatwg.org/. Study B-Trees, Database Indexing, Local-First Sync Engine Case Study, Service Workers & Offline-First, Cache Storage Versioned Precache, OPFS Origin Private File System, Browser Storage Quota & Eviction Manager, Background Sync Outbox Queue, Web Push Subscription Delivery, Web Workers: A Second Thread, Structured Clone & Transferables, Browser Message Channels & Broadcast Coordination, Web Locks API Lock Manager, Cache Invalidation & Versioning, and WebAssembly Linear Memory Case Study next.',
      ],
    },
  ],
};
