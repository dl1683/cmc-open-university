// Load balancing: one front door, many servers. Round-robin deals requests
// like cards; least-connections asks who's free. Watch the same traffic
// land differently under each strategy.

import { arrayState, parseNumberList, InputError } from '../core/state.js';

export const topic = {
  id: 'load-balancer',
  title: 'Load Balancer',
  category: 'Systems',
  summary: 'Route incoming requests across servers â€” round-robin vs least-connections, on identical traffic.',
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
    explanation: `One website, ${SERVERS} identical servers (the boxes show each server's ACTIVE connections), and ${durations.length} incoming requests of varying duration. The load balancer is the front door that decides who serves whom. Strategy: ${strategy.toUpperCase()}. ${strategy === 'round-robin' ? 'Deal requests in a circle: 1 â†’ 2 â†’ 3 â†’ 1 â†’ â€¦ Simple, stateless, no questions asked.' : 'Always pick the server with the FEWEST active connections â€” it asks "who is actually free?" instead of assuming.'}`,
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
      explanation: `Request #${tick + 1} arrives (it will run for ${durations[tick]} tick${durations[tick] === 1 ? '' : 's'})${finished ? ` â€” meanwhile ${finished} earlier request${finished === 1 ? '' : 's'} finished` : ''}. ${strategy === 'round-robin' ? `Round-robin doesn't look at the loads at all: position ${tick + 1} in the cycle means ${name(chosen)}.` : `Current loads are [${counts().join(', ')}] â€” ${name(chosen)} has the fewest, so it wins.`}`,
      invariant: strategy === 'least-connections' ? 'A new request never lands on a busier server than necessary.' : undefined,
    };

    loads[chosen].push(durations[tick]);
    peak = Math.max(peak, counts()[chosen]);
    yield {
      state: snapshot(),
      highlight: { active: [`i${chosen}`] },
      explanation: `${name(chosen)} takes it â€” now at ${counts()[chosen]} active connection${counts()[chosen] === 1 ? '' : 's'}.`,
    };
  }

  yield {
    state: snapshot(),
    highlight: {},
    explanation: `Traffic done. Busiest moment on any single server: ${peak} concurrent requests. ${strategy === 'round-robin' ? 'Notice how round-robin happily piled long requests onto the same server while others sat idle â€” it is blind to load. Re-run this exact traffic with least-connections and compare.' : 'Least-connections kept the load level because it reacts to reality â€” at the cost of tracking state for every server. Re-run with round-robin to see the blind version.'} Real balancers (nginx, AWS ELB) add health checks (skip dead servers), sticky sessions (same user â†’ same server, via hashing â€” see Hash Table), and weights for bigger machines. This one idea is why the internet survives traffic spikes.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Each bar is one backend server, and bar height is the number of active requests on that server. Active highlight marks the server chosen for the next request. Compare highlight marks the servers the policy inspected before choosing.',
        {type: 'callout', text: 'A load balancer is useful only when its routing signal matches real work, not just request count.'},
        'Run the same duration list under round-robin and least-connections. Round-robin ignores current bar heights and follows a cycle. Least-connections reads current load and routes to the shortest bar, so the difference in peak height is the cost of ignoring state.',
        {type: 'image', src: './assets/gifs/load-balancer.gif', alt: 'Animated walkthrough of the load balancer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A service often needs one public endpoint backed by many machines. Clients should not know which replica is healthy, warm, overloaded, draining, or newly added. A load balancer exists to choose a backend for each request while preserving the illusion of one service.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg', alt: 'Rows of servers in a datacenter', caption: 'A service pool turns many machines into one endpoint, but the front door still has to choose a backend for each request. Source: Wikimedia Commons, Victorgrigas, CC BY-SA 3.0.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is round-robin. Send request 1 to server 1, request 2 to server 2, request 3 to server 3, and repeat. It is simple, O(1), and gives equal request counts over a full cycle.',
        'That approach is reasonable when servers are identical and requests cost the same. Static file serving or uniform short RPCs can behave close enough to that model. Equal turns are easy to operate because the balancer does not need to observe backend state.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that equal request count is not equal work. A one-tick request and an eight-tick request both count as one assignment, but the second occupies a server eight times longer. Round-robin can pile long requests onto one server while another server has already finished short work.',
        'Servers also differ. One replica may be warming up, one may share a noisy node, and one may be draining during a deploy. A policy with no live signal cannot distinguish a free backend from a struggling one.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The routing signal must match the cost you are trying to control. Round-robin controls assignment count. Least-connections controls current concurrency. Weighted policies control known capacity differences, and hashing controls stickiness or cache locality.',
        'No load balancer can create capacity. It can only choose where overload appears and how quickly bad backends are avoided. The right policy is the one whose observed signal predicts remaining useful work.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Round-robin keeps a counter and advances modulo server count. Least-connections keeps one active-count counter per server, increments it when assigning, and decrements it when the request finishes. Weighted variants give larger servers more turns or lower effective load.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Packet_Switching.gif', alt: 'Packet switching animation showing traffic moving across a network', caption: 'Requests arrive as network traffic, but balancing quality depends on backend state after packets reach the service edge. Source: Wikimedia Commons, Oddbodz, public domain.'},
        'Consistent hashing routes by key so a user, cache entry, or shard usually returns to the same backend. Power of two choices samples two servers at random and chooses the less loaded one. That uses far less state than scanning all servers while avoiding many bad placements.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Round-robin works for counts because every full cycle gives each server exactly one request. Its correctness claim is only about assignment balance, not load balance. When work duration varies, the claim no longer matches the operational goal.',
        'Least-connections works because it preserves a local invariant at assignment time: no inspected eligible server has fewer active connections than the chosen one. It cannot predict future duration, but it avoids adding new work to an already busier server. Power of two choices works because one extra comparison removes most extreme imbalance in balls-into-bins placement.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Round-robin costs O(1) time and almost no state. Least-connections costs O(n) if the balancer scans all n servers, or O(log n) with a heap keyed by active count. Power of two choices stays O(1) by reading two counters and comparing them.',
        'The behavioral cost is freshness. Active-count state can lag, especially in distributed balancers, and stale health checks can send traffic to a broken backend. When fleet size doubles, scan-based policies become more expensive, while sample-based policies keep decision cost stable.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Web front doors use load balancers to spread HTTP requests across replicas. Service meshes use them inside a cluster to pick pods while respecting health, locality, and retries. CDNs and DNS systems use higher-level routing before local backend selection even begins.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Internet_map_1024.jpg', alt: 'Internet topology map with many connected network paths', caption: 'Global balancing happens above local backend choice: users must reach a region, edge, or datacenter before a local server is selected. Source: Wikimedia Commons, The Opte Project, CC BY 2.5.'},
        'The useful pattern is causal: route by live load when request durations vary, by weight when capacity differs, by key when locality matters, and by health when failure is possible. Production systems often combine these signals rather than choosing one pure algorithm.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the balancing signal is upstream of the real bottleneck. The web tier can look balanced while every request hammers the same database, cache shard, payment API, or model server. End-to-end capacity needs downstream pressure signals.',
        'It also fails under overload. If the fleet can handle 50,000 requests per second and demand is 80,000, routing only decides which backend becomes overloaded first. Rate limiting, backpressure, autoscaling, circuit breakers, and load shedding decide whether the system degrades cleanly.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use three servers and request durations 4, 1, 4, 1, 4, 1, 2, 1. One request arrives per tick, and each active request loses one tick of remaining work before the next arrival. Round-robin assigns requests 1, 4, and 7 to server 1, requests 2, 5, and 8 to server 2, and requests 3 and 6 to server 3.',
        'At tick 4, server 1 can still be carrying request 1 when request 4 arrives, so its active count reaches 2. Least-connections sees current counts before each assignment, so short requests free servers for later long ones. The same traffic can keep peak active count lower because the policy observes work instead of only position.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read Azar, Broder, Karlin, and Upfal on balanced allocations, then Mitzenmacher on the power of two choices. For production behavior, compare NGINX, HAProxy, Envoy, Kubernetes Service, and cloud load-balancer documentation.',
        'Study consistent hashing for sticky routing, rate limiting for admission, load shedding for overload, circuit breakers for unhealthy backends, and queues for short spikes. The next exercise is to run one duration list under two policies and compute peak active connections by hand.',
      ],
    },
  ],
};
