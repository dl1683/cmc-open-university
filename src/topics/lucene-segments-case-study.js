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
      heading: `Why This Exists`,
      paragraphs: [
        `Lucene segments exist because a search engine must ingest documents while readers keep searching a stable index. Rewriting one giant inverted index in place would make concurrency, crash recovery, caching, and deletes much harder. Immutable segments give searchers point-in-time files while writers create new index pieces.`,
      ],
    },
    {
      heading: `The Obvious Approach`,
      paragraphs: [
        `The reasonable first attempt is one mutable index. Insertions update term dictionaries and postings in place; deletions remove old postings; readers use the same files. That sounds direct, but postings are compressed sorted structures, so arbitrary in-place changes are expensive and hard to isolate from active readers.`,
      ],
    },
    {
      heading: `The Wall`,
      paragraphs: [
        `The wall is mutability under compression. Search structures are optimized for reads: sorted postings, term dictionaries, doc values, stored fields, and metadata. Fast writes want append-like behavior, while fast reads want fewer compact structures. Segment architecture separates those demands and pays reconciliation later.`,
      ],
    },
    {
      heading: `The Core Insight`,
      paragraphs: [
        `Treat each flushed batch as a complete immutable searchable index. A commit point records which segments are live. Searchers open a stable segment set. Updates become delete plus add. Background merges rewrite groups of segments into larger segments, reclaiming deleted documents and improving future search locality.`,
      ],
    },
    {
      heading: 'Reading the visualization',
      paragraphs: [
        `In the segment-lifecycle view, read every flushed segment as a complete mini index. New documents do not mutate one shared postings structure. They become new immutable files that a later searcher can include in its point-in-time segment set.`,
        `In the merge-economics view, watch Lucene pay back the debt created by immutability. Small segments and delete markers make writes and refreshes cheap at first, but search fanout and wasted deleted-document space eventually require background merges.`,
      ],
    },
    {
      heading: `How It Works`,
      paragraphs: [
        `IndexWriter buffers documents and flushes new segment files. A segment contains term dictionaries, postings, positions, stored fields, doc values, norms, and metadata. Searchers query every live segment and combine results. Delete markers hide old documents until a merge physically rewrites the surviving data.`,
        `A commit point is the durable list of live segments. Near-real-time readers can see newly flushed segments before a full commit, but the core idea is the same: readers see a stable set of immutable files while writers continue producing future files.`,
      ],
    },
    {
      heading: `Why It Works`,
      paragraphs: [
        `Immutability makes reader isolation simple: an open searcher can keep using old segment files while new files are written. Publishing a new generation changes metadata about which files are live, not the bytes under old readers. Merges are safe because they create replacement segments before old ones disappear from future views.`,
        `That is the concurrency win. A query does not need to lock a mutable postings list while indexing changes it. It reads a stable generation, while writers prepare the next generation beside it.`,
      ],
    },
    {
      heading: `Cost and Behavior`,
      paragraphs: [
        `The tax is merge economics. Too many small segments increase per-query fanout. Too much merging consumes IO and CPU. Deleted documents occupy space until rewritten away. Near-real-time refresh makes documents visible sooner but can create more small segments. Production systems tune refresh interval, merge policy, disk bandwidth, and indexing batch size together.`,
        `There is no free setting. A very short refresh interval improves freshness but creates many small segments. Aggressive merging reduces search overhead but steals IO from indexing and querying. Force merges can be useful after an index becomes read-only, but dangerous during active ingestion.`,
      ],
    },
    {
      heading: `Operational checklist`,
      paragraphs: [
        `Watch segment count, deleted-document percentage, merge backlog, refresh time, indexing throughput, query latency, disk bandwidth, and cache warmup after large merges. Segment problems usually appear as a system curve, not as one isolated metric.`,
        `Tune refresh interval and merge policy together. Refresh controls when new segments become visible; merge policy controls how the system pays down the many-small-segment debt. A change to one side often moves pressure to the other.`,
        `Separate hot write indexes from read-only historical indexes when the product allows it. Active shards may need frequent refreshes and careful merge throttling, while sealed time partitions can be force-merged or optimized for cheaper long-term search.`,
      ],
    },
    {
      heading: `Where It Wins`,
      paragraphs: [
        `Lucene segments power full-text search, log search, e-commerce search, observability search, document retrieval, and search-backed analytics through Lucene, Solr, Elasticsearch, OpenSearch, and embedded applications. The pattern also teaches the LSM-like storage lesson: immutable pieces simplify reads, while background compaction pays cleanup cost.`,
        `They also make crash recovery and reader isolation easier. A searcher can keep an old view while a writer publishes a new generation, and recovery can reason about committed segment metadata rather than a half-mutated monolithic index.`,
      ],
    },
    {
      heading: `Where It Fails`,
      paragraphs: [
        `A Lucene update is not an in-place row update; it is delete plus add. Force-merging at the wrong time can create heavy IO and hurt active indexing. Segment count, deleted-doc percentage, merge backlog, and refresh cadence are operational signals. The LSM analogy is useful but incomplete because Lucene segments contain search-specific structures, not only sorted key-value runs.`,
        `It also fails when users expect database update semantics. Document ids can change after update, old versions remain until merge, and disk usage may grow while deletes wait for reclamation. Search freshness and storage cleanup are separate knobs.`,
      ],
    },
    {
      heading: `Worked Example`,
      paragraphs: [
        `A log search service ingests documents continuously and refreshes every second. Each refresh makes recent documents searchable, but also increases the number of small segments. Queries now fan out across more readers, while deletes from retention policies stay as markers until merges rewrite surviving documents.`,
        `If the team lowers refresh to 100 milliseconds, dashboards feel fresher but merge pressure rises. If it force-merges during peak ingest, indexing latency spikes. The right answer is not freshness at any cost; it is a measured balance between refresh interval, ingest rate, query latency, disk bandwidth, and merge backlog.`,
      ],
    },
    {
      heading: `Rule of thumb`,
      paragraphs: [
        `Think of segments as immutable search files plus a debt-payment system. Fast visibility creates small files; deletes create dead weight; merges pay the debt. Healthy operations make that debt visible before users feel it as latency.`,
      ],
    },
    {
      heading: `Operational case study`,
      paragraphs: [
        `An observability cluster ingests logs into hourly indexes. During an incident, ingest spikes and refreshes keep dashboards current. That creates many small segments, while retention deletes mark old documents without immediately reclaiming space. Search latency begins to rise because every query fans out over more segment readers.`,
        `The fix is not one magic setting. The team may lengthen refresh slightly, increase indexing batches, throttle merges less during quiet hours, move old time partitions to read-only storage, and force-merge only sealed indexes. Each move changes freshness, write throughput, search latency, and disk pressure.`,
        `This is why Lucene segment health belongs in product operations, not only storage internals. Users experience it as search freshness and latency; operators see it as merge backlog, deleted-document ratio, segment count, cache churn, and disk bandwidth.`,
      ],
    },
    {
      heading: `Implementation checklist`,
      paragraphs: [
        `Treat updates as delete-plus-add in application design. If a product expects stable document ids, external ids and versioning need to live above Lucene's internal per-segment doc ids. Internal doc ids are implementation details that can change as segments merge.`,
        `Plan for warmup after large merges. A new merged segment may be better for future queries, but it also replaces files that were hot in the operating-system cache. Search latency can wobble while the new segment's term dictionaries, postings, and doc values become hot.`,
        `Do not confuse commit with refresh. A commit is the durable index generation. A near-real-time refresh opens a reader on recent segment changes. Products often care about refresh latency, while disaster recovery cares about commit durability.`,
      ],
    },
    {
      heading: `Sources and Study Next`,
      paragraphs: [
        `Primary sources: Lucene index package summary at https://lucene.apache.org/core/9_9_1/core/org/apache/lucene/index/package-summary.html, Lucene file format notes at https://lucene.apache.org/core/9_0_0/core/org/apache/lucene/codecs/lucene90/package-summary.html, and Solr segment merging documentation at https://solr.apache.org/guide/solr/latest/configuration-guide/index-segments-merging.html. Study Inverted Index, LSM Tree, Roaring Bitmaps, Database Indexing, and ClickHouse MergeTree Case Study next.`,
      ],
    },
  ],
};
