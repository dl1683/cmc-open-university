// LSM tombstones and range deletes: delete markers, range tombstone meta-blocks,
// snapshots, replica grace windows, read amplification, and compaction cleanup.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'lsm-tombstone-range-delete-case-study',
  title: 'LSM Tombstones & Range Deletes',
  category: 'Systems',
  summary: 'A delete-path case study: point tombstones, range tombstones, WAL logging, SST meta-blocks, snapshot safety, replica grace, and compaction cleanup.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['range delete', 'cleanup safety'], defaultValue: 'range delete' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function rangeGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'delete', label: 'del', x: 0.55, y: 4.0, note: notes.delete ?? '[a,z)' },
      { id: 'wal', label: 'WAL', x: 2.0, y: 2.4, note: notes.wal ?? 'log' },
      { id: 'mem', label: 'range mem', x: 2.0, y: 5.6, note: notes.mem ?? 'tomb' },
      { id: 'sst', label: 'SST', x: 4.0, y: 4.0, note: notes.sst ?? 'meta-block' },
      { id: 'read', label: 'read', x: 5.9, y: 2.4, note: notes.read ?? 'check' },
      { id: 'iter', label: 'iter', x: 5.9, y: 5.6, note: notes.iter ?? 'skip' },
      { id: 'compact', label: 'compact', x: 7.7, y: 4.0, note: notes.compact ?? 'merge/drop' },
      { id: 'space', label: 'space', x: 9.2, y: 4.0, note: notes.space ?? 'reclaim' },
    ],
    edges: [
      { id: 'e-delete-wal', from: 'delete', to: 'wal', weight: '' },
      { id: 'e-delete-mem', from: 'delete', to: 'mem', weight: '' },
      { id: 'e-mem-sst', from: 'mem', to: 'sst', weight: '' },
      { id: 'e-sst-read', from: 'sst', to: 'read', weight: '' },
      { id: 'e-sst-iter', from: 'sst', to: 'iter', weight: '' },
      { id: 'e-sst-compact', from: 'sst', to: 'compact', weight: '' },
      { id: 'e-compact-space', from: 'compact', to: 'space', weight: '' },
    ],
  }, { title });
}

function cleanupGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'old', label: 'old', x: 0.7, y: 3.0, note: notes.old ?? 'value@5' },
      { id: 'tomb', label: 'tomb', x: 0.7, y: 5.0, note: notes.tomb ?? 'del@9' },
      { id: 'snap', label: 'snap', x: 2.7, y: 2.2, note: notes.snap ?? 'reader' },
      { id: 'replica', label: 'replica', x: 2.7, y: 5.8, note: notes.replica ?? 'maybe down' },
      { id: 'grace', label: 'grace', x: 4.8, y: 4.0, note: notes.grace ?? 'wait' },
      { id: 'compact', label: 'compact', x: 6.8, y: 4.0, note: notes.compact ?? 'same run' },
      { id: 'drop', label: 'drop', x: 8.7, y: 4.0, note: notes.drop ?? 'safe' },
    ],
    edges: [
      { id: 'e-old-grace', from: 'old', to: 'grace', weight: '' },
      { id: 'e-tomb-grace', from: 'tomb', to: 'grace', weight: '' },
      { id: 'e-snap-grace', from: 'snap', to: 'grace', weight: '' },
      { id: 'e-replica-grace', from: 'replica', to: 'grace', weight: '' },
      { id: 'e-grace-compact', from: 'grace', to: 'compact', weight: '' },
      { id: 'e-compact-drop', from: 'compact', to: 'drop', weight: '' },
    ],
  }, { title });
}

function* rangeDelete() {
  yield {
    state: labelMatrix(
      'Deleting a range one key at a time',
      [
        { id: 'scan', label: 'scan' },
        { id: 'point', label: 'pt del' },
        { id: 'iter', label: 'iter' },
        { id: 'space', label: 'spc' },
      ],
      [
        { id: 'cost', label: 'cost' },
        { id: 'problem', label: 'risk' },
      ],
      [
        ['range', 'slow'],
        ['many', 'drag'],
        ['tombs', 'skip'],
        ['dead', 'cmpct'],
      ],
    ),
    highlight: { active: ['scan:cost', 'point:problem'], compare: ['space:problem'] },
    explanation: 'The first table shows the naive approach: scan the range and write a point tombstone per key. That makes delete a large write job and leaves future iterators dragging through many markers.',
    invariant: 'Deletes in an LSM are writes first; space disappears later.',
  };

  yield {
    state: rangeGraph('DeleteRange writes one range tombstone', { delete: '[user:0,user:9)', wal: 'atomic', mem: 'range tomb', sst: 'flush' }),
    highlight: { active: ['delete', 'wal', 'mem', 'e-delete-wal', 'e-delete-mem'], found: ['sst'] },
    explanation: 'The range graph shows the better abstraction. DeleteRange writes one interval tombstone, logs it for durability, stores it in range-tombstone memory, and later flushes it into SSTable metadata.',
  };

  yield {
    state: rangeGraph('Reads must check point data and range tombstones', { read: 'covered?', iter: 'skip span', compact: 'later', space: 'not yet' }),
    highlight: { active: ['sst', 'read', 'iter', 'e-sst-read', 'e-sst-iter'], compare: ['space'] },
    explanation: 'The read path is where range deletes charge interest. A lookup or iterator must decide whether the key version is covered by an overlapping interval, and arbitrary ranges are harder than point tombstones.',
  };

  yield {
    state: labelMatrix(
      'Range tombstone lifecycle',
      [
        { id: 'write', label: 'write' },
        { id: 'flush', label: 'flush' },
        { id: 'read', label: 'read' },
        { id: 'compact', label: 'compact' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'goal', label: 'goal' },
      ],
      [
        ['WAL + mem', 'atomic'],
        ['SST meta', 'near data'],
        ['fragment', 'fast cover'],
        ['merge/drop', 'reclaim'],
      ],
    ),
    highlight: { found: ['write:goal', 'flush:state'], active: ['compact:goal'] },
    explanation: 'The lifecycle table explains why range tombstones live near SSTable metadata. Flush and compaction need to carry them with the data they cover so cleanup can happen when the engine can prove old values are gone.',
  };

  yield {
    state: rangeGraph('Compaction is where delete markers finally pay off', { compact: 'bottom?', space: 'drop old', read: 'less work', iter: 'cleaner' }),
    highlight: { active: ['compact', 'space', 'e-compact-space'], found: ['read', 'iter'] },
    explanation: 'The final range-delete graph separates logical delete from physical cleanup. The data disappears from reads immediately, but disk space returns only after compaction can drop the covered data and obsolete tombstone metadata.',
  };
}

function* cleanupSafety() {
  yield {
    state: cleanupGraph('A tombstone hides older values until cleanup is safe'),
    highlight: { active: ['old', 'tomb', 'grace', 'e-old-grace', 'e-tomb-grace'], compare: ['drop'] },
    explanation: 'The cleanup graph starts with the safety rule. A tombstone hides older values, but the engine cannot always drop it when it sees it. Old snapshots or replicas may still need the marker to prevent deleted data from reappearing.',
    invariant: 'Dropping a tombstone too early can make deleted data reappear.',
  };

  yield {
    state: labelMatrix(
      'Cassandra tombstone safety',
      [
        { id: 'delete', label: 'delete' },
        { id: 'grace', label: 'grace' },
        { id: 'repair', label: 'repair' },
        { id: 'purge', label: 'purge' },
      ],
      [
        { id: 'purpose', label: 'purpose' },
        { id: 'risk' , label: 'risk' },
      ],
      [
        ['mark value', 'extra reads'],
        ['wait nodes', 'disk cost'],
        ['sync delete', 'late repair'],
        ['drop marker', 'zombies'],
      ],
    ),
    highlight: { active: ['grace:purpose', 'repair:purpose'], compare: ['purge:risk'] },
    explanation: 'The Cassandra table shows distributed delete safety. gc_grace_seconds keeps tombstones around long enough for failed replicas and repair to learn the delete before compaction purges the marker.',
  };

  yield {
    state: cleanupGraph('Snapshots and replicas can block tombstone purge', { snap: 'old read', replica: 'offline', grace: 'blocked', compact: 'cannot drop', drop: 'wait' }),
    highlight: { active: ['snap', 'replica', 'grace', 'compact', 'e-snap-grace', 'e-replica-grace', 'e-grace-compact'], removed: ['drop'] },
    explanation: 'The blocked-cleanup graph shows why "compaction saw it" is not enough. If an old snapshot or replica-grace rule can still observe older data, compaction must keep the tombstone visible.',
  };

  yield {
    state: labelMatrix(
      'When compaction can purge',
      [
        { id: 'age', label: 'age' },
        { id: 'covered', label: 'covered data' },
        { id: 'snapshot', label: 'snapshot' },
        { id: 'repair', label: 'repair' },
      ],
      [
        { id: 'condition', label: 'condition' },
        { id: 'outcome', label: 'outcome' },
      ],
      [
        ['past grace', 'eligible'],
        ['same run', 'drop both'],
        ['none old', 'safe view'],
        ['replicas ok', 'no zombie'],
      ],
    ),
    highlight: { found: ['covered:outcome', 'snapshot:outcome'], active: ['age:condition'] },
    explanation: 'The purge table is the exact cleanup test. A tombstone can go away only when it has met the covered data, no old reader still needs the old view, and replica safety rules no longer require the marker.',
  };

  yield {
    state: labelMatrix(
      'Operational symptoms',
      [
        { id: 'reads', label: 'reads' },
        { id: 'range', label: 'range scan' },
        { id: 'space', label: 'space amp' },
        { id: 'repair', label: 'repair' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'response', label: 'response' },
      ],
      [
        ['many skips', 'model keys'],
        ['slow iter', 'range tombs'],
        ['dead bytes', 'compact'],
        ['zombie risk', 'fix grace'],
      ],
    ),
    highlight: { active: ['reads:symptom', 'space:response'], found: ['repair:response'] },
    explanation: 'The symptom table maps user pain to causes. Tombstone trouble may look like slow reads, iterator stalls, disk bloat, or zombie data. Fixes range from better keys and TTLs to repair discipline and native range deletes.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'range delete') yield* rangeDelete();
  else if (view === 'cleanup safety') yield* cleanupSafety();
  else throw new InputError('Pick a tombstone view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        `A tombstone is a deletion record. In a log-structured merge tree, old data usually lives inside immutable sorted-string tables, so a delete cannot reach into every old file and erase bytes in place. The storage engine writes a newer record that says the older value is no longer visible. Reads must treat that marker as part of the version history, and compaction later removes both the marker and the data it shadows when it is safe.`,
        `A range tombstone is the same idea applied to an interval of keys. Instead of writing one delete marker for every key under a tenant prefix, time window, table id, or shard range, the engine writes one versioned interval such as delete every key in [a, z). That makes the delete cheap to issue, but it creates a harder read and cleanup problem: every future lookup, scan, and compaction has to know whether a key version is covered by a newer interval.`,
        {type:'callout', text:`Range tombstones turn deletion into versioned interval metadata so reads become correct immediately while compaction earns the disk space back later.`},
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        `The obvious approach is scan and delete. Open an iterator on the range, visit every key, and write a point tombstone for each one. That is easy to explain and uses the same delete path as ordinary key deletion. It is also not a foolish baseline. It preserves the normal write-ahead log, sequence-number, snapshot, and compaction rules of the database.`,
        `The wall is that the range delete has become a large read job and a large write job. The engine must read keys only to learn which tombstones to write. The result may be millions of markers that slow future reads and iterators. A compaction filter can remove keys later, but then the delete is not immediately visible to readers. A forced compaction can reclaim space, but it may wait behind other work and can rewrite a large amount of data. The missing abstraction is an interval delete with the same crash and visibility guarantees as a normal write.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is to make deletion a versioned data structure instead of an immediate erasure. A range tombstone is a record with a start key, end key, and sequence number. It says that older versions inside the interval are hidden from any reader whose snapshot is new enough to see the tombstone. That keeps the logical delete synchronous while leaving physical cleanup to compaction.`,
        `The second insight is placement. Range tombstones need to travel with the LSM files and levels they affect. RocksDB puts flushed range tombstones in a separate SSTable meta-block rather than interleaving them with point data or storing them only in a global manifest. That lets flush, open-file logic, reads, and compaction reason about interval metadata near the files whose keys it may cover.`,
      ],
    },
    {
      heading: 'Mechanism and data structures',
      paragraphs: [
        `On the write path, a native range delete goes through the same durability boundary as other writes. The operation is appended to the write-ahead log, applied to an in-memory range-tombstone structure, and later flushed with the related memtable into an SST file. RocksDB's design uses a dedicated range-tombstone memtable and a range-tombstone meta-block in the SST. The common case is cheap because there are usually few active range tombstones in memory.`,
        `On the read path, the engine compares candidate point versions with visible range tombstones. A point lookup asks whether the found key is covered by a newer tombstone. An iterator has a larger problem because it walks spans, not one key. Older designs built a skyline of overlapping range tombstones, where the x-axis is key order and the y-axis is sequence number. Newer designs fragment tombstones locally so fragments do not overlap and can be ordered by start key. That makes coverage checks searchable and cacheable.`,
        `On the compaction path, the engine merges point data and tombstone metadata from several inputs. If a tombstone covers an older key version in the same compaction run, the output can drop the old value. If the tombstone has reached the part of the tree where no older covered values can survive, the tombstone itself may become obsolete. This is why delete space is reclaimed later: compaction is the first process that sees enough of the version history to erase safely.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The correctness rule is visibility by sequence number. A reader has a snapshot sequence. A point value has a sequence. A range tombstone also has a sequence. If the tombstone is visible to the reader and is newer than the value it covers, the value must not be returned. If the reader's snapshot predates the tombstone, the old value may still be visible. This is the same MVCC idea used for point updates, extended from one key to an interval.`,
        `Cleanup is safe only when no legitimate observer can still need the old arrangement. A local engine must respect snapshots and long-lived iterators. A replicated engine has another clock: every replica that might still hold old data must learn the delete before the marker is purged. Cassandra's tombstone grace period exists to prevent a down replica from later repairing deleted data back into the cluster. A tombstone that looks useless to one compaction may still be the only evidence that a value was deleted.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `A range tombstone makes the delete request small. It avoids reading every key in the interval and avoids writing one marker per key. In RocksDB, inserting a buffered range tombstone is logarithmic in the number of buffered range tombstones, not in the number of keys being deleted. That is the win.`,
        `The tax moves to reads, iterators, memory, and compaction. A point lookup may need to consult range-tombstone metadata before it trusts a point value. A range scan may need to advance through tombstone fragments as well as point keys. Compaction has to carry, split, merge, and eventually drop interval metadata. Space amplification can remain high until the right compaction runs. Delete is therefore not free; it is paid over time by the parts of the engine that maintain the version history.`,
      ],
    },
    {
      heading: 'Where it is useful and where it fails',
      paragraphs: [
        `Range tombstones fit workloads where the delete is naturally an interval: dropping a table prefix in a key-value-backed SQL engine, removing a tenant, cleaning data that moved to another shard, deleting a time window, expiring a partition, or removing all records under a product or account id. The access pattern matters. If the delete covers many keys and users need the range to disappear from reads immediately, native range deletion is much better than an external cleanup loop.`,
        `It is the wrong tool when the deleted set is not a contiguous key range, when queries are dominated by long scans through heavily tombstoned regions, or when the operational team cannot keep compaction and repair healthy. A bad key schema can make range deletes useless because the records that should die together are not adjacent. A long grace window protects correctness but keeps dead data around. A short grace window can reduce disk use while increasing the chance of resurrected data if repair discipline is weak.`,
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        `Watch read latency for tombstone-covered keys, iterator seek time, range-scan p99, number of range tombstones per file, tombstone fragmentation cache hit rate, compaction backlog, space amplification, and the age of the oldest snapshot or iterator. In Cassandra-style replicated systems, also watch repair age, nodes down longer than the grace window, tombstone warnings, and fully expired SSTables that remain blocked by older data.`,
        `The useful question is not whether tombstones exist. They are part of the design. The useful question is whether they are accumulating faster than compaction and repair can convert logical deletes into safe physical cleanup.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Primary sources: RocksDB DeleteRange at https://rocksdb.org/blog/2018/11/21/delete-range.html, RocksDB DeleteRange notes at https://github.com/facebook/rocksdb/wiki/DeleteRange, and Apache Cassandra tombstones at https://cassandra.apache.org/doc/latest/cassandra/managing/operating/compaction/tombstones.html. Study LSM Compaction Strategies Primer for cleanup policy, RocksDB MANIFEST and VersionSet for file-version bookkeeping, MVCC Internals and VACUUM for snapshot-safe deletion, Cassandra Repair Case Study for distributed delete safety, and TimeWindow Compaction Strategy for TTL-heavy data next.`,
      ],
    },
  ],
};
