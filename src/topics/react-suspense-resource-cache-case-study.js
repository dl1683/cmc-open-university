// React Suspense as a coordination structure: boundaries, pending thenables,
// resource caches, retries, stale content, and error boundaries.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'react-suspense-resource-cache-case-study',
  title: 'React Suspense Resource Cache',
  category: 'Systems',
  summary: 'How Suspense boundaries coordinate pending promises, lazy components, resource caches, fallbacks, retries, transitions, and error paths.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['boundary flow', 'cache lifecycle'], defaultValue: 'boundary flow' },
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

function suspenseGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'route', label: 'route', x: 0.9, y: 4.6, note: notes.route ?? 'navigation' },
      { id: 'boundary', label: 'boundary', x: 2.8, y: 4.6, note: notes.boundary ?? 'Suspense' },
      { id: 'component', label: 'component', x: 4.7, y: 5.8, note: notes.component ?? 'reads data' },
      { id: 'cache', label: 'cache', x: 4.7, y: 3.2, note: notes.cache ?? 'key -> record' },
      { id: 'promise', label: 'promise', x: 6.6, y: 5.8, note: notes.promise ?? 'pending' },
      { id: 'fallback', label: 'fallback', x: 6.6, y: 3.2, note: notes.fallback ?? 'skeleton' },
      { id: 'content', label: 'content', x: 8.6, y: 5.0, note: notes.content ?? 'ready UI' },
      { id: 'error', label: 'error', x: 8.6, y: 2.8, note: notes.error ?? 'boundary' },
    ],
    edges: [
      { id: 'e-route-boundary', from: 'route', to: 'boundary', weight: '' },
      { id: 'e-boundary-component', from: 'boundary', to: 'component', weight: '' },
      { id: 'e-component-cache', from: 'component', to: 'cache', weight: '' },
      { id: 'e-component-promise', from: 'component', to: 'promise', weight: '' },
      { id: 'e-boundary-fallback', from: 'boundary', to: 'fallback', weight: '' },
      { id: 'e-promise-content', from: 'promise', to: 'content', weight: '' },
      { id: 'e-promise-error', from: 'promise', to: 'error', weight: '' },
      { id: 'e-cache-content', from: 'cache', to: 'content', weight: '' },
    ],
  }, { title });
}

function* boundaryFlow() {
  yield {
    state: suspenseGraph('A boundary wraps UI that may suspend'),
    highlight: { active: ['route', 'boundary', 'component', 'e-route-boundary', 'e-boundary-component'], found: ['cache'] },
    explanation: 'Suspense is a boundary in the UI tree. If something below it cannot render yet, React can show the boundary fallback instead of committing a half-ready subtree.',
    invariant: 'A boundary is the unit of loading disclosure.',
  };

  yield {
    state: suspenseGraph('A pending resource causes the render to suspend', { cache: 'miss', promise: 'pending fetch', component: 'use(promise)' }),
    highlight: { active: ['component', 'cache', 'promise', 'e-component-cache', 'e-component-promise'], compare: ['content'] },
    explanation: 'When a component reads a pending resource with a Suspense-aware API, rendering suspends. React records the pending thenable and unwinds to the nearest boundary.',
  };

  yield {
    state: suspenseGraph('The boundary commits fallback while work waits', { fallback: 'placeholder', content: 'hidden' }),
    highlight: { found: ['boundary', 'fallback', 'e-boundary-fallback'], removed: ['content'] },
    explanation: 'The fallback is not an error page. It is the boundary-owned placeholder for work that has not produced committed UI yet. The rest of the page can stay interactive.',
  };

  yield {
    state: suspenseGraph('Resolved data retries render and commits content', { promise: 'resolved', cache: 'fulfilled', content: 'real UI' }),
    highlight: { found: ['promise', 'cache', 'content', 'e-promise-content', 'e-cache-content'], removed: ['fallback'] },
    explanation: 'When the promise resolves, React retries the render. This time the resource read returns data, so the boundary can reveal the actual content.',
  };

  yield {
    state: labelMatrix(
      'Boundary design',
      [
        { id: 'page', label: 'page' },
        { id: 'sidebar', label: 'sidebar' },
        { id: 'list', label: 'list' },
        { id: 'chart', label: 'chart' },
      ],
      [
        { id: 'fallback', label: 'fallback' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['shell', 'too broad'],
        ['skeleton', 'ok'],
        ['rows', 'waterfall'],
        ['stale old', 'jank'],
      ],
    ),
    highlight: { found: ['sidebar:fallback', 'chart:fallback'], compare: ['page:risk', 'list:risk'] },
    explanation: 'Boundary placement is product design plus data-structure design. Too broad and a tiny miss hides the whole page. Too narrow and the screen becomes a waterfall of small spinners.',
  };
}

function* cacheLifecycle() {
  yield {
    state: labelMatrix(
      'Resource record',
      [
        { id: 'key', label: 'key' },
        { id: 'pending', label: 'pending' },
        { id: 'ready', label: 'ready' },
        { id: 'error', label: 'error' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'read', label: 'read' },
      ],
      [
        ['url+args', 'lookup'],
        ['promise', 'suspend'],
        ['value', 'return'],
        ['reason', 'throw'],
      ],
    ),
    highlight: { active: ['key:stores', 'pending:read'], found: ['ready:read'], removed: ['error:read'] },
    explanation: 'A Suspense cache is usually modeled as key to record. The record is pending, fulfilled, or rejected. Reads either return a value, suspend on a promise, or throw an error.',
    invariant: 'The cache state determines render behavior.',
  };

  yield {
    state: suspenseGraph('Preload starts the record before render needs it', { route: 'hover link', cache: 'preload key', promise: 'in flight', fallback: 'maybe none' }),
    highlight: { active: ['route', 'cache', 'promise', 'e-component-cache', 'e-component-promise'], compare: ['fallback'] },
    explanation: 'Preloading turns a future render miss into an earlier request. If the record resolves before navigation, the route can render without showing the fallback at all.',
  };

  yield {
    state: suspenseGraph('Duplicate readers share one pending record', { component: '2 readers', cache: 'same key', promise: 'one fetch' }),
    highlight: { found: ['cache', 'promise'], active: ['component', 'e-component-cache', 'e-component-promise'] },
    explanation: 'The cache deduplicates concurrent readers. Two components that ask for the same key should wait on the same pending record instead of starting two network requests.',
  };

  yield {
    state: labelMatrix(
      'Refresh behavior',
      [
        { id: 'urgent', label: 'urgent' },
        { id: 'trans', label: 'transition' },
        { id: 'defer', label: 'defer' },
        { id: 'error', label: 'error' },
      ],
      [
        { id: 'ui', label: 'UI' },
        { id: 'move', label: 'move' },
      ],
      [
        ['may hide', 'fallback'],
        ['keep old', 'pending mark'],
        ['stale ok', 'background'],
        ['error UI', 'boundary'],
      ],
    ),
    highlight: { found: ['trans:ui', 'defer:ui'], compare: ['urgent:ui'], removed: ['error:move'] },
    explanation: 'Transitions and deferred values let already revealed UI stay visible while fresh data loads in the background. The user sees stale content plus pending state instead of a full fallback flash.',
  };

  yield {
    state: labelMatrix(
      'Case study stack',
      [
        { id: 'route', label: 'route' },
        { id: 'code', label: 'code' },
        { id: 'data', label: 'data' },
        { id: 'asset', label: 'asset' },
      ],
      [
        { id: 'cache', label: 'cache' },
        { id: 'source', label: 'source' },
      ],
      [
        ['router', 'transition'],
        ['lazy()', 'bundler'],
        ['record map', 'framework'],
        ['HTTP cache', 'browser'],
      ],
    ),
    highlight: { found: ['route:source', 'code:cache', 'data:cache', 'asset:cache'] },
    explanation: 'A production route often coordinates four caches: router state, lazy code chunks, data records, and browser HTTP cache. Suspense is the UI boundary that makes their pending states visible without leaking internal details.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'boundary flow') yield* boundaryFlow();
  else if (view === 'cache lifecycle') yield* cacheLifecycle();
  else throw new InputError('Pick a Suspense view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'React Suspense is a boundary mechanism for UI that may not be ready to render. It coordinates pending work such as lazy code, Server Component streams, framework data reads, and the use API with promises. The data-structure lesson is a boundary tree plus resource records.',
        'A resource cache usually stores records by key. A record can be pending, fulfilled, or rejected. Reading a fulfilled record returns data. Reading a pending record suspends rendering. Reading a rejected record throws to an error boundary.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'When a child suspends, React switches the nearest Suspense boundary to its fallback. When the pending work resolves, React retries rendering that subtree. Nested boundaries let content reveal in stages, while transitions and deferred values can keep already visible content from being replaced by a fallback during lower-priority refreshes.',
        'React lazy uses Suspense for code loading. React use can read a promise and integrate with Suspense. React cache is for Server Components and memoizes data fetch or computation by arguments. Suspense-enabled data fetching in client code is usually provided by a framework or library; React documentation still warns that implementing an arbitrary Suspense data source without a framework is not a stable documented path.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider a product page with a shell, reviews, recommendations, and a price chart. The shell renders immediately. The reviews boundary can show rows as soon as reviews resolve. Recommendations can reveal later. The price chart can keep stale content during a transition so a filter change does not blank the chart. Resource Hints: Preload & Preconnect can start route work earlier, and HTTP Cache ETag Revalidation can make the asset/data layer cheaper before React sees anything.',
        'The important design decision is boundary placement. A whole-page boundary makes one pending widget hide the entire route. A boundary around every tiny component creates noisy loading waterfalls. Good Suspense design chooses boundaries at meaningful product chunks.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Suspense is not a global loading spinner. It is not an error boundary. It does not eliminate fetch cost. It exposes pending states in the UI tree. Cache invalidation still matters: a Suspense record can be stale, a browser cache entry can be stale, and a framework router cache can be stale independently.',
        'Do not teach undocumented throw-a-promise helpers as stable React API. The stable surface to cite is Suspense, lazy, use, cache for Server Components, transitions, and framework-supported data fetching.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: React Suspense reference at https://react.dev/reference/react/Suspense, React use reference at https://react.dev/reference/react/use, React cache reference at https://react.dev/reference/react/cache, React lazy reference at https://react.dev/reference/react/lazy, React useTransition reference at https://react.dev/reference/react/useTransition, and React renderToPipeableStream caveats for Suspense data sources at https://react.dev/reference/react-dom/server/renderToPipeableStream. Study React Fiber Scheduler Case Study, Virtual DOM Reconciliation, Promise Microtask Queue, HTTP Cache ETag Revalidation, Resource Hints: Preload & Preconnect, Query Cache: Stale Time & GC, Optimistic UI Mutation Log, and UI State Machine Workflow next.',
      ],
    },
  ],
};
