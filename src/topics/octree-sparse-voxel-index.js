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
        'The split-cubes view starts with one cube and divides it into eight octants. Empty octants are removed, solid octants stop, and mixed octants split again. The safe inference is geometric: if a query cannot intersect a cube, nothing inside that cube can affect the answer.',
        'The sparse-voxel view shows the production version. A huge volume turns into active tiles, dense leaves, a sparse tree, query traversal, and hot-leaf caching. Watch which regions disappear from work, because skipped space is the reason the structure exists.',
        {type: 'image', src: './assets/gifs/octree-sparse-voxel-index.gif', alt: 'Animated walkthrough of the octree sparse voxel index visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type: 'callout', text: 'An octree is a proof that most of a 3D volume is irrelevant: each empty or uniform cube removes all smaller cells beneath it.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/20/Octree2.svg', alt: 'Recursive cube subdivision beside the corresponding octree', caption: 'Cube subdivision and tree structure side by side show the octree invariant: each internal region splits into eight smaller regions. Source: Wikimedia Commons, public domain.'},
        'Three-dimensional grids grow by a factor of eight when resolution doubles in x, y, and z. A 1024 by 1024 by 1024 voxel grid has more than one billion cells. Dense storage is easy to address, but it charges memory and bandwidth for empty air.',
        'Real 3D data is often sparse or locally uniform. A robot map contains obstacles and unknown regions, not useful detail in every cubic centimeter. A renderer, simulation, or point cloud usually needs detail near surfaces and active regions, not across the whole bounding box.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious representation is a dense 3D array. Given integer coordinates, index math can be constant time, and local neighborhoods are easy to scan. This is the right baseline for small dense volumes.',
        'Another reasonable approach is a flat list of occupied voxels or points. It saves memory when data is sparse, but queries become expensive because the list has weak spatial structure. A ray, box query, or nearest-neighbor search needs a way to reject whole regions at once.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The dense grid wall is memory and bandwidth. If only 1 percent of a billion cells matter, 990 million empty cells still occupy addresses and cache lines. A query can spend most of its time proving that empty cells are empty.',
        'The flat sparse list wall is lack of hierarchy. It stores only useful payloads, but it cannot quickly prove that a query region has no relevant payloads. The missing object is a spatial certificate: a region-level statement that says empty, uniform, mixed, or outside the query.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is recursive spatial proof. Split a cube by x, y, and z midpoints into eight disjoint children that exactly cover the parent. If a child is empty, omit it; if it is uniform, store one leaf; if it is mixed, recurse.',
        'The tree makes exact work local. It does not avoid checking surfaces, occupied voxels, or candidate points that really matter. It avoids descending into space that has already been proved irrelevant by its parent cube.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/f/f7/Binary_tree.svg', alt: 'Simple tree diagram with parent and child nodes', caption: 'The diagram is binary, but the lesson transfers: traversal follows a hierarchy of regions and skips whole subtrees once a region is irrelevant. Source: Wikimedia Commons, Derrick Coetzee, public domain.'},
        'Construction starts with a root cube covering the coordinate domain. Each node is classified as empty, solid or uniform, mixed, or max-depth leaf. Mixed nodes allocate up to eight children, commonly identified by three bits: low or high x, low or high y, low or high z.',
        'Point lookup follows one child per level. A box query visits children whose cubes intersect the box. A ray traversal visits cubes along the ray and skips cubes the ray cannot enter. A nearest-neighbor search uses distance bounds to ignore cubes that cannot contain a better answer.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness follows from partitioning. The eight children of an internal node are disjoint, and their union is the parent cube. If the query excludes a child cube, every voxel or point inside that cube is also excluded.',
        'Stopping at empty or uniform leaves is safe because the leaf stores a claim about the whole region. If the claim is empty, no hit can exist there. If the claim is uniform and the query only needs that aggregate, deeper cells cannot change the result.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A point lookup costs O(depth), where depth is the number of refinement levels. Range, ray, and neighbor queries cost the number of visited nodes plus exact work at candidate leaves. If the data is sparse, visited nodes can be far fewer than dense-grid cells.',
        'The hidden cost is layout. Pointer octrees are easy to update but cache-unfriendly. Linear octrees store sorted keys and batch well but update less easily. Dense leaf blocks improve local scans but impose a block-size choice. When the data is dense everywhere, the hierarchy can become overhead.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/8a/Finite_element_sparse_matrix.png', alt: 'Sparse matrix pattern with black nonzero entries on a mostly empty grid', caption: 'Sparse patterns make the same economic point as sparse voxels: store and traverse the active regions, not the full dense universe. Source: Wikimedia Commons, Oleg Alexandrov and Vojtak, public domain.'},
        'Octrees fit sparse volumes, voxel terrain, occupancy maps, LiDAR point clouds, collision broad phases, visibility tests, and level-of-detail systems. OpenVDB uses a hierarchical sparse tree with dense leaf buffers for visual effects and scientific volumes. Point-cloud libraries use octree partitioning to accelerate neighbor search and change detection.',
        'The access pattern is the key. Octrees win when queries can reject large regions before touching detailed payloads. They are less about storing a tree and more about making emptiness cheap to prove.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Octrees fail on dense data and all-volume scans. A dense array can be faster because it has predictable contiguous access and no branch overhead. A BVH can beat an octree for arbitrary triangle geometry because it groups primitives by fitted boxes instead of fixed grid octants.',
        'Dynamic scenes are also hard. Moving objects may require reinsertion, compressed DAG layouts make updates expensive, and bad coordinate policy can cause boundary flicker. Unknown space in robot maps must not be treated as empty unless the application has explicitly made that risk decision.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a 256 by 256 by 256 warehouse grid has 16,777,216 possible voxels, but only 120,000 are occupied or unknown near shelves and walls. A dense boolean grid stores every voxel. An octree can mark large empty air cubes as single empty leaves and store dense blocks only around obstacles.',
        'A robot collision box intersects 30 high-level cubes. If 22 are empty, they are skipped immediately. If 5 are unknown and 3 are occupied or mixed, only those 8 regions become exact candidates. The query pays for the spatial region that could matter, not the full 16 million-cell universe.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources and references: OpenVDB documentation, PCL octree tutorials, sparse voxel octree ray-casting literature, and robotics occupancy-map references that distinguish free, occupied, and unknown space.',
        'Study Quadtrees, Morton Codes, Bounding Volume Hierarchies, R-Trees, k-d Trees, spatial hashing, and sparse matrix storage next. The comparison question is whether the structure skips enough irrelevant space to repay its own traversal and memory overhead.',
      ],
    },
  ],
};
