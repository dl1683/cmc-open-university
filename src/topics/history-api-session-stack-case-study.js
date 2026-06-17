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
      heading: 'Why this exists',
      paragraphs: [
        'Single-page apps can change screens without asking the browser to load a new document. That is useful, but it creates a contract problem: users still expect Back, Forward, refresh, links, bookmarks, scroll restoration, and accessibility semantics to behave like real navigation.',
        'The History API is the bridge between app-rendered views and the browser-owned session history. Its job is not just changing the address bar. Its job is keeping a rendered view aligned with a stack the user, browser, and page can all move through.',
      ],
    },
    {
      heading: 'Context',
      paragraphs: [
        'A browser tab has a session history: an ordered list of entries and a current index. Some entries represent full documents. Some represent same-document states created by `pushState` or `replaceState`. Traversal moves the index; it does not ask the app which entry it prefers.',
        'Each entry has more than a URL string. It can carry a structured-cloned state object, browser-managed persisted user state such as scroll position, and document lifecycle details such as whether a page can be restored from cache.',
      ],
    },
    {
      heading: 'Obvious approach and wall',
      paragraphs: [
        'The obvious SPA approach is to keep the real route in memory and treat the URL as decoration. Clicking a result swaps components, but Back leaves the page, refresh loses the state, and a copied link cannot reconstruct the view.',
        'That approach hits the wall when browser behavior becomes the test. The app may look correct during clicking, but the user can still enter from a bookmark, restore a tab, press Forward, reload after a crash, or share the address.',
        'The opposite bug is to push a new history entry for every tiny UI movement. A dropdown toggle, a transient drawer, or every keystroke in a search box can turn the Back button into a replay of internal state instead of a navigation tool.',
      ],
    },
    {
      heading: 'Core mechanism and invariant',
      paragraphs: [
        'The core data structure is a stack-like list plus a cursor. `pushState(state, "", url)` appends a same-document entry after the current cursor and prunes any forward entries. `replaceState(state, "", url)` rewrites the current entry without adding another Back stop.',
        'Back and Forward are traversal operations. They move the cursor to an existing entry. For same-document entries, the page can receive `popstate` with the stored state and render the view matching the new active URL.',
        'The state object is structured-cloned. It is for small navigation hints, not live objects, caches, database rows, secrets, functions, DOM nodes, or the only copy of important route identity.',
        'The invariant is simple: the current rendered screen must match the active history entry. A router may cache, prefetch, animate, and suspend work, but after traversal settles, the URL plus small entry state must be enough to rebuild the screen.',
      ],
    },
    {
      heading: 'URL versus state',
      paragraphs: [
        'The URL should identify the durable view: `/docs/42`, `/search?q=raft`, `/settings/billing`, or `/product/7?tab=reviews` when the tab is link-worthy. This is the part that must survive reload, sharing, bookmarking, server rendering, and recovery after a crash.',
        'The `history.state` object should hold small context that improves restoration but is not the source of truth: the result id that opened a detail page, a previous scroll anchor, a modal origin, a focus target, or a flag saying that the route came from an in-app transition.',
        'That split gives the app a clean fallback. If `history.state` is missing, stale, truncated, or from a restored session, the URL still tells the router what to show.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A documentation app renders `/search?q=raft`. The user scrolls to result 42 and opens it. The router calls `pushState({ from: "search", resultId: 42, scrollY: 840 }, "", "/docs/42")` and renders the document without loading a new page.',
        'When the user presses Back, the browser moves the cursor to the search entry and dispatches `popstate`. The router reads the active URL, renders the search results for `q=raft`, waits until the list exists, and restores the old scroll position or result focus.',
        'If the user then changes the query from that restored search page, the router pushes `/search?q=lease`. The old forward path to `/docs/42` is pruned because the user created a new branch from the middle of the stack.',
      ],
    },
    {
      heading: 'Animation and readouts',
      paragraphs: [
        'In the push-and-back view, the cursor is the main state variable. `pushState` adds `e2` after `e1`; `replaceState` changes the payload at the cursor; Back moves the cursor to `e1` and only then does `popstate` tell the app what became active.',
        'In the router-state view, the URL, state, scroll, and document nodes are different layers of one entry. The URL is the durable route. The state object is a small clone. Scroll restoration is browser-managed unless the app takes manual control. The document reference is browser territory, especially when BFCache can preserve a previous page.',
        'The readout is intentionally smaller than a real router. It does not show data loading races, focus repair, aborted transitions, route guards, analytics hooks, or BFCache eviction. Those policies sit above the stack model, but they still have to obey the active-entry invariant.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The model works because the browser remains the authority on traversal. The application can add and replace same-document entries, but user navigation moves the cursor and tells the page which entry is active.',
        'Correct routing follows the invariant that a rendered view must be reconstructible from URL plus small state. If the URL cannot identify the view, refresh, share, and recovery paths are broken.',
      ],
    },
    {
      heading: 'Tradeoffs',
      paragraphs: [
        'The main cost is state discipline. History entries can outlive the JavaScript objects that created them, survive reload-like restoration paths, and be traversed in either direction. A router has to render from the active location, not from assumptions about the last click handler that ran.',
        'Scroll restoration is a real tradeoff. Native restoration is simple for document navigations and static pages. In SPAs with async data, virtualization, or layout shifts, the browser may try to restore before the target content exists. Many routers set `history.scrollRestoration = "manual"` and restore after rendering is stable.',
        'Entry volume also matters. Meaningful navigation deserves history entries. Ephemeral controls often belong in component state, `replaceState`, or the current URL only after a debounce.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        '`pushState` does not fire `popstate`. If a router waits for `popstate` after its own push, it will miss the render. The app should render the new route when it pushes, and handle `popstate` when traversal later happens.',
        'The URL passed to `pushState` and `replaceState` must be same-origin. The API cannot be used to spoof another origin in the address bar.',
        'History state is cloned, size-constrained by browsers, and not private storage. Putting large data, auth decisions, or secrets in it creates fragility and sometimes leakage through logs, crash dumps, or debugging surfaces.',
      ],
    },
    {
      heading: 'Practical use',
      paragraphs: [
        'Use `pushState` for user-visible route changes that deserve their own Back stop: opening a result, moving from cart to checkout, entering a document page, or applying a filter that users will want to share.',
        'Use `replaceState` for canonicalization, redirects, default parameters, login return cleanup, and tab changes that should update the URL without adding another traversal step.',
        'Keep the router idempotent: given the current URL plus optional `history.state`, it should be able to render the correct screen whether the entry came from a click, Back, Forward, reload, session restore, or a pasted link.',
      ],
    },
    {
      heading: 'Limits',
      paragraphs: [
        'The History API is not a full navigation framework. It does not fetch data, cancel stale route loads, manage focus, decide scroll policy, or synchronize server-rendered fallbacks. Routers build those policies on top.',
        'It also cannot make a memory-only app durable. If a URL cannot reconstruct the important view, the browser stack will expose that weakness through refresh, sharing, restore, and direct entry.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: MDN History API at https://developer.mozilla.org/en-US/docs/Web/API/History_API, MDN pushState at https://developer.mozilla.org/en-US/docs/Web/API/History/pushState, MDN replaceState at https://developer.mozilla.org/en-US/docs/Web/API/History/replaceState, and MDN popstate at https://developer.mozilla.org/en-US/docs/Web/API/Window/popstate_event.',
        'Then study URL Parser & Origin Tuple, UI State Machine Workflow, DOM Event Propagation, BFCache Page Lifecycle, Service Workers, React Suspense Resource Cache, and Browser Rendering Pipeline. Routing quality depends on all of those pieces, not just stack mutation.',
      ],
    },
  ],
};
