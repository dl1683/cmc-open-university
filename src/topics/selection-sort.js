// Selection sort: scan the unsorted zone for its minimum, swap it to the
// front, repeat. Minimum swaps, maximum scanning.

import { arrayState, parseNumberList } from '../core/state.js';

export const topic = {
  id: 'selection-sort',
  title: 'Selection Sort',
  category: 'Sorting',
  summary: 'Repeatedly select the smallest remaining value and swap it into place.',
  controls: [
    { id: 'values', label: 'Values', type: 'number-list', defaultValue: '6, 11, 3, 9, 2, 8' },
  ],
  run,
};

const prefixIds = (count) => Array.from({ length: count }, (_, i) => `i${i}`);

export function* run(input) {
  const values = parseNumberList(input.values, { max: 10 });

  yield {
    state: arrayState(values),
    highlight: {},
    explanation: 'Selection sort asks one question per round: "what is the SMALLEST value left?" — then swaps it to the front of the unsorted zone. Sorted prefix grows by exactly one per round, with at most one swap each.',
  };

  for (let start = 0; start < values.length - 1; start += 1) {
    let minIndex = start;
    yield {
      state: arrayState(values),
      highlight: { active: [`i${start}`], sorted: prefixIds(start) },
      explanation: `Round ${start + 1}: find the minimum of positions ${start}–${values.length - 1}. Current candidate: ${values[minIndex]}.`,
      invariant: `Positions 0–${start - 1 >= 0 ? start - 1 : 0} hold the ${start === 0 ? 'final' : start + ' smallest values in final'} order.`,
    };

    for (let i = start + 1; i < values.length; i += 1) {
      const smaller = values[i] < values[minIndex];
      yield {
        state: arrayState(values),
        highlight: { compare: [`i${i}`], active: [`i${minIndex}`], sorted: prefixIds(start) },
        explanation: `Is ${values[i]} smaller than the current minimum ${values[minIndex]}? ${smaller ? 'Yes — new minimum.' : 'No — keep scanning.'} (Note: we must scan EVERYTHING; the minimum could be anywhere.)`,
      };
      if (smaller) minIndex = i;
    }

    if (minIndex !== start) {
      [values[start], values[minIndex]] = [values[minIndex], values[start]];
      yield {
        state: arrayState(values),
        highlight: { swap: [`i${start}`, `i${minIndex}`], sorted: prefixIds(start) },
        explanation: `Swap the minimum ${values[start]} into position ${start} — one single swap per round, which matters when swaps are expensive (think huge records).`,
      };
    }
    yield {
      state: arrayState(values),
      highlight: { sorted: prefixIds(start + 1) },
      explanation: `Position ${start} is final: ${values[start]} is the ${start + 1}${['st', 'nd', 'rd'][start] ?? 'th'} smallest value. The unsorted zone shrinks by one.`,
    };
  }

  yield {
    state: arrayState(values),
    highlight: { sorted: prefixIds(values.length) },
    explanation: `Sorted! Selection sort ALWAYS does ~n²/2 comparisons — even on sorted input — but at most n−1 swaps. Compare with insertion sort: opposite trade-off. Neither escapes O(n²); for that you need divide and conquer.`,
  };
}

export const article = {
  sections: [
    {
      heading: `Why this exists`,
      paragraphs: [
        `Selection sort exists because sorting can be framed as repeated selection. Instead of fixing local disorder, the algorithm asks a global question each round: which remaining value belongs next in the final order? Once it finds that value, it moves it into the next open position and never revisits that position.`,
        `That shape makes selection sort one of the cleanest algorithms for learning invariants. There is a sorted prefix on the left, an unsorted suffix on the right, and a scan that chooses the smallest value in the suffix. The prefix grows by exactly one item per round. The suffix shrinks by exactly one item per round. The algorithm trades a lot of comparisons for very few writes.`,
        `This tradeoff is the reason selection sort is still worth studying even though it is rarely the right production sort. It shows how an algorithm can be simple, correct, in-place, and still inefficient at scale. It also teaches the selection pattern that later appears in heaps, priority queues, partial sorting, top-k queries, and selection algorithms such as quickselect.`,
      ],
    },
    {
      heading: `The obvious approach and its wall`,
      paragraphs: [
        `The obvious way to sort by hand is to look for anything out of order and swap it. Bubble sort formalizes that local approach: compare neighbors and move large values rightward one step at a time. Insertion sort uses a different local idea: take the next value and insert it into the sorted prefix by shifting larger values. Both approaches can move the same record many times.`,
        `Selection sort avoids that repeated movement. It separates decision from placement. First scan the entire unsorted suffix to make a decision. Then perform at most one swap. If swapping records is expensive because each record is large, stored on slow memory, or tied to external writes, that low-write behavior can matter.`,
        `The wall is that selection sort has no shortcut for finding the minimum. Without an extra data structure, the smallest value in the suffix could be at the start, the end, or anywhere between. The algorithm must inspect every remaining value to prove which one is smallest. That proof is what forces the triangular comparison count.`,
      ],
    },
    {
      heading: `Core invariant`,
      paragraphs: [
        `After k completed rounds, positions 0 through k - 1 contain the k smallest values of the original array in sorted order. Those positions are final. The suffix contains every value not yet selected, and its internal order does not matter.`,
        `This invariant is stronger than saying the left side is sorted. A prefix can be sorted and still wrong if it contains values that do not belong there yet. Selection sort's prefix is globally correct. It holds the values that must appear first in the final array, not merely values that happen to be locally ordered.`,
        `The algorithm depends on that distinction. Once the first k positions contain the k smallest values, the next position must receive the smallest value among the remaining suffix. No value already fixed in the prefix can be displaced by a later scan. No value left in the suffix can belong before the whole prefix. That is why each round can focus only on the suffix.`,
      ],
    },
    {
      heading: `Mechanism step by step`,
      paragraphs: [
        `Round k starts at index k. Treat values[k] as the current minimum and remember its index. Scan positions k + 1 through n - 1. Whenever a smaller value appears, update the remembered minimum index. When the scan ends, swap the minimum into position k if it is not already there.`,
        `On 6, 11, 3, 9, 2, 8, the first round scans the whole array and finds 2 at index 4. One swap places 2 at index 0 and moves 6 into the suffix. The next round scans 11, 3, 9, 6, 8 and finds 3. One swap places 3 at index 1. The prefix is now 2, 3, and it is final.`,
        `The suffix may become less tidy after a swap. That is acceptable. Selection sort does not try to maintain a sorted suffix, a heap, or a partition. It only needs the next minimum each round. The state it protects is the prefix, and the scan rebuilds enough knowledge about the suffix from scratch every time.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `The correctness proof is an induction over the prefix length. Before the first round, the prefix is empty, so the invariant is true. Assume the first k positions already contain the k smallest values in sorted order. The scan examines every value outside that prefix and finds the smallest remaining value.`,
        `That selected value must be the next value in the final sorted order. If a smaller value existed, it would either already be in the prefix or it would have been found by the scan. Swapping the selected value into position k therefore extends the prefix from k correct values to k + 1 correct values.`,
        `The swap cannot break the earlier prefix because it touches only position k and one suffix position. After n - 1 rounds, all but the last position are final. The last remaining value must be the largest remaining value, so the whole array is sorted. The proof is simple because the invariant is exact.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `The comparison count is fixed: (n - 1) + (n - 2) + ... + 1, which is n(n - 1) / 2. Sorted input, random input, reverse-sorted input, and nearly sorted input all pay that comparison cost. Best, average, and worst cases are all O(n^2) comparisons.`,
        `The write count is low. Each round performs at most one swap, so there are at most n - 1 swaps. If the minimum is already at the front of the suffix, that round performs no swap. Extra space is O(1), because the algorithm only stores a few indices and temporary values for swapping.`,
        `For 10,000 items, selection sort performs 49,995,000 comparisons even if the input is already sorted. Doubling the input roughly quadruples the comparisons. This is the scale lesson: a small, simple algorithm can be fine for a classroom list and unusable for a large production array.`,
      ],
    },
    {
      heading: `Stability and duplicates`,
      paragraphs: [
        `The usual swap-based selection sort is not stable. Stability means equal keys keep their original relative order. Suppose two records have the same score but different names. A later minimum with a smaller score can be swapped in front of one equal record and carry another record backward, changing the order of equal keys as a side effect.`,
        `You can make selection sort stable by removing the minimum from the suffix and shifting the intervening values right instead of swapping. That preserves relative order, but it gives up the low-write property. The stable version may perform many writes per round, which moves it closer to insertion sort behavior while keeping the same O(n^2) comparison count.`,
        `This is a useful design lesson. Algorithm names often hide variants. When someone says selection sort, ask which property matters: few swaps, in-place memory use, stability, predictable comparison count, or teaching clarity. You usually cannot maximize all of them at once.`,
      ],
    },
    {
      heading: `Implementation guidance`,
      paragraphs: [
        `Use index variables, not sliced arrays, if the goal is the classic in-place algorithm. The outer index marks the first unsorted position. The inner scan searches the suffix. The minimum index is updated only when a strictly smaller value appears. Using a strict comparison instead of less-than-or-equal avoids unnecessary movement of equal values, though it does not make the swap-based algorithm fully stable.`,
        `Guard the input size. Selection sort is fine for tiny lists, demonstrations, fixed-size embedded tables, or environments where predictable memory use is more important than speed. It should not be the default sort for user-sized data. Most languages provide optimized hybrid sorts that handle real workloads better and preserve important edge behavior such as stability where promised.`,
        `Be clear about the comparison function. Sorting numbers is simple, but real records need a key extractor or comparator. If comparing keys is expensive, selection sort's fixed comparison count becomes even more costly. If swapping records is expensive, consider swapping indices or references instead of whole records, or use a data structure designed around the real cost model.`,
      ],
    },
    {
      heading: `Where it wins`,
      paragraphs: [
        `Selection sort wins as a teaching tool because its invariant is exact and visible: the prefix is final. It gives students a clear way to connect a loop invariant, a scan, a swap, and a correctness proof. It also exposes the difference between comparison cost and write cost, which many first sorting examples blur together.`,
        `It can also win in narrow practical cases where writes are much more expensive than comparisons and the input is small enough that O(n^2) comparisons are acceptable. Examples include tiny arrays of large records, simple firmware routines, or educational visualizers where predictable behavior matters more than raw speed.`,
        `The selection pattern is useful for partial sorting. If you need the 5 smallest items from a 100-item list and do not want another structure, five rounds are simple and bounded. As k grows, a heap, quickselect-style partition, or full O(n log n) sort usually becomes the better tool.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `Selection sort fails on large arrays because it cannot adapt to existing order. An already sorted array still triggers the full triangular scan. That makes it worse than insertion sort on nearly sorted data and worse than O(n log n) algorithms on general data.`,
        `It also fails when stability is required and the low-write property matters. The normal version is not stable, while the stable version performs shifts. If a library promises stable sorting of records by key, ordinary selection sort is usually the wrong foundation.`,
        `Fewer swaps also do not guarantee the fewest possible writes for a given permutation. Cycle sort is the specialist when minimizing writes is the main goal. Heap sort is the better selection-shaped algorithm when the input is large and repeated minimum or maximum extraction should be faster than scanning the suffix every time.`,
      ],
    },
    {
      heading: `Concrete example`,
      paragraphs: [
        `Imagine a tiny embedded table with six calibration values stored in memory where writes are slow and the table is sorted only during setup. Comparisons are cheap. Code size matters. The one-swap-per-round behavior can be acceptable, and the implementation is easy to audit.`,
        `Change the constraint to 100,000 values in RAM and the answer changes. The comparison count dominates, and quicksort, merge sort, heap sort, timsort, or another hybrid library sort is the right family. The same algorithmic idea that felt tidy on six values becomes the bottleneck at scale.`,
        `Now change the task again: find the three cheapest offers from a list of twenty. Three selection rounds may be enough, especially if the code path is not hot. If the list grows to millions of offers or the query runs continuously, build a heap, maintain an index, or use a selection algorithm that avoids sorting more than necessary.`,
      ],
    },
    {
      heading: `Common mistakes`,
      paragraphs: [
        `Do not stop the inner scan early because the suffix looks locally ordered. Selection sort has no proof until it has checked the whole suffix. Do not update the minimum value but forget the minimum index; the swap needs the position. Do not mark a position final before the swap, because the candidate may still be sitting somewhere else in the suffix.`,
        `Watch the bounds. The outer loop only needs to run through n - 2 because the final remaining value is automatically placed. The inner loop starts at start + 1 because start is already the initial candidate. Off-by-one errors often either skip the last value or compare the candidate against itself without harm but with confusing traces.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study insertion sort to see an adaptive O(n^2) algorithm that can run near O(n) on almost sorted input. Study bubble sort to compare adjacent-swap behavior. Then study merge sort, quicksort, and heap sort to see how general sorting escapes quadratic comparisons. Big-O growth rates gives the scale picture, and binary heap shows the data structure that turns repeated selection into faster repeated extraction.`,
      ],
    },
  ],
};
