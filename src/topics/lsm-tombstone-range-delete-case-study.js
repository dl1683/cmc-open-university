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
    explanation: 'A naive range delete scans every key and writes a point tombstone for each one. That is expensive on the write path and can leave iterators dragging through many delete markers.',
    invariant: 'Deletes in an LSM are writes first; space disappears later.',
  };

  yield {
    state: rangeGraph('DeleteRange writes one range tombstone', { delete: '[user:0,user:9)', wal: 'atomic', mem: 'range tomb', sst: 'flush' }),
    highlight: { active: ['delete', 'wal', 'mem', 'e-delete-wal', 'e-delete-mem'], found: ['sst'] },
    explanation: 'A native range delete records the interval as one logical tombstone. It goes through the write path: logged to the WAL and applied to a range-tombstone memtable before being flushed into SST metadata.',
  };

  yield {
    state: rangeGraph('Reads must check point data and range tombstones', { read: 'covered?', iter: 'skip span', compact: 'later', space: 'not yet' }),
    highlight: { active: ['sst', 'read', 'iter', 'e-sst-read', 'e-sst-iter'], compare: ['space'] },
    explanation: 'A lookup or iterator must know whether the key version is covered by an overlapping tombstone interval. Arbitrary overlapping ranges are harder than point deletes because simple binary search by start or end is not enough.',
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
    explanation: 'RocksDB keeps range tombstones aware of flush and compaction by storing them with SSTable metadata. That lets cleanup happen when compaction can prove the covered data is gone.',
  };

  yield {
    state: rangeGraph('Compaction is where delete markers finally pay off', { compact: 'bottom?', space: 'drop old', read: 'less work', iter: 'cleaner' }),
    highlight: { active: ['compact', 'space', 'e-compact-space'], found: ['read', 'iter'] },
    explanation: 'The delete operation hides data immediately, but compaction reclaims the space. Until then, tombstones are extra metadata that reads, iterators, and compaction have to carry.',
  };
}

function* cleanupSafety() {
  yield {
    state: cleanupGraph('A tombstone hides older values until cleanup is safe'),
    highlight: { active: ['old', 'tomb', 'grace', 'e-old-grace', 'e-tomb-grace'], compare: ['drop'] },
    explanation: 'A point tombstone means "a delete happened at this sequence or timestamp." It hides older values. The engine cannot always drop it immediately, because old snapshots or replicas may still need the delete marker to prevent data resurrection.',
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
    explanation: 'In replicated LSM systems such as Cassandra, gc_grace_seconds is a safety window. It keeps tombstones around long enough for failed replicas and repair workflows to learn the delete.',
  };

  yield {
    state: cleanupGraph('Snapshots and replicas can block tombstone purge', { snap: 'old read', replica: 'offline', grace: 'blocked', compact: 'cannot drop', drop: 'wait' }),
    highlight: { active: ['snap', 'replica', 'grace', 'compact', 'e-snap-grace', 'e-replica-grace', 'e-grace-compact'], removed: ['drop'] },
    explanation: 'A compaction may see a tombstone and the old value it covers, but still keep the tombstone if a snapshot or replica grace rule says the delete marker must remain visible.',
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
    explanation: 'A tombstone is useful only while it can still suppress an older value somewhere. Cleanup needs the right compaction inputs plus the right safety conditions.',
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
    explanation: 'Tombstone problems often look like read latency, iterator stalls, disk bloat, or data resurrection bugs. The fix may be key design, TTL design, compaction strategy, repair discipline, or native range deletes.',
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
        'A tombstone is a delete marker in an LSM storage engine. Because SSTables are immutable, deleting a key usually does not remove old bytes immediately. Instead, the engine writes a newer marker saying the old value should no longer be visible. Compaction later removes the marker and the covered values when it is safe.',
        'Range deletes generalize that idea from one key to an interval. Instead of scanning a range and writing thousands or millions of point tombstones, a native range-delete operation writes one interval tombstone and lets reads and compaction account for it.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'In RocksDB DeleteRange, the range tombstone goes through the write path. It is logged to the WAL, placed in a range-tombstone memtable, and flushed with data into an SSTable range tombstone meta-block. Reads and iterators check whether their key or span is covered by relevant tombstones.',
        'Compaction is the cleanup mechanism. It can merge tombstone metadata, drop covered data, and eventually remove obsolete tombstones once no older values can reappear below them.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Deletes reduce logical data immediately but often increase physical work temporarily. Tombstones consume space, slow scans, complicate iterators, and increase compaction work. Range tombstones reduce write-path cost for prefix or interval deletes, but they introduce interval-overlap logic on the read path.',
      ],
    },
    {
      heading: 'Real-world case study',
      paragraphs: [
        'RocksDB introduced DeleteRange because scan-and-delete was slow, created many tombstones, and did not give predictable space reclamation. Cassandra keeps tombstones for a grace window so replicas that missed a delete can learn it before compaction purges the marker. Both examples show that delete correctness is distributed in time.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The main misconception is that delete means immediate physical removal. In an LSM, delete usually means a newer marker. Another mistake is lowering tombstone grace without understanding repair and replica failure windows; that can resurrect deleted data.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RocksDB DeleteRange blog at https://rocksdb.org/blog/2018/11/21/delete-range.html, RocksDB DeleteRange wiki at https://github.com/facebook/rocksdb/wiki/DeleteRange, RocksDB DeleteRange implementation notes at https://github.com/facebook/rocksdb/wiki/DeleteRange-Implementation, and Apache Cassandra tombstone docs at https://cassandra.apache.org/doc/latest/cassandra/managing/operating/compaction/tombstones.html. Study LSM Compaction Strategies Primer, RocksDB MANIFEST & VersionSet, Cassandra Repair Case Study, MVCC Internals & VACUUM, and Backpressure & Flow Control next.',
      ],
    },
  ],
};
