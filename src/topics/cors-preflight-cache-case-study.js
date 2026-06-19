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
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for CORS Preflight Cache. How browsers authorize non-simple cross-origin requests with OPTIONS preflights, allow headers, a dedicated preflight cache, max-age, and actual-request release..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Browsers run untrusted scripts from many origins in the same user agent. A page from one site should not freely drive privileged APIs on another site just because the user is logged in there. At the same time, real applications depend on cross-origin APIs. A frontend served from `app.example` may need to call `api.example`, a dashboard may call a metrics service, and a browser extension or hosted console may need a controlled path to a separate backend.',
        'CORS preflight is the browser mechanism for asking permission before a non-simple cross-origin request leaves script control. The key phrase is "request shape." The browser is not only asking whether an origin can talk to a server. It is asking whether this origin may send this method, with these request headers, credentials mode, and target URL. The answer can be cached, but only inside a tightly scoped preflight cache.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious server-side answer is authentication. Put an authorization check on the API, validate tokens or cookies, and reject callers that lack permission. That is necessary, but it does not answer the browser security question. CORS is about whether a script from one origin is allowed to make and read a cross-origin request through the browser. Authentication decides who the user or client is. CORS decides which browser origins receive script-level access.',
        'Another common shortcut is `Access-Control-Allow-Origin: *`. That can be fine for public read-only resources that expose the same response to everyone. It is not a complete policy for credentialed APIs, custom headers, state-changing methods, or routes where the allowed caller set is narrower than the whole web. A browser needs a more precise rule than "some cross-origin access is okay."',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The simple mental model breaks because permission is a matrix, not one flag. Origin, network partition key, URL, credentials mode, method, and request headers all matter. A route might allow `GET` from one origin, reject `PUT`, allow `Authorization`, and reject a random debugging header. Another route on the same server might have different rules. CORS has to express those distinctions without giving scripts a broad ambient cross-origin capability.',
        'Preflight also creates a latency problem. A non-simple request can require an extra `OPTIONS` round trip before the actual request. If every API call uses a different set of custom headers, the browser may miss the preflight cache repeatedly. That can make an otherwise fast API feel slow, especially on high-latency networks. The cache exists because permission checks are useful, but repeated permission checks for the same shape are wasteful.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core data structure is a dedicated cache of positive preflight permissions. It is not the ordinary HTTP cache, and it is not a cache of response bodies. It stores the right to send a future request shape. In the Fetch model, the entry is scoped by a partition key, origin, URL, credentials flag, method, header name, and max-age. That scoping is what lets the browser reuse permission without turning one approval into a global bypass.',
        'The algorithmic move is to separate permission discovery from the actual request. First, the browser asks the server whether a future request shape is allowed. Second, if the answer covers the shape, the browser releases the actual request. Third, if the positive answer can be cached, later matching requests can skip the discovery round trip. CORS preflight is therefore a permission-cache algorithm embedded in the browser fetch path.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A request becomes a preflight candidate when it is cross-origin and not simple under the Fetch and CORS rules. Common triggers include methods such as `PUT`, `PATCH`, or `DELETE`, request headers outside the safelisted set, and certain content types. Before the real request is sent, the browser sends an `OPTIONS` request to the target URL. That request includes `Origin`, `Access-Control-Request-Method`, and `Access-Control-Request-Headers` when relevant.',
        'The server replies with CORS response headers. `Access-Control-Allow-Origin` says which origin is allowed. `Access-Control-Allow-Methods` names allowed methods. `Access-Control-Allow-Headers` names allowed request headers. `Access-Control-Allow-Credentials` is required for credentialed browser exposure. `Access-Control-Max-Age` tells the browser how long a positive preflight answer may be reused, subject to browser caps and eviction. If the answer covers the shape, the actual request can proceed. If not, script is blocked from making that non-simple request through fetch.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a page at `https://app.example` wants to send `PUT https://api.example/items/42` with `Authorization` and `X-Trace-Id`. This is cross-origin and non-simple. The browser first checks the preflight cache for an entry matching the network partition, caller origin, target URL, credentials mode, method `PUT`, and requested header names. If there is no fresh matching entry, the browser sends `OPTIONS /items/42` to `api.example` with the caller origin, requested method, and requested headers.',
        'If the API responds with `Access-Control-Allow-Origin: https://app.example`, allows `PUT`, allows `Authorization` and `X-Trace-Id`, and sets a usable max-age, the browser records the positive permission and then sends the real `PUT`. A later request with the same shape can reuse the cache entry. If the frontend adds a new header such as `X-Debug-Mode`, that header name may not be covered, so the browser has to preflight again. If the server rejects the method or origin, the real request is not released to script.',
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        'The preflight-path view shows the browser as the enforcement point. The page asks fetch to send a non-simple cross-origin request. Fetch checks the preflight cache. On a miss, the browser sends `OPTIONS`, receives allow headers, stores a positive permission when allowed, and only then releases the actual request. The important visual fact is that the actual request is downstream of permission success.',
        'The cache-key view shows why this is not a normal HTTP cache. The cache entry is not "this URL is allowed forever." It is scoped by the caller, target, credentials mode, method, header name, partition, and expiration. The view where a different header set misses the cache is the practical lesson for API design: inconsistent custom headers turn one permission decision into many repeated network round trips.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that cached permission is scoped permission. A positive answer for one origin does not authorize a different origin. A positive answer for `PUT` does not authorize `DELETE`. A positive answer for `Authorization` does not necessarily authorize every custom header. A positive answer in one network partition does not become a universal browser permission. That exact scoping is why the cache can reduce latency without becoming a broad security bypass.',
        'It also works because the actual request is delayed until after the permission check. The server can state its cross-origin policy before receiving the non-simple method and headers from script. The browser enforces the decision locally. Servers still need authentication and authorization, but CORS adds an origin-aware browser gate in front of script-level cross-origin access.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The main cost is an extra network round trip on cache misses. On a warm cache, repeated matching requests can skip `OPTIONS`; on a cold cache or a changing request shape, latency returns. Browsers may cap `Access-Control-Max-Age` or evict entries, so a server cannot rely on a long max-age being honored exactly. Preflight can also interact badly with redirects, proxies, local development setups, and inconsistent route-level CORS configuration.',
        'The main design tradeoff is between precise policy and simple request shapes. Custom headers, credentialed requests, and non-simple methods are often necessary, but they expand the permission matrix. Stable header sets and sensible max-age values help. Dynamic origin reflection must be handled carefully, usually with `Vary: Origin`, so shared caches and intermediaries do not mix responses across callers. A broad wildcard may reduce configuration work, but it may express a weaker policy than the API actually needs.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Preflight wins for browser-to-API traffic where cross-origin access is intentional and specific. Single-page apps, hosted admin consoles, dashboards, analytics tools, and browser-based developer tools often need JSON APIs with authorization headers and state-changing methods. Preflight lets the API say which web origins and request shapes are acceptable without giving every script on the internet the same privilege.',
        'It is also useful as an API design feedback loop. If the preflight cache misses constantly, the frontend may be using too many ad hoc custom headers, the server may be varying policy too finely, or max-age may be too low for the interaction pattern. A well-designed CORS setup has predictable request shapes, route policies that match the real security boundary, and monitoring that separates preflight latency from actual API latency.',
      ],
    },
    {
      heading: 'Where it fails (2)',
      paragraphs: [
        'CORS fails as a mental model when people treat it as server authentication. Non-browser clients are not constrained by the browser preflight cache. A command-line client can send the request directly. A backend service can call the API directly. The server must still authorize every sensitive operation. CORS controls browser script access; it does not make an endpoint private.',
        'It also fails when teams expect preflight to cover all cross-site behavior. Simple requests, form posts, navigations, images, iframes, and cookie attachment have their own rules. Some cross-site requests can still be sent even if script cannot read the response. That is why CORS should be studied with SameSite cookies, CSRF defenses, Fetch Metadata, Content Security Policy, and Cross-Origin Isolation. Browser security is a set of overlapping gates, not one universal switch.',
      ],
    },
    {
      heading: 'Where it fails (3)',
      paragraphs: [
        'Common operational failures include forgetting to allow a required header, allowing the method but not the origin, using wildcard origin with credentials, omitting `Vary: Origin` when reflecting origins, setting max-age to zero without realizing every request will preflight, and treating development-only permissive policy as production-safe. Another frequent failure is route drift: one endpoint has the right CORS headers while a neighboring endpoint or error response path does not.',
        'Debugging should start from the request shape. Identify the page origin, target URL, credentials mode, method, requested header names, and whether the browser sent `OPTIONS`. Then inspect the preflight response, not only the final API handler. Many CORS bugs are not application errors at all. They are mismatches between the shape the browser asked to send and the shape the server claimed to allow.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: MDN CORS guide at https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS, MDN preflight request glossary at https://developer.mozilla.org/en-US/docs/Glossary/Preflight_request, MDN Access-Control-Max-Age at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Max-Age, and WHATWG Fetch CORS-preflight cache at https://fetch.spec.whatwg.org/#cors-preflight-cache.',
        'Study URL Origin Parser Case Study for origin comparison, HTTP Vary Cache-Key Normalization for response variation, Browser Cache Partitioning Network Key for partitioned browser storage, SameSite Cookie CSRF Case Study for ambient credential rules, Fetch Metadata Request Gate for server-side request classification, Content Security Policy Nonce Hash Case Study for script control, Cross-Origin Isolation COOP COEP CORP Case Study for stronger embedding boundaries, and Service Workers for the fetch layer that often sits near these decisions in real applications.',
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
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
        'Use this topic as a checkpoint: if you can explain why CORS Preflight Cache moves from input to output in the animation and where it fails, you are ready for the next topic.',
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

