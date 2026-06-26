// Envoy rate limiting: route actions build descriptor vectors, a rate-limit
// service checks quota state, and local or global policies decide the request.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'envoy-rate-limit-descriptor-quota-case-study',
  title: 'Envoy Rate Limit Descriptor Quota Case Study',
  category: 'Systems',
  summary: 'A gateway rate-limit primer: descriptor vectors, route actions, local token buckets, global rate-limit services, Redis counters, quota loops, and fail-open choices.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['descriptor tree', 'quota loop'], defaultValue: 'descriptor tree' },
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

function limitGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'req', label: 'req', x: 0.65, y: 3.8, note: notes.req ?? 'HTTP' },
      { id: 'envoy', label: 'envoy', x: 2.1, y: 3.8, note: notes.envoy ?? 'filter' },
      { id: 'actions', label: 'acts', x: 3.65, y: 1.8, note: notes.actions ?? 'route' },
      { id: 'desc', label: 'desc', x: 3.65, y: 5.7, note: notes.desc ?? 'vector' },
      { id: 'rls', label: 'RLS', x: 5.6, y: 3.8, note: notes.rls ?? 'gRPC' },
      { id: 'store', label: 'store', x: 7.35, y: 1.8, note: notes.store ?? 'Redis' },
      { id: 'decide', label: 'decide', x: 7.35, y: 5.7, note: notes.decide ?? 'ok/429' },
      { id: 'up', label: 'up', x: 9.15, y: 3.8, note: notes.up ?? 'service' },
    ],
    edges: [
      { id: 'e-req-envoy', from: 'req', to: 'envoy', weight: '' },
      { id: 'e-envoy-actions', from: 'envoy', to: 'actions', weight: '' },
      { id: 'e-actions-desc', from: 'actions', to: 'desc', weight: '' },
      { id: 'e-desc-rls', from: 'desc', to: 'rls', weight: '' },
      { id: 'e-rls-store', from: 'rls', to: 'store', weight: '' },
      { id: 'e-store-decide', from: 'store', to: 'decide', weight: '' },
      { id: 'e-rls-decide', from: 'rls', to: 'decide', weight: '' },
      { id: 'e-decide-up', from: 'decide', to: 'up', weight: '' },
    ],
  }, { title });
}

function* descriptorTree() {
  yield {
    state: limitGraph('Envoy route actions build a descriptor vector'),
    highlight: { active: ['req', 'envoy', 'actions', 'desc', 'e-req-envoy', 'e-envoy-actions', 'e-actions-desc'], compare: ['rls'] },
    explanation: 'The first step is classification. Envoy extracts values such as path class, remote address, request header, tenant, method, or authenticated principal and turns them into a descriptor vector that names the fairness boundary.',
    invariant: 'The limiter key should match the fairness boundary, not just the easiest field to extract.',
  };

  yield {
    state: labelMatrix(
      'Desc',
      [
        { id: 'route', label: 'route' },
        { id: 'ip', label: 'IP' },
        { id: 'user', label: 'user' },
        { id: 'plan', label: 'plan' },
        { id: 'path', label: 'path' },
      ],
      [
        { id: 'key', label: 'key' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['api', 'too broad'],
        ['addr', 'NAT pain'],
        ['sub', 'bot acct'],
        ['tier', 'fairness'],
        ['class', 'card high'],
      ],
    ),
    highlight: { active: ['route:key', 'user:key', 'plan:key'], compare: ['ip:risk', 'path:risk'] },
    explanation: 'A descriptor is a structured key, not one flat string. The shape matters. Per-IP limits protect unauthenticated edges; per-user or per-tenant limits are fairer after authentication; path-level keys can explode cardinality if the raw URL is used.',
  };

  yield {
    state: limitGraph('Global rate limiting asks an external service for a decision', { desc: 'domain+keys', rls: 'check', store: 'counters', decide: 'OK/OVER', up: 'upstream' }),
    highlight: { active: ['desc', 'rls', 'store', 'decide', 'up', 'e-desc-rls', 'e-rls-store', 'e-store-decide', 'e-decide-up'], found: ['envoy'] },
    explanation: 'In global mode, Envoy calls a rate-limit service, commonly over gRPC. The service checks descriptor counters or token buckets in a backing store and returns OK or over limit. Envoy then forwards the request or returns a rate-limit response.',
  };

  yield {
    state: labelMatrix(
      'Fail',
      [
        { id: 'open', label: 'open' },
        { id: 'closed', label: 'closed' },
        { id: 'shadow', label: 'shadow' },
        { id: 'local', label: 'local' },
      ],
      [
        { id: 'when', label: 'when' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['down', 'abuse'],
        ['strict', '429'],
        ['obs', 'none'],
        ['edge', 'split'],
      ],
    ),
    highlight: { active: ['open:risk', 'closed:risk', 'shadow:when', 'local:when'], compare: ['shadow:risk'] },
    explanation: 'The fail policy is part of the data structure. Fail-open preserves availability but may allow overload. Fail-closed protects capacity but can reject valid traffic when the limiter is unhealthy. Shadow mode measures impact before enforcement.',
  };
}

function* quotaLoop() {
  yield {
    state: limitGraph('Quota mode allocates budget and receives load reports', { actions: 'classify', desc: 'bucket', rls: 'quota', store: 'alloc', decide: 'local ok', up: 'service' }),
    highlight: { active: ['envoy', 'desc', 'rls', 'store', 'decide', 'e-actions-desc', 'e-desc-rls', 'e-rls-store', 'e-rls-decide'], compare: ['up'] },
    explanation: 'Quota mode moves the hot path away from a central counter. Envoy receives an allocation, spends it locally, and reports usage back so the allocator can rebalance. That buys speed at the cost of skew and delayed correction.',
  };

  yield {
    state: labelMatrix(
      'Quota',
      [
        { id: 'alloc', label: 'alloc' },
        { id: 'spend', label: 'spend' },
        { id: 'report', label: 'report' },
        { id: 'reb', label: 'reb' },
        { id: 'drain', label: 'drain' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['tokens', 'skew'],
        ['local', 'burst'],
        ['usage', 'delay'],
        ['share', 'oscillate'],
        ['empty', '429 wave'],
      ],
    ),
    highlight: { active: ['alloc:state', 'spend:state', 'report:state', 'reb:state'], compare: ['drain:risk'] },
    explanation: 'Quota mode is a distributed counter problem. Local spending is fast, but allocation delay, uneven load, clocking, and report intervals can make fairness drift. The allocator needs smoothing and conservative fail behavior.',
  };

  yield {
    state: limitGraph('Local and global limits should be layered deliberately', { envoy: 'edge', actions: 'route', desc: 'tenant', rls: 'global', store: 'Redis', decide: '429/hdr', up: 'origin' }),
    highlight: { active: ['req', 'envoy', 'desc', 'rls', 'store', 'decide', 'up', 'e-req-envoy', 'e-desc-rls', 'e-store-decide', 'e-decide-up'], found: ['actions'] },
    explanation: 'A common design uses cheap local token buckets for broad protection and global descriptor checks for tenant or plan fairness. The local limit absorbs obvious floods; the global limit enforces the business contract.',
  };

  yield {
    state: labelMatrix(
      'Case',
      [
        { id: 'login', label: 'login' },
        { id: 'llm', label: 'LLM' },
        { id: 'tenant', label: 'tenant' },
        { id: 'scrape', label: 'scrape' },
      ],
      [
        { id: 'key', label: 'key' },
        { id: 'limit', label: 'limit' },
      ],
      [
        ['ipusr', 'burst'],
        ['key', 'cost'],
        ['tenant', 'plan'],
        ['ASN', 'drop'],
      ],
    ),
    highlight: { active: ['login:key', 'llm:limit', 'tenant:limit', 'scrape:key'], compare: ['scrape:limit'] },
    explanation: 'Complete case study: an AI gateway classifies requests by tenant, API key, model tier, and route class. Envoy applies a local burst guard, sends a descriptor vector to the global service, receives OK or over limit, adds rate-limit headers, and logs descriptor decisions into tracing for billing and abuse review.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'descriptor tree') yield* descriptorTree();
  else if (view === 'quota loop') yield* quotaLoop();
  else throw new InputError('Pick an Envoy rate-limit view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the descriptor path as request classification before counting. Active means Envoy is extracting a request fact or spending quota, visited means a descriptor element has been matched, and found means the limiter has selected the budget that decides allow or reject.',
        'The safe inference rule is boundary fit. A counter protects the resource named by its descriptor, not the resource the operator meant in prose. If the descriptor groups traffic poorly, the limiter enforces the wrong fairness rule quickly.',
        {type:'callout', text:'Envoy rate limiting is a classification problem before it is a counter problem: the descriptor vector defines the fairness boundary that quota should spend from.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Rate limiting is a control that rejects or delays requests before shared capacity is exhausted. Envoy is a proxy that already sees inbound requests, route matches, headers, peer information, and response behavior. That makes it a natural enforcement point.',
        'The hard part is not returning HTTP 429. The hard part is deciding which budget a request should spend. A login attempt, refund call, inference request, and batch job can all have different cost and fairness boundaries.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is one counter per route. It is easy to configure and protects an origin from total route load. It also treats a free account, enterprise tenant, internal batch job, and attacker as one population.',
        'Another approach is one counter per IP address. That helps at an unauthenticated edge, but it punishes many users behind one NAT and misses attackers who rotate addresses. Raw path keys can also create millions of one-off counters.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is unfair aggregation. A broad descriptor lets one caller spend budget that should belong to another. A narrow descriptor can explode cardinality and move memory, metrics, and store load into unbounded key space.',
        'The distributed wall appears when many Envoy proxies enforce one global policy. If every request synchronously calls a central service, latency and dependency risk rise. If proxies spend locally, reports lag and temporary overspend becomes possible.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The descriptor vector is the data model. Envoy route actions extract facts such as tenant, API key, route class, method, remote address, model tier, or token estimate. The ordered vector becomes the key that the limiter evaluates.',
        'A descriptor encodes a fairness boundary. A payments API might spend tenant plus route-class budget. An AI gateway might spend tenant plus model-family plus estimated-token budget. The limiter is only as accurate as that boundary.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Local rate limiting keeps token buckets inside Envoy. A token bucket allows a burst up to its capacity and refills at a configured rate. This is fast and resilient, but each proxy has only a local view.',
        'Global rate limiting sends the descriptor vector to an external rate-limit service. The service matches policy, updates counters or buckets in a backing store, and returns OK or over limit. Envoy forwards the request or returns a limit response.',
        'Quota mode allocates a block of budget to each proxy. The proxy spends locally and reports usage back to the allocator. This reduces hot-path calls, but correctness now depends on allocation size, report interval, skew, and failure behavior.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The design works because classification, policy, and enforcement are separated. Envoy is close to the request, the rate-limit service owns shared policy, and the backing store owns cross-proxy state. The descriptor is the contract between those parts.',
        'Layering works because cheap local rules can absorb obvious floods, global checks can enforce fleet-wide fairness, and quota allocation can reduce central calls on hot paths. The correct mix depends on latency budget, abuse risk, and how expensive the protected action is.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A global check adds a network hop and a dependency to the request path. If it adds 2 ms to a 20 ms API, that is a 10 percent latency tax before store contention. Fail-open preserves availability but can leak capacity; fail-closed protects capacity but can reject valid traffic.',
        'Descriptor cardinality is the main data cost. A tenant route key for 1,000 tenants and 20 route classes creates up to 20,000 counters. Adding raw user id with 10,000,000 users can create a store and metrics problem if most keys are cold.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'API gateways use descriptor limits for plan tiers, expensive routes, login attempts, scraping defenses, and tenant fairness. The access pattern is per-request classification followed by a small state update.',
        'AI gateways make the model clear. A request for 200 input tokens to a small model is not the same as a request for 120,000 input tokens to a large model. Useful descriptors include tenant, key, model family, route class, and estimated token cost.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Rate limiting is not abuse detection. Attackers can rotate accounts, addresses, user agents, or routes if descriptors are weak. Legitimate users can also look abusive when many share an address or run a scheduled batch.',
        'It also fails when failure policy is not rehearsed. A limiter outage can become either customer outage or uncontrolled traffic surge. Shadow mode, staged rollout, client backoff behavior, and clear headers are part of the system.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose tenant acme has a global limit of 1,000 requests per minute for route class search. Two Envoy proxies each see 600 requests in one minute. Local-only 1,000-per-proxy buckets would allow 1,200 total requests and violate the tenant budget.',
        'With a global descriptor [tenant=acme, route=search], both proxies spend from one shared counter and the extra 200 requests are rejected or delayed. With quota mode, the allocator might give each proxy 500 tokens for the minute. If one proxy needs 700 and the other needs 300, rebalancing speed decides whether valid traffic is rejected or overspend occurs.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Envoy global rate limiting at https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/other_features/global_rate_limiting, Envoy local rate limit filter at https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/local_rate_limit_filter, Envoy HTTP rate limit proto at https://www.envoyproxy.io/docs/envoy/latest/api-v3/extensions/filters/http/ratelimit/v3/rate_limit.proto, and reference service at https://github.com/envoyproxy/ratelimit. Use the docs for filter behavior and the reference service for descriptor matching.',
        'Study Rate Limiter for token-bucket mechanics, Hash Table for keyed counters, gRPC HTTP/2 Stream Multiplexing for service calls, Backpressure and Circuit Breakers for overload behavior, OPA Rego Policy Decision Graph for policy separation, and Distributed Tracing for quota observability. The next step is to connect quota decisions to user-visible retry behavior.',
      ],
    },
  ],
};
