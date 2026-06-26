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
    { heading: 'How to read the animation', paragraphs: ['Read the pipeline as cache-key construction. A cache key is the value a browser or intermediary uses to decide whether a stored response can answer a new request.', 'The active query parameter is being classified as significant or ignorable. A found state means the request and stored response match after the origin-declared No-Vary-Search rule is applied.', {type:'callout', text:'No-Vary-Search is safe only when the origin can prove which query parameters do not change the representation, turning noisy URLs into canonical cache keys.'}, {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/5/5b/HTTP_logo.svg', alt:'HTTP logo used by the IETF HTTP Working Group.', caption:'No-Vary-Search changes HTTP cache-key construction for query parameters that the origin proves are representation-neutral. Source: Wikimedia Commons, IETF HTTP Working Group, Public domain'}] },
    { heading: 'Why this exists', paragraphs: ['HTTP caches normally key on the full URL, including the query string. That is safe because two query strings can select different representations.', 'Many URLs also carry tracking parameters that do not change the response body. Those parameters fragment the cache, so one article can occupy many entries that all store the same bytes.'] },
    { heading: 'The obvious approach', paragraphs: ['The obvious safe approach is to keep the full URL as the key. It preserves correctness but wastes storage and origin traffic when tracking fields multiply.', 'The obvious fast approach is to strip fields such as utm_source at a CDN. That is dangerous because only the origin application knows whether a parameter is irrelevant on that route.'] },
    { heading: 'The wall', paragraphs: ['The wall is missing knowledge transfer. The origin knows which query parameters affect the response, while the cache owns the stored response and lookup path.', 'Without a protocol signal, the cache must choose between strict keys with low hit ratio and guessed keys with possible wrong content. No-Vary-Search exists to make the origin declare the safe canonicalization rule.'] },
    { heading: 'The core insight', paragraphs: ['No-Vary-Search is a response header that declares which query parameters do not vary the representation. The cache can compare canonicalized query parameters instead of raw query spelling.', 'The key is that the user-visible URL does not change. Only the lookup key changes, and the rule is stored with the response that supplied it.'] },
    { heading: 'How it works', paragraphs: ['The origin sends a cacheable response with a structured header such as No-Vary-Search: key-order, params=("utm_source" "gclid"). The cache stores the response, the original URL, and the rule.', 'On a later request, the cache parses query parameters, drops ignored names, optionally normalizes order, and compares the canonical result to stored entries. If the header is missing or malformed, strict URL matching remains the fallback.'] },
    { heading: 'Why it works', paragraphs: ['The correctness invariant is representation equivalence. If parameter P is ignored for route R, then changing P must not change the response body or any response header that matters to reuse.', 'When that invariant holds, removing P from cache matching cannot serve the wrong representation. When it does not hold, the header is a correctness bug no matter how much it improves hit ratio.'] },
    { heading: 'Cost and complexity', paragraphs: ['The cache pays parsing and canonicalization work on lookup. That cost is small compared with an origin fetch, but it still adds implementation complexity and strict structured-field parsing.', 'The larger cost is audit work. Every route needs parameter classification, because a field named ref might be tracking noise on one page and a database reference on another.'] },
    { heading: 'Real-world uses', paragraphs: ['No-Vary-Search fits article pages, documentation pages, product pages, and prefetch flows where tracking parameters do not change content. It is especially useful when speculation or prerendering fetches a clean URL before the final clicked URL includes campaign fields.', 'It also helps CDNs and browser caches avoid duplicate entries. The access pattern is many URL spellings for one route-selected representation.'] },
    { heading: 'Where it fails', paragraphs: ['It fails when ignored parameters actually select content. Ignoring color on a product page that renders different images would make the cache serve the wrong representation.', 'It also fails when deployments skip the route audit. A global denylist of tracking-looking names can break APIs, search pages, or preview links where the same name carries real meaning.'] },
    { heading: 'Worked example', paragraphs: ['A docs page is served at /docs?page=setup and also receives 12 campaign variants such as utm_source, gclid, and fbclid. Without No-Vary-Search, 12 variants plus the clean URL can create 13 cache entries for the same setup HTML.', 'With No-Vary-Search: key-order, params=("utm_source" "utm_medium" "gclid" "fbclid"), each variant canonicalizes to /docs?page=setup. If the first response is cached for 600 seconds, the next 12 requests can hit the same entry instead of contacting the origin.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources are the MDN No-Vary-Search reference, the WICG No-Vary-Search draft, RFC 8941 structured fields, and browser speculation rules documentation. Read the syntax rules because malformed headers fail closed.', 'Study HTTP caching, Cache-Control, Vary, ETag revalidation, URLSearchParams parsing, CDN cache keys, and prefetch or prerender behavior next. The practical skill is proving parameter irrelevance before changing cache identity.'] },
  ],
};