// Hierarchical geospatial cells: Geohash, S2, and H3 turn latitude/longitude
// into cell IDs for coarse spatial filtering, sharding, and aggregation.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'hierarchical-geospatial-cells-geohash-s2-h3',
  title: 'Hierarchical Geospatial Cells: Geohash, S2, H3',
  category: 'Data Structures',
  summary: 'Spatial locality as IDs: encode points into hierarchical cells, query neighboring cells for candidates, then run exact distance and product ranking.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['cell hierarchy', 'nearby search case study'], defaultValue: 'cell hierarchy' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function cellGraph(title) {
  return graphState({
    nodes: [
      { id: 'point', label: 'point', x: 0.8, y: 3.6, note: 'lat/lng' },
      { id: 'coarse', label: 'coarse', x: 2.6, y: 2.0, note: 'city cell' },
      { id: 'fine', label: 'fine', x: 2.6, y: 5.2, note: 'block cell' },
      { id: 'id', label: 'cell ID', x: 4.8, y: 3.6, note: 'prefix' },
      { id: 'neighbors', label: 'neighbors', x: 6.8, y: 2.0, note: 'ring' },
      { id: 'candidates', label: 'candidates', x: 6.8, y: 5.2, note: 'coarse' },
      { id: 'exact', label: 'exact', x: 8.8, y: 3.6, note: 'distance' },
    ],
    edges: [
      { id: 'e-point-coarse', from: 'point', to: 'coarse' },
      { id: 'e-coarse-fine', from: 'coarse', to: 'fine' },
      { id: 'e-fine-id', from: 'fine', to: 'id' },
      { id: 'e-id-neighbors', from: 'id', to: 'neighbors' },
      { id: 'e-id-candidates', from: 'id', to: 'candidates' },
      { id: 'e-neighbors-exact', from: 'neighbors', to: 'exact' },
      { id: 'e-candidates-exact', from: 'candidates', to: 'exact' },
    ],
  }, { title });
}

function dispatchGraph(title) {
  return graphState({
    nodes: [
      { id: 'rider', label: 'rider', x: 0.8, y: 3.6, note: 'pickup' },
      { id: 'cell', label: 'cell', x: 2.7, y: 3.6, note: 'res 9' },
      { id: 'ring1', label: 'ring 1', x: 4.8, y: 2.0, note: 'nearby' },
      { id: 'ring2', label: 'ring 2', x: 4.8, y: 5.2, note: 'fallback' },
      { id: 'drivers', label: 'drivers', x: 6.8, y: 3.6, note: 'candidate set' },
      { id: 'route', label: 'route', x: 8.8, y: 2.0, note: 'ETA' },
      { id: 'rank', label: 'rank', x: 8.8, y: 5.2, note: 'business' },
    ],
    edges: [
      { id: 'e-rider-cell', from: 'rider', to: 'cell' },
      { id: 'e-cell-ring1', from: 'cell', to: 'ring1' },
      { id: 'e-cell-ring2', from: 'cell', to: 'ring2' },
      { id: 'e-ring1-drivers', from: 'ring1', to: 'drivers' },
      { id: 'e-ring2-drivers', from: 'ring2', to: 'drivers' },
      { id: 'e-drivers-route', from: 'drivers', to: 'route' },
      { id: 'e-drivers-rank', from: 'drivers', to: 'rank' },
    ],
  }, { title });
}

function* cellHierarchy() {
  yield {
    state: cellGraph('A geospatial cell index maps a point to a hierarchy of cells'),
    highlight: { active: ['point', 'coarse', 'fine', 'id', 'e-point-coarse', 'e-coarse-fine', 'e-fine-id'], compare: ['exact'] },
    explanation: 'Geohash, S2, and H3 all discretize geography. A latitude/longitude point becomes a cell ID at a chosen precision. Coarser cells group nearby points; finer cells narrow the candidate set.',
    invariant: 'Cell IDs are a coarse spatial filter, not the final distance answer.',
  };

  yield {
    state: labelMatrix(
      'Three cell families',
      [
        { id: 'geohash', label: 'Geohash' },
        { id: 's2', label: 'S2' },
        { id: 'h3', label: 'H3' },
        { id: 'rtree', label: 'R-tree' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'indexUse' },
      ],
      [
        ['rectangles', 'prefix/range scan'],
        ['sphere cells', 'covering + cell ID'],
        ['hexagons', 'rings + aggregation'],
        ['bounding boxes', 'dynamic geometry'],
      ],
    ),
    highlight: { found: ['geohash:indexUse', 's2:indexUse', 'h3:indexUse'], compare: ['rtree:shape'] },
    explanation: 'These are not the same structure with different branding. Geohash is prefix-friendly, S2 models cells on the sphere, H3 emphasizes hexagonal grid operations, and R-trees group object boxes dynamically.',
  };

  yield {
    state: cellGraph('Neighbor cells repair boundary misses'),
    highlight: { active: ['id', 'neighbors', 'candidates', 'e-id-neighbors', 'e-id-candidates'], found: ['exact'] },
    explanation: 'A point just across a cell boundary may be closer than a point in the same cell. Production nearby search queries the cell plus neighboring cells, then computes exact distances on the returned candidates.',
  };

  yield {
    state: labelMatrix(
      'Precision tradeoff',
      [
        { id: 'coarse', label: 'coarse cell' },
        { id: 'fine', label: 'fine cell' },
        { id: 'ring', label: 'larger ring' },
        { id: 'exact', label: 'exact pass' },
      ],
      [
        { id: 'good', label: 'helps' },
        { id: 'cost' },
      ],
      [
        ['fewer shards', 'many false candidates'],
        ['small candidate set', 'more empty lookups'],
        ['better recall', 'more cells queried'],
        ['correct ranking', 'CPU per candidate'],
      ],
    ),
    highlight: { active: ['fine:good', 'ring:good'], compare: ['coarse:cost'], found: ['exact:good'] },
    explanation: 'Resolution is a product knob. Too coarse and every query drags back too many candidates. Too fine and the service fans out across many empty cells. The exact pass is mandatory either way.',
  };
}

function* nearbySearchCaseStudy() {
  yield {
    state: dispatchGraph('Ride matching starts with cells, not every driver'),
    highlight: { active: ['rider', 'cell', 'ring1', 'drivers', 'e-rider-cell', 'e-cell-ring1', 'e-ring1-drivers'], compare: ['ring2'] },
    explanation: 'A dispatch system maps the rider pickup to a cell, reads available drivers in that cell and nearby cells, and avoids scanning every moving driver in the city.',
    invariant: 'Cells bound candidate retrieval; routing decides the winner.',
  };

  yield {
    state: labelMatrix(
      'Nearby search pipeline',
      [
        { id: 'encode', label: 'encode pickup' },
        { id: 'fetch', label: 'fetch cells' },
        { id: 'filter', label: 'filter candidates' },
        { id: 'rank', label: 'rank drivers' },
      ],
      [
        { id: 'dataMove', label: 'data move' },
        { id: 'risk' },
      ],
      [
        ['lat/lng -> cell', 'wrong precision'],
        ['cell + ring', 'boundary miss'],
        ['haversine / road dist', 'false positives'],
        ['ETA + policy', 'not nearest crow-flight'],
      ],
    ),
    highlight: { found: ['fetch:risk', 'filter:dataMove'], active: ['rank:dataMove'] },
    explanation: 'The geospatial index is only the candidate generator. Good dispatch ranking considers road ETA, driver state, demand balancing, cancellations, and marketplace policy.',
  };

  yield {
    state: dispatchGraph('Expand the ring only when the first ring is sparse'),
    highlight: { active: ['ring1', 'ring2', 'drivers', 'e-cell-ring2', 'e-ring2-drivers'], found: ['rank'] },
    explanation: 'A dense downtown pickup may need only one ring of cells. A suburban pickup may expand outward until enough candidates are found or the latency budget is exhausted.',
  };

  yield {
    state: labelMatrix(
      'Production storage choices',
      [
        { id: 'redis', label: 'hot drivers' },
        { id: 'sql', label: 'places search' },
        { id: 'lake', label: 'analytics' },
        { id: 'shard', label: 'sharding' },
      ],
      [
        { id: 'cellUse', label: 'cell use' },
        { id: 'lesson' },
      ],
      [
        ['cell -> set of drivers', 'fast mutable state'],
        ['cell prefix index', 'candidate scan'],
        ['H3 aggregation', 'heat maps'],
        ['cell prefix/range', 'locality routing'],
      ],
    ),
    highlight: { active: ['redis:cellUse', 'sql:cellUse'], found: ['lake:lesson'], compare: ['shard:lesson'] },
    explanation: 'The same cell ID can serve several jobs: low-latency lookup, durable search, analytics aggregation, and shard routing. The query still needs exact geometry before returning user-visible results.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'cell hierarchy') yield* cellHierarchy();
  else if (view === 'nearby search case study') yield* nearbySearchCaseStudy();
  else throw new InputError('Pick a geospatial-cells view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Hierarchical geospatial cell indexes turn latitude/longitude into discrete cell IDs. Instead of asking a database to search raw floating-point coordinates, the system stores points under cells at a chosen resolution. Nearby queries fetch the target cell and neighboring cells, then run exact distance and ranking over the candidates.',
        'This topic builds on R-Tree Spatial Index, k-d Tree, Trie, and Sharding & Partitioning. R-trees and k-d trees prune geometry dynamically. Geohash, S2, and H3 predefine a global grid so ordinary keys, prefixes, ranges, and shards can carry spatial locality.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Geohash interleaves latitude and longitude bits and encodes them as a base-32 string. Shared prefixes usually mean nearby regions, so a B-tree or trie-like prefix lookup can fetch points in one region. The catch is boundary behavior: two physically close points can land in different prefixes, so nearby search must include neighboring cells.',
        'S2 projects the sphere onto cube faces and recursively subdivides cells. Cell IDs encode position in a hierarchy, with Hilbert-curve ordering preserving locality better than naive row-major ordering. S2 coverings can approximate arbitrary regions as sets of cells, which makes it useful for large distributed spatial indexes.',
        'H3 is a discrete global grid system built around hexagonal cells at multiple resolutions. Hexagons have attractive neighborhood properties for aggregation and marketplace analytics. Uber has described H3 as a grid used for pricing, dispatch, visualization, and marketplace optimization.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Cell indexes are coarse filters. Querying too few cells misses nearby results across boundaries. Querying too many cells increases fanout, network calls, and exact-distance CPU. The right resolution depends on density, latency budget, freshness, and the product radius.',
        'Cells also introduce shape artifacts. Geohash rectangles change size with latitude. H3 has pentagons and approximate hierarchy. S2 cells are quadrilateral regions on the sphere. None of these remove the need for exact distance, polygon containment, routing ETA, or business ranking.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A ride-matching service receives a pickup point. It encodes the point into a cell at the operational resolution, fetches drivers from that cell and the first neighbor ring, and computes exact road-aware ETAs for those candidates. If candidate count is low, it expands to another ring. The final assignment is not simply nearest geographic point; it also considers driver state, route time, cancellation risk, fairness, and marketplace balance.',
        'The same cells power analytics. Recent ride requests can be aggregated by H3 cell for heat maps and surge-pricing features. Places search can store cell prefixes in a database index. Dispatch can keep hot driver IDs in an in-memory map keyed by cell. A single cell scheme becomes both an online lookup primitive and an offline aggregation coordinate system.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The biggest mistake is returning same-cell results as if they were nearest results. Same cell means candidate, not answer. Always include neighbor cells and exact distance checks. Another mistake is using one resolution for every city. Dense downtowns and sparse suburbs need different fanout and fallback behavior.',
        'Do not confuse hierarchical cells with R-trees. R-trees index the actual bounding boxes in the dataset and adapt to object distribution. Cell systems impose a global grid first, which is excellent for sharding and aggregation but can produce false positives and boundary misses.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: S2 cell hierarchy docs at https://s2geometry.io/devguide/s2cell_hierarchy.html, S2 library overview at https://s2geometry.io/, H3 overview at https://h3geo.org/docs/core-library/overview/, and Uber H3 launch post at https://www.uber.com/us/en/blog/h3/. Study R-Tree Spatial Index, k-d Tree, Trie, Sharding & Partitioning, and Consistent Hashing next.',
      ],
    },
  ],
};
