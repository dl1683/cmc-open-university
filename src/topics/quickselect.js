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
        'Read the highlighted range as the only part of the array still capable of containing the requested rank. The pivot is the value used to split that range; values moved left of it are less than or equal to it, and values left on the right are greater than it.',
        { type: 'callout', text: 'Quickselect is quicksort with discipline: partition both sides, then spend recursion only on the side that can still contain rank k.' },
        'The safe inference is about rank, not about full order. When the pivot lands at position 3, exactly three positions are known to contain values no larger than the pivot, so any target rank below 3 must be on the left and any target rank above 3 must be on the right.',
        'Found means the pivot landed on the target rank or the active range has shrunk to one value. The dark side of each partition is not being ignored by hope; the partition proof has made it irrelevant.',
      
        {type: 'image', src: './assets/gifs/quickselect.gif', alt: 'Animated walkthrough of the quickselect visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Quickselect solves the selection problem: find the value with rank k in an unsorted array. Rank means sorted position, so the 1st smallest is the minimum, the median is the middle rank, and the nth smallest is the maximum.',
        'A rank query often needs one value, not a sorted list. Median filters, percentiles, top-k cutoffs, and robust statistics all ask for a boundary value that separates smaller data from larger data.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to sort the whole array and read index k - 1. It is easy to trust because a sorted array answers every rank query at once.',
        'Sorting is reasonable when many ranks will be queried later. It is wasteful when the program only needs one rank, because it orders the lower side internally and the upper side internally even though neither order affects the answer.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A comparison sort spends O(n log n) comparisons to establish a total order. A single selection query only needs a partition around one final position.',
        'The wall is overproduction of information. Knowing that 2 comes before 3 among the values below the median does not help prove which value is the median.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Partitioning gives one exact rank for the pivot. After partition, every value on the left is less than or equal to the pivot and every value on the right is greater than the pivot, so the pivot has its final sorted position.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/0/04/Selecting_quickselect_frames.gif', alt: 'Animated quickselect trace narrowing to the selected order statistic', caption: 'The search range shrinks because each pivot rank proves one side irrelevant. Source: Wikimedia Commons, Selecting quickselect frames.gif, CC BY-SA 3.0: https://commons.wikimedia.org/wiki/File:Selecting_quickselect_frames.gif' },
        'Quickselect compares that pivot position with the target rank and recurses into only the side that can still contain the answer. The discarded side may be unsorted, but its internal order no longer matters.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Choose a pivot inside the active range. Scan the range, move values less than or equal to the pivot to the low side, then put the pivot at the boundary between low values and high values.',
        'If the pivot position equals k - 1, return it. If k - 1 is smaller, repeat on the left subarray; if larger, repeat on the right subarray.',
        'Real implementations usually randomize the pivot or use an introselect fallback. The animation uses a fixed last-element pivot because it makes the partition mechanics visible.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness invariant is the partition guarantee. Once the pivot is placed, no element on the right can occupy a rank at or below the pivot, and no element on the left can occupy a rank above the pivot.',
        'Each recursive call keeps the target rank inside the only range that can still contain it. The range strictly shrinks, so the process reaches a one-element range or a pivot at the target rank, both of which identify the answer.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'One partition over m active elements costs O(m). With random pivots, the active range tends to shrink by a constant fraction, so the work behaves like n + n/2 + n/4 + ..., which is O(n). Doubling n roughly doubles the expected work.',
        'The worst case is O(n^2) when every pivot is extreme, because the active range shrinks by one element at a time. Random pivots make this unlikely; introselect switches to a guaranteed linear selection method when the recursion looks unhealthy.',
        'The in-place version uses O(1) extra array space. Recursive implementations use O(log n) expected stack depth and O(n) worst-case stack depth unless written iteratively.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Quickselect is used for medians and percentiles when only a few ranks are needed. Libraries such as C++ nth_element expose this operation directly: place the nth item where it belongs without sorting the rest.',
        'It also supports top-k pipelines. A ranking service can partition around the kth score, keep the side containing the best k items, and only sort that smaller side if presentation order is needed.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Quickselect is the wrong tool when the caller needs a fully sorted result or many ranks from the same data. Sorting once can be cheaper than repeating selection several times.',
        'It also mutates the array unless implemented on a copy. Deterministic bad pivots on adversarial input can force quadratic work, so production code should avoid predictable pivot rules.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Find the 3rd smallest value in [3, 6, 2, 8, 1, 7, 5, 4]. The target index is 2 because ranks are 1-based for users and arrays are 0-based for code.',
        'Use pivot 4. Partition produces [3, 2, 1, 4, 6, 7, 5, 8], so pivot 4 lands at index 3. The target index 2 is smaller, so every value to the right of 4 is too large and the search continues in [3, 2, 1].',
        'Use pivot 1 inside the left range. It lands at index 0, so the target index 2 is to the right; search [2, 3]. Use pivot 3, which lands at index 2, so the 3rd smallest value is 3.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: C. A. R. Hoare, Algorithm 65 Find, Communications of the ACM, 1961; Blum, Floyd, Pratt, Rivest, and Tarjan, Time Bounds for Selection, 1973; Musser, Introspective Sorting and Selection Algorithms, 1997.',
        'Study quicksort next to see the shared partition operation. Then study heaps for partial selection, median-of-medians for worst-case linear selection, and order-statistic trees for repeated rank queries under updates.',
      ],
    },
  ],
};