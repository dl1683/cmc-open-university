// Convex hull by Andrew's monotone chain: sort points, scan with a turn test.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'convex-hull-monotone-chain',
  title: 'Convex Hull: Monotone Chain',
  category: 'Algorithms',
  summary: 'Sort points lexicographically, build lower and upper hull stacks, and pop every non-left turn until only the outer fence remains.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['stack scan', 'geometry uses'], defaultValue: 'stack scan' },
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

function pointsGraph(title) {
  return graphState({
    nodes: [
      { id: 'a', label: 'A', x: 0.8, y: 5.8, note: 'left' },
      { id: 'b', label: 'B', x: 2.0, y: 3.0, note: 'low' },
      { id: 'c', label: 'C', x: 3.0, y: 4.8, note: 'inside' },
      { id: 'd', label: 'D', x: 4.4, y: 1.7, note: 'bottom' },
      { id: 'e', label: 'E', x: 5.8, y: 4.1, note: 'inside' },
      { id: 'f', label: 'F', x: 7.2, y: 2.5, note: 'right' },
      { id: 'g', label: 'G', x: 6.4, y: 6.8, note: 'top' },
      { id: 'h', label: 'H', x: 3.5, y: 7.2, note: 'top' },
    ],
    edges: [
      { id: 'e-a-b', from: 'a', to: 'b', weight: '' },
      { id: 'e-b-d', from: 'b', to: 'd', weight: '' },
      { id: 'e-d-f', from: 'd', to: 'f', weight: '' },
      { id: 'e-f-g', from: 'f', to: 'g', weight: '' },
      { id: 'e-g-h', from: 'g', to: 'h', weight: '' },
      { id: 'e-h-a', from: 'h', to: 'a', weight: '' },
      { id: 'e-b-c', from: 'b', to: 'c', weight: '' },
      { id: 'e-c-e', from: 'c', to: 'e', weight: '' },
      { id: 'e-e-f', from: 'e', to: 'f', weight: '' },
    ],
  }, { title });
}

function* stackScan() {
  yield {
    state: pointsGraph('Sort by x, then scan from left to right'),
    highlight: { active: ['a', 'b', 'c', 'd', 'e', 'f'], compare: ['g', 'h'] },
    explanation: 'Andrew monotone chain starts by sorting points lexicographically: x first, y as tie-breaker. The sort creates a left-to-right order where local turn tests are enough; the sort costs O(n log n), and each later stack pass is linear.',
    invariant: 'After sorting, the hull can be built by local turn tests on a stack.',
  };

  yield {
    state: labelMatrix(
      'Lower hull stack scan',
      [
        { id: 'pushA', label: 'push A' },
        { id: 'pushB', label: 'push B' },
        { id: 'testC', label: 'test C' },
        { id: 'popC', label: 'pop inside' },
        { id: 'pushD', label: 'push D' },
      ],
      [
        { id: 'stack', label: 'stack' },
        { id: 'turn', label: 'turn test' },
      ],
      [
        ['A', 'start'],
        ['A B', 'need 2 points'],
        ['A B C', 'not left enough'],
        ['A B', 'remove middle'],
        ['A B D', 'left turn kept'],
      ],
    ),
    highlight: { active: ['testC:turn', 'popC:stack'], found: ['pushD:turn'] },
    explanation: 'For each new point, the stack tests the last two kept points plus the candidate. If they make a clockwise or collinear turn under the chosen policy, the middle point is popped because the candidate has exposed it as inside the lower fence.',
  };

  yield {
    state: pointsGraph('The lower chain keeps only the bottom fence'),
    highlight: { active: ['a', 'b', 'd', 'f', 'e-a-b', 'e-b-d', 'e-d-f'], removed: ['c', 'e'], compare: ['g', 'h'] },
    explanation: 'Interior points disappear because a later edge bypasses them. The monotonic x order means a popped point will never become useful for the lower chain again.',
  };

  yield {
    state: pointsGraph('Run the same scan backward for the upper chain'),
    highlight: { active: ['f', 'g', 'h', 'a', 'e-f-g', 'e-g-h', 'e-h-a'], removed: ['c', 'e'], found: ['b', 'd'] },
    explanation: 'The upper chain is the same stack rule in reverse sorted order. Concatenate lower and upper chains, omitting duplicate endpoints, and the convex hull is complete.',
  };

  yield {
    state: labelMatrix(
      'Turn predicate',
      [
        { id: 'cross', label: 'cross product' },
        { id: 'left', label: 'left turn' },
        { id: 'right', label: 'right turn' },
        { id: 'col', label: 'collinear' },
      ],
      [
        { id: 'test', label: 'test' },
        { id: 'action', label: 'action' },
      ],
      [
        ['(b-a) x (c-a)', 'orientation'],
        ['positive', 'keep for CCW hull'],
        ['negative', 'pop middle'],
        ['zero', 'policy decides'],
      ],
    ),
    highlight: { active: ['cross:test', 'right:action'], found: ['left:action'], compare: ['col:action'] },
    explanation: 'The algorithm is mostly a data-structure loop around one geometric primitive: orientation. Robust production geometry spends real effort making that predicate reliable under floating-point or integer overflow.',
  };
}

function* geometryUses() {
  yield {
    state: pointsGraph('Convex hull is the smallest fence around a point set'),
    highlight: { found: ['a', 'b', 'd', 'f', 'g', 'h', 'e-a-b', 'e-b-d', 'e-d-f', 'e-f-g', 'e-g-h', 'e-h-a'], removed: ['c', 'e'] },
    explanation: 'The hull throws away interior detail and keeps the extreme boundary. That boundary is useful as a cheap approximation before more expensive geometry work, but it can overstate concave shapes.',
  };

  yield {
    state: labelMatrix(
      'Where hulls appear',
      [
        { id: 'collision', label: 'collision' },
        { id: 'gis', label: 'GIS' },
        { id: 'vision', label: 'vision' },
        { id: 'mesh', label: 'meshing' },
      ],
      [
        { id: 'use', label: 'use' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['broad outline', 'quick reject'],
        ['region envelope', 'summarize points'],
        ['object silhouette', 'ignore interior'],
        ['outer boundary', 'feed triangulation'],
      ],
    ),
    highlight: { active: ['collision:use', 'gis:use'], found: ['mesh:lesson'] },
    explanation: 'Convex hulls often serve as a first-pass summary. They simplify a cloud of points into a boundary, then downstream algorithms decide whether the approximation is enough.',
  };

  yield {
    state: labelMatrix(
      'Algorithm comparisons',
      [
        { id: 'gift', label: 'gift wrap' },
        { id: 'graham', label: 'Graham scan' },
        { id: 'andrew', label: 'monotone chain' },
        { id: 'chan', label: 'Chan' },
      ],
      [
        { id: 'time', label: 'time' },
        { id: 'fit', label: 'fit' },
      ],
      [
        ['O(nh)', 'small hull output'],
        ['O(n log n)', 'angle sort'],
        ['O(n log n)', 'lexicographic sort'],
        ['O(n log h)', 'output-sensitive'],
      ],
    ),
    highlight: { active: ['andrew:time', 'andrew:fit'], compare: ['gift:time'], found: ['chan:time'] },
    explanation: 'Monotone chain is popular because the implementation is short, deterministic, and easy to pair with ordinary sorting. Output-sensitive algorithms can beat it when the hull has few vertices.',
  };

  yield {
    state: pointsGraph('Complete case: precompute a safe navigation boundary'),
    highlight: { found: ['a', 'b', 'd', 'f', 'g', 'h'], compare: ['c', 'e'] },
    explanation: 'A game tool can take obstacle vertices, compute hulls as coarse blockers, and use the hull edges for visibility, collision broad phase, or navigation preprocessing before exact polygon checks.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'stack scan') yield* stackScan();
  else if (view === 'geometry uses') yield* geometryUses();
  else throw new InputError('Pick a convex-hull view.');
}

export const article = {
  sections: [
    {
      heading: 'Why This Exists',
      paragraphs: [
        'The convex hull of a set of planar points is the smallest convex polygon that contains all of them. If the points were nails on a board, the hull is the shape a taut rubber band would make around the outside. Why this exists as an algorithmic problem is simple: many systems need the outside boundary before they need the full geometry.',
        'That boundary is useful because many geometric tasks do not need every interior point first. They need the envelope: the coarse collision shape, map region boundary, object silhouette, point-cloud extent, or a first-pass rejection test before exact geometry runs.',
        'Andrew monotone chain is one of the cleanest ways to compute that boundary. Sort the points, build the lower hull with a stack, build the upper hull with the same rule in reverse, and concatenate.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The definition suggests a brute-force algorithm: try every pair of points as a candidate edge and check whether all other points lie on one side. That works as a definition check, but it is too slow for normal use.',
        'The wall is global geometry. Whether a point is on the hull seems to depend on every other point. Monotone chain breaks that global question by sorting points into x order and maintaining a local stack invariant.',
        'After sorting, each new point only needs to test the last two points on the current chain. If those three points make an inward turn, the middle one cannot be part of that chain and can be removed permanently.',
      ],
    },
    {
      heading: 'Animation notes',
      paragraphs: [
        'In the stack-scan view, the stack is the state that matters. The algorithm is asking one repeated question: do the last two kept points and the candidate preserve the outer turn for this chain?',
        'A popped point is not being ignored accidentally. The candidate has proved that the popped point bends inward relative to a more direct outer edge. Because the points are processed in sorted order, that popped point will not be needed later for the same chain.',
        'In the geometry-uses view, the hull is a summary, not a copy of the original shape. It throws away interior detail to keep the boundary. That is valuable for broad-phase checks and visualization, but it is not the same as preserving the exact original shape or a concave obstacle.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Sort points lexicographically by x, then y. Walk left to right to build the lower chain. For each candidate point, look at the last two points in the stack. If those two plus the candidate do not make the chosen outward turn, pop the middle point. Repeat until the turn is valid, then push the candidate.',
        'Build the upper chain by scanning the sorted points in reverse with the same rule. Concatenate lower and upper chains, dropping duplicate endpoints, and the hull is complete.',
        'The orientation test is the sign of the cross product `(b - a) x (c - a)`. A positive sign, negative sign, or zero means left turn, right turn, or collinear depending on coordinate convention. The zero case is a policy choice: keep collinear boundary points if the caller needs every boundary sample, or drop them if the caller wants only polygon corners.',
      ],
    },
    {
      heading: 'The core invariant',
      paragraphs: [
        'After processing the first i sorted points, the lower stack is the lower convex chain for those points. Every pop restores that invariant by removing a point that would make the chain bend inward.',
        'This is the core insight: sorted order turns a global boundary problem into a monotonic stack problem. The stack never has to reconsider points to the left of a valid outer edge unless a new point proves the last edge bends inward.',
        'The reason a popped point stays gone is monotonic order. Future candidates are farther to the right, so the popped point cannot become an extreme lower-boundary point again after a later point has bypassed it.',
        'The upper hull uses the same invariant in the opposite direction. Together the two chains cover the convex boundary because every hull edge belongs to either the upper or lower x-monotone side.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose points A and B are on the lower chain, and candidate C lies above the edge from A to a later point D. When C is pushed, the next candidate D can reveal that B-C-D turns inward for the lower hull. The algorithm pops C because the edge B-D sits outside it.',
        'This local pop has a global meaning: C is interior to the lower envelope. It may still be a real point in the input, but it is not a vertex of the convex hull.',
      ],
    },
    {
      heading: 'Cost and numeric behavior',
      paragraphs: [
        'Sorting dominates at O(n log n). The scans are O(n) because each point is pushed and popped at most once per chain. Space is O(n) for the sorted input and hull stack. If input is already sorted, the hull construction itself is linear.',
        'Robustness is the production issue. Floating-point roundoff can flip an orientation test near collinearity. Integer coordinates can overflow if the cross product is computed in too small a type. Geometry code should choose numeric representations deliberately and test degenerate cases: duplicates, all-collinear points, tiny hulls, and repeated coordinates.',
        'The collinearity policy changes output size and downstream behavior. Keeping all boundary-collinear points preserves samples along straight edges, which can be useful for mapping or display. Dropping middle collinear points produces a minimal vertex polygon, which is usually better for collision and storage.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Monotone chain wins when the point set is static or can be sorted cheaply, the implementation should be short, and the hull is useful as a boundary summary. It is deterministic, easy to test, and usually the first convex-hull algorithm worth learning for production use.',
        'Mapping, computer vision, games, GIS, robotics, and meshing all use hulls as coarse summaries before more expensive exact geometry.',
        'It also wins as a teaching algorithm because every part has a visible reason. Sorting gives order. The stack stores the current boundary. The cross product decides orientation. The pop operation removes a point with a proof, not a heuristic.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the hull must be maintained online under many insertions and deletions. It also fails when the shape being modeled is strongly concave and the convex wrapper throws away too much information.',
        'The hull is a conservative envelope, not the original geometry. For collision detection it may be a good broad-phase shape; for exact contact or navigation, the system may need the original polygon, a triangulation, or a concave decomposition.',
        'It is also not output-sensitive. If the hull has only a handful of points among millions of inputs, Chan-style algorithms can use the small output size h to beat the O(n log n) bound in practice or theory.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Deduplicate points before the scan unless duplicates are meaningful in your application. Decide whether coordinates are integers, fixed-point values, or floats, then implement the cross product in a type wide enough for the input range.',
        'Write tests for fewer than three unique points, all-collinear inputs, duplicate points, sorted and reverse-sorted inputs, and points that nearly line up. Most hull bugs appear at boundaries where the orientation predicate returns zero or almost zero.',
        'Document the output order. Many consumers expect counterclockwise hull vertices with no repeated first point at the end. Others expect a closed ring. The algorithm can produce either, but a silent convention mismatch can break area computation, polygon rendering, and collision code downstream.',
      ],
    },
    {
      heading: 'Case study',
      paragraphs: [
        'A map product receives thousands of GPS points for a delivery zone and needs a quick overview shape. The convex hull is a useful first envelope: it shows the outer extent, supports quick bounding checks, and gives a compact summary for dashboards.',
        'The same hull would be dangerous as the final delivery boundary if the zone wraps around a river or mountain. The hull may include large areas that were never reachable. That is the practical lesson: convex hulls are excellent envelopes, but exact geography often needs concave boundaries or road-network logic.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Sources: A. M. Andrew, "Another Efficient Algorithm for Convex Hulls in Two Dimensions", DOI https://doi.org/10.1016/0020-0190(79)90072-3; Isabelle AFP formalization of Andrew monotone chain, https://isa-afp.org/entries/Andrew_Monotone_Chain.html; and Wikibooks monotone-chain implementation notes, https://en.wikibooks.org/wiki/Algorithm_Implementation/Geometry/Convex_hull/Monotone_chain.',
        'Study Monotonic Stack, Merge Sort, Sweep Line Segment Intersection, Range Tree Orthogonal Range Search, Delaunay Triangulation & Voronoi Dual, and Quadtree Spatial Index & Map Tiles next.',
      ],
    },
  ],
};
