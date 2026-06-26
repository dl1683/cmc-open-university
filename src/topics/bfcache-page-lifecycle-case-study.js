// Back/forward cache: a browser may freeze a whole page snapshot on navigation
// and restore it instantly on back/forward traversal if lifecycle rules permit.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'bfcache-page-lifecycle-case-study',
  title: 'BFCache Page Lifecycle',
  category: 'Systems',
  summary: 'How back/forward cache stores live page snapshots, fires pagehide/pageshow with persisted flags, restores state instantly, and rejects unsafe pages.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['restore path', 'eligibility'], defaultValue: 'restore path' },
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

function lifecycleGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'pageA', label: 'A', x: 0.8, y: 4.7, note: notes.pageA ?? 'current' },
      { id: 'hide', label: 'hide', x: 2.3, y: 4.7, note: notes.hide ?? 'pagehide' },
      { id: 'freeze', label: 'freeze', x: 3.9, y: 2.7, note: notes.freeze ?? 'pause JS' },
      { id: 'cache', label: 'BF', x: 5.4, y: 4.7, note: notes.cache ?? 'snapshot' },
      { id: 'pageB', label: 'B', x: 3.9, y: 6.6, note: notes.pageB ?? 'next page' },
      { id: 'show', label: 'show', x: 7.0, y: 4.7, note: notes.show ?? 'pageshow' },
      { id: 'resume', label: 'resume', x: 8.7, y: 4.7, note: notes.resume ?? 'instant' },
    ],
    edges: [
      { id: 'e-a-hide', from: 'pageA', to: 'hide', weight: '' },
      { id: 'e-hide-freeze', from: 'hide', to: 'freeze', weight: '' },
      { id: 'e-freeze-cache', from: 'freeze', to: 'cache', weight: '' },
      { id: 'e-hide-pageB', from: 'hide', to: 'pageB', weight: '' },
      { id: 'e-cache-show', from: 'cache', to: 'show', weight: '' },
      { id: 'e-show-resume', from: 'show', to: 'resume', weight: '' },
    ],
  }, { title });
}

function* restorePath() {
  yield {
    state: lifecycleGraph('The user leaves page A for page B'),
    highlight: { active: ['pageA', 'hide', 'pageB', 'e-a-hide', 'e-hide-pageB'], compare: ['cache'] },
    explanation: 'When a user navigates away, the browser may try to keep page A alive in the back/forward cache instead of tearing it down. The transition starts with pagehide.',
    invariant: 'BFCache is a live page snapshot, not an HTTP cache entry.',
  };

  yield {
    state: lifecycleGraph('pagehide indicates whether caching is intended', { hide: 'persisted?', freeze: 'eligible' }),
    highlight: { active: ['hide', 'freeze', 'e-hide-freeze'], compare: ['pageB'] },
    explanation: 'The pagehide event has a persisted flag. A true value means the browser intends to preserve the page, though final caching can still depend on browser conditions.',
  };

  yield {
    state: lifecycleGraph('The page snapshot is frozen in memory', { freeze: 'timers stop', cache: 'DOM+JS', pageA: 'state kept' }),
    highlight: { active: ['pageA', 'freeze', 'cache', 'e-hide-freeze', 'e-freeze-cache'], removed: ['resume'] },
    explanation: 'The DOM, JavaScript heap, scroll position, form state, and rendering state can be kept. Timers and tasks are suspended so the page does not keep running while hidden.',
  };

  yield {
    state: lifecycleGraph('Back restores from memory and fires pageshow', { show: 'persisted', resume: '0 ms feel', cache: 'hit' }),
    highlight: { found: ['cache', 'show', 'resume', 'e-cache-show', 'e-show-resume'], compare: ['pageB'] },
    explanation: 'On Back, the browser can restore the frozen page almost instantly and fire pageshow with persisted true. The app should refresh volatile data after restore if freshness matters.',
  };

  yield {
    state: labelMatrix(
      'Restore tasks',
      [
        { id: 'data', label: 'data' },
        { id: 'socket', label: 'socket' },
        { id: 'analytics', label: 'analytics' },
        { id: 'ui', label: 'UI' },
      ],
      [
        { id: 'onshow', label: 'on show' },
        { id: 'why', label: 'why' },
      ],
      [
        ['recheck', 'freshness'],
        ['reopen', 'closed'],
        ['record', 'nav event'],
        ['keep', 'snapshot'],
      ],
    ),
    highlight: { active: ['data:onshow', 'socket:onshow', 'analytics:onshow'], found: ['ui:onshow'] },
    explanation: 'The complete restore handler is small: on pageshow persisted, revalidate volatile data, reconnect closed channels if needed, and record navigation analytics without rebuilding the whole page.',
  };
}

function* eligibility() {
  yield {
    state: labelMatrix(
      'Common blockers',
      [
        { id: 'unload', label: 'unload' },
        { id: 'cacheCtl', label: 'no-store' },
        { id: 'locks', label: 'locks' },
        { id: 'sensitive', label: 'secret' },
      ],
      [
        { id: 'issue', label: 'issue' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['teardown', 'pagehide'],
        ['private', 'policy'],
        ['held res', 'release'],
        ['stale sec', 'recheck'],
      ],
    ),
    highlight: { removed: ['unload:issue'], active: ['locks:fix', 'sensitive:fix'] },
    explanation: 'Eligibility is about whether a live page can safely be frozen and resumed. unload handlers are especially hostile to BFCache; pagehide/pageshow are the lifecycle-friendly events.',
    invariant: 'If a page needs teardown, make it resumable teardown.',
  };

  yield {
    state: lifecycleGraph('beforeunload and unload can force slow navigations', { hide: 'unload?', cache: 'miss', resume: 'reload' }),
    highlight: { active: ['pageA', 'hide', 'pageB', 'e-a-hide', 'e-hide-pageB'], removed: ['cache', 'freeze', 'show'] },
    explanation: 'A page that insists on unload-style cleanup may be excluded from BFCache. The result is a full reload on Back, including network, parsing, script startup, and rendering.',
  };

  yield {
    state: lifecycleGraph('Release resources on pagehide and reacquire on pageshow', { hide: 'release', freeze: 'safe', show: 'reopen', resume: 'ready' }),
    highlight: { active: ['hide', 'freeze', 'cache', 'show', 'resume', 'e-hide-freeze', 'e-freeze-cache', 'e-cache-show'], found: ['pageA'] },
    explanation: 'The BFCache-friendly pattern is pause and resume. Release Web Locks, close transient connections if required, stop polling, and restart them on pageshow persisted.',
  };

  yield {
    state: labelMatrix(
      'Lifecycle events',
      [
        { id: 'pagehide', label: 'pagehide' },
        { id: 'pageshow', label: 'pageshow' },
        { id: 'visibility', label: 'visible' },
        { id: 'freeze', label: 'freeze' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'flag', label: 'flag' },
      ],
      [
        ['leaving', 'persisted'],
        ['returning', 'persisted'],
        ['hidden', 'none'],
        ['suspend', 'browser'],
      ],
    ),
    highlight: { active: ['pagehide:flag', 'pageshow:flag'], compare: ['visibility:flag'] },
    explanation: 'pagehide and pageshow are the key events for BFCache-aware code because they carry persisted. visibilitychange is useful, but it does not by itself say this is a BFCache restore.',
  };

  yield {
    state: lifecycleGraph('The complete case is a checkout page with volatile auth', { pageA: 'checkout', hide: 'pause', cache: 'maybe', show: 'auth check', resume: 'fresh UI' }),
    highlight: { active: ['pageA', 'hide', 'freeze', 'cache', 'show', 'resume'], compare: ['pageB'] },
    explanation: 'A checkout page avoids unload, pauses polling on pagehide, and on BFCache restore rechecks cart/auth state before enabling pay. The page feels instant without trusting stale sensitive data.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'restore path') yield* restorePath();
  else if (view === 'eligibility') yield* eligibility();
  else throw new InputError('Pick a BFCache view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        {
          type: 'image',
          src: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Client-server-model.svg',
          alt: 'Client-server model with clients connected to a server',
          caption: 'The normal web model starts with a client asking a server for bytes. BFCache changes the return path: Back can restore the old client-side document without asking the server first. Source: Wikimedia Commons, File:Client-server-model.svg, Calimo after David Vignoni, LGPL.',
        },
        'BFCache means back-forward cache: a browser memory cache for complete pages in session history. Read frozen as a page that keeps its DOM, JavaScript heap, scroll position, and form state but is not actively running normal page work. Read restored as the browser resuming that preserved document after Back or Forward.',
        {
          type: 'callout',
          text: 'The one safe inference rule is strict: pagehide with persisted true means the browser intends to preserve the page; pageshow with persisted true means it actually restored the page from BFCache.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'History traversal is not the same job as first navigation. On first navigation, the browser must fetch bytes, parse HTML, run scripts, build layout, and paint. On Back, the user is often asking for a page the browser just built seconds ago.',
        {
          type: 'callout',
          text: 'BFCache exists because history traversal is not the same problem as first navigation. The user is asking for a document the browser already built.',
        },
        'A product page with filters, scroll position, and form state can feel broken if Back reloads from scratch. BFCache makes the common case fast by preserving the live document rather than reconstructing it. The feature is a user-experience optimization with correctness constraints.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is normal HTTP caching. Cache the response bytes, reuse them on Back, then rebuild the page. This helps, especially when images, scripts, and API responses are warm.',
        {
          type: 'image',
          src: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/HTTP_persistent_connection.svg',
          alt: 'HTTP persistent connection diagram between client and server',
          caption: 'Even a warm HTTP connection still operates at the request-response layer. BFCache avoids the request path for a hit because the document is already in memory. Source: Wikimedia Commons, File:HTTP_persistent_connection.svg, helix84, public domain.',
        },
        {
          type: 'callout',
          text: 'HTTP cache makes a reload cheaper. BFCache removes the reload from the critical path.',
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'HTTP cache still rebuilds the page. It does not preserve JavaScript objects, in-progress UI state, scroll position, focus, media state, or client-only data that never came from the server. Rebuilding can be correct for fresh data but wrong for a user returning to a half-completed task.',
        {
          type: 'image',
          src: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Memory_hierarchy.svg',
          alt: 'Memory hierarchy diagram',
          caption: 'BFCache is deliberately memory-backed. The speed comes from resuming a live document, not reading response bytes from disk and rebuilding it. Source: Wikimedia Commons, File:Memory_hierarchy.svg, CC BY-SA 3.0; author credited on the file page.',
        },
        'The browser also cannot preserve every page safely. Open connections, unload handlers, sensitive state, active device access, and cross-page communication can make freezing dangerous or misleading. A cache hit must be fast and faithful, not just fast.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to cache the page as a suspended execution state. The browser freezes a complete document when navigating away, then resumes it if the user returns through session history. The page receives lifecycle events so application code can pause and resume external assumptions.',
        {
          type: 'callout',
          text: 'The application invariant is: preserve local UI state, distrust external truth.',
        },
        'Local UI state is allowed to survive because it is the point of the cache. External truth must be checked carefully because network data, permissions, authentication, and server-side state may have changed while the page slept. Restore code should be idempotent, meaning it can run more than once without corrupting state.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {
          type: 'callout',
          text: 'Chrome and Firefox differ in details, but the portable contract is the same: use pagehide/pageshow, read persisted, and make restore code idempotent.',
        },
        'When the user navigates away, the browser fires pagehide. If event.persisted is true, the browser intends to keep the page in BFCache. The page should pause timers, close or quiesce external resources when needed, and avoid writing code that assumes unload is the normal cleanup path.',
        'When the user comes back, the browser fires pageshow. If event.persisted is true, the page came from BFCache rather than a fresh load. The app can refresh stale data, reopen channels, resume timers, and leave preserved DOM state alone unless it has evidence that the state is invalid.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        {
          type: 'callout',
          text: 'Eligibility is not a browser preference. It is the browser refusing to freeze a document while doing so could break another page, leak sensitive state, or resume a lie.',
        },
        'The correctness argument is conservative eligibility plus explicit lifecycle signals. The browser only caches pages it believes can be frozen and restored without violating isolation or user expectations. The page then uses persisted flags to distinguish a restore from an initial load.',
        'This works because the browser owns the session-history transition. Application code should not guess by timing or URL alone. The persisted flag is the proof attached to the lifecycle event.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'BFCache spends memory to save navigation work. A cached page keeps DOM nodes, layout state, JavaScript heap objects, and some resource state alive. If memory pressure rises, the browser can evict entries, so an app must treat BFCache as an optimization rather than a guarantee.',
        'The behavioral cost is restore discipline. Code that assumes load always means fresh state will double-initialize analytics, duplicate event listeners, or skip data refresh. Code that assumes restore always means old state is valid can show stale authentication or stale inventory.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'callout',
          text: 'The sharper the local context, the more a full reload feels like data loss even when no server data is lost.',
        },
        'BFCache is valuable for search results, product listings, documentation, checkout flows, dashboards, and form-heavy apps. The access pattern is navigate into detail, then return to the previous page with context intact. Preserving scroll position and client state removes a common source of user frustration.',
        {
          type: 'callout',
          text: 'A good restore handler is usually shorter than a good load handler because most of the page is already correct.',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'BFCache fails when a page cannot be safely frozen or when app code fights the lifecycle. Unload handlers, unmanaged sockets, active locks, some embed patterns, and sensitive state can block eligibility depending on browser rules. A page can also be eligible in one browser and not another.',
        'It also fails when teams treat restore as reload. Rebuilding the whole app on pageshow destroys the main benefit. Ignoring pageshow is the opposite bug: the user sees preserved UI around external state that has changed.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A user opens a search results page with 120 products, scrolls to item 80, sets color = black, and clicks a product. Without BFCache, Back may reload results, refetch data, and leave the user near the top. With BFCache, the browser can restore the exact document in one history traversal.',
        'Assume first load took 900 ms: 150 ms network, 250 ms JavaScript, 300 ms rendering, and 200 ms API work. A BFCache hit might restore in under 100 ms because it avoids most of that path. The app still runs a pageshow handler that checks whether prices or login state must be refreshed.',
        'Correct restore logic does not clear the filter or scroll position. It only refreshes facts that came from outside the page while it slept. That is the difference between preserving user context and showing stale server truth.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'image',
          src: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/OSI_Model_v1.svg',
          alt: 'OSI model stack diagram',
          caption: 'HTTP caching lives around request and response bytes. BFCache lives above that stack in browser session history, at the level of the document and its JavaScript heap. Source: Wikimedia Commons, File:OSI_Model_v1.svg, Offnfopt, CC0/public domain.',
        },
        'Primary sources: web.dev BFCache guidance, MDN pageshow, MDN pagehide, Page Lifecycle API guidance, and browser vendor notes on BFCache eligibility. Use them because eligibility rules and browser behavior can change.',
        'Study next by role. For network caching, study HTTP cache and service workers. For lifecycle, study visibilitychange and page lifecycle states. For frontend correctness, study idempotent initialization, stale data refresh, and event-listener cleanup.',
      ],
    },
  ],
};
