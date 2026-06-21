// Cache invalidation: "one of the two hard things in computer science."
// Every cache is a copy that can go stale; every fix trades freshness,
// origin load, or complexity, except the one trick that changes the name.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'cache-invalidation',
  title: 'Cache Invalidation & Versioning',
  category: 'Systems',
  summary: 'Stale copies, thundering herds, and the naming trick that dissolves one of the two hard problems.',
  controls: [
    { id: 'view', label: 'Face', type: 'select', options: ['the stale-or-stampede dilemma', 'the three escape routes'], defaultValue: 'the stale-or-stampede dilemma' },
  ],
  run,
};

const cacheGraph = ({ cacheNote, originNote, userNote = '1,000 req/s', edges }) =>
  graphState({
    nodes: [
      { id: 'users', label: 'USERS', x: 1.2, y: 3.5, note: userNote },
      { id: 'cache', label: 'CACHE / CDN', x: 5, y: 3.5, note: cacheNote },
      { id: 'origin', label: 'ORIGIN', x: 8.8, y: 3.5, note: originNote },
    ],
    edges,
  });

function* dilemma() {
  const staleCache = 'price.json = $99 (TTL 300s)';
  const freshOrigin = 'price.json = $79 (updated!)';
  yield {
    state: cacheGraph({
      cacheNote: staleCache,
      originNote: freshOrigin,
      edges: [{ id: 'hit', from: 'users', to: 'cache' }],
    }),
    highlight: { active: ['hit'], compare: ['cache', 'origin'] },
    explanation: `A cache hit is a bet that the copy is still fresh enough. The origin now has ${freshOrigin} but the CDN still holds ${staleCache}. The harm depends on the data class: a stale avatar is different from a stale checkout price.`,
  };

  const ttlRows = [
    { id: 't5', label: 'TTL = 5s' },
    { id: 't300', label: 'TTL = 5 min' },
    { id: 't86400', label: 'TTL = 1 day' },
  ];
  const ttlValues = [[5, 0.2], [300, 0.0033], [86400, 0.0000116]];
  yield {
    state: matrixState({
      title: 'The TTL dial: staleness vs origin load (per key, at 1,000 req/s)',
      rows: ttlRows,
      columns: [{ id: 'stale', label: 'worst staleness' }, { id: 'load', label: 'origin hits/sec per key' }],
      values: ttlValues,
      format: (v) => (v >= 5 ? (v >= 86400 ? '24 hours' : v >= 300 ? '5 minutes' : '5 seconds') : v < 0.001 ? v.toExponential(1) : v.toFixed(4)),
    }),
    highlight: { compare: ['t5:stale', 't86400:stale'] },
    explanation: `The TTL dial trades freshness for origin pressure across ${ttlRows.length} settings. A ${ttlRows[0].label} bounds stale answers tightly but refreshes at ${ttlValues[0][1]} hits/sec per key. A ${ttlRows[2].label} protects the origin but can serve yesterday's value all day.`,
    invariant: `TTL caching across ${ttlRows.length} settings chooses a freshness/load tradeoff; it does not remove the tradeoff.`,
  };

  const stampedeNote = 'ON FIRE: 1,000 identical queries';
  yield {
    state: cacheGraph({
      cacheNote: 'TTL hit 0 - MISS x1,000',
      originNote: stampedeNote,
      userNote: '1,000 req/s, all unlucky',
      edges: [
        { id: 'miss1', from: 'users', to: 'cache' },
        { id: 'stampede', from: 'cache', to: 'origin' },
      ],
    }),
    highlight: { removed: ['origin', 'stampede'], active: ['miss1'] },
    explanation: `Synchronized expiry creates a cache stampede. The origin is now "${stampedeNote}". The key protected the origin while it was hot; when it expires, many requests miss together and send duplicate work to the origin.`,
  };

  const coalesceNote = 'MISS x1,000 -> 1 fetch, 999 wait';
  yield {
    state: cacheGraph({
      cacheNote: coalesceNote,
      originNote: 'one query. calm.',
      edges: [
        { id: 'miss1', from: 'users', to: 'cache' },
        { id: 'single', from: 'cache', to: 'origin' },
      ],
    }),
    highlight: { found: ['single', 'origin'] },
    explanation: `Coalescing turns "${coalesceNote}" — the first miss owns the refresh while the other requests wait. Serve-stale can answer with the expired copy during refresh, and jitter spreads expirations so clocks do not line up.`,
    invariant: `Coalescing collapses N simultaneous misses into exactly one origin request — the cache holds "${coalesceNote}".`,
  };
}

function* escapes() {
  const purgeOrigin = '$79 - purge sent';
  yield {
    state: cacheGraph({
      cacheNote: 'PURGE price.json -> dropped',
      originNote: purgeOrigin,
      edges: [{ id: 'purge', from: 'origin', to: 'cache' }],
    }),
    highlight: { active: ['purge'], found: ['cache'] },
    explanation: `Purge moves authority to the write path. The origin (now at ${purgeOrigin}) tells caches to drop the key. This reduces stale time, but correctness now depends on delivery, ordering, and every cache layer receiving the message.`,
  };

  const immutableCache = 'app.v42.js cached forever - still correct';
  const immutableOrigin = 'ships app.v43.js + new HTML';
  yield {
    state: cacheGraph({
      cacheNote: immutableCache,
      originNote: immutableOrigin,
      edges: [
        { id: 'newRef', from: 'origin', to: 'users' },
        { id: 'oldHit', from: 'users', to: 'cache' },
      ],
    }),
    highlight: { found: ['cache', 'newRef'] },
    explanation: `Immutable names avoid invalidation. The cache still serves "${immutableCache}" while the origin ${immutableOrigin}. The old object stays cached because its name still means the old content.`,
    invariant: `Immutable content needs no invalidation: the origin ${immutableOrigin} under a new name, and old names never lie.`,
  };

  const revalEdges = [
    { id: 'ask', from: 'cache', to: 'origin' },
    { id: 'reply', from: 'origin', to: 'cache' },
  ];
  yield {
    state: cacheGraph({
      cacheNote: 'asks: If-None-Match "abc123"',
      originNote: 'replies: 304 Not Modified (no body)',
      edges: revalEdges,
    }),
    highlight: { active: ['ask'], found: ['reply'] },
    explanation: `Revalidation uses ${revalEdges.length} round-trip edges (${revalEdges.map(e => e.id).join(' -> ')}) to ask the origin whether its version token is still current. A 304 response saves the body transfer, but the round trip remains.`,
  };

  const strategyRows = [
    { id: 'static', label: 'JS, CSS, images' },
    { id: 'api', label: 'API reads, feeds' },
    { id: 'critical', label: 'prices, inventory' },
    { id: 'private', label: 'auth, personal data' },
  ];
  yield {
    state: matrixState({
      title: 'The routing table: data type -> invalidation strategy',
      rows: strategyRows,
      columns: [{ id: 'strat', label: 'strategy' }, { id: 'why', label: 'because' }],
      values: [[1, 2], [3, 4], [5, 6], [7, 8]],
      format: (v) => ['', 'versioned names, cache forever', 'immutability beats invalidation', 'short TTL + SWR + coalescing', 'bounded staleness, herd-proof', 'purge on write (or no cache)', 'staleness costs real money', 'no-store', 'a cached secret is a leak'][v],
    }),
    highlight: { found: ['static:strat'], removed: ['private:strat'] },
    explanation: `Production systems usually run several strategies at once across ${strategyRows.length} data types (${strategyRows.map(r => r.label).join(', ')}). Static assets use immutable names, feeds use bounded staleness, critical mutable records need purge or revalidation, and private data may need no-store.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'the stale-or-stampede dilemma') yield* dilemma();
  else if (view === 'the three escape routes') yield* escapes();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. The stale-or-stampede dilemma shows a three-node graph: users, cache/CDN, and origin. Edges light up to show request flow. Active edges mark the current path a request takes. Compare markers highlight the disagreement between the cache copy and the origin copy -- this is the staleness gap. The matrix frame plots TTL values against worst-case staleness and origin hit rate so you can see the tradeoff as numbers, not just intuition.',
        {type: 'callout', text: 'Every cache is a speedup built from a copy, so correctness depends on naming, freshness, and a controlled path back to the source.'},
        'The escape-routes view shows three invalidation strategies in sequence: purge (origin pushes a drop command), immutable versioned names (new content gets a new URL), and revalidation (cache asks origin whether its ETag is still current). Found markers show the path that resolves correctly. The final matrix maps data types to strategies, showing that production systems run several invalidation policies at once.',
        'At each frame, ask: what changed, what is now stale, and what mechanism would fix it.',
      
        {type: 'image', src: './assets/gifs/cache-invalidation.gif', alt: 'Animated walkthrough of the cache invalidation visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Phil Karlton said there are only two hard things in computer science: cache invalidation and naming things. The quip survives because it is precise. A cache trades consistency for speed -- it serves a copy instead of asking the source. Invalidation is the mechanism that keeps that trade honest.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Cache_hierarchy.svg', alt: 'Memory hierarchy diagram showing cache levels between CPU and storage', caption: 'A cache hierarchy makes the copy problem concrete: fast layers hold derived state from slower authority layers. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Cache_hierarchy.svg.'},
        'Without invalidation rules, a CDN can serve yesterday\'s price, a browser can run a broken script long after a fix shipped, and an API gateway can return permissions that were revoked an hour ago. The copy is fast, but the moment the source changes, the copy becomes a lie with no expiration date.',
        'The hard part is that freshness, latency, and origin load fight each other. A long-lived copy is cheap and fast but can be wrong for a long time. A short-lived copy is fresher but hammers the origin. A write-triggered purge can be nearly instant but turns consistency into a distributed messaging problem. Every invalidation strategy picks a position on this triangle.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first answer is time-based expiration: set every cache entry to expire after N seconds. TTL caching is simple, stateless, and bounds how long a stale copy can survive. It works well enough for many use cases that most systems start here and never leave.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'TTL is a guess. Too short and cache misses spike -- you are barely caching, and the origin bears almost the full load. Too long and users see stale data for minutes or hours. And TTL cannot handle the case where the source changed right now: a 300-second TTL means the system can legally serve a wrong answer for up to five minutes after a write, no matter how critical the data.',
        'Worse, TTL creates a synchronized expiration problem. When a popular key expires, every concurrent request misses at the same instant and sends duplicate fetches to the origin. This is the thundering herd: the cache that was protecting the origin suddenly becomes the source of a traffic spike against it.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/67/Reverse_proxy_h2g2bob.svg', alt: 'Reverse proxy diagram showing a client request passing through an intermediary before reaching a server', caption: 'Reverse proxies and cache layers sit between users and origins; invalidation has to reach every intermediary that can answer. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Reverse_proxy_h2g2bob.svg.'},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Three strategies cover the space, and production systems typically combine them.',
        'TTL/expiration is the simplest: each cache entry carries a timer. On a hit, the cache checks whether the timer has expired. If not, it returns the copy. If yes, it fetches from the origin, stores the new value, and resets the timer. The worst-case staleness equals the TTL. Stampede control -- request coalescing (single-flight), serve-stale-while-revalidate, and TTL jitter -- keeps expiration events from overwhelming the origin.',
        'Event-driven invalidation moves authority to the write path. When the source changes, the writer notifies caches to drop or refresh the affected key. Three common patterns: cache-aside (the application checks the cache, misses go to the database, the application populates the cache on read); write-through (every write goes to both cache and database together, so the cache is always current); write-behind (writes go to the cache first, then flush to the database asynchronously, trading durability risk for lower write latency).',
        'Version/tag-based invalidation attaches an identity token to each cached copy. HTTP uses ETag and If-None-Match: the cache sends its token to the origin, and the origin responds 304 Not Modified (no body transfer) if the token is still current, or sends the new body with a new tag if it changed. Database caches use generation counters. Content-hashed filenames (app.8f3ab2.js) are the extreme case: the name is the version, so the old object never becomes stale -- new content simply gets a new name.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/26/NCDN_-_CDN.svg', alt: 'Diagram comparing a single origin server with a content delivery network of edge caches', caption: 'A CDN turns invalidation into a distributed edge problem: one changed object may have many cached copies. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:NCDN_-_CDN.svg.'},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Event-driven invalidation gives O(1) staleness in the ideal case: the cache is invalidated on the write, so the next read always fetches fresh data. The cost is that correctness now depends on reliable message delivery, ordering, and every cache layer receiving the notification.',
        'TTL gives bounded staleness without any coordination. Serving a 40-second-old value is correct under a 60-second freshness contract, even if the origin changed 10 seconds ago. That is not universal correctness; it is correctness relative to an explicit budget.',
        'Cache-aside is simple and works well for read-heavy workloads, but it has thundering-herd risk on popular keys and a window of inconsistency between the database write and the next cache miss. Write-through eliminates stale reads at the cost of higher write latency, since every write must update two stores. Write-behind has the lowest write latency but risks data loss if the cache fails before the async flush completes.',
        'Coalescing collapses N simultaneous misses for one key into exactly one origin fetch. The first request owns the refresh; the rest wait for the same result. Jitter breaks synchronized clocks so many keys do not expire in the same second. Serve-stale keeps the system available during refresh by returning the expired copy while a background fetch runs.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Cache memory is O(n) per entry stored. TTL hits are O(1) and have no coordination overhead. The tax is wrong-answer time: when request rate doubles, hit handling stays cheap, but expiration events become more painful because more clients are waiting when the key goes cold.',
        'Event-driven invalidation adds message overhead per write. The write path must know which keys to invalidate, which cache layers hold them, and how to handle delivery failure. Race conditions are real: a stale refill can arrive after a purge, or a purge can reach one region before another. Serious purge systems need idempotent messages, version checks, retries, and sometimes tombstones.',
        'Thundering herd on popular key expiration is the acute cost of TTL without coalescing. Cache stampede prevention -- lock/promise coalescing, probabilistic early expiration, and jitter -- adds implementation complexity but keeps origin load predictable.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'CDN edge caches (Cloudflare, Fastly) use surrogate keys for targeted purge: a single API call can invalidate every URL tagged with a specific surrogate key across all edge nodes, without flushing unrelated content. This is event-driven invalidation at global scale.',
        'Database query caches (Redis, Memcached) use TTL and explicit invalidation together. Application code sets a TTL as a safety net, but writes actively delete or update the cache key so most reads never see stale data.',
        'DNS uses TTL natively: every DNS record carries a TTL that tells resolvers how long to cache the answer. Short TTLs enable fast failover; long TTLs reduce DNS query load.',
        'Browser HTTP caching combines Cache-Control headers (max-age for TTL, no-store for uncacheable), ETag/If-None-Match for revalidation, and immutable content-hashed URLs for static assets. A well-configured static site can serve most requests from the browser cache with zero network round trips.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Distributed caches with multiple writers break simple invalidation because there is no single authority deciding who invalidates. Two writers can update the same key in different regions, and the last-write-wins race produces a cache that is consistent with neither writer\'s intent.',
        'Complex dependency graphs defeat per-key invalidation. When a comment is added to a post, which cache keys are affected? The post cache, the comment-count cache, the feed caches of every follower, the notification caches, the search index cache. Missing one dependency means one stale view survives.',
        'The delete-vs-update race condition is subtle: a cache delete followed by a concurrent read can refill the cache with stale data from a replica that has not yet received the write. Write-through avoids this but at higher write cost.',
        'Cache coherence in multi-core CPUs is a hardware version of the same problem. Each core\'s L1 cache is a copy; the MESI protocol is an invalidation protocol. The problem is universal: copies diverge, and convergence has a cost.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A blog stores posts in PostgreSQL and caches them in Redis. Each cache key is post:<id> with a 300-second TTL as a safety net.',
        'State: Redis has post:42 = {title: "Old Title", body: "..."}. TTL has 200 seconds remaining. The author edits the post in the CMS.',
        'Step 1: The application writes the updated post to PostgreSQL. The row now reads {title: "New Title", body: "..."}.',
        'Step 2: In the same transaction callback, the application deletes the Redis key post:42. This is cache-aside with write-triggered invalidation -- the write path explicitly drops the stale copy instead of waiting for TTL.',
        'Step 3: The next reader requests post:42. Redis returns a miss. The application fetches from PostgreSQL, gets the updated row, and writes it back to Redis with a fresh 300-second TTL.',
        'Step 4: All subsequent readers for the next 300 seconds get the fresh copy from Redis. The staleness window was the time between the PostgreSQL write and the Redis delete -- typically under a millisecond on the same server.',
        'If the Redis delete in step 2 had failed silently, the old copy would survive for up to 200 more seconds. That is why the TTL exists as a backstop: it bounds the worst case even when the invalidation path breaks.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Karlton\'s law is the canonical framing. RFC 7234 (HTTP/1.1 Caching) defines Cache-Control, ETag, and conditional-request semantics -- it is the standard that browsers and CDNs implement. Nishtala et al., "Scaling Memcache at Facebook" (NSDI 2013), describes how Facebook handles cache invalidation across regions with lease-based protocols to prevent thundering herds and stale sets.',
        'Study HTTP caching headers (Cache-Control, ETag, Vary, stale-while-revalidate) to understand browser and CDN behavior. Study LRU eviction to see how caches decide what to drop when memory is full -- eviction is the complement of invalidation. Study distributed consensus to understand why multi-region cache coherence is fundamentally hard: it is a weaker form of the same problem that Paxos and Raft solve for replicated state machines.',
      ],
    },
  ],
};
