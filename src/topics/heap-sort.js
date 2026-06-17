// Heap sort: treat the array as a binary tree, make it a max-heap,
// then repeatedly swap the root (the max) to the end of the unsorted zone.
// The array IS the tree: children of index i live at 2i+1 and 2i+2.

import { arrayState, parseNumberList } from '../core/state.js';

export const topic = {
  id: 'heap-sort',
  title: 'Heap Sort',
  category: 'Sorting',
  summary: 'Build a max-heap inside the array, then extract the maximum n times.',
  controls: [
    { id: 'values', label: 'Values', type: 'number-list', defaultValue: '4, 10, 3, 5, 1, 8, 7' },
  ],
  run,
};

const sortedIds = (values, sortedFrom) =>
  values.map((_, i) => `i${i}`).slice(sortedFrom);

export function* run(input) {
  const values = parseNumberList(input.values, { max: 10 });
  const n = values.length;

  yield {
    state: arrayState(values),
    highlight: {},
    explanation: 'Heap sort hides a binary tree inside the array: the children of index i sit at 2i+1 and 2i+2 — no pointers needed. Phase 1 rearranges the array into a MAX-HEAP, where every parent ≥ its children.',
  };

  // Phase 1: build the max-heap, sifting down from the last parent to the root.
  for (let parent = Math.floor(n / 2) - 1; parent >= 0; parent -= 1) {
    yield {
      state: arrayState(values),
      highlight: { active: [`i${parent}`] },
      explanation: `Heapify the subtree rooted at index ${parent} (value ${values[parent]}). We go from the last parent up to the root, so every subtree below is already a valid heap.`,
    };
    yield* siftDown(values, parent, n, 0);
  }

  yield {
    state: arrayState(values),
    highlight: { found: ['i0'] },
    explanation: `The array is now a max-heap: every parent ≥ its children, so the LARGEST value (${values[0]}) sits at index 0. We never fully sorted anything — yet the max is free for the taking.`,
    invariant: 'Max-heap property: values[i] ≥ values[2i+1] and values[2i+2], wherever children exist.',
  };

  // Phase 2: repeatedly move the max to the end and shrink the heap.
  for (let end = n - 1; end > 0; end -= 1) {
    [values[0], values[end]] = [values[end], values[0]];
    yield {
      state: arrayState(values),
      highlight: { swap: ['i0', `i${end}`], sorted: sortedIds(values, end) },
      explanation: `Swap the root (the current maximum, ${values[end]}) into position ${end} — its FINAL home. The sorted zone grows from the right; the heap shrinks to ${end} element${end === 1 ? '' : 's'}.`,
    };
    yield* siftDown(values, 0, end, n - end);
  }

  yield {
    state: arrayState(values),
    highlight: { sorted: values.map((_, i) => `i${i}`) },
    explanation: 'Sorted! Building the heap is O(n); each of the n extractions sifts down at most log n levels → O(n log n) total, in place, with no recursion. The same heap structure powers priority queues.',
  };
}

function* siftDown(values, start, heapSize, sortedCount) {
  const sorted = sortedCount > 0 ? sortedIds(values, heapSize) : [];
  let parent = start;

  while (true) {
    const left = 2 * parent + 1;
    const right = 2 * parent + 2;
    if (left >= heapSize) break;

    const children = right < heapSize ? [left, right] : [left];
    const larger = right < heapSize && values[right] > values[left] ? right : left;
    const violates = values[larger] > values[parent];

    yield {
      state: arrayState(values),
      highlight: { active: [`i${parent}`], compare: children.map((c) => `i${c}`), sorted },
      explanation: `Index ${parent} (${values[parent]}) vs its child${children.length === 2 ? 'ren' : ''} at ${children.join(' and ')} (${children.map((c) => values[c]).join(', ')}): ${violates ? `child ${values[larger]} is bigger — the parent must sink.` : 'the parent is already the biggest — this subtree is a valid heap.'}`,
    };

    if (!violates) break;

    [values[parent], values[larger]] = [values[larger], values[parent]];
    yield {
      state: arrayState(values),
      highlight: { swap: [`i${parent}`, `i${larger}`], sorted },
      explanation: `Swap ${values[parent]} up and ${values[larger]} down. Keep sinking ${values[larger]} until every parent below is bigger than its children again.`,
    };
    parent = larger;
  }
}

const legacyArticle = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Heap sorting turns the array into a max-heap, then repeatedly removes the maximum into the final sorted suffix. A max-heap is a nearly complete binary tree where every parent is at least as large as its children. The storage trick is that no node objects are needed: for index i, the children live at 2i + 1 and 2i + 2. That formula lets the array act like a tree.`,
        `The obvious in-place route is repeated selection: scan the unsorted part for the maximum, move it to the end, and repeat. That is correct but O(n^2). Heap sort keeps the same "place the maximum next" idea and removes the scan by maintaining a heap where the maximum is always at the root.`,
        `J. W. J. Williams introduced heaps and this sort in 1964; Robert Floyd soon showed the bottom-up O(n) heap construction used here. The algorithm is in-place and has guaranteed O(n log n) time, which makes it an important contrast with Quick Sort. Its weakness is practical speed: the sift-down walk jumps around the array, so it fights cache locality more than partitioning or merging does.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Phase one builds the heap. Start at the last parent, floor(n / 2) - 1, and move backward to index 0. For each parent, compare it with its larger child. If the child is bigger, swap and continue sinking the parent until the local subtree satisfies the heap property. Going bottom-up matters: by the time a parent is repaired, both child subtrees are already valid heaps.`,
        `Phase two sorts. The maximum is at index 0. Swap it with the last item in the unsorted zone, shrink the heap size by one, and sift the new root down to restore order. The right side of the array grows as a sorted suffix from largest to smallest. This is the same structural idea behind Binary Heap (Priority Queue), but the priority queue is being consumed inside the original array.`,
        `Correctness follows from two invariants. Before each extraction, the unsorted prefix is a valid max-heap, so index 0 is the largest remaining value. After the swap, the sorted suffix contains the largest values in final order, and sift-down repairs the heap invariant for the smaller prefix.`,
      ],
    },
    {
      heading: `Legacy visual note`,
      paragraphs: [
        `Separate the two phases. Heapify turns the array into a binary heap so the maximum value sits at the root. The extraction phase repeatedly swaps that maximum into its final position, shrinks the heap boundary, and repairs the heap with sift-down.`,
        `The animation is easiest to follow if you imagine two regions in the same array: the live heap on the left and the sorted suffix on the right. Values in the suffix are final; values in the heap only need to satisfy the parent-child heap rule, not full sorted order.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Bottom-up heap construction is O(n), not O(n log n), because most nodes sit near leaves and can sink only one or two levels. Extraction dominates: n removals, each with at most log2 n swaps and comparisons, for O(n log n) time in best, average, and worst cases. Extra space is O(1) beyond the input array.`,
        `Those guarantees explain why introsort can fall back to it. The Big-O Growth Rates look excellent, but hardware details matter. A sift-down path from 0 to 2i + 1 to 4i + 3 does not scan sequential memory, so CPU prefetchers help less than they do for Merge Sort or partition-based loops.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `The full sort is most visible as a safety net inside hybrid library sorts. The heap structure itself is more important: operating systems use priority queues for scheduling, Dijkstra's Shortest Path uses a heap to pop the cheapest frontier node, Prim's Algorithm can use the same structure for minimum spanning trees, and Huffman Coding repeatedly removes the two lightest symbols. In streaming analytics, two heaps maintain a running median in O(log n) per update.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `A heap is not a sorted array. It only promises that each parent beats its children, so siblings and cousins can appear in almost any order. That is why the extraction phase is necessary. Another common mistake is building the heap by repeated insertions and calling that the algorithm; repeated insertion works but costs O(n log n), while Floyd's bottom-up heapify is O(n).`,
        `The sort is also not stable. Equal records can swap across each other during heap repair. And although the extra storage is O(1), recursive tree walks are not involved here; the tree shape is implicit arithmetic over an array, not pointers and recursion.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study the heap priority-queue topic to use the structure without destroying it as a sort. Compare Quick Sort and Merge Sort for the locality, stability, and worst-case trade-offs. Big-O Growth Rates explains why O(n log n) is the target for comparison sorting. Then connect the same heap operation to Dijkstra's Shortest Path, Prim's Algorithm, and Huffman Coding.`,
      ],
    },
  ],
};

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Heap sort exists because we sometimes want comparison sorting with guaranteed O(n log n) time and only constant extra array space. Merge sort gives a clean guarantee but usually needs extra memory. Quick sort is fast in practice but needs care to avoid bad pivots.',
        'The key idea is to turn the array into a binary heap, repeatedly remove the maximum, and place it at the end of the array. The array becomes two regions: an unsorted heap prefix and a sorted suffix.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious way to sort with a priority queue is to insert every item into a heap and then pop items into a new array. That works, but it spends extra memory for the heap or output. Heap sort does the same priority-queue idea in place.',
        'Another tempting approach is selection sort: repeatedly scan for the largest remaining item. That uses constant extra space but costs O(n^2). Heap sort improves selection sort by keeping the remaining maximum accessible at the root of a heap.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'A max heap stores the largest element at index 0 while keeping a partial order: every parent is at least as large as its children. It does not fully sort the prefix. It only maintains enough order to extract the next largest item efficiently.',
        'The array layout is the trick. For zero-based indexing, children of i are 2i + 1 and 2i + 2. No node objects or pointers are needed. The heap is an interpretation of the array prefix.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'First build a max heap from the array. Start at the last internal node and sift down each node toward the root. This bottom-up heap construction is O(n), not O(n log n), because most nodes are near the leaves and can move only a short distance.',
        'Then repeat: swap the root with the last item in the heap prefix, shrink the heap size by one, and sift down the new root until the heap property is restored. The swapped item belongs in the sorted suffix because it was the largest remaining value.',
        'When the heap prefix shrinks to one item, the whole array is sorted in ascending order. The algorithm sorts in place, and every comparison is guided by the heap property rather than by scanning the whole unsorted region.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The heap-building view proves that the array can be read as a tree. Parent-child highlights are not extra structure; they are index relationships. Sift-down repairs one violated path while assuming the child subtrees are already heaps.',
        'The extraction view proves the sorted suffix invariant. After each root swap, the largest remaining element moves to its final position. The heap prefix may look unsorted, but it is organized enough to expose the next maximum.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The max-heap property guarantees that no element below the root can be larger than the root. Therefore the root is safe to place at the end of the unsorted region. After the swap, only the new root may violate the heap property, so one sift-down restores the invariant.',
        'The algorithm is a loop over an invariant: prefix is a valid heap, suffix is sorted and contains the largest removed elements. Each iteration moves one root into the suffix and repairs the prefix. When the prefix is exhausted, the suffix is the whole array.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'Heap construction is O(n). Each of n extractions costs O(log n) for sift-down, so total time is O(n log n). Extra space is O(1) beyond the array, excluding the call stack if implemented recursively.',
        'The tradeoff is locality and stability. Heap sort jumps between parent and child indexes and is usually less cache-friendly than quick sort or timsort on real data. It is also not stable: equal elements can change relative order.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Heap sort wins when worst-case O(n log n) time and constant extra space matter more than stability or best real-world speed. It is useful as a teaching bridge between heaps, priority queues, and in-place sorting.',
        'It also appears inside hybrid algorithms. Some quicksort implementations switch to heap sort when recursion gets too deep, forming introsort. That keeps quicksort-like average behavior while guarding against pathological pivots.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The common implementation failure is off-by-one heap size. The sorted suffix must be excluded from sift-down. If the heap operation still sees the suffix, it can destroy already sorted elements.',
        'Another failure is expecting heap sort to be stable or adaptive. It does not exploit nearly sorted input well, and it does not preserve equal-item order. If those properties matter, use merge sort, insertion-sort hybrids, or timsort-like algorithms.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take the array [4, 10, 3, 5, 1]. Heap building produces a max heap with 10 at the root. The array may not look sorted, but every parent is greater than its children. That is enough structure for the next step.',
        'Swap 10 with the last heap item, shrink the heap, and sift down the new root. Now 10 is outside the heap in the sorted suffix. Repeat for 5, then 4, then 3. Each extraction fixes one final position from right to left.',
        'The important observation is that heap sort never needs the second-largest item to be at a known index until after the largest has been removed. The heap property reveals maxima one at a time, exactly matching the selection-sort goal but avoiding repeated full scans.',
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        'Write siftDown with an explicit heapSize parameter. Compare the current node with its left and right children only if those child indexes are less than heapSize. Swap with the larger child until the parent is already large enough or the node reaches a leaf.',
        'Build the heap from Math.floor(n / 2) - 1 down to 0. Starting at the last internal node matters because leaves are already valid heaps. Inserting elements one by one also works, but it misses the linear-time heapify lesson.',
        'Test duplicates, already sorted input, reverse sorted input, and arrays of length zero, one, and two. Heap sort is comparison-driven, so duplicates should sort correctly even though their relative order is not stable.',
      ],
    },
    {
      heading: 'How to choose it',
      paragraphs: [
        'Use heap sort when memory is tight and a worst-case O(n log n) guarantee is more important than stability. It is a good defensive choice inside hybrid sort designs and a good educational choice for seeing heaps as more than priority queues.',
        'Prefer merge sort when stability matters or linked structures make merging cheap. Prefer quicksort or timsort-like algorithms when cache locality, adaptiveness, and practical speed dominate. Heap sort is reliable, but it is not usually the fastest general-purpose sort in high-level runtimes.',
        'For top-k problems, do not sort the whole array unless the sorted order is actually needed. A heap can maintain only k candidates in O(n log k). Heap sort teaches the primitive, but selection problems often need a smaller heap pattern.',
        'For external sorting or very large records, heap sort is rarely the whole answer. The random-access sift pattern is not friendly to disk and can move large objects repeatedly. Real systems often sort pointers, use runs, or merge streams instead of heap-sorting full records in place.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Binary Heap first, then Selection Sort, Merge Sort, Quick Sort, IntroSort, Priority Queue, and Big-O Growth Rates. A useful exercise is to instrument heap sort with the heap boundary and sorted boundary printed after each extraction.',
        'Then implement a top-k heap and compare it with full heap sort. The contrast teaches the practical lesson: heaps are often more valuable for repeated access to the next best item than for sorting every item completely.',
      ],
    },
  ],
};
