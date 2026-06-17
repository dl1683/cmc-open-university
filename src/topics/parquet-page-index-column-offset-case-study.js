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
      heading: 'Why this exists',
      paragraphs: [
        'Parquet already helps analytical queries by storing columns separately and by recording row-group metadata in the footer. That is enough to skip large regions when a predicate cannot match a whole row group. The problem is that row groups are deliberately large. A row group may hold hundreds of thousands or millions of rows so scans are efficient, but a selective query may need only a few pages inside it.',
        'The Parquet page index exists to make pruning smaller than a row group. It gives a reader page-level statistics and page byte locations before the reader walks the data pages. The result is not a database index. It is a compact skip map inside a column chunk.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is row-group pruning. Read the Parquet footer, inspect min and max values for each column chunk, skip row groups that cannot match, then scan the selected row groups. This is simple and often effective. If a file is partitioned and sorted well, row-group statistics can remove most data.',
        'The next obvious approach is to inspect page headers while scanning. Older page-level statistics live close to individual pages, so a reader can decode page headers and decide whether the page can match. That is correct, but it still forces the reader to touch each page location to learn whether the page should have been skipped.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is seek planning. If the reader has to process every page header to discover page statistics, it has already done much of the navigation work. On object storage, remote filesystems, or compressed column chunks, touching many small page regions can be slower than the saved decoding work.',
        'The second wall is projected columns. A filter on event_time may decide that only pages 12 and 13 of the event_time column can match. The query still needs amount and merchant columns for the same rows. The reader needs row-range and byte-location metadata to fetch corresponding pages in other columns without scanning the whole row group.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Move page-level decision metadata out of the page stream and into index structures that can be read up front. ColumnIndex answers the question which pages might match this predicate. OffsetIndex answers where are those pages and which row ranges do they cover.',
        'Those two structures have to work together. ColumnIndex without OffsetIndex can identify candidate pages but cannot cheaply jump to them. OffsetIndex without ColumnIndex can locate pages but does not know which pages are worth reading. The pair turns metadata pruning into actual byte avoidance.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A Parquet writer divides a column chunk into data pages. When page indexes are written, the ColumnIndex stores arrays of page-level metadata: minimum values, maximum values, null counts, null-page markers, and boundary-order information. The OffsetIndex stores page locations, compressed page sizes, and first-row indexes.',
        'A reader starts from the footer, discovers the row groups and column chunks, then reads the page index metadata for relevant columns. For a predicate such as event_time between 10:00 and 10:05, it compares the predicate with the min and max values for each event_time page. Pages whose max is before 10:00 or whose min is after 10:05 cannot match.',
        'After ColumnIndex leaves a candidate set, OffsetIndex turns page numbers into byte ranges. If the query projects other columns, the first-row indexes help the reader find corresponding ranges in those columns. The scan becomes a set of selected page reads instead of a full column-chunk walk.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'ColumnIndex is an array-aligned structure. Entry i describes data page i for one column chunk. Its min and max values summarize the page; null metadata handles pages that are all null or contain nulls; boundary order tells whether page boundaries are ordered, descending, unordered, or unknown.',
        'OffsetIndex is also page-aligned. Entry i gives the physical location and compressed size of page i, plus the row index where that page begins. This is what lets a reader issue range requests or seeks for selected pages rather than discovering page positions by scanning headers.',
        'The page index sits below table-format metadata. Iceberg, Delta Lake, Hudi, and catalogs can prune snapshots, partitions, manifests, and files. Row-group statistics prune inside a file. Page indexes prune inside a selected row group. Each layer removes work at a different granularity.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is conservative pruning. A page may be skipped only when metadata proves the predicate cannot be true for any value in that page. If the proof is missing, ambiguous, or weakened by null and NaN behavior, the reader must keep the page as a candidate.',
        'For range predicates, min and max give a simple impossibility test. If page_max is less than the lower bound, every non-null value is too small. If page_min is greater than the upper bound, every non-null value is too large. All other pages survive because they might contain a matching value.',
        'The mechanism is safe because false positives are allowed and false negatives are not. Reading an extra page costs time. Skipping a page that contains a match changes the query result. Page-index pruning is therefore designed as a maybe-match filter, not as proof of membership.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The cost is extra metadata written with the file and extra metadata reads during planning. That cost is worth paying when it avoids data-page IO, decompression, decoding, and vector filtering. It is not worth much when almost every page survives the predicate.',
        'Page size matters. Smaller pages give finer pruning but more metadata and more page-management overhead. Larger pages reduce metadata but make each surviving page cover more rows. Row-group size, page size, sort order, and clustering decide whether the page index has sharp boundaries or broad overlapping ranges.',
        'When data is sorted or clustered by the filtered column, page min/max ranges are tight. A time-window query over a file sorted by event_time may read only a few pages. When data is randomly ordered, every page may span the full time range, and the index cannot remove much.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Page indexes win for selective scans inside large row groups. Time-series tables, event logs sorted by timestamp, clustered IDs, partition files with local ordering, and dashboards that query narrow ranges are good fits.',
        'They also help when object storage range reads are expensive enough that planning exact byte ranges pays off. A query engine can avoid downloading and decoding pages that metadata rules out. The benefit appears as lower scanned bytes, fewer decoded values, and less CPU in filters.',
        'The pattern is useful in lakehouse stacks because it complements higher-level pruning. A table format may choose a small file set for a snapshot, Parquet row-group statistics may choose a row group inside those files, and page indexes may choose a handful of pages inside the row group.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A page index does not make Parquet behave like a B-tree. There is no global search tree over all values. The reader still starts with selected files and row groups. Page indexes only help choose data pages within a column chunk.',
        'It fails when writers do not preserve useful locality. If pages have overlapping min/max ranges, if sort order is unknown, if statistics are missing, or if predicates use expressions the reader cannot compare to stored bounds, most pages remain candidates.',
        'It can also disappoint when the query projects many columns and the selected row ranges fan out across many pages in each projected column. Filtering one column narrowly does not guarantee all other columns can be read as one neat contiguous range.',
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        'Track row groups skipped, pages skipped, selected pages per column, scanned bytes versus file bytes, decoded rows versus total rows, predicate pushdown success, and object-store range-read counts. These numbers show whether the index is reducing work or only adding planning overhead.',
        'Inspect write-time layout when pruning is weak. Check sort columns, clustering keys, row-group size, page size, null distribution, NaN behavior, and whether writers actually emitted page indexes. A reader cannot exploit metadata that was never written.',
        'For correctness, treat page-index bugs as high risk. A bad skip can silently drop rows. Engines should fall back to scanning when metadata is unsupported or inconsistent, and validation jobs should compare indexed and non-indexed scans on representative files.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Parquet Columnar Format first for row groups, column chunks, pages, encodings, compression, and footer metadata. Study Block Range Index Zone Maps for the general min/max pruning pattern. Then study Delta Lake, Apache Iceberg, Apache Hudi, Dremel Query Engine, DuckDB Vectorized Execution, and Polars LazyFrame Query Optimizer.',
        'Official sources: Parquet page-index documentation at https://parquet.apache.org/docs/file-format/pageindex/, column-chunk documentation at https://parquet.apache.org/docs/file-format/data-pages/columnchunks/, and the Apache parquet-format repository at https://github.com/apache/parquet-format/.',
      ],
    },
  ],
};
