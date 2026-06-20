// Browser resource hints: preconnect warms an origin, preload fetches a known
// critical resource, and both are only wins when they match the real critical path.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'resource-hints-preload-preconnect-case-study',
  title: 'Resource Hints: Preload & Preconnect',
  category: 'Systems',
  summary: 'How preload, preconnect, dns-prefetch, prefetch, fetchpriority, and 103 Early Hints reshape a page-load dependency graph.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['critical path', 'hint budget'], defaultValue: 'critical path' },
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

function loadGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'html', label: 'HTML', x: 0.8, y: 4.8, note: notes.html ?? 'parser' },
      { id: 'scan', label: 'scanner', x: 2.4, y: 6.0, note: notes.scan ?? 'finds links' },
      { id: 'conn', label: 'origin', x: 4.0, y: 4.8, note: notes.conn ?? 'DNS/TLS' },
      { id: 'cache', label: 'cache', x: 5.6, y: 4.8, note: notes.cache ?? 'memory/disk' },
      { id: 'css', label: 'CSS', x: 7.2, y: 6.0, note: notes.css ?? 'blocks render' },
      { id: 'font', label: 'font', x: 7.2, y: 4.0, note: notes.font ?? 'text' },
      { id: 'lcp', label: 'hero', x: 8.8, y: 5.0, note: notes.lcp ?? 'LCP image' },
      { id: 'js', label: 'JS', x: 4.8, y: 2.5, note: notes.js ?? 'discovers late' },
    ],
    edges: [
      { id: 'e-html-scan', from: 'html', to: 'scan', weight: '' },
      { id: 'e-scan-conn', from: 'scan', to: 'conn', weight: '' },
      { id: 'e-conn-cache', from: 'conn', to: 'cache', weight: '' },
      { id: 'e-cache-css', from: 'cache', to: 'css', weight: '' },
      { id: 'e-cache-font', from: 'cache', to: 'font', weight: '' },
      { id: 'e-cache-lcp', from: 'cache', to: 'lcp', weight: '' },
      { id: 'e-html-js', from: 'html', to: 'js', weight: '' },
      { id: 'e-js-lcp', from: 'js', to: 'lcp', weight: '' },
    ],
  }, { title });
}

function* criticalPath() {
  yield {
    state: loadGraph('Without hints, some resources are discovered late', { js: 'lazy route', lcp: 'late image' }),
    highlight: { active: ['html', 'js', 'lcp', 'e-html-js', 'e-js-lcp'], compare: ['scan'] },
    explanation: 'Browsers already scan HTML aggressively, but JavaScript, CSS imports, fonts, and hero images can still be discovered late. A resource hint is a small edge you add to the load graph before the parser naturally reaches that edge.',
    invariant: 'A hint is useful only when it moves a real dependency earlier.',
  };

  yield {
    state: loadGraph('preconnect warms the origin before the request', { scan: 'preconnect', conn: 'warm socket', lcp: 'later fetch' }),
    highlight: { active: ['scan', 'conn', 'e-scan-conn'], found: ['lcp'] },
    explanation: 'preconnect does not fetch a file. It spends DNS, TCP, and TLS work early so a later request to the same origin can start sending HTTP bytes sooner.',
  };

  yield {
    state: loadGraph('preload fetches a known current-page resource', { scan: 'preload', conn: 'request now', cache: 'response', lcp: 'ready early' }),
    highlight: { active: ['scan', 'conn', 'cache', 'lcp', 'e-scan-conn', 'e-conn-cache', 'e-cache-lcp'], removed: ['js', 'e-js-lcp'] },
    explanation: 'preload is stronger: it starts the actual fetch before the resource would otherwise be discovered. The later consumer should reuse the same cache entry rather than issue a second request.',
  };

  yield {
    state: labelMatrix(
      'Request shape matters',
      [
        { id: 'image', label: 'image' },
        { id: 'script', label: 'script' },
        { id: 'font', label: 'font' },
        { id: 'fetch', label: 'fetch' },
      ],
      [
        { id: 'as', label: 'as/type' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['as=image', 'wrong size'],
        ['as=script', 'dup load'],
        ['as=font', 'CORS'],
        ['as=fetch', 'creds'],
      ],
    ),
    highlight: { found: ['image:as', 'font:as'], compare: ['script:risk', 'fetch:risk'] },
    explanation: 'A preload must match the eventual request: destination, CORS mode, credentials, media query, and sometimes type. A mismatch can waste bandwidth or create a duplicate download.',
  };

  yield {
    state: loadGraph('A good hint shortens LCP without starving CSS', { css: 'render path', font: 'ready', lcp: 'ready', js: 'not urgent' }),
    highlight: { found: ['css', 'font', 'lcp', 'cache'], active: ['e-cache-css', 'e-cache-font', 'e-cache-lcp'], removed: ['js'] },
    explanation: 'The complete page-load case study is a product page: preload the hero image and critical font, preconnect to the image CDN, leave below-the-fold work alone, and verify that CSS is not delayed. Hints are scheduling input, not a magic speed switch.',
  };
}

function* hintBudget() {
  yield {
    state: labelMatrix(
      'Hint meanings',
      [
        { id: 'dns', label: 'dns' },
        { id: 'preconn', label: 'preconn' },
        { id: 'preload', label: 'preload' },
        { id: 'prefetch', label: 'prefetch' },
      ],
      [
        { id: 'starts', label: 'starts' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['DNS only', 'tiny win'],
        ['handshake', 'idle socket'],
        ['fetch now', 'unused file'],
        ['next page', 'privacy'],
      ],
    ),
    highlight: { active: ['preconn:starts', 'preload:starts'], compare: ['prefetch:risk'] },
    explanation: 'dns-prefetch, preconnect, preload, and prefetch do different work. Confusing them creates either no benefit or a new bottleneck.',
    invariant: 'Every hint spends a scarce browser resource: sockets, priority, bandwidth, cache, or privacy budget.',
  };

  yield {
    state: loadGraph('Too many hints crowd out the real critical path', { scan: '12 hints', conn: 'busy', css: 'late', lcp: 'contends', js: 'also fetches' }),
    highlight: { removed: ['css', 'lcp'], active: ['scan', 'conn', 'cache'], compare: ['js'] },
    explanation: 'A preload list can become self-sabotage. If a page preloads every route chunk and image, the important CSS, font, or LCP image competes with speculative work.',
  };

  yield {
    state: labelMatrix(
      'Use it when',
      [
        { id: 'hero', label: 'hero' },
        { id: 'font', label: 'font' },
        { id: 'third', label: '3rd origin' },
        { id: 'next', label: 'next route' },
        { id: 'api', label: 'API' },
      ],
      [
        { id: 'hint', label: 'hint' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['preload', 'measure'],
        ['preload', 'CORS'],
        ['preconn', 'few only'],
        ['prefetch', 'idle'],
        ['usually no', 'dynamic'],
      ],
    ),
    highlight: { found: ['hero:hint', 'font:hint', 'third:hint'], removed: ['api:hint'] },
    explanation: 'The practical table is conservative: hint only the highest-confidence resources. Measure real waterfalls before and after, especially on slow networks.',
  };

  yield {
    state: loadGraph('103 Early Hints can arrive before final HTML', { html: 'final later', scan: 'Link header', conn: 'started', cache: 'warming', css: 'early CSS' }),
    highlight: { active: ['scan', 'conn', 'cache', 'css', 'e-scan-conn', 'e-conn-cache', 'e-cache-css'], compare: ['html'] },
    explanation: 'A server or CDN can send Link headers in a 103 Early Hints response, letting the browser start preconnect or preload work while the final response is still being generated.',
  };

  yield {
    state: labelMatrix(
      'Production review',
      [
        { id: 'lcp', label: 'LCP' },
        { id: 'css', label: 'CSS' },
        { id: 'font', label: 'font' },
        { id: 'cdn', label: 'CDN' },
        { id: 'route', label: 'route' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'decision', label: 'decision' },
      ],
      [
        ['late start', 'preload'],
        ['blocked', 'keep first'],
        ['swap late', 'preload'],
        ['TLS cost', 'preconn'],
        ['maybe used', 'prefetch'],
      ],
    ),
    highlight: { found: ['lcp:decision', 'font:decision', 'cdn:decision'], compare: ['route:decision'] },
    explanation: 'A review should tie each hint to a visible waterfall symptom. If there is no symptom, remove the hint. The fastest hint is the one that does not spend bandwidth on the wrong thing.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'critical path') yield* criticalPath();
  else if (view === 'hint budget') yield* hintBudget();
  else throw new InputError('Pick a resource-hints view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Resource hints exist because browsers discover some critical work too late. HTML parsing is fast, but JavaScript-discovered images, CSS imports, fonts, third-party origins, and server-generated HTML can delay the request that actually determines first render or LCP.',
        'The problem is scheduling, not decoration. A hint tells the browser that part of the load graph is important before the normal discovery path would prove it.',
        {type:'callout', text:'Resource hints only help when they move a real critical-path edge earlier without crowding out more important requests.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to let the parser and preload scanner do everything. That is often correct because browsers already prioritize CSS, scripts, images, fonts, and connections better than most application code can.',
        'The wall appears when the real critical dependency is hidden behind JavaScript, CSS, late HTML, or a remote origin handshake. The browser cannot schedule what it has not discovered.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A page load is a dependency graph plus a priority queue. preconnect adds an early edge to an origin handshake. preload adds an early fetch for a known current-page resource. dns-prefetch is weaker and does only name resolution. prefetch is speculative work for a likely future page.',
        'The insight is to move only the edges that are both critical and high-confidence. Every hint spends scarce resources: socket slots, bandwidth, request priority, cache space, and sometimes privacy budget.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        "In the critical-path view, watch discovery time. A resource hint is useful only when it moves a real critical request earlier than the browser would have found it by parsing HTML, CSS, or JavaScript normally.",
        "In the hint-budget view, read every hinted request as competition. A preload can help the LCP image, but too many preloads can delay CSS or more important images. A preconnect can hide handshake latency, but an unused preconnect spends sockets and CPU for no visible result.",
        "The marks are not proof that a page is optimized. They show a bet: this origin or resource will matter soon enough that early work is worth the contention. The audit question is whether the eventual waterfall proves the bet was right.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A product page renders its hero image only after a client-side bundle parses product data. The normal browser path discovers HTML, CSS, JavaScript, then eventually the hero URL. If the hero image is consistently the LCP element, a matching preload can start the fetch before JavaScript discovers it. If the image sits on a CDN with a cold connection, a preconnect can also start DNS, TCP, TLS, and protocol setup early.',
        'Now change the example: the page preloads six carousel images, two route chunks, a font variant not used above the fold, and an optional third-party origin. The HTML looks performance-conscious, but the network waterfall can become worse. The critical CSS or real LCP image may compete with speculative work. Resource hints are a scalpel, not an asset manifest.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'preconnect warms DNS, TCP, TLS, and protocol setup before the resource request arrives. It does not fetch a file. preload starts a fetch now and stores the response for the later consumer, but reuse depends on matching request shape: destination, CORS mode, credentials, media, type, and sometimes image selection.',
        '103 Early Hints can send Link headers before the final HTML response is ready, letting the browser begin connection or preload work while the server is still generating the page.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'A useful hint works because it shortens a real critical path without displacing more important work. If the hinted resource is later needed with the same request shape, the browser can reuse the warmed connection or fetched response.',
        'The correctness boundary is that hints should not change the page result. They change timing and priority. If a hint points at the wrong file, wrong credentials mode, or wrong media condition, it can create duplicate work instead of a faster load.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The cost is contention. Too many preloads can delay render-blocking CSS, compete with the LCP image, or crowd out user-visible work. Too many preconnects leave idle sockets and spend handshake work that may never be used.',
        'When a hint is right, the user sees lower latency for the critical resource. When it is wrong, the waterfall gets busier and slower even though the HTML looks more "optimized."',
        'The browser also has its own scheduler. Hints influence that scheduler, but they do not override physics. Bandwidth, socket limits, server priorities, cache state, CORS shape, and request destination still determine whether the hinted work is reused or duplicated.',
      ],
    },
    {
      heading: 'Measurement discipline',
      paragraphs: [
        'Add hints only after looking at real waterfalls or field data. Identify the LCP element, render-blocking resources, late-discovered origins, and cache behavior. Then add the smallest hint that moves the bottleneck earlier. Re-measure on slow networks and mobile devices because contention is easiest to miss on a fast desktop connection.',
        'A good review asks: was the hinted resource actually needed on this page, was it reused by the eventual consumer, did it improve the target metric, and did it harm other resources? If the answer is unclear, the hint is probably not ready to ship.',
      ],
    },
    {
      heading: 'Choosing the hint',
      paragraphs: [
        'Use `preload` when the exact current-page resource is known and important. Use `preconnect` when the origin is definitely needed but the exact resource may be discovered later. Use `dns-prefetch` when only name resolution is worth warming. Use `prefetch` for likely future navigations, not current render-critical work.',
        'This choice matters because each hint has a different failure mode. The wrong preload can duplicate a fetch. The wrong preconnect wastes a socket. The wrong prefetch spends bandwidth on a path the user never takes.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Resource hints win for high-confidence hero images, critical fonts, render-critical CSS discovered late, a small number of third-party origins, and CDN origins that are definitely used on the current page.',
        'They also help server-side rendering paths where 103 Early Hints can overlap backend generation with browser connection setup.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Hints fail as bulk asset manifests. They also fail when the hinted request does not match the eventual request, when the resource is below the fold, when the origin is optional, or when the page changes but stale hints remain.',
        'prefetch has an extra boundary: it predicts future navigation. Wrong predictions spend bandwidth and may reveal browsing intent.',
        'preload has a stricter footgun: request mismatch. If the final resource uses a different `as`, CORS mode, credentials mode, media condition, or selected image candidate, the browser may fetch twice. That failure mode is common enough that every preload should be checked against the actual request it is meant to satisfy.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A product page renders a hero image from a CDN, a brand font, and CSS. The first waterfall shows the hero image discovered by late JavaScript. The fix is not to preload every asset. The fix is to preload the hero image and critical font, preconnect to the CDN, keep CSS first, and leave route chunks or below-the-fold media alone unless measurements prove they are next-navigation wins.',
        'This links directly to CDN Request Flow, HTTP/3 over QUIC, Service Workers & Offline-First, and Browser Rendering. Resource hints tune the browser side of the same edge-cache and transport path.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: MDN rel=preload at https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel/preload, MDN rel=preconnect at https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel/preconnect, W3C Resource Hints at https://www.w3.org/TR/2023/DISC-resource-hints-20230314/, WHATWG HTML links at https://html.spec.whatwg.org/multipage/links.html, and web.dev Resource Hints at https://web.dev/learn/performance/resource-hints. Study CDN Request Flow, Browser Rendering, Service Workers & Offline-First, HTTP Cache ETag Revalidation, HTTP/3 over QUIC, HTTP/3 Priority Urgency Scheduler, Cache Invalidation & Versioning, and Subresource Integrity Hash Manifest next.',
      ],
    },
  ],
};
