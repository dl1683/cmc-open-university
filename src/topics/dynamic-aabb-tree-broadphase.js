// Dynamic AABB trees are mutable binary BVHs for broad-phase overlap and ray
// queries in games and physics engines.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'dynamic-aabb-tree-broadphase',
  title: 'Dynamic AABB Tree Broad Phase',
  category: 'Data Structures',
  summary: 'A mutable binary bounding-box tree: insert fat AABB proxies, rotate or rebuild as motion degrades quality, and query overlaps or rays without a fixed grid.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['query tree', 'update proxies'], defaultValue: 'query tree' },
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
      { id: 'root', label: 'root', x: 4.8, y: 0.8, note: 'union' },
      { id: 'left', label: 'L box', x: 2.5, y: 2.8, note: 'A+B' },
      { id: 'right', label: 'R box', x: 7.1, y: 2.8, note: 'C+D' },
      { id: 'a', label: 'A', x: 1.4, y: 5.2, note: 'proxy' },
      { id: 'b', label: 'B', x: 3.5, y: 5.2, note: 'proxy' },
      { id: 'c', label: 'C', x: 6.0, y: 5.2, note: 'proxy' },
      { id: 'd', label: 'D', x: 8.2, y: 5.2, note: 'proxy' },
      { id: 'query', label: 'query', x: 4.8, y: 6.8, note: 'AABB/ray' },
    ],
    edges: [
      { id: 'e-root-left', from: 'root', to: 'left' },
      { id: 'e-root-right', from: 'root', to: 'right' },
      { id: 'e-left-a', from: 'left', to: 'a' },
      { id: 'e-left-b', from: 'left', to: 'b' },
      { id: 'e-right-c', from: 'right', to: 'c' },
      { id: 'e-right-d', from: 'right', to: 'd' },
      { id: 'e-query-left', from: 'query', to: 'left' },
      { id: 'e-query-c', from: 'query', to: 'c' },
    ],
  }, { title });
}

function updateGraph(title) {
  return graphState({
    nodes: [
      { id: 'move', label: 'move', x: 0.8, y: 3.4, note: 'body' },
      { id: 'fat', label: 'fat AABB', x: 2.7, y: 1.8, note: 'margin' },
      { id: 'proxy', label: 'proxy', x: 2.7, y: 5.0, note: 'leaf' },
      { id: 'remove', label: 'remove', x: 4.8, y: 1.8, note: 'if escapes' },
      { id: 'insert', label: 'insert', x: 4.8, y: 5.0, note: 'best sibling' },
      { id: 'rotate', label: 'rotate', x: 6.9, y: 3.4, note: 'quality' },
      { id: 'query', label: 'query', x: 8.8, y: 3.4, note: 'overlaps' },
    ],
    edges: [
      { id: 'e-move-fat', from: 'move', to: 'fat' },
      { id: 'e-move-proxy', from: 'move', to: 'proxy' },
      { id: 'e-fat-remove', from: 'fat', to: 'remove' },
      { id: 'e-proxy-insert', from: 'proxy', to: 'insert' },
      { id: 'e-remove-rotate', from: 'remove', to: 'rotate' },
      { id: 'e-insert-rotate', from: 'insert', to: 'rotate' },
      { id: 'e-rotate-query', from: 'rotate', to: 'query' },
    ],
  }, { title });
}

function* queryTree() {
  const leafCount = 4;
  const internalCount = 3;
  const totalNodes = leafCount + internalCount + 1; // +1 for query node
  const edgeCount = 8;
  const broadPhaseApproaches = 4;

  yield {
    state: treeGraph('A dynamic AABB tree is a mutable binary BVH'),
    highlight: { active: ['root', 'left', 'right', 'e-root-left', 'e-root-right'], found: ['a', 'b', 'c', 'd'] },
    explanation: `Leaves are object proxies with axis-aligned bounding boxes. ${internalCount} internal nodes store the union of their two children, so overlap and ray queries can reject whole subtrees across all ${leafCount} leaves.`,
    invariant: `Every parent AABB contains both child AABBs — ${internalCount} containment guarantees in this ${totalNodes - 1}-node tree.`,
  };

  yield {
    state: treeGraph('Queries descend only into overlapping boxes'),
    highlight: { active: ['query', 'left', 'c', 'e-query-left', 'e-query-c'], removed: ['d'], compare: ['right'] },
    explanation: `An AABB query or ray cast starts at the root. Non-overlapping child boxes are skipped. Overlapping leaves among the ${leafCount} proxies become broad-phase candidates for exact tests.`,
  };

  yield {
    state: labelMatrix(
      'Tree node fields',
      [
        { id: 'box', label: 'AABB' },
        { id: 'parent', label: 'parent' },
        { id: 'child', label: 'children' },
        { id: 'leaf', label: 'leaf data' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why' },
      ],
      [
        ['fat bounds', 'cheap reject'],
        ['node index', 'relocate pool'],
        ['two indices', 'binary tree'],
        ['object id', 'callback payload'],
      ],
    ),
    highlight: { active: ['box:stores', 'child:stores'], found: ['leaf:why'], compare: ['parent:why'] },
    explanation: `Engines often store all ${totalNodes - 1} nodes in an array pool and refer to each by integer index rather than raw pointer. That makes allocation, relocation, and free-list reuse simpler for the ${leafCount} leaf proxies and ${internalCount} internal nodes.`,
  };

  yield {
    state: labelMatrix(
      'Dynamic tree versus neighbors',
      [
        { id: 'grid', label: 'hash grid' },
        { id: 'sap', label: 'SAP' },
        { id: 'bvh', label: 'static BVH' },
        { id: 'tree', label: 'dynamic tree' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'cost' },
      ],
      [
        ['similar sizes', 'cell tuning'],
        ['coherent axis', 'false positives'],
        ['static meshes', 'rebuild cost'],
        ['moving shapes', 'insert/remove'],
      ],
    ),
    highlight: { active: ['tree:fit', 'tree:cost'], compare: ['grid:cost', 'sap:cost'], found: ['bvh:fit'] },
    explanation: `A dynamic AABB tree is attractive when objects move, sizes vary, and ray/shape queries are frequent. Compared across ${broadPhaseApproaches} approaches, it pays tree-maintenance cost to avoid choosing one global cell size or sweep axis.`,
  };
}

function* updateProxies() {
  const pipelineSteps = 7;
  const pipelineEdges = 7;
  const updateDecisions = 4;
  const productionEngines = 2;

  yield {
    state: updateGraph('Fat proxies avoid reinserting on tiny motion'),
    highlight: { active: ['move', 'fat', 'proxy', 'e-move-fat', 'e-move-proxy'], found: ['query'] },
    explanation: `The broad phase usually stores a slightly enlarged, or fat, AABB around the current object box. The ${pipelineSteps}-step pipeline begins here: if the object moves inside that margin, the proxy can stay in the tree.`,
    invariant: `A fat proxy must still contain the true object AABB — this containment check drives ${updateDecisions} possible update decisions.`,
  };

  yield {
    state: labelMatrix(
      'Update decisions',
      [
        { id: 'inside', label: 'inside fat box' },
        { id: 'escape', label: 'escapes fat box' },
        { id: 'new', label: 'new object' },
        { id: 'sleep', label: 'sleeping body' },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'reason' },
      ],
      [
        ['keep proxy', 'cheap frame'],
        ['remove + insert', 'restore bounds'],
        ['insert leaf', 'find sibling'],
        ['leave alone', 'no motion'],
      ],
    ),
    highlight: { active: ['inside:action', 'escape:action'], found: ['sleep:reason'], compare: ['new:action'] },
    explanation: `Margins trade extra false positives for fewer tree edits across all ${updateDecisions} decision cases. Too small and moving objects churn. Too large and queries return too many candidates.`,
  };

  yield {
    state: updateGraph('Insertion chooses a sibling that grows the tree least'),
    highlight: { active: ['remove', 'insert', 'rotate', 'e-remove-rotate', 'e-insert-rotate'], compare: ['fat'], found: ['query'] },
    explanation: `Insertion walks the tree using a cost heuristic, usually based on AABB perimeter or surface-area growth. After insertion, the ${pipelineSteps - 4}-step repair cycle — remove, insert, rotate — improves tree quality.`,
  };

  yield {
    state: labelMatrix(
      'Production case study',
      [
        { id: 'box2d', label: 'Box2D' },
        { id: 'bullet', label: 'Bullet DBVT' },
        { id: 'raycast', label: 'ray casts' },
        { id: 'quality', label: 'tree quality' },
      ],
      [
        { id: 'choice', label: 'choice' },
        { id: 'lesson' },
      ],
      [
        ['binary AABB tree', 'broad phase'],
        ['dynamic + static sets', 'moving worlds'],
        ['stack traversal', 'fast queries'],
        ['rotations/rebuild', 'avoid degradation'],
      ],
    ),
    highlight: { active: ['box2d:choice', 'bullet:choice'], found: ['raycast:lesson'], compare: ['quality:lesson'] },
    explanation: `${productionEngines} production engines validate this pattern: Box2D exposes its dynamic tree for game data beyond rigid bodies, and Bullet DBVT uses dynamic AABB trees for broad phase with separate handling for dynamic and fixed sets.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'query tree') yield* queryTree();
  else if (view === 'update proxies') yield* updateProxies();
  else throw new InputError('Pick a dynamic-AABB-tree view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has two views, selectable at the top. "Query tree" shows a binary tree of bounding boxes: internal nodes are union boxes, leaves are object proxies, and a query shape tests nodes from root to leaves. Highlighted nodes are being tested; dimmed nodes were pruned because their parent box missed the query.',
        {type: 'image', src: './assets/gifs/dynamic-aabb-tree-broadphase.gif', alt: 'Animated walkthrough of the dynamic aabb tree broadphase visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        '"Update proxies" shows the maintenance pipeline: a body moves, the engine checks whether the true AABB still fits inside its fat proxy, and if not, removes and reinserts the leaf. Rotations at the end improve tree quality. Watch the pipeline left to right to see how each moving object triggers at most one remove-insert-rotate cycle per frame.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Physics engines and games need to find which objects might be touching before running expensive exact-geometry tests. This is the broad phase: a cheap filter that returns a superset of real collisions. The narrow phase then checks only those candidates with precise shape math.',
        'Without a broad phase, testing every pair of N objects costs N*(N-1)/2 overlap checks per frame. With 1,000 objects that is 499,500 checks. A good broad phase reduces this to something closer to N*log(N) by organizing objects spatially so most impossible pairs are never tested.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Build a bounding volume hierarchy (BVH) once and query it. A BVH groups objects into nested axis-aligned bounding boxes (AABBs -- rectangles in 2D, boxes in 3D, defined by a min corner and max corner on each axis). Queries walk the tree from the root: if the query shape misses a node\'s AABB, skip it and all its descendants; if it overlaps, descend into children.',
        {type: 'callout', text: 'A dynamic AABB tree is a living broad-phase proof: a missed parent box proves every descendant can be skipped.'},
        'A static BVH built offline with optimal splits can reject most of the scene in a few comparisons. For a ray cast through 10,000 triangles, a well-built BVH might visit only 30-50 nodes instead of all 10,000.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Objects in a game move every frame. A BVH built at time 0 becomes wrong at time 1 because the AABBs no longer contain their objects. Rebuilding the entire tree from scratch every frame -- sorting, partitioning, allocating -- can cost O(N*log(N)) and destroy cache locality from the previous frame.',
        'The alternative, all-pairs brute force, is worse. There is a gap between "rebuild everything" and "check everything." The wall is: how do you maintain a spatial index that stays correct and reasonably balanced while objects move continuously?',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Store each object behind a fat AABB -- a bounding box slightly larger than the true shape. Small movements stay inside the fat box, so the tree node does not move. Only when an object escapes its fat proxy does the engine remove and reinsert the leaf. This converts continuous motion into rare, discrete tree edits.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Example_of_bounding_volume_hierarchy.svg/500px-Example_of_bounding_volume_hierarchy.svg.png', alt: 'Bounding volume hierarchy showing objects grouped inside nested rectangles', caption: 'BVH nesting shows the same invariant dynamic AABB trees maintain while objects move. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Example_of_bounding_volume_hierarchy.svg.'},
        'The fat margin trades false positives (the proxy is larger than the real shape, so some queries hit it unnecessarily) for stability (most frames require zero tree mutations). A typical margin is 2-10% of the object\'s size, tuned per game.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each leaf node stores an object ID and a fat AABB. Each internal node stores the union AABB of its two children -- the smallest AABB enclosing both. The root\'s AABB therefore encloses every object in the scene.',
        'Insertion: given a new leaf, walk the tree choosing at each internal node which child would grow its AABB the least if the new leaf joined it. The cost metric is usually the increase in surface area (3D) or perimeter (2D) of the child\'s AABB. Create a new internal node to be the parent of the chosen sibling and the new leaf, then walk back to the root updating ancestor AABBs.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/BVHtree_travelsal.png/250px-BVHtree_travelsal.png', alt: 'BVH tree and flattened traversal order diagram', caption: 'Traversal can be implemented as an explicit stack or flattened node order, but the logic is the same: test a bound before visiting children. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:BVHtree_travelsal.png.'},
        'Query: push the root onto a stack. Pop a node. If the query AABB misses the node\'s AABB, skip it. If the node is a leaf and overlaps, report it as a candidate. If the node is internal and overlaps, push both children. This visits only the nodes whose ancestor chain all overlapped the query.',
        'Update: each frame, for every moved object, check if its true AABB still fits inside its fat proxy. If yes, do nothing. If no, remove the leaf (detach it, connect its sibling to its grandparent, update ancestor AABBs), compute a new fat AABB, and reinsert. After insertions, optionally rotate subtrees to reduce tree height.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness relies on one invariant: every internal node\'s AABB contains both children\'s AABBs. If a query misses an internal node, it misses every descendant, because every descendant is geometrically inside that node\'s box. Pruning is safe regardless of tree shape or balance. The tree can be lopsided and still produce correct results -- it just visits more nodes.',
        'Performance relies on tree quality. A well-structured tree has internal AABBs that are tight (not much wasted empty space) and non-overlapping between siblings (so a query hits one child, not both). Surface-area heuristic insertion and periodic rotations maintain this quality. Fat proxies ensure the tree structure is stable across frames, amortizing the O(log N) insertion cost over many frames of small motion.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Insertion walks from root to a leaf to find the best sibling, then back up to update ancestor AABBs. In a balanced tree of N leaves this is O(log N). Removal detaches a leaf and updates ancestors: O(log N). Query visits every overlapping node, so cost depends on how many subtrees the query overlaps -- best case O(log N) when the query is small and the tree is tight, worst case O(N) when the query covers the whole scene or the tree is degenerate.',
        'The fat margin directly controls the tradeoff. Box2D uses a fixed expansion of 0.1 length units on each side. If objects move less than 0.1 units per frame, most frames have zero reinsertions. If objects teleport, every proxy escapes and the frame costs N insertions at O(log N) each.',
        'Memory is one node per leaf plus at most N-1 internal nodes (a binary tree property), so 2N-1 nodes total. Each node stores an AABB (4 floats in 2D, 6 in 3D), parent index, two child indices, and a height or leaf payload -- roughly 40-60 bytes per node. For 10,000 objects: about 800 KB.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Box2D uses a dynamic AABB tree as its sole broad phase. Every rigid body gets a proxy; the tree accelerates AABB overlap queries and ray casts. Box2D also exposes the tree directly so game code can index non-physics spatial data (trigger regions, sensor zones, AI sight cones) against the same structure.',
        'Bullet Physics uses a "DBVT" (dynamic bounding volume tree) broad phase. It maintains separate trees for dynamic and static objects so static geometry never triggers reinsertions. Havok, PhysX, and Godot\'s physics pipelines use similar hierarchical broad phases tuned for their target platforms.',
        'Beyond physics: game engines use dynamic AABB trees for frustum culling (which objects are visible?), audio occlusion (which walls block sound?), and spatial queries for AI (which enemies are within 50 meters?). Any problem where objects move and you need fast region or ray queries is a candidate.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Uniform grids win when all objects are roughly the same size and distributed evenly. A grid\'s O(1) cell lookup beats the tree\'s O(log N) descent. Games with thousands of same-size particles (bullet hell, fluid particles) often prefer a hash grid.',
        'Sweep-and-prune wins when motion is strongly coherent along one axis. SAP maintains sorted endpoint lists and reports changes incrementally; its per-frame cost can be lower than tree maintenance when objects mostly slide along one direction.',
        'The tree degrades if objects cluster tightly, because internal AABBs overlap heavily and queries must visit both children at every level. It also degrades if fat margins are wrong: too large means false positives dominate, too small means constant reinsertion churn. Without runtime metrics (tree height, node visits per query, reinserts per frame), there is no way to detect or fix degradation.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Four bodies: A at [0,0]-[2,2], B at [1,3]-[3,5], C at [6,0]-[8,2], D at [7,3]-[9,5]. The tree groups A+B under left internal node L with AABB [0,0]-[3,5], and C+D under right internal node R with AABB [6,0]-[9,5]. The root has AABB [0,0]-[9,5].',
        'A query box Q = [0.5,0.5]-[2.5,4] overlaps the root (always does). Test L: Q overlaps [0,0]-[3,5], so descend. Test A: Q overlaps [0,0]-[2,2], report A as candidate. Test B: Q overlaps [1,3]-[3,5], report B. Test R: Q does not overlap [6,0]-[9,5] (Q.xMax=2.5 < R.xMin=6), prune. Total: 5 AABB tests instead of 4 leaf tests -- but with 1,000 leaves under R, pruning R would skip 1,000 tests in one comparison.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/BVH_Splitting_Plane.png/250px-BVH_Splitting_Plane.png', alt: 'BVH splitting plane examples showing high and low overlap partitions', caption: 'Split quality matters because overlapping child boxes force the query to visit both sides. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:BVH_Splitting_Plane.png.'},
        'Now body B moves from [1,3]-[3,5] to [1.05,3.02]-[3.05,5.02]. Its fat proxy is [0.9,2.9]-[3.1,5.1]. The true AABB [1.05,3.02]-[3.05,5.02] fits inside [0.9,2.9]-[3.1,5.1], so no tree edit happens. Next frame B moves to [2,4]-[4,6]. Now 4 > 3.1 (fat proxy xMax), so B escapes. Remove B\'s leaf, compute new fat AABB [1.9,3.9]-[4.1,6.1], and reinsert. The insertion heuristic picks the sibling whose AABB grows least by perimeter: joining L (current perimeter 16) costs less than joining R (perimeter 28 and far away), so B stays on the left side.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Erin Catto, "Dynamic Bounding Volume Hierarchies," GDC 2019: https://box2d.org/files/ErinCatto_DynamicBVH_GDC2019.pdf. Box2D dynamic tree API documentation: https://box2d.org/documentation/group__tree.html. Bullet btDbvtBroadphase source and docs: https://pybullet.org/Bullet/BulletFull/structbtDbvtBroadphase.html. GDC talk on dynamic BVH for games: https://gdcvault.com/play/1026269/Math-for-Game-Developers-Dynamic.',
        'Study next: Bounding Volume Hierarchy (the static version this builds on), Sweep-and-Prune Broad Phase (the main competitor for coherent motion), Spatial Hash Grid Broad Phase (the main competitor for uniform objects), R-Tree Spatial Index (a disk-oriented cousin with different split strategies), and Interval Tree (the 1D version of range queries that BVH generalizes to higher dimensions).',
      ],
    },
  ],
};
