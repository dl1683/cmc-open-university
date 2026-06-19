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
        "Read the animation as the execution trace for BFCache Page Lifecycle. How back/forward cache stores live page snapshots, fires pagehide/pageshow with persisted flags, restores state instantly, and rejects unsafe pages..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Back and Forward are normal navigation paths, not edge cases. People bounce between search results and product pages, documentation pages and examples, inboxes and messages, dashboards and detail views, forms and confirmation screens. A full reload on Back repeats work the browser may have done seconds ago: network requests, parsing, script startup, layout, scroll restoration, and app boot.',
        'Back/forward cache exists to make that return feel instant. Instead of destroying the old page and rebuilding it later, the browser can keep a frozen live snapshot attached to the session history entry. That snapshot can include the DOM, JavaScript heap, scroll position, form values, rendering state, and local UI context.',
        'The hard part is safety. A page is not just pixels. It may hold locks, sockets, timers, auth state, payment readiness, old API data, and resources that should not stay active while hidden. BFCache is useful only if the browser can pause a page without letting it keep running arbitrary work, then resume it without letting stale external truth masquerade as fresh truth.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The obvious implementation is normal teardown. When the user leaves page A, destroy it. When the user presses Back, request the URL again, recreate the document, run the scripts, rebuild app state, and try to restore scroll. This is simple because every return begins as a fresh load.',
        'The wall is user-visible latency and incomplete restoration. Recreating the page can lose expanded panels, in-memory form edits, client-side caches, pending UI context, and exact scroll position. Application-level state restoration can help, but it still has to rebuild the page before it can restore anything.',
        'The other wall is that teardown-based code often depends on `unload`. That event is hostile to instant restoration because it assumes the page is ending forever. BFCache requires a different mental model: leaving a history entry may be a pause, not a death.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that a session history entry can hold a suspended live document. A BFCache hit is not an HTTP cache hit. It does not fetch a response from disk cache and replay page construction. It resumes the exact frozen document that was kept in memory.',
        'The invariant for application code is simple: preserve stable local UI state, recheck volatile external state. Scroll position, typed form text, selected tabs, expanded panels, and client-side render state are usually good snapshot state. Auth, inventory, permissions, WebSocket freshness, locks, and payment readiness must be revalidated or reacquired after restore.',
        '`pagehide` and `pageshow` are the app-visible lifecycle edges. `pagehide` means the page is leaving the active history entry. `pageshow` with `event.persisted` true means the page returned from BFCache and should run restore work without rebuilding the whole app.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The restore path view separates the active page from the frozen page. Page A moves through `pagehide`, then freeze, then the BF node while page B becomes active. That split is the central idea: page A can be suspended while another document runs, then return through `pageshow` and resume.',
        'The restore tasks table keeps the app work narrow. Data may need a freshness check. A socket may need reopening. Analytics may need a navigation event. The UI snapshot should usually remain intact. The point is not to rerun application startup; the point is to repair the pieces that depend on time or external systems.',
        'The eligibility view shows why some pages fall back to reload. A blocked cache path means the browser decided the live page was not safe or practical to freeze. A successful path means teardown became resumable: release or pause on `pagehide`, freeze safely, then reacquire or recheck on `pageshow`.',
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        'On navigation away, the browser fires `pagehide`. If the document is eligible and the browser has enough resources, it can freeze the page and attach the snapshot to the session history entry. Timers stop running, queued work is suspended or constrained, and the next page becomes active.',
        'On Back or Forward, the browser can restore the snapshot and fire `pageshow`. If `event.persisted` is true, the app came from BFCache. The restore handler should be narrow: revalidate volatile data, reopen transient channels if needed, update analytics, and leave stable UI state alone.',
        'A miss still has to work. The browser can decline to cache a page, evict it under memory pressure, or apply browser-specific eligibility rules. Correct code treats BFCache as an optimization. It handles both paths: fast resume when the snapshot exists, normal load when it does not.',
      ],
    },
    {
      heading: 'Eligibility and Blockers',
      paragraphs: [
        'Eligibility is about whether a live page can be frozen and later resumed without violating browser rules, user safety, or resource constraints. Pages that depend on final `unload` cleanup, hold resources that cannot be safely frozen, or carry sensitive state with strict cache policy may be excluded.',
        '`unload` is the most common conceptual problem because it says, "the page is over." BFCache-friendly code says, "the page may return." Use `pagehide` for leave work and `pageshow` for return work. Use `beforeunload` only for the narrow case where a user has unsaved work and should confirm leaving.',
        'Other blockers depend on browser implementation and page behavior: active locks, resource use, cache-control policy, open channels, cross-origin constraints, memory pressure, and features that cannot be safely suspended. The exact list changes over time, so apps should test in target browsers rather than assume eligibility.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'BFCache works because the browser owns both the session history stack and the document lifecycle. It can keep a document snapshot in memory, stop hidden work from running normally, associate the snapshot with one history entry, and restore that snapshot only when the matching entry becomes active again.',
        'The page works because it accepts the pause-and-resume contract. Stable local state remains in the snapshot. Volatile state gets a restore check. That separation avoids the two bad extremes: rebuilding everything on every Back navigation, or trusting an old page as if no time had passed.',
        'The `persisted` flag matters because a `pageshow` event can happen on a normal load too. Restore work should distinguish a BFCache return from initial construction. Initial construction builds the page. BFCache restore repairs freshness, resource connections, metrics, and security-sensitive decisions.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A user scrolls through a product list, applies filters, expands a comparison drawer, opens a product page, then presses Back. With a BFCache hit, the list returns with the same DOM, filters, expanded drawer, form state, and scroll position. The app does not rebuild the list before the user can continue browsing.',
        'A checkout flow needs more care. The checkout page pauses polling on `pagehide`, avoids `unload`, releases resources that cannot remain open, and stores no assumption that payment is still safe. On `pageshow` with `persisted` true, it rechecks auth, cart contents, price, inventory, and payment eligibility before enabling the pay button.',
        'A documentation page is less sensitive. It may only record an analytics event and refresh stale badge counts. The same lifecycle model works because the restore handler is proportional to risk. Static reading state can be kept. Business facts and security decisions get checked.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The browser pays memory to keep a live snapshot. Under pressure it may evict entries, decline to cache a page, or keep only a small number of history entries. The application cannot demand a BFCache hit. It can only avoid common blockers and behave correctly when a hit occurs.',
        'The application pays lifecycle complexity. Code that assumed `load` means fresh page and `unload` means final cleanup has to move toward resumable `pagehide` and `pageshow` handling. Teams also need tests that cover Back and Forward traversal, not only first load and link clicks.',
        'The payoff is large because a hit avoids network, parse, app startup, layout, render, and most state reconstruction. It is one of the rare web performance optimizations that can remove entire phases of work instead of shaving milliseconds from one phase.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The common failure is treating a restored page as freshly loaded. A restored page can show old in-memory state until the app checks external truth. That is harmless for a collapsed accordion and dangerous for payment, auth, permissions, or security-sensitive decisions.',
        'The opposite failure is rebuilding too much on restore. If a `pageshow` handler tears down and recreates the whole app, it defeats the user benefit. A good restore handler is small, specific, and tied to volatility: refresh what can become stale, leave local interaction state alone.',
        'BFCache also has hard limits. It is memory-backed, browser-controlled, and policy-constrained. It does not replace HTTP caching, service workers, app-level data caching, or normal cold-load performance work. It makes history traversal fast when the browser can safely preserve the document.',
      ],
    },
    {
      heading: 'How it works (3)',
      paragraphs: [
        'Use BFCache-aware lifecycle code where return navigation matters: search results, catalogs, documentation, long forms, multi-step flows, dashboards, inboxes, and read-heavy applications. The user expectation is not just speed; it is returning to the same place with the same local context.',
        'Prefer `pagehide` over `unload`. Pause polling, release or mark transient resources, and avoid destructive cleanup that assumes the page will never return. On `pageshow` with `persisted` true, revalidate volatile data, reconnect channels that were closed, refresh auth-sensitive decisions, and send navigation analytics without rerunning full startup.',
        'Test this like a product path. Navigate from the page, press Back, inspect whether a BFCache restore happened, and verify that stale data checks run. Test sensitive flows after auth changes, cart changes, permission changes, and network loss. A page that feels instant but enables a stale action is not correct.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: web.dev BFCache guide at https://web.dev/articles/bfcache, Chrome Page Lifecycle API guide at https://developer.chrome.com/docs/web-platform/page-lifecycle-api, MDN pagehide at https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event, and MDN pageshow at https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event. Study History API Session Stack, URL Parser & Origin Tuple, Service Workers & Offline-First, Web Locks API Lock Manager, AbortController Cancellation Graph, HTTP Cache ETag Revalidation, and Browser Rendering next.',
      ],
    },
      {
      heading: 'The obvious approach',
      paragraphs: [
        "Name the reasonable first attempt and why teams reach for it.",
        "Then show the exact place that approach stops scaling or starts breaking.",
        "Treat this section as contrast, not a rejection.",
      ],
    },

    {
      heading: 'Real-world uses',
      paragraphs: [
        "Show where this approach appears in products, libraries, or service designs.",
        "Tie each use case to a workload shape, not a brand name.",
        "The learner should know exactly when this pattern should be chosen next.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why BFCache Page Lifecycle moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};
