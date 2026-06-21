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
      heading: 'How to read the animation',
      paragraphs: [
        "The animation draws the heap as a tree, but the data lives in a flat array. The root sits at array index 0. Children of index i live at 2i+1 and 2i+2; the parent of index i is at floor((i-1)/2). Watch the tree stay complete at every step: all levels full except possibly the last, which fills left to right. That rigid shape is one of the two rules that define the heap.",
        {type: "callout", text: "A heap buys priority queue speed by combining a complete shape with a weak local order rule that forces only the best item to the root."},
        "During insertion, the new value appears at the next open leaf (the end of the array). If it is larger than its parent, the highlighted pair swaps and the value bubbles upward along one path. During extract-max, the root is removed and the last leaf takes its place. It then sifts downward, always swapping with the larger child, until the heap rule holds again.",
        {type: "image", src: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Binary_Heap_with_Array_Implementation.JPG/500px-Binary_Heap_with_Array_Implementation.JPG", alt: "Binary heap shown as a tree beside its array representation.", caption: "The tree view and array view are the same heap layout. (Source: Wikimedia Commons)"},
        "Found markers on the root mean the maximum is at index 0, readable in O(1). At any frame, check: is every parent greater than or equal to both children? If yes, the heap invariant holds.",
      
        {type: 'image', src: './assets/gifs/binary-heap.gif', alt: 'Animated walkthrough of the binary heap visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        "Many programs repeatedly need the best next item. A scheduler needs the highest-priority job. A timer service needs the earliest deadline. Dijkstra's algorithm needs the unsettled node with the smallest tentative distance. Huffman coding needs the two lowest-frequency symbols. None of these callers want a fully sorted list. They ask one question over and over: which item has the highest priority right now?",
        "That contract is a priority queue: insert items, peek at the best, remove the best. J.W.J. Williams introduced the binary heap in 1964 to implement this contract cheaply. It gives O(1) find-min (or find-max), O(log n) insert, and O(log n) extract, using a flat array with no pointers. The same 1964 paper also introduced heap sort.",
        "The key trick: instead of keeping everything sorted, the heap enforces one local promise on every parent-child edge. That promise is enough to force the winner to the root, even though siblings and cousins are completely unordered.",
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        "Keep a sorted array. The best item is always at one end, so peek and extract are O(1). The cost moves to insertion: every new item must find its sorted position and shift later elements to open a slot. That shift is O(n). For a workload that alternates inserts and extracts, the O(n) insertion dominates.",
        "Alternatively, keep an unsorted array. Insertion is O(1) -- just append. But extracting the best item now requires a full scan: O(n). Neither baseline gives both operations cheaply.",
        "A balanced BST (AVL or red-black) can do both in O(log n), plus it answers predecessor, successor, and range queries. But that flexibility costs pointer overhead per node, worse cache behavior than a flat array, and rebalancing logic. When the only operations are insert and extract-best, a BST maintains more order than the caller needs.",
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        "Sorted arrays sacrifice insert speed to preserve total order. Unsorted arrays sacrifice extraction speed because there is no order at all. The fundamental tension: total order is too expensive to maintain, but no order makes finding the best item too expensive.",
        "The problem is that both approaches treat ordering as all-or-nothing. Total order means every pair is compared. No order means nothing is known. What if there were a structure that maintained just enough order to guarantee the best item is findable, without paying for full sorting?",
        "There is a second wall: height. A pointer-based tree with the same parent-beats-child rule could degenerate into a long chain if its shape is uncontrolled. A chain of n nodes has height n, so sift operations would take O(n) instead of O(log n). The structure needs a shape guarantee too.",
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        "Split the problem into two independent rules. Shape rule: the tree must be complete -- all levels full except possibly the last, which fills left to right. Order rule: every parent must be at least as large as its children (max-heap) or at most as large (min-heap).",
        "The shape rule keeps the height at floor(log2 n). The order rule puts the best item at the root. The tree never sorts siblings against each other. It never compares cousins. It only promises that priority never improves as you walk from parent to child. That weak, local promise is enough.",
        "Because the shape is fixed and predictable, the tree can live in a flat array with no pointers. At index i: left child = 2i+1, right child = 2i+2, parent = floor((i-1)/2). The visual tree is a reading of array positions, not a separate allocation.",
        {type: "image", src: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Max-Heap.svg/250px-Max-Heap.svg.png", alt: "Complete binary max heap with the largest value at the root.", caption: "A max heap needs only parent-child dominance, not sorted siblings. (Source: Wikimedia Commons)"},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        "Insert: append the new value at the end of the array (the next open leaf). This preserves the complete shape. Then sift up: compare the value with its parent. If the child beats the parent, swap them and repeat one level higher. Stop when the parent wins or the value reaches the root. The operation touches at most one node per level: O(log n).",
        "Extract-min (or extract-max): save the root. Move the last array element into the root position and shrink the array by one. This preserves the complete shape but probably violates the order rule at the top. Sift down: compare the moved value with its children. Swap with the better child (smaller in a min-heap, larger in a max-heap). Repeat until the value beats both children or reaches a leaf. Again O(log n).",
        "Build-heap (Floyd's bottom-up construction): given an unordered array, start at the last internal node -- index floor(n/2)-1 -- and sift each node down, moving backward to the root. Leaves are already valid heaps of size one. By the time a parent is processed, both child subtrees are valid heaps, so one sift-down makes the parent's subtree valid. This builds the entire heap in O(n), not O(n log n).",
        "Why O(n) and not O(n log n)? Because most nodes are near the bottom of the tree, where their sift distances are short. Roughly half the nodes are leaves (zero work). A quarter are one level above leaves (at most one swap). An eighth can sift at most two levels. Only the root can sift the full height. Summing the bounded distances across all nodes: n/2 * 0 + n/4 * 1 + n/8 * 2 + ... This geometric series converges to O(n). The naive approach (insert one at a time, each costing O(log n)) gives O(n log n) because it sifts up from the bottom, where most nodes live far from the root.",
        {type: "image", src: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Binary_heap_bottomup_vs_topdown.svg/250px-Binary_heap_bottomup_vs_topdown.svg.png", alt: "Bottom-up heap construction compared with repeated insertion.", caption: "Bottom-up heapify is linear because most nodes can move only a short distance. (Source: Wikimedia Commons)"},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        "The root is always the best item. Proof by contradiction: if some deeper node beat the root, then along the path from that node to the root, there would be an edge where a child beats its parent. That violates the heap invariant. So no deeper node can beat the root.",
        "Insertion is correct because appending a leaf can only break the invariant on the path from the new leaf to the root. The new leaf has no children, so its subtree is trivially valid. Sifting up follows the single possible violation upward until it disappears. Every edge below the sifting path is untouched.",
        "Extraction is correct for the symmetric reason. Moving the last leaf to the root can only break the invariant between the moved value and its children. The subtrees below are still valid heaps. Sifting down follows the single possible violation downward. Each swap fixes the edge above and pushes the potential violation one level deeper.",
        "Bottom-up heapify is correct by induction. Base case: leaves are valid heaps. Inductive step: when sift-down is called on a node, both child subtrees are already valid heaps (they were processed earlier). Sifting the node down through valid subtrees makes the combined subtree valid. When the root is processed, the entire array is a valid heap.",
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        "Find-min (or find-max): O(1). The answer is always at index 0.",
        "Insert: O(log n). A complete tree with n nodes has height floor(log2 n). Sift-up touches one node per level. When n doubles, the height grows by one, so insert gets one comparison slower. 1,000 items: at most 10 swaps. 1,000,000 items: at most 20.",
        "Extract-min (or extract-max): O(log n). Sift-down also touches one node per level. Same scaling as insert.",
        "Build-heap: O(n). Not O(n log n). The distinction matters: converting an existing array into a priority queue is cheaper than sorting it. Heap sort starts with this linear build, then does n extractions at O(log n) each, for O(n log n) total.",
        "Space: O(n) for the array. No pointers, no overhead per node. If the input is already in an array, build-heap can work in place with O(1) extra space. This compactness is why heaps remain popular in systems code.",
        "The tradeoff is weak search. Finding an arbitrary value is O(n). The heap property tells you descendants are worse than ancestors, but it does not tell you whether a value is in the left or right subtree. There is no binary-search shortcut.",
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        "Graph shortest paths: Dijkstra's algorithm uses a min-heap to always expand the unsettled node with the smallest tentative distance. A* does the same but orders by cost-plus-heuristic. The heap is the engine that makes these algorithms O((n + m) log n) instead of O(n^2).",
        "Median finding: maintain a max-heap of the smaller half and a min-heap of the larger half. The median is always at one of the two roots. Each new number is inserted into the appropriate heap and rebalanced in O(log n).",
        "Event-driven simulation: events are inserted with future timestamps and the next event is always extracted first. OS task scheduling: the highest-priority ready thread is always at the heap root. k-way merge: a min-heap of k elements tracks which input stream has the smallest next item.",
        "Heap sort: build a max-heap in O(n), then extract-max n times. Each extraction places the maximum at the end of the array and shrinks the heap by one. The result is a sorted array, in place, guaranteed O(n log n) regardless of input order.",
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        "Search is O(n). A heap cannot find a specific value without scanning. If you need to cancel a job by ID or update its priority, you need an auxiliary index (typically a hash map from ID to heap index). Every swap during sift operations must update this map, adding implementation complexity and a constant-factor overhead.",
        "Decrease-key without an index is O(n) because you first have to find the element. This matters for Dijkstra on dense graphs. A Fibonacci heap reduces decrease-key to O(1) amortized, improving Dijkstra from O((n + m) log n) to O(n log n + m). In practice, the binary heap's cache advantage often wins until graphs reach millions of nodes.",
        "No ordered iteration. A heap cannot list values in sorted order without repeated extraction, which destroys the heap. It cannot answer predecessor, successor, or range queries. When you need ordered navigation, use a balanced BST.",
        "Not cache-friendly for very large heaps. Sift-down jumps from index i to 2i+1 or 2i+2, which doubles the stride at each level. Near the bottom of a large heap, parent and child may sit in different cache lines or even different memory pages. d-ary heaps (d=4 or d=8) reduce the height and can improve cache behavior at the cost of more comparisons per level.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        "Insert [15, 10, 20, 8, 12, 25, 5] into an empty min-heap.",
        "Insert 15. Heap: [15]. One element, nothing to compare. Insert 10. Heap: [15, 10]. Parent of index 1 is index 0: 10 < 15, so swap. Heap: [10, 15]. The smaller value 10 bubbles to the root.",
        "Insert 20. Heap: [10, 15, 20]. Parent of index 2 is index 0: 20 > 10, so no swap needed. Insert 8. Heap: [10, 15, 20, 8]. Parent of index 3 is index 1: 8 < 15, swap. Heap: [10, 8, 20, 15]. Parent of index 1 is index 0: 8 < 10, swap. Heap: [8, 10, 20, 15]. The value 8 bubbled two levels to become the new root.",
        "Insert 12. Heap: [8, 10, 20, 15, 12]. Parent of index 4 is index 1: 12 > 10, so stop. Insert 25. Heap: [8, 10, 20, 15, 12, 25]. Parent of index 5 is index 2: 25 > 20, so stop. Insert 5. Heap: [8, 10, 20, 15, 12, 25, 5]. Parent of index 6 is index 2: 5 < 20, swap. Heap: [8, 10, 5, 15, 12, 25, 20]. Parent of index 2 is index 0: 5 < 8, swap. Heap: [5, 10, 8, 15, 12, 25, 20]. The value 5 is the new minimum at the root.",
        "Extract-min #1. Save 5. Move last element (20) to root: [20, 10, 8, 15, 12, 25]. Sift down: 20's children are 10 (index 1) and 8 (index 2). Smaller child is 8. Since 20 > 8, swap: [8, 10, 20, 15, 12, 25]. Now 20 is at index 2. Its children are 25 (index 5). Since 20 < 25, stop. Heap is valid. Returned 5, new minimum is 8.",
        "Extract-min #2. Save 8. Move last element (25) to root: [25, 10, 20, 15, 12]. Sift down: 25's children are 10 (index 1) and 20 (index 2). Smaller child is 10. Since 25 > 10, swap: [10, 25, 20, 15, 12]. Now 25 is at index 1. Its children are 15 (index 3) and 12 (index 4). Smaller child is 12. Since 25 > 12, swap: [10, 12, 20, 15, 25]. 25 is now a leaf. Heap is valid. Returned 8, new minimum is 10.",
        "Notice: the array [10, 12, 20, 15, 25] is not sorted. The heap never sorts -- it only maintains the parent-beats-children rule, which is enough to keep the minimum at the root for O(1) access.",
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        "J.W.J. Williams, 'Algorithm 232: Heapsort,' Communications of the ACM 7(6), 1964 -- the paper that introduced both the binary heap and heap sort. R.W. Floyd, 'Algorithm 245: Treesort 3,' Communications of the ACM 7(12), 1964 -- the O(n) bottom-up heap construction. M.L. Fredman and R.E. Tarjan, 'Fibonacci heaps and their uses in improved network optimization algorithms,' Journal of the ACM 34(3), 1987 -- the decrease-key improvement for graph algorithms.",
        "Natural extensions: Heap Sort extracts the max n times to sort in place, using the heap built in O(n). Dijkstra's Shortest Path uses a min-heap as its frontier -- the priority queue decides which vertex to finalize at each step. A* Search extends Dijkstra with a heuristic, still powered by a min-heap. Huffman Coding repeatedly extracts the two lowest-frequency symbols from a min-heap to build an optimal prefix code.",
        "Contrasting alternatives: Fibonacci Heap and Pairing Heap reduce decrease-key cost from O(log n) to O(1) amortized, which matters for dense-graph algorithms. Treap combines BST order with heap priority for randomized balancing. B-Tree maintains full sorted order across disk pages -- the right choice when you need range queries, not just extract-best.",
        "Prerequisite gaps: if the array index arithmetic felt unfamiliar, review Array and complete binary tree layout. If the O(log n) height argument was unclear, study Binary Search Tree where the same height-cost relationship drives lookup speed.",
      ],
    },
  ],
};
