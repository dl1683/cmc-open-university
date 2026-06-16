// k-d tree: recursively split points by alternating dimensions so range and
// nearest-neighbor queries can prune large spatial regions.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'k-d-tree',
  title: 'k-d Tree',
  category: 'Data Structures',
  summary: 'A multidimensional search tree: alternate split axes, partition points, and prune regions during range or nearest-neighbor queries.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['build point tree', 'nearest neighbor search'], defaultValue: 'build point tree' },
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
      { id: 'p7', label: '(7,2)', x: 4.8, y: 0.9, note: 'split x' },
      { id: 'p5', label: '(5,4)', x: 2.5, y: 2.6, note: 'split y' },
      { id: 'p9', label: '(9,6)', x: 7.0, y: 2.6, note: 'split y' },
      { id: 'p2', label: '(2,3)', x: 1.2, y: 4.7, note: 'split x' },
      { id: 'p4', label: '(4,7)', x: 3.6, y: 4.7, note: 'split x' },
      { id: 'p8', label: '(8,1)', x: 6.0, y: 4.7, note: 'split x' },
      { id: 'p10', label: '(10,5)', x: 8.2, y: 4.7, note: 'split x' },
      { id: 'q', label: 'query (6,3)', x: 4.9, y: 6.7, note: 'nearest?' },
    ],
    edges: [
      { id: 'e-7-5', from: 'p7', to: 'p5', weight: 'x < 7' },
      { id: 'e-7-9', from: 'p7', to: 'p9', weight: 'x >= 7' },
      { id: 'e-5-2', from: 'p5', to: 'p2', weight: 'y < 4' },
      { id: 'e-5-4', from: 'p5', to: 'p4', weight: 'y >= 4' },
      { id: 'e-9-8', from: 'p9', to: 'p8', weight: 'y < 6' },
      { id: 'e-9-10', from: 'p9', to: 'p10', weight: 'y < 6' },
      { id: 'e-q-5', from: 'q', to: 'p5', weight: 'best so far' },
      { id: 'e-q-7', from: 'q', to: 'p7', weight: 'check split' },
    ],
  }, { title });
}

function* buildPointTree() {
  yield {
    state: labelMatrix(
      'Points in two dimensions',
      [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
        { id: 'd', label: 'D' },
        { id: 'e', label: 'E' },
      ],
      [
        { id: 'point', label: 'point' },
        { id: 'axis0', label: 'depth 0 split' },
        { id: 'axis1', label: 'depth 1 split' },
      ],
      [
        ['(7,2)', 'x', ''],
        ['(5,4)', 'x', 'y'],
        ['(9,6)', 'x', 'y'],
        ['(2,3)', 'x', 'y'],
        ['(4,7)', 'x', 'y'],
      ],
    ),
    highlight: { active: ['a:point', 'b:point', 'c:point'], found: ['a:axis0', 'b:axis1'] },
    explanation: 'A k-d tree stores points in k dimensions. In 2D, each level alternates split axes: x, then y, then x again. The tree is a Binary Search Tree generalized from one coordinate to many.',
  };

  yield {
    state: tree('Root splits space by x'),
    highlight: { active: ['p7', 'e-7-5', 'e-7-9'], found: ['p5', 'p9'] },
    explanation: 'The root chooses a point and splits the plane by its x coordinate. Points left of x=7 go into the left subtree; points right of x=7 go into the right subtree.',
    invariant: 'At depth d, compare coordinate d mod k.',
  };

  yield {
    state: tree('Next level splits by y'),
    highlight: { active: ['p5', 'p9', 'e-5-2', 'e-5-4', 'e-9-8', 'e-9-10'], compare: ['p7'] },
    explanation: 'At the next depth, the split axis changes to y. This recursive partitioning creates rectangular regions, which makes range search and nearest-neighbor pruning possible.',
  };

  yield {
    state: labelMatrix(
      'k-d tree versus related indexes',
      [
        { id: 'bst', label: 'BST' },
        { id: 'kd', label: 'k-d tree' },
        { id: 'rtree', label: 'R-tree' },
        { id: 'hnsw', label: 'HNSW' },
      ],
      [
        { id: 'data', label: 'data' },
        { id: 'query', label: 'query' },
      ],
      [
        ['1D keys', 'ordered lookup'],
        ['points', 'range and nearest neighbor'],
        ['rectangles', 'spatial overlap'],
        ['vectors', 'approximate nearest neighbor'],
      ],
    ),
    highlight: { found: ['kd:data', 'kd:query'], compare: ['rtree:query', 'hnsw:query'] },
    explanation: 'k-d trees work best for moderate dimensions. As dimensionality rises, pruning weakens; vector databases usually move to approximate graph or quantization methods.',
  };
}

function* nearestNeighborSearch() {
  yield {
    state: tree('Search query (6,3): descend like a BST'),
    highlight: { active: ['q', 'p7', 'p5', 'e-q-7', 'e-q-5'], compare: ['p9'] },
    explanation: 'Nearest-neighbor search first descends to the side that contains the query. For query (6,3), compare x at the root, then y at the next node. The first candidate is often not final.',
  };

  yield {
    state: labelMatrix(
      'Track best distance and split-plane distance',
      [
        { id: 'p5', label: '(5,4)' },
        { id: 'p7', label: '(7,2)' },
        { id: 'p2', label: '(2,3)' },
        { id: 'p9', label: '(9,6)' },
      ],
      [
        { id: 'distance', label: 'distance to query' },
        { id: 'best', label: 'best so far' },
        { id: 'prune', label: 'prune other side?' },
      ],
      [
        ['1.41', 'yes', 'maybe not'],
        ['1.41', 'tie', 'split distance 1'],
        ['4.00', 'no', 'yes'],
        ['4.24', 'no', 'yes if split farther'],
      ],
    ),
    highlight: { active: ['p5:distance', 'p7:distance'], found: ['p5:best'], compare: ['p9:prune'] },
    explanation: 'After finding a candidate, compare the best distance with the distance to the splitting plane. If the other side of the split cannot contain a closer point, prune it. Otherwise, search both sides.',
  };

  yield {
    state: tree('Prune subtrees whose regions cannot beat the best point'),
    highlight: { found: ['p5', 'p7'], removed: ['p2', 'p9', 'p10'], active: ['q'] },
    explanation: 'The performance comes from region pruning. But the guarantee weakens in high dimensions because most regions are near the query in at least one coordinate.',
  };

  yield {
    state: labelMatrix(
      'When to use it',
      [
        { id: 'lowd', label: '2D/3D geometry' },
        { id: 'medium', label: 'medium dimensions' },
        { id: 'highd', label: 'high-dimensional embeddings' },
        { id: 'dynamic', label: 'many updates' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['strong', 'spatial pruning works'],
        ['depends', 'dimension and distribution matter'],
        ['weak', 'curse of dimensionality'],
        ['depends', 'balance can degrade'],
      ],
    ),
    highlight: { found: ['lowd:fit'], compare: ['highd:reason'], active: ['medium:fit'] },
    explanation: 'k-d trees are excellent for geometric teaching and some practical low-dimensional searches. For embedding search, study HNSW and Product Quantization instead.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'build point tree') yield* buildPointTree();
  else if (view === 'nearest neighbor search') yield* nearestNeighborSearch();
  else throw new InputError('Pick a k-d tree view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A k-d tree is a binary search tree for points in k-dimensional space. Each level compares a different coordinate, recursively partitioning space into regions.',
        'The data-structure lesson is that Binary Search Tree can be generalized beyond scalar keys, but the generalization comes with geometric tradeoffs. Splitting by x, then y, then x again creates useful pruning regions for low-dimensional range and nearest-neighbor queries.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'To build the tree, choose a split axis by depth, partition points by that coordinate, and recurse. A range query descends into subtrees whose regions overlap the query box. Nearest-neighbor search descends toward the query, tracks the best point found, then checks whether the opposite side of a split could contain a closer point.',
        'The same idea scales to k dimensions by cycling the split axis. In practice, construction often chooses median points to keep the tree balanced.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Balanced k-d trees use O(n) space. Search is often near logarithmic in low dimensions, but worst cases can inspect many nodes. Performance degrades as dimensionality rises because pruning becomes weaker. Dynamic updates can also unbalance the tree unless the implementation rebuilds or rebalances.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'k-d trees appear in nearest-neighbor search for low-dimensional geometry, robotics, graphics, range search, clustering accelerators, and spatial prefilters. They are also an important conceptual bridge to R-Tree Spatial Index and HNSW (Vector Search at Scale).',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A k-d tree is not automatically a good vector database index. In hundreds of dimensions, exact tree pruning often loses its advantage. The tree also indexes points, while R-trees index rectangles and spatial extents.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Bentley\'s original ACM paper at https://dl.acm.org/doi/pdf/10.1145/361002.361007 and a modern formal overview at https://www.isa-afp.org/browser_info/current/AFP/KD_Tree/outline.pdf. Study Delaunay Triangulation & Voronoi Dual for another nearest-site geometry structure, then Binary Search Tree, R-Tree Spatial Index, HNSW (Vector Search at Scale), Product Quantization for Vector Search, and K-Means Clustering next.',
      ],
    },
  ],
};
