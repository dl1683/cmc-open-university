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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the timeline view as a visibility proof. Active nodes show the instant or file group currently being chosen, and found nodes show state that a reader may safely include in a snapshot.',
        'Read the CoW and MoR view as a cost transfer. Copy-on-write pays during the write by making a new base file, while merge-on-read pays during reads and compaction by merging log files with a base file.',
        {type:'callout', text:'Hudi makes mutable lake data safe by separating committed table history from immutable file pieces, so readers choose a timeline instant instead of trusting stray objects in storage.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A data lake stores analytical data in large files, often in object storage. That works for append-only logs, but modern teams also need updates, deletes, correction jobs, change data capture, and incremental readers without moving the data into a separate database.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg', alt: 'Data lake storage infrastructure', caption: 'Data lakes store petabytes across distributed storage — Hudi adds transactional guarantees on top. Source: Wikimedia Commons, Victorgrigas, CC BY-SA 3.0' },
        'Hudi exists because lake files are not database pages. It gives each table a committed history, routes records to stable file groups, and lets readers reconstruct one valid table state from immutable file pieces.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious lake design is to append a new Parquet file for every batch. A reader scans all visible files and treats the table as the union of those files.',
        'The opposite simple design is to rewrite a full partition whenever a record changes. That keeps reads easy because each partition contains only current rows, but a small update can force a large file rewrite.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Appending forever breaks upserts because old versions of a key remain visible unless every reader has a rule for picking the latest valid version. Rewriting whole partitions breaks ingestion because a stream of 10,000 row updates can rewrite gigabytes of unrelated columnar data.',
        'The wall is not only speed. The table needs a correctness rule for failed writes, rollback, cleaning, compaction, incremental reads, and long-running readers that started before the newest files existed.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Hudi separates table history from file layout. The timeline says which actions are committed, file groups say where a stable record range lives, and file slices say which base file plus log files form one visible version.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Row_and_column_major_order.svg', alt: 'Row vs column major storage order', caption: 'Columnar file formats like Parquet store data column-by-column for analytical efficiency. Hudi manages these files in file groups. Source: Wikimedia Commons, Cmglee, CC BY-SA 4.0' },
        'The key invariant is snapshot visibility. A reader includes only file slices allowed by completed timeline instants, so stray objects from failed or inflight writes do not become table state.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The timeline records table actions as instants. Commits, delta commits, compactions, cleans, rollbacks, and savepoints move through requested, inflight, and completed states so writers and readers agree on what is visible.',
        { type: 'callout', text: 'Hudi\'s timeline is an ordered log of every action — commits, compactions, cleans, rollbacks. It is the single source of truth: a reader picks a consistent snapshot by choosing a completed instant on the timeline.' },
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Internet_map_1024.jpg', alt: 'Network of connected data systems', caption: 'Hudi timelines coordinate concurrent writers across distributed compute engines. Source: Wikimedia Commons, The Opte Project, CC BY 2.5' },
        'A file group is the update home for a range of records. Each file group evolves through file slices, where a slice is a base Parquet file plus optional log files for newer changes.',
        { type: 'callout', text: 'File groups are Hudi\'s unit of data locality. Each file group contains a base Parquet file and optional log files. Updates to the same record always land in the same file group, ensuring merge efficiency.' },
        'Copy-on-write creates a new base file when records change. Merge-on-read appends changes to log files, and compaction later merges those logs into a fresh base file.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness follows from using committed timeline history, not object-store listing order, as the source of truth. A failed writer may leave files behind, but without a completed instant those files are invisible to snapshot readers.',
        'File groups preserve update locality. Once a record key maps to a group, later versions stay there, so a reader reconstructs the latest visible slice per group instead of searching every file for every key.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Cost moves rather than disappears. Copy-on-write gives fast reads because queries scan base files, but each update rewrites affected base files and creates write amplification.',
        { type: 'callout', text: 'Copy-on-write tables rewrite entire file groups on update, giving fast reads but expensive writes. Merge-on-read tables append deltas and merge at read time, giving fast writes but slower reads. The choice depends on the read/write ratio of the workload.' },
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/0/03/Hdd_and_ssd.JPG', alt: 'Storage hardware', caption: 'Copy-on-write tables double storage during compaction — a direct tradeoff between write amplification and read performance. Source: Wikimedia Commons, Evan-Amos, Public domain' },
        'Merge-on-read gives cheaper writes because it appends logs, but snapshot reads must merge those logs until compaction catches up. If compaction lags, every query pays accumulated read debt; if compaction runs too often, ingestion and queries compete for IO.',
        'Indexing is the other cost center. Upserts need a way to find the file group for a key, so Bloom filters, metadata tables, partitioning, and stable record keys become part of write behavior.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Hudi fits lake tables with record-level change: CDC orders, user profiles, correction pipelines, privacy deletes, slowly changing dimensions, and incremental downstream jobs. The useful access pattern is a mix of upserts and analytical reads over the same table.',
        'For a high-rate CDC orders table, merge-on-read can append updates quickly while compaction runs during quiet windows. For a read-heavy dimension table updated once per day, copy-on-write can keep BI scans simple by producing fresh base files.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Hudi fails when treated as a zero-maintenance folder of files. The table needs compaction policy, cleaning policy, clustering choices, index tuning, key design, and monitoring.',
        'It is also the wrong tool for millisecond point transactions that need database locks and single-row serving latency. Common hazards are unstable keys, skewed file groups, compaction backlog, metadata lag, and retention rules that clean files still needed by old readers.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a file group has one 512 MB base Parquet file with 5 million order rows. A CDC stream updates 20,000 rows in that group during an hour, with each changed row represented by about 200 bytes of key and payload in log files.',
        'Copy-on-write may rewrite close to 512 MB to publish a new base file for those updates. Merge-on-read may append roughly 4 MB of log data first, but every snapshot query on that group must merge base plus logs until compaction rewrites the 512 MB base once.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are the Apache Hudi concepts documentation, table type documentation, timeline documentation, and merge-on-read design notes. Read them for exact instant states, file slice rules, compaction behavior, and index choices.',
        'Study Parquet Columnar Format for base files, Debezium CDC for source changes, Delta Lake and Apache Iceberg for neighboring table formats, and write-ahead logging for committed-history thinking. Then compare one CoW table and one MoR table under the same update rate.',
      ],
    },
  ],
};