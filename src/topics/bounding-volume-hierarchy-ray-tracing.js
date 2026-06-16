// Bounding Volume Hierarchy (BVH): group geometry under bounding boxes so rays,
// overlaps, and collision checks can reject large sets before touching triangles.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'bounding-volume-hierarchy-ray-tracing',
  title: 'Bounding Volume Hierarchy for Ray Tracing',
  category: 'Data Structures',
  summary: 'A tree of bounding boxes around geometry: test cheap boxes first, skip whole subtrees on misses, and visit triangles only when a ray or collision query gets close.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['ray traversal', 'build and refit'], defaultValue: 'ray traversal' },
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

function bvhGraph(title) {
  return graphState({
    nodes: [
      { id: 'ray', label: 'ray', x: 0.9, y: 5.7, note: 'query' },
      { id: 'root', label: 'root box', x: 4.8, y: 0.9, note: 'scene' },
      { id: 'left', label: 'left box', x: 2.7, y: 2.9, note: 'near' },
      { id: 'right', label: 'right box', x: 6.9, y: 2.9, note: 'far' },
      { id: 'triA', label: 'tri A', x: 1.8, y: 5.2, note: 'hit?' },
      { id: 'triB', label: 'tri B', x: 3.6, y: 5.2, note: 'hit?' },
      { id: 'triC', label: 'tri C', x: 6.1, y: 5.2, note: 'skip' },
      { id: 'triD', label: 'tri D', x: 7.9, y: 5.2, note: 'skip' },
      { id: 'hit', label: 'closest', x: 9.1, y: 5.7, note: 'answer' },
    ],
    edges: [
      { id: 'e-root-left', from: 'root', to: 'left' },
      { id: 'e-root-right', from: 'root', to: 'right' },
      { id: 'e-left-a', from: 'left', to: 'triA' },
      { id: 'e-left-b', from: 'left', to: 'triB' },
      { id: 'e-right-c', from: 'right', to: 'triC' },
      { id: 'e-right-d', from: 'right', to: 'triD' },
      { id: 'e-ray-left', from: 'ray', to: 'left' },
      { id: 'e-ray-hit', from: 'ray', to: 'hit' },
    ],
  }, { title });
}

function buildGraph(title) {
  return graphState({
    nodes: [
      { id: 'prims', label: 'prims', x: 0.8, y: 3.4, note: 'triangles' },
      { id: 'centroid', label: 'centroids', x: 2.7, y: 1.8, note: 'sort' },
      { id: 'split', label: 'split', x: 4.7, y: 1.8, note: 'SAH/bin' },
      { id: 'leaves', label: 'leaves', x: 2.7, y: 5.0, note: 'small sets' },
      { id: 'parent', label: 'parent', x: 4.7, y: 5.0, note: 'merge boxes' },
      { id: 'tree', label: 'BVH', x: 6.8, y: 3.4, note: 'accel' },
      { id: 'refit', label: 'refit', x: 8.8, y: 3.4, note: 'animate' },
    ],
    edges: [
      { id: 'e-prims-centroid', from: 'prims', to: 'centroid' },
      { id: 'e-centroid-split', from: 'centroid', to: 'split' },
      { id: 'e-prims-leaves', from: 'prims', to: 'leaves' },
      { id: 'e-leaves-parent', from: 'leaves', to: 'parent' },
      { id: 'e-split-tree', from: 'split', to: 'tree' },
      { id: 'e-parent-tree', from: 'parent', to: 'tree' },
      { id: 'e-tree-refit', from: 'tree', to: 'refit' },
    ],
  }, { title });
}

function* rayTraversal() {
  yield {
    state: bvhGraph('A BVH wraps geometry in nested bounding boxes'),
    highlight: { active: ['root', 'left', 'right', 'e-root-left', 'e-root-right'], found: ['triA', 'triB', 'triC', 'triD'] },
    explanation: 'A bounding volume hierarchy stores real primitives in leaves and cheap bounding boxes in internal nodes. The root box contains the whole scene; child boxes contain smaller primitive groups.',
    invariant: 'If a ray misses a box, it misses every primitive inside that box.',
  };

  yield {
    state: bvhGraph('Traversal tests the ray against cheap boxes first'),
    highlight: { active: ['ray', 'root', 'left', 'e-ray-left'], compare: ['right'], removed: ['triC', 'triD'] },
    explanation: 'The query first checks ray-box intersections. If the ray misses a child box, all triangles under that child are skipped before any expensive ray-triangle tests run.',
  };

  yield {
    state: bvhGraph('Only surviving leaves run exact primitive tests'),
    highlight: { active: ['triA', 'triB', 'e-left-a', 'e-left-b'], found: ['hit', 'e-ray-hit'], removed: ['right', 'triC', 'triD'] },
    explanation: 'After box pruning, the renderer or physics engine tests the remaining triangles exactly. For closest-hit ray tracing, nearer child boxes are usually visited first so farther work can be pruned by the current best distance.',
  };

  yield {
    state: labelMatrix(
      'Traversal cost model',
      [
        { id: 'box', label: 'box test' },
        { id: 'tri', label: 'triangle test' },
        { id: 'order', label: 'near-first' },
        { id: 'wide', label: 'wide nodes' },
      ],
      [
        { id: 'why', label: 'why' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['cheap reject', 'many'],
        ['exact answer', 'expensive'],
        ['prune far hits', 'sort/stack'],
        ['SIMD/GPU fit', 'more child tests'],
      ],
    ),
    highlight: { active: ['box:why', 'tri:cost'], found: ['order:why'], compare: ['wide:cost'] },
    explanation: 'BVH performance is not just Big-O. It depends on box quality, memory layout, ray coherence, traversal order, SIMD width, and whether triangles are static, deforming, or instanced.',
  };
}

function* buildAndRefit() {
  yield {
    state: buildGraph('BVH construction partitions primitives, not empty space'),
    highlight: { active: ['prims', 'centroid', 'split', 'e-prims-centroid', 'e-centroid-split'], found: ['tree'] },
    explanation: 'A BVH builder groups primitives by their positions or bounding boxes. Unlike a quadtree, it does not split all of space evenly; it partitions the primitive set into useful groups.',
    invariant: 'Internal boxes are the union of child boxes.',
  };

  yield {
    state: labelMatrix(
      'Build heuristics',
      [
        { id: 'median', label: 'median split' },
        { id: 'sah', label: 'SAH split' },
        { id: 'lbvh', label: 'LBVH' },
        { id: 'wide', label: 'wide BVH' },
      ],
      [
        { id: 'strength', label: 'strength' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['simple balance', 'lower quality'],
        ['lower trace cost', 'build CPU'],
        ['GPU friendly', 'quality varies'],
        ['fast traversal', 'layout work'],
      ],
    ),
    highlight: { active: ['sah:strength', 'sah:tradeoff'], found: ['lbvh:strength'], compare: ['median:tradeoff'] },
    explanation: 'The surface-area heuristic estimates future traversal cost. Production renderers often pay more build work for static scenes and use faster approximate builders for dynamic or GPU-built scenes.',
  };

  yield {
    state: buildGraph('Refit updates boxes when primitives move a little'),
    highlight: { active: ['leaves', 'parent', 'tree', 'refit', 'e-leaves-parent', 'e-parent-tree', 'e-tree-refit'], compare: ['split'] },
    explanation: 'For animation, a system can refit existing nodes by recomputing parent boxes from changed leaves. Refit is fast but tree quality can degrade if objects move far from their original groups.',
  };

  yield {
    state: labelMatrix(
      'Real-time graphics pipeline',
      [
        { id: 'blas', label: 'BLAS' },
        { id: 'tlas', label: 'TLAS' },
        { id: 'instance', label: 'instance' },
        { id: 'shader', label: 'shader ray' },
      ],
      [
        { id: 'contains', label: 'contains' },
        { id: 'lesson' },
      ],
      [
        ['mesh triangles', 'per-object accel'],
        ['instances', 'scene-level accel'],
        ['transform + material', 'reuse mesh BVH'],
        ['traverse + shade', 'data structure on hot path'],
      ],
    ),
    highlight: { active: ['blas:contains', 'tlas:contains'], found: ['shader:lesson'], compare: ['instance:lesson'] },
    explanation: 'Modern ray-tracing APIs commonly separate bottom-level acceleration structures for mesh geometry from top-level structures for instances. That lets scenes reuse mesh BVHs while moving objects through transforms.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'ray traversal') yield* rayTraversal();
  else if (view === 'build and refit') yield* buildAndRefit();
  else throw new InputError('Pick a BVH view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A bounding volume hierarchy, or BVH, is a tree over geometric objects. Leaves store primitives such as triangles, curves, or collision shapes. Internal nodes store bounding volumes, most often axis-aligned bounding boxes, that enclose every primitive below them. A query tests the cheap volume first and descends only when the volume might contain an answer.',
        'This topic builds on R-Tree Spatial Index, k-d Tree, Quadtree Spatial Index & Map Tiles, and Interval Tree. The contrast is important: quadtrees and grids subdivide space; BVHs subdivide the primitive set. That makes BVHs a natural fit for ray tracing, game collision broad phases, CAD selection, physics, and scenes with complex meshes.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Ray traversal starts at the root. If the ray misses the root box, the entire scene is skipped. If it hits, traversal tests child boxes. A miss rejects every primitive below that child. A hit descends until leaves are reached, where exact ray-triangle or shape tests run. Closest-hit traversal usually visits nearer child boxes first and prunes farther nodes when their entry distance cannot beat the current best hit.',
        'Construction groups primitives into leaves and recursively builds parent boxes. Simple builders split by median centroid. Higher-quality builders estimate cost with the surface-area heuristic, or SAH, which trades build time for fewer traversal tests later. GPU and real-time systems often use faster approximate builders, wide nodes, compact memory layouts, and specialized traversal kernels.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A BVH uses O(n) storage for n primitives. Build time ranges from near-linear approximate builders to more expensive high-quality SAH builders. Query time depends on scene distribution, box overlap, ray coherence, memory locality, and traversal order. In bad layouts, many boxes overlap and the ray descends into too many branches. In good layouts, most rays reject large parts of the scene with a handful of box tests.',
        'Dynamic scenes add another dimension. If vertices deform or objects move, the system can refit boxes bottom-up instead of rebuilding the tree. Refit is fast, but tree quality can deteriorate as objects drift away from the groups chosen by the original builder. Engines therefore mix refit, partial rebuild, full rebuild, and instance-level transforms depending on motion and latency budget.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A path tracer needs to answer billions of ray-scene intersection queries. Without an acceleration structure, every ray would test every triangle. With a BVH, each ray walks a hierarchy of boxes, rejects entire mesh regions, and tests exact triangles only in surviving leaves. The speedup is not just algorithmic; it is what makes physically based rendering and real-time ray tracing practical on modern CPUs and GPUs.',
        'A real-time engine often separates bottom-level acceleration structures for mesh triangles from top-level acceleration structures for scene instances. If a car mesh appears ten times, its mesh BVH can be reused while each instance has a transform in the top-level tree. Moving objects may refit or rebuild their local structures, while static environment geometry can use a higher-quality build created offline.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The first misconception is that a BVH is the same as an R-tree. Both store bounding boxes, but an R-tree is a balanced dynamic spatial index often used in databases, while a BVH is usually optimized around traversal throughput over render or physics primitives. Another misconception is that build quality is free. Better splits reduce ray work but cost CPU or GPU time during construction.',
        'BVHs also do not remove exact tests. A box hit means maybe. The final ray-triangle, triangle-triangle, or shape predicate still decides the real collision or visible surface. The hierarchy is a broad-phase filter that earns its keep by making the exact phase small.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: PBRT BVH chapter at https://www.pbr-book.org/3ed-2018/Primitives_and_Intersection_Acceleration/Bounding_Volume_Hierarchies, Intel BVH construction article at https://www.intel.com/content/www/us/en/developer/articles/technical/bvh-construction.html, and the JCGT BVH performance comparison at https://jcgt.org/published/0011/04/01/. Study R-Tree Spatial Index, k-d Tree, Quadtree Spatial Index & Map Tiles, Interval Tree, and Big-O Growth next.',
      ],
    },
  ],
};
