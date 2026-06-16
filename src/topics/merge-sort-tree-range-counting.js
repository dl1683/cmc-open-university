// Merge-sort trees store a sorted catalog at every segment-tree node, turning
// range counting into canonical range decomposition plus binary search.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'merge-sort-tree-range-counting',
  title: 'Merge-Sort Tree Range Counting',
  category: 'Data Structures',
  summary: 'Store a sorted list at every segment-tree node so static range count, successor, and kth-style queries become searches over canonical catalogs.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['range count', 'fractional cascading'], defaultValue: 'range count' },
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

function treeGraph(title) {
  return graphState({
    nodes: [
      { id: 'root', label: '[0..7]', x: 4.8, y: 0.9, note: '1,2,3,4,5,6,7,8' },
      { id: 'left', label: '[0..3]', x: 2.7, y: 2.7, note: '2,3,5,7' },
      { id: 'right', label: '[4..7]', x: 6.9, y: 2.7, note: '1,4,6,8' },
      { id: 'a', label: '[0..1]', x: 1.5, y: 4.6, note: '3,7' },
      { id: 'b', label: '[2..3]', x: 3.7, y: 4.6, note: '2,5' },
      { id: 'c', label: '[4..5]', x: 5.9, y: 4.6, note: '1,6' },
      { id: 'd', label: '[6..7]', x: 8.1, y: 4.6, note: '4,8' },
      { id: 'query', label: 'query', x: 4.8, y: 6.6, note: '[2..6], <=5' },
    ],
    edges: [
      { id: 'e-root-left', from: 'root', to: 'left' },
      { id: 'e-root-right', from: 'root', to: 'right' },
      { id: 'e-left-a', from: 'left', to: 'a' },
      { id: 'e-left-b', from: 'left', to: 'b' },
      { id: 'e-right-c', from: 'right', to: 'c' },
      { id: 'e-right-d', from: 'right', to: 'd' },
      { id: 'e-query-b', from: 'query', to: 'b' },
      { id: 'e-query-c', from: 'query', to: 'c' },
      { id: 'e-query-d', from: 'query', to: 'd' },
    ],
  }, { title });
}

function bridgeGraph(title) {
  return graphState({
    nodes: [
      { id: 'x', label: 'x=5', x: 0.9, y: 3.4, note: 'same key' },
      { id: 'n1', label: '[2..3]', x: 2.8, y: 1.6, note: '2,5' },
      { id: 'n2', label: '[4..5]', x: 4.8, y: 3.2, note: '1,6' },
      { id: 'n3', label: '[6..6]', x: 6.8, y: 4.8, note: '4' },
      { id: 'ans', label: 'sum', x: 8.7, y: 3.4, note: 'counts add' },
    ],
    edges: [
      { id: 'e-x-n1', from: 'x', to: 'n1' },
      { id: 'e-n1-n2', from: 'n1', to: 'n2' },
      { id: 'e-n2-n3', from: 'n2', to: 'n3' },
      { id: 'e-n3-ans', from: 'n3', to: 'ans' },
    ],
  }, { title });
}

function* rangeCount() {
  yield {
    state: treeGraph('Every segment node stores a sorted catalog'),
    highlight: { active: ['root', 'left', 'right'], found: ['a', 'b', 'c', 'd'] },
    explanation: 'A merge-sort tree is a segment tree where every node stores the values in its interval as a sorted list. Construction is exactly the merge step from Merge Sort applied at every internal node.',
    invariant: 'Each array value appears in one node per level, so total storage is O(n log n).',
  };

  yield {
    state: treeGraph('Range [2..6] decomposes into canonical nodes'),
    highlight: { active: ['query', 'b', 'c', 'd', 'e-query-b', 'e-query-c', 'e-query-d'], compare: ['a'], found: ['root'] },
    explanation: 'The range query does not scan positions one by one. It decomposes the interval into O(log n) disjoint segment-tree nodes, then searches each node catalog.',
  };

  yield {
    state: labelMatrix(
      'Count values <= 5 in query catalogs',
      [
        { id: 'b', label: '[2..3]' },
        { id: 'c', label: '[4..5]' },
        { id: 'd', label: '[6..6]' },
        { id: 'total', label: 'total' },
      ],
      [
        { id: 'catalog', label: 'sorted catalog' },
        { id: 'count', label: '<= 5' },
      ],
      [
        ['2,5', '2'],
        ['1,6', '1'],
        ['4', '1'],
        ['add counts', '4'],
      ],
    ),
    highlight: { active: ['b:count', 'c:count', 'd:count'], found: ['total:count'] },
    explanation: 'Each catalog answer is one Binary Search. The range count is the sum of those local counts.',
  };

  yield {
    state: labelMatrix(
      'Cost model',
      [
        { id: 'build', label: 'build' },
        { id: 'space', label: 'space' },
        { id: 'count', label: 'count <= x' },
        { id: 'update', label: 'point update' },
      ],
      [
        { id: 'cost', label: 'cost' },
        { id: 'reason' },
      ],
      [
        ['O(n log n)', 'merge catalogs'],
        ['O(n log n)', 'one copy per level'],
        ['O(log^2 n)', 'nodes times search'],
        ['expensive', 'catalog maintenance'],
      ],
    ),
    highlight: { found: ['count:cost'], compare: ['update:cost'], active: ['build:reason'] },
    explanation: 'Merge-sort trees shine for static arrays or batched rebuilds. Fully dynamic updates require balanced containers in each node or a different structure.',
  };
}

function* fractionalCascading() {
  yield {
    state: bridgeGraph('Same x is searched across every visited catalog'),
    highlight: { active: ['x', 'n1', 'n2', 'n3'], found: ['ans'] },
    explanation: 'The query value x is identical for all canonical nodes. That repeated-search pattern is exactly where Fractional Cascading can remove most binary searches.',
    invariant: 'The catalogs are related by the segment-tree structure and mostly static.',
  };

  yield {
    state: labelMatrix(
      'Without and with bridges',
      [
        { id: 'plain', label: 'plain tree' },
        { id: 'bridged', label: 'with bridges' },
        { id: 'successor', label: 'successor query' },
        { id: 'kth', label: 'kth by value' },
      ],
      [
        { id: 'query', label: 'query plan' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['O(log n) catalogs * binary search', 'simple'],
        ['one search, then pointers', 'more metadata'],
        ['min across node candidates', 'natural fit'],
        ['usually use Wavelet Tree instead', 'cleaner'],
      ],
    ),
    highlight: { active: ['plain:query', 'bridged:query'], found: ['successor:query'], compare: ['kth:tradeoff'] },
    explanation: 'Fractional cascading augments catalogs with bridge positions. It is excellent for range successor and count-style searches when the array is static enough.',
  };

  yield {
    state: bridgeGraph('Bridge pointers carry the search position forward'),
    highlight: { active: ['e-x-n1', 'e-n1-n2', 'e-n2-n3', 'n1', 'n2'], compare: ['x'], found: ['ans'] },
    explanation: 'After one full binary search, each next catalog starts near the correct rank. A small local adjustment gives the count or successor position for that node.',
  };

  yield {
    state: labelMatrix(
      'Choosing among neighbors',
      [
        { id: 'fenwick', label: 'Fenwick Tree' },
        { id: 'segment', label: 'Segment Tree' },
        { id: 'mst', label: 'merge-sort tree' },
        { id: 'wavelet', label: 'Wavelet Tree' },
      ],
      [
        { id: 'best_for', label: 'best for' },
        { id: 'limit' },
      ],
      [
        ['prefix sums', 'not value ranks'],
        ['dynamic aggregates', 'one summary per node'],
        ['static range values', 'O(n log n) space'],
        ['static rank/select/quantile', 'more specialized'],
      ],
    ),
    highlight: { active: ['mst:best_for'], found: ['wavelet:best_for'], compare: ['fenwick:limit', 'segment:limit'] },
    explanation: 'The structure belongs between general Segment Tree ideas and succinct sequence indexes. It is often the easiest way to understand why Wavelet Tree is useful.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'range count') yield* rangeCount();
  else if (view === 'fractional cascading') yield* fractionalCascading();
  else throw new InputError('Pick a merge-sort tree view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A merge-sort tree is a static range-query structure built on top of a segment tree. Instead of storing one aggregate at each node, every node stores a sorted catalog of all values in that interval. A query decomposes an index range into canonical segment-tree nodes, then uses Binary Search inside each selected catalog.',
        'This topic connects Segment Tree & Lazy Propagation, Merge Sort, Binary Search, Fractional Cascading, and Wavelet Tree. The name is literal: the build process merges sorted child catalogs just like merge sort, but keeps every intermediate catalog as queryable data.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Build the normal segment-tree shape over array positions. At a leaf, the catalog is the one value at that position. At an internal node, merge the sorted catalogs of its two children. Because the tree has O(log n) levels and every level stores n total values, the total memory is O(n log n).',
        'To answer count of values <= x in range [l, r], decompose [l, r] into O(log n) disjoint nodes. For each node, binary-search its sorted catalog to count entries <= x. Add those counts. A range successor query is similar: search each selected catalog for the first value >= x, then take the minimum candidate.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Build time is O(n log n) with straightforward merging. Space is O(n log n). A range counting query is O(log^2 n): O(log n) canonical nodes times O(log n) search per catalog. Fractional cascading can reduce repeated searches for the same key across related catalogs, trading more metadata and build complexity for faster queries.',
        'Point updates are the weak spot. In a plain array-backed implementation, changing one value means removing and inserting it in O(log n) catalogs. That is awkward unless each catalog is a balanced multiset or the whole structure is rebuilt in batches.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Suppose an analytics dashboard has a static snapshot of customer order amounts and must answer thousands of questions like: how many orders between days 20 and 80 were at most $50? A Fenwick Tree can aggregate sums, but it cannot answer value-rank questions inside an index interval. A merge-sort tree stores the order values by time range and answers each count with catalog searches.',
        'The same design also answers range successor: find the cheapest order at least $50 in a time window. The query visits canonical nodes for the time window, finds one successor candidate in each sorted catalog, and returns the smallest candidate. If that workload dominates and the snapshot is static, the structure is much cleaner than maintaining per-query scans.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A merge-sort tree is not just a Segment Tree & Lazy Propagation with a different merge function. Lazy propagation assumes each node stores a compact aggregate and tags can update whole intervals. Sorted catalogs are not compact under arbitrary value updates, so the dynamic story changes. Another trap is using it when a Wavelet Tree is the better static rank/select structure.',
        'It is also not a replacement for Square-Root Decomposition Range Queries when implementation speed matters more than asymptotics. Square-root blocks are often easier to code for moderate n. Merge-sort trees are useful when static range value queries are central enough to justify O(n log n) space.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary study links: CP-Algorithms Segment Tree notes cover sorted lists at nodes and fractional cascading at https://cp-algorithms.com/data_structures/segment_tree.html, Chazelle and Guibas introduce Fractional Cascading at https://www.cs.princeton.edu/~chazelle/pubs/FractionalCascading1.pdf, and MIT 6.851 range searching notes discuss nested range structures at https://courses.csail.mit.edu/6.851/spring10/scribe/lec03.pdf. Study Segment Tree & Lazy Propagation, Fractional Cascading, Wavelet Tree, Square-Root Decomposition Range Queries, and 2D Fenwick Tree & Coordinate Compression next.',
      ],
    },
  ],
};
