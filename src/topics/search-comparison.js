// Search algorithm comparison: linear, binary, hash, BST — plotted head to
// head so the curves prove why data structure choice is the most important
// decision in computing.

import { plotState, parseIntegerInRange } from '../core/state.js';

export const topic = {
  id: 'search-comparison',
  title: 'Search Algorithm Comparison',
  category: 'Algorithms',
  summary: 'Linear search vs binary search vs hash lookup — watch the curves prove why data structure choice is the most important decision.',
  controls: [
    { id: 'maxN', label: 'Max n', type: 'select', options: ['32', '128', '512'], defaultValue: '128' },
  ],
  run,
};

const log2 = (n) => Math.ceil(Math.log2(n));
const LOAD_FACTOR = 0.75;
const AVG_PROBES = 1 / (1 - LOAD_FACTOR / 2); // ~1.14 with LF 0.75

// ----- time-complexity curves -----

const timeCurves = [
  {
    id: 'linear-worst',
    label: 'Linear (worst)',
    fn: (n) => n,
    blurb: 'Check every element. No way around it without structure.',
  },
  {
    id: 'linear-avg',
    label: 'Linear (avg)',
    fn: (n) => n / 2,
    blurb: 'On average you find it halfway through. Still O(n).',
  },
  {
    id: 'binary',
    label: 'Binary search',
    fn: (n) => Math.ceil(Math.log2(n)) || 1,
    blurb: `Sorted array + divide and conquer: log₂(1,000,000) ≈ 20. From a million checks to twenty.`,
  },
  {
    id: 'bst-balanced',
    label: 'BST (balanced)',
    fn: (n) => Math.ceil(Math.log2(n)) + 1,
    blurb: 'Same O(log n) as binary search, but works for dynamic data.',
  },
  {
    id: 'bst-degenerate',
    label: 'BST (degenerate)',
    fn: (n) => n,
    blurb: 'Without balancing, a BST degrades to a linked list — O(n) worst case. This is why AVL and red-black trees exist.',
  },
  {
    id: 'hash',
    label: 'Hash table',
    fn: () => AVG_PROBES,
    blurb: 'O(1) average. Nearly flat. The curve barely moves.',
  },
];

// ----- space-cost curves -----

const spaceCurves = [
  {
    id: 'space-linear',
    label: 'Linear search',
    fn: () => 0,        // no extra space — scans the input
    blurb: 'No extra memory. You walk the input as-is.',
  },
  {
    id: 'space-binary',
    label: 'Binary search',
    fn: (n) => n,        // must store a sorted copy of the data
    blurb: 'Requires a sorted array: O(n) space for the data.',
  },
  {
    id: 'space-bst',
    label: 'BST',
    fn: (n) => 3 * n,    // each node stores key + 2 pointers
    blurb: 'O(n) nodes, each carrying two pointers: roughly 3n words.',
  },
  {
    id: 'space-hash',
    label: 'Hash table',
    fn: (n) => Math.ceil(n / LOAD_FACTOR),
    blurb: `O(n) entries plus load-factor overhead: at LF 0.75, the backing array is ${Math.round(100 / LOAD_FACTOR)}% of n.`,
  },
];

// ----- generator -----

export function* run(input) {
  const maxN = parseIntegerInRange(input.maxN, { min: 32, max: 512, label: 'n' });
  const ns = Array.from({ length: maxN }, (_, i) => i + 1);
  const timeAxes = { x: { label: 'n (input size)' }, y: { label: 'comparisons (worst / avg)' } };

  // Helper: build series from the first `count` time curves.
  const timeSeries = (count) =>
    timeCurves.slice(0, count).map((c) => ({
      id: c.id,
      label: c.label,
      points: ns.map((n) => ({ x: n, y: c.fn(n) })),
    }));

  // Frame 1 — linear worst
  yield {
    state: plotState({ axes: timeAxes, series: timeSeries(1) }),
    highlight: { active: ['linear-worst'] },
    explanation: timeCurves[0].blurb,
    invariant: `At n = ${maxN}: linear worst = ${maxN} comparisons.`,
  };

  // Frame 2 — add linear average
  yield {
    state: plotState({ axes: timeAxes, series: timeSeries(2) }),
    highlight: { active: ['linear-avg'], visited: ['linear-worst'] },
    explanation: timeCurves[1].blurb,
    invariant: `At n = ${maxN}: linear avg = ${maxN / 2} comparisons.`,
  };

  // Frame 3 — add binary search
  yield {
    state: plotState({ axes: timeAxes, series: timeSeries(3) }),
    highlight: { active: ['binary'], visited: ['linear-worst', 'linear-avg'] },
    explanation: timeCurves[2].blurb,
    invariant: `At n = ${maxN}: binary search = ${log2(maxN)} comparisons vs linear worst = ${maxN}.`,
  };

  // Frame 4 — add balanced BST
  yield {
    state: plotState({ axes: timeAxes, series: timeSeries(4) }),
    highlight: { active: ['bst-balanced'], visited: ['linear-worst', 'linear-avg', 'binary'] },
    explanation: timeCurves[3].blurb,
    invariant: `At n = ${maxN}: balanced BST = ${log2(maxN) + 1} comparisons (one more than binary search for the root check).`,
  };

  // Frame 5 — add degenerate BST
  yield {
    state: plotState({ axes: timeAxes, series: timeSeries(5) }),
    highlight: { active: ['bst-degenerate'], visited: ['linear-worst', 'linear-avg', 'binary', 'bst-balanced'] },
    explanation: timeCurves[4].blurb,
    invariant: `Degenerate BST at n = ${maxN}: ${maxN} comparisons — identical to linear search.`,
  };

  // Frame 6 — add hash table
  yield {
    state: plotState({ axes: timeAxes, series: timeSeries(6) }),
    highlight: { active: ['hash'], visited: ['linear-worst', 'linear-avg', 'binary', 'bst-balanced', 'bst-degenerate'] },
    explanation: timeCurves[5].blurb,
    invariant: `Hash table: ~${AVG_PROBES.toFixed(2)} probes regardless of n. At n = ${maxN}, linear search does ${maxN}x more work.`,
  };

  // Frame 7 — all time curves together
  yield {
    state: plotState({ axes: timeAxes, series: timeSeries(6) }),
    highlight: {},
    explanation: `Structure buys speed. The gap between O(n) and O(log n) is the difference between ${maxN} operations and ${log2(maxN)}. The gap between O(log n) and O(1) matters at billion-element scale. Every line on this chart is the same task — find one key — solved with different structures.`,
    invariant: `At n = ${maxN}: linear = ${maxN}, binary = ${log2(maxN)}, hash ≈ ${AVG_PROBES.toFixed(1)}.`,
  };

  // Frame 8 — space cost plot
  const spaceAxes = { x: { label: 'n (elements stored)' }, y: { label: 'extra words of memory' } };
  const spaceSeries = spaceCurves.map((c) => ({
    id: c.id,
    label: c.label,
    points: ns.map((n) => ({ x: n, y: c.fn(n) })),
  }));

  yield {
    state: plotState({ axes: spaceAxes, series: spaceSeries }),
    highlight: { active: ['space-hash', 'space-bst'] },
    explanation: `Speed costs memory. Linear search uses zero extra space. Binary search needs a sorted array (O(n)). A BST stores two pointers per node (~3n words). A hash table over-allocates by 1/load-factor (~${Math.round(100 / LOAD_FACTOR)}% of n). The tradeoff: O(1) lookup costs O(n) space plus overhead. There is no free lunch — you trade memory for comparisons.`,
    invariant: `At n = ${maxN}: hash table backing array ≈ ${Math.ceil(maxN / LOAD_FACTOR)} slots for ${maxN} keys.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Each frame adds one search method to the chart. The x-axis is input size n. The y-axis is the number of comparisons (or probes) needed to find a key in the worst or average case. Watch the curves separate as n grows: the visual gap IS the performance gap.',
        'The final frame switches to a space-cost chart showing extra memory each method requires. Speed and space are two axes of the same tradeoff — the animation shows both so you can weigh them together.',
        'The invariant line beneath each frame gives exact numbers at the current max n. Use these to verify what the curves imply: at n = 128, linear search does 128 comparisons while binary search does 7.',
        {type: 'callout', text: 'Search speed is purchased with structure: sorted order buys halving, balance buys dynamic order, and hashing buys direct addressing.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Searching is the most common operation in computing. Every database query, dictionary lookup, autocomplete suggestion, and cache check is a search. The choice of search method determines whether the operation takes nanoseconds or seconds, and whether the system scales to a million users or collapses at a thousand.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/6a/Binary_Search_Example.png', alt: 'Binary search example narrowing a sorted array by moving low, mid, and high pointers', caption: 'Binary search turns sorted order into proof that half the remaining array can be discarded. Source: Wikimedia Commons, Kurt Kaiser, CC0 1.0.'},
        'This comparison exists because the methods are easy to learn in isolation but hard to compare without seeing them on the same axes. A student who knows binary search is "O(log n)" and hash lookup is "O(1)" may not feel what those curves mean until they see them drawn side by side at n = 512.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Scan left to right. Compare each element to the target. If you find it, stop. If you reach the end, it is not there. This is linear search: no preconditions, no setup, no extra memory. It works on any collection, sorted or not.',
        'For small collections — a dozen items, a short list — this is optimal. The overhead of building a fancier structure costs more than the scan saves. Linear search is the baseline every other method must justify itself against.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'O(n) means a billion items require a billion checks per lookup in the worst case. If the application performs a thousand lookups per second, that is a trillion comparisons per second — far beyond any single machine. Even average-case n/2 only halves the pain.',
        'The wall is not theoretical. A web server scanning a million-row table per request will choke under load. A search engine scanning every document for every query would take hours. The wall forces the question: can we do better? The answer is yes, but it costs structure.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Linear search: compare target to element 0, then 1, then 2, and so on. Worst case: n comparisons. Average (key present, uniformly distributed): n/2.',
        'Binary search: requires a sorted array. Compare target to the middle element. If equal, done. If less, recurse into the left half. If greater, the right half. Each step eliminates half the remaining elements. Worst case: ceil(log2(n)) comparisons.',
        'Balanced BST (AVL, red-black): each node stores a key and two child pointers. Search follows left or right at each level. A balanced tree has height O(log n), so search takes O(log n) comparisons. Supports dynamic inserts and deletes without re-sorting.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/da/Binary_search_tree.svg', alt: 'Binary search tree with each left child smaller and each right child larger', caption: 'A search tree preserves sorted branching while allowing inserts and deletes without rebuilding a flat array. Source: Wikimedia Commons, Derrick Coetzee and Booyabazooka, public domain.'},
        'Degenerate BST: if keys are inserted in sorted order without balancing, the tree becomes a linked list. Height = n, search = O(n). This is why self-balancing variants exist.',
        'Hash table: compute a hash of the key, index into a backing array. On average, with a good hash function and load factor under 1, this takes O(1) — roughly 1 to 2 probes regardless of n. Worst case (all keys collide) is O(n), but good hash functions make this vanishingly unlikely.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Binary search works because sorted order lets you eliminate half the candidates with one comparison. Each comparison carries one bit of information ("left or right"), and log2(n) bits are enough to identify any element among n. This is information-theoretically optimal for comparison-based search.',
        'Hashing works because it bypasses comparison entirely. Instead of asking "is the target here or there," it computes where the target should be and checks directly. The hash function converts the search problem into an addressing problem — O(1) because array indexing is O(1).',
        'BSTs work because they maintain a dynamic sorted structure. Unlike a sorted array, which requires O(n) shifts to insert, a balanced BST inserts in O(log n) by adjusting a few pointers. The price is pointer overhead and cache-unfriendly memory layout.',
      ],
    },
    {
      heading: 'Cost',
      paragraphs: [
        'Time comparison (worst case for n elements): Linear search: O(n) time, O(1) extra space. Binary search: O(log n) time, O(1) extra space (but requires O(n) sorted data). Balanced BST: O(log n) time, O(n) space (nodes + pointers). Hash table: O(1) average time, O(n) space (backing array + load factor overhead).',
        'Space overhead matters. A hash table with load factor 0.75 allocates a backing array 33% larger than the number of keys. A BST stores two pointers per node, roughly tripling the per-element memory compared to a flat array. Linear search and binary search on an existing array add zero extra space.',
        'Preprocessing cost: linear search needs none. Binary search needs O(n log n) to sort once. BST needs O(n log n) to insert all elements (balanced). Hash table needs O(n) to insert all elements. If the data changes frequently, the cost of maintaining the structure matters as much as the search cost.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Linear search wins for tiny collections (under ~20 elements), unsorted data you will only search once, and cases where simplicity and zero setup cost matter more than speed.',
        'Binary search wins for large static sorted data — a dictionary, a read-only lookup table, a sorted log file. It uses no extra space and has excellent cache locality because it accesses a contiguous array.',
        'Balanced BSTs win for dynamic data that changes between searches: insert, delete, and search are all O(log n). They also support range queries and ordered iteration, which hash tables cannot.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Hash_table_5_0_1_1_1_1_1_LL.svg/3840px-Hash_table_5_0_1_1_1_1_1_LL.svg.png', alt: 'Hash table with keys mapped into buckets and linked-list collision chains', caption: 'Hashing buys average constant lookup by turning a key into a bucket address, with collision handling as the tax. Source: Wikimedia Commons, Jorge Stolfi, CC BY-SA 3.0.'},
        'Hash tables win for key-value lookups on large, relatively stable datasets. O(1) average lookup is unbeatable when you need raw speed and can afford the memory overhead. Databases, caches, symbol tables, and routers all rely on hashing.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Linear search fails at scale. Beyond a few thousand elements, it becomes the bottleneck in any hot path.',
        'Binary search fails on unsorted data (sorting costs O(n log n) upfront), on data that changes frequently (re-sorting after every insert is expensive), and on linked structures (random access is required for the halving step).',
        'BSTs fail without balancing — degenerate input produces O(n) search. They also have poor cache locality compared to arrays because nodes are scattered in memory. In practice, B-trees (which pack many keys per node) outperform BSTs for on-disk data.',
        'Hash tables fail when you need ordered access (iteration order is arbitrary), when the hash function is poor (clustering degrades to O(n)), and when memory is tight (the load-factor overhead and pointer chasing are real costs). They also have O(n) worst case, which matters for latency-sensitive systems.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Search for key 42 in a sorted array of 16 elements [1, 3, 5, 8, 12, 17, 23, 29, 31, 35, 38, 42, 45, 50, 61, 78].',
        'Linear search: compare 42 to elements 0 through 11. Found at index 11 after 12 comparisons. Worst case for 16 elements: 16 comparisons.',
        'Binary search: compare 42 to index 7 (value 29) — go right. Compare to index 11 (value 42) — found. 2 comparisons. Worst case for 16 elements: ceil(log2(16)) = 4 comparisons.',
        'Hash table: compute hash(42), index into the backing array. If no collision, found in 1 probe. With load factor 0.75 on 16 keys, the backing array has ~22 slots and the expected probes are ~1.14.',
        'The ratios: linear took 12 comparisons, binary took 2, hash took ~1. At n = 1,000,000 the gap becomes linear = 1,000,000, binary = 20, hash = 1. That is the chart in one sentence.',
      ],
    },
    {
      heading: 'Sources and further reading',
      paragraphs: [
        'Knuth, D. (1998). The Art of Computer Programming, Volume 3: Sorting and Searching, 2nd edition — the definitive treatment of search algorithms, hashing, and tree search. Cormen, Leiserson, Rivest, and Stein (2009). Introduction to Algorithms, 3rd edition, chapters 11-13 — hash tables, BSTs, red-black trees.',
        'Related topics on this site: Linear Search for the step-by-step scan. Binary Search for the halving strategy in detail. Hash Table for open addressing and chaining. Binary Search Tree for dynamic ordered search. AVL Tree and Red-Black Tree for self-balancing. Big-O Growth Rates for the general complexity framework that underlies this comparison.',
      ],
    },
  ],
};
