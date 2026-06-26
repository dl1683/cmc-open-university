// Eytzinger layout: store sorted keys in breadth-first binary-search-tree order
// so repeated searches get predictable branches and cache prefetch behavior.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'eytzinger-layout-binary-search',
  title: 'Eytzinger Layout Binary Search',
  category: 'Data Structures',
  summary: 'A cache-aware sorted-array layout: place keys in heap/BFS order and search with predictable child indices.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['layout transform', 'search path'], defaultValue: 'layout transform' },
  ],
  run,
};

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function tree(title) {
  return graphState({
    nodes: [
      { id: 'n1', label: '8', x: 4.9, y: 0.9, note: 'index 1' },
      { id: 'n2', label: '4', x: 2.6, y: 2.6, note: 'index 2' },
      { id: 'n3', label: '12', x: 7.2, y: 2.6, note: 'index 3' },
      { id: 'n4', label: '2', x: 1.3, y: 4.8, note: 'index 4' },
      { id: 'n5', label: '6', x: 3.8, y: 4.8, note: 'index 5' },
      { id: 'n6', label: '10', x: 6.0, y: 4.8, note: 'index 6' },
      { id: 'n7', label: '14', x: 8.4, y: 4.8, note: 'index 7' },
    ],
    edges: [
      { id: 'e1-2', from: 'n1', to: 'n2', weight: 'left=2i' },
      { id: 'e1-3', from: 'n1', to: 'n3', weight: 'right=2i+1' },
      { id: 'e2-4', from: 'n2', to: 'n4', weight: 'left' },
      { id: 'e2-5', from: 'n2', to: 'n5', weight: 'right' },
      { id: 'e3-6', from: 'n3', to: 'n6', weight: 'left' },
      { id: 'e3-7', from: 'n3', to: 'n7', weight: 'right' },
    ],
  }, { title });
}

function* layoutTransform() {
  yield {
    state: labelMatrix(
      'Same sorted keys, different memory order',
      [
        { id: 'sorted', label: 'sorted array' },
        { id: 'eytz', label: 'Eytzinger array' },
        { id: 'meaning', label: 'tree meaning' },
      ],
      [
        { id: 'i0', label: '0' },
        { id: 'i1', label: '1' },
        { id: 'i2', label: '2' },
        { id: 'i3', label: '3' },
        { id: 'i4', label: '4' },
        { id: 'i5', label: '5' },
        { id: 'i6', label: '6' },
      ],
      [
        ['2', '4', '6', '8', '10', '12', '14'],
        ['8', '4', '12', '2', '6', '10', '14'],
        ['root', 'left', 'right', 'LL', 'LR', 'RL', 'RR'],
      ],
    ),
    highlight: { active: ['sorted:i3', 'eytz:i0'], found: ['meaning:i0'] },
    explanation: `Eytzinger layout stores the ${7} sorted keys as an implicit complete binary-search tree in breadth-first order. The median becomes the root at index 1, then child subtrees follow like a heap.`,
  };

  yield {
    state: tree('Heap-like child indices give a branch path'),
    highlight: { active: ['n1', 'n2', 'n3'], found: ['e1-2', 'e1-3'] },
    explanation: `Search starts at index 1 in the one-based view of ${7} nodes connected by ${6} edges. At node i, go left to 2i or right to 2i+1. That regular index arithmetic is why the layout is friendly to prefetching.`,
    invariant: `The sorted order across all ${7} keys is in the tree relation, not in adjacent memory cells.`,
  };

  yield {
    state: labelMatrix(
      'Why it can beat ordinary binary search',
      [
        { id: 'branch', label: 'branch prediction' },
        { id: 'cache', label: 'cache misses' },
        { id: 'prefetch', label: 'prefetch' },
        { id: 'small', label: 'small arrays' },
      ],
      [
        { id: 'ordinary', label: 'ordinary sorted array' },
        { id: 'eytzinger', label: 'Eytzinger layout' },
      ],
      [
        ['hard-to-predict mid jumps', 'regular child path'],
        ['jumps across array', 'BFS packs upper levels'],
        ['less obvious', 'children addresses predictable'],
        ['often already cached', 'layout overhead may not matter'],
      ],
    ),
    highlight: { found: ['cache:eytzinger', 'prefetch:eytzinger'], compare: ['small:ordinary'] },
    explanation: `The asymptotic complexity is still O(log n) — about ${Math.ceil(Math.log2(7))} comparisons for ${7} keys. The improvement is mechanical sympathy: fewer painful cache stalls and more predictable memory access for repeated searches.`,
  };

  yield {
    state: labelMatrix(
      'Build by inorder fill',
      [
        { id: 'left', label: 'fill left subtree' },
        { id: 'root', label: 'write root' },
        { id: 'right', label: 'fill right subtree' },
        { id: 'array', label: 'array position' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['recurse to 2i', 'smaller keys'],
        ['write next sorted key at i', 'inorder property'],
        ['recurse to 2i+1', 'larger keys'],
        ['BFS index receives inorder value', 'search tree in array'],
      ],
    ),
    highlight: { active: ['left:rule', 'root:rule', 'right:rule'], found: ['array:effect'] },
    explanation: `To build the layout, walk the implicit tree in inorder through ${4} recursive steps while consuming the ${7} sorted keys. The result preserves binary-search order through parent/child relationships.`,
  };
}

function* searchPath() {
  yield {
    state: tree('Search lower_bound(11)'),
    highlight: { active: ['n1', 'n3', 'n6'], compare: ['e1-3', 'e3-6'] },
    explanation: `For lower_bound(11) across ${7} keys, compare 11 with 8 at index 1 and go right. Compare with 12 at index 3 and record it as a candidate, then go left to 10 at index 6. Since 10 is too small, the candidate 12 wins.`,
  };

  yield {
    state: labelMatrix(
      'Search trace',
      [
        { id: 'step1', label: 'index 1 value 8' },
        { id: 'step2', label: 'index 3 value 12' },
        { id: 'step3', label: 'index 6 value 10' },
        { id: 'answer', label: 'answer' },
      ],
      [
        { id: 'comparison', label: 'comparison' },
        { id: 'move', label: 'move' },
        { id: 'candidate', label: 'candidate' },
      ],
      [
        ['11 > 8', 'right to 3', 'none'],
        ['11 <= 12', 'left to 6', '12'],
        ['11 > 10', 'right past leaf', '12'],
        ['smallest >= 11', 'stop', '12'],
      ],
    ),
    highlight: { active: ['step1:move', 'step2:candidate', 'step3:move'], found: ['answer:candidate'] },
    explanation: `The ${3} logical comparisons are ordinary binary search across ${4} trace rows. The difference is the memory path: indices 1, 3, 6 are heap-style positions rather than midpoints in a sorted array.`,
  };

  yield {
    state: labelMatrix(
      'Layout choices for repeated lookup',
      [
        { id: 'sorted', label: 'sorted order' },
        { id: 'eytz', label: 'Eytzinger' },
        { id: 'btree', label: 'implicit B-tree' },
        { id: 'veb', label: 'van Emde Boas' },
      ],
      [
        { id: 'strength', label: 'strength' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['simple and compact', 'branch/cache stalls on large arrays'],
        ['fast in RAM with prefetch', 'rebuild layout for sorted data'],
        ['cache-line block search', 'more complex'],
        ['cache-oblivious recursion', 'complex layout'],
      ],
    ),
    highlight: { found: ['eytz:strength'], compare: ['btree:tradeoff', 'veb:tradeoff'] },
    explanation: `Eytzinger is one member of a ${4}-layout family compared in the matrix. The surprising lesson from the paper is that a simple heap-order layout can be very competitive on modern hardware.`,
  };

  yield {
    state: tree('Final frame: tree order, array storage'),
    highlight: { found: ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7'] },
    explanation: `The final mental model: all ${7} nodes preserve the binary-search-tree relation, but store it in array order that the processor can walk predictably through ${6} parent-child edges.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'layout transform') yield* layoutTransform();
  else if (view === 'search path') yield* searchPath();
  else throw new InputError('Pick an Eytzinger layout view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. "Layout transform" shows a sorted array being rearranged into Eytzinger (BFS) order and the implicit binary search tree that ordering encodes. "Search path" traces a lower_bound query through that tree, one comparison per frame.',
        {
          type: 'callout',
          text: 'Eytzinger layout preserves binary-search correctness while changing the physical address sequence into predictable heap-style child jumps.',
        },
        'Active highlights mark the node being compared right now. Found highlights mark the current lower_bound candidate -- the smallest key seen so far that is >= the query. Compare highlights show alternatives being ruled out.',
        'Watch the array indices, not just the values. The sequence of indices visited during search -- 1, then 2 or 3, then 4-7 -- follows a predictable pattern the CPU can prefetch ahead of time. If you only watch the values, you see ordinary binary search. If you watch the addresses, you see why the layout matters.',
        {type: 'image', src: './assets/gifs/eytzinger-layout-binary-search.gif', alt: 'Animated walkthrough of the eytzinger layout binary search visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Binary search over a sorted array is textbook-optimal in the comparison model. With one million keys it needs about 20 comparisons. On paper, that is the end of the story.',
        'On real hardware, comparisons are not free. Each one loads a cache line -- a 64-byte block of memory fetched from DRAM into the CPU\'s fast local storage. Sorted-array binary search jumps from the midpoint to the midpoint of a half, then to the midpoint of a quarter. Those addresses are scattered across memory. The CPU branch predictor (hardware that guesses which way an if/else will go so it can start executing ahead) cannot anticipate the direction because it depends on the query value. The result: 20 comparisons that each stall on a cache miss, plus branch mispredictions that flush the pipeline.',
        'Eytzinger layout attacks both problems. It stores the same keys in breadth-first tree order so the early levels sit in adjacent cache lines and the child address at each step is a simple arithmetic function of the parent index. The algorithm still does O(log n) comparisons, but the hardware experiences them with fewer stalls and more predictable memory traffic.',
        'Khuong and Morin (2017) benchmarked this layout against std::lower_bound and measured 2-3x speedups on large arrays. The algorithm is identical. The speedup comes entirely from memory layout.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural first attempt is a sorted array searched with std::lower_bound or its equivalent. It is compact (no pointers, no wasted space), trivial to build (just sort), and correct by construction. Every systems programmer reaches for it because it works and is hard to beat in the comparison model.',
        'For small arrays -- a few thousand keys -- this is genuinely optimal. The entire search path fits in L1 or L2 cache, branch mispredictions cost a few cycles each, and the simplicity of the code matters more than the constant factor.',
        'The approach stops scaling once the array outgrows cache. With 10 million 64-bit keys the array is 80 MB. A 20-level binary search touches 20 cache lines spread across that 80 MB. Each level is a cache miss (50-100 ns on modern DRAM), and the branch predictor has roughly 50% accuracy on each comparison direction. Twenty cache misses plus twenty branch flushes dominate the 20 comparisons by orders of magnitude.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the memory hierarchy. Sorted-array binary search has two properties that fight modern CPUs. First, the addresses it visits are data-dependent: you cannot know the next address until the current comparison finishes, which serializes the memory latency. Second, the branch direction is unpredictable: the CPU pipeline flushes on roughly half the comparisons.',
        'Hardware prefetchers cannot help because they track sequential or strided patterns. Binary search over a sorted array jumps by n/2, then n/4, then n/8 -- a different stride at every level. The prefetcher sees chaos.',
        'The cost model that matters is not comparisons. It is cache misses times memory latency, plus branch mispredictions times pipeline depth. On a machine with 64-byte cache lines, 100 ns DRAM latency, and a 15-stage pipeline, the memory and branch costs dwarf the comparison cost for any array larger than a few cache levels.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Binary search visits keys in an order determined by the comparison tree: root first, then one child, then one grandchild. That traversal order is a breadth-first numbering of a complete binary tree. If you store the keys in that BFS order instead of sorted order, then the child of the key at index i is always at index 2i (left) or 2i+1 (right) -- the same arithmetic a binary heap uses.',
        'This single rearrangement unlocks three things at once. The top levels of the tree pack into the first few cache lines, so they are almost always hot in L1. The next address to visit is a deterministic function of the current index, so the CPU can prefetch both children before the comparison finishes. And the branch itself can be replaced with a conditional move (cmov) instruction, eliminating misprediction entirely.',
        'The rearrangement does not change the comparisons. It changes the physical addresses those comparisons touch. That is the insight: on real hardware, the cost of a search is dominated by where data lives in memory, not by how many comparisons you do.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Eytzinger layout stores sorted keys in the array positions determined by a breadth-first traversal of an implicit complete binary search tree. Index 1 (one-based) holds the root -- the median. Index 2 holds the root of the left subtree. Index 3 holds the root of the right subtree. Level by level, the tree fills the array.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Binary_tree_in_array.svg/500px-Binary_tree_in_array.svg.png',
          alt: 'Complete binary tree relationships represented by positions in an array',
          caption: 'Implicit tree layouts store parent and child links as array positions, the same address arithmetic Eytzinger search exploits. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Binary_tree_in_array.svg',
        },
        {
          type: 'diagram',
          label: 'BFS numbering maps tree nodes to array positions',
          text: [
            '            [1] 8              Array index: value',
            '           /     \\              1: 8  (root/median)',
            '        [2] 4   [3] 12          2: 4   3: 12',
            '        / \\      / \\            4: 2   5: 6   6: 10  7: 14',
            '     [4]2 [5]6 [6]10 [7]14',
            '',
            '  Sorted:    [ 2,  4,  6,  8, 10, 12, 14 ]',
            '  Eytzinger: [ 8,  4, 12,  2,  6, 10, 14 ]  (1-based)',
          ].join('\n'),
        },
        'Building the layout takes O(n) time. Walk the implicit tree in inorder (left child, current node, right child) while consuming the sorted input one element at a time. The left child of index i is 2i; the right child is 2i+1. Each sorted element is written to the BFS position corresponding to its inorder rank.',
        'Search is a tight loop. Start at index 1. Compare the query against the key at the current index. If query <= key, record the index as a lower_bound candidate and move to the left child (2i). If query > key, move to the right child (2i+1). Stop when the index exceeds the array length. The last recorded candidate is the answer.',
        {
          type: 'code',
          language: 'c',
          text: [
            '// Branchless Eytzinger search (1-based, n keys)',
            '// Returns index of lower_bound, or 0 if query > all keys',
            'size_t eytzinger_search(const int *a, size_t n, int q) {',
            '    size_t i = 1;',
            '    size_t candidate = 0;',
            '    while (i <= n) {',
            '        __builtin_prefetch(&a[2 * i]);      // prefetch children',
            '        __builtin_prefetch(&a[2 * i + 1]);',
            '        // branchless: cmov instead of branch',
            '        candidate = (a[i] >= q) ? i : candidate;',
            '        i = 2 * i + (a[i] < q);  // left=2i, right=2i+1',
            '    }',
            '    return candidate;',
            '}',
          ].join('\n'),
        },
        'The key trick in the branchless version: the next index is always 2i or 2i+1. The expression 2*i + (a[i] < q) computes the correct child using a conditional move instead of a branch. The CPU never mispredicts because there is no branch to predict. Combined with explicit prefetching of both children, the loop overlaps memory latency with computation.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness is identical to binary search. The inorder traversal that builds the layout preserves the BST invariant: every key in the left subtree of node i is smaller than a[i], and every key in the right subtree is larger. A comparison at node i discards exactly the subtree whose keys cannot contain the answer. The candidate rule tracks the smallest key >= query seen so far, which is the definition of lower_bound.',
        'The performance improvement comes from three mechanisms. First, cache line utilization: the top levels of the tree (which every search visits) are packed into the first few cache lines of the array. With 64-byte lines and 8-byte keys, the first 7 nodes fit in a single cache line, the next 8 in one more. The root and its children are almost always hot in L1.',
        'Second, prefetching: because the child of index i is always at 2i or 2i+1, both addresses are known before the comparison finishes. The code issues prefetch instructions for both children while the current comparison is in flight. This converts serial memory latency into parallel prefetch latency, hiding one cache miss behind another.',
        'Third, branchless comparison: the conditional move (cmov) instruction replaces the if/else branch. The CPU executes both paths speculatively and selects the result. There is no branch to mispredict, so the pipeline never flushes. Combined, these three mechanisms eliminate the two dominant costs of sorted-array binary search: unpredictable cache misses and unpredictable branches.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Layout', 'Build', 'Search', 'Cache misses (n >> cache)', 'Branch misses', 'Space overhead'],
          rows: [
            ['Sorted array', 'O(n log n) sort', 'O(log n)', '~log n (random jumps)', '~log n / 2', 'None'],
            ['Eytzinger', 'O(n) after sort', 'O(log n)', '~log n - log B (top levels cached)', '0 (branchless)', '1 sentinel slot'],
            ['Implicit B-tree', 'O(n) after sort', 'O(log n)', '~log_B n (block search)', 'Varies', 'Block padding'],
            ['van Emde Boas layout', 'O(n) after sort', 'O(log n)', '~log_B n (cache-oblivious)', 'Varies', 'Complex addressing'],
          ],
        },
        'All four layouts perform O(log n) comparisons. The difference is constant factors driven by hardware. Eytzinger reduces cache misses by keeping upper tree levels packed and prefetching lower levels. It eliminates branch misses entirely via branchless comparison. The sorted array pays full price for both.',
        'Khuong and Morin benchmarked on arrays of 10 million 32-bit integers. Eytzinger search with prefetching ran 2-3x faster than std::lower_bound. The implicit B-tree layout (which packs B keys per cache line) was competitive but required more complex addressing. The van Emde Boas layout was theoretically optimal but the recursive addressing overhead reduced its practical advantage.',
        {
          type: 'note',
          text: 'The 2-3x speedup is measured for uniform random queries on large arrays. For small arrays (< 1000 keys) or skewed access patterns where the hot keys fit in cache, sorted-array binary search can match or beat Eytzinger because the layout conversion cost is wasted.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Eytzinger layout wins decisively in read-heavy, write-rare scenarios on large static datasets. The canonical use case is an in-memory sorted index that is built once and queried millions of times: analytics column indexes, IP routing tables, dictionary lookups in compression codecs, and static membership tests in database query engines.',
        'The pattern that makes it shine: uniform or near-uniform random queries over an array too large for L2 cache. Under those conditions, every level of sorted-array binary search is a cache miss, and the branch predictor is at chance. Eytzinger layout turns the upper ~4 levels into guaranteed cache hits and the remaining levels into prefetched cache misses with no branch penalties.',
        'It is also a clean example of mechanical sympathy in algorithm design. The abstract algorithm (binary search) does not change. The physical layout changes how the hardware experiences that algorithm. This makes it a valuable reference for understanding why constant factors matter and why asymptotic analysis is necessary but not sufficient.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Small arrays gain nothing. If the entire search path fits in L1 cache (roughly < 4000 64-bit keys), sorted-array binary search is already fast and the layout conversion is pure overhead. The sorted array is also simpler to debug, serialize, merge, and pass to code that expects sorted order.',
        'Dynamic data is painful. Inserting or deleting a single key requires rebuilding the entire Eytzinger array -- an O(n) operation. For workloads with frequent updates, a B-tree or sorted array with binary insertion is more practical despite worse search constants.',
        'The branchless variant depends on compiler and architecture cooperation. The cmov instruction must be emitted instead of a branch; some compilers on some optimization levels will re-introduce the branch. Prefetch instructions vary across architectures. Code that looks branchless in C may not be branchless in the generated assembly, erasing the theoretical advantage.',
        'Non-uniform access patterns can also reduce the benefit. If queries cluster on a small subset of keys, the hot nodes are cached regardless of layout. Eytzinger layout helps most when queries are uniformly spread and the array is large enough that no single access pattern keeps the path warm.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with the sorted array [2, 4, 6, 8, 10, 12, 14] -- seven keys. Build the Eytzinger layout by inorder-filling a 1-based array of size 7. The recursive procedure visits the implicit tree: go left to 2i, write the next sorted key at i, go right to 2i+1.',
        'Build trace: visit index 4 (leftmost leaf), write 2. Visit index 2, write 4. Visit index 5, write 6. Visit index 1 (root), write 8. Visit index 6, write 10. Visit index 3, write 12. Visit index 7, write 14. The resulting Eytzinger array is [_, 8, 4, 12, 2, 6, 10, 14] where index 0 is unused (1-based addressing).',
        'Now search for lower_bound(5). Step 1: i=1, a[1]=8. Since 5 <= 8, record candidate=1, go left to i=2*1=2. Step 2: i=2, a[2]=4. Since 5 > 4, keep candidate=1, go right to i=2*2+1=5. Step 3: i=5, a[5]=6. Since 5 <= 6, update candidate=5, go left to i=2*5=10. Step 4: i=10 > 7 (array length), stop. The candidate is index 5, which holds the value 6. Verify: 6 is the smallest key >= 5 in the original sorted array. Correct.',
        'Now search for lower_bound(11). Step 1: i=1, a[1]=8. Since 11 > 8, keep candidate=0, go right to i=2*1+1=3. Step 2: i=3, a[3]=12. Since 11 <= 12, record candidate=3, go left to i=2*3=6. Step 3: i=6, a[6]=10. Since 11 > 10, keep candidate=3, go right to i=2*6+1=13. Step 4: i=13 > 7, stop. The candidate is index 3, which holds 12 -- the smallest key >= 11. Correct.',
        'Both searches took exactly 3 comparisons -- ceil(log2(7)) -- the same count as sorted-array binary search. The difference is the indices visited: 1, 2, 5 and 1, 3, 6 are heap-order positions, not midpoints. On a large array, those positions fall into predictable cache lines that the prefetcher can load in advance.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'quote',
          text: 'For random searches in large arrays, the Eytzinger layout with branch-free comparisons and prefetching is the fastest method we tested.',
          attribution: 'Khuong and Morin, "Array Layouts for Comparison-Based Searching," JEA 2017',
        },
        {
          type: 'bullets',
          items: [
            'Primary source: Paul-Virak Khuong and Pat Morin, "Array Layouts for Comparison-Based Searching," Journal of Experimental Algorithmics 22(1), 2017. arXiv: https://arxiv.org/abs/1509.05053',
            'ACM published version: https://dl.acm.org/doi/10.1145/3053370',
            'Eytzinger\'s original use: Michaela Eytzinger, "Thesaurus principum hac aetate in Europa viventium" (1590) -- a genealogy book that numbered royal lineages in BFS order, the same indexing scheme used here.',
          ],
        },
        'Study Binary Search first to understand the comparison tree that Eytzinger layout rearranges. Study Binary Heap to see the same 2i/2i+1 indexing used for a different invariant (heap order vs. BST order). Study B-Trees for the cache-line-sized block approach that competes with Eytzinger on large datasets. Study cache-oblivious algorithms for the van Emde Boas layout, which achieves optimal cache behavior without knowing the cache line size.',
        'For implementation practice, study branchless programming and the cmov instruction. The branchless trick is not specific to Eytzinger -- it applies to any binary search variant and is one of the most impactful low-level optimizations for search-heavy code.',
      ],
    },
  ],
};
