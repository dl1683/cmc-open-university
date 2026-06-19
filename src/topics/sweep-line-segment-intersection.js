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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation traces the Bentley-Ottmann sweep. Q is the event queue, ordered by x-coordinate. T is the status tree, storing segments in their current vertical order at the sweep line. Active highlights mark the event being processed. Found highlights mark confirmed intersection points. Compare highlights show neighbor pairs being tested for future crossings.',
        'In the event sweep view, watch how inserting a segment triggers neighbor checks above and below, while removing a segment triggers a check between its former neighbors. In the robust cases view, notice the batch processing: when multiple segments share a single event point, the algorithm handles them as one atomic update to avoid corrupting the status order.',
        {
          type: 'note',
          text: 'The status tree orders segments by where they cross the sweep line, not by any fixed property. That ordering changes at every event. When two segments swap in the tree, it means their vertical positions have crossed at the current sweep x.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Any program that works with line segments in a plane eventually needs to know which ones cross. Map overlays merge road networks with parcel boundaries. CAD validators check that manufactured edges do not collide. VLSI layout tools verify that circuit traces maintain clearance. Vector graphics editors resolve overlapping paths before filling regions. In every case, the input is a set of segments and the output is every pair that intersects, with exact coordinates.',
        'The key word is every. A single intersection test between two segments is cheap. The expense comes from the number of pairs. With n segments, there are n(n-1)/2 possible pairs, but most real drawings have far fewer actual crossings than possible pairs. A good algorithm should scale with the output, not with the square of the input.',
        'Bentley and Ottmann published their sweep-line algorithm in 1979. It remains the standard approach for exact segment intersection reporting in computational geometry because it converts an all-pairs global search into a sequence of local neighbor checks.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Test every pair. For each pair of segments, compute an orientation predicate to determine if they straddle each other, then compute the intersection point if they do. This brute-force approach is correct, simple to implement, and easy to verify. For small inputs it is the right choice, and it belongs in every test suite as a reference oracle.',
        'The implementation is about ten lines of code. For each segment i from 0 to n-1, for each segment j from i+1 to n-1, test whether segments i and j intersect. If they do, record the point. No data structures beyond the input array and an output list.',
        {
          type: 'code',
          language: 'javascript',
          text: 'function bruteForce(segments) {\n  const crossings = [];\n  for (let i = 0; i < segments.length; i++) {\n    for (let j = i + 1; j < segments.length; j++) {\n      const p = intersect(segments[i], segments[j]);\n      if (p) crossings.push({ i, j, point: p });\n    }\n  }\n  return crossings;\n}',
        },
        'This works. The problem is not correctness. The problem is that with 10,000 segments and only 50 actual crossings, brute force still performs 49,995,000 pair tests. Almost all of that work discovers nothing.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is pair explosion. The number of tests is always O(n^2), regardless of how many crossings exist. Two segments on opposite sides of the plane, nowhere near each other, still get tested. Spatial locality is completely ignored.',
        'A secondary wall appears in practice: even if you could skip distant pairs with a spatial index, you would still need to know which pairs are geometrically close. Bounding-box filters help, but they do not exploit the structure of the problem. A segment can span the entire plane, making its bounding box useless as a filter.',
        'The missing idea is that segments have a natural ordering at any given x-coordinate, and that ordering changes only at specific, predictable events. Between those events, most of the geometry is frozen. A good algorithm should work only where the ordering changes.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A conceptual vertical line sweeps left to right across the plane. Two data structures track the state. The event queue Q is a priority queue ordered by x-coordinate, initially loaded with every segment endpoint. The status tree T is a balanced BST storing the segments currently crossing the sweep line, ordered by their y-coordinate at the current sweep x.',
        {
          type: 'diagram',
          label: 'Sweep line state at position x = t',
          text: '  Event Queue Q          Sweep Line x=t         Status Tree T\n  (min-heap by x)        (vertical line)        (balanced BST by y)\n  +--------------+             |               +----------------+\n  | x=2  left(a) |             |  -- seg c --  | c  (top)       |\n  | x=3  left(b) |             |  -- seg a --  | a  (middle)    |\n  | x=5  cross   |       ------+----------     | b  (bottom)    |\n  | x=7  right(c)|             |  -- seg b --  +----------------+\n  | x=9  right(a)|             |                                 \n  +--------------+             |   Only adjacent pairs in T are\n                               |   tested for future crossings.',
        },
        'Three event types drive the algorithm. A left-endpoint event inserts the segment into T and tests it against its new predecessor and successor. A right-endpoint event removes the segment from T and tests the newly adjacent pair that was separated by the removed segment. An intersection event reports the crossing, swaps the two segments in T, and tests each against its new outside neighbor.',
        {
          type: 'code',
          language: 'javascript',
          text: 'while (!Q.isEmpty()) {\n  const event = Q.extractMin();\n  sweepX = event.x;\n\n  if (event.type === "left") {\n    T.insert(event.segment);\n    const above = T.predecessor(event.segment);\n    const below = T.successor(event.segment);\n    if (above) testAndSchedule(event.segment, above);\n    if (below) testAndSchedule(event.segment, below);\n  } else if (event.type === "right") {\n    const above = T.predecessor(event.segment);\n    const below = T.successor(event.segment);\n    T.delete(event.segment);\n    if (above && below) testAndSchedule(above, below);\n  } else { // intersection\n    report(event.point, event.seg1, event.seg2);\n    T.swap(event.seg1, event.seg2);\n    const newAbove = T.predecessor(event.seg1);\n    const newBelow = T.successor(event.seg2);\n    if (newAbove) testAndSchedule(event.seg1, newAbove);\n    if (newBelow) testAndSchedule(event.seg2, newBelow);\n  }\n}',
        },
        'A deduplication set prevents the same intersection from being scheduled twice. When two segments become neighbors, get separated, and become neighbors again, the second neighbor check could rediscover the same crossing. The set catches this.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument rests on one invariant: between consecutive events, the vertical order of active segments does not change. Segments are continuous curves (here, straight lines), so two segments can change their relative vertical order only by crossing. That crossing is itself an event, so the order is stable between events.',
        'Suppose segments A and B are the next unreported pair to intersect. Just before their crossing, they must be adjacent in T. If some segment C were between them in vertical order, then either A-C or C-B would need to cross first to allow A and B to become neighbors. But that earlier crossing would be an event processed before the A-B crossing. So at the moment A and B are about to cross, they are already adjacent, and the algorithm has already scheduled their intersection event from a previous neighbor check.',
        'Every operation that creates a new neighbor pair -- insertion, deletion, and swap -- is followed by an immediate neighbor test. No new adjacency goes unchecked. Combined with the invariant, this guarantees that every intersection is discovered and reported exactly once.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Approach', 'Time', 'Space', 'Output-sensitive?'],
          rows: [
            ['Brute force (all pairs)', 'O(n^2)', 'O(n + k)', 'No'],
            ['Bentley-Ottmann sweep', 'O((n + k) log n)', 'O(n + k)', 'Yes'],
          ],
        },
        'Each event -- endpoint or intersection -- costs O(log n) for the priority queue extraction and O(log n) for the balanced BST update. There are 2n endpoint events and at most k intersection events, giving O((n + k) log n) total time. Space is O(n) for the status tree and event queue at any instant, plus O(k) for the output.',
        'The bound is output-sensitive: k is the number of actual crossings. When crossings are sparse -- k is O(n) or less -- the algorithm is nearly O(n log n), far better than quadratic. But when nearly every segment crosses nearly every other, k approaches n^2 and the output itself is quadratic. The sweep line does not cheat physics; it just avoids paying for crossings that do not exist.',
        'In practice, the constant factors matter. The status tree comparator evaluates where each segment crosses the current sweep x, which requires a floating-point division or an exact arithmetic predicate. Event deduplication adds hash-set overhead. For fewer than 50-100 segments, brute force often wins on wall-clock time despite the worse asymptotic bound.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'GIS map overlays are the classic application. Merging two polygon layers -- road centerlines against parcel boundaries -- requires finding every edge crossing to split edges and rebuild topology. The crossing count is usually much smaller than the pair count, making the sweep line dramatically faster than brute force.',
        'CAD and EDA (electronic design automation) tools use sweep-line intersection for design-rule checking in VLSI layouts. Circuit traces must maintain minimum spacing, and the tool must report every violation. Segments number in the millions; brute force is not an option.',
        'Vector graphics renderers use it to resolve overlapping paths before filling. Font rasterizers use it for glyph outline intersection. Computational geometry libraries (CGAL, Shapely, JTS) implement Bentley-Ottmann or its descendants as a core primitive that other algorithms build on.',
        'The sweep-line pattern itself is reusable beyond segment intersection. The same event-queue-plus-status-tree structure solves the closest pair problem, the line segment Voronoi diagram, polygon union/intersection (via the Weiler-Atherton or Greiner-Hormann variants), and rectangle intersection reporting.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Degeneracy handling is the primary engineering cost. The textbook algorithm assumes general position: no two endpoints share the same x-coordinate, no endpoint lies on another segment, no three segments meet at one point, and no segments are vertical or collinear. Real geometry violates all of these. A production implementation must define explicit policies for tie-breaking, batch processing of co-located events, vertical segments (which have no left-to-right span), shared endpoints, and overlapping collinear segments.',
        'Floating-point arithmetic makes the status comparator fragile. Two segments that are nearly parallel can have their relative order corrupted by rounding, causing the BST invariant to break. The result is missed crossings or phantom crossings. Exact arithmetic (rational or adaptive-precision) fixes this but at a 10-100x performance cost. Epsilon-tolerance approaches are faster but can create contradictory orderings.',
        'The algorithm is also the wrong tool when you need approximate spatial filtering rather than exact reporting. If the goal is "find segment pairs that are close," a spatial hash or R-tree is simpler and faster. If segments are being inserted and deleted dynamically, the static sweep assumption breaks and you need an incremental structure instead.',
        'Finally, the sweep line is inherently sequential. The event at x=5 depends on the status at x=4. Parallelizing it requires spatial decomposition into vertical strips with cross-strip stitching, which adds complexity and can lose the simplicity advantage over brute force with spatial indexing.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Primary source: Bentley and Ottmann, "Algorithms for Reporting and Counting Geometric Intersections," IEEE Transactions on Computers, C-28(9), 643-647, 1979.',
            'Textbook treatment: de Berg, Cheong, van Kreveld, Overmars, "Computational Geometry: Algorithms and Applications," Chapter 2 (Line Segment Intersection). Clear pseudocode and degeneracy discussion.',
            'Reference implementation notes: CGAL documentation on 2D Sweep Line for segment intersection, which handles all degeneracies including overlapping collinear segments.',
          ],
        },
        {
          type: 'table',
          headers: ['Role', 'Topic', 'Why'],
          rows: [
            ['Prerequisite', 'Binary Heap', 'The event queue is a min-heap ordered by x-coordinate'],
            ['Prerequisite', 'Red-Black Tree', 'The status structure needs a balanced BST with predecessor/successor queries'],
            ['Prerequisite', 'Orientation predicate', 'Every intersection test and status comparison depends on the cross-product sign test'],
            ['Extension', 'Convex Hull (Monotone Chain)', 'Another sweep-line algorithm; same event-queue pattern, different status structure'],
            ['Extension', 'Delaunay Triangulation', 'The next major sweep-line application in computational geometry'],
            ['Alternative', 'Interval Tree', 'Solves the one-dimensional overlap problem that the status tree generalizes to two dimensions'],
          ],
        },
      ],
    },
  ],
};
