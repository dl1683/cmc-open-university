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
    { heading: 'How to read the animation', paragraphs: [
      'Each frame adds a search method to the same chart. The x-axis is input size n, and the y-axis is comparisons or probes, so curve separation is actual work saved.',
      {type: 'callout', text: 'Search speed is purchased with structure: sorted order buys halving, balance buys dynamic order, and hashing buys direct addressing.'},
      {type: 'image', src: './assets/gifs/search-comparison.gif', alt: 'Animated walkthrough of the search comparison visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
    ]},
    { heading: 'Why this exists', paragraphs: [
      'Search is behind dictionaries, caches, database indexes, routers, symbol tables, autocomplete, and configuration lookup. The structure chosen before the query determines whether lookup scans, halves, branches, or addresses directly.',
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/6a/Binary_Search_Example.png', alt: 'Binary search example narrowing a sorted array by moving low, mid, and high pointers', caption: 'Binary search turns sorted order into proof that half the remaining array can be discarded. Source: Wikimedia Commons, Kurt Kaiser, CC0 1.0.'},
    ]},
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is linear search: check one item, then the next, until the key is found or the collection ends. It needs no sorting, no hash function, no tree, and no extra memory.',
    ]},
    { heading: 'The wall', paragraphs: [
      'Linear search cannot rule out unseen elements. At 1,000,000 items, worst-case lookup means 1,000,000 comparisons, and doubling n doubles the worst-case work.',
    ]},
    { heading: 'The core insight', paragraphs: [
      'Search improves when stored structure lets one operation discard many candidates. Sorted order buys halving, tree balance buys dynamic ordered branching, and hashing turns a key into a predicted address.',
    ]},
    { heading: 'How it works', paragraphs: [
      'Binary search compares the target with the middle of a sorted array and discards the impossible half. A balanced search tree branches left or right by key order, while a hash table computes a bucket and resolves collisions.',
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/da/Binary_search_tree.svg', alt: 'Binary search tree with each left child smaller and each right child larger', caption: 'A search tree preserves sorted branching while allowing inserts and deletes without rebuilding a flat array. Source: Wikimedia Commons, Derrick Coetzee and Booyabazooka, public domain.'},
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Hash_table_5_0_1_1_1_1_1_LL.svg/3840px-Hash_table_5_0_1_1_1_1_1_LL.svg.png', alt: 'Hash table with keys mapped into buckets and linked-list collision chains', caption: 'Hashing buys average constant lookup by turning a key into a bucket address, with collision handling as the tax. Source: Wikimedia Commons, Jorge Stolfi, CC BY-SA 3.0.'},
    ]},
    { heading: 'Why it works', paragraphs: [
      'Binary search is correct because sorted order makes a whole half impossible after one comparison. A balanced tree is correct because each node partitions keys into smaller and larger subranges, and a hash table is correct because insertion and lookup follow the same hash and collision rule.',
    ]},
    { heading: 'Cost and complexity', paragraphs: [
      'Linear search is O(n): doubling n doubles worst-case checks. Binary search and balanced trees are O(log n): doubling n adds about one comparison level, while hash tables are O(1) average under a good hash function and controlled load factor.',
    ]},
    { heading: 'Real-world uses', paragraphs: [
      'Linear search fits tiny or one-time collections. Binary search fits static sorted arrays, balanced trees fit dynamic ordered maps and range queries, and hash tables fit caches, dictionaries, symbol tables, and exact key lookup.',
    ]},
    { heading: 'Where it fails', paragraphs: [
      'Binary search fails without sorted random-access data. Trees fail without balance or when pointer chasing dominates, and hash tables fail when order matters, memory is tight, or adversarial keys cause collisions.',
    ]},
    { heading: 'Worked example', paragraphs: [
      'Search for 42 in 16 sorted values: [1, 3, 5, 8, 12, 17, 23, 29, 31, 35, 38, 42, 45, 50, 61, 78]. Linear search finds it after 12 comparisons.',
      'Binary search checks index 7 with value 29, then index 11 with value 42, so it stops after 2 comparisons. A hash table at load factor 0.75 stores 16 keys in about 22 slots and often finds the key in 1 or 2 probes.',
    ]},
    { heading: 'Sources and study next', paragraphs: [
      'Study Knuth Volume 3 and CLRS chapters on hashing and search trees. Then read Linear Search, Binary Search, Hash Table, Binary Search Tree, AVL Tree, Red-Black Tree, and Big-O Growth Rates.',
    ]},
  ],
};