// Cache Storage versioning: precache manifests, named caches, install/activate
// gates, manifest diffs, cleanup, quota, and update-safe offline shells.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'cache-storage-versioned-precache-case-study',
  title: 'Cache Storage Versioned Precache',
  category: 'Systems',
  summary: 'How service workers use precache manifests, named CacheStorage buckets, request keys, install gates, activate cleanup, and quota-aware updates.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['install manifest', 'update cleanup'], defaultValue: 'install manifest' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function cacheGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'rel', label: 'build', x: 0.55, y: 4.0, note: notes.rel ?? 'v43' },
      { id: 'manifest', label: 'manifest', x: 2.95, y: 4.0, note: notes.manifest ?? 'urls+hashes' },
      { id: 'sw', label: 'SW', x: 4.75, y: 4.0, note: notes.sw ?? 'install' },
      { id: 'new', label: 'cache v43', x: 6.45, y: 2.6, note: notes.new ?? 'new shell' },
      { id: 'old', label: 'cache v42', x: 6.45, y: 5.5, note: notes.old ?? 'old shell' },
      { id: 'fetch', label: 'fetch', x: 8.1, y: 4.0, note: notes.fetch ?? 'request' },
      { id: 'net', label: 'network', x: 9.4, y: 2.6, note: notes.net ?? 'origin' },
      { id: 'client', label: 'client', x: 9.4, y: 5.5, note: notes.client ?? 'tab' },
    ],
    edges: [
      { id: 'e-rel-manifest', from: 'rel', to: 'manifest', weight: '' },
      { id: 'e-manifest-sw', from: 'manifest', to: 'sw', weight: '' },
      { id: 'e-sw-new', from: 'sw', to: 'new', weight: 'put' },
      { id: 'e-sw-old', from: 'sw', to: 'old', weight: 'keep' },
      { id: 'e-new-fetch', from: 'new', to: 'fetch', weight: '' },
      { id: 'e-old-fetch', from: 'old', to: 'fetch', weight: '' },
      { id: 'e-fetch-net', from: 'fetch', to: 'net', weight: 'miss' },
      { id: 'e-fetch-client', from: 'fetch', to: 'client', weight: '' },
    ],
  }, { title });
}

function* installManifest() {
  yield {
    state: cacheGraph('A build emits a content-addressed precache manifest'),
    highlight: { active: ['rel', 'manifest', 'e-rel-manifest'], compare: ['old'] },
    explanation: 'A reliable offline shell starts with a build artifact: each URL is paired with a revision or hashed filename. The manifest is the set the service worker will try to make available before the new worker serves traffic.',
    invariant: 'The manifest is a set of expected cache keys, not a vague suggestion.',
  };

  yield {
    state: cacheGraph('Install opens the new named cache and fills it'),
    highlight: { active: ['manifest', 'sw', 'new', 'e-manifest-sw', 'e-sw-new'], compare: ['old'] },
    explanation: 'During install, the worker opens a versioned CacheStorage bucket such as app-precache-v43 and stores every required request/response pair. If the install promise rejects, the new worker does not become the active offline layer.',
  };

  yield {
    state: labelMatrix(
      'Precache keys',
      [
        { id: 'html', label: 'HTML' },
        { id: 'js', label: 'JS chunk' },
        { id: 'css', label: 'CSS' },
        { id: 'font', label: 'font' },
      ],
      [
        { id: 'key', label: 'key' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['URL+rev', 'stale shell'],
        ['hash name', 'split code'],
        ['hash name', 'FOUC'],
        ['URL+rev', 'quota'],
      ],
    ),
    highlight: { active: ['html:key', 'js:key', 'css:key'], compare: ['font:risk'] },
    explanation: 'The key choice is the data-structure choice. Hashed filenames make immutable entries easy. Revisioned URLs make mutable names safe. Bare mutable URLs are how old code survives too long.',
  };

  yield {
    state: cacheGraph('Fetch uses the current cache as a request-response map', { fetch: 'match()', client: 'response', net: 'fallback' }),
    highlight: { active: ['new', 'fetch', 'client', 'e-new-fetch', 'e-fetch-client'], compare: ['net'] },
    explanation: 'At fetch time, the cache behaves like a browser-managed key-value store keyed by Request. The service worker can answer from the current shell cache, fall back to the network, or route runtime data through a different strategy.',
  };

  yield {
    state: labelMatrix(
      'Cache buckets',
      [
        { id: 'shell', label: 'shell' },
        { id: 'img', label: 'images' },
        { id: 'api', label: 'API' },
        { id: 'tmp', label: 'temp' },
      ],
      [
        { id: 'policy', label: 'policy' },
        { id: 'evict', label: 'evict' },
      ],
      [
        ['precache', 'by version'],
        ['runtime', 'LRU-ish'],
        ['net first', 'short TTL'],
        ['scratch', 'delete fast'],
      ],
    ),
    highlight: { found: ['shell:policy', 'img:evict'], compare: ['api:policy'], removed: ['tmp:evict'] },
    explanation: 'Production workers often split caches by purpose. The app shell is versioned and complete. Images are runtime-cached with size limits. API data uses HTTP validators or query caches. Temporary entries are disposable.',
  };
}

function* updateCleanup() {
  yield {
    state: cacheGraph('A new worker installs beside the old active worker', { rel: 'v44', manifest: 'new set', sw: 'waiting', new: 'v44 ready', old: 'v43 active' }),
    highlight: { active: ['rel', 'manifest', 'sw', 'new', 'e-rel-manifest', 'e-manifest-sw', 'e-sw-new'], compare: ['old'] },
    explanation: 'Service worker updates are two-version systems. The new worker can finish install while old tabs are still controlled by the previous worker and previous cache.',
    invariant: 'Never delete the cache the still-active worker needs.',
  };

  yield {
    state: labelMatrix(
      'Manifest diff',
      [
        { id: 'same', label: 'same' },
        { id: 'added', label: 'added' },
        { id: 'gone', label: 'removed' },
        { id: 'changed', label: 'changed' },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['reuse', 'same hash'],
        ['fetch', 'new URL'],
        ['drop later', 'old tabs'],
        ['replace', 'new hash'],
      ],
    ),
    highlight: { active: ['added:action', 'changed:action'], compare: ['gone:action'] },
    explanation: 'The manifest diff is set arithmetic: keep identical revisions, fetch new or changed entries, and delay deletion until activation proves old controlled clients are safe.',
  };

  yield {
    state: cacheGraph('Activate claims the new version and deletes obsolete caches', { sw: 'activate', new: 'v44 active', old: 'delete', fetch: 'v44 match' }),
    highlight: { active: ['sw', 'new', 'old', 'fetch', 'e-sw-old', 'e-new-fetch'], removed: ['old'], found: ['client'] },
    explanation: 'Activate is the cleanup gate. The worker can enumerate CacheStorage.keys(), delete cache names that are not in the allowlist, and optionally clients.claim() so open pages use the new controller.',
  };

  yield {
    state: labelMatrix(
      'Update bugs',
      [
        { id: 'split', label: 'split code' },
        { id: 'oldtab', label: 'old tab' },
        { id: 'quota', label: 'quota' },
        { id: '404', label: '404 asset' },
      ],
      [
        { id: 'cause', label: 'cause' },
        { id: 'control', label: 'control' },
      ],
      [
        ['mixed chunks', 'hash names'],
        ['cache deleted', 'wait gate'],
        ['too many', 'expire old'],
        ['bad build', 'fail install'],
      ],
    ),
    highlight: { removed: ['split:cause', 'oldtab:cause'], active: ['split:control', '404:control'] },
    explanation: 'A good precache strategy is conservative. It fails install when required assets are missing, avoids mixed-version JavaScript, and deletes old caches only after the lifecycle makes that safe.',
  };

  yield {
    state: cacheGraph('Quota pressure turns cache into a fast maybe', { new: 'keep core', old: 'delete', fetch: 'fallback ok', net: 'refetch' }),
    highlight: { active: ['new', 'fetch', 'net', 'e-new-fetch', 'e-fetch-net'], removed: ['old'] },
    explanation: 'Cache Storage is durable enough for offline shells, but the browser still owns storage pressure decisions. The app should keep the core shell small, make runtime caches disposable, and treat misses as normal.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'install manifest') yield* installManifest();
  else if (view === 'update cleanup') yield* updateCleanup();
  else throw new InputError('Pick a Cache Storage view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'callout', text:'Versioned precaching treats the offline shell as a release-sized key set that must install completely before it becomes the active cache.'},
        'An offline-capable web app needs a stable shell: HTML, JavaScript chunks, CSS, fonts, and small assets that should be available before the network answers. The browser HTTP cache can help, but it is not an application-owned deployment ledger. It does not tell the service worker which exact release files must move together.',
        'Cache Storage gives a service worker named Request-to-Response maps. Versioned precaching turns those maps into release namespaces. A manifest names the required key set, install fills the new namespace, fetch reads from the active namespace, and activate deletes namespaces that are no longer safe.',
        'MDN describes CacheStorage.open as returning a named Cache and creating it when needed: https://developer.mozilla.org/en-US/docs/Web/API/CacheStorage. MDN Cache.addAll documents the install-time bulk fill pattern for a list of URLs: https://developer.mozilla.org/en-US/docs/Web/API/Cache/addAll.',
      ],
    },
    {
      heading: 'The obvious attempt',
      paragraphs: [
        'The naive service worker caches whatever it sees and later serves matching requests from that cache. That works for demos because one page, one script, and one stylesheet are easy to keep in your head.',
        'It fails in real deployments because app shells are multi-file releases. Old HTML can point at deleted chunks. New JavaScript can load old CSS. A missing file can still leave a worker installed. Runtime images can crowd out core shell files. Without a versioned key set and lifecycle gate, the cache becomes a pile of remembered responses rather than a safe release artifact.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core data structure is a versioned key-value namespace. Each named Cache is a map from normalized Request keys to Response values. The precache manifest is the expected set for one release, usually using content hashes or explicit revisions so changed content gets a changed key.',
        'The important invariant is atomic enough for users: the new worker should serve traffic only after every required shell asset for that release is present. Old caches stay alive while old controlled tabs may still need them. Cleanup is delayed until the service-worker lifecycle makes deletion safe.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The install-manifest view is proving that precaching is a release protocol, not a bag of cached files. A manifest names the exact request keys that make one app shell coherent: HTML entry, JavaScript chunks, CSS, fonts, icons, and other small static assets. The service worker opens a versioned cache, fills that set, and refuses to activate if a required member is missing. That is why the app can start offline without mixing release v43 HTML with release v44 chunks.',
        'The update-cleanup view is about lifecycle safety. Old controlled tabs may still execute old code and ask for old chunks, so deletion must wait until the new worker is active and the old namespace is no longer needed. The visual should be read as a small garbage collector with an allowlist: keep the current release cache, keep any runtime buckets with their own policy, and delete only namespaces whose purpose and version are known. Cache correctness comes from set membership, content revision, and service-worker lifecycle order.',
        'This is also why the manifest should stay boring. If the core shell is small, versioned, and deterministic, install failure is easy to reason about. If the manifest includes user documents, large media, or volatile API responses, the install step becomes slow and fragile. Precaching should protect the boot path; fresher and larger data needs separate runtime caching rules.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A build emits a manifest: URLs with revisions, or URLs whose filenames already include content hashes. The service worker install event opens a new cache, adds the manifest entries, and waits for that promise. If a required asset fails, install fails. Keeping the old worker is better than activating an incomplete shell.',
        'Fetch uses the active cache as a request map. For immutable shell assets, cache-first is safe because the key changes when the content changes. For mutable API data, the worker should use network-first, stale-while-revalidate, HTTP validators, or a query cache rather than blindly precaching live truth.',
        'Activate is the garbage-collection gate. The new worker can enumerate cache names, keep the allowlisted release caches, and delete older namespaces after the active worker has changed. That separation prevents cleanup from racing old tabs.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from set membership and lifecycle order. The manifest says which keys must exist. The install promise proves those keys were stored before the worker can become active. The active worker uses one chosen namespace for shell reads, so it does not accidentally mix release v43 JavaScript with release v44 CSS.',
        'Content hashes and revisions make staleness visible in the key. If the bytes change, the key changes or the manifest revision changes. If the key does not change, the worker can reuse the cached response without guessing about freshness.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A documentation PWA ships release v43 with app.43.js, app.43.css, index.html?rev=43, and fonts. The v43 worker opens docs-precache-v43 and fills those entries. One week later v44 ships. The v44 worker installs beside v43, opens docs-precache-v44, reuses same-revision entries where possible, fetches changed entries, and waits. Only after activation does it delete docs-precache-v42 and eventually v43.',
        'The important invariant is that old controlled tabs may still need old code chunks. Cache Invalidation & Versioning explains the naming discipline; Service Workers & Offline-First explains the lifecycle; HTTP Cache ETag Revalidation explains how the browser and network validate mutable resources outside this app-shell cache.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'Install cost is proportional to the bytes and request count in the manifest. Fetch lookup is cheap relative to network, but request matching still has overhead, and every cached byte counts against origin storage. Runtime image caches can grow until quota pressure or explicit expiration removes them.',
        'The design tax is discipline. The core shell must stay small, runtime caches need size and age policies, mutable API data needs a different strategy, and misses must be normal. Cache Storage is useful local storage, not a promise that the browser will keep every response forever.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Versioned precaching wins for application shells, documentation PWAs, courseware, dashboards, and tools where the same static release files are reused across sessions. It is especially useful when startup must work on flaky networks and the asset graph is known at build time.',
        'It fails when the content is large, personalized, legally sensitive, or rapidly changing. API truth, user documents, generated reports, and unbounded media galleries need freshness, authorization, quota, and eviction rules beyond a release manifest.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The hard update bugs are split code, old-tab deletion, and bad manifests. Split code happens when an old HTML file references chunks deleted by a new activation. Old-tab deletion happens when cleanup ignores service-worker lifecycle. Bad manifests happen when install does not fail on missing required files.',
        'Another failure is cache sprawl. If shell, images, API responses, and temporary blobs share one bucket, cleanup becomes guesswork. Production workers usually separate cache names by purpose so each bucket has its own eviction policy.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN CacheStorage at https://developer.mozilla.org/en-US/docs/Web/API/CacheStorage, MDN Cache at https://developer.mozilla.org/en-US/docs/Web/API/Cache, MDN Cache.addAll at https://developer.mozilla.org/en-US/docs/Web/API/Cache/addAll, MDN Service Worker API at https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API, and the W3C Service Workers specification at https://www.w3.org/TR/service-workers/. Workbox documents production precaching and route strategies at https://developer.chrome.com/docs/workbox/modules/workbox-precaching and https://developer.chrome.com/docs/workbox/caching-strategies-overview.',
        'Study next by role: Service Workers & Offline-First for the lifecycle, Service Worker Navigation Preload Race for fast network-first navigations, HTTP Cache ETag Revalidation and HTTP Vary Cache-Key Normalization for freshness and key design, Cache Invalidation & Versioning and LRU Cache for eviction ideas, IndexedDB Object Store Case Study and OPFS Origin Private File System for structured local data, Browser Storage Quota & Eviction Manager for storage pressure, and Background Sync Outbox Queue for offline writes.',
      ],
    },
  ],
};
