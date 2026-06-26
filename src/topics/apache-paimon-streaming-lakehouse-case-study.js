// Apache Paimon streaming lakehouse table format: LSM-backed updates,
// snapshots, file indexes, changelog reads, batch reads, and compaction.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'apache-paimon-streaming-lakehouse-case-study',
  title: 'Apache Paimon Streaming Lakehouse Case Study',
  category: 'Systems',
  summary: 'Apache Paimon as a streaming lakehouse table format: LSM-style primary-key updates, snapshots, changelogs, file indexes, compaction, and batch plus streaming reads.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['lsm table', 'changelog lake'], defaultValue: 'lsm table' },
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

function lsmGraph(title) {
  return graphState({
    nodes: [
      { id: 'cdc', label: 'CDC', x: 0.7, y: 3.5, note: 'updates' },
      { id: 'flink', label: 'Flink', x: 2.3, y: 3.5, note: 'stream' },
      { id: 'mem', label: 'mem', x: 4.0, y: 1.7, note: 'buffer' },
      { id: 'run', label: 'run', x: 4.0, y: 5.3, note: 'LSM' },
      { id: 'snap', label: 'snap', x: 5.9, y: 3.5, note: 'version' },
      { id: 'index', label: 'index', x: 7.6, y: 1.7, note: 'prune' },
      { id: 'compact', label: 'compact', x: 7.6, y: 5.3, note: 'merge' },
      { id: 'query', label: 'query', x: 9.2, y: 3.5, note: 'batch' },
    ],
    edges: [
      { id: 'e-cdc-flink', from: 'cdc', to: 'flink', weight: 'events' },
      { id: 'e-flink-mem', from: 'flink', to: 'mem', weight: 'write' },
      { id: 'e-mem-run', from: 'mem', to: 'run', weight: 'flush' },
      { id: 'e-run-snap', from: 'run', to: 'snap', weight: 'commit' },
      { id: 'e-snap-index', from: 'snap', to: 'index', weight: 'stats' },
      { id: 'e-run-compact', from: 'run', to: 'compact', weight: 'levels' },
      { id: 'e-index-query', from: 'index', to: 'query', weight: 'skip' },
      { id: 'e-compact-query', from: 'compact', to: 'query', weight: 'clean' },
    ],
  }, { title });
}

function changeGraph(title) {
  return graphState({
    nodes: [
      { id: 'write', label: 'write', x: 0.8, y: 3.5, note: 'upsert' },
      { id: 'pk', label: 'PK', x: 2.4, y: 2.0, note: 'merge' },
      { id: 'seq', label: 'seq', x: 2.4, y: 5.0, note: 'order' },
      { id: 'log', label: 'log', x: 4.4, y: 3.5, note: 'change' },
      { id: 'batch', label: 'batch', x: 6.4, y: 1.8, note: 'snapshot' },
      { id: 'stream', label: 'stream', x: 6.4, y: 5.2, note: 'tail' },
      { id: 'sink', label: 'sink', x: 8.4, y: 3.5, note: 'serve' },
    ],
    edges: [
      { id: 'e-write-pk', from: 'write', to: 'pk', weight: 'key' },
      { id: 'e-write-seq', from: 'write', to: 'seq', weight: 'time' },
      { id: 'e-pk-log', from: 'pk', to: 'log', weight: 'dedup' },
      { id: 'e-seq-log', from: 'seq', to: 'log', weight: 'order' },
      { id: 'e-log-batch', from: 'log', to: 'batch', weight: 'state' },
      { id: 'e-log-stream', from: 'log', to: 'stream', weight: 'diff' },
      { id: 'e-batch-sink', from: 'batch', to: 'sink', weight: 'read' },
      { id: 'e-stream-sink', from: 'stream', to: 'sink', weight: 'emit' },
    ],
  }, { title });
}

function* lsmTable() {
  yield {
    state: lsmGraph('Paimon stores streaming updates in a lakehouse table'),
    highlight: { active: ['cdc', 'flink', 'mem', 'run', 'snap', 'e-cdc-flink', 'e-mem-run'], found: ['query'] },
    explanation: 'Paimon is trying to make object storage behave like a table that can accept continual updates. The LSM-style layout absorbs fresh writes first, then relies on snapshots, metadata, and compaction to keep reads coherent.',
    invariant: 'Streaming updates need write-optimized storage plus snapshot metadata so readers see a coherent table.',
  };

  yield {
    state: labelMatrix(
      'LSM',
      [
        { id: 'mem', label: 'mem' },
        { id: 'run', label: 'run' },
        { id: 'snap', label: 'snap' },
        { id: 'idx', label: 'idx' },
        { id: 'cmp', label: 'cmp' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['buf', 'loss'],
        ['file', 'amp'],
        ['ver', 'stale'],
        ['skip', 'miss'],
        ['merge', 'cost'],
      ],
    ),
    highlight: { active: ['mem:role', 'run:role', 'snap:role'], compare: ['cmp:risk'], found: ['idx:role'] },
    explanation: 'The table behaves like an LSM built for a lake: buffer changes, flush files, commit snapshots, use metadata and indexes for pruning, then compact so readers do not pay forever for every small write.',
  };

  yield {
    state: lsmGraph('File indexes and metadata make scans selective'),
    highlight: { active: ['snap', 'index', 'query', 'e-snap-index', 'e-index-query'], compare: ['compact'] },
    explanation: 'Paimon is not just a pile of files. Scan planning uses partitions, column stats, file indexes, and pushdown opportunities to decide which files can be skipped before bytes are read.',
  };

  yield {
    state: labelMatrix(
      'Read',
      [
        { id: 'part', label: 'part' },
        { id: 'col', label: 'col' },
        { id: 'bloom', label: 'bloom' },
        { id: 'agg', label: 'agg' },
      ],
      [
        { id: 'skip', label: 'skip' },
        { id: 'fail', label: 'fail' },
      ],
      [
        ['dirs', 'skew'],
        ['stats', 'null'],
        ['no', 'fp'],
        ['push', 'sem'],
      ],
    ),
    highlight: { active: ['part:skip', 'col:skip', 'bloom:skip'], compare: ['agg:fail'] },
    explanation: 'The read path is a pruning pipeline. Partition metadata, column stats, file indexes, and aggregate pushdown each remove work before an engine reads bytes, which is the only reason update-friendly storage can stay query-friendly.',
  };
}

function* changelogLake() {
  yield {
    state: changeGraph('Paimon can serve both table state and change streams'),
    highlight: { active: ['write', 'pk', 'seq', 'log', 'batch', 'stream'], found: ['sink'] },
    explanation: 'A streaming lakehouse table has two personalities: current state for batch queries and a changelog for incremental consumers. The hard part is making both views describe the same table.',
  };

  yield {
    state: labelMatrix(
      'Change',
      [
        { id: 'ins', label: 'ins' },
        { id: 'upd', label: 'upd' },
        { id: 'del', label: 'del' },
        { id: 'dedup', label: 'dedup' },
      ],
      [
        { id: 'emit', label: 'emit' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['add', 'late'],
        ['oldnew', 'order'],
        ['gone', 'tomb'],
        ['key', 'dup'],
      ],
    ),
    highlight: { active: ['ins:emit', 'upd:emit', 'dedup:emit'], compare: ['upd:risk'], found: ['del:risk'] },
    explanation: 'The changelog view has to encode inserts, updates, deletes, ordering, deduplication, and tombstone behavior. Those details decide whether a downstream materialized view is correct or merely fresh.',
    invariant: 'A table that serves change streams must make ordering and primary-key semantics explicit.',
  };

  yield {
    state: changeGraph('Primary keys convert raw events into table state'),
    highlight: { active: ['write', 'pk', 'log', 'batch', 'stream', 'e-pk-log'], compare: ['seq'] },
    explanation: 'Primary-key tables turn raw event streams into table state. The key tells the system which records replace or delete earlier records, while sequence/order metadata tells it which change should win.',
  };

  yield {
    state: labelMatrix(
      'Case',
      [
        { id: 'cdc', label: 'CDC' },
        { id: 'lake', label: 'lake' },
        { id: 'mv', label: 'MV' },
        { id: 'bi', label: 'BI' },
      ],
      [
        { id: 'path', label: 'path' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['write', 'idemp'],
        ['snap', 'comp'],
        ['tail', 'late'],
        ['read', 'stats'],
      ],
    ),
    highlight: { active: ['cdc:path', 'lake:path', 'mv:path'], compare: ['mv:guard'], found: ['bi:path'] },
    explanation: 'A realistic Paimon case is CDC into a lakehouse table, streaming materialized views tailing changes, and batch BI reading snapshots with metadata pruning. One table has to satisfy all three without splitting truth.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'lsm table') yield* lsmTable();
  else if (view === 'changelog lake') yield* changelogLake();
  else throw new InputError('Pick a Paimon view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the LSM table view as a write-to-read lifecycle. Active nodes show where a change currently lives, and found nodes show the metadata that makes the change readable as part of a stable snapshot.',
        'Read the changelog view as a semantics map. The key path identifies the row, the sequence path decides which update wins, and the batch and stream outputs are two views over the same table history.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'callout', text:'The wall is that update-friendly and scan-friendly layouts want opposite shapes. Streaming updates want cheap appends and quick commits. Analytical scans want large organized files, column statistics, and compact layouts. Paimon resolves this by accepting changes in a write-optimized form, publishing coherent snapshots, and compacting files later — fresh writes and clean reads are separated in time rather than forced into one immediate layout.'},
        'Apache Paimon exists for tables that must accept streaming updates while still serving analytical reads. A table may receive database change events every second, but analysts still expect snapshots, filters, aggregates, and batch queries over coherent table state.',
        'A lakehouse table format is the contract between those needs. It defines row identity, update order, snapshot visibility, file pruning, changelog reads, and compaction so streaming and batch consumers do not split into separate truths.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first approach is to keep two systems. A streaming database or message log owns fresh state, while the lake receives periodic exports for analytics.',
        'The second approach is to rewrite analytical files whenever a row changes. That keeps one table, but it turns small updates into large object-store writes.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that updates and scans want different physical shapes. Streaming wants cheap appends, idempotent retry, and explicit ordering, while scans want large compact files, column statistics, and predictable pruning.',
        'Changelog readers make the wall stricter. A materialized view needs inserts, deletes, update-before records, update-after records, and ordering rules, not just the current snapshot after the fact.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Paimon applies an LSM-style storage idea to a lakehouse table. It accepts changes in a write-optimized form, publishes snapshots for stable reads, exposes changelogs for incremental readers, and compacts files later.',
        'The core invariant is that table state is derived from primary keys, sequence rules, and snapshot metadata. Files are the storage medium, but metadata decides which files and changes define a reader-visible table version.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Incoming rows enter a primary-key table as changes to keyed state. A row can insert a key, update the same key, or delete it, and the sequence field decides which change is newer when events arrive out of order.',
        'The table writes data files and metadata, commits a snapshot, and lets readers choose a snapshot or tail a changelog. File indexes, partitions, and column statistics prune work before bytes are read, while compaction merges older and newer files into a cleaner read shape.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from making row identity and order explicit. If two events mention the same primary key, the table can decide whether one replaces the other, deletes it, or is ignored because a newer sequence already won.',
        'Snapshots give batch readers a stable version instead of a moving file set. Changelog reads are correct only when they describe the same committed state transitions that snapshots would materialize.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Paimon pays for fresh updates with read and maintenance debt. Small files, multiple runs, snapshots, indexes, and changelog retention all consume storage and metadata budget until compaction reduces them.',
        'When writes double, flush pressure and compaction pressure rise before query cost falls. When query selectivity worsens, pruning misses and more files are opened, so the table behaves less like a clean columnar scan and more like a merge of update fragments.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Paimon fits CDC ingestion, operational analytics, near-real-time dashboards, slowly changing dimensions, and streaming materialized views. The useful pattern is one table that supports both current-state reads and incremental change consumption.',
        'It is especially useful with Flink-style streaming pipelines feeding a lakehouse. The stream processor writes updates, batch engines read snapshots, and downstream systems tail changelogs without inventing a second state model.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Paimon is not a low-latency operational database. If the product path needs single-row reads in a few milliseconds, a serving store is a better fit than a lakehouse table over files.',
        'It is also unnecessary for simple append-only data. If rows never update, deletes are rare, and readers only need daily snapshots, the primary-key, changelog, and compaction machinery may be more burden than value.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Imagine order 42 receives four CDC events: insert pending at sequence 10, update paid at 20, duplicate pending at 10, and delete at 30. A primary-key Paimon table keeps the key as order 42 and uses the sequence to make delete at 30 the current state.',
        'A batch reader at snapshot 7 sees no current row for order 42 after the delete. A changelog reader sees the insert, update, and delete transitions, while compaction later merges files so future scans do not revisit all four event records.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Use the Apache Paimon documentation for primary-key tables, snapshots, changelog reads, file indexes, and compaction. Those sources define the exact table modes and metadata rules.',
        'Study LSM Trees for write amplification, Debezium CDC for source events, Apache Hudi and Apache Iceberg for neighboring table formats, and streaming watermarks for late data. Then trace one key through three updates, one delete, one snapshot read, and one changelog read.',
      ],
    },
  ],
};