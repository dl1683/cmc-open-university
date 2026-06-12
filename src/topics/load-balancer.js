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
