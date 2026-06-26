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
  references: [
    { title: 'Apache Iceberg Table Spec', url: 'https://iceberg.apache.org/spec/' },
    { title: 'Iceberg Puffin Spec', url: 'https://iceberg.apache.org/puffin-spec/' },
    { title: 'Row-level Deletes Design (Iceberg GitHub)', url: 'https://github.com/apache/iceberg/blob/main/format/spec.md' },
    { title: 'Iceberg v3: Deletion Vectors', url: 'https://github.com/apache/iceberg/issues/6575' },
  ],
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a visibility rule over immutable data files. Active nodes are the data file or delete artifact being applied, visited nodes are metadata entries already matched during scan planning, and found nodes are rows that remain visible after all applicable deletes. A safe inference is that a row can be hidden from a snapshot before the physical Parquet file is rewritten.',
        {type:'callout', text:'Row deletes stay cheap because Iceberg records delete evidence beside data files and pays the filtering debt during planning, reading, and compaction.'},
      ],
    },
    { heading: 'Why this exists', paragraphs: [
      'Iceberg tables store large immutable data files, often hundreds of megabytes each. Real tables still need row-level mutation for CDC, GDPR erasure, merge statements, fraud correction, and late-arriving fixes. Rewriting a 512 MB file to remove one 200 byte row is a file-level tax on a row-level change.',
      'Row-level delete files exist to record delete evidence without immediately rewriting every affected data file. The table snapshot carries both data-file metadata and delete-file metadata. Readers apply the delete evidence during planning and scanning until compaction rewrites clean files.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is copy-on-write. Read the old file, filter out deleted rows, write a replacement file, and commit a new snapshot that drops the old file and adds the new one. Readers stay simple because they only scan clean data files.',
      'Copy-on-write is good when a large fraction of a file changes or when read simplicity matters more than write cost. It is a poor fit for frequent small deletes scattered across many large files. The writer pays the full file I/O even when the logical change is tiny.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is write amplification. If a CDC batch deletes 100 rows spread across 50 files of 512 MB each, copy-on-write reads about 25 GB and writes about 25 GB to remove a few kilobytes of logical data. A continuous stream can spend more I/O rewriting old files than ingesting new data.',
      'A single global tombstone table also fails. Some writers know business keys, some know exact file positions, and some know bitmaps from a merge operation. One delete representation cannot efficiently serve all those knowledge shapes while preserving Iceberg snapshot semantics.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'The core insight is merge-on-read. A delete can be stored as metadata that makes rows invisible in a snapshot, while physical cleanup is delayed. The visibility invariant is: a row is visible if it is in a live data file for the snapshot and no applicable delete artifact marks it deleted.',
      'Iceberg supports multiple delete encodings because writers know different facts. Equality deletes store column values, position deletes store file path and row position, and deletion vectors store a bitmap of deleted positions for one data file. The snapshot tree decides which evidence applies.',
    ] },
    { heading: 'How it works', paragraphs: [
      'A writer appends delete files and commits a new snapshot that references them through delete manifests. During scan planning, the engine matches delete files to selected data files using partition, sequence number, referenced file path, and delete type. During execution, the reader suppresses rows that match equality predicates, positions, or deletion-vector bits.',
      'Sequence numbers are the safety rail. A delete written at sequence 42 should not hide data written later at sequence 50. The planner applies delete evidence only where the data file is older than the delete and within the delete scope.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'The correctness argument is snapshot isolation plus deterministic applicability. Readers using snapshot S see exactly the data and delete metadata committed in S. Equality deletes apply by stable field ids, position deletes apply to a specific file path and ordinal, and deletion vectors apply to a specific file bitmap.',
      'Maintenance is safe because compaction is another atomic snapshot commit. A rewrite job reads old data plus applicable deletes, writes clean data files, and commits a snapshot that drops obsolete delete metadata. Older snapshots remain valid until snapshot expiration, so readers do not lose their historical view.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Merge-on-read changes who pays. A single-row equality delete may write about 1 KB of delete data instead of rewriting 512 MB, but every later reader of affected files must load and apply that delete evidence. If delete files accumulate, planning time and reader CPU grow even though writes stay cheap.',
      'The cost behavior depends on delete type. Equality deletes are cheap to write but can fan out across many files in a partition. Position deletes and deletion vectors are precise to one file, and deletion vectors give O(1) bitmap membership, but the writer must know row positions.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'Row-level delete files fit CDC landing tables, privacy erasure, merge-on-read updates, slowly changing dimensions, and feature-store cleanup. These workloads are large and mostly analytical, but they receive small ongoing mutations. The table can borrow read cost for a while and repay it through compaction.',
      'They are not a replacement for an OLTP database. If the workload needs indexed point updates with sub-millisecond transactions, Postgres, MySQL, or CockroachDB is the natural system. Iceberg delete files are for analytical tables that need mutation semantics over large immutable files.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'It fails when delete metadata grows faster than compaction. A table with 10,000 delete files can spend too long matching delete manifests to data files before it reads a single row. Users see slow query startup and rising driver memory rather than a clear error.',
      'It also fails at compliance boundaries if teams confuse logical invisibility with physical erasure. A delete file hides a row from table readers, but old bytes remain in old data files until compaction, snapshot expiration, and orphan cleanup remove them. Engine compatibility is another risk because not every reader supports every delete format or Iceberg version.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'A 5 TB orders table has 10,000 files averaging 512 MB. At 18:00, a CDC batch deletes 200 order ids but does not know file positions. Copy-on-write could touch dozens of files; equality delete writes one small Parquet delete file, say 10 KB, and commits snapshot S2 with unchanged data files plus the delete manifest.',
      'At 12:00 the next day, compaction targets a partition with 50 affected files. It reads those files with the equality deletes applied, writes 48 clean replacement files, and commits snapshot S3 that drops obsolete delete metadata for that partition. Before compaction, readers paid filtering cost; after compaction, readers scan clean files again.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources are the Apache Iceberg table spec, Iceberg Puffin spec, and Iceberg row-level delete design material. Study Iceberg snapshots and manifests first, then Roaring bitmaps, Parquet page indexes, Delta Lake deletion vectors, MVCC vacuum, and compaction strategies. The central lesson is deferred cleanup: cheap logical mutation now, physical rewrite later.',
    ] },
  ],
};