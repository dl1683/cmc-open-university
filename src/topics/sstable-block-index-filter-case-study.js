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
    explanation: 'The lookup graph starts with avoidance. Because an SSTable is immutable and sorted, the reader can ask cheap metadata whether the key could be present before touching an expensive data block.',
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
    explanation: 'The metadata table explains the division of labor. Filters reject misses, indexes route possible hits to block handles, the footer locates metadata, and cache keeps hot blocks from becoming repeated I/O.',
  };

  yield {
    state: lookupGraph('A filter miss stops the lookup early', { filter: 'absent', index: 'skip', block: 'not read', value: 'miss' }),
    highlight: { active: ['key', 'filter', 'e-key-filter'], removed: ['index', 'block', 'value'] },
    explanation: 'The removed path is the win. A definite filter miss means no index search and no data-block fetch for this file. Across many SSTables, those avoided probes are what make LSM point reads practical.',
  };

  yield {
    state: lookupGraph('A filter maybe routes through index and block cache', { filter: 'maybe', index: 'handle', cache: 'hit?', block: 'decode', restart: 'local', value: 'found' }),
    highlight: { active: ['filter', 'index', 'cache', 'block', 'restart', 'value', 'e-filter-index', 'e-index-cache', 'e-cache-block'], found: ['value'] },
    explanation: 'A maybe answer only earns a closer look. The index picks a block handle, cache may satisfy the read, and restart points bound the local search inside the data block before the value is confirmed.',
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
    explanation: 'The partitioning table shows how metadata itself can become too large. A small top-level directory stays hot, while index and filter slices load on demand for the key range being searched.',
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
    explanation: 'The file-layout table is the on-disk structure. Data blocks hold sorted entries, metadata blocks make lookup cheap, and the fixed footer at the end tells a reader where to start.',
    invariant: 'The footer is the entry point for discovering the rest of the file.',
  };

  yield {
    state: lookupGraph('The footer leads to index and metadata', { key: 'open', footer: 'read', filter: 'meta', index: 'blocks', block: 'data' }),
    highlight: { active: ['footer', 'index', 'filter', 'e-footer-index'], found: ['block'] },
    explanation: 'The footer graph explains open-time discovery. A reader does not scan the whole file; it reads the footer, follows handles to the index and metaindex, and discovers optional metadata such as filters.',
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
    explanation: 'The separator table shows how a small index routes into a large file. The index key is a boundary, and the value is a block handle: offset plus length, not the user value itself.',
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
    explanation: 'Inside a data block, sorted keys buy compression but create decode work. Restart points trade a little space for bounded seeking, and checksums keep the reader from trusting corrupt bytes.',
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
    explanation: 'The study-link table is the larger engine around the file. SSTables are durable leaves, but their usefulness depends on filters, block cache, compaction, and manifest metadata that names which files are live.',
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as an SSTable lookup path. An SSTable is an immutable sorted table file, a data block is a compressed range of sorted key-value entries, and a block handle is an offset plus length that tells the reader where a block lives. Active nodes show the cheapest remaining test.',
        'Removed nodes are the point of the design: work skipped because earlier metadata proved it unnecessary. A filter miss means the key is definitely absent from this file. A filter maybe is only permission to continue, so the data block remains the source of truth.',
        {type:"callout", text:"The SSTable read path is staged so cheap metadata can reject misses before expensive data blocks are touched."},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'An LSM tree makes writes cheap by flushing immutable sorted files instead of updating old pages in place. The read path then faces a problem: a key may have to be searched across several files and levels. Without metadata, the write win becomes a read tax.',
        'The SSTable block-index-filter format exists to make each file self-navigating. It lets a reader skip files that cannot contain the key, jump to the only block that might contain it, and avoid disk when the block is already cached.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious file is one sorted sequence of key-value pairs. It is easy to write and merge, and binary search sounds possible because keys are ordered. The problem is that variable-length compressed records do not give direct random access to the kth key.',
        'A second obvious approach is to scan blocks until the key range passes the target. That works for tiny files but collapses when a lookup crosses dozens of SSTables. The file is sorted, but the reader still lacks compact routing metadata.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is read amplification. One user lookup can turn into many file checks, metadata reads, decompressions, and data-block reads. A storage engine that writes quickly but reads five cold blocks for every miss will feel slow on point queries.',
        'Metadata can also become too large. If the whole index and filter must stay in memory for every file, the engine has traded data I/O for metadata pressure. Large production tables need partitioned indexes and filters so only hot slices stay resident.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Arrange the file so cheap questions come first. The footer tells the reader where metadata starts, the filter can prove absence, and the index maps separator keys to block handles. The data block then performs the exact local search.',
        'The invariant is staged certainty. A negative filter answer is exact for absence, an index answer is exact for possible block location, and the data block answer is exact for the key-value result. Each stage either stops safely or narrows the next stage.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'On open, the reader finds the fixed footer and follows handles to the index and metaindex. The metaindex can point to a filter block. The top-level metadata is small enough to discover the rest of the file without scanning data blocks.',
        'On lookup, the engine first chooses candidate SSTables from the LSM level metadata. For each candidate, it checks the filter. If the answer is maybe, it searches the index for the target key range, checks the block cache, reads and verifies the data block on a miss, then searches restart points and entries inside the block.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from immutability and sorted ranges. Once the file is written, block offsets, separator keys, filters, checksums, and restart arrays do not change. A reader can trust that the index still names the same byte ranges while compaction builds new files elsewhere.',
        'The filter is safe because it is allowed to say maybe for absent keys but not allowed to say absent for present keys. The index is safe because separator keys cover ordered block ranges. The final data-block comparison decides the value, so false positives cannot return wrong data.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A successful point lookup touches candidate-file metadata, one filter check, one index search, and at most one data block per candidate file. If the block cache hits, disk I/O may be zero for that file. If the cache misses, the dominant cost is the random read and decompression of the chosen block.',
        'The format spends memory and bytes to avoid reads. More bits per key reduce filter false positives but consume cache. Smaller data blocks reduce wasted bytes for point reads but hurt compression and scan throughput. When the database doubles, compaction and level layout decide whether lookups see a few files or many.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'LevelDB, RocksDB, Pebble, Cassandra-style engines, and Bigtable-like stores use this family of immutable sorted files. The design fits write-heavy systems where background compaction can reorganize files while reads use metadata to stay selective.',
        'The access pattern is point lookup plus ordered iteration. Filters and block indexes help point reads, while sorted data blocks make range scans sequential. A good engine tunes block size, filter type, cache policy, and compaction together rather than treating the SSTable as an isolated file.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A filter maybe can be expensive when false positives are high. Poorly sized filters turn many absent keys into unnecessary index searches and block reads. Prefix filters can also be wrong for workloads that do not query by the configured prefix shape.',
        'It also fails under compaction debt. If too many overlapping files can contain the key, even perfect per-file metadata still runs many cheap tests. Tombstones, cold caches, oversized blocks, and stale partition metadata can make the read path much longer than the clean diagram.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Assume a 256 MB SSTable with 4 KB data blocks, so it has about 65,536 data blocks. An index entry of 24 bytes per block is about 1.5 MB before compression, which is too large to read repeatedly for cold lookups. A partitioned index might keep a 16 KB top index hot and load only the partition for the target key range.',
        'For an absent key across 12 candidate SSTables, a 1 percent false-positive filter means about 0.12 files on average continue past the filter. Most lookups read no data blocks. If the false-positive rate rises to 20 percent, the same miss continues into about 2.4 files, and the random-read cost becomes visible.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources start with the LevelDB table format at https://github.com/google/leveldb/blob/main/doc/table_format.md. Then read the RocksDB block-based table notes at https://github.com/facebook/rocksdb/wiki/Rocksdb-BlockBasedTable-Format and the partitioned index/filter post at https://rocksdb.org/blog/2017/05/12/partitioned-index-filter.html.',
        'Study LSM Tree for the file lifecycle and Bloom Filter or Xor Filter for membership tests. Then use Block Cache, RocksDB MANIFEST and VersionSet, and Compaction Debt to connect the file format to a live storage engine.',
      ],
    },
  ],
};
