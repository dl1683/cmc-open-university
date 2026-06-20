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
      heading: 'Why Bigtable exists',
      paragraphs: [
        'By 2003, Google ran dozens of internal products -- web search indexing, Google Maps, Google Earth, Gmail, Google Finance, Orkut -- and every one of them needed structured storage over a distributed file system. Each team was building its own ad hoc solution on top of GFS. Some needed high write throughput for crawl ingestion. Others needed low-latency point lookups for serving. Many needed both, plus the ability to scan ranges of related data efficiently. No single database handled this spread of requirements at Google\'s scale.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Google_Modular_Data_Center.jpg',
          alt: 'Google modular data center composed of shipping containers filled with commodity servers',
          caption: 'Google modular data center, circa 2005. Bigtable was designed for environments like this: thousands of commodity machines where individual disk and node failures are routine, not exceptional. Source: Wikimedia Commons, Google, CC BY 2.5.',
        },
        'The constraints were specific. The storage system had to run on commodity hardware where disk failures were routine. It had to scale by adding machines, not by buying bigger ones. It had to work on top of GFS, which was optimized for large sequential reads and appends, not random page rewrites. And it had to serve workloads ranging from batch MapReduce jobs (high throughput, relaxed latency) to user-facing serving (low latency, moderate throughput).',
        {
          type: 'callout',
          text: 'Bigtable was not designed as a general database. It was designed as a single storage substrate that could replace dozens of custom storage hacks across Google, all running on GFS-backed commodity hardware. The API is a sorted map, not SQL, because the target workloads needed key-ordered locality more than they needed joins.',
        },
        'Chang et al. reported in the 2006 OSDI paper that by mid-2006, Google ran 388 Bigtable clusters serving a total of 24,500 tablet servers across hundreds of products. The largest cluster stored over 70 petabytes. These are not theoretical design targets -- they are measured production numbers from the paper itself.',
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        'A natural first attempt is to shard by hashing row keys. Hashing spreads writes well because nearby application keys land on different machines. It also makes ordered scans expensive because a scan over adjacent rows must talk to many shards and merge their results. For Bigtable workloads, row order is not decorative; it is how applications keep related facts near each other. A web crawler stores pages under reversed-domain keys like com.cnn/page1 so that all CNN pages sit in adjacent row ranges. Hash sharding destroys that adjacency.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/B-tree.svg',
          alt: 'B-tree data structure with internal nodes pointing to sorted leaf pages',
          caption: 'A B-tree stores sorted data with in-place page updates. B-trees work well for single-server databases, but they fight the storage model of distributed file systems like GFS, which prefer large immutable writes over scattered small page rewrites. Source: Wikimedia Commons, public domain.',
        },
        'Another attempt is to keep a classic B-tree-like structure per shard and update pages in place. That works for smaller systems, but it fights the storage environment Bigtable was built on. GFS is good at appending and writing large immutable files. It is not good at many servers performing tiny random page rewrites scattered across distributed blocks. B-tree pages are typically 4-16 KB; rewriting one page means rewriting an entire GFS chunk, which is 64 MB by default.',
        {
          type: 'table',
          headers: ['Approach', 'Write model', 'Scan support', 'GFS compatibility'],
          rows: [
            ['Hash sharding', 'Random placement, good spread', 'Must query all shards and merge', 'Acceptable -- writes are distributed'],
            ['B-tree per shard', 'In-place page rewrite', 'Good within a shard', 'Poor -- small random writes on a large-block FS'],
            ['Sorted range sharding + LSM', 'Append-only, deferred compaction', 'Natural within range', 'Excellent -- immutable files, sequential writes'],
          ],
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that a sorted map gives locality and scans, but locality also concentrates load. If all new rows begin with today\'s date, the current-day range becomes a hot tablet. If row keys are salted too aggressively, writes spread out but useful scans lose their natural order. The storage system can split and move tablets, but it cannot invent a good row-key design for the application.',
        'The second wall is coordination. Once a table is split into thousands of tablets assigned to hundreds of tablet servers, clients need a way to find the right server for a given row. Masters need a way to assign and reassign tablets. Failed servers must not leave their row ranges in limbo -- two active servers must never believe they own the same tablet. What started as a sorted map has become a metadata, locking, logging, compaction, and load-balancing system.',
        {
          type: 'callout',
          text: 'The data-model wall is row-key design: the system gives you sorted locality, but you choose what "local" means, and a bad choice creates hot ranges that no amount of splitting can fix. The systems wall is everything else: metadata lookup, master election, failure detection, log recovery, compaction scheduling.',
        },
        'The third wall is read amplification. An LSM write path is fast because it only appends. But reads must merge the in-memory state with potentially many on-disk files. Without aggressive compaction and smart filtering, reads pay for the write path\'s convenience. At Google\'s scale, a 10% increase in unnecessary disk reads across 24,500 tablet servers translates to enormous wasted I/O.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Bigtable\'s core insight is that the unit of distribution should be a contiguous sorted interval -- a tablet -- not a hash bucket. A tablet can be assigned to one tablet server, moved to another server, or split into two smaller ranges. This preserves range scans because adjacent rows live together, while giving the system a clean object to balance across machines. When a tablet grows beyond roughly 100-200 MB, it splits. When a tablet server is overloaded, the master reassigns some of its tablets elsewhere.',
        {
          type: 'diagram',
          alt: 'Bigtable write path from client to GFS',
          label: 'Write path: the LSM lifecycle inside a tablet server',
          body: `Client mutation (row, column, value)
       |
       v
  Tablet server receives RPC
       |
       +---> Append to commit log (GFS) -- durability
       |
       +---> Insert into memtable (sorted in-memory buffer)
       |
       v
  Acknowledge to client (write is safe)
       |
  ... later, when memtable reaches threshold ...
       |
       v
  Minor compaction: freeze memtable, write as new SSTable to GFS
       |
  ... later, when too many SSTables accumulate ...
       |
       v
  Merging compaction: combine several SSTables into one
       |
  ... periodically ...
       |
       v
  Major compaction: rewrite ALL SSTables into one, discard deletions`,
          text: `Client mutation (row, column, value)
       |
       v
  Tablet server receives RPC
       |
       +---> Append to commit log (GFS) -- durability
       |
       +---> Insert into memtable (sorted in-memory buffer)
       |
       v
  Acknowledge to client (write is safe)
       |
  ... later, when memtable reaches threshold ...
       |
       v
  Minor compaction: freeze memtable, write as new SSTable to GFS
       |
  ... later, when too many SSTables accumulate ...
       |
       v
  Merging compaction: combine several SSTables into one
       |
  ... periodically ...
       |
       v
  Major compaction: rewrite ALL SSTables into one, discard deletions`,
        },
        'The write path uses log-structured merge storage. A tablet server appends the mutation to a commit log stored on GFS for durability, then inserts it into an in-memory sorted buffer called a memtable. The write is acknowledged as soon as both steps succeed. Later, the memtable is frozen and flushed as an immutable SSTable file. Over time, compaction merges SSTables to bound read amplification and garbage-collect deleted data.',
        {
          type: 'callout',
          text: 'A write is not safe until the commit log records it on GFS. The memtable is a serving optimization, not the durability layer. After a crash, the tablet server replays the commit log to reconstruct any memtable state that was not yet flushed to SSTables.',
        },
      ],
    },
    {
      heading: 'Tablet location and Chubby',
      paragraphs: [
        'Finding a tablet is a three-level lookup, analogous to a multi-level page table in an operating system. The root is a file in Chubby (Google\'s distributed lock service) that stores the location of the root tablet. The root tablet is the first tablet in a special METADATA table that maps row ranges to tablet server addresses. The root tablet is never split. Second-level METADATA tablets can be split normally. Each METADATA row stores roughly 1 KB of location data, and with a 128 MB METADATA tablet limit, the three-level scheme can address 2^34 tablets -- roughly 17 billion -- which was more than enough for Google\'s 2006 deployment.',
        {
          type: 'diagram',
          alt: 'Three-level tablet location hierarchy',
          label: 'Tablet location: three indirections from Chubby to user data',
          body: `Chubby file (root location pointer)
       |
       v
  Root METADATA tablet (never splits)
       |
       v
  Other METADATA tablets (row range -> tablet server)
       |
       v
  User tablets (actual data)`,
          text: `Chubby file (root location pointer)
       |
       v
  Root METADATA tablet (never splits)
       |
       v
  Other METADATA tablets (row range -> tablet server)
       |
       v
  User tablets (actual data)`,
        },
        'Clients cache tablet locations aggressively. A client with a valid cache goes directly to the correct tablet server with zero metadata lookups. A cache miss triggers a walk up the hierarchy -- at most three network round trips. A completely stale cache (the tablet has moved) costs up to six round trips: three to discover the stale entry, then three more after evicting it.',
        'Chubby plays five distinct roles in Bigtable, none of which involve user data:',
        {
          type: 'bullets',
          items: [
            'Master election: exactly one active master at any time. Chubby\'s distributed lock ensures a failed master is replaced without split-brain.',
            'Tablet server discovery: each tablet server creates an ephemeral file in a specific Chubby directory. The master monitors this directory to know which servers are alive.',
            'Tablet server liveness: a tablet server holds a Chubby session and an exclusive lock on its file. If the server dies or loses its session, the lock is released and the master detects the failure.',
            'Schema storage: column family definitions and access-control metadata are stored in Chubby so they survive any individual tablet server failure.',
            'Root tablet location: the bootstrap entry point for the entire metadata hierarchy is a single Chubby file.',
          ],
        },
        {
          type: 'callout',
          text: 'If Chubby is unavailable, Bigtable is unavailable. This is by design -- without the lock service, the system cannot elect a master, detect dead tablet servers, or bootstrap tablet location. Chubby itself is replicated across five machines using Paxos, so its own failure probability is very low.',
        },
      ],
    },
    {
      heading: 'SSTable format and read path',
      paragraphs: [
        'An SSTable is an immutable sorted file of key-value pairs, divided into 64 KB data blocks with a block index at the end of the file. When an SSTable is opened, the block index is loaded into memory. A point lookup binary-searches the block index to find the correct 64 KB block, then scans within that block. This means a single disk seek per SSTable lookup for data not in the OS page cache.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/a/ac/Bloom_filter.svg',
          alt: 'Bloom filter data structure showing hash functions mapping elements to a bit array with no false negatives but possible false positives',
          caption: 'A Bloom filter: multiple hash functions set bits in an array. Checking membership has no false negatives but a tunable false-positive rate. Bigtable uses Bloom filters to avoid disk reads for rows that do not exist in a given SSTable. Source: Wikimedia Commons, David Eppstein, public domain.',
        },
        'Bloom filters are the critical optimization for read performance. Each SSTable can optionally include a Bloom filter for its row keys. Before seeking into the SSTable\'s data blocks, the tablet server checks the Bloom filter. If the filter says the row is absent, the SSTable is skipped entirely -- no disk I/O at all. Chang et al. reported that for certain access patterns, Bloom filters reduced the number of disk seeks for read operations from an average of 12 per read to 1-2 per read. The false-positive rate is configurable per locality group; typical settings aim for 1% or lower.',
        'The full read path for a row lookup:',
        {
          type: 'table',
          headers: ['Step', 'Action', 'Data source'],
          rows: [
            ['1', 'Check memtable for the row', 'In-memory sorted buffer'],
            ['2', 'Check immutable memtable (if a minor compaction is in progress)', 'In-memory frozen buffer'],
            ['3', 'For each SSTable (newest first), check Bloom filter', 'In-memory Bloom filter bits'],
            ['4', 'If Bloom filter says "maybe present," binary-search block index', 'In-memory block index'],
            ['5', 'Read the 64 KB data block from GFS', 'Disk (or OS page cache)'],
            ['6', 'Scan within the block for the row key', 'In-memory after block read'],
            ['7', 'Merge results across all sources, respecting timestamps', 'All of the above'],
          ],
        },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/0/03/Hdd_and_ssd.JPG',
          alt: 'A traditional spinning hard disk drive next to a solid-state drive, showing the physical size difference',
          caption: 'HDD vs SSD. Bigtable was designed in an era when most storage was spinning disk, where random seeks cost 5-10 ms each. The LSM write path and Bloom filter read optimization both exist to minimize random disk seeks. Source: Wikimedia Commons, Evan-Amos, public domain.',
        },
        'Locality groups allow the table designer to partition column families into separate SSTables. Columns that are always read together (like page content) go in one locality group; columns that are read separately (like crawl metadata) go in another. This prevents a point lookup for one column family from pulling irrelevant column data into memory. Locality groups can also be declared as in-memory, which tells the tablet server to keep that group\'s SSTables in RAM for latency-sensitive access patterns.',
      ],
    },
    {
      heading: 'Compaction mechanics',
      paragraphs: [
        'Compaction is where the LSM write path pays its deferred cost. Bigtable distinguishes three levels of compaction, each serving a different purpose:',
        {
          type: 'table',
          headers: ['Compaction type', 'What it does', 'When it runs', 'Why it matters'],
          rows: [
            ['Minor', 'Freezes the current memtable, writes it as a new SSTable', 'When memtable reaches a size threshold', 'Bounds memory usage; creates a durable SSTable from volatile memory'],
            ['Merging', 'Reads a few SSTables plus the memtable, writes one merged SSTable', 'Periodically in the background', 'Bounds the number of SSTables a read must consult'],
            ['Major', 'Reads ALL SSTables for a tablet, writes one SSTable', 'Periodically (less frequent)', 'Removes deletion markers and old versions permanently; reclaims disk space'],
          ],
        },
        'Minor compactions happen frequently and are fast -- they only write data that is already sorted in memory. Merging compactions are the workhorse: they keep the SSTable count manageable so reads stay fast. Major compactions are expensive but necessary because only a major compaction can truly delete data. A deletion in Bigtable writes a tombstone marker; the actual key-value pair is removed only when a major compaction rewrites all SSTables and drops the tombstoned entries.',
        {
          type: 'callout',
          text: 'Deleted data is not actually deleted until a major compaction runs. A delete operation writes a tombstone that hides the value from reads, but the bytes remain on disk across potentially many SSTables. This is a fundamental property of LSM storage: write performance comes at the cost of deferred garbage collection.',
        },
        'The single commit log optimization is a crucial engineering detail. Instead of one commit log per tablet (which would mean hundreds of concurrent GFS writes per tablet server), Bigtable uses one commit log per tablet server. All mutations for all tablets on that server are interleaved into a single log file. This dramatically reduces the number of GFS writes and disk seeks. The cost: when a tablet server dies and its tablets are reassigned, the recovery process must sort the log by tablet and replay each tablet\'s entries separately. Bigtable optimizes this by having the reassigned servers coordinate a parallel sort of the log segments.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The design works because each layer has a narrow, well-separated job. Sorted row keys give the data model scan locality. Tablets turn that order into movable distribution units. The three-level metadata hierarchy lets clients find tablet owners with cached zero-cost lookups. The commit log protects acknowledged writes. Memtables make recent writes cheap. SSTables make durable data sequential and immutable. Bloom filters prevent pointless disk seeks. Compaction pays the cleanup cost in the background. Chubby provides the coordination substrate without touching user data.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Google_Borg_cluster_birth.jpg/640px-Google_Borg_cluster_birth.jpg',
          alt: 'Early Google server cluster built from commodity hardware with exposed wiring',
          caption: 'An early Google cluster. Bigtable was designed for exactly this environment: commodity machines where any component can fail at any time. The architecture assumes failure is normal and builds durability from replication and logging, not from expensive hardware. Source: Wikimedia Commons, Google, CC BY 2.5.',
        },
        'The important invariant is that a write is not safe merely because it reached memory. It becomes crash-safe when the commit log records it on GFS (which itself replicates the log data across multiple chunk servers). The memtable is a fast serving structure, not the only copy. After a tablet server crash, the master detects the failure through Chubby, reassigns the dead server\'s tablets, and the new owners replay the relevant portions of the commit log to reconstruct memtable state.',
        {
          type: 'table',
          headers: ['Layer', 'Responsibility', 'Failure mode it prevents'],
          rows: [
            ['Sorted row keys', 'Define data locality', 'Unrelated data scattered across queries'],
            ['Tablets', 'Unit of distribution and movement', 'Unbounded single-server growth'],
            ['Commit log', 'Write durability', 'Data loss on crash before flush'],
            ['Memtable', 'Fast write buffer', 'Disk seek per write'],
            ['SSTables', 'Immutable persistent storage', 'Mutable file corruption'],
            ['Bloom filters', 'Skip absent SSTables', 'Read amplification from many files'],
            ['Compaction', 'Merge and garbage collect', 'Unbounded SSTable count and dead data'],
            ['Chubby', 'Coordination and liveness', 'Split-brain tablet ownership'],
            ['METADATA tablets', 'Tablet location discovery', 'Client cannot find data'],
          ],
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Imagine Google\'s web search infrastructure using Bigtable to store the crawled web. The table is called Webtable. Row keys are reversed URLs: com.cnn.www/index.html. Reversing the domain groups all pages from the same site into adjacent rows, so a scan for "all CNN pages" reads a contiguous tablet range instead of hopping across the entire table.',
        'The table has two column families: contents (stores the raw HTML, possibly multiple timestamped versions from different crawl dates) and anchor (stores inbound link text, with the column qualifier being the URL of the linking page). A single row might have one contents column with three timestamped versions and thousands of anchor columns -- one per inbound link. This is the sparse map in action: most rows have a few content versions but wildly different numbers of anchor columns.',
        {
          type: 'table',
          headers: ['Step', 'Component', 'Action', 'Detail'],
          rows: [
            ['1', 'Client library', 'Look up tablet location', 'Cache hit: direct to tablet server. Cache miss: walk Chubby -> root METADATA -> METADATA -> tablet server (up to 3 RPCs)'],
            ['2', 'Tablet server', 'Receive mutation RPC', 'Check authorization against Chubby-stored ACL for the column family'],
            ['3', 'Tablet server', 'Append to commit log', 'Single write to the shared GFS log file for this tablet server (not per-tablet)'],
            ['4', 'Tablet server', 'Insert into memtable', 'Sorted insertion into the in-memory buffer'],
            ['5', 'Tablet server', 'Acknowledge write', 'Client receives success after steps 3 and 4 complete'],
            ['6', 'Background', 'Minor compaction', 'When memtable exceeds threshold (~200 MB), freeze it and write as a new SSTable to GFS'],
            ['7', 'Background', 'Merging compaction', 'Periodically merge several SSTables into one to bound read costs'],
            ['8', 'Background', 'Major compaction', 'Rewrite all SSTables for a tablet; discard tombstones and old versions beyond retention'],
          ],
        },
        'Now trace a read for com.cnn.www/index.html, column family contents. The tablet server checks the memtable first (fastest, sorted in memory). Then it checks any frozen memtable awaiting compaction. Then it walks through SSTables newest-to-oldest. For each SSTable, it consults the Bloom filter: if the filter says the row is definitely absent, it skips the file entirely. If the filter says "maybe present," it binary-searches the block index and reads the 64 KB block containing the row. Results from all sources are merged by timestamp, and the client receives the requested versions.',
        'If the tablet for the com.cnn range grows past the split threshold, the master instructs the tablet server to split it. The split is a metadata operation: the two new tablets point to the same SSTables as the original (SSTables are immutable and can be shared), and future compactions will produce separate files for each half. One tablet may be reassigned to a different server for load balancing.',
      ],
    },
    {
      heading: 'Animation guide',
      paragraphs: [
        'The tablet write-path view follows the map from API to machinery. The client starts with metadata lookup, then sends the operation to the tablet server. The highlighted log and memtable explain the latency pattern: append for durability, memory update for serving, immutable files for later persistence, and compaction for cleanup.',
        'The row-key locality view focuses on the sharding decision. A tablet is not a random bucket; it is a contiguous sorted interval. The split frame shows Bigtable using sorted order as an operational tool. The table of design lessons connects the same mechanism to indexing, sharding, LSM trees, and distributed locks because Bigtable is a composition of those ideas rather than one isolated trick.',
        {
          type: 'note',
          text: 'The safe inference at each frame: if a node is active and the edge leading to it is highlighted, that stage has received or produced data. If a downstream node is not yet active, the data has not reached it and the write is not yet durable or visible there.',
        },
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        {
          type: 'table',
          headers: ['Cost axis', 'What you pay', 'Why it matters'],
          rows: [
            ['Write amplification', 'Data is written once to the log, once to the memtable flush, then again in each compaction', 'A single logical write may cause 10-30x actual bytes written over its lifetime'],
            ['Read amplification', 'A read may consult the memtable plus multiple SSTables', 'Without Bloom filters and compaction, reads degrade as SSTables accumulate'],
            ['Space amplification', 'Deleted data persists until major compaction; multiple SSTable copies during compaction', 'Disk usage can be 2-3x the logical data size'],
            ['Metadata dependency', 'Three-level lookup; Chubby as single coordination substrate', 'Chubby outage = Bigtable outage; metadata cache misses add latency'],
            ['Row-key design burden', 'Application must choose keys that match access patterns', 'Bad key design causes hot tablets that no system tuning can fix'],
          ],
        },
        'The main benefit of sorted tablets is also the main risk. Range scans and locality are excellent when row keys match query patterns. Hotspotting is painful when row keys put too much write or read traffic into one narrow interval. Salting, bucketing, reversing keys, or adding time windows can spread load, but every spread technique trades away some scan locality.',
        'Log-structured storage trades write speed for read and maintenance complexity. Writes are cheap because they append and touch memory. Reads may need to merge several sources. Compaction reduces that read amplification, but compaction itself consumes CPU, disk bandwidth, and background I/O. If compaction falls behind writes, latency rises even though individual writes still look simple.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Ssd-cache-benchmark.png',
          alt: 'Benchmark graph comparing SSD cache performance showing throughput and latency characteristics',
          caption: 'Storage performance benchmarks. Bigtable\'s performance depends heavily on the underlying storage characteristics -- sequential write throughput for commit logs and SSTable flushes, random read latency for point lookups, and sustained I/O bandwidth for compaction. Source: Wikimedia Commons, Dsimic, CC BY-SA 4.0.',
        },
        'Metadata and locking are another tradeoff. Clients need accurate tablet locations, but asking metadata for every request would be slow. Caching helps, so clients must also handle stale cache entries when tablets move. Chubby makes ownership safe but becomes critical infrastructure that the entire storage system depends on.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Bigtable-style design wins when the application can name its access pattern. It is strong for enormous sparse tables, timestamped facts, user or document records with related columns, time-series-like versions, and workloads that need point reads plus row-range scans. It fits systems that can tolerate an application-shaped schema rather than requiring ad hoc relational joins.',
        {
          type: 'bullets',
          items: [
            'Web indexing: Webtable stored the entire crawled web with reversed-URL keys, page content, anchor text, and crawl timestamps. This was the original motivating use case.',
            'Google Earth: geographic tile data keyed by location, enabling spatial scans across adjacent regions.',
            'Google Analytics: per-website event data with time-ordered keys for dashboard rendering.',
            'Google Finance: time-series financial data with timestamped versions for historical analysis.',
            'Personalization: per-user preference and history data with user-ID keys, supporting both point lookups (one user) and batch analysis (all users).',
          ],
        },
        'It influenced HBase (the open-source Bigtable clone on HDFS), Cassandra (which borrowed the column-family data model but uses consistent hashing instead of sorted range sharding), Cloud Bigtable (Google\'s managed service), and many internal storage engines at other companies. The template is: preserve key order, divide the order into ranges, write through a log and memtable, store immutable sorted files, and compact in the background.',
        {
          type: 'callout',
          text: 'The paper\'s lasting influence is not any single mechanism -- LSM trees, SSTables, Bloom filters, and lock services all existed before 2006. The contribution is showing how to compose them into a practical system at planetary scale, with real production numbers to prove it works.',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Bigtable is a poor fit when the application needs arbitrary SQL joins, multi-row transactions with ACID guarantees, or many secondary access paths that were not designed up front. You can build secondary indexes and cross-row transactions on top of Bigtable (Google later did this with Megastore and Spanner), but the base abstraction is a single-row-atomic sorted map, not a general relational optimizer. It rewards modeling discipline and punishes vague query requirements.',
        {
          type: 'table',
          headers: ['Anti-pattern', 'Why it breaks', 'Better alternative'],
          rows: [
            ['Multi-row transactions', 'Bigtable guarantees atomicity only within a single row', 'Spanner, CockroachDB, or a relational database'],
            ['Ad hoc SQL joins', 'No join engine; data model is a sorted map', 'BigQuery, PostgreSQL, or a SQL data warehouse'],
            ['Monotonically increasing keys (timestamps, auto-increment)', 'All writes hit the last tablet -- permanent hot range', 'Prefix with a hash bucket or reverse the timestamp'],
            ['Frequent small random reads across many rows', 'Each read may require metadata lookup + Bloom filter + disk seek', 'An in-memory cache or a database optimized for random reads'],
            ['Very wide rows (millions of columns)', 'A single row read must scan all column families', 'Redesign as multiple rows or use locality groups aggressively'],
          ],
        },
        'It also fails gracefully only when operational limits are respected. Long compaction backlogs, bad row-key distribution, overloaded tablet servers, stale metadata caches, slow recovery, and badly chosen column families can all make a sorted-map API feel unpredictable. The system gives powerful knobs, but those knobs are close to the workload and must be understood by the application team, not just the infrastructure team.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The most common design failure is the hot tablet. Sequential timestamps, monotonically increasing numeric IDs, or one viral entity can aim too much traffic at one row range. Splitting helps when the heat covers a range, but not when the heat is a single key. The fix usually starts in row-key design: hash-prefix the key to spread writes, or reverse the timestamp so recent data fans out instead of concentrating.',
        'The second failure is read amplification from compaction lag. If data has been flushed into many SSTables and compaction cannot keep up, reads must consult more files and more Bloom filters. At some point, even Bloom filters add overhead because false positives accumulate across many SSTables. The third failure is recovery cascading: a tablet server crash triggers log replay and tablet reassignment exactly when the cluster is already stressed, potentially causing a domino effect if the reassigned tablets overwhelm their new hosts.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/e/e1/Nand_flash_structure.svg',
          alt: 'NAND flash memory cell structure showing floating gate transistors in series',
          caption: 'NAND flash structure. Modern Bigtable deployments run on SSDs, where the LSM write pattern is particularly well-suited: SSDs prefer sequential writes and suffer from write amplification on random small writes. The original 2006 deployment used spinning disks, making the sequential write optimization even more critical. Source: Wikimedia Commons, Cyferz, CC BY-SA 3.0.',
        },
        {
          type: 'callout',
          text: 'Bigtable\'s failure modes are almost always workload-dependent, not infrastructure-dependent. A well-keyed table on modest hardware will outperform a badly-keyed table on the best hardware. The system amplifies good design and punishes bad design -- it does not hide design mistakes behind abstraction layers.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Chang et al., "Bigtable: A Distributed Storage System for Structured Data," OSDI 2006. Available at https://research.google.com/archive/bigtable-osdi06.pdf. Also read the GFS paper (Ghemawat et al., SOSP 2003) and the Chubby paper (Burrows, OSDI 2006) for the underlying substrate.',
        {
          type: 'bullets',
          items: [
            'LSM Trees (How Cassandra Writes): the write path -- memtable, flush, compaction -- is an LSM tree. Understanding LSM mechanics makes Bigtable\'s write and compaction behavior predictable.',
            'SSTable Block Index & Filter: the SSTable format -- 64 KB blocks, block index, optional Bloom filter -- is the read path\'s fundamental optimization.',
            'Bloom Filter: the probabilistic data structure that lets Bigtable skip entire SSTables without a disk seek. Understand false-positive rates and sizing.',
            'Write-Ahead Log (WAL): the commit log pattern that makes writes durable before they reach the memtable.',
            'Database Indexing: why sorted order is a feature. B-trees give sorted access through in-place updates; LSM trees give it through deferred merge.',
            'Sharding & Partitioning: tablets are range shards. Understand the tradeoff between range sharding (locality, hot ranges) and hash sharding (uniform spread, no scans).',
            'Distributed Locks: What They Can Promise: Chubby provides distributed locking for master election, server liveness, and metadata bootstrapping.',
          ],
        },
        'The useful mental bridge is to ask which part of Bigtable each follow-up topic explains. LSM trees explain the write path. SSTable indexes and Bloom filters explain read efficiency. Sharding explains tablets. Distributed locks explain Chubby. Database indexing explains why sorted order is a feature, not just an implementation detail. The paper itself remains one of the most readable systems papers ever written -- it is 14 pages and every paragraph carries weight.',
      ],
    },
  ],
};
