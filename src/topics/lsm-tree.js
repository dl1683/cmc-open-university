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
      heading: `What it is`,
      paragraphs: [
        `An LSM tree (Log-Structured Merge tree) is how Cassandra, RocksDB, and LevelDB write so fast: writes NEVER modify data in place. Instead, writes land in a sorted in-memory buffer (the memtable), are logged to an append-only crash journal (the WAL), and only later merged into immutable sorted tables on disk (SSTables). Appends are fast; merges happen in the background.`,
        `Compare to a B-tree database: every write is a random disk seek to find the right page and rewrite it. With an LSM, every write is one sequential log append (milliseconds) plus one in-memory insertion (microseconds). The cost? Reads must check the memtable first, then multiple SSTables. Bloom filters bail you out.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Write comes in: append to the WAL (append-only, survives crashes), insert into the sorted memtable. Client is acknowledged immediately. On a crash, replay the WAL to rebuild the memtable. When the memtable grows past a limit (e.g., 4 rows in this animation, 64 MB in RocksDB), flush it as an immutable SSTable to disk (one big sequential write).`,
        `Reads search the memtable first (live data), then each SSTable newest-to-oldest (binary search inside each file). More SSTables = slower reads. Enter compaction: periodically merge N sorted SSTables into one using the merge step of Merge Sort. Deleted keys (marked with tombstones) and old versions are dropped during compaction. Result: fewer SSTables, faster reads.`,
        `Levels: production systems (RocksDB, LevelDB) organize SSTables in levels. Level 0 (freshest) can have multiple tables; Level 1 is a single merged table; Level 2 is another merged table. Compaction promotes tables downward, keeping read latency logarithmic in total data size.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Write: O(log M) where M is memtable size (insertion into a sorted array), plus O(1) append to the WAL. After flush: O(L log L) to flush L items to disk sequentially.`,
        `Read: O(log M) in the memtable plus O(log T × K) to search K SSTables (binary search per table). Bloom filters cut this—if a filter says the key is NOT in an SSTable, skip it.`,
        `Compaction: O(n log n) to merge n keys across tables, spread over background time. The win: writes are O(log M), not O(log N) random seeks per write.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Cassandra uses LSM trees: every write hits the commit log and memtable instantly (millions per second), then flushes to SSTables asynchronously. Reads consult Bloom Filters to skip SSTables. RocksDB (embedded in many databases: Kafka, MyRocks for MySQL, Fuchsia) uses LSM with a 6-level hierarchy by default.`,
        `LevelDB (originally Google's embedded database, now a reference implementation) popularized LSM design. HBase (Hadoop's database) is built on LSM. Every embedded database optimizing for write throughput uses LSM or a variant.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `"LSM trees are only for write-heavy workloads." — Partly true. Read-heavy workloads suffer if Bloom Filters miss (hitting disk). But with good filters and low SSTable counts, reads stay competitive with B-trees.`,
        `"Compaction is free." — Wrong. Compaction eats disk I/O and CPU, which can stall user writes. RocksDB's compaction threads compete with the write memtable; tuning the background workload is critical.`,
        `"The memtable limit of 4 is typical." — Wrong. RocksDB defaults to 64 MB; Cassandra to 128 MB. Small limits flush more often (more SSTables, slower reads). Large limits need more RAM. Trade-off.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Learn Merge Sort to understand the merge operation that makes compaction efficient. Study Hash Table and Bloom Filter to see how reads skip SSTables. Explore Consistent Hashing to learn which SERVER owns each key (LSM handles the data structure on one server; Consistent Hashing spreads keys across servers). Finally, examine B-Tree to compare the in-place update strategy that LSM trees abandoned.`,
      ],
    },
  ],
};

