// Apache Parquet: row groups, column chunks, pages, metadata, encoding,
// compression, and predicate pushdown.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'parquet-columnar-format-case-study',
  title: 'Parquet Columnar Format Case Study',
  category: 'Systems',
  summary: 'Parquet as the physical analytics-file lesson: row groups contain column chunks, pages hold encoded values, and footer metadata drives pruning.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['columnar layout', 'predicate pushdown'], defaultValue: 'columnar layout' },
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

function fileGraph(title) {
  return graphState({
    nodes: [
      { id: 'file', label: 'orders.parquet', x: 0.8, y: 4.0, note: 'single file' },
      { id: 'rg1', label: 'row group 1', x: 2.8, y: 2.5, note: 'rows 0-999k' },
      { id: 'rg2', label: 'row group 2', x: 2.8, y: 5.5, note: 'rows 1M-2M' },
      { id: 'ccA', label: 'amount chunk', x: 5.0, y: 1.7, note: 'contiguous bytes' },
      { id: 'ccB', label: 'country chunk', x: 5.0, y: 3.2, note: 'dictionary encoded' },
      { id: 'ccC', label: 'amount chunk', x: 5.0, y: 4.8, note: 'contiguous bytes' },
      { id: 'ccD', label: 'country chunk', x: 5.0, y: 6.3, note: 'dictionary encoded' },
      { id: 'pages', label: 'pages', x: 7.2, y: 4.0, note: 'encoded + compressed' },
      { id: 'footer', label: 'footer metadata', x: 9.4, y: 4.0, note: 'schema + stats' },
    ],
    edges: [
      { id: 'e-file-rg1', from: 'file', to: 'rg1', weight: 'contains' },
      { id: 'e-file-rg2', from: 'file', to: 'rg2', weight: 'contains' },
      { id: 'e-rg1-a', from: 'rg1', to: 'ccA', weight: 'column chunk' },
      { id: 'e-rg1-b', from: 'rg1', to: 'ccB', weight: 'column chunk' },
      { id: 'e-rg2-c', from: 'rg2', to: 'ccC', weight: 'column chunk' },
      { id: 'e-rg2-d', from: 'rg2', to: 'ccD', weight: 'column chunk' },
      { id: 'e-chunks-pages', from: 'ccB', to: 'pages', weight: 'data pages' },
      { id: 'e-pages-footer', from: 'pages', to: 'footer', weight: 'metadata points back' },
    ],
  }, { title });
}

function* columnarLayout() {
  yield {
    state: fileGraph('Parquet groups rows, then stores each column contiguously'),
    highlight: { active: ['rg1', 'ccA', 'ccB'], compare: ['rg2', 'ccC', 'ccD'], found: ['footer'] },
    explanation: 'A Parquet file is organized into row groups. Inside each row group, every column becomes a column chunk. Those chunks are physically contiguous, so a query can read only the columns it needs.',
  };

  yield {
    state: labelMatrix(
      'Logical table versus physical layout',
      [
        { id: 'csv', label: 'CSV/row format' },
        { id: 'parquet', label: 'Parquet' },
        { id: 'query', label: 'query: sum(amount)' },
        { id: 'nested', label: 'nested data' },
      ],
      [
        { id: 'read', label: 'read pattern' },
        { id: 'benefit', label: 'benefit' },
      ],
      [
        ['whole rows', 'simple append and human-readable'],
        ['needed columns', 'less IO for analytics'],
        ['amount chunks only', 'skip unused fields'],
        ['definition/repetition levels', 'columnar nested records'],
      ],
    ),
    highlight: { found: ['parquet:benefit', 'query:benefit'], compare: ['csv:read'] },
    explanation: 'Columnar layout pays off when analytical queries touch a few columns across many rows. It avoids reading unused fields and lets each column use specialized encodings.',
  };

  yield {
    state: labelMatrix(
      'Encoding and compression',
      [
        { id: 'dict', label: 'dictionary' },
        { id: 'rle', label: 'RLE/bit-packing' },
        { id: 'delta', label: 'delta encodings' },
        { id: 'codec', label: 'compression codec' },
      ],
      [
        { id: 'bestFor', label: 'best for' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['low-cardinality strings', 'country/status compress well'],
        ['repeated or small ints', 'levels and booleans shrink'],
        ['ordered numeric values', 'store changes not full values'],
        ['page bytes', 'encode first, compress second'],
      ],
    ),
    highlight: { active: ['dict:lesson', 'rle:lesson'], compare: ['codec:lesson'] },
    explanation: 'Parquet is not just column order. It combines column chunks, pages, encodings, compression, and metadata so the file can be small and still fast to scan.',
  };

  yield {
    state: fileGraph('Footer metadata lets readers plan before scanning data pages'),
    highlight: { active: ['footer'], compare: ['pages', 'ccA', 'ccB'] },
    explanation: 'The file footer stores schema, row-group metadata, column metadata, and statistics. Readers usually fetch the footer first, decide what is relevant, then read selected column chunks.',
    invariant: 'Metadata is physically separate from data pages but controls how the data is read.',
  };
}

function* predicatePushdown() {
  yield {
    state: labelMatrix(
      'Row-group statistics',
      [
        { id: 'rg1', label: 'row group 1' },
        { id: 'rg2', label: 'row group 2' },
        { id: 'rg3', label: 'row group 3' },
        { id: 'query', label: 'query' },
      ],
      [
        { id: 'dateMin', label: 'date min' },
        { id: 'dateMax', label: 'date max' },
        { id: 'countrySet', label: 'country dictionary' },
        { id: 'scan', label: 'scan?' },
      ],
      [
        ['2026-01-01', '2026-01-31', 'US,CA', 'no'],
        ['2026-02-01', '2026-02-28', 'US,IN', 'yes'],
        ['2026-03-01', '2026-03-31', 'BR,DE', 'no'],
        ['Feb + country=US', 'predicate', 'metadata check', 'scan rg2'],
      ],
    ),
    highlight: { found: ['rg2:scan', 'query:scan'], removed: ['rg1:scan', 'rg3:scan'] },
    explanation: 'Predicate pushdown starts with metadata. If min/max statistics or dictionary information prove a row group cannot match, the reader can skip its data pages entirely.',
  };

  yield {
    state: fileGraph('Read only selected columns and selected row groups'),
    highlight: { active: ['rg2', 'ccC', 'footer'], compare: ['rg1', 'ccA', 'ccB'] },
    explanation: 'For a query that needs amount from February rows, the engine can skip row group 1, skip country chunks after planning, and read only the amount chunk for the matching row group. That is the core IO win.',
  };

  yield {
    state: labelMatrix(
      'Write-time choices shape read-time cost',
      [
        { id: 'rowgroup', label: 'row group size' },
        { id: 'sort', label: 'sort/order data' },
        { id: 'stats', label: 'statistics' },
        { id: 'small', label: 'too many tiny files' },
      ],
      [
        { id: 'good', label: 'good outcome' },
        { id: 'bad', label: 'bad outcome' },
      ],
      [
        ['large sequential scans', 'memory pressure if too large'],
        ['tight min/max ranges', 'random writes or skew'],
        ['pruning works', 'null/NaN edge cases'],
        ['parallelism if controlled', 'metadata overhead dominates'],
      ],
    ),
    highlight: { found: ['sort:good', 'stats:good'], compare: ['small:bad'] },
    explanation: 'Parquet performance is decided when files are written. Row-group size, sort order, page size, compression, and file count determine how much data future readers must touch.',
  };

  yield {
    state: labelMatrix(
      'Parquet in the lakehouse stack',
      [
        { id: 'dremel', label: 'Dremel' },
        { id: 'delta', label: 'Delta Lake' },
        { id: 'iceberg', label: 'Iceberg' },
        { id: 'snowflake', label: 'Snowflake' },
      ],
      [
        { id: 'connection', label: 'connection' },
        { id: 'difference', label: 'difference' },
      ],
      [
        ['columnar analytics', 'query engine not file format'],
        ['stores data as Parquet files', 'Delta adds transaction log'],
        ['tracks Parquet files in manifests', 'Iceberg adds table metadata'],
        ['micro-partition lesson', 'warehouse-managed storage'],
      ],
    ),
    highlight: { active: ['delta:connection', 'iceberg:connection'], compare: ['dremel:difference'] },
    explanation: 'Parquet is the physical file layer. Table formats and warehouses build metadata, transactions, governance, and optimization around it.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'columnar layout') yield* columnarLayout();
  else if (view === 'predicate pushdown') yield* predicatePushdown();
  else throw new InputError('Pick a Parquet columnar-format view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Apache Parquet exists because analytical queries read data differently from transactional applications. A transaction often needs one whole row: customer, status, amount, timestamp, address, and so on. An analytical query often needs two or three columns across billions of rows. A row format forces the reader to drag unused bytes through storage, network, decompression, and CPU.',
        'Parquet makes physical layout match analytical access. It groups rows into row groups, stores each column of a row group as a contiguous column chunk, breaks chunks into encoded and compressed pages, and puts metadata in a footer so readers can plan before scanning.',
        'The teaching point is that a file format is a data structure. Parquet is not just "CSV but faster." It is a layout that lets query engines skip columns, skip row groups, compress similar values together, reconstruct nested records, and use write-time metadata as read-time evidence.',
        {type:'callout', text:'Parquet is a file-format data structure: row groups preserve table chunks while column chunks, pages, and footer metadata make analytical scans skip work.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/4/47/Apache_Parquet_logo.svg', alt:'Apache Parquet logo.', caption:'Apache Parquet logo, by The Apache Software Foundation, vectorized by Vulphere, Apache License 2.0 and public-domain text logo notice, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to store rows in the order applications produce them. CSV, JSON lines, and row-oriented binary formats are simple to write and easy to inspect. They work well when each request needs whole records or when files are small enough that wasted IO does not matter.',
        'That approach breaks down for analytics. A query such as "sum amount by country for February" does not need every merchant name, user agent, address, or free-text note. Reading whole rows wastes IO, and compressing mixed fields together misses patterns that appear within one column.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is bytes. At analytical scale, the difference between reading five columns and reading fifty columns is not cosmetic. It changes object-store requests, network transfer, decompression work, CPU cache behavior, and query latency.',
        'The second wall is selectivity. If a predicate can rule out entire row groups from metadata, the engine can avoid touching their data pages. If the file is poorly sorted or row groups have broad min/max ranges, predicate pushdown has little to work with.',
        'The third wall is table management. Parquet is a file format, not a table format. It does not by itself provide ACID commits, snapshot history, compaction planning, partition evolution, or governance. Lakehouse table formats such as Delta Lake and Iceberg build those layers around Parquet files.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Store rows in groups, but lay each group out by column. That compromise gives Parquet enough row locality to manage chunks of a table while giving readers column locality for projection, encoding, compression, and predicate pruning.',
        'The footer turns the file into an index-like object. A reader can fetch metadata, inspect the schema, locate column chunks, examine statistics, and decide which byte ranges to read. Good analytics performance begins before the first data page is decoded.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'The columnar-layout view shows the hierarchy: file, row group, column chunk, page, footer. The key move is inside the row group. Instead of storing row objects contiguously, Parquet stores each column\'s values together so projected queries can read only the needed chunks.',
        'The predicate-pushdown view shows how metadata becomes work avoidance. If row-group statistics prove that February rows cannot exist in row group one or that country=US cannot exist in row group three, the reader can skip those data pages entirely.',
        'The important thing to watch is that write-time choices determine read-time options. Row-group size, sort order, page size, statistics, dictionaries, compression codec, and file size all shape how much the query engine can skip later.',
      ],
    },
    {
      heading: 'How the file is organized',
      paragraphs: [
        'A Parquet writer batches rows into row groups. For each row group, it writes one column chunk per column. A column chunk contains pages. Data pages hold encoded values; dictionary pages can hold mappings for low-cardinality values; metadata records encodings, compression, counts, offsets, and statistics.',
        'The footer sits at the end of the file and describes the schema and row groups. Readers commonly fetch the footer first, then issue range reads for selected chunks. This layout fits object stores and distributed query engines because the engine can plan byte ranges rather than read the file linearly from the top.',
        'Nested data is handled with definition and repetition levels. That sounds like a detail, but it is central. Parquet can store nested records in columnar form while preserving whether fields are null, repeated, or nested inside arrays and structs. The price is conceptual complexity for anyone implementing readers or debugging odd nested schemas.',
      ],
    },
    {
      heading: 'Encoding and compression',
      paragraphs: [
        'Columnar layout makes encoding effective because adjacent values share type and often share distribution. Country codes, statuses, booleans, IDs, timestamps, and sorted numeric values each have encodings that exploit their shape.',
        'Dictionary encoding replaces repeated values with small integer codes. Run-length encoding and bit-packing shrink repeated or small integer values. Delta encodings store changes rather than full values for ordered numeric data. After encoding, a compression codec such as Snappy, Zstd, or Gzip compresses page bytes.',
        'The order matters. Encoding first exposes structure; compression then works on the encoded bytes. A row format that mixes unrelated columns together gives the compressor a harder job and gives the reader fewer ways to skip work.',
      ],
    },
    {
      heading: 'Predicate pushdown',
      paragraphs: [
        'Predicate pushdown means applying filters as close to storage as possible. In Parquet, the reader can compare query predicates against row-group or page metadata. If min and max timestamps for a row group fall outside February, a February query can skip that group. If a dictionary lacks country=US, a country filter can skip that region.',
        'This is not magic. It works only when metadata is trustworthy and selective. If every row group spans the full date range, min/max pruning cannot help. If statistics are missing, too broad, or confused by null and NaN edge cases, the reader must scan more data.',
        'Sorting and clustering are therefore write-time performance features. A table sorted by date lets time filters skip large ranges. A table randomly mixed across years may store the same logical data but force every query to touch every row group.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Imagine a payments table with timestamp, merchant, country, amount, currency, status, card_network, and metadata. A dashboard asks for total amount by country in February. A row file must read every field for each row, even though most fields are irrelevant.',
        'A Parquet reader fetches the footer, finds row groups whose timestamp range overlaps February, selects only country and amount column chunks, and skips merchant, status, card_network, and metadata. If country dictionaries prove that some row groups do not contain the requested countries, those groups can be skipped too.',
        'Now change the write pattern. If files are tiny, footer overhead and object-store listings dominate. If row groups are huge, pruning may be coarse and memory pressure may rise. If the data is sorted by ingestion time but queries filter event time, min/max ranges may be weak. The format is powerful, but layout discipline decides how much power you get.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Parquet works because it aligns physical bytes with common analytical operations: projection, filtering, scanning, compression, and vectorized execution. Projection reads fewer columns. Filtering skips row groups or pages. Encoding and compression shrink column chunks. Vectorized readers decode batches of values efficiently.',
        'It also works because metadata is explicit. The footer tells the reader what exists and where it lives. That lets engines such as Spark, Trino, DuckDB, Arrow, and many lakehouse systems plan IO instead of discovering structure one row at a time.',
        'The deeper lesson is that layout is an algorithm. The same logical table can be cheap or expensive depending on row-group boundaries, sort order, file size, partitioning, and statistics. Parquet exposes those choices rather than hiding them inside a database engine.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Parquet is excellent for scans and analytical reads, but it is not a low-latency row-update format. Rewriting files is common when data changes. Deletes, updates, and merges usually require a table format or engine layer that can track new files, delete files, equality deletes, position deletes, or compaction.',
        'Small files are a classic failure mode. Each file has metadata, object-store overhead, planning overhead, and scheduling overhead. Too many tiny files can make a table slow even when each file is Parquet. Compaction is often as important as compression.',
        'Columnar layout can also hurt row-oriented access. If an application needs one complete record by key, a database index or row store may be a better fit. Parquet shines when many rows are processed in bulk.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Parquet wins in data lakes, warehouses, feature stores, ML training datasets, log analytics, batch ETL, interactive SQL engines, and any workload that reads subsets of columns across many rows. It is one of the default physical layers under Spark, Trino, Hive, DuckDB, Arrow pipelines, Iceberg, Delta Lake, and many managed analytics systems.',
        'It is especially useful when the same data supports many readers. A well-written Parquet table can serve dashboards, model training, audits, and backfills because each reader can project and filter the pieces it needs.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Parquet fails when teams treat it as a complete table system. It stores files. It does not by itself manage concurrent commits, schema evolution policy, transaction logs, partition evolution, or snapshot isolation. Delta Lake, Iceberg, and Hudi exist because a lake needs more than files.',
        'It also fails when write-time layout ignores read-time questions. Unsorted data, missing statistics, high-cardinality dictionary blowups, too many small files, oversized row groups, and mismatched partitioning can turn a good format into a slow table.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'Remember the hierarchy: file, row group, column chunk, page, footer. The footer lets the reader plan. Column chunks let projection skip unused columns. Statistics let filters skip irrelevant row groups. Encodings and compression shrink the bytes that remain.',
        'Remember the boundary too: Parquet is a physical format. Table formats and query engines add transaction semantics, catalogs, planning, governance, and optimization around it.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Official sources: Apache Parquet concepts at https://parquet.apache.org/docs/concepts/, file format docs at https://parquet.apache.org/docs/file-format/, and format repository at https://github.com/apache/parquet-format/. Study Dremel Query Engine Case Study, Delta Lake Case Study, Apache Iceberg Table Format Case Study, Hudi Record Index Metadata Table, Snowflake Warehouse Case Study, Database Indexing, and Bloom Filter next.',
      ],
    },
  ],
};
