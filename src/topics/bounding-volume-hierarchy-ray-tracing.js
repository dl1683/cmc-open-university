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
        'The visualization has two views. "Ray traversal" shows a single ray walking down a BVH tree: highlighted nodes are being tested, dimmed nodes are pruned. "Build and refit" shows how the tree is constructed from primitives and how parent boxes are updated when primitives move. Step through slowly — each frame represents one decision the algorithm makes.',
        {type: 'image', src: './assets/gifs/bounding-volume-hierarchy-ray-tracing.gif', alt: 'Animated walkthrough of the bounding volume hierarchy ray tracing visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'Watch for the moment a box test fails and an entire subtree disappears. That single rejection is the whole point of the data structure. Every step after that tests fewer primitives than brute force would.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A ray tracer answers the question "what is the closest surface this ray hits?" for every pixel on screen. A 1920x1080 frame has about 2 million pixels. With anti-aliasing, reflections, shadows, and global illumination bounces, a single frame can fire tens of millions of rays. Each ray must find the closest intersection among every triangle in the scene.',
        'A modern game scene might have 10 million triangles. A film scene might have hundreds of millions. If each ray tests every triangle, rendering one frame at 10M triangles and 10M rays means 10^14 intersection tests. At ~100ns per ray-triangle test, that is about 300 years of single-core compute for one frame. Some structure must exist to skip the vast majority of those tests.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The brute-force ray tracer is a single loop: for each ray, iterate through all N triangles, compute the ray-triangle intersection, track the closest hit. It is correct and trivial to implement. Its cost is O(N) per ray, where N is the number of triangles.',
        'This works fine for toy scenes. At N = 100 triangles and 1000 rays, you run 100,000 intersection tests — done in under a millisecond. But cost scales linearly with scene size and linearly with ray count. Doubling the triangles doubles the work per ray, even if the new geometry is behind the camera or a kilometer away from the ray path.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'At 10 million triangles, brute force is dead. Uniform grids are the next natural idea: divide space into a 3D grid, assign each triangle to the cells it overlaps, and walk the ray through cells in order. This works for evenly distributed geometry, but it breaks when triangle density is uneven. A grid fine enough for a detailed character wastes memory on empty sky. A coarse grid puts thousands of triangles in a single cell, giving you brute force again.',
        'Worse, uniform grids handle large triangles badly — a single triangle spanning many cells gets duplicated into all of them. And when objects move, the entire grid may need rebuilding. We need a structure that adapts to where geometry actually is, not one that divides empty space uniformly.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A bounding volume hierarchy (BVH) is a binary tree of axis-aligned bounding boxes (AABBs). Each leaf holds a small group of actual triangles (typically 1 to 8). Each internal node stores a box that is the union of its children\'s boxes — meaning it tightly encloses everything below it. The root box covers the entire scene.',
        {
          type: 'callout',
          text: 'BVH turns one cheap box miss into proof that an entire subtree of triangles cannot matter.',
        },
        'Here is why this works: if a ray misses a node\'s bounding box, it cannot hit anything inside that box. That is a geometric fact — the box encloses all geometry below it, so missing the box means missing all enclosed triangles. One cheap box test (6 comparisons, ~2ns) replaces thousands of expensive triangle tests (~100ns each). A single miss at depth 2 in a tree of 1 million triangles can eliminate 250,000 triangles.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Construction: the builder starts with all triangle bounding boxes and their centroids. It picks an axis (x, y, or z), sorts or partitions the primitives along that axis, and splits them into two groups. Each group becomes a child node whose bounding box is the union of its members\' boxes. This recurses until each leaf holds a small number of triangles. The result is a binary tree where every internal node\'s box contains all geometry in its subtree.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/BVH_Splitting_Plane.png/250px-BVH_Splitting_Plane.png',
          alt: 'Two candidate BVH split planes showing how overlap changes traversal quality',
          caption: 'BVH split-plane choices can create overlapping child boxes or cleaner partitions. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:BVH_Splitting_Plane.png.',
        },
        'Traversal: to find the closest hit, push the root onto a stack. Pop a node; test the ray against its AABB. If the ray misses, discard that node and everything below it. If the ray hits the box and the node is a leaf, run exact ray-triangle tests on its primitives. If the node is internal, push both children onto the stack (nearer child on top, so it is tested first). Maintain a running closest-hit distance t_best; any node whose box starts farther than t_best is pruned even if the ray would geometrically intersect it.',
        'The surface area heuristic (SAH) improves split quality. Instead of splitting at the median, SAH evaluates candidate splits by estimating the expected traversal cost: C(split) = C_trav + (SA_left / SA_parent) * N_left * C_isect + (SA_right / SA_parent) * N_right * C_isect. Here SA is surface area, N is primitive count, C_trav is the cost of one box test, and C_isect is the cost of one triangle test. SAH picks the split that minimizes this expected cost. The intuition: a child with large surface area gets hit by more rays, so you want fewer triangles there.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness argument: the invariant is containment. Every internal node\'s box is the union of its children\'s boxes. Inductively, the root box contains all geometry. If a ray misses a node\'s box, the ray is outside the box for its entire length, so it cannot intersect any geometry inside. Pruning that subtree never removes a valid hit. The algorithm is exact — it returns the same closest intersection as brute force.',
        'Performance argument: a balanced BVH over N triangles has O(log N) depth. Each level requires at most 2 box tests (both children). If the ray misses one child at each level, it tests about log2(N) boxes and visits about 1 leaf. For N = 10 million, that is ~23 box tests plus a handful of triangle tests, versus 10 million triangle tests in brute force. Even when the ray hits multiple leaves, the near-first ordering and t_best pruning keep the visited set small.',
        'The structure does not change the answer. It changes how much work is needed to prove the answer. A BVH with 10M triangles and perfect splits gives each ray a path of ~23 box tests to find its answer, instead of 10M triangle tests. That is the difference between rendering a frame in seconds and rendering it in centuries.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Build cost: a median-split builder runs in O(N log N) because each level partitions N items and there are O(log N) levels. SAH builders also run in O(N log N) but with a larger constant — evaluating many candidate splits per node. Linear BVH (LBVH) builders compute Morton codes for centroids and sort them in O(N log N), then build the tree in O(N) by bit-prefix grouping. LBVH is fast enough for GPU per-frame rebuilds but produces lower-quality trees.',
        'Traversal cost: expected O(log N) box tests per ray for well-built trees. Each box test costs about 6 multiplies and 6 compares. Each triangle test costs about 20-30 floating-point operations (Moller-Trumbore). Storage is O(N): one leaf per small group of primitives, and a binary tree with N leaves has N-1 internal nodes. A compact BVH node is 32 bytes (6 floats for AABB min/max, child pointers, primitive offset). For 10M triangles, the BVH itself is about 640 MB at 32 bytes per node with ~20M total nodes.',
        'Memory layout matters enormously. Depth-first layout puts parent and left child adjacent in memory, giving good cache behavior for rays that go left. Renderers use 4-wide or 8-wide BVH nodes to test multiple children in a single SIMD instruction (SSE/AVX on CPU, warp-parallel on GPU). This trades deeper per-node work for shallower trees and better hardware utilization.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Film rendering: Pixar\'s RenderMan, Weta\'s Manuka, and the open-source PBRT renderer all use SAH-built BVHs as their primary acceleration structure. A single frame of a Pixar film may contain hundreds of millions of primitives, including subdivision surfaces, curves (hair), and volumes. The BVH is built once per frame and reused for billions of ray queries.',
        'Real-time ray tracing: NVIDIA\'s RTX hardware has dedicated BVH traversal units (RT cores) that test ray-box and ray-triangle intersections in fixed-function silicon. The Vulkan and DirectX ray tracing APIs expose a two-level BVH: a bottom-level acceleration structure (BLAS) per mesh, and a top-level acceleration structure (TLAS) over instances. The BLAS is built once per mesh; the TLAS is rebuilt every frame as objects move.',
        'Game physics: engines like Bullet and PhysX use BVHs for broadphase collision detection. Instead of testing all N*(N-1)/2 shape pairs, they traverse a BVH to find overlapping bounding boxes, then run narrow-phase contact solvers only on those pairs. The same idea applies to frustum culling (which objects are visible?) and mouse picking (which object did the user click?).',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Overlapping geometry: when triangles are interleaved in space (imagine two meshes interpenetrating), no axis-aligned split can cleanly separate them. Both children\'s boxes cover similar regions, so a ray entering the parent will enter both children. Traversal degenerates toward brute force. SAH helps but cannot fix fundamentally interleaved geometry.',
        'Large primitives: a single triangle spanning the entire scene forces the root box to be large and makes every split place that triangle in one child whose box remains huge. The fix is to split large triangles before building the BVH, but this increases primitive count. Spatial splits (as in SBVH) address this by allowing a primitive to appear in both children, at the cost of higher memory.',
        'Dynamic scenes: refit — walking the tree bottom-up and recomputing each node\'s AABB from its children — is O(N) and fast. But it does not change the tree topology. If objects move far from their original groups, parent boxes inflate, overlap increases, and pruning weakens. Production engines monitor box overlap ratios and trigger full rebuilds when quality drops below a threshold.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a scene has 8 triangles: T0 through T7. A median-split builder sorts them by x-centroid and splits into {T0,T1,T2,T3} (left) and {T4,T5,T6,T7} (right). Each group splits again: left becomes {T0,T1} and {T2,T3}; right becomes {T4,T5} and {T6,T7}. The tree has 7 internal nodes and 4 leaves of 2 triangles each. Depth is 3 (root -> child -> leaf).',
        'A ray fires into the scene. Step 1: test the root box. Hit — descend. Step 2: test the left child box. Miss — prune. That single miss eliminates T0, T1, T2, T3 (4 triangles) without any triangle math. Step 3: test the right child box. Hit — descend. Step 4: test the right-left leaf box {T4,T5}. Hit — test T4 (miss) and T5 (hit at distance t=12.3). Set t_best = 12.3. Step 5: test the right-right leaf box {T6,T7}. The box starts at distance 15.0, which exceeds t_best = 12.3, so prune — no need to test T6 or T7.',
        'Total work: 4 box tests + 2 triangle tests = 6 operations. Brute force would have done 8 triangle tests. The savings grow exponentially with scene size: at 1 million triangles and depth ~20, a well-built BVH typically visits 20-40 boxes and 2-8 triangles per ray, versus 1 million triangle tests in brute force.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: the PBRT textbook\'s BVH chapter (https://www.pbr-book.org/3ed-2018/Primitives_and_Intersection_Acceleration/Bounding_Volume_Hierarchies) gives a complete, production-quality implementation with SAH. The original SAH paper is MacDonald and Booth, "Heuristics for Ray Tracing Using Space Subdivision" (1990). For GPU BVH construction, see Lauterbach et al., "Fast BVH Construction on GPUs" (2009). The JCGT benchmark (https://jcgt.org/published/0011/04/01/) compares traversal performance across BVH variants.',
        'Study next: R-Tree Spatial Index for the database analog of BVH (range queries over bounding rectangles), Quadtree Spatial Index for regular spatial subdivision in 2D, Spatial Hash Grid Broadphase for constant-time collision broadphase in uniform scenes, and Big-O Growth for why logarithmic versus linear cost per query is the difference between real-time and impossible.',
      ],
    },
  ],
};
