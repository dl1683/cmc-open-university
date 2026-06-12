// The two-pointers technique: replace a nested O(n²) scan with two indexes
// walking toward each other — the interview classic that's actually deep.

import { arrayState, parseNumberList, parseNumber } from '../core/state.js';

export const topic = {
  id: 'two-pointers',
  title: 'Two Pointers',
  category: 'Concepts',
  summary: 'Find a pair summing to a target in one pass — squeeze from both ends of a sorted array.',
  controls: [
    { id: 'values', label: 'Values', type: 'number-list', defaultValue: '11, 3, 7, 1, 9, 5, 14' },
    { id: 'target', label: 'Pair sum target', type: 'number', defaultValue: '16' },
  ],
  run,
};

export function* run(input) {
  const values = [...parseNumberList(input.values, { max: 10 })].sort((a, b) => a - b);
  const target = parseNumber(input.target, { label: 'a target sum' });

  yield {
    state: arrayState(values),
    highlight: {},
    explanation: `Find two numbers that sum to ${target}. The obvious way checks every pair — nested loops, O(n²). But sort the array first (done above) and a beautiful trick appears: one pointer at each END, squeezing inward. Every comparison eliminates a whole pointer position, so it finishes in ONE pass.`,
  };

  let lo = 0;
  let hi = values.length - 1;
  while (lo < hi) {
    const sum = values[lo] + values[hi];
    const verdict = sum === target ? 'equal' : sum < target ? 'small' : 'big';
    yield {
      state: arrayState(values),
      highlight: { compare: [`i${lo}`, `i${hi}`] },
      explanation: `${values[lo]} + ${values[hi]} = ${sum}: ${verdict === 'equal' ? `exactly ${target}!` : verdict === 'small'
        ? `too small. The KEY insight: ${values[lo]} paired with its LARGEST possible partner still falls short — so ${values[lo]} can't be in any answer. Move the left pointer right.`
        : `too big. ${values[hi]} paired with its SMALLEST possible partner still overshoots — so ${values[hi]} is out. Move the right pointer left.`}`,
      invariant: 'Any valid pair must lie between the two pointers (inclusive).',
    };
    if (verdict === 'equal') {
      yield {
        state: arrayState(values),
        highlight: { found: [`i${lo}`, `i${hi}`] },
        explanation: `Found it: ${values[lo]} + ${values[hi]} = ${target}, in far fewer steps than checking all ${(values.length * (values.length - 1)) / 2} pairs. The pattern — maintain an invariant, shrink the window by one provably-safe step — also powers sliding windows, fast/slow cycle detection, and the merge step of Merge Sort.`,
      };
      return;
    }
    if (verdict === 'small') lo += 1; else hi -= 1;
  }

  yield {
    state: arrayState(values),
    highlight: { visited: values.map((_, i) => `i${i}`) },
    explanation: `Pointers met — no pair sums to ${target}, PROVEN in a single pass: every position was eliminated by a logical argument, not by exhaustive pairing. O(n) after sorting vs O(n²) brute force; that gap is the whole technique.`,
  };
}
