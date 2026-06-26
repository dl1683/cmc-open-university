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


export const article = { sections: [
  { heading: 'How to read the animation', paragraphs: [
    'The preflight-path view shows the browser delaying a non-simple cross-origin request. Active nodes are the page request, preflight cache, OPTIONS probe, server allow headers, and then the actual request if permission passes.',
    'The cache-key view shows why a hit is scoped. Found nodes are request-shape fields already covered by a positive preflight entry; compare nodes are fields that can force a miss, such as a new custom header.',
  ] },
  { heading: 'Why this exists', paragraphs: [
    'Browsers run scripts from one origin while users are logged in to many others. A script from app.example should not freely send credentialed PUT requests to api.example unless api.example has opted into that browser access.',
    'CORS preflight is the browser asking permission for a non-simple cross-origin request shape before script sends it. The preflight cache exists so repeated approved shapes do not pay the OPTIONS round trip every time.',
    {type:'callout', text:'A CORS preflight cache stores scoped permission for a request shape, not a blanket right to call an origin.'},
  ] },
  { heading: 'The obvious approach', paragraphs: [
    'The obvious answer is server authentication. That is necessary, but it decides who the user or client is, not which browser origins may drive cross-origin script access.',
    'Another shortcut is Access-Control-Allow-Origin: *. That can fit public read-only resources, but it is too broad for credentialed APIs, state-changing methods, custom request headers, and route-specific policies.',
  ] },
  { heading: 'The wall', paragraphs: [
    'The wall is that permission is a matrix, not one flag. Origin, URL, credentials mode, method, requested header names, network partition, and expiration all affect whether the actual request can be released.',
    'Latency is the second wall. If every request uses a different custom header set, the browser may preflight repeatedly and add one extra network round trip to ordinary API calls.',
  ] },
  { heading: 'The core insight', paragraphs: [
    'Separate permission discovery from the actual request. The browser first asks whether origin O may send method M with headers H to URL U, and only a covering response releases the real request.',
    'The cache stores positive scoped permissions, not response bodies. A cached permission for PUT with Authorization does not automatically allow DELETE or a new X-Debug header.',
  ] },
  { heading: 'How it works', paragraphs: [
    'For a cross-origin non-simple request, the browser sends OPTIONS with Origin, Access-Control-Request-Method, and Access-Control-Request-Headers. The server answers with Access-Control-Allow-Origin, Allow-Methods, Allow-Headers, optionally Allow-Credentials, and optionally Max-Age.',
    'If the response covers the shape, the browser sends the actual request and may store the positive result in the dedicated CORS-preflight cache. If it does not cover the shape, script does not get to send that non-simple request through fetch.',
  ] },
  { heading: 'Why it works', paragraphs: [
    'The invariant is scoped permission. A positive preflight for one origin, URL, credentials mode, method, and header name set cannot be reused for a different shape outside that scope.',
    'It also works because the browser is the enforcement point. Non-browser clients can still send HTTP directly, so the server must keep authentication and authorization on every sensitive route.',
  ] },
  { heading: 'Cost and complexity', paragraphs: [
    'A cold preflight adds one extra round trip. On a 120 ms mobile network, a PUT that would take 150 ms can feel like 270 ms before server work changes at all.',
    'Max-Age reduces repeated cost, but browsers can cap or evict entries. The practical behavior depends on stable header sets, route consistency, credentials mode, and whether error paths send the same CORS policy as success paths.',
  ] },
  { heading: 'Real-world uses', paragraphs: [
    'Preflight fits single-page apps, hosted admin consoles, analytics dashboards, browser-based developer tools, and any frontend that calls a separate API with Authorization or state-changing methods. It lets the API name exactly which web origins and request shapes are allowed.',
    'It also guides API design. Stable custom headers, consistent route policies, measured preflight latency, and Vary: Origin when reflecting origins keep the permission cache useful and avoid cross-caller response confusion.',
  ] },
  { heading: 'Where it fails', paragraphs: [
    'CORS fails as a privacy model when people treat it as endpoint protection. A backend service, curl, or malicious non-browser client is not constrained by the browser preflight cache.',
    'It also does not cover all cross-site behavior. Simple requests, form posts, navigations, images, iframes, cookies, CSRF, SameSite, and Fetch Metadata have their own rules and must be designed together.',
  ] },
  { heading: 'Worked example', paragraphs: [
    'A page at https://app.example sends PUT https://api.example/items/42 with Authorization and X-Trace-Id. The browser checks for a cached entry matching app.example, the target URL, credentials mode, method PUT, and header names authorization and x-trace-id.',
    'On a miss, it sends OPTIONS. If the response allows origin https://app.example, method PUT, headers Authorization and X-Trace-Id, and max-age 600, the browser sends the PUT and can skip OPTIONS for matching requests for up to 10 minutes subject to browser caps.',
  ] },
  { heading: 'Sources and study next', paragraphs: [
    'Primary sources: MDN CORS guide, MDN preflight request glossary, MDN Access-Control-Max-Age reference, and the WHATWG Fetch CORS-preflight cache algorithm. Study simple requests, credentials mode, Vary: Origin, and network partitioning next.',
    'Then connect CORS to URL origin parsing, HTTP Vary cache keys, SameSite cookies, CSRF defenses, Fetch Metadata, CSP, and Cross-Origin Isolation. The shared theme is browser-enforced authority boundaries.',
  ] },
] };
