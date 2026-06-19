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
      heading: 'How to read the animation',
      paragraphs: [
        'The array is divided by a moving boundary. Everything left of the boundary is sorted and final. Everything to the right is unsorted.',
        'Each round, a scan sweeps the unsorted zone from left to right. The highlighted element is the current minimum candidate. When the scan finds something smaller, the candidate marker jumps. After the scan finishes, one swap moves the winner to the boundary, and the boundary advances one position.',
        'Watch three things: the scan always visits every unsorted element (no early exit), each round produces at most one swap, and no element left of the boundary ever moves again.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Sorting can be framed as repeated selection: which value belongs in position 0? Find it, place it, move on to position 1. Selection sort is the simplest algorithm built on that idea.',
        'Its distinguishing property is write efficiency. Each round performs at most one swap, so an n-element array is sorted with at most n-1 swaps. That is the minimum number of swaps any sort can guarantee. When writes are expensive -- flash memory, EEPROM, large records on slow storage -- that matters.',
        'Selection sort also serves as the clearest teaching example for loop invariants. The sorted prefix is not just locally ordered; it contains the globally correct values in their final positions. That strong invariant makes correctness easy to prove and easy to see in the animation.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Scan the entire array for the smallest value. Swap it into position 0. Now scan positions 1 through n-1 for the next smallest. Swap it into position 1. Repeat for each position up to n-2. The last remaining element is automatically the largest.',
        'This is not a simplification of selection sort; it is selection sort. The algorithm is its own obvious approach. The interesting question is not how to improve the approach but what it costs and whether that cost is acceptable.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The minimum of an unsorted collection could be anywhere. Without auxiliary structure, the only proof that a value is the minimum is checking every other value. That forces the inner loop to run to completion every round.',
        'Round 1 does n-1 comparisons. Round 2 does n-2. The total is n(n-1)/2 comparisons regardless of input order. Already sorted? Same cost. Reverse sorted? Same cost. Nearly sorted with one element out of place? Same cost. Selection sort cannot adapt because it has no mechanism to learn anything about the suffix except by exhaustive scan.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For each position i from 0 to n-2: set minIndex = i. Scan positions i+1 through n-1, updating minIndex whenever a smaller value appears. After the scan, if minIndex differs from i, swap values[i] and values[minIndex]. Position i is now final.',
        'The inner loop always runs to completion. There is no condition that allows early termination, because the minimum could be the very last element checked. This is the structural reason the comparison count is fixed.',
        'The suffix may become messier after each swap. That is fine. Selection sort does not maintain any order in the suffix. It rebuilds the needed knowledge (which value is smallest) from scratch every round.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Loop invariant: after round i completes, positions 0 through i contain the i+1 smallest elements of the original array, in sorted order, in their final positions.',
        'Base case: before round 0, the prefix is empty, and the invariant holds vacuously. Inductive step: assume positions 0 through i-1 are correct. Round i scans every element outside that prefix and finds the smallest. That value must be the (i+1)th smallest overall, because all smaller values are already placed. Swapping it into position i extends the correct prefix by one.',
        'The swap touches only position i and one suffix position, so it cannot disturb the prefix. After n-1 rounds, n-1 positions are finalized. The lone remaining element is the largest, so the full array is sorted.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Comparisons: always n(n-1)/2, which is O(n^2). For 1,000 elements: 499,500 comparisons. For 10,000: 49,995,000. Doubling the input quadruples the work. Best, average, and worst cases are identical.',
        'Swaps: at most n-1 (one per round), which is O(n). This is the minimum number of swaps any sorting algorithm can guarantee. Some rounds need zero swaps if the minimum is already in position.',
        'Space: O(1). Only a few index variables and one temporary for swapping.',
        'Stability: selection sort is NOT stable. A swap can jump an element over other elements with equal keys. Example: sort [(A,2), (B,2), (C,1)] by the number. The scan finds C,1 as the minimum and swaps it with A,2, producing [(C,1), (B,2), (A,2)]. Now A and B -- originally in order A then B -- appear as B then A. The long-distance swap destroyed their relative order. Making selection sort stable requires shifting instead of swapping, which costs O(n) writes per round and defeats the low-write advantage.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'When writes are expensive and the array is small. Flash memory and EEPROM have limited write cycles, so minimizing swaps directly extends hardware lifetime. Selection sort guarantees at most n-1 writes to the array.',
        'As a teaching tool. The invariant is exact, visible, and easy to prove. Students can connect the loop structure to the correctness argument without any hidden cleverness.',
        'For partial selection. If you only need the k smallest elements, run k rounds and stop. Each round is O(n), so extracting a fixed k costs O(kn). For small k this beats a full sort, though a heap or quickselect is better as k grows.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'On any array larger than a few dozen elements, the fixed O(n^2) comparison count dominates. Insertion sort is better on nearly-sorted data because it can finish in O(n). Merge sort, quicksort, and heap sort escape to O(n log n) for general data.',
        'Selection sort is not adaptive. An already-sorted array gets the same n(n-1)/2 comparisons as a shuffled one. Insertion sort, timsort, and natural merge sort all exploit existing order.',
        'It is not stable. If you need to sort records by one key while preserving the original order of ties, standard selection sort breaks that guarantee. Insertion sort and merge sort are stable without modification.',
        'If minimizing writes is the true goal, cycle sort achieves the theoretical minimum of writes (each element is written at most once to its final position), though it is harder to implement.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Input: [29, 10, 14, 37, 13]. Five elements, so four rounds.',
        'Round 1: scan positions 0-4. Start with 29 as candidate. 10 < 29, new min. 14 > 10, skip. 37 > 10, skip. 13 > 10, skip. Minimum is 10 at index 1. Swap positions 0 and 1. Array: [10, 29, 14, 37, 13]. Comparisons: 4.',
        'Round 2: scan positions 1-4. Start with 29. 14 < 29, new min. 37 > 14, skip. 13 < 14, new min. Minimum is 13 at index 4. Swap positions 1 and 4. Array: [10, 13, 14, 37, 29]. Comparisons: 3.',
        'Round 3: scan positions 2-4. Start with 14. 37 > 14, skip. 29 > 14, skip. Minimum is 14 at index 2 -- already in place, no swap. Array: [10, 13, 14, 37, 29]. Comparisons: 2.',
        'Round 4: scan positions 3-4. Start with 37. 29 < 37, new min. Minimum is 29 at index 4. Swap positions 3 and 4. Array: [10, 13, 14, 29, 37]. Comparisons: 1.',
        'Total: 10 comparisons (always 5*4/2 = 10), 3 swaps. On the same array already sorted, the comparison count is still 10 but swaps drop to 0.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Knuth, The Art of Computer Programming, Vol. 3: Sorting and Searching (1998), Section 5.2.3.',
        'Insertion sort: the adaptive O(n^2) alternative that runs near O(n) on nearly-sorted input. Bubble sort: the swap-heavy neighbor-comparison sort, useful for comparison. Heap sort: selection sort backed by a heap, bringing repeated extraction down to O(log n) per round and O(n log n) overall. Quicksort: the divide-and-conquer sort that dominates in practice. Cycle sort: the write-minimizing specialist.',
      ],
    },
  ],
};
