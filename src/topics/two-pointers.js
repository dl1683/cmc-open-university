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

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        `Two Pointers is a technique for using two indices to shrink a search space without checking every pair. The demo solves pair sum: it sorts the input numbers, puts one pointer at the smallest value and one at the largest, then moves inward until it finds the target or proves no pair exists. The brute-force version checks n(n-1)/2 pairs. After sorting, the pointer scan is one pass.`,
        `The technique depends on an invariant. In this demo, any valid answer must lie between lo and hi. If values[lo] + values[hi] is too small, even the largest possible partner cannot save values[lo], so lo can move right. If the sum is too large, values[hi] is too large even with the smallest partner, so hi can move left. That is a proof, not a heuristic.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `For pair sum, sort first unless the data already arrives sorted. Start lo = 0 and hi = n - 1. Compare the sum. Equal means found. Too small means advance lo. Too large means decrement hi. Stop when the pointers meet. The visualization sorts 11, 3, 7, 1, 9, 5, 14 into increasing order before scanning for target 16, then highlights the two active cells at every comparison.`,
        `The same pattern appears in merge routines, partitioning, and symmetric checks. Merge Sort uses two forward pointers to combine sorted halves. Quick Sort partitioning walks indices around a pivot. Linked List cycle detection uses fast and slow pointers rather than inward pointers, but the discipline is the same: maintain a compact state that eliminates repeated scanning.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `The scan is O(n) time and O(1) extra space. If sorting is required, total time becomes O(n log n). If you must preserve original indices, store value-index pairs before sorting. A Hash Table solves unsorted two-sum in O(n) expected time with O(n) space, so it is better when order is irrelevant and memory is available. Two Pointers wins when the data is sorted, space is tight, or you need ordered reasoning rather than membership lookup.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Sort-merge joins in databases scan two sorted streams to find matching keys. Deduplication of a sorted list keeps one read pointer and one write pointer. Palindrome checks compare characters from both ends. Geometry algorithms use rotating or sweeping pointers over sorted points. Sliding Window is a close cousin for contiguous ranges: instead of two ends squeezing inward, the right end grows and the left end shrinks to maintain a budget or uniqueness rule.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `The main pitfall is using the technique without sorted or monotonic structure. On an unsorted array, "too small" tells you nothing about which pointer to move. Another mistake is moving both pointers after a failed comparison; only one side has been logically eliminated. Watch duplicates too: if the task asks for all pairs, you must count or skip equal runs carefully. Finally, remember that the visualization sorts the input, so the displayed positions are not the original indices.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Binary Search for another sorted-data elimination pattern, then Hash Table for the unsorted pair-sum alternative. Merge Sort and Quick Sort show two-pointer scans inside sorting. Sliding Window generalizes the idea to contiguous ranges. Linked List gives the fast-slow variant, and Big-O Growth Rates explains why replacing nested loops with one scan matters so much.`,
      ],
    },
  ],
};
