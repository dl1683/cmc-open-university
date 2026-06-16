// Browser storage quota: origin usage ledgers, StorageManager estimates,
// best-effort vs persistent modes, eviction pressure, compaction, and export.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'browser-storage-quota-eviction-manager-case-study',
  title: 'Browser Storage Quota & Eviction Manager',
  category: 'Systems',
  summary: 'How browser origins share quota across IndexedDB, Cache Storage, OPFS, and other stores, then survive estimate(), persist(), eviction, compaction, and export gates.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['quota ledger', 'eviction pressure', 'offline app case'], defaultValue: 'quota ledger' },
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

function quotaGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'origin', label: 'origin', x: 0.7, y: 4.0, note: notes.origin ?? 'site' },
      { id: 'idb', label: 'IDB', x: 2.4, y: 5.7, note: notes.idb ?? 'records' },
      { id: 'cache', label: 'Cache', x: 2.4, y: 4.0, note: notes.cache ?? 'responses' },
      { id: 'opfs', label: 'OPFS', x: 2.4, y: 2.3, note: notes.opfs ?? 'files' },
      { id: 'usage', label: 'usage', x: 4.5, y: 4.0, note: notes.usage ?? 'sum' },
      { id: 'quota', label: 'quota', x: 6.2, y: 4.0, note: notes.quota ?? 'limit' },
      { id: 'persist', label: 'persist', x: 7.9, y: 5.2, note: notes.persist ?? 'mode' },
      { id: 'evict', label: 'evict', x: 7.9, y: 2.8, note: notes.evict ?? 'pressure' },
      { id: 'export', label: 'export', x: 9.3, y: 4.0, note: notes.export ?? 'backup' },
    ],
    edges: [
      { id: 'e-origin-idb', from: 'origin', to: 'idb', weight: '' },
      { id: 'e-origin-cache', from: 'origin', to: 'cache', weight: '' },
      { id: 'e-origin-opfs', from: 'origin', to: 'opfs', weight: '' },
      { id: 'e-idb-usage', from: 'idb', to: 'usage', weight: 'bytes' },
      { id: 'e-cache-usage', from: 'cache', to: 'usage', weight: 'bytes' },
      { id: 'e-opfs-usage', from: 'opfs', to: 'usage', weight: 'bytes' },
      { id: 'e-usage-quota', from: 'usage', to: 'quota', weight: 'check' },
      { id: 'e-quota-persist', from: 'quota', to: 'persist', weight: 'ask' },
      { id: 'e-quota-evict', from: 'quota', to: 'evict', weight: 'full' },
      { id: 'e-persist-export', from: 'persist', to: 'export', weight: 'still' },
      { id: 'e-evict-export', from: 'evict', to: 'export', weight: 'need' },
    ],
  }, { title });
}

function evictionGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'disk', label: 'disk', x: 0.8, y: 4.0, note: notes.disk ?? 'low space' },
      { id: 'rank', label: 'rank', x: 2.4, y: 4.0, note: notes.rank ?? 'origins' },
      { id: 'cold', label: 'cold', x: 4.0, y: 5.5, note: notes.cold ?? 'old use' },
      { id: 'warm', label: 'warm', x: 4.0, y: 4.0, note: notes.warm ?? 'active' },
      { id: 'persist', label: 'persist', x: 4.0, y: 2.5, note: notes.persist ?? 'protect' },
      { id: 'delete', label: 'delete', x: 6.1, y: 5.5, note: notes.delete ?? 'clear' },
      { id: 'compact', label: 'compact', x: 6.1, y: 4.0, note: notes.compact ?? 'shrink' },
      { id: 'prompt', label: 'user', x: 6.1, y: 2.5, note: notes.prompt ?? 'manual' },
      { id: 'recover', label: 'recover', x: 8.3, y: 4.0, note: notes.recover ?? 'sync/export' },
    ],
    edges: [
      { id: 'e-disk-rank', from: 'disk', to: 'rank', weight: 'pressure' },
      { id: 'e-rank-cold', from: 'rank', to: 'cold', weight: 'LRU-ish' },
      { id: 'e-rank-warm', from: 'rank', to: 'warm', weight: 'keep' },
      { id: 'e-rank-persist', from: 'rank', to: 'persist', weight: 'skip' },
      { id: 'e-cold-delete', from: 'cold', to: 'delete', weight: 'evict' },
      { id: 'e-warm-compact', from: 'warm', to: 'compact', weight: 'trim' },
      { id: 'e-persist-prompt', from: 'persist', to: 'prompt', weight: 'consent' },
      { id: 'e-delete-recover', from: 'delete', to: 'recover', weight: 'miss' },
      { id: 'e-compact-recover', from: 'compact', to: 'recover', weight: 'ok' },
      { id: 'e-prompt-recover', from: 'prompt', to: 'recover', weight: 'clear' },
    ],
  }, { title });
}

function* quotaLedger() {
  yield {
    state: quotaGraph('Browser quota is shared by an origin storage family'),
    highlight: { active: ['origin', 'idb', 'cache', 'opfs', 'usage', 'e-idb-usage', 'e-cache-usage', 'e-opfs-usage'], compare: ['quota'] },
    explanation: 'Browser storage quota is not one API at a time. IndexedDB, Cache Storage, OPFS, and related stores contribute to the origin usage ledger the browser manages.',
    invariant: 'The unit of pressure is the origin, not your favorite storage API.',
  };

  yield {
    state: labelMatrix(
      'StorageManager calls',
      [
        { id: 'estimate', label: 'estimate' },
        { id: 'persisted', label: 'persisted' },
        { id: 'persist', label: 'persist' },
        { id: 'quotaerr', label: 'QuotaErr' },
      ],
      [
        { id: 'returns', label: 'returns' },
        { id: 'use', label: 'use' },
      ],
      [
        ['usage/quota', 'budget UI'],
        ['bool', 'mode check'],
        ['bool', 'ask keep'],
        ['throw', 'recover'],
      ],
    ),
    highlight: { active: ['estimate:returns', 'persist:use'], found: ['quotaerr:use'] },
    explanation: 'The web API surface is small: estimate approximate usage and quota, check whether storage is persistent, request persistence, and handle quota failures when writes exceed the budget.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'day', min: 1, max: 7 }, y: { label: 'GB', min: 0, max: 10 } },
      series: [
        { id: 'usage', label: 'usage', points: [{ x: 1, y: 1.2 }, { x: 2, y: 2.6 }, { x: 3, y: 4.2 }, { x: 4, y: 5.8 }, { x: 5, y: 7.1 }, { x: 6, y: 7.4 }, { x: 7, y: 6.0 }] },
        { id: 'quota', label: 'quota', points: [{ x: 1, y: 8 }, { x: 2, y: 8 }, { x: 3, y: 8 }, { x: 4, y: 8 }, { x: 5, y: 8 }, { x: 6, y: 8 }, { x: 7, y: 8 }] },
      ],
      markers: [
        { id: 'warn', x: 5, y: 7.1, label: 'warn' },
        { id: 'trim', x: 7, y: 6.0, label: 'trim' },
      ],
    }),
    highlight: { active: ['usage', 'warn', 'trim'], compare: ['quota'] },
    explanation: 'A good offline app watches the trend, not just the failure. It warns before the quota edge, compacts old data, and validates that trim jobs actually reduce usage.',
  };

  yield {
    state: labelMatrix(
      'Data classes',
      [
        { id: 'shell', label: 'shell' },
        { id: 'docs', label: 'docs' },
        { id: 'media', label: 'media' },
        { id: 'temp', label: 'temp' },
        { id: 'logs', label: 'logs' },
      ],
      [
        { id: 'store', label: 'store' },
        { id: 'policy', label: 'policy' },
      ],
      [
        ['Cache', 'ver'],
        ['mixed', 'persist'],
        ['OPFS', 'LRU'],
        ['Cache', 'drop'],
        ['IDB', 'cap'],
      ],
    ),
    highlight: { active: ['docs:policy', 'media:policy'], found: ['temp:policy'], compare: ['shell:store'] },
    explanation: 'Quota planning starts by classifying data. App shell bytes, user documents, media caches, scratch files, and telemetry logs should not share one eviction policy.',
  };

  yield {
    state: quotaGraph('Persistence reduces automatic eviction but does not replace backup', { persist: 'granted?', export: 'still need', evict: 'less likely' }),
    highlight: { active: ['quota', 'persist', 'export', 'e-quota-persist', 'e-persist-export'], compare: ['evict'] },
    explanation: 'Persistent storage is stronger than best-effort storage under pressure, but user action can still clear site data. Critical user data still needs sync, export, or another recovery path.',
  };
}

function* evictionPressure() {
  yield {
    state: evictionGraph('Under device pressure, best-effort origins can be evicted'),
    highlight: { active: ['disk', 'rank', 'cold', 'delete', 'e-disk-rank', 'e-rank-cold', 'e-cold-delete'], compare: ['persist'] },
    explanation: 'Browsers can remove best-effort origin storage when device storage is low. Persistent storage is treated differently, while user-initiated clearing can remove either kind.',
    invariant: 'Best-effort means the browser may clear it without interrupting the user.',
  };

  yield {
    state: labelMatrix(
      'Eviction inputs',
      [
        { id: 'last', label: 'last use' },
        { id: 'mode', label: 'mode' },
        { id: 'size', label: 'size' },
        { id: 'device', label: 'device' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'action', label: 'action' },
      ],
      [
        ['cold', 'risk up'],
        ['best/pers', 'rank'],
        ['large', 'trim'],
        ['low disk', 'evict'],
      ],
    ),
    highlight: { active: ['last:signal', 'mode:signal', 'device:action'], compare: ['size:action'] },
    explanation: 'Exact heuristics vary by browser, but the design posture is portable: keep critical data persistent or synced, keep cache bytes easy to rebuild, and keep usage bounded.',
  };

  yield {
    state: evictionGraph('Compaction is the app-owned pressure valve', { warm: 'near cap', compact: 'vacuum', recover: 'stay live' }),
    highlight: { active: ['warm', 'compact', 'recover', 'e-warm-compact', 'e-compact-recover'], compare: ['delete'] },
    explanation: 'The browser owns eviction, but the app owns compaction. Delete old runtime caches, vacuum OPFS files, trim logs, and discard rebuildable indexes before writes start failing.',
  };

  yield {
    state: labelMatrix(
      'Recovery paths',
      [
        { id: 'cache', label: 'cache' },
        { id: 'index', label: 'index' },
        { id: 'outbox', label: 'outbox' },
        { id: 'docs', label: 'docs' },
      ],
      [
        { id: 'ifLost', label: 'if lost' },
        { id: 'plan', label: 'plan' },
      ],
      [
        ['refetch', 'ok'],
        ['rebuild', 'ok'],
        ['danger', 'sync'],
        ['bad', 'export'],
      ],
    ),
    highlight: { active: ['cache:plan', 'index:plan'], removed: ['outbox:ifLost', 'docs:ifLost'], found: ['docs:plan'] },
    explanation: 'Not all bytes deserve equal protection. A lost image cache is a miss. A lost unacknowledged outbox mutation or offline document is product data loss.',
  };

  yield {
    state: evictionGraph('Persistent storage still has a user-controlled delete path', { persist: 'persistent', prompt: 'settings', recover: 'restore' }),
    highlight: { active: ['persist', 'prompt', 'recover', 'e-persist-prompt', 'e-prompt-recover'], compare: ['cold'] },
    explanation: 'Persistence is not invisibility. Users and enterprise policies can clear site data. The app should explain local-only data and provide export or sync before storage becomes the only copy.',
  };
}

function* offlineAppCase() {
  yield {
    state: quotaGraph('A local-first docs app budgets each storage class', { idb: 'docs+out', cache: 'shell+img', opfs: 'search db', usage: '6.8GB', quota: '8GB' }),
    highlight: { active: ['idb', 'cache', 'opfs', 'usage', 'quota'], found: ['export'] },
    explanation: 'A complete local-first app budgets across APIs: IndexedDB for documents and outbox, Cache Storage for shell and thumbnails, OPFS for search index or large project blobs.',
  };

  yield {
    state: labelMatrix(
      'Budget table',
      [
        { id: 'docs', label: 'docs' },
        { id: 'outbox', label: 'outbox' },
        { id: 'shell', label: 'shell' },
        { id: 'media', label: 'media' },
        { id: 'index', label: 'index' },
      ],
      [
        { id: 'cap', label: 'cap' },
        { id: 'owner', label: 'owner' },
        { id: 'trim', label: 'trim' },
      ],
      [
        ['4GB', 'user', 'export'],
        ['200MB', 'sync', 'never'],
        ['80MB', 'build', 'version'],
        ['2GB', 'cache', 'LRU'],
        ['1GB', 'search', 'rebuild'],
      ],
    ),
    highlight: { active: ['docs:trim', 'outbox:trim', 'media:trim'], found: ['index:trim'] },
    explanation: 'The table makes product policy explicit. User documents and unacknowledged outbox rows get protection. Media caches and indexes are bounded and rebuildable.',
  };

  yield {
    state: evictionGraph('When usage crosses a warning line, app trim runs before writes fail', { disk: 'warn', warm: 'media LRU', compact: 'trim', recover: 'usage down' }),
    highlight: { active: ['disk', 'warm', 'compact', 'recover', 'e-warm-compact'], compare: ['delete'] },
    explanation: 'A quota-aware app runs trim before the browser forces the issue. It may delete thumbnails, compact OPFS free pages, prune old trace logs, and retry the write.',
  };

  yield {
    state: labelMatrix(
      'Write failure flow',
      [
        { id: 'write', label: 'write' },
        { id: 'trim', label: 'trim' },
        { id: 'retry', label: 'retry' },
        { id: 'export', label: 'export' },
        { id: 'sync', label: 'sync' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'user', label: 'user' },
      ],
      [
        ['QuotaErr', 'warn'],
        ['cache drop', 'silent'],
        ['once', 'spinner'],
        ['file copy', 'offer'],
        ['remote', 'save'],
      ],
    ),
    highlight: { active: ['write:state', 'trim:state', 'retry:state'], found: ['export:user', 'sync:user'] },
    explanation: 'QuotaExceededError is not an exception to swallow. The app should trim rebuildable bytes, retry once, then offer export or sync for user data if the write still cannot land.',
  };

  yield {
    state: quotaGraph('The release gate proves storage survival paths', { persist: 'request', evict: 'test low', export: 'verified' }),
    highlight: { active: ['usage', 'quota', 'persist', 'evict', 'export'], found: ['e-quota-evict', 'e-evict-export'] },
    explanation: 'The release gate is concrete: simulate low disk, force quota failures, verify compaction, verify export, verify sync recovery, and check that the app explains local-only data.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'quota ledger') yield* quotaLedger();
  else if (view === 'eviction pressure') yield* evictionPressure();
  else if (view === 'offline app case') yield* offlineAppCase();
  else throw new InputError('Pick a browser storage quota view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Browser storage quota is the user-agent-managed budget for an origin. IndexedDB records, Cache Storage responses, OPFS files, and other storage APIs all contribute to the origin usage the browser may estimate, persist, or evict under pressure.',
        'MDN documents the quota and eviction criteria across web storage technologies: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria. The practical lesson is that storage architecture is a shared ledger, not a per-API afterthought.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'navigator.storage.estimate() returns approximate usage and quota. navigator.storage.persisted() reports whether the origin is already in persistent mode. navigator.storage.persist() requests persistent storage, and the browser may grant or deny it according to browser-specific rules, user engagement, permissions, or prompts.',
        'Default storage is usually best effort. Best-effort data can be cleared by the browser under storage pressure without interrupting the user. Persistent storage is stronger: web.dev explains that it is not automatically cleared when storage is low and usually requires explicit user action to remove: https://web.dev/articles/storage-for-the-web.',
      ],
    },
    {
      heading: 'Data structures behind it',
      paragraphs: [
        'A robust app maintains a quota ledger: storage class, API, owner, current usage, cap, rebuildability, persistence need, compaction plan, and recovery plan. It also maintains a trim queue for rebuildable bytes and an export/sync path for user-critical bytes.',
        'This connects IndexedDB Object Store Case Study, Cache Storage Versioned Precache, OPFS Origin Private File System, Local-First Sync Engine Case Study, LRU Cache, Cache Invalidation & Versioning, and Backpressure & Flow Control. Storage pressure is backpressure from the user device.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A local-first docs app stores documents and outbox rows in IndexedDB, app shell and thumbnails in Cache Storage, and a search index in OPFS. It caps thumbnails at 2 GB, search index at 1 GB, shell at 80 MB, outbox at 200 MB, and user documents according to available quota and sync/export status.',
        'When usage crosses a warning line, the app trims thumbnail LRU entries, compacts the OPFS index, prunes old telemetry, and retries writes. If a user-document write still fails, it offers export or sync rather than silently losing work.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not treat persistence as backup. Persistent storage is less likely to be automatically evicted under pressure, but users, browser settings, enterprise policies, private browsing, Clear-Site-Data, and profile resets can still remove local data.',
        'Do not treat quota estimates as exact numbers. They are estimates and browser policies differ. Do not let caches compete with user documents. Do not request persistence on page load without context; web.dev recommends asking when the user saves critical data, ideally with a user gesture: https://web.dev/articles/persistent-storage.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN Storage quotas and eviction criteria at https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria, MDN StorageManager.estimate at https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate, MDN StorageManager.persist at https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist, web.dev Storage for the web at https://web.dev/articles/storage-for-the-web, web.dev Persistent storage at https://web.dev/articles/persistent-storage, the WHATWG Storage Standard at https://storage.spec.whatwg.org/, and the WICG Storage Buckets explainer at https://wicg.github.io/storage-buckets/explainer.html.',
        'Study next: IndexedDB Object Store Case Study, OPFS Origin Private File System, Cache Storage Versioned Precache, Background Sync Outbox Queue, Service Workers & Offline-First, Local-First Sync Engine Case Study, LRU Cache, Cache Invalidation & Versioning, Backpressure & Flow Control, Web Locks API Lock Manager, and Data Leakage.',
      ],
    },
  ],
};
