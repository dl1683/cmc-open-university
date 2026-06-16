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
      heading: 'What it is',
      paragraphs: [
        'No-Vary-Search is an HTTP response header for cache matching. It lets an origin declare rules for whether query parameters affect the cached representation, so equivalent URLs can reuse one stored response instead of fragmenting the cache.',
        'MDN marks No-Vary-Search as experimental and describes it as rules for how URL query parameters affect cache matching: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/No-Vary-Search. The HTTP working group draft defines it as an extension to HTTP caching: https://httpwg.org/http-extensions/draft-ietf-httpbis-no-vary-search.html.',
      ],
    },
    {
      heading: 'Core data structure',
      paragraphs: [
        'The cache still starts from the request URL, freshness metadata, validators, and Vary rules. No-Vary-Search adds a query canonicalization step before lookup: drop ignored parameters, keep exception parameters, and optionally normalize key order.',
        'This is the URL-search companion to HTTP Vary Cache-Key Normalization. Vary says which request headers matter. No-Vary-Search says which URL query fields do not matter, or which ones must remain in the key.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A news site receives the same article under /story?id=42&utm_source=newsletter, /story?id=42&utm_source=social, and /story?utm_source=ads&id=42. The body is selected only by id. The origin sends a No-Vary-Search rule that ignores utm_source and normalizes key order. The browser or cache can reuse the article response across campaign URLs.',
        'The team does not ignore page, sort, q, color, or account parameters because those change content. Rollout starts with one route, diffing response bodies for candidate ignored parameters and observing hit ratio with Cache-Status or provider logs.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'No-Vary-Search is not a cache-busting control. It does the opposite: it makes selected query variations less significant for cache matching. It should not be used for parameters that change content, permissions, personalization, or experiment assignment.',
        'Because the header is still experimental, production systems need compatibility assumptions. Unsupported caches fall back to ordinary full-URL matching, so correctness should remain safe and the feature should be treated as an optimization.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN No-Vary-Search at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/No-Vary-Search, the IETF HTTP draft at https://httpwg.org/http-extensions/draft-ietf-httpbis-no-vary-search.html, RFC 9111 HTTP Caching at https://www.rfc-editor.org/rfc/rfc9111, and MDN Vary at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Vary.',
        'Study next: HTTP Vary Cache-Key Normalization for header dimensions, HTTP Cache ETag Revalidation for validators, Cache-Status HTTP Observability for rollout measurement, CDN Request Flow for where query fragmentation hurts, Resource Hints: Preload & Preconnect for navigational reuse, and Tail Latency & p99 Thinking for the user-visible cost of avoidable misses.',
      ],
    },
  ],
};
