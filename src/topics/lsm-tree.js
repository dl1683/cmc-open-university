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
    {heading: 'How to read the animation', paragraphs: ['Read the animation as the lifecycle of a write. A key first enters the memtable, the sorted in-memory table, then the full memtable flushes to disk as an immutable sorted file called an SSTable.', 'The final merge is compaction. It reads sorted files as streams and writes a cleaner sorted output without changing the logical key-value map.', {type: 'callout', text: 'An LSM tree makes the foreground write path cheap by turning random updates into append, flush, and merge work that can be scheduled later.'}, {type: 'image', src: './assets/gifs/lsm-tree.gif', alt: 'Animated walkthrough of the lsm tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'}]},
    {heading: 'Why this exists', paragraphs: ['Some databases receive many small writes: events, metrics, counters, logs, and key-value updates. Updating old disk pages in place makes those writes random and expensive.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/LSM_Tree.png/800px-LSM_Tree.png', alt: 'LSM tree diagram with a memtable, immutable memtable, SSTables, and levels', caption: 'The LSM layout separates memory writes, flushed sorted files, and compaction levels. Source: Wikimedia Commons, LSM Tree image.'}, 'A Log-Structured Merge tree, or LSM tree, changes the foreground path. It appends a recovery record, updates memory, flushes sorted files, and merges those files later.']},
    {heading: 'The obvious approach', paragraphs: ['The usual ordered storage structure is a B-tree. A write finds the target leaf page, updates it, and keeps the tree balanced.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/B-tree.svg/800px-B-tree.svg.png', alt: 'B-tree diagram with sorted keys packed into wide internal nodes', caption: 'A B-tree keeps search paths shallow by packing many separator keys into each page-sized node. Source: Wikimedia Commons, CyHawk, CC BY-SA 3.0 or GFDL.'}, 'B-trees are excellent for read-heavy workloads. Their weakness is that many small writes become scattered page reads and rewrites on the foreground path.']},
    {heading: 'The wall', paragraphs: ['An append-only log makes writes cheap but is not a good index. To read key 42, a raw log may need to scan history until it finds the newest value.', 'A B-tree indexes well but rewrites old pages. The wall is getting both fast foreground writes and ordered lookup without making every write pay random I/O immediately.']},
    {heading: 'The core insight', paragraphs: ['Separate logical update from physical cleanup. The write path records the new value cheaply now, while background compaction later reorganizes sorted files for reads and space.', 'The LSM tree is therefore multi-version by location. The same key may exist in memory and several SSTables, and newest-to-oldest search order gives duplicates their meaning.']},
    {heading: 'How it works', paragraphs: ['A write appends to the write-ahead log for crash recovery, then inserts into the memtable. The client can be acknowledged without reading or rewriting the old disk page.', 'When the memtable reaches a threshold, it freezes and flushes as a sorted SSTable. Reads check the active memtable, immutable memtables, and then SSTables from newest to oldest, often using Bloom filters to skip files that definitely lack the key.', 'Compaction merges SSTables like merge sort. It keeps the newest visible value, preserves needed tombstones, drops obsolete versions when safe, and writes new sorted files.']},
    {heading: 'Why it works', paragraphs: ['Crash safety comes from the write-ahead log. If the process dies after acknowledging a write but before flush, recovery replays the log to rebuild memory state.', 'Read correctness comes from search order. Newer structures are checked before older ones, so an old value cannot override a newer value or a tombstone.', 'Compaction is safe because sorted merge preserves key order and version choice. It changes physical layout while preserving the newest visible state for every key.']},
    {heading: 'Cost and complexity', paragraphs: ['Foreground writes are usually one log append plus an in-memory ordered insert, often O(log M) for M memtable entries. The behavioral win is sequential I/O on the user-facing path.', 'The tax is amplification. Write amplification comes from rewriting bytes during compaction, read amplification comes from checking multiple structures, and space amplification comes from old versions and tombstones waiting for cleanup.']},
    {heading: 'Real-world uses', paragraphs: ['LSM trees fit write-heavy storage engines such as LevelDB, RocksDB, Cassandra, HBase, Kafka Streams state stores, and Flink state backends. They are strongest when sequential writes and batched merges beat scattered page rewrites.', 'They also fit ingest-now-query-later systems. Metrics stores can accept bursts as flushed sorted files, then compact them while filters and indexes protect reads from irrelevant files.']},
    {heading: 'Where it fails', paragraphs: ['An LSM tree does not make writes free. It moves rewrite work to compaction, and if compaction falls behind, reads slow down, disk grows, and writes may stall.', 'A mostly read-heavy workload over stable data may prefer a B-tree. It avoids many files, merge iterators, Bloom-filter false positives, and compaction tuning.']},
    {heading: 'Worked example', paragraphs: ['Suppose write(42, alice), then write(42, bob), then delete(42). After flushes, older SSTables may hold alice and bob, while the newest structure holds a tombstone.', 'A read checks newest first and returns not found when it sees the tombstone. During compaction, the merge can drop alice and bob, keep the tombstone until it is safe, and eventually remove the tombstone too.']},
    {heading: 'Sources and study next', paragraphs: ['Read ONeil, Cheng, Gawlick, and ONeil 1996 for the LSM-tree paper, plus Rosenblum and Ousterhout 1992 for log-structured storage. Study merge sort, Bloom filters, skip lists, SSTables, write-ahead logs, tombstones, compaction strategies, and B-trees next.']},
  ],
};
