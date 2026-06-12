// Token-bucket rate limiting: the bouncer at every API's door.
// Tokens drip in at a steady rate; each request spends one; empty bucket
// means 429. Allows bursts, enforces the average.

import { sequenceState, parseNumberList, InputError } from '../core/state.js';

export const topic = {
  id: 'rate-limiter',
  title: 'Rate Limiter (Token Bucket)',
  category: 'Systems',
  summary: 'Tokens drip into a bucket; requests spend them — bursts allowed, averages enforced, extras get 429.',
  controls: [
    { id: 'arrivals', label: 'Requests arriving per tick', type: 'number-list', defaultValue: '1, 0, 4, 0, 1, 3, 0, 1' },
  ],
  run,
};

const CAPACITY = 4;
const REFILL_PER_TICK = 1;

export function* run(input) {
  const arrivals = parseNumberList(input.arrivals, { min: 4, max: 10, label: 'ticks' });
  if (arrivals.some((a) => a < 0 || a > 6 || !Number.isInteger(a))) {
    throw new InputError('Arrivals per tick must be whole numbers from 0 to 6.');
  }

  let bucket = []; // token items, top of stack = newest token
  let minted = 0;
  let accepted = 0;
  let rejected = 0;
  const snapshot = () => sequenceState('stack', bucket, { });
  const mint = () => { bucket.unshift({ id: `t${minted++}`, value: '●' }); };

  for (let i = 0; i < CAPACITY; i += 1) mint();
  yield {
    state: snapshot(),
    highlight: {},
    explanation: `An API that allows ${REFILL_PER_TICK} request/tick on AVERAGE but tolerates bursts. The trick is a bucket of ${CAPACITY} tokens: every request must spend one token; ${REFILL_PER_TICK} new token drips in each tick (never overfilling). A full bucket = saved-up permission to burst. The bucket starts full.`,
  };

  for (let tick = 0; tick < arrivals.length; tick += 1) {
    if (bucket.length < CAPACITY) {
      mint();
      yield {
        state: snapshot(),
        highlight: { active: [bucket[0].id] },
        explanation: `Tick ${tick + 1}: one token drips in (${bucket.length}/${CAPACITY}). Quiet periods refill the burst allowance — that's the "forgiveness" built into this design.`,
      };
    } else {
      yield {
        state: snapshot(),
        highlight: {},
        explanation: `Tick ${tick + 1}: the bucket is already full (${CAPACITY}/${CAPACITY}) — the refill token is discarded. A full bucket caps how big a burst can ever get.`,
        invariant: `The bucket never exceeds ${CAPACITY} tokens — the maximum burst is bounded.`,
      };
    }

    const n = arrivals[tick];
    for (let r = 0; r < n; r += 1) {
      if (bucket.length > 0) {
        const spent = bucket[0];
        accepted += 1;
        yield {
          state: snapshot(),
          highlight: { removed: [spent.id] },
          explanation: `Request arrives → spend a token → ✅ allowed (${bucket.length - 1} token${bucket.length - 1 === 1 ? '' : 's'} left).${n > 1 ? ` (${r + 1} of ${n} this tick — bursts are fine while tokens last.)` : ''}`,
        };
        bucket.shift();
      } else {
        rejected += 1;
        yield {
          state: snapshot(),
          highlight: {},
          explanation: `Request arrives → bucket EMPTY → ❌ HTTP 429 "Too Many Requests". The client should back off and retry later — well-behaved SDKs do this automatically with exponential backoff.`,
        };
      }
    }
  }

  yield {
    state: snapshot(),
    highlight: {},
    explanation: `Done: ${accepted} allowed, ${rejected} rejected across ${arrivals.length} ticks. Notice WHAT was enforced: not a rigid "1 per tick", but the long-run average — with bursts up to ${CAPACITY} forgiven. Every serious API (Stripe, GitHub, LLM providers) runs this or a sibling (leaky bucket, sliding window), usually as a counter in Redis keyed by user — which is a Hash Table plus arithmetic. Protecting a million-dollar backend takes one integer per customer.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        `A rate limiter is a gatekeeper that controls how many requests a user (or IP address, or API key) can make in a given time window. The token bucket algorithm is the most popular approach: imagine a bucket that starts full with a fixed capacity (say, 4 tokens). Every second (or millisecond, depending on the rate), one new token drips in. When a request arrives, it spends one token and passes through. When the bucket is empty, requests are rejected with HTTP 429 (Too Many Requests). When traffic is quiet, tokens accumulate back to capacity, and the next traffic burst is forgiven.`,
        `The beauty of token bucket: it enforces the long-run average rate (1 request per second, or whatever you set) while allowing short bursts (if 5 requests arrive in quick succession and you have 4 tokens, the first 4 pass, the 5th waits or gets rejected). This matches real traffic patterns much better than a rigid "1 per second, no matter what" policy.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `The algorithm is simple. Initialize the bucket with capacity tokens (say, 4). At each time interval (tick), add 1 token (or refill_per_tick tokens) to the bucket, capped at capacity. When a request arrives, check if the bucket has at least 1 token. If yes, decrement the bucket and allow the request. If no, reject the request. The bucket is usually not a real container but a counter and a timestamp — you compute how many tokens to add based on how much time has passed since the last update.`,
        `In the animation, you can see the bucket growing back up during quiet periods. When requests bunch up (tick 3), they drain tokens; some pass, some fail. The next quiet period lets tokens refill. The key invariant: the bucket never exceeds capacity, which caps the maximum burst size. A bucket of size 4 allows at most 4 consecutive requests no matter how long you wait, preventing a user from gaming the system by idling for days and then unleashing a thundering herd.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Token bucket is O(1) per request — one integer comparison and one increment/decrement. Space is O(number of users) — you need one counter per user (or per IP, or per API key). In production, this is usually stored in Redis (a fast in-memory hash table), where thousands of rate limiters can coexist. The refill can be lazy: instead of running a background job to drip tokens, you recompute how many tokens exist based on elapsed time when a request arrives — saves memory and complexity.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Every public API uses rate limiting, usually token bucket or a sibling (sliding window, leaky bucket). Stripe limits API calls to prevent abuse and ensure fair resource allocation. GitHub allows 60 API calls per hour per IP, 5,000 per hour per authenticated user — tuned to the expected usage of legitimate clients. LLM providers like OpenAI rate-limit API keys to prevent runaway costs from bugs or attacks. Twitter's rate limits are famous — they changed from "requests per 15 minutes" to "tokens per 15 minutes" to allow predictable burst capacity. Internal APIs rate-limit each service to prevent one service from overwhelming another. Denial-of-service (DDoS) mitigation heavily relies on rate limiting: drop traffic from IPs that exceed normal rates, automatically. AWS, Cloudflare, and other infrastructure providers implement sophisticated rate limiters at the edge.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `The biggest pitfall is confusing token bucket with leaky bucket (another algorithm). Token bucket allows bursts, leaky bucket does not — a leaky bucket drains at a constant rate no matter what. Choose token bucket for APIs where users reasonably expect bursts (uploading a batch of files), and leaky bucket for enforcing hard, rigid limits.`,
        `Another pitfall: not accounting for refill lag in distributed systems. If you store the bucket state in Redis and a network delay hits, your refill might be stale when the next request checks. Use a combination of client-side token counting and server-side truth to mitigate. A third misconception: rate limiting solves all abuse. False — a sophisticated attacker can distribute their requests across many IPs (distributed denial of service). Layer rate limiting with authentication (users you trust get higher limits), IP blocking, behavioral analysis, and CAPTCHA challenges.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Read Hash Table to understand how rate limiters store per-user or per-IP state (usually a counter in a hash table or Redis). Study Queue to see how requests are buffered while waiting for tokens or when the backend is busy. Explore Load Balancer to see how rate limiting at the front tier prevents traffic spikes from reaching your servers. Finally, explore Token Bucket, Sliding Window, and Leaky Bucket in depth — they are the three main families of rate-limiting algorithms, each with trade-offs in memory, accuracy, and behavior.`,
      ],
    },
  ],
};

