// Sweep and prune projects bounding boxes onto one or more axes, sorts interval
// endpoints, and emits candidate pairs while intervals overlap.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'sweep-and-prune-broadphase',
  title: 'Sweep-and-Prune Broad Phase',
  category: 'Data Structures',
  summary: 'Sort AABB interval endpoints along an axis, keep an active set while sweeping, and emit candidate collision pairs only when intervals overlap.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['sweep axis', 'physics engine case study'], defaultValue: 'sweep axis' },
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

function sweepGraph(title) {
  return graphState({
    nodes: [
      { id: 'a0', label: 'A-', x: 0.8, y: 3.4, note: 'start' },
      { id: 'b0', label: 'B-', x: 2.2, y: 3.4, note: 'start' },
      { id: 'a1', label: 'A+', x: 3.5, y: 3.4, note: 'end' },
      { id: 'c0', label: 'C-', x: 4.8, y: 3.4, note: 'start' },
      { id: 'b1', label: 'B+', x: 6.1, y: 3.4, note: 'end' },
      { id: 'c1', label: 'C+', x: 7.4, y: 3.4, note: 'end' },
      { id: 'active', label: 'active', x: 4.0, y: 1.3, note: 'open intervals' },
      { id: 'pairs', label: 'pairs', x: 8.8, y: 1.3, note: 'maybe' },
      { id: 'narrow', label: 'exact', x: 8.8, y: 5.5, note: 'shape test' },
    ],
    edges: [
      { id: 'e-a0-b0', from: 'a0', to: 'b0' },
      { id: 'e-b0-a1', from: 'b0', to: 'a1' },
      { id: 'e-a1-c0', from: 'a1', to: 'c0' },
      { id: 'e-c0-b1', from: 'c0', to: 'b1' },
      { id: 'e-b1-c1', from: 'b1', to: 'c1' },
      { id: 'e-b0-active', from: 'b0', to: 'active' },
      { id: 'e-active-pairs', from: 'active', to: 'pairs' },
      { id: 'e-pairs-narrow', from: 'pairs', to: 'narrow' },
    ],
  }, { title });
}

function engineGraph(title) {
  return graphState({
    nodes: [
      { id: 'aabb', label: 'AABB', x: 0.8, y: 3.4, note: 'update' },
      { id: 'sortx', label: 'sort X', x: 2.7, y: 1.8, note: 'endpoints' },
      { id: 'sorty', label: 'sort Y', x: 2.7, y: 5.0, note: 'endpoints' },
      { id: 'sweep', label: 'sweep', x: 4.7, y: 3.4, note: 'active set' },
      { id: 'axis', label: 'axes', x: 6.6, y: 1.8, note: 'AND pairs' },
      { id: 'dedupe', label: 'dedupe', x: 6.6, y: 5.0, note: 'pair ids' },
      { id: 'narrow', label: 'narrow', x: 8.6, y: 3.4, note: 'contacts' },
    ],
    edges: [
      { id: 'e-aabb-sortx', from: 'aabb', to: 'sortx' },
      { id: 'e-aabb-sorty', from: 'aabb', to: 'sorty' },
      { id: 'e-sortx-sweep', from: 'sortx', to: 'sweep' },
      { id: 'e-sorty-sweep', from: 'sorty', to: 'sweep' },
      { id: 'e-sweep-axis', from: 'sweep', to: 'axis' },
      { id: 'e-sweep-dedupe', from: 'sweep', to: 'dedupe' },
      { id: 'e-axis-narrow', from: 'axis', to: 'narrow' },
      { id: 'e-dedupe-narrow', from: 'dedupe', to: 'narrow' },
    ],
  }, { title });
}

function* sweepAxis() {
  const objects = ['A', 'B', 'C'];
  const events = ['A-', 'B-', 'A+', 'C-'];

  yield {
    state: sweepGraph('Sort endpoints and sweep from left to right'),
    highlight: { active: ['a0', 'b0', 'a1', 'e-a0-b0', 'e-b0-a1'], found: ['active', 'pairs'] },
    explanation: `Sweep-and-prune projects each bounding box onto an axis. With ${objects.length} objects (${objects.join(', ')}), the sweep processes ${events.length} events. As the sweep line moves, starts add objects to the active set and ends remove them.`,
    invariant: `Two boxes cannot overlap if their intervals are disjoint on any tested axis.`,
  };

  yield {
    state: labelMatrix(
      'Active-set sweep',
      [
        { id: 'a0', label: 'A-' },
        { id: 'b0', label: 'B-' },
        { id: 'a1', label: 'A+' },
        { id: 'c0', label: 'C-' },
      ],
      [
        { id: 'event', label: 'event' },
        { id: 'active', label: 'active set' },
        { id: 'emit', label: 'emit' },
      ],
      [
        ['start A', 'A', 'none'],
        ['start B', 'A,B', 'A-B'],
        ['end A', 'B', 'none'],
        ['start C', 'B,C', 'B-C'],
      ],
    ),
    highlight: { active: ['b0:active', 'b0:emit'], found: ['c0:emit'], compare: ['a1:active'] },
    explanation: `When ${objects[1]} starts while ${objects[0]} is active, their x intervals overlap and ${objects[0]}-${objects[1]} becomes a candidate. When ${objects[0]} ends, it leaves the active set and cannot overlap later starts on this axis.`,
  };

  yield {
    state: sweepGraph('Multiple axes prune false positives'),
    highlight: { active: ['pairs', 'narrow', 'e-pairs-narrow'], compare: ['active'], removed: ['c0'] },
    explanation: `In 2D or 3D, intervals must overlap on every axis for AABBs to overlap. With ${objects.length} objects, a pair discovered on x can still be rejected if y or z intervals are disjoint.`,
  };

  const motionTypes = ['static scene', 'small motion', 'chaotic motion', 'GPU sort'];
  yield {
    state: labelMatrix(
      'Why insertion sort appears',
      [
        { id: 'static', label: 'static scene' },
        { id: 'coherent', label: 'small motion' },
        { id: 'chaotic', label: 'chaotic motion' },
        { id: 'gpu', label: 'GPU sort' },
      ],
      [
        { id: 'order', label: 'endpoint order' },
        { id: 'choice' },
      ],
      [
        ['unchanged', 'reuse list'],
        ['nearly sorted', 'insertion sort'],
        ['scrambled', 'full sort'],
        ['parallel keys', 'radix/sort'],
      ],
    ),
    highlight: { active: ['coherent:order', 'coherent:choice'], found: ['gpu:choice'], compare: ['chaotic:choice'] },
    explanation: `Physics frames are often temporally coherent: this table covers ${motionTypes.length} motion scenarios. Objects move only a little, so endpoint lists stay almost sorted. That is why insertion sort can be excellent here despite its bad worst-case label.`,
  };
}

function* physicsEngineCaseStudy() {
  const pipelineStages = ['AABB', 'sort X', 'sort Y', 'sweep', 'axes', 'dedupe', 'narrow'];
  const axisOptions = ['one axis', 'two axes', 'three axes', 'grid + SAP'];

  yield {
    state: engineGraph('Physics broad phase starts from updated AABBs'),
    highlight: { active: ['aabb', 'sortx', 'sorty', 'e-aabb-sortx', 'e-aabb-sorty'], found: ['sweep'] },
    explanation: `Each frame, a physics engine pushes AABBs through a ${pipelineStages.length}-stage pipeline: ${pipelineStages.join(' -> ')}. Sweep-and-prune sorts interval endpoints, sweeps active sets, intersects axis results, and sends candidates to narrow phase.`,
    invariant: `Broad phase can over-report, but it cannot under-report true overlaps.`,
  };

  yield {
    state: labelMatrix(
      'Axis strategy',
      [
        { id: 'one', label: 'one axis' },
        { id: 'two', label: 'two axes' },
        { id: 'three', label: 'three axes' },
        { id: 'gridSap', label: 'grid + SAP' },
      ],
      [
        { id: 'helps', label: 'helps' },
        { id: 'cost' },
      ],
      [
        ['fast first filter', 'many false positives'],
        ['2D AABB overlap', 'more lists'],
        ['3D AABB overlap', 'more maintenance'],
        ['flat worlds', 'partition tuning'],
      ],
    ),
    highlight: { active: ['two:helps', 'three:helps'], compare: ['one:cost'], found: ['gridSap:helps'] },
    explanation: `This table compares ${axisOptions.length} axis strategies: ${axisOptions.join(', ')}. A single axis is cheap but weak. Multiple axes remove false positives. Engines may also partition a large flat world into regions and run sweep-and-prune inside each region.`,
  };

  yield {
    state: engineGraph('Temporal coherence keeps endpoint updates cheap'),
    highlight: { active: ['sortx', 'sorty', 'sweep', 'e-sortx-sweep', 'e-sorty-sweep'], compare: ['dedupe'], found: ['narrow'] },
    explanation: `When objects move smoothly, only nearby endpoints swap order. The ${pipelineStages.length}-stage pipeline can update lists incrementally, emit pair add/remove events, and avoid a complete rebuild every frame.`,
  };

  const broadPhases = ['SAP', 'hash grid', 'dynamic tree', 'BVH'];
  yield {
    state: labelMatrix(
      'Compare broad-phase choices',
      [
        { id: 'sap', label: 'SAP' },
        { id: 'grid', label: 'hash grid' },
        { id: 'tree', label: 'dynamic tree' },
        { id: 'bvh', label: 'BVH' },
      ],
      [
        { id: 'fits', label: 'fits' },
        { id: 'weakness' },
      ],
      [
        ['coherent motion', 'bad axis choice'],
        ['similar sizes', 'cell-size tuning'],
        ['mixed shapes', 'tree rotations'],
        ['mesh scenes', 'rebuild/refit'],
      ],
    ),
    highlight: { active: ['sap:fits', 'grid:fits'], compare: ['tree:weakness', 'bvh:weakness'] },
    explanation: `No broad phase wins everywhere — this table compares ${broadPhases.length} strategies: ${broadPhases.join(', ')}. Sweep-and-prune is strong when motion is coherent and a small number of axes give good separation.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'sweep axis') yield* sweepAxis();
  else if (view === 'physics engine case study') yield* physicsEngineCaseStudy();
  else throw new InputError('Pick a sweep-and-prune view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/sweep-and-prune-broadphase.gif', alt: 'Animated walkthrough of the sweep and prune broadphase visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'What it is',
      paragraphs: [
        { type: 'callout', text: 'Sweep-and-prune wins by proving non-overlap before geometry, then letting narrow phase spend time only on surviving pairs.' },
        'Sweep-and-prune, also called sort-and-sweep, is a broad-phase collision detection structure for axis-aligned bounding boxes. It projects every box onto one or more axes, sorts interval endpoints, sweeps through those endpoints with an active set, and emits candidate pairs when intervals overlap.',
        'This topic builds on Interval Tree, Insertion Sort, Spatial Hash Grid Broad Phase, Bounding Volume Hierarchy, and Big-O Growth. The data-structure move is to reduce broad-phase geometry to ordered interval events. If two AABBs are disjoint on x, y, or z, they cannot collide, so the engine can avoid expensive shape tests.',
      ],
    },
    {
      heading: 'Why it exists',
      paragraphs: [
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/6/6f/R-tree.svg',
          alt: 'R-tree diagram with object rectangles grouped by larger parent rectangles.',
          caption: 'R-trees use bounding rectangles to reject whole groups of objects; sweep-and-prune uses interval order for the same filter-and-refine goal. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:R-tree.svg.',
        },
        'The naive broad phase compares every pair of bounding boxes. Most pairs are separated on at least one axis, so exact overlap tests waste time proving obvious misses. The wall is that n^2 pairs appear before the narrow phase gets a chance to reject them.',
        'Sweep and prune sorts interval endpoints on one axis and keeps an active set of intervals currently overlapping that sweep position. If two boxes do not overlap on the sweep axis, they cannot collide. The method is correct because full AABB overlap requires overlap on every axis; the sweep axis gives a necessary filter before checking the remaining axes.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is that broad-phase collision detection should prove non-overlap as cheaply as possible. Projection turns a geometric question into an interval-order question: if two boxes are separated on one axis, no more geometry is needed for that pair.',
        'The active set is the compact proof state. It contains only objects whose intervals have started but not ended on the swept axis. A new interval can only overlap objects currently in that set, so the algorithm avoids generating pairs with objects that are already known to be separated.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        "In the sweep-axis view, read each endpoint as an event. A minimum endpoint means the object has entered the active interval set. A maximum endpoint means it has left. Candidate pairs are emitted only when a new interval begins while older intervals are still active.",
        "In the physics-engine view, the highlighted pair is not a confirmed collision. It is a maybe-overlap that survived the cheap one-axis test and still needs the remaining axes and narrow-phase geometry. Sweep-and-prune is a promise to avoid obvious misses, not a promise to solve contact generation.",
        "The active set is the proof state. If object A has already ended before object B begins on the swept axis, those two boxes cannot overlap in full space. If they overlap on the swept axis, the algorithm keeps the pair alive only long enough to test the remaining conditions.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Imagine three boxes projected on the x-axis: A covers [1, 5], B covers [3, 7], and C covers [8, 10]. The sorted endpoint stream is A-min, B-min, A-max, B-max, C-min, C-max. When B-min appears, A is active, so A-B becomes a candidate. When C-min appears, the active set is empty, so C creates no candidate with A or B.',
        'That example shows both the power and the limit. The algorithm rejects A-C and B-C without a two-dimensional box test because they are separated on x. It cannot confirm A-B from x alone; A and B might be separated on y. A robust broad phase treats A-B as a candidate, then intersects candidates across axes or checks the full AABB before narrow-phase shape work.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For one axis, create two endpoints for every object: min and max. Sort the endpoints. Sweep from low to high. When a min endpoint appears, the object overlaps all currently active intervals on that axis, so those pairs become candidates. When a max endpoint appears, remove the object from the active set. In multiple dimensions, a real AABB candidate must overlap on all tested axes.',
        'The reason this is practical in simulations is temporal coherence. Between two adjacent frames, most objects move only a little, so the endpoint list is already almost sorted. Insertion sort, pair-swap maintenance, or incremental updates can be very fast even though a fully scrambled list would need a heavier sort.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost has three parts: updating AABBs, maintaining sorted endpoint lists, and enumerating active-set overlaps. If endpoint order is nearly unchanged, sorting can be close to linear. If many boxes overlap along the chosen axis, the active set grows and candidate output can still approach O(n^2). The output size is not optional; if many objects really overlap, the narrow phase must know about them.',
        'Axis choice matters. A world where objects are spread along x works well with an x sweep. A tall stack or flat world can produce many false positives unless the engine also sweeps y or z, partitions the world, or uses a different broad phase. Sweep-and-prune is a filter, not a complete collision solver.',
      ],
    },
    {
      heading: 'Why temporal coherence matters',
      paragraphs: [
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/0/0f/Insertion-sort-example-300px.gif',
          alt: 'Animated insertion sort moving items into a nearly sorted sequence.',
          caption: 'Insertion sort is the relevant sorting mental model because physics endpoint lists often need local repair, not a full reorder. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Insertion-sort-example-300px.gif.',
        },
        'Sweep-and-prune became popular in simulations because frames resemble the previous frame. Endpoint arrays are usually almost sorted after small object movements. Insertion sort is poor on random data but excellent on nearly sorted data, so the update can be close to linear in calm scenes.',
        'The bad case is a chaotic scene where endpoints reorder heavily every frame, or a teleporting workload where temporal coherence disappears. Then the method falls back toward full sorting plus large candidate generation. Engines often combine it with sleeping objects, world partitioning, or axis selection to keep the common case stable.',
      ],
    },
    {
      heading: 'Engineering the pair cache',
      paragraphs: [
        'A real engine rarely treats candidate pairs as anonymous tuples thrown away every frame. It keeps pair identifiers so contacts can persist, warm-start solvers, and detect when two objects stop overlapping. The broad phase therefore feeds a pair manager: add newly discovered pairs, keep pairs that still overlap, and remove stale pairs when endpoint order proves separation.',
        'This is where small details matter. Endpoint ties must follow the engine definition of touching. Static and sleeping objects can be skipped or updated less often. Fast movers may need swept AABBs so the broad phase covers the path between old and new positions. A good sweep-and-prune implementation is less about one elegant loop and more about preserving stable pair lifecycle under messy simulation updates.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A physics engine can run sweep-and-prune every simulation step. First it updates every shape AABB from the latest transforms. Then it updates sorted endpoint arrays, runs a sweep to generate maybe-overlapping pairs, deduplicates or intersects pairs across axes, and sends candidates to narrow-phase algorithms such as circle overlap, polygon SAT, GJK, or contact manifold generation.',
        'Unity documents broad-phase choices including Sweep and Prune, Multibox Pruning, and Automatic Box Pruning. The practical lesson is that large scenes often combine ideas: grid-like world partitioning can reduce the domain, while sweep-and-prune inside a region exploits local temporal coherence.',
        'The decision is workload-shaped. A side-scrolling game with objects spread along x may get excellent rejection from one axis. A pile of crates stacked vertically may need y or z checks to avoid a huge active set. A world split into regions may run separate sweeps per region so distant objects never enter the same endpoint list.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The main misconception is that sorting endpoints guarantees few candidates. It only guarantees that disjoint intervals on a swept axis are rejected. If many objects overlap on that axis, or the chosen axis is poorly aligned with the scene, the active set becomes large and the broad phase floods the narrow phase.',
        'Another mistake is forgetting endpoint tie rules and pair lifecycle. Starts and ends at the same coordinate need deterministic ordering based on whether touching counts as overlap. Engines also need stable pair ids so contact creation, persistence, and removal do not flicker between frames.',
        'A third mistake is treating one-axis SAP as enough in a three-dimensional world. One axis is a necessary condition, not sufficient. Use additional axis checks, pair caches, or full AABB tests before narrow-phase geometry. Otherwise the broad phase becomes a false-positive factory.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: GPU Gems 3 sort-and-sweep discussion at https://developer.nvidia.com/gpugems/gpugems3/part-v-physics-simulation/chapter-32-broad-phase-collision-detection-cuda, Unity broad-phase pruning manual at https://docs.unity3d.com/6000.3/Documentation/Manual/physics-optimization-cpu-broad-phase.html, SOFA Sweep and Prune documentation at https://sofa-framework.github.io/doc/components/collision/detection/algorithm/detection-sweep-and-prune/, and enhanced sweep-and-prune paper at https://mathweb.ucsd.edu/~sbuss/ResearchWeb/EnhancedSweepPrune/SAP_paper_online.pdf. Study Interval Tree, Insertion Sort, Spatial Hash Grid Broad Phase, Bounding Volume Hierarchy, and Big-O Growth next.',
      ],
    },
  ],
};
