// Bubble sort: compare neighbors, swap when out of order.
// The largest unsorted value "bubbles" to the end on every pass.

import { arrayState, parseNumberList } from '../core/state.js';

export const topic = {
  id: 'bubble-sort',
  title: 'Bubble Sort',
  category: 'Sorting',
  summary: 'Compare each pair of neighbors and swap — the simplest sort there is.',
  controls: [
    { id: 'values', label: 'Values', type: 'number-list', defaultValue: '9, 2, 14, 5, 5, 1' },
  ],
  run,
};

export function* run(input) {
  const values = parseNumberList(input.values, { max: 10 });
  const sortedIds = () => values.map((_, i) => `i${i}`).slice(values.length - sortedCount);
  let sortedCount = 0;

  yield {
    state: arrayState(values),
    highlight: {},
    explanation: 'Bubble sort makes repeated passes, comparing each pair of NEIGHBORS and swapping them if they are out of order. Watch the largest value travel right on every pass.',
  };

  for (let end = values.length - 1; end > 0; end -= 1) {
    let swapped = false;
    for (let i = 0; i < end; i += 1) {
      const inOrder = values[i] <= values[i + 1];
      yield {
        state: arrayState(values),
        highlight: { compare: [`i${i}`, `i${i + 1}`], sorted: sortedIds() },
        explanation: `Compare neighbors ${values[i]} and ${values[i + 1]}: ${inOrder ? 'already in order — leave them.' : 'out of order — swap them.'}`,
        invariant: sortedCount > 0
          ? `The last ${sortedCount} position${sortedCount === 1 ? ' is' : 's are'} final — each pass locked one more in place.`
          : undefined,
      };
      if (!inOrder) {
        [values[i], values[i + 1]] = [values[i + 1], values[i]];
        swapped = true;
        yield {
          state: arrayState(values),
          highlight: { swap: [`i${i}`, `i${i + 1}`], sorted: sortedIds() },
          explanation: `Swapped: ${values[i]} and ${values[i + 1]} trade places. ${values[i + 1]} keeps riding right as long as it is the biggest thing on this pass.`,
        };
      }
    }
    sortedCount += 1;
    yield {
      state: arrayState(values),
      highlight: { sorted: sortedIds() },
      explanation: `Pass complete: ${values[end]} has bubbled to position ${end} and will never move again.${swapped ? '' : ' No swaps happened this whole pass — the array must already be sorted, so we can stop early.'}`,
    };
    if (!swapped) break;
  }

  sortedCount = values.length;
  yield {
    state: arrayState(values),
    highlight: { sorted: values.map((_, i) => `i${i}`) },
    explanation: `Sorted! Bubble sort compared neighbors up to n times across n passes — O(n²). Fine for ${values.length} values, hopeless for a million. That pain is why Merge Sort and Quick Sort exist.`,
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Bubble sort is the neighbor-swap sorting algorithm. Walk left to right, compare adjacent values, and swap them when they are out of order. After one full pass, the largest value has drifted to the far right, like a bubble rising through water. Repeat on the still-unsorted prefix until every value is locked into place.`,
        `Its importance is mostly educational. The algorithm is easy to watch because every comparison is local and every swap is visible. It also gives you a first honest encounter with a bad growth curve: two nested loops, many repeated comparisons, and performance that collapses as n grows. That makes it a useful foil for Insertion Sort, Merge Sort, Quick Sort, and Heap Sort.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Pass 1 compares positions 0 and 1, then 1 and 2, then 2 and 3, continuing to the end. Whenever left > right, swap. The largest value seen so far keeps moving right until it reaches its final slot. Pass 2 can stop one position earlier because the last slot is already correct. After k passes, the k largest values are in final sorted order at the end of the array.`,
        `A practical implementation keeps a swapped flag. If a whole pass finishes with no swaps, the array was already sorted and the algorithm can stop. A slightly stronger version also remembers the last swap position, because everything after that point is already in order. The comparison should be strict - swap only when left > right - so equal values keep their original order. That makes the algorithm stable.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Worst-case and average-case time are O(n^2). A reverse-sorted array of n items causes about n(n - 1) / 2 comparisons and almost as many swaps, so 10,000 items means roughly 50 million neighbor checks. Best case is O(n) only when the swapped flag is present and the input is already sorted. Space is O(1) because the sort happens in place with one temporary variable. Big-O Growth Rates is the lesson: O(n^2) looks harmless at 20 items and punishing at 20,000.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `You almost never choose this algorithm in production. It is useful in classrooms, visualizers, and interviews because it exposes loop invariants, stability, in-place sorting, and best-versus-worst-case behavior with tiny code. Embedded examples sometimes use it for a handful of values because the implementation is short, but even there Selection Sort or Insertion Sort is usually a better choice.`,
        `Real libraries use hybrids. Python's Timsort combines run detection, insertion-style work on small ranges, and merging. C++ introsort starts like Quick Sort and falls back to Heap Sort if partitioning gets dangerous. Merge Sort is preferred when stable O(n log n) behavior matters. Bubble-style repeated passes mainly survive as a warning label: simple code can still have the wrong asymptotic shape.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The biggest misconception is that the early-exit flag makes the algorithm generally practical. It only helps when the data is already sorted or very close to sorted; it does not rescue random or reverse-sorted input. Another mistake is forgetting to shrink the unsorted boundary, which repeats comparisons against values already known to be final.`,
        `Do not confuse it with Insertion Sort. Both can be stable and both have O(n^2) worst cases, but insertion-style sorting shifts an item left into a sorted prefix and usually performs fewer writes. Also remember that "in place" does not mean "fast." Heap Sort is in place with O(n log n) time, while this algorithm is in place with quadratic time.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Insertion Sort and Selection Sort to compare the three quadratic teaching sorts. Then move to Merge Sort, Quick Sort, and Heap Sort to see the O(n log n) family. Big-O Growth Rates explains why the jump from quadratic to linearithmic matters, and Recursion prepares you for the divide-and-conquer sorts.`,
      ],
    },
  ],
};
