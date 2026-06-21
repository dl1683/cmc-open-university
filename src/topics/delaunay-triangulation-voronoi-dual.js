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
  yield {
    state: triangulationGraph('Start with a triangulation of the point set'),
    highlight: { active: ['p1', 'p2', 'p3', 'p4', 'p5'], compare: ['cc'] },
    explanation: 'A triangulation connects points with non-crossing edges until the convex hull is filled with triangles. Delaunay chooses the triangulation whose local triangles pass the empty-circumcircle test.',
  };

  yield {
    state: triangulationGraph('Illegal edge: a point lies inside a neighbor circumcircle'),
    highlight: { active: ['p2', 'p3', 'p4', 'cc', 'e-23', 'e-24', 'e-34'], compare: ['p5'] },
    explanation: 'For two adjacent triangles, test whether the opposite point lies inside the circumcircle. If it does, the shared diagonal is illegal because the triangles are too skinny for the local point set.',
    invariant: 'A Delaunay triangle has no input site strictly inside its circumcircle.',
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
    explanation: 'Edge flipping is powerful because the repair is local. Repeatedly fix illegal diagonals until no local violation remains.',
  };

  yield {
    state: triangulationGraph('The output favors well-shaped triangles'),
    highlight: { found: ['e-12', 'e-24', 'e-34', 'e-35', 'e-45'], compare: ['e-23'] },
    explanation: 'Delaunay maximizes the minimum angle among triangulations in a useful sense, which is why it is common in meshing, interpolation, and terrain modeling.',
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
    explanation: 'The triangulation is not just a set of triangles. Efficient implementations need adjacency operations: walk neighboring triangles, flip an edge, and update the dual Voronoi structure.',
  };
}

function* voronoiDual() {
  yield {
    state: voronoiGraph('Voronoi cells are the dual of Delaunay triangles'),
    highlight: { active: ['a', 'b', 'c', 'd', 'v1', 'v2', 'e-v1-v2'], compare: ['e-a-b', 'e-b-c', 'e-c-d'] },
    explanation: 'Put a Voronoi vertex at the circumcenter of each Delaunay triangle. Adjacent Delaunay triangles become connected Voronoi vertices. Sites share a Delaunay edge exactly when their Voronoi cells touch.',
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
    explanation: 'Delaunay is good for triangles and adjacency. Voronoi is good for nearest-site regions. They are two views of the same planar subdivision.',
  };

  yield {
    state: voronoiGraph('Nearest-site query follows the Voronoi cell'),
    highlight: { active: ['query', 'd', 'e-query-d'], found: ['d'], compare: ['a', 'b', 'c'] },
    explanation: 'A point belongs to the Voronoi cell of the site nearest to it. That makes Voronoi diagrams useful for facility regions, nearest tower coverage, and spatial interpolation.',
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
    explanation: 'Delaunay/Voronoi structures are excellent geometric scaffolds. They do not replace domain rules such as radio propagation, water flow, road access, or gameplay constraints.',
  };

  yield {
    state: voronoiGraph('Complete case: build triangles, read cells, answer nearest regions'),
    highlight: { active: ['a', 'b', 'c', 'd', 'v1', 'v2'], found: ['query', 'd'] },
    explanation: 'The full workflow often builds a Delaunay triangulation because it is easier to update and navigate, then derives Voronoi cells when nearest-region explanations or cell boundaries are needed.',
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
      heading: 'Why this exists',
      paragraphs: [
        'A Delaunay triangulation connects planar points into triangles such that no input point lies strictly inside the circumcircle of any triangle. Its dual is the Voronoi diagram: each site owns the region of points closer to it than to any other site.',
        {type: 'callout', text: 'Delaunay and Voronoi are the same neighborhood structure read from opposite sides: one as legal triangles, the other as nearest-site regions.'},
        'These structures exist because many spatial problems need a disciplined way to turn scattered points into local neighborhoods. Terrain models need triangles for interpolation. Mesh generators need triangles that do not become numerically awful. Nearest-site systems need a partition of space into regions. Delaunay and Voronoi are two linked answers to those needs.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/5/56/Delaunay_Voronoi.svg', alt: 'Delaunay triangulation overlaid with its Voronoi diagram', caption: 'Black Delaunay edges and red Voronoi boundaries expose the primal-dual relationship directly. Source: https://upload.wikimedia.org/wikipedia/commons/5/56/Delaunay_Voronoi.svg'},
        'The important point is that this is not just drawing pretty triangles. The triangulation becomes a topology: which points are neighbors, which triangles share an edge, which region a query point belongs to, and where local changes can be repaired without rebuilding the whole world.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious way to triangulate points is to connect non-crossing edges until the convex hull is filled. That produces a triangulation, but almost any point set has many possible triangulations. Some have long, skinny triangles that make interpolation unstable, finite-element meshes weak, and geometric predicates fragile.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/1/1f/Delaunay_circumcircles_centers.svg', alt: 'Delaunay triangulation with circumcircles and circumcenters', caption: 'The circumcircle test is the local legality check that separates Delaunay topology from arbitrary triangulation. Source: https://upload.wikimedia.org/wikipedia/commons/1/1f/Delaunay_circumcircles_centers.svg'},
        'The wall is that triangle quality is not purely about one triangle. A triangle can look acceptable by itself while a neighboring point makes its circumcircle illegal. The Delaunay condition turns the vague desire for "good triangles" into a local geometric test that can be checked and repaired.',
        'For nearest-site regions, the obvious approach is to compare a query point against every site. That works for one query, but it throws away all preprocessing. A Voronoi diagram precomputes the regions where each site wins, so a point-location structure can answer nearest-site questions by finding the cell.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The empty-circumcircle test is the key. For every triangle, its circumcircle should contain no other input site in its interior. If two adjacent triangles fail that test, flipping their shared diagonal repairs the local configuration. Repeating local repairs removes the illegal edges that create unnecessarily skinny triangles.',
        'The dual insight is just as important. Put a Voronoi vertex at the circumcenter of each Delaunay triangle. Connect circumcenters of adjacent Delaunay triangles. A Delaunay edge between sites A and B means the Voronoi cells for A and B share a boundary. The triangulation and the region diagram are the same planar subdivision viewed from opposite sides.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the edge-flip view, watch the shared diagonal between two adjacent triangles. The circumcenter marker is not decoration; it represents the circle used to decide whether the opposite point makes the current diagonal illegal. When the test fails, the repair is a diagonal flip, not a global redraw.',
        'In the Voronoi-dual view, read each Delaunay triangle as producing one Voronoi vertex at its circumcenter. When two triangles share a Delaunay edge, their circumcenters connect. The query point belongs to the cell of its nearest site, so the dual explains why Delaunay adjacency can answer nearest-region questions.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'One teaching implementation starts with any valid triangulation and repeatedly flips illegal edges. For a convex quadrilateral made by two adjacent triangles, test whether either opposite point lies inside the circumcircle of the neighboring triangle. If so, replace the current diagonal with the other diagonal. The local topology changes, but the point set and convex hull do not.',
        'Production implementations usually use more structured algorithms: divide and conquer, randomized incremental insertion, sweep methods, or robust libraries. Incremental insertion locates the triangle containing a new point, splits the surrounding region, then flips illegal edges until the Delaunay invariant is restored. Efficient code needs adjacency links so it can walk from triangle to triangle and update neighbors after flips.',
        'The Voronoi diagram can be derived after the triangulation is built. Each triangle face maps to a Voronoi vertex. Each Delaunay edge maps to a Voronoi edge segment or ray. Boundary triangles produce unbounded Voronoi cells, which is why diagrams at the convex hull extend outward.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'For points in general position, a triangulation is Delaunay exactly when every edge is locally legal under the empty-circumcircle test. That is why edge flips can be local while the result is globally meaningful. The algorithm does not need to compare every possible triangulation; it only needs to remove local violations until none remain.',
        'Delaunay triangulations also have a useful angle property: among triangulations of the same point set, they avoid making the smallest angle worse than necessary in a precise lexicographic sense. That is why they are common in meshing and interpolation. They do not guarantee perfect triangles, but they are a strong default when the input sites are fixed.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose four points form a convex quadrilateral. There are two possible diagonals. Choose diagonal AC and you get triangles ABC and ACD. If point D lies inside the circumcircle of ABC, diagonal AC is illegal. Flip to diagonal BD, producing triangles ABD and BCD. The point set is unchanged, but the local neighborhood now satisfies the Delaunay test for that quadrilateral.',
        'Now read the dual. The circumcenter of ABD becomes one Voronoi vertex, and the circumcenter of BCD becomes another. Because the triangles share edge BD, those two Voronoi vertices connect along the boundary between the regions owned by B and D. The flip changed triangle adjacency and therefore changed the nearest-site cell boundary.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Delaunay triangulation can be built in O(n log n) time by standard algorithms under suitable assumptions. The main operations are point location, orientation tests, incircle tests, adjacency updates, and edge flips. The asymptotic bound is only part of the story; robust numeric predicates often decide whether an implementation is trustworthy.',
        'Degenerate inputs matter. Four or more cocircular points can make the Delaunay triangulation non-unique. Nearly collinear points can amplify floating-point error. Practical systems use exact predicates, adaptive precision, symbolic perturbation, or library code rather than casual floating-point geometry.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'It wins in terrain models, surface interpolation, finite-element preprocessing, nearest-neighbor region sketches, geographic partitioning, game-map generation, and geometric cleanup where local neighborhoods matter. It is especially useful when you need both a triangle mesh and a meaningful adjacency graph.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d9/Voronoi_growth_euclidean.gif', alt: 'Animated Voronoi cells growing from seed points under Euclidean distance', caption: 'Voronoi cells can be read as simultaneous nearest-site growth, which makes the region ownership intuition concrete. Source: https://upload.wikimedia.org/wikipedia/commons/d/d9/Voronoi_growth_euclidean.gif'},
        'A terrain system is a clean case. Given elevation samples, it builds a triangulated irregular network. Delaunay avoids many skinny triangles, so interpolation across triangle faces behaves better. A derived Voronoi diagram can then explain which sample owns which region or support natural-neighbor interpolation.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails as a complete model when distance is not Euclidean or when domain rules dominate geometry. Wireless coverage depends on terrain, antennas, load, reflection, and spectrum. Road travel depends on the street graph. Watersheds depend on elevation and flow. A Voronoi cell is a useful baseline, not a substitute for those models.',
        'It is also delicate under frequent dynamic updates. Inserting or deleting points requires point location and local repairs; moving many points can be easier to handle by rebuilding. If your objects are moving boxes rather than fixed sites, a dynamic AABB tree, spatial hash grid, or sweep-and-prune structure may be the right index.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Guibas and Stolfi, "Primitives for the Manipulation of General Subdivisions and the Computation of Voronoi Diagrams", ACM DOI https://doi.org/10.1145/282918.282923, PDF mirror https://mesh.brown.edu/DGP/pdfs/Guibas-tog85.pdf. Study Convex Hull: Monotone Chain, Sweep Line Segment Intersection, k-d Tree, R-Tree Spatial Index, Dynamic AABB Tree Broad Phase, and A* Search next.',
      ],
    },
  ],
};
