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
      heading: 'What it is',
      paragraphs: [
        `Insertion sort mimics how you organize a hand of playing cards: hold a sorted pile, and for each new card, slide it left until it lands in the right spot. In array terms, grow a sorted prefix from left to right. At each step, pick the next unsorted element, compare it backward through the sorted region, shift larger elements right to make room, and drop the new element into its correct position.`,
        `It is the algorithm of choice for small arrays and nearly-sorted data because its behavior adapts to the input. When the array is already mostly sorted, insertion sort flies through with near-linear performance. When scrambled, it reverts to O(n²), but with better constants than bubble sort.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Start with a sorted prefix of length 1 (any single element is trivially sorted). For each position i from 1 to n-1, grab the value at position i and hold it aside. Scan backward through the sorted prefix, comparing the held value with each element. While the held value is smaller, shift the scanned element one position right. Stop when you find an element smaller than the held value, or reach the start of the array. Drop the held value into that empty slot. Now the sorted prefix has grown by one position.`,
        `The invariant is clear: after iteration i, positions 0 through i are sorted relative to each other. No element in the sorted prefix will move again. The next iteration works only on the remaining unsorted tail. This is different from bubble sort, which makes many passes; insertion sort processes each element exactly once through a linear search backward.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Worst case is O(n²) comparisons and O(n²) shifts (when the input is reverse-sorted and every insertion must slide through the entire sorted prefix). Average case is also O(n²). Best case is O(n) — when the array is already sorted, the inner while loop never executes and only comparisons happen. Space complexity is O(1): the algorithm sorts in place. Unlike bubble sort, insertion sort's constants are tight; it is one of the fastest O(n²) sorts and is competitive with or faster than quicksort on small arrays (under 50 elements).`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Insertion sort appears in production code more often than you might think. Python's Timsort and Java's Arrays.sort both use insertion sort as a finishing pass for small ranges or nearly-sorted data — it is fast enough for n < 50 and adapts instantly to partially sorted input. C++'s introsort does the same. In fact, real-world performance often favors insertion sort over more famous algorithms for realistic small or partially-sorted datasets. It is also the go-to sort for online algorithms where new data arrives continuously and you must keep a small sorted set current.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `A common mistake is dismissing insertion sort as slow because it is O(n²) worst case. That is unfair — on nearly-sorted data it is O(n), and even on random data its constants are so good that it beats quicksort on small arrays. The other misconception is confusing it with bubble sort. They are not the same. Bubble sort makes many passes across the whole array, swapping neighbors. Insertion sort makes one pass through the array, inserting each element into a sorted prefix via shifting. Insertion sort is strictly better.`,
        `Another pitfall is trying to optimize insertion sort by using binary search to find the insertion position. This drops comparisons to O(n log n), but the shifting cost remains O(n²), so you gain nothing. If you want to optimize, use a different algorithm: Merge Sort or Quicksort.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Review Bubble Sort to see a slower competitor and understand why constants matter. Then study Merge Sort and Quick Sort to see how divide-and-conquer beats the O(n²) ceiling. Learn about Big-O Growth Rates to feel the gap between O(n²) and O(n log n). Finally, explore how real libraries like Python (Timsort) and Java (dual-pivot quicksort) combine insertion sort with faster algorithms to get the best of both worlds.`,
      ],
    },
  ],
};

