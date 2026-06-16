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
      heading: 'What it is',
      paragraphs: [
        'The Origin Private File System, or OPFS, is a private file-system endpoint for a web origin. Code gets the root with navigator.storage.getDirectory(), then creates directory and file handles below it. Unlike a user-picked local folder, OPFS is not directly visible to the user; it is app-private browser storage.',
        'MDN describes OPFS as optimized for performance and in-place write access: https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system. web.dev frames it as an origin-specific virtual filesystem for apps that need file-like storage: https://web.dev/articles/origin-private-file-system.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The asynchronous File System API gives directory and file handles. For OPFS files, createSyncAccessHandle returns a FileSystemSyncAccessHandle in a dedicated Web Worker. That handle supports offset-based reads and writes, truncation, flush, and close, letting a worker treat a file as a byte-addressed store.',
        'The worker restriction matters. Synchronous I/O on the main thread would block rendering and input. A good architecture sends small messages from the page to a dedicated storage worker; the worker owns handle lifetime, byte-range operations, flush boundaries, and close.',
      ],
    },
    {
      heading: 'Data structures behind it',
      paragraphs: [
        'OPFS is not a record database. It is closer to a private file tree plus byte arrays. That makes it a natural home for embedded SQLite or Wasm databases, browser IDE project stores, media chunk caches, append logs, page files, B-tree pages, free-space bitmaps, and write-ahead logs.',
        'The contrast with IndexedDB Object Store Case Study is useful. IndexedDB gives ordered records, indexes, transactions, and cursors. OPFS gives byte placement and file layout. Cache Storage gives Request to Response maps. A serious browser app often uses all three for different storage shapes.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A browser CAD app stores a project in OPFS. The project directory contains manifest.json, model.bin, assets/, and a journal file. The page edits the scene graph in memory. A dedicated worker receives edit batches, appends them to the journal, writes dirty binary pages to model.bin by offset, flushes at commit boundaries, and closes handles on project unload.',
        'The same pattern works for a browser IDE or Wasm SQLite database. The page owns UI and commands. The worker owns file handles and I/O serialization. IndexedDB stores searchable project metadata. Cache Storage stores offline shell assets. File picker export gives the user a visible backup outside origin-private storage.',
      ],
    },
    {
      heading: 'Cost, quota, and risk',
      paragraphs: [
        'OPFS still counts against browser-managed origin storage. Browser Storage Quota & Eviction Manager covers the shared quota ledger in more detail. Apps should call navigator.storage.estimate(), compact or vacuum file layouts, request persistent storage when justified, and handle quota failures. User settings, Clear-Site-Data, browser eviction, private browsing modes, and profile resets can remove the data.',
        'Fast local I/O is also a privacy surface. The 2026 FROST paper showed that OPFS timing can be used for remote SSD-contention side-channel measurements from JavaScript: https://hannesweissteiner.com/pdfs/frost.pdf. That does not mean every OPFS app is malicious, but it means storage-heavy designs deserve abuse review, rate limits, and awareness of browser mitigations.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN OPFS at https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system, MDN File System API at https://developer.mozilla.org/en-US/docs/Web/API/File_System_API, MDN createSyncAccessHandle at https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createSyncAccessHandle, MDN FileSystemSyncAccessHandle at https://developer.mozilla.org/en-US/docs/Web/API/FileSystemSyncAccessHandle, the File System Standard at https://fs.spec.whatwg.org/, web.dev OPFS at https://web.dev/articles/origin-private-file-system, and WebKit OPFS notes at https://webkit.org/blog/12257/the-file-system-access-api-with-origin-private-file-system/.',
        'Study next: IndexedDB Object Store Case Study, Cache Storage Versioned Precache, Browser Storage Quota & Eviction Manager, Web Workers: A Second Thread, Structured Clone & Transferables, WebAssembly Linear Memory Case Study, SQLite B-Tree & Pager, Write-Ahead Log, fsync Rename Crash Consistency, File Descriptor Table & Open File Description, Linux Page Cache XArray, Browser Scheduler postTask Priority Queue, PerformanceObserver Long Task Attribution, and Data Leakage.',
      ],
    },
  ],
};
