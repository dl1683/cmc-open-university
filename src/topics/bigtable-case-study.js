// Bigtable case study: a sparse, distributed, sorted map built from tablets,
// memtables, SSTables, metadata tablets, and a lock service.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'bigtable-case-study',
  title: 'Bigtable Case Study',
  category: 'Papers',
  summary: 'Google Bigtable as a storage-system lesson: sparse rows, tablets, memtables, SSTables, metadata, and locality.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['tablet write path', 'row-key locality'], defaultValue: 'tablet write path' },
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
      { id: 'client', label: 'client', x: 0.7, y: 4.0, note: 'read/write row' },
      { id: 'metadata', label: 'metadata', x: 2.5, y: 2.2, note: 'tablet location' },
      { id: 'chubby', label: 'Chubby', x: 2.5, y: 5.8, note: 'lock service' },
      { id: 'master', label: 'master', x: 4.4, y: 5.8, note: 'assign tablets' },
      { id: 'tablet', label: 'tablet server', x: 4.4, y: 3.2, note: 'owns row range' },
      { id: 'log', label: 'commit log', x: 6.5, y: 2.0, note: 'durable write' },
      { id: 'mem', label: 'memtable', x: 6.5, y: 3.6, note: 'mutable memory' },
      { id: 'sst', label: 'SSTables', x: 6.5, y: 5.2, note: 'immutable files' },
      { id: 'gfs', label: 'GFS', x: 8.5, y: 4.0, note: 'distributed file system' },
    ],
    edges: [
      { id: 'e-client-meta', from: 'client', to: 'metadata', weight: 'find tablet' },
      { id: 'e-client-tablet', from: 'client', to: 'tablet', weight: 'RPC' },
      { id: 'e-chubby-master', from: 'chubby', to: 'master', weight: 'master lease' },
      { id: 'e-master-tablet', from: 'master', to: 'tablet', weight: 'assignment' },
      { id: 'e-tablet-log', from: 'tablet', to: 'log', weight: 'append' },
      { id: 'e-tablet-mem', from: 'tablet', to: 'mem', weight: 'update' },
      { id: 'e-mem-sst', from: 'mem', to: 'sst', weight: 'minor compaction' },
      { id: 'e-log-gfs', from: 'log', to: 'gfs', weight: 'file' },
      { id: 'e-sst-gfs', from: 'sst', to: 'gfs', weight: 'file' },
    ],
  }, { title });
}

function* tabletWritePath() {
  yield {
    state: architecture('Bigtable splits one table into tablets'),
    highlight: { active: ['client', 'metadata', 'tablet'], compare: ['master', 'chubby'] },
    explanation: 'Bigtable exposes a sparse, distributed, sorted map: (row key, column family, column, timestamp) -> value. A client first discovers which tablet server owns the row range, then sends reads and writes directly to that tablet server.',
  };

  yield {
    state: architecture('Write path: log first, then memtable'),
    highlight: { active: ['tablet', 'log', 'mem', 'e-tablet-log', 'e-tablet-mem'], found: ['gfs'] },
    explanation: 'A write is appended to a commit log for durability and applied to an in-memory memtable for fast reads. Later, memtables flush into immutable SSTables. This is the same write path family as LSM Trees (How Cassandra Writes): absorb random writes in memory, then compact sorted files over time.',
    invariant: 'A write is not safe until the durable log records it.',
  };

  yield {
    state: labelMatrix(
      'Sparse sorted map data model',
      [
        { id: 'r1', label: 'com.cnn/page1' },
        { id: 'r2', label: 'com.cnn/page2' },
        { id: 'r3', label: 'org.acm/paper' },
        { id: 'r4', label: 'org.usenix/osdi' },
      ],
      [
        { id: 'anchor', label: 'anchor:text' },
        { id: 'contents', label: 'contents:html' },
        { id: 'ts', label: 'timestamped cells' },
      ],
      [
        ['links here', '<html...>', 't7,t8'],
        ['', '<html...>', 't5'],
        ['citation', '', 't3,t6'],
        ['program', '<html...>', 't9'],
      ],
    ),
    highlight: { active: ['r1:contents', 'r1:ts', 'r3:anchor'], compare: ['r2:anchor'] },
    explanation: 'Rows are sorted lexicographically and columns are grouped into column families. Missing cells cost little, which makes the data model natural for web pages, metadata, logs, and time-versioned facts. The row key is a performance decision, not just an identifier.',
  };

  yield {
    state: architecture('Memtables become SSTables; compaction restores order'),
    highlight: { active: ['mem', 'sst', 'e-mem-sst'], found: ['gfs'], compare: ['log'] },
    explanation: 'Reads merge the mutable memtable with immutable SSTables. Over time, compaction rewrites SSTables to reduce read amplification and reclaim overwritten versions. That connects directly to Bloom Filter, LSM Trees (How Cassandra Writes), and MVCC Internals & VACUUM.',
  };
}

function* rowKeyLocality() {
  yield {
    state: labelMatrix(
      'Tablet ranges are contiguous row-key intervals',
      [
        { id: 't1', label: 'tablet 1' },
        { id: 't2', label: 'tablet 2' },
        { id: 't3', label: 'tablet 3' },
      ],
      [
        { id: 'range', label: 'row range' },
        { id: 'server', label: 'server' },
        { id: 'load', label: 'load' },
      ],
      [
        ['com.a - com.m', 'server A', 'medium'],
        ['com.n - org.g', 'server B', 'hot'],
        ['org.h - org.z', 'server C', 'low'],
      ],
    ),
    highlight: { active: ['t2:load'], compare: ['t1:range', 't3:range'] },
    explanation: 'A tablet is a contiguous range of row keys. That makes range scans efficient and gives Bigtable a clean unit for splitting, moving, and load balancing. It also means row-key design decides locality: adjacent keys land together until a split moves a range.',
  };

  yield {
    state: labelMatrix(
      'A hot tablet splits into two ranges',
      [
        { id: 'before', label: 'before split' },
        { id: 'left', label: 'after left' },
        { id: 'right', label: 'after right' },
      ],
      [
        { id: 'range', label: 'range' },
        { id: 'server', label: 'server' },
        { id: 'result', label: 'result' },
      ],
      [
        ['com.n - org.g', 'server B', 'hot tablet'],
        ['com.n - net.z', 'server B', 'half range'],
        ['org.a - org.g', 'server D', 'moved range'],
      ],
    ),
    highlight: { found: ['left:result', 'right:server'], removed: ['before:result'] },
    explanation: 'When a tablet grows or becomes hot, the system can split it and assign a new range to another tablet server. This is Sharding & Partitioning with sorted-key semantics: data movement is range-based, not arbitrary bucket movement.',
    invariant: 'Sorted row keys buy scans and range movement; they can also create hot ranges.',
  };

  yield {
    state: labelMatrix(
      'Bigtable design lessons',
      [
        { id: 'model', label: 'data model' },
        { id: 'write', label: 'write path' },
        { id: 'metadata', label: 'metadata' },
        { id: 'locality', label: 'locality' },
      ],
      [
        { id: 'choice', label: 'choice' },
        { id: 'link', label: 'study link' },
      ],
      [
        ['sparse sorted map', 'Database Indexing'],
        ['log + memtable + SSTables', 'LSM Trees (How Cassandra Writes)'],
        ['tablet locations', 'Distributed Locks: What They Can Promise'],
        ['row-key ranges', 'Sharding & Partitioning'],
      ],
    ),
    highlight: { found: ['write:link', 'locality:link'], compare: ['metadata:choice'] },
    explanation: 'Bigtable is useful because it sits between simple data structures and production storage. The sorted map abstraction is simple; the distributed implementation needs metadata, leases, log replay, compaction, splitting, and operational load balancing.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'tablet write path') yield* tabletWritePath();
  else if (view === 'row-key locality') yield* rowKeyLocality();
  else throw new InputError('Pick a Bigtable view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Bigtable is Google\'s distributed storage system for structured data. Its data model is a sparse, distributed, persistent, multidimensional sorted map indexed by row key, column key, and timestamp. It was designed to scale to petabytes across thousands of machines while supporting many Google products with different access patterns.',
        'The case study matters because it bridges data structures and operations. A simple sorted map turns into tablets, metadata, leases, commit logs, memtables, SSTables, compaction, row-key design, and load balancing once it has to run as a shared production service.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Rows are kept in lexicographic order and split into tablets, which are contiguous row ranges. Tablet servers serve reads and writes for assigned tablets. A master assigns tablets, handles load balancing, and coordinates recovery, while a lock service is used for master election and tablet-server liveness.',
        'The write path appends to a commit log and updates a memtable. When the memtable grows, it flushes to immutable SSTables stored in a distributed file system. Reads merge data from the memtable and SSTables. Compaction reduces the number of SSTables, removes overwritten data, and keeps reads manageable.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The sorted-row design makes scans and range movement efficient, but it pushes responsibility into row-key choice. A timestamp prefix or monotonically increasing key can create a hot tablet. A well-designed key distributes writes while preserving useful locality. Operational cost appears in compaction, tablet splitting, metadata caching, recovery, and avoiding overload on hot ranges.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Bigtable influenced HBase, Cassandra-style storage discussions, cloud wide-column databases, and many internal storage systems. It fits workloads with huge sparse rows, timestamped versions, predictable row-range scans, and application-controlled schema within column families.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Bigtable is not a relational database with arbitrary joins and SQL semantics. It is closer to a distributed sorted map with column families and versions. Another misconception is that sorted keys automatically solve locality. They expose locality; the application still has to choose row keys that balance scan efficiency against hot-spot risk.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: "Bigtable: A Distributed Storage System for Structured Data" at https://research.google.com/archive/bigtable-osdi06.pdf. Study LSM Trees (How Cassandra Writes), SSTable Block Index & Filter, Write-Ahead Log (WAL), Database Indexing, Sharding & Partitioning, Bloom Filter, and Distributed Locks: What They Can Promise next.',
      ],
    },
  ],
};
