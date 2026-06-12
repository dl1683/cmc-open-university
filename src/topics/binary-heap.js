// Binary max-heap (a priority queue): insert bubbles up, extract-max sifts
// down. Drawn as the tree it conceptually is — but it lives in a flat array.

import { treeState, parseNumberList } from '../core/state.js';

export const topic = {
  id: 'binary-heap',
  title: 'Binary Heap (Priority Queue)',
  category: 'Data Structures',
  summary: 'A tree where every parent beats its children — so the maximum is always one peek away.',
  controls: [
    { id: 'values', label: 'Insert (in order)', type: 'number-list', defaultValue: '5, 9, 3, 14, 7, 11' },
  ],
  run,
};

// The heap is an array; the "tree" is just how we read the indexes:
// children of index i are 2i+1 and 2i+2, parent is floor((i-1)/2).
function heapTree(heap) {
  const nodes = heap.map((value, i) => ({
    id: `h${i}`,
    value,
    left: 2 * i + 1 < heap.length ? `h${2 * i + 1}` : null,
    right: 2 * i + 2 < heap.length ? `h${2 * i + 2}` : null,
  }));
  return treeState(nodes, heap.length > 0 ? 'h0' : null);
}

export function* run(input) {
  const values = parseNumberList(input.values, { max: 10 });
  const heap = [];

  yield {
    state: heapTree(heap),
    highlight: {},
    explanation: 'A max-heap keeps one promise: EVERY parent ≥ its children. That single rule means the maximum is always at the root — a priority queue where the most urgent thing is always on top. (The whole tree secretly lives in a flat array: children of index i are at 2i+1 and 2i+2.)',
  };

  for (const value of values) {
    heap.push(value);
    let i = heap.length - 1;
    yield {
      state: heapTree(heap),
      highlight: { active: [`h${i}`] },
      explanation: `insert(${value}): the new value starts at the first free slot — the bottom of the tree. That keeps the shape compact, but the parent rule might now be broken upward.`,
    };
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      const violates = heap[i] > heap[parent];
      yield {
        state: heapTree(heap),
        highlight: { compare: [`h${i}`, `h${parent}`] },
        explanation: `Compare ${heap[i]} with its parent ${heap[parent]}: ${violates ? 'child is bigger — that breaks the heap promise, so they swap. The new value BUBBLES UP.' : 'parent is bigger (or equal) — promise intact, the value has found its level.'}`,
        invariant: 'Everywhere except along the bubbling path, every parent ≥ its children.',
      };
      if (!violates) break;
      [heap[i], heap[parent]] = [heap[parent], heap[i]];
      i = parent;
    }
  }

  yield {
    state: heapTree(heap),
    highlight: { found: ['h0'] },
    explanation: `All ${values.length} values inserted — each took at most log n bubble-up swaps. The maximum (${heap[0]}) sits at the root, readable in O(1). Now watch extract-max, the other half of the priority queue.`,
  };

  for (let round = 0; round < 2 && heap.length > 1; round += 1) {
    const max = heap[0];
    heap[0] = heap[heap.length - 1];
    heap.pop();
    yield {
      state: heapTree(heap),
      highlight: { active: ['h0'] },
      explanation: `extractMax() removes ${max}. The LAST value (${heap[0]}) jumps into the root to keep the shape compact — it is almost certainly too small to be there, so it must SIFT DOWN.`,
    };

    let i = 0;
    for (;;) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left >= heap.length) break;
      const bigger = right < heap.length && heap[right] > heap[left] ? right : left;
      const violates = heap[bigger] > heap[i];
      yield {
        state: heapTree(heap),
        highlight: { compare: [`h${i}`, `h${bigger}`] },
        explanation: `${heap[i]} vs its bigger child ${heap[bigger]}: ${violates ? 'child wins — swap, and keep sinking.' : 'parent wins — the heap promise holds again.'}`,
      };
      if (!violates) break;
      [heap[i], heap[bigger]] = [heap[bigger], heap[i]];
      i = bigger;
    }
  }

  yield {
    state: heapTree(heap),
    highlight: heap.length ? { found: ['h0'] } : {},
    explanation: 'That is the entire priority queue: insert = bubble up, extract = sift down, both O(log n), max always at the root. Operating systems schedule tasks with this, Dijkstra finds shortest paths with it — and run extract-max n times and you have invented Heap Sort.',
  };
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        `A binary max-heap is a tree where every parent is greater than or equal to its children. This single rule guarantees that the maximum element is always at the root. A heap is a priority queue: the element with the highest priority (largest value) is always instantly accessible. Unlike a binary search tree, a heap does not maintain sorted order across the entire structure — only the local parent-child relationship matters.`,
        `The clever part of a heap is its representation: although conceptually it is a tree, it lives in a flat array. The children of index i are at indices 2i+1 and 2i+2, and the parent is at floor((i-1)/2). This dense packing keeps the tree complete (filled level by level from left to right), which is essential for the efficiency of heap operations.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `To insert a value, add it to the end of the array (the next available leaf position). This keeps the tree complete and compact. The new value might violate the heap promise (a child is now larger than its parent). To fix it, bubble up: swap the child with its parent, then continue checking the parent against its parent, until the promise is restored or you reach the root.`,
        `To extract the maximum, remove the root (the largest element). Take the last element in the array, move it to the root position (keeping the tree complete), then sift down: compare the root with its children, swap it with the larger child if the child is bigger, then continue with that child until the heap promise is restored. Both operations follow a path of at most log n nodes.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Insertion and deletion (extract-max) are both O(log n) because the heap height is log n for n elements. Finding the maximum is O(1) — it is always at the root. Heapifying an entire array (turning it into a heap) is O(n), not O(n log n), because most elements are near the leaves and bubble up only a short distance. Building a heap this way is faster than inserting elements one at a time. Space complexity is O(n) for the array.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Operating systems use heaps to schedule processes by priority: every time a process is created or finishes, the priority queue is updated to select the next highest-priority process. Dijkstra's shortest path algorithm uses a min-heap to greedily select the unvisited node closest to the source. Heap Sort uses repeated extract-max operations to sort data in O(n log n) time. Load balancers and message queues use heaps to prioritize urgent requests. Huffman coding, used in data compression, builds a tree using a min-heap. Streaming data algorithms use heaps to track the k largest elements without storing the entire stream.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `A heap is not a sorted structure — while the maximum is at the root, the rest of the array is not sorted. Trying to iterate a heap and expecting sorted output will fail; you must extract elements one at a time. Confusing a heap with a binary search tree is common: a BST maintains sorted order and supports efficient search, while a heap only promises the maximum is accessible. Min-heaps and max-heaps have opposite ordering, so be clear which you are building. Implementing heaps with pointer-based tree nodes instead of arrays wastes space and cache locality — arrays are the right representation. Finally, when implementing extract-max, forgetting to sift down the new root completely will leave the heap broken.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Dijkstra's Shortest Path, which relies on a min-heap for efficiency. Explore Heap Sort to see how extract-max is a complete sorting algorithm. Learn Binary Search Tree to contrast different tree structures and their trade-offs. Understand Priority Queues conceptually and how they are implemented with heaps. Graph BFS uses a regular queue; Dijkstra upgrades it to a priority queue (heap) to track distance.`,
      ],
    },
  ],
};

