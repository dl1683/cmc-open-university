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
        'The visualization has two views, selected from the dropdown. "The stale-or-stampede dilemma" shows three nodes -- users, cache/CDN, and origin -- connected by edges that light up to trace request flow. Active edges mark the path a request is currently taking. Compare markers highlight where the cache copy disagrees with the origin copy: that gap is the staleness. A matrix frame then plots three TTL values against their worst-case staleness and origin hit rate, turning the tradeoff into concrete numbers.',
        {type: 'callout', text: 'Every cache is a speedup built from a copy, so correctness depends on naming, freshness, and a controlled path back to the source.'},
        '"The three escape routes" walks through three invalidation strategies one at a time: purge (origin sends a drop command to the cache), immutable versioned names (new content gets a new URL so the old URL stays valid), and revalidation (cache asks origin whether its ETag token is still current). Found markers show the path that resolves correctly. The final frame maps four data types to their recommended strategies, showing that production systems run several invalidation policies simultaneously.',
        'At each step, ask yourself three things: what just changed, what is now stale, and which mechanism would fix it.',
        {type: 'image', src: './assets/gifs/cache-invalidation.gif', alt: 'Animated walkthrough of the cache invalidation visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A cache is a fast, nearby copy of data whose authoritative version lives somewhere slower. A CPU L1 cache copies from main memory. A CDN edge node copies from an origin server. A Redis instance copies from PostgreSQL. In every case, the cache exists because reading the copy is cheaper than reading the source -- cheaper in latency, in bandwidth, or in compute. The price of that speedup is that the copy can become wrong the instant the source changes.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Cache_hierarchy.svg', alt: 'Memory hierarchy diagram showing cache levels between CPU and storage', caption: 'A cache hierarchy makes the copy problem concrete: fast layers hold derived state from slower authority layers. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Cache_hierarchy.svg.'},
        'Cache invalidation is the set of rules that govern when a copy should be discarded, refreshed, or replaced. Without these rules, a CDN can serve yesterday\'s price to a customer checking out, a browser can execute a JavaScript file that was patched hours ago, and an API gateway can return permissions that were revoked. The copy is fast, but once the source changes, the copy is a lie.',
        'Three forces fight each other. A long-lived copy is cheap and fast but can be wrong for a long time. A short-lived copy is fresher but hammers the origin with repeated fetches. A write-triggered purge can be nearly instant but turns consistency into a distributed messaging problem where delivery failure means stale data. Every invalidation strategy picks a position among these three tensions.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest answer is time-based expiration, called TTL (time to live). The cache stores each entry alongside a countdown measured in seconds. When a request arrives and the countdown has not reached zero, the cache returns its copy without contacting the origin. When the countdown expires, the cache fetches a fresh copy from the origin, stores it, and resets the timer.',
        'TTL requires zero coordination between the writer and the cache. The cache manages its own expiration schedule independently. If you set TTL to 300 seconds, the cache guarantees that its copy is at most 5 minutes old. For read-heavy workloads where a few minutes of staleness is acceptable -- product descriptions, blog posts, configuration that changes rarely -- TTL is often the only invalidation mechanism a system needs.',
        'Concretely, an HTTP response header like Cache-Control: max-age=300 tells every intermediary and the browser to reuse this response for 300 seconds without asking the origin again. DNS works the same way: every DNS record carries a TTL, and resolvers cache the answer for exactly that many seconds.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'TTL breaks down in two independent ways, and both get worse as traffic grows. The first is staleness: a 300-second TTL means the system can legally serve a wrong answer for up to five minutes after a write. If the origin updates a checkout price from $99 to $79, every user hitting the cache for the next 5 minutes sees the old price. Shortening the TTL reduces the stale window but increases origin load proportionally. At 1,000 requests per second with a 5-second TTL, each key generates 0.2 origin fetches per second. At a 300-second TTL, it drops to 0.003. You are buying freshness with origin capacity.',
        'The second failure is the thundering herd. When a popular key expires, every concurrent request misses at the same instant and sends a duplicate fetch to the origin. If 1,000 requests per second are hitting a key and its TTL expires, all 1,000 miss simultaneously. The cache that was protecting the origin suddenly becomes the source of a traffic spike against it. This synchronized expiration problem compounds when many keys share the same TTL value, because their timers align and multiple keys expire in the same second.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/67/Reverse_proxy_h2g2bob.svg', alt: 'Reverse proxy diagram showing a client request passing through an intermediary before reaching a server', caption: 'Reverse proxies and cache layers sit between users and origins; invalidation has to reach every intermediary that can answer. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Reverse_proxy_h2g2bob.svg.'},
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The tension comes from who has authority over the copy\'s lifetime. With TTL, the cache decides when its copy is too old -- but it has no information about whether the source actually changed. With event-driven purge, the writer decides when copies must die -- but correctness now depends on message delivery to every cache node. There is a third option that sidesteps the question entirely: encode the version in the name itself.',
        'If you name a JavaScript bundle app.8f3ab2.js, where 8f3ab2 is a content hash of the file, the cache can store it forever with no expiration. When you ship a fix, the build produces app.c7d1e4.js -- a different file with a different name. The old name still maps to the old content, which is still correct for that name. No purge is needed, no TTL gamble, no race condition. The mutable part is the HTML page that references the bundle by name, and only that page needs a short TTL or revalidation strategy.',
        'This is why Phil Karlton\'s two hard problems -- cache invalidation and naming things -- are really one problem. A name that carries version information eliminates the need for an invalidation mechanism. A name that does not carry version information forces you to build an invalidation system that reconstructs version information after the fact. The design choice of how you name your cached objects determines how hard invalidation will be.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Three mechanisms cover the design space, and production systems combine them for different data types.',
        'TTL with stampede protection is the baseline. Each entry carries a timer; hits check the timer and return the copy or refetch from the origin. Three techniques prevent thundering herds when a popular key expires. Request coalescing (also called single-flight) ensures that when N requests miss simultaneously, only the first one fetches from the origin while the other N-1 wait for its result. Serve-stale-while-revalidate returns the expired copy to readers immediately while a single background fetch refreshes it. TTL jitter adds a random offset to each key\'s expiration -- instead of TTL=300 for every key, each key gets 300 plus a random value between 0 and 30, so expirations spread across time instead of clustering.',
        'Event-driven invalidation moves authority to the write path. When the source changes, the writer pushes a message telling caches to drop or refresh the affected key. The three standard patterns differ in when the cache gets populated. In cache-aside, the application checks the cache first; on a miss, it reads the database and writes the result into the cache. In write-through, every database write also writes to the cache in the same operation, so the cache is always populated. In write-behind, writes go to the cache first and flush to the database asynchronously, trading durability risk for lower write latency.',
        'Version/tag-based invalidation attaches an identity token to each cached copy. In HTTP, the origin sends an ETag header (a hash or version string) with the response. On the next request, the cache sends If-None-Match with that token. The origin responds 304 Not Modified (no body transfer, saving bandwidth) if the token is still current, or sends the full new body with a new ETag if the content changed. Content-hashed filenames are the extreme case: the name is the token, the cache stores it forever, and new content simply gets a new name.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/26/NCDN_-_CDN.svg', alt: 'Diagram comparing a single origin server with a content delivery network of edge caches', caption: 'A CDN turns invalidation into a distributed edge problem: one changed object may have many cached copies. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:NCDN_-_CDN.svg.'},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Each strategy works because it anchors correctness to a specific invariant. TTL guarantees bounded staleness: if the TTL is 60 seconds, the cached copy is at most 60 seconds behind the source. The invariant is temporal -- freshness is a function of elapsed time, not of what the origin actually contains. This is a weak guarantee, but it requires zero coordination between the writer and the cache, which is why it scales trivially.',
        'Event-driven invalidation ties correctness to the write path. The invariant is causal: every write that changes the source also invalidates the corresponding cache entry, so the next read sees fresh data. In the ideal case, staleness is bounded by message propagation delay -- microseconds on the same machine, milliseconds across a datacenter, tens of milliseconds across regions. The cost is that correctness depends on reliable delivery. If the invalidation message is lost, the cache serves stale data until the TTL backstop expires.',
        'Immutable naming makes the invariant tautological. The file named app.8f3ab2.js is correct by definition because its name encodes its content hash. There is no staleness because the concept does not apply -- the name and the content are one identity. The cost is that a mutable reference layer (the HTML page, a manifest file, a redirect) must exist to direct clients to the current version, and that layer still needs its own invalidation.',
        'Coalescing collapses N simultaneous cache misses for one key into exactly one origin fetch. The first request to miss acquires the refresh lock; subsequent requests either wait for the result or receive the stale copy via serve-stale. Jitter breaks synchronized expirations by adding random offsets to each key\'s TTL, so many keys do not expire in the same second even if they were populated at the same time.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Cache storage is O(n) in the number of distinct entries. A TTL hit is an O(1) hash-table lookup plus a timestamp comparison, with no network call. The hidden cost is wrong-answer time: the system serves a stale copy, and the damage scales with how many clients read that copy before it refreshes. If a key receives 1,000 reads per second and the TTL is 300 seconds, up to 300,000 reads could serve stale data after a single write to the origin.',
        'Event-driven invalidation adds a message per write to every cache layer. The write path must know which keys to invalidate and which cache nodes hold copies. Race conditions are real: a stale refill can arrive after a purge if a slow reader fetched from a replica that had not yet received the write. Serious purge systems need idempotent messages (so duplicate delivery is safe), version checks on refill (so stale data does not overwrite a purge), retries with exponential backoff, and sometimes tombstones that block refills for a grace period.',
        'Immutable naming shifts cost to the build and deploy pipeline. Every asset needs a content hash computed at build time, and every reference in HTML, CSS, or JavaScript must be rewritten to include the hash. Build tools (Webpack, Vite, esbuild) do this automatically, but the pipeline complexity is not zero. Storage also grows because old versions persist until you explicitly garbage-collect them.',
        'Stampede prevention adds implementation complexity regardless of the base strategy. Request coalescing requires a per-key lock or promise table in the cache layer. Probabilistic early expiration -- where each request has a small chance of triggering a refresh before the TTL actually expires -- avoids sharp cliffs but introduces tuning parameters. The payoff is that origin load stays predictable instead of spiking on every popular-key expiration.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'CDN edge caches (Cloudflare, Fastly, Akamai) use surrogate keys for targeted purge. When a product page changes, a single API call invalidates every URL tagged with that product\'s surrogate key across all edge nodes worldwide, without flushing unrelated content. Fastly propagates purges globally in under 150 milliseconds. This is event-driven invalidation operating at global scale with sub-second convergence.',
        'Application caches backed by Redis or Memcached typically combine TTL with explicit invalidation. The application sets a 300-second TTL as a safety net, but writes actively delete the cache key in the same transaction callback. Most reads never see stale data because the explicit delete fires first; but if that delete fails, the TTL ensures the stale copy dies within 5 minutes instead of living forever.',
        'DNS is TTL caching in its purest form. Every DNS record carries a TTL that tells resolvers how long to cache the answer. An A record with TTL 300 means resolvers will use the cached IP for five minutes. Cloudflare\'s default for proxied records is 300 seconds. Short TTLs (60 seconds or less) enable fast failover during incidents; long TTLs (86,400 seconds) reduce query load but mean DNS changes take up to a day to propagate fully.',
        'Browser HTTP caching layers all three strategies at once. Static assets get Cache-Control: max-age=31536000, immutable with content-hashed filenames -- the browser caches them for a year and never revalidates. API responses get Cache-Control: no-cache with an ETag, forcing revalidation on every request but saving bandwidth when the data has not changed. Private data gets Cache-Control: no-store, preventing any copy from persisting.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Multiple writers break simple invalidation because there is no single authority deciding which version is current. Two application servers in different regions can update the same key simultaneously. The last write to reach each cache node wins, but "last" is defined by arrival order, not by wall-clock time. The result is a cache that is consistent with neither writer\'s intent. Resolving this requires either a single-writer design or a conflict-resolution protocol, which is a distributed consensus problem.',
        'Complex dependency graphs defeat per-key invalidation. When a comment is added to a blog post, which cache keys are affected? The post page cache, the comment-count cache, the author\'s profile cache, the feed caches of every follower, the notification caches, the search index. Missing one dependency means one stale view survives. Tracking all dependencies is equivalent to maintaining a full dependency graph of the data model, which is often harder than the caching problem it was supposed to simplify.',
        'The delete-vs-refill race is subtle. Between a cache delete and the next read that refills it, a concurrent reader can fetch from a database replica that has not yet received the write, and store the old value back into the cache. The invalidation succeeded, but the refill undid it. Facebook\'s Memcache paper (NSDI 2013) introduced lease tokens to close this gap: the cache issues a token on delete, and only a refill carrying that token is accepted. Any refill from a reader who started before the delete is rejected.',
        'CPU cache coherence is a hardware instance of the same problem. Each core\'s L1 cache holds a copy of a memory line; the MESI protocol is an invalidation protocol that transitions cache lines between Modified, Exclusive, Shared, and Invalid states. The problem is universal across every system that uses copies: copies diverge, and convergence always has a cost in latency, bandwidth, or complexity.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A blog platform stores posts in PostgreSQL and caches rendered pages in Redis. Each cache key is post:<id>, with a TTL of 300 seconds as a backstop. The system uses cache-aside with write-triggered invalidation.',
        'Initial state: Redis holds post:42 = {title: "Old Title", body: "...original content...", rendered_html: "<div>..."}. The TTL has 200 seconds remaining. The author opens the CMS and changes the title.',
        'Step 1 -- write to the database. The application writes UPDATE posts SET title = \'New Title\' WHERE id = 42 to PostgreSQL. The row is now updated, but Redis still holds the old copy. If a reader hits the cache right now, they get the old title. The staleness window has opened.',
        'Step 2 -- invalidate the cache. In the same transaction callback (after the database COMMIT succeeds), the application runs DEL post:42 in Redis. Redis drops the key. Any reader that arrives now gets a cache miss. The staleness window is closed, roughly 1 millisecond after it opened on the same machine.',
        'Step 3 -- lazy refill on next read. The next reader requests post:42. Redis returns a miss. The application reads from PostgreSQL, gets the updated row, renders the HTML, and writes the result back to Redis with SET post:42 ... EX 300. The fresh copy is now cached with a full 300-second TTL.',
        'Step 4 -- steady state. For the next 300 seconds, all reads for post:42 hit Redis at O(1) cost. If the DEL in step 2 had failed silently -- network blip, Redis timeout -- the old copy would survive for up to 200 more seconds (its remaining TTL). That is why the TTL backstop exists: it bounds the worst-case staleness even when the explicit invalidation path fails.',
        'Now consider the race. Between step 2 (delete) and step 3 (refill), suppose a second reader also misses, but it reads from a PostgreSQL read replica that has not yet received the write via replication lag (say, 50ms behind). That reader fetches the old title and writes it back into Redis. The cache now holds stale data again, and the TTL is a fresh 300 seconds. This is the delete-vs-refill race. The fix: Redis issues a lease token on the delete; only a refill carrying that token is accepted. The second reader\'s refill is rejected because it did not hold the lease.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'RFC 7234 (HTTP/1.1 Caching) is the specification that browsers and CDNs implement. It defines Cache-Control directives (max-age, no-cache, no-store, must-revalidate), ETag/If-None-Match conditional requests, and the stale-while-revalidate extension. Nishtala et al., "Scaling Memcache at Facebook" (NSDI 2013) describes lease-based invalidation across regions, thundering-herd prevention, and the delete-vs-refill race in detail -- it is the most practically useful caching paper ever published.',
        'Study LRU eviction next to understand how caches decide what to drop when memory is full -- eviction is the complement of invalidation (invalidation removes wrong data; eviction removes cold data). Study consistent hashing to understand how cache keys are distributed across a cluster of cache nodes. Study distributed consensus (Paxos, Raft) to understand why multi-region cache coherence is fundamentally hard: keeping copies consistent across failure-prone networks is a weaker form of the same problem that replicated state machines solve.',
      ],
    },
  ],
};
