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
  const points = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const hullVertices = ['a', 'b', 'd', 'f', 'g', 'h'];
  const interiorPoints = points.filter(p => !hullVertices.includes(p));
  yield {
    state: pointsGraph('Sort by x, then scan from left to right'),
    highlight: { active: ['a', 'b', 'c', 'd', 'e', 'f'], compare: ['g', 'h'] },
    explanation: `Andrew monotone chain sorts ${points.length} points lexicographically: x first, y as tie-breaker. The sort costs O(n log n), and each later stack pass is linear over the ${points.length} points.`,
    invariant: `After sorting ${points.length} points, the hull can be built by local turn tests on a stack.`,
  };

  const stackSteps = [
    { id: 'pushA', label: 'push A' },
    { id: 'pushB', label: 'push B' },
    { id: 'testC', label: 'test C' },
    { id: 'popC', label: 'pop inside' },
    { id: 'pushD', label: 'push D' },
  ];
  yield {
    state: labelMatrix(
      'Lower hull stack scan',
      stackSteps,
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
    explanation: `The lower hull scan takes ${stackSteps.length} steps here. For each new point, the stack tests the last two kept points plus the candidate. Clockwise or collinear turns cause a pop because the candidate exposes the middle point as inside the fence.`,
  };

  yield {
    state: pointsGraph('The lower chain keeps only the bottom fence'),
    highlight: { active: ['a', 'b', 'd', 'f', 'e-a-b', 'e-b-d', 'e-d-f'], removed: ['c', 'e'], compare: ['g', 'h'] },
    explanation: `Interior points ${interiorPoints.map(p => p.toUpperCase()).join(' and ')} disappear because later edges bypass them. The monotonic x order means a popped point will never become useful for the lower chain again.`,
  };

  yield {
    state: pointsGraph('Run the same scan backward for the upper chain'),
    highlight: { active: ['f', 'g', 'h', 'a', 'e-f-g', 'e-g-h', 'e-h-a'], removed: ['c', 'e'], found: ['b', 'd'] },
    explanation: `The upper chain is the same stack rule in reverse sorted order. Concatenate lower and upper chains, omitting duplicate endpoints, and the ${hullVertices.length}-vertex convex hull is complete.`,
  };

  const turnCases = [
    { id: 'cross', label: 'cross product' },
    { id: 'left', label: 'left turn' },
    { id: 'right', label: 'right turn' },
    { id: 'col', label: 'collinear' },
  ];
  yield {
    state: labelMatrix(
      'Turn predicate',
      turnCases,
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
    explanation: `The algorithm is mostly a data-structure loop around ${turnCases.length} orientation cases (${turnCases.map(c => c.label).join(', ')}). Robust production geometry spends real effort making that predicate reliable under floating-point or integer overflow.`,
  };
}

function* geometryUses() {
  const hullVertices = ['a', 'b', 'd', 'f', 'g', 'h'];
  const interiorPts = ['c', 'e'];
  const totalPoints = hullVertices.length + interiorPts.length;
  yield {
    state: pointsGraph('Convex hull is the smallest fence around a point set'),
    highlight: { found: ['a', 'b', 'd', 'f', 'g', 'h', 'e-a-b', 'e-b-d', 'e-d-f', 'e-f-g', 'e-g-h', 'e-h-a'], removed: ['c', 'e'] },
    explanation: `The hull keeps ${hullVertices.length} extreme vertices out of ${totalPoints} points and discards ${interiorPts.length} interior points. That boundary is useful as a cheap approximation before more expensive geometry work.`,
  };

  const domains = [
    { id: 'collision', label: 'collision' },
    { id: 'gis', label: 'GIS' },
    { id: 'vision', label: 'vision' },
    { id: 'mesh', label: 'meshing' },
  ];
  yield {
    state: labelMatrix(
      'Where hulls appear',
      domains,
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
    explanation: `Convex hulls appear in ${domains.length} domains (${domains.map(d => d.label).join(', ')}). They simplify a cloud of points into a boundary, then downstream algorithms decide whether the approximation is enough.`,
  };

  const algorithms = [
    { id: 'gift', label: 'gift wrap' },
    { id: 'graham', label: 'Graham scan' },
    { id: 'andrew', label: 'monotone chain' },
    { id: 'chan', label: 'Chan' },
  ];
  yield {
    state: labelMatrix(
      'Algorithm comparisons',
      algorithms,
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
    explanation: `${algorithms.length} hull algorithms compared (${algorithms.map(a => a.label).join(', ')}). Monotone chain is popular because the implementation is short, deterministic, and easy to pair with ordinary sorting. Output-sensitive algorithms beat it when h << ${totalPoints}.`,
  };

  yield {
    state: pointsGraph('Complete case: precompute a safe navigation boundary'),
    highlight: { found: ['a', 'b', 'd', 'f', 'g', 'h'], compare: ['c', 'e'] },
    explanation: `A game tool can take ${totalPoints} obstacle vertices, compute a ${hullVertices.length}-vertex hull as a coarse blocker, and use the hull edges for visibility, collision broad phase, or navigation preprocessing.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Each dot is a 2D point. Edges connect consecutive hull vertices to form the boundary polygon. In the stack-scan view, the algorithm processes points left to right. When a point is pushed, it becomes a candidate hull vertex. When a point is popped, the cross-product turn test has proved it bends inward -- a straighter edge bypasses it.',
        {type: 'callout', text: 'Monotone chain turns the global hull boundary into two local stack scans after sorting points by x.'},
        'Active points sit on the stack right now. Removed points were popped because a later candidate exposed them as interior. The matrix view shows the stack contents and the turn-test verdict at each step. In the geometry-uses view, the finished hull is the outer polygon; interior points are marked removed.',
      
        {type: 'image', src: './assets/gifs/convex-hull-monotone-chain.gif', alt: 'Animated walkthrough of the convex hull monotone chain visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Given a set of points in the plane, find the smallest convex polygon that contains all of them. Imagine hammering nails at each point and stretching a rubber band around the outside -- the shape the band snaps to is the convex hull.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/ConvexHull.svg/250px-ConvexHull.svg.png', alt: 'Scattered points with a blue convex hull polygon enclosing them', caption: 'The hull keeps only the outer fence; interior points cannot become vertices of the minimal convex enclosure. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:ConvexHull.svg.'},
        'Collision-detection engines need a tight outer boundary for fast overlap rejection. GIS systems need region envelopes around GPS traces and sensor clusters. Image-processing pipelines need contour approximations of object silhouettes. Mesh generators need the outer boundary before they can triangulate the interior. All of these start with the convex hull because it strips away interior clutter and keeps only the extreme shape.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The definition suggests a brute-force test: for every pair of points, draw the line through them and check whether all remaining points fall on the same side. If they do, that edge belongs to the hull. There are O(n^2) candidate edges, each side-check visits O(n) points, so the total cost is O(n^3).',
        'This is easy to prove correct and works fine for a handful of points. The logic mirrors the definition directly: an edge is on the hull if and only if no point crosses to its other side.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'O(n^3) collapses under real workloads. A lidar scan, a GPS trace, or a set of game-object positions can have tens of thousands of points. Cubic time means 10,000 points costs up to a trillion operations.',
        'The brute-force method treats the hull as a global property -- whether a point is on the boundary seems to depend on every other point. That global entanglement is what makes it slow. The fix is to decompose the global question into local decisions that each take constant time.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Sort the points by x-coordinate. Now the global boundary problem becomes a local stack problem. Walk the sorted points left to right, maintaining a stack. At each candidate, check whether the last three points (the top two on the stack plus the new candidate) make a clockwise turn. If they do, the middle point is provably interior and gets popped. One cross product decides.',
        'The invariant: after processing the first i sorted points, the stack holds the convex chain for exactly those i points. Every pop restores the invariant. Every push extends it. Because points arrive in monotonic x-order, a popped point can never become useful again -- anything farther right only makes its inward bend worse.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Extreme_points.svg/250px-Extreme_points.svg.png', alt: 'Convex set with red extreme arcs highlighted around a blue region', caption: 'Convex hull algorithms are really searching for extreme boundary points and proving the rest are inside. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Extreme_points.svg.'},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Andrew\'s monotone chain builds the hull in two linear passes over a sorted array.',
        'Sort all n points lexicographically: x first, y to break ties. This costs O(n log n) and dominates the total runtime.',
        'Lower hull -- walk the sorted points left to right. Maintain a stack. For each candidate point P, let A and B be the top two stack entries (B on top). Compute the cross product (B - A) x (P - A). If the result is zero or negative (clockwise or collinear), B bends inward relative to the direct edge A-P, so pop B. Repeat until the turn is counter-clockwise or the stack has fewer than two points, then push P.',
        'Upper hull -- walk the same sorted points right to left, applying the identical stack rule. This captures the top boundary.',
        'Concatenate the two chains, dropping the duplicate endpoints where they meet at the leftmost and rightmost points. The result is the convex hull in counter-clockwise vertex order.',
        'The cross product for three points A, B, C: (B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x). Positive means counter-clockwise (left turn). Negative means clockwise (right turn). Zero means collinear. Whether collinear points stay or go is a policy choice: keep them if the caller needs every boundary sample, drop them for a minimal polygon.',
        'Graham scan (1972) was the first O(n log n) hull algorithm. Pick the lowest point as anchor, sort the rest by polar angle around it, then process in angular order with the same stack-based turn test. Same time bound, but the angle sort uses atan2 or careful angular comparison, which is less numerically stable than sorting by x.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'On a convex polygon, every three consecutive vertices form a counter-clockwise turn. A clockwise turn means the polygon dents inward and is not convex. The stack enforces this: whenever a new point creates a clockwise turn with the top two stack entries, the middle point is interior and must go.',
        'The pop is safe because of monotonic x-order. A point that bends inward relative to the current candidate will bend inward relative to anything farther right -- the x-monotonicity means no future point can rescue it.',
        'The upper hull uses the same invariant in reverse. Together, the two chains cover the entire convex boundary because every hull edge is x-monotone on either the top or bottom side.',
        'Each point enters the stack at most once and leaves at most once per chain. Total stack operations across both passes: at most 2n. The scan phase is O(n). Combined with the O(n log n) sort, total time is O(n log n).',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Monotone chain and Graham scan both run in O(n log n), dominated by sorting. The stack scan is linear -- each point is pushed once and popped at most once per chain. Space is O(n) for the sorted array and the hull output.',
        'Doubling the input adds O(n) scan work and O(n log n) sort work. For 10,000 points the sort does roughly 130,000 comparisons; for 1,000,000 points, roughly 20 million. The scan is invisible next to the sort.',
        'If the input arrives pre-sorted by x, monotone chain runs in O(n) because the sort is free. Streaming spatial data gets this for free.',
        'Output-sensitive algorithms do better when the hull is small. Jarvis march (gift wrapping) runs in O(nh) where h is the hull size -- fast when h is tiny, quadratic when most points sit on the hull. Chan\'s algorithm achieves the optimal O(n log h): partition into groups, compute mini-hulls, merge with binary-search-assisted gift wrapping, and double the guess for h until it works.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Collision detection: game engines and physics simulators wrap objects in convex hulls for broad-phase rejection. Convex-convex overlap tests (GJK, separating-axis theorem) are fast, so the hull turns expensive exact polygon intersection into a cheap pre-check.',
        'GIS: compute the hull of GPS traces, sensor readings, or parcel points to define coverage envelopes and territorial boundaries without storing every interior point.',
        'Image processing: approximate an object silhouette with its hull. The convex deficiency -- area between the hull and the actual shape -- quantifies concavity, useful for classifying hand gestures, leaf shapes, and industrial parts.',
        'Robot motion planning: the configuration-space obstacles are often computed via Minkowski sums, which require convex decomposition. The hull of each obstacle piece is the starting point.',
        'Portfolio optimization: in mean-variance space, the set of achievable (risk, return) pairs forms a region whose upper-left boundary -- the efficient frontier -- is part of a convex hull over asset combinations.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        '3D and higher dimensions need different algorithms. In d dimensions, the hull can have O(n^floor(d/2)) faces. For d = 10, even a modest point set can produce billions of faces. QuickHull generalizes to 3D well; beyond that, specialized libraries like Qhull are necessary.',
        'Dynamic point sets break the static assumption. Inserting and deleting points over time makes recomputing from scratch wasteful. Dynamic convex hull structures exist (O(log^2 n) per update) but are far more complex than a one-shot scan.',
        'Floating-point degeneracies cause real bugs. Collinear points and near-collinear triples can flip the cross-product sign, producing self-intersecting hulls or missing vertices. Production code uses exact arithmetic (Shewchuk predicates, wide-integer coordinates, or interval arithmetic).',
        'Concave shapes lose information. The hull of a C-shaped obstacle fills in the interior of the C. Navigation meshes, delivery-zone boundaries that follow rivers, and contact surfaces all need concave decomposition or alpha shapes instead.',
        'Very large n with tiny h wastes time. If n = 10,000,000 and h = 8, monotone chain still pays O(n log n) for the sort. Jarvis march finishes in O(8n). Chan\'s algorithm gets O(n log 8), the best of both.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Eight points from the animation: A(0.8, 5.8), B(2.0, 3.0), C(3.0, 4.8), D(4.4, 1.7), E(5.8, 4.1), F(7.2, 2.5), G(6.4, 6.8), H(3.5, 7.2).',
        'Sort by x (ties by y): A(0.8, 5.8), B(2.0, 3.0), C(3.0, 4.8), H(3.5, 7.2), D(4.4, 1.7), E(5.8, 4.1), G(6.4, 6.8), F(7.2, 2.5).',
        'Lower hull (left to right, pop when cross product <= 0). Push A, push B. Push C: cross(A,B,C) = (2.0-0.8)*(4.8-5.8) - (3.0-5.8)*(3.0-0.8) = -1.2 + 6.16 = 4.96 > 0, left turn, keep. Stack: [A, B, C].',
        'Push H: cross(B,C,H) = (3.0-2.0)*(7.2-3.0) - (4.8-3.0)*(3.5-3.0) = 4.2 - 0.9 = 3.3 > 0, left turn, keep. Stack: [A, B, C, H].',
        'Push D: cross(C,H,D) = (3.5-3.0)*(1.7-4.8) - (7.2-4.8)*(4.4-3.0) = -1.55 - 3.36 = -4.91 <= 0, clockwise -- pop H. cross(B,C,D) = (3.0-2.0)*(1.7-3.0) - (4.8-3.0)*(4.4-2.0) = -1.3 - 4.32 = -5.62 <= 0, clockwise -- pop C. cross(A,B,D) = -4.92 + 10.08 = 5.16 > 0, left turn, keep B. Push D. Stack: [A, B, D].',
        'Push E: cross(B,D,E) = 2.64 + 4.94 = 7.58 > 0, keep. Push G: cross(D,E,G) = 7.14 - 4.8 = 2.34 > 0, keep. Stack: [A, B, D, E, G].',
        'Push F: cross(E,G,F) = -0.96 - 3.78 = -4.74 <= 0, pop G. cross(D,E,F) = 1.12 - 6.72 = -5.6 <= 0, pop E. cross(B,D,F) = -1.2 + 6.76 = 5.56 > 0, keep D. Push F. Lower hull: [A, B, D, F].',
        'Upper hull (right to left): process F, G, E, D, H, C, B, A with the same stack rule. The upper chain passes through F, G, H, A.',
        'Concatenate lower [A, B, D, F] and upper [F, G, H, A], drop duplicate endpoints. Final hull: A, B, D, F, G, H -- six vertices, counter-clockwise. Points C and E are interior.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Graham, R. L. (1972). "An Efficient Algorithm for Determining the Convex Hull of a Finite Planar Set." Information Processing Letters 1(4), 132-133. The first O(n log n) planar hull, using polar-angle sort and a stack.',
        'Andrew, A. M. (1979). "Another Efficient Algorithm for Convex Hulls in Two Dimensions." Information Processing Letters 9(5), 216-219. The monotone-chain variant with lexicographic sort.',
        'Chan, T. M. (1996). "Optimal Output-Sensitive Convex Hull Algorithms in Two and Three Dimensions." Discrete and Computational Geometry 16, 361-368. The O(n log h) optimal output-sensitive algorithm.',
        'Prerequisites: cross product (the turn predicate behind every hull algorithm), sorting algorithms (the O(n log n) bottleneck). Extensions: Delaunay triangulation (often starts from the hull), Voronoi diagrams (dual of Delaunay), closest pair of points (shares the sorted-plane-sweep pattern). Alternatives: gift wrapping when h is known to be tiny, Chan\'s algorithm for output-sensitivity, alpha shapes for concave boundaries. Contrasts: bounding boxes (cheaper but much looser), concave hull (preserves the concavities the convex hull erases).',
      ],
    },
  ],
};
