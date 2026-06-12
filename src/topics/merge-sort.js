// Merge sort: split in half, sort each half, merge the sorted halves.
// Guaranteed O(n log n), and stable — equal values keep their order.

import { arrayState, parseNumberList } from '../core/state.js';

export const topic = {
  id: 'merge-sort',
  title: 'Merge Sort',
  category: 'Sorting',
  summary: 'Divide and conquer: split, sort the halves, then merge them back together.',
  controls: [
    { id: 'values', label: 'Values', type: 'number-list', defaultValue: '8, 3, 8, 1, 9, 2, 5' },
  ],
  run,
};

const idsBetween = (lo, hi) =>
  Array.from({ length: hi - lo + 1 }, (_, k) => `i${lo + k}`);

export function* run(input) {
  const values = parseNumberList(input.values, { max: 10 });

  yield {
    state: arrayState(values),
    highlight: {},
    explanation: 'Merge sort\'s insight: merging two ALREADY-SORTED lists is easy — just keep taking the smaller front item. So: split the array until every piece is size 1 (trivially sorted), then merge upward.',
  };

  yield* mergeSort(values, 0, values.length - 1);

  yield {
    state: arrayState(values),
    highlight: { sorted: values.map((_, i) => `i${i}`) },
    explanation: `Sorted! The array was split log n times, and each level of merging touched all n elements once: O(n log n), guaranteed, no matter how hostile the input. That predictability is merge sort's brand.`,
  };
}

function* mergeSort(values, lo, hi) {
  if (lo >= hi) return; // a single element is already sorted

  const mid = Math.floor((lo + hi) / 2);
  yield {
    state: arrayState(values),
    highlight: { range: idsBetween(lo, hi), active: [`i${mid}`] },
    explanation: `Split positions ${lo}–${hi} into two halves: ${lo}–${mid} and ${mid + 1}–${hi}. Each half gets sorted on its own before we merge.`,
  };

  yield* mergeSort(values, lo, mid);
  yield* mergeSort(values, mid + 1, hi);
  yield* merge(values, lo, mid, hi);
}

function* merge(values, lo, mid, hi) {
  const left = values.slice(lo, mid + 1);
  const right = values.slice(mid + 1, hi + 1);
  let l = 0;
  let r = 0;

  for (let write = lo; write <= hi; write += 1) {
    let takeLeft;
    let why;
    if (l >= left.length) {
      takeLeft = false;
      why = `The left half is used up — copy the rest of the right half over.`;
    } else if (r >= right.length) {
      takeLeft = true;
      why = `The right half is used up — copy the rest of the left half over.`;
    } else if (left[l] <= right[r]) {
      // `<=` matters twice: equal values take from the LEFT (keeping the sort
      // stable), and the tie always makes progress (a strict `<` on both
      // sides is the classic bug that loops forever on duplicates).
      takeLeft = true;
      why = left[l] === right[r]
        ? `Both fronts are ${left[l]} — a tie. Take from the LEFT half: ties must still make progress (the classic merge bug loops forever here), and taking left keeps equal values in their original order, which is what "stable" means.`
        : `Compare the fronts: ${left[l]} vs ${right[r]}. The left's ${left[l]} is smaller, so it goes next.`;
    } else {
      takeLeft = false;
      why = `Compare the fronts: ${left[l]} vs ${right[r]}. The right's ${right[r]} is smaller, so it goes next.`;
    }

    values[write] = takeLeft ? left[l++] : right[r++];
    yield {
      state: arrayState(values),
      highlight: { range: idsBetween(lo, hi), active: [`i${write}`] },
      explanation: `Merging ${lo}–${hi}. ${why} Write ${values[write]} at position ${write}.`,
      invariant: 'Everything already written in this merge is in its final relative order.',
    };
  }

  yield {
    state: arrayState(values),
    highlight: { sorted: idsBetween(lo, hi) },
    explanation: `Positions ${lo}–${hi} are now one sorted run, ready to be merged with a neighbor at the level above.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        `Merge sort is the first algorithm that escapes the O(n²) wall. It uses divide-and-conquer: split the array in half recursively until each piece is a single element (trivially sorted), then merge pairs of sorted pieces back together into larger sorted pieces, layer by layer. The merge operation is cheap — it is linear in the size of the pieces — because both pieces are already sorted. Compare front elements, take the smaller, and repeat.`,
        `It is stable, meaning equal elements retain their original order. This is crucial in real applications where you might sort objects by one field, then re-sort by another field and expect ties to remain in the previous order. It is also predictable: O(n log n) worst, average, and best case. No pathological inputs exist.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Recursively divide the array into halves until you reach single elements. Then merge: take two sorted arrays (or sub-arrays), create an empty result, and repeatedly compare the front of each sorted piece, taking the smaller one and moving its pointer forward. When one piece runs out, copy the rest of the other piece over. The merge step is the heart of the algorithm and is where the sorting actually happens.`,
        `A subtle but crucial detail is the tie-breaking rule in merge: when both fronts are equal, take from the left half. This ensures the sort is stable and also prevents an infinite loop (the classic merge bug is taking from the wrong half on a tie, which can leave both pointers stuck). The merge touches every element exactly once, so merging two sorted arrays of size n is O(n). Since the array is split log n times, and each level merges all n elements once, the total cost is O(n log n).`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Merge sort guarantees O(n log n) comparisons in all cases: best, average, and worst. The array is split log n times (creating a recursion tree of depth log n), and at each level, all n elements are touched once during merging. Space complexity is O(n) because merge requires temporary arrays to hold the left and right halves during merging. This extra space is merge sort's main weakness — it is not in-place like Quicksort or Insertion Sort. On the flip side, the predictable O(n log n) and the stability make merge sort invaluable in practice.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Merge sort is the backbone of stable sorting in many languages and libraries. Python's Timsort uses merge sort as its core strategy, combining it with insertion sort for small ranges. Java's Arrays.sort uses a dual-pivot variant of quicksort, but merges are used for parallel sorting. C's qsort often uses merge sort for robustness. External-memory sorting (when data does not fit in RAM) relies heavily on merge sort because it processes data in sequential passes. Whenever you need a guaranteed O(n log n) sort or stability is mandatory, merge sort is a strong candidate.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `The biggest misconception is that O(n log n) is always better than O(n²). For small arrays (under 50 elements), Insertion Sort is often faster due to lower constants and better cache locality. Merge sort's overhead is only worth paying on larger arrays. Another pitfall is forgetting the space cost. Merge sort uses O(n) extra space, which matters on memory-constrained systems. Some implementations try to optimize away the copy by using in-place merging, but that destroys stability and adds complexity.`,
        `A subtle bug lurks in the tie-breaking rule during merge: using strict less-than ( < ) instead of less-or-equal ( <= ) on the comparison can cause infinite loops or incorrect results when duplicates exist. The code must take from the left half when values are equal to ensure both pointers advance and the sort remains stable.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Compare merge sort to Quick Sort to understand the trade-offs between guaranteed O(n log n) and average-case speed with lower constants. Study Heap Sort for another O(n log n) sort that uses O(1) space. Learn Recursion to understand the divide-and-conquer pattern that merge sort exemplifies. Explore Big-O Growth Rates to internalize why O(n log n) dominates O(n²) at scale. Finally, study Timsort (a hybrid of merge sort and insertion sort used in Python) to see how real-world libraries adapt these ideas.`,
      ],
    },
  ],
};

