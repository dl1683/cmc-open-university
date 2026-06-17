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
  yield {
    state: cacheGraph({
      cacheNote: 'price.json = $99 (TTL 300s)',
      originNote: 'price.json = $79 (updated!)',
      edges: [{ id: 'hit', from: 'users', to: 'cache' }],
    }),
    highlight: { active: ['hit'], compare: ['cache', 'origin'] },
    explanation: 'A cache hit is a bet that the copy is still fresh enough. The origin now has $79, but the CDN can legally serve $99 until the TTL expires. The harm depends on the data class: a stale avatar is different from a stale checkout price.',
  };

  yield {
    state: matrixState({
      title: 'The TTL dial: staleness vs origin load (per key, at 1,000 req/s)',
      rows: [
        { id: 't5', label: 'TTL = 5s' },
        { id: 't300', label: 'TTL = 5 min' },
        { id: 't86400', label: 'TTL = 1 day' },
      ],
      columns: [{ id: 'stale', label: 'worst staleness' }, { id: 'load', label: 'origin hits/sec per key' }],
      values: [[5, 0.2], [300, 0.0033], [86400, 0.0000116]],
      format: (v) => (v >= 5 ? (v >= 86400 ? '24 hours' : v >= 300 ? '5 minutes' : '5 seconds') : v < 0.001 ? v.toExponential(1) : v.toFixed(4)),
    }),
    highlight: { compare: ['t5:stale', 't86400:stale'] },
    explanation: 'The TTL dial trades freshness for origin pressure. A 5-second TTL bounds stale answers tightly but refreshes often. A 1-day TTL protects the origin but can serve yesterday\'s value all day.',
    invariant: 'TTL caching chooses a freshness/load tradeoff; it does not remove the tradeoff.',
  };

  yield {
    state: cacheGraph({
      cacheNote: 'TTL hit 0 - MISS x1,000',
      originNote: 'ON FIRE: 1,000 identical queries',
      userNote: '1,000 req/s, all unlucky',
      edges: [
        { id: 'miss1', from: 'users', to: 'cache' },
        { id: 'stampede', from: 'cache', to: 'origin' },
      ],
    }),
    highlight: { removed: ['origin', 'stampede'], active: ['miss1'] },
    explanation: 'Synchronized expiry creates a cache stampede. The key protected the origin while it was hot; when it expires, many requests miss together and send duplicate work to the origin.',
  };

  yield {
    state: cacheGraph({
      cacheNote: 'MISS x1,000 -> 1 fetch, 999 wait',
      originNote: 'one query. calm.',
      edges: [
        { id: 'miss1', from: 'users', to: 'cache' },
        { id: 'single', from: 'cache', to: 'origin' },
      ],
    }),
    highlight: { found: ['single', 'origin'] },
    explanation: 'Coalescing makes the first miss own the refresh while the other requests wait. Serve-stale can answer with the expired copy during refresh, and jitter spreads expirations so clocks do not line up.',
    invariant: 'Coalescing collapses N simultaneous misses for one key into exactly one origin request.',
  };
}

function* escapes() {
  yield {
    state: cacheGraph({
      cacheNote: 'PURGE price.json -> dropped',
      originNote: '$79 - purge sent',
      edges: [{ id: 'purge', from: 'origin', to: 'cache' }],
    }),
    highlight: { active: ['purge'], found: ['cache'] },
    explanation: 'Purge moves authority to the write path. The origin changes the value and tells caches to drop the key. This reduces stale time, but correctness now depends on delivery, ordering, and every cache layer receiving the message.',
  };

  yield {
    state: cacheGraph({
      cacheNote: 'app.v42.js cached forever - still correct',
      originNote: 'ships app.v43.js + new HTML',
      edges: [
        { id: 'newRef', from: 'origin', to: 'users' },
        { id: 'oldHit', from: 'users', to: 'cache' },
      ],
    }),
    highlight: { found: ['cache', 'newRef'] },
    explanation: 'Immutable names avoid invalidation. Ship a new filename or content hash for changed bytes, then update the pointer that references it. The old object can stay cached because its name still means the old content.',
    invariant: 'Immutable content needs no invalidation: a new version is a new name, and old names never lie.',
  };

  yield {
    state: cacheGraph({
      cacheNote: 'asks: If-None-Match "abc123"',
      originNote: 'replies: 304 Not Modified (no body)',
      edges: [
        { id: 'ask', from: 'cache', to: 'origin' },
        { id: 'reply', from: 'origin', to: 'cache' },
      ],
    }),
    highlight: { active: ['ask'], found: ['reply'] },
    explanation: 'Revalidation keeps a suspect copy and asks the origin whether its version token is still current. A 304 response saves the body transfer, but the round trip remains.',
  };

  yield {
    state: matrixState({
      title: 'The routing table: data type -> invalidation strategy',
      rows: [
        { id: 'static', label: 'JS, CSS, images' },
        { id: 'api', label: 'API reads, feeds' },
        { id: 'critical', label: 'prices, inventory' },
        { id: 'private', label: 'auth, personal data' },
      ],
      columns: [{ id: 'strat', label: 'strategy' }, { id: 'why', label: 'because' }],
      values: [[1, 2], [3, 4], [5, 6], [7, 8]],
      format: (v) => ['', 'versioned names, cache forever', 'immutability beats invalidation', 'short TTL + SWR + coalescing', 'bounded staleness, herd-proof', 'purge on write (or no cache)', 'staleness costs real money', 'no-store', 'a cached secret is a leak'][v],
    }),
    highlight: { found: ['static:strat'], removed: ['private:strat'] },
    explanation: 'Production systems usually run several strategies at once. Static assets use immutable names, feeds use bounded staleness, critical mutable records need purge or revalidation, and private data may need no-store.',
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
      heading: `Why this exists`,
      paragraphs: [
        `A cache is a copy kept closer to the reader than the source of truth. The copy is useful because it avoids repeated computation, database reads, network hops, rendering, or file transfers. It becomes dangerous the moment the source changes and the copy still looks valid.`,
        `Cache invalidation exists because a system needs a rule for when a copy stops being trustworthy. Without that rule, a CDN can serve an old price, a browser can keep a broken script, an API gateway can return a stale permissions document, or a frontend cache can show a user data that was already changed elsewhere.`,
        `The hard part is that freshness, latency, and origin load fight each other. A long-lived copy is fast and cheap but can be wrong for longer. A short-lived copy is fresher but asks the origin more often. A write-triggered purge can be nearly fresh but turns consistency into a distributed control-plane problem.`,
      ],
    },
    {
      heading: `The naive approach`,
      paragraphs: [
        `The first answer is to pick a TTL and move on. That is reasonable. Time-to-live caching gives each key an expiration time, keeps reads cheap, and bounds how long the cache may serve a known-old value after the origin changes.`,
        `The wall is that a TTL is a trade, not a correctness proof. A five-second TTL can still be too stale for inventory during checkout and too expensive for a hot key at massive scale. A one-day TTL can be perfect for a content-hashed image and unacceptable for a user role. The right number depends on the cost of a wrong answer, not on an aesthetic preference for freshness.`,
        `The second naive answer is to purge every cache on every write. That sounds exact because writes know when data changed. It fails when there are many cache layers, retries, in-flight refills, regional replicas, browser copies, negative caches, and application-side memoization. A missed or reordered purge can leave one stale copy alive with no obvious alarm.`,
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `Every cached key needs a freshness contract. TTL says a copy may be trusted until a time boundary. Purge says a write will tell copies to forget. Revalidation says the cache may keep a suspect copy but must ask the origin whether its version is still current. Versioned naming says this name refers to exactly this content, so new content receives a new name.`,
        `Versioned naming is the cleanest case because it changes the identity problem. If app.8f3ab2.js is named by a content hash, that object never becomes false. A future bundle is not an update to the same key; it is a different key. The cache can keep the old object for a year because the old name still means the old bytes.`,
        `Mutable names are the hard case. A key like price.json, user:42, feed:home, or permissions:team-a means latest value, not this exact byte sequence. The system must decide how readers learn that latest changed.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `TTL caching is the simplest mechanism. On a hit, the cache checks whether now is before the expiration time. If yes, it returns the copy. If no, it fetches from the origin, stores the new value, and sets a new expiration. The lookup is cheap, but the worst-case staleness is the TTL.`,
        `Stampede control handles the moment a popular key expires. Request coalescing, often called single-flight, lets one request perform the refresh while other requests wait for the same result. Serve-stale returns the expired copy while a background refresh runs. TTL jitter adds randomness to expiration times so many keys do not expire in the same second.`,
        `Purge changes direction. The write path tells cache layers to drop or mark a key stale. Revalidation keeps the copy but asks the origin a small question, often with an ETag or version token: is this still current? Immutable versioned names avoid invalidation for content that can be renamed on change.`,
      ],
    },
    {
      heading: `What the visual proves`,
      paragraphs: [
        `The stale-or-stampede view shows two different failures from the same knob. With a long TTL, the cache can serve a stale price after the origin changed. With synchronized expiration, many clients can miss at once and overload the origin. The matrix makes the trade visible: reducing staleness increases refresh pressure.`,
        `The escape-routes view shows that invalidation strategies differ by authority. TTL lets time decide. Purge lets the writer decide. Revalidation asks the origin at read time. Versioning changes the key so the old copy remains true. The final table is the practical lesson: cache policy belongs to the data class.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `TTL works because the system accepts bounded staleness. If the contract says a copy may be at most 60 seconds old, then serving a 40-second-old value is correct under that contract even if the origin changed 10 seconds ago. That is not universal correctness; it is correctness relative to an explicit freshness budget.`,
        `Coalescing works because simultaneous misses for one key are duplicate work. The first request owns the refresh, and the rest depend on its result. The invariant is one in-flight origin fetch per key. Jitter works because it breaks synchronized clocks. Serve-stale works because many systems prefer a slightly old answer to an outage while refresh happens.`,
        `Versioning works for immutable content because truth moves into the name. A content hash, build number, or monotonic version turns a mutable key into a stable identity. The cache no longer needs to discover that app.v42.js changed, because app.v42.js never changes. The HTML, manifest, or API response that points to the current version is the smaller mutable object that needs its own freshness rule.`,
      ],
    },
    {
      heading: `Cost and tradeoffs`,
      paragraphs: [
        `TTL caching is O(1) on ordinary hits and has little coordination overhead. Its tax is wrong-answer time. When the input request rate doubles, hit handling remains cheap, but expiration events can become more painful because more clients are waiting when the key turns cold.`,
        `Purge reduces stale windows but adds distributed state. The write path must know which keys to invalidate, which cache layers hold them, and how to handle failure. It also has race conditions: a stale refill can arrive after a purge, or a purge can reach one region before another. Serious purge systems need idempotent messages, version checks, retries, observability, and sometimes tombstones.`,
        `Revalidation saves bandwidth when bodies are large and changes are rare, but it keeps the round trip. A 304 Not Modified response is cheaper than a full download, not free. Versioning is excellent for static assets and immutable records, but it shifts the problem to the pointer that names the current version. Private data often should not be cached at all unless the isolation rules are precise.`,
      ],
    },
    {
      heading: `Where it wins`,
      paragraphs: [
        `Static assets are the clean win. JavaScript bundles, CSS, images, fonts, and WebAssembly files can use content hashes and long cache lifetimes because changed content gets a new URL. The browser and CDN become allies instead of consistency hazards.`,
        `API and application data need more care. Feeds, recommendation blocks, feature flags, search results, and dashboards often tolerate seconds or minutes of staleness if the system uses coalescing, stale-while-revalidate, and clear freshness indicators. Prices, inventory, permissions, balances, and safety decisions need tighter contracts, purge-on-write, revalidation, or no cache.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `It fails when one global policy is applied to every key. A high cache-hit rate can hide wrong answers if nobody measures stale responses, purge lag, or user-visible inconsistency. The question is not whether the cache is effective; it is whether the copy is allowed to answer this request at this moment.`,
        `It also fails when invalidation paths are invisible. Browser cache, CDN cache, reverse proxy, application memoization, database query cache, negative DNS cache, and client-side state libraries can all hold copies. If a write updates one layer and forgets another, the system can look correct in the origin database while users keep seeing yesterday's state.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study HTTP caching headers, ETag revalidation, Cache-Control, Vary, CDN request flow, service-worker precache manifests, LRU eviction, query-cache stale time and garbage collection, optimistic UI invalidation, content addressing in Git, DNS negative caching, and distributed consistency. Then practice classifying real keys by contract: immutable, bounded stale, purge required, revalidate required, or never cache.`,
      ],
    },
  ],
};
