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
      cache: 'shell (4 files) → HIT',
      net: '✈ UNREACHABLE',
      page: 'app loads anyway ✓',
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
      cache: 'logo.svg → HIT (2ms)',
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
      cache: 'avatar.jpg → served instantly',
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
      heading: `What it is`,
      paragraphs: [
        `A service worker is a programmable proxy that sits between a page and the network. It is worker-like, isolated from the DOM like Web Workers: A Second Thread, but it has a special privilege: fetch events for every request inside its scope pass through your code first. Your handler can answer from the Cache Storage API, try the network, synthesize a response, or queue work for later. That is the core of offline-first web apps. Browsers require HTTPS, except for localhost development, because this much control over traffic must be tamper-resistant.`,
        `The visualization shows the proxy moving in. Before installation, a page request depends on How DNS Works, TCP: Handshake & Congestion Control, and the network being reachable. After activation, the service worker can serve the app shell from cache even in airplane mode.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The lifecycle has three gates. Registration calls navigator.serviceWorker.register("sw.js"). Install is where the worker precaches the shell: HTML, CSS, JavaScript, icons, and other versioned assets. If that promise fails, the new worker is not installed. Activate is where old caches are cleaned and the new worker takes control, often after old tabs close unless you deliberately skip waiting. Scope matters: a worker controls only URLs below its registration path.`,
        `Once active, fetch events call event.respondWith. Cache-first checks cache before network, ideal for immutable shell files. Network-first tries fresh data and falls back when offline. Stale-while-revalidate answers immediately from cache and refreshes in the background. The second visualization compares exactly these strategies and their freshness-latency trade-offs.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Install cost is O(S) in the size of the precached shell. A cache hit is usually milliseconds and no network bytes; a miss pays the full network path. Network-first can add timeout latency before fallback. Stale-while-revalidate spends background bandwidth to make the visible response instant. Storage quota is browser-specific and eviction can happen under pressure, so the cache is a fast maybe, not permanent storage. LRU Cache explains the eviction idea; browsers manage the final policy.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `PWAs precache their shell so repeat visits start without a network round trip. News apps use network-first for feeds with stale fallback. Documentation sites and education sites can use cache-first for versioned assets and stale-while-revalidate for images. CDN Request Flow is the same pattern at global scale: answer close to the user when safe, refresh or miss to the origin when needed. A service worker is the edge cache you can program inside the browser.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The hardest bug class is stale code. If you cache app.js without versioning, old tabs may keep serving the old shell. Cache Invalidation & Versioning is not optional: version files, version cache names, delete obsolete caches in activate, and test update paths. Do not use stale-while-revalidate for balances, auth, payments, or anything where "one version old" is wrong.`,
        `Testing is also tricky because workers persist across reloads. DevTools unregister and update controls are part of the workflow. The Event Loop still matters: fetch, install, sync, and push handlers are events, and long handlers can delay later work.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Web Workers: A Second Thread for isolation, The Event Loop for worker events, and LRU Cache for eviction intuition. How DNS Works, TCP: Handshake & Congestion Control, and CDN Request Flow explain the network path a worker may skip. Cache Invalidation & Versioning is the production follow-up, and Message Queues gives the server-side version of offline mutation retry.`,
      ],
    },
  ],
};
