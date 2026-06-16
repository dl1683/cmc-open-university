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
        'This topic builds on Bounding Volume Hierarchy, Sweep-and-Prune Broad Phase, Spatial Hash Grid Broad Phase, R-Tree Spatial Index, and Interval Tree. It occupies a practical middle ground: more adaptive than a uniform grid, more mutable than a static render BVH, and better for ray or shape queries than a pure endpoint sweep in many game workloads.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'To insert a proxy, the tree chooses a sibling whose parent box grows cheaply, creates a new internal node, and updates ancestor bounds. To query, start with the root on a stack. If the query AABB or ray misses a node box, skip that node. If it hits an internal node, push its children. If it hits a leaf, report the object id as a broad-phase candidate.',
        'The dynamic part is the update policy. Engines often store fat AABBs that are slightly larger than the current object bounds. Small movement stays inside the fat proxy and avoids reinsertion. If the true AABB escapes the fat box, the engine removes the leaf and reinserts it with a fresh margin. Rotations, balancing heuristics, or periodic rebuilds keep the tree from degenerating.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Expected query cost depends on tree quality and output size. Good trees reject large subtrees quickly. Poor trees have overlapping internal boxes that force many branches to be visited. Insert, remove, and move operations cost tree walks and ancestor updates, often close to logarithmic in healthy trees but heuristic in practice.',
        'Fat proxies are a central tradeoff. Larger margins reduce update churn and preserve temporal coherence, but they increase false positives. Smaller margins produce tighter queries, but moving objects escape often and force more remove-insert work. The right margin depends on velocity, simulation step, object size, and contact tolerance.',
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
