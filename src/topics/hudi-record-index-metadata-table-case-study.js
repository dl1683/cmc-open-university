// Apache Hudi record index: metadata-table-backed key-to-location mapping,
// sharded file groups, global versus partitioned uniqueness, and upsert lookup.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'hudi-record-index-metadata-table-case-study',
  title: 'Hudi Record Index Metadata Table Case Study',
  category: 'Systems',
  summary: 'A Hudi indexing case study: the metadata-table record index maps record keys to file locations so large upsert/delete workloads avoid expensive table-wide lookup joins.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['record lookup path', 'global versus partitioned'], defaultValue: 'record lookup path' },
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

function recordIndexGraph(title) {
  return graphState({
    nodes: [
      { id: 'writer', label: 'writer', x: 0.7, y: 3.5, note: 'upsert' },
      { id: 'key', label: 'key', x: 2.2, y: 2.0, note: 'record id' },
      { id: 'hash', label: 'hash', x: 3.8, y: 2.0, note: 'shard' },
      { id: 'meta', label: 'metadata', x: 5.4, y: 3.5, note: 'table' },
      { id: 'rli', label: 'record idx', x: 7.0, y: 2.0, note: 'key->loc' },
      { id: 'fg', label: 'file group', x: 7.0, y: 5.0, note: 'target' },
      { id: 'write', label: 'write', x: 8.8, y: 3.5, note: 'update' },
    ],
    edges: [
      { id: 'e-writer-key', from: 'writer', to: 'key' },
      { id: 'e-key-hash', from: 'key', to: 'hash' },
      { id: 'e-hash-meta', from: 'hash', to: 'meta' },
      { id: 'e-meta-rli', from: 'meta', to: 'rli' },
      { id: 'e-rli-fg', from: 'rli', to: 'fg' },
      { id: 'e-fg-write', from: 'fg', to: 'write' },
      { id: 'e-write-meta', from: 'write', to: 'meta' },
    ],
  }, { title });
}

function lookupPlot(title) {
  return plotState({
    axes: { x: { label: 'table size', min: 0, max: 100 }, y: { label: 'lookup cost', min: 0, max: 100 } },
    series: [
      { id: 'join', label: 'join', points: [{ x: 10, y: 18 }, { x: 30, y: 42 }, { x: 60, y: 78 }, { x: 100, y: 96 }] },
      { id: 'rli', label: 'RLI', points: [{ x: 10, y: 12 }, { x: 30, y: 15 }, { x: 60, y: 18 }, { x: 100, y: 22 }] },
    ],
    markers: [
      { id: 'scale', x: 60, y: 18, label: 'scale' },
    ],
  }, { title });
}

function* recordLookupPath() {
  yield {
    state: recordIndexGraph('Record index maps incoming keys to existing file locations'),
    highlight: { active: ['writer', 'key', 'hash', 'meta', 'rli', 'fg'], found: ['write'] },
    explanation: 'For an upsert, Hudi must know whether the incoming record already exists and which file group should receive the update. The record index stores record-key to location mappings in the metadata table.',
    invariant: 'Fast upserts need a key-location index; otherwise writers must rediscover locations from table data.',
  };

  yield {
    state: labelMatrix(
      'Index entry',
      [
        { id: 'key', label: 'key' },
        { id: 'part', label: 'part' },
        { id: 'fg', label: 'fg' },
        { id: 'slice', label: 'slice' },
        { id: 'ts', label: 'ts' },
      ],
      [
        { id: 'val', label: 'val' },
        { id: 'use', label: 'use' },
      ],
      [
        ['u:42', 'lookup'],
        ['dt=15', 'scope'],
        ['fg17', 'write'],
        ['s9', 'merge'],
        ['101', 'fresh'],
      ],
    ),
    highlight: { active: ['key:val', 'fg:use', 'slice:use'], compare: ['ts:use'] },
    explanation: 'The logical entry is a compact locator: record key, partition if needed, file group or file id, slice/version metadata, and freshness information used by the writer.',
  };

  yield {
    state: recordIndexGraph('Hash sharding keeps the metadata-table index scalable'),
    highlight: { active: ['key', 'hash', 'meta', 'e-key-hash', 'e-hash-meta'], compare: ['fg'] },
    explanation: 'Hudi documentation describes hash-based sharding of the record-index key space. The goal is to avoid one giant lookup structure that becomes the new bottleneck.',
  };

  yield {
    state: lookupPlot('Record index avoids table-wide lookup growth'),
    highlight: { active: ['rli', 'scale'], compare: ['join'] },
    explanation: 'A join against table files can grow with table size. A maintained record index adds write-side maintenance cost, but lookup latency can remain much flatter for large upsert-heavy tables.',
  };
}

function* globalVersusPartitioned() {
  yield {
    state: labelMatrix(
      'Index variants',
      [
        { id: 'global', label: 'global' },
        { id: 'part', label: 'part' },
        { id: 'bloom', label: 'bloom' },
        { id: 'simple', label: 'simple' },
      ],
      [
        { id: 'uniq', label: 'uniq' },
        { id: 'scope', label: 'scope' },
        { id: 'fit', label: 'fit' },
      ],
      [
        ['table', 'all', 'moves'],
        ['part', 'one', 'scale'],
        ['part', 'files', 'cheap'],
        ['part', 'join', 'base'],
      ],
    ),
    highlight: { active: ['global:uniq', 'part:scope'], compare: ['simple:fit', 'bloom:fit'] },
    explanation: 'Global record index enforces one key across the table. Partitioned record index scopes uniqueness to partition path plus key, which can speed lookup for very large partitioned datasets.',
  };

  yield {
    state: recordIndexGraph('Partitioned lookup narrows the key-space before sharding'),
    highlight: { active: ['key', 'hash', 'meta', 'rli'], found: ['fg'], compare: ['writer'] },
    explanation: 'A partitioned index can use the incoming partition to limit lookup. That sacrifices global uniqueness but reduces the space a writer has to search for each key.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'skew', label: 'skew' },
        { id: 'move', label: 'move' },
        { id: 'lag', label: 'lag' },
        { id: 'size', label: 'size' },
      ],
      [
        { id: 'sym', label: 'sym' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['hot shard', 'rebalance'],
        ['new part', 'policy'],
        ['stale loc', 'commit'],
        ['big fg', 'compact'],
      ],
    ),
    highlight: { active: ['skew:guard', 'lag:guard', 'size:guard'], compare: ['move:sym'] },
    explanation: 'The index is a data product inside the table. It needs shard sizing, metadata compaction, freshness checks, and clear policy for records that move partitions.',
  };

  yield {
    state: labelMatrix(
      'Operational choice',
      [
        { id: 'cdc', label: 'CDC' },
        { id: 'bi', label: 'BI' },
        { id: 'huge', label: 'huge' },
        { id: 'small', label: 'small' },
      ],
      [
        { id: 'pick', label: 'pick' },
        { id: 'why', label: 'why' },
      ],
      [
        ['global', 'dedup'],
        ['none', 'append'],
        ['part', 'narrow'],
        ['bloom', 'simple'],
      ],
    ),
    highlight: { active: ['cdc:pick', 'huge:pick'], compare: ['bi:pick'] },
    explanation: 'Index choice follows workload. CDC and upserts need fast key lookup. Append-only BI tables may not need record indexing at all. Large partitioned tables often prefer scoped lookup.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'record lookup path') yield* recordLookupPath();
  else if (view === 'global versus partitioned') yield* globalVersusPartitioned();
  else throw new InputError('Pick a Hudi record-index view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a key-location lookup path for mutable lakehouse files. Active nodes are the incoming record keys or metadata-table shards being queried, visited nodes have already been checked for a mapping, and found nodes are file groups that can receive the update or delete. The safe inference is that an upsert can be routed without scanning the whole data table only when the index and Hudi timeline agree.',
        {type:'callout', text:'The record index moves upsert routing from repeated table scans into commit-aligned metadata that can be maintained with the table.'},
      ],
    },
    { heading: 'Why this exists', paragraphs: [
      'Apache Hudi is a lakehouse table format for data in files, but many Hudi tables are not append-only. Change-data-capture streams send updates and deletes keyed by customer id, order id, or account id. A writer receiving key 42 must know whether key 42 already exists and which partition and file group currently hold it.',
      'Object storage is good at reading and writing large files, not at probing billions of rows one key at a time. Without an index, every micro-batch has to rediscover old record locations from the historical table. The record index exists so the write path pays for maintained metadata instead of repeated broad lookup.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The first approach is to append every event and let readers deduplicate later. That keeps writes simple and works for logs, but it pushes correctness and cost onto every query. Deletes are especially awkward because a later tombstone has to hide earlier data everywhere it appears.',
      'The second approach is to join the incoming batch against the table to find existing records. It is correct if the join sees everything, and it is easy to reason about for small tables. At lakehouse scale it turns a 10,000-row micro-batch into a search over billions of historical rows.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is lookup amplification. Upsert cost should track the incoming batch size and the number of keys being changed, not the total table size. If a table grows from 200 million rows to 20 billion rows while the micro-batch remains 50,000 records, a full-table lookup becomes 100 times more expensive for the same work.',
      'File-level filters, such as Bloom filters, reduce candidates but do not remove the problem. A filter can say a key may be in a file; it does not directly name the current file group. False positives and cross-partition uniqueness still create extra reads, especially when records can move between partitions.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'The core insight is to maintain a key-location map as part of the table metadata. The key is the Hudi record key, and the value is the current location: partition path when needed, file id or file group, and version context tied to the timeline. The writer asks the index where an old record lives before choosing an update or insert path.',
      'Keeping the map inside Hudi metadata matters. An external sidecar database creates a split-brain risk if the file commit succeeds and the index update fails, or the reverse. The metadata table lets the index move with commits, rollbacks, compaction, and clustering.',
    ] },
    { heading: 'How it works', paragraphs: [
      'For each incoming key, the writer hashes the key to a record-index shard in the metadata table. It probes that shard for a mapping. If the mapping exists, the writer routes the update or delete to the current file group; if not, it treats the record as an insert and chooses a new target through the normal write path.',
      'After the data write, the index must be changed in the same table lifecycle. New records get mappings, moved records update mappings, and deleted records remove or invalidate mappings. Rollback logic must undo both data changes and index changes because a stale location can route a future update into the wrong file group.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'The correctness invariant is simple: for any committed instant that is visible to readers and writers, the record index must map each indexed live key to the file group that contains the current version of that key. Writers use the timeline to decide which index state is authoritative. If a commit is inflight or rolled back, its key-location changes are not trusted as final state.',
      'The index is the right data structure because the write path asks exact-key routing questions. Analytical scans ask for columns and predicates, but upsert writers ask where record key K lives. A maintained map answers that question directly and avoids using a scan engine as a key-value lookup system.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'A lookup becomes roughly O(b) for b incoming records, plus metadata-table shard reads and writes. Doubling the historical table from 10 TB to 20 TB should not double the per-batch lookup work if the key distribution and shard sizing remain healthy. The cost moves into index maintenance, metadata-table compaction, and shard skew.',
      'The index adds write amplification because every insert, update, delete, clustering move, or partition correction may touch metadata. It also adds memory and I/O pressure to the metadata table. The behavior to watch is not only average commit time but p95 commit time when hot keys or hot shards concentrate updates.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'The best fit is high-volume CDC into large mutable tables. Customer profiles, orders, accounts, inventory, and entitlement tables often receive a mix of inserts, updates, deletes, and partition corrections. The writer needs stable routing latency even as old data accumulates.',
      'It also fits deletion workflows where the application knows an id and expects the system to find the current row. A privacy deletion by user id should not scan thousands of files if the index can name the relevant file group. Append-only telemetry, clickstream logs, and immutable audit tables usually do not need this index because their main path is scan and append.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'It fails when the workload does not need exact-key mutation. On append-only tables, the index is extra write cost with no hot-path benefit. Column statistics, partition pruning, clustering, and file sizing matter more for scan-heavy analytical tables.',
      'It can also fail under skew. If a small set of keys receives most updates, the related metadata shards become hot and commit tail latency rises. Partition movement is another trap: if the same logical key can move partitions, the team must choose global indexing or handle moves explicitly, or duplicates can appear in separate partitions.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'Suppose a customer table has 20 billion rows across 80,000 file groups and receives a CDC batch of 50,000 records every minute. A full lookup join that touches even 2 percent of the table reads 400 million rows of candidate state for one minute of updates. With a record index, the writer performs 50,000 key probes against sharded metadata and routes only the changed keys.',
      'Assume 40,000 keys already exist, 8,000 are new, and 2,000 are deletes. The index returns locations for the 40,000 updates and 2,000 deletes, while the 8,000 misses become inserts. After commit, 8,000 new mappings are added, 40,000 existing mappings are confirmed or moved, and 2,000 mappings are removed, so the next batch starts from current metadata instead of rediscovering old files.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources are the Apache Hudi indexes documentation, Hudi metadata indexing documentation, and the Hudi record-level index design material. Study the Hudi timeline and file-group model next because the index is only correct when it is interpreted through commit state. Then compare Bloom filters, LSM compaction, Debezium CDC, and RocksDB version metadata to see the same tradeoff between maintained lookup state and repeated scans.',
    ] },
  ],
};