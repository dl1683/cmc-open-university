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
      heading: 'What it is',
      paragraphs: [
        `A URL shortener maps sprawling 200-character URLs (like amazon.com/s?k=best-hammers-2026) into memorable 6-character codes (bit.ly/aB3xYz) that fit in tweets, QR codes, and offline marketing. When someone clicks the short link, the service redirects them instantly to the original. Simple redirect sounds trivial — yet this problem exercises every tool in distributed systems: counters that never collide, database indexes, caching under skewed load, rate limiting, message queues, and consistent sharding.`,
        `The scale is deceptive. Bit.ly and TinyURL handle hundreds of millions of unique shortened links, but each link is clicked dozens or hundreds of times. That 100:1 read-write ratio means caching is not a luxury — it is the difference between a $10k/month bill and a $100k/month bill.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Minting a short code: every new URL gets a database ID from a distributed counter. Instead of storing that ID directly (billions of tiny rows blow up storage), encode it in base 62 — 10 digits plus 26 lowercase plus 26 uppercase letters, 62 symbols total. A 7-character code in base 62 yields 62^7 ≈ 3.5 trillion unique codes, enough for centuries at today's growth. Divide the ID by 62 repeatedly; each remainder is one symbol. Counter ranges solve the coordination bottleneck: server A mints IDs 1–1,000,000; server B mints 1,000,001–2,000,000. No locking, no Paxos, no distributed consensus — just pre-allocated ranges.`,
        `Serving redirects: on every click, do a primary-key lookup in a B-tree index (microseconds for billions of rows) and return a 302 Found response with the original URL. That 302 matters: a 301 Permanent redirect gets cached by browsers, so clicks stop hitting your servers and you lose analytics. A 302 Temporary forces every click through you — that is the business model. Behind a load balancer, an LRU Cache intercepts 90%+ of clicks (zipfian click distribution — a few viral links get all the traffic), so the database sees only 400 reads/sec despite 4,000 total clicks/sec. Each click event streams onto a message queue (Kafka, RabbitMQ) for the analytics system to consume at its own pace, decoupling the redirect latency from analytics computation.`,
        `Rate limiting: without it, someone scripts a million requests and you get a surprise $50k AWS bill. A token bucket (or leaky bucket) rate limiter sits in front of each shortened link, allowing N clicks/sec and dropping or delaying excess traffic. Sharding: at massive scale, one database table splits across multiple shards using consistent hashing on the short code; hashing ensures that any code always maps to the same shard, avoiding distributed lookups.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `A basic URL shortener in memory (hash table, no persistence, no scale) is 20 lines. A production shortener that survives billions of links, handles 4,000 reads/sec reliably, tracks analytics, recovers from crashes, and never loses a link requires a B-tree database (PostgreSQL, MySQL), a cache layer (Redis running LRU in RAM), a message queue (Kafka or RabbitMQ for click events), a load balancer (nginx, HAProxy), and distributed counter logic (Zookeeper, etcd, or pre-allocated ranges). Operational cost is not zero: memory for the cache, network bandwidth, database replication, monitoring, and on-call alerting. Complexity explodes when you ask harder questions: how do you migrate shards without downtime, handle the cache thundering herd after the database goes down, or age out links that have not been clicked in 5 years?`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Bit.ly and TinyURL pioneered this in the 2000s for shortening long URLs on Twitter before URLs could be links. Today, link shorteners are everywhere: go.company.com (internal traffic tracking), URL tracking in newsletters (click analytics), QR code campaigns (physical advertising), and affiliate links (Amazon shorteners take a commission). Every large tech company (Google, Facebook, Stripe) has an internal shortener. Short URLs also mask the destination (sec risk: phishing links look legitimate) and let organizations rebrand without breaking old links (bit.ly/report-2024 stays live even if the underlying PDF moves servers).`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `Hashing the URL instead of using a counter is tempting: same input always produces the same short code, so two identical submissions get the same link for free. But when different users shorten identical URLs, they all collide — forcing you into hash-table collision handling with quadratic probing or chaining, same as Hash Table bugs. Counters never collide and encode far more gracefully. Another trap: picking 301 Permanent redirects to reduce server load. This sounds smart (browsers cache the redirect, your database takes fewer hits), but you lose all click analytics and cannot measure campaign success — the entire business case evaporates. 302 costs more but is the right answer. Forgetting rate limiting until traffic spikes is the most common mistake; sudden load hits the cache miss rate hard, the database melts, and you burn through credits while scrambling to add rate limiting. Finally, underestimating the scale of the analytics tail: clicks are not uniformly distributed — a single viral link can spike to 1,000 clicks/sec, overwhelming an unprepared message queue.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Dive into Database Indexing to understand why B-tree lookups on billions of rows are still microseconds. Explore LRU Cache to see how a tiny in-memory layer absorbs 90% of traffic. Study Message Queues to decouple the fast redirect path from the slow analytics pipeline. Learn Consistent Hashing when you add sharding — how to map short codes to database shards without knowing how many shards exist. Finally, Rate Limiter (Token Bucket) is your firewall against abuse: implement it correctly and you sleep well knowing a single malicious user cannot sink your service.`,
      ],
    },
  ],
};
