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
      heading: 'What it is',
      paragraphs: [
        'A quadtree is a tree for two-dimensional space. Each internal node has four children, usually named northwest, northeast, southwest, and southeast. Instead of sorting records by one key, the structure recursively partitions a region into smaller rectangular regions. A leaf stores points, objects, pixels, aggregate values, or tile metadata for its own subregion.',
        'This topic builds on R-Tree Spatial Index, Hierarchical Geospatial Cells, Recursion, and Tree Traversals. R-trees organize the object boxes in a dataset. Quadtrees organize the coordinate space itself. That makes them especially natural for sparse maps, image compression, collision broad phases, occupancy grids, terrain, and zoomable map tile pyramids.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The recursive rule is simple: inspect a region, decide whether the leaf is simple enough, and otherwise split it into four children. Point quadtrees often split when a bucket exceeds a capacity. Region quadtrees split when a raster block is not uniform. Map tile pyramids split every tile at every zoom level, creating a complete quadtree even if some tiles have no interesting objects.',
        'Search uses bounds. A range query descends into children whose rectangles intersect the query window and skips the rest. A nearest-object query can visit promising cells first and prune cells whose minimum possible distance is already worse than the best candidate. As with R-trees and geospatial cells, the quadtree is a candidate generator; exact geometry or distance checks still decide the answer.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Quadtrees are excellent when space is sparse or clustered, but they can become deep when points are extremely close together. Practical implementations set max depth, bucket capacity, and sometimes minimum cell size. A badly chosen depth wastes memory on empty cells or forces too many objects into one leaf. Insert and delete logic must also handle rebalancing or lazy cleanup if the workload is dynamic.',
        'The comparison with other indexes is workload-specific. k-d trees split by point coordinates and are common for point nearest-neighbor search. R-trees group bounding boxes and work well for rectangles and polygons. Geohash, S2, and H3 use global cell IDs that are convenient for sharding and aggregation. Quadtrees sit between those ideas: local recursive decomposition with a very direct spatial interpretation.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A slippy web map is the everyday quadtree case study. At zoom 0, the map has one tile. At zoom 1, that tile splits into four. At zoom z, the grid has 2^z by 2^z tiles, and a viewport requests only the z/x/y tiles that overlap the screen. Panning changes a small band of tiles. Zooming swaps to parent or child tiles. The hierarchy turns a planet-sized map into cacheable rectangular images or vector payloads.',
        'Bing Maps quadkeys encode the child choices along that path as a string. The same tile can be addressed as z/x/y coordinates or as a quadkey. That string is useful as a database, file, or CDN key because nearby tiles often share prefixes. The application still has hard product choices: raster tiles versus vector tiles, geometry simplification by zoom, cache invalidation after map edits, attribution, and how to handle tile seams.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The main misconception is that a quadtree automatically means balanced or compact. It does not. If many points cluster in a tiny region, repeated quadrant splits can produce a long skinny path. Production indexes cap depth, store multiple objects per leaf, bulk-load static data, or switch to another spatial index when the distribution is hostile.',
        'Another mistake is treating tile coordinates as exact geography. Web map tiles are a rendering and caching scheme. They are extremely useful for display, but exact distance, route time, polygon containment, and search ranking still need geometry algorithms and domain-specific logic outside the tile pyramid.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: OpenStreetMap slippy map tilenames at https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames, Microsoft Bing Maps tile system and quadkeys at https://learn.microsoft.com/en-us/bingmaps/articles/bing-maps-tile-system, and Hanan Samet quadtree survey at https://www.cs.umd.edu/~hjs/pubs/SameCSUR84-ocr.pdf. Study R-Tree Spatial Index, k-d Tree, Hierarchical Geospatial Cells, Delaunay Triangulation & Voronoi Dual, Trie, Recursion, and Tree Traversals next.',
      ],
    },
  ],
};
