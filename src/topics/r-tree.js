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
  yield {
    state: boxes('Spatial objects are rectangles or bounding boxes'),
    highlight: { active: ['park:xmin', 'park:xmax', 'road:xmin', 'road:xmax', 'query:xmin', 'query:xmax'], compare: ['shop:overlap'] },
    explanation: 'An R-tree indexes spatial objects by minimum bounding rectangles. Points, roads, polygons, and map tiles can all be represented by boxes that say where the object could be.',
  };

  yield {
    state: tree('Group nearby objects under parent bounding boxes'),
    highlight: { active: ['root', 'west', 'east', 'e-root-west', 'e-root-east'], found: ['park', 'road'] },
    explanation: 'The tree stores bounding rectangles at every level. A parent rectangle covers all child rectangles. Search can prune an entire child if its bounding rectangle does not overlap the query.',
    invariant: 'Every child rectangle is contained by its parent rectangle.',
  };

  yield {
    state: tree('Range query descends only into overlapping regions'),
    highlight: { active: ['query', 'west', 'e-query-west', 'road', 'e-query-road'], removed: ['east', 'shop', 'depot'] },
    explanation: 'The query window overlaps west, so the search descends there. It does not overlap east, so the engine skips the shop and depot subtree without inspecting every object. This is the same pruning idea as Database Indexing, but in two dimensions.',
  };

  yield {
    state: boxes('Leaf checks remove false candidates'),
    highlight: { found: ['road:overlap'], compare: ['park:overlap'], removed: ['shop:overlap', 'depot:overlap'] },
    explanation: 'Parent boxes can overlap even when some children do not. The leaf check confirms exact candidates. In a GIS database, that final check may be a precise geometry predicate after the R-tree has narrowed the candidate set.',
  };
}

function* insertAndSplit() {
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
    explanation: 'Insertion descends greedily: choose the child whose bounding rectangle must grow least to fit the new object. That keeps nearby objects grouped and reduces future overlap.',
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
    explanation: 'When a node overflows, the R-tree splits entries into two groups. A good split minimizes area and overlap. Bad splits create overlapping parents, which means later queries must inspect more branches.',
  };

  yield {
    state: tree('Splits can propagate upward'),
    highlight: { active: ['west', 'root', 'e-root-west'], found: ['road', 'park'], compare: ['east'] },
    explanation: 'Like B-Trees (How Databases Read), an R-tree stays height-balanced and splits can propagate upward. Unlike a B-tree, the ordering key is not one-dimensional; the hard part is preserving useful spatial locality.',
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
    explanation: 'R-tree quality is workload-dependent. Static map tiles can be bulk-loaded beautifully. Dynamic moving objects need cheaper online insertions and may degrade without rebuilds.',
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
      heading: 'What it is',
      paragraphs: [
        'An R-tree is a balanced spatial index for rectangles and geometry. Each node stores minimum bounding rectangles for its children. A range query checks which rectangles overlap the query window and prunes the rest.',
        'The structure matters because one-dimensional indexes do not naturally answer map and geometry questions. B-Trees (How Databases Read) order scalar keys. R-trees organize space, which is why they appear in GIS systems, spatial databases, collision detection, map search, CAD tools, and game engines.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Leaves store object bounding boxes. Internal nodes store bounding boxes that cover child boxes. Search descends into children whose boxes overlap the query. Insertion chooses the child that needs the least enlargement, then splits nodes that overflow. Split quality matters because overlapping parent boxes force more branches to be searched.',
        'R-trees are height-balanced like B-trees, but their key is multidimensional. There is no single sorted order that preserves all spatial locality, so the implementation relies on bounding-box heuristics, fanout, packing, and periodic maintenance.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'R-tree search is fast when bounding boxes are selective and parent overlap is low. Worst cases can still inspect many nodes, especially for large query windows, skinny overlapping rectangles, or degraded online insertions. Bulk loading can build strong static indexes. Dynamic workloads need careful split heuristics and sometimes rebuilds.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'R-trees back spatial indexes in databases, GIS tools, map search, geofencing, nearest-neighbor prefilters, graphics selection, collision broad phases, and bounding-box search for documents or images. Many production systems combine an R-tree candidate pass with exact geometry checks.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'An R-tree is not a magic nearest-neighbor engine. It is a pruning structure over bounding boxes. Exact geometry predicates, distance calculations, and ranking often happen after candidate retrieval. Another misconception is that any split is fine. Overlap and dead space directly affect query cost.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Antonin Guttman, "R-Trees: A Dynamic Index Structure for Spatial Searching" at https://www2.eecs.berkeley.edu/Pubs/TechRpts/1983/ERL-m-83-64.pdf and PostGIS spatial indexing notes at https://postgis.net/workshops/postgis-intro/indexing.html. Study Sweep Line Segment Intersection for geometry overlay, Delaunay Triangulation & Voronoi Dual for nearest-region geometry, B-Trees (How Databases Read), Database Indexing, Binary Search Tree, Graph BFS, and Sharding & Partitioning next.',
      ],
    },
  ],
};
