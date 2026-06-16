// Dremel case study: nested columnar storage plus a multi-level serving tree
// for interactive aggregation over very large read-only datasets.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'dremel-query-engine-case-study',
  title: 'Dremel Query Engine Case Study',
  category: 'Papers',
  summary: 'Google Dremel as the interactive analytics lesson: columnar nested records plus a serving tree for fast aggregation.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['columnar nested records', 'serving tree query'], defaultValue: 'columnar nested records' },
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

function servingTree(title) {
  return graphState({
    nodes: [
      { id: 'client', label: 'SQL client', x: 0.7, y: 4.0, note: 'COUNT, GROUP BY' },
      { id: 'root', label: 'root server', x: 2.4, y: 4.0, note: 'query plan' },
      { id: 'm1', label: 'mixer A', x: 4.3, y: 2.3, note: 'partial agg' },
      { id: 'm2', label: 'mixer B', x: 4.3, y: 5.7, note: 'partial agg' },
      { id: 'leaf1', label: 'leaf 1', x: 6.5, y: 1.2, note: 'columns' },
      { id: 'leaf2', label: 'leaf 2', x: 6.5, y: 3.2, note: 'columns' },
      { id: 'leaf3', label: 'leaf 3', x: 6.5, y: 5.0, note: 'columns' },
      { id: 'leaf4', label: 'leaf 4', x: 6.5, y: 6.8, note: 'columns' },
      { id: 'storage', label: 'column shards', x: 8.8, y: 4.0, note: 'read-only data' },
    ],
    edges: [
      { id: 'e-client-root', from: 'client', to: 'root', weight: 'SQL' },
      { id: 'e-root-m1', from: 'root', to: 'm1', weight: 'plan' },
      { id: 'e-root-m2', from: 'root', to: 'm2', weight: 'plan' },
      { id: 'e-m1-l1', from: 'm1', to: 'leaf1', weight: 'scan' },
      { id: 'e-m1-l2', from: 'm1', to: 'leaf2', weight: 'scan' },
      { id: 'e-m2-l3', from: 'm2', to: 'leaf3', weight: 'scan' },
      { id: 'e-m2-l4', from: 'm2', to: 'leaf4', weight: 'scan' },
      { id: 'e-leaf-storage', from: 'leaf2', to: 'storage', weight: 'columns' },
      { id: 'e-leaf3-storage', from: 'leaf3', to: 'storage', weight: 'columns' },
    ],
  }, { title });
}

function* columnarNestedRecords() {
  yield {
    state: labelMatrix(
      'Nested records are awkward for row stores',
      [
        { id: 'r1', label: 'record 1' },
        { id: 'r2', label: 'record 2' },
        { id: 'r3', label: 'record 3' },
      ],
      [
        { id: 'doc', label: 'doc id' },
        { id: 'country', label: 'country' },
        { id: 'links', label: 'repeated links' },
        { id: 'lang', label: 'language' },
      ],
      [
        ['10', 'US', '[a,b,c]', 'en'],
        ['11', 'IN', '[d]', 'en'],
        ['12', 'US', '[]', 'es'],
      ],
    ),
    highlight: { active: ['r1:links', 'r2:links', 'r3:links'], compare: ['r1:country', 'r3:country'] },
    explanation: 'Dremel was built for interactive analysis of read-only nested data. Nested and repeated fields are natural for logs and protocol buffers, but a row-store scan reads too much when a query touches only a few fields.',
  };

  yield {
    state: labelMatrix(
      'Columnar layout reads only the fields needed',
      [
        { id: 'country', label: 'country column' },
        { id: 'lang', label: 'language column' },
        { id: 'links', label: 'links.url column' },
        { id: 'doc', label: 'doc id column' },
      ],
      [
        { id: 'values', label: 'values' },
        { id: 'levels', label: 'definition/repetition' },
        { id: 'query', label: 'needed for query?' },
      ],
      [
        ['US, IN, US', 'present', 'yes'],
        ['en, en, es', 'present', 'yes'],
        ['a,b,c,d', 'nested boundaries', 'no'],
        ['10,11,12', 'present', 'maybe'],
      ],
    ),
    highlight: { found: ['country:query', 'lang:query'], removed: ['links:query'], active: ['links:levels'] },
    explanation: 'Dremel stores nested records column by column, using repetition and definition levels to reconstruct structure. A query such as count by country and language can skip the repeated links payload entirely.',
    invariant: 'Columnar storage is fast when queries touch fewer fields than records contain.',
  };

  yield {
    state: labelMatrix(
      'Column-oriented cost model',
      [
        { id: 'scan', label: 'scan fewer bytes' },
        { id: 'compress', label: 'compress by type' },
        { id: 'nested', label: 'preserve nesting' },
        { id: 'updates', label: 'updates' },
      ],
      [
        { id: 'benefit', label: 'benefit' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['skip unused columns', 'bad for single-row updates'],
        ['similar values together', 'needs encoding logic'],
        ['levels encode structure', 'more complex reader'],
        ['read-only data shines', 'mutable OLTP is wrong fit'],
      ],
    ),
    highlight: { found: ['scan:benefit', 'compress:benefit', 'nested:benefit'], compare: ['updates:tradeoff'] },
    explanation: 'Dremel is an analytical system, not a transactional row store. It optimizes scans, aggregation, and nested data reconstruction over large read-only datasets.',
  };

  yield {
    state: labelMatrix(
      'How this connects to data structures',
      [
        { id: 'dictionary', label: 'dictionary encoding' },
        { id: 'bitmap', label: 'bitmap filters' },
        { id: 'tree', label: 'serving tree' },
        { id: 'index', label: 'search index' },
      ],
      [
        { id: 'neighbor', label: 'neighbor topic' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['Hash Table', 'map values to codes'],
        ['Roaring Bitmaps', 'fast column filters'],
        ['Graph BFS', 'fanout and aggregation'],
        ['Inverted Index', 'skip irrelevant data'],
      ],
    ),
    highlight: { active: ['dictionary:neighbor', 'bitmap:neighbor', 'index:neighbor'], found: ['tree:lesson'] },
    explanation: 'Dremel is a systems composition: column encodings, nested-level metadata, fast filters, serving-tree aggregation, and workload-aware query planning.',
  };
}

function* servingTreeQuery() {
  yield {
    state: servingTree('A SQL query fans out through a serving tree'),
    highlight: { active: ['client', 'root', 'm1', 'm2', 'e-client-root', 'e-root-m1', 'e-root-m2'], compare: ['leaf1', 'leaf4'] },
    explanation: 'Dremel uses a multi-level execution tree. The root receives a query, mixers split and aggregate work, and leaves scan column shards in parallel.',
  };

  yield {
    state: servingTree('Leaves scan columns and return partial aggregates'),
    highlight: { active: ['leaf1', 'leaf2', 'leaf3', 'leaf4', 'storage', 'e-m1-l1', 'e-m1-l2', 'e-m2-l3', 'e-m2-l4'], found: ['m1', 'm2'] },
    explanation: 'The query does not bring all raw rows to one machine. Leaves scan local column shards and compute partial aggregates. Mixers combine partial results before sending a smaller answer upward.',
  };

  yield {
    state: labelMatrix(
      'Example aggregation: count pages by country',
      [
        { id: 'l1', label: 'leaf 1' },
        { id: 'l2', label: 'leaf 2' },
        { id: 'l3', label: 'leaf 3' },
        { id: 'l4', label: 'leaf 4' },
        { id: 'root', label: 'root result' },
      ],
      [
        { id: 'us', label: 'US' },
        { id: 'in', label: 'IN' },
        { id: 'br', label: 'BR' },
      ],
      [
        ['120k', '40k', '18k'],
        ['90k', '60k', '21k'],
        ['130k', '30k', '10k'],
        ['80k', '45k', '11k'],
        ['420k', '175k', '60k'],
      ],
    ),
    highlight: { active: ['l1:us', 'l2:us', 'l3:us', 'l4:us'], found: ['root:us', 'root:in', 'root:br'] },
    explanation: 'Interactive analytics comes from parallel scan plus early aggregation. Each leaf sends compact counts upward, not every matching record. This is the same shape as MapReduce, but optimized for lower-latency SQL-style exploration.',
  };

  yield {
    state: servingTree('Dremel complements batch systems'),
    highlight: { found: ['root', 'm1', 'm2'], compare: ['storage'], active: ['client'] },
    explanation: 'The paper frames Dremel as a complement to MapReduce. Use MapReduce for heavy batch pipelines; use Dremel when analysts need interactive scans over columnar read-only data.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'columnar nested records') yield* columnarNestedRecords();
  else if (view === 'serving tree query') yield* servingTreeQuery();
  else throw new InputError('Pick a Dremel view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Dremel is Google\'s interactive ad-hoc query system for large read-only nested datasets. It combines a columnar representation for nested records with a multi-level execution tree, enabling aggregation queries over very large datasets with high parallelism.',
        'The case study matters because it shows that data layout and execution topology are inseparable. Columnar storage reduces bytes read. The serving tree reduces data movement. Together they make interactive analysis possible on data that would be too slow to scan row by row.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Dremel stores nested data column by column. Repetition and definition levels preserve the structure of repeated and optional fields. Queries read only the columns they need, then leaves scan shards and send partial aggregates up a serving tree of mixers and root servers.',
        'The system complements MapReduce. Batch pipelines can produce curated datasets; Dremel lets users ask exploratory SQL-like questions over those datasets without writing a batch program for each question.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Dremel is excellent when data is read-heavy, nested, and queried by a subset of columns. It is a poor fit for high-churn transactional updates. The complexity sits in encodings, nested-level reconstruction, query planning, load balancing, straggler behavior, and making approximate interactive exploration honest enough for production decisions.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Dremel became a foundation for Google BigQuery ideas and influenced modern columnar analytics systems. Its design connects to Parquet, columnar warehouses, serverless analytics, log analysis, and feature exploration workflows where users repeatedly aggregate huge read-only datasets.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Columnar does not mean universally faster. It is faster when the query skips many columns or compresses repeated values well. Nested columnar data also has reconstruction costs. Another misconception is that Dremel replaces ETL. In practice, curated datasets, batch pipelines, and interactive engines form a loop.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Google Research Dremel page at https://research.google/pubs/dremel-interactive-analysis-of-web-scale-datasets-2/ and paper PDF at https://research.google.com/pubs/archive/36632.pdf. Study Exchange Operator Parallel Query next to compare Dremel serving-tree fanout with Volcano-style exchange boundaries, then MapReduce Case Study, Bigtable Case Study, Inverted Index, Roaring Bitmaps, Database Indexing, and Feature Store: Offline/Online Consistency.',
      ],
    },
  ],
};
