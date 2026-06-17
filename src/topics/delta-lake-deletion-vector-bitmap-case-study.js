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
      heading: 'Why this exists',
      paragraphs: [
        'Delta Lake deletion vectors exist because lakehouse tables are built from large immutable columnar files, but users still expect row-level deletes, updates, and merges. Parquet is excellent when a query scans columns from large files. It is awkward when a job needs to remove three rows from a one-gigabyte file.',
        'The table has two different duties. It must make the row disappear from the current logical table quickly, and it must eventually remove old bytes when storage, privacy, or compliance policy requires physical cleanup. Treating those as the same operation makes every small mutation pay the cost of a full file rewrite.',
        'A deletion vector separates the two duties. The Delta transaction log commits a small descriptor that points to a compressed bitmap of invalid row positions. Readers apply that bitmap as part of snapshot reconstruction. Later maintenance can rewrite files and vacuum old data under normal retention rules.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach is rewrite-on-mutation. A DELETE finds every touched Parquet file, writes replacement files without the deleted rows, removes the old files from the Delta snapshot, and commits the new files. This keeps readers simple because every visible file contains only live rows.',
        'The wall is write amplification. A sparse privacy delete, a small CDC correction, or a MERGE that updates a few scattered rows can force large file rewrites. If the same table receives many small row-level changes, the system spends most of its work copying unchanged rows.',
        'A second wall is scheduling. Immediate rewrite makes the mutation job do cleanup work even when the cluster is busy or when a later compaction pass would be cheaper. Deletion vectors let the commit publish the logical change first and let maintenance choose a better rewrite window.',
      ],
    },
    {
      heading: 'Core insight and invariant',
      paragraphs: [
        'The core insight is that a data file and its row-validity mask together define the live rows for that file. The file stores the physical rows. The deletion vector stores the set of row positions that should be ignored for the current table version.',
        'The invariant is simple: live rows for a logical file equal rows in the Parquet file minus positions present in the current deletion vector. If a row position is in the bitmap, a conforming reader must not return that row for that snapshot. If the position is absent, normal file and predicate rules apply.',
        'This turns a row-level mutation into a metadata update instead of an immediate rewrite. The idea is close to MVCC: logical visibility changes first, and physical cleanup can lag behind as long as readers use the right versioned metadata.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'A DELETE, UPDATE, or MERGE first identifies row positions inside affected Parquet files. With deletion vectors enabled, the writer can commit a Delta log action that attaches a deletion-vector descriptor to a file instead of immediately replacing the file. That descriptor is now part of the table snapshot.',
        'The descriptor records how to load the bitmap: storage type, path or inline bytes, offset, size in bytes, and cardinality. The bitmap itself is a compressed 64-bit Roaring-style set of row indexes. It is not a general query index. It is a validity set scoped to one data file in one table version.',
        'A reader builds the Delta snapshot from checkpoints and JSON log actions, discovers that a live file has a deletion vector, loads the bitmap, and filters out those row positions while scanning. Vectorized readers can apply the mask while producing record batches, so downstream operators see only live rows.',
        'Purge is a later mechanism. A rewrite job reads the old file, applies the bitmap, writes a replacement file that contains only live rows, and commits a new version that removes the masked file and adds the replacement. VACUUM can delete old files only after retention allows older snapshots to disappear.',
      ],
    },
    {
      heading: 'What the visuals show',
      paragraphs: [
        'In the soft-delete view, the log descriptor is the publication point. The Parquet file is still an input to the query, but the bitmap changes which row ordinals are visible. The row bytes and the row-validity rule travel together.',
        'The descriptor table is deliberately small. It teaches the minimum metadata a reader needs before it can apply the mask: where the bitmap lives, how many bytes to read, and how many row positions it contains.',
        'The purge-lifecycle view separates three events: logical deletion, rewrite, and old-file removal. A row can be absent from query results before it is absent from storage. That distinction is the source of both the performance win and the compliance risk.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from the Delta snapshot rule. A table version is the result of applying committed log actions. If the log action says file F is live with deletion vector D, then the logical contents of F are defined by F minus D. Readers that understand the protocol all derive the same live row set from the same committed metadata.',
        'The bitmap representation is correct because row positions are stable within the referenced file. A bitmap membership test answers one question: should this ordinal be skipped for this file in this snapshot? It does not need to know the row value, partition value, or query predicate.',
        'Roaring-style compression makes the representation practical. Sparse deletions can be represented as compact integer sets. Dense runs can also compress well. The format keeps membership checks and iteration cheap enough that read-time filtering is usually far less expensive than rewriting a large file for a tiny logical change.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Deletion vectors reduce write IO for small row-level mutations, but they move some cost to reads and maintenance. Readers must load and apply masks. Query planning can be less sharp until files are rewritten because file-level statistics may still describe rows that are no longer visible.',
        'They also add protocol and compatibility cost. Every engine that reads the table must understand deletion vectors or fail safely. A table feature that is correct for one writer can still be an operational hazard if an older reader silently ignores the mask.',
        'The economics depend on mutation density. A handful of deleted rows in many large files is a strong fit. A file whose rows are mostly invalid is carrying bitmap debt: every read pays a filtering cost until purge, and a rewrite may have been cheaper earlier.',
        'Physical cleanup is not instant. REORG, OPTIMIZE-style jobs, or compaction can materialize the delete into new files. VACUUM then removes old files after retention. Shortening retention may reduce storage debt, but it can break time travel and long-running jobs.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Deletion vectors win for sparse row-level mutation in analytical tables: privacy deletes, small corrections, CDC merges, late-arriving updates, and merge-heavy lakehouse workloads. They let mutation jobs commit quickly while file rewrite work moves to a better maintenance window.',
        'They are also useful when many engines share the same table. A committed Delta snapshot can publish row-level visibility without forcing every writer to coordinate a heavy rewrite job at mutation time.',
        'The best deployments treat deletion vectors as temporary visibility metadata, not as a place to store endless table debt. They monitor the backlog and schedule purge work before masked files dominate important scans.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'The biggest misconception is that a deletion vector is physical erasure. It is not. Old row bytes can remain in old Parquet files until rewrite and retention cleanup remove them. A privacy workflow must track query invisibility and storage removal as separate milestones.',
        'Another failure mode is reader mismatch. If an older engine cannot read a table feature, the safe result is a clear failure. The unsafe result is a query that returns rows the current snapshot marks as deleted.',
        'Large or long-lived masks can also harm performance. A query that repeatedly scans files with high-cardinality deletion vectors pays a read tax. A purge job that falls behind can turn a write-saving feature into a read-side liability.',
        'Finally, deletion vectors do not make Parquet a low-latency OLTP store. They help row-level maintenance on analytical files. They are not row locks, secondary indexes, or a replacement for a serving database.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose file F contains one million rows and a privacy request deletes rows 10, 42, and 900123. The transaction can commit a deletion-vector descriptor for F with those three row positions. Snapshot readers still open F, but they apply the bitmap and skip those rows.',
        'Later, a purge job rewrites F into a new Parquet file that omits the three rows. The transaction log removes the old file from the current snapshot and adds the replacement. After the retention period, VACUUM can delete old files. The sequence is fast logical removal first, physical cleanup later.',
        'Now change the example: 900,000 rows in F are invalid. A deletion vector can still represent the mask, but the table is now reading mostly dead data until purge. That is the signal to rewrite sooner.',
      ],
    },
    {
      heading: 'Practical guidance',
      paragraphs: [
        'Operate deletion vectors with three clocks: logical deletion time, rewrite time, and retention cleanup time. Users usually care about query results. Storage, audit, and compliance teams also care about when old bytes stop being reachable.',
        'Track deletion-vector cardinality, masked-row fraction by file, affected-file count, purge backlog, query plans that scan masked files, reader protocol versions, and VACUUM retention. These metrics tell whether the system is saving rewrite cost or quietly moving cost into every read.',
        'Use deletion vectors for sparse mutation. Force or schedule rewrites for dense mutation, hot files, or strict erasure requirements. Before enabling the feature, inventory all production readers and confirm they either support the table protocol or fail closed.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Delta Lake deletion-vector docs at https://docs.delta.io/delta-deletion-vectors/, Delta protocol deletion-vector specification at https://github.com/delta-io/delta/blob/master/PROTOCOL.md, and Databricks deletion-vector docs at https://docs.databricks.com/aws/en/delta/deletion-vectors.',
        'Study Delta Lake Case Study for the transaction log, Roaring Bitmaps for compressed row sets, Parquet Columnar Format Case Study for immutable file layout, MVCC Internals and VACUUM for logical visibility versus cleanup, and Iceberg Row-Level Delete Files for a related lakehouse design.',
      ],
    },
  ],
};
