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
    { heading: 'What it is', paragraphs: [
      'Sweep-line segment intersection reports crossings among line segments by moving a conceptual vertical line left to right. Instead of testing every pair, it keeps only the active segments that currently cross the sweep line and checks neighboring active segments for future crossings.',
      'The classic Bentley-Ottmann algorithm uses two main data structures: an event priority queue ordered by x coordinate, and a balanced search tree for active segment order along the sweep line.',
    ] },
    { heading: 'How it works', paragraphs: [
      'Initialize the event queue with segment endpoints. When the sweep reaches a left endpoint, insert that segment into the status tree and check its immediate neighbors for intersections. When it reaches a right endpoint, remove the segment and check the newly adjacent neighbors. When it reaches a crossing, report it, swap the crossed segments in the status order, and schedule newly possible neighbor crossings.',
      'The invariant is that active segment order changes only at endpoints and crossings. Between events, the order is stable. That is why the algorithm can search locally in the status tree rather than globally across all segment pairs.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'With n segments and k reported intersections, the typical bound is O((n + k) log n) time and O(n + k) space, depending on event management and duplicate handling. If k is quadratic, the output is already quadratic.',
      'Robustness dominates real implementations. Equal x coordinates, vertical segments, overlapping collinear segments, shared endpoints, and floating-point precision all need policy. A beautiful sweep can fail if event ordering is underspecified.',
    ] },
    { heading: 'Complete case study', paragraphs: [
      'A GIS map overlay combines road segments and parcel boundaries. A brute-force pair test is wasteful when most segments are far apart. A sweep-line pass schedules endpoints, keeps only active nearby segments in order, and reports crossings for snapping, splitting, or topology validation. Degenerate cases such as shared parcel corners and nearly collinear road edges are handled explicitly.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Sources: Bentley and Ottmann, "Algorithms for Reporting and Counting Geometric Intersections", IEEE Transactions on Computers 28, 643-647 (1979), reference listing at https://epubs.siam.org/doi/10.1137/0220029; York University Bentley-Ottmann overview, https://www.eecs.yorku.ca/~aaw/legacy/TristanCarvelho/SegmentIntersectionAlgorithm.html; and de Berg et al. computational geometry notes as summarized in https://en.wikipedia.org/wiki/Bentley%E2%80%93Ottmann_algorithm. Study Binary Heap, Red-Black Tree, Interval Tree, Convex Hull: Monotone Chain, and Delaunay Triangulation & Voronoi Dual next.',
    ] },
  ],
};
