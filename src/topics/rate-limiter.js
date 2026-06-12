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
