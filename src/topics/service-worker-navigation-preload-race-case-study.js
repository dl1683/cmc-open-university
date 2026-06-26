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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the frames as a race between a service worker, a browser script that intercepts fetches, and the document network request. Active items are the current decision point, visited items already happened, and the found response is the one the fetch handler returns. The safe inference is that preload starts likely network work early without bypassing service-worker authority.',
        {type:"callout", text:"Navigation preload turns a cold-start waterfall into a controlled race where the service worker keeps authority while the browser starts the likely network winner early."},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A service worker is a browser script that can intercept fetches, serve cached files, and provide offline fallback. For a navigation request, the browser may need to wake a stopped worker before the page receives HTML. If the route almost always fetches fresh HTML online, that wake-up can delay the request that the app wanted anyway.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious offline-capable route is network first, cache fallback. The fetch handler starts, calls fetch for the document, and returns a cached shell if the network fails. That policy is sound, but on a cold worker it serializes startup before the network request.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the waterfall. If worker startup takes 180 ms and the origin HTML takes 320 ms, the old critical path is about 500 ms before handoff overhead. The user waits for work that could have overlapped.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Start the navigation network request while the worker wakes, then hand the response promise to the fetch event. The handler still decides the final response through event.preloadResponse. Preload is not a cache policy; it is an overlap and handoff mechanism.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'During activation, the service worker enables registration.navigationPreload. On future navigations, the browser starts a special request and exposes it as event.preloadResponse. The handler awaits that promise, returns it when suitable, or falls back to ordinary fetch and cache logic when it is missing or rejected.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from keeping one decision point. The browser-started response is only an input to the fetch handler, so offline fallback, authentication checks, cache updates, and error handling can still run. Latency improves because startup and network time overlap instead of adding together.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Preload can waste a request if the handler later chooses a cached response. It is a good trade for network-first HTML and a bad trade for cache-first assets or synthetic responses. The implementation must handle unsupported browsers, rejected promises, duplicate-fetch bugs, and the Service-Worker-Navigation-Preload header.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'It fits documentation sites, dashboards, commerce pages, authenticated apps, and news-like pages that want fresh HTML online and a usable fallback offline. It helps most on mobile and memory-constrained devices, where workers are more likely to be stopped between visits.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Navigation preload does not provide offline support by itself. It fails when the handler ignores event.preloadResponse and performs a second fetch, or when a rejected preload breaks navigation instead of falling back. It also should not be applied to POST writes, hashed static assets, or APIs with separate cache rules.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A docs PWA has a 170 ms cold worker and a 280 ms HTML request. Without preload, time to first byte is roughly 450 ms plus handler overhead. With preload, both start together, so the critical path is closer to 280 ms; if the network fails, the handler still returns the cached shell.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study MDN NavigationPreloadManager, ServiceWorkerRegistration.navigationPreload, FetchEvent.preloadResponse, the web.dev navigation preload guide, Cache Storage, HTTP Vary, ETag revalidation, and resource hints. The systems lesson is to overlap a likely data-plane operation while preserving the control-plane decision.',
      ],
    },
  ],
};
