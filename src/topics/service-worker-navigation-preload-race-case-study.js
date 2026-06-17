// Service worker navigation preload: start the HTML navigation fetch in
// parallel with service-worker boot so network-first routes avoid a cold-start
// serial waterfall.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'service-worker-navigation-preload-race-case-study',
  title: 'Service Worker Navigation Preload Race',
  category: 'Systems',
  summary: 'How navigation preload races service-worker startup with the navigation request, then hands FetchEvent.preloadResponse to network-first HTML routes.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['cold start race', 'preload handoff'], defaultValue: 'cold start race' },
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

function preloadGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'nav', label: 'nav', x: 0.8, y: 4.7, note: notes.nav ?? 'HTML' },
      { id: 'browser', label: 'browser', x: 2.4, y: 4.7, note: notes.browser ?? 'dispatch' },
      { id: 'boot', label: 'boot', x: 4.0, y: 6.2, note: notes.boot ?? 'SW cold' },
      { id: 'preload', label: 'preload', x: 4.0, y: 3.2, note: notes.preload ?? 'off' },
      { id: 'fetch', label: 'fetch', x: 5.8, y: 4.7, note: notes.fetch ?? 'handler' },
      { id: 'cache', label: 'cache', x: 7.4, y: 6.2, note: notes.cache ?? 'shell' },
      { id: 'net', label: 'net', x: 7.4, y: 3.2, note: notes.net ?? 'origin' },
      { id: 'page', label: 'page', x: 9.2, y: 4.7, note: notes.page ?? 'paint' },
    ],
    edges: [
      { id: 'e-nav-browser', from: 'nav', to: 'browser', weight: '' },
      { id: 'e-browser-boot', from: 'browser', to: 'boot', weight: '' },
      { id: 'e-browser-preload', from: 'browser', to: 'preload', weight: '' },
      { id: 'e-boot-fetch', from: 'boot', to: 'fetch', weight: '' },
      { id: 'e-preload-net', from: 'preload', to: 'net', weight: '' },
      { id: 'e-fetch-cache', from: 'fetch', to: 'cache', weight: '' },
      { id: 'e-fetch-net', from: 'fetch', to: 'net', weight: '' },
      { id: 'e-net-page', from: 'net', to: 'page', weight: '' },
      { id: 'e-cache-page', from: 'cache', to: 'page', weight: '' },
    ],
  }, { title });
}

function timelinePlot() {
  return plotState({
    axes: { x: { label: 'ms', min: 0, max: 520 }, y: { label: 'TTFB', min: 0, max: 520 } },
    series: [
      {
        id: 'serial',
        label: 'serial',
        points: [
          { x: 0, y: 0 },
          { x: 120, y: 120 },
          { x: 360, y: 360 },
        ],
      },
      {
        id: 'parallel',
        label: 'parallel',
        points: [
          { x: 0, y: 0 },
          { x: 120, y: 120 },
          { x: 240, y: 240 },
        ],
      },
    ],
    markers: [
      { id: 'boot', x: 120, y: 120, label: 'SW boot' },
      { id: 'win', x: 240, y: 240, label: 'saved RTT' },
    ],
  }, { title: 'Navigation request starts earlier' });
}

function* coldStartRace() {
  yield {
    state: preloadGraph('Without preload, a navigation waits for service-worker boot', { boot: '120ms', preload: 'off', net: 'not yet' }),
    highlight: { active: ['nav', 'browser', 'boot', 'e-nav-browser', 'e-browser-boot'], removed: ['preload', 'net'] },
    explanation: 'A controlled navigation wakes a service worker before the fetch handler can decide what to do. If the worker is cold, the network request can be delayed by boot time.',
    invariant: 'A service worker can improve reliability and still add latency if every path waits for startup.',
  };

  yield {
    state: preloadGraph('The fetch handler starts the HTML request after boot', { boot: 'ready', fetch: 'net first', net: 'HTML fetch' }),
    highlight: { active: ['boot', 'fetch', 'net', 'e-boot-fetch', 'e-fetch-net'], compare: ['cache'] },
    explanation: 'Network-first HTML is common for app shells that should update when online. Without navigation preload, the HTML request begins only after the service worker has started and run the handler.',
  };

  yield {
    state: preloadGraph('Navigation preload lets the browser start network in parallel', { preload: 'on', boot: 'SW cold', net: 'already run' }),
    highlight: { active: ['browser', 'boot', 'preload', 'net', 'e-browser-boot', 'e-browser-preload', 'e-preload-net'], found: ['nav'] },
    explanation: 'When enabled, the browser starts a special navigation request while the service worker boots. The two delays overlap instead of forming a serial waterfall.',
  };

  yield {
    state: timelinePlot(),
    highlight: { removed: ['serial'], found: ['parallel'], active: ['win'], compare: ['boot'] },
    explanation: 'The shape is the whole win: serial boot plus request becomes max(boot, request) plus handoff. On slower mobile devices, avoiding one extra round-trip-sized wait can be visible.',
  };

  yield {
    state: labelMatrix(
      'Route choice',
      [
        { id: 'html', label: 'HTML nav' },
        { id: 'asset', label: 'asset' },
        { id: 'api', label: 'API data' },
        { id: 'post', label: 'POST' },
      ],
      [
        { id: 'preload', label: 'preload' },
        { id: 'fallback', label: 'fallback' },
      ],
      [
        ['yes', 'cache shell'],
        ['no', 'precache'],
        ['maybe', 'net/cache'],
        ['no', 'outbox'],
      ],
    ),
    highlight: { found: ['html:preload', 'html:fallback'], compare: ['api:preload'], removed: ['post:preload'] },
    explanation: 'The complete route table is selective. Navigation preload is built for document navigations, while hashed assets use precache, API data uses its own freshness policy, and offline writes use an outbox.',
  };
}

function* preloadHandoff() {
  yield {
    state: preloadGraph('Activate enables navigation preload before fetch events', { browser: 'activate', preload: 'enable()', boot: 'new SW' }),
    highlight: { active: ['browser', 'preload', 'boot', 'e-browser-preload', 'e-browser-boot'], compare: ['fetch'] },
    explanation: 'The service worker enables navigation preload during activation. That timing matters because activation runs before the worker handles future fetch events.',
    invariant: 'Enable early, consume exactly once in the navigation handler.',
  };

  yield {
    state: preloadGraph('The fetch event receives a preloadResponse promise', { fetch: 'await pre', preload: 'promise', net: 'HTML 200' }),
    highlight: { active: ['preload', 'net', 'fetch', 'e-preload-net', 'e-fetch-net'], found: ['page'] },
    explanation: 'Inside the fetch handler, event.preloadResponse is a promise for the browser-started request. A network-first handler can await it instead of starting a duplicate fetch.',
  };

  yield {
    state: preloadGraph('If the preload succeeds, it becomes the HTML response', { fetch: 'use pre', net: '200 HTML', page: 'fresh' }),
    highlight: { found: ['net', 'page', 'e-net-page'], active: ['fetch'], compare: ['cache'] },
    explanation: 'For a fresh online navigation, the worker can return the preloaded response. The page gets current HTML, and the worker did not delay the request while it warmed up.',
  };

  yield {
    state: preloadGraph('If the preload fails, the cached app shell still works', { preload: 'error', net: 'down', cache: 'shell hit', page: 'offline' }),
    highlight: { removed: ['net', 'e-net-page'], found: ['cache', 'page', 'e-cache-page'], active: ['fetch'] },
    explanation: 'Navigation preload is an optimization, not the only path. If the network fails, the service worker can still return a cached shell or offline page.',
  };

  yield {
    state: labelMatrix(
      'Header contract',
      [
        { id: 'pre', label: 'SW-Preload' },
        { id: 'vary', label: 'Vary' },
        { id: 'cache', label: 'cache' },
        { id: 'dup', label: 'dup fetch' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'bug', label: 'bug' },
      ],
      [
        ['marks req', 'variant'],
        ['key field', 'missing'],
        ['store doc', 'wrong body'],
        ['avoid', 'waste RTT'],
      ],
    ),
    highlight: { active: ['pre:role', 'vary:role'], removed: ['dup:bug'], compare: ['cache:bug'] },
    explanation: 'If the server sends different HTML for navigation-preload requests, it must make that variant visible to caches. Otherwise the preload-specific response can be reused in the wrong context.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'cold start race') yield* coldStartRace();
  else if (view === 'preload handoff') yield* preloadHandoff();
  else throw new InputError('Pick a navigation-preload view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Service workers give web apps a programmable network layer. They can precache an app shell, serve offline pages, rewrite requests, route API traffic, and keep a site usable when the network is unreliable. The cost is that a controlled navigation may need to wake the service worker before the page can receive HTML. If the worker is cold, that startup time can sit in front of the real document request.',
        'Navigation preload exists for the common case where the service worker is useful for fallback and routing, but the online path still wants fresh HTML from the network. Instead of waiting for service-worker startup and then starting the document fetch, the browser starts a special navigation request in parallel with worker boot. When the fetch handler runs, it can receive that already-started request through FetchEvent.preloadResponse.',
        'The feature is not a new caching strategy. It is a race and handoff mechanism. It keeps the service worker in charge of the final response while removing a needless serial delay from network-first navigations.',
      ],
    },
    {
      heading: 'The naive network-first route',
      paragraphs: [
        'A normal offline-capable navigation route often looks like this: handle document requests in the service worker, try the network first, and fall back to a cached shell or offline page if the network fails. This is a good product policy for many apps. Users get fresh HTML when online, but the app still has an answer when the network is down.',
        'The wall is the ordering. On a cold navigation, the browser dispatches the request to the service worker, the worker process starts, the fetch event handler runs, and only then does the handler call fetch for the document. Even if the handler almost always chooses the network, the network request starts after the service-worker cold start. The page pays startup time plus network time on the critical path.',
      ],
    },
    {
      heading: 'Why this hurts page load',
      paragraphs: [
        'The first HTML response is one of the most important requests in the page-load path. It gates parsing, initial rendering, subresource discovery, and often hydration. Adding worker startup before that request is not like delaying an image below the fold. It can move time to first byte and first paint.',
        'The delay is most visible when the worker has been stopped to save memory, when the device is slow, when the browser process is busy, or when the route code performs extra startup work. The site may have excellent caching and still feel slower online because the fresh navigation takes a serial service-worker detour before touching the origin.',
      ],
    },
    {
      heading: 'Core idea',
      paragraphs: [
        'Navigation preload changes the dependency graph. The browser is allowed to start the document network request as soon as it knows a controlled navigation is happening. At the same time, it starts or wakes the service worker. The two operations run in parallel. The fetch handler later receives a promise for the preloaded response.',
        'The handler remains the authority. It can return the preload response, ignore it, use a cached fallback, or perform ordinary fetch logic if the preload is absent or failed. The invariant is simple: one response wins the navigation, but the request that usually wins online does not have to wait for the worker to become ready.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The service worker enables the feature during activation through registration.navigationPreload.enable(). Activation is the right phase because it prepares the newly active worker before future fetch events arrive. Once enabled, navigation fetch events can expose event.preloadResponse, a promise for the browser-started document request.',
        'A typical handler first checks whether the request is a document navigation. For those requests, it awaits event.preloadResponse. If the promise resolves to a response, the handler can return it directly or clone it and update a cache before returning it. If the promise is missing, rejected, or unsuitable, the handler falls back to a normal network fetch or a cached shell.',
        'The mechanism is selective. Hashed JavaScript, CSS, and image assets usually belong in a precache or ordinary HTTP cache. API calls need their own freshness and retry policy. POST writes need outbox or background sync semantics. Navigation preload is primarily for document navigations where the app wants fresh HTML online and a service-worker fallback offline.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The latency improvement comes from replacing addition with overlap. Without preload, a cold navigation can look like worker boot plus handler execution plus origin request. With preload, the origin request and worker boot run at the same time. The critical path becomes closer to the slower of those two operations plus a small handoff cost.',
        'Correctness comes from keeping the fetch event as the decision point. The browser-started request is not automatically committed to the page. It is an input to the handler. That means the same route can still enforce offline fallback, authorization rules, cache update policy, and error handling.',
        'This distinction matters. A service worker is often installed because the app needs control. Navigation preload does not bypass that control. It removes unnecessary waiting when the route policy already says that a fresh network document is the preferred online answer.',
      ],
    },
    {
      heading: 'The preload header contract',
      paragraphs: [
        'Preload requests can carry a Service-Worker-Navigation-Preload header. The default value tells the server that this navigation was started through the preload path. A site can change the header value through the navigation preload manager, but doing so should be treated as part of the cache and server contract.',
        'If the server returns different HTML for preload requests, caches must be able to distinguish the variants. That usually means correct Vary behavior. Without it, a response intended for one request shape can be reused for another. The safest design is to avoid unnecessary response differences, and when differences are required, make them explicit and cache-safe.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'Navigation preload can start network work that the handler later decides not to use. That is acceptable when the route is network-first and the preloaded response is the likely winner. It is wasteful for routes that are cache-first, offline-only, or expected to synthesize a response without touching the origin. The feature should follow the route table rather than being treated as a universal speed switch.',
        'There is also complexity. The service worker must handle preload failures, unsupported browsers, duplicate-fetch risks, and cache variants. If the handler awaits event.preloadResponse and then starts a separate fetch without checking the result, the app can spend two document requests for one navigation. The win depends on consuming the handoff correctly.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'It wins for document navigations controlled by a cold service worker when the desired online behavior is fresh network HTML. Documentation sites, dashboards, commerce shells, authenticated apps, and news-like pages can all fit this profile. The user gets the latest page when online, but the app keeps a cached fallback when offline.',
        'It is especially useful on mobile and memory-constrained environments, where workers are more likely to be stopped between visits. It also helps sites whose service-worker startup includes route-table setup, cache version checks, or module loading. The bigger the cold-start portion of the old waterfall, the more valuable the overlap becomes.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The first failure mode is mistaking preload for offline support. A preloaded network response cannot help when the network is down. Offline behavior still requires installed cache entries, version management, and a route that returns the fallback when the network path fails.',
        'The second failure mode is duplicate work. A handler that ignores event.preloadResponse and always calls fetch repeats the document request. Another version awaits the preload but does not catch rejection, turning a network failure into a broken navigation instead of a cache fallback. The preload path should be an optimization, not the only path.',
        'The third failure mode is applying it too broadly. Static assets with content hashes, API requests with independent caching rules, and POST requests do not become better just because a navigation feature exists. They need their own data and cache policies.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A documentation PWA uses network-first HTML because the home page should show the latest release notes. It also precaches a versioned app shell so returning users can load something useful offline. Without navigation preload, a cold visit starts the service worker, runs the fetch handler, and only then asks the origin for the document.',
        'After enabling navigation preload during activate, the browser starts the document request immediately when the controlled navigation begins. The worker wakes in parallel. The fetch handler checks the preload promise. If it resolves, the handler returns the fresh HTML and may update a cache. If it rejects, the handler falls back to the cached shell. The online path avoids the startup waterfall, while the offline path still works.',
        'The team also audits its route table. HTML navigations use preload. Hashed assets use precache. API calls use ETag revalidation or application-specific caching. Offline writes use an outbox. That separation keeps navigation preload focused on the path where it actually improves latency.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary references include MDN NavigationPreloadManager at https://developer.mozilla.org/en-US/docs/Web/API/NavigationPreloadManager, MDN ServiceWorkerRegistration.navigationPreload at https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/navigationPreload, MDN NavigationPreloadManager.setHeaderValue at https://developer.mozilla.org/en-US/docs/Web/API/NavigationPreloadManager/setHeaderValue, and the web.dev navigation preload guide at https://web.dev/blog/navigation-preload.',
        'Study Service Workers and Offline-First design before this topic, because preload only makes sense once fetch interception and cache fallback are clear. Then study Cache Storage versioned precache, HTTP Vary cache-key normalization, ETag revalidation, Resource Hints such as preload and preconnect, and tail-latency thinking. The deeper lesson is not just web-specific: if a control plane usually chooses a slow data-plane operation, start the data-plane operation early and hand it to the control plane safely.',
      ],
    },
  ],
};
