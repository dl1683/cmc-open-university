// Quickselect: find the kth smallest element by partitioning like quicksort
// but only recursing into the side that contains the target rank.

import { arrayState, parseNumberList, parseIntegerInRange } from '../core/state.js';

export const topic = {
  title: 'Quickselect',
  slug: 'quickselect',
  category: 'Algorithms',
  summary: 'Find the kth smallest element in O(n) average time — partition like quicksort but only recurse into one side',
  defaultInput: '7 2 1 6 8 5 3 4, k=3',
  controls: [
    { id: 'values', label: 'Values', type: 'number-list', defaultValue: '7, 2, 1, 6, 8, 5, 3, 4' },
    { id: 'k', label: 'k (rank)', type: 'number', defaultValue: '3' },
  ],
  run,
};

const idsBetween = (lo, hi) =>
  Array.from({ length: Math.max(0, hi - lo + 1) }, (_, i) => `i${lo + i}`);

export function* run(input) {
  const values = parseNumberList(input.values, { max: 12 });
  const k = parseIntegerInRange(input.k, { min: 1, max: values.length, label: 'k' });
  // Convert to 0-based index internally
  const targetIndex = k - 1;

  yield {
    state: arrayState(values),
    highlight: {},
    explanation: `Find the ${ordinal(k)} smallest element in [${values.join(', ')}]. Sorting would cost O(n log n), but we only need one value at rank ${k}. Quickselect partitions like quicksort but follows only the side that contains rank ${k}, dropping to O(n) average work.`,
  };

  yield* quickselect(values, 0, values.length - 1, targetIndex);

  yield {
    state: arrayState(values),
    highlight: { found: [`i${targetIndex}`] },
    explanation: `The ${ordinal(k)} smallest element is ${values[targetIndex]}. Every value to its left is smaller or equal; every value to its right is larger or equal. We never sorted the full array — partition narrowed the search until only one position remained.`,
  };
}

function* quickselect(values, lo, hi, targetIndex) {
  if (lo === hi) {
    yield {
      state: arrayState(values),
      highlight: { found: [`i${lo}`] },
      explanation: `The subarray has one element: ${values[lo]}. It must be the answer because earlier partitions proved every value outside this range belongs on the correct side.`,
    };
    return;
  }

  // Pick last element as pivot
  const pivot = values[hi];
  yield {
    state: arrayState(values),
    highlight: { range: idsBetween(lo, hi), pivot: [`i${hi}`] },
    explanation: `Active range is positions ${lo}..${hi}. Pick ${pivot} (the last element) as pivot. The scan will place everything <= ${pivot} on the left and everything > ${pivot} on the right.`,
  };

  // Lomuto partition
  let boundary = lo;
  for (let i = lo; i < hi; i += 1) {
    const belongsLeft = values[i] <= pivot;
    yield {
      state: arrayState(values),
      highlight: {
        range: idsBetween(lo, hi),
        pivot: [`i${hi}`],
        compare: [`i${i}`],
        active: [`i${boundary}`],
      },
      explanation: `Compare ${values[i]} with pivot ${pivot}. ${belongsLeft ? `${values[i]} <= ${pivot}, so it belongs in the low zone. ${i !== boundary ? `Swap it to position ${boundary} and advance the boundary.` : `It is already at the boundary; advance to ${boundary + 1}.`}` : `${values[i]} > ${pivot}, so it stays in the high zone. Boundary remains at ${boundary}.`}`,
    };
    if (belongsLeft) {
      if (i !== boundary) {
        [values[i], values[boundary]] = [values[boundary], values[i]];
        yield {
          state: arrayState(values),
          highlight: {
            range: idsBetween(lo, hi),
            pivot: [`i${hi}`],
            swap: [`i${i}`, `i${boundary}`],
          },
          explanation: `Swapped ${values[boundary]} into the low zone at position ${boundary}. The partition invariant holds: positions ${lo}..${boundary} are <= ${pivot}, positions ${boundary + 1}..${i} are > ${pivot}.`,
        };
      }
      boundary += 1;
    }
  }

  // Place pivot at boundary
  [values[hi], values[boundary]] = [values[boundary], values[hi]];
  yield {
    state: arrayState(values),
    highlight: {
      range: idsBetween(lo, hi),
      swap: [`i${boundary}`, `i${hi}`],
      sorted: [`i${boundary}`],
    },
    explanation: `Pivot ${pivot} moves to position ${boundary}. This position is final: ${boundary === 0 ? 'no' : boundary} value${boundary === 1 ? '' : 's'} to its left ${boundary === 1 ? 'is' : 'are'} <= ${pivot}, and everything to its right is > ${pivot}.`,
  };

  const pivotPos = boundary;

  if (targetIndex === pivotPos) {
    yield {
      state: arrayState(values),
      highlight: { found: [`i${pivotPos}`] },
      explanation: `The pivot landed at position ${pivotPos}, which is exactly rank ${targetIndex + 1}. Found: ${values[pivotPos]}. No further recursion needed.`,
    };
    return;
  }

  if (targetIndex < pivotPos) {
    yield {
      state: arrayState(values),
      highlight: {
        range: idsBetween(lo, pivotPos - 1),
        sorted: [`i${pivotPos}`],
      },
      explanation: `Rank ${targetIndex + 1} < pivot position ${pivotPos}. The answer is in the left partition (positions ${lo}..${pivotPos - 1}). The right side is irrelevant — this is why quickselect is faster than quicksort.`,
    };
    yield* quickselect(values, lo, pivotPos - 1, targetIndex);
  } else {
    yield {
      state: arrayState(values),
      highlight: {
        range: idsBetween(pivotPos + 1, hi),
        sorted: [`i${pivotPos}`],
      },
      explanation: `Rank ${targetIndex + 1} > pivot position ${pivotPos}. The answer is in the right partition (positions ${pivotPos + 1}..${hi}). The left side is irrelevant — half the work disappears.`,
    };
    yield* quickselect(values, pivotPos + 1, hi, targetIndex);
  }
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The highlighted range marks the active subarray -- the only portion still under consideration. The pivot element gets its own marker. As the scan moves left to right, a compare marker lands on each element being tested against the pivot. When a value belongs on the low side, a swap marker shows it moving to the boundary between the two zones.',
        { type: 'callout', text: 'Quickselect is quicksort with discipline: partition both sides, then spend recursion only on the side that can still contain rank k.' },
        'After each partition, the pivot snaps into its final position (sorted marker). Then only one side lights up as the new active range. The other side goes dark and is never touched again. This is what separates quickselect from quicksort: quicksort recurses into both sides, quickselect discards the side that cannot contain the answer.',
        'Watch the active range shrink across rounds. On a good pivot it roughly halves. When only one cell remains, the found marker appears -- that cell holds the kth smallest element, with everything to its left smaller or equal and everything to its right larger or equal, even though the array was never fully sorted.',
      
        {type: 'image', src: './assets/gifs/quickselect.gif', alt: 'Animated walkthrough of the quickselect visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'C.A.R. Hoare published quickselect in 1961, in the same paper that introduced quicksort ("Algorithm 65: Find," Communications of the ACM). The problem: given an unsorted array and a rank k, find the kth smallest element. Medians, percentiles, top-k scores, order statistics -- all are rank queries.',
        'Sorting answers a rank query, but it answers every rank query simultaneously. If you have a million elements and only need the median, sorting places all million values in their final positions when you care about exactly one. Quickselect drops the unnecessary ordering and solves just the problem you asked.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Sort the array in O(n log n), then read position k-1. This works, it is easy to trust, and for small arrays the overhead barely registers. For large n when you need a single rank, the extra ordering is pure waste.',
        'A min-heap can extract the minimum k times in O(n + k log n). For small k this is reasonable. For the median (k = n/2), the heap extracts almost half the elements, each extraction costs O(log n), and the total converges back to O(n log n).',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Sorting determines the relative order of every pair of elements. A single rank query does not need the internal order of the elements smaller than the answer, nor the internal order of those larger. It needs only three groups: "definitely smaller," "the answer," and "definitely larger." A full sort produces a fine-grained total order when a coarse three-way split would suffice.',
        'The heap approach hits a related wall. It avoids a full sort, but when k approaches n/2, it extracts nearly half the elements at O(log n) each. The total work converges to O(n log n) because the heap still imposes more order than necessary.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Partition around a pivot, exactly as in quicksort. Pick a pivot (this visualization uses the last element; real implementations use a random element or median-of-three). Rearrange the array so that every element left of the pivot is smaller or equal and every element to its right is larger. The pivot lands at its globally correct sorted position.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/0/04/Selecting_quickselect_frames.gif', alt: 'Animated quickselect trace narrowing to the selected order statistic', caption: 'The search range shrinks because each pivot rank proves one side irrelevant. Source: Wikimedia Commons, Selecting quickselect frames.gif, CC BY-SA 3.0: https://commons.wikimedia.org/wiki/File:Selecting_quickselect_frames.gif' },
        'Now check where the pivot landed versus the target rank k. If the pivot is at position k, you are done -- that is the answer. If k < pivot position, the answer lives in the left partition; recurse there. If k > pivot position, recurse into the right partition. The key difference from quicksort: you only recurse into one side. The other side is irrelevant forever, because the partition proved every element there is on the wrong side of rank k.',
        'The partition uses Lomuto\'s scheme. A boundary pointer starts at the left edge. Scan left to right: if the current element is <= pivot, swap it to the boundary and advance the boundary. If it is > pivot, skip it. After the scan, swap the pivot to the boundary position. The boundary now separates the two zones.',
        'Introselect (Musser, 1997) adds a safety net. It tracks recursion depth, and if it exceeds 2 log n -- meaning pivot choices have been consistently bad -- it falls back to the median-of-medians algorithm (Blum, Floyd, Pratt, Rivest, Tarjan, 1973). Median-of-medians guarantees a pivot in the middle 30-70% of the range, giving O(n) worst case at the cost of a roughly 5x constant. C++ std::nth_element and NumPy\'s partition both use this hybrid.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on the partition invariant. After partitioning, every element left of the pivot is <= pivot and every element right is > pivot. The pivot itself sits at its final sorted rank. If the target rank k falls left of the pivot, the answer must be among the smaller values -- the right side is provably irrelevant. Symmetric argument for the right side. By induction on subarray size, each recursive call correctly finds rank k within its half, and the base case (one element) is trivially correct.',
        'Expected O(n) runtime follows from a geometric series. Each partition costs O(m) work where m is the active range. With a random pivot, the expected split is near the middle, halving the range. Total work across all rounds: n + n/2 + n/4 + n/8 + ... = 2n. That sum converges because each term is half the previous. A more careful analysis accounting for imperfect splits: the probability that a random pivot lands in the middle half is 1/2. When it does, the range shrinks to at most 3/4 of its size. The recurrence T(n) <= n + T(3n/4) unrolls to n + 3n/4 + 9n/16 + ... = 4n. Hoare\'s 1961 analysis gives roughly 2n comparisons on average for the median case.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Average case: O(n). The geometric series (n + n/2 + n/4 + ...) sums to 2n. In practice, expect 2n to 4n comparisons depending on pivot luck. This is optimal for comparison-based selection -- you must inspect every element at least once, so n is a lower bound.',
        'Worst case: O(n^2). If every pivot is the minimum or maximum, the range shrinks by only one element per round. Work becomes n + (n-1) + (n-2) + ... + 1 = n(n+1)/2. Sorted or reverse-sorted input with last-element pivot triggers this. Random pivot selection makes the probability vanishingly small. Median-of-medians (BFPRS, 1973) eliminates it entirely, guaranteeing O(n) worst case with a larger constant factor (roughly 5x slower on average inputs).',
        'Space: O(1) extra with in-place partitioning. Recursion depth is O(log n) expected, O(n) worst case. Tail-call optimization or an iterative rewrite caps stack usage at O(1).',
        'Scaling: doubling n roughly doubles work. 1,000 elements take about 2,000-4,000 comparisons. 1,000,000 elements take 2-4 million. Sorting a million elements needs about 20 million comparisons -- roughly 5-10x more.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Finding the median. This is the canonical use case: k = n/2, and sorting does 5-10x more work than necessary. NumPy\'s numpy.median and numpy.percentile call introselect internally.',
        'Top-k retrieval in search ranking, recommendation engines, and leaderboard systems. When k is moderate, quickselect partitions the k smallest elements to the left side in O(n) average time. For very small k, a size-k min-heap in O(n log k) competes; for k near n/2, quickselect dominates.',
        'Database percentile queries. Engines use quickselect variants for PERCENTILE_CONT, MEDIAN, and NTILE aggregates. The query planner knows only one rank is needed, so it picks O(n) selection over O(n log n) sorting.',
        'C++ std::nth_element rearranges a range so that the nth element sits at its sorted position, with smaller elements before it and larger elements after it. Most standard library implementations use introselect. This is the production selection algorithm in systems-level C++.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'O(n^2) worst case without protection. If pivot selection is deterministic and predictable (always last element, always first element), an adversary can craft input where every pivot is extreme. Random pivot selection makes this astronomically unlikely; introselect eliminates it. The deterministic scheme shown in this visualization is chosen for clarity, not safety.',
        'Quickselect is destructive. It rearranges the array in place. If the original order matters, copy the array first, adding O(n) space.',
        'Repeated selections do not amortize. Finding both the 25th and 75th percentiles costs two full passes at roughly 2n each. Sorting once at O(n log n) then indexing both positions is simpler and often faster. If you need many order statistics from the same data, sort.',
        'Streaming data defeats it. If elements arrive one at a time and you need a running median, quickselect would re-scan the entire array on each arrival. A two-heap structure (max-heap for the lower half, min-heap for the upper half) maintains the median in O(log n) per insertion.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Find the 3rd smallest in [3, 6, 2, 8, 1, 7, 5, 4]. Target index: 2 (0-based).',
        'Round 1: pivot = 4 (last element). Scan positions 0..6. 3 <= 4, already at boundary, boundary advances to 1. 6 > 4, stays. 2 <= 4, swap with position 1: array becomes [3, 2, 6, 8, 1, 7, 5, 4], boundary advances to 2. 8 > 4, stays. 1 <= 4, swap with position 2: [3, 2, 1, 8, 6, 7, 5, 4], boundary advances to 3. 7 > 4, stays. 5 > 4, stays. Swap pivot to boundary: [3, 2, 1, 4, 6, 7, 5, 8]. Pivot 4 lands at position 3.',
        'Target index 2 < pivot position 3. Recurse into the left partition [3, 2, 1] (positions 0..2). The right side [6, 7, 5, 8] is irrelevant -- every element there is larger than 4, so none can be the 3rd smallest.',
        'Round 2: pivot = 1 (last element of subarray). Scan positions 0..1. 3 > 1, stays. 2 > 1, stays. Boundary stays at 0. Swap pivot to boundary: [1, 2, 3, 4, 6, 7, 5, 8]. Pivot 1 lands at position 0.',
        'Target index 2 > pivot position 0. Recurse into the right partition [2, 3] (positions 1..2).',
        'Round 3: pivot = 3 (last element of subarray). Scan position 1. 2 <= 3, already at boundary, boundary advances to 2. Swap pivot to boundary: no movement needed, 3 is already at position 2. Pivot 3 lands at position 2.',
        'Target index 2 == pivot position 2. The 3rd smallest is 3. Three rounds, 7 + 2 + 1 = 10 comparisons. The active range shrank from 8 to 3 to 2 to done -- each partition cut away the irrelevant side.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'C.A.R. Hoare, "Find (Algorithm 65)," Communications of the ACM, 1961 -- the original quickselect algorithm, published in the same paper as quicksort. Blum, Floyd, Pratt, Rivest, Tarjan, "Time Bounds for Selection," Journal of Computer and System Sciences, 1973 -- the median-of-medians algorithm (BFPRS), proving that selection can be done in O(n) worst case. Musser, "Introspective Sorting and Selection Algorithms," Software: Practice and Experience, 1997 -- introselect, the hybrid used in C++ and NumPy.',
        'Study next: Quick Sort is the parent algorithm -- quickselect is quicksort that only recurses into one side. Binary Heap enables partial sorting: build a size-k min-heap to find the top k elements in O(n log k), useful when k is much smaller than n. Median-of-Medians (BFPRS) is the deterministic fallback that turns quickselect\'s O(n^2) worst case into guaranteed O(n), at the cost of a larger constant factor.',
      ],
    },
  ],
};
