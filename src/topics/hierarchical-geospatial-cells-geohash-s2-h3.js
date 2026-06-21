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
      heading: 'Why this exists',
      paragraphs: [
        `A latitude-longitude pair is precise, but it is a poor operational key. A ride-matching service cannot scan every driver in a city for each pickup. A places database cannot rely on raw floating-point comparisons for every nearby search. An analytics system cannot group billions of pings into stable neighborhoods if every point is its own unique coordinate.`,
        {type: 'callout', text: 'A geospatial cell id is a locality hint, not a geometry verdict; it narrows candidates before exact distance or containment runs.'},
        `Hierarchical geospatial cells solve a practical indexing problem: turn continuous positions on Earth into discrete ids that preserve enough locality for coarse filtering, sharding, caching, and aggregation. The cell id is not the final geometry answer. It is a way to narrow the search space so the system can do exact distance, containment, routing, or ranking on a much smaller candidate set.`,
        `This topic sits between spatial data structures and distributed systems. R-trees and k-d trees organize geometry dynamically from the dataset. Geohash, S2, and H3 predefine global grids so ordinary keys, prefixes, integer ranges, neighbor rings, and shards can carry spatial meaning. The grid gives the database a handle before the expensive geometry begins.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The first approach is a linear scan: compute the distance from the query point to every stored point and keep the nearest. It is exact for point distance, and it is easy to reason about. It fails immediately at scale. If a city has hundreds of thousands of active locations and each query needs a fresh scan, latency and CPU grow with the whole dataset instead of with the nearby region.`,
        `The second approach is a bounding box. Convert the radius into latitude and longitude ranges, ask the database for points in that rectangle, then run exact distance. This is better, but it still needs suitable indexes, and it becomes awkward around poles, the antimeridian, irregular polygons, and distributed storage. A bounding box is a query shape; it is not a reusable naming system for shards, caches, heat maps, and neighbor expansion.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `A cell index discretizes geography before the query. Given a point and a resolution, the library returns the id of the cell containing that point. Coarser resolutions cover larger areas. Finer resolutions cover smaller areas. The hierarchy lets a system move between city-scale, neighborhood-scale, block-scale, and doorstep-scale views without inventing a new key scheme each time.`,
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Geohash-grid.png/330px-Geohash-grid.png', alt: 'Map grid showing geohash cells at multiple resolutions', caption: 'Geohash uses hierarchical grid refinement so longer cell identifiers describe smaller places. Source: Wikimedia Commons, Geohash grid.'},
        `The invariant is that cells are coarse filters. Same cell means "candidate", not "nearest". Different cell does not mean "far". A point just across a boundary may be closer than a point inside the query cell. Correct nearby search therefore includes neighbor cells or a covering set, then performs exact geometry on the returned candidates.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Geohash interleaves longitude and latitude bits and encodes the result as a base-32 string. Removing characters from the end gives a coarser prefix. That makes it friendly to B-trees, tries, string prefixes, and range scans. The tax is boundary behavior. Two nearby points can have very different prefixes if they sit on opposite sides of a split, so production proximity search must include adjacent geohashes and then filter exactly.`,
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Geohash-OddEvenDigits.png/960px-Geohash-OddEvenDigits.png', alt: 'Geohash odd and even digit subdivision diagram', caption: 'Geohash alternates coordinate subdivisions as the identifier grows. Source: Wikimedia Commons, Geohash odd-even digits.'},
        `S2 models geography on the sphere. It projects the sphere onto six cube faces, then recursively subdivides each face into quadrilateral cells. Cell ids encode a hierarchy, and S2 coverings can approximate points, polylines, polygons, or larger regions as sets of cells. This makes S2 useful when the system needs robust spherical geometry, region coverings, and distributed spatial indexes rather than only point bucketing.`,
        `H3 is a hierarchical grid built around mostly hexagonal cells. Hexagons give a more uniform neighbor shape than squares for many aggregation and flow problems, and H3 supports ring-like neighbor operations that are natural for heat maps, marketplace zones, and approximate radius expansion. The hierarchy has subtleties: H3 provides exact logical containment in its index hierarchy, but geometric containment across parent and child cells is approximate, and pentagons introduce special cases.`,
      ],
    },
    {
      heading: 'The query mechanism',
      paragraphs: [
        `A nearby search usually has two phases. First, encode the query point into a cell at the chosen resolution. Fetch items in that cell and in enough neighboring cells to cover the desired radius or candidate count. Second, run exact filtering: haversine distance, spherical predicates, polygon containment, road-network ETA, or product-specific ranking.`,
        `The resolution controls the fanout. Coarse cells reduce the number of lookups but return many false candidates. Fine cells shrink each candidate set but may require many empty lookups, especially in sparse areas. Many systems adapt: use a fine resolution downtown, expand rings in suburbs, stop when enough candidates are found, and keep a latency budget so neighbor expansion cannot run forever.`,
        `For polygon or region search, the same idea becomes a covering problem. Approximate the query region with a set of cells. Retrieve points or objects attached to those cells. Then verify exact containment against the original geometry. The covering is allowed to be conservative because the exact pass removes false positives.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The correctness argument is a filter argument. The cell stage is allowed to over-return candidates, but it must not under-return the objects that could be correct answers. Neighbor cells, coverings, and fallback expansion are how the system protects recall near cell boundaries. Once the candidate set is large enough, exact geometry restores correctness for distance or containment.`,
        `The performance argument is locality. If nearby objects tend to share cells or nearby cells, the query touches a small part of the index instead of the whole dataset. When input size doubles by adding points across the world, a local query should not double its candidate set. Its cost should track local density, number of cells queried, and exact checks per candidate.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `The main cost knobs are resolution, ring size, local density, update frequency, and exact-check price. A high-resolution cell map can create many keys with tiny sets. A low-resolution map can create hot keys with huge sets. A driver-dispatch system with fast-moving objects also pays update cost as drivers cross cell boundaries, while a places index may pay mostly at ingestion time.`,
        `Shape artifacts are unavoidable. Geohash rectangles vary with latitude and have prefix discontinuities. S2 cells are quadrilateral regions on the sphere. H3 cells are mostly hexagonal but include pentagon exceptions and approximate parent-child geometry. None of these systems makes Euclidean assumptions safe on a globe, and none removes the need for exact distance or routing when the result is user-visible.`,
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        `A ride-matching service receives a pickup point. It encodes the point into an H3 or S2 cell at an operational resolution and reads available drivers from that cell. It also reads the first neighbor ring because a driver just across the boundary may be closer than one inside the pickup cell. If the first ring is sparse, it expands outward until it has enough candidates or hits the latency budget.`,
        `The final rank is not nearest crow-flight distance. The service computes road-aware ETA, checks driver state, filters unavailable vehicles, applies marketplace constraints, and may account for cancellation risk, fairness, dispatch balance, or pickup friction. The cell index only makes the candidate set small enough for that richer ranking to run in time.`,
        `The same cell scheme can support offline analytics. Trips, searches, cancellations, or supply pings can be aggregated by H3 cell for heat maps and operational dashboards. That does not mean online dispatch and offline reporting should use the same resolution. Dispatch optimizes recall and latency; analytics optimizes stable reporting buckets and comparable time series.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Hierarchical cells are a good fit when spatial locality needs to become an ordinary key. They work well for nearby candidate retrieval, geospatial sharding, cache keys, demand heat maps, rate limiting by region, distributed joins, location privacy coarsening, and approximate aggregation. They are especially useful when the same id can serve online lookup and offline analysis.`,
        `They also help teams communicate about space. Instead of passing arbitrary bounding boxes between systems, a product can say "resolution 9 cells", "ring 2 expansion", or "cover this polygon with S2 cells at level 12". Those names are operational contracts. They make behavior easier to test, tune, and compare across services.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Cells are the wrong final answer for exact geometry. Do not return same-cell results as nearest results. Do not use a cell boundary as a legal boundary unless the product explicitly accepts approximation. Do not assume H3, S2, and Geohash have identical hierarchy or neighbor behavior. A grid that is excellent for analytics can be awkward for exact cadastral polygons, high-precision surveying, or route planning.`,
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Comparing-Geoash-Hilbert.png/960px-Comparing-Geoash-Hilbert.png', alt: 'Comparison diagram of geohash ordering and Hilbert curve locality', caption: 'Space-filling order choices affect how well nearby cells remain near in key order. Source: Wikimedia Commons, Comparing Geohash and Hilbert.'},
        `They are also not a replacement for R-trees. An R-tree indexes the bounding boxes of the actual objects and adapts to the dataset. A global cell grid imposes structure before seeing the data. That is valuable for sharding and aggregation, but it creates false positives, empty-cell fanout, boundary misses unless neighbors are included, and hot cells in dense regions.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Primary sources: S2 Geometry at https://s2geometry.io/ and its cell hierarchy guide at https://s2geometry.io/devguide/s2cell_hierarchy.html, H3 documentation at https://h3geo.org/docs/, and Uber's H3 launch post at https://www.uber.com/us/en/blog/h3/. Study R-Tree Spatial Index for dataset-adaptive spatial pruning, k-d Tree for point partitioning, Trie for prefix lookup, Sharding & Partitioning for distributed placement, Consistent Hashing for key movement, and Graph Shortest Paths for the difference between nearby by distance and nearby by route time.`,
      ],
    },
  ],
};
