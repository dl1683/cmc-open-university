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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the file graph from the footer backward into the byte layout. Active nodes show the row group, column chunk, or page currently read; found nodes are metadata that lets the reader skip work; compare nodes are bytes a row format would still touch.',
        'A row group is a horizontal batch of rows, a column chunk is one column inside that batch, and a page is the encoded unit inside a chunk. The safe inference rule is that a query can skip a chunk only when metadata proves the query does not need it.',
        {type:'callout', text:'Parquet is a file-format data structure: row groups preserve table chunks while column chunks, pages, and footer metadata make analytical scans skip work.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/4/47/Apache_Parquet_logo.svg', alt:'Apache Parquet logo.', caption:'Apache Parquet logo, by The Apache Software Foundation, vectorized by Vulphere, Apache License 2.0 and public-domain text logo notice, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Analytical queries often read a few columns across many rows. A dashboard might need date, country, and amount from 1 billion events while ignoring browser, address, note, and payload fields.',
        'A row file makes the engine read unused fields because each record is stored together. Parquet exists to put like values together so projection, compression, and metadata pruning can remove work before decoding starts.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is CSV, JSON lines, or a row-oriented binary file. That layout is easy to append, easy to inspect, and good when each request needs whole records.',
        'It also matches application writes. Services produce one event or one order at a time, so storing the row as received feels natural until analytical reads become the dominant cost.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is wasted bytes. If a table has 50 columns and the query needs 3, a row format still drags the other 47 through storage, network, decompression, and CPU cache.',
        'The second wall is weak pruning. Without row-group statistics and dictionaries, a filter such as date in February or country equals US cannot skip large physical regions safely.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Store rows in groups, but lay each group out by column. Row groups preserve a manageable table chunk, while column chunks make each queried column a contiguous byte range.',
        'The footer is the planning surface. It stores schema, chunk locations, counts, encodings, compression, and statistics so a reader can decide which byte ranges to request.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A writer buffers rows into a row group, writes one column chunk per column, and splits each chunk into pages. Pages may use dictionary encoding, run-length encoding, bit packing, delta encoding, and then compression.',
        'A reader usually fetches the footer first. It uses the schema to choose projected columns, uses row-group metadata to test filters, then range-reads only selected column chunks and pages.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Projection works because all values for one column chunk are stored together. A sum over amount does not need to read customer_name when those bytes live in a different chunk.',
        'Predicate pruning is conservative. If row_group_max_date is before February, every row in that group is too early, so skipping is correct; if metadata is missing or broad, the reader must scan.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Parquet saves read cost by spending write-time structure. Writers must choose row-group size, page size, sort order, encodings, compression, statistics, and file size.',
        'When rows double, scan cost for one projected column roughly doubles only for the selected chunks, not for the whole table width. Small files add a different cost: each file has footer reads, object-store metadata, planning overhead, and scheduling work.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Parquet fits data lakes, warehouses, feature stores, batch ETL, log analytics, ML training datasets, and SQL engines that scan subsets of columns. The access pattern is bulk reading, not single-row mutation.',
        'It also fits shared datasets. The same Parquet table can support dashboards, backfills, model training, and audits because each reader can project and filter the physical pieces it needs.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Parquet fails as a low-latency row-update format. Updating one record often means writing new files or relying on a table format that tracks deletes, snapshots, and compaction.',
        'It also fails when layout ignores queries. Unsorted data, missing statistics, oversized row groups, too many tiny files, and mismatched partitioning can make a good file format behave like a slow table.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A payments table has 1,000,000,000 rows and 40 columns. A dashboard asks for total amount by country for February, so the logical query needs 2 columns plus a timestamp filter.',
        'If each row averages 400 bytes in a row file, a full scan reads about 400 GB. If Parquet stores amount, country, and timestamp chunks at 8 bytes, 2 bytes, and 8 bytes per row before compression, the same query starts from about 18 GB before pruning and compression.',
        'If sorting by timestamp lets February touch 2 of 12 monthly row-group ranges, the scan may fall near 3 GB before column compression. The exact number depends on encoding and file layout, but the behavior comes from skipping unused columns and irrelevant row groups.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Apache Parquet concepts at https://parquet.apache.org/docs/concepts/, file format docs at https://parquet.apache.org/docs/file-format/, and the format repository at https://github.com/apache/parquet-format/. Read them for the physical hierarchy: file, row group, column chunk, page, footer.',
        'Next, study Parquet Page Index, Dremel Query Engine Case Study, Delta Lake Case Study, Apache Iceberg Table Format Case Study, DuckDB Vectorized Execution, Database Indexing, and Bloom Filter. These topics show how file layout, table metadata, and execution engines combine.',
      ],
    },
  ],
};