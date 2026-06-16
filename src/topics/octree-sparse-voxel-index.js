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
  yield {
    state: octreeGraph('An octree splits one cube into eight octants'),
    highlight: { active: ['root', 'o000', 'o001', 'o010', 'o011', 'o100', 'o101', 'o110', 'o111'], found: ['e-root-010', 'e-root-100', 'e-root-111'] },
    explanation: 'An octree is the 3D sibling of a quadtree. Each internal node splits its cube by x, y, and z midpoints, producing eight child cubes identified by three direction bits.',
    invariant: 'Every child cube is disjoint, and the eight children cover the parent cube.',
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
    explanation: 'A child path is just bits. Concatenate octant codes down the tree and you get a 3D sibling of quadkeys and Morton codes.',
  };

  yield {
    state: octreeGraph('Sparse trees skip empty space and recurse only into mixed cubes'),
    highlight: { active: ['o010', 'o100', 'o111'], removed: ['o000', 'o011', 'o110'], found: ['o001', 'o101'] },
    explanation: 'Empty cubes can be omitted or represented as compact leaves. Solid cubes can stop early. Mixed cubes split again. This is why octrees are useful for sparse volumes and occupancy maps.',
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
    explanation: 'The art is choosing leaf size and stop conditions. Too fine and memory explodes. Too coarse and queries return too many false candidates or lose detail.',
  };
}

function* sparseVoxelCaseStudy() {
  yield {
    state: sparsePipeline('Sparse volume storage keeps active regions, not the whole grid'),
    highlight: { active: ['volume', 'tiles', 'leaves', 'tree', 'e-volume-tiles', 'e-volume-leaves'], found: ['query'] },
    explanation: 'A smoke simulation, medical scan, terrain field, or point-cloud occupancy grid can be mostly empty. Sparse voxel trees store active regions and dense leaf blocks instead of a full 3D array.',
    invariant: 'Sparse means absent regions are cheap; active regions still need dense local access.',
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
    explanation: 'The same recursive cube partition appears in production volume tools, point-cloud libraries, sparse voxel renderers, and occupancy maps. The payload changes; the hierarchy stays recognizable.',
  };

  yield {
    state: sparsePipeline('Queries descend through active nodes and cache hot leaves'),
    highlight: { active: ['query', 'tree', 'cache', 'result', 'e-tree-query', 'e-tree-cache', 'e-cache-result'], compare: ['volume'] },
    explanation: 'Ray casts, box queries, nearest-neighbor candidates, and voxel edits all walk the tree to the relevant leaf blocks. Good implementations cache recent leaves because local edits and rays often touch neighboring voxels.',
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
    explanation: 'An octree can be pointer-heavy, key-sorted, block-packed, or compressed by merging identical subtrees. The right layout depends on update rate, traversal pattern, memory budget, and GPU friendliness.',
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
      heading: 'What it is',
      paragraphs: [
        'An octree recursively partitions three-dimensional space. Each internal node represents a cube and has up to eight child cubes, one for each combination of low or high x, y, and z halves. Leaves store points, occupied voxels, material values, aggregate statistics, or dense blocks of voxel data.',
        'This topic builds on Quadtree Spatial Index & Map Tiles, Morton Codes & Z-Order Curves, Bounding Volume Hierarchy, and R-Tree Spatial Index. A quadtree divides 2D space into four children. An octree does the same in 3D with eight children. A BVH groups primitives by bounding boxes, while an octree imposes a spatial grid hierarchy over the coordinate volume.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with a root cube covering the domain. If the cube is empty, store nothing or a compact empty leaf. If it is uniform, store a leaf. If it is mixed and the tree has not reached maximum depth, split into eight child cubes and recurse. A child path can be encoded as octant bits, and those bits can be packed into Morton-style keys for linear octrees.',
        'Queries use cube bounds. A ray, sphere, box, or frustum test can skip an entire subtree if it does not intersect the cube. Point lookup follows one child at each level. Neighbor search and collision broad phases visit nearby cubes and then run exact checks on the returned candidates. As with quadtrees and BVHs, the tree is a filter before the exact answer.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost depends on occupancy and depth, not just theoretical input size. A dense full octree at depth d has a huge number of possible cells, but sparse storage keeps only active or mixed regions. Point lookup is O(depth). Range and ray queries are proportional to the nodes they visit. Memory overhead can be high with pointer nodes, so production designs use compact child masks, linear Morton keys, dense leaf blocks, caching, or subtree deduplication.',
        'Choosing resolution is the main design decision. Finer voxels preserve detail and reduce false positives but use more memory and deeper traversal. Coarser voxels are cheaper but blur geometry and return larger candidate sets. Dynamic updates add another tradeoff: pointer trees are easy to mutate, while linear or compressed layouts are faster to traverse but harder to edit incrementally.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'OpenVDB is a practical sparse-volume case study. Visual effects and animation workloads need to store smoke, fire, clouds, level sets, and other volumes that are mostly empty. OpenVDB uses a hierarchical sparse tree with internal nodes and dense leaf buffers so empty space is cheap while active regions still have fast local access. This is the core octree lesson adapted into a production volume data structure.',
        'Point-cloud libraries use octrees for a different payload. A LiDAR scan can contain millions of points scattered through 3D space. The octree groups points into cubes, supports approximate neighbor search, detects changes between scans, and provides collision or visibility candidates. The tree does not replace exact geometry; it makes the exact stage small enough to run.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'An octree is not automatically smaller than a grid. If the data is dense and highly detailed everywhere, the hierarchy can add overhead. It wins when empty or uniform regions are common. Another misconception is that every octree should have explicit eight-child pointers. Linear octrees, compact masks, block leaves, and DAG-compressed sparse voxel structures can be much more cache-friendly.',
        'Octrees also need careful coordinate policy. The root bounds, depth, voxel size, precision, and treatment of points on boundaries must be stable. Otherwise the same physical point can move between cells due to floating-point noise or inconsistent quantization.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: OpenVDB documentation at https://www.openvdb.org/documentation/doxygen/overview.html, OpenVDB tree architecture notes at https://www.openvdb.org/documentation/doxygen/tree.html, PCL octree tutorial at https://pcl.readthedocs.io/projects/tutorials/en/latest/octree.html, and sparse voxel octree ray-casting paper at https://research.nvidia.com/publication/2010-02_efficient-sparse-voxel-octrees. Study Quadtree Spatial Index & Map Tiles, Morton Codes & Z-Order Curves, Bounding Volume Hierarchy, R-Tree Spatial Index, and k-d Tree next.',
      ],
    },
  ],
};
