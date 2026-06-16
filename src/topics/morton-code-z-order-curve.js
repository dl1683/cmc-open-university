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
      heading: 'What it is',
      paragraphs: [
        'A Morton code, also called Z-order, turns multidimensional integer coordinates into one sortable key by interleaving their bits. In 2D, the key alternates bits from x and y. In 3D, it interleaves x, y, and z. Sorting by that key traces a Z-shaped recursive walk through the grid, so points that share a prefix usually occupy the same coarse spatial region.',
        'This topic builds on Quadtree Spatial Index & Map Tiles, Hierarchical Geospatial Cells, Bounding Volume Hierarchy, Rank/Select Bitvector, and Elias-Fano Encoding. It is the encoding layer that lets normal arrays, B-trees, files, and GPU sort pipelines carry spatial locality without becoming full spatial indexes by themselves.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'First quantize coordinates onto an integer grid. Then spread the bits of each coordinate so there is space between them, and OR the shifted bit streams together. The resulting integer can be compared, sorted, range-partitioned, stored in a B-tree, or used as a prefix key. Grouping every pair of 2D interleaved bits as a base-4 digit gives a quadtree path; this is why quadkeys feel like string versions of the same idea.',
        'The prefix property is the key concept. A short prefix names a coarse cell. A longer prefix names a child cell inside it. This lets a storage engine cluster nearby records, lets a map tile cache use stable region keys, and lets a BVH builder sort primitive centroids so neighboring primitives become neighboring leaves.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Morton encoding is fast because it is bit manipulation. The expensive parts are usually quantization, sorting, range decomposition, and exact filtering. For n objects, a common layout pipeline is compute n codes, sort by code, then scan or build a hierarchy over the sorted order. Querying a rectangle is not always one contiguous interval, so production systems often split the query into multiple prefixes or intervals and verify candidates geometrically.',
        'Locality is strong but imperfect. Nearby points often have nearby codes, but points across a Z-order jump can be close in space and far in key order, while some adjacent keys can straddle a visual boundary. Hilbert curves often preserve locality better, but Morton codes are simpler, faster, and map directly to quadtree or octree prefixes.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A GPU linear-BVH builder can compute a bounding-box centroid for every triangle, quantize that centroid into a grid, compute a Morton code, sort triangles by code, and construct tree nodes over the sorted leaves. This reduces part of BVH construction to parallel sorting plus local prefix analysis. The final tree is not as carefully optimized as a slow SAH build, but it can be rebuilt quickly enough for dynamic scenes.',
        'A map system uses the same logic at the product layer. Tile x and y at a zoom level encode a path through the quadtree. A quadkey stores that path as digits, so parent and child tiles share prefixes. A CDN, database, or file layout can use those prefixes to group neighboring tiles, expire a region, or fetch a viewport with a small set of stable keys.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The common mistake is treating Morton order as an exact nearest-neighbor structure. It is a layout and filtering strategy. Same prefix means likely nearby, not guaranteed nearest. A query must still include neighboring prefixes when needed and run exact distance, polygon, or bounding-box tests before returning user-visible results.',
        'Another mistake is using raw floating-point values directly. Morton codes require a deliberate grid: coordinate range, resolution, signed-value handling, and clamping all affect correctness. For geospatial data, projection and latitude distortion also matter, which is why map systems define tile schemes before assigning keys.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: NVIDIA linear-BVH construction blog at https://developer.nvidia.com/blog/thinking-parallel-part-iii-tree-construction-gpu/, Microsoft Bing Maps tile system at https://learn.microsoft.com/en-us/bingmaps/articles/bing-maps-tile-system, Azure Maps tile-grid and quadkey notes at https://learn.microsoft.com/en-us/azure/azure-maps/zoom-levels-and-tile-grid, and Stanford bit-interleaving techniques at https://graphics.stanford.edu/~seander/bithacks.html#InterleaveTableObvious. Study Quadtree Spatial Index & Map Tiles, Bounding Volume Hierarchy, Hierarchical Geospatial Cells, Rank/Select Bitvector, and Elias-Fano Encoding next.',
      ],
    },
  ],
};
