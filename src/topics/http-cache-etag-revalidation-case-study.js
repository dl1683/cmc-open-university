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
  sections: [
    {
      heading: 'Why revalidation exists',
      paragraphs: [
        'HTTP caching is a promise about reuse. Reuse saves latency, bandwidth, origin CPU, and battery, but a reused response can also be wrong. The hard case is a stable URL whose representation changes over time: /index.html, /feed.xml, /api/profile, /avatar/17.',
        'ETag revalidation exists for that hard case. A cache keeps the old response body, sends the server a validator, and asks whether those bytes are still acceptable. If they are, the server can answer with headers only instead of sending the whole representation again.',
        'The goal is not "cache everything." The goal is to separate three states: fresh enough to use locally, stale but worth validating, and not allowed to store at all.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'One simple policy is to always fetch from the origin. That is correct, but it wastes a full request path and a full response body even when the representation did not change.',
        'The opposite policy is to cache for a fixed time and trust the timer. That is fast while the response is fresh, but it can serve stale data after a deploy, profile edit, permission change, or feed update.',
        'Content-hashed assets avoid this problem by changing the URL when the bytes change. Stable URLs cannot rely on that trick. They need a cheap freshness check.',
      ],
    },
    {
      heading: 'Where naive caching breaks',
      paragraphs: [
        'A cache has no private access to truth. It only has a stored response, a cache key, metadata, and policy. If it guesses, it can send old JavaScript, old HTML that points at missing bundles, or private data to the wrong user through a shared cache.',
        'The failure is usually a missing boundary. Vary might omit a request header that changes the representation. Cache-Control might allow shared storage of a user-specific response. A validator might fail to change when the bytes changed, or change on every response and destroy hit rate.',
      ],
    },
    {
      heading: 'The core idea',
      paragraphs: [
        'A cached response is reusable only if policy says it is fresh or validation succeeds. The ETag is the server-chosen validator for the stored representation. The cache sends If-None-Match with that tag when the response is stale.',
        'The server compares the validator with current truth. If the cached representation is still valid, it returns 304 Not Modified and no response body. If not, it returns a normal 200 response with new bytes and usually a new validator.',
        'Stale does not mean worthless. Stale means "ask before using." Revalidation is the asking step.',
      ],
    },
    {
      heading: 'What a cache record stores',
      paragraphs: [
        'A useful cache entry is more than a blob. It contains the response body, status, headers, cache key, time metadata, freshness lifetime, validator, and restrictions such as private, no-store, no-cache, must-revalidate, and Vary.',
        'Vary is part of correctness. If the origin sends different representations for Accept-Encoding, Accept-Language, or another request header, the cache key must include that dimension. Otherwise a cache can reuse the right URL with the wrong representation.',
        'ETags are opaque. A client should not parse meaning from "abc123" or W/"v7". The origin chooses the tag and defines when two representations count as equivalent for validation.',
      ],
    },
    {
      heading: 'How revalidation works',
      paragraphs: [
        'First, the cache checks whether the stored response is fresh. A fresh response can satisfy the request locally. This is the cheapest path: no network, no origin comparison, no response body transfer.',
        'If the response is stale and has an ETag, the cache sends a conditional GET or HEAD with If-None-Match. The request says: "I have a stored representation with this validator; send the body only if it is no longer valid."',
        'A 304 response updates the stored response metadata and lets the cache reuse its body. A 200 response replaces the stored representation. The body transfer happens only on the path where the validator no longer matches.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A browser loads /index.html and stores the body with ETag "shell-v12" and Cache-Control: no-cache. On the next navigation, no-cache does not mean "do not store." It means the browser must validate before reuse.',
        'The browser sends If-None-Match: "shell-v12". If the deploy did not change the HTML, the server returns 304 with updated Date, Cache-Control, ETag, and Vary metadata. The browser reuses the old body and avoids downloading the HTML.',
        'If the deploy changed the shell to point at new hashed bundles, the server returns 200 with the new HTML and ETag "shell-v13". The old cached shell is replaced because the stable URL now names a different representation.',
      ],
    },
    {
      heading: 'How to read the visualization',
      paragraphs: [
        'In the revalidation-path view, the first frame is the local-hit case. The browser cache is highlighted and the CDN, origin, and body nodes disappear because freshness alone is enough.',
        'When the browser cache turns stale, follow the ETag edge instead of the body edge. The important state change is that the cache sends a question about identity before it sends or receives representation bytes.',
        'The 304 frame removes the body path on purpose. That is the win: the origin or CDN confirms validity, the cache updates metadata, and the stored body survives. The 200 frame is the opposite branch: the validator failed, so the body must be replaced.',
        'In the validator-choices view, read the matrix as a set of cache-key and validator hazards. Strong tags, weak tags, Last-Modified, Vary, and no validator all change how much trust the cache can put in the stored response.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The cache does not prove freshness by itself. It delegates that decision to the server or authoritative cache that can compare the validator with current representation state.',
        'The invariant is scoped identity. The stored body can be reused only for the same cache key, under compatible Vary dimensions, within the allowed cache policy, and after either freshness or validation says it is valid.',
        'Weak validators still work for ordinary cache validation because If-None-Match uses weak comparison. They are not a license to ignore byte-level needs everywhere. Range requests, resumable downloads, and byte identity need stricter thinking.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'A fresh local hit is O(1) local work relative to the resource size. Revalidation still pays a round trip and a server-side comparison, but it avoids transferring S bytes of body when the representation is unchanged. The larger S is, the more valuable a 304 becomes.',
        'At CDN scale, short freshness lifetimes can turn into many conditional requests. That is cheaper than many full downloads, but it can still become origin load if the CDN cannot answer validation from its own cache state.',
        'Validators have failure costs. A tag that changes every response causes avoidable 200s. A tag that fails to change after a meaningful representation change causes stale reuse. A missing Vary key can serve the wrong variant even when the ETag is perfect.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'ETag revalidation is a good fit for stable URLs with medium or large bodies and unpredictable updates: HTML shells, feeds, documentation pages, avatars, API documents, manifests, and configuration files.',
        'It pairs cleanly with immutable assets. Serve app.8f31.js and styles.91aa.css with long max-age and immutable because the names change with the bytes. Serve /index.html with revalidation because the name stays stable while its contents point at the current asset names.',
        'It also helps shared infrastructure. A browser can validate with a CDN, and the CDN can validate with origin. Good headers let each layer answer the cheapest question it is authorized to answer.',
      ],
    },
    {
      heading: 'Where it is the wrong tool',
      paragraphs: [
        'Use no-store for responses that should not be stored, especially sensitive user data. Revalidation does not erase copies that should never have been kept.',
        'Use content-hashed names for immutable build artifacts. Revalidating a file whose URL already contains the content hash adds latency without much benefit.',
        'Avoid revalidation when producing the validator is almost as expensive as producing the body, or when the representation is so tiny that the extra request path costs more than the saved bytes.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The common semantic trap is no-cache. In HTTP caching, no-cache allows storage but requires successful validation before reuse. no-store is the directive that tells caches not to store the request or response.',
        'The common security trap is shared-cache leakage. Authorization, Cookie, Accept-Language, Accept-Encoding, and other request dimensions can change the representation. If policy and Vary do not describe those dimensions correctly, the cache can reuse a response across the wrong boundary.',
        'The common deployment trap is split policy. HTML, bundles, API responses, and private data need different headers. One blanket Cache-Control policy is usually either slow, stale, or unsafe.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A production web app usually splits resources by update shape. Bundled JavaScript and CSS use content-hashed filenames with long max-age and immutable. The HTML shell keeps a stable URL with ETag and no-cache, so every navigation validates cheaply. Public images or avatars may use bounded freshness plus stale-while-revalidate. User-private API responses use no-store or private caching with strict boundaries.',
        'This is the HTTP version of cache invalidation by identity. Change the name when the bytes are immutable. Keep the name stable when users need a stable link, then attach a validator so stale copies can ask one cheap question before reuse.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: RFC 9111, HTTP Caching, at https://www.rfc-editor.org/rfc/rfc9111; and RFC 9110, HTTP Semantics, at https://www.rfc-editor.org/rfc/rfc9110. Use MDN as a practical companion for Cache-Control, ETag, If-None-Match, and browser behavior.',
        'Study Cache Invalidation & Versioning for identity by name, HTTP Vary Cache-Key Normalization for variant safety, Cache-Status HTTP Observability for debugging cache decisions, CDN Stale-While-Revalidate Shield for layered caches, Service Workers & Offline-First for application-managed caches, LRU Cache for eviction, and CORS Preflight Cache for another conditional reuse pattern.',
      ],
    },
  ],
};
