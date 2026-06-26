// Fenwick variants use difference arrays and two BITs to support range updates
// and range-sum queries while keeping the compact Fenwick walk.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'fenwick-range-update-range-query',
  title: 'Fenwick Range Update & Range Query',
  category: 'Data Structures',
  summary: 'Use a Fenwick tree as a difference array for range-add point-query, then two Fenwick trees for range-add range-sum queries.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['range add point query', 'two BIT range sum'], defaultValue: 'range add point query' },
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

function diffGraph(title) {
  return graphState({
    nodes: [
      { id: 'update', label: 'add', x: 0.8, y: 3.4, note: '[l,r]+x' },
      { id: 'l', label: 'l', x: 2.6, y: 1.8, note: '+x' },
      { id: 'r1', label: 'r+1', x: 2.6, y: 5.0, note: '-x' },
      { id: 'diff', label: 'diff BIT', x: 4.9, y: 3.4, note: 'point updates' },
      { id: 'prefix', label: 'prefix', x: 7.0, y: 3.4, note: 'sum i' },
      { id: 'value', label: 'a[i]', x: 8.9, y: 3.4, note: 'point query' },
    ],
    edges: [
      { id: 'e-update-l', from: 'update', to: 'l' },
      { id: 'e-update-r1', from: 'update', to: 'r1' },
      { id: 'e-l-diff', from: 'l', to: 'diff' },
      { id: 'e-r1-diff', from: 'r1', to: 'diff' },
      { id: 'e-diff-prefix', from: 'diff', to: 'prefix' },
      { id: 'e-prefix-value', from: 'prefix', to: 'value' },
    ],
  }, { title });
}

function twoBitGraph(title) {
  return graphState({
    nodes: [
      { id: 'range', label: 'add', x: 0.8, y: 3.4, note: '[l,r]+x' },
      { id: 'b1', label: 'B1', x: 3.0, y: 1.8, note: 'slope' },
      { id: 'b2', label: 'B2', x: 3.0, y: 5.0, note: 'offset' },
      { id: 'i', label: 'i', x: 5.1, y: 3.4, note: 'prefix end' },
      { id: 'formula', label: 'formula', x: 7.0, y: 3.4, note: 'B1*i-B2' },
      { id: 'sum', label: 'sum', x: 8.9, y: 3.4, note: 'prefix' },
    ],
    edges: [
      { id: 'e-range-b1', from: 'range', to: 'b1' },
      { id: 'e-range-b2', from: 'range', to: 'b2' },
      { id: 'e-b1-formula', from: 'b1', to: 'formula' },
      { id: 'e-b2-formula', from: 'b2', to: 'formula' },
      { id: 'e-i-formula', from: 'i', to: 'formula' },
      { id: 'e-formula-sum', from: 'formula', to: 'sum' },
    ],
  }, { title });
}

function* rangeAddPointQuery() {
  const diffNodes = ['update', 'l', 'r1', 'diff', 'prefix', 'value'];
  const diffEdges = ['e-update-l', 'e-update-r1', 'e-l-diff', 'e-r1-diff', 'e-diff-prefix', 'e-prefix-value'];
  const pointUpdatesPerRange = 2;
  yield {
    state: diffGraph('Range add becomes two point updates on a difference BIT'),
    highlight: { active: ['update', 'l', 'r1', 'diff', 'e-update-l', 'e-update-r1', 'e-l-diff', 'e-r1-diff'], found: ['value'] },
    explanation: `A range add [l, r] += x becomes ${pointUpdatesPerRange} point updates on a difference array: +x at l and -x at r+1. The ${diffNodes.length}-node graph shows how a Fenwick tree stores that difference array compactly.`,
    invariant: `The point value a[i] equals the prefix sum of all difference updates up to i — recovered by walking ${diffEdges.length} edges through the BIT.`,
  };

  const diffOps = [
    { id: 'start', label: 'at l' },
    { id: 'after', label: 'at r+1' },
    { id: 'inside', label: 'query inside' },
    { id: 'outside', label: 'query outside' },
  ];
  yield {
    state: labelMatrix(
      'Range add as difference updates',
      diffOps,
      [
        { id: 'operation', label: 'operation' },
        { id: 'effect' },
      ],
      [
        ['diff[l] += x', 'turn on'],
        ['diff[r+1] -= x', 'turn off'],
        ['prefix sees +x', 'updated'],
        ['prefix cancels', 'unchanged'],
      ],
    ),
    highlight: { active: ['start:operation', 'after:operation'], found: ['inside:effect'], compare: ['outside:effect'] },
    explanation: `The prefix sum is a switch across ${diffOps.length} cases. The first ${pointUpdatesPerRange} rows show how it turns the addition on at l and off just after r; the remaining ${diffOps.length - pointUpdatesPerRange} show query behavior inside and outside the range.`,
  };

  yield {
    state: diffGraph('Point query asks the Fenwick tree for the diff prefix'),
    highlight: { active: ['diff', 'prefix', 'value', 'e-diff-prefix', 'e-prefix-value'], compare: ['l', 'r1'] },
    explanation: `After many range updates, pointQuery(i) is just sumDiff(1..i). That makes range-update point-query workloads O(log n) per operation with just ${1} Fenwick tree — ${pointUpdatesPerRange} point updates per range add, one prefix read per point query.`,
  };

  const variants = [
    { id: 'classic', label: 'classic BIT' },
    { id: 'diff', label: 'diff BIT' },
    { id: 'two', label: 'two BITs' },
    { id: 'segment', label: 'segment tree' },
  ];
  yield {
    state: labelMatrix(
      'Which Fenwick variant?',
      variants,
      [
        { id: 'updates', label: 'updates' },
        { id: 'queries' },
      ],
      [
        ['point add', 'range sum'],
        ['range add', 'point value'],
        ['range add', 'range sum'],
        ['many ops', 'flexible combine'],
      ],
    ),
    highlight: { active: ['diff:updates', 'diff:queries'], found: ['two:updates', 'two:queries'], compare: ['segment:queries'] },
    explanation: `The family has ${variants.length} variants: ${variants.map(v => v.label).join(', ')}. One BIT for point updates, one BIT over differences for range-add point-query, two BITs for range-add range-sum.`,
  };
}

function* twoBitRangeSum() {
  const numBITs = 2;
  const updatesPerRange = 4;
  yield {
    state: twoBitGraph('Two Fenwick trees preserve prefix sums under range adds'),
    highlight: { active: ['range', 'b1', 'b2', 'e-range-b1', 'e-range-b2'], found: ['formula', 'sum'] },
    explanation: `For range-add range-sum, 1 difference BIT is not enough because a prefix sum needs the accumulated area under those differences. ${numBITs} BITs store slope (B1) and offset (B2) terms, requiring ${updatesPerRange} point updates per range add.`,
    invariant: `prefixSum(i) = sum(B1, i) * i - sum(B2, i) — combining both ${numBITs} trees at query time.`,
  };

  const updateEntries = [
    { id: 'b1l', label: 'B1 at l' },
    { id: 'b1r', label: 'B1 at r+1' },
    { id: 'b2l', label: 'B2 at l' },
    { id: 'b2r', label: 'B2 at r+1' },
  ];
  yield {
    state: labelMatrix(
      'Update [l, r] by x',
      updateEntries,
      [
        { id: 'operation', label: 'operation' },
        { id: 'why' },
      ],
      [
        ['+x', 'start slope'],
        ['-x', 'stop slope'],
        ['+x*(l-1)', 'left offset'],
        ['-x*r', 'right offset'],
      ],
    ),
    highlight: { active: ['b1l:operation', 'b1r:operation'], found: ['b2l:operation', 'b2r:operation'] },
    explanation: `Each range add writes ${updateEntries.length} boundary events — ${updateEntries.filter(e => e.id.startsWith('b1')).length} into B1 (slope) and ${updateEntries.filter(e => e.id.startsWith('b2')).length} into B2 (offset). B1 tracks how much slope is active at prefix i; B2 subtracts the offset so the prefix formula counts exactly the cells inside the updated range.`,
  };

  yield {
    state: twoBitGraph('Range sum is prefix(r) minus prefix(l-1)'),
    highlight: { active: ['i', 'formula', 'sum', 'e-i-formula', 'e-formula-sum'], compare: ['b1', 'b2'] },
    explanation: `Once prefixSum(i) is available from ${numBITs} trees, rangeSum(l, r) is prefixSum(r) - prefixSum(l - 1), just like ordinary prefix sums.`,
  };

  const limits = [
    { id: 'sum', label: 'range sum', fit: 'excellent' },
    { id: 'min', label: 'range min', fit: 'poor' },
    { id: 'assign', label: 'range assign', fit: 'poor alone' },
    { id: 'multi', label: '2D BIT', fit: 'possible' },
  ];
  const goodFits = limits.filter(l => l.fit === 'excellent');
  yield {
    state: labelMatrix(
      'Limits of the trick',
      limits.map(({ id, label }) => ({ id, label })),
      [
        { id: 'fit', label: 'fit' },
        { id: 'reason' },
      ],
      [
        ['excellent', 'linear algebra'],
        ['poor', 'no inverse'],
        ['poor alone', 'overwrites compose badly'],
        ['possible', 'inclusion-exclusion'],
      ],
    ),
    highlight: { active: ['sum:fit', 'sum:reason'], compare: ['min:reason', 'assign:reason'], found: ['multi:fit'] },
    explanation: `Of ${limits.length} operations tested, only ${goodFits.length} (${goodFits.map(g => g.label).join(', ')}) fits excellently. Fenwick range tricks rely on addition, subtraction, and prefix algebra — for non-invertible operations or complex lazy tags, a segment tree is usually clearer.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'range add point query') yield* rangeAddPointQuery();
  else if (view === 'two BIT range sum') yield* twoBitRangeSum();
  else throw new InputError('Pick a Fenwick range-update view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has two views, selectable from the dropdown. The first view, "range add point query," shows how a single difference BIT converts a range addition into two point updates and recovers any element through a prefix sum. The second view, "two BIT range sum," shows how two BITs (one for slope, one for offset) handle range additions while still answering range-sum queries.',
        {type: 'image', src: './assets/gifs/fenwick-range-update-range-query.gif', alt: 'Animated walkthrough of the fenwick range update range query visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'In the first view, watch the "add" node split into +x at l and -x at r+1, both feeding into the difference BIT. The prefix node then walks that BIT to reconstruct any single element. In the second view, the "add" node feeds four boundary events into B1 (slope) and B2 (offset), and the formula node combines them as sum(B1,i)*i - sum(B2,i) to produce a prefix total.',
        'Highlighted nodes are the active participants in the current step. Nodes in the "found" color show the final output. Step through slowly to see how each boundary event lands in the correct tree.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A standard Fenwick tree handles point updates and prefix-sum queries, each in O(log n). That covers frequency tables, cumulative counters, and inversion-count problems. But many workloads need to update entire intervals at once: add 10 to every score between index 3 and index 200, then later ask for a single score or the sum of a subrange.',
        {type: 'callout', text: 'The range trick works because interval updates can be converted into two boundary events, then recovered by prefix sums.'},
        'A segment tree with lazy propagation solves this in full generality, but it carries overhead: 4n space, recursive structure, and a lazy-push protocol. When the only update is addition and the only query is point value or sum, the full segment tree is more machinery than the problem requires. Fenwick range variants solve these two specific problems with almost no extra code beyond the standard Fenwick implementation.',
        'The key idea is to change what the Fenwick tree stores. Instead of storing the array directly, store either a difference array (for range-add, point-query) or a pair of linear coefficients (for range-add, range-sum). Ordinary Fenwick prefix queries then decode the values you actually need.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The brute-force way to add x to every element in [l, r] is a loop: for each index from l to r, increment it. This is O(r - l + 1) per update. If the range spans most of the array and updates arrive frequently, the cost approaches O(n) per operation, which defeats the purpose of using a tree at all.',
        'Point queries stay O(1) with this approach since the array is updated in place, but the update cost dominates. For q updates on ranges of average length k, total work is O(q * k), which can reach O(q * n) in the worst case.',
        'The standard fix is a segment tree with lazy propagation. It achieves O(log n) per range update and O(log n) per range query for arbitrary associative operations. The downside is implementation weight: you need a build step, push-down logic, and careful handling of lazy tags during queries.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The first wall is range-add with point-query. A Fenwick point update touches one index and its ancestors along the lowbit path, which is O(log n) work. But a range add touches many indices. There is no built-in mechanism to mark an entire interval in a single Fenwick operation.',
        'The second wall appears when you also need range-sum queries. Even if you solve the first problem using a difference array, a point query recovers one element. A range sum asks for the total of many elements, which means summing many prefix sums of differences. That is a sum of sums, and it requires a second layer of bookkeeping to avoid O(n) per query.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'For range-add point-query, stop storing array values in the Fenwick tree. Instead, store a difference array. To add x on the interval [l, r], perform two point updates: +x at position l and -x at position r+1. A point query at index i computes prefix(diff, i), which sums exactly the intervals that cover i. Every interval whose start is at or before i contributes +x; every interval whose end+1 is at or before i contributes -x, canceling the effect.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/16-node_Fenwick_tree.svg/500px-16-node_Fenwick_tree.svg.png', alt: 'Fenwick tree interrogation diagram showing lowbit range ownership', caption: 'A 16-node Fenwick interrogation tree makes the lowbit ranges visible. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:16-node_Fenwick_tree.svg.'},
        'For range-add range-sum, one difference BIT is not enough. The prefix sum of the original array through position i depends on the accumulated area under the difference curve, not just its value at one point. The fix is two Fenwick trees: B1 stores the slope (the active increment per index), and B2 stores an offset correction. The prefix sum through i is then sum(B1, i) * i - sum(B2, i).',
        'This formula works because each range add creates a piecewise-linear contribution to the prefix sum. Before the interval starts, the contribution is zero. Inside the interval, it grows linearly with slope x. After the interval ends, it is a constant. B1 tracks the slope, and B2 adjusts the y-intercept so the linear piece starts counting at the correct boundary.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'All indices are 1-based. For range-add point-query with one BIT on a difference array: to add x on [l, r], call update(diff, l, +x) and update(diff, r+1, -x). To read a[i], compute prefix(diff, i). That prefix sum accumulates every +x whose start boundary is at or before i, minus every -x whose cancellation boundary is at or before i.',
        'For range-add range-sum with two BITs: to add x on [l, r], write four point updates. Into B1: update(B1, l, +x) and update(B1, r+1, -x). Into B2: update(B2, l, x*(l-1)) and update(B2, r+1, -x*r). Then prefix(i) = sum(B1, i) * i - sum(B2, i). A range query from l to r is prefix(r) - prefix(l-1), exactly like ordinary prefix sums.',
        'The B2 values look asymmetric: x*(l-1) at l versus -x*r at r+1. This is deliberate. The offset at l must undo the slope contribution for indices 1 through l-1 (which are outside the interval), and the offset at r+1 must freeze the contribution at its final value for all indices after r.',
        'The underlying Fenwick walk (chasing lowbit) is completely unchanged. The only difference is what numbers are stored in the array and what formula combines the two prefix results at query time.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'For the one-BIT version, correctness comes from the prefix-sum identity. If diff[k] records the net change that begins at index k, then prefix(diff, i) = a[1] + a[2] + ... where each a[j] is the original plus all interval effects that started at or before j minus those canceled at or before j. For a single interval [l, r] with value x: the +x at l is included in every prefix from l onward, and the -x at r+1 cancels it for every prefix from r+1 onward. The net effect is exactly +x for indices in [l, r] and zero elsewhere.',
        'For the two-BIT version, consider one interval [l, r] with value x. The prefix sum of the original array through index i should gain x*(i - l + 1) when l <= i <= r, and x*(r - l + 1) when i > r. Expanding x*(i - l + 1) gives x*i - x*(l-1). The B1 tree stores the coefficient of i (the slope x), and B2 stores the constant x*(l-1). The formula sum(B1,i)*i - sum(B2,i) reconstructs x*i - x*(l-1) exactly inside the interval.',
        'After r, the negative boundary events at r+1 cancel the slope in B1 and add -x*r to B2. The net B1 contribution drops to zero, and the net B2 contribution becomes x*(l-1) - (-x*r) = x*(l-1) + x*r. But with B1 slope gone, the formula yields 0*i - (x*(l-1) - x*r) = x*r - x*(l-1) = x*(r - l + 1), which is the correct constant total for indices past the interval.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Every Fenwick point update and prefix query costs O(log n) because the lowbit walk visits at most floor(log2(n)) nodes. The one-BIT variant performs 2 point updates per range add and 1 prefix query per point query. The two-BIT variant performs 4 point updates per range add (2 into B1, 2 into B2) and 2 prefix queries per prefix computation (one from each tree), so a range query costs 4 prefix reads total.',
        'When n doubles, log n increases by 1, so every operation gets one extra step. For n = 1,000, each operation touches about 10 nodes. For n = 1,000,000, about 20 nodes. The growth is extremely gentle.',
        'Space for the one-BIT variant is one array of n+1 integers. The two-BIT variant uses two such arrays, so 2*(n+1). Both are flat arrays with sequential access patterns, which means good cache behavior. A segment tree with lazy propagation needs 4n nodes plus a lazy tag array, roughly 8n to 10n integers depending on implementation.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Competitive programming is the most common setting. Problems on Codeforces, CSES, and USACO that require range additions with point or sum queries are solved cleanly with these Fenwick variants. The two-BIT approach often replaces a lazy segment tree when the only operation is addition.',
        'In game engines, applying a damage-over-time or buff effect to a contiguous block of units is a range add. Querying one unit\'s health is a point query; computing total remaining health for a group is a range sum. The Fenwick variant avoids the memory and complexity overhead of a full segment tree.',
        'In analytics pipelines, batch adjustments to time-series data (add a correction factor to all readings between timestamps l and r) followed by prefix-sum queries for cumulative totals fit the two-BIT model directly. The constant-factor advantage over a segment tree matters when processing millions of events per second.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Range minimum, range maximum, range gcd, and any non-invertible aggregate cannot use this trick. The entire approach depends on prefix subtraction: rangeSum(l,r) = prefix(r) - prefix(l-1). Minimum has no inverse operation, so prefix subtraction does not recover the answer for a subrange.',
        'Range assignment (set every element in [l, r] to x, overwriting previous values) cannot be modeled with additive boundary events. Assignments do not compose the way additions do: two overlapping assignments do not sum, the later one wins. A lazy segment tree with overwrite tags handles this; Fenwick trees do not.',
        'Problems requiring order statistics (k-th smallest in a range), persistent queries (answer a query on a historical version of the array), or non-linear updates (multiply a range by x) need different structures. The Fenwick range trick is narrow: it handles additive updates and sum/point queries, nothing else.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with array a = [0, 0, 0, 0, 0] (indices 1 through 5), one difference BIT diff initialized to all zeros, and two BITs B1, B2 also all zeros.',
        'One-BIT variant: add 3 on [2, 4]. Update diff: update(diff, 2, +3) and update(diff, 5, -3). Now diff conceptually holds [0, 3, 0, 0, -3]. Point query at index 3: prefix(diff, 3) = 0 + 3 + 0 = 3. Correct, because index 3 is inside [2, 4]. Point query at index 5: prefix(diff, 5) = 0 + 3 + 0 + 0 + (-3) = 0. Correct, because index 5 is outside [2, 4].',
        'Two-BIT variant: add 3 on [2, 4]. Four updates: update(B1, 2, +3), update(B1, 5, -3), update(B2, 2, 3*(2-1)) = update(B2, 2, 3), update(B2, 5, -3*4) = update(B2, 5, -12). Now B1 conceptually holds [0, 3, 0, 0, -3] and B2 holds [0, 3, 0, 0, -12].',
        'Prefix sum at i=3: sum(B1, 3) = 0+3+0 = 3. sum(B2, 3) = 0+3+0 = 3. Result = 3*3 - 3 = 6. Check: a[1]+a[2]+a[3] = 0+3+3 = 6. Correct. Prefix sum at i=4: sum(B1, 4) = 3. sum(B2, 4) = 3. Result = 3*4 - 3 = 9. Check: 0+3+3+3 = 9. Correct. Prefix sum at i=5: sum(B1, 5) = 3+(-3) = 0. sum(B2, 5) = 3+(-12) = -9. Result = 0*5 - (-9) = 9. Check: 0+3+3+3+0 = 9. Correct.',
        'Range sum from 2 to 4: prefix(4) - prefix(1). prefix(1) = sum(B1,1)*1 - sum(B2,1) = 0*1 - 0 = 0. So rangeSum(2,4) = 9 - 0 = 9. Check: a[2]+a[3]+a[4] = 3+3+3 = 9. Correct.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Peter Fenwick\'s original 1994 paper, "A New Data Structure for Cumulative Frequency Tables," introduced the BIT for point-update prefix-sum. The range-update extensions appear in competitive-programming literature and are documented thoroughly at CP-Algorithms: https://cp-algorithms.com/data_structures/fenwick.html. The Topcoder BIT tutorial covers the basics: https://www.topcoder.com/community/competitive-programming/tutorials/binary-indexed-trees/. USACO\'s PURS module at https://usaco.guide/gold/PURS and the range-update problem guide at https://usaco.guide/problems/cses-1651-range-update-queries/solution provide practice problems.',
        'Study the standard Fenwick tree first if prefix sums and lowbit walks are unfamiliar. After mastering the range variants here, move to segment trees with lazy propagation for non-additive operations, square-root decomposition for offline or block-based alternatives, and sparse tables for static range-minimum queries. Each structure trades generality against constant-factor cost.',
      ],
    },
  ],
};
