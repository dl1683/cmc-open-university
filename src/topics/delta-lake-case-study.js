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
      heading: 'What it is',
      paragraphs: [
        'Delta Lake is an ACID table storage layer over cloud object stores. It stores data in Parquet files and records table state changes in a transaction log, giving readers consistent snapshots, time travel, and faster metadata operations.',
        'The case study matters because modern analytics often lives on cheap object storage, but object stores do not provide database table semantics by themselves. Delta Lake adds a table control plane without abandoning scalable file storage.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Writers create Parquet files and atomically commit log actions such as add, remove, metadata, and transaction markers. Readers reconstruct a snapshot by replaying log actions to a chosen version. Periodic checkpoints compact metadata so readers do not need to replay the entire log.',
        'The log also stores file-level metadata and statistics. Query engines can prune files before scanning, and users can read older versions for debugging, reproducibility, and rollback.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Delta Lake improves reliability and metadata scale, but it introduces log management, checkpointing, compaction, small-file control, retention policy, and optimistic commit conflicts. File-level statistics help pruning, but they are not a substitute for good data layout.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Delta Lake is used for lakehouse analytics, streaming sinks, feature stores, ML training tables, audit logs, upserts, CDC-style pipelines, and reproducible data science. It bridges batch and streaming data workflows by making table versions explicit.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Delta Lake does not turn object storage into a low-latency OLTP database. It is optimized for analytical tables and large file scans. Another misconception is that ACID semantics remove layout work. Partitioning, clustering, compaction, and metadata still decide query cost.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: VLDB paper at https://www.vldb.org/pvldb/vol13/p3411-armbrust.pdf and Berkeley copy at https://people.eecs.berkeley.edu/~matei/papers/2020/vldb_delta_lake.pdf. Study Write-Ahead Log (WAL), MVCC Internals & VACUUM, Dremel Query Engine Case Study, Kafka Log Case Study, and Feature Store: Offline/Online Consistency next.',
      ],
    },
  ],
};
