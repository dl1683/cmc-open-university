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
        'The animation shows a sorted array with three visual states. The highlighted range marks the live search interval: every index where the target could still hide. The active marker sits on the midpoint currently being tested. Visited cells have been eliminated by a prior comparison and will never be checked again.',
        'Focus on the shrinking range, not just the active cell. Each step should cut the highlighted region roughly in half. The two boundaries, lo and hi, only ever move inward. If you see them jump outward, the algorithm has a bug. The midpoint is computed as lo + floor((hi - lo) / 2), a formula chosen to avoid integer overflow in languages with fixed-width integers.',
        {type: 'callout', text: 'Binary search works because sorted order converts one midpoint comparison into a proof that half the interval is impossible.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Binary_Search_Depiction.svg/250px-Binary_Search_Depiction.svg.png', alt: 'Binary search narrowing a sorted array to a target value.', caption: 'Each midpoint comparison removes one side of the sorted interval. (Source: Wikimedia Commons)'},
        'For an 8-element array, the animation finishes in at most 3 comparisons because ceil(log2(8)) = 3. Count the comparison steps yourself to confirm the logarithmic behavior. If the target is absent, the animation ends when the highlighted range collapses to nothing, proving absence without ever scanning every cell.',
        {type: 'image', src: './assets/gifs/binary-search.gif', alt: 'Animated walkthrough of the binary search visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Looking things up in a sorted list is one of the oldest problems in computing. John Mauchly described the idea of halving a telephone directory to find a name in 1946, during the Moore School Lectures. The concept is simple enough to explain in one sentence: check the middle, throw away the wrong half, repeat. Yet the first published bug-free implementation did not appear until Bottenbruch wrote one in Fortran in 1962, sixteen years later.',
        'That gap between obvious idea and correct code defines binary search. The algorithm matters because it turns the cost of searching from proportional to the data size (linear) into proportional to the number of digits in the data size (logarithmic). One comparison eliminates half the remaining candidates. Two comparisons eliminate three quarters. Thirty comparisons are enough to find any value in a billion-element array.',
        'The prerequisite is strict: the array must be sorted. On unsorted data, no midpoint comparison tells you anything about the elements on either side, so you are stuck with linear scan. If you plan to search the same collection many times, paying O(n log n) once to sort it converts every subsequent lookup from O(n) to O(log n). That tradeoff is the economic engine behind database indexes, dictionary lookups, and most of the fast retrieval you use daily.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest search is a linear scan. Start at index 0, compare each element to the target, and stop when you find a match or exhaust the array. It works on any array regardless of order, and the code is almost impossible to get wrong. For small arrays (say, under 20 elements), it is fast enough that fancier methods add complexity without meaningful speedup.',
        'The cost is O(n) in the worst case: if the target is the last element or absent, you touch every cell. A million-element array means up to a million comparisons. A billion-element array means up to a billion. Linear scan treats every position as equally promising and ignores any ordering the data might have. When the data is sorted, that deliberate ignorance becomes the bottleneck.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Linear search wastes information. When you compare the target against position 500 and find a mismatch, you have learned one fact: position 500 is not the target. You have learned nothing about positions 0 through 499 or 501 through 999. In a sorted array, that same comparison at the midpoint proves something about half the array. If the midpoint value is less than the target, every value to its left is also less, and none of them can be the target. One question eliminates 500 positions instead of one.',
        'The waste becomes concrete at scale. A sorted array of one billion elements: linear scan needs up to 1,000,000,000 comparisons in the worst case. Binary search needs at most ceil(log2(1,000,000,000)) = 30. The linear cost grows with the data; the binary search cost grows with the number of times you can halve the data before reaching a single element. Every time the array doubles in size, binary search pays exactly one more comparison. Linear search pays the entire extra half.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Sorted order is a global constraint: every element to the left of any position is less than or equal to it, and every element to the right is greater than or equal. Binary search exploits this constraint by choosing the question that extracts the most information per comparison. Comparing the target to the midpoint splits the remaining candidates into two halves. The comparison result eliminates one half entirely. The midpoint is optimal because it guarantees the surviving half is at most half the original range, regardless of which side survives.',
        'The algorithm is governed by a single invariant: if the target exists in the array, it lies within the closed interval [lo, hi]. Every operation in the algorithm either finds the target or narrows [lo, hi] while preserving this invariant. When lo exceeds hi, the interval is empty, and that emptiness is a proof that the target is absent. This invariant is not a vague intuition; it is the exact statement you would use in a formal correctness proof, and every line of the implementation must preserve it.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Initialize lo = 0 and hi = n - 1, where n is the array length. These two boundaries define the range of indices where the target might live. Compute mid = lo + Math.floor((hi - lo) / 2). This formula is equivalent to Math.floor((lo + hi) / 2) but avoids a subtle overflow bug: in languages with 32-bit integers, lo + hi can exceed 2^31 - 1 when both are large. Java\'s Arrays.binarySearch shipped with the naive formula from 2003 to 2006 before Joshua Bloch discovered the bug.',
        'Compare array[mid] to the target. Three outcomes are possible. If they are equal, the search is done: return mid. If array[mid] is less than the target, the target must be to the right of mid (because the array is sorted), so set lo = mid + 1. If array[mid] is greater, the target must be to the left, so set hi = mid - 1. In both update cases, mid itself is excluded from the next range because it has already been tested and failed. Repeat until lo > hi, at which point the target is absent.',
        'Three variants cover the practical use cases. Exact match, described above, returns the index of a specific value or reports absence. Lower bound (sometimes called bisect_left) finds the smallest index i such that array[i] >= target. This is the insertion point: the position where you would insert the target to keep the array sorted. Upper bound (bisect_right) finds the smallest index i such that array[i] > target. Together, lower_bound(x) and upper_bound(x) bracket the range of all occurrences of x, answering range queries like "how many elements equal 23?" in O(log n).',
        'The lower-bound variant differs from exact match in two ways. First, the loop condition uses lo < hi (strict) instead of lo <= hi. Second, when array[mid] >= target, you set hi = mid (not mid - 1) because mid might be the answer. When array[mid] < target, you set lo = mid + 1 as before. The loop exits when lo == hi, and that single index is the result. Mixing the loop condition of one variant with the update rules of another is the most common source of binary search bugs.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness follows from the loop invariant by induction. Claim: at the start of every iteration, if the target exists in the array, then lo <= target_index <= hi. Base case: lo = 0 and hi = n - 1 cover every valid index, so the claim holds trivially before the first iteration. Inductive step: suppose the claim holds at the start of some iteration. If array[mid] < target, sorted order guarantees array[j] <= array[mid] < target for every j in [lo, mid], so the target cannot be at any of those indices. Setting lo = mid + 1 excludes only indices proven impossible, preserving the invariant. The symmetric argument applies when array[mid] > target and we set hi = mid - 1.',
        'Termination is guaranteed because the range shrinks every iteration. The quantity hi - lo + 1 (the number of candidate indices) is a non-negative integer. Each iteration either finds the target and returns, or excludes at least mid from the range, reducing the candidate count by at least 1. A non-negative integer that decreases by at least 1 every step must eventually reach zero, at which point lo > hi and the loop exits. At that moment, the invariant tells us the target, if it existed, would be in an empty range, so it does not exist.',
        'The lower-bound variant has a slightly different termination argument. The range [lo, hi] shrinks by at least 1 each iteration because mid = lo + floor((hi - lo) / 2) satisfies lo <= mid < hi (strict inequality on the right when lo < hi), so both branches reduce the range. The loop exits when lo == hi, and the invariant ensures that index is the insertion point.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Time complexity is O(log n) in both worst and average cases. Each comparison halves the search range, so the maximum number of comparisons is ceil(log2(n)). Concrete numbers: 8 elements need at most 3 comparisons, 1,024 need at most 10, 1,000,000 need at most 20, and 1,000,000,000 need at most 30. Doubling the array size adds exactly one extra comparison. This is the defining behavior of logarithmic growth: the cost scales with the number of times you can halve the input, not with the input itself.',
        'Space complexity is O(1) for the iterative version: three integer variables (lo, hi, mid) and no auxiliary data structures. A recursive implementation uses O(log n) stack frames, one per recursive call, which is small in practice (30 frames for a billion elements) but matters in stack-constrained environments like embedded systems or deeply nested call chains.',
        'Binary search on a contiguous array is cache-friendly in practice. The first few comparisons touch widely separated memory addresses, but as the range narrows, successive midpoints land in the same cache line. For static data that does not change after sorting, a sorted array with binary search often outperforms a binary search tree because the array has no pointer overhead, no allocation fragmentation, and better spatial locality. The BST wins only when the data is dynamic and insertions or deletions are frequent.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Every major standard library ships a binary search implementation. Python\'s bisect module provides bisect_left (lower bound) and bisect_right (upper bound), plus insort for maintaining sorted insertion. C++ provides std::lower_bound, std::upper_bound, std::binary_search, and std::equal_range in <algorithm>. Java has Arrays.binarySearch for primitives and Collections.binarySearch for objects. JavaScript\'s typed arrays lack a built-in binary search, but the algorithm is short enough that hand-rolling it is common.',
        'Database indexes are the industrial-scale application. A B-Tree stores keys in sorted order within wide, disk-page-sized nodes. Looking up a key walks from the root to a leaf, performing a binary search within each node to decide which child to follow. A B-Tree with branching factor 1,000 can index a trillion rows in just four levels. The binary search inside each node is what makes each level traversal fast.',
        'Git bisect applies binary search to commit history. You mark one commit as "good" (bug absent) and another as "bad" (bug present). Git checks out the commit halfway between them and asks you to test it. Your answer eliminates half the suspect commits. Finding the guilty commit among 1,024 takes at most 10 tests. This is the same algorithm, applied to a sequence of commits instead of an array of numbers.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The sorted-order prerequisite is the primary limitation. If the array changes frequently, maintaining sorted order costs O(n) per insertion because every element after the insertion point must shift right. For dynamic data with interleaved insertions and lookups, a balanced binary search tree (AVL, red-black) or a skip list provides O(log n) for both operations. The sorted array is optimal only when the data is static or changes rarely.',
        'Binary search requires O(1) random access to any index. On a linked list, reaching the midpoint requires walking n/2 pointers, which takes O(n) time and destroys the logarithmic guarantee. The total cost becomes O(n log n), worse than a simple linear scan at O(n). This is why binary search is defined on arrays, not on sequences in general.',
        'Off-by-one errors are the algorithm\'s notorious practical hazard. Bentley reported in Programming Pearls (1986) that when he asked professional programmers to write binary search from scratch, roughly 90% produced incorrect implementations. The common mistakes: using lo < hi as the loop condition when the update rules assume lo <= hi, forgetting to exclude mid from the next range (which causes an infinite loop when lo == hi), and computing mid = (lo + hi) / 2 instead of mid = lo + (hi - lo) / 2 (which overflows for large arrays in 32-bit languages). The Java standard library shipped the overflow bug for nine years before it was caught.',
        'Duplicates introduce a subtle trap. The basic exact-match variant returns some index containing the target, but not necessarily the first or last occurrence. If you need all occurrences, or the first, or the last, you must use the lower-bound or upper-bound variant. A common bug is to use the exact-match loop condition (lo <= hi) with the lower-bound update rule (hi = mid instead of hi = mid - 1), which either misses the answer or loops forever. Each variant has its own matched pair of loop condition and update rules; mixing them across variants is the most frequent source of subtle binary search bugs.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Array: [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]. Ten elements, already sorted. Target: 23. We will trace every variable through each iteration.',
        'Iteration 1: lo = 0, hi = 9. mid = 0 + floor((9 - 0) / 2) = 4. array[4] = 16. Compare: 16 < 23, so the target is strictly to the right of index 4. Set lo = 4 + 1 = 5. The range [0..4] (five elements) is eliminated. Surviving range: [5..9], five elements.',
        'Iteration 2: lo = 5, hi = 9. mid = 5 + floor((9 - 5) / 2) = 7. array[7] = 56. Compare: 56 > 23, so the target is strictly to the left of index 7. Set hi = 7 - 1 = 6. The range [7..9] (three elements) is eliminated. Surviving range: [5..6], two elements.',
        'Iteration 3: lo = 5, hi = 6. mid = 5 + floor((6 - 5) / 2) = 5. array[5] = 23. Compare: 23 == 23. Match found. Return index 5. Total comparisons: 3.',
        'A linear scan from the left would have compared indices 0, 1, 2, 3, 4, 5 before finding 23 at index 5, requiring 6 comparisons. Binary search used 3. The gap widens with scale: in a 10,000-element array, binary search needs at most ceil(log2(10000)) = 14 comparisons, while linear scan may need all 10,000. In a billion-element array, binary search maxes out at 30 comparisons, a factor of 33 million faster than the worst-case linear scan.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Knuth, The Art of Computer Programming, Volume 3, Section 6.2.1, gives the definitive analysis of binary search: history, formal correctness proof, variant taxonomy, and average-case analysis. Bentley, Programming Pearls (1986, Chapter 4), documents the "90% of programmers get it wrong" experiment and walks through the invariant-based derivation. Bloch, "Extra, Extra - Read All About It: Nearly All Binary Searches and Mergesorts are Broken" (Google Research Blog, 2006), is the post-mortem on the Java overflow bug and explains the safe midpoint formula.',
        'Prerequisites: understand Linear Search as the unsorted baseline, and study Big-O Growth Rates until the difference between O(n) and O(log n) feels visceral, not just symbolic. Extensions: Interpolation Search replaces the midpoint with an estimate based on the value distribution, achieving O(log log n) on uniformly distributed data but degrading to O(n) on skewed inputs. Exponential Search finds the right power-of-two range to binary search when the array size is unknown or infinite. For disk-scale data, B-Trees generalize binary search into wide, page-sized nodes. For dynamic data, Binary Search Trees apply the halving idea to a pointer-based structure that supports O(log n) insertion. For exact-match lookups where sorted order is unnecessary, Hash Tables offer O(1) average time but sacrifice range queries entirely.',
      ],
    },
  ],
};

