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
      heading: 'Why this exists',
      paragraphs: [
        `A Fenwick tree exists when values keep changing and the question keeps asking for a prefix total: "How many events happened up to minute k?", "What is the cumulative frequency through rank k?", "What is the sum of the first k cells after this edit?"`,
        `A raw array handles the edit cheaply but recomputes the prefix by scanning. A prefix-sum array answers the prefix cheaply but turns one edit into a rewrite of every later prefix. The Fenwick tree keeps one compact array of partial sums so both operations are small.`,
      ],
    },
    {
      heading: 'The reasonable baseline',
      paragraphs: [
        `The read-heavy baseline is prefix[k] = values[1] + ... + values[k]. It makes prefix(k) O(1), and it is the right answer for static arrays.`,
        `The write-heavy baseline is the original array. Adding delta to values[i] is O(1), and it is the right answer when prefix queries are rare.`,
        `A segment tree is the general baseline once range operations become rich. A Fenwick tree is narrower: it targets prefix-style aggregates and point updates with less memory, less code, and better constants.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `The wall is uncontrolled overlap. Prefixes share most of their elements. Changing values[i] changes prefix[i], prefix[i + 1], prefix[i + 2], and every later prefix.`,
        `The structure needs summaries that overlap enough to answer a prefix quickly but not so much that one update touches the whole suffix. It also needs the prefix 1..k to break into disjoint stored ranges, or the query will double-count.`,
        `Fenwick's lowbit rule is the compact answer to that balance. Each slot owns a power-of-two suffix ending at its own index, so updates touch logarithmically many owners and queries tile the prefix with logarithmically many disjoint ranges.`,
      ],
    },
    {
      heading: 'Invariant and layout',
      paragraphs: [
        `The array is read with 1-based indexes. tree[i] stores the sum of values from i - lowbit(i) + 1 through i. lowbit(i) is the value of the lowest set bit in i.`,
        `That one bit assigns a responsibility range to every slot. Index 12 is binary 1100, so lowbit(12) is 4 and tree[12] stores values 9..12. Index 10 is binary 1010, so it stores values 9..10. Odd indexes store one value.`,
        `The invariant is exact: each tree slot stores the sum of the range it owns, and no query or update is allowed to break that ownership.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `To query prefix(k), add tree[k], then move to k - lowbit(k). Repeat until k becomes 0. The walk moves left from one owned range to the previous uncovered range.`,
        `To update position i by delta, add delta to tree[i], then move to i + lowbit(i). Repeat until the index passes n. The walk moves right through every summary range that contains the changed position.`,
        `The common linear build starts with each value in its own slot, then pushes tree[i] into i + lowbit(i). Each slot contributes once to the next larger range that owns it.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `A prefix query is correct because subtracting lowbit removes exactly the range just counted. The next index is the end of the remaining prefix. The visited ranges are disjoint and tile 1..k exactly once.`,
        `A point update is correct because the only stale summaries are the ranges that contain position i. Adding lowbit jumps from one such owner to the next larger owner. Ranges that do not contain i are skipped, so no unrelated sum changes.`,
        `The proof is an invariant proof. If every tree slot starts with the correct owned-range sum, query reads a disjoint cover of the requested prefix, and update adds the same delta to all and only the owners of the changed cell.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `prefix(k) and add(i, delta) each take O(log n) time because each loop changes at least one bit of the index and there are only O(log n) bits. Doubling n adds at most one more bit to the index, so the walk grows slowly.`,
        `Space is O(n), usually an array of length n + 1. The structure is cache-friendly because it uses contiguous storage and no pointers. The hidden tax is indexing discipline: most bugs come from mixing 0-based client positions with 1-based lowbit loops.`,
        `Fenwick trees work cleanly for sums, counts, and other prefix aggregates where differences between prefixes are meaningful. If the operation needs arbitrary lazy range updates, range minimum with changing values, or several fields per node, a segment tree is usually easier to reason about.`,
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        `Expose a clean public indexing convention. If the public API accepts zero-based positions, convert to one-based exactly once at the boundary. Inside the tree, keep every loop one-based. That separation prevents the most common off-by-one errors.`,
        `Define the aggregate contract. Sums and counts are natural because prefix ranges can be subtracted to answer range(l, r). Minimum and maximum are not drop-in replacements under arbitrary point updates because removing an old value from a summary is not generally invertible.`,
        `Use wide enough numeric types. Frequency tables and cumulative weights can overflow ordinary integer ranges in languages with fixed-width numbers. In JavaScript, large exact counts may need BigInt or careful limits if precision matters.`,
      ],
    },
    {
      heading: 'Testing it',
      paragraphs: [
        `Randomized tests are effective. Keep a plain array beside the Fenwick tree, apply random point updates, and compare prefix(k) and range(l, r) against direct sums after every operation. Include negative deltas, updates at position 1, updates at n, and queries at every boundary.`,
        `For order-statistic search over cumulative counts, compare against a linear scan over the plain frequency array. That catches the second class of bugs: not the lowbit update/query loops, but the binary lifting used to find the first prefix that reaches a target.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Fenwick trees win on dynamic frequency tables. If index r stores the count of items with rank r, prefix(r) gives "how many items have rank at most r" after each insertion or deletion.`,
        `They are common in inversion counting, live rank queries, arithmetic coding tables, online histograms, and offline counting problems after coordinate compression. The fit is strongest when keys can be mapped to dense integer positions.`,
        `They also support order-statistic search over cumulative counts: walk the implicit binary structure to find the smallest index whose prefix sum reaches a target count.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `It is the wrong tool for static arrays. A prefix-sum array is simpler and answers queries in O(1) when there are no updates.`,
        `It is also the wrong default for sparse multidimensional data. Two-dimensional Fenwick trees exist, but memory grows with the grid unless the implementation is compressed. For geometric points, a k-d tree, range tree, or spatial hash may fit better.`,
        `It does not give sorted iteration, arbitrary range assignment, or rich interval logic. Those are different contracts.`,
      ],
    },
    {
      heading: 'Concrete example',
      paragraphs: [
        `Suppose values are [3, 2, -1, 6, 5, 4] and you ask for prefix(6). The query might read tree[6], then tree[4]. tree[6] owns values 5..6, and tree[4] owns values 1..4, so the two reads cover 1..6 exactly once.`,
        `If values[3] increases by 2, every stored range that contains position 3 must increase by 2. The update walk touches position 3, then 4, then 8 if it exists. It does not touch tree[6], because range 5..6 does not contain position 3.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Prefix Sums first if static cumulative totals are not automatic yet. Study Fenwick Range Update & Range Query for the difference-array and two-BIT variants. Study Segment Tree for richer range operations, Coordinate Compression for dense indexes from arbitrary keys, and Binary Lifting for another data-structure trick driven by index bits.`,
      ],
    },
  ],
};
