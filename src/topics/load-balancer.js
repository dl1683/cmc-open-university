// Load balancing: one front door, many servers. Round-robin deals requests
// like cards; least-connections asks who's free. Watch the same traffic
// land differently under each strategy.

import { arrayState, parseNumberList, InputError } from '../core/state.js';

export const topic = {
  id: 'load-balancer',
  title: 'Load Balancer',
  category: 'Systems',
  summary: 'Route incoming requests across servers — round-robin vs least-connections, on identical traffic.',
  controls: [
    { id: 'strategy', label: 'Strategy', type: 'select', options: ['round-robin', 'least-connections'], defaultValue: 'round-robin' },
    { id: 'durations', label: 'Request durations (ticks)', type: 'number-list', defaultValue: '4, 1, 4, 1, 4, 1, 2, 1' },
  ],
  run,
};

const SERVERS = 3;

export function* run(input) {
  const strategy = input.strategy;
  const durations = parseNumberList(input.durations, { min: 4, max: 10, label: 'durations' });
  if (durations.some((d) => d < 1 || d > 8 || !Number.isInteger(d))) {
    throw new InputError('Durations must be whole numbers of ticks between 1 and 8.');
  }

  // loads[s] = list of remaining tick counts for requests running on server s
  const loads = Array.from({ length: SERVERS }, () => []);
  const counts = () => loads.map((l) => l.length);
  const snapshot = () => arrayState(counts(), { });
  const name = (s) => `Server ${s + 1}`;

  yield {
    state: snapshot(),
    highlight: {},
    explanation: `One website, ${SERVERS} identical servers (the boxes show each server's ACTIVE connections), and ${durations.length} incoming requests of varying duration. The load balancer is the front door that decides who serves whom. Strategy: ${strategy.toUpperCase()}. ${strategy === 'round-robin' ? 'Deal requests in a circle: 1 → 2 → 3 → 1 → … Simple, stateless, no questions asked.' : 'Always pick the server with the FEWEST active connections — it asks "who is actually free?" instead of assuming.'}`,
  };

  let peak = 0;
  for (let tick = 0; tick < durations.length; tick += 1) {
    // requests finish before the next one arrives
    let finished = 0;
    for (const server of loads) {
      for (let i = server.length - 1; i >= 0; i -= 1) {
        server[i] -= 1;
        if (server[i] === 0) { server.splice(i, 1); finished += 1; }
      }
    }

    const chosen = strategy === 'round-robin'
      ? tick % SERVERS
      : counts().indexOf(Math.min(...counts()));

    yield {
      state: snapshot(),
      highlight: { compare: counts().map((_, s) => `i${s}`), active: [`i${chosen}`] },
      explanation: `Request #${tick + 1} arrives (it will run for ${durations[tick]} tick${durations[tick] === 1 ? '' : 's'})${finished ? ` — meanwhile ${finished} earlier request${finished === 1 ? '' : 's'} finished` : ''}. ${strategy === 'round-robin' ? `Round-robin doesn't look at the loads at all: position ${tick + 1} in the cycle means ${name(chosen)}.` : `Current loads are [${counts().join(', ')}] — ${name(chosen)} has the fewest, so it wins.`}`,
      invariant: strategy === 'least-connections' ? 'A new request never lands on a busier server than necessary.' : undefined,
    };

    loads[chosen].push(durations[tick]);
    peak = Math.max(peak, counts()[chosen]);
    yield {
      state: snapshot(),
      highlight: { active: [`i${chosen}`] },
      explanation: `${name(chosen)} takes it — now at ${counts()[chosen]} active connection${counts()[chosen] === 1 ? '' : 's'}.`,
    };
  }

  yield {
    state: snapshot(),
    highlight: {},
    explanation: `Traffic done. Busiest moment on any single server: ${peak} concurrent requests. ${strategy === 'round-robin' ? 'Notice how round-robin happily piled long requests onto the same server while others sat idle — it is blind to load. Re-run this exact traffic with least-connections and compare.' : 'Least-connections kept the load level because it reacts to reality — at the cost of tracking state for every server. Re-run with round-robin to see the blind version.'} Real balancers (nginx, AWS ELB) add health checks (skip dead servers), sticky sessions (same user → same server, via hashing — see Hash Table), and weights for bigger machines. This one idea is why the internet survives traffic spikes.`,
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `A load balancer is the traffic director in front of a fleet of servers. Clients connect to one stable address, while the balancer chooses which backend receives each request. Ten machines that each handle 10,000 requests per second can serve about 100,000 while exposing one address. The same idea appears at several layers: DNS chooses a region, a Layer 4 balancer forwards TCP connections, and a Layer 7 proxy such as NGINX or Envoy routes HTTP requests by path, header, tenant, or health.`,
        `Classic strategies are deliberately simple. Round-robin cycles through backends. Weighted round-robin gives a larger server more turns. Least-connections sends the next request to the backend with the fewest active requests. Power of Two Choices Load Balancing sits between those extremes: sample two backends, compare their active request counts, and avoid most bad placements without scanning the whole pool. More advanced systems add latency-aware routing, outlier detection, sticky sessions, and ring-based placement borrowed from Consistent Hashing when cache locality matters. SLO-Aware LLM Request Router shows the LLM-serving version, where queue depth is only one signal beside prefix-cache locality, KV state, privacy, and p99 budget.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The balancer keeps a live membership list: which servers are healthy, what weight each has, and sometimes how many connections or requests are active. A round-robin implementation is just a counter modulo the healthy server count. Least-connections needs a counter per server and must decrement it when the request finishes. Health checks remove a server after repeated failures, commonly 2 or 3 failed probes, and add it back only after successful probes so traffic does not flap.`,
        `Layer 4 balancers work with IPs, ports, and connections; they are fast because they do not parse application payloads. Layer 7 balancers terminate HTTP or TLS and can route /api to one pool and /images to another, but they spend CPU parsing requests. At high scale the load balancer itself is replicated: AWS Network Load Balancer, Google Cloud Load Balancing, HAProxy pairs with VRRP, and Kubernetes Services all hide multiple balancer instances behind one virtual endpoint.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Round-robin selection is O(1). Least-connections is O(n) if it scans n backends, though production systems usually keep a heap, sample two choices, or maintain per-worker counters to avoid a hot global lock. The larger cost is not the algorithm; it is tail behavior. One overloaded backend can dominate Tail Latency & p99 Thinking even when average load looks fine. Cross-zone routing can add 1-20 ms, TLS termination burns CPU, and sticky sessions reduce balancing quality because one heavy user can pin to one server.`,
        `Operationally, the balancer is part of the failure domain. Bad health checks can drain a healthy fleet. A stale backend list can send traffic into a deploy that already rolled back. Connection draining matters during deploys: stop assigning new work, let old requests finish for perhaps 30-300 seconds, then terminate.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `NGINX appeared in 2004 to solve the C10k web-server problem and remains a common reverse proxy. HAProxy, first released around 2000, is standard in low-latency TCP and HTTP fleets. Envoy, created at Lyft, popularized sidecar and service-mesh balancing. Cloudflare and Akamai combine load balancing with CDN Request Flow so users hit a nearby edge instead of a distant origin. Kubernetes uses kube-proxy or eBPF datapaths to spread Service traffic across pods. Databases and caches also use balancing, but they often combine it with Sharding & Partitioning so writes land on the shard that owns the key.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Even request counts are not equal work. A 5 ms cache hit and a 5 second report export both count as one request, so round-robin can look fair while one backend melts. Least-connections helps long requests but can overfeed a freshly restarted server whose counters begin at zero. Latency-based routing sounds ideal, but it can amplify noise: one slow measurement may drain traffic from a perfectly healthy server.`,
        `A load balancer is not a capacity machine. If the fleet can process 50,000 requests per second and users send 80,000, routing cannot create the missing 30,000. That is where Rate Limiter (Token Bucket), autoscaling, Queue-based buffering, and backpressure matter. Another trap is state: sticky sessions make login carts easy, but they hide state in one backend and make failover worse. Prefer shared storage, signed cookies, or explicit cache state when possible.`,
      ],
    },
    {
      heading: `Sources and study next`,
      paragraphs: [
        `Production references: NGINX HTTP load-balancing docs at https://docs.nginx.com/nginx/admin-guide/load-balancer/http-load-balancer/, Envoy load-balancer docs at https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/load_balancing/load_balancers, and HAProxy load-balancing algorithm notes at https://www.haproxy.com/glossary/what-are-load-balancing-algorithms. Study Queue to understand why request buffers smooth short spikes but cannot fix sustained overload. Power of Two Choices Load Balancing is the next algorithmic step after round-robin and least-connections. Use Hash Table for the key-to-backend mapping beneath routing tables and session stores. Consistent Hashing explains why cache clusters avoid remapping every key during membership changes. SLO-Aware LLM Request Router shows how the same balancing foundation changes when each backend owns live KV cache and token-streaming SLOs. Rate Limiter (Token Bucket) covers the front-door control that protects the balancer and backend pool. Then read Tail Latency & p99 Thinking and CDN Request Flow to see why the slowest hop, not the average hop, often defines the user experience.`,
      ],
    },
  ],
};
