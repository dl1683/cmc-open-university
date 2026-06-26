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
  const arraySize = 8;
  const queryLeft = 2;
  const queryRight = 6;
  const threshold = 5;
  const canonicalNodes = 3;
  const totalCount = 4;

  yield {
    state: treeGraph('Every segment node stores a sorted catalog'),
    highlight: { active: ['root', 'left', 'right'], found: ['a', 'b', 'c', 'd'] },
    explanation: `A merge-sort tree is a segment tree where every node stores the values in its interval as a sorted list. This ${arraySize}-element array is split recursively; construction is exactly the merge step from Merge Sort applied at every internal node.`,
    invariant: `Each of the ${arraySize} array values appears in one node per level, so total storage is O(n log n).`,
  };

  yield {
    state: treeGraph('Range [2..6] decomposes into canonical nodes'),
    highlight: { active: ['query', 'b', 'c', 'd', 'e-query-b', 'e-query-c', 'e-query-d'], compare: ['a'], found: ['root'] },
    explanation: `The range query [${queryLeft}..${queryRight}] does not scan positions one by one. It decomposes the interval into ${canonicalNodes} disjoint segment-tree nodes, then binary-searches each node's sorted catalog for values <= ${threshold}.`,
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
    explanation: `Each catalog answer is one binary search for values <= ${threshold}. The ${canonicalNodes} local counts sum to ${totalCount}, the final range count.`,
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
    explanation: `Merge-sort trees shine for static arrays or batched rebuilds. With ${arraySize} elements the O(n log n) build is modest, but fully dynamic updates require balanced containers in each node or a different structure.`,
  };
}

function* fractionalCascading() {
  const catalogCount = 3;
  const searchKey = 5;
  const neighborStructures = 4;

  yield {
    state: bridgeGraph('Same x is searched across every visited catalog'),
    highlight: { active: ['x', 'n1', 'n2', 'n3'], found: ['ans'] },
    explanation: `The query value x = ${searchKey} is identical for all ${catalogCount} canonical nodes. That repeated-search pattern is exactly where Fractional Cascading can remove most binary searches.`,
    invariant: `All ${catalogCount} catalogs are related by the segment-tree structure and mostly static, making bridge pointers feasible.`,
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
    explanation: `Fractional cascading augments all ${catalogCount} catalogs with bridge positions. Instead of ${catalogCount} independent binary searches for x = ${searchKey}, one full search plus pointer walks suffices.`,
  };

  yield {
    state: bridgeGraph('Bridge pointers carry the search position forward'),
    highlight: { active: ['e-x-n1', 'e-n1-n2', 'e-n2-n3', 'n1', 'n2'], compare: ['x'], found: ['ans'] },
    explanation: `After one full binary search in the first catalog, the remaining ${catalogCount - 1} catalogs start near the correct rank via bridge pointers. A small local adjustment gives the count or successor position for each node.`,
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
    explanation: `Among these ${neighborStructures} structures, the merge-sort tree sits between general segment trees and succinct sequence indexes. It is often the easiest way to understand why a Wavelet Tree is useful.`,
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
    { heading: 'How to read the animation', paragraphs: [
        'The range-count view shows a segment tree over array positions. Active nodes are the canonical nodes that exactly cover the query range, and each selected node owns a sorted catalog of values. The fractional-cascading view shows one search key carried across catalogs instead of restarting every binary search.',
        {type: 'image', src: './assets/gifs/merge-sort-tree-range-counting.gif', alt: 'Animated walkthrough of the merge sort tree range counting visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ], },
    { heading: 'Why this exists', paragraphs: [
        'Some range queries ask about both position and value. For example, count how many orders between days 20 and 80 were at most 50 dollars. A merge-sort tree answers this by combining segment-tree position coverage with sorted value catalogs.',
        {type: 'callout', text: 'A merge-sort tree is a two-axis index: the tree chooses positions, and each sorted catalog answers value thresholds.'},
      ], },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious approach scans arr[l..r] and counts matching values. That is fine for one small query but costs O(r-l+1) every time. A normal segment tree stores one aggregate per node, which is not enough to answer value-threshold counts.',
      ], },
    { heading: 'The wall', paragraphs: [
        'The wall is the two-axis nature of the problem. Sorting by value loses the original position interval, while segmenting by position loses sorted value order. Updates are another wall because every changed value must be repaired inside several sorted catalogs.',
      ], },
    { heading: 'The core insight', paragraphs: [
        'Keep both axes. Use a segment tree for position ranges, and store each node interval as a sorted list. A query decomposes [l, r] into O(log n) disjoint nodes, then binary-searches each catalog for the value threshold.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Merge_sort_algorithm_diagram.svg/600px-Merge_sort_algorithm_diagram.svg.png', alt: 'Merge sort diagram showing sorted runs merging into larger runs', caption: 'The build keeps every intermediate merge result instead of discarding it after sorting. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Merge_sort_algorithm_diagram.svg.'},
      ], },
    { heading: 'How it works', paragraphs: [
        'Build leaves with one value each. An internal catalog is the sorted merge of its two child catalogs, so every node stores exactly the multiset for its interval. To count values <= x in [l, r], decompose the range and use upper_bound(x) in every selected catalog.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/f/f7/Binary_tree.svg', alt: 'Binary tree diagram with parent and child nodes', caption: 'The position index is a binary range tree; each selected node owns one disjoint interval. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Binary_tree.svg.'},
      ], },
    { heading: 'Why it works', paragraphs: [
        'The segment-tree cover is disjoint and complete, so every queried position appears in exactly one selected node. Each catalog contains exactly the values for that node interval. Binary search counts the values satisfying the threshold inside each interval, and disjoint counts add without double-counting.',
      ], },
    { heading: 'Cost and complexity', paragraphs: [
        'Build time and space are O(n log n) because every level stores n total values. A plain range count query is O(log^2 n): O(log n) selected nodes times O(log n) binary search. Fractional cascading can reduce repeated searches but adds bridge metadata and makes updates harder.',
      ], },
    { heading: 'Real-world uses', paragraphs: [
        'Merge-sort trees fit static snapshots with many threshold, successor, predecessor, or value-range queries. They are common in analytics snapshots and programming-contest range-search problems. They also teach the idea behind wavelet trees in a more direct form.',
      ], },
    { heading: 'Where it fails', paragraphs: [
        'Frequent updates are the main failure because one value change affects O(log n) sorted catalogs. The structure can also be too memory-heavy compared with Fenwick trees, ordinary segment trees, or wavelet trees. Mutable database-style workloads usually need a different index.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/65/B-tree.svg', alt: 'B-tree with grouped sorted keys in internal nodes', caption: 'Mutable database indexes solve a broader problem than a static merge-sort tree, including inserts, deletes, and changing row order. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:B-tree.svg.'},
      ], },
    { heading: 'Worked example', paragraphs: [
        'For array [7, 3, 5, 2, 6, 1, 4, 8], query positions [2..6] with threshold 5. A canonical cover can be [2..3], [4..5], and [6..6], with catalogs [2,5], [1,6], and [4]. upper_bound(5) gives counts 2, 1, and 1, so the answer is 4.',
      ], },
    { heading: 'Sources and study next', paragraphs: [
        'Start with segment tree notes that cover sorted lists at nodes and fractional cascading, such as CP-Algorithms. Read Chazelle and Guibas on fractional cascading for the repeated-search optimization. Study segment trees, binary-search boundaries, wavelet trees, Fenwick trees, coordinate compression, and square-root decomposition next.',
      ], },
  ],
};
