// SSTable block layout: immutable sorted data blocks, Bloom/filter metadata,
// index blocks, footer handles, and the point-lookup/range-scan path.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'sstable-block-index-filter-case-study',
  title: 'SSTable Block Index & Filter',
  category: 'Systems',
  summary: 'An immutable sorted-file primer: data blocks, restart points, filter blocks, index entries, metaindex, footer handles, and cache-aware lookups.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['point lookup', 'file layout'], defaultValue: 'point lookup' },
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

function lookupGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'key', label: 'key', x: 0.55, y: 4.0, note: notes.key ?? 'lookup' },
      { id: 'filter', label: 'filter', x: 2.0, y: 2.3, note: notes.filter ?? 'maybe' },
      { id: 'index', label: 'index', x: 3.7, y: 4.0, note: notes.index ?? 'binary' },
      { id: 'cache', label: 'cache', x: 5.35, y: 2.3, note: notes.cache ?? 'block' },
      { id: 'block', label: 'data', x: 6.9, y: 4.0, note: notes.block ?? '4-32KB' },
      { id: 'restart', label: 'rst', x: 8.2, y: 5.8, note: notes.restart ?? 'seek' },
      { id: 'value', label: 'value', x: 9.3, y: 4.0, note: notes.value ?? 'hit/miss' },
      { id: 'footer', label: 'footer', x: 2.0, y: 6.2, note: notes.footer ?? 'handles' },
    ],
    edges: [
      { id: 'e-key-filter', from: 'key', to: 'filter', weight: '' },
      { id: 'e-filter-index', from: 'filter', to: 'index', weight: '' },
      { id: 'e-key-index', from: 'key', to: 'index', weight: '' },
      { id: 'e-index-cache', from: 'index', to: 'cache', weight: '' },
      { id: 'e-cache-block', from: 'cache', to: 'block', weight: '' },
      { id: 'e-index-block', from: 'index', to: 'block', weight: '' },
      { id: 'e-block-restart', from: 'block', to: 'restart', weight: '' },
      { id: 'e-restart-value', from: 'restart', to: 'value', weight: '' },
      { id: 'e-footer-index', from: 'footer', to: 'index', weight: '' },
    ],
  }, { title });
}

function* pointLookup() {
  yield {
    state: lookupGraph('A point lookup tries to avoid touching data blocks'),
    highlight: { active: ['key', 'filter', 'e-key-filter'], compare: ['block', 'value'] },
    explanation: 'An SSTable is immutable and sorted. A point lookup first asks cheap metadata whether the key could be in this file. A negative filter answer skips the data block entirely.',
    invariant: 'Filters can say "maybe present" or "definitely absent"; they must not reject a stored key.',
  };

  yield {
    state: labelMatrix(
      'Lookup metadata',
      [
        { id: 'filter', label: 'filter' },
        { id: 'index', label: 'index' },
        { id: 'footer', label: 'footer' },
        { id: 'cache', label: 'cache' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['skip miss', 'false positive'],
        ['find block', 'RAM use'],
        ['locate meta', 'read first'],
        ['reuse block', 'eviction'],
      ],
    ),
    highlight: { found: ['filter:job', 'index:job'], compare: ['cache:risk'] },
    explanation: 'The file is immutable, so metadata can be built once and trusted. The filter prunes whole files or blocks; the index maps key ranges to block handles; the cache keeps hot blocks in memory.',
  };

  yield {
    state: lookupGraph('A filter miss stops the lookup early', { filter: 'absent', index: 'skip', block: 'not read', value: 'miss' }),
    highlight: { active: ['key', 'filter', 'e-key-filter'], removed: ['index', 'block', 'value'] },
    explanation: 'When the filter says absent, the engine does not binary-search the index or fetch a data block. This is why Bloom Filter and newer static filters matter so much for LSM read amplification.',
  };

  yield {
    state: lookupGraph('A filter maybe routes through index and block cache', { filter: 'maybe', index: 'handle', cache: 'hit?', block: 'decode', restart: 'local', value: 'found' }),
    highlight: { active: ['filter', 'index', 'cache', 'block', 'restart', 'value', 'e-filter-index', 'e-index-cache', 'e-cache-block'], found: ['value'] },
    explanation: 'A maybe answer is not proof. The index chooses a block handle. The cache may already hold that compressed or decompressed block. Inside the data block, restart points make local search cheaper.',
  };

  yield {
    state: labelMatrix(
      'Why partition index/filter blocks',
      [
        { id: 'small', label: 'small DB' },
        { id: 'large', label: 'large DB' },
        { id: 'part', label: 'partitioned' },
        { id: 'top', label: 'top index' },
      ],
      [
        { id: 'memory', label: 'memory' },
        { id: 'io', label: 'I/O' },
      ],
      [
        ['pin all', 'cheap'],
        ['too big', 'MB reads'],
        ['load slice', 'on demand'],
        ['tiny', 'find slice'],
      ],
    ),
    highlight: { active: ['large:memory', 'large:io'], found: ['part:memory', 'top:io'] },
    explanation: 'Large SSTables can have large index and filter metadata. Partitioned index and filter blocks keep a small top-level directory resident and load only the slice needed for the query.',
  };
}

function* fileLayout() {
  yield {
    state: labelMatrix(
      'LevelDB/RocksDB-style table layout',
      [
        { id: 'data', label: 'data blocks' },
        { id: 'filter', label: 'filter' },
        { id: 'meta', label: 'metaindex' },
        { id: 'index', label: 'index' },
        { id: 'footer', label: 'footer' },
      ],
      [
        { id: 'contains', label: 'contains' },
        { id: 'why', label: 'why' },
      ],
      [
        ['sorted kvs', 'scan/read'],
        ['key summary', 'skip miss'],
        ['meta handles', 'extensible'],
        ['block handles', 'seek'],
        ['root handles', 'open file'],
      ],
    ),
    highlight: { found: ['footer:contains', 'index:why', 'filter:why'] },
    explanation: 'An SSTable is not just sorted key-value data. It is a small on-disk data structure: data blocks first, metadata later, and a fixed footer at the end that points to the index and metaindex.',
    invariant: 'The footer is the entry point for discovering the rest of the file.',
  };

  yield {
    state: lookupGraph('The footer leads to index and metadata', { key: 'open', footer: 'read', filter: 'meta', index: 'blocks', block: 'data' }),
    highlight: { active: ['footer', 'index', 'filter', 'e-footer-index'], found: ['block'] },
    explanation: 'A reader can open the file, read the footer, find the index and metaindex block handles, and then discover optional metadata such as filters. That keeps the format extensible.',
  };

  yield {
    state: labelMatrix(
      'Index entries are separators',
      [
        { id: 'b0', label: 'block 0' },
        { id: 'b1', label: 'block 1' },
        { id: 'b2', label: 'block 2' },
      ],
      [
        { id: 'range', label: 'key range' },
        { id: 'indexKey', label: 'index key' },
        { id: 'value', label: 'value' },
      ],
      [
        ['a..k', 'm', 'off,len'],
        ['m..t', 'u', 'off,len'],
        ['u..z', 'z+', 'off,len'],
      ],
    ),
    highlight: { active: ['b1:indexKey', 'b1:value'], compare: ['b0:indexKey', 'b2:indexKey'] },
    explanation: 'The index key is a separator that routes lookups to the data block whose range can contain the searched key. The index value is a block handle: file offset plus length.',
  };

  yield {
    state: labelMatrix(
      'Data block internals',
      [
        { id: 'entry', label: 'entries' },
        { id: 'prefix', label: 'prefix diff' },
        { id: 'restart', label: 'restarts' },
        { id: 'trailer', label: 'trailer' },
      ],
      [
        { id: 'purpose', label: 'purpose' },
        { id: 'trade', label: 'tradeoff' },
      ],
      [
        ['store kvs', 'bytes'],
        ['compress keys', 'decode work'],
        ['jump points', 'more bytes'],
        ['type+sum', 'verify'],
      ],
    ),
    highlight: { found: ['prefix:purpose', 'restart:purpose'], compare: ['prefix:trade'] },
    explanation: 'Sorted keys often share prefixes, so blocks compress repeated key bytes. Restart points bound the local scan needed after a seek. Checksums protect against trusting corrupt storage bytes.',
  };

  yield {
    state: labelMatrix(
      'Study links from SSTables',
      [
        { id: 'lsm', label: 'LSM' },
        { id: 'filter', label: 'filters' },
        { id: 'cache', label: 'cache' },
        { id: 'manifest', label: 'manifest' },
      ],
      [
        { id: 'next', label: 'next link' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['RocksDB', 'file time'],
        ['Bloom/Xor', 'skip misses'],
        ['LRU/SIEVE', 'hot blocks'],
        ['VersionSet', 'live files'],
      ],
    ),
    highlight: { active: ['manifest:next'], found: ['lsm:reason', 'filter:reason'] },
    explanation: 'SSTables are the durable leaf files in a larger storage engine. To understand the whole engine, connect this file format to filters, block cache, compaction, and manifest metadata.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'point lookup') yield* pointLookup();
  else if (view === 'file layout') yield* fileLayout();
  else throw new InputError('Pick an SSTable view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'An SSTable is an immutable sorted table file. Storage engines such as LevelDB and RocksDB flush sorted in-memory state into SSTables, then compact SSTables over time. The data-structure lesson is that an on-disk file can be designed like a search structure: footer, index, filters, data blocks, restart points, and checksums each have a role.',
        'The format matters because LSM read cost is dominated by how many files and blocks a lookup touches. A good SSTable layout lets the engine avoid work: skip impossible files with filters, binary-search a compact index, reuse hot blocks from cache, and only decode a small local data block when needed.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Data blocks store sorted key-value entries. Index blocks map separator keys to block handles, where a handle identifies an offset and length in the file. A footer at the end points to the metaindex and index blocks. The metaindex can point to optional metadata such as filter blocks.',
        'A point lookup asks the filter whether the key could be present. If the answer is absent, the file is skipped. If the answer is maybe, the reader searches the index, fetches or reuses the data block, and searches within that block using restart points.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The tradeoffs are memory, I/O, CPU, and false positives. Larger filters reduce wasted data-block reads but consume memory and cache. Larger data blocks improve compression and scan throughput but make random reads heavier. Partitioned index and filter blocks reduce the cost of large metadata by loading only the needed partitions.',
      ],
    },
    {
      heading: 'Real-world case study',
      paragraphs: [
        'RocksDB uses a block-based table format by default. Its docs describe index blocks, filter meta-blocks, partitioned filters, block cache interaction, and multiple table-format versions. LevelDB documents the simpler table layout: data blocks, meta blocks, metaindex, index, and footer.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'An SSTable is not merely a sorted array dumped to disk. The metadata is what makes it usable at production scale. Another common mistake is to treat filters as proof of presence. A positive Bloom-style answer is only a maybe; the data block still has to be checked.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: LevelDB table format at https://github.com/google/leveldb/blob/main/doc/table_format.md, RocksDB block-based table format at https://github.com/facebook/rocksdb/wiki/Rocksdb-BlockBasedTable-Format, RocksDB index block format at https://github.com/facebook/rocksdb/wiki/Index-Block-Format, and RocksDB partitioned index/filter post at https://rocksdb.org/blog/2017/05/12/partitioned-index-filter.html. Study LSM Tree, RocksDB LSM Case Study, RocksDB Write Stalls & Compaction Debt, Bloom Filter, Xor Filter, Modern Cache Eviction, and RocksDB MANIFEST & VersionSet next.',
      ],
    },
  ],
};
