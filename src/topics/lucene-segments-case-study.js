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
      heading: 'What it is',
      paragraphs: [
        'Apache Lucene is the indexing library under systems such as Elasticsearch and Solr. Its index is composed of segments. Each segment is a complete searchable index over some documents, and segments are immutable after they are written.',
        'This case study extends Inverted Index, Roaring Bitmaps, Database Indexing, LSM Tree, and ClickHouse MergeTree Case Study. It shows the same broad storage lesson in search form: immutable files simplify readers, while background merges pay the cleanup cost.',
        'The architectural win is reader isolation. A searcher can hold a stable view of old segment files while IndexWriter creates newer files. Publishing a new generation changes which files are live without rewriting the files that existing readers still need.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'IndexWriter buffers documents and flushes new segment files. A commit point records the current segment set. Searchers open a point-in-time view and search across live segments. Updates are implemented as delete plus add; delete markers hide old documents until a merge removes them physically.',
        'A segment contains term dictionaries, postings lists, positions, stored fields, doc values, norms, and metadata. Different Lucene versions use different codec details, but the high-level model remains stable: new writes create new immutable index pieces.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Segment immutability makes readers safe and cache-friendly, but it shifts work to merging. Too many small segments increase per-query overhead. Too much merging consumes IO and CPU. Deleted documents occupy space until a merge rewrites the segment without them.',
        'Near-real-time search adds another knob. Frequent refresh makes new documents searchable quickly but can increase small-segment pressure. Production search systems tune refresh intervals, merge policies, disk bandwidth, and indexing batch sizes together.',
        'The analogy to LSM storage is useful but incomplete. Both write immutable runs and merge them later, but Lucene segments contain full search structures such as postings, positions, stored fields, and doc values. Merge cost is therefore search-index-specific, not just sorted-key compaction.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Lucene segments power full-text search, log search, e-commerce search, observability search, document retrieval, and search-backed analytics through Lucene itself, Solr, Elasticsearch, OpenSearch, and embedded search applications.',
        'A complete case study is log ingestion. New log events flush into small segments and become searchable after refresh. Queries fan out across segments. Background merges reduce segment count and reclaim deleted documents from retention or updates.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A Lucene update is not an in-place row update. It is delete plus add. Force-merging can reduce segment count, but doing it at the wrong time can create heavy IO and hurt active indexing. Segment count, deleted-doc percentage, and merge backlog are operational signals, not trivia.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Lucene index package summary at https://lucene.apache.org/core/9_9_1/core/org/apache/lucene/index/package-summary.html, Lucene file format notes at https://lucene.apache.org/core/9_0_0/core/org/apache/lucene/codecs/lucene90/package-summary.html, and Solr segment merging documentation at https://solr.apache.org/guide/solr/latest/configuration-guide/index-segments-merging.html. Study Inverted Index, LSM Tree, Roaring Bitmaps, Database Indexing, and ClickHouse MergeTree Case Study next.',
      ],
    },
  ],
};
