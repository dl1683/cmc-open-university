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
    { heading: 'How to read the animation', paragraphs: [
      'Read the graph as a page-load dependency graph. Active nodes are the work the browser is doing now, found nodes are work made ready early, removed nodes are late discoveries avoided by the hint, and compare nodes are the request or resource that pays the contention cost.',
      'A resource hint is safe only when it moves a dependency that the page really needs. The inference rule is simple: if the later consumer reuses the same connection or cached response, the hint shortened the critical path; if it does not, the hint spent budget on the wrong edge.',
    ] },
    { heading: 'Why this exists', paragraphs: [
      'Resource hints exist because browsers cannot schedule resources before they discover them. The preload scanner can find many links in HTML, but it cannot see a hero image created by JavaScript, a font referenced deep in CSS, or an origin needed by a late API route.',
      'A resource hint is a small scheduling instruction. preconnect starts DNS, TCP, TLS, and protocol setup for an origin, while preload starts a current-page fetch for a known resource. The goal is lower user-visible latency, usually Largest Contentful Paint, not a longer list of clever tags.',
      {type:'callout', text:'Resource hints only help when they move a real critical-path edge earlier without crowding out more important requests.'},
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is to let the browser discover and prioritize everything on its own. That is often right because modern browsers already have a parser, a preload scanner, a cache, per-request priorities, and transport limits.',
      'The approach breaks when the important resource is hidden behind work the browser has not reached. A hero image discovered after a JavaScript bundle executes can start hundreds of milliseconds later than the CSS that frames it, even though the user sees the image as the main content.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is not lack of syntax. It is contention inside a scarce scheduler. Browsers have limited connection slots, bandwidth, cache space, CPU for handshakes, and priority budget, so every hint can delay something else.',
      'A wrong preload can be worse than no preload. If the final request uses a different as value, CORS mode, credentials mode, media condition, or image candidate, the browser may download twice. If a page preloads ten nice-to-have files, render-blocking CSS can lose the race.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Treat the page as a graph of dependencies and treat hints as early edges in that graph. A good hint moves one high-confidence edge earlier; a bad hint creates a new edge that competes with the real critical path.',
      'preconnect is weaker than preload because it only warms an origin. preload is stronger because it fetches bytes now, so it needs a stricter match with the eventual request. prefetch is different again: it speculates about a future navigation rather than the current render.',
    ] },
    { heading: 'How it works', paragraphs: [
      'preconnect asks the browser to prepare an origin before a request exists. That preparation can cover DNS lookup, TCP connection, TLS handshake, and HTTP negotiation, so the later request can send bytes sooner.',
      'preload asks the browser to fetch a specific current-page resource early and place the response in the cache for the later consumer. Reuse depends on matching destination, type, CORS, credentials, media, and selected URL. A 103 Early Hints response can send the same Link information before the final HTML is ready.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'The correctness argument is about equivalence of the later request. If the hinted work is the same work the browser would have done later, then moving it earlier changes timing without changing page meaning.',
      'The performance argument is a critical-path argument. If the hero image normally starts at 900 ms because JavaScript discovers it late, and preload starts it at 250 ms without delaying CSS, the visible page can complete earlier. If the same bytes would not have been needed, the page only got busier.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'The cost is browser resource pressure. A preconnect may leave an idle socket, a preload may consume bandwidth and cache, a prefetch may reveal intent and waste mobile data, and a badly ordered set of hints can demote the resource the user actually sees.',
      'Cost behaves differently on different networks. On a fast desktop link, an unused 80 KB preload may be invisible. On a slow mobile link, that same preload can delay a 25 KB critical CSS file enough to hurt first render. That is why hints need waterfall evidence, not faith.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'Use preload for a confirmed current-page hero image, critical font, or CSS file that is discovered too late. Use preconnect for a small number of origins that are definitely needed soon, such as an image CDN used by the above-the-fold content.',
      'Use 103 Early Hints when the server or CDN knows critical links before the final HTML is generated. Use prefetch for likely next-route assets when the browser is idle and the prediction is strong. In each case, the use is tied to a measured delay, not a generic hope that early is faster.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'Hints fail when they become an asset manifest. Preloading every route chunk, every carousel image, and every optional font variant converts scheduling help into network noise.',
      'They also fail when request shape changes. A font preload without the right CORS mode can download once for the preload and again for the CSS font request. A responsive image preload can fetch the wrong candidate if it does not match the final srcset and media logic.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'A product page has a 30 KB CSS file, a 60 KB JavaScript bundle, a 40 KB font, and a 180 KB hero image on a CDN. Without hints, HTML arrives at 100 ms, CSS starts at 130 ms, JavaScript finishes at 650 ms, and only then does the browser discover the hero image. With 100 ms of CDN connection setup and 500 ms of image transfer, the hero completes near 1250 ms.',
      'Add one preconnect to the CDN at 120 ms and one matching preload for the hero at 150 ms. The connection work overlaps CSS and JavaScript, and the image completes near 750 ms if bandwidth is not stolen from CSS. Add four below-the-fold image preloads of 180 KB each, and the same page may lose the win because 720 KB of speculative image bytes competes with the real hero.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: MDN rel=preload at https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel/preload, MDN rel=preconnect at https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel/preconnect, W3C Resource Hints at https://www.w3.org/TR/2023/DISC-resource-hints-20230314/, WHATWG HTML links at https://html.spec.whatwg.org/multipage/links.html, and web.dev Resource Hints at https://web.dev/learn/performance/resource-hints.',
      'Study Browser Rendering, CDN Request Flow, HTTP Cache ETag Revalidation, HTTP/3 over QUIC, HTTP/3 Priority Urgency Scheduler, Service Workers and Offline-First, Cache Invalidation and Versioning, and Subresource Integrity Hash Manifest next.',
    ] },
  ],
};
