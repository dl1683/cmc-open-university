// Data structure operations comparison: array, linked list, BST, hash table,
// and heap plotted for search, insert, and delete so the tradeoffs are visceral.

import { plotState, parseIntegerInRange } from '../core/state.js';

export const topic = {
  id: 'data-structure-comparison',
  title: 'Data Structure Operations Comparison',
  category: 'Concepts',
  summary: 'Array vs linked list vs BST vs hash table vs heap — see how each structure trades off search, insert, and delete.',
  controls: [
    { id: 'operation', label: 'Operation', type: 'select', options: ['Search', 'Insert', 'Delete'], defaultValue: 'Search' },
    { id: 'maxN', label: 'Max input size', type: 'select', options: ['50', '200', '500'], defaultValue: '200' },
  ],
  run,
};

const log2 = (n) => (n <= 1 ? 0 : Math.log2(n));

// --- Curve definitions per operation ---

const searchCurves = [
  {
    id: 'unsorted-array',
    label: 'Unsorted array',
    fn: (n) => n / 2,
    blurb: 'O(n) linear scan: no order means you check every element until you find the target or exhaust the array. Average: n/2 comparisons.',
  },
  {
    id: 'sorted-array',
    label: 'Sorted array',
    fn: (n) => log2(n),
    blurb: 'O(log n) binary search: compare the middle, throw away half. Doubling n adds one comparison. A sorted array is the simplest structure that gives you logarithmic search.',
  },
  {
    id: 'linked-list',
    label: 'Linked list',
    fn: (n) => n / 2,
    blurb: 'O(n) sequential scan: even if sorted, you cannot jump to the middle — you follow pointers one by one. Same n/2 average as unsorted array, but with worse cache behavior.',
  },
  {
    id: 'bst',
    label: 'BST (balanced)',
    fn: (n) => log2(n),
    blurb: 'O(log n) tree walk: left if smaller, right if larger. A balanced BST (AVL, red-black) guarantees height ≈ log₂ n. Unbalanced BSTs degrade to O(n) — balance is not optional.',
  },
  {
    id: 'hash-table',
    label: 'Hash table',
    fn: () => 1,
    blurb: 'O(1) amortized: hash the key, jump to the slot. No comparisons, no traversal. The price: O(n) worst case on hash collisions, and no ordering.',
  },
  {
    id: 'heap',
    label: 'Heap',
    fn: (n) => n / 2,
    blurb: 'O(n) for arbitrary search: a heap only promises the min (or max) is at the root. Finding an arbitrary element requires scanning roughly half the heap.',
  },
];

const insertCurves = [
  {
    id: 'unsorted-array',
    label: 'Unsorted array',
    fn: () => 1,
    blurb: 'O(1) append: drop the new element at the end. No comparisons, no shifting. This is the unsorted array\'s one great strength.',
  },
  {
    id: 'sorted-array',
    label: 'Sorted array',
    fn: (n) => n / 2,
    blurb: 'O(n) shift: find the insertion point in O(log n) via binary search, then shift every later element one position right. The shift dominates — on average, n/2 elements move.',
  },
  {
    id: 'linked-list',
    label: 'Linked list',
    fn: () => 1,
    blurb: 'O(1) at head: rewrite one pointer. Insertion at an arbitrary known position is also O(1) — the cost is finding the position (O(n) search), not the insertion itself.',
  },
  {
    id: 'bst',
    label: 'BST (balanced)',
    fn: (n) => log2(n),
    blurb: 'O(log n): walk down the tree to find the leaf position, insert, then rebalance. AVL trees do at most two rotations; red-black trees do at most three.',
  },
  {
    id: 'hash-table',
    label: 'Hash table',
    fn: () => 1,
    blurb: 'O(1) amortized: hash, place. Occasionally the table resizes (O(n) rehash), but amortized over all inserts the cost averages to constant.',
  },
  {
    id: 'heap',
    label: 'Heap',
    fn: (n) => log2(n),
    blurb: 'O(log n) bubble up: place the new element at the end of the array, then swap it upward until the heap property is restored. At most ⌈log₂ n⌉ swaps.',
  },
];

const deleteCurves = [
  {
    id: 'unsorted-array',
    label: 'Unsorted array',
    fn: (n) => n / 2,
    blurb: 'O(n): find the element (O(n) scan), then shift all later elements left — or swap with the last element for O(1) removal if order does not matter.',
  },
  {
    id: 'sorted-array',
    label: 'Sorted array',
    fn: (n) => n / 2,
    blurb: 'O(n): binary search finds it in O(log n), but closing the gap requires shifting n/2 elements on average. The shift is the bottleneck, just like insertion.',
  },
  {
    id: 'linked-list',
    label: 'Linked list',
    fn: (n) => n / 2,
    blurb: 'O(n): traverse to find the node (O(n) scan), then rewrite one pointer to remove it. The deletion itself is O(1) — the search dominates.',
  },
  {
    id: 'bst',
    label: 'BST (balanced)',
    fn: (n) => log2(n),
    blurb: 'O(log n): find the node, handle three cases (leaf, one child, two children), rebalance. The two-children case replaces the node with its in-order successor.',
  },
  {
    id: 'hash-table',
    label: 'Hash table',
    fn: () => 1,
    blurb: 'O(1) amortized: hash the key, remove the entry. With open addressing, mark the slot as deleted (tombstone). With chaining, unlink from the bucket list.',
  },
  {
    id: 'heap',
    label: 'Heap',
    fn: (n) => log2(n),
    blurb: 'O(log n) for the root (extract-min/max): replace root with last element, sift down. Arbitrary deletion is O(n) to find + O(log n) to fix, but extract-root is the common case.',
  },
];

const operationSets = {
  Search: { curves: searchCurves, yLabel: 'comparisons (average)' },
  Insert: { curves: insertCurves, yLabel: 'operations (average)' },
  Delete: { curves: deleteCurves, yLabel: 'operations (average)' },
};

function buildSeries(curves, visible, ns) {
  return curves.slice(0, visible).map((c) => ({
    id: c.id,
    label: c.label,
    points: ns.map((n) => ({ x: n, y: c.fn(n) })),
  }));
}

function fmtVal(v) {
  return v < 10 ? v.toFixed(1) : Math.round(v).toLocaleString();
}

export function* run(input) {
  const operation = ['Search', 'Insert', 'Delete'].includes(input.operation) ? input.operation : 'Search';
  const maxN = parseIntegerInRange(input.maxN, { min: 50, max: 500, label: 'n' });
  const step = maxN <= 50 ? 1 : maxN <= 200 ? 2 : 5;
  const ns = Array.from({ length: Math.floor(maxN / step) }, (_, i) => (i + 1) * step);

  const { curves, yLabel } = operationSets[operation];
  const axes = { x: { label: 'n (input size)' }, y: { label: yLabel } };

  // Frame 1: first curve alone
  yield {
    state: plotState({ axes, series: buildSeries(curves, 1, ns) }),
    highlight: { active: [curves[0].id] },
    explanation: `We compare five data structures on ${operation.toLowerCase()} cost, plotting average operations as n grows from ${step} to ${maxN}. First up: ${curves[0].label.toLowerCase()}. ${curves[0].blurb}`,
  };

  // Frames 2-6: add one curve at a time
  for (let i = 1; i < curves.length; i += 1) {
    yield {
      state: plotState({ axes, series: buildSeries(curves, i + 1, ns) }),
      highlight: { active: [curves[i].id], visited: curves.slice(0, i).map((c) => c.id) },
      explanation: `Add ${curves[i].label.toLowerCase()}. ${curves[i].blurb}`,
      invariant: `At n = ${maxN}: ${curves[i].label.toLowerCase()} = ${fmtVal(curves[i].fn(maxN))}, ${curves[0].label.toLowerCase()} = ${fmtVal(curves[0].fn(maxN))}.`,
    };
  }

  // Frame 7: All together with summary
  const summaryParts = curves.map((c) => `${c.label}: ${fmtVal(c.fn(maxN))}`);
  yield {
    state: plotState({ axes, series: buildSeries(curves, curves.length, ns) }),
    highlight: {},
    explanation: `All six together for ${operation.toLowerCase()}. The O(1) curves hug the floor while O(n) curves shoot upward. No single structure wins every operation — that tension is why data structure selection matters. Hash tables dominate search/insert/delete individually, but sacrifice ordering, range queries, and worst-case guarantees. The right choice depends on which operations your workload actually performs.`,
    invariant: `At n = ${maxN}: ${summaryParts.join(', ')}.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation plots six data structures on the same axes for one operation at a time. The horizontal axis is input size n. The vertical axis is average operations (comparisons for search, element moves or pointer rewrites for insert and delete). Each frame adds one data structure so you can watch the gaps form.',
        'Use the operation selector to switch between Search, Insert, and Delete. Each operation tells a different story: hash tables dominate search, unsorted arrays dominate insert (append), and no structure dominates delete without a tradeoff. The curves are average-case; worst-case numbers appear in the article below.',
        'The invariant line shows concrete numbers at the current max n so you compare ratios, not just shapes.',
      
        {type: 'image', src: './assets/gifs/data-structure-comparison.gif', alt: 'Animated walkthrough of the data structure comparison visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Choosing the right data structure is the most impactful decision in program design. A wrong algorithm on the right structure is fixable; the right algorithm on the wrong structure is doomed. The difference between O(1) hash lookup and O(n) linear scan is not a percentage improvement — at n = 1,000,000 it is a million-fold gap.',
        { type: 'callout', text: 'Data structure choice is workload design: the invariant that makes one operation cheap charges another operation somewhere else.' },
        'Yet most introductory courses teach data structures in isolation: here is a linked list, here is a tree, here is a hash table. The comparison chart that reveals the tradeoffs — why you would ever choose a slower structure — is often left as an exercise. This visualization makes the tradeoffs visceral: you see the curves diverge and understand that speed on one operation comes at the cost of another.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Use an array for everything. Arrays are contiguous in memory, cache-friendly, simple to reason about, and supported by every language. Index access is O(1). Appending to an unsorted array is O(1). Searching a sorted array is O(log n) via binary search.',
        'For small n this works. A 100-element array handles any operation in microseconds regardless of complexity class. The constant factors are tiny, the cache is warm, and the code is simple. Many production systems use flat arrays for collections under a few hundred elements precisely because the overhead of fancier structures is not worth it.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Arrays excel at random access but struggle with insertion and deletion in sorted order. Inserting into a sorted array of a million elements shifts 500,000 elements on average. Deleting from the middle shifts everything after the gap. These O(n) shifts dominate at scale.',
        'Linked lists fix the shift problem — insertion and deletion at a known node are O(1) pointer rewrites — but sacrifice random access and binary search. You cannot jump to the middle of a linked list; you walk from the head.',
        'No single structure wins everywhere. That tension is the reason data structures exist as a field: every structure is a bet on which operations matter most for your workload.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Unsorted array: elements sit in insertion order. Search scans left to right — O(n) average, O(n) worst. Insert appends at the end — O(1). Delete finds the element (O(n)), then either shifts elements left (O(n)) or swaps with the last element (O(1) if order does not matter).',
        'Sorted array: elements sit in sorted order. Search uses binary search — O(log n). Insert finds the position via binary search (O(log n)) then shifts everything right — O(n) total. Delete is symmetric: find in O(log n), shift left in O(n).',
        'Linked list: nodes are connected by pointers. Search walks from the head — O(n). Insert at the head rewrites one pointer — O(1). Insert at a known position is O(1) for the pointer rewrite but O(n) to find the position. Delete requires finding the predecessor — O(n) traversal, O(1) unlinking.',
        'BST (balanced): each node stores a key; left children are smaller, right children are larger. Search, insert, and delete all walk from root to leaf — O(log n) when balanced. AVL and red-black trees maintain balance with rotations after each mutation.',
        'Hash table: hash the key to compute a slot index. Search, insert, and delete all cost O(1) amortized — one hash computation, one memory access (ignoring collisions). Worst case is O(n) when all keys collide, but good hash functions and resizing make this rare.',
        'Heap (binary): a complete binary tree stored as an array where each parent is smaller (min-heap) or larger (max-heap) than its children. Insert bubbles up — O(log n). Extract-min/max sifts down — O(log n). Arbitrary search is O(n) because the heap property only constrains parent-child, not left-right.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Binary_Heap_with_Array_Implementation.JPG/500px-Binary_Heap_with_Array_Implementation.JPG', alt: 'Binary heap tree shown beside its array representation', caption: 'A heap shows how one layout can serve two views: tree semantics for order and array storage for locality. Source: https://en.wikipedia.org/wiki/Binary_heap.' },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Contiguous memory enables binary search. Because array elements sit at predictable addresses (base + index * size), you can jump to the middle in O(1). This random access is what makes binary search possible and what linked lists lack.',
        'Pointers enable O(1) structural mutations. Inserting into a linked list rewrites one or two pointers regardless of list size. No elements move. The price is that finding the right spot requires a traversal, because pointers do not support arithmetic the way array indices do.',
        'Hashing bypasses comparison entirely. Instead of asking "is this key less than or greater than that key?" a hash function computes the answer location directly from the key bits. This is why hash tables beat comparison-based structures for exact lookup: they do not climb the log n comparison tree at all.',
        'The heap property is weaker than the BST property. A BST maintains a total order (left < node < right at every level), which is why search is O(log n). A heap only maintains a partial order (parent < children), which is enough for extract-min but not for arbitrary search. Weaker invariant, cheaper maintenance, narrower use case.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Max-Heap.svg/250px-Max-Heap.svg.png', alt: 'Complete binary max heap with largest value at the root', caption: 'The heap invariant is local: each parent dominates its children, but siblings and subtrees are not globally sorted. Source: https://en.wikipedia.org/wiki/Binary_heap.' },
      ],
    },
    {
      heading: 'Cost',
      paragraphs: [
        'Average-case operation costs (n elements):',
        'Unsorted array — Search: O(n). Insert: O(1). Delete: O(n). Space: O(n). Preserves insertion order.',
        'Sorted array — Search: O(log n). Insert: O(n). Delete: O(n). Space: O(n). Supports range queries and binary search.',
        'Linked list — Search: O(n). Insert at head: O(1). Delete: O(n). Space: O(n) plus one pointer per node. No random access.',
        'BST (balanced) — Search: O(log n). Insert: O(log n). Delete: O(log n). Space: O(n) plus two pointers per node. Maintains sorted order; supports range queries, predecessor, successor.',
        'Hash table — Search: O(1). Insert: O(1). Delete: O(1). Space: O(n) with load factor overhead. No ordering, no range queries, O(n) worst case on collisions.',
        'Heap — Search: O(n). Insert: O(log n). Delete-min: O(log n). Space: O(n). Only efficient for priority-queue operations (insert and extract-min/max).',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Unsorted array: when insertion order matters and searches are rare. Log buffers, append-only event streams, and small collections where linear scan is fast enough.',
        'Sorted array: when the data is static or rarely modified and searches are frequent. Lookup tables, configuration data, binary search on read-heavy workloads. Also the foundation for interpolation search and cache-friendly range scans.',
        'Linked list: when insertions and deletions at known positions dominate and random access is unnecessary. LRU caches (doubly-linked list + hash map), free lists in memory allocators, and undo stacks where splicing is frequent.',
        'BST (balanced): when you need all operations in O(log n) with sorted order. Database indexes (B-trees are the multi-way generalization), in-memory ordered maps (C++ std::map, Java TreeMap), and any workload needing range queries, rank queries, or nearest-neighbor lookups.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Bplustree.png/500px-Bplustree.png', alt: 'B plus tree with linked leaf nodes for ordered access', caption: 'B+ trees show why the comparison is not just Big-O: wide nodes and linked leaves are tuned for database range scans. Source: https://en.wikipedia.org/wiki/B%2B_tree.' },
        'Hash table: when exact-match lookups, inserts, and deletes dominate and ordering is irrelevant. Symbol tables, caches, deduplication, counting, and any key-value store. The most-used data structure in practice.',
        'Heap: when the workload is a priority queue — repeatedly inserting elements and extracting the minimum or maximum. Dijkstra\'s algorithm, event-driven simulation, merge of k sorted streams, and real-time scheduling.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Unsorted array: search is O(n). At n = 1,000,000 that means scanning a million elements to find one. Unacceptable for any read-heavy workload.',
        'Sorted array: insertion and deletion are O(n) because of element shifting. A million-element sorted array that receives frequent inserts spends most of its time moving data. Use a BST or B-tree instead.',
        'Linked list: no random access, no binary search, poor cache locality. Traversing a linked list chases pointers through scattered memory, causing cache misses on every step. At scale, a flat array with linear scan often outperforms a linked list despite the same O(n) complexity.',
        'BST: without balancing, a BST degrades to a linked list (O(n) for all operations) on sorted input. Self-balancing trees (AVL, red-black) fix this but add implementation complexity and per-node overhead (parent pointers, balance factors, colors).',
        'Hash table: no ordering. You cannot iterate in sorted order, find the nearest key, or perform range queries. Worst-case O(n) on hash collisions. Resizing causes an O(n) spike. Memory overhead from load-factor slack.',
        'Heap: arbitrary search is O(n). If you need to find or delete an element that is not the root, you scan the whole heap. A heap is a specialist, not a generalist.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Scenario: 1,000 elements, searching for a value that exists.',
        'Unsorted array: scan from the start, find it after checking 500 elements on average. 500 comparisons.',
        'Sorted array: binary search halves the range each step. log₂(1000) = 9.97, so at most 10 comparisons.',
        'Linked list: walk node by node, 500 pointer-follows on average. Same comparison count as unsorted array, but each step chases a pointer to a possibly distant cache line.',
        'BST (balanced): walk from root to leaf, comparing at each level. Height ≈ log₂(1000) ≈ 10. At most 10 comparisons, like binary search on a sorted array, but the tree also supports O(log n) insert and delete.',
        'Hash table: compute hash(key), index into the table, check one slot. 1 operation (amortized). At n = 1,000, this is 500x faster than linear scan.',
        'Heap: no shortcut — scan roughly 500 elements. The heap property only tells you the root is the minimum; it says nothing about where an arbitrary value sits.',
        'The lesson: if your workload is search-heavy, a hash table or BST pays for its overhead many times over. If your workload is insert-heavy with rare searches, an unsorted array or linked list is simpler and faster.',
      ],
    },
    {
      heading: 'Sources and further reading',
      paragraphs: [
        'Cormen, T. H., Leiserson, C. E., Rivest, R. L., and Stein, C. (2009). Introduction to Algorithms, 3rd edition — canonical reference for all five structures and their complexity analysis. Sedgewick, R. and Wayne, K. (2011). Algorithms, 4th edition — clear implementations and empirical comparisons.',
        'Related topics on this site: Big-O Growth Rates (the underlying math), Sorting Algorithm Comparison (a sibling chart for sorting), Binary Search, Hash Table, Binary Search Tree, Binary Heap, Linked List. For real-world structure selection: Data Structure Design Patterns.',
      ],
    },
  ],
};
