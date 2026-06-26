// Service workers: a programmable proxy that moves in between your page
// and the network. Once installed, every request passes through code YOU
// wrote — which is how a web page survives airplane mode.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'service-workers',
  title: 'Service Workers & Offline-First',
  category: 'Systems',
  summary: 'A programmable proxy between page and network: intercept every request, answer from cache, survive airplane mode.',
  controls: [
    { id: 'view', label: 'Watch', type: 'select', options: ['a proxy moves in', 'the caching strategies'], defaultValue: 'a proxy moves in' },
  ],
  run,
};

function proxy({ sw = null, cache = null, net = 'reachable', page = '', edges = [] }) {
  const nodes = [
    { id: 'page', label: 'PAGE', x: 1.2, y: 3.5, note: page },
    ...(sw === null ? [] : [{ id: 'sw', label: 'SERVICE WORKER', x: 4.8, y: 3.5, note: sw }]),
    ...(cache === null ? [] : [{ id: 'cache', label: 'CACHE', x: 8.2, y: 5.6, note: cache }]),
    { id: 'net', label: 'NETWORK', x: 8.2, y: 1.4, note: net },
  ];
  return graphState({ nodes, edges });
}

function* movesIn() {
  const shellFiles = 4;
  const strategies = ['cache-first', 'network-first', 'stale-while-revalidate', 'network-only'];
  const strategyCount = strategies.length;

  yield {
    state: proxy({
      page: 'fetch("/articles")',
      net: 'reachable… for now',
      edges: [{ id: 'direct', from: 'page', to: 'net' }],
    }),
    highlight: { active: ['direct'] },
    explanation: `An ordinary web page: every fetch travels straight to the network (through the whole stack this site has mapped — DNS, TCP, maybe a CDN). The architecture has a single point of failure you carry in your pocket: no signal, no app. Native apps shrug at airplane mode; classic web pages show a dinosaur. The fix is to put something programmable IN THE PATH — a ${topic.title.split('&')[0].trim().toLowerCase()} that can answer on the network's behalf.`,
  };

  yield {
    state: proxy({
      sw: 'install event firing',
      cache: 'app.html, app.css, app.js, logo.svg',
      net: 'downloading shell…',
      page: 'navigator.serviceWorker.register("sw.js")',
      edges: [{ id: 'fill', from: 'net', to: 'cache' }],
    }),
    highlight: { active: ['sw'], found: ['cache', 'fill'] },
    explanation: `The page calls register("sw.js") and the browser spins up a SERVICE WORKER — a worker (same family as Web Workers: own thread, no DOM) with a special privilege and a ceremony. The privilege: it may intercept network traffic for the whole site. The ceremony: an INSTALL event fires first, and the worker uses it to PRECACHE the application shell — ${shellFiles} files (HTML, CSS, JS, logo) — into the Cache API (a programmable HTTP cache, cousin of the LRU Cache idea with you holding the eviction keys). Then it waits to ACTIVATE: by default a new worker version takes over only when every old tab closes — that is literally why "close all tabs to update" is a thing in PWAs.`,
    invariant: `Install precaches ${shellFiles} shell files before the worker ever serves a request: the shell is guaranteed present or installation fails.`,
  };

  yield {
    state: proxy({
      sw: 'fetch event: respondWith(…)',
      cache: 'shell (4 files)',
      net: 'reachable',
      page: 'fetch("/articles")',
      edges: [
        { id: 'toSw', from: 'page', to: 'sw' },
        { id: 'toNet', from: 'sw', to: 'net' },
        { id: 'toCache', from: 'sw', to: 'cache' },
      ],
    }),
    highlight: { active: ['toSw', 'sw'], compare: ['toNet', 'toCache'] },
    explanation: `Activated, the worker takes its seat as a MAN-IN-THE-MIDDLE — the benevolent kind (and the reason ${topic.title.split('&')[0].trim().toLowerCase()}s demand HTTPS: this much power over traffic must be tamper-proof). From now on EVERY request the page makes fires a fetch event inside the worker first. The handler calls event.respondWith(...) and chooses from ${strategyCount} strategies: forward to the network? Answer from cache? Synthesize a response from thin air? The network just became optional — a resource your code consults, not a dependency it dies with.`,
  };

  yield {
    state: proxy({
      sw: 'caches.match(request)',
      cache: 'shell (4 files) â†’ HIT',
      net: 'âœˆ UNREACHABLE',
      page: 'app loads anyway âœ“',
      edges: [
        { id: 'toSw', from: 'page', to: 'sw' },
        { id: 'toCache', from: 'sw', to: 'cache' },
      ],
    }),
    highlight: { found: ['toCache', 'cache', 'page'], removed: ['net'] },
    explanation: `Airplane mode. The network node is gone — and the app loads anyway: the fetch event fires, the worker answers from the precached shell (${shellFiles} files), the page renders, queued writes wait in IndexedDB for the connection's return (background sync). This is OFFLINE-FIRST, the architecture behind installable PWAs — Twitter Lite, Starbucks, Google Docs offline. The mental shift is the whole lesson: the network stopped being the app's foundation and became one of several places a response might come from — and your code, not the browser, ranks them.`,
  };
}

function* strategies() {
  const requestTypes = 4;

  yield {
    state: proxy({
      sw: 'cache-first',
      cache: 'logo.svg â†’ HIT (2ms)',
      net: 'never asked',
      page: 'fetch("logo.svg")',
      edges: [
        { id: 'toSw', from: 'page', to: 'sw' },
        { id: 'toCache', from: 'sw', to: 'cache' },
      ],
    }),
    highlight: { found: ['toCache', 'cache'], visited: ['net'] },
    explanation: `Strategy 1 of ${requestTypes} — CACHE-FIRST: check the cache; only on a miss go to the network (and cache the answer for next time). The logo answers in ~2ms with zero bytes of data used. Perfect for the app shell, fonts, versioned assets — anything immutable. The danger is its mirror image: cache-first never notices that the file CHANGED on the server. The discipline that makes it safe is versioned filenames (app.v42.js) — exactly the immutability trick CDN Request Flow uses at planet scale.`,
  };

  yield {
    state: proxy({
      sw: 'network-first (3s timeout)',
      cache: 'yesterday\'s articles, on standby',
      net: 'slow… then 200 OK',
      page: 'fetch("/api/articles")',
      edges: [
        { id: 'toSw', from: 'page', to: 'sw' },
        { id: 'toNet', from: 'sw', to: 'net' },
        { id: 'toCache', from: 'sw', to: 'cache' },
      ],
    }),
    highlight: { active: ['toNet', 'net'], compare: ['toCache'] },
    explanation: `Strategy 2 of ${requestTypes} — NETWORK-FIRST: try the real thing; fall back to the cache when the network fails or a timeout expires. The news feed is fresh when you are online and yesterday's-but-present when you are not — stale data beating a spinner of death. The price is paid in latency: every request waits out the network attempt before the fallback rescues it, so a flaky 2G connection makes the app feel broken-then-magically-fine. Use it for data that MUST be current when currency is possible: feeds, prices, account state.`,
  };

  yield {
    state: proxy({
      sw: 'stale-while-revalidate',
      cache: 'avatar.jpg â†’ served instantly',
      net: 'fetching fresh copy in background',
      page: 'painted in 2ms',
      edges: [
        { id: 'toSw', from: 'page', to: 'sw' },
        { id: 'toCache', from: 'sw', to: 'cache' },
        { id: 'refresh', from: 'net', to: 'cache' },
      ],
    }),
    highlight: { found: ['toCache'], active: ['refresh'] },
    explanation: `Strategy 3 of ${requestTypes} — STALE-WHILE-REVALIDATE, the crowd favorite: answer from cache IMMEDIATELY (the user never waits), and simultaneously fetch a fresh copy in the background to overwrite the cache for NEXT time. Every response is instant; every response is at most one visit old. Avatars, article images, CSS that changes occasionally — this is their home. The caveat is baked into the name: the user is permanently one version behind, so never use it for anything where "almost current" is a bug — balances, inventory, auth.`,
    invariant: `SWR trades one version of freshness for zero milliseconds of waiting — on every single request, across all ${requestTypes} request categories.`,
  };

  yield {
    state: matrixState({
      title: 'Which strategy for which request?',
      rows: [
        { id: 'shell', label: 'app shell, fonts' },
        { id: 'media', label: 'images, avatars' },
        { id: 'api', label: 'API data, feeds' },
        { id: 'auth', label: 'POST, payments, auth' },
      ],
      columns: [{ id: 'strat', label: 'strategy' }, { id: 'why', label: 'because' }],
      values: [[1, 2], [3, 4], [5, 6], [7, 8]],
      format: (v) => ['', 'precache + cache-first', 'immutable, version-named', 'stale-while-revalidate', 'instant beats current', 'network-first + fallback', 'fresh when possible', 'network-only', 'never serve a stale truth'][v],
    }),
    highlight: { active: ['shell:strat'], removed: ['auth:strat'] },
    explanation: `The routing table every PWA converges on — workbox, the standard library for this, ships these ${requestTypes} request types as named recipes. Two pieces of housekeeping complete the picture: VERSION your caches (cache-v42) and delete old ones in the activate event, or stale shells haunt users forever; and respect the storage quota — the browser can evict your caches under pressure, so a ${topic.title.split('&')[0].trim().toLowerCase()} must always treat the cache as a fast maybe, never a guarantee. Step back and the pattern is an old friend: cache-first, network-first, and SWR are the same freshness-versus-latency trades a CDN makes — this is just the CDN you get to program, parked one millimeter from the user.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'a proxy moves in') yield* movesIn();
  else if (view === 'the caching strategies') yield* strategies();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a request path that changes after registration. A service worker is an event-driven worker script registered for an origin and scope; once active, it can intercept controlled fetches and choose a response.',
        {
          type: 'callout',
          text: 'A service worker moves fetch policy into a programmable browser-side proxy, so offline behavior becomes application logic.',
        },
        'The active highlight marks the current lifecycle gate: register, install, activate, fetch, cache hit, network miss, or offline fallback. A visited cache entry is local state the worker may use; a found response is the response returned to the page.',
        'The safe inference rule is simple: a controlled request reaches the worker first, but only after the worker is installed and activated for that scope. Before activation, the page behaves like a normal web page and the cache is only ordinary browser state.',
      
        {type: 'image', src: './assets/gifs/service-workers.gif', alt: 'Animated walkthrough of the service workers visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A normal web page depends on the network for navigation, scripts, images, API data, and fonts. If the train enters a tunnel, the browser can only wait, fail, or use whatever the HTTP cache happens to contain.',
        'An application needs policy, not luck. It may want the shell to open offline, lesson data to fall back to a cached copy, and writes to wait in a durable outbox.',
        'A service worker gives the browser app a programmable proxy near the user. The worker can answer from Cache Storage, forward to the network, synthesize a response, or combine local state with later synchronization.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to let every request go to the network and rely on HTTP caching headers. This works well for many assets, especially files with content hashes and long cache lifetimes.',
        'The second approach is to add retry buttons and error screens. That helps a failed request, but it does not give the application a coherent offline startup path.',
        'These approaches are reasonable because the browser already has a cache and fetch stack. They fail when the product needs release-aware caching, offline reads, queued writes, and fallback choices that depend on the request type.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that the browser HTTP cache does not know product meaning. It cannot know that hashed JavaScript is cache-first, a balance endpoint is network-only, and a lesson thumbnail is fine to serve stale while refreshing.',
        'Update coordination is another wall. A cached old HTML file can point to deleted chunks, or a new script can run with old CSS if the release is not treated as one unit.',
        'Offline writes add a harder boundary. A POST that fails because the user is offline must not silently disappear, and blindly replaying it later can duplicate work unless the server and client agree on idempotency.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The service worker makes request handling explicit application code. The app can route by request destination, URL, method, cache name, version, freshness requirement, and offline behavior.',
        'Cache Storage is the main data structure for responses. It stores request-response pairs in named caches, while IndexedDB is usually the better store for structured offline state and queued writes.',
        'The lifecycle gives releases a boundary. Install can build a complete cache before the worker becomes usable, and activate can clean old caches after the new worker is ready.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A page calls navigator.serviceWorker.register with a worker script URL. The browser downloads the script, binds it to a scope, and runs install when the script is new.',
        {
          type: 'image',
          src: 'https://web.dev/static/articles/service-worker-lifecycle/image/error-displayed-service.png',
          alt: 'Chrome DevTools showing a service worker registration error',
          caption: 'Service worker lifecycle bugs are visible in browser tooling because the worker persists outside the page reload path. Source: web.dev service worker lifecycle article https://web.dev/articles/service-worker-lifecycle.',
        },
        'During install, the worker often opens a versioned cache and precaches the application shell. During activate, it can delete obsolete caches and claim clients if the app deliberately wants open pages to switch.',
        'During fetch, the worker receives a FetchEvent and calls respondWith with a Response promise. A cache-first route checks Cache Storage first, a network-first route tries the network before fallback, and stale-while-revalidate returns cached data while refreshing in the background.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because the worker is between controlled pages and the network. If the worker returns a valid Response, the page does not need the origin server for that request.',
        'The correctness argument is a routing argument. For each request class, the worker must define the source of truth, the fallback, the cache update rule, and the miss path.',
        'The lifecycle prevents half-installed releases from becoming the active offline layer. If precaching required files fails during install, the old worker can continue controlling users instead of activating an incomplete cache.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The install cost grows with the number and size of precached assets. A shell with 40 files totaling 8 MB costs more bandwidth and storage than a shell with 12 files totaling 900 KB.',
        'Fetch cost becomes policy-dependent. Cache-first can be a local lookup, network-first can wait on a slow connection, and stale-while-revalidate spends background bandwidth to keep the next read fresh.',
        'The hidden cost is persistence. A buggy worker can survive reloads, control multiple tabs, and keep serving old code until the lifecycle advances, so teams must test update, unregister, cache eviction, offline mode, and old-tab behavior.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Service workers fit app shells, documentation sites, education tools, maps, dashboards, media viewers, and repeat-visit products where startup should survive weak connectivity. The pattern works best when static assets are versioned and dynamic data has explicit freshness rules.',
        'They also support background capabilities such as push events, cross-client coordination, and retrying queued work when connectivity returns. IndexedDB often carries the durable state while the service worker owns the request policy.',
        'The same idea appears at larger scale in CDNs and edge caches. The service worker is closer to the user than any edge server, but it is also constrained by browser storage, security rules, and origin scope.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when teams cache mutable truth without a policy. Balances, permissions, inventory, payment results, and authentication state should not be served stale just because a cached response exists.',
        'It fails when release assets are not versioned. Cache-first only works for immutable or versioned files; otherwise users can be trapped on stale JavaScript or mismatched chunks.',
        'It also fails when developers treat the worker as a security bypass. Service workers do not directly access the DOM, do not ignore CORS, and require secure contexts outside local development.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A course app ships index.html, app.44.js, app.44.css, logo.svg, and lessons.json. During install, the worker opens app-shell-v44 and caches those 5 files.',
        'On navigation, the worker uses network-first for index.html with a 1500 ms timeout, then falls back to the cached shell. For app.44.js and app.44.css it uses cache-first because the version is in the filename.',
        'A user completes quiz attempt 817 while offline. The app writes the attempt to IndexedDB with idempotency key attempt-817, the worker or foreground app retries later, and the server accepts the write once instead of creating duplicates.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN Service Worker API at https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API, MDN Using Service Workers at https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers, the W3C Service Workers specification at https://w3c.github.io/ServiceWorker/, and web.dev service worker lifecycle at https://web.dev/articles/service-worker-lifecycle.',
        'Study HTTP caching and ETags first, then Cache Storage, IndexedDB, background sync, push notifications, CORS, CDN request flow, and idempotency keys for offline writes.',
      ],
    },
  ],
};
