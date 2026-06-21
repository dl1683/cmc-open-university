// Octrees extend quadtrees into 3D: each internal node splits a cube into eight
// octants, making sparse volume, point-cloud, and voxel queries manageable.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'octree-sparse-voxel-index',
  title: 'Octree Sparse Voxel Index',
  category: 'Data Structures',
  summary: 'Split 3D space into eight child cubes, store only occupied regions, and query sparse voxels, point clouds, and collision candidates without scanning the whole volume.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['split cubes', 'sparse voxel case study'], defaultValue: 'split cubes' },
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

function octreeGraph(title) {
  return graphState({
    nodes: [
      { id: 'root', label: 'cube', x: 4.8, y: 0.8, note: 'root' },
      { id: 'o000', label: '000', x: 1.0, y: 2.8, note: 'empty' },
      { id: 'o001', label: '001', x: 2.3, y: 2.8, note: 'solid' },
      { id: 'o010', label: '010', x: 3.6, y: 2.8, note: 'mixed' },
      { id: 'o011', label: '011', x: 4.9, y: 2.8, note: 'empty' },
      { id: 'o100', label: '100', x: 6.2, y: 2.8, note: 'mixed' },
      { id: 'o101', label: '101', x: 7.5, y: 2.8, note: 'solid' },
      { id: 'o110', label: '110', x: 8.8, y: 2.8, note: 'empty' },
      { id: 'o111', label: '111', x: 5.6, y: 5.1, note: 'mixed' },
      { id: 'ray', label: 'ray', x: 2.4, y: 5.8, note: 'query' },
      { id: 'hits', label: 'hits', x: 8.2, y: 5.8, note: 'voxels' },
    ],
    edges: [
      { id: 'e-root-000', from: 'root', to: 'o000' },
      { id: 'e-root-001', from: 'root', to: 'o001' },
      { id: 'e-root-010', from: 'root', to: 'o010' },
      { id: 'e-root-011', from: 'root', to: 'o011' },
      { id: 'e-root-100', from: 'root', to: 'o100' },
      { id: 'e-root-101', from: 'root', to: 'o101' },
      { id: 'e-root-110', from: 'root', to: 'o110' },
      { id: 'e-root-111', from: 'root', to: 'o111' },
      { id: 'e-ray-111', from: 'ray', to: 'o111' },
      { id: 'e-ray-hits', from: 'ray', to: 'hits' },
    ],
  }, { title });
}

function sparsePipeline(title) {
  return graphState({
    nodes: [
      { id: 'volume', label: 'volume', x: 0.8, y: 3.3, note: 'huge grid' },
      { id: 'tiles', label: 'tiles', x: 2.7, y: 1.8, note: 'active' },
      { id: 'tree', label: 'tree', x: 4.7, y: 3.3, note: 'sparse' },
      { id: 'leaves', label: 'leaves', x: 2.7, y: 4.9, note: 'dense blocks' },
      { id: 'query', label: 'query', x: 6.7, y: 1.8, note: 'ray/box' },
      { id: 'cache', label: 'cache', x: 6.7, y: 4.9, note: 'hot leaf' },
      { id: 'result', label: 'result', x: 8.8, y: 3.3, note: 'voxels' },
    ],
    edges: [
      { id: 'e-volume-tiles', from: 'volume', to: 'tiles' },
      { id: 'e-volume-leaves', from: 'volume', to: 'leaves' },
      { id: 'e-tiles-tree', from: 'tiles', to: 'tree' },
      { id: 'e-leaves-tree', from: 'leaves', to: 'tree' },
      { id: 'e-tree-query', from: 'tree', to: 'query' },
      { id: 'e-tree-cache', from: 'tree', to: 'cache' },
      { id: 'e-query-result', from: 'query', to: 'result' },
      { id: 'e-cache-result', from: 'cache', to: 'result' },
    ],
  }, { title });
}

function* splitCubes() {
  const octantCount = 8;
  const directionBits = 3;
  const mixedCount = 3;
  const emptyCount = 3;
  const solidCount = 2;
  const stopRuleCount = 4;

  yield {
    state: octreeGraph('An octree splits one cube into eight octants'),
    highlight: { active: ['root', 'o000', 'o001', 'o010', 'o011', 'o100', 'o101', 'o110', 'o111'], found: ['e-root-010', 'e-root-100', 'e-root-111'] },
    explanation: `An octree is the 3D sibling of a quadtree. Each internal node splits its cube by x, y, and z midpoints, producing ${octantCount} child cubes identified by ${directionBits} direction bits.`,
    invariant: `Every child cube is disjoint, and the ${octantCount} children cover the parent cube.`,
  };

  yield {
    state: labelMatrix(
      'Octant bits',
      [
        { id: 'x', label: 'x bit' },
        { id: 'y', label: 'y bit' },
        { id: 'z', label: 'z bit' },
        { id: 'code', label: 'octant' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'example' },
      ],
      [
        ['left/right half', '1 = high x'],
        ['bottom/top half', '0 = low y'],
        ['back/front half', '1 = high z'],
        ['xyz child code', '101'],
      ],
    ),
    highlight: { active: ['x:example', 'y:example', 'z:example'], found: ['code:example'] },
    explanation: `A child path is just ${directionBits} bits. Concatenate octant codes down the tree and you get a 3D sibling of quadkeys and Morton codes, addressing ${octantCount} octants per level.`,
  };

  yield {
    state: octreeGraph('Sparse trees skip empty space and recurse only into mixed cubes'),
    highlight: { active: ['o010', 'o100', 'o111'], removed: ['o000', 'o011', 'o110'], found: ['o001', 'o101'] },
    explanation: `Of ${octantCount} children, ${mixedCount} are mixed and split again, ${emptyCount} are empty and removed, and ${solidCount} are solid leaves. This is why octrees are useful for sparse volumes and occupancy maps.`,
  };

  yield {
    state: labelMatrix(
      'Stop rules',
      [
        { id: 'empty', label: 'empty' },
        { id: 'solid', label: 'solid' },
        { id: 'mixed', label: 'mixed' },
        { id: 'depth', label: 'max depth' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'action' },
      ],
      [
        ['no occupied voxels', 'store nothing'],
        ['uniform material', 'leaf'],
        ['varied contents', 'split'],
        ['precision limit', 'leaf block'],
      ],
    ),
    highlight: { active: ['mixed:action', 'depth:action'], found: ['empty:action', 'solid:action'] },
    explanation: `The ${stopRuleCount} stop conditions (empty, solid, mixed, max depth) govern leaf size. Too fine and memory explodes. Too coarse and queries return too many false candidates or lose detail.`,
  };
}

function* sparseVoxelCaseStudy() {
  const pipelineLength = 7;
  const caseStudyCount = 4;
  const layoutCount = 4;

  yield {
    state: sparsePipeline('Sparse volume storage keeps active regions, not the whole grid'),
    highlight: { active: ['volume', 'tiles', 'leaves', 'tree', 'e-volume-tiles', 'e-volume-leaves'], found: ['query'] },
    explanation: `A smoke simulation, medical scan, terrain field, or point-cloud occupancy grid can be mostly empty. The ${pipelineLength}-stage sparse pipeline stores active regions and dense leaf blocks instead of a full 3D array.`,
    invariant: `Sparse means absent regions are cheap across all ${pipelineLength} pipeline nodes; active regions still need dense local access.`,
  };

  yield {
    state: labelMatrix(
      'Case studies',
      [
        { id: 'openvdb', label: 'OpenVDB' },
        { id: 'pcl', label: 'PCL octree' },
        { id: 'svo', label: 'SVO' },
        { id: 'robot', label: 'robot map' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'lesson' },
      ],
      [
        ['sparse volumes', 'fast leaves'],
        ['point clouds', 'neighbor search'],
        ['voxel scene', 'ray traversal'],
        ['occupancy', 'unknown matters'],
      ],
    ),
    highlight: { active: ['openvdb:stores', 'pcl:stores'], found: ['svo:lesson'], compare: ['robot:lesson'] },
    explanation: `These ${caseStudyCount} case studies show the same recursive cube partition in production volume tools, point-cloud libraries, sparse voxel renderers, and occupancy maps. The payload changes; the hierarchy stays recognizable.`,
  };

  yield {
    state: sparsePipeline('Queries descend through active nodes and cache hot leaves'),
    highlight: { active: ['query', 'tree', 'cache', 'result', 'e-tree-query', 'e-tree-cache', 'e-cache-result'], compare: ['volume'] },
    explanation: `Ray casts, box queries, nearest-neighbor candidates, and voxel edits all walk the ${pipelineLength}-node pipeline to the relevant leaf blocks. Good implementations cache recent leaves because local edits and rays often touch neighboring voxels.`,
  };

  yield {
    state: labelMatrix(
      'Layout choices',
      [
        { id: 'pointer', label: 'pointer tree' },
        { id: 'linear', label: 'linear octree' },
        { id: 'block', label: 'leaf blocks' },
        { id: 'dag', label: 'DAG merge' },
      ],
      [
        { id: 'helps', label: 'helps' },
        { id: 'cost' },
      ],
      [
        ['easy updates', 'pointers/cache misses'],
        ['compact keys', 'sort/rebuild'],
        ['dense local ops', 'fixed block size'],
        ['dedup repeats', 'hard updates'],
      ],
    ),
    highlight: { active: ['linear:helps', 'block:helps'], found: ['dag:helps'], compare: ['pointer:cost'] },
    explanation: `An octree offers ${layoutCount} layout choices: pointer-heavy, key-sorted, block-packed, or DAG-compressed. The right layout depends on update rate, traversal pattern, memory budget, and GPU friendliness.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'split cubes') yield* splitCubes();
  else if (view === 'sparse voxel case study') yield* sparseVoxelCaseStudy();
  else throw new InputError('Pick an octree view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/octree-sparse-voxel-index.gif', alt: 'Animated walkthrough of the octree sparse voxel index visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Problem',
      paragraphs: [
        'Three-dimensional data gets large faster than intuition expects. A 2D image with width and height grows by four times when both dimensions double. A 3D voxel grid grows by eight times when x, y, and z resolution double. A dense grid is easy to address, but it charges memory for every cell whether that cell contains smoke, a surface, a point, or empty air.',
        'Real 3D workloads are often sparse. A medical scan contains a body inside a bounding box. A robot occupancy map contains walls and obstacles but also unknown or empty space. A game or renderer may have detailed geometry in a few regions and nothing in most of the world. A LiDAR point cloud samples surfaces, not every cubic millimeter of volume. The octree exists to stop paying dense-grid prices for empty or uniform regions.',
        {type: 'callout', text: 'An octree is a proof that most of a 3D volume is irrelevant: each empty or uniform cube removes all smaller cells beneath it.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/20/Octree2.svg', alt: 'Recursive cube subdivision beside the corresponding octree', caption: 'Cube subdivision and tree structure side by side show the octree invariant: each internal region splits into eight smaller regions. Source: Wikimedia Commons, public domain.'},
      ],
    },
    {
      heading: 'Naive approach',
      paragraphs: [
        'The naive representation is a dense 3D array. Given integer coordinates, address math is simple: index = x + width * (y + height * z), or a similar layout. Point lookup is O(1), neighborhood loops are predictable, and GPU kernels can be straightforward. Dense grids are excellent when the data really is dense and the resolution is modest.',
        'The wall arrives when the domain is large and mostly empty. A 1024 by 1024 by 1024 grid has more than one billion cells. If most cells are empty, a dense grid wastes memory and cache bandwidth before any algorithm starts. Queries also do unnecessary work. A ray, collision test, or range search can spend most of its time crossing cells that contain no useful payload.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'An octree recursively partitions a cube into eight smaller cubes. Each split cuts the parent by the x midpoint, y midpoint, and z midpoint. The eight children are disjoint and together cover the parent. If a child region is empty, the tree can omit it or store a compact empty leaf. If a child region is uniform, the tree can stop. If a child region is mixed, the tree can split again.',
        'The core insight is hierarchical proof of irrelevance. A query can skip an entire subtree once the subtree cube is known to be empty, outside the query bounds, or uniform enough for the requested answer. The tree does not make exact work disappear. It makes exact work local. It replaces scanning the whole volume with descending into the small subset of space that might matter.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Construction starts with a root cube that covers the coordinate domain. The builder classifies that cube. If it contains no occupied voxels or points, it can be absent or marked empty. If it contains one material, one value class, or an acceptable aggregate, it becomes a leaf. If it contains mixed data and depth remains, it splits into eight octants and repeats the classification.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/f/f7/Binary_tree.svg', alt: 'Simple tree diagram with parent and child nodes', caption: 'The diagram is binary, but the lesson transfers: traversal follows a hierarchy of regions and skips whole subtrees once a region is irrelevant. Source: Wikimedia Commons, Derrick Coetzee, public domain.'},
        'A child can be identified by three bits: one bit for low or high x, one for low or high y, and one for low or high z. A path from the root is a sequence of those octant codes. Packed together, the path resembles a 3D version of a quadkey and is closely related to Morton codes and Z-order curves. Pointer octrees store child references. Linear octrees store keys in sorted arrays or maps. Sparse voxel structures often add dense leaf blocks so local operations remain fast once traversal reaches an active region.',
        'Queries are bounding-volume tests plus recursion. A point lookup chooses one child at each level. A box query visits children whose cubes intersect the box. A ray traversal visits cubes along the ray and skips cubes that the ray never enters. A nearest-neighbor search uses distance bounds to avoid subtrees that cannot contain a better candidate. In every case the tree is a broad-phase filter before exact work on voxels, points, or primitives.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a robot mapping a warehouse. The root cube covers the building. Large empty air regions are marked empty. Walls, shelves, and obstacles occupy a small fraction of the volume. Unknown regions may be represented separately because "not observed" is different from "observed empty." When a new depth scan arrives, the map updates the cubes along sensor rays: free space along the ray, occupied space near the hit, and unknown space elsewhere.',
        'A collision query for the robot body does not scan the entire warehouse grid. It asks which octree leaves intersect the swept box of the robot. Empty subtrees are skipped. Occupied or unknown leaves become candidates for more careful checking. If the robot moves locally, a cache of recently touched leaves can avoid repeating traversal from the root for every small edit or query.',
        'A renderer uses a similar idea with a different payload. A sparse voxel octree can store scene occupancy, colors, or material summaries. A ray descends through cubes it intersects, skipping empty space and refining only near surfaces. The final hit still needs precise traversal rules, but the hierarchy prevents the ray from stepping one tiny voxel at a time through a huge empty scene.',
      ],
    },
    {
      heading: 'Animation lesson',
      paragraphs: [
        'The split-cubes view shows one root cube and eight octants labeled by bit patterns. Empty octants can disappear from later work. Solid octants can stop as leaves. Mixed octants split again. The highlighted mixed nodes are where the algorithm spends more detail. The removed empty nodes are where the hierarchy earns its memory and traversal savings.',
        'The sparse-voxel case-study view adds a production-shaped pipeline. A huge volume feeds active tiles and dense leaves into a sparse tree. Queries descend through the tree, and hot leaves may be cached because nearby rays and local edits tend to touch nearby cells. The layout frame compares pointer trees, linear octrees, block leaves, and DAG merging. That comparison is the practical lesson: an octree is a concept, but performance comes from the physical representation.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is geometric. Each split partitions the parent cube into disjoint children whose union is the parent. If a query region does not intersect a child cube, none of the points or voxels inside that child can affect the query. If a child cube is known empty, it cannot produce a hit. If a child cube is uniform and the query only needs the uniform value or aggregate, recursion can stop safely.',
        'The efficiency argument depends on sparsity and coherence. Sparse data means many cubes become empty or uniform at high levels. Coherent queries mean nearby operations reuse paths or leaves. A ray through mostly empty space can skip large cubes. A point-cloud neighbor search can reject distant cubes by distance bounds. A simulation can update dense leaf blocks locally while keeping empty space cheap.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Point lookup is O(depth), where depth is the number of spatial refinement levels. Range, ray, and neighbor queries cost the number of nodes they visit plus the exact work at candidate leaves. A sparse octree can be much smaller than a dense grid, but a fully detailed dense volume can make the tree large. In the worst case, hierarchy overhead can become a tax rather than a saving.',
        'Memory layout matters. Explicit eight-child pointers are simple to update but pointer-heavy and cache-unfriendly. Child masks reduce empty-child overhead. Linear octrees pack octant paths into sortable keys, improving compactness and batch processing but making incremental updates harder. Dense leaf blocks improve local access but impose a fixed block size. DAG-compressed sparse voxel octrees can deduplicate repeated subtrees, but updates become difficult because shared structure must be preserved.',
        'Resolution policy is just as important. Finer voxels preserve detail and reduce false positives, but they increase depth and memory. Coarser voxels are cheaper, but they blur geometry and force later stages to inspect larger candidate regions. Boundary rules must be deterministic. Points on midplanes, floating-point quantization, root bounds, and coordinate transforms all need stable definitions or the same object can move between cells unpredictably.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Octrees win when the domain is large, 3D, and sparse or locally uniform. Sparse volumes, occupancy grids, voxel terrain, LiDAR point clouds, collision broad phases, visibility tests, and level-of-detail systems are natural fits. The tree lets the system spend detail only where the data or query requires detail.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/8a/Finite_element_sparse_matrix.png', alt: 'Sparse matrix pattern with black nonzero entries on a mostly empty grid', caption: 'Sparse patterns make the same economic point as sparse voxels: store and traverse the active regions, not the full dense universe. Source: Wikimedia Commons, Oleg Alexandrov and Vojtak, public domain.'},
        'OpenVDB is a production example of the idea adapted for visual effects and scientific volumes. It uses a hierarchical sparse tree with dense leaf buffers, so smoke, fire, clouds, level sets, and other volumes can be mostly empty while active regions still support fast local access. Point-cloud libraries use octrees for another payload: group points into cubes, accelerate neighbor search, detect changes between scans, and produce candidates for exact geometry checks.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'An octree is weak when data is dense everywhere or when queries need to touch most of the volume anyway. A dense array can outperform the tree because it has predictable memory access and no branch overhead. A BVH may be better for arbitrary triangle geometry because it groups primitives by fitted bounding boxes rather than forcing them into a regular spatial grid. A k-d tree may be better for certain point-neighbor workloads because it can split by data distribution rather than fixed octants.',
        'Dynamic scenes can also be difficult. Moving objects may require repeated reinsertion. Small edits in a compressed or linear layout can trigger expensive rebuilds. Highly unbalanced data can create deep paths unless the implementation uses depth limits, loose octrees, or rebalancing policies. If the coordinate system is poorly chosen, precision problems can dominate the algorithmic design.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Common failure modes include off-by-one boundary classification, inconsistent root bounds between producer and consumer, treating unknown space as empty in robot maps, using too fine a depth for noisy data, and returning too many false candidates because leaf blocks are too coarse. Another failure is designing for memory compression while ignoring traversal cost. A tiny structure that causes random memory access can be slower than a larger cache-friendly one.',
        'A good implementation records its coordinate policy, max depth, voxel size, child ordering, empty and unknown semantics, and serialization format. It also measures the actual query mix. A renderer, simulator, robot map, and point-cloud neighbor index may all use octree-like partitioning, but their best leaf size, layout, cache strategy, and update policy can be very different.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: OpenVDB documentation at https://www.openvdb.org/documentation/doxygen/overview.html, OpenVDB tree architecture notes at https://www.openvdb.org/documentation/doxygen/tree.html, PCL octree tutorial at https://pcl.readthedocs.io/projects/tutorials/en/latest/octree.html, and sparse voxel octree ray-casting paper at https://research.nvidia.com/publication/2010-02_efficient-sparse-voxel-octrees.',
        'After this, study Quadtree Spatial Index & Map Tiles for the 2D ancestor, Morton Codes & Z-Order Curves for linear spatial keys, Bounding Volume Hierarchy for geometry-driven grouping, R-Tree Spatial Index for disk and rectangle indexing, k-d Tree for point-neighbor queries, and spatial hashing for fixed-grid alternatives. The useful comparison question is always the same: does the structure skip enough irrelevant space to repay its own overhead?',
      ],
    },
  ],
};
