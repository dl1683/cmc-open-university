// Square-root decomposition splits an array into blocks and stores one summary
// per block, giving simple O(sqrt n) range queries with cheap point updates.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'sqrt-decomposition-range-queries',
  title: 'Square-Root Decomposition Range Queries',
  category: 'Data Structures',
  summary: 'Split an array into about sqrt(n) blocks, precompute block summaries, and answer range queries by combining edge scans with whole-block answers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['range query', 'point update'], defaultValue: 'range query' },
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

function blocksGraph(title) {
  return graphState({
    nodes: [
      { id: 'array', label: 'array', x: 0.8, y: 3.4, note: 'n values' },
      { id: 'b0', label: 'B0', x: 2.7, y: 1.8, note: '0..3' },
      { id: 'b1', label: 'B1', x: 4.8, y: 1.8, note: '4..7' },
      { id: 'b2', label: 'B2', x: 6.9, y: 1.8, note: '8..11' },
      { id: 'left', label: 'left', x: 3.1, y: 5.0, note: 'edge scan' },
      { id: 'full', label: 'full', x: 5.1, y: 5.0, note: 'block sum' },
      { id: 'right', label: 'right', x: 7.1, y: 5.0, note: 'edge scan' },
      { id: 'ans', label: 'answer', x: 9.0, y: 3.4, note: 'combine' },
    ],
    edges: [
      { id: 'e-array-b0', from: 'array', to: 'b0' },
      { id: 'e-array-b1', from: 'array', to: 'b1' },
      { id: 'e-array-b2', from: 'array', to: 'b2' },
      { id: 'e-b0-left', from: 'b0', to: 'left' },
      { id: 'e-b1-full', from: 'b1', to: 'full' },
      { id: 'e-b2-right', from: 'b2', to: 'right' },
      { id: 'e-left-ans', from: 'left', to: 'ans' },
      { id: 'e-full-ans', from: 'full', to: 'ans' },
      { id: 'e-right-ans', from: 'right', to: 'ans' },
    ],
  }, { title });
}

function updateGraph(title) {
  return graphState({
    nodes: [
      { id: 'idx', label: 'i=6', x: 0.8, y: 3.4, note: 'update' },
      { id: 'old', label: 'old', x: 2.5, y: 1.8, note: 'a[i]' },
      { id: 'new', label: 'new', x: 2.5, y: 5.0, note: 'value' },
      { id: 'delta', label: 'delta', x: 4.6, y: 3.4, note: 'new-old' },
      { id: 'block', label: 'B1', x: 6.6, y: 3.4, note: 'contains i' },
      { id: 'array', label: 'array', x: 8.5, y: 1.8, note: 'write' },
      { id: 'summary', label: 'sum', x: 8.5, y: 5.0, note: 'add delta' },
    ],
    edges: [
      { id: 'e-idx-old', from: 'idx', to: 'old' },
      { id: 'e-idx-new', from: 'idx', to: 'new' },
      { id: 'e-old-delta', from: 'old', to: 'delta' },
      { id: 'e-new-delta', from: 'new', to: 'delta' },
      { id: 'e-delta-block', from: 'delta', to: 'block' },
      { id: 'e-block-array', from: 'block', to: 'array' },
      { id: 'e-block-summary', from: 'block', to: 'summary' },
    ],
  }, { title });
}

function* rangeQuery() {
  yield {
    state: blocksGraph('Split the array into sqrt-sized blocks'),
    highlight: { active: ['array', 'b0', 'b1', 'b2', 'e-array-b0', 'e-array-b1', 'e-array-b2'], found: ['full'] },
    explanation: 'Square-root decomposition divides the array into blocks of length about sqrt(n). Each block stores a summary such as sum, min, max, count, or a small sorted list.',
    invariant: 'Blocks cover the array in order, and each element belongs to exactly one block.',
  };

  yield {
    state: labelMatrix(
      'Build block sums',
      [
        { id: 'b0', label: 'B0' },
        { id: 'b1', label: 'B1' },
        { id: 'b2', label: 'B2' },
      ],
      [
        { id: 'range', label: 'range' },
        { id: 'values' },
        { id: 'sum' },
      ],
      [
        ['0..3', '3,2,-1,6', '10'],
        ['4..7', '5,4,-3,3', '9'],
        ['8..11', '7,1,2,8', '18'],
      ],
    ),
    highlight: { active: ['b0:sum', 'b1:sum', 'b2:sum'], compare: ['b0:values'] },
    explanation: 'Preprocessing scans the array once and builds one summary per block. For n elements, there are about sqrt(n) blocks, each about sqrt(n) wide.',
  };

  yield {
    state: blocksGraph('Query range [2, 9]: scan tails, use whole blocks'),
    highlight: { active: ['left', 'full', 'right', 'e-left-ans', 'e-full-ans', 'e-right-ans'], found: ['ans'], compare: ['b1'] },
    explanation: 'A range query scans the partial block at the left edge, uses precomputed summaries for fully covered blocks, and scans the partial block at the right edge.',
  };

  yield {
    state: labelMatrix(
      'Range query decomposition',
      [
        { id: 'left', label: 'left tail' },
        { id: 'middle', label: 'full blocks' },
        { id: 'right', label: 'right tail' },
        { id: 'total', label: 'answer' },
      ],
      [
        { id: 'work', label: 'work' },
        { id: 'cost' },
      ],
      [
        ['scan 2..3', 'O(block)'],
        ['read B1', 'O(blocks)'],
        ['scan 8..9', 'O(block)'],
        ['combine', 'O(sqrt n)'],
      ],
    ),
    highlight: { active: ['left:work', 'middle:work', 'right:work'], found: ['total:cost'] },
    explanation: 'With block size near sqrt(n), the worst query touches at most two tails of length sqrt(n) plus sqrt(n) full blocks. That is the balancing point.',
  };
}

function* pointUpdate() {
  yield {
    state: updateGraph('A point update touches one array cell and one block summary'),
    highlight: { active: ['idx', 'old', 'new', 'delta', 'e-old-delta', 'e-new-delta'], found: ['block'] },
    explanation: 'For sum queries, updating a[i] to a new value is cheap: compute delta, write the array cell, and add delta to the containing block sum.',
    invariant: 'Every block summary must equal the aggregate of its current array cells.',
  };

  yield {
    state: labelMatrix(
      'Update examples',
      [
        { id: 'sum', label: 'sum block' },
        { id: 'min', label: 'min block' },
        { id: 'sorted', label: 'sorted block' },
        { id: 'lazy', label: 'lazy add' },
      ],
      [
        { id: 'update', label: 'update' },
        { id: 'query' },
      ],
      [
        ['O(1) delta', 'O(sqrt n)'],
        ['recompute block', 'O(sqrt n)'],
        ['erase/insert', 'binary + shift'],
        ['tag block', 'push tails'],
      ],
    ),
    highlight: { active: ['sum:update', 'sum:query'], compare: ['min:update', 'sorted:update'], found: ['lazy:update'] },
    explanation: 'The technique is flexible because the block summary can change. Sum is simplest. Min may require rebuilding one block on update. Sorted blocks support count queries with binary search inside each full block.',
  };

  yield {
    state: updateGraph('Update the array and patch the block summary'),
    highlight: { active: ['block', 'array', 'summary', 'e-block-array', 'e-block-summary'], found: ['idx'], compare: ['delta'] },
    explanation: 'Only the containing block summary changes. This is the opposite tradeoff of a prefix-sum array, where one update can invalidate every later prefix.',
  };

  yield {
    state: labelMatrix(
      'Where sqrt decomposition fits',
      [
        { id: 'fenwick', label: 'Fenwick' },
        { id: 'sqrt', label: 'sqrt blocks' },
        { id: 'segment', label: 'segment tree' },
        { id: 'sparse', label: 'sparse table' },
      ],
      [
        { id: 'strength', label: 'strength' },
        { id: 'weakness' },
      ],
      [
        ['small code', 'mostly sums'],
        ['flexible blocks', 'sqrt cost'],
        ['general updates', 'more machinery'],
        ['O(1) static RMQ', 'no updates'],
      ],
    ),
    highlight: { active: ['sqrt:strength', 'sqrt:weakness'], compare: ['fenwick:weakness', 'segment:weakness'], found: ['sparse:strength'] },
    explanation: 'Square-root decomposition is not the fastest asymptotically, but it is often the quickest correct structure when block-local brute force plus block summaries match the workload.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'range query') yield* rangeQuery();
  else if (view === 'point update') yield* pointUpdate();
  else throw new InputError('Pick a square-root-decomposition view.');
}

export const article = {
  sections: [
    {
      heading: 'Problem',
      paragraphs: [
        'Range-query problems ask the same question over many intervals of an array: what is the sum, minimum, count, or other aggregate on [l, r]? A direct scan is easy to trust, but it repeats work every time a long range appears.',
        {type: 'callout', text: 'Square-root decomposition works by making the middle of a range cheap and keeping the messy edges small.'},
        'The harder version also allows updates. Prefix sums answer static range sums in O(1), but one point correction changes every later prefix. Square-root decomposition is the middle ground: keep enough precomputed state to skip most of a long interval, while leaving the local pieces simple.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A raw scan pays O(r - l + 1) per query. That is optimal for one query, but poor when a service, judge problem, or dashboard asks thousands of overlapping ranges.',
        'A tree can be faster, but the price is structure. Segment trees and Fenwick trees need the operation to fit their update/query contract. If the useful summary is a sorted block, a frequency table, a small histogram, or a lazy tag with occasional rebuilding, a block layout can be easier to reason about and easier to modify.',
      ],
    },
    {
      heading: 'Core mechanism',
      paragraphs: [
        'Split the array into contiguous blocks of length B. Store one summary per block. To answer a query, scan the left partial block until the next boundary, consume every full block by reading its summary, then scan the right partial block.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Row_and_column_major_order.svg', alt: 'Row-major and column-major array storage order', caption: 'Block decomposition is a layout decision over a linear array: adjacent cells are grouped so whole blocks can answer part of a query. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Row_and_column_major_order.svg.'},
        'For point updates, change the array cell and repair only the summary for the block containing that cell. For sums this is a constant-time delta update. For min, sorted blocks, or richer summaries, the containing block may need a local rebuild.',
      ],
    },
    {
      heading: 'Invariant and proof idea',
      paragraphs: [
        'The invariant is simple: every element belongs to exactly one block, and every block summary equals the aggregate of the current cells in that block. A range query is correct because it partitions [l, r] into disjoint pieces: a left tail, zero or more whole blocks, and a right tail.',
        'The cost argument is the reason for the name. A query scans at most 2B edge elements and reads at most n / B block summaries. Choosing B near sqrt(n) balances those two terms, giving O(sqrt(n)) query work for the common range-sum version.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'The animation uses 12 values split into three blocks of four. For query [2, 9], positions 2 and 3 are the left tail, block B1 covering 4..7 is a whole block, and positions 8 and 9 are the right tail. The answer is scan(2..3) + sum(B1) + scan(8..9).',
        'The point-update view uses index 6. The important thing to watch is how little changes: the array cell changes, the delta is computed, and only B1s summary is repaired. No other block summary is touched.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'In the range-query view, the array-to-block frame establishes coverage, the block-sum table shows the maintained summaries, and the [2, 9] frame shows the three-part decomposition. The highlighted middle block is the work avoided by preprocessing.',
        'In the point-update view, follow delta rather than the index. For sums, delta is enough to repair the summary. In the comparison table, notice how the same block layout changes behavior when the per-block summary changes from a sum to a min, sorted list, or lazy tag.',
      ],
    },
    {
      heading: 'Variants',
      paragraphs: [
        'For sum, a block stores one number. For min, a point update may need to recompute the whole block if the old minimum was changed. For order or threshold queries, each block can keep a sorted copy so full blocks answer by binary search while edge blocks still scan directly.',
        'For range updates, some versions store lazy tags per block and push them only when a query or partial update touches the block interior. The same invariant remains: the fast block summary must describe the logical values currently represented by the block.',
      ],
    },
    {
      heading: 'Cost and tuning',
      paragraphs: [
        'With B near sqrt(n), range sums cost O(sqrt(n)), preprocessing costs O(n), and sum point updates cost O(1). More complex summaries change the update cost: rebuilding one block is O(B), and maintaining a sorted array can need a binary search plus local movement.',
        'The best block size is workload dependent. Larger blocks reduce the number of summaries read but increase edge scans and rebuild costs. Smaller blocks make edge work cheap but force more block-summary reads. Cache locality and JavaScript array behavior can move the practical optimum away from the textbook square root.',
      ],
    },
    {
      heading: 'Real uses',
      paragraphs: [
        'This structure is useful in competitive-programming range queries, analytics dashboards with occasional corrections, offline-ish maintenance jobs, and systems where a block-local brute-force pass is cheap enough and easier to audit than a tree.',
        'It is also a good teaching bridge. It shows the central data-structure move clearly: do expensive preprocessing only where the query can consume it as a whole, and fall back to direct work where alignment is messy.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'It loses to sharper tools when the algebra is friendly. Static idempotent range minimum belongs to Sparse Table. Dynamic associative aggregates often belong to Segment Tree. Prefix-like sums with point updates usually belong to Fenwick Tree.',
        'It also fails when updates make the summary expensive or when the block-local state becomes a hidden second data structure with its own hard invariants. Blocks reduce global complexity; they do not erase local complexity.',
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        'Compute blockId = Math.floor(index / B), store block ranges explicitly or derive them from B, and centralize summary rebuilding so point updates and bulk rebuilds cannot drift. Query code should make the three regions visible: left tail, full blocks, right tail.',
        'Watch the boundary cases: l and r inside the same block, a final short block, empty ranges if the caller allows them, and summaries whose identity value matters. Most wrong implementations accidentally double-count a boundary cell or skip the final partial block.',
      ],
    },
    {
      heading: 'Rule of thumb',
      paragraphs: [
        'Use square-root decomposition when a block summary makes the middle of a query cheap and the edge work remains tolerable. It is a strong choice when the operation is awkward for a standard tree but easy inside a block.',
        'It is also a good engineering choice when clarity matters. A block array, a summary array, and a rebuild function are often easier to audit than a heavily customized segment tree with lazy propagation. The cost is that worst-case operations are usually slower than the sharpest specialized structure.',
        'A useful test is whether you can explain the block invariant in one sentence. If each block summary has become a complicated mini-database, the decomposition may still work, but it no longer has the simplicity that made it attractive.',
        'When in doubt, implement the direct scan, then the block version, and compare on the real query mix. Square-root decomposition is often chosen because its constants and cache behavior are good enough, not because its asymptotic bound is the best possible.',
      ],
    },
    {
      heading: 'Worked production example',
      paragraphs: [
        'Imagine a dashboard storing per-minute counters for a few weeks. Most queries ask for totals over ranges, and occasional corrections fix one minute. Blocks of a few hundred minutes let the dashboard sum long middle regions from block totals while scanning only the edges. A correction updates one cell and one block total.',
        'If the dashboard later asks for percentile, top-k, or distinct-count summaries, the same block idea can still help, but each block summary becomes more complex. That is the decision point: keep block-local complexity manageable, or move to a data structure designed for that specific aggregate.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: CP-Algorithms sqrt decomposition at https://cp-algorithms.com/data_structures/sqrt_decomposition.html, USACO Guide square-root decomposition at https://usaco.guide/plat/sqrt, and Codeforces square-root decomposition applications at https://codeforces.com/blog/entry/83248.',
        'Study Fenwick Tree for prefix-like updates, Segment Tree for general dynamic associative queries, Sparse Table and Disjoint Sparse Table for static range queries, and Mo\'s Algorithm for offline range-query reordering.',
      ],
    },
  ],
};
