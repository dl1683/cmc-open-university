// Parquet page indexes: ColumnIndex and OffsetIndex metadata for page-level
// skipping inside a row group.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'parquet-page-index-column-offset-case-study',
  title: 'Parquet Page Index: Column & Offset Case Study',
  category: 'Systems',
  summary: 'A Parquet internals case study: ColumnIndex stores page statistics, OffsetIndex stores byte ranges and row ranges, and selective scans jump directly to useful pages.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['page pruning', 'offset followup'], defaultValue: 'page pruning' },
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

function pageGraph(title) {
  return graphState({
    nodes: [
      { id: 'footer', label: 'footer', x: 0.7, y: 3.5, note: 'metadata' },
      { id: 'rg', label: 'RG', x: 2.2, y: 3.5, note: 'row group' },
      { id: 'chunk', label: 'chunk', x: 3.8, y: 3.5, note: 'column' },
      { id: 'colidx', label: 'col idx', x: 5.5, y: 1.6, note: 'min/max' },
      { id: 'offidx', label: 'off idx', x: 5.5, y: 5.4, note: 'offsets' },
      { id: 'p0', label: 'p0', x: 7.3, y: 1.5, note: 'skip' },
      { id: 'p1', label: 'p1', x: 7.3, y: 3.0, note: 'read' },
      { id: 'p2', label: 'p2', x: 7.3, y: 4.5, note: 'read' },
      { id: 'p3', label: 'p3', x: 7.3, y: 6.0, note: 'skip' },
      { id: 'reader', label: 'reader', x: 9.1, y: 3.8, note: 'scan' },
    ],
    edges: [
      { id: 'e-footer-rg', from: 'footer', to: 'rg' },
      { id: 'e-rg-chunk', from: 'rg', to: 'chunk' },
      { id: 'e-chunk-colidx', from: 'chunk', to: 'colidx' },
      { id: 'e-chunk-offidx', from: 'chunk', to: 'offidx' },
      { id: 'e-colidx-p0', from: 'colidx', to: 'p0' },
      { id: 'e-colidx-p1', from: 'colidx', to: 'p1' },
      { id: 'e-colidx-p2', from: 'colidx', to: 'p2' },
      { id: 'e-colidx-p3', from: 'colidx', to: 'p3' },
      { id: 'e-offidx-p1', from: 'offidx', to: 'p1' },
      { id: 'e-offidx-p2', from: 'offidx', to: 'p2' },
      { id: 'e-p1-reader', from: 'p1', to: 'reader' },
      { id: 'e-p2-reader', from: 'p2', to: 'reader' },
    ],
  }, { title });
}

function rangePlot(title) {
  return plotState({
    axes: { x: { label: 'page', min: 0, max: 4 }, y: { label: 'value', min: 0, max: 100 } },
    series: [
      { id: 'min', label: 'min', points: [{ x: 0, y: 5 }, { x: 1, y: 22 }, { x: 2, y: 45 }, { x: 3, y: 78 }] },
      { id: 'max', label: 'max', points: [{ x: 0, y: 18 }, { x: 1, y: 40 }, { x: 2, y: 70 }, { x: 3, y: 96 }] },
      { id: 'qlo', label: 'q lo', points: [{ x: 0, y: 35 }, { x: 4, y: 35 }] },
      { id: 'qhi', label: 'q hi', points: [{ x: 0, y: 65 }, { x: 4, y: 65 }] },
    ],
    markers: [
      { id: 'hit1', x: 1, y: 40, label: 'hit' },
      { id: 'hit2', x: 2, y: 45, label: 'hit' },
    ],
  }, { title });
}

function* pagePruning() {
  yield {
    state: pageGraph('Page indexes move pruning below the row-group level'),
    highlight: { active: ['footer', 'chunk', 'colidx', 'offidx'], found: ['p1', 'p2'], removed: ['p0', 'p3'] },
    explanation: 'Row-group statistics skip big chunks. A Parquet page index goes finer: for each column chunk, ColumnIndex stores page-level statistics while OffsetIndex tells the reader where those pages live.',
    invariant: 'Page pruning is still metadata pruning, just at a smaller physical unit than a row group.',
  };

  yield {
    state: labelMatrix(
      'ColumnIndex',
      [
        { id: 'p0', label: 'p0' },
        { id: 'p1', label: 'p1' },
        { id: 'p2', label: 'p2' },
        { id: 'p3', label: 'p3' },
      ],
      [
        { id: 'min', label: 'min' },
        { id: 'max', label: 'max' },
        { id: 'nulls', label: 'nulls' },
        { id: 'scan', label: 'scan' },
      ],
      [
        ['5', '18', '0', 'no'],
        ['22', '40', '1', 'yes'],
        ['45', '70', '0', 'yes'],
        ['78', '96', '4', 'no'],
      ],
    ),
    highlight: { active: ['p1:scan', 'p2:scan'], removed: ['p0:scan', 'p3:scan'] },
    explanation: 'For a predicate such as value between 35 and 65, page min/max metadata identifies p1 and p2 as candidates. The skipped pages do not need page-header decoding first.',
  };

  yield {
    state: rangePlot('Only overlapping page ranges survive the predicate'),
    highlight: { active: ['min', 'max', 'qlo', 'qhi', 'hit1', 'hit2'] },
    explanation: 'The visual shape is a set of page intervals. Pages whose max is below the query lower bound or whose min is above the query upper bound are eliminated before data-page reads.',
  };

  yield {
    state: pageGraph('The reader asks for only selected page bytes'),
    highlight: { active: ['offidx', 'p1', 'p2', 'e-offidx-p1', 'e-offidx-p2', 'reader'], compare: ['p0', 'p3'] },
    explanation: 'ColumnIndex decides which pages might match. OffsetIndex turns that decision into byte reads. Without offsets, the reader would know what to skip but still struggle to jump cleanly.',
  };
}

function* offsetFollowup() {
  yield {
    state: labelMatrix(
      'OffsetIndex',
      [
        { id: 'p0', label: 'p0' },
        { id: 'p1', label: 'p1' },
        { id: 'p2', label: 'p2' },
        { id: 'p3', label: 'p3' },
      ],
      [
        { id: 'rows', label: 'rows' },
        { id: 'off', label: 'off' },
        { id: 'len', label: 'len' },
        { id: 'need', label: 'need' },
      ],
      [
        ['0-9k', '12k', '8k', 'no'],
        ['10-19k', '20k', '9k', 'yes'],
        ['20-29k', '29k', '9k', 'yes'],
        ['30-39k', '38k', '8k', 'no'],
      ],
    ),
    highlight: { active: ['p1:off', 'p1:len', 'p2:off', 'p2:len'], compare: ['p0:need', 'p3:need'] },
    explanation: 'OffsetIndex records page locations and row ranges. Once the filter chooses pages, the reader can issue narrow reads instead of walking every page header.',
  };

  yield {
    state: pageGraph('Projected columns need matching row ranges'),
    highlight: { active: ['colidx', 'offidx', 'p1', 'p2', 'reader'], found: ['chunk'] },
    explanation: 'A selective predicate on one column can drive page reads in other projected columns by row range. This is why ColumnIndex and OffsetIndex are a pair, not isolated metadata.',
  };

  yield {
    state: labelMatrix(
      'Reader decisions',
      [
        { id: 'full', label: 'full' },
        { id: 'range', label: 'range' },
        { id: 'point', label: 'point' },
        { id: 'nosort', label: 'unsort' },
      ],
      [
        { id: 'index', label: 'idx?' },
        { id: 'read', label: 'read' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['no', 'all', 'none'],
        ['yes', 'pages', 'false pos'],
        ['yes', 'one page', 'sort req'],
        ['maybe', 'cands', 'wide'],
      ],
    ),
    highlight: { active: ['range:index', 'point:read'], compare: ['full:read', 'nosort:risk'] },
    explanation: 'The page index is not a secondary index. It is most powerful when row groups are sorted or clustered so page-level min/max ranges are tight.',
  };

  yield {
    state: labelMatrix(
      'Lakehouse fit',
      [
        { id: 'pq', label: 'Parq' },
        { id: 'ice', label: 'Ice' },
        { id: 'delta', label: 'Delta' },
        { id: 'dremel', label: 'Dremel' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'link', label: 'link' },
      ],
      [
        ['page skip', 'file bytes'],
        ['manifest', 'file set'],
        ['log stats', 'table ver'],
        ['exec tree', 'scan plan'],
      ],
    ),
    highlight: { active: ['pq:job', 'ice:job', 'delta:job'], found: ['dremel:link'] },
    explanation: 'Page indexes sit at the physical-file layer. Table formats prune files and snapshots; Parquet page indexes prune bytes inside selected files.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'page pruning') yield* pagePruning();
  else if (view === 'offset followup') yield* offsetFollowup();
  else throw new InputError('Pick a Parquet page-index view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the page graph as a two-step decision. Active ColumnIndex nodes decide which pages might match a predicate, and active OffsetIndex nodes turn those page numbers into byte ranges the reader can request.',
        'A page is a compressed block inside one column chunk. The safe inference rule is that a page can be skipped only when its metadata proves no value on that page can satisfy the filter.',
        {type:'callout', text:'The page index turns Parquet metadata into a page-level skip map by separating match decisions from byte locations before the scan begins.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Parquet row-group statistics skip large regions, but row groups are intentionally large for efficient scans. A row group with 1,000,000 rows may contain 100 pages for one column, and a selective query may need only 2 of them.',
        'The page index exists to prune below the row-group level. It lets a reader inspect page statistics and page locations before walking every page header in the column chunk.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to use row-group min and max values from the footer. If the row group cannot match, skip it; otherwise scan the selected column chunks.',
        'A second approach is to read page headers while scanning and use page-level statistics as they appear. That is correct, but it still makes the reader visit each page location to learn whether it should have been skipped.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is seek planning. On object storage, discovering that page 80 should be skipped after walking pages 1 through 79 is too late to plan narrow range reads.',
        'The second wall is projected columns. A timestamp filter may choose pages in the timestamp column, but the query may need matching row ranges from amount and user_id columns too.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate the match decision from the byte-location decision. ColumnIndex stores page-level min, max, null information, and boundary ordering; OffsetIndex stores page offsets, compressed sizes, and first-row indexes.',
        'Together they form a page-level skip map. ColumnIndex says maybe read pages 12 and 13, while OffsetIndex says where those pages live and which row ranges they cover.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A writer emits page indexes for a column chunk. For each data page, ColumnIndex records statistics, and OffsetIndex records physical location and row range.',
        'A reader loads footer metadata, identifies a relevant row group and column chunk, then reads the page index. It compares a predicate against page bounds, builds a candidate page set, and asks OffsetIndex for the exact byte ranges.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is conservative pruning. If page_max is less than a query lower bound, every non-null page value is too small; if page_min is greater than the upper bound, every non-null page value is too large.',
        'False positives are allowed because reading an extra page only costs time. False negatives are not allowed because skipping a matching page changes the query result, so unsupported or ambiguous metadata must keep the page in the candidate set.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is extra metadata at write time and extra planning reads at query time. The benefit appears only if skipped pages save more IO, decompression, decoding, and filtering than the index costs.',
        'Page size controls behavior. If a row group has 1,000,000 rows and pages hold 10,000 rows, the index has about 100 entries for that column; cutting page size in half doubles metadata and improves pruning granularity.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Page indexes fit time-series logs, event tables, sorted ids, locally clustered columns, and dashboards that ask for narrow ranges inside large files. The access pattern is selective scanning within a row group.',
        'They also complement lakehouse metadata. A table format can prune files, Parquet row-group stats can prune row groups, and page indexes can prune bytes inside the surviving row groups.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A page index is not a B-tree. It does not give a global ordered search path across a dataset; it only helps choose pages inside a selected column chunk.',
        'It fails when page bounds overlap heavily. If every page contains values from January through December, a February predicate cannot eliminate any page even though the index is present.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A row group has 1,000,000 events sorted by event_time and split into 100 pages of 10,000 rows. A query asks for events from 10:00 through 10:05 and projects amount.',
        'ColumnIndex for event_time shows pages 42 and 43 overlap that 5-minute range. OffsetIndex says page 42 starts at byte 8,400,000 with length 96,000 and page 43 starts at byte 8,496,000 with length 94,000.',
        'The reader fetches those timestamp pages and matching amount pages for the same row ranges. If the file were unsorted and every page covered the whole hour, all 100 pages would survive and the index would add planning cost without pruning.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Parquet page-index documentation at https://parquet.apache.org/docs/file-format/pageindex/, column-chunk documentation at https://parquet.apache.org/docs/file-format/data-pages/columnchunks/, and the parquet-format repository at https://github.com/apache/parquet-format/. Read them for ColumnIndex, OffsetIndex, null handling, and boundary order.',
        'Next, study Parquet Columnar Format, Block Range Index Zone Maps, Delta Lake, Apache Iceberg, Apache Hudi, Dremel Query Engine, DuckDB Vectorized Execution, and Polars LazyFrame Query Optimizer. These topics show pruning at file, row-group, page, and execution-plan levels.',
      ],
    },
  ],
};