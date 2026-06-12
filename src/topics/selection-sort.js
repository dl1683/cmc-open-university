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
      heading: `What it is`,
      paragraphs: [
        `Selection-style sorting repeatedly chooses the minimum remaining item and moves it into the next final position. The left side of the array is the sorted prefix; the right side is the unsorted suffix. Each round scans the whole suffix, remembers the smallest value seen, and swaps that value into the first suffix slot.`,
        `The algorithm's signature trade-off is simple: many comparisons, few writes. It always performs the same triangular scan pattern, even if the input is already sorted, but it makes at most n - 1 swaps. That is why it is a useful teaching contrast with Insertion Sort, which can do very few comparisons on nearly sorted input but may shift many cells.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Round k starts at index k. Set the current minimum index to k, then run a Linear Search over k + 1 through n - 1. Whenever a smaller value appears, update the minimum index. After the scan, swap the minimum into index k. Now index k is final because every remaining unsorted value is at least as large.`,
        `The invariant is exact: after k rounds, the first k positions contain the k smallest values in sorted order. The suffix may be chaotic. Unlike Bubble Sort, no value slowly travels one adjacent step at a time; the chosen minimum jumps directly into place. Unlike Quick Sort, there is no pivot and no recursive split.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The comparison count is fixed: (n - 1) + (n - 2) + ... + 1 = n(n - 1) / 2. Best, average, and worst cases are all O(n^2). Extra space is O(1). Swap count is at most n - 1, though not always mathematically minimal for a particular permutation; cycle sort is the write-minimizing specialist.`,
        `For 10,000 items, about 49,995,000 comparisons happen whether the data is sorted or random. Big-O Growth Rates makes the consequence visible: an O(n log n) method does orders of magnitude less comparison work at that size.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `The full algorithm is rare in production sorting libraries, but the selection pattern appears in partial sorting. If you need the 10 smallest items from a 1,000-item list and do not want another data structure, 10 rounds cost about 10,000 comparisons instead of a full sort. For larger k, a Binary Heap (Priority Queue) or quickselect-style partitioning is usually better.`,
        `Write-limited media is the historical niche. If moving records is far more expensive than comparing them, the low swap count can matter. On normal RAM-backed workloads, Merge Sort, Quick Sort, and Heap Sort dominate because comparison count and locality matter more.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Fewer swaps do not automatically mean faster. Comparisons dominate here, and every pass scans the suffix regardless of whether anything changes. Another misconception is stability. The normal swap-based version is not stable because a later minimum can leap in front of equal records. A stable variant exists, but it shifts values instead of swapping and loses the write-count advantage.`,
        `Do not confuse this with quickselect. Quickselect uses partitioning related to Quick Sort and only recurses on the side that can contain the desired rank, giving O(n) average time for one order statistic. This algorithm is a full sort unless you deliberately stop after k rounds.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Compare Insertion Sort and Bubble Sort to understand nearby O(n^2) trade-offs. Then study Merge Sort, Quick Sort, and Heap Sort to see how general sorting escapes quadratic comparisons. Big-O Growth Rates gives the scale picture, and Binary Heap (Priority Queue) shows a better tool for repeated minimum or maximum selection.`,
      ],
    },
  ],
};
