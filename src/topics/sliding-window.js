// The sliding window: a stretchy range that grows on the right and shrinks
// on the left, maintaining an invariant the whole way. Every element enters
// once and leaves once â€” O(n) for problems that look O(nÂ²).

import { arrayState, parseNumberList, parseNumber, InputError } from '../core/state.js';

export const topic = {
  id: 'sliding-window',
  title: 'Sliding Window',
  category: 'Concepts',
  summary: 'Find the longest run under a budget in one pass â€” grow the window right, shrink it left.',
  controls: [
    { id: 'values', label: 'Values', type: 'number-list', defaultValue: '4, 2, 1, 7, 8, 1, 2, 8, 1, 0' },
    { id: 'limit', label: 'Sum budget â‰¤', type: 'number', defaultValue: '8' },
  ],
  run,
};

const idsBetween = (lo, hi) =>
  Array.from({ length: Math.max(0, hi - lo + 1) }, (_, k) => `i${lo + k}`);

export function* run(input) {
  const values = parseNumberList(input.values, { max: 12 });
  if (values.some((v) => v < 0)) throw new InputError('Use non-negative values â€” the shrink logic relies on sums only growing as the window widens.');
  const limit = parseNumber(input.limit, { label: 'a sum budget' });

  yield {
    state: arrayState(values),
    highlight: {},
    explanation: `Find the LONGEST stretch of consecutive values whose sum stays â‰¤ ${limit}. Checking every possible stretch is O(nÂ²) â€” there are ${(values.length * (values.length + 1)) / 2} of them. The sliding window does it in ONE pass: a stretchy range [leftâ€¦right] that grows rightward, and shrinks from the left only when it must.`,
  };

  let left = 0;
  let sum = 0;
  let best = { lo: 0, hi: -1 };

  for (let right = 0; right < values.length; right += 1) {
    sum += values[right];
    yield {
      state: arrayState(values),
      highlight: { range: idsBetween(left, right), active: [`i${right}`] },
      explanation: `Grow: bring in ${values[right]} â†’ window [${left}â€¦${right}], sum ${sum}. ${sum <= limit ? `Within budget.` : `OVER budget (${sum} > ${limit}) â€” the window must shrink from the LEFT until legal again.`}`,
      invariant: 'Everything left of the window is known: no legal window can start there and reach further than we already have.',
    };

    while (sum > limit) {
      sum -= values[left];
      left += 1;
      yield {
        state: arrayState(values),
        highlight: { range: idsBetween(left, right), removed: [`i${left - 1}`] },
        explanation: `Shrink: drop ${values[left - 1]} from the left â†’ window [${left}â€¦${right}], sum ${sum}.${sum <= limit ? ' Legal again â€” and notice we never re-examined anything: the left edge only ever moves forward.' : ''}`,
      };
    }

    if (right - left > best.hi - best.lo) {
      best = { lo: left, hi: right };
      yield {
        state: arrayState(values),
        highlight: { found: idsBetween(left, right) },
        explanation: `New record: window [${left}â€¦${right}] has length ${right - left + 1} (sum ${sum} â‰¤ ${limit}).`,
      };
    }
  }

  yield {
    state: arrayState(values),
    highlight: { found: idsBetween(best.lo, best.hi) },
    explanation: `Answer: [${values.slice(best.lo, best.hi + 1).join(', ')}] â€” length ${best.hi - best.lo + 1}. The accounting that makes this O(n): each element enters the window exactly once (right edge) and leaves at most once (left edge) â€” ${values.length} entries + at most ${values.length} exits, regardless of how the windows overlap. This pattern solves longest-substring-without-repeats, per-minute rate counting (see Rate Limiter (Token Bucket)), and is literally how TCP paces the internet â€” the congestion window is a sliding window over unacknowledged bytes. It is Two Pointers with a budget attached.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The highlighted cells are the current window: a contiguous slice between a left pointer and a right pointer. The active cell just entered the window, and a removed cell just left it.',
        {type: 'callout', text: 'The sliding-window proof is pointer accounting: each element enters once and leaves at most once.'},
        'The safe rule is forward motion. The right pointer expands, the left pointer repairs violations, and neither pointer moves backward.',
        {type: 'image', src: './assets/gifs/sliding-window.gif', alt: 'Animated walkthrough of the sliding window visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many problems ask for a fact about a contiguous range: a recent event count, a longest substring, or a rolling maximum. Adjacent ranges overlap, so recomputing each range from scratch wastes work.',
        'A sliding window keeps the overlap alive. It stores just enough state for the active range, then updates that state when one item enters or leaves.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to try every start and end index. An array of n items has n(n + 1) / 2 contiguous subarrays.',
        'That method is complete, but it repeats the same interior elements. At n = 1,000 it already considers 500,500 ranges before counting any work inside a range.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is repeated boundary movement. A brute-force loop resets the right boundary for every left boundary and pays again for elements it just inspected.',
        'For monotone constraints, old starts cannot become useful again after they are too far left. If adding items makes a nonnegative sum too large, only removing items from the left can repair it.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Keep one range and move its boundaries only forward. The invariant is the condition the current range must satisfy, such as sum <= S or no repeated character.',
        'When the invariant breaks, shrink from the left until it holds again. Once repaired, the current range is the best legal range ending at the current right boundary for many window problems.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Initialize left = 0 and an empty summary such as a sum, frequency map, or deque. For each right index, add the new item, repair the invariant by advancing left, then update the answer.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Circular_buffer.svg/250px-Circular_buffer.svg.png', alt: 'Circular buffer ring divided into slots', caption: 'A fixed-size rolling window is often implemented as a ring: logical time moves forward while storage wraps. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Circular_buffer.svg.'},
        'Fixed-size windows are the simpler case. Add the new item, remove the item more than k positions behind, and read the maintained summary.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from monotonicity. After left moves past an index, every future window starts at that index or later, so the discarded start will never be the start of a better legal window.',
        'The algorithm does not skip candidates blindly. It discards a start only after the current right boundary proves that start cannot satisfy the invariant without removing something from the left.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The time cost is O(n) when each summary update is O(1). The right pointer enters each item once, and the left pointer removes each item at most once, so doubling n roughly doubles the work.',
        'Space depends on the summary. A sum uses O(1), a character map uses O(alphabet) or O(k), and a monotonic deque for window maximum uses O(k).',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Sliding windows fit rate limiters, stream metrics, rolling averages, substring scanners, fraud signals over recent events, and packet windows. They work when old data expires by position or time.',
        {type: 'image', src: 'https://sookocheff.com/post/networking/how-does-tcp-work/assets/congestion-control.png', alt: 'TCP congestion window sawtooth with additive increase and multiplicative decrease', caption: 'TCP makes the window idea operational: the active range of unacknowledged bytes expands and contracts under feedback. Source: https://sookocheff.com/post/networking/how-does-tcp-work/.'},
        'Systems often store the active range in a ring buffer. Logical time moves forward while the physical array wraps around.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the repair rule is not monotone. With negative numbers, adding a later value can make an oversized sum legal again, so greedy left movement can discard a valid answer.',
        'It also fails for non-contiguous choices. If the answer may skip elements, the problem usually needs dynamic programming, greedy selection, or graph search instead of a window.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Find the longest subarray with sum at most 7 in [2, 1, 3, 2, 4, 1]. Add 2, 1, and 3 to get sum 6 and best length 3.',
        'Add 2, making sum 8. Remove the leftmost 2, so sum returns to 6 and the window [1, 3, 2] is legal. Add 4, making sum 10; remove 1 and then 3, so the legal window becomes [2, 4] with sum 6.',
        'Add 1 to get [2, 4, 1] with sum 7. The best length is 3. Each item entered once, and the removed items 2, 1, and 3 each left once.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Two Pointers, Deque, Monotonic Queue, Prefix Sum, Kadane-style dynamic programming, and Ring Buffer. Practice cases include longest substring without repeats, minimum-size subarray sum, and sliding-window maximum.',
        'Before using the pattern, state the invariant and prove that moving left cannot destroy a future optimum. If that proof fails, this is probably not a sliding-window problem.',
      ],
    },
  ],
};
