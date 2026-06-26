// Apache Iceberg: table snapshots, manifest lists, manifests, delete files,
// partition evolution, and optimistic metadata commits.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'iceberg-table-format-case-study',
  title: 'Apache Iceberg Table Format Case Study',
  category: 'Systems',
  summary: 'Iceberg as the table-metadata lesson: snapshots point to manifest lists, manifests track data/delete files, and catalogs commit atomic table versions.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['snapshot planning', 'schema partition evolution'], defaultValue: 'snapshot planning' },
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

function tableGraph(title) {
  return graphState({
    nodes: [
      { id: 'catalog', label: 'catalog', x: 0.8, y: 4.0, note: 'current metadata pointer' },
      { id: 'meta', label: 'metadata.json', x: 2.8, y: 4.0, note: 'schema + snapshots' },
      { id: 'snap1', label: 'snapshot 101', x: 4.8, y: 2.2, note: 'old table state' },
      { id: 'snap2', label: 'snapshot 102', x: 4.8, y: 5.7, note: 'current table state' },
      { id: 'list', label: 'manifest list', x: 6.7, y: 4.0, note: 'snapshot index' },
      { id: 'manifestA', label: 'manifest A', x: 8.5, y: 2.4, note: 'data files + stats' },
      { id: 'manifestB', label: 'manifest B', x: 8.5, y: 5.5, note: 'delete files + stats' },
      { id: 'files', label: 'Parquet files', x: 10.2, y: 4.0, note: 'data lake objects' },
    ],
    edges: [
      { id: 'e-catalog-meta', from: 'catalog', to: 'meta', weight: 'atomic pointer' },
      { id: 'e-meta-s1', from: 'meta', to: 'snap1', weight: 'history' },
      { id: 'e-meta-s2', from: 'meta', to: 'snap2', weight: 'current' },
      { id: 'e-s2-list', from: 'snap2', to: 'list', weight: 'manifest-list path' },
      { id: 'e-list-a', from: 'list', to: 'manifestA', weight: 'partition stats' },
      { id: 'e-list-b', from: 'list', to: 'manifestB', weight: 'content type' },
      { id: 'e-a-files', from: 'manifestA', to: 'files', weight: 'data paths' },
      { id: 'e-b-files', from: 'manifestB', to: 'files', weight: 'delete paths' },
    ],
  }, { title });
}

function* snapshotPlanning() {
  yield {
    state: tableGraph('An Iceberg table is a graph of metadata files'),
    highlight: { active: ['catalog', 'meta', 'snap2', 'list'], found: ['files'] },
    explanation: 'Iceberg turns a pile of data files into a table by making metadata explicit. A catalog points to a metadata file. The metadata file lists snapshots. A snapshot points to a manifest list, which points to manifests, which point to data and delete files.',
  };

  yield {
    state: labelMatrix(
      'Snapshot planning layers',
      [
        { id: 'catalog', label: 'catalog pointer' },
        { id: 'snapshot', label: 'snapshot' },
        { id: 'manifestList', label: 'manifest list' },
        { id: 'manifest', label: 'manifest file' },
        { id: 'data', label: 'data/delete file' },
      ],
      [
        { id: 'contains', label: 'contains' },
        { id: 'planning', label: 'planning use' },
      ],
      [
        ['current metadata location', 'atomic table commit'],
        ['operation summary + ids', 'time travel'],
        ['manifest-level stats', 'skip irrelevant manifests'],
        ['file rows + metrics', 'skip irrelevant files'],
        ['Parquet/ORC/Avro bytes', 'scan selected splits'],
      ],
    ),
    highlight: { found: ['manifestList:planning', 'manifest:planning'], compare: ['catalog:planning'] },
    explanation: 'The manifest list and manifests are not incidental. They are the table-planning index: avoid opening thousands of files if metadata proves they cannot match the query.',
    invariant: 'A snapshot is the union of files referenced by its manifests.',
  };

  yield {
    state: tableGraph('Deletes are metadata-managed table changes'),
    highlight: { active: ['manifestB', 'e-b-files'], compare: ['manifestA', 'e-a-files'] },
    explanation: 'Iceberg v2 can track row-level deletes using position deletes or equality deletes. Readers combine data files with delete files during planning and scanning, which keeps table mutations separate from immediate data-file rewrites.',
  };

  yield {
    state: labelMatrix(
      'Commit conflict checks',
      [
        { id: 'writerA', label: 'writer A' },
        { id: 'writerB', label: 'writer B' },
        { id: 'catalog', label: 'catalog compare-and-swap' },
        { id: 'retry', label: 'retry path' },
      ],
      [
        { id: 'observed', label: 'observed base' },
        { id: 'outcome', label: 'outcome' },
      ],
      [
        ['metadata v7', 'commit v8'],
        ['metadata v7', 'fails after v8 appears'],
        ['expected pointer', 'atomic swap'],
        ['refresh metadata', 'replan and commit v9'],
      ],
    ),
    highlight: { active: ['catalog:outcome', 'retry:outcome'], compare: ['writerB:outcome'] },
    explanation: 'Iceberg commits by atomically swapping the catalog pointer to a new metadata file. Concurrent writers detect stale base metadata and retry with the latest table state.',
  };
}

function* schemaPartitionEvolution() {
  yield {
    state: labelMatrix(
      'Schema evolution by field IDs',
      [
        { id: 'rename', label: 'rename column' },
        { id: 'add', label: 'add column' },
        { id: 'drop', label: 'drop column' },
        { id: 'reorder', label: 'reorder columns' },
      ],
      [
        { id: 'withoutIds', label: 'name-only risk' },
        { id: 'withIds', label: 'Iceberg field-ID behavior' },
      ],
      [
        ['breaks readers', 'same ID, new name'],
        ['position confusion', 'new ID with defaults/nulls'],
        ['old files ambiguous', 'ID removed from current schema'],
        ['ordinal mismatch', 'IDs preserve meaning'],
      ],
    ),
    highlight: { found: ['rename:withIds', 'reorder:withIds'], compare: ['rename:withoutIds'] },
    explanation: 'Iceberg tracks columns by stable field IDs rather than only by names or positions. That makes schema changes safer across engines and old data files.',
  };

  yield {
    state: labelMatrix(
      'Partition evolution',
      [
        { id: 'old', label: 'old spec' },
        { id: 'new', label: 'new spec' },
        { id: 'mixed', label: 'mixed snapshots' },
        { id: 'query', label: 'query planner' },
      ],
      [
        { id: 'partitioning', label: 'partitioning' },
        { id: 'planner', label: 'planner job' },
      ],
      [
        ['days(ts)', 'read old manifests with old spec'],
        ['hours(ts)', 'read new manifests with new spec'],
        ['both specs live', 'normalize planning'],
        ['ts predicate', 'prune through each spec'],
      ],
    ),
    highlight: { active: ['mixed:planner', 'query:planner'], compare: ['old:partitioning', 'new:partitioning'] },
    explanation: 'Partition layout can evolve without rewriting the whole table. The planner keeps track of which partition spec applies to which files and still prunes correctly.',
  };

  yield {
    state: tableGraph('Time travel follows snapshot history'),
    highlight: { active: ['snap1', 'snap2', 'meta'], compare: ['catalog'] },
    explanation: 'Metadata keeps snapshot history, so readers can ask for an older snapshot as long as retention has not expired its metadata and files. This is the same versioned-root idea as Persistent Segment Tree at lake scale.',
  };

  yield {
    state: labelMatrix(
      'Iceberg compared with neighbors',
      [
        { id: 'delta', label: 'Delta Lake' },
        { id: 'parquet', label: 'Parquet' },
        { id: 'mvcc', label: 'MVCC' },
        { id: 'feature', label: 'Feature Store' },
      ],
      [
        { id: 'shared', label: 'shared idea' },
        { id: 'difference', label: 'difference' },
      ],
      [
        ['snapshot table control plane', 'log format differs'],
        ['columnar data files', 'Iceberg adds table metadata'],
        ['versioned reads', 'metadata roots not row versions'],
        ['point-in-time datasets', 'table format under pipeline'],
      ],
    ),
    highlight: { found: ['delta:shared', 'parquet:difference', 'mvcc:shared'], compare: ['feature:difference'] },
    explanation: 'Iceberg is best understood as a metadata system around files. It does not replace Parquet; it decides which files and delete files make up a consistent table snapshot.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'snapshot planning') yield* snapshotPlanning();
  else if (view === 'schema partition evolution') yield* schemaPartitionEvolution();
  else throw new InputError('Pick an Iceberg table-format view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The snapshot planning view is a metadata graph. The catalog node is the table name service. The metadata JSON node is the current root. A snapshot is a version of the table. A manifest list points to manifests, and manifests point to data and delete files with statistics. Active nodes are the path used to plan the current read.',
        'The schema and partition view shows that Iceberg stores meaning in metadata, not in folder names alone. Field IDs identify columns across renames. Partition specs identify how each file was laid out when it was written. Found nodes mark metadata that lets a reader choose files without listing the whole warehouse.',
        {type:'callout', text:'Iceberg makes the table a versioned metadata root, so snapshots and manifests define the data set instead of directory listing.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/9/95/Apache_Iceberg_Logo.svg', alt:'Apache Iceberg project logo', caption:'Apache Iceberg logo by Sophinie Kim for The Apache Software Foundation, via Wikimedia Commons, Apache License 2.0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Object storage is good at holding immutable files and bad at being a database table by itself. A directory of Parquet files does not say which files form one transaction, which schema produced each file, which deletes apply, or which snapshot a reader should use. Analytical systems need those answers before they can scan safely.',
        'Iceberg exists to make table state explicit over files. It adds metadata roots, snapshots, manifest lists, manifests, partition specs, schema IDs, delete files, and atomic catalog commits. The result is a table format that can support multiple engines without turning object storage into a shared mutable database.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious lake table is a directory layout such as s3://warehouse/orders/date=2026-06-25/*.parquet. Writers add files to partition folders, and readers list folders to discover work. This is easy to understand and works for small append-only data sets.',
        'The approach is not foolish. Folder partitioning gives humans a visible layout and lets readers skip some files. The problem is that listing is discovery, not a transaction, and folder names cannot encode every schema, delete, partition-evolution, and snapshot rule a table needs.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Directory listing hits a consistency wall. A reader can list a partition while a writer has uploaded half the files for a commit. Another writer can publish conflicting files. A failed job can leave orphan files that look real. The directory does not distinguish committed data from abandoned bytes.',
        'It also hits a planning wall. A table with 200,000 files cannot afford to open every footer for every query. If the query asks for one customer and one day, the engine needs metadata that can prove most files are irrelevant before it reads object-store data.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The table is the metadata root, not the storage directory. A catalog points to one current metadata JSON file. That file lists snapshots. Each snapshot points to a manifest list. Each manifest lists data or delete files with partition values, row counts, and column statistics.',
        'This indirection turns file discovery into graph traversal. A reader picks one snapshot and follows only the metadata reachable from that snapshot. A writer creates new files and metadata, then atomically swaps the catalog pointer. Old snapshots remain readable until retention removes them.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Planning starts at the catalog pointer and metadata JSON. The reader chooses the current snapshot or a requested older snapshot. It reads that snapshot\'s manifest list, prunes manifests using partition summaries, then prunes individual files using metrics such as lower bounds, upper bounds, null counts, and row counts.',
        'Writes are optimistic. A writer creates data files, manifests, a manifest list, and a new metadata JSON file. It asks the catalog to publish the new root only if the old root is still current. If another writer won first, the stale writer reloads, checks for conflicts, and retries on the newer root.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Snapshot isolation comes from immutable metadata plus one atomic root pointer. A reader that starts from root 101 keeps the table described by root 101. A later reader may see root 102 after a commit. Because metadata files are immutable, the old reader is not disturbed by the new publication.',
        'Planning correctness comes from reachability. The files in a snapshot are exactly the data and delete files reachable through that snapshot\'s manifest list. If a manifest summary proves no file inside can satisfy a predicate, skipping it cannot remove a valid answer. If a file metric proves a value is outside the query range, skipping that file is safe for the same reason.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Iceberg replaces object-store listing cost with metadata read cost. A query over 200,000 files may read one metadata file, one manifest list, and a few hundred manifests instead of listing and opening every file. When data doubles, scan cost grows with selected files, but planning stays efficient only if manifests are compact and statistics are maintained.',
        'The tax is maintenance. Small files, tiny manifests, long snapshot history, and many delete files all make planning slower. A healthy table runs compaction, manifest rewrite, snapshot expiration, orphan cleanup, and delete-file rewrite jobs. The format gives the machinery; the platform still has to operate it.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Iceberg fits lakehouse analytics where many engines share large tables on object storage. Spark can write, Flink can stream, Trino can query, and Python jobs can inspect metadata while all agree on snapshots and schema IDs. Time travel also makes training data and audit snapshots reproducible.',
        'It is especially useful for evolving tables. A column rename keeps the same field ID, so old files and new files still mean the same logical column. A partition spec can change from day to hour for new data while old files keep their old spec and the planner interprets each file under the correct metadata.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Iceberg is not a query engine or a magic speed layer. A badly clustered table with millions of small files can be slow even though the metadata is correct. A table with unmaintained delete files can spend more time planning and filtering than the team expects.',
        'It also depends on engine and catalog correctness. Engines must honor field IDs, sequence numbers, delete rules, and commit conflicts. Catalogs must publish roots atomically. If a tool treats the warehouse directory as the source of truth and bypasses Iceberg metadata, it can corrupt the table.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A table has 1,000,000,000 events in 20,000 Parquet files. A query asks for country = US and event_time between noon and 1 PM on June 25. Directory listing would discover many files before the engine can reject them. Iceberg reads the current metadata root, then uses manifest summaries to keep only the day and country ranges that can match.',
        'Suppose the manifest list has 400 manifests and only 12 overlap the predicate. Each of those manifests lists 500 files, so the planner examines 6,000 file entries instead of 20,000. File-level bounds reduce that to 180 files. If each file is 256 MB, the scan reads about 46 GB rather than 5 TB, and correctness is preserved because every skipped file had metadata proving it could not match.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read the Apache Iceberg table specification for snapshots, manifest lists, manifests, schemas, partition specs, delete files, and sequence numbers. Read Iceberg reliability and maintenance docs for snapshot expiration, orphan cleanup, and compaction. The REST catalog specification explains how the current metadata root is published safely.',
        'Study Parquet Columnar Format before diving into scan performance. Study MVCC for snapshot isolation, B-Trees for planning indexes, and Optimistic Concurrency Control for commits. Then compare Delta Lake and Apache Hudi to see how different table formats encode similar lakehouse guarantees.',
      ],
    },
  ],
};