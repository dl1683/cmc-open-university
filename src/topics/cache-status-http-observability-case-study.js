// Cache-Status observability: standardize cache hit, miss, forwarding, ttl,
// collapse, and detail fields across browser, edge, shield, and origin paths.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'cache-status-http-observability-case-study',
  title: 'Cache-Status HTTP Observability',
  category: 'Systems',
  summary: 'How the Cache-Status response header reports cache handling across edge, shield, browser, and origin paths with structured fields.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['multi-cache trace', 'debug headers'], defaultValue: 'multi-cache trace' },
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

function statusGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'user', label: 'user', x: 0.8, y: 4.8, note: notes.user ?? 'GET' },
      { id: 'browser', label: 'br', x: 2.3, y: 4.8, note: notes.browser ?? 'cache' },
      { id: 'edge', label: 'edge', x: 4.0, y: 4.8, note: notes.edge ?? 'CDN' },
      { id: 'shield', label: 'shield', x: 5.8, y: 4.8, note: notes.shield ?? 'mid' },
      { id: 'origin', label: 'origin', x: 7.5, y: 4.8, note: notes.origin ?? 'app' },
      { id: 'status', label: 'status', x: 5.8, y: 2.5, note: notes.status ?? 'header' },
      { id: 'log', label: 'logs', x: 7.5, y: 2.5, note: notes.log ?? 'metrics' },
      { id: 'page', label: 'page', x: 9.2, y: 4.8, note: notes.page ?? 'response' },
    ],
    edges: [
      { id: 'e-user-browser', from: 'user', to: 'browser', weight: '' },
      { id: 'e-browser-edge', from: 'browser', to: 'edge', weight: '' },
      { id: 'e-edge-shield', from: 'edge', to: 'shield', weight: '' },
      { id: 'e-shield-origin', from: 'shield', to: 'origin', weight: '' },
      { id: 'e-origin-page', from: 'origin', to: 'page', weight: '' },
      { id: 'e-edge-status', from: 'edge', to: 'status', weight: '' },
      { id: 'e-shield-status', from: 'shield', to: 'status', weight: '' },
      { id: 'e-status-log', from: 'status', to: 'log', weight: '' },
    ],
  }, { title });
}

function hitRatioPlot() {
  return plotState({
    axes: { x: { label: 'time', min: 0, max: 6 }, y: { label: 'hit %', min: 0, max: 100 } },
    series: [
      { id: 'edge', label: 'edge hit', points: [{ x: 0, y: 86 }, { x: 1, y: 87 }, { x: 2, y: 84 }, { x: 3, y: 58 }, { x: 4, y: 61 }, { x: 5, y: 83 }] },
      { id: 'origin', label: 'origin', points: [{ x: 0, y: 14 }, { x: 1, y: 13 }, { x: 2, y: 16 }, { x: 3, y: 42 }, { x: 4, y: 39 }, { x: 5, y: 17 }] },
    ],
    markers: [
      { id: 'deploy', x: 3, y: 58, label: 'key bug' },
      { id: 'fix', x: 5, y: 83, label: 'fixed' },
    ],
  }, { title: 'Cache-Status turns hit-rate drops into evidence' });
}

function* multiCacheTrace() {
  yield {
    state: statusGraph('A response may pass through several caches', { browser: 'miss', edge: 'lookup', shield: 'lookup' }),
    highlight: { active: ['user', 'browser', 'edge', 'shield', 'e-user-browser', 'e-browser-edge', 'e-edge-shield'], compare: ['status'] },
    explanation: 'A slow response can involve browser cache, CDN edge, shield, and origin. Without cache observability, a developer sees one response time and guesses which layer missed.',
    invariant: 'Cache debugging needs per-layer evidence, not one vague hit-or-miss bit.',
  };

  yield {
    state: statusGraph('Cache-Status records each cache member as structured data', { edge: 'fwd=miss', shield: 'hit ttl', status: 'list' }),
    highlight: { active: ['edge', 'shield', 'status', 'e-edge-status', 'e-shield-status'], found: ['log'] },
    explanation: 'RFC 9211 defines Cache-Status as a structured list. Each member names a cache and can carry parameters such as hit, fwd, ttl, stored, collapsed, key, or detail.',
  };

  yield {
    state: statusGraph('An edge hit is visible without reading provider logs', { edge: 'hit', shield: 'skip', status: 'ttl=480', page: 'fast' }),
    highlight: { found: ['edge', 'status', 'page', 'e-edge-status'], removed: ['origin', 'e-shield-origin'] },
    explanation: 'For a healthy static asset, Cache-Status can show that the edge handled the response and how much freshness remains. That is faster than inferring hit status from timing.',
  };

  yield {
    state: statusGraph('A collapsed miss reveals stampede control', { edge: 'fwd=stale', shield: 'collapsed', origin: '304', status: 'collapsed' }),
    highlight: { active: ['edge', 'shield', 'origin', 'status', 'e-edge-shield', 'e-shield-origin', 'e-shield-status'], compare: ['page'] },
    explanation: 'When many clients request a stale object, a cache can collapse revalidation. Cache-Status can expose that behavior so one origin validation does not look like random latency.',
  };

  yield {
    state: labelMatrix(
      'Common fields',
      [
        { id: 'hit', label: 'hit' },
        { id: 'fwd', label: 'fwd' },
        { id: 'ttl', label: 'ttl' },
        { id: 'stored', label: 'stored' },
        { id: 'collapse', label: 'collapsed' },
      ],
      [
        { id: 'means', label: 'means' },
        { id: 'use', label: 'use' },
      ],
      [
        ['cache used', 'fast path'],
        ['why sent', 'miss kind'],
        ['fresh left', 'expiry'],
        ['inserted', 'fill check'],
        ['singleflight', 'stampede'],
      ],
    ),
    highlight: { found: ['hit:use', 'ttl:use', 'collapse:use'], compare: ['fwd:means'] },
    explanation: 'The complete trace turns cache behavior into fields that can be graphed, sampled, and correlated with request ids, origin load, and user-visible latency.',
  };
}

function* debugHeaders() {
  yield {
    state: labelMatrix(
      'Header choices',
      [
        { id: 'vendor', label: 'vendor' },
        { id: 'status', label: 'Cache-Status' },
        { id: 'server', label: 'Server-Tim' },
        { id: 'trace', label: 'trace id' },
      ],
      [
        { id: 'good', label: 'good' },
        { id: 'limit', label: 'limit' },
      ],
      [
        ['available', 'not std'],
        ['standard', 'support'],
        ['timing', 'not cache'],
        ['join logs', 'needs logs'],
      ],
    ),
    highlight: { found: ['status:good', 'trace:good'], compare: ['vendor:limit', 'server:limit'] },
    explanation: 'Provider-specific headers are useful, but they do not compose across layers. Cache-Status gives a standard format; trace ids and Server-Timing fill adjacent gaps.',
    invariant: 'Expose enough to debug behavior, but not enough to leak private cache keys.',
  };

  yield {
    state: statusGraph('Sensitive cache-key details should be redacted', { status: 'key hash', log: 'safe', edge: 'user key' }),
    highlight: { active: ['edge', 'status', 'log', 'e-edge-status', 'e-status-log'], removed: ['user'] },
    explanation: 'Cache keys can contain URLs, query parameters, or normalized dimensions. Public response headers should avoid leaking secrets, account identifiers, or authorization-derived details.',
  };

  yield {
    state: statusGraph('Cache-Status joins with traces and origin logs', { status: 'hit/miss', log: 'trace join', origin: 'handler' }),
    highlight: { active: ['status', 'log', 'origin', 'e-status-log'], compare: ['edge', 'shield'] },
    explanation: 'A production investigation joins Cache-Status, distributed trace id, origin logs, and CDN metrics. That shows whether a slowdown is cache miss, origin compute, revalidation, or network path.',
  };

  yield {
    state: hitRatioPlot(),
    highlight: { active: ['deploy'], found: ['edge'], removed: ['origin'], compare: ['fix'] },
    explanation: 'When a deploy adds an accidental Vary dimension or query parameter, the hit-rate line drops and origin traffic rises. Cache-Status turns that into a direct finding instead of a hunch.',
  };

  yield {
    state: labelMatrix(
      'Runbook',
      [
        { id: 'sample', label: 'sample' },
        { id: 'redact', label: 'redact' },
        { id: 'alert', label: 'alert' },
        { id: 'link', label: 'link' },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['debug mode', 'low noise'],
        ['keys', 'privacy'],
        ['miss jump', 'protect'],
        ['trace id', 'root cause'],
      ],
    ),
    highlight: { found: ['redact:action', 'alert:action', 'link:action'], compare: ['sample:reason'] },
    explanation: 'The complete case is a CDN rollout: enable Cache-Status on sampled or debug traffic, redact key details, alert on miss jumps, and link each response to tracing for root-cause work.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'multi-cache trace') yield* multiCacheTrace();
  else if (view === 'debug headers') yield* debugHeaders();
  else throw new InputError('Pick a Cache-Status view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        {type:'callout', text:'Cache-Status turns a vague slow-or-fast response into per-cache evidence about which layer hit, missed, forwarded, stored, or collapsed work.'},
        'Read each cache layer as a decision point between the client and the origin server. A cache hit means the layer served a stored response; a miss means it had to forward or revalidate. A safe inference is that each Cache-Status member reports the decision made by the cache that emitted it.',
        'Read the header as evidence, not as a trace of every network event. The edge cache, shield cache, and reverse proxy may each add a member. The useful question is what each layer did with the object, not whether the response merely felt fast.',
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/6/67/Reverse_proxy_h2g2bob.svg', alt:'Reverse proxy diagram showing a client request passing through an intermediary before reaching a server', caption:'Reverse proxies and cache layers sit between users and origins; Cache-Status makes each intermediary report the cache decision it made. Source: Wikimedia Commons, H2g2bob, CC0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'HTTP caching often happens in layers: browser cache, CDN edge, regional shield, reverse proxy, and origin. A response can pass through several of those layers before the developer sees one timing number. Without structured evidence, cache bugs look like origin slowness, network noise, or random latency spikes.',
        'Cache-Status exists to make cache behavior visible in a standard response header. It can report whether a cache hit, forwarded, stored, had remaining time to live, or collapsed revalidation work. That turns cache debugging from guesswork into inspection.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to infer cache behavior from latency, Age, logs, or provider-specific headers. That can work when one CDN handles one route and the test traffic is controlled. A fast response often means a nearby cache had the object.',
        'It stops working when the path has more than one cache or when timing is ambiguous. A fast miss can look like a hit, a slow hit can look like origin work, and a shield hit can hide an edge miss. Vendor headers also stop composing cleanly across providers.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is observability mismatch. Aggregate hit rate tells you that some traffic hit some cache, but it does not explain this response. Origin logs tell you what reached the origin, but they do not explain why the cache forwarded it.',
        'Another wall is cache-key privacy. The key may include URL parameters, headers, authorization-derived variants, or tenant routing. A debug field that prints raw key details can solve an incident and leak private structure at the same time.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that every cache decision should be reported by the component that made it. Cache-Status is a structured list where each member can name a cache and attach parameters such as hit, fwd, ttl, stored, collapsed, key, or detail.',
        'The header is not a full distributed trace. It is a narrow contract: this cache handled the response this way. That is enough to separate a miss caused by cache-key policy from a miss caused by freshness, bypass, or revalidation.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A participating cache appends a Cache-Status member before returning the response. A hit member says the stored response was used. A forwarded member can carry a reason such as miss, stale, bypass, or request.',
        'Operators usually sample the header or expose richer detail only in debug mode. They join it with request ids, Server-Timing, CDN metrics, origin logs, and traces. Cache-Status explains the cache decision; the other signals explain elapsed time and downstream work.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is observational. The cache that knows whether it hit, missed, forwarded, or stored records that fact while the response is being processed. That is more reliable than reconstructing the decision later from latency and incomplete logs.',
        'The header does not enforce caching policy. It does not make a response cacheable, repair freshness headers, or guarantee privacy. It works because it makes a hidden decision testable against the policy the team expected.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The direct cost is header bytes and implementation coverage. If two cache layers each add 80 bytes, a response pays about 160 bytes before compression and transport effects. That is usually small compared with HTML or JSON, but it is not free at high request volume.',
        'The larger cost is governance. Teams need rules for which caches emit members, whether detail is sampled, and how key material is redacted. When traffic doubles, the log volume from captured headers can double too, so retention and sampling belong in the design.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Cache-Status helps during CDN migrations, cache-key rollouts, Vary header debugging, stale-while-revalidate tuning, stampede investigations, and origin-load incidents. It is strongest when a response crosses more than one cache layer.',
        'It also helps tests. A route that should hit can be checked for a hit member, a route that should bypass can be checked for a forward reason, and a revalidation test can check whether collapsed work was reported. The header turns cache policy into an assertion surface.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails if too much detail is exposed. A cache key can reveal private query parameters, tenant identity, authorization state, or internal routing. Redaction is part of the feature, not a cleanup step after launch.',
        'It also fails when read without context. A miss can be correct for personalized data, and a hit can be wrong for stale or private data. Cache-Status says what a cache did; the route policy says whether that behavior was acceptable.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A news site expects article pages with tracking parameters to share one cache entry. After a deploy, origin traffic rises from 5,000 to 10,000 requests per minute and p95 latency rises from 120 ms to 480 ms. Timing says cache trouble, but not which layer changed.',
        'Sampled Cache-Status shows the edge forwarding with a miss reason while the shield sometimes hits. The same responses carry trace ids, and origin logs show a new Vary: X-Trace-Id header from middleware. Removing that accidental vary dimension restores edge hits and drops origin traffic near the old level.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RFC 9211 Cache-Status at https://www.rfc-editor.org/rfc/rfc9211, RFC 9111 HTTP Caching at https://www.rfc-editor.org/rfc/rfc9111, and RFC 8941 Structured Field Values for HTTP at https://www.rfc-editor.org/rfc/rfc8941.',
        'Study HTTP ETag revalidation, HTTP Vary cache-key normalization, No-Vary-Search, CDN stale-while-revalidate, distributed tracing, OpenTelemetry collectors, and tail-latency analysis. The recurring question is which layer made the decision you are trying to debug.',
      ],
    },
  ],
};
