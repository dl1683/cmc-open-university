// Delta Lake deletion vectors: row-level soft deletes, Roaring bitmaps,
// Delta log descriptors, and purge/compaction lifecycle.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'delta-lake-deletion-vector-bitmap-case-study',
  title: 'Delta Lake Deletion Vector Bitmap Case Study',
  category: 'Systems',
  summary: 'A Delta Lake row-level mutation case study: deletion vectors mark invalid row positions with compressed bitmaps so DELETE, UPDATE, and MERGE avoid full Parquet rewrites.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['soft delete bitmap', 'purge lifecycle'], defaultValue: 'soft delete bitmap' },
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

function dvGraph(title) {
  return graphState({
    nodes: [
      { id: 'dml', label: 'DML', x: 0.7, y: 3.5, note: 'delete/update' },
      { id: 'log', label: '_delta_log', x: 2.4, y: 2.0, note: 'add action' },
      { id: 'file', label: 'file', x: 2.4, y: 5.0, note: 'Parquet' },
      { id: 'desc', label: 'DV desc', x: 4.4, y: 2.0, note: 'path/off/size' },
      { id: 'bitmap', label: 'bitmap', x: 4.4, y: 5.0, note: 'rows' },
      { id: 'reader', label: 'reader', x: 6.5, y: 3.5, note: 'skip rows' },
      { id: 'opt', label: 'OPTIMIZE', x: 8.5, y: 2.0, note: 'rewrite' },
      { id: 'vacuum', label: 'VACUUM', x: 8.5, y: 5.0, note: 'remove old' },
    ],
    edges: [
      { id: 'e-dml-log', from: 'dml', to: 'log' },
      { id: 'e-dml-file', from: 'dml', to: 'file' },
      { id: 'e-log-desc', from: 'log', to: 'desc' },
      { id: 'e-desc-bitmap', from: 'desc', to: 'bitmap' },
      { id: 'e-file-reader', from: 'file', to: 'reader' },
      { id: 'e-bitmap-reader', from: 'bitmap', to: 'reader' },
      { id: 'e-reader-opt', from: 'reader', to: 'opt' },
      { id: 'e-opt-vacuum', from: 'opt', to: 'vacuum' },
    ],
  }, { title });
}

function overheadPlot(title) {
  return plotState({
    axes: { x: { label: 'deleted rows', min: 0, max: 100 }, y: { label: 'write IO', min: 0, max: 100 } },
    series: [
      { id: 'rewrite', label: 'rewrite', points: [{ x: 1, y: 95 }, { x: 10, y: 95 }, { x: 50, y: 95 }, { x: 100, y: 95 }] },
      { id: 'dv', label: 'DV', points: [{ x: 1, y: 3 }, { x: 10, y: 8 }, { x: 50, y: 35 }, { x: 100, y: 90 }] },
    ],
    markers: [
      { id: 'small', x: 10, y: 8, label: 'fast' },
      { id: 'large', x: 100, y: 90, label: 'rewrite' },
    ],
  }, { title });
}

function* softDeleteBitmap() {
  yield {
    state: dvGraph('A deletion vector soft-deletes rows beside a Parquet file'),
    highlight: { active: ['dml', 'log', 'desc', 'bitmap'], found: ['file'], compare: ['opt'] },
    explanation: 'With deletion vectors enabled, a Delta write can mark row positions as removed without rewriting the whole Parquet file. The Delta log records a descriptor that points to the bitmap.',
    invariant: 'The live table is the Parquet file minus row positions marked by the current deletion vector.',
  };

  yield {
    state: labelMatrix(
      'DV descriptor',
      [
        { id: 'st', label: 'store' },
        { id: 'path', label: 'path' },
        { id: 'off', label: 'off' },
        { id: 'size', label: 'size' },
        { id: 'card', label: 'card' },
      ],
      [
        { id: 'value', label: 'val' },
        { id: 'why', label: 'why' },
      ],
      [
        ['u/i/p', 'where'],
        ['uuid', 'locate'],
        ['bytes', 'seek'],
        ['40B', 'read'],
        ['6 rows', 'skip'],
      ],
    ),
    highlight: { active: ['st:value', 'path:value', 'card:value'], found: ['off:why', 'size:why'] },
    explanation: 'The descriptor is small but sufficient: storage type, path or inline bytes, offset, size, and cardinality tell the reader how to find and apply the bitmap.',
  };

  yield {
    state: labelMatrix(
      'Bitmap rows',
      [
        { id: 'r0', label: '0' },
        { id: 'r3', label: '3' },
        { id: 'r4', label: '4' },
        { id: 'r7', label: '7' },
        { id: 'r11', label: '11' },
        { id: 'r18', label: '18' },
      ],
      [
        { id: 'bit', label: 'bit' },
        { id: 'read', label: 'read' },
      ],
      [
        ['0', 'yes'],
        ['1', 'skip'],
        ['1', 'skip'],
        ['1', 'skip'],
        ['1', 'skip'],
        ['1', 'skip'],
      ],
    ),
    highlight: { active: ['r3:bit', 'r4:bit', 'r7:bit'], removed: ['r3:read', 'r4:read', 'r7:read'] },
    explanation: 'Conceptually, a deletion vector is a set of row indexes. In Delta protocol, the set is stored as a compressed 64-bit Roaring bitmap rather than a plain Boolean array.',
  };

  yield {
    state: overheadPlot('Deletion vectors reduce write IO for small mutations'),
    highlight: { active: ['dv', 'small'], compare: ['rewrite', 'large'] },
    explanation: 'The win is largest when a small number of rows in a large file changes. If most rows are invalidated, rewriting the file during compaction or purge becomes the better shape.',
  };
}

function* purgeLifecycle() {
  yield {
    state: dvGraph('Readers merge data files with deletion vectors'),
    highlight: { active: ['file', 'bitmap', 'reader', 'e-file-reader', 'e-bitmap-reader'], compare: ['opt'] },
    explanation: 'Reads must apply deletion vectors to the current snapshot. The file may still contain old row bytes, but query output must omit invalidated row positions.',
  };

  yield {
    state: labelMatrix(
      'Lifecycle',
      [
        { id: 'del', label: 'delete' },
        { id: 'read', label: 'read' },
        { id: 'opt', label: 'opt' },
        { id: 'reorg', label: 'reorg' },
        { id: 'vac', label: 'vac' },
      ],
      [
        { id: 'does', label: 'does' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['write DV', 'compat'],
        ['skip rows', 'read CPU'],
        ['rewrite', 'IO'],
        ['purge', 'new ver'],
        ['delete old', 'travel'],
      ],
    ),
    highlight: { active: ['del:does', 'read:does', 'reorg:does'], compare: ['vac:risk'] },
    explanation: 'Deletion vectors are not physical erasure. REORG or OPTIMIZE-style rewrites can materialize the delete into new files, and VACUUM removes old files after retention.',
  };

  yield {
    state: dvGraph('Purge rewrites affected files and then retention cleans old bytes'),
    highlight: { active: ['opt', 'vacuum', 'e-opt-vacuum'], compare: ['bitmap', 'file'] },
    explanation: 'A purge rewrite creates a new table version whose files omit the deleted rows. Only after retention is satisfied can old files be vacuumed away.',
  };

  yield {
    state: labelMatrix(
      'When to use',
      [
        { id: 'few', label: 'few' },
        { id: 'cdc', label: 'CDC' },
        { id: 'many', label: 'many' },
        { id: 'old', label: 'old' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['great', 'read tax'],
        ['great', 'merge'],
        ['poor', 'rewrite'],
        ['risky', 'clients'],
      ],
    ),
    highlight: { active: ['few:fit', 'cdc:fit'], compare: ['many:fit', 'old:watch'] },
    explanation: 'Deletion vectors are an operational tradeoff. They lower write amplification for small row-level changes while adding reader support requirements and some read-time filtering work.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'soft delete bitmap') yield* softDeleteBitmap();
  else if (view === 'purge lifecycle') yield* purgeLifecycle();
  else throw new InputError('Pick a Delta deletion-vector view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Delta Lake deletion vectors are row-level soft-delete metadata. Instead of rewriting a whole Parquet file when a few rows are deleted or updated, the table stores a compressed bitmap of row positions that are no longer valid for a logical file.',
        'This extends Delta Lake Case Study and Roaring Bitmaps. The table version still comes from the Delta transaction log, but an add or remove action can include a deletion-vector descriptor attached to a data file.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A DELETE, UPDATE, or MERGE identifies row positions inside a Parquet file. With deletion vectors enabled, the writer can commit a descriptor pointing to a bitmap instead of immediately rewriting the file. Readers reconstruct the snapshot and apply the bitmap to skip invalid rows.',
        'The Delta protocol supports inline and on-disk deletion vectors. The descriptor records storage type, path or inline bytes, offset, size in bytes, and cardinality. The underlying bitmap is a compressed 64-bit Roaring-style set of row indexes.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Deletion vectors reduce write amplification for small row-level mutations, but they shift some cost to readers and maintenance. Reads must filter invalid positions. Statistics can become wide rather than tight until files are rewritten. Clients also need protocol support.',
        'Physical removal is a lifecycle. OPTIMIZE, auto-compaction, or REORG TABLE APPLY PURGE can rewrite affected files so deleted rows disappear from new data files. VACUUM later removes old files after retention rules allow it.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A privacy deletion job removes 4,000 user rows scattered across 200 one-gigabyte Parquet files. Without deletion vectors, the job rewrites every touched file. With deletion vectors, it commits small bitmap descriptors quickly. Dashboard reads apply the bitmaps. A nightly purge rewrites the affected files, and a later VACUUM deletes old data after the retention window.',
        'The key decision is mutation density. If each file loses a handful of rows, deletion vectors are excellent. If most rows in a file change, rewriting sooner avoids accumulating read-time filtering overhead.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A deletion vector is not encryption and not instant physical erasure. Old row bytes can remain in old files until rewrite and retention cleanup. For compliance, teams must understand purge and VACUUM timing, not only logical query behavior.',
        'Another trap is interoperability. Enabling deletion vectors upgrades table protocol requirements. Older readers that do not understand the feature may be unable to read the table correctly or at all.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Delta Lake deletion-vector docs at https://docs.delta.io/delta-deletion-vectors/, Delta protocol deletion-vector specification at https://github.com/delta-io/delta/blob/master/PROTOCOL.md, and Databricks deletion-vector docs at https://docs.databricks.com/aws/en/delta/deletion-vectors. Study Delta Lake Case Study, Roaring Bitmaps, Parquet Columnar Format Case Study, MVCC Internals & VACUUM, and Iceberg Row-Level Deletes next.',
      ],
    },
  ],
};
