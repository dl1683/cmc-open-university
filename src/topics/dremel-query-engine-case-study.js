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
      heading: 'Why this exists',
      paragraphs: [
        "Dremel exists for a specific pain: analysts want interactive answers over enormous nested datasets. The data is often log-like or protocol-buffer-like. Records contain optional fields, repeated fields, and deeply nested structures. The questions, however, usually touch only a few paths: count pages by country, group requests by language, compute an error rate, or inspect one repeated field.",
        "A batch system can answer those questions, but it makes exploration slow. Write a job, wait for scheduling, scan the dataset, materialize output, and repeat for the next question. Dremel was designed as a complement to heavy batch pipelines: keep the data in a form that large scans can read quickly, then fan out SQL-like aggregation work across many machines.",
        "The case study matters because it joins two ideas that are often taught apart. Columnar storage saves work by reading only the fields the query needs. A serving tree saves work by pushing partial aggregation down toward the shards. The speed comes from both layout and execution topology."
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        "The naive approach is to store each nested record as one row-shaped object and scan whole rows for every query. That is easy to understand. A reader pulls a record, decodes it, finds the fields it needs, and moves to the next record. For small data, this is fine.",
        "At Dremel scale, it breaks. If the query only needs country and language, scanning repeated links, payload blobs, debug fields, and unused metadata is wasted IO and CPU. Nested records make the waste worse because the reader may have to walk complex structure just to discover that most of it is irrelevant.",
        "Another naive approach is to parallelize the row scan and send all matching rows back to one coordinator. That improves throughput but creates a new bottleneck. The coordinator receives far more data than the final answer needs. For a count or group by, most raw rows should never leave the leaf machine. The system should ship summaries, not records."
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        "The core insight is that nested structure can be separated from physical row storage. Dremel stores values column by column, including fields inside repeated and optional records. It keeps enough level metadata to reconstruct the nesting when needed, but it does not force every query to rebuild full records.",
        "Definition levels answer whether a value is present at a path. Repetition levels answer where repeated values belong in the original record hierarchy. Together they let a column stream represent nested data without carrying every parent object alongside every value. That is the trick: the query can read a path as a column while the format still remembers how that path fits into records.",
        "The execution insight is equally direct. Leaves scan local column shards. Mixers combine partial aggregates. The root produces the final answer. Each level should reduce data before passing it upward."
      ],
    },
    {
      heading: 'The mechanism',
      paragraphs: [
        "A Dremel-style scan starts with a query plan that identifies the needed columns and expressions. If the query counts pages by country and language, the engine does not need the links.url column unless a predicate or projection references it. The column reader streams values and level metadata for the selected paths.",
        "For repeated fields, the reader uses repetition levels to know whether a value continues the same repeated group or starts a new one. For optional fields, definition levels tell whether the value exists or is null or missing at some depth. This is more complex than a flat column, but it is still cheaper than decoding every full nested record when the query only needs a few paths.",
        "The serving tree handles the distributed part. A root server receives the query and sends work to mixers. Mixers send subqueries to leaf servers that own shards. Leaves scan columns and compute local partials, such as count by country. Mixers merge those partials, and the root merges again. The plan is shaped so that data shrinks as it moves upward."
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        "The nested-record visual proves the waste in a row scan. The repeated links field is real data, but the target query does not need it. A row layout drags it through the scan path anyway. A column layout lets the query touch country and language while leaving links.url unread.",
        "The column table also proves that Dremel did not simply flatten the data and throw away meaning. The definition and repetition metadata is the price paid for nested correctness. Without it, the engine could read values quickly but would not know which repeated child belonged to which parent record or whether an optional path was absent.",
        "The serving-tree visual proves that parallelism alone is not the lesson. The query fans out, but the important motion is the result flowing back as smaller partial aggregates. Leaves do the first reduction. Mixers do the second. The root should never need to collect every row just to compute a grouped count."
      ],
    },
    {
      heading: 'Why the method works',
      paragraphs: [
        "Dremel works because analytical queries are usually sparse over fields and compressible over values. A wide nested record might have hundreds of possible paths. A query often reads a handful. Storing those paths as separate streams turns field pruning into a physical IO win.",
        "It also works because similar values sit near each other in column form. Countries, languages, status codes, booleans, small enums, and repeated tags compress better when stored together. Even when compression is not the main goal, typed column streams make vectorized scanning, predicate evaluation, and aggregation easier than decoding mixed row objects.",
        "The serving tree works because many analytical operations are associative or can be decomposed into partial state. Counts add. Sums add. Many sketches and histograms merge. Grouped aggregation can combine per-shard maps. The tree uses that algebra to keep bandwidth and coordinator load under control."
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        "The cost is that readers become more complex. A flat row reader can hand back one object at a time. A nested column reader must interpret definition levels, repetition levels, column chunks, encodings, and query projection rules. Bugs here are subtle because the output can look plausible while repeated values are attached to the wrong parent.",
        "The layout is also a poor fit for frequent single-row mutation. Dremel was aimed at read-mostly analytical data. If the workload is a transactional application that updates individual records and immediately reads whole objects back, a columnar nested scan engine is the wrong center of gravity.",
        "The serving tree adds distributed execution risks. Hot shards can dominate latency. Stragglers delay the root. Bad mixer placement can overload network links. Stale metadata can send work to the wrong leaves. Partial aggregation must preserve exact query semantics, especially around nulls, repeated fields, and distinct counts."
      ],
    },
    {
      heading: 'Real use cases',
      paragraphs: [
        "Dremel shaped BigQuery-style interactive analytics and influenced the way people think about nested columnar formats. The pattern fits log analysis, product analytics, security telemetry, feature exploration, observability data, and large read-only corpora where most questions aggregate a subset of fields.",
        "A practical example is web telemetry. Each event record might include country, language, device, page, experiment IDs, repeated links, timing spans, error metadata, and request headers. A product analyst asking for daily page views by country should not pay to decode every header and repeated link. A security analyst filtering one nested signal should not ship every matching row to one coordinator before counting.",
        "The same mental model appears in Parquet, columnar warehouses, query engines with exchange operators, and distributed profiles that show scan bytes, shuffle bytes, and partial aggregation."
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        "The first failure mode is assuming columnar always wins. It wins when queries skip fields, scan many rows, compress similar values, and aggregate early. It can lose when queries constantly reconstruct full records, update individual rows, or touch nearly every field.",
        "The second failure mode is flattening nested data without preserving enough structure. Repeated fields are not just arrays of values. They belong to records and parent groups. If the level encoding is wrong, the engine can return counts that are fast and incorrect.",
        "The third failure mode is confusing distributed fanout with efficient execution. A query that fans out to many leaves but returns raw rows to the root is still expensive. The tree is valuable only when leaves and mixers reduce data early."
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        "Study the Dremel paper, columnar storage, Parquet definition and repetition levels, Apache Arrow, vectorized execution, exchange operators, distributed aggregation, bitmap filters, dictionary encoding, and query profiles next. Nearby curriculum topics include Exchange Operator Parallel Query, MapReduce Case Study, Bigtable Case Study, Inverted Index, Roaring Bitmaps, Database Indexing, Apache DataFusion Arrow Query Engine Case Study, and Velox Unified Execution Engine Case Study.",
        "The durable lesson is simple: fast analytics is usually work avoidance. Do not read columns the query does not use. Do not reconstruct nested objects unless the answer requires them. Do not ship raw rows when a shard can send a partial aggregate."
      ],
    },
  ],
};
