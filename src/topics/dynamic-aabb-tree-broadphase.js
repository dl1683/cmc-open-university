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
  yield {
    state: treeGraph('A dynamic AABB tree is a mutable binary BVH'),
    highlight: { active: ['root', 'left', 'right', 'e-root-left', 'e-root-right'], found: ['a', 'b', 'c', 'd'] },
    explanation: 'Leaves are object proxies with axis-aligned bounding boxes. Internal nodes store the union of their two children, so overlap and ray queries can reject whole subtrees.',
    invariant: 'Every parent AABB contains both child AABBs.',
  };

  yield {
    state: treeGraph('Queries descend only into overlapping boxes'),
    highlight: { active: ['query', 'left', 'c', 'e-query-left', 'e-query-c'], removed: ['d'], compare: ['right'] },
    explanation: 'An AABB query or ray cast starts at the root. Non-overlapping child boxes are skipped. Overlapping leaves become broad-phase candidates for exact tests.',
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
    explanation: 'Engines often store nodes in an array pool and refer to nodes by integer index rather than raw pointer. That makes allocation, relocation, and free-list reuse simpler.',
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
    explanation: 'A dynamic AABB tree is attractive when objects move, sizes vary, and ray/shape queries are frequent. It pays tree-maintenance cost to avoid choosing one global cell size or sweep axis.',
  };
}

function* updateProxies() {
  yield {
    state: updateGraph('Fat proxies avoid reinserting on tiny motion'),
    highlight: { active: ['move', 'fat', 'proxy', 'e-move-fat', 'e-move-proxy'], found: ['query'] },
    explanation: 'The broad phase usually stores a slightly enlarged, or fat, AABB around the current object box. If the object moves inside that margin, the proxy can stay in the tree.',
    invariant: 'A fat proxy must still contain the true object AABB.',
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
    explanation: 'Margins trade extra false positives for fewer tree edits. Too small and moving objects churn. Too large and queries return too many candidates.',
  };

  yield {
    state: updateGraph('Insertion chooses a sibling that grows the tree least'),
    highlight: { active: ['remove', 'insert', 'rotate', 'e-remove-rotate', 'e-insert-rotate'], compare: ['fat'], found: ['query'] },
    explanation: 'Insertion walks the tree using a cost heuristic, usually based on AABB perimeter or surface-area growth. After insertion, rotations or rebuilds improve tree quality.',
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
    explanation: 'Box2D exposes its dynamic tree for game data beyond rigid bodies. Bullet DBVT uses dynamic AABB trees for broad phase, with separate handling for dynamic and fixed sets.',
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
      heading: 'What it is',
      paragraphs: [
        'A dynamic AABB tree is a mutable binary bounding-volume hierarchy for axis-aligned bounding boxes. Leaves are proxies for game objects or shapes. Internal nodes store AABBs that contain both children. Queries descend through overlapping boxes and skip subtrees that cannot contribute a result.',
        {type: 'callout', text: 'A dynamic AABB tree is a living broad-phase proof: a missed parent box proves every descendant can be skipped.'},
        'This topic builds on Bounding Volume Hierarchy, Sweep-and-Prune Broad Phase, Spatial Hash Grid Broad Phase, R-Tree Spatial Index, and Interval Tree. It occupies a practical middle ground: more adaptive than a uniform grid, more mutable than a static render BVH, and better for ray or shape queries than a pure endpoint sweep in many game workloads.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The broad phase should answer a cheap question before the physics engine asks an expensive one: which objects could possibly overlap? A dynamic AABB tree keeps conservative boxes around moving objects so most impossible pairs can be rejected before exact geometry tests run.',
        'The structure works because every internal box is a promise about all descendants. If a query misses that box, it misses every object below it. If it hits the box, the tree descends and eventually returns candidate leaves. Correctness comes from containment; performance comes from keeping those containment boxes tight enough.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Example_of_bounding_volume_hierarchy.svg/500px-Example_of_bounding_volume_hierarchy.svg.png', alt: 'Bounding volume hierarchy showing objects grouped inside nested rectangles', caption: 'BVH nesting shows the same invariant dynamic AABB trees maintain while objects move. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Example_of_bounding_volume_hierarchy.svg.'},
      ],
    },
    {
      heading: 'Why it exists',
      paragraphs: [
        'A static BVH is excellent until objects move. Rebuilding from scratch every frame can be too expensive, while all-pairs testing throws away spatial structure. The wall is a broad phase that must survive continuous insert, remove, and move operations.',
        'A dynamic AABB tree stores fat bounding boxes in a mutable BVH. Small movements stay inside the fat box and avoid reinsertion; larger movements remove and reinsert the proxy. It is correct because each internal AABB conservatively contains its children, so a query can prune any subtree whose bound cannot overlap the test shape.',
      ],
    },
    {
      heading: 'Reading the visualization',
      paragraphs: [
        'In the query-tree view, every internal node is a conservative promise: all leaves under it fit inside that box. When the query misses an internal box, the whole subtree can be ignored without inspecting individual objects. When it overlaps, the tree descends because some child might still be a candidate.',
        'In the update-proxies view, focus on the maintenance policy. A moving object is allowed to drift inside a fat AABB so the tree does not churn on tiny movements. When it escapes that margin, the old leaf is removed, a new fat proxy is inserted, and rotations or rebuilds repair tree quality. The animation is showing a living index, not a static spatial partition.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'To insert a proxy, the tree chooses a sibling whose parent box grows cheaply, creates a new internal node, and updates ancestor bounds. To query, start with the root on a stack. If the query AABB or ray misses a node box, skip that node. If it hits an internal node, push its children. If it hits a leaf, report the object id as a broad-phase candidate.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/BVHtree_travelsal.png/250px-BVHtree_travelsal.png', alt: 'BVH tree and flattened traversal order diagram', caption: 'Traversal can be implemented as an explicit stack or flattened node order, but the logic is the same: test a bound before visiting children. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:BVHtree_travelsal.png.'},
        'The dynamic part is the update policy. Engines often store fat AABBs that are slightly larger than the current object bounds. Small movement stays inside the fat proxy and avoids reinsertion. If the true AABB escapes the fat box, the engine removes the leaf and reinserts it with a fresh margin. Rotations, balancing heuristics, or periodic rebuilds keep the tree from degenerating.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Imagine four bodies A, B, C, and D. The left internal node contains the union of A and B, the right internal node contains the union of C and D, and the root contains both sides. A query box that overlaps the left internal node but misses most of the right side can skip D immediately. It may still test C if C lies inside an overlapping right-side bound.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/BVH_Splitting_Plane.png/250px-BVH_Splitting_Plane.png', alt: 'BVH splitting plane examples showing high and low overlap partitions', caption: 'Split quality matters because overlapping child boxes force the query to visit both sides. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:BVH_Splitting_Plane.png.'},
        'Now let body B move a small distance. If B still fits inside its fat proxy, the tree does nothing and accepts a little extra false-positive area. If B escapes, the proxy is removed and reinserted near the sibling that causes the smallest perimeter or surface-area growth. That heuristic is why this is a broad-phase engineering structure rather than a purely sorted container.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is conservative. A parent AABB must contain both children. If a query does not overlap the parent, it cannot overlap any descendant, because every descendant is spatially inside that parent. This makes pruning safe even though the tree is only an approximation of object geometry.',
        'The performance argument is heuristic. Good sibling choices, bounded fat margins, rotations, and rebuilds keep internal boxes tight enough that queries reject large regions. The tree does not guarantee the perfect partition a static offline builder might produce; it stays useful by repairing itself incrementally as objects move.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Expected query cost depends on tree quality and output size. Good trees reject large subtrees quickly. Poor trees have overlapping internal boxes that force many branches to be visited. Insert, remove, and move operations cost tree walks and ancestor updates, often close to logarithmic in healthy trees but heuristic in practice.',
        'Fat proxies are a central tradeoff. Larger margins reduce update churn and preserve temporal coherence, but they increase false positives. Smaller margins produce tighter queries, but moving objects escape often and force more remove-insert work. The right margin depends on velocity, simulation step, object size, and contact tolerance.',
        'Measure the structure as it runs. Useful counters include tree height, area ratio, maximum balance, proxy count, node visits per query, leaf hits per query, and reinserts per frame. Those counters tell whether to tune margins, rotate more aggressively, or rebuild a degraded tree.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Box2D documents its dynamic tree as a binary AABB tree used internally to organize collision shapes and accelerate AABB queries and ray casts. It stores relocatable pooled nodes by index, exposes proxy creation and movement, and can be used independently of the rigid-body solver for other game spatial data.',
        'Bullet has a related dynamic bounding volume tree broad phase. Its documentation describes separate dynamic and fixed sets, with objects moving between them. That design highlights the operational lesson: broad phase is not just a data structure, but a maintenance policy for moving, sleeping, static, and frequently queried objects.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A dynamic AABB tree is not automatically balanced or optimal. Bad insertion order, large false-positive margins, or chaotic movement can degrade quality. The implementation needs metrics such as tree height, area ratio, proxy count, and query node visits so it can rotate, rebuild, or tune margins when performance drifts.',
        'It also does not replace narrow phase. A leaf hit means the query overlaps a proxy box. The engine still needs exact shape overlap, ray-shape intersection, or contact manifold generation before applying physics or returning visible gameplay results.',
        'The most common failure is treating the tree as a set-and-forget index. Moving worlds age the structure. Without quality metrics, fat-margin tuning, and occasional rotations or rebuilds, the tree can slowly become a broad-phase tax instead of an acceleration structure.',
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        'Represent each node with parent, two children, AABB bounds, height, and leaf payload or object id. Use a node pool or free list if the engine creates and destroys proxies frequently. Keep broad-phase candidates separate from final contacts so false positives remain cheap.',
        'Choose insertion cost by growth in perimeter or surface area, then update ancestors on the way back to the root. If motion is predictable, expand fat proxies in the velocity direction as well as by a fixed margin. That reduces churn for fast objects without making every side equally loose.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Box2D dynamic tree documentation at https://box2d.org/documentation/group__tree.html, Erin Catto Dynamic AABB Trees slides at https://box2d.org/files/ErinCatto_DynamicBVH_GDC2019.pdf, Bullet btDbvt broadphase docs at https://pybullet.org/Bullet/BulletFull/structbtDbvtBroadphase.html, and GDC dynamic BVH overview at https://gdcvault.com/play/1026269/Math-for-Game-Developers-Dynamic. Study Bounding Volume Hierarchy, Sweep-and-Prune Broad Phase, Spatial Hash Grid Broad Phase, R-Tree Spatial Index, Archetype ECS Column Store, Convex Hull: Monotone Chain, Sweep Line Segment Intersection, and Interval Tree next.',
      ],
    },
  ],
};
