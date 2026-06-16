// Centroid decomposition: divide a tree by repeatedly removing centroids.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'centroid-decomposition',
  title: 'Centroid Decomposition',
  category: 'Data Structures',
  summary: 'A divide-and-conquer structure for trees: remove a centroid, recurse on the remaining components, and answer distance-style updates through centroid ancestors.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['find centroid', 'nearest marked'], defaultValue: 'find centroid' },
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

function centroidGraph(title) {
  return graphState({
    nodes: [
      { id: 'c', label: '4 centroid', x: 4.8, y: 2.8, note: 'largest side <= n/2' },
      { id: 'a', label: '1', x: 2.4, y: 1.0, note: 'component' },
      { id: 'b', label: '2', x: 2.4, y: 2.8, note: 'component' },
      { id: 'd', label: '3', x: 2.4, y: 4.6, note: 'component' },
      { id: 'e', label: '5', x: 7.0, y: 1.6, note: 'component' },
      { id: 'f', label: '6', x: 7.3, y: 3.4, note: 'component' },
      { id: 'g', label: '7', x: 7.0, y: 5.2, note: 'component' },
      { id: 'ct', label: 'centroid tree', x: 9.0, y: 3.4, note: 'recursive index' },
    ],
    edges: [
      { id: 'e-c-a', from: 'c', to: 'a', weight: 'tree edge' },
      { id: 'e-a-b', from: 'a', to: 'b', weight: 'tree edge' },
      { id: 'e-b-d', from: 'b', to: 'd', weight: 'tree edge' },
      { id: 'e-c-e', from: 'c', to: 'e', weight: 'tree edge' },
      { id: 'e-e-f', from: 'e', to: 'f', weight: 'tree edge' },
      { id: 'e-f-g', from: 'f', to: 'g', weight: 'tree edge' },
      { id: 'e-c-ct', from: 'c', to: 'ct', weight: 'root of decomposition' },
    ],
  }, { title });
}

function* findCentroid() {
  yield {
    state: centroidGraph('A centroid splits every remaining component to <= half'),
    highlight: { active: ['c'], found: ['a', 'b', 'd', 'e', 'f', 'g'], compare: ['ct'] },
    explanation: 'A centroid is a node whose removal leaves no component with more than half the current tree. Every tree has one or two centroids.',
    invariant: 'After removing a centroid, every recursive subproblem has size at most n/2.',
  };
  yield {
    state: labelMatrix(
      'Centroid test for node 4',
      [
        { id: 'left', label: 'left component' },
        { id: 'right', label: 'right component' },
        { id: 'parent', label: 'parent side' },
        { id: 'result', label: 'node 4' },
      ],
      [{ id: 'size' }, { id: 'ok' }],
      [
        ['3', '<= 3.5'],
        ['3', '<= 3.5'],
        ['0', '<= 3.5'],
        ['largest side 3', 'centroid'],
      ],
    ),
    highlight: { active: ['left:ok', 'right:ok'], found: ['result:ok'] },
    explanation: 'For seven nodes, no side may exceed 3.5 nodes. Removing node 4 leaves two size-3 components, so it is a centroid.',
  };
  yield {
    state: centroidGraph('Recurse on each component and build a centroid tree'),
    highlight: { active: ['c', 'ct', 'e-c-ct'], compare: ['a', 'e'] },
    explanation: 'After choosing a centroid, recursively decompose each remaining component. The chosen centroids become children in a new centroid tree.',
  };
  yield {
    state: labelMatrix(
      'Why queries become logarithmic',
      [
        { id: 'root', label: 'level 0' },
        { id: 'level1', label: 'level 1' },
        { id: 'level2', label: 'level 2' },
        { id: 'bound', label: 'height' },
      ],
      [{ id: 'subproblem' }, { id: 'reason' }],
      [
        ['n', 'whole tree'],
        ['<= n/2', 'centroid split'],
        ['<= n/4', 'split again'],
        ['O(log n)', 'halving depth'],
      ],
    ),
    highlight: { found: ['bound:reason'], active: ['level1:subproblem', 'level2:subproblem'] },
    explanation: 'Centroid decomposition creates a secondary tree of logarithmic height. Updates and queries can walk centroid ancestors instead of scanning the original tree.',
  };
}

function* nearestMarked() {
  yield {
    state: labelMatrix(
      'Maintain nearest red node',
      [
        { id: 'mark', label: 'update(red x)' },
        { id: 'walk', label: 'walk centroid ancestors' },
        { id: 'store', label: 'best[c]' },
        { id: 'query', label: 'query(v)' },
      ],
      [{ id: 'move' }, { id: 'cost' }],
      [
        ['mark a node red', 'O(log n)'],
        ['x -> centroid parent chain', 'O(log n)'],
        ['min distance from c to any red', 'updated per ancestor'],
        ['min best[c] + dist(v,c)', 'O(log n)'],
      ],
    ),
    highlight: { active: ['walk:move', 'store:move'], found: ['query:move'] },
    explanation: 'The classic dynamic query is nearest marked node. Each update touches centroid ancestors and stores best distances. Each query checks the same ancestor chain.',
  };
  yield {
    state: centroidGraph('Distances are measured in the original tree'),
    highlight: { active: ['c', 'ct'], found: ['a', 'g'], compare: ['e-c-a', 'e-c-e'] },
    explanation: 'The centroid tree is an index. Distances still come from the original tree, often precomputed from every centroid to nodes in its component.',
    invariant: 'For any node pair, some centroid ancestor separates their recursive component at the level that matters.',
  };
  yield {
    state: labelMatrix(
      'Update/query example',
      [
        { id: 'red2', label: 'mark node 2' },
        { id: 'c4', label: 'ancestor centroid 4' },
        { id: 'c1', label: 'sub-centroid 1' },
        { id: 'ask7', label: 'query node 7' },
      ],
      [{ id: 'stored' }, { id: 'answerUse' }],
      [
        ['red', 'source'],
        ['best[4]=dist(2,4)', 'candidate for all sides'],
        ['best[1]=dist(2,1)', 'local candidate'],
        ['best[4]+dist(7,4)', 'cross-subtree answer'],
      ],
    ),
    highlight: { found: ['ask7:answerUse'], active: ['c4:stored'] },
    explanation: 'The centroid at which two nodes fall into different recursive components acts as the meeting point for an answer candidate.',
  };
  yield {
    state: labelMatrix(
      'Neighbors',
      [
        { id: 'hld', label: 'Heavy-Light' },
        { id: 'binary', label: 'Binary Lifting' },
        { id: 'centroid', label: 'Centroid Decomposition' },
        { id: 'lct', label: 'Link-Cut Tree' },
      ],
      [{ id: 'best' }, { id: 'topology' }],
      [
        ['path ranges', 'static'],
        ['ancestors/LCA', 'static'],
        ['distance updates over tree', 'static'],
        ['path queries with link/cut', 'dynamic'],
      ],
    ),
    highlight: { found: ['centroid:best'], compare: ['lct:topology'] },
    explanation: 'Use centroid decomposition when the query is global over distances through a static tree, not just one contiguous path.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'find centroid') yield* findCentroid();
  else if (view === 'nearest marked') yield* nearestMarked();
  else throw new InputError('Pick a centroid-decomposition view.');
}

export const article = {
  sections: [
    { heading: 'What it is', paragraphs: [
      'Centroid decomposition is divide and conquer on a tree. Pick a centroid, remove it, recurse on the remaining components, and connect those chosen centroids into a new centroid tree.',
      'A centroid is a node whose removal leaves every component with at most half the original nodes. This halving property makes the centroid tree height O(log n).',
      'The structure is useful for distance-style updates and queries on static trees, especially when answers can be combined through a small set of centroid ancestors.',
      'The original tree is not replaced. The centroid tree is an index layered on top of it. Queries usually move through centroid ancestors while measuring distances in the original tree.',
    ] },
    { heading: 'How it works', paragraphs: [
      'Compute subtree sizes, walk toward any child with size greater than n/2, and stop at a centroid. Mark it removed. Recursively decompose each component created by removing it. Store the centroid parent relation.',
      'For nearest-marked-node queries, update(x) walks centroid ancestors of x and improves best[c] with dist(x, c). query(v) walks centroid ancestors of v and minimizes best[c] + dist(v, c).',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Building the decomposition is commonly O(n log n), though careful implementations can be close to linear for some work. Updates and queries that walk centroid ancestors cost O(log n), plus whatever distance lookup costs.',
      'Distance lookup is often handled with LCA preprocessing or precomputed centroid-to-node distances. The implementation challenge is keeping original-tree distances separate from centroid-tree parent links.',
      'Memory grows with the auxiliary distance information. A simple version stores distances from each node to each centroid ancestor, which is O(n log n). That is often acceptable, but it should be designed deliberately for large trees.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'Centroid decomposition appears in static network search, facility-location queries on trees, nearest activated node problems, tree metric indexes, and contest problems with colored or marked nodes.',
      'A complete case study is a delivery network shaped as a tree. Warehouses are activated over time, and each customer query asks for the nearest active warehouse. Centroid ancestors bound each query to logarithmic candidates.',
      'Another case is incident response on a tree-shaped dependency graph. Mark unhealthy services as they alert, then query each downstream service for the nearest known unhealthy ancestor-side region using centroid distance summaries.',
      'Centroid decomposition, Virtual Tree LCA Compression, and Rerooting DP: All Roots Tree DP are three different ways to reuse work on static trees. Centroid decomposition builds one global index for online distance updates, virtual trees build a small per-query auxiliary tree for a known marked set, and rerooting DP scores every possible root with two passes.',
    ] },
    { heading: 'Pitfalls and misconceptions', paragraphs: [
      'Centroid decomposition does not support arbitrary topology changes cheaply. It is also not the same as choosing the root by center or diameter. The centroid property is about component sizes after removal.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Sources: CP-Algorithms centroid decomposition at https://cp-algorithms.com/graph/centroid_decomposition.html and USACO Guide centroid notes at https://usaco.guide/plat/centroid. Study Rerooting DP: All Roots Tree DP, Virtual Tree LCA Compression, Binary Lifting LCA, Heavy-Light Decomposition, Tree Traversals, and Link-Cut Tree next.',
    ] },
  ],
};
