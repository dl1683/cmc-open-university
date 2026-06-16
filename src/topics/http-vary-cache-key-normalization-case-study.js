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
      heading: 'What it is',
      paragraphs: [
        'HTTP Vary is the bridge between a URL cache and a variant map. A cache normally starts from method plus target URI, but a response can say that selected request header fields also shaped the representation. The cache must compare those field values before reusing the stored body.',
        'MDN describes Vary as the response header that names request-message parts that influenced the response and are used to create cache keys: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Vary. RFC 9111 defines the cache-key and Vary matching rules in HTTP caching: https://www.rfc-editor.org/rfc/rfc9111.',
      ],
    },
    {
      heading: 'Core data structure',
      paragraphs: [
        'The core structure is a map from a primary key to a bounded list of variants. The primary key is usually method plus URL. Each variant stores the Vary field names, normalized request field values, response metadata, freshness lifetime, validator, and body pointer.',
        'Normalization is the hard part. Accept-Encoding can usually collapse to br, gzip, or identity. Accept-Language may collapse to supported locale buckets such as en, fr, and es. Full User-Agent, Cookie, and per-request tracing headers are usually too large or private to become shared cache dimensions.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A documentation site serves /guide in English and French, compressed with Brotli or gzip. The response includes Vary: Accept-Language, Accept-Encoding. A CDN stores variants such as /guide|fr|br and /guide|en|gzip, then revalidates each variant independently with ETag. Users get the right language and encoding without sending every request to origin.',
        'The same team also runs an API that dynamically echoes Access-Control-Allow-Origin for a small allowlist. Those responses include Vary: Origin, and account responses use no-store. The lesson is not "always add Vary"; it is "make every correctness dimension explicit, then keep the key space bounded."',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Vary is not a privacy system by itself. If the response is authorization scoped, a shared cache still needs the right Cache-Control behavior and sometimes no-store. Varying on Authorization or Cookie often collapses sharing and can still be dangerous if the cache policy is wrong.',
        'Over-varying can be as damaging as under-varying. Under-varying serves the wrong bytes. Over-varying silently lowers cache hit ratio, increases origin load, and makes tail latency worse. Use explicit buckets, avoid request-id headers in cache keys, and observe Cache-Status when available.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RFC 9111 HTTP Caching at https://www.rfc-editor.org/rfc/rfc9111, MDN Vary at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Vary, MDN HTTP caching at https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching, MDN Cache-Control at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control, and RFC 9211 Cache-Status at https://www.rfc-editor.org/rfc/rfc9211.',
        'Study next: HTTP Cache ETag Revalidation for validators, No-Vary-Search Query Key for URL search canonicalization, Cache-Status HTTP Observability for measuring cache behavior, Browser Cache Partitioning Network Key for the privacy wrapper around browser cache keys, CDN Stale-While-Revalidate Shield for stale policies, CORS Preflight Cache for Vary: Origin pitfalls, CDN Request Flow for edge cache placement, Cache Invalidation & Versioning for deployment strategy, LRU Cache and W-TinyLFU Cache Admission for eviction and admission, and Tail Latency & p99 Thinking for the cost of key-sprawl misses.',
      ],
    },
  ],
};
