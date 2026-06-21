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
  const mint = () => { bucket.unshift({ id: `t${minted++}`, value: '*' }); };

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
          explanation: `Request arrives -> spend a token -> [OK] allowed (${bucket.length - 1} token${bucket.length - 1 === 1 ? '' : 's'} left).${n > 1 ? ` (${r + 1} of ${n} this tick — bursts are fine while tokens last.)` : ''}`,
        };
        bucket.shift();
      } else {
        rejected += 1;
        yield {
          state: snapshot(),
          highlight: {},
          explanation: `Request arrives -> bucket EMPTY -> [X] HTTP 429 "Too Many Requests". The client should back off and retry later — well-behaved SDKs do this automatically with exponential backoff.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        `The stack is the token bucket. Each circle is one token — permission to handle one request. The bucket starts full (capacity = ${CAPACITY}). Watch three frames: refill (a new token appears at the top, highlighted active), consume (a token vanishes when a request is allowed), and reject (the bucket is empty and a request is turned away). If the bucket is already full when a refill is due, the new token is discarded — capacity is the ceiling.`,
        {type: 'callout', text: 'A token bucket enforces an average by spending saved permission, not by slicing traffic into fragile calendar windows.'},
        `The input list sets how many requests arrive each tick. Try "1, 0, 4, 0, 1, 3, 0, 1" to see a quiet period build up tokens, a burst drain them, a rejection when the burst exceeds saved permission, and a slow recovery. The final tally shows accepted versus rejected across all ticks — the long-run average, not rigid per-tick enforcement.`,
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `A shared service needs a traffic contract. Without one, a bug, scraper, retry storm, or single large customer can consume capacity that everyone else expected to share. The service still works in a narrow sense, but it becomes unfair, expensive, and fragile. A rate limiter turns "please be reasonable" into a mechanical rule at the boundary.`,
        `The protected resource may be CPU, database connections, GPU time, dollars, or human attention. APIs, login endpoints, webhooks, queues, LLM inference, search indexes, and internal control planes all need the same guarantee: reject early enough that failed work does not burn the resource it was meant to protect.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `Count requests per calendar interval. Fixed-window limiting with a cap of 100 req/min: keep one counter, increment on each request, reject after 100, reset to zero at the next minute boundary. One integer, one expiry timer. In Redis this is INCR + EXPIRE — atomic, fast, obvious.`,
        `The approach works for light traffic. Implementation is two lines of logic. Storage is one integer per key. Every engineer understands it on sight.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `Fixed-window counting enforces limits per calendar interval, not per sliding interval. A client sends 100 requests at second 59 and 100 more at second 60. Both windows pass the 100/min rule individually. But 200 requests landed in 2 seconds — 100x the intended rate. The invariant "at most 100 requests in any 60-second span" is violated even though every individual window is clean.`,
        `Callers do not have to be malicious to exploit this. Retry storms, cron jobs, and batch pipelines naturally cluster at round times. Any scheme that resets a counter on a calendar boundary has this seam. The system needs a model where permission is continuous, not sliced into fixed intervals.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `Store unused permission as tokens. A refill rate (R tokens per second) enforces the long-run average. A bucket capacity (B tokens) bounds how much permission can accumulate during quiet periods. The current token count is a compressed memory of recent behavior: a full bucket means the caller has been under budget; an empty bucket means the caller has consumed its burst allowance and must wait.`,
        `This separates two questions that fixed intervals mix together. How fast may this identity consume service over time? That is the refill rate. How much burst should the system tolerate after idle time? That is the capacity. A public API may keep capacity small for predictable latency. A batch ingestion endpoint may allow large capacity because bursts are expected and backend queues can absorb them.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Four algorithms compete for this job. Each makes a different tradeoff between accuracy, burst tolerance, memory, and implementation complexity.`,
        `Fixed window: one counter per calendar interval, reset at the boundary. O(1) time, O(1) space per key. Simple but exploitable at the boundary, as described above.`,
        `Sliding window log: store the timestamp of every request. On arrival, discard timestamps older than T seconds, count the rest. No boundary to exploit, exact enforcement. But O(n) per check and one stored timestamp per request. At 10,000 req/sec, that is 10,000 entries per key per second.`,
        `Sliding window counter: keep two fixed-window counts and interpolate. If the current window is 40% elapsed, estimated count = current_count + prev_count * 0.6. O(1) space, O(1) time, no sharp boundary. Cloudflare uses this. Not exact, but within a small margin for well-behaved traffic.`,
        `Leaky bucket: requests enter a FIFO queue drained at a fixed rate. Guarantees perfectly smooth output — good for network traffic shaping — but introduces queuing delay. A bursty client with spare backend capacity still waits behind its own queue. Bad for interactive APIs where users expect fast responses while tokens last.`,
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Data_Queue.svg/250px-Data_Queue.svg.png', alt: 'FIFO queue diagram showing enqueue at the rear and dequeue at the front', caption: 'Leaky bucket behaves like a queue with a fixed drain rate, while token bucket admits immediately while saved tokens remain. Source: Wikimedia Commons, Data Queue.svg, public domain.'},
        `Token bucket (Turner, 1986): a bucket holds up to B tokens. Tokens refill at rate R per second. Each request costs one or more tokens. If the bucket is empty, reject. Allows bursts up to B while enforcing average rate R. The key optimization is lazy refill: on each request, compute tokens += R * (now - last_check), cap at B, subtract cost. No background timer. O(1) per check. O(1) per key. This is the dominant algorithm in production API gateways.`,
        `A production token bucket stores two fields per key: current_tokens (a float) and last_refill_time (a timestamp). On each request: elapsed = now - last_refill_time; tokens = min(capacity, current_tokens + elapsed * refill_rate); if tokens >= cost, subtract cost and allow; otherwise reject. Update both fields atomically. No background process drips tokens — lazy refill gives the same result when the key is touched.`,
        `Rejection must be informative. The server returns HTTP 429 Too Many Requests with a Retry-After header (seconds until at least one token is available). Well-designed APIs also return X-RateLimit-Limit (quota), X-RateLimit-Remaining (tokens left), and X-RateLimit-Reset (when the bucket refills to capacity). Clients that respect Retry-After with exponential backoff and jitter avoid retry storms.`,
        `For distributed systems, a Redis Lua script performs the lazy-refill math atomically: read tokens and timestamp, compute new tokens, decide, write back — all in one EVAL call, no race window. Kong, Envoy, and nginx all use variants of this Lua-in-Redis pattern. Idle buckets can be expired — a full bucket is the same as a missing key, since the refill calculation would restore capacity anyway.`,
        `The identity key matters. IP-based limits control sources (but punish shared NATs). User-based limits control accounts. Tenant-based limits enforce fairness across organizations. Serious systems compose layers: a global rate, a per-tenant rate, and a per-endpoint rate, each with its own bucket. A request must pass all layers.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Tokens are a conservation rule. Over any interval, the caller can spend at most the tokens it started with plus the tokens minted during the interval. Starting balance is bounded by capacity. Minted tokens equal refill_rate times elapsed time. Upper bound: accepted requests <= capacity + refill_rate * time. Sustained traffic above the refill rate eventually empties the bucket and starts failing.`,
        `The state is small and monotonic between decisions. Time only adds tokens, capped at capacity. Requests only subtract tokens on admission. The limiter does not need to remember every request timestamp to enforce an average — it remembers the compressed consequence of recent history: how much permission remains.`,
        `Token bucket differs from leaky bucket because it controls admission, not output rate. A leaky bucket smooths output at a fixed drain rate, possibly delaying work even when the backend is idle. A token bucket allows instant bursts up to saved capacity while enforcing the same long-run average. For APIs, this is the more natural contract: fast responses while tokens last, 429 when they run out.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Token bucket: O(1) time per request. O(1) space per key (two numbers: token count and timestamp). Total space is O(active keys). If idle keys are expired, memory tracks active users, not total registered accounts. A service with millions of users but thousands active needs only thousands of entries.`,
        `Sliding window log: O(n) time per check where n is requests in the window. O(n) space per key. Exact, but expensive at high request rates.`,
        `Sliding window counter: O(1) time, O(1) space per key (two counters). Approximate. Good enough for most traffic patterns.`,
        `Leaky bucket: O(1) per enqueue/dequeue decision. O(queue depth) space. The cost is not compute but latency — queued requests wait.`,
        `The practical cost for any distributed algorithm is coordination. A central Redis check adds network latency to the hot path. On a p99-sensitive endpoint, one extra remote round trip can be the difference between healthy and slow. Edge-local limiters avoid that latency but oversell the global budget because each edge has its own local view. A user hitting server A with 3 requests and server B with 3 in the same second sees both servers allow all 3, even if the global limit is 5.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `API gateways are the primary consumer. Kong's rate-limiting plugin stores counters in Redis or PostgreSQL and supports fixed-window, sliding-window, and Redis-cluster modes. Envoy's local rate limiter is a token bucket per route or per connection; its global rate limiter delegates to a gRPC service backed by Redis. nginx uses leaky bucket (limit_req) for request smoothing and token bucket (limit_conn) for concurrent connections. AWS API Gateway enforces token-bucket limits at 10,000 req/sec default per account per region, with burst up to 5,000.`,
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Packet_Switching.gif', alt: 'Packet switching animation across a network', caption: 'Rate limiters sit at network boundaries, admitting or rejecting request traffic before backend resources are consumed. Source: Wikimedia Commons, Oddbodz, public domain.'},
        `Cloud provider throttling is everywhere. AWS throttles EC2 API calls per account, S3 per prefix (5,500 GET/sec), and DynamoDB per table. GCP uses per-project quotas. Azure uses per-subscription limits. Hitting these returns 429 or 503 with Retry-After and is the leading cause of mysterious deploy failures in CI/CD pipelines.`,
        `LLM inference APIs rate-limit on two axes: requests per minute and tokens per minute. A single large generation can consume thousands of token-budget units. The limiter must track both dimensions and reject on whichever is exhausted first. This dual-axis pattern is becoming standard for any API where request cost varies by orders of magnitude.`,
        `Other uses: login endpoints (prevent credential-stuffing by limiting attempts per IP), webhook delivery (protect downstream services from retry storms), background job queues (control release rate toward a fragile dependency), and network traffic shaping (the original use case — Turner's 1986 token bucket was designed for ATM cell scheduling on shared links).`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Wrong key. IP-based limits punish offices, campuses, and mobile carriers that place many users behind one address. User-based limits miss attackers who create many accounts. Tenant-based limits are fairer for SaaS, but one large tenant may need internal per-worker or per-endpoint budgets. The limiter only enforces fairness in the namespace it keys on.`,
        `Retry amplification. A rejected client that retries immediately turns a protective rule into more traffic. The server should return clear retry hints, clients should use exponential backoff with jitter, and SDKs should cap retries. Without this discipline, limiters cause the congestion they were meant to prevent.`,
        `Wrong resource. A request-count limiter does not control database rows scanned, GPU seconds, bytes uploaded, or dollars spent unless token cost is tied to those quantities. A route-level limiter may protect one endpoint while a different endpoint reaches the same backend unprotected. Good limiters are designed from the bottleneck backward.`,
        `Fixed rates. A static limit that is right for normal traffic is too generous during an incident and too stingy during a flash sale. Adaptive rate limiting — adjusting limits based on backend health signals like latency or error rate — addresses this, but adds complexity and risks oscillation.`,
        `Clock skew in distributed systems. If two nodes disagree on the time by 100ms, lazy-refill calculations diverge. At high rates, that disagreement can admit or reject requests incorrectly. Centralizing decisions in Redis avoids this but reintroduces the coordination latency cost.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Token bucket with capacity B=5, refill rate R=1/sec. The bucket starts full at t=0 with 5 tokens.`,
        `t=0.0: request arrives. tokens = 5, spend 1, allow. Remaining: 4.`,
        `t=0.0: request arrives. tokens = 4, spend 1, allow. Remaining: 3.`,
        `t=0.0: request arrives. tokens = 3, spend 1, allow. Remaining: 2.`,
        `t=0.5: request arrives. Lazy refill: 0.5s * 1/sec = 0.5 tokens added. tokens = 2 + 0.5 = 2.5. Spend 1, allow. Remaining: 1.5.`,
        `t=1.0: three requests arrive. Lazy refill: 0.5s * 1/sec = 0.5 tokens added. tokens = 1.5 + 0.5 = 2.0. First request: spend 1, allow (1.0 left). Second request: spend 1, allow (0.0 left). Third request: 0 tokens, REJECTED. Return 429 with Retry-After: 1.`,
        `t=2.0: request arrives. Lazy refill: 1.0s * 1/sec = 1.0 token added. tokens = 0 + 1.0 = 1.0. Spend 1, allow. One second of quiet refilled one token.`,
        `t=5.0: request arrives. Lazy refill: 3.0s * 1/sec = 3.0 tokens added. tokens = min(5, 0 + 3.0) = 3.0. Spend 1, allow. Remaining: 2. The bucket did not refill to 5 because only 3 seconds elapsed — capacity bounds accumulation, not time.`,
        `Totals: 8 requests, 7 allowed, 1 rejected. Long-run average: 7 allowed / 5 seconds = 1.4 req/sec. The burst of 3 at t=0 was absorbed because the bucket was full. The burst of 3 at t=1 was partially absorbed because only 2 tokens had accumulated. The system enforced the average without a window boundary to exploit.`,
        `Compare fixed window (limit 5/sec, 1-second windows): all 3 requests at t=0 pass (window 0 has 3/5 used). All 3 at t=1 pass (window 1 has 3/5 used). The request at t=0.5 and t=2 and t=5 also pass. All 8 allowed. But if the caller had sent 5 at t=0.9 and 5 at t=1.1, both windows would pass — 10 requests in 0.2 seconds, 50x the intended rate. The token bucket would reject the excess because the burst depletes tokens regardless of clock boundaries.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Turner 1986 ("New Directions in Communications," IEEE) introduced the token bucket for ATM networks. Tanenbaum 2003 ("Computer Networks," 4th ed.) covers the leaky bucket for traffic shaping. Varvello et al. 2016 ("Rate-Limiting Considered Harmful," IMC) examines challenges of distributed rate limiting. RFC 6585 (2012) defines HTTP 429 Too Many Requests.`,
        `Study next: Queue — the leaky bucket is a queue with a fixed drain rate; understanding queues clarifies how leaky bucket smooths traffic. Sliding Window — both the log and counter variants are direct applications of the sliding window pattern. Circuit Breaker — rate limiters shed excess load proactively, circuit breakers shed load reactively when a downstream dependency fails; together they form a service's outer defense. Hash Table — the bucket state for every user lives in one, keyed by identity, valued by token count and timestamp. Load Balancer — distributes requests across servers, but each server still needs rate limiting; the two mechanisms compose.`,
      ],
    },
  ],
};
