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
      heading: 'What it is',
      paragraphs: [
        `A load balancer is software or hardware that sits in front of a fleet of servers and distributes incoming requests across them. A request comes in, the balancer picks a server, and the request is routed there. When a single server would be overwhelmed by traffic (100,000 requests per second), spreading them across 10 servers (10,000 each) keeps the whole system responsive. Every large website — Google, Netflix, Amazon — runs behind a load balancer. Most users do not see this; it is infrastructure, invisible but essential.`,
        `There are many strategies to pick which server gets the next request. Round-robin is the simplest: server 1, then server 2, then server 3, then back to server 1, in a cycle. It is stateless (you do not need to track anything) and fair (each server gets the same number of requests). Least-connections is smarter: always route the new request to the server that currently has the fewest active connections. It reacts to reality, but you have to track how many requests each server is handling.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Round-robin is trivial: maintain a counter that increments with each request, then compute counter % number_of_servers to get the next server index. No lookup, no state beyond the counter — a single modulo operation decides everything.`,
        `Least-connections requires tracking the number of active requests on each server. When a new request arrives, you scan the counts and pick the server with the minimum count. You also have to decrement the count when a request finishes. The animation shows this in real time: watch how round-robin can pile all the long-running requests onto the same server (making that server slow) while others sit idle, whereas least-connections keeps the load spread out because it actually checks who is busy before routing.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Round-robin is O(1) — one modulo and a lookup, both constant. Least-connections is O(n) where n is the number of servers — you scan all counts and find the minimum. In practice, n is tiny (maybe 10–100 servers in a cluster), so O(n) is still instantaneous. The real cost is operational: least-connections requires accurate load tracking (which can fail if servers are unreliable), whereas round-robin works even if the balancer's view of the servers is slightly stale. Modern balancers like nginx, HAProxy, and AWS Elastic Load Balancer add health checks (skip dead servers), sticky sessions (keep a user on the same server), and weighted distributions (bigger machines get more load).`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Load balancing is backbone infrastructure for every internet company. nginx (one of the most widely deployed servers) includes round-robin and least-connections load balancing built-in. AWS Elastic Load Balancer, Google Cloud Load Balancer, and Azure Load Balancer are managed services that handle millions of requests per second across thousands of servers. CDNs (content delivery networks) like Akamai and Cloudflare use load balancing to route users to the nearest edge server. Video streaming (Netflix, YouTube) uses weighted round-robin to account for different server capacities. Financial exchanges use custom load balancers (with extremely low latency requirements) to spread trading orders. Without load balancing, a single server would be a bottleneck — you could never scale.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `The biggest pitfall is assuming round-robin is "fair." It distributes requests evenly, but not work evenly — if one request takes 100 seconds and another takes 1 second, round-robin can send both to the same server. Least-connections does not solve this either if requests have wildly different durations; a better strategy (weighted by estimated request time, or adaptive based on server response time) would help.`,
        `Another pitfall: load balancing alone does not guarantee performance. If all your servers are overloaded (you have 10 million requests per second but only capacity for 5 million), no balancer can help. You need horizontal scaling (add more servers) or vertical scaling (upgrade server hardware). A third misconception: the balancer is a single point of failure. In production, load balancers themselves are redundant — you have multiple balancers behind a virtual IP that automatically fails over if one dies.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Read Hash Table to understand consistent hashing, a strategy for distributing requests in systems where servers come and go (cloud infrastructure). Study Queue to understand how load balancers themselves often sit in front of a queue of requests, smoothing bursty traffic. Then explore Rate Limiter, which prevents a single user from overwhelming the system. Finally, look at real load balancers: nginx is open-source and widely deployed; reading its config and docs will give you practical intuition for how these concepts actually work at scale.`,
      ],
    },
  ],
};

