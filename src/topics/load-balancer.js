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
      heading: 'Why this exists',
      paragraphs: [
        `A service usually outgrows one machine before it outgrows one address. Users should keep calling the same endpoint while the system adds replicas, removes broken replicas, drains old versions, and survives traffic spikes. A load balancer is the boundary that hides backend membership from clients and turns a pool of machines into one service.`,
        `The basic need is simple: choose a healthy backend for each request. The hard part is that requests are not equal. One request may be a cache hit that finishes in a few milliseconds. Another may run a report, stream a file, call a model, or wait on a database. A policy that distributes request counts evenly can still distribute work badly.`,
        `Load balancing exists because distributed systems need a cheap routing decision at the front door. It is not a proof of optimal scheduling. It is a practical control loop: observe enough state, filter out bad choices, pick a backend, and update the next decision when reality changes.`,
      ],
    },
    {
      heading: 'The simple approach and the wall',
      paragraphs: [
        `The simple approach is round-robin. Send request 1 to server 1, request 2 to server 2, request 3 to server 3, then wrap around. It is fast, easy to reason about, and nearly stateless. When servers are identical and request durations are similar, round-robin can be exactly the boring policy you want.`,
        `The wall appears when fair turns are not fair work. If three long requests land on the same server because of timing, that server can become slow while another server is idle. Round-robin does not ask who is busy. It only asks whose turn is next.`,
        `The second wall is failure. A dead backend is still a backend unless health checks remove it from the eligible set. A deploying backend may need to finish old requests but receive no new ones. A backend in another zone may be healthy but too expensive for latency-sensitive traffic. A real balancer is a policy engine, not just a counter.`,
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        `The core insight is that load balancing has two jobs. First, form the eligible set: healthy, compatible backends that are allowed to receive this request. Second, choose among that set using a signal that matches the workload: turn order, weight, active connections, queue depth, latency, locality, hash key, or cost.`,
        `Least-connections makes one useful invariant visible. A new request should not land on a backend that is known to be busier than another eligible backend. That does not make the decision globally optimal, because active connection count is only a proxy for real work. But it often avoids the obvious bad choice that round-robin cannot see.`,
        `The best policy is usually the cheapest policy that prevents the service's common failure mode. A static website can use round-robin. A pool serving long mixed-duration requests may need least-connections or queue-aware routing. A cache cluster may need consistent hashing. An LLM-serving fleet may need KV-cache locality and token-streaming SLOs.`,
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        `The animation uses the same request durations for both strategies. That is the point. Round-robin and least-connections see the same traffic but make different choices because they use different information. Round-robin follows position in the cycle. Least-connections looks at active work before choosing.`,
        `The bars show active connections, not total historical requests. A server that handled many short requests may be free again, while a server that accepted fewer long requests may still be busy. Least-connections reacts to that difference. Round-robin ignores it unless the timing happens to line up well.`,
        `The final peak count is a small version of tail-latency thinking. A fleet can look balanced by total request count and still create one overloaded server. In real systems that overloaded server becomes the source of p95 and p99 latency, retries, timeouts, and cascading pressure on dependencies.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `A balancer starts with membership. It needs to know which backends exist, which are healthy, which are draining, which have capacity weight, and which can serve this request's protocol or tenant. Health checks remove dead or degraded backends. Draining lets deploys stop new work while old connections finish.`,
        `A Layer 4 balancer works at the TCP or UDP level. It can forward connections using IPs and ports with little application awareness. A Layer 7 proxy understands HTTP or another application protocol. It can route by path, host, header, method, cookie, tenant, or request class, but it pays CPU and complexity for parsing, TLS termination, and richer policy.`,
        `The selection rule then runs per connection or per request. Round-robin advances a counter modulo the healthy backend count. Weighted round-robin gives larger machines more turns. Least-connections tracks active work and decrements counters when requests finish. Sticky sessions and consistent hashing preserve affinity when local cache, session state, or key ownership matters more than perfect spreading.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The safety property is modest but important: the balancer chooses only among backends it currently believes can serve the request. Health checks keep dead replicas out of the choice set. Draining keeps deploys from dropping active users. Capacity weights prevent a small instance and a large instance from receiving identical load when they cannot process identical work.`,
        `Least-connections works because active work is often a better signal than turn order. It does not know the future duration of the request that just arrived, but it can avoid sending new work to a server already holding more active connections than its peers. That cheap correction is enough to improve many mixed-duration workloads.`,
        `Power of Two Choices explains why you often do not need a perfect scan. Pick two random eligible backends and choose the less loaded one. This reads far less state than a full least-connections scan while avoiding many terrible placements. Production systems often use approximations like this because centralized perfect knowledge becomes its own bottleneck.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Suppose three servers receive eight requests with durations 4, 1, 4, 1, 4, 1, 2, and 1 ticks. Round-robin sends them by position: server 1, server 2, server 3, then server 1 again. It does not care that a long request may still be running when the next turn arrives.`,
        `Least-connections checks the active counts before each arrival. If server 1 is still running a long request and server 2 is free, server 2 wins. The decision is local and simple, but it follows reality more closely than a fixed cycle. The result is usually a lower peak number of concurrent requests on any one server.`,
        `This example is intentionally small. In a real fleet, the same logic applies to thousands of replicas and many request classes. A video upload, a search query, a login request, and a report export should not all be treated as equal work if the system has enough information to do better.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `Round-robin is O(1) and needs almost no per-backend load state. That makes it robust and cheap. Its weakness is blindness. It does not see active work, request cost, cache locality, or latency. It is a good default only when those missing signals do not matter much.`,
        `A naive least-connections policy scans all n backends, so selection is O(n). Production systems avoid a hot global scan by sampling, sharding counters, using worker-local state, or maintaining priority structures. Those optimizations reduce overhead but introduce stale or approximate information. The policy becomes a trade between accuracy and coordination cost.`,
        `Layer 7 balancing adds expressive power and more failure modes. TLS termination consumes CPU. Header parsing can become a bottleneck. Retries can amplify overload if they are not budgeted. Sticky sessions improve affinity but reduce freedom. Cross-zone routing can save capacity while adding network latency and cloud cost.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Load balancers are strongest for stateless or mostly stateless services where any healthy replica can serve a request. That includes many HTTP services, API gateways, service meshes, Kubernetes Services, edge proxies, CDN origins, read pools, and background-worker fleets.`,
        `They also work when the backend pool changes often. New replicas can be added to the membership list. Old replicas can drain. Bad replicas can be removed. Clients keep using one stable endpoint while the serving set changes underneath them.`,
        `The idea extends beyond ordinary web requests. A cache fleet may balance by key hash to preserve locality. An LLM-serving router may balance by queue depth, KV-cache residency, and deadline. A database read pool may balance by replica lag and query class. The common pattern is the same: filter eligible targets, then choose using the cheapest useful signal.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `A balancer cannot manufacture capacity. If the fleet can process 50,000 requests per second and users send 80,000, routing only decides where overload appears. Rate limiting, autoscaling, queues, backpressure, and load shedding decide whether the system fails slowly, fairly, or catastrophically.`,
        `It is also the wrong abstraction for write ordering, consensus, and key ownership. A Raft leader orders commands. A consistent-hash ring owns keys. A load balancer chooses a place to run work. Mixing those jobs can create subtle outages, such as sending writes to replicas that cannot safely accept them.`,
        `Load balancing can also hide dependency overload. The front door may distribute requests evenly across web servers, while every web server pounds the same database, cache shard, or payment API. End-to-end health needs downstream signals, not only front-end backend counts.`,
      ],
    },
    {
      heading: 'Misconceptions and pitfalls',
      paragraphs: [
        `A common misconception is that equal request counts mean equal load. They do not. Request duration, CPU cost, memory pressure, downstream calls, response size, and cache hit rate can all dominate raw count. The animation's mixed durations are a small demonstration of that gap.`,
        `Another mistake is retrying blindly. If a request times out because the fleet is overloaded, retrying immediately can multiply the traffic. Production balancers often need retry budgets, circuit breakers, outlier detection, and load shedding so "helpful" recovery behavior does not worsen the incident.`,
        `A third pitfall is ignoring observability. You need per-backend request rate, active connections, queue time, response latency, error rate, health-check state, retry count, and drain state. Without those signals, a bad balancing policy looks like random slowness rather than a fixable routing problem.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Production references: NGINX HTTP load-balancing docs at https://docs.nginx.com/nginx/admin-guide/load-balancer/http-load-balancer/, Envoy load-balancer docs at https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/load_balancing/load_balancers, and HAProxy load-balancing algorithm notes at https://www.haproxy.com/glossary/what-are-load-balancing-algorithms.`,
        `Study Queue to understand why request buffers smooth short spikes but cannot fix sustained overload. Power of Two Choices Load Balancing is the next algorithmic step after round-robin and least-connections. Use Hash Table for the key-to-backend mapping beneath routing tables and session stores. Consistent Hashing explains why cache clusters avoid remapping every key during membership changes.`,
        `Then study Rate Limiter (Token Bucket), Tail Latency and p99 Thinking, CDN Request Flow, Circuit Breaker, and Backpressure. For AI infrastructure, study SLO-Aware LLM Request Router, because LLM serving turns ordinary balancing into a stateful decision over live KV cache, prefill queues, decode slots, and token deadlines.`,
      ],
    },
  ],
};
