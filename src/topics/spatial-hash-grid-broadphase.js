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
    explanation: 'A spatial hash grid overlays space with fixed-size cells. Each object maps its position or bounding box to one or more cell coordinates, and each coordinate hashes into a table bucket.',
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
    explanation: 'A proximity query reads the cell containing the query and nearby cells. Cell size determines how many neighbors must be checked and how many irrelevant objects appear in each bucket.',
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
    explanation: 'A physics step updates object positions, rebuilds or updates grid buckets, enumerates nearby candidates, deduplicates pairs, and sends the small candidate list to exact narrow-phase collision checks.',
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
        'This topic builds on Hash Table, Quadtree Spatial Index & Map Tiles, Bounding Volume Hierarchy, Octree Sparse Voxel Index, and Interval Tree. It is the practical, dynamic, low-ceremony option: less adaptive than trees, but often faster and simpler when object sizes are similar and positions change every frame.',
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
      heading: 'Cost and complexity',
      paragraphs: [
        'Expected insert and lookup are close to O(1) per touched cell if the hash table stays healthy. The real cost is the number of cells each object touches and the number of objects per cell. Too-small cells make insertion and neighbor search fan out. Too-large cells put many unrelated objects in one bucket. Widely varying object sizes are the classic failure case for one uniform grid.',
        'Spatial hashes are conservative filters. They may return false candidates that are later rejected by exact geometry, but they must not miss real overlaps. Fast-moving objects often need swept bounds or continuous collision detection. Large objects need multi-cell insertion or a separate structure; otherwise they can collide across cells that were never checked.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A pinball-style game with hundreds of similarly sized balls can rebuild a spatial hash every frame. Clear buckets, insert each ball into its cell, inspect same and adjacent cells, deduplicate candidate pairs, and run circle-circle or shape tests only for those candidates. This replaces an O(n^2) all-pairs loop with work proportional to local density.',
        'GPU particle simulations use the same broad idea at larger scale. A common CUDA-style pipeline computes cell ids for particles, sorts particles by cell, finds cell ranges, and then checks neighboring cell ranges in parallel. The data structure becomes a sorted spatial hash grid rather than a pointer-heavy tree, which fits GPU memory access better.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The main misconception is that hashing solves spatial indexing by itself. Cell size is the structure. The hash table only stores the cells. If the cell size is wrong for the workload, performance collapses into too many duplicated insertions or too many false pairs.',
        'Another mistake is forgetting pair deduplication. If object A overlaps four cells and object B overlaps the same four cells, the broad phase can discover A-B four times. Candidate-pair ids or per-frame stamps are needed before expensive narrow-phase work.',
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
