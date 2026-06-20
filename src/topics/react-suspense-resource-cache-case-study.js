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
      heading: 'Why this exists',
      paragraphs: [
        `Modern React screens do not render from one ready object. A route can depend on a code chunk, a server-rendered stream, a data record, an image, a permissions check, and a user-triggered refresh. Some of that work finishes before render. Some finishes during render. Some fails. Some should keep old content visible while fresh content is loading.`,
        `Suspense exists because local loading flags do not scale to that shape. A screen needs explicit boundaries that say which part of the UI may wait together, which fallback belongs there, and when React should retry the render after pending work settles.`,
        {type:'callout', text:`Suspense works when pending work is represented as a cache record and a boundary decision, so React can wait without committing half-ready UI.`},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The first approach is local state. A component starts a fetch in an effect, stores isLoading, error, and data, and renders a spinner until the request finishes. That is fine for a single isolated widget because the component owns one request and one placeholder.`,
        `A route is different. The same data can be read by more than one component. A parent can finish while a child is still waiting. Code and data can arrive in different orders. A refresh may need to show stale content instead of blanking the whole panel. With scattered loading flags, the product starts to show accidental states rather than designed states.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `Local loading flags have no shared invariant. One component can show data while another starts the same request again. A parent can commit a subtree whose child immediately disappears behind a spinner. A retry can blur the difference between pending data, rejected data, and stale-but-usable data.`,
        `The missing structure is two-part: a coordination boundary in the UI tree and a keyed record in the resource layer. The boundary defines the unit of loading disclosure. The record defines the identity and state of the work being read.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `Suspense turns pending render work into a control-flow signal. When a component reads something that is not ready, React can stop rendering that subtree, remember the pending thenable, and use the nearest Suspense boundary's fallback instead of committing half-ready UI.`,
        `A resource cache turns a key into a record. The record is usually pending, fulfilled, or rejected. A read of that record either suspends on the pending thenable, returns the fulfilled value, or throws the rejection toward an error boundary. The boundary answers the UI question. The cache answers the identity question.`,
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        `The boundary-flow view shows the UI control path. A route renders through a Suspense boundary. A child reads a resource. If the resource is pending, React unwinds to the boundary and commits the fallback. When the promise settles, React retries the subtree and either reveals content or routes the failure to an error boundary.`,
        `The cache-lifecycle view shows the data identity path. A key maps to one record. Two readers of the same key should share one pending record. Preloading moves the miss earlier. Transitions and deferred values let already revealed UI stay visible while lower-priority work prepares the next version.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `A component renders and reads a Suspense-aware source. If the record is fulfilled, the read returns a value and rendering continues. If the record is pending, the read suspends by giving React a thenable. React stops rendering that path and looks upward for the closest Suspense boundary. The boundary can commit its fallback while the pending work remains tracked.`,
        `When the promise resolves, React schedules a retry. The same component renders again. This time the same key points to a fulfilled record, so the read returns data and the boundary can reveal real content. If the promise rejects, the read throws the reason and the nearest error boundary owns the error UI.`,
        `React lazy uses Suspense for code loading. React use can read a promise in render and integrate with Suspense. React cache memoizes a data fetch or computation by arguments in Server Components. Client data fetching with Suspense is usually provided by a framework or data library, because React does not make arbitrary client caches stable merely because they throw a promise.`,
        `That distinction matters. Suspense is the rendering coordination mechanism. It is not, by itself, a full network cache, invalidation system, mutation log, retry policy, or stale-time policy. Those responsibilities live in the framework, router, or data layer that supplies the records React reads.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Imagine a dashboard route with a sidebar, a revenue chart, and a table. The sidebar code is already loaded. The chart code is lazy. The table data is fetched by a route loader or resource cache. A broad page-level loading flag would hide everything until the slowest part finishes.`,
        `With Suspense, the route shell can render immediately. A boundary around the chart can show a chart-sized skeleton while the lazy chunk loads. A boundary around the table can show row placeholders while the data record is pending. If the user changes a filter inside a transition, the old table can remain visible with a pending mark while the new record loads.`,
        `The useful property is not that loading disappeared. It is that loading became placed. The product decides the boundary shape: shell stays stable, chart waits as one unit, table waits as one unit, errors land in error boundaries, and duplicate readers share the same record instead of creating duplicate fetches.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The boundary invariant is simple: a Suspense boundary shows either committed children that finished rendering or a fallback. It does not commit the half-rendered subtree that needed missing work in the middle of render. That keeps the visible screen closer to a designed state.`,
        `The cache invariant is just as important: one key means one record for the relevant cache lifetime. The first read creates or finds a pending record. Later reads of the same key share it. After settlement, the record changes state, so a retry observes the new state instead of starting the same work again.`,
        `React can then treat rendering as repeatable. A render may stop because something is pending. Later, React retries. If the inputs and cache records are stable, the retry does not need special loading code in every component. The read operation itself communicates whether the component can continue.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `A cache lookup is usually cheap, but a miss is not. The miss may start a network request, code download, server render, database query, or CPU-heavy computation. The cache also needs memory for keys, promises, values, errors, timestamps, tags, and invalidation metadata.`,
        `Boundary placement is a product cost. One broad boundary is easy to reason about but can hide the whole route because one child waits. Many tiny boundaries reduce blank space but can create a noisy page that reveals in fragments. The right boundary usually matches a meaningful product region: a panel, tab body, list, chart, or route segment.`,
        `Transitions and deferred values add scheduling choices. They can keep already revealed content visible while new content prepares, but they also require the interface to show pending state honestly. If the UI shows stale results without a pending mark, the user may think the filter or navigation failed.`,
        `There is also a cache correctness cost. A wrong key can merge data that should be separate. A too-specific key can defeat deduplication. A cache that never evicts grows. A cache that evicts too aggressively turns every navigation into a cold miss. Suspense makes pending work visible; it does not make cache policy automatic.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Suspense fits route chunks, lazy code, streamed server output, framework data reads, and product sections that should reveal together. It is strongest when the loading sequence is part of the design: shell first, important content next, secondary panels later.`,
        `It also pairs well with preloading. A router can begin loading a route module or data record when the user hovers a link or starts navigation. If the record resolves before the render needs it, the boundary never has to show the fallback.`,
        `Suspense is useful when the UI can tolerate waiting at a boundary. A chart can wait as a chart. A table can wait as rows. A route segment can wait as a segment. The abstraction is weaker when the user needs imperative progress for a command, such as saving a form or uploading a file.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Suspense is not an error boundary. A rejected resource needs an error boundary. Suspense is not a global loading spinner. It is a local boundary. Suspense is not a freshness model. A data layer still decides when a record is stale, when to refetch, and when to evict.`,
        `It is the wrong abstraction for event-handler work that does not affect render, mutation workflows that need optimistic rollback, and client data sources without a supported Suspense integration. Throwing promises from arbitrary client code can create brittle behavior if the surrounding framework does not own the cache lifetime and retry model.`,
        `It also fails when boundaries are placed mechanically. A boundary around the whole app can make every small miss feel like a full-page reload. A boundary around every tiny component can produce a flickering mess. Suspense is a coordination tool, so bad coordination still produces bad UI.`,
      ],
    },
    {
      heading: 'Common misconceptions',
      paragraphs: [
        `A common misconception is that Suspense fetches data. It does not. A framework, router, server component, or data library fetches data and provides a Suspense-aware read path. Suspense controls what React renders while that work is pending.`,
        `Another misconception is that a fallback is always a spinner. A good fallback is shaped like the region it replaces. It may be a skeleton, preserved stale content, an empty table frame, or a route shell. The fallback is part of the screen design, not a debugging marker.`,
        `A third misconception is that sharing a promise is enough to build a cache. A real resource cache also needs stable keys, rejection handling, invalidation, eviction, preloading, freshness, and a clear lifetime. Without those, Suspense can hide duplication for a while but will not make the data model correct.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: React Suspense reference at https://react.dev/reference/react/Suspense, React use reference at https://react.dev/reference/react/use, React cache reference at https://react.dev/reference/react/cache, React lazy reference at https://react.dev/reference/react/lazy, React useTransition reference at https://react.dev/reference/react/useTransition, and React renderToPipeableStream caveats for Suspense data sources at https://react.dev/reference/react-dom/server/renderToPipeableStream.`,
        `Study next: React Fiber Scheduler Case Study for how render work is prioritized, Virtual DOM Reconciliation for why render can be retried, Promise Microtask Queue for thenable settlement, HTTP Cache ETag Revalidation for freshness, Resource Hints: Preload & Preconnect for starting work early, Query Cache: Stale Time & GC for client data policy, Optimistic UI Mutation Log for writes, and UI State Machine Workflow for explicit product states.`,
      ],
    },
  ],
};
