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
      heading: `What it is`,
      paragraphs: [
        `A rate limiter is a traffic contract: this user, IP, tenant, or API key may consume at most this much service over time. The token bucket version stores a small balance of tokens. A request spends one token; a background clock refills tokens at a fixed rate up to a maximum capacity. If the bucket refills at 10 tokens per second and holds 50 tokens, the caller can burst 50 requests at once but cannot average more than 10 requests per second for long.`,
        `That burst allowance is the reason token buckets became common in network traffic shaping and API gateways. A rigid fixed window punishes harmless bursts at the boundary; a token bucket lets a CLI upload 20 files quickly after being idle, then pushes back when the long-run budget is exhausted. The response might be HTTP 429, a retry-after delay, or an internal Queue that waits for more tokens.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `A production implementation usually stores two fields per key: current tokens and last_refill_time. On each request, compute elapsed time, add elapsed * refill_rate tokens, clamp to capacity, then decide. If tokens >= request_cost, subtract the cost and allow. Otherwise reject or delay. No real dripping process is needed; lazy refill gives the same result with less work.`,
        `Distributed limiters put that state in Redis, DynamoDB, or an edge-local store and update it atomically. Redis Lua scripts are common because check-and-decrement must be one operation; otherwise two concurrent requests can both see the same token and overspend. Sliding Window counters are another family: they remember recent timestamps or bucketed counts to enforce a precise moving limit, but they use more memory. Token buckets are less exact but cheap, burst-friendly, and predictable.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The local algorithm is O(1) time and O(active keys) space, usually implemented as a Hash Table from key to bucket state. The expensive part is coordination. A central Redis round trip might cost 0.5-2 ms inside a region and much more across regions, which is enough to affect Tail Latency & p99 Thinking on a hot endpoint. Edge-local approximate limiters are faster but can oversell the global budget. Sharded counters reduce hot keys but introduce reconciliation work.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Public APIs use limiters to protect shared capacity and prevent surprise bills. GitHub's long-standing REST API shape is thousands of authenticated calls per hour rather than unlimited scraping. Stripe and Shopify protect checkout APIs from runaway integrations. Cloudflare Workers and AWS API Gateway enforce tenant budgets at the edge before traffic reaches an origin. LLM APIs use token budgets because one request can cost 100 times another. A Load Balancer often applies coarse IP limits first, then an application gateway applies authenticated per-customer limits.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The first trap is choosing the wrong key. IP-based limits punish offices, campuses, and mobile carriers that NAT thousands of users behind one address. User-based limits miss botnets that rotate accounts. Tenant-based limits are fairer for SaaS, but one customer can still have many workers racing the same bucket.`,
        `The second trap is treating rejection as harmless. If every rejected client retries immediately, the limiter creates a self-inflicted denial of service. Return retry-after hints, add jitter, and cap retries. Message Queues need the same care: delayed retries should not stampede when a downstream service recovers. Rate limiting is not fraud detection; it is a resource guardrail that must be paired with authentication, abuse analysis, and sometimes Cache Invalidation & Versioning when cached authorization decisions change.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Read Hash Table for the per-key state map, Queue for delayed work, and Sliding Window for the stricter moving-window alternative. Then connect the limiter to Load Balancer and CDN Request Flow: the earlier you reject abusive traffic, the less backend capacity it burns. Finally, use Tail Latency & p99 Thinking to see why one extra remote counter lookup can matter on the slowest requests.`,
      ],
    },
  ],
};
