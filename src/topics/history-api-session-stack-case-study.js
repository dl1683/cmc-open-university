// History API: session history is a browser-managed stack of entries carrying
// URL, state, document/session metadata, scroll restoration, and navigation events.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'history-api-session-stack-case-study',
  title: 'History API Session Stack',
  category: 'Systems',
  summary: 'How pushState, replaceState, back/forward traversal, popstate, scroll restoration, and SPA router state fit into the session history stack.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['push and back', 'router state'], defaultValue: 'push and back' },
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

function historyGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'doc', label: 'doc', x: 0.8, y: 4.5, note: notes.doc ?? 'current page' },
      { id: 'e0', label: 'e0', x: 2.4, y: 6.2, note: notes.e0 ?? '/home' },
      { id: 'e1', label: 'e1', x: 3.9, y: 5.0, note: notes.e1 ?? '/list' },
      { id: 'e2', label: 'e2', x: 5.4, y: 3.8, note: notes.e2 ?? '/item' },
      { id: 'cursor', label: 'cur', x: 5.4, y: 6.4, note: notes.cursor ?? 'index' },
      { id: 'state', label: 'state', x: 7.0, y: 3.8, note: notes.state ?? 'clone' },
      { id: 'scroll', label: 'scroll', x: 7.0, y: 6.4, note: notes.scroll ?? 'restore' },
      { id: 'event', label: 'event', x: 8.7, y: 5.0, note: notes.event ?? 'popstate' },
    ],
    edges: [
      { id: 'e-doc-e0', from: 'doc', to: 'e0', weight: '' },
      { id: 'e-e0-e1', from: 'e0', to: 'e1', weight: '' },
      { id: 'e-e1-e2', from: 'e1', to: 'e2', weight: '' },
      { id: 'e-e2-cursor', from: 'e2', to: 'cursor', weight: '' },
      { id: 'e-e2-state', from: 'e2', to: 'state', weight: '' },
      { id: 'e-cursor-scroll', from: 'cursor', to: 'scroll', weight: '' },
      { id: 'e-state-event', from: 'state', to: 'event', weight: '' },
      { id: 'e-scroll-event', from: 'scroll', to: 'event', weight: '' },
    ],
  }, { title });
}

function* pushAndBack() {
  yield {
    state: historyGraph('The browser owns a per-tab session history'),
    highlight: { active: ['doc', 'e0', 'e1', 'e2', 'e-doc-e0', 'e-e0-e1', 'e-e1-e2'], found: ['cursor'] },
    explanation: 'A tab has a session history: ordered entries for visited documents or same-document states. The active entry is a cursor into that list.',
    invariant: 'The app can add entries, but the browser owns traversal.',
  };

  yield {
    state: historyGraph('pushState appends a same-document entry', { e2: '/item/42', state: '{id:42}', event: 'no pop' }),
    highlight: { active: ['e1', 'e2', 'state', 'e-e1-e2', 'e-e2-state'], compare: ['event'] },
    explanation: 'history.pushState adds an entry with a same-origin URL and a structured-cloned state object. It changes the address bar without loading a new document and does not itself fire popstate.',
  };

  yield {
    state: historyGraph('replaceState rewrites the current entry', { e2: '/item/42?tab=specs', state: '{tab}', cursor: 'same idx' }),
    highlight: { active: ['e2', 'state', 'cursor', 'e-e2-state', 'e-e2-cursor'], compare: ['e1'] },
    explanation: 'replaceState updates the active entry instead of adding a new one. Routers use it for redirects, canonicalization, or tab changes that should not create an extra Back press.',
  };

  yield {
    state: historyGraph('Back moves the cursor and dispatches popstate', { cursor: 'e1', state: '{page:list}', scroll: 'y=840', event: 'popstate' }),
    highlight: { active: ['cursor', 'state', 'scroll', 'event', 'e-state-event', 'e-scroll-event'], found: ['e1'], compare: ['e2'] },
    explanation: 'When the user presses Back, the browser traverses to another entry. If it is a same-document traversal with state, the page receives popstate and can render the matching view.',
  };

  yield {
    state: labelMatrix(
      'History operations',
      [
        { id: 'push', label: 'push' },
        { id: 'replace', label: 'replace' },
        { id: 'back', label: 'back' },
        { id: 'reload', label: 'reload' },
      ],
      [
        { id: 'stack', label: 'stack' },
        { id: 'event', label: 'event' },
      ],
      [
        ['append', 'no pop'],
        ['rewrite', 'no pop'],
        ['move idx', 'popstate'],
        ['same URL', 'load'],
      ],
    ),
    highlight: { active: ['push:stack', 'back:event'], compare: ['replace:stack'] },
    explanation: 'pushState and replaceState mutate session history. Back and Forward traverse it. popstate is about traversal, not about every route render.',
  };
}

function* routerState() {
  yield {
    state: historyGraph('A SPA router maps entries to UI state', { doc: 'SPA', e0: '/inbox', e1: '/thread/7', e2: '/compose', state: 'draft ref' }),
    highlight: { active: ['doc', 'e0', 'e1', 'e2', 'state'], found: ['cursor'] },
    explanation: 'A single-page app turns same-document history entries into screen states. The URL is shareable state; history.state is small navigation metadata.',
    invariant: 'Put durable route identity in the URL, not only in history.state.',
  };

  yield {
    state: labelMatrix(
      'Entry payload',
      [
        { id: 'url', label: 'URL' },
        { id: 'state', label: 'state' },
        { id: 'scroll', label: 'scroll' },
        { id: 'doc', label: 'doc ref' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'limit', label: 'limit' },
      ],
      [
        ['share route', 'same origin'],
        ['UI hint', 'small clone'],
        ['restore y', 'layout drift'],
        ['maybe live', 'BFCache'],
      ],
    ),
    highlight: { active: ['url:role', 'state:role', 'scroll:role'], compare: ['doc:limit'] },
    explanation: 'The entry is not just a string. It can carry URL, state object, scroll restoration data, and possibly a live document snapshot if BFCache later applies.',
  };

  yield {
    state: historyGraph('Forward history is pruned after a new push', { e0: '/home', e1: '/search', e2: '/new', cursor: 'e2', event: 'no forward' }),
    highlight: { active: ['e1', 'e2', 'cursor', 'e-e1-e2'], removed: ['event'], compare: ['e0'] },
    explanation: 'If the user goes Back and then the app pushes a new route, the old forward entries are discarded. That matches user expectations from browser history and undo stacks.',
  };

  yield {
    state: historyGraph('Scroll restoration is separate from rendering state', { scroll: 'manual?', event: 'restore', state: 'route' }),
    highlight: { active: ['scroll', 'event', 'cursor', 'e-cursor-scroll', 'e-scroll-event'], compare: ['state'] },
    explanation: 'The browser can restore scroll positions, but SPAs often set history.scrollRestoration = manual and coordinate scroll after async rendering finishes.',
  };

  yield {
    state: historyGraph('The complete case is a search results drill-down', { e0: '/search?q=raft', e1: '/docs/42', e2: '/docs/42#comments', state: 'focus id', scroll: 'results y' }),
    highlight: { active: ['e0', 'e1', 'e2', 'state', 'scroll', 'event'], found: ['cursor'] },
    explanation: 'A search page pushes a detail URL, stores small focus metadata, and preserves scroll. Back returns to the result list at the previous position instead of losing the user context.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'push and back') yield* pushAndBack();
  else if (view === 'router state') yield* routerState();
  else throw new InputError('Pick a History API view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the browser history as an ordered list of entries plus a cursor that points at the active entry. Some entries load a new document, and some are same-document entries created by pushState or replaceState.',
        'Active means the entry or route currently controls the screen. A safe inference is that Back and Forward move the browser-owned cursor first, and the app must then render the view that matches the active URL and stored state.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Single-page apps can change screens without loading a new document. Users still expect Back, Forward, refresh, bookmarks, copied links, scroll restoration, and accessibility semantics to behave like navigation.',
        'The History API bridges app-rendered views and the browser-owned session history. It lets the app add or replace same-document entries while the browser remains in charge of traversal.',
        {type:'callout', text:'The History API is a browser-owned navigation stack: apps may add entries, but rendered state must follow the active cursor.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious app approach is to keep the real route in memory and treat the URL as decoration. Clicking a result swaps components, and the app feels fine until browser behavior becomes part of the test.',
        'Another simple approach is to push a history entry for every UI change. That makes state look durable, but it turns the Back button into a replay of dropdowns, keystrokes, and transient panels.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears when users arrive through the browser instead of through the last click handler. They can refresh, restore a tab, paste a link, use a bookmark, press Forward, or reopen after a crash.',
        'Memory-only state cannot survive those paths. If the URL does not identify the durable view, the browser stack exposes the weakness by showing the wrong page or losing the user\'s place.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is a stack-like list with a cursor and small cloned state attached to entries. pushState appends an entry after the cursor and prunes forward entries, while replaceState rewrites the current entry without adding another Back stop.',
        'The invariant is that the rendered screen must match the active history entry. The URL should identify the durable view, and history.state should hold only small restoration hints.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'pushState takes a state object, an unused title parameter, and a same-origin URL, then adds a same-document entry. It does not fire popstate, so the app must render the route it just pushed.',
        'replaceState uses the same entry slot. It is useful for canonicalization, redirects, default parameters, login cleanup, or tab state that should update the URL without adding another traversal step.',
        'Back and Forward are traversal operations. The browser moves the cursor to an existing entry and can dispatch popstate so the page can render the active URL with the stored state object.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The model works because browser traversal is the authority. The app may add entries, but it cannot choose which old entry Back selects after the user initiates traversal.',
        'Correct routing follows from reconstructability. If URL plus small state can rebuild the screen, then click navigation, Back, Forward, refresh, restore, and pasted links all converge on the same view.',
        'The state object is structured-cloned, which rules out live DOM nodes, functions, open connections, and the only copy of important data. That constraint pushes durable identity into the URL or server-backed storage.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is state discipline. Every meaningful route needs a durable URL, while ephemeral UI state needs to stay out of history or use replaceState carefully.',
        'Entry volume has behavior. If a search box pushes 20 entries while a user types a query, Back must traverse 20 stale query states before it leaves the page.',
        'Scroll restoration is another cost. Native restoration is simple for document pages, but apps with async data or virtualized lists often need manual restoration after the target content exists.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Use pushState for route changes users expect to revisit: opening a document, moving from cart to checkout, applying a shareable filter, or navigating from search results to a detail page.',
        'Use replaceState for canonical URLs, default parameters, redirect cleanup, login return cleanup, and transient tab changes that should not create another Back stop.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the URL is decoration. Refresh, sharing, bookmarks, and recovery cannot reconstruct a page that exists only in JavaScript memory.',
        'It also fails when history.state is treated as private storage. State objects are cloned, size-limited by browsers, visible to debugging surfaces, and can survive longer than the objects that created them.',
        'A common router bug is waiting for popstate after calling pushState. pushState mutates history but does not signal traversal, so the app must render immediately after its own push.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A docs app renders /search?q=raft and the user opens result 42 after scrolling to y = 840. The router calls pushState with state { from: "search", resultId: 42, scrollY: 840 } and URL /docs/42, then renders the document.',
        'When the user presses Back, the browser moves the cursor to the search entry and dispatches popstate. The router reads /search?q=raft, rebuilds the result list, waits until result 42 exists, and restores scroll or focus.',
        'If the user then changes the query to lease, pushState adds /search?q=lease after the current cursor and prunes the forward path to /docs/42. That pruning is normal stack behavior, not a router bug.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are MDN History API, pushState, replaceState, popstate, and the HTML Standard sections on session history and navigation. Read them to separate browser traversal from app rendering.',
        'Study URL Parser and Origin Tuple, DOM Event Propagation, BFCache Page Lifecycle, Service Workers, React Suspense Resource Cache, Browser Rendering Pipeline, and UI State Machine Workflow next.',
      ],
    },
  ],
};
