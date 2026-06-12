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
      heading: 'What it is',
      paragraphs: [
        `Selection sort divides the array into a sorted prefix (left) and an unsorted suffix (right). In each round, scan the entire unsorted region to find the smallest element, then swap it to the front of that region. The sorted prefix grows by one. Repeat until the whole array is sorted. It is the algorithm of choice when swaps are expensive or rare — selection sort guarantees at most n−1 swaps, no matter the input.`,
        `The name captures the algorithm: you repeatedly select the minimum from the unsorted portion and move it into position. It is not adaptive to input shape — it always does the same amount of work, which simplifies reasoning but removes opportunities for speed-up on friendly data.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Start with the entire array unsorted. Scan from position 0 to the end, tracking the index of the smallest value seen. When the scan finishes, swap that minimum into position 0. Now position 0 is sorted and will never move again. Repeat on the remaining array, starting at position 1, finding its minimum, and swapping into position 1. Continue until the unsorted suffix shrinks to a single element (which is trivially sorted).`,
        `The key invariant is that after k rounds, positions 0 through k−1 hold the k smallest values in their final sorted positions. The scan always covers the entire unsorted region because the minimum could be anywhere — there is no early-exit opportunity like insertion sort offers on nearly-sorted data. Every input requires n−1 passes, each covering a shrinking suffix.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Selection sort makes exactly n(n−1)/2 comparisons, regardless of input. Best, average, and worst cases are all O(n²). It makes at most n−1 swaps, which is the absolute minimum needed to rearrange an array. Space complexity is O(1) — sorts in place with only index counters. Selection sort's great strength is its write-minimal behavior: if your data lives on slow storage or swaps are expensive, selection sort's O(1) swaps beat insertion sort's O(n²) worst-case swaps. On modern hardware with fast memory, that advantage evaporates.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Selection sort is rarely the right choice in modern systems. It is occasionally used in embedded systems or external-memory sorting (where swapping to disk is painfully expensive), but even then, better algorithms like Merge Sort or Quicksort dominate. One niche where selection sort shines is when you only need the k smallest elements — early termination after k rounds gives you that in O(n·k) time. For finding the k-th smallest element, a dedicated selection algorithm (like quickselect) is far better, but selection sort can get you there if k is small.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `A common misconception is that fewer swaps make selection sort faster. Swap count does not dominate runtime on modern machines. Cache locality, instruction-level parallelism, and memory bandwidth matter more. Insertion sort, with its sequential memory access patterns, often beats selection sort in practice despite making more swaps.`,
        `Another pitfall is confusing selection sort with quickselect (the algorithm that finds the k-th smallest element in O(n) average time). They both "select" a value, but quickselect uses a different strategy: partitioning around a pivot and recursing on one side. Selection sort is a full sort; quickselect solves a different, simpler problem.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Compare selection sort to Insertion Sort to see the trade-off between swaps and shifts. Then study Merge Sort and Quick Sort to escape the O(n²) ceiling entirely. Understand Big-O Growth Rates to feel why O(n²) is unacceptable at scale. Finally, explore Quickselect, which solves the related but different problem of finding the k-th smallest element in linear average time.`,
      ],
    },
  ],
};

