// Quick sort with Lomuto partitioning: pick a pivot, move everything
// smaller to its left, recurse on both sides. In place and fast in practice.

import { arrayState, parseNumberList } from '../core/state.js';

export const topic = {
  id: 'quick-sort',
  title: 'Quick Sort',
  category: 'Sorting',
  summary: 'Partition the array around a pivot, then sort each side independently.',
  controls: [
    { id: 'values', label: 'Values', type: 'number-list', defaultValue: '15, 5, 1, 10, 5, 7, 12' },
  ],
  run,
};

const idsBetween = (lo, hi) =>
  Array.from({ length: Math.max(0, hi - lo + 1) }, (_, k) => `i${lo + k}`);

export function* run(input) {
  const values = parseNumberList(input.values, { max: 10 });
  const done = new Set(); // positions that are provably final

  yield {
    state: arrayState(values),
    highlight: {},
    explanation: 'Quick sort picks a PIVOT, then partitions: everything ≤ pivot to its left, everything greater to its right. After that, the pivot is in its final spot forever — and each side is a smaller copy of the same problem.',
  };

  yield* quickSort(values, 0, values.length - 1, done);

  yield {
    state: arrayState(values),
    highlight: { sorted: values.map((_, i) => `i${i}`) },
    explanation: 'Sorted! On average each partition splits the range roughly in half → O(n log n), in place, with tight inner loops — which is why real-world libraries reach for quick sort. (A consistently terrible pivot degrades it to O(n²); real implementations pick pivots more cleverly.)',
  };
}

function* quickSort(values, lo, hi, done) {
  if (lo > hi) return;
  if (lo === hi) {
    done.add(lo);
    yield {
      state: arrayState(values),
      highlight: { sorted: [...done].map((i) => `i${i}`) },
      explanation: `Position ${lo} holds a range of one (${values[lo]}) — nothing to compare it with, so it is already sorted.`,
    };
    return;
  }

  const pivot = values[hi];
  yield {
    state: arrayState(values),
    highlight: { range: idsBetween(lo, hi), pivot: [`i${hi}`], sorted: [...done].map((i) => `i${i}`) },
    explanation: `Sort positions ${lo}–${hi}. Choose the last element, ${pivot}, as the pivot. Goal: everything ≤ ${pivot} on the left, everything bigger on the right.`,
  };

  // Lomuto partition: `boundary` is the first slot of the "greater than pivot" zone.
  let boundary = lo;
  for (let i = lo; i < hi; i += 1) {
    const belongsLeft = values[i] <= pivot;
    yield {
      state: arrayState(values),
      highlight: { range: idsBetween(lo, hi), pivot: [`i${hi}`], compare: [`i${i}`], active: [`i${boundary}`], sorted: [...done].map((p) => `i${p}`) },
      explanation: `Is ${values[i]} ≤ pivot ${pivot}? ${belongsLeft ? `Yes — it belongs in the left zone, so it swaps to the boundary (position ${boundary}).` : 'No — it can stay where it is; the boundary does not move.'}`,
      invariant: `Everything before position ${boundary} is ≤ ${pivot}; everything from ${boundary} to ${i} is > ${pivot}.`,
    };
    if (belongsLeft) {
      if (i !== boundary) {
        [values[i], values[boundary]] = [values[boundary], values[i]];
        yield {
          state: arrayState(values),
          highlight: { range: idsBetween(lo, hi), pivot: [`i${hi}`], swap: [`i${i}`, `i${boundary}`], sorted: [...done].map((p) => `i${p}`) },
          explanation: `Swap ${values[boundary]} into the left zone. The boundary advances to position ${boundary + 1}.`,
        };
      }
      boundary += 1;
    }
  }

  [values[hi], values[boundary]] = [values[boundary], values[hi]];
  done.add(boundary);
  yield {
    state: arrayState(values),
    highlight: { swap: [`i${boundary}`, `i${hi}`], sorted: [...done].map((i) => `i${i}`), range: idsBetween(lo, hi) },
    explanation: `Finally, swap the pivot onto the boundary: ${pivot} lands at position ${boundary} with everything ≤ it on the left and everything bigger on the right. Position ${boundary} is FINAL — quick sort never touches it again.`,
  };

  yield* quickSort(values, lo, boundary - 1, done);
  yield* quickSort(values, boundary + 1, hi, done);
}
