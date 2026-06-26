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
        'The array is split by a boundary. Everything left of the boundary is sorted, final, and never moves again; everything at or to the right is still unsorted work.',
        'In each round, the scan walks the unsorted suffix and keeps one minimum candidate. When a smaller value appears, the candidate marker moves; when the scan ends, one swap puts that candidate at the boundary.',
        'Read active state as the current comparison, found state as the current minimum, and the boundary as the proof line. The safe inference is: after a full scan of the suffix, no unseen smaller value exists, so the chosen value belongs in the next final slot.',
        {type: 'callout', text: 'Selection sort trades adaptability for a hard write bound: every round proves one final slot with one scan and at most one swap.'},
      
        {type: 'image', src: './assets/gifs/selection-sort.gif', alt: 'Animated walkthrough of the selection sort visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Selection sort is the plainest form of sorting by repeated choice. Sorting means arranging values by order; selection means finding the next value that belongs in the next position.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/9/94/Selection-Sort-Animation.gif', alt: 'Animated selection sort moving the smallest remaining value into the sorted prefix', caption: 'Selection sort makes the sorted prefix grow one confirmed value at a time. Source: Wikimedia Commons, Joestape89, CC BY-SA 3.0 and GFDL.'},
        'The algorithm is useful to study because its invariant is visible. After each round, the prefix contains exactly the smallest values seen so far, in final order.',
        'It also shows a real engineering tradeoff. Selection sort spends many comparisons, but it performs at most one swap per round, so it can be attractive when writes are more expensive than reads.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'A reasonable first idea is to find the smallest item, put it first, then repeat on the rest. For input [29, 10, 14, 37, 13], the first scan finds 10 and swaps it into index 0.',
        'This idea is not a shortcut around selection sort. It is selection sort. The algorithm asks one simple question per position: which remaining value belongs here?',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The smallest value in an unsorted suffix can be anywhere. Unless another structure already knows the order, the only proof that a candidate is smallest is checking every other remaining value.',
        'That makes the scan unavoidable in each round. An already sorted array, a reverse sorted array, and a nearly sorted array all take the same comparison count because selection sort cannot exploit existing order.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Selection sort keeps one strong invariant: the prefix is final. It does not try to improve the suffix, remember local inversions, or stop early when the data looks ordered.',
        'That narrow promise explains both the simplicity and the cost. The algorithm proves one slot at a time, then forgets everything except the new boundary.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For each index i from 0 to n - 2, set minIndex to i. Scan indices i + 1 through n - 1; if values[j] is smaller than values[minIndex], update minIndex.',
        'After the scan, swap values[i] with values[minIndex] unless they are already the same slot. Then move i one step right and repeat.',
        'The suffix is allowed to be messy after the swap. Selection sort only promises that the prefix is correct, so it rebuilds the minimum proof from scratch in the next round.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Use the invariant: after round i finishes, indices 0 through i contain the i + 1 smallest original values in sorted order. Before any round, the empty prefix satisfies the invariant.',
        'Assume the prefix before index i is already correct. The full suffix scan finds the smallest value not yet placed, so that value must be the next smallest overall and belongs at index i.',
        'The swap cannot disturb earlier positions because it only touches index i and one suffix index. After n - 1 rounds, every position except the last is final, and the last remaining value must be the largest.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Selection sort always makes n(n - 1) / 2 comparisons. For 1,000 values, that is 499,500 comparisons; for 10,000 values, it is 49,995,000. Doubling n roughly quadruples comparison work.',
        'The write cost is small: at most n - 1 swaps, and some rounds swap nothing. Space is O(1) because the algorithm stores only indices and one temporary value.',
        'The standard swap-based version is not stable. Sorting [(A,2), (B,2), (C,1)] by the number can move C before A and B by swapping with A, which changes the relative order of equal keys A and B.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Selection sort can be reasonable for tiny arrays where simple code matters more than asymptotic speed. It also appears inside teaching material because the invariant is easy to see and prove.',
        'Its practical niche is low-write sorting. On storage where writes wear hardware or move large records, the at-most-one-swap-per-round behavior can matter more than saving comparisons.',
        'Partial selection is another use. If you only need the k smallest values, run k rounds and stop; this costs O(kn), which is acceptable for small k but loses to heaps or quickselect as k grows.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Selection sort fails on ordinary large arrays because O(n^2) comparisons dominate. Merge sort, heap sort, quicksort, and timsort reach O(n log n) behavior for general sorting workloads.',
        'It also fails on nearly sorted data. Insertion sort can finish close to O(n) when most values are already in order, while selection sort still rescans every suffix.',
        'It is the wrong default when stability matters. Stable selection sort is possible by shifting instead of swapping, but that increases writes and loses the algorithm\'s main practical advantage.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Input: [29, 10, 14, 37, 13]. There are five values, so selection sort runs four rounds and always makes 4 + 3 + 2 + 1 = 10 comparisons.',
        'Round 1 scans all five positions. The minimum is 10 at index 1, so swapping indices 0 and 1 gives [10, 29, 14, 37, 13].',
        'Round 2 scans indices 1 through 4. The minimum is 13 at index 4, so swapping gives [10, 13, 14, 37, 29]. Round 3 finds 14 already at index 2, so no swap occurs.',
        'Round 4 compares 37 and 29, then swaps them to get [10, 13, 14, 29, 37]. The total is 10 comparisons and 3 swaps; a sorted five-element input would still use 10 comparisons but 0 swaps.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'A standard reference is Knuth, The Art of Computer Programming, Volume 3: Sorting and Searching, Section 5.2.3. The algorithm is also covered in most introductory algorithms texts because its invariant is compact.',
        'Study insertion sort next to see an adaptive O(n^2) sort. Then compare heap sort, which keeps the repeated-selection idea but uses a heap so each extraction costs O(log n), and cycle sort, which pushes write minimization further.',
      ],
    },
  ],
};
