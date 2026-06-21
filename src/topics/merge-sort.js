// Merge sort: split in half, sort each half, merge the sorted halves.
// Guaranteed O(n log n), and stable — equal values keep their order.

import { arrayState, parseNumberList } from '../core/state.js';

export const topic = {
  id: 'merge-sort',
  title: 'Merge Sort',
  category: 'Sorting',
  summary: 'Divide and conquer: split, sort the halves, then merge them back together.',
  controls: [
    { id: 'values', label: 'Values', type: 'number-list', defaultValue: '8, 3, 8, 1, 9, 2, 5' },
  ],
  run,
};

const idsBetween = (lo, hi) =>
  Array.from({ length: hi - lo + 1 }, (_, k) => `i${lo + k}`);

export function* run(input) {
  const values = parseNumberList(input.values, { max: 10 });

  yield {
    state: arrayState(values),
    highlight: {},
    explanation: 'Merge sort\'s insight: merging two ALREADY-SORTED lists is easy — just keep taking the smaller front item. So: split the array until every piece is size 1 (trivially sorted), then merge upward.',
  };

  yield* mergeSort(values, 0, values.length - 1);

  yield {
    state: arrayState(values),
    highlight: { sorted: values.map((_, i) => `i${i}`) },
    explanation: `Sorted! The array was split log n times, and each level of merging touched all n elements once: O(n log n), guaranteed, no matter how hostile the input. That predictability is merge sort's brand.`,
  };
}

function* mergeSort(values, lo, hi) {
  if (lo >= hi) return; // a single element is already sorted

  const mid = Math.floor((lo + hi) / 2);
  yield {
    state: arrayState(values),
    highlight: { range: idsBetween(lo, hi), active: [`i${mid}`] },
    explanation: `Split positions ${lo}–${hi} into two halves: ${lo}–${mid} and ${mid + 1}–${hi}. Each half gets sorted on its own before we merge.`,
  };

  yield* mergeSort(values, lo, mid);
  yield* mergeSort(values, mid + 1, hi);
  yield* merge(values, lo, mid, hi);
}

function* merge(values, lo, mid, hi) {
  const left = values.slice(lo, mid + 1);
  const right = values.slice(mid + 1, hi + 1);
  let l = 0;
  let r = 0;

  for (let write = lo; write <= hi; write += 1) {
    let takeLeft;
    let why;
    if (l >= left.length) {
      takeLeft = false;
      why = `The left half is used up — copy the rest of the right half over.`;
    } else if (r >= right.length) {
      takeLeft = true;
      why = `The right half is used up — copy the rest of the left half over.`;
    } else if (left[l] <= right[r]) {
      // `<=` matters twice: equal values take from the LEFT (keeping the sort
      // stable), and the tie always makes progress (a strict `<` on both
      // sides is the classic bug that loops forever on duplicates).
      takeLeft = true;
      why = left[l] === right[r]
        ? `Both fronts are ${left[l]} — a tie. Take from the LEFT half: ties must still make progress (the classic merge bug loops forever here), and taking left keeps equal values in their original order, which is what "stable" means.`
        : `Compare the fronts: ${left[l]} vs ${right[r]}. The left's ${left[l]} is smaller, so it goes next.`;
    } else {
      takeLeft = false;
      why = `Compare the fronts: ${left[l]} vs ${right[r]}. The right's ${right[r]} is smaller, so it goes next.`;
    }

    values[write] = takeLeft ? left[l++] : right[r++];
    yield {
      state: arrayState(values),
      highlight: { range: idsBetween(lo, hi), active: [`i${write}`] },
      explanation: `Merging ${lo}–${hi}. ${why} Write ${values[write]} at position ${write}.`,
      invariant: 'Everything already written in this merge is in its final relative order.',
    };
  }

  yield {
    state: arrayState(values),
    highlight: { sorted: idsBetween(lo, hi) },
    explanation: `Positions ${lo}–${hi} are now one sorted run, ready to be merged with a neighbor at the level above.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows merge sort in two phases. In the split phase, the array is divided in half repeatedly until every piece is a single element. Highlighted ranges show which subarray is being split, and the active marker sits on the midpoint.',
        'In the merge phase, two sorted runs are combined into one. The active marker highlights the position currently being written. The range highlight covers the two runs being merged. When a merge finishes, those positions turn to the sorted color, meaning that run is in final order and ready to merge with a neighbor at the next level up.',
        'Watch for the two-pointer pattern during merges: the algorithm compares the front elements of the left and right runs, takes the smaller one, and advances that pointer. On ties, it takes from the left run to preserve stability.',
        {type: 'callout', text: 'Merge sort wins by delaying movement until two sorted runs can be merged in one linear pass.'},
      
        {type: 'image', src: './assets/gifs/merge-sort.gif', alt: 'Animated walkthrough of the merge sort visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Merge sort is one of the oldest algorithms in computing. John von Neumann described it in 1945, before stored-program computers existed, as part of the EDVAC report. It solved a fundamental problem: how to sort data with a guaranteed time bound and stable output.',
        'The guarantee is O(n log n) in every case -- best, average, and worst. No adversarial input can force it into quadratic behavior. That predictability, combined with stability (equal values keep their original order), makes merge sort the foundation of most production sorting code. Python\'s built-in sort (Timsort) and Java\'s Arrays.sort for objects both descend from this idea.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Insertion sort is the natural first attempt. Walk through the array left to right. For each new element, shift it backward through the sorted prefix until it lands in the right spot. The logic is simple and it works well on small or nearly sorted data.',
        'The cost is O(n) comparisons and shifts per insertion in the worst case, because each new element might need to travel all the way to the front. With n elements, that gives O(n²) total work.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Insertion sort moves each element at most one position per comparison. When the input is reverse-sorted, every element must travel from the end to the front of the sorted prefix. The first element shifts 0 times, the second shifts 1, the third shifts 2, and so on: 0 + 1 + 2 + ... + (n-1) = n(n-1)/2 shifts. That is O(n²).',
        'The problem is structural: local swaps cannot move information across the array quickly. An element near the end that belongs at the front must pass through every intermediate position. No amount of cleverness within the compare-and-shift framework avoids this quadratic cost on hostile inputs.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Merge sort sidesteps local movement entirely. Instead of shifting elements one position at a time, it divides the array in half, sorts each half recursively, and merges the two sorted halves.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Merge_sort_algorithm_diagram.svg/600px-Merge_sort_algorithm_diagram.svg.png', alt: 'Merge sort diagram showing recursive splitting and merging of sorted runs', caption: 'The diagram shows the key shape: split to singletons, then merge sorted runs upward. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Merge_sort_algorithm_diagram.svg.'},
        'The recursion bottoms out at single elements, which are trivially sorted. Then the merge phase builds sorted runs from the bottom up: pairs of single elements merge into sorted pairs, pairs of sorted pairs merge into sorted quads, and so on until the whole array is one sorted run.',
        'The merge procedure is the key operation. Given two sorted runs, place a read pointer at the front of each. Compare the two front elements. Copy the smaller one to the output and advance that pointer. Repeat until one run is exhausted, then copy the remainder of the other run. This always takes O(n) time for n total elements across the two runs, because each element is read once and written once.',
        'The recurrence is T(n) = 2T(n/2) + O(n). Two subproblems of half the size, plus linear merge work. By the Master Theorem (or by counting levels), the solution is O(n log n).',
        'A bottom-up variant avoids recursion: start with runs of length 1, merge adjacent pairs into runs of length 2, then 4, then 8, doubling until the array is one run. The work per level is the same. This variant maps cleanly to external sorting, where runs live on disk.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'A single element is sorted by definition. That is the base case.',
        'The merge step preserves sorted order. Suppose the left and right runs are both sorted. The next output element must be either the left front or the right front. It cannot be a later element in the left run, because left elements are sorted and later ones are at least as large as the front. Same for the right run. So taking the smaller front element is always safe.',
        'After writing it, advance that run\'s pointer. The same argument applies to the next output position. Repeat until one run is empty, then copy the rest of the other (already sorted) run.',
        'By induction on subarray size: if both halves are sorted correctly, the merge produces one sorted array. The recursion builds from single-element base cases to the full array.',
        'Stability comes from a single rule: when the left front and right front are equal, take from the left. At each merge level, left-run elements appeared earlier in the original array than equal elements in the right run. Breaking ties in favor of the left preserves original order among equal keys.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Time: O(n log n) in all cases. The recursion tree has log₂(n) levels because each split halves the range. At each level, every element participates in exactly one merge, so the total work per level is O(n). Multiplying: O(n) work per level times log₂(n) levels equals O(n log n). There are no bad inputs -- reverse-sorted, already sorted, all duplicates, adversarial permutations all cost the same.',
        'Space: O(n) auxiliary memory for the merge buffer, plus O(log n) stack frames for the recursive version. Production implementations allocate one buffer and reuse it across all merge calls rather than slicing new arrays at each level.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/0/0c/ComputerMemoryHierarchy.svg', alt: 'Computer memory hierarchy from registers through caches to storage', caption: 'Merge sort spends predictable comparison work, but the auxiliary buffer still moves data through the memory hierarchy. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:ComputerMemoryHierarchy.svg.'},
        'Stability: yes. Equal keys keep their original relative order, provided ties are broken in favor of the left run.',
        'Doubling behavior: when n doubles, the work roughly doubles plus one extra level of merging. 1,000 elements take about 10,000 operations. 1,000,000 elements take about 20,000,000. Doubling the input adds one merge level, contributing n more operations.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'External sorting. When data is too large for memory, sort chunks that fit in RAM, write sorted runs to disk, then merge runs in passes. Merge sort\'s sequential access pattern is friendly to disks and SSDs. This is the algorithm behind Unix sort, database bulk-load operations, and MapReduce\'s shuffle phase.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/b/b6/MapReduce.svg', alt: 'MapReduce execution diagram with map tasks shuffle reduce tasks and output', caption: 'MapReduce shuffle uses the same sorted-run idea at cluster scale: partition, sort locally, then merge grouped streams. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:MapReduce.svg.'},
        'Linked list sorting. Merging two sorted linked lists requires only pointer rewiring, not copying to an auxiliary buffer. Merge sort on linked lists uses O(1) extra space beyond the list nodes themselves, removing its main disadvantage compared to quicksort.',
        'Stable sorting requirements. When sorting records by multiple fields (sort by date, then stably sort by department), stability is essential. Merge sort provides it naturally. Python\'s Timsort and Java\'s Arrays.sort for objects are hybrid merge sorts that exploit natural runs and use insertion sort on small segments.',
        'Guaranteed worst case. In systems where latency spikes are unacceptable (real-time scheduling, database query plans), merge sort\'s O(n log n) worst case is safer than quicksort\'s O(n²) worst case, even though quicksort is often faster in practice.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'O(n) extra space for arrays. Quicksort sorts in-place with O(log n) stack space. On memory-constrained systems, that difference matters. In-place merge sort algorithms exist (Kronrod 1969) but they are complex, have large constants, and lose much of merge sort\'s practical speed.',
        'Slower than quicksort in practice on arrays. Quicksort\'s inner loop is a single comparison and a pointer increment, with excellent cache locality because it works on a contiguous partition. Merge sort copies elements to and from an auxiliary buffer, adding allocation overhead and cache misses. On random arrays in memory, quicksort typically wins by a constant factor.',
        'Not in-place. Every merge needs a temporary buffer to avoid overwriting elements before they are read. The standard trick of using one pre-allocated buffer helps, but the algorithm fundamentally cannot merge two adjacent sorted runs into the same memory without extra space (or without the complexity of block-merge algorithms).',
        'Overkill for small arrays. Insertion sort\'s low overhead and good cache behavior make it faster than merge sort for arrays under roughly 16-64 elements. That is why Timsort and other production sorts switch to insertion sort below a threshold.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Input: [38, 27, 43, 3, 9, 82, 10].',
        'Split phase. Divide at midpoint: [38, 27, 43, 3] and [9, 82, 10]. Divide again: [38, 27] [43, 3] | [9, 82] [10]. Divide to leaves: [38] [27] [43] [3] [9] [82] [10]. Seven single-element runs, each trivially sorted.',
        'Merge level 1 (pairs). [38] + [27]: compare 38 vs 27, take 27, then take 38. Result: [27, 38]. [43] + [3]: compare 43 vs 3, take 3, then take 43. Result: [3, 43]. [9] + [82]: compare 9 vs 82, take 9, then take 82. Result: [9, 82]. [10] has no partner, stays as [10].',
        'Merge level 2 (quads). [27, 38] + [3, 43]: compare 27 vs 3, take 3. Compare 27 vs 43, take 27. Compare 38 vs 43, take 38. Take 43. Result: [3, 27, 38, 43]. [9, 82] + [10]: compare 9 vs 10, take 9. Compare 82 vs 10, take 10. Take 82. Result: [9, 10, 82].',
        'Final merge. [3, 27, 38, 43] + [9, 10, 82]: compare 3 vs 9, take 3. Compare 27 vs 9, take 9. Compare 27 vs 10, take 10. Compare 27 vs 82, take 27. Compare 38 vs 82, take 38. Compare 43 vs 82, take 43. Take 82. Result: [3, 9, 10, 27, 38, 43, 82].',
        'Total comparisons: 1 + 1 + 1 + 3 + 2 + 6 = 14. The information-theoretic minimum for 7 elements is ceil(log₂(7!)) = 13. Merge sort is within one comparison of optimal.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Von Neumann, "First Draft of a Report on the EDVAC" (1945) -- the first known description of merge sort, written for one of the earliest stored-program computer designs. Knuth, The Art of Computer Programming, Volume 3: Sorting and Searching (1998 edition, Section 5.2.4) -- definitive analysis of merge sort variants, optimality proofs, and natural merge sort. Peters, "Timsort" (2002) -- the practical hybrid that powers Python\'s sort and Java\'s Arrays.sort for objects.',
        'Study next: Quick Sort for the in-place average-case alternative and to understand the space-vs-predictability tradeoff. Heap Sort for O(1) extra space with O(n log n) worst case. Timsort for how production code extends merge sort with run detection and insertion sort on small segments. External Sorting for merge sort\'s killer application on disk-sized data. Divide and Conquer for the general pattern that merge sort exemplifies: split, recurse, combine.',
      ],
    },
  ],
};
