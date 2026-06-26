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
  const gridGraph = hashGridGraph('A spatial hash maps grid cells to hash buckets');
  const gridNodes = gridGraph.graph.nodes;
  const gridEdges = gridGraph.graph.edges;
  const nodeCount = gridNodes.length;
  const edgeCount = gridEdges.length;
  const cellALabel = gridNodes.find(n => n.id === 'cellA').label;
  const cellBLabel = gridNodes.find(n => n.id === 'cellB').label;
  const bucket1Note = gridNodes.find(n => n.id === 'bucket1').note;
  const bucket2Note = gridNodes.find(n => n.id === 'bucket2').note;
  const bucketCount = gridNodes.filter(n => n.id.startsWith('bucket')).length;

  yield {
    state: gridGraph,
    highlight: { active: ['objA', 'cellA', 'hash', 'bucket1', 'e-a-cell', 'e-cellA-hash', 'e-hash-b1'], found: ['near', 'pairs'] },
    explanation: `The highlighted path across ${nodeCount} nodes is the whole index operation: object bounds become integer cell coordinates like (${cellALabel}), and those coordinates become hash keys. The ${bucketCount} buckets store candidates, not proof of contact.`,
    invariant: `Same bucket (holding ${bucket1Note} or ${bucket2Note}) means candidate, not guaranteed overlap.`,
  };

  const cellRows = [
    { id: 'small', label: 'small body' },
    { id: 'wide', label: 'wide body' },
    { id: 'fast', label: 'fast body' },
    { id: 'query', label: 'query ball' },
  ];
  const cellCols = [
    { id: 'cells', label: 'cells' },
    { id: 'risk' },
  ];
  const cellRowCount = cellRows.length;
  const cellColCount = cellCols.length;

  yield {
    state: labelMatrix(
      'Cell assignment',
      cellRows,
      cellCols,
      [
        ['one cell', 'miss edge neighbor'],
        ['many cells', 'duplicate pairs'],
        ['swept cells', 'tunneling'],
        ['cell ring', 'false candidates'],
      ],
    ),
    highlight: { active: ['small:cells', 'wide:cells'], found: ['query:cells'], compare: ['fast:risk'] },
    explanation: `${cellRowCount} body types across ${cellColCount} dimensions: tiny objects may live in one cell. Large or moving objects may need every cell their bounding box or swept path overlaps. That prevents misses but creates duplicate candidate pairs.`,
  };

  const nearGraph = hashGridGraph('Nearby lookup checks same and neighboring cells');

  yield {
    state: nearGraph,
    highlight: { active: ['cellA', 'cellB', 'bucket1', 'bucket2', 'near', 'e-b1-near', 'e-near-pairs'], compare: ['hash'], found: ['pairs'] },
    explanation: `A proximity query reads the query cell (${cellALabel}) and enough neighbor cells like (${cellBLabel}) to cover the search radius. With ${edgeCount} edges in the graph, cell size decides both sides of the cost: more neighbor buckets when cells are tiny, more false candidates when cells are huge.`,
  };

  const sizeRows = [
    { id: 'tiny', label: 'too tiny' },
    { id: 'fit', label: 'near object size' },
    { id: 'huge', label: 'too huge' },
    { id: 'multi', label: 'multi-scale' },
  ];
  const sizeRowCount = sizeRows.length;

  yield {
    state: labelMatrix(
      'Cell-size tradeoff',
      sizeRows,
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
    explanation: `${sizeRowCount} cell-size strategies show the tradeoff: uniform grids are brutally effective when object sizes are similar. If sizes vary wildly, a single cell size either duplicates large objects everywhere or packs too many small objects together.`,
  };
}

function* collisionBroadPhase() {
  const bpGraph = broadPhaseGraph('Broad phase filters possible collision pairs');
  const bpNodes = bpGraph.graph.nodes;
  const bpEdges = bpGraph.graph.edges;
  const bpNodeCount = bpNodes.length;
  const bpEdgeCount = bpEdges.length;
  const queryNote = bpNodes.find(n => n.id === 'query').note;
  const contactsNote = bpNodes.find(n => n.id === 'contacts').note;
  const dedupeNote = bpNodes.find(n => n.id === 'dedupe').note;

  yield {
    state: bpGraph,
    highlight: { active: ['move', 'clear', 'insert', 'query', 'e-move-clear', 'e-move-insert'], found: ['narrow', 'contacts'] },
    explanation: `A ${bpNodeCount}-stage pipeline updates positions, rebuilds or updates buckets, emits ${queryNote} candidate pairs, deduplicates them, and sends only those candidates to exact geometry. The broad phase saves work by being conservative.`,
    invariant: `Broad phase may return false positives; it must not miss true overlaps before reaching the ${contactsNote} stage.`,
  };

  const phaseRows = [
    { id: 'brute', label: 'brute force' },
    { id: 'broad', label: 'broad phase' },
    { id: 'narrow', label: 'narrow phase' },
    { id: 'solve', label: 'solver' },
  ];
  const phaseCols = [
    { id: 'job', label: 'job' },
    { id: 'danger' },
  ];
  const phaseRowCount = phaseRows.length;

  yield {
    state: labelMatrix(
      'Broad phase versus narrow phase',
      phaseRows,
      phaseCols,
      [
        ['all pairs', 'O(n^2)'],
        ['maybe pairs', 'miss = bug'],
        ['exact shape test', 'CPU cost'],
        ['resolve contacts', 'stability'],
      ],
    ),
    highlight: { active: ['broad:job', 'broad:danger'], found: ['narrow:job'], compare: ['brute:danger'] },
    explanation: `Across ${phaseRowCount} pipeline stages and ${bpEdgeCount} edges, the broad phase is allowed to be conservative. It can over-report maybe-collisions, but under-reporting creates objects passing through each other.`,
  };

  const dedupeGraph = broadPhaseGraph('Deduplicate pair ids before exact checks');

  yield {
    state: dedupeGraph,
    highlight: { active: ['query', 'dedupe', 'narrow', 'e-query-dedupe', 'e-query-narrow'], found: ['contacts'], compare: ['insert'] },
    explanation: `Objects that cover multiple cells can be discovered several times. Deduplication via ${dedupeNote} such as min(bodyA, bodyB), max(bodyA, bodyB) lets the engine test each candidate once across all ${bpNodeCount} stages.`,
  };

  const fitRows = [
    { id: 'particles', label: 'particles' },
    { id: 'pinball', label: 'pinball' },
    { id: 'openworld', label: 'open world' },
    { id: 'mixed', label: 'mixed sizes' },
  ];
  const fitRowCount = fitRows.length;
  const strongCount = ['particles', 'pinball', 'openworld'].length;

  yield {
    state: labelMatrix(
      'When spatial hashing fits',
      fitRows,
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
    explanation: `${strongCount} of ${fitRowCount} scenarios show a strong fit: the grid shines for many similarly sized, moving objects. For mixed sizes, engines often add loose grids, hierarchical grids, dynamic AABB trees, or BVHs.`,
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
    { heading: 'How to read the animation', paragraphs: ['Active objects are being mapped from world coordinates into grid cells. Found pairs are only collision candidates, not proven collisions.', {type: 'image', src: './assets/gifs/spatial-hash-grid-broadphase.gif', alt: 'Animated walkthrough of the spatial hash grid broadphase visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'}], },
    { heading: 'Why this exists', paragraphs: ['A collision system first needs a broad phase: a cheap pass that finds pairs worth exact geometry. Testing every pair is correct but turns 10,000 objects into about 50,000,000 checks.', {type: 'callout', text: 'A spatial hash is a conservative locality index: a bucket hit means maybe nearby, never definitely colliding.'}], },
    { heading: 'The obvious approach', paragraphs: ['The obvious approach compares every object with every later object. It cannot miss a collision, and for tiny scenes it may be faster than building an index.'], },
    { heading: 'The wall', paragraphs: ['All-pairs work grows quadratically. Doubling objects from 10,000 to 20,000 raises candidate checks from about 50,000,000 to about 200,000,000.'], },
    { heading: 'The core insight', paragraphs: ['A broad phase only needs conservative locality. Put each object into every grid cell its bounds touch, then compare only objects in the same or neighboring cells.'], },
    { heading: 'How it works', paragraphs: ['Choose a cell size, compute integer cell coordinates with floor(position divided by cell size), and use those coordinates as hash keys. During query, read relevant buckets, deduplicate pairs, and send candidates to exact narrow-phase tests.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Quad_tree_bitmap.svg/500px-Quad_tree_bitmap.svg.png', alt: 'Bitmap image and compressed quadtree representation', caption: 'A quadtree adapts cell detail to data variation; a spatial hash chooses a fixed cell scale and wins only when that scale matches the workload. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Quad_tree_bitmap.svg.'}], },
    { heading: 'Why it works', paragraphs: ['Correctness comes from coverage, not from hashing. If every true overlap shares at least one inserted or checked cell, the broad phase can add false candidates but cannot drop real collisions.'], },
    { heading: 'Cost and complexity', paragraphs: ['Expected insert and lookup are O(1) per touched cell. Real cost is cells per object plus objects per cell, so cell size controls whether the grid stays local or collapses into crowded buckets.'], },
    { heading: 'Real-world uses', paragraphs: ['Spatial hashes fit games, particle systems, simple physics engines, and sparse map interaction layers. They are strongest when objects are similarly sized and move often enough that rebuilding is cheaper than maintaining a tree.'], },
    { heading: 'Where it fails', paragraphs: ['It fails with wildly different object sizes, dense clusters, fast movers, and long thin shapes. Those cases create too many touched cells, too many false candidates, or missed swept contacts unless the bounds rule changes.'], },
    { heading: 'Worked example', paragraphs: ['With cell size 16, a particle at x = 130 and y = 77 maps to cell (8, 4). If its radius makes the bounds cross the right and bottom edges, it is inserted into four cells; a pair found twice is emitted once with a canonical pair key.'], },
    { heading: 'Sources and study next', paragraphs: ['Study GPU Gems broad-phase collision detection, Box2D broad-phase notes, hierarchical spatial hashing papers, and practical collision-index implementations. Then compare Hash Table, Quadtree, Bounding Volume Hierarchy, Octree, and Sweep and Prune.'], },
  ],
};
