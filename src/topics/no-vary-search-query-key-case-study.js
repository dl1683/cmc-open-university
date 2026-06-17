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
      heading: 'The problem',
      paragraphs: [
        'HTTP caches normally treat the target URI as part of the cache key, including the query string. That is safe, but it can be wasteful. `/story?id=42&utm_source=newsletter` and `/story?id=42&utm_source=social` may return the same article while occupying two cache entries.',
        'The problem is query-key fragmentation. Tracking fields, referral tags, and harmless parameter ordering differences can turn one representation into many cache misses. Hit ratio falls, origin traffic rises, and users wait for duplicate work.',
      ],
    },
    {
      heading: 'Context',
      paragraphs: [
        'A cache key is a correctness boundary. It decides when a stored response can answer a later request. HTTP already has tools such as `Vary` for request-header dimensions, validators for revalidation, freshness metadata, and cache-control rules for storage and reuse.',
        'No-Vary-Search targets one narrow dimension: the URL search component. It lets an origin describe which query parameters do not vary the representation, or how parameter ordering should be normalized before cache matching.',
        'The core insight is that cache keys should represent response selection, not accidental URL noise. Query strings are often overloaded: some fields select content, some select presentation, some carry analytics, and some are irrelevant leftovers from navigation. No-Vary-Search gives the origin a way to separate those roles without asking the cache to guess.',
      ],
    },
    {
      heading: 'The tempting bug',
      paragraphs: [
        'The conservative bug is keying by every byte of query spelling even when the server ignores some fields. Marketing links then defeat the cache for no user-visible reason.',
        'The aggressive bug is worse: stripping parameters because they look like noise. A field named `variant`, `page`, `sort`, `color`, `currency`, `preview`, `account`, or `debug` may change the body, headers, permissions, or experiment assignment. If the cache ignores it, users can receive the wrong response.',
      ],
    },
    {
      heading: 'Core mechanism',
      paragraphs: [
        'No-Vary-Search adds a canonicalization step before lookup. The browser or cache receives a request URL, applies the origin-declared search-parameter rule, and compares the canonical key against stored responses. The visible URL does not have to change.',
        'The rule vocabulary can ignore named parameters, keep only exceptions, or normalize key order. The cache still respects the rest of HTTP caching: method, status, freshness, `Cache-Control`, `Vary`, credentials rules, validators, and storage policy.',
        'This is not route rewriting. The origin still receives and logs the original URL when a network request happens. The optimization is about whether a later request can reuse an already stored representation.',
      ],
    },
    {
      heading: 'Representation safety',
      paragraphs: [
        'The safety test is representation equality. An ignored parameter must not change the response body, relevant response headers, cacheability, authorization result, personalization, language, price, experiment arm, or any other observable response dimension.',
        'That test belongs at the origin contract, not in a cache guess. The server team must know that `utm_source` is analytics-only for article pages, while `id` selects the article and must remain in the key.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A news site serves article pages at `/story?id=42`. Campaign links add `utm_source`, `utm_medium`, and `utm_campaign`. The article body, title, cache headers, permissions, and language are selected by `id`, not by the UTM fields.',
        'The first request to `/story?id=42&utm_source=newsletter` stores a cacheable response with a rule that ignores the UTM fields and normalizes key order. A later request for `/story?utm_source=social&id=42` can canonicalize to the same cache key and reuse the stored response.',
        'The same site does not ignore `preview=true`, `lang=fr`, `subscriber=1`, or `ab=checkout-redesign` unless those fields are proven not to affect the representation on that route.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the query-params view, follow the request into `params`, then into the No-Vary-Search rule, then into the canonical key. The important point is that the user-facing URL can still contain tracking fields while the lookup key drops fields that the origin says are irrelevant.',
        'In the safety-rules view, read the table as an audit. UTM fields are candidates for ignoring. Variant, pagination, sorting, and product options are kept because they usually change content. The plot shows why the rule matters: raw query keys fragment as campaign URLs multiply, while a correct canonical key keeps reuse high.',
        'The visual should make students suspicious of global rules. A parameter can be harmless on one route and meaningful on another. The right mental model is route-specific representation safety: only remove a query dimension after proving that it does not change the response for that route family.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because cache identity can be looser than raw URL spelling when the origin proves the representation is the same. The key only needs to preserve dimensions that can change the response.',
        '`Vary` and No-Vary-Search solve mirror-image problems. `Vary` adds request-header dimensions that matter. No-Vary-Search removes query dimensions that do not matter. Both are declarations about representation selection.',
      ],
    },
    {
      heading: 'Tradeoffs',
      paragraphs: [
        'The upside is fewer duplicate cache entries, higher hit ratio, less origin load, and lower latency for public content reached through noisy links.',
        'The cost is policy risk and deployment reality. The header is still experimental, so unsupported caches fall back to ordinary full-URL matching. That fallback is safe but loses the optimization.',
        'The operational burden is proof. Teams need route-by-route parameter audits, response diffs, logs, and cache observability. A global rule that ignores a parameter everywhere is usually too broad.',
        'The right adoption posture is conservative. Treat the header as a performance optimization for routes that already have stable cache semantics, not as a way to repair unclear URL design. If product or experimentation teams cannot say whether a parameter changes representation, keep it in the key.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The worst failure is serving the wrong representation: the wrong product color, stale pagination, a different search result page, an incorrect locale, a hidden preview, or a personalized response reused for the wrong request.',
        'Another failure is misunderstanding the header as cache busting. It does the opposite. It tells caches that selected query variation is less important, so it should never be used for parameters meant to force distinct cache entries.',
        'Duplicate parameter names and order-sensitive server parsing can also break assumptions. A key-order rule is safe only when the route treats parameter order as irrelevant.',
      ],
    },
    {
      heading: 'Practical rollout',
      paragraphs: [
        'Start with one public route family, such as article pages or documentation pages. List every query parameter seen in logs. Mark which fields select content, which fields select presentation, which fields affect permissions, and which fields are analytics-only.',
        'Before rollout, diff responses for candidate ignored parameters across status, body, selected headers, cache-control, language, and personalization state. During rollout, watch hit ratio, origin traffic, `Cache-Status` where available, and error reports for wrong-content symptoms.',
        'Keep a safe fallback. Caches that do not understand the header will continue using the full URL. That means the rule can improve supporting caches without making unsupported caches less correct.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: MDN No-Vary-Search at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/No-Vary-Search, the IETF HTTP draft at https://httpwg.org/http-extensions/draft-ietf-httpbis-no-vary-search.html, RFC 9111 HTTP Caching at https://www.rfc-editor.org/rfc/rfc9111, and MDN Vary at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Vary.',
        'Then study HTTP Vary Cache-Key Normalization, HTTP Cache ETag Revalidation, Cache-Status HTTP Observability, CDN Request Flow, Resource Hints: Preload & Preconnect, and Tail Latency & p99 Thinking. No-Vary-Search is small, but it sits inside the full cache correctness stack.',
      ],
    },
  ],
};
