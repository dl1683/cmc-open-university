// Design a URL shortener — the classic system design warm-up, because a
// "simple" redirect service quietly composes half this site: base-62 IDs,
// database indexes, an LRU cache, rate limits, and a queue for analytics.

import { arrayState, InputError } from '../core/state.js';

export const topic = {
  id: 'url-shortener',
  title: 'Design a URL Shortener',
  category: 'Systems',
  summary: 'From long URL to tiny.url/wDZ and back in milliseconds — the interview classic, fully assembled.',
  controls: [
    { id: 'id', label: 'Encode database ID', type: 'select', options: ['125487', '999'], defaultValue: '125487' },
  ],
  run,
};

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function* run(input) {
  const id = parseInt(String(input.id), 10);
  if (![125487, 999].includes(id)) throw new InputError('Pick an ID.');

  yield {
    state: arrayState(['t', 'i', 'n', 'y', '.', 'u', 'r', 'l', '/', '?', '?', '?']),
    highlight: { active: ['i9', 'i10', 'i11'] },
    explanation: 'The brief: turn a 200-character URL into tiny.url/??? and redirect anyone who clicks it — at scale: ~100 million new links a month (≈40 writes/sec) and a hundred times more clicks (≈4,000 reads/sec). Two sub-problems hide inside: MINT a unique short code, and SERVE the redirect fast. Both are made of things you already know.',
  };

  yield {
    state: arrayState([...ALPHABET.slice(0, 10), 'a-z', 'A-Z']),
    highlight: { range: Array.from({ length: 12 }, (_, i) => `i${i}`) },
    explanation: `Minting, the clean way: give every URL a database ID from a counter (1, 2, 3…) and write that NUMBER in BASE 62 — digits, lowercase, uppercase: 62 symbols. Why 62? URL-safe without ugly encodings, and brutally compact: 62⁷ ≈ 3.5 TRILLION codes in just 7 characters. (Hashing the long URL works too — MD5 then truncate — but then identical inputs collide with different users' links and you need collision-probing like a Hash Table; a counter never collides.)`,
  };

  // base-62 encoding, step by step
  let n = id;
  const digits = [];
  while (n > 0) {
    const rem = n % 62;
    digits.unshift(ALPHABET[rem]);
    const next = Math.floor(n / 62);
    yield {
      state: arrayState([...digits]),
      highlight: { active: ['i0'] },
      explanation: `Encode ${n}: divide by 62 → quotient ${next}, remainder ${rem} → symbol '${ALPHABET[rem]}' (position ${rem} in the alphabet). ${next > 0 ? 'Keep dividing the quotient.' : 'Quotient hit zero — done.'} (The same divide-by-the-base loop as binary, just with 62 — compare Binary Exponentiation's bit-walking.)`,
      invariant: 'Each remainder is one base-62 digit; reading them in reverse order of computation spells the code.',
    };
    n = next;
  }
  const code = digits.join('');

  yield {
    state: arrayState([...digits]),
    highlight: { found: digits.map((_, i) => `i${i}`) },
    explanation: `ID ${id} → tiny.url/${code} — ${digits.length} characters, guaranteed unique because the underlying counter is. One wrinkle at scale: a single global counter is a bottleneck and a single point of failure, so real systems hand out counter RANGES to each server (server A mints 1–1M, server B mints 1M–2M…) — distributed coordination dodged entirely.`,
  };

  yield {
    state: arrayState([`${code}`, '→', 'longURL', '+', 'owner', '+', 'clicks']),
    highlight: { active: ['i0'] },
    explanation: `Storage: one row per link, keyed by the code — a primary-key lookup in a B-tree (see Database Indexing), O(log n) even at billions of rows. The redirect itself is one HTTP status decision: 301 (permanent — browsers cache it, your servers see fewer hits, but you lose click analytics) versus 302 (temporary — every click comes to you, countable). Most shorteners pick 302 precisely BECAUSE the clicks are the product.`,
  };

  yield {
    state: arrayState(['GET /' + code, 'LRU cache', 'database', '302 →']),
    highlight: { found: ['i1'], visited: ['i2'] },
    explanation: 'The read path, where the 100:1 read ratio lives: clicks follow a power law (a few viral links get most of the traffic), which is EXACTLY the workload an LRU Cache devours — expect 90%+ of redirects to never touch the database. Behind a Load Balancer, in front of a Rate Limiter (Token Bucket) (or someone scripts a million redirects through you), with each click event dropped onto a Message Queue for the analytics pipeline to count at its own pace.',
  };

  yield {
    state: arrayState([...digits]),
    highlight: { found: digits.map((_, i) => `i${i}`) },
    explanation: 'Step back and count the ingredients: a counter + base-62 (number systems), a B-tree primary key (Database Indexing), an LRU Cache, a Load Balancer, a Rate Limiter (Token Bucket), a Message Queue, and — if you shard the database — Consistent Hashing to decide which shard owns each code. THIS is why "design a URL shortener" opens every system design interview: it is the smallest problem that exercises the whole toolbox. You now own every tool in it.',
  };
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'A URL shortener looks like a toy service: accept a long URL, return a short code, and redirect clicks. It is useful because it compresses long links for messages, QR codes, campaigns, internal tools, and analytics.',
        {
          type: 'callout',
          text: 'A short URL is an indirection handle: the code stays small while the row behind it carries ownership, policy, and analytics.',
        },
        'The reason it is a classic system-design problem is that the small product surface hides many core distributed-systems choices: id generation, encoding, storage, caching, redirect semantics, rate limiting, analytics queues, abuse prevention, and sharding.',
        'The product also has an asymmetric workload. Writes create short links. Reads are clicks. Popular links can receive many orders of magnitude more reads than writes, so the read path and cache strategy dominate user experience and cost.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to hash the long URL and use the first few characters as the code. That sounds deterministic and simple, but collisions become product decisions. Two users shortening the same destination may need separate analytics, ownership, expiration, and abuse controls.',
        'Another shortcut is to run analytics inline during redirect. That makes the slowest part of the product sit on the latency-critical path. A redirect should be fast; click events can flow into a queue and be counted later.',
        'A third shortcut is to use permanent redirects everywhere. A 301 can reduce load because browsers cache it, but it also means future clicks may bypass the shortener, hurting analytics and making destination changes harder. Many products prefer 302 or another temporary redirect because measurement is part of the product.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is to separate identity from destination. The short code identifies a row owned by the shortener. The row stores long URL, owner, creation time, expiration, redirect policy, abuse state, and analytics configuration.',
        'A counter plus base-62 encoding gives compact, unique codes without relying on the long URL as the key. Base 62 uses digits, lowercase letters, and uppercase letters. Seven characters cover trillions of ids, enough for very large services.',
        'The read path is a lookup problem, not a computation problem. Given a code, find the destination quickly, return a redirect, and record the click asynchronously. That separation is what keeps clicks fast while analytics stays rich.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'On creation, validate the destination, apply abuse and rate-limit checks, allocate an id, encode it in base 62, store the mapping, and return the short URL. At scale, id allocators can hand ranges to application servers so link creation does not require a single hot counter on every request.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/65/QR_code_for_QRpedia.png', alt: 'QR code that resolves to a shortened QRpedia URL', caption: 'Short links often end up inside QR codes, where every saved character lowers printed density. Source: Wikimedia Commons, Terence Eden and Roger Bamkin, MIT License.'},
        'On click, parse the code, check cache, fall back to the database on miss, verify link status, and return the configured redirect. Hot links follow a power-law distribution, so an LRU or similar cache can absorb a large share of redirect traffic.',
        'Analytics should be decoupled. The redirect service emits a click event containing code, timestamp, coarse geography, referrer, user agent, and fraud signals. A queue lets analytics consumers aggregate clicks without delaying the redirect response.',
        'Large deployments shard by code, id range, owner, or hash, depending on operational needs. Replication and regional routing matter because redirect latency is user-visible, while link creation can tolerate slightly more coordination.',
        'Expiration and takedown are part of the write model. A link can be active, expired, suspended, deleted, or owner-disabled. The redirect path must check that state before returning the destination, and cache entries must respect state changes.',
        'Custom aliases add another path. Instead of allocating a numeric id, the service reserves a human word under a namespace. That requires uniqueness checks, moderation, ownership transfer rules, and sometimes paid-plan limits.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The base-62 steps prove that a short code is just a number written in a denser alphabet. Each remainder becomes one character. The code is short because the alphabet is large, not because the system is magical.',
        'The storage step proves that the code is a primary key into a richer row. The row can hold owner, destination, status, expiration, and analytics settings.',
        'The read-path step proves why caching and queues matter. Cache protects the database from hot links. The queue keeps analytics off the redirect path. The redirect itself stays simple and fast.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Counter-based ids work because uniqueness is solved once, before encoding. Base-62 encoding preserves that uniqueness while producing human-usable codes.',
        'Caching works because clicks are skewed. A few links get most of the traffic, so keeping hot mappings in memory avoids repeated database lookups.',
        'Queues work because analytics is not required to decide the redirect. The system can acknowledge a click event to durable infrastructure and let downstream jobs compute dashboards, fraud signals, and campaign reports later.',
        'State checks work because the code is only an indirection handle. Changing a destination, expiring a campaign, or suspending an abusive link updates the row behind the code rather than changing the public link.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The write path is simpler than the read path but still needs id allocation, validation, abuse prevention, and persistence. The read path needs low latency, cache consistency, fallback behavior, and protection against hot-link spikes.',
        'Custom aliases are a product feature but create namespace contention, moderation concerns, and ownership disputes. Random or counter-generated codes are easier to scale.',
        'Analytics increases value but adds privacy, storage, and compliance costs. Keeping every click forever may be unnecessary or risky. Aggregate data, retention windows, and redaction policies should be designed explicitly.',
        'Regional deployment adds another tradeoff. Serving redirects close to users lowers latency, but writes, takedowns, and abuse decisions must propagate quickly enough that dangerous links do not remain active in one region after removal elsewhere.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'URL shorteners are useful for public links, internal go links, QR codes, marketing campaigns, affiliate links, documentation redirects, release notes, and any workflow where the destination may change while the public link should stay stable.',
        'Internal shorteners are especially valuable because they turn tribal paths into stable names: go/oncall, go/roadmap, go/pricing. The short link becomes an organizational index.',
        'The same architecture pattern appears in invite links, file-sharing handles, paste links, tracking links, and object ids that need a small public token over a richer private row.',
        'They also help migrations. If a documentation site, product page, or PDF moves, the short link can stay stable while the destination row changes behind it, as long as ownership and audit rules are enforced.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Collision handling is a common mistake when teams truncate hashes without a clear ownership model. If different users need different link records for the same destination, deterministic destination hashing is the wrong primary identity.',
        'Open redirects and phishing are serious risks. The service should validate schemes, block dangerous destinations, support abuse takedown, and make preview or warning flows available for suspicious links.',
        'Another failure is cache stampede. If a viral link expires from cache, thousands of clicks can hit the database at once. Use request coalescing, TTL jitter, hot-key protection, and graceful fallback.',
        'A final failure is weak observability. Redirect errors, abuse blocks, cache hit rate, queue lag, hot keys, takedown propagation, and regional latency should be visible separately. Otherwise all failures look like generic redirect slowness.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Database Indexing for primary-key lookup, LRU Cache for hot redirect mappings, Message Queue for analytics decoupling, Consistent Hashing for sharding, Rate Limiter Token Bucket for abuse protection, Idempotency Keys for safe retries, and Cache Invalidation & Versioning for destination changes and takedowns.',
        'When designing one yourself, write down who owns each code, who can change the destination, how takedowns propagate, and what evidence is kept after abuse reports. Those rules matter as much as the base-62 encoder.',
      ],
    },
  ],
};
