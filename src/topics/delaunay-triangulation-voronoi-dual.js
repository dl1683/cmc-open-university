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
    { heading: 'What it is', paragraphs: [
      'A Delaunay triangulation connects planar points into triangles such that no point lies inside the circumcircle of any triangle. Its dual is the Voronoi diagram: each site owns the region of points closer to it than to any other site.',
      'The two structures answer different questions. Delaunay gives adjacency and well-shaped triangles. Voronoi gives nearest-site regions and cell boundaries. Efficient geometry systems often keep enough topology to move between both views.',
    ] },
    { heading: 'How it works', paragraphs: [
      'One way to understand Delaunay triangulation is local edge flipping. In a quadrilateral formed by two adjacent triangles, if one triangle circumcircle contains the opposite point, flip the shared diagonal. Repeating this local repair leads toward a triangulation satisfying the empty-circumcircle property.',
      'The Voronoi dual appears by placing a vertex at each triangle circumcenter and connecting circumcenters of adjacent triangles. A Delaunay edge between two sites means the two corresponding Voronoi cells share a boundary.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Delaunay triangulation can be built in O(n log n) time by standard divide-and-conquer, randomized incremental, or sweep algorithms under suitable assumptions. Dynamic updates need point location, edge flips, and robust predicates.',
      'Robustness matters. Circumcircle tests and orientation tests are numerically sensitive. Degenerate inputs such as cocircular points require tie-breaking or symbolic perturbation to avoid inconsistent topology.',
    ] },
    { heading: 'Complete case study', paragraphs: [
      'A terrain system receives sampled elevation points. It builds a Delaunay triangulation to form a triangulated irregular network, avoiding many skinny triangles. Rendering and interpolation use the triangle mesh. A derived Voronoi diagram can explain nearest sample regions or support natural-neighbor style interpolation.',
      'A wireless planning tool can use Voronoi cells as a first approximation of nearest tower regions. The cells are not a radio propagation model, but they give a geometric baseline before terrain, load, antenna, and spectrum constraints are applied.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: Guibas and Stolfi, "Primitives for the Manipulation of General Subdivisions and the Computation of Voronoi Diagrams", ACM DOI https://doi.org/10.1145/282918.282923, PDF mirror https://mesh.brown.edu/DGP/pdfs/Guibas-tog85.pdf. Study Convex Hull: Monotone Chain, Sweep Line Segment Intersection, k-d Tree, R-Tree Spatial Index, and A* Search next.',
    ] },
  ],
};
