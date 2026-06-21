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
      heading: 'Why this exists',
      paragraphs: [
        'The basic Fenwick tree supports point updates and prefix sums. That is enough for many frequency tables and cumulative counters, but real workloads often update intervals: add 5 to every score from l through r, then ask for one score or a range total later.',
        {type: 'callout', text: 'The range trick works because interval updates can be converted into two boundary events, then recovered by prefix sums.'},
        'A segment tree with lazy propagation can solve this, but it is larger and more general than necessary for additive updates and sum queries. Fenwick trees can handle this narrower problem with less code and a smaller memory footprint.',
        'The trick is to stop storing the array directly. Store boundary events or linear coefficients so ordinary Fenwick prefix queries recover the value you actually want.',
      ],
    },
    {
      heading: 'The obvious approach and its limit',
      paragraphs: [
        'The direct approach is to loop from l to r and add x to every element. It is easy to write and correct for rare updates. It becomes O(r - l + 1) per update, which is too slow when ranges are large or updates are frequent.',
        'The general data-structure answer is a lazy segment tree. It handles many range updates and many aggregate queries. The limit is complexity: if the only operation is addition and the only aggregate is sum, the full generality is unnecessary.',
        'Fenwick range tricks exploit the algebra of prefix sums. They are specialized, but within that specialization they are compact and fast.',
      ],
    },
    {
      heading: 'The two walls',
      paragraphs: [
        'The first wall is range-add point-query. A single update affects many elements, but a Fenwick update touches one index and its ancestors. The data structure needs a way to mark where the interval effect starts and where it stops.',
        'The second wall is range-add range-sum. Once updates are represented as starts and stops, a point value is easy: it is the prefix sum of the difference array. A range sum asks for the accumulated area under those active differences, which needs one more layer of algebra.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'For range-add point-query, treat the Fenwick tree as a difference array. To add x on [l, r], add +x at l and -x at r + 1. A point query at i asks for the prefix of the difference tree, so it sees exactly the intervals covering i.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/16-node_Fenwick_tree.svg/500px-16-node_Fenwick_tree.svg.png', alt: 'Fenwick tree interrogation diagram showing lowbit range ownership', caption: 'A 16-node Fenwick interrogation tree makes the lowbit ranges visible. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:16-node_Fenwick_tree.svg.'},
        'For range-add range-sum, use two Fenwick trees. B1 stores the active coefficient of i. B2 stores the correction term. The prefix total through i is sum(B1, i) * i - sum(B2, i).',
        'This formula works because the prefix of a range-added array is piecewise linear. B1 gives the slope of the piece currently active at i, and B2 shifts the line so it starts counting at the correct left boundary.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'Assume 1-based indices. The one-BIT variant performs add(diff, l, x) and add(diff, r + 1, -x). Then point(i) = prefix(diff, i). If r is n, the r + 1 update is skipped or written to a sentinel outside the queried range.',
        'The two-BIT variant updates four boundary events: add(B1, l, x), add(B1, r + 1, -x), add(B2, l, x * (l - 1)), and add(B2, r + 1, -x * r). Then prefix(i) = prefix(B1, i) * i - prefix(B2, i).',
        'A range query is still prefix subtraction: rangeSum(l, r) = prefix(r) - prefix(l - 1). The ordinary Fenwick walk is unchanged; only the meaning of the stored numbers changes.',
      ],
    },
    {
      heading: 'Invariant and proof sketch',
      paragraphs: [
        'For the one-BIT version, the invariant is that diff[k] contains the net change that begins at k. Taking a prefix over diff adds every interval that has started and removes every interval whose r + 1 boundary has passed.',
        'For the two-BIT version, consider one update [l, r] by x. Its contribution to prefix(i) is 0 when i < l, x * (i - l + 1) when l <= i <= r, and x * (r - l + 1) when i > r.',
        'The B1 and B2 boundary events reproduce exactly that piecewise function. Between l and r, B1 contributes x * i and B2 subtracts x * (l - 1). After r, the negative events at r + 1 stop the slope and leave the constant completed contribution.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Each Fenwick update or prefix read costs O(log n). Range-add point-query uses two Fenwick updates for each interval update and one prefix read for each point query.',
        'Range-add range-sum uses four Fenwick updates for each interval update. A range query uses two prefix formulas, and each formula reads both B1 and B2. The asymptotic cost is still O(log n), but the constant factor is higher.',
        'Space is O(n) for the one-BIT version and O(2n) for the two-BIT version. The arrays are compact and cache-friendly compared with pointer-heavy trees.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Off-by-one errors are the main implementation risk. Most formulas assume 1-based indices. With 0-based public APIs, convert at the boundary and keep the internal Fenwick logic 1-based.',
        'Forgetting the r + 1 update makes the interval leak past its right edge. Using x * l instead of x * (l - 1), or x * (r + 1) instead of x * r in B2, shifts every prefix after the boundary.',
        'Integer overflow is easy in the two-BIT formula because values are multiplied by indices. Use a numeric type large enough for maxUpdate * n * numberOfUpdates.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'It wins for additive interval bonuses, score adjustments, batched counters, inventory shifts, event deltas, range-applied weights, and analytics workloads where updates are additive and queries are point values or sums.',
        'It is a useful teaching bridge to lazy propagation. A lazy segment tree stores pending actions on tree nodes. Two BITs store one specific pending action through prefix algebra.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It is a poor fit for range minimum, range maximum, gcd, arbitrary associative operations, and range assignment overwrite. Those operations do not decompose through prefix subtraction in the same way addition does.',
        'It is also weaker when queries need rich conditions, custom lazy tags, order statistics, or non-linear updates. A segment tree, interval tree, balanced binary search tree, or offline sweep may be clearer.',
      ],
    },
    {
      heading: 'What the views show',
      paragraphs: [
        'In the range-add point-query view, read l and r + 1 as boundary events. The add node does not touch every item in the interval; it writes a start event and a stop event into the difference BIT.',
        'The prefix node is the decoder. It walks the Fenwick tree up to i and reconstructs the value at that point by summing every still-active interval update.',
        'In the two-BIT view, B1 is the slope tree and B2 is the offset tree. The formula node is the whole point of the variant: it turns two ordinary Fenwick prefixes into a prefix sum of the updated array.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Expose whatever public indexing style fits the rest of the codebase, but keep the internal Fenwick arrays 1-based. Convert l, r, and i at the API boundary, then write the update formulas exactly once in private helpers. That reduces the chance that one method uses 0-based math while another uses 1-based math.',
        'Build tests from small arrays and compare against a naive implementation. Randomly generate range additions and range queries, then assert that the two-BIT result matches the direct array after every operation. Include r = n, l = 1, single-element ranges, negative updates, and large values that exercise overflow limits.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: CP-Algorithms Fenwick range operations at https://cp-algorithms.com/data_structures/fenwick.html, Topcoder Binary Indexed Tree tutorial at https://www.topcoder.com/community/competitive-programming/tutorials/binary-indexed-trees/, USACO point-update range-sum guide at https://usaco.guide/gold/PURS, and USACO range-update query note at https://usaco.guide/problems/cses-1651-range-update-queries/solution. Study Fenwick Tree, Segment Tree & Lazy Propagation, Square-Root Decomposition, Sparse Table, and Big-O Growth next.',
      ],
    },
  ],
};
