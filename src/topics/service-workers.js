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
  yield {
    state: proxy({
      page: 'fetch("/articles")',
      net: 'reachable… for now',
      edges: [{ id: 'direct', from: 'page', to: 'net' }],
    }),
    highlight: { active: ['direct'] },
    explanation: 'An ordinary web page: every fetch travels straight to the network (through the whole stack this site has mapped — DNS, TCP, maybe a CDN). The architecture has a single point of failure you carry in your pocket: no signal, no app. Native apps shrug at airplane mode; classic web pages show a dinosaur. The fix is to put something programmable IN THE PATH — a layer that can answer on the network\'s behalf.',
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
    explanation: 'The page calls register("sw.js") and the browser spins up a SERVICE WORKER — a worker (same family as Web Workers: own thread, no DOM) with a special privilege and a ceremony. The privilege: it may intercept network traffic for the whole site. The ceremony: an INSTALL event fires first, and the worker uses it to PRECACHE the application shell — HTML, CSS, JS, logo — into the Cache API (a programmable HTTP cache, cousin of the LRU Cache idea with you holding the eviction keys). Then it waits to ACTIVATE: by default a new worker version takes over only when every old tab closes — that is literally why "close all tabs to update" is a thing in PWAs.',
    invariant: 'Install precaches before the worker ever serves a request: the shell is guaranteed present or installation fails.',
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
    explanation: 'Activated, the worker takes its seat as a MAN-IN-THE-MIDDLE — the benevolent kind (and the reason service workers demand HTTPS: this much power over traffic must be tamper-proof). From now on EVERY request the page makes fires a fetch event inside the worker first. The handler calls event.respondWith(...) and chooses: forward to the network? Answer from cache? Synthesize a response from thin air? The network just became optional — a resource your code consults, not a dependency it dies with.',
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
    explanation: 'Airplane mode. The network node is gone — and the app loads anyway: the fetch event fires, the worker answers from the precached shell, the page renders, queued writes wait in IndexedDB for the connection\'s return (background sync). This is OFFLINE-FIRST, the architecture behind installable PWAs — Twitter Lite, Starbucks, Google Docs offline. The mental shift is the whole lesson: the network stopped being the app\'s foundation and became one of several places a response might come from — and your code, not the browser, ranks them.',
  };
}

function* strategies() {
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
    explanation: 'Strategy 1 — CACHE-FIRST: check the cache; only on a miss go to the network (and cache the answer for next time). The logo answers in ~2ms with zero bytes of data used. Perfect for the app shell, fonts, versioned assets — anything immutable. The danger is its mirror image: cache-first never notices that the file CHANGED on the server. The discipline that makes it safe is versioned filenames (app.v42.js) — exactly the immutability trick CDN Request Flow uses at planet scale.',
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
    explanation: 'Strategy 2 — NETWORK-FIRST: try the real thing; fall back to the cache when the network fails or a timeout expires. The news feed is fresh when you are online and yesterday\'s-but-present when you are not — stale data beating a spinner of death. The price is paid in latency: every request waits out the network attempt before the fallback rescues it, so a flaky 2G connection makes the app feel broken-then-magically-fine. Use it for data that MUST be current when currency is possible: feeds, prices, account state.',
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
    explanation: 'Strategy 3 — STALE-WHILE-REVALIDATE, the crowd favorite: answer from cache IMMEDIATELY (the user never waits), and simultaneously fetch a fresh copy in the background to overwrite the cache for NEXT time. Every response is instant; every response is at most one visit old. Avatars, article images, CSS that changes occasionally — this is their home. The caveat is baked into the name: the user is permanently one version behind, so never use it for anything where "almost current" is a bug — balances, inventory, auth.',
    invariant: 'SWR trades one version of freshness for zero milliseconds of waiting — on every single request.',
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
    explanation: 'The routing table every PWA converges on — workbox, the standard library for this, ships these four as named recipes. Two pieces of housekeeping complete the picture: VERSION your caches (cache-v42) and delete old ones in the activate event, or stale shells haunt users forever; and respect the storage quota — the browser can evict your caches under pressure, so a service worker must always treat the cache as a fast maybe, never a guarantee. Step back and the pattern is an old friend: cache-first, network-first, and SWR are the same freshness-versus-latency trades a CDN makes — this is just the CDN you get to program, parked one millimeter from the user.',
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
        "Read the animation as the execution trace for Service Workers & Offline-First. A programmable proxy between page and network: intercept every request, answer from cache, survive airplane mode..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Problem',
      paragraphs: [
        'A normal web page is dependent on the network path. A navigation, script fetch, image load, API request, and font request all travel through browser networking, DNS, TCP or QUIC, TLS, caches, CDNs, and origins. When the connection is slow or absent, the page often has no local decision point. It waits, errors, or shows a fallback built into the browser rather than the application.',
        'A service worker adds that decision point. It is a worker-like JavaScript program that the browser can run between controlled pages and the network. Requests inside its scope fire fetch events in the worker first. The worker can answer from Cache Storage, forward to the network, synthesize a response, update a cache, or queue an action for later. That is the core mechanism behind offline-first web apps and many installable PWAs.',
        'This power is intentionally constrained. Service workers are scoped to an origin and path, run without direct DOM access, and require secure contexts outside local development. They can control traffic, so the platform treats them as security-sensitive infrastructure rather than ordinary page scripts.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The naive app lets every request go directly to the network and trusts the browser HTTP cache to help when it can. This is enough for many sites. Versioned assets can be cached by normal HTTP headers, and dynamic data can be fetched fresh.',
        'The wall appears when the product is supposed to behave like an application. The user opens it on a train, on hotel Wi-Fi, or after the origin has a transient outage. The shell should still start. Previously viewed content should still be readable. A write should not disappear just because the connection failed. Ordinary network fetches do not provide that application-level policy.',
        'Another wall is update coordination. A multi-file JavaScript app needs HTML, scripts, styles, fonts, and icons from the same release. If caching is accidental, old HTML can point to deleted chunks or a new script can run with old CSS. Offline support needs a release-aware cache plan, not a bag of remembered responses.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to move request policy into a programmable proxy near the user. Instead of treating the network as the only source of truth, the application defines a route table. Some requests should be cache-first because they are immutable assets. Some should be network-first because freshness matters. Some should be stale-while-revalidate because instant display is worth being one version behind. Some should be network-only because stale truth would be dangerous.',
        'Cache Storage is the main data structure. It is a browser-managed store of Request-to-Response entries that service workers can open by name. A precache cache can hold a versioned application shell. Runtime caches can hold images or API responses under size and freshness policies. IndexedDB can hold structured offline state and write queues. The worker coordinates these stores when fetch, sync, push, and message events arrive.',
      ],
    },
    {
      heading: 'Lifecycle',
      paragraphs: [
        'Registration starts with a page calling navigator.serviceWorker.register("sw.js"). The browser downloads the worker script and associates it with a scope. A worker registered at the site root can control more URLs than a worker registered in a subdirectory. Scope is a security and routing boundary.',
        'Install is the first gate. The worker receives an install event and often opens a versioned precache, then stores the required shell files. If the install promise rejects, the new worker does not become the offline layer. That is a feature: keeping the old worker is safer than activating an incomplete release.',
        'Activate is the cleanup and ownership gate. A newly installed worker may wait while old tabs remain controlled by the previous worker. During activate, the worker can delete obsolete caches, enable navigation preload, and claim clients if the application deliberately wants open pages to switch controllers. This lifecycle is why update bugs often involve old tabs and old cache names.',
        'Fetch is the serving gate. For each controlled request, the worker can call event.respondWith and provide a Response. The worker must return quickly enough to avoid making the app feel stuck, and it must handle cache misses as normal because browser storage can be evicted under pressure.',
      ],
    },
    {
      heading: 'Caching strategies',
      paragraphs: [
        'Cache-first checks Cache Storage first and goes to the network only on a miss. It is appropriate for hashed JavaScript chunks, CSS files, fonts, icons, and other immutable release assets. The safety requirement is versioned keys. If app.js can change without the key changing, cache-first can trap users on stale code.',
        'Network-first tries the network and falls back to cache when offline or after a timeout. It is useful for HTML navigations, feeds, documents, and API data where freshness is preferred but stale content is better than a blank screen. Navigation preload is a companion optimization for network-first HTML because it lets the browser start the document request while the worker boots.',
        'Stale-while-revalidate returns a cached response immediately and refreshes the cache in the background. It is a good fit for avatars, article images, documentation pages, and noncritical assets where instant display is more important than absolute freshness. It is a bad fit for balances, permissions, inventory, payments, and authentication state.',
        'Network-only should be explicit for operations where stale data is unsafe. POST writes, payment confirmations, login flows, and security-sensitive decisions should usually hit the server or enter a durable outbox with clear retry semantics, not silently reuse an old cached response.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a courseware PWA ships a shell made of index.html, app.44.js, app.44.css, a logo, and a small lesson index. During install, the worker opens app-shell-v44 and precaches those entries. If one required file returns an error, install fails and the old v43 worker continues serving users.',
        'On a normal online navigation, the worker uses network-first for HTML so the user can receive the latest document. If the network fails, it returns the cached shell. For app.44.js and app.44.css, it uses cache-first because the content hash or release number is in the filename. For lesson thumbnails, it uses stale-while-revalidate because instant display is worth refreshing in the background.',
        'Now the user goes offline. The shell still loads because the fetch handler can answer the navigation and assets from Cache Storage. A completed quiz attempt is written to IndexedDB and placed in an outbox. When connectivity returns, a background sync or foreground retry drains the outbox to the server. Offline-first is therefore more than cached files; it is a policy for reads, writes, conflicts, and eventual synchronization.',
      ],
    },
    {
      heading: 'What the animation shows',
      paragraphs: [
        'The proxy view shows the architectural change. Before the worker exists, the page sends a request directly toward the network. During install, the worker fills a cache with the shell. After activation, a page fetch reaches the worker first, and the worker chooses cache, network, or a synthetic response. In airplane mode, the network path disappears but the cache path can still produce the shell.',
        'The strategy view shows that service workers are not one caching algorithm. Cache-first optimizes for speed and offline durability. Network-first optimizes for freshness with fallback. Stale-while-revalidate optimizes for instant display while refreshing the next visit. The matrix is the route table a production worker needs: assets, media, API data, auth, and writes each deserve different policies.',
        'The most important lesson is that the service worker is not simply a faster HTTP cache. It is application code in the request path. That means it can express product policy, but it can also ship product bugs that persist across reloads.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because request handling becomes a state machine under application control. The worker can inspect the request, choose a route, consult a named cache, race the network, update storage, and return a Response. The browser still enforces origin boundaries, secure contexts, and storage policy, but the application chooses the freshness and fallback behavior.',
        'It also works because install and activate give the cache lifecycle structure. Install can require a complete shell before the worker becomes active. Activate can delete old caches only after the new worker is ready. This turns offline support from opportunistic caching into a release process.',
        'Finally, the pattern works because caches are local and fast. A shell cache hit avoids the network path entirely. Even when the worker eventually refreshes from the network, the user can see something useful first.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Install cost is proportional to the number and size of precached assets. A large shell makes first install slow and increases quota pressure. Runtime caches need expiration rules because image and API caches can grow without bound.',
        'Network-first can add latency when the network is slow but not fully down. A timeout fallback can improve user experience, but it creates a freshness choice that the product must own. Stale-while-revalidate spends background bandwidth and can show old content by design.',
        'Service workers also increase debugging complexity. They persist across reloads, can control multiple tabs, and can keep serving old code until the lifecycle advances. Developers need to test unregister, update, skip-waiting, activate cleanup, offline mode, cache eviction, and multiple open tabs.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Service workers win for app shells, documentation, education tools, dashboards, news readers, maps, media-heavy sites, and any product where repeat visits should start quickly or survive flaky connectivity. They are especially strong when the static shell is known at build time and dynamic data can be routed through explicit freshness policies.',
        'They also win for background capabilities. A worker can receive push events, coordinate messages across controlled clients, and help drain an offline outbox when connectivity returns. Combined with IndexedDB, a service worker can make a browser app behave more like a resilient local application.',
        'The pattern is a browser-scale version of edge caching. CDN Request Flow answers close to the user from a global edge. A service worker answers even closer, inside the browser, but with application-specific route logic.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when teams cache mutable truth without a freshness policy. Balances, permissions, inventory, auth state, and payment results should not be served stale just because a cache entry exists. It fails when app assets are not versioned and users get trapped on old JavaScript.',
        'It fails when cache cleanup races old tabs. If activate deletes v43 chunks while a v43-controlled tab still needs them, the app can break after a lazy import. It fails when the worker assumes storage is permanent. Browsers can evict origin data under pressure, so every cache read needs a miss path.',
        'It also fails when developers forget that service workers do not bypass web security. They cannot read cross-origin responses that CORS would block. They cannot directly touch the DOM. They do not replace server-side authorization. They are powerful, but they are still inside the browser security model.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Web Workers for thread isolation, The Event Loop for worker events, Cache Storage Versioned Precache for manifest sets and activate cleanup, Service Worker Navigation Preload Race for faster network-first HTML, Background Sync Outbox Queue for offline writes, Web Push Subscription Delivery for server wakeups, Browser Message Channels for cross-tab coordination, URL Origin Parser for scope and same-origin boundaries, HTTP Cache ETag Revalidation for validators, HTTP Vary Cache-Key Normalization for cache keys, CORS Preflight Cache for cross-origin permission caching, Browser Storage Quota and Eviction Manager for pressure behavior, CDN Request Flow for the larger caching analogy, and Local-First Sync Engine Case Study for conflict-aware offline collaboration.',
      ],
    },
      {
      heading: 'Why this exists',
      paragraphs: [
        "State the real constraint this topic fixes before introducing the mechanism.",
        "A good opening says what gets too slow, too fragile, or too hard to reason about under baseline behavior.",
        "Without that, every optimization appears decorative.",
      ],
    },

    {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },

    {
      heading: 'How it works',
      paragraphs: [
        "Describe the mechanism as a sequence of state transitions, not as a story.",
        "Each step should say what changes, what stays true, and why the move is legal.",
        "The animation should look like this section made concrete.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why Service Workers & Offline-First moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};

