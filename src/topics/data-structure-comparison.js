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
        'The animation plots six data structures on the same axes for one operation at a time. The horizontal axis is input size n — how many elements the structure holds. The vertical axis is average operations: comparisons for search, element moves or pointer rewrites for insert and delete. Each frame adds one structure\'s curve so you can watch the gaps form as n grows.',
        'Use the operation selector to switch between Search, Insert, and Delete. Each operation tells a different story. Hash tables dominate search. Unsorted arrays dominate insert (append). No structure dominates delete without paying a price elsewhere. All curves show average-case behavior; worst-case numbers appear in the "Cost and complexity" section below.',
        'The invariant line at the bottom of each frame shows concrete numbers at the current max n. Read it to compare exact ratios, not just curve shapes — the difference between 10 comparisons and 500 comparisons is invisible at small scale but devastating at large scale.',
        {type: 'image', src: './assets/gifs/data-structure-comparison.gif', alt: 'Animated walkthrough of the data structure comparison visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A data structure is a contract: it arranges data in memory according to a specific invariant, and that invariant makes some operations cheap while forcing others to be expensive. An array keeps elements contiguous, which makes index access instant but insertion in the middle costly. A linked list uses pointers, which makes splicing instant but searching slow. Every structure is a bet on which operations your program will perform most.',
        'The critical word is "tradeoff." No structure is universally best. If one were, the field would not exist — we would all use that one structure and move on. The reason computer science teaches five or six core structures is that real workloads differ, and each structure\'s invariant is tuned to a different workload shape.',
        { type: 'callout', text: 'Data structure choice is workload design: the invariant that makes one operation cheap charges another operation somewhere else.' },
        'Most introductory courses teach these structures in isolation. You learn how a linked list works, then how a BST works, but the comparison chart — the thing that reveals why you would ever choose a slower structure — is left as an exercise. This visualization puts all six structures on the same axes so the tradeoffs are immediate. You see the O(1) curves hug the floor while the O(n) curves shoot upward, and you understand that the gap is not academic — at n = 1,000,000, O(n) versus O(1) is a million-fold difference in work.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Start with an array. Arrays are the simplest data structure: a contiguous block of memory where element i lives at address base + i * element_size. Every language supports them natively. Index access is O(1) — one multiplication and one memory read. Appending to the end is O(1) amortized. Searching a sorted array is O(log n) via binary search.',
        'For small n, arrays handle everything well. A 100-element array completes any operation in microseconds regardless of the complexity class, because the constant factors are tiny and the entire array fits in a single CPU cache line. Many production systems — including parts of the Linux kernel — use flat arrays for collections under a few hundred elements precisely because the overhead of fancier structures exceeds the savings.',
        'The reasoning is sound: start simple, and introduce complexity only when you hit a wall. The question is where that wall is.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Arrays break down on insertion and deletion in sorted order. To insert a value into a sorted array of one million elements, you binary-search to find the correct position in about 20 comparisons — fast. But then you must shift every element after that position one slot to the right. On average, that moves 500,000 elements. The O(n) shift dominates the O(log n) search, and it gets worse linearly as n grows.',
        'Linked lists solve the shift problem. Inserting a node at a known position rewrites one or two pointers, regardless of how many elements follow. No data moves. But linked lists sacrifice random access entirely — you cannot jump to the middle because nodes are scattered across memory. To find the 500,000th element, you follow 500,000 pointers. Binary search is impossible.',
        'This is the fundamental tension. Contiguous memory gives you random access and cache friendliness but makes structural changes expensive. Pointer-based memory gives you cheap structural changes but makes finding things expensive. Trees, hash tables, and heaps are all different attempts to navigate this tension, each sacrificing something different to gain something else.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Every data structure maintains an invariant — a property that is true after every operation — and the strength of that invariant determines what the structure can and cannot do efficiently. The key insight is that stronger invariants cost more to maintain but enable faster queries, while weaker invariants are cheaper to maintain but limit what you can ask.',
        'A sorted array maintains the strongest invariant: elements are in order at all times. This enables O(log n) binary search, O(1) min/max, and efficient range queries. But maintaining that order on every insert costs O(n) shifts. A BST maintains a slightly relaxed version of the same invariant (left < node < right at each subtree) using pointers instead of contiguous memory, which drops insert cost to O(log n) — but at the price of worse cache behavior and extra memory for pointers.',
        'A hash table takes a radically different approach: it maintains no order at all. Its invariant is just "element with key k lives at slot hash(k)." This is so cheap to maintain — one hash computation — that all three core operations hit O(1). But the absence of ordering means you cannot do range queries, predecessor lookups, or sorted iteration at all. A heap sits between these extremes: it maintains a partial order (parent dominates children) that is strong enough for extract-min but too weak for arbitrary search.',
        'Understanding this spectrum — from total order (sorted array) through tree order (BST) and partial order (heap) to no order (hash table) — is the single most important thing this visualization teaches. The cost of each operation is not arbitrary; it follows directly from how much order the structure promises to keep.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Unsorted array. Elements sit in insertion order — the 50th element inserted is at index 49, regardless of its value. Search scans left to right, checking each element against the target. On average you check n/2 elements before finding a match, so search is O(n). Insert appends at the end in O(1) — increment a counter, write one slot. Delete first searches in O(n), then either shifts all later elements left (preserving order, also O(n)) or swaps the deleted element with the last element (O(1) if insertion order does not matter).',
        'Sorted array. Elements sit in ascending (or descending) order. Search uses binary search: compare the middle element to the target, discard the half that cannot contain it, repeat. Each comparison halves the search space, so search takes ceil(log2(n)) comparisons — O(log n). Insert finds the correct position via binary search in O(log n), then shifts every later element one position right, which costs O(n) on average. Delete is symmetric: find in O(log n), shift left in O(n).',
        'Linked list. Each node holds a value and a pointer to the next node. Search walks from the head, following pointers — O(n) even if the list is sorted, because you cannot jump to the middle. Insert at the head rewrites one pointer (new node points to old head, head pointer points to new node) — O(1). Insert at an arbitrary known position is also O(1) for the pointer rewrite, but finding that position costs O(n). Delete requires finding the node and its predecessor — O(n) traversal, then O(1) to rewrite the predecessor\'s pointer around the deleted node.',
        'BST (balanced). A binary search tree stores one key per node, with all keys in the left subtree smaller and all keys in the right subtree larger. Search walks from the root: go left if the target is smaller, go right if larger, stop when you find it or hit a null pointer. In a balanced tree the height is about log2(n), so search is O(log n). Insert walks down to find the correct leaf position, adds the node, then rebalances. AVL trees do at most two rotations per insert; red-black trees do at most three. Delete is similar: find the node, handle three cases (leaf, one child, two children), rebalance. The two-children case replaces the node with its in-order successor — the smallest node in its right subtree.',
        'Hash table. A hash function maps each key to a slot index in an array of buckets. To search, compute hash(key), go to that slot, check if the key matches. If there is a collision (two keys map to the same slot), either chain entries in a linked list at that slot or probe to the next open slot. With a good hash function and a load factor under 0.75, most slots hold zero or one entry, so search, insert, and delete all cost O(1) amortized. Occasionally the table fills up and must resize — allocate a larger array, rehash every entry — which costs O(n) but happens rarely enough that the amortized cost stays O(1).',
        'Heap (binary). A complete binary tree stored as a flat array, where the element at index i has children at indices 2i+1 and 2i+2. The heap invariant says each parent is smaller than (min-heap) or larger than (max-heap) its children. Insert places the new element at the end of the array and "bubbles up," swapping with its parent until the invariant holds — at most ceil(log2(n)) swaps. Extract-min removes the root, moves the last element to the root position, and "sifts down," swapping with the smaller child until the invariant holds — also O(log n). Arbitrary search is O(n) because the heap invariant only constrains parent-child relationships, not siblings or cousins; knowing the root is the minimum tells you nothing about where the value 42 sits.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Binary_Heap_with_Array_Implementation.JPG/500px-Binary_Heap_with_Array_Implementation.JPG', alt: 'Binary heap tree shown beside its array representation', caption: 'A heap shows how one layout can serve two views: tree semantics for order and array storage for locality. Source: https://en.wikipedia.org/wiki/Binary_heap.' },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Contiguous memory enables binary search. Because array elements sit at predictable addresses (base + index * element_size), you can compute the address of the middle element in O(1) and jump directly to it. This is random access, and it is what makes binary search possible. A linked list cannot do this because node addresses are not predictable — each node could be anywhere in memory, and the only way to find it is to follow the chain from the head.',
        'Pointers enable O(1) structural mutations. When you insert into a linked list, no data moves. You allocate a new node, set its "next" pointer to the node that should follow it, and update the predecessor\'s "next" pointer to the new node. Two pointer writes, regardless of whether the list has 10 nodes or 10 million. The price is that finding the right predecessor requires a traversal, because pointers do not support index arithmetic.',
        'Hashing bypasses comparison entirely. Comparison-based search has a proven lower bound of Omega(log n) — you must ask at least log2(n) yes-or-no questions to identify one element among n. Hash tables sidestep this bound because they do not compare keys against each other. Instead, the hash function computes the storage location directly from the key\'s bits. This is why hash tables achieve O(1) for exact lookup: they never enter the comparison game at all. The tradeoff is that hashing destroys order — you cannot ask "what is the next key after X?" because the hash function scattered neighbors to unrelated slots.',
        'The heap invariant is deliberately weaker than the BST invariant. A BST maintains a total order: for every node, all left descendants are smaller and all right descendants are larger. This is expensive to maintain (rotations after mutations) but enables O(log n) search for any key. A heap maintains only a partial order: each parent dominates its children. This is cheaper to maintain (just bubble up or sift down along one path) but only guarantees fast access to the root — the global minimum or maximum. Siblings are unordered, cousins are unordered, and arbitrary search requires inspecting up to every node.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Max-Heap.svg/250px-Max-Heap.svg.png', alt: 'Complete binary max heap with largest value at the root', caption: 'The heap invariant is local: each parent dominates its children, but siblings and subtrees are not globally sorted. Source: https://en.wikipedia.org/wiki/Binary_heap.' },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'All costs below are for n elements. "Amortized" means the cost is averaged over a sequence of operations; individual operations may occasionally be more expensive (e.g., hash table resize), but the average stays at the stated bound.',
        'Unsorted array — Search: O(n) average, O(n) worst. Insert (append): O(1) amortized. Delete: O(n) average (search dominates). Space: O(n). The array preserves insertion order and has excellent cache locality because elements are contiguous in memory.',
        'Sorted array — Search: O(log n) average and worst. Insert: O(n) average (shifting dominates). Delete: O(n) average (shifting dominates). Space: O(n). Supports binary search, range queries, and O(1) min/max access. The shift cost on mutation is the primary weakness.',
        'Linked list — Search: O(n) average. Insert at head: O(1). Insert at arbitrary position (given a pointer to predecessor): O(1). Delete (given pointer to predecessor): O(1). But finding the predecessor costs O(n), so end-to-end delete is O(n). Space: O(n) plus one pointer (8 bytes on 64-bit systems) per node. Poor cache locality because nodes are scattered in memory.',
        'BST (balanced) — Search: O(log n). Insert: O(log n). Delete: O(log n). Space: O(n) plus two child pointers per node (16 bytes on 64-bit). Maintains sorted order, supports range queries, predecessor, successor, rank, and select. AVL trees guarantee height at most 1.44 * log2(n); red-black trees guarantee at most 2 * log2(n). The constant factor on pointer chasing is worse than array-based binary search, but mutation is dramatically cheaper.',
        'Hash table — Search: O(1) amortized, O(n) worst. Insert: O(1) amortized, O(n) worst (resize). Delete: O(1) amortized. Space: O(n) with typical 25-50% slack due to load factor management. No ordering, no range queries, no predecessor/successor. Worst case occurs when many keys collide, but with a good hash function and load factor under 0.75 this is rare in practice.',
        'Heap — Search: O(n). Insert: O(log n). Extract-min/max: O(log n). Arbitrary delete: O(n) to find + O(log n) to fix = O(n). Space: O(n) with no pointer overhead (stored as a flat array). Only efficient for priority-queue operations. A Fibonacci heap improves decrease-key to O(1) amortized but is rarely used in practice due to high constant factors.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Unsorted array. Log buffers and append-only event streams, where data arrives in time order and is rarely searched. Write-ahead logs in databases append entries and only read them during crash recovery. Small in-memory collections (under a few hundred elements) where linear scan is fast enough that the simplicity advantage outweighs the asymptotic disadvantage.',
        'Sorted array. Static lookup tables — data loaded once and searched many times. Configuration data, compiled regular expression character classes, and read-only reference datasets. Also the backbone of interpolation search and cache-friendly range scans in columnar databases, where the data fits in contiguous pages and binary search touches fewer cache lines than a tree.',
        'Linked list. LRU caches combine a doubly-linked list (for O(1) move-to-front on access) with a hash map (for O(1) lookup by key). Memory allocators use free lists — linked lists of available memory blocks — because splicing blocks in and out is O(1). Undo/redo stacks in editors use linked lists because inserting and removing operations at the cursor position is a pointer rewrite.',
        'BST (balanced). Database indexes: B-trees (the multi-way generalization of BSTs) power every major relational database because they support O(log n) search, insert, delete, and range queries in a cache-friendly way. In-memory ordered maps like C++ std::map and Java TreeMap use red-black trees. Any workload needing range queries ("give me all keys between 100 and 200"), rank queries ("what is the 50th smallest key?"), or nearest-neighbor lookups.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Bplustree.png/500px-Bplustree.png', alt: 'B plus tree with linked leaf nodes for ordered access', caption: 'B+ trees show why the comparison is not just Big-O: wide nodes and linked leaves are tuned for database range scans. Source: https://en.wikipedia.org/wiki/B%2B_tree.' },
        'Hash table. The most-used data structure in practice. Python dictionaries, JavaScript objects, Java HashMaps, Redis key-value stores, DNS caches, compiler symbol tables, network routing tables, deduplication systems, and counting/aggregation pipelines. Any workload dominated by exact-match lookups where ordering does not matter.',
        'Heap. Priority queues in Dijkstra\'s shortest-path algorithm (extract the closest unvisited node), event-driven simulation (extract the next event by timestamp), merge of k sorted streams (extract the smallest head), operating system schedulers (extract the highest-priority process), and median-maintenance algorithms (one max-heap for the lower half, one min-heap for the upper half).',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Unsorted array. Search is O(n). At n = 1,000,000 you scan a million elements to answer one query. If your workload issues 1,000 searches per second, you perform a billion element comparisons per second — unacceptable. Sort the array, use a BST, or use a hash table.',
        'Sorted array. Insertion and deletion are O(n) because of element shifting. A sorted array of one million elements that receives 1,000 inserts per second moves 500 billion elements per second on average. The structure is read-optimized; if your workload writes frequently, it will collapse. Use a BST or B-tree, which achieve O(log n) on all three operations.',
        'Linked list. No random access and no binary search, even when sorted. Worse, cache locality is terrible: each pointer chase is likely a cache miss (64 bytes loaded from main memory, only 8 bytes used). At scale, a flat array with O(n) linear scan often outperforms a linked list with O(n) linear scan by 5-10x on modern CPUs because the array scans contiguous memory that the hardware prefetcher handles well.',
        'BST. Without balancing, a BST degrades to a linked list on sorted or nearly-sorted input — height becomes n instead of log n, and all operations become O(n). Self-balancing variants (AVL, red-black) fix this but add implementation complexity, per-node overhead (color bits, parent pointers, balance factors), and constant-factor overhead from rotations. For pure exact-match lookup with no ordering need, a hash table is simpler and faster.',
        'Hash table. No ordering. You cannot iterate in sorted order, find the next-larger key, or answer range queries. Worst-case O(n) when many keys collide — adversarial inputs can force this deliberately (HashDoS attacks). Resizing triggers an O(n) rehash spike. Memory overhead from maintaining a load factor under 0.75 means 25-50% of the allocated array is empty slots.',
        'Heap. Arbitrary search is O(n). If you need to find or update an element that is not the root, you scan the entire heap. A heap is a specialist: it excels at insert + extract-min/max and nothing else. For general-purpose use, a BST is more versatile.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Scenario: you are building a contact book with 10,000 entries. The workload is 80% search by name, 15% insert (new contact), and 5% delete (remove contact). Which structure do you choose?',
        'Unsorted array. Each search scans 5,000 entries on average. With 80% of operations being searches, you average 0.80 * 5,000 = 4,000 element comparisons per operation. Insert is O(1) — just append — but it accounts for only 15% of operations. Total average cost per operation: approximately 4,000 comparisons. At 10,000 operations per second, that is 40 million comparisons per second.',
        'Sorted array. Search uses binary search: ceil(log2(10,000)) = 14 comparisons. Insert finds the position in 14 comparisons but then shifts 5,000 elements on average. Weighted average cost: 0.80 * 14 + 0.15 * 5,014 + 0.05 * 5,014 = 11.2 + 752.1 + 250.7 = 1,014 operations per query. Better than unsorted for search, but the shift cost on insert and delete is still painful.',
        'BST (balanced). Search: about 14 comparisons (log2(10,000) = 13.3). Insert: about 14 comparisons plus at most 2 rotations. Delete: about 14 comparisons plus at most 3 rotations. Weighted average: 0.80 * 14 + 0.15 * 16 + 0.05 * 17 = 11.2 + 2.4 + 0.85 = 14.5 operations per query. Every operation is O(log n). This is 275x less work than unsorted array and maintains sorted order for free.',
        'Hash table. Search: 1 hash + 1 comparison (amortized). Insert: 1 hash + 1 write. Delete: 1 hash + 1 comparison + 1 write. Weighted average: about 2 operations per query. This is 7x faster than BST and 2,000x faster than unsorted array. But you lose the ability to iterate contacts in alphabetical order, find "all contacts starting with S," or answer "who comes after Smith?" If you need those features, the BST\'s 14.5 operations per query is the right price to pay.',
        'Heap. Search is O(n) — 5,000 comparisons on average, same as unsorted array. Heaps are purpose-built for priority queues, not general search. Unless your workload is dominated by "give me the contact with the smallest/largest name," a heap is the wrong tool. Verdict: hash table if ordering is unnecessary, BST if you need sorted traversal.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Cormen, T. H., Leiserson, C. E., Rivest, R. L., and Stein, C. (2009). Introduction to Algorithms, 3rd edition (MIT Press) — the canonical reference for all structures covered here, including formal proofs of the complexity bounds. Chapters 10-13 cover linked lists, hash tables, BSTs, and red-black trees. Chapter 6 covers heaps. Sedgewick, R. and Wayne, K. (2011). Algorithms, 4th edition (Addison-Wesley) — excellent empirical comparisons and visualizations of these structures in practice.',
        'Knuth, D. E. (1998). The Art of Computer Programming, Volume 3: Sorting and Searching, 2nd edition (Addison-Wesley) — the deepest treatment of searching and comparison-based lower bounds, including the Omega(log n) proof that hash tables bypass. For B-trees specifically: Comer, D. (1979). "The Ubiquitous B-Tree," Computing Surveys 11(2) — still the best single overview of why databases chose B-trees over BSTs.',
        'Related topics on this site: Big-O Growth Rates (the mathematical framework behind these curves), Binary Search (the O(log n) algorithm that sorted arrays enable), Hash Table (hash function design, collision resolution, load factor management), Binary Search Tree (BST operations, rotations, balancing), Binary Heap (heap operations, heapify, priority queues), Linked List (pointer mechanics, singly vs doubly linked). For the sorting analog of this comparison: Sorting Algorithm Comparison.',
      ],
    },
  ],
};
