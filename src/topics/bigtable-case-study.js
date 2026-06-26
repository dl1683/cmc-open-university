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
    explanation: 'The architecture view starts from the abstraction: a sparse sorted map indexed by row, column family, column, and timestamp. The client uses metadata to find the tablet server for a row range, then talks to that server directly.',
  };

  yield {
    state: architecture('Write path: log first, then memtable'),
    highlight: { active: ['tablet', 'log', 'mem', 'e-tablet-log', 'e-tablet-mem'], found: ['gfs'] },
    explanation: 'The highlighted write path is classic LSM thinking. Log first for durability, update memory for speed, then flush immutable SSTables and compact later. Bigtable turns a simple sorted map into a distributed write-optimized store.',
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
    explanation: 'The sparse table shows why Bigtable fits web-scale facts. Empty cells are cheap, timestamps preserve versions, and column families group related data. The row key is not just an ID; it determines locality and load.',
  };

  yield {
    state: architecture('Memtables become SSTables; compaction restores order'),
    highlight: { active: ['mem', 'sst', 'e-mem-sst'], found: ['gfs'], compare: ['log'] },
    explanation: 'The compaction view shows the deferred cleanup. Reads merge memtable and SSTables, so too many files make reads expensive. Compaction rewrites sorted files to reduce read amplification and discard hidden versions.',
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
    explanation: 'The row-range table is the sharding lesson. A tablet is a contiguous key interval, which makes scans and movement clean. It also means bad row keys can concentrate traffic into one hot range.',
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
    explanation: 'The split step shows how sorted sharding adapts. A hot or large tablet can become two ranges, and one range can move to another server. The split helps only if the key design gives the system a useful boundary.',
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
    explanation: 'The final table connects the abstraction to the machinery. Bigtable looks like a sorted map from the API, but production requires metadata, leases, logs, memtables, SSTables, compaction, tablet movement, and load balancing.',
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read Bigtable as a sorted sparse map split into tablets. Sparse means most possible row, column, and timestamp cells do not exist. A tablet is a contiguous row-key range assigned to one tablet server, and it is the unit that splits, moves, recovers, and compacts.',
        {type:'callout', text:'Bigtable scales by making the tablet the movable unit: row-key ranges split, move, recover, flush, and compact without changing the sorted-map API.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/2/2a/Wikimedia_Servers-0051_17.jpg', alt:'Rows of Wikimedia servers in a data center', caption:'Server rows make the physical constraint visible: Bigtable was designed for data and failures spread across many machines. Source: Wikimedia Commons, Helpameout, CC BY-SA 3.0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Bigtable exists because one database machine cannot store and serve web-scale structured data reliably. Google needed a system for huge tables, high write rates, large scans, and machine failures. The API had to stay simple while the physical data moved across many servers.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Wikimedia_Servers-0051_17.jpg/960px-Wikimedia_Servers-0051_17.jpg',
          alt: 'Rows of server racks in a data center',
          caption: 'Bigtable was built for commodity-machine scale: many ordinary servers, many failures, and data sizes too large for one database machine. Source: Wikimedia Commons, Helpameout, CC BY-SA 3.0.',
        },
        {
          type: 'callout',
          text: 'Bigtable is a data-structure answer to a systems constraint: keep the API as a sorted sparse map, then make every physical unit split, move, recover, cache, and compact independently.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to put rows in one large sorted tree on one server. A B-tree-like index can keep keys ordered and support range scans. This works until the data or request rate exceeds one machine.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/B-tree.svg/960px-B-tree.svg.png',
          alt: 'A small B-tree with a root node and three leaf nodes',
          caption: 'A B-tree keeps sorted data reachable through a shallow hierarchy. Bigtable borrows the hierarchy idea for tablet metadata, but stores user data in immutable SSTables instead of one mutable distributed tree. Source: Wikimedia Commons, CyHawk, CC BY-SA 3.0.',
        },
        'A second obvious approach is sharding by hash. Hashing balances load but destroys row order. Bigtable keeps row-key order because many workloads need scans over adjacent keys, such as all pages for one site or all events for one time range.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is ownership. If two servers think they own the same row range, writes can diverge. If no server owns a range, the data is unavailable. A distributed sorted map must make ownership explicit and recover it after failures.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/1/16/Cluster_split-brain.png',
          alt: 'Two cluster nodes separated by network failures but still pointing at shared storage',
          caption: 'A split-brain failure is the ownership nightmare Bigtable avoids: two servers must not both believe they own the same tablet. Source: Wikimedia Commons, Speculos, CC BY-SA 4.0.',
        },
        'The system also needs a write path that survives crashes. Memory is fast but volatile, while disk files are durable but slow to update in place. Bigtable needs a structure that can accept writes quickly and reorganize them later.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to split the sorted map by row-key ranges and make each range a tablet. A master assigns tablets to tablet servers, and coordination state prevents two servers from owning the same tablet at the same time. Users still see one table; the system manages many movable pieces.',
        {
          type: 'callout',
          text: 'A tablet is the movable unit that makes Bigtable work. It is big enough to amortize metadata and small enough to split, assign, recover, and rebalance independently.',
        },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/LSM_Tree.png/800px-LSM_Tree.png',
          alt: 'Log-structured merge tree diagram with in-memory and on-disk sorted levels',
          caption: 'The LSM pattern behind Bigtable tablets: append and sort in memory first, then flush immutable sorted files and compact them later. Source: Wikimedia Commons, Ben Stopford, CC BY-SA 4.0.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {
          type: 'callout',
          text: 'In Bigtable, schema design is physical design. A row key is a locality hint, a column family is a storage and policy unit, and a timestamp is a versioning and garbage-collection rule.',
        },
        'A write enters a tablet server, is recorded in a commit log, and is applied to an in-memory sorted structure. When memory fills, it flushes to an immutable SSTable, which is a sorted string table on distributed storage. Later compaction merges SSTables so reads do not have to check too many files.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/CAP_Theorem.svg/960px-CAP_Theorem.svg.png',
          alt: 'CAP theorem diagram showing consistency, availability, and partition tolerance',
          caption: 'Bigtable depends on Chubby for coordination, so it pays a consistency-first coordination cost. If Chubby is unavailable for long enough, Bigtable becomes unavailable rather than risking conflicting ownership. Source: Wikimedia Commons, Mooond, CC BY-SA 4.0.',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        {
          type: 'callout',
          text: 'Durability invariant: memory is only the serving copy. The commit log is the recovery copy. A write can be acknowledged only after the redo record is durable enough to replay.',
        },
        'The correctness argument separates durability from serving. The memtable can be lost because the commit log can replay acknowledged writes. SSTables are immutable, so compaction can build new files without corrupting old files before the metadata switch.',
        'Tablet ownership works because assignment is coordinated. A tablet server serves a range only while it holds the required lease or assignment state. If it dies, another server can replay logs, load SSTables, and resume ownership for that row range.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Bigtable cost grows with tablets, SSTables per tablet, row-key distribution, and compaction debt. A write is cheap at first because it appends to a log and memory. The cost is paid later when immutable files are compacted to keep reads efficient.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Bloom_filter.svg/800px-Bloom_filter.svg.png',
          alt: 'Bloom filter diagram showing hash functions mapping elements to a bit array',
          caption: 'Bloom filters let Bigtable skip SSTable disk reads when a row-column pair is definitely absent. False positives are possible; false negatives are not. Source: Wikimedia Commons, David Eppstein, Public domain.',
        },
        {
          type: 'callout',
          text: 'A Bloom filter changes a disk question into a memory question: if any required bit is missing, the SSTable cannot contain the row-column pair, so Bigtable skips that file.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Bigtable fits large sparse datasets keyed by row ranges: web indexing, time-series events, monitoring data, maps, logs, and analytical input for distributed jobs. The access pattern is high-throughput writes, point reads, and scans over carefully designed row-key ranges. Schema design matters because the row key determines locality.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/8/83/Big-data-concepts-20-638.jpg',
          alt: 'Hadoop architecture diagram showing distributed file system input splits, map tasks, and reduce tasks',
          caption: 'Bigtable was designed to work with MapReduce as both input and output. The point is the same as in Hadoop-style processing: move structured work to many machines and keep large scans sequential. Source: Wikimedia Commons, Magnai17, CC BY-SA 4.0.',
        },
        'It is strongest when the application can choose row keys that spread load while preserving useful scan locality. For example, a monitoring table might include a metric name and time bucket so recent writes are distributed and range scans still read adjacent data.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Bigtable fails when users expect relational joins, secondary indexes everywhere, or arbitrary ad hoc queries without data modeling. It is a sorted sparse map, not a general SQL engine. If the row key does not match access patterns, the system can be fast at the wrong thing.',
        'It also fails under hot ranges. If all new writes go to one row-key prefix, one tablet becomes overloaded until splitting and rebalancing catch up, and sometimes splitting does not help because the hotspot is the latest key. Good keys distribute heat without destroying the scans the product needs.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a table stores 12 TB of log rows and tablets target 256 MB. That is roughly 48,000 tablets. If a cluster has 400 tablet servers, the average server owns about 120 tablets before accounting for load and locality.',
        'A write to row app42#2026-06-25T10:00 first appends to the commit log and updates the memtable for that tablet. If the tablet server crashes after acknowledging the write, recovery replays the log and reconstructs the memtable state. The user does not rely on memory surviving.',
        'A read for one row may check several SSTables. If Bloom filters rule out 18 of 20 files, only two disk reads remain for that row-column pair. If the workload doubles and compaction falls behind, each read may check more files, so read latency reveals write-path debt.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: the Google Bigtable paper, the Chubby lock service paper, the SSTable and LevelDB family of storage-engine notes, and documentation for modern Bigtable-compatible systems. Read them with one question: which physical unit is being moved, recovered, or compacted.',
        'Study next by role. For storage internals, study LSM trees, memtables, SSTables, Bloom filters, and compaction. For distributed coordination, study leases and split-brain prevention. For data modeling, study row-key design and hotspot avoidance.',
      ],
    },
  ],
};
