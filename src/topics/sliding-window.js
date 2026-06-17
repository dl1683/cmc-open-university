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
      heading: 'Why this exists',
      paragraphs: [
        'Many array and string questions ask about a contiguous stretch: the longest interval under a budget, the smallest interval covering a set of characters, the number of events in the last minute, or the current chunk of unacknowledged bytes. The hard part is not visiting the input. The hard part is that there are many possible intervals hiding in one input.',
        'An array with n items has n choices for a start and, for each start, many choices for an end. That gives n * (n + 1) / 2 contiguous ranges. At 10 items, that is 55 ranges. At 100,000 items, it is about five billion. The sliding-window pattern exists for the cases where those ranges overlap so much that testing them separately wastes the structure of the problem.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The direct solution is honest: try every start index, extend the end index, compute the range value, and keep the best legal answer. If the code recomputes each sum from scratch, it can drift toward O(n^3). Prefix sums fix the repeated summing and make each range score O(1), but they still leave O(n^2) candidate ranges to inspect.',
        'That baseline is not foolish. It handles negative numbers, arbitrary scoring rules, and many small inputs. It also gives a useful correctness reference when building tests. Its wall is that it treats two nearly identical windows as unrelated facts. The range [2..8] and the range [3..8] differ by one removed value, yet the brute-force search has no live state that remembers this relationship.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears when the answer condition is local to a moving interval but the search keeps restarting. For a non-negative sum budget, every larger right edge can only increase or preserve the sum while the left edge stays fixed. Once a start index is too expensive for the current right edge, extending farther right will not make that same start legal again.',
        'Brute force ignores that monotonic fact. It checks ranges that are already impossible, then checks their longer versions too. The missing piece is an invariant that says which starts have been permanently ruled out and which current interval still deserves attention.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'A sliding window keeps one live interval [left..right]. The right boundary only moves forward to include new input. The left boundary only moves forward to repair a broken invariant. For the sum-budget example, the invariant is simple: after repair, the current window sum is at most the limit.',
        'The reason this works is monotonicity. With non-negative values, adding a value on the right cannot reduce the sum, and removing a value on the left cannot increase it. If the window is over budget, the only repair that can help is advancing left. If the window is legal, advancing left would only make it shorter, so the algorithm should first consider it as a candidate answer.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The loop has three phases for each right index. First, add values[right] to the running state. Second, while the invariant is broken, subtract values[left] and advance left. Third, after the invariant is legal, compare the current window against the best answer seen so far.',
        'The order matters. Recording the best window before repair can accept an illegal range. Repairing before adding the right value misses the new candidate ending at right. Moving left backward would destroy the accounting argument. The pattern is small because the boundaries are disciplined: grow, repair, record.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'For a fixed right boundary, the repair loop stops at the earliest start that makes the window legal. Every discarded start was removed only while the range ending at this same right boundary was over budget. Because the values are non-negative, any earlier start would include at least those removed values and would also be over budget.',
        'That means the repaired window is the longest legal window ending at the current right boundary. The algorithm checks that best ending-at-right candidate for every right boundary. The global longest legal window must end somewhere, so it is considered when that right boundary is processed.',
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        'The highlighted range is not just a moving selection. It is the current proof obligation. When the right edge enters a value, the sum may become illegal. When the left edge removes values, the visual is showing exactly which starts have become impossible for the current right edge.',
        'The record highlight should appear only after the budget is legal again. That is the bug check built into the visual. A correct sliding-window implementation never celebrates a range whose invariant is broken, and it never sends the left boundary backward to retry discarded starts.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The time cost is O(n) when adding a right value, removing a left value, and testing the invariant are O(1) or amortized O(1). The nested while loop does not make the algorithm quadratic because left advances at most n times total. Each element enters once through right and leaves at most once through left. When the input doubles, the boundary movements roughly double; they do not multiply into all pairs of starts and ends.',
        'Space depends on the window state. A sum budget needs O(1) extra space. A substring-without-repeats window may need a hash map from character to last position. A recent-event window may need a queue of timestamps. The algorithmic shape stays the same, but the state structure must support fast add, fast remove, and fast legality checks.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Sliding windows win when the answer is contiguous and the legality rule can be repaired by moving one boundary forward. Longest subarray with sum at most K over non-negative values is the clean example. Longest substring without repeating characters uses the same boundary discipline with a map instead of a sum.',
        'Systems use the same idea because time and byte ranges naturally expire from the left. A rate limiter keeps recent request timestamps, drops entries older than the window, and counts the survivors. TCP tracks a window of unacknowledged bytes. Compression schemes such as LZ77 search within a bounded history window rather than the whole past.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The pattern fails when the invariant is not monotonic. Negative numbers break the simple sum-budget rule because adding a later negative value can make an over-budget start legal again. In that case, discarding the start early loses a possible answer. Prefix sums with a balanced tree, a monotonic deque, or binary search on the answer may fit better.',
        'It also fails for non-contiguous choices, global constraints, and order-sensitive scoring rules that cannot be updated when one value leaves. Median inside a moving interval needs heaps or another order-statistics structure. A best subsequence problem is usually dynamic programming, not a window.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Two Pointers for the boundary-movement family that sliding window belongs to. Study Queue and Deque for timestamp windows and monotonic-window variants. Study Hash Table for distinct-character and frequency-window state. Study Prefix Sums for cases where ranges are still useful but monotonic repair is not available.',
        'Then connect the idea to systems topics. Rate Limiter (Token Bucket) shows budgeted request flow. TCP Congestion shows a network window over bytes in flight. Backpressure shows the larger control pattern: keep a bounded live region, advance it when downstream capacity appears, and avoid rescanning work that the invariant has already ruled out.',
      ],
    },
  ],
};
