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
        'The visualization has two views. The stack-scan view shows the algorithm building the hull step by step: each dot is a 2D point, and edges connect consecutive hull candidates. Points are processed left to right in sorted x-order. When a point is pushed onto the stack, it becomes a candidate hull vertex; when a point is popped, the cross-product turn test has proven it bends inward, so a straighter edge bypasses it.',
        {type: 'callout', text: 'Monotone chain turns the global hull boundary into two local stack scans after sorting points by x.'},
        'Active points (highlighted) are currently on the stack. Removed points were popped because a later candidate exposed them as interior -- they bent the boundary inward instead of outward. The matrix panel beside the geometry shows the stack contents and the turn-test verdict (left turn = keep, right turn = pop) at each step. Watch the lower hull build left-to-right, then the upper hull build right-to-left.',
        'The geometry-uses view shows what you do with the finished hull: the outer polygon is the hull, interior points are marked removed, and the animation cycles through applications in collision detection, GIS, computer vision, and mesh generation.',
        {type: 'image', src: './assets/gifs/convex-hull-monotone-chain.gif', alt: 'Animated walkthrough of the convex hull monotone chain visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A convex hull is the smallest convex polygon that contains a given set of points. "Convex" means the polygon has no inward dents -- every interior angle is less than 180 degrees. The classic mental picture: hammer a nail at each point and stretch a rubber band around all of them. The shape the band snaps to is the convex hull.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/ConvexHull.svg/250px-ConvexHull.svg.png', alt: 'Scattered points with a blue convex hull polygon enclosing them', caption: 'The hull keeps only the outer fence; interior points cannot become vertices of the minimal convex enclosure. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:ConvexHull.svg.'},
        'The hull matters because it is the tightest convex approximation of a point cloud. Game engines use it for fast collision pre-checks. GIS systems use it to define coverage regions around sensor readings. Image processors use it to approximate object silhouettes. Mesh generators need the outer boundary before they can triangulate the interior. In each case, the hull strips away interior clutter and keeps only the extreme boundary shape.',
        'The problem is ancient in computational geometry, and dozens of algorithms solve it. Andrew\'s monotone chain (1979) is the one taught here because it is the simplest to implement correctly, the most numerically stable of the O(n log n) methods, and the easiest to visualize step by step.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The definition of a convex hull suggests a brute-force algorithm: for every pair of points, draw the line through them, then check whether all remaining points fall on the same side of that line. If they do, that edge is on the hull. There are O(n^2) candidate edges and each side-check visits O(n) points, so the total cost is O(n^3).',
        'A "side test" uses the cross product. Given an edge from point A to point B, and a test point P, compute (B.x - A.x) * (P.y - A.y) - (B.y - A.y) * (P.x - A.x). If the sign is the same for every P not on the edge, all points lie on one side, and edge AB belongs to the hull.',
        'This is easy to prove correct and works for a handful of points. But correctness alone is not enough -- the cubic cost makes it useless at any real scale.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'O(n^3) collapses under real-world point counts. A lidar scan produces hundreds of thousands of points. A GPS trace through a city generates tens of thousands. A frame of object detections in a game can have thousands of hitboxes. Cubic time on 10,000 points means up to a trillion operations -- minutes of compute for a single hull.',
        'The deeper problem is structural. The brute-force method treats every edge decision as globally entangled: whether edge AB belongs to the hull depends on every other point in the set. That global dependency is what forces n^3. To break through, we need a way to decompose the global boundary into a sequence of local decisions, each resolvable in constant time.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Sort the points by x-coordinate. Once sorted, the leftmost point and the rightmost point are guaranteed hull vertices -- no other point can be farther left or right. Between them, the hull boundary splits into two monotone chains: a lower boundary (going left to right along the bottom) and an upper boundary (going left to right along the top). Each chain, traced from left to right, never reverses in the x-direction.',
        'This monotonicity is the key. Walk the sorted points left to right, maintaining a stack of candidates. At each new point, check whether the last three points on the stack (the top two plus the new candidate) make a clockwise turn. If they do, the middle point bends inward -- it is provably interior -- and gets popped. A single cross product decides. Because points arrive in monotonic x-order, a popped point can never become useful again: anything farther right will only make its inward bend worse.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Extreme_points.svg/250px-Extreme_points.svg.png', alt: 'Convex set with red extreme arcs highlighted around a blue region', caption: 'Convex hull algorithms are really searching for extreme boundary points and proving the rest are inside. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Extreme_points.svg.'},
        'The invariant is: after processing the first i sorted points, the stack holds the correct convex chain for exactly those i points. Every pop restores the invariant (by removing a point that violated convexity). Every push extends it (by adding a point that preserves convexity). Two passes -- one for the lower chain, one for the upper -- cover the entire boundary.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Andrew\'s monotone chain builds the hull in five steps: sort, lower scan, upper scan, concatenate, and deduplicate.',
        'Step 1: Sort. Arrange all n points in lexicographic order -- x-coordinate first, y-coordinate to break ties. This is the only O(n log n) step and it dominates the total runtime. Any comparison sort works.',
        'Step 2: Lower hull. Walk the sorted points left to right. Maintain a stack (initially empty). For each candidate point P: let A and B be the second-from-top and top of the stack. Compute the cross product (B.x - A.x) * (P.y - A.y) - (B.y - A.y) * (P.x - A.x). If the result is zero or negative, the triple A-B-P makes a clockwise or collinear turn, which means B bends inward relative to the direct line from A to P. Pop B. Repeat until the turn is counter-clockwise (cross product positive) or the stack has fewer than two points. Then push P.',
        'Step 3: Upper hull. Walk the same sorted points right to left, applying the identical stack and turn-test logic. This captures the top boundary of the hull.',
        'Step 4: Concatenate the lower chain and the upper chain. Step 5: Drop the duplicate endpoints where the two chains meet (the leftmost and rightmost points appear in both).',
        'The result is the complete convex hull as a list of vertices in counter-clockwise order.',
        'The cross product formula for three points A, B, C is (B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x). Positive means counter-clockwise (left turn) -- keep. Negative means clockwise (right turn) -- pop. Zero means collinear. Whether to keep or discard collinear points is a policy choice: keep them if you need every point on the boundary, discard them for a minimal-vertex polygon.',
        'Graham scan (1972) predates monotone chain and uses the same stack logic, but sorts by polar angle around the lowest point instead of by x-coordinate. The angular sort requires atan2 or careful angular comparison, which introduces more floating-point issues. Monotone chain\'s lexicographic sort avoids this, making it the preferred variant in practice.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'A convex polygon has a defining property: every three consecutive vertices, taken in order around the boundary, form a counter-clockwise turn. If any triple makes a clockwise turn, the polygon dents inward at that vertex and is not convex. The stack-based scan enforces exactly this: whenever a new candidate creates a clockwise turn with the top two stack entries, the middle entry violates convexity and must be removed.',
        'The pop is safe because of the x-monotonicity guarantee from sorting. A point that bends inward relative to the current candidate (which is at some x-position) will also bend inward relative to any future candidate (which has a larger x-position). The farther-right point only makes the straight-line shortcut more attractive, never less. So once popped, a point never needs to return.',
        'Why two passes cover the whole boundary: every edge of a convex hull is either part of the lower boundary (connecting vertices whose y-coordinates dip below the line between leftmost and rightmost) or the upper boundary (connecting vertices above that line). The left-to-right pass finds the lower chain; the right-to-left pass finds the upper chain. Together they cover every hull edge exactly once.',
        'The amortized cost argument: each of the n points is pushed onto the stack exactly once per pass. Each point is popped at most once per pass (you cannot pop a point that is not on the stack, and once popped it never returns). So total stack operations across both passes is at most 4n (2 pushes + 2 pops in the worst case). The scan is O(n). The sort is O(n log n). Total: O(n log n).',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Time: O(n log n), dominated by the sort. The two stack-scan passes are each O(n) amortized. If the input arrives pre-sorted by x-coordinate (which happens with streaming spatial data, time-series, or left-to-right rasterization), the sort is free and the entire algorithm runs in O(n).',
        'Space: O(n) for the sorted copy of the input and the output hull. The stack never exceeds n entries. In practice the hull has far fewer than n vertices, so the output is compact.',
        'Concrete numbers: for n = 10,000, a comparison sort does roughly 130,000 comparisons. For n = 1,000,000, roughly 20 million. The scan passes are invisible beside the sort -- a few million push/pop operations at most, each costing one cross-product evaluation (five multiplies and a subtraction).',
        'Comparison with other hull algorithms. Jarvis march (gift wrapping) runs in O(nh) where h is the number of hull vertices. When h is tiny (say 5 out of a million points), Jarvis is faster than monotone chain. When most points are on the hull, Jarvis degrades to O(n^2). Chan\'s algorithm (1996) achieves the theoretical optimum of O(n log h) by partitioning points into groups, computing mini-hulls, and merging with binary-search-accelerated gift wrapping. It matches monotone chain when h = n and beats it when h is small.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Collision detection in games and physics engines. Wrap each object in its convex hull for broad-phase overlap testing. Convex-convex intersection tests (GJK algorithm, separating-axis theorem) are fast and well-understood, so the hull converts expensive exact polygon collision into a cheap convex pre-check. If the hulls do not overlap, the objects cannot collide, and the engine skips the detailed test entirely.',
        'Geographic information systems. Compute the hull of GPS traces, sensor clusters, or survey parcel points to define coverage envelopes, territorial boundaries, and exclusion zones. The hull gives a single polygon that covers all observations without storing every interior point.',
        'Image processing and computer vision. Approximate an object\'s silhouette with its hull. The convex deficiency -- the area between the hull and the actual shape -- quantifies how concave the object is. This is used to classify hand gestures (an open palm has low deficiency; a pointing finger has high deficiency), distinguish leaf species, and inspect industrial parts for deformities.',
        'Robot motion planning. Configuration-space obstacles are often computed via Minkowski sums, which require each obstacle piece to be convex. Non-convex obstacles are first decomposed into convex parts; the hull of each part is the starting point for the decomposition.',
        'Computational finance. In mean-variance portfolio optimization, the set of achievable (risk, return) pairs forms a region whose upper-left boundary -- the efficient frontier -- lies on the convex hull of asset combination outcomes.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Higher dimensions change the complexity class entirely. In d dimensions, the convex hull can have O(n^floor(d/2)) faces. For d = 3, QuickHull generalizes well. For d = 10, even a modest point set can produce billions of faces. Specialized libraries (Qhull, CGAL) are required beyond 3D.',
        'Dynamic point sets break the static assumption. If points are inserted and deleted over time, recomputing the hull from scratch after each change is wasteful. Dynamic convex hull data structures exist (O(log^2 n) per update) but are far more complex to implement and debug than a one-shot monotone chain scan.',
        'Floating-point degeneracies cause real production bugs. Collinear or near-collinear triples can flip the sign of the cross product, producing self-intersecting hulls or missing boundary vertices. Robust implementations use exact-arithmetic predicates (Shewchuk\'s orient2d, wide-integer coordinates, or interval arithmetic with exact fallback).',
        'Concave shapes lose information. The hull of a C-shaped obstacle fills in the concavity. Navigation meshes that must route around the inside of a harbor, delivery-zone boundaries that follow a river, and contact surfaces that wrap around concave parts all need concave decomposition or alpha shapes -- the convex hull erases exactly the detail they need.',
        'Massive n with tiny h wastes time. If n = 10,000,000 and only h = 8 points sit on the hull, monotone chain still pays O(n log n) for the sort. Jarvis march finishes in O(8n) = O(n). Chan\'s algorithm achieves O(n log 8) -- the best of both worlds when h is known to be small.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'We trace the full algorithm on the eight points from the animation. Each cross-product computation is shown so you can verify every keep-or-pop decision.',
        'Input points: A(0.8, 5.8), B(2.0, 3.0), C(3.0, 4.8), D(4.4, 1.7), E(5.8, 4.1), F(7.2, 2.5), G(6.4, 6.8), H(3.5, 7.2).',
        'Step 1 -- Sort by x (ties by y): A(0.8, 5.8), B(2.0, 3.0), C(3.0, 4.8), H(3.5, 7.2), D(4.4, 1.7), E(5.8, 4.1), G(6.4, 6.8), F(7.2, 2.5). Note H sorts before D because 3.5 < 4.4.',
        'Step 2 -- Lower hull (left to right, pop when cross product <= 0). Push A, push B (stack has fewer than 2 entries, so no turn test needed yet). Stack: [A, B].',
        'Process C: cross(A, B, C) = (2.0 - 0.8) * (4.8 - 5.8) - (3.0 - 5.8) * (3.0 - 0.8) = (1.2)(-1.0) - (-2.8)(2.2) = -1.2 + 6.16 = 4.96. Positive = counter-clockwise = left turn. Keep B, push C. Stack: [A, B, C].',
        'Process H: cross(B, C, H) = (3.0 - 2.0) * (7.2 - 3.0) - (4.8 - 3.0) * (3.5 - 2.0) = (1.0)(4.2) - (1.8)(1.5) = 4.2 - 2.7 = 1.5. Positive = left turn. Keep C, push H. Stack: [A, B, C, H].',
        'Process D: cross(C, H, D) = (3.5 - 3.0) * (1.7 - 4.8) - (7.2 - 4.8) * (4.4 - 3.0) = (0.5)(-3.1) - (2.4)(1.4) = -1.55 - 3.36 = -4.91. Negative = clockwise. Pop H. Now check cross(B, C, D) = (3.0 - 2.0) * (1.7 - 3.0) - (4.8 - 3.0) * (4.4 - 2.0) = (1.0)(-1.3) - (1.8)(2.4) = -1.3 - 4.32 = -5.62. Negative = clockwise. Pop C. Now check cross(A, B, D) = (2.0 - 0.8) * (1.7 - 5.8) - (3.0 - 5.8) * (4.4 - 0.8) = (1.2)(-4.1) - (-2.8)(3.6) = -4.92 + 10.08 = 5.16. Positive = left turn. Keep B, push D. Stack: [A, B, D].',
        'Process E: cross(B, D, E) = (4.4 - 2.0) * (4.1 - 3.0) - (1.7 - 3.0) * (5.8 - 2.0) = (2.4)(1.1) - (-1.3)(3.8) = 2.64 + 4.94 = 7.58. Positive = left turn. Keep D, push E. Process G: cross(D, E, G) = (5.8 - 4.4) * (6.8 - 1.7) - (4.1 - 1.7) * (6.4 - 4.4) = (1.4)(5.1) - (2.4)(2.0) = 7.14 - 4.8 = 2.34. Positive = left turn. Keep E, push G. Stack: [A, B, D, E, G].',
        'Process F: cross(E, G, F) = (6.4 - 5.8) * (2.5 - 4.1) - (6.8 - 4.1) * (7.2 - 5.8) = (0.6)(-1.6) - (2.7)(1.4) = -0.96 - 3.78 = -4.74. Negative = clockwise. Pop G. Check cross(D, E, F) = (5.8 - 4.4) * (2.5 - 1.7) - (4.1 - 1.7) * (7.2 - 4.4) = (1.4)(0.8) - (2.4)(2.8) = 1.12 - 6.72 = -5.6. Negative = clockwise. Pop E. Check cross(B, D, F) = (4.4 - 2.0) * (2.5 - 3.0) - (1.7 - 3.0) * (7.2 - 2.0) = (2.4)(-0.5) - (-1.3)(5.2) = -1.2 + 6.76 = 5.56. Positive = left turn. Keep D, push F. Lower hull: [A, B, D, F].',
        'Step 3 -- Upper hull (right to left). Process the sorted array in reverse: F, G, E, D, H, C, B, A, applying the identical stack-and-turn-test logic. The upper chain passes through F, G, H, A (the reader can verify each cross product follows the same pattern).',
        'Step 4 -- Concatenate lower [A, B, D, F] and upper [F, G, H, A]. Drop duplicate endpoints (F appears at the end of lower and start of upper; A appears at the start of lower and end of upper). Final hull: A, B, D, F, G, H -- six vertices in counter-clockwise order. Points C and E are interior; they were popped during the lower-hull scan because they bent inward.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Graham, R. L. (1972). "An Efficient Algorithm for Determining the Convex Hull of a Finite Planar Set." Information Processing Letters 1(4), 132-133. The first O(n log n) planar hull algorithm, using polar-angle sort and a stack scan.',
        'Andrew, A. M. (1979). "Another Efficient Algorithm for Convex Hulls in Two Dimensions." Information Processing Letters 9(5), 216-219. The monotone-chain variant covered here, replacing angular sort with lexicographic sort for better numerical behavior.',
        'Chan, T. M. (1996). "Optimal Output-Sensitive Convex Hull Algorithms in Two and Three Dimensions." Discrete and Computational Geometry 16, 361-368. Achieves O(n log h), optimal when the hull has few vertices.',
        'de Berg, M., Cheong, O., van Kreveld, M., and Overmars, M. (2008). "Computational Geometry: Algorithms and Applications," 3rd ed. Springer. Chapter 1 gives a textbook treatment of convex hulls with proofs and exercises.',
        'Prerequisites: the cross product (the turn predicate behind every hull algorithm) and comparison sorting (the O(n log n) bottleneck). Study next: Delaunay triangulation (often seeded from the convex hull), Voronoi diagrams (the dual of Delaunay), and closest pair of points (shares the sorted-sweep pattern). Alternatives worth knowing: gift wrapping (Jarvis march) for tiny h, Chan\'s algorithm for output-sensitivity, and alpha shapes for concave boundaries. Contrast with axis-aligned bounding boxes (faster to compute but much looser) and concave hulls (preserve the concavities the convex hull erases).',
      ],
    },
  ],
};
