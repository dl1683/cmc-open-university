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
      heading: 'What it is',
      paragraphs: [
        'Resource hints are declarations that let a page or server move network work earlier in the load timeline. preconnect warms an origin. preload fetches a specific resource for the current navigation. dns-prefetch does only name resolution. prefetch is speculative work for a likely future navigation.',
        'The data structure is a dependency graph plus a priority queue. The browser schedules sockets and requests under constraints: connection limits, bandwidth, request destination, credentials, cache reuse, and render-blocking work.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'preconnect creates the connection path before the browser naturally discovers a resource from that origin. It is useful for a small number of high-confidence third-party origins, such as an image CDN or font host.',
        'preload starts the actual fetch and places the response where the later consumer can reuse it. That reuse depends on matching the eventual request shape: as value, CORS mode, credentials mode, media, and type. A mismatch can produce duplicate downloads.',
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
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not use preload as a bulk asset manifest. Do not preconnect to many origins just because they appear somewhere on the page. Do not preload fonts without the correct cross-origin behavior. Do not leave stale hints after a design change; a wrong hint can slow the page by competing with the true critical path.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN rel=preload at https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel/preload, MDN rel=preconnect at https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel/preconnect, W3C Resource Hints at https://www.w3.org/TR/2023/DISC-resource-hints-20230314/, WHATWG HTML links at https://html.spec.whatwg.org/multipage/links.html, and web.dev Resource Hints at https://web.dev/learn/performance/resource-hints. Study CDN Request Flow, Browser Rendering, Service Workers & Offline-First, HTTP Cache ETag Revalidation, HTTP/3 over QUIC, HTTP/3 Priority Urgency Scheduler, Cache Invalidation & Versioning, and Subresource Integrity Hash Manifest next.',
      ],
    },
  ],
};
