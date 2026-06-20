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
        'The graph traces a request through four decision points: the page, the browser cache, the CDN, and the origin server. The ETag node floats above the main path because the validator is metadata about the body, not the body itself.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Client-server-model.svg/250px-Client-server-model.svg.png',
          alt: 'Client computers communicating with a server through the Internet',
          caption: 'HTTP starts as a client-server request-response exchange. Caching adds a local decision point before the request reaches the origin. Source: Wikimedia Commons, File: Client-server-model.svg.',
        },
        {
          type: 'bullets',
          items: [
            'Found nodes are participants that satisfy the request without forwarding it further. A fresh cache hit lights up the browser node and removes everything downstream.',
            'Active nodes are participants currently evaluating or forwarding the request. When the cache is stale, the active path runs from browser through ETag to origin.',
            'Removed nodes are participants whose work is skipped. On a 304, the body node disappears because no response body transfers. On a fresh hit, CDN and origin both disappear.',
            'Compare nodes are intermediate states waiting for resolution -- a CDN deciding whether its own copy is fresh, or an origin comparing validators.',
          ],
        },
        {
          type: 'callout',
          text: 'The safe inference in every frame is this: a cache can reuse bytes only when either freshness proves the server already allowed reuse, or validation proves the current origin representation still matches the stored one.',
        },
        {
          type: 'note',
          text: 'The "revalidation path" view walks the four outcomes: fresh hit, conditional 304, full 200, and policy routing. The "validator choices" view compares strong vs. weak ETags, Vary keys, conditional headers, and layered cache validation.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Every resource on the web has two identities that are easy to confuse. The URL names the place to ask. The representation is the bytes returned for one request at one moment. /index.html keeps the same URL across deploys. /api/profile/42 keeps the same URL across profile edits. The name is stable; the answer is not.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/Proxy_concept_en.svg/330px-Proxy_concept_en.svg.png',
          alt: 'Two computers communicating through an intermediary proxy server',
          caption: 'A cache is often an intermediary: it can answer on behalf of the origin only when HTTP metadata says that reuse is allowed. Source: Wikimedia Commons, File: Proxy_concept_en.svg.',
        },
        'RFC 9111 draws the governing boundary: a cache can construct a response from storage only when the stored response is fresh, when validation succeeds, or when the protocol explicitly allows a stale response under defined conditions. Revalidation is the common validation path for stable URLs.',
        'Without revalidation, a cache has two choices for mutable stable URLs: always fetch the full body, which is correct but slow, or trust a timer, which is fast until the bytes change early. Revalidation adds a third option: ask the server whether the cached copy is still current, and skip the body transfer when it is.',
        {
          type: 'table',
          headers: ['Strategy', 'Latency on hit', 'Bandwidth', 'Staleness risk'],
          rows: [
            ['Always fetch', 'Full round trip + body', '100% of body every time', 'None'],
            ['Timer-only (max-age)', 'Zero while fresh', 'Zero while fresh', 'Stale until freshness expires if bytes changed early'],
            ['Revalidation (ETag + 304)', 'One round trip, no response body', 'Request + response headers only on 304', 'None after successful validation'],
          ],
        },
        {
          type: 'callout',
          text: 'The first-principles problem is not "make requests faster." It is "avoid moving bytes whose identity has already been proven." Freshness proves this by time. Revalidation proves it by server comparison.',
        },
        'The performance stakes are visible in real web data. The 2025 HTTP Archive Web Almanac reports that secondary pages had better Core Web Vitals pass rates than home pages: 61% vs. 47% on desktop and 56% vs. 45% on mobile. The report names cached information as one contributor. That is the practical payoff: repeat navigations can skip work that the first navigation already paid for.',
        'For a single 85 KB HTML shell, a 304 response saves 85 KB of body transfer every time the shell is unchanged. Across 100,000 repeat navigations, that is about 8.5 GB of response body avoided. The exact latency benefit depends on RTT and protocol overhead, but the bandwidth arithmetic is not subtle.',
        {
          type: 'note',
          text: 'Revalidation is not about caching everything. It is about separating three states: fresh enough to reuse locally, stale but worth checking, and too sensitive to store at all. Each state needs a different Cache-Control directive.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural first attempt is a fixed-time cache with no revalidation:',
        {
          type: 'code',
          language: 'text',
          text: 'Cache-Control: max-age=3600',
          label: 'Cache for one hour, then refetch the full body',
        },
        'This is not a bad idea. Freshness is a lease: the origin says the stored response can be reused for a bounded interval without asking again. For a logo, a font file, a published release artifact, or a feed that intentionally updates on a clock, a freshness lease can be exactly the right tool.',
        'The trouble starts when the update process is not clock-shaped. HTML pages change on deploy. User profiles change on edits. RSS feeds change on publication. API documents change when data mutates. A cache timer measures elapsed seconds, but the hidden variable is representation identity.',
        'The problem surfaces after a deploy. The HTML shell at /index.html references JavaScript bundles by content hash: app.8f31a2.js. After a deploy, the new shell references app.c7e4b1.js. But browsers with a cached copy of the old shell keep requesting app.8f31a2.js -- a file that no longer exists. The user sees a blank screen until the timer expires.',
        {
          type: 'diagram',
          text: [
            '  Timeline:',
            '  t=0    Browser caches /index.html (max-age=3600)',
            '         Shell references app.8f31a2.js',
            '  t=20m  Deploy: new shell references app.c7e4b1.js',
            '         app.8f31a2.js is deleted from the server',
            '  t=25m  User navigates back to the app',
            '         Browser serves cached shell (still "fresh")',
            '         Shell requests app.8f31a2.js --> 404',
            '         App is broken for 35 more minutes',
          ].join('\n'),
          label: 'Timer-only caching breaks on deploy because freshness outlives the representation',
        },
        {
          type: 'bullets',
          items: [
            'Short max-age (e.g. 60s) reduces the stale window but does not eliminate it, and still requires a full body download on every miss.',
            'Long max-age (e.g. 86400s) gives excellent hit rates but creates a 24-hour window where stale HTML can break the app.',
            'max-age=0 or no-cache can force validation on every reuse, but without ETag or Last-Modified the server has no cheap validator to compare and must send a normal 200 body.',
            'Content-hashed filenames solve the problem for build artifacts but cannot apply to stable URLs that users bookmark, share, or link to.',
          ],
        },
        {
          type: 'callout',
          text: 'A max-age value is a guess about future change. An ETag is a test of actual change. Stable mutable URLs need the test.',
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the combination of two constraints that no timer can satisfy simultaneously: stable URLs must be correct immediately after a change, and they must not waste bandwidth when unchanged.',
        {
          type: 'diagram',
          text: [
            '  The dilemma for /index.html:',
            '',
            '  max-age=3600    +-----------+     Broken for up to 1 hour',
            '                  | stale gap |     after every deploy',
            '                  +-----------+',
            '',
            '  max-age=0       +-----------+     Correct, but downloads',
            '  (no ETag)       | full body |     85 KB of identical HTML',
            '                  | every hit |     on every navigation',
            '                  +-----------+',
            '',
            '  no-cache + ETag +-----------+     One round trip, but only',
            '                  | 304       |     headers and 0 response body',
            '                  | or        |     when unchanged; full body',
            '                  | 200 (85K) |     only when actually new',
            '                  +-----------+',
          ].join('\n'),
          label: 'Timer-only caching cannot be both correct and efficient for stable URLs',
        },
        'A timer knows when time passes. It does not know when bytes change. The server knows when bytes change, but it cannot push that knowledge to every browser cache, CDN edge, proxy, service worker, and package manager cache that might hold a copy. The gap between these knowledge boundaries is the wall.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Reverse_proxy_h2g2bob.svg/330px-Reverse_proxy_h2g2bob.svg.png',
          alt: 'Reverse proxy forwarding Internet requests to an internal web server',
          caption: 'Reverse proxies and CDN edges sit between users and origins. Revalidation matters because these intermediaries can answer only when their stored representation is still valid for the request. Source: Wikimedia Commons, File: Reverse_proxy_h2g2bob.svg.',
        },
        {
          type: 'table',
          headers: ['Failure', 'Mechanism', 'Consequence'],
          rows: [
            ['Stale shell after deploy', 'max-age outlives the representation', 'Broken asset references, blank pages'],
            ['Bandwidth waste on unchanged resource', 'No validator, so full body on every miss', 'Slower page loads, higher origin bandwidth'],
            ['Wrong variant served', 'Missing Vary header in cache key', 'Gzipped body served to client expecting Brotli, or English served to French user'],
            ['Private data in shared cache', 'Missing private or no-store directive', 'User A sees User B profile from CDN cache'],
          ],
        },
        {
          type: 'callout',
          text: 'The invariant is: a cache may reuse a stored response only if freshness or successful validation proves the representation is current for the exact request variant. Every failure above breaks freshness, identity, variant selection, or storage policy.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A cached response can carry a validator -- an opaque token chosen by the server that identifies the selected representation. When the cache needs to check freshness, it sends the validator back to the server in a conditional request header. The server compares the token against the current representation and answers with either "still valid" (304, no response body) or "replaced" (200, new body, new token).',
        {
          type: 'diagram',
          text: [
            '  First request:',
            '    Browser ---GET /index.html---> Origin',
            '    Browser <--200, ETag:"v12"---- Origin',
            '    Browser stores body + "v12"',
            '',
            '  Second request (stale):',
            '    Browser ---GET /index.html---> Origin',
            '              If-None-Match:"v12"',
            '    Browser <--304 Not Modified--- Origin   (no body)',
            '    Browser reuses stored body, updates metadata',
            '',
            '  After deploy:',
            '    Browser ---GET /index.html---> Origin',
            '              If-None-Match:"v12"',
            '    Browser <--200, ETag:"v13"---- Origin   (new body)',
            '    Browser replaces stored body + "v13"',
          ].join('\n'),
          label: 'The validator turns "is my copy still good?" into a yes/no question the server answers cheaply',
        },
        'The insight is that identity comparison is cheaper than content transfer. An ETag is often tens of bytes. The body it validates can be kilobytes, megabytes, or more. A 304 response still has status, headers, framing, and connection costs, but it has no response body. The cache pays a round trip and saves the dominant payload when the representation has not changed.',
        {
          type: 'callout',
          text: 'ETags are opaque by design. The client does not interpret "v12" as a version number or hash. The server owns the equality rule, and the client only asks whether the validator still matches.',
        },
        {
          type: 'note',
          text: 'RFC 9110 distinguishes strong and weak validators. A strong ETag requires byte-for-byte identity for the selected representation. A weak ETag such as W/"v12" allows semantic equivalence and is fine for cache validation, but it is not strong enough for byte-range resume with If-Range.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The cache evaluates a stored response through four gates: storage policy, cache key, freshness, and validation. Skipping any gate is how cache bugs become user-visible correctness bugs.',
        {
          type: 'diagram',
          text: [
            '  Request arrives',
            '      |',
            '      v',
            '  [Cache lookup by URI + Vary key]',
            '      |',
            '  No stored response? -----> Forward to origin (full fetch)',
            '      |',
            '  Stored response found',
            '      |',
            '      v',
            '  [Freshness check: age < max-age?]',
            '      |              |',
            '    Fresh           Stale',
            '      |              |',
            '  Serve locally   [Has validator (ETag or Last-Modified)?]',
            '  (no network)       |              |',
            '                   Yes             No',
            '                    |               |',
            '              Send conditional    Full fetch',
            '              GET with            (validator-less',
            '              If-None-Match        revalidation',
            '                    |              impossible)',
            '                    v',
            '              [Server compares]',
            '                |          |',
            '              Match      No match',
            '                |          |',
            '             304         200',
            '             (reuse      (replace',
            '              body)       body)',
          ].join('\n'),
          label: 'The full cache decision tree from request to response',
        },
        {
          type: 'callout',
          text: 'The cache key is not just the URL. RFC 9111 starts with method plus target URI, then Vary can add request headers such as Accept-Encoding or Accept-Language. If the key is wrong, a perfect ETag still protects the wrong object.',
        },
        {
          type: 'table',
          headers: ['Step', 'Cache action', 'Network cost', 'State change'],
          rows: [
            ['1. Storage policy', 'Reject no-store, unsafe shared-cache cases, and uncacheable methods/statuses', 'None', 'Decide whether storage is allowed'],
            ['2. Lookup', 'Hash method + target URI + Vary-selected request headers into cache key', 'None', 'Find or miss stored entry'],
            ['3. Freshness', 'Compare response age against max-age, s-maxage, Expires, or heuristic freshness', 'None', 'Decide: serve or validate'],
            ['4. Conditional request', 'Add If-None-Match: <ETag> or If-Modified-Since to outgoing GET/HEAD', '1 round trip, request headers only', 'Server receives validator'],
            ['5a. 304 path', 'Update stored metadata (Date, Cache-Control, Expires, ETag, Vary)', 'Headers and framing only', 'Body unchanged, freshness reset'],
            ['5b. 200 path', 'Replace stored body, headers, and validator', 'Full response body', 'New representation cached'],
          ],
        },
        'Freshness is computed from response headers. RFC 9111 defines the calculation: freshness_lifetime comes from max-age (or s-maxage for shared caches, or Expires as fallback). current_age accounts for transit time and time since the response was stored. The response is fresh when current_age < freshness_lifetime.',
        {
          type: 'code',
          language: 'text',
          text: [
            '# Example: response stored 120 seconds ago with max-age=300',
            'freshness_lifetime = 300',
            'current_age        = 120',
            'remaining          = 300 - 120 = 180 seconds',
            '# Response is still fresh -- serve from cache, no network',
            '',
            '# After 301 seconds:',
            'current_age        = 301',
            'remaining          = 300 - 301 = -1',
            '# Response is stale -- must revalidate if validator exists',
          ].join('\n'),
          label: 'Freshness arithmetic: the cache serves locally only while remaining > 0',
        },
        {
          type: 'note',
          text: 'In a response, no-cache does not mean "do not cache." It means "store the response, but do not reuse it without successful validation." no-store means "do not store the response at all." This naming confusion has caused more cache bugs than any other single HTTP detail.',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Revalidation is correct because the server is the authority on representation identity. The cache never decides on its own whether a stale response is still valid. It asks the server, and the server answers based on current state.',
        {
          type: 'bullets',
          items: [
            'Monotonic freshness: a response can only move from fresh to stale, never backward, unless the server explicitly refreshes it via a successful revalidation.',
            'Scoped identity: the ETag is bound to a specific representation of a specific resource. Different Vary variants of the same URL carry different ETags.',
            'Fail-safe default: if a cache has no validator and the response is stale, it must fetch the full body. Revalidation is an optimization available only when the server provides a validator.',
            'Weak comparison safety: RFC 9110 uses weak comparison for If-None-Match, so W/"v7" can match W/"v7". This is safe for cache validation because the question is "is this representation still usable?" not "are these bytes identical enough for a byte range?"',
          ],
        },
        'The correctness argument reduces to: a cached response is served only on one of two paths. Path 1: freshness_lifetime has not expired, meaning the server explicitly authorized reuse for this duration. Path 2: the server confirmed via 304 that the validator still matches current truth. Both paths require server authorization. The cache never unilaterally decides a stale response is good enough.',
        {
          type: 'callout',
          text: 'A 304 is not a miniature 200. It is a proof that the stored body remains usable, plus fresh metadata that extends or updates the cache entry.',
        },
        {
          type: 'note',
          text: 'must-revalidate strengthens the contract: a cache with a stale response must not serve it even under error conditions. Without must-revalidate, a cache is allowed to serve stale responses when it cannot reach the origin (RFC 9111, Section 4.2.4). This distinction matters for CDNs during origin outages.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The three cache outcomes have sharply different costs.',
        {
          type: 'table',
          headers: ['Outcome', 'Network cost', 'Origin CPU', 'Body transfer', 'Typical latency'],
          rows: [
            ['Fresh hit (local)', '0 bytes', 'None', 'None', '<1 ms (disk/memory read)'],
            ['304 Not Modified', 'Conditional request + response headers', 'Validator lookup and comparison', 'None', '1 RTT plus server think time'],
            ['200 OK (full)', 'Request + response headers + full response', 'Full render/query or storage read', 'Full body', '1 RTT + transfer time'],
          ],
        },
        'The 304 path saves body transfer but still pays a round trip. For a 50 ms RTT and an 85 KB HTML shell, the 304 saves about 85 KB of transfer but still costs at least the RTT. For a 500 KB API response, the savings are much larger. For a 200-byte JSON health check, the saved bytes are smaller than the validation overhead and the round trip dominates.',
        'The 2025 Web Almanac shows why that round trip matters: only 55% of desktop sites and 44% of mobile sites had good Time to First Byte, while 12% of desktop sites and 17% of mobile sites were poor. Revalidation is not free latency. It is a trade: pay one server-confirmed trip to avoid moving the body.',
        {
          type: 'diagram',
          text: [
            '  Break-even analysis: when is 304 worth the round trip?',
            '',
            '  Body size vs. saved bandwidth (50 ms RTT assumed):',
            '  200 B   |=                    (headers ~= body; marginal win)',
            '  1 KB    |===                  (small win)',
            '  10 KB   |==========           (clear win)',
            '  100 KB  |===========================  (strong win)',
            '  1 MB    |=========================================  (huge win)',
            '',
            '  Below ~1 KB, stale-while-revalidate or longer max-age',
            '  often outperforms forced revalidation.',
          ].join('\n'),
          label: 'Revalidation value scales with body size; tiny resources may not justify the round trip',
        },
        {
          type: 'callout',
          text: 'A 304 is worth it when saved body bytes or avoided origin work dominate one RTT. It is the wrong default for tiny, cheap, frequently requested resources where the conditional trip costs more than the body.',
        },
        'At CDN scale, validator computation matters. If generating the ETag requires reading the full response body from storage, the origin saves bandwidth but not CPU. Efficient implementations compute validators from stored content hashes, version ids, revision numbers, or object metadata at write time, making revalidation a small lookup and comparison rather than a full render.',
        {
          type: 'note',
          text: 'stale-while-revalidate (RFC 5861) adds a fourth outcome: serve the stale response immediately while revalidating in the background. The user sees instant response; the cache updates asynchronously. This trades consistency for perceived performance.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A production web app serves four resource types, each with a different cache policy chosen by update pattern.',
        {
          type: 'code',
          language: 'text',
          text: [
            '# 1. HTML shell -- stable URL, changes on deploy',
            'GET /index.html',
            'Cache-Control: no-cache',
            'ETag: "shell-v12"',
            '',
            '# 2. JS/CSS bundles -- URL contains content hash',
            'GET /assets/app.8f31a2.js',
            'Cache-Control: max-age=31536000, immutable',
            '',
            '# 3. User avatar -- stable URL, changes on profile edit',
            'GET /avatar/42.jpg',
            'Cache-Control: max-age=300, stale-while-revalidate=86400',
            'ETag: "ava-42-d7e3"',
            '',
            '# 4. Auth token -- must never be stored',
            'GET /api/session',
            'Cache-Control: no-store',
          ].join('\n'),
          label: 'Four resources, four policies: validate, immutable, bounded+SWR, no-store',
        },
        'The user loads the app. The browser fetches /index.html, gets the shell with ETag "shell-v12" and no-cache. It stores the body. On the next navigation, the browser sends If-None-Match: "shell-v12". No deploy has happened, so the server returns 304 with updated Date and the same ETag. The browser reuses the stored 85 KB shell -- zero body bytes transferred.',
        'The shell references /assets/app.8f31a2.js. Because the URL contains the content hash, the server sends max-age=31536000, immutable. RFC 8246 defines immutable as a promise that the representation will not change during its freshness lifetime. The browser can skip even user-driven revalidation while the entry remains fresh. When a deploy produces a new bundle, the new shell references /assets/app.c7e4b1.js -- a different URL. The old bundle is eventually evicted; the new one is fetched fresh.',
        {
          type: 'table',
          headers: ['Resource', 'After deploy (no HTML change)', 'After deploy (HTML changed)', 'After profile edit'],
          rows: [
            ['/index.html', '304 (same shell, reuse body)', '200 (new shell, new ETag)', 'N/A'],
            ['/assets/app.8f31a2.js', 'Fresh hit (immutable)', 'Not requested (new hash in shell)', 'N/A'],
            ['/assets/app.c7e4b1.js', 'N/A', 'Fresh fetch (new URL)', 'N/A'],
            ['/avatar/42.jpg', 'Fresh hit or SWR (within 300s)', 'Fresh hit or SWR', '200 after SWR revalidation detects new ETag'],
            ['/api/session', 'Never cached', 'Never cached', 'Never cached'],
          ],
        },
        {
          type: 'callout',
          text: 'Change the URL when the bytes are immutable. Keep the URL stable when people need a durable link. Attach a validator to every stable mutable URL so stale copies can ask before reusing.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'ETag revalidation earns its cost when stable URLs carry medium-to-large bodies that change at unpredictable times.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/NCDN_-_CDN.svg/250px-NCDN_-_CDN.svg.png',
          alt: 'Single server distribution compared with CDN distribution',
          caption: 'CDN distribution moves cached copies closer to users. Validators decide when each edge copy can keep answering and when it has to ask origin again. Source: Wikimedia Commons, File: NCDN_-_CDN.svg.',
        },
        {
          type: 'table',
          headers: ['Use case', 'Typical body size', 'Why revalidation fits'],
          rows: [
            ['HTML shells (SPAs, docs sites)', '30-150 KB', 'Stable URL, changes on deploy, users navigate repeatedly'],
            ['RSS/Atom feeds', '10-500 KB', 'Stable URL, changes when new post is published, readers poll frequently'],
            ['REST API documents', '1-100 KB', 'Stable endpoint, changes on data mutation, clients poll or refresh'],
            ['User avatars/profile images', '5-200 KB', 'Stable URL, changes on profile edit, shown on many pages'],
            ['Package manifests (npm, pip)', '50 KB-5 MB', 'Stable URL, changes on publish, clients check on every install'],
            ['OpenAPI/Swagger specs', '20-500 KB', 'Stable URL, changes on API deploy, dev tools poll it'],
            ['Configuration/feature flag JSON', '1-50 KB', 'Stable URL, changes on admin edit, apps poll at intervals'],
          ],
        },
        'Layered cache infrastructure amplifies the benefit. A CDN edge node can revalidate against origin once, cache the 304 result, and serve subsequent browser revalidation requests from its own cache. If 10,000 browsers ask the CDN "is /index.html still shell-v12?" within the CDN freshness window, the CDN answers all of them without touching origin.',
        {
          type: 'diagram',
          text: [
            '  Browser A ---- If-None-Match:"v12" ---+',
            '  Browser B ---- If-None-Match:"v12" ---+--> CDN edge',
            '  Browser C ---- If-None-Match:"v12" ---+     |',
            '                                              | (one conditional',
            '                                              |  request to origin)',
            '                                              v',
            '                                           Origin',
            '                                           304 --> CDN caches',
            '                                                   result',
            '  CDN answers all 3 browsers with 304',
            '  Origin sees 1 request instead of 3',
          ].join('\n'),
          label: 'CDN shields origin from redundant revalidation requests',
        },
        {
          type: 'callout',
          text: 'Layered caches turn one origin validation into many downstream wins. The protocol value is multiplicative: browser cache saves the user trip; CDN cache saves the origin trip; origin validator saves the body.',
        },
        {
          type: 'note',
          text: 'Conditional requests also power safe concurrent writes via If-Match. A client editing a wiki page sends If-Match: "v12" with its PUT. If another editor already saved v13, the server returns 412 Precondition Failed instead of silently overwriting. Same validator model, different conditional header, different purpose.',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Revalidation has specific failure modes, each caused by a mismatch between cache policy and resource semantics.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Open_proxy_h2g2bob.svg/330px-Open_proxy_h2g2bob.svg.png',
          alt: 'Open proxy forwarding requests between a client and the Internet',
          caption: 'Shared intermediaries are useful only when response metadata prevents cross-user and cross-variant reuse mistakes. Source: Wikimedia Commons, File: Open_proxy_h2g2bob.svg.',
        },
        {
          type: 'table',
          headers: ['Mistake', 'Why it fails', 'Better decision'],
          rows: [
            ['Revalidating content-hashed URLs', 'URL already encodes identity; ETag adds latency without benefit', 'max-age=31536000, immutable'],
            ['ETag on tiny responses (<1 KB)', 'Round trip costs more than saved bytes', 'Longer max-age or stale-while-revalidate'],
            ['ETag that changes every response', 'Date or random nonce in tag destroys hit rate; every stale check returns 200', 'Base ETag on content hash, not metadata'],
            ['Same ETag after content change', 'Cache reuses stale body; user sees old data', 'Recompute ETag from body hash on every write'],
            ['Missing Vary header', 'CDN serves gzipped body to client expecting Brotli', 'Vary: Accept-Encoding (and Accept-Language if localized)'],
            ['no-cache confused with no-store', 'Sensitive data stored and revalidated instead of never stored', 'Use no-store for auth tokens, session data, PII'],
            ['Missing private directive', 'User-specific response stored in shared CDN cache', 'Cache-Control: private for personalized responses'],
          ],
        },
        'The Vary trap deserves special attention. If the origin serves different coded representations for Accept-Encoding: gzip vs. Accept-Encoding: br but omits Vary: Accept-Encoding, a shared cache can store the gzip response under a key that is too broad and later serve it to a client that asked for Brotli. A validator can be perfectly stable and still validate the wrong cache entry if the key omitted the variant dimension.',
        {
          type: 'code',
          language: 'text',
          text: [
            '# Correct: Vary tells caches to key on encoding',
            'HTTP/1.1 200 OK',
            'Content-Encoding: br',
            'Vary: Accept-Encoding',
            'ETag: "doc-v7-br"',
            'Cache-Control: max-age=3600',
            '',
            '# Dangerous: same ETag for different encodings, no Vary',
            'HTTP/1.1 200 OK',
            'Content-Encoding: gzip',
            'ETag: "doc-v7"',
            'Cache-Control: max-age=3600',
            '# A shared cache may serve this gzip body to a Brotli client',
          ].join('\n'),
          label: 'Missing Vary lets a shared cache serve the wrong encoding variant',
        },
        {
          type: 'bullets',
          items: [
            'Do not revalidate resources that should never be stored. Use no-store for auth tokens, session cookies, and PII. Revalidation assumes the cache may keep a copy; no-store says it must not.',
            'Do not use Last-Modified as the sole validator when sub-second changes are possible. Last-Modified has 1-second granularity; two changes within the same second produce the same timestamp but different bodies.',
            'Do not send ETag without understanding weak vs. strong. Range requests and If-Range require strong comparison. Cache validation uses weak comparison. A weak ETag (W/"v7") is safe for cache validation but unsafe for byte-range resume.',
            'Do not ignore s-maxage. Shared caches (CDNs, proxies) use s-maxage instead of max-age. A response with max-age=0, s-maxage=60 revalidates on every browser request but stays fresh in the CDN for 60 seconds.',
          ],
        },
        {
          type: 'callout',
          text: 'Most cache disasters are policy-shape errors, not protocol mystery. HTML, bundles, API responses, avatars, and private data have different identities and therefore need different headers.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'Covers'],
          rows: [
            ['RFC 9111 -- HTTP Caching', 'Freshness calculation, age computation, Cache-Control directives, storage and reuse rules'],
            ['RFC 9110 -- HTTP Semantics', 'ETag definition, conditional request headers (If-None-Match, If-Match, If-Modified-Since), weak vs. strong comparison'],
            ['RFC 8246 -- immutable', 'The immutable Cache-Control extension for versioned URLs whose bytes will not change during the freshness lifetime'],
            ['RFC 5861 -- stale-while-revalidate and stale-if-error', 'Background revalidation extensions to Cache-Control'],
            ['RFC 9211 -- Cache-Status', 'Response header for explaining which cache layer served, forwarded, stored, or revalidated a response'],
            ['HTTP Archive Web Almanac 2025 -- Performance', 'Real web performance context for TTFB, cached secondary navigations, and Core Web Vitals'],
            ['MDN: HTTP Caching', 'Practical guide to Cache-Control, ETag, and browser behavior with examples'],
            ['web.dev: "Prevent unnecessary network requests with the HTTP cache"', 'Decision flowchart for choosing cache headers per resource type'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: LRU Cache -- understand eviction policy before reasoning about what stays in a cache and what gets replaced.',
            'Extension: CDN Stale-While-Revalidate Shield -- how CDN layers use background revalidation to serve stale while refreshing asynchronously.',
            'Extension: Cache Invalidation & Versioning -- content-hashed URLs, cache busting, and the relationship between identity-by-name and identity-by-content.',
            'Related: HTTP Vary Cache-Key Normalization -- how Vary headers expand the cache key and the risks of over- or under-specifying dimensions.',
            'Related: Service Workers & Offline-First -- application-level cache that intercepts fetch and applies custom revalidation logic.',
            'Contrast: CORS Preflight Cache -- another conditional reuse pattern where the browser caches permission, not content.',
            'Deeper: Cache-Status HTTP Observability -- the Cache-Status response header for debugging which layer served the response and why.',
          ],
        },
      ],
    },
  ],
};
