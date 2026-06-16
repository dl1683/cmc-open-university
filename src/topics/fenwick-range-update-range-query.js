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
  yield {
    state: diffGraph('Range add becomes two point updates on a difference BIT'),
    highlight: { active: ['update', 'l', 'r1', 'diff', 'e-update-l', 'e-update-r1', 'e-l-diff', 'e-r1-diff'], found: ['value'] },
    explanation: 'A range add [l, r] += x can be stored in a difference array: add +x at l and -x at r+1. A Fenwick tree stores that difference array compactly.',
    invariant: 'The point value a[i] is the prefix sum of all difference updates up to i.',
  };

  yield {
    state: labelMatrix(
      'Range add as difference updates',
      [
        { id: 'start', label: 'at l' },
        { id: 'after', label: 'at r+1' },
        { id: 'inside', label: 'query inside' },
        { id: 'outside', label: 'query outside' },
      ],
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
    explanation: 'The prefix sum is a switch. It turns the addition on at l and turns it off just after r.',
  };

  yield {
    state: diffGraph('Point query asks the Fenwick tree for the diff prefix'),
    highlight: { active: ['diff', 'prefix', 'value', 'e-diff-prefix', 'e-prefix-value'], compare: ['l', 'r1'] },
    explanation: 'After many range updates, pointQuery(i) is just sumDiff(1..i). That makes range-update point-query workloads O(log n) per operation with one Fenwick tree.',
  };

  yield {
    state: labelMatrix(
      'Which Fenwick variant?',
      [
        { id: 'classic', label: 'classic BIT' },
        { id: 'diff', label: 'diff BIT' },
        { id: 'two', label: 'two BITs' },
        { id: 'segment', label: 'segment tree' },
      ],
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
    explanation: 'The family is small but important: one BIT for point updates, one BIT over differences for range-add point-query, two BITs for range-add range-sum.',
  };
}

function* twoBitRangeSum() {
  yield {
    state: twoBitGraph('Two Fenwick trees preserve prefix sums under range adds'),
    highlight: { active: ['range', 'b1', 'b2', 'e-range-b1', 'e-range-b2'], found: ['formula', 'sum'] },
    explanation: 'For range-add range-sum, one difference BIT is not enough because a prefix sum needs the accumulated area under those differences. Two BITs store slope and offset terms.',
    invariant: 'prefixSum(i) = sum(B1, i) * i - sum(B2, i).',
  };

  yield {
    state: labelMatrix(
      'Update [l, r] by x',
      [
        { id: 'b1l', label: 'B1 at l' },
        { id: 'b1r', label: 'B1 at r+1' },
        { id: 'b2l', label: 'B2 at l' },
        { id: 'b2r', label: 'B2 at r+1' },
      ],
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
    explanation: 'B1 tracks how much slope is active at prefix i. B2 subtracts the offset so the prefix formula counts exactly the cells inside the updated range.',
  };

  yield {
    state: twoBitGraph('Range sum is prefix(r) minus prefix(l-1)'),
    highlight: { active: ['i', 'formula', 'sum', 'e-i-formula', 'e-formula-sum'], compare: ['b1', 'b2'] },
    explanation: 'Once prefixSum(i) is available, rangeSum(l, r) is prefixSum(r) - prefixSum(l - 1), just like ordinary prefix sums.',
  };

  yield {
    state: labelMatrix(
      'Limits of the trick',
      [
        { id: 'sum', label: 'range sum' },
        { id: 'min', label: 'range min' },
        { id: 'assign', label: 'range assign' },
        { id: 'multi', label: '2D BIT' },
      ],
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
    explanation: 'Fenwick range tricks rely on addition, subtraction, and prefix algebra. For non-invertible operations or complex lazy tags, a segment tree is usually clearer.',
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
      heading: 'What it is',
      paragraphs: [
        'Fenwick trees are usually introduced as point-update, prefix-sum structures. With a difference-array view, the same compact walk can support range-add point-query. With two Fenwick trees, it can support range-add range-sum. The trick is not a new tree; it is choosing what the tree stores.',
        'This topic builds on Fenwick Tree, Big-O Growth, Sliding Window, and Binary Search. The basic Fenwick page teaches lowbit walks. This page explains the algebra that lets those walks represent updates over whole intervals without switching immediately to a lazy segment tree.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For range-add point-query, store the difference array in one Fenwick tree. To add x to [l, r], do add(l, x) and add(r + 1, -x). A point query at i returns prefixDiff(i), which includes every range update that started at or before i and excludes every update that ended before i.',
        'For range-add range-sum, the prefix sum is the area under those active differences. Two Fenwick trees store the linear terms. The standard formula is prefix(i) = sum(B1, i) * i - sum(B2, i). Updating [l, r] by x changes B1 at l and r + 1, and changes B2 by x * (l - 1) and -x * r. Then rangeSum(l, r) is prefix(r) - prefix(l - 1).',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Each add or sum on a Fenwick tree costs O(log n). Range-add point-query uses two Fenwick point updates per range update and one Fenwick prefix query per point query. Range-add range-sum uses four Fenwick point updates per range update and four prefix reads for a range query if you count both B1/B2 at r and l - 1. Space is O(n) for one BIT or O(2n) for two BITs.',
        'The constants are small, and the memory layout is cache-friendly compared with pointer-heavy trees. But the algebra is narrow. These tricks fit additive groups: addition and subtraction over prefixes. They do not naturally support range minimum, range assignment with overwrites, or arbitrary associative combines.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Imagine a leaderboard where promotions add bonus points to every user in rank interval [l, r], and the product asks for either one user score or the total score over a rank range. If only individual scores are queried, a difference Fenwick tree is enough. If range totals are also queried, two Fenwick trees keep both the active bonus and the prefix area of those bonuses.',
        'This is also a useful way to understand lazy propagation. A lazy segment tree stores pending range actions on tree nodes. A two-BIT solution stores a very specific kind of pending action globally through prefix algebra. It is less general, but for range addition and range sums it is compact and fast.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The biggest bug is off-by-one indexing. Most Fenwick formulas are written for 1-based arrays. If your implementation is 0-based, translate carefully or wrap the API. The second bug is forgetting the r + 1 boundary update; without it, a range add leaks past its right edge.',
        'Another misconception is that two BITs make Fenwick trees as general as segment trees. They do not. They solve an additive prefix-polynomial case. If the update or query operation does not decompose through prefix subtraction, use a segment tree or another range-query structure.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: CP-Algorithms Fenwick range operations at https://cp-algorithms.com/data_structures/fenwick.html, Topcoder Binary Indexed Tree tutorial at https://www.topcoder.com/community/competitive-programming/tutorials/binary-indexed-trees/, USACO point-update range-sum guide at https://usaco.guide/gold/PURS, and USACO range-update query note at https://usaco.guide/problems/cses-1651-range-update-queries/solution. Study Fenwick Tree, Segment Tree & Lazy Propagation, Square-Root Decomposition, Sparse Table, and Big-O Growth next.',
      ],
    },
  ],
};
