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
        `A service worker is JavaScript code running in its own thread, sitting between your page and the network as a programmable proxy. You write the rules; every request flows through code you authored before reaching the internet. Once installed, it answers from cache, network, or thin air. This is offline-first: why PWAs like Twitter Lite and Starbucks work when airplanes land with no WiFi. Service workers enforce HTTPS (tamper-proof), persist across reloads, and control every request in their scope — they are powerful, with unusual ceremonies (register, install, activate), but your app's architecture becomes yours to shape, not the network's.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Lifecycle: First, REGISTRATION — your page calls \`navigator.serviceWorker.register("sw.js")\`. Second, INSTALL — the browser fires an install event; you precache the shell (HTML, CSS, JS, logos). Install fails if precache fails; the old worker survives. The new worker waits until every old tab closes — why "close all tabs to update" exists. Third, ACTIVATE — once old tabs are gone, activate fires; clean up stale caches and take the wheel.`,
        `From activation, every fetch fires a fetch event inside the worker. You call \`event.respondWith(response)\` to choose the answer: \`caches.match(request)\` hits cache in 2–5 ms; \`fetch(request)\` tries the network; synthesize from IndexedDB or stale data offline. The network is one source among many; your code decides priority. Cache keeps the app alive; background sync queues mutations for when connectivity returns.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Installation: O(S) where S is the shell size (500 KB–2 MB typical). Fetch: cache hits cost 2–5 ms and zero bytes; misses cost the full network round-trip. Network-first with timeout adds 100–3000 ms latency while waiting. Stale-while-revalidate costs background bandwidth but buys instant responses every time. Storage quota is browser-enforced: ~50 % disk on desktop, ~4–6 % on mobile. Your cache is a fast maybe — browsers evict under pressure. Testing offline is hard; debugging requires DevTools and manual unregistration. Ship a robust PWA in 1–2 weeks.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Twitter Lite precaches the shell, network-first on API calls with stale fallback, background-syncs tweets written offline. Starbucks orders the same way. Google Docs precaches the editor, network-first on loads, SWR on comments — draft offline, sync later. All need to survive subway rides and planes. Beyond offline: precaching shell cuts first-contentful-paint from 600 ms (CDN round-trip) to 2 ms (cache). Enable instant navigation by deferring non-critical assets. Power web push notifications (wake the worker even when no tab is open). Financial apps enforce request signing at the proxy layer before the page sees it. Defend against man-in-the-middle: once the shell is cached, attackers cannot inject code because the worker answers from cache, not the network.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Deadliest: treat cache as a guarantee. Browsers evict when full; users clear it. Degrade gracefully — show "synced 2 hours ago" on stale data. Versioning trap: if you cache app.js then deploy a new version, old workers in old tabs serve old code until those tabs close. Unversioned caches pile up forever — always delete obsolete caches in activate. Testing pitfall: workers persist across reloads; you must manually unregister or debug against stale code. SWR for sensitive data is a bug: never use it for balances, auth, or real-time state — one version behind is wrong. Storage quota: unbounded caches evict themselves; implement eviction policy for large media.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `IndexedDB queues mutations offline and holds stale fallbacks. Background sync wakes the worker to retry queued updates. Web Workers: A Second Thread shows the threading model. Cache-first, network-first, and SWR mirror what CDN Request Flow teaches at internet scale — pattern recognition at your edge. LRU Cache underlies Cache API eviction. The Event Loop explains the queue workers consume events from. How DNS Works explains why HTTPS is mandatory — workers are so powerful they must be tamper-proof.`,
      ],
    },
  ],
};

