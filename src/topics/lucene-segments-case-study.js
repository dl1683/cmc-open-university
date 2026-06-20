// Lucene segments: immutable inverted-index shards, deletes, commits, merges.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'lucene-segments-case-study',
  title: 'Lucene Segments Case Study',
  category: 'Systems',
  summary: 'Lucene index internals: new documents flush into immutable searchable segments, deletes are marked, and merges rewrite smaller segments into larger ones.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['segment lifecycle', 'merge economics'], defaultValue: 'segment lifecycle' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function luceneGraph(title) {
  return graphState({
    nodes: [
      { id: 'docs', label: 'documents', x: 0.8, y: 3.6, note: 'fields/text' },
      { id: 'writer', label: 'IndexWriter', x: 2.6, y: 3.6, note: 'buffer and flush' },
      { id: 'segA', label: 'segment A', x: 4.8, y: 2.0, note: 'immutable index' },
      { id: 'segB', label: 'segment B', x: 4.8, y: 5.2, note: 'immutable index' },
      { id: 'commit', label: 'segments_N', x: 6.8, y: 3.6, note: 'commit point' },
      { id: 'searcher', label: 'IndexSearcher', x: 8.7, y: 2.2, note: 'search all segments' },
      { id: 'merge', label: 'merge policy', x: 8.7, y: 5.2, note: 'rewrite segments' },
    ],
    edges: [
      { id: 'e-docs-writer', from: 'docs', to: 'writer', weight: 'add/update' },
      { id: 'e-writer-a', from: 'writer', to: 'segA', weight: 'flush' },
      { id: 'e-writer-b', from: 'writer', to: 'segB', weight: 'flush later' },
      { id: 'e-a-commit', from: 'segA', to: 'commit', weight: 'listed' },
      { id: 'e-b-commit', from: 'segB', to: 'commit', weight: 'listed' },
      { id: 'e-commit-searcher', from: 'commit', to: 'searcher', weight: 'open reader' },
      { id: 'e-a-merge', from: 'segA', to: 'merge', weight: 'merge input' },
      { id: 'e-b-merge', from: 'segB', to: 'merge', weight: 'merge input' },
    ],
  }, { title });
}

function* segmentLifecycle() {
  yield {
    state: luceneGraph('Lucene writes new immutable segments'),
    highlight: { active: ['docs', 'writer', 'segA', 'e-docs-writer', 'e-writer-a'], compare: ['searcher'] },
    explanation: 'Lucene does not update one giant inverted index in place. IndexWriter buffers documents and flushes them into new immutable segments that are complete searchable indexes.',
  };

  yield {
    state: labelMatrix(
      'Inside a segment',
      [
        { id: 'postings', label: 'postings' },
        { id: 'terms', label: 'term dictionary' },
        { id: 'stored', label: 'stored fields' },
        { id: 'docvalues', label: 'doc values' },
      ],
      [
        { id: 'contains', label: 'contains' },
        { id: 'queryUse', label: 'query use' },
      ],
      [
        ['term -> doc ids/positions', 'full-text matching'],
        ['terms and blocks', 'seek term quickly'],
        ['original stored fields', 'fetch result document'],
        ['columnar values', 'sort/filter/aggregate'],
      ],
    ),
    highlight: { active: ['postings:queryUse', 'terms:queryUse'], found: ['docvalues:queryUse'] },
    explanation: 'A segment contains the pieces needed for search: term dictionaries, postings, stored fields, doc values, norms, and metadata. The exact file format evolves by Lucene version.',
    invariant: 'Once written, a segment is not modified in place.',
  };

  yield {
    state: luceneGraph('A commit point names the live segment set'),
    highlight: { active: ['segA', 'segB', 'commit', 'e-a-commit', 'e-b-commit'], found: ['searcher'] },
    explanation: 'The segments_N metadata file records which segment files make up a committed index generation. Searchers open a point-in-time view over that segment set.',
  };

  yield {
    state: labelMatrix(
      'Updates and deletes',
      [
        { id: 'add', label: 'add document' },
        { id: 'delete', label: 'delete document' },
        { id: 'update', label: 'update document' },
        { id: 'reader', label: 'near-real-time reader' },
      ],
      [
        { id: 'mechanism', label: 'mechanism' },
        { id: 'effect' },
      ],
      [
        ['new segment eventually', 'visible after refresh/commit'],
        ['delete marker', 'old bytes remain until merge'],
        ['delete plus add', 'new doc id possible'],
        ['opens current segments', 'search without full commit'],
      ],
    ),
    highlight: { found: ['delete:effect', 'update:mechanism'], compare: ['reader:effect'] },
    explanation: 'Deleting or updating does not rewrite the old segment immediately. Lucene marks deletions and later reclaims space when segments merge.',
  };
}

function* mergeEconomics() {
  yield {
    state: luceneGraph('Merges rewrite many small segments into fewer larger ones'),
    highlight: { active: ['segA', 'segB', 'merge', 'e-a-merge', 'e-b-merge'], compare: ['writer'] },
    explanation: 'Segment immutability makes indexing and searching clean, but too many segments hurt search overhead. Merge policies choose groups of segments to rewrite into larger segments.',
  };

  yield {
    state: labelMatrix(
      'Merge tradeoffs',
      [
        { id: 'search', label: 'search cost' },
        { id: 'delete', label: 'deleted docs' },
        { id: 'io', label: 'IO and CPU' },
        { id: 'cache', label: 'cache effects' },
      ],
      [
        { id: 'beforeMerge', label: 'before merge' },
        { id: 'afterMerge', label: 'after merge' },
      ],
      [
        ['many segment readers', 'fewer readers'],
        ['tombstoned docs remain', 'reclaimed'],
        ['low immediate write cost', 'background rewrite cost'],
        ['old files hot', 'new files warm up'],
      ],
    ),
    highlight: { active: ['search:afterMerge', 'delete:afterMerge'], compare: ['io:afterMerge', 'cache:afterMerge'] },
    explanation: 'Merging improves future search and reclaims deleted documents, but it consumes disk bandwidth and CPU. Search systems tune merge pressure as part of ingestion capacity.',
    invariant: 'Merges create new segment files and then publish a new segment set; readers can keep using old segments safely.',
  };

  yield {
    state: luceneGraph('Search fans out across the current segment set'),
    highlight: { active: ['commit', 'searcher', 'e-commit-searcher'], found: ['segA', 'segB'] },
    explanation: 'A query searches each live segment and combines results. Segment-level immutability gives point-in-time readers and lets operating-system caches keep stable files hot.',
  };

  yield {
    state: labelMatrix(
      'Complete Elasticsearch-style case study',
      [
        { id: 'ingest', label: 'log ingest' },
        { id: 'refresh', label: 'refresh' },
        { id: 'search', label: 'search' },
        { id: 'merge', label: 'merge backlog' },
      ],
      [
        { id: 'luceneMove', label: 'Lucene move' },
        { id: 'risk' },
      ],
      [
        ['flush new segments', 'segment count rises'],
        ['open new readers', 'near-real-time visibility'],
        ['query all segments', 'too many small segments'],
        ['rewrite background', 'IO throttle needed'],
      ],
    ),
    highlight: { found: ['ingest:luceneMove', 'search:risk', 'merge:risk'], compare: ['refresh:risk'] },
    explanation: 'A production search cluster is often balancing ingestion freshness against segment geometry. Faster refresh means documents appear sooner, but it can create more small segments to merge later.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'segment lifecycle') yield* segmentLifecycle();
  else if (view === 'merge economics') yield* mergeEconomics();
  else throw new InputError('Pick a Lucene-segments view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The "segment lifecycle" view traces a document from arrival through IndexWriter, flush, commit point, and searcher. Active nodes are the current stage of the write path. Found nodes are durable artifacts that survive a crash. Compare nodes are consumers waiting for the next generation of segments.',
        'The "merge economics" view shows the cost reconciliation loop. Active nodes are segments entering the merge. Found nodes are the resulting larger segment. Compare nodes are the writer and searcher whose performance changes as merge geometry shifts.',
        {type:'callout', text:'Lucene gets concurrency by publishing immutable segment generations, then paying merge debt in the background.'},
        {
          type: 'note',
          text: 'The safe inference at each frame: if a segment node is active, it is an immutable, complete, searchable index. If a commit-point node is active, it names the set of segments a searcher may open. No segment is ever modified after flush -- only replaced by a merge or hidden by a delete marker.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          attribution: 'Doug Cutting, Lucene creator (2004 interview)',
          text: 'The key insight is that merging sorted runs is much cheaper than maintaining a single sorted structure under random updates.',
        },
        'A search engine must accept new documents while thousands of queries hit an inverted index. The inverted index is the core structure: for every term in the corpus, it stores a sorted list of document IDs (postings) with positions, frequencies, and payloads. Queries intersect, union, and score these postings lists at speed.',
        'The tension is that postings are compressed, sorted, and designed for sequential scan. Inserting one document into the middle of a sorted, variable-byte-encoded postings list means decompressing, splicing, recompressing, and somehow isolating that mutation from concurrent readers scanning the same bytes. Doug Cutting designed Lucene segments in 1999 to escape that trap entirely.',
        'The design principle: never mutate a written index. Instead, write new documents into a fresh, complete, immutable mini-index called a segment. A metadata file (the commit point) names which segments are live. Searchers open a snapshot of that set. Background merges compact small segments into larger ones. Deletes are markers, not mutations.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is a single mutable inverted index. When a document arrives, update the term dictionary, append to postings lists, and store fields. When a document is deleted, remove its postings. Readers and writers share one structure, perhaps protected by a read-write lock.',
        {
          type: 'code',
          language: 'javascript',
          body: '// Naive mutable inverted index: simple, but concurrency is the problem.\nclass MutableIndex {\n  constructor() { this.postings = new Map(); } // term -> sorted doc IDs\n\n  addDocument(docId, terms) {\n    for (const term of terms) {\n      if (!this.postings.has(term)) this.postings.set(term, []);\n      const list = this.postings.get(term);\n      // Insert into sorted position -- O(n) shift per term per document.\n      const pos = list.findIndex(id => id > docId);\n      list.splice(pos === -1 ? list.length : pos, 0, docId);\n    }\n  }\n\n  search(term) {\n    return this.postings.get(term) || []; // Reader sees partial state during add?\n  }\n}',
        },
        'This works for small, single-threaded applications. It is how early full-text libraries like WAIS and Glimpse operated: build the index, then query it, but never both at the same time.',
        'Production search cannot afford that constraint. Elasticsearch clusters ingest thousands of documents per second while serving queries. A single mutable index forces a choice: lock out readers during writes (unacceptable latency), lock out writers during reads (unacceptable freshness), or accept torn reads where a query sees half an update (unacceptable correctness).',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is mutability under compression plus concurrency.',
        'Lucene postings lists are not plain arrays. They are delta-encoded, variable-byte-compressed, block-aligned structures designed for fast sequential decode. A posting for term "server" in a million-document index might be a compressed stream of 50,000 document IDs stored as successive deltas in 128-integer blocks. Inserting one new document ID into that stream means:',
        {
          type: 'bullets',
          items: [
            'Find the correct block in the compressed stream.',
            'Decompress the block.',
            'Insert the new delta, shifting all subsequent deltas.',
            'Recompress, possibly changing the block boundary.',
            'Update the skip list that lets queries jump over blocks.',
            'Do this for every term in the document, while readers scan these same bytes.',
          ],
        },
        'Term dictionaries have the same problem. Lucene uses an FST (finite-state transducer) to map terms to postings offsets. An FST is a compiled, immutable automaton. Adding one term means rebuilding the FST or maintaining a mutable sidecar structure that defeats the compression benefit.',
        {
          type: 'note',
          text: 'The wall is not "writes are slow." The wall is that the structures that make reads fast (compressed postings, FST term dictionaries, columnar doc values) are fundamentally hostile to in-place mutation. You cannot have both fast reads and cheap in-place writes in the same file format.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate the write path from the read structures by treating each flush as a complete, immutable, searchable index -- a segment.',
        {
          type: 'diagram',
          alt: 'Lucene segment lifecycle from buffer to merge',
          label: 'Document lifecycle through segments',
          body: 'Documents arrive\n       |\n       v\nIndexWriter RAM buffer (default 16 MB)\n       |\n       | flush (buffer full or refresh requested)\n       v\nSegment_0  Segment_1  Segment_2  ...  (each is a complete inverted index)\n       |       |       |\n       v       v       v\nsegments_N commit point (names the live set)\n       |\n       v\nIndexSearcher opens all live segments\n       |\n       |  (background, when merge policy triggers)\n       v\nMerge: Segment_0 + Segment_1 --> Segment_3 (new, larger, immutable)\n       |\n       v\nsegments_N+1 commit point (Segment_3 replaces 0 and 1)',
          text: 'Documents arrive -> IndexWriter RAM buffer (default 16 MB) -> flush -> immutable segments -> segments_N commit point -> IndexSearcher opens all live segments -> merge combines small segments into larger ones -> new commit point',
        },
        'IndexWriter holds documents in a RAM buffer. When the buffer reaches its limit (default 16 MB) or a near-real-time reader is requested, Lucene flushes the buffer into a new segment on disk. That segment is a self-contained inverted index with its own term dictionary, postings, stored fields, doc values, norms, and field metadata. It is never modified after creation.',
        'A query searches every live segment and merges the results. The cost of this fan-out is the debt that immutability creates. Background merges pay it down by rewriting groups of small segments into fewer large segments, reclaiming deleted documents in the process.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A segment is not one file. It is a family of files, each storing a different data structure optimized for its access pattern.',
        {
          type: 'table',
          headers: ['File extension', 'Structure', 'Purpose'],
          rows: [
            ['.si', 'Segment info', 'Segment metadata: doc count, codec version, diagnostics, sort order'],
            ['.fnm', 'Field names', 'Field number, name, type, index options for each field'],
            ['.tim / .tip', 'Term dictionary + index', 'FST mapping terms to postings offsets; block-encoded term metadata'],
            ['.doc', 'Postings (frequencies)', 'Delta-encoded, block-compressed document IDs and term frequencies'],
            ['.pos / .pay', 'Positions / payloads', 'Term positions within documents, offsets, and custom payloads'],
            ['.dvd / .dvm', 'Doc values data / meta', 'Columnar per-document values for sorting, faceting, and scripting'],
            ['.fdt / .fdx', 'Stored fields data / index', 'Original field values for result display, compressed in blocks of 16 KB'],
            ['.nvd / .nvm', 'Norms data / meta', 'Per-field length normalization factors used in scoring'],
            ['.liv', 'Live docs', 'Bitset marking which documents are not deleted (only present if segment has deletes)'],
            ['.cfs / .cfe', 'Compound file', 'All segment files packed into one file to reduce open file handles'],
          ],
        },
        'When IndexWriter flushes, it writes all of these files for the new segment. The term dictionary is built as an FST -- a minimal automaton that maps byte sequences (terms) to block file pointers in the postings files. Postings are written in blocks of 128 document IDs, delta-encoded and bit-packed for fast SIMD decode.',
        {
          type: 'code',
          language: 'javascript',
          body: '// Simplified model of how a segment is built during flush.\nfunction flushSegment(bufferedDocs) {\n  const segment = { id: nextSegmentId++ };\n\n  // 1. Sort terms across all documents in the buffer.\n  const termPostings = buildInvertedIndex(bufferedDocs);\n\n  // 2. Write postings: for each term, delta-encode doc IDs in blocks of 128.\n  segment.postingsFile = writeBlockPostings(termPostings);  // .doc file\n\n  // 3. Build FST term dictionary pointing to postings offsets.\n  segment.termDict = buildFST(termPostings.keys());         // .tim/.tip files\n\n  // 4. Write stored fields in compressed blocks.\n  segment.storedFields = compressStoredFields(bufferedDocs); // .fdt/.fdx files\n\n  // 5. Write columnar doc values for sort/facet fields.\n  segment.docValues = writeDocValues(bufferedDocs);          // .dvd/.dvm files\n\n  // 6. Write segment info and field metadata.\n  segment.info = writeSegmentInfo(segment);                  // .si, .fnm files\n\n  // Segment is now immutable. It will never be opened for writing again.\n  return segment;\n}',
        },
        'The commit point is a file called segments_N (where N increments with each commit). It lists every live segment, their sizes, and delete generation numbers. Opening a DirectoryReader at a commit point gives a searcher a frozen view of exactly those segments. Even if IndexWriter flushes ten more segments afterward, the existing reader sees only what was committed when it opened.',
        'Deletes do not modify the segment that contains the deleted document. Instead, Lucene writes a .liv file -- a bitset where bit i is set if document i is alive. When a query iterates postings in that segment, it checks the live-docs bitset and skips deleted entries. The deleted bytes remain on disk until a merge rewrites the surviving documents into a new segment.',
        {
          type: 'note',
          text: 'An "update" in Lucene is always a delete of the old document followed by an add of the new one. There is no in-place field update (with the narrow exception of numeric doc-value updates added in Lucene 4.6). This means that updating a single field on a document rewrites the entire document into a new segment and marks the old version deleted.',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on three invariants:',
        {
          type: 'bullets',
          items: [
            'Immutability: a segment is never modified after flush. Readers can hold file handles to old segments safely because no writer will change those bytes.',
            'Atomic commit: the segments_N file is written atomically (write to temp, fsync, rename). Either the new generation is fully visible or the old one remains. There is no torn state.',
            'Delete isolation: the .liv bitset is the only mutable artifact per segment, and it is applied as a filter during query evaluation, not as a mutation to the postings themselves.',
          ],
        },
        'These invariants give Lucene a concurrency model with no read-write locks on the index data. A searcher holds a reference to a set of immutable segment files. The writer produces new files alongside them. The reference-counting mechanism ensures old segment files are not deleted until all readers using them have closed.',
        'The correctness argument for merges: a merge reads N input segments, writes one output segment containing the union of all non-deleted documents, and atomically publishes a new commit point that replaces the N inputs with the one output. Any reader that opened before the new commit point continues using the old segments. Any reader that opens after sees only the merged segment. There is never a window where a document is visible in both the input segments and the output segment of the same reader.',
        {
          type: 'note',
          text: 'This is the same concurrency trick used by MVCC databases: readers see a frozen snapshot, writers produce new versions, and garbage collection reclaims old versions once no reader references them. The difference is that Lucene snapshots are at the segment-set level, not the row level.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Cost axis', 'What you pay', 'Concrete behavior'],
          rows: [
            ['Search fan-out', 'One sub-search per live segment', '50 segments means 50 term-dictionary lookups per query term; merging to 5 segments cuts that 10x'],
            ['Write amplification', 'Each byte is rewritten during merge', 'TieredMergePolicy targets ~10x total write amplification over the life of a document'],
            ['Space amplification', 'Deleted docs occupy disk until merge', 'An index with 30% deleted docs uses ~1.4x the space of a fully compacted index'],
            ['Merge IO', 'Background sequential reads and writes', 'A 5 GB merge saturates disk throughput; Elasticsearch throttles merges to 20 MB/s by default to leave headroom'],
            ['Cache churn', 'New merged segment replaces cached files', 'OS page cache must warm the new segment; queries may slow briefly after a large merge'],
            ['File descriptors', 'Each segment is 8-15 open files', '1000 segments can require 10,000+ file descriptors; compound file format (.cfs) reduces this to 1-2 per segment'],
          ],
        },
        'The dominant operational cost is merge IO. Every document that enters the index is written at least once (during flush) and then rewritten during each merge that includes its segment. With TieredMergePolicy defaults, a document is typically rewritten 2-4 times over its lifetime, giving a total write amplification of roughly 10x.',
        'Search cost scales with segment count because each query term requires a separate term-dictionary lookup and postings iteration per segment. A healthy Elasticsearch shard typically has 10-50 segments. Hundreds of segments indicate merge backlog or misconfigured refresh. Thousands of segments cause measurable query latency degradation.',
        {
          type: 'table',
          headers: ['Metric', 'Healthy range', 'Warning sign', 'Likely cause'],
          rows: [
            ['Segments per shard', '10-50', '> 200', 'Refresh too fast, merge throttled, or sustained high ingest'],
            ['Deleted docs ratio', '< 20%', '> 50%', 'Heavy updates without merge; force merge may help for read-only indices'],
            ['Merge backlog', '0-2 pending', '> 10 pending', 'Disk IO saturated or merge throttle too aggressive'],
            ['Refresh time', '< 200 ms', '> 1 s', 'Too many small segments or very large RAM buffer'],
          ],
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'An e-commerce site runs an Elasticsearch cluster with 12 primary shards. Each shard is one Lucene index. The product catalog has 5 million items, updated in nightly batches of 200,000 changed products. Daytime traffic is 2,000 searches per second.',
        {
          type: 'table',
          headers: ['Step', 'State', 'Segments', 'What happens'],
          rows: [
            ['1. Nightly bulk index', 'Batch of 200K docs arrives', '~15 existing', 'IndexWriter flushes ~12 new segments (16 MB buffer, ~16K docs each)'],
            ['2. After flush', 'All 200K docs flushed', '~27 segments', 'Each old product doc is marked deleted in its original segment; new version is in a fresh segment'],
            ['3. Merge triggers', 'TieredMergePolicy selects candidates', '~27 -> merging', 'Policy picks groups of similarly-sized small segments; merges run in background threads'],
            ['4. Merge completes', 'Background merges finish over ~10 min', '~12 segments', 'Dead docs from updates are physically removed; disk space reclaimed'],
            ['5. Daytime queries', '2000 QPS on 12 segments per shard', '~12 stable', 'Each query fans out across 12 segments -- fast term lookups, warm page cache'],
            ['6. Refresh cycle', 'Default 1-second refresh', '~12 (no new writes)', 'Refresh is a no-op when no new documents have arrived; segment count stays stable'],
          ],
        },
        'The critical tuning decision: the nightly batch creates a burst of small segments and a spike of deleted-doc markers. If merge throttling is too aggressive, the cluster enters daytime query traffic with 27 segments per shard instead of 12. Queries slow down because each term lookup happens 27 times instead of 12. The fix is to allow higher merge throughput during the batch window (Elasticsearch index.merge.scheduler.max_thread_count) or to pre-batch documents into larger IndexWriter flushes.',
        'If the team instead sets refresh_interval to 100ms for "real-time search," each second produces 10 tiny segments instead of 1 modest one. Over a 30-minute batch window, that creates 18,000 segments per shard. Merges cannot keep up. Queries degrade. File descriptor limits may be hit. The segment count becomes a self-inflicted crisis.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Lucene segments are the storage engine behind every major open-source search platform. The pattern is not Lucene-specific -- it is the search-engine variant of log-structured storage.',
        {
          type: 'bullets',
          items: [
            'Elasticsearch / OpenSearch: each shard is one Lucene index. The translog provides durability between Lucene commits. Refresh opens a new NRT reader over recent segments. Force merge (_forcemerge API) compacts read-only indices.',
            'Apache Solr: same Lucene segments underneath. SolrCloud manages distributed indexing and replication, with each core holding its own segment set.',
            'Full-text search: e-commerce product search, document search, email search. The inverted index inside each segment maps query terms to matching documents in microseconds.',
            'Log and observability search: Elasticsearch is the "E" in the ELK stack. Time-based indices (one per day or hour) let old indices be force-merged and frozen, reducing long-term segment overhead.',
            'Vector search (since Lucene 9): dense vector fields are stored in segments alongside text postings. HNSW graphs are built per segment and merged along with the rest of the segment data.',
            'The LSM-tree analogy: segments are conceptually similar to SSTables in LevelDB/RocksDB. Both use immutable sorted runs with background compaction. The difference is that Lucene segments contain inverted indexes, FST term dictionaries, and columnar doc values -- not just sorted key-value pairs.',
          ],
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The segment model has real costs that surprise teams accustomed to database update semantics.',
        {
          type: 'table',
          headers: ['Expectation', 'Reality', 'Consequence'],
          rows: [
            ['In-place update', 'Delete old + add new', 'Disk usage grows until merge reclaims deleted docs; a field change rewrites the entire document'],
            ['Stable document ID', 'Internal doc IDs are per-segment, reassigned on merge', 'Applications must maintain external IDs (_id in Elasticsearch) and pay a lookup cost'],
            ['Instant delete', 'Delete marker hides doc; bytes remain', 'A 10 GB index with 80% deleted docs still scans 10 GB of postings, skipping 80% via live-docs bitset'],
            ['Force merge is free', 'Force merge rewrites the entire index', 'Force merging a 500 GB shard during active indexing can take hours and starve queries of IO'],
            ['More segments = more parallelism', 'More segments = more overhead per query', 'Each segment requires its own term-dictionary seek, postings decode, and result merge'],
          ],
        },
        'The LSM analogy is useful but incomplete. LSM-tree compaction produces sorted runs that can be binary-searched by key. Lucene segment merges produce inverted indexes that must be queried by term, scored by relevance, and combined across fields. A Lucene merge is more expensive per byte than an LSM compaction because it rebuilds FSTs, recompresses postings, recalculates norms, and reconstructs skip lists.',
        'Force merge is the most dangerous operation in Elasticsearch. The _forcemerge API rewrites all segments in a shard into max_num_segments (typically 1). On a read-only index, this is beneficial: fewer segments, no dead docs, better cache locality. On an actively indexed shard, force merge competes with indexing for disk IO and memory, can cause long GC pauses from holding multiple segment readers, and produces a single massive segment that takes a long time to warm in the page cache.',
        {
          type: 'note',
          text: 'The Elasticsearch documentation explicitly warns: "Force merge should only be called against read-only indices. Running force merge against a read-write index can cause very large segments to be produced (>5GB per segment), and the merge policy will never consider these segments for future merges." This is not a theoretical risk. It is a common production incident.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: the Apache Lucene index file formats documentation at https://lucene.apache.org/core/9_11_1/core/org/apache/lucene/codecs/lucene99/package-summary.html, the Lucene IndexWriter javadoc, Michael McCandless\' "Visualizing Lucene segment merges" blog post series, and the Elasticsearch guide on index segments and merging at https://www.elastic.co/guide/en/elasticsearch/reference/current/index-modules-merge.html.',
        {
          type: 'bullets',
          items: [
            'Prerequisite: Inverted Index -- the postings-list structure that lives inside each segment.',
            'Prerequisite: FST (finite-state transducer) -- the compiled automaton Lucene uses as its term dictionary.',
            'Extension: LSM Tree -- the generalized pattern of immutable sorted runs with background compaction.',
            'Extension: Roaring Bitmaps -- the compressed bitset format Lucene uses for live-docs and filter caches.',
            'Contrast: ClickHouse MergeTree -- a column-oriented analytic engine that also uses immutable parts with background merges, but optimized for OLAP scans rather than inverted-index lookups.',
            'Contrast: Database Indexing (B-tree) -- the mutable-index approach that Lucene deliberately avoids, trading update-in-place for append-and-merge.',
          ],
        },
        'The engineering question for Lucene segments is never "are immutable segments good?" It is whether your refresh interval, merge policy, delete rate, and query fan-out are in a sustainable equilibrium -- or whether one knob is silently creating debt that another part of the system will pay as latency.',
      ],
    },
  ],
};
