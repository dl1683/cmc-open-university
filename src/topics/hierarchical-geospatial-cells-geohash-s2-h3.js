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
  const cellFamilies = ['Geohash', 'S2', 'H3'];
  const pipelineStages = ['point', 'coarse', 'fine', 'id', 'neighbors', 'candidates', 'exact'];

  yield {
    state: cellGraph('A geospatial cell index maps a point to a hierarchy of cells'),
    highlight: { active: ['point', 'coarse', 'fine', 'id', 'e-point-coarse', 'e-coarse-fine', 'e-fine-id'], compare: ['exact'] },
    explanation: `${cellFamilies.join(', ')} all discretize geography through ${pipelineStages.length} pipeline stages. A latitude/longitude point becomes a cell ID at a chosen precision. Coarser cells group nearby points; finer cells narrow the candidate set.`,
    invariant: `Cell IDs from any of the ${cellFamilies.length} families are a coarse spatial filter, not the final distance answer.`,
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
    explanation: `These ${cellFamilies.length} families are not the same structure with different branding. ${cellFamilies[0]} is prefix-friendly, ${cellFamilies[1]} models cells on the sphere, ${cellFamilies[2]} emphasizes hexagonal grid operations, and R-trees group object boxes dynamically.`,
  };

  yield {
    state: cellGraph('Neighbor cells repair boundary misses'),
    highlight: { active: ['id', 'neighbors', 'candidates', 'e-id-neighbors', 'e-id-candidates'], found: ['exact'] },
    explanation: `A point just across a cell boundary may be closer than a point in the same cell. Production nearby search queries the cell plus neighboring cells — touching ${pipelineStages.length} pipeline stages — then computes exact distances on the returned candidates.`,
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
    explanation: `Resolution is a product knob across all ${cellFamilies.length} cell families. Too coarse and every query drags back too many candidates. Too fine and the service fans out across many empty cells. The exact pass at stage ${pipelineStages.indexOf('exact') + 1} of ${pipelineStages.length} is mandatory either way.`,
  };
}

function* nearbySearchCaseStudy() {
  const ringLevels = 2;
  const dispatchStages = ['rider', 'cell', 'ring1', 'ring2', 'drivers', 'route', 'rank'];
  const cellRes = 9;

  yield {
    state: dispatchGraph('Ride matching starts with cells, not every driver'),
    highlight: { active: ['rider', 'cell', 'ring1', 'drivers', 'e-rider-cell', 'e-cell-ring1', 'e-ring1-drivers'], compare: ['ring2'] },
    explanation: `A dispatch system maps the rider pickup to a resolution-${cellRes} cell, reads available drivers in that cell and up to ${ringLevels} nearby rings, and avoids scanning every moving driver in the city.`,
    invariant: `Cells bound candidate retrieval across ${dispatchStages.length} dispatch stages; routing decides the winner.`,
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
    explanation: `The geospatial index at resolution ${cellRes} is only the candidate generator. Good dispatch ranking through all ${dispatchStages.length} stages considers road ETA, driver state, demand balancing, cancellations, and marketplace policy.`,
  };

  yield {
    state: dispatchGraph('Expand the ring only when the first ring is sparse'),
    highlight: { active: ['ring1', 'ring2', 'drivers', 'e-cell-ring2', 'e-ring2-drivers'], found: ['rank'] },
    explanation: `A dense downtown pickup may need only ring 1 of ${ringLevels} available rings. A suburban pickup may expand outward to ring ${ringLevels} until enough candidates are found or the latency budget is exhausted.`,
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
    explanation: `The same resolution-${cellRes} cell ID can serve several jobs across ${dispatchStages.length} stages: low-latency lookup, durable search, analytics aggregation, and shard routing. The query still needs exact geometry before returning user-visible results.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The cell hierarchy view walks through the pipeline that every geospatial cell system shares: a point becomes a cell id, neighboring cells expand the search ring, and an exact pass filters false positives. Watch the graph nodes light up left to right to trace data movement. The matrix frames compare Geohash, S2, and H3 side by side, then show how resolution trades fanout for precision.',
        {type: 'image', src: './assets/gifs/hierarchical-geospatial-cells-geohash-s2-h3.gif', alt: 'Animated walkthrough of the hierarchical geospatial cells geohash s2 h3 visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'Switch to the nearby search case study for a ride-dispatch pipeline. A rider pickup becomes a cell, rings expand until enough driver candidates appear, and a final ranking stage picks the winner using road ETA and business rules. The matrix frames show how each stage can fail independently.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A latitude-longitude pair is precise, but it is a poor operational key. A ride-matching service cannot scan every driver in a city for each pickup. A places database cannot rely on raw floating-point comparisons for every nearby search. An analytics system cannot group billions of pings into stable neighborhoods if every point is its own unique coordinate.',
        {type: 'callout', text: 'A geospatial cell id is a locality hint, not a geometry verdict; it narrows candidates before exact distance or containment runs.'},
        'Hierarchical geospatial cells solve a practical indexing problem: turn continuous positions on Earth into discrete ids that preserve enough locality for coarse filtering, sharding, caching, and aggregation. The cell id is not the final geometry answer. It narrows the search space so the system can do exact distance, containment, routing, or ranking on a much smaller candidate set.',
        'This topic sits between spatial data structures and distributed systems. R-trees and k-d trees organize geometry dynamically from the dataset. Geohash, S2, and H3 predefine global grids so ordinary keys, prefixes, integer ranges, neighbor rings, and shards can carry spatial meaning without the database ever touching raw geometry. The grid gives the database a handle before the expensive geometry begins.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest solution is a linear scan: compute the distance from the query point to every stored point and keep the nearest. For a city with 200,000 active drivers, each pickup query would compute 200,000 haversine distances. Even at 100 nanoseconds per haversine, that is 20 milliseconds of pure math per query, and that ignores memory access, network, and concurrency. With 1,000 queries per second, the scan burns 20 billion distance computations per second. It is exact but unsustainable.',
        'The next approach is a bounding box. Convert a 2 km radius into latitude and longitude ranges (roughly +/-0.018 degrees in latitude, +/-0.018/cos(lat) in longitude), query the database for points in that rectangle, then filter by exact distance. This is better, but it needs a composite index on (latitude, longitude), becomes distorted near the poles and the antimeridian, and does not generalize to sharding, caching, or analytics. A bounding box is a query shape, not a reusable naming system.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Bounding boxes break in three concrete ways. First, they do not compose across services. A cache cannot key on a bounding box because every query has a slightly different rectangle. A shard router cannot partition the world into bounding boxes without a separate partitioning scheme. Two different services searching the same neighborhood produce different rectangles, so nothing can be reused or pre-aggregated.',
        'Second, bounding boxes carry no hierarchy. A system that needs city-level aggregation at 9 AM and block-level precision at 9:01 AM has no way to zoom in and out of a bounding box. It must invent a new query each time. There is no parent-child relationship between rectangles.',
        'Third, bounding boxes are not distributable. To shard a database by geography, you need deterministic placement: given a point, which shard owns it? A bounding box does not answer that. You need a named cell that is stable, hierarchical, and computable from the point alone, without querying any external service. That is exactly what Geohash, S2, and H3 provide.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A cell index discretizes geography before the query arrives. Given a point and a resolution level, the library returns the id of the cell containing that point. Coarser resolutions cover larger areas; finer resolutions cover smaller ones. The hierarchy lets a system move between city-scale, neighborhood-scale, block-scale, and doorstep-scale views without inventing a new key scheme each time.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Geohash-grid.png/330px-Geohash-grid.png', alt: 'Map grid showing geohash cells at multiple resolutions', caption: 'Geohash uses hierarchical grid refinement so longer cell identifiers describe smaller places. Source: Wikimedia Commons, Geohash grid.'},
        'The critical invariant: cells are coarse filters. Same cell means "candidate", not "nearest". Different cell does not mean "far". A point one meter across a cell boundary may be closer than a point 500 meters inside the query cell. Correct nearby search therefore includes neighbor cells or a covering set, then performs exact geometry on the returned candidates. Any system that skips the exact pass will return wrong answers at cell boundaries.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Geohash interleaves longitude and latitude bits and encodes the result as a base-32 string. Each character refines the cell by a factor of 32 in the interleaved space. A 5-character geohash covers roughly 4.9 km by 4.9 km; a 7-character geohash covers roughly 153 m by 153 m. Removing characters from the end gives a coarser prefix, which makes geohash friendly to B-trees, tries, and range scans. The tax is boundary behavior: two points 10 meters apart can have completely different prefixes if they straddle a split boundary, so production proximity search must always include adjacent geohashes.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Geohash-OddEvenDigits.png/960px-Geohash-OddEvenDigits.png', alt: 'Geohash odd and even digit subdivision diagram', caption: 'Geohash alternates coordinate subdivisions as the identifier grows. Source: Wikimedia Commons, Geohash odd-even digits.'},
        'S2 models geography on the sphere. It projects the unit sphere onto six cube faces, then recursively subdivides each face into four quadrilateral children, producing a Hilbert-curve ordering that preserves locality better than geohash\'s Z-order. Cell ids are 64-bit integers encoding face, position, and level (0 to 30). S2 coverings approximate arbitrary regions (points, polylines, polygons) as sets of cells, which makes it the strongest choice when the system needs robust spherical geometry and region queries, not just point bucketing.',
        'H3 is a hierarchical grid built on an icosahedral projection, producing mostly hexagonal cells. Hexagons have a uniform neighbor distance (every neighbor center is equidistant from the cell center), which makes ring operations, flow aggregation, and heat maps more uniform than square grids. H3 supports k-ring neighbor expansion natively. The hierarchy has subtleties: H3 provides exact logical containment in its index hierarchy, but geometric containment across parent and child resolutions is approximate, and 12 pentagons per resolution introduce special cases that code must handle.',
        'A nearby search runs in two phases. First, encode the query point into a cell, fetch items in that cell and enough neighbor cells to cover the radius. Second, run exact filtering: haversine distance, polygon containment, road ETA, or product-specific ranking. The resolution controls the tradeoff. Coarse cells reduce lookup count but return many false candidates. Fine cells shrink each candidate set but may fan out across many empty cells in sparse areas. Adaptive systems start fine and expand rings until enough candidates appear or a latency budget expires.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is a filter-then-verify argument. The cell stage is a recall stage: it is allowed to over-return candidates but must not miss objects that could be correct answers. Neighbor cells, coverings, and ring expansion protect recall near boundaries. The exact pass then restores precision. As long as the cell stage covers every point within the query radius, the final answer is exact.',
        'Why is coverage guaranteed? For a point query with radius r, the system queries cells whose union covers the disk of radius r around the query point. If the cell width at the chosen resolution is w, querying the center cell plus one ring of neighbors covers at least w in every direction. By choosing resolution such that w >= r, a single ring suffices. For larger radii, more rings or coarser resolution handles the gap.',
        'The performance argument is locality. If nearby objects share cells or adjacent cells, the query touches a small fraction of the index. Doubling the total dataset by adding points in another continent does not double the cost of a local query. Cost tracks local density, cells queried, and exact checks per candidate, not global size.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Cell encoding is O(1): a fixed sequence of bit operations or lookups given (latitude, longitude, resolution). Neighbor enumeration is O(k) where k is the ring size. Candidate retrieval is O(cells queried * items per cell). The exact pass is O(candidates * cost per check), where cost per check depends on haversine (cheap) vs. road-network ETA (expensive).',
        'The main cost knobs are resolution, ring size, local density, update frequency, and exact-check price. A high-resolution cell map creates many keys with tiny sets, increasing lookup count. A low-resolution map creates hot keys with huge sets, increasing scan time. A driver-dispatch system with fast-moving objects also pays update cost every time a driver crosses a cell boundary. A places index pays mostly at ingestion time.',
        'Shape artifacts are unavoidable and differ by system. Geohash rectangles vary with latitude (a geohash cell at the equator is roughly square; at 60 degrees latitude it is twice as wide as it is tall) and have prefix discontinuities at certain boundaries. S2 cells are quadrilaterals on the sphere with more uniform area. H3 cells are mostly hexagonal but include 12 pentagon exceptions per resolution. None of these systems makes Euclidean assumptions safe on a globe.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Hierarchical cells are a good fit whenever spatial locality needs to become an ordinary database key. They work for nearby candidate retrieval (ride dispatch, food delivery, store locator), geospatial sharding (partition a global database by cell prefix so each shard handles a contiguous region), cache keys (cache nearby-search results keyed by cell id so identical-cell queries hit the cache), and demand heat maps (aggregate trip starts by H3 cell to visualize demand).',
        'They also serve rate limiting by region (throttle API calls per cell to prevent abuse from concentrated geolocations), location privacy coarsening (report user location at city-level resolution instead of exact coordinates), and distributed joins (join two datasets by cell id without transferring full geometries across the network). The same cell id can serve online lookup, offline analytics, and operational dashboards.',
        'Beyond infrastructure, cells help teams communicate about space. Instead of passing arbitrary bounding boxes between services, a product can say "resolution 9 cells", "ring 2 expansion", or "cover this polygon with S2 cells at level 12". Those names are operational contracts that make behavior testable, tunable, and comparable across services.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Cells are the wrong final answer for exact geometry. Returning all same-cell results as "nearby" without an exact distance pass produces incorrect results at every cell boundary. Using a cell boundary as a legal boundary (geofencing, jurisdiction) without explicit product acceptance of the approximation will cause errors where the cell edge does not align with the real boundary.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Comparing-Geoash-Hilbert.png/960px-Comparing-Geoash-Hilbert.png', alt: 'Comparison diagram of geohash ordering and Hilbert curve locality', caption: 'Space-filling order choices affect how well nearby cells remain near in key order. Source: Wikimedia Commons, Comparing Geohash and Hilbert.'},
        'Cells are not a replacement for R-trees. An R-tree indexes the bounding boxes of the actual objects and adapts to the data distribution. A global cell grid imposes structure before seeing the data. That is valuable for sharding and aggregation, but it creates false positives, empty-cell fanout in sparse regions, boundary misses unless neighbors are included, and hot cells in dense areas like airports or stadiums.',
        'The three cell systems are also not interchangeable. Geohash prefix ordering does not match H3 ring semantics. S2 coverings operate differently from H3 k-rings. Code written for one system cannot swap to another without rethinking the query and storage strategy. Picking the wrong system for the use case (for example, geohash for uniform-distance aggregation, or H3 for prefix range scans) creates friction that grows with the codebase.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A ride-matching service in San Francisco receives a pickup request at (37.7749, -122.4194). It encodes the point into an H3 cell at resolution 9 (roughly 100 m edge length). The cell id is, say, 8928308280fffff. The service reads available drivers from that cell in a Redis sorted set: it finds 2 drivers.',
        'Two drivers may not be enough for good dispatch, so the service expands to the k=1 ring: 6 neighbor hexagons. It finds 5 more drivers across those cells, giving 7 candidates total. In a suburban area with fewer drivers, it might expand to k=2 (12 more cells) or k=3 before hitting the latency budget of 50 ms.',
        'The 7 candidates are now filtered. The service computes road-network ETA to the pickup point (not haversine, because a driver 200 m away across a highway may take 8 minutes). It checks driver state (available, not mid-trip, not ending shift). It applies marketplace rules (fairness rotation, cancellation risk). The cell index is done: it turned 200,000 active drivers into 7 candidates in under 5 ms. The ranking pass takes the remaining 45 ms.',
        'The same resolution-9 cells serve offline analytics. The data team aggregates trip starts by H3 cell to produce hourly demand heat maps. But they use resolution 7 (roughly 1.2 km edge) for the heat map because resolution 9 is too granular for city-wide patterns. The cell hierarchy lets them switch resolution without rebuilding the pipeline.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary references: S2 Geometry at https://s2geometry.io/ and its cell hierarchy guide at https://s2geometry.io/devguide/s2cell_hierarchy.html, H3 documentation at https://h3geo.org/docs/, and Uber\'s H3 engineering blog post at https://www.uber.com/us/en/blog/h3/. For geohash specifics, the original algorithm is described at http://geohash.org/ and the Wikipedia article covers the bit-interleaving mechanics well.',
        'Study R-Tree Spatial Index next for dataset-adaptive spatial pruning where objects have extent (not just points). Study k-d Tree for point partitioning in low dimensions. Study Trie for the prefix lookup mechanics that make geohash range scans efficient. Study Sharding & Partitioning and Consistent Hashing for the distributed placement strategies that cell ids enable. Study Graph Shortest Paths to understand the gap between "nearby by cell distance" and "nearby by road-network ETA" that the exact pass must bridge.',
      ],
    },
  ],
};
