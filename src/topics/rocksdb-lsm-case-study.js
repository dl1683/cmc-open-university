// RocksDB case study: production LSM storage where the bottleneck moved from
// write amplification to space amplification to CPU as SSDs and workloads evolved.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'rocksdb-lsm-case-study',
  title: 'RocksDB LSM Case Study',
  category: 'Papers',
  summary: 'RocksDB as the embedded-storage lesson: WAL, memtables, SSTables, compaction, block cache, and shifting bottlenecks.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['write path and reads', 'compaction tradeoffs'], defaultValue: 'write path and reads' },
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
      { id: 'app', label: 'application', x: 0.7, y: 3.8, note: 'get/put' },
      { id: 'wal', label: 'WAL', x: 2.6, y: 2.2, note: 'durability' },
      { id: 'mem', label: 'memtable', x: 2.6, y: 5.4, note: 'mutable sorted' },
      { id: 'l0', label: 'L0 files', x: 4.8, y: 2.0, note: 'overlap' },
      { id: 'l1', label: 'L1 files', x: 6.4, y: 3.8, note: 'mostly sorted' },
      { id: 'l2', label: 'L2+ files', x: 8.0, y: 5.4, note: 'larger levels' },
      { id: 'cache', label: 'block cache', x: 5.0, y: 6.8, note: 'hot reads' },
      { id: 'compact', label: 'compaction', x: 8.2, y: 2.0, note: 'rewrite' },
    ],
    edges: [
      { id: 'e-app-wal', from: 'app', to: 'wal', weight: 'append' },
      { id: 'e-app-mem', from: 'app', to: 'mem', weight: 'update' },
      { id: 'e-mem-l0', from: 'mem', to: 'l0', weight: 'flush' },
      { id: 'e-l0-l1', from: 'l0', to: 'l1', weight: 'compact' },
      { id: 'e-l1-l2', from: 'l1', to: 'l2', weight: 'compact' },
      { id: 'e-compact-l0', from: 'compact', to: 'l0', weight: 'choose' },
      { id: 'e-compact-l1', from: 'compact', to: 'l1', weight: 'rewrite' },
      { id: 'e-cache-l1', from: 'cache', to: 'l1', weight: 'blocks' },
    ],
  }, { title });
}

function* writePathAndReads() {
  yield {
    state: architecture('RocksDB is an LSM engine embedded in larger systems'),
    highlight: { active: ['app', 'wal', 'mem', 'e-app-wal', 'e-app-mem'], compare: ['l0', 'l1'] },
    explanation: 'The first graph shows RocksDB as an embedded engine: the application calls get and put, while the engine handles durable local state. A write is cheap up front because it appends to the WAL and updates a memtable.',
  };

  yield {
    state: architecture('Memtables flush to SSTables; compaction restores order'),
    highlight: { active: ['mem', 'l0', 'l1', 'l2', 'compact', 'e-mem-l0', 'e-l0-l1', 'e-l1-l2'], found: ['wal'] },
    explanation: 'Flush and compaction are the cleanup machinery behind that cheap write. Memtables become L0 files, then compaction rewrites files into lower levels to control overlap, reclaim old versions, and keep reads from checking too many places.',
    invariant: 'Writes are cheap now because compaction pays cleanup cost later.',
  };

  yield {
    state: labelMatrix(
      'Read path checks multiple places',
      [
        { id: 'mem', label: 'memtable' },
        { id: 'l0', label: 'L0 files' },
        { id: 'l1', label: 'L1/L2 files' },
        { id: 'cache', label: 'block cache' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'cost', label: 'cost pressure' },
      ],
      [
        ['newest writes', 'memory lookup'],
        ['recent flushed files', 'overlapping files'],
        ['sorted runs', 'disk/SSD reads'],
        ['hot blocks', 'memory budget'],
      ],
    ),
    highlight: { found: ['mem:role', 'cache:role'], compare: ['l0:cost', 'l1:cost'] },
    explanation: 'The read table is why LSMs need helpers. A lookup may consult memory, overlapping L0 files, lower levels, filters, indexes, and cache. Bloom filters and block indexes are not decorative; they keep read amplification survivable.',
  };

  yield {
    state: labelMatrix(
      'Where RocksDB appears',
      [
        { id: 'db', label: 'distributed DB' },
        { id: 'stream', label: 'stream processor state' },
        { id: 'queue', label: 'log service metadata' },
        { id: 'cache', label: 'SSD cache' },
      ],
      [
        { id: 'why', label: 'why embedded KV helps' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['local durable state', 'compaction interference'],
        ['fast keyed state', 'checkpoint pressure'],
        ['metadata/indexes', 'write amplification'],
        ['persistent hot data', 'CPU compression cost'],
      ],
    ),
    highlight: { active: ['db:why', 'stream:why'], compare: ['cache:risk'] },
    explanation: 'The placement table shows why embedded does not mean isolated. When RocksDB powers a database, stream processor, queue, or cache, local compaction pressure can become global latency, checkpoint, or backpressure trouble.',
  };
}

function* compactionTradeoffs() {
  yield {
    state: labelMatrix(
      'The RocksDB experience paper tracks shifting bottlenecks',
      [
        { id: 'write_amp', label: 'write amplification' },
        { id: 'space_amp', label: 'space amplification' },
        { id: 'cpu', label: 'CPU utilization' },
        { id: 'ops', label: 'operability' },
      ],
      [
        { id: 'old_priority', label: 'priority' },
        { id: 'why', label: 'why it mattered' },
      ],
      [
        ['early focus', 'SSD write endurance and throughput'],
        ['later focus', 'data scale and storage cost'],
        ['later focus', 'compression/filter/checksum overhead'],
        ['always', 'many instances share resources'],
      ],
    ),
    highlight: { active: ['write_amp:why', 'space_amp:why', 'cpu:why'], found: ['ops:why'] },
    explanation: 'The experience-paper table is a reminder that the bottleneck moves. Write amplification, space amplification, CPU, and operability each became dominant under different hardware and workload conditions.',
  };

  yield {
    state: architecture('Compaction is resource scheduling'),
    highlight: { active: ['compact', 'l0', 'l1', 'l2', 'e-compact-l0', 'e-compact-l1'], compare: ['app'] },
    explanation: 'The compaction node is a scheduler, not a housekeeping thread. It competes with foreground reads and writes for CPU, SSD bandwidth, memory, and cache, so background work can directly shape tail latency.',
  };

  yield {
    state: labelMatrix(
      'Tuning knobs',
      [
        { id: 'level', label: 'level size' },
        { id: 'compression', label: 'compression' },
        { id: 'filters', label: 'filters' },
        { id: 'cache', label: 'cache split' },
      ],
      [
        { id: 'helps', label: 'helps' },
        { id: 'costs', label: 'costs' },
      ],
      [
        ['read and space amp', 'compaction IO'],
        ['space amp', 'CPU'],
        ['read misses', 'memory and CPU'],
        ['hot reads', 'less memtable/cache elsewhere'],
      ],
    ),
    highlight: { found: ['level:helps', 'compression:helps', 'filters:helps'], compare: ['compression:costs'] },
    explanation: 'The knob table should be read as pressure transfer. Compression saves space and may spend CPU. Filters save misses and spend memory. Bigger levels can help reads or space but create more compaction I/O.',
  };

  yield {
    state: labelMatrix(
      'Production lesson',
      [
        { id: 'measure', label: 'measure' },
        { id: 'isolate', label: 'isolate' },
        { id: 'adapt', label: 'adapt' },
        { id: 'link', label: 'link upward' },
      ],
      [
        { id: 'lesson', label: 'lesson' },
        { id: 'neighbor', label: 'study link' },
      ],
      [
        ['amp metrics', 't-digest'],
        ['instances and resources', 'Bulkheads'],
        ['hardware changes', 'Backpressure'],
        ['storage engine affects system', 'Delta Lake'],
      ],
    ),
    highlight: { found: ['measure:lesson', 'isolate:lesson', 'adapt:lesson'], active: ['link:neighbor'] },
    explanation: 'The production lesson is upward coupling. Measure amplification, isolate noisy instances, adapt to hardware, and remember that a local storage engine can dominate the behavior of the distributed system built on top.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'write path and reads') yield* writePathAndReads();
  else if (view === 'compaction tradeoffs') yield* compactionTradeoffs();
  else throw new InputError('Pick a RocksDB view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation traces two views of RocksDB internals. The write-path view follows a put from the application through the WAL and memtable into flushed SSTables, then into compaction. The compaction-tradeoff view isolates the resource tensions that production operators must manage.',
        {
          type: 'bullets',
          items: [
            'Active nodes mark the current decision point: which component is accepting a write, which level is being compacted, or which knob is being adjusted.',
            'Found markers indicate a confirmed outcome: a durable write, a successfully cached block, or a reclaimed obsolete version.',
            'Compare markers highlight the resource or component that bears the cost of the active decision -- the delayed debt behind cheap foreground writes.',
          ],
        },
        'At each frame, ask: what data moved, what invariant was preserved, and which resource paid for the operation. If you cannot name the resource, rewatch the frame.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Distributed systems that look like single services from the outside -- TiKV, CockroachDB, Apache Flink, Kafka Streams, MyRocks -- rely on a local embedded key-value store inside each node. When that embedded engine stalls, amplifies writes, fills cache, or burns CPU, the surrounding service inherits the pain as tail latency, backpressure, checkpoint cost, or storage pressure. RocksDB is the most widely deployed instance of that embedded engine, used across 30+ Meta applications storing hundreds of petabytes (FAST 2021, Table 1).',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/LSM_Tree.png/800px-LSM_Tree.png',
          alt: 'LSM tree architecture showing memtable, immutable memtable, and SSTable levels',
          caption: 'The LSM tree architecture: writes go to an in-memory memtable, then flush to sorted on-disk SSTables that are periodically merged via compaction. Source: Wikimedia Commons.',
        },
        {
          type: 'quote',
          text: 'RocksDB is widely used as a storage engine in production environments. It is used as a storage engine for a distributed database (MyRocks and its variants), a streaming engine (Flink), and other products.',
          attribution: 'Dong et al., "RocksDB: Evolution of Development Priorities in a Key-value Store Serving Large-scale Applications," USENIX FAST 2021, Section 1',
        },
        'The case study is not "LSM trees are good for writes." It is a production lesson about moving bottlenecks. Early deployments fought write amplification because SSD endurance was scarce. Later, space amplification dominated as data volumes grew. Then CPU became limiting as compression, checksums, and filters consumed cores that fast NVMe drives no longer kept busy. The same engine, the same code, three different bottlenecks across three hardware generations.',
        {
          type: 'callout',
          text: 'RocksDB is not a database. It is the embedded storage engine inside hundreds of databases, stream processors, and caches. When it stalls, every system built on top inherits the pain.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first reasonable design for durable key-value storage is a B-tree with write-ahead logging. InnoDB, WiredTiger, and LMDB all follow this pattern. A put finds the correct page, modifies it in place, and writes it back. Reads follow a short, balanced path. The tree stays sorted at all times.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/B-tree.svg/800px-B-tree.svg.png',
          alt: 'B-tree data structure with internal nodes containing sorted keys and child pointers',
          caption: 'A B-tree keeps data sorted across wide disk pages. Updates find the correct page, modify it in place, and write the dirty page back. This is fast for reads (O(log n) page traversals) but expensive for writes on flash storage, where even a small update dirties an entire multi-kilobyte page. Source: Wikimedia Commons.',
        },
        {
          type: 'table',
          headers: ['Property', 'B-tree (update-in-place)', 'Append-only log'],
          rows: [
            ['Write cost', 'Random page write per update', 'Sequential append (cheap)'],
            ['Read cost', 'O(log n) page reads, always sorted', 'Full scan or index rebuild'],
            ['Space cost', 'Page fragmentation, ~50-70% fill', 'Unbounded without cleanup'],
            ['Recovery', 'WAL replay + page checksum', 'Replay from start or checkpoint'],
            ['Concurrency', 'Page-level latches, lock manager', 'Append is lock-free; reads block on merge'],
          ],
        },
        'B-trees excel for read-heavy workloads. But under heavy random writes, each small update can dirty an entire 4-16 KB page. On flash storage, this means write amplification at the device level on top of the application-level amplification. A 100-byte update that rewrites a 16 KB page has already amplified writes 160x before the SSD controller does its own rewriting.',
        {
          type: 'callout',
          text: 'Write amplification stacks: application-level amplification (100 bytes -> 16 KB page) multiplied by device-level amplification (page -> erase block) multiplied by FTL garbage collection. Sequential writes avoid this entire stack because they fill blocks cleanly.',
        },
        'The second reasonable design is an append-only log with an in-memory hash index -- the Bitcask model. Writes are sequential and fast, but every live key needs a pointer in memory, and recovery requires scanning the entire log. Without a disciplined cleaning strategy, the log grows without bound.',
        'RocksDB sits between these two extremes: writes are sequential like a log, but the data is organized into sorted levels so reads do not require a full scan.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Cheap foreground writes create background debt. The core tension of any LSM engine is that the write path defers work: it appends to a WAL and updates a memtable, then declares the write "done." But the data cannot stay in memory forever. Memtables flush into sorted files on disk. Those files overlap in key range. Old versions and tombstones accumulate. Reads must check multiple files. Disk space grows until compaction rewrites files and discards obsolete entries.',
        {
          type: 'diagram',
          text: [
            '  Foreground (fast)              Background (debt)',
            '  ==================             ===================',
            '  put("k", "v")                  memtable flush -> L0 SST',
            '    |                               |',
            '    +-> WAL append (sequential)     L0 files pile up (overlap)',
            '    +-> memtable insert (memory)      |',
            '                                    compaction merges L0 -> L1',
            '  Time: microseconds                  |',
            '                                    L1 -> L2 -> L3 ...',
            '                                  Time: milliseconds to seconds',
            '                                  Cost: CPU, SSD bandwidth, cache churn',
          ].join('\n'),
          label: 'The LSM bargain: foreground writes are cheap because background compaction pays later',
        },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Write-ahead_logging_-_before_and_after.svg/800px-Write-ahead_logging_-_before_and_after.svg.png',
          alt: 'Write-ahead logging diagram showing log entries written before data pages are modified',
          caption: 'Write-ahead logging (WAL): every mutation is first appended to a sequential log for crash recovery, then applied to the in-memory data structure. This pattern is the durability foundation beneath every RocksDB write. The WAL can be replayed after a crash to reconstruct any memtable entries that had not yet been flushed to SSTables. Source: Wikimedia Commons.',
        },
        'A storage engine is therefore also a scheduler. Compaction competes with foreground reads and writes for CPU, SSD bandwidth, memory bandwidth, block cache, and write endurance. If compaction falls behind, L0 files pile up and RocksDB may stall writes entirely. If compaction is too aggressive, it steals bandwidth from foreground reads and spikes tail latency. The hard part is not choosing a data structure. It is controlling when delayed work is paid and which resource becomes the bottleneck.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'RocksDB implements the log-structured merge-tree (LSM-tree) idea from O\'Neil et al. (1996): make writes sequential and sorted in memory, then repair the read and space costs with background merging into progressively larger sorted runs on disk.',
        {
          type: 'note',
          text: 'The LSM-tree paper proposed a cascade of sorted components with exponentially increasing sizes. RocksDB\'s leveled compaction follows this structure: each level is roughly 10x the size of the previous one (configurable via max_bytes_for_level_multiplier, default 10). With a 64 MB L1 and multiplier 10, L2 holds 640 MB, L3 holds 6.4 GB, L4 holds 64 GB, and so on.',
        },
        'The write path records the update in a WAL for crash recovery, then inserts it into a mutable in-memory sorted structure (the memtable, typically a skiplist). When the memtable fills, it becomes immutable and is flushed as a sorted string table (SSTable) into Level 0.',
        'L0 files may overlap in key range. Compaction selects files from one level, reads their sorted contents, merge-sorts them with overlapping files from the next level, drops overwritten versions and expired tombstones, and writes new files into the lower level. Lower levels are larger and more ordered. The result: common foreground writes are cheap (WAL append + memory insert), and background work keeps reads and space under control.',
        {
          type: 'code',
          language: 'text',
          text: [
            'Write path (per put):',
            '  1. Append to WAL            -- sequential, O(value_size)',
            '  2. Insert into memtable      -- O(log M) where M = keys in memtable',
            '  3. Return success to caller  -- write is durable if WAL synced',
            '',
            'Read path (per get):',
            '  1. Check active memtable     -- O(log M)',
            '  2. Check immutable memtables -- O(log M) each',
            '  3. Check L0 files            -- each may overlap; Bloom filter skips',
            '  4. Check L1..Ln files        -- binary search on key range, then',
            '                                  block index + Bloom filter per file',
            '  5. Block cache hit?          -- skip disk read if block is cached',
          ].join('\n'),
          label: 'The asymmetry: writes touch 2 structures, reads may touch dozens',
        },
        'The production insight from Meta\'s experience paper is that every tuning knob moves pressure from one amplification metric to another. A larger memtable reduces flush frequency but uses more memory. Stronger compression reduces space but burns CPU. More Bloom filter bits avoid unnecessary reads but consume memory and build time. RocksDB exposes over 100 tunable parameters because the right configuration depends on the workload, the hardware, and the service wrapped around it.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The write path begins with durability. The engine appends the serialized key-value pair to the WAL. Depending on configuration, the WAL may be synced per write (sync = true, safest), per batch (most common), or lazily (fastest, risks losing recent writes on crash). The same update is inserted into the active memtable. RocksDB uses a concurrent skiplist by default, allowing multiple writer threads to insert without external locking.',
        {
          type: 'code',
          language: 'javascript',
          text: [
            '// Simplified RocksDB write path logic',
            'function put(key, value, seqNum) {',
            '  // Step 1: durability',
            '  wal.append({ key, value, seqNum, type: "put" });',
            '  if (syncMode) wal.fsync();',
            '',
            '  // Step 2: in-memory sorted insert',
            '  activeMemtable.insert(key, value, seqNum);',
            '',
            '  // Step 3: check if memtable is full',
            '  if (activeMemtable.size >= memtableLimit) {',
            '    immutableList.push(activeMemtable);',
            '    activeMemtable = new Memtable();',
            '    scheduleFlush();  // background thread picks this up',
            '  }',
            '}',
          ].join('\n'),
          label: 'The foreground path does two things: WAL append and memtable insert. Everything else is background.',
        },
        'A flush converts an immutable memtable into an SSTable on disk. Each SSTable stores sorted key-value entries in data blocks (default 4 KB), a metadata block with key range and file statistics, an index block mapping key prefixes to data block offsets, a Bloom filter block for point-lookup acceleration, and a CRC32 checksum per block for integrity. The SSTable lands in L0.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/SkipList.svg/800px-SkipList.svg.png',
          alt: 'Skip list data structure with multiple levels of linked lists providing O(log n) search',
          caption: 'A skip list: the default memtable implementation in RocksDB. Multiple levels of forward pointers give O(log n) insert and lookup without the rebalancing overhead of a balanced tree. Concurrent inserts use lock-free CAS operations on the tower pointers. Source: Wikimedia Commons.',
        },
        {
          type: 'diagram',
          text: [
            '  SSTable internal layout:',
            '  +------------------+',
            '  | data block 0     |  sorted KV pairs, compressed',
            '  | data block 1     |',
            '  | ...              |',
            '  | data block N     |',
            '  +------------------+',
            '  | meta block       |  filter (Bloom), stats, properties',
            '  +------------------+',
            '  | meta index block |  offsets into meta blocks',
            '  +------------------+',
            '  | index block      |  maps last key per data block -> offset',
            '  +------------------+',
            '  | footer           |  magic number, index/meta-index handles',
            '  +------------------+',
          ].join('\n'),
          label: 'An SSTable is self-contained: sorted data, filters, indexes, and checksums in one file',
        },
        'A get checks structures in freshness order. It must return the newest visible value, so it checks the active memtable, then each immutable memtable, then L0 files (which may overlap), then L1 through Ln files (which do not overlap within a level). At each SSTable, the engine first checks the Bloom filter -- if the filter says the key is absent, no disk read happens. If the filter says "maybe present," the engine consults the index block to find the right data block, then reads and decompresses that single block. The block cache keeps recently accessed blocks in memory.',
        'Compaction is the cleanup loop that repays write debt. RocksDB supports three main compaction styles:',
        {
          type: 'table',
          headers: ['Style', 'Mechanism', 'Write amp', 'Read amp', 'Space amp', 'Best fit'],
          rows: [
            ['Leveled', 'Merge L(n) files into L(n+1); each level is sorted and non-overlapping', 'Higher (10-30x typical)', 'Low (1 file per level)', 'Low (~1.1x)', 'Read-heavy, space-sensitive'],
            ['Universal (tiered)', 'Merge all sorted runs when count or size ratio threshold is hit', 'Lower (5-10x)', 'Higher (multiple runs to check)', 'Higher (up to 2x)', 'Write-heavy, tolerates read cost'],
            ['FIFO', 'Drop oldest files when total size exceeds limit', 'Minimal', 'Varies', 'Bounded by TTL', 'Time-series, TTL-based expiry'],
          ],
        },
        'In leveled compaction, a compaction job picks one file from L(n), finds all overlapping files in L(n+1), merge-sorts them, drops overwritten versions (keeping only the newest visible to any active snapshot), removes tombstones that are below the bottommost level, and writes new non-overlapping files into L(n+1). The size ratio between adjacent levels (default 10x) controls the tradeoff: a larger ratio means fewer levels and less read amplification, but each compaction rewrites more data.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The design works because it separates the fast path from the maintenance path, and each path is matched to what storage hardware does well. But "works" means two things: it is fast, and it is correct. The correctness argument is often skipped in LSM tutorials, so let us make it explicit.',
        {
          type: 'callout',
          text: 'Correctness invariant: a read for key K returns the value with the highest sequence number <= the reader\'s snapshot sequence number. Compaction may rearrange and delete entries, but it must never delete an entry visible to any active snapshot.',
        },
        'Every write in RocksDB gets a monotonically increasing sequence number. When a reader opens a snapshot, it records the current sequence number. A get checks components in freshness order (memtable, then L0, then L1...Ln) and returns the first entry for key K whose sequence number is <= the snapshot. Compaction merges sorted runs and discards entries whose sequence numbers are below the oldest active snapshot -- those entries are provably invisible to every reader. This is why snapshot pinning can bloat space: a long-lived snapshot prevents compaction from discarding old versions.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Bloom_filter.svg/800px-Bloom_filter.svg.png',
          alt: 'Bloom filter diagram showing hash functions mapping elements to a bit array',
          caption: 'A Bloom filter: the structure that makes LSM reads survivable. Each key is hashed to k bit positions. If any bit is zero, the key is definitely absent -- no disk read needed. RocksDB builds a Bloom filter per SSTable, typically using 10 bits per key for a ~1% false positive rate. Source: Wikimedia Commons.',
        },
        {
          type: 'bullets',
          items: [
            'Foreground writes do sequential appends (WAL) and memory inserts (memtable). No random page updates. SSDs handle sequential writes at near-bandwidth speed with minimal wear.',
            'Flushes produce sorted files, so background compaction can merge-sort them with sequential reads and writes -- the workload SSDs are designed for.',
            'Metadata structures (Bloom filters, block indexes, block cache) narrow reads to a small number of disk accesses, converting the raw LSM read penalty into a manageable cost.',
            'Sequence numbers provide MVCC: readers see a consistent snapshot without blocking writers, and compaction can safely discard versions that no snapshot references.',
          ],
        },
        'The deeper reason is that the design trades write amplification (total bytes written to storage vs. bytes of user data) for lower space amplification and lower read amplification. Leveled compaction rewrites data roughly once per level transition, producing write amplification of about size_ratio * (num_levels - 1). With a size ratio of 10 and 5 levels, that is roughly 40x. But each level is sorted and non-overlapping, so a point read touches at most one file per level -- read amplification stays bounded.',
        {
          type: 'note',
          text: 'The three amplification metrics are tightly constrained in an LSM engine -- not literally zero-sum, but you cannot minimize all three simultaneously. Leveled compaction minimizes read and space amplification at the cost of write amplification. Universal (tiered) compaction reduces write amplification but tolerates higher space and read amplification. The FAST 2021 paper reports concrete numbers: leveled WA ~16x, tiered ~4.8x, FIFO ~2.1x across their deployments. The operator must decide which amplification the workload can afford, and that decision changes as hardware and scale change.',
        },
        'Meta\'s experience paper documents this evolution. In 2012-2015, SSD write endurance was the binding constraint, so write amplification dominated tuning. By 2016-2018, data volumes had grown enough that space amplification (and thus storage cost) became the primary concern. By 2019-2021, NVMe SSDs were fast enough that CPU -- spent on compression, decompression, checksum verification, Bloom filter probes, and comparator calls -- became the bottleneck. The same engine, retuned three times for three different hardware generations.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider Apache Flink using RocksDB as its state backend. A streaming job computes per-user session counts. Each incoming event triggers a read-modify-write: get the current count, increment it, put the new count.',
        {
          type: 'code',
          language: 'text',
          text: [
            'Event stream: (user_A, click), (user_B, click), (user_A, click), ...',
            '',
            'For each event:',
            '  count = rocksdb.get(user_id)    // read path',
            '  rocksdb.put(user_id, count + 1) // write path',
            '',
            'Write path per put:',
            '  WAL append:     ~0.5 us (buffered, group commit)',
            '  Memtable insert: ~1 us  (skiplist, 100-byte KV)',
            '  Total foreground: ~1.5 us',
            '',
            'Background cost (amortized):',
            '  Memtable flush every 64 MB of writes',
            '  L0->L1 compaction when L0 file count > 4',
            '  L1->L2 compaction when L1 exceeds 256 MB',
            '  Write amplification: ~20x with default leveled config',
          ].join('\n'),
          label: 'The foreground path is microseconds; the background debt is megabytes of rewriting',
        },
        'At 100K events/second, the memtable fills roughly every 10 seconds (assuming 100-byte key-value pairs, 64 MB memtable). Each flush creates one L0 file. When L0 reaches 4 files (40 seconds of writes), compaction merges them into L1. If user keys repeat heavily, compaction drops old versions and the L1 output is much smaller than the L0 input.',
        'Now add Flink checkpointing. Every 60 seconds, Flink snapshots RocksDB state to remote storage (S3 or HDFS). If compaction is behind and L0 has 8 files instead of 4, the checkpoint includes redundant data -- multiple versions of the same keys -- inflating checkpoint size and upload time. If compaction runs aggressively during the checkpoint window, it competes with the checkpoint for SSD bandwidth and CPU, potentially causing event processing to back-pressure upstream.',
        {
          type: 'note',
          text: 'This is the upward-coupling problem. A local storage engine scheduling decision (when to compact) becomes a distributed system issue (checkpoint latency, backpressure). Flink operators who ignore RocksDB tuning often discover it during incidents: checkpoint timeouts traced to compaction storms, or state size growth traced to tombstone accumulation.',
        },
      ],
    },
    {
      heading: 'What the animation shows',
      paragraphs: [
        'The write-path view opens with the application, WAL, and memtable highlighted as active. This isolates the cheap half of the LSM bargain: the foreground write touches only a sequential log and an in-memory structure. The compare markers on L0 and L1 signal that these levels will eventually bear the cost.',
        'The second frame activates the flush and compaction machinery. The invariant stated in the frame -- "writes are cheap now because compaction pays cleanup cost later" -- is the central tension of the entire engine. Watch the edge from memtable to L0 (flush), then the edges from L0 through L1 to L2+ (compaction). Each edge represents deferred work becoming actual I/O.',
        'The read-path table shows why LSM reads need helpers. Each row -- memtable, L0, L1/L2, block cache -- has both a role and a cost pressure. The found markers on memtable and cache roles indicate the cheap paths. The compare markers on L0 and L1/L2 costs highlight where reads become expensive without filters and indexes.',
        'The compaction-tradeoff view should be read as a timeline of shifting bottlenecks. Write amplification, space amplification, CPU, and operability each dominated at different points in RocksDB\'s history. The tuning-knobs table shows that each knob helps one metric by spending another: compression saves space but burns CPU, filters save reads but consume memory, bigger levels help reads but create more compaction I/O. Every tuning choice is a pressure transfer, not a free improvement.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'RocksDB cost is measured in three amplification factors, not big-O notation. Each factor describes how much more work the engine does compared to the minimum required.',
        {
          type: 'table',
          headers: ['Metric', 'Definition', 'Leveled typical', 'Universal typical', 'What makes it worse'],
          rows: [
            ['Write amplification', 'Bytes written to storage / bytes of user data', '10-30x', '5-15x', 'More levels, smaller level multiplier, high update rate on existing keys'],
            ['Read amplification', 'Disk reads per point lookup (worst case)', '1-2 per level (with Bloom)', 'N sorted runs to check', 'Many L0 files, disabled/undersized Bloom filters, large key space'],
            ['Space amplification', 'Total storage used / size of live data', '~1.1x', 'Up to 2x during compaction', 'Tombstone accumulation, long-lived snapshots, delete-heavy workloads'],
          ],
        },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Merge_sort_algorithm_diagram.svg/800px-Merge_sort_algorithm_diagram.svg.png',
          alt: 'Merge sort diagram showing recursive divide-and-conquer with sorted merge steps',
          caption: 'Merge sort: the algorithm at the heart of LSM compaction. Files from adjacent levels are merge-sorted -- the same pattern shown here, applied to sorted runs on disk instead of arrays in memory. Each compaction reads input files sequentially, merges them, and writes sorted output files sequentially. This SSD-friendly I/O pattern is why compaction can sustain high throughput. Source: Wikimedia Commons.',
        },
        'CPU is the less obvious cost. On a modern NVMe SSD capable of 3+ GB/s sequential throughput, the CPU spent on LZ4 or Zstd compression, CRC32c checksums, Bloom filter probes (one hash + k bit lookups per filter), memtable comparator calls, and merge-sort operations during compaction can saturate cores before the SSD saturates bandwidth. Meta reported that CPU became the dominant bottleneck in their UDB (social graph) workload as they moved from SATA to NVMe.',
        {
          type: 'code',
          language: 'text',
          text: [
            'CPU cost breakdown (approximate, per operation):',
            '',
            '  Point write:',
            '    WAL serialization + CRC:     ~200 ns',
            '    Skiplist insert + comparator: ~500 ns',
            '',
            '  Point read (cache miss):',
            '    Bloom filter probe (10 bits/key): ~100 ns per SST checked',
            '    Block decompression (4KB LZ4):    ~1 us',
            '    Block binary search:              ~200 ns',
            '',
            '  Compaction (per MB of input):',
            '    Decompress input blocks:    ~1 ms',
            '    Merge-sort + comparator:    ~0.5 ms',
            '    Compress output blocks:     ~2 ms (LZ4) / ~8 ms (Zstd)',
            '    CRC32c checksums:           ~0.1 ms',
          ].join('\n'),
          label: 'On fast NVMe, compression and checksumming dominate -- the SSD is rarely the bottleneck',
        },
        'Operational cost is also real. RocksDB exposes metrics like rocksdb.compaction.pending.bytes, rocksdb.num-files-at-level0, rocksdb.actual-delayed-write-rate, and rocksdb.block-cache-miss. Teams that ignore these discover problems as application symptoms: p99 latency spikes traced to write stalls, disk fullness traced to tombstone accumulation, or memory pressure traced to unbounded block cache growth.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['System', 'How it uses RocksDB', 'Why embedded LSM fits', 'Key tuning concern'],
          rows: [
            ['TiKV (TiDB)', 'Per-Raft-region key-value storage', 'Each region is a small sorted partition; writes are Raft-replicated then applied locally', 'Write amplification affects replication lag budget'],
            ['CockroachDB', 'Pebble (RocksDB-inspired, rewritten in Go)', 'Per-range MVCC storage with prefix compression on versioned keys', 'Space amplification from MVCC version retention'],
            ['Apache Flink', 'Keyed-state backend for streaming jobs', 'Each operator\'s state is a local KV store; checkpointed to remote storage', 'Compaction interference with checkpoint I/O'],
            ['Kafka Streams', 'Local state store for stream processing', 'Changelog-backed KV store per partition', 'Memory budget shared with JVM heap'],
            ['MyRocks (Meta)', 'MySQL storage engine replacing InnoDB', 'Write-heavy social graph workload; 50% space savings over InnoDB B-tree', 'CPU from compression at scale across millions of instances'],
          ],
        },
        'RocksDB wins when a system needs durable local key-value state with heavy writes and is willing to manage background compaction as a first-class operational concern. The host application owns replication, sharding, consensus, and routing. RocksDB owns local persistence, ordering, and the amplification tradeoff.',
        {
          type: 'callout',
          text: 'RocksDB is especially strong when keys update repeatedly. Compaction discards old versions aggressively, so a workload with high key-overlap can achieve much lower actual write amplification than the theoretical worst case.',
        },
        'It also wins when the operator instruments amplification metrics and tunes per-workload, rather than assuming one configuration fits all services.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'RocksDB is not a database. It does not solve consensus, replication, distributed transactions, admission control, or query planning. Treating it as an invisible library is dangerous because local storage-engine behavior propagates upward into distributed system behavior.',
        {
          type: 'bullets',
          items: [
            'Predictable read latency: compaction can spike p99 reads by evicting cached blocks, consuming SSD bandwidth, and triggering write stalls that back-pressure reads indirectly. Workloads that need microsecond-level tail latency guarantees may need a different engine.',
            'Delete-heavy workloads: tombstones (deletion markers) cannot be removed until compaction reaches the bottommost level. A workload that deletes 90% of keys can accumulate tombstones that slow range scans and inflate space, sometimes for hours.',
            'Long-lived snapshots: any snapshot pins all versions created after it. A forgotten snapshot can prevent compaction from reclaiming space, growing storage use without bound.',
            'Small datasets: if the entire dataset fits in a few megabytes, the LSM machinery -- WAL, memtable, flush, compaction, Bloom filters, block cache -- adds complexity with no benefit over a simple sorted array or B-tree.',
            'Large sequential scans: iterating over a large key range must merge multiple sorted runs. Without careful prefetching and iterator management, scan throughput can be 2-5x worse than a B-tree that stores data in one sorted structure.',
          ],
        },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/Hash_table_4_1_1_0_0_1_0_LL.svg/800px-Hash_table_4_1_1_0_0_1_0_LL.svg.png',
          alt: 'Hash table with separate chaining showing buckets and linked lists of key-value pairs',
          caption: 'For exact-key lookups without ordering requirements, a simple hash table often outperforms an LSM engine. RocksDB pays for sorted order, Bloom filters, and compaction machinery -- overhead that is wasted if the workload never needs range scans, prefix iteration, or ordered traversal. Source: Wikimedia Commons.',
        },
        'The subtlest failure mode is configuration fragility. RocksDB has over 100 tunable parameters. A configuration that works well at 10 GB can fail at 1 TB (too many levels, compaction cannot keep up). A configuration tuned for SATA SSDs can waste CPU on NVMe. Teams that copy configurations from blog posts without measuring their own workload\'s amplification metrics often discover the mismatch during an incident.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'note',
          text: 'The primary source for this case study is "RocksDB: Evolution of Development Priorities in a Key-value Store Serving Large-scale Applications" by Dong et al., presented at USENIX FAST 2021. It is a production experience paper, not a theory paper. Read it as a history of shifting bottlenecks, not just an LSM tutorial. The RocksDB Wiki on GitHub (github.com/facebook/rocksdb/wiki) is the authoritative reference for configuration, internals, and tuning.',
        },
        {
          type: 'table',
          headers: ['Role', 'Topic', 'Why'],
          rows: [
            ['Prerequisite', 'Write-Ahead Log (WAL)', 'The durability mechanism behind every RocksDB write'],
            ['Prerequisite', 'Bloom Filter', 'The probabilistic structure that makes LSM reads survivable'],
            ['Mechanism', 'LSM Compaction Strategies Primer', 'Leveled vs. universal vs. FIFO tradeoffs in depth'],
            ['Mechanism', 'SSTable Block Index & Filter', 'How sorted files are made queryable without full scans'],
            ['Failure mode', 'RocksDB Write Stalls & Compaction Debt', 'What happens when compaction falls behind'],
            ['Failure mode', 'LSM Tombstones & Range Deletes', 'Why deletes are not free in an LSM engine'],
            ['System context', 'Delta Lake Case Study', 'Another layered storage system managing compaction and versioning'],
            ['System context', 'Backpressure & Flow Control', 'How local storage debt propagates into distributed backpressure'],
            ['Alternative', 'B-Tree', 'The update-in-place design that RocksDB trades away for write throughput'],
          ],
        },
        'The strongest follow-up exercise: take one system from the real-world uses table (Flink, TiKV, MyRocks), identify its primary access pattern (write-heavy? scan-heavy? delete-heavy?), and predict which amplification metric will hit the wall first. Then check the system\'s RocksDB tuning documentation to see if your prediction matches their configuration choices.',
      ],
    },
  ],
};
