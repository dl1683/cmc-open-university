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
      heading: 'What it is',
      paragraphs: [
        'HTTP cache revalidation lets a browser or CDN keep a stored response while asking the origin whether it is still valid. The central records are the cached response, freshness metadata, validator, request cache key, and the conditional request.',
        'ETag is an opaque server-chosen validator. If the cache has an ETag, it can send If-None-Match. A matching validator produces 304 Not Modified, so the cache reuses its body and updates metadata.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'First, freshness is checked. A fresh response can be used without network access. A stale response is not automatically useless; it can be validated. If validation returns 304, the stored body becomes fresh again. If validation returns 200, the cache stores the new representation.',
        'The cache key must include enough request information. Vary tells shared caches which request headers affect the representation. Without the right Vary behavior, one user, language, encoding, or device variant can receive the wrong stored response.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A modern web app uses content-hashed asset names for JavaScript and CSS, then marks those assets immutable. The HTML document keeps a stable URL but uses Cache-Control: no-cache plus ETag, so each navigation can cheaply validate whether the app shell changed. User-private API responses use no-store or carefully scoped private caching.',
        'This is the HTTP-level continuation of Cache Invalidation & Versioning. Versioned names avoid validation for immutable assets; ETag revalidation handles mutable stable URLs such as HTML, feeds, and API documents.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'no-cache does not mean never store. It means the stored response must be validated before reuse. no-store is the directive for responses that should not be stored. max-age=0 also forces immediate staleness but still permits validation.',
        'Do not generate unstable ETags that change when bytes did not meaningfully change. Do not forget Vary on compressed, localized, or negotiated representations. Do not cache authorization-scoped data in a shared cache unless the key and headers make that scope explicit.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RFC 9111 HTTP Caching at https://www.rfc-editor.org/info/rfc9111/, MDN HTTP caching guide at https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching, MDN Cache-Control at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control, MDN If-None-Match at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/If-None-Match, and MDN ETag at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/ETag. Study Cache Invalidation & Versioning, HTTP Vary Cache-Key Normalization, No-Vary-Search Query Key, Cache-Status HTTP Observability, Resource Hints: Preload & Preconnect, CDN Request Flow, CDN Stale-While-Revalidate Shield, Service Workers & Offline-First, LRU Cache, Query Cache: Stale Time & GC, CSP Nonce & Hash Policy, Subresource Integrity Hash Manifest, and CORS Preflight Cache next.',
      ],
    },
  ],
};
