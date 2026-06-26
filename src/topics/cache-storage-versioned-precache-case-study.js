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
      heading: 'How to read the animation',
      paragraphs: [
        {type:'callout', text:'Versioned precaching treats the offline shell as a release-sized key set that must install completely before it becomes the active cache.'},
        'Read each named Cache as a key-value map from Request to Response. A precache manifest is the list of request keys that define one application shell release. A safe inference is that a new release should not serve users until every required shell key has been stored.',
        'Read install, fetch, and activate as separate lifecycle gates. Install fills the new namespace, fetch reads from the active namespace, and activate deletes old namespaces only when the service-worker lifecycle makes that safe. The animation is proving release coherence, not just offline speed.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'An offline-capable web app needs a stable shell: HTML, JavaScript chunks, CSS, fonts, and small assets that boot the app. The browser HTTP cache can store responses, but it is not an application-owned release ledger. It cannot tell the service worker which files must move together.',
        'Cache Storage gives a service worker named maps, and versioned precaching turns those maps into release namespaces. The app stores a complete manifest before activation, then serves the active release even when the network is unavailable. That makes offline startup a deploy property instead of a lucky cache hit.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to cache whatever the app sees and serve matching requests later. That works for a toy page because the asset graph is tiny. It breaks when a real build has hashed chunks and old tabs still ask for older files.',
        'Another approach is to precache everything, including user data and volatile API responses. That makes install slow and fragile. The shell belongs in precache; mutable data needs runtime caching, validation, or sync rules.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is mixed-release failure. Old HTML can point at deleted JavaScript, new JavaScript can load old CSS, or a worker can activate after only part of the release was stored. A partial shell is worse than a network miss because the app now fails offline with confidence.',
        'A second wall is old controlled tabs. A tab still running v43 may request v43 chunks after v44 installs. If cleanup deletes v43 too early, the old tab breaks even though the new release is correct.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to treat the app shell as a set with a version. The manifest defines the required keys for release v44, and the named cache stores exactly those responses. Content hashes or explicit revisions make changed bytes produce changed keys.',
        'The invariant is release coherence. The active worker should serve one coherent shell namespace, not a blend of old and new files. Cleanup is a garbage-collection step over known cache names, not a blind deletion of remembered responses.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A build emits a manifest of URLs and revisions. During install, the service worker opens a versioned cache and adds every manifest entry. If one required fetch fails, install fails and the old worker remains safer than a partial new shell.',
        'During fetch, immutable shell assets can use cache-first because the key changes when the content changes. During activate, the worker keeps the current release cache and deletes older release namespaces when old clients no longer need them. Runtime image or API caches should have separate names and separate eviction policies.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from set membership and lifecycle order. The install promise proves that required keys were stored before the worker can become active. The active worker then reads shell files from one chosen namespace, so it does not mix v43 JavaScript with v44 CSS.',
        'Content revisions make staleness visible. If app.js changes from 120 KB to 128 KB, the hashed filename or revision changes, and the manifest points to a new key. If the key does not change, cache-first reuse is a deliberate statement that the bytes did not change.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Install cost is proportional to request count and bytes. If the shell has 40 files totaling 8 MB, every fresh install must fetch and store those 40 responses before activation. Doubling the shell to 16 MB doubles storage pressure and can double install time on slow networks.',
        'The complexity cost is discipline. The shell must stay small, runtime caches need age and size rules, and misses must be normal. Cache Storage is useful local storage, but browser quota and user clearing still apply.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Versioned precaching fits documentation PWAs, courseware, dashboards, developer tools, and apps where the static shell is reused across sessions. It is most useful when startup must work on unreliable networks and the asset graph is known at build time.',
        'It also fits products that deploy hashed assets. The manifest can bind index.html, chunks, styles, fonts, and icons into one release. Runtime data stays outside that set because freshness and authorization have different rules.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the manifest includes large or volatile data. User documents, generated reports, personalized API responses, and unbounded media galleries need sync, validation, quota, and eviction policies beyond release precaching.',
        'It also fails when cleanup ignores old clients. Deleting v43 while a v43 tab is still open can break lazy-loaded chunks. A safe worker treats activation cleanup as lifecycle-aware garbage collection.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Release v43 ships index.html?rev=43, app.43.js at 420 KB, app.43.css at 40 KB, and four font files totaling 600 KB. The worker opens docs-precache-v43 and stores all required entries. If one font fails, v43 does not activate because the shell set is incomplete.',
        'A week later v44 changes app.js to 460 KB and CSS to 44 KB while reusing the same fonts. The v44 install stores the changed keys and reused font responses, then activates when complete. Cleanup keeps v44 and deletes older release caches only after old tabs no longer need their chunks.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN CacheStorage at https://developer.mozilla.org/en-US/docs/Web/API/CacheStorage, MDN Cache at https://developer.mozilla.org/en-US/docs/Web/API/Cache, MDN Cache.addAll at https://developer.mozilla.org/en-US/docs/Web/API/Cache/addAll, MDN Service Worker API at https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API, W3C Service Workers at https://www.w3.org/TR/service-workers/, and Workbox precaching at https://developer.chrome.com/docs/workbox/modules/workbox-precaching.',
        'Study service workers, navigation preload, HTTP ETag revalidation, HTTP Vary cache-key normalization, cache invalidation, LRU eviction, IndexedDB, OPFS, browser storage quota, and background sync. The recurring question is which bytes are release shell and which bytes are live product data.',
      ],
    },
  ],
};
