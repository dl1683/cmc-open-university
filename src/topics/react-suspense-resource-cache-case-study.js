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
      heading: 'How to read the animation',
      paragraphs: [
        'The boundary-flow view shows a React render that reaches a component whose data or code is not ready. Active means React is currently trying that node, visited means the node already rendered or was skipped by a boundary decision, and found means the boundary can now reveal completed children.',
        'The cache-lifecycle view shows the separate data contract. A cache key points to one record, and the safe inference is this: if two reads use the same key during the same cache lifetime, they must observe the same pending, fulfilled, or rejected record.',
        {type:'callout', text:`Suspense works when pending work is represented as a cache record and a boundary decision, so React can wait without committing half-ready UI.`},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A modern screen is built from work that finishes at different times. A route may need a JavaScript chunk, a server stream, a permissions check, a product record, and a refresh that should keep old content visible.',
        'Suspense exists because scattered loading booleans cannot coordinate that shape. The page needs boundaries that say which region may wait together, and it needs resource records that give pending work a stable identity.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is local state in each component. A component starts a fetch, stores loading, error, and data, then renders a spinner until the request finishes.',
        'That works for one isolated widget because one component owns one request and one placeholder. It breaks down when several components need the same record, a child waits after a parent renders, or a refresh should preserve old content.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that loading state has no shared invariant. One component can show old data while another starts the same request again, and a parent can commit a subtree whose child immediately disappears behind a spinner.',
        'The missing structure is a UI boundary plus a keyed record. The boundary defines the region allowed to wait, while the record defines the identity and state of the work being read.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Suspense treats missing render-time work as a control-flow signal. When a component reads a pending record, React can stop that subtree and commit the nearest boundary fallback instead of committing half-ready UI.',
        'A resource cache gives that signal stable meaning. A read either returns a fulfilled value, suspends on a pending thenable, or throws a rejection toward an error boundary.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A component renders and reads a Suspense-aware source. If the record is fulfilled, the value returns and rendering continues; if it is pending, React tracks the thenable and unwinds to the nearest Suspense boundary.',
        'When the promise settles, React schedules a retry of the blocked subtree. The same key now points to a fulfilled or rejected record, so the retry either reveals content or sends the error to an error boundary.',
        'The cache is not optional bookkeeping. Wrong keys merge users or filters that should be separate, while overly specific keys defeat deduplication and turn every render into a cold miss.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The boundary invariant is that a Suspense boundary shows either previously committed children, newly completed children, or its fallback. It does not commit the interrupted middle of a render.',
        'The cache invariant is that one key means one record for the relevant lifetime. Because the retry reads the same record identity, React can repeat rendering without every component carrying custom loading branches.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A cache hit is usually a small map lookup, but a miss may start a network request, code download, server render, or database query. The cache also stores keys, promises, values, errors, timestamps, invalidation tags, and eviction metadata.',
        'Boundary placement changes behavior. One broad boundary can blank an entire route for one slow child, while many tiny boundaries can reveal a page in noisy fragments and make loading feel unstable.',
        'For concrete numbers, a page with 8 panels and one 600 ms slow panel can either hide all 8 panels for 600 ms or show 7 panels immediately and only defer the slow region. The second layout spends more design effort, but it preserves useful screen state.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Suspense fits route-level code loading, streamed server output, framework data reads, lazy charts, and panels that should reveal as a unit. It is strongest when the product already has a meaningful boundary such as a route segment, tab body, table, or chart.',
        'It also pairs with preloading. A router can begin loading a route module when the user hovers a link, and if the record resolves before render, the boundary never shows a fallback.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Suspense is not a data-fetching library, a freshness policy, or an error boundary. A framework or cache still decides when records are stale, how mutations roll back, and how rejected reads are displayed.',
        'It also fails when used for imperative workflows such as saving a form or uploading a file. Those operations need explicit progress, cancellation, and recovery semantics rather than a render-time wait boundary.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a dashboard with a route shell, a lazy revenue chart, and a customer table. The shell is ready at 40 ms, the chart chunk arrives at 180 ms, and the table record resolves at 520 ms.',
        'With one page-level flag, the user sees a blank or spinner until 520 ms. With Suspense boundaries, the shell renders at 40 ms, the chart reveals at 180 ms, and the table boundary keeps a row skeleton until 520 ms.',
        'If two table cells read customer 42, both reads use the same cache key. The first read creates the pending record, the second shares it, and the retry returns one fulfilled value instead of issuing two network requests.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: React Suspense at https://react.dev/reference/react/Suspense, React use at https://react.dev/reference/react/use, React cache at https://react.dev/reference/react/cache, and React lazy at https://react.dev/reference/react/lazy. These sources define the boundary behavior, promise reads, cache scope, and code-loading path.',
        'Study React Fiber Scheduler Case Study next to understand priority and retry. Then study Virtual DOM Reconciliation, Promise Microtask Queue, HTTP Cache ETag Revalidation, Query Cache Stale Time, Optimistic UI Mutation Log, and UI State Machine Workflow.',
      ],
    },
  ],
};
