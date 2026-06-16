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
      heading: 'What it is',
      paragraphs: [
        'PostGIS spatial indexing is a production case study in using approximate keys to accelerate exact predicates. Geometry can be complicated: polygons have many vertices, lines can be long, and exact intersection is not a simple scalar comparison. The index stores bounding boxes so PostgreSQL can cheaply find candidate geometries before running the exact spatial predicate.',
        'This case study links R-Tree Spatial Index, PostgreSQL Query Planner Case Study, Database Indexing, 2D Range Tree Orthogonal Search, and Quadtree Spatial Index & Map Tiles. The key lesson is lossy prefiltering: the index narrows the search, but the exact predicate decides truth.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A common query uses an index-aware predicate such as ST_Intersects. PostGIS can attach a bounding-box comparison that uses a GiST index on the geometry column. The GiST access method gives PostgreSQL a balanced tree interface; PostGIS supplies spatial behavior over bounding boxes, similar to an R-tree implemented inside GiST.',
        'The index returns possible matches: geometries whose boxes overlap the query condition. Because boxes can overlap even when the underlying geometries do not, the executor rechecks candidates with the exact spatial predicate. This is why EXPLAIN plans for spatial queries often show index conditions, filters, and rechecks.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Spatial query cost depends on selectivity. Compact geometries with tight bounding boxes prune well. Huge polygons, long skinny lines, and shapes with large empty bounding boxes can produce many false positives, forcing expensive exact checks. Sometimes subdividing large geometries gives the index smaller, more selective boxes.',
        'The planner still matters. A GiST index only helps when it exists, the predicate is index-aware, statistics are plausible, and the estimated candidate set is cheaper than scanning. That makes PostGIS performance a combination of data structure design, geometry shape, and PostgreSQL planner evidence.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Imagine a parcels table with millions of polygon rows and a request to find all parcels intersecting a city boundary. A full exact scan would test the city polygon against every parcel geometry. With a GiST index, PostgreSQL first retrieves parcels whose bounding boxes overlap the city boundary box. Then ST_Intersects checks the exact geometry relation for those candidates.',
        'If the city boundary is large and covers most parcels, the index may not save much. If the query window is small and parcel boxes are compact, the index can cut the candidate set by orders of magnitude. A serious review uses EXPLAIN ANALYZE to compare estimated rows, actual rows, and how many candidates were removed by the exact filter.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A GiST spatial index is not a guarantee that every spatial query will be fast. It is also not a replacement for exact geometry predicates. The index stores bounding boxes, so false positives are expected. Another misconception is that any function over geometry can use the index. The query must use an index-aware predicate or explicit bounding-box condition that the planner can turn into an index path.',
        'For dynamic systems, maintenance matters too. Updates change index pages, statistics drift, and geometry transformations can hide the indexed expression. The practical habit is to keep the indexed expression and the query predicate aligned, then inspect the plan when behavior changes.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Official sources: PostGIS spatial indexing workshop at https://postgis.net/workshops/postgis-intro/indexing.html, PostGIS spatial-index FAQ at https://postgis.net/documentation/faq/spatial-indexes/, ST_Intersects documentation at https://postgis.net/docs/ST_Intersects.html, PostgreSQL GiST documentation at https://www.postgresql.org/docs/current/gist.html, and PostGIS data management notes at https://postgis.net/docs/using_postgis_dbmanagement.html. Study R-Tree Spatial Index, PostgreSQL Query Planner Case Study, Database Indexing, 2D Range Tree Orthogonal Search, and Quadtree Spatial Index & Map Tiles next.',
      ],
    },
  ],
};
