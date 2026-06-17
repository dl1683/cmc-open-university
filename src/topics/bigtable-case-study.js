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
      heading: 'The problem',
      paragraphs: [
        'Bigtable was designed for structured data that was too large, too sparse, and too operationally demanding for a single database server. Google needed to store web pages, crawl metadata, geographic data, logs, and many timestamped versions of facts. Most rows had only a few meaningful columns, but the table as a whole needed to span many machines and serve both point lookups and ordered scans.',
        'The clean abstraction is a sparse, distributed, sorted map. A cell is addressed by row key, column family and qualifier, and timestamp. That sounds like a data-structure API, but the hard part is making the map survive machine failures, grow by adding servers, split hot ranges, and keep writes fast without forcing every update into one central index.',
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        'A natural first attempt is to shard by hashing row keys. Hashing spreads writes well because nearby application keys land on different machines. It also makes ordered scans expensive because a scan over adjacent rows must talk to many shards and merge their results. For Bigtable workloads, row order is not decorative; it is how applications keep related facts near each other.',
        'Another attempt is to keep a classic B-tree-like structure per shard and update pages in place. That works for smaller systems, but it fights the storage environment Bigtable was built on. Distributed file systems are good at appending and writing large immutable files. They are less pleasant when many servers perform tiny random page rewrites and then need careful recovery after crashes.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that a sorted map gives locality and scans, but locality also concentrates load. If all new rows begin with today, the current day range can become a hot tablet. If row keys are salted too aggressively, writes spread out but useful scans lose their natural order. The storage system can split and move tablets, but it cannot invent a good row-key design for the application.',
        'The second wall is recovery. Once a table is split into tablets and assigned to many tablet servers, clients need a way to find the right server, masters need a way to assign work, and failed servers must not leave their ranges ambiguous. The simple map has become a metadata, locking, logging, compaction, and load-balancing system.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Bigtable keeps the sorted-map abstraction and makes the physical unit of distribution a tablet: a contiguous interval of row keys. A tablet can be assigned to one tablet server, moved to another server, or split into two smaller ranges. This preserves range scans because adjacent rows tend to live together, while still giving the system a clean object to balance across machines.',
        'The write path uses log-structured storage. A tablet server appends the update to a commit log for durability, applies it to an in-memory memtable for speed, and later flushes the memtable into immutable SSTables stored in the distributed file system. Reads merge the memtable with SSTables. Compaction rewrites sorted files so reads do not have to search too many old fragments.',
      ],
    },
    {
      heading: 'System mechanics',
      paragraphs: [
        'A client first locates the tablet that owns a row. Bigtable uses metadata tables to map row ranges to tablet servers, and clients cache those locations after lookup. The master is responsible for tablet assignment, load balancing, and recovery coordination, but normal reads and writes go directly from client to tablet server after location discovery.',
        'Chubby, the lock service in the original design, provides coordination for master election and server liveness. This is not part of the user data model, but it is essential for avoiding confusion about who owns a tablet. If a tablet server dies, the system must identify its tablets, recover from logs, and reassign those ranges without letting two active servers believe they own the same work.',
        'Column families are also physical design choices. Data in a family is stored together and configured together, so a family should group values with similar access patterns and retention behavior. A random pile of columns inside one family can make reads and compaction do more work than the application expected.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The design works because each layer has a narrow job. Sorted row keys give the data model scan locality. Tablets turn that order into movable distribution units. Metadata lets clients find tablet owners. The commit log protects acknowledged writes. Memtables make recent writes cheap. SSTables make durable data sequential and immutable. Compaction pays the cleanup cost in the background.',
        'The important invariant is that a write is not safe merely because it reached memory. It becomes crash-safe when the durable log records it. The memtable is a fast serving structure, not the only copy. After a crash, the server can replay logs, reconstruct recent state, and combine that state with SSTables already stored in the distributed file system.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Imagine a table of crawled web pages using reversed domain row keys such as com.cnn/page1 and org.usenix/osdi. Reversing the domain groups pages from the same site or domain neighborhood, which can make site-level scans efficient. A row might have contents:html for page content, anchor:text for inbound anchor text, and multiple timestamped versions so older crawl results can coexist with newer ones.',
        'A write for com.cnn/page1 reaches a tablet server that owns the range com.a through com.m. The server appends the mutation to its commit log, updates the memtable, and acknowledges when the durability rule is satisfied. Later, the memtable fills, flushes as an SSTable, and eventually compaction merges that SSTable with older files. A read for the same row checks memory and the relevant SSTable blocks, using indexes and filters to avoid unnecessary file reads.',
        'If traffic to rows in com.n through org.g becomes hot, the tablet for that interval can split. One half remains on the original server and the other moves to a different server. This helps only when the row-key order creates useful split points. If every write targets one celebrity row, splitting adjacent ranges will not fix the single-row hotspot.',
      ],
    },
    {
      heading: 'Animation guide',
      paragraphs: [
        'The tablet write-path view follows the map from API to machinery. The client starts with metadata lookup, then sends the operation to the tablet server. The highlighted log and memtable explain the latency pattern: append for durability, memory update for serving, immutable files for later persistence, and compaction for cleanup.',
        'The row-key locality view focuses on the sharding decision. A tablet is not a random bucket; it is a contiguous interval. The split frame shows Bigtable using sorted order as an operational tool. The table of design lessons connects the same mechanism to indexing, sharding, LSM trees, and distributed locks because Bigtable is a composition of those ideas rather than one isolated trick.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The main benefit of sorted tablets is also the main risk. Range scans and locality are excellent when row keys match query patterns. Hotspotting is painful when row keys put too much write or read traffic into one narrow interval. Salting, bucketing, reversing keys, or adding time windows can spread load, but every spread technique has a scan cost.',
        'Log-structured storage trades write speed for read and maintenance complexity. Writes are cheap because they append and touch memory. Reads may need to merge several sources. Compaction reduces that read amplification, but compaction consumes CPU, disk bandwidth, and background I/O. If compaction falls behind, latency can rise even though individual writes still look simple.',
        'Metadata and locking are another tradeoff. Clients need accurate tablet locations, but asking metadata for every request would be slow. Caching helps, so clients must also handle stale cache entries when tablets move. Coordination services make ownership safer, but they become critical infrastructure that the whole storage system depends on.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Bigtable-style design wins when the application can name its access pattern. It is strong for enormous sparse tables, timestamped facts, user or document records with related columns, time-series-like versions, and workloads that need point reads plus row-range scans. It also fits systems that can tolerate an application-shaped schema rather than requiring ad hoc relational joins.',
        'It influenced HBase, wide-column stores, cloud table services, and many internal storage engines because it gives engineers a practical template: preserve key order, divide the order into ranges, write through a log and memtable, store immutable sorted files, and compact in the background.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Bigtable is a poor fit when the application needs arbitrary SQL joins, multi-row relational constraints, or many secondary access paths that were not designed up front. You can build additional indexes and services around it, but the base abstraction is not a general relational optimizer. It rewards modeling discipline and punishes vague query requirements.',
        'It also fails gracefully only when operational limits are respected. Long compaction backlogs, bad row-key distribution, overloaded tablet servers, stale metadata caches, slow recovery, and badly chosen column families can all make a sorted-map API feel unpredictable. The system gives powerful knobs, but those knobs are close to the workload and must be understood by the user.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The most common design failure is the hot tablet. Sequential timestamps, increasing numeric IDs, or one popular entity can aim too much traffic at one range. Splitting helps when the heat covers a range, but not when the heat is a single key. The fix usually starts in row-key design, not in the master scheduler.',
        'The second failure is read amplification. If data has been flushed into many SSTables and compaction cannot keep up, reads must consult more files and more metadata. Bloom filters and block indexes reduce wasted reads, but they do not remove the need for compaction. The third failure is recovery pressure: a crash may require log replay and tablet reassignment exactly when the cluster is already stressed.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary source: "Bigtable: A Distributed Storage System for Structured Data" at https://research.google.com/archive/bigtable-osdi06.pdf. After this topic, study LSM Trees (How Cassandra Writes), SSTable Block Index & Filter, Write-Ahead Log (WAL), Database Indexing, Sharding & Partitioning, Bloom Filter, and Distributed Locks: What They Can Promise.',
        'The useful mental bridge is to ask which part of Bigtable each follow-up topic explains. LSM trees explain the write path. SSTable indexes and Bloom filters explain read efficiency. Sharding explains tablets. Distributed locks explain ownership. Database indexing explains why sorted order is a feature and not just an implementation detail.',
      ],
    },
  ],
};
