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
        'Two highlighted cells are the pair being compared right now. When they swap, the larger value slides one slot to the right. When they stay put, the scan advances to the next pair. One complete left-to-right sweep across the array is called a pass.',
        {type: 'image', src: './assets/gifs/bubble-sort.gif', alt: 'Animated walkthrough of the bubble sort visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'After each pass finishes, a sorted marker appears at the right edge. That position is locked -- nothing will ever move it again. The sorted boundary grows leftward, one slot per pass, until the entire array is covered.',
        'Watch for the early-exit moment: if a full pass finishes with zero swaps, every remaining unmarked position turns sorted at once. That is bubble sort completing in O(n) time on input that was already in order.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Sorting means rearranging a list so each element is less than or equal to the one after it. Many algorithms solve this problem, but bubble sort is the simplest one to write and understand. It needs five lines of code, one idea (compare neighbors, swap if wrong), no recursion, no extra memory, and no clever data structures.',
        'Its real value is as a teaching tool. In one small package it introduces loop invariants (a property that stays true after every pass), in-place mutation (changing the array without copying it), stability (equal elements keep their original order), and the difference between best-case and worst-case cost. It also delivers the most important lesson in algorithm design: correct and simple does not mean fast enough.',
        'Every student who learns bubble sort first will immediately understand why faster algorithms like merge sort and quicksort were invented. The pain of O(n²) is the motivation for everything that follows.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Start at the left end. Compare the first two elements. If they are out of order, swap them. Move one position right and repeat. When you reach the end, go back to the start and do it again. Keep making passes until you complete an entire sweep with zero swaps.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/c/c8/Bubble-sort-example-300px.gif',
          alt: 'Animated bubble sort pass showing adjacent swaps and the sorted right boundary',
          caption: 'Bubble sort animation showing adjacent swaps across repeated passes. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Bubble-sort-example-300px.gif.',
        },
        'This works because each pass pushes the largest unsorted value to the right end, like a bubble rising to the surface of water. After at most n−1 passes (where n is the array length), every element is in place. The logic fits inside two nested loops and the code reads almost like pseudocode.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The cost is O(n²) comparisons even on average input. A reverse-sorted array of 1,000 elements forces roughly 500,000 comparisons and nearly as many swaps. That is the price of local movement: each swap fixes exactly one adjacent inversion but carries no information about how far a value ultimately needs to travel.',
        'Large values move fast -- a big element sitting at the left rides the pass all the way to the right in one sweep because it wins every comparison it enters. Small values move slow. A small element stuck at the right side can only drift left by one position per pass, because the leftward comparison must physically reach it before it gets a chance to swap. These slow-moving small values are called turtles.',
        'Try the array [2, 3, 4, 5, 1]. The value 1 sits at index 4. Pass 1 moves it to index 3. Pass 2 moves it to index 2. Pass 3 to index 1. Pass 4 to index 0. Four full passes just for one misplaced element. This asymmetry means even mostly-sorted arrays can hit near-quadratic cost whenever the displaced elements are small values far to the right.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        {
          type: 'callout',
          text: 'Bubble sort teaches the pass invariant: every full sweep fixes the largest unsorted value at the right boundary.',
        },
        'The pass invariant is the key to understanding why bubble sort is correct. During a left-to-right sweep, the largest value in the unsorted region cannot be blocked. Every time it is compared to its right neighbor, it is larger, so it swaps rightward. By the time the sweep reaches the boundary, that largest value has been carried all the way to the boundary position.',
        'Once a value reaches the boundary, it is final. Later passes shrink the inner loop so they never revisit it. This means after pass k (starting from 0), the rightmost k+1 positions hold their correct sorted values, and every one of those values is greater than or equal to everything still in the unsorted prefix.',
        'This insight also explains the early-exit optimization. If a full pass produces zero swaps, then no adjacent pair was out of order. An array with no adjacent inversions is fully sorted -- you can prove this by contradiction, because any out-of-order pair a[i] > a[j] with i < j would force at least one adjacent inversion somewhere between positions i and j.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The outer loop counts passes from 0 through n−1. Each pass sets a boundary: on pass k, the inner loop compares adjacent pairs from index 0 up to index n−k−2. If values[i] > values[i+1], the two elements swap. After the pass completes, the element now sitting at index n−k−1 is in its final position.',
        'A boolean flag (often called “swapped”) starts as false at the beginning of each pass and flips to true whenever a swap occurs. If the flag is still false when the pass ends, no adjacent inversion exists anywhere in the unsorted prefix, so the array is already sorted. The algorithm breaks out immediately instead of grinding through the remaining passes.',
        'The boundary shrinks by one after each pass because the largest remaining value is guaranteed to have reached its final slot. Pass 0 does n−1 comparisons, pass 1 does n−2, pass 2 does n−3, and so on. Without early exit, the total number of comparisons is (n−1) + (n−2) + ... + 1 = n(n−1)/2.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness proof rests on the loop invariant: after pass k, positions n−k−1 through n−1 contain their final sorted values, and every element in those positions is at least as large as every element before the boundary. We prove this by induction on k.',
        'Base case (k = 0): during the first pass, the inner loop scans all n−1 adjacent pairs. The largest value in the entire array wins every comparison it enters, so it is swapped rightward at every step until it lands at index n−1. That position now holds the global maximum, which is its correct final value.',
        'Inductive step: assume the invariant holds after pass k−1, meaning the last k positions are final. Pass k scans indices 0 through n−k−2. The largest value in that unsorted prefix wins every comparison and arrives at index n−k−1. Since all values to its right are already at least as large (by the inductive hypothesis), the invariant extends to k+1 positions.',
        'Termination: after at most n−1 passes, positions 1 through n−1 are final, which forces position 0 to hold the global minimum. Alternatively, if the early-exit flag detects zero swaps on any pass, no adjacent inversion remains, and the entire array is sorted.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Worst case (reverse-sorted input): O(n²) comparisons and O(n²) swaps. The exact count is n(n−1)/2 comparisons. For n = 100, that is 4,950. For n = 1,000, it is 499,500. For n = 10,000, roughly 50 million. Doubling n quadruples the work.',
        'Average case: still O(n²). A random permutation has about n(n−1)/4 inversions on average, so the swap count roughly halves compared to worst case, but the comparison count stays at n(n−1)/2 because the inner loop runs regardless of whether a swap happens.',
        'Best case (already sorted, with early-exit flag): O(n). One pass, n−1 comparisons, zero swaps, and the flag triggers an immediate exit. Without the flag, even sorted input costs O(n²) because the nested loop runs to completion.',
        'Space: O(1) extra memory. The algorithm only needs a temporary variable for swapping and a few loop counters. The entire algorithm state lives inside the array itself.',
        'Bubble sort is stable: equal elements are never swapped because the comparison uses strict greater-than (>), so their original relative order is preserved. It is also adaptive when the early-exit flag is present, meaning its running time decreases as the input becomes more sorted.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Teaching is the primary use. Every step has one obvious cause: if the pair is inverted, swap; if not, advance. The invariant is visible in the animation after every pass. Students can practice proving correctness from state transitions before tackling harder algorithms.',
        'Nearly-sorted data with early termination can finish fast. If the input has only a few elements out of place, bubble sort can complete in a small number of passes. For a list that is sorted except for one swap near the end, it finishes in two passes -- O(n) work.',
        'Tiny arrays where simplicity outweighs constant factors. For n < 10, the overhead of divide-and-conquer algorithms can exceed the cost of the O(n²) inner loop. Production sort implementations typically use insertion sort (not bubble sort) for this base case, but bubble sort is not catastrophic at these sizes. In embedded systems with extremely tight code-size constraints, its minimal implementation footprint can matter.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'O(n²) makes it impractical for any real workload. At n = 1,000, you pay roughly 500,000 comparisons. At n = 10,000, roughly 50 million. At n = 100,000, roughly 5 billion. Obama was right: “I don\'t think bubble sort is the way to go.”',
        'Even on nearly-sorted data, insertion sort is usually better. Insertion sort shifts elements into a growing sorted prefix and typically does fewer writes, because it moves a value to its correct position in one shift sequence rather than swapping it one slot at a time through every intermediate position.',
        'The turtle problem means bubble sort is not even the best quadratic sort. Selection sort does fewer swaps (exactly n−1). Insertion sort adapts better to partially sorted data. Shell sort breaks through the quadratic barrier with gap sequences that let elements jump over long distances. There is no realistic scenario where bubble sort is the best choice for performance.',
        'Do not confuse in-place with fast -- heap sort is in-place and runs in O(n log n). Do not confuse simple with practical -- production sort routines (Timsort in Python/Java, introsort in C++, pdqsort in Rust) are hybrid algorithms carefully tuned for real hardware, cache behavior, and branch prediction.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Input: [5, 3, 8, 1, 2]. Five elements, so at most 4 passes needed.',
        'Pass 1 (compare indices 0 through 3, four comparisons): Compare 5 and 3 -- 5 > 3, swap. Array becomes [3, 5, 8, 1, 2]. Compare 5 and 8 -- 5 < 8, no swap. Compare 8 and 1 -- 8 > 1, swap. Array becomes [3, 5, 1, 8, 2]. Compare 8 and 2 -- 8 > 2, swap. Array becomes [3, 5, 1, 2, 8]. Result: 4 comparisons, 3 swaps. The 8 is now locked at index 4.',
        'Pass 2 (compare indices 0 through 2, three comparisons): Compare 3 and 5 -- no swap. Compare 5 and 1 -- swap. Array becomes [3, 1, 5, 2, 8]. Compare 5 and 2 -- swap. Array becomes [3, 1, 2, 5, 8]. Result: 3 comparisons, 2 swaps. The 5 is now locked at index 3.',
        'Pass 3 (compare indices 0 through 1, two comparisons): Compare 3 and 1 -- swap. Array becomes [1, 3, 2, 5, 8]. Compare 3 and 2 -- swap. Array becomes [1, 2, 3, 5, 8]. Result: 2 comparisons, 2 swaps. The 3 is now locked at index 2.',
        'Pass 4 (compare index 0, one comparison): Compare 1 and 2 -- no swap. The swapped flag stays false, so early exit triggers. Positions 0 and 1 are both marked sorted.',
        'Final result: [1, 2, 3, 5, 8]. Totals: 10 comparisons, 7 swaps, 4 passes. Notice the turtle: the value 1 started at index 3 and moved left by exactly one position per pass, requiring 3 passes to reach index 0. Meanwhile the value 8 traveled from index 2 to index 4 in a single pass.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Knuth, The Art of Computer Programming, Vol. 3: Sorting and Searching (1998), calls bubble sort “a method which has little to recommend it, except a catchy name and the fact that it leads to some interesting theoretical problems.” Astrachan, “Bubble Sort: An Archaeological Algorithmic Analysis” (2003), traces the algorithm\'s history and its curious persistence in textbooks despite universal agreement that it is inferior to alternatives.',
        'Quadratic comparisons: study Insertion Sort next (builds a sorted prefix by shifting values, usually fewer writes, better on nearly-sorted data) and Selection Sort (finds the minimum each pass, exactly n−1 swaps, but not stable). Comparing all three teaches that algorithms sharing the same O(n²) label can behave very differently in practice -- swap counts, comparison counts, adaptivity, and stability all vary.',
        'Escaping O(n²): Merge Sort (O(n log n), stable, divide-and-conquer), Quick Sort (O(n log n) average, the practical champion for random data), and Heap Sort (O(n log n) worst case, in-place). Big-O Growth Rates explains why the jump from n² to n log n matters so much -- at n = 10,000, n² is 100 million while n log n is about 133,000.',
      ],
    },
  ],
};
