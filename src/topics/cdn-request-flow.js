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

  const userNode = NODES.find(n => n.id === 'B');
  const edgeNode = NODES.find(n => n.id === 'E1');
  yield {
    state: snapshot(),
    highlight: { active: ['B'] },
    explanation: `${userNode.label.charAt(0).toUpperCase() + userNode.label.slice(1)}, in ${edgeNode.note}, tap a page that needs cat.jpg from a site whose ORIGIN servers live in Virginia. Straight-line physics says ~80ms round trip, before the server even thinks. The web\'s answer is the CDN: hundreds of EDGE locations holding cached copies near users. Watch one request thread through five ideas you\'ve already studied on this site.`,
  };

  const dnsNode = NODES.find(n => n.id === 'DNS');
  const edge2Node = NODES.find(n => n.id === 'E2');
  yield {
    state: snapshot(),
    highlight: { active: ['bd', dnsNode.id], compare: ['E1', 'E2'] },
    explanation: `Step 1 -- ${dnsNode.label}: the browser asks "where is cdn.site.com?" and the CDN\'s GeoDNS answers DIFFERENTLY per asker: you get the ${edgeNode.note} edge\'s address; a user in Berlin gets ${edge2Node.note}\'s. Routing by geography before a single packet of content moves (and within each edge cluster, Consistent Hashing decides which cache machine owns cat.jpg).`,
  };

  if (hit) {
    yield {
      state: snapshot(),
      highlight: { active: ['be1'], found: ['E1'] },
      explanation: `Step 2 -- the edge: your request reaches ${edgeNode.note} (~10ms away) and the ${edgeNode.label} checks its cache -- an LRU Cache holding the hottest files. cat.jpg is THERE. Served instantly: total ~20ms, and the origin in Virginia never even heard about it.`,
    };
    const hitPath = ['B', 'E1', 'be1'];
    yield {
      state: snapshot(),
      highlight: { found: hitPath },
      explanation: `That non-event is the entire business: production CDNs answer 90-95% of requests at the edge. The origin handles 5% of the traffic while the planet feels served-next-door. This hit path touched ${hitPath.length} elements. Run the cold-cache scenario to see what those other 5% cost -- and how a miss heals itself.`,
      invariant: `A cache ${hit ? 'hit' : 'miss'} costs user-to-edge latency only; origin distance becomes irrelevant.`,
    };
    return;
  }

  yield {
    state: snapshot(),
    highlight: { active: ['be1'], swap: ['E1'] },
    explanation: `Step 2 -- the ${edgeNode.label}: your request reaches ${edgeNode.note} and the edge checks its LRU Cache... ${hit ? 'HIT' : 'MISS'}. cat.jpg was deployed an hour ago and no ${edgeNode.note} user has asked yet (a cold cache). The edge now becomes a CLIENT itself and goes to fetch the file the long way.`,
  };

  const lbNode = NODES.find(n => n.id === 'LB');
  const originNodes = NODES.filter(n => n.id.startsWith('O'));
  yield {
    state: snapshot(),
    highlight: { active: ['el', lbNode.id], compare: ['lo1', 'lo2'] },
    explanation: `Step 3 -- to the origin: the edge\'s request crosses the ocean to Virginia, arriving at a ${lbNode.label} guarding ${originNodes.length} origin servers. Least-connections says ${originNodes[0].label} is freer -- routed (with a Rate Limiter (Token Bucket) at the door, so an edge-cache stampede can\'t flatten the origin).`,
  };

  const selectedOrigin = NODES.find(n => n.id === 'O1');
  yield {
    state: snapshot(),
    highlight: { active: ['lo1', selectedOrigin.id] },
    explanation: `Step 4 -- the origin (${selectedOrigin.label}) renders the file and answers WITH INSTRUCTIONS: Cache-Control: max-age=86400 -- "${edgeNode.label}, you may keep this for 24 hours." The headers are the contract that makes the whole caching layer legal.`,
  };

  const fillFound = ['E1', 'B', 'be1'];
  yield {
    state: snapshot(),
    highlight: { found: fillFound, active: ['el'] },
    explanation: `Step 5 -- cache fill and serve: the file streams back; the ${edgeNode.note} ${edgeNode.label} STORES it (its LRU Cache evicting the least-recently-used file to make room) and serves ${userNode.label}. Your total: ~110ms. Painful? Slightly. But you paid it for everyone.`,
  };

  const totalNodes = NODES.length;
  yield {
    state: snapshot(),
    highlight: { found: ['E1'] },
    explanation: `Step 6 -- the next ${edgeNode.note} user gets the 20ms HIT, for the next 24 hours. One slow request warmed the cache for a city. The hard part you didn\'t see: INVALIDATION -- when cat.jpg changes at the origin, every edge holds a stale copy until max-age expires or a purge broadcast arrives ("there are only two hard things in computer science: cache invalidation and naming things"). DNS + Consistent Hashing + LRU Cache + Load Balancer + Rate Limiter (Token Bucket): five topics across ${totalNodes} nodes, one everyday miracle -- this exact flow ran dozens of times while this page loaded.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation traces one HTTP request for cat.jpg from a user in Mumbai through the full CDN delivery stack: DNS resolution, edge cache lookup, load balancer, and origin server. Each frame is one decision point in that path.',
        {type: 'callout', text: 'A CDN turns one global origin into many nearby cache decisions, so the common path ends at the edge.'},
        'Active highlights mark the current decision point. Found highlights mark outcomes that are now settled. Compare highlights show alternatives the system chose between, like two edge locations or two origin servers.',
        'Use the scenario control to switch between a cache hit and a cache miss. The hit path is short and cheap. The miss path is long and expensive but heals itself by filling the cache for future requests.',
        {type: 'image', src: './assets/gifs/cdn-request-flow.gif', alt: 'Animated walkthrough of the cdn request flow visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A CDN (content delivery network) puts cached copies of content at edge locations near users instead of making every request travel to a distant origin server. The visualization follows a user in Mumbai requesting cat.jpg while the origin servers live in Virginia. A direct trip is slow because physics imposes a floor: light in fiber takes roughly 80 ms one way across that distance, before the server even begins work.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/26/NCDN_-_CDN.svg', alt: 'Diagram comparing a single origin server with a content delivery network of edge caches', caption: 'A CDN replaces one long origin path with many nearby edge caches that can answer repeat requests. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:NCDN_-_CDN.svg.'},
        'The CDN tries the nearby Mumbai edge first. If the edge has the file, the origin is never contacted and the user gets a response in roughly 10 ms. If the edge is cold, it fetches the file once, stores it, and every subsequent local user gets the fast path. This page composes several systems topics into that single everyday request: DNS steers to an edge, the edge cache decides hit or miss, and on a miss the load balancer and origin complete the fill.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest web architecture puts origin servers in one region and sends every browser there. That is easy to reason about but forces every user to pay the full network distance. A user in Mumbai, Tokyo, or Sao Paulo all wait for the Virginia round trip. It also concentrates all traffic on the same fleet that may already be doing database-backed dynamic work.',
        'A second obvious answer is "add more origin servers in more regions." That helps capacity and geography, but now you have a distributed data consistency problem. Every origin must serve the same content, deploys must roll out everywhere, and you still cannot cache at the network edge. CDNs solve a narrower problem: move cacheable bytes close to users and let the origin handle only misses, dynamic responses, and content refreshes.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall in CDN design is cache invalidation. The invariant that must hold is: every edge serves content that matches what the origin currently considers correct. This sounds simple until you consider what breaks it.',
        'Suppose you deploy a new cat.jpg to origin at 2:00 PM. The Mumbai edge cached the old version at 1:00 PM with max-age=86400 (24 hours). For the next 23 hours, every Mumbai user sees the old image. If cat.jpg was a security patch, a legal compliance fix, or a price correction, that stale copy is a real problem. The edge is serving content the origin has already disavowed.',
        'You can shorten TTLs (time-to-live values), but that trades freshness for latency: shorter TTLs mean more revalidation traffic and more origin load, eroding the entire point of the CDN. You can send purge requests to every edge, but purges take time to propagate across hundreds of locations and can fail silently. You can version files with content hashes in the filename so old URLs are never reused, but that only works for immutable assets, not for HTML or API responses.',
        'There is no free lunch. Every CDN operator lives inside this tradeoff: you are always trading some freshness for some latency reduction. The rest of this page works because the wall is real. Without it, caching would be trivial and CDNs would be unnecessary.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Many web responses are safely reusable if the cache key and freshness rules are correct. A JavaScript bundle with a content hash in its filename, a JPEG, a font file, or a video segment can be served to thousands of users from the same nearby edge without contacting the origin again. The origin produces the object once; the edge repeats delivery where latency is low.',
        'The hard part is deciding when two requests should receive the same response. The cache key is built from the URL, HTTP method, query string, and Vary headers. Cookies, authorization tokens, device class, and language can all change what the correct response is. A CDN is a distributed key-value store with freshness rules and variation logic, not a magic speed layer.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Step 1 is DNS steering. The browser asks "where is cdn.site.com?" and GeoDNS returns a different answer per region: Mumbai gets the Mumbai edge\'s IP address, Berlin gets Frankfurt\'s. This happens before a single byte of content moves. Inside each edge cluster, consistent hashing decides which cache machine owns a given URL, so the same file is not duplicated across every machine in the cluster.',
        'Step 2 is the edge cache lookup. The edge checks its local cache, which behaves like an LRU (least recently used) cache for hot objects. On a hit, the file is served directly and the origin never hears about the request. Total user latency is roughly 10-20 ms.',
        'On a miss, the edge becomes a client. It forwards the request across the long path to a load balancer guarding the origin servers. The load balancer picks an origin using a strategy like least-connections. A rate limiter protects the origin from stampedes when many edges miss simultaneously, such as after a deploy or a cache purge. The origin responds with the file and a Cache-Control header like max-age=86400, which tells the edge it may keep this copy for 24 hours.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/67/Reverse_proxy_h2g2bob.svg', alt: 'Reverse proxy diagram showing client requests passing through an intermediary to a server', caption: 'On a miss, the edge acts like a reverse proxy: it forwards to origin, stores the response, and then answers future local requests. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Reverse_proxy_h2g2bob.svg.'},
        'Read the full request path as a sequence of cache decisions: browser cache, then edge cache, then optionally a shield or regional cache, then origin. Each hit saves latency, bandwidth, and origin capacity. Each miss moves the request one step closer to the expensive system. The miss path is not wasted work. The first user pays the long trip, but the edge stores the response so every subsequent local user gets the object nearby. One slow request warms a cache for a city.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'CDNs work because web traffic is heavily skewed. A small fraction of objects accounts for a large fraction of requests. Popular JavaScript bundles, images, fonts, map tiles, and video segments get requested thousands of times per minute. Putting those objects near users removes origin latency from the common path and reduces bandwidth pressure on the origin.',
        'They also work because HTTP gives caches a contract. Cache-Control headers describe how long a response is fresh. ETag and Last-Modified enable conditional revalidation so the edge can check whether its copy is still valid without re-downloading the full object. Vary headers declare which request properties change the response, so the edge does not accidentally serve a mobile layout to a desktop user. When these headers are precise, the edge can be aggressive. When they are sloppy, the edge must be conservative or risk serving wrong data.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The computational cost of a cache hit is tiny: a hash lookup, a freshness check, and a response. The infrastructure cost behind that lookup is enormous. A CDN operator maintains edge sites in dozens or hundreds of cities, each with storage, compute, network peering contracts, monitoring, and a purge control plane that can invalidate content globally.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg', alt: 'Server racks in a datacenter with dense cabling and infrastructure', caption: 'CDN performance is bought with physical edge capacity, storage, networking, monitoring, and purge control planes. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Wikimedia_Foundation_Servers-8055_35.jpg.'},
        'Hit ratio is the business metric. Static assets with long TTLs can reach 95%+ hit rates. Personalized or uncacheable responses miss constantly and pass through to origin. Tail Latency & p99 Thinking matters here because users feel the misses, not the average hit.',
        'Invalidation is the dominant operational cost. When content changes, every edge may hold a stale copy until max-age expires or a purge propagates. Cache Invalidation & Versioning gives the safer pattern: version immutable files with content hashes, use shorter TTLs for changeable content, and reserve emergency purges for mistakes. A mature CDN setup tracks not just hit rate but origin offload percentage, edge p50 and p99 latency, cache-fill latency, purge propagation time, error rates by region, and cache-key cardinality.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Static sites, software downloads, images, video segments, fonts, and JavaScript bundles are CDN classics. Large platforms run their own edge networks or use providers like Cloudflare, Akamai, Fastly, or CloudFront. Personalized content can be cached only when the cache key includes the right variation dimensions, such as language, device class, or authorization scope; caching without proper variation leaks private data to other users.',
        'A common production pattern is immutable assets plus short-lived HTML. Build artifacts get content-hashed filenames (app.a3f9c2.js) and long TTLs because changing the bytes changes the URL. HTML pages use shorter TTLs because they point to the current asset graph. That split gives high cacheability without making deploy rollback or security patches depend on waiting for stale HTML to expire at every edge worldwide.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A CDN is not magic. A miss still pays origin latency, database time, and the ocean crossing. If every response has max-age=0 or a unique cache key per user, the CDN becomes an expensive reverse proxy with zero caching benefit. If you cache private responses without the correct Vary header, you create a security vulnerability where one user sees another\'s data.',
        'The operational failures are usually boring and severe: a purge that does not reach every edge, a thundering herd when a popular object expires and hundreds of edges stampede the origin simultaneously, a Vary header that explodes the cache into millions of variants, a personalized API response cached publicly, or a long TTL attached to mutable content that prevents a security fix from deploying. Good CDN design starts by classifying every content type by mutability and privacy before tuning for performance.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Trace a request for cat.jpg from a phone in Mumbai. The origin is in Virginia. The CDN has edge servers in Mumbai and Frankfurt, among others.',
        'Request 1 (cold cache). The browser resolves cdn.site.com. GeoDNS sees the source IP is in India and returns the Mumbai edge\'s address. DNS resolution takes about 5 ms locally. The browser opens a connection to the Mumbai edge (10 ms round trip). The edge receives GET /images/cat.jpg, hashes the URL to find the responsible cache shard, and checks: miss. No local copy exists.',
        'The edge forwards the request to the origin path. The request crosses the ocean to Virginia, hitting the load balancer (80 ms network latency). The load balancer picks origin server 1 via least-connections. Origin 1 reads cat.jpg from disk (2 ms), attaches Cache-Control: public, max-age=86400, and sends the 150 KB response back. The edge receives the response (another 80 ms return trip), stores it in its LRU cache, and forwards it to the browser. Total time for the user: roughly 5 + 10 + 80 + 2 + 80 + 5 = 182 ms. Painful, but this request just warmed the Mumbai edge for 24 hours.',
        'Request 2 (warm cache, 30 seconds later). A different user in Mumbai requests the same file. DNS resolves to the same Mumbai edge (5 ms). The browser connects (10 ms). The edge receives GET /images/cat.jpg, checks the cache: hit, and the stored copy is 30 seconds old against a 86400-second max-age. Fresh. The edge serves the 150 KB response directly. Total time: roughly 5 + 10 + 5 = 20 ms. The origin in Virginia was never contacted. Every subsequent Mumbai request for the next 24 hours gets this same 20 ms path.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study How DNS Works for edge selection, DNS Negative Cache & NXDOMAIN for failed-name caching, and DNS Serve-Stale Resolver Cache for authoritative-outage resilience. Consistent Hashing explains cache ownership inside an edge cluster. LRU Cache covers eviction policy. Load Balancer covers origin selection, and Rate Limiter (Token Bucket) covers stampede protection.',
        'For the transport layer, TCP: Handshake & Congestion Control and QUIC Transport Streams & Loss Recovery explain the cost on each network leg. HPACK Dynamic Table HTTP/2 Case Study and QPACK Dynamic Table HTTP/3 cover how repeated headers shrink on multiplexed connections.',
        'For caching depth, study HTTP Cache ETag Revalidation for conditional requests, HTTP Vary Cache-Key Normalization for variant handling, CDN Stale-While-Revalidate Shield for serving stale content during revalidation, Cache Invalidation & Versioning for the freshness-versus-latency tradeoff, and Tail Latency & p99 Thinking for why the misses matter more than the average. Resource Hints: Preload & Preconnect shows how browsers can warm this path earlier.',
      ],
    },
  ],
};

