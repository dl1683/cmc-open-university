// Apache Hudi: timeline instants, file groups, file slices, copy-on-write,
// merge-on-read, and compaction as a lakehouse update data structure.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'apache-hudi-timeline-filegroups-case-study',
  title: 'Apache Hudi Timeline & File Groups Case Study',
  category: 'Systems',
  summary: 'Hudi table mechanics: timeline instants order writes, file groups hold evolving file slices, and CoW/MoR trade rewrite cost against read merge cost.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['timeline file groups', 'cow versus mor'], defaultValue: 'timeline file groups' },
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

function hudiGraph(title) {
  return graphState({
    nodes: [
      { id: 'writer', label: 'writer', x: 0.7, y: 3.5, note: 'upsert/delete' },
      { id: 'timeline', label: 'timeline', x: 2.7, y: 2.0, note: 'instants' },
      { id: 'fg', label: 'file group', x: 4.8, y: 3.5, note: 'file id' },
      { id: 'base1', label: 'base file', x: 6.7, y: 1.7, note: 'Parquet' },
      { id: 'log', label: 'delta log', x: 6.7, y: 3.8, note: 'MoR' },
      { id: 'base2', label: 'new base', x: 6.7, y: 5.7, note: 'CoW/compact' },
      { id: 'reader', label: 'reader', x: 8.9, y: 3.5, note: 'snapshot/RO' },
    ],
    edges: [
      { id: 'e-writer-timeline', from: 'writer', to: 'timeline', weight: 'instant' },
      { id: 'e-timeline-fg', from: 'timeline', to: 'fg', weight: 'commit' },
      { id: 'e-fg-base1', from: 'fg', to: 'base1', weight: 'slice' },
      { id: 'e-fg-log', from: 'fg', to: 'log', weight: 'delta' },
      { id: 'e-log-base2', from: 'log', to: 'base2', weight: 'compact' },
      { id: 'e-base1-reader', from: 'base1', to: 'reader', weight: 'RO' },
      { id: 'e-log-reader', from: 'log', to: 'reader', weight: 'merge' },
      { id: 'e-base2-reader', from: 'base2', to: 'reader', weight: 'latest' },
    ],
  }, { title });
}

function* timelineFileGroups() {
  yield {
    state: hudiGraph('Hudi orders table changes through a timeline'),
    highlight: { active: ['writer', 'timeline', 'fg', 'e-writer-timeline', 'e-timeline-fg'], found: ['reader'] },
    explanation: 'A Hudi table moves through timeline instants. Commits, delta commits, compactions, cleans, and rollbacks tell readers which physical files belong to a valid table snapshot.',
  };

  yield {
    state: labelMatrix(
      'Timeline instants',
      [
        { id: 'c', label: 'C' },
        { id: 'd', label: 'D' },
        { id: 'p', label: 'P' },
        { id: 'r', label: 'R' },
      ],
      [
        { id: 'what', label: 'what' },
        { id: 'use', label: 'use' },
      ],
      [
        ['commit', 'CoW'],
        ['delta', 'MoR'],
        ['compact', 'merge'],
        ['rollback', 'fix'],
      ],
    ),
    highlight: { active: ['c:what', 'd:what', 'p:use'], compare: ['r:use'] },
    explanation: 'The timeline is the table log. Completed instants are visible to readers; requested and inflight instants let writers and table services coordinate without exposing partial file slices.',
    invariant: 'A reader chooses a table state by filtering timeline instants.',
  };

  yield {
    state: hudiGraph('File groups evolve through file slices'),
    highlight: { active: ['fg', 'base1', 'log', 'base2'], found: ['timeline'] },
    explanation: 'A file group is the stable home for a record range. Over time it contains file slices: a base file plus optional log files, so Hudi can update immutable lake files without rewriting unrelated groups.',
  };

  yield {
    state: labelMatrix(
      'File-group anatomy',
      [
        { id: 'id', label: 'ID' },
        { id: 'base', label: 'B' },
        { id: 'log', label: 'L' },
        { id: 'slice', label: 'S' },
      ],
      [
        { id: 'holds', label: 'holds' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['file id', 'skew'],
        ['Parquet', 'rewrite'],
        ['deltas', 'merge'],
        ['B+L', 'stale'],
      ],
    ),
    highlight: { found: ['base:holds', 'log:holds', 'slice:holds'], compare: ['id:risk'] },
    explanation: 'The file group is the unit of update locality. Upserts are routed to file groups so the table can avoid rewriting unrelated files.',
  };
}

function* cowVersusMor() {
  yield {
    state: hudiGraph('Copy-on-write rewrites base files for fast reads'),
    highlight: { active: ['writer', 'base1', 'base2', 'e-log-base2'], compare: ['log'] },
    explanation: 'Copy-on-write pays the merge during write. The update creates a new base slice, so snapshot reads can stay close to ordinary Parquet scans.',
  };

  yield {
    state: labelMatrix(
      'CoW versus MoR',
      [
        { id: 'cow', label: 'CoW' },
        { id: 'mor', label: 'MoR' },
        { id: 'ro', label: 'RO' },
        { id: 'snap', label: 'Snap' },
      ],
      [
        { id: 'write', label: 'write' },
        { id: 'read', label: 'read' },
      ],
      [
        ['rewrite', 'base'],
        ['append', 'merge'],
        ['base', 'fast'],
        ['B+L', 'fresh'],
      ],
    ),
    highlight: { active: ['cow:write', 'mor:read'], found: ['snap:read'], compare: ['ro:read'] },
    explanation: 'Merge-on-read moves part of the merge to query time. Delta logs make writes cheaper and fresher, while snapshot reads must combine logs with the latest base file.',
  };

  yield {
    state: hudiGraph('Compaction turns delta logs into a fresh base slice'),
    highlight: { active: ['log', 'base2', 'e-log-base2'], found: ['reader'], compare: ['base1'] },
    explanation: 'Compaction repays accumulated read debt. It combines delta logs with a base file into a newer base slice, shortening the merge chain for future snapshot reads.',
  };

  yield {
    state: labelMatrix(
      'Workload choice',
      [
        { id: 'cdc', label: 'CDC' },
        { id: 'bi', label: 'BI' },
        { id: 'ml', label: 'ML' },
        { id: 'hot', label: 'hot' },
      ],
      [
        { id: 'pick', label: 'pick' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['MoR', 'logs'],
        ['CoW', 'rewrites'],
        ['CoW', 'freshness'],
        ['MoR', 'compact'],
      ],
    ),
    highlight: { found: ['cdc:pick', 'bi:pick'], active: ['hot:watch'], compare: ['ml:watch'] },
    explanation: 'A complete decision uses workload shape: update rate, read freshness, query engine support, compaction budget, and tolerance for read-time merging.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'timeline file groups') yield* timelineFileGroups();
  else if (view === 'cow versus mor') yield* cowVersusMor();
  else throw new InputError('Pick a Hudi view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Apache Hudi is a lakehouse table format for record-level upserts, deletes, incremental pulls, and table services over object-store files. Its main data structures are the timeline, file groups, file slices, indexes, copy-on-write tables, merge-on-read tables, and compaction.',
        'The key lesson is that an update-heavy lake table is a storage engine. It cannot pretend that Parquet files are mutable database pages. It has to map record keys to file groups, write new immutable pieces, and let readers reconstruct a valid table state from committed history.',
        {type:'callout', text:'Hudi makes mutable lake data safe by separating committed table history from immutable file pieces, so readers choose a timeline instant instead of trusting stray objects in storage.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Data lakes were originally strongest at append-heavy analytical data. Modern analytics also needs corrections, deletes, late-arriving events, CDC ingestion, incremental consumers, and long-running readers. Hudi exists because teams want those database-like behaviors without leaving cheap lake storage.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg', alt: 'Data lake storage infrastructure', caption: 'Data lakes store petabytes across distributed storage — Hudi adds transactional guarantees on top. Source: Wikimedia Commons, Victorgrigas, CC BY-SA 3.0' },
        'The constraint is physical. Object-store files are large immutable objects, and Parquet is built for columnar scans. Updating one record in place is the wrong model. Hudi makes mutation practical by routing records into stable file groups and recording table evolution through a timeline.',
      ],
    },
    {
      heading: 'Obvious approach and wall',
      paragraphs: [
        'The obvious lake approach is to append new Parquet files forever. That works for inserts and audit logs. It breaks for upserts because older versions of the same key remain visible unless every reader understands how to pick the latest valid record.',
        'The opposite baseline is to rewrite whole partitions whenever a record changes. That keeps reads simple, but an update-heavy CDC stream can turn small logical changes into large rewrite jobs. The wall is choosing where to pay: write latency, read latency, compaction IO, index cost, or operational complexity.',
      ],
    },
    {
      heading: 'Core insight and invariant',
      paragraphs: [
        'The core insight is to separate table history from physical file layout. The timeline says which actions are committed. File groups say where versions of a record range live. File slices say which base file and log files make up a visible version of that group.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Row_and_column_major_order.svg', alt: 'Row vs column major storage order', caption: 'Columnar file formats like Parquet store data column-by-column for analytical efficiency. Hudi manages these files in file groups. Source: Wikimedia Commons, Cmglee, CC BY-SA 4.0' },
        'The invariant is snapshot visibility. A reader should see only file slices allowed by completed timeline instants. Files produced by failed, inflight, rolled-back, cleaned, or not-yet-committed actions cannot become part of the reader view. That invariant is what turns many immutable files into one coherent table.',
      ],
    },
    {
      heading: 'Mechanism: timeline and file groups',
      paragraphs: [
        'The timeline records actions as instants. Commits, delta commits, compactions, cleans, rollbacks, and savepoints each describe a table event. Instants move through requested, inflight, and completed states. Readers use completed instants to choose a table state; writers and services use pending instants to coordinate work.',
        { type: 'callout', text: 'Hudi\'s timeline is an ordered log of every action — commits, compactions, cleans, rollbacks. It is the single source of truth: a reader picks a consistent snapshot by choosing a completed instant on the timeline.' },
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Internet_map_1024.jpg', alt: 'Network of connected data systems', caption: 'Hudi timelines coordinate concurrent writers across distributed compute engines. Source: Wikimedia Commons, The Opte Project, CC BY 2.5' },
        'File groups provide update locality. A file group has a file id. Each group evolves through file slices. A slice contains a base Parquet file and, for merge-on-read tables, optional log files with newer changes. The table index maps record keys to file groups so writers can update the right group without scanning the whole lake.',
        { type: 'callout', text: 'File groups are Hudi\'s unit of data locality. Each file group contains a base Parquet file and optional log files. Updates to the same record always land in the same file group, ensuring merge efficiency.' },
        'Copy-on-write creates new base files when records change. Merge-on-read appends changes to delta logs and lets snapshot queries merge those logs with the base file. Compaction later writes a fresh base slice so read-time merge chains do not grow forever.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is that visibility is derived from committed history, not from whatever files happen to exist in storage. A failed writer may leave files behind, but without a completed instant those files do not belong to the snapshot. A cleaning service may remove old slices only when retention rules say they are no longer needed.',
        'File groups make updates stable. Once a record key maps to a file group, later versions of that record stay in that group. A reader does not need to search every file for every key; it reconstructs the latest visible slice for each group and applies the table type rules.',
        'This is similar to database storage engines. Logs, pages, manifests, snapshots, and compaction turn changing records into durable layout. Hudi applies that storage-engine pattern to lake files, where the units are Parquet base files, row-oriented logs, timeline instants, and table services.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'Copy-on-write makes reads fast because snapshot queries scan base files, but updates rewrite affected base files. Merge-on-read makes writes cheaper by appending logs, but snapshot reads pay merge cost until compaction produces fresh base files.',
        { type: 'callout', text: 'Copy-on-write tables rewrite entire file groups on update, giving fast reads but expensive writes. Merge-on-read tables append deltas and merge at read time, giving fast writes but slower reads. The choice depends on the read/write ratio of the workload.' },
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/0/03/Hdd_and_ssd.JPG', alt: 'Storage hardware', caption: 'Copy-on-write tables double storage during compaction — a direct tradeoff between write amplification and read performance. Source: Wikimedia Commons, Evan-Amos, Public domain' },
        'The table-services budget decides whether the design stays healthy. Too little compaction leaves long log chains and slower reads. Too much compaction steals IO from ingestion and queries. Cleaning reclaims old slices, but aggressive cleaning can break lagging incremental readers if retention is wrong.',
        'Indexing is another cost. Upsert systems must locate the file group for a key. Bloom filters, metadata tables, partitioning, key distribution, and record-key stability all affect write throughput. A poor key design can concentrate updates in hot file groups and make compaction uneven.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Hudi wins when lake data is update-heavy and readers still need table semantics. CDC ingestion, order states, user profiles, corrections to event streams, slowly changing dimensions, privacy deletes, and incremental downstream jobs are natural fits.',
        'For a CDC orders table, merge-on-read can append frequent updates to logs so ingestion remains low latency. Dashboard snapshot queries merge base files and logs. A compaction service rewrites hot file groups during low-traffic windows. The same timeline can feed an incremental consumer asking for changes since a prior instant.',
        'For a read-heavy dimension table that updates once per day, copy-on-write can be simpler. Each update rewrites affected base files, and BI queries read Parquet base files without log merging. The right table type follows the workload, not a universal ranking.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'Hudi fails as a zero-maintenance file dump. A table needs compaction policy, cleaning policy, clustering choices, index tuning, key design, and monitoring. If the workload is pure append and read-mostly, a simpler append table can be easier to operate.',
        'It is also the wrong tool for low-latency point transactions that need database-style locking and millisecond reads. Hudi improves lake mutation, but it is still a lakehouse table format over large files. If every request needs one row now, a database or serving store may be the better system.',
        'Common hazards are stale timeline assumptions, file-group skew, unstable record keys, compaction backlog, metadata lag, and retention settings that clean files needed by old readers. These failures look like query slowness or missing records, but the cause is often table-service debt.',
      ],
    },
    {
      heading: 'Practical guidance',
      paragraphs: [
        'Review a Hudi table by asking how records find their file groups, how long log chains may grow, when compaction runs, how old slices are cleaned, how failed writes roll back, and how downstream consumers choose timeline instants. Those questions decide whether the table behaves like a storage system or a folder of mysterious files.',
        'Choose CoW when read simplicity dominates and update volume is modest. Choose MoR when ingestion freshness matters and the team can operate compaction. Watch file sizes, log-chain length, compaction delay, small-file growth, failed instants, cleaner retention, and incremental reader lag.',
        'Make key design explicit. If record keys are not stable, upserts become duplicates. If partitioning fights the update pattern, writers and compactors concentrate on hot groups. If keys are too skewed, one group can become the read and compaction bottleneck.',
      ],
    },
    {
      heading: 'What the visual shows',
      paragraphs: [
        'The timeline view shows state transitions. Completed instants are part of reader visibility. Requested and inflight instants explain work in progress. Rollback, clean, and compaction instants are not background noise; they preserve a coherent snapshot model.',
        'The file-group view shows update locality. The timeline answers which instant is visible. The file group answers where the latest versions for a record range live. The CoW/MoR view shows where the merge is paid: at write time for CoW, at read and compaction time for MoR.',
      ],
    },
    {
      heading: 'Misconceptions',
      paragraphs: [
        'The common mistake is treating copy-on-write or merge-on-read as a universal winner. CoW moves cost to writes. MoR moves cost to reads and compaction. Neither removes the cost of mutation; each moves it to a different part of the system.',
        'A second mistake is treating compaction as optional cleanup. In merge-on-read tables, compaction is part of the read-performance contract. If it lags, queries pay longer merge chains and operators debug symptoms that are really table-service debt.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Apache Hudi concepts at https://hudi.apache.org/docs/concepts/, table and query types at https://hudi.apache.org/docs/table_types/, and Hudi merge-on-read discussion at https://hudi.apache.org/blog/2025/07/21/mor-comparison/.',
        'Study Delta Lake Case Study and Apache Iceberg Table Format Case Study for neighboring table formats, Debezium CDC Case Study for update streams, Parquet Columnar Format Case Study for base-file layout, RocksDB MANIFEST & VersionSet for versioned file metadata, and Write-Ahead Log for committed-history thinking.',
      ],
    },
  ],
};
