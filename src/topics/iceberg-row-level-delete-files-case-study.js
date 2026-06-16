// Iceberg row-level deletes: equality deletes, position deletes, deletion
// vectors, delete manifests, and scan planning.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'iceberg-row-level-delete-files-case-study',
  title: 'Iceberg Row-Level Delete Files Case Study',
  category: 'Systems',
  summary: 'An Iceberg row-level mutation case study: equality deletes, position deletes, and v3 deletion vectors are tracked by delete manifests and applied during scan planning.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['delete formats', 'scan planning'], defaultValue: 'delete formats' },
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

function deleteGraph(title) {
  return graphState({
    nodes: [
      { id: 'snap', label: 'snap', x: 0.7, y: 3.5, note: 'v2/v3' },
      { id: 'list', label: 'list', x: 2.3, y: 3.5, note: 'manifests' },
      { id: 'dataMan', label: 'data man', x: 4.0, y: 2.0, note: 'files' },
      { id: 'delMan', label: 'del man', x: 4.0, y: 5.0, note: 'deletes' },
      { id: 'data', label: 'data file', x: 6.0, y: 2.0, note: 'Parquet' },
      { id: 'eq', label: 'eq del', x: 6.0, y: 4.0, note: 'key values' },
      { id: 'pos', label: 'pos del', x: 6.0, y: 5.5, note: 'file+pos' },
      { id: 'dv', label: 'DV', x: 7.8, y: 5.0, note: 'bitmap' },
      { id: 'reader', label: 'reader', x: 9.2, y: 3.5, note: 'filter rows' },
    ],
    edges: [
      { id: 'e-snap-list', from: 'snap', to: 'list' },
      { id: 'e-list-dataMan', from: 'list', to: 'dataMan' },
      { id: 'e-list-delMan', from: 'list', to: 'delMan' },
      { id: 'e-dataMan-data', from: 'dataMan', to: 'data' },
      { id: 'e-delMan-eq', from: 'delMan', to: 'eq' },
      { id: 'e-delMan-pos', from: 'delMan', to: 'pos' },
      { id: 'e-delMan-dv', from: 'delMan', to: 'dv' },
      { id: 'e-data-reader', from: 'data', to: 'reader' },
      { id: 'e-eq-reader', from: 'eq', to: 'reader' },
      { id: 'e-pos-reader', from: 'pos', to: 'reader' },
      { id: 'e-dv-reader', from: 'dv', to: 'reader' },
    ],
  }, { title });
}

function costPlot(title) {
  return plotState({
    axes: { x: { label: 'delete volume', min: 0, max: 100 }, y: { label: 'read cost', min: 0, max: 100 } },
    series: [
      { id: 'eq', label: 'eq', points: [{ x: 0, y: 10 }, { x: 20, y: 30 }, { x: 60, y: 75 }, { x: 100, y: 95 }] },
      { id: 'pos', label: 'pos', points: [{ x: 0, y: 8 }, { x: 20, y: 20 }, { x: 60, y: 45 }, { x: 100, y: 80 }] },
      { id: 'dv', label: 'DV', points: [{ x: 0, y: 7 }, { x: 20, y: 12 }, { x: 60, y: 25 }, { x: 100, y: 55 }] },
    ],
    markers: [
      { id: 'merge', x: 60, y: 25, label: 'merge' },
    ],
  }, { title });
}

function* deleteFormats() {
  yield {
    state: deleteGraph('Iceberg tracks delete data through separate manifests'),
    highlight: { active: ['snap', 'list', 'delMan', 'eq', 'pos', 'dv'], found: ['data'] },
    explanation: 'Iceberg snapshots can include delete manifests in addition to data manifests. The planner must consider delete files or deletion vectors that apply to selected data files.',
    invariant: 'A visible row is a data-file row that survives all applicable delete metadata in the chosen snapshot.',
  };

  yield {
    state: labelMatrix(
      'Delete formats',
      [
        { id: 'eq', label: 'eq' },
        { id: 'pos', label: 'pos' },
        { id: 'dv', label: 'DV' },
        { id: 'copy', label: 'copy' },
      ],
      [
        { id: 'key', label: 'key' },
        { id: 'scope', label: 'scope' },
        { id: 'fit', label: 'fit' },
      ],
      [
        ['cols', 'many files', 'CDC'],
        ['file+row', 'one file', 'rewrite'],
        ['bitmap', 'one file', 'fast read'],
        ['new file', 'one file', 'clean'],
      ],
    ),
    highlight: { active: ['eq:fit', 'pos:key', 'dv:key'], compare: ['copy:fit'] },
    explanation: 'Equality deletes match rows by column values. Position deletes name a data file and row position. Iceberg v3 deletion vectors encode deleted positions as a bitmap for a single data file.',
  };

  yield {
    state: deleteGraph('Delete manifests are scanned early during planning'),
    highlight: { active: ['delMan', 'e-delMan-eq', 'e-delMan-pos', 'e-delMan-dv'], compare: ['dataMan'] },
    explanation: 'The spec separates data and delete manifests because delete metadata is needed before the scan shape is final. A query may need to attach delete filters to each selected data file.',
  };

  yield {
    state: labelMatrix(
      'Format tradeoffs',
      [
        { id: 'eq', label: 'eq' },
        { id: 'pos', label: 'pos' },
        { id: 'dv', label: 'DV' },
        { id: 'rewrite', label: 'rewrite' },
      ],
      [
        { id: 'write', label: 'write' },
        { id: 'read', label: 'read' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['cheap', 'match vals', 'engine'],
        ['cheap', 'row pos', 'v3 dep'],
        ['merge', 'bitmap', 'one/file'],
        ['costly', 'simple', 'amp'],
      ],
    ),
    highlight: { active: ['eq:write', 'dv:read'], compare: ['rewrite:write'] },
    explanation: 'Row-level delete metadata avoids immediate data-file rewrites. The cost moves into scan planning, reader support, compaction, and engine-specific delete handling.',
  };
}

function* scanPlanning() {
  yield {
    state: labelMatrix(
      'Scan planning',
      [
        { id: 'data', label: 'data' },
        { id: 'eq', label: 'eq' },
        { id: 'pos', label: 'pos' },
        { id: 'dv', label: 'DV' },
      ],
      [
        { id: 'match', label: 'match' },
        { id: 'apply', label: 'apply' },
      ],
      [
        ['part A', 'read'],
        ['id=7', 'filter'],
        ['file,row', 'skip'],
        ['bitmap', 'mask'],
      ],
    ),
    highlight: { active: ['eq:apply', 'pos:apply', 'dv:apply'], found: ['data:apply'] },
    explanation: 'Planning attaches the relevant delete information to each data file. During scanning, equality predicates, position sets, or bitmaps decide whether an individual row is returned.',
  };

  yield {
    state: deleteGraph('A reader combines data rows with all matching delete metadata'),
    highlight: { active: ['data', 'eq', 'pos', 'dv', 'reader', 'e-data-reader', 'e-eq-reader', 'e-dv-reader'], compare: ['snap'] },
    explanation: 'The reader path is merge-on-read. It may load equality delete keys, position delete ranges, or a deletion vector bitmap while reading the target data file.',
  };

  yield {
    state: costPlot('Deletion vectors lower repeated row-filter cost'),
    highlight: { active: ['dv', 'merge'], compare: ['eq', 'pos'] },
    explanation: 'A bitmap is efficient at execution time because membership checks are direct. Equality deletes can be attractive for CDC ingestion, but repeated matching across many files can become expensive.',
  };

  yield {
    state: labelMatrix(
      'Maintenance',
      [
        { id: 'small', label: 'small' },
        { id: 'many', label: 'many' },
        { id: 'old', label: 'old' },
        { id: 'mix', label: 'mix' },
      ],
      [
        { id: 'sym', label: 'sym' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['few dels', 'keep'],
        ['slow read', 'rewrite'],
        ['pos v2', 'convert'],
        ['many files', 'compact'],
      ],
    ),
    highlight: { active: ['many:fix', 'old:fix', 'mix:fix'], compare: ['small:fix'] },
    explanation: 'Delete metadata should not grow forever. Compaction and rewrite jobs materialize deletes into clean data files, reduce planning cost, and keep reader behavior predictable.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'delete formats') yield* deleteFormats();
  else if (view === 'scan planning') yield* scanPlanning();
  else throw new InputError('Pick an Iceberg row-level-delete view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Apache Iceberg row-level deletes let a table mark rows as removed without immediately rewriting all affected data files. Iceberg v2 added equality and position delete files. Iceberg v3 adds deletion vectors and deprecates writing new position deletes for v3 tables.',
        'This topic deepens Apache Iceberg Table Format Case Study. The earlier module shows snapshots, manifest lists, and manifests. This module focuses on the row-level delete data structures that sit inside delete manifests.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A snapshot points to manifest lists. Manifest lists point to data manifests and delete manifests. Delete manifests track equality delete files, position delete files, or deletion vector metadata that applies to data files selected for a scan.',
        'Equality deletes store one or more column values that identify deleted rows. Position deletes store a data-file path and row position. Deletion vectors identify deleted row positions for one data file with a bitmap, and Iceberg stores the bitmap through Puffin deletion-vector blobs.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The core structures are delete manifests, equality-delete rows keyed by Iceberg field IDs, position-delete rows sorted by file path and row position, deletion-vector bitmap metadata, referenced data-file paths, and planner-side row filters.',
        'The formats trade write cost against read complexity. Equality deletes are useful for CDC-style key deletes. Position deletes are precise but v3 moves toward deletion vectors. Deletion vectors make execution-time masking cheaper but require writers to maintain at most one vector per data file in a snapshot.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A customer table receives CDC deletes keyed by customer_id. The ingestion job writes equality deletes so it does not have to locate exact row positions immediately. Query readers apply equality predicates while scanning. Later, a maintenance job rewrites hot data files and removes accumulated delete metadata.',
        'For a compaction job that already knows exact row positions in a target file, a deletion vector is more direct: the job merges prior deletes, writes one bitmap for the data file, and records it in delete manifests so readers can mask rows efficiently.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Delete files are not free. They can make reads slower if they accumulate, if equality deletes apply broadly, or if query engines support only part of the spec. A table with many small delete files may need rewrite and compaction more urgently than a table with only append data.',
        'Another misconception is that all row-level delete formats are interchangeable. They encode different information. Equality deletes use values, position deletes use row locations, and deletion vectors use a bitmap for one referenced data file.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Iceberg specification at https://iceberg.apache.org/spec/ and Iceberg Puffin spec at https://iceberg.apache.org/puffin-spec/. Study Apache Iceberg Table Format Case Study, Delta Lake Deletion Vector Bitmap Case Study, Parquet Page Index Case Study, Roaring Bitmaps, and MVCC Internals & VACUUM next.',
      ],
    },
  ],
};
