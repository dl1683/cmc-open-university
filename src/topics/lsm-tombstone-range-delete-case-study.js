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
    { heading: 'How to read the animation', paragraphs: [
      'Read this as a versioned delete path inside a log-structured merge tree (LSM tree). Active spans show keys or files tested against a tombstone, and found spans show data that is logically hidden or physically reclaimed.',
      {type:'callout', text:`Range tombstones turn deletion into versioned interval metadata so reads become correct immediately while compaction earns the disk space back later.`},
    ] },
    { heading: 'Why this exists', paragraphs: [
      'An LSM tree stores writes in memory, flushes immutable sorted files, and later compacts those files. Because old files are immutable, a delete cannot edit every old byte in place.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is to scan the range and write one point tombstone per key. It reuses the normal delete path and works for small ranges.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is write amplification and delayed cleanup. Deleting 10 million keys by scanning writes 10 million markers, but a compaction-only cleanup would not make the delete immediately visible.',
    ] },    { heading: 'The core insight', paragraphs: [
      'A range tombstone is a versioned interval with start key, end key, and sequence number. It hides older values inside the interval for snapshots that can see the tombstone.',
    ] },
    { heading: 'How it works', paragraphs: [
      'The write path appends the range tombstone to the write-ahead log and stores interval metadata with flushed files. Reads test candidate key versions against visible intervals, and compaction later drops covered values when old snapshots no longer need them.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'The correctness argument is multi-version concurrency control extended from one key to an interval. If the tombstone is visible to a reader and newer than a covered value, that value must not be returned.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'The delete request becomes cheap in the number of keys covered. Cost moves to reads, iterators, memory, and compaction because each lookup or scan may need tombstone coverage checks until cleanup is safe.',
    ] },    { heading: 'Real-world uses', paragraphs: [
      'Range tombstones fit dropping a table prefix, deleting a tenant, expiring a time window, removing a shard range, or cleaning a product namespace. The common need is immediate logical disappearance of many adjacent keys.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'Range tombstones fail when the deleted set is not contiguous in key order. They also hurt scan-heavy workloads through tombstoned regions when compaction, repair, or snapshots keep dead data alive.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'A tenant has 10 million keys under one adjacent prefix. A point-delete loop writes 10 million tombstones; at 40 bytes each before indexing overhead, that is at least 400 MB of markers plus scan work.',
      'A range tombstone writes one interval marker at sequence 900. A reader at sequence 950 hides covered old values, while a reader at sequence 850 can still see them until its snapshot closes.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Study RocksDB DeleteRange at https://rocksdb.org/blog/2018/11/21/delete-range.html, RocksDB DeleteRange notes at https://github.com/facebook/rocksdb/wiki/DeleteRange, and Apache Cassandra tombstones at https://cassandra.apache.org/doc/latest/cassandra/managing/operating/compaction/tombstones.html.',
      'Next, study LSM compaction strategies, sorted-string tables, RocksDB MANIFEST and VersionSet, MVCC internals, Cassandra repair, TimeWindow Compaction Strategy, snapshot isolation, and space amplification.',
    ] },
  ],
};