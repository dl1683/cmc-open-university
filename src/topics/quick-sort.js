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
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Tony Hoare invented quicksort in 1960 while working on a machine-translation project at Moscow State University. He needed to sort words so they could be looked up in a sorted Russian-English dictionary. His first idea was a recursive partition scheme, and it turned out to be the fastest general-purpose sort in practice.',
        'Simple in-place sorts make too little progress per pass. Insertion sort fixes one element per round. Selection sort finalizes one position per round. Both take O(n^2) time because each pass does O(n) work and there are O(n) passes. Quicksort tries to split the problem in half with each pass, getting divide-and-conquer speed while keeping the data in place.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Merge sort splits the array by index, sorts both halves recursively, and merges the results. It guarantees O(n log n) time regardless of input. The merge step walks both halves in order and writes the smaller element into an output buffer, producing a sorted result in one linear pass.',
        'Merge sort is predictable and stable, but the merge step needs O(n) auxiliary space. For an array of a million integers, that is an extra four megabytes. On embedded systems, in tight inner loops, or when memory pressure matters, that auxiliary buffer is a real cost.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Merge sort splits by position, not by value. The left half might contain the largest element and the right half might contain the smallest. The merge step exists precisely because the split does not guarantee anything about value placement. That merge step is what forces the extra memory.',
        'The question quicksort asks: can one scan rearrange the values so the split itself is valid? If the scan can prove that every value on the left belongs on the left and every value on the right belongs on the right, there is nothing to merge. Recursion on independent ranges replaces merging, and the auxiliary buffer disappears.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Choose a pivot. Partition the array so every element smaller than the pivot ends up to its left and every element larger ends up to its right. The pivot lands in its final sorted position. Recurse on the left range and the right range.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/6a/Sorting_quicksort_anim.gif', alt: 'Animated quicksort trace showing recursive partitioning around pivots', caption: 'Quicksort repeatedly creates value partitions, then recurses only inside the independent subranges. Source: Wikimedia Commons, Sorting quicksort anim.gif, CC BY-SA 3.0: https://commons.wikimedia.org/wiki/File:Sorting_quicksort_anim.gif' },
        'Lomuto partition (the variant shown here) is the simpler scheme. Pick the last element as pivot. Maintain a boundary starting at the left end. Scan left to right. When the scanned value is <= pivot, swap it into the boundary slot and advance the boundary. When the scanned value is > pivot, leave it in place. After the scan, swap the pivot into the boundary slot. The boundary now separates low and high zones, and the pivot sits between them.',
        'Hoare partition (the original 1960 scheme) uses two cursors that walk inward from opposite ends. The left cursor advances until it finds a value >= pivot; the right cursor retreats until it finds a value <= pivot; then the two values swap. The cursors meet in the middle. Hoare partition does fewer swaps on average because each swap moves two elements toward their correct side. The tradeoff: it returns a split point, not a final pivot position, so the recursive ranges need slightly more care.',
        'Pivot selection matters. Picking the first or last element is simple but degrades to O(n^2) on sorted or reverse-sorted input. Random pivot selection gives expected O(n log n) regardless of input order. Median-of-three picks the median of the first, middle, and last elements -- a cheap check that turns sorted arrays from worst case to near-best case.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'After partition, the pivot is in its final position. Every element to its left is <= pivot, so none of them need to cross the pivot to reach their sorted position. Every element to its right is > pivot, so none of them need to cross either. The two sides are independent subproblems.',
        'The correctness argument is induction on subarray size. Base case: a subarray of size 0 or 1 is already sorted. Inductive step: partition places the pivot correctly and produces two smaller subarrays. If recursion sorts those smaller subarrays correctly (inductive hypothesis), the whole array is sorted because no element needs to cross the pivot boundary.',
        'The partition invariant makes each step safe. At any point during the scan, three zones exist: values before the boundary are <= pivot, values between the boundary and the scan cursor are > pivot, and values past the cursor are unclassified. Each comparison shrinks the unclassified zone by one and grows either the low zone or the high zone. When no unclassified values remain, the pivot swap completes the proof.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Each partition scans its range once: O(k) work for a range of size k. If every pivot splits its range roughly in half, the recursion tree has about log2(n) levels. Each level scans every element once across all the ranges at that level, so total work is O(n log n).',
        'The average case is more precisely about 1.39 n log2(n) comparisons. The factor 1.39 comes from an entropy argument: a random pivot does not split exactly in half but into two pieces whose expected sizes are n/4 and 3n/4. The resulting recurrence solves to 2n ln(n), which is 2n * 0.693 * log2(n) = 1.39 n log2(n). This is about 39% more comparisons than merge sort, but quicksort wins in practice because its inner loop is simpler and more cache-friendly.',
        'Worst case is O(n^2). If every pivot is the smallest or largest element, one side is empty and the other has n-1 elements. The scans add up to n + (n-1) + (n-2) + ... + 1 = n(n+1)/2. Already-sorted input with last-element pivot hits this case. Recursion depth also grows to O(n), risking stack overflow.',
        'Space is O(log n) on average for the call stack. The array is sorted in place -- no auxiliary buffer. Quicksort is not stable: the swap can reorder equal elements. Two records with the same key may not preserve their original relative order.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Quicksort is the default choice for in-memory array sorting in most standard libraries. C qsort, C++ std::sort (as the inner loop of introsort), and Java Arrays.sort for primitives (dual-pivot quicksort) all use it.',
        'The reason is cache behavior. Partitioning walks through contiguous memory from left to right. On modern hardware, sequential access patterns hit the L1/L2 cache almost every time, while merge sort bounces between the input array and the auxiliary buffer. For large arrays that fit in RAM but not in cache, this difference matters more than the comparison count.',
        'Quicksort also needs no extra allocation. Merge sort must allocate and free an O(n) buffer (or reuse one), which adds memory-management overhead. In latency-sensitive code -- game engines, real-time systems, embedded firmware -- avoiding allocation is a hard constraint, not a preference.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The O(n^2) worst case is the primary weakness. An adversary who knows the pivot rule can construct a killer sequence that forces every partition to be maximally unbalanced. Introsort (Musser, 1997) fixes this: run quicksort, but if recursion depth exceeds 2 log2(n), switch to heapsort for the remaining range. The result is O(n log n) worst case with quicksort speed for the common case. C++ std::sort and .NET Array.Sort use introsort.',
        'Quicksort is not stable. Equal keys may be reordered by swaps. When stability matters -- sorting database rows by one column while preserving the order from a previous sort on another column -- merge sort or timsort is the right tool.',
        'For small subarrays (roughly n < 16), the overhead of recursion and partitioning exceeds the cost of insertion sort. Production implementations switch to insertion sort for small ranges. This hybrid approach gives quicksort its best constants.',
        'Duplicate-heavy input is a problem for two-way partitioning. If most values equal the pivot, every partition puts almost everything on one side. Three-way partitioning (Dutch national flag, Dijkstra 1976) fixes this by separating less-than, equal-to, and greater-than zones. All copies of the pivot land in their final positions at once, and recursion skips them.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Array: [3, 6, 8, 10, 1, 2, 1]. Pivot = 1 (last element). Boundary starts at index 0.',
        'Scan index 0: value 3 > 1, leave it. Scan index 1: value 6 > 1, leave it. Scan index 2: value 8 > 1, leave it. Scan index 3: value 10 > 1, leave it. Scan index 4: value 1 <= 1, swap with index 0 (boundary). Array becomes [1, 6, 8, 10, 3, 2, 1]. Boundary advances to 1. Scan index 5: value 2 > 1, leave it.',
        'Scan complete. Swap pivot (index 6, value 1) with boundary (index 1, value 6). Array becomes [1, 1, 8, 10, 3, 2, 6]. Pivot 1 is final at index 1. Left range [1] is size 1, already final. Right range [8, 10, 3, 2, 6] needs sorting.',
        'Right range, pivot = 6 (last element). Boundary at index 2. Scan: 8 > 6 (leave), 10 > 6 (leave), 3 <= 6 (swap with index 2, array becomes [..., 3, 10, 8, 2, 6], boundary to 3), 2 <= 6 (swap with index 3, array becomes [..., 3, 2, 8, 10, 6], boundary to 4). Swap pivot 6 into index 4: [..., 3, 2, 6, 10, 8]. Pivot 6 is final. Recurse on [3, 2] and [10, 8]. Each two-element range needs one more partition to finish. Final sorted array: [1, 1, 2, 3, 6, 8, 10].',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        "C.A.R. Hoare, 'Quicksort,' Computer Journal 5(1), 1962 -- the original partition-and-recurse algorithm. Robert Sedgewick, 'The Analysis of Quicksort Programs,' Acta Informatica 7, 1977, and his 1975 Stanford dissertation -- the definitive practical analysis covering pivot strategies, cutoff to insertion sort, and the constants that shaped real implementations. David Musser, 'Introspective Sorting and Selection Algorithms,' Software: Practice and Experience 27(8), 1997 -- introsort, guaranteeing O(n log n) worst case by switching to heapsort when recursion grows too deep.",
        'Study next: Merge Sort for the guaranteed O(n log n) stable baseline that quicksort trades stability to beat on space. Heap Sort for the O(n log n) worst-case in-place sort that introsort falls back to. Introsort to see how production libraries combine quicksort, heapsort, and insertion sort into one algorithm. Dual-pivot quicksort (Yaroslavskiy, 2009) for the variant Java uses -- two pivots create three partitions per pass, reducing comparisons on random data. Quickselect for finding the k-th smallest element in O(n) average time by partitioning without sorting both sides.',
      ],
    },
  ],
};
