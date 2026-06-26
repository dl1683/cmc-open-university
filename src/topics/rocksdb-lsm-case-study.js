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
        'The animation shows two paths running at different speeds. The foreground path is what a user write waits for: append to the write-ahead log (WAL) and insert into an in-memory sorted structure called a memtable. The background path is flush and compaction, where RocksDB converts memory into sorted-string-table files (SSTables) and later merges those files to control overlap and reclaim space.',
        'Active nodes mark where CPU, memory, or device bandwidth is being spent right now. Compare nodes mark where RocksDB is deciding which component might contain a key or which files need merging. Found nodes mark where an invariant has been satisfied, such as a durable WAL append or the newest visible value for a read. Watch the ratio of foreground speed to background speed: when foreground outpaces background, debt accumulates.',
        {type:'callout', text:'RocksDB is not a database. It is the embedded storage engine inside hundreds of databases, stream processors, and caches. When it stalls, every system built on top inherits the pain.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/LSM_Tree.png/800px-LSM_Tree.png', alt:'LSM tree architecture showing memtable, immutable memtable, and SSTable levels', caption:'The LSM tree architecture: writes go to an in-memory memtable, then flush to sorted on-disk SSTables that are periodically merged via compaction. Source: Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many systems need durable local key-value state inside a larger service. Durable means committed data survives a process crash; key-value means the interface is get(key) and put(key, value) rather than SQL. Stream processors like Flink, distributed databases like TiKV, and MySQL via MyRocks all embed RocksDB in the application process rather than talking to a separate server over the network.',
        'The LSM tree exists to make random writes behave like sequential writes. Instead of rewriting a disk page every time one key changes, RocksDB appends a log record for crash recovery, inserts the key into a sorted in-memory structure, and lets background compaction reorganize files later. That is the central bargain: make the user-facing write cheap now, then pay the merge cost in a controlled background loop.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious durable design is a B-tree. A B-tree keeps keys sorted in wide disk pages, finds the page that should contain the key, edits that page in place, and writes the dirty page back. Reads follow a short path from root to leaf, and range scans are naturally ordered because neighboring keys sit in neighboring pages.',
        'The other obvious design is an append-only log with an in-memory index. Appends are fast because they always write at the end of the file, and the index maps each key to the offset of its newest value. The problem is that the log never stops growing unless a cleaner copies live records forward and discards the old segments. Both approaches hit a wall when writes are frequent and random.',
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/B-tree.svg/800px-B-tree.svg.png', alt:'B-tree data structure with internal nodes containing sorted keys and child pointers', caption:'A B-tree keeps data sorted across wide disk pages. Updates modify a page in place and write it back. Fast for reads but expensive for random writes on flash storage, where even a small update dirties an entire multi-kilobyte page. Source: Wikimedia Commons.'},
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is write amplification. Write amplification is the ratio of physical bytes written to storage divided by logical bytes written by the application. A 100-byte update that dirties a 16 KB B-tree page has amplification of 163.84x before the storage device does any internal garbage collection. On flash SSDs, the device adds its own amplification because it must erase in large blocks even when only part of a block changed.',
        'An append-only log avoids the page rewrite but creates a different wall: unbounded cleanup. Old values, deleted keys, and stale versions stay on disk until something rewrites the live data into a cleaner form. The storage engine is not just a map from keys to values; it is a scheduler for deferred cleanup work. The question is never whether cleanup happens, only when and at whose expense.',
        {type:'callout', text:'Write amplification stacks: application-level (100 bytes to 16 KB page), device-level (page to erase block), and FTL garbage collection. Sequential writes avoid this entire stack because they fill blocks cleanly.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Write-ahead_logging_-_before_and_after.svg/800px-Write-ahead_logging_-_before_and_after.svg.png', alt:'Write-ahead logging diagram showing log entries written before data pages are modified', caption:'Write-ahead logging (WAL): every mutation is first appended to a sequential log for crash recovery, then applied to the in-memory data structure. After a crash, RocksDB replays the WAL to reconstruct memtable entries that had not yet been flushed. Source: Wikimedia Commons.'},
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Combine a sequential log, sorted memory, and sorted immutable files. New writes go to the WAL for crash recovery and to the memtable for fast lookup. When the memtable fills, RocksDB writes its sorted contents to disk as an SSTable file instead of updating old files in place. The SSTable is immutable once written.',
        'Immutability is what makes everything else sequential. Flush writes a new file from beginning to end. Compaction reads existing sorted files, merge-sorts them, drops versions that no active reader can see, and writes new sorted output files. The engine turns random update work into planned sequential merge work. The cost is not eliminated; it is deferred, batched, and converted into a pattern that flash storage handles efficiently.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A put first appends a record to the WAL, a sequential file used only for crash recovery. After the WAL append succeeds, RocksDB inserts the key into the active memtable, typically implemented as a skip list. A skip list is a layered linked structure where each node has random-height towers of forward pointers, giving O(log n) search and insert without the rebalancing rotations of a balanced tree.',
        'When the memtable reaches its configured size, it becomes immutable and a fresh memtable takes new writes. A background flush thread writes the immutable memtable as a new SSTable at level zero (L0). L0 files can overlap in key range because each flush produces an independent file. Compaction later merges overlapping L0 files into level 1, then level 1 into level 2, and so on. Each deeper level is larger and contains non-overlapping sorted runs.',
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/SkipList.svg/800px-SkipList.svg.png', alt:'Skip list data structure with multiple levels of linked lists providing O(log n) search', caption:'A skip list: the default memtable implementation in RocksDB. Multiple levels of forward pointers give O(log n) insert and lookup. Concurrent inserts use lock-free compare-and-swap operations on the tower pointers. Source: Wikimedia Commons.'},
        'A get checks the newest locations first: active memtable, then immutable memtables, then L0 files, then deeper levels. Each SSTable carries a Bloom filter, a compact probabilistic structure that can say a key is definitely absent or possibly present. If the filter says absent, RocksDB skips that file without reading any data block. With 10 bits per key, the false positive rate is about 1%.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on sequence numbers. Every write receives a monotonically increasing sequence number, and a snapshot records the highest sequence number visible to that reader. A read for key K must return the value with the highest sequence number that does not exceed the reader\'s snapshot. Because the engine checks locations from newest to oldest, the first match it finds is the correct answer.',
        'Compaction is allowed to rearrange and delete entries because it preserves this rule. It can discard an older version of a key only when a newer version with a higher sequence number covers it for every active snapshot. It can remove a tombstone only when no snapshot can still see the value beneath it. The physical file layout changes, but the logical answer for every snapshot stays the same.',
        {type:'callout', text:'Correctness invariant: a read for key K returns the value with the highest sequence number <= the reader\'s snapshot. Compaction may rearrange files and drop entries, but must never delete an entry visible to any active snapshot.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Bloom_filter.svg/800px-Bloom_filter.svg.png', alt:'Bloom filter diagram showing hash functions mapping elements to a bit array', caption:'A Bloom filter makes LSM reads survivable. Each key is hashed to k bit positions. If any bit is zero, the key is definitely absent and no disk read is needed. RocksDB builds one filter per SSTable, typically using 10 bits per key for about 1% false positive rate. Source: Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Cost appears as three amplification metrics. Write amplification is physical device bytes written divided by user bytes written; values of 10x to 30x are common with leveled compaction. Read amplification is the number of locations a lookup must probe before finding or rejecting a key. Space amplification is disk space used beyond the live dataset because old versions and compaction temporary files coexist.',
        'The three metrics trade against each other. Leveled compaction keeps read and space amplification low by aggressively rewriting files into non-overlapping sorted runs, but pays high write amplification. Universal compaction lowers write amplification by merging fewer times, but leaves more sorted runs for reads to probe. There is no free configuration; every knob moves cost from one metric to another.',
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Merge_sort_algorithm_diagram.svg/800px-Merge_sort_algorithm_diagram.svg.png', alt:'Merge sort diagram showing recursive divide-and-conquer with sorted merge steps', caption:'Merge sort is the algorithm at the heart of LSM compaction. Files from adjacent levels are merge-sorted, the same pattern shown here applied to sorted runs on disk. Sequential reads and writes make this SSD-friendly. Source: Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'RocksDB is used when the surrounding system owns distribution but needs strong local persistence. TiKV stores Raft-replicated key ranges on each node. Flink stores keyed stream state in a RocksDB state backend. Kafka Streams uses it for local partition state. MyRocks replaces InnoDB with RocksDB as a MySQL storage engine to reduce write amplification on flash.',
        'The pattern is the same in every case: the larger system handles routing, replication, or consensus, while RocksDB handles the local sorted key-value store. It is strongest when keys are updated repeatedly, because compaction can discard old versions during merge work.',
        {type:'callout', text:'RocksDB is strongest when keys update repeatedly. Compaction discards old versions aggressively, so high key-overlap workloads achieve much lower actual write amplification than the worst case.'},
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'RocksDB fails as a drop-in database replacement. It provides no consensus, no replication, no distributed transactions, no query planning, and no cluster admission control. Every missing layer must be built or adopted separately.',
        'It also fails for workloads that do not benefit from sorted order. A dataset small enough to fit in a hash map gains nothing from SSTables, compaction, Bloom filters, and block cache management. A workload with only exact-key lookups and no range scans pays for the entire sorted-file machinery without using its main advantage.',
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/Hash_table_4_1_1_0_0_1_0_LL.svg/800px-Hash_table_4_1_1_0_0_1_0_LL.svg.png', alt:'Hash table with separate chaining showing buckets and linked lists of key-value pairs', caption:'For exact-key lookups without ordering, a hash table often outperforms an LSM engine. RocksDB pays for sorted order, Bloom filters, and compaction machinery that is wasted if the workload never needs range scans or prefix iteration. Source: Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A Flink job writes 100,000 state updates per second, each storing a 100-byte key-value pair. The logical write rate is 10 MB/s. With a 64 MB memtable, memory fills every 6.4 seconds, triggering a flush that writes a new L0 SSTable.',
        'Leveled compaction produces 20x write amplification: every user byte eventually causes 20 bytes of physical device writes across flushes and level-to-level merges. The device must absorb 200 MB/s of physical writes. If the node can only provide 150 MB/s after reads, checkpoints, and OS overhead, compaction debt grows at 50 MB/s. In ten minutes that is 30 GB of unpaid rewrite work, visible as rising L0 file counts, growing pending compaction bytes, and eventually write stalls.',
        'Now suppose the workload has a hot key set where 80% of writes hit 5% of keys. Compaction discards old versions of those hot keys quickly, and measured write amplification drops to 8x. The same 10 MB/s logical workload now needs only 80 MB/s of physical writes, well within the 150 MB/s budget. The engine did not become free; the workload shape made the deferred cleanup fit inside the available capacity.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with the original LSM-tree paper by O\'Neil, Cheng, Gawlick, and O\'Neil (1996), which defines the structure and its write-optimized properties. Then read the RocksDB Wiki pages on memtables, SST file format, Bloom filters, compaction styles, and write stalls. For production experience, the FAST 2021 paper traces how bottlenecks shifted from write amplification to space amplification to CPU as hardware evolved.',
        'Study next by following one write and one read through the RocksDB codebase. For the write: WAL append, memtable insert, flush trigger, SSTable creation, and compaction pick. For the read: memtable probe, immutable memtable probe, L0 file iteration with Bloom filter checks, and deeper level binary search. From here, study Write Stalls and Compaction Debt to see what happens when the background loop cannot keep up.',
      ],
    },
  ],
};
