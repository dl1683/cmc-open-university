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
    explanation: 'A Hudi table has a timeline of instants. Commits, delta commits, compactions, cleans, and rollbacks record how the table moved from one state to the next.',
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
    explanation: 'The timeline is the table log. Readers use completed instants to decide which file slices are visible, while writers and services use pending instants to coordinate table services.',
    invariant: 'A reader chooses a table state by filtering timeline instants.',
  };

  yield {
    state: hudiGraph('File groups evolve through file slices'),
    highlight: { active: ['fg', 'base1', 'log', 'base2'], found: ['timeline'] },
    explanation: 'A file group is identified by a file id. Over time it contains file slices: a base file plus optional log files. This is the data structure that lets Hudi update immutable lake files incrementally.',
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
    explanation: 'In copy-on-write tables, updates create new base files. Reads are simpler because they only scan base files, but writes pay the rewrite cost when records change.',
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
    explanation: 'Merge-on-read appends row-based delta logs to file groups and merges them with base files at read time for snapshot queries. Read-optimized queries can skip logs and read only base files.',
  };

  yield {
    state: hudiGraph('Compaction turns delta logs into a fresh base slice'),
    highlight: { active: ['log', 'base2', 'e-log-base2'], found: ['reader'], compare: ['base1'] },
    explanation: 'Compaction is the pressure-release valve for merge-on-read. It combines accumulated delta logs with base files into newer base files so future reads do not merge long log chains.',
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
        'Apache Hudi is a lakehouse table format focused on record-level upserts, deletes, incremental pulls, and table services. Its core mechanics are the timeline, file groups, file slices, copy-on-write tables, merge-on-read tables, and compaction.',
        'This case study extends Delta Lake Case Study, Apache Iceberg Table Format Case Study, Parquet Columnar Format Case Study, Debezium CDC Case Study, RocksDB MANIFEST & VersionSet, and Write-Ahead Log. The key lesson is how update-heavy lake tables organize immutable files into evolving file groups.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The Hudi timeline records table actions as instants: commits, delta commits, compactions, cleans, rollbacks, and other table-service events. Readers inspect completed instants to decide which files are visible. Writers and table services coordinate around pending and completed instants.',
        'Data is organized into file groups. A file group has a file id and evolves through file slices. A slice may contain a base Parquet file and, for merge-on-read tables, log files with newer changes. Snapshot queries merge the latest base file with relevant log records.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Copy-on-write makes reads fast because queries scan base files, but updates rewrite affected base files. Merge-on-read makes writes cheaper by appending delta logs, but snapshot reads pay merge cost until compaction creates fresh base files.',
        'The operational tradeoff is table services. Compaction, cleaning, clustering, indexing, and rollback policies determine whether the table stays healthy. Too little compaction leaves long log chains. Too aggressive compaction steals IO from ingestion and queries.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A CDC pipeline ingests orders from MySQL into a data lake. Updates arrive every few seconds. A merge-on-read Hudi table appends delta logs to affected file groups so ingestion stays low-latency. Dashboard snapshot queries merge base files and logs. A compaction service later rewrites hot file groups into fresh base files during low-traffic windows.',
        'For a read-heavy dimension table that updates once per day, copy-on-write is simpler. Each update rewrites affected base files, and BI queries only read Parquet base files without log merging.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The common mistake is treating copy-on-write and merge-on-read as universal winners. CoW moves cost to writes; MoR moves cost to reads and compaction. Another trap is ignoring file-group skew. If updates cluster around a small number of file groups, those groups become compaction and query hot spots.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Apache Hudi concepts at https://hudi.apache.org/docs/concepts/, table and query types at https://hudi.apache.org/docs/table_types/, and Hudi merge-on-read discussion at https://hudi.apache.org/blog/2025/07/21/mor-comparison/. Study Delta Lake Case Study, Apache Iceberg Table Format Case Study, Debezium CDC Case Study, Parquet Columnar Format Case Study, and RocksDB MANIFEST & VersionSet next.',
      ],
    },
  ],
};
