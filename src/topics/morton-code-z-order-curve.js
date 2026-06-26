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
  const cellCount = 8;
  yield {
    state: zPathGraph('Sorted Morton keys walk cells in Z order'),
    highlight: { active: ['c0', 'c1', 'c2', 'c3', 'e0-1', 'e1-2', 'e2-3'], found: ['c4', 'c5', 'c6', 'c7'] },
    explanation: `A Morton code interleaves coordinate bits, then sorts ${cellCount} cells by the resulting key. The visible result is a Z-shaped recursive walk where nearby keys usually land in nearby cells.`,
    invariant: `The key is one-dimensional, but its prefix is a spatial cell among ${cellCount} grid positions.`,
  };

  const x = 3;
  const y = 5;
  const dims = 2;
  yield {
    state: labelMatrix(
      'Bit interleaving creates a Morton key',
      [
        { id: 'x', label: `x = ${x}` },
        { id: 'y', label: `y = ${y}` },
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
    explanation: `For ${dims}D, take one bit from y (${y} = 101), one from x (${x} = 011), and repeat from high to low. Grouping each pair as a base-4 digit gives the same child choices a quadtree path uses.`,
  };

  const prefixLevels = 4;
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
    explanation: `Across ${prefixLevels} prefix depths, the prefix property is why quadkeys, geohash-like strings, and Morton-sorted primitives are practical. A prefix names a region, and longer prefixes name smaller regions inside it.`,
  };

  yield {
    state: zPathGraph('Z-order preserves locality, but not perfectly'),
    highlight: { active: ['query', 'scan', 'e-query-scan'], compare: ['c3', 'c4'], removed: ['c0'] },
    explanation: `Morton order is cheap and prefix-friendly, but it makes jumps at block boundaries across the ${cellCount}-cell grid. Range queries often scan several key intervals and then run an exact spatial filter on the candidates.`,
  };
}

function* spatialSortCaseStudy() {
  const pipelineSteps = 7;
  yield {
    state: pipelineGraph('Spatial data becomes a sortable one-dimensional key'),
    highlight: { active: ['points', 'scale', 'morton', 'e-points-scale', 'e-scale-morton'], found: ['sort', 'index'] },
    explanation: `The ${pipelineSteps}-stage pipeline quantizes coordinates to integers, interleaves their bits, and stores the result in a normal sorted structure. That is the trick: multidimensional locality becomes a one-dimensional key.`,
    invariant: `Morton sorting is a filter and layout strategy, not an exact geometry test.`,
  };

  const applicationCount = 4;
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
    explanation: `Across ${applicationCount} domains, the same bit trick appears under different names. Quadkeys encode map-tile paths. Z-order clustering improves data skipping. Linear BVH builders sort primitive centroids by Morton code before creating hierarchy.`,
  };

  yield {
    state: pipelineGraph('Range queries still need candidate repair'),
    highlight: { active: ['index', 'candidates', 'exact', 'e-index-candidates', 'e-candidates-exact'], compare: ['sort'], removed: ['points'] },
    explanation: `A rectangle or radius query maps to one or more Morton intervals. The scan returns near-ish candidates in key order, then exact geometry checks remove cells that are close in the curve but outside the query.`,
  };

  const curveCount = 4;
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
    explanation: `Comparing ${curveCount} space-filling schemes, Morton order wins when speed, simplicity, and prefix hierarchy matter. Hilbert curves can preserve locality better, but their encoding is more complex and less convenient for some low-level builders.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        {type: 'image', src: './assets/gifs/morton-code-z-order-curve.gif', alt: 'Animated walkthrough of the morton code z order curve visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'Read the grid as integer coordinates being turned into one sortable key. Active cells show the current point or bit group, and found cells show the Z-order position implied by the interleaved bits.',
        'The safe inference rule is prefix locality. Points with the same high-order Morton prefix share a coarse quadrant, even though Morton order is not an exact distance metric.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type: 'callout', text: 'A Morton key is a quadtree path encoded as a sortable integer.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Four-level_Z.svg/330px-Four-level_Z.svg.png', alt: 'Four iterations of the Z-order curve', caption: 'Z-order recursively visits quadrants in the same prefix pattern that Morton bits encode. Source: Wikimedia Commons, David Eppstein, public domain.'},
        'Spatial data has two or more coordinates, but files, sorted arrays, B-trees, and cache lines are mostly one-dimensional. A Morton code, also called Z-order, maps grid coordinates to one integer while preserving useful coarse locality.',
        'The goal is not exact nearest-neighbor search. The goal is to let ordinary sorted storage group nearby regions well enough that exact geometry checks have fewer candidates to inspect.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach sorts points by x, then uses y as a filter. That works for queries that are narrow in x, but it scatters points that are close by y across the whole order.',
        'Sorting by y has the symmetric failure. A hash key spreads data evenly, but it destroys spatial locality entirely.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is a dimensional mismatch. A rectangular query like x from 4 to 7 and y from 4 to 7 is two-dimensional, while a single x-order interval may include many rows outside the rectangle.',
        'A full R-tree or quadtree can be more precise, but it brings pointer-heavy structure and maintenance cost. Many systems already have a sorted-key engine and need a spatial key, not a new storage engine.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Binary coordinate bits already describe recursive halves of space. The high bit of x chooses left or right, the high bit of y chooses bottom or top, and the pair chooses a quadrant.',
        'Interleaving x and y bits writes that quadrant path as an integer. Sorting by the integer sorts by quadtree prefix before fine location.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Choose a bounded integer grid, then quantize coordinates into that grid. In 2D, spread the x bits into alternating positions, spread the y bits into the remaining positions, and combine them.',
        'For x = 3 and y = 5 on a 3-bit grid, x is 011 and y is 101. Interleaving high to low gives bit pairs 10, 01, 11, so the point follows quadrant 2, then child 1, then child 3.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness of the encoding comes from conservation of bits. Every coordinate bit appears in a fixed position in the Morton key, so decoding can recover the original grid coordinate.',
        'The locality argument is weaker but useful. Equal prefixes mean equal choices for the top levels of the quadtree, so records sharing a prefix occupy the same coarse cell and can be grouped in sorted storage.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Hilbert-topleft-topright.png/120px-Hilbert-topleft-topright.png', alt: 'Color-coded Hilbert curve construction', caption: 'Hilbert order often improves locality, but the encoding is harder than Morton bit interleaving. Source: Wikimedia Commons, Fredrik Johansson, public domain.'},
        'Encoding one point is O(b), where b is the number of bits per coordinate, or O(1) for a fixed machine-word width. Sorting n points by code costs O(n log n), or linear time with radix sort over fixed-width keys.',
        'The behavior changes with bit depth. Doubling grid resolution by one bit per axis doubles precision in each dimension and adds two key bits in 2D, but it can also expose noise from imprecise coordinates.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/65/B-tree.svg', alt: 'B-tree diagram with keys grouped into nodes', caption: 'Sorted Morton keys can live in ordinary ordered indexes such as B-trees, with exact geometry checks after candidate retrieval. Source: Wikimedia Commons, CyHawk, CC BY-SA 3.0 or GFDL.'},
        'Morton keys fit map tiles, linear quadtrees, linear octrees, data-lake clustering, and GPU bounding-volume hierarchy builders. The access pattern is prefix grouping followed by exact filtering.',
        'They are useful when fast sorting, deterministic partitioning, or ordinary ordered indexes matter more than perfect locality. A B-tree range over Morton prefixes can retrieve candidate cells before geometry code checks the true shape.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Morton order is not an exact nearest-neighbor index. Nearby points can be far apart across a Z-boundary, and adjacent keys can sit on opposite sides of a visual boundary.',
        'It also fails when quantization is wrong. Bad projection, too few bits, mishandled negative coordinates, or careless rounding can make the key precise-looking but spatially misleading.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use a 4 by 4 grid with two bits per coordinate. Point (x=2, y=1) has x = 10 and y = 01. Interleaving as y1 x1 y0 x0 gives 0 1 1 0, which is binary 0110 or decimal 6.',
        'Point (x=3, y=1) has x = 11 and y = 01, giving 0 1 1 1, decimal 7. The keys 6 and 7 are adjacent because the points share the same coarse quadrant and differ only in the final x bit.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Morton codes, quadtrees, linear octrees, NVIDIA linear BVH construction, map tile quadkeys, and bit-interleaving techniques. The recurring idea is a tree path stored as a sortable key.',
        'Next study Quadtree Spatial Index, Bounding Volume Hierarchy, R-Tree, k-d Tree, Spatial Hash Grid, and Hierarchical Geospatial Cells to compare exact trees with compact linear keys.',
      ],
    },
  ],
};