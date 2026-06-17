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
      heading: 'Why this exists',
      paragraphs: [
        'Delta Lake exists because cheap object storage became the default place to keep analytical data, but raw object storage is not a database table. S3, GCS, and ADLS are good at storing large immutable objects. They are not good at answering table questions such as which files belong to version 17, whether a concurrent writer already changed the table, which schema is current, or which files should be ignored after a compaction job.',
        'A plain Parquet data lake usually starts well. A batch job writes a directory of columnar files. A query engine lists the directory, reads file footers, and scans the files that match a partition predicate. This is enough for append-only reporting when one writer owns the table and failures are rare. It breaks when the table becomes a shared product. Teams want streaming appends, compaction, upserts, deletes, schema checks, rollback, audit history, and reproducible ML training sets.',
        'The hard part is not the Parquet format. Parquet already gives efficient columnar bytes. The hard part is table state. If table state is inferred from a directory listing, then the system has no single ordered record of what happened. A reader can see half of a write, a failed cleanup can leave stale files behind, a retry can duplicate a batch, and two writers can both believe they committed the next version. Delta Lake adds the missing table control plane while keeping the data files in ordinary object storage.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach is to treat a table as a folder. Appends create new Parquet files. Updates rewrite old files and delete the originals. Readers list the folder whenever they need a fresh view. Partition directories encode common filters such as date or country. A manifest file can be added later if directory listing gets slow. None of this is foolish. It is exactly how many early data lakes grew out of batch processing.',
        'The wall appears when file operations need to mean table operations. Adding one logical batch may create hundreds of files. A compaction job may remove many small files and add fewer large files. A merge may remove old files and add rewritten files. A streaming sink may retry the same microbatch after a driver crash. If the table is only a folder, there is no durable, ordered, atomic sentence that says which set of file changes became the next table version.',
        'Object stores make this wall sharper. They do not give a general multi-object transaction. Renaming a directory is not the same primitive as committing a database transaction. Listing can be expensive at large scale. Cleaning old files too soon can break a reader that still needs an earlier version. Keeping every file forever makes metadata and storage grow without bound. The system needs a small, ordered decision log that says what the table is before engines touch the big data files.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Delta Lake makes the transaction log the source of truth. The data files hold rows, but the log defines the table. A snapshot is not whatever files happen to be visible in a directory. A snapshot is the result of applying every committed log action up to one version number.',
        'That one shift imports a database invariant into a data lake: table state changes in an ordered sequence. A version can add files, remove files, change metadata, record a transaction marker, or update protocol information. Readers choose a version and derive the live file set. Writers try to append the next log file and use optimistic conflict checks to decide whether their proposed change is still valid.',
        'This is why Delta Lake is a storage-layer case study rather than just a file format. It separates data bytes from table decisions. Parquet stores columns efficiently. JSON log files store recent state transitions. Parquet checkpoints periodically summarize the state of the table so readers do not replay the whole history forever. The result is a lake table that behaves much more like an MVCC database relation while still living on object storage.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'A writer first writes new Parquet files into the table storage area. Those files are not automatically part of the table just because they exist. The writer then attempts to commit a new log version in `_delta_log`. The commit is a small JSON file containing actions. Add actions name new data files and include metadata such as partition values, size, and column statistics. Remove actions tombstone old files. Metadata actions describe the schema and table configuration. Transaction actions let streaming writers make retries idempotent.',
        'Readers reconstruct a snapshot by starting from the latest useful checkpoint, then replaying JSON actions after that checkpoint until the chosen version. The live set is the files that have been added and not later removed. This is the same broad idea behind a write-ahead log and MVCC snapshot reconstruction: persistent state is derived from a history of committed changes, and a reader can choose a point in that history.',
        'Checkpoints keep the log practical. Without them, a long-lived table would force every fresh reader to replay thousands or millions of JSON actions. A checkpoint writes the current table metadata into a compact Parquet representation. A reader can load the checkpoint, replay only the recent tail of the log, and begin planning the query. Checkpoints do not replace the log. They are summaries that make log replay bounded enough for interactive engines.',
        'Delta also uses file metadata as a query-planning structure. If a file records that `date` ranges from 2026-02-01 to 2026-02-28 and the query asks for January, the engine can skip that file. Partition metadata, min and max statistics, null counts, and data skipping indexes are not secondary decoration. They are how an open file lake avoids reading every object for every analytical query.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Imagine an orders table partitioned by day. Version 0 adds two Parquet files for Monday. Version 1 appends Tuesday. A dashboard reading version 1 sees Monday and Tuesday. Later, an optimize job compacts the two Monday files into one larger file. That job writes the compacted file, then commits version 2 with remove actions for the old files and an add action for the new file. The logical rows did not change, but the physical layout did.',
        'Now a correction arrives from a CDC pipeline: order 42 changed status. Delta cannot edit a row in the middle of a Parquet file in place. The merge job rewrites the affected file, removes the old file in the log, and adds a replacement file. Readers of version 2 still see the old state. Readers of version 3 see the corrected state. The difference between the versions is explicit and auditable.',
        'A streaming sink adds another case. Suppose microbatch 18 writes files and crashes before the driver knows whether the commit succeeded. On restart, the sink can use a transaction identifier in the Delta log to check whether microbatch 18 already committed. If it did, the sink does not add the same files again. Exactly-once behavior here is not magic in the object store. It comes from using the log as the durable place where stream progress and table state meet.',
        'Time travel follows from the same mechanism. If old data files have not been vacuumed, a reader can ask for version 1 and reconstruct the live file set for that version. This is useful for debugging a bad merge, reproducing an ML training run, explaining an audit discrepancy, or rolling a downstream job back to a known table state.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is a snapshot invariant. For any committed version, the table equals every add action up to that version minus every later remove action up to that same version, interpreted under the active metadata and protocol. A reader that uses one version number for the whole query sees one logical table, even if newer commits arrive while the query is running.',
        'Atomicity comes from making the log commit the publication step. Data files may be written before the commit, but they are invisible until an add action appears in a committed log version. Old files may remain physically present after a remove action, but they are logically absent from newer snapshots. This is the same separation used by many storage engines: physical garbage collection is delayed so logical visibility can be precise.',
        'Isolation comes from optimistic concurrency control. A writer proposes a new version based on the snapshot it read. At commit time, Delta checks whether another writer committed conflicting changes first. Appending independent partitions may be safe. Rewriting files that another writer also touched is not. The system does not need a central lock for all work, but it does need a careful conflict test before publishing the next version.',
        'Durability depends on the durability of the object store and the log files. Once a commit is visible in the log, readers can reconstruct it. Checkpoints strengthen performance, not the definition of correctness. If a checkpoint is missing or stale, the log still defines the table; the reader just has more replay work to do.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Delta Lake pays for its table semantics with metadata machinery. The log must be written, retained, checkpointed, and cleaned. Checkpoint intervals affect reader startup time and write overhead. Too few checkpoints make snapshot reconstruction slower. Too many checkpoints add extra write and storage cost. Metadata itself can become large on tables with many files.',
        'Small files remain a major tax. A table can be perfectly transactional and still slow if every query must open thousands of tiny Parquet objects. Compaction rewrites small files into larger ones, but compaction consumes compute and can conflict with other writers. Z-ordering, clustering, and partitioning can improve pruning, but bad layout still forces large scans. ACID semantics do not remove the need for physical design.',
        'Deletes and updates are expensive compared with appends because Parquet files are immutable at the row level. A merge often means rewriting whole files that contain changed rows. That is acceptable for analytical tables when changes are batched, but it is a poor fit for high-rate OLTP workloads that update individual rows with millisecond latency requirements.',
        'Retention is another tradeoff. Keeping old files enables time travel and rollback. Removing them with vacuum saves storage and prevents stale data from lingering forever. Vacuuming too aggressively can break long-running readers or jobs that expect older versions. A production table needs an explicit retention policy, not an assumption that old files are harmless or that cleanup is always safe.',
      ],
    },
    {
      heading: 'Where it wins and fails',
      paragraphs: [
        'Delta Lake wins when the access pattern is analytical, file-oriented, and shared across multiple engines or jobs. It fits lakehouse reporting, ETL pipelines, streaming sinks, feature tables, ML training sets, audit tables, CDC landing zones, and reproducible data science. The common pattern is large columnar reads plus table-level correctness requirements.',
        'It is the wrong tool when the workload needs low-latency point updates, row-level locking, complex secondary indexes, or high-concurrency transactional serving. A relational database, key-value store, or OLTP engine is usually better for that. Delta can publish clean analytical snapshots of operational data, but it should not be confused with the operational database itself.',
        'The main misconception is that Delta Lake makes a data lake self-managing. It does not. It gives a stronger table contract. Engineers still need to choose partition columns, size files, schedule compaction, monitor commit conflicts, manage schema evolution, test streaming idempotency, and watch metadata growth. The log makes these operations safer and more visible, but it does not choose the right layout for the workload.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'The animation separates the big immutable bytes from the small ordered control plane. Writers produce Parquet files, but the log decides when those files become table state. Readers do not trust a raw directory listing. They load a checkpoint, replay log actions, and then scan only the files that survive that snapshot.',
        'The metadata-pruning view shows why the log is also a planning index. File statistics let a query skip objects before opening them. Time travel shows why remove actions are logical first and physical later. The file may still exist so older versions can read it, but newer snapshots ignore it because the log says it is removed.',
        'The important lesson is the boundary: object storage stores objects; Delta Lake defines table versions. Once that boundary is clear, ACID commits, streaming idempotency, time travel, compaction, and pruning all look like consequences of the same design rather than separate features.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: VLDB paper at https://www.vldb.org/pvldb/vol13/p3411-armbrust.pdf and Berkeley copy at https://people.eecs.berkeley.edu/~matei/papers/2020/vldb_delta_lake.pdf.',
        'Study Write-Ahead Log (WAL) next to understand why ordered durable state changes are enough to reconstruct data. Study MVCC Internals & VACUUM to connect Delta snapshots, old file retention, and garbage collection. Study Dremel Query Engine Case Study to see how columnar analytics uses metadata and nested columnar layout during execution. Study Kafka Log Case Study to compare an event log with a table-state log. Study Feature Store: Offline/Online Consistency to see why point-in-time table versions matter for ML training data.',
      ],
    },
  ],
};
