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
  const eventTypes = ['left endpoint', 'intersection', 'right endpoint'];
  const dataStructures = ['event queue', 'status tree', 'reported set', 'orientation'];
  const activeSegments = ['s1', 's2', 's3'];

  yield {
    state: sweepGraph('Sweep through sorted events from left to right'),
    highlight: { active: ['events', 'sweep', 'e-events-sweep'], compare: ['status'] },
    explanation: `The Bentley-Ottmann idea is to simulate a moving vertical line using a priority queue of future events. With ${eventTypes.length} event types (${eventTypes.join(', ')}), endpoints are known at the start and intersections are discovered when neighboring active segments can cross.`,
    invariant: `Between events, the vertical order of active segments cannot change.`,
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
    explanation: `The event queue holds ${eventTypes.length} types of event, ordered by x coordinate. The active status is ordered by where each segment intersects the current sweep line.`,
  };

  yield {
    state: sweepGraph('Only adjacent active segments can create the next crossing'),
    highlight: { active: ['s1', 's2', 'status', 'e-s1-status', 'e-s2-status'], found: ['hit'], compare: ['s3'] },
    explanation: `A segment can cross many others over the full plane, but among the ${activeSegments.length} active segments the next crossing must be between neighbors in the current vertical order. That localizes the search from all pairs to adjacent status pairs.`,
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
    explanation: `This is a clean composition of ${dataStructures.length} structures: Binary Heap schedules time, Red-Black Tree stores sweep order, and orientation/intersection predicates do the geometry.`,
  };

  yield {
    state: sweepGraph('Complete case: endpoint, neighbor check, crossing, swap'),
    highlight: { active: ['events', 'sweep', 'status'], found: ['hit'], compare: ['s1', 's2'] },
    explanation: `The complete loop repeatedly pops the next event from the queue of ${eventTypes.length} event types, updates the active set, reports or schedules crossings, and relies on the invariant that only neighbor relationships change at event points.`,
  };
}

function* robustCases() {
  const degeneracies = ['same x event', 'vertical segment', 'shared endpoint', 'many cross'];

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
    explanation: `Textbook sweep descriptions often assume general position. Real geometry needs explicit policies for all ${degeneracies.length} degeneracies: ${degeneracies.join(', ')}, plus overlapping collinear segments.`,
  };

  yield {
    state: sweepGraph('Robust implementations batch events at the same point'),
    highlight: { active: ['events', 'sweep', 'status'], found: ['hit'], compare: ['s1', 's2', 's3'] },
    explanation: `If several segments meet at one point, process them as one event rather than as an arbitrary sequence that can corrupt the status order. Batching avoids ${degeneracies.length} classes of degeneracy.`,
  };

  const costRows = ['all pairs', 'sweep line', 'many crossings', 'robustness'];
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
    explanation: `The ${costRows.length}-row cost model shows the algorithm is output-sensitive: k is the number of crossings. If nearly every segment crosses every other segment, the output itself is quadratic.`,
  };

  const overlayLayers = ['road lines', 'parcel edges', 'events', 'output'];
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
    explanation: `GIS overlays combine ${overlayLayers.length} layers (${overlayLayers.join(', ')}) — where elegant sweep-line ideas meet messy input. The data structures are straightforward; correctness depends on precise degeneracy and numeric policies.`,
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
        {
          type: 'callout',
          text: 'The sweep-line invariant is local: only adjacent active segments can create the next crossing event.',
        },
        'Read Q as the event queue, ordered by the next x-coordinate to process. Read T as the status tree, ordered by where active segments cross the current sweep line.',
        'Active highlights show the event being processed, found highlights show real intersections, and compare highlights show adjacent segment pairs being tested. The safe inference is local: if two segments are not neighbors in T, they cannot be the next pair to cross.',
        {
          type: 'image',
          src: './assets/gifs/sweep-line-segment-intersection.gif',
          alt: 'Animated walkthrough of the sweep line segment intersection visualization',
          caption: 'Animation preview: the full visualization plays through each step at reading pace.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Line-Line_Intersection.png',
          alt: 'Two lines crossing at an intersection point with endpoint coordinates labeled.',
          caption: 'One segment-pair intersection is cheap; the sweep-line problem is avoiding every irrelevant pair before this geometry test runs. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Line-Line_Intersection.png.',
        },
        'Segment intersection reporting asks for every crossing among line segments in the plane. Map overlays, CAD checks, vector graphics, and circuit layouts need the full set of crossings, not only a yes-or-no answer.',
        'Testing one pair is cheap; testing every pair is the cost problem. With 10,000 segments, brute force examines 49,995,000 pairs even if only 50 crossings exist.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is the double loop. For each segment i and each later segment j, run an orientation test and record the intersection if the pair crosses.',
        'This approach is correct and belongs in tests because it is simple. Its weakness is that it treats far-apart segments and near-neighbor segments as equally worth checking.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that pair count grows quadratically while actual crossings may grow slowly. Sparse geometry still pays dense-geometry cost under brute force.',
        'Bounding boxes can reject some pairs, but long segments can have large boxes that overlap many unrelated boxes. The missing structure is the changing vertical order of segments as x increases.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Sweep a vertical line left to right and maintain the vertical order of only the segments that cross it. Between events, that order cannot change.',
        'A crossing can only happen between adjacent active segments just before the crossing. If another segment were between them, one of those pairs would need to cross first.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Min-heap.png',
          alt: 'Complete binary min heap with the smallest value at the root.',
          caption: 'The event queue can be implemented as a min-heap: each pop advances the sweep to the next endpoint or crossing. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Min-heap.png.',
        },
        'Load every segment endpoint into a priority queue. A left endpoint inserts its segment into T and checks the new predecessor and successor; a right endpoint removes the segment and checks the pair that becomes adjacent.',
        'An intersection event reports the point, swaps the two crossing segments in T, and checks their new outside neighbors. A deduplication set prevents scheduling the same crossing more than once.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is stable vertical order between consecutive events. Straight segments can change relative order only by crossing, and a crossing is itself an event.',
        'Every operation that creates a new adjacency immediately tests that adjacency. Since the next undiscovered crossing must become adjacent before it occurs, the algorithm schedules it before the sweep passes it.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'There are 2n endpoint events and k intersection events. Each priority-queue operation and status-tree update costs O(log n), giving O((n + k) log n) time and O(n + k) space including output.',
        'When k is small, the sweep is close to O(n log n). When nearly every segment crosses nearly every other, k is O(n^2), and the output itself is quadratic.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Geographic information systems use sweep-line ideas to overlay roads, parcels, and administrative boundaries. Vector graphics tools use them when resolving self-intersections before fill or clipping operations.',
        'Chip-layout and CAD tools use intersection checks to find invalid geometry. The fit is strong when the drawing is sparse enough that local neighbor checks avoid most pair tests.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Robustness is the hard part. Equal x-coordinates, overlapping collinear segments, shared endpoints, and floating-point roundoff can corrupt event ordering or status-tree comparisons.',
        'For tiny inputs, brute force often wins because it has low constant cost and fewer moving parts. The sweep is worth the complexity when pair explosion is real.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Let A run from (0,0) to (6,6), so y = x. Let B run from (0,5) to (6,1), so y = 5 - 2x/3. Solving x = 5 - 2x/3 gives 5x/3 = 5, so x = 3 and y = 3.',
        'Add C from (0,8) to (6,8). At x = 0, the status order is C, B, A. The sweep tests adjacent pairs C-B and B-A; B-A schedules the crossing at (3,3), while C never becomes adjacent to A before that crossing.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Bentley and Ottmann 1979 for the original sweep-line intersection algorithm and de Berg et al., Computational Geometry, for robust variants. Next study orientation predicates, balanced binary search trees, priority queues, and planar arrangements.',
      ],
    },
  ],
};
