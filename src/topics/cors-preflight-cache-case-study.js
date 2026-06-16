// CORS preflight as a browser-managed permission cache: OPTIONS checks,
// allow headers, max-age, network partitioning, and actual request release.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'cors-preflight-cache-case-study',
  title: 'CORS Preflight Cache',
  category: 'Security',
  summary: 'How browsers authorize non-simple cross-origin requests with OPTIONS preflights, allow headers, a dedicated preflight cache, max-age, and actual-request release.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['preflight path', 'cache key'], defaultValue: 'preflight path' },
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

function corsGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'page', label: 'page', x: 0.8, y: 4.6, note: notes.page ?? 'origin A' },
      { id: 'fetch', label: 'fetch', x: 2.6, y: 5.7, note: notes.fetch ?? 'PUT+Auth' },
      { id: 'cache', label: 'cache', x: 2.6, y: 3.5, note: notes.cache ?? 'preflight' },
      { id: 'options', label: 'OPTIONS', x: 4.8, y: 5.7, note: notes.options ?? 'probe' },
      { id: 'api', label: 'API', x: 6.8, y: 4.6, note: notes.api ?? 'origin B' },
      { id: 'allow', label: 'allow', x: 8.5, y: 5.7, note: notes.allow ?? 'headers' },
      { id: 'actual', label: 'actual', x: 8.5, y: 3.5, note: notes.actual ?? 'real req' },
      { id: 'result', label: 'result', x: 9.8, y: 4.6, note: notes.result ?? 'response' },
    ],
    edges: [
      { id: 'e-page-fetch', from: 'page', to: 'fetch', weight: '' },
      { id: 'e-fetch-cache', from: 'fetch', to: 'cache', weight: 'check' },
      { id: 'e-cache-options', from: 'cache', to: 'options', weight: 'miss' },
      { id: 'e-options-api', from: 'options', to: 'api', weight: '' },
      { id: 'e-api-allow', from: 'api', to: 'allow', weight: '' },
      { id: 'e-allow-cache', from: 'allow', to: 'cache', weight: 'max-age' },
      { id: 'e-cache-actual', from: 'cache', to: 'actual', weight: 'ok' },
      { id: 'e-actual-api', from: 'actual', to: 'api', weight: '' },
      { id: 'e-api-result', from: 'api', to: 'result', weight: '' },
    ],
  }, { title });
}

function* preflightPath() {
  yield {
    state: corsGraph('A non-simple request needs browser permission first'),
    highlight: { active: ['page', 'fetch', 'cache', 'e-page-fetch', 'e-fetch-cache'], compare: ['actual'] },
    explanation: 'A cross-origin request with a non-simple method or custom headers cannot go straight to the API. The browser first checks whether that origin, method, and header set is allowed.',
    invariant: 'The preflight authorizes the shape of the future request.',
  };

  yield {
    state: corsGraph('The browser sends OPTIONS with requested method and headers', { options: 'method+hdrs', api: 'policy' }),
    highlight: { active: ['options', 'api', 'e-cache-options', 'e-options-api'], found: ['fetch'] },
    explanation: 'The preflight request is an OPTIONS request. It carries Origin, Access-Control-Request-Method, and Access-Control-Request-Headers so the server can answer the permission question.',
  };

  yield {
    state: corsGraph('The server answers with allow headers', { allow: 'ACAO+ACAM+ACAH', cache: 'store?' }),
    highlight: { found: ['allow'], active: ['api', 'allow', 'cache', 'e-api-allow', 'e-allow-cache'] },
    explanation: 'The response can allow the origin, methods, and request headers. Access-Control-Max-Age tells the browser how long that positive permission can be reused.',
  };

  yield {
    state: corsGraph('Only after success does the actual request leave', { actual: 'PUT /item', result: '200/4xx' }),
    highlight: { active: ['cache', 'actual', 'api', 'result', 'e-cache-actual', 'e-actual-api', 'e-api-result'], removed: ['options'] },
    explanation: 'If the preflight succeeds, the browser sends the actual request. If it fails, the browser blocks the actual request from being made by script.',
  };

  yield {
    state: labelMatrix(
      'Preflight headers',
      [
        { id: 'origin', label: 'Origin' },
        { id: 'method', label: 'Req-Method' },
        { id: 'headers', label: 'Req-Headers' },
        { id: 'maxage', label: 'Max-Age' },
      ],
      [
        { id: 'side', label: 'side' },
        { id: 'role', label: 'role' },
      ],
      [
        ['request', 'who asks'],
        ['request', 'future verb'],
        ['request', 'future hdrs'],
        ['response', 'cache ttl'],
      ],
    ),
    highlight: { found: ['origin:role', 'method:role', 'headers:role'], active: ['maxage:role'] },
    explanation: 'CORS is header-shaped policy. The request describes the future request; the response names what the server permits and how long that answer may be cached.',
  };
}

function* cacheKey() {
  yield {
    state: labelMatrix(
      'Cache entry',
      [
        { id: 'part', label: 'partition' },
        { id: 'origin', label: 'origin' },
        { id: 'url', label: 'URL' },
        { id: 'cred', label: 'cred' },
        { id: 'method', label: 'method' },
        { id: 'header', label: 'header' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['net key', 'isolate'],
        ['caller', 'same site?'],
        ['target', 'resource'],
        ['include?', 'cookies'],
        ['verb', 'allowed'],
        ['name', 'allowed'],
      ],
    ),
    highlight: { found: ['origin:stores', 'url:stores', 'method:stores', 'header:stores'], compare: ['cred:why'] },
    explanation: 'The preflight cache is not the ordinary HTTP cache. Fetch specifies a dedicated CORS-preflight cache whose entries include partition key, origin, URL, credentials flag, method, header name, and max-age.',
    invariant: 'A cached permission is scoped permission.',
  };

  yield {
    state: corsGraph('A cache hit skips OPTIONS but not the CORS check', { cache: 'hit', options: 'skipped', actual: 'send now' }),
    highlight: { found: ['cache', 'actual', 'api', 'result'], removed: ['options', 'e-cache-options'] },
    explanation: 'When the same request shape is still covered by a cached positive preflight, the browser can skip the OPTIONS round trip and send the actual request directly.',
  };

  yield {
    state: corsGraph('A different header set misses the cache', { fetch: 'PUT+X-Trace', cache: 'miss', options: 'new probe' }),
    highlight: { active: ['fetch', 'cache', 'options', 'e-fetch-cache', 'e-cache-options'], compare: ['actual'] },
    explanation: 'Changing requested headers can require a new preflight. That is why adding ad hoc custom headers to every request can quietly add latency.',
  };

  yield {
    state: labelMatrix(
      'Design choices',
      [
        { id: 'simple', label: 'simple' },
        { id: 'custom', label: 'custom hdr' },
        { id: 'auth', label: 'auth' },
        { id: 'ttl', label: 'ttl' },
      ],
      [
        { id: 'latency', label: 'latency' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['low', 'limited'],
        ['preflight', 'sprawl'],
        ['needed', 'cred rules'],
        ['lower later', 'stale allow'],
      ],
    ),
    highlight: { found: ['simple:latency', 'ttl:latency'], compare: ['custom:risk', 'auth:risk'] },
    explanation: 'API design affects preflight cost. Simple requests avoid the extra round trip. Custom headers and credentials often need preflight, so max-age and consistent header sets matter.',
  };

  yield {
    state: corsGraph('The browser is the enforcement point', { page: 'script', api: 'server policy', result: 'exposed?' }),
    highlight: { found: ['page', 'fetch', 'cache', 'api', 'result'], active: ['e-api-result'] },
    explanation: 'CORS does not make the server private. It controls what browser scripts can read or send across origins. Non-browser clients are not constrained by the browser preflight cache.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'preflight path') yield* preflightPath();
  else if (view === 'cache key') yield* cacheKey();
  else throw new InputError('Pick a CORS preflight view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A CORS preflight is a browser permission check before certain cross-origin script requests. For request shapes with non-simple methods, non-simple headers, or other preflight conditions, the browser sends OPTIONS first and asks whether the future request is allowed.',
        'The data structure is a dedicated browser-managed preflight cache. It stores positive permission answers separately from the normal HTTP cache, scoped by request shape and bounded by max-age.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The browser sends Origin, Access-Control-Request-Method, and Access-Control-Request-Headers. The server answers with Access-Control-Allow-Origin, Access-Control-Allow-Methods, Access-Control-Allow-Headers, maybe Access-Control-Allow-Credentials, and optionally Access-Control-Max-Age.',
        'If the response authorizes the request shape, the browser sends the actual request. If not, script never gets to make that actual request. If a cached permission still applies, the browser can skip the OPTIONS round trip.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A dashboard at app.example sends PUT /api/item to api.example with Authorization and X-Trace-Id. The browser preflights because the method and headers are not simple. The API allows the app origin, PUT, Authorization, and X-Trace-Id, with Access-Control-Max-Age. Subsequent matching calls can skip OPTIONS until the entry expires or the request shape changes.',
        'This page links HTTP Cache ETag Revalidation and HTTP Vary Cache-Key Normalization to a different cache: the preflight cache. HTTP cache stores representations and Vary keeps variants separate. The preflight cache stores permission to send a future request shape.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'CORS is not authentication. It is browser enforcement for cross-origin script access. Servers still need real authorization. Non-browser clients can send requests without preflight.',
        'Do not add unnecessary custom headers to every request. Do not assume Access-Control-Max-Age lasts forever; browsers can cap or evict entries. Do not forget Vary: Origin when dynamically echoing a specific allowed origin.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN CORS guide at https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS, MDN preflight request glossary at https://developer.mozilla.org/en-US/docs/Glossary/Preflight_request, MDN Access-Control-Max-Age at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Max-Age, and WHATWG Fetch CORS-preflight cache at https://fetch.spec.whatwg.org/#cors-preflight-cache. Study URL Parser & Origin Tuple for the origin comparison that CORS builds on, then HTTP Cache ETag Revalidation, HTTP Vary Cache-Key Normalization, Browser Cache Partitioning Network Key, Subresource Integrity Hash Manifest, CSP Nonce & Hash Policy, Service Workers & Offline-First, and Browser Message Channels & Broadcast Coordination next.',
        'Then study SameSite Cookies & CSRF for the opposite edge of browser security: CORS decides whether a script may read a cross-origin response, while SameSite decides when ambient cookies ride along with a navigation, form post, image, iframe, or fetch.',
        'Cross-Origin Isolation shows where CORS participates in a stricter embedder contract, and Fetch Metadata Request Gate shows how the server can classify browser request shapes before route handlers run.',
      ],
    },
  ],
};
