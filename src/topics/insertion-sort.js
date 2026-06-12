// Insertion sort: grow a sorted prefix by inserting each new value into
// its place — exactly how people sort a hand of playing cards.

import { arrayState, parseNumberList } from '../core/state.js';

export const topic = {
  id: 'insertion-sort',
  title: 'Insertion Sort',
  category: 'Sorting',
  summary: 'Take each value and slide it left into its place in the sorted prefix.',
  controls: [
    { id: 'values', label: 'Values', type: 'number-list', defaultValue: '7, 2, 9, 4, 4, 1' },
  ],
  run,
};

const prefixIds = (count) => Array.from({ length: count }, (_, i) => `i${i}`);

export function* run(input) {
  const values = parseNumberList(input.values, { max: 10 });

  yield {
    state: arrayState(values),
    highlight: { sorted: prefixIds(1) },
    explanation: 'Insertion sort is how you sort cards in your hand: everything to the left of your attention is already sorted, and each new card slides left until it fits. A one-element prefix is trivially sorted, so we start at position 1.',
  };

  for (let i = 1; i < values.length; i += 1) {
    const value = values[i];
    yield {
      state: arrayState(values),
      highlight: { active: [`i${i}`], sorted: prefixIds(i) },
      explanation: `Pick up ${value} (position ${i}). The prefix to its left is sorted — now slide ${value} leftward until the value before it is no bigger.`,
      invariant: `Positions 0–${i - 1} are sorted (relative to each other).`,
    };

    let j = i;
    while (j > 0 && values[j - 1] > value) {
      yield {
        state: arrayState(values),
        highlight: { compare: [`i${j - 1}`, `i${j}`], sorted: prefixIds(i) },
        explanation: `${values[j - 1]} is bigger than ${value}, so ${value} must go further left — shift ${values[j - 1]} one slot right to make room.`,
      };
      [values[j - 1], values[j]] = [values[j], values[j - 1]];
      j -= 1;
    }

    yield {
      state: arrayState(values),
      highlight: { found: [`i${j}`], sorted: prefixIds(i + 1) },
      explanation: j === i
        ? `${value} was already in place — no shifting needed. On nearly-sorted data this happens constantly, which is why insertion sort runs in almost O(n) there.`
        : `${value} settles into position ${j}. The sorted prefix now covers positions 0–${i}.`,
    };
  }

  yield {
    state: arrayState(values),
    highlight: { sorted: prefixIds(values.length) },
    explanation: `Sorted! Worst case is O(n²) (reversed input shifts everything every time), but on nearly-sorted data it is nearly O(n) — which is why real libraries use insertion sort to finish small or almost-sorted ranges inside quick sort and merge sort.`,
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Insertion-style sorting grows a sorted prefix one item at a time, the way people sort a hand of cards. The first item is already a sorted prefix of length one. Take the next item, slide larger prefix items one slot to the right, and place the item into the hole that remains. After pass i, positions 0 through i are sorted relative to each other.`,
        `Its reputation as a beginner algorithm hides why production systems still use it. It is adaptive: on already sorted or nearly sorted data, the inner loop barely moves. It is stable when implemented by shifting rather than arbitrary swapping. It is also tiny: no heap, no merge buffer, no complicated partition machinery. That makes it a natural finishing pass inside hybrids built around Quick Sort or Merge Sort.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `For each index i from 1 to n - 1, remember the value at i. Walk backward through the sorted prefix while previous values are greater. Each greater value shifts one cell right. When the walk reaches a smaller-or-equal value, or falls off the beginning, write the remembered value into the open slot. Using greater-than rather than greater-than-or-equal preserves the order of equal records, which is the stability property.`,
        `The backward scan is a local Linear Search over the sorted prefix. A Binary Search can find the insertion location with fewer comparisons, but it does not remove the cost of shifting values, so array-based binary insertion still has O(n^2) moves. If comparisons are extremely expensive it can help; if memory movement dominates, it usually does not.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Worst case is reverse order: the kth item shifts across k previous items, for about n(n - 1) / 2 comparisons and moves, or O(n^2). Average random input is also O(n^2). Best case is already sorted input: one failed comparison per item, O(n) time and O(1) extra space.`,
        `The small-n behavior is the real story. A range of 16, 32, or 64 items can sort faster with this method than with a theoretically better algorithm because the loop is branch-predictable and the data stays in cache. Big-O Growth Rates still wins at scale, but constants decide the base cases inside library sorts.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Python and Java object sorting use TimSort, a run-aware algorithm descended from Merge Sort that exploits naturally ordered runs and uses insertion-style methods to extend short runs. C++ standard-library sort implementations often use it for tiny partitions after Quick Sort-style partitioning. Databases and UI tables use the same idea when a user appends a few rows to an already sorted list: repairing a nearly sorted array can be cheaper than rebuilding an index.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Do not confuse it with Bubble Sort. Bubble-style sorting repeatedly swaps adjacent inversions across full passes; insertion-style sorting inserts each new value into a maintained prefix. They share O(n^2) worst-case notation, but they do different work and have different constants. Also do not assume the sorted prefix is frozen forever: earlier values can shift right many times as smaller later values arrive.`,
        `It is not a replacement for asymptotically faster algorithms. At 1,000,000 random numbers, O(n^2) is catastrophic. The right lesson is conditional: this method is excellent for small, nearly sorted, or online-maintained ranges, and poor as a standalone general-purpose sorter.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Compare Bubble Sort and Selection Sort to understand nearby O(n^2) trade-offs. Then move to Merge Sort and Quick Sort for the divide-and-conquer escape hatch. Binary Search explains the comparison-saving variant, while Big-O Growth Rates explains why the shifting cost still dominates large arrays.`,
      ],
    },
  ],
};
