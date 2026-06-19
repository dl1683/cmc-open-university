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
      heading: `Why this exists`,
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
      heading: `How to read the animation`,
      paragraphs: [
        `Separate the two phases. Heapify turns the array into a binary heap so the maximum value sits at the root. The extraction phase repeatedly swaps that maximum into its final position, shrinks the heap boundary, and repairs the heap with sift-down.`,
        `The animation is easiest to follow if you imagine two regions in the same array: the live heap on the left and the sorted suffix on the right. Values in the suffix are final; values in the heap only need to satisfy the parent-child heap rule, not full sorted order.`,
      ],
    },
    {
      heading: `Cost and behavior`,
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
      heading: `Where it fails`,
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
      {
      heading: 'The wall',
      paragraphs: [
        'The wall is breaking the heap invariant during extract-and-sink operations.',
        'If `heapify` or `siftDown` does not re-establish parent/child order after each swap, you are no longer removing the true max each round.',
        'Use a tiny array [4, 1, 7, 3, 6, 5]: one incorrect sift on a stale heap index is enough to leave a larger value behind, and the output order becomes unstable.',
      ],
    },
],
};

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The array is drawn as a row of boxes. Think of it as two regions separated by a moving boundary: the heap prefix on the left and the sorted suffix on the right. The suffix grows one element at a time as each maximum is extracted.',
        'During Phase 1 (build-heap), highlighted boxes show the parent being compared to its children. A swap highlight means the parent was smaller and sank down. No element leaves the heap yet; the goal is only to establish the max-heap property.',
        'During Phase 2 (extract-max), the root and the last heap element swap (swap highlight), then the new root sifts down (active and compare highlights). Elements that reach the sorted suffix turn a different color and never move again. When every box is in the suffix, sorting is done.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'J. W. J. Williams introduced heaps and heap sort in 1964 to solve a specific gap in comparison sorting. Merge sort guarantees O(n log n) worst-case time but needs O(n) extra space. Quicksort runs fast in practice with O(1) extra space but degrades to O(n^2) on adversarial inputs. No comparison sort before heap sort delivered both guarantees simultaneously.',
        'Heap sort is the only comparison sort that is O(n log n) in the worst case and uses O(1) auxiliary space. That combination matters whenever memory is scarce and worst-case latency is a hard constraint.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Selection sort solves the same problem with the same space budget. Scan the unsorted region for the largest value, swap it to the end, repeat. It uses O(1) extra space and is simple to implement. For small arrays it works fine.',
      ],
    }
  ],
};
