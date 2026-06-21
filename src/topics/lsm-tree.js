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
      heading: 'How to read the animation',
      paragraphs: [
        "The animation shows the life cycle of an LSM tree: writes arrive one at a time, each landing in a sorted in-memory buffer (the memtable). When the memtable fills, it freezes and flushes to disk as an immutable sorted file (an SSTable). At the end, compaction merges the SSTables into one clean sorted run.",
        "Active (highlighted) items mark the key currently being inserted into the memtable. Sorted markers appear when a memtable is frozen and ready to flush. After compaction, the merged result shows the final sorted state on disk.",
        "Watch the memtable grow, flush, and regrow. Each flush is a large sequential write, not a random page update. The merge at the end is the same operation as the merge step of merge sort: two sorted inputs, one sorted output, streaming and cheap.",
        {type: 'callout', text: 'An LSM tree makes the foreground write path cheap by turning random updates into append, flush, and merge work that can be scheduled later.'},
      
        {type: 'image', src: './assets/gifs/lsm-tree.gif', alt: 'Animated walkthrough of the lsm tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: `Why this exists`,
      paragraphs: [
        `Some databases are dominated by writes: events, metrics, logs, time-series data, counters, and replicated key-value updates. The storage engine has to acknowledge many small changes without seeking to a different old page for each one.`,
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/LSM_Tree.png/800px-LSM_Tree.png', alt: 'LSM tree diagram with a memtable, immutable memtable, SSTables, and levels', caption: 'The LSM layout separates memory writes, flushed sorted files, and compaction levels. Source: Wikimedia Commons, LSM Tree image.'},
        `A Log-Structured Merge tree changes the foreground path. It logs the write, stores the newest value in memory, flushes immutable sorted files, and merges those files later. The database trades random page updates now for sequential writes and background compaction.`,
      ],
    },
    {
      heading: `The obvious approach`,
      paragraphs: [
        `The standard answer for ordered storage is a B-tree. Each write finds the correct leaf page, updates it in place, and keeps the tree balanced. B-trees give excellent read performance: one root-to-leaf traversal locates any key, and range scans follow sibling pointers through sorted leaves. Traditional OLTP databases (PostgreSQL, MySQL/InnoDB) use B-trees because most business workloads read far more than they write.`,
        `The wall is the foreground write path. Each B-tree write requires a random seek to the target page, a read-modify-write of that page, and enough WAL logging to survive a crash. At thousands of writes per second, the random I/O pattern saturates the disk. SSDs help but do not eliminate the problem: random small writes still cause write amplification inside the flash translation layer and wear the device faster than sequential writes do.`,
        `An append-only log is the other simple idea. It makes writes cheap, but raw logs are poor indexes. An LSM tree keeps the append-friendly write path while periodically rebuilding sorted indexes out of the appended data.`,
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `An LSM tree has three main pieces. The Write-Ahead Log is an append-only recovery record. The memtable is an in-memory ordered structure that holds recent writes. SSTables are immutable sorted files on disk.`,
        `Each SSTable usually contains data blocks, a sparse index, metadata, and a Bloom filter. The filter answers a narrow question: this file definitely lacks the key, or it might contain the key. That lets reads skip many files without touching their data blocks.`,
        `The layout is multi-version by storage position. The same key can exist in the memtable and several SSTables. The search order gives meaning to those duplicates: newer state is checked before older state, and the newest visible value wins.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `A write appends a record to the WAL (one sequential disk write for crash safety), then inserts the key into the memtable, which is kept sorted in memory (typically a skip list or red-black tree). The client gets an acknowledgment immediately. No disk page was read or rewritten.`,
        `When the memtable reaches a size threshold (commonly 64 MB in RocksDB), it freezes. A new empty memtable starts accepting writes. The frozen memtable is flushed to disk as a sorted, immutable SSTable file. That flush is one large sequential write.`,
        `Each SSTable contains sorted data blocks, a sparse index for binary search within the file, metadata, and a Bloom filter. The Bloom filter lets reads skip files that definitely lack the target key without reading any data blocks.`,
        `A point read checks the active memtable, then any frozen memtables awaiting flush, then SSTables from newest to oldest. The first match wins because newer state overrides older state. A tombstone (deletion marker) counts as a match: it means the key was deleted.`,
        `A range scan is harder. Each sorted run may contain part of the range, so the engine merges iterators from several sources and resolves duplicates by recency. Too many files make this expensive.`,
        `Compaction merges sorted runs. Two or more SSTables are read as sorted streams, merged (exactly like merge sort's merge step), and written as new SSTables. Overwritten values and expired tombstones are dropped. The old input files are deleted. The key-value map is unchanged; only the physical layout improves.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `Crash safety comes from the WAL. If the process dies after acknowledging a write but before flushing the memtable, recovery replays the log and rebuilds the lost memory state.`,
        `Read correctness comes from search order. The engine checks newer structures before older ones, so an older value can't override a newer value for the same key. A tombstone is a value in this ordering: it says the newest visible state is deletion.`,
        `Compaction is safe because sorted runs can be merged without losing order. For each key, the merge keeps the newest still-needed version and writes a new sorted run. The logical key-value map stays the same while the physical files change.`,
      ],
    },
    {
      heading: `Cost and behavior`,
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
      heading: `Real-world uses`,
      paragraphs: [
        `LSM trees fit write-heavy storage: Cassandra, HBase, LevelDB, RocksDB, Kafka Streams state stores, Flink state backends, and many embedded databases. They are strongest when sequential writes and batched merges beat scattered page rewrites.`,
        `They also fit workloads that ingest data now and query it later. A metrics system can accept a flood of timestamped points, flush them as sorted files, and compact them while reads use filters and indexes to avoid irrelevant files.`,
        `In distributed stores, consistent hashing and replication decide which machines own the key. The LSM tree decides how each machine stores that key locally.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `An LSM tree doesn't make writes free. It moves rewrite work to compaction. A system with too many SSTables, weak filters, or tombstone buildup can make reads and scans painful.`,
        `The design is a poor fit when the workload is mostly ordered reads over stable data and foreground write rate is modest. A B-tree may serve those reads with fewer files, fewer merges, and less compaction tuning.`,
        `An LSM tree is also not MVCC. LSM compaction is a storage-layout process. MVCC visibility is a transaction rule. They often coexist, but they answer different questions.`,
      ],
    },
    {
      heading: 'Compaction strategies',
      paragraphs: [
        "Leveled compaction (used by default in LevelDB and RocksDB) organizes SSTables into levels. Level 0 receives flushed memtables directly. Each higher level is 10x the size of the previous. When a level exceeds its size target, one file is picked and merged into the next level. This keeps at most one file per key range at each level above L0, giving reads a bounded number of files to check. The tradeoff: write amplification is high (a key may be rewritten 10-30x across levels).",
        "Size-tiered compaction (Cassandra's default, called 'universal' in RocksDB) groups similarly-sized SSTables and merges them when enough accumulate. Writes are cheaper because data moves through fewer merge rounds, but reads may need to check more files and space amplification is higher because multiple versions of the same key range coexist until they are merged.",
        "The choice is a three-way tradeoff (the RUM conjecture): read amplification, write amplification, and space amplification. No compaction strategy minimizes all three. Leveled compaction favors reads and space. Size-tiered favors writes. Workload determines which tax is cheapest to pay.",
      ],
    },

    {
      heading: 'LSM trees vs B-trees',
      paragraphs: [
        "B-trees update data in place: one write touches one page (plus the WAL). Reads follow one root-to-leaf path. The cost is random I/O per write and the need to maintain page splits and merges on the foreground path.",
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/B-tree.svg/800px-B-tree.svg.png', alt: 'B-tree diagram with sorted keys packed into wide internal nodes', caption: 'A B-tree keeps search paths shallow by packing many separator keys into each page-sized node. Source: Wikimedia Commons, CyHawk, CC BY-SA 3.0 or GFDL.'},
        "LSM trees never update in place: writes are sequential appends and flushes. The cost moves to compaction (background sequential I/O) and reads that check multiple files. Bloom filters and caching reduce but do not eliminate the read tax.",
        "At low-to-moderate write rates with heavy reads, B-trees usually win. At high write rates (event streams, time-series, counters, log ingestion), LSM trees dominate because sequential I/O is 10-100x faster than random I/O on both spinning disks and SSDs.",
        "In practice, many production systems use both: RocksDB (LSM) as the embedded storage engine inside higher-level systems, and B-tree indexes (PostgreSQL, MySQL) for OLTP. The right choice depends on the read/write ratio, not on which structure is 'better' in general.",
      ],
    },

    {
      heading: 'Worked example: key 42 through the full lifecycle',
      paragraphs: [
        "Suppose the system receives write(42, 'alice'), then later write(42, 'bob'), then delete(42). Each operation appends to the WAL and enters the memtable. After flushing, the oldest SSTable may hold {42: 'alice'}, a newer SSTable holds {42: 'bob'}, and the memtable or newest SSTable holds a tombstone for key 42.",
        "A point read for key 42 checks newest-to-oldest. It finds the tombstone first and returns 'not found' without ever seeing the older values. This is correct because the tombstone is the most recent state.",
        "During compaction, the merge encounters all three entries for key 42. It keeps only the tombstone (because readers of older snapshots might still need it). Once no active snapshot references the older SSTables, a later compaction drops the tombstone too, and key 42 disappears from disk entirely.",
        "This lifecycle shows why tombstones are not free. They occupy space and slow scans until compaction can prove they are safe to remove. A workload with frequent deletes and rare compaction accumulates tombstones, which is a common source of unexpected read latency in Cassandra.",
      ],
    },

    {
      heading: 'Sources and study next',
      paragraphs: [
        "The foundational paper is Patrick O'Neil, Edward Cheng, Dieter Gawlick, and Elizabeth O'Neil, 'The Log-Structured Merge-Tree (LSM-Tree),' Acta Informatica, 1996. It introduces the original two-component merge tree and analyzes the batch-write advantage over B-trees. For the broader context of log-structured storage, see Rosenblum and Ousterhout, 'The Design and Implementation of a Log-Structured File System,' ACM TOCS, 1992.",
        "For implementation detail, read the LevelDB source (google/leveldb on GitHub) and the RocksDB wiki (github.com/facebook/rocksdb/wiki), which documents leveled compaction, universal compaction, column families, and tuning. The Cassandra documentation covers size-tiered compaction and tombstone handling in production.",
        {
          type: 'bullets',
          items: [
            'Prerequisites: Merge Sort (the merge step is the core of compaction), Bloom Filters (how reads skip irrelevant SSTables), Binary Search (how reads locate keys within an SSTable), Skip Lists (a common memtable implementation).',
            'Extensions: LSM Compaction Strategies Primer (leveled vs tiered tradeoffs in depth), LSM Tombstones & Range Deletes (deletion mechanics and tombstone compaction), Write-Ahead Log (WAL crash recovery details), RocksDB MANIFEST & VersionSet (file metadata and version tracking).',
            'Contrasting alternatives: B-Trees (How Databases Read) for the update-in-place approach, B+ Tree Leaf Sibling Scan for range-scan-optimized reads, MVCC Internals & VACUUM for the transaction visibility layer that often sits above an LSM engine.',
            'System context: Consistent Hashing (how distributed LSM-based stores like Cassandra partition keys across nodes), Write-Through vs Write-Back (caching policies that interact with write-optimized storage).',
          ],
        },
      ],
    },
],
};
