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
        "Read the animation as the execution trace for Apache Paimon Streaming Lakehouse Case Study. Apache Paimon as a streaming lakehouse table format: LSM-style primary-key updates, snapshots, changelogs, file indexes, compaction, and batch plus streaming reads..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'callout', text:'The wall is that update-friendly and scan-friendly layouts want opposite shapes. Streaming updates want cheap appends and quick commits. Analytical scans want large organized files, column statistics, and compact layouts. Paimon resolves this by accepting changes in a write-optimized form, publishing coherent snapshots, and compacting files later — fresh writes and clean reads are separated in time rather than forced into one immediate layout.'},
        'A lakehouse table has to look simple to users: a table has rows, columns, snapshots, and queries. The hard part is that real data rarely arrives as clean append-only batches. Operational databases emit CDC streams, users update records, delete events appear late, dimensions change, and materialized views need fresh deltas rather than yesterday morning files.',
        'Apache Paimon addresses this mixed world. It is a table format and storage design for batch and streaming workloads, with primary-key tables, snapshots, changelog reads, file metadata, compaction, and indexing. The educational point is not that Paimon is just another file layout. It is a contract for identity, ordering, visibility, pruning, and cleanup on top of cheaper object or distributed storage.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first naive approach is to keep two systems. A streaming database owns fresh state, while a data lake receives periodic dumps for analytics. That keeps ingestion easy, but it splits truth. Dashboards, batch jobs, and stream consumers can disagree because they are reading different physical systems with different delay, retention, and correction behavior.',
        'The second naive approach is to rewrite large analytical files for every update. That keeps one logical table, but it fights the storage medium. Object stores and lake files are good at large immutable writes and large scans. They are poor at tiny random updates. Rewriting a huge file to change one row turns a small business event into expensive write amplification.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that update-friendly and scan-friendly layouts want opposite shapes. Streaming updates want cheap appends, quick commits, idempotent retries, and clear ordering. Analytical scans want large organized files, column statistics, partition pruning, and compact layouts. If the table favors only writes, every query pays for scattered small files. If it favors only reads, every update becomes painful.',
        'Changelog consumers make the problem stricter. A downstream materialized view cannot infer correctness from the current table alone. It needs to know which rows were inserted, updated, or deleted, and in what order those changes should win. Late events, duplicate events, tombstones, and schema changes all become semantic issues, not just storage issues.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Paimon brings an LSM-style idea into lakehouse storage. Accept changes in a write-optimized form, publish coherent snapshots so readers have stable table versions, expose changelog reads for incremental consumers, and compact files later so scans do not pay forever for the update pattern. Fresh writes and clean reads are separated in time rather than forced into one immediate layout.',
        'The design works only because the table records enough metadata. Primary keys define row identity. Sequence or ordering fields define which event wins when updates race. Snapshots define visibility for batch readers. File indexes and statistics define what can be skipped. Compaction defines how old write debt is merged into a cleaner read shape.',
      ],
    },
    {
      heading: 'LSM table mechanics',
      paragraphs: [
        'In a primary-key table, incoming rows are not merely appended as independent facts. They are changes to keyed state. A new row may insert an order, update the status of the same order, or delete it. The storage engine can buffer changes, flush them into files, and later merge files so that the latest value for each key is easier to read.',
        'This is the lakehouse version of an LSM tradeoff. Writes become cheaper because they create new files rather than rewriting every older file immediately. Reads need metadata and merge logic because the newest answer may be spread across several levels or runs. Compaction is the background process that repays this debt by merging older and newer files according to table semantics.',
      ],
    },
    {
      heading: 'Snapshots',
      paragraphs: [
        'A snapshot is the table version that readers can agree on. Without snapshots, a query might see half of one commit and half of another. With snapshots, a batch reader can plan against a coherent set of manifests and files. Streaming writers can continue producing newer commits while older readers finish against the version they selected.',
        'Snapshots also give the system a recovery and retention model. A failed writer should not expose partial state. A reader should be able to resume from a known version. Cleanup should not remove files still needed by active readers or incremental consumers. The metadata layer is therefore part of correctness, not an optional catalog convenience.',
      ],
    },
    {
      heading: 'Changelog mechanics',
      paragraphs: [
        'The changelog view turns table evolution into a stream. Consumers can tail inserts, update-before and update-after records, deletes, or normalized changes depending on the table configuration and read mode. The important lesson is that a changelog is not the same thing as a pile of raw source events. It is a table-aware description of how state changed.',
        'Primary keys and ordering rules are what make that possible. If two events for the same customer arrive out of order, the system needs a deterministic rule for the winner. If a delete arrives, readers need to know whether it removes a visible row, writes a tombstone, or becomes a no-op because a newer update already won. These choices decide whether downstream state is correct.',
      ],
    },
    {
      heading: 'Read path',
      paragraphs: [
        'A good lakehouse read path avoids reading bytes whenever metadata can prove they are irrelevant. Partition information can skip directories or file groups. Column statistics can skip files outside a predicate range. File indexes can narrow candidate files for keys or values. Aggregate pushdown can answer some questions from metadata or smaller summaries.',
        'This matters because write-optimized storage creates read amplification. If every query must merge many small files and inspect every historical update, the table is fresh but slow. Paimon needs pruning, indexing, and compaction together: pruning reduces files considered, indexes reduce files opened, and compaction reduces the number of fragments that represent the same logical keys.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Imagine an orders database replicated by Debezium into a lakehouse. Order 42 is inserted as pending, updated to paid, updated again to shipped, and later corrected. The source stream may contain retries or late messages. A Paimon primary-key table uses the order id as identity and an ordering field to decide which record is the current value.',
        'A BI query reads a snapshot and sees one current row for order 42. A streaming materialized view tails changes and updates revenue totals as order states change. A compaction job later merges the files containing older versions so future scans do not walk every intermediate update. One table serves batch and streaming consumers because identity, order, visibility, and cleanup are explicit.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The LSM table view follows the write-to-read lifecycle. CDC events flow through a stream processor, land in write-friendly storage, become part of a snapshot, receive metadata for pruning, and later pass through compaction. The important transition is from raw change events to table versions that a query engine can reason about.',
        'The changelog lake view focuses on semantics. The key path answers which row is being changed. The sequence path answers which change wins. The log path feeds two readers: snapshot readers that want current state and streaming readers that want deltas. The animation is showing why a lakehouse table format has to be both a storage layout and a change protocol.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Paimon pays for freshness with operational debt. Small files accumulate. Compaction consumes compute and I/O. File indexes take space and must remain consistent with data files. Snapshots and changelog retention need cleanup policies. A table that is easy to write can become expensive to query if compaction falls behind or metadata becomes too large.',
        'The semantic tradeoffs are just as important. Strict ordering may require sequence fields from the source system. Idempotent writes require stable identifiers. Deletes require clear tombstone behavior. Schema evolution must preserve reader expectations. A misconfigured table can look healthy at the storage layer while producing incorrect downstream aggregates.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Paimon is strongest when one table must support frequent updates and analytical reads. CDC ingestion, operational analytics, near-real-time dashboards, slowly changing dimensions, streaming materialized views, and pipelines that need both Flink-style streaming and batch query engines are natural fits.',
        'It is also valuable when teams want to reduce the gap between online and analytical state. Instead of exporting from an operational store into a separate append-only lake, the table format itself understands primary-key updates, snapshots, and incremental reads. That reduces duplicate pipelines, although it does not remove the need for careful data contracts.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Paimon is not a replacement for an operational database that needs very low-latency point reads, transactions across many entities, or user-facing request paths. It is a lakehouse table system, so its strengths are durable table storage, stream and batch integration, and analytical access rather than single-row serving latency.',
        'It can also be unnecessary for simple append-only datasets. If records never update, deletes are rare, and consumers only need periodic snapshots, a simpler table format may be easier to operate. The extra machinery is justified when identity, ordering, and incremental change are central to the workload.',
      ],
    },
    {
      heading: 'Where it fails (2)',
      paragraphs: [
        'Common failure modes include unstable primary keys, missing sequence fields, duplicate CDC events that are not idempotent, late updates that overwrite newer state, compaction lag, snapshot retention that breaks incremental readers, and consumers that ignore update-before or delete records. Each failure is a violation of the table contract.',
        'Operational monitoring should therefore compare both sides of the table. Check file counts, compaction backlog, snapshot age, changelog lag, failed commits, index health, and query scan volume. Also compare snapshot-derived aggregates with changelog-derived aggregates. If those disagree, the issue is likely semantic, not merely performance.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study LSM Tree and LSM Compaction Strategies to understand write amplification and read amplification. Study Apache Hudi Timeline Filegroups, Delta Lake, Apache Iceberg, and Project Nessie to compare table metadata designs. Study Streaming Watermarks and Debezium CDC for late data and source change capture.',
        'For primary references, read the Apache Paimon documentation, especially the sections on primary-key tables, snapshots, changelog reads, file indexes, and compaction. Then build a small example mentally: three updates and one delete for the same key, one snapshot reader, one changelog reader, and one compaction cycle. If you can explain what each consumer sees, the design has become concrete.',
      ],
    },
      {
      heading: 'Why it works',
      paragraphs: [
        "Give the proof sketch as a preservation argument: invariant before, move, invariant after.",
        "If there is a nontrivial corner case, name it explicitly.",
        "When correctness is explicit, readers can transfer the method to new inputs.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why Apache Paimon Streaming Lakehouse Case Study moves from input to output in the animation and where it fails, you are ready for the next topic.',
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
],
};
