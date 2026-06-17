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
      heading: 'Why this exists',
      paragraphs: [
        'HTTP caching is a chain of decisions, but developers often see only one response. A request may pass through browser cache, CDN edge, regional shield, reverse proxy, and origin. Any one of those layers can hit, miss, revalidate, collapse a stampede, store a new object, or forward for a reason that is not visible from timing alone.',
        'Cache-Status exists to put cache behavior into a structured response header. It gives the response a small evidence trail: which cache handled the object, whether it hit or forwarded, how much freshness remains, whether it was stored, and whether revalidation was collapsed.',
        'That matters because cache failures often masquerade as unrelated system failures. A bad key rule looks like origin slowness. A missing freshness header looks like capacity trouble. A revalidation stampede looks like a random latency spike. Per-layer cache evidence keeps those stories separate.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to infer cache behavior from latency, age, logs, or provider-specific headers. That is often enough for a single CDN in a controlled test. A very fast response probably hit something, and a large origin spike probably means miss traffic.',
        'The wall is ambiguity. A fast miss can look like a hit. A slow hit can look like origin work. A shield hit can hide an edge miss. A collapsed revalidation can look like random latency unless the cache says what happened. Provider-specific headers also stop composing cleanly when several caches are involved.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Cache-Status treats caching as per-layer evidence, not as one vague hit-or-miss bit. The header is a structured list. Each member can name a cache and add parameters such as `hit`, `fwd`, `ttl`, `stored`, `collapsed`, `key`, or `detail`.',
        'That design lets an edge cache and a shield cache both describe their part of the path. The result is not a full trace, but it is enough to turn many cache mysteries into specific questions: why was this forwarded, how fresh was it, did it store, and did a stampede get collapsed?',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the multi-cache trace view, follow the request through browser, edge, shield, and origin. The important move is from guessing about the path to reading structured evidence from the caches that actually made decisions.',
        'In the debug headers view, compare Cache-Status with adjacent signals. Vendor headers may be useful, Server-Timing can explain elapsed time, trace ids join the response to logs, and Cache-Status explains cache handling. The strongest investigation uses them together.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A participating cache emits a Cache-Status member for its handling of the response. `hit` says the response came from cache. `fwd` says the cache forwarded and can include a reason such as miss, stale, bypass, or request. `ttl` reports remaining freshness. `stored` says the cache inserted the response. `collapsed` shows that concurrent revalidations were coalesced.',
        'In practice, teams often sample the header, expose more detail in debug mode, and log it with request ids. During an incident, Cache-Status joins with CDN metrics, Server-Timing, distributed traces, and origin logs to separate cache-key mistakes from origin compute, backend errors, revalidation behavior, and network path issues.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because the component that made the cache decision reports the decision while the response is still in hand. That is more reliable than reconstructing cache behavior later from latency, aggregate hit ratio, and incomplete logs.',
        'The guarantee is observational, not behavioral. Cache-Status does not make an object cacheable, does not fix freshness policy, and does not enforce correctness. It makes the cache path inspectable enough that policy bugs become testable.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The cost is header size, implementation coverage, and privacy review. Cache keys can contain URLs, query parameters, account identifiers, authorization-derived dimensions, or business-sensitive routing. Public responses should avoid leaking those details through `key` or `detail` fields.',
        'There is also a support tradeoff. Some caches emit Cache-Status, some do not, and some emit it only under debug or sampling rules. A missing header does not prove there was no cache. Treat the header as a strong signal when present, not as a complete telemetry system.',
      ],
    },
    {
      heading: 'Operational checklist',
      paragraphs: [
        'Decide which fields are safe before rollout. A production policy should say which caches may emit members, whether `detail` is public, whether key material is redacted or hashed, and which request classes are sampled. Debug power should not accidentally reveal tenant identity, authorization state, or private URL structure.',
        'Add Cache-Status to runbooks as a first-class signal. For every cache incident, compare response headers, hit ratio, origin traffic, trace ids, deploy times, and freshness policy. The header is most useful when operators know exactly which graph and log panel it should join.',
      ],
    },
    {
      heading: 'Testing the contract',
      paragraphs: [
        'A good test suite does not just assert that the header exists. It sends requests that should hit, miss, revalidate, bypass, and store, then checks that the reported fields match the expected cache decision. For multi-layer paths, test edge and shield behavior separately so a shield hit does not hide a broken edge key.',
        'Also test negative cases. Authenticated responses, private objects, and tenant-specific variants should not reveal sensitive key material. A debug feature that helps engineers during an incident can become a production leak if it is enabled for the wrong audience or carries raw cache-key fragments.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Cache-Status wins during cache-policy rollouts, CDN migrations, Vary or No-Vary-Search changes, stale-while-revalidate tuning, stampede debugging, and origin-load investigations.',
        'It is especially useful when the response crosses more than one cache layer and provider-specific headers stop composing cleanly.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails if teams expose too much. A debug header that reveals private cache-key dimensions can create a data leak. Redaction and sampling are part of the design, not cleanup work after launch.',
        'It also fails when collected without context. A miss reason is useful only when correlated with route, cache key policy, freshness headers, deployment time, origin load, and user impact. Cache-Status tells you what a cache did, not whether the overall product behavior was acceptable.',
        'It can mislead when teams compare unlike traffic. A route with personalized responses should not have the same hit-rate target as a fingerprinted static asset. Cache-Status improves the evidence, but the interpretation still has to respect cacheability, route shape, and product requirements.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A media site expects article pages with UTM parameters to share a cache entry. After a rollout, origin traffic doubles and p95 latency rises. Timing suggests a cache problem, but it cannot explain which layer is failing.',
        'Sampled responses show the edge member forwarding with a miss-like reason while the shield sometimes hits. The same responses carry trace ids, and origin logs show a new `Vary: X-Trace-Id` header added by a middleware change. That header makes each request look unique to the cache. The team removes the accidental vary dimension, Cache-Status returns to edge hits with healthy `ttl` values, and origin traffic drops.',
        'The lesson is concrete: Cache-Status did not solve the bug. It shortened the path from "the site is slower" to "the cache key changed at the edge after this deploy."',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: RFC 9211 Cache-Status at https://www.rfc-editor.org/rfc/rfc9211, RFC 9111 HTTP Caching at https://www.rfc-editor.org/rfc/rfc9111, and RFC 8941 Structured Field Values for HTTP at https://www.rfc-editor.org/rfc/rfc8941.',
        'Study next: HTTP Cache ETag Revalidation for validation outcomes, HTTP Vary Cache-Key Normalization and No-Vary-Search Query Key for key-shape mistakes, CDN Stale-While-Revalidate Shield for stale and collapsed behavior, Distributed Tracing and OpenTelemetry Collector Case Study for cross-service correlation, and Tail Latency & p99 Thinking for user impact.',
      ],
    },
  ],
};
