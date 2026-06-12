// One image request, end to end: DNS picks the nearest edge, the edge's
// LRU cache answers in milliseconds — or misses, and the whole machine
// (load balancer, origin, cache-fill) springs into motion. Five topics
// from this site, composed into the everyday miracle of a fast page load.

import { graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'cdn-request-flow',
  title: 'CDN Request Flow',
  category: 'Systems',
  summary: 'Follow one HTTP request through DNS, an edge cache, a load balancer, and the origin — the web\'s delivery stack.',
  controls: [
    { id: 'scenario', label: 'The edge cache', type: 'select', options: ['has the file (hit)', 'is cold (miss)'], defaultValue: 'is cold (miss)' },
  ],
  run,
};

const NODES = [
  { id: 'B', label: 'you', x: 1.0, y: 7.6 },
  { id: 'DNS', label: 'DNS', x: 1.2, y: 2.0 },
  { id: 'E1', label: 'edge', x: 4.4, y: 6.2, note: 'Mumbai' },
  { id: 'E2', label: 'edge', x: 4.4, y: 1.2, note: 'Frankfurt' },
  { id: 'LB', label: 'LB', x: 7.0, y: 5.4 },
  { id: 'O1', label: 'org1', x: 9.4, y: 3.6 },
  { id: 'O2', label: 'org2', x: 9.4, y: 7.2 },
];
const EDGES = [
  { id: 'bd', from: 'B', to: 'DNS' },
  { id: 'be1', from: 'B', to: 'E1' },
  { id: 'be2', from: 'B', to: 'E2' },
  { id: 'el', from: 'E1', to: 'LB' },
  { id: 'lo1', from: 'LB', to: 'O1' },
  { id: 'lo2', from: 'LB', to: 'O2' },
];

export function* run(input) {
  const hit = String(input.scenario) === 'has the file (hit)';
  if (!['has the file (hit)', 'is cold (miss)'].includes(String(input.scenario))) {
    throw new InputError('Pick a scenario.');
  }

  const snapshot = () => graphState({ nodes: NODES, edges: EDGES });

  yield {
    state: snapshot(),
    highlight: { active: ['B'] },
    explanation: 'You, in Mumbai, tap a page that needs cat.jpg from a site whose ORIGIN servers live in Virginia. Straight-line physics says ~80ms round trip, before the server even thinks. The web\'s answer is the CDN: hundreds of EDGE locations holding cached copies near users. Watch one request thread through five ideas you\'ve already studied on this site.',
  };

  yield {
    state: snapshot(),
    highlight: { active: ['bd', 'DNS'], compare: ['E1', 'E2'] },
    explanation: 'Step 1 — DNS: the browser asks "where is cdn.site.com?" and the CDN\'s GeoDNS answers DIFFERENTLY per asker: you get the Mumbai edge\'s address; a user in Berlin gets Frankfurt\'s. Routing by geography before a single packet of content moves (and within each edge cluster, Consistent Hashing decides which cache machine owns cat.jpg).',
  };

  if (hit) {
    yield {
      state: snapshot(),
      highlight: { active: ['be1'], found: ['E1'] },
      explanation: 'Step 2 — the edge: your request reaches Mumbai (~10ms away) and the edge checks its cache — an LRU Cache holding the hottest files. cat.jpg is THERE. Served instantly: total ~20ms, and the origin in Virginia never even heard about it.',
    };
    yield {
      state: snapshot(),
      highlight: { found: ['B', 'E1', 'be1'] },
      explanation: 'That non-event is the entire business: production CDNs answer 90–95% of requests at the edge. The origin handles 5% of the traffic while the planet feels served-next-door. Run the cold-cache scenario to see what those other 5% cost — and how a miss heals itself.',
      invariant: 'A cache hit costs user-to-edge latency only; origin distance becomes irrelevant.',
    };
    return;
  }

  yield {
    state: snapshot(),
    highlight: { active: ['be1'], swap: ['E1'] },
    explanation: 'Step 2 — the edge: your request reaches Mumbai and the edge checks its LRU Cache… MISS. cat.jpg was deployed an hour ago and no Mumbai user has asked yet (a cold cache). The edge now becomes a CLIENT itself and goes to fetch the file the long way.',
  };

  yield {
    state: snapshot(),
    highlight: { active: ['el', 'LB'], compare: ['lo1', 'lo2'] },
    explanation: 'Step 3 — to the origin: the edge\'s request crosses the ocean to Virginia, arriving at a Load Balancer guarding two origin servers. Least-connections says org1 is freer — routed (with a Rate Limiter (Token Bucket) at the door, so an edge-cache stampede can\'t flatten the origin).',
  };

  yield {
    state: snapshot(),
    highlight: { active: ['lo1', 'O1'] },
    explanation: 'Step 4 — the origin renders the file and answers WITH INSTRUCTIONS: Cache-Control: max-age=86400 — "edge, you may keep this for 24 hours." The headers are the contract that makes the whole caching layer legal.',
  };

  yield {
    state: snapshot(),
    highlight: { found: ['E1', 'B', 'be1'], active: ['el'] },
    explanation: 'Step 5 — cache fill and serve: the file streams back; the Mumbai edge STORES it (its LRU Cache evicting the least-recently-used file to make room) and serves you. Your total: ~110ms. Painful? Slightly. But you paid it for everyone.',
  };

  yield {
    state: snapshot(),
    highlight: { found: ['E1'] },
    explanation: 'Step 6 — the next Mumbai user gets the 20ms HIT, for the next 24 hours. One slow request warmed the cache for a city. The hard part you didn\'t see: INVALIDATION — when cat.jpg changes at the origin, every edge holds a stale copy until max-age expires or a purge broadcast arrives ("there are only two hard things in computer science: cache invalidation and naming things"). DNS + Consistent Hashing + LRU Cache + Load Balancer + Rate Limiter (Token Bucket): five topics, one everyday miracle — this exact flow ran dozens of times while this page loaded.',
  };
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        `A CDN places cached copies of files in data centers near users. Instead of serving every request from a single origin server 13,000 km away, a CDN spreads "edge" locations worldwide: Mumbai, Frankfurt, São Paulo, Sydney. Your browser asks the nearest edge first. If the file is there, it answers in 10–20 milliseconds. If not, the edge fetches from the origin and stores the copy, warming the cache for the next user in that city. Cloudflare, Akamai, Fastly, and AWS CloudFront run this pattern globally, handling trillions of requests per month.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `DNS routes you to the nearest edge: a GeoDNS server answers with different edge IPs for different client locations. Consistent Hashing ensures the right cache machine in that cluster owns your file. At the edge lives an LRU Cache (1–500 TB) holding the hottest files. A cache lookup completes in microseconds. Hit: you're served in ~20 ms total (10 ms network + 10 ms at the edge). Production CDNs serve 90–95% of requests this way.`,
        `A miss sends the edge upstream. It asks a Load Balancer which origin server is freest, then a Rate Limiter (Token Bucket) gate prevents a thundering herd from flattening the origin. The origin replies "Cache-Control: max-age=86400" (keep this for 24 hours), the edge stores it (evicting the least-recently-used file if full), and you pay ~110 ms. The next Mumbai user in that 24-hour window pays 20 ms. One slow request warmed the cache for a city.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `CDNs cost billions to run: hundreds of data centers, land, fiber, power. Cloudflare and Fastly are expensive because they're everywhere; more edges mean lower latency but higher sunk cost. Invalidation is the hard part: when cat.jpg changes, every edge holds the stale copy until Cache-Control max-age expires or a purge API broadcasts invalidation. That broadcast takes seconds to propagate globally. Safer: low max-age (5–30 minutes) for dynamic assets and high max-age (days or versioned URLs) for static files. Stale-while-revalidate headers let edges serve old copies while fetching fresh ones in the background.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Every major site hides behind a CDN. Netflix streams via Akamai. Shopify absorbs Black Friday spikes via Cloudflare. GitHub Pages sits behind CloudFront. CDNs also cache personalized content: by tagging cache keys with session tokens, the same URL returns different content (your feed vs. mine) because the cache key includes your session token. Instagram does this at scale. Without a CDN, the origin answers every request; with one, 95% answer from the edge in geographic-local latency.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `A CDN is not a magic latency eraser. If your origin is slow (2-second database query), a cache miss pays the full 2 seconds plus network round trip. Optimize the origin first; use a CDN to amortize its cost across a city. If every asset is unique or max-age=0, 100% of traffic hits the origin and you've paid for a CDN you're not using. Stale copies are real: if you deploy a security patch and forget to invalidate, every edge serves vulnerable code until max-age expires. Test purge logic before you need it.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `This flow combines five topics: Consistent Hashing (which cache machine owns your file), LRU Cache (the data structure that decides hits and eviction), Load Balancer (how the edge picks an origin server), Rate Limiter (Token Bucket) (how the origin avoids stampede), and DNS (the geographic router). Consistent Hashing lets you add edges without recomputing lookups. LRU Cache is what Postgres, Redis, and your CPU use to keep hot data close. A Load Balancer with least-connections beats round-robin. A Rate Limiter (Token Bucket) leaks requests at steady pace, smoothing bursty traffic.`,
      ],
    },
  ],
};

