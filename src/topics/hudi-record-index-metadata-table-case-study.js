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
      heading: 'The problem',
      paragraphs: [
        `Apache Hudi is built for mutable lakehouse tables: upserts, deletes, incremental pulls, and change-data-capture pipelines over files in object storage. That creates a lookup problem. When a new event arrives for customer_id 42, the writer must know whether that record already exists, and if it exists, which partition and file group currently contain it.`,
        `The obvious append-only lake pattern does not answer that question. Appending every event is easy, but then readers must deduplicate later and deletes become slow or ambiguous. Scanning the table to find the old record is also easy to understand, but it collapses at large scale. A 20-billion-row table cannot perform a broad lookup join for every micro-batch and still behave like a real-time upsert system.`,
        `The Hudi record index is a maintained key-location map stored in Hudi's metadata table. It maps record keys to locations so writers can route updates and deletes without rediscovering locations from data files each time. The index moves work from repeated table-wide lookup into maintained metadata.`,
      ],
    },
    {
      heading: 'The naive wall',
      paragraphs: [
        `The first naive approach is a full table join between incoming records and existing table state. That gives correct routing if the join sees everything, but it makes write cost grow with table size. It also fights the storage layout: object stores and columnar files are efficient for scans and appends, not for millions of tiny key probes across old files.`,
        `The second approach is file-level probabilistic lookup, such as Bloom filters. Bloom filters can narrow the candidate files, and they remain useful in some Hudi deployments, but they still often require checking multiple files or partitions. They are a filter, not a direct key-to-location address book. False positives cost work, and global uniqueness across partitions remains expensive.`,
        `The wall is lookup amplification. Upsert pipelines want cost to track the incoming batch, not the historical table. If the table grows 100x but the micro-batch size stays the same, the writer should not become 100x slower just to find previous locations. A record index attacks that wall by keeping the answer current as part of the table's metadata lifecycle.`,
      ],
    },
    {
      heading: 'Core idea',
      paragraphs: [
        `The core idea is familiar from databases: maintain an index when repeated lookup is more expensive than index maintenance. The key is the Hudi record key. The value is a compact location: partition path when relevant, file group or file id, and enough version context for the writer to update the right place under Hudi's timeline semantics.`,
        `Hudi stores this record-level index inside the metadata table, rather than as an external sidecar database. That matters because the index must move with table commits, compaction, clustering, and rollback behavior. If the table says a commit is visible, the index should agree. If a write is rolled back, stale key-location entries must not survive as authoritative truth.`,
        `The record index is sharded so it does not become one giant metadata object. A hash of the record key maps lookup and maintenance work to index file groups. This is the same reason large database indexes are partitioned: the index is a data structure with its own skew, compaction, storage, and concurrency behavior.`,
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        `An incoming write batch carries record keys. For each key, the writer computes the index shard and probes the record-index partition in the metadata table. If a mapping exists, the writer routes the update or delete to the current file group. If no mapping exists, the writer treats the record as an insert and chooses a target according to Hudi's normal write path.`,
        `After the write, the index itself must be updated. New records get new mappings. Updated records may keep the same file group or move depending on clustering, partition changes, and table configuration. Deleted records need their mappings removed or invalidated. The index is therefore part of the write transaction's metadata work, not a passive cache.`,
        `The timeline is the safety rail. Hudi's commits, inflight states, rollbacks, and compaction actions define which table state is visible. The index must be interpreted in that context. A key-location answer without freshness is dangerous because file groups can be compacted, replaced, or reorganized. Correctness requires the index and the table timeline to advance together.`,
      ],
    },
    {
      heading: 'Global and partitioned',
      paragraphs: [
        `Hudi supports a global record index and a partitioned record index. A global index treats the record key as unique across the whole table. That is useful for CDC feeds where customer_id, order_id, or account_id should identify one logical row even if partition fields change. It also helps catch duplicates that would otherwise land in different partitions.`,
        `A partitioned record index scopes uniqueness to partition path plus record key. That can be much cheaper for very large partitioned datasets because the writer can narrow the lookup before probing the index. It is a good fit when application semantics already say that the same key in two partitions is not the same logical entity, or when partition movement is not allowed.`,
        `The tradeoff is semantic, not just performance. Global uniqueness protects against cross-partition duplicates but requires a wider lookup and more global maintenance. Partitioned uniqueness scales better but can miss duplicates across partitions by design. The right choice follows the key contract of the application.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The record index works because it aligns lookup granularity with the write problem. Upsert writers do not need to scan column values for analytical predicates. They need to answer a routing question for a known key. A maintained key-location map is the right data structure for that access pattern.`,
        `It also works because the metadata table keeps the index close to Hudi's own table management. External indexes can be fast, but they create dual-write problems: what happens if the file commit succeeds and the external index update fails, or the reverse? Keeping the index under Hudi's metadata and timeline machinery reduces that split-brain risk.`,
        `Finally, sharding keeps the index from centralizing all pressure. A large upsert workload can distribute index reads and writes across metadata-table file groups. That does not make the index free, but it gives operators scaling knobs: shard sizing, compaction cadence, metadata table resources, and partitioned versus global semantics.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `The best fit is high-volume CDC into a large table. Events arrive with stable record keys, and most batches contain a mix of inserts, updates, and deletes. The writer needs predictable lookup latency even as the historical table grows. The record index keeps the hot path focused on incoming keys and metadata-table shards.`,
        `It also helps workloads with frequent deletes or point updates where file-level filtering would touch too many candidates. If a service needs to delete user data by id, a direct key-location map can reduce the search space dramatically. The index can also improve point-lookup read patterns when the table and query path use the metadata effectively.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `The record index is a poor default for append-only analytical tables. If data is written once and queried mostly by time, partition, or column filters, the index adds write amplification without improving the main path. Column stats, partition pruning, clustering, and file sizing matter more for those tables.`,
        `It can also struggle with skew. If a small set of keys or partitions receives most updates, the corresponding index shards and file groups become hot. Sharding helps only when the key distribution gives it something to spread. Operationally, hot shards show up as uneven metadata-table write cost, compaction pressure, and tail latency in upsert commits.`,
        `Partition movement is another trap. If a record can move from dt=2026-06-16 to dt=2026-06-17 because an event timestamp was corrected, the table needs a clear policy. A global index can find the old location and move the record. A partitioned index may treat the new partition as a separate key unless the application handles the move explicitly.`,
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        `Watch index lookup latency, metadata-table size, index shard skew, commit duration, compaction backlog, rollback frequency, stale-location errors, duplicate-key incidents, and write amplification. Compare record-index performance against Bloom or simple indexing on a real upsert workload, not on an empty table.`,
        `Evaluation should include growth curves. Load a representative table size, replay CDC at expected peak rate, compact and cluster as production would, then measure whether lookup cost stays flat enough. Also test rollback and failed writes. An index that is fast but not transactionally aligned with the table is a correctness liability.`,
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        `A retailer maintains a customer profile table with 20 billion records. Kafka delivers CDC events keyed by customer_id. Some events update attributes, some delete users, and some correct partition fields. Without a record index, the writer performs broad lookup joins or probes many candidate files. As the table grows, commit latency rises even when the incoming batch size is stable.`,
        `The team enables the metadata-table record index. Each incoming customer_id is hashed to an index shard. The writer probes the shard, finds the current file group, and routes the update. New customers get inserted and added to the index. Deletes remove the record and update the mapping. The team chooses global uniqueness because customer_id is a table-wide identity and partition corrections are expected.`,
        `A separate telemetry table stays append-only. It uses time partitions, good file sizing, and column statistics. Record indexing is not enabled there because no upsert path needs it. The lesson is workload specificity: the record index is powerful when key-location lookup is the bottleneck and unnecessary when scans and appends dominate.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Primary sources: Hudi indexes documentation at https://hudi.apache.org/docs/indexes/, Hudi metadata indexing documentation at https://hudi.apache.org/docs/metadata_indexing/, and the Hudi Record Level Index blog at https://hudi.apache.org/blog/2023/11/01/record-level-index/.`,
        `Study Apache Hudi Timeline and File Groups Case Study for the table lifecycle, LSM Compaction Strategies Primer for maintenance economics, Bloom Filter for candidate filtering, RocksDB MANIFEST and VersionSet for versioned metadata, and Debezium CDC Case Study for the upstream event stream that often feeds Hudi upserts.`,
      ],
    },
  ],
};
