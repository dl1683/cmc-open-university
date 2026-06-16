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
      heading: 'What it is',
      paragraphs: [
        'The History API gives a page controlled access to a tab session history. pushState adds same-document entries, replaceState rewrites the current entry, and Back or Forward traversal can dispatch popstate with the stored state.',
        'MDN documents pushState as adding an entry to the browser session history stack: https://developer.mozilla.org/en-US/docs/Web/API/History/pushState. MDN documents popstate as firing when the active history entry changes during traversal: https://developer.mozilla.org/en-US/docs/Web/API/Window/popstate_event.',
      ],
    },
    {
      heading: 'Core data structure',
      paragraphs: [
        'A session history is an ordered list plus a cursor. Entries carry URL, serialized state, scroll restoration data, and browser-managed document/session metadata. Same-document entries let SPAs change URL and view without a full document navigation.',
        'The state object is structured-cloned and should be small. Durable route identity belongs in the URL so refresh, share, copy, and server fallback still work. history.state is for metadata like focus target, modal origin, or transition hints.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A documentation SPA shows search results for /search?q=raft. Opening a result calls pushState with /docs/42 and a small state object containing the result id. Back traverses to the search entry, fires popstate, and the app restores the result list and scroll position.',
        'If the user then changes the search query, the router pushes a new /search?q=lease entry and the old forward branch is pruned. replaceState is used for canonical redirects and tab changes that should not add extra Back presses.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'pushState does not fire popstate by itself. popstate is for traversal. Also, pushState URLs must be same-origin, so the URL parser and origin tuple still define the boundary.',
        'Do not hide all route identity in history.state. Refresh, deep links, analytics, accessibility, server rendering, and error recovery need URL-level truth. Do not assume scroll restoration happens at the right time if the SPA renders asynchronously.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN History API at https://developer.mozilla.org/en-US/docs/Web/API/History_API, MDN pushState at https://developer.mozilla.org/en-US/docs/Web/API/History/pushState, and MDN popstate at https://developer.mozilla.org/en-US/docs/Web/API/Window/popstate_event. Study URL Parser & Origin Tuple, UI State Machine Workflow, DOM Event Propagation, BFCache Page Lifecycle, Service Workers, and React Suspense Resource Cache next.',
      ],
    },
  ],
};
