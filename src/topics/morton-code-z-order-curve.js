// Morton codes / Z-order curves interleave coordinate bits to turn multidimensional
// locality into one sortable integer or string key.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'morton-code-z-order-curve',
  title: 'Morton Codes & Z-Order Curves',
  category: 'Data Structures',
  summary: 'Interleave coordinate bits into one sortable key so nearby grid cells, map tiles, and primitives usually sit near each other in one-dimensional storage.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['interleave bits', 'spatial sort case study'], defaultValue: 'interleave bits' },
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

function zPathGraph(title) {
  return graphState({
    nodes: [
      { id: 'c0', label: '0', x: 1.2, y: 1.2, note: '00,00' },
      { id: 'c1', label: '1', x: 3.0, y: 1.2, note: '01,00' },
      { id: 'c2', label: '2', x: 1.2, y: 3.0, note: '00,01' },
      { id: 'c3', label: '3', x: 3.0, y: 3.0, note: '01,01' },
      { id: 'c4', label: '4', x: 5.2, y: 1.2, note: '10,00' },
      { id: 'c5', label: '5', x: 7.0, y: 1.2, note: '11,00' },
      { id: 'c6', label: '6', x: 5.2, y: 3.0, note: '10,01' },
      { id: 'c7', label: '7', x: 7.0, y: 3.0, note: '11,01' },
      { id: 'query', label: 'box', x: 4.2, y: 5.6, note: 'range' },
      { id: 'scan', label: 'scan', x: 7.8, y: 5.6, note: 'sorted keys' },
    ],
    edges: [
      { id: 'e0-1', from: 'c0', to: 'c1' },
      { id: 'e1-2', from: 'c1', to: 'c2' },
      { id: 'e2-3', from: 'c2', to: 'c3' },
      { id: 'e3-4', from: 'c3', to: 'c4' },
      { id: 'e4-5', from: 'c4', to: 'c5' },
      { id: 'e5-6', from: 'c5', to: 'c6' },
      { id: 'e6-7', from: 'c6', to: 'c7' },
      { id: 'e-query-scan', from: 'query', to: 'scan' },
    ],
  }, { title });
}

function pipelineGraph(title) {
  return graphState({
    nodes: [
      { id: 'points', label: 'points', x: 0.8, y: 3.4, note: 'x,y' },
      { id: 'scale', label: 'grid', x: 2.5, y: 3.4, note: 'integers' },
      { id: 'morton', label: 'Morton', x: 4.3, y: 3.4, note: 'bit mix' },
      { id: 'sort', label: 'sort', x: 6.1, y: 1.8, note: '1D key' },
      { id: 'index', label: 'B-tree', x: 6.1, y: 5.0, note: 'range scan' },
      { id: 'candidates', label: 'cands', x: 8.1, y: 3.4, note: 'near-ish' },
      { id: 'exact', label: 'exact', x: 9.5, y: 3.4, note: 'geometry' },
    ],
    edges: [
      { id: 'e-points-scale', from: 'points', to: 'scale' },
      { id: 'e-scale-morton', from: 'scale', to: 'morton' },
      { id: 'e-morton-sort', from: 'morton', to: 'sort' },
      { id: 'e-morton-index', from: 'morton', to: 'index' },
      { id: 'e-sort-candidates', from: 'sort', to: 'candidates' },
      { id: 'e-index-candidates', from: 'index', to: 'candidates' },
      { id: 'e-candidates-exact', from: 'candidates', to: 'exact' },
    ],
  }, { title });
}

function* interleaveBits() {
  yield {
    state: zPathGraph('Sorted Morton keys walk cells in Z order'),
    highlight: { active: ['c0', 'c1', 'c2', 'c3', 'e0-1', 'e1-2', 'e2-3'], found: ['c4', 'c5', 'c6', 'c7'] },
    explanation: 'A Morton code interleaves coordinate bits, then sorts cells by the resulting key. The visible result is a Z-shaped recursive walk where nearby keys usually land in nearby cells.',
    invariant: 'The key is one-dimensional, but its prefix is a spatial cell.',
  };

  yield {
    state: labelMatrix(
      'Bit interleaving creates a Morton key',
      [
        { id: 'x', label: 'x = 3' },
        { id: 'y', label: 'y = 5' },
        { id: 'z', label: 'Morton' },
      ],
      [
        { id: 'bits', label: 'bits' },
        { id: 'role', label: 'role' },
      ],
      [
        ['011', 'x slots'],
        ['101', 'y slots'],
        ['100111', 'interleaved key'],
      ],
    ),
    highlight: { active: ['x:bits', 'y:bits'], found: ['z:bits', 'z:role'] },
    explanation: 'For 2D, take one bit from y, one from x, and repeat from high to low. Grouping each pair as a base-4 digit gives the same child choices a quadtree path uses.',
  };

  yield {
    state: labelMatrix(
      'Prefix meaning',
      [
        { id: 'empty', label: 'no prefix' },
        { id: 'one', label: '1 digit' },
        { id: 'two', label: '2 digits' },
        { id: 'three', label: '3 digits' },
      ],
      [
        { id: 'region', label: 'region' },
        { id: 'use' },
      ],
      [
        ['whole grid', 'root tile'],
        ['one quadrant', 'coarse shard'],
        ['sub-quadrant', 'range scan'],
        ['fine cell', 'candidate set'],
      ],
    ),
    highlight: { active: ['one:region', 'two:use'], found: ['three:use'], compare: ['empty:region'] },
    explanation: 'The prefix property is why quadkeys, geohash-like strings, and Morton-sorted primitives are practical. A prefix names a region, and longer prefixes name smaller regions inside it.',
  };

  yield {
    state: zPathGraph('Z-order preserves locality, but not perfectly'),
    highlight: { active: ['query', 'scan', 'e-query-scan'], compare: ['c3', 'c4'], removed: ['c0'] },
    explanation: 'Morton order is cheap and prefix-friendly, but it makes jumps at block boundaries. Range queries often scan several key intervals and then run an exact spatial filter on the candidates.',
  };
}

function* spatialSortCaseStudy() {
  yield {
    state: pipelineGraph('Spatial data becomes a sortable one-dimensional key'),
    highlight: { active: ['points', 'scale', 'morton', 'e-points-scale', 'e-scale-morton'], found: ['sort', 'index'] },
    explanation: 'The pipeline quantizes coordinates to integers, interleaves their bits, and stores the result in a normal sorted structure. That is the trick: multidimensional locality becomes a one-dimensional key.',
    invariant: 'Morton sorting is a filter and layout strategy, not an exact geometry test.',
  };

  yield {
    state: labelMatrix(
      'Where Morton keys show up',
      [
        { id: 'tiles', label: 'map tiles' },
        { id: 'lake', label: 'data lake' },
        { id: 'lbvh', label: 'LBVH' },
        { id: 'voxels', label: 'voxels' },
      ],
      [
        { id: 'key', label: 'key' },
        { id: 'benefit' },
      ],
      [
        ['quadkey', 'cache + prefix'],
        ['Z-order columns', 'skip files'],
        ['sorted centroids', 'parallel build'],
        ['linear octree', 'compact traversal'],
      ],
    ),
    highlight: { active: ['tiles:key', 'lbvh:key'], found: ['lake:benefit'], compare: ['voxels:benefit'] },
    explanation: 'The same bit trick appears under different names. Quadkeys encode map-tile paths. Z-order clustering improves data skipping. Linear BVH builders sort primitive centroids by Morton code before creating hierarchy.',
  };

  yield {
    state: pipelineGraph('Range queries still need candidate repair'),
    highlight: { active: ['index', 'candidates', 'exact', 'e-index-candidates', 'e-candidates-exact'], compare: ['sort'], removed: ['points'] },
    explanation: 'A rectangle or radius query maps to one or more Morton intervals. The scan returns near-ish candidates in key order, then exact geometry checks remove cells that are close in the curve but outside the query.',
  };

  yield {
    state: labelMatrix(
      'Morton versus Hilbert',
      [
        { id: 'morton', label: 'Morton' },
        { id: 'hilbert', label: 'Hilbert' },
        { id: 'geohash', label: 'Geohash' },
        { id: 'quadkey', label: 'Quadkey' },
      ],
      [
        { id: 'strength', label: 'strength' },
        { id: 'cost' },
      ],
      [
        ['cheap bit interleave', 'more jumps'],
        ['better locality', 'harder math'],
        ['string prefix', 'earth quirks'],
        ['tile hierarchy', 'map projection'],
      ],
    ),
    highlight: { active: ['morton:strength', 'quadkey:strength'], compare: ['hilbert:cost'], found: ['geohash:strength'] },
    explanation: 'Morton order wins when speed, simplicity, and prefix hierarchy matter. Hilbert curves can preserve locality better, but their encoding is more complex and less convenient for some low-level builders.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'interleave bits') yield* interleaveBits();
  else if (view === 'spatial sort case study') yield* spatialSortCaseStudy();
  else throw new InputError('Pick a Morton-code view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'A Morton code, also called a Z-order key, converts a point on an integer grid into one sortable integer by interleaving coordinate bits. In two dimensions the key alternates bits from x and y. In three dimensions it alternates x, y, and z. Sorting by that key walks the grid in a recursive Z pattern: visit a quadrant, then its neighbor, then the quadrant below, then the diagonal child, and repeat the same rule inside each child.',
        'The point is not to compute Euclidean distance. The point is to make ordinary one-dimensional machinery behave spatially enough to be useful. Arrays can be sorted by Morton code. B-trees can index Morton prefixes. Files can be clustered by Z-order columns. GPU builders can sort triangle centroids before constructing a bounding-volume hierarchy. A Morton code is the encoding layer between multidimensional geometry and normal ordered storage.',
      ],
    },
    {
      heading: 'The real problem',
      paragraphs: [
        'Spatial data is two- or three-dimensional, but disks, indexes, cache lines, sort keys, and file names are mostly one-dimensional. If you sort points by x, points with nearby y values can be scattered across the whole file. If you sort by y, the same failure happens in x. A hash key spreads load but destroys locality. A full R-tree or quadtree may be more precise, but sometimes the system already has a sorted table, a column-store layout, a B-tree, or a GPU radix sort and needs a cheap spatial key.',
        'Morton order solves the storage mismatch by making prefixes spatial. A short prefix identifies a coarse square or cube. A longer prefix identifies a child region inside it. This gives a useful address hierarchy without building pointer-heavy tree nodes. The tradeoff is deliberate: the key preserves coarse locality and prefix grouping, but it does not promise that all nearby points are adjacent or that all adjacent keys are geometrically close.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach is to use one coordinate as the sort key and keep the other coordinate as a filter. That works for narrow queries aligned with the chosen axis, but it breaks down when the query region is two-dimensional. Nearby objects by y can be far apart in x order, and nearby objects by x can be far apart in y order.',
        'A full spatial tree solves more queries exactly, but it may be too heavy for a column store, tile cache, radix-sort pipeline, or compact GPU builder. Morton order sits in the middle: it gives the ordinary sorted system a spatial prefix without pretending to replace exact geometry.',
      ],
    },
    {
      heading: 'How the encoding works',
      paragraphs: [
        'Start by choosing a bounded integer grid. Floating-point coordinates must be scaled, rounded or floored, clamped, and sometimes biased so negative values become nonnegative grid coordinates. Then spread each coordinate bit stream apart and OR the streams together. For x = 3 and y = 5 on a three-bit grid, x is 011 and y is 101. Interleaving from high to low creates a six-bit key whose bit pairs are the successive quadtree child choices.',
        'That pair grouping explains the prefix property. In 2D, every two Morton bits choose one of four quadrants. The next two bits choose a quadrant inside that quadrant. In 3D, every three bits choose one of eight octants. A prefix is therefore not just a numeric prefix; it is a spatial cell. This is why quadkeys, linear quadtrees, linear octrees, Z-order clustering, and Morton-sorted BVH builders all feel like different faces of the same mechanism.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the interleave-bits view, read the Z path as the order produced by sorting cells by their Morton integer. The highlighted cells are not chosen by distance computation; they are chosen by bit prefix. The prefix table is the key frame: no prefix means the whole grid, one digit means a quadrant, two digits mean a subquadrant, and a full key means a fine cell.',
        'In the spatial-sort case study, follow the pipeline from raw points to grid coordinates, then to Morton keys, then to sorted storage or a B-tree, then to candidate filtering. The last geometry check is not an implementation detail. It is the correctness boundary. Morton order gives a compact candidate set and a cache-friendly layout; exact bounding-box, polygon, or distance tests still decide the answer.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The encoding works because binary coordinates already describe recursive halves. The high bit of x says left or right half. The high bit of y says bottom or top half. Put those bits together and you have a quadrant. Repeat with the next bits and you have a path down a quadtree. Morton order is just that path written as a sortable number.',
        'Sorting by the number groups records with shared high-order prefixes. That makes range partitioning, block pruning, cache prefetching, and parallel construction practical. It also gives deterministic names for spatial regions. A map tile key, a data-lake clustering key, or a linear-octree node key can be compared lexicographically or numerically while still carrying spatial meaning.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Encoding is cheap: spreading and interleaving bits can be done with masks, shifts, lookup tables, or processor-specific bit deposit instructions. The expensive parts are usually before and after the key: quantizing coordinates, sorting n objects by code, decomposing a query window into Morton intervals, and filtering false candidates. A layout pipeline is often compute codes, sort by code, store clustered records, then answer queries by scanning one or more intervals.',
        'The locality guarantee is useful but imperfect. A rectangle rarely maps to one clean interval. Cells that touch across a Z-order block boundary can be close in space but far in key order. Adjacent keys can cross visual boundaries. Hilbert curves often preserve locality better, but Morton codes are simpler, faster, easier to prefix-split, and easier to use in low-level builders that already operate on bits.',
      ],
    },
    {
      heading: 'Worked examples',
      paragraphs: [
        'In a linear-BVH builder, each triangle gets a bounding-box centroid. The centroids are quantized into a fixed grid, converted to Morton codes, and sorted. Neighboring leaves in that sorted order are likely to be spatially related, so the builder can create hierarchy from common prefixes. This is faster and more parallel than carefully testing every possible split, though the resulting tree may be lower quality than a slower surface-area heuristic build.',
        'In a map tile system, a tile at zoom z has integer x and y coordinates. Each zoom step chooses a child quadrant of the previous tile. A quadkey stores those child choices as digits, so parent and child tiles share prefixes. That makes tiles easy to cache, shard, expire by region, and fetch for a viewport. The same prefix idea appears in Z-order clustering for analytical tables, where nearby multidimensional column values are packed into the same files so scans can skip irrelevant blocks.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Do not treat Morton order as an exact nearest-neighbor index. Same prefix means same coarse cell, not nearest object. Range and radius queries need neighboring prefixes when the query crosses cell boundaries, and the returned candidates need exact geometry checks. A product search, collision detector, or map query that skips the exact check will return visibly wrong answers near boundaries.',
        'Do not let the grid be an afterthought. Coordinate range, bit depth, signed-value handling, projection, clamping, and rounding define the address space. Too few bits collapse distinct objects into the same fine cell. Too many bits can waste key space or expose precision noise. For geospatial data, Web Mercator tiles, latitude distortion, antimeridian handling, and zoom-level semantics must be decided before keys are meaningful.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: NVIDIA linear-BVH construction blog at https://developer.nvidia.com/blog/thinking-parallel-part-iii-tree-construction-gpu/, Microsoft Bing Maps tile system at https://learn.microsoft.com/en-us/bingmaps/articles/bing-maps-tile-system, Azure Maps tile-grid and quadkey notes at https://learn.microsoft.com/en-us/azure/azure-maps/zoom-levels-and-tile-grid, and Stanford bit-interleaving techniques at https://graphics.stanford.edu/~seander/bithacks.html#InterleaveTableObvious.',
        'Study Quadtree Spatial Index & Map Tiles, Bounding Volume Hierarchy, Hierarchical Geospatial Cells, R-Tree Spatial Index, k-d Tree, Spatial Hash Grid Broadphase, Rank/Select Bitvector, Elias-Fano Encoding, and Columnar Storage next.',
      ],
    },
  ],
};
