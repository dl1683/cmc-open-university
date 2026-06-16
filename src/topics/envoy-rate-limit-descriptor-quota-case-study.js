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
    explanation: 'Envoy rate limiting often starts with route actions. The proxy extracts values such as path class, remote address, request header, tenant, method, or authenticated principal and turns them into a descriptor vector.',
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
    explanation: 'Quota-based limiting changes the loop. Instead of checking every request against a central counter, Envoy receives quota allocations, spends them locally, and periodically reports load so the allocator can rebalance global budget.',
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
      heading: 'What it is',
      paragraphs: [
        'Envoy can enforce rate limits locally in the proxy or globally through an external rate-limit service. The data-structure lesson is the descriptor: a structured vector of key-value entries derived from route actions, request attributes, headers, principals, tenant IDs, or path classes. That descriptor becomes the lookup key for a policy decision.',
        'Primary sources: Envoy global rate limiting at https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/other_features/global_rate_limiting, Envoy local rate limit filter docs at https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/local_rate_limit_filter, Envoy HTTP rate limit proto docs at https://www.envoyproxy.io/docs/envoy/latest/api-v3/extensions/filters/http/ratelimit/v3/rate_limit.proto, and the reference rate-limit service at https://github.com/envoyproxy/ratelimit.',
      ],
    },
    {
      heading: 'Descriptor vectors',
      paragraphs: [
        'A descriptor is more expressive than a single counter name. One route can emit domain=payments, key=tenant, value=t_123, key=method, value=refund, key=plan, value=pro. The rate-limit service matches descriptor hierarchies against configured policies and updates the relevant counters or buckets.',
        'Choosing the descriptor shape is the hard part. IP-only keys are easy but unfair behind NAT. User-only keys are weak against account farms. Raw path keys can explode cardinality. Tenant, plan, route class, auth strength, and request cost often make better fairness boundaries.',
      ],
    },
    {
      heading: 'Local, global, and quota modes',
      paragraphs: [
        'Local rate limiting is fast because the proxy decides with local token buckets. It is good for broad edge protection, but each Envoy instance has its own view unless state is coordinated elsewhere. Global rate limiting asks an external service on the request path, which gives stronger cross-proxy fairness at the cost of latency and dependency risk.',
        'Quota mode shifts from per-request central checks to allocation and reporting. Envoy spends a granted quota locally and periodically reports load so a central allocator can rebalance. That works better at high request rates, but it introduces distributed-counter issues: skew, delayed reports, bursts, and fail behavior.',
      ],
    },
    {
      heading: 'Complete case study: AI gateway',
      paragraphs: [
        'An AI gateway protects expensive inference endpoints. Envoy extracts API key, tenant, model tier, route class, and approximate request cost. A local bucket rejects obvious bursts. A global descriptor check enforces tenant plan quotas. The service records counters in Redis, returns OK or over limit, and includes rate-limit headers so SDKs can back off.',
        'The same workflow links to Rate Limiter for token buckets, Hash Table for per-key counters, gRPC HTTP/2 Stream Multiplexing for the external service call, Load Balancer for edge placement, Circuit Breakers for limiter dependency failure, OPA Rego Policy Decision Graph for policy separation, and Distributed Tracing for auditing quota decisions.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Rate limiting is not abuse detection. It is a resource budget. Attackers can rotate keys, IPs, tenants, or routes if descriptors are naive. Conversely, strict limits can harm legitimate shared networks. Good systems combine authentication, descriptor design, local and global limits, anomaly signals, retry-after hints, and clear client SDK behavior.',
        'Fail-open and fail-closed are product decisions as much as reliability decisions. Fail-open can protect availability while allowing overload or cost leakage. Fail-closed can protect capacity while causing false 429s during limiter outages. Shadow mode is useful because it lets teams observe descriptor distribution and would-have-limited counts before enforcement.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Rate Limiter for token-bucket mechanics, Hash Table for keyed counters, gRPC HTTP/2 Stream Multiplexing for the global service call, Load Balancer and CDN Request Flow for placement, Backpressure and Circuit Breakers for overload behavior, OPA Rego Policy Decision Graph for policy separation, and Distributed Tracing for quota observability.',
      ],
    },
  ],
};
