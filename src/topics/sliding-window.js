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
      heading: 'How to read the animation',
      paragraphs: [
        'The highlighted range is the current window [left..right]. The active (bright) cell is the element the right pointer just absorbed. A removed cell is one the left pointer just expelled. Found marks the longest legal window discovered so far.',
        {type: 'callout', text: 'The sliding-window proof is pointer accounting: each element enters once and leaves at most once.'},
        'The animation shows the expand-contract variant: grow the right boundary, then shrink the left boundary until the sum invariant holds. The same structural discipline — two pointers that only move forward — powers every sliding window algorithm, including the monotonic-deque maximum described below.',
        'Watch the left pointer: it never retreats. That forward-only movement is both the reason the algorithm is O(n) and the visual proof that no element is processed more than twice.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many problems ask the same shaped question: what is the best, largest, smallest, or aggregate value in every contiguous subarray of size k? Stock analysts want the rolling maximum over the last 30 days. Network monitors want the peak throughput in every 5-second window. LeetCode 239 asks for the maximum of every subarray of size k directly.',
        'An array of n elements has n-k+1 windows of size k. Each window contains k elements. Answering the question for all windows by scanning each one independently costs O(nk). When k is small that is fine. When k is in the thousands — 30-day rolling max on minute-resolution data, or a TCP window over a long buffer — the redundant work dominates.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'For each window position i, scan elements i through i+k-1 and find the maximum. That inner scan costs O(k) per window, and there are n-k+1 windows, so the total is O(nk). For n = 100,000 and k = 1,000, that is roughly 100 million comparisons.',
        'Most of those comparisons are wasted. Consecutive windows overlap by k-1 elements. Sliding the window one step right removes one element on the left, adds one on the right, and keeps k-1 elements unchanged. Re-scanning all k elements ignores that overlap entirely.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Running sums dodge this waste easily: subtract the departing element, add the arriving one. But maximum does not compose the same way. When the current maximum leaves the window, you cannot recover the new maximum from the old one without looking at the remaining elements. A running sum is reversible; a running max is not.',
        'That asymmetry is the wall. You need a structure that tracks not just the current maximum but also who takes over when the maximum departs. The answer is a monotonic deque — a double-ended queue that maintains candidates in decreasing order of value, with stale indices automatically expiring from the front.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'If a newer element is larger than an older element, the older element can never be the maximum of any future window. It is in the same window or an earlier one, and it is smaller. It will never matter again.',
        'This means we can maintain a deque of candidate indices sorted by decreasing value. When a new element arrives, we pop every element from the back of the deque that is smaller — they are permanently obsolete. Then we push the new index onto the back. The front of the deque is always the maximum of the current window. When the front index falls outside the window, we pop it.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Initialize an empty deque. For each index i from 0 to n-1: (1) Remove indices from the front of the deque while they are outside the window, i.e., less than i-k+1. (2) Remove indices from the back of the deque while the value at those indices is less than or equal to values[i] — those candidates are now obsolete. (3) Push i onto the back. (4) If i >= k-1 (the first full window is ready), the front of the deque is the index of the current window maximum; record values[deque.front].',
        'Each element enters the deque exactly once (pushed in step 3) and leaves at most once (popped in step 1 or step 2). Across all n iterations, the total number of push and pop operations is at most 2n. The per-element cost is amortized O(1), and the entire pass is O(n).',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Circular_buffer.svg/250px-Circular_buffer.svg.png', alt: 'Circular buffer ring divided into slots', caption: 'A fixed-size rolling window is often implemented as a ring: logical time moves forward while storage wraps. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Circular_buffer.svg.'},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The deque maintains two invariants simultaneously. First, every index in the deque is within the current window — step 1 enforces this by expiring indices that have slid out. Second, the values at those indices are in strictly decreasing order — step 2 enforces this by popping anything the new element dominates.',
        'Together these invariants guarantee that the front of the deque is always the index of the largest value in the current window. The correctness argument is an exchange argument: any candidate that was popped in step 2 is smaller than the element that replaced it, and that replacement lives at least as long in the window (its index is newer). So the popped element could never beat the replacement in any future window. Nothing useful is lost.',
        'The amortized O(1) claim follows from a simple accounting argument. Each of the n elements is pushed onto the deque exactly once. Each element is popped at most once — either from the front (expiry) or from the back (dominated). The total number of operations across the entire loop is at most 2n, regardless of k.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Time: O(n). Each element enters and leaves the deque at most once, giving at most 2n deque operations total. Doubling n doubles the work. Compare this to the O(nk) brute force: at n = 100,000 and k = 1,000, the deque approach does roughly 200,000 operations versus 100,000,000.',
        'Space: O(k). The deque never holds more than k indices because all indices in the deque lie within the current window of size k. In practice the deque is often much smaller — a long increasing run purges all previous candidates, leaving a single entry.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Sliding window maximum (LeetCode 239) is the canonical problem, but the pattern appears whenever a rolling extreme must be tracked efficiently. Network monitoring systems compute peak throughput over the last N sampling intervals. Stock trading platforms track rolling highs and lows for candlestick charts and stop-loss triggers.',
        {type: 'image', src: 'https://sookocheff.com/post/networking/how-does-tcp-work/assets/congestion-control.png', alt: 'TCP congestion window sawtooth with additive increase and multiplicative decrease', caption: 'TCP makes the window idea operational: the active range of unacknowledged bytes expands and contracts under feedback. Source: https://sookocheff.com/post/networking/how-does-tcp-work/.'},
        'The same deque trick powers sliding window minimum (just flip the comparison), which appears in distance transform algorithms in image processing and in computing the minimum cost over rolling time horizons in dynamic programming optimizations.',
        'Broader sliding window patterns — not just max — appear in TCP congestion control (a window of unacknowledged bytes that expands and contracts), moving averages in signal processing, rate limiters that count events in a time window, and streaming aggregation in data pipelines.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The monotonic deque solves max and min but not every aggregate. Sliding window median requires two heaps or a balanced order-statistics tree — the deque\'s value-ordering trick does not generalize to the middle element. Sliding window mode needs a frequency map with a max-frequency tracker.',
        'Variable-size windows — where k is not fixed but determined by a constraint — need the expand-contract pattern shown in the animation rather than a fixed-size deque pass. The deque still helps inside a variable window (track the current max while boundaries shift), but the window resizing logic is separate.',
        'Non-contiguous selections (subsequences rather than subarrays) break the window model entirely. If the elements you choose do not need to be adjacent, sliding window is the wrong tool — dynamic programming or greedy algorithms are usually needed instead.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Array [1, 3, -1, -3, 5, 3, 6, 7], k = 3. Walk through each position tracking the deque contents (shown as values, stored as indices):',
        'i=0, value 1: deque empty, push 0. Deque: [1]. Window not full yet.',
        'i=1, value 3: 3 > 1, pop index 0 from back. Push 1. Deque: [3]. Window not full yet.',
        'i=2, value -1: -1 < 3, keep. Push 2. Deque: [3, -1]. First full window [1,3,-1]. Front = index 1, value 3. Output: 3.',
        'i=3, value -3: Front index 1 is still in window [1..3]. -3 < -1, keep. Push 3. Deque: [3, -1, -3]. Window [3,-1,-3]. Front = index 1, value 3. Output: 3.',
        'i=4, value 5: Front index 1 is outside window [2..4], pop it. Back has -3 < 5, pop. Back has -1 < 5, pop. Push 4. Deque: [5]. Window [-1,-3,5]. Front = index 4, value 5. Output: 5.',
        'i=5, value 3: 3 < 5, keep. Push 5. Deque: [5, 3]. Window [-3,5,3]. Front = index 4, value 5. Output: 5.',
        'i=6, value 6: Back has 3 < 6, pop. Back has 5 < 6, pop. Push 6. Deque: [6]. Window [5,3,6]. Front = index 6, value 6. Output: 6.',
        'i=7, value 7: Back has 6 < 7, pop. Push 7. Deque: [7]. Window [3,6,7]. Front = index 7, value 7. Output: 7.',
        'Final output: [3, 3, 5, 5, 6, 7]. Total deque operations: 8 pushes + 7 pops = 15, which is less than 2n = 16. Brute force would scan 6 windows x 3 elements = 18 comparisons.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The deque-based O(n) sliding window maximum is widely attributed to the competitive programming community; a clear description appears in Adamchik and Flood. LeetCode problem 239 (Sliding Window Maximum) is the standard reference problem.',
        {
          type: 'bullets',
          items: [
            'Deque: the underlying data structure — a double-ended queue supporting O(1) push and pop at both ends.',
            'Monotonic Stack: the same "pop dominated elements" idea applied to problems like next-greater-element and largest rectangle in histogram.',
            'Two Pointers: the parent technique — sliding window is a special case where both pointers move in the same direction.',
            'Queue: the simpler FIFO structure that the deque generalizes.',
            'Ring Buffer: a fixed-size circular array often used to implement sliding windows in systems code.',
            'Dynamic Programming: for problems where the optimal answer is non-contiguous or the window invariant is not monotonic — Kadane\'s algorithm (maximum subarray sum with negatives) is the nearest relative.',
          ],
        },
      ],
    },
  ],
};
