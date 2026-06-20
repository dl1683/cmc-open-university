// No-Vary-Search: normalize URL query parameters for cache matching when
// tracking or ordering parameters do not change the response representation.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'no-vary-search-query-key-case-study',
  title: 'No-Vary-Search Query Key',
  category: 'Systems',
  summary: 'How No-Vary-Search tells caches which query parameters can be ignored or reordered when matching otherwise identical HTTP responses.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['query params', 'safety rules'], defaultValue: 'query params' },
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

function searchGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'req', label: 'req', x: 0.8, y: 4.8, note: notes.req ?? '/page?utm' },
      { id: 'url', label: 'URL', x: 2.4, y: 6.0, note: notes.url ?? 'path' },
      { id: 'params', label: 'params', x: 2.4, y: 3.4, note: notes.params ?? 'search' },
      { id: 'nvs', label: 'NVS', x: 4.4, y: 4.8, note: notes.nvs ?? 'rules' },
      { id: 'canon', label: 'canon', x: 6.1, y: 4.8, note: notes.canon ?? 'key' },
      { id: 'cache', label: 'cache', x: 7.6, y: 4.8, note: notes.cache ?? 'lookup' },
      { id: 'hit', label: 'hit', x: 9.1, y: 6.0, note: notes.hit ?? 'reuse' },
      { id: 'miss', label: 'miss', x: 9.1, y: 3.4, note: notes.miss ?? 'fetch' },
    ],
    edges: [
      { id: 'e-req-url', from: 'req', to: 'url', weight: '' },
      { id: 'e-req-params', from: 'req', to: 'params', weight: '' },
      { id: 'e-url-nvs', from: 'url', to: 'nvs', weight: '' },
      { id: 'e-params-nvs', from: 'params', to: 'nvs', weight: '' },
      { id: 'e-nvs-canon', from: 'nvs', to: 'canon', weight: '' },
      { id: 'e-canon-cache', from: 'canon', to: 'cache', weight: '' },
      { id: 'e-cache-hit', from: 'cache', to: 'hit', weight: '' },
      { id: 'e-cache-miss', from: 'cache', to: 'miss', weight: '' },
    ],
  }, { title });
}

function cacheFragmentPlot() {
  return plotState({
    axes: { x: { label: 'tracked URLs', min: 1, max: 8 }, y: { label: 'cache hits', min: 0, max: 100 } },
    series: [
      { id: 'raw', label: 'raw query', points: [{ x: 1, y: 90 }, { x: 2, y: 64 }, { x: 4, y: 38 }, { x: 6, y: 25 }, { x: 8, y: 16 }] },
      { id: 'nvs', label: 'NVS key', points: [{ x: 1, y: 90 }, { x: 2, y: 88 }, { x: 4, y: 86 }, { x: 6, y: 84 }, { x: 8, y: 82 }] },
    ],
    markers: [
      { id: 'many', x: 6, y: 25, label: 'fragment' },
      { id: 'same', x: 6, y: 84, label: 'reuse' },
    ],
  }, { title: 'Ignored parameters reduce cache fragmentation' });
}

function* queryParams() {
  yield {
    state: searchGraph('Tracking parameters fragment an otherwise identical page', { req: '?utm=a', params: 'utm,ref', canon: 'full URL', cache: 'cold' }),
    highlight: { active: ['req', 'params', 'canon', 'cache', 'miss', 'e-req-params', 'e-nvs-canon', 'e-canon-cache', 'e-cache-miss'], compare: ['hit'] },
    explanation: 'Ordinary HTTP cache keys include the target URI, including the query string. If utm_source changes but the HTML body does not, the cache can still treat every tracked URL as a separate object.',
    invariant: 'Query normalization is safe only when ignored parameters do not change the response representation.',
  };

  yield {
    state: searchGraph('No-Vary-Search declares which search parameters do not matter', { nvs: 'params=utm', params: 'utm,ref', canon: 'drop utm' }),
    highlight: { active: ['params', 'nvs', 'canon', 'e-params-nvs', 'e-nvs-canon'], found: ['url'] },
    explanation: 'No-Vary-Search is a response header. It gives cache-matching rules for search parameters, so future URLs can match a stored response even when ignored parameters differ.',
  };

  yield {
    state: searchGraph('Canonicalization rewrites the cache lookup key', { req: '?utm=b', nvs: 'ignore utm', canon: '/page', cache: 'lookup' }),
    highlight: { active: ['req', 'params', 'nvs', 'canon', 'cache', 'e-req-params', 'e-params-nvs', 'e-nvs-canon', 'e-canon-cache'], compare: ['miss'] },
    explanation: 'The request URL does not change for the user. The cache lookup key changes: ignored query fields are removed or key order is normalized before matching the stored response.',
  };

  yield {
    state: searchGraph('The second campaign URL can reuse the first response', { cache: 'found', hit: 'same HTML', miss: 'skip' }),
    highlight: { found: ['cache', 'hit', 'e-cache-hit'], removed: ['miss'], active: ['canon'] },
    explanation: 'If /article?utm_source=a and /article?utm_source=b produce the same response, a No-Vary-Search rule can turn a needless miss into a hit.',
  };

  yield {
    state: labelMatrix(
      'Rule vocabulary',
      [
        { id: 'params', label: 'params' },
        { id: 'except', label: 'except' },
        { id: 'order', label: 'key-order' },
        { id: 'none', label: 'none' },
      ],
      [
        { id: 'means', label: 'means' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['ignore list', 'wrong body'],
        ['keep list', 'too broad'],
        ['sort keys', 'dupes'],
        ['full URL', 'fragment'],
      ],
    ),
    highlight: { found: ['params:means', 'order:means'], compare: ['except:risk'], removed: ['none:risk'] },
    explanation: 'The data structure is a canonicalizer over URLSearchParams. The header can name ignored parameters, keep only exceptions, and decide whether parameter order matters.',
  };
}

function* safetyRules() {
  yield {
    state: labelMatrix(
      'Parameter audit',
      [
        { id: 'utm', label: 'utm' },
        { id: 'variant', label: 'variant' },
        { id: 'page', label: 'page' },
        { id: 'sort', label: 'sort' },
        { id: 'debug', label: 'debug' },
      ],
      [
        { id: 'body', label: 'body' },
        { id: 'rule', label: 'rule' },
      ],
      [
        ['same', 'ignore'],
        ['changes', 'keep'],
        ['changes', 'keep'],
        ['changes', 'keep'],
        ['same?', 'measure'],
      ],
    ),
    highlight: { found: ['utm:rule'], compare: ['debug:rule'], removed: ['variant:rule', 'page:rule', 'sort:rule'] },
    explanation: 'Start with an audit, not a guess. Analytics parameters may be ignorable, but variant, pagination, filtering, and sort parameters usually change server-rendered output.',
    invariant: 'Never ignore a parameter until the origin contract says it cannot change the body, headers, or permissions.',
  };

  yield {
    state: searchGraph('A product variant parameter must stay in the key', { params: 'color=red', nvs: 'keep', canon: '/p?color', cache: 'separate' }),
    highlight: { active: ['params', 'nvs', 'canon', 'cache', 'miss', 'e-params-nvs', 'e-nvs-canon', 'e-cache-miss'], removed: ['hit'] },
    explanation: 'If color=red changes the rendered product page, ignoring it would serve the wrong variant. No-Vary-Search is a correctness tool only when the correctness decision is already known.',
  };

  yield {
    state: searchGraph('key-order handles equivalent parameter ordering', { req: '?b=2&a=1', nvs: 'key-order', canon: '?a=1&b=2', cache: 'match' }),
    highlight: { active: ['req', 'params', 'nvs', 'canon', 'cache', 'e-req-params', 'e-params-nvs', 'e-nvs-canon'], found: ['hit'] },
    explanation: 'Some URLs differ only by search-parameter order. A key-order rule can canonicalize equivalent maps without ignoring values that still matter.',
  };

  yield {
    state: cacheFragmentPlot(),
    highlight: { found: ['nvs', 'same'], removed: ['raw'], compare: ['many'] },
    explanation: 'The operational payoff is fewer duplicate entries for the same representation. Hit ratio stays high as campaign links multiply, while important content-changing parameters remain keyed.',
  };

  yield {
    state: labelMatrix(
      'Rollout checklist',
      [
        { id: 'scope', label: 'scope' },
        { id: 'test', label: 'test' },
        { id: 'status', label: 'status' },
        { id: 'fallback', label: 'fallback' },
      ],
      [
        { id: 'do', label: 'do' },
        { id: 'why', label: 'why' },
      ],
      [
        ['one path', 'limit risk'],
        ['diff body', 'prove same'],
        ['observe', 'hit ratio'],
        ['normal key', 'compat'],
      ],
    ),
    highlight: { found: ['test:do', 'status:do'], compare: ['fallback:why'] },
    explanation: 'The complete case is an article site: ignore UTM fields on article pages, prove bodies match in logs, watch Cache-Status and origin traffic, and rely on ordinary URL keys in browsers or caches that do not support the experimental header.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'query params') yield* queryParams();
  else if (view === 'safety rules') yield* safetyRules();
  else throw new InputError('Pick a No-Vary-Search view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation traces a cache lookup pipeline. A request URL enters on the left, splits into its path and query parameters, passes through a No-Vary-Search canonicalization rule, and resolves to a cache hit or miss on the right.',
        {
          type: 'bullets',
          items: [
            'Active nodes are the stage currently executing: the parameter being evaluated, the rule being applied, or the cache slot being checked.',
            'Found nodes are stages that resolved successfully -- a rule matched, a canonical key was produced, or the cache returned a stored response.',
            'Compare nodes are unresolved constraints: parameters not yet classified as ignorable or significant.',
            'Removed nodes are outcomes the rule eliminated -- a cache miss that became a hit, or a parameter stripped from the lookup key.',
          ],
        },
        'Switch between "query params" (the canonicalization pipeline) and "safety rules" (the parameter audit that decides which fields are safe to ignore). The first view shows the mechanism; the second shows the judgment that makes the mechanism correct.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'HTTP caches key on the full target URI, including every byte of the query string. That is correct by default -- two different URLs might return two different responses. But query strings carry more than content selection. A single article page might be reached through dozens of campaign links, each appending its own tracking fields.',
        {
          type: 'code',
          language: 'text',
          text: [
            '/story?id=42&utm_source=newsletter&utm_medium=email',
            '/story?id=42&utm_source=twitter&utm_campaign=launch',
            '/story?id=42&utm_source=facebook&fbclid=abc123',
            '/story?id=42&gclid=xyz789',
            '',
            'All four URLs return the same HTML. The server ignores everything except id=42.',
            'The cache stores four separate entries for one representation.',
          ].join('\n'),
          label: 'Four cache entries, one response body',
        },
        'This is query-key fragmentation. Each tracking parameter combination creates a distinct cache key even though the response bytes are identical. Hit ratio drops in proportion to the number of campaign variants. Origin traffic rises. Users wait for network round trips that a warm cache should have prevented.',
        {
          type: 'note',
          text: 'A major news site running 12 campaign variants per article across 5 platforms can fragment a single article into 60 cache entries. Multiply by thousands of articles and the cache becomes a graveyard of duplicates.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first instinct is to keep the default: key on the full URL, accept the fragmentation, and let cache eviction handle the duplicates. This is safe but wasteful. It works until origin load or CDN storage costs become a problem, or until prefetch and prerender optimizations need to match URLs that differ only by tracking noise.',
        'The second instinct is more dangerous: strip "unimportant" query parameters at the CDN or reverse proxy before cache lookup. This requires the infrastructure to know which parameters matter, and that knowledge lives at the application layer, not the caching layer.',
        {
          type: 'table',
          headers: ['Strategy', 'Safety', 'Hit ratio', 'Problem'],
          rows: [
            ['Full URL key', 'Correct by default', 'Low under fragmentation', 'Wastes cache on duplicates'],
            ['Strip at CDN', 'Risky -- CDN guesses', 'High if guess is right', 'Wrong response if guess is wrong'],
            ['Vary header', 'Correct for request headers', 'N/A for query strings', 'Vary operates on headers, not URL components'],
            ['Cache-Control: no-store', 'Correct but defeats caching', 'Zero', 'Throws out the baby with the bathwater'],
          ],
        },
        'None of these approaches let the origin declare which query parameters are irrelevant to response selection. The CDN guess approach is especially treacherous: a field named "ref" might be a referral tracker on an article page but a database reference on an API endpoint. The same parameter name can be ignorable on one route and load-bearing on another.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The fundamental tension is that cache correctness requires conservative keys, but cache efficiency requires minimal keys. Without a signaling mechanism, the cache must choose between safety (full URL, low hit ratio) and performance (stripped URL, risk of wrong content).',
        {
          type: 'diagram',
          text: [
            '  Origin knows:  "utm_source does not change the response"',
            '  Cache knows:   nothing about parameter semantics',
            '  ',
            '  Gap: no protocol for the origin to tell the cache',
            '       which query dimensions are noise',
            '  ',
            '  Result: cache keys by full URL spelling',
            '          /page?id=1&utm=a  -->  entry A',
            '          /page?id=1&utm=b  -->  entry B  (duplicate body)',
            '          /page?utm=a&id=1  -->  entry C  (duplicate body, different order)',
          ].join('\n'),
          label: 'The knowledge gap between origin and cache',
        },
        'The wall is the missing contract. The origin has the knowledge. The cache has the storage. HTTP had no standard way for the origin to say "these query parameters do not vary the representation" -- until No-Vary-Search.',
        {
          type: 'note',
          text: 'The Vary header solves the mirror-image problem for request headers: it tells the cache which headers DO vary the response. No-Vary-Search completes the picture for query parameters: it tells the cache which parameters do NOT vary the response.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'No-Vary-Search is a response header that declares a canonicalization rule over URLSearchParams. Instead of matching the raw query string byte-for-byte, the cache parses both the stored URL and the incoming URL into parameter sets, applies the origin-declared rule, and compares the canonical results.',
        {
          type: 'quote',
          text: 'The No-Vary-Search HTTP response header specifies a set of rules that define how a URL\'s query parameters will affect cache matching. These rules dictate whether the same URL with different URL parameters should be saved as separate browser cache entries.',
          attribution: 'MDN Web Docs, "No-Vary-Search" reference',
        },
        'The header value is a structured field dictionary (RFC 8941) with three optional directives that compose into a canonicalization algorithm:',
        {
          type: 'table',
          headers: ['Directive', 'Type', 'Effect on cache key'],
          rows: [
            ['params=("a" "b")', 'Inner list', 'Ignore named parameters -- drop them before matching'],
            ['params', 'Boolean true', 'Ignore ALL query parameters -- match on path alone'],
            ['except=("id")', 'Inner list', 'Keep only these parameters -- ignore everything else (requires params=true)'],
            ['key-order', 'Boolean true', 'Sort parameters by key before matching -- order no longer matters'],
          ],
        },
        'The directives compose. A header can ignore specific parameters AND normalize key order in one rule. The cache applies the rule to both the stored response URL and the incoming request URL, then compares the canonical forms.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'When the origin returns a cacheable response, it includes the No-Vary-Search header. The cache stores the response and its canonicalization rule together. On a later request, the cache parses the incoming URL, applies the stored rule, and checks whether the canonical form matches any stored entry.',
        {
          type: 'code',
          language: 'text',
          text: [
            'Step 1: Origin responds to /story?id=42&utm_source=newsletter',
            '',
            '  HTTP/1.1 200 OK',
            '  Cache-Control: public, max-age=3600',
            '  No-Vary-Search: key-order, params=("utm_source" "utm_medium" "utm_campaign" "fbclid" "gclid")',
            '  Content-Type: text/html',
            '',
            '  <html>...article content...</html>',
            '',
            'Step 2: Cache stores the response.',
            '  Stored URL:       /story?id=42&utm_source=newsletter',
            '  Canonical key:    /story?id=42',
            '  Rule:             ignore utm_source, utm_medium, utm_campaign, fbclid, gclid; sort keys',
            '',
            'Step 3: New request arrives for /story?utm_source=facebook&id=42&fbclid=xyz',
            '  Raw URL:          /story?utm_source=facebook&id=42&fbclid=xyz',
            '  Apply rule:       drop utm_source, fbclid; sort remaining keys',
            '  Canonical key:    /story?id=42',
            '  Match:            YES -- serve cached response',
          ].join('\n'),
          label: 'The canonicalization pipeline from request to cache hit',
        },
        'Three properties make this safe:',
        {
          type: 'bullets',
          items: [
            'The origin declares the rule, not the cache. Only the server knows which parameters affect its response.',
            'The user-facing URL never changes. The browser address bar still shows the full URL with tracking parameters. Only the cache lookup key is canonicalized.',
            'Fail-safe defaults. If the header is missing, malformed, or unrecognized, the cache falls back to strict full-URL matching. No silent data corruption.',
          ],
        },
        'The canonicalization follows application/x-www-form-urlencoded parsing rules. Percent-encoded characters are decoded before comparison, so utm%5Fsource and utm_source match. The plus sign decodes to space. Parameter names are compared after full URL decoding, not as raw byte strings.',
      ],
    },
    {
      heading: 'The header syntax',
      paragraphs: [
        'No-Vary-Search uses RFC 8941 structured field dictionaries. The syntax matters because any parse error causes the entire header to be ignored -- a strict fail-safe.',
        {
          type: 'code',
          language: 'text',
          text: [
            '# Ignore specific parameters (denylist)',
            'No-Vary-Search: params=("utm_source" "utm_medium" "fbclid")',
            '',
            '# Ignore ALL parameters (match on path only)',
            'No-Vary-Search: params',
            '',
            '# Ignore all parameters EXCEPT these (allowlist)',
            'No-Vary-Search: params, except=("productId" "variant")',
            '',
            '# Normalize parameter order only',
            'No-Vary-Search: key-order',
            '',
            '# Combined: ignore tracking params and normalize order',
            'No-Vary-Search: key-order, params=("utm_source" "gclid" "ref")',
          ].join('\n'),
          label: 'The five common header forms',
        },
        {
          type: 'note',
          text: 'Parameter lists use space-separated quoted strings inside parentheses, not commas. This is RFC 8941 inner list syntax: params=("a" "b") is correct; params=("a", "b") is a parse error and the entire header is silently dropped.',
        },
        {
          type: 'table',
          headers: ['Form', 'Ignored parameters', 'Kept parameters', 'Order matters?'],
          rows: [
            ['params=("a" "b")', 'a, b', 'Everything else', 'Yes (default)'],
            ['params', 'All', 'None', 'N/A'],
            ['params, except=("id")', 'All except id', 'id only', 'Yes (default)'],
            ['key-order', 'None', 'All', 'No'],
            ['key-order, params=("a")', 'a', 'Everything else', 'No'],
          ],
        },
        'The except directive is only valid when params is boolean true (meaning "ignore all"). If except appears with params=("a" "b"), the header is malformed and silently ignored. This prevents contradictory rules.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Cache identity can be looser than raw URL spelling when the origin proves the representation is identical. The key insight is that a cache key is not "the URL" -- it is "whatever the origin says identifies this response." No-Vary-Search makes that declaration explicit for the query component.',
        'The correctness argument rests on a single invariant:',
        {
          type: 'quote',
          text: 'If parameter P is declared ignorable on route R, then for any two values v1 and v2 of P, the server MUST return byte-identical response bodies and semantically equivalent response headers for R?P=v1 and R?P=v2.',
          attribution: 'Representation equivalence invariant',
        },
        'When this invariant holds, ignoring P during cache matching cannot serve wrong content. When it does not hold -- when P=red returns a red product image and P=blue returns a blue one -- ignoring P is a correctness bug, not a performance tradeoff.',
        'Vary and No-Vary-Search are duals. Vary adds dimensions that matter (request headers). No-Vary-Search removes dimensions that do not matter (query parameters). Both narrow the gap between "every possible request variation" and "the actual dimensions that select a distinct response."',
        {
          type: 'diagram',
          text: [
            '  Full request space:  method + path + query + headers + body',
            '           |',
            '           |-- Cache-Control    --> should we cache at all?',
            '           |-- method + path    --> base cache key',
            '           |-- Vary             --> which request headers matter?  (adds dimensions)',
            '           |-- No-Vary-Search   --> which query params matter?    (removes dimensions)',
            '           |-- validators       --> is the stored copy still fresh?',
            '           v',
            '  Effective cache key:  method + path + significant_params + varied_headers',
          ].join('\n'),
          label: 'Where No-Vary-Search fits in the HTTP cache key construction',
        },
      ],
    },
    {
      heading: 'Speculation Rules and prefetch',
      paragraphs: [
        'No-Vary-Search becomes especially powerful with the Speculation Rules API. When the browser prefetches or prerenders a page, the prefetched URL may not exactly match the URL the user eventually navigates to. Without No-Vary-Search, a prefetch of /product?id=5 cannot be reused when the user clicks a link to /product?id=5&utm_source=email.',
        {
          type: 'code',
          language: 'javascript',
          text: [
            '// Speculation Rules in a <script type="speculationrules"> block',
            '{',
            '  "prefetch": [{',
            '    "urls": ["/product?id=5"],',
            '    "expects_no_vary_search": "params=(\\"utm_source\\" \\"utm_medium\\")"',
            '  }]',
            '}',
            '',
            '// The browser prefetches /product?id=5',
            '// User clicks /product?id=5&utm_source=email',
            '// With No-Vary-Search in the response, the prefetch is reused',
            '// Without it, the prefetch is wasted and a fresh fetch starts',
          ].join('\n'),
          label: 'Speculation Rules use expects_no_vary_search to predict cache matching',
        },
        'The expects_no_vary_search field in speculation rules tells the browser what No-Vary-Search value the response is expected to carry. The browser can start using the prefetched response optimistically, then confirm when the actual header arrives. If the response header does not match the expectation, the browser falls back to a normal fetch.',
        {
          type: 'note',
          text: 'This is the primary production motivation for No-Vary-Search in Chromium. Prefetch and prerender are high-value optimizations -- they can make navigation feel instant. But tracking parameters on clicked links constantly invalidate prefetched responses. No-Vary-Search closes that gap.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A documentation site serves pages at /docs?page=setup. Internal links use clean URLs. External links from email campaigns, social posts, and paid ads each add their own tracking parameters.',
        {
          type: 'table',
          headers: ['Source', 'URL', 'Response body'],
          rows: [
            ['Internal nav', '/docs?page=setup', 'Setup guide HTML'],
            ['Email campaign', '/docs?page=setup&utm_source=email&utm_medium=newsletter', 'Same HTML'],
            ['Twitter link', '/docs?page=setup&utm_source=twitter&ref=t.co', 'Same HTML'],
            ['Google ad', '/docs?page=setup&gclid=abc123', 'Same HTML'],
            ['Different page', '/docs?page=api', 'API reference HTML (different)'],
          ],
        },
        'The server returns:',
        {
          type: 'code',
          language: 'text',
          text: [
            'HTTP/1.1 200 OK',
            'Cache-Control: public, max-age=600',
            'No-Vary-Search: key-order, params=("utm_source" "utm_medium" "utm_campaign" "utm_content" "utm_term" "gclid" "fbclid" "ref")',
            'Vary: Accept-Encoding',
            'Content-Type: text/html; charset=utf-8',
          ].join('\n'),
          label: 'Response headers for a documentation page',
        },
        'After the first request, all four tracking variants resolve to the same canonical key: /docs?page=setup. The cache serves the stored response for each subsequent request without contacting the origin. The "page" parameter stays in the key because it selects different content.',
        'The Vary: Accept-Encoding header works independently -- it keys on the compression format of the request, which is a request-header dimension. No-Vary-Search handles the query-parameter dimension. Both operate on the same cached response without conflict.',
      ],
    },
    {
      heading: 'The parameter audit',
      paragraphs: [
        'The hardest part of deploying No-Vary-Search is not the header syntax. It is the parameter audit: classifying every query parameter on a route family as content-selecting, presentation-selecting, or irrelevant.',
        {
          type: 'table',
          headers: ['Parameter', 'Changes body?', 'Changes headers?', 'Classification', 'Rule'],
          rows: [
            ['id, page, slug', 'Yes', 'Yes (Content-Length)', 'Content-selecting', 'KEEP -- must stay in cache key'],
            ['lang, locale', 'Yes', 'Yes (Content-Language)', 'Content-selecting', 'KEEP -- different language is a different response'],
            ['variant, color, size', 'Yes', 'Maybe', 'Content-selecting', 'KEEP -- different product renderings'],
            ['sort, order, filter', 'Usually yes', 'Rarely', 'Presentation-selecting', 'KEEP unless client-side only'],
            ['preview, draft', 'Yes', 'Yes (auth-gated)', 'Permission-gated', 'KEEP -- draft content differs from published'],
            ['ab, experiment', 'Yes', 'Sometimes', 'A/B test arm', 'KEEP -- wrong experiment arm is a correctness bug'],
            ['utm_source, utm_medium', 'No', 'No', 'Analytics-only', 'IGNORE -- safe to strip from cache key'],
            ['fbclid, gclid', 'No', 'No', 'Click tracking', 'IGNORE -- added by ad platforms, not read by server'],
            ['ref, referrer', 'Usually no', 'No', 'Referral tracking', 'MEASURE -- verify server does not use it for content selection'],
          ],
        },
        {
          type: 'note',
          text: 'The audit must be per-route, not global. A parameter named "ref" might be an analytics referrer tag on article pages but a foreign-key reference on an API endpoint. A global ignore rule for "ref" would corrupt API responses while correctly optimizing article pages.',
        },
        'The audit process:',
        {
          type: 'bullets',
          items: [
            'Extract all query parameter names from server logs for the target route family.',
            'For each parameter, issue two requests that differ only in that parameter value. Diff the response status code, body bytes, Content-Type, Content-Language, Set-Cookie, and any custom headers.',
            'If the diff is empty, the parameter is a candidate for ignoring. If the diff is non-empty, the parameter is content-selecting and must stay in the key.',
            'Test edge cases: null value vs. absent parameter, empty string vs. missing, duplicate parameter names, and percent-encoded variants of the same name.',
            'Document the classification and get sign-off from the team that owns the route. Do not guess.',
          ],
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The runtime cost of No-Vary-Search is a URLSearchParams parse and a key-set comparison on each cache lookup. This is negligible compared to a network round trip -- microseconds vs. milliseconds.',
        {
          type: 'table',
          headers: ['Dimension', 'Without No-Vary-Search', 'With No-Vary-Search'],
          rows: [
            ['Cache entries per page', '1 per unique query string', '1 per unique canonical key'],
            ['Hit ratio (10 campaign variants)', '~10% after first', '~90% after first'],
            ['Origin requests', 'Proportional to URL variants', 'Proportional to distinct content'],
            ['CDN storage', 'Duplicated per variant', 'Deduplicated'],
            ['Prefetch reuse', 'Fails on parameter mismatch', 'Succeeds across tracking variants'],
            ['Deployment effort', 'None', 'Parameter audit + header deployment'],
          ],
        },
        'The real cost is organizational, not computational. The parameter audit requires coordination between the caching team, the application team, and the marketing team. A wrong classification -- ignoring a content-selecting parameter -- is a silent correctness bug that serves wrong content from cache. There is no error code, no exception, no log line. The cache confidently serves stale or mismatched content.',
        {
          type: 'note',
          text: 'The fail-safe design of the header mitigates one class of risk: if the header syntax is invalid, the cache silently ignores it and falls back to strict matching. You get worse performance but correct behavior. The dangerous direction is a valid header with incorrect semantics -- a perfectly parsed rule that ignores a parameter it should keep.',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The worst failure is serving the wrong response. If color=red and color=blue produce different product pages but the No-Vary-Search rule ignores "color", users see the wrong product. This is not a cache miss -- it is a cache lie. The response looks valid, returns 200, and renders correctly. It is just the wrong content.',
        {
          type: 'diagram',
          text: [
            '  Request 1:  /product?id=7&color=red     -->  cache stores RED page',
            '  Request 2:  /product?id=7&color=blue    -->  cache serves RED page  <-- BUG',
            '  ',
            '  Rule:  No-Vary-Search: params=("color")  <-- WRONG: color selects content',
            '  ',
            '  The user sees a red product when they asked for blue.',
            '  No error. No warning. No log. Just wrong content served with 200 OK.',
          ].join('\n'),
          label: 'The silent corruption failure mode',
        },
        'Other failure modes:',
        {
          type: 'bullets',
          items: [
            'Misunderstanding the header as cache-busting. No-Vary-Search does the opposite -- it makes caching more aggressive. Using it on parameters that should force distinct entries makes the cache collapse entries that should be separate.',
            'Duplicate parameter names. If a URL contains sort=price&sort=date and the server treats these as a list, a key-order rule might reorder them and change the meaning. The spec parses via application/x-www-form-urlencoded which preserves duplicates, but the canonicalization may reorder them.',
            'Order-sensitive server parsing. If the server interprets ?a=1&b=2 differently from ?b=2&a=1 (unusual but possible), a key-order rule will incorrectly merge them.',
            'Parameter interaction effects. utm_source alone may not change content, but utm_source combined with ab_test might trigger different experiment routing. Parameter independence must be verified, not assumed.',
            'Browser support gaps. As of mid-2026, No-Vary-Search is shipped in Chromium-based browsers but experimental or absent in Firefox and Safari. Unsupported browsers fall back to strict matching (safe but unoptimized). CDNs and intermediate caches may not implement it at all.',
          ],
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The highest-value deployment targets are routes with high traffic, high cache-ability, and high tracking-parameter diversity. These are the routes where fragmentation costs the most and where the parameter audit is simplest (because the content-selecting parameters are well-known).',
        {
          type: 'table',
          headers: ['Route family', 'Typical ignore list', 'Why it works'],
          rows: [
            ['News articles', 'utm_*, fbclid, gclid, ref', 'Article content is selected by slug/id only; tracking is purely analytics'],
            ['Documentation pages', 'utm_*, ref, source', 'Docs are static per path; query params are navigation metadata'],
            ['Product listing pages', 'utm_*, fbclid', 'Listing is selected by category/filter; ad tracking does not change results'],
            ['Static landing pages', 'All (params)', 'Page content is fixed; all query params are tracking or A/B routing handled client-side'],
          ],
        },
        {
          type: 'code',
          language: 'text',
          text: [
            '# Rollout checklist for a news article route',
            '',
            '1. Extract query param names from 7 days of access logs for /article/*',
            '2. Classify each param: content-selecting vs analytics-only',
            '3. For analytics-only candidates, diff response bodies across 100 URL pairs',
            '4. Deploy header on staging with params=("utm_source" "utm_medium" "utm_campaign")',
            '5. Monitor: Cache-Status hit ratio, origin request volume, error reports',
            '6. Expand to fbclid, gclid after 48h of clean metrics',
            '7. Add key-order after confirming server is order-insensitive',
            '8. Document the rule in the caching runbook with the parameter audit results',
          ].join('\n'),
          label: 'Conservative rollout sequence',
        },
        'The fallback is always safe. Caches that do not understand the header use strict full-URL matching. This means No-Vary-Search is a progressive enhancement: supporting caches get better hit ratios, unsupporting caches behave exactly as before. No correctness risk from mixed support.',
      ],
    },
    {
      heading: 'Browser support',
      paragraphs: [
        {
          type: 'table',
          headers: ['Engine', 'HTTP disk cache', 'Prefetch cache', 'Speculation Rules'],
          rows: [
            ['Chromium (Chrome, Edge, Opera)', 'Shipped', 'Shipped', 'Full support'],
            ['Firefox', 'Experimental', 'Not yet', 'Not yet'],
            ['WebKit (Safari)', 'No support', 'No support', 'No support'],
          ],
        },
        'The IETF HTTP Working Group is standardizing the header (draft-ietf-httpbis-no-vary-search). The specification is past working group last call but not yet an RFC. Servers can deploy the header today with the understanding that non-Chromium clients fall back to strict matching -- which is the status quo, not a regression.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'IETF draft specification: https://httpwg.org/http-extensions/draft-ietf-httpbis-no-vary-search.html -- the normative source for parsing rules, canonicalization algorithm, and security considerations.',
            'MDN reference: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/No-Vary-Search -- browser-focused documentation with examples and compatibility tables.',
            'RFC 9111, HTTP Caching: https://www.rfc-editor.org/rfc/rfc9111 -- the caching framework that No-Vary-Search extends. Understand cache keys, Vary, freshness, and validators before studying this header.',
            'WICG nav-speculation explainer: https://github.com/WICG/nav-speculation/blob/main/no-vary-search.md -- the original design document explaining the Speculation Rules integration.',
          ],
        },
        'Study next by role:',
        {
          type: 'table',
          headers: ['Role', 'Topic', 'Why'],
          rows: [
            ['Prerequisite', 'HTTP Cache ETag Revalidation', 'Understand cache freshness and validation before studying key canonicalization'],
            ['Prerequisite', 'HTTP Vary Cache-Key Normalization', 'Vary is the mirror-image mechanism -- it adds dimensions instead of removing them'],
            ['Extension', 'CDN Request Flow', 'See how No-Vary-Search fits into multi-layer cache hierarchies'],
            ['Extension', 'Cache-Status HTTP Observability', 'Observability is essential for verifying that canonicalization rules actually improve hit ratios'],
            ['Case study', 'Resource Hints: Preload & Preconnect', 'Adjacent browser optimization that interacts with prefetch and cache behavior'],
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
            'State the representation equivalence invariant in one sentence. (A parameter is safe to ignore only when changing its value never changes the response body, status, or relevant headers for that route.)',
            'Given /page?a=1&b=2 cached with No-Vary-Search: key-order, params=("b"), will /page?b=9&a=1 hit or miss? (Hit -- b is ignored and key order is normalized, so canonical key is /page?a=1 for both.)',
            'Why is except only valid with params as a boolean? (Because except means "ignore all EXCEPT these" -- it inverts a universal ignore. It has no meaning when params already names a specific list.)',
            'Name one failure mode that produces no error signal. (Ignoring a content-selecting parameter serves the wrong cached response with a 200 status code -- no error, no warning, no log entry.)',
          ],
        },
      ],
    },
    {
      heading: 'Try this now',
      paragraphs: [
        'Pick a web application you use or maintain. Open the browser network tab and navigate to the same page through two different links -- one clean, one with UTM parameters. Compare the response bodies. If they are identical, that route is a candidate for No-Vary-Search. Write the header value you would deploy and list every parameter you would keep in the cache key, with a one-sentence justification for each.',
        'Then switch to the "safety rules" animation view. Trace the parameter audit table and predict which parameters the animation will classify as ignorable vs. kept. Run the animation and check your predictions against each frame.',
      ],
    },
  ],
};

