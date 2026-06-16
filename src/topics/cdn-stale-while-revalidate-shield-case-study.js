// CDN stale-while-revalidate: serve a bounded stale object immediately while
// one background revalidation refreshes the shared cache and origin shield.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'cdn-stale-while-revalidate-shield-case-study',
  title: 'CDN Stale-While-Revalidate Shield',
  category: 'Systems',
  summary: 'How CDN caches serve bounded stale content, collapse revalidation, use origin shields, and survive origin errors with stale-if-error policy.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['SWR hit', 'origin error'], defaultValue: 'SWR hit' },
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

function staleGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'user', label: 'user', x: 0.8, y: 4.8, note: notes.user ?? 'request' },
      { id: 'edge', label: 'edge', x: 2.5, y: 4.8, note: notes.edge ?? 'cache' },
      { id: 'stale', label: 'stale', x: 4.1, y: 2.8, note: notes.stale ?? 'old body' },
      { id: 'serve', label: 'serve', x: 4.1, y: 6.4, note: notes.serve ?? 'now' },
      { id: 'lock', label: 'lock', x: 5.7, y: 4.8, note: notes.lock ?? 'collapse' },
      { id: 'shield', label: 'shield', x: 7.2, y: 4.8, note: notes.shield ?? 'mid cache' },
      { id: 'origin', label: 'origin', x: 8.9, y: 4.8, note: notes.origin ?? 'truth' },
    ],
    edges: [
      { id: 'e-user-edge', from: 'user', to: 'edge', weight: '' },
      { id: 'e-edge-stale', from: 'edge', to: 'stale', weight: '' },
      { id: 'e-stale-serve', from: 'stale', to: 'serve', weight: '' },
      { id: 'e-edge-lock', from: 'edge', to: 'lock', weight: '' },
      { id: 'e-lock-shield', from: 'lock', to: 'shield', weight: '' },
      { id: 'e-shield-origin', from: 'shield', to: 'origin', weight: '' },
      { id: 'e-shield-edge', from: 'shield', to: 'edge', weight: '' },
    ],
  }, { title });
}

function* swrHit() {
  yield {
    state: staleGraph('A response is stale but still inside its SWR window'),
    highlight: { active: ['user', 'edge', 'stale', 'e-user-edge', 'e-edge-stale'], compare: ['origin'] },
    explanation: 'The object is past max-age, so it is stale. But Cache-Control allows stale-while-revalidate for a bounded window, so the edge can use the old body while it checks for a new one.',
    invariant: 'SWR trades perfect freshness for lower latency inside a declared time budget.',
  };

  yield {
    state: staleGraph('The edge serves stale bytes immediately'),
    highlight: { found: ['user', 'edge', 'stale', 'serve', 'e-user-edge', 'e-edge-stale', 'e-stale-serve'], removed: ['origin'] },
    explanation: 'The user does not wait for origin. The cache returns the stale representation immediately and marks a background revalidation job.',
  };

  yield {
    state: staleGraph('One revalidation lock collapses a local stampede', { lock: 'one job', shield: 'fetch', origin: 'If-None' }),
    highlight: { active: ['edge', 'lock', 'shield', 'origin', 'e-edge-lock', 'e-lock-shield', 'e-shield-origin'], compare: ['serve'] },
    explanation: 'Many users may request the stale object at once. A revalidation lock or singleflight gate lets one worker validate while everyone else receives the already available stale body.',
  };

  yield {
    state: staleGraph('The origin shield protects the true origin from every edge', { shield: 'shared', origin: '304/200', edge: 'update' }),
    highlight: { active: ['shield', 'origin', 'edge', 'e-shield-origin', 'e-shield-edge'], found: ['lock'] },
    explanation: 'Large CDNs often route cache fill through a shield layer. Instead of every edge validating with origin, the shield centralizes refreshes and spreads the updated object back out.',
  };

  yield {
    state: labelMatrix(
      'Freshness bands',
      [
        { id: 'fresh', label: 'fresh' },
        { id: 'swr', label: 'SWR' },
        { id: 'error', label: 'SIE' },
        { id: 'dead', label: 'expired' },
      ],
      [
        { id: 'serve', label: 'serve' },
        { id: 'work', label: 'work' },
      ],
      [
        ['cached', 'none'],
        ['stale', 'reval'],
        ['stale', 'on 5xx'],
        ['block', 'fetch'],
      ],
    ),
    highlight: { active: ['swr:serve', 'swr:work'], compare: ['dead:serve'] },
    explanation: 'The full policy is a timeline. Fresh content serves directly. SWR serves stale while refreshing. stale-if-error serves stale only if the upstream path fails. Expired content must block or miss.',
  };
}

function* originError() {
  yield {
    state: staleGraph('The edge has an old object and the origin path is sick', { stale: 'old but ok', origin: '503', shield: 'timeout' }),
    highlight: { active: ['edge', 'stale', 'shield', 'origin', 'e-edge-stale', 'e-shield-origin'], compare: ['serve'] },
    explanation: 'stale-if-error is a different directive from stale-while-revalidate. It says a cache may reuse stale content when the upstream path returns an error or cannot be reached.',
    invariant: 'Serving stale on error is availability policy, not freshness policy.',
  };

  yield {
    state: staleGraph('The shield absorbs repeated failed refreshes', { lock: 'backoff', shield: 'retry gate', origin: '503' }),
    highlight: { active: ['lock', 'shield', 'origin', 'e-lock-shield', 'e-shield-origin'], removed: ['user'] },
    explanation: 'If the origin is down, every edge must not hammer it at full user traffic. A shield, lock, and backoff schedule turn a stampede into controlled retries.',
  };

  yield {
    state: staleGraph('Users receive the last acceptable body', { serve: 'old body', stale: 'SIE ok', origin: 'down' }),
    highlight: { found: ['user', 'edge', 'stale', 'serve', 'e-user-edge', 'e-edge-stale', 'e-stale-serve'], removed: ['origin'] },
    explanation: 'For a news image, product catalog, or static documentation page, stale may be better than a 503. For balances, checkout, or authorization, stale can be wrong or dangerous.',
  };

  yield {
    state: labelMatrix(
      'Cacheable cases',
      [
        { id: 'asset', label: 'asset' },
        { id: 'html', label: 'HTML' },
        { id: 'catalog', label: 'catalog' },
        { id: 'account', label: 'account' },
      ],
      [
        { id: 'swr', label: 'SWR' },
        { id: 'sie', label: 'SIE' },
      ],
      [
        ['great', 'great'],
        ['short', 'maybe'],
        ['short', 'ok'],
        ['no', 'no'],
      ],
    ),
    highlight: { active: ['asset:swr', 'catalog:sie'], removed: ['account:swr', 'account:sie'] },
    explanation: 'The policy depends on correctness. Static and semi-static content can tolerate bounded staleness. User-private, money, and permission answers usually cannot.',
  };

  yield {
    state: staleGraph('The complete case is a product image rollout during an origin deploy', { user: 'shopper', edge: 'stale ok', shield: 'one fetch', origin: 'deploy 503', serve: 'old img' }),
    highlight: { active: ['user', 'edge', 'stale', 'serve', 'lock', 'shield', 'origin'], found: ['e-stale-serve'] },
    explanation: 'During an origin deploy, product images temporarily return 503. The CDN serves stale images within the allowed stale-if-error window, retries through the shield, and refreshes once origin recovers.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'SWR hit') yield* swrHit();
  else if (view === 'origin error') yield* originError();
  else throw new InputError('Pick a CDN stale-cache view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'stale-while-revalidate lets a cache return a stale response immediately while it revalidates the object in the background. stale-if-error lets a cache reuse stale content when the upstream path fails. Both are bounded by response directives rather than being unlimited cache magic.',
        'RFC 5861 introduced stale-while-revalidate and stale-if-error cache-control extensions: https://www.rfc-editor.org/rfc/rfc5861. RFC 9111 defines modern HTTP caching semantics: https://www.rfc-editor.org/rfc/rfc9111.',
      ],
    },
    {
      heading: 'Core data structure',
      paragraphs: [
        'The cache record carries response body, validators, insertion time, freshness lifetime, SWR window, stale-if-error window, Vary key, and revalidation status. Production CDNs add a per-object revalidation lock so one worker refreshes a stale object while other requests keep moving.',
        'An origin shield is another cache tier between edge locations and origin. It collapses global fill and revalidation traffic so origin sees one controlled refresh path instead of a burst from every edge.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'An ecommerce site serves product images through a CDN with max-age=600, stale-while-revalidate=60, and stale-if-error=86400. Ten minutes after a release, a popular image is stale at the edge. The first shopper receives the old image immediately while one background job validates through the shield.',
        'During an origin deployment, image requests briefly return 503. The CDN serves stale images under stale-if-error, backs off refresh attempts at the shield, and replaces the object after origin recovers. Checkout and account APIs do not use this policy because stale private state is not acceptable.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'SWR does not mean serve stale forever. Once the stale window expires, the cache has to block, miss, or follow another directive. stale-if-error is also conditional; it applies when the upstream path fails, not simply whenever the cache would prefer old bytes.',
        'Be careful with personalized responses. A perfect SWR mechanism with the wrong Vary key can leak one user response to another. The cache key and privacy policy matter as much as the freshness window.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RFC 5861 stale cache-control extensions at https://www.rfc-editor.org/rfc/rfc5861, RFC 9111 HTTP Caching at https://www.rfc-editor.org/rfc/rfc9111, and MDN Cache-Control documentation at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control. Study HTTP Cache ETag Revalidation, HTTP Vary Cache-Key Normalization, No-Vary-Search Query Key, Cache-Status HTTP Observability, CDN Request Flow, Resource Hints: Preload & Preconnect, LRU Cache, W-TinyLFU Cache Admission, Cache Invalidation & Versioning, Load Shedding, DNS Serve-Stale Resolver Cache, and Tail Latency next.',
      ],
    },
  ],
};
