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
        'Read each endpoint as an event on one sweep axis. A minimum endpoint inserts the object into the active set; a maximum endpoint removes it.',
        'A highlighted pair is only a candidate collision. It means the boxes overlap on the swept axis, not that their full shapes touch.',
        {
          type: 'image',
          src: './assets/gifs/sweep-and-prune-broadphase.gif',
          alt: 'Animated walkthrough of the sweep and prune broadphase visualization',
          caption: 'Animation preview: the full visualization plays through each step at reading pace.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'callout',
          text: 'Sweep-and-prune wins by proving non-overlap before geometry, then letting narrow phase spend time only on surviving pairs.',
        },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/6/6f/R-tree.svg',
          alt: 'R-tree diagram with object rectangles grouped by larger parent rectangles.',
          caption: 'R-trees use bounding rectangles to reject whole groups of objects; sweep-and-prune uses interval order for the same filter-and-refine goal. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:R-tree.svg.',
        },
        'A physics engine cannot run exact shape collision tests for every pair of bodies each frame. The broad phase exists to reject pairs that are obviously separated before the narrow phase spends time on exact geometry.',
        'Axis-aligned bounding boxes, or AABBs, give a cheap wrapper around each object. If two AABBs do not overlap on x, y, or z, the real objects inside them cannot collide.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious broad phase compares every AABB with every other AABB. With n objects, that creates n(n - 1) / 2 tests, and the method is easy to implement and useful as a correctness oracle for small scenes.',
        'For 1,000 objects, the brute-force loop checks 499,500 pairs before it learns which pairs are impossible. Most simulations have far fewer real contacts than possible pairs, so that work is mostly rejection.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is pair explosion. Even if no objects touch, brute force still pays for every pair because it has no ordered proof that some objects are separated.',
        'A second wall appears when the world is updated every frame. The broad phase must be rebuilt or repaired quickly enough that collision detection does not dominate simulation time.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Project each box onto an axis and sort the interval endpoints. If interval A ends before interval B begins on that axis, A and B cannot overlap in full space.',
        'The active set is the proof state. It contains exactly the boxes whose intervals have started but not yet ended, so a new interval can only form candidates with boxes in that set.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Create a min endpoint and max endpoint for each object on the chosen axis. Sweep the sorted list from low to high, adding an object at its min endpoint and removing it at its max endpoint.',
        'When object B enters while A is active, emit A-B as a candidate for later y, z, or shape checks. In multiple dimensions, engines either intersect candidate sets from several axes or run a full AABB test before narrow-phase contact generation.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/0/0f/Insertion-sort-example-300px.gif',
          alt: 'Animated insertion sort moving items into a nearly sorted sequence.',
          caption: 'Insertion sort is the relevant sorting mental model because physics endpoint lists often need local repair, not a full reorder. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Insertion-sort-example-300px.gif.',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is a necessary-condition proof. Full AABB overlap requires overlap on every axis, so separation on even one axis proves non-collision.',
        'The sweep does not miss any one-axis overlap because two intervals overlap exactly when the later-starting interval begins before the earlier interval has ended. At that moment the earlier interval is active, so the pair is emitted.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Building the endpoint order from scratch costs O(n log n), and the sweep costs O(n + c), where c is the number of emitted candidates. In a calm simulation, endpoint order changes little from the previous frame, so insertion-sort-style repair can behave close to O(n).',
        'The worst case remains O(n^2) candidates. If every projected interval overlaps every other interval, the active set grows to n and the broad phase cannot hide that the scene itself is dense.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Sweep-and-prune fits physics simulations where objects move smoothly between frames. Racing games, side-scrollers, and worlds with a dominant spatial axis can get strong rejection from a single sorted endpoint list.',
        'Engines also use it inside regions or islands. A spatial partition can first keep distant objects out of the same list, while sweep-and-prune exploits temporal coherence within each local group.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the chosen axis does not separate the scene. A vertical pile of boxes may overlap heavily on x, flooding the narrow phase even though y would have been more selective.',
        'It also fails when temporal coherence disappears. Teleporting objects, explosions, or chaotic motion can force heavy resorting and invalidate the nearly sorted assumption.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Project three boxes onto x: A = [1, 5], B = [3, 7], and C = [8, 10]. The sorted events are A-min, B-min, A-max, B-max, C-min, C-max.',
        'At A-min, active becomes {A}. At B-min, A is active, so A-B is emitted. A-max removes A, B-max removes B, and C-min enters an empty active set, so C forms no candidate with A or B.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Ericson, Real-Time Collision Detection, for broad-phase and narrow-phase collision design. Next study interval trees for interval queries, insertion sort for temporal coherence, bounding volume hierarchies for hierarchical rejection, and spatial hash grids for uniform-world alternatives.',
      ],
    },
  ],
};
