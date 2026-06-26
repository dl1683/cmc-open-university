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
      
        {type: 'image', src: './assets/gifs/heap-sort.gif', alt: 'Animated walkthrough of the heap sort visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
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
        {type: 'callout', text: 'Heap sort spends one O(n) heap build so every later maximum removal is a logarithmic sift instead of a full scan.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Sorting_heapsort_anim.gif', alt: 'Animated heap sort moving maximum values into a sorted suffix', caption: 'The animation shows the two-region view directly: a live heap prefix and a sorted suffix that grows from the right. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Sorting_heapsort_anim.gif.'},
        'During Phase 1 (build-heap), highlighted boxes show the parent being compared to its children. A swap highlight means the parent was smaller and sank down. No element leaves the heap yet; the goal is only to establish the max-heap property.',
        'During Phase 2 (extract-max), the root and the last heap element swap (swap highlight), then the new root sifts down (active and compare highlights). Elements that reach the sorted suffix turn a different color and never move again. When every box is in the suffix, sorting is done.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'J. W. J. Williams introduced heaps and heap sort in 1964 to solve a specific gap in comparison sorting. Merge sort guarantees O(n log n) worst-case time but needs O(n) extra space. Quicksort runs fast in practice with O(1) extra space but degrades to O(n^2) on adversarial inputs. No comparison sort before heap sort delivered both guarantees simultaneously.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/38/Max-Heap.svg', alt: 'Max heap drawn as a complete binary tree', caption: 'A max-heap stores the largest remaining value at the root while leaving the rest only partially ordered. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Max-Heap.svg.'},
        'Heap sort is the only comparison sort that is O(n log n) in the worst case and uses O(1) auxiliary space. That combination matters whenever memory is scarce and worst-case latency is a hard constraint. Robert Floyd improved it in the same year with the bottom-up heap construction that reduces the build phase from O(n log n) to O(n).',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Selection sort solves the same problem with the same space budget. Scan the unsorted region for the largest value, swap it to the end, repeat. It uses O(1) extra space and is simple to implement. For small arrays it works fine.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Binary_heap_bottomup_vs_topdown.svg/250px-Binary_heap_bottomup_vs_topdown.svg.png', alt: 'Binary heap diagram comparing bottom-up and top-down construction', caption: 'Bottom-up heap construction is the key improvement over repeated selection or repeated insertion: most nodes are near leaves and sink only a short distance. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Binary_heap_bottomup_vs_topdown.svg.'},
        'The problem is the scan. Each extraction requires visiting every remaining unsorted element to find the maximum. With n elements, that is n + (n-1) + (n-2) + ... + 1 comparisons, which sums to n(n-1)/2. For 1,000 elements, selection sort makes roughly 500,000 comparisons. For 1,000,000 elements, it makes roughly 500 billion. The scan is O(n) per extraction and O(n^2) overall.',
        'Heap sort keeps the same "extract the maximum, place it at the end" strategy but replaces the O(n) scan with an O(log n) sift-down. The trick is maintaining a max-heap, a data structure where the maximum is always at index 0 by construction. After swapping the root to the end, one sift-down restores the heap property in at most log2(n) steps.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall in selection sort is that finding the maximum destroys information. After scanning the entire unsorted region to find the largest value, you know which element is biggest, but you have learned nothing about the relative order of the rest. The next scan starts from scratch.',
        'A heap preserves partial-order information between extractions. Every parent is at least as large as its children, so the second-largest value is always one of the root\'s two children. After removing the root, only the path from root to leaf needs repair. The rest of the tree still satisfies the heap property. This is why sift-down is O(log n) instead of O(n): it only walks one root-to-leaf path in a tree of height floor(log2(n)).',
        'The implicit-array representation is what makes this in-place. The children of index i live at 2i+1 and 2i+2. The parent of index i lives at floor((i-1)/2). No pointers, no node objects, no extra allocation. The array IS the tree. This arithmetic encoding was Williams\' key insight and the reason heap sort needs O(1) auxiliary space.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Heap sort splits the problem into two operations with different costs. Building the heap is O(n). Extracting all n maxima is O(n log n). The total is O(n log n), but the O(n) build is genuinely cheaper than it looks because of the structure of a complete binary tree.',
        'In a complete binary tree with n nodes, roughly n/2 nodes are leaves (height 0), n/4 are at height 1, n/8 at height 2, and so on. Building the heap bottom-up means each node sinks at most its height. The total work is sum from h=0 to log(n) of (n / 2^(h+1)) * h. That sum converges to O(n), not O(n log n). Most nodes are near the bottom and sink only one or two levels.',
        'The extraction phase cannot beat O(n log n) because each of n extractions requires a sift-down of up to log(n) levels. But the constant factor is small: each sift-down step does at most two comparisons (pick the larger child, compare with parent). The total comparison count is at most 2n log2(n).',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Phase 1 builds the max-heap. Start at the last parent index, floor(n/2) - 1, and work backward to index 0. For each parent, compare it with its larger child. If the child is bigger, swap them and continue sinking the parent down through the tree until it is larger than both children or reaches a leaf. Because you process bottom-up, by the time you sift a node at height h, both child subtrees are already valid heaps.',
        'Phase 2 extracts maxima. The root (index 0) holds the largest value in the heap. Swap it with the last element in the heap region, shrink the heap size by one, and sift-down the new root to restore the heap property. The swapped-out maximum is now in its final sorted position. Repeat until the heap has one element.',
        'Sift-down is the only nontrivial operation. Given a parent at index i, compute its children at 2i+1 and 2i+2. If both children exist, pick the larger one. If that child is larger than the parent, swap and move i to the child\'s index. Repeat until the parent is larger than both children or has no children. Each iteration moves one level down, so sift-down is O(log n).',
        'The sorted suffix grows from right to left. After k extractions, the rightmost k positions hold the k largest values in sorted order. The leftmost n-k positions form a valid max-heap of the remaining values. These two invariants hold throughout Phase 2.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on two invariants maintained at the start of each Phase 2 iteration. First, the prefix values[0..heapSize-1] is a valid max-heap, so values[0] is the largest remaining element. Second, the suffix values[heapSize..n-1] contains the already-extracted maxima in sorted order, and every suffix element is at least as large as every prefix element.',
        'The swap-and-sift step preserves both invariants. Swapping the root to position heapSize-1 places the current maximum in its final position, extending the sorted suffix by one. The new root may violate the heap property, but sift-down restores it by pushing the out-of-place value down until it is larger than both children. The sorted suffix is never touched by sift-down because the heap boundary has already shrunk.',
        'The build phase\'s correctness follows by induction. After processing index i, the subtree rooted at i is a valid heap. Since we process from floor(n/2)-1 down to 0, by the time we reach index i, all subtrees below i are already valid. Sift-down at index i can only push a value into already-valid subtrees, and it stops when the heap property holds locally.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Time: O(n) for the build phase, O(n log n) for the extraction phase, O(n log n) total. This holds in the best, average, and worst case. There is no adversarial input that degrades heap sort, unlike quicksort\'s O(n^2) worst case.',
        'Space: O(1) auxiliary. The array is sorted in place. Sift-down uses only a constant number of index variables. No recursion is needed; the tree traversal is a while loop driven by index arithmetic.',
        'Comparisons: at most 2n log2(n) comparisons in the extraction phase. The build phase uses at most 2n comparisons. For n = 1,000, that is roughly 20,000 comparisons total. For n = 1,000,000, roughly 40,000,000. Merge sort uses about n log2(n) comparisons (half as many), but needs O(n) extra memory.',
        'Cache behavior: sift-down follows the path 0 -> 2i+1 -> 4i+3 -> 8i+7, which jumps exponentially through the array. This access pattern defeats CPU prefetchers that expect sequential or strided access. On modern hardware, merge sort and quicksort often run 2-4x faster than heap sort on large arrays despite having the same or worse Big-O, purely because of cache effects.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The full heap sort is most visible as a fallback inside hybrid sorting algorithms. C++\'s std::sort uses introsort, which starts with quicksort but switches to heap sort if the recursion depth exceeds 2 * log2(n). This guarantees O(n log n) worst-case time while keeping quicksort\'s superior average-case cache performance. The GNU C library, LLVM libc++, and MSVC all use this strategy.',
        'The heap data structure itself is more important than the sort. Operating-system schedulers use priority queues (heaps) to pick the next process to run. Dijkstra\'s shortest-path algorithm uses a min-heap to extract the frontier node with the smallest tentative distance. Prim\'s minimum spanning tree algorithm uses the same structure. Huffman coding builds an optimal prefix code by repeatedly merging the two lowest-frequency symbols from a min-heap.',
        'In streaming analytics, two heaps (a max-heap for the lower half, a min-heap for the upper half) maintain a running median in O(log n) per update. Database query planners use heaps for top-k queries and external merge sorts. The implicit-array representation means heaps are the default priority queue in nearly every standard library.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Heap sort is not stable. Equal elements can swap past each other during sift-down. If you sort records by score and two records have score 50, their relative order in the output is not guaranteed to match their input order. Merge sort is the standard choice when stability matters.',
        'The sort is also slower in practice than quicksort and merge sort on arrays that fit in cache. The sift-down access pattern scatters reads across the array, causing cache misses on every level of the tree. For a heap of 1,000,000 elements, sift-down touches indices 0, 1, 3, 7, 15, 31, ..., which are on different cache lines starting around depth 4. Quicksort\'s partition scan, by contrast, reads sequential memory.',
        'A common misconception is that building a heap by repeated insertion (top-down) is equivalent to Floyd\'s bottom-up heapify. Repeated insertion is O(n log n) because each of n insertions sifts up at most log(n) levels. Bottom-up heapify is O(n) because most nodes are near the leaves. Using the wrong build method doubles the constant factor of the algorithm.',
        'Another pitfall is confusing partial heap order with sorted order. A max-heap only guarantees that each parent is at least as large as its children. Siblings can appear in any order, cousins can appear in any order, and the second-largest element could be anywhere at depth 1. The extraction phase is necessary to produce a fully sorted array.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with array [4, 10, 3, 5, 1, 8, 7]. There are 7 elements, so the last parent is at index floor(7/2)-1 = 2 (value 3). Its children are at indices 5 (value 8) and 6 (value 7). The larger child is 8 > 3, so swap: [4, 10, 8, 5, 1, 3, 7]. Next parent is index 1 (value 10). Children are at indices 3 (value 5) and 4 (value 1). 10 > 5, no swap needed. Next parent is index 0 (value 4). Children are at indices 1 (value 10) and 2 (value 8). 10 > 4, so swap: [10, 4, 8, 5, 1, 3, 7]. Now sift 4 down: children at indices 3 (5) and 4 (1), 5 > 4, swap: [10, 5, 8, 4, 1, 3, 7]. Build phase complete. The max-heap is [10, 5, 8, 4, 1, 3, 7].',
        'Extraction round 1: swap root 10 with last element 7: [7, 5, 8, 4, 1, 3, 10]. Heap size shrinks to 6. Sift 7 down: children are 5 and 8, larger is 8 > 7, swap: [8, 5, 7, 4, 1, 3, 10]. Children of index 2 are 5 (value 3) only (index 6 is in the sorted suffix). 7 > 3, stop. Extraction round 2: swap 8 with index 5 value 3: [3, 5, 7, 4, 1, 8, 10]. Sift 3: children 5 and 7, swap with 7: [7, 5, 3, 4, 1, 8, 10]. 3\'s children are index 5 (sorted) -- stop.',
        'Continue this pattern for 5 more rounds. Each round the sorted suffix grows by one element from the right. After all 6 extractions, the array is [1, 3, 4, 5, 7, 8, 10]. Total comparisons: 8 for the build phase, roughly 2 * 7 * log2(7) = 39 for extractions. The real count is lower because many sift-downs terminate early when the parent is already larger than its children.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Williams introduced heap sort in "Algorithm 232: Heapsort," Communications of the ACM, 1964. Floyd published the O(n) bottom-up construction in "Algorithm 245: Treesort 3" the same year. Cormen, Leiserson, Rivest, and Stein cover both in Introduction to Algorithms, Chapter 6, with complete correctness proofs.',
        'Study Binary Heap (Priority Queue) to use the heap structure without destroying it as a sort. Compare Quick Sort for practical speed and Merge Sort for stability and guaranteed O(n log n) with extra space. Big-O Growth Rates explains why O(n log n) is the information-theoretic lower bound for comparison sorting.',
        'Connect the heap operation to graph algorithms: Dijkstra\'s Shortest Path and Prim\'s Algorithm both use a priority queue as their core data structure. Huffman Coding uses repeated minimum extraction. Understanding how sift-down maintains the heap invariant is the prerequisite for all of these.',
      ],
    },
  ],
};
