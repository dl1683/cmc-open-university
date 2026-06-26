// Fenwick tree (binary indexed tree): prefix sums and point updates in O(log n)
// using one array and the lowbit responsibility of each 1-based index.

import { arrayState, parseNumberList, parseNumber, InputError } from '../core/state.js';

export const topic = {
  id: 'fenwick-tree',
  title: 'Fenwick Tree (Binary Indexed Tree)',
  category: 'Data Structures',
  summary: 'One array and one bit trick, lowbit(i), make prefix sums and point updates both run in O(log n).',
  controls: [
    { id: 'values', label: 'Values', type: 'number-list', defaultValue: '3, 2, -1, 6, 5, 4, -3, 3' },
    { id: 'prefixUpTo', label: 'Prefix sum of first...', type: 'number', defaultValue: '6' },
    { id: 'addAmount', label: 'Then add', type: 'number', defaultValue: '2' },
    { id: 'addAt', label: '...at position', type: 'number', defaultValue: '3' },
  ],
  run,
};

const lowbit = (i) => i & -i;
const bin = (i) => i.toString(2);

function buildTree(values) {
  const n = values.length;
  const tree = new Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    tree[i] += values[i - 1];
    const parent = i + lowbit(i);
    if (parent <= n) tree[parent] += tree[i];
  }
  return tree;
}

const coverage = (i) => `${i - lowbit(i) + 1}..${i}`;

export function* run(input) {
  const values = parseNumberList(input.values, { max: 16 });
  const n = values.length;
  const k = parseNumber(input.prefixUpTo, { label: 'a prefix length' });
  const delta = parseNumber(input.addAmount, { label: 'an amount to add' });
  const at = parseNumber(input.addAt, { label: 'a position' });
  if (!Number.isInteger(k) || k < 1 || k > n) throw new InputError(`Prefix length must be a whole number between 1 and ${n}.`);
  if (!Number.isInteger(at) || at < 1 || at > n) throw new InputError(`The update position must be a whole number between 1 and ${n}.`);

  const tree = buildTree(values);
  const treeCells = () => tree.slice(1);

  yield {
    state: arrayState(values),
    highlight: {},
    explanation: `The workload is interleaved: ask for the sum of the first k values, then edit one value, then ask again. A raw array updates in O(1) but sums in O(n). A prefix array sums in O(1) but updates in O(n). A Fenwick tree stores partial prefix ranges so both operations take O(log n).`,
  };

  yield {
    state: arrayState(treeCells()),
    highlight: { active: ['i3', 'i5', 'i6'] },
    explanation: `The tree is still one array, shown with 1-based positions. Slot i stores the sum of lowbit(i) values ending at i. Slot 4 covers ${coverage(4)} because lowbit(4) is 4. Slot 6 covers ${coverage(6)} because lowbit(6) is 2. The binary index decides the range responsibility.`,
    invariant: 'tree[i] stores the sum of values i - lowbit(i) + 1 through i.',
  };

  const visits = [];
  for (let i = k; i > 0; i -= lowbit(i)) visits.push(i);
  let running = 0;
  for (let v = 0; v < visits.length; v++) {
    const i = visits[v];
    running += tree[i];
    yield {
      state: arrayState(treeCells()),
      highlight: { active: [`i${i - 1}`], visited: visits.slice(0, v).map((x) => `i${x - 1}`) },
      explanation: `Prefix(${k}) visits slot ${i} (binary ${bin(i)}), adds its covered range ${coverage(i)}, and strips the lowest set bit to move left. Running total: ${running}. ${i - lowbit(i) > 0 ? `Next index is ${i - lowbit(i)}.` : `Index reaches 0, so the visited ranges tile 1..${k}.`}`,
      invariant: 'Query walk: i = i - lowbit(i). The visited ranges cover the prefix exactly once.',
    };
  }
  const before = running;

  const touches = [];
  for (let i = at; i <= n; i += lowbit(i)) touches.push(i);
  for (let t = 0; t < touches.length; t++) {
    const i = touches[t];
    tree[i] += delta;
    yield {
      state: arrayState(treeCells()),
      highlight: { found: [`i${i - 1}`], visited: touches.slice(0, t).map((x) => `i${x - 1}`) },
      explanation: `Update position ${at} by ${delta}. Slot ${i} covers ${coverage(i)}, so it must include the delta and becomes ${tree[i]}. The update walk adds lowbit(i), visiting exactly the summary slots whose ranges contain position ${at}.`,
      invariant: 'Update walk: i = i + lowbit(i). Every touched range contains the updated position.',
    };
  }

  let after = 0;
  for (let i = k; i > 0; i -= lowbit(i)) after += tree[i];
  yield {
    state: arrayState(treeCells()),
    highlight: { found: visits.map((x) => `i${x - 1}`) },
    explanation: `Run the same prefix query again. It returns ${after}${at <= k ? `, which is ${before} plus ${delta} because position ${at} lies inside the prefix.` : `, unchanged from ${before} because position ${at} lies outside the prefix.`} Queries move left by stripping a bit; updates move right by adding a bit.`,
    invariant: 'prefix(k) after update(i, delta) = old prefix(k) + delta if i <= k, otherwise unchanged.',
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation displays a flat array indexed from 1. Each cell tree[i] holds a partial sum that covers a specific number of consecutive original values ending at position i. The first frame shows your raw input; the second shows the Fenwick array, where each cell\'s value reflects the sum of the range it owns.',
        {type: `callout`, text: `A Fenwick tree is not a pointer tree; it is a responsibility map encoded by the lowest set bit of each index.`},
        'Highlighted cells mark the index the current operation is visiting. During a prefix-sum query, the walk moves left through the array, accumulating partial sums. During a point update, the walk moves right, patching every cell whose range includes the changed position. Visited cells show ranges already processed; found cells show update targets whose stored values changed.',
        'Track one invariant throughout: the visited cells always cover disjoint ranges whose union is exactly the prefix being queried or the full set of owners being updated. No two ranges overlap, so no value is counted twice. The bit arithmetic guarantees this partition.',
        {type: 'image', src: './assets/gifs/fenwick-tree.gif', alt: 'Animated walkthrough of the fenwick tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many programs need to alternate between two operations on the same array: compute the sum of the first k elements, then change one element, then query again. A live analytics dashboard tallying events up to minute k, a text compressor tracking cumulative character frequencies, a spreadsheet recalculating running totals after every edit.',
        'Peter Fenwick published a structure in 1994 that performs both operations in O(log n) time using a single array of n + 1 integers and no pointers. Boris Ryabko independently discovered the same layout in 1992 for adaptive arithmetic coding. The structure is shorter to implement and more cache-friendly than a segment tree, but it only works for invertible aggregates like addition, XOR, and counting.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Store values in a plain array. Changing A[i] costs O(1), but computing prefix(k) = A[1] + A[2] + ... + A[k] requires scanning k entries. With a million elements and frequent queries, each prefix sum costs up to a million additions.',
        'The alternative is a precomputed prefix-sum array where prefix[k] = A[1] + ... + A[k]. Queries become O(1) lookups. But updating A[i] invalidates prefix[i], prefix[i+1], ..., prefix[n], so a single point change rewrites the entire suffix. One operation is always O(n).',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The prefix-sum array fails because its entries share too much history. prefix[5] and prefix[6] both include the sum through A[5]. Changing A[3] invalidates both, plus every later entry. Any structure storing complete running totals forces one point update to cascade through all downstream sums.',
        'What the structure needs is a set of partial summaries. Each summary must cover enough ground that a prefix query visits only a few of them, but not so much that a single edit propagates to every summary. Those partial ranges must also be disjoint for any given prefix, or the query double-counts.',
        'The raw array precomputes too little. The prefix-sum array precomputes too much. The solution lies in partial sums whose range lengths limit both query depth and update depth at the same time.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Define lowbit(i) = i & (-i). This expression isolates the lowest set bit of i. In two\'s complement arithmetic, negating i flips every bit and adds 1, so the bitwise AND retains only the rightmost 1-bit. For i = 6 (binary 110), lowbit = 2. For i = 12 (binary 1100), lowbit = 4. For any odd i, lowbit = 1.',
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/16-node_Fenwick_tree.svg/500px-16-node_Fenwick_tree.svg.png`, alt: `Fenwick tree diagram with implicit parent links and covered ranges`, caption: `The interrogation tree shows how prefix walks jump between disjoint covered ranges. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:16-node_Fenwick_tree.svg.`},
        'That single number assigns each index a responsibility range: tree[i] stores the sum of exactly lowbit(i) consecutive original values ending at position i. Index 6 owns positions 5 and 6. Index 12 owns positions 9 through 12. Odd indices own only themselves. The binary representation of the index encodes the range length directly, with no extra metadata.',
        'Subtracting lowbit (i -= lowbit(i)) jumps left to the end of the next uncovered range, producing the query walk. Adding lowbit (i += lowbit(i)) jumps right to the next larger summary that contains position i, producing the update walk. The two walks are mirror images of the same bit operation.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The array uses 1-based indexing. Slot tree[i] stores the sum of original values from position (i - lowbit(i) + 1) through position i. Slot 0 is unused.',
        'To query prefix(k), start at i = k and initialize a running total to 0. Add tree[i] to the total, then set i = i - lowbit(i). Repeat until i hits 0. Each step lands on the end of the next uncovered range to the left. The visited slots cover positions 1 through k exactly once.',
        'To update position i by delta, start at i and add delta to tree[i]. Then set i = i + lowbit(i) and repeat until i exceeds n. Each step moves right to the next summary slot whose range contains the original position. Only cells that own the updated position are modified.',
        'To build the tree in O(n), place each original value into its slot. Then iterate i from 1 to n: if i + lowbit(i) is within bounds, add tree[i] into tree[i + lowbit(i)]. Each slot propagates its accumulated sum to the next larger range exactly once.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The query is correct because subtracting lowbit removes exactly the range just counted, leaving i pointing at the end of the remaining uncovered prefix. The ranges visited never overlap, and their union is 1..k. Each set bit in the binary representation of k corresponds to one range in the decomposition, so the number of steps equals the number of 1-bits.',
        'The update is correct because adding lowbit moves from one owner of position i to the next larger owner. Every index whose coverage range includes position i lies on this chain. Indices whose ranges do not include i are never touched, so no unrelated sum changes.',
        'Both walks visit at most floor(log2(n)) + 1 indices, because each step flips at least one bit. If every slot begins with the correct owned-range sum, both operations preserve that invariant after every call.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Both prefix(k) and update(i, delta) run in O(log n) time. Each iteration flips at least one bit of the index, and an n-element array has at most floor(log2(n)) + 1 bits. Doubling the array size adds exactly one step per walk. For 1,000 elements, at most 10 steps. For 1,000,000 elements, at most 20 steps.',
        'Space is one contiguous array of n + 1 integers with no child pointers. A segment tree requires 2n to 4n nodes. The Fenwick tree\'s flat layout means sequential memory access and strong cache performance. Both the query loop and the update loop are three lines of code each.',
        'The O(n) build scans every index once and pushes into at most one parent, so construction is strictly linear. Total memory stays at (n + 1) integers regardless of the values stored.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Competitive programming relies on Fenwick trees because the code is short, fast, and nearly impossible to get wrong once the lowbit pattern is learned. Inversion counting, online rank queries, and frequency tables are the most common applications.',
        'Inversion counting works by processing elements right to left. For each A[i], query prefix(A[i] - 1) to count how many smaller elements already appear to its right, then call update(A[i], 1). The sum of all queries gives the total inversion count in O(n log n) time.',
        'Two-dimensional Fenwick trees support rectangle prefix sums on a grid. Each dimension adds a log factor, giving O(log^2 n) per operation, far faster than naive O(n^2) scanning. Coordinate compression maps sparse keys to dense integer positions, keeping memory proportional to the number of distinct keys rather than the key range.',
        'Other applications include adaptive arithmetic coding frequency tables, online histograms, BIT-accelerated merge sort, and order-statistic queries via binary lifting over cumulative frequencies.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Combining range updates with range queries requires two Fenwick trees maintained in parallel, one storing coefficients of a linear function over prefixes. The math is correct but harder to reason about than a segment tree with lazy propagation.',
        'Arbitrary range queries (not just prefixes) need the difference query(r) - query(l - 1). This works for sums and XOR because subtraction inverts addition. It fails for min, max, and GCD, where prefix differences do not recover the original range answer. Segment trees handle these non-invertible operations directly.',
        'For static arrays that never change, a plain prefix-sum array is simpler and answers every query in O(1). For sparse multidimensional data, memory scales with the grid dimensions, so a k-d tree or range tree may be more practical. Fenwick trees also do not support sorted iteration, range assignment, or interval scheduling.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with A = [3, 2, -1, 6, 5, 4, -3, 3, 7, 2], using 1-based indexing (n = 10). Build the Fenwick array: tree[1] = 3 (lowbit = 1, covers A[1]). tree[2] = 3 + 2 = 5 (lowbit = 2, covers A[1..2]). tree[3] = -1 (lowbit = 1, covers A[3]). tree[4] = 3 + 2 + (-1) + 6 = 10 (lowbit = 4, covers A[1..4]). tree[5] = 5 (lowbit = 1, covers A[5]). tree[6] = 5 + 4 = 9 (lowbit = 2, covers A[5..6]). tree[7] = -3 (lowbit = 1, covers A[7]). tree[8] = 3 + 2 + (-1) + 6 + 5 + 4 + (-3) + 3 = 19 (lowbit = 8, covers A[1..8]). tree[9] = 7 (lowbit = 1, covers A[9]). tree[10] = 7 + 2 = 9 (lowbit = 2, covers A[9..10]).',
        'Query prefix_sum(6). i = 6 (binary 110). tree[6] = 9, covers A[5..6]. Strip lowest bit: 6 - 2 = 4. tree[4] = 10, covers A[1..4]. Strip lowest bit: 4 - 4 = 0. Stop. Answer: 9 + 10 = 19. Check: 3 + 2 + (-1) + 6 + 5 + 4 = 19. Two slots visited, two disjoint ranges {5..6} and {1..4} that tile positions 1 through 6.',
        'Update index 3 by +5. i = 3 (binary 11). tree[3] += 5, now 4. Add lowest bit: 3 + 1 = 4. tree[4] += 5, now 15. Add lowest bit: 4 + 4 = 8. tree[8] += 5, now 24. Add lowest bit: 8 + 8 = 16, which exceeds n = 10. Stop. Three slots touched: indices 3, 4, 8, exactly the cells whose coverage ranges contain position 3.',
        'Re-query prefix_sum(6). tree[6] = 9 (unchanged, because range 5..6 does not contain position 3). tree[4] = 15 (updated, because range 1..4 contains position 3). Answer: 9 + 15 = 24 = 19 + 5. The +5 delta appeared in the prefix because position 3 lies inside 1..6.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Peter Fenwick, "A New Data Structure for Cumulative Frequency Tables," Software: Practice and Experience, 1994. Boris Ryabko, "A Fast On-Line Adaptive Code," IEEE Transactions on Information Theory, 1992 -- the same structure discovered independently for adaptive arithmetic coding.',
        'Prerequisites: prefix sums (the static O(1)-query structure that the Fenwick tree makes dynamic), binary representation of integers, and two\'s complement (which explains why i & (-i) isolates the lowest set bit).',
        'Study next: Segment Tree (supports min/max/GCD and lazy propagation at 2-4x the memory). Sparse Table (O(1) static range minimum, no update support). Prefix Sums (the static predecessor this structure generalizes). Merge Sort (inversion counting reduces to processing elements and querying prefix counts, a classic Fenwick application).',
      ],
    },
  ],
};
