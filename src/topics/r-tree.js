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
        'The animation traces two R-tree operations: range search (pruning subtrees by bounding-box overlap) and insertion with node splitting. Active items mark the current decision point. Found items are confirmed results. Removed items are subtrees the search safely skipped because their parent MBR did not overlap the query window.',
        { type: 'callout', text: 'An R-tree is safe because parent boxes over-approximate children; it is fast only when those boxes stay compact.' },
        'In the search view, watch which branches the query descends into and which it prunes. The pruning is safe because the containment invariant guarantees that no child can extend beyond its parent box. In the insert view, watch how the algorithm picks the child with least MBR enlargement and how overflow triggers a split that propagates upward.',
        'At each frame, ask: what region of space was just eliminated, and what invariant makes that elimination safe?',
      
        {type: 'image', src: './assets/gifs/r-tree.gif', alt: 'Animated walkthrough of the r tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'An R-tree exists because many real queries are about space, not scalar order. A map viewport asks for roads, buildings, parks, and labels that overlap a rectangle. A GIS system asks which parcels intersect a flood zone. A game engine asks which objects might collide. A database B-tree can order one key, but geometry lives in two or more dimensions.',
        'The data structure stores minimum bounding rectangles, often called MBRs. Leaves point at object boxes. Internal nodes point at child boxes that enclose all boxes below them. A range query compares its window with those boxes and prunes any subtree whose parent box cannot overlap. That single conservative test can skip many exact geometry checks.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The most natural spatial query is a full scan: store every object, test each bounding box against the query window, then run an exact predicate on survivors. This is correct and simple. For a hundred shapes it is fine. For a million shapes where each query touches a small viewport, it checks 999,000 boxes that cannot possibly overlap. The cost is O(n) per query regardless of how local the question is.',
        'A one-dimensional index on x (or y) is the next reasonable attempt. Sort objects by their x-coordinate and binary-search for the range. This works when one coordinate is enough to discriminate, but spatial overlap is two-dimensional. A long road segment spans many x values but is narrow in y. A building close in x can be far away in y. No single sorted order turns every 2D overlap query into a contiguous range scan.',
        'Uniform grids divide the plane into fixed cells. They work well when objects are similar size and evenly distributed. They break when scales are mixed: a city block and a county boundary live in the same dataset. Dense downtown cells overflow while rural cells sit empty. The grid resolution is a global choice that cannot adapt to local density.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The common thread is that flat or one-dimensional structures cannot exploit two-dimensional locality. A full scan ignores it entirely. A 1D index captures one axis and misses the other. A uniform grid commits to one resolution globally. The failure mode is the same: as the dataset grows, queries that should be local still touch data that is spatially irrelevant.',
        'What is needed is a hierarchical grouping that adapts to the actual distribution of objects, keeps nearby objects together, and lets the search skip entire groups when their bounding region is irrelevant to the query. That is the R-tree.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is conservative summarization. A parent box may be larger than the exact shapes below it, but it must contain them. That gives search a safe negative test: if the query does not overlap the parent MBR, none of the child objects can overlap the query. The index can discard the whole subtree without knowing the exact geometry inside.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/R-tree.svg/500px-R-tree.svg.png', alt: 'R-tree diagram with red object rectangles and blue parent bounding rectangles', caption: 'The blue parent rectangles show the conservative summaries that let a query prune whole groups. Source: Wikimedia Commons, R-tree.svg, CC BY-SA 3.0: https://commons.wikimedia.org/wiki/File:R-tree.svg' },
        'The positive test is weaker. If the query does overlap a parent MBR, some child might overlap, so the search has to descend. This is why R-tree quality depends on compact boxes and low overlap between siblings. The invariant gives correctness; good packing gives speed.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Leaves store entries such as object id plus object bounding box. Internal nodes store child pointers plus child bounding boxes. A range search starts at the root. For each child whose MBR overlaps the query window, it descends. For each child whose MBR misses the query, it prunes that child and everything below it. At the leaves, the index returns candidate objects, often followed by an exact geometry predicate.',
        'Insertion descends greedily. At each internal node, it chooses the child whose bounding rectangle needs the smallest enlargement to contain the new object. Ties can be broken by smaller area or fewer entries. When the leaf overflows, the node splits into two groups. The parent receives a new child entry. If the parent overflows, the split can propagate upward, just like a B-tree split.',
        'The hard part is the split. A bad split creates large parent boxes, large dead space, and heavy sibling overlap. Later queries then have to visit multiple branches at the same level. Classic R-tree variants use different split heuristics, reinsertion strategies, and bulk-loading methods to reduce this overlap.',
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
      heading: 'Cost and behavior',
      paragraphs: [
        'R-tree cost is workload-shaped. The tree is height-balanced, so insert and search often feel logarithmic when boxes are compact and sibling overlap is low. The worst case can still visit many nodes. Large query windows, long skinny rectangles, highly overlapping objects, and degraded insertion order can make the tree behave closer to a scan.',
        'Concrete numbers help. A well-packed R-tree with fanout 50 and 10 million leaf rectangles has height 4 or 5. A small viewport query that overlaps one child at each level visits about 5 nodes and scans roughly 250 child entries. A full scan would check 10 million boxes. The ratio matters: R-trees turn spatial locality into logarithmic search depth, but only when the boxes are compact enough to prune.',
        'Fanout is a real knob. Wider nodes reduce height and can match disk pages or cache lines, but each visited node has more child boxes to scan. Split heuristics spend more CPU during insertion to reduce query work later. Bulk loading can build excellent static indexes, but dynamic moving objects may need reinsertion, periodic rebuilds, or a different structure.',
        'Space overhead is the stored hierarchy: child boxes, pointers, ids, and sometimes cached metadata. The index also adds update cost. Moving one object can change a leaf box, enlarge or shrink parent boxes, and force maintenance. R-trees are most attractive when many searches amortize that maintenance.',
      ],
    },
    {
      heading: 'Comparison with other spatial indices',
      paragraphs: [
        'A kd-tree splits space with axis-aligned hyperplanes, alternating dimensions at each level. It is excellent for static point nearest-neighbor queries but does not handle rectangles, dynamic inserts, or disk-page-oriented access well. R-trees store rectangles natively and support dynamic operations.',
        'A quadtree recursively splits 2D space into four equal quadrants. It adapts to point density but does not adapt to object size. Large objects that span many quadrants must be stored in multiple cells or at a high level in the tree. R-trees sidestep this by letting bounding boxes overlap and grouping objects by proximity rather than by fixed spatial decomposition.',
        'Spatial hash grids assign objects to fixed-size cells. They are fast for uniform distributions with known object sizes, common in game physics broad-phase collision detection. They fail when object sizes vary wildly or the space is sparse. R-trees handle mixed scales without a fixed cell size.',
        'PostGIS uses GiST (Generalized Search Tree) indexes, which are R-tree variants under the hood. The CREATE INDEX command with USING GIST on a geometry column builds an R-tree that filters candidates before ST_Intersects or ST_DWithin runs the exact predicate. SQLite uses R*-trees directly for spatial queries. MongoDB 2dsphere indexes use a different approach based on S2 cells, which is a space-filling curve rather than a bounding-box hierarchy.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'PostGIS and SpatiaLite use R-tree indexes (via GiST) for every spatial query. When a query asks "which parcels intersect this polygon," the R-tree filters millions of rows down to a few hundred candidates, and ST_Intersects checks exact geometry on the survivors. Without the index, the database would run the expensive geometry predicate on every row.',
        'Game engines use bounding-volume hierarchies (BVHs), which are R-tree cousins, for broad-phase collision detection. Unity and Unreal partition scene objects into bounding boxes. Each frame, the engine queries the hierarchy for pairs whose boxes overlap, then runs narrow-phase physics only on those pairs. A scene with 10,000 objects might have 50 million potential pairs; the BVH reduces that to a few hundred actual checks.',
        'Map rendering engines like Mapbox and Leaflet use R-trees (often the rbush library) to decide which labels, markers, and features to draw in the current viewport. As the user pans, the engine queries the R-tree for the new rectangle and skips every feature outside it.',
        'CAD tools use R-trees for click-to-select: when the user clicks a point, the tool queries the spatial index for objects whose bounding boxes contain that point, then runs exact hit-testing on the candidates. Without the index, selection on a complex schematic with thousands of components would be sluggish.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'An R-tree is not a magic nearest-neighbor engine, a perfect geometry engine, or a replacement for exact predicates. It indexes boxes. If a polygon has a large bounding box with a hole, the index can return it for a query inside the hole. That is not an index bug; it is a false candidate that the exact predicate must remove.',
        'It is also the wrong tool when the spatial distribution defeats bounding boxes. Massive overlap, tiny objects mixed with world-spanning objects, very high dimensions, or adversarial insertion order can destroy selectivity. For static point data, a kd-tree, ball tree, packed Hilbert R-tree, geohash, or space-filling-curve index may fit better. For uniform grids with fast updates, a grid or spatial hash can be simpler.',
        'High dimensions erode the advantage. In 2D or 3D, bounding boxes prune well because most of space is far from any given query. In 20 dimensions, boxes overlap heavily and the pruning ratio collapses. This is one face of the curse of dimensionality. For high-dimensional nearest-neighbor search, approximate methods like locality-sensitive hashing or HNSW graphs outperform tree-based indexes.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider five 2D rectangles representing map features: park [0,2] x [4,6], road [2,5] x [3,5], shop [6,8] x [4,6], depot [8,9] x [5,7], and a query viewport [2.5, 5.2] x [2.8, 5.4]. The R-tree groups park and road under a "west" parent MBR covering [0,5] x [3,6], and shop and depot under an "east" parent MBR covering [6,9] x [4,7]. The root MBR covers everything.',
        'Search: the query viewport overlaps the west MBR (both x-ranges and y-ranges intersect), so the search descends. It does not overlap the east MBR (the viewport ends at x=5.2, and east starts at x=6), so shop and depot are pruned without checking either leaf. Inside west, the road box [2,5] x [3,5] overlaps the viewport. The park box [0,2] x [4,6] barely misses (park ends at x=2, viewport starts at x=2.5). The road is the only candidate returned.',
        'Insert: a new cafe at [4,5] x [4,5] needs a home. The west MBR would grow from area 15 to about 15.4 to include it. The east MBR would grow from area 9 to about 15 to include it. West wins because its enlargement is smaller. If west now has too many children (exceeds the node capacity), it splits. A good split might keep park and trail in one group, road and cafe in another, producing two compact sibling boxes. A bad split that puts park and cafe together would create a wide box with dead space.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Antonin Guttman, "R-Trees: A Dynamic Index Structure for Spatial Searching" (SIGMOD 1984), available at https://www2.eecs.berkeley.edu/Pubs/TechRpts/1983/ERL-m-83-64.pdf. For production context, see the PostGIS spatial indexing workshop at https://postgis.net/workshops/postgis-intro/indexing.html and the SQLite R*-tree module documentation at https://www.sqlite.org/rtree.html.',
        'Prerequisite: study B-Tree to understand height-balanced, page-oriented indexes with splits that propagate upward -- the R-tree borrows this mechanical structure and adapts it from one-dimensional key order to multi-dimensional bounding boxes. Study Binary Search to understand how sorted order lets one comparison eliminate half the candidates -- the R-tree generalizes this from 1D intervals to 2D rectangles.',
        'Extensions: study Range Queries and Segment Tree for one-dimensional interval problems that the R-tree generalizes to higher dimensions. Study Quadtree Spatial Index Map Tiles for a fixed decomposition alternative. Study Bounding Volume Hierarchy Ray Tracing for the same box-pruning idea applied to ray casting. Study Sweep Line Segment Intersection for geometry overlay algorithms that often use R-tree candidates as input.',
        'Alternatives: study Spatial Hash Grid for the uniform-grid approach that trades adaptivity for simplicity, and Hierarchical Geospatial Cells (Geohash, S2, H3) for space-filling-curve indexes that map 2D space to 1D keys.',
      ],
    },
  ],
};
