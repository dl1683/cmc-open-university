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
      heading: 'What it is',
      paragraphs: [
        'Parquet page indexes are optional metadata structures inside a column chunk. ColumnIndex stores statistics such as page-level min and max values. OffsetIndex stores page locations and row ranges. Together they let readers skip individual data pages rather than only entire row groups.',
        'This fills the gap between Block Range Index Zone Maps and Parquet Columnar Format Case Study. Row-group metadata is coarse. Page indexes make the same pruning idea more precise when the file is sorted or clustered well.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A writer emits data pages for a column chunk. It may also write ColumnIndex metadata with per-page bounds and OffsetIndex metadata with byte offsets and first-row indexes. A reader checks the page index before reading page bytes.',
        'For a selective range predicate, the reader uses ColumnIndex to identify candidate pages. It then uses OffsetIndex to seek to the selected pages and to map matching row ranges into the other projected columns.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The important structures are page arrays, page min/max arrays, null-count metadata, boundary order markers, byte-offset tables, compressed-page lengths, and row-range mappings. They are compact enough to read before the data pages themselves.',
        'A page index is not a general secondary index over arbitrary data. It is a physical skip index. Its value depends on clustering, sorting, page size, and predicate selectivity.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A payments table is sorted by event_time inside each row group. A dashboard asks for one five-minute interval and three projected columns. Row-group stats keep the reader inside one row group. ColumnIndex picks only two event_time pages. OffsetIndex tells the reader which byte ranges to fetch for those pages and matching projected-column row ranges.',
        'If the file were randomly ordered, page-level min/max ranges would overlap widely. The page index would still be correct, but most pages would survive pruning and the benefit would collapse.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The common misconception is that page indexes make Parquet behave like a B-tree. They do not. They are metadata for skipping pages in a column chunk, not a separately sorted lookup structure for all values.',
        'Another pitfall is enabling metadata without write-time layout discipline. If pages have broad ranges, null-heavy statistics, or inconsistent sort order, the reader spends metadata work and still reads most of the file.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Parquet page-index documentation at https://parquet.apache.org/docs/file-format/pageindex/, column-chunk documentation at https://parquet.apache.org/docs/file-format/data-pages/columnchunks/, and parquet-format repository at https://github.com/apache/parquet-format/. Study Parquet Columnar Format Case Study, Block Range Index Zone Maps, Apache Iceberg Table Format Case Study, Delta Lake Case Study, and Dremel Query Engine Case Study next.',
      ],
    },
  ],
};
