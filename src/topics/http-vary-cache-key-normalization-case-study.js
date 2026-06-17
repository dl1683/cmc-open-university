// HTTP Vary cache-key normalization: turn URL-only storage into a bounded
// variant map so negotiated responses stay correct without destroying hit rate.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'http-vary-cache-key-normalization-case-study',
  title: 'HTTP Vary Cache-Key Normalization',
  category: 'Systems',
  summary: 'How HTTP Vary turns a URL cache into a variant map keyed by negotiated request headers, normalization rules, and privacy boundaries.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['variant map', 'normalization traps'], defaultValue: 'variant map' },
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

function varyGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'req', label: 'req', x: 0.8, y: 4.8, note: notes.req ?? 'GET /doc' },
      { id: 'hdr', label: 'hdrs', x: 2.4, y: 6.2, note: notes.hdr ?? 'Accept' },
      { id: 'vary', label: 'Vary', x: 2.4, y: 3.3, note: notes.vary ?? 'rules' },
      { id: 'norm', label: 'norm', x: 4.2, y: 4.8, note: notes.norm ?? 'canon' },
      { id: 'key', label: 'key', x: 5.9, y: 4.8, note: notes.key ?? 'URL+hdr' },
      { id: 'map', label: 'map', x: 7.4, y: 4.8, note: notes.map ?? 'variants' },
      { id: 'hit', label: 'hit', x: 9.0, y: 6.0, note: notes.hit ?? 'body' },
      { id: 'miss', label: 'miss', x: 9.0, y: 3.4, note: notes.miss ?? 'origin' },
    ],
    edges: [
      { id: 'e-req-hdr', from: 'req', to: 'hdr', weight: '' },
      { id: 'e-req-vary', from: 'req', to: 'vary', weight: '' },
      { id: 'e-hdr-norm', from: 'hdr', to: 'norm', weight: '' },
      { id: 'e-vary-norm', from: 'vary', to: 'norm', weight: '' },
      { id: 'e-norm-key', from: 'norm', to: 'key', weight: '' },
      { id: 'e-key-map', from: 'key', to: 'map', weight: '' },
      { id: 'e-map-hit', from: 'map', to: 'hit', weight: '' },
      { id: 'e-map-miss', from: 'map', to: 'miss', weight: '' },
    ],
  }, { title });
}

function variantHitPlot() {
  return plotState({
    axes: { x: { label: 'key variants', min: 1, max: 8 }, y: { label: 'hit ratio', min: 0, max: 100 } },
    series: [
      {
        id: 'bounded',
        label: 'bounded',
        points: [
          { x: 1, y: 92 },
          { x: 2, y: 89 },
          { x: 3, y: 85 },
          { x: 4, y: 81 },
          { x: 5, y: 76 },
          { x: 6, y: 72 },
        ],
      },
      {
        id: 'sprawl',
        label: 'sprawl',
        points: [
          { x: 1, y: 92 },
          { x: 2, y: 82 },
          { x: 3, y: 62 },
          { x: 4, y: 45 },
          { x: 5, y: 29 },
          { x: 6, y: 18 },
        ],
      },
    ],
    markers: [
      { id: 'ok', x: 3, y: 85, label: 'bucketed' },
      { id: 'bad', x: 6, y: 18, label: 'UA sprawl' },
    ],
  }, { title: 'Variant cardinality changes hit ratio' });
}

function* variantMap() {
  yield {
    state: varyGraph('URL-only cache entries collide across representations', { hdr: 'en + br', vary: 'absent', key: '/doc', hit: 'wrong?', miss: 'refetch' }),
    highlight: { active: ['req', 'hdr', 'key', 'map', 'e-req-hdr', 'e-hdr-norm', 'e-norm-key', 'e-key-map'], compare: ['vary'] },
    explanation: 'A URL alone is not enough when the response changes by request headers. The same /doc URL might be English or French, Brotli or gzip, public or authorization scoped.',
    invariant: 'A cache key must include every request dimension that changes the representation.',
  };

  yield {
    state: varyGraph('Vary declares which request fields shaped the response', { hdr: 'Lang+AE', vary: 'Lang, AE', norm: 'select', key: 'URL+2 hdr' }),
    highlight: { active: ['hdr', 'vary', 'norm', 'e-req-vary', 'e-vary-norm', 'e-hdr-norm'], found: ['key'] },
    explanation: 'Vary is response metadata. It tells caches which request header fields must match before a stored response can be reused for a later request.',
  };

  yield {
    state: varyGraph('Normalization makes equivalent requests share one key', { hdr: 'fr-CA,br', norm: 'fr + br', key: '/doc|fr|br', map: '3 rows' }),
    highlight: { active: ['hdr', 'norm', 'key', 'map', 'e-hdr-norm', 'e-norm-key', 'e-key-map'], compare: ['miss'] },
    explanation: 'The practical data structure is a variant map. The cache normalizes header values into canonical buckets, such as language fallback and supported content encoding.',
  };

  yield {
    state: varyGraph('A matching variant can hit and still revalidate by ETag', { vary: 'same set', key: '/doc|fr|br', map: 'found', hit: 'ETag fr', miss: '304/200' }),
    highlight: { found: ['key', 'map', 'hit', 'e-key-map', 'e-map-hit'], active: ['vary'], compare: ['miss'] },
    explanation: 'Once the right variant is selected, normal HTTP freshness and validators still apply. Vary chooses the representation; ETag decides whether that representation is current.',
  };

  yield {
    state: labelMatrix(
      'Cache-key fields',
      [
        { id: 'url', label: 'URL' },
        { id: 'meth', label: 'method' },
        { id: 'enc', label: 'Accept-Enc' },
        { id: 'lang', label: 'Accept-Lang' },
        { id: 'auth', label: 'Auth' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['base key', 'collide'],
        ['GET/HEAD', 'unsafe miss'],
        ['codec', 'bad bytes'],
        ['locale', 'wrong lang'],
        ['scope', 'private'],
      ],
    ),
    highlight: { found: ['enc:role', 'lang:role'], removed: ['auth:risk'] },
    explanation: 'The complete case is a documentation page with localized compressed variants. The safe key is URL plus method plus the Vary dimensions, while private authorization scope must not be hidden inside a shared public key.',
  };
}

function* normalizationTraps() {
  yield {
    state: labelMatrix(
      'Bad Vary choices',
      [
        { id: 'ua', label: 'User-Agent' },
        { id: 'cookie', label: 'Cookie' },
        { id: 'origin', label: 'Origin' },
        { id: 'trace', label: 'X-Trace' },
      ],
      [
        { id: 'effect', label: 'effect' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['many keys', 'device buck'],
        ['private', 'no-store'],
        ['CORS echo', 'Vary Origin'],
        ['miss storm', 'drop key'],
      ],
    ),
    highlight: { removed: ['ua:effect', 'cookie:effect', 'trace:effect'], active: ['origin:fix'] },
    explanation: 'Vary can protect correctness or destroy hit ratio. High-cardinality headers make a cache entry per user, device string, or trace id unless they are normalized away.',
    invariant: 'Correct Vary is necessary; unbounded Vary is an outage waiting to happen.',
  };

  yield {
    state: varyGraph('Dynamic CORS echoes need Vary: Origin', { hdr: 'Origin A', vary: 'Origin', key: '/api|A', map: 'ACAO A', hit: 'ok', miss: 'Origin B' }),
    highlight: { active: ['hdr', 'vary', 'norm', 'key', 'map', 'e-hdr-norm', 'e-vary-norm', 'e-norm-key'], found: ['hit'] },
    explanation: 'If a server echoes a specific Access-Control-Allow-Origin, shared caches need Vary: Origin. Otherwise the first allowed origin can poison the stored response metadata for another origin.',
  };

  yield {
    state: varyGraph('Over-varying turns a cache into an expensive pass-through', { hdr: 'UA+Cookie', vary: '*too much', norm: 'no share', key: 'unique', map: 'cold', miss: 'origin' }),
    highlight: { removed: ['hit'], active: ['hdr', 'vary', 'norm', 'key', 'map', 'miss', 'e-map-miss'] },
    explanation: 'Varying on Cookie, full User-Agent, or request ids often means each user gets a unique key. Correctness is preserved, but the cache no longer absorbs load.',
  };

  yield {
    state: variantHitPlot(),
    highlight: { found: ['bounded'], removed: ['sprawl'], active: ['ok'], compare: ['bad'] },
    explanation: 'The curve is the operational intuition: a few intentional variants can keep most hits, while accidental high-cardinality dimensions collapse hit ratio and push traffic to origin.',
  };

  yield {
    state: labelMatrix(
      'Production recipe',
      [
        { id: 'assets', label: 'assets' },
        { id: 'html', label: 'HTML' },
        { id: 'locale', label: 'locale page' },
        { id: 'cors', label: 'CORS echo' },
        { id: 'acct', label: 'account' },
      ],
      [
        { id: 'key', label: 'key' },
        { id: 'policy', label: 'policy' },
      ],
      [
        ['hash URL', 'immutable'],
        ['URL+ETag', 'validate'],
        ['lang bucket', 'Vary Lang'],
        ['Origin', 'Vary Orig'],
        ['none', 'no-store'],
      ],
    ),
    highlight: { found: ['assets:key', 'html:policy', 'locale:key', 'cors:policy'], removed: ['acct:policy'] },
    explanation: 'The clean production design chooses a small explicit key space: immutable assets by hashed URL, mutable HTML by ETag, localized pages by language bucket, CORS echoes by Origin, and private account data outside shared caches.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'variant map') yield* variantMap();
  else if (view === 'normalization traps') yield* normalizationTraps();
  else throw new InputError('Pick an HTTP Vary view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'HTTP Vary exists because one URL can produce several valid representations. The same /guide may differ by language, compression, device bucket, or CORS origin. A URL-only cache can either serve the wrong bytes or avoid caching useful responses.',
        'The problem is cache identity. The cache must know which request dimensions changed the response without letting every accidental header become a unique key.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to key the cache by method and URL. That is simple and works for static assets, because /app.abc123.js is the same representation for everyone.',
        'The wall appears when request headers select the representation. If the cache ignores Accept-Language, it can serve French to an English user. If it varies on full User-Agent or Cookie, it may create a cold key for every request.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Vary turns a URL entry into a bounded variant map. The primary key is usually method plus target URI. Each variant stores the Vary field names, normalized request field values, response metadata, freshness lifetime, validator, and body pointer.',
        'The insight is two-sided: include every dimension that changes the representation, and normalize or exclude dimensions that do not. Correctness without bounded cardinality becomes an origin-load problem.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        "In the variant-map view, read one URL as a small table of representations. The URL is the primary key, and the selected Vary request fields choose which variant is safe to reuse.",
        "In the normalization-traps view, watch cardinality. `Accept-Encoding` can collapse to a few useful buckets. Full `User-Agent` or `Cookie` can create one variant per request. The cache can be correct and still useless if the key space explodes.",
        "The highlighted cache hit is valid only when the incoming request matches the stored variant on the fields the origin declared. A missing Vary is a correctness bug; an excessive Vary is a performance bug.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A documentation page has English and French versions and supports Brotli or gzip. The response includes `Vary: Accept-Language, Accept-Encoding`. The cache stores variants such as English+Brotli, English+gzip, French+Brotli, and French+gzip. A later French request with Brotli support can reuse the French+Brotli body without contacting origin.',
        'Now add `Vary: User-Agent` using the raw header. The same page can produce thousands of variants because browsers, versions, devices, extensions, and bots send different strings. If the real product only needs mobile versus desktop, normalizing to a small device bucket is the difference between a useful cache and a miss generator.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A response declares Vary: Accept-Language, Accept-Encoding, Origin, or another request field. Later, the cache can reuse that response only when the new request matches the stored variant on those fields according to HTTP caching rules.',
        'In production, caches often normalize values before keying. Accept-Encoding can collapse to br, gzip, or identity. Accept-Language can collapse to supported locale buckets. Full User-Agent, Cookie, and tracing headers usually need a different strategy because they are high-cardinality or private.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Vary works because the origin declares which request fields influenced the response. The cache does not have to guess whether language, encoding, or origin mattered; it uses the declared fields to decide representation compatibility.',
        'Correctness depends on honesty and scope. Missing Vary serves wrong variants. Excessive Vary preserves correctness by avoiding sharing, but it destroys the cache benefit.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The main cost is variant cardinality. One URL with two encodings and three languages has six variants. Add full User-Agent, Cookie, or a request id and the map can become effectively unbounded.',
        'Operationally, under-varying shows up as correctness bugs. Over-varying shows up as lower hit ratio, more origin traffic, worse p99 latency, and less useful CDN shielding.',
        'There is also an invalidation cost. Every variant has freshness state, validator state, and purge behavior. A deployment that changes one URL may need to invalidate all variants for that URL, not just the first body the operator remembers.',
      ],
    },
    {
      heading: 'Normalization guidance',
      paragraphs: [
        'Normalize only with a clear contract. `Accept-Encoding` can become `br`, `gzip`, or `identity`. `Accept-Language` can become supported locale buckets. Device behavior can become a small set of layout variants. Avoid keying on raw high-cardinality headers unless isolation is more important than sharing.',
        'Keep privacy boundaries separate from representation negotiation. Browser cache partitioning, credentials mode, authorization, and `Cache-Control` decide whether sharing is allowed at all. Vary then decides which shared representation matches the request.',
      ],
    },
    {
      heading: 'Observability',
      paragraphs: [
        'A cache should report variant count, hit ratio by variant dimension, origin revalidation rate, and top key-sprawl causes. Without those numbers, teams often see only the symptom: more origin traffic and worse p99 latency after a harmless-looking header change.',
        'Cache-Status headers and CDN logs can make Vary behavior inspectable. During an incident, you want to know whether misses come from freshness expiry, validator failure, purge, cache partitioning, or a variant key that became too specific.',
        'A useful review includes both correctness probes and hit-ratio probes. Correctness probes ask whether English users get English and French users get French. Hit-ratio probes ask whether those variants are reused enough to justify caching. You need both, because a cache can be wrong and fast, or correct and ineffective.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Vary wins for negotiated compression, language-specific pages, dynamic CORS echoes, device buckets that are deliberately small, and any response where a small set of request headers selects a stable representation.',
        'It is strongest when each dimension has a clear product reason and a bounded set of normalized values.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Vary is not a privacy system by itself. Authorization-scoped account data still needs correct Cache-Control and often no-store. Varying on Cookie can both destroy sharing and remain unsafe if the cache policy is wrong.',
        'It also fails when teams add Vary defensively without measuring hit ratio. A header can be correct in theory and still make the cache useless in practice.',
        'It also fails when the origin and CDN disagree about normalization. If origin semantics depend on one header shape while the CDN collapses that header differently, the cache may serve a representation that neither side can explain during an incident.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A documentation site serves /guide in English and French, compressed with Brotli or gzip. The response includes Vary: Accept-Language, Accept-Encoding. A CDN stores variants such as /guide|fr|br and /guide|en|gzip, then revalidates each variant independently with ETag. Users get the right language and encoding without sending every request to origin.',
        'The same team also runs an API that dynamically echoes Access-Control-Allow-Origin for a small allowlist. Those responses include Vary: Origin, and account responses use no-store. The lesson is not "always add Vary"; it is "make every correctness dimension explicit, then keep the key space bounded."',
        'During rollout, the team purges or revalidates all variants for changed content, not just one URL-body pair. That detail matters because each variant can have its own freshness, validator, and edge-cache state.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: RFC 9111 HTTP Caching at https://www.rfc-editor.org/rfc/rfc9111, MDN Vary at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Vary, MDN HTTP caching at https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching, MDN Cache-Control at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control, and RFC 9211 Cache-Status at https://www.rfc-editor.org/rfc/rfc9211.',
        'Study next: HTTP Cache ETag Revalidation for validators, No-Vary-Search Query Key for URL search canonicalization, Cache-Status HTTP Observability for measuring cache behavior, Browser Cache Partitioning Network Key for the privacy wrapper around browser cache keys, CDN Stale-While-Revalidate Shield for stale policies, CORS Preflight Cache for Vary: Origin pitfalls, CDN Request Flow for edge cache placement, Cache Invalidation & Versioning for deployment strategy, LRU Cache and W-TinyLFU Cache Admission for eviction and admission, and Tail Latency & p99 Thinking for the cost of key-sprawl misses.',
      ],
    },
  ],
};
