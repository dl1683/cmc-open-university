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
      heading: 'How to read the animation',
      paragraphs: [
        {type:'callout', text:'Browser storage is a budget ledger, not a durability promise. Rebuildable bytes can be trimmed; user-owned bytes need persistence plus sync, export, or another recovery path.'},
        'Read the storage bars as one origin budget, not as separate promises from IndexedDB, Cache Storage, and OPFS. An origin is the site-level storage owner that the browser accounts for when disk pressure appears. A safe inference is that bytes from different APIs can still compete under the same browser-managed quota.',
        'Read the eviction order as policy, not as random loss. Rebuildable data means data the app can recreate from the network or local inputs. User-owned data means work the user created or edited, so the app needs persistence, sync, export, or an explicit local-only warning.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Modern web apps store documents, offline shells, thumbnails, media responses, outbox mutations, logs, and local indexes. The browser has to keep the whole profile healthy while many origins compete for disk. Quota management is the boundary between an app promise and device reality.',
        'The API surfaces differ, but the failure can look the same: a write fails or old data disappears under pressure. A quota-aware app treats storage as a ledger with owners, caps, rebuild rules, and recovery paths. Without that ledger, deletion choices happen during an incident.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to write data until QuotaExceededError appears, then show an error. That works for a small demo because the cache is tiny and the user can reload the page. It fails when the failed write is a document save or an offline mutation that has no server copy yet.',
        'Another tempting approach is to delete the largest bucket first. That may remove unsynced user work before thumbnails or generated indexes. Size alone is not the right priority; recoverability is the right priority.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that browser storage is best-effort unless stronger conditions apply, and even persistent storage is not a backup. Users can clear site data, profiles can fail, policies can remove storage, and private browsing modes can change behavior.',
        'A second wall is incomplete measurement. navigator.storage.estimate() gives approximate usage and quota, not a per-store invoice. The app must combine browser estimates with its own store-level accounting to decide what to trim before the hard edge.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to classify bytes by consequence. Shell assets, thumbnails, logs, and search indexes are convenience bytes if they can be rebuilt. Unsynced edits, local-only files, and outbox rows are user-risk bytes if they disappear.',
        'That classification turns quota from a crash path into a policy table. Each row should name the storage API, owner, estimated bytes, soft cap, rebuild rule, trim command, and recovery path. The app then trims low-consequence bytes before it risks high-consequence bytes.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The app samples navigator.storage.estimate() and tracks local counts for each store it controls. At a soft threshold such as 75 percent of the estimated quota, it trims old cache versions, least-recently-used media, logs, and rebuildable indexes. It verifies that usage fell before accepting more risky local work.',
        'On write failure, the handler follows a deterministic ladder. It identifies whether the failed write is user-critical, trims rebuildable classes in priority order, retries once or a bounded number of times, then offers sync, export, or a clear free-space flow for user data. Silent failure is data loss disguised as resilience.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is about preserving user intent. If rebuildable bytes are deleted first, the app may lose speed or offline convenience, but it does not lose unique user work. If user-owned bytes need sync or export before deletion, the app can prove it did not silently discard the only copy.',
        'The budget argument is monotonic. When usage crosses a soft cap, every trim either lowers usage or proves that class is no longer enough. The app moves from cheapest loss to highest consequence, so the final user-facing warning is reached only after safe cleanup has been attempted.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is bookkeeping. The app stores byte estimates, ownership labels, last-access metadata, compaction jobs, and tests for low-quota behavior. When cached media doubles from 2 GB to 4 GB, the trim job and index metadata also grow unless the cap forces old entries out.',
        'The behavior cost is user trust. Warn too early and storage prompts become noise; warn too late and a save can fail after the user has done the work. Persistent storage requests should be tied to meaningful actions such as enabling offline mode or creating local-only projects.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Quota management matters in local-first editors, browser IDEs, drawing tools, offline maps, email clients, field-work apps, and enterprise tools used on unreliable networks. These products win trust by continuing to work without a server round trip.',
        'It is also useful for apps with large derived caches. A map tile cache or thumbnail cache can improve speed, but it should never crowd out unsynced records. The ledger makes that product rule executable.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when teams treat persistence as permanent storage. Browser persistence reduces eviction risk, but it does not protect against user clearing, device loss, profile corruption, or policy cleanup.',
        'It also fails when app data classes are not separated. If shell files, user documents, logs, and media share one vague bucket, cleanup becomes guesswork. The browser may still evict according to its own policy, so critical data needs recovery outside the local browser profile.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A drawing app estimates 5 GB of quota and currently uses 3.8 GB. Its ledger shows 80 MB of shell files, 2.4 GB of thumbnails, 900 MB of OPFS project files, 300 MB of search indexes, and 120 MB of unsynced outbox data. At a 75 percent soft cap, it starts trimming before the next project save.',
        'The app deletes 900 MB of cold thumbnails and rebuildable indexes, dropping usage to about 2.9 GB. It does not delete the 120 MB outbox because those rows are unsynced user work. If a later 700 MB project import still fails, the app offers export or sync instead of pretending the write succeeded.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN Storage quotas and eviction criteria at https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria, MDN StorageManager.estimate at https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate, MDN StorageManager.persist at https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist, web.dev Storage for the web at https://web.dev/articles/storage-for-the-web, and the WHATWG Storage Standard at https://storage.spec.whatwg.org/.',
        'Study IndexedDB object stores, OPFS, Cache Storage versioned precache, Background Sync outbox queues, LRU eviction, cache invalidation, Web Locks, and local-first sync engines. The recurring question is which bytes are replaceable and which bytes are user promises.',
      ],
    },
  ],
};
