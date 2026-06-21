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
      heading: 'How to read the animation',
      paragraphs: [
        'The build view shows the tree growing one split at a time. Each node is a 2D point. Active nodes mark the split being applied right now; found nodes are the children placed by that split. Edge labels carry the split condition ("x < 7" means every point in the left subtree has x-coordinate below 7). Watch the split axis alternate: the root splits on x, its children split on y, their children split on x again.',
        { type: 'callout', text: 'A k-d tree turns multidimensional search into recursive region exclusion: skip a subtree only after the split geometry proves it cannot improve the best answer.' },
        'The nearest-neighbor view traces a query through the finished tree. Active edges show the descent path. The found node is the current best candidate. Removed nodes are subtrees the algorithm proved it could skip -- their closest possible point is farther than the best distance so far. When a node stays active instead of being removed, the split-plane distance was too small to prune: both sides had to be searched.',
        'In the distance matrix, the column "prune other side?" is the key decision. It compares two numbers: the perpendicular distance from the query to the splitting plane, and the best Euclidean distance found so far. When the split distance exceeds the best, the entire opposing subtree is eliminated. When it does not, backtracking is required.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Binary search finds a value in a sorted array by eliminating half the data per comparison. That works because one-dimensional data has a total order -- smaller is always left, larger is always right. Points in two or more dimensions have no such order. A map coordinate has x and y; a 3D mesh vertex has x, y, and z. Asking "which stored point is closest to this query?" requires comparing across all coordinates simultaneously, and no single sorted sequence answers that.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/b/bf/Kdtree_2d.svg', alt: 'Two-dimensional k-d tree partition of points', caption: 'Alternating x and y splits carve the plane into nested regions, which is the geometry behind subtree pruning. Source: https://commons.wikimedia.org/wiki/File:Kdtree_2d.svg.' },
        'Jon Bentley introduced the k-d tree in 1975 to extend binary search to k dimensions. The idea: cycle through axes at each tree level, splitting the point set by one coordinate at a time. The result is a binary tree that partitions space into rectangular regions. Range queries and nearest-neighbor queries can then prune entire regions rather than scanning every point.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Brute force: measure the distance from the query to every stored point, keep the closest. O(n) per query. A 3D point cloud with 10 million vertices means 10 million distance computations per query. A ray tracer firing millions of rays per frame, or a robot replanning its path 100 times per second, cannot afford that.',
        'Sorting by one coordinate and binary-searching gives O(log n) on that axis, but the closest point in x is not necessarily closest in Euclidean distance. Sorting by x discards y; sorting by y discards x. No single sort captures multidimensional proximity.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Multidimensional data has no total order. Binary search works on a line because "left" and "right" are absolute. In 2D, whether a point is "closer" depends on both coordinates together -- you cannot reduce it to one comparison on one axis.',
        'A naive tree descent is also not enough. The nearest point might sit across a split boundary. Descending only the subtree containing the query is fast but can be wrong. Any correct index must prove the skipped side cannot contain a closer point before actually skipping it.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Alternate the split axis at each tree level. Depth 0 splits on x. Depth 1 splits on y. Depth 2 splits on x again (or z in 3D). Each split is an axis-aligned plane that carves the region in half along one coordinate. Every point in a subtree lies inside the rectangular region defined by all its ancestor splits.',
        'This containment makes pruning possible. During nearest-neighbor search, compute the perpendicular distance from the query to the splitting plane. If that distance already exceeds the best Euclidean distance found so far, every point on the other side must be at least that far away on the splitting coordinate alone -- the entire opposing subtree is eliminated. One axis comparison prunes a region of space, just as one comparison in binary search eliminates half an array.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Build: choose the axis for the current depth (depth mod k). Sort the points by that coordinate and pick the median as the node. Recurse on the lower half and upper half, advancing to the next axis. The result is a balanced binary tree of height O(log n).',
        'Nearest-neighbor search has two phases. Phase 1 (descent): walk toward the leaf whose region contains the query, recording each node visited. Phase 2 (backtrack): unwind the recursion. At each split node, compare the query to that node and update the best distance. Then check the split-plane distance -- the absolute difference between the query and the split value on the splitting axis. If the split-plane distance is less than the current best, the other subtree might hide a closer point, so recurse into it. If the split-plane distance exceeds the best, prune it.',
        'Range query: at each node, test whether the query rectangle overlaps the node\'s region. If the region is entirely outside, prune. If it is entirely inside, report all points without further checks. Otherwise, test the node\'s point and recurse into both children.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The pruning bound is a lower bound on distance. The perpendicular distance from the query to the splitting plane measures how far apart they are on one coordinate. Any point on the other side of the plane differs from the query by at least that amount on the splitting axis. Euclidean distance can only be larger (it adds contributions from all axes). So if the single-axis gap already exceeds the best known distance, no point across the split can improve it.',
        'The algorithm never skips a region without this geometric proof. When the proof is inconclusive -- split-plane distance less than or equal to the best -- it searches both sides. Correctness depends entirely on the lower-bound argument, not on the direction of the initial descent.',
        'Implementations that store bounding boxes per subtree can compute a tighter lower bound: the minimum Euclidean distance from the query to the bounding box, which accounts for all axes at once. Tighter bounds prune more aggressively, but the correctness argument is identical.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Build: O(n log n) using median-of-medians selection at each level. Space is O(n) -- one node per point, no duplication.',
        'Nearest-neighbor query: O(log n) expected in low dimensions. Each level prunes roughly half the points. One million points in 2D means a typical query visits about 20 nodes instead of 1,000,000. Doubling the points adds roughly one more node visit. The worst case is O(n) when adversarial distributions or high dimensionality defeat pruning.',
        'Range query in 2D: O(sqrt(n) + m), where m is the number of reported points. The sqrt(n) term comes from subtrees that straddle the query boundary and cannot be bulk-pruned or bulk-reported.',
        'The curse of dimensionality hits because the split-plane test measures only one of k coordinates. In 100 dimensions, a point can be far from the query on the splitting axis yet close in Euclidean distance because 99 other coordinates contribute. The single-axis lower bound becomes too loose to prune, and the search degenerates toward brute force. Empirically, k-d trees stop beating linear scan around 20 dimensions.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Ray tracing: each ray tests intersection against millions of scene primitives. A k-d tree over 3D bounding volumes lets the ray skip entire spatial regions, reducing per-ray cost from O(n) to O(log n). PBRT, a standard physically-based renderer, uses k-d trees for its spatial acceleration structure.',
        'Robotics path planning: a robot arm in 2D--6D configuration space needs the nearest obstacle at every replanning step. k-d trees deliver exact nearest-neighbor with low latency in this dimension range.',
        'Geographic queries: "find the closest hospital to this GPS coordinate" on a static 2D point set is a textbook k-d tree application. PostGIS supports k-d tree indexing for this pattern.',
        'Clustering acceleration: k-means and DBSCAN use k-d trees to speed up "find nearest centroid" and "find all neighbors within radius r," cutting per-iteration cost from O(n^2) to O(n log n).',
        'Point cloud processing: lidar scans produce millions of 3D points. Surface reconstruction and normal estimation require nearest-neighbor queries at every point. k-d trees make this tractable.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'High-dimensional embeddings: language-model vectors live in 768 or 1536 dimensions. The split-plane test almost never prunes at that scale, and queries visit nearly every node. HNSW, product quantization, and other approximate methods dominate this regime.',
        'Dynamic data: inserting points one at a time can unbalance the tree. k-d trees have no efficient rebalancing rotation like AVL or red-black trees offer for 1D BSTs. Production systems rebuild periodically, use scapegoat-style partial rebuilds, or switch to R-trees, which handle insertions more gracefully.',
        'Skewed distributions: when points cluster tightly, median splits produce lopsided subtrees and queries degrade. Repeated coordinates on the splitting axis create ties that push equal points unpredictably to one side.',
        'Non-point geometry: k-d trees index points, not rectangles or polygons. "Find all buildings overlapping this rectangle" needs an R-tree, which stores bounding boxes rather than bare coordinates.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Six 2D points: (2,3), (5,4), (9,6), (4,7), (8,1), (7,2). Build a k-d tree splitting on x first.',
        'Sort by x: 2, 4, 5, 7, 8, 9. Median falls between 5 and 7; pick (7,2) as root. Left child receives {(2,3), (5,4), (4,7)} where x < 7. Right child receives {(9,6), (8,1)} where x >= 7.',
        'Left subtree, depth 1, splits on y. Sort by y: 3, 4, 7. Median is (5,4). Left child: (2,3) (y < 4). Right child: (4,7) (y >= 4).',
        'Right subtree, depth 1, splits on y. Sort by y: 1, 6. Median is (8,1). Right child: (9,6) (y >= 1).',
        'Tree shape: root (7,2) splits x; left subtree (5,4) splits y with leaves (2,3) and (4,7); right subtree (8,1) splits y with leaf (9,6).',
        'Nearest-neighbor query for (6,3). Root (7,2) splits x. Query x=6 < 7, so descend left. Node (5,4) splits y. Query y=3 < 4, so descend left to leaf (2,3). Distance = sqrt((6-2)^2 + (3-3)^2) = 4.0. Best = 4.0.',
        'Backtrack to (5,4). Distance = sqrt(1+1) = 1.41. New best = 1.41. Split-plane distance to right child: |3 - 4| = 1.0 < 1.41, so the right subtree could hide a closer point. Descend to (4,7). Distance = sqrt(4+16) = 4.47. No improvement.',
        'Backtrack to root (7,2). Distance = sqrt(1+1) = 1.41. Ties the best. Split-plane distance to right subtree: |6 - 7| = 1.0 < 1.41, so the right side cannot be pruned. Descend to (8,1). Distance = sqrt(4+4) = 2.83. No improvement. Check (9,6). Distance = sqrt(9+9) = 4.24. No improvement.',
        'Result: (5,4) and (7,2) tie at distance sqrt(2) = 1.41. The pruning check failed both times -- split-plane distance 1.0 was less than best distance 1.41 -- so neither opposing subtree could be skipped. A one-sided descent would have returned (2,3) at distance 4.0, which is wrong. The backtracking is what makes k-d tree search correct.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Jon Bentley, "Multidimensional Binary Search Trees Used for Associative Searching," Communications of the ACM, 1975 -- the original paper introducing the k-d tree and alternating-axis construction. Friedman, Bentley, and Finkel, "An Algorithm for Finding Best Matches in Logarithmic Expected Time," ACM Transactions on Mathematical Software, 1977 -- developed the backtracking nearest-neighbor search with the split-plane pruning rule.',
        'Prerequisite: binary search tree -- k-d trees are BSTs generalized from one dimension to k. Understanding BST search, insertion, and the role of sorted order is essential.',
        'Alternative for spatial extents: R-tree -- indexes rectangles and polygons using overlapping bounding boxes. The right tool when data has area or volume, not bare points. Used in PostGIS and SQLite R*-tree.',
        'Alternative for moderate dimensions: ball tree -- partitions space with hyperspheres instead of axis-aligned planes. Sphere volume scales more gracefully than hyperrectangle volume, so ball trees often prune better than k-d trees in 10--30 dimensions.',
        'Alternative for general metrics: VP-tree (vantage-point tree) -- partitions by distance to a chosen vantage point. Works with any distance function, not just Euclidean coordinates.',
        'Alternative for high dimensions: locality-sensitive hashing -- trades exact answers for speed by hashing nearby points to the same bucket with high probability. The standard approach when dimensions are too high for tree-based pruning.',
        'Production nearest-neighbor at scale: HNSW (hierarchical navigable small-world graph) -- the dominant index for high-dimensional embedding search. Study HNSW after understanding why k-d trees fail in high dimensions. It solves the same problem with a navigable graph instead of space partitioning.',
      ],
    },
  ],
};
