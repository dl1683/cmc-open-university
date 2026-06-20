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
      heading: 'What it is',
      paragraphs: [
        'Apache Iceberg is an open table format for large analytical datasets. It does not merely define a file layout. It defines table metadata: schemas with field IDs, snapshots, manifest lists, manifests, data files, delete files, partition specs, and catalog commits.',
        'The case-study lesson is that a data lake table needs a control plane. Parquet files store bytes efficiently, but a table also needs atomic commits, snapshot isolation, time travel, schema evolution, partition evolution, and efficient planning over many files.',
        {type:'callout', text:'Iceberg makes the table a versioned metadata root, so snapshots and manifests define the data set instead of directory listing.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/9/95/Apache_Iceberg_Logo.svg', alt:'Apache Iceberg project logo', caption:'Apache Iceberg logo by Sophinie Kim for The Apache Software Foundation, via Wikimedia Commons, Apache License 2.0.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious data-lake table is a directory full of Parquet files. A writer drops new files into partition folders, and a query engine lists the directory to discover what to read. That works until the table is large, many writers run at once, partitions evolve, deletes arrive, or readers need a consistent view while writes are happening.',
        'Directory listing is not a transaction protocol. A reader can see half a commit. A writer can overwrite another writer. A schema rename can be confused with a different column. A partition layout change can strand old data under old folders. Iceberg replaces ad hoc file discovery with explicit metadata roots and atomic catalog commits.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is that the table is the metadata root, not the storage directory. The catalog points to one current metadata file. That metadata file names snapshots. A snapshot names a manifest list. The manifest list names manifests. Manifests name data and delete files with metrics. A consistent table view is therefore a graph of files reachable from one chosen snapshot.',
        'This indirection buys planning and correctness. Readers can time-travel by choosing an older snapshot. Writers can commit by atomically swapping the catalog pointer. Planners can skip manifests and files using metrics before opening data files. Schema and partition evolution become metadata changes instead of unsafe folder conventions.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A catalog points to the current table metadata file. That metadata file records snapshots. Each snapshot points to a manifest list. The manifest list records manifest files and summary statistics. Each manifest lists data or delete files with partition values and metrics such as row counts and column bounds.',
        'Readers choose a snapshot, use manifest-list and manifest metadata to prune planning work, and scan the selected files. Writers create new metadata and commit by atomically updating the catalog pointer. If another writer wins first, the stale writer refreshes and retries.',
        'Delete files are part of the same metadata story. A position delete names rows by file and position. An equality delete names rows by values. Readers must combine selected data files with applicable delete files to produce the snapshot view. That lets Iceberg support row-level changes without rewriting every affected data file immediately.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The snapshot-planning view is proving that metadata is an index. The query engine should not list every object and inspect every footer when manifest lists and manifests can prove that entire groups of files cannot match the predicate. Each layer narrows the planning problem before bytes are scanned.',
        'The schema-partition-evolution view is proving that stable IDs matter. A column rename should preserve meaning. A partition transform should be allowed to change for new data without rewriting old data. The planner carries the old and new specs and interprets each file under the metadata that created it.',
        'The commit-conflict view is the write-side lesson. Two writers can prepare new files and metadata, but only one catalog pointer becomes current. The loser must refresh, check whether its write still conflicts, and retry safely. That optimistic pattern is what lets object storage behave like a table surface without pretending object storage has database transactions.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Iceberg works because immutable metadata files make table states explicit. A new commit writes new metadata and then atomically publishes one pointer. Readers that started on the old pointer keep seeing the old snapshot. Readers that start later see the new snapshot. This is snapshot isolation at data-lake scale.',
        'It also works because file-level statistics are promoted into planning metadata. Partition values, column bounds, null counts, row counts, and delete-file references let engines skip work. The format does not make slow storage fast by itself; it prevents engines from doing unnecessary discovery and scanning.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Iceberg moves complexity from ad hoc directory listings into explicit metadata. That is a good trade, but metadata still needs maintenance. Manifest rewrite, snapshot expiration, orphan-file cleanup, compaction, delete-file planning, and catalog reliability all become operational concerns.',
        'The design also depends on engine correctness. Multiple compute engines can share a table only if they honor the same schema IDs, snapshot semantics, delete-file rules, and optimistic commit protocol.',
        'Planning cost can move from data files to metadata files. A table with too many small files or too many tiny manifests can spend too much time in planning before it scans useful data. That is why Iceberg operations include compaction, manifest rewriting, snapshot expiration, and metadata cleanup.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Iceberg is used for lakehouse analytics, streaming ingestion, CDC tables, ML training datasets, regulatory snapshots, cross-engine data sharing, and time-travel debugging. It is especially valuable when tables contain many files and multiple writers or query engines touch the same dataset.',
        'A complete case study is hourly event ingestion. Each job writes Parquet files, creates manifests with file metrics, and commits a new snapshot. A dashboard query for one country and one hour prunes manifests and files before scanning. A later schema rename is safe because readers use field IDs.',
        'For ML datasets, the snapshot ID is also an experiment artifact. Training on "the events table" is vague; training on snapshot 102 is reproducible. If the table later receives corrections or deletes, the old experiment can still be explained as long as retention keeps the snapshot and files available.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Iceberg is not a database engine by itself. It is a table format and metadata protocol used by engines such as Spark, Flink, Trino, and others. Another misconception is that partition evolution removes data layout work. It makes evolution safe, but compaction, clustering, and manifest hygiene still decide performance.',
        'Another mistake is ignoring delete files and small files. Row-level deletes can accumulate and make reads expensive until compaction rewrites data. Streaming ingestion can create many small files and manifests. Snapshot history can grow until expiration and orphan cleanup are scheduled. The format gives you safe metadata; it does not remove table maintenance.',
      ],
    },
    {
      heading: 'Operational maintenance',
      paragraphs: [
        'A healthy Iceberg table has maintenance jobs. Compact small data files so scans do not open thousands of tiny objects. Rewrite manifests so planning metadata stays efficient. Expire old snapshots only after retention requirements are satisfied. Remove orphan files carefully so failed writes and abandoned files do not become permanent storage leaks.',
        'The table should also be observed like a service. Track snapshot count, manifest count, average data-file size, delete-file count, planning time, scan time, commit conflicts, and catalog latency. Those metrics explain why two tables with the same logical rows can have very different query performance.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Official sources: Iceberg specification at https://iceberg.apache.org/spec/ and Iceberg terms at https://iceberg.apache.org/terms/. Study Delta Lake Case Study, Parquet Columnar Format Case Study, Write-Ahead Log, MVCC Internals & VACUUM, Feature Store, and Persistent Segment Tree next.',
        'A good study exercise is to trace one query from catalog pointer to snapshot, manifest list, manifest, data file, and delete file. That path explains why Iceberg is a metadata format first and a file scanner second.',
      ],
    },
  ],
};
