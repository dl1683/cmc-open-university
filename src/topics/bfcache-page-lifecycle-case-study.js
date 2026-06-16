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
      heading: 'What it is',
      paragraphs: [
        'The back/forward cache can keep a live page snapshot in memory when the user navigates away. On Back or Forward, the browser can restore that snapshot instead of loading, parsing, executing, and rendering from scratch.',
        'web.dev explains BFCache behavior and how pagehide/pageshow persisted flags reveal intended cache and restore paths: https://web.dev/articles/bfcache. MDN documents pagehide and the persisted property: https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event.',
      ],
    },
    {
      heading: 'Core data structure',
      paragraphs: [
        'A BFCache entry can preserve the document, DOM, JavaScript heap, scroll position, form state, and rendering state. It is tied to session history traversal, so it sits conceptually beside the History API stack rather than beside HTTP Cache-Control.',
        'The lifecycle data structure is a suspended page. Timers, tasks, and resource use are paused or constrained while hidden; pageshow with persisted true is the app-visible signal that a restore happened.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A product details page has expensive rendering and a reviews list. The user clicks into a review author page, then presses Back. If eligible, the product page returns instantly with scroll, expanded sections, and form state intact. On pageshow persisted, the app revalidates price and inventory.',
        'A checkout page can still use BFCache carefully. It avoids unload handlers, pauses polling on pagehide, releases transient resources, and on restore rechecks cart/auth state before enabling payment actions.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'BFCache is not the HTTP cache. Cache-Control for network responses and BFCache eligibility for live documents are separate ideas. A BFCache restore can show old in-memory state even when network data would now differ, so apps must revalidate volatile state on pageshow persisted.',
        'Do not use unload as a general cleanup hook. It can hurt BFCache eligibility and is unreliable on mobile. Use pagehide, pageshow, visibilitychange, and explicit resource lifecycle code.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: web.dev BFCache guide at https://web.dev/articles/bfcache, Chrome Page Lifecycle API guide at https://developer.chrome.com/docs/web-platform/page-lifecycle-api, MDN pagehide at https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event, and MDN pageshow at https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event. Study History API Session Stack, URL Parser & Origin Tuple, Service Workers & Offline-First, Web Locks API Lock Manager, AbortController Cancellation Graph, HTTP Cache ETag Revalidation, and Browser Rendering next.',
      ],
    },
  ],
};
