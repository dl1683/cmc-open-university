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
        `The animation shows a single flat array indexed from 1. Each slot tree[i] stores a partial sum covering lowbit(i) consecutive values ending at position i, where lowbit(i) = i & (-i) is the lowest set bit. The first frame displays your raw input values; the second frame displays the built Fenwick array, whose entries differ because each slot has absorbed a range of original values.`,
        {type: `callout`, text: `A Fenwick tree is not a pointer tree; it is a responsibility map encoded by the lowest set bit of each index.`},
        `Active (highlighted) cells mark whichever index the current walk is reading or writing. During a prefix-sum query the walk moves left, stripping the lowest set bit at each step. During a point update the walk moves right, adding the lowest set bit. Visited cells are ranges already accumulated (query) or already patched (update). Found cells mark update targets whose stored values changed.`,
        `Watch for one invariant across every frame: the visited cells always cover disjoint, non-overlapping ranges that together tile the exact prefix or the exact set of owners. If two ranges ever overlapped, the answer would double-count. They never do, because the bit trick partitions the index space.`,
      
        {type: 'image', src: './assets/gifs/fenwick-tree.gif', alt: 'Animated walkthrough of the fenwick tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `Many problems interleave two operations on the same array: compute the sum of the first k elements, then change one element, then query again. Event counting up to minute k in a live stream, cumulative frequency through rank k in a changing distribution, running totals in a spreadsheet column that users keep editing.`,
        `Peter Fenwick published a structure in 1994 that handles both operations in O(log n) time using a single array of n + 1 integers. Boris Ryabko independently discovered the same layout in 1992 for adaptive arithmetic coding. The structure is simpler, shorter, and more cache-friendly than a segment tree, at the cost of supporting only invertible aggregates like sums, XOR, and counts.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `Store the values in a plain array. Updating A[i] is O(1), but computing prefix(k) = A[1] + A[2] + ... + A[k] requires scanning k elements. With a million entries and frequent prefix queries, every query costs up to a million additions.`,
        `Alternatively, precompute a prefix-sum array where prefix[i] = A[1] + ... + A[i]. Now prefix(k) is a single lookup, O(1). But changing A[i] invalidates prefix[i], prefix[i+1], ..., prefix[n], so one point update rewrites the entire suffix. Neither representation gives both fast queries and fast updates.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `The prefix-sum array fails because its entries share too much history. prefix[5] and prefix[6] share their first five terms. Changing A[3] invalidates both, plus every later prefix. Any structure that stores complete running totals forces one point update to cascade through all downstream sums.`,
        `The structure needs partial summaries that cover enough ground to answer any prefix query in few lookups, but not so much that one edit propagates to every summary. It also needs those partial ranges to be disjoint for any given prefix, or the query will double-count.`,
        `The raw array stores too little precomputed information. The prefix-sum array stores too much. The gap calls for partial sums whose range lengths are chosen to limit both query depth and update depth simultaneously.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The trick is lowbit(i) = i & (-i), which isolates the lowest set bit of i. In two's complement, -i flips every bit and adds 1, so the AND keeps only the rightmost 1-bit. For index 6 (binary 110), lowbit = 2. For index 12 (binary 1100), lowbit = 4. For any odd index, lowbit = 1.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/16-node_Fenwick_tree.svg/500px-16-node_Fenwick_tree.svg.png`, alt: `Fenwick tree diagram with implicit parent links and covered ranges`, caption: `The interrogation tree shows how prefix walks jump between disjoint covered ranges. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:16-node_Fenwick_tree.svg.`},
        `That single value assigns a responsibility range: tree[i] stores the sum of exactly lowbit(i) consecutive values ending at position i. Index 6 covers positions 5..6. Index 12 covers positions 9..12. Odd indices cover only themselves. The binary representation of each index encodes its range length with no extra storage.`,
        `Stripping the lowest bit (i -= lowbit(i)) moves left to the start of the next uncovered range: the query walk. Adding the lowest bit (i += lowbit(i)) moves right to the next larger summary that contains i: the update walk. The two walks are mirror images of the same bit operation.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `The array uses 1-based indexing. tree[i] stores the sum of values from position i - lowbit(i) + 1 through position i.`,
        `Query prefix(k): start at i = k, add tree[i] to a running total, then set i = i - lowbit(i). Repeat until i reaches 0. Each step jumps left to the end of the next uncovered range. The visited slots cover 1..k exactly once with disjoint ranges.`,
        `Update(i, delta): start at the target position, add delta to tree[i], then set i = i + lowbit(i). Repeat until i exceeds n. Each step jumps right to the next summary slot whose range contains the original position. Only slots that own the updated position are touched.`,
        `Build in O(n): place each value in its slot, then for each i from 1 to n, add tree[i] into tree[i + lowbit(i)] if that parent index exists. Each slot pushes its total into the next larger range exactly once.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The query is correct because subtracting lowbit removes exactly the range just counted. The next index is the end of the remaining uncovered prefix. No two visited ranges overlap, and their union is 1..k. This is a consequence of the binary representation: each set bit of k corresponds to one range in the decomposition.`,
        `The update is correct because the only stale summaries are ranges that contain position i. Adding lowbit jumps from one such owner to the next larger owner. Ranges that do not contain i are never visited, so no unrelated sum changes. The chain of owners is exactly the set of indices whose ranges include i.`,
        `Both walks visit at most floor(log2(n)) + 1 indices, because each step changes at least one bit. The structure is self-consistent: if every slot starts with the correct owned-range sum, both walks preserve that invariant.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Both prefix(k) and update(i, delta) run in O(log n) time. Each loop iteration flips at least one bit of the index, and an n-element array has at most floor(log2(n)) + 1 bits. Doubling n adds one step per walk. 1,000 elements: at most 10 steps. 1,000,000 elements: at most 20 steps.`,
        `Space is one array of n + 1 integers, roughly half what a segment tree uses. A segment tree needs 2n to 4n nodes with implicit or explicit child pointers. A Fenwick tree stores n + 1 integers in contiguous memory with no pointers, which makes it cache-friendly. The entire query and update logic is a three-line loop each.`,
        `The O(n) build visits every index once and pushes into at most one parent, so it is strictly linear. Total memory is (n + 1) integers regardless of the values stored.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Competitive programming uses Fenwick trees heavily because the code is short, fast, and hard to get wrong once the lowbit pattern is memorized. Inversion counting, online rank queries, and frequency tables are the most common applications.`,
        `In inversion counting, process elements right to left. For each A[i], query prefix(A[i] - 1) to count how many smaller elements already sit to its right, then update(A[i], 1). Total inversions equal the sum of all queries, in O(n log n).`,
        `Two-dimensional Fenwick trees handle rectangle prefix sums on a grid. Each dimension adds a log factor: O(log^2 n) per operation, still much faster than naive O(n^2). Coordinate compression maps sparse keys to dense integer positions, which is where the fit is strongest.`,
        `Other applications: arithmetic coding frequency tables, online histograms, BIT-based merge sort, and order-statistic search by binary-lifting the cumulative frequency structure.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Range update combined with range query requires maintaining two Fenwick trees in parallel (one for the coefficients of a linear function over prefixes). The bookkeeping is correct but less intuitive than a segment tree with lazy propagation.`,
        `Arbitrary range queries (not just prefixes) require computing query(r) - query(l - 1). This works for sums and XOR because subtraction inverts addition, but not for min, max, or GCD, where prefix differences do not recover the original range answer. Segment trees handle non-invertible operations directly.`,
        `For static arrays with no updates, a plain prefix-sum array is simpler and answers queries in O(1). For sparse multidimensional data, memory grows with the grid size, so a k-d tree or range tree may be more appropriate. A Fenwick tree does not support sorted iteration, range assignment, or interval scheduling.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Start with A = [3, 2, -1, 6, 5, 4, -3, 3, 7, 2] (1-indexed, n = 10). Build the Fenwick array. tree[1] = 3 (lowbit = 1, covers A[1]). tree[2] = 3 + 2 = 5 (lowbit = 2, covers A[1..2]). tree[3] = -1 (lowbit = 1, covers A[3]). tree[4] = 3 + 2 + (-1) + 6 = 10 (lowbit = 4, covers A[1..4]). tree[5] = 5 (lowbit = 1, covers A[5]). tree[6] = 5 + 4 = 9 (lowbit = 2, covers A[5..6]). tree[7] = -3 (lowbit = 1, covers A[7]). tree[8] = 3 + 2 + (-1) + 6 + 5 + 4 + (-3) + 3 = 19 (lowbit = 8, covers A[1..8]). tree[9] = 7 (lowbit = 1, covers A[9]). tree[10] = 7 + 2 = 9 (lowbit = 2, covers A[9..10]).`,
        `Query prefix_sum(6). Start at i = 6 (binary 110). tree[6] = 9, covers A[5..6]. Strip lowest bit: 6 - lowbit(6) = 6 - 2 = 4. tree[4] = 10, covers A[1..4]. Strip lowest bit: 4 - lowbit(4) = 4 - 4 = 0. Stop. Answer: 9 + 10 = 19. Verify: 3 + 2 + (-1) + 6 + 5 + 4 = 19. Two slots visited, two disjoint ranges {5..6} and {1..4} tile positions 1..6.`,
        `Update index 3 by +5. Start at i = 3 (binary 11). tree[3] += 5, becomes 4. Add lowest bit: 3 + lowbit(3) = 3 + 1 = 4. tree[4] += 5, becomes 15. Add lowest bit: 4 + lowbit(4) = 4 + 4 = 8. tree[8] += 5, becomes 24. Add lowest bit: 8 + lowbit(8) = 8 + 8 = 16 > 10. Stop. Three slots touched: indices 3, 4, 8 — exactly the slots whose coverage ranges contain position 3.`,
        `Re-query prefix_sum(6). tree[6] = 9 (unchanged, range 5..6 does not contain position 3). tree[4] = 15 (updated, range 1..4 contains position 3). Answer: 9 + 15 = 24 = 19 + 5. The delta of +5 appeared in the prefix because position 3 lies inside positions 1..6.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Peter Fenwick, "A New Data Structure for Cumulative Frequency Tables," Software: Practice and Experience, 1994. Boris Ryabko, "A Fast On-Line Adaptive Code," IEEE Transactions on Information Theory, 1992 — an independent discovery of the same structure for adaptive arithmetic coding.`,
        `Prerequisites: prefix sums (the static O(1)-query structure that a Fenwick tree makes dynamic), binary representation of integers, and two's complement (which is why i & (-i) isolates the lowest set bit).`,
        `Study next: Segment Tree (more general, supports min/max/GCD and lazy propagation, at 2-4x memory and longer code). Sparse Table (O(1) static range minimum via overlapping precomputation, no update support). Prefix Sums (the static version this structure generalizes). Merge Sort (inversion counting, one classic Fenwick application, reduces to processing elements and querying prefix counts).`,
      ],
    },
  ],
};
