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
        "Read the animation as the execution trace for SSTable Block Index & Filter. An immutable sorted-file primer: data blocks, restart points, filter blocks, index entries, metaindex, footer handles, and cache-aware lookups..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: "Why this exists",
      paragraphs: [
        "An LSM tree makes writes cheap by buffering changes in memory and flushing immutable sorted files to disk. Those files are SSTables. The write path is attractive because it avoids random in-place updates, but the read path inherits a problem: a database may have many sorted files that could contain the requested key.",
        "The SSTable block-index-filter design exists to keep that write-optimized storage layout from becoming a read disaster. A point lookup should not scan a file, and it should not read a data block from disk unless there is a plausible reason. The file format itself becomes a search structure.",
      ],
    },
    {
      heading: "The obvious approach",
      paragraphs: [
        "The naive file is a sorted list of key-value pairs written one after another. It is easy to flush and easy to merge during compaction, but a lookup has to binary search awkward byte ranges or scan until it passes the key. The file is sorted, yet it is not self-describing enough for fast block-level navigation.",
        "A slightly better naive design writes fixed-size blocks and a separate list of block offsets. That helps, but it still wastes work. The reader may open files that cannot contain the key, read metadata that is too large to keep hot, decompress blocks that do not contain the target, or repeat disk reads for popular blocks.",
      ],
    },
    {
      heading: "The core insight",
      paragraphs: [
        "An SSTable is useful when its metadata can answer increasingly expensive questions in order. First, can this file be skipped? Second, which block could contain the key? Third, is that block already in memory? Fourth, where inside the block should the search begin?",
        "This staged design turns a lookup into a sequence of early exits. A Bloom-style filter can say definitely absent. An index block can narrow the search to one data block. A block cache can avoid disk. Restart points inside the block can bound local search even when keys are prefix-compressed.",
      ],
    },
    {
      heading: "File anatomy",
      paragraphs: [
        "A LevelDB-style table has data blocks near the front. Each data block contains sorted entries, often with prefix compression and restart points. An index block maps separator keys to block handles. A block handle records an offset and length, which lets the reader seek directly to the compressed block bytes.",
        "Near the end of the file are metadata blocks, a metaindex block, an index block, and a footer. The footer is small and fixed enough that a reader can find it first. From the footer it discovers the index and metaindex. From the metaindex it can discover filters or other optional metadata.",
      ],
    },
    {
      heading: "How it works",
      paragraphs: [
        "A point lookup usually begins outside the file, where the LSM tree chooses candidate files by level and key range. For each candidate SSTable, the reader asks the filter whether the key might be present. If the filter says absent, the file is skipped without consulting the data block.",
        "If the filter says maybe, the reader searches the index to find the block whose key range could contain the target. It then checks the block cache. On a cache hit, the block is searched in memory. On a cache miss, the reader performs an I/O, verifies and decompresses the block if needed, inserts it into cache, and searches within it.",
      ],
    },
    {
      heading: "How it works (2)",
      paragraphs: [
        "The point-lookup visual is proving how aggressively the reader tries to stop. A negative filter answer removes the whole file from the path. A positive filter answer is only permission to continue, not proof that the key exists. The data block remains the source of truth.",
        "The file-layout visual is proving that the reader discovers the file from the outside inward. The footer points to metadata. Metadata points to indexes and filters. Indexes point to data blocks. Data blocks use restart points to make their own compressed contents searchable. The layout is a chain of smaller search problems.",
      ],
    },
    {
      heading: "Why it works",
      paragraphs: [
        "The design works because different metadata answers different cost questions. Filters are compact and probabilistic, so they are good at avoiding work. Index blocks are exact, so they are good at navigation. Data blocks are the expensive payload, so they are read only after cheaper layers fail to rule the file out.",
        "It also works because immutability makes the metadata stable. Once an SSTable is written, its index, filters, checksums, and block offsets do not change. Readers can cache metadata safely, compaction can build new files instead of patching old ones, and checksums can validate fixed byte ranges.",
      ],
    },
    {
      heading: "Range scans and compaction context",
      paragraphs: [
        "Point lookups are not the only workload. Range scans often want sequential access through many adjacent keys, so the best block size and compression choice may differ from a point-read-heavy service. A design that minimizes one random lookup can be suboptimal for long ordered iteration.",
        "Compaction also changes the read picture. It removes overwritten values and tombstones, reduces overlap between files, and builds new filters and indexes. When compaction falls behind, the table format still works, but a lookup may have to consult more candidate files before it can return the newest visible value.",
      ],
    },
    {
      heading: "Cost and behavior",
      paragraphs: [
        "The format spends bytes on metadata to save I/O. Filters consume memory or cache space. Indexes consume memory or extra reads. Restart points reduce the cost of searching compressed blocks but slightly reduce compression efficiency. Smaller data blocks reduce read amplification for point lookups, while larger blocks can improve compression and range-scan throughput.",
        "RocksDB-style systems add more choices: whole-key filters or prefix filters, partitioned filters, partitioned indexes, cache pinning, compression per level, checksum type, and block size. Those knobs exist because there is no universally best SSTable. The right table shape depends on point reads, scans, value sizes, cache budget, device latency, and compaction behavior.",
      ],
    },
    {
      heading: "Debugging read amplification",
      paragraphs: [
        "When a lookup is slow, count both the work done and the work avoided. Useful counters include filter checks, filter negatives, filter false positives, index-cache hit rate, block-cache hit rate, data-block reads, bytes decompressed, checksum failures, and the number of SSTables consulted per request.",
        "Those counters tell different stories. A high filter-negative rate means filters are saving I/O. A high false-positive rate means filter memory may be too small or the wrong filter mode is being used. Low block-cache hit rate may mean the working set is too large, blocks are too large, or scans are polluting the cache.",
      ],
    },
    {
      heading: "Real-world uses",
      paragraphs: [
        "LevelDB documents the simple baseline: data blocks, optional meta blocks, a metaindex, an index, and a footer. RocksDB extends the block-based table format with production features such as partitioned indexes and filters, richer cache interaction, and multiple format versions for compatibility and performance.",
        "The same family of ideas appears in Pebble, Bigtable-like systems, Cassandra-style storage, and many embedded or service-backed LSM engines. The names differ, but the read-path goal is the same: reduce the number of files, blocks, and bytes touched before a key is found or ruled out.",
      ],
    },
    {
      heading: "Where it fails",
      paragraphs: [
        "A filter positive is not a hit. Bloom-style filters can return false positives, so the reader must still check the data block before returning a value. A filter can also be poorly sized. Too few bits per key raise the false-positive rate and turn cheap maybes into expensive unnecessary reads.",
        "Metadata can become its own problem. Very large SSTables may have indexes and filters too large to keep hot as single blocks. Cold block cache, oversized data blocks, bad compression choices, many overlapping files, tombstones, and compaction debt can all turn a clean point-lookup path into repeated random I/O.",
      ],
    },
    {
      heading: "Study next",
      paragraphs: [
        "Primary sources: LevelDB table format at https://github.com/google/leveldb/blob/main/doc/table_format.md, RocksDB block-based table format at https://github.com/facebook/rocksdb/wiki/Rocksdb-BlockBasedTable-Format, RocksDB index block format at https://github.com/facebook/rocksdb/wiki/Index-Block-Format, and RocksDB partitioned index/filter post at https://rocksdb.org/blog/2017/05/12/partitioned-index-filter.html.",
        "Study LSM Tree first so the SSTable has context. Then study RocksDB LSM Case Study, RocksDB Write Stalls and Compaction Debt, Bloom Filter, Xor Filter, Modern Cache Eviction, Cache Invalidation, and RocksDB MANIFEST and VersionSet. Together they show how immutable files become a live database.",
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        "Trace one representative example end-to-end so readers can watch state evolve across every step.",
        "Keep the walkthrough concise and precise: at each step, write current state, action taken, and resulting output.",
        "The goal is prediction, not a one-off demonstration.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why SSTable Block Index & Filter moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};

