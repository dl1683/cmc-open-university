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
      heading: 'What it is',
      paragraphs: [
        'Apache Hudi record index is a metadata-table-backed key-location index. It stores mappings from record keys to table locations so writers can locate existing records quickly during upserts and deletes.',
        'This deepens Apache Hudi Timeline & File Groups Case Study. The earlier module explains file groups and timelines. This module explains how writers find the right file group without scanning or joining against the whole table.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'An incoming record carries a key. The writer uses the record index partition in Hudi metadata table to map that key to a location such as partition and file group. The update can then target the right file group or create a new record when no mapping exists.',
        'To scale, the record index shards the key space. Hudi supports a global record index for table-wide key uniqueness and a partitioned record index for uniqueness within partition path plus record key.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The important structures are record keys, hash shards, metadata-table partitions, file-group locators, partition paths, commit freshness markers, index file groups, and compaction state for the index itself.',
        'This is a classic index tradeoff. Maintaining the index costs writes and metadata storage, but it can avoid expensive global joins or Bloom-filter probes when upsert volume dominates.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A CDC pipeline updates a 20-billion-row customer table. Each event contains customer_id. Without a record index, the writer has to discover which file group contains that key, often through joins, Bloom filters, or broad table metadata scans. With the record index, the writer hashes customer_id, probes the metadata-table shard, finds the file group, and writes the update there.',
        'A second table is append-only telemetry queried by dashboards. It has no upserts and does not need table-wide key uniqueness. Record indexing would add maintenance cost without solving the hot path.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A record index is not free and not automatically the right choice. It must be maintained, compacted, and sized. Hot keys, skewed shards, stale mappings, and partition moves can all damage write latency or correctness if policy is unclear.',
        'Another misconception is that global uniqueness is always better. Global indexes provide stronger semantics, but partitioned indexes can be faster and cheaper when the application already scopes keys by partition.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Hudi indexes documentation at https://hudi.apache.org/docs/indexes/ and Hudi Record Level Index blog at https://hudi.apache.org/blog/2023/11/01/record-level-index/. Study Apache Hudi Timeline & File Groups Case Study, LSM Compaction Strategies Primer, Bloom Filter, RocksDB MANIFEST & VersionSet, and Debezium CDC Case Study next.',
      ],
    },
  ],
};
