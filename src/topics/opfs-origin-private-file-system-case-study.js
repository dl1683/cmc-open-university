// Origin Private File System: origin-scoped directory handles, OPFS files,
// worker-only sync access handles, byte ranges, flush, quota, and privacy risk.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'opfs-origin-private-file-system-case-study',
  title: 'OPFS Origin Private File System',
  category: 'Systems',
  summary: 'A browser storage case study: OPFS directory handles, private origin files, worker-only sync access handles, byte-range writes, flush, quota, and side-channel risk.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['handle tree', 'sync access', 'quota and risk'], defaultValue: 'handle tree' },
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

function opfsGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'origin', label: 'origin', x: 0.7, y: 4.0, note: notes.origin ?? 'site' },
      { id: 'storage', label: 'storage', x: 2.2, y: 4.0, note: notes.storage ?? 'getDir' },
      { id: 'root', label: 'root', x: 3.7, y: 4.0, note: notes.root ?? 'dir' },
      { id: 'dir', label: 'project', x: 5.3, y: 5.4, note: notes.dir ?? 'dir' },
      { id: 'file', label: 'file', x: 5.3, y: 2.6, note: notes.file ?? 'bytes' },
      { id: 'worker', label: 'worker', x: 7.0, y: 4.0, note: notes.worker ?? 'I/O' },
      { id: 'handle', label: 'sync h', x: 8.4, y: 4.0, note: notes.handle ?? 'exclusive' },
      { id: 'disk', label: 'disk', x: 9.6, y: 4.0, note: notes.disk ?? 'browser' },
    ],
    edges: [
      { id: 'e-origin-storage', from: 'origin', to: 'storage', weight: '' },
      { id: 'e-storage-root', from: 'storage', to: 'root', weight: '' },
      { id: 'e-root-dir', from: 'root', to: 'dir', weight: 'get' },
      { id: 'e-root-file', from: 'root', to: 'file', weight: 'get' },
      { id: 'e-file-worker', from: 'file', to: 'worker', weight: 'post' },
      { id: 'e-worker-handle', from: 'worker', to: 'handle', weight: 'open' },
      { id: 'e-handle-disk', from: 'handle', to: 'disk', weight: 'flush' },
    ],
  }, { title });
}

function byteGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'page', label: 'page', x: 0.7, y: 4.0, note: notes.page ?? 'UI' },
      { id: 'worker', label: 'worker', x: 2.2, y: 4.0, note: notes.worker ?? 'dedicated' },
      { id: 'open', label: 'open', x: 3.6, y: 5.4, note: notes.open ?? 'sync h' },
      { id: 'read', label: 'read', x: 5.2, y: 5.4, note: notes.read ?? 'offset' },
      { id: 'write', label: 'write', x: 5.2, y: 2.6, note: notes.write ?? 'offset' },
      { id: 'flush', label: 'flush', x: 6.8, y: 4.0, note: notes.flush ?? 'persist' },
      { id: 'close', label: 'close', x: 8.2, y: 4.0, note: notes.close ?? 'release' },
      { id: 'file', label: 'file', x: 9.5, y: 4.0, note: notes.file ?? 'blocks' },
    ],
    edges: [
      { id: 'e-page-worker', from: 'page', to: 'worker', weight: 'msg' },
      { id: 'e-worker-open', from: 'worker', to: 'open', weight: '' },
      { id: 'e-open-read', from: 'open', to: 'read', weight: 'buf' },
      { id: 'e-open-write', from: 'open', to: 'write', weight: 'buf' },
      { id: 'e-read-flush', from: 'read', to: 'flush', weight: '' },
      { id: 'e-write-flush', from: 'write', to: 'flush', weight: 'dirty' },
      { id: 'e-flush-close', from: 'flush', to: 'close', weight: '' },
      { id: 'e-close-file', from: 'close', to: 'file', weight: '' },
    ],
  }, { title });
}

function* handleTree() {
  yield {
    state: opfsGraph('OPFS starts at navigator.storage.getDirectory()'),
    highlight: { active: ['origin', 'storage', 'root', 'e-origin-storage', 'e-storage-root'], compare: ['disk'] },
    explanation: 'Origin Private File System gives each origin a private virtual file system. Code asks StorageManager for the root directory handle, then creates directory and file handles below it.',
    invariant: 'OPFS is origin-private storage, not a user-visible folder picker.',
  };

  yield {
    state: opfsGraph('Directory and file handles form a small file tree', { root: '/', dir: 'db dir', file: 'wal.bin' }),
    highlight: { active: ['root', 'dir', 'file', 'e-root-dir', 'e-root-file'], found: ['origin'] },
    explanation: 'The tree is explicit: directory handles contain child directories and files; file handles point at byte content. The API shape is closer to a filesystem than to IndexedDB object stores.',
  };

  yield {
    state: labelMatrix(
      'Storage choices',
      [
        { id: 'idb', label: 'IDB' },
        { id: 'cache', label: 'Cache' },
        { id: 'opfs', label: 'OPFS' },
        { id: 'picker', label: 'picker' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'best', label: 'best' },
      ],
      [
        ['records', 'queries'],
        ['Req/Resp', 'offline'],
        ['files', 'bytes'],
        ['user file', 'export'],
      ],
    ),
    highlight: { active: ['opfs:shape', 'opfs:best'], compare: ['idb:shape', 'cache:shape'] },
    explanation: 'IndexedDB is for structured records and indexes. Cache Storage is for HTTP-like responses. OPFS is for app-private files, byte layouts, chunks, embedded databases, editors, and media caches.',
  };

  yield {
    state: opfsGraph('The handle can cross to a dedicated worker for I/O', { file: 'db.sqlite', worker: 'worker', handle: 'sync h', disk: 'blocks' }),
    highlight: { active: ['file', 'worker', 'handle', 'disk', 'e-file-worker', 'e-worker-handle', 'e-handle-disk'], compare: ['dir'] },
    explanation: 'MDN documents createSyncAccessHandle as available only in dedicated workers for OPFS files. That keeps synchronous byte I/O off the main UI thread.',
  };

  yield {
    state: labelMatrix(
      'Handle rules',
      [
        { id: 'scope', label: 'scope' },
        { id: 'ui', label: 'UI' },
        { id: 'worker', label: 'worker' },
        { id: 'path', label: 'path' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['origin', 'sandbox'],
        ['async', 'no block'],
        ['sync', 'fast I/O'],
        ['priv', 'hidden'],
      ],
    ),
    highlight: { active: ['scope:rule', 'worker:rule'], compare: ['ui:rule'], found: ['path:reason'] },
    explanation: 'The security and UX contract is clear: the origin gets private storage without a user picker, but synchronous fast access is pushed into workers where blocking is less harmful.',
  };
}

function* syncAccess() {
  yield {
    state: byteGraph('A sync access handle reads and writes byte ranges'),
    highlight: { active: ['worker', 'open', 'read', 'write', 'e-worker-open', 'e-open-read', 'e-open-write'], compare: ['page'] },
    explanation: 'A FileSystemSyncAccessHandle exposes offset-based read and write calls. That makes OPFS useful for database pages, binary project files, append logs, and chunk stores.',
    invariant: 'A file becomes an address space: offset plus length.',
  };

  yield {
    state: labelMatrix(
      'Byte layout',
      [
        { id: 'hdr', label: 'header' },
        { id: 'pages', label: 'pages' },
        { id: 'wal', label: 'WAL' },
        { id: 'free', label: 'free' },
      ],
      [
        { id: 'range', label: 'range' },
        { id: 'job', label: 'job' },
      ],
      [
        ['0-4k', 'metadata'],
        ['4k..N', 'B-tree'],
        ['append', 'recovery'],
        ['bitmap', 'reuse'],
      ],
    ),
    highlight: { active: ['hdr:range', 'pages:job', 'wal:job'], found: ['free:job'] },
    explanation: 'Once the app owns offsets, classic storage structures become possible in the browser: page headers, B-tree pages, append-only WAL segments, and free-space maps.',
  };

  yield {
    state: byteGraph('flush and close are part of the durability contract', { write: 'dirty', flush: 'flush()', close: 'release', file: 'stable-ish' }),
    highlight: { active: ['write', 'flush', 'close', 'file', 'e-write-flush', 'e-flush-close', 'e-close-file'], compare: ['read'] },
    explanation: 'The sync handle has flush and close operations. Treat them like explicit boundaries in a browser storage protocol, while remembering that final physical durability is still browser and storage-stack dependent.',
  };

  yield {
    state: labelMatrix(
      'Embedded DB case',
      [
        { id: 'open', label: 'open' },
        { id: 'read', label: 'read' },
        { id: 'write', label: 'write' },
        { id: 'commit', label: 'commit' },
        { id: 'close', label: 'close' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['excl', 'held'],
        ['buf', 'bounds'],
        ['dirty', 'tear'],
        ['WAL', 'crash'],
        ['close', 'leak'],
      ],
    ),
    highlight: { active: ['open:state', 'write:state', 'commit:state'], compare: ['commit:risk'] },
    explanation: 'An embedded database or Wasm runtime needs its usual storage discipline: exclusive access, bounds checks, page buffers, WAL or journal ordering, flush, and release.',
  };

  yield {
    state: byteGraph('The page talks to the worker, not directly to sync I/O', { page: 'query', worker: 'I/O loop', read: 'page read', write: 'page write', flush: 'commit', file: 'OPFS' }),
    highlight: { active: ['page', 'worker', 'read', 'write', 'flush', 'file', 'e-page-worker'], found: ['close'] },
    explanation: 'A polished architecture keeps UI state on the page, storage I/O inside a dedicated worker, and messages small. The worker owns the handle lifetime and serializes byte-range operations.',
  };
}

function* quotaAndRisk() {
  yield {
    state: labelMatrix(
      'Quota model',
      [
        { id: 'estimate', label: 'estimate' },
        { id: 'persist', label: 'persist' },
        { id: 'compact', label: 'compact' },
        { id: 'export', label: 'export' },
      ],
      [
        { id: 'tool', label: 'tool' },
        { id: 'why', label: 'why' },
      ],
      [
        ['estimate()', 'budget'],
        ['persist()', 'less evict'],
        ['vacuum', 'free space'],
        ['picker', 'user copy'],
      ],
    ),
    highlight: { active: ['estimate:tool', 'compact:tool'], found: ['export:tool'], compare: ['persist:tool'] },
    explanation: 'OPFS still lives under browser storage management. Serious apps estimate usage, compact files, request persistence when justified, and offer export for user-critical data.',
    invariant: 'Origin-private does not mean quota-free or backup-safe.',
  };

  yield {
    state: opfsGraph('Clear-site-data or user settings can remove the origin store', { origin: 'site data', root: 'deleted', file: 'gone', disk: 'quota' }),
    highlight: { removed: ['root', 'dir', 'file'], active: ['origin', 'storage', 'disk'] },
    explanation: 'Users and browsers can clear origin storage. OPFS is excellent for app-private working data, but critical user records need sync, export, or another recovery story.',
  };

  yield {
    state: labelMatrix(
      'Failure audit',
      [
        { id: 'support', label: 'support' },
        { id: 'quota', label: 'quota' },
        { id: 'lock', label: 'lock' },
        { id: 'crash', label: 'crash' },
        { id: 'privacy', label: 'privacy' },
      ],
      [
        { id: 'sym', label: 'symptom' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['no API', 'fallback'],
        ['write fail', 'compact'],
        ['handle held', 'close'],
        ['torn state', 'journal'],
        ['timing leak', 'review'],
      ],
    ),
    highlight: { active: ['support:fix', 'quota:fix', 'crash:fix'], found: ['privacy:fix'], removed: ['lock:sym'] },
    explanation: 'The storage audit is broader than API calls. It covers support detection, quota failures, leaked handles, crash recovery, and privacy review for high-rate disk timing.',
  };

  yield {
    state: byteGraph('FROST showed OPFS timing can expose SSD contention signals', { page: 'attacker', worker: 'timing', read: 'large read', write: 'none', flush: 'latency', file: 'SSD load' }),
    highlight: { active: ['page', 'worker', 'read', 'flush', 'file'], compare: ['write'] },
    explanation: 'A 2026 FROST paper demonstrated that OPFS can be used for remote SSD-contention timing from JavaScript. Treat fast local I/O as a privacy and abuse surface, not only a performance feature.',
  };

  yield {
    state: labelMatrix(
      'Ship checklist',
      [
        { id: 'detect', label: 'detect' },
        { id: 'worker', label: 'worker' },
        { id: 'journal', label: 'journal' },
        { id: 'quota', label: 'quota' },
        { id: 'privacy', label: 'privacy' },
      ],
      [
        { id: 'gate', label: 'gate' },
        { id: 'fail', label: 'fail' },
      ],
      [
        ['feature', 'crash'],
        ['sync', 'UI lag'],
        ['replay', 'corrupt'],
        ['quota', 'lost'],
        ['review', 'abuse'],
      ],
    ),
    highlight: { active: ['detect:gate', 'worker:gate', 'journal:gate'], found: ['privacy:gate'], compare: ['quota:fail'] },
    explanation: 'The complete case is a browser IDE or CAD app: feature-detect OPFS, route sync I/O through a worker, journal edits, bound quota, export projects, and review timing abuse before shipping.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'handle tree') yield* handleTree();
  else if (view === 'sync access') yield* syncAccess();
  else if (view === 'quota and risk') yield* quotaAndRisk();
  else throw new InputError('Pick an OPFS view.');
}

export const article = {
  sections: [
    {
      heading: `Why this exists`,
      paragraphs: [
        `Some browser apps need files, not just records. An IDE wants project folders and build caches. A CAD tool wants large binary project files. A media editor wants chunks and temporary renders. A Wasm database wants pages, a journal, and byte-range writes. IndexedDB can store blobs and structured records, but it is awkward when the application wants to manage offsets, free space, and append logs directly.`,
        `The Origin Private File System, or OPFS, exists for that file-shaped workload. It gives each origin a private virtual file tree managed by the browser. The user does not pick a visible folder, and other origins cannot browse the files. The app gets a root directory handle from navigator.storage.getDirectory(), creates child directories and files, and uses OPFS as fast app-private working storage.`,
      ],
    },
    {
      heading: `The obvious approach`,
      paragraphs: [
        `The tempting first version is one giant JSON object in IndexedDB. That works for a prototype and fails as the file grows. Every save becomes a deserialize, edit, serialize, and write cycle. A small page change can rewrite megabytes. Crash recovery becomes unclear because the app has no clean commit boundary. The same problem appears when a tool stores a whole project as one blob and repeatedly replaces it.`,
        `Another tempting version is to use OPFS as if it were a user-visible backup folder. That is wrong in the other direction. OPFS is origin-private browser storage, not a document directory. The browser manages quota. Users or site-data policies can remove it. Critical user work still needs sync, export, or an explicit save path through a user-facing file picker.`,
      ],
    },
    {
      heading: `Core model`,
      paragraphs: [
        `The core model is a private directory tree plus byte-addressed files. Directory handles contain child directories and file handles. File handles point at byte content. The asynchronous File System API can create, remove, and traverse the tree. For OPFS files, createSyncAccessHandle can open a FileSystemSyncAccessHandle in a dedicated worker, giving synchronous reads and writes by offset.`,
        `That worker-only sync handle is the central design choice. Synchronous I/O is convenient for embedded databases and storage engines, but blocking the browser's main thread would freeze the UI. OPFS pushes that style of I/O into a dedicated worker, where a storage loop can own handle lifetimes, serialize operations, and answer page requests from the UI by message.`,
      ],
    },
    {
      heading: `Byte layout`,
      paragraphs: [
        `Once an app owns offsets, browser storage starts to look like classic systems programming. Byte zero can hold a file header. The next region can hold fixed-size pages. A write-ahead log can append commit records. A free-space map can track reusable holes. A search index can store segment files. A media editor can store chunks without rewriting an entire project for a small edit.`,
        `This does not mean every app should invent a storage engine. It means OPFS can host storage engines that already think in pages and logs, including Wasm ports of databases. The important invariant is offset plus length. A read or write should name a byte range, and the storage layer should know what structure lives there.`,
      ],
    },
    {
      heading: `What the visual proves`,
      paragraphs: [
        `The handle-tree visual proves the security boundary. The origin gets a private root. Directory and file handles live below that root. The nodes do not represent a user browsing local disk; they represent browser-managed storage scoped to a site. That distinction matters for permissions, backup, privacy, and user expectations.`,
        `The sync-access visual proves the concurrency boundary. The page talks to a worker, and the worker owns the handle. Reads and writes name offsets, flush marks a persistence boundary, and close releases exclusive state. The quota-and-risk visual adds the operational boundary: storage is private, but not infinite; fast, but not automatically durable; local, but still relevant to privacy analysis.`,
      ],
    },
    {
      heading: `Worker ownership`,
      paragraphs: [
        `A clean architecture treats the worker as a storage service. The page sends commands such as open project, read page, append operation, commit, compact, export, and close. The worker keeps the sync handle private, validates offsets and sizes, serializes writes, and reports errors in a small protocol. UI components should not hold handles or write arbitrary ranges.`,
        `This worker ownership also makes testing easier. The storage protocol can simulate quota errors, torn writes, crash points, and unsupported APIs. The page can stay responsive while a compaction job runs. If the worker crashes, the app has one place to reopen handles and replay a journal instead of many components with half-owned file state.`,
      ],
    },
    {
      heading: `Durability and recovery`,
      paragraphs: [
        `OPFS exposes flush and close, but the app still needs a recovery protocol. A database-like workload should write intent before data when it needs crash recovery, flush at commit boundaries, and replay or roll back on startup. A project-file workload may write a new version and then update a manifest. A cache can be more relaxed because it can refetch missing data.`,
        `The right durability promise depends on the product. Temporary render files can be disposable. A user's only copy of a project cannot be. For important data, OPFS should be paired with export, sync, or a visible file save. The browser storage stack is a useful local substrate, not a substitute for a product-level backup story.`,
      ],
    },
    {
      heading: `Quota and lifecycle`,
      paragraphs: [
        `OPFS lives inside browser storage management. Serious apps should call navigator.storage.estimate(), keep their own usage index, compact or vacuum deleted ranges, and handle quota failures as normal events. Requesting persistent storage can reduce eviction risk in browsers that support it, but it is not a magic backup guarantee.`,
        `Lifecycle matters too. Users can clear site data. Enterprise policies can wipe browser profiles. Private browsing modes may have different persistence behavior. A good app exposes storage status, export controls, and clear failure messages. It should never let users believe origin-private working storage is the same thing as a synced account or a file saved in their documents folder.`,
      ],
    },
    {
      heading: `Where it wins`,
      paragraphs: [
        `OPFS wins for browser IDEs, CAD tools, media editors, embedded SQLite, local search indexes, package caches, large project files, and Wasm runtimes that need byte-range I/O. A good offline app may use OPFS for file-shaped state, IndexedDB for searchable metadata, Cache Storage for HTTP-style assets, and a file picker or cloud sync path for user-owned exports.`,
        `It is less useful when the data is naturally relational or document-shaped and the app needs indexes, queries, and transactions more than byte offsets. In those cases IndexedDB may be the primary store. OPFS is also a poor fit when browser support is missing, when local data loss is unacceptable without sync, or when the team is not prepared to design recovery and compaction.`,
      ],
    },
    {
      heading: `Failure modes`,
      paragraphs: [
        `The first failure mode is a leaked handle. If code opens a sync access handle and never closes it, other operations can block or fail. The second is quota surprise: writes fail after a project grows, and the app has no compaction or export path. The third is torn state: a crash lands between related writes, and startup has no journal or manifest rule to decide what is valid.`,
        `Privacy is another failure mode. Fast local I/O can become a side-channel surface. The FROST result described OPFS timing as a way to observe SSD contention signals from JavaScript. Storage-heavy designs should be reviewed for abuse, rate limits, timing precision, and browser mitigations. Performance features are also measurement features.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Primary sources are MDN's OPFS guide at https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system, MDN's File System API reference, MDN createSyncAccessHandle, MDN FileSystemSyncAccessHandle, the File System Standard at https://fs.spec.whatwg.org/, web.dev's OPFS article at https://web.dev/articles/origin-private-file-system, and WebKit's OPFS notes at https://webkit.org/blog/12257/the-file-system-access-api-with-origin-private-file-system/.`,
        `Study IndexedDB Object Store Case Study for record-shaped browser storage, Cache Storage Versioned Precache for HTTP response caching, Browser Storage Quota and Eviction Manager for lifecycle pressure, Web Workers: A Second Thread for worker ownership, Structured Clone and Transferables for page-worker messages, WebAssembly Linear Memory Case Study for Wasm storage clients, SQLite B-Tree and Pager for page files, Write-Ahead Log for recovery, fsync Rename Crash Consistency for durability thinking, and Data Leakage for privacy boundaries.`,
      ],
    },
  ],
};
