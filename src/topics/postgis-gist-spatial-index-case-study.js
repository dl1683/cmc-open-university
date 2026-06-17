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
      heading: 'Why this exists',
      paragraphs: [
        'PostGIS spatial indexing exists because exact geometry predicates are too expensive to run against every row in a large table. A city boundary, parcel polygon, transit line, or delivery zone can have many vertices. Testing exact intersection against millions of geometries is a poor first move.',
        'The index solves a cheaper first problem: which geometries might match? It stores bounding boxes so PostgreSQL can quickly find candidates whose rectangles overlap the query rectangle. Then exact spatial predicates remove false positives.',
        'This is a production case study in lossy prefiltering. The index is not the final truth. It is a way to avoid asking the expensive truth question for rows that clearly cannot match.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a sequential scan: evaluate ST_Intersects or another spatial predicate against every geometry. That is correct but slow when the table is large or the predicate is complex.',
        'Another shortcut is to assume the index answers the geometry question exactly. That is wrong. The index stores bounding boxes. Two boxes can overlap even when the actual polygons do not. The exact predicate is still required for correctness.',
        'A third shortcut is to create an index and stop thinking. Spatial indexes only help when the query exposes an index-aware predicate, the planner chooses the access path, and the bounding boxes are selective enough to reduce exact checks.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is two-stage filtering. First, use a cheap rectangle predicate to find possible matches. Second, run the exact geometry predicate only on candidates. The first stage is fast and lossy. The second stage is slower and exact.',
        'GiST is PostgreSQL\'s generalized tree access method. For PostGIS geometry, it exposes R-tree-like behavior over bounding boxes: tree nodes summarize spatial regions, and a query descends only into branches whose boxes might overlap the query.',
        'This pattern works because many spatial queries are selective. If a small query window touches a few city blocks, the bounding-box stage can discard most parcels before exact geometry work begins.',
        'The important mental shift is that "spatial index" does not mean "index every point of the shape." It means storing a compact envelope that can reject impossible matches quickly. The exact shape comes back only after candidate reduction.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A common query uses an index-aware predicate such as ST_Intersects. PostGIS can attach a bounding-box comparison that uses a GiST index on the geometry column. The planner then has a candidate access path instead of only a sequential scan.',
        'The index returns possible matches: geometries whose boxes overlap the query condition. Because boxes can overlap even when the underlying geometries do not, the executor rechecks candidates with the exact spatial predicate. This is why EXPLAIN plans for spatial queries often show index conditions, filters, and rechecks.',
        'The data shape matters. Compact polygons have tight boxes and prune well. Long skinny roads, large regions, or complex shapes with lots of empty space inside their bounding boxes can produce many false positives. Subdividing large geometries can improve selectivity because smaller pieces have tighter boxes.',
        'The planner still estimates costs. Statistics, table size, predicate shape, and selectivity determine whether the GiST path is chosen. If most rows match, a sequential scan can be reasonable.',
        'A practical debugging session starts with EXPLAIN ANALYZE. Check whether the index appears, whether the index condition contains a bounding-box predicate, how many rows were estimated, how many rows actually appeared, and how many candidates the exact filter removed.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The first graph proves the split between index prefilter and exact predicate. SQL reaches the planner, the planner chooses GiST, GiST checks bounding boxes, candidates flow to an exact predicate, and only exact hits become rows.',
        'The two-stage table proves that lossy indexes are not bugs. The bounding-box check is fast because rectangle keys are compact. The exact predicate is slower because geometry semantics are richer. Recheck is the bridge between speed and correctness.',
        'The planner-pitfall view proves why spatial queries still get slow: missing indexes, non-index-aware functions, huge geometry boxes, stale estimates, and weak selectivity all defeat the intended access path.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because bounding boxes are cheap summaries. If two boxes do not overlap, the underlying geometries cannot intersect. That negative result is exact. Only the positive result is uncertain and needs recheck.',
        'It also works because spatial locality gives the tree something to prune. Nearby geometries share bounding regions, so the tree can eliminate whole branches of space when the query window is small.',
        'The model generalizes beyond PostGIS: many spatial systems use approximate spatial envelopes, tiles, cells, or bounding volumes to reduce the number of exact geometry operations.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'Spatial query cost depends on selectivity. Compact geometries with tight bounding boxes prune well. Huge polygons, long skinny lines, and shapes with large empty bounding boxes can produce many false positives, forcing expensive exact checks.',
        'The index also costs storage and write maintenance. Inserts, updates, and deletes must update the GiST structure. Bulk loading, vacuuming, statistics, and geometry transformations can all affect plan quality.',
        'There is a modeling tradeoff. Simplifying or subdividing geometries can improve index behavior, but it adds preprocessing complexity and can change how downstream queries are written.',
        'There is a query-design tradeoff as well. Transforming geometries inside the predicate can hide the indexed expression unless the index was built on that same expression. Sometimes the right fix is not a new database setting; it is making the query and index speak the same shape language.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'PostGIS GiST indexes win in parcel lookup, geofencing, map filtering, routing support, nearest-area prefilters, delivery zones, environmental overlays, and any query where a spatial predicate would otherwise scan a large table.',
        'A complete case: a parcels table has millions of polygons, and the query asks for parcels intersecting a city boundary. The GiST index first finds parcels whose boxes overlap the city boundary box. ST_Intersects then checks exact geometry on the candidates.',
        'A serious performance review uses EXPLAIN ANALYZE to compare estimated rows, actual rows, index candidates, and exact-filter removals. That tells whether the problem is missing access path, bad estimates, poor selectivity, or expensive exact checks.',
        'That evidence also tells whether a data-modeling fix, such as subdivision, is better than tuning planner settings.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'A GiST spatial index is not a guarantee that every spatial query will be fast. It is also not a replacement for exact geometry predicates. The index stores bounding boxes, so false positives are expected.',
        'Another misconception is that any function over geometry can use the index. The query must use an index-aware predicate or explicit bounding-box condition that the planner can turn into an index path.',
        'For dynamic systems, maintenance matters too. Updates change index pages, statistics drift, and geometry transformations can hide the indexed expression. The practical habit is to keep the indexed expression and query predicate aligned, then inspect the plan when behavior changes.',
        'A final failure is ignoring coordinate systems and units. Geometry transformed to another SRID, distance computed in unsuitable units, or mixed geography and geometry assumptions can make a query correct-looking but operationally wrong.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Official sources: PostGIS spatial indexing workshop at https://postgis.net/workshops/postgis-intro/indexing.html, PostGIS spatial-index FAQ at https://postgis.net/documentation/faq/spatial-indexes/, ST_Intersects documentation at https://postgis.net/docs/ST_Intersects.html, PostgreSQL GiST documentation at https://www.postgresql.org/docs/current/gist.html, and PostGIS data management notes at https://postgis.net/docs/using_postgis_dbmanagement.html. Study R-Tree Spatial Index, PostgreSQL Query Planner Case Study, Database Indexing, 2D Range Tree Orthogonal Search, and Quadtree Spatial Index & Map Tiles next.',
      ],
    },
  ],
};
