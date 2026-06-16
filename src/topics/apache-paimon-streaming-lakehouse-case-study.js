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
    explanation: 'Apache Paimon is a lake format for batch and streaming. Its primary-key tables use an LSM-style structure so realtime updates can land in object storage and still be queried as tables.',
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
    explanation: 'The table behaves like an LSM built for a lake: buffer changes, flush sorted files, commit snapshots, use metadata and file indexes for pruning, then compact to control read amplification.',
  };

  yield {
    state: lsmGraph('File indexes and metadata make scans selective'),
    highlight: { active: ['snap', 'index', 'query', 'e-snap-index', 'e-index-query'], compare: ['compact'] },
    explanation: 'Paimon documentation emphasizes fast scan planning, partition and column-level stats, file indexes, and aggregate pushdown. The table is not just files; it is files plus metadata that makes reads cheap.',
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
    explanation: 'The read path is a pruning pipeline. Partition metadata, column stats, file indexes, and aggregate pushdown each remove work before an engine reads bytes.',
  };
}

function* changelogLake() {
  yield {
    state: changeGraph('Paimon can serve both table state and change streams'),
    highlight: { active: ['write', 'pk', 'seq', 'log', 'batch', 'stream'], found: ['sink'] },
    explanation: 'A streaming lakehouse table has two personalities: a current snapshot for batch queries and a changelog stream for downstream incremental consumers.',
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
    explanation: 'The changelog view has to encode inserts, updates, deletes, ordering, deduplication, and tombstone behavior. Those details decide whether downstream materialized views stay correct.',
    invariant: 'A table that serves change streams must make ordering and primary-key semantics explicit.',
  };

  yield {
    state: changeGraph('Primary keys convert raw events into table state'),
    highlight: { active: ['write', 'pk', 'log', 'batch', 'stream', 'e-pk-log'], compare: ['seq'] },
    explanation: 'Primary-key tables can merge updates by key while still exposing changes. The key is the bridge between event streams and table snapshots.',
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
    explanation: 'A realistic Paimon case is CDC into a lakehouse table, streaming materialized views tailing changes, and batch BI reading snapshots with metadata pruning.',
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
      heading: 'What it is',
      paragraphs: [
        'Apache Paimon is a lakehouse table format for both streaming and batch operations. It provides large-scale data lake storage, realtime streaming updates powered by an LSM structure, snapshots, file indexes, schema evolution, and incremental reads.',
        'This topic links LSM Tree, LSM Compaction Strategies Primer, Apache Hudi Timeline Filegroups Case Study, Delta Lake Case Study, Iceberg Table Format Case Study, Streaming Watermarks, and Debezium CDC Case Study. It is the streaming-update complement to snapshot-oriented lakehouse tables.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Writers ingest append or primary-key updates, often from streaming systems such as Flink. Paimon organizes updates into write-optimized files and snapshots. Compaction merges files and controls read amplification.',
        'Readers can use table snapshots for batch queries or changelog reads for streaming consumers. Metadata such as partitions, column statistics, file indexes, and snapshots guides pruning and scan planning.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The key structures are primary-key records, sequence/order metadata, LSM runs, snapshots, manifests, file indexes, changelog records, compaction plans, partition stats, and schema evolution metadata.',
        'The LSM idea is familiar from RocksDB and Hudi: optimize for incoming updates, then compact and index enough metadata so reads remain efficient. Paimon applies that idea to lakehouse tables on distributed storage.',
      ],
    },
    {
      heading: 'Why it matters',
      paragraphs: [
        'Streaming and lakehouse systems often split into separate stacks: a stream processor for fresh changes, a table format for batch, and a warehouse for queries. Paimon tries to unify those paths through one table abstraction.',
        'The teaching value is the dual view of data: the same table can be a snapshot for batch readers and a changelog for incremental readers. That requires explicit primary keys, ordering, compaction, and metadata pruning.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The main risks are late events, duplicate CDC records, compaction lag, read amplification, stale snapshots, unclear delete semantics, schema evolution mistakes, and changelog consumers that misread ordering or update-before/update-after pairs.',
        'A production design needs idempotent writes, checkpointed streaming jobs, compaction monitoring, retention policy, snapshot cleanup, file-index health, and tests that compare changelog-derived views with snapshot-derived results.',
      ],
    },
    {
      heading: 'Sources and links',
      paragraphs: [
        'Primary sources: Apache Paimon 1.4 documentation at https://paimon.apache.org/docs/1.4/ and Apache Paimon project documentation at https://paimon.apache.org/docs/master/.',
        'Study this with LSM Compaction Strategies for write amplification, Hudi for file groups and timelines, Delta and Iceberg for snapshot table formats, and Streaming Watermarks for late-data semantics.',
      ],
    },
  ],
};
