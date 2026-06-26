// R-tree: a balanced spatial index that stores bounding rectangles in a tree
// so spatial queries can prune whole regions at once.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'r-tree',
  title: 'R-Tree Spatial Index',
  category: 'Data Structures',
  summary: 'Index rectangles, maps, and geometry by grouping nearby objects into bounding boxes that can be pruned together.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['search rectangles', 'insert and split'], defaultValue: 'search rectangles' },
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

function tree(title) {
  return graphState({
    nodes: [
      { id: 'root', label: 'root MBR', x: 4.8, y: 0.9, note: 'whole map' },
      { id: 'west', label: 'west MBR', x: 2.2, y: 2.8, note: 'parks + roads' },
      { id: 'east', label: 'east MBR', x: 7.3, y: 2.8, note: 'shops + depots' },
      { id: 'park', label: 'park', x: 1.0, y: 5.4, note: 'rect A' },
      { id: 'road', label: 'road segment', x: 3.0, y: 5.1, note: 'rect B' },
      { id: 'shop', label: 'shop', x: 6.5, y: 5.2, note: 'rect C' },
      { id: 'depot', label: 'depot', x: 8.5, y: 5.6, note: 'rect D' },
      { id: 'query', label: 'query box', x: 3.8, y: 7.0, note: 'viewport' },
    ],
    edges: [
      { id: 'e-root-west', from: 'root', to: 'west', weight: 'child' },
      { id: 'e-root-east', from: 'root', to: 'east', weight: 'child' },
      { id: 'e-west-park', from: 'west', to: 'park', weight: 'leaf' },
      { id: 'e-west-road', from: 'west', to: 'road', weight: 'leaf' },
      { id: 'e-east-shop', from: 'east', to: 'shop', weight: 'leaf' },
      { id: 'e-east-depot', from: 'east', to: 'depot', weight: 'leaf' },
      { id: 'e-query-road', from: 'query', to: 'road', weight: 'overlaps' },
      { id: 'e-query-west', from: 'query', to: 'west', weight: 'overlaps' },
    ],
  }, { title });
}

function boxes(title) {
  return labelMatrix(
    title,
    [
      { id: 'park', label: 'park' },
      { id: 'road', label: 'road segment' },
      { id: 'shop', label: 'shop' },
      { id: 'depot', label: 'depot' },
      { id: 'query', label: 'query window' },
    ],
    [
      { id: 'xmin', label: 'xmin' },
      { id: 'xmax', label: 'xmax' },
      { id: 'ymin', label: 'ymin' },
      { id: 'ymax', label: 'ymax' },
      { id: 'overlap', label: 'overlap query?' },
    ],
    [
      ['0', '2', '4', '6', 'maybe'],
      ['2', '5', '3', '5', 'yes'],
      ['6', '8', '4', '6', 'no'],
      ['8', '9', '5', '7', 'no'],
      ['2.5', '5.2', '2.8', '5.4', 'viewport'],
    ],
  );
}

function* searchRectangles() {
  const objectCount = 4; // park, road, shop, depot
  const treeDepth = 2; // root -> internal -> leaf
  const dimensions = 2; // x and y

  yield {
    state: boxes('Spatial objects are rectangles or bounding boxes'),
    highlight: { active: ['park:xmin', 'park:xmax', 'road:xmin', 'road:xmax', 'query:xmin', 'query:xmax'], compare: ['shop:overlap'] },
    explanation: `An R-tree indexes spatial objects by minimum bounding rectangles in ${dimensions} dimensions. All ${objectCount} objects — points, roads, polygons, map tiles — can be represented by boxes that say where the object could be.`,
  };

  yield {
    state: tree('Group nearby objects under parent bounding boxes'),
    highlight: { active: ['root', 'west', 'east', 'e-root-west', 'e-root-east'], found: ['park', 'road'] },
    explanation: `The tree of depth ${treeDepth} stores bounding rectangles at every level. A parent rectangle covers all child rectangles. Search can prune an entire child if its bounding rectangle does not overlap the query.`,
    invariant: `Every child rectangle is contained by its parent rectangle across all ${treeDepth} levels.`,
  };

  yield {
    state: tree('Range query descends only into overlapping regions'),
    highlight: { active: ['query', 'west', 'e-query-west', 'road', 'e-query-road'], removed: ['east', 'shop', 'depot'] },
    explanation: `The query window overlaps west, so the search descends there. It does not overlap east, so the engine skips ${objectCount / 2} objects (shop and depot) without inspecting them. This is the same pruning idea as Database Indexing, but in ${dimensions} dimensions.`,
  };

  yield {
    state: boxes('Leaf checks remove false candidates'),
    highlight: { found: ['road:overlap'], compare: ['park:overlap'], removed: ['shop:overlap', 'depot:overlap'] },
    explanation: `Parent boxes can overlap even when some children do not. The leaf check confirms exact candidates among the ${objectCount} objects. In a GIS database, that final check may be a precise ${dimensions}D geometry predicate after the R-tree has narrowed the candidate set.`,
  };
}

function* insertAndSplit() {
  const splitGroups = 2; // group A and group B
  const designKnobs = 4; // fanout, split heuristic, overlap, packing

  yield {
    state: labelMatrix(
      'Choose the leaf with least bounding-box enlargement',
      [
        { id: 'west', label: 'west leaf' },
        { id: 'east', label: 'east leaf' },
        { id: 'new', label: 'new cafe box' },
      ],
      [
        { id: 'current', label: 'current MBR' },
        { id: 'enlargement', label: 'enlargement' },
        { id: 'choice', label: 'choice' },
      ],
      [
        ['x0-5 y3-6', '+0.4 area', 'best'],
        ['x6-9 y4-7', '+9.0 area', 'skip'],
        ['x4-5 y4-5', 'new object', 'insert west'],
      ],
    ),
    highlight: { found: ['west:choice', 'west:enlargement'], compare: ['east:enlargement'] },
    explanation: `Insertion descends greedily: choose the child whose bounding rectangle must grow least to fit the new object. That keeps nearby objects grouped and reduces future overlap before any ${splitGroups}-way split is needed.`,
  };

  yield {
    state: labelMatrix(
      'Overflow forces a split',
      [
        { id: 'before', label: 'before' },
        { id: 'groupA', label: 'split group A' },
        { id: 'groupB', label: 'split group B' },
      ],
      [
        { id: 'entries', label: 'entries' },
        { id: 'mbr', label: 'new MBR' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['park, road, trail, cafe', 'large overlap', 'node full'],
        ['park, trail', 'compact west', 'one sibling'],
        ['road, cafe', 'compact center', 'new sibling'],
      ],
    ),
    highlight: { active: ['before:entries'], found: ['groupA:mbr', 'groupB:mbr'], removed: ['before:mbr'] },
    explanation: `When a node overflows, the R-tree splits entries into ${splitGroups} groups. A good split minimizes area and overlap. Bad splits create overlapping parents, which means later queries must inspect more branches.`,
  };

  yield {
    state: tree('Splits can propagate upward'),
    highlight: { active: ['west', 'root', 'e-root-west'], found: ['road', 'park'], compare: ['east'] },
    explanation: `Like B-Trees (How Databases Read), an R-tree stays height-balanced and ${splitGroups}-way splits can propagate upward. Unlike a B-tree, the ordering key is not one-dimensional; the hard part is preserving useful spatial locality.`,
  };

  yield {
    state: labelMatrix(
      'R-tree design knobs',
      [
        { id: 'fanout', label: 'fanout' },
        { id: 'split', label: 'split heuristic' },
        { id: 'overlap', label: 'overlap' },
        { id: 'packing', label: 'bulk loading' },
      ],
      [
        { id: 'helps', label: 'helps' },
        { id: 'costs', label: 'costs' },
      ],
      [
        ['shallower tree', 'larger node scans'],
        ['compact regions', 'more insertion CPU'],
        ['fewer branches searched', 'hard to avoid online'],
        ['excellent static index', 'not always dynamic'],
      ],
    ),
    highlight: { active: ['split:helps', 'overlap:helps'], compare: ['packing:costs'] },
    explanation: `R-tree quality depends on ${designKnobs} design knobs — fanout, split heuristic, overlap strategy, and bulk loading. Static map tiles can be bulk-loaded beautifully. Dynamic moving objects need cheaper online insertions and may degrade without rebuilds.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'search rectangles') yield* searchRectangles();
  else if (view === 'insert and split') yield* insertAndSplit();
  else throw new InputError('Pick an R-tree view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read each rectangle as a minimum bounding rectangle, or MBR, meaning the smallest axis-aligned box that contains an object or child group. Active boxes are being tested against the query window; removed boxes are subtrees safely skipped.',
        { type: 'callout', text: 'An R-tree is safe because parent boxes over-approximate children; it is fast only when those boxes stay compact.' },
        'The safe inference is containment. If a query rectangle does not overlap a parent MBR, it cannot overlap any child inside that parent, so the whole branch can go dark.',
        'In the insertion view, watch which child box grows least to include a new object. Overflow creates a split, and split quality decides how much future search can prune.',
      
        {type: 'image', src: './assets/gifs/r-tree.gif', alt: 'Animated walkthrough of the r tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'An R-tree indexes spatial data: points, rectangles, road segments, polygons, and map features. A query such as a viewport or collision box asks what objects overlap a region, not what keys are less than a number.',
        'A B-tree orders one-dimensional keys well, but spatial objects live across x and y coordinates. R-trees group nearby objects into bounding rectangles so one overlap test can skip many exact geometry checks.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a full scan. Store every object and test each bounding box against the query window.',
        'That is correct and often fine for hundreds of objects. For millions of map features, it checks boxes on the other side of the world even when the user is viewing one city block.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A one-dimensional index on x or y only solves part of the problem. Objects close on x can be far apart on y, and long objects can span many x positions.',
        'Uniform grids hit a different wall. One cell size cannot fit both tiny downtown parcels and huge county boundaries without either dense cells or duplicated large objects.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is conservative spatial summary. A parent box may contain empty space, but it must contain every child box below it.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/R-tree.svg/500px-R-tree.svg.png', alt: 'R-tree diagram with red object rectangles and blue parent bounding rectangles', caption: 'The blue parent rectangles show the conservative summaries that let a query prune whole groups. Source: Wikimedia Commons, R-tree.svg, CC BY-SA 3.0: https://commons.wikimedia.org/wiki/File:R-tree.svg' },
        'A missed parent box proves a missed subtree. An overlapping parent only creates candidates, so the index is a filter before exact geometry work.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Leaves store object ids and object MBRs. Internal nodes store child pointers and child MBRs that cover all entries below each child.',
        'A range query starts at the root and descends only into children whose MBR overlaps the query window. At leaves, it returns candidate objects, then exact predicates such as polygon intersection can remove false candidates.',
        'Insertion chooses the child whose MBR needs the least enlargement to contain the new object. If a node overflows, it splits entries into two groups and may propagate a split upward, preserving a balanced tree.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness follows from the containment invariant. Every child MBR is inside its parent MBR, so a query that misses the parent must miss every child.',
        'The tree can return false positives because boxes are approximate. It should not return false negatives when boxes and parent updates are maintained correctly, because pruning only happens after a safe non-overlap test.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'When boxes are compact and sibling overlap is low, search visits a small path through a balanced tree plus a few nearby branches. With fanout 50 and 10 million entries, height is around 5, so a local query can inspect hundreds of boxes instead of millions.',
        'Worst-case search is O(n) when most parent boxes overlap the query or each other. Inserts cost tree descent plus possible splits, and better split heuristics spend more CPU now to reduce query work later.',
        'Space stores the hierarchy: boxes, child pointers, and object references. Moving objects or changing geometries can force box updates upward, so R-trees pay maintenance cost for fast spatial reads.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Spatial databases use R-tree variants to filter candidates before exact geometry predicates. PostGIS uses GiST indexes for geometry columns, and SQLite exposes an R-tree module for spatial search.',
        'Map renderers and CAD tools use R-trees to find visible labels, selectable objects, and features inside a viewport. Physics engines use related bounding-volume hierarchies for broad-phase collision detection.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'R-trees fail when boxes overlap heavily. World-spanning objects, skinny diagonal shapes, dense clusters, and high-dimensional data can make many branches look relevant.',
        'They also do not replace exact geometry predicates. A polygon with a large bounding box can be returned for a query inside an empty hole, and the exact predicate must reject it.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use four objects: park [0,2] x [4,6], road [2,5] x [3,5], shop [6,8] x [4,6], and depot [8,9] x [5,7]. Group park and road under west [0,5] x [3,6], and shop and depot under east [6,9] x [4,7].',
        'Query viewport [2.5,5.2] x [2.8,5.4] overlaps west because both x and y ranges intersect. It misses east because the viewport ends at x = 5.2 and east starts at x = 6, so shop and depot are pruned together.',
        'Inside west, road overlaps the viewport while park misses because park ends at x = 2 and the viewport starts at x = 2.5. The R-tree checked two parent boxes and two leaf boxes instead of all four leaves.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Antonin Guttman, R-Trees: A Dynamic Index Structure for Spatial Searching, SIGMOD 1984. Production references: PostGIS spatial indexing documentation and SQLite R-tree module documentation.',
        'Study B-trees for balanced page-oriented indexes, quadtrees for fixed spatial decomposition, kd-trees for point data, bounding-volume hierarchies for ray tracing and collision, and geohash or S2 cells for space-filling-curve alternatives.',
      ],
    },
  ],
};