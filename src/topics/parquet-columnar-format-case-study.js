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
      heading: 'What it is',
      paragraphs: [
        'Apache Parquet is a column-oriented file format for analytical data. It stores data in row groups, each row group contains one column chunk per column, and column chunks contain encoded and compressed pages. Footer metadata describes schema, chunks, encodings, compression, and statistics.',
        'The case-study lesson is physical layout. Row-based formats are simple, but analytics often needs a few columns across many rows. Parquet reorganizes the bytes so query engines can skip unused columns, compress similar values together, and use metadata before scanning.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A writer batches rows into row groups. For each row group, it writes column chunks. Inside chunks, data pages store encoded values, and dictionary pages may store low-cardinality dictionaries. The footer at the end records where chunks live and what statistics describe them.',
        'A reader typically opens the file footer first. It uses schema and row-group metadata to decide which column chunks and pages are needed. If predicates can be answered from min/max statistics, dictionary information, or other metadata, the reader avoids IO for irrelevant regions.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Parquet is fast when write-time layout matches read-time queries. Poor row-group sizes, too many small files, missing statistics, weak sort order, or high-cardinality columns can erase the benefit. Nested data also requires definition and repetition levels, which are powerful but easy to misunderstand.',
        'The format separates metadata from data, but metadata is not free. Large data lakes rely on table formats such as Iceberg or Delta Lake to organize many Parquet files and avoid expensive directory listings.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Parquet is used by Spark, Trino, Hive, DuckDB, Arrow, Delta Lake, Iceberg, Snowflake-style analytics pipelines, feature stores, and ML training data pipelines. It is a default physical layer for batch and interactive analytics.',
        'A complete case study is a payments table with columns timestamp, merchant, country, amount, and status. A dashboard asking for total amount by country does not need merchant text or status. A Parquet reader can inspect footer metadata, select amount and country chunks, and skip row groups outside the time range.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Parquet is not a table format by itself. It stores files, not ACID table history. It also does not guarantee pushdown will help every query. If files are unsorted, statistics are too broad, or every query touches every column, the advantage shrinks. Good Parquet is designed at write time.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Official sources: Apache Parquet concepts at https://parquet.apache.org/docs/concepts/, file format docs at https://parquet.apache.org/docs/file-format/, and format repository at https://github.com/apache/parquet-format/. Study Dremel Query Engine Case Study, Delta Lake Case Study, Apache Iceberg Table Format Case Study, Snowflake Warehouse Case Study, and Database Indexing next.',
      ],
    },
  ],
};
