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
        `An LSM tree, short for Log-Structured Merge tree, is a storage engine design for turning random writes into sequential work. The 1996 O'Neil paper described the core bargain: accept writes into memory quickly, flush immutable sorted runs to disk, and merge those runs later in the background. Cassandra, HBase, LevelDB, and RocksDB use this pattern because disks and SSDs are much better at large sequential writes than at scattered small rewrites.`,
        `The write path has two parts. First append the update to a Write-Ahead Log (WAL) so a crash can replay it. Then insert it into a memtable, often a skip list, tree, or other ordered in-memory structure. When the memtable reaches a threshold such as 64 MB or 128 MB, it becomes immutable and flushes as an SSTable: a sorted string table on disk. The cost is shifted to reads and compaction, not erased.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `A read checks the newest places first: active memtable, immutable memtables waiting to flush, then SSTables from newest to oldest or by level. Each SSTable has an index and usually a Bloom Filter, so the engine can skip files that definitely do not contain the key. If the key appears several times, the newest version wins. Deletes are stored as tombstones until compaction proves older versions can be discarded.`,
        `Compaction is the heart of the design. Background workers merge sorted files using the same linear merge idea as Merge Sort, dropping overwritten values and expired tombstones. Size-tiered compaction groups similarly sized files; leveled compaction keeps most levels non-overlapping to reduce read amplification. This is why an LSM can write fast but still needs careful tuning: too little compaction hurts reads, too much steals I/O from foreground writes.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `A write is O(1) for the log append plus O(log M) or similar for the memtable, where M is active memory state. A point read is O(log M) plus probes into candidate SSTables; filters often make the number of disk probes small. Compaction is linear in the bytes it rewrites for each merge, but the same data may be rewritten many times. That write amplification is the hidden tax. Space amplification comes from old versions and tombstones waiting for compaction.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Cassandra combines token ownership from Consistent Hashing with an LSM storage engine on each node. RocksDB powers MyRocks, Kafka Streams state stores, Flink state backends, and many embedded indexes. LevelDB made the design easy to study; Pebble reimplemented a RocksDB-like engine in Go for CockroachDB. The competing shape is B-Trees (How Databases Read): PostgreSQL and InnoDB update buffered pages and indexes in place, still protected by logs, rather than accumulating immutable runs.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The first misconception is that an LSM never rewrites data. It avoids rewriting on the foreground write path, then rewrites heavily during compaction. The second is that reads are automatically slow. A well-tuned engine with good filters, block cache, and low overlap can serve fast point reads; a neglected one with thousands of SSTables can fall apart. The third is that tombstones are harmless. In Cassandra, a delete may remain visible to compaction for hours or days so replicas can learn it; too many tombstones can make range scans painfully slow.`,
        `Do not confuse the memtable with a Hash Table. Hash structures help membership tests and caches, but sorted order is what makes range scans and merge compaction possible. Also separate LSM mechanics from MVCC Internals & VACUUM: both manage old versions, but LSM compaction is a storage-layout process, while MVCC visibility is a transaction rule.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Read Write-Ahead Log (WAL) for crash recovery, Merge Sort for compaction, and Bloom Filter for read avoidance. Compare against B-Trees (How Databases Read) and Write-Through vs Write-Back to understand why buffering changes the I/O shape. Then connect storage layout to MVCC Internals & VACUUM and Consistent Hashing, which answer different questions: which versions are visible, and which server owns the key.`,
      ],
    },
  ],
};
