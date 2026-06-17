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
      heading: 'Why this exists',
      paragraphs: [
        `A k-d tree exists for point data where one ordinary sorted order is not enough. A map point has x and y. A 3D scene point has x, y, and z. A nearest-neighbor query asks for closeness across all coordinates, not just one key.`,
        `The structure extends the binary search tree idea to k dimensions. Each level compares one coordinate and partitions space, so range and nearest-neighbor queries can skip regions that cannot contain an answer.`,
      ],
    },
    {
      heading: 'The reasonable baseline',
      paragraphs: [
        `The baseline is a scan. For a range query, test every point against the box. For nearest neighbor, compute every distance and keep the best. This is simple and correct, but each query costs O(n).`,
        `A sorted array on x helps only when the question is mostly about x. A point can be close in x and far in y, or far in x and close in y. One coordinate order does not preserve multidimensional closeness.`,
        `A uniform grid is another baseline for spatial data. It can be excellent when points are evenly spread and query radii are predictable. It performs badly when density varies or when the right cell size is unclear.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `The wall is that multidimensional data has no single natural line. Sorting by x destroys y order. Sorting by y destroys x order. Sorting by distance to one query does not help the next query.`,
        `Nearest-neighbor search has an extra trap. The closest point may lie across a split boundary. A tree that descends only one side can be fast and wrong. A correct structure needs a proof that the skipped side cannot contain a closer point.`,
      ],
    },
    {
      heading: 'Invariant and layout',
      paragraphs: [
        `A k-d tree is a binary tree of points. At depth d, it compares coordinate d mod k. In 2D, the split axes alternate x, y, x, y. In 3D, they cycle x, y, z.`,
        `Each node splits the region owned by that subtree with an axis-aligned plane through the node's coordinate on the active axis. The left subtree contains points below the split on that axis; the right subtree contains points at or above it, using the implementation's tie policy.`,
        `The invariant is regional. Every subtree owns a bounding region implied by all ancestor splits, and every point in that subtree lies inside that region.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `To build a balanced k-d tree, choose the active axis, select a median point by that coordinate, store it at the current node, and recurse on the lower and upper partitions with the next axis.`,
        `A range query visits a node only if its region overlaps the query box. If an entire subtree region is outside the box, every point inside that subtree is outside the answer, so the subtree can be skipped.`,
        `A nearest-neighbor query first descends toward the side that contains the query point. It records the best point found, then backtracks. At each split, it checks whether the other side could contain a closer point. If the distance from the query to the split plane is greater than the best distance, the other side is safe to prune.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Range pruning is correct because subtree regions are conservative containers. If a region does not overlap the query box, none of its points can be in the answer.`,
        `Nearest-neighbor pruning is correct because the best possible point across a split must be at least as far as the query's distance to the split plane, or to the subtree bounding box in stronger implementations. If that lower bound is already worse than the current best distance, searching the subtree cannot improve the answer.`,
        `The algorithm may search both sides when the proof is not strong enough. Correctness comes from pruning only after a region-bound argument, not from always following the side chosen by the first comparison.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `A balanced k-d tree uses O(n) space. A median-built tree has height O(log n). Building by repeated median selection is commonly O(n log n), though specialized selection can improve parts of the construction.`,
        `Low-dimensional queries often visit far fewer than n points because region pruning removes large parts of the tree. The worst case is still O(n), and nearest-neighbor search can approach that worst case on unlucky data or queries.`,
        `Performance degrades as dimension rises. In high dimensions, many regions are close to the query in at least one coordinate, so the lower bounds rarely prune. This is one form of the curse of dimensionality.`,
        `Dynamic updates are another tax. Inserting points one by one can unbalance the tree. Production implementations often rebuild periodically, use bucket leaves, or choose a different spatial index when updates dominate.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `k-d trees win in low-dimensional geometry: 2D maps, 3D point clouds, collision prefilters, ray-tracing support code, robotics localization, nearest color lookup, and clustering accelerators.`,
        `They are useful when the points are static or mostly static, dimensions are small, and exact answers matter. They also make a good teaching bridge from binary search trees to spatial indexes because the pruning proof is visible.`,
        `They can work as a prefilter: use the tree to cut the candidate set, then run an exact or more expensive test on the remaining points.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `A k-d tree is not a default vector database index. Embedding vectors often have hundreds or thousands of dimensions, and exact k-d tree pruning loses most of its force there. HNSW, product quantization, and other approximate methods usually fit that workload better.`,
        `It is also not the same as an R-tree. k-d trees index points by recursive coordinate splits. R-trees index rectangles or spatial extents and allow overlapping bounding boxes.`,
        `Skewed data, repeated coordinates, bad split choices, and heavy update streams can all erase the expected speedup. When every query region overlaps many subtrees, the tree becomes a complicated scan.`,
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        `Use squared distances for nearest-neighbor comparisons so the search avoids a square root on every candidate. Store subtree bounding boxes if nearest-neighbor speed matters; a box lower bound prunes more accurately than the split-plane test alone.`,
        `Build with medians for mostly static data, and define deterministic tie handling for repeated coordinates. If points arrive continuously, measure height and rebuild when the tree drifts too far from balanced. Also normalize coordinate scales when dimensions use different units, because a meter of x and a millisecond of y should not be treated as comparable distance without a deliberate metric.`,
      ],
    },
    {
      heading: 'Concrete example',
      paragraphs: [
        `With points (7,2), (5,4), (9,6), (2,3), and (4,7), the root can split on x at (7,2). Points with x < 7 go left; points with x >= 7 go right. The next level splits those subsets on y.`,
        `For query point (6,3), nearest-neighbor search may first descend toward (5,4). If that gives distance about 1.41, the algorithm still checks whether the other side of the x = 7 split could contain a closer point. The split-plane distance is 1, so the other side cannot be pruned yet. A fast but one-sided search would be wrong here.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Binary Search Tree first for one-dimensional comparison search. Study Range Tree and R-Tree for other spatial-query layouts, Quadtree or Octree for recursive space subdivision, and Delaunay Triangulation & Voronoi Dual for nearest-site geometry.`,
        `For high-dimensional approximate search, study HNSW, Product Quantization, and vector-search recall/latency tradeoffs. For clustering workloads, study K-Means after the nearest-neighbor mechanics are clear.`,
      ],
    },
  ],
};
