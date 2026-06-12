// Cache invalidation: "one of the two hard things in computer science."
// Every cache is a copy that can go stale; every fix trades freshness,
// origin load, or complexity — except the one trick that changes the name.

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
    explanation: '"There are only two hard things in computer science: cache invalidation and naming things" — Phil Karlton\'s joke survives because it is a theorem in disguise. The setup: your origin just dropped a price from $99 to $79, but the CDN (see CDN Request Flow) holds a copy stamped "valid for 300 seconds." Every cache is a COPY, and a copy is a bet that the original will not change before the copy expires. For up to five minutes, you are advertising a price that does not exist. How bad that is depends entirely on what the data IS — and every remedy charges a different toll.',
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
    explanation: 'The first knob everyone reaches for: the TTL — how long a copy may be served before re-checking. Tune it and watch the two columns fight: a 5-second TTL caps staleness at 5 seconds but sends the origin a request every 5 seconds per key; a 1-day TTL nearly eliminates origin traffic and serves yesterday\'s world all day. There is no correct value — there is only the cost of staleness (a wrong price? a day-old avatar?) priced against the cost of origin load. And the TTL has a second, sneakier failure mode that the next step springs.',
    invariant: 'TTL caching bounds staleness at exactly TTL seconds and origin load at 1/TTL per key — you choose the trade, not whether there is one.',
  };

  yield {
    state: cacheGraph({
      cacheNote: 'TTL hit 0 — MISS ×1,000',
      originNote: 'ON FIRE: 1,000 identical queries',
      userNote: '1,000 req/s, all unlucky',
      edges: [
        { id: 'miss1', from: 'users', to: 'cache' },
        { id: 'stampede', from: 'cache', to: 'origin' },
      ],
    }),
    highlight: { removed: ['origin', 'stampede'], active: ['miss1'] },
    explanation: 'Second 300: the popular key expires — for EVERYONE at once. A thousand in-flight requests all miss simultaneously, and the cache forwards a thousand identical queries to an origin sized for the usual 3 per second. This is the THUNDERING HERD (cache stampede): the database melts, latency spikes, retries pile on retries, and the failure cascades exactly like the overload stories in Load Balancer and Message Queue. The bitter irony: the cache was protecting the origin so well that the origin never grew capacity — the shield breaking IS the attack.',
  };

  yield {
    state: cacheGraph({
      cacheNote: 'MISS ×1,000 → 1 fetch, 999 wait',
      originNote: 'one query. calm.',
      edges: [
        { id: 'miss1', from: 'users', to: 'cache' },
        { id: 'single', from: 'cache', to: 'origin' },
      ],
    }),
    highlight: { found: ['single', 'origin'] },
    explanation: 'The herd-taming kit, all three pieces standard in production caches: REQUEST COALESCING (single-flight) — the first miss goes to the origin, the other 999 requests wait on that one in-flight answer instead of duplicating it; SERVE-STALE — hand out the just-expired copy while the refresh happens in the background (the stale-while-revalidate move from Service Workers, here at the CDN layer); and TTL JITTER — add ±10% randomness to every expiry so a thousand keys cached in the same deploy second do not all expire in the same future second. Stampedes are not rare bad luck; they are synchronized clocks, and the fix is desynchronizing them.',
    invariant: 'Coalescing collapses N simultaneous misses for one key into exactly one origin request.',
  };
}

function* escapes() {
  yield {
    state: cacheGraph({
      cacheNote: 'PURGE price.json → dropped',
      originNote: '$79 — and it pushed the purge',
      edges: [{ id: 'purge', from: 'origin', to: 'cache' }],
    }),
    highlight: { active: ['purge'], found: ['cache'] },
    explanation: 'Escape route 1 — PURGE: stop waiting for expiry; have the WRITE invalidate the copies. Update the price, then tell every cache "drop price.json" (CDN purge APIs, Redis DEL, database-triggered events). Freshness becomes near-instant and TTLs can stretch to days. The price is the hard part of the hard problem: the origin must now KNOW every cache that holds the key (distributed state — the CAP Theorem\'s home turf), the purge message can race an in-flight refill and lose (re-caching the stale copy you just purged), and a missed purge is invisible until a customer screenshots it. Push invalidation works; it is just never as simple as the API docs imply.',
  };

  yield {
    state: cacheGraph({
      cacheNote: 'app.v42.js cached forever — still correct',
      originNote: 'ships app.v43.js + new HTML',
      edges: [
        { id: 'newRef', from: 'origin', to: 'users' },
        { id: 'oldHit', from: 'users', to: 'cache' },
      ],
    }),
    highlight: { found: ['cache', 'newRef'] },
    explanation: 'Escape route 2 — the one that DISSOLVES the problem: never change cached content; change its NAME. Ship app.v43.js (or app.8f3ab2.js, hashed from its content) and update the HTML to reference it. The old v42 stays cached forever — and stays CORRECT forever, because v42 never meant anything but that exact byte sequence. Cache-Control: immutable, TTL of a year, zero invalidation, ever. You met this idea as content-addressing in Git Internals (an object\'s name IS its hash) and as the versioned-filename discipline in Service Workers. Karlton\'s joke folds in on itself: the second hard problem, naming things, solves the first.',
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
    explanation: 'Escape route 3 — the compromise: REVALIDATION. The cache keeps the copy past its TTL but demoted to "suspect," and on the next request asks the origin a one-line question: "I have the version tagged abc123 — still current?" (If-None-Match / ETag). Usually the answer is 304 NOT MODIFIED — three bytes of headers, no body, copy promoted back to trusted. Only when content truly changed does a full 200 download. The trade: every revalidation is still a round-trip (latency survives even when bandwidth is saved), so it suits medium-churn content — HTML pages, API responses — where bodies are big but changes are rare.',
  };

  yield {
    state: matrixState({
      title: 'The routing table: data type → invalidation strategy',
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
    explanation: 'The consolidated routing table — most production architectures run all four rows at once, one per data class. The deeper pattern, one last time: a cache is a DISTRIBUTED COPY of state, and keeping copies consistent is the same problem Raft, Two-Phase Commit, and the CAP Theorem wrestle with — invalidation is just consistency\'s street name. You can pay for synchronization (purge), pay with staleness (TTL), pay per-request (revalidate), or refuse to play by making content immutable (versioning). The engineers who sleep at night are the ones who chose route four wherever the data allowed it.',
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
      heading: `What it is`,
      paragraphs: [
        `Cache invalidation is keeping copies in sync when originals change. Every cache — a CDN, Redis, a browser — bets the data will not change before expiry. When it does, you choose: wait for TTL (staleness), purge the copy (complexity), change the name (versioning), or revalidate (ask first). Karlton's joke — "cache invalidation and naming things" — survives because it is true: the visualization shows why and all four solutions.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Set a TTL (say, 300 seconds). Cache serves that copy until expiry, then re-fetches. If the origin's price drops from $99 to $79 after five seconds, users see $99 for five minutes; then $79. Staleness is bounded by TTL. The origin sees one request per 300 seconds, not 1,000 req/s — the cache shields it.`,
        `At expiry, synchronized requests (cached at the same time) all miss at once: thundering herd. A thousand identical queries hit an origin sized for three per second; it melts. Three tools tame it: request coalescing (first miss fetches, others wait), serve-stale (return expired copy while refreshing), and TTL jitter (stagger expirations). One synchronized stampede becomes a measured refresh.`,
        `Three escape routes: (1) Purge — origin tells cache "drop this key" on writes; purge on write = instant freshness. (2) Versioning — ship app.v43.js, never app.js. Old v42 stays cached forever, still correct, costs nothing. New version = new name. (3) Revalidation — cache asks "is this still current?" via ETag; usually 304 Not Modified (tiny response). Full body only when changed.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `TTL: O(1), no state. Cost: you pay in staleness (1 to TTL seconds wrong) and origin load (1/TTL requests per key per second). No free lunch.`,
        `Purge: O(N). Origin must reach every cache. Misses can race purges and re-cache stale data. Correct in theory, messy in practice.`,
        `Versioning: O(1), zero invalidation. Build pipeline creates versions (hashes); HTML references them. Git does this — fast clones, instant checkouts. Immutable naming dissolves the problem.`,
        `Revalidation: one round-trip per request (300–500ms latency). Saves body when unchanged. Suits large, rarely-changing content (HTML, API).`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Static assets: app.8f3ab2.js (content hash). Cache forever; HTML points to the version. Modern web apps, CDNs, service workers all use this.`,
        `APIs and feeds: TTL (5–60s) + serve-stale + coalescing. Small, mutable, hit often. Origin sees steady load; clients see fresh data.`,
        `Prices, inventory: purge on write. $99 to $79 flips instantly. Commerce systems, stock tickers, live feeds.`,
        `HTML, APIs (revalidation): large bodies, rare changes. Browser and CDN ask "still current?" — usually 304. Real sites mix all four, one per data class.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Ignoring thundering herds: long TTLs reduce origin load until expiry hits 10,000 requests simultaneously. System collapses. The fix (coalescing, serve-stale, jitter) is standard but invisible until it breaks.`,
        `Forgetting the trade: TTL staleness and origin load are inverses. Short staleness = high load. No escape into "best of both" without revalidation, purge, or versioning — which come with their own costs.`,
        `Thinking versioning "solves caching": it solves invalidation for static content only. Mutable data (prices, avatars) needs other strategies.`,
        `Confusing invalidation with caching: they are one thing. Invalidation strategy IS your cache. Choose strategy first.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Invalidation is distributed consistency. CAP Theorem explains why purge invalidation is hard. Service Workers & Offline-First covers stale-while-revalidate and ETag flow. CDN Request Flow shows where TTL decisions live. LRU Cache covers eviction (another consistency axis). Git Internals reveals content-addressing: how git names objects by hash and why that beats versioning. Load Balancer and Message Queue show herd-taming patterns.`,
      ],
    },
  ],
};

