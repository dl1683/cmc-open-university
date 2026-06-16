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
      heading: 'What it is',
      paragraphs: [
        'Apache Pinot is built for low-latency analytics over immutable segments. A star-tree index is a segment-level index that pre-aggregates selected dimension combinations. Instead of scanning raw rows for a repeated group-by query, Pinot can traverse a star-tree and read a smaller number of pre-aggregated documents.',
        'The name comes from star nodes: nodes that represent ALL values for a dimension at that point in the tree. Those nodes store rollups such as sum and count, turning a common query from raw event processing into lookup plus merge.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'During segment generation, Pinot sorts and groups records along configured split dimensions. It creates leaf documents for detailed rows and star documents for rollups across selected dimensions. At query time, if the filter and group-by dimensions align with the star-tree configuration, the server can process star documents instead of raw documents.',
        'This is the same broad tradeoff behind materialized views and OLAP cubes: spend storage and build time to precompute a shape of aggregation that users ask for repeatedly. The star-tree makes the tradeoff tunable at the index level inside a real-time analytics system. Because Pinot queries many immutable segments in parallel, shaving work inside each segment can multiply into a visible end-to-end latency win.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A star-tree can reduce rows processed dramatically, but it adds index size and segment build work. The hard design questions are dimension selection, split order, max leaf records, skipped dimensions, metric aggregation functions, and whether query traffic is stable enough to justify the pre-aggregation. Teams should compare p95 latency, segment size, ingestion delay, and query coverage before declaring the index a win.',
      ],
    },
    {
      heading: 'Real-world case study',
      paragraphs: [
        'Pinot documentation describes star-tree as a multi-column index that uses pre-aggregated results to reduce the number of values processed for aggregation and group-by workloads. It is particularly relevant to user-facing dashboards where repeated query shapes need low latency over fresh data. That makes it an index-selection lesson, not only a Pinot feature tour.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not add star-trees reflexively. High-cardinality dimensions can blow up index size, and ad hoc queries may miss the configured rollups. A star-tree also does not replace dictionary encoding, inverted indexes, sorted indexes, partitioning, broker routing, or good segment sizing. It is one tool in an OLAP indexing budget.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Apache Pinot Star-Tree Index documentation at https://docs.pinot.apache.org/build-with-pinot/indexing/star-tree-index and the LinkedIn engineering writeup at https://www.linkedin.com/blog/engineering/open-source/star-tree-index-powering-fast-aggregations-on-pinot. Study Parquet Columnar Format Case Study, Apache Druid Segment Case Study, Dremel Query Engine Case Study, Roaring Bitmaps, Database Indexing, and DuckDB Vectorized Execution next.',
      ],
    },
  ],
};
