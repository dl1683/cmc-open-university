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
    explanation: 'Quick sort turns one scan into a boundary proof. Partition the range around a pivot; after the pivot lands, no value on the left needs to cross any value on the right, so recursion can solve the sides independently.',
  };

  yield* quickSort(values, 0, values.length - 1, done);

  yield {
    state: arrayState(values),
    highlight: { sorted: values.map((_, i) => `i${i}`) },
    explanation: 'Every fixed pivot removed one position from future work. Balanced pivots give about log2(n) scan levels, so total work is O(n log n); pivots that keep one side empty repeat long scans and degrade to O(n^2).',
  };
}

function* quickSort(values, lo, hi, done) {
  if (lo > hi) return;
  if (lo === hi) {
    done.add(lo);
    yield {
      state: arrayState(values),
      highlight: { sorted: [...done].map((i) => `i${i}`) },
      explanation: `This recursive range has one value, ${values[lo]}. There is no internal order left to fix, and earlier partitions already proved every outside value belongs on the correct side.`,
    };
    return;
  }

  const pivot = values[hi];
  yield {
    state: arrayState(values),
    highlight: { range: idsBetween(lo, hi), pivot: [`i${hi}`], sorted: [...done].map((i) => `i${i}`) },
    explanation: `This recursive call owns positions ${lo}-${hi}. The last value, ${pivot}, is the pivot; the scan will build a <= ${pivot} zone before the boundary and a > ${pivot} zone after it.`,
  };

  // Lomuto partition: `boundary` is the first slot of the "greater than pivot" zone.
  let boundary = lo;
  for (let i = lo; i < hi; i += 1) {
    const belongsLeft = values[i] <= pivot;
    yield {
      state: arrayState(values),
      highlight: { range: idsBetween(lo, hi), pivot: [`i${hi}`], compare: [`i${i}`], active: [`i${boundary}`], sorted: [...done].map((p) => `i${p}`) },
      explanation: `Compare ${values[i]} with pivot ${pivot}. ${belongsLeft ? `It belongs in the low zone; if it is not already at boundary ${boundary}, swap it into the first high slot, then advance the boundary.` : `It belongs in the high zone for this pivot, so leaving it in place expands the high zone and keeps boundary ${boundary} fixed.`}`,
      invariant: `Before this decision, values before the boundary are <= ${pivot}; values from the boundary up to but not including the cursor are > ${pivot}; unscanned values are unknown.`,
    };
    if (belongsLeft) {
      if (i !== boundary) {
        [values[i], values[boundary]] = [values[boundary], values[i]];
        yield {
          state: arrayState(values),
          highlight: { range: idsBetween(lo, hi), pivot: [`i${hi}`], swap: [`i${i}`, `i${boundary}`], sorted: [...done].map((p) => `i${p}`) },
          explanation: `The swap fills the first high slot with a low-side value. The displaced value stays in the scanned region, so the partition invariant survives when the boundary advances to ${boundary + 1}.`,
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
    explanation: `The scan classified every non-pivot value. Swapping pivot ${pivot} onto boundary ${boundary} puts it after all <= values and before all > values, so that position is final and the recursive calls must not cross it.`,
  };

  yield* quickSort(values, lo, boundary - 1, done);
  yield* quickSort(values, boundary + 1, hi, done);
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation uses Lomuto partitioning with the last element as pivot. The highlighted range marks the current recursive call. The pivot is marked separately at the right end of the range. Two cursors move through the range: the compare marker is the element being classified, and the active marker is the boundary between the low zone (values <= pivot) and the high zone (values > pivot).',
        { type: 'callout', text: 'A partition is a local proof: once the pivot lands, recursion is forbidden from moving values across it.' },
        'A swap fires when a value that belongs in the low zone sits past the boundary. The value moves into the boundary slot, the boundary advances, and the invariant holds: everything left of the boundary is <= pivot, everything between the boundary and the scan cursor is > pivot. When the scan finishes, the pivot swaps into the boundary slot and turns green. Green means final -- that index will never move again. Watch the green set grow: each partition locks exactly one position.',
      
        {type: 'image', src: './assets/gifs/quick-sort.gif', alt: 'Animated walkthrough of the quick sort visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Sorting means arranging values into order so later operations can search, merge, deduplicate, or compare them cheaply. Quick sort exists because it often sorts arrays fast in place.',
        'The in-place part matters. A method that avoids an extra O(n) buffer can be easier to use inside memory-constrained systems and cache-sensitive inner loops.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious divide-and-conquer sort is merge sort. Split by index, sort both halves, then merge them into a new ordered buffer.',
        'Merge sort is stable and guarantees O(n log n) time. Its main tax is the O(n) auxiliary array used by the merge step.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Splitting by index gives no value guarantee. The left half may contain the largest item and the right half may contain the smallest item, so merge sort needs a merge buffer to repair the split.',
        'Quick sort asks for a stronger split. If one scan can put all values less than or equal to a pivot on the left and all larger values on the right, the two sides no longer need to merge.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is partitioning. A pivot value creates a boundary: low values belong before it, high values belong after it.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/6a/Sorting_quicksort_anim.gif', alt: 'Animated quicksort trace showing recursive partitioning around pivots', caption: 'Quicksort repeatedly creates value partitions, then recurses only inside the independent subranges. Source: Wikimedia Commons, Sorting quicksort anim.gif, CC BY-SA 3.0: https://commons.wikimedia.org/wiki/File:Sorting_quicksort_anim.gif' },
        'Once the pivot reaches its final position, recursion sorts only the left and right ranges. No later step may move a value across the fixed pivot.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Lomuto partition picks the last item as pivot and keeps a boundary at the first high-zone slot. The scan compares each value with the pivot.',
        'If the value is less than or equal to the pivot, swap it into the boundary slot and advance the boundary. If it is greater, leave it where it is and keep the boundary fixed.',
        'After the scan, swap the pivot into the boundary slot. The pivot is final, so quick sort recurses on the two smaller ranges.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The partition invariant makes the scan safe. Before the cursor, values left of the boundary are <= pivot, and values from boundary to cursor are > pivot.',
        'Each comparison shrinks the unknown region by one. When no unknown values remain, putting the pivot at the boundary places it after all low values and before all high values.',
        'Correctness follows by induction on range size. Size 0 or 1 is sorted; larger ranges become two smaller sorted ranges separated by a final pivot.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Each partition scans its range once. If pivots split ranges roughly in half, each level touches n elements and there are about log2(n) levels, so time is O(n log n).',
        'If each pivot is the smallest or largest value, the scans add n + (n - 1) + ... + 1, which is O(n^2). Last-element pivot on already sorted input hits this pattern.',
        'Space is O(log n) average for recursion stack and O(n) worst case for bad pivots. The array storage is in place, but quick sort is not stable because swaps can reorder equal keys.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Quick sort is used inside production sorting families because partition scans contiguous memory and avoids an auxiliary merge buffer. C library qsort, Java primitive array sorting, and introsort-style libraries all draw from this design.',
        'Modern implementations add guards. Random pivots, median-of-three, insertion-sort cutoffs, three-way partitioning for duplicates, and introsort fallback make the practical algorithm safer than the simple classroom version.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The bad pivot case is the main failure. An adversary or sorted input can force O(n^2) work when the pivot rule is predictable.',
        'It also fails when stability is required. If equal records must keep original order, use merge sort, timsort, or another stable sort.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Sort [3, 6, 8, 10, 1, 2, 1] with the last value as pivot. Pivot is 1 and boundary starts at index 0.',
        'The scan leaves 3, 6, 8, and 10 because they are greater than 1. It sees the next 1, swaps it with index 0, and advances boundary to index 1.',
        'After the scan, swap the pivot at index 6 with boundary index 1, giving [1, 1, 8, 10, 3, 2, 6]. The pivot at index 1 is final, and recursion continues on [8, 10, 3, 2, 6].',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with Hoare, "Quicksort", Sedgewick\'s analysis of quicksort programs, and Musser\'s introsort paper. Then study merge sort, heap sort, insertion sort cutoffs, Dutch national flag partitioning, randomized algorithms, quickselect, and introsort.',
      ],
    },
  ],
};
