// Quadtrees recursively divide 2D space into four child regions. The same
// hierarchy explains spatial search, image compression, collision broad phase,
// and web-map tile pyramids.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'quadtree-spatial-index-map-tiles',
  title: 'Quadtree Spatial Index & Map Tiles',
  category: 'Data Structures',
  summary: 'Recursively split 2D space into four quadrants, stop when leaves are simple enough, and reuse the hierarchy for sparse search and zoomable map tiles.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['subdivide space', 'map tile pyramid'], defaultValue: 'subdivide space' },
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

function quadtreeGraph(title) {
  return graphState({
    nodes: [
      { id: 'world', label: 'world', x: 4.8, y: 0.8, note: 'root cell' },
      { id: 'nw', label: 'NW', x: 1.8, y: 2.8, note: 'few pts' },
      { id: 'ne', label: 'NE', x: 4.0, y: 2.8, note: 'dense' },
      { id: 'sw', label: 'SW', x: 6.2, y: 2.8, note: 'empty' },
      { id: 'se', label: 'SE', x: 8.4, y: 2.8, note: 'mixed' },
      { id: 'ne1', label: 'NE.1', x: 3.1, y: 5.2, note: 'leaf' },
      { id: 'ne2', label: 'NE.2', x: 4.9, y: 5.2, note: 'leaf' },
      { id: 'query', label: 'query', x: 6.6, y: 5.8, note: 'box' },
      { id: 'hits', label: 'hits', x: 8.5, y: 5.8, note: 'candidates' },
    ],
    edges: [
      { id: 'e-world-nw', from: 'world', to: 'nw' },
      { id: 'e-world-ne', from: 'world', to: 'ne' },
      { id: 'e-world-sw', from: 'world', to: 'sw' },
      { id: 'e-world-se', from: 'world', to: 'se' },
      { id: 'e-ne-ne1', from: 'ne', to: 'ne1' },
      { id: 'e-ne-ne2', from: 'ne', to: 'ne2' },
      { id: 'e-query-se', from: 'query', to: 'se' },
      { id: 'e-query-hits', from: 'query', to: 'hits' },
    ],
  }, { title });
}

function tileGraph(title) {
  return graphState({
    nodes: [
      { id: 'z0', label: 'z0', x: 0.8, y: 3.3, note: '1 tile' },
      { id: 'z1', label: 'z1', x: 2.6, y: 1.8, note: '4 tiles' },
      { id: 'z2', label: 'z2', x: 2.6, y: 4.8, note: '16 tiles' },
      { id: 'xyz', label: 'x/y/z', x: 4.7, y: 3.3, note: 'slippy' },
      { id: 'quadkey', label: 'quadkey', x: 6.7, y: 1.8, note: 'digits' },
      { id: 'cache', label: 'cache', x: 6.7, y: 4.8, note: 'CDN key' },
      { id: 'view', label: 'viewport', x: 8.8, y: 3.3, note: 'visible tiles' },
    ],
    edges: [
      { id: 'e-z0-z1', from: 'z0', to: 'z1' },
      { id: 'e-z0-z2', from: 'z0', to: 'z2' },
      { id: 'e-z1-xyz', from: 'z1', to: 'xyz' },
      { id: 'e-z2-xyz', from: 'z2', to: 'xyz' },
      { id: 'e-xyz-quadkey', from: 'xyz', to: 'quadkey' },
      { id: 'e-xyz-cache', from: 'xyz', to: 'cache' },
      { id: 'e-cache-view', from: 'cache', to: 'view' },
      { id: 'e-quadkey-view', from: 'quadkey', to: 'view' },
    ],
  }, { title });
}

function* subdivideSpace() {
  yield {
    state: quadtreeGraph('A quadtree splits a 2D region into four quadrants'),
    highlight: { active: ['world', 'nw', 'ne', 'sw', 'se', 'e-world-nw', 'e-world-ne', 'e-world-sw', 'e-world-se'], compare: ['query', 'hits'] },
    explanation: 'Start with one region that covers the whole space. When a leaf becomes too crowded or too mixed, split it into northwest, northeast, southwest, and southeast children.',
    invariant: 'Every child covers a disjoint subregion of its parent, and the four children cover the parent region.',
  };

  yield {
    state: labelMatrix(
      'Common split and stop rules',
      [
        { id: 'empty', label: 'empty leaf' },
        { id: 'capacity', label: 'capacity hit' },
        { id: 'uniform', label: 'uniform pixels' },
        { id: 'depth', label: 'max depth' },
      ],
      [
        { id: 'condition', label: 'condition' },
        { id: 'action', label: 'action' },
      ],
      [
        ['no objects', 'keep leaf'],
        ['too many points', 'split'],
        ['same value', 'compress'],
        ['precision limit', 'stop'],
      ],
    ),
    highlight: { active: ['capacity:condition', 'capacity:action'], found: ['uniform:action'], compare: ['depth:action'] },
    explanation: 'Quadtrees are a family, not one implementation. Point indexes split on capacity. Image quadtrees split only where pixels are mixed. Tile pyramids split to a fixed zoom depth whether or not a tile has objects.',
  };

  yield {
    state: quadtreeGraph('Search prunes quadrants that cannot intersect the query'),
    highlight: { active: ['query', 'se', 'hits', 'e-query-se', 'e-query-hits'], removed: ['nw', 'sw'], compare: ['ne1', 'ne2'] },
    explanation: 'A range query compares the query box with quadrant bounds. Non-intersecting leaves are skipped. Intersecting leaves produce candidates, and the final geometry check removes false positives.',
  };

  yield {
    state: labelMatrix(
      'Quadtree versus nearby spatial indexes',
      [
        { id: 'quad', label: 'quadtree' },
        { id: 'rtree', label: 'R-tree' },
        { id: 'kd', label: 'k-d tree' },
        { id: 'cells', label: 'global cells' },
      ],
      [
        { id: 'organizes', label: 'organizes' },
        { id: 'bestFor', label: 'best for' },
      ],
      [
        ['space cells', 'sparse 2D regions'],
        ['object boxes', 'dynamic geometry'],
        ['split points', 'nearest points'],
        ['fixed global IDs', 'sharding + aggregation'],
      ],
    ),
    highlight: { active: ['quad:organizes', 'quad:bestFor'], compare: ['rtree:organizes', 'cells:organizes'] },
    explanation: 'An R-tree groups the object rectangles that exist. A quadtree divides the coordinate space itself. That distinction matters when space is sparse, when data is raster-like, or when a stable tile ID is the product interface.',
  };
}

function* mapTilePyramid() {
  yield {
    state: tileGraph('A web map tile pyramid is a complete quadtree by zoom level'),
    highlight: { active: ['z0', 'z1', 'z2', 'e-z0-z1', 'e-z0-z2'], found: ['xyz'] },
    explanation: 'At zoom 0 the world is one tile. Each zoom step splits every tile into four children, so zoom z has 2^z tiles across and 2^z tiles down.',
    invariant: 'Tile zoom is quadtree depth; x and y select the child path at that depth.',
  };

  yield {
    state: labelMatrix(
      'Tile address example',
      [
        { id: 'z0', label: 'zoom 0' },
        { id: 'z1', label: 'zoom 1' },
        { id: 'z2', label: 'zoom 2' },
        { id: 'path', label: 'path' },
      ],
      [
        { id: 'grid', label: 'grid' },
        { id: 'address', label: 'address' },
      ],
      [
        ['1 x 1', '0/0/0'],
        ['2 x 2', '1/x/y'],
        ['4 x 4', '2/x/y'],
        ['child digits', 'quadkey'],
      ],
    ),
    highlight: { active: ['z2:grid', 'z2:address'], found: ['path:address'] },
    explanation: 'Slippy maps usually request tiles as z/x/y image URLs. Bing-style quadkeys encode the same child choices as a string, which is convenient as a database or cache key.',
  };

  yield {
    state: tileGraph('Viewport rendering fetches only visible tiles'),
    highlight: { active: ['xyz', 'cache', 'view', 'e-xyz-cache', 'e-cache-view'], compare: ['quadkey'] },
    explanation: 'A map viewport calculates the z/x/y range that overlaps the screen, asks cache or CDN for those tiles, and reuses already-loaded tiles while panning. The quadtree hierarchy makes zoom and pan local operations.',
  };

  yield {
    state: labelMatrix(
      'Production tile tradeoffs',
      [
        { id: 'raster', label: 'raster tile' },
        { id: 'vector', label: 'vector tile' },
        { id: 'overscale', label: 'overscale' },
        { id: 'cache', label: 'cache key' },
      ],
      [
        { id: 'helps', label: 'helps' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['cheap draw', 'many styles'],
        ['client styling', 'larger decode'],
        ['fewer levels', 'blur/detail loss'],
        ['stable URL', 'invalidation'],
      ],
    ),
    highlight: { active: ['cache:helps', 'cache:cost'], found: ['vector:helps'], compare: ['overscale:cost'] },
    explanation: 'The data structure is only the skeleton. Product systems still choose raster versus vector tiles, cache expiration, attribution, overscaling rules, and how to simplify geometry at each zoom.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'subdivide space') yield* subdivideSpace();
  else if (view === 'map tile pyramid') yield* mapTilePyramid();
  else throw new InputError('Pick a quadtree view.');
}

export const article = {
  sections: [
    {
      heading: 'The problem',
      paragraphs: [
        'A quadtree is a tree whose nodes represent regions of a two-dimensional space. The root represents the whole world, image, game board, or map extent. Each internal node splits its rectangle into four child rectangles, usually named northwest, northeast, southwest, and southeast. Leaves hold the actual payload for their regions: points, object references, pixels, occupancy values, tile metadata, or summary statistics.',
        'The structure exists because spatial data is rarely uniform. A city map has dense downtown streets and empty ocean. A game level has crowded rooms and blank walls. A satellite image has smooth fields and detailed urban blocks. One fixed grid either wastes memory on empty regions or loses detail in crowded regions. A quadtree lets the representation spend detail where the data demands detail.',
      ],
    },
    {
      heading: 'The naive approaches',
      paragraphs: [
        'The first naive approach is a flat list. To find every restaurant in a viewport, every collision candidate in a rectangle, or every pixel block that differs from its neighbor, scan every object and test it. This is simple and exact, but it becomes linear in the whole dataset. It ignores the fact that most objects are obviously outside a small query window.',
        'The second naive approach is a uniform grid. A grid is much better than a flat list when density is steady, but it has a hard resolution choice. Small cells make empty regions expensive. Large cells make dense regions overloaded. If the data changes scale from one area to another, the grid has no way to adapt except by using many levels, which is the direction that leads to a quadtree.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is uneven spatial detail. The index needs to describe both broad empty areas and small dense areas without paying the same price for both. It also needs to reject unrelated regions cheaply. A query for a downtown viewport should not inspect rural tiles. A collision pass for one room should not inspect objects on the other side of the map.',
        'There is a second wall in map rendering: zoom. A world map cannot be one huge image sent to every browser. Users pan and zoom through small viewports, and the renderer needs only the tiles that overlap the screen at the chosen zoom level. The data structure has to support local replacement: swap parent tiles for child tiles on zoom-in, reuse neighboring tiles on pan, and cache stable tile addresses.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is to divide space, not the objects. A quadtree chooses a region, asks whether that region is simple enough, and either stores it as a leaf or splits it into four child regions. The split is geometric and deterministic. Every child covers a disjoint quarter of the parent, and the four children exactly cover the parent rectangle.',
        'That invariant gives the structure its power. A query can compare its own rectangle with a node rectangle. If they do not intersect, the entire subtree is irrelevant. If they do intersect, the search descends only into the possible children. The same rule works for points, rectangles, pixels, occupancy grids, and map tiles, although each use case chooses a different stopping condition.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'Insertion into a point quadtree starts at the root. If the current leaf has room, store the point there. If the leaf exceeds capacity and the maximum depth has not been reached, split the leaf into four children and redistribute its points by quadrant. Future inserts descend according to coordinates. Production variants usually keep a small bucket in each leaf rather than forcing one point per node.',
        'Range search is the mirror operation. Start at the root with a query rectangle. If the query misses the node rectangle, return immediately. If the node is a leaf and intersects the query, test the leaf payload exactly. If the node has children, repeat the same intersection test on each child. The quadtree does not replace exact geometry checks; it reduces the candidate set that reaches them.',
      ],
    },
    {
      heading: 'Stop rules',
      paragraphs: [
        'A quadtree is a family of structures, not one fixed implementation. A point index may split when a leaf contains more than eight objects. An image compression quadtree may split only when the pixels inside a block are not uniform enough. An occupancy grid may split when sensor evidence inside a cell is mixed. A map tile pyramid may split all tiles down to a configured zoom whether or not a tile contains interesting objects.',
        'Stop rules are correctness and performance decisions. A max depth prevents infinite subdivision when many points have nearly identical coordinates. A bucket capacity prevents pathologically tiny leaves. A minimum cell size makes the index match the precision of the data. Without those limits, a quadtree can become deep, memory-heavy, and slower than the flat list it was meant to replace.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a delivery app stores courier positions in a 1024 by 1024 city square. The root covers the whole city. A quiet suburb leaf contains three couriers and stays unsplit. Downtown contains hundreds, so it splits into four quadrants. The northeast downtown quadrant is still crowded, so it splits again. After a few levels, each busy block has a small leaf bucket while empty parks and water remain large leaves.',
        'Now the app asks for couriers inside a 60 by 60 viewport. The search starts at the root, rejects any top-level quadrant that does not intersect the viewport, descends through the overlapping downtown branch, and finally tests only the courier points in intersecting leaves. The answer is still exact because every skipped subtree is geometrically disjoint from the viewport.',
      ],
    },
    {
      heading: 'Map tiles',
      paragraphs: [
        'A web map tile pyramid is a complete quadtree organized by zoom level. At zoom 0, the whole world is one tile. At zoom 1, it becomes a 2 by 2 grid. At zoom z, it becomes a 2^z by 2^z grid. A tile address such as z/x/y says which depth to use and which column and row to fetch at that depth.',
        'Quadkeys encode the same path as a string of child choices. Each digit records which quadrant was selected at the next zoom level. That makes prefixes meaningful: nearby or ancestor-descendant tiles share address prefixes. The property is useful for caches, databases, object storage, and CDN keys because the spatial hierarchy is present in the key itself.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'The subdivide view shows the most important invariant: the parent region is replaced by four children whose coverage is complete and non-overlapping. The active nodes are not just boxes on a diagram; they are the only regions that can still matter to the current insertion or query. Removed regions are safe to ignore because their bounds cannot intersect the query.',
        'The map tile view shows the same structure in product form. Zoom is tree depth. The viewport is a query rectangle. The cache key is a path through the tree. When the viewport moves, most old tiles remain valid and only a strip of new tiles must be fetched. When the zoom changes, parent and child tiles replace one another in a controlled way.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The best-case behavior is excellent on sparse or clustered data: queries visit a small number of relevant cells instead of every object. The worst case is less pleasant. If many objects lie very close together, subdivision can create a long branch. If large objects span many cells, they may need references in multiple leaves or a separate overflow policy. If the workload changes constantly, split and merge maintenance costs matter.',
        'Memory cost depends on how many internal nodes and empty leaves the implementation materializes. A sparse pointer-based quadtree allocates only nodes that exist, which is good for irregular data. A complete tile pyramid has predictable addresses but many possible cells, so storage systems usually materialize only generated tiles and let missing tiles be cache misses or inherited from lower detail.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Quadtrees win when the data is two-dimensional, the coordinate space is meaningful, and density varies across the plane. They are strong for map viewports, broad-phase collision culling, image compression, terrain level of detail, occupancy maps, sparse heatmaps, and any system where rectangular rejection removes large parts of the search.',
        'They are also easy to explain and debug. A bounding box either intersects another bounding box or it does not. That direct geometry makes quadtrees useful educationally before moving to R-trees, BVHs, k-d trees, geohashes, S2 cells, H3 cells, or more specialized spatial databases.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A quadtree is not automatically balanced. It follows data distribution. Highly clustered points, adversarial coordinates, or repeated points can drive depth up unless the implementation caps depth or keeps buckets. It is also not ideal for high-dimensional nearest-neighbor search; the four-way spatial split is specific to two dimensions.',
        'For moving objects, repeated delete and insert operations can churn. Many engines use loose quadtrees, spatial hash grids, sweep-and-prune, or dynamic AABB trees for moving collision objects. For complex polygons and rectangles, an R-tree may be a better fit because it groups object bounds rather than forcing every object into fixed quadrant cells.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Common failures include using too small a bucket capacity, forgetting max depth, treating objects on quadrant boundaries inconsistently, duplicating large objects into too many leaves, and relying on the index result without the final exact geometry check. The index should produce candidates; the domain logic should still prove the result.',
        'Map tile systems add their own failures. Tiles can show seams if neighboring tiles simplify geometry differently. Cache invalidation can serve old roads beside new roads. Different projections distort area and distance. Tile coordinates are a display and caching convention, not a replacement for precise geodesic calculations.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study R-Tree Spatial Index next to see the alternative of grouping object rectangles instead of dividing space. Study k-d Tree for axis-aligned point splitting, Hierarchical Geospatial Cells for global cell identifiers, Bounding Volume Hierarchy for ray tracing and collision culling, and Spatial Hash Grid Broadphase for a simpler dynamic-object baseline.',
        'Primary references worth reading are Hanan Samet survey work on quadtrees, OpenStreetMap slippy map tile documentation, and Microsoft Bing Maps tile system documentation for quadkeys. After those, implement a small quadtree with bucket capacity, max depth, rectangle search, and a test that compares every query against a slow flat scan.',
      ],
    },
  ],
};
