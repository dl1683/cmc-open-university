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
    explanation: `Start with one region that covers the whole space. When a leaf becomes too crowded or too mixed, split it into northwest, northeast, southwest, and southeast children — the core ${topic.title.split(' ')[0].toLowerCase()} move.`,
    invariant: `Every child covers a disjoint subregion of its parent, and the four children cover the parent region — a ${topic.category.toLowerCase()} invariant.`,
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
    explanation: `${topic.title.split(' ')[0]}s are a family, not one implementation. Point indexes split on capacity. Image ${topic.title.split(' ')[0].toLowerCase()}s split only where pixels are mixed. Tile pyramids split to a fixed zoom depth whether or not a tile has objects.`,
  };

  yield {
    state: quadtreeGraph('Search prunes quadrants that cannot intersect the query'),
    highlight: { active: ['query', 'se', 'hits', 'e-query-se', 'e-query-hits'], removed: ['nw', 'sw'], compare: ['ne1', 'ne2'] },
    explanation: `A range query compares the query box with ${topic.title.split(' ')[0].toLowerCase()} quadrant bounds. Non-intersecting leaves are skipped. Intersecting leaves produce candidates, and the final geometry check removes false positives.`,
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
    explanation: `An R-tree groups the object rectangles that exist. A ${topic.title.split(' ')[0].toLowerCase()} divides the coordinate space itself. That distinction matters when space is sparse, when data is raster-like, or when a stable tile ID is the product interface.`,
  };
}

function* mapTilePyramid() {
  yield {
    state: tileGraph('A web map tile pyramid is a complete quadtree by zoom level'),
    highlight: { active: ['z0', 'z1', 'z2', 'e-z0-z1', 'e-z0-z2'], found: ['xyz'] },
    explanation: `At zoom 0 the world is one tile. Each zoom step splits every tile into four children, so zoom z has ${2}^z tiles across and ${2}^z tiles down — the ${topic.title.split('&')[1].trim().toLowerCase()} pyramid.`,
    invariant: `Tile zoom is ${topic.title.split(' ')[0].toLowerCase()} depth; x and y select the child path at that depth.`,
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
    explanation: `Slippy maps usually request tiles as z/x/y image URLs. Bing-style quadkeys encode the same ${topic.title.split(' ')[0].toLowerCase()} child choices as a string, which is convenient as a database or cache key.`,
  };

  yield {
    state: tileGraph('Viewport rendering fetches only visible tiles'),
    highlight: { active: ['xyz', 'cache', 'view', 'e-xyz-cache', 'e-cache-view'], compare: ['quadkey'] },
    explanation: `A map viewport calculates the z/x/y range that overlaps the screen, asks cache or CDN for those tiles, and reuses already-loaded tiles while panning. The ${topic.title.split(' ')[0].toLowerCase()} hierarchy makes zoom and pan local operations.`,
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
    explanation: `The ${topic.category.toLowerCase()} is only the skeleton. Product systems still choose raster versus vector tiles, cache expiration, attribution, overscaling rules, and how to simplify geometry at each zoom.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as the execution trace for Quadtree Spatial Index & Map Tiles. Recursively split 2D space into four quadrants, stop when leaves are simple enough, and reuse the hierarchy for sparse search and zoomable map tiles.',
        {type: 'callout', text: 'A quadtree is a spatial proof tree: each skipped child is skipped because its rectangle cannot affect the query.'},
        'Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.',
        'Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.',
        'At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.',
      
        {type: 'image', src: './assets/gifs/quadtree-spatial-index-map-tiles.gif', alt: 'Animated walkthrough of the quadtree spatial index map tiles visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A quadtree is a tree whose nodes are rectangles in two-dimensional space. The root covers the whole region, and each internal node splits into northwest, northeast, southwest, and southeast children.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Quad_tree_bitmap.svg/500px-Quad_tree_bitmap.svg.png', alt: 'Bitmap image and compressed quadtree representation', caption: 'A region quadtree spends nodes only where the bitmap changes, which is the same adaptive-detail idea used in spatial indexes. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Quad_tree_bitmap.svg.'},
        'It exists because spatial detail is uneven. A city has dense streets and empty water, a game map has crowded rooms and blank walls, and an image has sharp edges beside flat regions.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a flat list. To find every object in a viewport, scan every object and test whether it intersects the query rectangle.',
        'A uniform grid is the next attempt. It works when density is steady, but the cell size becomes a hard bet: small cells waste empty space, and large cells overload dense regions.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is uneven density. The structure must describe empty regions cheaply while still giving detailed addresses for crowded areas.',
        'Map tiles add a zoom wall. A browser should fetch only the tiles visible in the viewport at the current zoom, not one enormous world image.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to divide space, not objects. Every child rectangle is disjoint from its siblings, and the four children exactly cover their parent.',
        'That invariant makes pruning safe. If a query rectangle does not intersect a node rectangle, no object stored only inside that subtree can answer the query.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Insertion starts at the root. If the leaf has room, store the object there; if it exceeds capacity and depth allows, split the leaf and redistribute objects into children.',
        'Range search does the opposite. Test the query rectangle against a node; skip nonintersecting nodes, descend into intersecting internal nodes, and exactly test payloads in intersecting leaves.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Four-level_Z.svg/330px-Four-level_Z.svg.png', alt: 'Four levels of a Z-order curve through quadrants', caption: 'Z-order follows the same recursive quadrant choices that quadkeys encode for tile paths. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Four-level_Z.svg.'},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is geometric. A skipped subtree is skipped only after its rectangle is proven disjoint from the query rectangle.',
        'Any returned candidate still needs the exact domain check. The quadtree proves which regions can be ignored; it does not replace geometry for the objects that remain.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Balanced sparse data gives fast queries because most rectangles are rejected high in the tree. A query that touches a small viewport visits only the branches whose bounds overlap it.',
        'Worst cases are real. Repeated points, adversarial coordinates, huge objects crossing many cells, or missing depth limits can create deep trees and heavy duplication.',
        'Map tile pyramids have predictable addressing. At zoom z, there are 2^z tiles across and 2^z tiles down, so zoom 10 has 1,048,576 possible tile positions.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Quadtrees fit 2D range search, broad-phase collision culling, sparse heatmaps, image compression, occupancy maps, terrain level of detail, and map tile addressing. They win when rectangular rejection removes large parts of the search.',
        'A web map tile pyramid is a complete quadtree by zoom level. Tile URLs such as z/x/y and quadkeys turn a spatial path into a cache key.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A quadtree is not automatically balanced. It follows the data, so clustered or repeated coordinates can drive depth unless the implementation uses buckets and a maximum depth.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/5/54/Euclidean_Voronoi_diagram.svg', alt: 'Voronoi cells around nearest points in a plane', caption: 'Nearest-neighbor geometry has different failure modes from rectangular subdivision; a quadtree is not a universal spatial answer. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Euclidean_Voronoi_diagram.svg.'},
        'It is also not a universal spatial index. R-trees often fit moving rectangles better, spatial hashes can be simpler for dynamic games, and high-dimensional nearest-neighbor search needs different structures.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a 1024 by 1024 game map stores enemies and each leaf may hold 8 objects. A downtown room with 80 enemies splits, while an empty courtyard remains one large leaf.',
        'A 64 by 64 viewport query intersects only a few branches. If the root split rejects two quadrants and the next split rejects three more children, the search has skipped 75 percent of the top-level space before testing any enemy.',
        'The answer is still exact. Every skipped rectangle is disjoint from the viewport, and every remaining enemy is checked against the viewport before display.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Hanan Samet\'s quadtree surveys, OpenStreetMap slippy map tile documentation, and Microsoft Bing Maps tile system documentation for quadkeys. Then study R-trees, k-d trees, bounding volume hierarchies, spatial hash grids, geohash, S2 cells, H3 cells, and flat-scan test oracles for spatial indexes.',
      ],
    },
  ],
};
