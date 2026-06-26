// Delaunay triangulation and Voronoi diagrams as dual spatial structures.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'delaunay-triangulation-voronoi-dual',
  title: 'Delaunay Triangulation & Voronoi Dual',
  category: 'Algorithms',
  summary: 'Connect points into well-shaped triangles, flip illegal edges by the empty-circumcircle test, and read Voronoi cells from the dual graph.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['edge flips', 'voronoi dual'], defaultValue: 'edge flips' },
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

function triangulationGraph(title) {
  return graphState({
    nodes: [
      { id: 'p1', label: 'p1', x: 1.2, y: 5.7, note: 'site' },
      { id: 'p2', label: 'p2', x: 2.6, y: 2.5, note: 'site' },
      { id: 'p3', label: 'p3', x: 4.7, y: 6.6, note: 'site' },
      { id: 'p4', label: 'p4', x: 5.2, y: 3.2, note: 'site' },
      { id: 'p5', label: 'p5', x: 7.6, y: 5.0, note: 'site' },
      { id: 'cc', label: 'cc', x: 4.9, y: 4.7, note: 'empty?' },
      { id: 'dual', label: 'dual', x: 8.8, y: 2.0, note: 'Voronoi' },
    ],
    edges: [
      { id: 'e-12', from: 'p1', to: 'p2', weight: '' },
      { id: 'e-13', from: 'p1', to: 'p3', weight: '' },
      { id: 'e-23', from: 'p2', to: 'p3', weight: '' },
      { id: 'e-24', from: 'p2', to: 'p4', weight: '' },
      { id: 'e-34', from: 'p3', to: 'p4', weight: '' },
      { id: 'e-35', from: 'p3', to: 'p5', weight: '' },
      { id: 'e-45', from: 'p4', to: 'p5', weight: '' },
      { id: 'e-cc-3', from: 'cc', to: 'p3', weight: '' },
      { id: 'e-cc-4', from: 'cc', to: 'p4', weight: '' },
      { id: 'e-cc-dual', from: 'cc', to: 'dual', weight: '' },
    ],
  }, { title });
}

function voronoiGraph(title) {
  return graphState({
    nodes: [
      { id: 'a', label: 'A', x: 1.2, y: 4.0, note: 'site' },
      { id: 'b', label: 'B', x: 3.4, y: 2.0, note: 'site' },
      { id: 'c', label: 'C', x: 3.7, y: 6.2, note: 'site' },
      { id: 'd', label: 'D', x: 6.0, y: 3.8, note: 'site' },
      { id: 'v1', label: 'v1', x: 3.1, y: 4.0, note: 'center' },
      { id: 'v2', label: 'v2', x: 5.0, y: 4.9, note: 'center' },
      { id: 'query', label: 'q', x: 7.8, y: 4.5, note: 'nearest?' },
    ],
    edges: [
      { id: 'e-a-b', from: 'a', to: 'b', weight: '' },
      { id: 'e-a-c', from: 'a', to: 'c', weight: '' },
      { id: 'e-b-c', from: 'b', to: 'c', weight: '' },
      { id: 'e-b-d', from: 'b', to: 'd', weight: '' },
      { id: 'e-c-d', from: 'c', to: 'd', weight: '' },
      { id: 'e-v1-v2', from: 'v1', to: 'v2', weight: '' },
      { id: 'e-query-d', from: 'query', to: 'd', weight: '' },
    ],
  }, { title });
}

function* edgeFlips() {
  const siteCount = 5;         // p1-p5 sites
  const triNodes = 7;          // total nodes including cc and dual
  const triEdges = 10;         // edges in triangulation graph
  const flipSteps = 4;         // rows in edge flip matrix
  const algorithmVariants = 4; // rows in algorithms matrix

  yield {
    state: triangulationGraph('Start with a triangulation of the point set'),
    highlight: { active: ['p1', 'p2', 'p3', 'p4', 'p5'], compare: ['cc'] },
    explanation: `A triangulation connects ${siteCount} points with non-crossing edges until the convex hull is filled with triangles. Delaunay chooses the triangulation whose local triangles pass the empty-circumcircle test across all ${triEdges} edges.`,
  };

  yield {
    state: triangulationGraph('Illegal edge: a point lies inside a neighbor circumcircle'),
    highlight: { active: ['p2', 'p3', 'p4', 'cc', 'e-23', 'e-24', 'e-34'], compare: ['p5'] },
    explanation: `For two adjacent triangles sharing a diagonal among ${siteCount} sites, test whether the opposite point lies inside the circumcircle. If it does, the shared diagonal is illegal because the triangles are too skinny for the local point set.`,
    invariant: `A Delaunay triangle has no input site (out of ${siteCount} total) strictly inside its circumcircle.`,
  };

  yield {
    state: labelMatrix(
      'Local edge flip',
      [
        { id: 'before', label: 'before' },
        { id: 'test', label: 'test' },
        { id: 'flip', label: 'flip' },
        { id: 'after', label: 'after' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'why', label: 'why' },
      ],
      [
        ['diagonal p2-p3', 'skinny pair'],
        ['p4 inside circle', 'illegal'],
        ['replace with p1-p4', 'local repair'],
        ['empty circles', 'Delaunay locally'],
      ],
    ),
    highlight: { active: ['test:state', 'flip:state'], found: ['after:why'] },
    explanation: `Edge flipping walks through ${flipSteps} stages (before, test, flip, after) because the repair is local. Repeatedly fix illegal diagonals until no local violation remains.`,
  };

  yield {
    state: triangulationGraph('The output favors well-shaped triangles'),
    highlight: { found: ['e-12', 'e-24', 'e-34', 'e-35', 'e-45'], compare: ['e-23'] },
    explanation: `Delaunay maximizes the minimum angle among triangulations of ${siteCount} sites in a useful sense, which is why it is common in meshing, interpolation, and terrain modeling.`,
  };

  yield {
    state: labelMatrix(
      'Algorithms and representations',
      [
        { id: 'flip', label: 'edge flips' },
        { id: 'divide', label: 'divide/conquer' },
        { id: 'incremental', label: 'incremental' },
        { id: 'quad', label: 'quad-edge' },
      ],
      [
        { id: 'idea', label: 'idea' },
        { id: 'structure', label: 'structure' },
      ],
      [
        ['repair local illegal edge', 'adjacency graph'],
        ['merge triangulations', 'hull bridges'],
        ['insert one site', 'walking location'],
        ['primal and dual edges', 'Voronoi together'],
      ],
    ),
    highlight: { active: ['quad:structure', 'flip:idea'], found: ['incremental:structure'] },
    explanation: `The triangulation across ${triNodes} nodes is not just a set of triangles. All ${algorithmVariants} algorithm families need adjacency operations: walk neighboring triangles, flip an edge, and update the dual Voronoi structure.`,
  };
}

function* voronoiDual() {
  const voronoiNodes = 7;      // a-d, v1, v2, query
  const voronoiEdges = 7;      // edges in voronoi graph
  const siteCount = 4;         // A, B, C, D sites
  const voronoiVertices = 2;   // v1, v2
  const dualRows = 4;          // rows in dual interpretation matrix
  const caseStudies = 4;       // rows in case studies matrix

  yield {
    state: voronoiGraph('Voronoi cells are the dual of Delaunay triangles'),
    highlight: { active: ['a', 'b', 'c', 'd', 'v1', 'v2', 'e-v1-v2'], compare: ['e-a-b', 'e-b-c', 'e-c-d'] },
    explanation: `Put a Voronoi vertex at the circumcenter of each Delaunay triangle, producing ${voronoiVertices} vertices for ${siteCount} sites. Adjacent Delaunay triangles become connected Voronoi vertices. Sites share a Delaunay edge exactly when their Voronoi cells touch.`,
  };

  yield {
    state: labelMatrix(
      'Dual interpretation',
      [
        { id: 'site', label: 'site point' },
        { id: 'edge', label: 'Delaunay edge' },
        { id: 'tri', label: 'triangle' },
        { id: 'cell', label: 'Voronoi cell' },
      ],
      [
        { id: 'delaunay', label: 'Delaunay' },
        { id: 'voronoi', label: 'Voronoi' },
      ],
      [
        ['vertex', 'cell owner'],
        ['neighbor relation', 'cell boundary'],
        ['face', 'Voronoi vertex'],
        ['not explicit', 'nearest region'],
      ],
    ),
    highlight: { active: ['edge:delaunay', 'edge:voronoi'], found: ['tri:voronoi'] },
    explanation: `The ${dualRows} dual correspondences show that Delaunay is good for triangles and adjacency while Voronoi is good for nearest-site regions. They are two views of the same planar subdivision across ${voronoiEdges} edges.`,
  };

  yield {
    state: voronoiGraph('Nearest-site query follows the Voronoi cell'),
    highlight: { active: ['query', 'd', 'e-query-d'], found: ['d'], compare: ['a', 'b', 'c'] },
    explanation: `A point belongs to the Voronoi cell of the site nearest to it among ${siteCount} candidates. That makes Voronoi diagrams useful for facility regions, nearest tower coverage, and spatial interpolation.`,
  };

  yield {
    state: labelMatrix(
      'Case studies',
      [
        { id: 'mesh', label: 'mesh generation' },
        { id: 'terrain', label: 'terrain' },
        { id: 'wireless', label: 'wireless cells' },
        { id: 'games', label: 'game maps' },
      ],
      [
        { id: 'uses', label: 'uses' },
        { id: 'watch', label: 'watch out' },
      ],
      [
        ['well-shaped triangles', 'skinny boundary cases'],
        ['TIN surfaces', 'breaklines'],
        ['nearest site regions', 'not radio physics'],
        ['organic regions', 'dynamic updates'],
      ],
    ),
    highlight: { active: ['mesh:uses', 'terrain:uses'], found: ['wireless:watch'] },
    explanation: `Across ${caseStudies} domains, Delaunay/Voronoi structures are excellent geometric scaffolds. They do not replace domain rules such as radio propagation, water flow, road access, or gameplay constraints.`,
  };

  yield {
    state: voronoiGraph('Complete case: build triangles, read cells, answer nearest regions'),
    highlight: { active: ['a', 'b', 'c', 'd', 'v1', 'v2'], found: ['query', 'd'] },
    explanation: `The full workflow builds a Delaunay triangulation of ${siteCount} sites because it is easier to update and navigate, then derives ${voronoiVertices} Voronoi vertices when nearest-region explanations or cell boundaries are needed.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'edge flips') yield* edgeFlips();
  else if (view === 'voronoi dual') yield* voronoiDual();
  else throw new InputError('Pick a Delaunay/Voronoi view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has two views. The "edge flips" view starts with five points connected into triangles and shows the circumcircle test that decides whether a shared edge is legal. When an edge fails the test, it gets flipped — replaced by the other diagonal of the quadrilateral formed by two adjacent triangles. Watch which edges survive and which get replaced.',
        'The "voronoi dual" view shows four points with their Delaunay edges and then overlays the Voronoi structure: a vertex at each triangle\'s circumcenter, connected where the original triangles share an edge. A query point appears and finds its nearest site by landing inside that site\'s Voronoi cell. Use the slider to step through frames at your own pace.',
        {type: 'image', src: './assets/gifs/delaunay-triangulation-voronoi-dual.gif', alt: 'Animated walkthrough of the delaunay triangulation voronoi dual visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'You have a set of points scattered across a plane — elevation samples on a mountainside, cell tower locations, sensor positions, mesh vertices. You need to connect them into triangles for interpolation, or partition the plane into regions where each point "owns" the space closest to it. Both needs appear constantly in engineering, and both are solved by the same underlying structure.',
        'A Delaunay triangulation connects the points into triangles such that no point lies strictly inside the circumcircle of any triangle. A circumcircle is the unique circle passing through all three vertices of a triangle. The Voronoi diagram is the dual: it partitions the plane so that every location belongs to the region of its nearest input point. These two structures encode the same neighborhood information, just read from opposite directions.',
        {type: 'callout', text: 'Delaunay and Voronoi are the same neighborhood structure read from opposite sides: one as legal triangles, the other as nearest-site regions.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/5/56/Delaunay_Voronoi.svg', alt: 'Delaunay triangulation overlaid with its Voronoi diagram', caption: 'Black Delaunay edges and red Voronoi boundaries expose the primal-dual relationship directly. Source: https://upload.wikimedia.org/wikipedia/commons/5/56/Delaunay_Voronoi.svg'},
        'The reason both structures matter is that triangulation and nearest-region queries appear in completely different domains — finite-element meshing, terrain modeling, wireless coverage planning, game map generation — but they share the same geometric backbone. Build one, and you can derive the other.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Given n points, the simplest triangulation strategy is greedy: pick the shortest unused edge that does not cross any existing edge, add it, and repeat until the convex hull is filled with triangles. This produces a valid triangulation — no gaps, no overlapping triangles — but it makes no promise about triangle quality.',
        'For nearest-site queries without any preprocessing, you compute the distance from the query point to every input site and return the closest one. That costs O(n) per query, which is fine for a handful of queries but painful for thousands.',
        'Both approaches work. Neither is wrong. But both leave value on the table: the greedy triangulation often produces long, thin slivers that make interpolation numerically unstable, and brute-force nearest-site queries repeat work that could be precomputed once.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The greedy triangulation gives you triangles, but it cannot tell you whether those triangles are any good. Take four points arranged in a diamond: A at the left, B at the top, C at the right, D at the bottom. The greedy algorithm might connect the long diagonal A-C, producing two extremely flat triangles ABC and ACD. A human would immediately see that the short diagonal B-D gives two fat, well-shaped triangles instead.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/1/1f/Delaunay_circumcircles_centers.svg', alt: 'Delaunay triangulation with circumcircles and circumcenters', caption: 'The circumcircle test is the local legality check that separates Delaunay topology from arbitrary triangulation. Source: https://upload.wikimedia.org/wikipedia/commons/1/1f/Delaunay_circumcircles_centers.svg'},
        'The deeper problem is that triangle quality is not a property of one triangle in isolation. A triangle can look perfectly reasonable on its own, but a neighboring point sitting inside its circumcircle proves that the local connectivity is wrong. You need a criterion that is local enough to check efficiently but global enough that fixing all local violations produces a globally good triangulation.',
        'For nearest-site queries, the wall is similar: you want to precompute a partition of the plane so each query is a point-location lookup rather than a distance comparison against every site. But computing that partition from scratch — testing every point against every other point — seems to require O(n^2) work, which is no better than answering queries individually.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The breakthrough is the empty-circumcircle property. For any triangle in the triangulation, draw the unique circle through its three vertices. If no other input point falls strictly inside that circle, the triangle is "legal." If some point does fall inside, the shared edge between this triangle and its neighbor is illegal and should be flipped — replaced by the other diagonal of the quadrilateral formed by the two triangles.',
        'This test is local: you only look at two adjacent triangles and their four vertices at a time. But repeated local flipping converges to a global optimum. The resulting Delaunay triangulation maximizes the minimum angle across all possible triangulations of the same point set, which is precisely the property that prevents thin slivers.',
        'The dual insight falls out for free. Every Delaunay triangle has a circumcircle, and that circumcircle has a center — the circumcenter. Place a Voronoi vertex at each circumcenter. Two Delaunay triangles that share an edge produce two circumcenters; connect them with a Voronoi edge. The result is the Voronoi diagram: each input point owns the region of the plane closer to it than to any other point. You built triangles, but you also solved nearest-site partitioning.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The edge-flip algorithm is the simplest to understand. Start with any valid triangulation of the point set. For each internal edge (shared by two triangles), check whether the opposite vertex of one triangle lies inside the circumcircle of the other. If it does, the edge is illegal: delete it and insert the other diagonal of the quadrilateral. After the flip, re-check the edges of the affected triangles. Repeat until no illegal edges remain.',
        'The incircle test for a point D against triangle ABC computes the sign of a 4x4 determinant. Columns are (ax, ay, ax^2+ay^2, 1) and likewise for B, C, D. If the determinant is positive (with the right orientation convention), D is inside the circumcircle and the shared edge is illegal. This is the core geometric predicate.',
        'Production implementations use faster algorithms. Randomized incremental insertion adds points one at a time in random order: locate the triangle containing the new point (by walking from a known triangle), split it into sub-triangles, then flip illegal edges outward until the Delaunay property is restored. Expected time is O(n log n). Divide-and-conquer splits the points by x-coordinate, recursively triangulates each half, then merges along a vertical frontier. Worst-case time is O(n log n).',
        'To extract the Voronoi diagram from a completed Delaunay triangulation: compute the circumcenter of each triangle (that becomes a Voronoi vertex), and for each pair of adjacent triangles, connect their circumcenters (that becomes a Voronoi edge). Triangles on the convex hull produce unbounded Voronoi edges — rays extending to infinity in the direction perpendicular to the hull edge.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument has two parts. First, a triangulation is Delaunay if and only if every internal edge is locally Delaunay — meaning the circumcircle of each triangle on one side of the edge does not contain the opposite vertex. This is the Lawson flip theorem: local legality implies global legality. So repeatedly fixing local violations is guaranteed to reach the Delaunay triangulation without ever having to consider the global picture.',
        'Second, the process terminates. Each edge flip strictly increases the minimum angle in the triangulation (in a lexicographic sense across the sorted angle vector). Since there are finitely many triangulations of n points and the angle vector strictly increases with each flip, the algorithm cannot cycle. It must converge.',
        'The angle-optimality property explains why the result is useful: among all possible triangulations of the same point set, the Delaunay triangulation has the largest possible minimum angle. This is the max-min angle property. It does not guarantee that all angles are large — a very thin input point configuration will still produce some small angles — but it guarantees that no alternative triangulation would do better.',
        'The duality works because circumcenters are equidistant from all three vertices of their triangle. A point inside a Voronoi cell is closer to its cell\'s site than to any other site. The Voronoi edge between two sites lies along the perpendicular bisector of the Delaunay edge connecting them. Every geometric fact about one structure has a dual fact about the other.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The optimal Delaunay triangulation algorithms run in O(n log n) time for n points in the plane, and this is tight — you can reduce sorting to Delaunay triangulation, so no comparison-based algorithm can do better. The output size is O(n): a triangulation of n points has at most 2n - 5 triangles and 3n - 6 edges (by Euler\'s formula for planar graphs).',
        'The edge-flip algorithm is simple but its worst case is O(n^2) flips because a bad initial triangulation can require many cascading repairs. Randomized incremental insertion achieves O(n log n) expected time: each point insertion does O(1) expected work for the split and O(1) expected flips, with the point-location walk costing O(log n) amortized using a history DAG or skip-list structure.',
        'Space is O(n) for the triangulation itself. If you maintain a point-location structure (like the history DAG used in incremental insertion), that adds O(n) expected space. The Voronoi diagram also has O(n) vertices and edges, so extracting it is a linear-time pass over the triangulation.',
        'The hidden constant in practice is robustness. The incircle and orientation predicates involve computing signs of determinants. Naive floating-point arithmetic can give wrong signs for nearly cocircular or nearly collinear points, producing topologically invalid triangulations — missing edges, crossing edges, infinite loops. Shewchuk\'s adaptive exact arithmetic predicates (used in Triangle, CGAL, and most serious implementations) solve this by computing with just enough precision to determine the correct sign, falling back to exact arithmetic only when needed.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Terrain modeling is the classic application. Given scattered elevation samples (from LiDAR, survey points, or GPS traces), a Delaunay triangulation builds a Triangulated Irregular Network (TIN). Elevation at any query point is interpolated across the triangle containing it. The Delaunay property ensures the triangles avoid thin slivers, which makes the interpolation smoother and more numerically stable than a greedy triangulation would.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d9/Voronoi_growth_euclidean.gif', alt: 'Animated Voronoi cells growing from seed points under Euclidean distance', caption: 'Voronoi cells can be read as simultaneous nearest-site growth, which makes the region ownership intuition concrete. Source: https://upload.wikimedia.org/wikipedia/commons/d/d9/Voronoi_growth_euclidean.gif'},
        'Finite-element analysis needs meshes where every element (triangle or tetrahedron) has bounded aspect ratio. Delaunay refinement algorithms (like Ruppert\'s algorithm) start with a Delaunay triangulation and insert Steiner points at circumcenters of bad triangles until all angles exceed a threshold (typically 20-30 degrees). The Delaunay property makes it easy to reason about which triangles need refinement.',
        'Voronoi diagrams partition space into nearest-site regions. Cell tower coverage maps approximate service areas as Voronoi cells around tower locations. Logistics companies use Voronoi partitions to assign delivery zones. Natural-neighbor interpolation weights query results by the area of overlap between the query\'s would-be Voronoi cell and the existing cells. Procedural game maps use Voronoi cells as organic-looking territory boundaries.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The Delaunay/Voronoi framework assumes Euclidean distance in a flat plane. When the real metric is not Euclidean — travel time on a road network, radio propagation through buildings, cost of shipping across terrain — the Voronoi cells give misleading answers. A cell tower\'s actual coverage depends on antenna height, power, frequency, terrain blockage, and interference, not just straight-line distance. Voronoi is a starting approximation, not a substitute for a propagation model.',
        'Degeneracies cause both theoretical and practical trouble. Four cocircular points make the Delaunay triangulation non-unique (any triangulation of those four points is equally valid). Nearly collinear points make the determinant-based predicates numerically fragile. Points on a regular grid are maximally degenerate — every cell of four grid points is cocircular. Without exact arithmetic or symbolic perturbation, implementations can crash or produce garbage on these inputs.',
        'Dynamic updates are expensive. Inserting a single point costs O(log n) expected time with the right data structure, but deleting a point requires re-triangulating its former neighborhood, which can cascade. If your point set changes frequently — objects moving every frame in a simulation — rebuilding the triangulation from scratch each frame may be simpler than maintaining it incrementally. For moving-object collision detection, spatial hashing or AABB trees are usually better choices.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take four points: A = (0, 0), B = (4, 0), C = (4, 3), D = (1, 2). Start with diagonal A-C, giving triangles ABC and ACD. The circumcircle of ABC passes through (0,0), (4,0), (4,3). Its circumcenter is at (2, 1.5) with radius sqrt(4 + 2.25) = sqrt(6.25) = 2.5. Check: is D = (1, 2) inside this circle? Distance from (2, 1.5) to (1, 2) is sqrt(1 + 0.25) = sqrt(1.25) ≈ 1.118, which is less than 2.5. D is inside the circumcircle, so edge A-C is illegal.',
        'Flip: replace diagonal A-C with diagonal B-D. Now we have triangles ABD and BCD. The circumcircle of ABD passes through (0,0), (4,0), (1,2). Its circumcenter is at (2, -0.75) with radius sqrt(4 + 0.5625) = sqrt(4.5625) ≈ 2.136. Check: is C = (4,3) inside? Distance from (2, -0.75) to (4, 3) is sqrt(4 + 14.0625) = sqrt(18.0625) ≈ 4.25, which is greater than 2.136. C is outside. Check the other triangle BCD similarly — A will be outside its circumcircle. Both edges are now legal; the triangulation is Delaunay.',
        'Read the dual. Triangle ABD has circumcenter (2, -0.75). Triangle BCD has circumcenter — compute it from (4,0), (4,3), (1,2) — at approximately (2.9, 1.7). These two triangles share edge B-D, so the Voronoi diagram connects (2, -0.75) to (2.9, 1.7). That edge segment is part of the perpendicular bisector of B-D, separating the Voronoi cell of B from the cell of D. Any query point on one side of that segment is closer to B; on the other side, closer to D.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The foundational paper is Guibas and Stolfi, "Primitives for the Manipulation of General Subdivisions and the Computation of Voronoi Diagrams" (ACM Transactions on Graphics, 1985), which introduced the quad-edge data structure that represents both the Delaunay triangulation and Voronoi diagram simultaneously. DOI: https://doi.org/10.1145/282918.282923.',
        'For the incircle and orientation predicates with exact arithmetic, read Shewchuk, "Adaptive Precision Floating-Point Arithmetic and Fast Robust Geometric Predicates" (Discrete & Computational Geometry, 1997). His Triangle library implements Delaunay refinement and is widely used in meshing. For Delaunay refinement specifically, Ruppert, "A Delaunay Refinement Algorithm for Quality 2-Dimensional Mesh Generation" (Journal of Algorithms, 1995).',
        'Study Convex Hull (Monotone Chain) next to understand the outer boundary that the triangulation fills. Then explore k-d Tree and R-Tree for alternative spatial query structures, Sweep Line Segment Intersection for the general line-sweep paradigm, and A* Search for pathfinding on the graphs that Delaunay triangulations produce.',
      ],
    },
  ],
};
