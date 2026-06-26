// Delta Lake case study: add an ACID transaction log, checkpoints, metadata
// pruning, and time travel on top of cloud object stores.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'delta-lake-case-study',
  title: 'Delta Lake Case Study',
  category: 'Papers',
  summary: 'Delta Lake as the data-lake transaction lesson: JSON log actions, Parquet checkpoints, ACID commits, and time travel.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['transaction log', 'metadata pruning and time travel'], defaultValue: 'transaction log' },
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

function architecture(title) {
  return graphState({
    nodes: [
      { id: 'writer', label: 'writers', x: 0.7, y: 3.8, note: 'batch/stream' },
      { id: 'log', label: '_delta_log', x: 2.8, y: 3.8, note: 'ordered commits' },
      { id: 'checkpoint', label: 'checkpoint', x: 4.9, y: 2.0, note: 'Parquet summary' },
      { id: 'files', label: 'data files', x: 4.9, y: 5.5, note: 'Parquet objects' },
      { id: 'reader', label: 'reader', x: 7.0, y: 3.8, note: 'snapshot' },
      { id: 'object', label: 'cloud object store', x: 9.0, y: 3.8, note: 'S3/GCS/ADLS' },
    ],
    edges: [
      { id: 'e-writer-log', from: 'writer', to: 'log', weight: 'commit JSON' },
      { id: 'e-writer-files', from: 'writer', to: 'files', weight: 'write Parquet' },
      { id: 'e-log-checkpoint', from: 'log', to: 'checkpoint', weight: 'compact metadata' },
      { id: 'e-reader-log', from: 'reader', to: 'log', weight: 'read actions' },
      { id: 'e-reader-checkpoint', from: 'reader', to: 'checkpoint', weight: 'fast snapshot' },
      { id: 'e-reader-files', from: 'reader', to: 'files', weight: 'scan needed files' },
      { id: 'e-files-object', from: 'files', to: 'object', weight: 'objects' },
      { id: 'e-log-object', from: 'log', to: 'object', weight: 'objects' },
    ],
  }, { title });
}

function* transactionLog() {
  yield {
    state: architecture('Delta Lake adds a transaction log to object storage'),
    highlight: { active: ['writer', 'log', 'files', 'e-writer-log', 'e-writer-files'], compare: ['object'] },
    explanation: 'Cloud object stores are cheap and scalable, but they do not behave like database tables. Delta Lake adds a transaction log next to Parquet files so readers can reconstruct an ACID table snapshot.',
  };

  yield {
    state: labelMatrix(
      'Log versions are table state transitions',
      [
        { id: 'v0', label: 'version 0' },
        { id: 'v1', label: 'version 1' },
        { id: 'v2', label: 'version 2' },
        { id: 'v3', label: 'version 3' },
      ],
      [
        { id: 'action', label: 'log action' },
        { id: 'files', label: 'files' },
        { id: 'snapshot', label: 'visible table' },
      ],
      [
        ['add', 'part-000.parquet', 'initial table'],
        ['add', 'part-001.parquet', 'append batch'],
        ['remove + add', 'old -> compacted', 'optimized table'],
        ['txn metadata', 'stream id', 'idempotent stream commit'],
      ],
    ),
    highlight: { active: ['v0:action', 'v1:action', 'v2:action'], found: ['v3:snapshot'] },
    explanation: 'Each log version records actions such as add file, remove file, metadata update, or transaction marker. A reader picks a version and applies actions to build the set of live files.',
    invariant: 'A table snapshot is the result of replaying log actions through a version.',
  };

  yield {
    state: architecture('Checkpoints avoid replaying the whole log forever'),
    highlight: { found: ['checkpoint', 'e-log-checkpoint'], active: ['reader', 'log', 'e-reader-checkpoint', 'e-reader-log'] },
    explanation: 'As the log grows, Delta compacts metadata into checkpoint files. Readers start from a checkpoint and replay only recent JSON actions. This is log compaction for table metadata.',
  };

  yield {
    state: labelMatrix(
      'Database ideas inside a data lake',
      [
        { id: 'wal', label: 'transaction log' },
        { id: 'mvcc', label: 'snapshot reads' },
        { id: 'compaction', label: 'file compaction' },
        { id: 'schema', label: 'schema enforcement' },
      ],
      [
        { id: 'neighbor', label: 'neighbor topic' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['Write-Ahead Log', 'ordered state changes'],
        ['MVCC Internals', 'read old versions'],
        ['LSM Trees', 'rewrite small files'],
        ['Database Indexing', 'metadata is query planning'],
      ],
    ),
    highlight: { found: ['wal:lesson', 'mvcc:lesson', 'compaction:lesson'], active: ['schema:neighbor'] },
    explanation: 'Delta Lake is valuable because it imports database control-plane ideas into object storage: logs, snapshots, compaction, metadata, and conflict checks.',
  };
}

function* metadataPruningAndTimeTravel() {
  yield {
    state: labelMatrix(
      'File-level statistics prune scans',
      [
        { id: 'f1', label: 'file 1' },
        { id: 'f2', label: 'file 2' },
        { id: 'f3', label: 'file 3' },
        { id: 'query', label: 'query' },
      ],
      [
        { id: 'date_min', label: 'date min' },
        { id: 'date_max', label: 'date max' },
        { id: 'country', label: 'country stats' },
        { id: 'scan', label: 'scan?' },
      ],
      [
        ['2026-01-01', '2026-01-31', 'US,CA', 'no'],
        ['2026-02-01', '2026-02-28', 'US,IN', 'yes'],
        ['2026-03-01', '2026-03-31', 'BR,DE', 'no'],
        ['Feb + country=US', 'predicate', 'metadata pruning', 'scan f2'],
      ],
    ),
    highlight: { found: ['f2:scan', 'query:scan'], removed: ['f1:scan', 'f3:scan'] },
    explanation: 'The transaction log stores metadata and statistics for files. A query can skip files whose min/max or partition metadata cannot satisfy the predicate. This is why metadata scale matters.',
  };

  yield {
    state: architecture('Time travel reads an older snapshot'),
    highlight: { active: ['reader', 'log', 'checkpoint', 'e-reader-log', 'e-reader-checkpoint'], compare: ['files'] },
    explanation: 'Because old log versions describe older snapshots, readers can time travel: read version 1 even after version 3 has compacted or replaced files, as long as retention keeps the needed files.',
  };

  yield {
    state: labelMatrix(
      'Concurrency and streaming concerns',
      [
        { id: 'append', label: 'append job' },
        { id: 'merge', label: 'merge/update' },
        { id: 'stream', label: 'streaming sink' },
        { id: 'vacuum', label: 'vacuum' },
      ],
      [
        { id: 'contract', label: 'contract' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['optimistic commit', 'conflict retry'],
        ['remove + add files', 'rewrite cost'],
        ['idempotent txn id', 'duplicate commit if wrong'],
        ['delete old files', 'break time travel if too aggressive'],
      ],
    ),
    highlight: { active: ['append:contract', 'stream:contract'], compare: ['vacuum:risk'] },
    explanation: 'Delta Lake makes object storage act more table-like, but it still pays data-lake costs: file sizes, compaction, optimistic conflicts, retention, and metadata growth.',
  };

  yield {
    state: labelMatrix(
      'What Delta Lake connects',
      [
        { id: 'dremel', label: 'Dremel' },
        { id: 'foundation', label: 'FoundationDB' },
        { id: 'kafka', label: 'Kafka' },
        { id: 'feature', label: 'Feature Store' },
      ],
      [
        { id: 'shared', label: 'shared idea' },
        { id: 'difference', label: 'difference' },
      ],
      [
        ['columnar analytics', 'lake table instead of serving tree'],
        ['transactions', 'object-store table not KV core'],
        ['ordered logs', 'table state not event stream'],
        ['offline features', 'training tables need point-in-time reads'],
      ],
    ),
    highlight: { found: ['dremel:shared', 'kafka:shared', 'feature:difference'], compare: ['foundation:difference'] },
    explanation: 'The platform link is direct: Delta Lake is a table-control-plane topic that ties analytics, logs, feature stores, and transactional metadata together.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'transaction log') yield* transactionLog();
  else if (view === 'metadata pruning and time travel') yield* metadataPruningAndTimeTravel();
  else throw new InputError('Pick a Delta Lake view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. The transaction-log view shows how writers commit JSON actions into _delta_log and how readers reconstruct table snapshots from those actions plus Parquet checkpoints. The metadata-pruning view shows how file-level statistics let queries skip irrelevant objects, and how time travel reads older log versions.',
        {
          type: 'image',
          src: 'https://raw.githubusercontent.com/delta-io/delta-docs/main/static/images/logos/horizontal/DL-horiz-RGB-600px.png',
          alt: 'Delta Lake project logo -- an open-source storage framework for data lakehouses',
          caption: 'Delta Lake is a Linux Foundation project that adds ACID transactions, schema enforcement, and time travel to cloud object stores.',
        },
        'Active log nodes are the committed actions visible to the reader version. Compare nodes are older or alternative files, and found nodes are the files selected by the current snapshot. The safe inference is that a reader never lists the directory and guesses; it derives the live file set from a committed table version.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Cloud object stores -- S3, GCS, ADLS -- became the default analytical storage layer because they are cheap, durable, and nearly infinite. But they store blobs, not tables.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/High_level_object_storage_architecture.svg/960px-High_level_object_storage_architecture.svg.png',
          alt: 'High-level object storage architecture showing objects stored in flat namespaces with metadata',
          caption: 'Object stores organize data as flat collections of blobs with metadata -- cheap and durable, but with no concept of table structure, transactions, or schema.',
        },
        {
          type: 'callout',
          text: 'Delta Lake exists to give object-store tables the control plane that databases take for granted: ordered commits, atomic visibility, snapshot isolation, schema enforcement, and metadata-driven query planning -- all without leaving the cheap blob store.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to store a table as a directory of Parquet files. Writers append new files, updates rewrite old files, and readers list the directory to discover what exists. This works for simple append-only datasets where no reader observes a half-finished write.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/7/73/Datalake.png',
          alt: 'Data lake architecture diagram showing data flowing from multiple sources into a centralized storage layer',
          caption: 'The traditional data lake model: data from many sources lands in a shared store. Without transactional metadata, this directory of files is all you get.',
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that a directory listing is not a transaction. A reader can see file A before file B appears, a failed writer can leave orphan files, and a compaction job can delete data that an older reader still needs. Schema changes, deletes, updates, and concurrent writers all require a table version, not just a bag of blobs.',
        {
          type: 'callout',
          text: 'The core gap is that object stores have no concept of a table version. Every operation -- write, compact, merge, delete -- is a bag of independent blob mutations.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Put a small ordered transaction log next to the large immutable Parquet files. Each JSON commit records actions such as add file, remove file, metadata update, protocol update, and transaction marker. The table at version V is the replayed result of all actions through V.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/Data_warehouse_overview.svg/960px-Data_warehouse_overview.svg.png',
          alt: 'Data warehouse architecture overview showing structured ETL flow from sources through organized storage to analytics',
          caption: 'The data warehouse model enforces structure at every layer. Delta Lake borrows this discipline -- schema enforcement, ordered state, query-driven metadata -- and applies it inside the data lake.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A writer creates new Parquet files first, then attempts to publish the next numbered JSON commit. If the commit succeeds, the new version becomes visible atomically; if it fails, the writer retries after conflict checks. Periodic Parquet checkpoints summarize the log so readers do not replay every JSON file forever.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Apache_Parquet_logo.svg/800px-Apache_Parquet_logo.svg.png',
          alt: 'Apache Parquet project logo',
          caption: 'Data files are stored as Apache Parquet -- a columnar format designed for efficient analytics. The log itself also uses Parquet for checkpoint files.',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness invariant is snapshot reconstruction. For committed version V, the live table is every file with an add action at or before V and no remove action at or before V, interpreted under the metadata and protocol active at V. Readers that choose the same version replay the same actions and therefore see the same table.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/8/86/Two_phase_commit_seq_diagram_success_01.png',
          alt: 'Two-phase commit protocol sequence diagram showing coordinator and participants reaching consensus before committing',
          caption: 'Transaction protocols ensure atomicity through coordination. Delta Lake achieves a similar guarantee with a simpler mechanism: the JSON commit file is the single atomic publication point. No distributed consensus is needed because the object store provides conditional put.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Cost moves from raw file listing to metadata management. Reading a fresh table requires loading the latest checkpoint and replaying later JSON actions; writing requires conflict checks and a successful commit. If a table has 10 million tracked files, checkpoint loading can dominate query startup before any user data is scanned.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Row_and_column_major_order.svg/500px-Row_and_column_major_order.svg.png',
          alt: 'Row-major versus column-major memory layout showing how data is organized in contiguous blocks',
          caption: 'Columnar storage (column-major order) is what makes Parquet efficient for analytics: reading one column scans contiguous bytes instead of skipping across rows. Delta Lake inherits this efficiency for data files and uses it for checkpoint files too.',
        },
        {
          type: 'callout',
          text: 'Metadata growth is the silent scaling wall. A table with 10 million files has a checkpoint that is itself hundreds of megabytes. Loading that checkpoint dominates query startup time before any data is read.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Delta Lake fits lakehouse tables that need batch analytics, streaming ingestion, updates, deletes, schema enforcement, time travel, and multi-engine access. The access pattern is large immutable data files plus a small mutable control plane. Query engines can also skip files by using partition values and min/max statistics stored in add-file metadata.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/8/85/Hadoop-HighLevel_hadoop_architecture-640x460.png',
          alt: 'High-level Hadoop ecosystem architecture showing HDFS, MapReduce, and the surrounding big data tooling',
          caption: 'Delta Lake emerged from the Hadoop-era big data ecosystem but outlived it. While HDFS gave way to cloud object stores and MapReduce gave way to Spark, the need for transactional table metadata only grew.',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Delta Lake is not a row-store database. Small files, high-frequency row updates, manual object-store mutations, aggressive vacuum settings, and many concurrent writers can expose the cost of using immutable files as the data layer. It also depends on clients obeying the log protocol; bypassing the log breaks the table contract.',
        {
          type: 'callout',
          text: 'Never delete Parquet files directly from the object store. Always use the Delta Lake VACUUM command, which respects the transaction log and retention window. Manual deletions bypass the log and silently corrupt the table for any reader referencing those files.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with version 0 containing files A and B, each with 1 million rows. Version 1 appends file C, so the snapshot is A, B, C. Version 2 removes B and adds D after a compaction or update, so the snapshot is A, C, D even if B still physically exists for time travel.',
        'Now add query pruning. If file A has min id 1 and max id 999, file C has 1000 to 1999, and file D has 2000 to 2999, a query for id = 2500 reads only D. The correctness still comes from the log, while the speed comes from metadata that proves A and C cannot contain the requested row.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read the Delta Lake protocol, the Delta Lake VLDB 2020 paper, Apache Parquet documentation, and Databricks documentation on checkpoints, OPTIMIZE, VACUUM, deletion vectors, and time travel. Then study snapshot isolation, optimistic concurrency control, log compaction, metadata pruning, Apache Iceberg, and Apache Hudi. The key comparison is between object-store blobs and a table protocol that makes those blobs behave like committed versions.',
      ],
    },
  ],
};
