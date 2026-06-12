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
      heading: 'What it is',
      paragraphs: [
        `Quicksort is the favorite production sort of the industry: it is in-place, has tight inner loops, and runs in O(n log n) average time. The idea is simple: pick a pivot element, partition the array so everything smaller goes left and everything larger goes right, then recursively sort both sides. The pivot lands in its final position after partitioning, never to move again. Unlike merge sort, no extra array is needed.`,
        `It is not stable (equal elements may reorder), and in the worst case it degrades to O(n²) if the pivot consistently lands at the worst position. Real implementations mitigate this with better pivot selection strategies (median-of-three, random, introsort fallback). When the pivot splits the array evenly, quicksort dominates every other sort in practice due to cache locality and instruction-level parallelism.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Choose a pivot (in this visualization, the last element). Scan the array, comparing each element to the pivot. Elements smaller than or equal to the pivot move to the left; others stay on the right. The mechanism is a moving boundary between the "left zone" (≤ pivot) and the "unclassified zone." As you scan from left to right, when you hit an element that belongs on the left, swap it to the boundary position and advance the boundary. After scanning the whole range, swap the pivot into the boundary position — it is now in its final spot. Recursively apply the same process to the left and right portions.`,
        `The Lomuto partition scheme used here tracks a boundary marker. It is slightly slower than Hoare's partition (which uses two pointers scanning from opposite ends) but is easier to understand and visualize. The key invariant is that after partitioning, all elements at positions lo to boundary−1 are ≤ pivot, position boundary holds the pivot, and positions boundary+1 to hi are > pivot.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Best and average cases are O(n log n) when the pivot splits the array near the middle, creating a balanced recursion tree of depth log n with O(n) work per level. Worst case is O(n²) if the pivot is always the smallest or largest element (creating a lopsided tree of depth n). Space complexity is O(log n) for the recursion stack in the average case, O(n) in the worst case. In practice, good pivot selection (median-of-three or random) makes the worst case vanishingly unlikely, and the tight inner loop beats merge sort and most other O(n log n) sorts.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Quicksort is the default choice in C's stdlib qsort, C++ std::sort (which is actually introsort — quicksort with a fallback to heap sort after a depth limit), Java's Arrays.sort (dual-pivot quicksort), and many other languages. Its cache-friendly access patterns make it faster than theoretically superior algorithms like merge sort on modern hardware. When worst-case guarantees are critical, introsort (which switches to heap sort after a recursion depth limit) is used. When stability is required, Timsort (Python, Java collections) blends insertion sort with merge sort.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `A common misconception is that O(n²) worst-case makes quicksort unreliable. In practice, with modern pivot selection (random or median-of-three), the worst case is so rare that quicksort is more predictable than naïve merge sort for real-world data. The real risk is a bad pivot-selection strategy on deliberately adversarial input — security researchers have crafted hash table inputs that trigger O(n log n) behavior in sorts with fixed pivot schemes.`,
        `Another pitfall is confusing the partition step's role. The partition does NOT sort the two sides; it just arranges them so that all left-side elements are ≤ pivot and all right-side elements are > pivot. The sorting happens recursively. Beginners sometimes expect a single partition to sort the whole array, leading to confusion when the result is not sorted.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Compare quicksort to Merge Sort to understand the trade-off between in-place (low space) and stable sorts. Study Heap Sort for another O(n log n) in-place sort with guaranteed worst-case. Learn about the Two Pointers technique, which is the foundation of the faster Hoare partition scheme. Explore introsort, the production hybrid used in C++ std::sort. Finally, study Recursion and Divide-and-Conquer strategies to grasp why these recursive approaches are so powerful.`,
      ],
    },
  ],
};

