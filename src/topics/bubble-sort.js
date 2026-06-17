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
      heading: `Why This Exists`,
      paragraphs: [
        `Bubble sort exists mostly as a teaching algorithm. It is not famous because it is fast. It is famous because it exposes sorting in the smallest possible moving parts: compare two neighbors, swap them if they are inverted, and repeat until no boundary is wrong. Every operation is visible and easy to explain.`,
        `That makes it a useful first sorting study. It introduces in-place mutation, stability, loop invariants, early exit, best case versus worst case, and quadratic growth without needing recursion or extra data structures. It also gives a clean warning: code can be correct, simple, and still have the wrong performance shape for real input sizes.`,
      ],
    },
    {
      heading: `The Naive Approach`,
      paragraphs: [
        `The naive local-repair idea is straightforward: if two adjacent values are out of order, swap them. Keep sweeping until every adjacent pair is ordered. If every local boundary is correct, the whole array is sorted. This is a valid idea, but it pays for movement in the smallest possible unit: one neighboring exchange.`,
        `That distance cost is the problem. A tiny value that starts at the far right can move left only one slot each time it is compared with its left neighbor. A large value can drift right across many swaps in one pass, but nothing jumps directly to its final location. Bubble sort teaches that local correctness does not automatically imply global efficiency.`,
      ],
    },
    {
      heading: `The Core Mechanic`,
      paragraphs: [
        `A pass starts at the left edge and compares positions 0 and 1, then 1 and 2, then 2 and 3, and so on. Whenever the left value is greater than the right value, the algorithm swaps them. The larger value moves one slot to the right. If it keeps meeting smaller neighbors, it keeps moving right.`,
        `By the end of the first full pass, the largest value in the array must be at the far right. The next pass can stop one position earlier because that last slot is final. After k passes, the k largest values form a sorted suffix. The unsorted region shrinks from right to left.`,
        `The implementation in this topic keeps a swapped flag. That flag records whether a pass actually changed anything. If a pass makes no swaps, the remaining prefix already has no adjacent inversions, so the algorithm can stop early instead of grinding through the rest of the fixed loop schedule.`,
      ],
    },
    {
      heading: `What The Visual Proves`,
      paragraphs: [
        `The visual proves the sorted-suffix invariant. At first, no position is final. After one pass, the rightmost value is final. After two passes, the two rightmost values are final. The highlighted comparison is local, but the pass-level effect is global: the largest remaining value is pushed to the boundary.`,
        `It also proves the weakness. Watch a small value that starts near the end. It can move left only when it is compared with the value immediately before it, so it may need many separate swaps. Better sorting algorithms avoid paying one adjacent swap per unit of distance. They move values through partitioning, merging, heap structure, or insertion into a known prefix.`,
      ],
    },
    {
      heading: `Why It Works`,
      paragraphs: [
        `The proof is short. Consider the largest value in the unsorted prefix during a pass. If it is left of a smaller neighbor, it swaps right. If it is already right of that neighbor, it stays ahead of it. No value in the prefix can permanently block it. By the end of the pass, it has reached the final slot of the prefix.`,
        `Once that slot is final, later passes do not need to touch it. Repeating the argument on the shorter prefix eventually locks every boundary. If a full pass has no swaps, then no adjacent inversion remains. An array with no adjacent inversions is sorted, because any out-of-order pair would imply at least one adjacent inversion along the path between them.`,
      ],
    },
    {
      heading: `Stability And In-Place Work`,
      paragraphs: [
        `Bubble sort is in place. It needs only a temporary variable for swapping and a few loop variables, so auxiliary space is O(1). That matters in teaching because the array itself shows the whole state of the algorithm. There is no hidden merge buffer, heap, recursion stack, or queue.`,
        `It is also stable if the comparison swaps only when left is greater than right. Equal values are not swapped, so their original relative order is preserved. Stability is important when records have multiple fields, such as sorting students by grade while preserving earlier alphabetical order among equal grades. Bubble sort teaches that stability depends on the exact comparison rule, not just the broad algorithm name.`,
      ],
    },
    {
      heading: `Cost And Complexity`,
      paragraphs: [
        `Worst-case and average-case time are O(n squared). A reverse-sorted array forces about n times n - 1 over 2 comparisons and almost as many swaps. At 10 items, that is fine. At 10,000 items, it becomes roughly 50 million neighbor checks, which is not acceptable for a general-purpose sort.`,
        `The best case is O(n) only when the implementation keeps a swapped flag and the input is already sorted. Without that flag, even sorted input still goes through the full nested-loop pattern. Space is O(1). The tradeoff is clear: tiny memory, simple code, stable behavior, but far too many comparisons and writes for ordinary large arrays. Writes matter too, especially when swapping large records is expensive.`,
      ],
    },
    {
      heading: `Where It Wins`,
      paragraphs: [
        `Bubble sort wins as a learning tool. It is useful in classrooms, visualizers, interviews, and debugging exercises because each step has one obvious cause. If the current pair is inverted, swap. If not, continue. The invariant is visible after every pass, so students can practice proving correctness from state changes.`,
        `It can be acceptable for a handful of values when code size matters more than speed, but even then insertion sort is often better. Insertion sort also handles nearly sorted input well and usually performs fewer writes. Selection sort performs fewer swaps but is not naturally stable. Bubble sort's niche is clarity, not performance.`,
        `It also works well as a diagnostic contrast. When students see a nearly identical nested-loop shape in a different algorithm, they can ask what state is being preserved, how far elements can move per operation, and whether repeated local work is hiding a larger cost. That habit transfers to more serious algorithms.`,
      ],
    },
    {
      heading: `Failure Modes`,
      paragraphs: [
        `The biggest misconception is that the early-exit flag makes bubble sort generally practical. It only helps when the input is already sorted or close to sorted. Random input and reverse-sorted input still hit the quadratic wall. Another mistake is forgetting to shrink the unsorted boundary, which repeats comparisons against values already known to be final.`,
        `Do not confuse in-place with fast. Heap sort is in place and O(n log n), while bubble sort is in place and quadratic. Do not confuse stability with correctness either; a version that swaps equal values still sorts numerically, but it destroys stable ordering. Finally, do not use it as a benchmark for real library sorting, because production sorts are hybrid and heavily optimized.`,
      ],
    },
    {
      heading: `Study Next`,
      paragraphs: [
        `Study Insertion Sort and Selection Sort next to compare the three classic quadratic teaching sorts. They share the same broad O(n squared) worst case but spend their work differently: insertion shifts into a sorted prefix, selection chooses minimum values, and bubble repairs adjacent inversions.`,
        `Then move to Merge Sort, Quick Sort, and Heap Sort to see how O(n log n) algorithms escape the neighbor-swap wall. Big-O Growth Rates explains why the jump matters. Recursion prepares you for divide-and-conquer sorting. Stability in Sorting connects this page's equal-value rule to real records with multiple keys.`,
      ],
    },
  ],
};
