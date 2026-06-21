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
      heading: 'How to read the animation',
      paragraphs: [
        'Each bar is one server. The bar height is the number of active connections on that server right now. When a request arrives, the balancer picks a server -- the chosen bar highlights. Compare highlights show which servers were evaluated.',
        {type: 'callout', text: 'A load balancer is useful only when its routing signal matches real work, not just request count.'},
        'The key experiment: run the same request durations under round-robin, then switch to least-connections. Round-robin ignores the bars and picks by position in a cycle. Least-connections reads the bars and picks the shortest one. The gap in peak load between the two runs is the cost of ignoring state.',
        'Watch for the moment a long request is still running on a server when round-robin sends it another long request. That pileup is the failure mode the animation surfaces.',
      
        {type: 'image', src: './assets/gifs/load-balancer.gif', alt: 'Animated walkthrough of the load balancer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A service outgrows one machine long before it outgrows one address. Users keep calling the same endpoint while the system adds replicas, removes broken ones, drains old versions, and absorbs traffic spikes. A load balancer hides backend membership from clients and turns a pool of machines into one service.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg', alt: 'Rows of servers in a datacenter', caption: 'A service pool turns many machines into one endpoint, but the front door still has to choose a backend for each request. Source: Wikimedia Commons, Victorgrigas, CC BY-SA 3.0.'},
        'The routing decision looks trivial -- just pick a server -- but requests are not equal. A cache hit finishes in microseconds. A report query holds a database connection for seconds. A policy that distributes request counts evenly can still distribute work badly.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Random assignment: hash the request ID (or just flip a coin) and send it to whichever server the hash picks. No state, no coordination, and over enough requests the counts converge. For identical servers handling identical work, random is hard to beat.',
        'Round-robin is the structured version: server 1, server 2, server 3, repeat. It guarantees perfectly equal counts over each full cycle. Still no per-server state. Still O(1). Most tutorials start here because it is the simplest correct policy for the simplest case.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Neither random nor round-robin knows what the servers are doing. If request 1 takes 4 ticks and request 2 takes 1 tick, round-robin will send request 4 back to server 1 while request 1 is still running -- even though server 2 finished its short request ages ago.',
        'The deeper problem: servers are not always identical. One machine may have twice the CPU. One may be warming up after a deploy. One may be degraded. Equal turns produce unequal load whenever request cost or server capacity varies. The balancer needs at least one signal about current state to avoid obvious bad choices.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Five policies cover the practical space. Each adds one more piece of information to the routing decision.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Packet_Switching.gif', alt: 'Packet switching animation showing traffic moving across a network', caption: 'Requests arrive as network traffic, but balancing quality depends on backend state after packets reach the service edge. Source: Wikimedia Commons, Oddbodz, public domain.'},
        'Round-robin advances a counter modulo the server count. O(1), stateless, blind to load. It works when servers are identical and request durations are similar.',
        'Weighted round-robin gives each server a weight proportional to its capacity. A server with weight 3 gets three turns for every one turn a weight-1 server gets. Still stateless per-request, but requires knowing relative capacity up front.',
        'Least connections tracks the number of active connections on each server. A new request goes to the server with the fewest. The balancer increments the count on assignment and decrements it when the request finishes. This is the first policy that reacts to actual load.',
        'Consistent hashing maps each request key to a position on a hash ring and routes to the nearest server on the ring. When a server joins or leaves, only the keys near it remap -- the rest stay put. This preserves cache locality and session affinity at the cost of potentially uneven load.',
        'Power of two choices (Mitzenmacher, 2001): pick two servers at random, then send the request to whichever has fewer active connections. This reads far less state than a full least-connections scan but avoids most bad placements. The maximum load drops from O(log n / log log n) under random to O(log log n) -- an exponential improvement from one extra probe.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Round-robin distributes counts perfectly over each full cycle. Over many requests, no server receives more than one extra request compared to any other. The guarantee is about count, not about work.',
        'Least-connections maintains a stronger invariant: at the moment of assignment, no eligible server has fewer active connections than the chosen server. It cannot predict the future duration of the incoming request, but it avoids piling new work onto the busiest server. That single correction is enough to handle mixed-duration workloads far better than blind rotation.',
        'Power of two choices works because of a phase transition in balls-into-bins probability. Under pure random placement, the most loaded bin holds O(log n / log log n) balls. Adding one comparison -- just two random samples instead of one -- collapses the maximum to O(log log n). With 1,000 servers, that is roughly the difference between a max load of 4 and a max load of 2. The proof (Azar et al., 1994; Mitzenmacher, 2001) shows the improvement is exponential in the number of choices, but almost all the gain comes from going from one choice to two.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Round-robin: O(1) time, zero per-server state. Doubling the fleet changes nothing in the routing logic. The weakness is blindness -- it cannot adapt to varying load, capacity, or request cost.',
        'Least connections: O(n) if you scan all servers, O(log n) if you maintain a min-heap keyed by active count. Each request requires an increment on arrival and a decrement on completion, so the balancer must track connection lifecycle. The state is small (one integer per server) but must be updated atomically under concurrent traffic.',
        'Power of two choices: O(1) time -- two random probes and one comparison. The state cost is the same as least-connections (one counter per server) but the coordination cost is lower because each decision reads only two counters instead of all of them. In large distributed systems where a single global view is expensive, this is a major practical advantage.',
        'Consistent hashing: O(log n) lookup via binary search on the ring. Adding or removing a server remaps O(k/n) keys where k is the total key space. Virtual nodes improve balance but increase ring size and lookup cost.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'NGINX uses round-robin as its default upstream policy and supports least_conn and ip_hash as alternatives. HAProxy adds queue-aware routing and server weights. AWS ALB uses round-robin at Layer 7 with slow-start for new targets. AWS NLB operates at Layer 4 with flow-hash-based routing.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Internet_map_1024.jpg', alt: 'Internet topology map with many connected network paths', caption: 'Global balancing happens above local backend choice: users must reach a region, edge, or datacenter before a local server is selected. Source: Wikimedia Commons, The Opte Project, CC BY 2.5.'},
        'Kubernetes Services use iptables or IPVS to distribute traffic across pods. IPVS mode supports round-robin, least-connections, and weighted variants. Envoy (used in Istio and other service meshes) adds zone-aware routing, outlier detection, and retry budgets on top of the core selection policies.',
        'CDN edge networks use anycast (one IP, many servers, BGP picks the nearest) combined with consistent hashing to preserve cache hits. DNS-based global load balancing routes users to the nearest datacenter before the CDN edge takes over.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Session affinity complicates stateless balancing. If user A must always reach server 1 (because of login state, a shopping cart, or a WebSocket), the balancer loses freedom to spread load. The fix is to externalize session state (Redis, a shared database) so any server can handle any user -- but that adds a dependency and latency.',
        'Health checks add overhead and introduce a detection delay. A server can fail between checks, causing requests to land on a dead backend until the next check runs. Aggressive check intervals reduce the window but increase probe traffic. Passive health checking (marking a server unhealthy after N consecutive failures from real traffic) reacts faster but can false-positive under transient errors.',
        'A load balancer cannot create capacity. If the fleet handles 50,000 requests per second and users send 80,000, routing only decides where overload appears. Rate limiting, autoscaling, backpressure, and load shedding decide whether the system degrades gracefully or cascades.',
        'Connection draining during deploys requires coordination: stop sending new requests to the old server, wait for active connections to finish (with a timeout), then remove it. Without draining, deploys drop in-flight requests. With draining, deploys are slower and the fleet temporarily runs at reduced capacity.',
        'Front-door balance can hide downstream hotspots. The balancer may spread requests evenly across web servers, but every web server hammers the same database or payment API. End-to-end load management needs downstream signals, not just front-end counts.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Three servers, 10 requests. Request durations in ticks: 4, 1, 4, 1, 4, 1, 2, 1, 3, 1. One tick elapses between each arrival. Each server processes one tick of each active request before the next request arrives.',
        'Round-robin assigns by position: S1 gets requests 1, 4, 7, 10. S2 gets 2, 5, 8. S3 gets 3, 6, 9. Request 1 (duration 4) is still active on S1 when request 4 (duration 1) arrives. S1 now has 2 active connections. Request 7 (duration 2) arrives at S1 while request 1 may still be finishing. Peak on S1: 2 concurrent connections.',
        'Least-connections checks active counts before each assignment. Request 1 goes to S1 (all at 0, tie-break picks S1). Request 2: S1 has 1 active, S2 and S3 have 0 -- S2 wins. Request 3: S1 still has 1 (duration 4), S2 finished (duration 1), S3 at 0 -- tie between S2 and S3, S3 wins. Request 4: S1 has 1, S2 has 0, S3 has 1 -- S2 wins. The long requests spread across servers instead of piling onto one.',
        'Result: under round-robin, S1 peaks at 2 concurrent connections while S2 sometimes sits idle. Under least-connections, the peak across all servers stays at 1 for most of the run. The same traffic, the same servers, different peak load -- because one policy uses information and the other does not.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Mitzenmacher, "The Power of Two Choices in Randomized Load Balancing" (IEEE TPDS, 2001) proves the exponential improvement from two random probes. Azar, Broder, Karlin, and Upfal, "Balanced Allocations" (STOC 1994) established the foundational balls-into-bins result.',
        'Prerequisites: understand what a server is, what a request is, and why one machine has finite throughput. Hash Table covers the key-to-slot mapping that consistent hashing and session stores rely on.',
        'Next topics by role: Consistent Hashing (route by key without reshuffling on membership change), Rate Limiter (protect the servers behind the balancer), Circuit Breaker (remove failed backends automatically and restore them gradually), Queue (buffer during short spikes), and Power of Two Choices Load Balancing (the full algorithmic treatment). For production reference: NGINX load-balancing docs, Envoy upstream load-balancing architecture, and HAProxy algorithm notes.',
      ],
    },
  ],
};
