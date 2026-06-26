// PostGIS spatial indexes use GiST to expose an R-tree-like bounding-box
// prefilter, then exact spatial predicates remove false positives.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'postgis-gist-spatial-index-case-study',
  title: 'PostGIS GiST Spatial Index Case Study',
  category: 'Systems',
  summary: 'How PostGIS turns geometry predicates into bounding-box index prefilters, planner-visible GiST scans, and exact GEOS predicate checks.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['bbox prefilter', 'planner pitfalls'], defaultValue: 'bbox prefilter' },
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

function postgisGraph(title) {
  return graphState({
    nodes: [
      { id: 'sql', label: 'SQL', x: 0.8, y: 3.5, note: 'predicate' },
      { id: 'planner', label: 'planner', x: 2.4, y: 3.5, note: 'plan' },
      { id: 'gist', label: 'GiST', x: 4.2, y: 5.4, note: 'tree' },
      { id: 'bbox', label: 'bbox', x: 4.2, y: 1.6, note: 'key' },
      { id: 'candidates', label: 'maybe', x: 6.4, y: 3.5, note: 'candidates' },
      { id: 'exact', label: 'exact', x: 8.2, y: 4.7, note: 'predicate' },
      { id: 'rows', label: 'rows', x: 9.2, y: 2.3, note: 'hits' },
    ],
    edges: [
      { id: 'e-sql-planner', from: 'sql', to: 'planner' },
      { id: 'e-planner-gist', from: 'planner', to: 'gist' },
      { id: 'e-gist-bbox', from: 'gist', to: 'bbox' },
      { id: 'e-bbox-candidates', from: 'bbox', to: 'candidates' },
      { id: 'e-candidates-exact', from: 'candidates', to: 'exact' },
      { id: 'e-exact-rows', from: 'exact', to: 'rows' },
    ],
  }, { title });
}

function* bboxPrefilter() {
  yield {
    state: postgisGraph('Spatial predicate runs as prefilter plus exact check'),
    highlight: { active: ['sql', 'planner', 'gist', 'bbox', 'e-sql-planner', 'e-planner-gist', 'e-gist-bbox'], found: ['exact'] },
    explanation: 'PostGIS spatial indexes store bounding boxes. An index-aware predicate first asks the GiST index for geometries whose boxes might match, then the exact spatial predicate removes false positives.',
    invariant: 'The index is a primary filter, not the final truth for arbitrary geometry predicates.',
  };

  yield {
    state: labelMatrix(
      'Two-stage spatial filtering',
      [
        { id: 'bbox', label: 'bounding box' },
        { id: 'gist', label: 'GiST scan' },
        { id: 'recheck', label: 'recheck' },
        { id: 'exact', label: 'exact predicate' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'why' },
      ],
      [
        ['cheap rectangle test', 'fast and lossy'],
        ['find maybe-overlaps', 'planner access path'],
        ['verify candidates', 'lossy indexes need it'],
        ['ST_Intersects truth', 'geometry semantics'],
      ],
    ),
    highlight: { active: ['bbox:role', 'gist:role'], found: ['exact:why'], compare: ['recheck:why'] },
    explanation: 'The bounding-box comparison is fast because rectangles are small keys. The exact predicate may be expensive because polygons and lines can have many vertices.',
  };

  yield {
    state: postgisGraph('GiST exposes R-tree behavior inside PostgreSQL'),
    highlight: { active: ['gist', 'bbox', 'candidates', 'e-bbox-candidates'], found: ['rows'], compare: ['planner'] },
    explanation: 'GiST is PostgreSQLs generalized tree access method. For PostGIS geometry, it behaves like an R-tree-over-GiST: bounding boxes guide tree descent and candidate retrieval.',
  };

  yield {
    state: labelMatrix(
      'Complete query example',
      [
        { id: 'table', label: 'parcels' },
        { id: 'index', label: 'gist index' },
        { id: 'query', label: 'city polygon' },
        { id: 'result', label: 'matching rows' },
      ],
      [
        { id: 'step', label: 'step' },
        { id: 'effect' },
      ],
      [
        ['millions of polygons', 'too many for full exact scan'],
        ['USING GIST geom', 'bbox search path'],
        ['ST_Intersects', 'index-aware prefilter'],
        ['exact intersections', 'final answer'],
      ],
    ),
    highlight: { active: ['index:effect', 'query:effect'], found: ['result:effect'], compare: ['table:effect'] },
    explanation: 'The common production story is simple: create the GiST index, write an index-aware spatial predicate, let the planner use the index, and still expect exact geometry rechecks.',
  };
}

function* plannerPitfalls() {
  yield {
    state: labelMatrix(
      'Why spatial queries still get slow',
      [
        { id: 'missing', label: 'missing index' },
        { id: 'wrongfunc', label: 'not index-aware' },
        { id: 'hugegeom', label: 'huge geometry' },
        { id: 'stale', label: 'bad estimates' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'repair' },
      ],
      [
        ['sequential scan', 'CREATE INDEX USING GIST'],
        ['function scan', 'use indexed predicate'],
        ['many false positives', 'subdivide or simplify'],
        ['bad plan choice', 'ANALYZE and inspect plan'],
      ],
    ),
    highlight: { active: ['missing:repair', 'wrongfunc:repair'], compare: ['hugegeom:symptom'], found: ['stale:repair'] },
    explanation: 'Spatial indexing is not magic. The planner needs an index path, the predicate must expose a bounding-box prefilter, and the data distribution must make that prefilter selective.',
    invariant: 'A large bounding box can make a precise geometry hard to index selectively.',
  };

  yield {
    state: postgisGraph('Planner must believe the index is cheaper'),
    highlight: { active: ['planner', 'gist', 'candidates'], compare: ['sql'], found: ['rows'] },
    explanation: 'Like the PostgreSQL Query Planner Case Study, the planner estimates candidate counts and costs. If estimates are stale or the query is not selective, a sequential scan can be reasonable.',
  };

  yield {
    state: labelMatrix(
      'Bounding-box false positives',
      [
        { id: 'small', label: 'compact polygon' },
        { id: 'long', label: 'long skinny road' },
        { id: 'country', label: 'large region' },
        { id: 'subdivide', label: 'subdivide' },
      ],
      [
        { id: 'index_shape', label: 'index shape' },
        { id: 'effect' },
      ],
      [
        ['tight box', 'selective'],
        ['large empty box', 'many candidates'],
        ['covers many rows', 'weak pruning'],
        ['smaller pieces', 'better boxes'],
      ],
    ),
    highlight: { active: ['long:effect', 'country:effect'], found: ['subdivide:effect'], compare: ['small:effect'] },
    explanation: 'The index sees bounding boxes, not the empty space inside complex geometries. Splitting a large geometry into smaller pieces can make the bounding boxes more selective.',
  };

  yield {
    state: labelMatrix(
      'Operational checklist',
      [
        { id: 'create', label: 'create index' },
        { id: 'predicate', label: 'predicate' },
        { id: 'explain', label: 'EXPLAIN' },
        { id: 'recheck', label: 'recheck cost' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'evidence' },
      ],
      [
        ['USING GIST?', 'index exists'],
        ['index-aware?', 'bbox appears in plan'],
        ['rows estimated well?', 'actual vs estimate'],
        ['too many candidates?', 'filter removes many'],
      ],
    ),
    highlight: { active: ['explain:evidence', 'recheck:evidence'], found: ['predicate:evidence'], compare: ['create:question'] },
    explanation: 'A good PostGIS performance review reads the plan, not just the SQL. The key questions are whether the index is visible, selective, and followed by a reasonable exact recheck.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'bbox prefilter') yield* bboxPrefilter();
  else if (view === 'planner pitfalls') yield* plannerPitfalls();
  else throw new InputError('Pick a PostGIS spatial-index view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a two-stage test. The active path is the cheap bounding-box path through the GiST index; the found path is the exact geometry predicate that decides the final rows.',
        'A bounding box is the smallest rectangle that contains a geometry. If the query box and a row box do not overlap, the actual shapes cannot intersect, so the row is safe to discard before expensive geometry code runs.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'PostGIS stores shapes such as points, roads, parcels, and city boundaries inside PostgreSQL. Exact spatial predicates such as ST_Intersects can be expensive because a polygon may have thousands of edges and because a table may have millions of rows.',
        'A spatial index exists to avoid running exact geometry math on rows that cannot possibly match. It asks a cheaper question first: do the rectangular envelopes even overlap.',
        {type:'callout', text:'A spatial index wins by rejecting impossible rows with cheap envelopes before exact geometry spends real CPU.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/6/6f/R-tree.svg', alt:'Diagram of an R-tree with red object rectangles grouped inside blue bounding boxes.', caption:'R-tree example showing grouped bounding rectangles for spatial search. Image by Skinkie and Radim Baca, public domain, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a sequential scan. PostgreSQL reads every geometry, runs ST_Intersects against the query shape, and keeps the rows whose exact shapes intersect.',
        'That approach is correct and sometimes fine for small tables. It becomes wasteful when a map viewport touches 2,000 parcels out of 20,000,000 because 19,998,000 exact predicate checks only prove absence.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that exact geometry work does not shrink until the database has a way to rule rows out. A road line with 5,000 vertices may be quick to reject by rectangle but slow to test exactly against a complex boundary.',
        'A plain B-tree cannot solve this because spatial search is not ordered by one scalar key. The database needs a tree whose internal nodes summarize regions of space, so one failed overlap test can reject a whole branch.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is lossy prefiltering. GiST gives PostgreSQL a generalized search tree; PostGIS uses it to store bounding boxes that behave like an R-tree over spatial envelopes.',
        'The index can prove some rows impossible. It cannot prove every positive match, because overlapping rectangles may contain shapes that do not intersect. Correctness comes from pairing the cheap negative proof with an exact recheck on candidates.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A query such as ST_Intersects(geom, query_polygon) can expose an index-aware bounding-box condition. The planner considers a GiST index scan, estimates candidate count, and chooses it when the candidate path looks cheaper than scanning the table.',
        'The GiST scan descends through bounding boxes. Branches whose boxes do not overlap the query box are skipped. Leaf entries whose boxes do overlap become candidates, and the executor then runs the exact spatial predicate on those candidates.',
        'Data shape controls the benefit. Compact parcels have tight boxes, while long roads or large administrative regions can have boxes with much empty space. Those shapes create false positives that survive the index and get filtered later.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument starts with containment. If geometry A intersects geometry B, then the bounding box of A must overlap the bounding box of B. Therefore a non-overlap at the box level is a sound reason to reject a row.',
        'The reverse is not guaranteed. Box overlap only says the exact shapes might intersect, so the executor must recheck candidates with the real predicate. This division gives speed without changing the answer.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The best case is proportional to the number of tree branches visited plus the number of exact candidate checks. If a query window hits 2,000 parcels out of 20,000,000, the index can replace millions of exact checks with a small tree walk and about 2,000 rechecks.',
        'The worst behavior appears when the bounding boxes are not selective. If a country polygon covers half the table or a long diagonal line has a giant envelope, the index returns many candidates and exact geometry becomes the dominant cost.',
        'Writes also pay. Inserts and updates maintain the GiST tree, and changing geometries can split pages or make statistics stale. The index buys read pruning by spending storage and write maintenance.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'GiST spatial indexes fit map viewports, parcel lookup, geofencing, environmental overlays, delivery zones, and routing prefilters. The common access pattern is selective spatial search: a small region is compared with a much larger table.',
        'They are also useful before expensive exact work. A nearest-area or intersection query can use the index to build a short candidate set, then spend CPU only where geometry semantics matter.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the query hides the indexed expression. Transforming the geometry inside the predicate, using a non-index-aware function, or comparing incompatible spatial types can leave the planner with no usable GiST path.',
        'It also fails as a complete answer for correctness. The index stores envelopes, not exact shapes. Applications that skip the exact predicate can return false positives whenever boxes overlap but shapes do not.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a parcels table has 20,000,000 polygons and a city query window covers about 1 percent of the map. A sequential exact scan runs 20,000,000 ST_Intersects checks. If each exact check averages 40 microseconds, the predicate work alone is about 800 seconds before caching and parallelism help.',
        'With a GiST index, the tree walk may visit 30,000 bounding boxes and return 220,000 candidates. If exact rechecks cost the same 40 microseconds, that part costs about 8.8 seconds, plus index traversal. If subdivision cuts false positives to 40,000 candidates, exact work drops to about 1.6 seconds.',
        'The result is still exact because every candidate is rechecked. The speedup comes from proving absence cheaply for rows whose boxes do not overlap the query envelope.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: PostGIS spatial indexing workshop at https://postgis.net/workshops/postgis-intro/indexing.html, PostGIS spatial-index FAQ at https://postgis.net/documentation/faq/spatial-indexes/, ST_Intersects documentation at https://postgis.net/docs/ST_Intersects.html, PostgreSQL GiST documentation at https://www.postgresql.org/docs/current/gist.html, and PostGIS data management notes at https://postgis.net/docs/using_postgis_dbmanagement.html.',
        'Study R-Tree Spatial Index for the spatial tree model, PostgreSQL Query Planner Case Study for path choice, Quadtree Spatial Index & Map Tiles for grid-style partitioning, and Database Indexing for the difference between lookup keys and physical storage.',
      ],
    },
  ],
};