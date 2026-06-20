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
        'The animation has two views. "Delete formats" walks the metadata graph from snapshot through manifest list to data manifests and delete manifests, then shows the three delete encodings (equality, position, deletion vector) side by side. "Scan planning" shows how a reader attaches delete metadata to data files and applies row-level filtering during execution.',
        {type:'callout', text:'Row deletes stay cheap because Iceberg records delete evidence beside data files and pays the filtering debt during planning, reading, and compaction.'},
        {
          type: 'bullets',
          items: [
            'Active (highlighted) nodes are the current focus: which manifest is being read, which delete format is being compared, or which reader step is executing.',
            'Compare (blue) nodes show the alternative strategy or the metadata path that differs from the active one.',
            'Found (green) nodes are data files -- the physical storage that delete metadata refers to but does not rewrite.',
          ],
        },
        'In the matrix views, rows are delete formats (equality, position, deletion vector, copy-on-write), columns are properties (key type, scope, fit for different workloads). Watch the "fit" column: it shows which workload pattern each format was designed for.',
        {
          type: 'note',
          text: 'The safe inference rule: a visible row is a data-file row that survives all applicable delete metadata in the chosen snapshot. If the animation highlights a delete artifact as "active" against a data file, every matching row in that file is suppressed from query results. The row still exists physically until a rewrite job removes it.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'Iceberg was designed for huge tables. Anything that can be done without rewriting large amounts of data makes the table format more useful for real workloads.',
          attribution: 'Ryan Blue, Iceberg project creator, Tabular/Netflix (2020)',
        },
        'Analytical tables live as large immutable Parquet files on object stores like S3. A single file might hold 512 MB of columnar data representing millions of rows. These tables still need mutations. A customer requests GDPR erasure. A CDC pipeline delivers row-level deletes from a source database. A merge job discovers stale records. A fraud system flags transactions for removal.',
        {
          type: 'table',
          headers: ['Mutation source', 'What the writer knows', 'What the writer does NOT know'],
          rows: [
            ['CDC feed', 'Business key values (customer_id = 7)', 'Which Parquet files contain the row, or its row position'],
            ['GDPR erasure', 'Column equality predicate (email = "x@y.com")', 'How many files are affected or where the row sits physically'],
            ['Compaction job', 'Exact file path and row positions', 'Business key values (may not read all columns)'],
            ['Merge statement', 'Matched rows from a join', 'Whether the source rows changed since the last scan'],
          ],
        },
        'Rewriting a 512 MB file to remove one row is a file-level tax on a row-level change. With thousands of files and continuous CDC, that tax makes mutation prohibitively expensive. Iceberg needs a way to record "these rows are deleted" without touching the data files immediately, then clean up later when the cost is justified.',
        'The design problem is that different writers know different things. A CDC writer knows key values. A compaction job knows file positions. A privacy workflow knows column predicates. No single delete encoding fits every case, so Iceberg provides three -- and tracks all of them through its existing snapshot and manifest machinery.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first instinct is copy-on-write (COW). When a delete touches rows in a file, read the entire file, remove the deleted rows, write a replacement file, and commit a new snapshot that swaps the old file reference for the new one. Readers see only clean data files. No special delete handling is needed at scan time.',
        {
          type: 'diagram',
          text: 'Copy-on-write delete of 1 row from a 512 MB file:\n\n  Before:  snapshot S1 --> manifest --> data_file_A.parquet (512 MB, 2M rows)\n\n  Delete:  "customer_id = 7"  (affects 1 row in file A)\n\n  COW:     Read all 2M rows from file A\n           Filter out customer_id = 7\n           Write data_file_A_v2.parquet (512 MB - ~256 bytes)\n           Commit snapshot S2:\n             - drops data_file_A.parquet\n             - adds data_file_A_v2.parquet\n\n  Cost:    512 MB read + 512 MB write to remove 256 bytes',
          label: 'Copy-on-write rewrites the entire file to delete one row',
        },
        'COW works well for bulk operations where most of the file changes anyway -- partition overwrites, full table rebuilds, or large MERGE statements that touch a high fraction of rows. The result is always a clean table with no reader-side overhead.',
        'The second reasonable attempt is a global tombstone table: a separate table keyed by primary key that lists all deleted row identifiers. Every query joins the data table against the tombstone table to filter dead rows. This is simple to implement and decouples writes from data files.',
        {
          type: 'note',
          text: 'Neither approach is naive. COW is the default strategy in Iceberg v1 and remains the preferred path for batch-oriented workloads. Delta Lake used COW exclusively until introducing deletion vectors in 2023. The problem is not the idea but the access pattern: frequent small deletes against large files.',
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'COW hits a write-amplification wall. A CDC stream that deletes 100 rows per minute across 50 files triggers 50 full-file rewrites per minute. Each rewrite reads and writes hundreds of megabytes to remove a few kilobytes of data. On a 10 TB table with 20,000 files, continuous COW can consume more I/O bandwidth than the analytical queries it supports.',
        {
          type: 'table',
          headers: ['Scenario', 'Files affected', 'COW I/O per batch', 'Merge-on-read I/O per batch'],
          rows: [
            ['1 CDC delete, 1 file', '1', '512 MB read + 512 MB write', '~1 KB delete file write'],
            ['100 CDC deletes, 50 files', '50', '25 GB read + 25 GB write', '~50 KB delete file write'],
            ['GDPR erasure, 200 files', '200', '100 GB read + 100 GB write', '~100 KB delete file write'],
            ['Hourly CDC, 10K files/day', '~10,000', '5 TB read + 5 TB write/day', '~5 MB delete files/day'],
          ],
        },
        'The global tombstone table hits a different wall. Iceberg tables do not always have primary keys. A delete produced by a compaction job may know exact file-and-row positions but not business keys. A delete produced by a privacy workflow may match multiple columns. A delete from a v3 writer may be a bitmap for a single file. One tombstone structure cannot represent all of these efficiently.',
        'The tombstone approach also forces every query to join against the tombstone table, even queries that scan files with no deletes at all. That join cost grows with tombstone volume, not with the data actually being queried.',
        {
          type: 'note',
          text: 'The wall is not theoretical. Netflix reported that COW was impractical for their CDC-heavy Iceberg tables because the write amplification exceeded the I/O budget of their object storage. This motivated the merge-on-read design in Iceberg v2.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat delete evidence as table metadata, not as data rewrites. A data file does not have to be physically rewritten before the table can hide rows from readers. Instead, a snapshot carries delete metadata alongside data-file metadata. The visibility rule becomes: a row is visible if it appears in a live data file AND no applicable delete artifact in the current snapshot marks it deleted.',
        {
          type: 'diagram',
          text: 'Merge-on-read structure:\n\n  snapshot S2\n    |\n    v\n  manifest list\n    |           |\n    v           v\n  data manifest    delete manifest\n    |                |          |           |\n    v                v          v           v\n  data_file_A    eq_del_1    pos_del_2    DV_3\n  (512 MB)       (key vals)  (file+row)  (bitmap)\n\n  Reader for file A must:\n    1. Check eq_del_1: does customer_id match any delete key?\n    2. Check pos_del_2: is this row position in the delete set?\n    3. Check DV_3: is this position set in the deletion vector?\n    4. Emit the row only if it survives all three checks.',
          label: 'Delete metadata lives alongside data metadata in the snapshot tree',
        },
        'This is merge-on-read: writes are cheap (append a small delete file), reads are slightly more expensive (apply delete filters while scanning), and maintenance jobs eventually rewrite files to eliminate the accumulated debt. The key design move is providing three delete encodings because different writers know different things about the rows they are deleting.',
        {
          type: 'code',
          language: 'text',
          text: '// The three delete encodings and when each fits:\n//\n// Equality delete:  DELETE FROM t WHERE customer_id = 7\n//   Writer knows:   column values\n//   Writer does NOT know: which files, which row positions\n//   Stored as:      Parquet file with equality column values\n//   Applied at:     every file in the partition (filtered by sequence number)\n//\n// Position delete:  row 10 in data_file_A.parquet is deleted\n//   Writer knows:   exact file path + row ordinal\n//   Stored as:      Parquet file with (file_path, pos) pairs\n//   Applied at:     the specific referenced file only\n//\n// Deletion vector:  positions {10, 273, 9001} in data_file_A.parquet\n//   Writer knows:   exact file path + set of row positions\n//   Stored as:      Puffin blob containing a Roaring bitmap\n//   Applied at:     the specific referenced file only\n//   Constraint:     at most one DV per data file per snapshot',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The delete lifecycle has three phases: write, plan, and maintain. Each phase interacts with a different part of the Iceberg metadata tree.',
        {
          type: 'table',
          headers: ['Phase', 'Actor', 'What happens', 'Metadata touched'],
          rows: [
            ['Write', 'Ingestion job / engine', 'Append delete file(s) and commit a new snapshot', 'New delete manifest entry in the manifest list'],
            ['Plan', 'Query engine planner', 'Match delete files to data files using partition, sequence number, and file path', 'Read manifest entries; attach applicable deletes to each scan task'],
            ['Execute', 'Query engine reader', 'Apply equality predicates, position sets, or bitmap masks while scanning rows', 'No metadata writes; read-only filter on data + delete files'],
            ['Maintain', 'Compaction / rewrite job', 'Rewrite data files with deletes applied; remove obsolete delete metadata', 'New snapshot with clean data files; old delete manifests dropped'],
          ],
        },
        {
          type: 'diagram',
          text: 'Write phase (equality delete from CDC):\n\n  1. CDC feed delivers: DELETE customer_id IN (7, 19)\n  2. Writer creates eq_delete_001.parquet:\n       | customer_id |\n       |-------------|  \n       |      7      |\n       |     19      |\n  3. Writer appends a delete manifest entry:\n       file: eq_delete_001.parquet\n       content: EQUALITY_DELETES\n       partition: region=us-east\n       sequence_number: 42\n  4. Writer commits snapshot S2 with the updated manifest list.\n\n  Total write cost: ~1 KB (two-row Parquet file + manifest entry)',
          label: 'An equality delete writes a tiny file instead of rewriting data',
        },
        'During scan planning, the engine must decide which delete artifacts apply to each data file. The applicability rules differ by format.',
        {
          type: 'table',
          headers: ['Delete format', 'Applicability rule', 'Scope'],
          rows: [
            ['Equality delete', 'Applies to all data files in the same partition whose data sequence number is less than the delete sequence number', 'Potentially many files'],
            ['Position delete', 'Applies only to the specific data file named in the (file_path, pos) pairs', 'Exactly one file per entry'],
            ['Deletion vector', 'Applies only to the single data file referenced by the DV metadata entry', 'Exactly one file; at most one DV per file per snapshot'],
          ],
        },
        {
          type: 'code',
          language: 'java',
          text: '// Simplified scan-planning pseudocode (Iceberg-style)\nfor (DataFile dataFile : selectedDataFiles) {\n  List<DeleteFile> applicable = new ArrayList<>();\n\n  for (DeleteFile del : deleteManifestEntries) {\n    if (del.contentType() == EQUALITY_DELETES) {\n      // Equality deletes apply to files in the same partition\n      // with a lower data sequence number\n      if (del.partition().equals(dataFile.partition())\n          && dataFile.dataSequenceNumber() < del.sequenceNumber()) {\n        applicable.add(del);\n      }\n    } else if (del.contentType() == POSITION_DELETES) {\n      // Position deletes name the exact target file\n      if (del.referencedDataFile().equals(dataFile.path())) {\n        applicable.add(del);\n      }\n    } else if (del.contentType() == DELETION_VECTOR) {\n      // DVs reference exactly one data file\n      if (del.referencedDataFile().equals(dataFile.path())) {\n        applicable.add(del);\n      }\n    }\n  }\n  // Reader receives dataFile + applicable delete list\n  scanTasks.add(new FileScanTask(dataFile, applicable));\n}',
        },
        'The reader then applies each delete type differently during row emission. Equality deletes act as predicates: load the delete keys into a hash set and suppress matching rows. Position deletes act as a sorted skip list: if the current row position appears in the delete set, skip it. Deletion vectors act as bitmap membership tests: check the bit at the current row position.',
        {
          type: 'note',
          text: 'Sequence numbers are critical for correctness. A data file written at sequence 40 should not be affected by an equality delete written at sequence 38, because the data was written after the delete. The sequence-number filter prevents delete files from retroactively hiding rows that were intentionally inserted later.',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument rests on a visibility invariant: for a given snapshot, a row is visible if and only if it exists in a live data file tracked by that snapshot AND no applicable delete artifact in that snapshot marks it deleted. The snapshot is the unit of consistency. Two concurrent readers using the same snapshot see the same logical table, even if new snapshots are being committed.',
        {
          type: 'table',
          headers: ['Property', 'How delete files preserve it'],
          rows: [
            ['Snapshot isolation', 'Delete manifests are part of the snapshot tree. A reader using snapshot S2 sees exactly the delete files committed by S2, not S3 or S4.'],
            ['Schema evolution safety', 'Equality deletes use Iceberg field IDs, not column names. A column rename does not invalidate existing delete files because field IDs are stable.'],
            ['Position stability', 'Position deletes and DVs reference a specific data file path. The delete is "row 10 in THIS file," not "row 10 in any file." Rewriting the file invalidates old position references, which is why rewrites must also drop the corresponding delete metadata.'],
            ['No retroactive deletion', 'Sequence numbers prevent a delete from hiding data that was written after the delete. Data written at sequence 50 is not affected by a delete at sequence 42.'],
            ['Idempotent maintenance', 'A rewrite job produces a clean data file and removes obsolete delete metadata in a single atomic snapshot commit. Older snapshots remain valid until expiration.'],
          ],
        },
        'Equality deletes work because equality over stable field IDs is a well-defined predicate. The delete file says "suppress any row where field 3 = 7," and that statement remains meaningful across schema evolution, partition changes, and file rewrites. The predicate is a logical fact about the data, not a physical fact about the file layout.',
        'Position-based deletes work because Parquet row positions are deterministic within a file. Row 10 in a given Parquet file is always the same physical row. The delete is scoped to one file path, so it cannot accidentally suppress a row in a different file. Deletion vectors tighten this further: one bitmap per file, enforced by the spec, so the reader does a single bitmap lookup per row instead of scanning multiple position-delete files.',
        {
          type: 'note',
          text: 'The one-DV-per-file constraint is an engineering choice, not a mathematical necessity. It exists to keep reader behavior predictable. Without it, a file could accumulate many small DVs from successive deletes, and the reader would need to union them at scan time. The spec pushes that merge cost to the writer, keeping the reader path simple.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Operation', 'Copy-on-write cost', 'Merge-on-read cost', 'Who pays'],
          rows: [
            ['Single-row delete', 'Read + rewrite entire data file (~512 MB)', 'Write ~1 KB delete file', 'COW: writer; MOR: reader'],
            ['100 scattered deletes', '~50 file rewrites (25 GB I/O)', '~50 KB of delete files', 'COW: writer; MOR: all subsequent readers'],
            ['Full-table scan after deletes', 'Fast (clean files, no filtering)', 'Slower (load delete metadata, apply filters per row)', 'MOR: every scan pays the filter cost'],
            ['Scan planning overhead', 'None (no delete manifests)', 'Must match delete files to data files', 'MOR: planning time grows with delete file count'],
            ['Maintenance (compaction)', 'Already done at delete time', 'Periodic rewrite job to materialize deletes', 'MOR: background I/O cost on a schedule'],
          ],
        },
        'Equality deletes are the cheapest to write but the most expensive to apply. Each equality delete file can affect every data file in its partition, so the reader may need to load a hash set of delete keys and probe it for every row in every matching file. With 1,000 equality delete files across a partition, planning must decide which ones apply to each data file, and the reader must apply them all.',
        'Position deletes are precise (one file only) but carry a per-row comparison cost during scanning. In Iceberg v3, position deletes for new writes are replaced by deletion vectors, which use Roaring bitmaps for O(1) membership checks instead of binary-searching a sorted position list.',
        {
          type: 'table',
          headers: ['Delete format', 'Write cost', 'Read cost per row', 'Metadata growth pattern'],
          rows: [
            ['Equality delete', 'O(1) -- write key values only', 'O(k) -- probe k equality predicates', 'Grows with delete batches; each batch adds a file to check'],
            ['Position delete', 'O(d) -- write d (file, pos) pairs', 'O(log d) -- binary search position list', 'Grows with delete count per file; deprecated in v3 for new writes'],
            ['Deletion vector', 'O(d) -- merge d positions into bitmap', 'O(1) -- bitmap bit test', 'One blob per file; size grows with deleted positions but is compact (Roaring)'],
            ['Copy-on-write', 'O(N) -- rewrite entire file of N rows', 'O(1) -- no filtering needed', 'No delete metadata; data files grow from rewrites'],
          ],
        },
        {
          type: 'note',
          text: 'The practical cost cliff is not in per-row filtering -- it is in planning. A table with 10,000 delete files forces the planner to evaluate applicability for each one against each selected data file. This manifests as slow query startup, high driver memory, and long planning phases in Spark and Trino. Compaction is the cure: it reduces delete file count, not just delete volume.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A retail company runs an Iceberg table called `orders` with 5 TB across 10,000 Parquet files, partitioned by `region`. Three mutation patterns hit the table daily.',
        {
          type: 'diagram',
          text: 'Day 1: Initial state\n\n  snapshot S1 --> manifest list\n    |\n    +-- data manifest: 10,000 files (5 TB)\n    +-- delete manifest: (empty)\n\n  Total delete files: 0\n  Read overhead: 0\n\n---\n\nDay 1, 18:00: CDC batch delivers 200 row deletes\n\n  Writer does NOT know which files contain the deleted order_ids.\n  Writer creates eq_delete_001.parquet with 200 order_id values.\n  Writer commits snapshot S2:\n    +-- data manifest: 10,000 files (unchanged)\n    +-- delete manifest: 1 equality delete file (~10 KB)\n\n  Write cost: ~10 KB\n  Read overhead: every scan of the affected partition\n                 loads the 200-key hash set and probes per row\n\n---\n\nDay 2, 06:00: GDPR erasure request for 3 customers\n\n  Writer creates eq_delete_002.parquet with 3 customer_id values.\n  Writer commits snapshot S3:\n    +-- delete manifest: 2 equality delete files\n\n---\n\nDay 2, 12:00: Compaction job runs\n\n  Job reads data files + applicable deletes for region=us-east.\n  Job rewrites 50 files with deletes applied.\n  Job commits snapshot S4:\n    +-- data manifest: drops 50 old files, adds 48 clean files\n    +-- delete manifest: drops eq_delete_001 and eq_delete_002\n                         (no longer applicable after rewrite)\n\n  Result: region=us-east is clean. No delete files remain.\n  Readers of S4 scan clean files with zero filter overhead.',
          label: 'Three days of mutations: CDC deletes, GDPR erasure, then compaction cleanup',
        },
        'The second pattern uses deletion vectors. A Spark job runs a MERGE statement that identifies 500 rows to update across 30 files. For each affected file, the engine writes a deletion vector (Roaring bitmap of the deleted row positions) and a new data file with the updated rows. The snapshot carries both the DVs (marking old rows dead) and the new data files (containing the replacements).',
        {
          type: 'code',
          language: 'sql',
          text: '-- Spark SQL: MERGE with merge-on-read using deletion vectors\nMERGE INTO orders t\nUSING order_updates s\nON t.order_id = s.order_id\nWHEN MATCHED AND s.status = \'cancelled\' THEN DELETE\nWHEN MATCHED THEN UPDATE SET t.amount = s.amount, t.status = s.status;\n\n-- Under the hood:\n-- 1. Spark identifies 500 matched rows across 30 data files\n-- 2. For each affected file, Spark writes a deletion vector\n--    (Roaring bitmap of deleted row positions)\n-- 3. For MATCHED-UPDATE rows, Spark writes new data files\n--    with the updated values\n-- 4. Snapshot S5 includes:\n--    - 30 deletion vectors (one per affected data file)\n--    - New data files for updated rows\n--    - Unchanged data files carried forward',
        },
        'The third pattern is the maintenance loop. A scheduled compaction job runs every 6 hours, targeting partitions where the ratio of delete files to data files exceeds a threshold. It rewrites affected data files with all deletes applied, producing clean output files and a new snapshot that drops the obsolete delete metadata.',
        {
          type: 'note',
          text: 'The worked example shows the economic cycle: merge-on-read borrows against future read cost to keep writes cheap. Compaction repays that debt by converting accumulated delete metadata into clean data files. A healthy table balances the two. If compaction falls behind, read performance degrades silently until planning or scan time triggers an alert.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['Workload', 'Delete format used', 'Why this format fits'],
          rows: [
            ['CDC landing tables', 'Equality deletes', 'The CDC feed knows business keys but not physical file locations; equality deletes match without scanning data'],
            ['GDPR / right-to-erasure', 'Equality deletes', 'Privacy requests specify column values (email, user_id); the system must delete across all partitions'],
            ['Spark MERGE statements', 'Deletion vectors (v3)', 'The engine locates exact rows during the join phase and can write precise bitmaps per file'],
            ['Slowly changing dimensions', 'Deletion vectors + new data files', 'Old dimension rows are marked deleted; new versions are appended as data files'],
            ['Fraud event correction', 'Equality or position deletes', 'Flagged transactions are removed by key or by exact file position after investigation'],
            ['Feature store cleanup', 'Equality deletes', 'Expired or invalidated feature rows are deleted by entity key across training partitions'],
          ],
        },
        'The common pattern: the table is large, mostly append-only, but receives ongoing small mutations. Analytical queries dominate the read profile. Immediate physical rewrite would cost more I/O than the mutations justify. Readers can tolerate a small per-row filtering cost until compaction catches up.',
        {
          type: 'quote',
          text: 'We moved from copy-on-write to merge-on-read for our CDC tables and reduced write I/O by 95%. The read overhead was measurable but acceptable -- about 3% slower on full scans -- and compaction kept it bounded.',
          attribution: 'Tabular engineering blog, Iceberg merge-on-read benchmarks (2023)',
        },
        'Row-level deletes are the wrong fit for high-rate OLTP workloads with indexed point reads and sub-millisecond commit expectations. A transactional database (Postgres, MySQL, CockroachDB) handles that access pattern natively. They are also the wrong fit when the query engines reading the table do not support the delete format being written -- a table using v3 deletion vectors is unreadable by engines that only understand v2 position deletes.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Delete file proliferation: without compaction, delete files accumulate indefinitely. A table with 50,000 equality delete files forces the planner to evaluate every one against every selected data file. Planning time grows quadratically with (data files * delete files), and some engines load all delete manifests into driver memory before scanning begins.',
            'Equality delete fan-out: a single equality delete file in a large partition can apply to every data file in that partition. If the partition has 1,000 files, the reader must probe the delete hash set for every row in all 1,000 files, even if only one file contains the deleted row. This is the "equality delete broadcast" problem.',
            'Silent read degradation: merge-on-read debt is invisible to users. Queries slow down gradually as delete files accumulate, but no error is raised. Teams that do not monitor delete-file counts or planning time may not notice until a dashboard query that used to take 5 seconds takes 45.',
            'Engine compatibility gaps: Iceberg is a format spec, not a runtime. Spark, Flink, Trino, Presto, and Snowflake implement different subsets of the delete spec at different quality levels. A table that uses deletion vectors written by Spark may not be readable by an older version of Trino that only supports position deletes. Cross-engine compatibility testing is mandatory.',
            'Position delete deprecation: Iceberg v3 deprecates position delete files for new writes in favor of deletion vectors. Tables upgraded from v2 may still contain legacy position deletes that must be read but should not be written. Mixed-format tables require engines to support both paths simultaneously.',
            'Compliance illusion: a delete file makes a row invisible to table readers, but the physical bytes remain in the Parquet data file on S3 until a rewrite job produces a clean replacement and the old file is garbage-collected after snapshot expiration. For true data erasure (GDPR Article 17), the organization must run compaction, expire old snapshots, AND delete orphan files.',
          ],
        },
        {
          type: 'table',
          headers: ['Failure mode', 'Symptom', 'Detection', 'Fix'],
          rows: [
            ['Delete file explosion', 'Query planning takes minutes', 'Monitor delete-file count per partition', 'Run compaction; tune CDC batch size to produce fewer, larger delete files'],
            ['Equality broadcast', 'Full-partition scans slow even for narrow queries', 'Compare scan time with and without delete files', 'Compact affected partitions; consider position deletes or DVs if writer can locate rows'],
            ['Stale DVs after file rewrite', 'DV references a file that no longer exists', 'Validation check on snapshot commit', 'Ensure rewrite jobs atomically drop DV metadata when replacing the referenced file'],
            ['Mixed v2/v3 format', 'Some engines cannot read the table', 'Engine compatibility matrix test', 'Migrate position deletes to DVs during compaction; pin minimum reader version'],
          ],
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'What it covers'],
          rows: [
            ['Apache Iceberg Table Spec, iceberg.apache.org/spec/', 'Authoritative reference for delete file formats, manifest entries, sequence numbers, applicability rules, and the v3 deletion vector extension'],
            ['Iceberg Puffin Spec, iceberg.apache.org/puffin-spec/', 'Binary container format used for deletion vector blobs and other table-level metadata payloads'],
            ['Ryan Blue, "Row-Level Deletes" design doc (Iceberg GitHub)', 'Original design motivation, rejected alternatives, and the merge-on-read architecture decision'],
            ['Jack Ye et al., "Iceberg: The Definitive Guide" (O\'Reilly, 2024)', 'Production patterns for delete file management, compaction scheduling, and engine compatibility'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: study Apache Iceberg Table Format Case Study to understand snapshots, manifest lists, manifest entries, and partition specs -- the metadata tree that delete manifests plug into.',
            'Prerequisite: study Roaring Bitmaps to understand the compressed bitmap structure used inside deletion vectors for O(1) position membership checks.',
            'Contrast: study Delta Lake Deletion Vector Bitmap Case Study to compare how Delta Lake solves the same row-mask problem with a different metadata model (transaction log instead of manifest tree).',
            'Extension: study Parquet Page Index Case Study to understand column-level and page-level statistics that readers use to skip irrelevant pages before applying row-level delete filters.',
            'Deeper: study MVCC Internals and VACUUM to connect Iceberg snapshot retention and delete cleanup to the same logical-delete, deferred-cleanup pattern used by PostgreSQL and other transactional databases.',
          ],
        },
      ],
    },
  ],
};
