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
    explanation: 'A deletion vector splits logical delete from physical rewrite. The Parquet file stays in place, and the Delta log publishes a bitmap descriptor that names the row positions readers must exclude.',
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
    explanation: 'The descriptor is the reader contract. Storage type, path or inline bytes, offset, size, and cardinality are enough to fetch the bitmap and check whether a row position is still live.',
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
    explanation: 'A reader must combine file membership from the Delta snapshot with row membership from the deletion vector. The file can still contain old bytes, but query output is defined by the snapshot mask.',
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
    explanation: 'A purge rewrite materializes the mask into new Parquet files that omit deleted rows. VACUUM is later than the rewrite because old snapshots may still need the old files during the retention window.',
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
      heading: 'How to read the animation',
      paragraphs: [
        'The soft-delete view shows a Delta Lake data file plus a deletion vector. A deletion vector is a compressed set of row positions that should be hidden from the current table snapshot. Active nodes are the log action, descriptor, and bitmap; found nodes are the old Parquet bytes that still exist; removed cells are rows readers must skip.',
        'The safe inference rule is file F with deletion vector D means live rows equal rows in F minus row positions in D. The purge view separates logical deletion from physical cleanup. A row can be absent from query results before its bytes are removed from storage.',
        {type:'callout', text:'Deletion vectors split logical visibility from physical cleanup, making sparse row mutations cheap while preserving a later purge path for the old bytes.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Lakehouse tables store data in large immutable Parquet files, but users still need row-level deletes, updates, and merges. Parquet is efficient because it scans column chunks from stable files. It is expensive when a job must change three rows inside a 1 GB file.',
        'A deletion vector exists to make the logical change small. The transaction log publishes a bitmap descriptor, readers apply the bitmap, and a later maintenance job rewrites the file when cleanup is worth the cost. The table gets fast visibility change now and physical cleanup later.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is copy-on-write. A DELETE reads every affected Parquet file, writes replacement files without the deleted rows, removes the old files from the snapshot, and commits the replacements. Readers stay simple because every visible file contains only live rows.',
        'This approach is correct and often fine for dense changes. If 80 percent of a file is changing, rewriting the file is direct and leaves no read-time mask. The trouble starts when the mutation is sparse.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is write amplification. Deleting 3 rows from a 1 GB Parquet file can require reading about 1 GB and writing about 1 GB just to preserve the other 999,997 rows. The logical change is tiny, but the physical operation copies the whole file.',
        'There is also a scheduling wall. Immediate rewrite makes the user-facing mutation job perform maintenance work under load. If many small CDC corrections arrive, the system spends most of its time copying unchanged bytes instead of publishing table-state changes.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Split row visibility from byte cleanup. A data file can remain physically present while a versioned bitmap says which row ordinals are invisible. The Delta snapshot rule supplies the contract: the log, not the directory listing, defines which file and mask pair a reader must use.',
        'The invariant is local to a file. For each logical file reference, a row ordinal is visible if it is in the file and absent from the current deletion vector. That is enough for all conforming readers to derive the same row set from the same committed metadata.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A DELETE, UPDATE, or MERGE first identifies affected row positions inside each touched Parquet file. With deletion vectors enabled, the writer commits a Delta log action that attaches a deletion-vector descriptor to the file. The descriptor records storage type, path or inline bytes, offset, size, and cardinality.',
        'A reader reconstructs the snapshot from the log, sees that a live file has a deletion vector, loads the bitmap, and filters those row positions while scanning. A later purge job reads the old file, applies the mask, writes a replacement file containing only live rows, and commits a new version. VACUUM deletes old files only after retention allows older snapshots to disappear.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness follows from the snapshot invariant. If version V says file F is live with deletion vector D, then every reader of version V computes F minus D. Bitmap membership is a deterministic predicate on row ordinal, so repeated reads of the same version produce the same logical table.',
        'The bitmap is safe because row positions are stable inside the referenced file. It does not need to understand values, predicates, or partitions. Query predicates still decide which live rows match; the deletion vector only decides which physical row positions are no longer eligible.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'For sparse mutations, write cost drops from file size to bitmap size plus log metadata. If a 1 GB file has 1,000,000 rows and 10 rows are deleted, a plain bitset would need about 125 KB, and a compressed Roaring-style bitmap can be much smaller. The copy-on-write path still moves about 2 GB of I/O for that tiny logical change.',
        'The cost moves to reads and maintenance. Readers must load masks and apply row filters. File statistics may describe deleted rows until purge rewrites the file. If a file accumulates many masked rows, every query pays to scan dead bytes, and rewrite becomes the better behavior.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Deletion vectors fit privacy deletes, late corrections, CDC merges, small updates, and merge-heavy analytical tables. They are useful when the table receives many sparse row-level changes but queries can tolerate a small mask application cost until maintenance runs.',
        'They also help multi-engine lakehouse deployments because the logical update is published through the shared Delta protocol. The catch is that every production reader must support the table feature or fail closed. A reader that ignores the bitmap returns deleted rows.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The design fails as an erasure mechanism if teams confuse logical invisibility with physical deletion. Old bytes can remain in old Parquet files until rewrite and retention cleanup. Compliance workflows must track both query invisibility and storage removal.',
        'It also fails when masks become dense or long-lived. A file with 900,000 deleted rows out of 1,000,000 is mostly dead data. At that point the deletion vector is carrying debt, and every scan pays a read tax until the file is rewritten.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'File F has 1,000,000 rows and is 1 GB. A request deletes row ordinals 10, 42, and 900123. Copy-on-write reads 1 GB, writes a new almost-identical 1 GB file, and commits remove plus add actions; the deletion-vector path commits a descriptor for a bitmap containing three integers.',
        'Now suppose 600,000 rows in F are deleted over time. The deletion vector may still be correct, but the next query reads a 1 GB file to recover only 400,000 live rows. A purge rewrite writes a smaller replacement, removes the masked file from the current snapshot, and lets VACUUM delete old bytes after retention.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are the Delta Lake deletion-vector documentation, the Delta protocol specification, and Databricks documentation on deletion vectors, REORG, OPTIMIZE, and VACUUM. Read them with the split in mind: protocol visibility first, physical cleanup later.',
        'Study Delta Lake Case Study for transaction-log snapshots, Roaring Bitmaps for compressed integer sets, Parquet Columnar Format Case Study for immutable file layout, MVCC Internals and VACUUM for versioned cleanup, and Iceberg Row-Level Delete Files for a contrasting lakehouse design.',
      ],
    },
  ],
};
