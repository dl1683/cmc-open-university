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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a request path, not as a string trick. A long URL is stored as a row, a short code becomes the public handle for that row, and a click resolves the handle back to the destination.',
        {
          type: 'image',
          src: './assets/gifs/url-shortener.gif',
          alt: 'Animated walkthrough of the url shortener visualization',
          caption: 'Animation preview: the full visualization plays through each step at reading pace.',
        },
        'Active states show code creation, lookup, redirect, and analytics emission. The safe inference rule is that the short code is not the destination; it is an indirection key whose row can carry policy, ownership, expiration, and abuse state.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A URL shortener turns a long address into a small public code. It exists because messages, QR codes, printed material, internal tools, and analytics campaigns often need a stable small link over a longer destination.',
        {
          type: 'callout',
          text: 'A short URL is an indirection handle: the code stays small while the row behind it carries ownership, policy, and analytics.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to hash the long URL and keep the first few characters. That feels deterministic because the same input always produces the same code.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is collision and ownership. Truncated hashes can collide, and deterministic destination hashing merges records that the product needs to keep separate.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate the public code from the destination. The code identifies a row, and the row stores the long URL plus metadata such as owner, status, created time, expiration, redirect type, and analytics policy.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'On creation, validate the destination, check rate limits and abuse rules, allocate an id, encode the id, store the row, and return the short URL. Large systems often allocate id ranges to application servers so one counter is not a bottleneck.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/6/65/QR_code_for_QRpedia.png',
          alt: 'QR code that resolves to a shortened QRpedia URL',
          caption: 'Short links often end up inside QR codes, where every saved character lowers printed density. Source: Wikimedia Commons, Terence Eden and Roger Bamkin, MIT License.',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness starts with unique id allocation. If every stored row receives a unique id, base-62 encoding preserves uniqueness because it is just another representation of that integer.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Creation is usually a write-heavy path with validation, id allocation, and persistence. Redirect is usually read-heavy and must be fast, so cache hit rate and hot-key behavior dominate user-visible cost.',
        'Seven base-62 characters can encode 62 to the 7th values, which is about 3.5 trillion ids. If the service creates 100 million links per day, that space lasts about 35,000 days before needing longer codes, ignoring reserved aliases.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Public short links support campaigns, QR codes, social posts, affiliate links, documentation redirects, and release notes. The access pattern is many reads per write, with a small fraction of links receiving most clicks.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Open redirect abuse is a major failure mode. Attackers can hide phishing or malware destinations behind trusted short domains unless the service validates schemes, scans destinations, and supports takedown.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the allocator returns id 125. In base 62, 125 divided by 62 gives quotient 2 and remainder 1, so the code uses characters for 2 and 1, such as 21 under a simple digit-first alphabet.',
        'If the link receives 10,000 clicks in one minute and cache hit rate is 99 percent, only about 100 reads reach the database. The redirect path stays fast while the analytics queue receives all 10,000 click events for later aggregation.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study database indexing for code lookup, LRU caches for hot redirects, message queues for analytics, and rate limiters for abuse control. Then study consistent hashing, id generation, cache invalidation, and privacy-preserving analytics.',
      ],
    },
  ],
};
