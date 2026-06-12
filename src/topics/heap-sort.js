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

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        `Heap sort builds a special data structure inside the array called a max-heap — a binary tree where every parent is at least as large as its children. It exploits a brilliant trick: the array itself IS the tree (children of index i live at 2i+1 and 2i+2, no pointers needed). Once the heap is built, the largest element always sits at index 0. Extract it to the end, shrink the heap, rebuild the top, and repeat. After n extractions, the array is sorted.`,
        `The algorithm guarantees O(n log n) in all cases and sorts in-place with O(1) extra space. Unlike quicksort, there are no bad inputs; like merge sort, it is predictable. The downside is cache unfriendliness — accessing arbitrary indices via the formula 2i+1 and 2i+2 causes random memory jumps, making heap sort slower in practice than quicksort or even merge sort on modern hardware, despite the better worst-case guarantee.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Phase 1: Build the max-heap. Start from the last parent (index ⌊n/2⌋−1) and work backward to the root, "sifting down" each subtree. Sift down means: if a parent is smaller than one of its children, swap them and continue sifting the parent downward. After this phase, the entire array satisfies the max-heap property: every parent ≥ its children.`,
        `Phase 2: Extract the maximum repeatedly. The root (index 0) is always the largest element. Swap it to the end of the unsorted zone, shrink the unsorted zone by one, and sift down the new root to restore the heap property. Repeat until the unsorted zone shrinks to a single element. Since that last element has nowhere else to go, it is in its final position, and the whole array is sorted.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Building the heap (phase 1) is O(n) — not O(n log n) as intuition might suggest, because most subtrees are small and sift down only a few levels. Extracting n maxima (phase 2) is O(n log n) because each extraction sifts down at most log n levels. Total: O(n log n) in all cases. Space complexity is O(1) besides the input array. Heap sort is one of the few comparison sorts with guaranteed O(n log n) and O(1) extra space, which is why it is a fallback when quicksort's worst case is a concern.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Heap sort is rarely the first choice for sorting because its random memory access pattern on modern hardware (traversing the tree via index arithmetic) is slower than quicksort's sequential scans and cache-friendly behavior. However, it is used as a safety net: C++ std::sort (introsort) falls back to heap sort if quicksort recursion depth exceeds a threshold, ensuring O(n log n) even on adversarial input. The heap data structure itself is far more useful than heap sort; heaps power priority queues, Dijkstra's algorithm, Huffman coding, and online median-finding. Heap sort is often taught not for production use but to introduce the heap concept.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `A common misconception is that heap sort should be the default because it has guaranteed O(n log n) and O(1) space. In practice, quicksort with good pivot selection is faster due to better cache locality and simpler inner loops. Heap sort's random index pattern defeats CPU prefetching and causes cache misses. The O(n log n) guarantee sounds better until you profile real hardware.`,
        `Another pitfall is confusing the heap property (parent ≥ children) with sortedness. A max-heap only promises the root is the largest; the rest of the array can be in any order. That is why extraction is necessary — a max-heap is not automatically sorted. Finally, beginners sometimes sift UP instead of DOWN, which breaks the heap property and produces wrong results.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Understand Binary Heap (Priority Queue) to see the heap concept beyond sorting. Study Merge Sort and Quick Sort to compare the practical costs of different O(n log n) strategies. Learn Recursion and Big-O Growth Rates to internalize why O(n log n) is the theoretical floor for comparison-based sorts. Explore advanced topics like introsort (the fallback mechanism), and how real libraries choose between sort algorithms based on input characteristics and hardware profiles.`,
      ],
    },
  ],
};

