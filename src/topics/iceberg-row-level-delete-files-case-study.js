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
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for Iceberg Row-Level Delete Files. An Iceberg row-level mutation case study: equality deletes, position deletes, and v3 deletion vectors are tracked by delete manifests and applied during scan planning..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Apache Iceberg row-level deletes exist because analytical tables are stored as large immutable files, but real tables still need mutations. A customer asks for erasure. A CDC feed says `id = 7` was deleted. A merge job discovers that three rows in a Parquet file are no longer visible. Rewriting the whole file for every small delete would turn a row-level change into a file-level tax.',
        'Iceberg already has the table-control-plane pieces: snapshots, manifest lists, manifests, partition specs, sequence numbers, and data-file metadata. Row-level deletes extend that control plane. Instead of immediately rewriting every affected data file, a snapshot can carry delete metadata that readers apply while scanning. The table can move fast on writes and pay some cost later on reads or maintenance.',
        'The design problem is harder than simply keeping a list of deleted ids. Some deletes are keyed by values, some are tied to exact row positions, and some are best represented as bitmaps for one data file. Scan planning must attach the right delete evidence to the right data file without making every query read every delete file. Iceberg solves this by treating delete information as table data tracked through delete manifests.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The obvious approach is copy-on-write. When a delete touches rows in a file, read the file, remove those rows, write a replacement file, and commit a snapshot that drops the old file. This is simple for readers. They only scan live data files. It is also attractive because compaction and delete application happen at the same time.',
        'The wall is write amplification. If a 512 MB Parquet file contains one deleted row, copy-on-write rewrites 512 MB to remove one row. A CDC stream with many small deletes can spend most of its compute rewriting cold data. For high-ingest lakehouse tables, that can make row-level mutation too expensive to use continuously.',
        'The other naive approach is a global tombstone table keyed by primary key. That helps CDC deletes, but Iceberg tables do not always have primary keys, and not every delete is naturally a key delete. A delete produced by file compaction may know exact row positions. A delete produced by a privacy workflow may be an equality condition over one or more columns. A delete produced by a v3 writer may be a bitmap for a single file. One structure cannot represent all of those cases efficiently.',
        'Iceberg therefore needs multiple delete encodings and a planner that can decide which delete metadata applies to each selected data file. That is why row-level deletes are a scan-planning topic, not only a storage-format topic.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is merge-on-read. A data file does not have to be physically rewritten before the table can hide rows from new snapshots. A visible row is a data-file row that survives every delete artifact that applies to it in the chosen snapshot.',
        'That makes delete metadata part of table state. A snapshot points through a manifest list to data manifests and delete manifests. Delete manifests track equality delete files, position delete files, and, in Iceberg v3, deletion-vector metadata. During planning, the engine does not merely choose data files. It also attaches the delete filters or masks that must be applied while reading those files.',
        'Iceberg uses different encodings because the cheapest delete representation depends on what the writer knows. If the writer knows values such as `customer_id = 7`, equality deletes are natural. If the writer knows a file path and row positions, position deletes are precise. If the writer is maintaining v3 row-position deletes for one file, a deletion vector gives direct bitmap membership checks during scanning.',
      ],
    },
    {
      heading: 'Delete formats',
      paragraphs: [
        'Equality delete files identify rows by values in one or more columns. Iceberg uses field IDs, not just column names, so the delete can still be interpreted across schema evolution. A row is deleted if the delete file applies to the data file and the row matches all equality columns in one delete row. Equality deletes fit CDC streams because the upstream system often knows business keys but not Parquet row positions.',
        'Position delete files identify rows by data-file path and ordinal row position. This is precise. A reader scanning that file can skip row position 10, 273, or 9001 without comparing business columns. Position deletes are useful when an engine already located exact rows. The cost is that the delete is tied to the physical file layout. Once the data file is rewritten, old positions no longer describe the replacement file.',
        'Deletion vectors are the v3 direction for position-based deletes. A deletion vector identifies deleted positions inside one referenced data file using a bitmap stored as a Puffin blob. The spec allows at most one deletion vector for a given data file in a snapshot, so writers must merge new position deletes with any existing vector or relevant older position deletes. That rule keeps readers from having to combine many bitmaps for the same file.',
        'Copy-on-write remains the cleanup path. Merge-on-read delete metadata avoids immediate rewrites, but it should not grow forever. Maintenance jobs eventually rewrite files so deleted rows disappear physically, old delete artifacts can be removed from metadata, and readers return to scanning clean files.',
      ],
    },
    {
      heading: 'Scan planning',
      paragraphs: [
        'Scan planning is where the design becomes visible. The planner starts from a snapshot, reads manifest metadata, and selects candidate data files for the query. It must also find delete files or deletion vectors that can affect those data files. A reader that ignores delete manifests is not reading the logical table; it is reading stale physical bytes.',
        'The applicability rules matter. A position delete names a target file and row positions. A deletion vector references one data file. Equality deletes can apply to a set of files based on partition and sequence-number rules, then match rows by column values during the scan. The planner tries to avoid loading delete artifacts that cannot affect the selected data files, because otherwise every query would pay for every delete ever written.',
        'During execution, the reader combines data rows with the attached delete metadata. Equality deletes behave like predicates: if the row values match a delete row, suppress the row. Position deletes behave like a sorted set of row coordinates. Deletion vectors behave like bitmap membership checks. The logical output is the data scan minus the rows masked by applicable delete evidence.',
        'This is why delete-file volume affects read cost. A table can have few data files but many delete files. Planning time, memory use, and row filtering cost can rise even when the base data size is stable. Good engines expose this through table maintenance metrics and rewrite procedures instead of leaving delete buildup invisible.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with a customer table stored in three Parquet files. A CDC feed says customers 7 and 19 were deleted in the source database. The ingestion job does not know which Parquet files contain those customers, and locating exact positions would require scanning data. It writes an equality delete file with `customer_id` values 7 and 19, then commits a new Iceberg snapshot that points to a delete manifest containing that file.',
        'A query now scans file A. The planner sees that the equality delete can apply to file A, so the reader loads the delete keys and suppresses matching rows. File B and file C may also need the same delete filter, depending on partition and sequence metadata. The write was cheap because no data files were rewritten. The read is more expensive because every affected scan must apply the equality delete.',
        'Later, a compaction job rewrites file A. While reading file A, it applies the equality delete and writes a clean replacement file without customer 7. The new snapshot removes old file A, adds the replacement, and can drop delete metadata that no longer applies to the rewritten file. If the job also knows exact row positions for remaining deletes in a v3 table, it may write or update a deletion vector for the target file instead of carrying broad equality predicates forward.',
        'The example shows the economic pattern. Merge-on-read buys time and write efficiency. Rewrite jobs repay that debt by converting accumulated delete metadata into clean data files or compact deletion vectors. A healthy table uses both moves.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is a visibility invariant. For a chosen snapshot, a row is visible if it appears in a live data file and no applicable delete artifact marks it deleted. The snapshot defines both sides of that rule: the data files and the delete metadata. Readers that plan from one snapshot get a stable logical table even while newer snapshots are committed.',
        'Equality deletes work because equality over field IDs is a stable row predicate. If the row has the same values for the delete columns, the row is suppressed. Schema evolution is handled by using Iceberg field IDs and projection rules, not by trusting display names alone. Delete metadata may outlive column renames, so the stable field identity is part of correctness.',
        'Position-based deletes work because Parquet row positions are interpreted relative to the referenced data file. The delete is not saying row number 10 in any file is gone. It is saying row number 10 in this exact file is gone. Deletion vectors tighten the same idea into a bitmap for one data file. The one-vector-per-file rule in a snapshot makes reader behavior simpler: look up the vector for the file and test positions against it.',
        'Maintenance preserves correctness by replacing data and delete evidence together in a new snapshot. A rewrite can materialize deletes into a clean data file, remove obsolete delete artifacts from table metadata, and leave older snapshots intact until expiration. Logical deletion and physical cleanup remain separate, which is the same reason MVCC databases can serve old snapshots while vacuum runs later.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Row-level delete files reduce write amplification but increase read complexity. Equality deletes are cheap to write from CDC data, yet they can be expensive to apply if they match many files or require large in-memory hash sets. Position deletes are precise, but they are tied to physical row positions and are deprecated for new writes in v3 tables. Deletion vectors make execution-time masking efficient, but writers must merge delete state so each data file has at most one vector in a snapshot.',
        'Metadata growth is a real cost. Delete manifests, delete files, Puffin blobs, sequence metadata, and metrics all become part of planning. Many small delete files can make planning slow before row scanning even begins. Many broad equality deletes can make every scan pay a predicate-matching tax. Many tiny deletion-vector blobs can create file-system and object-store overhead even if each bitmap is compact.',
        'Engine support is part of the tradeoff. Iceberg is a table format, but query engines implement readers and writers. A table that uses advanced delete features may work well in one engine and poorly or partially in another if support lags. Production teams need compatibility tests across Spark, Flink, Trino, or whatever engines actually read and write the table.',
        'Rewrite scheduling becomes part of operations. Too little maintenance leaves merge-on-read debt in the hot path. Too much maintenance wastes compute rewriting files that would have been cold. The right schedule depends on delete volume, query frequency, file size, partition layout, and service-level targets for planning and scan latency.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Iceberg row-level deletes win in analytical tables that receive ongoing mutation but still mostly serve scans. CDC landing tables, privacy deletes, slowly changing dimensions, merge-heavy lakehouse tables, fraud-event correction, and feature-training datasets all benefit. The common fit is a table where immediate physical rewrite would be too expensive, but readers can afford some merge-on-read work until maintenance catches up.',
        'They are the wrong fit for high-rate OLTP updates where users expect indexed point reads and millisecond commit latency. A transactional database is better for that. They are also a poor fit when query engines in the organization cannot all read the delete format being written. Table-format features only help if every important reader honors them.',
        'The main misconception is that delete files are equivalent to deleting bytes. They are not. They are logical delete evidence attached to a snapshot. The old rows may still exist physically until rewrite and snapshot expiration remove them. This matters for storage cost, compliance workflows, and mental models. A delete can make a row invisible to current table reads before it removes the row from every underlying object.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The delete-format view shows three different ways to represent the same logical idea: hide this row. Equality deletes use values, position deletes use file coordinates, and deletion vectors use a bitmap for one referenced file. The copy-on-write row is there to show the alternative: rewrite the data now and keep reads simple.',
        'The scan-planning view shows why delete manifests are consulted before execution. A reader has to pair each selected data file with all delete metadata that can affect it. The visible table is not just the data manifest. It is the data manifest plus the delete manifests interpreted under the snapshot rules.',
        'The cost plot is the operational lesson. Merge-on-read keeps writes cheap at first, but read cost grows as delete volume grows. Deletion vectors reduce repeated row-position checks, while compaction and rewrite jobs eventually turn logical deletes into cleaner physical layout.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Iceberg specification at https://iceberg.apache.org/spec/ and Iceberg Puffin spec at https://iceberg.apache.org/puffin-spec/.',
        'Study Apache Iceberg Table Format Case Study first if snapshots, manifest lists, and manifest entries are not yet clear. Study Delta Lake Deletion Vector Bitmap Case Study to compare another lakehouse design for row masks. Study Parquet Page Index Case Study to understand the file-level and page-level metadata readers use before row filtering. Study Roaring Bitmaps because deletion vectors rely on compact bitmap membership. Study MVCC Internals & VACUUM to connect logical deletion, snapshot retention, and physical cleanup.',
      ],
    },
      {
      heading: 'The obvious approach',
      paragraphs: [
        "Name the reasonable first attempt and why teams reach for it.",
        "Then show the exact place that approach stops scaling or starts breaking.",
        "Treat this section as contrast, not a rejection.",
      ],
    },

    {
      heading: 'Where it fails',
      paragraphs: [
        "List the failure modes and the conditions that trigger them.",
        "Most methods have at least one silent failure mode; expose the silent ones.",
        "A method without explicit failure conditions is an invitation for misuse.",
      ],
    },


      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },

      {
        heading: 'Learning map',
        paragraphs: [
          'Before this topic, unlock all prerequisites and define the required preconditions.',
          'After this topic, trace where this idea appears in one larger path on this site.',
          'Use unlock relationships to keep one path and one checkpoint per review cycle.',
        ],
      },

      {
        heading: 'Micro checks',
        paragraphs: [
          {
            type: 'bullets',
            items: [
              'Can you state one invariant in one sentence?',
              'Can you prove one transition with pre and post state?',
              'Can you name one hidden edge case in one line?',
              'Can you transfer this mechanism to a neighboring domain?',
            ],
          },
        ],
      },

      {
        heading: 'Try this now',
        paragraphs: [
          'Build one input manually and predict every step before running the animation.',
          'If your predicted final state matches the animation for iceberg-row-level-delete-files-case-study, continue to the next topic in the same track.'
  ],
      },
],
};
