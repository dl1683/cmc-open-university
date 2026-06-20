// Apache Pinot star-tree index: pre-aggregate across selected dimensions so
// OLAP queries can traverse a compact tree instead of scanning many rows.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'apache-pinot-star-tree-index-case-study',
  title: 'Apache Pinot Star-Tree Index Case Study',
  category: 'Systems',
  summary: 'A real-time OLAP case study: Pinot star-tree indexes pre-aggregate dimension combinations so filtered group-bys touch far fewer rows.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['star-tree build', 'query pruning'], defaultValue: 'star-tree build' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function* starTreeBuild() {
  yield {
    state: graphState({
      nodes: [
        { id: 'seg', label: 'segment', x: 0.9, y: 2.8, note: 'rows' },
        { id: 'dims', label: 'dims', x: 2.6, y: 2.8, note: 'country/device' },
        { id: 'split', label: 'split', x: 4.2, y: 2.8, note: 'tree' },
        { id: 'star', label: 'star doc', x: 6.0, y: 2.8, note: 'ALL rollup' },
        { id: 'agg', label: 'agg', x: 7.8, y: 2.8, note: 'sum/count' },
      ],
      edges: [
        { id: 'e-seg-dims', from: 'seg', to: 'dims', weight: '' },
        { id: 'e-dims-split', from: 'dims', to: 'split', weight: '' },
        { id: 'e-split-star', from: 'split', to: 'star', weight: '' },
        { id: 'e-star-agg', from: 'star', to: 'agg', weight: '' },
      ],
    }, { title: 'Star-tree adds pre-aggregated star nodes to a segment' }),
    highlight: { active: ['split', 'star', 'agg'] },
    explanation: 'A Pinot star-tree index is built inside a segment. It splits on configured dimensions and stores pre-aggregated documents at star nodes so common rollups do not scan every raw row.',
  };

  yield {
    state: labelMatrix(
      'Raw rows to star documents',
      [
        { id: 'r1', label: 'US mobile' },
        { id: 'r2', label: 'US web' },
        { id: 'r3', label: 'IN mobile' },
        { id: 'star', label: 'US *' },
      ],
      [
        { id: 'metric', label: 'revenue' },
        { id: 'kind', label: 'kind' },
      ],
      [
        ['12', 'raw'],
        ['8', 'raw'],
        ['5', 'raw'],
        ['20', 'pre-agg'],
      ],
    ),
    highlight: { active: ['r1:metric', 'r2:metric'], found: ['star:metric'] },
    explanation: 'The star document stores a rollup across one or more dimensions. Querying country=US without filtering device can read the US star document instead of summing both raw device rows.',
    invariant: 'Pre-aggregation trades storage for fewer rows at query time.',
  };

  yield {
    state: labelMatrix(
      'Index design knobs',
      [
        { id: 'dims', label: 'dims' },
        { id: 'threshold', label: 'threshold' },
        { id: 'metrics', label: 'metrics' },
        { id: 'storage', label: 'storage' },
      ],
      [
        { id: 'choice', label: 'choice' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['which cols', 'wrong workload'],
        ['min rows', 'too many nodes'],
        ['sum/count', 'limited funcs'],
        ['extra docs', 'bloat'],
      ],
    ),
    highlight: { found: ['dims:choice', 'threshold:choice', 'storage:risk'] },
    explanation: 'A star-tree is not free. You choose dimensions, split order, thresholds, and metrics based on actual query patterns. Bad choices create storage bloat without useful pruning.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'parquet', label: 'columnar', x: 0.9, y: 2.8, note: 'scan less' },
        { id: 'bitmap', label: 'bitmap', x: 2.8, y: 3.5, note: 'filter' },
        { id: 'inverted', label: 'inverted', x: 2.8, y: 2.1, note: 'lookup' },
        { id: 'star', label: 'star-tree', x: 5.0, y: 2.8, note: 'pre-agg' },
        { id: 'broker', label: 'broker', x: 7.0, y: 2.8, note: 'route' },
        { id: 'server', label: 'server', x: 8.7, y: 2.8, note: 'segment' },
      ],
      edges: [
        { id: 'e-parquet-bitmap', from: 'parquet', to: 'bitmap', weight: '' },
        { id: 'e-parquet-inverted', from: 'parquet', to: 'inverted', weight: '' },
        { id: 'e-bitmap-star', from: 'bitmap', to: 'star', weight: '' },
        { id: 'e-inverted-star', from: 'inverted', to: 'star', weight: '' },
        { id: 'e-star-broker', from: 'star', to: 'broker', weight: '' },
        { id: 'e-broker-server', from: 'broker', to: 'server', weight: '' },
      ],
    }, { title: 'Star-tree sits beside Pinot segment indexes' }),
    highlight: { active: ['bitmap', 'inverted', 'star'], found: ['server'] },
    explanation: 'Star-tree is one index among many. Pinot can combine dictionary, inverted, range, sorted, text, and star-tree-style choices depending on query and segment design.',
  };
}

function* queryPruning() {
  yield {
    state: graphState({
      nodes: [
        { id: 'sql', label: 'SQL', x: 0.9, y: 2.8, note: 'GROUP BY' },
        { id: 'match', label: 'match', x: 2.7, y: 2.8, note: 'dims' },
        { id: 'star', label: 'star docs', x: 4.6, y: 3.5, note: 'few' },
        { id: 'raw', label: 'raw docs', x: 4.6, y: 2.1, note: 'many' },
        { id: 'merge', label: 'merge', x: 6.6, y: 2.8, note: 'partials' },
        { id: 'result', label: 'result', x: 8.4, y: 2.8, note: 'fast' },
      ],
      edges: [
        { id: 'e-sql-match', from: 'sql', to: 'match', weight: '' },
        { id: 'e-match-star', from: 'match', to: 'star', weight: '' },
        { id: 'e-match-raw', from: 'match', to: 'raw', weight: '' },
        { id: 'e-star-merge', from: 'star', to: 'merge', weight: '' },
        { id: 'e-raw-merge', from: 'raw', to: 'merge', weight: '' },
        { id: 'e-merge-result', from: 'merge', to: 'result', weight: '' },
      ],
    }, { title: 'Query planner chooses star docs when the predicate matches' }),
    highlight: { active: ['match', 'star'], compare: ['raw'], found: ['result'] },
    explanation: 'If a query matches the configured dimension rollups, Pinot can answer from star documents. If it needs dimensions or predicates not covered by the star-tree, it falls back to more raw scanning.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'raw rows in segment', min: 0, max: 10000000 }, y: { label: 'rows processed', min: 0, max: 10000000 } },
      series: [
        { id: 'scan', label: 'raw scan', points: [{ x: 100000, y: 100000 }, { x: 1000000, y: 1000000 }, { x: 5000000, y: 5000000 }, { x: 10000000, y: 10000000 }] },
        { id: 'star', label: 'star-tree match', points: [{ x: 100000, y: 8000 }, { x: 1000000, y: 18000 }, { x: 5000000, y: 40000 }, { x: 10000000, y: 65000 }] },
      ],
    }),
    highlight: { active: ['star'], compare: ['scan'] },
    explanation: 'The ideal star-tree query cost grows with the number of relevant pre-aggregated documents, not raw event rows. The actual curve depends on cardinality and index configuration.',
  };

  yield {
    state: labelMatrix(
      'When it helps',
      [
        { id: 'agg', label: 'agg query' },
        { id: 'filter', label: 'filter dims' },
        { id: 'highcard', label: 'high card' },
        { id: 'adhoc', label: 'ad hoc' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['strong', 'pre-agg'],
        ['strong', 'tree path'],
        ['careful', 'node bloat'],
        ['mixed', 'miss index'],
      ],
    ),
    highlight: { found: ['agg:fit', 'filter:fit'], compare: ['highcard:reason'] },
    explanation: 'Star-trees shine for repeated aggregation and group-by shapes. They are less attractive for highly ad hoc dimensions or high-cardinality combinations that explode the pre-aggregate tree.',
  };

  yield {
    state: labelMatrix(
      'Production audit',
      [
        { id: 'queries', label: 'queries' },
        { id: 'ingest', label: 'ingest' },
        { id: 'storage', label: 'storage' },
        { id: 'fresh', label: 'freshness' },
      ],
      [
        { id: 'measure', label: 'measure' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['top shapes', 'coverage'],
        ['build cost', 'latency'],
        ['index size', 'cost'],
        ['segment delay', 'SLA'],
      ],
    ),
    highlight: { found: ['queries:measure', 'ingest:measure', 'storage:measure'] },
    explanation: 'The complete case study is cost-based: star-tree latency wins must repay build time, segment size, freshness delay, and operational complexity.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'star-tree build') yield* starTreeBuild();
  else if (view === 'query pruning') yield* queryPruning();
  else throw new InputError('Pick an Apache Pinot star-tree view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'callout', text:'A star-tree is a workload-shaped shortcut: it stores the rollups a dashboard keeps asking for so query time pays for matching aggregates, not raw rows.'},
        'Apache Pinot serves low-latency analytical queries over immutable segments. A dashboard query such as "revenue by country for the last hour" may touch millions of event rows per segment even when the answer has only a few groups.',
        'Columnar storage, dictionaries, inverted indexes, and sorted columns reduce scan work, but repeated aggregation still burns CPU if every query has to re-sum the same raw rows. A star-tree index exists for the repeated case: precompute the rollups that the workload keeps asking for, then read those rollups at query time.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first answer is to let Pinot scan only the columns it needs and use normal segment indexes to filter rows. That is often enough. It keeps ingestion simple and avoids guessing future query shapes.',
        'The wall appears when the same aggregation shape dominates traffic. If every dashboard refresh groups by country and device, a raw scan repeats the same partial sums again and again. Building a full cube for every dimension combination would avoid scans, but it can explode in storage. Star-tree indexing is the middle ground: materialize selected rollups inside the segment.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'A star node means "all values for this dimension from here down." Instead of storing only raw documents, the segment also stores documents whose dimension value is a wildcard and whose metric columns already contain aggregates.',
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/5/52/OLAP_Cube.svg', alt:'OLAP cube with product, city, and time dimensions', caption:'OLAP cube showing dimensions that can be sliced and rolled up — star-tree indexing pre-aggregates selected combinations of these dimensions inside a Pinot segment. Source: Wikimedia Commons, OLAP Cube.svg, Konrad Roeder and Rehua, CC BY-SA 3.0.'},
        'That wildcard is the useful compression. If the query does not need to distinguish device, the server can use the `country=US, device=*` document instead of adding `country=US, device=mobile` and `country=US, device=web` from raw rows.',
        'The index is workload-shaped, not universal. The configured split dimensions, aggregation functions, max leaf records, and skipped star-node dimensions decide which rollups exist and which queries can use them.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'During segment generation, Pinot builds a tree over configured dimensions. It groups records by a split dimension, recursively splits large groups, and creates star documents that aggregate over one or more dimensions. The leaf threshold controls when the builder stops splitting and stores detailed rows.',
        'The star-tree stores aggregation results for configured function-column pairs such as count, sum, min, max, or other supported aggregations. Query-time use is possible only when the query filter, group-by columns, and aggregation functions can be answered by the materialized documents.',
        'At query time, the server matches the query against the star-tree. Covered predicates navigate specific branches. Dimensions the query does not care about can use star branches. If the query asks for a dimension or predicate that the star-tree cannot represent, Pinot falls back to regular segment processing for that part of the work.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a segment has rows for `(country, device, revenue)`: `(US, mobile, 12)`, `(US, web, 8)`, and `(IN, mobile, 5)`. A normal query for `country=US` and `sum(revenue)` reads the two US rows and adds 12 + 8.',
        'A star-tree can store a pre-aggregated document `(US, *, revenue_sum=20)`. The query does not group or filter by device, so the device value is allowed to be `*`. The answer is the same sum, but the server reads one star document instead of two raw rows. On a large segment, that difference is the point.',
        'If the query changes to `country=US AND device=mobile`, the `US,*` document is too coarse. The server must use a more specific star-tree path or raw documents. Star-tree speed comes from exact alignment between the query and the pre-aggregated shape.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is ordinary aggregation algebra. If a query groups by country and ignores device, then summing all device-specific rows for a country is equivalent to reading a precomputed "all devices" sum for that country.',
        'The invariant is that every star document must aggregate exactly the raw rows represented by its tree path. A `*` dimension is not an approximation. It is a promise that all values below that branch have already been combined using the configured aggregation function.',
        'This is why aggregation choice matters. Additive and decomposable metrics fit naturally. Metrics with special merge rules need matching Pinot aggregation support. A star-tree cannot safely answer a query whose semantics were not represented during index construction.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the build view, read the path from segment to dimensions to star document as an ingestion-time decision. The highlighted star node is not a cache entry made after a query. It is a document created when the segment is built so future queries can skip raw rows.',
        'The raw-row matrix shows the main equivalence. Two detailed US rows become one `US *` aggregate because the current query shape does not need device-level detail. The design-knobs frame is the warning label: dimension order and thresholds decide whether the tree is useful or bloated.',
        'In the query-pruning view, the match node is the critical state change. When the query matches the configured rollup, the star-doc path becomes active and the raw-doc path becomes avoidable. When it misses, the visualization is showing why Pinot still needs its regular indexes and scans.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'A star-tree spends storage, segment-build CPU, and operational attention to reduce query CPU. The index can increase segment size because it stores extra aggregate documents. It can also lengthen ingestion or segment generation because the rollups must be built before the segment is ready.',
        'The cost is not only Big-O. High-cardinality dimensions can create many branches. Too small a leaf threshold can create too many nodes. Too many aggregation pairs can widen documents. Too many skipped dimensions can leave common queries uncovered.',
        'The practical measurement is workload coverage. Track rows scanned, p95 and p99 latency, segment size, build time, memory pressure, and the fraction of real queries that use the star-tree. A star-tree that helps one benchmark and misses production traffic is just storage bloat.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Star-trees win on repeated aggregation and group-by queries over large segments, especially user-facing dashboards with stable dimensions and tight latency targets. They fit cases where the result cardinality is much smaller than the raw event count.',
        'They also fit multi-tenant analytical systems where a small latency reduction inside each segment multiplies across many segments and servers. The broker still routes the query, and the server still executes it, but each matching segment has less row-level work to do.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Star-trees are weak for highly ad hoc exploration. If users constantly change filters and group-bys across dimensions that were not selected, the index will miss and regular query processing will dominate.',
        'They are risky for very high-cardinality dimensions unless the configuration controls tree growth. A dimension such as user id may create a large number of branches while providing little reusable aggregation.',
        'They do not replace Pinot table design. Partitioning, routing, segment sizing, dictionary encoding, inverted indexes, range indexes, sorted indexes, and query rewrite still matter. A star-tree is one index in an OLAP indexing budget.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The common failure is building the tree for imagined queries instead of measured traffic. Start from query logs, not from a list of dimensions that look important.',
        'Another failure is hiding freshness or ingestion cost. If segment generation slows enough to violate a freshness target, the query win may not be worth it. Real-time systems care about both serving latency and data arrival latency.',
        'A third failure is treating star-tree use as automatic proof of success. Compare against a no-star-tree baseline and against simpler indexes. The right answer may be a sorted column, an inverted index, a rollup table, or a different segment partitioning strategy.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Apache Pinot Star-Tree Index documentation at https://docs.pinot.apache.org/build-with-pinot/indexing/star-tree-index and the LinkedIn engineering writeup on Pinot star-tree indexing at https://www.linkedin.com/blog/engineering/open-source/star-tree-index-powering-fast-aggregations-on-pinot.',
        'Study Parquet Columnar Format Case Study for column pruning, Apache Druid Segment Case Study for another OLAP segment design, Dremel Query Engine Case Study for nested analytical scans, Roaring Bitmaps for compressed filter sets, Database Indexing for index-selection tradeoffs, and DuckDB Vectorized Execution for CPU-efficient scans.',
      ],
    },
  ],
};
