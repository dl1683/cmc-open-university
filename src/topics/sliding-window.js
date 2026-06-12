// The sliding window: a stretchy range that grows on the right and shrinks
// on the left, maintaining an invariant the whole way. Every element enters
// once and leaves once — O(n) for problems that look O(n²).

import { arrayState, parseNumberList, parseNumber, InputError } from '../core/state.js';

export const topic = {
  id: 'sliding-window',
  title: 'Sliding Window',
  category: 'Concepts',
  summary: 'Find the longest run under a budget in one pass — grow the window right, shrink it left.',
  controls: [
    { id: 'values', label: 'Values', type: 'number-list', defaultValue: '4, 2, 1, 7, 8, 1, 2, 8, 1, 0' },
    { id: 'limit', label: 'Sum budget ≤', type: 'number', defaultValue: '8' },
  ],
  run,
};

const idsBetween = (lo, hi) =>
  Array.from({ length: Math.max(0, hi - lo + 1) }, (_, k) => `i${lo + k}`);

export function* run(input) {
  const values = parseNumberList(input.values, { max: 12 });
  if (values.some((v) => v < 0)) throw new InputError('Use non-negative values — the shrink logic relies on sums only growing as the window widens.');
  const limit = parseNumber(input.limit, { label: 'a sum budget' });

  yield {
    state: arrayState(values),
    highlight: {},
    explanation: `Find the LONGEST stretch of consecutive values whose sum stays ≤ ${limit}. Checking every possible stretch is O(n²) — there are ${(values.length * (values.length + 1)) / 2} of them. The sliding window does it in ONE pass: a stretchy range [left…right] that grows rightward, and shrinks from the left only when it must.`,
  };

  let left = 0;
  let sum = 0;
  let best = { lo: 0, hi: -1 };

  for (let right = 0; right < values.length; right += 1) {
    sum += values[right];
    yield {
      state: arrayState(values),
      highlight: { range: idsBetween(left, right), active: [`i${right}`] },
      explanation: `Grow: bring in ${values[right]} → window [${left}…${right}], sum ${sum}. ${sum <= limit ? `Within budget.` : `OVER budget (${sum} > ${limit}) — the window must shrink from the LEFT until legal again.`}`,
      invariant: 'Everything left of the window is known: no legal window can start there and reach further than we already have.',
    };

    while (sum > limit) {
      sum -= values[left];
      left += 1;
      yield {
        state: arrayState(values),
        highlight: { range: idsBetween(left, right), removed: [`i${left - 1}`] },
        explanation: `Shrink: drop ${values[left - 1]} from the left → window [${left}…${right}], sum ${sum}.${sum <= limit ? ' Legal again — and notice we never re-examined anything: the left edge only ever moves forward.' : ''}`,
      };
    }

    if (right - left > best.hi - best.lo) {
      best = { lo: left, hi: right };
      yield {
        state: arrayState(values),
        highlight: { found: idsBetween(left, right) },
        explanation: `New record: window [${left}…${right}] has length ${right - left + 1} (sum ${sum} ≤ ${limit}).`,
      };
    }
  }

  yield {
    state: arrayState(values),
    highlight: { found: idsBetween(best.lo, best.hi) },
    explanation: `Answer: [${values.slice(best.lo, best.hi + 1).join(', ')}] — length ${best.hi - best.lo + 1}. The accounting that makes this O(n): each element enters the window exactly once (right edge) and leaves at most once (left edge) — ${values.length} entries + at most ${values.length} exits, regardless of how the windows overlap. This pattern solves longest-substring-without-repeats, per-minute rate counting (see Rate Limiter (Token Bucket)), and is literally how TCP paces the internet — the congestion window is a sliding window over unacknowledged bytes. It is Two Pointers with a budget attached.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        `A sliding window is a stretchy range [left, right] that glides across a sequence, growing on the right and shrinking on the left. You move the right edge forward to expand the window, and only when an invariant breaks (sum exceeds a budget, a character repeats, latency spikes) do you advance the left edge to shrink. The beauty: each element enters the window exactly once and leaves at most once, giving you O(n) total work instead of the O(n²) cost of checking every possible range manually.`,
        `The constraint is typically a sum budget, a character uniqueness rule, or a rate limit. As long as your problem can express its constraint in a monotonic way—if you add an element and violate the rule, removing elements from the left will always fix it—the sliding window applies.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Start with both pointers at the beginning. Advance the right pointer to include the next element, updating your running state (sum, set of characters, byte count). Check the invariant: if violated, shrink from the left by advancing the left pointer until valid again. Record any milestone—longest valid window, minimum cost configuration, whatever your problem asks for—then repeat. The left pointer never retreats, only moves forward, so you never re-scan.`,
        `The non-negativity requirement is crucial: if all elements are non-negative, expanding the window always grows the sum monotonically. That monotonicity guarantees: if the window [left, right] violates the sum budget, then shrinking from the left will eventually restore it. In problems with negative values, the monotonicity breaks and sliding window fails—you need a different tool like a segment tree or a heap.`,
        `Think of it geometrically: your right edge is a horizon scanning forward, and your left edge is a gate sweeping closed just behind it, keeping a buffer of interest in between. That buffer is the only place the answer can hide.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Time: O(n). Each of the n elements enters the window once (through the right edge) and leaves at most once (through the left edge), for a total of 2n edge operations. Within each operation, your state update is O(1) amortized, assuming your invariant check is O(1). Space: O(1) if you only track the window pointers and aggregate state (sum, count); O(k) if you store the window contents or maintain a character frequency map.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Longest substring without repeating characters: a sliding window over character positions, where the invariant is character uniqueness. Real HTML parsers and compilers use this to tokenize efficiently.`,
        `Per-minute request rate counting: slide a window over time and keep the count of requests inside. When a new request arrives, advance the window to drop old requests outside the minute boundary. This is how Rate Limiter (Token Bucket) strategies enforce rate caps without recomputing from scratch.`,
        `TCP congestion control: the Internet itself uses a sliding window. TCP's congestion window is a limit on unacknowledged bytes in flight. The sender advances the right edge as it transmits, and shrinks from the left as acknowledgments arrive. A sustained flow of acknowledgments expands the window (more throughput); a timeout shrinks it (safety under congestion). This single idea, running billions of times per second, keeps the Internet from collapsing under load.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `Pitfall: using sliding window on problems where the invariant is not monotonic. If removing an element from the left can make a violation worse (negative values, non-monotonic constraints), the algorithm fails silently—you'll miss valid windows. Always confirm monotonicity first.`,
        `Misconception: the window must contain the final answer. It doesn't. The answer is a property (longest length, minimum sum, best configuration) that you track across all valid windows as you slide. The window is the *mechanism*, not the *answer*.`,
        `Implementation trap: forgetting to advance the left pointer often enough, leaving the window over-extended and the invariant violated. Always shrink until valid; a lazy shrink introduces bugs. Similarly, confusing window size (right - left + 1) with window bounds is off-by-one central.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Two Pointers covers the broader family of algorithms where two indices scan the array. Sliding window is a specialized case, but understanding the general pattern helps you spot new sliding window problems in the wild.`,
        `Rate Limiter (Token Bucket) applies sliding window concepts to time-based resource allocation, key for protecting services from overload.`,
        `Binary Search solves a different family of budget-based problems: not *find the longest run within a budget*, but *find the minimum budget to achieve a goal*. Both are useful; know when each applies.`,
        `Queue and Big-O Growth Rates ground the intuition: queues power many real-world sliding window implementations (draining expired items), and Big-O Growth Rates explain why O(n) beats O(n²) at scale.`,
      ],
    },
  ],
};

