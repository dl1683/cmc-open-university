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
      heading: `What it is`,
      paragraphs: [
        `Binary-style searching finds a target in a sorted sequence by repeatedly checking the middle and throwing away the half that cannot contain the answer. If the middle value is too small, everything to its left is too small too. If the middle value is too large, everything to its right is too large too. One comparison can delete thousands, millions, or billions of candidates from consideration.`,
        `The sorted-order requirement is non-negotiable. On unsorted data, Linear Search is the honest baseline because every position could still be the target. If you will search once, sorting first is usually wasted work. If you will search the same data many times, paying for Merge Sort or another O(n log n) sort can be worth it because each later lookup becomes logarithmic.`,
        `The wall for linear search is that it ignores order. With one million sorted records, checking from the front can still take one million comparisons. Binary search exists because sorted order lets one comparison become a proof about every value on one side of the midpoint.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Keep two boundaries, lo and hi, around the range where the answer might still live. Compute mid as lo + Math.floor((hi - lo) / 2). That formula avoids integer overflow in languages with fixed-size integers, while giving the same midpoint as floor((lo + hi) / 2). Compare array[mid] with the target. Equal means done. Too small moves lo to mid + 1. Too large moves hi to mid - 1. When lo passes hi, the range is empty and the target is absent.`,
        `The invariant is the whole proof: if the target exists, it is always inside the current boundaries. Interview variants change what "answer" means. Lower bound finds the first value greater than or equal to a target. Upper bound finds the first value greater than a target. "Search on answer" applies the same structure to any monotonic yes/no test, such as the smallest capacity that can ship packages within D days.`,
        `Each update must remove mid itself from the next range unless mid is the answer. Keeping mid after proving it too small or too large is the classic infinite-loop bug. The algorithm is small because the invariant is doing most of the work.`,
      ],
    },
    {
      heading: `Core insight`,
      paragraphs: [
        `Watch the low and high bounds, not only the midpoint. Each comparison proves that one side of the array cannot contain the answer, so the live search interval shrinks. The midpoint is just the question that buys that proof cheaply.`,
        `The obvious wrong version is "look at the middle until it works." The correct invariant is sharper: if the target exists, it remains inside the closed interval between low and high. Every bound update must preserve that statement, including absent-target cases.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Best case is O(1) when the first middle element is the target. Average and worst case are O(log n). A million sorted items need at most about 20 comparisons; a billion need about 30. Space is O(1) for the iterative version. A recursive version uses O(log n) stack frames, which is small but not free. Big-O Growth Rates makes the gap vivid: logarithmic growth barely moves while linear growth keeps climbing with every extra item.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Language libraries expose this directly: Python has bisect, C++ has lower_bound and upper_bound, and Java has Arrays.binarySearch. Database indexes use related search ideas constantly. B-Trees (How Databases Read) keep keys sorted inside disk pages so a page can be searched quickly before following the right child pointer. LSM Trees (How Cassandra Writes) store immutable sorted files, where exact lookup and range lookup both lean on sorted order.`,
        `The same comparison pattern appears inside Binary Search Tree, but with a different storage shape. A sorted array gives excellent cache locality and O(1) access to the middle; a tree supports cheaper dynamic insertion but can become unbalanced without rotations. Two Pointers is another sorted-array technique, useful when the problem needs coordinated movement from the ends instead of halving from the middle.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Most bugs are boundary bugs. Mixing lo < hi with lo <= hi without changing the update rules can skip answers or loop forever. Forgetting mid + 1 or mid - 1 after ruling out mid repeats the same midpoint. Duplicates also matter: returning any matching index is easier than returning the first or last matching index.`,
        `Another misconception is that logarithmic search always beats Hash Table. Hashing gives O(1) average exact lookup, but it does not preserve sorted order and has weaker worst-case guarantees. Sorted arrays are great for mostly-read data and range queries; hash tables are great for mutable exact-key maps. The right choice depends on update rate, ordering needs, and memory overhead, not just one Big-O label.`,
      ],
    },
    {
      heading: `Implementation checklist`,
      paragraphs: [
        `Decide which variant you are writing before coding: exact match, first value at least target, first value greater than target, last valid value under a monotonic predicate, or insertion point. Most bugs come from mixing the loop condition of one variant with the boundary update of another.`,
        `Prefer half-open intervals for lower-bound style code: lo starts at 0, hi starts at n, and the answer is lo. Prefer closed intervals for simple exact search if that is what your team finds clearer. Do not switch between them casually inside one implementation.`,
        `Test absent targets, targets before the first element, targets after the last element, one-element arrays, two-element arrays, and duplicates. These cases expose nearly every off-by-one error.`,
      ],
    },
    {
      heading: `Worked example`,
      paragraphs: [
        `Search for 16 in [2, 4, 8, 11, 15, 16, 23, 42]. The first midpoint is 11, which is too small, so every value at or left of 11 is discarded. The next live range is [15, 16, 23, 42]. Its midpoint is 16 or 23 depending on rounding convention; either way, the invariant tells you which half remains.`,
        `The important part is not the exact midpoint sequence. The important part is that every discarded half is justified by sorted order. Without that proof, halving would only be guessing.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `Binary search works because sorted order turns one comparison into a certificate about half the data. If array[mid] is smaller than the target, every index at or left of mid is also too small. No value-by-value inspection is needed.`,
        `The invariant is stronger than the code. At the top of every loop, the answer is either inside the current interval or does not exist. Every comparison preserves that invariant while shrinking the interval. Once the interval is empty, absence has been proven.`,
      ],
    },
    {
      heading: `Where it matters`,
      paragraphs: [
        `Binary search appears anywhere a monotonic structure exists: sorted arrays, time-series cutoffs, version lists, lower-bound joins, database page slots, answer-space optimization, and scheduling thresholds. Many uses do not look like searching for a number; they look like finding the first time a predicate becomes true.`,
        `That generalization is why this tiny algorithm deserves serious study. The same loop can find the first bad build, the smallest capacity that satisfies a constraint, or the insertion position for a new key. The data may change, but the monotonic proof shape stays the same.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Review Linear Search for the unsorted baseline, then study Big-O Growth Rates until O(log n) feels concrete. Binary Search Tree and B-Trees (How Databases Read) show how ordered lookup changes when the data structure is dynamic or disk-backed. Two Pointers and Merge Sort continue the theme: sorted order is a powerful source of shortcuts.`,
      ],
    },
  ],
};
