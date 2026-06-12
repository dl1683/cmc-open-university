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

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Quicksort is the classic in-place divide-and-conquer sort: choose a pivot, partition the array so lower values land on one side and higher values on the other, then repeat on the two smaller ranges. Tony Hoare published it in 1961, and the reason it survived is not just the O(n log n) average case. Its partition loop walks memory mostly left to right, uses few writes, and keeps the hot working set inside CPU cache.`,
        `The pivot becomes final after one partition. The two sides are not fully sorted yet; they are merely safe to solve independently. Compared with Merge Sort, this usually saves the extra O(n) merge buffer. Compared with Heap Sort, it usually has better locality. Compared with Insertion Sort, it wins once ranges stop being tiny. Production libraries often use hybrids: C++ sort is usually introsort, Java primitive arrays use dual-pivot quicksort, and small subarrays often finish with insertion-style cleanup.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `This visualization uses Lomuto partitioning. Pick the last item as the pivot. Keep a boundary marking the first position of the greater-than-pivot zone. Scan left to right; when a value belongs on the low side, swap it with the boundary and advance the boundary. At the end, swap the pivot into the boundary. The invariant is precise: values before the boundary are <= pivot, values between boundary and the scan cursor are > pivot, and the unscanned suffix is unknown.`,
        `Hoare's original partition uses Two Pointers moving inward from both ends and often makes fewer swaps, but Lomuto is easier to teach because it has one moving frontier. After partitioning, Recursion solves the left and right ranges. Real implementations avoid recursive overhead on small ranges, pick pivots by median-of-three or sampling, and switch to Heap Sort if recursion becomes too deep.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Each partition scans its range once. If pivots split roughly in half, there are about log2 n levels, so the total work is O(n log n). If the pivot is always the smallest or largest value, the recursion depth becomes n and the work becomes O(n^2). A sorted array is therefore bad for the naive last-pivot version shown here.`,
        `Average stack space is O(log n), but worst-case stack space is O(n) unless the implementation recurses on the smaller side first or uses an explicit stack. The Big-O Growth Rates lesson explains why O(n log n) is the comparison-sort target: comparison sorting cannot beat that bound in the general case, but constants and memory locality still decide real speed.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `This algorithm shaped production sorting for decades, but exact library behavior varies. The C standard function qsort specifies an interface, not the algorithm. Many C libraries use quicksort-derived or introspective variants. C++ standard-library sort implementations commonly use Musser's 1997 introsort idea: partition like quicksort, then fall back to Heap Sort when depth exceeds about 2 log n. Java 7 adopted Vladimir Yaroslavskiy's dual-pivot variant for primitive arrays in 2009; object arrays use stable TimSort-style logic because object equality order matters.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The first misconception is that partitioning sorts. It does not. One partition only proves that the pivot is final and that every low-side value belongs before every high-side value. The recursive calls do the remaining work. The second misconception is that the worst case is only theoretical. Fixed-pivot schemes can be forced into O(n^2) by already sorted, reverse-sorted, or adversarially arranged inputs.`,
        `Duplicates need care. A two-way partition that sends every equal value to one side can become badly unbalanced when the array has many repeats. Three-way partitioning groups values less than, equal to, and greater than the pivot, which is why it is useful on data with many duplicate keys. Stability is also not automatic: equal records can cross during swaps, so use Merge Sort or another stable algorithm when equal-key order must be preserved.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Merge Sort for stability and predictable O(n log n) time with extra memory. Study Heap Sort for the in-place worst-case guarantee that introsort uses as a safety valve. Review Insertion Sort because real quicksorts hand tiny ranges to it. Two Pointers explains Hoare-style partitioning, Recursion explains the call tree, and Big-O Growth Rates gives the scaling context behind the whole family.`,
      ],
    },
  ],
};
