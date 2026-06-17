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
      heading: "Why this exists",
      paragraphs: [
        "Rate limiting exists because shared services need a way to say no before overload turns into an outage. A gateway may sit in front of login, payments, search, inference, or internal APIs where one caller can consume capacity that belongs to everyone else. The rate limiter turns a product or reliability rule into a per-request decision: allow this request now, slow it down, or reject it with a clear retry signal.",
        "Envoy is a natural enforcement point because traffic already crosses it. But the important lesson is not that Envoy can return 429. The important lesson is that rate limiting is a data-modeling problem. Before a counter can be checked, the proxy has to decide what kind of traffic this request represents and which fairness boundary it should spend from.",
      ],
    },
    {
      heading: "The naive approach",
      paragraphs: [
        "The first naive design is one counter per route. That is easy to configure, but it treats a free test account, an enterprise tenant, a background batch job, and an attacker as the same population. It protects the origin from total load while saying almost nothing about who is using the budget.",
        "The second naive design is one counter per IP address. That is useful at an unauthenticated edge, but it breaks quickly. A corporate office, mobile carrier, school, or NAT gateway can put many legitimate users behind one address. Attackers can rotate addresses. Raw URL keys are another trap because they can explode cardinality and move hot state into millions of one-off counters.",
      ],
    },
    {
      heading: "The core insight",
      paragraphs: [
        "The core insight is the descriptor vector. Envoy route actions extract request facts such as route name, tenant, API key, authenticated subject, request header, method, path class, or remote address. Those facts are assembled into a structured vector. The vector is the key that the limiter reads.",
        "A descriptor is not just a prettier counter name. It encodes the fairness boundary. A payments refund call might spend from a tenant budget, a method budget, and a route-class budget. An LLM request might include tenant, model tier, API key, and estimated token cost. The limiter works only as well as that descriptor matches the real resource contract.",
      ],
    },
    {
      heading: "How the mechanism works",
      paragraphs: [
        "Local rate limiting keeps the decision inside the proxy. Envoy can maintain token buckets for broad limits such as a maximum burst per listener, route, or connection. This is fast and resilient because no external service is needed on the hot path. The cost is that each proxy has a local view unless a higher layer coordinates state.",
        "Global rate limiting sends the descriptor vector to an external rate-limit service, often over gRPC. The service matches descriptor hierarchies against policy, updates counters or token buckets in a backing store such as Redis, and returns OK or over limit. Envoy then forwards the request or returns a rate-limit response, usually with headers that tell clients how to back off.",
        "Quota mode changes the loop again. Instead of asking the central service on every request, Envoy receives an allocation, spends it locally, and reports usage back. The allocator can rebalance future quota across proxies or tenants. That improves hot-path speed, but it turns rate limiting into a distributed counter problem with skew, stale reports, and burst windows.",
      ],
    },
    {
      heading: "What the visual is proving",
      paragraphs: [
        "The descriptor-tree view proves that rate limiting starts before storage. The request enters Envoy, route actions classify it, and the descriptor node becomes the compact representation of the policy question. The RLS and Redis nodes are downstream. If the descriptor is too broad, too narrow, or too easy to evade, the rest of the system faithfully enforces the wrong rule.",
        "The quota-loop view proves a different point: performance is bought by moving work from synchronous checking to allocation and reporting. The proxy can answer locally while the allocator catches up. The visual is not saying quota mode is weaker by default. It is showing where the new correctness burden lives: report intervals, smoothing, conservative release, and failure behavior.",
      ],
    },
    {
      heading: "Why it works",
      paragraphs: [
        "The design works because it separates classification, policy, and enforcement. Envoy is good at seeing the request and applying the result. A rate-limit service is better at holding global policy and shared counters. A store is better at durable, cross-proxy state. The descriptor is the contract between those pieces.",
        "Layering also works. A cheap local bucket can absorb obvious floods before they hit the global service. A global descriptor check can enforce tenant or plan fairness across the fleet. Quota allocation can reduce central calls on very hot paths. Good systems use these modes together instead of treating one limiter as a universal answer.",
      ],
    },
    {
      heading: "Costs and tradeoffs",
      paragraphs: [
        "Global checks add latency and a dependency. If the rate-limit service or its store is unhealthy, the gateway needs a fail policy. Fail-open preserves availability but can allow abuse or cost leakage. Fail-closed protects capacity but can reject valid traffic during a limiter outage. Shadow mode is useful because it records would-have-limited decisions before enforcement changes user traffic.",
        "Descriptor design has its own cost. High-cardinality keys consume memory and can create hot shards or noisy metrics. Low-cardinality keys are cheaper but unfair. Quota mode reduces central traffic but allows temporary overspend when reports lag. Rate-limit headers and client SDK behavior matter because a rejected request that retries immediately is just overload in a new shape.",
      ],
    },
    {
      heading: "Real uses",
      paragraphs: [
        "API gateways use descriptor limits to enforce plan tiers, protect expensive routes, and keep one tenant from starving another. Login systems combine IP, username, device, and risk signals to slow credential stuffing without punishing an entire office network. Scraping defenses may use route class, ASN, user agent, and authentication state while still leaving room for legitimate crawlers.",
        "AI gateways make the descriptor lesson especially clear. A single request can have wildly different cost depending on model, context length, output length, tool use, and tenant plan. A useful descriptor might include tenant, API key, model family, route class, and estimated token cost. The limiter then protects dollars and GPUs, not just request count.",
      ],
    },
    {
      heading: "Failure modes and limits",
      paragraphs: [
        "Rate limiting is not abuse detection. It is a resource budget. Attackers can rotate accounts, addresses, tenants, or routes if the descriptor is naive. Legitimate users can also look abusive if many of them share one address or if a batch workflow suddenly becomes popular. The limiter should be paired with authentication, anomaly signals, tracing, and product-specific recourse.",
        "The hardest failures are silent modeling failures. A path descriptor that includes raw IDs can create unbounded counter growth. A tenant descriptor that ignores sub-accounts can let one team spend another team's quota. A quota allocator that overreacts to delayed reports can oscillate. A fail policy that is never rehearsed can turn a limiter outage into either a customer outage or an uncontrolled traffic surge.",
      ],
    },
    {
      heading: "Study next",
      paragraphs: [
        "Primary sources: Envoy global rate limiting at https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/other_features/global_rate_limiting, Envoy local rate limit filter docs at https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/local_rate_limit_filter, Envoy HTTP rate limit proto docs at https://www.envoyproxy.io/docs/envoy/latest/api-v3/extensions/filters/http/ratelimit/v3/rate_limit.proto, and the reference service at https://github.com/envoyproxy/ratelimit.",
        "Study Rate Limiter for token-bucket mechanics, Hash Table for keyed counters, gRPC HTTP/2 Stream Multiplexing for the external service call, Load Balancer and CDN Request Flow for placement, Backpressure and Circuit Breakers for overload behavior, OPA Rego Policy Decision Graph for policy separation, and Distributed Tracing for quota observability.",
      ],
    },
  ],
};
