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
      heading: 'Problem',
      paragraphs: [
        `RocksDB matters because many systems that look distributed from the outside depend on a local embedded key-value store inside each node. A database shard, stream processor task, metadata service, queue, cache, or indexing worker may expose a high-level distributed interface while using RocksDB for durable local state. When RocksDB stalls, compacts, fills cache, burns CPU, or amplifies writes, the surrounding service feels it as latency, backpressure, checkpoint cost, or storage pressure.`,
        `The case study is not just "LSM trees are good for writes." It is a production lesson about moving bottlenecks. Earlier systems cared intensely about write amplification because SSD endurance and write bandwidth were scarce. As hardware, compression, and workloads changed, space amplification and CPU became equally important. The same engine had to serve many instances on shared machines, so operability and resource isolation became part of the algorithmic story.`,
      ],
    },
    {
      heading: 'Naive design',
      paragraphs: [
        `The naive durable key-value store uses an update-in-place structure such as a B-tree. A put operation finds the page that should contain the key, modifies it, and writes the page back. That design is excellent for many read-heavy workloads because the tree stays ordered and lookups follow a short path. But random writes can be expensive on storage devices, and small updates can dirty whole pages. With heavy write load, the engine spends much of its time rewriting pages in place.`,
        `Another naive design is an append-only log with an in-memory index. Writes are cheap because they append, but reads and recovery become harder as the log grows. Old versions and deleted keys remain in the log until some cleaner rewrites live data. Without a disciplined cleaning strategy, the system either wastes space forever or pays unpredictable cleanup costs later. RocksDB's LSM design is a structured compromise between those two extremes.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `The wall is that cheap foreground writes create background debt. An LSM can accept a write by appending to a write-ahead log and updating an in-memory memtable, but the data cannot stay there forever. Memtables flush into sorted files. Those files overlap. Old versions and tombstones accumulate. Reads may have to check multiple places. Space grows until compaction rewrites files and discards obsolete entries.`,
        `That means a storage engine is also a scheduler. Compaction competes with foreground reads and writes for CPU, memory bandwidth, block cache, SSD bandwidth, and write endurance. If compaction falls behind, Level 0 files pile up and writes may stall. If compaction is too aggressive, it can harm foreground latency. The hard part is not merely choosing a data structure. It is controlling when delayed work is paid and which resource becomes the bottleneck.`,
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        `RocksDB uses the log-structured merge-tree idea: make writes sequential and sorted, then repair the read and space costs with background merging. The write path first records the update in a write-ahead log for crash recovery and then inserts it into a mutable in-memory sorted structure called a memtable. When the memtable fills, it becomes immutable and is flushed as a sorted string table, or SSTable, on disk.`,
        `The disk side is organized into levels. New flushed files land in Level 0, where files may overlap in key range. Compaction later chooses files, reads their sorted contents, merges them, drops overwritten versions and expired tombstones when safe, and writes new files into lower levels. Lower levels are larger and more orderly. The result is a system that makes the common foreground write cheap while spending background work to keep reads and space under control.`,
        `The production insight is that every knob moves pressure. A larger memtable can reduce flush frequency but use more memory. Stronger compression can reduce space but spend CPU. More filters can avoid unnecessary reads but consume memory and build time. More compaction bandwidth can reduce debt but hurt foreground operations. RocksDB is configurable because the right answer depends on the workload and the service wrapped around it.`,
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        `A put begins with durability. The engine appends the update to the WAL. Depending on configuration, the WAL may be synced immediately or later. The update is inserted into the active memtable, usually a sorted in-memory structure. Once the write is acknowledged, a crash can recover the memtable contents by replaying the WAL. This is why the WAL and memtable appear together on the write path.`,
        `A flush moves data from memory to disk. When the memtable reaches a size threshold, RocksDB makes it immutable and starts a new mutable memtable. The immutable one is written as an SSTable. An SSTable stores sorted key-value entries in blocks, plus metadata, indexes, filters, and checksums. Sorted files make range scans and merging efficient, while block indexes and Bloom filters reduce unnecessary reads.`,
        `A get checks several places in freshness order. It must see the newest value, so it checks the mutable memtable, immutable memtables, Level 0 files, and lower levels. It uses sequence numbers to resolve versions and tombstones. It uses block cache for hot data blocks, filter blocks to skip files that cannot contain a key, and indexes to find the right block when a file might contain the key. This is why read amplification is a first-class metric, not an afterthought.`,
        `Compaction is the cleanup loop. It selects input files from one level and overlapping files from the next level, performs a sorted merge, discards overwritten versions, preserves or removes tombstones according to snapshot and level rules, and writes output files. Leveled compaction tends to control space and reads but rewrites data repeatedly. Universal or tiered strategies can reduce write amplification for some workloads but may tolerate more read or space amplification.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The design works because it separates the fast path from the maintenance path. Foreground writes do not perform random page updates across a large on-disk tree. They append to the WAL and update memory. Sorted disk files let background compaction use sequential reads and writes, which storage devices handle efficiently. The system pays for order and cleanup in batches instead of paying the full cost on every write.`,
        `It also works because metadata narrows reads. A naive LSM read would check too many files. RocksDB uses Bloom filters to reject files that do not contain a point key, block indexes to jump to the relevant data block, sequence numbers to decide which version is visible, and block cache to keep hot data in memory. These helpers convert the raw LSM idea into a practical storage engine.`,
        `The experience-paper lesson is that "works" changes over time. When SSD write endurance dominated, write amplification was the obvious enemy. When large-scale deployments stored huge volumes of data, space amplification became a major cost. When compression, checksums, filters, and many instances per host grew, CPU and operational predictability became limiting. RocksDB kept evolving because the bottleneck moved.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Suppose a stream processor stores keyed aggregation state in RocksDB. Each event updates one key. The foreground path appends to the WAL and updates the memtable, so the task can handle a high update rate. After many events, the memtable flushes into Level 0. Several Level 0 files now contain overlapping ranges and multiple versions of hot keys.`,
        `A read for one key first checks memory. If the key is not there, it may need to inspect Level 0 files because they overlap. Bloom filters can skip files that cannot contain the key, but too many Level 0 files still add cost. Compaction merges those files into Level 1 or lower levels, keeping the newest visible value and discarding older overwritten entries. The read path gets cheaper, and space is reclaimed.`,
        `Now add production pressure. The stream processor also checkpoints state to remote storage. If compaction is behind, checkpoints may include extra obsolete data, and local disk may fill faster. If compaction runs heavily during checkpointing, CPU and disk bandwidth may hurt event processing. The local storage-engine schedule has become a distributed application issue.`,
      ],
    },
    {
      heading: 'What the animation shows',
      paragraphs: [
        `The write-path view begins with the application, WAL, and memtable. That frame isolates the cheap part of the LSM bargain: foreground writes are append plus memory update. The next frame follows the debt into Level 0, lower levels, and compaction. The useful invariant is that writes are cheap now because compaction pays cleanup later.`,
        `The read-path table shows why helpers matter. A get may consult memory, overlapping recent files, ordered lower levels, filters, indexes, and cache. The block cache is not just a performance luxury; it is part of the cost model. The placement table then connects the embedded engine to real systems. A distributed database, stream processor, queue, or cache can all inherit RocksDB's compaction behavior.`,
        `The compaction-tradeoff view should be interpreted as pressure transfer. Write amplification, space amplification, CPU utilization, and operability matter under different conditions. The tuning table shows that each knob helps one metric by spending another resource. The final frame links local metrics to higher-level controls such as measurement, resource isolation, adaptation, and backpressure.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `The core cost is amplification. Write amplification counts how many bytes the engine writes to storage for each byte of logical user data. Read amplification counts how many memory and disk structures a lookup must consult. Space amplification counts how much extra storage is used for old versions, tombstones, metadata, and level slack. RocksDB tuning is often the art of deciding which amplification the application can afford.`,
        `CPU is the less obvious cost. Compression, decompression, checksum verification, filter construction, comparator work, and compaction merging can dominate on fast SSDs. A configuration that saves disk may become CPU-bound. A configuration that improves p99 reads may spend memory on cache and filters that another part of the service needed.`,
        `Operational complexity is also real. RocksDB exposes many options because workloads differ, but that means teams can create unstable configurations. Write stalls, too many Level 0 files, pending compaction bytes, cache misses, snapshot retention, and tombstone buildup require metrics and alerting. The embedded nature of RocksDB can hide these problems until they surface as application symptoms.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `RocksDB wins when a system needs durable local key-value state with heavy writes, configurable performance, and tight embedding. It is useful under distributed databases, stream processors, metadata indexes, queues, deduplication tables, and persistent caches. The host application controls replication, sharding, consensus, request routing, and higher-level semantics, while RocksDB handles local persistence.`,
        `It is especially strong when batched background work is acceptable. If the workload can tolerate compaction as a managed maintenance process, the engine can turn random updates into sequential disk activity and preserve reasonable reads with filters, indexes, and cache. It also wins when the system operator is willing to measure workload-specific metrics instead of assuming one universal profile.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `RocksDB is not a complete distributed database. It does not solve consensus, replication, distributed transactions, admission control, or cluster balancing by itself. Treating it as an invisible library is dangerous because local stalls can become global behavior. A coordinator may see slow replicas, a stream processor may see backpressure, and a cache may see tail latency spikes, all caused by storage-engine debt.`,
        `It can also be the wrong fit for workloads that need highly predictable read latency with little background interference, tiny memory budgets, very small datasets where simpler structures are enough, or access patterns dominated by large scans that interact poorly with cache and compaction. Long-lived snapshots can prevent cleanup. Delete-heavy workloads can accumulate tombstones. Bad key design can create hot ranges or poor compression. Slow disks or saturated CPU can make compaction fall permanently behind.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources include the FAST paper "RocksDB: Evolution of Development Priorities in a Key-value Store Serving Large-scale Applications," the USENIX FAST presentation page, and Meta's research summary for the same work. Read them as a production history, not only as an LSM introduction: the interesting claim is that priorities changed as deployments and hardware changed.`,
        `Study LSM Trees (How Cassandra Writes), LSM Compaction Strategies Primer, RocksDB Write Stalls & Compaction Debt, SSTable Block Index & Filter, RocksDB MANIFEST & VersionSet, LSM Tombstones & Range Deletes, Write-Ahead Log (WAL), Bloom Filter, Quotient Filter, Delta Lake Case Study, and Backpressure & Flow Control next. The strongest follow-up exercise is to take one workload and predict which amplification metric will become the first bottleneck.`,
      ],
    },
  ],
};
