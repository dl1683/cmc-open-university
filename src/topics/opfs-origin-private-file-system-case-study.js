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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as an execution trace for the Origin Private File System, usually shortened to OPFS. OPFS is browser-managed file storage scoped to one origin, which means one scheme, host, and port. It is private to that origin and is not a user-visible folder.',
        {type:'callout', text:'OPFS makes browser files practical for storage engines by pairing origin-private byte storage with worker-owned synchronous access handles.'},
        'Active items show the current storage decision, such as opening a file, writing a byte range, flushing, or checking quota. Found markers show state that is now valid. Removed markers show invalid handles, failed writes, or storage state that must be recovered.',
        'The safe inference rule is ownership. The page should send storage commands to a worker, and the worker should own the synchronous access handle. That keeps blocking file I/O away from the browser main thread.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Some browser apps need files, not only records. An IDE wants project folders and build caches. A CAD tool wants large binary project files. A media editor wants chunks and temporary renders. A Wasm database wants pages, a journal, and byte-range writes.',
        'IndexedDB can store records and blobs, but it is awkward when the application wants to manage offsets, free space, append logs, and page replacement directly. Rewriting a whole blob for a small page change wastes work.',
        'OPFS exists for file-shaped local workloads. The app asks for a private root directory, creates files and child directories, and uses those files as fast working storage managed by the browser.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is one large JSON object or blob in IndexedDB. That works for a prototype. It fails when every small edit becomes deserialize, modify, serialize, and rewrite.',
        'Another approach is to use a visible user folder through a file picker for everything. That is right when the user is saving a document they own, but it is clumsy for internal caches, database pages, temporary renders, and package indexes.',
        'A third approach is to treat OPFS as a backup folder. That is wrong. OPFS is origin-private browser storage. Users can clear site data, quota can be exceeded, and product-level sync or export is still needed for important work.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is storage shape. A storage engine wants byte ranges, commit boundaries, free-space reuse, and recovery after a crash. A record store or whole-blob replace path hides those controls.',
        'Main-thread blocking is another wall. Synchronous file I/O is convenient for a database loop, but running it on the UI thread would freeze rendering and input. OPFS solves this by allowing sync access handles in workers.',
        'Durability is the final wall. Flush and close are useful primitives, but they are not a product backup strategy. An app still needs a journal, manifest rule, export path, sync path, or cache rebuild plan depending on data importance.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'OPFS gives a private directory tree plus byte-addressed files. Directory handles contain child directories and file handles. File handles point at bytes. A storage engine can read and write specific offsets instead of replacing whole objects.',
        'The worker-only synchronous access handle is the key boundary. It lets storage code use direct reads, writes, truncate, flush, and close operations while the page remains responsive. The worker becomes the storage service.',
        'The invariant is that file structure belongs to the storage layer. UI components should ask for operations such as read page, append record, commit, compact, export, and close. They should not write arbitrary byte ranges themselves.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The app calls navigator.storage.getDirectory() to get the OPFS root. It creates or opens files below that root. For file-shaped workloads, it passes commands to a dedicated worker that opens a sync access handle.',
        'The worker reads and writes byte ranges by offset. Byte zero might hold a header, later regions might hold fixed-size pages, and another file might hold a write-ahead log. Flush marks the point where the app asks the browser to persist pending writes.',
        'The app also tracks quota and lifecycle. It can call storage estimate APIs, compact deleted ranges, handle write failures, and expose export or sync controls. OPFS is a substrate, not the entire data strategy.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The security argument starts with origin scoping. Files are private to the origin that created them, and other origins cannot browse the directory. The browser mediates access instead of exposing an arbitrary local path.',
        'The responsiveness argument starts with worker ownership. Synchronous reads and writes block the worker, not the UI thread. The page can continue rendering while the worker serializes storage operations.',
        'The correctness argument is recovery by protocol. If the storage layer writes intent before data and flushes at commit boundaries, startup can replay or roll back incomplete work. OPFS provides byte operations; the app provides the commit rules.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'OPFS saves rewrite cost when edits are small relative to the file. Updating one 4 KB page in a 200 MB project file can be a 4 KB write plus metadata work instead of a 200 MB blob replacement.',
        'The cost is storage-engine responsibility. The app now owns page layout, free-space tracking, compaction, quota handling, crash recovery, and export semantics. Those are real systems problems.',
        'Quota behavior is part of cost. If a project grows from 500 MB to 2 GB, writes may fail depending on browser storage policy and device pressure. A serious app should treat quota failure as a normal error path, not an exception nobody sees.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'OPFS fits browser IDEs, CAD tools, media editors, embedded SQLite, local search indexes, package caches, large project files, and Wasm runtimes that need byte-range I/O.',
        'A good offline app can combine storage systems. OPFS can hold page files and render caches. IndexedDB can hold searchable metadata. Cache Storage can hold HTTP responses. A file picker or cloud sync path can hold user-owned exports.',
        'It is strongest when the data is file-shaped and local. If the app mainly needs indexed records, transactions over objects, or simple key-value persistence, IndexedDB may be the better primary store.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when handles are leaked or ownership is unclear. A sync access handle that is never closed can block other work or leave the storage layer in a confused state.',
        'It fails when the app treats browser storage as permanent backup. Users can clear site data, profiles can be wiped, private browsing can behave differently, and quota pressure can remove data. Important user work needs export or sync.',
        'It can create privacy and side-channel concerns. Fast local I/O exposes timing behavior that researchers have studied for storage contention signals. Storage-heavy designs should review rate limits, timing precision, and browser mitigations.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A browser SQLite database stores 100,000 rows in 4 KB pages. The database file is 400 MB. A user edits one note, changing one leaf page and one index page, so the useful data change is about 8 KB.',
        'With whole-blob storage, saving can require reading and writing hundreds of megabytes. With OPFS byte writes, the worker writes two 4 KB pages and appends a small journal record, then flushes at the commit boundary.',
        'If quota is 1 GB and current usage is 820 MB, a compaction job that needs a temporary 250 MB copy will fail. The storage worker should detect that before starting, compact in smaller segments or ask the user to export and clear space.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are MDN on the Origin Private File System, MDN File System API references, createSyncAccessHandle documentation, the File System Standard, web.dev OPFS guidance, and WebKit OPFS notes. Use them for current browser behavior and support limits.',
        'Study IndexedDB for record-shaped browser storage, Cache Storage for HTTP response caching, Web Workers for ownership, Structured Clone for page-worker messages, WebAssembly Linear Memory for Wasm clients, SQLite Pager for page files, and Write-Ahead Log for recovery.',
      ],
    },
  ],
};
