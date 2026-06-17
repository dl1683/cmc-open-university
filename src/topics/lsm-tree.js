// LSM trees: how Cassandra (and RocksDB, and LevelDB) write so fast —
// never update in place; buffer in memory, flush sorted files, merge later.

import { arrayState, parseNumberList } from '../core/state.js';

export const topic = {
  id: 'lsm-tree',
  title: 'LSM Trees (How Cassandra Writes)',
  category: 'Systems',
  summary: 'Writes land in a memtable, flush to immutable sorted files, and merge in the background.',
  controls: [
    { id: 'writes', label: 'Write these keys (in order)', type: 'number-list', defaultValue: '52, 17, 89, 31, 64, 8, 75, 23' },
  ],
  run,
};

const MEMTABLE_LIMIT = 4;

export function* run(input) {
  const writes = parseNumberList(input.writes, { min: 6, max: 10, label: 'keys' });

  let memtable = [];
  const sstables = []; // each: a sorted, immutable array

  yield {
    state: arrayState([]),
    highlight: {},
    explanation: `Why can Cassandra absorb a million writes per second? Because it NEVER updates data in place. Updating in place (like a B-tree database) means finding the right disk page and rewriting it — a random disk seek per write. The Log-Structured Merge tree refuses: writes go to a sorted in-memory buffer (the MEMTABLE) and an append-only crash log (the WAL). Disks love appends.`,
  };

  for (const key of writes) {
    const at = sortedInsert(memtable, key);
    yield {
      state: arrayState(memtable),
      highlight: { active: [`i${at}`] },
      explanation: `write(${key}): appended to the WAL in one sequential disk write (crash safety), then slotted into the sorted memtable in memory — [${memtable.join(', ')}]. The client is already acknowledged. No random disk I/O happened.`,
      invariant: 'The memtable is always sorted; the WAL can rebuild it after a crash.',
    };

    if (memtable.length >= MEMTABLE_LIMIT) {
      sstables.push([...memtable]);
      yield {
        state: arrayState(memtable),
        highlight: { sorted: memtable.map((_, i) => `i${i}`) },
        explanation: `The memtable hit its limit (${MEMTABLE_LIMIT}) — FLUSH: it's written to disk as SSTable-${sstables.length}, a Sorted String Table. One big sequential write. The SSTable is IMMUTABLE — it will never be edited, only eventually replaced. A fresh empty memtable takes over.`,
      };
      memtable = [];
    }
  }

  const view = (arr) => `[${arr.join(', ')}]`;
  yield {
    state: arrayState(memtable.length ? memtable : sstables[sstables.length - 1]),
    highlight: {},
    explanation: `Current state: ${sstables.length} immutable SSTable${sstables.length === 1 ? '' : 's'} on disk (${sstables.map(view).join(' and ')})${memtable.length ? ` plus ${view(memtable)} still in the memtable` : ''}. Now the catch — READS must check the memtable first, then each SSTable newest-to-oldest. More tables = slower reads. Two rescues: each SSTable carries a Bloom Filter ("is key X DEFINITELY not in this file?" — skip it without touching disk), and binary search works inside each sorted file.`,
  };

  const merged = [...sstables.flat(), ...memtable].sort((a, b) => a - b);
  yield {
    state: arrayState(merged),
    highlight: { sorted: merged.map((_, i) => `i${i}`) },
    explanation: `Enter COMPACTION, the background janitor: merge the sorted SSTables into one — and because they're all sorted, this is exactly the merge step of Merge Sort, streaming and cheap. Deleted keys (marked by "tombstones") and overwritten versions are dropped here. Result: one clean table, ${view(merged)}, and reads get fast again.`,
  };

  yield {
    state: arrayState(merged),
    highlight: {},
    explanation: `That's the whole LSM bargain: writes become sequential appends (blazing fast), reads pay a small tax (multiple tables, refunded by bloom filters), and compaction pays the cleanup bill in the background. Cassandra, RocksDB (inside many databases), LevelDB, and HBase all run on this design — paired with Consistent Hashing to decide WHICH server each key lands on, you now understand the skeleton of a planet-scale database.`,
  };
}

function sortedInsert(arr, value) {
  let i = 0;
  while (i < arr.length && arr[i] <= value) i += 1;
  arr.splice(i, 0, value);
  return i;
}

export const article = {
  sections: [
    {
      heading: `Why This Exists`,
      paragraphs: [
        `Some databases are dominated by writes: events, metrics, logs, time-series data, counters, and replicated key-value updates. The storage engine has to acknowledge many small changes without seeking to a different old page for each one.`,
        `A Log-Structured Merge tree changes the foreground path. It logs the write, stores the newest value in memory, flushes immutable sorted files, and merges those files later. The database trades random page updates now for sequential writes and background compaction.`,
      ],
    },
    {
      heading: `The Baseline and the Wall`,
      paragraphs: [
        `The obvious design is a B-tree-style index. Find the page for the key, update the page, and keep the tree ordered. That design is strong for point reads and range scans because the latest value is near the place the search already reaches.`,
        `The wall is the foreground write path. Many tiny writes scatter across many pages. The engine must read, modify, and rewrite old pages while also logging enough information to survive a crash. At high write rates, touching old locations becomes the bottleneck.`,
        `An append-only log is the other simple idea. It makes writes cheap, but raw logs are poor indexes. An LSM tree keeps the append-friendly write path while periodically rebuilding sorted indexes out of the appended data.`,
      ],
    },
    {
      heading: `Core Data Layout`,
      paragraphs: [
        `An LSM tree has three main pieces. The Write-Ahead Log is an append-only recovery record. The memtable is an in-memory ordered structure that holds recent writes. SSTables are immutable sorted files on disk.`,
        `Each SSTable usually contains data blocks, a sparse index, metadata, and a Bloom filter. The filter answers a narrow question: this file definitely lacks the key, or it might contain the key. That lets reads skip many files without touching their data blocks.`,
        `The layout is multi-version by storage position. The same key can exist in the memtable and several SSTables. The search order gives meaning to those duplicates: newer state is checked before older state, and the newest visible value wins.`,
      ],
    },
    {
      heading: `Write Path`,
      paragraphs: [
        `A write first appends to the WAL. Once the log record is durable enough for the system's policy, the engine can recover the write after a crash. Then the key enters the memtable, often a skip list, tree, or other ordered in-memory structure.`,
        `When the memtable reaches a size threshold, it freezes and flushes to disk as an SSTable. That flush is a large sequential write. A fresh memtable starts accepting new writes while the old one becomes an immutable file.`,
        `The foreground operation doesn't search for an old page and rewrite it. It appends, updates memory, and leaves later organization to the compaction system.`,
      ],
    },
    {
      heading: `Read Path and Compaction`,
      paragraphs: [
        `A point read checks newest state first: active memtable, immutable memtables waiting to flush, and then SSTables from newer to older candidates. Bloom filters and indexes reduce the number of files that need data-block reads.`,
        `A range scan is harder. Each sorted run may contain part of the range, so the engine merges iterators from several sources and resolves duplicates by recency. Too many files make this expensive.`,
        `Compaction pays the cleanup bill. It reads sorted runs, merges them into new sorted runs, drops overwritten records when safe, and carries forward tombstones until older deleted values can no longer reappear. Size-tiered, leveled, and universal compaction policies make different tradeoffs between write amplification, read amplification, and space amplification.`,
      ],
    },
    {
      heading: `Why It Works`,
      paragraphs: [
        `Crash safety comes from the WAL. If the process dies after acknowledging a write but before flushing the memtable, recovery replays the log and rebuilds the lost memory state.`,
        `Read correctness comes from search order. The engine checks newer structures before older ones, so an older value can't override a newer value for the same key. A tombstone is a value in this ordering: it says the newest visible state is deletion.`,
        `Compaction is safe because sorted runs can be merged without losing order. For each key, the merge keeps the newest still-needed version and writes a new sorted run. The logical key-value map stays the same while the physical files change.`,
      ],
    },
    {
      heading: `Cost and Behavior`,
      paragraphs: [
        `A write is usually one log append plus an insertion into the memtable, often O(log M) for M keys in memory. The important behavior is sequential I/O on the foreground path.`,
        `A point read costs a memtable lookup plus probes into candidate SSTables. Bloom filters reduce unnecessary file reads, but false positives still cause some extra work. A range scan may have to merge entries from many sorted runs.`,
        `The central tax is amplification. Write amplification means compaction rewrites the same logical data multiple times. Read amplification means a lookup or scan checks multiple structures. Space amplification means old versions and tombstones occupy disk until compaction can remove them.`,
        `Compaction scheduling is a control problem. Too little compaction makes reads slow and space grow. Too much compaction steals disk bandwidth from writes and can create latency spikes.`,
        `A useful operational dashboard separates foreground write latency from compaction debt. If write latency rises while pending compaction bytes grow, the storage engine is falling behind on the cleanup work that makes later reads cheap.`,
        `That dashboard should also show tombstone age, file count by level, and compaction bandwidth, because those are the signals that explain why a write-optimized design suddenly becomes a read-latency incident.`,
      ],
    },
    {
      heading: `Where It Wins`,
      paragraphs: [
        `LSM trees fit write-heavy storage: Cassandra, HBase, LevelDB, RocksDB, Kafka Streams state stores, Flink state backends, and many embedded databases. They are strongest when sequential writes and batched merges beat scattered page rewrites.`,
        `They also fit workloads that ingest data now and query it later. A metrics system can accept a flood of timestamped points, flush them as sorted files, and compact them while reads use filters and indexes to avoid irrelevant files.`,
        `In distributed stores, consistent hashing and replication decide which machines own the key. The LSM tree decides how each machine stores that key locally.`,
      ],
    },
    {
      heading: `Where It Fails`,
      paragraphs: [
        `An LSM tree doesn't make writes free. It moves rewrite work to compaction. A system with too many SSTables, weak filters, or tombstone buildup can make reads and scans painful.`,
        `The design is a poor fit when the workload is mostly ordered reads over stable data and foreground write rate is modest. A B-tree may serve those reads with fewer files, fewer merges, and less compaction tuning.`,
        `An LSM tree is also not MVCC. LSM compaction is a storage-layout process. MVCC visibility is a transaction rule. They often coexist, but they answer different questions.`,
      ],
    },
    {
      heading: `Concrete Example`,
      paragraphs: [
        `Suppose key 42 is written three times and then deleted. The memtable or newest SSTable may contain the tombstone. Older SSTables may still contain the previous values. A correct read must find the tombstone first and stop there. A correct compaction can later remove the old values once it knows no older file can resurrect them for a visible reader.`,
        `Tombstones aren't just markers to skip. They are part of the newest-wins ordering until compaction and snapshot rules prove they are no longer needed.`,
      ],
    },
    {
      heading: `Study Next`,
      paragraphs: [
        `Study Write-Ahead Log (WAL) for crash recovery, Merge Sort for compaction, Bloom Filter for read avoidance, and SSTable Block Index & Filter for immutable file layout. Then read LSM Compaction Strategies Primer, RocksDB MANIFEST & VersionSet, and LSM Tombstones & Range Deletes for file metadata, versions, and deletion cleanup. Compare against B-Trees (How Databases Read), B+ Tree Leaf Sibling Scan Case Study, Write-Through vs Write-Back, MVCC Internals & VACUUM, and Consistent Hashing.`,
      ],
    },
  ],
};
