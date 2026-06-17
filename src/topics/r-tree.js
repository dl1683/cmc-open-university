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
      heading: 'Why this exists',
      paragraphs: [
        'An R-tree exists because many real queries are about space, not scalar order. A map viewport asks for roads, buildings, parks, and labels that overlap a rectangle. A GIS system asks which parcels intersect a flood zone. A game engine asks which objects might collide. A database B-tree can order one key, but geometry lives in two or more dimensions.',
        'The data structure stores minimum bounding rectangles, often called MBRs. Leaves point at object boxes. Internal nodes point at child boxes that enclose all boxes below them. A range query compares its window with those boxes and prunes any subtree whose parent box cannot overlap. That single conservative test can skip many exact geometry checks.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The simplest spatial query is a full scan. Store every polygon or object, test its bounding box against the query window, then run an exact predicate on survivors. This is fine for dozens of shapes. It fails when a city map, logistics system, CAD model, or image index has millions of objects and most queries touch only a small region.',
        'The next attempt is a one-dimensional index on x or y. That can narrow one coordinate range, but it does not preserve two-dimensional overlap. A long road segment may span many x values but be narrow in y. A building can be close in x but far away in y. There is no single sorted order where every rectangle overlap query becomes a clean contiguous range.',
        'Uniform grids are another reasonable baseline. They work when objects are similar size and evenly distributed. They struggle with mixed scales, dense downtown regions, skinny objects, and sparse empty space. R-trees were designed for dynamic spatial data where the index has to group nearby rectangles without committing to one fixed grid resolution.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is conservative summarization. A parent box may be larger than the exact shapes below it, but it must contain them. That gives search a safe negative test: if the query does not overlap the parent MBR, none of the child objects can overlap the query. The index can discard the whole subtree without knowing the exact geometry inside.',
        'The positive test is weaker. If the query does overlap a parent MBR, some child might overlap, so the search has to descend. This is why R-tree quality depends on compact boxes and low overlap between siblings. The invariant gives correctness; good packing gives speed.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Leaves store entries such as object id plus object bounding box. Internal nodes store child pointers plus child bounding boxes. A range search starts at the root. For each child whose MBR overlaps the query window, it descends. For each child whose MBR misses the query, it prunes that child and everything below it. At the leaves, the index returns candidate objects, often followed by an exact geometry predicate.',
        'Insertion descends greedily. At each internal node, it chooses the child whose bounding rectangle needs the smallest enlargement to contain the new object. Ties can be broken by smaller area or fewer entries. When the leaf overflows, the node splits into two groups. The parent receives a new child entry. If the parent overflows, the split can propagate upward, just like a B-tree split.',
        'The hard part is the split. A bad split creates large parent boxes, large dead space, and heavy sibling overlap. Later queries then have to visit multiple branches at the same level. Classic R-tree variants use different split heuristics, reinsertion strategies, and bulk-loading methods to reduce this overlap.',
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        'The search visual proves the pruning invariant. The query window overlaps the west parent box, so the search must inspect that branch. It misses the east parent box, so the shop and depot subtree is impossible. This is the same high-level idea as database indexing, but the proof is geometric containment rather than scalar order.',
        'The insert visual proves the engineering tax. The chosen child is not chosen because it has the same semantic type. It is chosen because its MBR grows least. When a node overflows, the split tries to keep future boxes compact. If the split creates overlapping parents, future searches lose the ability to prune cleanly.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is the containment invariant. Every child rectangle is contained by its parent rectangle. If a query rectangle does not overlap the parent, it cannot overlap any child, because every child lies inside the parent. Pruning is therefore safe. The tree may miss performance opportunities, but it should not miss true candidates because of a safe negative box test.',
        'False positives are allowed. A parent box can overlap the query even when no exact child geometry does. A leaf object box can overlap even when the polygon itself does not. The R-tree is a candidate generator. Exact geometry tests, distance ranking, or collision narrow phases decide the final answer after the index has reduced the search set.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'R-tree cost is workload-shaped. The tree is height-balanced, so insert and search often feel logarithmic when boxes are compact and sibling overlap is low. The worst case can still visit many nodes. Large query windows, long skinny rectangles, highly overlapping objects, and degraded insertion order can make the tree behave closer to a scan.',
        'Fanout is a real knob. Wider nodes reduce height and can match disk pages or cache lines, but each visited node has more child boxes to scan. Split heuristics spend more CPU during insertion to reduce query work later. Bulk loading can build excellent static indexes, but dynamic moving objects may need reinsertion, periodic rebuilds, or a different structure.',
        'Space overhead is the stored hierarchy: child boxes, pointers, ids, and sometimes cached metadata. The index also adds update cost. Moving one object can change a leaf box, enlarge or shrink parent boxes, and force maintenance. R-trees are most attractive when many searches amortize that maintenance.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'R-trees win when the workload asks for spatial candidates from large sets of rectangles or geometry. Spatial databases use them for bounding-box filters before exact predicates. GIS tools use them for map windows, overlays, and geofencing. Game engines and physics systems use related bounding-volume hierarchies for broad-phase collision candidates. CAD and graphics tools use them for selection and viewport queries.',
        'They are also useful as prefilters for nearest-neighbor and ranking work. The R-tree can quickly find objects whose boxes are plausible, then a later stage computes exact distance, polygon relation, or business ranking. The fit is strongest when queries are local, boxes are compact, and the data has enough spatial locality for parent boxes to prune most branches.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'An R-tree is not a magic nearest-neighbor engine, a perfect geometry engine, or a replacement for exact predicates. It indexes boxes. If a polygon has a large bounding box with a hole, the index can return it for a query inside the hole. That is not an index bug; it is a false candidate that the exact predicate must remove.',
        'It is also the wrong tool when the spatial distribution defeats bounding boxes. Massive overlap, tiny objects mixed with world-spanning objects, very high dimensions, or adversarial insertion order can destroy selectivity. For static point data, a kd-tree, ball tree, packed Hilbert R-tree, geohash, or space-filling-curve index may fit better. For uniform grids with fast updates, a grid or spatial hash can be simpler.',
      ],
    },
    {
      heading: 'A worked case',
      paragraphs: [
        'Suppose a map viewport overlaps the west parent rectangle but not the east parent rectangle. The search descends into west and skips every object under east. If west contains a road segment and a park, both leaf boxes may be checked. The road box overlaps the viewport; the park may be only a false candidate. The exact geometry test decides the final answer.',
        'Insertion has the opposite tension. A new cafe near the road can go into the west child with small enlargement, but if that child overflows the split must keep future boxes compact. The index is good when most viewports prune most children. It is poor when every viewport overlaps several parents at every level.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Antonin Guttman, "R-Trees: A Dynamic Index Structure for Spatial Searching" at https://www2.eecs.berkeley.edu/Pubs/TechRpts/1983/ERL-m-83-64.pdf and PostGIS spatial indexing notes at https://postgis.net/workshops/postgis-intro/indexing.html. Study B-Trees for height-balanced page-oriented indexes, Database Indexing for candidate filtering, Sweep Line Segment Intersection for geometry overlay, Delaunay Triangulation and Voronoi Dual for nearest-region geometry, Bounding Volume Hierarchy Ray Tracing for another box hierarchy, Quadtree Spatial Index Map Tiles for fixed spatial decomposition, kd-trees for point search, and Sharding and Partitioning for distributing spatial workloads.',
      ],
    },
  ],
};
