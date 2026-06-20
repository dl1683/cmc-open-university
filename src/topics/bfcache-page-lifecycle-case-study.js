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
        'Read the animation as a safety gate around a session history entry. Page A is not being cached as response bytes. It is being considered as a living document that might be frozen, held in memory, and resumed if the user traverses Back or Forward.',
        {
          type: 'image',
          src: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Client-server-model.svg',
          alt: 'Client-server model with clients connected to a server',
          caption: 'The normal web model starts with a client asking a server for bytes. BFCache changes the return path: Back can restore the old client-side document without asking the server first. Source: Wikimedia Commons, File:Client-server-model.svg, Calimo after David Vignoni, LGPL.',
        },
        {
          type: 'bullets',
          items: [
            'Active nodes are the browser and document states doing lifecycle work right now: pagehide, freeze, storage in BFCache, pageshow, or resume.',
            'Compare nodes are possible paths that still exist but have not won: a fresh reload, a later pageshow, an eligibility check, or the next page.',
            'Found nodes are confirmed outcomes: the snapshot was kept, the page was restored, or app code has finished its narrow revalidation work.',
            'Removed nodes are rejected restore paths: a blocker forced reload, the entry was evicted, or a resource made the snapshot unsafe to preserve.',
          ],
        },
        {
          type: 'callout',
          text: 'The one safe inference rule is strict: pagehide with persisted true means the browser intends to preserve the page; pageshow with persisted true means it actually restored the page from BFCache.',
        },
        'That distinction prevents two common bugs. A pagehide handler must not assume success, because memory pressure or a late blocker can still evict the entry. A pageshow handler can assume success only when persisted is true, because the same event also fires on normal page loads.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Back and Forward are not rare browser controls. Chrome usage data cited by web.dev says about 1 in 10 desktop navigations and 1 in 5 mobile navigations are back or forward. Those navigations are usually motivated by a simple human expectation: the page was just here, so returning to it should feel immediate.',
        'The old web contract made that expectation expensive. When the user left a page, the browser could destroy the document. When the user returned, the browser might send another HTTP request, parse the response, rebuild the DOM and CSSOM, run scripts again, lay out the page, paint it, and ask the application to reconstruct state that already existed seconds ago.',
        {
          type: 'quote',
          text: 'With back/forward cache (bfcache), instead of destroying a page when the user navigates away, we postpone destruction and pause JS execution.',
          attribution: 'web.dev, "Back/forward cache"',
        },
        {
          type: 'callout',
          text: 'BFCache exists because history traversal is not the same problem as first navigation. The user is asking for a document the browser already built.',
        },
        'The browser can exploit that fact because session history has identity. The entry for Page A is not merely the URL /products?page=4. It can also be a specific Document with a DOM tree, JavaScript heap, scroll offset, form controls, rendering state, and event listeners. If freezing that document is safe, reusing it is more faithful than rebuilding it.',
        {
          type: 'table',
          headers: ['State category', 'Good BFCache candidate', 'Must be revalidated after restore'],
          rows: [
            ['User-local UI', 'Scroll position, text typed into a form, selected filters, expanded panels', 'Usually no; the user expects these to remain exactly as left'],
            ['Browser-local rendering', 'DOM tree, style data, layout state, canvas pixels, focused element', 'Usually no; this is the snapshot itself'],
            ['External truth', 'Displayed account name, cart total, inventory, permissions, unread count', 'Yes; the server, another tab, or time may have changed it'],
            ['External resources', 'WebSocket, WebRTC, IndexedDB transaction, Web Lock, in-flight request', 'Often yes; some must be closed before freezing and reopened on restore'],
          ],
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is destroy-and-rebuild. It is easy to reason about because every navigation uses the same cold-load path. Leave the page, run teardown, discard the document, then rebuild everything if the user comes back.',
        {
          type: 'diagram',
          text: [
            '  User leaves Page A                 User presses Back',
            '        |                                   |',
            '  pagehide / unload                    HTTP request',
            '        |                                   |',
            '  destroy document                     parse HTML',
            '        |                                   |',
            '  Page B active                        build DOM + CSSOM',
            '                                            |',
            '                                      parse and run JS',
            '                                            |',
            '                                      layout, paint, hydrate',
            '                                            |',
            '                                      reconstruct app state',
          ].join('\n'),
          label: 'Destroy-and-rebuild is simple for the browser, but it throws away exactly the state the user expects Back to preserve.',
        },
        'This approach is not foolish. It gives the server a new request, guarantees the page is rebuilt from current bytes, and avoids a second lifecycle model. It also matches a long-standing mental model in old application code: load means begin, unload means final cleanup.',
        'That model collapses as pages become applications. A search page may hold scroll position 500 items deep. A dashboard may hold a computed chart model. A checkout page may hold unsent form text and a payment button whose availability depends on server-side state. Rebuilding from bytes either loses the local state or forces the application to serialize and replay large pieces of itself.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is not one cost. It is the whole cold-start pipeline repeated on a navigation that could have been a resume.',
        {
          type: 'image',
          src: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/HTTP_persistent_connection.svg',
          alt: 'HTTP persistent connection diagram between client and server',
          caption: 'Even a warm HTTP connection still operates at the request-response layer. BFCache avoids the request path for a hit because the document is already in memory. Source: Wikimedia Commons, File:HTTP_persistent_connection.svg, helix84, public domain.',
        },
        {
          type: 'table',
          headers: ['Cold return work', 'Why HTTP cache does not remove it'],
          rows: [
            ['HTML parse and DOM construction', 'Cached bytes still have to become nodes'],
            ['CSS parse, style calculation, layout', 'Cached CSS saves transfer, not layout work'],
            ['JavaScript parse, compile, execute, hydrate', 'Cached JS still consumes CPU and main-thread time'],
            ['App state reconstruction', 'HTTP cache has no memory of expanded panels, closures, in-memory stores, or active selection'],
            ['Core Web Vitals collection', 'A reload creates new loading, interaction, and layout-shift measurements'],
          ],
        },
        'The performance impact is visible in field data. web.dev reports Chrome back/forward navigation share as roughly 10% on desktop and 20% on mobile. Barry Pollard documented a Smashing Magazine case study where removing a BFCache blocker moved mobile origin p75 LCP from roughly 2.4 seconds, then about 2.2 seconds after other JavaScript work, down to 1.7 seconds after the BFCache fix. The same case study showed CrUX good-LCP share rising from the high-70s to 81.58% and then 86.51%.',
        {
          type: 'callout',
          text: 'HTTP cache makes a reload cheaper. BFCache removes the reload from the critical path.',
        },
        'The state wall is just as important. Destroy-and-rebuild can restore some state through URL parameters, sessionStorage, IndexedDB, framework stores, and custom scroll restoration. That is application-level reimplementation of what the browser already knows. It is also incomplete: closures, event listener identity, focus, selection ranges, unsent text, canvas pixels, and computed client-side structures do not naturally round-trip through URLs.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A BFCache entry is a frozen document attached to session history. It is not a resource cache, a service-worker cache, or a prerender. It is the browser saying: this history entry can keep its Document alive while another entry is active.',
        {
          type: 'image',
          src: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Memory_hierarchy.svg',
          alt: 'Memory hierarchy diagram',
          caption: 'BFCache is deliberately memory-backed. The speed comes from resuming a live document, not reading response bytes from disk and rebuilding it. Source: Wikimedia Commons, File:Memory_hierarchy.svg, CC BY-SA 3.0; author credited on the file page.',
        },
        {
          type: 'diagram',
          text: [
            '  HTTP cache hit                      BFCache hit',
            '',
            '  cached response bytes               frozen Document',
            '        |                                  |',
            '  parse HTML again                    resume JS heap',
            '        |                                  |',
            '  build DOM again                     restore DOM as-is',
            '        |                                  |',
            '  run startup JS                      fire pageshow persisted=true',
            '        |                                  |',
            '  layout and paint                    narrow app revalidation',
          ].join('\n'),
          label: 'The difference is object identity. HTTP cache reuses bytes; BFCache reuses the document object graph.',
        },
        'That turns the engineering problem into a classification problem. Which state is safe to preserve because it belongs to the user and the document? Which state is unsafe to trust because it belongs to the outside world?',
        {
          type: 'callout',
          text: 'The application invariant is: preserve local UI state, distrust external truth.',
        },
        'Scroll position, text typed into a form, a comparison drawer, a selected tab, and a virtualized list window are local. They should survive. Auth status, inventory, prices, permissions, unread counts, cart totals, and payment readiness are external. They must be checked after restore. BFCache is fast because the restore handler is narrow; it repairs freshness without rebuilding the page.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The browser owns the sequence. Application code observes a few events and must not pretend it controls the cache.',
        {
          type: 'table',
          headers: ['Step', 'Browser action', 'Application rule'],
          rows: [
            ['User navigates away', 'Dispatch pagehide on the old document', 'If event.persisted is true, pause resources that cannot safely be frozen'],
            ['Eligibility check', 'Reject pages with disqualifying features or unsafe active work', 'Avoid unload, close or release shared external resources, keep beforeunload conditional'],
            ['Freeze', 'Suspend freezable task queues; Chromium may dispatch freeze after pagehide persisted=true', 'Do the minimum; a freeze handler is not a place for slow cleanup'],
            ['Store', 'Keep the Document, DOM, JS heap, scroll and render state in memory', 'Do not assume it will remain there indefinitely'],
            ['Restore', 'Resume the document and dispatch pageshow with persisted=true', 'Revalidate volatile state, reconnect resources, send analytics for a BFCache restore'],
          ],
        },
        'Chrome exposes two overlapping surfaces. The cross-browser surface is pagehide/pageshow with the persisted flag. The Chromium Page Lifecycle surface adds freeze and resume events, and Chrome documents frozen as a state where freezable tasks such as timers and fetch callbacks are suspended until the page is unfrozen. Already-running tasks may finish, but new freezable work does not keep progressing in the frozen page.',
        'Firefox exposed the core model much earlier. Mozilla documentation for Firefox 1.5 describes in-memory caching for entire web pages, including JavaScript state, for a browser session. On a cached return, inline scripts and the load handler do not rerun because their effects were preserved; pageshow is the event for code that must run when a cached page is shown again, and pagehide is the unload-compatible event that keeps caching possible.',
        {
          type: 'callout',
          text: 'Chrome and Firefox differ in details, but the portable contract is the same: use pagehide/pageshow, read persisted, and make restore code idempotent.',
        },
        {
          type: 'code',
          language: 'javascript',
          text: [
            'let socket = null;',
            'let db = null;',
            'let pricePollId = 0;',
            '',
            'function stopVolatileWork() {',
            '  clearInterval(pricePollId);',
            '  pricePollId = 0;',
            '  socket?.close(1001, "page hidden");',
            '  socket = null;',
            '  db?.close();',
            '  db = null;',
            '}',
            '',
            'async function resumeVolatileWork() {',
            '  db = await openCatalogDatabase();',
            '  socket = new WebSocket("/prices");',
            '  await Promise.all([',
            '    refreshVisiblePrices(),',
            '    checkAuthStatus(),',
            '    refreshCartVersion(),',
            '  ]);',
            '  pricePollId = setInterval(refreshVisiblePrices, 30000);',
            '}',
            '',
            'window.addEventListener("pagehide", (event) => {',
            '  if (event.persisted) {',
            '    // The browser intends to cache this document.',
            '    // Make shared resources safe to freeze.',
            '    stopVolatileWork();',
            '  }',
            '});',
            '',
            'window.addEventListener("pageshow", (event) => {',
            '  if (event.persisted) {',
            '    // The document was actually restored from BFCache.',
            '    // Keep DOM state; refresh external truth.',
            '    resumeVolatileWork();',
            '    analytics.track("bfcache_restore");',
            '  }',
            '});',
          ].join('\n'),
          label: 'BFCache-aware code is pause-and-resume code, not teardown-and-boot code.',
        },
        'The most common implementation mistake is putting destructive cleanup behind pagehide. pagehide fires both for discard and for possible caching. If the page clears forms, destroys stores, resets scroll, or tears down the UI during pagehide, the browser may faithfully preserve the damaged state.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'BFCache is correct because the browser controls the two invariants application code cannot enforce by itself.',
        {
          type: 'table',
          headers: ['Invariant', 'Browser guarantee', 'Application responsibility'],
          rows: [
            ['Single active history entry', 'Only one Document is the active page in the browsing context', 'Do not expect a BFCache page to keep running background logic'],
            ['Frozen state is inert', 'Freezable tasks do not run while the page is frozen', 'Release resources that would block other tabs or external systems'],
            ['Restore is atomic', 'DOM, JS heap, scroll, and render state return together', 'Do not rebuild the app on pageshow persisted=true'],
            ['Events mark the boundary', 'pagehide precedes possible freeze; pageshow follows restore', 'Use persisted to choose pause/resume code paths'],
            ['Eligibility is browser-owned', 'The browser may reject or evict entries for safety and memory', 'Measure misses and fix blockers; never assume a hit'],
          ],
        },
        'The persisted flag is the key proof object. On pagehide, persisted=false proves the page is not entering BFCache. persisted=true says the browser is attempting to preserve it, not that preservation has completed. On pageshow, persisted=true proves the visible document was restored from BFCache. That is the only moment where code should run BFCache-specific restore logic.',
        'The safety proof is separation by ownership. Local document state belongs to the frozen document and cannot change while it is frozen. External state belongs to systems that keep moving: servers, other tabs, databases, locks, sockets, payment providers, and clocks. Restoring the document is safe only if the app rechecks the external side before letting the user act on stale truth.',
        {
          type: 'callout',
          text: 'Eligibility is not a browser preference. It is the browser refusing to freeze a document while doing so could break another page, leak sensitive state, or resume a lie.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'BFCache moves cost from CPU and network to memory and lifecycle discipline.',
        {
          type: 'table',
          headers: ['Dimension', 'BFCache hit', 'Cold history reload'],
          rows: [
            ['Network', 'No document request before display; restore handler may revalidate data after display', 'Document, subresources, and API calls may run again'],
            ['JavaScript', 'Existing heap resumes; only restore code runs', 'Scripts parse, compile, execute, and hydrate again'],
            ['Rendering', 'Existing document and render state are made visible', 'DOM, CSSOM, style, layout, paint, and compositing run again'],
            ['State fidelity', 'Scroll, forms, selection, closures, and in-memory app state are preserved', 'Only state explicitly serialized by the app returns'],
            ['Memory', 'A full document snapshot occupies memory until eviction', 'Old document memory is released earlier'],
            ['Reliability', 'Hit is best effort and browser controlled', 'Reload always works if the network and server do'],
          ],
        },
        'The browser must cap memory. A complex application can hold a large DOM, a large JavaScript heap, decoded images, canvases, and render data. Browsers therefore keep only a bounded, implementation-defined number of entries and may evict under memory pressure, process constraints, privacy policy, or feature-specific blockers. The application cannot force a BFCache entry to exist.',
        'Chrome has made this diagnosable. DevTools has a Back-forward Cache test under Application. Chrome 123 shipped PerformanceNavigationTiming.notRestoredReasons, which can expose why a history navigation could not use BFCache in the field. The response can name reasons such as an unload listener and can include iframe details, but Chrome warns developers not to depend on exact reason text as a stable product API.',
        {
          type: 'code',
          language: 'javascript',
          text: [
            'window.addEventListener("pageshow", () => {',
            '  const navigation = performance.getEntriesByType("navigation")[0];',
            '',
            '  if (navigation?.type === "back_forward" &&',
            '      navigation.notRestoredReasons) {',
            '    console.log("BFCache miss:", navigation.notRestoredReasons);',
            '  }',
            '});',
          ].join('\n'),
          label: 'On a history navigation that reloaded instead of restoring, Chrome can report the miss reasons through PerformanceNavigationTiming.notRestoredReasons.',
        },
        'Core Web Vitals measurement needs the same lifecycle awareness. web.dev says CrUX treats BFCache restores as separate page visits. For a BFCache restore, LCP can be approximated as the delta between the pageshow timestamp and the next painted frame because all visible content is already available; FCP and LCP collapse to the same restore paint. INP and CLS observers should reset their current values for the restored visit.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['Flow', 'Why BFCache wins', 'Restore work'],
          rows: [
            ['Search results to detail and back', 'The list position and filters are the product experience', 'Refresh ads, session, availability badges'],
            ['Inbox to message and back', 'Triage depends on returning to the same list row', 'Refresh read state and unread counts'],
            ['Documentation page to example and back', 'Readers expect the same scroll anchor and open section', 'Maybe refresh version banners'],
            ['Product list to product detail and back', 'Infinite scroll and comparison drawers are expensive to reconstruct', 'Refresh prices, cart version, and inventory'],
            ['Dashboard to drill-down and back', 'Client-side chart models and filters can be expensive to rebuild', 'Refresh real-time values and permissions'],
            ['Multi-step form', 'Back is correction, not abandonment', 'Refresh CSRF token and server-derived select options'],
          ],
        },
        'The common access pattern is repeated traversal over a stateful client surface. BFCache is less valuable on a static article with no user state and more valuable on pages where the user has built context by scrolling, filtering, typing, selecting, expanding, and comparing.',
        {
          type: 'callout',
          text: 'The sharper the local context, the more a full reload feels like data loss even when no server data is lost.',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'BFCache fails when the app confuses fast restore with fresh truth. A page frozen for 20 minutes may show a user as signed in after they signed out in another tab, show inventory that has sold out, display a price that changed, or enable a payment action whose token has expired.',
        {
          type: 'table',
          headers: ['Failure mode', 'Root cause', 'Repair'],
          rows: [
            ['Stale sensitive UI', 'pageshow persisted=true does not recheck auth, cart, permissions, or price', 'Disable risky controls until revalidation completes'],
            ['Missed BFCache entirely', 'unload listener, unclosed shared resource, in-flight transaction, no-store policy, iframe blocker', 'Use pagehide, close or release shared resources, audit headers and third parties'],
            ['Destroyed snapshot', 'pagehide handler clears UI as if the page is ending forever', 'Only pause volatile work on pagehide persisted=true'],
            ['Analytics undercount or double count', 'Tool treats restores like neither visits nor loads', 'Send a restore event keyed by pageshow persisted=true'],
            ['Over-revalidation', 'pageshow handler runs the full boot path', 'Refresh external data in place; preserve the DOM and framework state'],
            ['Cross-browser surprise', 'Assumes Chromium freeze/resume or Chrome-specific diagnostics exist everywhere', 'Use pageshow/pagehide as the portable path; test target browsers'],
          ],
        },
        'The unload event is the most important blocker to remove. Chrome and Firefox desktop have treated unload listeners as BFCache-hostile; current Chrome docs say unload is being gradually deprecated by changing the default so handlers stop firing unless a page opts back in. The replacement is not a bigger unload handler. It is visibilitychange for last reliable save points, pagehide for navigation away, and pageshow for restore.',
        'Some failures are not bugs. A browser may evict an entry under memory pressure. It may refuse to cache a page with sensitive cache policy or unsafe active resources. It may reject a frame tree where an iframe uses a blocking API. A correct application still works after reload; BFCache is a performance and state-fidelity optimization, not the only correct path.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A checkout page shows the real contract. The page should feel instant on Back because form fields, shipping choice, and scroll position are local user state. It must not let the user pay until auth, cart, inventory, and payment token state have been checked because those are external truth.',
        {
          type: 'code',
          language: 'javascript',
          text: [
            'window.addEventListener("pageshow", async (event) => {',
            '  if (!event.persisted) return;',
            '',
            '  payButton.disabled = true;',
            '  statusBanner.textContent = "Refreshing checkout...";',
            '',
            '  try {',
            '    const [auth, cart, inventory, token] = await Promise.all([',
            '      fetch("/api/auth/check", { cache: "no-store" }),',
            '      fetch("/api/cart", { cache: "no-store" }),',
            '      fetch("/api/inventory/check", {',
            '        method: "POST",',
            '        headers: { "content-type": "application/json" },',
            '        body: JSON.stringify({ items: cartItems }),',
            '      }),',
            '      fetch("/api/payment-token", { cache: "no-store" }),',
            '    ]);',
            '',
            '    if (!auth.ok) {',
            '      redirectToLogin();',
            '      return;',
            '    }',
            '',
            '    const [cartData, stockData, tokenData] = await Promise.all([',
            '      cart.json(),',
            '      inventory.json(),',
            '      token.json(),',
            '    ]);',
            '',
            '    updateCartIfChanged(cartData);',
            '    showUnavailableItems(stockData.unavailable);',
            '    paymentToken = tokenData.value;',
            '',
            '    payButton.disabled = stockData.unavailable.length > 0;',
            '    statusBanner.textContent = "";',
            '  } catch (error) {',
            '    statusBanner.textContent = "Could not refresh checkout. Try again.";',
            '  }',
            '});',
          ].join('\n'),
          label: 'The DOM appears immediately, but payment stays locked until volatile state is fresh.',
        },
        'The important part is what the handler does not do. It does not rerender the checkout from scratch. It does not clear the form. It does not reset scroll. It does not route through the initial application boot sequence. It narrows work to the state that can have changed outside the frozen document.',
        {
          type: 'callout',
          text: 'A good restore handler is usually shorter than a good load handler because most of the page is already correct.',
        },
      ],
    },
    {
      heading: 'BFCache versus adjacent caching mechanisms',
      paragraphs: [
        {
          type: 'image',
          src: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/OSI_Model_v1.svg',
          alt: 'OSI model stack diagram',
          caption: 'HTTP caching lives around request and response bytes. BFCache lives above that stack in browser session history, at the level of the document and its JavaScript heap. Source: Wikimedia Commons, File:OSI_Model_v1.svg, Offnfopt, CC0/public domain.',
        },
        {
          type: 'table',
          headers: ['Mechanism', 'What it stores', 'When it helps', 'What it cannot preserve'],
          rows: [
            ['HTTP cache', 'Response bytes for documents and subresources', 'Any repeat fetch governed by HTTP caching policy', 'DOM identity, JS heap, scroll, form state'],
            ['Service worker cache', 'Request/response pairs controlled by application code', 'Offline and programmable fetch handling', 'Live document state'],
            ['BFCache', 'A frozen live Document attached to session history', 'Back/Forward traversal to a kept entry', 'External truth that changed while frozen'],
            ['Prerender / Speculation Rules', 'A live document created before a predicted forward navigation', 'Predicted future navigation', 'A past page unless it separately enters BFCache'],
            ['Paint holding', 'A visual frame during navigation transition', 'Short visual continuity', 'Interactivity and JavaScript heap state'],
          ],
        },
        'The false comparison is HTTP cache versus BFCache. They solve different layers. HTTP cache can make the network cheap. Service workers can make fetch programmable. BFCache makes history traversal a resume operation. A page can benefit from all three, but only BFCache preserves object identity.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Primary guide: Philip Walton and Barry Pollard, "Back/forward cache," web.dev. https://web.dev/articles/bfcache',
            'Chrome Page Lifecycle API: https://developer.chrome.com/docs/web-platform/page-lifecycle-api',
            'Chrome notRestoredReasons API, shipped from Chrome 123: https://developer.chrome.com/docs/web-platform/bfcache-notrestoredreasons',
            'Chrome unload deprecation timeline and alternatives: https://developer.chrome.com/docs/web-platform/deprecating-unload',
            'MDN pagehide event: https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event',
            'MDN pageshow event: https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event',
            'Mozilla Firefox 1.5 caching behavior: https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/1.5/Using_Firefox_1.5_caching',
            'Chrome prototype and multi-process note: https://developer.chrome.com/blog/back-forward-cache',
            'Barry Pollard, "Performance Game Changer: Browser Back/Forward Cache," Smashing Magazine. https://www.smashingmagazine.com/2022/05/performance-game-changer-back-forward-cache/',
          ],
        },
        {
          type: 'table',
          headers: ['Role', 'Topic', 'Why it comes next'],
          rows: [
            ['Prerequisite', 'History API Session Stack', 'BFCache entries are attached to session history, not just URLs'],
            ['Prerequisite', 'Browser Rendering Pipeline', 'A BFCache hit is fast because it skips parse, style, layout, startup JS, and hydration'],
            ['Sibling', 'HTTP Cache ETag Revalidation', 'HTTP cache saves bytes; BFCache saves a live document'],
            ['Sibling', 'Service Workers and Offline-First', 'Service workers intercept fetch; they do not preserve JS heap state'],
            ['Extension', 'Page Lifecycle API', 'freeze/resume explain how browsers suspend work for memory and battery'],
            ['Extension', 'NotRestoredReasons Diagnostics', 'Production teams need field data for BFCache misses, not only DevTools tests'],
            ['Application', 'AbortController Cancellation Graph', 'In-flight work and shared resources need explicit pause/resume structure'],
            ['Contrast', 'Prerender Speculation Rules', 'Prerender creates a future document; BFCache preserves a past one'],
          ],
        },
      ],
    },
  ],
};
