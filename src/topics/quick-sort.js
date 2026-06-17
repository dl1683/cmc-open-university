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
      heading: `Why this exists`,
      paragraphs: [
        `Quick sort exists because simple in-place sorts make too little progress per pass. Insertion Sort repairs one value. Selection Sort fixes one final position. On large random arrays, both spend quadratic time.`,
        `Quick sort tries to get divide-and-conquer speed while keeping the array mostly in place. One scan around a pivot splits the problem by value, not by position. After that scan, the two sides no longer need to trade elements.`,
      ],
    },
    {
      heading: `Baseline and wall`,
      paragraphs: [
        `The first baseline is a quadratic in-place sort. It is easy to trust because a sorted prefix grows one slot at a time, but n rounds of long scans or shifts do not scale.`,
        `The second baseline is Merge Sort: split by index, sort both halves, then merge. That gives predictable O(n log n) time, but array merging usually needs an auxiliary buffer. Quick sort asks a different question: can one scan arrange the values so the split itself is already valid?`,
        `The wall is independence. If you split an unsorted array by index, the left half may contain values that belong on the right and the right half may contain values that belong on the left. Recursion is safe only after a partition proves that no crossing is needed.`,
      ],
    },
    {
      heading: `Core insight`,
      paragraphs: [
        `Partitioning turns one pivot into a boundary proof. Values on one side are less than or equal to the pivot. Values on the other side are greater than the pivot. The pivot belongs exactly between those zones.`,
        `The pivot position is final after partitioning. The sides aren't sorted, but they are independent. Sorting the left side can't require a value from the right side, and sorting the right side can't require a value from the left side.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `This visualization uses Lomuto partitioning. Pick the last value as the pivot. Keep a boundary at the first slot of the greater-than-pivot zone. Scan the range from left to right, excluding the pivot.`,
        `When the scanned value is less than or equal to the pivot, swap it into the low zone and advance the boundary. When the scanned value is greater than the pivot, leave it where it is; it becomes part of the high zone. After the scan, swap the pivot into the boundary slot.`,
        `On 15, 5, 1, 10, 5, 7, 12, the pivot is 12. The scan leaves 15 in the high zone and moves 5, 1, 10, 5, and 7 into the low zone. When 12 moves to the boundary, every value to its left is less than or equal to 12 and every value to its right is greater.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `The partition invariant carries the proof. Before the boundary, every scanned value is less than or equal to the pivot. Between the boundary and the scan cursor, every scanned value is greater than the pivot. After the cursor, values are unknown.`,
        `Each comparison expands one known zone. A low value is swapped into the boundary slot, so the low zone grows. A high value stays where it is, so the high zone grows. The invariant survives either decision.`,
        `When the scan ends, every non-pivot value has been classified. Swapping the pivot into the boundary puts it after all low values and before all high values. By induction, if the recursive calls sort those smaller independent ranges, the whole range is sorted.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `A partition scans its range once. If pivots split ranges evenly, the array is scanned across about log2(n) recursive levels, so the total work is O(n log n). Average quick sort is O(n log n) with reasonable pivot selection.`,
        `Bad pivots change the shape of the recursion tree. If the pivot is always the smallest or largest value, one recursive side is empty and the other has n - 1 values. The scans then add up to O(n^2), and recursion depth grows to O(n).`,
        `Extra memory is small because partitioning happens inside the array. The call stack is O(log n) on balanced splits and O(n) in the worst case. The swaps also mean the usual implementation isn't stable.`,
      ],
    },
    {
      heading: `Implementation checklist`,
      paragraphs: [
        `Choose the partition scheme deliberately. Lomuto is easy to teach because one boundary separates low and high zones, but it can do more swaps than Hoare partitioning. Hoare partitioning is fast but returns a split point rather than a final pivot position, so the recursive ranges are easier to get wrong.`,
        `Choose the pivot rule with adversarial input in mind. Last-element pivot is fine for a small lesson and poor as a production default. Median-of-three, randomized pivots, three-way partitioning for duplicates, and introsort fallback are common ways to keep quick sort from becoming fragile.`,
        `Keep recursion bounded. Recurse on the smaller side first and loop on the larger side, or use an introsort depth limit. That turns a nice average-case algorithm into code that behaves predictably under bad input.`,
      ],
    },
    {
      heading: `Testing it`,
      paragraphs: [
        `Test empty arrays, one-element arrays, already sorted arrays, reverse-sorted arrays, all-equal arrays, duplicate-heavy arrays, negative values, and random arrays. Compare against a trusted language sort and assert that the output is nondecreasing and contains exactly the same multiset of values.`,
        `Partition itself deserves direct tests. After one partition, every value on the left side must be less than or equal to the pivot and every value on the right side must be greater for the Lomuto variant shown here. If that local proof fails, recursion only hides the bug.`,
      ],
    },
    {
      heading: `Where it wins`,
      paragraphs: [
        `Quick sort wins on in-memory arrays when low extra memory and cache-friendly scans matter. Partitioning walks through contiguous memory, and most work is simple comparison and swapping.`,
        `Production-grade versions rarely use the naive last-item pivot alone. They choose pivots more carefully, switch to Insertion Sort for tiny ranges, and may fall back to Heap Sort if recursion becomes suspicious. The durable idea is partition first, then recurse on independent value ranges.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `Quick sort fails when worst-case time must be guaranteed and the implementation has no safeguard. A bad pivot rule can be attacked by sorted, reverse-sorted, duplicate-heavy, or deliberately arranged input.`,
        `It also fails when stability is required. Swapping equal keys can change their original order. For duplicate-heavy data, two-way partitioning is wasteful because equal values can keep moving through recursive calls. Three-way partitioning fixes that by separating less-than, equal-to, and greater-than zones.`,
        `Linked lists are usually a poor fit because quick sort's strengths come from indexed ranges and contiguous scans. Merge Sort is often better there because splitting and merging lists can be done by pointer changes.`,
      ],
    },
    {
      heading: `Concrete example`,
      paragraphs: [
        `Take 8, 3, 6, 2, 7 with pivot 7. Partitioning moves 3, 6, and 2 into the low zone and leaves 8 in the high zone. After the pivot swap, the array has a left range containing values no greater than 7, the pivot 7 in its final position, and a right range containing 8.`,
        `The left range still needs sorting. The right range is already size one. The important point is that no future step needs to compare 8 with 3, 6, or 2 to decide which side they belong on. The pivot comparison already proved that boundary.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Merge Sort for stable, predictable O(n log n) sorting with extra memory. Study Heap Sort for an in-place O(n log n) worst-case guarantee. Study Insertion Sort because hybrids use it on tiny partitions. Two Pointers explains alternative partition schemes, Recursion explains the call tree, and Big-O Growth Rates explains why balanced splits matter.`,
      ],
    },
  ],
};
