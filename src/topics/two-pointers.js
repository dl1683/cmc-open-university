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
        `The two-pointers technique is a way to search or compare a sorted (or partially sorted) array by placing one index at the start and another at the end, then moving them toward each other. At each step, you compare the values at both pointers, decide which one to eliminate based on the comparison, and advance one pointer inward. The result: you reduce an O(n²) problem to O(n).`,
        `It is most famous for the "two sum" problem — find two numbers in a sorted array that sum to a target. But it also powers palindrome checking (skip matching letters from both ends), three-way partitioning (Dutch national flag), fast/slow pointer cycle detection in linked lists, and the merge step of merge sort. Any time you have a sorted array and want to find or compare pairs or subsequences, think two-pointers.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Start with one pointer (lo) at the beginning and another (hi) at the end. Compare the values at both pointers. If their sum equals the target, you found a pair — return it. If the sum is too small, the left pointer is too small; move it right to increase the sum. If the sum is too big, the right pointer is too big; move it left to decrease the sum. Continue until the pointers meet or you find the target.`,
        `The magic is in the logic: if values[lo] + values[hi] is too small, you know that values[lo] paired with any number ≤ values[hi] will also be too small — because the array is sorted. Therefore, values[lo] cannot be part of any solution, so you skip it entirely and move left forward. This single reasoning step eliminates a pointer position without checking every pair, which is why two-pointers is O(n) instead of O(n²).`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Two-pointers is O(n) time for the search itself, plus O(n log n) if you need to sort first. The space is O(1) — just two pointers, no extra data structures. Compare that to a hash table approach for two-sum: O(n) time and O(n) space (to store the hash table). Both are fast, but two-pointers uses less memory and requires no hash function, making it ideal when space is tight or when you are already working with a sorted array.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Two-pointers is ubiquitous in competitive programming, technical interviews, and performance-critical code. Databases use it in sort-merge joins (comparing two sorted result sets to find matches). Machine learning uses it in fast/slow pointer cycle detection to find repeating patterns in time series. Binary-indexed trees and fenwick trees (used in competitive programming for range queries) rely on two-pointer sweeping. Palindrome validation (reversing one pointer while advancing another from the center) is a classic use case. The technique also appears in array rearrangement problems — partitioning arrays by a pivot (like quicksort's partition step), moving all zeros to the front, removing duplicates from a sorted list.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `The biggest pitfall is forgetting that two-pointers requires a sorted (or partially sorted) array. If the array is unsorted, the logic breaks: you cannot make safe elimination decisions without knowing the global order of values. Another pitfall is moving the wrong pointer: if sum is too small, advance lo, not hi. Mixed up and you will loop forever or give wrong answers.`,
        `A misconception: two-pointers is only for two-sum. False — three-pointers (find three numbers summing to a target) works by fixing one pointer and running two-pointers on the remaining array. Sliding window (another classic technique) is a generalization of two-pointers where you maintain a window [lo, hi) and slide it along the array, shrinking and expanding based on a condition. Understanding the underlying principle — maintain an invariant, shrink the search space by one provable step — unlocks solutions to many problem shapes.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Learn Binary Search to see another O(log n) technique for sorted arrays. Study Sorting (especially Merge Sort and Quick Sort) because two-pointers is most powerful after sorting. Hash Table is the alternative O(n) solution to two-sum, so understand both trade-offs. Sliding Window extends two-pointers to find contiguous subarrays with a given property. Finally, Linked List will teach you fast/slow pointers for cycle detection, another classic two-pointer variant.`,
      ],
    },
  ],
};

