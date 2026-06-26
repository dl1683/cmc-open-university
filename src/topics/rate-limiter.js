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
        'Read the animation as a token bucket, which is a counter of saved permission for future requests. Each tick adds tokens up to a capacity, and each accepted request spends tokens.',
        {type: 'callout', text: 'A token bucket enforces an average by spending saved permission, not by slicing traffic into fragile calendar windows.'},
        {type: 'image', src: './assets/gifs/rate-limiter.gif', alt: 'Animated walkthrough of the rate limiter visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The safe inference rule is that quiet time can create burst allowance, but only up to the bucket capacity. Once the bucket is empty, extra requests are rejected or delayed even if earlier ticks were idle.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A rate limiter exists because shared systems need a boundary before overload reaches the expensive part. Without one, a retry storm, abusive client, or accidental loop can consume threads, database connections, or model-serving tokens needed by other users.',
        'A token bucket expresses a contract: average rate R, burst capacity B, and cost per request. That contract is easier to reason about than vague fairness because every admission decision spends a stored unit.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a fixed window counter. Count requests per user per minute, allow the first 60, and reject the rest until the next minute starts.',
        'It is simple and cheap, but the calendar boundary is artificial. A client can send 60 requests at 12:00:59 and 60 more at 12:01:00, producing 120 requests in two seconds under a 60-per-minute rule.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is burst shape. Real traffic is lumpy, and users expect short bursts after idle time, but backends need a long-run average that prevents sustained overload.',
        'A leaky bucket queue smooths output but can add waiting and queue memory. A limiter at an API boundary often needs a direct allow-or-reject decision before the backend does work.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to refill permission over time and spend it at request time. Tokens represent accumulated right to send traffic, and the bucket cap prevents infinite saving.',
        'Lazy refill makes the idea practical. Instead of running a timer for every user, the limiter computes how many tokens should have arrived since the last request and updates the bucket when the key is touched.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Data_Queue.svg/250px-Data_Queue.svg.png', alt: 'FIFO queue diagram showing enqueue at the rear and dequeue at the front', caption: 'Leaky bucket behaves like a queue with a fixed drain rate, while token bucket admits immediately while saved tokens remain. Source: Wikimedia Commons, Data Queue.svg, public domain.'},
        'For each key, store current_tokens and last_refill_time. On a request, compute elapsed time, add elapsed * refill_rate, cap at capacity, and allow only if enough tokens remain for the request cost.',
        'The update must be atomic when several workers share the same key. Redis Lua scripts, database conditional writes, or local locks are common ways to prevent two requests from spending the same token.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness follows from conservation of tokens. Over any long interval, the bucket can spend at most the initial saved tokens plus tokens generated by elapsed time.',
        'The burst bound follows from the cap. Even after a long idle period, the client cannot save more than B tokens, so the largest immediate burst is bounded by capacity.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A token bucket check is O(1) per request because it reads and writes a constant-size state record. Memory is O(number of active keys), and idle keys can expire because a missing key is equivalent to a full bucket after enough time.',
        'Cost changes with cardinality and distribution. One million active API keys require one million small state records, while one hot key may require careful atomic updates to avoid turning the limiter store into the bottleneck.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Packet_Switching.gif', alt: 'Packet switching animation across a network', caption: 'Rate limiters sit at network boundaries, admitting or rejecting request traffic before backend resources are consumed. Source: Wikimedia Commons, Oddbodz, public domain.'},
        'Rate limiters protect public APIs, login endpoints, webhook senders, job dispatchers, and model-serving systems. The common need is to reject or delay work before a scarce downstream resource is consumed.',
        'They also encode product policy. A free tier, paid tier, and internal service can share the same algorithm while using different refill rates, bucket sizes, and request costs.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A token bucket fails when one dimension does not represent real cost. LLM APIs often need request-per-minute and token-per-minute buckets because one request can consume 200 tokens or 20,000 tokens.',
        'Distributed limiters fail when clocks drift, replicas split state, or atomicity is skipped. A limiter that lets each server make independent decisions can multiply the true allowance by the number of servers.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose capacity B=5 tokens and refill rate R=2 tokens per second. A client waits 3 seconds, so the bucket reaches min(5, 0+6)=5 tokens, then sends 4 one-token requests that are all accepted and leave 1 token.',
        'If the client immediately sends 3 more requests, the first is accepted and the next two are rejected because the bucket reaches 0. After 0.5 seconds, one token has refilled, so one more one-token request can pass.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read Turner on the token bucket traffic descriptor and current HTTP guidance for 429 Too Many Requests and Retry-After. Then inspect documentation for the gateway or proxy you actually deploy because atomicity and keying behavior vary.',
        'Study queues, backpressure, exponential backoff with jitter, distributed locks, Redis scripting, load shedding, and congestion control next. Rate limiting is one admission-control tool, not a full reliability strategy.',
      ],
    },
  ],
};
