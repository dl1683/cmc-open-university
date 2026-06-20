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
      heading: 'Why this exists',
      paragraphs: [
        {type:'callout', text:'Stale-while-revalidate changes expiration from a latency cliff into a bounded stale window guarded by one refresh path.'},
        'stale-while-revalidate exists because freshness should not always be a cliff. At scale, one popular object expiring can force many users to wait for the same origin validation at the same time.',
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/2/26/NCDN_-_CDN.svg', alt:'Diagram comparing a single origin server with a content delivery network', caption:'A CDN spreads cached copies across edge locations; stale-while-revalidate and shields prevent one expired object from turning every edge into origin traffic. Source: Wikimedia Commons, D. Ilyin after Kanoha, CC0.'},
        'The directive gives the cache a bounded grace period. During that period it may serve the stale object immediately while one background revalidation refreshes the shared cache record.',
        'stale-if-error solves a related availability problem: if origin is unhealthy, bounded stale content may be better than an outage for resources where old content is acceptable.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach is strict expiration: once max-age ends, the next request blocks on origin or revalidation. That is simple and gives fresh answers when origin is healthy.',
        'The wall is the expiration stampede. A popular object can expire at many edges at once, and every waiting user pays origin latency. If origin is slow, the cache stops protecting users at the exact moment protection is most needed.',
        'During deploys or outages, strict expiration can convert stale-but-usable content into 503s. That is a product decision, not just a caching detail.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The cache record stores body, validators, insertion time, freshness lifetime, SWR window, stale-if-error window, Vary key, and revalidation status. A per-object revalidation lock lets one worker refresh while other users receive the existing body.',
        'An origin shield adds another cache tier between edges and origin. It collapses refreshes from many edge locations into one controlled path, so origin does not receive the full global burst.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the SWR-hit view, watch the request split into two paths. The user receives the stale body immediately. A single background path takes the revalidation lock and goes through the shield toward origin.',
        'The lock node is the stampede-control mechanism. Without it, every request during the stale window could trigger its own validation. With it, one validation updates the shared object while other users get the existing representation.',
        'In the origin-error view, distinguish stale-while-revalidate from stale-if-error. SWR is a freshness-latency trade. stale-if-error is an availability policy used only when the upstream path fails.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A cache record has a response body, validators such as ETag or Last-Modified, insertion time, max-age, stale-while-revalidate window, stale-if-error window, Vary key, and revalidation status.',
        'During max-age, the cache serves normally. During the stale-while-revalidate window, it may serve stale immediately and trigger background validation. During stale-if-error, it may serve stale only if the upstream fetch fails.',
        'The revalidation lock or singleflight gate prevents every request from becoming its own refresh. The shield layer further reduces duplicate work across edge locations by centralizing cache fill and validation traffic.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'SWR works because freshness is treated as a bounded timeline rather than a binary cliff. The cache is allowed to serve old bytes for a declared interval while one refresh job moves the shared record forward.',
        'The lock works because all requests for the same cache key agree that a refresh is already in progress. The shield works because many edges share a smaller number of upstream fill paths.',
        'The correctness argument depends on the resource. Static images, documentation, and catalogs can often tolerate short staleness. Balances, checkout, authorization, and account data usually cannot.',
        'The cache key is part of the proof. Staleness is acceptable only if every request mapped to that object is allowed to see the same representation. A safe stale policy with an unsafe key is still an unsafe cache.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A product image has `Cache-Control: max-age=600, stale-while-revalidate=60, stale-if-error=86400`. At 601 seconds, the first edge request receives the old image immediately. The edge starts one background revalidation through the shield.',
        'If origin returns 304, the cache extends freshness without downloading the body. If origin returns a new 200, the cache replaces the object. If origin is temporarily failing and stale-if-error applies, the CDN can keep serving the old image rather than exposing shoppers to broken pages.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The cost is controlled staleness. Users may see old content inside the allowed window. The system also needs locks, backoff, shield routing, observability, and clear policies for when stale is acceptable.',
        'The behavior win is lower tail latency and lower origin load. Instead of all users waiting behind revalidation, most users get an immediate response and the cache refreshes once.',
        'Observability matters. Cache-Status, age, hit/miss reason, revalidation count, shield hit ratio, and stale-served counters tell whether the policy is protecting origin or hiding a freshness bug.',
      ],
    },
    {
      heading: 'Operational checklist',
      paragraphs: [
        'Set cache policy by resource class. Static assets, public documentation, product images, catalog pages, and personalized account data should not share one stale policy. The policy should state max-age, stale-while-revalidate, stale-if-error, cache key dimensions, purge behavior, and whether stale content is acceptable during origin errors.',
        'Add stale telemetry before relying on stale behavior. Record Age, Cache-Status, stale reason, revalidation lock waits, shield hit ratio, origin status, purge events, and how often stale-if-error was used. Those fields tell whether the CDN is reducing tail latency or masking broken freshness.',
        'Review purge and deploy behavior. If a release must invalidate a broken object immediately, SWR should not keep serving it because the purge path missed one variant. Stale policy and invalidation policy have to agree.',
      ],
    },
    {
      heading: 'Testing the policy',
      paragraphs: [
        'Test the timeline explicitly: fresh hit, first stale hit inside the SWR window, concurrent stale requests collapsed into one validation, 304 refresh, 200 replacement, stale-if-error on a simulated 503, and hard expiration after the allowed stale windows.',
        'Also test key safety. Two users, locales, authorization states, device variants, or query strings that should not share a response must not collapse into the same stale object. A stale cache bug can leak data long after the origin was fixed.',
        'Finally, test recovery. After origin returns to health, the cache should refresh once, stop serving the stale error fallback, and expose that transition in telemetry so operators can confirm the incident is really over.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'SWR wins for static assets without content hashes, product images, documentation, public catalog pages, news images, and semi-static pages where a short freshness lag is acceptable.',
        'stale-if-error wins when stale content is clearly better than failure, such as public images or documentation during an origin incident.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails for personalized, financial, permission, inventory-critical, or security-sensitive responses unless the product explicitly accepts stale behavior. A perfect SWR mechanism with the wrong cache key can leak data.',
        'It fails when the cache key is wrong. Vary, cookies, authorization headers, query normalization, and device or locale dimensions all affect whether two requests can safely share one object.',
        'SWR does not mean stale forever. Once the stale window expires, the cache must block, miss, or follow another directive. stale-if-error applies on upstream failure, not whenever a cache would prefer old bytes.',
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
      heading: 'Study next',
      paragraphs: [
        'Primary sources: RFC 5861 stale cache-control extensions at https://www.rfc-editor.org/rfc/rfc5861, RFC 9111 HTTP Caching at https://www.rfc-editor.org/rfc/rfc9111, and MDN Cache-Control documentation at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control. Study HTTP Cache ETag Revalidation, HTTP Vary Cache-Key Normalization, No-Vary-Search Query Key, Cache-Status HTTP Observability, CDN Request Flow, Resource Hints: Preload & Preconnect, LRU Cache, W-TinyLFU Cache Admission, Cache Invalidation & Versioning, Load Shedding, DNS Serve-Stale Resolver Cache, and Tail Latency next.',
      ],
    },
  ],
};
