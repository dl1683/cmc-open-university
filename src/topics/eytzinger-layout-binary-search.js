// Eytzinger layout: store sorted keys in breadth-first binary-search-tree order
// so repeated searches get predictable branches and cache prefetch behavior.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'eytzinger-layout-binary-search',
  title: 'Eytzinger Layout Binary Search',
  category: 'Data Structures',
  summary: 'A cache-aware sorted-array layout: place keys in heap/BFS order and search with predictable child indices.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['layout transform', 'search path'], defaultValue: 'layout transform' },
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

function tree(title) {
  return graphState({
    nodes: [
      { id: 'n1', label: '8', x: 4.9, y: 0.9, note: 'index 1' },
      { id: 'n2', label: '4', x: 2.6, y: 2.6, note: 'index 2' },
      { id: 'n3', label: '12', x: 7.2, y: 2.6, note: 'index 3' },
      { id: 'n4', label: '2', x: 1.3, y: 4.8, note: 'index 4' },
      { id: 'n5', label: '6', x: 3.8, y: 4.8, note: 'index 5' },
      { id: 'n6', label: '10', x: 6.0, y: 4.8, note: 'index 6' },
      { id: 'n7', label: '14', x: 8.4, y: 4.8, note: 'index 7' },
    ],
    edges: [
      { id: 'e1-2', from: 'n1', to: 'n2', weight: 'left=2i' },
      { id: 'e1-3', from: 'n1', to: 'n3', weight: 'right=2i+1' },
      { id: 'e2-4', from: 'n2', to: 'n4', weight: 'left' },
      { id: 'e2-5', from: 'n2', to: 'n5', weight: 'right' },
      { id: 'e3-6', from: 'n3', to: 'n6', weight: 'left' },
      { id: 'e3-7', from: 'n3', to: 'n7', weight: 'right' },
    ],
  }, { title });
}

function* layoutTransform() {
  yield {
    state: labelMatrix(
      'Same sorted keys, different memory order',
      [
        { id: 'sorted', label: 'sorted array' },
        { id: 'eytz', label: 'Eytzinger array' },
        { id: 'meaning', label: 'tree meaning' },
      ],
      [
        { id: 'i0', label: '0' },
        { id: 'i1', label: '1' },
        { id: 'i2', label: '2' },
        { id: 'i3', label: '3' },
        { id: 'i4', label: '4' },
        { id: 'i5', label: '5' },
        { id: 'i6', label: '6' },
      ],
      [
        ['2', '4', '6', '8', '10', '12', '14'],
        ['8', '4', '12', '2', '6', '10', '14'],
        ['root', 'left', 'right', 'LL', 'LR', 'RL', 'RR'],
      ],
    ),
    highlight: { active: ['sorted:i3', 'eytz:i0'], found: ['meaning:i0'] },
    explanation: 'Eytzinger layout stores the sorted keys as an implicit complete binary-search tree in breadth-first order. The median becomes the root, then child subtrees follow like a heap.',
  };

  yield {
    state: tree('Heap-like child indices give a branch path'),
    highlight: { active: ['n1', 'n2', 'n3'], found: ['e1-2', 'e1-3'] },
    explanation: 'Search starts at index 1 in the one-based view. At node i, go left to 2i or right to 2i+1. That regular index arithmetic is why the layout is friendly to prefetching.',
    invariant: 'The sorted order is in the tree relation, not in adjacent memory cells.',
  };

  yield {
    state: labelMatrix(
      'Why it can beat ordinary binary search',
      [
        { id: 'branch', label: 'branch prediction' },
        { id: 'cache', label: 'cache misses' },
        { id: 'prefetch', label: 'prefetch' },
        { id: 'small', label: 'small arrays' },
      ],
      [
        { id: 'ordinary', label: 'ordinary sorted array' },
        { id: 'eytzinger', label: 'Eytzinger layout' },
      ],
      [
        ['hard-to-predict mid jumps', 'regular child path'],
        ['jumps across array', 'BFS packs upper levels'],
        ['less obvious', 'children addresses predictable'],
        ['often already cached', 'layout overhead may not matter'],
      ],
    ),
    highlight: { found: ['cache:eytzinger', 'prefetch:eytzinger'], compare: ['small:ordinary'] },
    explanation: 'The asymptotic complexity is still O(log n). The improvement is mechanical sympathy: fewer painful cache stalls and more predictable memory access for repeated searches.',
  };

  yield {
    state: labelMatrix(
      'Build by inorder fill',
      [
        { id: 'left', label: 'fill left subtree' },
        { id: 'root', label: 'write root' },
        { id: 'right', label: 'fill right subtree' },
        { id: 'array', label: 'array position' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['recurse to 2i', 'smaller keys'],
        ['write next sorted key at i', 'inorder property'],
        ['recurse to 2i+1', 'larger keys'],
        ['BFS index receives inorder value', 'search tree in array'],
      ],
    ),
    highlight: { active: ['left:rule', 'root:rule', 'right:rule'], found: ['array:effect'] },
    explanation: 'To build the layout, walk the implicit tree in inorder while consuming the sorted array. The result preserves binary-search order through parent/child relationships.',
  };
}

function* searchPath() {
  yield {
    state: tree('Search lower_bound(11)'),
    highlight: { active: ['n1', 'n3', 'n6'], compare: ['e1-3', 'e3-6'] },
    explanation: 'For lower_bound(11), compare 11 with 8 and go right. Compare with 12 and record it as a candidate, then go left to 10. Since 10 is too small, the candidate 12 wins.',
  };

  yield {
    state: labelMatrix(
      'Search trace',
      [
        { id: 'step1', label: 'index 1 value 8' },
        { id: 'step2', label: 'index 3 value 12' },
        { id: 'step3', label: 'index 6 value 10' },
        { id: 'answer', label: 'answer' },
      ],
      [
        { id: 'comparison', label: 'comparison' },
        { id: 'move', label: 'move' },
        { id: 'candidate', label: 'candidate' },
      ],
      [
        ['11 > 8', 'right to 3', 'none'],
        ['11 <= 12', 'left to 6', '12'],
        ['11 > 10', 'right past leaf', '12'],
        ['smallest >= 11', 'stop', '12'],
      ],
    ),
    highlight: { active: ['step1:move', 'step2:candidate', 'step3:move'], found: ['answer:candidate'] },
    explanation: 'The logical comparisons are ordinary binary search. The difference is the memory path: 1, 3, 6 are heap-style indices rather than midpoints in a sorted array.',
  };

  yield {
    state: labelMatrix(
      'Layout choices for repeated lookup',
      [
        { id: 'sorted', label: 'sorted order' },
        { id: 'eytz', label: 'Eytzinger' },
        { id: 'btree', label: 'implicit B-tree' },
        { id: 'veb', label: 'van Emde Boas' },
      ],
      [
        { id: 'strength', label: 'strength' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['simple and compact', 'branch/cache stalls on large arrays'],
        ['fast in RAM with prefetch', 'rebuild layout for sorted data'],
        ['cache-line block search', 'more complex'],
        ['cache-oblivious recursion', 'complex layout'],
      ],
    ),
    highlight: { found: ['eytz:strength'], compare: ['btree:tradeoff', 'veb:tradeoff'] },
    explanation: 'Eytzinger is one member of a layout family. The surprising lesson from the paper is that a simple heap-order layout can be very competitive on modern hardware.',
  };

  yield {
    state: tree('Final frame: tree order, array storage'),
    highlight: { found: ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7'] },
    explanation: 'The final mental model: keep the binary-search-tree relation, but store it in array order that the processor can walk predictably.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'layout transform') yield* layoutTransform();
  else if (view === 'search path') yield* searchPath();
  else throw new InputError('Pick an Eytzinger layout view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Eytzinger layout stores sorted keys in the breadth-first order of an implicit binary search tree. Instead of a sorted array [2, 4, 6, 8, 10, 12, 14], the Eytzinger array stores [8, 4, 12, 2, 6, 10, 14]. Search starts at the root and uses heap-style child indices: left child 2i, right child 2i+1 in the one-based view.',
        'The paper Array Layouts for Comparison-Based Searching compares sorted order, Eytzinger layout, implicit B-tree layout, and van Emde Boas layout for repeated in-RAM searches, finding Eytzinger surprisingly strong for large arrays on modern hardware: https://arxiv.org/abs/1509.05053. The ACM DOI is https://dl.acm.org/doi/10.1145/3053370.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The layout is built by doing an inorder traversal over the implicit tree while consuming the sorted keys. That preserves the binary-search-tree invariant: everything in the left subtree is smaller, everything in the right subtree is larger. But memory order is breadth-first, so the upper levels of the tree are packed near the beginning of the array.',
        'Search is still logarithmic. At each node, compare the query with the node key and jump to one of two predictable child indices. For lower_bound, record a candidate whenever the current key is greater than or equal to the query, then move left. If the query is larger, move right. When the index runs past the array, return the last candidate.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Asymptotically, Eytzinger search is O(log n), the same as ordinary binary search. The difference is cache and branch behavior. Ordinary binary search jumps to midpoints that can be difficult for hardware prefetchers and branch predictors. Eytzinger search follows regular child indices, so implementations can prefetch likely descendants and use branch-friendly or branchless comparisons.',
        'The cost is layout conversion and update difficulty. If the set changes frequently, maintaining Eytzinger order is inconvenient. If the array is small enough to stay hot in cache, ordinary sorted order may be as good or better. Eytzinger is a read-heavy, many-queries-over-one-array optimization.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The pattern matters in database indexes, analytics engines, search structures, routing tables, and any service that repeatedly searches static sorted arrays. It is a clean example of how Big-O Growth Rates can hide hardware costs: O(log n) algorithms with the same comparison count can behave differently because cache misses, branch mispredictions, and prefetchability dominate.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not confuse Eytzinger layout with a heap priority queue. The array index relation looks heap-like, but the values satisfy binary-search-tree order, not heap order. Do not expect it to help every lookup. The win appears in specific hardware and workload regimes: many searches, large read-only arrays, and implementations tuned for prefetch and branch behavior.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Array Layouts for Comparison-Based Searching at https://arxiv.org/abs/1509.05053 and ACM DOI https://dl.acm.org/doi/10.1145/3053370. Study Binary Search, Binary Heap, B-Trees, van Emde Boas Tree, Learned Indexes, and Database Indexing next.',
      ],
    },
  ],
};
