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
        'The animation has two views. The restore path view shows a page moving through the BFCache lifecycle: pagehide, freeze, snapshot storage, and restoration via pageshow. The eligibility view shows what blocks a page from entering BFCache and how to fix each blocker.',
        {
          type: 'bullets',
          items: [
            'Active nodes are the participants handling the current lifecycle transition -- the page firing pagehide, the browser freezing JS, or the cache storing the snapshot.',
            'Compare nodes are parts of the lifecycle not yet reached or not involved in the current step.',
            'Found nodes are outcomes now confirmed -- a successful BFCache hit, a restored page, a revalidated session.',
            'Removed nodes mark paths the browser rejected -- an evicted snapshot, a blocked cache entry, or a feature that prevented freezing.',
          ],
        },
        'One safe inference rule: if the cache node is active and the show node is found, the page restored from a live in-memory snapshot, not from an HTTP cache response or a fresh network load. That distinction is the entire point of BFCache.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Back and Forward are not edge cases. They are among the most common navigation actions on the web. Chrome telemetry from the Page Lifecycle API proposal (2018) showed that back/forward navigations account for roughly 19% of all navigations on Android Chrome and 10% on desktop Chrome. Every one of those navigations destroys the current page and rebuilds the previous one from scratch unless the browser intervenes.',
        {
          type: 'quote',
          text: 'Back/forward cache stores a complete snapshot of the page (including the JavaScript heap) when the user navigates away. The entire page is in memory, and the browser does not need to fetch any resources to restore it.',
          attribution: 'Philip Walton -- "Back/forward cache," web.dev, 2021',
        },
        'A full reload on Back repeats everything: DNS, TCP, TLS, HTTP request, response parsing, HTML tokenization, DOM construction, CSSOM, layout, paint, JavaScript execution, and framework hydration. On a median mobile page, that is 3-8 seconds of work. BFCache eliminates all of it by keeping the frozen page in memory and restoring it in under 100 milliseconds.',
        {
          type: 'table',
          headers: ['What BFCache preserves', 'What it does NOT preserve'],
          rows: [
            ['Complete DOM tree', 'Server-side session state'],
            ['JavaScript heap and closures', 'WebSocket connections (closed by spec)'],
            ['Scroll position', 'Web Locks (released on freeze)'],
            ['Form field values (typed text, selections)', 'Active media streams'],
            ['Canvas pixel data', 'Pending fetch() or XMLHttpRequest'],
            ['CSS computed styles and layout', 'setTimeout/setInterval execution'],
          ],
        },
        'The hard part is not the snapshot itself. It is deciding when freezing is safe. A page is not just pixels. It may hold open database transactions, active WebSocket streams, pending payment authorizations, or stale authentication tokens. BFCache works only when the browser can guarantee that freezing the page will not corrupt external state, and that restoring it will not present stale truth as current.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is destroy-and-rebuild. When the user leaves page A, tear it down completely: fire unload, release all resources, discard the DOM. When the user presses Back, treat it as a fresh navigation: send an HTTP request, parse the response, rebuild the document, run all scripts, reconstruct application state.',
        {
          type: 'diagram',
          text: [
            '  User clicks link        User presses Back',
            '       |                        |',
            '  [Page A: unload]         [HTTP GET /page-a]',
            '       |                        |',
            '  [Destroy DOM]            [Parse HTML]',
            '       |                        |',
            '  [Page B: load]           [Build DOM]',
            '                                |',
            '                           [Run JS]',
            '                                |',
            '                           [Layout + Paint]',
            '                                |',
            '                           [App state ??? ]',
          ].join('\n'),
          label: 'Destroy-and-rebuild: every Back is a cold start. Scroll position, expanded panels, in-memory edits, and client-side caches are lost.',
        },
        'This works. It is simple. Every page load follows the same path regardless of how the user arrived. Frameworks do not need lifecycle-aware code. The server always sees a real request.',
        'Teams reach for this because it avoids complexity. There is no second code path, no freeze/resume contract, no staleness checking. The same cold-load logic handles every entry.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is twofold: latency and lost state.',
        {
          type: 'table',
          headers: ['Cost of destroy-and-rebuild', 'Typical penalty'],
          rows: [
            ['Network round trip (DNS + TCP + TLS + HTTP)', '200-800ms on mobile'],
            ['HTML parsing and DOM construction', '50-200ms'],
            ['CSS parsing and CSSOM build', '20-100ms'],
            ['JavaScript download, parse, compile, execute', '500-3000ms on median mobile page'],
            ['Framework hydration / app boot', '200-2000ms (framework-dependent)'],
            ['Layout and first paint', '50-300ms'],
            ['Total cold-start cost', '1-8 seconds on mobile'],
          ],
        },
        'The latency wall hits hardest on the navigation patterns that matter most. A user bouncing between search results and detail pages, between an inbox and messages, between documentation tabs -- these are rapid, repetitive, and the user expects instant return because they just saw the page seconds ago.',
        'The state wall is worse than the latency wall. A full reload cannot restore in-memory form edits that were never submitted, expanded accordion panels, client-side filter selections, precisely scrolled positions within long lists, or transient UI context like hover states and selection ranges. The app can try to serialize and restore some of this through sessionStorage or URL state, but that is fragile, incomplete, and pushes lifecycle complexity into application code anyway.',
        {
          type: 'note',
          text: 'The unload event is the conceptual root of the wall. Pages that register unload listeners are telling the browser "I need final cleanup because this page is ending forever." That assumption is hostile to BFCache because BFCache assumes the opposite: leaving may be temporary. Chrome, Firefox, and Safari all treat the presence of an unload listener as a signal that may block BFCache eligibility.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A session history entry can hold a suspended live document. A BFCache hit is not an HTTP cache hit. It does not fetch a cached response from disk and replay page construction. It resumes the exact frozen JavaScript heap, DOM tree, and rendering state that were alive when the user left.',
        {
          type: 'diagram',
          text: [
            '  HTTP Cache hit:                    BFCache hit:',
            '',
            '  [Cached response bytes]            [Frozen live document]',
            '       |                                  |',
            '  [Parse HTML again]                 [Resume JS heap]',
            '       |                                  |',
            '  [Build DOM again]                  [Restore DOM as-is]',
            '       |                                  |',
            '  [Run JS again]                    [Fire pageshow]',
            '       |                                  |',
            '  [Layout + Paint]                  [Composite existing layers]',
            '       |                                  |',
            '  ~200-2000ms                        ~10-100ms',
          ].join('\n'),
          label: 'HTTP cache saves network time. BFCache saves everything: parse, script, layout, paint, and state reconstruction.',
        },
        'The invariant for application code: preserve stable local UI state, recheck volatile external state. Scroll position, typed form text, expanded panels, and client-side render state are good snapshot candidates -- they depend only on the user and the DOM. Auth tokens, cart contents, inventory, permissions, WebSocket freshness, and payment readiness must be revalidated after restore because they depend on external systems where time has passed.',
        {
          type: 'code',
          language: 'javascript',
          text: [
            '// The entire BFCache contract in application code:',
            '',
            '// 1. On leave: release resources that cannot be frozen',
            'window.addEventListener("pagehide", (event) => {',
            '  if (event.persisted) {',
            '    // Page MAY enter BFCache. Pause, do not destroy.',
            '    pollController.abort();',
            '    analyticsFlush();',
            '  }',
            '});',
            '',
            '// 2. On return: recheck what depends on external time',
            'window.addEventListener("pageshow", (event) => {',
            '  if (event.persisted) {',
            '    // Page restored from BFCache. Do NOT rebuild the app.',
            '    revalidateAuth();',
            '    refreshStaleData();',
            '    reconnectWebSocket();',
            '    trackPageView("bfcache-restore");',
            '  }',
            '});',
          ].join('\n'),
          label: 'pagehide with persisted=true means "you might come back." pageshow with persisted=true means "you did come back."',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The Page Lifecycle API defines a state machine with six states. BFCache uses four of them. Understanding the full state machine clarifies where BFCache fits relative to other browser behaviors like tab discarding and background throttling.',
        {
          type: 'diagram',
          text: [
            '  Page Lifecycle States:',
            '',
            '  [active] ---(tab switch)---> [passive] ---(hide)---> [hidden]',
            '     ^                            ^                       |',
            '     |                            |              (may freeze)',
            '     |                            |                       v',
            '     |                            |                   [frozen]',
            '     |                            |                       |',
            '     |                            |              (navigate away)',
            '     |                            |                       v',
            '     +----(BFCache restore)-------+                 [BFCache entry]',
            '                                                        |',
            '                                                (memory pressure)',
            '                                                        v',
            '                                                  [discarded]',
          ].join('\n'),
          label: 'The lifecycle moves left-to-right on leave, right-to-left on restore. Discarded pages cannot return.',
        },
        {
          type: 'table',
          headers: ['Lifecycle event', 'When it fires', 'persisted flag', 'BFCache role'],
          rows: [
            ['pageshow', 'Page becomes visible (load or BFCache restore)', 'true if from BFCache, false on initial load', 'Trigger restore work: revalidate data, reconnect channels'],
            ['pagehide', 'Page is leaving (navigation or BFCache freeze)', 'true if page may be cached, false if being destroyed', 'Trigger pause work: release locks, abort polls, flush analytics'],
            ['visibilitychange', 'Tab hidden/shown, app switch', 'none', 'Useful for throttling but does NOT indicate BFCache'],
            ['freeze', 'Browser suspends all JS execution', 'none', 'Browser-initiated; marks the moment timers and tasks stop'],
            ['resume', 'Browser resumes JS execution', 'none', 'Browser-initiated; paired with freeze'],
            ['unload', 'Page is being destroyed (NOT BFCache-friendly)', 'none', 'Registering this listener may BLOCK BFCache eligibility'],
          ],
        },
        'On navigation away, the browser fires pagehide. If the page is eligible and resources allow, the browser freezes the JavaScript execution context: timers stop, microtask queues drain, promises suspend, and the page enters the frozen state. The entire document -- DOM, JS heap, CSS state, scroll position, form values, canvas data -- is attached to the session history entry as a live snapshot.',
        'On Back or Forward traversal, the browser checks if a snapshot exists for the target history entry. If it does, the browser composites the existing render layers, resumes the JS heap, and fires pageshow with event.persisted set to true. The entire process takes 10-100ms because no network, parsing, or script compilation occurs.',
        {
          type: 'note',
          text: 'A BFCache miss still has to work. The browser may decline to cache a page, evict it under memory pressure, or apply browser-specific rules. Correct code handles both paths: instant resume when the snapshot exists, normal cold load when it does not. The pageshow event fires in both cases -- only the persisted flag differs.',
        },
      ],
    },
    {
      heading: 'Eligibility and blockers',
      paragraphs: [
        'Not every page can enter BFCache. The browser evaluates a set of eligibility criteria when the user navigates away. If any criterion fails, the page is destroyed normally and a Back navigation triggers a full reload.',
        {
          type: 'table',
          headers: ['Blocker', 'Why it blocks', 'Fix'],
          rows: [
            ['unload event listener', 'Signals the page expects destruction, not suspension', 'Remove it. Use pagehide instead.'],
            ['Cache-Control: no-store', 'Page explicitly forbids any caching', 'Use no-cache (allows conditional reuse) or remove the header for non-sensitive pages'],
            ['Open IndexedDB connection', 'Other tabs may need exclusive access; frozen page holds the connection', 'Close the connection on pagehide, reopen on pageshow'],
            ['Active WebSocket', 'Frozen page cannot respond to server pushes', 'Close on pagehide. Protocol requires clean close before freeze.'],
            ['Pending fetch() or XMLHttpRequest', 'In-flight requests cannot be frozen mid-stream', 'Abort pending requests on pagehide via AbortController'],
            ['BroadcastChannel with listener', 'Frozen page cannot process cross-tab messages', 'Remove listener on pagehide, re-add on pageshow'],
            ['Web Locks held', 'Other tabs may be waiting for the lock', 'Release locks on pagehide, reacquire on pageshow'],
            ['SharedWorker connection', 'Frozen page cannot communicate with shared worker', 'Close the port on pagehide'],
          ],
        },
        {
          type: 'code',
          language: 'javascript',
          text: [
            '// Diagnosing BFCache eligibility in Chrome DevTools:',
            '',
            '// 1. Open DevTools > Application > Back/forward cache',
            '// 2. Click "Test back/forward cache"',
            '// 3. Chrome navigates away and back, then reports:',
            '',
            '// "Not served from back/forward cache"',
            '// Reasons:',
            '//   - "unload handler" (page registered window.onunload)',
            '//   - "WebSocket" (open WebSocket connection)',
            '',
            '// Or programmatically via the NotRestoredReasons API:',
            'window.addEventListener("pageshow", (event) => {',
            '  if (!event.persisted) {',
            '    const reasons = performance',
            '      .getEntriesByType("navigation")[0]',
            '      ?.notRestoredReasons;',
            '    if (reasons) {',
            '      console.log("BFCache blocked:", reasons);',
            '    }',
            '  }',
            '});',
          ].join('\n'),
          label: 'Chrome 123+ exposes NotRestoredReasons, letting sites diagnose exactly why BFCache was blocked in production',
        },
        'The blocker list varies by browser and version. Firefox was the first browser to ship BFCache (Firefox 1.5, 2005). Safari has had it since the early WebKit days. Chrome shipped it for same-origin navigations in Chrome 86 (2020) and cross-origin in Chrome 92 (2021). Each browser has slightly different eligibility rules, so the only reliable way to confirm BFCache behavior is to test in each target browser.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'BFCache is correct because the browser controls both sides of the contract: the session history stack and the document lifecycle.',
        {
          type: 'table',
          headers: ['Property', 'What it guarantees', 'What breaks without it'],
          rows: [
            ['Exclusive ownership', 'Only one history entry is active at a time', 'Two pages share the same JS heap, corrupting each other'],
            ['Complete freeze', 'All JS execution stops: no timers, no microtasks, no event dispatch', 'Frozen page continues mutating state or consuming resources while hidden'],
            ['Atomic restore', 'The entire snapshot resumes together: DOM, heap, styles, scroll', 'Partial restore shows a half-built page or runs scripts against an incomplete DOM'],
            ['Event notification', 'pagehide fires before freeze, pageshow fires after restore', 'Application has no hook to release resources or revalidate state'],
            ['Persisted flag', 'Distinguishes BFCache restore from initial page load', 'Restore handler runs on first load, rebuilding the app unnecessarily'],
          ],
        },
        'The persisted flag is the key correctness tool for application code. A pageshow event fires on every page entry, including the initial load after a fresh HTTP response. Without the persisted flag, application code cannot distinguish "the page just loaded for the first time" from "the page just returned from BFCache after being frozen for 30 minutes." The initial load should run full startup. The BFCache restore should run a narrow revalidation pass.',
        {
          type: 'note',
          text: 'The pause-and-resume contract works because it separates state into two categories by volatility. Local UI state (scroll, form values, expanded panels) is safe to keep because it depends only on the user and the DOM, neither of which changed while the page was frozen. External state (auth, inventory, prices, permissions) is unsafe to keep because the server may have changed it during the freeze window. The application only needs to recheck the volatile half.',
        },
        'The freeze guarantee is stronger than it appears. While a page is in BFCache, it cannot execute setTimeout callbacks, resolve promises, handle MessagePort events, run requestAnimationFrame, fire MutationObserver callbacks, or receive push notifications. The page is truly inert. This is what makes the snapshot safe: nothing can mutate it between freeze and restore.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider an e-commerce product listing page with filters, infinite scroll, and a comparison drawer. The user has scrolled 4000 pixels, applied 3 filters, expanded a comparison of 2 products, and typed a note in the comparison drawer. They click a product to view its detail page.',
        {
          type: 'code',
          language: 'javascript',
          text: [
            '// Product listing page: BFCache-aware lifecycle',
            '',
            'const pollController = new AbortController();',
            '',
            '// Start polling for price updates every 30s',
            'function startPricePolling() {',
            '  const id = setInterval(async () => {',
            '    const prices = await fetch("/api/prices",',
            '      { signal: pollController.signal });',
            '    updatePriceDisplay(await prices.json());',
            '  }, 30000);',
            '  return id;',
            '}',
            '',
            'window.addEventListener("pagehide", (event) => {',
            '  if (event.persisted) {',
            '    // Page may enter BFCache. Pause, do not destroy.',
            '    pollController.abort();          // stop price polling',
            '    analytics.flush();               // send buffered events',
            '    // Do NOT clear filters, scroll, or comparison drawer.',
            '    // Do NOT close IndexedDB (close it or BFCache is blocked).',
            '    db.close();',
            '  }',
            '});',
            '',
            'window.addEventListener("pageshow", (event) => {',
            '  if (event.persisted) {',
            '    // Restored from BFCache. Narrow revalidation only.',
            '    refreshPrices();                 // prices may have changed',
            '    checkAuthStatus();               // session may have expired',
            '    reopenDatabase();                // reopen closed IndexedDB',
            '    startPricePolling();             // restart polling',
            '    analytics.track("bfcache_restore", {',
            '      frozenDuration: Date.now() - lastActiveTimestamp',
            '    });',
            '    // Scroll position: already restored by the browser.',
            '    // Filters: still in DOM state, untouched.',
            '    // Comparison drawer: still expanded with typed note.',
            '  }',
            '});',
          ].join('\n'),
          label: 'The restore handler is 10 lines, not 200. It repairs freshness without rebuilding the page.',
        },
        'When the user presses Back, the browser restores the frozen snapshot. The listing page appears instantly at scroll position 4000 with all 3 filters applied, the comparison drawer open, and the typed note intact. The restore handler runs in the background: prices refresh, auth is checked, polling resumes. The user sees the page they left, not a blank screen followed by a loading spinner.',
        'A checkout page needs more aggressive revalidation.',
        {
          type: 'code',
          language: 'javascript',
          text: [
            '// Checkout page: security-sensitive BFCache restore',
            '',
            'window.addEventListener("pageshow", async (event) => {',
            '  if (!event.persisted) return;',
            '',
            '  // Disable the pay button until revalidation completes',
            '  payButton.disabled = true;',
            '  statusBanner.textContent = "Refreshing checkout...";',
            '',
            '  try {',
            '    const [auth, cart, inventory] = await Promise.all([',
            '      fetch("/api/auth/check"),',
            '      fetch("/api/cart"),',
            '      fetch("/api/inventory/check", {',
            '        method: "POST",',
            '        body: JSON.stringify({ items: cartItems })',
            '      })',
            '    ]);',
            '',
            '    if (!auth.ok) return redirectToLogin();',
            '',
            '    const cartData = await cart.json();',
            '    if (cartData.version !== localCartVersion) {',
            '      updateCartDisplay(cartData);  // prices or items changed',
            '    }',
            '',
            '    const stock = await inventory.json();',
            '    if (stock.unavailable.length > 0) {',
            '      showOutOfStockWarning(stock.unavailable);',
            '    }',
            '',
            '    payButton.disabled = false;',
            '    statusBanner.textContent = "";',
            '  } catch (e) {',
            '    statusBanner.textContent = "Connection lost. Please refresh.";',
            '  }',
            '});',
          ].join('\n'),
          label: 'The checkout restore handler disables payment until auth, cart, and inventory are confirmed fresh.',
        },
        'The checkout page feels instant to the user -- the DOM appears immediately with all form fields intact. But the pay button stays disabled until three parallel checks confirm that the session is valid, the cart has not changed, and all items are still in stock. This is the BFCache contract at its sharpest: keep local UI state, distrust external truth.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Dimension', 'BFCache restore', 'Full reload'],
          rows: [
            ['Time to interactive', '10-100ms', '1,000-8,000ms on mobile'],
            ['Network requests', '0 (restore handler may issue revalidation fetches)', 'Full waterfall: HTML + CSS + JS + API calls'],
            ['JavaScript execution', 'Resume existing heap + restore handler only', 'Parse + compile + execute all scripts + framework boot'],
            ['DOM construction', 'None (restored from memory)', 'Full HTML parse + DOM build'],
            ['Layout and paint', 'Composite existing layers', 'Full layout tree + paint + composite'],
            ['State fidelity', 'Complete: scroll, forms, expanded UI, in-memory data', 'Partial at best: whatever the app serialized to URL/sessionStorage'],
          ],
        },
        'The browser pays the cost in memory. Each BFCache entry holds a complete JavaScript heap, DOM tree, and rendering state. A complex single-page app can consume 50-200 MB per cached entry. Browsers limit the number of cached entries (Chrome typically keeps 3-6 entries on desktop, 1-3 on mobile) and evict under memory pressure.',
        {
          type: 'note',
          text: 'Chrome Core Web Vitals data from the 2021 BFCache launch showed that enabling BFCache improved Largest Contentful Paint (LCP) by 22% and Cumulative Layout Shift (CLS) by 56% on back/forward navigations. These are not marginal improvements. They eliminate entire categories of work.',
        },
        'The application pays in lifecycle complexity. Code that assumed "load means fresh" and "unload means final" must shift to a pause-and-resume model. The restore handler must be correct -- revalidating too little exposes stale state, revalidating too much defeats the performance benefit. Teams also need to test the Back button as a product path, not just a browser control.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['Navigation pattern', 'Why BFCache matters here', 'Restore handler focus'],
          rows: [
            ['Search results <-> detail pages', 'Users click through many results; each Back must feel instant and preserve scroll position in a long list', 'Refresh ad placements, check session'],
            ['Inbox <-> message view', 'Users triage dozens of messages; rebuilding the inbox list on every Back destroys flow', 'Mark message as read in list, refresh unread count'],
            ['Documentation tabs <-> code examples', 'Users flip between reference and implementation; losing scroll position in a long API doc is disorienting', 'Minimal: maybe refresh a version badge'],
            ['Multi-step form wizard', 'Users press Back to correct earlier steps; losing form state forces re-entry', 'Re-check CSRF token validity, refresh any server-derived options'],
            ['Dashboard <-> drill-down charts', 'Analysts explore data hierarchically; each level has expensive client-side computations', 'Refresh real-time metrics, recheck data permissions'],
            ['Social feed <-> post detail', 'Users scroll a long feed, tap a post, then return; losing feed position means re-scrolling past hundreds of items', 'Refresh engagement counts, check for new content'],
          ],
        },
        'The common pattern: high-frequency back-and-forth navigation where the user expects to return to exactly where they left off. The more state lives in the client (scroll position, filter selections, expanded UI, in-memory caches), the more painful a full reload becomes and the more valuable BFCache is.',
        {
          type: 'quote',
          text: 'When we enabled bfcache on all same-site navigations in Chrome 96, we observed a 3.4% improvement in Largest Contentful Paint across all page loads. This is because ~10% of navigations are back/forward navigations, and those navigations went from multi-second loads to near-instant restores.',
          attribution: 'Chromium blog -- "Back/forward cache on all same-site navigations," 2021',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The most dangerous failure is treating a restored page as trustworthy. A page frozen 20 minutes ago may display a valid auth session that the server has since revoked, show inventory that is now out of stock, present a price that has changed, or offer a payment button for a cart that another tab modified.',
        {
          type: 'table',
          headers: ['Failure mode', 'What happens', 'Consequence'],
          rows: [
            ['No restore handler', 'Page resumes with 20-minute-old data displayed as current', 'User acts on stale prices, permissions, or inventory'],
            ['Overly aggressive restore handler', 'Handler rebuilds the entire app on BFCache restore', 'User sees a loading spinner; BFCache provides no benefit'],
            ['unload listener blocks BFCache', 'Browser falls back to full reload on every Back navigation', 'Users experience 3-8 second delays that BFCache would have eliminated'],
            ['Open IndexedDB blocks BFCache', 'Page is ineligible because the database connection stays open', 'Fix: close DB on pagehide, reopen on pageshow'],
            ['Stale CSRF token after restore', 'Restore handler does not refresh the token; next form submit fails with 403', 'User loses work; retry may not help if the form state depends on the old token'],
            ['Analytics double-counting', 'Restore handler does not distinguish BFCache restore from initial load', 'Page views are inflated; A/B test results are skewed'],
          ],
        },
        {
          type: 'note',
          text: 'Chrome removed unload event support from cross-origin iframes in Chrome 117 (2023) as a Deprecation Trial, making it easier for pages to become BFCache-eligible. The long-term trajectory is clear: browsers treat unload as a legacy API. Pages that depend on it will increasingly miss performance optimizations.',
        },
        'BFCache has hard limits that no application code can overcome. It is memory-backed, so mobile devices with limited RAM cache fewer entries and evict more aggressively. It is browser-controlled, so the application cannot force a page into BFCache or guarantee it will still be there when the user returns. It does not replace HTTP caching, service workers, or client-side data caching -- it only accelerates history traversal for pages the browser chose to keep alive.',
        'Cross-origin pages add further complications. A cross-origin BFCache restore must handle permission policies, COOP/COEP headers, and cross-origin isolation constraints. Pages served with Cross-Origin-Opener-Policy headers that differ from the page being navigated to may prevent BFCache eligibility entirely.',
      ],
    },
    {
      heading: 'BFCache versus adjacent caching mechanisms',
      paragraphs: [
        {
          type: 'table',
          headers: ['Mechanism', 'What it caches', 'Scope', 'State fidelity'],
          rows: [
            ['BFCache', 'Live document: DOM + JS heap + rendering state', 'Session history traversal only (Back/Forward)', 'Complete: scroll, forms, expanded UI, closures, canvas'],
            ['HTTP cache', 'Response bytes (HTML, CSS, JS, images)', 'Any navigation or subresource fetch', 'None: page must be parsed and reconstructed from scratch'],
            ['Service Worker cache', 'Request/response pairs intercepted by the worker', 'Any fetch the worker intercepts', 'None: responses still require full page construction'],
            ['Prerender / Speculation Rules', 'Fully rendered page created speculatively before navigation', 'Forward navigation to predicted URLs', 'Complete but speculative: may be discarded if prediction was wrong'],
            ['Paint Holding', 'Last rendered frame shown during navigation', 'Brief transition between pages', 'Visual only: no JS heap, no interactivity'],
          ],
        },
        'BFCache is the only mechanism that preserves JavaScript heap state. Every other caching layer operates on response bytes or render output. This is why BFCache can restore a page in 10-100ms while an HTTP cache hit still requires 200-2000ms of parsing, script execution, and framework hydration.',
        'The closest sibling is Prerender (Speculation Rules API), which also creates a live document. The difference is directionality: Prerender creates pages speculatively for forward navigation, while BFCache preserves pages retroactively for backward navigation. Both keep a complete document in memory. Both pay a memory cost per cached entry.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Primary guide: Philip Walton. "Back/forward cache." web.dev, 2021. https://web.dev/articles/bfcache',
            'Page Lifecycle API: Chrome team. "Page Lifecycle API." https://developer.chrome.com/docs/web-platform/page-lifecycle-api',
            'MDN pagehide: https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event',
            'MDN pageshow: https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event',
            'NotRestoredReasons API: https://developer.chrome.com/docs/web-platform/not-restored-reasons',
            'Page Lifecycle spec proposal: Nickel, Patel, Walton. "Page Lifecycle." WICG, 2018.',
          ],
        },
        {
          type: 'table',
          headers: ['Role', 'Topic', 'Why'],
          rows: [
            ['Prerequisite', 'History API Session Stack', 'BFCache entries are attached to session history entries; understanding the history stack clarifies what "navigate back" means at the browser level'],
            ['Prerequisite', 'Browser Rendering Pipeline', 'BFCache skips the entire rendering pipeline on restore; knowing what it skips shows why the speedup is so large'],
            ['Sibling', 'Service Workers and Offline-First', 'Service workers intercept fetches but do not preserve JS state; BFCache preserves state but only for history traversal'],
            ['Sibling', 'HTTP Cache ETag Revalidation', 'HTTP cache saves network time by caching response bytes; BFCache saves everything by caching the live document'],
            ['Extension', 'Cross-Origin Isolation COOP COEP CORP', 'Cross-origin headers affect BFCache eligibility; COOP mismatches can block cross-origin BFCache entirely'],
            ['Extension', 'Web Locks API Lock Manager', 'Held Web Locks block BFCache; the lock lifecycle must coordinate with the page lifecycle'],
            ['Application', 'AbortController Cancellation Graph', 'AbortController is the tool for cancelling in-flight fetches on pagehide so they do not block BFCache eligibility'],
            ['Contrast', 'Prerender Speculation Rules', 'Prerender creates speculative live documents for forward navigation; BFCache preserves real documents for backward navigation'],
          ],
        },
      ],
    },
  ],
};
