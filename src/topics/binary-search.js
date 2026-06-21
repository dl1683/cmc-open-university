// Binary search: halve the search range on every comparison.
// Requires sorted input — that requirement is the whole trick.

import { arrayState, parseNumberList, parseNumber } from '../core/state.js';

export const topic = {
  id: 'binary-search',
  title: 'Binary Search',
  category: 'Searching',
  summary: 'Find anything in a sorted array in O(log n) by repeatedly checking the middle.',
  controls: [
    { id: 'values', label: 'Values', type: 'number-list', defaultValue: '4, 23, 8, 15, 42, 16, 2, 11' },
    { id: 'target', label: 'Search for', type: 'number', defaultValue: '16' },
  ],
  run,
};

const idsBetween = (lo, hi) =>
  Array.from({ length: hi - lo + 1 }, (_, k) => `i${lo + k}`);

export function* run(input) {
  const raw = parseNumberList(input.values);
  const target = parseNumber(input.target, { label: 'a target' });
  const values = [...raw].sort((a, b) => a - b);
  const wasSorted = values.every((value, i) => value === raw[i]);

  yield {
    state: arrayState(values),
    highlight: {},
    explanation: `${wasSorted ? 'The array is already sorted — good, because that is a hard requirement.' : 'Binary search only works on sorted data, so we sorted your input first.'} We are looking for ${target}.`,
  };

  let lo = 0;
  let hi = values.length - 1;
  let comparisons = 0;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    comparisons += 1;
    const isMatch = values[mid] === target;
    yield {
      state: arrayState(values),
      highlight: { range: idsBetween(lo, hi), active: [`i${mid}`] },
      explanation: `If ${target} is here at all, it must be between positions ${lo} and ${hi}. Check the middle, position ${mid}: is ${values[mid]} equal to ${target}?${isMatch ? ' Yes!' : ''}`,
      invariant: 'If the target exists, it lies inside the highlighted range.',
    };

    if (isMatch) {
      yield {
        state: arrayState(values),
        highlight: { found: [`i${mid}`] },
        explanation: `Found ${target} at position ${mid} in just ${comparisons} comparison${comparisons === 1 ? '' : 's'} — out of ${values.length} elements. Each comparison halved the range: that is O(log n).`,
      };
      return;
    }

    if (values[mid] < target) {
      lo = mid + 1;
      yield {
        state: arrayState(values),
        highlight: lo <= hi
          ? { range: idsBetween(lo, hi), visited: idsBetween(0, mid) }
          : { visited: idsBetween(0, mid) },
        explanation: `${values[mid]} is smaller than ${target}. Since the array is sorted, everything at or left of position ${mid} is too small — throw away that entire half.`,
      };
    } else {
      hi = mid - 1;
      yield {
        state: arrayState(values),
        highlight: lo <= hi
          ? { range: idsBetween(lo, hi), visited: idsBetween(mid, values.length - 1) }
          : { visited: idsBetween(mid, values.length - 1) },
        explanation: `${values[mid]} is larger than ${target}. Everything at or right of position ${mid} is too large — throw away that entire half.`,
      };
    }
  }

  yield {
    state: arrayState(values),
    highlight: {},
    explanation: `The range is empty — ${target} is not in the array. We knew that after only ${comparisons} comparisons. Linear search would have needed up to ${values.length}.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The highlighted range is the live search interval: every position where the target could still be. The active marker is the midpoint being tested. Visited positions have been proven impossible by a prior comparison. Found means the target matched.',
        'Watch the range, not just the midpoint. Each step should cut the highlighted region roughly in half. If the range does not shrink, the update rule is wrong. lo and hi move inward; they never move outward. The midpoint is computed as lo + floor((hi - lo) / 2) to avoid integer overflow.',
        {type: 'callout', text: 'Binary search works because sorted order converts one midpoint comparison into a proof that half the interval is impossible.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Binary_Search_Depiction.svg/250px-Binary_Search_Depiction.svg.png', alt: 'Binary search narrowing a sorted array to a target value.', caption: 'Each midpoint comparison removes one side of the sorted interval. (Source: Wikimedia Commons)'},
        'For an 8-element array, the animation should finish in at most 3 comparisons. Count the steps yourself to confirm logarithmic behavior.',
      
        {type: 'image', src: './assets/gifs/binary-search.gif', alt: 'Animated walkthrough of the binary search visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Searching sorted data is one of the oldest problems in computing. John Mauchly described the idea of halving a search range in 1946, but the first published correct implementation did not appear until Bottenbruch wrote one in 1962. The gap between "obvious idea" and "correct code" is the entire story of binary search.',
        'The algorithm finds a target value in a sorted array by checking the middle element and discarding the half that cannot contain the answer. One comparison eliminates half the candidates. Two comparisons eliminate three quarters. Thirty comparisons are enough to search a billion elements.',
        'The sorted-order requirement is non-negotiable. On unsorted data, Linear Search is the honest baseline because every position is equally likely. If you will search the same data many times, paying O(n log n) to sort it once makes every later lookup O(log n).',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Linear scan: start at position 0 and check every element until you find the target or reach the end. It works on any array, sorted or not, and it is simple to write correctly. For small arrays, it is fast enough.',
        'The cost is O(n). A million elements means up to a million comparisons. A billion elements means up to a billion. The scan treats every position as equally likely and ignores any structure the data might have. When the array is sorted, that ignorance is expensive.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Linear search wastes information. Each failed comparison proves exactly one thing: this position is not the target. In a sorted array, a single comparison against the midpoint proves that half the array is impossible. Linear search never asks a question whose answer covers more than one position.',
        'Put numbers on it. A sorted array of one billion elements: linear scan needs up to 1,000,000,000 comparisons. Binary search needs at most ceil(log2(1,000,000,000)) = 30. The gap grows with every element you add.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Sorted order turns one comparison into a proof about half the data. If the middle value is less than the target, every value to its left is also less, because the array is sorted. The entire left half is eliminated by a single test. The midpoint is just the question that buys that proof as cheaply as possible.',
        'The invariant is sharper than "look at the middle until it works." The correct statement: if the target exists in the array, it lies inside the closed interval [lo, hi]. Every bound update must preserve that statement. When lo passes hi, the interval is empty and absence is proven.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Maintain two boundaries, lo and hi, around the range where the answer might live. Compute mid = lo + floor((hi - lo) / 2). The formula lo + floor((hi - lo) / 2) gives the same result as floor((lo + hi) / 2) but avoids integer overflow when lo + hi exceeds the maximum integer. Java\'s Arrays.binarySearch shipped with the overflow bug for nine years (2003-2006) before Joshua Bloch discovered and fixed it.',
        'Compare array[mid] to the target. If they are equal, return mid. If array[mid] is less than the target, set lo = mid + 1 to discard the left half including mid. If array[mid] is greater, set hi = mid - 1 to discard the right half including mid. When lo > hi, the range is empty and the target is absent.',
        'Three variants matter in practice. Exact match returns the index of a specific value or reports absence. Lower bound finds the first position where the value is greater than or equal to the target, which is the insertion point. Upper bound finds the first position where the value is strictly greater than the target. Lower and upper bound together answer range queries: how many elements fall between two values?',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness proof is an invariant argument. Claim: at the top of every loop iteration, if the target exists in the array, it lies in [lo, hi]. Base case: lo = 0 and hi = n - 1 cover the entire array, so the invariant holds trivially. Inductive step: when array[mid] < target, every index from lo to mid holds a value smaller than the target (sorted order), so narrowing to [mid + 1, hi] preserves the invariant. The symmetric argument holds when array[mid] > target.',
        'Termination: each iteration reduces hi - lo by at least 1 because mid is excluded from the next range. The range cannot shrink below zero, so the loop must terminate. When it does, either we found the target or the empty interval proves absence.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Time: O(log n) worst and average case. Every comparison halves the range, so the maximum number of comparisons is ceil(log2(n)). Concrete: 1,024 items take at most 10 comparisons. 1,000,000 items take at most 20. 1,000,000,000 items take at most 30. Doubling the input adds exactly one comparison.',
        'Space: O(1) for the iterative version. A recursive version uses O(log n) stack frames, which is small but not free.',
        'Binary search on arrays is cache-friendly because array elements are contiguous in memory and access is sequential within each halving step. This is one reason sorted arrays often beat binary search trees in practice for static data, even though both offer O(log n) lookup.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Standard libraries expose binary search directly. Python\'s bisect module provides bisect_left (lower bound) and bisect_right (upper bound). C++ offers std::lower_bound, std::upper_bound, and std::binary_search. Java has Arrays.binarySearch and Collections.binarySearch.',
        'Database indexes are built on the same principle. B-Trees keep keys sorted inside wide disk-page-sized nodes so a single page read eliminates a large range of possible rows. The lookup within each node is essentially a binary search.',
        'Git bisect uses binary search on commit history to find the first commit that introduced a bug. You mark one commit as good and one as bad; git checks out the midpoint and asks you to test it. Each answer halves the suspect range. Finding a bug among 1,024 commits takes at most 10 tests.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The data must be sorted. If the array changes frequently, maintaining sorted order costs O(n) per insertion (shifting elements). A binary search tree or balanced tree is better for dynamic data.',
        'Binary search requires random access. On a linked list, finding the midpoint requires walking n/2 nodes, destroying the O(log n) guarantee. The algorithm needs O(1) access to any index.',
        'Off-by-one bugs are legendary. Bentley reported in Programming Pearls (1986) that 90% of professional programmers could not write a correct binary search on their first try. The common errors: using lo < hi when the update rules assume lo <= hi, forgetting to exclude mid from the next range (causing infinite loops), and the integer overflow bug in mid = (lo + hi) / 2 when lo + hi exceeds 2^31. That last bug silently shipped in Java\'s standard library for nine years.',
        'Binary search finds one matching index, not all of them. With duplicates, returning the first or last occurrence requires the lower-bound or upper-bound variant, not the simple exact-match version. Mixing the loop condition of one variant with the update rules of another is the most common source of subtle bugs.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Array: [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]. Target: 23.',
        'Iteration 1: lo = 0, hi = 9. mid = 0 + floor((9 - 0) / 2) = 4. array[4] = 16. 16 < 23, so the target is to the right. Set lo = 5. The range [0..4] is eliminated.',
        'Iteration 2: lo = 5, hi = 9. mid = 5 + floor((9 - 5) / 2) = 7. array[7] = 56. 56 > 23, so the target is to the left. Set hi = 6. The range [7..9] is eliminated.',
        'Iteration 3: lo = 5, hi = 6. mid = 5 + floor((6 - 5) / 2) = 5. array[5] = 23. Match. Return index 5.',
        'Three comparisons to find the target in a 10-element array. A linear scan starting from the left would have needed 6 comparisons. The savings grow with array size: a 10,000-element array needs at most 14 binary search comparisons versus up to 10,000 for linear scan.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Knuth, The Art of Computer Programming, Volume 3, Section 6.2.1: the definitive analysis of binary search, including history and variant taxonomy. Bentley, Programming Pearls (1986): the "90% get it wrong" study and the overflow bug. Bloch, "Extra, Extra - Read All About It: Nearly All Binary Searches and Mergesorts are Broken" (2006): the Java overflow bug post-mortem.',
        'Prerequisite gaps: review Linear Search for the unsorted baseline, and Big-O Growth Rates until O(log n) versus O(n) feels concrete. Natural extensions: Interpolation Search guesses the midpoint from the value distribution, reaching O(log log n) on uniform data but O(n) on skewed data. Exponential Search finds the right range to binary search when the array size is unknown. Production versions: B-Trees generalize binary search for disk-friendly nodes. Binary Search Tree applies the halving logic to a linked structure supporting dynamic insertion. Contrasting alternatives: Hash Table gives O(1) average exact lookup but loses sorted order and range query support.',
      ],
    },
  ],
};

