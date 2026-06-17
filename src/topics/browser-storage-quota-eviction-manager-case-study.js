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
      heading: 'Why this exists',
      paragraphs: [
        'Modern web apps store far more than cookies and preferences. A serious offline app may keep a versioned app shell in Cache Storage, structured documents in IndexedDB, thumbnails and media responses in caches, large project files in OPFS, a search index, an outbox of unsynced mutations, logs, feature flags, and temporary traces. From the user\'s point of view this can feel like a local application. From the browser\'s point of view it is one origin competing for finite device storage.',
        'Browser storage quota exists because the browser is responsible for the health of the whole profile and device, not just one app. It has to prevent a single origin from filling disk, protect privacy, respect user clearing actions, and keep enough free space for the operating system and other sites. IndexedDB, Cache Storage, OPFS, service worker caches, and other storage APIs are separate programming surfaces, but quota pressure is managed at the origin and storage-bucket level according to browser policy.',
        'The engineering lesson is that local data durability is a product promise, not an API guarantee. Best-effort storage can be evicted under pressure. Persistent storage is stronger, but users and policies can still clear it. A quota-aware app therefore needs a storage ledger, compaction policy, persistence request strategy, export or sync path, and tested failure handling.',
      ],
    },
    {
      heading: 'The tempting wrong answer',
      paragraphs: [
        'The first naive plan is to write until QuotaExceededError appears, then tell the user something went wrong. That makes quota an emergency rather than a budget. The app discovers the problem at the most sensitive moment: while saving a document, receiving an offline edit, downloading a map region, or committing an outbox item. By then the app may have half-written data, blocked sync, or forced the user to choose between clearing data and losing work.',
        'The second naive plan is to treat every byte the same. If a trim job simply deletes the largest store, it may remove unacknowledged outbox mutations before deleting a rebuildable thumbnail cache. That is a product bug disguised as storage management. The app must know which bytes are user-owned, which are derived, which can be rebuilt, which can be refetched, and which are the only local copy.',
        'The third naive plan is to request persistent storage and consider the problem solved. Persistence reduces automatic eviction risk, but it is not backup. Users can clear site data, browser settings can remove storage, enterprise policies may enforce cleanup, private browsing modes may behave differently, and a damaged profile or device failure can still destroy local state. Critical user data needs sync, export, or another recovery path even after persistence is granted.',
      ],
    },
    {
      heading: 'Core model',
      paragraphs: [
        'The core data structure is an origin storage ledger. Each class of data should have a row: API, owner, current estimated bytes, soft cap, hard cap if any, rebuildability, last-access policy, persistence need, compaction command, export or sync path, and user-facing consequence if lost. The point is not perfect accounting. The point is to make deletion choices explicit before the browser or a failed write makes them for you.',
        'The basic web API surface is small. navigator.storage.estimate() asks for approximate usage and quota. navigator.storage.persisted() tells whether the origin is already in persistent mode. navigator.storage.persist() requests persistent storage and resolves to true or false according to browser-specific policy. Writes can still fail, and estimates are not exact promises. They are signals for budget decisions.',
        'A useful invariant is simple: rebuildable bytes are expendable; user-critical bytes need protection. A cached app shell can be versioned and replaced. A generated search index can be rebuilt. Thumbnails can be trimmed by least-recently-used policy. An unsynced document, local-only project file, or outbox mutation is different. Those bytes need persistence, sync, export, or a clear warning that they are local only.',
      ],
    },
    {
      heading: 'How the system works',
      paragraphs: [
        'A quota-aware app starts by classifying data. App shell files live in Cache Storage and are owned by the release system. Documents may live in IndexedDB and are owned by the user. Large local files may live in OPFS. A search index may live in OPFS or IndexedDB and be owned by the indexing subsystem. Runtime logs may be owned by observability. Once ownership is explicit, each class can get a cap and a trim policy.',
        'The app periodically samples navigator.storage.estimate(), records local store-level estimates when it can, and compares usage against soft thresholds. It does not wait for the hard edge. At 70 or 80 percent of budget, it might trim old media, compact OPFS files, prune logs, remove old cache versions, and verify that usage dropped.',
        'When a write fails, the handler follows a deterministic ladder. First, identify whether the failed write is user-critical or rebuildable. Second, trim rebuildable classes in priority order. Third, retry the write once or a bounded number of times. Fourth, if the write still cannot land, offer export, sync, or an explicit "free space" flow for user data. Swallowing QuotaExceededError is wrong because it converts a storage failure into silent data loss.',
        'Persistence is requested at the moment it has context. Asking on first page load is hard to justify. Asking when the user creates local-only work, enables offline mode, imports a large project, or stores drafts on this device is easier to explain. The request may be granted automatically, denied automatically, or involve browser-specific behavior. The app must work either way.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The quota-ledger visual is proving that separate storage APIs still share a pressure boundary. IndexedDB, Cache Storage, and OPFS may have different code paths, but their bytes contribute to the origin\'s usage. An app that manages each API in isolation can accidentally let a rebuildable media cache crowd out a user document store.',
        'The eviction-pressure visual is proving the boundary of responsibility. The browser ranks and evicts according to its own policy when device pressure appears, especially for best-effort storage. The app cannot control that global choice. It can control whether cold caches are easy to delete, whether warm critical data is persistent or synced, and whether recovery after eviction is a designed flow instead of a surprise.',
        'The offline-app case visual is proving that bytes encode promises. User documents and outbox rows represent work. Shell files, thumbnails, logs, and indexes represent convenience. The budget table is therefore not just storage accounting. It is a product policy table for what may be lost, rebuilt, synced, or exported.',
      ],
    },
    {
      heading: 'Practical guidance',
      paragraphs: [
        'Build an internal ledger even if the browser only gives approximate origin totals. Track app shell cache versions, document counts and byte estimates, media cache size, index size, outbox size, logs, and temporary files. Give each class an owner and a trim command. A quota handler without this ledger has no principled way to decide what to delete.',
        'Use soft caps rather than one global hard cap. For example, a local-first docs app might cap shell assets at 80 MB, thumbnails at 2 GB with LRU eviction, search indexes at 1 GB with rebuild, outbox rows at 200 MB with no automatic deletion, and user documents according to sync or export status.',
        'Test storage survival before release: low quota, QuotaExceededError during a user save, persistence denied, site data cleared, network sync broken, stale cache cleanup, OPFS rebuild, export success, and honest local-only warnings.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The main cost is bookkeeping. The app has to estimate data sizes, run cleanup jobs, migrate storage formats, and keep indexes rebuildable. This takes engineering time that a purely online app may not need. But the alternative is worse for offline-first products: random write failures and unexplained data loss.',
        'The second cost is user experience complexity. If the app warns too early, users see noise. If it warns too late, users lose control. If it asks for persistence without context, the request feels suspicious. If it hides local-only risk, the product overpromises. A good design ties storage prompts to meaningful actions: enabling offline mode, saving critical local data, importing a large workspace, or approaching a known budget edge.',
        'The third cost is portability. Browser quotas, eviction policies, private browsing behavior, installed-app treatment, and persistence prompts vary. Code should treat estimates as approximate, persistence as conditional, and eviction as real for anything not backed up elsewhere.',
      ],
    },
    {
      heading: 'Uses and limits',
      paragraphs: [
        'Quota management matters most in local-first editors, browser IDEs, drawing tools, offline maps, media apps, email clients, medical or field-work apps, and enterprise tools used in unreliable networks. These apps create user trust by working without a server round trip. That trust is lost quickly if local state disappears without warning or if a save fails after the user has already done the work.',
        'The limits are clear. Browser storage is not a database appliance. It has no cross-device durability by itself, no guarantee against user clearing, no universal quota number, and no perfect per-store accounting API across all browsers. OPFS, IndexedDB, and Cache Storage are useful primitives, but the durability story comes from policy, sync, export, and testing layered above them.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary references are MDN Storage quotas and eviction criteria at https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria, MDN StorageManager.estimate at https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate, MDN StorageManager.persist at https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist, web.dev Storage for the web at https://web.dev/articles/storage-for-the-web, web.dev Persistent storage at https://web.dev/articles/persistent-storage, and the WHATWG Storage Standard at https://storage.spec.whatwg.org/.',
        'In this curriculum, study IndexedDB Object Store Case Study, OPFS Origin Private File System, Cache Storage Versioned Precache, Background Sync Outbox Queue, Service Workers & Offline-First, Local-First Sync Engine Case Study, LRU Cache, Cache Invalidation & Versioning, Web Streams Backpressure Queues, Backpressure & Flow Control, Web Locks API Lock Manager, Data Leakage, and BFCache Page Lifecycle.',
      ],
    },
  ],
};
