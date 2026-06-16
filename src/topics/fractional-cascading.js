// Fractional cascading: one binary search, then constant-time bridges through
// related sorted catalogs.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'fractional-cascading',
  title: 'Fractional Cascading',
  category: 'Data Structures',
  summary: 'Speed up repeated searches for the same key across related sorted lists by copying samples forward and storing bridge pointers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['catalog bridges', 'segment tree queries'], defaultValue: 'catalog bridges' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function catalogGraph(title) {
  return graphState({
    nodes: [
      { id: 'q', label: 'query x=50', x: 0.8, y: 4.0, note: 'one value' },
      { id: 'm1', label: 'M1', x: 2.8, y: 1.5, note: 'augmented list' },
      { id: 'm2', label: 'M2', x: 4.8, y: 2.8, note: 'bridge from M1' },
      { id: 'm3', label: 'M3', x: 6.8, y: 4.1, note: 'bridge from M2' },
      { id: 'm4', label: 'M4', x: 8.8, y: 5.4, note: 'last catalog' },
      { id: 'ans', label: 'positions', x: 9.2, y: 2.0, note: 'one per list' },
    ],
    edges: [
      { id: 'e-q-m1', from: 'q', to: 'm1', weight: 'binary search' },
      { id: 'e-m1-m2', from: 'm1', to: 'm2', weight: 'bridge' },
      { id: 'e-m2-m3', from: 'm2', to: 'm3', weight: 'bridge' },
      { id: 'e-m3-m4', from: 'm3', to: 'm4', weight: 'bridge' },
      { id: 'e-m4-ans', from: 'm4', to: 'ans', weight: 'report' },
    ],
  }, { title });
}

function* catalogBridges() {
  yield {
    state: labelMatrix(
      'Naive repeated search',
      [
        { id: 'l1', label: 'L1' },
        { id: 'l2', label: 'L2' },
        { id: 'l3', label: 'L3' },
        { id: 'l4', label: 'L4' },
      ],
      [{ id: 'list', label: 'sorted list' }, { id: 'work', label: 'work for x=50' }],
      [
        ['24,64,65,80,93', 'binary search'],
        ['23,25,26', 'binary search'],
        ['13,44,62,66', 'binary search'],
        ['11,35,46,79,81', 'binary search'],
      ],
    ),
    highlight: { active: ['l1:work', 'l2:work', 'l3:work', 'l4:work'] },
    explanation: 'The problem fractional cascading solves is repeated predecessor or successor search for the same value across related sorted lists. Searching each list independently costs k binary searches.',
    invariant: 'The query value is the same; only the catalog changes.',
  };

  yield {
    state: catalogGraph('Copy a fraction of each later catalog backward'),
    highlight: { active: ['m1', 'm2', 'm3', 'm4', 'e-m1-m2', 'e-m2-m3'], compare: ['q'] },
    explanation: 'Fractional cascading augments each catalog with sampled items from the next catalog. Each augmented item stores bridge positions into its own original list and the next augmented list.',
  };

  yield {
    state: labelMatrix(
      'Query x=50 after preprocessing',
      [
        { id: 'first', label: 'M1' },
        { id: 'second', label: 'M2' },
        { id: 'third', label: 'M3' },
        { id: 'fourth', label: 'M4' },
      ],
      [{ id: 'operation', label: 'operation' }, { id: 'cost', label: 'cost' }],
      [
        ['binary search once', 'O(log n)'],
        ['follow pointer, adjust locally', 'O(1)'],
        ['follow pointer, adjust locally', 'O(1)'],
        ['follow pointer, adjust locally', 'O(1)'],
      ],
    ),
    highlight: { found: ['first:cost', 'second:cost', 'third:cost', 'fourth:cost'] },
    explanation: 'After the first binary search, every later catalog starts near the answer. A constant number of comparisons fixes the position in each list.',
    invariant: 'Query time becomes O(log n + k) instead of O(k log n).',
  };

  yield {
    state: labelMatrix(
      'What the extra pointers buy',
      [
        { id: 'space', label: 'space' },
        { id: 'build', label: 'build' },
        { id: 'query', label: 'query' },
        { id: 'updates', label: 'updates' },
      ],
      [{ id: 'effect', label: 'effect' }, { id: 'tradeoff', label: 'tradeoff' }],
      [
        ['linear extra samples', 'more metadata'],
        ['merge lists with bridges', 'preprocessing cost'],
        ['one search plus bridges', 'fast repeated search'],
        ['harder dynamically', 'maintenance complexity'],
      ],
    ),
    highlight: { found: ['query:effect'], compare: ['updates:tradeoff'] },
    explanation: 'This is a classic space-for-query-time structure. It is elegant when catalogs are static or rebuilt in batches, and less attractive when every list changes constantly.',
  };
}

function* segmentTreeQueries() {
  yield {
    state: labelMatrix(
      'Merge-sort tree range query',
      [
        { id: 'node1', label: 'node [0,3]' },
        { id: 'node2', label: 'node [4,7]' },
        { id: 'node3', label: 'node [8,11]' },
        { id: 'node4', label: 'node [12,15]' },
      ],
      [{ id: 'catalog', label: 'sorted catalog' }, { id: 'query', label: 'count <= x' }],
      [
        ['2,5,7,9', 'binary search'],
        ['1,4,6,8', 'binary search'],
        ['3,10,11,12', 'binary search'],
        ['0,13,14,15', 'binary search'],
      ],
    ),
    highlight: { active: ['node1:query', 'node2:query', 'node3:query', 'node4:query'] },
    explanation: 'A range query over a merge-sort tree may touch several segment-tree nodes. Each node has a sorted catalog, so a naive implementation binary-searches each one.',
  };

  yield {
    state: catalogGraph('Bridge the catalogs visited by the query'),
    highlight: { active: ['q', 'm1', 'm2', 'm3', 'm4'], found: ['ans'] },
    explanation: 'Fractional cascading can store cross-catalog links so the query performs one binary search at the first relevant node, then follows links into the next visited catalogs.',
  };

  yield {
    state: labelMatrix(
      'Case study: many range successor queries',
      [
        { id: 'input', label: 'input array' },
        { id: 'tree', label: 'segment tree' },
        { id: 'query', label: '[l,r], x' },
        { id: 'answer', label: 'successor' },
      ],
      [{ id: 'structure', label: 'structure' }, { id: 'reason', label: 'reason' }],
      [
        ['static values', 'can preprocess'],
        ['sorted lists per node', 'range decomposes'],
        ['same x in all nodes', 'bridges apply'],
        ['min candidate', 'merge node answers'],
      ],
    ),
    highlight: { active: ['query:reason'], found: ['answer:structure'] },
    explanation: 'The complete case is a static array with many queries asking for the smallest value >= x inside a range. The query decomposes into catalogs; fractional cascading reduces the repeated search cost.',
  };

  yield {
    state: labelMatrix(
      'When not to use it',
      [
        { id: 'few', label: 'few queries' },
        { id: 'dynamic', label: 'many updates' },
        { id: 'single', label: 'one catalog' },
        { id: 'simple', label: 'small n' },
      ],
      [{ id: 'issue', label: 'issue' }, { id: 'simpler_choice', label: 'simpler choice' }],
      [
        ['preprocessing not repaid', 'plain binary search'],
        ['bridges hard to maintain', 'balanced trees'],
        ['no repeated search', 'one sorted array'],
        ['constants dominate', 'direct scan'],
      ],
    ),
    highlight: { compare: ['dynamic:issue', 'few:issue'], found: ['single:simpler_choice'] },
    explanation: 'Fractional cascading is powerful because it targets a narrow bottleneck. If the bottleneck is not repeated sorted-list search for the same key, it is probably the wrong tool.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'catalog bridges') yield* catalogBridges();
  else if (view === 'segment tree queries') yield* segmentTreeQueries();
  else throw new InputError('Pick a fractional-cascading view.');
}

export const article = {
  sections: [
    { heading: 'What it is', paragraphs: [
      'Fractional cascading is a data-structuring technique for repeated search. If a query needs the predecessor or successor of the same value in many related sorted lists, doing a fresh binary search in every list wastes work. Fractional cascading augments the lists with sampled items and bridge pointers so only the first list needs a full binary search.',
      'The name describes the mechanism. A fraction of each later catalog is copied into earlier catalogs, and the search result cascades through pointers from one catalog to the next. The result is O(log n + k) query time for k catalogs, rather than O(k log n), with linear-size augmentation under the classic static assumptions.',
    ] },
    { heading: 'How it works', paragraphs: [
      'In the simplest path-shaped case, start from the last list and work backward. Each augmented list stores its own items plus every second item from the next augmented list. Every item stores bridge information: where it lands in the original list and where to continue in the next augmented list.',
      'A query binary-searches the first augmented list. The stored bridge gives a nearly correct position in the next list, so a constant number of comparisons fixes the answer. Repeating that step walks the catalog path without repeated logarithmic searches.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Static fractional cascading uses O(n) extra space and answers a path query in O(log n + k), where n is total catalog size and k is the number of catalogs visited. The preprocessing is worthwhile when the catalog structure is stable and the same query pattern repeats many times.',
      'Dynamic updates are much harder because bridge positions and sampled items must remain valid as lists change. That does not make the technique impractical, but it does mean the static version should not be casually dropped into a high-churn system.',
    ] },
    { heading: 'Complete case study', paragraphs: [
      'A merge-sort tree stores a sorted list at every segment-tree node. To answer a range successor query, the range decomposes into O(log n) nodes, and each node needs a search for the same value x. Fractional cascading connects those node catalogs so the query performs one binary search and then follows bridges through the rest.',
      'That case study is the clean mental model: many lists, one query key, related catalogs, and enough query volume to repay preprocessing. It also explains why Fractional Cascading belongs near Segment Tree and Sparse Table in the map of ideas.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Sources: Chazelle and Guibas, "Fractional Cascading: I. A Data Structuring Technique", https://www.cs.princeton.edu/~chazelle/pubs/FractionalCascading1.pdf, and CP-Algorithms Segment Tree notes on fractional cascading, https://cp-algorithms.com/data_structures/segment_tree.html. Study Segment Tree, Sparse Table, Disjoint Sparse Table, Binary Search, and Wavelet Tree next.',
    ] },
  ],
};
