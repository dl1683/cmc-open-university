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
      heading: 'What it is',
      paragraphs: [
        'Cache-Status is a standardized HTTP response header for reporting how caches handled a request. Instead of relying only on vendor-specific headers or timing guesses, each participating cache can append a structured member describing hit, miss, forwarding reason, ttl, storage, or collapse behavior.',
        'RFC 9211 defines the Cache-Status response header field and its structured-field format: https://www.rfc-editor.org/rfc/rfc9211. It is designed for cache observability across multiple layers, not as a replacement for logs or tracing.',
      ],
    },
    {
      heading: 'Core data structure',
      paragraphs: [
        'The header is a structured list. Each member corresponds to one cache that handled the response, normally ordered from origin-adjacent to user-adjacent caches. Parameters such as hit, fwd, ttl, stored, collapsed, key, and detail add machine-readable context.',
        'This makes CDN Stale-While-Revalidate Shield, HTTP Vary Cache-Key Normalization, and No-Vary-Search Query Key measurable. A cache policy is only real when you can observe whether it hits, misses, revalidates, collapses, and stores as intended.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A site deploys No-Vary-Search for article UTM parameters. Cache-Status is enabled for sampled traffic. After rollout, responses show edge; hit; ttl=430 for tracked article URLs that previously missed. A later deployment accidentally adds Vary: X-Trace-Id, and Cache-Status shifts to fwd=uri-miss plus origin traffic spikes. The team rolls back the key-sprawl change quickly.',
        'The investigation joins Cache-Status with a trace id, origin logs, and provider metrics. That separates cache-key mistakes from origin compute, network loss, and revalidation behavior.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Cache-Status is not an authorization mechanism and should not expose sensitive cache keys. Use redaction, sampling, and debug modes when detailed parameters could reveal private URLs, account identifiers, or business-sensitive routing details.',
        'A missing Cache-Status header does not prove there was no cache. Caches decide when to add it, and support varies. Treat it as one observability signal alongside provider logs, Server-Timing, distributed tracing, and origin metrics.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RFC 9211 Cache-Status at https://www.rfc-editor.org/rfc/rfc9211, RFC 9111 HTTP Caching at https://www.rfc-editor.org/rfc/rfc9111, and RFC 8941 Structured Field Values for HTTP at https://www.rfc-editor.org/rfc/rfc8941.',
        'Study next: HTTP Cache ETag Revalidation for validation outcomes, HTTP Vary Cache-Key Normalization and No-Vary-Search Query Key for key-shape mistakes, CDN Stale-While-Revalidate Shield for stale and collapsed behavior, Distributed Tracing and OpenTelemetry Collector Case Study for cross-service correlation, and Tail Latency & p99 Thinking for user impact.',
      ],
    },
  ],
};
