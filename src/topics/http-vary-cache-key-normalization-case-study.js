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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the cache as a map from a request identity to a stored representation. The URL is the first key, and Vary can add selected request headers that change which bytes are correct.',
        'Active variants are candidates for reuse. A safe inference is that a cache hit is valid only when the incoming request matches the stored response on every request field named by Vary after the cache applies its normalization policy.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'HTTP Vary exists because one URL can have several valid representations. The same /guide may differ by language, content encoding, CORS origin, or a deliberately small device bucket.',
        'The problem is cache identity. A URL-only cache can serve the wrong bytes, while a cache that varies on every accidental header can create so many variants that it stops caching useful traffic.',
        {type:'callout', text:'Vary works when cache identity includes every representation-changing dimension and normalizes away noise that would explode cardinality.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to key the cache by method and URL. That works for immutable static assets because /app.abc123.js means the same bytes for every compatible request.',
        'A second obvious approach is to include every request header in the key. That sounds correct because no detail is ignored, but it turns trace ids, cookies, and user-agent strings into miss generators.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the mismatch between correctness and cardinality. If the cache ignores Accept-Language, it can serve French to an English reader; if it varies on raw Cookie, it may create one cold variant per user.',
        'Under-varying is a correctness bug and over-varying is a performance bug. A cache can be perfectly safe by never sharing anything, but then it no longer protects the origin or improves latency.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is a bounded variant map. The primary key is usually method plus target URI, and each stored variant records the Vary field names, normalized request values, response metadata, validator, freshness state, and body pointer.',
        'Vary is a contract from origin to cache. It says which request fields influenced the selected representation, so future requests must match those fields before the body can be reused.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A response can declare Vary: Accept-Language, Accept-Encoding, Origin, or another request field. Later, the cache reuses that response only if the new request has matching values for those fields under HTTP caching rules.',
        'Production caches often normalize before keying. Accept-Encoding can collapse to br, gzip, or identity; Accept-Language can collapse to supported locale buckets; raw User-Agent usually needs a small device class or no sharing.',
        'Private storage policy is separate from Vary. Authorization, Cache-Control, credentials mode, browser cache partitioning, and shared-cache rules decide whether storage and sharing are allowed before the variant match matters.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Vary works because the origin declares which request fields selected the representation. The cache does not have to guess whether language, encoding, or origin mattered for the stored response.',
        'The correctness argument is exact compatibility. If the request matches the URL key and the stored Vary dimensions, then the cache can reuse the representation within freshness or validation rules; if any dimension differs, it must miss or find another variant.',
        'Normalization is safe only when it preserves representation meaning. Collapsing gzip;q=1.0 and gzip;q=0.8 into gzip is safe if the response body is the same, but collapsing French and English is not.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Variant cardinality is the main cost. One URL with 3 languages and 2 encodings has 6 variants, but adding 500 user-agent strings makes it 3,000 variants before cookies or origins are counted.',
        'The behavior shows up in hit ratio and origin load. Under-varying produces wrong-language, wrong-encoding, or wrong-origin responses; over-varying produces more misses, colder CDN edges, higher p99 latency, and more revalidation traffic.',
        'Invalidation also grows with variants. Purging one logical page must handle every stored language and encoding variant, not just the first body the operator remembers.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Vary fits negotiated compression, language-specific pages, dynamic CORS echoes for a bounded allowlist, and small device buckets where the origin truly sends different representations.',
        'It is strongest when each dimension has a product reason and a bounded normalized value set. Accept-Encoding and supported locales are usually good dimensions; raw Cookie and raw User-Agent usually are not.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Vary is not a privacy system. Account data still needs correct Cache-Control, often no-store or private, because varying on Cookie can both destroy sharing and remain unsafe under the wrong storage policy.',
        'It fails when origin and CDN disagree about normalization. If origin semantics depend on a header detail that the CDN collapses away, the cache can serve a representation that neither side can explain during an incident.',
        'It also fails when teams add Vary defensively without measuring hit ratio. Correctness dimensions should be explicit, but accidental high-cardinality dimensions can make a CDN act like a pass-through proxy.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A documentation page /guide supports English and French, and it can send Brotli or gzip. With Vary: Accept-Language, Accept-Encoding, the useful variants are en+br, en+gzip, fr+br, and fr+gzip.',
        'If each body is 100 KB and the CDN receives 10,000 repeated French Brotli requests, the fr+br variant can avoid about 1 GB of repeated origin body transfer after the first fill, ignoring headers. The cache key is doing real work because it shares the right body among compatible requests.',
        'Now add raw User-Agent with 2,000 distinct strings. The possible key count jumps from 4 to 8,000, so most requests miss even though the page only has four real representations.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are RFC 9111 on HTTP caching, RFC 9110 on HTTP semantics, MDN Vary, MDN HTTP caching, MDN Cache-Control, and RFC 9211 Cache-Status. Read them to separate storage policy, cache key selection, freshness, and observability.',
        'Study HTTP Cache ETag Revalidation, No-Vary-Search Query Key, Cache-Status HTTP Observability, Browser Cache Partitioning Network Key, CDN Stale-While-Revalidate Shield, CORS Preflight Cache, LRU Cache, and Tail Latency Thinking next.',
      ],
    },
  ],
};
