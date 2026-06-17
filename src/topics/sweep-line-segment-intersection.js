// Sweep-line segment intersection: event queue plus ordered active status.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'sweep-line-segment-intersection',
  title: 'Sweep Line Segment Intersection',
  category: 'Algorithms',
  summary: 'Move a vertical sweep line through segment endpoints and crossings, maintaining an ordered status tree and event queue.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['event sweep', 'robust cases'], defaultValue: 'event sweep' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function sweepGraph(title) {
  return graphState({
    nodes: [
      { id: 'events', label: 'Q', x: 0.8, y: 4.0, note: 'events' },
      { id: 'sweep', label: 'x=t', x: 2.7, y: 4.0, note: 'line' },
      { id: 's1', label: 's1', x: 4.8, y: 1.7, note: 'active' },
      { id: 's2', label: 's2', x: 4.8, y: 4.0, note: 'active' },
      { id: 's3', label: 's3', x: 4.8, y: 6.3, note: 'active' },
      { id: 'status', label: 'T', x: 7.0, y: 4.0, note: 'status' },
      { id: 'hit', label: 'X', x: 9.0, y: 4.0, note: 'crossing' },
    ],
    edges: [
      { id: 'e-events-sweep', from: 'events', to: 'sweep', weight: '' },
      { id: 'e-sweep-s1', from: 'sweep', to: 's1', weight: '' },
      { id: 'e-sweep-s2', from: 'sweep', to: 's2', weight: '' },
      { id: 'e-sweep-s3', from: 'sweep', to: 's3', weight: '' },
      { id: 'e-s1-status', from: 's1', to: 'status', weight: '' },
      { id: 'e-s2-status', from: 's2', to: 'status', weight: '' },
      { id: 'e-s3-status', from: 's3', to: 'status', weight: '' },
      { id: 'e-status-hit', from: 'status', to: 'hit', weight: '' },
    ],
  }, { title });
}

function* eventSweep() {
  yield {
    state: sweepGraph('Sweep through sorted events from left to right'),
    highlight: { active: ['events', 'sweep', 'e-events-sweep'], compare: ['status'] },
    explanation: 'The Bentley-Ottmann idea is to simulate a moving vertical line using a priority queue of future events. Endpoints are known at the start; intersections are discovered when neighboring active segments can cross.',
    invariant: 'Between events, the vertical order of active segments cannot change.',
  };

  yield {
    state: labelMatrix(
      'Event queue',
      [
        { id: 'left', label: 'left endpoint' },
        { id: 'cross', label: 'intersection' },
        { id: 'right', label: 'right endpoint' },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'status', label: 'status update' },
      ],
      [
        ['insert segment', 'check neighbors'],
        ['report crossing', 'swap order'],
        ['remove segment', 'check new neighbors'],
      ],
    ),
    highlight: { active: ['left:action', 'cross:status'], found: ['right:status'] },
    explanation: 'The event queue is ordered by x coordinate. The active status is ordered by where each segment intersects the current sweep line.',
  };

  yield {
    state: sweepGraph('Only adjacent active segments can create the next crossing'),
    highlight: { active: ['s1', 's2', 'status', 'e-s1-status', 'e-s2-status'], found: ['hit'], compare: ['s3'] },
    explanation: 'A segment can cross many others over the full plane, but the next crossing must be between neighbors in the current vertical order. That localizes the search from all pairs to adjacent status pairs.',
  };

  yield {
    state: labelMatrix(
      'Data structures',
      [
        { id: 'heap', label: 'event queue' },
        { id: 'bst', label: 'status tree' },
        { id: 'set', label: 'reported set' },
        { id: 'pred', label: 'orientation' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'operation', label: 'operation' },
      ],
      [
        ['future events', 'extract min x'],
        ['active segments', 'above/below neighbor'],
        ['crossing ids', 'deduplicate'],
        ['geometry tests', 'compare and intersect'],
      ],
    ),
    highlight: { active: ['heap:operation', 'bst:operation'], found: ['pred:stores'] },
    explanation: 'This is a clean composition: Binary Heap schedules time, Red-Black Tree stores sweep order, and orientation/intersection predicates do the geometry.',
  };

  yield {
    state: sweepGraph('Complete case: endpoint, neighbor check, crossing, swap'),
    highlight: { active: ['events', 'sweep', 'status'], found: ['hit'], compare: ['s1', 's2'] },
    explanation: 'The complete loop repeatedly pops the next event, updates the active set, reports or schedules crossings, and relies on the invariant that only neighbor relationships change at event points.',
  };
}

function* robustCases() {
  yield {
    state: labelMatrix(
      'Degenerate geometry cases',
      [
        { id: 'sameX', label: 'same x event' },
        { id: 'vertical', label: 'vertical segment' },
        { id: 'endpoint', label: 'shared endpoint' },
        { id: 'multi', label: 'many cross' },
      ],
      [
        { id: 'problem', label: 'problem' },
        { id: 'policy', label: 'policy' },
      ],
      [
        ['event tie', 'stable ordering'],
        ['no left/right', 'special endpoint order'],
        ['is it intersection?', 'closed segment rule'],
        ['status update batch', 'process together'],
      ],
    ),
    highlight: { active: ['sameX:policy', 'vertical:policy'], found: ['multi:policy'] },
    explanation: 'Textbook sweep descriptions often assume general position. Real geometry needs explicit policies for equal coordinates, vertical segments, shared endpoints, overlapping collinear segments, and multiple segments crossing at one point.',
  };

  yield {
    state: sweepGraph('Robust implementations batch events at the same point'),
    highlight: { active: ['events', 'sweep', 'status'], found: ['hit'], compare: ['s1', 's2', 's3'] },
    explanation: 'If several segments meet at one point, process them as one event rather than as an arbitrary sequence that can corrupt the status order.',
  };

  yield {
    state: labelMatrix(
      'Cost model',
      [
        { id: 'brute', label: 'all pairs' },
        { id: 'sweep', label: 'sweep line' },
        { id: 'dense', label: 'many crossings' },
        { id: 'robust', label: 'robustness' },
      ],
      [
        { id: 'time', label: 'time' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['O(n^2)', 'simple baseline'],
        ['O((n+k) log n)', 'output-sensitive'],
        ['k can be n^2', 'no free lunch'],
        ['predicate cost', 'engineering matters'],
      ],
    ),
    highlight: { active: ['sweep:time', 'sweep:lesson'], compare: ['dense:time'] },
    explanation: 'The algorithm is output-sensitive: k is the number of crossings. If nearly every segment crosses every other segment, the output itself is quadratic.',
  };

  yield {
    state: labelMatrix(
      'Case study: map overlay',
      [
        { id: 'roads', label: 'road lines' },
        { id: 'parcels', label: 'parcel edges' },
        { id: 'events', label: 'events' },
        { id: 'output', label: 'output' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['segments', 'near-collinear edges'],
        ['segments', 'shared endpoints'],
        ['endpoint/crossing heap', 'tie handling'],
        ['intersection points', 'duplicate reports'],
      ],
    ),
    highlight: { active: ['events:role', 'output:role'], found: ['parcels:risk'] },
    explanation: 'GIS overlays are where elegant sweep-line ideas meet messy input. The data structures are straightforward; correctness depends on precise degeneracy and numeric policies.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'event sweep') yield* eventSweep();
  else if (view === 'robust cases') yield* robustCases();
  else throw new InputError('Pick a sweep-line view.');
}

export const article = {
  sections: [
    {
      heading: `Why This Exists`,
      paragraphs: [
        `Segment-intersection reporting shows up whenever a program must turn drawn or measured geometry into trustworthy topology. Map overlays, CAD validation, vector graphics cleanup, road networks, VLSI layouts, and planar graph checks all need to know which segment pairs meet.`,
        `The important word is reporting. The algorithm is not merely asking whether one crossing exists; it must output every crossing. A sweep line is useful because many real drawings have far fewer intersections than segment pairs, so the running time should track the output instead of blindly charging for all pairs.`,
      ],
    },
    {
      heading: `Naive Baseline and Wall`,
      paragraphs: [
        `The baseline is all-pairs testing: for every pair of segments, run an orientation test and a bounding-box check. It is exact if the predicates are exact, easy to implement for small inputs, and a good way to test a more sophisticated implementation.`,
        `The wall is pair explosion. With n segments there are n(n - 1) / 2 pairs, even when only a few segments are geometrically close. The missing idea is locality: as a vertical line moves left to right, only neighboring active segments can be the next pair to change order.`,
      ],
    },
    {
      heading: `Core Insight and Invariant`,
      paragraphs: [
        `Move a conceptual vertical sweep line through the plane. The event queue stores x-ordered endpoints and discovered intersections. The status tree stores only the segments currently crossing the sweep line, ordered by their y-coordinate at the current x.`,
        `The invariant is that active vertical order changes only at events: a segment enters, leaves, or two adjacent segments cross. Between events, no segment endpoint or crossing is encountered, so the order is fixed. That makes neighbor checks sufficient after each status update.`,
      ],
    },
    {
      heading: 'What the views teach',
      paragraphs: [
        `In the event sweep view, read Q as future time and T as the live vertical order. Endpoint rows insert or remove a segment; intersection rows report a crossing and swap two neighbors. The highlighted neighbor pair is the only place a new crossing can become newly relevant.`,
        `In the robust cases view, the table is not an implementation footnote. Same-x events, vertical segments, shared endpoints, collinear overlap, and many segments meeting at one point decide whether the textbook invariant survives real data. The animation's batch-at-one-point frame is the practical lesson.`,
        `The graph is not saying that distant segments can never cross. It is saying they cannot be the next crossing while another active segment sits between them in sweep order. That is the algorithmic meaning of the status tree: it stores the current adjacency relation that makes future intersection tests local.`,
      ],
    },
    {
      heading: `Mechanics`,
      paragraphs: [
        `Initialize the event priority queue with all segment endpoints. Each event is ordered primarily by x, with tie-breaking rules for equal coordinates. The status tree compares segments by where they intersect the current sweep x, using robust orientation and intersection predicates rather than a casual floating-point y calculation when correctness matters.`,
        `At a left endpoint, insert the segment into status order and test it against the predecessor and successor. At a right endpoint, remove it and test the new predecessor-successor pair. At an intersection event, report the point, swap the two crossed segments in the status tree, and test each against its new outside neighbor. A reported-event set prevents duplicate crossing events from being scheduled repeatedly.`,
        `Many implementations store events by exact point and type, not just by x. Processing all segments that start, end, and cross at the same point as one batch avoids status orders that depend on arbitrary queue tie breaks. That batch step is where a classroom algorithm becomes a reliable geometry routine.`,
      ],
    },
    {
      heading: `Correctness`,
      paragraphs: [
        `The sweep invariant gives the proof. Suppose two segments are the next unreported pair to intersect. Just before their intersection, they must be adjacent in the active vertical order; if another active segment were between them, one of the pairs involving that middle segment would need to cross first to let the order change.`,
        `Every event that can make a new adjacent pair is handled immediately: insertion creates two possible neighbor pairs, deletion creates one, and a crossing creates the pairs around the swapped segments. Therefore no future crossing between active segments is missed. Batching equal-location events extends the same argument to degeneracies instead of relying on arbitrary tie order.`,
      ],
    },
    {
      heading: `Cost and Tradeoffs`,
      paragraphs: [
        `With n segments and k reported intersections, the standard Bentley-Ottmann shape is O((n + k) log n) time: O(log n) for event-queue and status-tree updates, once per endpoint and reported crossing. Space is O(n + k) in the worst case if scheduled events and output are counted.`,
        `The bound is output-sensitive, not magic. If almost every segment crosses almost every other segment, k is Theta(n^2) and the output is already quadratic. In production, the hardest costs are often exact predicates, event deduplication, tie handling, and representing overlapping collinear segments, which may be intervals rather than single points.`,
        `The status comparator is a common source of bugs because it depends on the current sweep position. A balanced tree assumes its ordering is stable between updates. Change the sweep x only at event boundaries, and update the tree through the local swaps, inserts, and deletes that make the new order explicit.`,
      ],
    },
    {
      heading: `Worked Example`,
      paragraphs: [
        `Imagine three active segments in vertical order s1, s2, s3 at the current sweep x. If s1 and s3 geometrically intersect somewhere to the right, they still cannot be the next crossing while s2 lies between them. Some crossing or endpoint involving s2 must happen first to remove or reorder that middle segment.`,
        `When the sweep reaches a left endpoint for a new segment s, the status tree finds the segments directly above and below s. Only those two pairs are tested. If s crosses the upper neighbor at x=8, that intersection is inserted into Q. When Q later pops x=8, the crossing is reported, s and the neighbor swap order, and only the two newly exposed outside pairs need new tests.`,
      ],
    },
    {
      heading: `Where It Wins`,
      paragraphs: [
        `Sweep-line intersection wins for sparse-to-moderate crossing workloads where exact reporting matters: GIS overlays, parcel and road topology checks, CAD validation, vector-graphics cleanup, VLSI layout verification, and computational-geometry pipelines.`,
        `It also teaches a reusable pattern. A heap manages future events, an ordered tree stores the current frontier, and a local invariant turns a global all-pairs problem into a sequence of small neighbor checks.`,
      ],
    },
    {
      heading: `Where It Fails`,
      paragraphs: [
        `The clean textbook version usually assumes general position: no vertical ambiguity, no equal event coordinates, no overlapping collinear segments, and no many-way crossing. Real geometry cannot assume that. You need a documented policy for closed versus half-open segment endpoints, batch processing, exact or filtered predicates, and duplicate outputs.`,
        `It is also the wrong tool when the goal is a quick approximate spatial filter or when updates are continuous. Spatial hashes, R-trees, or bounding-volume hierarchies may be better front ends if you only need broad-phase candidates rather than a complete exact intersection report.`,
        `Floating-point coordinates make equality and orientation decisions fragile. If input comes from CAD, GIS, or layout tools, decide whether coordinates are rational, integer grid values, snapped tolerances, or exact predicates over original values. A silent epsilon rule can create missing intersections and invented intersections in the same dataset.`,
      ],
    },
    {
      heading: `Implementation Guidance`,
      paragraphs: [
        `Keep the brute-force all-pairs checker in the test suite for small random cases. Generate segments with shared endpoints, vertical lines, near-collinear triples, duplicate segments, and many-way crossings. A sweep-line implementation without degeneracy tests is usually correct only for the examples it was drawn with.`,
        `Return structured output, not just a list of points. For each intersection, record the point or overlap interval, the participating segment ids, and whether the meeting is proper crossing, endpoint touch, or collinear overlap. Later graph-building stages need that classification to split edges correctly.`,
      ],
    },
    {
      heading: `Sources and Study Next`,
      paragraphs: [
        `Primary source: Bentley and Ottmann, "Algorithms for Reporting and Counting Geometric Intersections", IEEE Transactions on Computers 28, 643-647 (1979), reference listing at https://epubs.siam.org/doi/10.1137/0220029. Supporting overview: York University Bentley-Ottmann notes at https://www.eecs.yorku.ca/~aaw/legacy/TristanCarvelho/SegmentIntersectionAlgorithm.html.`,
        `Study Binary Heap for event queues, Red-Black Tree for ordered status maintenance, orientation predicates for robust geometry, Interval Tree for one-dimensional overlap, Convex Hull: Monotone Chain for another sweep-like geometry algorithm, and Delaunay Triangulation & Voronoi Dual for a larger planar-geometry next step.`,
      ],
    },
  ],
};
