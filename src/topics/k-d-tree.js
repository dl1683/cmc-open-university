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
  const dimensions = 2;  // 2D points
  const pointCount = 5;  // points A through E
  const indexTypes = 4;  // BST, k-d tree, R-tree, HNSW

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
    explanation: `A k-d tree stores points in k dimensions. In ${dimensions}D, each level alternates split axes: x, then y, then x again. The tree is a Binary Search Tree generalized from one coordinate to ${dimensions}.`,
  };

  yield {
    state: tree('Root splits space by x'),
    highlight: { active: ['p7', 'e-7-5', 'e-7-9'], found: ['p5', 'p9'] },
    explanation: `The root chooses a point and splits the plane by its x coordinate. With ${pointCount} points to place, points left of x=7 go into the left subtree; points right of x=7 go into the right subtree.`,
    invariant: `At depth d, compare coordinate d mod ${dimensions}.`,
  };

  yield {
    state: tree('Next level splits by y'),
    highlight: { active: ['p5', 'p9', 'e-5-2', 'e-5-4', 'e-9-8', 'e-9-10'], compare: ['p7'] },
    explanation: `At the next depth, the split axis changes to y. This recursive partitioning in ${dimensions} dimensions creates rectangular regions, which makes range search and nearest-neighbor pruning possible.`,
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
    explanation: `Comparing ${indexTypes} index types, k-d trees work best for moderate dimensions. As dimensionality rises, pruning weakens; vector databases usually move to approximate graph or quantization methods.`,
  };
}

function* nearestNeighborSearch() {
  const queryPoint = '(6,3)';
  const candidateCount = 4;  // points checked during search
  const dimensions = 2;

  yield {
    state: tree('Search query (6,3): descend like a BST'),
    highlight: { active: ['q', 'p7', 'p5', 'e-q-7', 'e-q-5'], compare: ['p9'] },
    explanation: `Nearest-neighbor search first descends to the side that contains the query. For query ${queryPoint}, compare x at the root, then y at the next node. The first candidate is often not final.`,
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
    explanation: `After finding a candidate among ${candidateCount} points checked, compare the best distance with the distance to the splitting plane. If the other side of the split cannot contain a closer point, prune it. Otherwise, search both sides.`,
  };

  yield {
    state: tree('Prune subtrees whose regions cannot beat the best point'),
    highlight: { found: ['p5', 'p7'], removed: ['p2', 'p9', 'p10'], active: ['q'] },
    explanation: `The performance comes from region pruning in ${dimensions}D space. But the guarantee weakens in high dimensions because most regions are near the query in at least one coordinate.`,
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
    explanation: `k-d trees are excellent for geometric teaching and some practical low-${dimensions}D searches. For embedding search, study HNSW and Product Quantization instead.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read each node as a point plus a split rule. Active nodes are the split being applied or tested, found nodes are accepted candidates, and removed nodes are subtrees whose rectangular region cannot contain a better answer.',
        { type: 'callout', text: 'A k-d tree turns multidimensional search into recursive region exclusion: skip a subtree only after the split geometry proves it cannot improve the best answer.' },
        'The safe inference rule is geometric: the distance from the query to a split plane is a lower bound for every point across that plane. If that lower bound is already larger than the best distance found, the whole opposing subtree can be skipped.',
        {type: 'image', src: './assets/gifs/k-d-tree.gif', alt: 'Animated walkthrough of the k d tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A binary search tree orders one-dimensional keys. Points in two or more dimensions do not have one natural left-to-right order because closeness depends on all coordinates together.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/b/bf/Kdtree_2d.svg', alt: 'Two-dimensional k-d tree partition of points', caption: 'Alternating x and y splits carve the plane into nested regions, which is the geometry behind subtree pruning. Source: https://commons.wikimedia.org/wiki/File:Kdtree_2d.svg.' },
        'A k-d tree exists to make exact range and nearest-neighbor search faster on low-dimensional points. It does this by storing a binary tree of axis-aligned splits that carve space into nested rectangles.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The direct nearest-neighbor method scans every point and computes its distance to the query. With one million 2D points, one query means one million distance calculations.',
        'Sorting by x alone looks tempting because it restores binary search on one coordinate. It fails because the closest x-coordinate point may be far away in y, while a slightly worse x-coordinate point may be much closer overall.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the missing total order. A line has one order, but a plane has tradeoffs between x and y, so one comparison cannot rank all points by Euclidean distance.',
        'A one-sided tree walk is also unsafe. The nearest point can sit just across a split boundary, so skipping that side without a distance bound can return the wrong answer.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Alternate split axes by depth: x at depth 0, y at depth 1, x again at depth 2, and so on. Every node divides the current rectangular region into two smaller regions.',
        'Search uses those regions as proofs. A subtree can be skipped only when the closest possible point in its region is already farther than the best candidate found so far.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'To build a balanced k-d tree, choose the split axis from depth mod k, sort points by that coordinate, and place the median point at the node. Recurse on the lower and upper halves with the next axis.',
        'For nearest-neighbor search, first descend toward the leaf whose region contains the query. During backtracking, update the best point at each visited node and test whether the opposite subtree could contain a closer point.',
        'The pruning test compares bestDistance with the perpendicular distance to the split plane. If the split-plane distance is larger, every point across the plane is too far on that coordinate alone.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from a lower-bound argument. Any point in the opposite subtree differs from the query by at least the split-plane distance on the split coordinate, and Euclidean distance cannot be smaller than one coordinate difference.',
        'The algorithm searches both sides whenever the lower bound is not strong enough. Because it only prunes after a valid lower bound loses to the current best, it cannot discard a point that would improve the answer.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A balanced build costs O(n log n) if each level sorts its points, and space is O(n). Nearest-neighbor queries are often O(log n) in low dimensions because many regions are pruned.',
        'The worst case is O(n), and high dimension pushes practical behavior toward that worst case. When dimensions double, split-plane bounds get looser because one coordinate explains a smaller share of total distance.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'K-d trees fit low-dimensional geometry: 2D map points, 3D point clouds, collision queries, ray tracing acceleration, and robotics configurations with a small number of coordinates. The access pattern is repeated spatial queries over a mostly static point set.',
        'They also help clustering algorithms such as k-means when centroids and points live in low dimensions. The tree can reduce repeated nearest-centroid searches if pruning remains strong.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'K-d trees fail for high-dimensional embeddings such as 768-dimensional text vectors. Most split planes are close to the query in some coordinate, so pruning weakens and the search visits nearly every node.',
        'They also need care with updates and skewed data. Repeated insertions can unbalance the tree, duplicate coordinates create awkward splits, and rectangles are a poor fit for overlapping boxes or polygons.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use points (2,3), (5,4), (9,6), (4,7), (8,1), and (7,2). Split on x first, sort x values 2, 4, 5, 7, 8, 9, and choose (7,2) as root.',
        'The left side has (2,3), (5,4), and (4,7), then splits on y with median (5,4). The right side has (8,1) and (9,6), then splits on y with (8,1) above (9,6).',
        'Query (6,3) descends left from root because 6 < 7, then left from (5,4) because 3 < 4. The first leaf (2,3) has distance 4.0, so bestDistance starts at 4.0.',
        'Backtracking to (5,4) gives distance sqrt(2) = 1.41, so best becomes (5,4). The split-plane distance is |3 - 4| = 1.0, which is less than 1.41, so the right child (4,7) must be checked.',
        'Backtracking to root gives (7,2) at distance 1.41, tied with the best. The split-plane distance to the right side is |6 - 7| = 1.0, so the right subtree must be checked; (8,1) is 2.83 and (9,6) is 4.24, so the tie remains.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Jon Bentley, Multidimensional Binary Search Trees Used for Associative Searching, 1975; Friedman, Bentley, and Finkel, An Algorithm for Finding Best Matches in Logarithmic Expected Time, 1977. These papers introduce the structure and the nearest-neighbor backtracking rule.',
        'Study binary search trees first because k-d trees generalize their recursive partition idea. Then study R-trees for rectangles, ball trees for metric spaces, and HNSW or product quantization for high-dimensional approximate nearest-neighbor search.',
      ],
    },
  ],
};
