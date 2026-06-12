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
        `Sliding Window is a Two Pointers pattern for contiguous ranges. Instead of checking every subarray, keep a live window from left to right. Grow right to include new data; shrink left when the invariant breaks. The demo asks for the longest consecutive stretch whose sum stays under a budget. It accepts only non-negative values because the sum must grow predictably when the right edge expands.`,
        `The important promise is accounting: each item enters the window once and leaves at most once. That converts an O(n^2) enumeration of all ranges into O(n) movement. Big-O Growth Rates is visible in the first explanation: for ten values there are 55 possible stretches, but the sliding window only performs a small number of edge moves.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Initialize left = 0 and sum = 0. For each right index, add values[right]. If the sum is within the limit, the window is legal and may be a new best. If the sum exceeds the limit, repeatedly subtract values[left] and advance left until the window is legal again. The visualization highlights the active range, marks removed items during shrink steps, and records a new best whenever the current legal range is longer than the previous one.`,
        `This works because non-negative numbers make the invariant monotonic. Adding more items cannot reduce the sum, and removing items from the left cannot increase it. With negative numbers, a too-large window might become legal by expanding farther, so the simple shrink rule is no longer sound. Then you may need prefix sums, Binary Search over answers, a heap, or another dynamic structure.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Time is O(n) because right advances n times and left advances at most n times. Space is O(1) for a sum budget. If the invariant tracks distinct characters, the space becomes O(k) for a Hash Table or map of counts. If the window is time-based, a Queue of timestamps can drop expired events from the front. The technique is small, but the invariant check must be O(1) or amortized O(1) for the whole method to stay linear.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `String problems use sliding windows for longest substring without repeats, minimum covering substring, and rolling counts. Observability systems keep recent errors or latency samples in a time window. Rate Limiter (Token Bucket) is not the same algorithm, but it solves the same resource-control family; exact sliding-window limiters often use timestamp queues. TCP: Handshake & Congestion Control uses a real network window over unacknowledged bytes, and Backpressure & Flow Control is the broader systems principle behind slowing producers when buffers fill.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `Do not apply sliding window just because a problem mentions "subarray." The invariant must be monotonic enough that moving left repairs violations. Another bug is recording the answer before the window is legal; always shrink first, then update best. Off-by-one mistakes are common: window length is right - left + 1 for inclusive bounds. Finally, a window is the mechanism, not necessarily the answer. The answer may be a length, sum, count, or saved copy of bounds.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Start with Two Pointers, then compare Sliding Window against Binary Search for budget problems. Queue explains time-window implementations, Hash Table explains uniqueness and frequency maps, and Big-O Growth Rates explains the win over all-subarray scans. For systems context, read Rate Limiter (Token Bucket), TCP: Handshake & Congestion Control, and Backpressure & Flow Control.`,
      ],
    },
  ],
};
