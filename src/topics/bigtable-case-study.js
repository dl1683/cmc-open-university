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
        'The animation has two jobs. The write-path view follows one operation from logical row key to tablet server, commit log, memtable, SSTables, and GFS. The row-key-locality view shows why Bigtable partitions by contiguous key ranges instead of random buckets.',
        {
          type: 'bullets',
          items: [
            'Active nodes mark the component that currently owns the decision: client location lookup, tablet serving, log append, memtable update, compaction, or range split.',
            'Found markers indicate a property the system has already secured: a durable log record, a known tablet owner, a split range, or a moved tablet.',
            'Compare markers show the cost side of the design: Chubby coordination, master assignment, stale metadata, hot ranges, or deferred compaction work.',
          ],
        },
        'The safe inference rule is simple: a row belongs to exactly one live tablet assignment at a time, and a write is not crash-safe until it has entered the commit log. Everything else in Bigtable exists to preserve those two facts while thousands of machines change underneath the table.',
        {type:'callout', text:'Bigtable scales by making the tablet the movable unit: row-key ranges split, move, recover, flush, and compact without changing the sorted-map API.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/2/2a/Wikimedia_Servers-0051_17.jpg', alt:'Rows of Wikimedia servers in a data center', caption:'Server rows make the physical constraint visible: Bigtable was designed for data and failures spread across many machines. Source: Wikimedia Commons, Helpameout, CC BY-SA 3.0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Bigtable exists because Google needed a storage abstraction between files and relational databases. GFS could store enormous files, but applications wanted structured records. Relational databases offered structure, but the 2006 Bigtable paper was targeting petabytes of data across thousands of commodity servers, with workloads ranging from batch web indexing to low-latency user-facing services.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Wikimedia_Servers-0051_17.jpg/960px-Wikimedia_Servers-0051_17.jpg',
          alt: 'Rows of server racks in a data center',
          caption: 'Bigtable was built for commodity-machine scale: many ordinary servers, many failures, and data sizes too large for one database machine. Source: Wikimedia Commons, Helpameout, CC BY-SA 3.0.',
        },
        'The paper gives the scale directly. Bigtable was used by more than 60 Google products and projects, including Google Analytics, Google Finance, Orkut, Personalized Search, Writely, and Google Earth. As of August 2006, Google had 388 non-test Bigtable clusters with about 24,500 tablet servers. A set of 14 busy clusters with 8069 tablet servers handled more than 1.2 million requests per second, about 741 MB/s incoming RPC traffic, and about 16 GB/s outgoing RPC traffic.',
        {
          type: 'callout',
          text: 'Bigtable is a data-structure answer to a systems constraint: keep the API as a sorted sparse map, then make every physical unit split, move, recover, cache, and compact independently.',
        },
        'The data model is small on purpose: a sparse, distributed, persistent, multidimensional sorted map from row key, column key, and 64-bit timestamp to an uninterpreted byte string. Sparse matters because most rows use only a few cells. Sorted matters because range scans and locality matter. Persistent and distributed matter because the table has to survive process, disk, network, and machine failures.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first reasonable design is hash sharding. Hash the row key, send each bucket to a server, and the load spreads well. This is a good design for pure point lookups. It is a bad default for Bigtable because it destroys row order. A scan over adjacent web pages, sessions, map tiles, or user-history events becomes a scatter-gather operation across many machines.',
        'The second reasonable design is a distributed B-tree. Keep one global sorted index, split pages as they fill, and follow pointers to the right leaf. The problem is not the B-tree idea itself. The problem is the environment: tiny random page updates, locks across many machines, and recovery of mutable pages are a poor fit for a shared distributed file system optimized for large sequential reads and writes.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/B-tree.svg/960px-B-tree.svg.png',
          alt: 'A small B-tree with a root node and three leaf nodes',
          caption: 'A B-tree keeps sorted data reachable through a shallow hierarchy. Bigtable borrows the hierarchy idea for tablet metadata, but stores user data in immutable SSTables instead of one mutable distributed tree. Source: Wikimedia Commons, CyHawk, CC BY-SA 3.0.',
        },
        {
          type: 'table',
          headers: ['Attempt', 'Why it is tempting', 'Where it breaks for Bigtable'],
          rows: [
            ['Hash buckets', 'Good point-lookup balance and simple routing', 'Range scans lose locality; related rows scatter across machines'],
            ['One distributed B-tree', 'Sorted order and familiar indexing semantics', 'Mutable pages, cross-machine locking, and recovery get complicated'],
            ['One database per product', 'Strong local control for each team', 'No shared storage substrate; every product rebuilds scaling and recovery'],
            ['Flat files on GFS', 'Excellent for bulk data and MapReduce', 'Too little structure for low-latency row reads, versions, access control, and scans'],
          ],
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is a three-way conflict. The system needs ordered rows for scans, distributed ownership for scale, and append-friendly storage for GFS. Hashing solves distribution but hurts order. A classic B-tree preserves order but wants mutable page updates. Flat files fit GFS but do not give row-level service. Bigtable survives by refusing to make any one layer do all three jobs.',
        'The second wall is failure. At Google scale, failures are normal inputs, not rare exceptions. The paper lists memory and network corruption, clock skew, hung machines, asymmetric partitions, bugs in dependencies, GFS quota overflow, and planned or unplanned hardware maintenance. A design that works only for fail-stop servers is not enough.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/1/16/Cluster_split-brain.png',
          alt: 'Two cluster nodes separated by network failures but still pointing at shared storage',
          caption: 'A split-brain failure is the ownership nightmare Bigtable avoids: two servers must not both believe they own the same tablet. Source: Wikimedia Commons, Speculos, CC BY-SA 4.0.',
        },
        'The third wall is the key-design tax. Lexicographic order is useful only when applications choose row keys with care. Reversing hostnames makes pages from the same domain contiguous. Sequential timestamps can create one hot end of the table. Adding random salt spreads writes but makes scans harder. Bigtable can split and move ranges; it cannot infer the application locality model.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Bigtable separates logical order from physical ownership. The logical table is sorted by row key. The physical unit is a tablet: one contiguous interval of the row-key space. A table starts as one tablet and grows by splitting into many tablets, each about 100-200 MB by default in the 2006 implementation. Each tablet is assigned to one tablet server at a time.',
        {
          type: 'callout',
          text: 'A tablet is the movable unit that makes Bigtable work. It is big enough to amortize metadata and small enough to split, assign, recover, and rebalance independently.',
        },
        'The second insight is to store each tablet like a log-structured merge system. A write appends to a commit log for durability, updates a sorted in-memory memtable for serving, and later gets flushed to immutable SSTables in GFS. A read merges the memtable and SSTables. Compaction turns many sorted fragments back into fewer sorted files.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/LSM_Tree.png/800px-LSM_Tree.png',
          alt: 'Log-structured merge tree diagram with in-memory and on-disk sorted levels',
          caption: 'The LSM pattern behind Bigtable tablets: append and sort in memory first, then flush immutable sorted files and compact them later. Source: Wikimedia Commons, Ben Stopford, CC BY-SA 4.0.',
        },
        'The result is a layered contract. Row order gives locality. Tablets give distribution. Metadata gives routing. Chubby gives ownership and bootstrapping. The commit log gives crash recovery. Memtables give fast recent writes. SSTables give immutable ordered storage. Compaction pays the cleanup cost after the foreground write returns.',
      ],
    },
    {
      heading: 'How the data model works',
      paragraphs: [
        'A Bigtable cell is addressed as row key, column family and qualifier, and timestamp. Row keys were arbitrary strings up to 64 KB, with 10-100 bytes typical in the paper. Every read or write under one row key is atomic, regardless of how many columns in that row are touched. That is why Bigtable can support single-row read-modify-write operations but not general cross-row transactions.',
        'Rows are stored in lexicographic order. In Webtable, the paper uses reversed URLs so maps.google.com/index.html becomes com.google.maps/index.html. That one schema choice makes pages from the same domain sit near each other, which helps host-level scans, compression, and MapReduce jobs over related pages.',
        {
          type: 'table',
          headers: ['Model part', 'What it means', 'Why it matters physically'],
          rows: [
            ['Row key', 'Sorted string, atomic row boundary', 'Controls tablet placement, scans, load, compression, and single-row transaction scope'],
            ['Column family', 'Declared group such as contents or anchor', 'Controls access rights, storage layout, locality groups, compression, and memory accounting'],
            ['Qualifier', 'Arbitrary suffix inside a family', 'Allows an unbounded number of sparse columns without schema churn'],
            ['Timestamp', '64-bit version coordinate', 'Lets recent versions be read first and old versions be garbage-collected by count or age'],
          ],
        },
        'Column families are the stable schema. The paper says the number of families should be small, in the hundreds at most, while the number of individual columns can be unbounded. That split is the wide-column idea: declare the storage groups, then let applications create sparse qualifiers freely inside those groups.',
        {
          type: 'callout',
          text: 'In Bigtable, schema design is physical design. A row key is a locality hint, a column family is a storage and policy unit, and a timestamp is a versioning and garbage-collection rule.',
        },
      ],
    },
    {
      heading: 'Tablet location and Chubby',
      paragraphs: [
        'A client must turn a row key into a tablet server. Bigtable uses a three-level location hierarchy. A Chubby file stores the root tablet location. The root tablet stores the locations of METADATA tablets. METADATA tablets store user-tablet locations. The root tablet is never split, which keeps the hierarchy at no more than three levels.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/CAP_Theorem.svg/960px-CAP_Theorem.svg.png',
          alt: 'CAP theorem diagram showing consistency, availability, and partition tolerance',
          caption: 'Bigtable depends on Chubby for coordination, so it pays a consistency-first coordination cost. If Chubby is unavailable for long enough, Bigtable becomes unavailable rather than risking conflicting ownership. Source: Wikimedia Commons, Mooond, CC BY-SA 4.0.',
        },
        'The paper gives the metadata scale: each METADATA row stores about 1 KB in memory. With 128 MB METADATA tablets, the three-level scheme can address 2^34 tablets, or 2^61 bytes if tablets are 128 MB. An empty client cache needs three network round trips, including one Chubby read. A stale cache can take up to six round trips because stale locations are discovered through misses.',
        'Chubby is the lock service. It had five active replicas, used Paxos, and stayed live when a majority could communicate. Bigtable used it to ensure at most one active master, store bootstrap data, discover tablet servers, finalize tablet-server deaths, store schema information, and store access control lists.',
        'Tablet servers create exclusive locks in a Chubby directory. If a tablet server loses its lock, for example because a network partition caused the Chubby session to expire, it stops serving tablets. If the master can acquire that server file, it deletes the file and moves the affected tablets back to the unassigned set. The invariant is ownership clarity: losing availability is better than serving the same row range from two places.',
      ],
    },
    {
      heading: 'Write path, SSTables, and compaction',
      paragraphs: [
        'A tablet server stores tablet state in GFS. Recent committed updates live in the memtable, an in-memory sorted buffer. Older updates live in a sequence of immutable SSTables. Each SSTable is a persistent ordered immutable map; internally it is a sequence of blocks, typically 64 KB by default, with a block index stored at the end and loaded into memory when the SSTable opens.',
        {
          type: 'callout',
          text: 'Durability invariant: memory is only the serving copy. The commit log is the recovery copy. A write can be acknowledged only after the redo record is durable enough to replay.',
        },
        'The write path is deliberately short. The tablet server validates authorization, writes the mutation to the commit log, uses group commit for many small mutations, and inserts the contents into the memtable. Reads execute against a merged view of SSTables and the memtable. Because both are sorted by key, the merge is efficient and does not require rewriting old files on every update.',
        'Minor compaction freezes a full memtable, creates a fresh memtable, and writes the frozen one as an SSTable in GFS. This lowers memory use and reduces future log replay. Merging compaction reads a few SSTables and the memtable and writes a new SSTable, bounding how many files reads must merge. Major compaction rewrites all SSTables for a tablet into exactly one SSTable, removing deletion markers and deleted data.',
        'One commit log per tablet would create too many concurrent GFS files and weaker group commits. Bigtable instead appends mutations for many tablets to one commit log per tablet server. That helps the normal path but complicates recovery. If 100 machines each receive one tablet from a failed server, naively reading the whole shared log 100 times is wasteful. Bigtable sorts log entries by table, row, and sequence number so mutations for a tablet become contiguous; the paper describes sorting 64 MB log segments in parallel.',
      ],
    },
    {
      heading: 'Locality groups, caching, and Bloom filters',
      paragraphs: [
        'Locality groups let clients put related column families into separate physical storage. In Webtable, page metadata such as language and checksums can live in one locality group while page contents live in another. A service that reads metadata should not pull HTML blobs through cache and decompression just to find a language tag.',
        'Each locality group can choose tuning parameters. It can be marked in-memory, compressed, assigned a block size, or given Bloom filters. Bigtable used an in-memory locality group for the location column family in the METADATA table because tablet location lookup is small and frequently accessed.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Bloom_filter.svg/800px-Bloom_filter.svg.png',
          alt: 'Bloom filter diagram showing hash functions mapping elements to a bit array',
          caption: 'Bloom filters let Bigtable skip SSTable disk reads when a row-column pair is definitely absent. False positives are possible; false negatives are not. Source: Wikimedia Commons, David Eppstein, Public domain.',
        },
        'The paper describes two cache layers. The Scan Cache stores key-value pairs returned by the SSTable interface and helps repeated reads. The Block Cache stores SSTable blocks read from GFS and helps sequential reads or repeated reads of nearby columns. Bloom filters then attack the worst case: a lookup that might otherwise ask every SSTable in a tablet whether it contains a missing row or column.',
        {
          type: 'callout',
          text: 'A Bloom filter changes a disk question into a memory question: if any required bit is missing, the SSTable cannot contain the row-column pair, so Bigtable skips that file.',
        },
        'Compression also benefits from locality. The paper reports a 10-to-1 space reduction for Webtable page contents using a two-pass scheme, compared with typical Gzip reductions of 3-to-1 or 4-to-1 on HTML. The reason is not magic compression; it is row layout. Pages from the same host sit near each other, so shared boilerplate is visible to the compressor.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Bigtable works because it keeps each invariant local. Row keys define one total order. Tablets carve that order into ranges. Chubby and the master ensure one assignment for each tablet. The commit log records the mutation before memory becomes the fast serving path. SSTables are immutable, so readers do not coordinate with writers over old files. Compaction rewrites files without changing the logical map.',
        {
          type: 'table',
          headers: ['Constraint', 'Design move', 'Invariant preserved'],
          rows: [
            ['Need ordered scans', 'Store rows lexicographically and partition into contiguous tablets', 'A scan over a short range usually touches a small number of tablet servers'],
            ['Need cheap writes on GFS', 'Append to commit log, update memtable, flush immutable SSTables', 'Foreground writes avoid random page updates'],
            ['Need recovery after server death', 'Replay commit-log records after redo points and reuse SSTables already in GFS', 'Acknowledged updates can be reconstructed'],
            ['Need tablet movement', 'Use METADATA rows and Chubby-backed liveness', 'A tablet has one live owner, and clients can rediscover the owner'],
            ['Need read efficiency despite many SSTables', 'Use block indexes, caches, locality groups, Bloom filters, and compaction', 'Reads skip irrelevant files and gradually pay down file count'],
          ],
        },
        'The sorted-map abstraction also makes scaling incremental. Adding servers does not require repartitioning the whole database. Hot or large tablets can split, unassigned tablets can be loaded onto servers with room, and clients can keep talking directly to tablet servers after location lookup. The master coordinates movement; it does not sit on the read and write data path.',
        'The deeper reason is that Bigtable treats distribution as a storage layout problem, not only a networking problem. A random key-value service can spread traffic. Bigtable also preserves application locality, exposes versioning, lets column families choose storage policy, and keeps the physical state in immutable files that a distributed file system can store well.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use the Webtable example from the paper. The row key for maps.google.com/index.html becomes com.google.maps/index.html. The contents family stores fetched page versions at timestamps. The anchor family contains qualifiers like anchor:cnnsi.com or anchor:my.look.ca, where each qualifier names a referring site. One row can have few cells even though the table has a huge possible column space.',
        'A crawler writes a new contents version for com.google.maps/index.html. The client library finds the tablet range from metadata, then sends the mutation directly to the owning tablet server. The server validates the write, appends a redo record to its commit log, updates the memtable, and returns after the durability rule is satisfied. Later, minor compaction flushes that memtable to an SSTable in GFS.',
        'A later read checks the memtable and relevant SSTables. The SSTable block index narrows the candidate block. The block cache may already hold that 64 KB block. If the read is for a row-column pair that cannot exist in an SSTable, a Bloom filter can skip the disk read. If too many SSTables accumulate, merging compaction reduces the number of sorted sources. If deleted versions linger, major compaction removes them.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/8/83/Big-data-concepts-20-638.jpg',
          alt: 'Hadoop architecture diagram showing distributed file system input splits, map tasks, and reduce tasks',
          caption: 'Bigtable was designed to work with MapReduce as both input and output. The point is the same as in Hadoop-style processing: move structured work to many machines and keep large scans sequential. Source: Wikimedia Commons, Magnai17, CC BY-SA 4.0.',
        },
        'The Google Analytics example makes the row-key choice concrete. The paper describes a raw click table of about 200 TB, with one row per end-user session. The row name contains the website name and the session creation time, so sessions for the same site are contiguous and chronological. The table compressed to 14 percent of original size. A summary table of about 20 TB was generated from it by scheduled MapReduce jobs and compressed to 29 percent of original size.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The 2006 benchmark used 1000-byte values. With one tablet server, random reads were slow because each random read fetched a 64 KB SSTable block over the network from GFS but used only one 1000-byte value. The paper reports about 1200 random reads per second, translating to roughly 75 MB/s read from GFS. Many applications with that pattern reduced the block size to about 8 KB.',
        'Memory reads were much faster because they skipped GFS. The same performance table reports 10,811 random memory reads per second for one tablet server, compared with 1212 disk-backed random reads. Scans were faster still because one RPC fetched many values. Sequential reads reused a 64 KB block for the next 64 read requests through the block cache.',
        {
          type: 'table',
          headers: ['Cost surface', 'Behavior in Bigtable', 'What makes it worse'],
          rows: [
            ['Point read', 'May check memtable plus several SSTables; indexes, cache, locality groups, and Bloom filters narrow the work', 'Large blocks for tiny random reads, many SSTables, cold cache, missing Bloom filters'],
            ['Range scan', 'Good when row keys preserve locality and blocks are reused sequentially', 'Salted keys, scattered ranges, too many tablet crossings'],
            ['Write latency', 'Append to tablet-server commit log and insert into memtable', 'GFS log write hiccups, group commit pressure, overloaded tablet server'],
            ['Compaction', 'Background merge reduces file count and removes obsolete/deleted data', 'Delete-heavy workloads, slow disk or network, too many small flushes'],
            ['Tablet movement', 'Master assigns tablets; clients rediscover locations after cache misses', 'Hot tablets, stale client caches, movement throttling, Chubby trouble'],
          ],
        },
        'Scaling is real but not linear. The paper reports aggregate throughput increasing by over 100x as tablet servers increased from 1 to 500, while random reads scaled worst because the system transferred one 64 KB block for each 1000-byte value and saturated shared 1 Gbit links. Tablet movement also has a cost: moving a tablet made it unavailable for a short time, typically less than one second.',
        'Chubby availability appears as a small but visible system tax. In 14 Bigtable clusters spanning 11 Chubby instances, the average percentage of Bigtable server hours with some data unavailable due to Chubby unavailability was 0.0047 percent. The most affected single cluster saw 0.0326 percent. That is a tiny number, but it proves the dependency is not theoretical.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Bigtable wins when the application can name its access pattern. It is strong for enormous sparse tables, row-range scans, timestamped versions, web crawls, user histories, session logs, map tiles, document metadata, and batch pipelines that want MapReduce over structured rows. It rewards schemas where the row key and column families match real access paths.',
        'It also wins when many teams need a common storage substrate without giving every application a full relational database. The paper examples show this spread: Google Analytics, Google Earth, Personalized Search, and many other Google products could share one storage design while choosing different row keys, locality groups, compression, memory settings, and retention policies.',
        {
          type: 'bullets',
          items: [
            'Choose Bigtable-style storage when the primary access path is row-key lookup plus ordered row-range scan.',
            'Choose it when cells are sparse and column qualifiers can grow without schema migrations.',
            'Choose it when timestamped versions and per-family retention rules are part of the workload.',
            'Choose it when write throughput benefits from log-structured storage and compaction is acceptable background debt.',
            'Choose it when operational control over locality groups, compression, memory, and filters matters more than ad hoc query flexibility.',
          ],
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Bigtable is the wrong tool when the application needs arbitrary SQL joins, multi-row relational constraints, a general optimizer, or many secondary access paths discovered after the fact. It has single-row atomicity, not cross-row transactions. Secondary indexes can be built, but they are application and system work, not free database magic.',
        'It also fails when row keys lie. Sequential keys can aim all new traffic at the same tablet. A single hot row cannot be fixed by splitting adjacent ranges. Heavy salting can spread writes but ruin natural scans. A schema that groups unrelated columns into one locality group can make cheap reads drag large cold values through cache and decompression.',
        'Operationally, the hard failures are compaction debt, stale metadata, slow Chubby or GFS dependencies, and recovery storms after tablet-server death. One log per tablet server improves normal write throughput, but recovery has to sort and replay co-mingled log records. A system optimized for the normal path must still spend engineering on the failure path.',
        {
          type: 'table',
          headers: ['Anti-pattern', 'Why it hurts', 'Better direction'],
          rows: [
            ['Increasing timestamp as leading row-key prefix', 'All new writes target the newest range', 'Bucket by time plus entity, or reverse the order when scans allow it'],
            ['Random salt everywhere', 'Spreads writes but makes range scans expensive', 'Use bounded buckets that preserve the scan unit the application needs'],
            ['One giant column family', 'Reads and compaction cannot separate hot metadata from cold blobs', 'Use locality groups for different access and retention patterns'],
            ['Bigtable as a relational database', 'No joins, no general cross-row constraints, no optimizer', 'Use relational storage or build explicit indexes and denormalized tables'],
            ['Ignoring Chubby and metadata as critical path', 'Ownership and location failures turn into user-visible unavailability', 'Monitor coordination health, tablet movement, stale caches, and recovery time'],
          ],
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Fay Chang, Jeffrey Dean, Sanjay Ghemawat, Wilson C. Hsieh, Deborah A. Wallach, Mike Burrows, Tushar Chandra, Andrew Fikes, and Robert E. Gruber, Bigtable: A Distributed Storage System for Structured Data, OSDI 2006, https://research.google.com/archive/bigtable-osdi06.pdf.',
        {
          type: 'bullets',
          items: [
            'Study LSM Trees next to isolate the write path: WAL, memtable, SSTable flush, and compaction.',
            'Study SSTable Block Index and Filter next to understand why immutable sorted files can still answer point reads efficiently.',
            'Study Bloom Filter next to understand the memory-for-disk-seek tradeoff used on SSTables.',
            'Study Sharding and Partitioning next to compare hash buckets, range shards, hot keys, and tablet splitting.',
            'Study Distributed Locks next to understand why Chubby is a coordination dependency, not an optional side service.',
            'Study Database Indexing next to compare Bigtable range tablets with B-trees and secondary-index maintenance.',
          ],
        },
        'The strongest exercise is to design three row keys for the same data: one for point reads, one for scans, and one for write distribution. Then predict which tablet gets hot, which scan gets expensive, and which compaction or cache behavior changes. That is the Bigtable lesson: the API is simple, but the row key is where the application reveals its workload.',
      ],
    },
    {
      heading: 'How to read the animation again',
      paragraphs: [
        'In the write-path animation, the client first needs a tablet location. Once it has that location, the master is no longer on the data path. The active tablet server appends to the log, updates the memtable, and later emits SSTables. Read the log edge as durability, the memtable node as recent serving state, the SSTable node as immutable durable state, and the compaction edge as delayed cleanup.',
        'In the row-key-locality animation, the hot tablet split is not merely load balancing. It is sorted-order sharding. A tablet can split because it owns a contiguous interval. The right follow-up question is always whether the application row key created a useful split boundary. If the heat is a range, splitting can help. If the heat is one row, the data model has to change.',
      ],
    },
  ],
};
