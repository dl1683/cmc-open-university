// HTTP cache revalidation: freshness, validators, conditional requests, 304
// responses, and the boundary between browser cache, CDN cache, and origin truth.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'http-cache-etag-revalidation-case-study',
  title: 'HTTP Cache ETag Revalidation',
  category: 'Systems',
  summary: 'How browser and CDN caches use freshness, ETag validators, If-None-Match, 304 responses, Vary keys, and Cache-Control to avoid full downloads.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['revalidation path', 'validator choices'], defaultValue: 'revalidation path' },
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

function cacheGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'page', label: 'page', x: 0.9, y: 4.6, note: notes.page ?? 'request' },
      { id: 'browser', label: 'cache', x: 2.7, y: 4.6, note: notes.browser ?? 'stored copy' },
      { id: 'cdn', label: 'CDN', x: 4.7, y: 5.8, note: notes.cdn ?? 'shared' },
      { id: 'origin', label: 'origin', x: 6.9, y: 4.6, note: notes.origin ?? 'truth' },
      { id: 'body', label: 'body', x: 8.8, y: 4.6, note: notes.body ?? 'bytes' },
      { id: 'etag', label: 'ETag', x: 4.7, y: 2.5, note: notes.etag ?? '"abc123"' },
    ],
    edges: [
      { id: 'e-page-browser', from: 'page', to: 'browser', weight: '' },
      { id: 'e-browser-cdn', from: 'browser', to: 'cdn', weight: '' },
      { id: 'e-cdn-origin', from: 'cdn', to: 'origin', weight: '' },
      { id: 'e-origin-body', from: 'origin', to: 'body', weight: '' },
      { id: 'e-browser-etag', from: 'browser', to: 'etag', weight: '' },
      { id: 'e-etag-origin', from: 'etag', to: 'origin', weight: '' },
    ],
  }, { title });
}

function* revalidationPath() {
  yield {
    state: cacheGraph('A fresh cached response needs no network', { browser: 'fresh', page: 'GET /app.css', body: 'not used' }),
    highlight: { found: ['browser', 'e-page-browser'], removed: ['cdn', 'origin', 'body'] },
    explanation: 'If a cached response is still fresh under Cache-Control, the browser can satisfy the request locally. No TCP, no CDN, no origin, no bytes.',
    invariant: 'Freshness decides whether validation is needed at all.',
  };

  yield {
    state: cacheGraph('A stale copy asks a conditional question', { browser: 'stale', etag: 'If-None', origin: 'compare tag' }),
    highlight: { active: ['browser', 'etag', 'origin', 'e-browser-etag', 'e-etag-origin'], compare: ['cdn'] },
    explanation: 'When the stored response is stale but has an ETag, the cache can send If-None-Match. The request asks whether the cached representation is still current.',
  };

  yield {
    state: cacheGraph('304 Not Modified refreshes metadata only', { origin: '304', body: 'no body', browser: 'reuse copy', etag: 'same tag' }),
    highlight: { found: ['origin', 'browser', 'etag'], removed: ['body', 'e-origin-body'] },
    explanation: 'If the validator still matches, the server returns 304 Not Modified. The cache updates response metadata and reuses its stored body instead of downloading it again.',
  };

  yield {
    state: cacheGraph('200 OK replaces the stored body', { origin: 'new tag', body: 'new bytes', browser: 'replace', etag: '"def456"' }),
    highlight: { active: ['origin', 'body', 'browser', 'e-origin-body', 'e-cdn-origin'], compare: ['etag'] },
    explanation: 'If the validator no longer matches, the server returns a normal 200 response with a new body and a new validator. The old cached body is no longer suitable.',
  };

  yield {
    state: labelMatrix(
      'Policy routing',
      [
        { id: 'asset', label: 'asset' },
        { id: 'html', label: 'HTML' },
        { id: 'api', label: 'API' },
        { id: 'private', label: 'private' },
      ],
      [
        { id: 'header', label: 'header' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['immutable', 'no checks'],
        ['no-cache', 'validate'],
        ['max-age', 'bounded'],
        ['no-store', 'no cache'],
      ],
    ),
    highlight: { found: ['asset:header', 'html:header'], removed: ['private:header'] },
    explanation: 'A production site normally combines policies: content-hashed assets are immutable, HTML revalidates, API data gets bounded freshness, and private secrets avoid storage.',
  };
}

function* validatorChoices() {
  yield {
    state: labelMatrix(
      'Validators',
      [
        { id: 'strong', label: 'strong' },
        { id: 'weak', label: 'weak' },
        { id: 'lastmod', label: 'lastmod' },
        { id: 'none', label: 'none' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['byte same', 'best'],
        ['sem same', 'range risk'],
        ['time', '1s gran'],
        ['refetch', 'bandwidth'],
      ],
    ),
    highlight: { found: ['strong:check'], compare: ['weak:risk', 'lastmod:risk'], removed: ['none:risk'] },
    explanation: 'ETags are opaque validators chosen by the server. Strong validators identify byte-equivalent representations; weak validators can mean semantically equivalent but not byte-identical.',
    invariant: 'The cache does not know truth; it knows validators and freshness rules.',
  };

  yield {
    state: cacheGraph('Vary makes the cache key include request headers', { page: 'gzip?', browser: 'Vary key', cdn: 'br/gzip', origin: 'variants', body: 'right bytes' }),
    highlight: { active: ['browser', 'cdn', 'origin', 'e-browser-cdn'], found: ['body'] },
    explanation: 'Vary prevents one stored response from being reused for incompatible requests. Accept-Encoding, language, and authorization-sensitive dimensions must be part of the cache key when they change the representation.',
  };

  yield {
    state: labelMatrix(
      'Conditionals',
      [
        { id: 'none', label: 'If-None' },
        { id: 'match', label: 'If-Match' },
        { id: 'ims', label: 'If-Mod' },
        { id: 'range', label: 'If-Range' },
      ],
      [
        { id: 'use', label: 'use' },
        { id: 'result', label: 'result' },
      ],
      [
        ['cache GET', '304/200'],
        ['safe write', '412/ok'],
        ['time check', '304/200'],
        ['resume', '206/200'],
      ],
    ),
    highlight: { found: ['none:use', 'none:result'], compare: ['match:use'] },
    explanation: 'If-None-Match is the common cache revalidation header for GET and HEAD. Related conditional headers use validators for safe writes, time checks, and range resumption.',
  };

  yield {
    state: cacheGraph('Browser cache and CDN cache can both validate', { browser: 'stale', cdn: 'also stale', origin: '304', etag: 'same' }),
    highlight: { active: ['browser', 'cdn', 'origin', 'e-browser-cdn', 'e-cdn-origin'], found: ['etag'] },
    explanation: 'There may be multiple caches on the path. A browser can validate with a CDN, and the CDN can validate with origin. Good headers make each layer predictable.',
  };

  yield {
    state: labelMatrix(
      'Deployment recipe',
      [
        { id: 'bundle', label: 'bundle' },
        { id: 'html', label: 'HTML' },
        { id: 'avatar', label: 'avatar' },
        { id: 'auth', label: 'auth' },
      ],
      [
        { id: 'name', label: 'name' },
        { id: 'policy', label: 'policy' },
      ],
      [
        ['hash name', 'immutable'],
        ['same URL', 'revalidate'],
        ['same URL', 'SWR ok'],
        ['user data', 'no-store'],
      ],
    ),
    highlight: { found: ['bundle:policy', 'html:policy'], removed: ['auth:policy'] },
    explanation: 'The complete case study is a deployed web app: hashed bundles cache forever, HTML revalidates by ETag, avatars can be stale-while-revalidate, and authenticated responses are kept out of shared caches.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'revalidation path') yield* revalidationPath();
  else if (view === 'validator choices') yield* validatorChoices();
  else throw new InputError('Pick an HTTP cache view.');
}

export const article = {
  references: [
    { title: 'RFC 9111 -- HTTP Caching', url: 'https://www.rfc-editor.org/rfc/rfc9111' },
    { title: 'RFC 9110 -- HTTP Semantics', url: 'https://www.rfc-editor.org/rfc/rfc9110' },
    { title: 'RFC 8246 -- HTTP Immutable Responses', url: 'https://www.rfc-editor.org/rfc/rfc8246' },
    { title: 'RFC 5861 -- HTTP Cache-Control Extensions for Stale Content', url: 'https://www.rfc-editor.org/rfc/rfc5861' },
    { title: 'RFC 9211 -- The Cache-Status HTTP Response Header Field', url: 'https://www.rfc-editor.org/rfc/rfc9211' },
    { title: 'RFC 7232 -- Conditional Requests (historical, consolidated into RFC 9110)', url: 'https://www.rfc-editor.org/rfc/rfc7232' },
    { title: 'HTTP Archive Web Almanac 2025 -- Performance', url: 'https://almanac.httparchive.org/en/2025/performance' },
    { title: 'MDN: HTTP caching', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching' },
    { title: 'MDN: Cache-Control', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control' },
    { title: 'MDN: ETag', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag' },
    { title: 'web.dev: Prevent unnecessary network requests with the HTTP cache', url: 'https://web.dev/articles/http-cache' },
  ],
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the path as four decision points: page, browser cache, CDN, and origin server. An ETag is a validator, which means metadata that names a representation well enough for the server to compare it later.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Client-server-model.svg/250px-Client-server-model.svg.png',
          alt: 'Client computers communicating with a server through the Internet',
          caption: 'HTTP starts as a client-server request-response exchange. Caching adds a local decision point before the request reaches the origin. Source: Wikimedia Commons, File: Client-server-model.svg.',
        },
        'Found nodes satisfy the request without forwarding it farther. Active nodes are evaluating freshness or validation, and removed nodes are skipped because a fresh hit or 304 response avoided downstream work.',
        {
          type: 'callout',
          text: 'The safe inference in every frame is this: a cache can reuse bytes only when either freshness proves the server already allowed reuse, or validation proves the current origin representation still matches the stored one.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A URL names where to ask, while a representation is the bytes returned for one request at one time. The URL /index.html can stay stable across deploys even when the HTML bytes change.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/Proxy_concept_en.svg/330px-Proxy_concept_en.svg.png',
          alt: 'Two computers communicating through an intermediary proxy server',
          caption: 'A cache is often an intermediary: it can answer on behalf of the origin only when HTTP metadata says that reuse is allowed. Source: Wikimedia Commons, File: Proxy_concept_en.svg.',
        },
        'Revalidation exists for stable mutable URLs. The cache can ask the server whether its stored representation is still current, and the server can answer 304 Not Modified without sending the body.',
        {
          type: 'callout',
          text: 'The first-principles problem is not "make requests faster." It is "avoid moving bytes whose identity has already been proven." Freshness proves this by time. Revalidation proves it by server comparison.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a timer: Cache-Control max-age=3600 says the cached response can be reused for one hour. That is a good fit for files whose bytes are meant to stay the same during that lease.',
        'The timer fails for stable URLs that change unpredictably. HTML shells, profile documents, feeds, package manifests, and API responses can change before the lease expires, but the cache has no way to know from time alone.',
        {
          type: 'callout',
          text: 'A max-age value is a guess about future change. An ETag is a test of actual change. Stable mutable URLs need the test.',
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that stable mutable URLs need two properties at once. They must be correct immediately after the representation changes, and they must avoid moving the full body when nothing changed.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Reverse_proxy_h2g2bob.svg/330px-Reverse_proxy_h2g2bob.svg.png',
          alt: 'Reverse proxy forwarding Internet requests to an internal web server',
          caption: 'Reverse proxies and CDN edges sit between users and origins. Revalidation matters because these intermediaries can answer only when their stored representation is still valid for the request. Source: Wikimedia Commons, File: Reverse_proxy_h2g2bob.svg.',
        },
        'A timer knows that seconds passed, not that bytes changed. The origin knows the current bytes, but it cannot push that knowledge to every browser cache, CDN edge, proxy, and service worker that may hold a copy.',
        {
          type: 'callout',
          text: 'The invariant is: a cache may reuse a stored response only if freshness or successful validation proves the representation is current for the exact request variant. Every failure above breaks freshness, identity, variant selection, or storage policy.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is identity comparison instead of body transfer. The server attaches an opaque ETag to a representation, and the cache sends that validator back in If-None-Match when it needs to check a stale entry.',
        'If the validator still matches, the server returns 304 with no response body. If it does not match, the server returns 200 with the new body and a new validator.',
        {
          type: 'callout',
          text: 'ETags are opaque by design. The client does not interpret "v12" as a version number or hash. The server owns the equality rule, and the client only asks whether the validator still matches.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A cache evaluates storage policy, cache key, freshness, and validation. Storage policy decides whether a response can be kept, the cache key decides which stored object matches, freshness decides whether local reuse is allowed, and validation asks the origin about stale entries.',
        {
          type: 'callout',
          text: 'The cache key is not just the URL. RFC 9111 starts with method plus target URI, then Vary can add request headers such as Accept-Encoding or Accept-Language. If the key is wrong, a perfect ETag still protects the wrong object.',
        },
        'When freshness expires and a validator exists, the cache sends a conditional GET with If-None-Match. A 304 updates metadata such as Date, Cache-Control, Expires, ETag, and Vary while reusing the stored body; a 200 replaces body and metadata.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Revalidation is correct because the server remains the authority on representation identity. The cache does not decide that a stale response is still good; it asks the origin or an authorized cache layer to compare the validator.',
        'There are only two safe reuse paths. Freshness means the server already authorized reuse for a time window, and 304 means the server confirmed the stored body still matches current truth.',
        {
          type: 'callout',
          text: 'A 304 is not a miniature 200. It is a proof that the stored body remains usable, plus fresh metadata that extends or updates the cache entry.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A fresh hit costs no network trip, a 304 costs one conditional round trip with no response body, and a 200 costs a request, response headers, and the full body. Revalidation saves bandwidth but not all latency.',
        'For an 85 KB HTML shell, 100,000 unchanged revalidations avoid about 8.5 GB of response body transfer. For a 200-byte health check, the saved body may be smaller than the conditional request overhead.',
        {
          type: 'callout',
          text: 'A 304 is worth it when saved body bytes or avoided origin work dominate one RTT. It is the wrong default for tiny, cheap, frequently requested resources where the conditional trip costs more than the body.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'ETag revalidation fits stable URLs with medium or large bodies that change unpredictably: HTML shells, API documents, RSS feeds, avatars, package manifests, OpenAPI specs, and feature-flag JSON.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/NCDN_-_CDN.svg/250px-NCDN_-_CDN.svg.png',
          alt: 'Single server distribution compared with CDN distribution',
          caption: 'CDN distribution moves cached copies closer to users. Validators decide when each edge copy can keep answering and when it has to ask origin again. Source: Wikimedia Commons, File: NCDN_-_CDN.svg.',
        },
        'Layered caches multiply the benefit. A CDN edge can validate once against origin, then answer many browser revalidation requests with the same result while the edge entry remains usable.',
        {
          type: 'callout',
          text: 'Layered caches turn one origin validation into many downstream wins. The protocol value is multiplicative: browser cache saves the user trip; CDN cache saves the origin trip; origin validator saves the body.',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Revalidation fails when the resource should not be stored at all. Auth tokens, session responses, and sensitive account data need no-store or strict private policy, not an ETag that invites caches to keep a copy.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Open_proxy_h2g2bob.svg/330px-Open_proxy_h2g2bob.svg.png',
          alt: 'Open proxy forwarding requests between a client and the Internet',
          caption: 'Shared intermediaries are useful only when response metadata prevents cross-user and cross-variant reuse mistakes. Source: Wikimedia Commons, File: Open_proxy_h2g2bob.svg.',
        },
        'It also fails when validators are unstable or wrong. An ETag that changes every response makes every stale check return 200, while an ETag that stays the same after body changes makes caches reuse stale bytes.',
        {
          type: 'callout',
          text: 'Most cache disasters are policy-shape errors, not protocol mystery. HTML, bundles, API responses, avatars, and private data have different identities and therefore need different headers.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A web app serves /index.html with Cache-Control no-cache and ETag "shell-v12". The browser stores the 85 KB body and, on the next navigation, sends If-None-Match: "shell-v12".',
        'If no deploy happened, the server returns 304 and the browser transfers zero body bytes while reusing the stored shell. If a deploy changed the shell, the server returns 200 with ETag "shell-v13" and the new body.',
        {
          type: 'callout',
          text: 'Change the URL when the bytes are immutable. Keep the URL stable when people need a durable link. Attach a validator to every stable mutable URL so stale copies can ask before reusing.',
        },
        'The same app serves /assets/app.8f31a2.js with a content hash in the URL and Cache-Control max-age=31536000, immutable. That bundle does not need repeated validation because a byte change creates a new URL such as /assets/app.c7e4b1.js.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are RFC 9111 for HTTP caching, RFC 9110 for validators and conditional requests, RFC 8246 for immutable, RFC 5861 for stale-while-revalidate, RFC 9211 for Cache-Status, MDN HTTP caching, MDN Cache-Control, MDN ETag, and web.dev HTTP cache guidance.',
        'Study HTTP Vary Cache-Key Normalization, Cache Invalidation and Versioning, CDN Stale-While-Revalidate Shield, Service Workers and Offline-First, CORS Preflight Cache, LRU Cache, and Cache-Status HTTP Observability next.',
      ],
    },
  ],
};
