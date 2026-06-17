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
      heading: `Why this exists`,
      paragraphs: [
        `A binary heap exists because many programs need the best next item without paying to keep every item fully sorted. A scheduler needs the next job to run. A timer service needs the earliest deadline. Dijkstra's algorithm needs the unsettled graph node with the smallest tentative distance. A compression algorithm may need the two lowest-frequency symbols again and again. These callers are not asking for a sorted list. They are asking one repeated question: which item has the highest priority right now?`,
        `That contract is a priority queue. It must support insertion, inspection of the current best item, and removal of that best item. A binary heap is the common implementation because it stores only enough order to make the best item cheap to find. It gives constant-time peek and logarithmic insert and removal, using a plain array rather than pointer-heavy tree nodes.`,
        `The idea is modest, but the effect is large. Instead of sorting the world every time priorities change, the heap keeps one local promise on every parent-child edge. That promise is enough to force the winner to the root, even though siblings and cousins are not in sorted order.`,
      ],
    },
    {
      heading: `The obvious approach and its wall`,
      paragraphs: [
        `The first baseline is an unsorted array. Insertion is perfect: append the item and stop. The problem moves to removal. To remove the maximum, the program must scan every element, remember the best one, remove it, and maybe patch the gap. One extraction is O(n). If the workload repeatedly extracts, that scan becomes the main cost.`,
        `The second baseline is a sorted array. Now the best item is at one end and peek is O(1). Removal can be cheap too. The cost moves to insertion: every new item must find its sorted position, and later elements may shift to make room. When priorities arrive one by one, the structure spends time preserving a total order that the caller may never inspect.`,
        `A balanced search tree is more flexible. It supports predecessor, successor, sorted iteration, and deletion by key. That is excellent when the program needs ordered navigation. It is more machinery than a pure priority queue needs. The heap's wall is the same in each baseline: either it under-orders and scans too much, or it over-orders and maintains detail that will not be used.`,
        `The second wall is height. A pointer tree with the same parent-priority rule could become a long chain if its shape is not controlled. A heap solves this by fixing the shape to a complete binary tree. Complete means all levels are full except maybe the last, and the last level fills left to right. That shape keeps the height logarithmic.`,
      ],
    },
    {
      heading: `Core insight and invariant`,
      paragraphs: [
        `The core insight is to split the problem into shape and order. Shape is global and strict: the tree must remain complete. Order is local and weak: each parent must outrank its children. For a max-heap, every parent is greater than or equal to each child. For a min-heap, every parent is less than or equal to each child.`,
        `Those two rules are the whole data structure. The complete shape gives a height of O(log n). The parent rule puts the best item at the root. The tree does not try to sort the left subtree against the right subtree. It does not promise that values at the same level are ordered. It only promises that priority never improves as you move downward from a parent to a child.`,
        `The array layout follows from the shape. There is no need to store child pointers because the complete tree has predictable positions. At index i, the left child is 2i + 1, the right child is 2i + 2, and the parent is Math.floor((i - 1) / 2). The visual tree is a reading of the array, not a separate allocation.`,
      ],
    },
    {
      heading: `How the visual model teaches it`,
      paragraphs: [
        `The visual model shows the heap as a tree because the invariant is easiest to see on edges. During insertion, the new value appears at the next open leaf position. That move preserves the complete shape. If the new child beats its parent, the model highlights the parent-child pair and swaps them. The value climbs only along one path.`,
        `During extraction, the root is removed and the last leaf moves into the root slot. That move also preserves the complete shape, but it probably breaks the parent rule near the top. The model then compares the moved value with its better child and swaps downward until the local promise holds again.`,
        `The important lesson is that the highlighted path is small. Most of the heap is already valid and stays untouched. Insertion repairs upward from a leaf. Extraction repairs downward from the root. The array-to-tree view makes that locality visible: heap operations are not searching the whole structure for order; they are repairing one narrow path after a shape-preserving move.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Insertion has two phases. First append the item at the end of the array. This chooses the next open leaf and keeps the tree complete. Then bubble the item upward while it outranks its parent. Each swap repairs the edge below the item and moves the possible violation one level closer to the root. The operation stops when the parent is good enough or the item becomes the root.`,
        `Removal of the maximum also has two phases. Save the root value as the answer. Move the last array item into the root position and shrink the array. This keeps the shape complete, but the moved item may be too small. Sift it downward by comparing it with its larger child. If that child outranks it, swap. Continue until it has no child that beats it.`,
        `Building a heap from an existing array can be done by inserting items one by one, but the better method is bottom-up heapify. Start at the last internal node and sift down each node moving backward to the root. Leaves are already heaps of size one. By the time a parent is processed, its children are valid heaps, so one sift-down makes the parent subtree valid.`,
        `Heapify is a useful reminder that heap order is local. The algorithm does not sort the array. It turns each subtree into a valid heap until the root covers the whole array.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `The root is best because every path from the root moves through edges where the parent is at least as good as the child. If some deeper node beat the root in a max-heap, then along the path upward there would have to be an edge where a child beat its parent. That would violate the heap invariant. So the maximum must be at the root.`,
        `Insertion is correct because appending a leaf cannot break the invariant anywhere except between the new value and its ancestors. The new leaf has no children, so its subtree is valid. If it beats its parent, swapping makes the lower edge valid. The only edge that may now be wrong is the new edge above it. Bubbling up follows that single possible violation until none remains.`,
        `Extraction is correct for the symmetric reason. Removing the root and moving the last leaf to the root cannot damage subtrees below the root, because their internal edges have not changed. The only possible bad edge is between the moved item and one of its children. Sifting down with the better child makes the old parent position valid after each swap. The possible violation moves downward until the item reaches a position where it beats both children or becomes a leaf.`,
        `Bottom-up heapify is correct because it works from smaller heaps to larger heaps. When sift-down is called on a node, both child subtrees already obey the invariant. Sifting that node down through those valid subtrees makes the combined subtree valid. Repeating this up to the root makes the entire array a heap.`,
      ],
    },
    {
      heading: `Worked example`,
      paragraphs: [
        `Insert 5, 9, 3, 14, 7, and 11 into a max-heap. The first value, 5, becomes the root. Insert 9 at the next leaf. It beats 5, so it swaps upward and becomes the root. Insert 3 as the next leaf. Its parent 9 already beats it, so it stays.`,
        `Insert 14 at the next leaf. It first compares with its parent 5 and swaps. It then compares with 9 and swaps again. The heap root is now 14. Notice what did not happen: the heap did not compare 14 with every element. It followed the parent chain.`,
        `Insert 7 and 11 the same way. 11 may bubble over a smaller parent, but it stops below 14. The final array is a valid heap, though it is not sorted. A level-order reading might place 9 before 11 or 7 before 5 depending on prior swaps. That is fine because only parent-child priority matters.`,
        `Now extract the maximum. Remove 14. Move the last array item to the root and sift it downward. If its larger child is 11, swap with 11. If it then has children and one beats it, swap again. The answer returned is 14, and the remaining array is again a valid heap.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `Peek is O(1) because the best item is at index 0. Insert and extract are O(log n) because a complete binary tree with n nodes has logarithmic height. When the number of elements doubles, the height increases by about one level, so repair paths grow slowly.`,
        `Heapify is O(n), not O(n log n). Many nodes are leaves and do no work. Many more are one level above leaves and can move at most one level. Only a small number of nodes can move far. Adding those distances across the tree gives linear work.`,
        `Space is O(n) for the array. If an existing array is being rearranged for heap sort, heap construction can be done in place with O(1) extra space. This is one reason heaps remain attractive in systems code: the data structure is compact and pointer-free.`,
        `The tradeoff is weak search. Looking for an arbitrary value is O(n). The heap property does not tell you whether a non-root value lies on the left or right side. It only tells you that descendants are no better than their ancestors.`,
      ],
    },
    {
      heading: `Where it wins`,
      paragraphs: [
        `Heaps win when the access pattern is insert many items and repeatedly take the best. Graph algorithms are the classic case. Dijkstra's algorithm uses a min-heap to expand the unsettled node with the smallest tentative distance. A* uses the same shape but orders nodes by current cost plus a heuristic estimate.`,
        `Schedulers use heaps when tasks are chosen by priority or deadline. Event simulators use heaps for the next scheduled event. Retry queues use heaps for the next time a failed job should run. Message brokers, crawlers, and rate limiters use heap-like structures when priority changes over time but only the next item matters.`,
        `Huffman coding uses a min-heap to repeatedly remove the two lowest-frequency trees and combine them. Heap sort uses a max-heap to repeatedly move the maximum into its final sorted position. In each case the heap is useful because the algorithm asks for the next extreme item, not a full ordering after every edit.`,
      ],
    },
    {
      heading: `Limits and failure cases`,
      paragraphs: [
        `A heap is not an ordered set. It cannot answer predecessor, successor, or range queries efficiently. It cannot list values in sorted order without repeated extraction, and repeated extraction destroys the heap unless you operate on a copy or accept heap sort's in-place rearrangement.`,
        `A heap is also not a good exact lookup structure. If you need to find a particular job by ID, cancel it, or update its priority, you need more design. Common choices are a heap plus a hash map from ID to heap index, explicit handles returned by insertion, or lazy deletion where an updated item is inserted again and stale entries are ignored when popped.`,
        `Lazy deletion is simple but has limits. The heap may contain many stale entries, so memory grows and extra pops are needed. Handle-based heaps are cleaner for heavy update workloads, but every swap must update the handle map. Bugs in that map can make the heap return the wrong item even when the array looks locally valid.`,
        `Binary heaps also lose to specialized structures in some niches. Bucket queues can be faster when priorities are small integers. Pairing heaps or Fibonacci heaps may reduce update costs in theory-heavy graph workloads. Calendar queues can be excellent for some simulation distributions. A binary heap is the default, not the end of the design space.`,
      ],
    },
    {
      heading: `Implementation guidance`,
      paragraphs: [
        `Pick min-heap or max-heap at the API boundary and make the comparator explicit. Many bugs come from mixing priority meaning with numeric direction. For a scheduler, a smaller timestamp may be better. For a leaderboard, a larger score may be better. The heap code should call a comparison function rather than burying that policy in swaps.`,
        `Keep array index arithmetic small and tested. Parent and child formulas are easy to write once and then trust, but off-by-one errors break the shape. Tests should cover empty heap, one element, two elements, duplicate priorities, sorted input, reverse-sorted input, and many random insert-remove sequences checked against a simple sorted reference implementation.`,
        `Decide what happens on ties. A plain heap is not stable: two equal-priority items may come out in either order. If stable ordering matters, store a sequence number with each item and compare priority first, sequence second. This is common in job queues where equal deadlines should run in arrival order.`,
        `Avoid exposing the backing array as a sorted representation. It is an implementation detail. If callers start relying on array positions beyond the root, they are relying on facts the heap does not promise.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Queue first to compare priority scheduling with FIFO scheduling. Study Binary Search Tree when ordered lookup and range navigation matter. Study Dijkstra's Shortest Path and A* to see priority queues drive graph search. Study Heap Sort to see heap extraction produce a sorted array. After that, compare d-ary heaps, pairing heaps, Fibonacci heaps, bucket queues, and indexed priority queues so you can choose based on the actual update, lookup, and priority distribution of the workload.`,
      ],
    },
  ],
};
