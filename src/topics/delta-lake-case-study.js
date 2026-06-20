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
        'Active nodes are the components doing work in the current step. Found markers indicate the result produced by that step: a committed version, a pruned file, or an idempotent stream commit. Compare markers show the underlying object store that Delta Lake wraps but does not replace.',
        {
          type: 'note',
          content: 'Watch the separation between data files and the log. Writers produce Parquet files first, but those files are invisible to readers until a log commit publishes them. This two-phase boundary is the mechanism that makes atomicity possible on a storage system with no built-in transactions.',
        },
        {
          type: 'bullets',
          items: [
            'Transaction-log view, Frame 1: identify the two-phase write -- data files first, log commit second. The commit is the atomic boundary.',
            'Transaction-log view, Frame 2: trace how a reader at version 2 derives a different file set than a reader at version 0. Each row is a state transition, not a description of the final table.',
            'Transaction-log view, Frame 3: understand that checkpoints are performance optimization, not correctness infrastructure. The log alone defines truth.',
            'Transaction-log view, Frame 4: recognize WAL, MVCC, LSM compaction, and schema enforcement as the database concepts Delta Lake imports into blob storage.',
            'Metadata-pruning view, Frame 1: per-file min/max statistics let queries eliminate files without opening them.',
            'Metadata-pruning view, Frame 2: time travel reads an older log version to reconstruct a past snapshot.',
            'Metadata-pruning view, Frame 3: concurrency risks -- optimistic commits, streaming idempotency, and the tension between vacuum and time travel.',
            'Metadata-pruning view, Frame 4: connections to neighboring systems -- Dremel, Kafka, feature stores.',
          ],
        },
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
        'A blob store cannot answer: which files make up version 17 of the orders table? Did another writer already change this partition? What schema was active when this file was written? Which files should be ignored after a compaction job?',
        'Without a control plane that tracks table state, every consumer has to infer the table from a directory listing. That works for a single batch writer and a single reader. It breaks the moment tables become shared products with streaming appends, compaction jobs, upsert pipelines, schema enforcement, audit requirements, and reproducible ML training snapshots.',
        {
          type: 'quote',
          content: 'Half the data-corruption tickets we investigated at Databricks traced to the same root cause: a reader observed partial writes because there was no atomic commit protocol on the object store.',
          attribution: 'Delta Lake VLDB 2020 paper, Section 1',
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
        'The natural first attempt is to treat a table as a directory of Parquet files. Appends create new files. Updates rewrite old files and delete the originals. Readers list the directory whenever they need a fresh view. Partition subdirectories encode common filters like date or region. If listing gets slow, add a manifest file that caches the file list.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/7/73/Datalake.png',
          alt: 'Data lake architecture diagram showing data flowing from multiple sources into a centralized storage layer',
          caption: 'The traditional data lake model: data from many sources lands in a shared store. Without transactional metadata, this directory of files is all you get.',
        },
        'This is not foolish. Apache Hive built an entire ecosystem on exactly this pattern, using a metastore service to track partition locations. For years, append-only batch pipelines worked well enough: one writer, one scheduled reader, no concurrent mutations.',
        {
          type: 'table',
          headers: ['Capability', 'Directory-as-table', 'Delta Lake'],
          rows: [
            ['Atomic multi-file commit', 'No -- partial writes visible', 'Yes -- log commit is the publication point'],
            ['Concurrent writers', 'Last write wins silently', 'Optimistic conflict detection'],
            ['Schema enforcement', 'None -- any Parquet schema lands', 'Enforced at commit time'],
            ['Time travel', 'Not possible once files deleted', 'Read any retained version'],
            ['Streaming exactly-once', 'Duplicate batches on retry', 'Idempotent transaction IDs'],
            ['Metadata pruning', 'Partition dirs only', 'Per-file column statistics in log'],
          ],
        },
        'The directory approach works until file operations need to mean table operations. One logical append can create hundreds of files. A compaction job removes many small files and adds fewer large ones. A merge rewrites files containing changed rows. A streaming sink retries a microbatch after a crash. In every case, the directory has no ordered, atomic record of what the table became.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Object stores make the directory-as-table model fail in specific, painful ways:',
        {
          type: 'bullets',
          items: [
            'No multi-object transactions. Writing 200 Parquet files and then listing them is not atomic. A reader between the first and last PUT sees a partial batch.',
            'No atomic rename. The classic database trick of writing to a temp location and renaming into place does not work on S3, which has no rename primitive. GCS and ADLS have conditional operations but not general multi-object atomicity.',
            'Eventual consistency on listings. S3 achieved strong read-after-write consistency only in December 2020. Before that, a newly written file might not appear in a LIST for seconds.',
            'Expensive listing at scale. A table with 10 million files makes LIST calls slow and costly. Partition pruning via directory structure helps, but non-partition filters require opening every file footer.',
            'No garbage collection contract. If a compaction job deletes old files, it can break a reader that started before the compaction. If it keeps them, storage grows without bound.',
          ],
        },
        {
          type: 'callout',
          text: 'The core gap is that object stores have no concept of a table version. Every operation -- write, compact, merge, delete -- is a bag of independent blob mutations.',
        },
        'The system needs a small, ordered decision log that defines what the table is, separate from the big data files that hold the rows.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Delta Lake makes the transaction log the single source of truth for table state. The data files hold rows; the log defines the table. A snapshot is not whatever files happen to be in a directory. A snapshot is the result of replaying every committed log action through a chosen version number.',
        {
          type: 'diagram',
          content: [
            '  Writer                _delta_log/              Data files',
            '    |                                               ',
            '    |-- write Parquet -----------------------------> part-000.parquet',
            '    |                                               part-001.parquet',
            '    |                                               ',
            '    |-- commit JSON ---> 00000000000000000002.json  ',
            '    |                    { "add": "part-000" }      ',
            '    |                    { "add": "part-001" }      ',
            '    |                                               ',
            '  Reader                                            ',
            '    |-- load checkpoint --> 00000000000000000000.checkpoint.parquet',
            '    |-- replay JSON ------> ...0001.json, ...0002.json',
            '    |-- derive live files -> part-000, part-001     ',
            '    |-- scan only live files ----------------------> query result',
          ],
        },
        'That one shift imports a database invariant into a data lake: table state changes in an ordered, numbered sequence. Each version can add files, remove files, change metadata, record a streaming transaction marker, or update the protocol. Readers pick a version and derive the live file set. Writers attempt to claim the next version number and use optimistic conflict checks to validate their changes.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/Data_warehouse_overview.svg/960px-Data_warehouse_overview.svg.png',
          alt: 'Data warehouse architecture overview showing structured ETL flow from sources through organized storage to analytics',
          caption: 'The data warehouse model enforces structure at every layer. Delta Lake borrows this discipline -- schema enforcement, ordered state, query-driven metadata -- and applies it inside the data lake.',
        },
        'This separates data bytes from table decisions. Parquet handles efficient columnar storage. Small JSON log files record recent state transitions. Periodic Parquet checkpoints summarize cumulative state so readers never replay the entire history. The result is a lake table with MVCC-like isolation on top of blob storage.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A Delta table is a directory containing data files and a _delta_log subdirectory. The log holds numbered JSON commit files and periodic checkpoint files.',
        {
          type: 'code',
          language: 'text',
          content: [
            'my_table/',
            '  _delta_log/',
            '    00000000000000000000.json          # version 0: initial commit',
            '    00000000000000000001.json          # version 1: append',
            '    00000000000000000002.json          # version 2: compaction',
            '    00000000000000000002.checkpoint.parquet  # checkpoint at v2',
            '    _last_checkpoint                   # pointer to latest checkpoint',
            '  part-00000-<uuid>.parquet            # data file',
            '  part-00001-<uuid>.parquet            # data file',
            '  part-00002-<uuid>.parquet            # compacted data file',
          ],
        },
        'Each JSON commit file contains one or more actions. The Delta protocol defines seven action types:',
        {
          type: 'table',
          headers: ['Action', 'Purpose', 'Key fields'],
          rows: [
            ['add', 'Publish a new data file', 'path, partitionValues, size, stats (min/max/nullCount per column)'],
            ['remove', 'Tombstone a data file', 'path, deletionTimestamp, dataChange flag'],
            ['metaData', 'Set table schema and config', 'schemaString, partitionColumns, configuration'],
            ['txn', 'Idempotent stream commit', 'appId, version (stream-internal offset)'],
            ['protocol', 'Set reader/writer feature versions', 'minReaderVersion, minWriterVersion'],
            ['commitInfo', 'Audit metadata', 'timestamp, operation, operationParameters'],
            ['domainMetadata', 'Extension-point metadata', 'domain, configuration, removed flag'],
          ],
        },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Apache_Parquet_logo.svg/800px-Apache_Parquet_logo.svg.png',
          alt: 'Apache Parquet project logo',
          caption: 'Data files are stored as Apache Parquet -- a columnar format designed for efficient analytics. The log itself also uses Parquet for checkpoint files.',
        },
        'The write path has two phases. First, the writer creates new Parquet data files in the table directory. These files exist on the object store but are invisible to readers because no log action references them yet. Second, the writer writes a JSON commit file with the next version number. On S3 this uses a conditional put-if-absent; on ADLS it uses conditional append to a shared log; on GCS it uses generation-based conditional create. If another writer already claimed that version number, the commit fails and the writer retries with conflict resolution.',
        'The read path starts by finding the latest checkpoint via the _last_checkpoint file. It loads the checkpoint Parquet file to get the cumulative table state at that version, then replays JSON commits after the checkpoint up to the desired version. The live file set is computed by collecting all add actions and subtracting all remove actions. The reader then uses per-file statistics from the add actions to prune files before opening any data.',
        {
          type: 'note',
          content: 'Checkpoints are not required for correctness. A reader could replay the entire log from version 0. Checkpoints exist for performance: they bound the amount of JSON replay needed to reconstruct a snapshot. A typical checkpoint interval is every 10 commits.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider an orders table partitioned by day.',
        {
          type: 'code',
          language: 'json',
          content: [
            '// Version 0: initial load (Monday orders)',
            '{"add":{"path":"day=Mon/part-000.parquet","size":42000000,',
            '  "stats":"{\\\"numRecords\\\":50000,\\\"minValues\\\":{\\\"order_id\\\":1},\\\"maxValues\\\":{\\\"order_id\\\":50000}}"}}',
            '{"add":{"path":"day=Mon/part-001.parquet","size":38000000,',
            '  "stats":"{\\\"numRecords\\\":45000,\\\"minValues\\\":{\\\"order_id\\\":50001},\\\"maxValues\\\":{\\\"order_id\\\":95000}}"}}',
            '',
            '// Version 1: append Tuesday orders',
            '{"add":{"path":"day=Tue/part-002.parquet","size":41000000,',
            '  "stats":"{\\\"numRecords\\\":48000}"}}',
            '',
            '// Version 2: compact Monday into one file',
            '{"remove":{"path":"day=Mon/part-000.parquet","dataChange":false}}',
            '{"remove":{"path":"day=Mon/part-001.parquet","dataChange":false}}',
            '{"add":{"path":"day=Mon/part-003.parquet","size":79000000,',
            '  "stats":"{\\\"numRecords\\\":95000,\\\"minValues\\\":{\\\"order_id\\\":1},\\\"maxValues\\\":{\\\"order_id\\\":95000}}"}}',
            '',
            '// Version 3: CDC correction -- order 42 status changed',
            '{"remove":{"path":"day=Mon/part-003.parquet","dataChange":true}}',
            '{"add":{"path":"day=Mon/part-004.parquet","size":79000100,',
            '  "stats":"{\\\"numRecords\\\":95000}"}}'
          ],
        },
        'A dashboard reading version 1 sees three files: part-000, part-001, and part-002. It knows nothing about compaction that happens later. A reader at version 2 sees part-002 and part-003 -- the Monday files have been replaced by a single compacted file, but the logical rows are identical. At version 3, part-003 is replaced by part-004, which contains the corrected row for order 42.',
        {
          type: 'diagram',
          content: [
            'Version timeline and visible file sets:',
            '',
            'v0  [part-000, part-001]              <- initial Monday load',
            ' |',
            'v1  [part-000, part-001, part-002]    <- append Tuesday',
            ' |',
            'v2  [part-002, part-003]              <- compact Monday (000+001 -> 003)',
            ' |',
            'v3  [part-002, part-004]              <- CDC fix (003 -> 004)',
            '',
            'Time travel: SELECT * FROM orders VERSION AS OF 1',
            '  -> reads part-000, part-001, part-002 (pre-compaction view)',
          ],
        },
        'Notice the dataChange flag on the remove actions. Version 2 sets dataChange to false because compaction changes physical layout without altering logical content -- streaming readers that only care about new data can safely skip this version. Version 3 sets dataChange to true because the merge changed an actual row value.',
        'For streaming exactly-once delivery, a Spark Structured Streaming sink writes a txn action:',
        {
          type: 'code',
          language: 'json',
          content: [
            '{"txn":{"appId":"my-stream-pipeline","version":18}}',
          ],
        },
        'If the driver crashes and restarts, it reads the log, finds that microbatch 18 already committed, and skips the duplicate. The idempotency comes from the log, not from the object store.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument rests on a snapshot invariant: for any committed version V, the table is the set of all files with an add action at or before V that have no remove action at or before V, interpreted under the metadata and protocol active at V.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/8/86/Two_phase_commit_seq_diagram_success_01.png',
          alt: 'Two-phase commit protocol sequence diagram showing coordinator and participants reaching consensus before committing',
          caption: 'Transaction protocols ensure atomicity through coordination. Delta Lake achieves a similar guarantee with a simpler mechanism: the JSON commit file is the single atomic publication point. No distributed consensus is needed because the object store provides conditional put.',
        },
        {
          type: 'table',
          headers: ['ACID property', 'Mechanism in Delta Lake'],
          rows: [
            ['Atomicity', 'The JSON commit file is the publication point. Data files written before the commit are invisible until the commit succeeds. If the commit fails, the orphan data files are eventually cleaned up.'],
            ['Consistency', 'Schema enforcement at commit time rejects writes that violate the table schema. Constraint checks (CHECK, NOT NULL) run before the commit is published.'],
            ['Isolation', 'Optimistic concurrency control. Writers read a snapshot, do work, then attempt to commit. At commit time, Delta checks whether conflicting changes were committed by another writer since the snapshot was read. Non-conflicting appends to different partitions succeed. Conflicting file rewrites fail and retry.'],
            ['Durability', 'Once the commit JSON is persisted on the object store, the version is durable. Checkpoints improve performance but do not affect durability -- the log is the authority.'],
          ],
        },
        'Isolation deserves more detail. Delta Lake classifies conflicts by examining what each transaction read and wrote. Two blind appends to different partitions never conflict. A compaction that rewrites files can conflict with another compaction touching the same files. A merge that reads a predicate range conflicts with another merge that changes files in that range.',
        {
          type: 'code',
          language: 'text',
          content: [
            'Conflict detection matrix:',
            '',
            '                   Writer B action',
            '                   Append    Compact   Merge     Schema',
            'Writer A action',
            '  Append           OK        OK        OK        FAIL',
            '  Compact          OK        CONFLICT  CONFLICT  FAIL',
            '  Merge            OK        CONFLICT  CONFLICT  FAIL',
            '  Schema           FAIL      FAIL      FAIL      FAIL',
            '',
            'OK       = both commits succeed (disjoint file sets)',
            'CONFLICT = one writer retries (overlapping file sets)',
            'FAIL     = incompatible operations (schema change blocks all)',
          ],
        },
        'The conflict rules are defined per isolation level: Serializable (strictest, checks read predicates) and WriteSerializable (default, only checks file-level overlaps).',
        {
          type: 'note',
          content: 'The conflict check happens at commit time, not at write time. This means a writer can spend minutes producing Parquet files and only discover a conflict at the final commit step. Long-running writes against hot partitions are therefore more prone to conflict retries.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Operation', 'Cost driver', 'Typical magnitude'],
          rows: [
            ['Append (batch)', 'Write N Parquet files + 1 JSON commit', 'Seconds. Commit is one small PUT.'],
            ['Snapshot reconstruction', 'Load checkpoint + replay K JSON files', 'Milliseconds to low seconds if checkpoint is recent. K = commits since last checkpoint.'],
            ['Compaction (OPTIMIZE)', 'Read M small files, write fewer large files, commit removes + adds', 'Minutes to hours for large tables. Compute-bound, not log-bound.'],
            ['Merge (UPDATE/DELETE)', 'Read affected files, rewrite entire files containing changed rows', 'Proportional to file count touched, not row count changed. Rewriting a 128 MB file to change one row costs the same as rewriting it to change every row.'],
            ['Vacuum', 'List files, delete those removed before retention threshold', 'I/O-bound on large tables. Default retention is 7 days.'],
            ['Checkpoint creation', 'Scan log actions through current version, write one Parquet summary', 'Every 10 commits by default. Cost grows with total file count in the table.'],
          ],
        },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Row_and_column_major_order.svg/500px-Row_and_column_major_order.svg.png',
          alt: 'Row-major versus column-major memory layout showing how data is organized in contiguous blocks',
          caption: 'Columnar storage (column-major order) is what makes Parquet efficient for analytics: reading one column scans contiguous bytes instead of skipping across rows. Delta Lake inherits this efficiency for data files and uses it for checkpoint files too.',
        },
        'The small-file problem is Delta Lake\'s most common performance pitfall. Streaming sinks that commit every few seconds can generate thousands of tiny files per hour. Each file adds an entry to the log, increases checkpoint size, and forces the query engine to open more objects. OPTIMIZE compaction fixes this but consumes compute and can conflict with concurrent writers.',
        {
          type: 'callout',
          text: 'Metadata growth is the silent scaling wall. A table with 10 million files has a checkpoint that is itself hundreds of megabytes. Loading that checkpoint dominates query startup time before any data is read.',
        },
        'Databricks introduced multi-part checkpoints and v2 checkpoints (using sidecar files) to address this, but the fundamental cost is proportional to the number of files the table has ever tracked.',
        'Updates and deletes pay a copy-on-write tax. Parquet files are immutable, so changing one row in a 128 MB file means rewriting the entire 128 MB file. Deletion vectors (introduced in Delta Lake 2.3 / protocol writer version 7) partially address this by marking deleted rows in a lightweight sidecar file, deferring the full rewrite to a later compaction pass.',
        {
          type: 'diagram',
          content: [
            'Copy-on-write vs. deletion vectors:',
            '',
            'Copy-on-write (pre-2.3):',
            '  UPDATE row 42 in part-003.parquet (128 MB)',
            '  -> read entire part-003.parquet',
            '  -> rewrite as part-004.parquet (128 MB) with row 42 changed',
            '  -> log: remove part-003, add part-004',
            '  Cost: 128 MB read + 128 MB write for 1 row change',
            '',
            'Deletion vectors (2.3+):',
            '  UPDATE row 42 in part-003.parquet (128 MB)',
            '  -> write part-003.deletion_vector (few KB, bitmap of deleted rows)',
            '  -> write part-005.parquet (few KB, just the new row)',
            '  -> log: add deletion vector + add part-005',
            '  Cost: few KB write; full rewrite deferred to next OPTIMIZE',
          ],
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Lakehouse reporting: unified batch and streaming analytics on one table, with ACID guarantees that prevent dashboards from reading partial loads.',
            'CDC landing zones: change-data-capture pipelines land database changes into Delta tables with merge operations, giving downstream consumers a clean, versioned analytical copy of operational data.',
            'ML feature tables: point-in-time-correct training data via time travel. A training job reads the feature table as of the label timestamp, preventing future-data leakage.',
            'Audit and compliance: the log provides a complete, ordered history of every mutation. Time travel lets auditors reconstruct any past table state within the retention window.',
            'Multi-engine interoperability: Delta Lake is an open protocol. Spark, Flink, Trino, DuckDB, Polars, and Rust-based engines (delta-rs) can all read and write the same table because the log format is language-neutral JSON and Parquet.',
          ],
        },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/8/85/Hadoop-HighLevel_hadoop_architecture-640x460.png',
          alt: 'High-level Hadoop ecosystem architecture showing HDFS, MapReduce, and the surrounding big data tooling',
          caption: 'Delta Lake emerged from the Hadoop-era big data ecosystem but outlived it. While HDFS gave way to cloud object stores and MapReduce gave way to Spark, the need for transactional table metadata only grew.',
        },
        {
          type: 'quote',
          content: 'Over 10,000 Databricks customers use Delta Lake in production, managing exabytes of data across millions of tables.',
          attribution: 'Databricks engineering blog, 2024',
        },
        'Delta Lake is the wrong tool when the workload needs sub-millisecond point lookups, high-concurrency row-level locking, or serving-tier read latency. A relational OLTP database, key-value store, or specialized serving engine handles those patterns. Delta can publish clean analytical snapshots of operational data, but it is not the operational database.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'table',
          headers: ['Failure mode', 'Trigger condition', 'Consequence'],
          rows: [
            ['Small-file explosion', 'High-frequency streaming commits without compaction', 'Query latency degrades linearly with file count. Checkpoint size grows. Cloud storage costs increase from millions of tiny objects.'],
            ['Commit storm conflicts', 'Multiple writers rewriting overlapping partitions', 'Repeated optimistic-concurrency retries. In pathological cases, livelock: no writer can commit because each one\'s snapshot is stale by the time it tries.'],
            ['Vacuum breaking time travel', 'Retention set shorter than the longest-running query or pipeline', 'A reader that started before vacuum tries to read a file that has been physically deleted. The query fails with FileNotFoundException.'],
            ['Metadata checkpoint bloat', 'Tables with tens of millions of small files', 'Checkpoint Parquet files grow to hundreds of MB. Query planning takes minutes before any data is read.'],
            ['Merge amplification', 'Single-row updates on large files with no deletion vectors', 'A one-row change rewrites an entire 128 MB Parquet file. If the table has many small updates, total I/O can exceed the table size per day.'],
            ['Schema evolution surprises', 'Adding a NOT NULL column to a table with existing nullable data', 'Existing files do not retroactively gain the new column. Readers must handle nulls for the new column in old files even though the schema says NOT NULL.'],
          ],
        },
        'The silent failure mode is metadata drift. If the log and the actual files on the object store disagree -- because a manual deletion bypassed the log, or a failed cleanup left orphan files -- Delta Lake has no built-in mechanism to detect or repair the inconsistency. Tools like FSCK (available in Databricks) can scan for orphan files, but they are not part of the core open-source protocol.',
        {
          type: 'callout',
          text: 'Never delete Parquet files directly from the object store. Always use the Delta Lake VACUUM command, which respects the transaction log and retention window. Manual deletions bypass the log and silently corrupt the table for any reader referencing those files.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'note',
          content: 'Primary source: Armbrust et al., "Delta Lake: High-Performance ACID Table Storage over Cloud Object Stores," VLDB 2020. Available at https://www.vldb.org/pvldb/vol13/p3411-armbrust.pdf. The Delta Lake protocol specification is maintained at https://github.com/delta-io/delta/blob/master/PROTOCOL.md.',
        },
        {
          type: 'table',
          headers: ['Role', 'Topic', 'Why'],
          rows: [
            ['Prerequisite', 'Write-Ahead Log (WAL)', 'Delta Lake\'s transaction log is a WAL for table state. Understanding WAL replay and crash recovery maps directly to checkpoint + JSON replay.'],
            ['Prerequisite', 'MVCC Internals and VACUUM', 'Snapshot isolation in Delta uses the same read-version / write-version separation as database MVCC. Vacuum is the same garbage-collection tradeoff.'],
            ['Extension', 'Dremel Query Engine Case Study', 'Columnar analytics engines use metadata (row-group statistics, nested schema) the same way Delta uses per-file stats for pruning.'],
            ['Contrast', 'Kafka Log Case Study', 'Kafka\'s log is an event stream ordered by offset. Delta\'s log is a table-state journal ordered by version. Both are append-only ordered logs, but they answer different questions.'],
            ['Application', 'Feature Store: Offline/Online Consistency', 'Point-in-time table reads via time travel are how feature stores prevent training-serving skew in ML pipelines.'],
            ['Sibling', 'Apache Iceberg / Hudi', 'Iceberg uses a metadata tree instead of a linear log. Hudi uses a timeline with instant-based commits. All three solve the same problem -- ACID tables on object storage -- with different metadata structures.'],
          ],
        },
      ],
    },
  ],
};
