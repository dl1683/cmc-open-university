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
    explanation: 'Bubble sort has one invariant: after each pass, the largest remaining value is fixed at the right edge. Neighbor swaps are just the mechanism that pushes that value there.',
  };

  for (let end = values.length - 1; end > 0; end -= 1) {
    let swapped = false;
    for (let i = 0; i < end; i += 1) {
      const inOrder = values[i] <= values[i + 1];
      yield {
        state: arrayState(values),
        highlight: { compare: [`i${i}`, `i${i + 1}`], sorted: sortedIds() },
        explanation: `${values[i]} and ${values[i + 1]} are adjacent, so this local check is enough to decide whether their order is legal. ${inOrder ? 'They are already ordered, so the pass moves on.' : 'They are inverted, so swapping them moves the larger value one slot closer to its final position.'}`,
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
          explanation: `${values[i + 1]} moved right because it was larger than its neighbor. If it is the largest value still unsorted, repeated local swaps will carry it to the boundary.`,
        };
      }
    }
    sortedCount += 1;
    yield {
      state: arrayState(values),
      highlight: { sorted: sortedIds() },
      explanation: `${values[end]} is now fixed at position ${end}. Nothing to its left can be larger and still pass through this boundary.${swapped ? '' : ' No swaps happened this whole pass, which proves the remaining prefix is already sorted.'}`,
    };
    if (!swapped) break;
  }

  sortedCount = values.length;
  yield {
    state: arrayState(values),
    highlight: { sorted: values.map((_, i) => `i${i}`) },
    explanation: `The array is sorted because every boundary has been locked from right to left. The cost is the lesson: local neighbor fixes can take O(n^2) comparisons, which is why Merge Sort and Quick Sort matter.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Two highlighted cells are the pair being compared. When they swap, the larger value slides one slot right. When they stay, the scan advances to the next pair. Each left-to-right sweep is one pass.',
        {
          type: 'callout',
          text: 'Bubble sort teaches the pass invariant: every full sweep fixes the largest unsorted value at the right boundary.',
        },
        'After each pass, a sorted marker appears at the right edge. That position is final and will never be touched again. The sorted boundary grows leftward, one slot per pass, until it swallows the whole array.',
        'Watch for the early-exit moment: if a full pass completes with zero swaps, every remaining position turns sorted at once. That is bubble sort finishing in O(n) on already-sorted input.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Bubble sort is the simplest sorting algorithm to understand and implement. Five lines of code, one idea: compare adjacent elements, swap if they are out of order, repeat. No recursion, no auxiliary storage, no clever data structures.',
        'Its value is pedagogical. It introduces loop invariants, in-place mutation, stability, best-versus-worst case analysis, and quadratic growth in one small package. It also delivers the most important lesson in algorithm design: correct and simple does not mean fast enough. Every student who learns bubble sort first will understand why merge sort and quicksort exist.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Scan left to right, comparing each adjacent pair. Swap any pair that is out of order. When the scan finishes, start over. Keep scanning until a full pass produces no swaps.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/c/c8/Bubble-sort-example-300px.gif',
          alt: 'Animated bubble sort pass showing adjacent swaps and the sorted right boundary',
          caption: 'Bubble sort animation showing adjacent swaps across repeated passes. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Bubble-sort-example-300px.gif.',
        },
        'This works. Each pass pushes the largest unsorted value to the right end, like a bubble rising to the surface. After n−1 passes, every element is in place. The logic fits in a nested loop and the code reads like pseudocode.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The cost is O(n\xB2) comparisons, even on average. A reverse-sorted array of 1,000 elements forces roughly 500,000 comparisons and nearly as many swaps. That is the price of local movement: a swap fixes one adjacent inversion but carries no information about how far a value needs to travel.',
        'Large values move fast. A big element at the left rides the pass all the way to the right in one sweep because it wins every comparison it enters. Small values move slow. A small element at the right can only drift left by one position per pass, because it must wait for the leftward comparison to reach it. These slow movers are called turtles.',
        'Try [2, 3, 4, 5, 1]. The value 1 sits at the end. Pass 1 moves it to index 3. Pass 2 to index 2. Pass 3 to index 1. Pass 4 to index 0. Four full passes for one misplaced element. This asymmetry means even mostly-sorted arrays hit near-quadratic cost when the displaced elements are small ones far to the right.',
        'The deeper problem: neighbor swaps are retail. Merge sort moves values across large distances by merging halves. Quicksort partitions around a pivot so every element jumps to the correct side in one step. Bubble sort pays one swap per unit of distance.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The outer loop runs passes numbered 0 through n−1. The inner loop compares adjacent pairs from index 0 up to the current boundary. If values[i] > values[i+1], they swap. After pass k, the last k+1 positions are sorted.',
        'A boolean flag tracks whether any swap happened during the current pass. If a full pass completes with the flag still false, no adjacent inversion remains and the array is sorted. The algorithm breaks out early instead of grinding through the remaining passes.',
        'The boundary shrinks by one after each pass because the largest remaining value is guaranteed to have reached its final position. This means pass 0 does n−1 comparisons, pass 1 does n−2, and so on. The total without early exit is n(n−1)/2.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Loop invariant: after pass k, the elements in positions n−k−1 through n−1 are in their final sorted positions, and every one of them is greater than or equal to every element before the boundary.',
        'The invariant holds because the largest value in the unsorted prefix cannot be blocked during a pass. It wins every comparison it enters, so it arrives at the boundary by the end of the sweep. Once placed, later passes do not visit it because the inner loop range shrinks.',
        'The early-exit argument: if a pass produces zero swaps, no adjacent pair is out of order. An array with no adjacent inversions is fully sorted, because any out-of-order pair a[i] > a[j] with i < j would imply at least one adjacent inversion along the path from i to j.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Worst case (reverse sorted): O(n\xB2) comparisons and O(n\xB2) swaps. For n = 100, that is about 4,950 comparisons. For n = 10,000, about 50 million. Doubling the input quadruples the work.',
        'Average case: O(n\xB2). Random input has about n(n−1)/4 inversions on average, so the swap count halves but the comparison count stays the same.',
        'Best case (already sorted, with early-exit flag): O(n). One pass, zero swaps, done. Without the flag, even sorted input costs O(n\xB2) because the nested loop runs to completion regardless.',
        'Space: O(1). Only a temporary variable for swapping and a few loop counters. The entire algorithm state is visible in the array itself.',
        'Bubble sort is stable: equal elements are never swapped (the comparison uses strict greater-than), so their original relative order is preserved. It is also adaptive when the early-exit optimization is present, meaning its cost depends on how disordered the input is.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Teaching. Every step has one obvious cause: if the pair is inverted, swap; if not, advance. The invariant is visible after every pass. Students can practice proving correctness from state transitions before tackling harder algorithms.',
        'Nearly-sorted data with early termination. If the input has only a few elements out of place, bubble sort can finish in a small number of passes. For a list that is sorted except for one swap at the end, it finishes in two passes.',
        'Tiny arrays where simplicity outweighs performance. For n < 10, the constant factors of fancier algorithms can cost more than the O(n\xB2) inner loop. Some production sort implementations use insertion sort (not bubble sort) for this case, but bubble sort is not catastrophic at these sizes.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'O(n\xB2) makes it impractical for any serious workload. At n = 1,000, you pay roughly 500,000 comparisons. At n = 10,000, roughly 50 million. Obama was right: “I don\'t think bubble sort is the way to go.”',
        'Even on nearly-sorted data, insertion sort is usually better. Insertion sort shifts elements into a growing sorted prefix and typically does fewer writes, because it moves a value to its correct position in one shift sequence rather than swapping it one slot at a time.',
        'The turtle problem means bubble sort is not even the best quadratic sort for most inputs. Selection sort does fewer swaps (exactly n−1). Insertion sort adapts better to partially sorted data. Shell sort breaks through the quadratic barrier with gap sequences. There is no realistic scenario where bubble sort is the best choice for performance.',
        'Do not confuse in-place with fast. Heap sort is in-place and O(n log n). Do not confuse simple with practical. Production sort routines (Timsort, introsort, pdqsort) are hybrid algorithms tuned for real hardware.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Input: [5, 3, 8, 1, 2].',
        'Pass 1 (compare indices 0–3): Compare 5,3 — swap → [3,5,8,1,2]. Compare 5,8 — no swap. Compare 8,1 — swap → [3,5,1,8,2]. Compare 8,2 — swap → [3,5,1,2,8]. Four comparisons, three swaps. The 8 is now final at index 4.',
        'Pass 2 (compare indices 0–2): Compare 3,5 — no swap. Compare 5,1 — swap → [3,1,5,2,8]. Compare 5,2 — swap → [3,1,2,5,8]. Three comparisons, two swaps. The 5 is now final at index 3.',
        'Pass 3 (compare indices 0–1): Compare 3,1 — swap → [1,3,2,5,8]. Compare 3,2 — swap → [1,2,3,5,8]. Two comparisons, two swaps. The 3 is now final at index 2.',
        'Pass 4 (compare index 0): Compare 1,2 — no swap. One comparison, zero swaps. Early exit: the flag says no swaps happened, so the remaining prefix [1,2] is already sorted.',
        'Result: [1,2,3,5,8]. Total: 10 comparisons, 7 swaps across 4 passes. Notice the turtle: the value 1 started at index 3 and moved left one position per pass, taking three passes to reach index 0.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Knuth, The Art of Computer Programming, Vol. 3: Sorting and Searching (1998). Knuth calls bubble sort “a method which has little to recommend it, except a catchy name and the fact that it leads to some interesting theoretical problems.” Astrachan, “Bubble Sort: An Archaeological Algorithmic Analysis” (2003), traces the algorithm\'s history and its curious persistence in textbooks despite universal agreement that it is inferior.',
        'Quadratic comparisons: Insertion Sort (builds a sorted prefix by shifting, usually fewer writes, better on nearly-sorted data) and Selection Sort (finds the minimum each pass, exactly n−1 swaps, but not stable). Comparing all three teaches that algorithms with the same O(n\xB2) label behave very differently in practice.',
        'Escaping the quadratic wall: Merge Sort (O(n log n), stable, divide-and-conquer), Quick Sort (O(n log n) average, the practical champion), Heap Sort (O(n log n) worst case, in-place). Big-O Growth Rates explains why the jump from n\xB2 to n log n matters so much at scale.',
      ],
    },
  ],
};
