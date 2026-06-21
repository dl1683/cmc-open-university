// Spatial hash grids use a hash table keyed by grid coordinates to make nearby
// object lookup and collision broad-phase checks cheap in dynamic scenes.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'spatial-hash-grid-broadphase',
  title: 'Spatial Hash Grid Broad Phase',
  category: 'Data Structures',
  summary: 'Hash grid-cell coordinates to buckets, insert moving objects into overlapped cells, and test only same-cell or neighbor-cell candidates before exact collision checks.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['hash cells', 'collision broad phase'], defaultValue: 'hash cells' },
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

function hashGridGraph(title) {
  return graphState({
    nodes: [
      { id: 'objA', label: 'A', x: 0.8, y: 2.0, note: 'body' },
      { id: 'objB', label: 'B', x: 0.8, y: 5.0, note: 'body' },
      { id: 'cellA', label: '3,2', x: 2.8, y: 2.0, note: 'cell' },
      { id: 'cellB', label: '3,3', x: 2.8, y: 5.0, note: 'cell' },
      { id: 'hash', label: 'hash', x: 4.8, y: 3.5, note: 'coord key' },
      { id: 'bucket1', label: 'b12', x: 6.7, y: 2.0, note: 'A,C' },
      { id: 'bucket2', label: 'b13', x: 6.7, y: 5.0, note: 'B,D' },
      { id: 'near', label: 'near', x: 8.7, y: 2.0, note: 'neighbors' },
      { id: 'pairs', label: 'pairs', x: 8.7, y: 5.0, note: 'maybe' },
    ],
    edges: [
      { id: 'e-a-cell', from: 'objA', to: 'cellA' },
      { id: 'e-b-cell', from: 'objB', to: 'cellB' },
      { id: 'e-cellA-hash', from: 'cellA', to: 'hash' },
      { id: 'e-cellB-hash', from: 'cellB', to: 'hash' },
      { id: 'e-hash-b1', from: 'hash', to: 'bucket1' },
      { id: 'e-hash-b2', from: 'hash', to: 'bucket2' },
      { id: 'e-b1-near', from: 'bucket1', to: 'near' },
      { id: 'e-b2-pairs', from: 'bucket2', to: 'pairs' },
      { id: 'e-near-pairs', from: 'near', to: 'pairs' },
    ],
  }, { title });
}

function broadPhaseGraph(title) {
  return graphState({
    nodes: [
      { id: 'move', label: 'move', x: 0.8, y: 3.4, note: 'bodies' },
      { id: 'clear', label: 'clear', x: 2.5, y: 1.8, note: 'buckets' },
      { id: 'insert', label: 'insert', x: 2.5, y: 5.0, note: 'cells' },
      { id: 'query', label: 'query', x: 4.5, y: 3.4, note: 'neighbors' },
      { id: 'dedupe', label: 'dedupe', x: 6.4, y: 1.8, note: 'pair ids' },
      { id: 'narrow', label: 'narrow', x: 6.4, y: 5.0, note: 'exact' },
      { id: 'contacts', label: 'contacts', x: 8.6, y: 3.4, note: 'physics' },
    ],
    edges: [
      { id: 'e-move-clear', from: 'move', to: 'clear' },
      { id: 'e-move-insert', from: 'move', to: 'insert' },
      { id: 'e-clear-query', from: 'clear', to: 'query' },
      { id: 'e-insert-query', from: 'insert', to: 'query' },
      { id: 'e-query-dedupe', from: 'query', to: 'dedupe' },
      { id: 'e-query-narrow', from: 'query', to: 'narrow' },
      { id: 'e-dedupe-contacts', from: 'dedupe', to: 'contacts' },
      { id: 'e-narrow-contacts', from: 'narrow', to: 'contacts' },
    ],
  }, { title });
}

function* hashCells() {
  yield {
    state: hashGridGraph('A spatial hash maps grid cells to hash buckets'),
    highlight: { active: ['objA', 'cellA', 'hash', 'bucket1', 'e-a-cell', 'e-cellA-hash', 'e-hash-b1'], found: ['near', 'pairs'] },
    explanation: 'The highlighted path is the whole index operation: object bounds become integer cell coordinates, and those coordinates become hash keys. The bucket stores candidates, not proof of contact.',
    invariant: 'Same bucket means candidate, not guaranteed overlap.',
  };

  yield {
    state: labelMatrix(
      'Cell assignment',
      [
        { id: 'small', label: 'small body' },
        { id: 'wide', label: 'wide body' },
        { id: 'fast', label: 'fast body' },
        { id: 'query', label: 'query ball' },
      ],
      [
        { id: 'cells', label: 'cells' },
        { id: 'risk' },
      ],
      [
        ['one cell', 'miss edge neighbor'],
        ['many cells', 'duplicate pairs'],
        ['swept cells', 'tunneling'],
        ['cell ring', 'false candidates'],
      ],
    ),
    highlight: { active: ['small:cells', 'wide:cells'], found: ['query:cells'], compare: ['fast:risk'] },
    explanation: 'Tiny objects may live in one cell. Large or moving objects may need every cell their bounding box or swept path overlaps. That prevents misses but creates duplicate candidate pairs.',
  };

  yield {
    state: hashGridGraph('Nearby lookup checks same and neighboring cells'),
    highlight: { active: ['cellA', 'cellB', 'bucket1', 'bucket2', 'near', 'e-b1-near', 'e-near-pairs'], compare: ['hash'], found: ['pairs'] },
    explanation: 'A proximity query reads the query cell and enough neighbor cells to cover the search radius. Cell size decides both sides of the cost: more neighbor buckets when cells are tiny, more false candidates when cells are huge.',
  };

  yield {
    state: labelMatrix(
      'Cell-size tradeoff',
      [
        { id: 'tiny', label: 'too tiny' },
        { id: 'fit', label: 'near object size' },
        { id: 'huge', label: 'too huge' },
        { id: 'multi', label: 'multi-scale' },
      ],
      [
        { id: 'benefit', label: 'benefit' },
        { id: 'cost' },
      ],
      [
        ['few per cell', 'many cells touched'],
        ['balanced', 'workload-specific'],
        ['cheap insert', 'many false pairs'],
        ['handles sizes', 'more machinery'],
      ],
    ),
    highlight: { active: ['fit:benefit', 'fit:cost'], compare: ['tiny:cost', 'huge:cost'], found: ['multi:benefit'] },
    explanation: 'Uniform grids are brutally effective when object sizes are similar. If sizes vary wildly, a single cell size either duplicates large objects everywhere or packs too many small objects together.',
  };
}

function* collisionBroadPhase() {
  yield {
    state: broadPhaseGraph('Broad phase filters possible collision pairs'),
    highlight: { active: ['move', 'clear', 'insert', 'query', 'e-move-clear', 'e-move-insert'], found: ['narrow', 'contacts'] },
    explanation: 'A physics step updates positions, rebuilds or updates buckets, emits nearby candidate pairs, deduplicates them, and sends only those candidates to exact geometry. The broad phase saves work by being conservative.',
    invariant: 'Broad phase may return false positives; it must not miss true overlaps.',
  };

  yield {
    state: labelMatrix(
      'Broad phase versus narrow phase',
      [
        { id: 'brute', label: 'brute force' },
        { id: 'broad', label: 'broad phase' },
        { id: 'narrow', label: 'narrow phase' },
        { id: 'solve', label: 'solver' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'danger' },
      ],
      [
        ['all pairs', 'O(n^2)'],
        ['maybe pairs', 'miss = bug'],
        ['exact shape test', 'CPU cost'],
        ['resolve contacts', 'stability'],
      ],
    ),
    highlight: { active: ['broad:job', 'broad:danger'], found: ['narrow:job'], compare: ['brute:danger'] },
    explanation: 'The broad phase is allowed to be conservative. It can over-report maybe-collisions, but under-reporting creates objects passing through each other.',
  };

  yield {
    state: broadPhaseGraph('Deduplicate pair ids before exact checks'),
    highlight: { active: ['query', 'dedupe', 'narrow', 'e-query-dedupe', 'e-query-narrow'], found: ['contacts'], compare: ['insert'] },
    explanation: 'Objects that cover multiple cells can be discovered several times. Pair ids such as min(bodyA, bodyB), max(bodyA, bodyB) let the engine test each candidate once.',
  };

  yield {
    state: labelMatrix(
      'When spatial hashing fits',
      [
        { id: 'particles', label: 'particles' },
        { id: 'pinball', label: 'pinball' },
        { id: 'openworld', label: 'open world' },
        { id: 'mixed', label: 'mixed sizes' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'reason' },
      ],
      [
        ['strong', 'similar radii'],
        ['strong', 'many moving balls'],
        ['strong', 'unbounded coords'],
        ['weak alone', 'needs hierarchy'],
      ],
    ),
    highlight: { active: ['particles:fit', 'pinball:fit'], found: ['openworld:reason'], compare: ['mixed:fit'] },
    explanation: 'The grid shines for many similarly sized, moving objects. For mixed sizes, engines often add loose grids, hierarchical grids, dynamic AABB trees, or BVHs.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'hash cells') yield* hashCells();
  else if (view === 'collision broad phase') yield* collisionBroadPhase();
  else throw new InputError('Pick a spatial-hash-grid view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A spatial hash grid is a hash table whose keys are grid-cell coordinates. Instead of storing objects in a fixed 2D or 3D array, the system computes a cell coordinate such as floor(x / cellSize), floor(y / cellSize), hashes that coordinate, and stores object ids in the bucket for that cell. Empty space costs almost nothing because only occupied cells need buckets.',
        {type: 'callout', text: 'A spatial hash is a conservative locality index: a bucket hit means maybe nearby, never definitely colliding.'},
        'This topic builds on Hash Table, Quadtree Spatial Index & Map Tiles, Bounding Volume Hierarchy, Octree Sparse Voxel Index, and Interval Tree. It is the practical, dynamic, low-ceremony option: less adaptive than trees, but often faster and simpler when object sizes are similar and positions change every frame.',
      ],
    },
    {
      heading: 'Why it exists',
      paragraphs: [
        'The naive collision broad phase tests every object against every other object. That gives O(n^2) candidate pairs before exact geometry even starts. A tree index can help, but for many similarly sized moving objects, rebuilding or updating a tree every frame can be unnecessary ceremony.',
        'A spatial hash grid makes locality a hash-table problem. Objects that can collide must share a cell or a neighboring cell under the chosen cell-size rule, so the broad phase inspects only local buckets. It is correct only if insertion covers every cell an object can overlap and neighbor checks cover every possible cross-cell contact.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is that a broad phase does not need exact geometry. It needs a cheap, conservative test that never drops a real collision. The grid cell is that test: if the object bounds and neighbor rule are chosen correctly, any true overlap will appear in at least one checked bucket.',
        'The invariant is coverage. Every object must be inserted into every cell its current or swept bounds can touch, and every query must inspect every neighboring cell that could contain an overlapping object. Hashing only makes sparse storage cheap. Correctness comes from the coverage rule, not from the hash function.',
      ],
    },
    {
      heading: 'What the visual shows',
      paragraphs: [
        "In the hash-cells view, the coordinate transform is the point. The object is not being placed into a visual grid for decoration; its world-space bounds are being converted into integer cell coordinates, and those coordinates become hash keys.",
        "In the collision broad-phase view, the important mark is a candidate pair. Objects in unrelated cells are ruled out before exact geometry runs. Objects in the same or neighboring cells are only candidates, not confirmed collisions, because the grid is a conservative filter.",
        "The useful question is which real collision would be missed if the object were inserted into fewer cells or if fewer neighbors were checked. That question exposes the correctness rule: the broad phase may produce extra work, but it cannot drop a real overlap.",
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Insertion maps an object to every cell overlapped by its bounding box, or sometimes just the cell containing its center if the cell-size rule makes that safe. A nearby query reads the object ids in the same cell and neighboring cells. Collision broad phase enumerates candidate pairs from those buckets, deduplicates repeated pairs, and passes candidates to exact narrow-phase checks.',
        'The hash function must combine integer cell coordinates into a stable key. For bounded worlds, a dense grid array can be faster. For unbounded or sparse worlds, hashing avoids allocating millions of empty cells. Negative coordinates, pair deduplication, object removal, and frame-to-frame bucket cleanup are usually where bugs appear.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Imagine 10,000 bullets and particles in a large game arena. An all-pairs broad phase would consider about 50 million unordered pairs before it even asks whether two circles overlap. If each particle has a radius near 4 pixels and the grid cell is 16 pixels wide, each particle usually touches one to four cells. Most buckets stay small, so the broad phase spends its time on nearby objects.',
        'For a particle at x=130, y=77 with cell size 16, the base cell is (8, 4). If its bounding box crosses the right cell boundary, insertion also touches (9, 4). If it crosses both axes, insertion touches four cells. During candidate generation, a pair discovered in multiple buckets is emitted once, often by storing a canonical pair key such as minId:maxId.',
        'The narrow phase still owns the exact answer. The spatial hash only says, "these two are close enough to deserve a real test." That separation is why the structure is so common: cheap locality first, precise geometry second.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Expected insert and lookup are close to O(1) per touched cell if the hash table stays healthy. The real cost is the number of cells each object touches and the number of objects per cell. Too-small cells make insertion and neighbor search fan out. Too-large cells put many unrelated objects in one bucket. Widely varying object sizes are the classic failure case for one uniform grid.',
        'Spatial hashes are conservative filters. They may return false candidates that are later rejected by exact geometry, but they must not miss real overlaps. Fast-moving objects often need swept bounds or continuous collision detection. Large objects need multi-cell insertion or a separate structure; otherwise they can collide across cells that were never checked.',
      ],
    },
    {
      heading: 'Choosing cell size',
      paragraphs: [
        'Cell size is the main design decision. If all objects have roughly the same diameter, a cell size near that diameter or a small multiple of it often works well. If cells are much smaller than objects, each object is inserted into many buckets. If cells are much larger, bucket contents grow and the structure drifts back toward all-pairs testing inside each bucket.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Quad_tree_bitmap.svg/500px-Quad_tree_bitmap.svg.png', alt: 'Bitmap image and compressed quadtree representation', caption: 'A quadtree adapts cell detail to data variation; a spatial hash chooses a fixed cell scale and wins only when that scale matches the workload. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Quad_tree_bitmap.svg.'},
        'Mixed-size worlds often need more than one layer. A uniform grid can handle small dynamic objects while large static geometry lives in a quadtree, BVH, or hand-authored spatial partition. Another option is a hierarchical hash grid, where object size chooses the grid level. The point is not to worship one data structure; it is to keep local density bounded.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A pinball-style game with hundreds of similarly sized balls can rebuild a spatial hash every frame. Clear buckets, insert each ball into its cell, inspect same and adjacent cells, deduplicate candidate pairs, and run circle-circle or shape tests only for those candidates. This replaces an O(n^2) all-pairs loop with work proportional to local density.',
        'GPU particle simulations use the same broad idea at larger scale. A common CUDA-style pipeline computes cell ids for particles, sorts particles by cell, finds cell ranges, and then checks neighboring cell ranges in parallel. The data structure becomes a sorted spatial hash grid rather than a pointer-heavy tree, which fits GPU memory access better.',
        'Robotics and mapping systems use the same mental model when they bucket observations by local region before doing expensive geometric work. The implementation details differ, but the principle is the same: first create a cheap locality index, then reserve exact math for objects that survived that locality test.',
      ],
    },
    {
      heading: 'Where it wins and fails',
      paragraphs: [
        'Spatial hashing wins in dynamic scenes with many similarly sized objects and lots of empty space. Games, particle systems, simple physics engines, and map interaction layers often prefer it because it is easy to rebuild, easy to parallelize, and does not require rotations, tree rebalancing, or complex update logic.',
        'It fails when scale varies wildly, density is highly clustered, or the world has important long thin shapes that cross many cells. In those cases the grid may produce too many duplicate insertions or too many false candidates. BVHs, quadtrees, sweep-and-prune, or hybrid indexes can be better because they adapt to shape, size, or axis ordering.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The main misconception is that hashing solves spatial indexing by itself. Cell size is the structure. The hash table only stores the cells. If the cell size is wrong for the workload, performance collapses into too many duplicated insertions or too many false pairs.',
        'Another mistake is forgetting pair deduplication. If object A overlaps four cells and object B overlaps the same four cells, the broad phase can discover A-B four times. Candidate-pair ids or per-frame stamps are needed before expensive narrow-phase work.',
        'A third mistake is using the current position only for fast movers. If an object can travel through another object between frames, a spatial hash built from the endpoint can miss the crossing. The broad phase must index swept bounds, shrink the timestep, or hand the case to continuous collision detection.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: GPU Gems 3 broad-phase spatial subdivision at https://developer.nvidia.com/gpugems/gpugems3/part-v-physics-simulation/chapter-32-broad-phase-collision-detection-cuda, Box2D broad-phase documentation overview at https://box2d.org/documentation/, hierarchical spatial hashing paper at https://matthias-research.github.io/pages/publications/hsh.pdf, and spatial index implementation notes at https://kortham.net/posts/collision-detect-and-spatial-indexes/. Study Hash Table, Bounding Volume Hierarchy, Octree Sparse Voxel Index, Quadtree Spatial Index & Map Tiles, and Interval Tree next.',
      ],
    },
  ],
};
