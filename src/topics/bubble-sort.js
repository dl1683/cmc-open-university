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
      heading: 'What it is',
      paragraphs: [
        `Bubble sort is the elementary algorithm: walk through the array, compare each pair of neighbors, and swap them if they are backwards. The largest value "bubbles" to its final position by the end of the first pass. Then repeat for the remaining unsorted portion, locking one more value into place each pass, until the whole array is sorted.`,
        `It is the slowest sort you will ever implement, but the easiest to understand. No recursion, no complex partitioning — just a nested loop comparing and swapping. This simplicity makes it the first sort taught to beginners; it is also the benchmark for "how NOT to sort in production."`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Start at the left. Compare each element with its right neighbor. If they are out of order (left > right), swap them. Continue until you reach the end of the unsorted region. That one pass bubbles the largest value to the far right. Now repeat the whole process on the array minus the last position, which is now sorted. Keep shrinking the unsorted region by one element per pass until nothing remains.`,
        `The key insight is the invariant: after k passes, the k largest values are in their final positions and will never move again. This lets you prune the search space each iteration. An early-termination optimization kicks in too — if a whole pass happens with zero swaps, the array is already sorted and you can stop immediately instead of running needless passes.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Worst case and average case are both O(n²) comparisons and O(n²) swaps. The worst case happens when the array is reverse-sorted (every pair is out of order, every pass touches every element). Best case is O(n) — if the array is already sorted, the first pass discovers zero swaps and exits early. Space complexity is O(1): the algorithm sorts in place with only a couple of loop counters. That in-place behavior is bubble sort's only real asset, but other in-place sorts like Quicksort run circles around it while using the same space.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Bubble sort is almost never used in practice. It appears in teaching curricula because the logic is transparent and the code is short enough to type without thinking. In rare scenarios — when the array is nearly sorted and you want to take advantage of the early-exit optimization — bubble sort can be competitive with insertion sort, which is also O(n²) worst case but has better constants. The real-world winner for small arrays is insertion sort; for anything larger, Quicksort, Merge Sort, or language library sorts (like Python's Timsort or C++'s introsort) dominate.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `A common mistake is thinking bubble sort is "good enough" for small datasets and skipping the harder algorithms. Size does not matter — Insertion Sort is simpler AND faster for small arrays. Bubble sort is simply slower than its alternatives at every scale. Another misconception is that the early-exit optimization (breaking when no swaps occur) makes bubble sort practical; it helps only when the data is already close to sorted, which defeats the purpose of running a sort at all.`,
        `Students sometimes confuse bubble sort with insertion sort. Bubble sort compares and swaps neighbors in place across many passes. Insertion sort builds a sorted region one element at a time, inserting each new element into its correct position via shifting. They have the same O(n²) worst case, but insertion sort has better best-case and average-case constants in practice, making it the superior choice if you must use a quadratic sort.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Now that you understand how bubble sort works, examine Insertion Sort to see a faster quadratic competitor. Then leap to Merge Sort and Quick Sort to see why O(n log n) is the gold standard for sorting. Study Big-O Growth Rates to internalize the gap between O(n²) and O(n log n). If you want to understand in-place sorting with good constants, explore the theory of comparator-based sorts and how Quicksort's divide-and-conquer strategy beats repeated passes.`,
      ],
    },
  ],
};

