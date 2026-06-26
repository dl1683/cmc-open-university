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
        'The segment-lifecycle view follows one document from an in-memory buffer into a flushed segment, then into a commit point that searchers can open. A segment is a complete immutable mini-index. Active nodes are being written or published now, found nodes are durable, and compare nodes are readers or mergers deciding which generation they can see.',
        'The merge-economics view shows the debt created by many small immutable files. A merge reads old segments and writes a new larger segment; it does not edit the old bytes in place. The safe inference is that a searcher sees exactly the segment set named by its commit point, even while the writer creates later generations.',
        {type:'callout', text:'Lucene gets concurrency by publishing immutable segment generations, then paying merge debt in the background.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A search index has to answer queries while new documents arrive. The core structure is an inverted index: each term points to a postings list of document ids, positions, and other scoring data. Those postings lists are sorted and compressed so reads can be fast.',
        'Fast compressed reads fight with in-place writes. Adding one document can touch many terms, and each term may need a sorted postings update. Lucene segments exist so writing new documents does not mutate the structures that current searchers are scanning.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious design is one mutable inverted index. When a document arrives, insert its document id into every term postings list and update the term dictionary. When a document is deleted, remove its postings or mark them gone inside the same structure.',
        'That design is understandable because it resembles a normal database index. One structure owns the truth, and reads and writes meet there. It works for small offline indexes or systems that can stop queries during rebuilds.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is mutability inside read-optimized compressed files. A postings block may store 128 document ids as deltas packed into a compact bit layout. Inserting one id can change deltas, block boundaries, skip data, and file offsets after it.',
        'Concurrency makes the wall worse. A searcher may be decoding the old postings bytes while a writer wants to rewrite them. Locks can protect correctness, but then long queries block writes or writes block queries, and the index loses either freshness or latency.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Lucene treats every flush as a new immutable segment. The writer builds a complete mini-index from buffered documents and publishes it by updating metadata. Existing searchers keep reading their old segment set, while new searchers can open the new set.',
        'Deletes become filters instead of physical rewrites. A live-docs bitset says which document ids inside a segment are still visible. Background merging later copies surviving documents into a new segment and drops the dead bytes.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'IndexWriter buffers documents in memory, builds term dictionaries and postings, then flushes a new segment to disk. The segment contains several files: term dictionary, postings, stored fields, doc values, norms, and metadata. Once written, those files are not opened for normal mutation.',
        'A commit point names the live segment generation. Searchers open a directory reader over that generation and fan queries across its segments. Merges run in the background, write a replacement segment, and publish a later generation that swaps many old segments for one new segment.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness invariant is snapshot isolation at the segment-set level. A reader holds references to immutable segment files, so the writer cannot change the bytes under that reader. New files can appear beside old files without changing what the reader sees.',
        'A merge is correct because it is publish-after-write. The merge reads input segments, copies only live documents into the output segment, and then publishes metadata that names the output instead of the inputs. No reader sees half a merge because readers choose either the old commit point or the new one.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Search cost grows with the number of live segments. If a query term must be looked up in 40 segments, it performs 40 term-dictionary lookups before merging results. If background merges reduce that to 8 segments, the same query has one fifth as many segment-level lookups.',
        'Write cost appears as merge amplification. A document is written once at flush and then rewritten each time its segment participates in a merge. Larger buffers reduce tiny segments, but they use more memory and can delay visibility; faster refresh creates fresher search but more small segments.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Lucene segments are the storage unit behind Elasticsearch, OpenSearch, Solr, and many embedded search features. They fit systems where text search, scoring, filtering, sorting, and faceting must run while documents continue to arrive. The access pattern is many reads over compressed immutable structures plus append-and-merge writes.',
        'The broader pattern is log-structured storage. RocksDB SSTables, ClickHouse parts, and Lucene segments all trade in-place mutation for immutable runs plus compaction. Lucene differs because each run is an inverted index with term dictionaries, postings, live-docs filters, and scoring metadata.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Segments are a poor fit when an application expects cheap in-place updates. Updating one field is usually delete old document plus add new document, so disk usage grows until merging reclaims dead documents. Heavy update workloads can turn merge IO into the dominant cost.',
        'They also fail operationally when refresh and merge policy are misused. Very fast refresh can create many tiny segments, while aggressive force merge on an actively written index can consume disk IO and produce large segments that are slow to warm. Segment count is therefore a behavior signal, not just an internal detail.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose one shard has 12 segments and receives 120,000 product updates at night. With a 16 MB buffer that holds about 15,000 products, the writer flushes roughly 8 new segments. Search fan-out rises from 12 segment lookups per term to about 20 until merges catch up.',
        'If a query term costs 0.08 ms per segment lookup before postings work, the segment lookup part rises from about 0.96 ms to 1.6 ms. A later merge combines the 8 small segments into 2 larger segments, bringing the shard to 14 segments and dropping that part to about 1.12 ms. The cost is not magic notation; it is extra file lookups and result merging until background IO pays the debt.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are the Apache Lucene index file format documentation at https://lucene.apache.org/core/9_11_1/core/org/apache/lucene/codecs/lucene99/package-summary.html, Lucene IndexWriter documentation, and Elasticsearch merge settings at https://www.elastic.co/guide/en/elasticsearch/reference/current/index-modules-merge.html. Use these sources for mechanism claims before relying on secondary summaries.',
        'Study Inverted Index for postings, Finite-State Transducer for term dictionaries, LSM Tree for immutable-run compaction, Roaring Bitmap for live-doc and filter ideas, and Database Indexing with B-trees for the mutable-index contrast. Start with the topic that explains the data shape, then move to the production system.',
      ],
    },
  ],
};