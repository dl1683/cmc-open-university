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
  const hl1 = { active: ['root', 'left', 'right', 'e-root-left', 'e-root-right'], found: ['triA', 'triB', 'triC', 'triD'] };
  yield {
    state: bvhGraph('A BVH wraps geometry in nested bounding boxes'),
    highlight: hl1,
    explanation: `A bounding volume hierarchy stores real primitives in leaves (${hl1.found.join(', ')}) and cheap bounding boxes in internal nodes. The ${hl1.active[0]} box contains the whole scene; child boxes ${hl1.active[1]} and ${hl1.active[2]} contain smaller primitive groups.`,
    invariant: `If a ray misses a box, it misses every primitive inside that box — ${hl1.found.length} leaves are protected by ${hl1.active.length - 2} internal nodes in this example.`,
  };

  const hl2 = { active: ['ray', 'root', 'left', 'e-ray-left'], compare: ['right'], removed: ['triC', 'triD'] };
  yield {
    state: bvhGraph('Traversal tests the ray against cheap boxes first'),
    highlight: hl2,
    explanation: `The ${hl2.active[0]} first checks ray-box intersections at ${hl2.active[1]} and descends toward ${hl2.active[2]}. Since the ray misses the ${hl2.compare[0]} child box, ${hl2.removed.join(' and ')} are skipped before any expensive ray-triangle tests run.`,
  };

  const hl3 = { active: ['triA', 'triB', 'e-left-a', 'e-left-b'], found: ['hit', 'e-ray-hit'], removed: ['right', 'triC', 'triD'] };
  yield {
    state: bvhGraph('Only surviving leaves run exact primitive tests'),
    highlight: hl3,
    explanation: `After box pruning, the renderer tests the ${hl3.active.length / 2} remaining triangles (${hl3.active[0]}, ${hl3.active[1]}) exactly. The ${hl3.found[0]} node records the answer while ${hl3.removed.length} nodes (${hl3.removed.join(', ')}) stay pruned.`,
  };

  const rows = [
    { id: 'box', label: 'box test' },
    { id: 'tri', label: 'triangle test' },
    { id: 'order', label: 'near-first' },
    { id: 'wide', label: 'wide nodes' },
  ];
  const cols = [
    { id: 'why', label: 'why' },
    { id: 'cost', label: 'cost' },
  ];
  const cells = [
    ['cheap reject', 'many'],
    ['exact answer', 'expensive'],
    ['prune far hits', 'sort/stack'],
    ['SIMD/GPU fit', 'more child tests'],
  ];
  const hl4 = { active: ['box:why', 'tri:cost'], found: ['order:why'], compare: ['wide:cost'] };
  yield {
    state: labelMatrix('Traversal cost model', rows, cols, cells),
    highlight: hl4,
    explanation: `BVH performance across ${rows.length} factors (${rows.map(r => r.label).join(', ')}) is not just Big-O. The ${rows[0].label} provides "${cells[0][0]}" while the ${rows[1].label} is "${cells[1][1]}"; optimizing ${cols[0].label} and ${cols[1].label} depends on box quality, memory layout, ray coherence, and SIMD width.`,
  };
}

function* buildAndRefit() {
  const bhl1 = { active: ['prims', 'centroid', 'split', 'e-prims-centroid', 'e-centroid-split'], found: ['tree'] };
  yield {
    state: buildGraph('BVH construction partitions primitives, not empty space'),
    highlight: bhl1,
    explanation: `A BVH builder groups ${bhl1.active[0]} by their ${bhl1.active[1]} positions. Unlike a quadtree, the ${bhl1.active[2]} does not divide all of space evenly; it partitions the primitive set into useful groups that produce the ${bhl1.found[0]}.`,
    invariant: `Internal boxes are the union of child boxes — the ${bhl1.active.length} active steps (${bhl1.active.slice(0, 3).join(', ')}) guarantee each parent encloses its children.`,
  };

  const buildRows = [
    { id: 'median', label: 'median split' },
    { id: 'sah', label: 'SAH split' },
    { id: 'lbvh', label: 'LBVH' },
    { id: 'wide', label: 'wide BVH' },
  ];
  const buildCols = [
    { id: 'strength', label: 'strength' },
    { id: 'tradeoff', label: 'tradeoff' },
  ];
  const buildCells = [
    ['simple balance', 'lower quality'],
    ['lower trace cost', 'build CPU'],
    ['GPU friendly', 'quality varies'],
    ['fast traversal', 'layout work'],
  ];
  const bhl2 = { active: ['sah:strength', 'sah:tradeoff'], found: ['lbvh:strength'], compare: ['median:tradeoff'] };
  yield {
    state: labelMatrix('Build heuristics', buildRows, buildCols, buildCells),
    highlight: bhl2,
    explanation: `The ${buildRows[1].label} (${buildCols[0].label}: "${buildCells[1][0]}") estimates future traversal cost. Among ${buildRows.length} heuristics, production renderers often pay more build work for static scenes and use faster builders like ${buildRows[2].label} (${buildCols[0].label}: "${buildCells[2][0]}") for dynamic or GPU-built scenes.`,
  };

  const bhl3 = { active: ['leaves', 'parent', 'tree', 'refit', 'e-leaves-parent', 'e-parent-tree', 'e-tree-refit'], compare: ['split'] };
  yield {
    state: buildGraph('Refit updates boxes when primitives move a little'),
    highlight: bhl3,
    explanation: `For animation, the system walks ${bhl3.active.length} active elements from ${bhl3.active[0]} through ${bhl3.active[1]} to ${bhl3.active[2]}, then runs ${bhl3.active[3]} to recompute parent boxes. Refit is fast but tree quality can degrade if objects move far from their original groups, at which point the ${bhl3.compare[0]} stage must rebuild.`,
  };

  const pipeRows = [
    { id: 'blas', label: 'BLAS' },
    { id: 'tlas', label: 'TLAS' },
    { id: 'instance', label: 'instance' },
    { id: 'shader', label: 'shader ray' },
  ];
  const pipeCols = [
    { id: 'contains', label: 'contains' },
    { id: 'lesson' },
  ];
  const pipeCells = [
    ['mesh triangles', 'per-object accel'],
    ['instances', 'scene-level accel'],
    ['transform + material', 'reuse mesh BVH'],
    ['traverse + shade', 'data structure on hot path'],
  ];
  const bhl4 = { active: ['blas:contains', 'tlas:contains'], found: ['shader:lesson'], compare: ['instance:lesson'] };
  yield {
    state: labelMatrix('Real-time graphics pipeline', pipeRows, pipeCols, pipeCells),
    highlight: bhl4,
    explanation: `Modern ray-tracing APIs separate ${pipeRows[0].label} (${pipeCols[0].label}: "${pipeCells[0][0]}") from ${pipeRows[1].label} (${pipeCols[0].label}: "${pipeCells[1][0]}"). The ${pipeRows[2].label} layer ("${pipeCells[2][1]}") lets scenes reuse mesh BVHs while the ${pipeRows[3].label} ("${pipeCells[3][1]}") drives traversal through transforms.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/bounding-volume-hierarchy-ray-tracing.gif', alt: 'Animated walkthrough of the bounding volume hierarchy ray tracing visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'The problem',
      paragraphs: [
        `Ray tracing asks a brutal question many times: given a ray, what is the closest surface it hits? A single rendered frame can contain millions or billions of such queries once reflections, shadows, transparency, anti-aliasing, and path-tracing bounces are included. The scene may contain millions of triangles. Testing every ray against every triangle is correct, but it is not a renderer. It is a demonstration of why acceleration structures exist.`,
        {
          type: 'callout',
          text: `BVH turns one cheap box miss into proof that an entire subtree of triangles cannot matter.`,
        },
        `The same problem appears outside photorealistic rendering. A physics engine asks which shapes might collide. A CAD tool asks which object the cursor selected. A game asks whether a projectile intersects a mesh. In all of these cases, exact primitive tests are expensive and most primitives are irrelevant to a given query. The data structure has to reject large groups before the exact math begins.`,
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        `The naive ray tracer loops through all triangles, computes an exact ray-triangle intersection for each one, keeps the nearest positive hit distance, and returns the winning surface. This is simple and has no build step, but its cost is linear in scene size for every query. Doubling the number of triangles doubles the cost of each ray, even if the new triangles are behind the camera or far away from the ray path.`,
        `Uniform grids and spatial partitions are a natural next idea: divide space into cells and test only the cells the ray enters. That works for some scenes, but empty space, uneven triangle density, huge triangles, and dynamic objects can make grid resolution painful. A bounding volume hierarchy takes a different path. It partitions primitives into groups and wraps those groups with cheap volumes, usually axis-aligned bounding boxes.`,
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        `A BVH is a proof-carrying filter. Every internal node stores a box that encloses all geometry below it. If a ray misses the box, then it cannot hit any primitive in that subtree. The rejection is safe because containment is the invariant. A cheap box test becomes a certificate for skipping many expensive primitive tests.`,
        `The hierarchy matters because one miss can eliminate thousands of triangles. The root box covers the whole scene. Its children cover smaller groups. Leaves contain a small number of primitives. A good BVH arranges the tree so most rays miss many boxes early, while rays that do hit geometry reach only a small set of plausible leaves. The structure does not change the answer; it changes how much work is needed to prove the answer.`,
      ],
    },
    {
      heading: 'Traversal mechanics',
      paragraphs: [
        `Traversal starts at the root. A ray-box test computes whether the ray enters and exits the node's bounds over a valid interval. If there is no overlap, the traversal stops for that subtree. If the ray intersects the box, the algorithm descends to children. At a leaf, it runs exact tests against triangles or other primitives and updates the best hit distance.`,
        `Closest-hit traversal benefits from visiting nearer child boxes first. Once the algorithm has a hit at distance t, any node whose bounding box begins farther than t cannot contain a closer answer and can be skipped. Shadow rays often use an even simpler rule: stop as soon as any occluder is found between the shading point and the light. Collision queries use the same broad idea but swap ray-triangle tests for shape overlap predicates.`,
      ],
    },
    {
      heading: 'Construction mechanics',
      paragraphs: [
        `A builder starts with primitive bounds and centroids. It chooses a split, partitions the primitive set, recurses on the two or more child groups, and stores parent boxes as the union of child boxes. Leaves usually contain a small fixed number of primitives. Internal nodes contain only bounds and child references. The result is a tree that subdivides objects, not empty space.`,
        {
          type: 'image',
          src: `https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/BVH_Splitting_Plane.png/250px-BVH_Splitting_Plane.png`,
          alt: `Two candidate BVH split planes showing how overlap changes traversal quality`,
          caption: `BVH split-plane choices can create overlapping child boxes or cleaner partitions. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:BVH_Splitting_Plane.png.`,
        },
        `Split quality controls traversal cost. A median split is fast and tends to balance the tree, but it may create boxes that overlap heavily. The surface-area heuristic, or SAH, estimates the expected cost of a split by combining child surface area, primitive counts, and traversal cost. SAH builders spend more time during construction to reduce expected query work. Linear BVH builders use Morton codes or similar spatial ordering to build quickly on GPUs, accepting lower quality when fast rebuilds matter more than perfect traversal.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `In the ray traversal view, the scene root contains two child boxes. The left child contains triangles A and B. The right child contains triangles C and D. The query ray intersects the root and the left child but misses the right child. That single miss removes C and D from consideration without touching their triangle equations.`,
        `The remaining work is exact. The traversal tests A and B, keeps the closest valid hit, and returns it as the answer. If B produces a hit at distance 4 and a later node's box starts at distance 7, that later node can be rejected even if the ray would geometrically intersect its box. The current best distance turns the BVH from a maybe-filter into an increasingly strong pruning device as traversal proceeds.`,
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        `The first view makes the rejection invariant visible: a missed box removes every descendant. The highlighted triangles are not ignored because the algorithm got lucky; they are ignored because containment makes the miss logically sufficient. That is the main lesson for any broad-phase data structure. Cheap conservative tests should reduce the number of expensive exact tests while never discarding a possible true hit.`,
        `The build and refit view shows why BVHs are engineering objects, not just abstract trees. A builder must choose grouping, layout, branching factor, and update strategy. Refit recomputes boxes bottom-up after primitives move, which is much cheaper than rebuilding. But if objects move far from their original groups, the boxes grow and overlap, and traversal quality decays. Dynamic engines therefore balance refit, partial rebuild, full rebuild, and top-level instancing.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `Storage is linear in the number of primitives, but memory layout drives real speed. Renderers care about compact nodes, cache lines, SIMD-friendly child tests, stack size, and GPU divergence. A theoretically reasonable tree can still be slow if traversal jumps randomly through memory or sends neighboring rays down unrelated branches. Wide BVHs reduce tree depth and match vector hardware, but each node visit may test more child bounds.`,
        `Build time ranges from near-linear approximate methods to expensive high-quality SAH construction. Offline film rendering can spend more time building a high-quality hierarchy for static geometry. Real-time graphics and physics often need rebuilds or refits every frame, so they accept lower split quality for predictable frame time. Instancing changes the tradeoff again: a bottom-level structure can be built once for a mesh, while a top-level structure handles many transformed copies.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `BVHs win for scenes with irregular geometry and many queries. Triangle meshes, hair curves, procedural primitives, CAD assemblies, collision shapes, and instanced game scenes all fit the model. Unlike a uniform grid, a BVH adapts to where primitives actually are. Unlike a pure object list, it gives each query a way to prove that large regions do not matter.`,
        `They are especially strong when the hierarchy can be reused. A static environment can amortize build cost over many frames and many rays. A path tracer can reuse the same acceleration structure for camera rays, shadow rays, reflection rays, and indirect bounces. A game engine can reuse bottom-level mesh structures while updating a smaller top-level hierarchy as objects move.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `A BVH struggles when bounds overlap heavily. Long thin triangles, large primitives crossing many regions, tangled geometry, and poor split choices can make a ray enter many child boxes. In the worst case, traversal approaches brute force because the hierarchy cannot separate the scene. Bad memory layout can also erase the benefit by turning traversal into cache misses or divergent GPU branches.`,
        `Highly dynamic deformation can be hard. Refit is fast only when the old topology remains reasonable. If a character's cloth, foliage, or particle geometry spreads far from its original leaves, parent boxes inflate and pruning weakens. Full rebuilds restore quality but cost time. Production systems watch for this degradation and schedule rebuilds based on motion, overlap metrics, or frame budget.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `The most dangerous bug is an invalid bound. If a parent box fails to contain a child primitive, traversal may miss a real intersection. That is a correctness failure, not just a performance problem. Numeric precision also matters: ray-box tests need consistent handling of near-zero directions, infinities, NaNs, negative zero, and rays that start inside a box. Conservative bounds are often slightly expanded to avoid precision holes.`,
        `Another failure is confusing broad-phase and exact-phase responsibilities. A box hit is only a maybe. It does not prove a triangle was hit, and it does not decide the surface normal, material, barycentric coordinates, or collision response. The BVH narrows the candidate set; exact predicates still own the final answer.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: PBRT BVH chapter at https://www.pbr-book.org/3ed-2018/Primitives_and_Intersection_Acceleration/Bounding_Volume_Hierarchies, Intel BVH construction article at https://www.intel.com/content/www/us/en/developer/articles/technical/bvh-construction.html, and the JCGT BVH performance comparison at https://jcgt.org/published/0011/04/01/.`,
        `Good next topics are R-Tree Spatial Index for database-style bounding rectangles, Quadtree Spatial Index & Map Tiles for regular spatial subdivision, Spatial Hash Grid Broadphase for game collision, Sweep and Prune Broadphase for axis-sorted intervals, Interval Tree for one-dimensional overlap queries, and Big-O Growth for why asymptotic notation is useful but not enough for traversal-heavy systems.`,
      ],
    },
  ],
};
