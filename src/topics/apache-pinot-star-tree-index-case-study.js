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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the build view as ingestion-time work. Active nodes are the dimensions and star documents being materialized before any user query asks for them.',
        'Read the query view as a planner choice. If the query matches the stored rollup, the star-document path becomes active and the raw-row path is avoided.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'callout', text:'A star-tree is a workload-shaped shortcut: it stores the rollups a dashboard keeps asking for so query time pays for matching aggregates, not raw rows.'},
        'Apache Pinot serves OLAP queries, which are analytical queries over many records with filters, groups, and aggregates. A dashboard can ask for revenue by country every few seconds even when the answer uses only a few groups from millions of events.',
        'Star-tree indexing exists because repeated aggregation wastes CPU when each query recomputes the same partial sums. The index pre-aggregates selected dimension combinations inside a segment so common group-by shapes read fewer documents.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to scan only the columns needed by the query and use ordinary Pinot indexes for filters. Columnar storage, dictionaries, sorted columns, and inverted indexes already remove a lot of work.',
        'Another approach is to build a complete cube of every dimension combination. That answers many aggregates quickly, but storage can explode as dimensions and cardinalities multiply.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears when one query shape dominates traffic. If 10,000 dashboard refreshes all ask for revenue by country and device, the server repeats the same summations over raw rows again and again.',
        'A full cube is too broad, but raw scans are too repetitive. The missing structure is a partial cube shaped by measured workload, with enough rollups to help common queries and not enough to bloat every segment.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A star-tree stores wildcard rollup documents beside raw documents. A star value means all values for this dimension from this point in the tree have already been aggregated.',
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/5/52/OLAP_Cube.svg', alt:'OLAP cube with product, city, and time dimensions', caption:'OLAP cube showing dimensions that can be sliced and rolled up — star-tree indexing pre-aggregates selected combinations of these dimensions inside a Pinot segment. Source: Wikimedia Commons, OLAP Cube.svg, Konrad Roeder and Rehua, CC BY-SA 3.0.'},
        'The invariant is exact coverage, not approximation. A star document can answer a query only if it aggregates exactly the raw rows and dimensions the query asks for.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'During segment generation, Pinot groups rows by configured split dimensions and recursively builds a tree. At selected nodes it writes star documents whose metric columns store aggregates such as count or sum.',
        'At query time, Pinot checks whether the filters, group-by columns, and aggregation functions match the star-tree configuration. Matching predicates navigate specific branches, while dimensions the query ignores can use star branches.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness follows from aggregation algebra. If a query groups by country and does not mention device, summing all device rows for each country is the same as reading a precomputed all-device sum for that country.',
        'The proof depends on the stored aggregate matching the query semantics. If the query needs a dimension, predicate, or aggregation function that was not represented in the star-tree, Pinot must fall back to raw or regular indexed processing.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A star-tree spends storage and segment-build CPU to save query CPU. When the segment is built, it creates extra documents; when the query runs, it reads fewer rows if the query shape matches.',
        'Cost changes with cardinality. A country dimension with 200 values is manageable, but a user-id dimension with 50 million values can create a tree that stores many rollups while helping few repeated queries.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Star-trees fit user-facing analytics dashboards with stable filters and group-bys. They are most useful when result cardinality is much smaller than raw event count and latency matters at p95 or p99.',
        'They also fit multi-tenant OLAP systems where each query fans out across many segments. A small row-count reduction per segment can become a large cluster-wide CPU and latency reduction.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Star-trees fail for highly ad hoc exploration. If users keep changing dimensions, predicates, or functions outside the configured tree, the index misses and normal Pinot processing dominates.',
        'They also fail when build cost or freshness delay matters more than query speed. If segment generation slows enough to miss ingestion targets, the dashboard win may not repay the data-arrival cost.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a segment has 10 million rows and the top dashboard asks for sum revenue by country for mobile and web traffic. If country has 200 values and device has 2 values, raw processing may touch millions of rows to emit at most 400 groups.',
        'A star-tree can store one rollup per country with device as star, so a country-only query reads about 200 aggregate documents instead of 10 million raw rows. If the query asks for country plus device, it can use the more specific 400 documents if that split exists; otherwise it must scan deeper or fall back.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Use the Apache Pinot star-tree index documentation and the LinkedIn engineering writeup as primary sources. They define configuration knobs, query eligibility, and the segment-build model.',
        'Study columnar storage, inverted indexes, bitmap indexes, Druid segments, and vectorized execution next. Then inspect real query logs before choosing star-tree dimensions, because workload shape is the design input.',
      ],
    },
  ],
};