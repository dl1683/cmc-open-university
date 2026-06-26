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
    { heading: 'How to read the animation', paragraphs: [
      {type:'callout', text:'Stale-while-revalidate changes expiration from a latency cliff into a bounded stale window guarded by one refresh path.'},
      {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/2/26/NCDN_-_CDN.svg', alt:'Diagram comparing a single origin server with a content delivery network', caption:'A CDN spreads cached copies across edge locations; stale-while-revalidate and shields prevent one expired object from turning every edge into origin traffic. Source: Wikimedia Commons, D. Ilyin after Kanoha, CC0.'},
      'Read the graph as two paths for one cache key. The user path serves the object already at the edge, while the refresh path takes a lock and goes through the shield toward origin. Fresh, stale-while-revalidate, stale-if-error, and expired are different time bands.',
    ] },
    { heading: 'Why this exists', paragraphs: [
      'A cache expiration can become a latency cliff. At second 600 an object is fresh, and at second 601 every request may block on validation. stale-while-revalidate, or SWR, lets a cache serve bounded stale content while one background refresh updates the record.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is strict max-age. When freshness ends, the next request validates or fetches before returning. This is simple, but a popular object can make many users wait behind the same origin validation.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is the stampede. If 1,000 users hit an expired object at once, a naive edge can trigger 1,000 refresh attempts. If origin is slow or failing, the cache stops protecting users exactly when protection matters most.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Turn expiration into a bounded timeline and collapse refresh work. During SWR, serve stale immediately and allow one refresh. During stale-if-error, serve stale only when upstream validation or fetch fails.',
    ] },
    { heading: 'How it works', paragraphs: [
      'A cache record stores the body, validators such as ETag, insertion time, max-age, SWR window, stale-if-error window, Vary key, and refresh state. A per-object lock or singleflight gate prevents duplicate validation. An origin shield centralizes refresh traffic from many edges before it reaches origin.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'The correctness argument depends on policy and key safety. The response explicitly permits bounded stale service, so the cache is not inventing freshness. Every request that shares the stale object must be allowed to see the same representation, or the cache key is unsafe.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'The cost is old content plus more machinery. With max-age=600 and stale-while-revalidate=60, a user may see content 660 seconds old. The system also needs locks, shield routing, retry backoff, purge correctness, and telemetry for Age, Cache-Status, stale reason, and shield hit ratio.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'SWR fits static assets without content hashes, product images, public documentation, catalog pages, news images, and semi-static HTML. stale-if-error fits public content where old content is better than a 503. Origin shields fit large CDNs where many edges might refresh the same object.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'It fails for personalized, financial, permission, inventory-critical, or security-sensitive responses unless the product explicitly accepts stale behavior. It also fails when Vary, cookies, authorization, locale, device class, or query dimensions are missing from the cache key.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'A product image has Cache-Control: max-age=600, stale-while-revalidate=60, stale-if-error=86400. At t=601, the first shopper receives the old image immediately while one worker validates through the shield. If 999 more shoppers arrive during that second, they get the stale image instead of creating 999 more origin validations.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: RFC 5861 stale cache-control extensions at https://www.rfc-editor.org/rfc/rfc5861, RFC 9111 HTTP Caching at https://www.rfc-editor.org/rfc/rfc9111, and MDN Cache-Control at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control.',
      'Study HTTP Cache ETag Revalidation, HTTP Vary Cache-Key Normalization, Cache-Status HTTP Observability, CDN Request Flow, LRU Cache, W-TinyLFU Cache Admission, Cache Invalidation and Versioning, Load Shedding, and Tail Latency.',
    ] },
  ],
};
