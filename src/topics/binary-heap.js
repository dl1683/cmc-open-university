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
        'The animation draws the heap as a tree, but the underlying storage is a flat array. Index 0 is the root. For any node at index i, its left child sits at 2i+1, its right child at 2i+2, and its parent at floor((i-1)/2). Watch the tree stay complete at every frame: every level is full except possibly the last, which fills strictly left to right.',
        {type: "callout", text: "A heap buys priority queue speed by combining a complete shape with a weak local order rule that forces only the best item to the root."},
        'During insertion, a new value appears at the next open leaf -- the end of the array. If it exceeds its parent, the highlighted pair swaps and the value bubbles upward along a single root-to-leaf path. During extract-max, the root is removed and the last leaf replaces it. That replacement then sifts downward, always swapping with the larger child, until every parent once again dominates its children.',
        {type: "image", src: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Binary_Heap_with_Array_Implementation.JPG/500px-Binary_Heap_with_Array_Implementation.JPG", alt: "Binary heap shown as a tree beside its array representation.", caption: "The tree view and array view are the same heap layout. (Source: Wikimedia Commons)"},
        'A found marker on the root means the maximum lives at index 0, readable in O(1). At any frame you can verify correctness yourself: check whether every parent is greater than or equal to both its children. If yes everywhere, the heap invariant holds.',
        {type: 'image', src: './assets/gifs/binary-heap.gif', alt: 'Animated walkthrough of the binary heap visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many programs repeatedly need the single best item from a changing collection. An OS scheduler needs the highest-priority ready thread. A timer service needs the earliest deadline. Dijkstra\'s shortest-path algorithm needs the unsettled vertex with the smallest tentative distance. Huffman coding needs the two lowest-frequency symbols. None of these callers want a fully sorted list -- they ask one question over and over: which element has the highest priority right now?',
        'That contract is called a priority queue: insert items with priorities, peek at the best, remove the best. J.W.J. Williams introduced the binary heap in 1964 specifically to implement this contract cheaply. It delivers O(1) peek, O(log n) insert, and O(log n) extract, using nothing but a flat array -- no pointers, no allocations per node. The same 1964 paper also introduced heap sort as a direct application.',
        'The core trick is that the heap enforces only one local promise on each parent-child edge: the parent must be at least as large as the child (for a max-heap). That single rule, repeated everywhere, is enough to force the global winner to the root, even though siblings and cousins are completely unordered relative to each other.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Keep a sorted array. The best item is always at one end, so peek and extract cost O(1). But insertion requires finding the correct position (O(log n) with binary search) and then shifting all later elements to make room -- that shift is O(n). For a workload that alternates inserts and extracts, O(n) insertion dominates.',
        'The mirror approach is an unsorted array. Insertion is O(1) -- just append. But extracting the best item requires scanning every element: O(n). Neither baseline gives both operations cheaply.',
        'A balanced BST (AVL or red-black tree) achieves O(log n) for both operations, plus it supports predecessor, successor, and range queries. But that flexibility costs pointer overhead per node, worse cache locality than a contiguous array, and complex rebalancing rotations. When the only operations are insert and extract-best, a BST maintains far more order than the caller ever uses.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Sorted arrays pay O(n) on insert to maintain total order. Unsorted arrays pay O(n) on extract because they maintain no order. The fundamental tension: total order is too expensive to maintain dynamically, but no order makes finding the best item too expensive.',
        'Both approaches treat ordering as all-or-nothing. Total order means every pair of elements has a known relative position. No order means the structure knows nothing. The gap between these extremes is where the binary heap lives: it maintains just enough order to guarantee the best item is always findable, without paying for anything more.',
        'There is a second wall: height control. A pointer-based tree with the same "parent beats child" rule could degenerate into a chain if nothing constrains its shape. A chain of n nodes has height n, making sift operations O(n) instead of O(log n). The structure needs a shape guarantee in addition to the ordering guarantee.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Split the problem into two independent rules that together give everything the priority queue needs. Rule 1 (shape): the tree must be complete -- every level is full except possibly the last, which fills left to right with no gaps. Rule 2 (order): every parent must be at least as large as its children (max-heap) or at most as large (min-heap).',
        'The shape rule fixes the height at floor(log2 n), which caps the cost of every sift operation. The order rule pushes the best item to the root. Siblings are never compared. Cousins are never compared. The only promise is that priority never improves as you walk downward from any node. That weak, local promise is sufficient because any path from a leaf to the root must pass through the root, so no node can beat it.',
        'Because the shape is rigid and predictable, the tree needs no pointers. It maps directly onto a flat array: index i has left child 2i+1, right child 2i+2, parent floor((i-1)/2). The visual tree and the array are two views of the same data, with zero overhead.',
        {type: "image", src: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Max-Heap.svg/250px-Max-Heap.svg.png", alt: "Complete binary max heap with the largest value at the root.", caption: "A max heap needs only parent-child dominance, not sorted siblings. (Source: Wikimedia Commons)"},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Insert: append the new value at the end of the array, which is the next open leaf in the complete tree. This preserves the shape rule by definition. Then sift up: compare the new value with its parent. If the child exceeds the parent, swap them and repeat one level higher. Stop when the parent wins or the value reaches the root. The path from leaf to root has length floor(log2 n), so insert is O(log n).',
        'Extract-max: save the root value (the answer). Copy the last array element into index 0 and shrink the array by one. This preserves the shape rule -- the tree lost exactly one leaf from the rightmost position. But the replacement value is probably too small for the root. Sift down: compare it with both children, swap with the larger child, and repeat until it dominates both children or reaches a leaf. Again O(log n).',
        'Build-heap (Floyd\'s bottom-up construction): given an unordered array of n elements, start at the last internal node (index floor(n/2) - 1) and sift each node down, walking backward to index 0. Leaves are trivially valid heaps. When a parent is processed, both its child subtrees are already valid heaps, so one sift-down fixes the parent\'s subtree. By the time index 0 is processed, the entire array is a valid heap.',
        'Why is build-heap O(n) instead of O(n log n)? Because sift distances are bounded by how far each node sits from the bottom, and most nodes sit near the bottom. Half the nodes are leaves (zero swaps). A quarter sit one level above (at most one swap). An eighth can sift at most two levels. Only the root can sift the full height. The total work sums to: n/2 * 0 + n/4 * 1 + n/8 * 2 + n/16 * 3 + ... This is the series n * sum(k / 2^(k+1)) for k = 0 to log n, which converges to O(n). The top-down alternative (insert one at a time, each costing O(log n)) gives O(n log n) because it sifts upward from leaves -- the level with the most nodes and the longest paths.',
        {type: "image", src: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Binary_heap_bottomup_vs_topdown.svg/250px-Binary_heap_bottomup_vs_topdown.svg.png", alt: "Bottom-up heap construction compared with repeated insertion.", caption: "Bottom-up heapify is linear because most nodes can move only a short distance. (Source: Wikimedia Commons)"},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Claim: the root always holds the maximum. Proof by contradiction: suppose some deeper node v has a value larger than the root. Walk the path from v up to the root. Somewhere on that path, a child exceeds its parent -- but that violates the heap invariant. Since we assume the invariant holds everywhere, no deeper node can beat the root.',
        'Insertion correctness: appending a leaf can only create a violation on the single edge between the new leaf and its parent. The new leaf has no children, so its subtree is trivially valid. Sifting up follows the single possible violation upward, fixing one edge per swap, until it disappears. Every edge not on the sift path remains untouched.',
        'Extraction correctness: moving the last leaf to the root can only violate the invariant between index 0 and its children. The child subtrees are still valid heaps (nothing in them changed). Sifting down follows the violation downward: each swap fixes the edge above and pushes the potential violation one level deeper. When sifting stops, every edge in the tree satisfies the heap rule.',
        'Build-heap correctness (by induction): base case -- leaves are valid heaps of size 1. Inductive step -- when sift-down is called on node i, both child subtrees rooted at 2i+1 and 2i+2 are already valid heaps because they were processed first (we iterate backward). One sift-down through valid subtrees produces a valid heap rooted at i. When i = 0 is processed, the entire array is a valid heap.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Peek (find-max or find-min): O(1). The answer is always at index 0. No traversal, no comparison.',
        'Insert: O(log n) worst case. A complete binary tree with n nodes has height floor(log2 n). Sift-up performs at most one comparison and one swap per level. Concrete scaling: 1,000 items means at most 10 swaps; 1,000,000 items means at most 20 swaps. Doubling the data adds exactly one more level of work.',
        'Extract: O(log n) worst case. Sift-down touches one node per level, same as insert. Each level requires comparing the parent against both children and possibly swapping with the larger (or smaller) one, so the constant factor is slightly higher than insert (two comparisons per level instead of one).',
        'Build-heap: O(n). This is strictly cheaper than O(n log n). It means converting a raw array into a priority queue costs less than sorting it. Heap sort exploits this: build a max-heap in O(n), then extract-max n times at O(log n) each, yielding O(n log n) total.',
        'Space: O(n) for the array, with no per-node overhead. If the input already lives in an array, build-heap can operate in place with O(1) extra memory. This compactness -- no pointers, no allocation -- is why heaps remain the default priority queue in systems code and standard libraries.',
        'The main tradeoff is search: finding an arbitrary value costs O(n). The heap property tells you that descendants are worse than ancestors, but it says nothing about whether a value lives in the left or right subtree. There is no binary-search shortcut through a heap.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Graph shortest paths: Dijkstra\'s algorithm maintains a min-heap of unsettled vertices keyed by tentative distance. At each step it extracts the minimum, finalizes that vertex, and relaxes its neighbors. The heap is the engine that makes Dijkstra O((V + E) log V) instead of the O(V^2) scan-based version. A* search does the same, but keys by cost-plus-heuristic.',
        'Running median: keep a max-heap of the lower half and a min-heap of the upper half. The median is at one of the two roots. Each new number goes into the appropriate heap, and if the sizes differ by more than one, move one root to the other heap. Total cost per insertion: O(log n).',
        'Event-driven simulation and scheduling: events carry timestamps; the min-heap always yields the next event. OS schedulers use max-heaps keyed by priority so the highest-priority ready thread is always at the root. k-way merge (used in external sorting and log-structured merge trees) keeps a min-heap of k elements, one per input stream, to find the global minimum across streams.',
        'Heap sort: build a max-heap in O(n), then repeatedly extract-max and place the result at the end of the array. After n extractions, the array is sorted in ascending order. The sort is in-place (O(1) extra space), guaranteed O(n log n) regardless of input order, and has no pathological cases -- unlike quicksort, which can degrade to O(n^2) without careful pivot selection.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Search is O(n). A heap cannot find a specific value without scanning the entire array. If you need to cancel a job by ID or update a priority, you need an auxiliary index -- typically a hash map from item ID to heap index. Every swap during sift operations must update this map, which adds implementation complexity and constant-factor overhead.',
        'Decrease-key without an index costs O(n) because you must first locate the element. This matters for Dijkstra on dense graphs. A Fibonacci heap reduces decrease-key to O(1) amortized, improving Dijkstra from O((V + E) log V) to O(V log V + E). In practice, the binary heap\'s cache-friendly array layout often wins until graphs reach millions of edges, because the Fibonacci heap\'s pointer chasing and bookkeeping eat the theoretical advantage.',
        'No ordered iteration. You cannot list heap elements in sorted order without calling extract-max n times, which destroys the heap. The heap cannot answer predecessor, successor, or range queries. If you need ordered traversal, use a balanced BST instead.',
        'Cache behavior degrades for very large heaps. Sift-down jumps from index i to 2i+1 or 2i+2, doubling the stride at each level. Near the bottom of a million-element heap, parent and child may sit in different cache lines or even different virtual memory pages. d-ary heaps (d = 4 or 8) reduce the tree height and improve locality at the cost of more child comparisons per level.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'We insert [15, 10, 20, 8, 12, 25, 5] into an empty min-heap, then extract twice.',
        'Insert 15. Heap: [15]. Single element, trivially valid. Insert 10. Heap becomes [15, 10]. Index 1\'s parent is index 0: 10 < 15, so swap. Heap: [10, 15]. The smaller value bubbles to the root.',
        'Insert 20. Heap: [10, 15, 20]. Index 2\'s parent is index 0: 20 > 10, no swap needed. Insert 8. Heap: [10, 15, 20, 8]. Index 3\'s parent is index 1: 8 < 15, swap. Heap: [10, 8, 20, 15]. Now index 1\'s parent is index 0: 8 < 10, swap. Heap: [8, 10, 20, 15]. Value 8 bubbled two levels to become the new root.',
        'Insert 12. Heap: [8, 10, 20, 15, 12]. Index 4\'s parent is index 1: 12 > 10, stop. Insert 25. Heap: [8, 10, 20, 15, 12, 25]. Index 5\'s parent is index 2: 25 > 20, stop. Insert 5. Heap: [8, 10, 20, 15, 12, 25, 5]. Index 6\'s parent is index 2: 5 < 20, swap. Heap: [8, 10, 5, 15, 12, 25, 20]. Index 2\'s parent is index 0: 5 < 8, swap. Heap: [5, 10, 8, 15, 12, 25, 20]. Value 5 is the new minimum at the root.',
        'Extract-min #1. Save root value 5. Move last element (20) to index 0: [20, 10, 8, 15, 12, 25]. Sift down: 20\'s children are 10 (index 1) and 8 (index 2). Smaller child is 8. 20 > 8, so swap: [8, 10, 20, 15, 12, 25]. Now 20 is at index 2, with one child: 25 (index 5). 20 < 25, so stop. Heap valid. Returned 5; new min is 8.',
        'Extract-min #2. Save root value 8. Move last element (25) to index 0: [25, 10, 20, 15, 12]. Sift down: 25\'s children are 10 (index 1) and 20 (index 2). Smaller child is 10. 25 > 10, swap: [10, 25, 20, 15, 12]. Now 25 is at index 1, children 15 (index 3) and 12 (index 4). Smaller child is 12. 25 > 12, swap: [10, 12, 20, 15, 25]. Index 1 now holds 12 at a leaf. Heap valid. Returned 8; new min is 10.',
        'Final array is [10, 12, 20, 15, 25]. This is not sorted -- 20 comes before 15 -- because the heap only enforces the parent-child rule, not a global ordering. That partial order is exactly what makes the heap cheaper to maintain than a sorted array, while still guaranteeing O(1) access to the minimum.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: J.W.J. Williams, \'Algorithm 232: Heapsort,\' Communications of the ACM 7(6), 1964 -- introduced the binary heap and heap sort in a single paper. R.W. Floyd, \'Algorithm 245: Treesort 3,\' Communications of the ACM 7(12), 1964 -- devised the O(n) bottom-up heap construction. M.L. Fredman and R.E. Tarjan, \'Fibonacci heaps and their uses in improved network optimization algorithms,\' Journal of the ACM 34(3), 1987 -- proved O(1) amortized decrease-key and its consequences for graph algorithms.',
        'Direct applications to study next: Heap Sort uses the heap as a sorting engine -- build in O(n), extract n times. Dijkstra\'s Shortest Path uses a min-heap as its frontier, extracting the nearest unsettled vertex at each step. A* Search extends Dijkstra with a heuristic, still powered by a min-heap. Huffman Coding repeatedly extracts the two lowest-frequency nodes from a min-heap to build an optimal prefix-free code.',
        'Alternative heap designs: Fibonacci Heap and Pairing Heap achieve O(1) amortized decrease-key, which matters when graph algorithms call decrease-key far more often than extract-min. Treap uses both BST order on keys and heap order on random priorities to achieve expected O(log n) operations without explicit rotations. B-Tree maintains full sorted order across disk pages -- the right tool when you need range queries, not just extract-best.',
        'Prerequisites: if the index arithmetic (2i+1, 2i+2, floor((i-1)/2)) felt unfamiliar, review how arrays represent complete binary trees. If the O(log n) height bound was unclear, study Binary Search Tree first -- the same height-cost relationship drives both structures.',
      ],
    },
  ],
};
