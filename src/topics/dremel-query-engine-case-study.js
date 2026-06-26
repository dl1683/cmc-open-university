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
    explanation: 'Start with the pain: logs and protocol-buffer records are nested, but most analytical questions touch only a few fields. A row-store scan drags repeated links through the CPU even when the query only needs country and language.',
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
    explanation: 'Now read the columns as independent streams. Values hold the field payload; repetition and definition levels remember where optional and repeated structure was. The links column is still valid data, but this query can leave it unread.',
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
    explanation: 'The cost model is deliberately analytical. Dremel trades away cheap single-row updates so scans can skip columns, compress similar values, and reconstruct nested records only when the query actually asks for them.',
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
    explanation: 'Read the tree from left to right. The client sends one SQL-like request to the root; mixers fan it out; leaves scan column shards. The tree is there to avoid moving raw records back to one coordinator.',
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
    explanation: 'The important animation move is that data shrinks as it moves upward. Leaves send partial counts, mixers combine them, and the root returns a small grouped result instead of collecting every matching row.',
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the nested-record view as a byte-avoidance proof. Active fields are the columns needed by the query, and removed fields are real data that can stay unread because the SQL expression does not reference them.',
        'Read the serving-tree view from leaves back to the root. The safe inference rule is that a grouped aggregate can send partial counts upward because addition preserves the final count while shrinking the data in flight.',
        {type: "callout", text: "Dremel gets interactivity by avoiding work twice: columnar nested storage skips unused fields, and the serving tree reduces raw scans into partial aggregates near the shards."},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Dremel exists because analysts want interactive aggregation over very large nested records. The records may be logs or protocol buffers with optional fields, repeated fields, and many paths that most queries never touch.',
        'A batch job can answer these questions, but exploration suffers when each question waits for scheduling and a full scan. Dremel keeps the data in a columnar nested layout and sends aggregation through a serving tree so many exploratory queries can finish quickly.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to store each nested record as one row-shaped object. A scan reads the whole object, walks the nested structure, extracts country and language, and moves to the next record.',
        'This works for small data because the representation matches how programmers think about records. It is also easy to update one whole object and easy to return a complete record to a user.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears when queries touch a few fields across many records. If a query counts pages by country, decoding repeated links, headers, debug fields, and unused payloads is wasted IO and CPU.',
        'Parallel row scans do not remove the second wall. If every leaf sends matching raw records to one coordinator, the network and root server handle far more data than the final grouped count requires.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Nested records can be stored as column streams without losing their structure. Dremel stores field values separately and uses definition levels to describe whether optional values exist and repetition levels to describe how repeated values attach to parent records.',
        'The execution insight is that aggregation should happen near the shards. Leaves scan selected columns, mixers combine partial results, and the root returns the small final answer.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A query plan first identifies the paths it needs. For count pages by country and language, the engine reads those columns and can leave links.url untouched unless a predicate or projection uses it.',
        'For optional and repeated fields, the column reader uses definition and repetition levels to reconstruct the logical nesting when needed. That metadata is the price paid for reading a nested field as a column without attaching every parent object to every value.',
        'The serving tree fans the query to leaves that own column shards. Each leaf computes local partial aggregates, each mixer merges child results, and the root merges the smaller summaries into the final table.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The layout works because analytical queries are sparse over fields. When a record has hundreds of possible paths and a query reads five of them, column pruning turns unused fields into bytes that are never loaded.',
        'The serving tree works when the operation has mergeable state. Counts, sums, many histograms, and grouped maps can be combined from partials, so the tree preserves the answer while reducing traffic toward the root.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The read cost is roughly proportional to selected columns, selected row groups, and the work needed to interpret level metadata. If a query reads 3 columns from a 90-column record, the storage layout can avoid most field bytes before CPU work begins.',
        'The complexity cost sits in the reader and planner. Repetition levels, definition levels, null semantics, distinct counts, and nested predicates must be handled exactly, because a fast query that attaches a child value to the wrong parent is wrong.',
        'The serving tree also has distributed cost. Stragglers, hot shards, bad fanout, and root overload can dominate latency even when the storage layout is efficient.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The pattern fits web telemetry, security logs, observability data, product analytics, and large read-only corpora. These workloads scan many records, read a subset of fields, and return aggregates much smaller than the input.',
        'Dremel directly influenced BigQuery-style interactive analytics and the broader use of nested columnar storage. The same mental model appears in Parquet, Arrow-based engines, distributed aggregation, and query profiles that separate scan bytes from shuffle bytes.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Columnar nested storage is a poor center for frequent single-row mutation. A transactional workload that updates whole objects and immediately reads them back wants a different storage shape.',
        'It also fails when queries reconstruct most of each record. If nearly every query reads nearly every field, the level metadata and column assembly work can become extra machinery with little pruning benefit.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose each record averages 1 KB across 100 fields, and a dashboard query needs only country, language, and latency. A row scan over 1 billion records touches about 1 TB before filtering, even if the final answer is a small grouped count.',
        'If those three columns plus level metadata average 40 bytes per record, the Dremel-style scan touches about 40 GB instead of 1 TB. If 1,000 leaves each scan 40 MB and return 200 grouped counters, the root receives summaries rather than raw events.',
        'Correctness comes from the level metadata and merge rule. The column reader preserves which values belong to which records, and the serving tree adds partial counts that would have been counted in the full row scan.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study the Dremel paper, then read Parquet documentation on definition and repetition levels to see how nested columns are encoded in a widely used format. BigQuery architecture notes are useful for the managed service descendant, while query-engine papers explain exchange and aggregation operators.',
        'Next study columnar storage, Parquet, Apache Arrow, vectorized execution, exchange operators, bitmap filters, dictionary encoding, MapReduce, and distributed aggregation. The durable lesson is work avoidance: do not read unused fields and do not ship raw rows when partial state is enough.',
      ],
    },
  ],
};
