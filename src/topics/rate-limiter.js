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
      heading: `Why this exists`,
      paragraphs: [
        `A rate limiter exists because a shared service needs a traffic contract. Without one, a bug, scraper, retry storm, or single large customer can consume capacity that other users expected to share. The service may still be correct in the narrow sense, but it becomes unfair, expensive, and fragile. A limiter turns "please be reasonable" into a mechanical rule at the boundary.`,
        `The token bucket version says each identity has a small balance of permission. A request spends tokens. Time refills tokens at a fixed rate, up to a fixed capacity. If the bucket refills at 10 tokens per second and holds 50 tokens, the caller can burst 50 cheap requests after being idle, but cannot average more than 10 per second for long. That is the central bargain: bursts are forgiven, sustained overload is not.`,
        `This matters for APIs, login endpoints, webhooks, queues, LLM inference, search, and internal control planes. The protected resource may be CPU, database connections, GPU time, dollars, or human attention. Reject early enough that failed work does not burn the resource it was meant to protect.`,
      ],
    },
    {
      heading: `The naive approach`,
      paragraphs: [
        `The naive approach is to count requests in a fixed window: at most 100 requests per minute. It is easy to implement with a key, a counter, and an expiry time. It is also easy to explain to customers.`,
        `The wall is the boundary. A caller can send 100 requests at the end of one minute and 100 more at the start of the next, producing 200 requests in a short burst while still obeying the letter of the rule. Another caller can send a harmless burst just after its window filled and be rejected even though it was quiet before that. Fixed windows are simple, but their behavior is tied to clock edges rather than actual service pressure.`,
        `A second naive answer is to allow exactly one request every fixed interval. That protects the backend, but it is hostile to normal traffic. UIs, CLIs, and workers often need short bursts. A good limiter should enforce the average without turning every burst into failure.`,
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `The core insight is to store unused permission as tokens. The refill rate enforces the long-run average. The bucket capacity bounds how much permission can accumulate during quiet periods. The current token count is a compact memory of recent behavior: a full bucket means the caller has been under budget; an empty bucket means the caller has consumed its burst allowance and must wait.`,
        `This separates two questions that fixed intervals mix together. How fast may this identity consume service over time? That is the refill rate. How much burst should the system tolerate after idle time? That is the capacity. A public API may allow a small capacity to keep latency predictable. A batch ingestion endpoint may allow a large capacity because bursts are expected and backend queues can absorb them.`,
        `Tokens can also have cost. A cheap metadata read might spend one token. A report export, vector search, or LLM request might spend tokens proportional to rows scanned, bytes returned, or model tokens generated. That keeps the limiter attached to the resource being protected instead of pretending every request is equal.`,
      ],
    },
    {
      heading: `How the mechanism works`,
      paragraphs: [
        `A production token bucket usually stores two fields per key: current_tokens and last_refill_time. On each request, compute elapsed time since the last update, add elapsed * refill_rate, clamp the result to capacity, then make the decision. If enough tokens exist, subtract the request cost and allow. If not, reject with HTTP 429, return a Retry-After hint, or delay the work in a queue until enough tokens exist.`,
        `No background process has to drip tokens into every bucket. Lazy refill gives the same result when the key is touched. That matters because a service may have millions of possible users but only a fraction active at any moment. The limiter can keep state only for active keys and expire idle buckets after their capacity would have refilled anyway.`,
        `Distributed limiters need atomic updates. Redis Lua scripts, database conditional writes, or single-threaded edge actors are common because refill, check, decrement, and timestamp update must be one decision. If two workers can both see and spend the same token, the limiter is only a suggestion under concurrency.`,
        `The identity key is part of the algorithm. IP limits control sources, user limits control accounts, and tenant limits control fairness. Serious systems often compose these layers.`,
      ],
    },
    {
      heading: `What the visual is proving`,
      paragraphs: [
        `The stack of tokens proves that the limiter is managing budget, not ordering work. Tokens are permission to proceed. A quiet tick refills permission up to the capacity. A request removes permission. When the stack is empty, the request is rejected before the backend does expensive work. Nothing in the visual is a waiting line unless the system chooses to queue rejected work elsewhere.`,
        `The burst ticks prove the difference between average and instantaneous rate. Four requests can pass in one tick because the bucket started with saved tokens. Later requests fail when the saved permission is gone. The final count proves the policy that was enforced: not exactly one request per tick, but one request per tick on average with a burst size bounded by the bucket.`,
        `The refill-discard frame proves why capacity matters. If the bucket is already full, new tokens are thrown away. A caller cannot go idle for a week and return with infinite permission. Capacity is the maximum debt the service is willing to forgive.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `The method works because tokens are a conservation rule. Over any long interval, the caller can spend at most the tokens it started with plus the tokens minted during the interval. The starting balance is bounded by capacity. The minted amount is refill_rate times elapsed time. That gives a simple upper bound: accepted cost <= capacity + refill_rate * time. Sustained traffic above the refill rate eventually empties the bucket and starts failing or waiting.`,
        `It also works because the state is small and monotonic between decisions. Time only adds tokens up to capacity. Requests only subtract tokens when they are allowed. The limiter does not need to remember every request timestamp to enforce an average. It remembers the compressed consequence of recent history: how much permission remains.`,
        `This is why token bucket differs from a leaky bucket queue. A leaky bucket often smooths output at a fixed drain rate, possibly delaying work. A token bucket limits admission but allows bursts while saved tokens exist. In API gateways, token bucket is usually the more natural contract because users see fast bursts until they exhaust their budget.`,
      ],
    },
    {
      heading: `Cost and tradeoffs`,
      paragraphs: [
        `The local cost is O(1) time per request and O(active keys) space. The state is usually a Hash Table from key to token count and timestamp. When request costs vary, the same structure stores a numeric balance instead of a count of identical tokens. If idle keys are expired, memory follows active cardinality rather than total account cardinality.`,
        `The practical cost is coordination. A central Redis or database check adds network latency to the hot path. On a p99-sensitive endpoint, one extra remote round trip can be the difference between healthy and slow. Edge-local limiters avoid that latency but can oversell the global budget because each edge has its own local view. Sharded counters reduce hot-key pressure but require careful reconciliation and may allow small bursts above the nominal limit.`,
        `Precision is another tradeoff. Sliding Window limiters enforce a moving time window more exactly by storing timestamps or bucketed counts, but they use more memory and more complex updates. Token buckets are less exact about any particular window, but they express the behavior most systems actually want: bounded burst plus bounded average.`,
      ],
    },
    {
      heading: `Where it wins`,
      paragraphs: [
        `Token buckets win at API boundaries where users naturally arrive in bursts but fairness is defined over time. A developer running a deploy script should not fail because ten requests happen in the same second after a minute of silence. A token bucket lets that burst through and then slows the caller if it keeps going.`,
        `They also fit network shaping, webhook delivery, background jobs, login protection, expensive search endpoints, and LLM inference. In LLM APIs, request cost should often be tied to input and output tokens, not just request count, because one long generation can cost far more than a small metadata call. In queues, a token bucket can control how quickly workers release jobs toward a fragile downstream dependency.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `The first failure mode is the wrong key. IP-based limits punish offices, campuses, and mobile carriers that place many users behind one address. User-based limits miss attackers who create many accounts. Tenant-based limits are fairer for SaaS, but one large tenant may need internal per-worker or per-endpoint budgets. The limiter only enforces fairness in the namespace it keys on.`,
        `The second failure mode is retry amplification. A rejected client that retries immediately turns a protective rule into more traffic. The server should return clear retry hints, clients should use exponential backoff with jitter, and SDKs should cap retries. Message Queues need the same discipline because delayed retries can stampede when a dependency recovers.`,
        `The third failure mode is assuming the limiter protects the wrong resource. A request-count limiter does not control database rows scanned, GPU seconds, bytes uploaded, or dollars spent unless token cost is tied to those quantities. A route-level limiter may protect one endpoint while a different endpoint reaches the same backend path. Good limiters are designed from the bottleneck backward.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Hash Table for the per-key bucket map, Queue for delayed work, Sliding Window for stricter moving-window enforcement, and Redis Sorted Set Dict & Skiplist for exact timestamp windows. Then connect the limiter to Load Balancer and CDN Request Flow: the earlier abusive traffic is rejected, the less backend capacity it burns.`,
        `After that, study Backpressure & Flow Control, Retries with Exponential Backoff & Jitter, Circuit Breakers, Bulkheads, and Tail Latency & p99 Thinking. Rate limiting is one control in a larger reliability system. It decides who may enter, backpressure decides how producers slow down, and retry policy decides whether rejection reduces load or accidentally multiplies it.`,
      ],
    },
  ],
};
