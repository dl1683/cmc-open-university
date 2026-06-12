// Binary search: halve the search range on every comparison.
// Requires sorted input — that requirement is the whole trick.

import { arrayState, parseNumberList, parseNumber } from '../core/state.js';

export const topic = {
  id: 'binary-search',
  title: 'Binary Search',
  category: 'Searching',
  summary: 'Find anything in a sorted array in O(log n) by repeatedly checking the middle.',
  controls: [
    { id: 'values', label: 'Values', type: 'number-list', defaultValue: '4, 23, 8, 15, 42, 16, 2, 11' },
    { id: 'target', label: 'Search for', type: 'number', defaultValue: '16' },
  ],
  run,
};

const idsBetween = (lo, hi) =>
  Array.from({ length: hi - lo + 1 }, (_, k) => `i${lo + k}`);

export function* run(input) {
  const raw = parseNumberList(input.values);
  const target = parseNumber(input.target, { label: 'a target' });
  const values = [...raw].sort((a, b) => a - b);
  const wasSorted = values.every((value, i) => value === raw[i]);

  yield {
    state: arrayState(values),
    highlight: {},
    explanation: `${wasSorted ? 'The array is already sorted — good, because that is a hard requirement.' : 'Binary search only works on sorted data, so we sorted your input first.'} We are looking for ${target}.`,
  };

  let lo = 0;
  let hi = values.length - 1;
  let comparisons = 0;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    comparisons += 1;
    const isMatch = values[mid] === target;
    yield {
      state: arrayState(values),
      highlight: { range: idsBetween(lo, hi), active: [`i${mid}`] },
      explanation: `If ${target} is here at all, it must be between positions ${lo} and ${hi}. Check the middle, position ${mid}: is ${values[mid]} equal to ${target}?${isMatch ? ' Yes!' : ''}`,
      invariant: 'If the target exists, it lies inside the highlighted range.',
    };

    if (isMatch) {
      yield {
        state: arrayState(values),
        highlight: { found: [`i${mid}`] },
        explanation: `Found ${target} at position ${mid} in just ${comparisons} comparison${comparisons === 1 ? '' : 's'} — out of ${values.length} elements. Each comparison halved the range: that is O(log n).`,
      };
      return;
    }

    if (values[mid] < target) {
      lo = mid + 1;
      yield {
        state: arrayState(values),
        highlight: lo <= hi
          ? { range: idsBetween(lo, hi), visited: idsBetween(0, mid) }
          : { visited: idsBetween(0, mid) },
        explanation: `${values[mid]} is smaller than ${target}. Since the array is sorted, everything at or left of position ${mid} is too small — throw away that entire half.`,
      };
    } else {
      hi = mid - 1;
      yield {
        state: arrayState(values),
        highlight: lo <= hi
          ? { range: idsBetween(lo, hi), visited: idsBetween(mid, values.length - 1) }
          : { visited: idsBetween(mid, values.length - 1) },
        explanation: `${values[mid]} is larger than ${target}. Everything at or right of position ${mid} is too large — throw away that entire half.`,
      };
    }
  }

  yield {
    state: arrayState(values),
    highlight: {},
    explanation: `The range is empty — ${target} is not in the array. We knew that after only ${comparisons} comparisons. Linear search would have needed up to ${values.length}.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        `Binary search finds a target in a sorted array by repeatedly checking the middle element and halving the search space. If the middle is too small, discard the left half and search right; if too large, discard the right half and search left. If it matches, you found the target. Each comparison eliminates half of the remaining candidates, so finding any element (or confirming its absence) takes O(log n) comparisons. It is the most important search algorithm and the workhorse of lookups everywhere.`,
        `The requirement for sorted input is non-negotiable and is precisely the trade-off: you pay a one-time O(n log n) sort, then gain O(log n) searches forever. For repeated searches, this payoff is massive. For a single search on unsorted data, linear search is better.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Maintain two pointers: lo (the start of the search range) and hi (the end). Compute mid = ⌊(lo + hi) / 2⌋ and compare the element at mid to the target. Three cases follow: (1) exact match — return mid. (2) target is larger than the middle element — the target cannot be in the left half (since the array is sorted), so move lo to mid+1 and repeat on the right half. (3) target is smaller — move hi to mid−1 and repeat on the left half. Continue until lo > hi (the range is empty), meaning the target is not present.`,
        `The key insight is the sorted-ness guarantee: if the target is larger than the middle, it cannot exist anywhere to the left. This logical deduction lets you discard entire regions without checking them. The algorithm maintains the invariant: if the target exists, it lies within [lo, hi].`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Binary search performs O(log n) comparisons in all cases: best, average, and worst. The array length halves with each comparison, so a million-element array needs at most log₂(1,000,000) ≈ 20 comparisons. Space complexity is O(1) — just the two pointers. The preprocessing cost is O(n log n) if the array is not already sorted. For a single search on unsorted data, linear search (O(n)) is faster; but for many searches, the one-time sort pays back immediately.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Binary search is ubiquitous. Dictionaries, phone books, and any lookup in sorted data use it (whether explicitly or via hash tables for O(1) average time). It underlies database indexes, B-trees, and most file systems. When you search in a sorted list, you are running binary search. Programming languages offer it directly: C++ std::binary_search, Python bisect module, Java Collections.binarySearch. Beyond searching, binary search powers classic algorithms like finding the kth-smallest element, computing the square root, and solving the "leftmost position" variants (find the first element ≥ target, etc.).`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `The most common mistake is forgetting that binary search requires sorted input. Applying it to unsorted data produces wrong results, often silently. A closely related pitfall is the off-by-one error: using lo <= hi vs lo < hi, or mid vs mid±1. These errors cause infinite loops or wrong boundaries. Classic mistakes include mid = (lo + hi) / 2, which overflows on large integers in C/C++ (use mid = lo + (hi - lo) / 2 instead), and forgetting to update lo or hi correctly in the branching logic.`,
        `Another misconception is thinking binary search is always faster than hash tables. Hash tables are O(1) average, which beats O(log n) on very large datasets. Binary search is simpler, requires sorted data (no hash function needed), and has better worst-case guarantees. The trade-off depends on your data size, update frequency, and memory constraints.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Review Linear Search to understand the alternative baseline. Study Big-O Growth Rates to feel the exponential speed gain of O(log n) vs O(n) as arrays grow. Explore hash tables and hash functions for O(1) average searching. Learn about Two Pointers, a technique that binary search exemplifies. Finally, study advanced variants: searching for the leftmost/rightmost occurrence, binary search on an answer (solving problems by searching over the space of possible solutions), and how binary search powers algorithms like finding the median in a stream or the square root of a number.`,
      ],
    },
  ],
};

