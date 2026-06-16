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
      heading: `What it is`,
      paragraphs: [
        `A CDN puts cached copies of content at edge locations near users. The visualization follows a user in Mumbai requesting cat.jpg while the origin servers live in Virginia. A direct origin trip is slow because physics matters. The CDN tries the nearby Mumbai edge first. If the edge has the file, the origin is not involved. If the edge is cold, it fetches the file once, stores it, and the next local user gets the fast path.`,
        `This page composes several systems topics into one everyday request: How DNS Works chooses an edge, TCP: Handshake & Congestion Control carries bytes across each path, HPACK Dynamic Table HTTP/2 Case Study explains how repeated request headers shrink on an HTTP/2 connection, HTTP/3 over QUIC explains the modern stream mapping, QPACK Dynamic Table HTTP/3 explains the newer header-compression state, and the edge cache decides whether the request stops nearby or continues to origin.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Step 1 is DNS steering. GeoDNS can return the Mumbai edge to one user and Frankfurt to another. Inside an edge cluster, Consistent Hashing can choose which cache machine owns a URL. The cache behaves like an LRU Cache for hot objects. A hit in the demo is served in about 20 ms, and the Virginia origin never sees the request.`,
        `On a miss, the edge becomes a client. It crosses the long path to a Load Balancer, which selects an origin. A Rate Limiter (Token Bucket) protects the origin from stampedes when many edges miss at once. The origin responds with Cache-Control: max-age=86400, so the edge may keep the file for 24 hours. The first Mumbai user pays roughly 110 ms; later local users pay the hit latency.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The data-structure cost of a hit is tiny; the infrastructure cost is enormous: edge sites, storage, network contracts, monitoring, and purge systems. Hit ratio is the business metric. Static assets can reach very high hit rates; personalized or uncacheable responses may miss constantly. Tail Latency & p99 Thinking matters because users feel the misses and slow purges, not the average hit.`,
        `Invalidation is the hard part. When cat.jpg changes, every edge may hold the old copy until max-age expires or a purge propagates. Cache Invalidation & Versioning gives the safer pattern: version immutable files, use shorter TTLs for changeable data, and reserve emergency purges for mistakes.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Static sites, software downloads, images, video segments, fonts, and JavaScript bundles are CDN classics. Large platforms may run their own edge networks or use providers such as Cloudflare, Akamai, Fastly, or CloudFront. Personalized content can be cached only when the cache key includes the right variation, such as language, device class, or authorization scope; otherwise private data can leak. Service Workers & Offline-First uses similar strategy inside one browser, while a CDN does it for the planet.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `A CDN is not magic. A miss still pays origin latency, database time, and the ocean crossing. If every response has max-age=0 or a unique cache key, the CDN becomes an expensive proxy. If you cache private responses without varying correctly, it becomes a security bug. If you deploy a security patch without purging or versioning, stale vulnerable code can keep serving until TTL expiry.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study How DNS Works for edge selection, DNS Negative Cache & NXDOMAIN for failed-name caching, DNS Serve-Stale Resolver Cache for authoritative-outage resilience, Consistent Hashing for cache ownership, LRU Cache for eviction, Load Balancer for origin selection, HPACK Dynamic Table HTTP/2 Case Study for compressed request metadata, HTTP/3 over QUIC and QPACK Dynamic Table HTTP/3 for the modern web transport path, and Rate Limiter (Token Bucket) for stampede protection. Resource Hints: Preload & Preconnect shows how the browser warms or starts this path earlier, while HTTP Cache ETag Revalidation, HTTP Vary Cache-Key Normalization, and CDN Stale-While-Revalidate Shield show how edge and browser caches avoid blocking on unchanged, variant-specific, or temporarily unavailable origin content. TCP: Handshake & Congestion Control and QUIC Transport Streams & Loss Recovery explain the transport cost on each leg. Cache Invalidation & Versioning and Tail Latency & p99 Thinking are the production follow-ups once the basic flow works.`,
      ],
    },
  ],
};
