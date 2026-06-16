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
      heading: 'What it is',
      paragraphs: [
        'Square-root decomposition splits an array into blocks of length about sqrt(n) and stores a summary for each block. A range query scans the partial block on the left edge, reads summaries for fully covered blocks, scans the partial block on the right edge, and combines the pieces.',
        'This topic builds on Fenwick Tree, Sliding Window, Big-O Growth, and Binary Search. It is the block-based bridge between prefix arrays and segment trees. You give up logarithmic query time, but gain a structure that is easy to adapt when each block can answer a custom local question.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For range sums, choose block size s = ceil(sqrt(n)). Build an array of block sums. Query [l, r] by scanning elements until the next block boundary, adding whole block sums while a complete block fits, then scanning the remaining tail. A point update computes delta = new - old, writes a[i], and adds delta to the corresponding block sum.',
        'The same layout supports other summaries. For range minimum with point updates, a block can store its current minimum and rebuild one block when the updated element may have changed it. For order statistics or count-greater-than queries, each block can store a sorted copy. For range add and point query, blocks can carry lazy tags. The common pattern is full blocks are cheap, edges are brute force.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'With block size around sqrt(n), a range query costs O(sqrt(n)): at most two edge scans plus at most sqrt(n) full blocks. Sum point updates are O(1). More complex block summaries may cost O(sqrt(n)) to rebuild or O(log n) plus local movement inside a sorted block. Space is O(n) for the raw array plus block summaries, or more if each block stores auxiliary sorted data.',
        'The block size is a tuning knob, not a law. Larger blocks reduce the number of summaries but make edge scans and rebuilds slower. Smaller blocks reduce edge work but increase whole-block scans. The best value depends on n, operation mix, cache behavior, and the summary stored per block.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Suppose a dashboard keeps an array of per-minute request counts for one day and supports point corrections plus range total queries. A prefix-sum array answers totals quickly but every correction invalidates later prefixes. A Fenwick tree is cleaner for this pure sum workload. Square-root decomposition is the teaching bridge: one correction patches one minute and one block sum; a range query reads complete hour-like blocks and scans only the ends.',
        'In contest and analytics-style problems, sqrt decomposition becomes more valuable when each block can maintain richer local data. For example, each block can keep a sorted list to count values greater than a threshold inside a range. Full blocks answer by binary search; edge blocks scan directly. Segment trees can solve many of these tasks too, but the block version is often shorter and easier to reason about.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The first trap is assuming sqrt decomposition is only for sums. The real idea is splitting work into full blocks plus tails. The second trap is ignoring update cost for the chosen summary. A block sum patches in O(1), but a sorted block may require removal and insertion, and a min block may need a local rebuild.',
        'Another mistake is using it when the algebra gives a sharper tool. Static idempotent range minimum belongs to Sparse Table. Dynamic associative range queries usually belong to Segment Tree. Prefix sums with point updates belong to Fenwick Tree. Sqrt decomposition earns its place when flexibility and implementation simplicity matter more than the asymptotic best bound.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: CP-Algorithms sqrt decomposition at https://cp-algorithms.com/data_structures/sqrt_decomposition.html, USACO Guide square-root decomposition at https://usaco.guide/plat/sqrt, and Codeforces square-root decomposition applications at https://codeforces.com/blog/entry/83248. Study Fenwick Tree, Segment Tree & Lazy Propagation, Sparse Table, Disjoint Sparse Table, and Mo\'s Algorithm next.',
      ],
    },
  ],
};
