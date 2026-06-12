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
