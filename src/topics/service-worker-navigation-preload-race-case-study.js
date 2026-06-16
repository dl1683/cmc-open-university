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
      heading: 'What it is',
      paragraphs: [
        'Navigation preload is a service-worker feature for document navigations. It lets the browser start a network request in parallel with service-worker startup, then exposes that response through FetchEvent.preloadResponse.',
        'MDN describes NavigationPreloadManager as managing resources preloaded in parallel with service-worker bootup: https://developer.mozilla.org/en-US/docs/Web/API/NavigationPreloadManager. The ServiceWorkerRegistration.navigationPreload property exposes that manager: https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/navigationPreload.',
      ],
    },
    {
      heading: 'Core data structure',
      paragraphs: [
        'The main structure is a small state machine around a navigation request: registration setting, activation-time enablement, browser-started preload fetch, fetch-event handler, preloadResponse promise, cache fallback, and final Response.',
        'The important performance move is parallelism. Without preload, the path is service-worker boot, then handler, then network. With preload, boot and network overlap. The handler consumes the already-started response or falls back to Cache Storage.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A documentation PWA uses network-first HTML because the home page should reflect the latest release. After a user has been away for hours, the service worker is cold. Navigation preload is enabled during activate, so the browser starts the HTML fetch immediately while the worker boots. The handler returns event.preloadResponse when it succeeds, or the versioned app shell when offline.',
        'This ties together Service Workers & Offline-First, Cache Storage Versioned Precache, HTTP Cache ETag Revalidation, and Resource Hints: Preload & Preconnect. The page can be offline-capable without making the online navigation path pay a cold-start waterfall.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Navigation preload is not a replacement for precaching. It is a way to avoid service-worker startup delaying a network-first navigation. If the app should work offline, the service worker still needs a cache fallback.',
        'Do not start a duplicate network fetch when preloadResponse is available. If the server varies the response based on the Service-Worker-Navigation-Preload request header, include the corresponding Vary behavior so shared caches do not mix variants.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN NavigationPreloadManager at https://developer.mozilla.org/en-US/docs/Web/API/NavigationPreloadManager, MDN ServiceWorkerRegistration.navigationPreload at https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/navigationPreload, MDN NavigationPreloadManager.setHeaderValue at https://developer.mozilla.org/en-US/docs/Web/API/NavigationPreloadManager/setHeaderValue, and web.dev navigation preload guidance at https://web.dev/blog/navigation-preload.',
        'Study next: Service Workers & Offline-First for fetch interception, Cache Storage Versioned Precache for offline shell installation, HTTP Vary Cache-Key Normalization for Service-Worker-Navigation-Preload variants, HTTP Cache ETag Revalidation for network-first HTML validation, Resource Hints: Preload & Preconnect for other early network work, and Tail Latency & p99 Thinking for why cold starts matter.',
      ],
    },
  ],
};
